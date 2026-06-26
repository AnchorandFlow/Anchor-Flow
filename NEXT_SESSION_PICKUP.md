# Anchor & Flow — Next Session Pickup

## Where we left off (CONFIRMED DONE)
- ✅ `household_members` table created + RLS enabled (hm_select, hm_insert policies)
- ✅ Backfilled 3 rows: Lindsey (owner hh_o7yzu28), Twyla (member hh_o7yzu28),
  border.steve (owner hh_7zth4h9)
- ✅ Tightened `households` RLS: dropped `allow_all_authenticated`, added
  `households_member_access` (member-based)
- ✅ VERIFIED LIVE: both Lindsey (owner) and Twyla (member, separate account)
  can load data and save edits. Data-exposure hole closed.

## Still TRUE until Phase 2a ships
- Two-device whole-blob clobbering is NOT fixed yet. ONE DEVICE AT A TIME.
- Push and pull mechanics are proven working (AF_TRACE diagnosis, commit 2570d8b).
- AF_TRACE tracer is still in the code, flag-gated (window.AF_TRACE), harmless.

---

## NEXT STEPS (in order) — none are as risky as the RLS tighten was

### Step 1: Deploy the join-flow code change (so FUTURE joiners get a member row)
The DB is secured, but the app code doesn't yet write a `household_members`
row when someone joins via code. Until it does, any NEW person who joins will
be locked out by the new RLS. The fix was already designed:

In `joinHousehold` (App.jsx ~line 2302):
- Add guard: if `!authUser?.id || authUser.id === "unknown"` → return visible
  error, do not join.
- Make the `household_members` INSERT BLOCKING (no inner try/catch — let it
  propagate to the outer catch so failure shows the user an error and does NOT
  report a false "joined").
- Move `localStorage.setItem("af_householdId", ...)` to AFTER the INSERT
  succeeds (currently it writes before network calls, leaving stale joined-state
  on failure).
- Keep the user_metadata write as best-effort (non-blocking, inner try/catch ok).

Also in `pushHouseholdData` POST/INSERT branch (App.jsx ~line 2248), after a
household is first created, INSERT an `household_members` owner row for the
creator (so new single-user accounts are self-sufficient — no backfill needed).

Then: `./deploy.sh "join flow writes household_members row (blocking + guard)"`
and confirm the live hash changed via curl.

### Step 2: Create the exhale_cards table
Per-card rows, member-based RLS (same shape as households_member_access).
Schema + RLS already drafted in SYNC_SESSION_SUMMARY.md / earlier design.
REMEMBER THE CORRECTIONS:
- cardId must be globally unique (crypto.randomUUID or device-prefixed) — the
  old "e"+counter collides across devices and would let ON CONFLICT DO NOTHING
  silently drop a real card.
- exhale_groups must be EXCLUDED from the legacy blob push when the V2 flag is
  on (single write authority — no parallel blob writes).

### Step 3: Build Phase 2a — Exhale per-card sync (THE clobbering fix)
- Card ADD only to start.
- INSERT exhale_cards row (globally-unique id, ON CONFLICT DO NOTHING).
- Subscribe to Supabase Realtime INSERT events, apply in-place to React state
  (NO window.location.reload()).
- Strict save states: saving → saved (only after confirmed Supabase response)
  → pending/failed with retry. A localStorage write is NOT "saved."
- Keep everything else on the blob path; legacy Exhale data read-only for
  rollback.

### Step 4 (later, Phase 2b): edits, deletes, reorder as row-level ops
- Use FRACTIONAL positions (1.5 between 1 and 2), not integer — integer
  reorder clobbers neighbors under concurrency.

---

---

## Where we left off (CONFIRMED DONE)
- ✅ `household_members` table created + RLS enabled (hm_select, hm_insert policies)
- ✅ Backfilled 3 rows: Lindsey (owner hh_o7yzu28), Twyla (member hh_o7yzu28),
  border.steve (owner hh_7zth4h9)
- ✅ Tightened `households` RLS: dropped `allow_all_authenticated`, added
  `households_member_access` (member-based)
- ✅ VERIFIED LIVE: both Lindsey (owner) and Twyla (member, separate account)
  can load data and save edits. Data-exposure hole closed.
- ✅ BUG 0 FIXED + VERIFIED: join_household(p_code) SECURITY DEFINER RPC created.
  joinHousehold now calls the RPC instead of the RLS-blocked GET. Test account
  "Sally" (6ff39c4b-cd7f-44f0-a498-8e41be3c1d84) joined hh_o7yzu28 successfully
  — 4th household_members row written, Sally can read shared data. Join flow
  works on the locked-down DB. (Live build index-gIUUw-Cu.js or later.)
- ✅ exhale_cards TABLE CREATED + member RLS (exhale_cards_member, FOR ALL).
  15 columns: id(text PK), household_id, text, notes, color, category, emoji,
  due_date, assigned_to, position(double precision — for fractional reorder),
  created_at, updated_at, deleted_at(soft delete), created_by, updated_by.
  Index on (household_id, category, position) WHERE deleted_at IS NULL.
  NO client code written yet. Table is empty (server blob exhale_groups was
  null — cards live only in localStorage and will populate from there when the
  client code lands).

## Known minor cleanup (non-urgent)
- joinHousehold's PUT /auth/v1/user (user_metadata write) 401s but is wrapped
  best-effort and does not block the join (RPC does the real work). Either fix
  or remove it — it's now redundant.
- Clear af_* on sign-out/sign-up (stale-state cosmetic leak; server already
  blocks real access).

## NEXT SESSION TASK: client-side Exhale per-card sync (Phase 2a)
The table + RLS foundation is DONE. Next is the client rewrite — do this FRESH,
not tired. Steps:
1. Card IDs: switch from "e"+counter to crypto.randomUUID() (globally unique —
   the old scheme collides across devices and breaks ON CONFLICT idempotency).
2. On Exhale ADD: INSERT a row into exhale_cards (id, household_id, text, color,
   category, etc., created_by = auth.uid()) with a confirmed Supabase response
   before showing "saved." Strict states: saving → saved(confirmed) →
   pending/failed(retry). A localStorage write is NOT "saved."
3. First-run migration: when V2 flag on and exhale_cards empty for this
   household, read the LOCAL blob cards (from localStorage af_exhale_groups) and
   INSERT them as rows (ON CONFLICT DO NOTHING). This is how existing cards move
   from device to server.
4. Subscribe to Supabase Realtime on exhale_cards filtered by household_id;
   apply INSERT/UPDATE/DELETE to React state IN PLACE — NO window.location.reload.
   Dedupe on card id (processing the same Realtime event twice must not dup).
5. SINGLE WRITE AUTHORITY: when V2 flag on, EXCLUDE exhale_groups from the legacy
   blob push so the two paths never fight. Legacy blob stays read-only fallback.
6. Build behind a feature flag; keep blob path authoritative until the test
   matrix passes.
Test matrix: A adds→B sees; B adds within seconds→neither lost; both edit
different cards; network drop→explicit failed/pending; reload preserves both;
expired auth doesn't silently discard; Realtime reconnects after token refresh;
NO whole-page reload on Exhale update; + V2 card survives a legacy-section blob
save; + duplicate Realtime event doesn't duplicate a card.

---

## (historical) NEW BUGS FOUND (2026-06-25 night) — client-side, NOT security holes

### ⚠️ BUG 0 (TOP PRIORITY): New RLS broke the join-by-code flow
VERIFIED: a fresh account (Sally, clean Incognito, own email) signed up, started
correctly with NO household, then entered the real code hh_o7yzu28 and clicked
Join → got "Household not found. Check the code and try again."

Root cause: joinHousehold's FIRST step is GET /households?id=eq.<code> to verify
the household exists. But today's tightened RLS (households_member_access) only
lets MEMBERS read a household. A joiner is not a member yet, so the read returns
empty → code interprets empty as "not found." Chicken-and-egg: you must read the
household to join, but you can't read it until you're a member.

This means NO new member can currently join any household. Must fix before any
real second user onboards.

FIX (next session, fresh — do not code tired):
- Preferred: a SECURITY DEFINER Postgres RPC (e.g. join_household(p_code)) that
  (a) checks the household exists, (b) inserts the caller's household_members
  row, (c) returns success — all with elevated rights, so households stays
  locked to members only. joinHousehold calls this RPC instead of GET+POST.
- Alternative (looser): a narrow RLS policy letting any authenticated user read
  minimal household existence by id — riskier, can re-expose data, less clean.
- After fix: re-run the Sally join test → should join, get a household_members
  row, and then load/save as a member.

Note: the blocking-INSERT join code shipped today (commit on Cr1hbm2p) never gets
to run because the GET fails first. The fix moves household verification + member
insert into the RPC.



RLS verified working: a non-member account (laborder16@mac.com, user
f26a6862-cb54-45d9-915c-d2c6f50ee185) got POST /households 403 "new row
violates row-level security policy." It is NOT in household_members (table has
only the 3 backfilled rows). Data is secure. But two client bugs surfaced:

### Bug 1: af_* state not cleared between auth sessions
A new account created in a window that previously had a Lindsey session
INHERITED the old localStorage: af_householdId = hh_o7yzu28 AND
af_authUser.displayName = "Lindsey". So the new account's UI showed it was in
hh_o7yzu28 (false — server 403s every write).
FIX: on sign-out AND on fresh sign-up, clear all af_* keys (af_householdId,
af_authUser, and all SYNC_KEYS data) so a new account starts blank.

### Bug 2: sync UI trusts localStorage over server truth
The sync modal showed "✓ Synced 9:50:30 PM" and "YOUR HOUSEHOLD CODE
hh_o7yzu28" while every actual push was returning 403. The UI reflects local
state, not server responses.
FIX: sync status must reflect real server responses. "Synced/saved" should only
show after a confirmed successful response — never from a localStorage write
alone. (Same principle as the strict save-states work already planned.)

Root cause (recurring theme): the app treats localStorage as truth when the
server is truth. Clearing state on auth changes + honest server-driven status
closes this class of bug.

### Clean join-test procedure (do this to actually verify the join flow)
The tests so far were muddied by stale state and a localhost dev server. To
verify properly:
1. Truly fresh browser state — new Incognito window with NOTHING previously
   signed in, OR clear all site data first. (Inheriting old af_* state is what
   broke the last test.)
2. Go to the LIVE site (anchorandflowapp.com), not localhost:5173.
3. Sign up a genuinely new throwaway account (e.g. an email alias you control).
4. Use the JOIN-BY-CODE flow: paste hh_o7yzu28 into "Join a household."
5. Watch for a clean join (no error). The new blocking INSERT should either
   succeed or show a visible error — never a false "joined."
6. Verify in Supabase: SELECT * FROM household_members — a 4th row should appear
   for the new user, role=member, household hh_o7yzu28.
7. Confirm the new account can load + save (passes RLS as a real member).
8. Cleanup: DELETE FROM household_members WHERE user_id = '<new-user-id>';

---

## ROLLBACK (if the RLS ever causes a lockout)
```sql
CREATE POLICY allow_all_authenticated ON households
  FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);
```
Restores full access instantly. Table + backfill stay intact.

---

## Opening line for next Claude Code session
"Continuing Anchor & Flow multi-user work. RLS is secured and verified (Lindsey
+ Twyla both confirmed working on separate accounts). Read SYNC_SESSION_SUMMARY.md
and NEXT_SESSION_PICKUP.md. Start with Step 1: deploy the join-flow code change
that writes a household_members row (blocking INSERT + auth guard + move
af_householdId after success). Show me the diff before applying."
```
