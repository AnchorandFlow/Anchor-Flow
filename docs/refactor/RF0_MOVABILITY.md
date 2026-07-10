# RF0 — Movability Classification

Every component and system gets exactly one class:

- **Class A — movable now.** Pure cut + paste + import. No prop changes needed.
- **Class B — needs prop-threading first.** Currently closes over parent state. Two-step: thread props inside the monolith (commit + test), then move the file (commit + test).
- **Class C — deferred.** Coupled to FlowWrapper/HomeFlow closure, sync internals, or unsafe until a prerequisite lands. Blocker stated.

---

## Class A — movable now

### Shared UI atoms

| Component/util | Reason |
|---------------|--------|
| `AnchorLogo` (764) | Pure SVG, no state |
| `CompassIcon` (776) | Pure SVG, no state |
| `Icon` (833) | Pure SVG lookup, no state |
| `ScrollTabs` (789) | Self-contained; owns only internal scroll state (useRef, useState) — no HomeFlow deps |
| `Section` (866) | All input via props. No state of its own. |
| `RootErrorBoundary` (341) | Class component, no deps on app state. References `errorCode` (from sync-core.js — already importable) |
| `SectionErrorBoundary` (368) | Class component, no deps |

### Pure utility functions

| Function | Notes |
|----------|-------|
| `urlBase64ToUint8Array` | Pure transform |
| `getInitials` | Pure string util |
| `ageFromBirthday`, `personAge`, `personIsMinor` | Pure date/people utils |
| `getThisMonday` | Pure date util |
| `getDaysInMonth`, `getFirstDayOfMonth` | Pure date util |
| `getPersonColor` | Pure lookup (depends on `PERSON_COLORS` constant — move together) |
| `uid` | Pure random ID |
| `weatherEmoji` | Pure lookup (currently inside HomeFlow — move to utils) |

### Services (API)

| Function | Target file |
|----------|------------|
| `sbFetch` | `src/services/api.js` |
| `sbAuth` | `src/services/api.js` |
| `sbSignOut` | `src/services/api.js` |
| `SUPABASE_URL`, `SUPABASE_KEY` | `src/services/api.js` |

These are pure async functions with no React dependency. They do depend on `SUPABASE_KEY` and the `supabase` SDK import — move all three together. `sbFetch` is also called by `usePushNotifications`; after extraction, both import from the same service file.

### Hooks

| Hook | Reason |
|------|--------|
| `usePointerDrag` (13850) | Pure drag behavior, no HomeFlow deps, self-contained |

### Constants (pure data)

| Constant group | Target file |
|---------------|------------|
| `THEMES` | `src/constants/themes.js` |
| `FLOW_MODES_FN`, `DIETARY_META_FN` | `src/constants/themes.js` |
| `DEFAULT_RHYTHM`, `DEFAULT_MEAL_THEMES`, `THEME_PRESETS` | `src/constants/rhythm.js` |
| `HOME_SYSTEMS_DEFAULT` | `src/constants/home.js` |
| `BURNOUT_TASKS` | `src/constants/tasks.js` |
| `BRAIN_BUCKETS`, `BRAIN_CATS` | `src/constants/brain.js` |
| `TABS`, `PRIMARY_TABS`, `MORE_TABS` | `src/constants/nav.js` |
| `CAL_SOURCES`, `CAL_COLOR_OPTIONS` | `src/constants/calendar.js` |
| `MEAL_BANK_DATA`, `WEEK_TYPE_PRESETS`, `MEAL_TAG_FILTERS` | `src/constants/meals.js` |
| `GTK_QUESTIONS` | `src/constants/onboarding.js` |
| `PERSON_COLORS`, `PERSON_COLOR_DEFAULT` | `src/constants/people.js` |
| `RIPPLE_ACTION_MAP` | `src/constants/ripple.js` |
| `TREASURE_ICONS`, `WEEKDAYS_SUN` | `src/constants/misc.js` |
| `DAY_NAMES`, `FORMAT_DATE`, `FORMAT_SHORT` | `src/utils/dates.js` |

> **Warning:** `TABS` / `MORE_TABS` / `PRIMARY_TABS` are read at module scope in several places (HomeFlow render, FlowWrapper). Move after confirming no circular import. Move `THEMES` before any component that receives `T` as a prop so the prop type is deterministic.

---

## Class B — needs prop-threading first

### Module-scope components (already prop-driven, minor gaps)

| Component | What to thread | Notes |
|-----------|---------------|-------|
| `BrainCatsEditor` (887) | Already receives `brainCats`, `setBrainCats`, `T`, `inp`, `btnP` as props. **Already Class A** once `inp`, `btnP`, `T` are importable utilities. See Class A note — defer until theme utilities are extracted. | — |
| `WeeklyRhythmSection` (935) | Receives `rhythm`, `setRhythm`, `T`, `inp`, `btnP`, `btnS`, `lbl`, `ModalBox`. Gap: `ModalBox` is an `_hfRenders` component (closure). Must either thread a proper ModalBox or accept children. | Thread `ModalBox` as a prop (already done); move after RF-3 |
| `TidePoolSection` (996) | Receives `people`, `coveData`, `setCoveData`. Calls `uid()` (module-scope — importable). Uses `TODAY` (module-scope constant — importable). Already nearly extractable. | Move after RF-3 |
| `FamilySection` (1147) | Receives all data as props. Contains `FRow` defined inside its render (rule violation, low risk). Move `FRow` to module scope first. | Move after RF-3 |
| `SettingsTab` (1253) | Receives ~30 props. Already the prop contract is defined. Gap: internal `Sec`, `Row`, `Toggle`, `Pills` helpers are defined in its render body. Move those to module scope first. | Move as a complete bundle in RF-3 |

### `_hfRenders` display atoms (close over T only)

These are simple enough that threading `T` is the only step:

| Component | Close-over | Thread |
|-----------|-----------|--------|
| `Pill` | `T` | Thread `T` as prop |
| `SecHead` | `T` | Thread `T` as prop |
| `PersonPill` | `T`, `people` | Thread both as props |

Once threaded, these become Class A.

### `_hfRenders` interactive components (close over many values)

| Component | Close-over (must thread) | Risk |
|-----------|-------------------------|------|
| `ModalBox` | `T` (theme colors), body `overflow` effect | Low — thread T |
| `AnchorCheckItem` | `T`, `inp`, `btnP`, `btnS`, `notifications`, `setNotifications`, `addNotification` | Medium |
| `TaskRow` | `T`, `inp`, `btnP`, `btnS`, `notifications`, `setNotifications`, `addNotification`, `MEAL_DAYS`, `DAY_NAMES`, `TODAY_NAME` | Medium |
| `DraggableTaskList` | Depends on `TaskRow` being extractable | Medium |
| `ShopItemRow` | `T`, `inp`, `btnP`, `btnS` | Low |
| `BrainItemRow` | `T`, `inp`, `btnP`, `btnS` | Low — also defined inside BrainTab render (fix first) |
| `ItemRow` | `T`, `inp`, `btnP`, `btnS` | Low |
| `AIChatPanel` | `T`, `inp`, `btnP`, `btnS`, `aiMemory`, `setAiMemory`, `people`, `meals`, `tasks`, `calEvents`, `flowMode`, `familyProfile`, `householdId`, `authToken` | High — thread or pass context |
| `TodaySnapshot` | `T`, `tasks`, `meals`, `calEvents`, `people` | Medium |
| `OnboardingWizard` | Multiple HomeFlow state values | Medium |
| `DailyBriefingModal` | `T`, `dayBriefing`, `tasks`, `calEvents`, `meals` | Medium |
| `EndOfDayReset` | `T`, `tasks`, `setTasks`, `dayClosed`, `setDayClosed`, `meals`, `calEvents` | Medium |
| `MealBankDrawer` | `T`, `btnP`, `btnS` + receives `mealType`, `allBank` as props already | Low — already mostly prop-driven |

### `useRippleNotifications` hook

Currently calls `supabase.rpc()` directly. To extract: thread `supabase` as a parameter or import directly from `src/lib/supabase`. No React coupling issue — safe after extraction of supabase client.

### `usePushNotifications` hook

Calls `sbFetch` (module-scope). After `sbFetch` is extracted to `src/services/api.js`, import from there. No React coupling.

### `refreshAuthToken` function

References `supabase.auth`, `localStorage`, and `_refreshInFlight` mutex. The mutex **must** remain module-scope co-located with the function — it cannot be React state. Move to `src/services/auth.js` together with `_refreshInFlight`.

---

## Class C — deferred

### Core `useSaved` and dirty-flag system

| System | Blocker |
|--------|---------|
| `useSaved` | Depends on module-scope `_afHydrating` + `_DIRTY_EXCLUDE`. Both must be co-located. If `useSaved` moves to `src/hooks/useSaved.js`, `_afHydrating` and `_DIRTY_EXCLUDE` move with it, and `_afEndHydration` + `markKeyDirty` also move. This is a single atomic move — all five pieces in one commit. **Prerequisite:** every component that imports `useSaved` must import from the new location. This touches HomeFlow and SettingsTab directly. Move last. |

### Sync internals (partially extracted to `sync-core.js`)

| System | Blocker |
|--------|---------|
| `pushHouseholdData`, `pullLatestHouseholdData`, `debouncedSync`, `syncNow` | Defined inside HomeFlow; close over `authToken`, `householdId`, `setSyncStatus`, `setLastSyncTime`, `showInAppBanner`, etc. Moving requires threading all auth+status state. **Move together in a single batch, after all dependent state is threaded.** |
| `isRemotePayloadSafe`, `createLocalBackup` | Also inside HomeFlow. Move with sync batch. |
| `checkForUpdates` (polling) | Part of sync internals. Same batch. |
| `applyHouseholdKey` | Already in `sync-core.js`. |
| `SYNC_KEYS`, `sanitizeHouseholdData` | Already in `sync-core.js`. |

### Tab components (all close over all HomeFlow state)

| Component | Blocker |
|-----------|---------|
| `AnchorTab` | Closes over tasks, calEvents, meals, people, personalAnchors, notifications, T, inp, btnP, btnS, plus ~10 handlers. Threading is a ~40-prop contract. **Deferred until the state layer is stable.** |
| `CalendarTab` | Same class — wide closure. |
| `WeeklyTab` | Same class. |
| `MealsTab` | Same class. |
| `ShoppingTab` | Same class. |
| `HomeTab` | Same class. |
| `BrainTab` | Same class. Also contains `BrainItemRow` defined in its render body (fix first). |
| `BurnoutTab` | Same class. |
| `TidePoolTab` | Same class. |
| `CareerTab` | Same class. |
| `CoveTab` | Same class. |
| `SchoolTab` | Same class. Also has sub-functions defined in its render body. |
| `LighthouseTab` | Same class. Has 12 Area functions as sub-routines. Also gated by `LIGHTHOUSE_V2` (not yet on main — lands with lh-2 merge). |

### Modals (all close over auth + UI state)

| Component | Blocker |
|-----------|---------|
| `AuthModal` | Closes over `signUp`, `signIn`, `setAuthToken`, `setAuthUser`, etc. |
| `HouseholdModal` | Closes over `householdId`, `authToken`, sync functions. |
| `GoogleCalendarModal` | Closes over `googleCalToken`, `connectedCals`, sync. |
| `CalEventFormModal` | Closes over `calFormMode`, `calFormInit`, `calEvents`, `setCalEvents`, `people`. |
| `SetPasswordModal` | Closes over `resetToken`, auth. |
| `DailyBriefingModal` | Closes over `dayBriefing`, `tasks`, `calEvents`, `meals`. |
| `EndOfDayReset` | Closes over `tasks`, `setTasks`, `dayClosed`, `meals`. |

### FlowWrapper

| Blocker |
|---------|
| Owns `openGroup` — the accordion state landmine. `openGroup` is read by FlowWrapper's render and by `homeFlowRef`-based navigation. It must stay in FlowWrapper. Therefore FlowWrapper **cannot** be split until its own size justifies a separate file, and even then the split must preserve `openGroup` ownership. |
| `FlowWrapper` also renders `<HomeFlow>` — it can't be extracted until HomeFlow is stable as an importable component (currently not — HomeFlow reads module-scope singletons). |

### `App` (export default)

Class C — depends on `FlowWrapper` and Supabase session. Move last, if at all (it's 70 lines).

### `homeFlowRef`

Class C — mutable shared object between `HomeFlow` (writes `tab`, `goTab`) and `FlowWrapper` (reads both). Must remain module-scope co-located with `HomeFlow` or replaced with a proper context/callback pattern. **Do not move without redesigning the bridge.** The bridge exists specifically to avoid prop-drilling tab control through FlowWrapper → HomeFlow; introducing a context here would be an architectural change, not a pure extraction.

---

## Summary counts

| Class | Count |
|-------|-------|
| A — movable now | ~35 (functions/constants/utils/small components) |
| B — needs threading | ~25 (module-scope components + _hfRenders atoms) |
| C — deferred | ~30 (tab components, modals, sync, hooks core) |

---

## Pre-extraction checklist (per batch)

Before moving any file:
1. Confirm the component appears in `RF0_COMPONENT_MAP.md` with a line number.
2. Confirm its movability class in this document.
3. For Class B: confirm the prop-threading commit is merged and tests are green.
4. Run `npx esbuild src/App.jsx --target=es2019 --loader:.jsx=jsx --outfile=/dev/null` — zero warnings.
5. Run `npm test` — 260/263 or better.
6. Run `npm run build` — bundle delta < 5 kB gzip.
