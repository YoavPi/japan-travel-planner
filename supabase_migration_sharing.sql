-- ══════════════════════════════════════════════════════════════
-- Sprint 36.5 — Sharing & Notifications migration (#16, #18)
--
-- HOW TO RUN:
--   1. Open your Supabase project → SQL Editor → "New query".
--   2. Paste this entire file.
--   3. Click "Run".  It is idempotent — safe to run more than once.
--
-- This ADDS two tables to the existing schema (trips / places_inbox /
-- users from database-schema.sql). It does NOT alter or drop anything
-- that already exists.
-- ══════════════════════════════════════════════════════════════

-- ── 1. trip_shares — collaborator invitations per trip ─────────
create table if not exists public.trip_shares (
  id                uuid primary key default gen_random_uuid(),
  trip_id           text not null references public.trips (id) on delete cascade,
  shared_with_email text not null,
  access_level      text not null default 'view' check (access_level in ('view', 'edit')),
  created_at        timestamptz not null default now(),
  -- one invite per (trip, email)
  unique (trip_id, shared_with_email)
);

create index if not exists trip_shares_trip_idx  on public.trip_shares (trip_id);
create index if not exists trip_shares_email_idx on public.trip_shares (lower(shared_with_email));

alter table public.trip_shares enable row level security;

-- The trip OWNER manages shares on their own trips.
drop policy if exists "trip_shares: owner select" on public.trip_shares;
create policy "trip_shares: owner select"
  on public.trip_shares for select
  using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

drop policy if exists "trip_shares: owner insert" on public.trip_shares;
create policy "trip_shares: owner insert"
  on public.trip_shares for insert
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

drop policy if exists "trip_shares: owner update" on public.trip_shares;
create policy "trip_shares: owner update"
  on public.trip_shares for update
  using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

drop policy if exists "trip_shares: owner delete" on public.trip_shares;
create policy "trip_shares: owner delete"
  on public.trip_shares for delete
  using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

-- A recipient can SEE shares addressed to their own email (read-only).
drop policy if exists "trip_shares: recipient select" on public.trip_shares;
create policy "trip_shares: recipient select"
  on public.trip_shares for select
  using (lower(shared_with_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ── 2. notifications — per-user activity feed ──────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  message    text,
  type       text not null default 'info'
             check (type in ('info', 'share', 'edit', 'system')),
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- A user reads/updates (mark-as-read)/deletes ONLY their own notifications.
drop policy if exists "notifications: owner select" on public.notifications;
create policy "notifications: owner select"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications: owner update" on public.notifications;
create policy "notifications: owner update"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifications: owner delete" on public.notifications;
create policy "notifications: owner delete"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- Inserts are normally performed by a trigger / service role when an
-- event fires (e.g. a trip is shared). Allow a user to self-insert too
-- (e.g. local optimistic writes) — scoped to their own id.
drop policy if exists "notifications: self insert" on public.notifications;
create policy "notifications: self insert"
  on public.notifications for insert
  with check (auth.uid() = user_id);

-- ── 3. (Optional) auto-notify a recipient when a trip is shared ──
-- Fires on every new trip_shares row: if the invited email already has an
-- account, drop a "share" notification into their feed.
create or replace function public.notify_on_trip_share()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recipient uuid;
  trip_title text;
begin
  select id into recipient from auth.users where lower(email) = lower(new.shared_with_email) limit 1;
  if recipient is not null then
    select title into trip_title from public.trips where id = new.trip_id;
    insert into public.notifications (user_id, title, message, type)
    values (recipient, 'שותפו איתך במסלול', coalesce(trip_title, 'מסלול') , 'share');
  end if;
  return new;
end;
$$;

drop trigger if exists on_trip_share on public.trip_shares;
create trigger on_trip_share
  after insert on public.trip_shares
  for each row execute function public.notify_on_trip_share();
