# Notification Reliability Audit

**Provenance:** Findings F-N1 through F-N5 originate from an independent audit session (2026-07-20, uploaded to a separate conversation, not previously committed to this repo). Reproduced here verbatim for the permanent record, sourced from `~/Downloads/NOTIFICATION_RELIABILITY_AUDIT.md` on this machine. **F-N1 is the only finding verified against this repo's actual code before being marked FIXED** — its original citation (`App.jsx:3974–3983`) is stale (predates this session's RF-3 component extraction, which shifted line numbers), and has been superseded below with a citation re-verified directly against current source. **F-N2 through F-N5 are reproduced as-is, unverified by this session** — they describe server-side payload shape, on-device service-worker state, and architectural scope that can't be confirmed by reading this repo's source alone; treat them as ASSUMED/OPEN until independently checked (see the companion `NOTIFICATION_TEST_PLAN.md`, also in `~/Downloads/`, not yet committed to this repo either). **F-N6 is new** — found by this session while implementing F-N1, not part of the original audit.

**Original scope note (as written 2026-07-19/20):** sw.js (v20260720-011715-c643da5), App.jsx (12,410 lines), AnchorVault.jsx, ExhaleSection.jsx. Not in scope / not visible to that audit: server-side push sender (Supabase edge function / cron reading `notification_queue`), `push_subscriptions` table contents — claims about those are tagged **ASSUMED** below, unchanged from the source.

---

## Architecture: two notification systems (VERIFIED, per source audit)

| | System A — Server push | System B — Local timers |
|---|---|---|
| Used by | Ripples (and anything writing `notification_queue` server-side) | Morning/midday/dinner/evening digests, event nudges, **trash day / recurring reminders**, item reminders |
| Delivery | Web Push → sw.js `push` handler → `showNotification` | In-page `setTimeout` → `scheduleNotification()` (App.jsx:3965) |
| Works when app is closed | Yes (iOS 16.4+ installed PWA included) | **No — by definition** |
| iPhone behavior | Real lock-screen notification | **In-app banner only** (App.jsx:3971–3986 in the source audit's line numbering, deliberate `isIOS` branch) |

`notification_queue` is referenced **zero times** in App.jsx. The client never enqueues server pushes; only Ripples' server-side logic does (ASSUMED). This means every reminder a user sets in the app — including trash day — lives entirely on System B.

---

## Findings

### F-N1 (P1, VERIFIED, **FIXED 2026-07-20 — this session**) — sw.js has no `SHOW_NOTIFICATION` handler

**Original finding:** `scheduleNotification()` (cited at `App.jsx:3974–3983` in the source audit): when a SW controls the page — which is **always** in the installed PWA — it posts `{type:"SHOW_NOTIFICATION", title, body, icon}` to the SW. The SW's `message` listener only handled `SKIP_WAITING`. Result: **every local notification was silently dropped on Android/desktop PWA**, even with permission granted and the app open. The `new Notification()` fallback only runs when there is no controller (first uncontrolled load only).

**Re-verified against current source, this session (citation superseded — the source's `3974–3983`/`3971–3986` predate this session's RF-3 component extraction and no longer point at the right lines):** `scheduleNotification` is at `App.jsx:3965–3992`. The `isIOS`/`hasNativeNotif` branch is declared at `3971–3972`, checked at `3975`. The `postMessage` call is at `3977–3980` and posts exactly `{type: "SHOW_NOTIFICATION", title, body, icon: "/favicon.svg"}` — confirmed by direct read, not assumed from the original citation. `public/sw.js`'s `message` listener (`14–18` pre-fix) confirmed to only handle `SKIP_WAITING`, no `SHOW_NOTIFICATION` branch, matching the original finding.

**Fix applied** to `public/sw.js` (9 lines, additive): added a `SHOW_NOTIFICATION` branch inside the existing `message` listener (not restructured) that calls `self.registration.showNotification(...)` with `tag:"af-local"` and `data:{url: event.data.url || "/"}`, so taps route through the existing `notificationclick` handler. Icon/badge fallback (`/icon.png`) confirmed to exist in `public/`, consistent with the existing `push` handler's identical fallback pattern. `npx vitest run` (310/310) re-confirmed clean after the change; `sw.js` is a static file, not part of the Vite/es-check build.

### F-N2 (P1, VERIFIED, ARCHITECTURAL — do not patch today) — trash day / recurring reminders cannot reach a phone that isn't actively using the app

*Reproduced verbatim from source; unverified by this session.*

The recurring-reminder engine (App.jsx:4154–4243) schedules exclusively through System B:
- `setTimeout` dies when the tab closes, the PWA is backgrounded (~seconds on iOS), or the device sleeps.
- On iOS the code doesn't even attempt a notification — it shows an in-app banner, visible only if the app is open at fire time.
- `delay > 86400000` returns early — nothing beyond 24h ever arms.
- The mount-time recovery pass (App.jsx ~4270) shows *missed* reminders as banners on next open — better than nothing, but "your trash reminder, shown the morning after trash day" is not a reminder.

**This fully explains "trash day reminders don't come through."** The real fix is enqueueing recurring reminders into `notification_queue` for server push — a proper future session, not a closeout patch. **Label recurring reminders Experimental in beta comms.**

### F-N3 (P2, VERIFIED code / ASSUMED payload) — tap-to-open depends on a payload field the server may not send

*Reproduced verbatim from source; unverified by this session.*

The client-side tap pipeline is structurally complete in this tree:
- sw.js `notificationclick`: focuses existing client + posts `NOTIF_CLICK`, or `clients.openWindow(dest)` where `dest = event.notification.data.url || "/"`.
- App.jsx:187 handles `NOTIF_CLICK` → parses `?af_dest=` → `_DEST_MAP` → `af-set-tab` (listener verified at App.jsx:3090).
- Cold-start shim at App.jsx:3132 handles `?af_dest=` in the launch URL.

But routing only happens if the **server payload** includes `data: { url: "/?af_dest=<slug>", type: ... }`. If the sender omits `data.url`, every tap resolves to `"/"` — the app opens at the default tab with no context, which reads as "can't open into the app to read more." **Verify the edge-function/cron payload shape** — it is the only unexamined link in the chain.

### F-N4 (P2, ASSUMED — most likely cause of "tap does nothing at all" on the iPhone) — stale service worker on the installed PWA

*Reproduced verbatim from source; unverified by this session.*

The uploaded sw.js is current (versioned today). If Twyla's or your iPhone PWA is still running a SW installed **before** the `notificationclick` handler existed, taps do nothing. SW adoption requires the update banner tap; iOS PWAs hold stale SWs stubbornly. The test plan's first step checks the live SW version on-device before debugging anything else.

### F-N5 (P3, VERIFIED, no action) — cosmetic iOS mismatches in the push handler

*Reproduced verbatim from source; unverified by this session.*

`vibrate` and `actions` are ignored on iOS; harmless. `renotify:true` requires `tag`, which is set. `push_subscriptions` write uses `Prefer: resolution=merge-duplicates` and force-resubscribes with the current VAPID key on each subscribe tap — reasonable.

### F-N6 (P2, NEW, OPEN — found by this session, not in the original audit) — `scheduleNotification`'s local notifications never carry a deep-link URL

The client-side mirror of F-N3, but on System B (local timers) instead of System A (server push): `scheduleNotification` (`App.jsx:3965–3992`) posts `{type: "SHOW_NOTIFICATION", title, body, icon}` to the SW — **no `url` field, ever, on any call site** (checked all 8 call sites: `App.jsx:4002, 4093, 4108, 4119, 4136, 4151, 4237, 4280`). F-N1's new `SHOW_NOTIFICATION` handler in `sw.js` defaults `data.url` to `"/"` when `event.data.url` is absent — which, for every local notification, is always. That means once F-N1 ships, local notifications (digests, event nudges, item reminders) will correctly *appear* on Android/desktop, but tapping any of them will always deep-link to the app root, never to the relevant tab/entity — the same "opens with no context" symptom F-N3 describes for server push, just on the local-timer path instead. **Fix (not scoped/applied this session):** thread a destination through `scheduleNotification`'s callers (most already know which tab/entity they're about, e.g. the event-nudge caller at `App.jsx:4151` knows the event) and post it as `url: "/?af_dest=<slug>"`, matching the `_DEST_MAP`/`af-set-tab` pipeline F-N3 already documents as structurally complete on the receiving end. **Effort:** small per call site, but touches all 8 — needs the same `af_dest` slug mapping F-N3's server-side fix would use, so likely worth doing together with that work rather than separately.

---

## Readiness verdict

*Reproduced verbatim from source, with one annotation for F-N1's status change.*

| Path | Verdict |
|---|---|
| Ripples server push (delivery) | **Partially ready** — delivery works; deep-link routing unverified until F-N3 payload check + on-device tap test pass |
| Local digests (morning/evening etc.), Android/desktop | **Beta-ready after F-N1 fix deploys.** *[Annotation, this session: F-N1's code fix is now applied in this repo (`public/sw.js`), not yet committed or deployed as of this writing. "Deploys" still means an actual build/deploy, not just this commit landing — and F-N6 means the tap will land on the app root, not the specific item, until F-N6 is separately fixed.]* |
| Local digests, iOS | **Working as designed** (in-app banners) — set expectations in beta notes |
| Trash day / recurring reminders, any phone | **Experimental** — label it. Real fix = server-push migration (next session candidate) |

## Root causes of the two reported symptoms

*Reproduced verbatim from source.*

1. **"Can't open notifications into the app":** most likely stale SW on device (F-N4) and/or missing `data.url` in server payload (F-N3). Client code is not the problem in this tree. *(F-N6, found this session, adds: even once F-N1/F-N3/F-N4 are resolved, local-timer notifications specifically will still open with no context, for the same missing-`url` reason.)*
2. **"Trash day reminders don't come through":** System B architecture (F-N2). Not a bug; a designed limitation that needs the server-push migration.
