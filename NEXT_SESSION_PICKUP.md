# Anchor & Flow — Next Session Pickup

## Current state (as of 2026-06-26)

### ✅ CONFIRMED DONE — infrastructure
- `household_members` table + RLS (hm_select, hm_insert). 3 rows backfilled.
- `households_member_access` RLS — members only, `allow_all_authenticated` dropped.
- `join_household(p_code)` SECURITY DEFINER RPC — joiner can find+join without
  being a member first. joinHousehold calls this RPC. Blocking INSERT; af_householdId
  written only after success.
- `exhale_cards` table + `exhale_cards_member` RLS (all ops, household_id in
  household_members for auth.uid()). 15 columns: id(text PK), household_id, text,
  notes, color, category, emoji, due_date(date), assigned_to, position(double),
  created_at, updated_at, deleted_at, created_by, updated_by. Index on
  (household_id, category, position) WHERE deleted_at IS NULL.

### ✅ CONFIRMED DONE — Phase 2a Deploy 1 (commit 45a7baa, bundle index-BJtPCN4b.js)
All four changes are in `src/components/ExhaleSection.jsx`, behind `af_exhale_v2` flag:

1. **UUID card IDs** — V2 ON: `crypto.randomUUID()`. V2 OFF: `"e"+counter` unchanged.
2. **First-run migration** — reads local blob, upserts to exhale_cards with
   `ON CONFLICT id DO NOTHING`. Flag: `af_exhale_migrated_<householdId>` per device.
3. **ADD sync + Realtime** — V2 handleAdd: raw localStorage write + exhale_cards
   INSERT. Realtime subscription on INSERT WHERE household_id=eq.<hhId> applies to
   state in-place with dedup. Save states: saving → saved | failed.
4. **persist() dual-write fix** — V2 branch does raw localStorage.setItem only;
   no lsSet, no dirty key, no blob push for any of the 9 non-add operations.

---

## NEXT TASK: Test matrix for Deploy 1

**How to enable the flag:**
In browser console on anchorandflowapp.com (signed in):
```javascript
localStorage.setItem("af_exhale_v2", "true"); location.reload();
```

**To disable:**
```javascript
localStorage.removeItem("af_exhale_v2"); location.reload();
```

### Test matrix (walk through in order)

#### T1 — Migration (single device)
1. Enable flag on Device A (Lindsey's account, household hh_o7yzu28).
2. Check console for `[AF] Exhale migration done: N card(s) contributed.`
3. Verify in Supabase: `SELECT id, text, category FROM exhale_cards WHERE household_id = 'hh_o7yzu28';`
   — rows should appear matching localStorage cards.
4. Reload: console should NOT show migration again (flag `af_exhale_migrated_hh_o7yzu28`
   is set in localStorage).

#### T2 — ADD syncs to DB (single device)
1. With flag ON, add a card with a unique name e.g. "T2-test-card-XYZ".
2. Card appears optimistically in UI with "saving…" indicator.
3. "saving…" disappears (no "⚠ not saved" shown) → row confirmed.
4. Verify in Supabase: `SELECT id, text FROM exhale_cards WHERE text = 'T2-test-card-XYZ';`
   — exactly 1 row.
5. Check that NO blob push fired: in console, no AF_TRACE `PUSH_STARTED` after the add
   (or enable `window.AF_TRACE = true` first to confirm push is silent).

#### T3 — Realtime: A adds, B sees without reload
1. Open two browser windows (can be same account, different tabs, or two accounts
   in the same household).
2. Both have flag ON.
3. Window A adds a card.
4. Window B should see the card appear within ~1–2 seconds WITHOUT any page reload.
5. No duplicate card in Window B.

#### T4 — Deduplication (own echo)
1. On a single device with flag ON, add a card.
2. Card should appear exactly once in the UI.
3. The Realtime echo of your own INSERT must not create a second copy.
   (Watch: if count jumps by 2, dedup failed.)

#### T5 — V2=OFF regression (blob path unchanged)
1. Disable flag: `localStorage.removeItem("af_exhale_v2"); location.reload();`
2. Add a card. Verify it saves normally (blob push fires, card persists on reload).
3. No console errors. All existing Exhale functionality intact.

#### T6 — Failure state (network drop)
1. Flag ON. Open DevTools → Network tab → set to Offline.
2. Add a card.
3. Card appears optimistically; "⚠ not saved" indicator shows.
4. Re-enable network — the "⚠ not saved" stays (no auto-retry in Deploy 1; that's
   expected). User knows the card is local-only.

#### T7 — V2 card survives a legacy blob save
1. Flag ON on Device A. Add a card (V2 row written).
2. On Device B with flag OFF (or before flag was set), make any other change that
   triggers a blob push (e.g. add a non-Exhale item).
3. Reload Device A. The V2 card must still be present (it comes from exhale_cards
   query or local cache, not from the blob).
   NOTE: In Deploy 1, V2 still has exhale_groups in the blob (Deploy 2 removes it),
   so Device A's blob may overwrite Device B's blob — this is the known clobbering
   issue, not a V2 regression. What must NOT happen: the V2 row disappearing.

#### T8 — Migration idempotency (second device)
1. Enable flag on Device B (same household).
2. Console: migration runs, upserts Device B's local cards.
3. Verify Supabase: no duplicate rows (ON CONFLICT DO NOTHING prevents them).
4. Device A's rows still intact.

---

## What's deferred (intentionally, do not implement yet)

| Item | Reason | Phase |
|---|---|---|
| Edits/deletes/moves → row writes | Phase 2b scope | 2b |
| position: fractional (1.5, etc.) | Phase 2b; 0 accepted for now | 2b |
| Deploy 2 (remove exhale_groups from blob PATCH) | BLOCKED on test matrix above | 2 |
| exhale_labels missing from SYNC_KEYS | Legacy; non-urgent | later |
| Timestamp Z vs +00:00 mismatch | Legacy; mitigated | later |
| af-data-changed stale closure on [] deps | Legacy | later |
| Clear af_* on sign-out/sign-up | Cosmetic; server blocks real access | later |

---

## Deploy 2 gate

Deploy 2 removes `exhale_groups` from the PATCH payload when V2 is ON, making exhale_cards
the single write authority. **Must NOT ship until T1–T8 all pass.** Premature blob exclusion
before Realtime is verified would make cards invisible to V2=OFF devices permanently.

---

## ROLLBACK (if V2 causes problems)
```javascript
// Disable flag on any device:
localStorage.removeItem("af_exhale_v2"); location.reload();
```
No server-side rollback needed for Deploy 1 — exhale_cards rows are additive,
blob path is untouched.

---

## Known minor cleanup (non-urgent)
- joinHousehold's PUT /auth/v1/user (user_metadata write) 401s — best-effort,
  non-blocking, now redundant since RPC does the real work.
- af_* not cleared on sign-out (cosmetic; server already blocks real access).
