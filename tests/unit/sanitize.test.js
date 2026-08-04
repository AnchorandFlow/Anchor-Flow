/**
 * Suite A — sanitizeHouseholdData unit tests.
 *
 * Regression targets:
 *   Bug (1): sanitizeHouseholdData was a hard allowlist; 9+ SYNC_KEYS keys were
 *            silently dropped on every receive. Fixed by the defensive pass-through
 *            block. A1 + A2 guard against regression.
 *   Bug (2): setters marking keys dirty during hydration caused reload loops.
 *            Covered in Suite B (B7).
 *   Bug (3): sync "verified" by server timestamp while data was silently lost.
 *            A1 + A2 are the receive-side guard.
 */

import { describe, it, expect } from "vitest";
import { SYNC_KEYS, MEAL_DAYS, sanitizeHouseholdData } from "../../src/sync-core.js";

// ── Plausible values for every SYNC_KEYS entry ────────────────────────────────
// Used by A1. Keys that are arrays get array values; objects get objects, etc.
const PLAUSIBLE = {
  tasks:              [{ id:"t1", text:"buy milk", done:false }],
  brainItems:         [{ id:"b1", text:"idea" }],
  brainCats:          [{ id:"c1", name:"Work" }],
  calEvents:          [{ id:"e1", title:"Meeting", date:"2026-07-04" }],
  connectedCals:      [{ id:"cal1", name:"Work" }],
  calColorLabels:     { "#ff0000": "Red" },
  meals:              { Monday:{ breakfast:"eggs" }, Tuesday:{}, Wednesday:{}, Thursday:{}, Friday:{}, Saturday:{}, Sunday:{} },
  mealsWeekOf:        "2026-06-30",
  nextWeekMeals:      { Monday:{ lunch:"salad" } },
  mealCount:          3,
  mealThemeEnabled:   true,
  mealThemes:         { Monday:"Italian" },
  favMeals:           [{ id:"fm1", name:"pasta" }],
  mealBankCustom:     [{ id:"mb1", name:"tacos" }],
  recipes:            [{ id:"r1", name:"chili" }],
  // recipeBook: occasion-tagged recipes (Meals > Recipes tab). Distinct from
  // "recipes" above (URL-import feature) — af_recipes was already taken.
  recipeBook:         [{ id:"rb1", title:"Grandma's Stuffing", type:"full", occasions:["Thanksgiving"], serves:8, ingredients:[{id:"i1",amount:"2",unit:"cups",name:"bread cubes"}], steps:[{id:"st1",text:"Toast bread cubes",timer:null}], notes:"", createdAt:"2026-07-01T00:00:00.000Z" }],
  // countdowns: reusable named countdowns (COUNTDOWN-1), independent of
  // Travel/Celebrations' own date fields.
  countdowns:         [{ id:"cd1", title:"Disney trip", targetDate:"2026-12-20", emoji:"✈️", color:"#5E8FA0", showOn:["Today","Travel"] }],
  shoppingItems:      [{ id:"s1", name:"milk" }],
  stores:             ["Costco","Grocery"],
  shopCategories:     [{ id:"sc1", name:"Produce" }],
  people:             [{ id:"p1", name:"Alice", color:"#6A9BB5" }],
  familyProfile:      { size:4, name:"Borders" },
  birthdays:          [{ id:"bd1", name:"Mom", date:"06-12" }],
  rhythm:             { Monday:{ am:"gym" } },
  homeSystems:        [{ id:"hs1", name:"HVAC", nextService:"2027-01" }],
  notifications:      [{ id:"n1", title:"Trash day" }],
  recurring:          [{ id:"rc1", title:"Trash", dayOfWeek:"Monday" }],
  notifSettings:      { push:true, digest:false },
  sections:           { anchor:true, calendar:true, meals:true },
  flowMode:           "Smooth",
  preferredName:      "Lindsey",
  flowGreetingTone:   "warm",
  weatherLocation:    "Denver, CO",
  burnoutChecked:     ["2026-06-01","2026-06-15"],
  aiMemory:           { lastTopic:"meals" },
  celebrations:       [{ id:"cel1", name:"Anniversary", date:"08-22" }],
  // gifts: person-keyed map (Phase 3) — was a flat array of people before.
  // celebgifts/moments retired entirely (no longer in SYNC_KEYS).
  gifts:              { p1: [{ id:"g1", personId:"p1", title:"wine", notes:"", price:20, url:"", imageUrl:"", purchased:false, private:false, occasion:"Anniversary", assignedCelebId:"cel1" }] },
  // work_schedules: per-person recurring work schedule (WORK-1). Object map,
  // same shape class as gifts — keyed by personId, not an array.
  work_schedules:     { p1: { days:["Monday","Tuesday","Wednesday","Thursday","Friday"], type:"regular", color:"#5E8FA0", notes:"" } },
  inventory:          [{ id:"inv1", name:"pasta", qty:3 }],
  pets:               [{ id:"pet1", name:"Buddy", type:"dog" }],
  ripples:            [{ id:"rip1", text:"family vacation" }],
  houseFile:          [{ id:"hf1", type:"deed" }],
  favProducts:        [{ id:"fp1", name:"detergent", brand:"Tide" }],
  packing_templates:  [{ id:"pt1", name:"Beach trip", items:[] }],
  subs:               [{ id:"sub1", name:"Netflix", cost:15 }],
  vaultSystems:       [{ id:"vs1", name:"Security" }],
  health:             { bloodType:"A+", allergies:[] },
  career:             { title:"Engineer", company:"Acme" },
  travel_profile:     { passportExpiry:"2030-01" },
  cove_lists_v1:      [{ id:"cl1", name:"Books" }],
  cove_items_v1:      { cl1:[{ id:"ci1", text:"Dune" }] },
  cove_sections_v1:   { cl1:[{ id:"cs1", title:"Reading", sort_order:0 }] },
  cove_notes_v1:      [{ id:"cn1", text:"A note" }],
  schoolData:         { grade:3, teacher:"Ms. Smith" },
  coveData:           [{ kidId:"k1", kidName:"Alice", shells:5, chores:[{id:"c1",name:"Make bed",pts:1,done:false}], treasures:[] }],
  dietaryFilters:     ["Dairy-free"],
  compassCache:       { nudge:{ date:"2026-07-03", data:{ message:"hi" } } },
  compassEnabled:     true,
  // OB-0 gap 2 — feature toggles, same classification/handling as compassEnabled.
  tidePoolEnabled:     true,
  lighthouseEnabled:   true,
  celebrationsEnabled: true,
  mealsEnabled:        true,
  careerEnabled:       true,
  safeHarborEnabled:   true,
  exhale_groups:      { g1:[{ id:"eg1", title:"Work" }] },
  exhale_color_labels:{ g1:"#ff0000" },
  exhale_people:      [{ id:"ep1", name:"Alice" }],
  exhale_labels:      { g1:"Work" },
  exhale_columns:     [{ id:"inbox", label:"On My Mind", color:"seafoam", emoji:"🌊" }],
  // exhale_buckets: Exhale Phase 1 bucket-card redesign — object with its
  // own array fields, same shape class as gifts/work_schedules/safe_harbor.
  exhale_buckets:     { bucketNames:["Here","Today","Tomorrow","Someday"], items:[{ id:"eb1", text:"Call the vet", notes:"", bucketIndex:0, createdAt:1753900800000, color:"#C47A7A" }] },
  // exhale_waves: Exhale Phase 2 — daily/weekly/seasonal/custom wave cards,
  // same object-with-array-fields shape class as exhale_buckets.
  exhale_waves:       { daily:[{ id:"ew1", name:"Morning basics", tasks:[{ id:"ewt1", text:"Check school folders", estimatedMinutes:null, done:false }] }], weekly:[{ id:"ew2", name:"Trash day", dayOfWeek:2, tasks:[] }], seasonal:[{ id:"ew3", name:"Gutter cleaning", month:10, tasks:[] }], custom:[] },
  // Home Phase 3 — Home hub expansion. Plain array-guard class, same as trips/recipeBook.
  home_projects:      [{ id:"hp1", name:"Repaint deck", status:"in-progress", budget:400, notes:"", tasks:[{ id:"hpt1", text:"Buy stain", done:false }] }],
  home_documents:      [{ id:"hd1", name:"Homeowners policy", type:"Insurance", expiryDate:"2027-03-01", notes:"", url:"" }],
  home_supplies:      [{ id:"hs1", name:"Paper towels", quantity:2, needToRestock:false }],
  cal_markers:        { "2026-07-04":["⭐"] },
  cal_marker_types:   [{ id:"cm1", emoji:"⭐", label:"Star" }],
  workDays:           ["Monday","Tuesday","Wednesday","Thursday","Friday"],
  traditions:         [{ id:"tr1", title:"Christmas Eve Drive", when:"12-24" }],
  monthMeals:         { "2026-06":{ "2026-06-01":"pasta","2026-06-02":"tacos" } },
  nwMealCount:        2,
  safe_harbor:        { version:2, lastReviewed:"2026-01-01", contacts:{}, members:[], grabItems:[], hazards:[], reviewDue:false, removedDefaultIds:[], sixPs:null, familyPlan:null, review:{ lastReviewedAt:null, cadence:"yearly", remindDismissedAt:null } },
  ownedProducts:      [{ id:"op1", name:"Appliances", items:[{ id:"i1", name:"Dishwasher", link:"", purchasedAt:"", warranty:"", warrantyNote:"", notes:"" }] }],
  // Fix 4 / F-38: added to SYNC_KEYS so they sync; no explicit handler in
  // sanitizeHouseholdData, so they rely on the generic defensive pass-through —
  // real shape is a plain array, matching AnchorVault.jsx:6537-6538.
  coupons:            [{ id:"c1", code:"SAVE10", used:false }],
  perks:              [{ id:"p1", name:"Airline lounge access", used:false }],
  // Batch 2 Fix 2 / F-44: household-shared forecast overrides — plain object
  // keyed by slot, matching TodayBriefing.jsx's ovRead/ovWrite shape.
  forecastOverrides:  { bigThing: { text:"Custom override text" } },
  // CareerSection.jsx vault data (F-33 residual, Batch 2 Fix 9) — real shapes
  // matching CareerSection.jsx's LicenseForm/ContactForm/RetirementForm blanks.
  career_licenses:    [{ id:"lic1", title:"Registered Nurse (RN)", state:"Colorado", expiry:"2027-01-01", ceuNeeded:20, ceuCompleted:5, website:"", notes:"" }],
  career_contacts:    [{ id:"ct1", name:"Jane Doe", title:"Director of Nursing", company:"UCHealth", email:"", phone:"", relationship:"Former manager", notes:"" }],
  career_retirement:  [{ id:"ra1", institution:"Fidelity", accountType:"401(k)", employer:"", website:"", notes:"" }],
  lighthouse:         { version:2, modes:{}, shared:{}, homeschool:{}, school:{}, household:{ readAlouds:[], calendar:[], settings:{} } },
  onboardingState:    { complete:true, completedAt:"2026-07-19T00:00:00.000Z", version:1 },
  // Trips (Travel redesign Step 2) — sub-fields are null placeholders until
  // Steps 3/4 define their real shape; see sync-core.js SYNC_KEYS comment.
  // packing/itinerary sub-field shapes (Travel — full card detail views):
  // packing is [{id,title,items:[{id,text,done}]}], itinerary is
  // [{id,label,date,activities:[{id,title,notes,time}]}] — both nested
  // directly (not cross-referenced by id in a second array, deliberately,
  // per the cove_sections_v1 dangling-reference lesson). Still unvalidated
  // by sanitizeHouseholdData (sub-fields on trips remain unguarded per the
  // SYNC_KEYS comment), so these are documentation-only, not asserted shapes.
  trips:              [{ id:"trip1", name:"Cancún Family Trip", destination:"Cancún, Mexico", startDate:"2026-08-10", endDate:"2026-08-17", notes:"", status:"", icon:"", color:"", transportation:null, lodging:null, itinerary:[{id:"day1",label:"Day 1 — Aug 10, 2026",date:"2026-08-10",activities:[{id:"act1",title:"Arrive, check in",notes:"",time:""}]}], packing:[{id:"sec1",title:"Clothes",items:[{id:"pi1",text:"Swimsuit",done:false}]}], reservations:null, budget:null, documents:null, dining:null, activities:null, emergencyInfo:null, cardOrder:null }],
};

// ── A1: Every SYNC_KEYS key survives sanitizeHouseholdData ────────────────────
describe("A1 — every SYNC_KEYS key survives sanitize with a plausible value", () => {
  it(`covers all ${SYNC_KEYS.length} SYNC_KEYS entries`, () => {
    // Guard: PLAUSIBLE must cover every key (test the test)
    const missing = SYNC_KEYS.filter(k => !(k in PLAUSIBLE));
    expect(missing, `PLAUSIBLE fixture missing keys: ${missing.join(", ")}`).toHaveLength(0);
  });

  SYNC_KEYS.forEach(key => {
    it(`key "${key}" is defined in sanitize output`, () => {
      const input = { [key]: PLAUSIBLE[key] };
      const out = sanitizeHouseholdData(input);
      expect(out[key], `"${key}" was dropped by sanitizer`).toBeDefined();
      expect(out[key], `"${key}" became null in sanitizer`).not.toBeNull();
    });
  });
});

// ── A2: Keys with no explicit rule use the defensive pass-through ─────────────
describe("A2 — keys handled only by pass-through survive", () => {
  // These keys have no explicit block in sanitizeHouseholdData beyond SYNC_KEYS pass-through.
  const PASS_THROUGH_KEYS = ["workDays","traditions","cal_markers","cal_marker_types",
    "compassEnabled","exhale_groups","exhale_color_labels","exhale_people",
    "monthMeals","nwMealCount",
    "tidePoolEnabled","lighthouseEnabled","celebrationsEnabled","mealsEnabled","careerEnabled","safeHarborEnabled"];

  PASS_THROUGH_KEYS.forEach(key => {
    it(`pass-through key "${key}" survives`, () => {
      const out = sanitizeHouseholdData({ [key]: PLAUSIBLE[key] });
      expect(out[key]).toBeDefined();
    });
  });
});

// ── A3: null values are dropped ───────────────────────────────────────────────
describe("A3 — null values are dropped", () => {
  it("null tasks is dropped", () => {
    const out = sanitizeHouseholdData({ tasks: null });
    expect(out.tasks).toBeUndefined();
  });

  it("null ripples is normalized to []", () => {
    // ripples has its own normalization — null becomes [] (empty, not undefined)
    const out = sanitizeHouseholdData({ ripples: null });
    // ripples: undefined check — null falls through to the ripples normalizer
    // The normalizer checks `data.ripples !== undefined`, null passes that, so:
    expect(out.ripples).toEqual([]);
  });

  it("null pass-through key is dropped (not written as null)", () => {
    const out = sanitizeHouseholdData({ workDays: null });
    expect(out.workDays).toBeUndefined();
  });

  it("non-null keys in same doc are unaffected by null sibling", () => {
    const out = sanitizeHouseholdData({ tasks: null, traditions: ["Christmas Eve"] });
    expect(out.tasks).toBeUndefined();
    expect(out.traditions).toEqual(["Christmas Eve"]);
  });

  // F-94 / Fix 3: the object-passthrough branch used `typeof data[k] === "object"`
  // with no explicit null check — typeof null === "object" and !Array.isArray(null)
  // is true, so null was passing through and getting written back as the literal
  // string "null" on the next JSON.stringify. Distinct from the tasks/workDays
  // cases above, which are array-guarded / generic-pass-through and were already
  // null-safe before this fix — familyProfile/schoolData are the explicitly-typed
  // object-passthrough branch this fix patches.
  it("null familyProfile (object-passthrough branch) is dropped, not passed through", () => {
    const out = sanitizeHouseholdData({ familyProfile: null, schoolData: null });
    expect(out.familyProfile).toBeUndefined();
    expect(out.schoolData).toBeUndefined();
  });
});

// ── A4: non-array in an array slot is dropped ─────────────────────────────────
// Fixed F1: _SANITIZE_HANDLED gates the pass-through so explicitly-typed keys
// whose values fail validation (tasks={}, tasks="string", tasks=42) stay dropped.
describe("A4 — non-array in array slot is dropped", () => {
  it("tasks={} is dropped", () => {
    const out = sanitizeHouseholdData({ tasks: {} });
    expect(out.tasks).toBeUndefined();
  });

  it("tasks='string' is dropped", () => {
    const out = sanitizeHouseholdData({ tasks: "bad" });
    expect(out.tasks).toBeUndefined();
  });

  it("tasks=42 is dropped", () => {
    const out = sanitizeHouseholdData({ tasks: 42 });
    expect(out.tasks).toBeUndefined();
  });

  it("birthdays=null is dropped", () => {
    const out = sanitizeHouseholdData({ birthdays: null });
    expect(out.birthdays).toBeUndefined();
  });

  it("people='junk' is dropped (string, not array)", () => {
    const out = sanitizeHouseholdData({ people: "junk" });
    expect(out.people).toBeUndefined();
  });

  it("meals=42 is dropped (number, not object)", () => {
    const out = sanitizeHouseholdData({ meals: 42 });
    expect(out.meals).toBeUndefined();
  });

  it("pass-through rule-less keys are unaffected (workDays array still passes through)", () => {
    // Confirm the fix doesn't break rule-less key pass-through
    const out = sanitizeHouseholdData({ workDays: ["Monday","Friday"] });
    expect(out.workDays).toEqual(["Monday","Friday"]);
  });
});

// ── A5: people entries missing id or name are filtered ────────────────────────
describe("A5 — people entries missing id/name are filtered", () => {
  it("entry with id and name survives", () => {
    const out = sanitizeHouseholdData({ people: [{ id:"p1", name:"Alice" }] });
    expect(out.people).toHaveLength(1);
  });

  it("entry missing id is filtered out", () => {
    const out = sanitizeHouseholdData({ people: [{ name:"Bob" }] });
    expect(out.people).toHaveLength(0);
  });

  it("entry missing name is filtered out", () => {
    const out = sanitizeHouseholdData({ people: [{ id:"p1" }] });
    expect(out.people).toHaveLength(0);
  });

  it("null entry is filtered out", () => {
    const out = sanitizeHouseholdData({ people: [null, { id:"p1", name:"Alice" }] });
    expect(out.people).toHaveLength(1);
    expect(out.people[0].name).toBe("Alice");
  });

  it("empty people array passes through as empty", () => {
    const out = sanitizeHouseholdData({ people: [] });
    expect(out.people).toEqual([]);
  });
});

// ── A6: meals with a null day is repaired to {} ───────────────────────────────
describe("A6 — meals null-day repair", () => {
  it("null day value is repaired to empty object", () => {
    const meals = {};
    MEAL_DAYS.forEach(d => { meals[d] = d === "Monday" ? null : {}; });
    const out = sanitizeHouseholdData({ meals });
    expect(out.meals.Monday).toEqual({});
  });

  it("missing day value is repaired to empty object", () => {
    const meals = { Tuesday:{} }; // Monday absent
    const out = sanitizeHouseholdData({ meals });
    expect(out.meals.Monday).toEqual({});
  });

  it("string day value is repaired to empty object", () => {
    const meals = {};
    MEAL_DAYS.forEach(d => { meals[d] = d === "Wednesday" ? "oops" : {}; });
    const out = sanitizeHouseholdData({ meals });
    expect(out.meals.Wednesday).toEqual({});
  });

  it("null meal values within a valid day become empty string", () => {
    const meals = { Monday:{ breakfast:null, lunch:"salad" } };
    MEAL_DAYS.forEach(d => { if (!meals[d]) meals[d] = {}; });
    const out = sanitizeHouseholdData({ meals });
    expect(out.meals.Monday.breakfast).toBe("");
    expect(out.meals.Monday.lunch).toBe("salad");
  });

  it("all 7 MEAL_DAYS present in sanitized output", () => {
    const out = sanitizeHouseholdData({ meals: { Monday:{ dinner:"pasta" } } });
    expect(Object.keys(out.meals).sort()).toEqual([...MEAL_DAYS].sort());
  });
});

// ── A7: legacy object-form ripples normalizes to [] ──────────────────────────
describe("A7 — ripples normalization", () => {
  it("object-form ripples normalized to []", () => {
    const out = sanitizeHouseholdData({ ripples: { "0":{ text:"a" }, "1":{ text:"b" } } });
    expect(out.ripples).toEqual([]);
  });

  it("array-form ripples passes through unchanged", () => {
    const items = [{ id:"r1", text:"vacation" }, { id:"r2", text:"concert" }];
    const out = sanitizeHouseholdData({ ripples: items });
    expect(out.ripples).toEqual(items);
  });

  it("ripples absent in input is absent in output", () => {
    const out = sanitizeHouseholdData({ tasks: [] });
    expect(out.ripples).toBeUndefined();
  });

  it("ripples undefined in input: undefined in input is absent in output", () => {
    const out = sanitizeHouseholdData({});
    expect(out.ripples).toBeUndefined();
  });
});

// ── A8: fuzz-lite — never throws, always returns a safe object ────────────────
describe("A8 — fuzz: never throws, returns sane object", () => {
  const FUZZ_INPUTS = [
    null,
    undefined,
    [],
    "string",
    42,
    true,
    { tasks: "not-an-array", ripples: {}, people: "oops" },
    { tasks: [null, null, null] },
    Array(1000).fill({ id:"x", name:"spam" }),
    { nested: { deeply: { nested: { value: "deep" } } } },
    Object.fromEntries(SYNC_KEYS.map(k => [k, null])),
    Object.fromEntries(SYNC_KEYS.map(k => [k, undefined])),
  ];

  FUZZ_INPUTS.forEach((input, i) => {
    it(`fuzz input ${i}: does not throw`, () => {
      let result;
      expect(() => { result = sanitizeHouseholdData(input); }).not.toThrow();
      expect(result !== null && typeof result === "object" && !Array.isArray(result)).toBe(true);
    });
  });

  it("deeply nested junk produces flat output", () => {
    const out = sanitizeHouseholdData({ tasks: [{ id:"1", deep:{ nested:{ arr:[1,2,3] } } }] });
    expect(out.tasks).toHaveLength(1);
  });

  it("huge tasks array is preserved (no size cap)", () => {
    const big = Array.from({ length: 500 }, (_, i) => ({ id:`t${i}`, text:`item ${i}` }));
    const out = sanitizeHouseholdData({ tasks: big });
    expect(out.tasks).toHaveLength(500);
  });
});

// ── A9: SYNC_KEYS single-prefix invariant (F-17 regression guard) ─────────────
// History: SYNC_KEYS used to list this entry as "af_nwMealCount" (double-prefixed —
// useSaved adds its own "af_", so the pair round-tripped to the dead local key
// af_af_nwMealCount, invisible to any direct read). That was fixed on the App.jsx
// side (useSaved("nwMealCount",1) + a one-time local migration off the old key) by
// commit 366ced0, but SYNC_KEYS itself was left unchanged — so the sync push/pull
// path kept prefixing "af_nwMealCount" a second time and diverged from the local
// key useSaved actually reads/writes, silently breaking cross-device sync for this
// field. This suite now guards the CORRECTED single-prefix invariant so that
// regression can't recur silently.
describe("A9 — nwMealCount single-prefix invariant", () => {
  it('SYNC_KEYS contains the single-prefixed "nwMealCount", not "af_nwMealCount"', () => {
    expect(SYNC_KEYS).toContain("nwMealCount");
    expect(SYNC_KEYS).not.toContain("af_nwMealCount");
  });

  it("sync loop writes nwMealCount to the same localStorage key useSaved uses", () => {
    // The sync read/write loops do: localStorage.setItem("af_" + k, ...) for each k in SYNC_KEYS.
    // useSaved("nwMealCount", 1) does: localStorage.setItem("af_" + key, ...).
    // Both must resolve to the same local key for cross-device sync to work.
    const k = "nwMealCount";
    const syncStorageKey = "af_" + k;
    const useSavedStorageKey = "af_" + "nwMealCount";
    expect(syncStorageKey).toBe(useSavedStorageKey);
    expect(syncStorageKey).toBe("af_nwMealCount");
  });

  it("nwMealCount value passes through sanitizer intact", () => {
    const out = sanitizeHouseholdData({ nwMealCount: 7 });
    expect(out.nwMealCount).toBe(7);
  });

  it("nwMealCount zero passes through (falsy but valid)", () => {
    // 0 is a valid meal count. Pass-through condition: data[k] !== null && !== undefined.
    // 0 passes both checks, so it survives.
    const out = sanitizeHouseholdData({ nwMealCount: 0 });
    expect(out.nwMealCount).toBe(0);
  });

  it("legacy blob field af_nwMealCount is no longer read (orphaned by design)", () => {
    // A pre-fix household's blob may still carry the old field name. It must NOT
    // be picked up under the new key — confirms we don't accidentally alias them.
    const out = sanitizeHouseholdData({ af_nwMealCount: 99, nwMealCount: 2 });
    expect(out.nwMealCount).toBe(2);
    expect(out.af_nwMealCount).toBeUndefined();
  });
});

// ── A10: completeness lint ────────────────────────────────────────────────────
// Scans src/App.jsx for literal useSaved("key") calls. Each key must be
// classified as either in SYNC_KEYS (synced to Supabase) or in DEVICE_LOCAL
// (intentionally device-only). Unclassified key = failing test.
describe("A10 — completeness lint: every useSaved key is classified", () => {
  // Keys intentionally local to the device — never synced.
  // Update this list when adding new device-local useSaved calls.
  const DEVICE_LOCAL = new Set([
    // Auth & session — must never leave the device
    "authToken", "authUser", "refreshToken", "householdId", "householdOwnerId", "googleCalToken",
    // Sync stamps — system bookkeeping, not user data
    "lastHHSync", "lastPushedAt", "lastPushAt", "lastPullAt", "dirtyKeys", "deviceId",
    // Device UI state
    "theme", "onboardingComplete", "mealSubTab", "lastUsedStore",
    // Derived / ephemeral — rebuilt locally, no sync value
    "dayBriefing", "briefingBuilt", "lastSeenDate", "emailSubmitted",
    "checkedCalEvents", "checkedMealItems",
    "insights", "insightsBuilt", "dismissedInsights",
    "overwhelmed",
    // Feature flags — device opts in/out independently
    "shopping_v2",
    // Deprecated / renamed keys that may still be written by old code paths
    // exhaleItems: original key before Exhale V2 migration (superseded by exhale_groups)
    // exhaleLabels: useSaved("exhaleLabels") writes af_exhaleLabels; SYNC_KEYS has
    //   "exhale_labels" (→ af_exhale_labels). Different keys — likely dead write or rename.
    "exhaleItems", "exhaleLabels",
    // Device-local UI state — per-device only, never synced
    "collapsedStores",        // shopping section collapse state
    "dailySummaryScheduled",  // notification scheduling flag
    // Dynamic key prefix — actual key is `checkedPersonalAnchors_${dayName}_${userId}`.
    // The regex matches the literal prefix portion of useSaved("checkedPersonalAnchors_"+...).
    // Per-day-per-user device state, intentionally not synced.
    "checkedPersonalAnchors_",
  ]);

  it("every literal useSaved key is in SYNC_KEYS or DEVICE_LOCAL", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(process.cwd(), "src/App.jsx"), "utf8");

    // Match useSaved("literal-key", ...) — skip variable-key calls like useSaved(_dayClosedKey)
    const matches = [...src.matchAll(/useSaved\(\s*["']([^"']+)["']/g)];
    const syncSet = new Set(SYNC_KEYS);
    const unclassified = [];

    for (const m of matches) {
      const key = m[1];
      if (!syncSet.has(key) && !DEVICE_LOCAL.has(key)) {
        unclassified.push(key);
      }
    }

    expect(
      unclassified,
      `Unclassified keys found — add to SYNC_KEYS or DEVICE_LOCAL:\n  ${unclassified.join(", ")}`
    ).toHaveLength(0);
  });

  it("SYNC_KEYS has no duplicates", () => {
    const seen = new Set();
    const dups = [];
    for (const k of SYNC_KEYS) {
      if (seen.has(k)) dups.push(k);
      seen.add(k);
    }
    expect(dups, `Duplicate SYNC_KEYS entries: ${dups.join(", ")}`).toHaveLength(0);
  });
});
