# FINDINGS — Phase B Test Suite

Suspicious things observed during test implementation. None were touched.
All are potential future work items, not confirmed bugs requiring immediate action.

---

## F1 — sanitizeHouseholdData: defensive pass-through overwrites array guard rejections

**Location:** `src/sync-core.js` `sanitizeHouseholdData()` — defensive pass-through block (last ~5 lines)

**What happens:** The array guard block checks `Array.isArray(data[k])` and skips writing
if the value is not an array (correct). But the defensive pass-through block at the bottom
runs afterward and sees `out[k] === undefined && data[k] !== undefined && data[k] !== null`
— true for `{}`, `"string"`, `42` — and writes the junk value into `out`.

**Concrete example:**
```js
sanitizeHouseholdData({ tasks: {} })
// Expected: out.tasks === undefined
// Actual:   out.tasks === {}
```

**Keys affected:** All keys in the explicit array allowlist that also appear in SYNC_KEYS:
`tasks`, `brainItems`, `shoppingItems`, `notifications`, `calEvents`, `connectedCals`,
`birthdays`, `favMeals`, `mealBankCustom`, `recipes`, `stores`, `shopCategories`,
`brainCats`, `homeSystems`, `dietaryFilters`, `recurring`, `celebrations`, `gifts`,
`inventory`, `pets`, `houseFile`, `cove_lists_v1`, `cove_sections_v1`, `cove_notes_v1`,
`burnoutChecked`, `moments`, `subs`, `vaultSystems`, `packing_templates`.

**Severity:** Medium. A device with corrupted data (e.g. `tasks` serialized as `{}` by
a failed JSON encode) would pull down `{}` into other devices. However, useSaved
hydration would then render empty state, and the next user interaction would
replace it with a valid array — so data loss is bounded to one sync cycle.

**Fix:** In the pass-through block, skip keys that are in the explicit array allowlist
(or add a type check: skip if both the allowlist type is array and the value is not an array).

**Test:** `A4 — non-array in array slot is dropped` — 3 `it.fails` cases guard regression.

---

## F2 — exhaleLabels vs exhale_labels: probable stale write

**Location:** `src/App.jsx` — `useSaved("exhaleLabels", ...)` call

**What happens:** `useSaved("exhaleLabels")` writes to localStorage key `af_exhaleLabels`.
SYNC_KEYS contains `"exhale_labels"` → sync loop reads `af_exhale_labels` (underscore, not camel).
These are different keys. `af_exhaleLabels` is never read by the pull loop; `af_exhale_labels`
is what gets pushed/pulled.

**Likely cause:** Renamed key during Exhale V2 migration (`exhaleLabels` → `exhale_labels`)
but the old `useSaved` call was not updated. The old key is now device-local orphan data.

**Severity:** Low if the old key is no longer used for display. If it is still rendered,
values written by `setExhaleLabels` are not synced. Needs a quick grep to confirm whether
the state value from `useSaved("exhaleLabels")` is rendered anywhere or whether the
component now reads from a different source.

**Fix:** Determine which key is the live source. If `exhale_labels` (sync path), remove
the `useSaved("exhaleLabels")` call and migrate any existing `af_exhaleLabels` data on load.

---

## F3 — checkedPersonalAnchors_: dynamic key, one per day per user

**Location:** `src/App.jsx` line 2981

**What happens:** `useSaved("checkedPersonalAnchors_" + TODAY_NAME + "_" + userId, [])` writes
a new localStorage key every day. Old keys (`af_checkedPersonalAnchors_Monday_user123`,
`af_checkedPersonalAnchors_Tuesday_user123`, ...) accumulate and are never cleaned up.

**Severity:** Low. Each key is ~a few KB at most, and there are only 7 day names × active
users. No immediate risk. But over months with household member changes it will accumulate
orphan keys. A localStorage `getItem` prefix scan for `af_checkedPersonalAnchors_` on mount
could prune old entries.

**Not in SYNC_KEYS:** Intentional — per-day checked state is device-local. Correct.

---

## F4 — collapsedStores: not in SYNC_KEYS (potential cross-device consistency gap)

**Location:** `src/App.jsx` line 2828 — `useSaved("collapsedStores", {})`

**What happens:** Which store sections are expanded/collapsed in the shopping view is
device-local. If a user collapses "Costco" on phone, the desktop still shows it expanded.

**Severity:** Very low UX issue. Not a data-safety concern. Could be promoted to SYNC_KEYS
if cross-device shopping view consistency is desired. Worth noting since it was absent from
the current SYNC_KEYS audit.

---

## F5 — af_lastPushedAt storage format: raw string, not JSON-encoded

**Location:** `src/App.jsx` push success handler (after PATCH/POST succeeds)

**What happens:** `af_lastPushedAt` is stored via `localStorage.setItem("af_lastPushedAt", serverTs)`
(a raw ISO string, NOT `JSON.stringify(serverTs)`). When read back, any code that does
`JSON.parse(localStorage.getItem("af_lastPushedAt"))` will get a string with extra quotes
or parse error depending on whether the raw string starts with `"` or not.

**Current behavior:** All reads use `localStorage.getItem(...)` directly (not JSON.parse),
so this is consistent. But it diverges from the pattern used for almost every other
af_-prefixed key (which are JSON-encoded). A future developer adding a read via lsGet()
(which calls JSON.parse) would silently get a double-parsed result.

**Severity:** Low. Works as designed, but the inconsistency is a footgun. Documented for
future consistency refactors.

---

## F6 — src/sync/syncCore.js (Phase A copy) still exists and will drift

**Location:** `src/sync/syncCore.js`

**What happens:** Phase A created a partial copy of SYNC_KEYS and related logic in
`src/sync/syncCore.js`. Phase B created the authoritative `src/sync-core.js`. The Phase A
file is now a duplicate that will diverge if either copy is edited.

**Severity:** Low now, higher as the project grows. Phase C should delete `src/sync/syncCore.js`
and redirect any imports to `src/sync-core.js`.

---

---

## F7 — EXHALE_V2 persist() skips dirty marking for blob keys (FIXED)

**Location:** `src/components/ExhaleSection.jsx` `persist()` lines 425–430

**What happens:** `EXHALE_V2 = localStorage.getItem("af_exhale_v2") !== "false"` defaults to
`true`. In V2 mode, `persist()` used raw `localStorage.setItem` for ALL four arguments: `ng`
(cards), `nl` (exhale_labels), `ncl` (exhale_color_labels), `np` (exhale_people). Only `ng`
legitimately bypasses the blob path (cards go to the `exhale_cards` realtime table). `nl`,
`ncl`, `np` are in SYNC_KEYS with no realtime table backing — they must push through the blob.
With V2, every label/color/person rename stayed permanently local: `af_dirtyKeys` was never
set, `af-data-changed` was never dispatched, no push was ever triggered.

**Root cause of July 5-6 push-death:** The desktop device could never push Exhale label
renames. Combined with F8 (stale pull destroying the initially dirty state), the device became
permanently unable to push any label changes.

**Fix:** `persist()` in EXHALE_V2 mode now uses `lsSet()` for `nl`, `ncl`, `np` (marks dirty,
dispatches `af-data-changed`, triggers blob push). Only `ng` keeps the raw-write path.

**Status:** Fixed in `stale-push-guard-fix` branch.

---

## F8 — pullLatestHouseholdData destroys dirty keys (FIXED)

**Location:** `src/App.jsx` `pullLatestHouseholdData()` — removed line:
```javascript
try { localStorage.setItem("af_dirtyKeys", "[]"); } catch {} // pulled data overwrites local — nothing left to push
```

**What happens:** When `pushHouseholdData`'s stale guard blocked a push (server newer than
`af_lastHHSync`), it called `pullLatestHouseholdData`, which applied server data then
**unconditionally cleared `af_dirtyKeys`**. Any local edit correctly marked dirty was silently
destroyed. After reload: `af_dirtyKeys=[]`, device cannot push. Permanent if combined with F7.

**Sequence on July 5:**
1. July 3: Desktop synced. `af_lastHHSync = "2026-07-03T21:18:..."`.
2. July 5 18:07: Other device pushed. Server at `"2026-07-05T18:07:02.313"`.
3. Desktop user edited Exhale label → `af_dirtyKeys=["exhale_labels"]` (this was in V1 mode
   at that moment, or via another edit path that did mark dirty).
4. `pushHouseholdData` → stale guard blocked → `pullLatestHouseholdData` → **cleared dirtyKeys** → reload.
5. Post-reload: `af_lastHHSync` current, `af_dirtyKeys=[]`. Edit lost.
6. Subsequent edits: F7 (`EXHALE_V2 persist()`) prevents dirty marking → permanent push-death.

**Fix:** Removed the `af_dirtyKeys` clear. Dirty keys that survive a stale-blocked pull will
push on the next sync cycle — `af_lastHHSync===serverTs` after pull, so the guard passes.

**Hypothesis correction:** The initial hypothesis stated "background pulls never stamp
lastApplied" — incorrect. All three pull paths stamp `af_lastHHSync` (lines 2290, 2373, 2636).
The issue was the dirty-key wipe, not a missing stamp.

**Status:** Fixed in `stale-push-guard-fix` branch.

---

## Summary

| Finding | Severity | Status   | Blocking |
|---------|----------|----------|---------|
| F1 — pass-through overwrites array guard | Medium | Open | No (bounded impact) |
| F2 — exhaleLabels stale write           | Low    | Open | No |
| F3 — dynamic key accumulation           | Low    | Open | No |
| F4 — collapsedStores not synced         | Very Low | Open | No |
| F5 — lastPushedAt raw string vs JSON    | Low    | Open | No |
| F6 — syncCore.js Phase A copy drifting  | Low    | Open | Phase C cleanup |
| F7 — EXHALE_V2 persist() silent labels  | High   | Fixed (stale-push-guard-fix) | Was blocking push |
| F8 — pullLatestHouseholdData wipes dirty | High   | Fixed (stale-push-guard-fix) | Was destroying edits |

F7 and F8 combined caused the July 5-6 permanent push-death on the desktop device.
