# Sync Reload Inventory
## Anchor & Flow — Phase A deliverable

**Branch:** design/sync-apply-layer  
**Date:** 2026-07-01  
**Scope:** All 14 `window.location.reload()` calls found in `src/App.jsx`  
**Method:** Read surrounding code for each site; classified by purpose and disposition.

---

## Classification key

| Class | Meaning |
|---|---|
| `user-initiated` | Triggered by an explicit user action (button press, file import) |
| `auth-transition` | Fired after a credential change (sign-up, sign-in, sign-out) |
| `hh-resolution` | Fired when the household ID stored in localStorage is corrected on startup |
| `sync-apply` | Fired after writing remote data to localStorage — the architectural target |

| Verdict | Meaning |
|---|---|
| **KEEP** | Reload is the right UX; no in-place alternative exists |
| **REPLACE** | Can be replaced by `applyRemoteData()` + React setter chain in Phase B |
| **REPLACE (hh-id)** | Can be replaced by calling `setHouseholdId()` + re-running the poll effect |
| **OBSOLETE** | Can be removed entirely (state already managed elsewhere) |

---

## Site-by-site inventory

### Site 1 — Line 345 · ErrorBoundary crash screen

```jsx
<button onClick={function(){ window.location.reload(); }} ...>Reload App</button>
```

**Class:** `user-initiated`  
**State disagreement papering over:** React component tree has crashed — the class boundary caught an uncaught render error and renders a full-screen error UI instead. In-place recovery is not possible because the component tree itself is in an unknown, partially-rendered state.  
**Verdict: KEEP** — This is the canonical React error recovery pattern. There is no in-place alternative.

---

### Site 2 — Line 1563 · Post-backup-restore

```javascript
keys.forEach(function(k){ try { localStorage.setItem(k, data[k]); } catch {} });
alert("Backup restored. Reloading...");
window.location.reload();
```

**Class:** `user-initiated`  
**State disagreement papering over:** The user chose to import a backup file, which bulk-writes 40+ `af_*` keys directly to localStorage. React state (dozens of `useSaved` hooks) is now stale — none of the setters have been called. Calling each setter individually would be fragile and hard to maintain.  
**Verdict: KEEP** — A bulk restore is a deliberate destructive action. The user expects a clean load. After Phase B, `applyRemoteData()` could theoretically handle this too, but there's no urgency; this path fires rarely and the user experience is fine.

---

### Site 3 — Line 2011 · Sign-up success (immediate token, no email confirmation)

```javascript
// Case 1: Got a token immediately (email confirmation disabled)
if (data.access_token && data.user) {
  ...
  localStorage.setItem("af_authToken", JSON.stringify(token));
  localStorage.setItem("af_authUser", JSON.stringify(userObj));
  localStorage.removeItem("af_lastHHSync");
  window.location.reload();
  return { ok: true };
}
```

**Class:** `auth-transition`  
**State disagreement papering over:** Auth state (`authToken`, `authUser`) has been written to localStorage but not to React state. The user transitions from the unauthenticated HomeFlow render to the authenticated render. The entire component tree needs to re-initialize with household data, the poll effect, and the sync system.  
**Verdict: KEEP** — Sign-up is a one-time path and the scope of state change (auth → full app) makes in-place initialization more error-prone than a clean reload. After Phase B, this could become a `setAuthToken()` + `setAuthUser()` call, but it is low-priority.

---

### Site 4 — Line 2141 · Sign-in success

```javascript
// End of signIn() — after household lookup and data hydration
window.location.reload();
return { ok: true };
```

**Class:** `auth-transition`  
**State disagreement papering over:** Same as Site 3 — auth token and user object written to localStorage. Additionally, `signIn` fetches the user's household data and writes it to localStorage before reloading, so the reload also materializes freshly-pulled household state.  
**Verdict: KEEP** — Same reasoning as Site 3. The scope of state change on sign-in is broad enough that a clean reload is the right UX.

---

### Site 5 — Line 2157 · Sign-out

```javascript
async function signOut() {
  ...
  localStorage.removeItem("af_authToken");
  localStorage.removeItem("af_authUser");
  localStorage.removeItem("af_householdId");
  localStorage.removeItem("af_lastHHSync");
  window.location.reload();
}
```

**Class:** `auth-transition`  
**State disagreement papering over:** Auth tokens removed from localStorage but React state (`authToken`, `authUser`, `householdId`) still holds the old values. The entire authenticated UI must be torn down.  
**Verdict: KEEP** — Sign-out requires the full authenticated component tree to unmount cleanly. Calling individual setters risks partial state (e.g., the poll effect could fire once more with a now-invalid token before the effect cleanup runs). A reload is the safest choice here.

---

### Site 6 — Line 2358 · `pullHouseholdData()` after poll-detect pull

```javascript
async function pullHouseholdData(token) {
  // ... fetches row, calls isRemotePayloadSafe, createLocalBackup, sanitizeHouseholdData
  SYNC_KEYS.forEach(k => {
    if (clean1[k] !== undefined) localStorage.setItem("af_"+k, ...);
  });
  localStorage.setItem("af_lastHHSync", row.updated_at);
  window.location.reload();
}
```

**Class:** `sync-apply`  
**State disagreement papering over:** Remote data written to localStorage but no React setters called. React state is now stale for every SYNC_KEYS entry.  
**Context:** `pullHouseholdData` is called from `signIn` for member-household users (line ~2108), after the member's household is looked up. It is a pull-and-apply, not a push-first path.  
**Verdict: REPLACE** — This is a direct apply site. In Phase B, replace the `SYNC_KEYS.forEach + reload` block with `applyRemoteData(clean1, { serverTs: row.updated_at, source: "pull" })`. Priority: **3rd** (called from sign-in, less disruptive than the background poll).

---

### Site 7 — Line 2403 · `joinHousehold()` after applying fresh data

```javascript
async function joinHousehold(token, joinCode) {
  // ... RPC, member row insert, data pull
  SYNC_KEYS.forEach(k => {
    if (clean2[k] !== undefined) localStorage.setItem("af_"+k, ...);
  });
  localStorage.setItem("af_lastHHSync", sourceRow.updated_at);
  window.location.reload();
  return { ok: true };
}
```

**Class:** `auth-transition` + `sync-apply`  
**State disagreement papering over:** User just joined a household — `af_householdId` is new, and remote household data has been written to localStorage. Both auth-adjacent state and SYNC_KEYS data are stale in React.  
**Verdict: REPLACE** — Joining a household is rare but the reload is unnecessary once `applyRemoteData()` exists. Priority: **4th** — low frequency, not on a critical path.

---

### Site 8 — Line 2444 · `pullLatestHouseholdData()` after stale-push-guard pull

```javascript
async function pullLatestHouseholdData(reason) {
  // ... fetches, safety check, backup, sanitize
  SYNC_KEYS.forEach(k => {
    ...
    localStorage.setItem("af_" + k, ...);
  });
  localStorage.setItem("af_lastHHSync", serverTs);
  localStorage.setItem("af_dirtyKeys", "[]");  // ← clears ALL dirty keys
  window.location.reload();
}
```

**Class:** `sync-apply`  
**State disagreement papering over:** Same as other apply sites. Additionally, this site has two additional problems identified in the audit:  
1. **No typing guard** — unlike `checkForUpdates`, this function does not check `isTyping` or `typedRecently` before reloading. A reload can interrupt active typing.  
2. **Clears `af_dirtyKeys` unconditionally** — any local unsaved edits still in the debounce window are silently lost.  

**Verdict: REPLACE** — Priority: **2nd** (worst-case for data loss; no typing guard; called when stale-push guard blocks a push, which happens at any device-B push while device-A is actively editing).  
**Fix note:** When replacing, apply dirty-local-wins merge first (via `mergeDirtyLocalWins`), write only the non-dirty keys, then trigger a push for the dirty keys. Do NOT clear `af_dirtyKeys` unconditionally.

---

### Site 9 — Line 2482 · `syncNow()` post-push pull

```javascript
async function syncNow(opId) {
  // push first (pushHouseholdData) ...
  // then pull back to confirm
  if (lastSync !== rows[0].updated_at) {
    // ... safety check, backup, sanitize, forEach write
    const isTyping2 = ...; const typedRecently2 = ...;
    if (isTyping2 || typedRecently2) { setSyncStatus("synced"); return; }
    window.location.reload();
  }
}
```

**Class:** `sync-apply`  
**State disagreement papering over:** After a successful push+pull cycle, remote data (which may include another household member's changes merged with ours) is written to localStorage. React state is stale.  
**Typing guard present:** Yes — checks `isTyping2` and `typedRecently2` before reloading.  
**Verdict: REPLACE** — Priority: **3rd** (same priority group as Site 6; both are called from the push/pull cycle, not the background poll).

---

### Sites 10–13 — Lines 2520, 2530, 2546, 2556 · Startup household-ID correction

These four reloads are in the startup `useEffect` that runs once on mount to verify and correct `af_householdId`.

```javascript
// Site 10 — Line 2520: stored ID is invalid → found owned household
localStorage.setItem("af_householdId", JSON.stringify(owned[0].id));
window.location.reload();

// Site 11 — Line 2530: stored ID is invalid → found member household
localStorage.setItem("af_householdId", JSON.stringify(memberRows[0].household_id));
window.location.reload();

// Site 12 — Line 2546: no household stored → found owned household
localStorage.setItem("af_householdId", JSON.stringify(rows[0].id));
window.location.reload();

// Site 13 — Line 2556: no household stored → found member household
localStorage.setItem("af_householdId", JSON.stringify(memberRows[0].household_id));
window.location.reload();
```

**Class:** `hh-resolution`  
**State disagreement papering over:** `af_householdId` has been written to localStorage but `householdId` React state (from `useSaved("householdId", null)`) is still the old value. The background poll `useEffect` depends on `householdId` being correct to start syncing.  
**Verdict: REPLACE (hh-id)** — The fix is simpler than a full `applyRemoteData`: call `setHouseholdId(newId)` instead of `localStorage.setItem + reload`. React will re-render and the poll `useEffect` will re-run with the corrected ID (because it depends on `[authToken, householdId]`). No data is pulled at these sites — the correction is purely about the ID value.  
**Priority: 5th** (these happen once per session, only for new/corrected installs; low user-visible impact).  
**Note:** All four sites can be fixed in one PR since the pattern is identical.

---

### Site 14 — Line 2642 · Background poll `checkForUpdates()` — primary P1-1 target

```javascript
async function checkForUpdates() {
  // ... fetches, own-write check, typing/drag/modal guards
  const _safe = isRemotePayloadSafe(row.data, serverTs);
  if (!_safe) return;
  createLocalBackup();
  const cleanBg = sanitizeHouseholdData(row.data);
  SYNC_KEYS.forEach(k => {
    if (k === "mealsWeekOf" && localWeekOf === getThisMonday()) return;
    if (cleanBg[k] !== undefined) localStorage.setItem("af_" + k, ...);
  });
  localStorage.setItem("af_lastHHSync", serverTs);
  window.location.reload();  // ← line 2642
}
```

**Class:** `sync-apply`  
**State disagreement papering over:** Remote data written to localStorage, React state stale. This fires on every 60-second poll tick when the server timestamp has advanced.  
**P1-1 vulnerability:** No dirty-key check before overwriting. The `SYNC_KEYS.forEach` at line 2631 overwrites local localStorage values including any edits still inside the 3-second debounce window. `af_dirtyKeys` is NOT cleared here (unlike `pullLatestHouseholdData`) — but the keys' values are overwritten, so the next push will push the remote data back, not the user's edit.  
**Typing guard present:** Yes — checks `isTyping`, `typedRecently`, `isDragging`, and `hasOpenModal` before reaching the apply block. The P1-1 risk is that the 15-second typing window and guards don't cover the debounce window (3 seconds) for a fast edit → apply cycle.  
**Verdict: REPLACE** — Priority: **1st** — highest frequency, directly causes P1-1 data loss.

---

## Migration order (one site per deploy)

| Deploy | Site(s) | Line(s) | Why first |
|---|---|---|---|
| **B-1** | 14 | 2642 | Highest frequency; P1-1 data loss; typing guards already there so partial fix (dirty-merge) can ship safely |
| **B-2** | 8 | 2444 | No typing guard; clears dirtyKeys unconditionally; second-worst for data loss |
| **B-3** | 6, 9 | 2358, 2482 | Push-first paths; lower data-loss risk; group together since both are in the push/pull cycle |
| **B-4** | 7 | 2403 | Low frequency (join is once per member); safe to defer |
| **B-5** | 10–13 | 2520, 2530, 2546, 2556 | Small pattern, fix all four together with setHouseholdId() |
| **Permanent** | 1, 2, 3, 4, 5 | 345, 1563, 2011, 2141, 2157 | KEEP — crash recovery, user-initiated restore, auth transitions |

---

## Hard-reload escape hatch (Phase B reserved)

After all `sync-apply` sites are replaced, one intentional `location.reload()` remains:  
**App-shell / bundle version change.** If `applyRemoteData` detects that  
`remotePayload._meta.app_version !== APP_VERSION`, it must fall back to  
`window.location.reload()` so the new JS bundle takes effect. This is the  
only case where in-place apply is unsafe (stale JS code applying new data shapes).  

Implementation note: `APP_VERSION` in App.jsx is currently `"2026-06-03-vault-refresh"` while the SW cache key is `"anchor-flow-v20260622-1"`. These must be unified (audit P2) before the version-gate can be wired up.
