// tests/unit/tidepool-ledger.test.js
// af_tidepool_v2 — Tide Pool shell ledger. Exercises the real module
// (src/tidepool/ledger.js), not mirrors: planners in both flag states, the
// balance store against an in-memory fake of the tide_pool_events table +
// tide_pool_balances view, and the hook module's flag gating.
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  readTidePoolV2Flag, planTabChoreToggle, planSectionChoreToggle, planBonus,
  planClaim, planQuickShell, createLedgerStore, PENDING_KEY,
} from "../../src/tidepool/ledger.js";

var NOW = "2026-11-12T12:00:00.000Z";
function opts(v2, balance) {
  var n = 0, e = 0;
  return { v2: v2, balance: balance === undefined ? null : balance, makeId: function () { return "id" + (++n); }, makeEventId: function () { return "ev" + (++e); }, now: function () { return NOW; } };
}
function kid(over) {
  return Object.assign({
    kidId: "kidA", kidName: "Ava", shells: 7,
    chores: [{ id: "c1", name: "Make bed", pts: 2, done: false }, { id: "c2", name: "Dishes", pts: 3, done: true }],
    treasures: [{ id: "t1", name: "Pick dinner", icon: "🍕", cost: 5 }],
    shellLog: [{ id: "old", reason: "Dishes", pts: 3, date: NOW, choreId: "c2" }],
    bonusHistory: [], rewardHistory: [],
  }, over || {});
}

// ── Flag ──────────────────────────────────────────────────────────────────
describe("af_tidepool_v2 flag", function () {
  function st(v) { return { getItem: function () { return v; } }; }
  it("is OFF by default (unset)", function () { expect(readTidePoolV2Flag(st(null))).toBe(false); });
  it("is ON only for the exact string \"true\"", function () {
    expect(readTidePoolV2Flag(st("true"))).toBe(true);
    expect(readTidePoolV2Flag(st("1"))).toBe(false);
    expect(readTidePoolV2Flag(st("false"))).toBe(false);
  });
  it("is OFF when storage is missing or throws", function () {
    expect(readTidePoolV2Flag(null)).toBe(false);
    expect(readTidePoolV2Flag({ getItem: function () { throw new Error("blocked"); } })).toBe(false);
  });
});

// ── Flag OFF: identical coveData behavior ────────────────────────────────────
describe("flag OFF — planners write coveData shells exactly as before", function () {
  it("tab chore check: +pts, shellLog entry prepended, no event", function () {
    var p = planTabChoreToggle(kid(), "c1", opts(false));
    expect(p.event).toBe(null);
    expect(p.patch.shells).toBe(9);
    expect(p.patch.chores[0].done).toBe(true);
    expect(p.patch.shellLog[0]).toEqual({ id: "id1", reason: "Make bed", pts: 2, date: NOW, choreId: "c1" });
    expect(p.patch.shellLog.length).toBe(2);
  });
  it("tab chore uncheck: -pts floored at 0, removes that chore's log entry", function () {
    var p = planTabChoreToggle(kid({ shells: 1 }), "c2", opts(false));
    expect(p.patch.shells).toBe(0);
    expect(p.patch.chores[1].done).toBe(false);
    expect(p.patch.shellLog).toEqual([]);
  });
  it("tab chore: unknown chore -> null", function () {
    expect(planTabChoreToggle(kid(), "nope", opts(false))).toBe(null);
  });
  it("settings chore toggle: pts||1, never touches shellLog", function () {
    var k = kid({ chores: [{ id: "x", name: "No pts", done: false }] });
    var p = planSectionChoreToggle(k, "x", opts(false));
    expect(p.patch).toEqual({ chores: [{ id: "x", name: "No pts", done: true }], shells: 8 });
    expect(p.event).toBe(null);
    var u = planSectionChoreToggle(kid({ shells: 2 }), "c2", opts(false));
    expect(u.patch.shells).toBe(0);
  });
  it("bonus: shells + pts, bonusHistory and shellLog entries", function () {
    var p = planBonus(kid(), "Helped sister", 4, opts(false));
    expect(p.patch.shells).toBe(11);
    expect(p.patch.bonusHistory[0]).toEqual({ id: "id1", reason: "Helped sister", pts: 4, date: NOW });
    expect(p.patch.shellLog[0].id).toBe("id1");
    expect(p.event).toBe(null);
  });
  it("claim: deducts cost from coveData shells; blocked when unaffordable", function () {
    var t = kid().treasures[0];
    var p = planClaim(kid(), t, opts(false));
    expect(p.patch.shells).toBe(2);
    expect(p.patch.rewardHistory[0]).toEqual({ id: "id1", name: "Pick dinner", icon: "🍕", cost: 5, date: NOW });
    expect(p.event).toBe(null);
    expect(planClaim(kid({ shells: 4 }), t, opts(false))).toBe(null);
    expect(planClaim(kid(), null, opts(false))).toBe(null);
  });
  it("claim ignores any ledger balance passed in", function () {
    expect(planClaim(kid({ shells: 4 }), kid().treasures[0], opts(false, 100))).toBe(null);
  });
  it("FlowHome +1: existing kid shells+1; new kid created with shells:1", function () {
    var list = [kid()];
    var p = planQuickShell(list, "kidA", "Ava", opts(false));
    expect(p.next[0].shells).toBe(8);
    expect(p.next).not.toBe(list);
    expect(p.event).toBe(null);
    var n = planQuickShell(list, "kidB", "Ben", opts(false));
    expect(n.next.length).toBe(2);
    expect(n.next[1].shells).toBe(1);
    expect(n.next[1].chores.length).toBe(2);
    expect(n.next[1].treasures.length).toBe(5);
  });
});

// ── Flag ON: shell count moves to ledger events ─────────────────────────────
describe("flag ON — only the shell count moves to the ledger", function () {
  it("tab chore check: no shells in patch, chore event +pts", function () {
    var p = planTabChoreToggle(kid(), "c1", opts(true, 7));
    expect("shells" in p.patch).toBe(false);
    expect(p.patch.chores[0].done).toBe(true);
    expect(p.patch.shellLog[0].choreId).toBe("c1");
    expect(p.event).toEqual({ id: "ev1", kid_id: "kidA", kind: "chore", delta: 2, reason: "Make bed", ref_id: "c1" });
  });
  it("tab chore uncheck: chore_undo -pts, clamped to the ledger balance", function () {
    expect(planTabChoreToggle(kid(), "c2", opts(true, 10)).event.delta).toBe(-3);
    expect(planTabChoreToggle(kid(), "c2", opts(true, 1)).event).toMatchObject({ kind: "chore_undo", delta: -1 });
    var zero = planTabChoreToggle(kid(), "c2", opts(true, 0));
    expect(zero.event).toBe(null);
    expect(zero.patch.chores[1].done).toBe(false);
  });
  it("settings chore toggle: chores only, event emitted", function () {
    var p = planSectionChoreToggle(kid(), "c1", opts(true, 7));
    expect(p.patch).toEqual({ chores: expect.any(Array) });
    expect(p.event).toMatchObject({ kind: "chore", delta: 2, kid_id: "kidA" });
  });
  it("bonus: history kept in coveData, bonus event refs the history entry", function () {
    var p = planBonus(kid(), "Kindness", 3, opts(true, 7));
    expect("shells" in p.patch).toBe(false);
    expect(p.patch.bonusHistory[0].id).toBe("id1");
    expect(p.event).toEqual({ id: "ev1", kid_id: "kidA", kind: "bonus", delta: 3, reason: "Kindness", ref_id: "id1" });
  });
  it("claim: uses the LEDGER balance, not coveData shells", function () {
    var t = kid().treasures[0];
    expect(planClaim(kid({ shells: 0 }), t, opts(true, 5)).event).toEqual({ id: "ev1", kid_id: "kidA", kind: "redeem", delta: -5, reason: "Pick dinner", ref_id: "t1" });
    expect(planClaim(kid({ shells: 100 }), t, opts(true, 4))).toBe(null);
  });
  it("claim is blocked until the ledger balance has loaded", function () {
    expect(planClaim(kid({ shells: 100 }), kid().treasures[0], opts(true, null))).toBe(null);
  });
  it("each action gets a unique event id", function () {
    var o = opts(true, 50);
    var ids = [
      planBonus(kid(), "a", 1, o).event.id,
      planBonus(kid(), "b", 1, o).event.id,
      planClaim(kid(), kid().treasures[0], o).event.id,
    ];
    expect(new Set(ids).size).toBe(3);
  });
  it("FlowHome +1: existing kid -> no coveData write, +1 event", function () {
    var list = [kid()];
    var p = planQuickShell(list, "kidA", "Ava", opts(true));
    expect(p.next).toBe(list);
    expect(p.event).toMatchObject({ kind: "bonus", delta: 1, kid_id: "kidA" });
  });
  it("FlowHome +1: new kid record created with shells:0 (+1 is in the ledger)", function () {
    var p = planQuickShell([], "kidB", "Ben", opts(true));
    expect(p.next[0]).toMatchObject({ kidId: "kidB", kidName: "Ben", shells: 0 });
    expect(p.event.delta).toBe(1);
  });
});

// ── Balance store ───────────────────────────────────────────────────────────
function memStorage(init) {
  var m = Object.assign({}, init || {});
  return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, _m: m };
}
// In-memory server: tide_pool_events rows; tide_pool_balances = sum(delta).
function fakeServer() {
  var s = { events: [], rpcCalls: [], fetches: 0, rpcFail: false, fetchHook: null, handlers: [], subscribeCb: null, removed: 0 };
  s.insert = function (row) { if (!s.events.some(function (e) { return e.id === row.id; })) s.events.push(row); };
  s.client = {
    rpc: vi.fn(function (name, a) {
      s.rpcCalls.push({ name: name, args: a });
      if (s.rpcFail) return Promise.resolve({ data: null, error: { message: "network down" } });
      var had = s.events.some(function (e) { return e.id === a.p_id; });
      s.insert({ id: a.p_id, household_id: a.p_household_id, kid_id: a.p_kid_id, delta: a.p_delta });
      return Promise.resolve({ data: had ? [] : [{ id: a.p_id }], error: null });
    }),
    from: function (table) {
      return { select: function () { return { eq: function (col, hid) {
        s.fetches++;
        var snap = {};
        s.events.forEach(function (e) { if (e.household_id === hid) snap[e.kid_id] = (snap[e.kid_id] || 0) + e.delta; });
        var res = { data: Object.keys(snap).map(function (k) { return { kid_id: k, shells: snap[k] }; }), error: null, table: table };
        return s.fetchHook ? s.fetchHook(res) : Promise.resolve(res);
      } }; } };
    },
    channel: vi.fn(function () {
      var ch = { on: function (a, b, cb) { s.handlers.push(cb); return ch; }, subscribe: function (cb) { s.subscribeCb = cb; return ch; } };
      return ch;
    }),
    removeChannel: vi.fn(function () { s.removed++; }),
  };
  s.realtime = function (row) { s.insert(row); s.handlers.forEach(function (h) { h({ eventType: "INSERT", new: row }); }); };
  return s;
}
async function settle() { for (var i = 0; i < 10; i++) await new Promise(function (r) { setTimeout(r, 0); }); }

describe("ledger store", function () {
  var srv, storage, store;
  beforeEach(function () {
    srv = fakeServer();
    storage = memStorage();
    store = createLedgerStore({ client: srv.client, storage: storage, refreshDelay: 0 });
  });

  it("reads displayed balances from tide_pool_balances on start", async function () {
    srv.insert({ id: "backfill:h1:kidA", household_id: "h1", kid_id: "kidA", delta: 12 });
    srv.insert({ id: "other", household_id: "h2", kid_id: "kidA", delta: 99 });
    store.start("h1");
    expect(store.getState().loaded).toBe(false);
    await settle();
    expect(store.getState()).toMatchObject({ loaded: true, balances: { kidA: 12 } });
    expect(srv.client.channel).toHaveBeenCalledWith("tidepool-h1");
  });

  it("record: optimistic, calls tide_pool_add_event with the event id, no double count after confirm", async function () {
    srv.insert({ id: "b", household_id: "h1", kid_id: "kidA", delta: 5 });
    store.start("h1"); await settle();
    store.record("h1", { id: "ev1", kid_id: "kidA", kind: "bonus", delta: 3, reason: "Kind", ref_id: "r1" });
    expect(store.getState().balances.kidA).toBe(8); // optimistic, before RPC resolves
    await settle();
    expect(srv.rpcCalls[0]).toEqual({ name: "tide_pool_add_event", args: { p_id: "ev1", p_household_id: "h1", p_kid_id: "kidA", p_kind: "bonus", p_delta: 3, p_reason: "Kind", p_ref_id: "r1" } });
    expect(store.getState().balances.kidA).toBe(8); // server snapshot now includes it; pending dropped
    expect(store.getState().pendingCount).toBe(0);
    expect(storage.getItem(PENDING_KEY)).toBe(null);
  });

  it("realtime insert from another device triggers a re-fetch", async function () {
    store.start("h1"); await settle();
    srv.realtime({ id: "remote1", household_id: "h1", kid_id: "kidB", delta: 4 });
    await settle();
    expect(store.getState().balances.kidB).toBe(4);
  });

  it("own event echoed by realtime is not double-counted", async function () {
    store.start("h1"); await settle();
    store.record("h1", { id: "ev1", kid_id: "kidA", kind: "chore", delta: 2 });
    srv.handlers.forEach(function (h) { h({ eventType: "INSERT", new: { id: "ev1" } }); });
    await settle();
    expect(store.getState().balances.kidA).toBe(2);
  });

  it("snapshot that started BEFORE confirmation does not drop the pending event", async function () {
    store.start("h1"); await settle();
    // Freeze the next fetch: take it before the RPC commits, release later.
    var release;
    srv.fetchHook = function (res) { return new Promise(function (r) { release = function () { r(res); }; }); };
    store.refresh();
    srv.fetchHook = null;
    store.record("h1", { id: "ev1", kid_id: "kidA", kind: "bonus", delta: 5 });
    await settle();
    release(); await settle();
    expect(store.getState().balances.kidA).toBe(5);
  });

  it("RPC failure keeps the event pending + persisted; retried on next start (idempotent)", async function () {
    store.start("h1"); await settle();
    srv.rpcFail = true;
    store.record("h1", { id: "ev1", kid_id: "kidA", kind: "bonus", delta: 2 });
    await settle();
    expect(store.getState().balances.kidA).toBe(2);
    expect(store.getState().pendingCount).toBe(1);
    expect(JSON.parse(storage.getItem(PENDING_KEY))[0]).toMatchObject({ id: "ev1", household_id: "h1", delta: 2 });

    // Simulate reload: new store reads pending from storage and retries.
    srv.rpcFail = false;
    var store2 = createLedgerStore({ client: srv.client, storage: storage, refreshDelay: 0 });
    store2.start("h1"); await settle();
    expect(srv.events.filter(function (e) { return e.id === "ev1"; }).length).toBe(1);
    expect(store2.getState()).toMatchObject({ balances: { kidA: 2 }, pendingCount: 0 });
    expect(storage.getItem(PENDING_KEY)).toBe(null);
  });

  it("retry of an event that already committed does not double count", async function () {
    srv.insert({ id: "ev1", household_id: "h1", kid_id: "kidA", delta: 2 });
    storage.setItem(PENDING_KEY, JSON.stringify([{ id: "ev1", household_id: "h1", kid_id: "kidA", kind: "bonus", delta: 2 }]));
    var s2 = createLedgerStore({ client: srv.client, storage: storage, refreshDelay: 0 });
    s2.start("h1"); await settle();
    expect(s2.getState().balances.kidA).toBe(2);
    expect(srv.events.length).toBe(1);
  });

  it("ignores zero-delta / missing-household events", async function () {
    store.start("h1"); await settle();
    store.record("h1", null);
    store.record(null, { id: "x", kid_id: "kidA", delta: 1 });
    store.record("h1", { id: "y", kid_id: "kidA", delta: 0 });
    await settle();
    expect(srv.rpcCalls.length).toBe(0);
  });

  it("ref-counted: channel removed when the last consumer stops", async function () {
    var stopA = store.start("h1");
    var stopB = store.start("h1");
    expect(srv.client.channel).toHaveBeenCalledTimes(1);
    stopA();
    expect(srv.removed).toBe(0);
    stopB();
    expect(srv.removed).toBe(1);
  });
});

// ── Hook module wiring, both flag states ────────────────────────────────────
describe("useTidePool wiring", function () {
  var rpc;
  beforeEach(function () {
    vi.resetModules();
    rpc = vi.fn(function () { return Promise.resolve({ data: [], error: null }); });
    vi.doMock("../../src/lib/supabase", function () {
      var ch = { on: function () { return ch; }, subscribe: function () { return ch; } };
      return { supabase: {
        rpc: rpc,
        from: function () { return { select: function () { return { eq: function () { return Promise.resolve({ data: [], error: null }); } }; } }; },
        channel: function () { return ch; }, removeChannel: function () {},
      } };
    });
    localStorage.clear();
  });

  it("flag OFF: recordTidePoolEvent never calls the RPC", async function () {
    var mod = await import("../../src/tidepool/useTidePool.js");
    var ledger = await import("../../src/tidepool/ledger.js");
    expect(ledger.TIDEPOOL_V2).toBe(false);
    mod.recordTidePoolEvent("h1", { id: "ev1", kid_id: "kidA", kind: "bonus", delta: 1 });
    await settle();
    expect(rpc).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_KEY)).toBe(null);
  });

  it("flag ON: recordTidePoolEvent calls tide_pool_add_event", async function () {
    localStorage.setItem("af_tidepool_v2", "true");
    var mod = await import("../../src/tidepool/useTidePool.js");
    var ledger = await import("../../src/tidepool/ledger.js");
    expect(ledger.TIDEPOOL_V2).toBe(true);
    mod.recordTidePoolEvent("h1", { id: "ev1", kid_id: "kidA", kind: "bonus", delta: 1, reason: "r", ref_id: null });
    await settle();
    expect(rpc).toHaveBeenCalledWith("tide_pool_add_event", expect.objectContaining({ p_id: "ev1", p_household_id: "h1", p_delta: 1 }));
  });
});
