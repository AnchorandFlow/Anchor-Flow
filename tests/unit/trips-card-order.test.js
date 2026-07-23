// tests/unit/trips-card-order.test.js
// Verifies the onCardDrop fix in TripsSection (src/components/AnchorVault.jsx).
// onCardDrop is a closure defined inside TripsSection's render — not a module
// export, and AnchorVault.jsx is too large/side-effect-heavy to mount directly in
// a unit test. These are verbatim mirrors of the pure array logic (kept in sync
// manually with the real functions), run against concrete before/after states.

import { describe, it, expect } from "vitest";

// Mirror of the OLD (buggy) onCardDrop core logic — splices against raw storage
// using indices that come from the filtered/rendered list. Kept here only to prove
// the bug concretely, side by side with the fix.
function oldBuggyDrop(from, idx, rawOrDefaultOrder) {
  var order = rawOrDefaultOrder.slice();
  var moved = order.splice(from, 1)[0];
  order.splice(idx, 0, moved);
  return order;
}

// Mirror of the FIXED onCardDrop core logic (src/components/AnchorVault.jsx).
function fixedDrop(from, idx, cardOrder, rawOrder, availableCardIds) {
  var visible = cardOrder.slice();
  var moved = visible.splice(from, 1)[0];
  visible.splice(idx, 0, moved);
  var preserved = rawOrder.filter(function (id) {
    return visible.indexOf(id) === -1 && availableCardIds.indexOf(id) === -1;
  });
  return visible.concat(preserved);
}

var DEFAULT_CARD_ORDER = ["transportation","lodging","packing","itinerary","activities","reservations","budget","documents","dining","weather","notes","emergencyInfo","photos"];
var AVAILABLE_NOT_COMPLETED = DEFAULT_CARD_ORDER.filter(function (id) { return id !== "photos"; });
var AVAILABLE_COMPLETED = DEFAULT_CARD_ORDER.slice();

describe("onCardDrop fix — Case A: never customized, not Completed", function () {
  it("fixed version reorders correctly and preserves photos at the tail", function () {
    var cardOrder = AVAILABLE_NOT_COMPLETED; // 12 items, what's rendered
    var rawOrder = DEFAULT_CARD_ORDER; // fallback used inside the function, 13 items
    var result = fixedDrop(5, 2, cardOrder, rawOrder, AVAILABLE_NOT_COMPLETED);
    expect(result).toEqual([
      "transportation","lodging","reservations","packing","itinerary","activities",
      "budget","documents","dining","weather","notes","emergencyInfo","photos"
    ]);
  });

  it("old buggy version happens to match on this case (photos at raw tail is harmless)", function () {
    var result = oldBuggyDrop(5, 2, DEFAULT_CARD_ORDER);
    expect(result).toEqual([
      "transportation","lodging","reservations","packing","itinerary","activities",
      "budget","documents","dining","weather","notes","emergencyInfo","photos"
    ]);
  });
});

describe("onCardDrop fix — Case C: photos stranded mid-list after Completed -> un-Completed", function () {
  // Trip was Completed, user dragged "photos" to raw index 1 (non-tail), then status
  // changed away from Completed. availableCardIds now excludes photos.
  var rawOrder = ["transportation","photos","lodging","packing","itinerary","activities","reservations","budget","documents","dining","weather","notes","emergencyInfo"];
  var cardOrder = rawOrder.filter(function (id) { return AVAILABLE_NOT_COMPLETED.indexOf(id) !== -1; }); // what's rendered — photos dropped

  it("filtered cardOrder correctly excludes photos", function () {
    expect(cardOrder).toEqual(["transportation","lodging","packing","itinerary","activities","reservations","budget","documents","dining","weather","notes","emergencyInfo"]);
  });

  it("fixed version: dragging filtered-index 0 to filtered-index 5 lands transportation right after reservations, and preserves photos", function () {
    var result = fixedDrop(0, 5, cardOrder, rawOrder, AVAILABLE_NOT_COMPLETED);
    expect(result).toEqual([
      "lodging","packing","itinerary","activities","reservations","transportation",
      "budget","documents","dining","weather","notes","emergencyInfo","photos"
    ]);
  });

  it("old buggy version: the SAME drag gesture (same from/idx) lands transportation in the wrong place because it splices raw indices", function () {
    var result = oldBuggyDrop(0, 5, rawOrder);
    // transportation ends up BEFORE reservations, not after — a different, wrong
    // result for the identical user gesture, because raw index 5 (post-removal of
    // transportation) landed on a different card than filtered index 5 did.
    expect(result).toEqual([
      "photos","lodging","packing","itinerary","activities","transportation",
      "reservations","budget","documents","dining","weather","notes","emergencyInfo"
    ]);
    // Concretely: the two implementations diverge for the identical gesture.
    var fixedResult = fixedDrop(0, 5, cardOrder, rawOrder, AVAILABLE_NOT_COMPLETED);
    expect(result).not.toEqual(fixedResult);
  });

  it("fixed version never drops photos from storage, even across repeated drags", function () {
    var r1 = fixedDrop(0, 5, cardOrder, rawOrder, AVAILABLE_NOT_COMPLETED);
    expect(r1.indexOf("photos")).not.toBe(-1);
    var cardOrder2 = r1.filter(function (id) { return AVAILABLE_NOT_COMPLETED.indexOf(id) !== -1; });
    var r2 = fixedDrop(3, 0, cardOrder2, r1, AVAILABLE_NOT_COMPLETED);
    expect(r2.indexOf("photos")).not.toBe(-1);
  });
});

describe("onCardDrop fix — while Completed (photos available), raw and filtered agree", function () {
  it("fixed version behaves identically to a plain splice when nothing is filtered", function () {
    var cardOrder = DEFAULT_CARD_ORDER; // photos included, since Completed
    var rawOrder = DEFAULT_CARD_ORDER;
    var result = fixedDrop(12, 0, cardOrder, rawOrder, AVAILABLE_COMPLETED);
    expect(result).toEqual([
      "photos","transportation","lodging","packing","itinerary","activities",
      "reservations","budget","documents","dining","weather","notes","emergencyInfo"
    ]);
  });
});
