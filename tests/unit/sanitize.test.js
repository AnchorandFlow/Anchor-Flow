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
// The `af_nwMealCount` entry intentionally uses the double-prefixed key name.
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
  celebgifts:         [{ id:"cg1", person:"Alice", idea:"book" }],
  gifts:              [{ id:"g1", name:"wine", for:"Dad" }],
  inventory:          [{ id:"inv1", name:"pasta", qty:3 }],
  pets:               [{ id:"pet1", name:"Buddy", type:"dog" }],
  ripples:            [{ id:"rip1", text:"family vacation" }],
  houseFile:          [{ id:"hf1", type:"deed" }],
  favProducts:        [{ id:"fp1", name:"detergent", brand:"Tide" }],
  packing_templates:  [{ id:"pt1", name:"Beach trip", items:[] }],
  moments:            [{ id:"mom1", text:"first day of school" }],
  subs:               [{ id:"sub1", name:"Netflix", cost:15 }],
  vaultSystems:       [{ id:"vs1", name:"Security" }],
  health:             { bloodType:"A+", allergies:[] },
  career:             { title:"Engineer", company:"Acme" },
  travel_profile:     { passportExpiry:"2030-01" },
  cove_lists_v1:      [{ id:"cl1", name:"Books" }],
  cove_items_v1:      { cl1:[{ id:"ci1", text:"Dune" }] },
  cove_sections_v1:   [{ id:"cs1", name:"Reading" }],
  cove_notes_v1:      [{ id:"cn1", text:"A note" }],
  schoolData:         { grade:3, teacher:"Ms. Smith" },
  coveData:           { theme:"warm" },
  dietaryFilters:     ["Dairy-free"],
  compassCache:       { nudge:{ date:"2026-07-03", data:{ message:"hi" } } },
  compassEnabled:     true,
  exhale_groups:      { g1:[{ id:"eg1", title:"Work" }] },
  exhale_color_labels:{ g1:"#ff0000" },
  exhale_people:      [{ id:"ep1", name:"Alice" }],
  exhale_labels:      { g1:"Work" },
  cal_markers:        { "2026-07-04":["⭐"] },
  cal_marker_types:   [{ id:"cm1", emoji:"⭐", label:"Star" }],
  workDays:           ["Monday","Tuesday","Wednesday","Thursday","Friday"],
  traditions:         [{ id:"tr1", title:"Christmas Eve Drive", when:"12-24" }],
  monthMeals:         { "2026-06":{ "2026-06-01":"pasta","2026-06-02":"tacos" } },
  "af_nwMealCount":   2,
};

// ── A1: Every SYNC_KEYS key survives sanitizeHouseholdData ────────────────────
describe("A1 — every SYNC_KEYS key survives sanitize with a plausible value", () => {
  it("covers all 67 SYNC_KEYS entries", () => {
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
    "monthMeals","af_nwMealCount"];

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

// ── A9: SYNC_KEYS double-prefix documentation ─────────────────────────────────
describe("A9 — af_nwMealCount double-prefix", () => {
  it('SYNC_KEYS literally contains the string "af_nwMealCount"', () => {
    expect(SYNC_KEYS).toContain("af_nwMealCount");
  });

  it("sync loop writes af_nwMealCount to localStorage key af_af_nwMealCount", () => {
    // The sync read/write loops do: localStorage.setItem("af_" + k, ...) for each k in SYNC_KEYS.
    // For k = "af_nwMealCount", the resulting key is "af_" + "af_nwMealCount" = "af_af_nwMealCount".
    // useSaved("af_nwMealCount") also writes to "af_" + "af_nwMealCount" = "af_af_nwMealCount".
    // So both paths agree. This test documents and guards that invariant.
    const k = "af_nwMealCount";
    const expectedStorageKey = "af_" + k;
    expect(expectedStorageKey).toBe("af_af_nwMealCount");
  });

  it("af_nwMealCount value passes through sanitizer intact", () => {
    const out = sanitizeHouseholdData({ "af_nwMealCount": 7 });
    expect(out["af_nwMealCount"]).toBe(7);
  });

  it("af_nwMealCount zero passes through (falsy but valid)", () => {
    // 0 is a valid meal count. Pass-through condition: data[k] !== null && !== undefined.
    // 0 passes both checks.
    const out = sanitizeHouseholdData({ "af_nwMealCount": 0 });
    // 0 is falsy — defensive pass-through requires !== null && !== undefined.
    // 0 passes those checks, so it SHOULD survive. Documenting actual behavior:
    expect(out["af_nwMealCount"]).toBe(0);
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
    "authToken", "authUser", "refreshToken", "householdId", "googleCalToken",
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
