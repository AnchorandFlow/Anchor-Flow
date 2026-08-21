-- ============================================================
-- ⚠️  GATED — DO NOT RUN WITHOUT EXPLICIT APPROVAL.
-- This is a DB RLS POLICY change. Per this project's own rule (see
-- sql/2026-07_billing.sql), no DB policy change ships without sign-off.
-- Verify against the actual current policies on the SANDBOX/test project
-- first (this project has no tracked migration history — see
-- sql/rls-household-owner-only-2026-07.sql's own header — so the current
-- policy set on these two tables is not fully known from this repo alone).
-- ============================================================
--
-- Discovered live, 2026-08-20: a brand-new authenticated user cannot create
-- their own household row. INSERT into public.households as the intended
-- owner (auth.uid() = owner_id) fails with:
--   42501 "new row violates row-level security policy for table households"
-- This blocks BOTH the new auto-provision-on-login flow (batch 3) AND the
-- pre-existing manual "Generate"/"Sync" button in Settings → Household
-- (pushHouseholdData's own INSERT branch, src/App.jsx ~line 3221) — the
-- manual path was very likely equally broken already, just never verified
-- end-to-end against a genuinely fresh account before now.
--
-- household_members is untested here (the households insert fails first,
-- so provisionHousehold never reaches its own-membership-row insert), but
-- given the identical "no tracked INSERT policy" situation, it likely needs
-- the same treatment — included below for completeness; verify independently.

alter table public.households enable row level security;
alter table public.household_members enable row level security;

-- 1. A user may create a household they own. No existing policy permits
--    this today (see discovery note above).
drop policy if exists "households_insert_own" on public.households;
create policy "households_insert_own"
  on public.households
  for insert
  with check (auth.uid() = owner_id);

-- 2. A user may insert their OWN membership row (used both by
--    provisionHousehold's owner-membership write and by the existing
--    join-by-code RPC flow's equivalent). Does not grant inserting a
--    membership row for anyone else.
drop policy if exists "household_members_insert_self" on public.household_members;
create policy "household_members_insert_self"
  on public.household_members
  for insert
  with check (auth.uid() = user_id);

-- 3. Verification queries (run after applying) -------------------------------
-- select policyname, cmd from pg_policies where tablename = 'households';
--   -- expect households_insert_own alongside whatever DELETE/UPDATE policies
--   -- already exist (households_delete_owner_only, etc. from the 2026-07 file).
-- select policyname, cmd from pg_policies where tablename = 'household_members';
--   -- expect household_members_insert_self present.
