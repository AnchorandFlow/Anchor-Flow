// src/shell/safe-harbor-migrate.js
// Extracted from SafeHarbor.jsx so migrateToV2 and the default constants can be
// imported by unit tests without pulling in React or JSX.
// No side effects at module scope — localStorage is only touched inside migrateToV2().

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
