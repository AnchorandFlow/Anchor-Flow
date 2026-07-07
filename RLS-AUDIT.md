# RLS Audit Kit — Anchor & Flow

**Purpose:** Copy-paste SQL queries, expected policy baseline, gap-analysis checklist,
and exact human steps for auditing Row Level Security on the Anchor & Flow Supabase project.

**Scope:** Read-only audit only. No policy changes, no data changes, no credentials touched.
Run queries as the Supabase service role in the SQL editor — they only read pg_catalog views.

---

## Tables used by the app (derived from App.jsx source)

| Table | Operations observed in source |
|-------|-------------------------------|
| `households` | SELECT (by id, by owner_id), INSERT, PATCH |
| `household_members` | SELECT (by user_id, by household_id), INSERT |
| `push_subscriptions` | INSERT / UPSERT |
| `shopping_list_items` | RPC only (see RPCs below) |

### RPCs called

| RPC | Caller | Purpose |
|-----|--------|---------|
| `join_household(p_code)` | `joinHousehold()` | Validates household code, writes member row, returns household_id |
| `get_pending_notifications()` | push SW handler | Fetches undelivered push payloads for the calling user |
| `action_notification(...)` | push SW handler | Marks a notification delivered/actioned |
| `shopping_add_item(...)` | ShoppingTab | Inserts a shopping item for the household |
| `shopping_toggle_item(...)` | ShoppingTab | Toggles done state on a shopping item |
| `shopping_delete_item(...)` | ShoppingTab | Soft-deletes a shopping item |
| `shopping_update_item(...)` | ShoppingTab | Updates text/store/category of a shopping item |

---

## Step 1 — List all tables and their RLS status

Run in Supabase SQL Editor (service role required):

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  forcerowsecurity AS rls_forced
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected:** Every app-facing table has `rls_enabled = true`.
Flag any table where `rls_enabled = false` — it is world-readable/writable by any authenticated user.

---

## Step 2 — List all active RLS policies

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,   -- PERMISSIVE = union of matching policies; RESTRICTIVE = intersection
  roles,
  cmd,          -- SELECT | INSERT | UPDATE | DELETE | ALL
  qual,         -- USING clause (row filter on read / delete)
  with_check    -- WITH CHECK clause (row filter on write)
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;
```

---

## Expected policy baseline

### `households`

| Policy name (suggested) | Command | USING | WITH CHECK |
|-------------------------|---------|-------|------------|
| `households_owner_select` | SELECT | `owner_id = auth.uid()` | — |
| `households_member_select` | SELECT | `id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())` | — |
| `households_owner_insert` | INSERT | — | `owner_id = auth.uid()` |
| `households_owner_update` | UPDATE | `owner_id = auth.uid() OR id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())` | same |
| `households_owner_delete` | DELETE | `owner_id = auth.uid()` | — |

**Critical:** A joined member must be able to SELECT and UPDATE (push their edits) but must never be able to change `owner_id`. If the UPDATE policy is too broad, any member could hijack ownership.

### `household_members`

| Policy name (suggested) | Command | USING | WITH CHECK |
|-------------------------|---------|-------|------------|
| `hm_member_select` | SELECT | `user_id = auth.uid() OR household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())` | — |
| `hm_insert_self` | INSERT | — | `user_id = auth.uid()` |
| `hm_owner_insert` | INSERT | — | `household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())` |
| `hm_owner_delete` | DELETE | `household_id IN (SELECT id FROM households WHERE owner_id = auth.uid())` | — |

**Critical:** A member must never be able to insert rows with an arbitrary `user_id`. The INSERT WITH CHECK must pin `user_id = auth.uid()` (or go through the `join_household` RPC which does this server-side).

### `push_subscriptions`

| Policy name (suggested) | Command | USING | WITH CHECK |
|-------------------------|---------|-------|------------|
| `ps_user_select` | SELECT | `user_id = auth.uid()` | — |
| `ps_user_upsert` | INSERT | — | `user_id = auth.uid()` |
| `ps_user_update` | UPDATE | `user_id = auth.uid()` | `user_id = auth.uid()` |
| `ps_user_delete` | DELETE | `user_id = auth.uid()` | — |

### RPCs (SECURITY DEFINER vs INVOKER)

RPCs should be `SECURITY DEFINER` only if they need to bypass RLS for a controlled
operation (e.g. `join_household` writes a member row for the calling user without
needing a pre-existing membership). Every other RPC should be `SECURITY INVOKER`
so the caller's RLS applies.

Run:
```sql
SELECT
  routine_name,
  security_type   -- 'DEFINER' or 'INVOKER'
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

**Expected:** `join_household` = DEFINER (it needs to write without a membership row).
All shopping RPCs = INVOKER (caller's RLS gates what they can touch).

---

## Step 3 — Gap-analysis checklist

Work through each row in the pg_policies output and check:

- [ ] **households SELECT** — does it allow both owner AND member reads?
      If only owner can read, joined members can't pull updates.
- [ ] **households UPDATE** — does it allow member writes?
      If only owner can write, members' edits are rejected silently.
- [ ] **households UPDATE WITH CHECK** — does it prevent changing `owner_id`?
      Should include `owner_id = (SELECT owner_id FROM households WHERE id = households.id)`
      or leave owner_id out of the writable column set.
- [ ] **household_members INSERT** — is `user_id` pinned to `auth.uid()` in WITH CHECK?
      Without this, any authenticated user can add arbitrary member rows.
- [ ] **household_members SELECT** — can an owner see all members of their household?
      Needed for a future "members" management UI.
- [ ] **push_subscriptions** — is every policy scoped to `user_id = auth.uid()`?
      Leakage here exposes push tokens.
- [ ] **shopping_list_items** — does each policy scope to the calling user's household?
      Users in different households must never see each other's items.
- [ ] **join_household RPC** — is it SECURITY DEFINER? Does it verify the household
      code exists before writing the member row? (Prevents code enumeration attacks.)
- [ ] **No table has RLS disabled** — verify Step 1 shows `rls_enabled = true` for all tables.
- [ ] **No policy has `roles = {}`** — empty roles means the policy applies to all roles
      including `anon`. Confirm anon access is intentional (it should not be for any
      of these tables).

---

## Step 4 — Verify join_household RPC body

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'join_household'
  AND pronamespace = 'public'::regnamespace;
```

Review the body for:
- [ ] Validates `p_code` matches an existing `households.id` before inserting
- [ ] Inserts `household_members` row with `user_id = auth.uid()` (not a parameter)
- [ ] Returns `household_id` only if insert succeeds
- [ ] Does NOT expose `owner_id` or other users' member rows in the return value

---

## Step 5 — Test cross-household isolation (manual, staging only)

1. Sign in as User A. Note their `household_id`.
2. Sign in as User B (separate account, separate household).
3. In the Supabase SQL editor (as service role), note User B's `user_id`.
4. From User B's auth token, attempt:
   ```
   GET /rest/v1/households?id=eq.<User_A_household_id>
   ```
   **Expected:** empty array (RLS blocks it). If you get data, the SELECT policy is too broad.
5. From User B's auth token, attempt a PATCH to User A's household.
   **Expected:** 0 rows affected (RLS blocks it). If you get a 200 with rows, the UPDATE policy is missing or too broad.

---

## Rollback plan

This is a read-only audit. No changes are made. If a gap is found:
1. Document the gap in KNOWN_ISSUES.md.
2. Write the corrective policy SQL in a new file `rls-fixes.sql` — do NOT apply it without a staging test.
3. Test on a staging project first (restore a snapshot, apply, re-run Step 5).
4. Apply to production in a maintenance window with a sign-in moratorium (no active sessions).

---

## Unresolved risks

- `shopping_list_items` table: the app uses RPCs for all shopping mutations but the underlying table's RLS is not verified here. If the table has a permissive SELECT policy, any household member could read another household's items directly via REST.
- The `join_household` RPC body is not auditable without service-role SQL access. Priority is to review it before shipping the "shared emergency plan" marketing claim.
- There is no audit log of policy changes. If you apply fixes, note the git commit and Supabase project dashboard timestamp in KNOWN_ISSUES.md.
