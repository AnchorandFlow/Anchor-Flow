# Safety-Critical Sprint 2 — Progress Report

**Branch pattern:** sh2b-sync, deploy-stamp, owner-guard, reset-form, rls-export
**Baseline:** 215 tests, 0 esbuild warnings
**Date:** 2026-07-06

---

## Priority 1 — SH-2b: Safe Harbor household sync

**Branch:** `sh2b-sync`
**Status:** In progress

### 1. Code/Data-Flow Map

#### Safe Harbor write path (component → localStorage)
- User interaction → `update(changes)` → `setData(next)` + `saveData(next)` → `localStorage.setItem("af_safe_harbor", JSON.stringify(next))`
- `af_safe_harbor` is NOT in `SYNC_KEYS`, NOT in `_DIRTY_EXCLUDE`, NOT in `sanitizeHouseholdData`
- No sync fires on any Safe Harbor write (by design — was device-local)

#### Safe Harbor read path
- Component mount → `loadData()` reads `af_safe_harbor` → tombstone filter → V2 migration if flag is on → returns data
- V2 migration (`migrateToV2`): absorbs `af_sh_remind` → sets `version: 2` → writes migrated blob back

#### Practice-session overlay: CONFIRMED ISOLATED
- `sessionChecked` is `useState(null)` — pure React state
- `endSession()` calls `setSessionChecked(null)` — never touches localStorage
- `toggleItem` during session updates `sessionChecked` only — never touches `item.checked` or localStorage
- **Safe harbor merge hook must never include sessionChecked — it does not exist in stored data**

#### Sync apply sites (7 forEach loops in App.jsx)
All have the same pattern: `sanitizeHouseholdData(row.data)` → `SYNC_KEYS.forEach(k => localStorage.setItem("af_" + k, ...))`
| Line | Context |
|------|---------|
| 2091 | Sign-in: apply existing household on auth |
| 2120 | Sign-in: apply joined household |
| 2360 | checkForUpdates: stale-check pull |
| 2404 | joinHousehold: fresh pull after join RPC |
| 2443 | pullLatestHouseholdData: manual/stale-blocked pull |
| 2483 | syncNow: confirm-pull after push |
| 2711 | Background poll: periodic update check |

All 7 sites write `localStorage.setItem("af_" + k, JSON.stringify(clean[k]))`.
**Merge hook intercepts at all 7 sites.**

### 2. Design: mergeSafeHarbor

**Approach:** Per-field merge with union semantics for collections, local-wins for checked state.
No tombstones in v1 (union only — deletions don't propagate). Documented below.

**Merge rules:**
| Field | Rule | Rationale |
|-------|------|-----------|
| `grabItems` | Union by `id`; field conflicts → remote-wins; `checked` → local-wins | During emergency, someone may be actively checking items; remote checked state could reset live progress |
| `members` | Union by `id`; conflicts → remote-wins | Member data rarely edited mid-emergency |
| `contacts` | Field-by-field: prefer non-empty; if both non-empty, remote wins | Both sides may have different fields filled; don't blank out either |
| `hazards` | Union (set) | Adding a hazard is additive; neither side should lose it |
| `removedDefaultIds` | Union (set) | Both sides' removals are valid; union preserves all intentional removals |
| `review.lastReviewedAt` | Later ISO string wins | More recent review beats older |
| `review.remindDismissedAt` | Later epoch-ms wins | More recent dismissal beats older |
| `review.cadence` | Remote-wins | Rare change; remote is "latest authoritative" |
| `lastReviewed` | Later ISO string wins | Mirror of review.lastReviewedAt for V1 compat |
| `sixPs`, `familyPlan` | Remote-wins | Future structured fields; remote is latest |
| `reviewDue` | `remote || local` (either true wins) | Belt-and-suspenders |

**Deletion propagation (v1 of merge):**
Without tombstones, removing an item on device A then syncing leaves the item in the union on device B. Confirmed documented as a known limitation. Tombstone support is future work (Phase SH-3+). For the `removedDefaultIds` field, union semantics DO propagate removals of DEFAULT items because `removedDefaultIds` is the tombstone list for default items.

### 3. Mixed-version households

**Decision: migrate-on-receive.**

Reasoning: `migrateToV2(blob)` is idempotent, tolerant of all input shapes (null, V1, V2), and its localStorage side effect (absorbing `af_sh_remind`) is a no-op after first migration. `normalizeForMerge()` applies the same shape normalization without any localStorage side effects, making it safe to call inline in the merge hook.

Scenario analysis:
- **V2 device receives V1 blob:** `normalizeForMerge(remote)` gives it a V2-compatible shape. Merge proceeds. V2 blob written to localStorage. V1 device is unaffected.
- **V1 device receives V2 blob:** The V2 blob passes through sanitizer (object pass-through) and is written to `af_safe_harbor`. V1's `loadData()` reads it; `SAFE_HARBOR_V2 = false` so migration gate is skipped. V2 fields are preserved silently in the blob. V1 `update()` writes them back intact. Device functions normally.
- **V1 device's `af_sh_remind` diverges from V2 blob's `review.remindDismissedAt`:** Known limitation. The dismiss timestamp may be stale in the synced blob until the V1 device is upgraded to V2. Documented in Unresolved Risks.

### 4. Export/import backup coverage

`af_safe_harbor`, `af_sh_remind`, and `af_safe_harbor_v2` are captured automatically by the export (enumerates all `af_*` localStorage keys). No explicit listing needed. Verified in code-map section 9.

### 5. Implementation

**Files changed:**
- `src/shell/safe-harbor-migrate.js` — added `laterIso()`, `laterMs()`, `normalizeForMerge()`, `mergeSafeHarbor()` exports
- `src/sync-core.js` — added `import { mergeSafeHarbor }`, added `"safe_harbor"` to SYNC_KEYS and `_SANITIZE_HANDLED`, added `safe_harbor` sanitize rule (object pass-through), added `applyHouseholdKey(k, remoteVal)` export
- `src/App.jsx` — added `applyHouseholdKey` to import; replaced all 7 `localStorage.setItem("af_" + k, ...)` calls in SYNC_KEYS forEach loops with `applyHouseholdKey(k, ...)`
- `src/shell/SafeHarbor.jsx` — `saveData()` now marks `safe_harbor` dirty in `af_dirtyKeys` and dispatches `af-data-changed` so the sync push pipeline picks up Safe Harbor changes
- `tests/unit/sanitize.test.js` — added `safe_harbor` to PLAUSIBLE fixture; updated SYNC_KEYS count from literal "67" to dynamic
- `tests/unit/safe-harbor-merge.test.js` — new file: Suite E (27 tests), covers E1–E10

**Test results:** 243 passed (was 215), esbuild 0 warnings

### 6. Manual verification plan

**MANDATORY FIRST STEP: Export Backup on every household device before enabling V2.**

1. Device A: open app → Settings → Export Backup → confirm `af_safe_harbor` in downloaded JSON
2. Device B: same
3. On device A: enable V2 → `localStorage.setItem("af_safe_harbor_v2","true"); location.reload();`
4. On device B: same
5. Device A: add a Safe Harbor member → verify sync fires within 60s (`af_dirtyKeys` should include `safe_harbor`)
6. Device B: wait for sync poll (60s) → verify member appeared
7. Device B: check 3 grab items in practice session → immediately save → verify those items' `checked:true` in localStorage
8. Device A: edit a different field → push
9. Device B: pull → verify: (a) checked items STILL checked on B, (b) A's edit is present
10. Conflict test: device A and B both add different contacts simultaneously → sync → verify field-by-field merge (no field blanked)

**GO/NO-GO for "shared emergency plan" marketing claim:**
- GO when: steps 5–9 pass on two physical devices with different household members visible on both.
- NO-GO if: step 9 shows checked items reset, or any device's member list is truncated after sync.
- Additional gate: both devices must show identical `grabItems` count (union, not intersection) after bi-directional sync.

### 7. Unresolved risks

- **Custom item deletions don't propagate:** Union semantics mean a custom item deleted on device A reappears on next pull from device B. No tombstone support in v1. Document for users: "custom emergency items removed on one device may reappear when syncing until all devices sync after removal."
- **V1 `af_sh_remind` / V2 `review.remindDismissedAt` divergence in mixed household:** A V1 device dismisses the nudge by writing to `af_sh_remind`. The synced blob's `review.remindDismissedAt` won't be updated until the V1 device is upgraded to V2. On a V2 device, the merge uses the blob's `remindDismissedAt`, which may be stale. Low severity — nudge simply reappears; no data loss.
- **Concurrency between saveData and sync apply:** If a sync pull fires while the user is in the middle of editing (very narrow window), the merge reads `localStorage.getItem("af_safe_harbor")` before the save completes. This is inherent to single-threaded localStorage and applies to all SYNC_KEYS, not just safe_harbor. Mitigated by the typing-detection guards on pull.

---
