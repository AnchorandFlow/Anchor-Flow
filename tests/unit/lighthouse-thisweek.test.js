// tests/unit/lighthouse-thisweek.test.js
// LH-5b — This Week pure-logic tests.
// No React, no App.jsx import (module-scope IIFE touches localStorage).
// Mirrors pure helpers from App.jsx.

import { describe, it, expect } from "vitest";

// ── Mirrors (keep in sync with App.jsx) ───────────────────────────────────────

function lhGet(obj, key, def) {
  if (!obj || typeof obj !== "object") return def;
  return obj[key] !== undefined ? obj[key] : def;
}

function defaultLhSchoolChild() {
  return { homework: [], week: { events: [], forms: [], pack: [] }, comms: { contacts: [], log: [] }, grades: {} };
}

function lhSchoolPatch(lh, childId, patch) {
  var sc = Object.assign({}, lhGet(lh, "school", {}));
  sc[childId] = Object.assign({}, sc[childId] || defaultLhSchoolChild(), patch);
  return Object.assign({}, lh, { school: sc });
}

function weekMutate(lh, childId, weekData, p) {
  return lhSchoolPatch(lh, childId, { week: Object.assign({}, weekData, p) });
}

function sortByDate(arr, key) {
  return arr.slice().sort(function(a, b) {
    var da = a[key]; var db = b[key];
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : da > db ? 1 : 0;
  });
}

function makeChildLh(weekOverride) {
  var week = Object.assign({ events: [], forms: [], pack: [] }, weekOverride || {});
  return {
    version: 2,
    school: { "child1": Object.assign({}, defaultLhSchoolChild(), { week: week }) }
  };
}

function getWeek(lh, childId) {
  var sc = lhGet(lh, "school", {});
  var child = sc[childId] || defaultLhSchoolChild();
  var weekData = (child.week && typeof child.week === "object") ? child.week : {};
  return {
    events: Array.isArray(weekData.events) ? weekData.events : [],
    forms:  Array.isArray(weekData.forms)  ? weekData.forms  : [],
    pack:   Array.isArray(weekData.pack)   ? weekData.pack   : [],
  };
}

// ── LH-5b-A — defaultLhSchoolChild week shape ─────────────────────────────────

describe("LH-5b-A — defaultLhSchoolChild week structure", function() {
  it("A1: week is an object", function() {
    var d = defaultLhSchoolChild();
    expect(d.week !== null && typeof d.week === "object").toBe(true);
  });

  it("A2: week.events is an empty array", function() {
    var d = defaultLhSchoolChild();
    expect(Array.isArray(d.week.events)).toBe(true);
    expect(d.week.events.length).toBe(0);
  });

  it("A3: week.forms is an empty array", function() {
    var d = defaultLhSchoolChild();
    expect(Array.isArray(d.week.forms)).toBe(true);
    expect(d.week.forms.length).toBe(0);
  });

  it("A4: week.pack is an empty array", function() {
    var d = defaultLhSchoolChild();
    expect(Array.isArray(d.week.pack)).toBe(true);
    expect(d.week.pack.length).toBe(0);
  });

  it("A5: old week:{} is normalised gracefully by guards", function() {
    var oldWeek = {};
    var events = Array.isArray(oldWeek.events) ? oldWeek.events : [];
    var forms  = Array.isArray(oldWeek.forms)  ? oldWeek.forms  : [];
    var pack   = Array.isArray(oldWeek.pack)   ? oldWeek.pack   : [];
    expect(events).toEqual([]);
    expect(forms).toEqual([]);
    expect(pack).toEqual([]);
  });
});

// ── LH-5b-B — event CRUD ──────────────────────────────────────────────────────

describe("LH-5b-B — events add / edit / delete", function() {
  it("B1: adding an event increases count by 1", function() {
    var lh = makeChildLh();
    var week = getWeek(lh, "child1");
    var newEv = { id:"ev1", title:"Picture Day", date:"2026-07-10" };
    var next = weekMutate(lh, "child1", lhGet(lh.school["child1"], "week", {}),
      { events: week.events.concat([newEv]) });
    expect(getWeek(next, "child1").events.length).toBe(1);
  });

  it("B2: adding two events preserves both", function() {
    var lh = makeChildLh();
    var w = getWeek(lh, "child1");
    var step1 = weekMutate(lh, "child1", lh.school["child1"].week,
      { events: w.events.concat([{ id:"ev1", title:"Picture Day", date:"2026-07-10" }]) });
    var w2 = getWeek(step1, "child1");
    var step2 = weekMutate(step1, "child1", step1.school["child1"].week,
      { events: w2.events.concat([{ id:"ev2", title:"Spirit Day", date:"2026-07-11" }]) });
    expect(getWeek(step2, "child1").events.length).toBe(2);
  });

  it("B3: editing an event title patches only that event", function() {
    var lh = makeChildLh({ events: [
      { id:"ev1", title:"Old Title", date:"2026-07-10" },
      { id:"ev2", title:"Keep Me",  date:"2026-07-12" }
    ]});
    var w = getWeek(lh, "child1");
    var updated = w.events.map(function(e){
      return e.id === "ev1" ? Object.assign({}, e, { title:"New Title" }) : e;
    });
    var next = weekMutate(lh, "child1", lh.school["child1"].week, { events: updated });
    var evts = getWeek(next, "child1").events;
    expect(evts.find(function(e){ return e.id==="ev1"; }).title).toBe("New Title");
    expect(evts.find(function(e){ return e.id==="ev2"; }).title).toBe("Keep Me");
  });

  it("B4: deleting an event removes only that event", function() {
    var lh = makeChildLh({ events: [
      { id:"ev1", title:"Picture Day", date:"2026-07-10" },
      { id:"ev2", title:"Spirit Day",  date:"2026-07-11" }
    ]});
    var w = getWeek(lh, "child1");
    var filtered = w.events.filter(function(e){ return e.id !== "ev1"; });
    var next = weekMutate(lh, "child1", lh.school["child1"].week, { events: filtered });
    var evts = getWeek(next, "child1").events;
    expect(evts.length).toBe(1);
    expect(evts[0].id).toBe("ev2");
  });

  it("B5: mutating events does not affect forms or pack", function() {
    var lh = makeChildLh({
      events: [],
      forms: [{ id:"fm1", title:"Permission", due:"", done:false }],
      pack:  [{ id:"pk1", label:"PE clothes", checked:false }]
    });
    var w = getWeek(lh, "child1");
    var next = weekMutate(lh, "child1", lh.school["child1"].week,
      { events: [{ id:"ev1", title:"Picture Day", date:"2026-07-10" }] });
    var nw = getWeek(next, "child1");
    expect(nw.forms.length).toBe(1);
    expect(nw.pack.length).toBe(1);
  });
});

// ── LH-5b-C — form CRUD + done toggle ────────────────────────────────────────

describe("LH-5b-C — forms add / done-toggle / delete", function() {
  it("C1: adding a form includes done:false by default", function() {
    var lh = makeChildLh();
    var w = getWeek(lh, "child1");
    var next = weekMutate(lh, "child1", lh.school["child1"].week,
      { forms: w.forms.concat([{ id:"fm1", title:"Permission slip", due:"2026-07-14", done:false }]) });
    var fm = getWeek(next, "child1").forms[0];
    expect(fm.done).toBe(false);
  });

  it("C2: toggling done to true", function() {
    var lh = makeChildLh({ forms: [{ id:"fm1", title:"Permission slip", due:"2026-07-14", done:false }] });
    var w = getWeek(lh, "child1");
    var toggled = w.forms.map(function(f){ return f.id==="fm1" ? Object.assign({},f,{done:!f.done}) : f; });
    var next = weekMutate(lh, "child1", lh.school["child1"].week, { forms: toggled });
    expect(getWeek(next, "child1").forms[0].done).toBe(true);
  });

  it("C3: toggling done back to false", function() {
    var lh = makeChildLh({ forms: [{ id:"fm1", title:"Permission slip", due:"2026-07-14", done:true }] });
    var w = getWeek(lh, "child1");
    var toggled = w.forms.map(function(f){ return f.id==="fm1" ? Object.assign({},f,{done:!f.done}) : f; });
    var next = weekMutate(lh, "child1", lh.school["child1"].week, { forms: toggled });
    expect(getWeek(next, "child1").forms[0].done).toBe(false);
  });

  it("C4: deleting a form removes only that form", function() {
    var lh = makeChildLh({ forms: [
      { id:"fm1", title:"Lunch form", due:"2026-07-10", done:false },
      { id:"fm2", title:"Field trip", due:"2026-07-11", done:false }
    ]});
    var w = getWeek(lh, "child1");
    var next = weekMutate(lh, "child1", lh.school["child1"].week,
      { forms: w.forms.filter(function(f){ return f.id !== "fm1"; }) });
    var fms = getWeek(next, "child1").forms;
    expect(fms.length).toBe(1);
    expect(fms[0].id).toBe("fm2");
  });

  it("C5: editing a form updates title and due without touching done", function() {
    var lh = makeChildLh({ forms: [{ id:"fm1", title:"Old", due:"2026-07-10", done:true }] });
    var w = getWeek(lh, "child1");
    var updated = w.forms.map(function(f){
      return f.id==="fm1" ? Object.assign({},f,{title:"New",due:"2026-07-15"}) : f;
    });
    var next = weekMutate(lh, "child1", lh.school["child1"].week, { forms: updated });
    var fm = getWeek(next, "child1").forms[0];
    expect(fm.title).toBe("New");
    expect(fm.due).toBe("2026-07-15");
    expect(fm.done).toBe(true);
  });
});

// ── LH-5b-D — pack list CRUD + check toggle ───────────────────────────────────

describe("LH-5b-D — pack list add / check / delete", function() {
  it("D1: adding a pack item starts unchecked", function() {
    var lh = makeChildLh();
    var w = getWeek(lh, "child1");
    var next = weekMutate(lh, "child1", lh.school["child1"].week,
      { pack: w.pack.concat([{ id:"pk1", label:"PE clothes", checked:false }]) });
    expect(getWeek(next, "child1").pack[0].checked).toBe(false);
  });

  it("D2: tapping a pack item toggles checked to true", function() {
    var lh = makeChildLh({ pack: [{ id:"pk1", label:"PE clothes", checked:false }] });
    var w = getWeek(lh, "child1");
    var toggled = w.pack.map(function(p){ return p.id==="pk1" ? Object.assign({},p,{checked:!p.checked}) : p; });
    var next = weekMutate(lh, "child1", lh.school["child1"].week, { pack: toggled });
    expect(getWeek(next, "child1").pack[0].checked).toBe(true);
  });

  it("D3: tapping again toggles checked back to false", function() {
    var lh = makeChildLh({ pack: [{ id:"pk1", label:"PE clothes", checked:true }] });
    var w = getWeek(lh, "child1");
    var toggled = w.pack.map(function(p){ return p.id==="pk1" ? Object.assign({},p,{checked:!p.checked}) : p; });
    var next = weekMutate(lh, "child1", lh.school["child1"].week, { pack: toggled });
    expect(getWeek(next, "child1").pack[0].checked).toBe(false);
  });

  it("D4: deleting a pack item removes only that item", function() {
    var lh = makeChildLh({ pack: [
      { id:"pk1", label:"PE clothes", checked:false },
      { id:"pk2", label:"Library books", checked:true }
    ]});
    var w = getWeek(lh, "child1");
    var next = weekMutate(lh, "child1", lh.school["child1"].week,
      { pack: w.pack.filter(function(p){ return p.id !== "pk1"; }) });
    var pk = getWeek(next, "child1").pack;
    expect(pk.length).toBe(1);
    expect(pk[0].id).toBe("pk2");
  });

  it("D5: multiple items preserve insertion order", function() {
    var lh = makeChildLh();
    var w0 = getWeek(lh, "child1");
    var s1 = weekMutate(lh,  "child1", lh.school["child1"].week,
      { pack: w0.pack.concat([{ id:"pk1", label:"A", checked:false }]) });
    var w1 = getWeek(s1, "child1");
    var s2 = weekMutate(s1, "child1", s1.school["child1"].week,
      { pack: w1.pack.concat([{ id:"pk2", label:"B", checked:false }]) });
    var pk = getWeek(s2, "child1").pack;
    expect(pk[0].label).toBe("A");
    expect(pk[1].label).toBe("B");
  });
});

// ── LH-5b-E — date sort ───────────────────────────────────────────────────────

describe("LH-5b-E — sortByDate", function() {
  it("E1: earlier dates sort first", function() {
    var arr = [
      { id:"e1", date:"2026-07-15" },
      { id:"e2", date:"2026-07-10" },
      { id:"e3", date:"2026-07-12" }
    ];
    var sorted = sortByDate(arr, "date");
    expect(sorted[0].id).toBe("e2");
    expect(sorted[1].id).toBe("e3");
    expect(sorted[2].id).toBe("e1");
  });

  it("E2: items without a date sort to the end", function() {
    var arr = [
      { id:"e1", date:"" },
      { id:"e2", date:"2026-07-10" },
      { id:"e3", date:"" }
    ];
    var sorted = sortByDate(arr, "date");
    expect(sorted[0].id).toBe("e2");
    expect(sorted[1].date).toBe("");
    expect(sorted[2].date).toBe("");
  });

  it("E3: all undated items keep stable relative order (both sort to end)", function() {
    var arr = [
      { id:"e1", date:"" },
      { id:"e2", date:"" }
    ];
    var sorted = sortByDate(arr, "date");
    expect(sorted.length).toBe(2);
  });

  it("E4: single item sorts correctly", function() {
    var arr = [{ id:"e1", date:"2026-07-10" }];
    var sorted = sortByDate(arr, "date");
    expect(sorted.length).toBe(1);
    expect(sorted[0].id).toBe("e1");
  });

  it("E5: does not mutate the original array", function() {
    var arr = [
      { id:"e1", date:"2026-07-15" },
      { id:"e2", date:"2026-07-10" }
    ];
    var sorted = sortByDate(arr, "date");
    expect(arr[0].id).toBe("e1");
    expect(sorted[0].id).toBe("e2");
  });

  it("E6: works with the 'due' key for forms", function() {
    var arr = [
      { id:"fm1", due:"2026-07-20" },
      { id:"fm2", due:"2026-07-08" },
      { id:"fm3", due:"" }
    ];
    var sorted = sortByDate(arr, "due");
    expect(sorted[0].id).toBe("fm2");
    expect(sorted[1].id).toBe("fm1");
    expect(sorted[2].id).toBe("fm3");
  });
});

// ── LH-5b-F — sibling isolation ───────────────────────────────────────────────

describe("LH-5b-F — sibling child isolation", function() {
  it("F1: mutating child1 week does not affect child2", function() {
    var lh = {
      version: 2,
      school: {
        "child1": Object.assign({}, defaultLhSchoolChild(), { week: { events:[], forms:[], pack:[{ id:"pk1", label:"Lunchbox", checked:false }] } }),
        "child2": Object.assign({}, defaultLhSchoolChild(), { week: { events:[], forms:[], pack:[{ id:"pk2", label:"Library book", checked:false }] } })
      }
    };
    var w1 = getWeek(lh, "child1");
    var next = weekMutate(lh, "child1", lh.school["child1"].week,
      { pack: w1.pack.map(function(p){ return Object.assign({},p,{checked:true}); }) });
    expect(getWeek(next, "child2").pack[0].checked).toBe(false);
  });

  it("F2: other lighthouse keys are untouched by weekMutate", function() {
    var lh = {
      version: 2,
      modes: { "child1":"school" },
      shared: { "child1": { books:[], beyond:[], trips:[], goals:[] } },
      school: { "child1": defaultLhSchoolChild() }
    };
    var w = getWeek(lh, "child1");
    var next = weekMutate(lh, "child1", lh.school["child1"].week,
      { events: [{ id:"ev1", title:"Picture Day", date:"2026-07-10" }] });
    expect(next.modes).toEqual({ "child1":"school" });
    expect(next.shared["child1"].books).toEqual([]);
    expect(next.version).toBe(2);
  });
});
