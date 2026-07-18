# Safe Harbor — Code Map
*Read-only reconnaissance, 2026-07-02. No files were modified.*

---

## 1. Where Safe Harbor UI lives

### Primary component
**`src/shell/SafeHarbor.jsx`** — 52 KB, self-contained, default export `SafeHarbor()`.
Three tabs rendered entirely inside this one file:
- **Our Plan** — contacts, household members, last-reviewed nudge
- **Grab & Go** — tiered checklist with session mode, undo-remove, custom items
- **Our Area** — hazard cards (homeFire, wildfire, tornado, winterStorm, powerOutage, extremeHeat) with Before/During/After guidance sourced from ready.gov

### Entry points
| File | Line | Role |
|---|---|---|
| `src/components/AnchorVault.jsx` | 5 | `import SafeHarbor from "../shell/SafeHarbor"` |
| `src/components/AnchorVault.jsx` | 6834 | `{activeSection === "safeharbor" && <SafeHarbor />}` |
| `src/components/AnchorVault.jsx` | 6261 | DashCard entry: `{ id:"safeharbor", icon:"⚓", label:"Safe Harbor", summary: safeHarborSum }` in `leftCards` |
| `src/components/AnchorVault.jsx` | 6340 | `ANCHOR_SECTIONS` array — appears in Anchor Settings toggle list |
| `src/App.jsx` | 11596 | `PILLARS` Anchor group: `{ vault:"safeharbor", label:"Safe Harbor", emoji:"⚓" }` — left sidebar nav |
| `src/App.jsx` | 11612 | `VAULT_NAV` array — same sidebar, keyboard nav order |

### Dashboard summary function
`safeHarborSummary()` in `AnchorVault.jsx` (~line 6076) reads `af_safe_harbor` directly from localStorage (not via a prop or context) and returns `{ highlight, countdown, count, alert }`. It fires `alert: true` if `lastReviewed` is absent or >365 days ago.

---

## 2. localStorage keys

Safe Harbor touches **two** keys.

### `af_safe_harbor` — the main data blob

**Written by:** `saveData(d)` (SafeHarbor.jsx line 267), called via `update(changes)` (line 294) after every state mutation.  
**Read by:** `loadData()` (SafeHarbor.jsx line 249) on component mount; `safeHarborSummary()` in AnchorVault.jsx for the dashboard card.

**Full shape:**
```json
{
  "lastReviewed": "2025-11-04",
  "contacts": {
    "meetNearby": "Front yard by the oak tree",
    "meetAway": "School parking lot, north entrance",
    "evacuatePrimary": "Take Main St north to Hwy 34, then east",
    "evacuateBackup": "Back roads via Oak Ave to County Rd 8",
    "outOfStateContact": "Grandma Jan — 402-555-0147"
  },
  "members": [
    { "id": "abc123", "name": "Briar", "role": "Child", "note": "Asthma inhaler in backpack" }
  ],
  "grabItems": [
    {
      "id": "g01",
      "name": "All household members accounted for",
      "location": "",
      "assignedTo": "",
      "tier": 1,
      "category": "people",
      "checked": false,
      "custom": false,
      "source": "people and their needs are the first priority"
    },
    {
      "id": "usr_m2k9q",
      "name": "Baby monitor",
      "location": "Nursery shelf",
      "assignedTo": "",
      "tier": 2,
      "category": "phones",
      "checked": false,
      "custom": true,
      "source": ""
    }
  ],
  "hazards": ["wildfire", "powerOutage"],
  "reviewDue": false
}
```

**Field-by-field notes:**
- `lastReviewed` — ISO date string `"YYYY-MM-DD"` or `null`. Drives the 365-day review nudge and the dashboard summary.
- `contacts` — five string fields; object shape is fixed (not user-extensible).
- `members` — freeform array; `id` is a `uid()` (`Math.random().toString(36).slice(2) + Date.now().toString(36)`); `role` defaults to `"Adult"`.
- `grabItems` — the core list. Each item has: `id` (static `"g01"`–`"g21"` for defaults, `uid()` for custom), `name`, `location`, `assignedTo`, `tier` (1/2/3), `category` (one of 6 P-values below), `checked` (session-only toggle, reset to false on `endSession()`), `custom` (bool), `source` (ready.gov attribution string, empty for custom).
- `hazards` — array of hazard IDs that the family has "added" (i.e., expanded their local plan for). Possible values: `"homeFire"`, `"wildfire"`, `"tornado"`, `"winterStorm"`, `"powerOutage"`, `"extremeHeat"`.
- `reviewDue` — written to `DEFAULT_DATA` as `false`; the component never sets it to `true` — it's effectively unused scaffolding.

### `af_sh_remind` — dismiss-nudge timestamp

**Written by:** `dismissNudge()` (SafeHarbor.jsx line 326): `localStorage.setItem("af_sh_remind", String(nowMs))`.  
**Read by:** component state initializer (line 289): `parseInt(localStorage.getItem("af_sh_remind") || "0") || 0`.

**Shape:** a plain numeric string (milliseconds since epoch, no JSON encoding):
```
"1751234567890"
```

After dismissal, the review nudge is suppressed for 30 days (`dismissedAt + 30 * 86400000`). After 30 days it re-appears if `lastReviewed` is still null or >365 days old. The timestamp lives only in `af_sh_remind`; `lastReviewed` in `af_safe_harbor` is set separately by `markReviewed()`.

---

## 3. Sync registry presence

| Registry | `safe_harbor` present? | `sh_remind` present? |
|---|---|---|
| `SYNC_KEYS` (App.jsx:451) | **No** | **No** |
| `sanitizeHouseholdData` (App.jsx:1890) | **No** | **No** |
| `_ARRAY_KEYS` / `_ARRAY_KEYS_BG` (App.jsx:2427, 2627) | **No** | **No** |
| `NULL_SAFE_KEYS` (App.jsx:262) | **No** | **No** |
| `_DIRTY_EXCLUDE` (App.jsx:1676) | **No** | **No** |

**Conclusion: Safe Harbor data is entirely local.** Neither key is synced to Supabase. Changes on device A never reach device B. The dashboard summary (`safeHarborSummary`) reads directly from localStorage so it would disagree across devices. This is a known gap — the emergency plan is currently per-device.

---

## 4. Tiered default items — how they're defined and how reset works

### Definition
The entire default list is an **inline constant array** in `SafeHarbor.jsx` starting at line 202:

```javascript
var DEFAULT_GRAB_ITEMS = [
  { id:"g01", name:"All household members accounted for", ..., tier:1, category:"people",  ... },
  { id:"g02", name:"Pets + leash or carrier",             ..., tier:1, category:"people",  ... },
  // ... 19 more items
  { id:"g21", name:"Irreplaceable photos or keepsakes",   ..., tier:3, category:"priceless", ... },
]
```

21 items total. Tier/category distribution:
| Tier | Label | Items |
|---|---|---|
| 1 — Leave Now (10 min) | `denim` color | g01–g09 (9 items across people/prescriptions/papers/phones/personal) |
| 2 — Prepare to Leave (30 min) | `sea` (teal) | g10–g18 (9 items) |
| 3 — Time to Prepare (60 min) | `gold` | g19–g21 (3 items) |

**No separate data file** — the list lives only in SafeHarbor.jsx. The six category keys (`"people"`, `"prescriptions"`, `"papers"`, `"phones"`, `"personal"`, `"priceless"`) are defined as module-scope constants `CAT_ORDER`, `CAT_LABELS`, `CAT_EMOJIS`.

Tier display metadata lives in `TIER_META` (lines 31–35) and `TIER_NOTE` (lines 36–39).

### How reset works
`restoreDefaults()` (line 405):
```javascript
function restoreDefaults() {
  if (!window.confirm("Restore items from ready.gov you've removed?")) return
  var currentNames = (data.grabItems || []).map(function(i) { return i.name })
  var toAdd = DEFAULT_GRAB_ITEMS.filter(function(d) {
    return currentNames.indexOf(d.name) === -1   // ← dedup key is item.name, NOT item.id
  }).map(function(d) { return Object.assign({}, d) })
  if (toAdd.length) update({ grabItems: (data.grabItems || []).concat(toAdd) })
}
```

**Dedup key is `item.name` (string), not `item.id`.** This means:
- If a user removes g07 ("Phones + chargers + power bank") and then restores, it comes back with its original `id:"g07"` and `custom:false`.
- If a user renamed a default item (not currently possible in the UI), it would be treated as "missing" and re-added alongside the renamed version.
- Custom items with the same name as a default item would block that default from being restored. This is an edge case worth noting for V2.

Reset is a **bulk additive action** (only adds, never removes custom items).

---

## 5. Existing persistence, add-custom-item, and check-off logic

### Central write path — `update(changes)`
```javascript
function update(changes) {
  var next = Object.assign({}, data, changes)
  setData(next)       // React state
  saveData(next)      // localStorage.setItem("af_safe_harbor", JSON.stringify(next))
}
```
`saveData` has no dirty-marking and dispatches no `af-data-changed` event. Since `af_safe_harbor` is not in `SYNC_KEYS`, this is expected — but means **no sync fires on any Safe Harbor write** (see §3).

### Add custom item — `openAddItem` / `submitCustom`
```javascript
function openAddItem(cat) { setAddingCat(cat); setAddName(""); setAddLoc("") }
function submitCustom() {
  if (!addName.trim()) { setAddingCat(null); return }
  var item = {
    id: uid(), name: addName.trim(), location: addLoc.trim(),
    assignedTo: "", tier: activeTier, category: addingCat,
    checked: false, custom: true, source: ""
  }
  update({ grabItems: (data.grabItems || []).concat([item]) })
  setAddingCat(null); setAddName(""); setAddLoc("")
}
```
- Custom items go into the currently-selected tier (`activeTier`) and the clicked category (`addingCat`).
- `custom: true` distinguishes them from defaults.
- No `assignedTo` UI exists yet — the field is stored but never shown in edit flow.

### Remove item — `removeItem` / `undoRemove`
```javascript
function removeItem(item) {
  update({ grabItems: (data.grabItems || []).filter(function(i) { return i.id !== item.id }) })
  setPendingUndo(function(prev) {
    if (prev[item.id]) clearTimeout(prev[item.id].timeoutId)
    var tid = setTimeout(function() {
      setPendingUndo(function(p) { var n = Object.assign({}, p); delete n[item.id]; return n })
    }, 5000)
    var next = Object.assign({}, prev)
    next[item.id] = { item: item, timeoutId: tid }
    return next
  })
}
```
- Removes from localStorage **immediately**. The undo window (5 s) is purely in React state (`pendingUndo`); a page reload during the window loses the item permanently.
- `undoRemove(itemId)` re-inserts using a functional `setData` update (fresh closure) and calls `saveData` directly to persist.
- Works identically for both default (`custom:false`) and custom (`custom:true`) items.

### Check-off — `toggleItem`
```javascript
function toggleItem(id) {
  if (!session) return    // locked behind session mode
  update({ grabItems: (data.grabItems || []).map(function(i) {
    return i.id === id ? Object.assign({},i,{checked:!i.checked}) : i
  }) })
}
```
- Checks are persisted to `af_safe_harbor` immediately (via `update`).
- `endSession()` resets **all** `checked` flags to `false`:
```javascript
function endSession() {
  setSession(false)
  update({ grabItems: (data.grabItems || []).map(function(i) { return Object.assign({},i,{checked:false}) }) })
}
```
- `session` flag (`useState(false)`) is ephemeral — lost on reload. There is no `af_session_*` key.

### Contact editing — `openEditContacts` / `saveContacts`
Clones `data.contacts` into `conDraft` local state, edits there, then calls `update({ contacts: Object.assign({}, conDraft) })`. Cancel discards `conDraft` without touching `data`.

### Members — `saveMember` / `removeMember`
Add: upsert by `draft.id`. If id exists → map-replace; if not → concat.  
Remove: filter out by id.  
Both call `update()`.

### Hazards — `toggleHazard`
Toggles presence of a hazard id in `data.hazards` array, calls `update()`.

---

## 6. Compass nudge pattern (Traditions → 14-day window) for reuse in Safe Harbor yearly review

### How Traditions does it
**File:** `src/shell/RipplesRoom.jsx`  
**Lines:** ~458–474

```javascript
{/* Compass nudge — surfaces soonest tradition */}
{!editing && sortedTrad.length > 0 && (function () {
  var soonest = sortedTrad.find(function (t) {
    var d = daysUntil(t.when);
    return d !== null && d <= 14;    // ← 14-day window
  });
  if (!soonest) return null;
  var d = daysUntil(soonest.when);
  return (
    <div style={{ ... }}>
      <span>🧭</span>
      <div>
        <div style={{ ... }}>From Compass</div>
        <div>
          {soonest.title} is {d === 0 ? "today" : d === 1 ? "tomorrow" : "just " + d + " days away"}.
          Want to plan this year's?
        </div>
      </div>
    </div>
  );
})()}
```

**Key characteristics:**
- Pure inline computation — no API call, no compassEngine.js involved. The "From Compass" label is a branding choice, not an AI invocation.
- Condition is stateless: computed on every render from `sortedTrad` (derived from `traditions` state, which is loaded from `af_traditions`).
- No dismiss mechanism — the nudge disappears naturally once the tradition is more than 14 days away.
- No localStorage key for "dismissed" state — it's always live.

### How Safe Harbor's nudge works (different pattern)
**File:** `src/shell/SafeHarbor.jsx` lines 300–327

```javascript
var nowMs     = Date.now()
var showNudge = false
if (tab === "ourPlan") {
  var remindAfter = dismissedAt + 30 * 86400000    // ← 30-day re-show after dismiss
  if (nowMs > remindAfter) {
    if (!data.lastReviewed) {
      showNudge = true                              // ← never reviewed
    } else {
      var lastMs = new Date(data.lastReviewed).getTime()
      if (!isNaN(lastMs) && (nowMs - lastMs) > 365 * 86400000) showNudge = true  // ← 365-day annual
    }
  }
}
```

Dismiss stores `nowMs` to both React state and `af_sh_remind` localStorage key (a raw numeric string, not JSON). `markReviewed()` writes today's ISO date to `data.lastReviewed` inside `af_safe_harbor` AND resets `dismissedAt` to `nowMs`.

**Safe Harbor nudge has a dismiss key; Traditions does not.** Traditions is event-driven (disappears when date passes); Safe Harbor is time-budget driven (disappears for 30 days, then re-evaluates the annual threshold).

### Pattern to reuse for a Safe Harbor yearly review nudge (or any annual nudge)

The pattern Safe Harbor itself already uses is the right model. The full recipe:

```
1. One localStorage key for "last dismissed" timestamp
   af_<feature>_remind  →  raw Number string (Date.now())
   
2. One field inside the feature's data blob for "last completed"
   data.lastReviewed  →  "YYYY-MM-DD" ISO string

3. On render, compute showNudge purely:
   var dismissedAt = parseInt(localStorage.getItem("af_<feature>_remind") || "0") || 0
   var remindAfter = dismissedAt + <suppress_days> * 86400000
   var showNudge = (Date.now() > remindAfter) &&
     (!data.lastReviewed || (Date.now() - new Date(data.lastReviewed).getTime()) > <threshold_days> * 86400000)

4. Two buttons:
   "Do the thing" → sets data.lastReviewed, resets dismissedAt to now, calls update()
   "Remind me later" → writes Date.now() to af_<feature>_remind, sets dismissedAt state

5. Style: goldPale background, goldBorder, "🧭 From Compass" label in gold uppercase.
   (Safe Harbor's exact CSS is in SafeHarbor.jsx lines 467–478)
```

### compassEngine.js role (for the record)
`compassEngine.js` is not involved in either the Traditions nudge or the Safe Harbor nudge. It is an **AI query engine** that sends household state to `/api/claude` and returns structured JSON (briefings, forecasts, weekly reviews, nudges). The "nudge" mode in compassEngine.js (`getDailyNudge`, line 258) is a separate AI-generated daily insight unrelated to Safe Harbor. The compassPrompts.js file defines system prompts for those AI calls.

If you later want Compass *AI* to generate the Safe Harbor review prompt (personalized to the family), you would add a `"safeHarborReview"` entry to `COMPASS_PROMPTS` in `compassPrompts.js` and call `runCompass("safeHarborReview", state)` — but the current implementation is entirely local/computed.

---

## 7. Exhale V2 feature flag pattern

### The flag

**Key:** `af_exhale_v2`  
**Default:** **opt-out** (default ON)  
**Read at:** module scope in `src/components/ExhaleSection.jsx` line 33:

```javascript
var EXHALE_V2 = localStorage.getItem("af_exhale_v2") !== "false";
```

This means:
- Missing key → `EXHALE_V2 = true` (V2 is on by default)
- `"false"` → `EXHALE_V2 = false` (V2 disabled)
- Anything else → `EXHALE_V2 = true`

**Contrast with Shopping V2** (`App.jsx` line 494):
```javascript
var SHOPPING_V2 = localStorage.getItem("af_shopping_v2") === "true";
```
Shopping V2 is **opt-in** (default OFF). The audit (P1-3) flags this asymmetry as a risk in mixed-household scenarios.

### Where the flag is checked
The flag is read **once at module scope** — it is NOT reactive. Changing `af_exhale_v2` in the console requires a full reload to take effect. There is no `useEffect` or `useState` wrapper around it.

All conditional branches inside `ExhaleSection.jsx` use `if (EXHALE_V2) { ... }` or `if (!EXHALE_V2) return;` patterns. Examples:
- Line 200: V2 real-time subscription setup inside `useEffect`
- Line 237: V2 migration hook  
- Line 289: V2 card fetch on mount  
- Line 425: V2 upsert path in `persist()`  
- Line 492: card ID generation (`crypto.randomUUID()` vs legacy counter)

**Toggle commands (browser console):**
```javascript
// Enable V2
localStorage.setItem("af_exhale_v2", "true"); location.reload();

// Disable V2 (fallback to blob sync)
localStorage.setItem("af_exhale_v2", "false"); location.reload();

// Restore default (V2 on, removes key)
localStorage.removeItem("af_exhale_v2"); location.reload();
```

### Backfill flag
A per-household per-device one-shot migration flag is stored alongside:
```
af_exhale_migrated_<householdId>  →  "1"
```
This prevents the first-run migration (local blob → `exhale_cards` rows) from running more than once per device per household. Safe Harbor V2 would need an equivalent: `af_sh_migrated_<householdId>` if the upgrade involves a one-time data migration.

### Recipe for reusing this pattern in Safe Harbor V2

```javascript
// At module scope in SafeHarbor.jsx (read once, not reactive):
var SAFE_HARBOR_V2 = localStorage.getItem("af_safe_harbor_v2") !== "false";  // opt-out default

// Or if Safe Harbor V2 should be opt-in (like Shopping):
var SAFE_HARBOR_V2 = localStorage.getItem("af_safe_harbor_v2") === "true";   // opt-in default
```

**Decision point:** opt-out (like Exhale) if V2 should roll out to all existing users automatically. Opt-in (like Shopping) if V2 changes the data shape in a way that requires manual migration confirmation.

Inside the component, guard the new code paths:
```javascript
if (SAFE_HARBOR_V2) {
  // V2 path: per-item rows, real-time sync, etc.
} else {
  // V1 path: af_safe_harbor blob, local only
}
```

---

## Quick reference index

| Topic | File | Lines |
|---|---|---|
| SafeHarbor component | `src/shell/SafeHarbor.jsx` | 1–end |
| `DEFAULT_GRAB_ITEMS` (21 items) | SafeHarbor.jsx | 202–236 |
| `DEFAULT_DATA` shape | SafeHarbor.jsx | 238–245 |
| `loadData` / `saveData` | SafeHarbor.jsx | 249–267 |
| `update()` central write path | SafeHarbor.jsx | 294–298 |
| Review nudge logic | SafeHarbor.jsx | 300–327 |
| `toggleItem` / `removeItem` / `undoRemove` | SafeHarbor.jsx | 360–395 |
| `submitCustom` | SafeHarbor.jsx | 398–403 |
| `restoreDefaults` | SafeHarbor.jsx | 405–412 |
| `startSession` / `endSession` | SafeHarbor.jsx | 414–418 |
| AnchorVault import + render | `src/components/AnchorVault.jsx` | 5, 6834 |
| `safeHarborSummary()` | AnchorVault.jsx | 6076–6097 |
| DashCard entry | AnchorVault.jsx | 6261 |
| `ANCHOR_SECTIONS` (settings toggle list) | AnchorVault.jsx | 6330–6341 |
| App.jsx sidebar wiring | `src/App.jsx` | 11596, 11612 |
| `SYNC_KEYS` (safe_harbor absent) | App.jsx | 451–478 |
| `_DIRTY_EXCLUDE` (safe_harbor absent) | App.jsx | 1676–1679 |
| `sanitizeHouseholdData` (safe_harbor absent) | App.jsx | 1890–1963 |
| Traditions Compass nudge (pattern source) | `src/shell/RipplesRoom.jsx` | 458–474 |
| Exhale V2 flag definition | `src/components/ExhaleSection.jsx` | 33 |
| Shopping V2 flag (opt-in contrast) | App.jsx | 494 |
| Compass engine (AI, not used for nudges) | `src/compass/compassEngine.js` | all |

---

## 8. Post-SH-1 persisted shape (remove/undo hardening)

Appended after fix/safe-harbor-remove-undo. SH-2 migration reads this section.

### DEFAULT_GRAB_ITEMS changes
- Every default entry now carries a stable defaultId: g01 through g21.
- Custom items have NO defaultId field (its absence identifies them).

### af_safe_harbor persisted blob additions
- removedDefaultIds: [] at the top level of the data object.
  - removeItem() pushes the defaultId when a default is removed.
  - undoRemove() filters the defaultId back out.
  - restoreDefaults() clears entries for whatever it restores.

### Tombstone fields (transient, per item)
- removed: true and removedAt: epoch-ms are set by removeItem().
- Tombstoned items stay at their original array index (undo restores
  position by deleting the two flags in place -- no concat).
- loadData() hard-deletes ALL tombstones on mount: a refresh during
  the 5s undo window silently finalizes the removal. Undo is
  session-only by design.
- The 5s timer also hard-deletes in a live session after expiry.
- IMPLICATION FOR SH-2/SH-3: tombstones never persist across loads,
  so migration and sync may treat any removed:true item found in
  storage as safe to hard-delete.

### restoreDefaults() semantics
- Dedup is by defaultId, never by name. A custom item sharing a
  default name is never matched, blocked, or overwritten.
- Confirm dialog exists for bulk reset only; single-item removal has
  no confirmation (undo covers it).

---

## 9. SH-2 final V2 persisted shape

Appended after branch sh-v2-model (commit 207d1de + follow-up). Describes
the data model introduced by SAFE_HARBOR_V2.

### Feature flag

Key: `af_safe_harbor_v2`
Default: **opt-in** (default OFF) — matches the Shopping V2 pattern.
Read: module scope in `src/shell/SafeHarbor.jsx`:

```javascript
var SAFE_HARBOR_V2 = localStorage.getItem("af_safe_harbor_v2") === "true"
```

**Reload-to-toggle:** the flag is read once at module scope. Changing it
in the browser console requires a full page reload to take effect.
Do NOT add a `location.reload()` call to the module. Console instructions:

```javascript
// Enable:  localStorage.setItem("af_safe_harbor_v2","true");  location.reload();
// Disable: localStorage.removeItem("af_safe_harbor_v2");      location.reload();
```

### V2 blob shape (af_safe_harbor)

All V1 fields are preserved verbatim. New fields are added as a superset.
No fields are renamed. All ids remain strings per repo convention.

```json
{
  "version": 2,
  "lastReviewed": "YYYY-MM-DD" | null,
  "contacts": { "meetNearby":"", "meetAway":"", "evacuatePrimary":"", "evacuateBackup":"", "outOfStateContact":"" },
  "members": [{ "id":"uid", "name":"", "role":"Adult|Child|Pet", "note":"" }],
  "grabItems": [
    {
      "id": "g01",
      "defaultId": "g01",
      "name": "...",
      "location": "",
      "assignedTo": "",
      "tier": 1,
      "category": "people|prescriptions|papers|phones|personal|priceless",
      "checked": false,
      "custom": false,
      "source": "ready.gov attribution or empty",
      "needsTags": []
    }
  ],
  "hazards": ["wildfire"],
  "reviewDue": false,
  "removedDefaultIds": [],
  "sixPs": null,
  "familyPlan": null,
  "review": {
    "lastReviewedAt": null,
    "cadence": "yearly",
    "remindDismissedAt": 1751234567890 | null
  }
}
```

Field notes:
- `version`: migration sentinel. Set to 2 by migrateToV2(); absent or < 2 triggers migration.
- `grabItems[].needsTags`: optional per-item array (pet/infant/medication/mobility/accessibility).
  Not backfilled on existing items — added on-demand by SH-4 UI. Custom and default items alike.
- `grabItems[].assignedTo`: remains free-text string. No conversion to person-record reference.
- `sixPs`: null shell for SH-4 (Six P's category notes layer). Populated in that phase.
- `familyPlan`: null shell for SH-5 (full family preparedness plan). Populated in that phase.
- `review.lastReviewedAt`: mirrors `lastReviewed` for V2 consumers. Both are written by markReviewed().
- `review.cadence`: string, defaults to "yearly". Configurable in a future pass.
- `review.remindDismissedAt`: absorbed from `af_sh_remind` during migration (see below).

### af_sh_remind → absorbed

`af_sh_remind` (raw epoch-ms string, NOT JSON) is a V1 separate key that is consumed
by `migrateToV2()` on first load with V2 active:
- Read with `localStorage.getItem("af_sh_remind")`.
- Parsed with `parseInt(raw) || null`. Note: `"0"` → `null` (0 = epoch = never-dismissed;
  null is the cleaner sentinel — see C5 in tests/unit/safe-harbor-migrate.test.js).
- Written into `review.remindDismissedAt`.
- Removed from localStorage (`localStorage.removeItem("af_sh_remind")`).

After migration, `af_safe_harbor` is the single source of truth for the dismiss timestamp.
V2 code paths (dismissNudge, markReviewed) write to `review.remindDismissedAt` via `update()`.
V1 code paths (flag OFF) continue to write to `af_sh_remind` as before.

### Checked-state semantics (V2 only)

Flag OFF: `item.checked` is a session-only flag, wiped by `endSession()`. No change.
Flag ON:
- `item.checked` is a persistent flag, toggleable any time (no session gate).
- Sessions are a practice-run overlay (`sessionChecked: {}` React state).
  - `startSession()` → `setSessionChecked({})`.
  - `toggleItem(id)` with session active → updates `sessionChecked` only.
  - `endSession()` → `setSessionChecked(null)`, never touches `item.checked`.
  - Display logic: `getChecked(item)` returns `sessionChecked[item.id]` during session,
    `item.checked` otherwise.

### Migration function

File: `src/shell/safe-harbor-migrate.js` (extracted from SafeHarbor.jsx for testability).
Exports: `DEFAULT_GRAB_ITEMS`, `DEFAULT_DATA`, `migrateToV2`.

`migrateToV2(saved)` tolerates:
- `null`/non-object/array input → builds clean V2 defaults (same as fresh install).
- Pre-SH-1 blobs (items lack `defaultId`) → synthesizes by name-match against DEFAULT_GRAB_ITEMS.
- `removedDefaultIds` absent → inits to `[]`.
- Already-V2 blobs → fully idempotent (running twice is deep-equal).

Called from `loadData()` when `SAFE_HARBOR_V2 && (!saved.version || saved.version < 2)`.

### Export / Import coverage

**Export Backup**: enumerates `Object.keys(localStorage).filter(k => k.startsWith("af_"))`.
`af_safe_harbor`, `af_sh_remind`, and `af_safe_harbor_v2` are all captured automatically.
No explicit listing needed.

**Import Backup**: restores all `af_*` keys via `localStorage.setItem`. After restore,
validates `af_safe_harbor` with the same guards as `loadData()` — if the value is bad JSON,
null, non-object, or an array, it is removed so `loadData()` reconstructs defaults on next
mount instead of crashing. See App.jsx ~line 1537.

### NULL_SAFE_KEYS

`af_safe_harbor` added to the startup `NULL_SAFE_KEYS` guard (App.jsx ~line 263).
This is belt-and-suspenders: `loadData()` already handles the `"null"` string case
defensively (JSON.parse("null") → null → fresh defaults). The guard fires before React
mounts and is consistent with the other local-only keys in that list.

### Unit tests

`tests/unit/safe-harbor-migrate.test.js` — Suite C (20 tests):
- C1: af_sh_remind absorption (5 assertions)
- C2: idempotency (2 assertions)
- C3: null/bad input → clean defaults (4 assertions)
- C4: pre-SH-1 defaultId synthesis (5 assertions)
- C5: parseInt edge cases including "0" → null (4 assertions)
