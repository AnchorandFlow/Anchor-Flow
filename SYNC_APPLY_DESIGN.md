# applyRemoteData — Design Document
## Anchor & Flow sync architecture, Phase A

**Branch:** design/sync-apply-layer  
**Date:** 2026-07-01  
**Status:** Design only. No implementation in Phase A.

---

## Problem statement

Every sync-apply path in App.jsx today ends with `window.location.reload()`. This is the root cause of:

- **P1-1** (poll-path silent overwrite): the reload destroys React state, which means any edits inside the debounce window are lost before they can push.
- User-visible page flash on every remote sync event, even when only a single field changed.
- Mobile battery waste: a reload forces full JS re-parse and re-hydration every 60 seconds.

The fix is a single function, `applyRemoteData(remotePayload, meta)`, that writes remote data into live React state in-place without a reload.

---

## 1. How each SYNC_KEYS key reaches live React state

### 1a. `useSaved`-managed keys (the majority)

Most SYNC_KEYS entries are managed by `useSaved(key, fallback)` hooks declared inside `HomeFlow`. Each hook returns `[val, setSaved]`. The setter `setSaved(next)` does three things:
1. Calls `setVal(resolved)` — updates React state.
2. Writes `af_<key>` to localStorage.
3. Marks `key` dirty in `af_dirtyKeys` (suppressed during `_afHydrating`).

For in-place apply, we need to call `setSaved` for each incoming key — **not** write to localStorage directly and reload. This means `applyRemoteData` must be defined **inside `HomeFlow`** (or receive a setter map), so it closes over all the `setSaved` functions.

### 1b. Bespoke `useState` keys

Two keys use plain `useState` + a localStorage helper instead of `useSaved`:

| Key | React state | Write helper | Fixed in |
|---|---|---|---|
| `workDays` | `[workDays, setWorkDays]` | `saveWorkDays(wd)` | dirty-marking fix (12b0f2d) |
| `cal_markers` | `[calMarkers, setCalMarkers]` | `saveCalMarkers(m)` | dirty-marking fix (12b0f2d) |

For `applyRemoteData`, these must be handled explicitly:
- `workDays`: call `setWorkDays(remoteClean.workDays)` + `saveWorkDays(remoteClean.workDays)`. Do **not** call `markKeyDirty` here (the apply is incoming data, not a user edit).
- `cal_markers`: same — `setCalMarkers(remoteClean.cal_markers)` + `saveCalMarkers(remoteClean.cal_markers)`.

**Note:** `saveCalMarkers` now calls `markKeyDirty` and dispatches `af-data-changed` after the dirty-marking fix. `applyRemoteData` must call the raw setter + `localStorage.setItem` directly for these two keys, bypassing `saveCalMarkers` / `saveWorkDays`, to avoid marking the incoming remote data as locally dirty.

### 1c. Read-only keys

`cal_marker_types` has no active write path in the UI (`saveCalMarkerTypes` is defined but never called). `applyRemoteData` should write it to localStorage only (in case it changes server-side) and not call any setter.

### 1d. Keys managed by child components

`traditions` is written by `RipplesRoom.jsx`; `exhale_*` keys by `ExhaleSection.jsx`. These components read from localStorage on mount and have their own local state. `applyRemoteData` writes the localStorage keys; the child components will pick up the change on next mount (or on a soft navigation away and back). This is acceptable for Phase B. Phase C can add a `storage` event listener inside each child.

---

## 2. Function signature and call contract

```javascript
// Defined inside HomeFlow, after all useSaved hooks and bespoke useState calls.
// Has closure access to all setters.
//
// @param remoteClean  {object}  — output of sanitizeHouseholdData(row.data)
// @param meta         {object}  — { serverTs: string, source: string }
//   source: "poll" | "syncNow" | "pullLatest" | "joinHousehold" | "signIn"
//
// Returns: void. Fires sync if dirty keys were preserved (see P1-1 section).
function applyRemoteData(remoteClean, meta) {
  // 1. Dirty-local-wins merge (P1-1 fix)
  var dirtyKeys = readDirtyKeys();
  var merged = mergeDirtyLocalWins(remoteClean, dirtyKeys);
  var toWrite = merged.toWrite;
  var skipped = merged.skipped;

  // 2. Write non-dirty keys to localStorage + React state
  // useSaved keys — call the setter with suppress-dirty flag
  // (The setter is called with _fromRemote=true to skip dirty-marking;
  //  alternatively, write only to localStorage and rely on a hydration
  //  pass — see Option B note below)
  _applyUseSavedKeys(toWrite);  // calls each setSaved with a no-dirty variant
  _applyBespokeKeys(toWrite);   // handles workDays, cal_markers directly

  // 3. Update sync timestamps
  try { localStorage.setItem("af_lastHHSync", meta.serverTs); } catch(e) {}

  // 4. If dirty keys were skipped, push them to the server
  if (skipped.length > 0) {
    AF_DEBUG && console.log("[AF APPLY] skipped dirty keys:", skipped, "— scheduling push");
    debouncedSync(); // pushes the dirty keys; after push succeeds, dirtyKeys cleared
  }

  // 5. Update UI state
  setSyncStatus("synced");
  setLastSyncTime(new Date().toLocaleTimeString());
}
```

### Option A vs Option B for `_applyUseSavedKeys`

**Option A (preferred for Phase B):** Add a `_fromRemote` flag to `setSaved` that suppresses dirty-marking:
```javascript
function setSaved(next, _fromRemote) {
  setVal(prev => {
    const resolved = typeof next === "function" ? next(prev) : next;
    try { localStorage.setItem("af_" + key, JSON.stringify(resolved)); } catch {}
    if (!_fromRemote && !_afHydrating && !_DIRTY_EXCLUDE.includes(key)) {
      // ... dirty-marking unchanged
    }
    return resolved;
  });
}
```
This is the minimal, safe change to `useSaved`. Only `applyRemoteData` passes `_fromRemote=true`; all other callers are unchanged.

**Option B (alternative):** Write directly to localStorage for all keys and rely on React state being refreshed on next render. This avoids touching `useSaved` but means React state is stale until re-render. Since most renders happen within milliseconds of a state change, this is acceptable, but it could cause a brief inconsistency if any synchronous code reads state after `applyRemoteData` returns and before re-render.

**Recommendation: Option A.** The `_fromRemote` flag is a single-line addition per `setSaved` call site and makes the intent explicit.

---

## 3. P1-1 fix: dirty-local-wins merge + push-after

### The problem (from audit)

`pullLatestHouseholdData` (line 2444) clears `af_dirtyKeys` unconditionally after overwriting localStorage. `checkForUpdates` (line 2642) overwrites localStorage values without checking dirty keys. Any local edit inside the 3-second debounce window is silently lost.

### The fix: two rules

**Rule 1: dirty-local-wins** — In `applyRemoteData`, for any key that appears in `af_dirtyKeys`, skip the remote value (leave localStorage and React state unchanged for that key).

**Rule 2: push-after** — After applying, if any keys were skipped, call `debouncedSync()` so the preserved local edits reach the server within 3 seconds. This is safe because:
- We just wrote the remote timestamp to `af_lastHHSync`.
- On the next poll tick, `checkForUpdates` will see our push timestamp and short-circuit (own-write detection).
- The push sends only the dirty keys' values from `readHouseholdState()`, which still contains the local values (skipped, not overwritten).

### vs. push-first (syncNow pattern)

An alternative is to always call `pushHouseholdData` BEFORE applying remote data, same as `syncNow`. This is cleaner (no merge logic) but adds latency: every incoming remote change that arrives while dirty keys exist requires a full round-trip push before the remote data is applied.

**Decision: push-after for the poll path, push-first for `pullLatestHouseholdData`.**

- `checkForUpdates` (B-1): dirty-local-wins + push-after. Poll frequency is 60 s; the 3-second push-after is invisible.
- `pullLatestHouseholdData` (B-2): push-first (same as `syncNow`). This function is called when a stale-push guard fires — we know the server has data we need. Push first so our edit wins the timestamp battle, then apply the server's other changes.

### Failure modes

| Failure | Consequence | Mitigation |
|---|---|---|
| Push-after fails (network error) | Dirty keys remain; next poll cycle calls dirty-local-wins again. Local edit preserved but not synced. | Retry is automatic — next poll or visibility-change fires debouncedSync again. |
| Both devices have dirty edits for the same key | Neither adopts the other's value until one successfully pushes. Last push wins at the server. | Acceptable for Phase B (whole-doc sync). Item-level merge deferred to Phase C. |
| Dirty key list grows unbounded (many offline edits) | Each poll skips all dirty keys; remote changes to those keys are blocked locally. | After a successful push, `af_dirtyKeys` is cleared (existing behavior in `pushHouseholdData`). |

---

## 4. Preserved invariants

Every invariant from the "Verified good — do not change" list is preserved:

| Invariant | How preserved by applyRemoteData |
|---|---|
| `refreshAuthToken` | Not touched. Called by poll on auth error; `applyRemoteData` has no auth concerns. |
| `api/claude.js` | Not touched. |
| `public/sw.js` | Not touched. Version-change escape hatch still calls `location.reload()` (see §5). |
| Push safety stack (stale-push guard, nonNull<2, own-write) | Push-after calls `debouncedSync()` → `syncNow()` → `pushHouseholdData()` — full stack fires. |
| `useSaved` hydration guard (`_afHydrating`) | `applyRemoteData` passes `_fromRemote=true` to `setSaved`, bypassing the hydration guard entirely. The hydration guard is not needed here — this is not hydration, it's an explicit remote apply. |
| `isRemotePayloadSafe` | Called by every site (poll, pullLatest, syncNow) before reaching `applyRemoteData`. `applyRemoteData` receives already-validated data. |
| `sanitizeHouseholdData` | Called at every site before `applyRemoteData`. The function receives `remoteClean`, not raw data. |
| `createLocalBackup` | Called at every site before `applyRemoteData`. No change. |
| `markKeyDirty` (new, module-scope) | `applyRemoteData` does NOT call `markKeyDirty`. Remote data is not a user edit. The push-after path calls `debouncedSync()`, which reads existing dirty keys — no new dirty marking needed. |
| Typing/drag/modal guards | All guards remain at the call site (`checkForUpdates`, `syncNow`). `applyRemoteData` receives already-guarded execution — it does not re-check. |

---

## 5. Retained hard-reload escape hatch

After all sync-apply sites are replaced, one intentional `location.reload()` remains:

```javascript
// In applyRemoteData, before applying:
if (remoteClean._meta && remoteClean._meta.app_version &&
    remoteClean._meta.app_version !== APP_VERSION) {
  AF_DEBUG && console.log("[AF APPLY] bundle version changed — forcing reload");
  window.location.reload();
  return;
}
```

This fires when a new deployment changes the bundle. In-place apply is unsafe here because the running JS code may not understand the new data shapes. This is the single surviving intentional reload.

**Prerequisite:** `APP_VERSION` in App.jsx (`"2026-06-03-vault-refresh"`) and the SW cache key (`"anchor-flow-v20260622-1"`) must be unified before this gate can be wired up (audit P2 — currently they differ by three weeks).

---

## 6. Migration order (from SYNC_RELOAD_INVENTORY.md)

| Deploy | Site | Change |
|---|---|---|
| **B-1** | Line 2642 (`checkForUpdates`) | Replace SYNC_KEYS.forEach + reload with `applyRemoteData(cleanBg, { serverTs, source:"poll" })` + dirty-local-wins + push-after |
| **B-2** | Line 2444 (`pullLatestHouseholdData`) | Push-first via `syncNow()`, then replace with `applyRemoteData`; remove unconditional `af_dirtyKeys` clear |
| **B-3** | Lines 2358, 2482 (`pullHouseholdData`, `syncNow`) | Replace apply+reload blocks |
| **B-4** | Line 2403 (`joinHousehold`) | Replace apply+reload block |
| **B-5** | Lines 2520–2556 (startup hh-id correction) | Replace `localStorage.setItem("af_householdId", ...) + reload` with `setHouseholdId(newId)` |

Between each deploy: run the two-device manual test (add/edit/remove on A → verify B picks it up; no flash).

---

## 7. Drift risk and Phase B gate

**`src/sync/syncCore.js` is a copy of App.jsx logic, not an import.**

Until Phase B, any change to `isRemotePayloadSafe`, `sanitizeHouseholdData`, `markKeyDirty`, or the dirty-key read/write logic in App.jsx must be **manually mirrored** in `syncCore.js`. There is no automated enforcement of this.

**Phase B prerequisite task:** Before any production deploy of `applyRemoteData`, refactor App.jsx to:
```javascript
import {
  isRemotePayloadSafe, sanitizeHouseholdData,
  markKeyDirty, readDirtyKeys,
  isOwnWrite, shouldApplyRemote,
  mergeDirtyLocalWins
} from "./sync/syncCore.js";
```
This makes the test suite the canonical specification and eliminates the drift risk.

The `mergeDirtyLocalWins` and `shouldApplyRemote` functions in `syncCore.js` are new (not yet in App.jsx). They will be introduced into App.jsx as part of the B-1 deploy.

---

## 8. What `applyRemoteData` does NOT do

- Call `location.reload()` (except the version-change escape hatch).
- Clear `af_dirtyKeys` (that happens only after a successful push in `pushHouseholdData`).
- Fetch from the network (caller is responsible for fetching and passing the payload).
- Call `createLocalBackup` (caller does this before invoking `applyRemoteData`).
- Call `isRemotePayloadSafe` (caller validates before invoking).

---

## Appendix: complete setter map (Phase B implementation guide)

For each key in SYNC_KEYS, the setter to call in `applyRemoteData`:

| Logical key | React state var | Setter | Note |
|---|---|---|---|
| tasks | tasks | setTasks | useSaved |
| brainItems | brainItems | setBrainItems | useSaved |
| brainCats | brainCats | setBrainCats | useSaved |
| calEvents | calEvents | setCalEvents | useSaved |
| connectedCals | connectedCals | setConnectedCals | useSaved |
| calColorLabels | calColorLabels | setCalColorLabels | useSaved |
| meals | meals | setMeals | useSaved |
| mealsWeekOf | mealsWeekOf | setMealsWeekOf | useSaved; skip if local has this week's value |
| nextWeekMeals | nextWeekMeals | setNextWeekMeals | useSaved |
| mealCount | mealCount | setMealCount | useSaved |
| mealThemeEnabled | mealThemeEnabled | setMealThemeEnabled | useSaved |
| mealThemes | mealThemes | setMealThemes | useSaved |
| favMeals | favMeals | setFavMeals | useSaved |
| mealBankCustom | mealBankCustom | setMealBankCustom | useSaved |
| recipes | recipes | setRecipes | useSaved |
| shoppingItems | shoppingItems | setShoppingItems | useSaved |
| stores | stores | setStores | useSaved |
| shopCategories | shopCategories | setShopCategories | useSaved |
| people | people | setPeople | useSaved |
| familyProfile | familyProfile | setFamilyProfile | useSaved |
| birthdays | birthdays | setBirthdays | useSaved |
| rhythm | rhythm | setRhythm | useSaved |
| homeSystems | homeSystems | setHomeSystems | useSaved |
| notifications | notifications | setNotifications | useSaved |
| recurring | recurring | setRecurring | useSaved |
| notifSettings | notifSettings | setNotifSettings | useSaved |
| sections | sections | setSections | useSaved |
| flowMode | flowMode | setFlowMode | useSaved |
| preferredName | preferredName | setPreferredName | useSaved |
| flowGreetingTone | flowGreetingTone | setFlowGreetingTone | useSaved |
| weatherLocation | weatherLocation | setWeatherLocation | useSaved |
| burnoutChecked | burnoutChecked | setBurnoutChecked | useSaved |
| aiMemory | aiMemory | setAiMemory | useSaved |
| celebrations | celebrations | setCelebrations | useSaved |
| celebgifts | celebgifts | setCelebGifts | useSaved |
| gifts | gifts | setGifts | useSaved |
| inventory | inventory | setInventory | useSaved |
| pets | pets | setPets | useSaved |
| ripples | ripples | setRipples | useSaved |
| houseFile | houseFile | setHouseFile | useSaved |
| favProducts | favProducts | setFavProducts | useSaved |
| packing_templates | packingTemplates | setPackingTemplates | useSaved |
| moments | moments | setMoments | useSaved |
| subs | subs | setSubs | useSaved |
| vaultSystems | vaultSystems | setVaultSystems | useSaved |
| health | health | setHealth | useSaved |
| career | career | setCareer | useSaved |
| travel_profile | travelProfile | setTravelProfile | useSaved |
| cove_lists_v1 | coveLists | setCoveLists | useSaved |
| cove_items_v1 | coveItems | setCoveItems | useSaved |
| cove_sections_v1 | coveSections | setCoveSections | useSaved |
| cove_notes_v1 | coveNotes | setCoveNotes | useSaved |
| schoolData | schoolData | setSchoolData | useSaved |
| coveData | coveData | setCoveData | useSaved |
| dietaryFilters | dietaryFilters | setDietaryFilters | useSaved |
| compassCache | compassCache | setCompassCache | useSaved |
| compassEnabled | compassEnabled | setCompassEnabled | useSaved |
| exhale_groups | — | localStorage only | Managed by ExhaleSection.jsx; write LS, child picks up on mount |
| exhale_color_labels | — | localStorage only | Same |
| exhale_people | — | localStorage only | Same |
| exhale_labels | — | localStorage only | Same |
| cal_markers | calMarkers | setCalMarkers (raw) | Bespoke; bypass saveCalMarkers to avoid marking dirty |
| cal_marker_types | — | localStorage only | No active write path |
| workDays | workDays | setWorkDays (raw) | Bespoke; bypass saveWorkDays to avoid marking dirty |
| traditions | — | localStorage only | Managed by RipplesRoom.jsx; write LS, child picks up on mount |

**Total: 63 keys.** 49 via `useSaved`, 2 via bespoke setters, 12 via localStorage only.

*Phase B implementation note: confirm each setter name by searching App.jsx for `useSaved("<key>", ` — the pattern is consistent.*
