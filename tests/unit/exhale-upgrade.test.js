// tests/unit/exhale-upgrade.test.js — the one-time Exhale data upgrades that
// af_redesign runs at app start (src/lib/exhaleUpgrade.js): same keys, flags
// and results as ExhaleSection's mount effects.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import { runExhaleUpgrades, startExhaleUpgrades, FLAG_MIGRATED, FLAG_V2, LS_BUCKETS } from "../../src/lib/exhaleUpgrade.js";

function mem(init) {
  var m = {};
  Object.keys(init || {}).forEach(function (k) { m[k] = typeof init[k] === "string" ? init[k] : JSON.stringify(init[k]); });
  return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, _m: m };
}
function buckets(st) { return JSON.parse(st.getItem(LS_BUCKETS)); }

describe("Exhale upgrades at app start", function () {
  it("4 -> 5 buckets: inserts This Weekend, moves Someday to 4, renames Here, marks dirty, sets the flag", function () {
    var st = mem({ af_exhale_buckets_migrated: "1", af_exhale_buckets: { bucketNames: ["Here", "Today", "Tomorrow", "Someday"], items: [{ id: "a", bucketIndex: 3, text: "x" }, { id: "b", bucketIndex: 1, text: "y" }] } });
    expect(runExhaleUpgrades(st)).toEqual({ migrated: false, upgraded: true });
    var b = buckets(st);
    expect(b.bucketNames).toEqual(["Exhaled", "Today", "Tomorrow", "This Weekend", "Someday"]);
    expect(b.items.map(function (i) { return i.bucketIndex; })).toEqual([4, 1]);
    expect(st.getItem(FLAG_V2)).toBe("1");
    expect(JSON.parse(st.getItem("af_dirtyKeys"))).toContain("exhale_buckets");
    // once only
    expect(runExhaleUpgrades(st)).toEqual({ migrated: false, upgraded: false });
    expect(buckets(st).bucketNames.length).toBe(5);
  });

  it("columns -> buckets: copies the old board once, Someday-and-later columns to bucket 4", function () {
    var st = mem({ af_exhale_groups: { inbox: [{ id: "1", text: "a" }], decide: [{ id: "2", text: "b" }], do: [], waiting: [{ id: "3", text: "c" }], someday: [{ text: "d" }] } });
    var r = runExhaleUpgrades(st, 1000);
    expect(r.migrated).toBe(true);
    var b = buckets(st);
    expect(b.bucketNames.length).toBe(5);
    expect(b.items.map(function (i) { return [i.text, i.bucketIndex]; })).toEqual([["a", 0], ["b", 1], ["c", 4], ["d", 4]]);
    expect(b.items[3].id).toBeTruthy();
    expect(st.getItem(FLAG_MIGRATED)).toBe("1");
    expect(st.getItem(FLAG_V2)).toBe("1"); // already 5 buckets: decided, nothing to do
  });

  it("never overwrites existing bucket items", function () {
    var st = mem({ af_exhale_groups: { inbox: [{ id: "1", text: "old" }] }, af_exhale_buckets: { bucketNames: ["Exhaled", "Today", "Tomorrow", "This Weekend", "Someday"], items: [{ id: "n", text: "new", bucketIndex: 1 }] } });
    runExhaleUpgrades(st);
    expect(buckets(st).items).toEqual([{ id: "n", text: "new", bucketIndex: 1 }]);
    expect(st.getItem(FLAG_MIGRATED)).toBe("1");
  });

  it("no Exhale data yet (before the first sync pull): decides nothing, so later data still upgrades", function () {
    var st = mem({});
    expect(runExhaleUpgrades(st)).toEqual({ migrated: false, upgraded: false });
    expect(st.getItem(FLAG_MIGRATED)).toBe(null);
    expect(st.getItem(FLAG_V2)).toBe(null);
    st.setItem(LS_BUCKETS, JSON.stringify({ bucketNames: ["Exhaled", "Today", "Tomorrow", "Someday"], items: [] }));
    expect(runExhaleUpgrades(st).upgraded).toBe(true);
  });

  it("start: runs now, re-runs on af-data-changed until done, then stops listening", function () {
    var st = mem({});
    var listeners = {};
    var win = {
      addEventListener: vi.fn(function (n, f) { listeners[n] = f; }),
      removeEventListener: vi.fn(function (n) { delete listeners[n]; }),
      dispatchEvent: vi.fn(function (e) { if (listeners[e.type]) listeners[e.type](e); }),
    };
    startExhaleUpgrades(win, st);
    expect(listeners["af-data-changed"]).toBeTruthy(); // nothing to decide yet
    st.setItem(LS_BUCKETS, JSON.stringify({ bucketNames: ["Exhaled", "Today", "Tomorrow", "Someday"], items: [] }));
    listeners["af-data-changed"]({ type: "af-data-changed" });
    expect(buckets(st).bucketNames[3]).toBe("This Weekend");
    expect(listeners["af-data-changed"]).toBeUndefined();
    expect(win.dispatchEvent).toHaveBeenCalled();
  });

  it("App.jsx runs it at app start only under af_redesign; ExhaleSection keeps its own copy", function () {
    var app = fs.readFileSync("src/App.jsx", "utf8");
    expect(app).toContain("if (REDESIGN) startExhaleUpgrades();");
    var ex = fs.readFileSync("src/components/ExhaleSection.jsx", "utf8");
    expect(ex).toContain('var EXHALE_BUCKETS_V2_MIGRATED_FLAG = "af_exhale_buckets_v2_migrated";');
    expect(ex).toContain('var EXHALE_BUCKETS_MIGRATED_FLAG = "af_exhale_buckets_migrated";');
  });
});
