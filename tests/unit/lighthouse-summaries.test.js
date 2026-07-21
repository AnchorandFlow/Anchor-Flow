// tests/unit/lighthouse-summaries.test.js
// LH-6 — Summary / Keepsakes pure-logic tests.
// No React, no App.jsx import (module-scope IIFE touches localStorage).
// Mirrors lhBuildSummary and lhBuildHouseholdSummary from App.jsx.

import { describe, it, expect } from "vitest";

// ── Mirrors (keep in sync with App.jsx) ───────────────────────────────────────

function lhBuildSummary(opts) {
  var name       = (opts && opts.name)       ? opts.name       : "Your child";
  var mode       = (opts && opts.mode)       ? opts.mode       : "";
  var books      = (opts && Array.isArray(opts.books))      ? opts.books      : [];
  var beyond     = (opts && Array.isArray(opts.beyond))     ? opts.beyond     : [];
  var trips      = (opts && Array.isArray(opts.trips))      ? opts.trips      : [];
  var goals      = (opts && Array.isArray(opts.goals))      ? opts.goals      : [];
  var homework   = (opts && Array.isArray(opts.homework))   ? opts.homework   : [];
  var gradeMarks = (opts && Array.isArray(opts.gradeMarks)) ? opts.gradeMarks : [];
  var gradeNotes = (opts && typeof opts.gradeNotes === "string") ? opts.gradeNotes : "";

  var paras = [];

  var finished   = books.filter(function(b) { return b.status === "finished"; });
  var reading    = books.filter(function(b) { return b.status === "reading"; });
  var challenges = goals.filter(function(g) { return g.kind === "challenge" && g.unit === "books"; });
  if (finished.length > 0 || reading.length > 0 || challenges.length > 0) {
    var bookLines = [];
    if (finished.length > 0) {
      var fTitles = finished.map(function(b) { return b.title; }).filter(Boolean);
      var bLine = name + " finished " + finished.length + (finished.length === 1 ? " book" : " books");
      if (fTitles.length > 0 && fTitles.length <= 4) {
        bLine += " — " + fTitles.join(", ");
      } else if (fTitles.length > 4) {
        bLine += ", including " + fTitles.slice(0, 3).join(", ") + " and " + (fTitles.length - 3) + " more";
      }
      bookLines.push(bLine + ".");
    }
    if (reading.length > 0) {
      var rTitles = reading.map(function(b) { return b.title; }).filter(Boolean);
      if (rTitles.length > 0) {
        var rList = rTitles.length === 1 ? rTitles[0] : rTitles.slice(0, -1).join(", ") + " and " + rTitles[rTitles.length - 1];
        bookLines.push("Currently reading: " + rList + ".");
      }
    }
    challenges.forEach(function(ch) {
      var disp   = finished.length + (typeof ch.manualAdjust === "number" ? ch.manualAdjust : 0);
      var target = parseInt(ch.target, 10) || 0;
      if (target > 0) {
        var cLabel = ch.goal ? "Reading challenge “" + ch.goal + "”" : "Reading challenge";
        bookLines.push(cLabel + ": " + disp + " of " + target + " books.");
      }
    });
    if (bookLines.length > 0) paras.push(bookLines.join(" "));
  }

  if (beyond.length > 0) {
    var btTitles = beyond.map(function(b) { return b.title; }).filter(Boolean);
    var btLine;
    if (beyond.length === 1) {
      btLine = btTitles.length > 0
        ? "One memorable experience outside the usual: " + btTitles[0] + "."
        : "One experience beyond the usual.";
    } else {
      btLine = beyond.length + " experiences beyond the usual";
      if (btTitles.length > 0 && btTitles.length <= 4) {
        btLine += " — " + btTitles.join(", ");
      } else if (btTitles.length > 4) {
        btLine += ", including " + btTitles.slice(0, 3).join(", ") + " and more";
      }
      btLine += ".";
    }
    paras.push(btLine);
  }

  if (trips.length > 0) {
    var tpTitles = trips.map(function(t) { return t.title; }).filter(Boolean);
    var tpLine;
    if (trips.length === 1) {
      tpLine = tpTitles.length > 0
        ? "An educational trip: " + tpTitles[0] + "."
        : "One educational trip.";
    } else {
      tpLine = trips.length + " educational trips";
      if (tpTitles.length > 0 && tpTitles.length <= 4) {
        tpLine += " — " + tpTitles.join(", ");
      } else if (tpTitles.length > 4) {
        tpLine += ", including " + tpTitles.slice(0, 3).join(", ") + " and more";
      }
      tpLine += ".";
    }
    paras.push(tpLine);
  }

  var achieved   = goals.filter(function(g) { return g.kind !== "challenge" && g.progress === "Achieved"; });
  var inProgress = goals.filter(function(g) { return g.kind !== "challenge" && g.progress === "In progress"; });
  if (achieved.length > 0 || inProgress.length > 0) {
    var gLines = [];
    if (achieved.length > 0) {
      var aTitles = achieved.map(function(g) { return g.goal; }).filter(Boolean);
      var aLine   = achieved.length === 1 ? "Goal achieved" : achieved.length + " goals achieved";
      if (aTitles.length > 0 && aTitles.length <= 3) aLine += ": " + aTitles.join(", ");
      gLines.push(aLine + ".");
    }
    if (inProgress.length > 0) {
      gLines.push(inProgress.length + (inProgress.length === 1 ? " goal" : " goals") + " still in progress — the work continues.");
    }
    paras.push(gLines.join(" "));
  }

  if (mode === "school") {
    var sLines = [];
    var doneHw = homework.filter(function(h) { return h.status === "Done" || h.status === "Turned in"; });
    if (doneHw.length > 0) {
      sLines.push(doneHw.length + (doneHw.length === 1 ? " assignment" : " assignments") + " completed.");
    }
    var exceeding = gradeMarks.filter(function(m) { return m.mark === "Exceeding"; });
    var strengths = gradeMarks.filter(function(m) { return m.mark === "Strength"; });
    if (exceeding.length > 0) {
      sLines.push("Exceeding in " + exceeding.map(function(m) { return m.subject; }).join(", ") + ".");
    }
    if (strengths.length > 0) {
      sLines.push("Strengths: " + strengths.map(function(m) { return m.subject; }).join(", ") + ".");
    }
    if (gradeNotes && gradeNotes.trim()) sLines.push(gradeNotes.trim());
    if (sLines.length > 0) paras.push(sLines.join(" "));
  }

  if (paras.length === 0) {
    return name + " — the record is just getting started. Every day you're adding to it.";
  }
  paras.push("There's more here than fits on a report card.");
  return paras.join("\n\n");
}

function lhBuildHouseholdSummary(children) {
  if (!children || children.length === 0) return "";
  var lines = [];
  children.forEach(function(c) {
    var books    = Array.isArray(c.books)  ? c.books  : [];
    var beyond   = Array.isArray(c.beyond) ? c.beyond : [];
    var trips    = Array.isArray(c.trips)  ? c.trips  : [];
    var goals    = Array.isArray(c.goals)  ? c.goals  : [];
    var finished = books.filter(function(b) { return b.status === "finished"; });
    var achieved = goals.filter(function(g) { return g.kind !== "challenge" && g.progress === "Achieved"; });
    var items = [];
    if (finished.length > 0) items.push(finished.length + (finished.length === 1 ? " book" : " books"));
    if (beyond.length > 0)   items.push(beyond.length   + (beyond.length   === 1 ? " experience" : " experiences"));
    if (trips.length > 0)    items.push(trips.length    + (trips.length    === 1 ? " trip" : " trips"));
    if (achieved.length > 0) items.push(achieved.length + (achieved.length === 1 ? " goal achieved" : " goals achieved"));
    var n = c.name || "Child";
    lines.push(items.length > 0 ? n + ": " + items.join(", ") + "." : n + ": just getting started.");
  });
  return lines.join("\n");
}

// ── LH-6-A — empty data ───────────────────────────────────────────────────────

describe("LH-6-A — empty / no data", function() {
  it("A1: returns a warm message when there is no data", function() {
    var out = lhBuildSummary({});
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("A2: empty data does not include 'report card' closer", function() {
    var out = lhBuildSummary({});
    expect(out.includes("report card")).toBe(false);
  });

  it("A3: empty data message contains child name when provided", function() {
    var out = lhBuildSummary({ name: "Milo" });
    expect(out.includes("Milo")).toBe(true);
  });

  it("A4: empty data falls back to 'Your child' when no name provided", function() {
    var out = lhBuildSummary({});
    expect(out.includes("Your child")).toBe(true);
  });

  it("A5: null opts falls back gracefully", function() {
    var out = lhBuildSummary(null);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});

// ── LH-6-B — books ───────────────────────────────────────────────────────────

describe("LH-6-B — books section", function() {
  it("B1: one finished book uses singular and includes child name", function() {
    var out = lhBuildSummary({ name: "Emma", books: [{ title: "Charlotte's Web", status: "finished" }] });
    expect(out.includes("Emma")).toBe(true);
    expect(out.includes("1 book")).toBe(true);
  });

  it("B2: multiple finished books uses plural", function() {
    var out = lhBuildSummary({ books: [
      { title: "Book A", status: "finished" },
      { title: "Book B", status: "finished" }
    ]});
    expect(out.includes("2 books")).toBe(true);
  });

  it("B3: titles included when 4 or fewer finished books", function() {
    var out = lhBuildSummary({ name: "Leo", books: [
      { title: "Narnia", status: "finished" },
      { title: "Hobbit", status: "finished" }
    ]});
    expect(out.includes("Narnia")).toBe(true);
    expect(out.includes("Hobbit")).toBe(true);
  });

  it("B4: 5+ titles uses 'including' form instead of listing all", function() {
    var bs = ["A","B","C","D","E"].map(function(t) { return { title: t, status: "finished" }; });
    var out = lhBuildSummary({ books: bs });
    expect(out.includes("including")).toBe(true);
    expect(out.includes("2 more")).toBe(true);
  });

  it("B5: currently-reading book appears in output", function() {
    var out = lhBuildSummary({ books: [{ title: "Holes", status: "reading" }] });
    expect(out.includes("Currently reading")).toBe(true);
    expect(out.includes("Holes")).toBe(true);
  });

  it("B6: books with no titles still generates output (no crash)", function() {
    var out = lhBuildSummary({ books: [{ status: "finished" }, { status: "finished" }] });
    expect(out.includes("2 books")).toBe(true);
  });

  it("B7: books with status other than finished/reading are ignored", function() {
    var out = lhBuildSummary({ name: "Sam", books: [{ title: "Wishlist", status: "wishlist" }] });
    expect(out.includes("Sam — the record")).toBe(true);
  });
});

// ── LH-6-C — beyond ──────────────────────────────────────────────────────────

describe("LH-6-C — beyond section", function() {
  it("C1: single beyond entry uses singular phrasing", function() {
    var out = lhBuildSummary({ beyond: [{ title: "Museum visit" }] });
    expect(out.includes("One memorable experience")).toBe(true);
    expect(out.includes("Museum visit")).toBe(true);
  });

  it("C2: multiple beyond entries uses plural count", function() {
    var out = lhBuildSummary({ beyond: [{ title: "A" }, { title: "B" }, { title: "C" }] });
    expect(out.includes("3 experiences")).toBe(true);
  });

  it("C3: titles listed when 4 or fewer", function() {
    var out = lhBuildSummary({ beyond: [{ title: "Farm" }, { title: "Planetarium" }] });
    expect(out.includes("Farm")).toBe(true);
    expect(out.includes("Planetarium")).toBe(true);
  });

  it("C4: single entry with no title still generates output", function() {
    var out = lhBuildSummary({ beyond: [{}] });
    expect(out.includes("One experience beyond the usual")).toBe(true);
  });
});

// ── LH-6-D — trips ───────────────────────────────────────────────────────────

describe("LH-6-D — trips section", function() {
  it("D1: single trip uses singular phrasing with title", function() {
    var out = lhBuildSummary({ trips: [{ title: "Washington D.C." }] });
    expect(out.includes("An educational trip")).toBe(true);
    expect(out.includes("Washington D.C.")).toBe(true);
  });

  it("D2: multiple trips uses plural count", function() {
    var out = lhBuildSummary({ trips: [{ title: "X" }, { title: "Y" }] });
    expect(out.includes("2 educational trips")).toBe(true);
  });

  it("D3: trip titles listed when 4 or fewer", function() {
    var out = lhBuildSummary({ trips: [{ title: "Boston" }, { title: "Philly" }] });
    expect(out.includes("Boston")).toBe(true);
    expect(out.includes("Philly")).toBe(true);
  });

  it("D4: single trip with no title still generates output", function() {
    var out = lhBuildSummary({ trips: [{}] });
    expect(out.includes("One educational trip")).toBe(true);
  });
});

// ── LH-6-E — goals ───────────────────────────────────────────────────────────

describe("LH-6-E — goals section", function() {
  it("E1: single achieved goal uses singular", function() {
    var out = lhBuildSummary({ goals: [{ goal: "Learn fractions", progress: "Achieved" }] });
    expect(out.includes("Goal achieved")).toBe(true);
    expect(out.includes("Learn fractions")).toBe(true);
  });

  it("E2: multiple achieved goals uses plural and count", function() {
    var out = lhBuildSummary({ goals: [
      { goal: "A", progress: "Achieved" },
      { goal: "B", progress: "Achieved" }
    ]});
    expect(out.includes("2 goals achieved")).toBe(true);
  });

  it("E3: in-progress goals appear in output", function() {
    var out = lhBuildSummary({ goals: [{ goal: "Piano", progress: "In progress" }] });
    expect(out.includes("in progress")).toBe(true);
  });

  it("E4: challenge goals are excluded from the achieved/in-progress section", function() {
    var out = lhBuildSummary({ goals: [{ kind: "challenge", goal: "Read 20 books", progress: "Achieved" }] });
    expect(out.includes("Goal achieved")).toBe(false);
  });

  it("E5: achieved goal titles listed when 3 or fewer", function() {
    var out = lhBuildSummary({ goals: [
      { goal: "Swim 100m", progress: "Achieved" },
      { goal: "Knit a hat",  progress: "Achieved" }
    ]});
    expect(out.includes("Swim 100m")).toBe(true);
    expect(out.includes("Knit a hat")).toBe(true);
  });
});

// ── LH-6-F — reading challenges ──────────────────────────────────────────────

describe("LH-6-F — reading challenges", function() {
  it("F1: challenge with target shows progress in output", function() {
    var out = lhBuildSummary({
      books:  [{ title: "A", status: "finished" }, { title: "B", status: "finished" }],
      goals:  [{ kind: "challenge", unit: "books", target: "10", goal: "Summer reading" }]
    });
    expect(out.includes("2 of 10 books")).toBe(true);
  });

  it("F2: manualAdjust is added to finished count", function() {
    var out = lhBuildSummary({
      books: [{ status: "finished" }],
      goals: [{ kind: "challenge", unit: "books", target: "10", manualAdjust: 2 }]
    });
    expect(out.includes("3 of 10")).toBe(true);
  });

  it("F3: challenge goal label appears in output when set", function() {
    var out = lhBuildSummary({
      goals: [{ kind: "challenge", unit: "books", target: "5", goal: "Winter reading" }]
    });
    expect(out.includes("Winter reading")).toBe(true);
  });

  it("F4: challenge without target is silently omitted", function() {
    var out = lhBuildSummary({
      books: [],
      goals: [{ kind: "challenge", unit: "books", goal: "No target" }]
    });
    expect(out.includes("No target")).toBe(false);
  });

  it("F5: non-books challenges are ignored in books section", function() {
    var out = lhBuildSummary({
      goals: [{ kind: "challenge", unit: "miles", target: "50" }]
    });
    expect(out.includes("50 books")).toBe(false);
  });
});

// ── LH-6-G — school highlights ───────────────────────────────────────────────

describe("LH-6-G — school mode highlights", function() {
  it("G1: homework completed count appears in school mode", function() {
    var out = lhBuildSummary({
      mode: "school",
      homework: [
        { status: "Done" },
        { status: "Turned in" },
        { status: "Not started" }
      ]
    });
    expect(out.includes("2 assignments completed")).toBe(true);
  });

  it("G2: single completed assignment uses singular", function() {
    var out = lhBuildSummary({ mode: "school", homework: [{ status: "Turned in" }] });
    expect(out.includes("1 assignment completed")).toBe(true);
  });

  it("G3: exceeding marks list subjects", function() {
    var out = lhBuildSummary({
      mode: "school",
      gradeMarks: [{ mark: "Exceeding", subject: "Math" }, { mark: "Exceeding", subject: "Reading" }]
    });
    expect(out.includes("Exceeding in Math, Reading")).toBe(true);
  });

  it("G4: strength marks list subjects", function() {
    var out = lhBuildSummary({
      mode: "school",
      gradeMarks: [{ mark: "Strength", subject: "Art" }]
    });
    expect(out.includes("Strengths: Art")).toBe(true);
  });

  it("G5: growth notes appear verbatim in school mode", function() {
    var note = "Has shown real confidence this quarter.";
    var out  = lhBuildSummary({ mode: "school", gradeNotes: note });
    expect(out.includes(note)).toBe(true);
  });

  it("G6: school section absent when mode is not school", function() {
    var out = lhBuildSummary({
      mode: "homeschool",
      homework: [{ status: "Done" }],
      gradeMarks: [{ mark: "Exceeding", subject: "Math" }],
      gradeNotes: "Great progress"
    });
    expect(out.includes("assignment")).toBe(false);
    expect(out.includes("Exceeding")).toBe(false);
    expect(out.includes("Great progress")).toBe(false);
  });

  it("G7: Meeting and Approaching marks do not appear as highlights", function() {
    var out = lhBuildSummary({
      mode: "school",
      gradeMarks: [
        { mark: "Meeting",    subject: "Science" },
        { mark: "Approaching", subject: "Math" }
      ]
    });
    expect(out.includes("Exceeding")).toBe(false);
    expect(out.includes("Strengths")).toBe(false);
    expect(out.includes("Science")).toBe(false);
  });
});

// ── LH-6-H — closer and structure ────────────────────────────────────────────

describe("LH-6-H — closer and output structure", function() {
  it("H1: output with content ends with warm closer", function() {
    var out = lhBuildSummary({ books: [{ title: "A", status: "finished" }] });
    expect(out.includes("report card")).toBe(true);
  });

  it("H2: paragraphs are separated by double newline", function() {
    var out = lhBuildSummary({
      books:  [{ title: "A", status: "finished" }],
      beyond: [{ title: "B" }]
    });
    expect(out.includes("\n\n")).toBe(true);
  });

  it("H3: output is a non-empty string in all cases", function() {
    [
      {},
      { name: "Aria" },
      { mode: "school", homework: [] },
      { books: [], beyond: [], trips: [], goals: [] }
    ].forEach(function(opts) {
      var out = lhBuildSummary(opts);
      expect(typeof out).toBe("string");
      expect(out.trim().length).toBeGreaterThan(0);
    });
  });
});

// ── LH-6-I — lhBuildHouseholdSummary ─────────────────────────────────────────

describe("LH-6-I — lhBuildHouseholdSummary", function() {
  it("I1: empty array returns empty string", function() {
    expect(lhBuildHouseholdSummary([])).toBe("");
  });

  it("I2: null returns empty string", function() {
    expect(lhBuildHouseholdSummary(null)).toBe("");
  });

  it("I3: child with no data shows 'just getting started'", function() {
    var out = lhBuildHouseholdSummary([{ name: "Tim", books: [], beyond: [], trips: [], goals: [] }]);
    expect(out.includes("Tim")).toBe(true);
    expect(out.includes("just getting started")).toBe(true);
  });

  it("I4: child with books shows book count", function() {
    var out = lhBuildHouseholdSummary([{
      name: "Fern",
      books: [{ status: "finished" }, { status: "finished" }],
      beyond: [], trips: [], goals: []
    }]);
    expect(out.includes("Fern")).toBe(true);
    expect(out.includes("2 books")).toBe(true);
  });

  it("I5: multiple children each get their own line", function() {
    var out = lhBuildHouseholdSummary([
      { name: "Ada",  books: [{ status: "finished" }], beyond: [], trips: [], goals: [] },
      { name: "Beau", books: [],                       beyond: [], trips: [], goals: [] }
    ]);
    var lines = out.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0].includes("Ada")).toBe(true);
    expect(lines[1].includes("Beau")).toBe(true);
  });

  it("I6: beyond and trip counts appear", function() {
    var out = lhBuildHouseholdSummary([{
      name:   "Zoe",
      books:  [],
      beyond: [{ title: "X" }, { title: "Y" }],
      trips:  [{ title: "Z" }],
      goals:  []
    }]);
    expect(out.includes("2 experiences")).toBe(true);
    expect(out.includes("1 trip")).toBe(true);
  });

  it("I7: achieved goals are counted, in-progress are not", function() {
    var out = lhBuildHouseholdSummary([{
      name:   "Max",
      books:  [],
      beyond: [],
      trips:  [],
      goals:  [
        { progress: "Achieved" },
        { progress: "In progress" }
      ]
    }]);
    expect(out.includes("1 goal achieved")).toBe(true);
    expect(out.includes("In progress")).toBe(false);
  });

  it("I8: challenge goals excluded from achieved count", function() {
    var out = lhBuildHouseholdSummary([{
      name:  "Nia",
      books: [], beyond: [], trips: [],
      goals: [{ kind: "challenge", progress: "Achieved" }]
    }]);
    expect(out.includes("goal achieved")).toBe(false);
    expect(out.includes("just getting started")).toBe(true);
  });

  it("I9: singular vs plural for each category", function() {
    var out = lhBuildHouseholdSummary([{
      name:   "Rio",
      books:  [{ status: "finished" }],
      beyond: [{ title: "A" }],
      trips:  [{ title: "B" }],
      goals:  [{ progress: "Achieved" }]
    }]);
    expect(out.includes("1 book")).toBe(true);
    expect(out.includes("1 experience")).toBe(true);
    expect(out.includes("1 trip")).toBe(true);
    expect(out.includes("1 goal achieved")).toBe(true);
  });
});
