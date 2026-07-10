# RF0 — Component Map

> **Rule:** This file maps what exists on `main` as of 2026-07-09 (14,172 lines). The `lh-2` branch extends `LighthouseTab` significantly; update after merge.

---

## Already-extracted files (not in App.jsx)

| File | Feature area |
|------|-------------|
| `src/components/ExhaleSection.jsx` | Flow / Exhale (Brain Dump) |
| `src/components/RippleTab.jsx` | Ripples |
| `src/components/AnchorVault.jsx` | Anchor (vault shell) |
| `src/components/RecipesTab.jsx` | Anchor / Meals |
| `src/components/AuthScreen.jsx` | Auth |
| `src/shell/TodayBriefing.jsx` | Today / Compass |
| `src/shell/CompassFab.jsx` | Today / Compass |
| `src/shell/NudgeStrip.jsx` | Today / Compass |
| `src/shell/WeeklyReviewCard.jsx` | Today / Compass |
| `src/shell/PrepCard.jsx` | Today / Compass |
| `src/shell/SunsetClose.jsx` | Today / Compass |
| `src/shell/FlowHome.jsx` | Flow pillar home |
| `src/shell/SafeHarbor.jsx` | Anchor / Safe Harbor |
| `src/shell/RipplesRoom.jsx` | Ripples |
| `src/compass/compassEngine.js` | Compass AI |
| `src/compass/compassPrompts.js` | Compass AI |
| `src/sync-core.js` | Sync (SYNC_KEYS, sanitize, applyHouseholdKey) |

---

## Module-scope definitions in App.jsx

### Custom hooks (module scope)

| Name | Lines | Notes |
|------|-------|-------|
| `useRippleNotifications` | 21–59 | Owns `notifications`, `loading` state; polls Supabase RPC |
| `usePushNotifications` | 72–133 | Owns `permission`, `subscribed`, `subError`; calls `sbFetch` |
| `useSaved` | 2044–2090 | **Critical singleton.** Backs all persisted state via `_afHydrating` + `_DIRTY_EXCLUDE`. Must stay at module scope. |

### Class components (module scope)

| Name | Lines | Feature area |
|------|-------|-------------|
| `RootErrorBoundary` | 341–363 | Shared / error handling |
| `SectionErrorBoundary` | 368–388 | Shared / error handling |

### Functional components (module scope)

| Name | Lines | Props | Text inputs? | Feature area |
|------|-------|-------|-------------|-------------|
| `RippleNotificationBanner` | 157–256 | — (reads from custom hooks) | No | Ripples / Today |
| `AnchorLogo` | 764–775 | `size`, `color` | No | Shared UI |
| `CompassIcon` | 776–785 | `size`, `color` | No | Shared UI |
| `ScrollTabs` | 789–831 | `children`, `style` | No | Shared UI |
| `Icon` | 833–858 | `name`, `size`, `color` | No | Shared UI |
| `Section` | 866–884 | `id`, `emoji`, `title`, `sub`, `children`, `defaultOpen`, `settingsOpen`, `toggleSetting`, `T` | No | Shared UI |
| `BrainCatsEditor` | 887–932 | `brainCats`, `setBrainCats`, `T`, `inp`, `btnP` | Yes (`newCatName`, `editCatName`) | Settings |
| `WeeklyRhythmSection` | 935–994 | `rhythm`, `setRhythm`, `T`, `inp`, `btnP`, `btnS`, `lbl`, `ModalBox` | Yes (day theme/emoji/desc) | Settings |
| `TidePoolSection` | 996–1146 | `people`, `coveData`, `setCoveData`, `T`, `inp`, `btnP`, `btnS` | Yes (chore name, treasure name) | Settings (renders Tide Pool config) |
| `FamilySection` | 1147–1252 | `people`, `setPeople`, `familyProfile`, `setFamilyProfile`, `T`, `inp`, `btnP`, `PC`, `ROLES` | Yes (name, birthday, etc.) | Settings |

### Utility functions (module scope)

| Name | Lines | Notes |
|------|-------|-------|
| `urlBase64ToUint8Array` | 65–70 | PWA push helper |
| `getInitials` | 153–155 | Display util |
| `sbFetch` | 441–475 | Supabase fetch wrapper |
| `sbAuth` | 477–482 | Auth helper |
| `sbSignOut` | 484–486 | Auth helper |
| `readHouseholdState` | 490–497 | Compass test helper |
| `ageFromBirthday` | 522–532 | People util |
| `personAge` | 534 | People util |
| `personIsMinor` | 535 | People util |
| `getThisMonday` | 537–542 | Date util |
| `getPersonColor` | 554–557 | Display util |
| `getWorkDays` / `saveWorkDays` | 558–563 | localStorage helpers (not in SYNC_KEYS) |
| `getDaysInMonth` / `getFirstDayOfMonth` | 860–861 | Date util |
| `refreshAuthToken` | 1697–1742 | Auth; module-scope singleton with `_refreshInFlight` mutex |
| `_afEndHydration` | 2019 | Hydration guard helper |
| `markKeyDirty` | 2031–2041 | Dirty-flag helper |

### Module-scope singletons / flags / constants

| Name | Lines | Notes |
|------|-------|-------|
| `AF_DEBUG` | 1 | Build flag |
| `VAPID_PUBLIC_KEY` | 63 | PWA constant |
| `RIPPLE_ACTION_MAP` | 136–151 | Ripple action config |
| `SUPABASE_URL`, `SUPABASE_KEY` | 394–395 | API config |
| `_afFetch`, `_afReadToken`, `_afCooldown`, `_afCooldownResponse` | 398–417 | Fetch intercept for Claude proxy |
| `APP_VERSION` | 503 | Build tag |
| `_swReloadFired` | 507 | SW reload guard |
| `_afUserInitiatedSignOut` | 513 | Sign-out intent flag |
| `SHOPPING_V2` | 514 | Feature flag |
| `LIGHTHOUSE_V2` | 517 | Feature flag |
| `TODAY`, `DAY_NAMES`, `TODAY_NAME` | 515–517 | Date constants |
| `FORMAT_DATE`, `FORMAT_SHORT` | 518–519 | Formatters |
| `uid` | 520 | ID generator |
| `TREASURE_ICONS` | 544 | Cove data |
| `WEEKDAYS_SUN` | 545 | Calendar data |
| `PERSON_COLORS`, `PERSON_COLOR_DEFAULT` | 546–553 | Theme data |
| `THEMES` | 565–602 | Theme objects (calm / coastal / night) |
| `FLOW_MODES_FN`, `DIETARY_META_FN` | 604–652 | Theme-derived configs |
| `DEFAULT_RHYTHM`, `DEFAULT_MEAL_THEMES` | 610–628 | Default data |
| `THEME_PRESETS` | 630–643 | Settings data |
| `HOME_SYSTEMS_DEFAULT` | 654–658 | Home systems data |
| `BURNOUT_TASKS`, `BRAIN_BUCKETS`, `BRAIN_CATS` | 660–681 | Feature data |
| `TABS`, `PRIMARY_TABS`, `MORE_TABS` | 683–698 | Nav config |
| `CAL_SOURCES`, `CAL_COLOR_OPTIONS` | 700–711 | Calendar data |
| `MEAL_BANK_DATA`, `WEEK_TYPE_PRESETS`, `MEAL_TAG_FILTERS` | 714–749 | Meals data |
| `GTK_QUESTIONS` | 751–762 | Onboarding data |
| `homeFlowRef` | 863 | **Mutable shared ref** — bridges FlowWrapper nav → HomeFlow tab state |
| `_afHydrating`, `_DIRTY_EXCLUDE` | 2018, 2030 | Dirty-flag internals |
| `_hfRenders`, `_hfComps` | 2094–2115 | Component registry (see below) |
| `LighthouseTab` (alias) | 2114 | Module-scope alias for `_hfComps.LighthouseTab` |
| `_refreshInFlight` | 1696 | Token refresh mutex |

---

## HomeFlow (lines 2116–~13840)

`HomeFlow` is the monolith's main component. It owns all persisted app state via `useSaved`. Every `_hfRenders.X` component is a fresh closure per render, pointing to a stable `_hfComps.X` wrapper so React never remounts them.

### `_hfRenders` / `_hfComps` component registry

All the following are defined inside `HomeFlow`'s render body and assigned to `_hfRenders[name]`. They close over **all** HomeFlow state. Their identity is stable via `_hfComps[name]`.

| Name | Start line | Text inputs? | Feature area |
|------|-----------|-------------|-------------|
| `Pill` | 4318 | No | Shared UI |
| `SecHead` | 4322 | No | Shared UI |
| `ModalBox` | 4351 | No | Shared UI |
| `PersonPill` | 4371 | No | Shared UI |
| `AnchorCheckItem` | 4382 | No (but opens inline notification form) | Shared / Today |
| `TaskRow` | 4431 | Yes (edit task text) | Shared / Today |
| `DraggableTaskList` | 4505 | No (contains TaskRow) | Shared / Today |
| `ShopItemRow` | 4532 | Yes (edit item text) | Anchor / Shopping |
| `BrainItemRow` | 4577 | Yes (edit item text) | Flow / Exhale |
| `AIChatPanel` | 4625 | Yes (chat input) | Today / Compass |
| `TodaySnapshot` | 4715 | No | Today |
| `OnboardingWizard` | 4754 | Yes (multiple) | Shared / Onboarding |
| `DailyBriefingModal` | 4935 | No | Today / Compass |
| `EndOfDayReset` | 4990 | Yes (reflection textarea) | Today / Compass |
| `AnchorTab` | 5136 | Yes (personal anchors) | Today |
| `CalendarTab` | 6032 | Yes (event forms) | Flow / Calendar |
| `WeeklyTab` | 6415 | Yes (weekly goals) | Flow |
| `MealBankDrawer` | 6743 | No | Anchor / Meals |
| `WeekTypePicker` | 6806 | No | Anchor / Meals |
| `MealsTab` | 6920 | Yes (meal names) | Anchor / Meals |
| `ShoppingTab` | 7711 | Yes (item add) | Anchor / Shopping |
| `HomeTab` | 8110 | Yes (system items) | Anchor / Home |
| `BrainTab` | 8208 | Yes (brain items) | Flow / Exhale |
| `BurnoutTab` | 8559 | No | Today |
| `TidePoolTab` | 8617 | Yes (chore name) | Flow / Tide Pool |
| `SettingSection` | 8883 | No | Settings |
| `CareerTab` | 8896 | Yes | Anchor / Career |
| `ItemRow` | 8949 | Yes | Shared |
| `CoveTab` | 9017 | Yes | Anchor / Cove |
| `SchoolTab` | 9781 | Yes | Flow / School |
| `LighthouseTab` | 10908 | Yes | Flow / Lighthouse |
| `GoogleCalendarModal` | 12925 | No | Flow / Calendar |
| `AuthModal` | 13131 | Yes (email, password) | Auth |
| `HouseholdModal` | 13309 | No | Sync / Settings |
| `CalEventFormModal` | 13401 | Yes (event title, note) | Flow / Calendar |
| `SetPasswordModal` | 13513 | Yes (password fields) | Auth |

### Functions defined inside SettingsTab (not in `_hfRenders`)

| Name | Lines | Notes |
|------|-------|-------|
| `Sec` | ~1271 | Local alias for `Section` with bound props |
| `Row` | ~1273 | Settings layout primitive |
| `Toggle` | ~1286 | Toggle button |
| `Pills` | ~1293 | Pill selector |

### Area functions inside LighthouseTab (called as `AreaName()`, not `<AreaName/>`)

These are plain functions — not React components — called inline in LighthouseTab's return. They close over all LighthouseTab state (`lhSubTab`, `lighthouse`, `activeChild`, etc.) and use hooks-via-closure (no hooks of their own).

| Name | Start line | Feature area |
|------|-----------|-------------|
| `BooksArea` | 11145 | Lighthouse / Books |
| `BeyondArea` | 11244 | Lighthouse / Beyond |
| `TripsArea` | 11322 | Lighthouse / Trips |
| `GoalsArea` | 11404 | Lighthouse / Goals |
| `HomeworkArea` | 11582 | Lighthouse / Homework (school mode) |
| `ThisWeekArea` | 11681 | Lighthouse / This Week (school mode) |
| `SchoolCommsArea` | 11859 | Lighthouse / School Comms |
| `GradesArea` | 12025 | Lighthouse / Grades |
| `SummariesArea` | 12151 | Lighthouse / Summaries/Keepsakes |
| `PlanArea` | 12246 | Lighthouse / Plan (homeschool) |
| `LoopsArea` | 12559 | Lighthouse / Loops (homeschool) |
| `OverviewArea` | 12764 | Lighthouse / Overview |

---

## FlowWrapper (lines 13946–~14100)

`FlowWrapper` wraps the sidebar nav + `HomeFlow`. It owns:
- `openGroup` — accordion open state (**landmine: must NOT travel with any feature**)
- `navSel` — sidebar selection highlight
- `activeTab` — local mirror of HomeFlow tab (syncs via `homeFlowRef`)
- `sections` — read from localStorage to hide sections from nav
- `showAnchor` — whether AnchorVault overlay is visible
- `vaultSection` — which vault sub-section to show
- `anchorHidden` — per-section hide flags

`FlowWrapper` renders:
- Sidebar nav (accordion, four pillars)
- `<AnchorVault>` (imported component)
- `<HomeFlow>` (wrapped in `<RootErrorBoundary>`)

---

## App (lines ~14100–14172, export default)

Top-level component. Owns session state (`session`, `mode`). Handles Supabase `onAuthStateChange`. Renders either `<AuthScreen>` or `<FlowWrapper>`.

---

## Render tree (simplified)

```
App
└── FlowWrapper
    ├── AnchorVault          (imported, when showAnchor)
    └── HomeFlow             (monolith)
        ├── [tab content rendered via display:none trick]
        │   ├── AnchorTab       (_hfRenders)
        │   ├── FlowHome        (imported from shell/)
        │   ├── CalendarTab     (_hfRenders)
        │   ├── WeeklyTab       (_hfRenders)
        │   ├── MealsTab        (_hfRenders)
        │   ├── ShoppingTab     (_hfRenders)
        │   ├── TidePoolTab     (_hfRenders)
        │   ├── CoveTab         (_hfRenders)
        │   ├── HomeTab         (_hfRenders)
        │   ├── ExhaleSection   (imported, when tab=brain)
        │   ├── SchoolTab       (_hfRenders)
        │   ├── LighthouseTab   (_hfRenders, LIGHTHOUSE_V2 gate)
        │   │   ├── OverviewArea()    (function call, not JSX)
        │   │   ├── BooksArea()
        │   │   ├── BeyondArea()
        │   │   ├── TripsArea()
        │   │   ├── GoalsArea()
        │   │   ├── PlanArea()
        │   │   ├── LoopsArea()
        │   │   ├── HomeworkArea()
        │   │   ├── ThisWeekArea()
        │   │   ├── SchoolCommsArea()
        │   │   ├── GradesArea()
        │   │   └── SummariesArea()
        │   ├── CareerTab       (_hfRenders)
        │   ├── SettingsTab     (module-scope, receives ~30 props)
        │   │   ├── FamilySection      (module-scope)
        │   │   ├── WeeklyRhythmSection (module-scope)
        │   │   ├── TidePoolSection    (module-scope)
        │   │   └── BrainCatsEditor    (module-scope)
        │   └── RippleTab       (imported)
        ├── [overlays]
        │   ├── ModalBox        (_hfRenders, conditional)
        │   ├── AuthModal       (_hfRenders)
        │   ├── HouseholdModal  (_hfRenders)
        │   ├── GoogleCalendarModal (_hfRenders)
        │   ├── CalEventFormModal   (_hfRenders)
        │   ├── SetPasswordModal    (_hfRenders)
        │   ├── DailyBriefingModal  (_hfRenders)
        │   └── EndOfDayReset   (_hfRenders)
        └── [shell components, imported]
            ├── TodayBriefing
            ├── CompassFab
            ├── NudgeStrip
            ├── WeeklyReviewCard
            ├── PrepCard
            └── SunsetClose
```

---

## Known rule violations (record, do not fix in RF-0)

1. **`FRow` defined inside `FamilySection` render** (line ~1160). `FRow` is a tiny layout primitive that does not own text inputs. Low risk since it has no hooks. Still violates the "define at module scope" rule. Flag for RF-3 cleanup.

2. **`Sec`, `Row`, `Toggle`, `Pills` defined inside `SettingsTab` render** (~lines 1271–1293). These are simple wrappers with no inputs or hooks. Same caveat as above. Flag for RF-3.

3. **`TRow` defined inside `DailyBriefingModal` render** (~line 4701). Display-only. Same class.

4. **`BrainItemRow` defined inside `BrainTab` render** (~line 7926). This is a text-input row (in-place editing). Violates the text-input rule. However, BrainTab is a closure component so React never re-creates it unless the monolith changes; the stable `_hfComps` wrapper mitigates the mount risk. Note for RF extraction — it must move to module scope before the file split.

5. **`Celebration`, `TypePicker`, `PublicOverview`, `PublicTeachers`, `PublicSchedule`, `PublicCalendar`, `SpiritDays`, `HSOverview`, `HSUmbrella`, `HSCurricula`, `HSLessons`, `HSAttendance`, `HSActivities`, `BreakModePanel`** — inner functions inside `SchoolTab` render (~lines 9393–10570). Some own text inputs. Flag for SchoolTab batch.
