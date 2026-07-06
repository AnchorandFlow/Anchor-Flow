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
**Status:** Pending

---

## Phase 4 — Developer handoff docs

**Branch:** `cleanup-p4`
**Status:** Pending

---

## Phase 5 — Feature flag & key audit

**Branch:** `cleanup-p5`
**Status:** Pending

---

## Phase 6 — Tiny UX items

**Status:** Pending (time-permitting)
