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

## LH-4.6 — Challenges (season-aware, mixed auto/manual progress)

**Goal:** Preserve the existing `af_schoolData` break-goals model in Lighthouse so the active reading challenge (and any others) migrate cleanly and remain usable. Challenges live in `shared[childId]` because they are mode-agnostic — they apply equally to homeschool and school children.

### Data model

Add `challenges: []` to `shared[childId]`. A challenge record:

```js
{
  id:           string,    // uid() — 7-char base36
  season:       "summer" | "winter" | "spring" | "school-year",
  type:         "goal" | "reading" | "daily",
  title:        string,    // e.g. "Read 30 books this summer"
  target:       string,    // numeric target as a string, e.g. "30"
  unit:         string,    // "books", "days", "hours", etc.
  startDate:    string,    // ISO date (YYYY-MM-DD) — determines auto-progress window
  manualAdjust: number,    // stored integer, adjustable via +/−, may be negative
  notes:        string,
}
```

`autoProgress` is **never stored** — derived at render time:

```js
function lhChallengeAutoProgress(books, startDate) {
  // Only meaningful for unit === "books". Called with shared[childId].books.
  if (!Array.isArray(books) || !startDate) return 0;
  return books.filter(function(b) {
    return b.status === "finished" && b.finish && b.finish >= startDate;
  }).length;
}
// For non-books units: caller passes autoProgress = 0.
```

`displayProgress = autoProgress + manualAdjust`. This sum is what the progress bar and "X / target" label show.

### Progress card display rules

Always show both:
- **+/− buttons** — adjust `manualAdjust` only, even for `unit === "books"`. The user can correct for double-counts or add reads not in the Books log.
- **Breakdown label** — always visible when `unit === "books"` and `target` is set:
  - `"11 from Books log, +3 added"` (manualAdjust > 0)
  - `"11 from Books log"` (manualAdjust === 0)
  - `"11 from Books log, −2 removed"` (manualAdjust < 0)
  - For non-books: standard `"X / target unit"` only, no breakdown.

No auto-dedupe between `autoProgress` and `manualAdjust`. If a title is both in the Books log and hand-counted, the breakdown surfaces it and the user corrects via the − button.

### New pure helpers

```js
// Immutable shared-array helpers (same pattern as lhAddItem/lhUpdateItem/lhDeleteItem)
lhAddChallenge(lh, childId, challenge)    // appends to shared[childId].challenges
lhUpdateChallenge(lh, childId, id, patch) // immutable patch on matching challenge
lhDeleteChallenge(lh, childId, id)        // filters out matching challenge
lhChallengeAutoProgress(books, startDate) // pure, no side effects
```

### `defaultLighthouse()` change

Add `challenges: []` to the default shared child shape, alongside `books`, `beyond`, `trips`, `goals`.

### Season filter

Four seasons in the UI: Summer, Winter, Spring, School Year. The "All" view shows every challenge regardless of season. The current season is highlighted in the header but all seasons are always editable. No auto-detection of "current" season — user picks which panel to view.

### Tests to add (LH-4.6-A through LH-4.6-C)

- **LH-4.6-A** (`lhChallengeAutoProgress`): empty books array → 0; all books before startDate → 0; books on startDate → count; books after → count; mixed → only on/after; non-books call with 0 → 0.
- **LH-4.6-B** (immutable helpers): `lhAddChallenge` does not mutate original; `lhUpdateChallenge` patches only named field; `lhDeleteChallenge` removes only target; sibling child unaffected.
- **LH-4.6-C** (displayProgress): `autoProgress + manualAdjust` arithmetic; negative manualAdjust produces correct total; zero autoProgress for non-books.

**Acceptance:** A challenge with `unit === "books"` shows the breakdown label; the + and − buttons are always present; manualAdjust persists; autoProgress updates when a new book is finished. Non-books challenges behave identically to the old breakGoals manual counter. **Stop and report.**

---

## Migration note — `af_schoolData.breakGoals` → `shared[childId].challenges`

**When to run:** as the last step of LH-4.6, or as a one-time migration triggered from Settings when the user first enables Lighthouse. Do NOT run silently on load without user confirmation.

**Field mapping (1:1, nothing dropped):**

| `breakGoals` field | `challenges` field | Notes |
|---|---|---|
| `id` | `id` | identical |
| `break` | `season` | same string values: "summer"/"winter"/"spring" |
| `type` | `type` | same values: "goal"/"reading"/"daily" |
| `title` | `title` | identical |
| `target` | `target` | identical (string) |
| `unit` | `unit` | identical |
| `progress` | `manualAdjust` | old hand-count becomes the manual adjustment |
| `notes` | `notes` | identical |
| *(none)* | `startDate` | set to migration date (today's ISO date) |

**Why `startDate = migration date`:** Books logged before the migration would not have been counted in the old manual counter. Setting startDate to today means autoProgress starts at 0 for migrated challenges, so `displayProgress = 0 + old progress = old progress`. The exact number the user had is preserved with no surprise jump.

**Source read:** `JSON.parse(localStorage.getItem("af_schoolData") || "{}")`.  
**Destination write:** `lhAddChallenge(lh, childId, migratedChallenge)` for each breakGoal, then persist via `setLighthouse`.

**Child id mapping:** `af_schoolData` is keyed by the same person id (`af_people` → `person.id`) that Lighthouse uses. No translation needed — the key is identical.

**What is NOT migrated:** `childData.type`, `childData.public`, `childData.homeschool` from `af_schoolData`. These belong to the legacy SchoolTab's own data model. Only `breakGoals` is migrated into Lighthouse.

**Post-migration:** `af_schoolData` is left untouched (no deletion). SchoolTab continues to show the original data if somehow reached. No data is destroyed.

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

## LH-7 — Export/import, a11y, verify, deploy

- **Export/import guard** for `af_lighthouse` (the piece Safe Harbor SH-2 missed — do not repeat). Add the object-guard block to the import restore handler (template in lighthouse-code-map.md §5).
- Keyboard focus visible; `prefers-reduced-motion` respected; nav scrolls on mobile.
- Final `esbuild` verify (zero warnings).
- Deploy: `./deploy.sh "lighthouse v2 …"`; confirm bundle hash.
- Flag can be flipped ON for the beta household (`hh_o7yzu28`) as the last step.

**Acceptance:** backup/restore preserves a full Lighthouse blob; flag ON works end to end. **Commit + report.**

---

## Session hand-off template

> Read `lighthouse-work-plan.md` and `lighthouse-code-map.md`. We are on **LH-_**. Do only that phase. Respect ES2019/Safari 13 (no `?.`, `??`, `structuredClone`, or JSX style-prop spread). Run the esbuild check after every src change, then stop and report before deploying.
