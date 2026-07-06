/**
 * Suite D — Birthday age derivation tests.
 *
 * ageFromBirthday() lives in App.jsx (module-level) and cannot be imported
 * without triggering the startup IIFE. Tests are written as inline reimplementations
 * of the same logic, verifying the invariants the function must satisfy.
 * This is the same proxy pattern used for B-suite protocol tests.
 */

import { describe, it, expect } from "vitest";

// Inline replica of App.jsx ageFromBirthday — same logic, testable without React mount.
function ageFromBirthday(birthday) {
  if (!birthday) return null;
  var parts = String(birthday).split("-");
  if (parts.length !== 3) return null;
  var by = parseInt(parts[0], 10); var bm = parseInt(parts[1], 10) - 1; var bd = parseInt(parts[2], 10);
  if (isNaN(by) || isNaN(bm) || isNaN(bd)) return null;
  var t = new Date(); var age = t.getFullYear() - by;
  var md = t.getMonth() - bm;
  if (md < 0 || (md === 0 && t.getDate() < bd)) age--;
  return age >= 0 ? age : null;
}
function personAge(p) { return p && p.birthday ? ageFromBirthday(p.birthday) : (p && p.age != null ? p.age : null); }
function personIsMinor(p) { var a = personAge(p); return a !== null && a < 18; }

describe("D1 — ageFromBirthday: age derivation from ISO date string", () => {
  it("returns null for null/undefined input", () => {
    expect(ageFromBirthday(null)).toBeNull();
    expect(ageFromBirthday(undefined)).toBeNull();
    expect(ageFromBirthday("")).toBeNull();
  });

  it("returns null for invalid format", () => {
    expect(ageFromBirthday("not-a-date")).toBeNull(); // parts.length < 3 after split
    expect(ageFromBirthday("2000/01/01")).toBeNull(); // slash-delimited → split("-") gives 1 part
    expect(ageFromBirthday("birthday")).toBeNull();   // non-numeric parts → NaN
  });

  it("returns a non-negative integer for a valid past birthday", () => {
    var thirtyYearsAgo = (new Date().getFullYear() - 30) + "-06-15";
    var age = ageFromBirthday(thirtyYearsAgo);
    expect(typeof age).toBe("number");
    expect(age).toBeGreaterThanOrEqual(29);
    expect(age).toBeLessThanOrEqual(30);
  });

  it("returns null for future birthdays", () => {
    var future = (new Date().getFullYear() + 5) + "-01-01";
    expect(ageFromBirthday(future)).toBeNull();
  });

  it("correctly accounts for whether birthday has passed this year", () => {
    var now = new Date();
    // Birthday that has already passed this year
    var passedThisYear = now.getFullYear() - 10 + "-01-01"; // Jan 1, assuming today is not Jan 1
    var notYetThisYear = now.getFullYear() - 10 + "-12-31"; // Dec 31, assuming today is not Dec 31
    var passedAge = ageFromBirthday(passedThisYear);
    var notYetAge = ageFromBirthday(notYetThisYear);
    // Passed birthday: age should be 10 if we're past Jan 1 this year
    // Not-yet birthday: age should be 9 (birthday not reached yet this year, if today < Dec 31)
    if (now.getMonth() > 0) { // After January
      expect(passedAge).toBe(10);
    }
    if (now.getMonth() < 11) { // Before December
      expect(notYetAge).toBe(9);
    }
  });
});

describe("D2 — personAge: birthday-derived age takes priority over legacy age field", () => {
  it("returns birthday-derived age when birthday is set", () => {
    var thirtyYearsAgo = (new Date().getFullYear() - 30) + "-06-15";
    var p = { birthday: thirtyYearsAgo, age: 25 }; // age field is stale
    var age = personAge(p);
    expect(age).toBeGreaterThanOrEqual(29);
    expect(age).toBeLessThanOrEqual(30);
    expect(age).not.toBe(25); // legacy age should not win
  });

  it("falls back to age field when birthday is null", () => {
    var p = { birthday: null, age: 7 };
    expect(personAge(p)).toBe(7);
  });

  it("returns null when both are missing", () => {
    expect(personAge({ name: "Alice" })).toBeNull();
    expect(personAge(null)).toBeNull();
  });
});

describe("D3 — personIsMinor: minor detection from birthday or legacy age", () => {
  it("identifies minor via birthday", () => {
    var tenYearsAgo = (new Date().getFullYear() - 10) + "-06-15";
    var kid = { birthday: tenYearsAgo };
    expect(personIsMinor(kid)).toBe(true);
  });

  it("identifies adult via birthday", () => {
    var thirtyYearsAgo = (new Date().getFullYear() - 30) + "-06-15";
    var adult = { birthday: thirtyYearsAgo };
    expect(personIsMinor(adult)).toBe(false);
  });

  it("falls back to legacy age for migration (no birthday set)", () => {
    expect(personIsMinor({ age: 8 })).toBe(true);
    expect(personIsMinor({ age: 35 })).toBe(false);
  });

  it("returns false when both birthday and age are missing (safe default)", () => {
    expect(personIsMinor({ name: "Unknown" })).toBe(false);
  });

  it("migration: person with legacy age=5 and no birthday is correctly identified as minor", () => {
    var legacyKid = { name: "Sam", age: 5, role: "Kid", isMinor: true };
    expect(personIsMinor(legacyKid)).toBe(true);
  });
});
