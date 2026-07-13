# Anchor & Flow — Session 2 Audit: Bug Hunt & Sync Reliability

**Audit target:** `src/App.jsx` (12,121 lines) + all 12 live components + `compassEngine.js` + `shellKit.js`, at commit `fa9e703`.
**Mode:** Analysis only — no code modified.
**Coverage:** Confirmed complete. Full App.jsx read (lines 1–12,121); all 12 imported/rendered components read (ExhaleSection, TodayBriefing, CompassFab, NudgeStrip, WeeklyReviewCard, PrepCard, SunsetClose, FlowHome, RippleTab, AnchorVault, RecipesTab, AuthScreen); both AI-engine files read (compassEngine.js, shellKit.js).

---

## ⚠️ RECOVERY NOTE — F-01 through F-30 pending

Findings **F-01 through F-30** were generated in the first pass of Session 2 and printed to the terminal, but were **lost** before capture: they scrolled out of the terminal buffer and the Claude Code session compacted them. They are NOT reconstructed here because reconstructing them from partial descriptions would bake in errors (per the standing evidentiary rule).

**What is known about F-01–F-30 from the session summary (for re-derivation targeting only — NOT canonical text):**
- Count: 1 Critical, 9 High, 17 Medium, 3 Low (30 findings)
- Critical: **F-05**, **F-06**, **F-11** (titles/locations lost)
- Named partial references: **F-01** (CLOSED — ES2019 build-target check passes), **F-16** (dirty-key pull protection — behaves as documented), **F-19** (native `window.confirm`/`prompt`/`alert` unreliable in iOS standalone PWA — the pattern several later findings duplicate), **F-23** (CLOSED — BILLING_V1 / LIGHTHOUSE_V2 confirmed absent from codebase)
- High findings in range (numbers only): F-02, F-03, F-04, F-07, F-08, F-09, F-14, F-15, F-17
- Medium findings in range (numbers only): F-10, F-12, F-13, F-21, F-24, F-27, F-28, F-29, F-30

**Recovery action (assigned):** A short dedicated Claude Code pass must re-derive F-01–F-30 by re-reading `src/App.jsx` lines 1–8,000 plus `sync-core.js`, `sw.js`, and the API files. The code is unchanged since the audit, so the findings are re-findable. Slot the re-derived full text into this section.

---

## Findings F-31 through F-60 (verbatim)

> Note: F-01–F-30 covered `src/App.jsx` and core files in the first pass. F-31–F-52 came from the 12-component pass. F-53–F-60 came from the compassEngine/shellKit pass. Some text below was recovered from chat transcript and lightly de-corrupted for readability; locations and severities are preserved as reported.

### F-31 — Optional chaining in vault af-data-changed handlers + RecipesTab
- **Severity:** Low (mitigated by esbuild lowering to ES2019)
- **Location:** AnchorVault.jsx + RecipesTab.jsx (af-data-changed handlers)
- **Why:** ES2020 optional chaining used in source; build target is es2019. esbuild lowers correctly, so no production impact, but dev-mode Safari 13 risk.
- **Fix:** Replace with explicit null-checks in source.
- **Effort:** S

### F-32 — af_calEvents dirty-key bypass in all vault calendar writes
- **Severity:** High
- **Area:** Sync
- **Why:** Vault calendar write paths persist `af_calEvents` without marking the key dirty, so changes are not pushed to Supabase on the next sync cycle.
- **User impact:** Calendar events added/edited in the vault do not sync to other devices; lost on next pull.
- **Fix:** Route all calendar writes through the dirty-key marking path.
- **Effort:** M

### F-33 — Missing afVaultChanged() on 6 vault write paths
- **Severity:** Medium
- **Location:** AnchorVault.jsx — TravelProfileSection.setProfile() (af_travel_profile), PackingTemplatesPanel.saveTemplates() (af_packing_templates), useCareer() cSaveCareer() (af_career), sysSaveSystems() (af_vaultSystems), hSavePeople() (af_people), SubscriptionsSection.saveSubs/saveCoupons/savePerks (af_subs/af_coupons/af_perks)
- **Why:** These write paths call `localStorage.setItem` directly without dispatching `af-data-changed` or marking dirty keys — structurally parallel to sections that DO call `afVaultChanged` (recurSave, hfSave), but the call was omitted during authoring.
- **User impact:** Changes to travel profile, packing templates, career data, home systems, people list, and subscriptions are not reflected in other open tabs or partner devices until the next full sync cycle. AnchorDashboard shows stale data.
- **Fix:** Add `afVaultChanged(...)` at the end of each write function.
- **Effort:** S

### F-34 — Stored XSS via printTemplate in PackingTemplatesPanel
- **Severity:** Medium (self-XSS; household-internal)
- **Location:** AnchorVault.jsx:~2180 (printTemplate)
- **Why:** Builds an HTML string `"<h1>" + (t.emoji||"🧳") + " " + t.name + "</h1>"` and calls `win.document.write(...)`. `t.name` (user-supplied template name) is never sanitized.
- **User impact:** A template name containing script/`<img onerror=...>` executes in the print window's self-origin context — can read localStorage (af_authToken, af_authUser, health PIN) and post to Supabase. A household member could target another.
- **Fix:** Entity-encode all user-controlled strings before `document.write()`.
- **Effort:** S

### F-35 — Unbounded Base64 file storage bloats localStorage and sync blob
- **Severity:** High
- **Location:** AnchorVault.jsx — GiftsSection (~1350), PetsSection.handleDoc (~1750), CDocsTab.handleFile (3798–3806); persist to af_gifts / af_pets / af_career
- **Why:** `FileReader.readAsDataURL()` stores uploaded files as base64 inside the record objects. These keys are in SYNC_KEYS, so base64 is serialized into `households.data` on every push. A 2MB PDF → ~2.7MB base64. localStorage cap is 5–10MB; Supabase PostgREST body limit ~512KB–1MB on free tier.
- **User impact:** Uploading a resume or pet record silently fails (quota exceeded) or causes the next push to 413, leaving all subsequent dirty keys un-synced. `af_dirtyKeys` can grow unbounded; household data becomes unsyncable.
- **Fix:** Store files in Supabase Storage (URL only in localStorage); add a client-side file-size guard (reject >500KB) as interim.
- **Effort:** L

### F-36 — Multiple window.confirm() in vault destructive actions
- **Severity:** Low (duplicate of F-19 pattern, new locations)
- **Location:** AnchorVault.jsx — PackingTemplatesPanel (~2100), ExpandedPackingModal (~2200), HouseFileSection (~5060), MaintenancePanel (~5400), ProductsPanel (~5300)
- **Why:** Destructive actions call `window.confirm()` directly; unreliable in iOS standalone PWA.
- **User impact:** On mobile browsers that suppress native dialogs, accidental deletion with no feedback.
- **Fix:** Replace with the inline "tap to confirm" pattern already used elsewhere.
- **Effort:** S

### F-37 — AnchorDashboard has no af-data-changed listener — shows stale data
- **Severity:** Medium
- **Location:** AnchorVault.jsx:5950–6454 (AnchorDashboard)
- **Why:** Reads summaries from localStorage inline on render but has no `af-data-changed` listener to trigger re-render. Only re-renders when parent AnchorVault re-renders (e.g., activeSection change).
- **User impact:** Adding a birthday/pet doesn't update the dashboard until the user leaves and re-enters the vault; partner's changes never appear live.
- **Fix:** Add a useEffect listening for `af-data-changed` that forces re-render (tick counter).
- **Effort:** S

### F-38 — af_coupons and af_perks absent from SYNC_KEYS — never synced
- **Severity:** Medium
- **Location:** AnchorVault.jsx:6543–6545 (SubscriptionsSection); sync-core.js SYNC_KEYS
- **Why:** SubscriptionsSection persists `af_coupons` and `af_perks`, but only `af_subs` is in SYNC_KEYS.
- **User impact:** Coupons and perks are invisible on a partner's device and lost on reinstall/sign-out.
- **Fix:** Add "coupons" and "perks" to SYNC_KEYS + array-guard in sanitizeHouseholdData + afVaultChanged calls.
- **Effort:** S

### F-39 — Real family names hardcoded as default people in ExhaleSection
- **Severity:** Low (privacy/hygiene)
- **Location:** ExhaleSection.jsx:25 — `var DEFAULT_PEOPLE = ["Lie","Briar"]`
- **Why:** Personal names used as dev defaults, never replaced.
- **User impact:** New households get these names pre-populated; names appear in the shipped JS bundle, visible to anyone inspecting source.
- **Fix:** Replace with generic placeholders or `[]`.
- **Effort:** S

### F-40 — ExhaleSection inserts cards with null household_id before HH resolves
- **Severity:** High
- **Location:** ExhaleSection.jsx:506–533 (handleAdd())
- **Why:** Reads `af_householdId` from localStorage; if the household hasn't finished creating (race between auth and household creation), hhId is null and the card is written to `exhale_cards` with `household_id: null`. Other devices query filtered by household_id, so they never see it.
- **User impact:** New users who add Exhale cards before household init lose them — appear locally (optimistic) then never sync. No error shown.
- **Fix:** Guard the insert: if hhId is null, fall back to V1 blob path or queue+retry once householdId resolves.
- **Effort:** M

### F-41 — crypto.randomUUID() fallback produces non-UUID IDs (DB type violation)
- **Severity:** Medium
- **Location:** ExhaleSection.jsx:495–498 (handleAdd())
- **Why:** Fallback `"e" + (_nid++)` produces `"e1720000001234"`. If `exhale_cards.id` is uuid-typed, insert fails; error is caught and logged, card disappears on reload.
- **User impact:** Safari 13 users' Exhale cards appear briefly then vanish on reload. No message.
- **Fix:** Use an RFC-4122-compliant UUID polyfill fallback, or make the column type text.
- **Effort:** S

### F-42 — EXHALE_V2 evaluated at module scope — module-level side effect
- **Severity:** Low
- **Location:** ExhaleSection.jsx:33 — `var EXHALE_V2 = localStorage.getItem("af_exhale_v2") !== "false"`
- **Why:** Reads localStorage at import time (unconditional side effect on module load); breaks test isolation.
- **User impact:** None at runtime (defaults ON). Affects testability; can't toggle V1/V2 without reload.
- **Fix:** Move read inside component as useState initializer or into the effect functions.
- **Effort:** S

### F-43 — SunsetClose.saveRipple() dispatches event but skips dirty-key marking
- **Severity:** High
- **Location:** SunsetClose.jsx:56–67 (saveRipple())
- **Why:** Writes `af_ripples` via localStorage + dispatches `af-data-changed` but does NOT add "ripples" to `af_dirtyKeys`. Sync loop only pushes dirty keys, so the ripple is never pushed.
- **User impact:** Every ripple saved via Sunset Close is lost on next pull FROM Supabase (local overwritten, ripple never pushed). UI shows it saved, then it silently vanishes and never reaches partner's device.
- **Fix:** Replace manual setItem+dispatch with `afVaultChanged("ripples")`.
- **Effort:** S

### F-44 — Compass forecast overrides not synced (not in SYNC_KEYS)
- **Severity:** Low
- **Location:** TodayBriefing.jsx:22–24, 59–61 — `af_forecastOverrides` via ovWrite()
- **Why:** User-edited daily "Things" stored in `af_forecastOverrides`, not in SYNC_KEYS.
- **User impact:** Edited Things don't appear on other devices; each device generates its own forecast → confusing divergence for a household feature.
- **Fix:** Add "forecastOverrides" to SYNC_KEYS, OR document as intentionally device-local with a UX note.
- **Effort:** S

### F-45 — PrepCard freezes household state at mount — stale calEvents
- **Severity:** Low
- **Location:** PrepCard.jsx:12 — `const [s] = useState(readHouseholdState)`
- **Why:** `readHouseholdState()` runs once at mount; `s.calEvents` is stale for the component's lifetime.
- **User impact:** PrepCard misses events added after mount until it re-mounts on tab change. Low impact.
- **Fix:** Subscribe to `af-data-changed` and re-read, or read calEvents on each render.
- **Effort:** S

### F-46 — Health PIN stored as plain text in localStorage
- **Severity:** Medium
- **Location:** AnchorVault.jsx:4082–4083 (hGetPrivatePin / hSetPrivatePin)
- **Why:** PIN protecting private health notes stored as `af_health_pin` in plain text, no hashing.
- **User impact:** Any XSS (e.g., F-34) can read `af_health_pin` and bypass the private lock; anyone with brief DevTools access sees the PIN.
- **Fix:** Store a salted hash (bcrypt/SHA-256), compare hashes at verification.
- **Effort:** S

### F-47 — Gift free-tier limit always active; no upgrade path exists
- **Severity:** Medium (product/data integrity)
- **Location:** AnchorVault.jsx:1226 (atLimit); BILLING_V1/LIGHTHOUSE_V2 confirmed absent from entire codebase
- **Why:** GiftsSection enforces GIFT_FREE_LIMIT = 15; `isPremium` defaults false (line 1181); no billing infra exists to set it true.
- **User impact:** Any household tracking >15 gifts hits the wall with no upgrade option; add-gift disabled with a "Premium" prompt that leads nowhere.
- **Fix:** Remove the limit until billing exists, or wire the prompt to a waitlist; document that billing gates aren't implemented.
- **Effort:** S (remove) to L (implement billing)

### F-48 — Hardcoded family names in CalEventFormModal (non-functional for other households)
- **Severity:** Medium
- **Location:** App.jsx:11317, 11323–11328 (CalEventFormModal)
- **Why:** "For" dropdown hardwired to `["Madi","Rylan","Kinzlee","Briar","family"]`; "Responsible" buttons hardwired to `[["L","Lindsey"],["T","Twy"]]`. Never populated from `people` state — string literals.
- **User impact:** (a) Every other household sees these wrong names as event-for options. (b) Partner B's name never shows unless it's "Twy". Feature is dead for all other households. Names burned into shipped JS bundle.
- **Fix:** Derive "For" options from `people` state and "Responsible" from adults-filtered people; remove literals.
- **Effort:** S

### F-49 — Shopping V2 backfill destroys checked state (one-time migration loss)
- **Severity:** Low (documented; one-time per household)
- **Location:** App.jsx:7538–7555 (shopping V2 backfill effect)
- **Why:** One-time migration backfills all items `done:false` unconditionally because `shopping_add_item` RPC has no done param. Comment at 7548 acknowledges: "Any currently-checked items lose their checked state here."
- **User impact:** On first launch after SHOPPING_V2 activation, every checked item resets to unchecked. Guarded by `af_shopping_v2_backfilled_<hhid>` (fires once) but fires for every household on upgrade.
- **Fix:** Add `p_done` param to `shopping_add_item` before activating V2, or filter to done:false during backfill.
- **Effort:** S

### F-50 — window.fetch monkey-patched at module scope (global side effect)
- **Severity:** Low (works in production; risky pattern)
- **Location:** App.jsx:478–510
- **Why:** Replaces `window.fetch` with a wrapper intercepting `/api/claude` + `/api/anthropic` to inject Authorization, enforce cooldown, retry on 401. Runs at import, before React renders. **Ties to Session 1 finding S4** (dual af_authToken storage) — this is the reader of that token.
- **User impact:** No production impact. But an error inside the patch (e.g., `_afReadToken()` throws) surfaces as an unhandled rejection on EVERY fetch (Supabase included). Breaks fetch mocking in tests.
- **Fix:** Convert to an explicit wrapper called at call sites, or a proper interceptor that doesn't mutate global fetch; move token injection there.
- **Effort:** M

### F-51 — Additional ES2020 optional chaining in App.jsx sync/auth code (F-31 extension)
- **Severity:** Low (mitigated by esbuild lowering)
- **Location:** App.jsx:2296 (pushHouseholdData), 2333, 2841 (checkForUpdates), 8077 & 8095 (aiRecategorize/brain effect), 12076 & 12079 (onAuthStateChange)
- **Why:** Optional chaining in the highest-traffic sync + auth paths. Build target es2019; esbuild lowers correctly.
- **User impact:** None in production builds; dev-mode Safari 13 risk.
- **Fix:** Replace with explicit null-checks, prioritizing sync/auth paths.
- **Effort:** S

### F-52 — askRipple (CoveTab) uses alert() for AI response
- **Severity:** Low (duplicate of F-19 pattern, new location)
- **Location:** App.jsx:9252–9254 (askRipple() in CoveTab)
- **Why:** Displays AI suggestions via `alert("Ripple suggests:\n\n" + text)`. Same anti-pattern as F-19.
- **User impact:** On iOS standalone PWA, alert() is degraded/suppressed; suggestion can't be scrolled, copied, or acted on inline.
- **Fix:** Display suggestions in an inline panel allowing direct add.
- **Effort:** S

### F-53 through F-56 — compassEngine.js findings
> **RECOVERY NOTE:** F-53, F-54, F-55, F-56 full text was NOT captured in the chat transcript (only F-57–F-60 came through verbatim, plus references to F-55 "raw concatenation of user_question" and F-56 "verbatim onboarding freetext / aiMemory" from the PII inventory). Re-derive these four from `src/compass/compassEngine.js` in the recovery pass. Known partial references:
> - **F-55:** user_question freetext is raw-concatenated into the prompt (prompt-injection surface).
> - **F-56:** aiMemory (verbatim onboarding freetext) sent to Claude.

### F-57 — Compass context truncation produces invalid JSON
- **Severity:** Medium (functional; user-facing)
- **Location:** compassEngine.js — buildCompassContext truncation
- **Why:** Truncating a JSON blob cuts mid-value/mid-string/mid-array, leaving unclosed quotes/brackets; the "…(truncated)" marker makes it unparseable. Claude receives a malformed FAMILY CONTEXT section.
- **User impact:** Large households → Compass gets malformed context and either crashes the briefing UI (unparseable response) or hallucinates plausible-but-invented context (references non-existent events / omits real ones). User sees a wrong briefing with no indication data was missing.
- **Fix:** Semantic truncation — prioritize fields by importance (today's events > tasks > meals > moments), truncate individual arrays, and verify output with JSON.parse before returning.
- **Effort:** S

### F-58 — readHouseholdState() returns auth token and health PIN alongside household data
- **Severity:** Low (defense-in-depth; not currently reaching Claude)
- **Location:** shellKit.js:26–35
- **Why:** Iterates all `af_*` keys and returns them as one object — includes `af_authToken` (Supabase JWT), `af_authUser` (id+email), `af_health_pin` (plaintext, per F-46). Currently `buildCompassContext()` cherry-picks named fields, so these aren't forwarded — but the risk is latent.
- **User impact:** No current impact. If a future AI feature passes the full snapshot, or a passthrough for unrecognized fields is added, auth credentials + health PIN would be transmitted to the Anthropic API and logged server-side.
- **Fix:** Exclude auth/security keys (af_authToken, af_authUser, af_health_pin, af_deviceId) at the source in readHouseholdState(), OR have consumers pass only the household data blob.
- **Effort:** S

### F-59 — /api/claude forwards messages array verbatim; system prompt accepted up to 8KB
- **Severity:** Low as-is (authenticated only) → **escalates to paid-launch gate once signups open**
- **Location:** api/claude.js:105, 107–109
- **Why:** Proxy forwards `messages: body.messages` as supplied and accepts client-provided system prompts <8000 chars unmodified. Any authenticated user can POST arbitrary system prompt + messages, using the app's Anthropic key for any Claude call — limited only by a 60-req/10-min in-memory rate limit.
- **User impact:** An authenticated user can use /api/claude as an unconstrained Claude proxy → unexpected Anthropic API cost. The in-memory limiter doesn't persist across Vercel instances (F-60), so concurrent requests bypass it.
- **Fix:** Constrain messages to a single user-role message with a length cap; reject system prompts not matching a server-side allowlist (hash of known Compass prompts); or move system-prompt injection fully server-side and accept only a mode identifier from the client.
- **Effort:** M
- **Cross-ref:** Combine with Session 1 "anyone can create an account" — together this is a billing-exposure gate for paid launch.

### F-60 — In-memory rate limiter in Vercel serverless is non-durable (bypassable)
- **Severity:** Low (engineering hygiene)
- **Location:** api/claude.js:36–47
- **Why:** Rate-limit counter is a Map local to each serverless instance. Vercel spins up multiple isolated instances; each has its own empty Map. Concurrent requests land on different instances and bypass the 60-req limit. Comment: "best-effort."
- **User impact:** No impact under normal load. Under abuse or a request-storm bug, the limit provides no protection; Anthropic costs unbounded.
- **Fix:** Move rate limiting to a durable per-user store (Vercel KV, Upstash Redis, or a Supabase counter table).
- **Effort:** M

---

## PII Inventory — What Reaches the Anthropic API on Each Compass Call

Grounded in `buildCompassContext()`:

| Field | Notes |
|---|---|
| People names, roles, birthdays | Up to 12 people; includes kids |
| preferred_name | Household's chosen name |
| aiMemory | Verbatim onboarding freetext (F-56) |
| Calendar event titles, times, forPerson | User-authored strings |
| Task titles, assigned-to | User-authored strings |
| Meal names by day | |
| Shopping item text | Up to 30 items |
| Open shopping count | Aggregate only |
| Pet names + species | |
| Packing template names | |
| Moment titles + dates | Up to 8 recent |
| Ripples count | Aggregate only |
| School data | Partial — up to 10 items |
| Chores data | Up to 20 items |
| user_question (freetext) | Raw concatenation (F-55) |
| flow_mode | |
| Wall-clock now | |

**NOT sent to Claude** (confirmed by field extraction in buildCompassContext): authToken, authUser, health_pin, deviceId, householdId, dirtyKeys, health records, career documents, safe harbor data, vault content.

---

## Token / Key Exposure — Verdict: CLEAN

`ANTHROPIC_API_KEY` never appears in client code — lives in Vercel env vars, accessed server-side only in `api/claude.js:71`. The proxy prevents it leaking in error responses. The Supabase session token is injected by the window.fetch shim and verified server-side but is never forwarded to Anthropic. No credential exposure found in either file.

---

## Systemic Clusters (for Session 5 root-cause ranking)

**Cluster A — Sync-write-path data loss (the recurring bug class):**
F-32, F-33, F-38, F-43, F-44 — plus the Session 1 sanitizer-allowlist class. Root cause: no single enforced path for "persist a synced key," so each write site re-implements it and some omit dirty-key marking or SYNC_KEYS registration. **One helper + a lint/test that fails on raw setItem of a sync key collapses all of these.**

**Cluster B — Hardcoded family names in shipped bundle:**
F-39 (ExhaleSection), F-48 (CalEventFormModal + Responsible buttons). Root cause: dev defaults never parameterized. Also breaks these features for every non-original household. **One fix: purge all hardcoded people, derive from `people` state.**

**Cluster C — Exhale first-run data integrity:**
F-40 (null household_id insert), F-41 (non-UUID fallback ID rejected by uuid column — same uuid-vs-text seam as Session 1). Fix together.

**Cluster D — Security hygiene pair:**
F-34 (print XSS) + F-46 (plaintext health PIN) — XSS hole can read the PIN. F-58 (credentials in readHouseholdState) is the latent third. Fix as a set.

**Cluster E — AI endpoint abuse (paid-launch gate):**
F-59 (arbitrary-prompt proxy) + F-60 (non-durable rate limit) + Session 1 "open signups." Not a friends-and-family blocker; a hard gate before paid launch.

**Cluster F — iOS PWA native-dialog anti-pattern:**
F-19 (original) + F-36 + F-52 — window.confirm/alert unreliable in standalone PWA. Systematic replace with in-app modal.

**Cluster G — File storage architecture:**
F-35 (base64 in localStorage/sync blob) — standalone High; needs Supabase Storage migration.

---

## Coverage Confirmation

- `src/App.jsx`: full read, lines 1–12,121 (the earlier "11,954" figure was a miscount; corrected).
- All 12 live/rendered components: read.
- `compassEngine.js`, `shellKit.js`: read.
- Sync-critical logic (pushHouseholdData, pullHouseholdData, checkForUpdates, debouncedSync, syncNow, pullLatestHouseholdData) all in the 2,236–2,975 range: read; behaves as documented (60s poll, stale-push guard, dirty-key protection, own-push echo detection, afReloadWhenIdle).
- Shopping Realtime subscription (line 7,507): correct cleanup + [householdId] deps — clean.
- onAuthStateChange (line 12,074): correct token handling + user-initiated sign-out distinction — clean.

**Outstanding for the recovery pass:** full text of F-01–F-30 (lost from terminal buffer) and F-53–F-56 (compassEngine — only F-57–F-60 captured verbatim).
