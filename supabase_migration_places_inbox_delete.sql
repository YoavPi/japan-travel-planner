-- Fix: bank-point delete not persisting (row reappears on reload).
-- Ensures the places_inbox DELETE RLS policy exists so removeInboxPlace() can
-- actually delete the owner's own saved points. Idempotent — safe to re-run.

alter table public.places_inbox enable row level security;

drop policy if exists "places_inbox: owner delete" on public.places_inbox;
create policy "places_inbox: owner delete"
  on public.places_inbox for delete
  using (auth.uid() = owner_id);
