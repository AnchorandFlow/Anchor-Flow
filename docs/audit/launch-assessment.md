# Anchor & Flow — Launch Assessment (Revised)
**Date:** 2026-07-17
**Supersedes:** the 2026-07-16 assessment
**Evidence base:** 4 audit sessions, 96 findings, all statuses verified against code or live artifacts — never against commit messages. See `docs/audit/session-1` through `session-4-findings.md`.

---

## Recommendation

| Release | Verdict | Gate |
|---|---|---|
| **Friends & family (you, Twyla, Steve)** | **GO — already live** | Passed. Zero open Criticals. |
| **Controlled beta (~10 households)** | **NO-GO** | Data-trust gate + "works for someone who isn't Lindsey" gate |
| **Paid public launch** | **NO-GO** | Above + access-control, cost-control, legal/billing gates |

The 2026-07-16 assessment was right about the spine: *no more major building until families' existing data is unquestionably safe.* This revision keeps that and corrects the inputs.

---

## What changed from the previous assessment

**Closed since it was written** (verified against real artifacts, not diffs):
- **Recovery protection** — was listed as an open P0. Backup export/import now excludes credentials *by construction* via an allow-list; verified by exporting a real file and reading it (`e5ccd83`). F-06/F-11.
- **Password reset** — wasn't on the list at all. It had **never worked for any user** since the app existed: `resetPasswordForEmail` and `SetPasswordModal` were both correct and never wired together. Fixed and tested (`41fb125`). F-95.
- **Exhale persistence** — the "possibly Exhale" item. Root-caused and fixed (`57e0549`, `890723a`, `174b06e`). F-61/F-62/F-65.

**Struck from the previous assessment:**
> *"Earlier security audits… should be treated as completed foundations—not restarted."*

The security audit is **not a completed foundation**. It is a list with open items, several of which are release gates. See "Access control" below.

**Reframed:** five separate "persistence failure" P0s are **one bug in five places** (Cluster A). One helper + one lint closes all of them. Fixing them as five tickets means shipping Tide Pool and finding meals broken next week.

**Added:** Cluster B (breaks the beta), privacy exposure (live now), the self-inflicted 429 (live now), landing page (blocks the marketing already planned), accessibility.

---

## The architectural finding

Three findings, three unrelated features, one shape:

- **F-06** — the test suite's `DEVICE_LOCAL` set already listed all six credential keys under the comment *"Auth & session — must never leave the device."* The export path never consulted it.
- **F-95** — `resetPasswordForEmail` (send) and `SetPasswordModal` (receive) both independently correct, never connected by the `PASSWORD_RECOVERY` event.
- **F-63** — 2 of 10 `/api/claude` call sites correctly check `res.ok`. The other 8 don't, with the right pattern sitting in the same file.

**The bug is almost never that nobody knew the right way. It's that the right way was never connected to the place that needed it.**

This should shape the remediation strategy: prefer *wiring what exists* over writing new code, and prefer *one enforced path + a lint* over N fixed call sites. Every cluster below is stated that way.

---

## GATE 1 — Data trust (blocks the 10-household beta)

### P0-1 · Cluster A — sync-write-path data loss
**F-32, F-33, F-38, F-43, F-44.** A SYNC_KEY written via raw `localStorage.setItem` instead of the dirty-marking helper → never pushed → the household pull clobbers it with stale server state.

This is the "Tide Pool / chores / treasures / meals / partner-entered meals / possibly Exhale" cluster from the previous assessment. **Not five blockers — one.** Confirmed live: it caused real data loss (Exhale cards vanishing on refresh), took two attempts to fix (`003cb1c` reverted, then `57e0549`), and the fix only covered one of six sites until `890723a`.

**Fix:** one enforced write helper, plus a lint that fails on raw `setItem` of a sync key — **except** at explicitly-annotated server-origin sites (realtime handlers applying an already-committed remote row; marking those dirty echo-pushes and re-creates the bug via the push path). The lint must require an exemption comment, not a silent whitelist.

*Note: the lint must strip comments or use an AST — the existing A10 completeness lint scans raw text and has already false-positived on prose twice.*

### P0-2 · Concurrent-device sync
Two devices adding, moving, editing, rewarding, deleting simultaneously without losing either person's work. **Correct as written in the previous assessment.** The Playwright two-browser suite exists (`playwright-e2e`) and should be the harness.

Depends on P0-1: you can't prove concurrent safety while single-device writes still get clobbered.

### P0-3 · Cluster C — Exhale first-run integrity
**F-40** (cards inserted with `null household_id` before the household resolves → silent loss for new users) and **F-41** (non-UUID fallback ID rejected by the uuid column on Safari 13). Both hit *new* households specifically — i.e. every beta participant on day one.

### P0-4 · F-94 — sanitizer accepts null as an object
`typeof null === "object"`, so a null in `familyProfile`/`aiMemory`/`schoolData`/etc. gets written back as the string `"null"`. Affects the **sync-pull path**, not just backup import. Only 4 of 14 affected keys are in `NULL_SAFE_KEYS` and self-heal.

### Release proof for Gate 1
Two real devices, repeated add/edit/move/reward/reload cycles across Tide Pool, meals, chores, Exhale, and calendar, with:
- Zero lost or duplicated records
- Zero screen jumps or card disappearances from remote updates
- Data correct after refresh, logout/login, reconnect, and second-device open

---

## GATE 2 — "Works for someone who isn't Lindsey" (blocks the beta)

### P0-5 · Cluster B — hardcoded developer family data
**Not polish. This is the gate the previous assessment missed entirely.**

Five files, five features, all broken for every household that isn't yours — and your children's names ship in the public JS bundle:

| Finding | Location | What a beta family sees |
|---|---|---|
| F-12 | `PERSON_COLORS` | Default blue for every person; the feature does nothing |
| F-48 | `CalEventFormModal` | "Madi, Rylan, Kinzlee, Briar" as *their* event-for options |
| F-13 | Calendar "Mine" filter | Hardcoded `L`/`T` initials — silently dims the wrong events |
| F-53 | Compass context filter | Hardcoded `"L"` — AI misattributes whose events are whose |
| F-39 | `ExhaleSection` defaults | Pre-populated with real family names |

**One directive:** no hardcoded developer family data anywhere; all person references derive from `people` state. **Enforce with a CI grep** — that's the "wire it once" version.

### P0-6 · F-83 — no real first-run path
Onboarding is prebuilt but dark behind a flag; `hasExistingData`/`SAMPLE_TASKS` are dead code. Combined with Cluster B, a new household's first experience is a full-featured app showing another family's names and no guidance. **This is what 10 households will actually open.**

### P1 · F-64 + F-63 + F-18 — the app rate-limits itself
Confirmed live in production with **one user**: `[AF CLAUDE] request failed 429`.

- **F-64** — every cold open fires 3 notification-generation calls + one per remaining timed event today, `.forEach(async…)` **concurrently, not awaited**. Guarded by a `sessionStorage` flag that resets on **every iOS PWA relaunch** — i.e. it fires essentially every open on your primary platform. 6–8 calls, zero user action.
- **F-18** — AnchorTab's suggestions fire uncached on every fresh page load.
- **F-63** — 8 of 10 call sites skip `res.ok` and parse anyway. On a 429 the error body parses cleanly, optional-chaining yields undefined, the `|| "{}"` default kicks in, `JSON.parse` succeeds, and the code proceeds with **empty data** — never reaching the catch block's good fallback. Worst case: **RecipesTab writes a blank recipe to the database.**

Order matters: **F-63 first** (stops garbage writes, 1h), then F-18 (30m), then F-64 (3h). Reduce call volume before touching the limiter.

### P1 · Notifications
As written in the previous assessment — plus **F-20**: timezone defaults to UTC-6 when unset, so notifications arrive at the wrong local hour for most households. And note the Ripples follow-up pipeline **has never functioned** (enqueue was dead, cron unscheduled) — decide whether to fix it or hide the surface before beta.

---

## GATE 3 — Access control (blocks paid; accept knowingly for beta)

**These are the items the previous assessment declared "completed foundations."** They're fine while everyone is family. They are not fine at 25–50 households.

- **RLS-2 — the join code *is* the household ID.** A short text code (`hh_o7yzu28`), far less entropy than a UUID. No invite tokens, no expiry, no approval, no rate limit on `join_household`. And **there is no DELETE policy on `household_members`** — so there is no leave-household path and no remove-member path. **Membership is permanent.** One screenshot of a settings screen grants irrevocable access to a family's data. *Requires: opaque invite tokens + leave + remove-member.*
- **RLS-4 — any member can delete the household or become owner.** The `households_member_access` ALL policy uses the same predicate for USING and WITH CHECK, so a member can DELETE the row or UPDATE `owner_id` to themselves. *(Note: drafted remediation SQL needs `auth.uid()::text` — `owner_id` is text.)*
- **F-59 — `/api/claude` accepts arbitrary system prompts** (<8KB) and forwards the messages array verbatim. Any authenticated user can use your Anthropic key as an unconstrained proxy. Combined with open signups, that's uncapped spend.
- **F-22/F-60 — the rate limiter is an in-memory Map per serverless instance.** Fails *both* directions: unlimited under distributed load, *and* throttling one legitimate user under normal warm-instance traffic (currently happening).
- **S2 — no security headers** on either domain (X-Frame-Options, nosniff, Referrer-Policy, HSTS).
- **Supabase Auth settings** — session config (time-boxing, inactivity timeout, single-session) is **Pro-plan gated**. Sessions currently never expire. For an app holding health data and children's info, that's a posture decision currently being made by your billing tier.

---

## GATE 4 — Privacy (live exposure, not a paid-launch item)

The previous assessment mentions COPPA only under "Paid." **These exist right now:**

- **F-10 — children's exact names, ages, and birthdates go to Anthropic on every briefing open.** Uncached, via a path that bypasses the slim context extractors, and **not documented in your privacy policy.** *Fix: bucket ages to ranges, cache per day, and reconcile the policy with reality.*
- **F-56 — `aiMemory`** (verbatim onboarding free-text, which may contain medical, financial, or relationship detail) sent on **every** Compass call, including "what's for dinner."
- **F-46 + F-34** — health PIN stored plaintext in localStorage, alongside a print-template XSS that can read it. One bug reads the other's secret.

**The privacy policy currently describes an app that doesn't exist.** Either the code stops sending this, or the policy says what's actually happening. That's not a paid gate — it's a promise you're making today.

---

## GATE 5 — The page you're about to drive traffic to

Step 1 of the previous plan says *"continue marketing and waitlist activity."* You can't, yet:

- **F-85 — zero mobile CSS.** No `@media`, no `clamp()/vw`. 100% fixed-px including an 80px serif heading. The 13-post social series points at a page that likely breaks on phones. **3h.**
- **F-89 — zero analytics.** No way to know if any of it worked.
- **F-87 — no OG tags, no Twitter cards, no favicon, no meta description** on any of the four pages. Every share renders as a blank card.
- **Google Search Console** — never set up. The sitemap is live and nobody's told Google it exists. **15 min.**

*Closed this week: `/contact` returned 404 (unreachable, never in the audit — found by clicking), dead nav links, `/home` 404s in nav logos and footers, contact form posting to `YOUR_FORM_ID`, robots.txt/sitemap live and verified.*

---

## GATE 6 — Accessibility

**71** — the only non-green Lighthouse score (Perf 96, Best Practices 100, SEO 100).

- **F-72 — `T.textFaint`/`T.textSoft` fail WCAG AA in all three themes. 331 uses.** Two design tokens. Most of the missing 29 points. **2h.**
- **F-73/F-74** — ~98 icon-only controls, 6 `aria-label`s total; zero `htmlFor` anywhere. The emoji nav announces as nothing.

For an app built for a parent holding a baby one-handed, or a grandparent with low vision, this is product, not compliance.

---

## Commercial (unchanged from the previous assessment, and correct)

Business bank account, Stripe checkout/webhooks/entitlements, governing law, refund/trial language, one controlled live transaction. Keep the offer: Free / Plus $12.99mo · $119yr / Founding Home Bundle ~$149–169.

Billing infrastructure exists on `billing-test-mode` behind `BILLING_V1` (off). Audit verdict: **signature verification, event-ID idempotency, and fail-closed entitlement all PASS.** Two items before enabling: **B4** — test-mode price IDs are hardcoded as fallbacks, so production checkout breaks *silently* if the env vars are missed; **F-47** — the gift free-tier limit is already enforced with no upgrade path, so users hit a paywall that leads nowhere.

---

## Explicitly not blocking launch

Unchanged and correct: combining Home/Systems/Inventory · full Safe Harbor expansion · Lighthouse enhancements or renaming · calendar emojis/countdowns/confetti · Driftwood, Breeze, deeper Ripples · private-area expansion · physical binder manufacturing · native apps, Twilio, advanced AI memory · emoji reduction, alphabetization, minor polish.

**Add to the list:** bundle size. 1,567 kB / 372 kB gzipped, one chunk, no code splitting — and **Lighthouse says Performance 96, FCP 1.1s, LCP 1.7s, CLS 0.** It is not hurting users. Vite's warning is hygiene, not a blocker. *(RF-1 refactor is real technical debt — HomeFlow holds 267 of 310 `useState` calls in one ~10,000-line function, zero `useMemo`, 225 inline filter/sort/reduce — but it's a maintainability problem, not a launch one.)*

---

## Plan

**1 · Freeze.** No new features. One launch-candidate backlog: the gates above, nothing else.

**2 · Close Gate 1 (data trust).** Cluster A as *one* fix — helper + lint — then Cluster C, then F-94. Prove it with two real devices, not with tests.

**3 · Close Gate 2 (works for strangers).** Cluster B as *one* fix — purge hardcoded people, derive from state, CI grep. Then F-63 → F-18 → F-64. Then decide onboarding: enable it or accept that first-run is bare.

**4 · Close Gates 4 & 5.** Privacy policy vs. reality (F-10/F-56) — that's a today problem. Landing page mobile CSS + analytics + OG before the social series ships. Search Console, 15 minutes.

**5 · Beta at 10 households.** Seven consecutive days with no data-loss, blank-screen, or auth-loop incident. One in-app feedback route. Fix only what breaks trust or daily use.

**6 · Gate 3 + commercial in parallel.** Invite tokens, leave/remove-member, durable rate limiting, headers. Stripe test cycle → one live transaction.

**7 · Expand.** 25–50 households, then broader paid release.

---

## One open question

The previous assessment lists as P0: *"blank opening screen, stale service-worker builds, auth-expired loops."*

**Four audit sessions found no evidence for these.** Lighthouse: Perf 96, CLS 0. The service worker cache-deletes correctly (`[SW] Deleting old cache: anchor-flow-v20260715-…`). `onAuthStateChange` audited clean — correct token handling, correct user-initiated-signout distinction. `deploy.sh` verifies the live bundle hash on every deploy and it has matched every time.

**If you are seeing these symptoms, that is a real finding the audit missed and it should be chased immediately** — reproduce once with DevTools open and capture the console. **If it's inherited from an older assumption, it's inflating a P0 that doesn't exist** and should be struck.

Everything else in this document is grounded in a verified finding. This one isn't, in either direction.

---

## Standing rules (earned the hard way this week)

1. **A commit may only cite a finding ID if the diff demonstrably addresses that finding's root cause.** `366ced0` claimed 8 IDs; 6 were wrong.
2. **Verification is the artifact, not the diff.** F-06's first fix passed a clean diff, 291 tests, and es-check — and shipped every credential anyway. Export the file. Click the link. Use two devices.
3. **Read the file *and* fetch the URL.** The audit read every href on the landing page and still missed that `/contact` returned 404 for its entire existence.
4. **Claims about database internals require an export or a query result.** Three findings this week were fabricated from plausible inference and disproven by direct query.
5. **Prefer wiring what exists over writing what doesn't.** See the architectural finding.
