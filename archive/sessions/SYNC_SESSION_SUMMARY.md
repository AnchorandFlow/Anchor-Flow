# Sync Diagnosis Session Summary

---

## Phase 2a Deploy 1 — LIVE (commit 45a7baa, bundle index-BJtPCN4b.js)

### What shipped
All changes are behind `localStorage.getItem("af_exhale_v2") === "true"` (`EXHALE_V2` const, read once at mount). With flag OFF, app is completely unchanged.

**1a — UUID card IDs:** When V2 is ON, new cards get `crypto.randomUUID()` IDs instead of `"e"+counter`. Required for global uniqueness across devices (counter collides → ON CONFLICT silently drops a real card).

**1b — First-run migration:** On mount with V2 ON, reads `localStorage af_exhale_groups` blob and upserts all local cards to `exhale_cards` with `ON CONFLICT DO NOTHING`. Per-device flag `af_exhale_migrated_<householdId>` ensures each device contributes its own local-only cards exactly once.

**1c — ADD sync + Realtime:** `handleAdd` V2 branch writes a raw `localStorage.setItem` (no dirty key, no blob push) and then INSERTs a row to `exhale_cards`. Realtime subscription on `exhale_cards INSERT WHERE household_id=eq.<hhId>` applies changes to React state in-place — no reload. Deduplication: if the incoming Realtime row's `id` already exists anywhere in state (own echo from optimistic add), returns `prev` unchanged.

**persist() dual-write fix:** All 9 non-add operations (patchCard, handleDone, handleDelete, handleMoveToCol, etc.) call `persist()`. With V2 ON, `persist()` now does raw `localStorage.setItem` only — no `lsSet`, no dirty key, no blob push. V2=OFF branch is byte-for-byte unchanged.

### What is intentionally deferred
- **Edits, deletes, moves are local-only** under V2 — no row writes yet. Phase 2b work.
- **position: 0** for new adds — display driven by React state, not DB query order. Fix in Phase 2b with fractional positions.
- **Deploy 2 (blob exclusion):** `exhale_groups` is still included in the legacy PATCH payload even with V2 ON. Will be removed ONLY after the test matrix passes.

### Test matrix gate for Deploy 2
See test plan in NEXT_SESSION_PICKUP.md. Deploy 2 must not proceed until all items pass.

---

## Phase 1 Tracer — DEPLOYED (commit 2570d8b)

The `window.AF_TRACE` operation tracer is live. To activate:
```javascript
window.AF_TRACE = true  // run in browser console
```

### What's instrumented
opId (`crypto.randomUUID()`) is generated in `handleAdd` and threaded **explicitly as a parameter** (never global) through the full chain:

```
handleAdd → persist → lsSet → CustomEvent("af-data-changed", { detail: { opId } })
  → onVaultChanged(e) → debouncedSync(opId) → syncNow(opId) → pushHouseholdData(token, hid, opId)
```

### Log stages emitted
| Stage | What it proves |
|---|---|
| `EXHALE_ADD_CLICK` | Handler fired, cardId stamped |
| `LOCALSTORAGE_WRITTEN` | lsSet reached localStorage |
| `DIRTY_KEY_ADDED` / `DIRTY_KEY_ALREADY_PRESENT` | Dirty marking worked or key already queued |
| `SYNC_EVENT_DISPATCHED` | CustomEvent fired |
| `PUSH_SKIPPED: debouncedSync auth/household null { authToken: bool, householdId }` | **Stale closure test** — if authToken: false here, stale closure is confirmed |
| `PUSH_SKIPPED: debouncedSync no dirty keys` | Dirty keys were cleared before debounce fired |
| `DEBOUNCE_SCHEDULED` | 3s timer started |
| `PUSH_SKIPPED: syncNow auth/household null` | Stale closure in syncNow |
| `PUSH_STARTED` | Push entered pushHouseholdData |
| `PUSH_SKIPPED: no-lastHHSync` | Pull-first triggered (no baseline) |
| `PUSH_SKIPPED: stale-push-block` | Server newer than lastHHSync, pulling first |
| `PUSH_SKIPPED: nonNull<2` | Payload almost empty, safety guard |
| `PUSH_SKIPPED: exception <msg>` | Network or auth error |
| `SUPABASE_REQUEST_SENT` | PATCH dispatched, payload keys listed |
| `SUPABASE_RESPONSE_RECEIVED` | Supabase responded |
| `SERVER_DATA_CONFIRMED` | Card found in server response |

---

## Phase 1 Result — COMPLETE

**Push chain works end-to-end.** Incognito clean-session trace confirmed all stages fired with no gaps:

```
EXHALE_ADD_CLICK → LOCALSTORAGE_WRITTEN → DIRTY_KEY_ADDED → SYNC_EVENT_DISPATCHED
→ DEBOUNCE_SCHEDULED → PUSH_STARTED → SUPABASE_REQUEST_SENT
→ SUPABASE_RESPONSE_RECEIVED → SERVER_DATA_CONFIRMED
```

cardId `e1782364848789` confirmed in server response body. Push is **not** broken.

**Root cause identified:** Two-device whole-blob clobbering. Device A pushes all of `households.data` as one JSON blob. Device B pushes its whole blob seconds later, overwriting A's changes. Last write wins at the blob level — any card added on A while B was offline is permanently lost when B syncs.

**Next phase:** Design item-level Exhale writes (Option B: per-card rows). Do not build until DB schema, RLS, and rollback are agreed.

---

## Incognito Trace Instructions (reference)

1. Open app in Incognito (fresh session, no stale localStorage)
2. Sign in, navigate to Exhale
3. In console: `window.AF_TRACE = true`
4. Add a single card with a unique name
5. Paste full `[AF_TRACE <uuid>]` output
6. Interpret against decision tree — the first missing stage is the break point

---

## Open Items

### 1. SERVER_DATA_CONFIRMED uses a time-window, not cardId
Currently finds the confirmed card by `createdAt > Date.now() - 10000` (10s window). This is fine for single-device diagnosis but will give false positives in concurrent tests where two cards are added within 10s.

**Must fix before concurrent tests:** thread `cardId` (item.id from handleAdd) explicitly through to `pushHouseholdData` as a trace-only parameter alongside `opId`, then do an exact ID match in the `_allCards.find()` check.

### 2. `exhale_labels` missing from SYNC_KEYS
`ExhaleSection.jsx` writes column labels to `af_exhale_labels` (key `exhale_labels`).  
SYNC_KEYS contains `exhaleLabels` (camelCase, old key) but NOT `exhale_labels` (snake_case, current key).  
**Result:** column label changes are never pushed to Supabase and never pulled on other devices.  
**Fix:** add `"exhale_labels"` to SYNC_KEYS and to `sanitizeHouseholdData`'s objects list.

### 3. `pulledRecently` guard removed from stale-push-guard (prior session)
`pulledRecently` was removed from the `if (serverUpdatedAt === lastPushedAt || pushedRecently)` check in `pushHouseholdData`. This was intentional: `pulledRecently` was creating a 30s blind window where a device would overwrite server data that was newer than its last pull. The current guard is: own-push match or pushed within 30s.

### 4. Timestamp format mismatch (unresolved)
`new Date().toISOString()` → `Z` suffix. PostgREST returns `+00:00` suffix. The exact-match check `serverTs === lastPushedAt` may fail as a string comparison even when the timestamps represent the same moment. Currently mitigated by `pushedRecently` (30s wall-clock window). Not yet fully resolved — requires either normalizing both to the same format, or storing `lastPushedAt` from the PATCH response body (which returns server format).

---

## Architecture Notes (from session)

- **No Supabase trigger** on the households table — confirmed by user. DB stores exactly the `updated_at` the client sends.
- **Dual auth system**: Supabase SDK session (`supabase.auth`) + custom `af_authToken` in localStorage. SDK auto-rotates tokens via `onAuthStateChange`; `af_authToken` is now kept in sync via the `onAuthStateChange` handler (commit 6c736ca).
- **`refreshAuthToken` now delegates to SDK** (`supabase.auth.getSession()` then `refreshSession()`) — no more manual `/auth/v1/token` calls racing the SDK's own refresh (commit 6321c5e).
- **`cache: "no-store"` on all sbFetch calls** — prevents iOS Safari HTTP caching of Supabase GET responses (commit fb5c9a7).
- **Confirm-GETs removed** from push and pull paths — stale PostgREST read replica values were creating phantom timestamp diffs → reload loops.
- **`window.location.reload()` is the long-term problem** — every sync detection triggers a full page reload. The correct fix is applying pulled data into React state in-place. Deferred as Phase 2+ work.
