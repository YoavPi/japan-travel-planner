-- ══════════════════════════════════════════════════════════════
-- Shared-trip READ access for share links.
--
-- ⚠️ HOTFIX — RUN THIS FILE. It repairs a POLICY RECURSION introduced by the
-- previous version of this migration, which broke BOTH the dashboard trip
-- list (infinite loading skeleton) and trip creation (CTA stuck on "יוצר…").
--
-- THE BUG: the old "trips: shared read" policy subqueried public.trip_shares.
-- trip_shares' own "owner select" policy subqueries public.trips. So every
-- SELECT on trips re-entered trip_shares → back into trips → Postgres aborts
-- with: 'infinite recursion detected in policy for relation "trips"' (42P17).
-- Any read of trips failed, including the RETURNING read after an INSERT.
--
-- THE FIX: the trip_shares lookup now goes through a SECURITY DEFINER
-- function, which runs with the definer's rights and therefore does NOT
-- re-evaluate trip_shares' RLS — breaking the cycle. The collaborators check
-- is also guarded by jsonb_typeof, because jsonb_array_elements() RAISES on a
-- non-array value and an error inside a policy fails the entire scan.
--
-- HOW TO RUN:
--   1. Supabase Dashboard → SQL Editor → New query.
--   2. Paste this whole file and click Run. Idempotent — safe to re-run.
--
-- Still ADDITIVE and NON-DESTRUCTIVE: no existing table, column, or the
-- "trips: owner select" policy is altered. Owners keep full access; this only
-- ADDS a second permissive SELECT policy (RLS ORs permissive policies).
-- Writes stay owner-only (shared users render read-only in the client).
-- ══════════════════════════════════════════════════════════════

-- ── 1. Drop the recursive policy from the previous version ─────
drop policy if exists "trips: shared read" on public.trips;

-- ── 2. SECURITY DEFINER lookup — bypasses trip_shares RLS, so the
--      trips policy can never re-enter trips and recurse.
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

-- ── 3. Recreate the shared-read policy (now recursion-free) ────
create policy "trips: shared read"
  on public.trips for select
  using (
    -- (a) an explicit invitation row addressed to this user's email
    public.user_has_trip_share(trips.id, auth.jwt() ->> 'email')
    -- (b) OR this user's email appears in the trip's collaborators JSONB.
    --     jsonb_typeof guards the set-returning call so a malformed
    --     (non-array) value can never raise and kill the whole scan.
    or (
      jsonb_typeof(coalesce(trips.collaborators, '[]'::jsonb)) = 'array'
      and exists (
        select 1
        from jsonb_array_elements(coalesce(trips.collaborators, '[]'::jsonb)) AS c
        where lower(c ->> 'email') = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  );
