// meals: two household members editing the week no longer overwrite each
// other. The server merge is per key (data = data || patch), so meals used to
// be last-push-wins for the whole week; now each day carries _at and pulls
// merge day by day (applyHouseholdKey, MERGE_WHILE_DIRTY).
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { applyHouseholdKey, mergeMeals, mealsAhead, MERGE_WHILE_DIRTY, sanitizeHouseholdData, SYNC_KEYS } from "../../src/sync-core.js";

// One localStorage per device: swap jsdom's storage contents in and out.
function device() { return {}; }
function use(dev) { localStorage.clear(); Object.keys(dev).forEach(function (k) { localStorage.setItem(k, dev[k]); }); }
function save(dev) { Object.keys(dev).forEach(function (k) { delete dev[k]; }); for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); dev[k] = localStorage.getItem(k); } }
function get(k) { return JSON.parse(localStorage.getItem("af_" + k) || "null"); }
function set(k, v) { localStorage.setItem("af_" + k, JSON.stringify(v)); }
function dirty() { return JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]"); }

// The device side of the protocol, as App.jsx does it:
//  edit  = setMeals: stamp the changed day, write af_meals, mark meals dirty
//  push  = send the dirty keys; the server merges per key (data || patch)
//  pull  = apply every SYNC_KEYS key, skipping dirty keys unless MERGE_WHILE_DIRTY
function edit(day, fields, at) {
  var m = get("meals") || {};
  m[day] = Object.assign({}, m[day] || {}, fields, { _at: String(at) });
  set("meals", m);
  var d = dirty(); if (d.indexOf("meals") === -1) d.push("meals"); localStorage.setItem("af_dirtyKeys", JSON.stringify(d));
}
function push(server) {
  var patch = {};
  dirty().forEach(function (k) { patch[k] = get(k); });
  Object.assign(server, JSON.parse(JSON.stringify(patch)));
  localStorage.setItem("af_dirtyKeys", "[]");
}
function pull(server) {
  var clean = sanitizeHouseholdData(JSON.parse(JSON.stringify(server)));
  var d = dirty();
  SYNC_KEYS.forEach(function (k) {
    if (clean[k] === undefined) return;
    if (d.indexOf(k) !== -1 && MERGE_WHILE_DIRTY.indexOf(k) === -1) return;
    applyHouseholdKey(k, clean[k]);
  });
}

var WEEK = { Sunday: {}, Monday: { dinner: "Chicken soup" }, Tuesday: { dinner: "Tacos" }, Wednesday: {}, Thursday: {}, Friday: {}, Saturday: {} };

describe("two members, one week of meals", function () {
  var server, lindsey, twyla;
  beforeEach(function () {
    server = { meals: JSON.parse(JSON.stringify(WEEK)), people: [] };
    lindsey = device(); twyla = device();
    use(lindsey); pull(server); save(lindsey);
    use(twyla); pull(server); save(twyla);
  });

  it("Twyla's new meal reaches Lindsey's device", function () {
    use(twyla); edit("Wednesday", { dinner: "Pad thai" }, 1000); push(server); save(twyla);
    use(lindsey); pull(server);
    expect(get("meals").Wednesday.dinner).toBe("Pad thai");
  });

  it("both edit different days before syncing: neither edit is lost, on either device or the server", function () {
    use(lindsey); edit("Monday", { dinner: "Lasagna" }, 1000); push(server); save(lindsey);
    // Twyla edited before she saw Lindsey's push
    use(twyla); edit("Thursday", { dinner: "Stir fry" }, 1100);
    // her push is blocked as stale → she pulls first; meals is dirty but merges anyway
    pull(server);
    expect(get("meals").Monday.dinner).toBe("Lasagna");
    expect(get("meals").Thursday.dinner).toBe("Stir fry");
    push(server); save(twyla);
    expect(server.meals.Monday.dinner).toBe("Lasagna");
    expect(server.meals.Thursday.dinner).toBe("Stir fry");
    use(lindsey); pull(server);
    expect(get("meals").Monday.dinner).toBe("Lasagna");
    expect(get("meals").Thursday.dinner).toBe("Stir fry");
  });

  it("a late push of an older week cannot erase a newer day; the device that has it pushes it again", function () {
    use(twyla); edit("Wednesday", { dinner: "Pad thai" }, 2000); push(server); save(twyla);
    // Lindsey's device never pulled that, and pushes its own (older) week straight over it
    use(lindsey); edit("Friday", { dinner: "Pizza" }, 1500); server.meals = get("meals"); localStorage.setItem("af_dirtyKeys", "[]"); save(lindsey);
    expect(server.meals.Wednesday.dinner).toBeUndefined();
    // Twyla's next pull keeps her newer Wednesday, takes Friday, and re-marks meals to push
    use(twyla); pull(server);
    expect(get("meals").Wednesday.dinner).toBe("Pad thai");
    expect(get("meals").Friday.dinner).toBe("Pizza");
    expect(dirty()).toContain("meals");
    push(server); save(twyla);
    expect(server.meals.Wednesday.dinner).toBe("Pad thai");
    expect(server.meals.Friday.dinner).toBe("Pizza");
  });

  it("the same day edited on both: the later edit wins everywhere", function () {
    use(lindsey); edit("Tuesday", { dinner: "Burgers" }, 1000); push(server); save(lindsey);
    use(twyla); edit("Tuesday", { dinner: "Tacos al pastor" }, 1200); pull(server); push(server); save(twyla);
    use(lindsey); pull(server);
    expect(get("meals").Tuesday.dinner).toBe("Tacos al pastor");
  });
});

describe("mergeMeals", function () {
  it("days without _at (saved before this change): the remote copy wins, as before", function () {
    var local = { Monday: { dinner: "Local" } }, remote = { Monday: { dinner: "Remote" } };
    expect(mergeMeals(local, remote).Monday.dinner).toBe("Remote");
    expect(mealsAhead(local, remote)).toBe(false);
  });
  it("newer local day kept; a day missing remotely kept; every day present", function () {
    var m = mergeMeals({ Monday: { dinner: "A", _at: "5" }, Friday: { dinner: "F", _at: "1" } }, { Monday: { dinner: "B", _at: "4" } });
    expect(m.Monday.dinner).toBe("A");
    expect(m.Friday.dinner).toBe("F");
    expect(Object.keys(m)).toEqual(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  });
  it("_at survives the server round trip (sanitize keeps it as a string)", function () {
    var clean = sanitizeHouseholdData({ meals: { Monday: { dinner: "A", _at: "1731500000000" } } });
    expect(clean.meals.Monday._at).toBe("1731500000000");
  });
});

describe("App wiring", function () {
  var app = fs.readFileSync("src/App.jsx", "utf8");
  it("setMeals builds on the newest copy of each day and stamps the days it changes", function () {
    expect(app).toContain("const base = mergeMeals(meals, stored);");
    expect(app).toContain("const resolved = typeof next === \"function\" ? next(base) : next;");
    expect(app).toContain("if (strip(safe[day]) !== strip(base[day])) safe[day]._at = now;");
    expect(MERGE_WHILE_DIRTY).toContain("meals");
  });
  it("a push carrying meals never uses the 'pushed recently' shortcut over another device's write; leftover dirty meals push after a reload", function () {
    expect(app).toContain("if (serverUpdatedAt !== lastPushedAt && pushedRecently && mergeKeyPending) {");
    expect(app).toContain('await pullLatestHouseholdData("merge-before-push");');
    expect(app).toContain("if (d.some(function(k){ return MERGE_WHILE_DIRTY.indexOf(k) !== -1; })) debouncedSync();");
  });
  it("the meal editor's fields are controlled, so Save sees what was typed without a blur", function () {
    expect(app).toContain('<input key={m+"_"+editDay} value={editMeal[m]||""} onChange={e=>{var v=e.target.value;setEditMeal(p=>({...p,[m]:v}));}}');
    expect(app).toContain('<textarea value={editMeal.notes||""} onChange={e=>{var v=e.target.value;setEditMeal(p=>({...p,notes:v}));}}');
    expect(app).not.toContain("defaultValue={editMeal[m]");
  });
});
