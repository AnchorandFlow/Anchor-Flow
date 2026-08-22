-- ============================================================
-- ⚠️  GATED — DO NOT RUN WITHOUT EXPLICIT APPROVAL.
-- This is a DB schema change (new table + trigger function). Per this
-- project's own rule (see sql/2026-07_billing.sql), no DB change ships
-- without sign-off. Verify against the actual current schema on the
-- SANDBOX/test project first — this project has no tracked migration
-- history (see sql/rls-household-owner-only-2026-07.sql's own header), so
-- the current schema state is not fully known from this repo alone.
-- ============================================================
--
-- P0 data-protection follow-up to this session's sign-out data-loss
-- incident (people[]/Lighthouse orphaning — see the "preserve SYNC_KEYS
-- data on sign-out" fix earlier the same session) and the discovery that
-- Lighthouse edits had no trigger path to ever reach Supabase at all (see
-- the "immediate push for critical data keys" frontend fix, deployed
-- alongside this file). This is the second half: even with both of those
-- fixed, a single corrupted/bad push (bug, bad merge, accidental client
-- wipe) can still overwrite good server data with nothing already wrong
-- with getting a fresh row into households.data. This gives a last-resort
-- recovery path independent of any client-side bug.
--
-- Approach: an AFTER INSERT/UPDATE trigger on households, not a client-side
-- "insert a backup row after push" call — a trigger fires transactionally
-- as part of the same write, so a network drop or a client crash between
-- two separate calls can't skip a backup. It also automatically covers
-- every future write path to households.data, not just today's
-- pushHouseholdData, without needing to remember to call it from anywhere
-- new later.
--
-- Keeps the 5 most recent backups per household, pruned on every write.
--
-- household_id is text, not uuid: households.id is a text column on this
-- project (first apply attempt failed on the original uuid version with a
-- type mismatch) — matched here so the foreign key actually validates.

create table if not exists public.household_backups (
  id uuid primary key default gen_random_uuid(),
  household_id text not null references public.households(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists household_backups_household_id_created_at_idx
  on public.household_backups (household_id, created_at desc);

create or replace function public.backup_household_data() returns trigger as $$
begin
  insert into public.household_backups (household_id, data)
  values (new.id, new.data);

  -- Prune to the 5 most recent backups for this household.
  delete from public.household_backups
  where household_id = new.id
    and id not in (
      select id from public.household_backups
      where household_id = new.id
      order by created_at desc
      limit 5
    );

  return new;
end;
$$ language plpgsql security definer;

-- Two separate triggers rather than one INSERT-OR-UPDATE trigger with a
-- combined WHEN clause: TG_OP is only available inside the trigger
-- function body (PL/pgSQL), not in a CREATE TRIGGER ... WHEN (...) boolean
-- expression, so "when (TG_OP = 'INSERT' OR new.data is distinct from
-- old.data)" is not valid DDL. OLD also doesn't exist for an INSERT
-- trigger's row, so referencing old.data there would error regardless.

-- First backup on household creation (approved: yes, include this).
drop trigger if exists trg_backup_household_data_insert on public.households;
create trigger trg_backup_household_data_insert
  after insert on public.households
  for each row
  execute function public.backup_household_data();

-- Subsequent backups only when data actually changed — avoids a useless
-- backup row on updates that only touch other columns (e.g. owner_id).
drop trigger if exists trg_backup_household_data_update on public.households;
create trigger trg_backup_household_data_update
  after update on public.households
  for each row
  when (new.data is distinct from old.data)
  execute function public.backup_household_data();

alter table public.household_backups enable row level security;
-- No client-facing SELECT/INSERT/UPDATE/DELETE policies yet — this task has
-- no restore UI, so nothing in the app needs client access to this table.
-- The trigger function runs as SECURITY DEFINER, so it writes regardless of
-- RLS on the calling client's role. Add a household-members-only SELECT
-- policy later if/when a restore feature gets built; until then this table
-- is service-role/direct-DB access only, which is intentional.

-- Verification queries (run after applying) -------------------------------
-- select tgname, tgrelid::regclass from pg_trigger
--   where tgrelid = 'public.households'::regclass and not tgisinternal;
--   -- expect trg_backup_household_data_insert and _update present.
-- select household_id, count(*) from public.household_backups group by household_id;
--   -- expect counts capped at 5 per household after a few writes.
