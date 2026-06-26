# Anchor & Flow — Next Session Pickup
## State as of 2026-06-26 end-of-session

---

## CONFIRMED DONE — infrastructure

- `household_members` table + RLS. 3 rows backfilled.
- `households_member_access` RLS — members only.
- `join_household(p_code)` SECURITY DEFINER RPC — join flow works under locked-down RLS.
- `exhale_cards` table + `exhale_cards_member` RLS (all ops, household_id in household_members).
- Member household resolution fixed: owner query → `household_members` fallback at ALL three
  resolution points (sign-in, app-load null branch, app-load stale-ID branch). Twyla gets
  `af_householdId` on fresh sign-in now.

## CONFIRMED DONE — Phase 2a Deploy 1 (commit 45a7baa, bundle index-BJtPCN4b.js)

All behind `af_exhale_v2` flag (`localStorage.setItem("af_exhale_v2","true"); location.reload()`):
1. UUID card IDs (`crypto.randomUUID()`)
2. First-run migration: local blob → exhale_cards (per-device flag `af_exhale_migrated_<hhId>`)
3. ADD sync + Realtime subscription (INSERT, dedup, in-place state update, no reload)
4. `persist()` dual-write fix: V2 branch uses raw `localStorage.setItem` only — no lsSet, no blob push

Deploy 2 (remove `exhale_groups` from blob PATCH) is **blocked** until T1–T8 test matrix passes.
See test matrix at bottom of this file.

## CONFIRMED DONE — auth fixes

### Fix 3 (commit 27241d5, bundle index-CXOpPmPR.js) — LIVE
`onAuthStateChange` now handles SIGNED_OUT/null session explicitly:
- Captures `event` (was `_`)
- On `event === "SIGNED_OUT" || !session`: removes `af_authToken`, `af_authUser`,
  `af_refreshToken`, `af_householdId`, and all `af_<SYNC_KEYS>` from localStorage
- Prevents dead-session resurrection on hard reload (the 403-loop-on-reload bug)
- Double-remove with existing `signOut()` is harmless (no-op per spec)

---

## NEXT: Fix 1 — stop dead-token loop in refreshAuthToken()

**Root cause (confirmed):** `supabase.auth.getSession()` returns the cached session
including an EXPIRED access token (it does not validate expiry — it returns whatever
is in `af_supabase_session`). `refreshAuthToken()` sees `sd.session.access_token`
is truthy, writes the expired token to `af_authToken`, returns it as "success."
Callers proceed with a dead token → 403 → retry → same loop.

**The fix (show diff, don't apply yet — user reviews first):**
In `refreshAuthToken()` (~line 1592), after `getSession()` returns a session, check
whether the access token is actually still valid before returning it. Two approaches:

Option A — JWT expiry check (decode the exp claim):
```javascript
const { data: sd } = await supabase.auth.getSession();
if (sd?.session?.access_token) {
  try {
    const exp = JSON.parse(atob(sd.session.access_token.split('.')[1])).exp;
    if (exp * 1000 > Date.now() + 10000) {  // valid for at least 10 more seconds
      try { localStorage.setItem("af_authToken", JSON.stringify(sd.session.access_token)); } catch {}
      if (sd.session.refresh_token) { try { localStorage.setItem("af_refreshToken", sd.session.refresh_token); } catch {} }
      return sd.session.access_token;
    }
    // Token present but expired — fall through to refreshSession()
  } catch(e) { /* malformed JWT — fall through */ }
}
```

Option B — call `supabase.auth.getUser()` instead of `getSession()`:
`getUser()` validates the token against the server (a live network call). If it fails,
the SDK's own refresh fires internally. More reliable but adds a network round-trip.

Recommendation: Option A. Low latency, no extra network call, closes the loop.

After `refreshSession()` fails (the "Refresh Token Not Found" case):
- Current code clears localStorage and calls `supabase.auth.signOut()` (fire-and-forget)
- That signOut triggers SIGNED_OUT → Fix 3 clears localStorage again (harmless no-op)
- No further change needed for the failure path — it already returns null and the startup
  useEffect already calls `showInAppBanner("Session expired...")`

---

## THEN: Fix 2 — sbFetch reads from SDK session, not stale React state snapshot

**Root cause:** `sbFetch` reads the token from `opts._token` (caller-supplied) or falls back
to SUPABASE_KEY (anon). Callers pass `authToken` from React state (`useSaved("authToken")`),
which is a snapshot captured at component mount. The SDK can rotate the token via
`TOKEN_REFRESHED` → `onAuthStateChange` writes new token to `af_authToken` in localStorage —
but the React state `authToken` does NOT update until next re-render. So the 60s poll and
other effects use a stale token until the component re-renders.

**The fix:** in `sbFetch`, when `opts._token` is not provided, call
`await supabase.auth.getSession()` and use the session's access token, falling back to
SUPABASE_KEY. This makes sbFetch always use the SDK's current (auto-refreshed) token.

**Call sites that need care (from analysis):**
- Line 428 `sbAuth()` → `/auth/v1/token` and `/auth/v1/signup`: no `_token`. Bearer token
  unused by Supabase auth server for these endpoints (uses apikey header + body). Safe.
- Line 94 push_subscriptions: no `_token`. Currently uses anon key as Bearer. Fix 2 would
  upgrade to session token — net improvement if RLS on push_subscriptions.
- Line 10459 `/auth/v1/recover`: no `_token`. Public endpoint, anon key correct. Safe.
- All other call sites explicitly pass `_token` — unaffected.

---

## THEN: Fix 4 — remove manual af_refreshToken writes (cleanup)

After Fix 2, `sbFetch` reads from the SDK session. `af_refreshToken` is written by the
manual path and by `onAuthStateChange` (Fix 3 cleared it on SIGNED_OUT), but never read
by the SDK (which reads from `af_supabase_session`). It becomes vestigial.

Remove all `localStorage.setItem("af_refreshToken", ...)` writes. Keep the
`localStorage.removeItem("af_refreshToken")` calls in `signOut()` and `onAuthStateChange`
for one session to ensure old values get cleaned up on existing installs.

---

## Phase 2a Deploy 1 test matrix (gate for Deploy 2)

**Enable flag:** `localStorage.setItem("af_exhale_v2", "true"); location.reload();`
**Disable:** `localStorage.removeItem("af_exhale_v2"); location.reload();`

- T1 Migration: console shows `[AF] Exhale migration done: N card(s)`. Rows in Supabase.
  Reload: migration does NOT re-run (flag set).
- T2 ADD syncs: card appears with "saving…" → disappears. Row in Supabase. No PUSH_STARTED
  in console (blob push silent). `window.AF_TRACE = true` to verify.
- T3 Realtime cross-device: A adds → B sees it within ~2s, no reload.
- T4 Dedup: add a card → appears exactly once (Realtime echo must not double it).
- T5 V2=OFF regression: disable flag, add card → blob push fires normally.
- T6 Failure state: DevTools → Offline → add card → "⚠ not saved" shows.
- T7 V2 card survives blob save: V2 card added on Device A, blob push from Device B,
  reload Device A → V2 card still present.
- T8 Migration idempotency: enable flag on Device B → upsert, no duplicate rows in Supabase.

---

## ROLLBACK

**Auth fixes:** no data risk, no rollback needed.

**Phase 2a / exhale_cards:** disable flag in console. exhale_cards rows are additive, blob
path untouched.

**RLS:** if households_member_access ever causes a lockout:
```sql
CREATE POLICY allow_all_authenticated ON households
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
```

---

## Known minor cleanup (non-urgent)

- `joinHousehold` PUT /auth/v1/user (user_metadata write) 401s — best-effort, non-blocking,
  now redundant since RPC does the real work.
- `af_*` not cleared on sign-up of a new account in a window with stale state (cosmetic;
  server blocks real access). Fix 3 handles sign-out; sign-up path not yet addressed.
- `af_token` (line 11399, no JSON.stringify) written in onAuth callback alongside
  `af_authToken` — redundant, different format. Safe to remove in Fix 4 cleanup.
