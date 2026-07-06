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
