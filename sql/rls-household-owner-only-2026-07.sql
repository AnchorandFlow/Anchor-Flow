-- ============================================================
-- Security fix: restrict household DELETE and owner_id changes
-- to the household owner only.
--
-- NOT YET RUN. This project has no local Supabase migration files
-- (only sql/production-functions-2026-07.sql, a dump of RPC
-- functions -- not RLS policies), so the current policy state on
-- `households` could not be read or diffed against from this repo.
-- Run this manually in the Supabase dashboard -> SQL Editor, and
-- verify against the actual current policies first (this assumes
-- none of the below already exists under a different name).
--
-- Schema assumed (inferred from the app's own REST/RPC calls,
-- src/App.jsx and sql/production-functions-2026-07.sql):
--   households(id, owner_id, data jsonb, updated_at, updated_by)
--   household_members(household_id, user_id, role)
--
-- IMPORTANT -- why owner_id is protected via a TRIGGER, not a
-- table-wide "UPDATE: owner only" RLS policy:
-- public.merge_household_data() (sql/production-functions-2026-07.sql)
-- has no SECURITY DEFINER, so it runs as SECURITY INVOKER -- under
-- the CALLING member's own permissions. Every non-owner household
-- member calls it to sync `data`/`updated_at`/`updated_by` on every
-- sync. A blanket "only the owner can UPDATE households" policy
-- would break sync for every member who isn't the owner. RLS
-- UPDATE policies also can't compare OLD vs NEW column values on
-- their own (WITH CHECK only sees the new row), so a trigger is the
-- correct tool for "this one column may only change if you're the
-- current owner" while leaving other columns updatable by any
-- member as today.
-- ============================================================

alter table public.households enable row level security;

-- 1. DELETE: owner only. No legitimate use case for a non-owner
--    member to delete the household, so this is a plain RLS policy.
drop policy if exists "households_delete_owner_only" on public.households;
create policy "households_delete_owner_only"
  on public.households
  for delete
  using (auth.uid() = owner_id);

-- 2. owner_id: immutable except by the current owner. Leaves
--    data/updated_at/updated_by updatable by any member, as today.
create or replace function public.protect_household_owner_id()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.owner_id is distinct from OLD.owner_id
     and auth.uid() is distinct from OLD.owner_id then
    raise exception 'only the household owner can change ownership';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_protect_household_owner_id on public.households;
create trigger trg_protect_household_owner_id
  before update on public.households
  for each row
  execute function public.protect_household_owner_id();
