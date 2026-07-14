-- ══════════════════════════════════════════════════════════════
-- saas-trip-builder — Supabase schema (Sprint 26)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- Idempotent: safe to re-run.
-- ══════════════════════════════════════════════════════════════

-- ── 1. users — public profile row per auth user ────────────────
-- auth.users is managed by Supabase Auth (Google OAuth). This table
-- mirrors the public-facing profile and is auto-populated by a
-- trigger on signup.
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  email       text,
  avatar_url  text,
  plan        text not null default 'Free',
  created_at  timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "users: read own profile" on public.users;
create policy "users: read own profile"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "users: update own profile" on public.users;
create policy "users: update own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create the profile row on signup (Google metadata → profile).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 2. trips — the trip maps (itinerary payload as JSONB) ──────
create table if not exists public.trips (
  id            text primary key,                -- client-generated (trip_xxxxxxx)
  owner_id      uuid not null references auth.users (id) on delete cascade,
  owner_name    text,
  title         text not null default 'מסלול חדש',
  cover         text,
  days          integer not null default 0,
  meta          text,
  read_only     boolean not null default false,
  collaborators jsonb not null default '[]'::jsonb,
  trip_memo     text,
  settings      jsonb not null default '{}'::jsonb,  -- destination, center, cityRanges…
  data          jsonb not null default '{}'::jsonb,  -- tripData days + attractions payload
  last_edited   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists trips_owner_idx on public.trips (owner_id, last_edited desc);

alter table public.trips enable row level security;

drop policy if exists "trips: owner select" on public.trips;
create policy "trips: owner select"
  on public.trips for select
  using (auth.uid() = owner_id);

drop policy if exists "trips: owner insert" on public.trips;
create policy "trips: owner insert"
  on public.trips for insert
  with check (auth.uid() = owner_id);

drop policy if exists "trips: owner update" on public.trips;
create policy "trips: owner update"
  on public.trips for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "trips: owner delete" on public.trips;
create policy "trips: owner delete"
  on public.trips for delete
  using (auth.uid() = owner_id);

-- ── 3. places_inbox — saved POIs awaiting placement ────────────
-- Populated by the Google Takeout importer (and future integrations);
-- the editor's "רשימת נקודות" INBOX reads from here.
create table if not exists public.places_inbox (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  name_he     text,
  category    text default 'אטרקציה',
  rating      text,
  lat         double precision not null,
  lng         double precision not null,
  assigned    boolean not null default false,
  source      text default 'takeout',           -- takeout | google | manual
  created_at  timestamptz not null default now()
);

create index if not exists places_inbox_owner_idx on public.places_inbox (owner_id, created_at desc);

alter table public.places_inbox enable row level security;

drop policy if exists "places_inbox: owner select" on public.places_inbox;
create policy "places_inbox: owner select"
  on public.places_inbox for select
  using (auth.uid() = owner_id);

drop policy if exists "places_inbox: owner insert" on public.places_inbox;
create policy "places_inbox: owner insert"
  on public.places_inbox for insert
  with check (auth.uid() = owner_id);

drop policy if exists "places_inbox: owner update" on public.places_inbox;
create policy "places_inbox: owner update"
  on public.places_inbox for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "places_inbox: owner delete" on public.places_inbox;
create policy "places_inbox: owner delete"
  on public.places_inbox for delete
  using (auth.uid() = owner_id);
