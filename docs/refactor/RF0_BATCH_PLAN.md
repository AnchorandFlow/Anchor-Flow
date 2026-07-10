# RF0 — Batch Extraction Plan

## The pure-move rule

**Every extraction commit must be a pure move: cut, paste, add imports, nothing else.**

No renames, no prop changes, no dependency-array fixes, no cleanups, no reformatting. If you see something broken while cutting, file a separate fix commit first (before the move), or leave it for a dedicated cleanup batch. This rule exists so every extraction commit is trivially reviewable as a diff — the only change is that bytes moved from one file to another.

---

## Directory structure (target)

```
src/
  components/         ← shared UI atoms (already partially populated)
  shell/              ← already exists (FlowWrapper, etc.)
  compass/            ← already exists
  features/
    flow/             ← HomeFlow + tab components (future, not RF-1 through RF-5)
    anchor/
    ripples/
    compass/
    safe-harbor/
  hooks/              ← extracted hooks
  services/           ← sbFetch, sbAuth, sbSignOut, refreshAuthToken
  storage/            ← useSaved (when ready — Class C)
  sync/               ← sync internals (when ready — Class C)
  constants/          ← pure data constants
  utils/              ← pure functions
```

---

## RF-1 — Constants and pure utils

**Class A only. Zero risk.**

Goal: move all pure data and utility functions out of App.jsx. No React code touched. This shrinks the monolith without changing any component behavior.

### What moves

| File | Contents |
|------|----------|
| `src/constants/themes.js` | `THEMES`, `FLOW_MODES_FN`, `DIETARY_META_FN` |
| `src/constants/rhythm.js` | `DEFAULT_RHYTHM`, `DEFAULT_MEAL_THEMES`, `THEME_PRESETS` |
| `src/constants/home.js` | `HOME_SYSTEMS_DEFAULT` |
| `src/constants/tasks.js` | `BURNOUT_TASKS` |
| `src/constants/brain.js` | `BRAIN_BUCKETS`, `BRAIN_CATS` |
| `src/constants/nav.js` | `TABS`, `PRIMARY_TABS`, `MORE_TABS` |
| `src/constants/calendar.js` | `CAL_SOURCES`, `CAL_COLOR_OPTIONS` |
| `src/constants/meals.js` | `MEAL_BANK_DATA`, `WEEK_TYPE_PRESETS`, `MEAL_TAG_FILTERS` |
| `src/constants/onboarding.js` | `GTK_QUESTIONS` |
| `src/constants/people.js` | `PERSON_COLORS`, `PERSON_COLOR_DEFAULT` |
| `src/constants/ripple.js` | `RIPPLE_ACTION_MAP` |
| `src/constants/misc.js` | `TREASURE_ICONS`, `WEEKDAYS_SUN` |
| `src/utils/dates.js` | `DAY_NAMES`, `FORMAT_DATE`, `FORMAT_SHORT`, `getThisMonday`, `getDaysInMonth`, `getFirstDayOfMonth` |
| `src/utils/people.js` | `getInitials`, `getPersonColor`, `ageFromBirthday`, `personAge`, `personIsMinor` |
| `src/utils/misc.js` | `uid`, `urlBase64ToUint8Array`, `weatherEmoji` |

### Steps

1. Create each target file. Paste the constant/function verbatim. Export it.
2. In App.jsx, replace the definition with an import. Do NOT change any call sites.
3. Run `npm test` → must be 260/263.
4. Run `npm run build` → bundle delta < 5 kB gzip.
5. Commit: `RF-1: extract constants and pure utils to src/constants/ and src/utils/`

### Watch-outs

- `TABS` / `PRIMARY_TABS` / `MORE_TABS` are read at module scope in App.jsx AND in FlowWrapper — confirm both import from the same new file after move.
- `PERSON_COLORS` must move together with `getPersonColor` (function depends on the constant).
- `weatherEmoji` is defined inside HomeFlow render body — lift to module scope first in a separate commit, then move to utils.

---

## RF-2 — Service extraction

**Class A. Zero React dependency.**

Goal: extract Supabase API functions so they can be shared by hooks and components without importing App.jsx.

### What moves

| File | Contents |
|------|----------|
| `src/services/api.js` | `SUPABASE_URL`, `SUPABASE_KEY`, `supabase` (client), `sbFetch`, `sbAuth`, `sbSignOut` |

### Steps

1. Create `src/services/api.js`. Paste all six items verbatim. Export each.
2. In App.jsx, replace inline definitions with imports from `./services/api`.
3. `useRippleNotifications` and `usePushNotifications` already call these — update their call sites to import from `./services/api` (no logic change).
4. Run tests + build. Commit: `RF-2: extract Supabase service layer to src/services/api.js`

### Watch-outs

- `supabase` client creation uses env vars at module scope — confirm `import.meta.env` works in the new file location (Vite handles this by relative path, not by file location, so it should be fine).
- `sbSignOut` calls `supabase.auth.signOut()` — must import `supabase` from the same file, not re-create a second client.

---

## RF-3 — Shared UI atoms

**Class A. No state dependencies.**

Goal: move the small, pure UI components that are currently at module scope in App.jsx into `src/components/`.

### What moves

| File | Contents |
|------|----------|
| `src/components/AnchorLogo.jsx` | `AnchorLogo` (764) |
| `src/components/CompassIcon.jsx` | `CompassIcon` (776) |
| `src/components/ScrollTabs.jsx` | `ScrollTabs` (789) |
| `src/components/Icon.jsx` | `Icon` (833) |
| `src/components/Section.jsx` | `Section` (866) |
| `src/components/ErrorBoundaries.jsx` | `RootErrorBoundary` (341), `SectionErrorBoundary` (368) |

### Steps

1. Create each file. Paste component verbatim. Export it.
2. In App.jsx, remove definition and add import.
3. `Icon` depends on an SVG map object — move the map with it.
4. `RootErrorBoundary` references `errorCode` from sync-core.js — import from there.
5. Run tests + build. Commit: `RF-3: extract shared UI atoms to src/components/`

### Watch-outs

- `ScrollTabs` uses `useRef` and `useState` — these are React imports, bring them along. Confirm the new file has `import React` if needed (Vite JSX transform handles it, but double-check).
- `Section` likely receives children and style props — confirm no implicit module-scope dep before moving.

---

## RF-4 — `usePointerDrag` hook

**Class A.**

| File | Contents |
|------|----------|
| `src/hooks/usePointerDrag.js` | `usePointerDrag` (13850) |

Steps: paste verbatim, import in App.jsx, run tests, commit.

---

## RF-5 — Settings cluster (Class B → A after prep)

**Class B. Must do prop-threading prep first.**

Goal: extract `SettingsTab`, `FamilySection`, `WeeklyRhythmSection`, `TidePoolSection`, and `BrainCatsEditor` to `src/features/settings/`.

### Prep commits (still inside App.jsx — no files created yet)

1. **Lift inner helpers to module scope.** In `SettingsTab`, the inner `Sec`, `Row`, `Toggle`, `Pills` components are defined in the render body. Move them to module scope (pure move within the same file). Commit: `RF-5-prep-a: lift SettingsTab inner helpers to module scope`
2. **Lift FRow.** In `FamilySection`, `FRow` is defined in the render body. Move to module scope within App.jsx. Commit: `RF-5-prep-b: lift FRow to module scope in App.jsx`
3. After each prep commit: run smoke checklist S2 (continuous typing) and S11 (console). Settings inputs are the highest-risk area.

### What moves (after prep)

| File | Contents |
|------|----------|
| `src/features/settings/BrainCatsEditor.jsx` | `BrainCatsEditor` (887) |
| `src/features/settings/WeeklyRhythmSection.jsx` | `WeeklyRhythmSection` (935) |
| `src/features/settings/TidePoolSection.jsx` | `TidePoolSection` (996) |
| `src/features/settings/FamilySection.jsx` | `FamilySection` (1147) + `FRow` |
| `src/features/settings/SettingsTab.jsx` | `SettingsTab` (1253) + inner helpers |

All five components already receive their data via props — no new prop-threading needed after the inner-helper lifts.

Commit: `RF-5: extract Settings cluster to src/features/settings/`

### Watch-outs

- `WeeklyRhythmSection` receives `ModalBox` as a prop (it's an `_hfRenders` component). Keep the prop interface — do NOT inline `ModalBox` into the new file.
- `TidePoolSection` calls `uid()` and reads `TODAY` — import from `src/utils/misc.js` and `src/utils/dates.js` (already extracted in RF-1).
- `SettingsTab` receives ~30 props. After the move, the prop list is the public API — resist the urge to "clean up" props that look unused. They may be used conditionally.

---

## RF-6 — `_hfRenders` display atoms (prop-threading pass)

**Class B → A. Two-phase batch.**

Goal: eliminate the T-closure on `Pill`, `SecHead`, `PersonPill`, and `ModalBox` so they become truly movable.

### Phase 6a — thread T as prop (still inside App.jsx)

For each of the four components:
1. Add `T` to the component's parameter destructuring.
2. Update every call site within App.jsx to pass `T` as a prop.
3. Remove the closed-over `T` reference.

Do one component at a time. Commit each: `RF-6a: thread T prop on Pill`, `RF-6a: thread T prop on SecHead`, etc.

`PersonPill` additionally closes over `people` — thread `people` at the same time.

Run smoke S2 and S11 after each commit.

### Phase 6b — move to src/components/ (after 6a is complete and tests green)

| File | Contents |
|------|----------|
| `src/components/Pill.jsx` | `Pill` |
| `src/components/SecHead.jsx` | `SecHead` |
| `src/components/PersonPill.jsx` | `PersonPill` |
| `src/components/ModalBox.jsx` | `ModalBox` |

Commit: `RF-6: move display atoms to src/components/ (after T prop threading)`

### Watch-outs

- `ModalBox` uses a `useEffect` on `body.style.overflow` — confirm the effect still fires correctly after the move. It is a self-contained effect and should be fine.
- The `_hfRenders` wrapper for each component (`_hfComps.Pill`, etc.) must continue to delegate to `_hfRenders.Pill(props)` — the wrapper stays in App.jsx pointing at the extracted component.

---

## RF-7 — Simple item rows (Class B → A)

**Class B → A. Same two-phase approach as RF-6.**

Target components: `ShopItemRow`, `ItemRow`, `MealBankDrawer`.

These close over `T`, `inp`, `btnP`, `btnS`. After RF-6, T-threading is established. Apply the same pattern.

Phase 7a: thread props on all three. Phase 7b: move to `src/components/`.

Commit: `RF-7: extract simple item row components to src/components/`

---

## RF-8 — Auth service and token refresh

**Class A/B hybrid.**

| File | Contents |
|------|----------|
| `src/services/auth.js` | `refreshAuthToken`, `_refreshInFlight` (mutex) |

Steps:
1. Move `_refreshInFlight` to module scope of the new file (it is already at module scope in App.jsx — pure cut).
2. Move `refreshAuthToken` verbatim. Export it.
3. In App.jsx, import from `./services/auth`.
4. `_afUserInitiatedSignOut` is NOT moved here — it stays in App.jsx (it's read by the Supabase `onAuthStateChange` listener which is inside HomeFlow).

Commit: `RF-8: extract auth token refresh to src/services/auth.js`

---

## RF-9 and beyond — deferred

These batches require architectural decisions or LH-7 resolution before they can be planned:

| Batch | Scope | Prerequisite |
|-------|-------|-------------|
| RF-9 | `TaskRow`, `AnchorCheckItem`, `DraggableTaskList` | All three close over notifications + task handlers. Thread notifications as a prop or introduce a context. Architectural decision needed. |
| RF-10 | `AIChatPanel` | Very wide closure (auth + AI memory + all feature state). Consider a dedicated AI context provider first. |
| RF-11 | `useSaved` + dirty-flag system | Class C. Move only when SettingsTab and HomeFlow both import from the new location. Risky — must be atomic. |
| RF-12 | Sync internals | Class C. Move together: `pushHouseholdData`, `pullLatestHouseholdData`, `debouncedSync`, `syncNow`, `isRemotePayloadSafe`, `createLocalBackup`. Requires threading all auth+sync state — or a context. |
| RF-13 | Tab components | Class C. Move after sync internals are stable. Each tab is its own batch. |
| RF-14 | `LighthouseTab` + Area functions | Class C. Wait for lh-2 to merge to main. Area functions are plain functions, not React components — move them as a sub-module of the tab file. |
| RF-15 | `FlowWrapper` | Class C. Move only when HomeFlow is a stable importable module. `openGroup` stays in this file. |

---

## Batch sequencing diagram

```
RF-1 (constants/utils)
  ↓
RF-2 (services/api)
  ↓
RF-3 (UI atoms) ──── RF-4 (usePointerDrag) [parallel with RF-3]
  ↓
RF-5 (Settings cluster, needs RF-1 utils imported)
  ↓
RF-6 (display atoms: T-threading + move)
  ↓
RF-7 (item rows)
  ↓
RF-8 (auth service)
  ↓
  [decision gate: RF-9+ require architectural choices]
```

Total lines removed from App.jsx after RF-1 through RF-8: estimated 3,000–4,500 lines (~25–30% of current 14,172). The largest concentration (tabs, modals, sync internals) remains in the deferred batches.

---

## What does NOT change in RF-1 through RF-8

- `_hfRenders` / `_hfComps` pattern — wrapper functions stay in App.jsx.
- `homeFlowRef` — stays at module scope in App.jsx.
- `useSaved` — stays at module scope in App.jsx.
- `_afHydrating` — stays co-located with `useSaved`.
- All sync functions defined inside HomeFlow — stay inside HomeFlow.
- `openGroup` in FlowWrapper — stays in FlowWrapper.
- All tab components — stay inside HomeFlow.
- `meals` custom setter — stays inside HomeFlow.
