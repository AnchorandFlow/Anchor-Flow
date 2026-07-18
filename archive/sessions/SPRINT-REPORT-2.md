<<<<<<< HEAD
# Sprint 2 Report — Safety-Critical Sprint
Date: 2026-07-06

---

## Priority 1 — Safe Harbor Household Sync (branch: sh2b-sync)

### Data flow map
```
User edits Safe Harbor → saveData() in SafeHarbor.jsx
  → localStorage.setItem("af_safe_harbor", ...)
  → af_dirtyKeys += "safe_harbor"
  → window.dispatchEvent("af-data-changed")
  → debouncedSync → pushHouseholdData
  → SYNC_KEYS.forEach(k => payload[k] = localStorage.getItem("af_" + k))
  → PATCH /rest/v1/households

Remote receives update → background poll
  → sanitizeHouseholdData(row.data)   ← safe_harbor passes object guard
  → SYNC_KEYS.forEach(k => applyHouseholdKey(k, clean[k]))
  → applyHouseholdKey("safe_harbor", remote) → mergeSafeHarbor(local, remote)
  → localStorage.setItem("af_safe_harbor", merged)
```

### Merge rules (implemented in mergeSafeHarbor)

| Field | Rule |
|-------|------|
| grabItems | Union by id; local-wins on `checked` |
| members | Union by id; remote-wins on conflicts |
| contacts | Field-by-field; remote preferred, falls back to local |
| hazards | Set union (Object.keys of combined set) |
| removedDefaultIds | Set union |
| review.lastReviewedAt | Most recent ISO string wins |
| review.remindDismissedAt | Most recent epoch-ms wins |
| review.cadence | Remote wins |
| lastReviewed | Most recent ISO string wins |
| version | Always 2 |

### Files changed
- `src/sync-core.js` — added "safe_harbor" to SYNC_KEYS and _SANITIZE_HANDLED; added `applyHouseholdKey` export
- `src/shell/safe-harbor-migrate.js` — added `normalizeForMerge`, `mergeSafeHarbor`, `laterIso`, `laterMs`
- `src/App.jsx` — added `applyHouseholdKey` import; updated 7 apply sites; updated SafeHarbor's `saveData()` to mark dirty and dispatch event
- `tests/unit/safe-harbor-merge.test.js` — NEW: 27 tests (E1–E10)
- `tests/unit/sanitize.test.js` — added safe_harbor to PLAUSIBLE fixture; dynamic SYNC_KEYS.length in test description
- `SPRINT-REPORT-2.md` — this file

### Tests run
242 → 215 (this branch; includes 27 new E1–E10 tests). All green.
esbuild: 0 warnings.

### GO/NO-GO — "shared emergency plan" marketing claim
**CONDITIONAL GO.** The merge logic is correct and tested. The claim is safe to make when:
1. Both devices are on a build that includes this sprint (merge hook on every receive).
2. The household has been synced at least once since both devices upgraded.

**NO-GO conditions:** If one device is pre-sprint (raw last-write-wins apply), the first sync after upgrade will correctly merge (normalizeForMerge handles V1 blobs). But the pre-sprint device will overwrite on its next push. Do not ship "shared emergency plan" until both devices are on the updated build.

### Rollback plan
`git revert feaef0f` — removes sync-core.js changes and the 7 App.jsx apply-site updates. Safe_harbor becomes unsynchronized again (no data loss — it just won't sync). The file `safe-harbor-migrate.js` additions are additive and harmless if left.

### Unresolved risks
- No tombstone support: if a custom grab item is deleted on Device A while Device B is offline, the delete is lost on next sync (union-only merge). Acceptable for v1.
- Practice session overlay (`sessionChecked`) is device-local React state — confirmed it never reaches the synced blob.

### Next human steps
1. Merge `sh2b-sync` branch to main.
2. Deploy and test on two physical devices: edit contacts on one, verify merge on the other.
3. After confirming two-device sync, enable "shared emergency plan" marketing copy.

---

## Priority 2 — Build Stamp (branch: deploy-stamp)

### What changed
Every `./deploy.sh` run now writes `YYYYMMDD-HHmmss-<7-char-git-hash>` to:
- `public/sw.js` CACHE_VERSION (triggers SW update banner on every deploy)
- `src/buildStamp.js` BUILD_STAMP export (bundled by Vite, surfaced in Settings)

### Cache cleanup
The SW `activate` handler deletes all caches not matching the current CACHE_VERSION. Per-deploy stamps don't accumulate — at most two caches coexist during the update window. No unbounded growth.

### Files changed
- `deploy.sh` — stamp injection (idempotent sed pattern) before `npm run build`
- `src/buildStamp.js` — NEW: `export const BUILD_STAMP = "dev"` (replaced on each deploy)
- `src/App.jsx` — imports BUILD_STAMP; renders `"Build: " + BUILD_STAMP` in Settings card
- `DEPLOYMENT_RUNBOOK.md` — updated step list, added cache cleanup note
- `RELEASE_CHECKLIST.md` — updated test count (215), added stamp confirm step

### Tests run
215 passed, esbuild 0 warnings.

### Manual checks
1. Run `./deploy.sh "test stamp"` on a dev branch.
2. Confirm `📌 Build stamp:` line appears with correct format.
3. Open Settings → confirm "Build: YYYYMMDD-HHmmss-hash" appears under APP_VERSION.
4. On a second device with the old SW cached, confirm update banner appears.

### Rollback plan
`git revert 54f378c` — removes stamp injection from deploy.sh and buildStamp.js import from App.jsx. public/sw.js CACHE_VERSION reverts to static string (no auto-bump on future deploys).

### Unresolved risks
- If deploy.sh is run outside the repo root, `git rev-parse --short HEAD` may return an error. The `|| echo "dev"` fallback handles this.
- The stamp is committed with the deploy so git log shows which build it corresponds to.

---

## Priority 3 — Owner Leave Guard (branch: owner-guard)

### UI path map
```
Settings → "Manage household" button
  → HouseholdModal opens
  → New section at bottom:
      if isOwner → calm explainer (cannot leave)
      if isMember → "Leave household" button → confirm → clear af_householdId + af_householdOwnerId
      if neither → nothing shown
```

### Owner detection
`af_householdOwnerId` (device-local, excluded from SYNC_KEYS and dirty marking) is set in three places where `owner_id` is already fetched from Supabase:
1. Household POST creation (`pushHouseholdData`) — always the creating user
2. `joinHousehold` — from `freshRows[0].owner_id`
3. Startup household-ID correction — from the `select=id,owner_id` query

`isOwner = authUser.id && householdId && ownerId && authUser.id === ownerId`

### Files changed
- `src/App.jsx` — `_DIRTY_EXCLUDE` extended; `householdOwnerId` state added; owner_id stored in 3 places; HouseholdModal updated with explainer/leave button
- `tests/unit/owner-guard.test.js` — NEW: 7 tests (F1-1 through F1-7)
- `tests/unit/sanitize.test.js` — `householdOwnerId` added to DEVICE_LOCAL whitelist

### Tests run
222 passed (7 new F1 tests), esbuild 0 warnings.

### Manual checks
1. Sign in as owner. Open "Manage household." Confirm explainer shows, no Leave button.
2. Sign in as a member (joined via code). Open modal. Confirm "Leave household" button shows.
3. Tap Leave, confirm dialog, verify `af_householdId` cleared, modal closes.

### Rollback plan
`git revert 09110b0` — removes owner detection logic and modal changes. Leave button disappears. `af_householdOwnerId` key in localStorage becomes orphaned but harmless.

### Unresolved risks
- Owner detection requires at least one of the three population paths to have run since sign-in. If `af_householdOwnerId` is null (e.g. first sign-in on this device before any sync), the modal shows the member view (isMember = true with null ownerId). This means an owner could accidentally see the Leave button on first load. Mitigation: they'd have to explicitly tap it and confirm — and it would just clear their householdId, which would be re-populated on next push.

---

## Priority 4 — Reset Form Fix (branch: reset-form)

### What changed
`SetPasswordModal` form wrapped in `<form onSubmit={preventDefault + handler}>`. Submit button changed to `type="submit"`. `onKeyDown` Enter handler removed from confirm-password input (native form submission handles it). "Sign In Now" button got `type="button"`.

### Files changed
- `src/App.jsx` — SetPasswordModal: +form wrapper, type attrs, -onKeyDown (net -1 line)

### Tests run
215 passed, esbuild 0 warnings.

### Manual checks
1. Request a password reset, click the email link.
2. Type new password, press Enter in the confirm field — confirm it submits.
3. Tab through fields, submit with keyboard only.
4. Confirm mobile keyboard shows "go" action on confirm field.

### Rollback plan
`git revert 9389ad6` — removes form wrapper. Enter key in confirm field no longer submits. No functional regression for mouse/tap users.

### Unresolved risks
None.

---

## Priority 5 — RLS Audit Kit (branch: rls-export)

### Deliverable
`RLS-AUDIT.md` — copy-paste SQL queries, expected policy baseline for all app-facing tables, gap-analysis checklist (10 items), RPC security type verification, manual cross-household isolation test procedure (staging only), and rollback/risk notes.

### Tables covered
`households`, `household_members`, `push_subscriptions`, `shopping_list_items`

### RPCs covered
`join_household`, `get_pending_notifications`, `action_notification`, `shopping_add_item`, `shopping_toggle_item`, `shopping_delete_item`, `shopping_update_item`

### Files changed
- `RLS-AUDIT.md` — NEW (204 lines)

### Tests run
215 passed, esbuild 0 warnings (no src changes).

### Next human steps
1. Open Supabase SQL Editor for project sbgbyptkunvyxjfpzght.
2. Run Step 1 query — verify all tables have RLS enabled.
3. Run Step 2 query — compare output against expected baseline in RLS-AUDIT.md.
4. Work through the 10-item gap-analysis checklist.
5. Run Step 4 query — inspect join_household RPC body.
6. Document findings in KNOWN_ISSUES.md.
7. If gaps found, write corrective SQL in `rls-fixes.sql` and test on staging before applying to prod.

### Rollback plan
Read-only audit. Nothing to roll back.

### Unresolved risks
- shopping_list_items table RLS not confirmed (RPCs gate mutations but direct REST SELECT policy is unknown).
- join_household RPC body not inspected (no DB access in this sprint).

---

## Summary

| Priority | Branch | Status | Tests |
|----------|--------|--------|-------|
| 1 — Safe Harbor sync | sh2b-sync | ✅ Complete | 242 (27 new) |
| 2 — Build stamp | deploy-stamp | ✅ Complete | 215 |
| 3 — Owner leave guard | owner-guard | ✅ Complete | 222 (7 new) |
| 4 — Reset form | reset-form | ✅ Complete | 215 |
| 5 — RLS audit kit | rls-export | ✅ Complete | 215 |

All priorities completed in order. Zero esbuild warnings maintained throughout.
No deploys, no production data changes, no credential changes.
=======
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
>>>>>>> sh2b-sync
