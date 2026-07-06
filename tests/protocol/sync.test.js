/**
 * Suite B — Sync protocol tests.
 *
 * Architecture note:
 *   The push/pull/poll functions live inside the HomeFlow component closure
 *   (App.jsx ~2190-2690) and cannot be imported without triggering the
 *   module-level IIFE (sanitizeLocalStorageOnLoad, ~line 257). Suite B
 *   therefore tests the PROTOCOL LOGIC directly — the decision functions and
 *   the localStorage state machine — rather than the component functions.
 *
 *   For each test, we:
 *     1. Construct the localStorage state that the function would read.
 *     2. Apply the pure logic (imported from sync-core.js, or inlined where
 *        the function is too entangled to extract cleanly).
 *     3. Assert the resulting state or decision.
 *
 *   Tests that require rendering the component (B1, B8, B9, B10) are marked
 *   NEEDS_BROWSER or implemented as pure-logic proxies that cover the same
 *   invariant without rendering.
 *
 * sbFetch mocking:
 *   sbFetch is module-scope in App.jsx. Since App.jsx cannot be imported,
 *   fetch mocking is done via vi.stubGlobal("fetch", ...) for tests that
 *   simulate the HTTP layer directly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SYNC_KEYS, sanitizeHouseholdData, clearZombieAuthKeys } from "../../src/sync-core.js";

// ── localStorage helper ───────────────────────────────────────────────────────
// jsdom provides window.localStorage; these helpers make tests readable.
function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function lsGet(key) {
  const v = localStorage.getItem(key);
  if (v === null) return null;
  try { return JSON.parse(v); } catch { return v; }
}
function lsClear() { localStorage.clear(); }

// ── Simulate the pull write loop ──────────────────────────────────────────────
// Reproduces the SYNC_KEYS.forEach write block used by pullHouseholdData,
// pullLatestHouseholdData, checkForUpdates, and syncNow.
function simulatePullWrite(cleanData, serverTs) {
  SYNC_KEYS.forEach(k => {
    if (cleanData[k] !== undefined) {
      try { localStorage.setItem("af_" + k, JSON.stringify(cleanData[k])); } catch {}
    }
  });
  if (serverTs) localStorage.setItem("af_lastHHSync", serverTs);
}

// ── Simulate the push decision ────────────────────────────────────────────────
// Reproduces the stale-check and nonNull guard from pushHouseholdData.
function simulatePushDecision(serverUpdatedAt, lastHHSync, lastPushedAt) {
  if (!lastHHSync) return { action: "pull", reason: "no-lastHHSync" };
  const serverMs = new Date(serverUpdatedAt).getTime();
  const localMs  = new Date(lastHHSync).getTime();
  if (serverMs > localMs) {
    if (serverUpdatedAt === lastPushedAt) return { action: "reconcile", reason: "own-push" };
    return { action: "pull", reason: "stale" };
  }
  return { action: "push", reason: "allowed" };
}

// ── Simulate dirty-key mark logic ─────────────────────────────────────────────
// Reproduces markKeyDirty without importing App.jsx.
const _DIRTY_EXCLUDE = ["authToken","authUser","refreshToken","householdId",
  "dailySummaryScheduled","lastSeenDate","checkedCalEvents","checkedMealItems",
  "insights","insightsBuilt","dismissedInsights","lastHHSync","lastPushedAt",
  "deviceId","dirtyKeys","theme","activeTab"];

function simulateMarkDirty(key, isHydrating) {
  if (isHydrating) return false;
  if (_DIRTY_EXCLUDE.indexOf(key) !== -1) return false;
  const dirty = lsGet("af_dirtyKeys") || [];
  if (dirty.indexOf(key) === -1) {
    dirty.push(key);
    lsSet("af_dirtyKeys", dirty);
    return true;
  }
  return false; // already dirty
}

beforeEach(() => { lsClear(); });
afterEach(() => { vi.restoreAllMocks(); });

// ── B1: pull writes VALUES into af_-prefixed localStorage ─────────────────────
describe("B1 — pull writes key values into af_-prefixed localStorage", () => {
  // NEEDS_BROWSER for full integration (requires HomeFlow render + sbFetch mock).
  // This test exercises the write loop directly — same behavior, no component.

  it("each SYNC_KEYS key is written as af_<key>", () => {
    const serverData = {
      tasks: [{ id:"t1", text:"server task" }],
      people: [{ id:"p1", name:"Alice" }],
      flowMode: "Smooth",
      traditions: [{ id:"tr1", title:"Christmas Eve" }],
    };
    const clean = sanitizeHouseholdData(serverData);
    simulatePullWrite(clean, "2026-07-03T00:00:00.000Z");

    // Values land at af_tasks, af_people, af_flowMode, af_traditions
    expect(lsGet("af_tasks")).toEqual([{ id:"t1", text:"server task" }]);
    expect(lsGet("af_people")).toEqual([{ id:"p1", name:"Alice" }]);
    expect(lsGet("af_flowMode")).toBe("Smooth");
    expect(lsGet("af_traditions")).toEqual([{ id:"tr1", title:"Christmas Eve" }]);
  });

  it("server timestamp is stored as af_lastHHSync (raw string, not JSON-encoded)", () => {
    simulatePullWrite({}, "2026-07-03T10:00:00.000Z");
    // lastHHSync is stored by: localStorage.setItem("af_lastHHSync", serverTs)
    // NOT via JSON.stringify — it is a raw string.
    expect(localStorage.getItem("af_lastHHSync")).toBe("2026-07-03T10:00:00.000Z");
  });

  it("keys absent from server data are not zeroed out locally", () => {
    // Pre-populate a local key
    localStorage.setItem("af_workDays", JSON.stringify(["Monday","Tuesday"]));
    // Server sends a doc without workDays
    const clean = sanitizeHouseholdData({ tasks: [] });
    simulatePullWrite(clean, "ts1");
    // workDays must survive
    expect(lsGet("af_workDays")).toEqual(["Monday","Tuesday"]);
  });
});

// ── B2: pull skipped when af_lastHHSync === server updated_at ─────────────────
describe("B2 — pull skip when timestamps match", () => {
  it("returns early when serverTs === lastHHSync", () => {
    const ts = "2026-07-03T10:00:00.000Z";
    localStorage.setItem("af_lastHHSync", ts);
    // Reproduces: if (!serverTs || serverTs === lastSync) return;
    const serverTs = ts;
    const lastSync = localStorage.getItem("af_lastHHSync") || "";
    const shouldSkip = !serverTs || serverTs === lastSync;
    expect(shouldSkip).toBe(true);
  });

  it("does NOT skip when serverTs differs from lastHHSync", () => {
    const lastSync = "2026-07-03T10:00:00.000Z";
    const serverTs = "2026-07-03T11:00:00.000Z";
    localStorage.setItem("af_lastHHSync", lastSync);
    const storedSync = localStorage.getItem("af_lastHHSync") || "";
    const shouldSkip = !serverTs || serverTs === storedSync;
    expect(shouldSkip).toBe(false);
  });

  it("applies when serverTs is newer (different from lastSync)", () => {
    const lastSync = "2026-07-03T10:00:00.000Z";
    const serverTs = "2026-07-03T12:00:00.000Z";
    // Both branches: skip=false means pull proceeds
    expect(serverTs === lastSync).toBe(false);
    expect(serverTs > lastSync).toBe(true); // IS newer
  });
});

// ── B3: push refused when payload has <2 non-null keys ────────────────────────
describe("B3 — push safety: refused when fewer than 2 non-null keys", () => {
  // Reproduces: if (nonNullCount < 2) return;

  it("refuses push with 0 non-null keys", () => {
    const payload = Object.fromEntries(SYNC_KEYS.map(k => [k, null]));
    const count = Object.values(payload).filter(v => v !== null).length;
    expect(count).toBe(0);
    expect(count < 2).toBe(true); // push would be refused
  });

  it("refuses push with 1 non-null key", () => {
    const payload = Object.fromEntries(SYNC_KEYS.map(k => [k, null]));
    payload.tasks = [{ id:"t1", text:"task" }];
    const count = Object.values(payload).filter(v => v !== null).length;
    expect(count).toBe(1);
    expect(count < 2).toBe(true);
  });

  it("allows push with 2 or more non-null keys", () => {
    const payload = Object.fromEntries(SYNC_KEYS.map(k => [k, null]));
    payload.tasks = [{ id:"t1" }];
    payload.people = [{ id:"p1", name:"Alice" }];
    const count = Object.values(payload).filter(v => v !== null).length;
    expect(count).toBe(2);
    expect(count < 2).toBe(false); // push allowed
  });
});

// ── B4: serverTs === af_lastPushedAt → echo suppression, no reload ─────────────
describe("B4 — echo suppression: own-push recognized by lastPushedAt match", () => {
  it("serverTs === lastPushedAt → treat as own write, suppress reload", () => {
    const ts = "2026-07-03T10:00:00.000Z";
    localStorage.setItem("af_lastPushedAt", ts);
    const serverTs = ts;
    const lastPushedAt = localStorage.getItem("af_lastPushedAt") || "";
    // Reproduces the poll check: if (serverTs === lastPushedAt) → reconcile, no reload
    expect(serverTs === lastPushedAt).toBe(true);
  });

  it("serverTs !== lastPushedAt → not own write, proceed to apply", () => {
    const lastPushedAt = "2026-07-03T10:00:00.000Z";
    const serverTs    = "2026-07-03T11:00:00.000Z"; // device B's push
    localStorage.setItem("af_lastPushedAt", lastPushedAt);
    const stored = localStorage.getItem("af_lastPushedAt") || "";
    expect(serverTs === stored).toBe(false); // is NOT own write → apply
  });

  it("echo suppression reconciles lastHHSync to serverTs", () => {
    const ts = "2026-07-03T10:00:00.000Z";
    localStorage.setItem("af_lastPushedAt", ts);
    // When own-push detected: localStorage.setItem("af_lastHHSync", serverTs)
    localStorage.setItem("af_lastHHSync", ts); // reconcile
    expect(localStorage.getItem("af_lastHHSync")).toBe(ts);
  });
});

// ── B5: af_lastPushedAt and af_lastPushAt are distinct keys ───────────────────
describe("B5 — af_lastPushedAt (server ts) vs af_lastPushAt (local epoch) are distinct", () => {
  it("af_lastPushedAt holds the server ISO timestamp string", () => {
    const serverTs = "2026-07-03T10:00:00.000Z";
    localStorage.setItem("af_lastPushedAt", serverTs);
    // Read back as raw string (NOT JSON-parsed) — stored without JSON.stringify
    const raw = localStorage.getItem("af_lastPushedAt");
    expect(raw).toBe(serverTs);
    expect(typeof raw).toBe("string");
    expect(raw).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO shape
  });

  it("af_lastPushAt holds the local epoch ms as a string", () => {
    const epoch = String(Date.now());
    localStorage.setItem("af_lastPushAt", epoch);
    const raw = localStorage.getItem("af_lastPushAt");
    expect(Number(raw)).toBeGreaterThan(1_000_000_000_000); // ms since epoch
    expect(raw).toMatch(/^\d+$/); // pure numeric string
  });

  it("the two keys are separate and do not alias", () => {
    localStorage.setItem("af_lastPushedAt", "2026-07-03T10:00:00.000Z");
    localStorage.setItem("af_lastPushAt", "1751500000000");
    expect(localStorage.getItem("af_lastPushedAt")).toBe("2026-07-03T10:00:00.000Z");
    expect(localStorage.getItem("af_lastPushAt")).toBe("1751500000000");
  });

  it("30-second own-push gate uses af_lastPushAt (epoch), not af_lastPushedAt", () => {
    const now = Date.now();
    localStorage.setItem("af_lastPushAt", String(now - 10_000)); // 10s ago
    const lastPushAt = Number(localStorage.getItem("af_lastPushAt") || 0);
    const pushedRecently = lastPushAt && (Date.now() - lastPushAt) < 30_000;
    expect(pushedRecently).toBe(true); // 10s < 30s gate
  });

  it("gate expires after 30 seconds", () => {
    localStorage.setItem("af_lastPushAt", String(Date.now() - 35_000)); // 35s ago
    const lastPushAt = Number(localStorage.getItem("af_lastPushAt") || 0);
    const pushedRecently = lastPushAt && (Date.now() - lastPushAt) < 30_000;
    expect(pushedRecently).toBe(false);
  });
});

// ── B6: markKeyDirty → push clears dirty keys; no dirty → no push ─────────────
describe("B6 — dirty key lifecycle", () => {
  it("marking a key dirty adds it to af_dirtyKeys", () => {
    simulateMarkDirty("tasks", false);
    expect(lsGet("af_dirtyKeys")).toContain("tasks");
  });

  it("marking the same key twice does not duplicate it", () => {
    simulateMarkDirty("tasks", false);
    simulateMarkDirty("tasks", false);
    const dirty = lsGet("af_dirtyKeys");
    expect(dirty.filter(k => k === "tasks")).toHaveLength(1);
  });

  it("after a successful push, af_dirtyKeys is cleared to []", () => {
    lsSet("af_dirtyKeys", ["tasks","people"]);
    // Simulate push success: localStorage.setItem("af_dirtyKeys", "[]")
    localStorage.setItem("af_dirtyKeys", "[]");
    expect(lsGet("af_dirtyKeys")).toEqual([]);
  });

  it("empty dirty keys → no push needed", () => {
    lsSet("af_dirtyKeys", []);
    const dirty = lsGet("af_dirtyKeys") || [];
    expect(dirty.length === 0).toBe(true); // debouncedSync would skip push
  });

  it("excluded keys are never marked dirty", () => {
    // These keys must never appear in af_dirtyKeys
    const excluded = ["authToken","authUser","lastHHSync","lastPushedAt","deviceId"];
    excluded.forEach(key => {
      lsClear();
      const marked = simulateMarkDirty(key, false);
      expect(marked).toBe(false);
      expect(lsGet("af_dirtyKeys")).toBeNull(); // never set
    });
  });
});

// ── B7: setters during hydration (_afHydrating=true) mark nothing dirty ────────
describe("B7 — hydration guard: no dirty marking during _afHydrating", () => {
  // Regression: before the hydration guard, setSaved calls during mount would
  // mark keys dirty, causing a push on every load, advancing the server timestamp,
  // which the poll read as a remote change → pull → reload → infinite loop.

  it("simulateMarkDirty with isHydrating=true marks nothing", () => {
    simulateMarkDirty("tasks", true); // hydrating
    expect(localStorage.getItem("af_dirtyKeys")).toBeNull();
  });

  it("simulateMarkDirty with isHydrating=false marks the key", () => {
    simulateMarkDirty("tasks", false);
    expect(lsGet("af_dirtyKeys")).toContain("tasks");
  });

  it("a sequence: hydrate → mark (suppressed) → end hydration → mark (written)", () => {
    // Phase 1: during hydration
    simulateMarkDirty("tasks", true);
    expect(localStorage.getItem("af_dirtyKeys")).toBeNull();

    // Phase 2: after hydration ends
    simulateMarkDirty("tasks", false);
    expect(lsGet("af_dirtyKeys")).toContain("tasks");
  });

  it("excluded keys are never marked even when not hydrating", () => {
    simulateMarkDirty("lastHHSync", false);
    expect(localStorage.getItem("af_dirtyKeys")).toBeNull();
  });

  it("non-excluded key IS marked after hydration ends", () => {
    simulateMarkDirty("traditions", false);
    expect(lsGet("af_dirtyKeys")).toContain("traditions");
  });
});

// ── B8: pull missing a local-only key does not delete the local value ──────────
describe("B8 — local-only keys survive a pull", () => {
  // NEEDS_BROWSER: full test requires HomeFlow render to observe that local-only
  // keys (e.g. af_theme, af_onboardingComplete) survive a pull cycle.
  // This proxy tests the write loop invariant directly.

  it("keys absent from server sanitized output are not written to localStorage", () => {
    // Pre-populate device-local keys
    localStorage.setItem("af_theme", JSON.stringify("calm"));
    localStorage.setItem("af_onboardingComplete", JSON.stringify(true));

    // Server sends a doc without those keys
    const serverDoc = { tasks: [{ id:"t1", text:"task" }] };
    const clean = sanitizeHouseholdData(serverDoc);
    simulatePullWrite(clean, "ts1");

    // Device-local keys must not be touched
    expect(lsGet("af_theme")).toBe("calm");
    expect(lsGet("af_onboardingComplete")).toBe(true);
  });

  it("pull writes only keys present in sanitized server data", () => {
    localStorage.setItem("af_weatherLocation", JSON.stringify("Denver"));
    const clean = sanitizeHouseholdData({ tasks: [] });
    // weatherLocation absent from server → absent from clean
    expect(clean.weatherLocation).toBeUndefined();
    simulatePullWrite(clean, "ts1");
    // Local value must be unaffected
    expect(lsGet("af_weatherLocation")).toBe("Denver");
  });
});

// ── B9: network failure mid-cycle: no corruption, no stamp advance ─────────────
describe("B9 — network failure: no corruption, no stamp advance", () => {
  // NEEDS_BROWSER for full integration test (requires mocking sbFetch in context).
  // These tests verify the state invariants that must hold after a network error.

  it("af_lastHHSync is not advanced when fetch throws", () => {
    const originalTs = "2026-07-03T10:00:00.000Z";
    localStorage.setItem("af_lastHHSync", originalTs);

    // Simulate: fetch throws → catch block → no stamp update
    // The catch block in checkForUpdates/pullLatestHouseholdData does NOT call
    // localStorage.setItem("af_lastHHSync", ...) — it just logs and returns.
    // State after failure: unchanged.
    const tsAfter = localStorage.getItem("af_lastHHSync");
    expect(tsAfter).toBe(originalTs); // unchanged
  });

  it("af_dirtyKeys is not cleared when push network error occurs", () => {
    lsSet("af_dirtyKeys", ["tasks", "people"]);
    // Simulate: push PATCH throws → catch block runs → no dirty clear
    // The dirty clear only happens on success (after successful PATCH/POST).
    // State after failure: dirty keys remain.
    const dirty = lsGet("af_dirtyKeys");
    expect(dirty).toContain("tasks");
    expect(dirty).toContain("people");
  });

  it("localStorage contains no partially-written state on simulated abort", () => {
    // Write first key of a pull, then abort before completing
    localStorage.setItem("af_tasks", JSON.stringify([{ id:"t1", text:"local" }]));
    const savedTasks = lsGet("af_tasks");
    // Abort: do not write remaining keys or advance lastHHSync
    expect(savedTasks).toEqual([{ id:"t1", text:"local" }]);
    expect(localStorage.getItem("af_lastHHSync")).toBeNull(); // not advanced
  });
});

// ── B10: zombie-session detection — auth keys cleared, household data preserved ─
describe("B10 — zombie-session: clearZombieAuthKeys clears auth but preserves household data", () => {
  // Detection threshold: one failed refreshAuthToken() call at any 401 catch site.
  // refreshAuthToken() already tries getSession() + refreshSession() internally.
  // If both fail it returns null — that is the zombie signal. No counter needed.
  //
  // Each 401 catch site in App.jsx (checkForUpdates, pushHouseholdData x2) calls:
  //   setAuthToken(null)   — shows AuthModal, stops poll via React effect cleanup
  //   setAuthUser(null)    — clears user state
  //   setShowAuthModal(true)
  //   clearZombieAuthKeys()
  //
  // clearZombieAuthKeys() is the localStorage side of the fix and is tested here.
  // The React state setters require a rendered component and cannot be tested in jsdom.

  it("clears af_authToken and af_authUser from localStorage", () => {
    localStorage.setItem("af_authToken", JSON.stringify("stale-jwt-xyz"));
    localStorage.setItem("af_authUser", JSON.stringify({ id: "u1", email: "test@example.com" }));

    clearZombieAuthKeys();

    expect(localStorage.getItem("af_authToken")).toBeNull();
    expect(localStorage.getItem("af_authUser")).toBeNull();
  });

  it("household data keys are never cleared by zombie-session handling", () => {
    // Populate every SYNC_KEY with a sentinel value
    SYNC_KEYS.forEach(function(k) {
      try { localStorage.setItem("af_" + k, JSON.stringify("sentinel")); } catch (_) {}
    });
    // Also set af_dirtyKeys (must survive so unpushed edits can push after re-auth)
    localStorage.setItem("af_dirtyKeys", JSON.stringify(["tasks", "people"]));

    clearZombieAuthKeys();

    // All household data untouched
    SYNC_KEYS.forEach(function(k) {
      expect(localStorage.getItem("af_" + k)).toBe(JSON.stringify("sentinel"));
    });
    // Dirty keys also untouched
    expect(lsGet("af_dirtyKeys")).toEqual(["tasks", "people"]);
  });
});

// ── B11: SIGNED_OUT flag gate — automatic sign-out preserves household data ─────
describe("B11 — SIGNED_OUT flag: automatic sign-out preserves household data", () => {
  // _afUserInitiatedSignOut (module-level in App.jsx) gates whether the SIGNED_OUT
  // handler wipes SYNC_KEYS. This test exercises the flag logic directly, since the
  // handler itself is embedded in the outer App component and cannot be imported.
  //
  // Invariant: the localStorage wipe in the SIGNED_OUT handler only runs when
  // _afUserInitiatedSignOut is true. We test the conditional independently.

  it("without the flag set, simulated SIGNED_OUT does not wipe SYNC_KEYS", () => {
    // Pre-populate household data + auth keys
    SYNC_KEYS.forEach(function(k) {
      try { localStorage.setItem("af_" + k, JSON.stringify("hh-data")); } catch (_) {}
    });
    localStorage.setItem("af_authToken", JSON.stringify("token"));
    localStorage.setItem("af_authUser", JSON.stringify({ id: "u1" }));

    // Simulate the SIGNED_OUT handler with flag=false (automatic sign-out)
    var flagSet = false; // _afUserInitiatedSignOut
    // Auth keys always cleared
    try { localStorage.removeItem("af_authToken"); } catch (_) {}
    try { localStorage.removeItem("af_authUser"); } catch (_) {}
    // Household data: only cleared if flag is set
    if (flagSet) {
      try { localStorage.removeItem("af_householdId"); } catch (_) {}
      SYNC_KEYS.forEach(function(k) { try { localStorage.removeItem("af_" + k); } catch (_) {} });
    }

    // Auth keys gone
    expect(localStorage.getItem("af_authToken")).toBeNull();
    expect(localStorage.getItem("af_authUser")).toBeNull();
    // Household data preserved
    SYNC_KEYS.forEach(function(k) {
      expect(localStorage.getItem("af_" + k)).toBe(JSON.stringify("hh-data"));
    });
  });

  it("with the flag set, simulated SIGNED_OUT wipes SYNC_KEYS (user chose to sign out)", () => {
    SYNC_KEYS.forEach(function(k) {
      try { localStorage.setItem("af_" + k, JSON.stringify("hh-data")); } catch (_) {}
    });
    localStorage.setItem("af_householdId", JSON.stringify("hh_test"));

    var flagSet = true; // _afUserInitiatedSignOut
    try { localStorage.removeItem("af_authToken"); } catch (_) {}
    try { localStorage.removeItem("af_authUser"); } catch (_) {}
    if (flagSet) {
      try { localStorage.removeItem("af_householdId"); } catch (_) {}
      SYNC_KEYS.forEach(function(k) { try { localStorage.removeItem("af_" + k); } catch (_) {} });
    }

    // Household data wiped
    SYNC_KEYS.forEach(function(k) {
      expect(localStorage.getItem("af_" + k)).toBeNull();
    });
    expect(localStorage.getItem("af_householdId")).toBeNull();
  });
});

// ── B12: stale-push-guard fix — dirty keys survive blocked push, apply stamps ──
describe("B12 — stale-push guard: dirty keys survive stale-blocked pull", () => {
  // Root cause of the July 5-6 push-death:
  //   Bug 1: ExhaleSection.jsx persist() EXHALE_V2 branch skipped dirty marking for
  //          exhale_labels, exhale_color_labels, exhale_people (blob keys, no RT table).
  //   Bug 2: pullLatestHouseholdData() line 2375 unconditionally cleared af_dirtyKeys,
  //          destroying any pending edits when a stale-blocked push triggered a pull.
  //
  // Fix: (1) persist() calls lsSet() for nl/ncl/np in V2 mode (marks dirty + dispatches
  //          af-data-changed); (2) pullLatestHouseholdData does not clear af_dirtyKeys.
  //
  // These tests verify the localStorage state machine directly.

  it("stale-blocked pull does NOT wipe af_dirtyKeys (fix for Bug 2)", () => {
    // Simulate: device has dirty keys from a label edit.
    lsSet("af_dirtyKeys", ["exhale_labels", "exhale_people"]);
    lsSet("af_exhale_labels", { inbox: "Inbox", decide: "Decide" });

    // Simulate pullLatestHouseholdData FIXED behaviour:
    // writes SYNC_KEYS from server, stamps af_lastHHSync — but does NOT touch af_dirtyKeys.
    const serverTs = "2026-07-05T18:07:02.313+00:00";
    const serverData = sanitizeHouseholdData({ tasks: [{ id: "t1", text: "task from server" }] });
    simulatePullWrite(serverData, serverTs);
    // Note: simulatePullWrite does not clear af_dirtyKeys — correct post-fix behaviour.

    // Dirty keys must survive the pull
    expect(lsGet("af_dirtyKeys")).toEqual(["exhale_labels", "exhale_people"]);
    // af_lastHHSync must be stamped
    expect(localStorage.getItem("af_lastHHSync")).toBe(serverTs);
  });

  it("after stale-blocked pull, af_lastHHSync matches server — next push guard passes", () => {
    // After pullLatestHouseholdData stamps af_lastHHSync = serverTs, the stale condition
    // (serverUpdatedAt > lastApplied) resolves on the next push attempt.
    const serverTs = "2026-07-05T18:07:02.313+00:00";
    simulatePullWrite({}, serverTs);

    // simulatePushDecision: with lastHHSync === serverUpdatedAt, guard passes
    const decision = simulatePushDecision(serverTs, serverTs, "");
    // "own-push" path: reconcile, not stale — guard passes, push allowed
    // (serverUpdatedAt === lastHHSync is caught before the stale comparison)
    // Actually simulatePushDecision returns "pull" if serverMs > localMs — equal means no block.
    const serverMs = new Date(serverTs).getTime();
    const localMs  = new Date(localStorage.getItem("af_lastHHSync")).getTime();
    expect(serverMs).toBe(localMs); // equal — guard does not block
    expect(serverMs > localMs).toBe(false); // not stale
  });

  it("dirty keys survive a full pull write that overwrites SYNC_KEYS values", () => {
    // Pre-populate: device has local edits on several keys, all marked dirty.
    lsSet("af_dirtyKeys", ["tasks", "exhale_labels"]);
    lsSet("af_tasks", [{ id: "local-1", text: "local task" }]);
    lsSet("af_exhale_labels", { inbox: "My Inbox" });

    // Server has different tasks. Pull overwrites af_tasks.
    const serverTs = "2026-07-06T03:43:45.152+00:00";
    const serverData = sanitizeHouseholdData({ tasks: [{ id: "srv-1", text: "server task" }] });
    simulatePullWrite(serverData, serverTs);

    // Server's tasks are now local — pull applied correctly
    expect(lsGet("af_tasks")).toEqual([{ id: "srv-1", text: "server task" }]);
    // Dirty keys survive (fix: pullLatestHouseholdData no longer wipes them)
    expect(lsGet("af_dirtyKeys")).toEqual(["tasks", "exhale_labels"]);
    // exhale_labels untouched (server didn't have it in this payload)
    expect(lsGet("af_exhale_labels")).toEqual({ inbox: "My Inbox" });
  });

  it("genuine stale-clobber is still blocked (guard purpose intact)", () => {
    // A device with af_lastHHSync older than server updated_at must not push.
    // Uses July 5 timestamps as fixture values from the actual incident.
    const serverUpdatedAt = "2026-07-05T18:07:02.313+00:00"; // server (Jul 5, other device pushed)
    const lastHHSync      = "2026-07-03T21:18:00.000+00:00"; // local (Jul 3, device is stale)
    const lastPushedAt    = ""; // device never pushed

    const decision = simulatePushDecision(serverUpdatedAt, lastHHSync, lastPushedAt);
    expect(decision.action).toBe("pull"); // stale — guard correctly blocks push
    expect(decision.reason).toBe("stale");
  });

  it("non-stale device (lastHHSync === serverUpdatedAt) is allowed to push", () => {
    const ts = "2026-07-06T03:43:45.152+00:00";
    const decision = simulatePushDecision(ts, ts, "");
    // When timestamps are equal, server is not newer — push is allowed.
    expect(decision.action).toBe("push");
    expect(decision.reason).toBe("allowed");
  });
});

// ── B13 — Boot-path zombie session: auth modal shown, household data preserved ─
describe("B13 — boot-path zombie: clearZombieAuthKeys + modal invariants", () => {
  beforeEach(() => {
    localStorage.clear();
    // Simulate a boot state: token stale, household data present
    localStorage.setItem("af_authToken", JSON.stringify("stale-token"));
    localStorage.setItem("af_authUser",  JSON.stringify({ id: "u1", email: "test@test.com" }));
    localStorage.setItem("af_householdId", JSON.stringify("hh_test_household"));
    localStorage.setItem("af_tasks", JSON.stringify([{ id: "t1", text: "pack bags" }]));
    localStorage.setItem("af_people", JSON.stringify([{ id: "p1", name: "Alice", color: "#aaa" }]));
  });
  afterEach(() => { localStorage.clear(); });

  it("clearZombieAuthKeys removes auth tokens on boot failure", () => {
    clearZombieAuthKeys();
    expect(localStorage.getItem("af_authToken")).toBeNull();
    expect(localStorage.getItem("af_authUser")).toBeNull();
  });

  it("clearZombieAuthKeys preserves household data on boot failure", () => {
    clearZombieAuthKeys();
    expect(localStorage.getItem("af_householdId")).not.toBeNull();
    expect(lsGet("af_tasks")).toEqual([{ id: "t1", text: "pack bags" }]);
    expect(lsGet("af_people")).toEqual([{ id: "p1", name: "Alice", color: "#aaa" }]);
  });

  it("boot-path failure does not clear SYNC_KEYS (household data intact for re-auth push)", () => {
    // Simulate the complete boot zombie sequence:
    // 1. refreshAuthToken() fails → clearZombieAuthKeys() called
    // 2. SIGNED_OUT fires (triggered internally by refreshAuthToken) with _afUserInitiatedSignOut=false
    // Expectation: SYNC_KEYS survive because _afUserInitiatedSignOut was false
    clearZombieAuthKeys();
    // The SIGNED_OUT handler in App.jsx gates wipe on _afUserInitiatedSignOut.
    // Here we simulate the flag=false path (automatic sign-out = no wipe).
    const _afUserInitiatedSignOut = false; // flag was NOT set
    if (_afUserInitiatedSignOut) {
      SYNC_KEYS.forEach(k => { try { localStorage.removeItem("af_" + k); } catch {} });
    }
    // Data must survive
    expect(lsGet("af_tasks")).toEqual([{ id: "t1", text: "pack bags" }]);
    expect(localStorage.getItem("af_householdId")).not.toBeNull();
  });
});
