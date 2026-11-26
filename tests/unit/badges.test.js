// @vitest-environment jsdom
// tests/unit/badges.test.js — Badges & Stars (Lighthouse per-child wall).
// Pure logic from src/lib/badges.js + sync registration. No React, no App.jsx.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SYNC_KEYS, sanitizeHouseholdData } from "../../src/sync-core.js";
import {
  badgesEnabled, BADGES_FLAG_KEY, BADGES_KEY, MAX_LEVEL, loadBadges, wallFor, saveWall, starterWall,
  normalizeWall, normalizeMedal, levelUp, levelDown, addShield, removeShield, bump, setAwarded, editMedal,
  addMilestone, removeMilestone, medalState, medalPct, wallSummary,
} from "../../src/lib/badges.js";

function memStorage() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
  };
}
function medal(w, label) { return w.milestones.filter(function (m) { return m.label === label; })[0]; }
var noop = function () {};

describe("flag af_badges_v1", function () {
  it("is OFF by default; only 'true' turns it on", function () {
    var s = memStorage();
    expect(BADGES_FLAG_KEY).toBe("af_badges_v1");
    expect(badgesEnabled(s)).toBe(false);
    s.setItem("af_badges_v1", "yes"); expect(badgesEnabled(s)).toBe(false);
    s.setItem("af_badges_v1", "true"); expect(badgesEnabled(s)).toBe(true);
  });
});

describe("milestones — earn logic", function () {
  it("count: +1 logs progress and auto-earns exactly at the goal", function () {
    var w = addMilestone({ curriculum: [], milestones: [] }, { label: "Name 3 states", icon: "🗺️", type: "count", goal: 3 });
    var id = w.milestones[0].id;
    expect(medalState(w.milestones[0])).toBe("locked");
    w = bump(w, id, 1, 100);
    expect(w.milestones[0].have).toBe(1);
    expect(medalState(w.milestones[0])).toBe("progress");
    expect(medalPct(w.milestones[0])).toBe(33);
    w = bump(w, id, 1, 200);
    expect(w.milestones[0].earned).toBe(false);
    w = bump(w, id, 1, 300);
    expect(w.milestones[0].earned).toBe(true);
    expect(w.milestones[0].earnedAt).toBe(300);
    expect(medalState(w.milestones[0])).toBe("earned");
    // past the goal it stays put (and keeps its earned date)
    w = bump(w, id, 1, 400);
    expect(w.milestones[0].have).toBe(3);
    expect(w.milestones[0].earnedAt).toBe(300);
    // a correction below the goal un-earns it
    w = bump(w, id, -1, 500);
    expect(w.milestones[0].earned).toBe(false);
    expect(w.milestones[0].earnedAt).toBeNull();
  });

  it("once: a parent awards and un-awards; +1 does nothing to it", function () {
    var w = starterWall();
    var m = medal(w, "First presentation");
    expect(m.type).toBe("once");
    w = bump(w, m.id, 1);
    expect(medal(w, "First presentation").earned).toBe(false);
    w = setAwarded(w, m.id, true, 77);
    expect(medal(w, "First presentation").earned).toBe(true);
    expect(medal(w, "First presentation").earnedAt).toBe(77);
    w = setAwarded(w, m.id, false);
    expect(medal(w, "First presentation").earned).toBe(false);
    expect(medal(w, "First presentation").earnedAt).toBeNull();
    // award has no effect on count types
    var c = medal(w, "Read 100 books");
    expect(medal(setAwarded(w, c.id, true), "Read 100 books").earned).toBe(false);
  });

  it("editing the goal re-evaluates earned; adding and removing custom milestones", function () {
    var w = addMilestone(starterWall(), { label: "  Ride a bike  ", icon: "🚲", type: "count", goal: 5 });
    var m = medal(w, "Ride a bike");
    expect(m).toBeTruthy();
    expect(m.icon).toBe("🚲"); expect(m.goal).toBe(5); expect(m.have).toBe(0);
    w = editMedal(w, m.id, { have: 4 });
    w = editMedal(w, m.id, { goal: 4 }, 9);
    expect(medal(w, "Ride a bike").earned).toBe(true);
    w = addMilestone(w, { label: "Tie shoes", type: "once" });
    expect(medal(w, "Tie shoes").icon).toBe("⭐");
    var before = w.milestones.length;
    w = removeMilestone(w, medal(w, "Tie shoes").id);
    expect(w.milestones.length).toBe(before - 1);
  });
});

describe("curriculum shields", function () {
  it("levels up to MAX_LEVEL and down to 0, never past either", function () {
    var w = starterWall(); var id = w.curriculum[0].id;
    for (var i = 0; i < 9; i++) w = levelUp(w, id);
    expect(w.curriculum[0].level).toBe(MAX_LEVEL);
    for (var j = 0; j < 9; j++) w = levelDown(w, id);
    expect(w.curriculum[0].level).toBe(0);
    w = addShield(w, "Piano", "🎹");
    expect(w.curriculum[w.curriculum.length - 1].subject).toBe("Piano");
    w = removeShield(w, id);
    expect(w.curriculum.filter(function (c) { return c.id === id; }).length).toBe(0);
  });

  it("summary totals earned stars and levels", function () {
    var w = starterWall();
    w = levelUp(levelUp(w, w.curriculum[0].id), w.curriculum[1].id);
    w = setAwarded(w, medal(w, "First presentation").id, true);
    expect(wallSummary(w)).toEqual({ stars: 1, levels: 2 });
  });
});

describe("persistence — per child, kept across days, synced", function () {
  var s;
  beforeEach(function () { s = memStorage(); });

  it("kid_badges is a SYNC_KEY (no af_ prefix) and survives sanitize", function () {
    expect(BADGES_KEY).toBe("kid_badges");
    expect(SYNC_KEYS).toContain("kid_badges");
    expect(SYNC_KEYS).not.toContain("af_kid_badges");
    var blob = { kid_badges: { p_a: { curriculum: [], milestones: [], updatedAt: 1 } } };
    expect(sanitizeHouseholdData(blob).kid_badges).toEqual(blob.kid_badges);
    expect(sanitizeHouseholdData({ kid_badges: null }).kid_badges).toBeUndefined();
  });

  it("saveWall writes af_kid_badges, marks kid_badges dirty once, dispatches af-data-changed", function () {
    s.setItem("af_dirtyKeys", JSON.stringify(["meals"]));
    var sent = [];
    var d = { storage: s, dispatch: function (k) { sent.push(k); }, now: 5 };
    saveWall("p_a", starterWall(), d);
    saveWall("p_a", starterWall(), d);
    expect(JSON.parse(s.getItem("af_kid_badges")).p_a.updatedAt).toBe(5);
    expect(JSON.parse(s.getItem("af_dirtyKeys"))).toEqual(["meals", "kid_badges"]);
    expect(sent).toEqual(["kid_badges", "kid_badges"]);
  });

  it("dispatches a real af-data-changed event by default (the push trigger)", function () {
    var seen = vi.fn();
    window.addEventListener("af-data-changed", seen);
    saveWall("p_a", starterWall(), { storage: s });
    window.removeEventListener("af-data-changed", seen);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0][0].detail).toEqual({ key: "kid_badges" });
  });

  it("each child has their own wall; saving one never touches another (even one just pulled)", function () {
    var d = { storage: s, dispatch: noop };
    var a = wallFor(loadBadges(s), "p_a");
    a = setAwarded(a, medal(a, "First presentation").id, true);
    saveWall("p_a", a, d);
    // a pull lands p_b's wall from another device
    var all = loadBadges(s);
    var b = levelUp(starterWall(), "cs_start_0");
    all.p_b = { curriculum: b.curriculum, milestones: b.milestones, updatedAt: 3 };
    s.setItem("af_kid_badges", JSON.stringify(all));
    a = levelUp(a, "cs_start_1");
    saveWall("p_a", a, d);
    var after = loadBadges(s);
    expect(wallSummary(wallFor(after, "p_a"))).toEqual({ stars: 1, levels: 1 });
    expect(wallSummary(wallFor(after, "p_b"))).toEqual({ stars: 0, levels: 1 });
    expect(wallSummary(wallFor(after, "p_c"))).toEqual({ stars: 0, levels: 0 }); // starter wall
  });

  it("nothing resets: a wall saved days ago reads back exactly", function () {
    var w = setAwarded(starterWall(), "ms_start_2", true, 1700000000000);
    saveWall("p_a", w, { storage: s, dispatch: noop, now: 1700000000000 });
    var back = wallFor(loadBadges(s), "p_a");
    expect(medal(back, "First presentation").earned).toBe(true);
    expect(medal(back, "First presentation").earnedAt).toBe(1700000000000);
  });
});

describe("bad stored data", function () {
  it("corrupt JSON or a non-object store reads as empty", function () {
    var s = memStorage();
    s.setItem("af_kid_badges", "{not json");
    expect(loadBadges(s)).toEqual({});
    s.setItem("af_kid_badges", JSON.stringify([1, 2]));
    expect(loadBadges(s)).toEqual({});
    expect(wallFor(loadBadges(s), "p_a")).toEqual(starterWall());
  });

  it("malformed walls and entries are repaired, not crashed on", function () {
    expect(normalizeWall("x")).toEqual(starterWall());
    expect(normalizeWall({ curriculum: "nope", milestones: 4 })).toEqual(starterWall());
    var w = normalizeWall({
      curriculum: [{ subject: "Art", level: 99 }, null, "junk", { level: -3 }],
      milestones: [{ label: "", type: "count", have: 500, goal: 10 }, { type: "weird", goal: "abc" }, 7],
    });
    expect(w.curriculum.map(function (c) { return c.level; })).toEqual([MAX_LEVEL, 0]);
    expect(w.curriculum[1].subject).toBe("Subject");
    expect(w.milestones.length).toBe(2);
    expect(w.milestones[0].have).toBe(10);
    expect(w.milestones[0].earned).toBe(true);
    expect(w.milestones[0].label).toBe("Milestone");
    expect(w.milestones[1].type).toBe("count");
    expect(w.milestones[1].goal).toBe(10);
    var once = normalizeMedal({ type: "once", earned: "yes", have: 9, goal: 50 });
    expect(once.earned).toBe(false); expect(once.goal).toBe(1); expect(once.have).toBe(0);
  });

  it("an empty-but-valid wall stays empty (a parent removed everything)", function () {
    expect(normalizeWall({ curriculum: [], milestones: [] })).toEqual({ curriculum: [], milestones: [] });
  });
});
