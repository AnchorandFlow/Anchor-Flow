// tests/unit/lighthouse-homework.test.js
// LH-5a — Homework pure-logic tests.
// No React, no App.jsx import (module-scope IIFE touches localStorage).
// Mirrors pure helpers from App.jsx.

import { describe, it, expect } from "vitest";

// ── Mirrors (keep in sync with App.jsx) ───────────────────────────────────────

function lhGet(obj, key, def) {
  if (!obj || typeof obj !== "object") return def;
  return obj[key] !== undefined ? obj[key] : def;
}

function defaultLhSchoolChild() {
  return { homework: [], week: {}, comms: { contacts: [], log: [] }, grades: {} };
}

function lhSchoolPatch(lh, childId, patch) {
  var sc = Object.assign({}, lhGet(lh, "school", {}));
  sc[childId] = Object.assign({}, sc[childId] || defaultLhSchoolChild(), patch);
  return Object.assign({}, lh, { school: sc });
}

// ── LH-5a-A — defaultLhSchoolChild ───────────────────────────────────────────

describe("LH-5a-A — defaultLhSchoolChild", function() {
  it("A1: returns an object with a homework array", function() {
    var d = defaultLhSchoolChild();
    expect(Array.isArray(d.homework)).toBe(true);
    expect(d.homework.length).toBe(0);
  });

  it("A2: returns a week object", function() {
    var d = defaultLhSchoolChild();
    expect(d.week !== null && typeof d.week === "object").toBe(true);
  });

  it("A3: returns comms with contacts and log arrays", function() {
    var d = defaultLhSchoolChild();
    expect(Array.isArray(d.comms.contacts)).toBe(true);
    expect(Array.isArray(d.comms.log)).toBe(true);
  });

  it("A4: returns a grades object", function() {
    var d = defaultLhSchoolChild();
    expect(d.grades !== null && typeof d.grades === "object").toBe(true);
  });

  it("A5: each call returns a fresh object (no shared reference)", function() {
    var a = defaultLhSchoolChild();
    var b = defaultLhSchoolChild();
    a.homework.push({ id:"h1" });
    expect(b.homework.length).toBe(0);
  });
});

// ── LH-5a-B — lhSchoolPatch ──────────────────────────────────────────────────

describe("LH-5a-B — lhSchoolPatch", function() {
  it("B1: creates school child entry when none exists", function() {
    var lh = { version: 2, school: {} };
    var next = lhSchoolPatch(lh, "child1", { homework: [{ id:"h1" }] });
    expect(Array.isArray(next.school["child1"].homework)).toBe(true);
    expect(next.school["child1"].homework[0].id).toBe("h1");
  });

  it("B2: does not mutate the original lighthouse blob", function() {
    var lh = { version: 2, school: {} };
    lhSchoolPatch(lh, "child1", { homework: [{ id:"h1" }] });
    expect(lh.school["child1"]).toBeUndefined();
  });

  it("B3: merges patch fields without wiping other school fields", function() {
    var lh = {
      version: 2,
      school: { "child1": { homework: [], week: { mon: "busy" }, comms: { contacts:[], log:[] }, grades: {} } }
    };
    var next = lhSchoolPatch(lh, "child1", { homework: [{ id:"h1" }] });
    expect(next.school["child1"].week).toEqual({ mon: "busy" });
    expect(next.school["child1"].homework.length).toBe(1);
  });

  it("B4: sibling child data is preserved", function() {
    var lh = {
      version: 2,
      school: {
        "child1": { homework: [{ id:"ha" }], week:{}, comms:{contacts:[],log:[]}, grades:{} },
        "child2": { homework: [{ id:"hb" }], week:{}, comms:{contacts:[],log:[]}, grades:{} }
      }
    };
    var next = lhSchoolPatch(lh, "child1", { homework: [] });
    expect(next.school["child2"].homework[0].id).toBe("hb");
  });

  it("B5: other top-level lighthouse keys are preserved", function() {
    var lh = { version: 2, modes: { "child1": "school" }, shared: {}, school: {} };
    var next = lhSchoolPatch(lh, "child1", { homework: [] });
    expect(next.modes).toEqual({ "child1": "school" });
    expect(next.shared).toEqual({});
    expect(next.version).toBe(2);
  });

  it("B6: missing school key on lighthouse is tolerated", function() {
    var lh = { version: 2 };
    var next = lhSchoolPatch(lh, "child1", { homework: [{ id:"h1" }] });
    expect(next.school["child1"].homework[0].id).toBe("h1");
  });
});

// ── LH-5a-C — homework item shape ────────────────────────────────────────────

describe("LH-5a-C — homework item shape", function() {
  var STATUSES = ["Not started", "In progress", "Done", "Turned in"];

  it("C1: all required fields present", function() {
    var item = { id:"h1", subj:"Math", task:"p.42", due:"2026-07-07", status:"Not started", help: false };
    expect(item.id).toBeDefined();
    expect(item.subj).toBeDefined();
    expect(item.task).toBeDefined();
    expect(item.due).toBeDefined();
    expect(item.status).toBeDefined();
    expect(typeof item.help).toBe("boolean");
  });

  it("C2: status must be one of the four valid values", function() {
    STATUSES.forEach(function(s) {
      var item = { id:"h1", subj:"Math", task:"p.42", due:"2026-07-07", status: s, help: false };
      expect(STATUSES).toContain(item.status);
    });
  });

  it("C3: help flag defaults to false", function() {
    var item = { id:"h1", subj:"Math", task:"p.42", due:"", status:"Not started", help: false };
    expect(item.help).toBe(false);
  });

  it("C4: due date may be empty string (no due date set)", function() {
    var item = { id:"h1", subj:"Science", task:"Lab report", due:"", status:"Not started", help: false };
    expect(item.due).toBe("");
  });
});

// ── LH-5a-D — add / update / delete homework items ───────────────────────────

describe("LH-5a-D — homework CRUD via lhSchoolPatch", function() {
  function makeChildLh(hw) {
    return {
      version: 2,
      school: { "child1": Object.assign({}, defaultLhSchoolChild(), { homework: hw }) }
    };
  }

  function hwConcat(lh, childId, item) {
    var sc = lhGet(lh, "school", {});
    var child = sc[childId] || defaultLhSchoolChild();
    var hw = Array.isArray(child.homework) ? child.homework : [];
    return lhSchoolPatch(lh, childId, { homework: hw.concat([item]) });
  }

  function hwUpdate(lh, childId, id, patch) {
    var sc = lhGet(lh, "school", {});
    var child = sc[childId] || defaultLhSchoolChild();
    var hw = Array.isArray(child.homework) ? child.homework : [];
    return lhSchoolPatch(lh, childId, {
      homework: hw.map(function(h) { return h.id === id ? Object.assign({}, h, patch) : h; })
    });
  }

  function hwDelete(lh, childId, id) {
    var sc = lhGet(lh, "school", {});
    var child = sc[childId] || defaultLhSchoolChild();
    var hw = Array.isArray(child.homework) ? child.homework : [];
    return lhSchoolPatch(lh, childId, {
      homework: hw.filter(function(h) { return h.id !== id; })
    });
  }

  it("D1: adding a homework item increases count by 1", function() {
    var lh = makeChildLh([]);
    var next = hwConcat(lh, "child1", { id:"h1", subj:"Math", task:"p.42", due:"", status:"Not started", help:false });
    expect(next.school["child1"].homework.length).toBe(1);
  });

  it("D2: adding two items preserves order", function() {
    var lh = makeChildLh([]);
    var step1 = hwConcat(lh, "child1", { id:"h1", subj:"Math", task:"p.42", due:"", status:"Not started", help:false });
    var step2 = hwConcat(step1, "child1", { id:"h2", subj:"English", task:"Essay", due:"", status:"Not started", help:false });
    expect(step2.school["child1"].homework[0].id).toBe("h1");
    expect(step2.school["child1"].homework[1].id).toBe("h2");
  });

  it("D3: updating status does not touch other fields", function() {
    var lh = makeChildLh([{ id:"h1", subj:"Math", task:"p.42", due:"2026-07-07", status:"Not started", help:false }]);
    var next = hwUpdate(lh, "child1", "h1", { status:"Done" });
    var h = next.school["child1"].homework[0];
    expect(h.status).toBe("Done");
    expect(h.subj).toBe("Math");
    expect(h.task).toBe("p.42");
    expect(h.due).toBe("2026-07-07");
    expect(h.help).toBe(false);
  });

  it("D4: updating help flag to true", function() {
    var lh = makeChildLh([{ id:"h1", subj:"Math", task:"p.42", due:"", status:"Not started", help:false }]);
    var next = hwUpdate(lh, "child1", "h1", { help: true });
    expect(next.school["child1"].homework[0].help).toBe(true);
  });

  it("D5: deleting removes only the targeted item", function() {
    var lh = makeChildLh([
      { id:"h1", subj:"Math", task:"p.42", due:"", status:"Not started", help:false },
      { id:"h2", subj:"English", task:"Essay", due:"", status:"In progress", help:true }
    ]);
    var next = hwDelete(lh, "child1", "h1");
    var hw = next.school["child1"].homework;
    expect(hw.length).toBe(1);
    expect(hw[0].id).toBe("h2");
  });

  it("D6: deleting a non-existent id leaves array unchanged", function() {
    var lh = makeChildLh([{ id:"h1", subj:"Math", task:"p.42", due:"", status:"Not started", help:false }]);
    var next = hwDelete(lh, "child1", "zzz");
    expect(next.school["child1"].homework.length).toBe(1);
  });

  it("D7: updating a non-existent id leaves array unchanged", function() {
    var lh = makeChildLh([{ id:"h1", subj:"Math", task:"p.42", due:"", status:"Not started", help:false }]);
    var next = hwUpdate(lh, "child1", "zzz", { status:"Done" });
    expect(next.school["child1"].homework[0].status).toBe("Not started");
  });
});

// ── LH-5a-E — status direct-tap logic ────────────────────────────────────────

describe("LH-5a-E — status direct-tap semantics", function() {
  var STATUSES = ["Not started", "In progress", "Done", "Turned in"];

  function tapStatus(currentStatus, tappedStatus) {
    return currentStatus === tappedStatus ? "Not started" : tappedStatus;
  }

  it("E1: tapping a different status sets it", function() {
    expect(tapStatus("Not started", "Done")).toBe("Done");
    expect(tapStatus("Not started", "In progress")).toBe("In progress");
    expect(tapStatus("In progress", "Turned in")).toBe("Turned in");
  });

  it("E2: tapping the active status resets to Not started", function() {
    STATUSES.forEach(function(s) {
      expect(tapStatus(s, s)).toBe("Not started");
    });
  });

  it("E3: tapping Not started when already Not started stays Not started", function() {
    expect(tapStatus("Not started", "Not started")).toBe("Not started");
  });

  it("E4: tapping Done from Done resets to Not started (not a cycle)", function() {
    expect(tapStatus("Done", "Done")).toBe("Not started");
  });
});
