-- ═══════════════════════════════════════════════════════════════════
-- Sprint 62 #7 — Live collaboration: trip_collaborators + RLS
--
-- Run this in the Supabase SQL editor (or via `supabase db push`) to
-- enable full read/write access for invited collaborators. This file is
-- provided for you to APPLY — the app code cannot (and must not) mutate
-- backend models on its own.
--
-- Prereqs: a `trips` table with columns `id uuid` and `owner_id uuid`
-- (referencing auth.users). Adjust names if your schema differs.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Collaborators join table ----------------------------------------
create table if not exists public.trip_collaborators (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  user_id    uuid not null references auth.users(id)   on delete cascade,
  email      text,
  role       text not null default 'view' check (role in ('view', 'edit')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index if not exists trip_collaborators_user_idx on public.trip_collaborators(user_id);
create index if not exists trip_collaborators_trip_idx on public.trip_collaborators(trip_id);

alter table public.trip_collaborators enable row level security;

-- A collaborator row is visible to the trip owner and to the collaborator.
drop policy if exists trip_collaborators_select on public.trip_collaborators;
create policy trip_collaborators_select on public.trip_collaborators
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
  );

-- Only the trip owner may invite / change / remove collaborators.
drop policy if exists trip_collaborators_write on public.trip_collaborators;
create policy trip_collaborators_write on public.trip_collaborators
  for all using (
    exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
  );

-- 2) Extend the trips RLS so collaborators can read/write shared trips -
-- Owners keep full access; collaborators get read, and 'edit' collaborators
-- get update. (Keep any existing owner policies; these are additive.)

drop policy if exists trips_collab_select on public.trips;
create policy trips_collab_select on public.trips
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.trip_collaborators c
      where c.trip_id = id and c.user_id = auth.uid()
    )
  );

drop policy if exists trips_collab_update on public.trips;
create policy trips_collab_update on public.trips
  for update using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.trip_collaborators c
      where c.trip_id = id and c.user_id = auth.uid() and c.role = 'edit'
    )
  ) with check (
    owner_id = auth.uid()
    or exists (
      select 1 from public.trip_collaborators c
      where c.trip_id = id and c.user_id = auth.uid() and c.role = 'edit'
    )
  );

-- 3) Invite acceptance helper ----------------------------------------
-- Called after an invited user authenticates via /trip/<id>?invite=<token>.
-- Binds the invite (matched by email) to the now-known auth user id.
create or replace function public.accept_trip_invite(p_trip_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.trip_collaborators
     set user_id = auth.uid()
   where trip_id = p_trip_id
     and email = (select email from auth.users where id = auth.uid())
     and user_id is distinct from auth.uid();
end;
$$;
