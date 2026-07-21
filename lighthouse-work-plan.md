# Lighthouse — Per-Child Implementation Work Plan

**Feature:** Lighthouse (homeschool + traditional-school learning records), per-child mode  
**Stored key:** `af_lighthouse` (snake_case, matches `af_safe_harbor`)  
**Rollout flag:** `af_lighthouse_v2` (default **OFF**, Shopping/Safe Harbor V2 opt-in pattern)  
**Sync model:** single blob via existing household pull — **no new Supabase table**  
**Target:** ES2019 / Safari 13.

---

## Non-negotiable guardrails (read before every session)

1. **Code map first, edit second.** LH-0 produces `lighthouse-code-map.md`. Do not edit App.jsx until it exists and is committed.
2. **Double-register the key or lose data silently.** `af_lighthouse` must be added to **both** `SYNC_KEYS` **and** the `sanitizeHouseholdData()` allowlist. This is the exact bug class from the nine missing SYNC_KEYS — keys in SYNC_KEYS but absent from the allowlist are dropped on every pull.
3. **No `af_af_` double prefix.** The `SYNC_KEYS` entry is the literal string `"lighthouse"`; the prefix is already baked in. Do not write `"af_lighthouse"` in SYNC_KEYS.
4. **Opt-in, default OFF.** Everything gates behind `af_lighthouse_v2`. A user with the flag off sees no behavior change.
5. **ES2019 / Safari 13 target.** No `?.`, no `??`, no `structuredClone`, no JSX style-prop spread. Use `lhGet(o, k, d)` for safe reads; `Object.assign({}, ...)` for shallow clone; `JSON.parse(JSON.stringify(...))` for deep clone when needed.
6. **Verify syntax before deploy:**  
   `npx esbuild src/App.jsx --target=es2019 --loader:.jsx=jsx --outfile=/dev/null`  
   Baseline is zero warnings. Any warning introduced by Lighthouse is a regression.
7. **Deploy only via** `cd ~/Desktop/anchor-and-flow && ./deploy.sh "message"` and confirm the bundle-hash check passes.
8. **Commit at the end of every session.**

---

## LH-0 — Recon / code map (DONE)

`lighthouse-code-map.md` committed. See that file for all line numbers, registration templates, and open risks (a) people id collision, (b) af_lighthouse pass-through vs merge-on-receive.

---

## LH-1 — Data model + key registration (DONE)

`af_lighthouse` registered in SYNC_KEYS, `_SANITIZE_HANDLED`, sanitize object guard, and `NULL_SAFE_KEYS`. `defaultLighthouse()` and `lhGet()` defined. Tests green.

---

## LH-2 — Shell + per-child mode routing (DONE, includes LH-2 routing fix)

Lighthouse container mounts gated on `af_lighthouse_v2`. Child switcher draws from `af_people`, defaulting to role==="Kid"/Teen/isMinor with an include-toggle for others.

Mode-aware nav. Visible areas depend on `modes[childId]`:
- **Always (shared):** Overview, Books, Beyond, Trips, Goals, Summaries
- **homeschool adds:** Plan, Loops
- **school adds:** This Week, Homework, School Comms, Grades

**LH-2 routing fix (committed):** The PILLARS nav entry now uses `id: LIGHTHOUSE_V2 ? "lighthouse" : "school"`, so clicking the nav dispatches the correct tab id. `"lighthouse"` added to the HomeFlow render array and the `__roomKey` Flow branch.

---

## LH-3 — Shared growth areas (DONE)

Books, Beyond, Trips, Goals built against `shared[childId]`. Inline edit, add forms, include-in-summary toggle, star ratings, delete. Works for both homeschool and school children; only the "Beyond" label differs by mode.

---

## LH-4 — Homeschool operating layer (DONE, includes LH-4 revisions)

Plan (daily/weekly/monthly) + Loops against `homeschool[childId]`.

**LH-4 revisions (committed):**
- Loops: three explicit direct-action buttons per item (Done/Skip/Later) via `lhSetStatus(current, target)`. A tapped active button returns to "todo". `lhCycleStatus` retained.
- Daily plan: replaced single textarea with 3-part hybrid card — attendance toggle [Present][Away] + core-work input + notes textarea. `daily[day]` is now an object `{ attendance, core, notes }` (was a plain string). Old string values migrate transparently to `notes` via read-path guard in `applyHsDayField`.

---

## LH-4.6 — Challenges (inside Goals area, mixed auto/manual progress)

**Goal:** Preserve the active reading challenge (and any others in `af_schoolData.breakGoals`) by extending the existing Goals area — not by adding a separate section.

### Where challenges live

Challenges are **not** a new array. They extend `shared[childId].goals[]` with a `kind` field. No seasons. No separate challenges tab. The Goals area renders each record according to its `kind`.

### Extended goal record shape

Existing goal fields are unchanged. Add `kind` (default `"goal"`) and the challenge-only fields:

```js
{
  // existing fields (unchanged)
  id:           string,
  cat:          string,
  goal:         string,
  why:          string,
  steps:        [],
  progress:     string,
  evidence:     string,
  reflect:      string,
  source:       string,

  // new field on every goal record
  kind:         "goal" | "challenge",   // default "goal" if absent

  // challenge-only fields (present only when kind === "challenge")
  target:       string,       // numeric target as a string, e.g. "30"
  unit:         string,       // "books", "days", "hours", etc.
  startDate:    string,       // ISO date (YYYY-MM-DD) — auto-progress window
  manualAdjust: number,       // stored integer, adjustable via +/−, may be negative
}
```

`kind === "goal"` records render as today — no target, no progress bar, no challenge fields shown.  
`kind === "challenge"` records add target, unit, startDate, manualAdjust, and a progress bar below the title.

### `defaultLighthouse()` change

None. The `goals: []` array already exists in the shared child shape. No new array is added anywhere.

### Auto-progress (derived, never stored)

```js
function lhChallengeAutoProgress(books, startDate) {
  // Only meaningful for unit === "books". Pass shared[childId].books.
  if (!Array.isArray(books) || !startDate) return 0;
  return books.filter(function(b) {
    return b.status === "finished" && b.finish && b.finish >= startDate;
  }).length;
}
// For all other units: autoProgress = 0 (manual-only via manualAdjust).
```

`displayProgress = autoProgress + manualAdjust`. Shown against `target` on the progress bar and the "X / target unit" label.

### Progress card display rules

When `kind === "challenge"` and `target` is set, always show both:

- **+/− buttons** — adjust `manualAdjust` only, even for `unit === "books"`. The user can correct for double-counts or add reads not in the Books log.
- **Breakdown label** — always visible when `unit === "books"`:
  - `"11 from Books log, +3 added"` (manualAdjust > 0)
  - `"11 from Books log"` (manualAdjust === 0)
  - `"11 from Books log, −2 removed"` (manualAdjust < 0)
  - For non-books units: `"X / target unit"` only — no breakdown label.

No auto-dedupe between `autoProgress` and `manualAdjust`. The breakdown is the transparency mechanism; the user adjusts manually if needed.

### New pure helpers

```js
lhChallengeAutoProgress(books, startDate)  // pure, derived — no side effects
// lhAddItem / lhUpdateItem / lhDeleteItem already cover goals[] — no new array helpers needed
```

### Tests to add (LH-4.6-A through LH-4.6-C)

- **LH-4.6-A** (`lhChallengeAutoProgress`): empty books → 0; all books before startDate → 0; books on startDate → count; books after → count; mixed → only on/after count; non-books call → 0.
- **LH-4.6-B** (kind field): goal record without kind field reads as "goal" (default); challenge record carries target/unit/startDate/manualAdjust; lhUpdateItem patches kind without touching other fields; sibling child goals unaffected.
- **LH-4.6-C** (displayProgress): autoProgress + manualAdjust arithmetic; negative manualAdjust produces correct total; zero autoProgress for non-books; breakdown label strings for positive/zero/negative manualAdjust.

**Acceptance:** Goals area renders plain goals unchanged. A challenge record shows target, progress bar, +/− buttons, and (for unit==="books") the breakdown label. manualAdjust persists round-trip. autoProgress updates when a new book is finished. **Stop and report.**

---

## Migration note — `af_schoolData.breakGoals` → `shared[childId].goals` (kind:"challenge")

**When to run:** last step of LH-4.6, triggered from Settings when the user first enables Lighthouse. Do NOT run silently on load without user confirmation.

**Rules:**

- `breakGoals` entries with a numeric `target` → goal record with `kind: "challenge"`
- `breakGoals` entries without a `target` → goal record with `kind: "goal"`
- `type: "daily"` entries → **discarded** (no equivalent in Lighthouse)
- `break` (season) field → **dropped** (no season concept in Lighthouse)

**Field mapping:**

| `breakGoals` field | `goals[]` field | Notes |
|---|---|---|
| `id` | `id` | identical |
| `title` | `goal` | breakGoals called it `title`; goals calls it `goal` |
| `target` | `target` | identical (string); omitted for kind:"goal" records |
| `unit` | `unit` | identical; omitted for kind:"goal" records |
| `progress` | `manualAdjust` | old hand-count becomes the stored manual adjustment |
| `notes` | `reflect` | closest semantic match in the goals shape |
| *(none)* | `startDate` | set to migration date (today's ISO date) |
| *(none)* | `kind` | `"challenge"` if target present, `"goal"` otherwise |
| `break` | *(dropped)* | season concept does not exist in Lighthouse |
| `type: "daily"` | *(discard entire record)* | no equivalent |

**Why `startDate = migration date`:** Books logged before migration were not counted in the old manual counter. Setting startDate to today means autoProgress = 0 on day one, so `displayProgress = 0 + old progress = old progress`. The exact hand-counted number is preserved with no surprise jump from retroactive books.

**Source read:** `JSON.parse(localStorage.getItem("af_schoolData") || "{}")`.  
**Destination write:** `lhAddItem(lh, childId, "goals", migratedGoal)` for each qualifying breakGoal, then persist via `setLighthouse`.

**Child id mapping:** `af_schoolData` is keyed by the same person id (`af_people` → `person.id`) that Lighthouse uses. No translation needed.

**What is NOT migrated:** `childData.type`, `childData.public`, `childData.homeschool` from `af_schoolData`. Only `breakGoals` is migrated.

**Post-migration:** `af_schoolData` is left untouched. SchoolTab continues to show original data if somehow reached. No data is destroyed.

---

## LH-5 — School operating layer

**This Week**, **Homework** (status cycle + needs-help flag), **School Comms** (contacts referencing household people + dated log with action items), **Grades & Growth** (progress marks + scores + goals with `source`). Against `school[childId]`.

**Acceptance:** school child fully operational; comms log persists and syncs. **Stop and report.**

---

## LH-6 — Household layer + Summaries / Keepsakes

- **Family overview** rolls up every child (counts, "due soon" for school kids, "up next" for homeschool kids).
- **Family read-alouds** live in `household.readAlouds`, surfaced in each child's Books view.
- **Summary generation** composes from live data per child (goal progress, book titles, trip/beyond counts). Same generator, label + framing flexes: homeschool → documentation-ready "Summaries"; school → keepsake "Keepsakes". Output is editable before export.
- **Resolve open risk (b):** decide merge-on-receive vs accept last-write-wins for `af_lighthouse`. See lighthouse-code-map.md §8 for options.

**Acceptance:** mixed household (one homeschool, one school child) produces a coherent family overview and correct per-child summaries. **Stop and report.**

---

## LH-7 — Persistence bug (decision pending)

**Diagnosis:** The stale-push guard in `pushHouseholdData` (App.jsx:~2493) blocks the lighthouse push and calls `pullLatestHouseholdData` instead. That pull does a full overwrite via `applyHouseholdKey` → `localStorage.setItem("af_lighthouse", JSON.stringify(serverVal))` (sync-core.js:64, comment: "no merge hook yet"), then immediately reloads. Any local edits that hadn't yet been pushed to Supabase are silently lost.

**Fix options:**

- **(a) Local-wins guard** — in the pull path, skip `applyHouseholdKey("lighthouse", ...)` when `"lighthouse"` is present in `af_dirtyKeys` (i.e., local has unsent edits). Simple, low-risk, no merge logic needed. Downside: a device with dirty lighthouse edits will never receive another device's lighthouse changes until it successfully pushes first.
- **(b) Deep merge on receive** — implement a merge hook for the lighthouse key that recursively combines server and local blobs (child by child, day by day) before writing. Correct for multi-device households. Higher complexity; must handle conflicts for every sub-key.

**Decision pending.** Do not touch sync-core.js until one option is chosen.

---

## LH-8 — Export/import, a11y, verify, deploy

- **Export/import guard** for `af_lighthouse` (the piece Safe Harbor SH-2 missed — do not repeat). Add the object-guard block to the import restore handler (template in lighthouse-code-map.md §5).
- Keyboard focus visible; `prefers-reduced-motion` respected; nav scrolls on mobile.
- Final `esbuild` verify (zero warnings).
- Deploy: `./deploy.sh "lighthouse v2 …"`; confirm bundle hash.
- Flag can be flipped ON for the beta household (`hh_o7yzu28`) as the last step.

**Acceptance:** backup/restore preserves a full Lighthouse blob; flag ON works end to end. **Commit + report.**

---

## Session hand-off template

> Read `lighthouse-work-plan.md` and `lighthouse-code-map.md`. We are on **LH-_**. Do only that phase. Respect ES2019/Safari 13 (no `?.`, `??`, `structuredClone`, or JSX style-prop spread). Run the esbuild check after every src change, then stop and report before deploying.
