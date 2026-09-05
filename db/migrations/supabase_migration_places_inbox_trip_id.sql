-- Add trip association to places_inbox.
--
-- Bug: the editor's Points Bank has a "הבנק לטיול זה" ("the bank FOR THIS
-- TRIP") tab that today shows the exact same rows as "כל הנקודות שלי" (all
-- my points) — because places_inbox has never had a trip_id column, so
-- "trip" vs "global" has never actually been trip-scoped; the tab label
-- has simply been wrong. This migration adds the missing column so the
-- service layer can start scoping writes (and, in a later pass, reads) by
-- trip. It does NOT change any RLS policy — see note below.
--
-- Nullable by design: every row saved before this migration has no trip
-- context. It must not disappear or error — it should keep showing up
-- exactly where it does today (both tabs). The intended read-side contract
-- (implemented in a later pass, not by this migration) is:
--   "trip" tab   → trip_id = <this trip> OR trip_id IS NULL
--   "global" tab → unfiltered (unchanged from today)
--
-- Assumption about production state: this migration assumes
-- database-schema.sql's `places_inbox` table definition (owner_id +
-- owner-scoped RLS policies) and supabase_migration_places_inbox_delete.sql
-- (the owner-delete policy) have already been applied. There is no
-- migration-tracking table in this project, so that assumption is NOT
-- verified by this script — confirm against the live schema first if in
-- doubt (Supabase Dashboard → Table Editor → places_inbox).
--
-- Idempotent: safe to re-run.

alter table public.places_inbox
  add column if not exists trip_id text references public.trips (id) on delete set null;

-- Speeds up the future "trip" tab query (owner_id = me AND (trip_id = X OR
-- trip_id IS NULL)) once the read side is wired up.
create index if not exists places_inbox_owner_trip_idx
  on public.places_inbox (owner_id, trip_id);

-- ── RLS: intentionally unchanged ────────────────────────────────────────
-- Verified against database-schema.sql: all four existing places_inbox
-- policies ("owner select/insert/update/delete") are scoped purely by
-- `auth.uid() = owner_id` and never reference trip_id. A nullable
-- additional column that only exists to say "which trip's tab does this
-- row belong to" doesn't change who can see/write a row — ownership
-- (owner_id) remains the only access-control dimension. No new policy is
-- needed, and none is added here.
