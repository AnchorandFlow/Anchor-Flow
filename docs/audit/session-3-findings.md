# Anchor & Flow — Session 3 Audit: Performance & Bundle (redirected to production 429 investigation)

**Audit target:** `src/App.jsx` (12,177 lines) + all 12 live components + `src/shell` + `compassEngine.js` + `vite.config.js` + `package.json` + `dist/` build output + `api/claude.js`, at commit **`174b06e79741ae39665fa945e12aed21b6c1a58b`**.
**Mode:** Analysis only — no source files modified. `npm run build` was run (writes only to `dist/`).
**Status:** Complete. Numbering continues from F-63 (last used: F-62, Session 2).

**Redirect note:** This session was scoped as a 7-point bundle/performance audit. Mid-session, a live production console log surfaced a `429` from `/api/claude` on a single user's normal page load, which reframed the priority: the automatic, uncached AI-call volume on every app-open (not bundle size) is the confirmed, currently-live production issue. That investigation (F-63, F-64, and the re-rates of F-18 and F-22/F-60) is the headline of this report. The original bundle/render agenda is retained below as a full section, with a live Lighthouse run now confirming bundle size is not a user-facing problem.

---

## Headline: production 429 investigation

### Evidence
Live console, `www.anchorandflowapp.com`, one authenticated user, normal browsing session:
```
[AF CLAUDE] request failed 429 — using fallback, no retry   (index-XWh41mo9.js:228)
```
No abuse, no load spike — a single user hit the `/api/claude` rate limit during ordinary use.

### How every `/api/claude` call site behaves

16 call sites read in full (`App.jsx` ×14, `RecipesTab.jsx` ×1, `compassEngine.js` ×1):

| Site | Trigger | Cached? | Fires automatically? |
|---|---|---|---|
| `loadAiSuggestions` — `App.jsx:5188` (`AnchorTab`) | `useEffect(...,[])` mount | No — plain `useState(null)`, no persistence | **Yes, once per page load** |
| `scheduleAllDailyNotifications` → `generateAIMessage` ×3 (morning/dinner/evening) — `App.jsx:3958,3984,4001` | `useEffect(...,[notifPermission])` — `App.jsx:4121-4128`, unconditional on iOS | Once/day via `sessionStorage` guard (`App.jsx:3920-3925`) | **Yes, once per page load/day** |
| Event-nudge loop — `App.jsx:4010-4022` | Same effect, `.forEach(async...)` **not awaited between iterations** | Same session guard | **Yes — one call per remaining timed event today, fired concurrently** |
| `buildDailyBriefing` — `App.jsx:3568` | User opens Daily Briefing modal | Per-day guard (`briefingBuilt===todayDateStr`) | No (first-open-of-day only) |
| `buildInsights` — `App.jsx:3672` | `useEffect([tab])`, gated `insightsBuilt!==todayDateStr` | Per-day (HomeFlow-level state, survives tab switches) | Effectively once/day |
| Brain-dump pattern insight — `App.jsx:8108-8126` | Mount effect on `BrainTab` | Per-day via `localStorage.af_brainPattern` | Once/day, well-behaved |
| `loadAiPrepTips` — `App.jsx:7274` | Button click | No cache, but user-initiated | No |
| `suggestMealsForMode` — `App.jsx:6595` | Button click (week-type picker) | No | No |
| `findRescueMeals` — `App.jsx:6788` | Button click | No | No |
| `autoCategorize` (shopping) — `App.jsx:7683` | Button click | No | No |
| `aiRecategorize` (brain dump) — `App.jsx:8093` | Button click | No | No |
| Grocery photo — `App.jsx:7714` | User takes photo | No | No |
| Recipe URL import — `RecipesTab.jsx:129` | Button click | No | No |
| `askFamily` (Compass Ask/briefing/forecast) — `compassEngine.js:187` | Button click (Compass FAB) or explicit mode call | Mode-dependent | No |

**Root mechanism.** Tabs do **not** remount on every switch — `App.jsx:11636-11641` keeps a tab mounted for the rest of the session once visited (`visitedTabs` ref, seeded with the initial tab at `App.jsx:3050`), toggling `display:none/block` rather than unmounting. So the original F-18 framing ("fires on every AnchorTab mount, tab-switching burns rate limit") is **partially wrong as written** — switching tabs back and forth does not refire it once Anchor has been visited once in the session. The actual trigger is **once per full page load/app-open**, because `visitedTabs` and every mount-effect guard above live in component/session state that resets on each fresh mount of `HomeFlow`.

**Realistic calls-per-minute.** A single fresh page load, for a household with 2-4 events still upcoming today, fires **1 (AnchorTab) + up to 3 (morning/dinner/evening, time-gated) + 2-4 (event nudges) = 6-8 automatic, uncached calls within the first couple seconds** — zero user action. This repeats on every full reopen, not on in-session tab-switching.

### Rate limit math

`api/claude.js:31-32`: `RATE_LIMIT = 60` requests per user per `RATE_WINDOW_MS = 10 * 60 * 1000` (10 min), keyed by `user.id` in an in-memory `Map` (`api/claude.js:35-47`).

A single page load with a live calendar burns ~6-8 calls instantly. **8-10 fresh app-opens inside a 10-minute window** — plausible for an iOS PWA that gets killed by the OS on backgrounding and reopens cold each time, or a user checking the app repeatedly, or two devices on the same account — is enough to hit 60. No distributed abuse required. Because Vercel routes light, low-concurrency traffic to a single warm instance, the per-instance in-memory counter (previously flagged in F-22 as "effectively unlimited" against *distributed* abuse) **does bind correctly against a single legitimate user** — that is exactly what the console log shows happening.

### What "using fallback, no retry" shows the user

That log (`App.jsx:3904`) comes from `generateAIMessage` (`App.jsx:3893-3910`), one of only two call sites that handles this correctly: it checks `if (!r.ok)`, logs, and returns a hardcoded fallback string still used to schedule the notification/banner. **Silent degradation** — the user gets a generic notification instead of an AI-personalized one; no visible error.

**That correctness is not universal — see F-63.** `compassEngine.js:197-201` also does it right (checks `r.ok`, throws a user-facing 429-specific message: "Compass needs a short breather — try again in a few minutes."). Every *other* call site skips the `res.ok` check, with consequences detailed below.

---

## Findings (F-63 onward)

- **F-63 — High.** `App.jsx:3626,3895,5265,6603,6792,7278,7688,8099`; `RecipesTab.jsx:133`. None of these `/api/claude` call sites check `res.ok` before parsing the response body. On any non-2xx status (429 confirmed in production; also 401/500), `dat.content?.find(...)` optional-chains to `undefined`, falls through to the empty-string/array default, `JSON.parse` succeeds on that default, and the code proceeds with empty/blank data instead of throwing into the existing `catch` fallback. `RecipesTab.extractFromUrl` is the worst case: it silently saves a blank recipe object rather than showing its own `catch`-block error ("Could not extract recipe. Try adding manually."). Contrast: `compassEngine.js:197-201` and `App.jsx:3893-3910` (`generateAIMessage`) both check `r.ok` correctly and are unaffected. **Fix:** add `if (!res.ok) throw new Error(...)` (or equivalent early-return) at each of the 8 unguarded sites, before the `res.json()`/parse chain, so 429s route into each site's existing catch/fallback instead of silently succeeding with empty data. **Effort:** 1h (mechanical, same shape at each site).

- **F-64 — High.** `App.jsx:4121-4128` (trigger) + `3950-4022` (body). `scheduleAllDailyNotifications` fires automatically via `useEffect(...,[notifPermission])` on every page load where notification permission is already granted **or unconditionally on iOS** (`isIOS` bypasses the permission check at line 4124), gated only by a once-per-calendar-day `sessionStorage` flag (`App.jsx:3920-3925`, scoped per tab/WebView instance — resets on every fresh iOS PWA relaunch). Each firing makes 3 sequential `generateAIMessage` calls (morning/dinner/evening, each still individually time-gated) plus **one additional, unbounded call per remaining timed calendar event today** (`App.jsx:4010-4022`, `.forEach(async...)`, fired concurrently, not awaited). Combined with `loadAiSuggestions`'s own automatic call (F-18), a single fresh app-open for a household with a normal day's calendar can cost 6-8 automatic `/api/claude` calls with no user action — this is the direct root cause of the confirmed production 429. **Fix:** cache the notification copy per day (keyed by date + event id) instead of a per-tab session flag so re-opens don't re-burst; cap/batch the event-nudge loop (one combined call for all of today's events rather than one per event); consider moving notification-text generation off the critical app-open path entirely (e.g., server-side cron, already partially built per `api/send-notifications.js`). **Effort:** 3h.

- **F-18 — re-rated Medium → High.** `App.jsx:5188-5192` (`AnchorTab`). Original text ("fires on every AnchorTab mount... tab-switching burns rate limit") is **partially superseded**: tabs do not remount on switch (`App.jsx:11636-11641`, `visitedTabs` keep-alive pattern), so tab-switching alone doesn't refire it once Anchor's been visited. Corrected mechanism: `aiSuggestions`/`aiLoading` are local `useState` inside `AnchorTab` (`App.jsx:5124-5125`) with no persistence, and `visitedTabs` is a fresh `useRef` seeded with the landing tab (`App.jsx:3050`) on every `HomeFlow` mount — so this fires exactly once per fresh page load, unconditionally, with no daily cache. Combined with F-64 in the same load, this is a confirmed contributor to the production 429, not a hygiene issue. **Fix:** cache `aiSuggestions` per day (mirrors the pattern `BrainTab`'s pattern-insight effect already uses correctly at `App.jsx:8112-8113` via `localStorage.af_brainPattern`). **Effort:** 30m.

- **F-22/F-60 — re-rated, dual failure mode confirmed.** `api/claude.js:35-47`. Original framing (non-durable per-instance counter → "effectively unlimited," a billing/abuse risk under distributed traffic) still holds for scaled/malicious traffic across many cold serverless instances. **New, confirmed-in-production failure mode in the opposite direction:** under normal light traffic, Vercel keeps a single warm instance, so the same non-durable counter *does* bind — and because the app's own automatic call volume (F-64 + F-18) is high enough, it throttles legitimate single users, not just abusers. **Fix:** move to a durable per-user counter (Supabase table or Vercel KV) as before — fixes both directions at once — *and* land F-63/F-64/F-18 first, since those reduce the automatic call volume currently tripping the limit under normal use. **Effort:** 4h (durable limiter) + the 30m-3h from F-18/F-64.

### Severity table (headline findings)

| ID | Severity | One-line |
|---|---|---|
| F-64 | High | Unbounded automatic AI-call burst (3 + N-events) on every app-open; unconditional on iOS; confirmed production 429 root cause |
| F-63 | High | Missing `res.ok` check at 8 call sites → 429s silently produce empty/garbage output instead of error/fallback; RecipesTab persists a blank recipe |
| F-18 | High (was Medium) | AnchorTab's `loadAiSuggestions` fires uncached on every fresh page load (not per tab-switch, correcting prior text) |
| F-22/F-60 | High (reframed) | Non-durable rate limiter now confirmed to throttle legitimate single-user traffic, in addition to the original distributed-abuse gap |

---

## Bundle & render section (original 7-point agenda, deferred detail)

**Bundle size is confirmed NOT a user-facing problem.** Live Lighthouse run (production, `www.anchorandflowapp.com`):

| Metric | Score/Value |
|---|---|
| Performance | **96** |
| Accessibility | **71** |
| Best Practices | **100** |
| SEO | **100** |
| FCP | 1.1s |
| LCP | 1.7s |
| CLS | 0 |
| TBT | 210ms |

These numbers close out the bundle-size question raised at the top of this session: despite one 372 kB gzip chunk with zero code splitting, real-world load performance is excellent (Perf 96, LCP 1.7s, CLS 0). Code-splitting `AnchorVault` and friends would be a nice-to-have, not a fix for a measured problem. **Accessibility (71) is the one score here that is a real gap — flagged for Session 4, not addressed in this session.**

### Bundle composition (verified via `npm run build`)
- Output: `1,566.83 kB` raw / `372.05 kB` gzip, **1 chunk, zero code splitting**, 80 modules transformed. Vite's chunk-size warning fires on every build.
- `AnchorVault.jsx` (6,970 lines / 517 kB source) is the single largest file feeding the bundle — the obvious code-splitting candidate if this becomes a priority later, alongside `SchoolTab`, `RippleTab`, `RecipesTab` per the original brief. Note: `SchoolTab` is **not** a separate file — it's an inline closure inside `App.jsx` (`_hfRenders.SchoolTab`, `App.jsx:9690`), so it can't be dynamically imported without extracting it first.

### Render architecture — the 267-`useState` `HomeFlow` monolith
`HomeFlow` (`App.jsx:1914-11930`, ~10,000 lines) holds **267 of the file's 310 `useState` calls in one function component**. All ~34 tab/modal renderers are defined as fresh closures on every `HomeFlow` render via the `_hfRenders`/`_hfComps` indirection (`App.jsx:1894-1912`): `_hfComps[n]` is a stable module-level wrapper so React doesn't remount on re-render, but the actual render logic (`_hfRenders[n]`) is reassigned to a brand-new closure every single time `HomeFlow` re-renders — which is on any one of those 267 state variables changing, anywhere in the tree. This is deliberate (it avoids full remount) but it means no tab can be meaningfully memoized without restructuring state to flow in as props rather than closure capture over `HomeFlow`'s scope. Supporting counts: zero `useMemo`, only 5 `useCallback`, zero `React.memo` in `App.jsx`; 225 inline `.filter/.sort/.reduce` calls inside `HomeFlow` that re-run on every render of whichever tab is active.

This same architecture (tabs kept mounted for the session via `visitedTabs`, `App.jsx:11636-11641`) is what makes the F-18/F-64 automatic-call bugs fire once-per-load rather than once-per-tab-switch — the render-cost finding and the production-429 finding share the same root file structure.

### Assets
- **Fonts are fine.** `index.html:26-28` — Cormorant Garamond + DM Sans loaded via Google Fonts with `preconnect` to both `fonts.googleapis.com`/`fonts.gstatic.com` and `display=swap` already set. No FOIT risk; no action needed.
- **Unoptimized PNGs/JPEGs.** Several onboarding/marketing screenshots in `public/` (`IMG_9896.png` 464K, `screen-shopping.png` 416K, `screen-ripple.jpeg`/`screen-survival.jpeg`/`screen-meals.jpeg` 280-320K each, plus `IMG_9889/9890/9893` at similar sizes) ship uncompressed at full resolution. These are separate from the 372 kB JS bundle figure but are real payload weight for onboarding screens — candidates for WebP/AVIF conversion and resizing if asset weight becomes a priority.
- F-35 (base64 files in localStorage/sync blob) was reviewed for a bundle-weight angle: it's user-uploaded runtime data (Gifts/Pets/CDocs vault items), not a build-time asset, so it doesn't add to the static bundle — no new angle beyond the existing sync-payload/quota framing in Session 2.

### Not re-derived this session
Duplicate-work beyond what's covered above, full startup waterfall, and virtualization were not expanded — the redirect to the 429 investigation took priority. Available on request, ideally alongside a live waterfall trace rather than static analysis.

---

## Coverage confirmation
- `src/App.jsx` read in full at relevant line ranges for all headline findings; `src/components/RecipesTab.jsx`, `src/compass/compassEngine.js`, `api/claude.js` read in full.
- `npm run build` executed against commit `174b06e`; output numbers above are measured, not estimated.
- Live Lighthouse run supplied externally and incorporated verbatim above.
