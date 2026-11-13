-- ============================================================
-- tide_pool_events: append-only shell ledger per kid.
--
-- NOT YET RUN. Paste into Supabase dashboard -> SQL Editor.
-- Safe to re-run (idempotent: IF NOT EXISTS / DROP ... IF EXISTS /
-- ON CONFLICT DO NOTHING).
--
-- Schema it relies on:
--   households(id text, owner_id uuid, data jsonb, updated_at, updated_by)
--   household_members(household_id text, user_id uuid, role text)
--
-- Source of current shell counts (verified in src/App.jsx):
--   households.data->'coveData'  -- the SYNC_KEYS key (src/sync-core.js).
--   There is no "tidepoolChildren" key anywhere in SYNC_KEYS; the only
--   mention is a comment at src/App.jsx:2759 saying it is NOT a real key.
--   coveData shape: JSON array, one record per kid:
--     [{ kidId: text, kidName: text, shells: number,
--        chores: [{id,name,pts,done}], treasures: [{id,name,icon,cost}],
--        shellLog: [...], bonusHistory: [...], rewardHistory: [...],
--        choreLastReset: "YYYY-MM-DD" }, ...]
--   Written by TidePoolTab.updateKid() and TidePoolSection.updateSaved(),
--   both via setCoveData -> useSaved("coveData") -> merge_household_data.
-- ============================================================

begin;

-- 1. Table ----------------------------------------------------
create table if not exists public.tide_pool_events (
  id            text primary key,
  household_id  text not null references public.households(id) on delete cascade,
  kid_id        text not null,
  kind          text not null check (kind in ('chore','chore_undo','bonus','redeem','adjust','backfill')),
  delta         integer not null check (delta <> 0 or kind = 'backfill'),
  reason        text,
  ref_id        text,                       -- chore id / treasure id / bonus entry id
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);

create index if not exists tide_pool_events_household_kid_idx
  on public.tide_pool_events (household_id, kid_id, created_at desc);

-- 2. RLS: household members only ------------------------------
alter table public.tide_pool_events enable row level security;

drop policy if exists "tpe_select_members" on public.tide_pool_events;
create policy "tpe_select_members"
  on public.tide_pool_events
  for select
  using (exists (
    select 1 from public.household_members hm
    where hm.household_id = tide_pool_events.household_id
      and hm.user_id = auth.uid()
  ));

drop policy if exists "tpe_insert_members" on public.tide_pool_events;
create policy "tpe_insert_members"
  on public.tide_pool_events
  for insert
  with check (
    kind <> 'backfill'
    and created_by = auth.uid()
    and exists (
      select 1 from public.household_members hm
      where hm.household_id = tide_pool_events.household_id
        and hm.user_id = auth.uid()
    )
  );

-- Ledger is append-only: no UPDATE policy. DELETE: household owner only.
drop policy if exists "tpe_delete_owner" on public.tide_pool_events;
create policy "tpe_delete_owner"
  on public.tide_pool_events
  for delete
  using (exists (
    select 1 from public.households h
    where h.id = tide_pool_events.household_id
      and h.owner_id = auth.uid()
  ));

-- 3. RPC: add event (membership-checked, idempotent on id) ----
create or replace function public.tide_pool_add_event(
  p_id           text,
  p_household_id text,
  p_kid_id       text,
  p_kind         text,
  p_delta        integer,
  p_reason       text default null,
  p_ref_id       text default null
)
returns setof public.tide_pool_events
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from household_members
    where household_id = p_household_id and user_id = auth.uid()
  ) then
    raise exception 'not a member of this household';
  end if;

  if p_kind = 'backfill' then
    raise exception 'backfill events cannot be added via RPC';
  end if;

  return query
    insert into tide_pool_events (id, household_id, kid_id, kind, delta, reason, ref_id, created_by)
    values (p_id, p_household_id, p_kid_id, p_kind, p_delta,
            nullif(p_reason, ''), nullif(p_ref_id, ''), auth.uid())
    on conflict (id) do nothing
    returning *;
end;
$$;

revoke all on function public.tide_pool_add_event(text,text,text,text,integer,text,text) from public, anon;
grant execute on function public.tide_pool_add_event(text,text,text,text,integer,text,text) to authenticated;

-- Convenience: current balance per kid (respects caller's RLS)
create or replace view public.tide_pool_balances
with (security_invoker = true) as
  select household_id, kid_id, sum(delta)::integer as shells
  from public.tide_pool_events
  group by household_id, kid_id;

-- 4. Realtime -------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tide_pool_events'
  ) then
    alter publication supabase_realtime add table public.tide_pool_events;
  end if;
end $$;

-- 5. One-time backfill from households.data->'coveData' -------
-- One 'backfill' row per kid = that kid's current coveData[].shells.
-- Deterministic id makes this a no-op on re-run.
-- Skips: non-array coveData, records with no kidId, the phantom
-- placeholder kid {kidId:"k1", kidName:"Child"/"Child 1"} (see
-- src/App.jsx ~4454 cleanup), and kids with 0 or non-numeric shells.
insert into public.tide_pool_events (id, household_id, kid_id, kind, delta, reason, created_by, created_at)
select
  'backfill:' || h.id || ':' || (kid->>'kidId'),
  h.id,
  kid->>'kidId',
  'backfill',
  floor((kid->>'shells')::numeric)::integer,
  'Opening balance from coveData',
  null,
  now()
from public.households h
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(h.data->'coveData') = 'array'
       then h.data->'coveData' else '[]'::jsonb end
) as kid
where jsonb_typeof(kid) = 'object'
  and coalesce(kid->>'kidId', '') <> ''
  and not (kid->>'kidId' = 'k1' and kid->>'kidName' in ('Child', 'Child 1'))
  and jsonb_typeof(kid->'shells') = 'number'
  and (kid->>'shells')::numeric >= 1
on conflict (id) do nothing;

commit;

-- ============================================================
-- Verify (run separately AFTER the block above). Should return
-- zero rows (phantom k1 excluded, same as the backfill):
-- ============================================================
-- select h.id as household_id,
--        kid->>'kidId'   as kid_id,
--        kid->>'kidName' as kid_name,
--        kid->'shells'   as cove_shells,
--        coalesce(b.shells, 0) as ledger_shells
-- from public.households h
-- cross join lateral jsonb_array_elements(
--   case when jsonb_typeof(h.data->'coveData') = 'array'
--        then h.data->'coveData' else '[]'::jsonb end) kid
-- left join (
--   select household_id, kid_id, sum(delta)::int as shells
--   from public.tide_pool_events group by 1, 2
-- ) b on b.household_id = h.id and b.kid_id = kid->>'kidId'
-- where not (kid->>'kidId' = 'k1' and kid->>'kidName' in ('Child','Child 1'))
--   and coalesce(floor((kid->>'shells')::numeric)::int, 0) <> coalesce(b.shells, 0);
