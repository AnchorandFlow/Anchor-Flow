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
