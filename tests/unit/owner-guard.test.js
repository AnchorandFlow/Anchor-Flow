// tests/unit/owner-guard.test.js
// ★ F1 — HouseholdModal owner/member branch logic (pure predicate tests)
// Verifies the isOwner / isMember detection used to show the leave-household
// button vs. the owner-cannot-leave explainer.  No React rendering needed.

import { describe, it, expect } from "vitest";

// Pure predicates extracted from HouseholdModal's inline logic so they are
// independently testable.  Keep in sync with App.jsx HouseholdModal preamble.
function computeOwnerStatus(authUser, householdId, householdOwnerId) {
  var isOwner = !!(authUser && authUser.id && householdId && householdOwnerId && authUser.id === householdOwnerId);
  var isMember = !!(authUser && authUser.id && householdId && !isOwner);
  return { isOwner: isOwner, isMember: isMember };
}

describe("F1 — household owner/member detection", function() {
  it("F1-1: owner sees owner UI when userId matches ownerId", function() {
    var r = computeOwnerStatus({ id: "u1" }, "hh_abc", "u1");
    expect(r.isOwner).toBe(true);
    expect(r.isMember).toBe(false);
  });

  it("F1-2: member sees member UI when userId differs from ownerId", function() {
    var r = computeOwnerStatus({ id: "u2" }, "hh_abc", "u1");
    expect(r.isOwner).toBe(false);
    expect(r.isMember).toBe(true);
  });

  it("F1-3: no household → neither owner nor member", function() {
    var r = computeOwnerStatus({ id: "u1" }, null, "u1");
    expect(r.isOwner).toBe(false);
    expect(r.isMember).toBe(false);
  });

  it("F1-4: null authUser → neither owner nor member", function() {
    var r = computeOwnerStatus(null, "hh_abc", "u1");
    expect(r.isOwner).toBe(false);
    expect(r.isMember).toBe(false);
  });

  it("F1-5: ownerId null (not yet fetched) → not detected as owner, shown as member if household exists", function() {
    var r = computeOwnerStatus({ id: "u1" }, "hh_abc", null);
    expect(r.isOwner).toBe(false);
    expect(r.isMember).toBe(true);
  });

  it("F1-6: all null → neither", function() {
    var r = computeOwnerStatus(null, null, null);
    expect(r.isOwner).toBe(false);
    expect(r.isMember).toBe(false);
  });

  it("F1-7: authUser.id empty string → treated as unsigned, neither owner nor member", function() {
    var r = computeOwnerStatus({ id: "" }, "hh_abc", "u1");
    expect(r.isOwner).toBe(false);
    expect(r.isMember).toBe(false);
  });
});
