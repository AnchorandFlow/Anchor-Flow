// tests/unit/f97-migration-shims.test.js
// F-97 — resolveResponsibleParent / resolveForPerson (pure read-side migration
// shims). These are what make the "L"/"T" → real people[].id migration and the
// forPerson id-vs-legacy-name dual read actually work — every F-13/F-48/F-53
// call site depends on them resolving correctly, so they get direct coverage
// rather than only being exercised incidentally through App.jsx.

import { describe, it, expect } from "vitest";
import { resolveResponsibleParent, resolveForPerson } from "../../src/sync-core.js";

const PEOPLE = [
  { id: "i3jfymz", name: "Lindsey " }, // trailing space is real, on-file data
  { id: "69uf6z6", name: "Twyla" },
  { id: "35wv0y6", name: "Rylan" },
  { id: "yetb48o", name: "Madi" },
  { id: "h804bbn", name: "Kinzlee" },
];

describe("F-97 — resolveResponsibleParent", function() {
  it("resolves legacy \"L\" to Lindsey's real people[].id", function() {
    expect(resolveResponsibleParent("L")).toBe("i3jfymz");
  });

  it("resolves legacy \"T\" to Twyla's real people[].id", function() {
    expect(resolveResponsibleParent("T")).toBe("69uf6z6");
  });

  it("passes a real people[].id through unchanged", function() {
    expect(resolveResponsibleParent("h804bbn")).toBe("h804bbn");
  });

  it("passes a stray value that's neither \"L\"/\"T\" nor a known id through unchanged, rather than throwing or resolving to the wrong person", function() {
    // Covers garbage data, a typo, or an id belonging to a person who was
    // since removed from people[] — resolveResponsibleParent has no people[]
    // list to check against (read-side, id-shape-agnostic), so its only
    // correct behavior for anything that isn't literally "L" or "T" is a
    // silent passthrough. The orphan-detection (does this id still resolve to
    // a real person?) happens one level up, at the call sites.
    expect(resolveResponsibleParent("Q")).toBe("Q");
    expect(resolveResponsibleParent("some-deleted-persons-id")).toBe("some-deleted-persons-id");
  });

  it("passes null through unchanged (no responsibleParent set)", function() {
    expect(resolveResponsibleParent(null)).toBe(null);
  });

  it("passes undefined through unchanged", function() {
    expect(resolveResponsibleParent(undefined)).toBe(undefined);
  });
});

describe("F-97 — resolveForPerson", function() {
  it("resolves a legacy bare-name string to that person's id (case/whitespace-insensitive)", function() {
    expect(resolveForPerson("rylan", PEOPLE)).toBe("35wv0y6");
    expect(resolveForPerson("  RYLAN  ", PEOPLE)).toBe("35wv0y6");
  });

  it("resolves a legacy name against a person whose own stored name has incidental whitespace", function() {
    // Lindsey's real people[].id has a trailing space on file (" Lindsey ") —
    // the match must still succeed by trimming both sides.
    expect(resolveForPerson("Lindsey", PEOPLE)).toBe("i3jfymz");
  });

  it("passes a real people[].id through unchanged (new-format data)", function() {
    expect(resolveForPerson("yetb48o", PEOPLE)).toBe("yetb48o");
  });

  it("passes the \"family\" sentinel through unchanged", function() {
    expect(resolveForPerson("family", PEOPLE)).toBe("family");
  });

  it("passes an orphaned/unmatched legacy name through unchanged rather than guessing", function() {
    expect(resolveForPerson("Briar", PEOPLE)).toBe("Briar");
  });

  it("passes null/empty through unchanged", function() {
    expect(resolveForPerson(null, PEOPLE)).toBe(null);
    expect(resolveForPerson("", PEOPLE)).toBe("");
  });
});
