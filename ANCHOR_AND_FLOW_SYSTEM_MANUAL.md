# Anchor & Flow — System Manual

**Last verified against source:** 2026-07-06
**App version string:** `"2026-06-03-vault-refresh"` (App.jsx:503 — intentionally stale; update before next release)
**SW cache version:** `anchor-flow-v20260622-1` (public/sw.js:1)

---

## Architecture overview

```
Browser (React 19 / Vite 8, ES2019 target)
│
├── src/App.jsx — monolithic (~11,800 lines)
│   All UI, all sync, all auth in one file.
│   Extracted modules: sync-core.js (SYNC_KEYS, sanitize, errorCode, clearZombieAuthKeys)
│   Extracted components: ExhaleSection.jsx, AnchorVault.jsx, SafeHarbor.jsx, …
│
├── localStorage (af_* keys)
│   ├── SYNC_KEYS (63 logical keys) ↔ households.data JSON column
│   ├── DEVICE_LOCAL (device-specific, never synced)
│   └── Auth: af_authToken, af_authUser (manual copies), af_supabase_session (Supabase SDK)
│
├── Supabase (project sbgbyptkunvyxjfpzght)
│   ├── households — whole-document sync
│   ├── exhale_cards — realtime table (EXHALE_V2 cards only)
│   ├── shopping_items — realtime table (SHOPPING_V2 only)
│   ├── household_members — member resolution
│   └── Auth: supabase-js JWT sessions
│
└── Vercel serverless /api
    ├── claude.js — hardened Anthropic proxy (DO NOT MODIFY)
    ├── anthropic.js — OPEN PROXY, no auth ❌ (P0-1, delete before public launch)
    └── send-notifications.js, subscribe.js
```

---

## Sync lifecycle (full detail)

### Edit → push

1. User edits any field backed by `useSaved(key, defaultVal)` (App.jsx:1690-1730)
2. `useSaved`'s `setSaved(newVal)` writes to `localStorage.setItem("af_" + key, JSON.stringify(newVal))`
3. `useSaved` appends `key` to `af_dirtyKeys` (skipped if `_afHydrating = true`)
4. `useSaved` dispatches `af-data-changed` CustomEvent
5. `af-data-changed` listener calls `debouncedSync()` (3-second debounce)
6. After debounce: `syncNow()` → `pushHouseholdData()`

### pushHouseholdData (App.jsx ~2130-2310)

1. Checks `authToken` and `householdId` — if missing, skips
2. **Stale-push guard**: fetches current `serverUpdatedAt` via Supabase REST
   - If `serverUpdatedAt > af_lastHHSync` AND NOT (own push or recent push): BLOCKED → calls `pullLatestHouseholdData()`
   - `af_lastHHSync` = "lastApplied" timestamp (written by all pull paths)
   - Own-push check: `serverUpdatedAt === af_lastPushedAt` OR `Date.now() - af_lastPushAt < 30s`
3. Reads all SYNC_KEYS from localStorage, builds payload
4. **nonNull < 2 guard**: if fewer than 2 non-null values, refuses push (empty-push protection)
5. PATCH with `return=representation` for server-confirmed timestamp
6. On success: stamps `af_lastPushedAt = serverTs`, `af_lastPushAt = Date.now()`

### pull paths (three)

All three stamp `af_lastHHSync` after applying:

| Function | Trigger | Notes |
|----------|---------|-------|
| `pullLatestHouseholdData` (~2382) | Stale-push guard or explicit call | Does NOT clear `af_dirtyKeys` (fixed F8) |
| `checkForUpdates` poll (~2630) | 60-second interval | Checks typing/drag/modal guards before applying |
| `pullHouseholdData` (~2290) | Initial join/household setup | Also writes `household_members` owner row |

### Apply path (checkForUpdates)

1. `isRemotePayloadSafe()` — sanity check (non-null, has keys)
2. `sanitizeHouseholdData()` — type-guards all SYNC_KEYS values
3. `createLocalBackup()` — snapshots current `af_*` state (3 retained)
4. Write each SYNC_KEYS value to localStorage
5. `window.location.reload()`

### F7/F8 story (July 5-6 push-death)

**F7** (fixed 2026-07-05): `ExhaleSection.jsx persist()` in EXHALE_V2 mode used raw
`localStorage.setItem` for `exhale_labels`, `exhale_color_labels`, `exhale_people` — bypassing
`lsSet()` which marks dirty and dispatches `af-data-changed`. Label renames were permanently
local. Fix: those three keys now go through `lsSet()`.

**F8** (fixed 2026-07-05): `pullLatestHouseholdData` unconditionally wiped `af_dirtyKeys`
after applying server data. A stale-blocked push triggered a pull that silently destroyed all
pending edits. Fix: removed the wipe — dirty keys survive the pull and push on the next sync
cycle (the pull stamps `af_lastHHSync = serverTs`, so the guard passes).

---

## localStorage key inventory

### SYNC_KEYS (63 logical keys, pushed/pulled as one household document)

Defined in `src/sync-core.js`. Each is stored as `af_<key>`.

```
tasks, brainItems, brainCats, calEvents, connectedCals, calColorLabels
meals, mealsWeekOf, nextWeekMeals, mealCount, mealThemeEnabled, mealThemes, favMeals, mealBankCustom, recipes
shoppingItems, stores, shopCategories
people, familyProfile, birthdays, rhythm, homeSystems
notifications, recurring, notifSettings
sections, flowMode, preferredName, flowGreetingTone, weatherLocation, burnoutChecked, aiMemory
celebrations, celebgifts, gifts, inventory, pets, ripples, houseFile, favProducts, packing_templates
moments, subs, vaultSystems
health, career, travel_profile
cove_lists_v1, cove_items_v1, cove_sections_v1, cove_notes_v1
schoolData, coveData, dietaryFilters
compassCache, compassEnabled
exhale_groups, exhale_color_labels, exhale_people, exhale_labels
cal_markers, cal_marker_types, workDays
traditions
monthMeals, af_nwMealCount   ← see QUIRKS section
```

### DEVICE_LOCAL (never synced, device-specific)

```
af_authToken          — JWT access token (manual copy alongside Supabase SDK session)
af_authUser           — {id, email, displayName} JSON
af_supabase_session   — Full Supabase SDK session (written by supabase-js)
af_householdId        — Resolved household UUID
af_deviceId           — Random UUID, generated once, identifies this device in _meta
af_dirtyKeys          — JSON array of SYNC_KEYS that need pushing
af_lastHHSync         — ISO timestamp of last applied server data ("lastApplied")
af_lastPushedAt       — ISO timestamp of last successful push (own-push reconciliation)
af_lastPushAt         — Unix ms of last push (recent-push window, 30s)
af_lastPullAt         — Unix ms of last pull
af_backup_<ts>        — Local snapshot (3 retained; prunes on new backup creation)
af_anchor_hidden      — Per-device vault section visibility
af_shopping_v2_backfilled_<hid> — Migration flag per household
checkedPersonalAnchors_<day>_<userId> — Per-day per-user checked state
```

### Feature flags (device-local, see FEATURE_FLAGS.md for full detail)

```
af_exhale_v2        — opt-OUT, default ON (=== "false" to disable)
af_shopping_v2      — opt-IN, default OFF (=== "true" to enable)
af_safe_harbor_v2   — opt-IN, default OFF (=== "true" to enable)
```

---

## Supabase tables, RLS, RPCs, realtime channels

### Tables

| Table | RLS | Notes |
|-------|-----|-------|
| `households` | owner_id = auth.uid() | Whole-document sync; `data` is JSONB |
| `household_members` | member read (owner row written on first push) | Used for member resolution and join |
| `exhale_cards` | household member | EXHALE_V2 realtime cards; requires REPLICA IDENTITY FULL |
| `shopping_items` | household member | SHOPPING_V2 realtime items |

### RPCs (SECURITY DEFINER)

- `join_household(p_invite_code)` — joins user to a household via invite code
- `shopping_add_item(p_id, p_household_id, p_text, p_store, p_category, p_photo, p_created_by)`
- `shopping_toggle_item(p_id)`, `shopping_update_item(...)`, `shopping_delete_item(p_id)`
- `exhale_update_card(...)`, `exhale_delete_card(p_id)`, `exhale_move_card(...)`

### Realtime channels

- `"exhale-<householdId>"` — subscribes to `exhale_cards` INSERT/UPDATE/DELETE
- `"shopping-<householdId>"` — subscribes to `shopping_items` changes

---

## Compass proxy flow (api/claude.js — DO NOT MODIFY)

```
Client (App.jsx) → /api/claude → Anthropic API
```

`api/claude.js` enforces:
- JWT verification against Supabase (same anon key)
- Server-side model map (blocks unknown model strings)
- `max_tokens` cap
- 6 MB body cap
- Body rebuilt from allowed fields (prevents prompt injection via extra fields)
- Per-user rate limit

The client-side fetch interceptor (App.jsx:381-385) rewrites `/api/anthropic` → `/api/claude`.
`api/anthropic.js` is an OPEN PROXY — it must be deleted before public launch (P0-1).

---

## Stripe entitlement assumptions

Billing is NOT built yet. Env vars exist (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
Assumed household-level billing model (one subscription per household, not per user).
No entitlement checks exist in the current codebase. All features are open to any authenticated user.
Gate all billing work behind the household ID, not the user ID.

---

## PWA / Service Worker update behavior

**SW file:** `public/sw.js` (DO NOT modify behavior; log redaction only per sprint policy)
**Cache key:** `anchor-flow-v20260622-1`

### Caching strategy

- `index.html`: network-first (always fresh)
- Hashed assets (`index-HASH.js`, CSS): cache-first (immutable hashes)
- `/api/*`: never cached

### Update flow

1. Browser detects new SW → SW waits (does not `skipWaiting` immediately)
2. App polls for SW updates (SW registration `update()` call)
3. When new SW ready: in-app banner prompts user to reload
4. Belt-and-suspenders: `controllerchange` listener in HomeFlow triggers reload

### hadController guard (App.jsx:2450)

```javascript
var hadController = !!navigator.serviceWorker.controller;
// controllerchange listener:
if (!hadController) return; // first-install — no reload needed
```

Prevents reload on first-install `clients.claim()` — reload only when REPLACING a prior SW.

### _swReloadFired guard (App.jsx:470)

Module-level boolean. `controllerchange` reload fires AT MOST ONCE per page lifetime
(prevents double-reload on rapid double-update).

---

## Quirks

### af_nwMealCount double-prefix

`useSaved("af_nwMealCount")` writes to `af_af_nwMealCount`. This is intentional — the key is
listed in SYNC_KEYS as `"af_nwMealCount"` (WITH the af_ prefix), so the sync loop reads and
writes `af_af_nwMealCount`. Do NOT normalize without a data migration for all existing devices.

### lastPushedAt vs lastPushAt twins

Two separate keys track push state:
- `af_lastPushedAt` — ISO timestamp of the push, matched against server `updated_at`
- `af_lastPushAt` — Unix ms of the push (for the 30-second recent-push window)

They serve different purposes: `lastPushedAt` for own-write recognition, `lastPushAt` for
recency guard. Do not consolidate without understanding both invariants.

### af_lastPushedAt raw-string format (F5)

`af_lastPushedAt` is stored via raw `localStorage.setItem` (not `JSON.stringify`). Reading
with `JSON.parse` would double-parse it. All existing readers use raw `localStorage.getItem`.
Future code must NOT use `lsGet()` (which calls JSON.parse) for this key.

### Stale duplicate components (P1-5)

Root `ExhaleSection.jsx` (pre-V2, 590 lines) and root `RipplesRoom.jsx` differ from
`src/components/` versions. `deploy.sh git add -A` re-commits them every deploy. Delete in a
future hygiene commit (they're recoverable from git history).

### workDays sync gap (P0-2)

`workDays` bypasses `useSaved`. `saveWorkDays()` writes localStorage directly without marking
dirty. A work-schedule edit pushes ONLY if another edit in the same session marks a dirty key
and triggers `debouncedSync`. Fix: mark `"workDays"` dirty after `saveWorkDays()` calls.

### compassEngine meals mismatch

`compassEngine.js` reads `state.meals` (lines 129/141/161) while planning data lives in
`nextWeekMeals`. Compass dinner guidance runs on stale/legacy data. Known issue.
