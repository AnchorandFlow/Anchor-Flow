# Known Issues

Open items from FINDINGS.md and Phase 1 sprint. Sorted by severity.

---

## F1 — sanitizeHouseholdData: defensive pass-through overwrites array guard

**Severity:** Medium
**Location:** `src/sync-core.js` — `sanitizeHouseholdData()` defensive pass-through block

**What happens:** The array guard block correctly rejects non-array values for keys like
`tasks`. But the defensive pass-through at the bottom runs AFTER and re-writes the value if
`out[key] === undefined && data[key] !== undefined && data[key] !== null`. For a value like
`tasks = {}`, the array guard sets `out.tasks = undefined` (skip), then pass-through writes
`out.tasks = {}` — defeating the guard. The `_SANITIZE_HANDLED` set was added (Phase B) to
exclude explicitly-handled keys, but needs auditing for completeness.

**Tests:** `A4 — non-array in array slot is dropped` — 3 `it.fails` cases guard regression.

**Fix:** Ensure `_SANITIZE_HANDLED` includes ALL explicitly-handled keys so pass-through
cannot override any array-guarded key. Quick audit: compare the array-guard list with
`_SANITIZE_HANDLED` entries.

---

## F2 — exhaleLabels: probable stale write (dead state)

**Severity:** Low
**Location:** `src/App.jsx` — `useSaved("exhaleLabels", ...)` call

**What happens:** `useSaved("exhaleLabels")` writes to `af_exhaleLabels`. SYNC_KEYS uses
`exhale_labels` (underscore) → sync reads `af_exhale_labels`. These are different keys.
`af_exhaleLabels` is never read by the sync loop — it's a device-local orphan.

**Fix:** Confirm `setExhaleLabels` from this call is no longer used in rendering (component
now reads from sync path). Remove the `useSaved` call and migrate existing `af_exhaleLabels`
data to `af_exhale_labels` on load. See safe-harbor-code-map.md for migration pattern.

---

## F3 — checkedPersonalAnchors_: dynamic key accumulation

**Severity:** Low
**Location:** `src/App.jsx:2981`

**What happens:** `useSaved("checkedPersonalAnchors_" + TODAY_NAME + "_" + userId)` writes a
new localStorage key every day per user. Old keys accumulate indefinitely.

**Fix:** On mount, scan `localStorage` for keys matching `af_checkedPersonalAnchors_` prefix
and delete any that don't match today's `TODAY_NAME`. 7 entries max, so not urgent.

---

## F4 — collapsedStores: not in SYNC_KEYS

**Severity:** Very Low
**Location:** `src/App.jsx:2828` — `useSaved("collapsedStores", {})`

**What happens:** Which shopping store sections are expanded/collapsed is device-local.
Collapsing "Costco" on phone does not collapse it on desktop.

**Fix:** Add `"collapsedStores"` to SYNC_KEYS if cross-device UI consistency is desired.
Low priority — this is a preference, not data.

---

## F5 — af_lastPushedAt raw-string format

**Severity:** Low (footgun for future devs)
**Location:** Push success handler, `src/App.jsx:2255`

**What happens:** `af_lastPushedAt` is stored via raw `localStorage.setItem` (not
`JSON.stringify`). Any future reader that uses `lsGet()` or `JSON.parse()` gets a stale or
double-parsed value. All current readers use raw `localStorage.getItem` correctly.

**Fix:** Either normalize to JSON-encoded format (requires migrating existing values on load)
or add a comment near every read/write site warning about the raw format.

---

## F6 — src/sync/syncCore.js: Phase A copy may drift

**Severity:** Low
**Location:** `src/sync/syncCore.js`

**What happens:** Phase A created a partial copy of SYNC_KEYS in `src/sync/syncCore.js`.
The authoritative copy is `src/sync-core.js` (Phase B). If either file is edited independently
they will diverge. The Phase A file is currently unused by the build.

**Fix:** Delete `src/sync/syncCore.js`. Verify no import references it (`grep -r "sync/syncCore"`).

---

## P0-1 — api/anthropic.js: unauthenticated open proxy

**Severity:** CRITICAL — fix before any outside household
**Location:** `api/anthropic.js` (24 lines)

**What happens:** No auth check, no rate limit, no model whitelist. Any HTTP client can
call it with any model and any token count on Lindsey's Anthropic bill.

**Fix:** Delete the file, redeploy. The one internal caller (App.jsx:9032) is already
rewritten by the fetch interceptor to `/api/claude`. Update that line to `/api/claude`
directly so the interceptor shim can eventually be removed.

---

## P0-2 — workDays sync gap

**Severity:** High (silent data loss on cross-device edits)
**Location:** `src/App.jsx:526-527`, called at 5852/5859

**What happens:** `saveWorkDays()` writes `af_workDays` to localStorage directly, bypassing
`useSaved`. `af_dirtyKeys` is never updated. A work-schedule edit pushes only if another
unrelated edit triggers `debouncedSync` in the same session.

**Fix:** After each `saveWorkDays(...)` call, append `"workDays"` to `af_dirtyKeys` and
trigger `debouncedSync`. Same pattern `useSaved`'s setSaved uses.

---

## P0-3 — Stripe test keys committed (rotation pending)

**Severity:** Medium (test keys only, bounded damage)
**Location:** `.env.localsk_test_…` and `.env.localpk_test_…` in git history

**What happens:** Two tracked files contain test-mode Stripe keys. Not the live `.env.local`
(gitignored). Test keys only, so impact is limited.

**Fix:** `git rm` both files + commit (do NOT rewrite history). Roll both keys in the Stripe
dashboard. Update `.env.local` and Vercel env vars.

---

## P1-1 — Poll path can silently discard unpushed local edits

**Severity:** High (data loss window during active editing on slow sync)
**Location:** `src/App.jsx` — `checkForUpdates` polling function (~2630)

**What happens:** When a genuine remote change arrives during the poll, the poll applies
remote data over localStorage WITHOUT first checking `af_dirtyKeys`. Any local edits inside
the debounce window or made offline are overwritten.

**Fix (interim):** In the poll, if `af_dirtyKeys` is non-empty, run `syncNow()` (push-first)
before applying. This is the same fix described in the LAUNCH_READINESS_AUDIT.md (P1-1).

---

## P1-5 — Stale duplicate components

**Severity:** Medium (patch-target trap)
**Location:** Root `ExhaleSection.jsx` (590 lines, pre-V2), root `RipplesRoom.jsx`

**What happens:** The root-level copies are the old, unflagged versions. `deploy.sh git add -A`
re-commits them every deploy. Patching the wrong file is easy.

**Fix:** Delete root `ExhaleSection.jsx`, root `RipplesRoom.jsx`, `src/App.jsx.bak`,
`src/App copy 7.jsx`, `src/components/ExhaleSection.jsx.bak`, `src/components/exhale_mockup.jsx`,
`public/sw.js.bak`. All recoverable from git history.

---

## Phase 1 unresolved — root error boundary

**Severity:** Medium
**Status:** Deferred to Phase 2 (now complete — `RootErrorBoundary` added)

**Note:** Phase 2 added `RootErrorBoundary` wrapping `<FlowWrapper>` in `App` and
`SectionErrorBoundary` around Calendar, Exhale, and Anchor Vault. Any `App`-level crash
that predates React mounting (e.g. module-level IIFE failure) is still unguarded but is
wrapped in try/catch internally.
