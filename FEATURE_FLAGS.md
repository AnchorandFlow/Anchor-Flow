# Feature Flags

All flags are read at module load time (not reactive — require page reload to take effect).

---

## af_exhale_v2

| Property | Value |
|----------|-------|
| **Storage** | Device-local (localStorage) |
| **Default** | ON (`localStorage.getItem("af_exhale_v2") !== "false"`) |
| **How to flip** | Set `localStorage.setItem("af_exhale_v2", "false")` in browser console + reload |
| **How to re-enable** | `localStorage.removeItem("af_exhale_v2")` + reload (or set to any non-"false" string) |
| **Reload required** | Yes — read at ExhaleSection.jsx:33 module load |
| **Scope** | Per-device (one device can be V1 while another is V2) |
| **Defined in** | `src/components/ExhaleSection.jsx:33` |

### What V2 enables

- Cards (`exhale_groups`) go to the `exhale_cards` Supabase realtime table (not the blob)
- Labels, color-labels, people (`exhale_labels`, `exhale_color_labels`, `exhale_people`) remain
  in the blob (SYNC_KEYS), pushed via `lsSet()` → `af_dirtyKeys` → `debouncedSync`
- V2 is default-ON — every device is V2 unless explicitly set to `"false"`

### Migration behavior

V1→V2: On first load in V2 mode with a `householdId`, `ExhaleSection` migrates existing
`af_exhale_groups` data to the `exhale_cards` table. A flag `af_exhale_v2_migrated_<hid>`
prevents re-migration.

### Rollback

Setting to `"false"` reverts to V1 blob-only path. Data in `exhale_cards` table is NOT
deleted — it would be re-migrated if V2 is re-enabled on the same device.

### Risk notes

- Mixed V1/V2 household: one device on V2 pushes cards via realtime; V1 device reads from
  blob. V1 won't see realtime card changes until it pulls. Labels always go through blob so
  they sync correctly in either mode.
- The V1 code path (`if (!EXHALE_V2)` branches) is dead code for all current devices. Safe
  to remove in a future cleanup — requires tests for V2-only path first.
- Dead state: `useSaved("exhaleLabels")` writes to `af_exhaleLabels` (camelCase) while sync
  uses `af_exhale_labels` (underscore). These are different keys. The `useSaved` call is a
  probable orphan from the V1→V2 rename. (See F2 in KNOWN_ISSUES.md)

---

## af_shopping_v2

| Property | Value |
|----------|-------|
| **Storage** | Device-local (localStorage) |
| **Default** | OFF (`localStorage.getItem("af_shopping_v2") === "true"`) |
| **How to flip** | `localStorage.setItem("af_shopping_v2", "true")` + reload |
| **How to disable** | `localStorage.removeItem("af_shopping_v2")` + reload |
| **Reload required** | Yes — read at App.jsx:514 module load |
| **Scope** | Per-device |
| **Defined in** | `src/App.jsx:514` |

### What V2 enables

- Shopping items go to the `shopping_items` Supabase realtime table via RPCs
- Realtime channel `"shopping-<householdId>"` is subscribed
- V1 legacy path: items stored in `af_shoppingItems` SYNC_KEYS blob

### Mixed-mode risk

If one device is V2 and another is V1, they use different storage paths. V2 writes to
`shopping_items` table; V1 reads from blob. The two diverge immediately. Do NOT enable V2
on only one household device — flip all or none.

### Backfill

On first V2 session with a `householdId`, existing V1 blob items are backfilled into
`shopping_items` once. Flag: `af_shopping_v2_backfilled_<hid>` prevents repeat backfill.

### Rollback

Disabling V2 returns to V1 blob. Items added while in V2 are NOT returned to the blob
automatically — manual migration needed if rolling back after data was written.

---

## af_safe_harbor_v2

| Property | Value |
|----------|-------|
| **Storage** | Device-local (localStorage) |
| **Default** | OFF (`localStorage.getItem("af_safe_harbor_v2") === "true"`) |
| **How to flip** | `localStorage.setItem("af_safe_harbor_v2", "true")` + reload |
| **How to disable** | `localStorage.removeItem("af_safe_harbor_v2")` + reload |
| **Reload required** | Yes — read at SafeHarbor.jsx:10 module load |
| **Scope** | Per-device |
| **Defined in** | `src/shell/SafeHarbor.jsx:10` |

### What V2 enables

- Consolidated data model with `version: 2` flag on the saved object
- `migrateToV2()` runs on first load with existing V1 data
- Safe Harbor data lives in `af_safe_harbor` localStorage (not SYNC_KEYS blob in V1)
- V2 adds structured fields (see safe-harbor-code-map.md for full schema)

### Rollback

Disabling V2 reverts to V1 path. The saved object's `version` field is ignored in V1.
No data loss — V2 data is a superset of V1.

---

## AF_DEBUG

| Property | Value |
|----------|-------|
| **Storage** | JS module constant (not localStorage) |
| **Default** | `false` (App.jsx:1) |
| **How to flip** | Edit `src/App.jsx:1` → `const AF_DEBUG = true;`, rebuild |
| **Scope** | Build-time, applies to the entire session |
| **Defined in** | `src/App.jsx:1` |

### What it gates

- Verbose mount/unmount/render logging for WeeklyRhythm, TidePool, Family sections
- Compass API response logging
- Push subscription success/failure logging
- Full error logging in RootErrorBoundary and SectionErrorBoundary
- Sensitive error messages that may contain auth details, user data, or API responses
- Various auth and sync diagnostic logs

**AF_DEBUG is always false in production.** Never deploy with it set to `true`.

---

## AF_TRACE

| Property | Value |
|----------|-------|
| **Storage** | `window.AF_TRACE` (set at runtime in browser console) |
| **Default** | `undefined` (falsy) |
| **How to flip** | `window.AF_TRACE = true` in browser DevTools console (no reload required) |
| **Scope** | Current page session only; lost on reload |
| **Defined by** | All usages guarded with `if (window.AF_TRACE && opId)` |

### What it gates

Detailed push lifecycle logs (App.jsx, ExhaleSection.jsx):
- `PUSH_STARTED`, `PUSH_SKIPPED` (with reason), `SUPABASE_REQUEST_SENT` (key list),
  `SUPABASE_RESPONSE_RECEIVED`, `SERVER_DATA_CONFIRMED`, `DIRTY_KEY_ADDED`,
  `LOCALSTORAGE_WRITTEN`, `SYNC_EVENT_DISPATCHED`

All AF_TRACE logs include an `opId` correlation string for tracing a single sync cycle.

---

## Dead/stale flags (safe to remove later)

### af_exhaleLabels (dead state — not a flag)

`useSaved("exhaleLabels")` writes to `af_exhaleLabels` (camelCase). The sync loop reads
`af_exhale_labels` (underscore). These never converge. The `useSaved` call is a leftover
from the V1 name before migration. Safe to remove AFTER confirming `setExhaleLabels` is not
rendered from the old `useSaved` state value.

**Removal steps:**
1. `grep -n "setExhaleLabels\|exhaleLabels" src/App.jsx` — confirm rendering uses sync path
2. Remove the `useSaved("exhaleLabels", ...)` call and the `[exhaleLabels, setExhaleLabels]` destructure
3. On boot, migrate: if `af_exhaleLabels` exists and `af_exhale_labels` is empty, copy value
4. Test: label renders correctly on both fresh device and migrated device
