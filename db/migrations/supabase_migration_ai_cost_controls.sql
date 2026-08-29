-- ════════════════════════════════════════════════════════════════════════
-- AI cost-control refactor (2026-08-22)
--
-- Delta on top of the existing `ai_generations` + `place_cache` tables:
--   1. place_cache gains `updated_at` so a cached place can be REFRESHED
--      after ~6 months (Cache TTL) instead of trusted forever.
--   2. place_cache gains an UPDATE policy so the 6-month refresh (an upsert
--      that UPDATEs the existing row) actually persists.
--   3. ai_generations gets an index for the weekly-count + cooldown lookups.
--
-- Safe to run more than once (all statements are idempotent). Run in the
-- Supabase SQL editor. Feature keeps working without it (updated_at simply
-- falls back to a timestamp inside the payload), but running it makes the
-- 6-month refresh and the rate-limit queries efficient.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Freshness column on the shared place cache.
alter table if exists public.place_cache
  add column if not exists updated_at timestamptz not null default now();

-- 2. Let signed-in users refresh a stale cached place (upsert → UPDATE path).
--    The cache holds only neutral place identity, so any authenticated user
--    may refresh it. (SELECT/INSERT policies were created with the table.)
drop policy if exists "place_cache authenticated update" on public.place_cache;
create policy "place_cache authenticated update"
  on public.place_cache
  for update
  to authenticated
  using (true)
  with check (true);

-- 3. Index the weekly-quota count + cooldown "latest generation" lookups.
create index if not exists ai_generations_user_created_idx
  on public.ai_generations (user_id, created_at desc);

-- 4. Durable failure log for the daily review. Users only ever see a calm
--    generic message; the real reason lands here (and in the Vercel logs).
create table if not exists public.ai_errors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  message    text,
  context    jsonb,
  created_at timestamptz not null default now()
);
alter table public.ai_errors enable row level security;

-- Signed-in users may INSERT their own failure (the API writes with their token).
drop policy if exists "ai_errors owner insert" on public.ai_errors;
create policy "ai_errors owner insert"
  on public.ai_errors
  for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- No SELECT policy → rows are readable only with the service-role key (your
-- daily review), never by end users.
create index if not exists ai_errors_created_idx on public.ai_errors (created_at desc);
