# Anchor & Flow — Session 2 Audit: Bug Hunt & Sync Reliability (FINAL, reconciled)

**Audit target:** `src/App.jsx` (12,121 lines) + all 12 live components + `compassEngine.js` + `shellKit.js` + `sync-core.js` + `sw.js` + `api/*.js`, at commit `fa9e703`.
**Mode:** Analysis only — no code modified.
**Status:** F-01–F-71, plus F-94 (added 2026-07-15, found while fixing F-06/F-11 — see Part F; F-72–F-93 belong to Session 4, not this file). **Reconciled against actual code at commit `174b06e` — this file is current as of `174b06e`, with F-94 added at `4a84767`.** Every FIXED/OPEN status below was verified by reading the current diff/source directly, not by trusting commit messages — see reconciliation note on why that distinction matters.

**Reconciliation notes:**
- F-01–F-30 were re-derived (originals lost from terminal buffer); numbering may differ from the first-pass originals but all are grounded in file:line reads at fa9e703.
- Duplicates merged: **F-05≡F-58**, **F-22≡F-60**, **F-15≡F-57** (kept once each, cross-referenced).
- **F-21 kept OPEN** — related to Session 1's S3 but distinct: S3 addressed the pg_cron *scheduling* (job unscheduled), but the endpoint's query-param auth branch (`?secret=`) is still present in code at fa9e703 and still logs the secret. **Re-verified at 174b06e: `api/send-notifications.js:96` still reads `req.query?.secret`. The file has never been modified — F-21 cannot have been fixed by any commit that claims to.**
- **Cluster B (hardcoded developer family data)** expanded to 5 findings across 5 files — the single most pervasive pattern in the audit.
- **F-61, F-62 added 2026-07-14 (post-audit follow-up, not part of the original fa9e703 pass)** — derived from reading `ExhaleSection.jsx` at commit `57e0549` ("fix(exhale): prevent cards disappearing during column moves"). See **PART D**.
- **2026-07-15 reconciliation pass (this update):** Four commits (`a7f4579`, `a71c5a2`, `2a414db`, `366ced0`) claimed in their messages to fix 13 findings combined. Re-reading the actual diffs and current source at `174b06e` shows only **3 of those claims are real** (F-16, F-01, F-52 — F-52's own commit mislabeled it "F-21"). The rest of the named findings — **F-06, F-07, F-08, F-09, F-12, F-21, F-27, F-28** — are confirmed still present in the current source, unchanged. Six additional real fixes landed in the same window with **no finding number cited at all** (now numbered F-66–F-71, Part E). Three more findings (F-17, F-61, and a newly-numbered F-65) were fixed for real, correctly cited, in later commits. **Standing rule going forward: a commit may only cite a finding ID if the diff demonstrably addresses that finding's stated root cause, verified by re-reading the finding text at commit time — not by pattern-matching on file name or symptom.** See the meta-finding in Part E for why this rule exists.
- **F-94 added 2026-07-15 (`4a84767`)** — found during verification for the F-06/F-08/F-11 fix, not by any audit pass. A latent gap in `sanitizeHouseholdData`'s object-passthrough branch, pre-existing and unrelated to that fix. See Part F.

---

## Severity totals (locked, updated 2026-07-15)

| Severity | Count | Finding IDs |
|---|---|---|
| **Critical** | 3 | F-06, F-11, F-05★(no—see note) |
| Critical (confirmed, both OPEN) | **2** | **F-06, F-11 — re-verified untouched at `174b06e`; see Part A/B for the exact lines** |
| High (open) | 13 | F-03, F-04, F-07, F-08, F-10, F-13, F-19, F-21, F-22(≡F-60), F-32, F-35, F-40, F-43 |
| Medium (open) | ~24 | F-02, F-09, F-12, F-15(≡F-57), F-18, F-20, F-24, F-25, F-26, F-30, F-33, F-34, F-37, F-38, F-41, F-46, F-47, F-48, F-53, F-54, F-56, F-59, F-94, + others |
| Low (open) | ~11 | F-05(≡F-58), F-14, F-27, F-28, F-29, F-31, F-36, F-39, F-42, F-44, F-45, F-49, F-50, F-51 |
| CLOSED | 2 | F-01, F-23 |
| FIXED (was Critical) | 1 | F-16 |
| FIXED (was High) | 1 | F-61 (890723a) |
| FIXED (was Medium) | 2 | F-62, F-17 (5a3cdf1) |
| FIXED (was Low) | 1 | F-52 (mislabeled "F-21" in its own commit) |
| FIXED (new, Cluster C) | 1 | F-65 (174b06e) |
| FIXED (found by use, not by audit) | 6 | F-66–F-71 |

> ★ Correction: F-05 is **Low** (latent, no active leak path). The 2 confirmed Criticals are F-06 and F-11. F-10 is the highest-priority High and carries a mandatory privacy-review flag.

> **Both Criticals remain fully open.** The `afConfirm` infrastructure built in `2a414db` (defined `App.jsx:28`, wired at `App.jsx:9033, 9194, 9601, 11240`) was never connected to the backup import path — that path (`App.jsx:1678-1712`) still uses raw `window.confirm`/`alert`. Export (`App.jsx:1668-1677`) still unconditionally serializes every `af_*` key, including `af_authToken` and `af_health_pin`, into the downloadable file.

---

## PART A — F-01 through F-30 (re-derived, grounded at fa9e703)

> **Note:** Full 7-field text for several F-01–F-30 findings was captured in the recovery pass. Where only summary-level detail survived, the finding is marked **[summary-level — re-expand from code before acting]**. All line numbers are from actual reads.

### CLOSED / FIXED
- **F-01 — CLOSED.** ES2019 build-target check passes (es-check gates dist output). **Re-verified at 174b06e:** `package.json:8,12` still run `es-check es2019 './dist/assets/*.js' --module` on both `build` and `check:es`. Still clean.
- **F-23 — CLOSED.** LIGHTHOUSE_V2 and BILLING_V1 absent from source at fa9e703; no flag-eval system exists. Wire flags before enabling; audit under Session 5 before enabling.
- **F-16 — FIXED (was Critical).** `App.jsx:2425–2454` `_applyHouseholdKeysDetectChange` skips keys in `af_dirtyKeys` during pull ("F-16 fix" comment present). **Re-verified at 174b06e:** the dirty-key guard is present and in active use at `App.jsx:2444` (merge-time skip) and `App.jsx:2871` (apply-via-shared-helper). Residual hardening: after a backup import, repopulate/rebuild `af_dirtyKeys` or force a push, or dirty state is lost (ties to F-08, itself still open).

### Critical — BOTH CONFIRMED STILL OPEN AT 174b06e
- **F-06 — Critical. OPEN.** `App.jsx:1668–1677` (current line numbers; was 1656–1666 at fa9e703). Export Backup handler unconditionally does `Object.keys(localStorage).forEach(k => { if(k.startsWith("af_")) data[k] = ... })` — no exclusion list — then downloads the blob as `anchor-flow-backup-<date>.json`, which commonly auto-syncs to iCloud. This still dumps the live `af_authToken` (Supabase JWT) and `af_health_pin` (plaintext, no expiry) plus all children's PII. **Named in commit message(s) among `a7f4579`/`a71c5a2`/`2a414db`/`366ced0` — none of those diffs touch this handler.** Basis for Critical = health PIN + kids' PII in an iCloud-replicated file, not the ~1hr token. **Fix:** exclude auth/PIN keys from export; hash the PIN; warn on export. **Effort:** 2h.
- **F-11 — Critical. OPEN.** `App.jsx:1678–1712` (current; was 1678–1697 at fa9e703). Import Backup still calls raw `window.confirm(...)` at line 1696 — silently auto-suppressed on iOS standalone PWA (returns `true`, no dialog shown) — then every `af_*` key from the file, including `af_authToken`, is written to `localStorage` via `keys.forEach(k => localStorage.setItem(k, data[k]))` with only a `keys.length < 5` sanity check. Reload authenticates as the injected session: complete silent account takeover in one tap past the file picker. **The `afConfirm` helper that exists specifically to fix this class of bug (`App.jsx:28`, used correctly elsewhere at `9033/9194/9601/11240`) was never wired into this path.** **Fix (all three required):** replace `window.confirm` with `afConfirm`; exclude auth/user/PIN keys from import; run imported SYNC_KEYS through `sanitizeHouseholdData()`. **Effort:** 3h.

### High
- **F-03 — High.** [summary-level] hhData manipulation surface referenced by F-21; re-expand from code.
- **F-04 — High.** [summary-level] re-expand from code.
- **F-07 — High. OPEN.** iOS PWA `window.confirm()` suppression (the platform behavior underlying F-11/F-19); `afConfirm` exists to handle it. **Named in commit message(s) among the four investigated commits — confirmed not addressed: `App.jsx:1696` in the backup-import path (the highest-stakes instance of this exact bug class) is still raw `window.confirm`.** **Fix:** route all confirms through `afConfirm`.
- **F-08 — High. OPEN.** `App.jsx:1694–1712` (current). Import validation still checks only `typeof data === "object"` and `keys.length >= 5` (line 1695), then writes every `af_*` key raw — no sanitization, no schema check, no integrity check. Enables session swap, malformed-JSON injection (crash-on-render), and `af_aiMemory` prompt poisoning. **Named in commit message(s) among the four investigated commits — the actual validation logic at these lines is unchanged from fa9e703.** **Fix:** exclude auth/PIN keys; sanitize all SYNC_KEYS values; use `afConfirm`. **Effort:** 2h.
- **F-10 — High ⚠ PRIVACY-REVIEW REQUIRED.** `App.jsx:3544–3645` `buildDailyBriefing`. Sends full `familyProfile` (parent names, work situation, dietary needs, city, timezone, biggest challenge) + all people's full names, ages, **exact birthdays**, roles + today/tomorrow events + tasks + brain dump to `/api/claude` on **every briefing open**, uncached, via a separate path that bypasses buildCompassContext's slim extractors. Children's exact PII to Anthropic every open; **not documented in privacy policy.** **Fix:** verify privacy policy covers AI-processed children's PII; bucket ages/birthdays to ranges; centralize system prompt; cache per-day. **Effort:** 3h.
- **F-13 — High.** `App.jsx:6086–6087, 6137–6138` (calendar "Mine"/"Twy" filter uses hardcoded "L"/"T"). *Narrowed to App.jsx only — compassEngine portion owned by F-53.* Calendar filter dims wrong events for any household not using L/T initials. **Fix:** resolve current user's initial at runtime; pass as param. **Effort:** 2h. **[Cluster B]**
- **F-19 — High.** `App.jsx:1681, 1695, 1697` (fa9e703 numbering; current: `1693, 1695, 1710, 1712`). Native dialogs in backup import (confirm + alerts) invisible on iOS PWA → no confirmation, unexplained reload on success, silent failure on error. **Re-verified at 174b06e — all four native dialog calls (`alert` ×3, `confirm` ×1) are still present, unchanged.** **Fix:** replace with `afConfirm`/`showInAppBanner`. **Effort:** 1h. **[Cluster A + F]**
- **F-21 — High, OPEN (re-verified at 174b06e).** `api/send-notifications.js:96`. Accepts cron secret via `?secret=` query param; Vercel logs full URLs → secret in plaintext function logs. **The file has never been modified since fa9e703 — any commit message claiming to fix F-21 is false on its face; there is no diff to have fixed it with.** **Fix:** remove the querySecret branch; header-only bearer auth via vercel.json. **Effort:** 30m.
- **F-22 — High (≡F-60; severity raised from Low).** `api/claude.js:36–47`. In-memory `Map` rate limiter; each serverless instance has its own counter → effective limit 60×N, functionally unlimited under distributed load. **Primary billing-risk vector** for a per-token AI service; uncapped Anthropic spend once signups open. **Session 3 addendum (2026-07-15): the same non-durable design has been confirmed to fail in the opposite direction too** — under normal light traffic Vercel keeps a single warm instance, so the counter *does* bind, and it has throttled a single legitimate user during ordinary use (see `docs/audit/session-3-findings.md`, F-63/F-64). **Fix:** durable per-household counter (Supabase table / Vercel KV / edge middleware). **Effort:** 4h. **[Cluster E]**

### Medium
- **F-02 — Medium.** [summary-level] re-expand from code.
- **F-09 — Medium (build-risk). OPEN.** Optional chaining / nullish coalescing across client source (`App.jsx:513, 2296, 2333, 2841, 3360–3365, 3608, 3774, 5188, 5268`; `send-notifications.js:39`). Vite es2019 + esbuild lowering + es-check handle it today. **Named in commit message(s) among the four investigated commits, but no build-config change exists in any of those diffs — still open as originally scoped (docs-only fix, effort 0).** Separately: the literal string "F-09" now appears in two *unrelated* code comments (`App.jsx:1100` and `App.jsx:8465`, both chore-reset date-freshness fixes — see Part E meta-finding) — those are real, correct fixes, just mislabeled; they are not this finding. **Fix (docs only):** document the three-tool ES2019 invariant in vite.config.js + package.json; require `npm run check:es` on any build-config PR. **Effort:** 0.
- **F-12 — Medium. OPEN.** `App.jsx:619–629` (current; was 606–611 at fa9e703). `PERSON_COLORS = {Madi, Rylan, Kinzlee, family}` hardcoded developer family names; feature returns default blue for all other households; names in shipped bundle. **Named in commit message(s) among the four investigated commits — `PERSON_COLORS` object is byte-for-byte unchanged.** **Fix:** derive color from `people` state `.color` field. **Effort:** 1h. **[Cluster B]**
- **F-14 — Low/Medium.** `compassEngine.js:122–127`. Duplicate `_todaySlim` declaration (copy-paste); identical output today, silent-divergence risk. **Fix:** delete the duplicate block. **Effort:** 2m.
- **F-15 — Medium (≡F-57).** `compassEngine.js:169–171`. Raw `json.slice(0,12000)` produces invalid JSON (cuts mid-value/key/Unicode). Large households get malformed context → Compass crashes or hallucinates. **Fix:** budget-aware context builder that drops whole low-priority fields; verify with JSON.parse. **Effort:** 2h. **[Cluster — AI context integrity]**
- **F-17 — Medium, FIXED (5a3cdf1).** `sync-core.js:54–62`. History matters here: `366ced0` renamed the `useSaved` call at `App.jsx:6713` from `useSaved("af_nwMealCount",1)` to `useSaved("nwMealCount",1)` but **left `SYNC_KEYS` pointing at the old double-prefixed `"af_nwMealCount"` entry** — severing the field from sync in both directions (a regression, not a fix; `366ced0`'s message claimed this finding fixed). The test suite's **A10 failure that was dismissed at the time as "pre-existing and unrelated" was actually this exact regression, and had been reporting it correctly the whole time.** `5a3cdf1` corrected `SYNC_KEYS` to `"nwMealCount"` (`sync-core.js:62`), added a one-time legacy-key migration (`App.jsx:72–75`), and rewrote test A9 to guard the corrected single-prefix invariant — suite went from 289/290 to 291/291. **Re-verified at 174b06e:** `sync-core.js:62` reads `"nwMealCount"`; migration code present at `App.jsx:72–75`. **Effort:** (already spent; 2h original estimate).
- **F-18 — Medium.** `App.jsx:5188` `loadAiSuggestions` (AnchorTab mount effect). **Note:** this finding was re-examined and re-rated in Session 3 (see `docs/audit/session-3-findings.md`) — the original "fires on every AnchorTab mount from tab-switching" mechanism was corrected (tabs are kept mounted per-session via `visitedTabs`, not remounted on switch) and the severity was raised to High after being confirmed as a contributor to a live production 429. Not re-litigated here; see the Session 3 doc for the current status.
- **F-20 — Medium.** `api/send-notifications.js:44–50`. Timezone defaults to UTC-6 (Mountain) when `utcOffsetHours` unset → notifications arrive at wrong local hour for most households (off by up to 12h). **Fix:** capture offset at onboarding via `Intl.DateTimeFormat().resolvedOptions().timeZone`, or skip delivery when unset. **Effort:** 2h.
- **F-24 — Medium.** `App.jsx:7250–7265` `loadAiPrepTips`. Uncached Claude call on every tap. **Fix:** cache keyed to week's dinner names. **Effort:** 30m. **[Cluster E-adjacent]**
- **F-25 — Medium.** `App.jsx:4195–4207` `importRecipeFromUrl`. `recipeUrl` concatenated raw into AI message → prompt injection writes attacker-controlled recipe (syncs to all household members). **Fix:** validate URL with `new URL()`; harden system prompt. **Effort:** 30m. **[Cluster — prompt injection]**
- **F-26 — Medium.** `App.jsx:7349` rescueInput. No client-side length cap → unbounded token consumption. **Fix:** `maxLength={500}` + counter + trim. **Effort:** 15m.
- **F-30 — Medium.** `App.jsx:3608–3609, 3774–3775, 5268–5269, 7260–7261`; `send-notifications.js:39`. All five AI parse sites JSON.parse without schema validation → valid-but-wrong-shape responses (safety refusals, arrays, error wrappers) make features silently blank. **Fix:** shape guard + typed fallback at all five sites. **Effort:** 2h.

### Low
- **F-05 — Low (≡F-58).** `shellKit.js:26–35`. `readHouseholdState()` returns all `af_*` keys including `af_authToken`, `af_authUser`, `af_health_pin`. No active leak (buildCompassContext cherry-picks fields) — latent. **Fix:** exclude auth/security keys at source. **Effort:** S. *Cross-ref F-06 where these keys DO escape.*
- **F-27 — Low. OPEN.** `api/subscribe.js:14–23`. Client-controlled `formId` → anyone can subscribe arbitrary emails to arbitrary Kit forms. **Named in commit message(s) among the four investigated commits — the file has never been modified since fa9e703; there is no diff to have fixed it with.** **Fix:** hardcode formId server-side. **Effort:** 15m.
- **F-28 — Low. OPEN.** `MEAL_DAYS` still defined 3× at 174b06e: `sync-core.js:21` (canonical export), `App.jsx:344` (as `MEAL_DAYS_S`), and `App.jsx:3692` (local shadowing re-declaration inside a nested function). **Named in commit message(s) among the four investigated commits — all three declarations are unchanged.** Maintenance trap. **Fix:** import from sync-core; remove local copies. **Effort:** 30m.
- **F-29 — Low.** `compassEngine.js:11–12`. Stale integration comment says to add compassCache to SYNC_KEYS; it's already there (sync-core.js:46). **Fix:** update/remove comment. **Effort:** 2m.

---

## PART B — F-31 through F-52 (12-component pass)

> Full text committed in prior version; abbreviated here with cluster tags. See detailed bodies retained below.

- **F-31 — Low.** Optional chaining in vault handlers + RecipesTab (build-risk). **[F-09/F-51 family]**
- **F-32 — High.** `af_calEvents` dirty-key bypass in all vault calendar writes → not synced. **[Cluster A]**
- **F-33 — Medium.** 6 vault write paths miss `afVaultChanged()` (travel_profile, packing_templates, career, vaultSystems, people, subs). **[Cluster A]**
- **F-34 — Medium.** printTemplate stored XSS via `document.write` (AnchorVault ~2180). **[Cluster D]**
- **F-35 — High.** Base64 files in localStorage overflow quota + sync 413 (Gifts/Pets/CDocs). **[Cluster G]**
- **F-36 — Low.** `window.confirm()` in 5 vault destructive actions. **[Cluster F]**
- **F-37 — Medium.** AnchorDashboard no `af-data-changed` listener → stale data.
- **F-38 — Medium.** `af_coupons`/`af_perks` absent from SYNC_KEYS → never synced. **[Cluster A]**
- **F-39 — Low.** `ExhaleSection.jsx:25` `DEFAULT_PEOPLE = ["Lie","Briar"]` — real family names in bundle. **[Cluster B]**
- **F-40 — High.** Exhale cards inserted with `null household_id` before HH resolves → silent loss for new users. **[Cluster C]**
- **F-41 — Medium.** `crypto.randomUUID()` fallback produces non-UUID IDs → rejected by uuid column on Safari 13. **[Cluster C]**
- **F-42 — Low.** EXHALE_V2 read at module scope (test-isolation).
- **F-43 — High.** `SunsetClose.saveRipple()` skips dirty-key marking → ripples lost on next pull. **[Cluster A]**
- **F-44 — Low.** Compass forecast overrides not in SYNC_KEYS. **[Cluster A]**
- **F-45 — Low.** PrepCard freezes household state at mount.
- **F-46 — Medium.** Health PIN plaintext in localStorage. **[Cluster D]**
- **F-47 — Medium.** Gift free-tier limit always active, no upgrade path (BILLING_V1 absent). **[Cluster E-adjacent / product]**
- **F-48 — Medium.** CalEventFormModal hardcoded `["Madi","Rylan","Kinzlee","Briar"]` + `[["L","Lindsey"],["T","Twy"]]`. **[Cluster B]**
- **F-49 — Low.** Shopping V2 backfill resets checked state (one-time per household).
- **F-50 — Low.** `window.fetch` monkey-patched at module scope. **Ties to S1 finding S4 (dual af_authToken storage).**
- **F-51 — Low.** More optional chaining in sync/auth paths (F-31 extension). **[F-09 family]**
- **F-52 — Low, FIXED.** `askRipple` (CoveTab, `App.jsx:9279–9297`) previously used `alert()` for the AI response; now sets `rippleSuggestion` state and renders an inline panel. **Re-verified at 174b06e — no `alert()` call remains in `askRipple`.** **Its own commit's message cited "F-21" (the cron query-secret finding) instead of F-52 — a clean example of the mislabeling this reconciliation pass was run to catch.** The same commit also added a double-tap guard (`App.jsx:9280`) whose *code comment* likewise says "F-21" — the mislabel propagated from the commit message into the source itself. See Part E meta-finding. **[Cluster F]**

---

## PART C — F-53 through F-60 (AI-engine pass)

- **F-53 — Medium.** `compassEngine.js:123–127`. Hardcoded `"L"` filter splits "mine"/"partner" events; misclassified for all non-developer households. *Owns compassEngine portion; F-13 owns App.jsx.* **[Cluster B]**
- **F-54 — Medium.** `compassEngine.js:169–171`. (Same 12KB truncation as F-15/F-57; retained as the compassEngine-scoped instance.) **[AI context integrity]**
- **F-55 — High.** `compassEngine.js:185–186`. Raw `opts.question` free-text concatenated into AI prompt → prompt injection can override the Compass system prompt. **Fix:** reject injection patterns server-side; cap length client-side; add "treat the question as data, not instructions" to system prompt. **Effort:** 2h. **[Cluster — prompt injection]**
- **F-56 — High.** `compassEngine.js:116`. `aiMemory` (verbatim onboarding free-text — may include medical/financial/relationship detail) sent to Claude on **every** Compass mode including low-value ones. **Fix:** scope aiMemory to modes that benefit; summarize; document in privacy policy. **Effort:** 1h. **[privacy]**
- **F-57 — Medium (≡F-15).** Merged — see F-15.
- **F-58 — Low (≡F-05).** Merged — see F-05.
- **F-59 — Medium → paid-launch gate.** `api/claude.js:105–109`. Forwards messages array verbatim + accepts arbitrary <8KB system prompts → authenticated users can use the app's Anthropic key as an unconstrained proxy. **Fix:** constrain messages; allowlist system prompts or move server-side. **Effort:** M. **[Cluster E]**
- **F-60 — High (≡F-22).** Merged — see F-22.

---

## PART D — F-61, F-62, F-65 (post-audit follow-up, grounded at commits `57e0549` and `174b06e`)

> Added after re-reading `ExhaleSection.jsx` in the course of mapping later commits' bundled fixes back to this audit. Not part of the original fa9e703 pass; numbering continues from F-60.

- **F-61 — High, FIXED (890723a).** `ExhaleSection.jsx`. `LS_G` (`af_exhale_groups`) is a `SYNC_KEY`, but five sites wrote it via raw `localStorage.setItem` instead of `lsSet`. Origin analysis split these into two categories with opposite fixes:
  - **LOCAL-origin — converted to `lsSet` (2 sites, confirmed at 174b06e):**
    - Line 202 (mount bootstrap): `g` comes from `lsGet(LS_G,null) || groupItems(initialItems)` — this device's own cached storage/props, never a Supabase payload. **Now `lsSet(LS_G, g)` — confirmed present at `ExhaleSection.jsx:202`.**
    - `handleAdd()`: direct user action (type → click add). **Now calls `lsSet(LS_G, ng, opId)` — confirmed present at `ExhaleSection.jsx:520`** (folded into the same commit that landed F-65's position fix).
    - Not being dirty-marked had left both exposed to the household-blob pull clobbering freshly added/bootstrapped cards with a stale server copy — the same failure mode `57e0549` fixed in `persist()`.
  - **SERVER-origin — correctly left raw (3 sites), now carry exemption comments:**
    - Lines 375/405/420 (realtime `INSERT`/`UPDATE`/`DELETE` subscription handlers). **Confirmed at 174b06e: each now has an explicit comment — `// SERVER-origin (dedup guard above rules out own echo) — do NOT lsSet, would echo-push back. See F-61.`** Each is guaranteed server-origin by the dedup guard immediately upstream (local-state id-scan / `pendingOps.current.has(opKey)` checks) that returns early before reaching the raw `setItem`. Converting these to `lsSet` would mark `LS_G` dirty in reaction to another device's edit and push this device's (possibly momentarily incomplete) snapshot back into the shared blob — re-creating the exact same data-loss bug via the push path instead of the pull path.
  - **`persist()` verified safe:** all 10 call sites are local user-action handlers; no realtime or bootstrap path calls `persist()`.
  - **Fix (applied):** lines 202 and (now) `handleAdd` converted to `lsSet`; lines 375/405/420 left as raw `setItem` with exemption comments. **[Cluster A]**

- **F-62 — Medium, FIXED in `57e0549`.** `ExhaleSection.jsx` (exhale_cards mount-load handler). Cards with a null/unknown `category` were defaulted to `"brain"`, which is not a member of `COLS = ["inbox","decide","do","waiting","someday"]`. `clone()` and `flattenGroups()` only iterate `COLS`, so any card sitting under a non-`COLS` key was silently dropped on the next mutation — legacy/uncategorized cards vanished. `57e0549` changed the default to `"inbox"`, validated against `COLS`. Distinct from F-40 (`null household_id` on insert) and F-41 (non-UUID id fallback) — a third, previously unlogged member of Cluster C. **[Cluster C]**

- **F-65 — High, FIXED (174b06e). NEW.** `ExhaleSection.jsx`. `handleAdd` hardcoded `position: 0` on every insert (prior to this fix), so card ordering was arbitrary and diverged between devices — a newly-created card could land at the top on the creator's device and in the middle on a receiving device. `computeNewPosition()` (`ExhaleSection.jsx:82`) already existed and was already used correctly by `handleMoveToCol`, but `handleAdd` never called it. **Confirmed at 174b06e:** `handleAdd` now calls `computeNewPosition(ng.inbox, 0)` (`ExhaleSection.jsx:519`) and assigns the result to `item.position` before `setGroups`. Two supporting fixes landed in the same commit: **(a)** `createdAt` is now normalized to epoch-ms at read time (`ExhaleSection.jsx:320`: `row.created_at ? new Date(row.created_at).getTime() : Date.now()`) — it had been a raw ISO string, and the naive numeric-subtraction comparator fallback (`(a.createdAt||0)-(b.createdAt||0)`) would have produced `NaN` on ISO strings and randomized sort order; **(b)** both client-side sort comparators now carry an explicit `createdAt` tiebreak after the primary `position` compare (`ExhaleSection.jsx:324` and `:404`: `(a.position||0)-(b.position||0) || (a.createdAt||0)-(b.createdAt||0)`). **[Cluster C]**

---

## PART E — F-66 through F-71: six fixes found by real use, not by this audit (meta-finding preserved)

> None of these six carry a finding-ID comment in their commits or in the source — they were not caught by any audit pass, this one included. They surfaced through ordinary use of the app and were fixed without ever being logged. Numbering them here so they're part of the permanent record, and so the pattern itself — real defects this audit missed entirely — is visible for Session 4 onward.

- **F-66 — Medium, FIXED. Found by use, not by audit.** `App.jsx:1098–1108` (SchoolTab-adjacent kid chore reset). `todayStr` is now computed fresh as `new Date().toISOString().split("T")[0]` on every render rather than from the stale module-level `TODAY` constant captured at page load — so a PWA left open across midnight now correctly resets chores the next calendar day instead of staying stuck on the load-time date. **Verified at 174b06e** (comment at line 1099 documents the fix, but mislabels it "(F-09)" — see meta-finding below).
- **F-67 — Medium, FIXED. Found by use, not by audit.** `App.jsx:8461–8487` (second, separate chore-reset site — kid-treasure/chores tab). Same stale-`TODAY` class of bug, fixed independently: `checkReset()` now computes a fresh date on every invocation and is wired to both `visibilitychange` and `window.addEventListener("focus", checkReset)`, so chores reset after midnight even if the tab was left open and never reloaded. **Verified at 174b06e** (comment at line 8465 also mislabels this "(F-09)" — same mislabel as F-66, independently).
- **F-68 — Medium, FIXED. Found by use, not by audit.** `App.jsx:3458` area (birthday → calendar sync effect). The effect previously ran add-only, keyed off `[birthdays.length]` with a genId-exists skip — so an edited or deleted birthday never had its calendar event updated or removed, only new births got new events. Replaced with a full recompute-and-diff each time the effect runs, so edits and deletions are correctly reflected. **Verified at 174b06e** via the explanatory comment at line 3458.
- **F-69 — Low, FIXED. Found by use, not by audit.** `App.jsx:8108–8126` (brain-dump AI pattern-insight effect). Previously had no cleanup — if `BrainTab` unmounted while the `/api/claude` call was in flight, the response handler still ran against a dead closure. Now wrapped in an `AbortController` + `cancelled` flag (`App.jsx:8109–8110`), with the fetch aborted and the `.then` chain short-circuited on unmount.
- **F-70 — Medium, FIXED. Found by use, not by audit.** `App.jsx:9718–9727` (SchoolTab `activeChild` selection). The effect that auto-corrects `activeChild` when it's no longer in the roster was keyed off `[schoolKids.length]` — so swapping one minor for another of the same household size (same count, different identity) never re-triggered the correction, leaving `activeChild` pointed at a child no longer in the roster. Now keyed off the joined id-list (`schoolKids.map(k=>k.id).join(",")`, line 9727), which changes on any membership change regardless of count. **Verified at 174b06e** — comment at line 9725 mislabels this fix "(F-08)"; F-08 is the backup-import-validation finding and is unrelated (and still open — see Part A).
- **F-71 — Low, FIXED. Found by use, not by audit.** `App.jsx:11081` (password-reset email redirect). `redirect_to` was hardcoded to a specific `*.vercel.app` preview URL; password-reset emails sent from production pointed users back to a stale preview deployment. Now computed as `window.location.origin`, with a fallback to `https://www.anchorandflowapp.com` if `window`/`window.location` are unavailable.

### Meta-finding: finding-ID citations in this repo are unreliable — in commit messages *and* in code comments

The commit-message problem is already well-established: of the 13 finding-ID citations across the four investigated commits (`a7f4579`, `a71c5a2`, `2a414db`, `366ced0`), only 3 correctly describe what their diff actually does; `366ced0` alone cites 6 finding IDs, of which 0 correctly match its diff (it's the commit that caused the F-17 regression while claiming to fix something else). This reconciliation pass additionally found the same failure mode **inside source-code comments**, independent of any commit message: `App.jsx:9280` cites "F-21" for a double-tap guard (F-21 is the cron query-secret finding — unrelated); `App.jsx:1100` and `App.jsx:8465` both cite "F-09" for the two independent chore-reset date-freshness fixes (F-09 is the optional-chaining build-risk finding — unrelated); `App.jsx:9725` cites "F-08" for the SchoolTab `activeChild` dependency-array fix (F-08 is the backup-import validation finding — unrelated, and still open). None of these four mislabeled fixes are wrong *as fixes* — they're all real, verified, correct changes. The finding IDs attached to them are simply false, and following one back to "confirm" the wrong finding was fixed would have been a silent error.

**Standing rule, effective now:** a commit message or code comment may only cite a finding ID (`F-NN`) if the diff it's attached to demonstrably addresses that finding's stated root cause — verified by re-reading the finding's actual text at commit time, not by matching on file name, symptom, or vague recollection. If a fix doesn't correspond to a logged finding, log a new one (as done here with F-65–F-71) rather than attaching it to the nearest-sounding existing ID.

---

## PART F — F-94 (found while fixing F-06/F-11, not by this audit)

> Found during verification for the F-06/F-08/F-11 backup export/import fix (`4a84767`) — while checking whether `sanitizeHouseholdData` could be applied directly to the imported backup blob, tracing its object-passthrough branch surfaced a pre-existing gap unrelated to that fix. Logged separately, as documentation only, per the same standing rule as Part E: a real defect found in passing gets its own number rather than being folded into the fix that happened to expose it.

- **F-94 — Medium. OPEN.** `sync-core.js:186–192` (`sanitizeHouseholdData`'s generic object-passthrough branch). The guard is `if (data[k] !== undefined && typeof data[k] === "object" && !Array.isArray(data[k])) out[k] = data[k];` — and `typeof null === "object"` in JavaScript, so a `null` value for any of `familyProfile`, `aiMemory`, `collapsedStores`, `mealThemes`, `calColorLabels`, `schoolData`, `cove_items_v1`, `notifSettings`, `sections`, `connectedCals`, `exhale_labels`, `health`, `career`, or `travel_profile` passes the check and gets written back as `JSON.stringify(null)` — the literal string `"null"`, the exact corruption class `NULL_SAFE_KEYS` (`App.jsx:336–341`) exists to clean up. Of those fourteen keys, only `health`, `career`, `travel_profile`, and `sections` are registered in `NULL_SAFE_KEYS` and self-heal on the next page load; the other ten (`familyProfile`, `aiMemory`, `collapsedStores`, `mealThemes`, `calColorLabels`, `schoolData`, `cove_items_v1`, `notifSettings`, `connectedCals`, `exhale_labels`) are not, and a `"null"` string written to any of them would persist until something else corrects it. **This affects the SYNC-PULL path equally, not just backup import** — `sanitizeHouseholdData` is called there too, and if a server household-blob ever holds a genuine `null` in one of these fields (not implausible; several are optional/nullable in normal use), the same corruption occurs regardless of backup import ever being used. **Not a regression from the F-06/F-08/F-11 fix** — the old backup-import code wrote every key completely raw with no type-checking at all, so it would have produced the identical `"null"`-string outcome for these same keys given the same input; this fix's use of `sanitizeHouseholdData` is a net improvement everywhere else (array-guard and scalar-typed keys are now correctly filtered instead of blindly corrupted) and neutral, not worse, on this one pre-existing edge case. **Fix:** in the object-passthrough branch, change the check to explicitly exclude `null` (e.g. `typeof data[k] === "object" && data[k] !== null && !Array.isArray(data[k])`), or complete the `NULL_SAFE_KEYS` registration to cover all fourteen keys instead of four. The former is the more correct fix since it closes the gap at its source rather than papering over it at every affected key. **Effort:** 15m. **[Cluster A adjacent — a shape-validation gap in the shared sync/sanitize path, same family as the write-path issues in Cluster A, but on the read/apply side rather than the write side.]**

---

## Systemic clusters (for Session 5 root-cause ranking)

**Cluster A — Sync-write-path data loss** (recurring bug class): F-32, F-33, F-38, F-43, F-44, ~~**F-61**~~ **F-61 (FIXED, 890723a)** + S1 sanitizer-allowlist class. *Root cause:* no single enforced "persist a synced key" path. **Standing recommendation (corrected):** one helper + a lint/test that fails on raw `setItem` of a sync key — **except at explicitly-annotated server-origin sites** (e.g. realtime subscription handlers that apply an already-committed remote row; see F-61), where marking dirty would echo-push the device's own snapshot back and re-create the bug via the push path. The lint/test should require those sites to carry a recognizable exemption comment rather than exclude them silently. **CONFIRMED LIVE IN PRODUCTION — commit `57e0549` fixed one instance (Exhale `persist()`) after real data loss (cards disappearing on refresh); the first attempt was reverted (`003cb1c` → `3a0d3fd`) before landing. `890723a` closed out the two remaining LOCAL-origin sibling sites (F-61: bootstrap line 202, `handleAdd`); the three SERVER-origin sites (375/405/420) are correctly raw and now carry exemption comments. This cluster's sync-write gap is now closed for Exhale specifically — F-32/F-33/F-38/F-43/F-44 (other vault/calendar/ripple write paths) remain open.** Adjacent, on the read/apply side rather than the write side: **F-94** — `sanitizeHouseholdData`'s object-passthrough branch lets `null` through as a valid object (`typeof null === "object"`), corrupting the same shared sanitize path this cluster's fix relies on. Same family of bug (shape validation in the sync pipeline), different direction (apply, not persist).

**Cluster B — Hardcoded developer family data** (most pervasive pattern; 5 findings, 5 files, all still open): F-12 (PERSON_COLORS — re-verified unchanged at 174b06e), F-39 (Exhale defaults), F-48 (CalEventFormModal), F-13 (calendar filter), F-53 (Compass context filter). *Every one breaks a feature for non-developer households AND ships family names in the bundle.* **One directive:** no hardcoded developer family data anywhere; all person references derive from `people` state; enforce with a CI grep.

**Cluster C — Exhale first-run data integrity:** F-40 (null household_id insert, open), F-41 (non-UUID fallback vs uuid column, open), F-62 (category default not in COLS → cards vanish on clone()/flattenGroups(), FIXED in 57e0549), **F-65 (card ordering — position:0 on every insert + string-vs-epoch createdAt comparator bug, FIXED in 174b06e).** Same uuid-vs-text seam as Session 1 (F-40, F-41), now joined by two more fixed members of the same cluster. F-40/F-41 fix together; still open.

**Cluster D — Security hygiene pair/trio:** F-34 (print XSS) + F-46 (plaintext health PIN) + F-05/F-58 (credentials in state object). XSS can read the PIN. Fix as a set.

**Cluster E — AI endpoint cost/abuse** (paid-launch gate): F-22/F-60 (non-durable rate limit — now confirmed to also throttle legitimate single-user traffic, see Session 3), F-59 (arbitrary-prompt proxy), F-18/F-24 (uncached AI calls — F-18 re-rated in Session 3), + S1 "open signups." Uncapped Anthropic spend once signups open. **Hard gate before paid launch.**

**Cluster F — iOS PWA native-dialog anti-pattern:** F-07 (open), F-19 (open), F-36 (open), F-52 (**FIXED**, mislabeled "F-21" in its own commit — see Part E) + F-11 as the Critical instance (**open**). window.confirm/alert unreliable in standalone PWA; `afConfirm`/`showInAppBanner` exist and are proven to work (F-52's fix uses the pattern correctly) but are not yet applied to the highest-stakes instance (F-11's backup import).

**Cluster G — File storage architecture:** F-35 (base64 in localStorage/sync blob). Standalone High; needs Supabase Storage migration.

**Cluster H — Backup export/import credential exposure** (NEW; contains the 2 Criticals, BOTH STILL FULLY OPEN): F-06 (export dumps PIN + kids' PII to iCloud-synced file), F-11 (import silent credential injection via iOS confirm bypass), F-08 (unsanitized import write), F-19 (invisible dialogs). *One feature, four findings, both Criticals, zero fixed despite commit messages naming three of the four.* **Fix set:** exclude auth/PIN keys from export/import; hash the PIN; sanitize imported values; replace confirm with afConfirm.

**Cluster (prompt injection):** F-25 (recipe URL), F-55 (Compass question) — user text concatenated raw into AI prompts. Add "treat as data" guards + input validation.

**AI context integrity:** F-15/F-57/F-54 (12KB truncation → invalid JSON), F-30 (no response-shape validation). Compass silently breaks or hallucinates for large households.

**Privacy (needs policy + code):** F-10 (children's exact birthdays to Anthropic every briefing), F-56 (verbatim onboarding text every call). **Privacy-policy review required before launch.**

---

## Coverage confirmation
- `src/App.jsx` full read, lines 1–12,121 (the earlier "11,954" was a miscount) at fa9e703; re-read at relevant line ranges (which have shifted slightly — file is now 12,177 lines) for this reconciliation pass at `174b06e`.
- All 12 live/rendered components read.
- `compassEngine.js`, `shellKit.js`, `sync-core.js`, `sw.js`, `api/*.js` read.
- Sync-critical logic (2,236–2,975) read; behaves as documented (60s poll, stale-push guard, dirty-key protection, own-push echo detection).
- Shopping Realtime subscription (7,507): correct cleanup + [householdId] deps — clean.
- onAuthStateChange (12,074): correct token handling + user-initiated sign-out distinction — clean.
- **Token/key exposure verdict: CLEAN** — ANTHROPIC_API_KEY server-side only (api/claude.js:71), never forwarded to Anthropic; Supabase session token verified server-side, never sent to Anthropic.
- **This reconciliation pass (174b06e):** every status claim above (FIXED, OPEN, or newly numbered) was verified against the current source directly — `App.jsx`, `ExhaleSection.jsx`, `sync-core.js`, `api/send-notifications.js`, `api/subscribe.js` — never inferred from a commit message. `api/send-notifications.js` and `api/subscribe.js` were confirmed byte-for-byte unmodified since fa9e703 despite being named in commit messages claiming F-21 and F-27 fixes respectively.

## Open verification items
- ~~F-21: confirm whether production removed the query-param auth path~~ **Resolved: source-level check at 174b06e supersedes this — the file is unmodified, so the query-param path is present in whatever is deployed from this branch. If production behaves differently, it's running code that predates this repository's history, which would itself be worth investigating.**
- A few F-01–F-30 bodies are summary-level (F-02, F-03, F-04) — re-expand from code before acting on them.
