# Lighthouse — LH-0 Code Map

**Date:** 2026-07-06  
**Branch:** main (post Sprint 2 merge — commit cc58919)  
**App.jsx line count:** 11,873

---

## 1. SYNC_KEYS — file, array, and addition template

**File:** `src/sync-core.js`, lines 25–61.

```js
export const SYNC_KEYS = [
  "tasks","brainItems","brainCats","calEvents","connectedCals","calColorLabels",
  "meals","mealsWeekOf","nextWeekMeals","mealCount","mealThemeEnabled","mealThemes","favMeals","mealBankCustom","recipes",
  "shoppingItems","stores","shopCategories",
  "people","familyProfile","birthdays","rhythm","homeSystems",
  "notifications","recurring","notifSettings",
  "sections","flowMode","preferredName","flowGreetingTone","weatherLocation","burnoutChecked","aiMemory",
  "celebrations","celebgifts","gifts","inventory","pets","ripples","houseFile","favProducts","packing_templates",
  "moments","subs","vaultSystems",
  "health","career","travel_profile",
  "cove_lists_v1","cove_items_v1","cove_sections_v1","cove_notes_v1",
  "schoolData","coveData","dietaryFilters",
  "compassCache","compassEnabled",
  "exhale_groups","exhale_color_labels","exhale_people","exhale_labels",
  "cal_markers","cal_marker_types","workDays",
  "traditions",
  "monthMeals","af_nwMealCount",   // ← af_nwMealCount keeps its af_ prefix (legacy double-prefix; DO NOT copy this)
  "safe_harbor"                    // ← template: plain snake_case, no af_ prefix
];
```

**Total keys (current):** 68.

**Addition template for `"lighthouse"` (follow `"safe_harbor"` exactly):**

```js
  // Lighthouse — per-child learning record (LH-1). Merge-on-receive when a
  // merge hook is added; until then, defensive pass-through handles it.
  "lighthouse"   // ← append here, plain "lighthouse" — push loop writes "af_lighthouse"
```

> **Double-prefix trap:** The sync push loop at App.jsx ~line 2250 does:
> `payload[k] = JSON.parse(localStorage.getItem("af_" + k))`.
> So `SYNC_KEYS` entry `"lighthouse"` → localStorage key `"af_lighthouse"`. Never write `"af_lighthouse"` in SYNC_KEYS.
> The `"af_nwMealCount"` entry is a known legacy exception; do NOT replicate its pattern.

---

## 2. `sanitizeHouseholdData()` — file, allowlist structure, addition point

**File:** `src/sync-core.js`, lines 109–194.

### Structure

The function has three layers:

| Layer | Mechanism | Keys |
|-------|-----------|------|
| **Explicit array guard** | `Array.isArray` check → filter nulls | tasks, brainItems, shoppingItems, notifications, etc. |
| **Explicit type rules** | object shape checks, scalar coercion | people, meals, rhythm, mealCount, strings, objects |
| **Defensive pass-through** | any SYNC_KEY not in `_SANITIZE_HANDLED`, non-null, not in output yet | workDays, traditions, cal_markers, compassCache, etc. |

### `_SANITIZE_HANDLED` (lines 94–114)

A `Set` that lists every key with an **explicit rule**. Purpose: prevent the pass-through from overriding a validation rejection (e.g. `tasks={}` fails the array guard → should stay undefined, not be resurrected by pass-through).

```js
const _SANITIZE_HANDLED = new Set([
  // array guard
  "tasks","brainItems","shoppingItems","notifications","calEvents","connectedCals",
  "birthdays","favMeals","mealBankCustom","recipes","stores","shopCategories",
  "brainCats","homeSystems","dietaryFilters",
  "recurring","celebrations","gifts","inventory","pets","houseFile",
  "cove_lists_v1","cove_sections_v1","cove_notes_v1","burnoutChecked",
  "moments","subs","vaultSystems","packing_templates",
  // specially structured
  "people","meals","nextWeekMeals","mealsWeekOf","rhythm",
  // scalars
  "mealCount","mealThemeEnabled","preferredName","flowGreetingTone","weatherLocation","flowMode",
  // objects
  "familyProfile","aiMemory","collapsedStores","mealThemes","calColorLabels",
  "coveData","schoolData","cove_items_v1","notifSettings","sections",
  "connectedCals","exhale_labels","health","career","travel_profile",
  // explicitly normalized
  "ripples",
  // merge-on-receive (applyHouseholdKey handles the merge)
  "safe_harbor",
]);
```

### How `"safe_harbor"` is registered (the template for `"lighthouse"`)

```js
// In the sanitize function body (lines 188–191):
if (data["safe_harbor"] !== undefined && data["safe_harbor"] !== null &&
    typeof data["safe_harbor"] === "object" && !Array.isArray(data["safe_harbor"])) {
  out["safe_harbor"] = data["safe_harbor"];
}
```

Then `"safe_harbor"` is added to `_SANITIZE_HANDLED` so the pass-through doesn't double-write.

**For `"lighthouse"`: add the same object guard block, then add `"lighthouse"` to `_SANITIZE_HANDLED`.**

### `NULL_SAFE_KEYS` in App.jsx startup sanitizer (line 266)

**File:** `src/App.jsx`, line 266 (inside `sanitizeLocalStorageOnLoad` IIFE).

```js
const NULL_SAFE_KEYS = [
  "af_inventory","af_gifts","af_houseFile","af_health","af_career","af_travel_profile",
  "af_vaultSystems","af_sections","af_moments","af_subs","af_packing_templates","af_safe_harbor"
];
```

This list uses **full `af_` prefixed keys** (unlike SYNC_KEYS). It prevents the string `"null"` in localStorage from crashing components that expect an object. `"af_safe_harbor"` is included because `loadData()` in SafeHarbor.jsx handles `"null"` defensively but belt-and-suspenders doesn't hurt.

**Add `"af_lighthouse"` here.** Format: full prefix, matches the existing entries.

---

## 3. Rollout flag plumbing — copy this exactly

Both `SHOPPING_V2` and `SAFE_HARBOR_V2` use the same pattern. The safe harbor version is the cleaner reference:

**`src/shell/SafeHarbor.jsx`, lines 5–10:**
```js
// SAFE_HARBOR_V2 — opt-in (default OFF). Matches the Shopping V2 opt-in pattern.
// To enable:  localStorage.setItem("af_safe_harbor_v2","true");  location.reload();
// To disable: localStorage.removeItem("af_safe_harbor_v2");      location.reload();
var SAFE_HARBOR_V2 = localStorage.getItem("af_safe_harbor_v2") === "true"
```

**`src/App.jsx`, line 514 (Shopping V2 — module-scope):**
```js
var SHOPPING_V2 = localStorage.getItem("af_shopping_v2") === "true";
```

**For Lighthouse:**
- Declare at the top of the Lighthouse shell file (or module scope of App.jsx if inline):
  ```js
  var LIGHTHOUSE_V2 = localStorage.getItem("af_lighthouse_v2") === "true";
  ```
- Gate the entire tab panel: `{t==="lighthouse" && LIGHTHOUSE_V2 && <LighthouseTab/>}`
- Gate any state initialization: skip writing `af_lighthouse` defaults if `!LIGHTHOUSE_V2`

---

## 4. `useSaved` — exact signature and double-prefix rule

**File:** `src/App.jsx`, lines 1766–1812.

```js
function useSaved(key, fallback) → [value, setSaved]
```

- Reads `localStorage.getItem("af_" + key)` on init (lazy `useState`).
- `setSaved(next)` writes `localStorage.setItem("af_" + key, JSON.stringify(resolved))`.
- Marks key dirty in `af_dirtyKeys` unless `_afHydrating` is true or key is in `_DIRTY_EXCLUDE`.

**Correct usage for lighthouse:**
```js
const [lighthouse, setLighthouse] = useSaved("lighthouse", defaultLighthouse());
// → reads/writes localStorage key: "af_lighthouse"
// → SYNC_KEYS entry: "lighthouse"  (no prefix)
```

**Wrong — do not do this:**
```js
useSaved("af_lighthouse", ...)  // → reads "af_af_lighthouse", breaks sync
```

---

## 5. Export / Import — how `af_lighthouse` is covered automatically

**File:** `src/App.jsx`, lines 1592–1602 (Export Backup button handler).

```js
var data = {};
Object.keys(localStorage).forEach(function(k) {
  if (k.startsWith("af_")) data[k] = localStorage.getItem(k);
});
// → writes data to a .json file
```

**`af_lighthouse` is covered automatically** — the export enumerates all `af_*` keys. No explicit listing needed. Same applies to `af_lighthouse_v2`.

**Import (lines 1615–1618):**
```js
keys.forEach(function(k) {
  try { localStorage.setItem(k, data[k]); } catch {}
});
```

Import also covers `af_lighthouse` automatically. However, the import handler currently has a **special defensive guard only for `af_safe_harbor`** (lines 1625–1629): it validates the restored blob is a non-null object, removing it if not.

**LH-7 must add the same guard for `af_lighthouse`:**
```js
if (data["af_lighthouse"] !== undefined) {
  var _lhOk = false;
  try { var _lhP = JSON.parse(data["af_lighthouse"]); _lhOk = _lhP !== null && typeof _lhP === "object" && !Array.isArray(_lhP); } catch(_e2) {}
  if (!_lhOk) { try { localStorage.removeItem("af_lighthouse"); } catch {} }
}
```

---

## 6. People / children source of truth — CRITICAL integration decision

**VERDICT: Use `people` (SYNC_KEYS, `useSaved("people", [...])`) as the child list. Do not create a second list.**

### Source details

| Item | Value |
|------|-------|
| State | `const [people, setPeople] = useSaved("people", [...])` — App.jsx line 2895 |
| Storage key | `af_people` |
| In SYNC_KEYS | ✓ — syncs across household |
| Person shape | `{ id, name, color, birthday, age, role, isMinor }` |
| `id` format | 7-char alphanumeric from `uid()` = `Math.random().toString(36).slice(2,9)` |
| `role` values | `"Mom","Dad","Guardian","Kid","Teen","Baby","Grandparent","Roommate","Other"` |

### How children are identified

```js
// App.jsx line 535
function personIsMinor(p) { var a = personAge(p); return a !== null && a < 18; }

// TidePoolTab uses this filter (line 1009):
var rawKids = people.filter(function(p) {
  return p.role === "Kid" || p.role === "Teen" || personIsMinor(p);
});
```

**For Lighthouse:** use `people` as the authoritative list. Reference a child by their `person.id` (a 7-char string like `"a3b8c9d"`). Lighthouse's `shared`, `homeschool`, and `school` objects are keyed by this id: `shared[person.id]`, `homeschool[person.id]`, etc.

**Decision (confirmed): Option A** — all household people, defaulting to show role==="Kid"/role==="Teen"/isMinor, with an include-toggle for adults. If no minors exist, fall through to showing all. Implemented in LH-2.

**Child switcher filter (LH-2):**
```js
var allPeople   = people.filter(function(p) { return p && p.name; });
var defaultPeople = allPeople.filter(function(p) {
  return p.role === "Kid" || p.role === "Teen" || personIsMinor(p);
});
var displayPeople = (showAllPeople || defaultPeople.length === 0) ? allPeople : defaultPeople;
```

### ⚠ Open risk (a): duplicate person ids across synced devices

`uid()` = `Math.random().toString(36).slice(2,9)` — 7 chars of base36, ~78 billion values. Collision probability across two devices adding a person simultaneously is negligible (~1 in 78B per pair). **However, there is a more serious structural risk:** the `people` array itself syncs via last-write-wins on the whole array (no per-person merge hook). If Device A and Device B both add a person while offline, whichever device pushes last overwrites the other's addition entirely — the added person disappears. This is pre-existing behaviour, not introduced by Lighthouse. **For Lighthouse it is load-bearing:** if a child's person record is lost from `people`, their Lighthouse data (`shared[id]`, etc.) becomes orphaned (keyed to a missing id). Mitigation: the data is not lost — it stays in `af_lighthouse` keyed by the old id — but the child will not appear in the switcher until the person record is restored. Flagged as a known risk; a `people` array merge hook (analogous to `mergeSafeHarbor`) would fix it but is out of scope for Lighthouse.

---

## 7. Where feature sections mount — the tab pattern

### Tab registration (must add three places)

**Step 1 — `TABS` array** (`src/App.jsx`, line 683):
```js
const TABS = [
  ...existing...,
  {id:"lighthouse", label:"Lighthouse", emoji:"🏠"},  // ← add here
];
```

**Step 2 — `MORE_TABS`** (line 698, alongside school/cove/etc.):
```js
const MORE_TABS = ["weekly","home","brain","school","tidepool","cove","settings","lighthouse"];
```

**Step 3 — Render switch** (line 11356, the `t===` map):
```js
{t==="lighthouse" && LIGHTHOUSE_V2 && <LighthouseTab/>}
```

### Component registration (required for the stable-wrapper pattern)

**Step 4 — `_hfRenders` / `_hfComps` list** (line 1826):
```js
[
  ...existing...,
  'LighthouseTab',     // ← add to this array
].forEach(n => { _hfComps[n] = function(p){ return _hfRenders[n](p); }; ... });
```

**Step 5 — Component definition** (anywhere in App.jsx after line 1818, before HomeFlow return):
```js
_hfRenders.LighthouseTab = function LighthouseTab() {
  var [lighthouse, setLighthouse] = useSaved("lighthouse", defaultLighthouse());
  // ...
};
```

### Pattern reference: SchoolTab (self-contained `_hfRenders` component)
- Definition: App.jsx line 9499 — `_hfRenders.SchoolTab = function SchoolTab() { ... }`
- Uses `useSaved("schoolData", {})` directly (no external file)
- Accesses HomeFlow closure variables (`people`, `T`, `authUser`, etc.) directly

**Lighthouse should follow this same pattern.** No separate file needed unless size demands it (SchoolTab is ~580 lines).

---

## 8. Blob-sync path confirmation

`af_safe_harbor` / `af_lighthouse` both follow the household blob pull. Confirmed working path:

```
pushHouseholdData()
  → SYNC_KEYS.forEach(k => payload[k] = localStorage.getItem("af_" + k))
  → PATCH /rest/v1/households { data: { ...payload } }

Background poll / checkForUpdates / pullLatestHouseholdData:
  → GET /rest/v1/households?id=eq.{hid}&select=*
  → sanitizeHouseholdData(row.data)        ← lighthouse must pass its object guard
  → SYNC_KEYS.forEach(k => applyHouseholdKey(k, clean[k]))
  → applyHouseholdKey("lighthouse", remoteVal)
       → currently: localStorage.setItem("af_lighthouse", JSON.stringify(remoteVal))
       → future (LH-merge-hook): could route through mergeLighthouse()
```

### ⚠ Open risk (b): af_lighthouse is pass-through (last-write-wins on the whole blob)

Unlike `af_safe_harbor` (which routes through `mergeSafeHarbor` in `applyHouseholdKey`), `af_lighthouse` currently uses a plain `localStorage.setItem` on receive — the entire blob is overwritten with whatever the remote side sent. In a single-user household this is fine. In a two-user household (you + Twyla), simultaneous edits from different children risk overwriting each other: if you edit child A's data on your phone while Twyla edits child B's data on her phone, whichever push arrives last replaces the other's changes across all children.

**Decision deferred to LH-6/LH-7.** Options at that point:
1. Add `mergeLighthouse(local, remote)` to `safe-harbor-migrate.js` (or a new `lighthouse-merge.js`) and route through `applyHouseholdKey` — same pattern as `safe_harbor`. Merge strategy: child-level last-write-wins (merge by childId key, remote wins per child if remote's timestamp is newer).
2. Accept the race condition if the household is in practice single-user for Lighthouse editing. Document it as a known limitation.
3. Optimistic locking: attach a `updatedAt` per child and refuse to apply remote if local is newer.

This must be resolved before Lighthouse is enabled for the beta household (`hh_o7yzu28`).

**The "Exhale V2 Realtime table" drop risk does NOT apply.** That issue was about keys that Exhale used outside SYNC_KEYS via a separate Realtime subscription. `af_lighthouse` goes through the standard blob pull — it is immune as long as it is in both SYNC_KEYS and the sanitize allowlist.

**Sync applies at 7 sites in App.jsx** (all now route through `applyHouseholdKey`):

| Line (approx) | Context |
|---------------|---------|
| 2091 | Sign-in: apply existing household |
| 2120 | Sign-in: apply joined household |
| 2360 | `checkForUpdates`: stale pull |
| 2404 | `joinHousehold`: fresh pull |
| 2443 | `pullLatestHouseholdData` |
| 2483 | `syncNow` confirm-pull |
| 2711 | Background poll |

---

## 9. esbuild baseline (main, 2026-07-06)

```
npx esbuild src/App.jsx --target=es2019 --loader:.jsx=jsx --outfile=/dev/null
→ 0 warnings, 883.2 kb
```

> The work plan mentions two known warnings (duplicate `title`, duplicate `display`). These do NOT appear on the current build. The baseline is clean zero. Any warning introduced by Lighthouse changes is a regression.

---

## 10. LH-1 registration checklist (summary)

| Location | Key | Action |
|----------|-----|--------|
| `src/sync-core.js` SYNC_KEYS | `"lighthouse"` | Append (plain, no af_ prefix) |
| `src/sync-core.js` `_SANITIZE_HANDLED` | `"lighthouse"` | Add to Set |
| `src/sync-core.js` `sanitizeHouseholdData()` body | object guard block | Add (see §2 template) |
| `src/App.jsx` `NULL_SAFE_KEYS` (line 266) | `"af_lighthouse"` | Append (with af_ prefix) |
| `src/App.jsx` `defaultLighthouse()` | — | Define near top of file / above LighthouseTab |
| `src/App.jsx` `TABS` | `{id:"lighthouse",...}` | Append |
| `src/App.jsx` `MORE_TABS` | `"lighthouse"` | Append |
| `src/App.jsx` `_hfRenders/_hfComps` list | `'LighthouseTab'` | Append |
| `src/App.jsx` render switch | `{t==="lighthouse" && LIGHTHOUSE_V2 && <LighthouseTab/>}` | Add in map |
| `src/App.jsx` import backup restore handler | `af_lighthouse` guard | Add in LH-7 |

**Four-location registration test (the LH-1 acceptance gate):**  
SYNC_KEYS ✓ + sanitize allowlist ✓ + NULL_SAFE_KEYS ✓ + `_SANITIZE_HANDLED` ✓ = data survives every pull without silent drop.
