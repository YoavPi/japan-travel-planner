-- ═══════════════════════════════════════════════════════════════════
-- Sprint 63 — FIX: trips disappeared after the trip_collaborators migration
--
-- ROOT CAUSE: a CIRCULAR RLS dependency.
--   • the Sprint 62 `trips_collab_select` policy on `trips` sub-queries
--     `trip_collaborators`, and
--   • the `trip_collaborators` policies sub-query `trips`.
-- Evaluating any SELECT on `trips` therefore recurses, and Postgres aborts
-- the WHOLE query with:
--     "infinite recursion detected in policy for relation \"trips\""
-- so even an owner-scoped read (…eq('owner_id', auth.uid())) fails and the
-- dashboard renders empty.
--
-- FIX: (1) guarantee owners can always read their own trips with a simple,
-- self-contained policy, and (2) break the recursion by moving the
-- cross-table checks into SECURITY DEFINER functions that read with RLS
-- bypassed, so no policy sub-queries another RLS-protected table.
--
-- Run this in the Supabase SQL editor (or `supabase db push`). It is
-- idempotent and safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

-- 0) Retire the recursive Sprint 62 policies (names from that migration) ----
drop policy if exists trips_collab_select        on public.trips;
drop policy if exists trips_collab_update         on public.trips;
drop policy if exists trip_collaborators_select   on public.trip_collaborators;
drop policy if exists trip_collaborators_write    on public.trip_collaborators;

-- 1) SPEC FIX — owners (and legacy rows with a null owner) always readable.
--    Self-contained (no sub-query) → can never recurse. SELECT policies are
--    OR-combined, so this restores the trips list immediately.
drop policy if exists "Owners can always read own trips" on public.trips;
create policy "Owners can always read own trips"
  on public.trips for select
  using (auth.uid() = owner_id or owner_id is null);

-- 2) SECURITY DEFINER helpers — evaluated with RLS bypassed, so using them
--    inside a policy does NOT re-enter the other table's RLS (no recursion).
create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.trips t where t.id = p_trip_id and t.owner_id = auth.uid());
$$;

create or replace function public.is_trip_collaborator(p_trip_id uuid, p_need_edit boolean default false)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.trip_collaborators c
    where c.trip_id = p_trip_id
      and c.user_id = auth.uid()
      and (not p_need_edit or c.role = 'edit')
  );
$$;

-- 3) Re-add collaborator access WITHOUT the cross-table sub-query cycle -----
-- trips: collaborators may read; 'edit' collaborators may update.
drop policy if exists trips_collab_read on public.trips;
create policy trips_collab_read
  on public.trips for select
  using (public.is_trip_collaborator(id, false));

drop policy if exists trips_collab_edit on public.trips;
create policy trips_collab_edit
  on public.trips for update
  using (auth.uid() = owner_id or public.is_trip_collaborator(id, true))
  with check (auth.uid() = owner_id or public.is_trip_collaborator(id, true));

-- trip_collaborators: a row is visible to the collaborator themselves and to
-- the trip owner (owner check via the SECURITY DEFINER helper — no recursion).
drop policy if exists trip_collaborators_read on public.trip_collaborators;
create policy trip_collaborators_read
  on public.trip_collaborators for select
  using (user_id = auth.uid() or public.is_trip_owner(trip_id));

-- only the trip owner may invite / change / remove collaborators.
drop policy if exists trip_collaborators_manage on public.trip_collaborators;
create policy trip_collaborators_manage
  on public.trip_collaborators for all
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

-- ═══════════════════════════════════════════════════════════════════
-- After running: the owner SELECT policy alone restores the trips list;
-- collaborators keep read (and 'edit' keep write) with zero recursion.
-- ═══════════════════════════════════════════════════════════════════
