// tests/unit/lighthouse-sync.test.js
// ★ LH-1 — af_lighthouse key registration and sanitize round-trip tests.
// Plumbing only: no UI, no React. Guards the four-location registration
// (SYNC_KEYS, _SANITIZE_HANDLED, sanitize body guard, PLAUSIBLE fixture).

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
