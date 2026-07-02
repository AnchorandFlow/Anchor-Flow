/**
 * tests/syncCore.test.js
 *
 * Characterization tests for the Anchor & Flow sync layer.
 * Covers the eight scenarios from the backlog + audit finding P1-1.
 *
 * Run: npm test
 *
 * Test helpers
 * ─────────────
 * makeLS() creates an in-memory localStorage substitute.  Every test that
 * touches storage creates a fresh one — tests never share state.
 *
 * Manual-verification stubs
 * ─────────────────────────
 * Scenarios that depend on DOM state (focus, drag, visibility) or the real
 * network cannot be tested purely in Vitest.  Those tests are marked with
 * MANUAL: and describe the exact browser console sequence to verify instead.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  markKeyDirty,
  readDirtyKeys,
  isOwnWrite,
  shouldApplyRemote,
  isRemotePayloadSafe,
  sanitizeHouseholdData,
  mergeDirtyLocalWins,
  _DIRTY_EXCLUDE,
  SYNC_KEYS,
  MEAL_DAYS,
} from "../src/sync/syncCore.js";

// ---------------------------------------------------------------------------
// Test helper: in-memory localStorage substitute
// ---------------------------------------------------------------------------
function makeLS() {
  var store = {};
  return {
    getItem:    function(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem:    function(k, v) { store[k] = String(v); },
    removeItem: function(k) { delete store[k]; },
    clear:      function() { store = {}; },
    _store:     function() { return store; },  // for inspection
  };
}

// Minimal remote payload that passes isRemotePayloadSafe (two non-null keys)
var SAFE_REMOTE = {
  tasks: [{ id: "t1", text: "Remote task" }],
  meals: { Monday: {}, Tuesday: {} }
};

// ---------------------------------------------------------------------------
// Scenario 1 — Typing during remote arrival
// ---------------------------------------------------------------------------
describe("Scenario 1 — typing guard (MANUAL)", function() {
  it("MANUAL: poll skips apply while INPUT/TEXTAREA is focused", function() {
    /*
     * Cannot test DOM focus state in Vitest without jsdom.
     *
     * Manual verification steps (App.jsx:2611-2617 / checkForUpdates):
     *   1. Open app in two browser windows (A and B).
     *   2. On window A, focus any text field (task input, search, etc.).
     *   3. On window B, make an edit and wait for it to push (~3 s debounce).
     *   4. On window A, watch the DevTools console — you should see:
     *        [AF POLL RETURN] isTyping INPUT
     *      and NO reload occurs, even though serverTs > lastHHSync.
     *   5. Blur the input on A (click elsewhere). Within the next 60 s poll
     *      tick (or on next visibilitychange), A should reload and pick up B's
     *      change.
     *
     * What the code checks (App.jsx:2612):
     *   const activeEl = document.activeElement;
     *   const isTyping = activeEl &&
     *     (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" ||
     *      activeEl.tagName === "SELECT");
     *   if (isTyping) return;   // no reload
     *
     * Additionally, lastTypedRef.current is updated on every keydown; the
     * guard also fires if Date.now() - lastTypedRef.current < 15000 (15 s),
     * even after the user has blurred the field (App.jsx:2613-2617).
     */
    expect(true).toBe(true); // stub — intent is documentation, not assertion
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — Own-write return (P0-2 / push-stamp)
// ---------------------------------------------------------------------------
describe("Scenario 2 — own-write detection", function() {
  it("isOwnWrite returns true when serverTs matches stored lastPushedAt", function() {
    var ls = makeLS();
    // App.jsx stores lastPushedAt as a raw string (not JSON-encoded)
    ls.setItem("af_lastPushedAt", "2026-07-01T12:00:00+00:00");
    expect(isOwnWrite("2026-07-01T12:00:00+00:00", ls)).toBe(true);
  });

  it("isOwnWrite returns false when timestamps differ by one character", function() {
    var ls = makeLS();
    ls.setItem("af_lastPushedAt", "2026-07-01T12:00:00+00:00");
    expect(isOwnWrite("2026-07-01T12:00:01+00:00", ls)).toBe(false);
  });

  it("isOwnWrite returns false when lastPushedAt is absent", function() {
    var ls = makeLS();
    expect(isOwnWrite("2026-07-01T12:00:00+00:00", ls)).toBe(false);
  });

  it("isOwnWrite strips surrounding quotes if lastPushedAt was JSON-encoded", function() {
    // Defensive: some older write paths may JSON.stringify the timestamp
    var ls = makeLS();
    ls.setItem("af_lastPushedAt", JSON.stringify("2026-07-01T12:00:00+00:00"));
    expect(isOwnWrite("2026-07-01T12:00:00+00:00", ls)).toBe(true);
  });

  it("shouldApplyRemote returns false when serverTs equals lastHHSync", function() {
    var ls = makeLS();
    ls.setItem("af_lastHHSync", "2026-07-01T12:00:00+00:00");
    expect(shouldApplyRemote("2026-07-01T12:00:00+00:00", ls)).toBe(false);
  });

  it("shouldApplyRemote returns true when serverTs is newer", function() {
    var ls = makeLS();
    ls.setItem("af_lastHHSync", "2026-07-01T12:00:00+00:00");
    expect(shouldApplyRemote("2026-07-01T13:00:00+00:00", ls)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — Remote-while-clean (happy path apply)
// ---------------------------------------------------------------------------
describe("Scenario 3 — remote apply when no local dirty keys", function() {
  it("mergeDirtyLocalWins passes all remote keys through when dirty list is empty", function() {
    var result = mergeDirtyLocalWins(
      { tasks: [{ id: "t1" }], meals: {}, preferredName: "Lindsey" },
      []
    );
    expect(result.skipped).toHaveLength(0);
    expect(Object.keys(result.toWrite)).toEqual(["tasks", "meals", "preferredName"]);
  });

  it("all toWrite keys are exactly the remote payload keys when no dirty overlap", function() {
    var remote = sanitizeHouseholdData(SAFE_REMOTE);
    var result = mergeDirtyLocalWins(remote, []);
    expect(result.skipped).toHaveLength(0);
    // Every key in the sanitized remote should be in toWrite
    Object.keys(remote).forEach(function(k) {
      expect(Object.prototype.hasOwnProperty.call(result.toWrite, k)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario 4 — Remote-while-dirty (P1-1 fix: dirty-local-wins)
// ---------------------------------------------------------------------------
describe("Scenario 4 — dirty-local-wins merge", function() {
  it("dirty key is skipped; other keys are written", function() {
    var dirtyKeys = ["tasks"];
    var remoteClean = {
      tasks: [{ id: "r1", text: "remote task" }],
      preferredName: "Lindsey"
    };
    var result = mergeDirtyLocalWins(remoteClean, dirtyKeys);
    expect(result.skipped).toContain("tasks");
    expect(result.skipped).not.toContain("preferredName");
    expect(Object.prototype.hasOwnProperty.call(result.toWrite, "tasks")).toBe(false);
    expect(result.toWrite.preferredName).toBe("Lindsey");
  });

  it("all dirty keys are skipped when they all appear in remote", function() {
    var dirty = ["tasks", "workDays", "traditions"];
    var remote = {
      tasks: [],
      workDays: { "2026-07-01": { type: "wfh" } },
      traditions: [{ id: "t1" }],
      meals: {}
    };
    var result = mergeDirtyLocalWins(remote, dirty);
    expect(result.skipped.sort()).toEqual(["tasks", "traditions", "workDays"]);
    expect(Object.keys(result.toWrite)).toEqual(["meals"]);
  });

  it("dirty keys not present in remote payload are not in skipped", function() {
    // dirty key "workDays" but remote didn't send it
    var result = mergeDirtyLocalWins({ tasks: [] }, ["workDays"]);
    expect(result.skipped).toHaveLength(0);
    expect(result.toWrite).toEqual({ tasks: [] });
  });

  it("markKeyDirty writes key to af_dirtyKeys", function() {
    var ls = makeLS();
    markKeyDirty("tasks", ls, false, _DIRTY_EXCLUDE);
    var dirty = readDirtyKeys(ls);
    expect(dirty).toContain("tasks");
  });

  it("markKeyDirty is idempotent — same key appears only once", function() {
    var ls = makeLS();
    markKeyDirty("tasks", ls, false, _DIRTY_EXCLUDE);
    markKeyDirty("tasks", ls, false, _DIRTY_EXCLUDE);
    var dirty = readDirtyKeys(ls);
    expect(dirty.filter(function(k) { return k === "tasks"; })).toHaveLength(1);
  });

  it("markKeyDirty is suppressed while hydrating", function() {
    var ls = makeLS();
    markKeyDirty("tasks", ls, true /* hydrating */, _DIRTY_EXCLUDE);
    expect(readDirtyKeys(ls)).toHaveLength(0);
  });

  it("markKeyDirty ignores excluded system keys", function() {
    var ls = makeLS();
    _DIRTY_EXCLUDE.forEach(function(k) {
      markKeyDirty(k, ls, false, _DIRTY_EXCLUDE);
    });
    expect(readDirtyKeys(ls)).toHaveLength(0);
  });

  it("workDays and traditions are NOT in _DIRTY_EXCLUDE (must sync)", function() {
    expect(_DIRTY_EXCLUDE).not.toContain("workDays");
    expect(_DIRTY_EXCLUDE).not.toContain("traditions");
    expect(_DIRTY_EXCLUDE).not.toContain("cal_markers");
  });
});

// ---------------------------------------------------------------------------
// Scenario 5 — Duplicate / out-of-order events
// ---------------------------------------------------------------------------
describe("Scenario 5 — duplicate and out-of-order remote events", function() {
  it("shouldApplyRemote returns false for same timestamp (dedup)", function() {
    var ls = makeLS();
    var ts = "2026-07-01T12:00:00+00:00";
    ls.setItem("af_lastHHSync", ts);
    // Receiving the same event twice — second should be a no-op
    expect(shouldApplyRemote(ts, ls)).toBe(false);
  });

  it("KNOWN GAP — shouldApplyRemote cannot detect out-of-order older timestamps", function() {
    // App.jsx:2594 uses string equality only: serverTs !== lastSync.
    // An older timestamp that is simply "different" from lastHHSync returns true
    // here, meaning the poll would attempt to apply stale data. In practice this
    // is unlikely (Supabase updated_at is monotone), but it is a gap.
    // Phase B fix: compare as Date objects and skip if serverTs < lastHHSync.
    var ls = makeLS();
    ls.setItem("af_lastHHSync", "2026-07-01T12:00:05+00:00");
    // Documents current (imperfect) behavior — true means "would try to apply"
    expect(shouldApplyRemote("2026-07-01T12:00:00+00:00", ls)).toBe(true);
  });

  it("readDirtyKeys returns [] when af_dirtyKeys is corrupted JSON", function() {
    var ls = makeLS();
    ls.setItem("af_dirtyKeys", "not-json{{{{");
    expect(readDirtyKeys(ls)).toEqual([]);
  });

  it("readDirtyKeys returns [] when af_dirtyKeys is absent", function() {
    var ls = makeLS();
    expect(readDirtyKeys(ls)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Scenario 6 — Reconnect / catch-up on visibility change
// ---------------------------------------------------------------------------
describe("Scenario 6 — reconnect catch-up (MANUAL)", function() {
  it("MANUAL: visibilitychange fires checkForUpdates on mobile return-to-tab", function() {
    /*
     * Cannot simulate document.visibilityState changes in Vitest without jsdom.
     *
     * Manual verification (App.jsx:2682-2686):
     *   1. Open app on a mobile device (Chrome/Safari).
     *   2. On a second device, make an edit and let it push.
     *   3. On the mobile device, switch to a different app for >60 s (so the
     *      interval timer is suspended by the browser).
     *   4. Return to Anchor & Flow.
     *   5. With AF_DEBUG on, you should see in the console within 1–2 s:
     *        [AF POLL] visibilitychange — running checkForUpdates
     *      followed by the normal poll-apply sequence.
     *
     * What the code installs (App.jsx:2682):
     *   function onVisible() {
     *     if (document.visibilityState === "visible") checkForUpdates();
     *   }
     *   document.addEventListener("visibilitychange", onVisible);
     *
     * The cleanup returned by the useEffect removes this listener on unmount.
     */
    expect(true).toBe(true); // stub
  });
});

// ---------------------------------------------------------------------------
// Scenario 7 — Invalid / dangerous payloads
// ---------------------------------------------------------------------------
describe("Scenario 7 — isRemotePayloadSafe guards", function() {
  it("rejects null", function() {
    expect(isRemotePayloadSafe(null, "2026-07-01", makeLS())).toBe(false);
  });

  it("rejects non-object (string)", function() {
    expect(isRemotePayloadSafe("tasks", "2026-07-01", makeLS())).toBe(false);
  });

  it("rejects empty object {}", function() {
    expect(isRemotePayloadSafe({}, "2026-07-01", makeLS())).toBe(false);
  });

  it("rejects single-key object (< 2 non-null keys)", function() {
    expect(isRemotePayloadSafe({ tasks: [] }, "2026-07-01", makeLS())).toBe(false);
  });

  it("accepts object with 2+ non-null keys when local has no core data", function() {
    var ls = makeLS(); // no local core data → hasCoreData is false → only key-count check
    expect(isRemotePayloadSafe({ tasks: [], meals: {} }, "2026-07-01", ls)).toBe(true);
  });

  it("rejects remote with 0 core arrays when local has core data", function() {
    var ls = makeLS();
    ls.setItem("af_tasks", JSON.stringify([{ id: "t1", text: "local" }]));
    // Remote has 2 non-null keys but both are non-core — local has tasks → blocked
    expect(isRemotePayloadSafe(
      { preferredName: "Lindsey", flowMode: "calm" },
      "2026-07-01",
      ls
    )).toBe(false);
  });

  it("accepts remote that matches local core shape", function() {
    var ls = makeLS();
    ls.setItem("af_tasks", JSON.stringify([{ id: "t1" }]));
    expect(isRemotePayloadSafe(
      { tasks: [{ id: "t2" }], meals: {} },
      "2026-07-01",
      ls
    )).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scenario 7b — sanitizeHouseholdData guards
// ---------------------------------------------------------------------------
describe("Scenario 7b — sanitizeHouseholdData", function() {
  it("returns {} for null input", function() {
    expect(sanitizeHouseholdData(null)).toEqual({});
  });

  it("coerces null array fields to absence (not written)", function() {
    var result = sanitizeHouseholdData({ tasks: null });
    expect(Object.prototype.hasOwnProperty.call(result, "tasks")).toBe(false);
  });

  it("filters null items from array fields", function() {
    var result = sanitizeHouseholdData({ tasks: [null, { id: "t1" }, null] });
    expect(result.tasks).toEqual([{ id: "t1" }]);
  });

  it("normalizes each meals day to an object", function() {
    var result = sanitizeHouseholdData({ meals: { Monday: null, Tuesday: { dinner: "pasta" } } });
    expect(result.meals.Monday).toEqual({});
    expect(result.meals.Tuesday).toEqual({ dinner: "pasta" });
  });

  it("normalizes ripples from legacy object to empty array", function() {
    var result = sanitizeHouseholdData({ ripples: { "0": { id: "r1" } } });
    expect(result.ripples).toEqual([]);
  });

  it("preserves ripples when already an array", function() {
    var result = sanitizeHouseholdData({ ripples: [{ id: "r1" }] });
    expect(result.ripples).toEqual([{ id: "r1" }]);
  });

  it("rejects non-array shoppingItems (object) — returns absence, not empty array", function() {
    var result = sanitizeHouseholdData({ shoppingItems: { "0": { id: "s1" } }, tasks: [] });
    expect(Object.prototype.hasOwnProperty.call(result, "shoppingItems")).toBe(false);
  });

  it("filters null people entries and requires id + name", function() {
    var result = sanitizeHouseholdData({
      people: [null, { id: "p1" }, { id: "p2", name: "Madi" }, { name: "orphan" }]
    });
    expect(result.people).toEqual([{ id: "p2", name: "Madi" }]);
  });

  it("all MEAL_DAYS are present in sanitized meals output", function() {
    var result = sanitizeHouseholdData({ meals: { Monday: { dinner: "tacos" } } });
    MEAL_DAYS.forEach(function(day) {
      expect(Object.prototype.hasOwnProperty.call(result.meals, day)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario 8 — Version-change / app-shell refresh
// ---------------------------------------------------------------------------
describe("Scenario 8 — version-change forced reload (MANUAL)", function() {
  it("MANUAL: SW version bump causes hard reload on next visit", function() {
    /*
     * The service worker (public/sw.js) stores its cache under a versioned key:
     *   const CACHE_NAME = "anchor-flow-v20260622-1";
     *
     * When a new SW activates, its `activate` handler calls
     *   self.caches.keys() → deletes any key !== CACHE_NAME.
     *
     * The App.jsx _meta.app_version ("2026-06-03-vault-refresh") is embedded
     * in the push payload but is NOT currently checked on pull — there is no
     * in-app version gate that forces a reload when the bundle changes.
     *
     * The intended escape hatch for Phase B:
     *   In applyRemoteData, if remotePayload._meta.app_version !== APP_VERSION,
     *   skip in-place apply and fall back to window.location.reload() so the
     *   new bundle takes effect.  This is the ONLY remaining intentional use
     *   of location.reload() after the full Phase B migration.
     *
     * Manual verification of current SW behavior:
     *   1. Deploy a new bundle (new CACHE_NAME in sw.js).
     *   2. Open the app in a tab that has the old SW registered.
     *   3. The new SW installs in the background; old cache entries are deleted
     *      on activate.
     *   4. On next navigation / hard refresh, the new bundle loads from network.
     *   5. DevTools → Application → Service Workers confirms old SW is replaced.
     *
     * Note: APP_VERSION drift (audit P2) — the version string in App.jsx is
     * "2026-06-03-vault-refresh" while the SW cache key is "v20260622-1".
     * These should be unified before Phase B version-gate logic is added.
     */
    expect(true).toBe(true); // stub
  });
});

// ---------------------------------------------------------------------------
// SYNC_KEYS completeness sanity check
// ---------------------------------------------------------------------------
describe("SYNC_KEYS completeness", function() {
  it("contains the keys added in the dirty-marking fix (workDays, cal_markers, traditions)", function() {
    expect(SYNC_KEYS).toContain("workDays");
    expect(SYNC_KEYS).toContain("cal_markers");
    expect(SYNC_KEYS).toContain("traditions");
  });

  it("does not contain af_ prefix — keys are logical names", function() {
    SYNC_KEYS.forEach(function(k) {
      expect(k.startsWith("af_")).toBe(false);
    });
  });
});
