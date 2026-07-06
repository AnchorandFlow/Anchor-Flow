// tests/unit/lighthouse-sync.test.js
// ★ LH-1 — af_lighthouse key registration and sanitize round-trip tests.
// ★ LH-2 — lhChildTabs pure logic: mode-aware tab set, acceptance criteria.
// Plumbing + shell tests. No UI, no React, no App.jsx import.
// (App.jsx has a module-scope IIFE that touches localStorage.)

import { describe, it, expect } from "vitest";
import { SYNC_KEYS, sanitizeHouseholdData } from "../../src/sync-core.js";

// Mirror of defaultLighthouse() from App.jsx (kept in sync manually).
// Tests must not import App.jsx — it has a module-scope IIFE that touches localStorage.
function defaultLighthouse() {
  return {
    version: 2,
    modes: {},
    shared: {},
    homeschool: {},
    school: {},
    household: { readAlouds: [], calendar: [], settings: {} }
  };
}

var FULL_BLOB = {
  version: 2,
  modes:      { "abc1234": "homeschool", "xyz5678": "school" },
  shared:     { "abc1234": { books: [{ id:"b1", title:"Charlotte's Web", status:"finished" }], beyond: [], trips: [], goals: [] } },
  homeschool: { "abc1234": { daily: { math: "done" }, weekly: {}, monthly: {}, loops: [] } },
  school:     { "xyz5678": { week: {}, homework: [{ id:"h1", subj:"Math", task:"p.42", due:"2026-07-07", status:"Not started", help: false }], comms: { contacts: [], log: [] }, grades: {} } },
  household:  { readAlouds: [{ id:"ra1", title:"Little House", status:"reading" }], calendar: [], settings: {} }
};

describe("LH-1-A — SYNC_KEYS registration", function() {
  it("LH-1-A1: SYNC_KEYS contains 'lighthouse' (plain, no af_ prefix)", function() {
    expect(SYNC_KEYS).toContain("lighthouse");
  });

  it("LH-1-A2: SYNC_KEYS does NOT contain 'af_lighthouse' (no double-prefix)", function() {
    expect(SYNC_KEYS).not.toContain("af_lighthouse");
    expect(SYNC_KEYS).not.toContain("af_af_lighthouse");
  });

  it("LH-1-A3: push loop key pattern — 'af_' + 'lighthouse' = 'af_lighthouse'", function() {
    // Documents the invariant: push loop does localStorage.getItem("af_" + k)
    var k = "lighthouse";
    expect("af_" + k).toBe("af_lighthouse");
  });
});

describe("LH-1-B — sanitizeHouseholdData round-trip", function() {
  it("LH-1-B1: full lighthouse blob survives sanitize unchanged", function() {
    var out = sanitizeHouseholdData({ lighthouse: FULL_BLOB });
    expect(out.lighthouse).toBeDefined();
    expect(out.lighthouse.version).toBe(2);
    expect(out.lighthouse.modes["abc1234"]).toBe("homeschool");
    expect(out.lighthouse.shared["abc1234"].books).toHaveLength(1);
    expect(out.lighthouse.homeschool["abc1234"].daily.math).toBe("done");
    expect(out.lighthouse.school["xyz5678"].homework).toHaveLength(1);
    expect(out.lighthouse.household.readAlouds).toHaveLength(1);
  });

  it("LH-1-B2: empty-object lighthouse passes (default shape)", function() {
    var out = sanitizeHouseholdData({ lighthouse: defaultLighthouse() });
    expect(out.lighthouse).toBeDefined();
    expect(out.lighthouse.version).toBe(2);
    expect(out.lighthouse.modes).toEqual({});
    expect(out.lighthouse.household.readAlouds).toEqual([]);
  });

  it("LH-1-B3: null lighthouse is dropped (not written as null)", function() {
    var out = sanitizeHouseholdData({ lighthouse: null });
    expect(out.lighthouse).toBeUndefined();
  });

  it("LH-1-B4: array lighthouse is rejected (not a valid shape)", function() {
    var out = sanitizeHouseholdData({ lighthouse: [] });
    expect(out.lighthouse).toBeUndefined();
  });

  it("LH-1-B5: string lighthouse is rejected", function() {
    var out = sanitizeHouseholdData({ lighthouse: "invalid" });
    expect(out.lighthouse).toBeUndefined();
  });

  it("LH-1-B6: sibling keys unaffected by bad lighthouse", function() {
    var out = sanitizeHouseholdData({ lighthouse: null, traditions: ["Christmas Eve"] });
    expect(out.lighthouse).toBeUndefined();
    expect(out.traditions).toEqual(["Christmas Eve"]);
  });

  it("LH-1-B7: nested child data survives round-trip intact", function() {
    var blob = {
      version: 2, modes: { "p1": "homeschool" },
      shared: { "p1": { books: [], beyond: [{ id:"bx1", what:"Museum", cat:"history" }], trips: [], goals: [] } },
      homeschool: { "p1": { daily: {}, weekly: {}, monthly: {}, loops: [{ id:"l1", name:"Morning", items: [] }] } },
      school: {}, household: { readAlouds: [], calendar: [], settings: {} }
    };
    var out = sanitizeHouseholdData({ lighthouse: blob });
    expect(out.lighthouse.shared["p1"].beyond[0].what).toBe("Museum");
    expect(out.lighthouse.homeschool["p1"].loops[0].name).toBe("Morning");
  });
});

describe("LH-1-C — defaultLighthouse shape", function() {
  it("LH-1-C1: returns correct top-level keys", function() {
    var d = defaultLighthouse();
    expect(d).toHaveProperty("version", 2);
    expect(d).toHaveProperty("modes");
    expect(d).toHaveProperty("shared");
    expect(d).toHaveProperty("homeschool");
    expect(d).toHaveProperty("school");
    expect(d).toHaveProperty("household");
  });

  it("LH-1-C2: household sub-keys are present and typed correctly", function() {
    var d = defaultLighthouse();
    expect(Array.isArray(d.household.readAlouds)).toBe(true);
    expect(Array.isArray(d.household.calendar)).toBe(true);
    expect(typeof d.household.settings).toBe("object");
  });

  it("LH-1-C3: each call returns a fresh object (no shared reference)", function() {
    var a = defaultLighthouse();
    var b = defaultLighthouse();
    a.modes["test"] = "homeschool";
    expect(b.modes).not.toHaveProperty("test");
  });

  it("LH-1-C4: full default blob passes sanitize", function() {
    var out = sanitizeHouseholdData({ lighthouse: defaultLighthouse() });
    expect(out.lighthouse).toBeDefined();
    expect(out.lighthouse.version).toBe(2);
  });
});

// ─── LH-2 — lhChildTabs pure logic ─────────────────────────────────────────
// Mirror of lhChildTabs() from App.jsx (kept in sync manually).
function lhChildTabs(modes, childId) {
  var SHARED = ["overview","books","beyond","trips","goals","summaries"];
  var mode = (modes && childId) ? (modes[childId] || null) : null;
  if (mode === "homeschool") return SHARED.concat(["plan","loops"]);
  if (mode === "school")     return SHARED.concat(["week","homework","comms","grades"]);
  return SHARED;
}

var SHARED_TABS = ["overview","books","beyond","trips","goals","summaries"];
var HS_ONLY     = ["plan","loops"];
var SCH_ONLY    = ["week","homework","comms","grades"];

describe("LH-2-A — homeschool child tab set", function() {
  var modes = { "p1": "homeschool" };

  it("LH-2-A1: homeschool includes all shared tabs", function() {
    var tabs = lhChildTabs(modes, "p1");
    SHARED_TABS.forEach(function(id) { expect(tabs).toContain(id); });
  });

  it("LH-2-A2: homeschool includes Plan and Loops", function() {
    var tabs = lhChildTabs(modes, "p1");
    expect(tabs).toContain("plan");
    expect(tabs).toContain("loops");
  });

  it("LH-2-A3: homeschool NEVER includes Homework (acceptance)", function() {
    var tabs = lhChildTabs(modes, "p1");
    expect(tabs).not.toContain("homework");
  });

  it("LH-2-A4: homeschool never includes any school-only tabs", function() {
    var tabs = lhChildTabs(modes, "p1");
    SCH_ONLY.forEach(function(id) { expect(tabs).not.toContain(id); });
  });
});

describe("LH-2-B — school child tab set", function() {
  var modes = { "p2": "school" };

  it("LH-2-B1: school includes all shared tabs", function() {
    var tabs = lhChildTabs(modes, "p2");
    SHARED_TABS.forEach(function(id) { expect(tabs).toContain(id); });
  });

  it("LH-2-B2: school includes This Week, Homework, Comms, Grades", function() {
    var tabs = lhChildTabs(modes, "p2");
    SCH_ONLY.forEach(function(id) { expect(tabs).toContain(id); });
  });

  it("LH-2-B3: school NEVER includes Loops (acceptance)", function() {
    var tabs = lhChildTabs(modes, "p2");
    expect(tabs).not.toContain("loops");
  });

  it("LH-2-B4: school never includes any homeschool-only tabs", function() {
    var tabs = lhChildTabs(modes, "p2");
    HS_ONLY.forEach(function(id) { expect(tabs).not.toContain(id); });
  });
});

describe("LH-2-C — mode switch preserves shared tabs (acceptance)", function() {
  it("LH-2-C1: switching from homeschool to school keeps all shared tabs", function() {
    var hsM  = { "p3": "homeschool" };
    var schM = { "p3": "school" };
    var hsTabs  = lhChildTabs(hsM, "p3");
    var schTabs = lhChildTabs(schM, "p3");
    SHARED_TABS.forEach(function(id) {
      expect(hsTabs).toContain(id);
      expect(schTabs).toContain(id);
    });
  });

  it("LH-2-C2: switching from school to homeschool keeps Books, Beyond, Trips, Goals", function() {
    var schM = { "p4": "school" };
    var hsM  = { "p4": "homeschool" };
    ["books","beyond","trips","goals"].forEach(function(id) {
      expect(lhChildTabs(schM, "p4")).toContain(id);
      expect(lhChildTabs(hsM,  "p4")).toContain(id);
    });
  });

  it("LH-2-C3: no mode set — only shared tabs returned", function() {
    var tabs = lhChildTabs({}, "p5");
    expect(tabs).toEqual(SHARED_TABS);
    HS_ONLY.concat(SCH_ONLY).forEach(function(id) { expect(tabs).not.toContain(id); });
  });

  it("LH-2-C4: null modes arg — only shared tabs (no crash)", function() {
    var tabs = lhChildTabs(null, "p6");
    expect(tabs).toEqual(SHARED_TABS);
  });

  it("LH-2-C5: null childId — only shared tabs (no crash)", function() {
    var tabs = lhChildTabs({"p7":"homeschool"}, null);
    expect(tabs).toEqual(SHARED_TABS);
  });
});

describe("LH-2-D — mixed household (two children, different modes)", function() {
  var modes = { "child_hs": "homeschool", "child_sc": "school" };

  it("LH-2-D1: homeschool child has Loops, not Homework", function() {
    var tabs = lhChildTabs(modes, "child_hs");
    expect(tabs).toContain("loops");
    expect(tabs).not.toContain("homework");
  });

  it("LH-2-D2: school child has Homework, not Loops", function() {
    var tabs = lhChildTabs(modes, "child_sc");
    expect(tabs).toContain("homework");
    expect(tabs).not.toContain("loops");
  });

  it("LH-2-D3: both children have Overview and Books", function() {
    expect(lhChildTabs(modes, "child_hs")).toContain("overview");
    expect(lhChildTabs(modes, "child_sc")).toContain("books");
  });
});

// ─── LH-3 — shared data helpers: lhAddItem / lhUpdateItem / lhDeleteItem ────
// Mirrors of the pure functions in App.jsx (kept in sync manually).
function lhGet3(o, k, d) { return o && o[k] != null ? o[k] : d; }

function lhAddItem(lh, childId, field, item) {
  var shared = Object.assign({}, lhGet3(lh, "shared", {}));
  var child  = Object.assign({}, shared[childId] || { books:[], beyond:[], trips:[], goals:[] });
  var list   = Array.isArray(child[field]) ? child[field].slice() : [];
  list.push(item);
  child[field] = list;
  shared[childId] = child;
  return Object.assign({}, lh, { shared: shared });
}

function lhUpdateItem(lh, childId, field, id, patch) {
  var shared = Object.assign({}, lhGet3(lh, "shared", {}));
  var child  = Object.assign({}, shared[childId] || {});
  var list   = Array.isArray(child[field]) ? child[field] : [];
  child[field] = list.map(function(it) { return it.id === id ? Object.assign({}, it, patch) : it; });
  shared[childId] = child;
  return Object.assign({}, lh, { shared: shared });
}

function lhDeleteItem(lh, childId, field, id) {
  var shared = Object.assign({}, lhGet3(lh, "shared", {}));
  var child  = Object.assign({}, shared[childId] || {});
  var list   = Array.isArray(child[field]) ? child[field] : [];
  child[field] = list.filter(function(it) { return it.id !== id; });
  shared[childId] = child;
  return Object.assign({}, lh, { shared: shared });
}

var BOOK_A = { id:"b1", title:"Charlotte's Web", status:"finished", rating:5, includeSummary:true };
var BOOK_B = { id:"b2", title:"Stuart Little",   status:"reading",  rating:3, includeSummary:false };
var BEYOND_A = { id:"bx1", what:"Museum visit", cat:"Museum", date:"2026-06-01", includeSummary:true };
var TRIP_A   = { id:"tr1", place:"Gettysburg", date:"2026-05-15", subj:["History"] };
var GOAL_A   = { id:"g1", cat:"Math", goal:"Master long division", progress:"In progress" };

describe("LH-3-A — lhAddItem", function() {
  it("LH-3-A1: adds a book to an empty child", function() {
    var lh = defaultLighthouse();
    var out = lhAddItem(lh, "c1", "books", BOOK_A);
    expect(out.shared["c1"].books).toHaveLength(1);
    expect(out.shared["c1"].books[0].title).toBe("Charlotte's Web");
  });

  it("LH-3-A2: appends to existing list", function() {
    var lh = defaultLighthouse();
    var lh2 = lhAddItem(lh,  "c1", "books", BOOK_A);
    var lh3 = lhAddItem(lh2, "c1", "books", BOOK_B);
    expect(lh3.shared["c1"].books).toHaveLength(2);
    expect(lh3.shared["c1"].books[1].title).toBe("Stuart Little");
  });

  it("LH-3-A3: does NOT affect a sibling child (isolation)", function() {
    var lh = defaultLighthouse();
    var lh2 = lhAddItem(lh, "c1", "books", BOOK_A);
    expect(lh2.shared["c2"]).toBeUndefined();
  });

  it("LH-3-A4: does NOT mutate the original lighthouse blob", function() {
    var lh = defaultLighthouse();
    lhAddItem(lh, "c1", "books", BOOK_A);
    expect(lhGet3(lh, "shared", {})).toEqual({});
  });

  it("LH-3-A5: works for beyond, trips, goals (same logic)", function() {
    var lh = defaultLighthouse();
    var lh2 = lhAddItem(lhAddItem(lhAddItem(lh, "c1", "beyond", BEYOND_A), "c1", "trips", TRIP_A), "c1", "goals", GOAL_A);
    expect(lh2.shared["c1"].beyond).toHaveLength(1);
    expect(lh2.shared["c1"].trips).toHaveLength(1);
    expect(lh2.shared["c1"].goals).toHaveLength(1);
  });

  it("LH-3-A6: other lighthouse layers (modes, homeschool, school) untouched", function() {
    var lh = Object.assign({}, defaultLighthouse(), { modes: { "c1": "homeschool" } });
    var out = lhAddItem(lh, "c1", "books", BOOK_A);
    expect(out.modes["c1"]).toBe("homeschool");
    expect(out.homeschool).toEqual({});
  });
});

describe("LH-3-B — lhUpdateItem", function() {
  it("LH-3-B1: updates only the matched item", function() {
    var lh = defaultLighthouse();
    var lh2 = lhAddItem(lhAddItem(lh, "c1", "books", BOOK_A), "c1", "books", BOOK_B);
    var lh3 = lhUpdateItem(lh2, "c1", "books", "b1", { rating: 4 });
    var books = lh3.shared["c1"].books;
    expect(books.find(function(b){return b.id==="b1";}).rating).toBe(4);
    expect(books.find(function(b){return b.id==="b2";}).rating).toBe(3);
  });

  it("LH-3-B2: non-matched items are preserved unchanged", function() {
    var lh = lhAddItem(defaultLighthouse(), "c1", "books", BOOK_A);
    var lh2 = lhUpdateItem(lh, "c1", "books", "NONEXISTENT", { title: "Ghost" });
    expect(lh2.shared["c1"].books[0].title).toBe("Charlotte's Web");
  });

  it("LH-3-B3: can toggle includeSummary", function() {
    var lh = lhAddItem(defaultLighthouse(), "c1", "books", BOOK_A);
    var lh2 = lhUpdateItem(lh, "c1", "books", "b1", { includeSummary: false });
    expect(lh2.shared["c1"].books[0].includeSummary).toBe(false);
  });

  it("LH-3-B4: does NOT mutate the original blob", function() {
    var lh = lhAddItem(defaultLighthouse(), "c1", "books", BOOK_A);
    lhUpdateItem(lh, "c1", "books", "b1", { rating: 1 });
    expect(lh.shared["c1"].books[0].rating).toBe(5);
  });
});

describe("LH-3-C — lhDeleteItem", function() {
  it("LH-3-C1: removes the matched item", function() {
    var lh = lhAddItem(lhAddItem(defaultLighthouse(), "c1", "books", BOOK_A), "c1", "books", BOOK_B);
    var lh2 = lhDeleteItem(lh, "c1", "books", "b1");
    var books = lh2.shared["c1"].books;
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe("b2");
  });

  it("LH-3-C2: deleting non-existent id is a no-op", function() {
    var lh = lhAddItem(defaultLighthouse(), "c1", "books", BOOK_A);
    var lh2 = lhDeleteItem(lh, "c1", "books", "GHOST");
    expect(lh2.shared["c1"].books).toHaveLength(1);
  });

  it("LH-3-C3: does NOT affect sibling child", function() {
    var lh  = lhAddItem(defaultLighthouse(), "c1", "books", BOOK_A);
    var lh2 = lhAddItem(lh, "c2", "books", BOOK_B);
    var lh3 = lhDeleteItem(lh2, "c1", "books", "b1");
    expect(lh3.shared["c1"].books).toHaveLength(0);
    expect(lh3.shared["c2"].books).toHaveLength(1);
  });

  it("LH-3-C4: does NOT mutate original blob", function() {
    var lh = lhAddItem(defaultLighthouse(), "c1", "books", BOOK_A);
    lhDeleteItem(lh, "c1", "books", "b1");
    expect(lh.shared["c1"].books).toHaveLength(1);
  });
});

describe("LH-3-D — mode-agnostic: shared data identical for both modes (acceptance)", function() {
  it("LH-3-D1: books array is the same regardless of child mode", function() {
    var lh = Object.assign({}, defaultLighthouse(), { modes: { "c1":"homeschool", "c2":"school" } });
    var lh2 = lhAddItem(lhAddItem(lh, "c1", "books", BOOK_A), "c2", "books", BOOK_B);
    expect(lh2.shared["c1"].books[0].title).toBe("Charlotte's Web");
    expect(lh2.shared["c2"].books[0].title).toBe("Stuart Little");
  });

  it("LH-3-D2: beyond tab label differs by mode (LH_LABELS coverage)", function() {
    var LH_LABELS = {
      beyond:    { homeschool: "Beyond the Transcript", school: "Beyond the Classroom" },
      summaries: { homeschool: "Summaries",             school: "Keepsakes" }
    };
    expect(LH_LABELS.beyond.homeschool).not.toBe(LH_LABELS.beyond.school);
    expect(LH_LABELS.summaries.homeschool).not.toBe(LH_LABELS.summaries.school);
  });

  it("LH-3-D3: include-in-summary can be toggled independently per child", function() {
    var lh  = lhAddItem(defaultLighthouse(), "c1", "books", BOOK_A);
    var lh2 = lhAddItem(lh, "c2", "books", Object.assign({}, BOOK_A, { id:"b_c2", includeSummary:false }));
    var lh3 = lhUpdateItem(lh2, "c1", "books", "b1", { includeSummary: false });
    expect(lh3.shared["c1"].books[0].includeSummary).toBe(false);
    expect(lh3.shared["c2"].books[0].includeSummary).toBe(false);
    expect(lh2.shared["c1"].books[0].includeSummary).toBe(true);
  });

  it("LH-3-D4: all four shared fields survive a chain of adds (homeschool child)", function() {
    var lh = Object.assign({}, defaultLighthouse(), { modes: { "hs": "homeschool" } });
    var lh2 = lhAddItem(lhAddItem(lhAddItem(lhAddItem(lh,
      "hs","books",BOOK_A),
      "hs","beyond",BEYOND_A),
      "hs","trips",TRIP_A),
      "hs","goals",GOAL_A
    );
    expect(lh2.shared["hs"].books).toHaveLength(1);
    expect(lh2.shared["hs"].beyond).toHaveLength(1);
    expect(lh2.shared["hs"].trips).toHaveLength(1);
    expect(lh2.shared["hs"].goals).toHaveLength(1);
  });

  it("LH-3-D5: all four shared fields survive a chain of adds (school child)", function() {
    var lh = Object.assign({}, defaultLighthouse(), { modes: { "sc": "school" } });
    var lh2 = lhAddItem(lhAddItem(lhAddItem(lhAddItem(lh,
      "sc","books",BOOK_A),
      "sc","beyond",BEYOND_A),
      "sc","trips",TRIP_A),
      "sc","goals",GOAL_A
    );
    expect(lh2.shared["sc"].books).toHaveLength(1);
    expect(lh2.shared["sc"].beyond).toHaveLength(1);
    expect(lh2.shared["sc"].trips).toHaveLength(1);
    expect(lh2.shared["sc"].goals).toHaveLength(1);
  });
});

// ─── LH-4 — homeschool layer helpers + loop logic ───────────────────────────
// Mirrors of module-scope helpers in App.jsx.
function defaultLhHsChild() {
  return { daily: { Mon:"", Tue:"", Wed:"", Thu:"", Fri:"" }, weekly: [], monthly: "", loops: [] };
}
function lhGet4(o, k, d) { return o && o[k] != null ? o[k] : d; }

function lhHsPatch(lh, childId, patch) {
  var hs = Object.assign({}, lhGet4(lh, "homeschool", {}));
  hs[childId] = Object.assign({}, hs[childId] || defaultLhHsChild(), patch);
  return Object.assign({}, lh, { homeschool: hs });
}
function lhHsLoopUpdate(lh, childId, loopId, loopPatch) {
  var hs    = Object.assign({}, lhGet4(lh, "homeschool", {}));
  var child = Object.assign({}, hs[childId] || defaultLhHsChild());
  var loops = Array.isArray(child.loops) ? child.loops : [];
  child.loops = loops.map(function(l) { return l.id === loopId ? Object.assign({}, l, loopPatch) : l; });
  hs[childId] = child;
  return Object.assign({}, lh, { homeschool: hs });
}
function lhHsLoopItemUpdate(lh, childId, loopId, itemId, itemPatch) {
  var hs    = Object.assign({}, lhGet4(lh, "homeschool", {}));
  var child = Object.assign({}, hs[childId] || defaultLhHsChild());
  var loops = Array.isArray(child.loops) ? child.loops : [];
  child.loops = loops.map(function(l) {
    if (l.id !== loopId) return l;
    var items = Array.isArray(l.items) ? l.items : [];
    return Object.assign({}, l, { items: items.map(function(it) {
      return it.id === itemId ? Object.assign({}, it, itemPatch) : it;
    })});
  });
  hs[childId] = child;
  return Object.assign({}, lh, { homeschool: hs });
}
function lhCycleStatus(status) {
  if (status === "todo")  return "done";
  if (status === "done")  return "skip";
  if (status === "skip")  return "later";
  return "todo";
}
function lhUpNext(items) {
  if (!Array.isArray(items)) return null;
  for (var i = 0; i < items.length; i++) {
    if (items[i].status === "todo" || items[i].status === "later") return items[i];
  }
  return null;
}

var LOOP_1 = {
  id:"loop1", name:"Morning Loop", icon:"📚", tint:"#7a9e8e",
  items:[
    {id:"i1", text:"Bible",      status:"todo",  note:""},
    {id:"i2", text:"Math",       status:"done",  note:""},
    {id:"i3", text:"Reading",    status:"skip",  note:""},
    {id:"i4", text:"Narration",  status:"later", note:"saved for afternoon"},
    {id:"i5", text:"Nature",     status:"todo",  note:""},
  ]
};

describe("LH-4-A — lhHsPatch (daily/weekly/monthly)", function() {
  it("LH-4-A1: patches daily for target child", function() {
    var lh = defaultLighthouse();
    var lh2 = lhHsPatch(lh, "c1", { daily: { Mon:"Math, Reading", Tue:"Science", Wed:"", Thu:"", Fri:"" } });
    expect(lh2.homeschool["c1"].daily.Mon).toBe("Math, Reading");
    expect(lh2.homeschool["c1"].daily.Tue).toBe("Science");
  });

  it("LH-4-A2: patch does NOT affect sibling child", function() {
    var lh  = lhHsPatch(defaultLighthouse(), "c1", { monthly: "Finish phonics" });
    var lh2 = lhHsPatch(lh, "c2", { monthly: "Start chapter books" });
    expect(lh2.homeschool["c1"].monthly).toBe("Finish phonics");
    expect(lh2.homeschool["c2"].monthly).toBe("Start chapter books");
  });

  it("LH-4-A3: patch does NOT mutate the original blob", function() {
    var lh = defaultLighthouse();
    lhHsPatch(lh, "c1", { monthly: "Focus" });
    expect(lhGet4(lh, "homeschool", {})).toEqual({});
  });

  it("LH-4-A4: shared layer is untouched by hs patch", function() {
    var lh = lhAddItem(defaultLighthouse(), "c1", "books", BOOK_A);
    var lh2 = lhHsPatch(lh, "c1", { monthly: "Finish phonics" });
    expect(lh2.shared["c1"].books).toHaveLength(1);
  });

  it("LH-4-A5: weekly subjects added to correct child", function() {
    var subj = { id:"s1", subject:"Math", days:["Mon","Wed","Fri"], note:"30 min" };
    var lh = lhHsPatch(defaultLighthouse(), "c1", { weekly: [subj] });
    expect(lh.homeschool["c1"].weekly).toHaveLength(1);
    expect(lh.homeschool["c1"].weekly[0].days).toContain("Wed");
  });
});

describe("LH-4-B — lhHsLoopUpdate", function() {
  function baseWithLoop() {
    return lhHsPatch(defaultLighthouse(), "c1", { loops: [Object.assign({}, LOOP_1)] });
  }

  it("LH-4-B1: updates the matched loop name", function() {
    var lh = lhHsLoopUpdate(baseWithLoop(), "c1", "loop1", { name: "Afternoon Loop" });
    expect(lh.homeschool["c1"].loops[0].name).toBe("Afternoon Loop");
  });

  it("LH-4-B2: non-matched loop is unchanged", function() {
    var loop2 = { id:"loop2", name:"Evening", icon:"⭐", tint:"#6A9BB5", items:[] };
    var lh  = lhHsPatch(defaultLighthouse(), "c1", { loops: [Object.assign({},LOOP_1), loop2] });
    var lh2 = lhHsLoopUpdate(lh, "c1", "loop1", { name:"Renamed" });
    expect(lh2.homeschool["c1"].loops[1].name).toBe("Evening");
  });

  it("LH-4-B3: reset-rotation sets all items to todo", function() {
    var lh = baseWithLoop();
    var resetItems = LOOP_1.items.map(function(it){ return Object.assign({},it,{status:"todo"}); });
    var lh2 = lhHsLoopUpdate(lh, "c1", "loop1", { items: resetItems });
    lh2.homeschool["c1"].loops[0].items.forEach(function(it) {
      expect(it.status).toBe("todo");
    });
  });

  it("LH-4-B4: does NOT mutate original blob", function() {
    var lh = baseWithLoop();
    lhHsLoopUpdate(lh, "c1", "loop1", { name:"X" });
    expect(lh.homeschool["c1"].loops[0].name).toBe("Morning Loop");
  });
});

describe("LH-4-C — lhHsLoopItemUpdate", function() {
  function baseWithLoop() {
    return lhHsPatch(defaultLighthouse(), "c1", { loops: [Object.assign({}, LOOP_1, { items: LOOP_1.items.slice() })] });
  }

  it("LH-4-C1: marks item done", function() {
    var lh = lhHsLoopItemUpdate(baseWithLoop(), "c1", "loop1", "i1", { status:"done" });
    var item = lh.homeschool["c1"].loops[0].items.find(function(it){return it.id==="i1";});
    expect(item.status).toBe("done");
  });

  it("LH-4-C2: other items are unchanged", function() {
    var lh = lhHsLoopItemUpdate(baseWithLoop(), "c1", "loop1", "i1", { status:"done" });
    var item = lh.homeschool["c1"].loops[0].items.find(function(it){return it.id==="i2";});
    expect(item.status).toBe("done");
    var item3 = lh.homeschool["c1"].loops[0].items.find(function(it){return it.id==="i3";});
    expect(item3.status).toBe("skip");
  });

  it("LH-4-C3: adds a note to an item", function() {
    var lh = lhHsLoopItemUpdate(baseWithLoop(), "c1", "loop1", "i1", { note:"Do with flashcards" });
    var item = lh.homeschool["c1"].loops[0].items.find(function(it){return it.id==="i1";});
    expect(item.note).toBe("Do with flashcards");
  });

  it("LH-4-C4: does NOT mutate original blob", function() {
    var lh = baseWithLoop();
    lhHsLoopItemUpdate(lh, "c1", "loop1", "i1", { status:"done" });
    var item = lh.homeschool["c1"].loops[0].items.find(function(it){return it.id==="i1";});
    expect(item.status).toBe("todo");
  });
});

describe("LH-4-D — lhCycleStatus (todo→done→skip→later→todo)", function() {
  it("LH-4-D1: todo → done", function() { expect(lhCycleStatus("todo")).toBe("done"); });
  it("LH-4-D2: done → skip", function() { expect(lhCycleStatus("done")).toBe("skip"); });
  it("LH-4-D3: skip → later", function() { expect(lhCycleStatus("skip")).toBe("later"); });
  it("LH-4-D4: later → todo", function() { expect(lhCycleStatus("later")).toBe("todo"); });
  it("LH-4-D5: unknown value defaults to todo", function() { expect(lhCycleStatus("bad")).toBe("todo"); });
  it("LH-4-D6: full cycle returns to start", function() {
    var s = "todo";
    s = lhCycleStatus(s); s = lhCycleStatus(s); s = lhCycleStatus(s); s = lhCycleStatus(s);
    expect(s).toBe("todo");
  });
});

describe("LH-4-E — lhUpNext (first todo or later item)", function() {
  it("LH-4-E1: returns first todo item", function() {
    var items = [{id:"a",status:"todo"},{id:"b",status:"todo"}];
    expect(lhUpNext(items).id).toBe("a");
  });

  it("LH-4-E2: skips done and skip, returns next todo", function() {
    var items = [{id:"a",status:"done"},{id:"b",status:"skip"},{id:"c",status:"todo"}];
    expect(lhUpNext(items).id).toBe("c");
  });

  it("LH-4-E3: returns a 'later' item when no todo remains", function() {
    var items = [{id:"a",status:"done"},{id:"b",status:"later"},{id:"c",status:"done"}];
    expect(lhUpNext(items).id).toBe("b");
  });

  it("LH-4-E4: returns null when all items are done or skip", function() {
    var items = [{id:"a",status:"done"},{id:"b",status:"skip"}];
    expect(lhUpNext(items)).toBeNull();
  });

  it("LH-4-E5: returns null for empty array", function() {
    expect(lhUpNext([])).toBeNull();
  });

  it("LH-4-E6: returns null for non-array (defensive)", function() {
    expect(lhUpNext(null)).toBeNull();
    expect(lhUpNext(undefined)).toBeNull();
  });

  it("LH-4-E7: LOOP_1 fixture — up next is i1 (first todo)", function() {
    expect(lhUpNext(LOOP_1.items).id).toBe("i1");
  });

  it("LH-4-E8: after marking i1 done, up next is i4 (later) skipping done/skip", function() {
    var items = LOOP_1.items.map(function(it){ return it.id==="i1" ? Object.assign({},it,{status:"done"}) : it; });
    // i1=done, i2=done, i3=skip, i4=later, i5=todo → first todo/later is i4
    expect(lhUpNext(items).id).toBe("i4");
  });
});
