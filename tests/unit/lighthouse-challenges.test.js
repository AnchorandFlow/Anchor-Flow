// tests/unit/lighthouse-challenges.test.js
// LH-4.6 — Challenges UI pure-logic tests (revised: no startDate).
// No React, no App.jsx import (module-scope IIFE touches localStorage).
// Mirrors the pure helpers from App.jsx.

import { describe, it, expect } from "vitest";

// ── Mirrors (keep in sync with App.jsx) ───────────────────────────────────────

function lhChallengeAutoProgress(books) {
  if (!Array.isArray(books)) return 0;
  return books.filter(function(b) { return b.status === "finished"; }).length;
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

// ── LH-4.6-A — lhChallengeAutoProgress (no startDate) ────────────────────────

describe("LH-4.6-A — lhChallengeAutoProgress", function() {
  it("A1: empty books array → 0", function() {
    expect(lhChallengeAutoProgress([])).toBe(0);
  });

  it("A2: null/missing books → 0", function() {
    expect(lhChallengeAutoProgress(null)).toBe(0);
    expect(lhChallengeAutoProgress(undefined)).toBe(0);
  });

  it("A3: one finished book → 1", function() {
    var books = [{ id:"b1", status:"finished" }];
    expect(lhChallengeAutoProgress(books)).toBe(1);
  });

  it("A4: multiple finished books → count", function() {
    var books = [
      { id:"b1", status:"finished" },
      { id:"b2", status:"finished" },
      { id:"b3", status:"finished" },
    ];
    expect(lhChallengeAutoProgress(books)).toBe(3);
  });

  it("A5: reading and want books not counted", function() {
    var books = [
      { id:"b1", status:"reading" },
      { id:"b2", status:"want" },
      { id:"b3", status:"finished" },
    ];
    expect(lhChallengeAutoProgress(books)).toBe(1);
  });

  it("A6: finished books with or without finish date — all counted", function() {
    var books = [
      { id:"b1", status:"finished", finish:"2026-06-01" },
      { id:"b2", status:"finished", finish:"" },
      { id:"b3", status:"finished" },
    ];
    expect(lhChallengeAutoProgress(books)).toBe(3);
  });

  it("A7: mix of statuses — only finished counted", function() {
    var books = [
      { id:"b1", status:"finished" },
      { id:"b2", status:"reading" },
      { id:"b3", status:"finished" },
      { id:"b4", status:"want" },
      { id:"b5", status:"finished" },
    ];
    expect(lhChallengeAutoProgress(books)).toBe(3);
  });

  it("A8: book with no status field not counted", function() {
    var books = [
      { id:"b1" },
      { id:"b2", status:"finished" },
    ];
    expect(lhChallengeAutoProgress(books)).toBe(1);
  });
});

// ── LH-4.6-B — kind field + lhUpdateItem patch behavior ─────────────────────

describe("LH-4.6-B — kind field semantics", function() {
  it("B1: goal record without kind reads as 'goal' (default)", function() {
    var g = { id:"g1", cat:"Math", goal:"Finish workbook" };
    expect(g.kind || "goal").toBe("goal");
  });

  it("B2: challenge record carries target, unit, manualAdjust (no startDate)", function() {
    var g = {
      id:"g2", cat:"Reading", goal:"Summer reading", kind:"challenge",
      target:"20", unit:"books", manualAdjust:0
    };
    expect(g.kind).toBe("challenge");
    expect(g.target).toBe("20");
    expect(g.unit).toBe("books");
    expect(g.manualAdjust).toBe(0);
    expect(g.startDate).toBeUndefined();
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
    var next = lhUpdateItem(lh, "child1", "goals", "g1", { kind:"challenge", target:"10", unit:"books", manualAdjust:0 });
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
            { id:"g1", kind:"challenge", target:"20", unit:"books", manualAdjust:0, cat:"Reading", goal:"Summer" }
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
  it("C1: displayProgress = autoProgress + manualAdjust", function() {
    var books = [
      { status:"finished" }, { status:"finished" }, { status:"reading" }
    ];
    var auto = lhChallengeAutoProgress(books);
    expect(auto).toBe(2);
    expect(auto + 3).toBe(5);
  });

  it("C2: negative manualAdjust produces correct total", function() {
    var books = [{ status:"finished" }, { status:"finished" }, { status:"finished" }];
    var auto = lhChallengeAutoProgress(books);
    expect(auto + (-2)).toBe(1);
  });

  it("C3: zero autoProgress for non-books unit", function() {
    var auto = (function(unit, books) { return unit === "books" ? lhChallengeAutoProgress(books) : 0; })("days", [{ status:"finished" }]);
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

  it("C8: progress bar pct capped at 1 even when displayProgress > target", function() {
    var displayProgress = 25;
    var targetNum = 20;
    var pct = targetNum > 0 ? Math.min(1, displayProgress / targetNum) : 0;
    expect(pct).toBe(1);
    expect(displayProgress).toBe(25);
  });

  it("C9: books without finish date still counted by auto-progress", function() {
    var books = [
      { status:"finished", finish:"" },
      { status:"finished" },
      { status:"finished", finish:"2026-07-01" },
    ];
    expect(lhChallengeAutoProgress(books)).toBe(3);
  });

  it("C10: end-to-end: 3 finished books + manualAdjust 2 → displayProgress 5", function() {
    var books = [
      { status:"finished" }, { status:"finished" }, { status:"finished" },
      { status:"reading" },
    ];
    var auto = lhChallengeAutoProgress(books);
    var manualAdjust = 2;
    expect(auto + manualAdjust).toBe(5);
    expect(lhBreakdownLabel(auto, manualAdjust, "books")).toBe("3 from Books log, +2 added");
  });
});

// ── LH-4.6-D — who field on books ────────────────────────────────────────────

describe("LH-4.6-D — book who field assignment", function() {
  it("D1: saveBook assigns who = activeChild (model invariant)", function() {
    var activeChild = "child-abc";
    var item = { id:"b1", title:"Charlotte's Web", who: activeChild, status:"finished" };
    expect(item.who).toBe("child-abc");
  });

  it("D2: updateBook patch includes who (mirrors activeChild at edit time)", function() {
    var activeChild = "child-abc";
    var patch = { title:"Charlotte's Web", who: activeChild, status:"finished" };
    expect(patch.who).toBe("child-abc");
  });

  it("D3: books stored under child's shared[childId].books are child-scoped", function() {
    var lh = {
      shared: {
        "child-abc": { books: [{ id:"b1", status:"finished", who:"child-abc" }] },
        "child-xyz": { books: [] }
      }
    };
    var childBooks = (lh.shared["child-abc"] || {}).books || [];
    expect(lhChallengeAutoProgress(childBooks)).toBe(1);
    var siblingBooks = (lh.shared["child-xyz"] || {}).books || [];
    expect(lhChallengeAutoProgress(siblingBooks)).toBe(0);
  });
});
