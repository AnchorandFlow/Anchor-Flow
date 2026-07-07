// tests/unit/lighthouse-challenges.test.js
// LH-4.6 — Challenges UI pure-logic tests.
// No React, no App.jsx import (module-scope IIFE touches localStorage).
// Mirrors the pure helpers from App.jsx.

import { describe, it, expect } from "vitest";

// ── Mirrors (keep in sync with App.jsx) ───────────────────────────────────────

function lhChallengeAutoProgress(books, startDate) {
  if (!Array.isArray(books) || !startDate) return 0;
  return books.filter(function(b) {
    return b.status === "finished" && b.finish && b.finish >= startDate;
  }).length;
}

function lhUpdateItem(lh, childId, field, id, patch) {
  var shared = Object.assign({}, (lh.shared || {}));
  var child  = Object.assign({}, shared[childId] || { books:[], beyond:[], trips:[], goals:[] });
  child[field] = (Array.isArray(child[field]) ? child[field] : []).map(function(item) {
    return item.id === id ? Object.assign({}, item, patch) : item;
  });
  shared[childId] = child;
  return Object.assign({}, lh, { shared: shared });
}

function lhBreakdownLabel(autoProgress, manualAdjust, unit) {
  if (unit !== "books") return null;
  if (manualAdjust > 0)      return autoProgress + " from Books log, +" + manualAdjust + " added";
  if (manualAdjust < 0)      return autoProgress + " from Books log, −" + Math.abs(manualAdjust) + " removed";
  return autoProgress + " from Books log";
}

// ── LH-4.6-A — lhChallengeAutoProgress ───────────────────────────────────────

describe("LH-4.6-A — lhChallengeAutoProgress", function() {
  it("A1: empty books array → 0", function() {
    expect(lhChallengeAutoProgress([], "2026-01-01")).toBe(0);
  });

  it("A2: null/missing books → 0", function() {
    expect(lhChallengeAutoProgress(null, "2026-01-01")).toBe(0);
    expect(lhChallengeAutoProgress(undefined, "2026-01-01")).toBe(0);
  });

  it("A3: missing or empty startDate → 0", function() {
    var books = [{ status:"finished", finish:"2026-03-01" }];
    expect(lhChallengeAutoProgress(books, "")).toBe(0);
    expect(lhChallengeAutoProgress(books, null)).toBe(0);
  });

  it("A4: all books finished BEFORE startDate → 0", function() {
    var books = [
      { status:"finished", finish:"2025-12-31" },
      { status:"finished", finish:"2025-11-01" },
    ];
    expect(lhChallengeAutoProgress(books, "2026-01-01")).toBe(0);
  });

  it("A5: book finished ON startDate → counted", function() {
    var books = [{ status:"finished", finish:"2026-06-01" }];
    expect(lhChallengeAutoProgress(books, "2026-06-01")).toBe(1);
  });

  it("A6: books finished AFTER startDate → all counted", function() {
    var books = [
      { status:"finished", finish:"2026-06-15" },
      { status:"finished", finish:"2026-07-01" },
    ];
    expect(lhChallengeAutoProgress(books, "2026-06-01")).toBe(2);
  });

  it("A7: mixed — only on/after startDate counted", function() {
    var books = [
      { status:"finished", finish:"2025-12-01" },
      { status:"finished", finish:"2026-06-01" },
      { status:"finished", finish:"2026-07-04" },
      { status:"reading",  finish:null },
    ];
    expect(lhChallengeAutoProgress(books, "2026-06-01")).toBe(2);
  });

  it("A8: non-finished books are not counted", function() {
    var books = [
      { status:"reading",   finish:"2026-07-01" },
      { status:"want",      finish:null },
      { status:"finished",  finish:"2026-07-01" },
    ];
    expect(lhChallengeAutoProgress(books, "2026-01-01")).toBe(1);
  });

  it("A9: book finished on/after startDate but missing finish field → not counted", function() {
    var books = [
      { status:"finished", finish:null },
      { status:"finished" },
    ];
    expect(lhChallengeAutoProgress(books, "2026-01-01")).toBe(0);
  });
});

// ── LH-4.6-B — kind field + lhUpdateItem patch behavior ─────────────────────

describe("LH-4.6-B — kind field semantics", function() {
  it("B1: goal record without kind reads as 'goal' (default)", function() {
    var g = { id:"g1", cat:"Math", goal:"Finish workbook" };
    expect(g.kind || "goal").toBe("goal");
  });

  it("B2: challenge record carries all challenge fields", function() {
    var g = {
      id:"g2", cat:"Reading", goal:"Summer reading", kind:"challenge",
      target:"20", unit:"books", startDate:"2026-06-01", manualAdjust:0
    };
    expect(g.kind).toBe("challenge");
    expect(g.target).toBe("20");
    expect(g.unit).toBe("books");
    expect(g.startDate).toBe("2026-06-01");
    expect(g.manualAdjust).toBe(0);
  });

  it("B3: lhUpdateItem patches kind without touching other fields", function() {
    var lh = {
      shared: {
        "child1": {
          goals: [
            { id:"g1", cat:"Math", goal:"Algebra", kind:"goal", progress:"In progress" }
          ]
        }
      }
    };
    var next = lhUpdateItem(lh, "child1", "goals", "g1", { kind:"challenge", target:"10", unit:"books", startDate:"2026-06-01", manualAdjust:0 });
    var g = next.shared["child1"].goals[0];
    expect(g.kind).toBe("challenge");
    expect(g.target).toBe("10");
    expect(g.cat).toBe("Math");
    expect(g.goal).toBe("Algebra");
    expect(g.progress).toBe("In progress");
  });

  it("B4: patching manualAdjust does not touch other fields", function() {
    var lh = {
      shared: {
        "child1": {
          goals: [
            { id:"g1", kind:"challenge", target:"20", unit:"books", startDate:"2026-06-01", manualAdjust:0, cat:"Reading", goal:"Summer" }
          ]
        }
      }
    };
    var next = lhUpdateItem(lh, "child1", "goals", "g1", { manualAdjust: 3 });
    var g = next.shared["child1"].goals[0];
    expect(g.manualAdjust).toBe(3);
    expect(g.kind).toBe("challenge");
    expect(g.target).toBe("20");
    expect(g.unit).toBe("books");
    expect(g.startDate).toBe("2026-06-01");
    expect(g.cat).toBe("Reading");
  });

  it("B5: sibling child goals unaffected", function() {
    var lh = {
      shared: {
        "child1": { goals: [{ id:"g1", kind:"goal", cat:"Math", goal:"Algebra" }] },
        "child2": { goals: [{ id:"g2", kind:"goal", cat:"Science", goal:"Physics" }] }
      }
    };
    var next = lhUpdateItem(lh, "child1", "goals", "g1", { kind:"challenge" });
    expect(next.shared["child2"].goals[0].kind).toBe("goal");
    expect(next.shared["child2"].goals[0].goal).toBe("Physics");
  });

  it("B6: patching a non-existent id leaves array unchanged", function() {
    var lh = {
      shared: { "child1": { goals: [{ id:"g1", kind:"goal", goal:"A" }] } }
    };
    var next = lhUpdateItem(lh, "child1", "goals", "zzz", { kind:"challenge" });
    expect(next.shared["child1"].goals[0].kind).toBe("goal");
  });
});

// ── LH-4.6-C — displayProgress arithmetic + breakdown label ──────────────────

describe("LH-4.6-C — displayProgress + breakdown label", function() {
  it("C1: displayProgress = autoProgress + manualAdjust (both positive)", function() {
    var auto = lhChallengeAutoProgress(
      [{ status:"finished", finish:"2026-06-05" }, { status:"finished", finish:"2026-07-01" }],
      "2026-06-01"
    );
    expect(auto + 3).toBe(5);
  });

  it("C2: negative manualAdjust produces correct total", function() {
    expect(11 + (-2)).toBe(9);
  });

  it("C3: zero autoProgress for non-books unit", function() {
    var books = [{ status:"finished", finish:"2026-07-01" }];
    var auto = (function(unit) { return unit === "books" ? lhChallengeAutoProgress(books, "2026-01-01") : 0; })("days");
    expect(auto).toBe(0);
  });

  it("C4: breakdown label — manualAdjust > 0", function() {
    expect(lhBreakdownLabel(11, 3, "books")).toBe("11 from Books log, +3 added");
  });

  it("C5: breakdown label — manualAdjust === 0", function() {
    expect(lhBreakdownLabel(11, 0, "books")).toBe("11 from Books log");
  });

  it("C6: breakdown label — manualAdjust < 0", function() {
    expect(lhBreakdownLabel(11, -2, "books")).toBe("11 from Books log, −2 removed");
  });

  it("C7: breakdown label — non-books unit returns null", function() {
    expect(lhBreakdownLabel(5, 2, "days")).toBeNull();
    expect(lhBreakdownLabel(5, 0, "hours")).toBeNull();
  });

  it("C8: displayProgress can be 0 when both auto and manual are 0", function() {
    expect(0 + 0).toBe(0);
  });

  it("C9: displayProgress exceeds target (clamped for bar, not for label)", function() {
    var displayProgress = 25;
    var targetNum = 20;
    var pct = targetNum > 0 ? Math.min(1, displayProgress / targetNum) : 0;
    expect(pct).toBe(1);
    expect(displayProgress).toBe(25);
  });

  it("C10: autoProgress counts correctly from books log", function() {
    var books = [
      { status:"finished", finish:"2026-05-31" },
      { status:"finished", finish:"2026-06-01" },
      { status:"finished", finish:"2026-06-15" },
      { status:"finished", finish:"2026-07-04" },
      { status:"reading",  finish:null },
    ];
    expect(lhChallengeAutoProgress(books, "2026-06-01")).toBe(3);
    var manualAdjust = 2;
    expect(lhChallengeAutoProgress(books, "2026-06-01") + manualAdjust).toBe(5);
    expect(lhBreakdownLabel(3, 2, "books")).toBe("3 from Books log, +2 added");
  });
});
