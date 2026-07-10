# RF0 — State Ownership

> All state is in `HomeFlow` unless noted otherwise. "useSaved" means the value is persisted to localStorage via `useSaved(key, fallback)` and included in the household sync blob if the key is in `SYNC_KEYS`.

---

## Module-scope singletons (do not duplicate across modules)

| Name | Type | Purpose | Breakage risk if duplicated |
|------|------|---------|---------------------------|
| `_afHydrating` | `let boolean` | Suppresses dirty-marking during mount hydration | Duplicating would create a second flag that never gets cleared by `_afEndHydration`, causing infinite sync loops |
| `_DIRTY_EXCLUDE` | `const array` | Keys that must never trigger a sync push | Second copy could diverge, causing system keys to be pushed |
| `_hfRenders` | `{}` | Render delegate registry — filled each HomeFlow render | Only one registry must exist; a second copy would produce stale/undefined components |
| `_hfComps` | `{}` | Stable wrapper registry (same identity across renders) | Each entry must be the same function reference every render; a second copy gives React a new type, causing full remounts |
| `LighthouseTab` alias | `var` | Module-scope alias for `_hfComps.LighthouseTab` | If extracted to another module, the alias must import from the same `_hfComps` registry |
| `homeFlowRef` | `{ tab, goTab }` | Mutable bridge: FlowWrapper reads the active tab and calls `goTab` | Shared mutable object; must remain module-scope so FlowWrapper and HomeFlow touch the same reference |
| `_refreshInFlight` | `null \| Promise` | Token-refresh mutex | Two instances would both fire refresh requests; second could overwrite the first token |
| `_swReloadFired` | `boolean` | Service-worker reload gate | Page-lifetime flag; must be module-scope |
| `_afUserInitiatedSignOut` | `boolean` | Controls data-wipe on SIGNED_OUT | Must be set before Supabase fires the event; can't be React state |
| `LIGHTHOUSE_V2`, `SHOPPING_V2` | `boolean` | Feature flags (localStorage at load time) | Computed once at module eval — duplication in a different module would read localStorage twice; harmless but confusing |

---

## HomeFlow state

### Auth / sync state

| State | Hook | localStorage key | In SYNC_KEYS? | Consumers |
|-------|------|-----------------|--------------|----------|
| `authToken` | `useSaved("authToken", null)` | `af_authToken` | No | sync functions, `sbFetch`, `pushHouseholdData`, `pullLatestHouseholdData`, `signOut` |
| `authUser` | `useSaved("authUser", null)` | `af_authUser` | No | SettingsTab, greeting, dayClosed key, personalAnchors key |
| `householdId` | `useSaved("householdId", null)` | `af_householdId` | No | `pushHouseholdData`, `pullLatestHouseholdData`, `debouncedSync`, `syncNow` |
| `householdOwnerId` | `useSaved("householdOwnerId", null)` | `af_householdOwnerId` | No | HouseholdModal |
| `syncStatus` | `useState("idle")` | — | — | Settings sync indicator |
| `lastSyncTime` | `useState(null)` | — | — | Settings sync indicator |
| `showAuthModal` | `useState(false)` | — | — | AuthModal visibility |
| `showHouseholdModal` | `useState(false)` | — | — | HouseholdModal visibility |
| `googleCalToken` | `useSaved("googleCalToken", null)` | `af_googleCalToken` | No | GoogleCalendarModal |
| `googleCalSyncing` | `useState(false)` | — | — | GoogleCalendarModal |
| `googleCalError` | `useState("")` | — | — | GoogleCalendarModal |
| `showSetPassword` | `useState(…)` | — | — | SetPasswordModal (from URL hash) |
| `resetToken` | `useState(…)` | — | — | SetPasswordModal |

### People / profile state

| State | Hook | localStorage key | In SYNC_KEYS? | Consumers |
|-------|------|-----------------|--------------|----------|
| `people` | `useSaved("people", […])` | `af_people` | Yes | AnchorTab, CalendarTab, MealsTab, ShoppingTab, TidePoolTab, CoveTab, SchoolTab, LighthouseTab, SettingsTab, PersonPill, HomeTab |
| `familyProfile` | `useSaved("familyProfile", null)` | `af_familyProfile` | Yes | SettingsTab, weather effect, CompanionBriefing |
| `preferredName` | `useSaved("preferredName", "")` | `af_preferredName` | Yes | Greeting |
| `flowGreetingTone` | `useSaved("flowGreetingTone", "warm")` | `af_flowGreetingTone` | Yes | Greeting |
| `birthdays` | `useSaved("birthdays", [])` | `af_birthdays` | Yes | CalendarTab (injection effect) |

### Tasks state

| State | Hook | localStorage key | In SYNC_KEYS? | Consumers |
|-------|------|-----------------|--------------|----------|
| `tasks` | `useSaved("tasks", [])` | `af_tasks` | Yes | AnchorTab, DraggableTaskList, TaskRow, TodaySnapshot, SettingsTab, carry-over effect |
| `dayClosed` | `useSaved(_dayClosedKey, false)` | `af_dayClosed_{day}_{uid}` | No | AnchorTab (daily close toggle) |
| `personalAnchors` | `useSaved(_personalAnchorsKey, [])` | `af_personalAnchors_{uid}` | No | AnchorTab |
| `checkedPersonalAnchors` | `useSaved(…)` | dynamic | No | AnchorTab |
| `checkedCalEvents` | `useSaved("checkedCalEvents", [])` | `af_checkedCalEvents` | No | AnchorTab, CalendarTab |
| `checkedMealItems` | `useSaved("checkedMealItems", [])` | `af_checkedMealItems` | No | AnchorTab, MealsTab |

### Calendar state

| State | Hook | localStorage key | In SYNC_KEYS? | Consumers |
|-------|------|-----------------|--------------|----------|
| `calEvents` | `useSaved("calEvents", [])` | `af_calEvents` | Yes | AnchorTab, CalendarTab, TodaySnapshot, SettingsTab, DailyBriefingModal, BirthdayEffect |
| `connectedCals` | `useSaved("connectedCals", [])` | `af_connectedCals` | Yes | GoogleCalendarModal, SettingsTab |
| `calColorLabels` | `useSaved("calColorLabels", {})` | `af_calColorLabels` | Yes | CalendarTab, CalEventFormModal |
| `calViewDate` | `useState(new Date())` | — | — | CalendarTab |
| `calMarkers` | `useState(loadCalMarkers)` | `af_cal_markers` (direct write) | No | CalendarTab |
| `calMarkerTypes` | `useState(loadCalMarkerTypes)` | `af_cal_marker_types` (direct write) | No | CalendarTab |
| `markerPickerDate` | `useState(null)` | — | — | CalendarTab |
| `workDays` | `useState(getWorkDays)` | `af_workDays` (direct write) | No | CalendarTab |
| `workDayForm` | `useState({…})` | — | — | CalendarTab |
| `selectedDay` | `useState(null)` | — | — | CalendarTab |
| `calView` | `useState("month")` | — | — | CalendarTab |
| `calFilter` | `useState("all")` | — | — | CalendarTab |
| `calFormMode` | `useState(null)` | — | — | CalEventFormModal |
| `calFormId` | `useState(null)` | — | — | CalEventFormModal |
| `calFormInit` | `useState(null)` | — | — | CalEventFormModal |

### Meals state

| State | Hook | localStorage key | In SYNC_KEYS? | Consumers |
|-------|------|-----------------|--------------|----------|
| `meals` / `setMeals` | custom `useState` + setter | `af_meals` | Yes | MealsTab, AnchorTab, TodaySnapshot, SettingsTab |
| `mealCount` | `useSaved("mealCount", 3)` | `af_mealCount` | Yes | MealsTab, AnchorTab |
| `mealThemeEnabled` | `useSaved("mealThemeEnabled", false)` | `af_mealThemeEnabled` | Yes | MealsTab |
| `mealThemes` | `useSaved("mealThemes", …)` | `af_mealThemes` | Yes | MealsTab |
| `recipes` | `useSaved("recipes", [])` | `af_recipes` | Yes | RecipesTab (imported), MealsTab |
| `mealBankCustom` | `useSaved("mealBankCustom", [])` | `af_mealBankCustom` | Yes | MealsTab, MealBankDrawer |
| `favMeals` | `useSaved("favMeals", [])` | `af_favMeals` | Yes | MealsTab |
| `dietaryFilters` | `useSaved("dietaryFilters", […])` | `af_dietaryFilters` | Yes | MealsTab, MealBankDrawer |
| `wtAiMeals` | `useState(null)` | — | — | WeekTypePicker |
| `wtSelected` | `useState([])` | — | — | WeekTypePicker |
| `weekTypeKey` | `useState(null)` | — | — | WeekTypePicker |
| `showWeekTypePicker` | `useState(false)` | — | — | WeekTypePicker visibility |
| `showRecipeImport` | `useState(false)` | — | — | Recipe import modal |
| `recipeUrl/Loading/Result/Error` | `useState` | — | — | Recipe import |
| `manualRecipe` | `useState({…})` | — | — | Manual recipe form |

### Shopping state

| State | Hook | localStorage key | In SYNC_KEYS? | Consumers |
|-------|------|-----------------|--------------|----------|
| `shoppingItems` | `useSaved("shoppingItems", [])` | `af_shoppingItems` | Yes | ShoppingTab, ShopItemRow |
| `stores` | `useSaved("stores", […])` | `af_stores` | Yes | ShoppingTab, SettingsTab |
| `shopCategories` | `useSaved("shopCategories", […])` | `af_shopCategories` | Yes | ShoppingTab, SettingsTab |
| `collapsedStores` | `useSaved("collapsedStores", {})` | `af_collapsedStores` | Yes | ShoppingTab |

### Home / systems state

| State | Hook | localStorage key | In SYNC_KEYS? | Consumers |
|-------|------|-----------------|--------------|----------|
| `homeSystems` | `useSaved("homeSystems", […])` | `af_homeSystems` | Yes | HomeTab |
| `rhythm` | `useSaved("rhythm", …)` | `af_rhythm` | Yes | WeeklyRhythmSection, WeeklyTab, AnchorTab |
| `sections` | `useSaved("sections", {…})` | `af_sections` | Yes | Nav visibility in HomeFlow and FlowWrapper |

### Brain / Exhale state

| State | Hook | localStorage key | In SYNC_KEYS? | Consumers |
|-------|------|-----------------|--------------|----------|
| `brainItems` | `useSaved("brainItems", [])` | `af_brainItems` | Yes | BrainTab, ExhaleSection (prop) |
| `brainCats` | `useSaved("brainCats", […])` | `af_brainCats` | Yes | BrainTab, BrainCatsEditor |
| `exhaleItems` | `useSaved("exhaleItems", [])` | `af_exhaleItems` | Yes | ExhaleSection (prop) |
| `exhaleLabels` | `useSaved("exhaleLabels", {})` | `af_exhaleLabels` | Yes | ExhaleSection (prop) |

### Cove state

| State | Hook | localStorage key | In SYNC_KEYS? | Consumers |
|-------|------|-----------------|--------------|----------|
| `coveData` | `useSaved("coveData", null)` | `af_coveData` | Yes | CoveTab, TidePoolSection, TidePoolTab |

### Notifications / reminders state

| State | Hook | localStorage key | In SYNC_KEYS? | Consumers |
|-------|------|-----------------|--------------|----------|
| `notifications` | `useSaved("notifications", [])` | `af_notifications` | Yes | AnchorCheckItem, TaskRow, SettingsTab |
| `notifSettings` | `useSaved("notifSettings", {…})` | `af_notifSettings` | Yes | SettingsTab |
| `notifPermission` | `useState(Notification.permission)` | — | — | SettingsTab |
| `dailySummaryScheduled` | `useSaved("dailySummaryScheduled", null)` | `af_dailySummaryScheduled` | No | Notification scheduling |
| `inAppBanner` | `useState(null)` | — | — | In-app toast |
| `staleBanner` | `useState(false)` | — | — | SW update toast |
| `anchorNotifFor` | `useState(null)` | — | — | AnchorCheckItem |

### AI / Compass state

| State | Hook | localStorage key | In SYNC_KEYS? | Consumers |
|-------|------|-----------------|--------------|----------|
| `aiMemory` | `useSaved("aiMemory", {})` | `af_aiMemory` | Yes | AIChatPanel, Compass |
| `dayBriefing` | `useSaved("dayBriefing", null)` | `af_dayBriefing` | No | DailyBriefingModal |
| `briefingBuilt` | `useSaved("briefingBuilt", null)` | `af_briefingBuilt` | No | DailyBriefingModal |
| `insights` | `useSaved("insights", null)` | `af_insights` | No | AnchorTab |
| `insightsBuilt` | `useSaved("insightsBuilt", null)` | `af_insightsBuilt` | No | AnchorTab |
| `dismissedInsights` | `useSaved("dismissedInsights", [])` | `af_dismissedInsights` | No | AnchorTab |
| `compassCache` | `useSaved("compassCache", {})` | `af_compassCache` | No | Compass |
| `chatOpen` | `useState(false)` | — | — | AIChatPanel |
| `insightsLoading` | `useState(false)` | — | — | AnchorTab |
| `expandedInsightReason` | `useState(null)` | — | — | AnchorTab |

### Misc / UI state

| State | Hook | localStorage key | In SYNC_KEYS? | Consumers |
|-------|------|-----------------|--------------|----------|
| `tab` | `useState(sessionStorage)` | `af_activeTab` (session) | — | All tabs (dispatch, nav) |
| `themeName` | `useSaved("theme", "calm")` | `af_theme` | No | All components (T object) |
| `modal` | `useState(null)` | — | — | Generic modal trigger |
| `flowMode` | `useSaved("flowMode", "Smooth")` | `af_flowMode` | Yes | AnchorTab, SettingsTab |
| `weatherData` | `useState(null)` | — | — | AnchorTab |
| `weatherLocation` | `useSaved("weatherLocation", null)` | `af_weatherLocation` | Yes | SettingsTab, weather fetch |
| `burnoutChecked` | `useSaved("burnoutChecked", [])` | `af_burnoutChecked` | Yes | BurnoutTab |
| `schoolData` | `useSaved("schoolData", {})` | `af_schoolData` | Yes | SchoolTab |
| `overwhelmed` | `useSaved("overwhelmed", false)` | `af_overwhelmed` | Yes | AnchorTab / BurnoutTab |
| `captureOpen/Text/Dest/Category` | `useState` | — | — | Quick Capture |
| `personFilter` | `useState("all")` | — | — | AnchorTab |
| `weekSubTab` | `useState("glance")` | — | — | WeeklyTab |
| `moreDrawerOpen` | `useState(false)` | — | — | Mobile tab drawer |
| `newPersonName` | `useState("")` | — | — | People add in SettingsTab |
| `showOnboarding` | `useState(false)` | — | — | Onboarding wizard |
| `onboardStep/Answers` | `useState` | — | — | Onboarding wizard |
| `showWelcomeModal` | `useState(…)` | — | — | Welcome modal |
| `showBriefing` | `useState(false)` | — | — | DailyBriefingModal |
| `showEndOfDay` | `useState(false)` | — | — | EndOfDayReset |
| `showTomorrowPrep` | `useState(false)` | — | — | Prep Card |
| `briefingLoading` | `useState(false)` | — | — | Briefing fetch |
| `sampleDayActive` | `useState(false)` | — | — | Sample day demo |
| `appCelebrate` | `useState(null)` | — | — | Celebration overlay |
| `aiNudgeDismissed` | `useState(false)` | — | — | Compass nudge |
| `showEmailCapture` | `useState(false)` | — | — | Email capture |
| `emailInput` | `useState("")` | — | — | Email input |
| `showRippleFeed` | `useState(false)` | — | — | Ripple feed |
| `onboardingComplete` | `useSaved("onboardingComplete", false)` | `af_onboardingComplete` | Yes | Onboarding |
| `emailSubmitted` | `useSaved("emailSubmitted", false)` | `af_emailSubmitted` | No | Email capture |
| `lastSeenDate` | `useSaved("lastSeenDate", null)` | `af_lastSeenDate` | No | Carry-over effect |
| `showOnboardingWizard` | `useState(false)` | — | — | Onboarding |
| `addingPersonalAnchor` | `useState(false)` | — | — | AnchorTab |
| `newPersonalAnchorText` | `useState("")` | — | — | AnchorTab text input |
| `copied` | `useState(false)` | — | — | Copy feedback |

---

## FlowWrapper state

| State | Notes |
|-------|-------|
| `openGroup` | **Landmine.** Accordion open state. Must not leave FlowWrapper. sessionStorage-persisted for reload. |
| `navSel` | Sidebar selection highlight. sessionStorage-persisted. |
| `activeTab` | Local mirror of HomeFlow's `tab`, updated via `homeFlowRef.goTab`. |
| `sections` | Read from localStorage (af_sections). Syncs via storage event. |
| `showAnchor` | Whether AnchorVault overlay is showing. sessionStorage-persisted. |
| `vaultSection` | Which vault sub-section. sessionStorage-persisted. |
| `anchorHidden` | Per-section hide flags. Read from localStorage. |

---

## Refs

| Name | Owner | Purpose |
|------|-------|---------|
| `syncChannelRef` | HomeFlow | Supabase realtime channel cleanup |
| `syncTimeoutRef` | HomeFlow | `debouncedSync` timer handle |
| `bannerTimerRef` | HomeFlow | In-app banner auto-dismiss timer |
| `lastTypedRef` | HomeFlow | Tracks last user keystroke (prevents reload during typing) |
| `storesRef` | HomeFlow | Stable stores ref for shopping-add event handler |
| `scrollPositions` | HomeFlow | Tab scroll restoration |
| `visitedTabs` | HomeFlow | Lazy-mount: only mount a tab once visited |
| `seenTabs` | HomeFlow | Animation trigger: run entry animation only once |

---

## State consumers summary

The table below shows which high-level state groups each tab component reads or writes. "Direct" = the component owns it; "via props" = received as prop; "via closure" = `_hfRenders` pattern.

| Component | Reads (key groups) | Writes |
|-----------|-------------------|--------|
| `AnchorTab` | tasks, calEvents, meals, personalAnchors, people, checkedMealItems, checkedCalEvents, insights, weatherData | tasks, checkedMealItems, checkedCalEvents, personalAnchors |
| `CalendarTab` | calEvents, people, workDays, calMarkers, calColorLabels, connectedCals | calEvents, workDays, calMarkers, calColorLabels |
| `WeeklyTab` | tasks, meals, calEvents, rhythm | tasks |
| `MealsTab` | meals, mealCount, recipes, mealBankCustom, favMeals, dietaryFilters, mealThemes | meals, recipes, favMeals |
| `ShoppingTab` | shoppingItems, stores, shopCategories | shoppingItems, stores, shopCategories |
| `BrainTab` | brainItems, brainCats, exhaleItems | brainItems (passes to ExhaleSection) |
| `CoveTab` | coveData, people | coveData |
| `HomeTab` | homeSystems | homeSystems |
| `TidePoolTab` | coveData, people | coveData |
| `SchoolTab` | schoolData, people, tasks, calEvents | schoolData |
| `LighthouseTab` | lighthouse (useSaved), people, tasks | lighthouse |
| `SettingsTab` | all via props (read-only + write-through) | all via props |

---

## Notes on `meals` custom setter

`meals` is the only state that bypasses `useSaved`. It has a custom `setMeals` wrapper (line ~3236) that sanitizes the data before writing to localStorage and also marks `meals` dirty manually. This mirrors `useSaved`'s behavior but with extra validation. When extracting, this pattern must be preserved exactly — do not replace it with a plain `useSaved`.
