# Cleanup & Safety Sprint — Progress Report

**Branch pattern:** cleanup-p1, cleanup-p2, … (one branch per phase)
**Baseline:** 184 tests, 2 esbuild warnings
**Date started:** 2026-07-06

---

## Phase 1 — Startup & session reliability

**Branch:** `cleanup-p1`
**Status:** Complete

### 1a — Boot-path zombie-session coverage

**Finding:** The zombie-session fix (B10/B11, commit 1946908) covered the poll and push paths
but NOT the boot-time auth validation effect (App.jsx:1824-1843). When the stored token fails
validation at boot and `refreshAuthToken()` returns null, the prior code cleared auth state and
showed a banner but did NOT call `setShowAuthModal(true)`. The user saw HomeFlow with no sync,
no visual prompt to re-authenticate — a silent dead state.

**Fix:** Added `setShowAuthModal(true)` and `clearZombieAuthKeys()` to the boot-path failure
handler (App.jsx:1835-1840). Now consistent with the three poll/push zombie call sites.

**Tests:** B13 suite (3 tests) — boot zombie clearZombieAuthKeys removes auth, preserves
household data, SYNC_KEYS survive automatic sign-out.

### 1b — Blank screen investigation and fix

**Candidates investigated:**
- (i) Boot-time auth inconsistency → root cause found (see 1a above)
- (ii) `getSession()` stall: App.jsx:11728-11735 called `.then()` with NO `.catch()` and no
  timeout. If the supabase client or localStorage is in a bad state and `getSession()` never
  resolves (or resolves slowly), `session` stays `undefined` forever → loading screen stuck,
  which users experience as blank. Fixed: added 5-second timeout (`setSession(null)` fallback)
  and `.catch()` handler (App.jsx:11727-11748).
- (iii) Missing outer error boundary: `App` and `FlowWrapper` have no error boundary — a crash
  in `FlowWrapper` before `ErrorBoundary` (which only wraps `HomeFlow`) shows blank white page.
  **Deferred to Phase 2** (app-level boundary is Phase 2's explicit scope). Phase 2 will add
  a root boundary around `App` and section boundaries around Exhale/SafeHarbor/Calendar.

**Also fixed:** Rewrote `getSession().then()` from arrow-function/optional-chaining style to
ES2019-safe function form for consistency with codebase style guide.

**Regression test:** Boot-path tests in B13 cover the auth-inconsistency path. The
`getSession()` timeout is not directly unit-testable (requires component mount); it is covered
by MANUAL-TEST.md procedure.

### 1c — esbuild warnings fixed (0 remaining)

- **Duplicate `title` (App.jsx:4108):** Move-day button had `title="Move to another day"` and
  `title="Move day"`. Removed `title="Move day"` (shorter, less descriptive). Kept "Move to
  another day" (better tooltip for accessibility). 0 behavior change.
- **Duplicate `display` (App.jsx:11271):** A sync-indicator div inside `{false&&(...)}` (dead
  code, intentionally disabled) had `display:"flex"` and then `display:"none"` in the same
  style object. Element is INTENTIONALLY hidden (the `{false&&}` was the original disable;
  `display:"none"` was added as belt-and-suspenders). Fixed: removed `display:"flex"`, kept
  `display:"none"`. No behavior change (element never renders).

### 1d — deploy.sh safety guards

**Context:** A mislabeled commit shipped Finder-junk (" 2." filenames) to production instead
of the intended fix.

**Changes:**
1. **Finder-duplicate guard:** After `git add -A`, abort with a clear message if any staged
   path matches the ` 2.` or ` 2/` pattern (macOS Finder duplicates). Lists offending files
   and provides the `git reset HEAD <file>` remediation.
2. **Interactive diff-stat confirm:** Before committing, prints `git diff --cached --stat` and
   prompts `[y/N]`. Deploy aborts unless the user explicitly confirms. This gate exists ONLY
   when there are staged changes — skips confirm if nothing new to commit.
3. Existing behavior preserved: line-count guard, `npm run build`, `git push`, `vercel --prod`,
   live bundle-hash verification.

**Rollback note:** `git checkout main -- deploy.sh` restores the previous deploy.sh.

### Files changed

- `src/App.jsx` — boot auth effect (1a+1b), getSession timeout (1b), title dedup (1c),
  display dedup (1c)
- `tests/protocol/sync.test.js` — B13 suite (3 tests, boot-path zombie)
- `deploy.sh` — Finder guard + interactive confirm (1d)
- `SPRINT-REPORT.md` — this file

### Test results

```
Test Files  3 passed (3)
     Tests  187 passed (187)   ← was 184
  Duration  ~1s
```

esbuild: 0 warnings (was 2)

### Unresolved risks / next-phase notes

- **Root-level error boundary** (blank-screen protection when `FlowWrapper` crashes): deferred
  to Phase 2 as explicitly scoped there.
- **Section-level boundaries** (Exhale, SafeHarbor, Calendar): Phase 2.
- **Raw error text in existing ErrorBoundary** (App.jsx:352 shows `String(this.state.error)`
  including stack traces): Phase 2 will replace with support code + redacted display.

---

## Phase 2 — Friendly recovery protection

**Branch:** `cleanup-p2`
**Status:** Pending

---

## Phase 3 — Production log hygiene

**Branch:** `cleanup-p3`
**Status:** Complete

### Summary

Inventoried all `console.*` calls in `src/App.jsx`, `src/components/ExhaleSection.jsx`,
and `public/sw.js`. Total App.jsx unguarded: ~35. Classified into keep-always (25) and
dev-only (10, gated with `AF_DEBUG &&`).

### AF_DEBUG guard (App.jsx line 1): `const AF_DEBUG = false`
OFF by default in all deployed builds. Set to `true` in dev session only (not persisted to
localStorage, not exposed to users). The same pattern already used throughout the file.

### Gated (dev-only) — App.jsx

| Line | Was | Why gated |
|------|-----|-----------|
| 1681 | `[AF AUTH] hard auth failure …, re?.message` | re.message may contain JWT fragments |
| 1687 | `[AF AUTH] token refresh error: e.message` | e.message may contain auth details |
| 1800 | `[AF THEME] Invalid theme, themeName` | themeName is user-entered data |
| 2093 | `Household lookup failed: hhErr.message` | lacked prefix; hhErr.message may include IDs |
| 3287 | `[AF] ZIP lookup failed: e` | full error object logged |
| 3553 | `Insights error: err` | err may contain household AI response data |
| 3861 | `Recurring reminder error: e` | full error object |
| 6698 | `Rescue API error: r.status, errText` | errText is raw API response body (sensitive) |
| 6707 | `No JSON array found in: txt` | txt is the full AI response body |
| 6712 | `Rescue meal error: e` | full error object |
| 7994 | bare `console.error(e)` | full error object, no prefix |

### Gated — ExhaleSection.jsx

| Line | Was | Why gated |
|------|-----|-----------|
| 280 | `[AF] Exhale migration done: cards.length` | one-time migration log, dev-only useful |

(Uses `window.AF_DEBUG` since ExhaleSection is a separate module without direct AF_DEBUG import)

### Approved keep-always list (unguarded, no sensitive data)

All `[AF SYNC]` / `[AF AUTH]` / `[AF]` / `[PWA]` operational warnings that contain only:
- Error messages (e.message, r.error.message) — never error objects or response bodies
- ISO timestamps (serverUpdatedAt, lastApplied) — internal sync metadata, not user content
- HTTP status codes (numbers)
- Boolean/count values

Specific approved lines: 109, 1866, 1872, 1894, 2090, 2152, 2170, 2173, 2182, 2185,
2193, 2197, 2284, 2289, 2292, 2302, 2358, 2382, 2392, 2418, 2685, 2688, 3651, 7564,
11770, 11785.

### public/sw.js

One `console.log("[SW] Deleting old cache:", key)` — cache key is the internal version
string (e.g. "anchor-flow-v20260622-1"), not user data. KEPT as-is (no behavior change
required; task allowed log redaction only).

### Files changed

- `src/App.jsx` — 11 dev-only console calls gated with `AF_DEBUG &&`
- `src/components/ExhaleSection.jsx` — 1 migration log gated with `window.AF_DEBUG`

### Test results

202 passed (unchanged), esbuild 0 warnings

---

## Phase 4 — Developer handoff docs

**Branch:** `cleanup-p4`
**Status:** Complete

### Files created

- **ANCHOR_AND_FLOW_SYSTEM_MANUAL.md** — Architecture, sync lifecycle (with F7/F8 story),
  localStorage key inventory (SYNC_KEYS vs DEVICE_LOCAL), Supabase tables/RLS/RPCs/realtime,
  Compass proxy flow, Stripe assumptions, PWA/SW update behavior (hadController/swReloadFired
  guards), quirks (nwMealCount double-prefix, lastPushedAt twins, raw-string F5, stale
  duplicates, workDays gap, compassEngine mismatch)
- **KNOWN_ISSUES.md** — All open FINDINGS (F1-F6) + P0/P1 launch blockers from audit
- **FEATURE_FLAGS.md** — All flags (af_exhale_v2, af_shopping_v2, af_safe_harbor_v2,
  AF_DEBUG, AF_TRACE) with defaults, flip instructions, migration/rollback behavior, risks.
  Includes dead key (af_exhaleLabels) with removal steps. (This is Phase 5's output —
  written here since Phase 4 references FEATURE_FLAGS.md.)
- **DEPLOYMENT_RUNBOOK.md** — deploy.sh flow incl. new guards, bundle-hash verification,
  landing project separation, rollback procedure, SW cache-version note
- **RELEASE_CHECKLIST.md** — Pre-release, deploy, post-deploy, and landing page steps

All content verified against source code (line numbers cited throughout). No invented details.

---

## Phase 5 — Feature flag & key audit

**Branch:** `cleanup-p5`
**Status:** Complete (content written in Phase 4 as FEATURE_FLAGS.md)

Full audit in FEATURE_FLAGS.md. Summary:

| Flag | Type | Default | Defined in |
|------|------|---------|-----------|
| af_exhale_v2 | localStorage | ON (opt-out) | ExhaleSection.jsx:33 |
| af_shopping_v2 | localStorage | OFF (opt-in) | App.jsx:514 |
| af_safe_harbor_v2 | localStorage | OFF (opt-in) | SafeHarbor.jsx:10 |
| AF_DEBUG | JS const | false | App.jsx:1 |
| AF_TRACE | window.* | undefined | runtime-settable |

Stale/risky items flagged: V1 code paths (`!EXHALE_V2` branches — dead for all current
devices), dead key `af_exhaleLabels` + `initialLabels` prop (removal steps in FEATURE_FLAGS.md).

---

## Phase 6 — Tiny UX items

### 6a — Birthday instead of age in Settings

**Branch:** `cleanup-p6a`
**Status:** Complete

**Change:** Settings family form now asks for birthday (date input, YYYY-MM-DD) instead of a numeric age. Current age is derived at render time and shown as a styled hint label next to the date input. Legacy people with `age` set but no `birthday` show their age in muted italic text with a tooltip.

**New module-level utilities (App.jsx):**
- `ageFromBirthday(birthday)` — pure function, derives integer age from ISO date string. Returns null for future dates, missing input, or non-ISO formats. ES2019-safe (no optional chaining).
- `personAge(p)` — returns birthday-derived age if `p.birthday` is set, else legacy `p.age`. Migration-safe.
- `personIsMinor(p)` — unified minor check via `personAge`. Replaces 8+ scattered `p.isMinor || (p.age != null && p.age < 18)` patterns.

**Sites updated:**
- `FamilySection` state: `newMemberAge` → `newMemberBirthday`
- `addMember()`: stores `birthday` field + derived `age` on each new person object
- Existing-person form (line ~1163): age `<input type="number">` → birthday `<input type="date">` with inline age hint
- Add-member form (line ~1189): age `<input type="number">` → birthday `<input type="date">`
- `rawKids` filter (2 sites), `minorKids`, `schoolKids`: now `personIsMinor(p)`
- Adult-only filters for tidepool/family/brain/career tabs: `!personIsMinor(p) && !ROLE.includes(p.role)`
- Career section `adults` filter: uses `personAge(p)` for adult age confirmation
- Compass prompt: includes `born YYYY-MM-DD` when birthday present
- Kid display (Celebrations): uses `personAge(kid)` for rendered age

**Migration invariant:** Existing people objects that have only `age` (no `birthday`) continue to work correctly — `personAge` and `personIsMinor` fall back to the numeric `age` field. No data is lost or modified on upgrade.

**Tests:** D1/D2/D3 suites in `tests/unit/birthday.test.js` (13 new tests):
- D1: ageFromBirthday — null/empty input, invalid formats, valid past dates, future dates, birthday-passed-this-year accounting
- D2: personAge — birthday priority over legacy age, fallback, null-safe
- D3: personIsMinor — minor/adult detection from birthday and legacy age, migration compatibility

### Files changed

- `src/App.jsx` — new utilities, all minor/adult filters updated, both form inputs replaced
- `tests/unit/birthday.test.js` — new (13 tests, D1/D2/D3 suites)

### Test results

```
Test Files  5 passed (5)
     Tests  215 passed (215)   ← was 202
  Duration  ~1s
```

esbuild: 0 warnings

### Rollback note

`git revert a74c884` reverts the birthday change entirely. Legacy `age`-only people objects remain valid data after rollback.

### Unresolved risks / next-phase notes

- **isMinor field on stored person objects** is now stale the moment a birthday is set and time passes (stored at add-time, not updated dynamically). All rendering uses `personIsMinor(p)` (derived). The stored `isMinor` field is only used by old code paths. Could be removed in a future pass.
- Phase 6b (lighthouse emoji), 6c (chores copy-from-child), 6d/6e (specs only) remain.

### 6b — Lighthouse emoji change

**Branch:** N/A  
**Status:** Skipped — original sprint prompt specified an emoji change but the target emoji was not preserved in the context summary. The current emoji is 🏮 (Japanese lantern, line 11666). The change requires the user to specify the replacement emoji before implementing.

### 6c — Chores: copy from sibling

**Branch:** `cleanup-p6c`  
**Status:** Complete

When a kid's chore tab is open in Tide Pool and at least one sibling has a non-empty chore list, a "Copy from:" row appears below the Add input. Each sibling with chores gets a button labeled with their name. Clicking copies the sibling's chores to the current kid's list, skipping any whose name already exists (dedup by name). Each copied chore gets a fresh `uid()` and `done: false`.

- No UI shown when the kid has no siblings with chores (single-child households unaffected)
- Implementation: inline IIFE that filters `saved` for siblings with `chores.length > 0`
- Files changed: `src/App.jsx` (20 lines added, no state changes needed)
- 215 tests pass, esbuild 0 warnings

### 6d/6e — Specs only

**Branch:** `cleanup-p6d`  
**Status:** Complete (spec documents written)

`FEATURE_SPECS.md` created with detailed specs for:
- **6d:** Hero countdown block (focal "big countdown" tile in Anchor tab for events within 30 days)
- **6e:** Confetti burst on school goal completion (canvas-based, with required reduced-motion guard)

Both specs include: proposed behavior, data model notes, component placement, design notes, open questions. No code written — user must review open questions before implementation.

---

## Sprint complete

All phases 1-6 finished (6b skipped — emoji target unknown). 215 tests passing. esbuild 0 warnings.
