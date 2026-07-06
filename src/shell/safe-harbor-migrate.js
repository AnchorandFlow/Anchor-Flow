// src/shell/safe-harbor-migrate.js
// Extracted from SafeHarbor.jsx so migrateToV2 and the default constants can be
// imported by unit tests without pulling in React or JSX.
// No side effects at module scope — localStorage is only touched inside migrateToV2().
// mergeSafeHarbor is also exported here for use by applyHouseholdKey in sync-core.js.

export var DEFAULT_GRAB_ITEMS = [
  // Tier 1 — People & Pets
  { id:"g01", defaultId:"g01", name:"All household members accounted for",    location:"", assignedTo:"", tier:1, category:"people",        checked:false, custom:false, source:"people and their needs are the first priority" },
  { id:"g02", defaultId:"g02", name:"Pets + leash or carrier",                location:"", assignedTo:"", tier:1, category:"people",        checked:false, custom:false, source:"animals, food, water and supplies for your pet" },
  // Tier 1 — Prescriptions
  { id:"g03", defaultId:"g03", name:"Prescription medications",               location:"Medicine cabinet", assignedTo:"", tier:1, category:"prescriptions", checked:false, custom:false, source:"prescription medications are a basic kit essential" },
  { id:"g04", defaultId:"g04", name:"First aid kit",                          location:"", assignedTo:"", tier:1, category:"prescriptions", checked:false, custom:false, source:"first aid kit is a basic kit essential" },
  // Tier 1 — Papers
  { id:"g05", defaultId:"g05", name:"Passports + birth certificates",         location:"", assignedTo:"", tier:1, category:"papers",        checked:false, custom:false, source:"identification in a waterproof portable container" },
  { id:"g06", defaultId:"g06", name:"Insurance policies",                     location:"", assignedTo:"", tier:1, category:"papers",        checked:false, custom:false, source:"copies of insurance policies in waterproof container" },
  // Tier 1 — Phones & Tech
  { id:"g07", defaultId:"g07", name:"Phones + chargers + power bank",         location:"", assignedTo:"", tier:1, category:"phones",        checked:false, custom:false, source:"cell phones with chargers and a backup battery" },
  { id:"g08", defaultId:"g08", name:"Keys + wallets",                         location:"", assignedTo:"", tier:1, category:"phones",        checked:false, custom:false, source:"keys and cash for your emergency kit" },
  // Tier 1 — Personal Needs
  { id:"g09", defaultId:"g09", name:"Water — 1 gallon per person per day",    location:"", assignedTo:"", tier:1, category:"personal",      checked:false, custom:false, source:"water is the first basic kit essential" },
  // Tier 2 — People & Pets
  { id:"g10", defaultId:"g10", name:"Pet food + water supply",                location:"", assignedTo:"", tier:2, category:"people",        checked:false, custom:false, source:"pet food, water and supplies for your pet" },
  // Tier 2 — Prescriptions
  { id:"g11", defaultId:"g11", name:"Non-prescription medications",           location:"", assignedTo:"", tier:2, category:"prescriptions", checked:false, custom:false, source:"pain relievers, anti-diarrhea medication, antacids" },
  // Tier 2 — Papers
  { id:"g12", defaultId:"g12", name:"Bank account records + cash in small bills", location:"", assignedTo:"", tier:2, category:"papers",   checked:false, custom:false, source:"bank account records and cash" },
  // Tier 2 — Phones & Tech
  { id:"g13", defaultId:"g13", name:"Battery-powered or hand-crank radio",    location:"", assignedTo:"", tier:2, category:"phones",        checked:false, custom:false, source:"NOAA Weather Radio with tone alert is a basic kit essential" },
  { id:"g14", defaultId:"g14", name:"Flashlights + extra batteries",          location:"", assignedTo:"", tier:2, category:"phones",        checked:false, custom:false, source:"flashlight is a basic kit essential" },
  { id:"g15", defaultId:"g15", name:"Laptop or external hard drive",          location:"", assignedTo:"", tier:2, category:"phones",        checked:false, custom:false, source:"additional items — computers" },
  // Tier 2 — Personal Needs
  { id:"g16", defaultId:"g16", name:"Non-perishable food — 3-day supply",     location:"", assignedTo:"", tier:2, category:"personal",      checked:false, custom:false, source:"food is the second basic kit essential" },
  { id:"g17", defaultId:"g17", name:"Feminine supplies + hand sanitizer",     location:"", assignedTo:"", tier:2, category:"personal",      checked:false, custom:false, source:"feminine supplies and personal hygiene items" },
  { id:"g18", defaultId:"g18", name:"Infant supplies if applicable",          location:"", assignedTo:"", tier:2, category:"personal",      checked:false, custom:false, source:"infant formula and diapers" },
  // Tier 3 — Personal Needs
  { id:"g19", defaultId:"g19", name:"Sleeping bags or warm blankets",         location:"", assignedTo:"", tier:3, category:"personal",      checked:false, custom:false, source:"sleeping bag or warm blanket for each person" },
  { id:"g20", defaultId:"g20", name:"Change of clothing + sturdy shoes",      location:"", assignedTo:"", tier:3, category:"personal",      checked:false, custom:false, source:"complete change of clothing including sturdy shoes" },
  // Tier 3 — Priceless Items
  { id:"g21", defaultId:"g21", name:"Irreplaceable photos or keepsakes",      location:"", assignedTo:"", tier:3, category:"priceless",     checked:false, custom:false, source:"additional items — irreplaceable items" },
]

export var DEFAULT_DATA = {
  lastReviewed: null,
  contacts: { meetNearby:"", meetAway:"", evacuatePrimary:"", evacuateBackup:"", outOfStateContact:"" },
  members: [],
  grabItems: DEFAULT_GRAB_ITEMS,
  hazards: [],
  reviewDue: false,
  removedDefaultIds: [],
}

// migrateToV2(saved) — upgrade a V1 af_safe_harbor blob to the V2 shape.
//
// Tolerances:
//   - null/non-object saved: builds clean V2 defaults (same as a fresh install).
//   - pre-SH-1 blobs:        synthesizes missing defaultIds by name-matching against
//                            DEFAULT_GRAB_ITEMS; inits removedDefaultIds if absent.
//   - already-migrated blob: fully idempotent — running twice is deep-equal.
//
// Side effects:
//   - Reads af_sh_remind from localStorage (raw epoch-ms string, NOT JSON).
//   - Removes af_sh_remind after absorption. af_safe_harbor becomes the single
//     source of truth for the dismiss timestamp.
//
// The function is safe to call directly from tests (jsdom supplies localStorage).
export function migrateToV2(saved) {
  // Guard: null or non-object input → build clean V2 defaults (e.g. localStorage held "null").
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    saved = Object.assign({}, DEFAULT_DATA, {
      grabItems: DEFAULT_GRAB_ITEMS.map(function(i) { return Object.assign({}, i) }),
    })
  }

  // Absorb af_sh_remind (raw epoch-ms string, NOT JSON-encoded) into review.remindDismissedAt.
  // parseInt("0") evaluates to 0, which is falsy, so "0" maps to null.
  // This is intentional: 0 = epoch Jan 1 1970, effectively "never dismissed",
  // and null is a cleaner sentinel for "dismiss timestamp not set".
  var rawRemind = localStorage.getItem("af_sh_remind")
  var absorbedRemindAt = rawRemind !== null ? (parseInt(rawRemind) || null) : null
  if (rawRemind !== null) {
    try { localStorage.removeItem("af_sh_remind") } catch(_e) {}
  }

  // Synthesize missing defaultIds for devices that never loaded the SH-1 build.
  // SH-1 added defaultId to each default item; older blobs use name as the match key.
  var nameToDefaultId = {}
  DEFAULT_GRAB_ITEMS.forEach(function(d) { nameToDefaultId[d.name] = d.defaultId })
  var migratedItems = (Array.isArray(saved.grabItems) ? saved.grabItems : []).map(function(item) {
    if (item.defaultId) return item
    var matchedId = nameToDefaultId[item.name]
    return matchedId ? Object.assign({}, item, { defaultId: matchedId }) : item
  })

  // Ensure removedDefaultIds is an array (may be absent in pre-SH-1 blobs
  // when migrateToV2 is called directly, without going through loadData's guards).
  var removedDefaultIds = Array.isArray(saved.removedDefaultIds) ? saved.removedDefaultIds : []

  var existingReview = (saved.review && typeof saved.review === "object") ? saved.review : {}
  return Object.assign({}, saved, {
    version: 2,
    grabItems: migratedItems,
    removedDefaultIds: removedDefaultIds,
    sixPs:      saved.sixPs      !== undefined ? saved.sixPs      : null,
    familyPlan: saved.familyPlan !== undefined ? saved.familyPlan : null,
    review: {
      lastReviewedAt:    existingReview.lastReviewedAt    || null,
      cadence:           existingReview.cadence           || "yearly",
      // Prefer existing V2 value if blob was already partly migrated; fall back to absorbed.
      remindDismissedAt: existingReview.remindDismissedAt !== undefined
        ? existingReview.remindDismissedAt
        : absorbedRemindAt,
    },
  })
}

// ── mergeSafeHarbor ────────────────────────────────────────────────────────────
// Merge-on-receive for the af_safe_harbor blob.
// Called by applyHouseholdKey (sync-core.js) at every apply site instead of
// overwriting af_safe_harbor wholesale.
//
// Rules:
//   grabItems  — union by id; remote-wins on field conflicts; local-wins on checked
//   members    — union by id; remote-wins on conflicts
//   contacts   — field-by-field: prefer non-empty; if both non-empty, remote-wins
//   hazards    — union (set semantics)
//   removedDefaultIds — union (set semantics) — tombstones for default items
//   review.lastReviewedAt  — later ISO string wins
//   review.remindDismissedAt — later epoch-ms wins (null < any number)
//   review.cadence — remote-wins
//   lastReviewed — later ISO string wins (V1 compat field)
//   sixPs, familyPlan — remote-wins (future structured fields)
//
// Deletion of custom items does NOT propagate in v1 (union only). Documented.
// Default item removals DO propagate via removedDefaultIds union.

function laterIso(a, b) {
  // Returns the lexicographically greater ISO date string, or the non-null one.
  if (!a) return b || null;
  if (!b) return a;
  return a >= b ? a : b;
}

function laterMs(a, b) {
  // Returns the larger epoch-ms number, or the non-null one.
  if (a === null || a === undefined) return (b !== null && b !== undefined) ? b : null;
  if (b === null || b === undefined) return a;
  return a >= b ? a : b;
}

function normalizeForMerge(blob) {
  // Returns a V2-compatible object suitable for merging. No localStorage side effects.
  if (!blob || typeof blob !== "object" || Array.isArray(blob)) {
    return {
      version: 1, lastReviewed: null,
      contacts: { meetNearby:"", meetAway:"", evacuatePrimary:"", evacuateBackup:"", outOfStateContact:"" },
      members: [], grabItems: [], hazards: [], reviewDue: false, removedDefaultIds: [],
      sixPs: null, familyPlan: null,
      review: { lastReviewedAt: null, cadence: "yearly", remindDismissedAt: null },
    };
  }
  var rev = (blob.review && typeof blob.review === "object") ? blob.review : {};
  return Object.assign({
    version: blob.version || 1, lastReviewed: blob.lastReviewed || null, reviewDue: blob.reviewDue || false,
    sixPs: blob.sixPs !== undefined ? blob.sixPs : null,
    familyPlan: blob.familyPlan !== undefined ? blob.familyPlan : null,
    contacts: (blob.contacts && typeof blob.contacts === "object") ? blob.contacts : {},
  }, {
    members: Array.isArray(blob.members) ? blob.members : [],
    grabItems: Array.isArray(blob.grabItems) ? blob.grabItems : [],
    hazards: Array.isArray(blob.hazards) ? blob.hazards : [],
    removedDefaultIds: Array.isArray(blob.removedDefaultIds) ? blob.removedDefaultIds : [],
    review: {
      lastReviewedAt:    rev.lastReviewedAt    !== undefined ? rev.lastReviewedAt    : null,
      cadence:           rev.cadence                        || "yearly",
      remindDismissedAt: rev.remindDismissedAt !== undefined ? rev.remindDismissedAt : null,
    },
  });
}

export function mergeSafeHarbor(local, remote) {
  var L = normalizeForMerge(local);
  var R = normalizeForMerge(remote);

  // grabItems: union by id; local-wins on checked; remote-wins on everything else
  var itemMap = {};
  R.grabItems.forEach(function(item) { if (item && item.id) itemMap[item.id] = item; });
  L.grabItems.forEach(function(item) {
    if (!item || !item.id) return;
    if (itemMap[item.id]) {
      // Preserve local checked state — never clobber a live emergency checklist
      itemMap[item.id] = Object.assign({}, itemMap[item.id], { checked: item.checked });
    } else {
      itemMap[item.id] = item; // item only on local side
    }
  });

  // members: union by id; remote-wins on conflicts
  var memberMap = {};
  R.members.forEach(function(m) { if (m && m.id) memberMap[m.id] = m; });
  L.members.forEach(function(m) { if (m && m.id && !memberMap[m.id]) memberMap[m.id] = m; });

  // hazards: union
  var hazardSet = {};
  R.hazards.forEach(function(h) { hazardSet[h] = true; });
  L.hazards.forEach(function(h) { hazardSet[h] = true; });

  // removedDefaultIds: union
  var ridSet = {};
  R.removedDefaultIds.forEach(function(id) { ridSet[id] = true; });
  L.removedDefaultIds.forEach(function(id) { ridSet[id] = true; });

  // contacts: field-by-field; prefer non-empty; if both non-empty, remote wins
  var CONTACT_KEYS = ["meetNearby", "meetAway", "evacuatePrimary", "evacuateBackup", "outOfStateContact"];
  var mergedContacts = {};
  CONTACT_KEYS.forEach(function(k) {
    var r = (R.contacts[k] || "").trim();
    var l = (L.contacts[k] || "").trim();
    mergedContacts[k] = r || l; // remote wins if both non-empty; falls back to local
  });

  return {
    version: 2,
    lastReviewed: laterIso(L.lastReviewed, R.lastReviewed),
    contacts: mergedContacts,
    members: Object.values(memberMap),
    grabItems: Object.values(itemMap),
    hazards: Object.keys(hazardSet),
    reviewDue: R.reviewDue || L.reviewDue || false,
    removedDefaultIds: Object.keys(ridSet),
    sixPs:      R.sixPs      !== null ? R.sixPs      : L.sixPs,
    familyPlan: R.familyPlan !== null ? R.familyPlan : L.familyPlan,
    review: {
      lastReviewedAt:    laterIso(L.review.lastReviewedAt,    R.review.lastReviewedAt),
      cadence:           R.review.cadence || L.review.cadence || "yearly",
      remindDismissedAt: laterMs(L.review.remindDismissedAt,  R.review.remindDismissedAt),
    },
  };
}
