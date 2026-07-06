/**
 * Suite E — mergeSafeHarbor unit tests (SH-2b).
 *
 * Tests the merge hook that replaces wholesale last-write-wins when applying
 * a remote af_safe_harbor blob from Supabase.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mergeSafeHarbor, DEFAULT_GRAB_ITEMS } from "../../src/shell/safe-harbor-migrate.js";

function makeV2(overrides) {
  return Object.assign({
    version: 2,
    lastReviewed: null,
    contacts: { meetNearby:"", meetAway:"", evacuatePrimary:"", evacuateBackup:"", outOfStateContact:"" },
    members: [],
    grabItems: [],
    hazards: [],
    reviewDue: false,
    removedDefaultIds: [],
    sixPs: null, familyPlan: null,
    review: { lastReviewedAt: null, cadence: "yearly", remindDismissedAt: null },
  }, overrides || {});
}

function item(id, extra) {
  return Object.assign({ id, name:"Item "+id, location:"", assignedTo:"", tier:1, category:"people", checked:false, custom:false, source:"" }, extra || {});
}

// ── E1: grabItems — union by id ────────────────────────────────────────────────
describe("E1 — grabItems: union by id, no data loss", () => {
  it("disjoint items from local and remote are both present in result", () => {
    var local  = makeV2({ grabItems: [item("g01"), item("usr1")] });
    var remote = makeV2({ grabItems: [item("g01"), item("g02")] });
    var result = mergeSafeHarbor(local, remote);
    var ids = result.grabItems.map(function(i) { return i.id; });
    expect(ids).toContain("g01");
    expect(ids).toContain("g02");
    expect(ids).toContain("usr1");
  });

  it("items only on local side are preserved", () => {
    var local  = makeV2({ grabItems: [item("customLocal")] });
    var remote = makeV2({ grabItems: [] });
    var result = mergeSafeHarbor(local, remote);
    expect(result.grabItems.find(function(i) { return i.id === "customLocal"; })).toBeDefined();
  });

  it("items only on remote side are included", () => {
    var local  = makeV2({ grabItems: [] });
    var remote = makeV2({ grabItems: [item("remoteOnly")] });
    var result = mergeSafeHarbor(local, remote);
    expect(result.grabItems.find(function(i) { return i.id === "remoteOnly"; })).toBeDefined();
  });
});

// ── E2: grabItems — checked state local-wins ───────────────────────────────────
describe("E2 — grabItems: checked state — local-wins", () => {
  it("local checked=true is preserved even when remote has checked=false", () => {
    var local  = makeV2({ grabItems: [item("g01", { checked: true  })] });
    var remote = makeV2({ grabItems: [item("g01", { checked: false })] });
    var result = mergeSafeHarbor(local, remote);
    var found = result.grabItems.find(function(i) { return i.id === "g01"; });
    expect(found).toBeDefined();
    expect(found.checked).toBe(true);
  });

  it("local checked=false does not restore remote checked=true", () => {
    var local  = makeV2({ grabItems: [item("g01", { checked: false })] });
    var remote = makeV2({ grabItems: [item("g01", { checked: true  })] });
    var result = mergeSafeHarbor(local, remote);
    var found = result.grabItems.find(function(i) { return i.id === "g01"; });
    expect(found.checked).toBe(false);
  });

  it("remote-only items keep their remote checked state", () => {
    var local  = makeV2({ grabItems: [] });
    var remote = makeV2({ grabItems: [item("g05", { checked: true })] });
    var result = mergeSafeHarbor(local, remote);
    var found = result.grabItems.find(function(i) { return i.id === "g05"; });
    expect(found.checked).toBe(true);
  });
});

// ── E3: members — union by id ─────────────────────────────────────────────────
describe("E3 — members: union by id", () => {
  it("disjoint members from both sides are preserved", () => {
    var local  = makeV2({ members: [{ id:"m1", name:"Alice", role:"Adult", note:"" }] });
    var remote = makeV2({ members: [{ id:"m2", name:"Bob",   role:"Child", note:"" }] });
    var result = mergeSafeHarbor(local, remote);
    var ids = result.members.map(function(m) { return m.id; });
    expect(ids).toContain("m1");
    expect(ids).toContain("m2");
  });

  it("conflicting member id: remote-wins", () => {
    var local  = makeV2({ members: [{ id:"m1", name:"Alice Old", role:"Adult", note:"" }] });
    var remote = makeV2({ members: [{ id:"m1", name:"Alice New", role:"Adult", note:"updated" }] });
    var result = mergeSafeHarbor(local, remote);
    var found = result.members.find(function(m) { return m.id === "m1"; });
    expect(found.name).toBe("Alice New");
    expect(found.note).toBe("updated");
  });
});

// ── E4: contacts — field-by-field, prefer non-empty ───────────────────────────
describe("E4 — contacts: field-by-field merge", () => {
  it("local has data, remote is empty → local value preserved", () => {
    var local  = makeV2({ contacts: { meetNearby:"Front yard", meetAway:"", evacuatePrimary:"", evacuateBackup:"", outOfStateContact:"" } });
    var remote = makeV2({ contacts: { meetNearby:"",           meetAway:"", evacuatePrimary:"", evacuateBackup:"", outOfStateContact:"" } });
    var result = mergeSafeHarbor(local, remote);
    expect(result.contacts.meetNearby).toBe("Front yard");
  });

  it("remote has data, local is empty → remote value used", () => {
    var local  = makeV2({ contacts: { meetNearby:"", meetAway:"",       evacuatePrimary:"", evacuateBackup:"", outOfStateContact:"" } });
    var remote = makeV2({ contacts: { meetNearby:"", meetAway:"School", evacuatePrimary:"", evacuateBackup:"", outOfStateContact:"" } });
    var result = mergeSafeHarbor(local, remote);
    expect(result.contacts.meetAway).toBe("School");
  });

  it("both have data for same field → remote wins", () => {
    var local  = makeV2({ contacts: { meetNearby:"Old spot",  meetAway:"", evacuatePrimary:"", evacuateBackup:"", outOfStateContact:"" } });
    var remote = makeV2({ contacts: { meetNearby:"New corner", meetAway:"", evacuatePrimary:"", evacuateBackup:"", outOfStateContact:"" } });
    var result = mergeSafeHarbor(local, remote);
    expect(result.contacts.meetNearby).toBe("New corner");
  });
});

// ── E5: hazards and removedDefaultIds — union semantics ───────────────────────
describe("E5 — hazards and removedDefaultIds: union", () => {
  it("hazards from both sides are united (no duplicates)", () => {
    var local  = makeV2({ hazards: ["wildfire", "tornado"] });
    var remote = makeV2({ hazards: ["wildfire", "powerOutage"] });
    var result = mergeSafeHarbor(local, remote);
    expect(result.hazards.sort()).toEqual(["powerOutage", "tornado", "wildfire"].sort());
  });

  it("removedDefaultIds from both sides are united", () => {
    var local  = makeV2({ removedDefaultIds: ["g01"] });
    var remote = makeV2({ removedDefaultIds: ["g02"] });
    var result = mergeSafeHarbor(local, remote);
    expect(result.removedDefaultIds.sort()).toEqual(["g01", "g02"].sort());
  });
});

// ── E6: review fields — most-recent-wins ─────────────────────────────────────
describe("E6 — review fields: most-recent-wins", () => {
  it("lastReviewedAt: later ISO string wins", () => {
    var local  = makeV2({ review: { lastReviewedAt:"2025-06-01", cadence:"yearly", remindDismissedAt:null } });
    var remote = makeV2({ review: { lastReviewedAt:"2026-01-15", cadence:"yearly", remindDismissedAt:null } });
    var result = mergeSafeHarbor(local, remote);
    expect(result.review.lastReviewedAt).toBe("2026-01-15");
  });

  it("lastReviewedAt: local wins when local is later", () => {
    var local  = makeV2({ review: { lastReviewedAt:"2026-06-01", cadence:"yearly", remindDismissedAt:null } });
    var remote = makeV2({ review: { lastReviewedAt:"2025-03-01", cadence:"yearly", remindDismissedAt:null } });
    var result = mergeSafeHarbor(local, remote);
    expect(result.review.lastReviewedAt).toBe("2026-06-01");
  });

  it("remindDismissedAt: larger epoch-ms wins", () => {
    var local  = makeV2({ review: { lastReviewedAt:null, cadence:"yearly", remindDismissedAt:1000000 } });
    var remote = makeV2({ review: { lastReviewedAt:null, cadence:"yearly", remindDismissedAt:2000000 } });
    var result = mergeSafeHarbor(local, remote);
    expect(result.review.remindDismissedAt).toBe(2000000);
  });

  it("remindDismissedAt: null < any number (null means never dismissed)", () => {
    var local  = makeV2({ review: { lastReviewedAt:null, cadence:"yearly", remindDismissedAt:null    } });
    var remote = makeV2({ review: { lastReviewedAt:null, cadence:"yearly", remindDismissedAt:1234567 } });
    var result = mergeSafeHarbor(local, remote);
    expect(result.review.remindDismissedAt).toBe(1234567);
  });

  it("lastReviewed (top-level): later date wins", () => {
    var local  = makeV2({ lastReviewed:"2026-01-01" });
    var remote = makeV2({ lastReviewed:"2026-06-15" });
    var result = mergeSafeHarbor(local, remote);
    expect(result.lastReviewed).toBe("2026-06-15");
  });
});

// ── E7: null/missing inputs ────────────────────────────────────────────────────
describe("E7 — null or missing inputs handled gracefully", () => {
  it("local=null uses remote", () => {
    var remote = makeV2({ grabItems: [item("g01")], hazards: ["wildfire"] });
    var result = mergeSafeHarbor(null, remote);
    expect(result.grabItems.length).toBeGreaterThan(0);
    expect(result.hazards).toContain("wildfire");
  });

  it("remote=null uses local", () => {
    var local = makeV2({ grabItems: [item("g01")], hazards: ["tornado"] });
    var result = mergeSafeHarbor(local, null);
    expect(result.grabItems.find(function(i) { return i.id === "g01"; })).toBeDefined();
    expect(result.hazards).toContain("tornado");
  });

  it("both null returns a valid V2 shell", () => {
    var result = mergeSafeHarbor(null, null);
    expect(result).toHaveProperty("version");
    expect(result.grabItems).toBeDefined();
    expect(result.members).toBeDefined();
  });
});

// ── E8: mixed-version households — V1 blob normalised before merge ────────────
describe("E8 — mixed-version: V1 blob normalised before merge", () => {
  it("V1 remote blob (no version field) merges without throwing", () => {
    var local = makeV2({ grabItems: [item("g01", { checked: true })], hazards: ["wildfire"] });
    var v1Remote = {
      lastReviewed: "2025-12-01",
      contacts: { meetNearby:"Park", meetAway:"", evacuatePrimary:"", evacuateBackup:"", outOfStateContact:"" },
      members: [{ id:"m1", name:"Jordan", role:"Adult", note:"" }],
      grabItems: DEFAULT_GRAB_ITEMS.map(function(i) { return Object.assign({}, i); }),
      hazards: ["powerOutage"],
    };
    var result = mergeSafeHarbor(local, v1Remote);
    expect(result.version).toBe(2);
    // Local checked state preserved on matching item
    var g01 = result.grabItems.find(function(i) { return i.id === "g01"; });
    expect(g01).toBeDefined();
    expect(g01.checked).toBe(true);
    // Hazard union
    expect(result.hazards).toContain("wildfire");
    expect(result.hazards).toContain("powerOutage");
    // Contact from remote preserved
    expect(result.contacts.meetNearby).toBe("Park");
  });

  it("V2 device receiving V1 blob preserves local members that remote doesn't have", () => {
    var local = makeV2({ members: [{ id:"m99", name:"Extra", role:"Child", note:"" }] });
    var v1Remote = { members: [], grabItems: [], hazards: [] };
    var result = mergeSafeHarbor(local, v1Remote);
    expect(result.members.find(function(m) { return m.id === "m99"; })).toBeDefined();
  });
});

// ── E9: practice overlay isolation ────────────────────────────────────────────
describe("E9 — practice overlay: sessionChecked never appears in merged blob", () => {
  it("merged blob has no sessionChecked field", () => {
    var local  = makeV2();
    var remote = makeV2();
    var result = mergeSafeHarbor(local, remote);
    expect(result).not.toHaveProperty("sessionChecked");
  });

  it("merged blob has no session field", () => {
    var local  = makeV2();
    var remote = makeV2();
    var result = mergeSafeHarbor(local, remote);
    expect(result).not.toHaveProperty("session");
  });
});

// ── E10: rollback (flag OFF → device-local behavior unchanged) ─────────────────
describe("E10 — rollback: merge result is still valid for V1 loadData", () => {
  it("merged blob with V1 device loadData guards: grabItems is array", () => {
    var result = mergeSafeHarbor(makeV2({ grabItems: [item("g01")] }), makeV2({ grabItems: [item("g02")] }));
    expect(Array.isArray(result.grabItems)).toBe(true);
  });

  it("merged blob contacts is object (V1 loadData expects it)", () => {
    var result = mergeSafeHarbor(makeV2(), makeV2());
    expect(result.contacts !== null && typeof result.contacts === "object").toBe(true);
  });
});
