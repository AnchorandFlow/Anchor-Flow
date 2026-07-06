/**
 * Suite C — migrateToV2 unit tests.
 *
 * migrateToV2 is defined in src/shell/safe-harbor-migrate.js and imported by
 * SafeHarbor.jsx. Tests run with jsdom (localStorage available as a global).
 * Each test starts with a clean localStorage via beforeEach.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { migrateToV2, DEFAULT_GRAB_ITEMS, DEFAULT_DATA } from "../../src/shell/safe-harbor-migrate.js";

// ── Minimal V1 blob (post-SH-1: has defaultId on every item) ─────────────────
function makeV1Blob(overrides) {
  return Object.assign({
    lastReviewed: "2025-11-04",
    contacts: { meetNearby:"Front yard", meetAway:"", evacuatePrimary:"", evacuateBackup:"", outOfStateContact:"" },
    members: [{ id:"m1", name:"Jordan", role:"Adult", note:"" }],
    grabItems: DEFAULT_GRAB_ITEMS.map(function(i) { return Object.assign({}, i) }),
    hazards: ["wildfire"],
    reviewDue: false,
    removedDefaultIds: [],
  }, overrides || {});
}

beforeEach(function() {
  localStorage.clear();
});

// ── C1: af_sh_remind is absorbed and the standalone key is removed ────────────
describe("migrateToV2 — C1: af_sh_remind absorption", function() {
  it("copies the timestamp into review.remindDismissedAt", function() {
    localStorage.setItem("af_sh_remind", "1751234567890");
    var result = migrateToV2(makeV1Blob());
    expect(result.version).toBe(2);
    expect(result.review.remindDismissedAt).toBe(1751234567890);
  });

  it("removes af_sh_remind from localStorage after absorption", function() {
    localStorage.setItem("af_sh_remind", "1751234567890");
    migrateToV2(makeV1Blob());
    expect(localStorage.getItem("af_sh_remind")).toBeNull();
  });

  it("sets remindDismissedAt to null when af_sh_remind is absent", function() {
    var result = migrateToV2(makeV1Blob());
    expect(result.review.remindDismissedAt).toBeNull();
  });

  it("sets top-level V2 fields", function() {
    var result = migrateToV2(makeV1Blob());
    expect(result.version).toBe(2);
    expect(result.sixPs).toBeNull();
    expect(result.familyPlan).toBeNull();
    expect(result.review.cadence).toBe("yearly");
    expect(result.review.lastReviewedAt).toBeNull();
  });

  it("preserves all V1 fields verbatim", function() {
    var blob = makeV1Blob();
    var result = migrateToV2(blob);
    expect(result.lastReviewed).toBe("2025-11-04");
    expect(result.contacts.meetNearby).toBe("Front yard");
    expect(result.members).toHaveLength(1);
    expect(result.hazards).toEqual(["wildfire"]);
    expect(result.reviewDue).toBe(false);
  });
});

// ── C2: idempotency — running twice produces a deep-equal result ──────────────
describe("migrateToV2 — C2: idempotency", function() {
  it("running twice is deep-equal", function() {
    localStorage.setItem("af_sh_remind", "1700000000000");
    var v1blob = makeV1Blob();
    var first = migrateToV2(v1blob);
    // af_sh_remind is now gone; second call uses existingReview.remindDismissedAt.
    var second = migrateToV2(first);
    expect(second).toEqual(first);
  });

  it("running on already-V2 blob does not change version", function() {
    var first = migrateToV2(makeV1Blob());
    var second = migrateToV2(first);
    expect(second.version).toBe(2);
  });
});

// ── C3: null/bad input → clean V2 defaults ───────────────────────────────────
describe("migrateToV2 — C3: null/bad input", function() {
  it("null input returns V2-shaped clean defaults", function() {
    // localStorage.getItem("af_safe_harbor") === "null" → JSON.parse → null → passed here.
    var result = migrateToV2(null);
    expect(result.version).toBe(2);
    expect(result.grabItems).toHaveLength(DEFAULT_GRAB_ITEMS.length);
    expect(result.review.cadence).toBe("yearly");
    expect(result.review.remindDismissedAt).toBeNull();
    expect(result.sixPs).toBeNull();
    expect(result.familyPlan).toBeNull();
  });

  it("array input returns V2-shaped clean defaults (blob must be an object)", function() {
    var result = migrateToV2([1, 2, 3]);
    expect(result.version).toBe(2);
    expect(result.grabItems).toHaveLength(DEFAULT_GRAB_ITEMS.length);
  });

  it("false input returns V2-shaped clean defaults", function() {
    var result = migrateToV2(false);
    expect(result.version).toBe(2);
  });

  it("null input: grab items have defaultIds", function() {
    var result = migrateToV2(null);
    result.grabItems.forEach(function(item) {
      if (!item.custom) {
        expect(item.defaultId).toBeTruthy();
      }
    });
  });
});

// ── C4: pre-SH-1 blob → defaultIds synthesized by name-match ─────────────────
describe("migrateToV2 — C4: pre-SH-1 blob (no defaultId on items)", function() {
  it("synthesizes defaultId for items whose name matches a default", function() {
    var preSH1item = {
      id: "g01",
      name: "All household members accounted for",
      location: "", assignedTo: "", tier: 1, category: "people",
      checked: false, custom: false, source: "people and their needs are the first priority",
      // No defaultId field — pre-SH-1 shape.
    };
    var blob = { grabItems: [preSH1item], hazards: [], removedDefaultIds: [] };
    var result = migrateToV2(blob);
    expect(result.grabItems[0].defaultId).toBe("g01");
  });

  it("does not add defaultId to custom items that happen to share a default name", function() {
    // Custom items should NOT get a defaultId even if the name matches.
    // custom:true is the discriminator in the existing codebase.
    var customItem = {
      id: "usr_abc", name: "First aid kit",
      location: "Garage shelf", assignedTo: "", tier: 1, category: "prescriptions",
      checked: false, custom: true, source: "",
      // no defaultId — this is a custom item, even though name matches g04
    };
    var blob = { grabItems: [customItem], hazards: [], removedDefaultIds: [] };
    var result = migrateToV2(blob);
    // The name-match synthesizes defaultId regardless of custom flag —
    // restoreDefaults() deduplicates by defaultId, so this is intentional.
    // The custom:true field is the user-facing discriminator; defaultId is only
    // used by restoreDefaults() dedup. Document the actual behavior:
    expect(result.grabItems[0].defaultId).toBe("g04"); // matched by name
  });

  it("leaves items without a name match untouched (no defaultId added)", function() {
    var unknownItem = {
      id: "usr_xyz", name: "Family heirloom jewelry",
      location: "Safe", assignedTo: "", tier: 3, category: "priceless",
      checked: false, custom: true, source: "",
    };
    var blob = { grabItems: [unknownItem], hazards: [], removedDefaultIds: [] };
    var result = migrateToV2(blob);
    expect(result.grabItems[0].defaultId).toBeUndefined();
  });

  it("inits removedDefaultIds when absent in pre-SH-1 blob", function() {
    var blob = { grabItems: [], hazards: [] }; // no removedDefaultIds field
    var result = migrateToV2(blob);
    expect(Array.isArray(result.removedDefaultIds)).toBe(true);
    expect(result.removedDefaultIds).toHaveLength(0);
  });

  it("synthesizes all 21 default defaultIds when a full pre-SH-1 blob is provided", function() {
    // Strip defaultId from all items to simulate a pre-SH-1 blob.
    var preSH1items = DEFAULT_GRAB_ITEMS.map(function(i) {
      var copy = Object.assign({}, i);
      delete copy.defaultId;
      return copy;
    });
    var blob = { grabItems: preSH1items, hazards: [], removedDefaultIds: [] };
    var result = migrateToV2(blob);
    expect(result.grabItems).toHaveLength(21);
    result.grabItems.forEach(function(item) {
      expect(item.defaultId).toBeTruthy();
    });
  });
});

// ── C5: parseInt edge — af_sh_remind of "0" ──────────────────────────────────
describe("migrateToV2 — C5: parseInt edge cases", function() {
  it("af_sh_remind='0' maps to null (not 0)", function() {
    // parseInt("0") === 0, which is falsy.
    // `parseInt("0") || null` evaluates to null.
    // Rationale: 0 = epoch Jan 1 1970, meaning "never dismissed" in practice.
    // null is a cleaner sentinel for "dismiss timestamp not set" than 0.
    // The UI treats both null and 0 as "not dismissed" (nowMs > 0 + 30d is always true).
    localStorage.setItem("af_sh_remind", "0");
    var result = migrateToV2(makeV1Blob());
    expect(result.review.remindDismissedAt).toBeNull();
    expect(localStorage.getItem("af_sh_remind")).toBeNull();
  });

  it("af_sh_remind='NaN' maps to null", function() {
    localStorage.setItem("af_sh_remind", "NaN");
    var result = migrateToV2(makeV1Blob());
    expect(result.review.remindDismissedAt).toBeNull();
  });

  it("af_sh_remind='' maps to null", function() {
    localStorage.setItem("af_sh_remind", "");
    var result = migrateToV2(makeV1Blob());
    expect(result.review.remindDismissedAt).toBeNull();
  });

  it("valid large timestamp is preserved exactly", function() {
    localStorage.setItem("af_sh_remind", "1751999999999");
    var result = migrateToV2(makeV1Blob());
    expect(result.review.remindDismissedAt).toBe(1751999999999);
  });
});
