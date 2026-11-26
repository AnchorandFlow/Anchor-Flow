// @vitest-environment jsdom
// tests/unit/rhythm.test.js — Rhythm (Lighthouse focus-block timer).
// Pure logic from src/lib/rhythm.js + the sync registration in sync-core.js.
// No React, no App.jsx import.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SYNC_KEYS, sanitizeHouseholdData } from "../../src/sync-core.js";
import { createScreenWake } from "../../src/lib/rhythmWake.js";
import {
  rhythmEnabled, RHYTHM_FLAG_KEY, ROUTINES_KEY, saveRoutine, loadRoutines, routineFor, defaultBlocks,
  normalizeBlock, moveBlock, removeBlock, toggleBlockType, updateBlock,
  STICKER_SETS, freshStickerDay, stickerDayFor, earnSticker, saveStickerDay, loadStickerLedger,
  idleRun, startBlock, pauseRun, resumeRun, extendRun, completeCurrent, timeLeftMs, isWrapping, warnWindowMs,
  loadRun, saveRun, EXTEND_MS,
} from "../../src/lib/rhythm.js";

function memStorage() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
    _m: m,
  };
}
// Always the first remaining sticker — deterministic.
function first() { return 0; }

describe("flag af_rhythm_v1", function () {
  it("is OFF by default and only the string 'true' turns it on", function () {
    var s = memStorage();
    expect(RHYTHM_FLAG_KEY).toBe("af_rhythm_v1");
    expect(rhythmEnabled(s)).toBe(false);
    s.setItem("af_rhythm_v1", "1"); expect(rhythmEnabled(s)).toBe(false);
    s.setItem("af_rhythm_v1", "false"); expect(rhythmEnabled(s)).toBe(false);
    s.setItem("af_rhythm_v1", "true"); expect(rhythmEnabled(s)).toBe(true);
  });
});

describe("routines sync registration", function () {
  it("rhythm_routines is a SYNC_KEY (no af_ prefix); stickers and the run stay local", function () {
    expect(ROUTINES_KEY).toBe("rhythm_routines");
    expect(SYNC_KEYS).toContain("rhythm_routines");
    expect(SYNC_KEYS).not.toContain("af_rhythm_routines");
    expect(SYNC_KEYS).not.toContain("rhythm_stickers");
    expect(SYNC_KEYS).not.toContain("rhythm_run");
    // The existing Weekly Rhythm key is a different thing and stays as it was.
    expect(SYNC_KEYS).toContain("rhythm");
  });
  it("a pulled blob carries routines through sanitize; null is ignored", function () {
    var blob = { rhythm_routines: { kid1: { blocks: [{ id: "a", name: "Math", mins: 20, type: "work", note: "", breakActivity: "" }], updatedAt: 1 } } };
    expect(sanitizeHouseholdData(blob).rhythm_routines).toEqual(blob.rhythm_routines);
    expect(sanitizeHouseholdData({ rhythm_routines: null }).rhythm_routines).toBeUndefined();
  });
});

describe("saveRoutine — dirty-marking (the workDays / traditions bug class)", function () {
  var s;
  beforeEach(function () { s = memStorage(); });

  it("writes af_rhythm_routines, marks rhythm_routines dirty, dispatches af-data-changed", function () {
    var dispatched = [];
    saveRoutine("kid1", defaultBlocks(), { storage: s, dispatch: function (k) { dispatched.push(k); }, now: 42 });
    var stored = JSON.parse(s.getItem("af_rhythm_routines"));
    expect(stored.kid1.blocks.length).toBe(4);
    expect(stored.kid1.updatedAt).toBe(42);
    expect(JSON.parse(s.getItem("af_dirtyKeys"))).toEqual(["rhythm_routines"]);
    expect(dispatched).toEqual(["rhythm_routines"]);
  });

  it("never duplicates the dirty entry and keeps existing dirty keys", function () {
    s.setItem("af_dirtyKeys", JSON.stringify(["meals"]));
    var d = { storage: s, dispatch: function () {} };
    saveRoutine("kid1", defaultBlocks(), d);
    saveRoutine("kid1", defaultBlocks(), d);
    saveRoutine("kid2", defaultBlocks(), d);
    expect(JSON.parse(s.getItem("af_dirtyKeys"))).toEqual(["meals", "rhythm_routines"]);
  });

  it("dispatches a real af-data-changed window event by default (HomeFlow's push trigger)", function () {
    var seen = vi.fn();
    window.addEventListener("af-data-changed", seen);
    saveRoutine("kid1", defaultBlocks(), { storage: s });
    window.removeEventListener("af-data-changed", seen);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0][0].detail).toEqual({ key: "rhythm_routines" });
  });

  it("re-reads storage first, so another kid's routine (e.g. just pulled) is not overwritten", function () {
    var d = { storage: s, dispatch: function () {} };
    saveRoutine("kid1", defaultBlocks(), d);
    // Another device's routine for kid2 lands via a pull:
    var all = JSON.parse(s.getItem("af_rhythm_routines"));
    all.kid2 = { blocks: [normalizeBlock({ id: "x", name: "Piano", mins: 15 })], updatedAt: 5 };
    s.setItem("af_rhythm_routines", JSON.stringify(all));
    saveRoutine("kid1", defaultBlocks().slice(0, 2), d);
    var after = loadRoutines(s);
    expect(after.kid2.blocks[0].name).toBe("Piano");
    expect(after.kid1.blocks.length).toBe(2);
  });

  it("routines are per kid; a kid without one gets the starter routine", function () {
    saveRoutine("kid1", [normalizeBlock({ name: "Art", mins: 30 })], { storage: s, dispatch: function () {} });
    var all = loadRoutines(s);
    expect(routineFor(all, "kid1").map(function (b) { return b.name; })).toEqual(["Art"]);
    expect(routineFor(all, "kid2").map(function (b) { return b.name; })).toEqual(["Spelling", "Reading", "Break", "Math"]);
  });
});

describe("block edits", function () {
  it("normalizes minutes, type and text", function () {
    var b = normalizeBlock({ name: "x", mins: 999, type: "nap" });
    expect(b.mins).toBe(120); expect(b.type).toBe("work");
    expect(normalizeBlock({ mins: 0 }).mins).toBe(1);
  });
  it("reorders, toggles work⇄break, edits, and never removes the last block", function () {
    var bl = defaultBlocks();
    var moved = moveBlock(bl, 0, 1);
    expect(moved[0].name).toBe("Reading");
    expect(moveBlock(bl, 0, -1)).toBe(bl);
    expect(toggleBlockType(bl, bl[0].id)[0].type).toBe("break");
    expect(updateBlock(bl, bl[1].id, { mins: 35 })[1].mins).toBe(35);
    var one = [bl[0]];
    expect(removeBlock(one, bl[0].id)).toBe(one);
  });
});

describe("stickers — earn → set rollover → daily reset (set progress carries over)", function () {
  var day = "2026-11-25";

  it("earns a surprise sticker from the current set, never a repeat within the set", function () {
    var d = freshStickerDay(day), seen = [];
    for (var i = 0; i < 5; i++) { var r = earnSticker(d, Math.random); d = r.day; seen.push(r.sticker); expect(r.completedSet).toBeNull(); }
    expect(new Set(seen).size).toBe(5);
    seen.forEach(function (s) { expect(STICKER_SETS[0].items).toContain(s); });
    expect(d.today.length).toBe(5);
  });

  it("completing a set celebrates it and rolls to the next set (Night Sky → Garden → Jungle → Night Sky)", function () {
    var d = freshStickerDay(day), done = [];
    for (var i = 0; i < 18; i++) { var r = earnSticker(d, first); d = r.day; if (r.completedSet) done.push(r.completedSet.name); }
    expect(done).toEqual(["Night Sky", "Garden", "Jungle"]);
    expect(d.completedSets).toEqual(["Night Sky", "Garden", "Jungle"]);
    expect(d.setIdx).toBe(0);
    expect(d.earned).toEqual([]);
    expect(d.today.length).toBe(18);
    // the 6th sticker of the first set completes it and the next set starts empty
    var d2 = freshStickerDay(day);
    for (var k = 0; k < 6; k++) d2 = earnSticker(d2, first).day;
    expect(d2.setIdx).toBe(1); expect(d2.earned).toEqual([]); expect(d2.completedSets).toEqual(["Night Sky"]);
    var g = earnSticker(d2, first);
    expect(STICKER_SETS[1].items).toContain(g.sticker);
  });

  it("next day: tally and today's finished sets reset; the active set and its progress carry over", function () {
    var s = memStorage();
    var d = freshStickerDay("2026-11-24");
    for (var i = 0; i < 8; i++) d = earnSticker(d, first).day; // Night Sky done + 2 Garden
    saveStickerDay("kid1", d, s);
    var ledger = loadStickerLedger(s);
    var same = stickerDayFor(ledger, "kid1", "2026-11-24");
    expect(same.today.length).toBe(8);
    expect(same.completedSets).toEqual(["Night Sky"]);
    var next = stickerDayFor(ledger, "kid1", "2026-11-25");
    expect(next.date).toBe("2026-11-25");
    expect(next.today).toEqual([]);
    expect(next.completedSets).toEqual([]);
    expect(next.setIdx).toBe(1);
    expect(next.earned).toEqual(STICKER_SETS[1].items.slice(0, 2));
    // keeps filling the same set, no repeats, and completes it on the 4th more
    var r = next, got = [];
    for (var k = 0; k < 4; k++) { var e = earnSticker(r, first); r = e.day; got.push(e.completedSet && e.completedSet.name); }
    expect(got).toEqual([null, null, null, "Garden"]);
    expect(r.setIdx).toBe(2);
    expect(r.today.length).toBe(4);
  });

  it("is per kid; saving one kid keeps the others' progress from earlier days", function () {
    var s = memStorage();
    var a = freshStickerDay("2026-11-24");
    for (var i = 0; i < 3; i++) a = earnSticker(a, first).day;
    saveStickerDay("kid1", a, s);
    saveStickerDay("kid2", earnSticker(freshStickerDay("2026-11-25"), first).day, s);
    var ledger = loadStickerLedger(s);
    expect(Object.keys(ledger).sort()).toEqual(["kid1", "kid2"]);
    expect(stickerDayFor(ledger, "kid1", "2026-11-25").earned.length).toBe(3);
    expect(stickerDayFor(ledger, "kid3", "2026-11-25")).toEqual(freshStickerDay("2026-11-25"));
  });

  it("ignores a malformed stored entry", function () {
    var bad = { kid1: { date: "2026-11-24", setIdx: 7, earned: ["🦁", "nope"], today: "x" } };
    var d = stickerDayFor(bad, "kid1", "2026-11-24");
    expect(d.setIdx).toBe(1);
    expect(d.earned).toEqual([]);
    expect(d.today).toEqual([]);
  });
});

describe("timer (wall clock, like the Celebrate kitchen timers)", function () {
  var bl = [normalizeBlock({ id: "a", name: "Math", mins: 20 }), normalizeBlock({ id: "b", name: "Break", mins: 5, type: "break" }), normalizeBlock({ id: "c", name: "Reading", mins: 10 })];
  var T0 = 1000000;

  it("counts down from the clock, pauses, resumes and extends by 5 minutes", function () {
    var r = startBlock(idleRun("d"), bl[0], T0);
    expect(timeLeftMs(r, T0 + 60000)).toBe(19 * 60000);
    var p = pauseRun(r, T0 + 60000);
    expect(timeLeftMs(p, T0 + 999999)).toBe(19 * 60000);
    var q = resumeRun(p, T0 + 500000);
    expect(timeLeftMs(q, T0 + 500000)).toBe(19 * 60000);
    var e = extendRun(q);
    expect(timeLeftMs(e, T0 + 500000)).toBe(19 * 60000 + EXTEND_MS);
  });

  it("warns only in the last 2 minutes of a WORK block (half of a short block)", function () {
    var r = startBlock(idleRun("d"), bl[0], T0);
    expect(isWrapping(bl[0], r, T0 + 17 * 60000)).toBe(false);
    expect(isWrapping(bl[0], r, T0 + 18 * 60000 + 1)).toBe(true);
    var br = startBlock(idleRun("d"), bl[1], T0);
    expect(isWrapping(bl[1], br, T0 + 4 * 60000 + 30000)).toBe(false);
    expect(warnWindowMs(2 * 60000)).toBe(60000);
    expect(warnWindowMs(20 * 60000)).toBe(120000);
  });

  it("completing (or skipping) marks the block done and starts the next; the last one finishes the rhythm", function () {
    var r = startBlock(idleRun("d"), bl[0], T0);
    var a = completeCurrent(r, bl, T0 + 5000);
    expect(a.finishedBlock.id).toBe("a"); expect(a.next.id).toBe("b");
    expect(a.run.done).toEqual({ a: true }); expect(a.run.blockId).toBe("b");
    expect(timeLeftMs(a.run, T0 + 5000)).toBe(5 * 60000);
    var b = completeCurrent(a.run, bl, T0 + 6000);
    var c = completeCurrent(b.run, bl, T0 + 7000);
    expect(c.next).toBeNull(); expect(c.run.finished).toBe(true);
    expect(c.run.done).toEqual({ a: true, b: true, c: true });
  });

  it("the running timer is kept per kid for today only", function () {
    var s = memStorage();
    saveRun("kid1", startBlock(idleRun("2026-11-25"), bl[0], T0), s);
    expect(loadRun("kid1", "2026-11-25", s).blockId).toBe("a");
    expect(loadRun("kid1", "2026-11-26", s).blockId).toBeNull();
    expect(loadRun("kid2", "2026-11-25", s).blockId).toBeNull();
  });
});

describe("screen wake lock (best effort)", function () {
  function fakeEnv(opts) {
    var o = opts || {};
    var listeners = {}, requests = 0, released = 0;
    var doc = {
      visibilityState: "visible",
      addEventListener: function (t, f) { listeners[t] = f; },
      removeEventListener: function (t) { delete listeners[t]; },
    };
    var nav = { wakeLock: { request: function () {
      requests++;
      if (o.throws) throw new Error("nope");
      if (o.rejects) return Promise.reject(new Error("NotAllowedError"));
      var rl = {};
      return Promise.resolve({ release: function () { released++; if (rl.f) rl.f(); return Promise.resolve(); }, addEventListener: function (t, f) { rl.f = f; } });
    } } };
    return { nav: nav, doc: doc, fire: function () { if (listeners.visibilitychange) listeners.visibilitychange(); }, stats: function () { return { requests: requests, released: released, listening: !!listeners.visibilitychange }; } };
  }
  function flush() { return new Promise(function (r) { setTimeout(r, 0); }); }

  it("requests on want(true), releases on want(false)", async function () {
    var env = fakeEnv(); var w = createScreenWake(env.nav, env.doc);
    expect(w.supported).toBe(true);
    w.want(true); await flush();
    expect(w.held()).toBe(true); expect(env.stats().requests).toBe(1);
    w.want(true); await flush();
    expect(env.stats().requests).toBe(1); // no double request
    w.want(false);
    expect(w.held()).toBe(false); expect(env.stats().released).toBe(1);
  });

  it("re-acquires after the tab comes back, only while still wanted", async function () {
    var env = fakeEnv(); var w = createScreenWake(env.nav, env.doc);
    w.want(true); await flush();
    // Tab hidden: the browser drops the lock (its "release" event fires).
    env.doc.visibilityState = "hidden";
    w.want(false); w.want(true); await flush(); // still hidden: no request yet
    expect(env.stats().requests).toBe(1);
    env.doc.visibilityState = "visible"; env.fire(); await flush();
    expect(env.stats().requests).toBe(2); expect(w.held()).toBe(true);
    w.want(false); env.fire(); await flush();
    expect(env.stats().requests).toBe(2);
    w.dispose(); expect(env.stats().listening).toBe(false);
  });

  it("never throws when unsupported, throwing, or rejected", async function () {
    var none = createScreenWake({}, { visibilityState: "visible" });
    expect(none.supported).toBe(false);
    expect(function () { none.want(true); none.want(false); none.dispose(); }).not.toThrow();
    var t = fakeEnv({ throws: true }); var wt = createScreenWake(t.nav, t.doc);
    expect(function () { wt.want(true); }).not.toThrow();
    var r = fakeEnv({ rejects: true }); var wr = createScreenWake(r.nav, r.doc);
    wr.want(true); await flush();
    expect(wr.held()).toBe(false);
    wr.want(true); await flush();
    expect(r.stats().requests).toBe(2); // a later start can try again
  });

  it("drops a lock that arrives after the timer already stopped", async function () {
    var env = fakeEnv(); var w = createScreenWake(env.nav, env.doc);
    w.want(true); w.want(false); await flush();
    expect(w.held()).toBe(false); expect(env.stats().released).toBe(1);
  });
});
