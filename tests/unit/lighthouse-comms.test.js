// tests/unit/lighthouse-comms.test.js
// LH-5c — School Comms pure-logic tests.
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

function commsMutate(lh, childId, commsData, p) {
  return lhSchoolPatch(lh, childId, { comms: Object.assign({}, commsData, p) });
}

function sortedLog(entries) {
  return entries.slice().sort(function(a, b) {
    var da = a.date; var db = b.date;
    if (!da && !db) return 0;
    if (!da) return -1;
    if (!db) return 1;
    return da > db ? -1 : da < db ? 1 : 0;
  });
}

function makeChildLh(commsOverride) {
  var comms = Object.assign({ contacts: [], log: [] }, commsOverride || {});
  return {
    version: 2,
    school: { "child1": Object.assign({}, defaultLhSchoolChild(), { comms: comms }) }
  };
}

function getComms(lh, childId) {
  var sc = lhGet(lh, "school", {});
  var child = sc[childId] || defaultLhSchoolChild();
  var commsData = (child.comms && typeof child.comms === "object") ? child.comms : {};
  return {
    contacts: Array.isArray(commsData.contacts) ? commsData.contacts : [],
    log:      Array.isArray(commsData.log)      ? commsData.log      : [],
  };
}

// ── LH-5c-A — comms data defaults ─────────────────────────────────────────────

describe("LH-5c-A — comms data defaults", function() {
  it("A1: defaultLhSchoolChild has comms with contacts and log arrays", function() {
    var d = defaultLhSchoolChild();
    expect(Array.isArray(d.comms.contacts)).toBe(true);
    expect(Array.isArray(d.comms.log)).toBe(true);
  });

  it("A2: contacts and log start empty", function() {
    var d = defaultLhSchoolChild();
    expect(d.comms.contacts.length).toBe(0);
    expect(d.comms.log.length).toBe(0);
  });

  it("A3: old comms:{} normalised gracefully by guards", function() {
    var old = {};
    var contacts = Array.isArray(old.contacts) ? old.contacts : [];
    var log      = Array.isArray(old.log)      ? old.log      : [];
    expect(contacts).toEqual([]);
    expect(log).toEqual([]);
  });

  it("A4: commsMutate does not mutate original blob", function() {
    var lh = makeChildLh();
    commsMutate(lh, "child1", lh.school["child1"].comms,
      { contacts: [{ id:"c1", name:"Ms. Hill", role:"Teacher" }] });
    expect(getComms(lh, "child1").contacts.length).toBe(0);
  });
});

// ── LH-5c-B — contact CRUD ────────────────────────────────────────────────────

describe("LH-5c-B — contact add / edit / delete", function() {
  it("B1: adding a contact increases count by 1", function() {
    var lh = makeChildLh();
    var c = getComms(lh, "child1");
    var next = commsMutate(lh, "child1", lh.school["child1"].comms,
      { contacts: c.contacts.concat([{ id:"c1", name:"Ms. Hill", role:"Teacher" }]) });
    expect(getComms(next, "child1").contacts.length).toBe(1);
  });

  it("B2: contact name and role are stored correctly", function() {
    var lh = makeChildLh();
    var c = getComms(lh, "child1");
    var next = commsMutate(lh, "child1", lh.school["child1"].comms,
      { contacts: c.contacts.concat([{ id:"c1", name:"Nurse Patel", role:"Nurse" }]) });
    var ct = getComms(next, "child1").contacts[0];
    expect(ct.name).toBe("Nurse Patel");
    expect(ct.role).toBe("Nurse");
  });

  it("B3: role is optional (empty string)", function() {
    var lh = makeChildLh();
    var c = getComms(lh, "child1");
    var next = commsMutate(lh, "child1", lh.school["child1"].comms,
      { contacts: c.contacts.concat([{ id:"c1", name:"Main office", role:"" }]) });
    expect(getComms(next, "child1").contacts[0].role).toBe("");
  });

  it("B4: editing a contact patches only that contact", function() {
    var lh = makeChildLh({ contacts: [
      { id:"c1", name:"Ms. Hill",   role:"Teacher" },
      { id:"c2", name:"Mr. Garcia", role:"Coach" }
    ]});
    var c = getComms(lh, "child1");
    var updated = c.contacts.map(function(ct){
      return ct.id === "c1" ? Object.assign({},ct,{name:"Ms. Hill (Math)",role:"Math Teacher"}) : ct;
    });
    var next = commsMutate(lh, "child1", lh.school["child1"].comms, { contacts: updated });
    var cts = getComms(next, "child1").contacts;
    expect(cts.find(function(ct){ return ct.id==="c1"; }).name).toBe("Ms. Hill (Math)");
    expect(cts.find(function(ct){ return ct.id==="c2"; }).name).toBe("Mr. Garcia");
  });

  it("B5: deleting a contact removes only that contact", function() {
    var lh = makeChildLh({ contacts: [
      { id:"c1", name:"Ms. Hill",   role:"Teacher" },
      { id:"c2", name:"Mr. Garcia", role:"Coach" }
    ]});
    var c = getComms(lh, "child1");
    var next = commsMutate(lh, "child1", lh.school["child1"].comms,
      { contacts: c.contacts.filter(function(ct){ return ct.id !== "c1"; }) });
    var cts = getComms(next, "child1").contacts;
    expect(cts.length).toBe(1);
    expect(cts[0].id).toBe("c2");
  });

  it("B6: deleting non-existent id leaves array unchanged", function() {
    var lh = makeChildLh({ contacts: [{ id:"c1", name:"Ms. Hill", role:"Teacher" }] });
    var c = getComms(lh, "child1");
    var next = commsMutate(lh, "child1", lh.school["child1"].comms,
      { contacts: c.contacts.filter(function(ct){ return ct.id !== "zzz"; }) });
    expect(getComms(next, "child1").contacts.length).toBe(1);
  });

  it("B7: mutating contacts does not affect log", function() {
    var lh = makeChildLh({
      contacts: [],
      log: [{ id:"e1", date:"2026-07-01", who:"Ms. Hill", subject:"Progress", note:"", action:"", actionDone:false }]
    });
    var c = getComms(lh, "child1");
    var next = commsMutate(lh, "child1", lh.school["child1"].comms,
      { contacts: [{ id:"c1", name:"Ms. Hill", role:"Teacher" }] });
    expect(getComms(next, "child1").log.length).toBe(1);
  });
});

// ── LH-5c-C — log entry CRUD ──────────────────────────────────────────────────

describe("LH-5c-C — log entry add / edit / delete", function() {
  it("C1: adding a log entry increases count", function() {
    var lh = makeChildLh();
    var c = getComms(lh, "child1");
    var entry = { id:"e1", date:"2026-07-01", who:"Ms. Hill", subject:"Progress check", note:"Going well.", action:"", actionDone:false };
    var next = commsMutate(lh, "child1", lh.school["child1"].comms,
      { log: c.log.concat([entry]) });
    expect(getComms(next, "child1").log.length).toBe(1);
  });

  it("C2: log entry fields are stored correctly", function() {
    var lh = makeChildLh();
    var c = getComms(lh, "child1");
    var entry = { id:"e1", date:"2026-07-01", who:"Principal", subject:"Schedule change", note:"Early release Friday.", action:"Send note to work", actionDone:false };
    var next = commsMutate(lh, "child1", lh.school["child1"].comms, { log: c.log.concat([entry]) });
    var e = getComms(next, "child1").log[0];
    expect(e.who).toBe("Principal");
    expect(e.subject).toBe("Schedule change");
    expect(e.note).toBe("Early release Friday.");
    expect(e.action).toBe("Send note to work");
    expect(e.actionDone).toBe(false);
  });

  it("C3: action and note are optional (empty string)", function() {
    var lh = makeChildLh();
    var c = getComms(lh, "child1");
    var entry = { id:"e1", date:"2026-07-01", who:"Ms. Hill", subject:"Quick hello", note:"", action:"", actionDone:false };
    var next = commsMutate(lh, "child1", lh.school["child1"].comms, { log: c.log.concat([entry]) });
    var e = getComms(next, "child1").log[0];
    expect(e.note).toBe("");
    expect(e.action).toBe("");
  });

  it("C4: editing an entry patches only that entry", function() {
    var lh = makeChildLh({ log: [
      { id:"e1", date:"2026-07-01", who:"Ms. Hill",   subject:"Math",    note:"", action:"", actionDone:false },
      { id:"e2", date:"2026-07-02", who:"Mr. Garcia", subject:"Recess",  note:"", action:"", actionDone:false }
    ]});
    var c = getComms(lh, "child1");
    var updated = c.log.map(function(e){
      return e.id==="e1" ? Object.assign({},e,{subject:"Math test results"}) : e;
    });
    var next = commsMutate(lh, "child1", lh.school["child1"].comms, { log: updated });
    var entries = getComms(next, "child1").log;
    expect(entries.find(function(e){ return e.id==="e1"; }).subject).toBe("Math test results");
    expect(entries.find(function(e){ return e.id==="e2"; }).subject).toBe("Recess");
  });

  it("C5: deleting an entry removes only that entry", function() {
    var lh = makeChildLh({ log: [
      { id:"e1", date:"2026-07-01", who:"Ms. Hill",   subject:"Math",   note:"", action:"", actionDone:false },
      { id:"e2", date:"2026-07-02", who:"Mr. Garcia", subject:"Recess", note:"", action:"", actionDone:false }
    ]});
    var c = getComms(lh, "child1");
    var next = commsMutate(lh, "child1", lh.school["child1"].comms,
      { log: c.log.filter(function(e){ return e.id !== "e1"; }) });
    var entries = getComms(next, "child1").log;
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBe("e2");
  });
});

// ── LH-5c-D — action item toggle ──────────────────────────────────────────────

describe("LH-5c-D — action item done toggle", function() {
  it("D1: toggling actionDone from false to true", function() {
    var lh = makeChildLh({ log: [
      { id:"e1", date:"2026-07-01", who:"Ms. Hill", subject:"Homework", note:"", action:"Sign reading log", actionDone:false }
    ]});
    var c = getComms(lh, "child1");
    var toggled = c.log.map(function(e){ return e.id==="e1" ? Object.assign({},e,{actionDone:!e.actionDone}) : e; });
    var next = commsMutate(lh, "child1", lh.school["child1"].comms, { log: toggled });
    expect(getComms(next, "child1").log[0].actionDone).toBe(true);
  });

  it("D2: toggling actionDone from true back to false", function() {
    var lh = makeChildLh({ log: [
      { id:"e1", date:"2026-07-01", who:"Ms. Hill", subject:"Homework", note:"", action:"Sign reading log", actionDone:true }
    ]});
    var c = getComms(lh, "child1");
    var toggled = c.log.map(function(e){ return e.id==="e1" ? Object.assign({},e,{actionDone:!e.actionDone}) : e; });
    var next = commsMutate(lh, "child1", lh.school["child1"].comms, { log: toggled });
    expect(getComms(next, "child1").log[0].actionDone).toBe(false);
  });

  it("D3: toggling one entry does not touch sibling entries", function() {
    var lh = makeChildLh({ log: [
      { id:"e1", date:"2026-07-01", who:"A", subject:"A", note:"", action:"Do A", actionDone:false },
      { id:"e2", date:"2026-07-02", who:"B", subject:"B", note:"", action:"Do B", actionDone:false }
    ]});
    var c = getComms(lh, "child1");
    var toggled = c.log.map(function(e){ return e.id==="e1" ? Object.assign({},e,{actionDone:true}) : e; });
    var next = commsMutate(lh, "child1", lh.school["child1"].comms, { log: toggled });
    var entries = getComms(next, "child1").log;
    expect(entries.find(function(e){ return e.id==="e1"; }).actionDone).toBe(true);
    expect(entries.find(function(e){ return e.id==="e2"; }).actionDone).toBe(false);
  });

  it("D4: an empty action field is treated as no action item", function() {
    var action = "";
    var hasAction = action && action.trim() !== "";
    expect(hasAction).toBeFalsy();
  });

  it("D5: a whitespace-only action is treated as no action item", function() {
    var action = "   ";
    var hasAction = action && action.trim() !== "";
    expect(hasAction).toBeFalsy();
  });
});

// ── LH-5c-E — log sort (undated first, then newest) ───────────────────────────

describe("LH-5c-E — log sort order", function() {
  it("E1: most recent dated entry sorts first", function() {
    var entries = [
      { id:"e1", date:"2026-06-01" },
      { id:"e2", date:"2026-07-10" },
      { id:"e3", date:"2026-07-05" }
    ];
    var sorted = sortedLog(entries);
    expect(sorted[0].id).toBe("e2");
    expect(sorted[1].id).toBe("e3");
    expect(sorted[2].id).toBe("e1");
  });

  it("E2: undated entries float to the top", function() {
    var entries = [
      { id:"e1", date:"2026-07-01" },
      { id:"e2", date:"" },
      { id:"e3", date:"2026-07-10" }
    ];
    var sorted = sortedLog(entries);
    expect(sorted[0].id).toBe("e2");
  });

  it("E3: multiple undated entries all float to top", function() {
    var entries = [
      { id:"e1", date:"2026-07-01" },
      { id:"e2", date:"" },
      { id:"e3", date:"" }
    ];
    var sorted = sortedLog(entries);
    expect(sorted[0].date).toBe("");
    expect(sorted[1].date).toBe("");
    expect(sorted[2].id).toBe("e1");
  });

  it("E4: all dated entries — newest first", function() {
    var entries = [
      { id:"e1", date:"2026-06-15" },
      { id:"e2", date:"2026-07-01" },
      { id:"e3", date:"2026-06-01" }
    ];
    var sorted = sortedLog(entries);
    expect(sorted[0].id).toBe("e2");
    expect(sorted[2].id).toBe("e3");
  });

  it("E5: does not mutate the original array", function() {
    var entries = [
      { id:"e1", date:"2026-07-01" },
      { id:"e2", date:"2026-07-10" }
    ];
    sortedLog(entries);
    expect(entries[0].id).toBe("e1");
  });

  it("E6: single entry sorts correctly", function() {
    var entries = [{ id:"e1", date:"2026-07-01" }];
    var sorted = sortedLog(entries);
    expect(sorted.length).toBe(1);
    expect(sorted[0].id).toBe("e1");
  });
});

// ── LH-5c-F — sibling and field isolation ─────────────────────────────────────

describe("LH-5c-F — sibling isolation and field preservation", function() {
  it("F1: mutating child1 comms does not affect child2", function() {
    var lh = {
      version: 2,
      school: {
        "child1": Object.assign({}, defaultLhSchoolChild(), { comms: { contacts:[], log:[] } }),
        "child2": Object.assign({}, defaultLhSchoolChild(), { comms: { contacts:[{ id:"c9", name:"Ms. Reed", role:"Teacher" }], log:[] } })
      }
    };
    var c = getComms(lh, "child1");
    var next = commsMutate(lh, "child1", lh.school["child1"].comms,
      { contacts: c.contacts.concat([{ id:"c1", name:"Ms. Hill", role:"Teacher" }]) });
    expect(getComms(next, "child2").contacts[0].name).toBe("Ms. Reed");
  });

  it("F2: mutating contacts preserves log", function() {
    var lh = makeChildLh({
      contacts: [],
      log: [{ id:"e1", date:"2026-07-01", who:"Ms. Hill", subject:"Hi", note:"", action:"", actionDone:false }]
    });
    var c = getComms(lh, "child1");
    var next = commsMutate(lh, "child1", lh.school["child1"].comms,
      { contacts: [{ id:"c1", name:"Ms. Hill", role:"Teacher" }] });
    expect(getComms(next, "child1").log.length).toBe(1);
  });

  it("F3: mutating log preserves contacts", function() {
    var lh = makeChildLh({
      contacts: [{ id:"c1", name:"Ms. Hill", role:"Teacher" }],
      log: []
    });
    var c = getComms(lh, "child1");
    var next = commsMutate(lh, "child1", lh.school["child1"].comms,
      { log: [{ id:"e1", date:"2026-07-01", who:"Ms. Hill", subject:"Hi", note:"", action:"", actionDone:false }] });
    expect(getComms(next, "child1").contacts.length).toBe(1);
  });

  it("F4: other lighthouse keys untouched", function() {
    var lh = {
      version: 2,
      modes: { "child1":"school" },
      shared: {},
      school: { "child1": defaultLhSchoolChild() }
    };
    var next = commsMutate(lh, "child1", lh.school["child1"].comms,
      { contacts: [{ id:"c1", name:"Ms. Hill", role:"Teacher" }] });
    expect(next.modes).toEqual({ "child1":"school" });
    expect(next.version).toBe(2);
  });
});
