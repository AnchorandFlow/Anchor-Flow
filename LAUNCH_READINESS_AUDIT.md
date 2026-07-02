# Anchor & Flow — Launch-Readiness Engineering Audit (Pass 1)

**Date:** July 1, 2026
**Auditor:** Claude Fable 5 (read-only pass — no code was modified)
**Source:** Repository snapshot `af-audit.zip` (12 MB, excludes node_modules/.git/dist/.env/backups/supabase .temp)
**Build verification:** `npm ci && npm run build` succeeds — Vite 8.0.10, 78 modules, 946 ms, bundle 1,536 KB min / 364 KB gzip, ES2019 target confirmed in output (no untranspiled optional chaining; the 12 `?.` matches in the bundle are decimal ternaries like `r?.25:1`).

---

## Verdict

**Trusted friends-and-family beta: GO, after three fixes** (P0-1, P0-2, P0-3 below — combined effort roughly one evening).
**Paid founding beta: NO-GO** until billing exists (backlog item 7), the test suite exists (item 2), and the poll-path silent-overwrite (P1-1) is mitigated.
**Public launch: NO-GO** — gated on everything above plus the security pass-2 items at the end of this document.

The overall picture is better than the backlog's tone suggests. The auth layer, the AI proxy (`api/claude.js`), the service worker, and the push-safety guards are genuinely well-built — the incident history left behind real hardening, not just patches. The remaining risks are specific and enumerable, not systemic.

---

## System map (verified against source)

```
Browser (React 19 / Vite 8, ES2019 target, single 11,718-line src/App.jsx)
│
├─ localStorage: af_* keys
│    ├─ SYNC_KEYS (63 logical keys, App.jsx:451) ↔ pushed/pulled as one
│    │   household document via households.data (JSON column)
│    ├─ af_dirtyKeys — per-device dirty tracking, written ONLY by useSaved's
│    │   setSaved (App.jsx:1697–1722), suppressed during _afHydrating
│    ├─ af_backup_<ts> — local snapshots, retention 3 (App.jsx:1831)
│    └─ flags: af_exhale_v2 (opt-OUT, default on), af_shopping_v2 (opt-IN,
│        default off), af_shopping_v2_backfilled_<hid>
│
├─ Supabase (sbgbyptkunvyxjfpzght)
│    ├─ households (id text, owner_id uuid, data jsonb, updated_at) — whole-doc sync
│    ├─ household_members (member resolution fallback, owner row written on
│    │   first push, App.jsx:2293–2299)
│    ├─ shopping_items + 4 RPCs (add/toggle/update/delete) + realtime channel
│    │   "shopping-<hid>" (App.jsx:7341–7484)
│    ├─ exhale_cards + RPCs (update/delete/move) + realtime channel
│    │   "exhale-<hid>" (ExhaleSection.jsx:337–716); REPLICA IDENTITY FULL required
│    ├─ rpc/join_household (SECURITY DEFINER)
│    └─ Auth: supabase-js session (storageKey af_supabase_session) + manual
│        af_authToken copy; refreshAuthToken is single-flight w/ exp check
│
├─ Vercel serverless /api
│    ├─ claude.js       — hardened proxy (JWT verify, model map, caps, rate limit) ✅
│    ├─ anthropic.js    — LEGACY OPEN PROXY, no auth ❌ (P0-1)
│    ├─ send-notifications.js — uses SERVICE key; fails OPEN if CRON_SECRET unset (P1-2)
│    └─ subscribe.js    — open Kit relay, formId client-supplied (P3)
│
├─ Sync lifecycle
│    ├─ edit → setSaved marks dirty → debouncedSync → pushHouseholdData
│    │   (full SYNC_KEYS payload, stale-push guard, nonNull<2 refusal,
│    │   PATCH w/ return=representation, af_lastPushedAt stamped from sent value)
│    ├─ poll: 5 s initial + 60 s interval → own-write reconcile → typing/drag/
│    │   modal guards → isRemotePayloadSafe → backup → apply → location.reload()
│    └─ pullLatestHouseholdData: apply → clear dirtyKeys → unconditional reload
│
├─ PWA: sw.js cache anchor-flow-v20260622-1; network-first HTML, cache-first
│    hashed assets, API never cached, activate deletes all old caches ✅
│
└─ Deploy: deploy.sh — line-count guard (>5000), build, git add -A, push, vercel --prod
```

---

## Risk register

### P0 — fix before any outside household

**P0-1. `api/anthropic.js` is a live, unauthenticated, open proxy to the Anthropic API.**
*Evidence:* `api/anthropic.js` (entire file, 24 lines) — no auth check, no rate limit, no model whitelist; forwards `req.body` verbatim with `ANTHROPIC_API_KEY`.
*Repro:* `curl -X POST https://www.anchorandflowapp.com/api/anthropic -H 'Content-Type: application/json' -d '{"model":"claude-opus-4-8","max_tokens":8000,"messages":[...]}'` — runs on Lindsey's API bill, any model, any size, from anywhere.
*Why it survived:* the client-side fetch interceptor (App.jsx:381–385) rewrites `/api/anthropic` → `/api/claude`, so the app works and nothing appears broken — but the interceptor protects only the app's own calls, not the deployed endpoint.
*Fix:* delete the file, redeploy, and check Anthropic console usage for anomalies. The one internal caller (App.jsx:9032) is already rewritten by the interceptor, but update it to `/api/claude` anyway so the interceptor shim can eventually die.
*Effort:* 15 minutes.

**P0-2. `workDays` edits never mark dirty → work schedules don't sync on their own.**
This resolves the backlog's "SYNC_KEYS workDays audit." The key mapping is **correct**: SYNC_KEYS stores logical names (`"workDays"`, App.jsx:476), the push serializer reads `af_workDays` (App.jsx:2227), and both hydration paths write `af_workDays` back — names match end-to-end. The defect is upstream: workDays bypasses `useSaved`. It uses plain `useState(getWorkDays)` (App.jsx:2957) and `saveWorkDays()` writes localStorage directly (App.jsx:526–527, called at 5852/5859) without touching `af_dirtyKeys`. Since `debouncedSync` only fires when dirty keys exist, a work-schedule edit pushes **only if it hitchhikes on some other edit in the same session**. This exactly matches the symptom of "sometimes syncs, sometimes doesn't."
*Fix:* in `_saveEntry` and `_removeEntry` (App.jsx:5849–5862), after `saveWorkDays(_upd)`, append `"workDays"` to `af_dirtyKeys` and invoke the debounced sync — same pattern setSaved uses. Same audit should be run on the other SYNC_KEYS entries that use bespoke storage helpers instead of useSaved (`cal_markers`, `cal_marker_types`, `traditions`, `exhale_*` — see P1-4).
*Effort:* small patch + a two-device verification.

**P0-3. Stripe test keys committed to git history (filenames), rotation pending.**
Already identified before upload: two tracked files named `.env.localsk_test_…` / `.env.localpk_test_…`. Test-mode keys, so bounded damage, but the checklist stays open until (a) `git rm` + commit is done and (b) both test keys are rolled in the Stripe dashboard and updated in `.env.local` + Vercel. Do **not** rewrite history; rotation makes the leaked values dead. The real `.env.local` was never committed — `.gitignore`'s `*.local` rule works.

### P1 — before paid founding beta

**P1-1. Poll path can silently discard unpushed local edits.**
`syncNow` is safe (push-first, then pull — App.jsx:2431+). The background poll is not: when a genuine remote change arrives, it applies remote data over localStorage **without checking `af_dirtyKeys`** and reloads (App.jsx:2604–2626). Any local edits still inside the debounce window — or made offline — are overwritten. Worse, `pullLatestHouseholdData` explicitly clears `af_dirtyKeys` after overwriting (App.jsx:2423), erasing the evidence that anything was lost. This is the concrete form of the known last-write-wins architecture risk (backlog item 5). Interim mitigation that doesn't require the full item-level migration: in the poll, if `af_dirtyKeys` is non-empty, run `syncNow` (push-first) instead of apply-and-reload; in `pullLatestHouseholdData`, don't clear dirty keys whose local values weren't overwritten by the remote payload.

**P1-2. `send-notifications.js` fails open and holds the service-role key.**
App.jsx uses only the anon key (correct), but this endpoint uses `SUPABASE_SERVICE_KEY` (RLS bypass) and its auth is `!CRON_SECRET || authHeader === … || querySecret === …` (send-notifications.js:97). If the `CRON_SECRET` env var is ever missing in Vercel, the endpoint is publicly callable with service-role power. Fix: fail closed (`if (!CRON_SECRET) return 500`), drop the query-string secret path (secrets in URLs get logged), and verify the env var is actually set in Vercel today.

**P1-3. Mixed-mode household risk from per-device feature flags.**
`SHOPPING_V2` is opt-in (`=== "true"`, App.jsx:494); `EXHALE_V2` is opt-out (`!== "false"`, ExhaleSection.jsx:33). With Shopping V2 off by default, a household can have one device writing `shopping_items` rows and another writing the legacy array inside the household doc — two sources of truth diverging. This is the backlog's item 6, but it should be understood as *currently possible*, not theoretical. Until the flag flips default-on, don't enable `af_shopping_v2` on only one of a household's devices.

**P1-4. Bespoke-storage SYNC_KEYS entries need the same dirty audit as workDays.**
Keys synced in SYNC_KEYS but written outside `useSaved` are all suspects for the P0-2 pattern: `cal_markers`, `cal_marker_types`, `traditions`, and the four `exhale_*` legacy keys. Each needs a 5-minute trace: where is it written, and does that write mark dirty? (Not verified in this pass — flagged for the fix session.)

**P1-5. Stale duplicate components are still live patch-target traps.**
Root `ExhaleSection.jsx` (590 lines) is the **pre-V2** version — it has no `EXHALE_V2` flag at all — while the real one is `src/components/ExhaleSection.jsx` (1,046 lines). Root `RipplesRoom.jsx` likewise differs from `src/shell/RipplesRoom.jsx`. This exact trap already bit once (`patch_exhale_v2.py` history). Also stale: `src/App copy 7.jsx` (11,204 lines), `src/App.jsx.bak` (11,349 lines), `src/components/ExhaleSection.jsx.bak`, `src/components/exhale_mockup.jsx`, `public/sw.js.bak`. Because `deploy.sh` runs `git add -A`, every one of these keeps getting re-committed. Delete them in a single hygiene commit (they're recoverable from git history if ever needed).

**P1-6. Three different privacy policies exist simultaneously.**
`privacy.html` (root, 9.3 KB), `public/privacy.html` (10.7 KB — this one ships with the app at anchorandflowapp.com/privacy.html), and `anchor and flow- landing/privacy.html` (12.1 KB — ships to home.anchorandflowapp.com). Two `terms.html` copies likewise. Before any paid user exists, pick one canonical source and make the others redirects or copies of it. A paying customer seeing different terms depending on which subdomain they read is a real legal-exposure detail.

**P1-7. Zero automated tests.**
`package.json` has no test script, no test framework in devDependencies, no test files in the repo. Confirms backlog item 2 status. Nothing more to say except that P1-1's fix should not ship without at least the sync-scenario tests around it.

**P1-8. Backup system: retention is 3, not 10, and it's localStorage-only.**
`createLocalBackup` prunes to keep 3 total (App.jsx:1834–1835); the backlog's "last ten backups are retained as designed" is inaccurate — update the docs or the code. Also: backups snapshot **all** `af_*` keys × 3 copies into the same localStorage that has a ~5 MB budget; `compassCache` and any photo-bearing data inflate this. A quota failure during `createLocalBackup` is caught (good), but a quota failure during a *sync apply* would be silent per-key `catch {}` — partial application. Worth a quota-headroom check before beta. Restore-from-file exists (App.jsx:1541–1564) with sane guards.

### P2 — near-term

- **APP_VERSION drift:** `"2026-06-03-vault-refresh"` (App.jsx:493) vs. SW cache `v20260622-1` — the `_meta.app_version` written into every push is three weeks stale. Cosmetic but misleading in any future debugging.
- **Reload-site inventory for backlog item 4:** 14 total in App.jsx (lines 345, 1563, 1992, 2122, 2138, 2339, 2384, 2425, 2463, 2501, 2511, 2527, 2537, 2623). Classification: 345 (error-screen button — keep), 1563 (post-backup-restore — keep), 1992/2122/2138 (auth/signout transitions — keep or soften), 2339–2623 (sync-apply reloads — the actual targets of the architectural fix). `pullLatestHouseholdData`'s reload (2425) is the only sync reload with **no typing guard** — quickest focus-loss win.
- **`compassEngine.js` meals mismatch confirmed:** reads `state.meals` at lines 129/141/161 while planning data lives in `nextWeekMeals` — Compass dinner guidance is running on stale/legacy data. Known issue; now has line numbers.
- **Terminal-debris files:** 30+ zero-byte files in repo root (`if`, `else:`, `}`, `EOF`, `+`, `⏺`, `124`…`215`, `Lindseys-MacBook-Pro:anchor-and-flow`, etc.) — all verified 0 bytes, safe to delete. One-liner: `find . -maxdepth 1 -type f -empty -delete` run from the repo root (review `git status` before committing).
- **Bundle size:** 1.5 MB minified single chunk. Acceptable today; code-splitting belongs to the App.jsx refactor (backlog item 3), not before.
- **Dev proxy targets production** (`vite.config.js` → www.anchorandflowapp.com): local dev sessions consume production API rate-limit budget. Fine for a solo dev; document it.

### P3 — later

- `subscribe.js` accepts any `formId` from the client — pin the Kit form ID server-side.
- `sanitizeHouseholdData`'s `_ARRAY_KEYS` list is duplicated verbatim in three places (App.jsx:2409, 2450-ish, 2612-ish) — consolidation candidate during refactor.
- Landing folder contains `anchor-and-flow-sales (3).html` and other drafts that deploy publicly if not excluded.

---

## Verified good — do not change without tests

These systems were examined and are sound. Per backlog rule 5, they should be treated as protected:

1. **`refreshAuthToken`** (App.jsx:1623–1668): single-flight promise dedup, JWT `exp` check before trusting `getSession()`, fall-through to `refreshSession()`, hard-fail signout that triggers the SIGNED_OUT cleanup. This is the fix for the six-layer auth chain and it holds up.
2. **`api/claude.js`**: JWT verification against Supabase, server-side model map, max_tokens cap, 6 MB body cap, body rebuilt from allowed fields, per-user rate limit. The reference implementation for any future endpoint.
3. **`public/sw.js`**: version-keyed cache, activate deletes all non-current caches, network-first navigation, cache-first hashed assets, API never cached.
4. **Push safety stack**: stale-push guard with safe-default block on unknown errors, `nonNull<2` empty-push refusal, own-write reconciliation via exact `af_lastPushedAt` match, no confirm-GET (the pooler-staleness lesson, documented in comments at App.jsx:2268–2272).
5. **`useSaved` hydration guard** (`_afHydrating`) — the fix for the infinite reload loop. The comment block explaining it (App.jsx:1690–1696) is accurate and should migrate into the handbook verbatim.
6. **`isRemotePayloadSafe` + `sanitizeHouseholdData` + array-type guards** on every apply path.
7. **Production bundle hygiene**: no personal emails, no user UUIDs, AF_DEBUG=false, remaining console.warns are non-sensitive. (The backlog's logging-cleanup item is largely already done.)

---

## Recommended repair sequence

1. **Tonight-sized (do before Twyla's next real use):** delete `api/anthropic.js` → deploy → verify with curl that it 404s → check Anthropic console usage. Then `git rm` the two junk env files, commit, roll both Stripe test keys.
2. **Next session:** workDays dirty-marking fix (P0-2) + the P1-4 audit of the other bespoke-storage keys, verified on two devices. Add CRON_SECRET fail-closed while in there (P1-2).
3. **Hygiene commit:** stale duplicates, terminal debris, `.bak` files (P1-5, P2). Small, satisfying, removes future patch-target traps.
4. **Then and only then:** the regression test suite (backlog item 2), with the poll data-loss scenario (P1-1) as its first fixture, followed by the P1-1 mitigation itself.
5. Everything else follows the backlog's existing phase order, which this audit confirms is correct.

---

## Open items requiring Supabase-side verification (pass 2)

Client code can't prove server config. These need a schema/policy export or dashboard review:

- RLS policies on `households`, `household_members`, `shopping_items`, `exhale_cards`, `subscriptions`, `push_subscriptions` — the client *assumes* household-scoped access everywhere.
- `join_household` SECURITY DEFINER body — what prevents joining an arbitrary household ID?
- Whether `exhale_cards` is still in the Realtime publication and REPLICA IDENTity FULL is still set (a restore or migration can silently revert it).
- Whether the `households.updated_at` trigger still exists — code comments now assert "no trigger, no rewrite" (App.jsx:2268); if a trigger was later re-added, the own-write guard breaks again.
- Whether `p_photo` on shopping items stores base64 blobs in table rows (row-size and quota implications) or URLs.
- CRON_SECRET, SUPABASE_SERVICE_KEY, and Stripe env vars: present, correct mode, correct scoping in Vercel.

To run pass 2, export the schema with: `supabase db dump --schema public -f schema.sql` (or paste the output of the SQL editor's policy/table introspection) and upload it.

---

*End of audit — pass 1. No code was modified. Repository snapshot remains byte-identical to the upload.*
