-- ============================================================
-- ACCT-1: member list for the household owner's "Remove member" UI.
--
-- NOT YET RUN. Run this manually in the Supabase dashboard -> SQL
-- Editor. Matches the convention in
-- sql/rls-household-owner-only-2026-07.sql (no local migration
-- files in this repo; sql/production-functions-2026-07.sql is a
-- dump of existing RPCs, not something applied automatically).
--
-- Why an RPC is needed (verified against live RLS via
-- `supabase db query` on 2026-08-02):
--   hm_select policy on household_members is `user_id = auth.uid()`
--   -- every member, including the owner, can only SELECT their
--   own row over plain REST. There is no way to list a household's
--   other members from the client without this.
--
--   Leaving and removal do NOT need an RPC -- they already work
--   over plain REST because these policies already exist:
--     hm_delete_self:    delete where user_id = auth.uid()      (self-leave)
--     hm_delete_by_owner: delete where households.owner_id = auth.uid() (owner removes anyone)
--   The app calls these directly via sbFetch DELETE, not through this file.
--
-- Schema: household_members(household_id text, user_id uuid, role text, joined_at timestamptz)
-- household_members has no name/email column, so this joins to
-- auth.users for email -- safe under SECURITY DEFINER since it only
-- ever returns rows for the household the caller is themselves a
-- member of (enforced inside the function body, not by RLS).
-- ============================================================

create or replace function public.list_household_members(p_household_id text)
returns table(user_id uuid, role text, email text, joined_at timestamptz)
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

  return query
    select hm.user_id, hm.role, u.email::text, hm.joined_at
    from household_members hm
    join auth.users u on u.id = hm.user_id
    where hm.household_id = p_household_id
    order by hm.role = 'owner' desc, hm.joined_at asc;
end;
$$;
