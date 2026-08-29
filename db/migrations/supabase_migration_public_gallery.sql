-- Public Gallery — schema + RLS (2026-08-25)

-- 1. trips: gallery columns
alter table public.trips
  add column if not exists is_public boolean not null default false,
  add column if not exists gallery_category text,
  add column if not exists gallery_description text,
  add column if not exists published_at timestamptz,
  add column if not exists favorites_count integer not null default 0;

create index if not exists trips_is_public_idx on public.trips (is_public) where is_public;

-- 2. favorites table
create table if not exists public.trip_favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  trip_id    text not null references public.trips(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);
alter table public.trip_favorites enable row level security;

-- 3. favorites_count trigger (keeps the denormalized count in sync)
create or replace function public.tf_bump_count() returns trigger
language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    update public.trips set favorites_count = favorites_count + 1 where id = new.trip_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.trips set favorites_count = greatest(0, favorites_count - 1) where id = old.trip_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists tf_count_ins on public.trip_favorites;
drop trigger if exists tf_count_del on public.trip_favorites;
create trigger tf_count_ins after insert on public.trip_favorites for each row execute function public.tf_bump_count();
create trigger tf_count_del after delete on public.trip_favorites for each row execute function public.tf_bump_count();

-- 4. RLS: anyone (incl. anon) may read a PUBLIC trip
drop policy if exists trips_public_read on public.trips;
create policy trips_public_read on public.trips
  for select using (is_public = true);

-- 5. RLS: only the OWNER may change publication (owner-scoped update path).
drop policy if exists trips_owner_publish on public.trips;
create policy trips_owner_publish on public.trips
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 6. RLS: favorites are per-user
drop policy if exists tf_select on public.trip_favorites;
drop policy if exists tf_insert on public.trip_favorites;
drop policy if exists tf_delete on public.trip_favorites;
create policy tf_select on public.trip_favorites for select using (user_id = auth.uid());
create policy tf_insert on public.trip_favorites for insert with check (user_id = auth.uid());
create policy tf_delete on public.trip_favorites for delete using (user_id = auth.uid());
