# RF0 — Manual Smoke Checklist

Run this after every extraction batch before merging. Record results inline. A single ❌ blocks the merge.

---

## How to record results

After each batch, copy the table below and fill in the Status and Notes columns. Commit the filled-in table alongside the batch commit.

Status values: `✅ pass` / `❌ fail (see notes)` / `⚠️ degraded`

---

## S1 — Boot and hydration

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1.1 | Hard reload (Cmd+Shift+R) — app loads without white screen | | |
| 1.2 | On cold boot (clear localStorage), onboarding wizard appears | | |
| 1.3 | After wizard completes, all default tabs are visible | | |
| 1.4 | Closing and reopening the tab restores state without full re-auth | | |
| 1.5 | No `[useSaved]` hydration errors in console | | |
| 1.6 | No `af_lighthouse` key missing from localStorage after boot | | |

---

## S2 — Continuous typing in Settings inputs

This is the highest-risk area. A remount from an incorrect extraction causes focus loss mid-word.

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 2.1 | Open Settings → type 30+ characters rapidly in the "Household name" field — no focus loss, no flicker | | |
| 2.2 | Type in the "Person name" field while another person is visible — no remount | | |
| 2.3 | Type in BrainCats editor (add a new category name) — cursor stays in field | | |
| 2.4 | Edit a Weekly Rhythm label — no focus loss | | |
| 2.5 | Collapse and re-expand a Settings accordion — input state survives | | |
| 2.6 | Type in any `<textarea>` in the AI tab — cursor stays in field | | |

---

## S3 — Sign-out / sign-in cycle

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 3.1 | Sign out via Settings — `_afUserInitiatedSignOut` flag fires before auth event | | |
| 3.2 | After sign-out, app shows auth screen (not blank, not error) | | |
| 3.3 | Sign in with valid credentials — household data loads | | |
| 3.4 | All tabs are visible and rendered (not blank) after sign-in | | |
| 3.5 | Sign in on a device with existing localStorage — data is not doubled | | |

---

## S4 — Cross-device sync round-trip

Requires two browser sessions (or incognito + normal) logged into the same household.

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 4.1 | Edit a task name on device A — appears on device B within 30s | | |
| 4.2 | Edit a Shopping item on device B — appears on device A | | |
| 4.3 | Mark a task complete on device A — status syncs to device B | | |
| 4.4 | `af_dirtyKeys` is cleared in localStorage after successful push | | |
| 4.5 | `af_lighthouse` blob is not empty after sync on device B | | |
| 4.6 | No reload loop (see prior stale-push-loop fix — cb41085, 537c2dc) | | |

---

## S5 — Offline load and recovery

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 5.1 | Go offline (DevTools Network → Offline) — app still loads from service worker | | |
| 5.2 | While offline, create a task — it appears locally | | |
| 5.3 | Reconnect — the task is pushed and `af_dirtyKeys` clears | | |
| 5.4 | `af_lighthouse` data is not erased on reconnect | | |
| 5.5 | Service worker does not reload the page after own push (stale-cache trap fixed in cb41085) | | |

---

## S6 — Navigation and tab mounting

The `display:none` lazy-mount pattern keeps visited tabs alive. Extraction must not change mount lifecycle.

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 6.1 | Click through all tabs in sequence — no white screens | | |
| 6.2 | Return to a previously visited tab — state preserved (e.g. scroll position, open accordion) | | |
| 6.3 | Navigate via sidebar (FlowWrapper) — `openGroup` accordion does not reset | | |
| 6.4 | Navigate to a tab with a URL hash — correct tab opens | | |
| 6.5 | `LIGHTHOUSE_V2`-gated tab: visible only when flag is set | | |

---

## S7 — Task and calendar features

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 7.1 | Add a task — appears in Anchor tab | | |
| 7.2 | Drag-reorder tasks — order persists after reload | | |
| 7.3 | Add a calendar event — appears in Calendar tab | | |
| 7.4 | Edit an event — changes save | | |
| 7.5 | Google Calendar sync (if connected) — events appear | | |

---

## S8 — Meals and shopping

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 8.1 | Assign a meal to a day — persists after reload | | |
| 8.2 | Open MealBankDrawer — renders and items are visible | | |
| 8.3 | Add a shopping item — appears in Shopping tab | | |
| 8.4 | Mark a shopping item purchased — state changes | | |

---

## S9 — Auth token refresh

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 9.1 | Leave app idle 50+ minutes — next action does not 401 | | |
| 9.2 | Two rapid requests at token expiry — only one refresh fires (`_refreshInFlight` mutex) | | |
| 9.3 | Refresh failure falls through to sign-out, not silent hang | | |

---

## S10 — Bundle size gate

Run after every batch. Numbers come from `npm run build` output.

| Metric | Baseline | This batch | Delta | Pass? |
|--------|----------|------------|-------|-------|
| JS gzip (kB) | 369.87 | | | |
| CSS gzip (kB) | 0.77 | | | |
| Build time (ms) | 677 | | | |
| Test count (pass/total) | 260/263 | | | |

Pass criterion: JS gzip delta < 5 kB. CSS identical. Tests 260/263 or better.

---

## S11 — Console and error boundary check

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 11.1 | No React "rendered more hooks than previous render" errors in console | | |
| 11.2 | No "Cannot read properties of undefined" errors on load | | |
| 11.3 | `RootErrorBoundary` does not trigger on normal load | | |
| 11.4 | `SectionErrorBoundary` wrapping is intact (SettingsTab sub-sections, etc.) | | |

---

## Batch result history

| Batch | Date | Tester | Result | Notes |
|-------|------|--------|--------|-------|
| RF-0 (docs only) | baseline | — | n/a | No code changed |
