// tests/unit/lighthouse-grades.test.js
// LH-5d — Grades & Growth pure-logic tests.
// No React, no App.jsx import (module-scope IIFE touches localStorage).
// Mirrors pure helpers from App.jsx.

import { describe, it, expect } from "vitest";

// ── Mirrors (keep in sync with App.jsx) ───────────────────────────────────────

function lhGet(obj, key, def) {
  if (!obj || typeof obj !== "object") return def;
  return obj[key] !== undefined ? obj[key] : def;
}

function defaultLhSchoolChild() {
  return {
    homework: [],
    week: { events: [], forms: [], pack: [] },
    comms: { contacts: [], log: [] },
    grades: { marks: [], scores: [], notes: "" }
  };
}

function lhSchoolPatch(lh, childId, patch) {
  var sc = Object.assign({}, lhGet(lh, "school", {}));
  sc[childId] = Object.assign({}, sc[childId] || defaultLhSchoolChild(), patch);
  return Object.assign({}, lh, { school: sc });
}

function gradesMutate(lh, childId, gradesData, p) {
  return lhSchoolPatch(lh, childId, { grades: Object.assign({}, gradesData, p) });
}

var MARK_OPTIONS = ["Exceeding", "Meeting", "Approaching", "Strength"];

function makeChildLh(gradesOverride) {
  var grades = Object.assign({ marks: [], scores: [], notes: "" }, gradesOverride || {});
  return {
    version: 2,
    school: { "child1": Object.assign({}, defaultLhSchoolChild(), { grades: grades }) }
  };
}

function getGrades(lh, childId) {
  var sc   = lhGet(lh, "school", {});
  var child = sc[childId] || defaultLhSchoolChild();
  var g    = (child.grades && typeof child.grades === "object") ? child.grades : {};
  return {
    marks:  Array.isArray(g.marks)  ? g.marks  : [],
    scores: Array.isArray(g.scores) ? g.scores : [],
    notes:  typeof g.notes === "string" ? g.notes : "",
  };
}

// ── LH-5d-A — defaultLhSchoolChild grades shape ───────────────────────────────

describe("LH-5d-A — grades defaults", function() {
  it("A1: grades has marks, scores, notes", function() {
    var d = defaultLhSchoolChild();
    expect(Array.isArray(d.grades.marks)).toBe(true);
    expect(Array.isArray(d.grades.scores)).toBe(true);
    expect(typeof d.grades.notes).toBe("string");
  });

  it("A2: marks and scores start empty, notes is empty string", function() {
    var d = defaultLhSchoolChild();
    expect(d.grades.marks.length).toBe(0);
    expect(d.grades.scores.length).toBe(0);
    expect(d.grades.notes).toBe("");
  });

  it("A3: old grades:{} normalised gracefully by guards", function() {
    var old = {};
    var marks  = Array.isArray(old.marks)  ? old.marks  : [];
    var scores = Array.isArray(old.scores) ? old.scores : [];
    var notes  = typeof old.notes === "string" ? old.notes : "";
    expect(marks).toEqual([]);
    expect(scores).toEqual([]);
    expect(notes).toBe("");
  });

  it("A4: gradesMutate does not mutate original blob", function() {
    var lh = makeChildLh();
    gradesMutate(lh, "child1", lh.school["child1"].grades,
      { marks: [{ id:"m1", subject:"Math", mark:"Meeting" }] });
    expect(getGrades(lh, "child1").marks.length).toBe(0);
  });
});

// ── LH-5d-B — mark options ────────────────────────────────────────────────────

describe("LH-5d-B — mark options", function() {
  it("B1: MARK_OPTIONS has exactly four values", function() {
    expect(MARK_OPTIONS.length).toBe(4);
  });

  it("B2: MARK_OPTIONS contains all four expected labels", function() {
    expect(MARK_OPTIONS).toContain("Exceeding");
    expect(MARK_OPTIONS).toContain("Meeting");
    expect(MARK_OPTIONS).toContain("Approaching");
    expect(MARK_OPTIONS).toContain("Strength");
  });
});

// ── LH-5d-C — subject marks CRUD ─────────────────────────────────────────────

describe("LH-5d-C — subject marks add / edit / delete", function() {
  it("C1: adding a mark increases count by 1", function() {
    var lh = makeChildLh();
    var g  = getGrades(lh, "child1");
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades,
      { marks: g.marks.concat([{ id:"m1", subject:"Math", mark:"Meeting" }]) });
    expect(getGrades(next, "child1").marks.length).toBe(1);
  });

  it("C2: mark fields stored correctly", function() {
    var lh = makeChildLh();
    var g  = getGrades(lh, "child1");
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades,
      { marks: g.marks.concat([{ id:"m1", subject:"Reading", mark:"Exceeding" }]) });
    var m = getGrades(next, "child1").marks[0];
    expect(m.subject).toBe("Reading");
    expect(m.mark).toBe("Exceeding");
  });

  it("C3: all four mark options can be stored", function() {
    var lh = makeChildLh();
    var g  = getGrades(lh, "child1");
    var items = MARK_OPTIONS.map(function(m, i){
      return { id:"m"+i, subject:"Subject "+i, mark:m };
    });
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades, { marks: items });
    var marks = getGrades(next, "child1").marks;
    expect(marks.length).toBe(4);
    MARK_OPTIONS.forEach(function(m){
      expect(marks.some(function(r){ return r.mark === m; })).toBe(true);
    });
  });

  it("C4: editing a mark row patches only that row", function() {
    var lh = makeChildLh({ marks: [
      { id:"m1", subject:"Math",    mark:"Meeting" },
      { id:"m2", subject:"Science", mark:"Exceeding" }
    ]});
    var g  = getGrades(lh, "child1");
    var updated = g.marks.map(function(r){
      return r.id === "m1" ? Object.assign({},r,{mark:"Exceeding"}) : r;
    });
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades, { marks: updated });
    var marks = getGrades(next, "child1").marks;
    expect(marks.find(function(r){ return r.id==="m1"; }).mark).toBe("Exceeding");
    expect(marks.find(function(r){ return r.id==="m2"; }).mark).toBe("Exceeding");
    expect(marks.find(function(r){ return r.id==="m2"; }).subject).toBe("Science");
  });

  it("C5: deleting a mark removes only that row", function() {
    var lh = makeChildLh({ marks: [
      { id:"m1", subject:"Math",    mark:"Meeting" },
      { id:"m2", subject:"Science", mark:"Exceeding" }
    ]});
    var g  = getGrades(lh, "child1");
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades,
      { marks: g.marks.filter(function(r){ return r.id !== "m1"; }) });
    var marks = getGrades(next, "child1").marks;
    expect(marks.length).toBe(1);
    expect(marks[0].id).toBe("m2");
  });

  it("C6: mutating marks does not affect scores or notes", function() {
    var lh = makeChildLh({
      marks:  [],
      scores: [{ id:"s1", label:"Reading level", value:"R" }],
      notes:  "Doing great!"
    });
    var g  = getGrades(lh, "child1");
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades,
      { marks: [{ id:"m1", subject:"Math", mark:"Meeting" }] });
    var out = getGrades(next, "child1");
    expect(out.scores.length).toBe(1);
    expect(out.notes).toBe("Doing great!");
  });
});

// ── LH-5d-D — scores & assessments CRUD ──────────────────────────────────────

describe("LH-5d-D — scores add / edit / delete", function() {
  it("D1: adding a score increases count by 1", function() {
    var lh = makeChildLh();
    var g  = getGrades(lh, "child1");
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades,
      { scores: g.scores.concat([{ id:"s1", label:"Reading level", value:"R" }]) });
    expect(getGrades(next, "child1").scores.length).toBe(1);
  });

  it("D2: score label and value stored correctly", function() {
    var lh = makeChildLh();
    var g  = getGrades(lh, "child1");
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades,
      { scores: g.scores.concat([{ id:"s1", label:"Spelling", value:"18/20" }]) });
    var sc = getGrades(next, "child1").scores[0];
    expect(sc.label).toBe("Spelling");
    expect(sc.value).toBe("18/20");
  });

  it("D3: value is free text — accepts any format", function() {
    var values = ["R", "18/20", "95 wpm", "Level 3", "4/4", "Advanced"];
    values.forEach(function(v, i) {
      var lh   = makeChildLh();
      var g    = getGrades(lh, "child1");
      var next = gradesMutate(lh, "child1", lh.school["child1"].grades,
        { scores: [{ id:"s"+i, label:"Test", value:v }] });
      expect(getGrades(next, "child1").scores[0].value).toBe(v);
    });
  });

  it("D4: editing a score patches only that score", function() {
    var lh = makeChildLh({ scores: [
      { id:"s1", label:"Reading level", value:"Q" },
      { id:"s2", label:"Fluency",       value:"80 wpm" }
    ]});
    var g  = getGrades(lh, "child1");
    var updated = g.scores.map(function(s){
      return s.id==="s1" ? Object.assign({},s,{value:"R"}) : s;
    });
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades, { scores: updated });
    var scores = getGrades(next, "child1").scores;
    expect(scores.find(function(s){ return s.id==="s1"; }).value).toBe("R");
    expect(scores.find(function(s){ return s.id==="s2"; }).value).toBe("80 wpm");
  });

  it("D5: deleting a score removes only that score", function() {
    var lh = makeChildLh({ scores: [
      { id:"s1", label:"Reading level", value:"R" },
      { id:"s2", label:"Spelling",      value:"18/20" }
    ]});
    var g  = getGrades(lh, "child1");
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades,
      { scores: g.scores.filter(function(s){ return s.id !== "s1"; }) });
    var scores = getGrades(next, "child1").scores;
    expect(scores.length).toBe(1);
    expect(scores[0].id).toBe("s2");
  });

  it("D6: mutating scores does not affect marks or notes", function() {
    var lh = makeChildLh({
      marks:  [{ id:"m1", subject:"Math", mark:"Meeting" }],
      scores: [],
      notes:  "Growing steadily."
    });
    var g  = getGrades(lh, "child1");
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades,
      { scores: [{ id:"s1", label:"Reading level", value:"R" }] });
    var out = getGrades(next, "child1");
    expect(out.marks.length).toBe(1);
    expect(out.notes).toBe("Growing steadily.");
  });
});

// ── LH-5d-E — growth notes ────────────────────────────────────────────────────

describe("LH-5d-E — growth notes", function() {
  it("E1: notes stored as a string", function() {
    var lh   = makeChildLh();
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades,
      { notes: "Loves reading, growing in confidence with math." });
    expect(getGrades(next, "child1").notes).toBe("Loves reading, growing in confidence with math.");
  });

  it("E2: notes can be updated (replace old value)", function() {
    var lh   = makeChildLh({ notes: "Old note." });
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades, { notes: "New note." });
    expect(getGrades(next, "child1").notes).toBe("New note.");
  });

  it("E3: notes can be cleared to empty string", function() {
    var lh   = makeChildLh({ notes: "Some note." });
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades, { notes: "" });
    expect(getGrades(next, "child1").notes).toBe("");
  });

  it("E4: updating notes does not affect marks or scores", function() {
    var lh = makeChildLh({
      marks:  [{ id:"m1", subject:"Math", mark:"Meeting" }],
      scores: [{ id:"s1", label:"Fluency", value:"90 wpm" }],
      notes:  ""
    });
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades, { notes: "Strong quarter." });
    var out  = getGrades(next, "child1");
    expect(out.marks.length).toBe(1);
    expect(out.scores.length).toBe(1);
    expect(out.notes).toBe("Strong quarter.");
  });
});

// ── LH-5d-F — sibling and field isolation ─────────────────────────────────────

describe("LH-5d-F — sibling isolation", function() {
  it("F1: mutating child1 grades does not affect child2", function() {
    var lh = {
      version: 2,
      school: {
        "child1": Object.assign({}, defaultLhSchoolChild()),
        "child2": Object.assign({}, defaultLhSchoolChild(), {
          grades: { marks: [{ id:"m9", subject:"Art", mark:"Strength" }], scores: [], notes: "" }
        })
      }
    };
    var g    = getGrades(lh, "child1");
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades,
      { marks: [{ id:"m1", subject:"Math", mark:"Meeting" }] });
    expect(getGrades(next, "child2").marks[0].subject).toBe("Art");
  });

  it("F2: other lighthouse keys untouched by gradesMutate", function() {
    var lh = {
      version: 2,
      modes: { "child1":"school" },
      shared: {},
      school: { "child1": defaultLhSchoolChild() }
    };
    var next = gradesMutate(lh, "child1", lh.school["child1"].grades,
      { marks: [{ id:"m1", subject:"Math", mark:"Meeting" }] });
    expect(next.modes).toEqual({ "child1":"school" });
    expect(next.version).toBe(2);
  });
});
