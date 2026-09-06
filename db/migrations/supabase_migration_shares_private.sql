-- ══════════════════════════════════════════════════════════════
-- Sprint 66 — PRIVATE share lists.
--
-- Collaborator emails become OWNER-ONLY (plus a global-admin
-- allow-list) by moving the share list OFF the `trips` row and into
-- `public.trip_shares`.
--
-- WHY: an RLS SELECT policy on `trips` authorizes the WHOLE ROW. As
-- long as the collaborator list is a column on `trips`
-- (`collaborators` JSONB), every person a map is shared with can read
-- every other recipient's email straight out of the raw row — no UI
-- involved. `trip_shares` already carries per-recipient RLS
-- (owner sees all rows for their trip; a recipient sees ONLY the row
-- addressed to their own email). This migration makes that table the
-- source of truth and stops the trips shared-read policy from ever
-- consulting the JSONB.
--
-- HOW TO RUN:
--   1. Supabase Dashboard → SQL Editor → New query.
--   2. Paste this whole file and click Run.
--   3. Idempotent — safe to run more than once.
--
-- ADDITIVE / NON-DESTRUCTIVE: the `trips.collaborators` column is
-- KEPT (now unused) for rollback safety. A later migration drops it.
-- Deploy the matching app build right after running this.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Global-admin allow-list ───────────────────────────────
-- Mirrors api/admin/overview.js' ADMIN_EMAILS default. Add an admin
-- later with a single INSERT — no migration, no redeploy.
create table if not exists public.admin_emails (
  email      text primary key,
  created_at timestamptz not null default now()
);

insert into public.admin_emails (email) values ('yoav.pintel@gmail.com')
  on conflict (email) do nothing;

alter table public.admin_emails enable row level security;
-- No policies are defined → the table is unreadable through the
-- anon / authenticated PostgREST API. Only SECURITY DEFINER functions
-- (below) and the service role can see it.

create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_global_admin() from public;
grant execute on function public.is_global_admin() to authenticated;

-- ── 2. trip_shares — schema top-up ──────────────────────────
-- The table already exists from supabase_migration_sharing.sql:
--   (id, trip_id → trips.id, shared_with_email, access_level
--    check ('view','edit'), created_at, unique(trip_id, shared_with_email))
-- Add an optional label for the owner's "manage access" list.
alter table public.trip_shares
  add column if not exists display_name text;

-- ── 3. Back-fill existing JSONB collaborators → trip_shares ──
-- Nobody currently shared loses access. jsonb_typeof guards a
-- malformed (non-array) value so the set-returning call can't raise.
insert into public.trip_shares (trip_id, shared_with_email, access_level, display_name)
select t.id,
       lower(c ->> 'email'),
       case when (c ->> 'role') = 'edit' then 'edit' else 'view' end,
       nullif(c ->> 'name', '')
from public.trips t
     cross join lateral jsonb_array_elements(
       case when jsonb_typeof(t.collaborators) = 'array'
            then t.collaborators
            else '[]'::jsonb end
     ) as c
where coalesce(c ->> 'email', '') <> ''
on conflict (trip_id, shared_with_email) do nothing;

-- ── 4. trip_shares RLS — let a global admin read every row ───
-- Owner select / insert / update / delete policies from
-- supabase_migration_sharing.sql are UNCHANGED (owner still manages
-- through the trips.owner_id check). Only the recipient-read policy
-- is widened, to also cover the global admin.
drop policy if exists "trip_shares: recipient select" on public.trip_shares;
create policy "trip_shares: recipient select"
  on public.trip_shares for select
  using (
    lower(shared_with_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.is_global_admin()
  );

-- ── 5. trips shared-READ — ONE recursion-safe policy ─────────
-- Retire every earlier shared-read variant so exactly one remains,
-- and none of them scans the JSONB `collaborators` anymore.
drop policy if exists "trips: shared read"                        on public.trips;
drop policy if exists "Collaborators can view shared trip details" on public.trips;
drop policy if exists trips_collab_read                           on public.trips;

-- public.user_has_trip_share(text, text) already exists from
-- supabase_migration_shared_read.sql — SECURITY DEFINER, so it does
-- NOT re-enter trip_shares' RLS and cannot recurse back into trips.
-- Recreate it here so this file stands alone / is safe to run first.
create or replace function public.user_has_trip_share(p_trip_id text, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_shares s
    where s.trip_id = p_trip_id
      and lower(s.shared_with_email) = lower(coalesce(p_email, ''))
  );
$$;
revoke all on function public.user_has_trip_share(text, text) from public;
grant execute on function public.user_has_trip_share(text, text) to authenticated;

create policy "trips: shared read"
  on public.trips for select
  using (
    public.user_has_trip_share(trips.id, auth.jwt() ->> 'email')
    or public.is_global_admin()
  );
-- Owner + null-owner reads stay covered by "Owners can always read
-- own trips"; public reads by trips_public_read. RLS ORs permissive
-- policies, so those keep working untouched.

-- ── 6. trips UPDATE — owner OR an 'edit' share ───────────────
create or replace function public.user_can_edit_trip_share(p_trip_id text, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_shares s
    where s.trip_id = p_trip_id
      and lower(s.shared_with_email) = lower(coalesce(p_email, ''))
      and s.access_level = 'edit'
  );
$$;
revoke all on function public.user_can_edit_trip_share(text, text) from public;
grant execute on function public.user_can_edit_trip_share(text, text) to authenticated;

drop policy if exists trips_collab_edit on public.trips;
create policy trips_collab_edit
  on public.trips for update
  using (
    auth.uid() = owner_id
    or public.user_can_edit_trip_share(trips.id, auth.jwt() ->> 'email')
  )
  with check (
    auth.uid() = owner_id
    or public.user_can_edit_trip_share(trips.id, auth.jwt() ->> 'email')
  );

-- ── 7. trips.collaborators — KEPT, now unused ────────────────
comment on column public.trips.collaborators is
  'DEPRECATED (Sprint 66). The share list moved to public.trip_shares '
  'for per-recipient privacy — a recipient must never read another '
  'recipient''s email. Kept only for rollback; a later migration drops '
  'it. No app code reads or writes this column as of Sprint 66.';

-- ══════════════════════════════════════════════════════════════
-- After running: owners (and admins) still see the full list via
-- trip_shares' owner-select policy; a recipient's API response
-- contains only the trip content plus their OWN trip_shares row.
-- ══════════════════════════════════════════════════════════════
