-- ═══════════════════════════════════════════════════════════════════
-- Sprint 64 — FIX: opening a SHARED trip fails ("לא ניתן לטעון את הטיול")
--
-- Two bugs are corrected here:
--
-- (A) TYPE MISMATCH. `public.trips.id` is TEXT (client-generated
--     'trip_xxxxxxx'), but the Sprint 62/63 collaborator objects typed
--     trip ids as UUID (trip_collaborators.trip_id uuid, and
--     is_trip_collaborator(uuid,…)). Passing the text `id` into a uuid
--     policy expression raises at evaluation time, so a trips SELECT that
--     touches those objects fails — which is why a collaborator can list
--     trips (owner-only policy) yet cannot open one (the row read hits the
--     collaborator policy). Everything below is re-typed to TEXT, which is
--     also safe if your `trips.id` happens to be uuid (uuid→text is an
--     implicit, lossless cast).
--
-- (B) MISSING SINGLE-ROW SELECT for collaborators. A dedicated policy now
--     grants SELECT to the owner, legacy null-owner rows, table
--     collaborators, AND the app's JSONB `collaborators` list (email
--     match, jsonb_typeof-guarded) so both sharing mechanisms load.
--
-- Idempotent — safe to run more than once. Additive to the owner policies.
-- ═══════════════════════════════════════════════════════════════════

-- 0) Drop policies that depend on the mis-typed helper functions ------------
drop policy if exists trips_collab_read  on public.trips;
drop policy if exists trips_collab_edit  on public.trips;
drop policy if exists "Collaborators can view shared trip details" on public.trips;

-- 1) Recreate trip_collaborators keyed by TEXT trip_id (it is new/empty in
--    the app flow, so a clean recreate is safe and fixes the FK type). ------
drop table if exists public.trip_collaborators cascade;
create table public.trip_collaborators (
  trip_id    text not null references public.trips(id) on delete cascade,
  user_id    uuid not null references auth.users(id)   on delete cascade,
  email      text,
  role       text not null default 'view' check (role in ('view', 'edit')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index if not exists trip_collaborators_user_idx on public.trip_collaborators(user_id);
alter table public.trip_collaborators enable row level security;

-- 2) SECURITY DEFINER helpers, TEXT trip ids (no recursion, no type error) --
drop function if exists public.is_trip_collaborator(uuid, boolean);
drop function if exists public.is_trip_owner(uuid);

create or replace function public.is_trip_owner(p_trip_id text)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (select 1 from public.trips t where t.id = p_trip_id and t.owner_id = auth.uid());
$$;

-- Matches the spec's call form is_trip_collaborator(id, auth.uid()).
create or replace function public.is_trip_collaborator(p_trip_id text, p_user_id uuid default auth.uid())
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.trip_collaborators c
    where c.trip_id = p_trip_id and c.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.is_trip_editor(p_trip_id text)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.trip_collaborators c
    where c.trip_id = p_trip_id and c.user_id = auth.uid() and c.role = 'edit'
  );
$$;

-- 3) SELECT — owner OR null-owner OR table collaborator OR JSONB collaborator.
create policy "Collaborators can view shared trip details"
on public.trips for select using (
  auth.uid() = owner_id
  or owner_id is null
  or public.is_trip_collaborator(id, auth.uid())
  or (
    jsonb_typeof(coalesce(collaborators, '[]'::jsonb)) = 'array'
    and exists (
      select 1 from jsonb_array_elements(coalesce(collaborators, '[]'::jsonb)) e
      where lower(e ->> 'email') = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
);

-- 4) UPDATE — owner OR 'edit' collaborator (table role OR JSONB role='edit').
create policy trips_collab_edit
on public.trips for update using (
  auth.uid() = owner_id
  or public.is_trip_editor(id)
  or (
    jsonb_typeof(coalesce(collaborators, '[]'::jsonb)) = 'array'
    and exists (
      select 1 from jsonb_array_elements(coalesce(collaborators, '[]'::jsonb)) e
      where lower(e ->> 'email') = lower(coalesce(auth.jwt() ->> 'email', '')) and e ->> 'role' = 'edit'
    )
  )
) with check (
  auth.uid() = owner_id
  or public.is_trip_editor(id)
  or (
    jsonb_typeof(coalesce(collaborators, '[]'::jsonb)) = 'array'
    and exists (
      select 1 from jsonb_array_elements(coalesce(collaborators, '[]'::jsonb)) e
      where lower(e ->> 'email') = lower(coalesce(auth.jwt() ->> 'email', '')) and e ->> 'role' = 'edit'
    )
  )
);

-- 5) trip_collaborators policies (owner check via SECURITY DEFINER → no cycle)
drop policy if exists trip_collaborators_read   on public.trip_collaborators;
create policy trip_collaborators_read
  on public.trip_collaborators for select
  using (user_id = auth.uid() or public.is_trip_owner(trip_id));

drop policy if exists trip_collaborators_manage on public.trip_collaborators;
create policy trip_collaborators_manage
  on public.trip_collaborators for all
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));
