# Notification tap-to-open — Code Map

**Branch:** notif-click (cut from lh-2 post-merge)
**Date:** 2026-07-11

---

## R1 — public/sw.js full analysis

### `push` handler (lines 102–127) — EXISTS

Reads `event.data.json()`, merges with defaults via `Object.assign`, calls
`showNotification`. The key line:

```js
data: data.data || {},
```

So whatever the server sends as `payload.data` lands in `notification.data`.
Currently the server sends `data: { type: notifMeta.type, url: '/' }` — so
`notification.data.url` is `'/'` for every type.

The tag is `data.data.type || "ripple"`, which groups notifications correctly
by type so only one notification per type is shown at a time.

### `notificationclick` handler (lines 129–146) — EXISTS, but hardcoded

```js
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  if (event.action === "dismiss") return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "NOTIF_CLICK" });   // ← no URL
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/?ripple=1");    // ← hardcoded, not data.url
      }
    })
  );
});
```

**Two gaps:**
1. `openWindow` uses `"/?ripple=1"` — it does NOT read `event.notification.data.url`.
2. `postMessage` sends `{ type: "NOTIF_CLICK" }` with no destination — the app
   always navigates to anchor + Ripple feed regardless of which notification was tapped.

### What survived the July CACHE_VERSION rewrite

The comment on line 101 says "Push notifications (unchanged from original)".
The `push` and `notificationclick` handlers are structurally intact from the May
build. The July rewrite only changed `CACHE_VERSION`, the `install`/`activate`/`fetch`
strategy, and the `SKIP_WAITING` message handler.

---

## R2 — api/send-notifications.js full analysis

### Types handled

```js
const NOTIF_SCHEDULE = [
  { hour: 7,  type: 'morning', title: 'Good morning ⚓️' },
  { hour: 12, type: 'midday',  title: '🌊 Midday check-in' },
  { hour: 15, type: 'dinner',  title: '🍽️ Dinner heads-up' },
  { hour: 17, type: 'evening', title: '🌙 Evening recap' },
];
```

Manual type override: `?type=morning|midday|dinner|evening` bypasses hour check.

### Exact payload passed to webpush.sendNotification (line 145–151)

```js
await webpush.sendNotification(JSON.parse(sub.subscription_json), JSON.stringify({
  title: notifMeta.title,
  body,
  icon: '/favicon.svg',
  badge: '/favicon.svg',
  data: { type: notifMeta.type, url: '/' },   // ← url is '/' for ALL types
}));
```

`data.url` exists but is `'/'` for every notification type — no destination-specific
routing is encoded. The SW's `push` handler puts this into `notification.data`, which
means `notification.data.url` is always `'/'` when the user taps.

### Per-subscription error handling (lines 118–161)

```js
await Promise.all(subscriptions.map(async (sub) => {
  try {
    // ... send logic ...
    results.sent++;
  } catch (e) {
    results.failed++;
    results.errors.push(e.message?.slice(0, 100));
    if (e.statusCode === 410 || e.statusCode === 404) {
      try { await sbFetch(`...push_subscriptions?endpoint=eq.${...}`, { method: 'DELETE' }); } catch {}
    }
  }
}));
```

**Per-subscription try/catch is already in place** — one dead subscription does NOT
abort the loop. 404/410 responses auto-delete the stale endpoint from `push_subscriptions`.
Other errors increment `results.failed` and add the truncated error message to the array.

**The only gap:** endpoint tail is not logged on failure (just the raw error message),
making it hard to identify which subscription failed in the logs. Not a correctness bug.

### Subscription selection

```js
const subscriptions = await sbFetch(
  '/rest/v1/push_subscriptions?select=id,endpoint,subscription_json,household_id&limit=200'
);
```

Fetches ALL subscriptions across ALL households (no household_id filter), then groups
by household_id to fetch per-household data in parallel. This is intentional and correct
for a multi-household cron.

---

## R3 — push_subscriptions household assumptions

**No hardcoded household IDs** in `send-notifications.js`. The query fetches all rows
(cap 200). The App subscribes with `household_id: householdId` (App.jsx line 101), so
subscriptions carry the correct household ID at registration time.

`hh_5wbpecy` and `hh_o7yzu28` do not appear in any source file. No stale assumption
to fix.

---

## R4 — vercel.json cron entries

```json
{ "path": "/api/send-notifications", "schedule": "0 13 * * *" },
{ "path": "/api/send-notifications", "schedule": "0 18 * * *" },
{ "path": "/api/send-notifications", "schedule": "0 21 * * *" },
{ "path": "/api/send-notifications", "schedule": "0 23 * * *" }
```

UTC hours 13/18/21/23 correspond to 7am/12pm/3pm/5pm Mountain Time (UTC-6 MDT).
Route `/api/send-notifications` matches `api/send-notifications.js` via Vercel's
filesystem router — correct. ✓

---

## R5 — App boot/navigation and insertion point

### Navigation model

No router. Tab state is purely React state in `HomeFlow`:

```js
// Line 3162 — lazy initializer reads sessionStorage
const [tab,setTab] = useState(()=>{
  try { const s = sessionStorage.getItem("af_activeTab"); if(s) return s; } catch {}
  return "anchor";
});

// Line 3212 — the single setter
function goTab(t) {
  setTab(t);
  try { sessionStorage.setItem("af_activeTab", t); } catch {}
  // also saves scroll position, etc.
}
```

Dispatching `window.dispatchEvent(new CustomEvent("af-set-tab", { detail: "calendar" }))`
also calls `goTab` (line 3163). So navigation has two entry points: `goTab()` directly
and the `af-set-tab` custom event.

### Existing notification handling (lines 3170–3206)

A single `useEffect([])` in `HomeFlow` handles both cases:

```js
// Already-open app: SW postMessage
navigator.serviceWorker.addEventListener("message", onMessage);
// onMessage: type "NOTIF_CLICK" → sets af_open_ripple, dispatches ripple-notif-action
// → handleRippleNotifAction → goTab("anchor") + setShowRippleFeed(true)

// Cold start / re-opened: query param
var sp = new URLSearchParams(window.location.search);
if (sp.get("ripple") === "1") {
  needsRipple = true;
  window.history.replaceState(null, "", window.location.pathname);
}
if (needsRipple) {
  setTimeout(() => { goTab("anchor"); setShowRippleFeed(true); }, 400);
}
```

### Safest insertion point for `af_dest` param read

**Same `useEffect` block** (lines 3185–3204), immediately after the `?ripple=1` block.
This is ideal because:
- `goTab` is already in scope
- The `history.replaceState` pattern is already established here
- The 400ms delay already exists for Ripple — `af_dest` navigation can share it or
  run immediately after (Ripple still wins if `needsRipple` is also true)
- Only runs once on mount (empty deps `[]`)

For the postMessage case (app already open), extend the existing `onMessage` handler
(currently at App.jsx lines 119–130 inside `useRippleNotifications`) to forward a
`url` field when present. Or add a second message type e.g. `NOTIF_DEST` in the same
`onMessage` block.

**Valid `goTab` slug targets** (from TABS array and MORE_TABS):
```
"anchor"    → Today / dashboard
"calendar"  → Calendar
"shop"      → Shopping
"settings"  → Settings
"home"      → Home Systems
"brain"     → Exhale
"weekly"    → Weekly Rhythm
"tidepool"  → Tide Pool
"cove"      → Cove
"meals"     → Meals
"ai"        → AI
```
`safeharbor` is a section inside Settings, not a top-level tab — `goTab("settings")`
is the right call, Safe Harbor section would need a secondary signal.

---

## Hypothesis verdict

| Hypothesis | Status | Finding |
|---|---|---|
| Missing `notificationclick` | **WRONG** | Handler exists (sw.js:129–146) |
| Missing `data.url` | **PARTIALLY WRONG** | `data.url` exists but is `'/'` for all types — not destination-specific |
| No route layer | **CORRECT** | State-driven, no router; `goTab()` is the mechanism |
| Unguarded send loop | **WRONG** | Already has per-subscription try/catch + 404/410 cleanup |

## Actual gaps (what Phase 2 must fix)

| # | File | Gap |
|---|---|---|
| F1 | sw.js | `openWindow` uses `"/?ripple=1"` — must read `event.notification.data.url` instead; `postMessage` must include `url` so the already-open path can navigate too |
| F2 | api/send-notifications.js | `data.url` is `'/'` for all types — must be `'/?af_dest=today'` (or type-specific slug per notification type) |
| F3 | App.jsx | No `af_dest` param reader on boot; no handler for URL-carrying postMessage from F1 |
| F4 | api/send-notifications.js | Send loop error handling already works; only cosmetic improvement: log endpoint tail on failure for debuggability |

## Phase 2 implementation sketch

### F1 — sw.js (3 lines change)

```js
// In notificationclick handler:
var dest = (event.notification.data && event.notification.data.url) || '/';
// already-open path:
client.postMessage({ type: "NOTIF_DEST", url: dest });
return client.focus();
// cold-open path:
return self.clients.openWindow(dest);
```

Keep `NOTIF_CLICK` type for backward compat OR rename to `NOTIF_DEST` and update App.

### F2 — api/send-notifications.js (1 line change per type)

```js
const DEST = {
  morning: '/?af_dest=today',
  midday:  '/?af_dest=today',
  dinner:  '/?af_dest=today',
  evening: '/?af_dest=today',
};
// in sendNotification payload:
data: { type: notifMeta.type, url: DEST[notifMeta.type] || '/' },
```

All four types map to `today` (the dashboard) by default. Can be differentiated later
(e.g. dinner → meals, evening → calendar).

### F3 — App.jsx boot shim (~10 lines in the existing useEffect)

```js
// After the ?ripple=1 block, in the same useEffect:
var dest = sp.get("af_dest");
var DEST_MAP = { today:"anchor", calendar:"calendar", reminders:"anchor",
                 shopping:"shop", safeharbor:"settings" };
if (dest && DEST_MAP[dest]) {
  setTimeout(function() { goTab(DEST_MAP[dest]); }, needsRipple ? 500 : 400);
  window.history.replaceState(null, "", window.location.pathname);
}
```

For the already-open postMessage path, add to `onMessage` in `useRippleNotifications`:
```js
if (e.data && e.data.type === "NOTIF_DEST" && e.data.url) {
  try {
    var u = new URL(e.data.url, window.location.origin);
    var d = new URLSearchParams(u.search).get("af_dest");
    var DEST_MAP = { today:"anchor", calendar:"calendar", reminders:"anchor",
                     shopping:"shop", safeharbor:"settings" };
    if (d && DEST_MAP[d]) { goTab(DEST_MAP[d]); }
    else { goTab("anchor"); }
  } catch { goTab("anchor"); }
}
```

### F4 — send loop (cosmetic only, already correct)

Add endpoint tail to error log:
```js
results.errors.push((sub.endpoint || "").slice(-40) + ": " + (e.message || "").slice(0, 80));
```
