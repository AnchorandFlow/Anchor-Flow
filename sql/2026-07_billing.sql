-- sql/2026-07_billing.sql
-- ============================================================================
-- ⚠️  GATED — DO NOT RUN WITHOUT EXPLICIT APPROVAL.
-- This is a DB schema + RLS POLICY change. Per session rules, no DB policy change
-- ships without sign-off. Run in the Supabase SQL editor against the SANDBOX/test
-- project first, verify, THEN decide on production.
-- Take a schema snapshot / backup before running.
-- ============================================================================

-- 1) Idempotency + audit log for Stripe webhooks -----------------------------
create table if not exists public.stripe_events (
  id           text primary key,          -- Stripe event.id (evt_...)
  type         text not null,
  status       text not null default 'processing',  -- processing | completed | failed
  error        text,
  created_at   timestamptz not null default now()
);

-- RLS: deny-all to clients. Only the service role (webhook) touches this table.
alter table public.stripe_events enable row level security;
-- (No policies = deny-all for anon/authenticated. Service role bypasses RLS.)

-- 2) subscriptions: make sure the columns the webhook writes exist -----------
-- Per backlog §7 the table already has user_id, household_id, stripe_customer_id,
-- stripe_subscription_id, status, plan, current_period_end. These ADDs are idempotent
-- safety nets; verify the live schema and drop any that already exist.
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;
alter table public.subscriptions
  add column if not exists updated_at timestamptz not null default now();

-- Upsert target for the webhook (onConflict: 'stripe_subscription_id').
create unique index if not exists subscriptions_stripe_sub_id_key
  on public.subscriptions (stripe_subscription_id);

-- Fast household lookups for entitlement.
create index if not exists subscriptions_household_id_idx
  on public.subscriptions (household_id);

-- 3) RLS: let household MEMBERS read (only) their household's subscription row.
--    Writes remain service-role-only (webhook). This is what makes the flag
--    server-derived: the client can read the truth but can never forge it.
alter table public.subscriptions enable row level security;

-- Guard the CREATE so re-running doesn't error.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'members_can_read_household_subscription'
  ) then
    create policy members_can_read_household_subscription
      on public.subscriptions
      for select
      to authenticated
      using (
        household_id in (
          select hm.household_id
          from public.household_members hm
          where hm.user_id = auth.uid()
        )
        or
        household_id in (
          select h.id
          from public.households h
          where h.owner_id = auth.uid()
        )
      );
  end if;
end
$$;

-- NOTE: intentionally NO insert/update/delete policies for authenticated users on
-- public.subscriptions. Only the service-role webhook writes entitlement.

-- 4) Verification queries (run after applying) -------------------------------
-- select relrowsecurity from pg_class where relname = 'stripe_events';   -- expect true
-- select relrowsecurity from pg_class where relname = 'subscriptions';   -- expect true
-- select policyname, cmd from pg_policies where tablename = 'subscriptions';
--   -- expect exactly one SELECT policy, no INSERT/UPDATE/DELETE for authenticated.
