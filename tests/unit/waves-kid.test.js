// @vitest-environment jsdom
// tests/unit/waves-kid.test.js — Waves kid-friendly view (af_waves_kid_v1).
// Pure logic from src/lib/wavesKid.js, the exhale_waves sanitize rule, the
// kid_feelings sync key, and Compass reading the day's feeling.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SYNC_KEYS, sanitizeHouseholdData } from "../../src/sync-core.js";
import { buildCompassContext } from "../../src/compass/compassEngine.js";
import {
  wavesKidEnabled, WAVES_KID_FLAG_KEY, FEELINGS_KEY, FEELING_KEEP_DAYS, patchWave, isKidWave, visibleSteps, hasEssential,
  stepProgress, stepIcon, suggestIcon, kidKeyFor, loadFeelings, feelingFor, saveFeeling, pruneFeelings, compassFeelingContext,
} from "../../src/lib/wavesKid.js";

function memStorage() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
  };
}
var noop = function () {};
function waves() {
  return {
    daily: [{ id: "w1", name: "Morning reset", lastReset: "2026-11-25", tasks: [
      { id: "t1", text: "Get dressed", estimatedMinutes: null, done: false, essential: true },
      { id: "t2", text: "Brush teeth", estimatedMinutes: null, done: true, essential: true },
      { id: "t3", text: "Make bed", estimatedMinutes: null, done: false },
      { id: "t4", text: "Pack bag", estimatedMinutes: null, done: false, essential: false },
    ] }],
    weekly: [{ id: "w2", name: "Sunday reset", dayOfWeek: 0, tasks: [] }], seasonal: [], custom: [],
  };
}

describe("flag af_waves_kid_v1", function () {
  it("is OFF by default; only 'true' turns it on", function () {
    var s = memStorage();
    expect(WAVES_KID_FLAG_KEY).toBe("af_waves_kid_v1");
    expect(wavesKidEnabled(s)).toBe(false);
    s.setItem("af_waves_kid_v1", "1"); expect(wavesKidEnabled(s)).toBe(false);
    s.setItem("af_waves_kid_v1", "true"); expect(wavesKidEnabled(s)).toBe(true);
  });
});

describe("kidView toggle on an existing routine", function () {
  it("patchWave sets kidView / kidId on that wave only and keeps everything else", function () {
    var w = waves();
    var on = patchWave(w, "daily", "w1", { kidView: true, kidId: "p_jun" });
    expect(on.daily[0].kidView).toBe(true);
    expect(on.daily[0].kidId).toBe("p_jun");
    expect(on.daily[0].tasks).toBe(w.daily[0].tasks);         // same routine, same steps
    expect(on.weekly).toBe(w.weekly);
    expect(w.daily[0].kidView).toBeUndefined();               // input not mutated
    var off = patchWave(on, "daily", "w1", { kidView: false });
    expect(isKidWave("daily", off.daily[0])).toBe(false);
  });
  it("kid view applies to daily routines only", function () {
    expect(isKidWave("daily", { kidView: true })).toBe(true);
    expect(isKidWave("weekly", { kidView: true })).toBe(false);
    expect(isKidWave("daily", { kidView: "yes" })).toBe(false);
    expect(isKidWave("daily", null)).toBe(false);
  });
});

describe("essential steps and gentle day", function () {
  var tasks = waves().daily[0].tasks;
  it("gentle shows only essential steps; normal shows all", function () {
    expect(visibleSteps(tasks, false).map(function (t) { return t.id; })).toEqual(["t1", "t2", "t3", "t4"]);
    expect(visibleSteps(tasks, true).map(function (t) { return t.id; })).toEqual(["t1", "t2"]);
    expect(hasEssential(tasks)).toBe(true);
  });
  it("progress counts what's shown; gentle can finish on the must-dos", function () {
    expect(stepProgress(tasks, false)).toEqual({ done: 1, total: 4, pct: 25, allDone: false });
    var t2 = tasks.map(function (t) { return t.id === "t1" ? Object.assign({}, t, { done: true }) : t; });
    expect(stepProgress(t2, true)).toEqual({ done: 2, total: 2, pct: 100, allDone: true });
    expect(stepProgress(t2, false).allDone).toBe(false);
  });
  it("a gentle day never hides everything when nothing is marked essential", function () {
    var plain = [{ id: "a", text: "x" }, { id: "b", text: "y" }];
    expect(hasEssential(plain)).toBe(false);
    expect(visibleSteps(plain, true).length).toBe(2);
    expect(stepProgress([], true)).toEqual({ done: 0, total: 0, pct: 0, allDone: false });
  });
  it("pictures: the step's own icon, else a sensible suggestion", function () {
    expect(stepIcon({ text: "Brush teeth" })).toBe("🪥");
    expect(stepIcon({ text: "Brush teeth", icon: "🦷" })).toBe("🦷");
    expect(suggestIcon("Something else")).toBe("⭐");
  });
});

describe("feelings check-in — per kid per day, expiring, synced", function () {
  var s;
  beforeEach(function () { s = memStorage(); });

  it("kid_feelings is a SYNC_KEY and passes through sanitize", function () {
    expect(FEELINGS_KEY).toBe("kid_feelings");
    expect(SYNC_KEYS).toContain("kid_feelings");
    var blob = { kid_feelings: { p_jun: { "2026-11-25": { feeling: "big", gentle: true, at: 1 } } } };
    expect(sanitizeHouseholdData(blob).kid_feelings).toEqual(blob.kid_feelings);
  });

  it("saves today's feeling, marks kid_feelings dirty once, dispatches af-data-changed", function () {
    s.setItem("af_dirtyKeys", JSON.stringify(["meals"]));
    var sent = [];
    var d = { storage: s, dispatch: function (k) { sent.push(k); }, now: 9 };
    saveFeeling("p_jun", "2026-11-25", { feeling: "wiggly" }, d);
    saveFeeling("p_jun", "2026-11-25", { gentle: true }, d);
    var f = feelingFor(loadFeelings(s), "p_jun", "2026-11-25");
    expect(f).toEqual({ feeling: "wiggly", gentle: true });   // gentle kept the feeling
    expect(JSON.parse(s.getItem("af_dirtyKeys"))).toEqual(["meals", "kid_feelings"]);
    expect(sent).toEqual(["kid_feelings", "kid_feelings"]);
  });

  it("dispatches a real af-data-changed event by default", function () {
    var seen = vi.fn();
    window.addEventListener("af-data-changed", seen);
    saveFeeling("p_jun", "2026-11-25", { feeling: "calm" }, { storage: s });
    window.removeEventListener("af-data-changed", seen);
    expect(seen.mock.calls[0][0].detail).toEqual({ key: "kid_feelings" });
  });

  it("is per kid and per day: yesterday's feeling doesn't carry into today", function () {
    var d = { storage: s, dispatch: noop };
    saveFeeling("p_jun", "2026-11-24", { feeling: "big", gentle: true }, d);
    saveFeeling("p_oll", "2026-11-25", { feeling: "happy" }, d);
    var all = loadFeelings(s);
    expect(feelingFor(all, "p_jun", "2026-11-25")).toEqual({ feeling: null, gentle: false });
    expect(feelingFor(all, "p_jun", "2026-11-24")).toEqual({ feeling: "big", gentle: true });
    expect(feelingFor(all, "p_oll", "2026-11-25").feeling).toBe("happy");
  });

  it("expires: entries older than 7 days are pruned on the next write", function () {
    var d = { storage: s, dispatch: noop };
    saveFeeling("p_jun", "2026-11-10", { feeling: "calm" }, d);
    saveFeeling("p_oll", "2026-11-20", { feeling: "happy" }, d);
    saveFeeling("p_jun", "2026-11-25", { feeling: "wiggly" }, d);
    var all = loadFeelings(s);
    expect(Object.keys(all.p_jun)).toEqual(["2026-11-25"]);
    expect(Object.keys(all.p_oll)).toEqual(["2026-11-20"]);   // 5 days old: kept
    expect(FEELING_KEEP_DAYS).toBe(7);
    expect(pruneFeelings({ p_x: { "2026-11-18": { feeling: "calm" } } }, "2026-11-25")).toEqual({});
  });

  it("feelings attach to the routine's child, or to the routine when no child is set", function () {
    expect(kidKeyFor({ id: "w1", kidId: "p_jun" })).toBe("p_jun");
    expect(kidKeyFor({ id: "w1" })).toBe("wave_w1");
  });
});

describe("Compass receives the day's feeling (an input, not a rewrite)", function () {
  var people = [{ id: "p_jun", name: "June" }, { id: "p_oll", name: "Ollie" }];
  // buildCompassContext returns the JSON string sent to the model.
  function ctxOf(state, scope, extra) { return JSON.parse(buildCompassContext(state, scope, extra)); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  it("a big-feelings morning reaches the today/ask context with a lighter-day hint", function () {
    var state = { people: people, kid_feelings: { p_jun: {} } };
    state.kid_feelings.p_jun[today()] = { feeling: "big", gentle: false, at: 1 };
    var ctx = ctxOf(state, "today");
    expect(ctx.kid_checkins_today.checkins).toEqual([{ child: "June", feeling: "Big feelings", gentle_day: false }]);
    expect(ctx.kid_checkins_today.note).toMatch(/lighter day/);
    expect(ctxOf(state, "ask", { question: "what should we do today?" }).kid_checkins_today).toBeTruthy();
    expect(ctxOf(state, "week").kid_checkins_today).toBeUndefined();
  });

  it("no check-in today → Compass context is unchanged (no key at all)", function () {
    var state = { people: people, kid_feelings: { p_jun: { "2020-01-01": { feeling: "big" } } } };
    expect("kid_checkins_today" in ctxOf(state, "today")).toBe(false);
    expect("kid_checkins_today" in ctxOf({ people: people }, "today")).toBe(false);
  });

  it("a calm check-in is passed as optional context only", function () {
    var f = {}; f[today()] = { feeling: "calm" };
    var c = compassFeelingContext({ people: people, kid_feelings: { p_oll: f } });
    expect(c.checkins[0]).toEqual({ child: "Ollie", feeling: "Calm", gentle_day: false });
    expect(c.note).not.toMatch(/lighter day/);
  });
});

describe("new Waves fields survive a pull (sanitize)", function () {
  it("kidView, kidId, essential and icon are carried through, type-checked", function () {
    var w = waves();
    w.daily[0].kidView = true; w.daily[0].kidId = "p_jun"; w.daily[0].tasks[0].icon = "👕";
    var out = sanitizeHouseholdData({ exhale_waves: w }).exhale_waves;
    expect(out.daily[0].kidView).toBe(true);
    expect(out.daily[0].kidId).toBe("p_jun");
    expect(out.daily[0].tasks[0].essential).toBe(true);
    expect(out.daily[0].tasks[0].icon).toBe("👕");
    expect(out.daily[0].tasks[3].essential).toBe(false);
  });
  it("routines without the new fields come through exactly as before", function () {
    var out = sanitizeHouseholdData({ exhale_waves: waves() }).exhale_waves;
    expect(Object.keys(out.daily[0]).sort()).toEqual(["id", "lastReset", "name", "tasks"]);
    expect(Object.keys(out.daily[0].tasks[2]).sort()).toEqual(["done", "estimatedMinutes", "id", "text"]);
    expect(out.weekly[0]).toEqual({ id: "w2", name: "Sunday reset", tasks: [], dayOfWeek: 0 });
  });
  it("wrong types are dropped, not trusted", function () {
    var w = waves();
    w.daily[0].kidView = "yes"; w.daily[0].kidId = 42; w.daily[0].tasks[0].essential = "true"; w.daily[0].tasks[1].icon = { x: 1 };
    var out = sanitizeHouseholdData({ exhale_waves: w }).exhale_waves;
    expect("kidView" in out.daily[0]).toBe(false);
    expect("kidId" in out.daily[0]).toBe(false);
    expect("essential" in out.daily[0].tasks[0]).toBe(false);
    expect("icon" in out.daily[0].tasks[1]).toBe(false);
  });
});

describe("bad stored data", function () {
  it("corrupt or wrong-shaped feelings read as empty and never throw", function () {
    var s = memStorage();
    s.setItem("af_kid_feelings", "{oops");
    expect(loadFeelings(s)).toEqual({});
    s.setItem("af_kid_feelings", JSON.stringify(["x"]));
    expect(loadFeelings(s)).toEqual({});
    var junk = { p_jun: { "2026-11-25": { feeling: "furious", gentle: "yes" }, "not-a-date": { feeling: "calm" } }, p_x: "nope" };
    expect(feelingFor(junk, "p_jun", "2026-11-25")).toEqual({ feeling: null, gentle: false });
    expect(feelingFor(junk, "p_x", "2026-11-25")).toEqual({ feeling: null, gentle: false });
    expect(pruneFeelings(junk, "2026-11-25")).toEqual({ p_jun: { "2026-11-25": { feeling: "furious", gentle: "yes" } } });
    expect(compassFeelingContext({ kid_feelings: junk }, "2026-11-25")).toBeNull();
  });
  it("saveFeeling ignores an unknown feeling and an invalid date", function () {
    var s = memStorage(); var d = { storage: s, dispatch: noop };
    saveFeeling("p_jun", "2026-11-25", { feeling: "calm" }, d);
    saveFeeling("p_jun", "2026-11-25", { feeling: "furious" }, d);
    expect(feelingFor(loadFeelings(s), "p_jun", "2026-11-25").feeling).toBe("calm");
    expect(saveFeeling("p_jun", "yesterday", { feeling: "calm" }, d)).toBeNull();
    expect(saveFeeling("", "2026-11-25", { feeling: "calm" }, d)).toBeNull();
  });
  it("steps that aren't objects are skipped", function () {
    expect(visibleSteps([null, "x", { id: "a", essential: true }], true).length).toBe(1);
    expect(visibleSteps("nope", false)).toEqual([]);
  });
});
