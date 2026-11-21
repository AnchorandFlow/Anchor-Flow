// School type per child (src/lib/schoolType.js): the five types, what each
// shows in Lighthouse, data never hidden on a switch ("More"), defaults for
// existing kids, and the choice syncing between household members.
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { SCHOOL_TYPES, SCHOOL_TYPES_SETTINGS, schoolTypeToMode, schoolTypeLabel, cleanSchoolLabel, lhSections, childMode, defaultSchoolType } from "../../src/lib/schoolType.js";
import { sanitizeHouseholdData, applyHouseholdKey, SYNC_KEYS } from "../../src/sync-core.js";

describe("types", function () {
  it("Homeschool · Public school · Private school · Hybrid / co-op · Other; Settings also keeps Preschool and Not school-age", function () {
    expect(SCHOOL_TYPES.map(function (t) { return t.label; })).toEqual(["Homeschool", "Public school", "Private school", "Hybrid / co-op", "Other"]);
    expect(SCHOOL_TYPES_SETTINGS.map(function (t) { return t.value; })).toEqual(["homeschool", "public", "private", "hybrid", "other", "preschool", "none"]);
  });
  it("modes and labels; Other shows its own short label", function () {
    expect(["homeschool", "public", "private", "hybrid", "other", "preschool", "none", undefined].map(schoolTypeToMode)).toEqual(["homeschool", "school", "school", "hybrid", "other", "preschool", null, null]);
    expect(schoolTypeLabel({ schoolType: "other", schoolLabel: "Forest school" })).toBe("Forest school");
    expect(schoolTypeLabel({ schoolType: "other" })).toBe("Other");
    expect(schoolTypeLabel({ schoolType: "private" })).toBe("Private school");
    expect(cleanSchoolLabel("  Online   academy that is far too long for a pill  ")).toBe("Online academy that is far too");
    expect(childMode({ id: "a", schoolType: "hybrid" }, { a: "homeschool" })).toBe("hybrid"); // the person wins
    expect(childMode({ id: "a" }, { a: "school" })).toBe("school");
  });
});

describe("what each type shows", function () {
  function none() { return false; }
  it("Homeschool: lessons, curriculum, attendance/hours, portfolio, records", function () {
    expect(lhSections("plan", "homeschool", none).shown).toEqual(["today", "week", "month", "year", "loops"]);
    expect(lhSections("records", "homeschool", none).shown).toEqual(["umbrella", "activities", "teachers", "notes"]);
    expect(lhSections("growth", "homeschool", none).shown).toEqual(["attendance", "goals", "portfolio", "breakgoals"]);
  });
  it("Public/Private: school info, teachers, schedule/events, comms, homework, report cards", function () {
    expect(lhSections("records", "school", none).shown).toEqual(["schoolinfo", "teachers", "events", "comms", "homework", "notes"]);
    expect(lhSections("growth", "school", none).shown).toEqual(["attendance", "grades", "goals", "breakgoals"]);
    expect(lhSections("plan", "school", none).shown).toEqual(["today", "week"]);
  });
  it("Hybrid shows both; Other the basics + notes", function () {
    var h = lhSections("records", "hybrid", none).shown;
    ["schoolinfo", "umbrella", "activities", "teachers", "events", "comms", "homework", "notes"].forEach(function (id) { expect(h).toContain(id); });
    expect(lhSections("growth", "hybrid", none).shown).toEqual(["attendance", "grades", "goals", "portfolio", "breakgoals"]);
    expect(lhSections("records", "other", none).shown).toEqual(["notes"]);
    expect(lhSections("growth", "other", none).shown).toEqual(["goals", "breakgoals"]);
  });
  it("switching never hides data: sections with data the new type doesn't show go under More", function () {
    var has = { umbrella: true, portfolio: true, loops: true, grades: true };
    function h(id) { return !!has[id]; }
    expect(lhSections("records", "school", h).more).toEqual(["umbrella"]);
    expect(lhSections("growth", "school", h).more).toEqual(["portfolio"]);
    expect(lhSections("plan", "school", h).more).toEqual(["loops"]);
    expect(lhSections("growth", "homeschool", h).more).toEqual(["grades"]);
    expect(lhSections("records", "other", h).more).toEqual(["umbrella"]);
    expect(lhSections("growth", "hybrid", h).more).toEqual([]); // hybrid already shows both
  });
});

describe("existing kids", function () {
  it("keep their old setting; no setting → the older school data, else Homeschool; Not school-age stays", function () {
    expect(defaultSchoolType({ schoolType: "public" }, "homeschool")).toBe("public");
    expect(defaultSchoolType({ schoolType: "none" }, "homeschool")).toBe("none");
    expect(defaultSchoolType({}, "private")).toBe("private");
    expect(defaultSchoolType({}, "none")).toBe("homeschool");
    expect(defaultSchoolType({}, undefined)).toBe("homeschool");
  });
});

describe("two household members", function () {
  beforeEach(function () { localStorage.clear(); });
  it("a child's school type (and Other's label) reaches the other member's device", function () {
    expect(SYNC_KEYS).toContain("people");
    var lindsey = [{ id: "p_jun", name: "June", schoolType: "hybrid" }, { id: "p_oll", name: "Ollie", schoolType: "other", schoolLabel: "Forest school" }];
    var clean = sanitizeHouseholdData(JSON.parse(JSON.stringify({ people: lindsey })));
    applyHouseholdKey("people", clean.people);
    var twyla = JSON.parse(localStorage.getItem("af_people"));
    expect(twyla.map(function (p) { return schoolTypeLabel(p); })).toEqual(["Hybrid / co-op", "Forest school"]);
    expect(twyla.map(function (p) { return schoolTypeToMode(p.schoolType); })).toEqual(["hybrid", "other"]);
  });
});

describe("wiring", function () {
  var app = fs.readFileSync("src/App.jsx", "utf8");
  var ob = fs.readFileSync("src/onboarding/Onboarding.jsx", "utf8");
  it("Lighthouse derives the mode from the person and writes both on a change; the old one-way switch is flag-off only", function () {
    expect(app).toContain("var childMode = activeChild ? ((REDESIGN && childPerson && schoolTypeToLhMode(childPerson.schoolType)) || modes[activeChild] || null) : null;");
    expect(app).toContain("function setChildSchoolType(type, label) {");
    expect(app).toContain('{!REDESIGN && <button onClick={function(){ setMode(childMode==="homeschool"?"school":"homeschool"); }}');
    expect(app).toContain("schoolTypes={RD_SCHOOL_TYPES} onSchoolType={setChildSchoolType}");
  });
  it("Settings › School and onboarding offer the new types in the new look; flag off unchanged", function () {
    expect(app).toContain("var SCHOOL_TYPES = REDESIGN ? RD_SCHOOL_TYPES_SETTINGS : [");
    expect(ob).toContain("(K.redesign ? RD_SCHOOL_TYPE_OPTIONS : SCHOOL_TYPE_OPTIONS).map(");
    expect(ob).toContain("{ value: 'hybrid',     label: 'Hybrid / co-op', emoji: '🤝' },");
    expect(ob).toContain("if (p.schoolType === 'other' && p.schoolLabel && String(p.schoolLabel).trim()) { person.schoolLabel");
    expect(app).toContain('if (p.schoolType === "other" && p.schoolLabel) shaped.schoolLabel = cleanSchoolLabel(p.schoolLabel);');
  });
});
