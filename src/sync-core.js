// src/sync-core.js
// Pure, side-effect-free constants extracted verbatim from App.jsx for testability.
//
// Rollback note: revert this file and the single `import` line added to App.jsx.
//   git revert HEAD --no-edit      (removes file + restores App.jsx inline definitions)
//
// SYNC_KEYS and sanitizeHouseholdData are extracted so unit and protocol tests can
// import them without triggering the App.jsx module-level IIFE
// (sanitizeLocalStorageOnLoad, ~line 257) that reads/writes localStorage on import.
//
// AUTHORITATIVE: App.jsx imports from here. The Phase A draft (src/sync/syncCore.js)
// has been deleted — this file is the single source of truth.

// ── Meal day order ─────────────────────────────────────────────────────────────
// App.jsx line 514 (module scope). Three definitions exist in App.jsx; this is the
// authoritative one referenced by sanitizeHouseholdData. The other two
// (line 267 inside the IIFE as MEAL_DAYS_S; line 3400 inside MealsTab) remain
// in App.jsx as independent local copies and are not affected by this extraction.
export const MEAL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ── Household data keys that get synced to Supabase ───────────────────────────
// App.jsx lines 450-484 (verbatim).
export const SYNC_KEYS = [
  // Core data
  "tasks","brainItems","brainCats","calEvents","connectedCals","calColorLabels",
  // Meals
  "meals","mealsWeekOf","nextWeekMeals","mealCount","mealThemeEnabled","mealThemes","favMeals","mealBankCustom","recipes",
  // Shopping
  "shoppingItems","stores","shopCategories",
  // People & household
  "people","familyProfile","birthdays","rhythm","homeSystems",
  // Reminders & notifications
  "notifications","recurring","notifSettings",
  // App preferences & state that should survive a reset
  "sections","flowMode","preferredName","flowGreetingTone","weatherLocation","burnoutChecked","aiMemory",
  // Anchor Vault — shared household data
  "celebrations","celebgifts","gifts","inventory","pets","ripples","houseFile","favProducts","packing_templates",
  "moments","subs","vaultSystems",
  "health","career","travel_profile",
  // Cove
  "cove_lists_v1","cove_items_v1","cove_sections_v1","cove_notes_v1",
  // Other shared
  "schoolData","coveData","dietaryFilters"
,"compassCache","compassEnabled",
  // Exhale standalone keys (ExhaleSection.jsx uses af_exhale_* keys)
  "exhale_groups","exhale_color_labels","exhale_people","exhale_labels",
  // Calendar emoji markers
  "cal_markers","cal_marker_types","workDays",
  // Traditions (RipplesRoom)
  "traditions",
  // Meals month grid + next-week meal count (July 3 sync-gap audit).
  // NOTE: "af_nwMealCount" is intentionally listed WITH the af_ prefix:
  // useSaved("af_nwMealCount") adds its own prefix, so the stored key is
  // af_af_nwMealCount, and sync loops prefix SYNC_KEYS entries with af_.
  // Do NOT normalize this without a data migration for existing devices.
  "monthMeals","af_nwMealCount"];

// ── sanitizeHouseholdData ──────────────────────────────────────────────────────
// App.jsx lines 1896-1979 (verbatim, previously a nested function inside HomeFlow).
// No closure variables — only references MEAL_DAYS and SYNC_KEYS from this module.

// Keys with explicit typed rules in sanitizeHouseholdData. The defensive pass-through
// must not apply to these — if a key's value fails its explicit rule (e.g. tasks={}),
// the rule's decision (drop it) must win. Only truly rule-less SYNC_KEYS keys reach
// the pass-through. Fixed: F1 (pass-through was overwriting array-guard rejections).
const _SANITIZE_HANDLED = new Set([
  // Array-guard list
  "tasks","brainItems","shoppingItems","notifications","calEvents","connectedCals",
  "birthdays","favMeals","mealBankCustom","recipes","stores","shopCategories",
  "brainCats","homeSystems","dietaryFilters",
  "recurring","celebrations","gifts","inventory","pets","houseFile",
  "cove_lists_v1","cove_sections_v1","cove_notes_v1","burnoutChecked",
  "moments","subs","vaultSystems","packing_templates",
  // Specially structured
  "people","meals","nextWeekMeals","mealsWeekOf","rhythm",
  // Scalars
  "mealCount","mealThemeEnabled","preferredName","flowGreetingTone","weatherLocation","flowMode",
  // Objects
  "familyProfile","aiMemory","collapsedStores","mealThemes","calColorLabels",
  "coveData","schoolData","cove_items_v1","notifSettings","sections",
  "connectedCals","exhale_labels","health","career","travel_profile",
  // Explicitly normalized
  "ripples",
]);

export function sanitizeHouseholdData(data) {
    if (!data || typeof data !== "object") return {};
    const out = {};
    // Arrays: only preserve if actually an array — never pass null/object through
    ["tasks","brainItems","shoppingItems","notifications","calEvents","connectedCals",
     "birthdays","favMeals","mealBankCustom","recipes","stores","shopCategories",
     "brainCats","homeSystems","dietaryFilters",
     // Vault arrays
     "recurring","celebrations","gifts","inventory","pets","houseFile",
     "cove_lists_v1","cove_sections_v1","cove_notes_v1","burnoutChecked",
     "moments","subs","vaultSystems","packing_templates"
    ].forEach(k => {
      if (Array.isArray(data[k])) {
        out[k] = data[k].filter(item => item != null);
      }
      // If not an array (null, object, undefined) — skip entirely, do not write
    });
    // people: filter nulls, ensure each has id/name/color
    if (Array.isArray(data.people)) {
      out.people = data.people.filter(p => p != null && p.id && p.name);
    }
    // meals: ensure each day is an object not null
    if (data.meals && typeof data.meals === "object") {
      const safeMeals = {};
      MEAL_DAYS.forEach(day => {
        const m = data.meals[day];
        if (!m || typeof m !== "object") { safeMeals[day] = {}; }
        else {
          const clean = {};
          Object.entries(m).forEach(([k,v]) => { clean[k] = (v == null) ? "" : String(v); });
          safeMeals[day] = clean;
        }
      });
      out.meals = safeMeals;
    }
    // nextWeekMeals: same shape as meals
    if (data.nextWeekMeals && typeof data.nextWeekMeals === "object") {
      out.nextWeekMeals = data.nextWeekMeals;
    }
    // mealsWeekOf: string date
    if (typeof data.mealsWeekOf === "string") out.mealsWeekOf = data.mealsWeekOf;
    // rhythm: ensure each day is an object
    if (data.rhythm && typeof data.rhythm === "object") {
      out.rhythm = data.rhythm;
    }
    // Scalar values
    if (typeof data.mealCount === "number") out.mealCount = data.mealCount;
    if (typeof data.mealThemeEnabled === "boolean") out.mealThemeEnabled = data.mealThemeEnabled;
    // String scalars
    ["preferredName","flowGreetingTone","weatherLocation","flowMode","mealsWeekOf"].forEach(k => {
      if (typeof data[k] === "string") out[k] = data[k];
    });
    // Boolean scalars
    ["mealThemeEnabled"].forEach(k => {
      if (typeof data[k] === "boolean") out[k] = data[k];
    });
    // Objects: pass through if valid (non-null object)
    ["familyProfile","aiMemory","collapsedStores","mealThemes","calColorLabels",
     "coveData","schoolData","cove_items_v1","notifSettings","sections",
     "calColorLabels","connectedCals","exhale_labels",
     "health","career","travel_profile"
    ].forEach(k => {
      if (data[k] !== undefined && typeof data[k] === "object" && !Array.isArray(data[k])) out[k] = data[k];
    });
    // ripples: normalize to array — was stored as object in earlier versions
    if (data.ripples !== undefined) {
      out.ripples = Array.isArray(data.ripples) ? data.ripples : [];
    }
    // cove_items_v1: object map — pass through if object
    if (data["cove_items_v1"] && typeof data["cove_items_v1"] === "object") {
      out["cove_items_v1"] = data["cove_items_v1"];
    }
    // Defensive pass-through: any SYNC_KEYS key not explicitly handled above
    // syncs as-is (null-guarded) instead of being silently dropped. Fixes
    // receive-side loss of workDays, traditions, cal_markers, cal_marker_types,
    // compassCache, compassEnabled, exhale_groups, exhale_color_labels,
    // exhale_people — and future-proofs new SYNC_KEYS additions.
    // _SANITIZE_HANDLED guard: keys with explicit rules are excluded so their
    // validation decisions (e.g. array guard dropping tasks={}) cannot be overridden.
    SYNC_KEYS.forEach(k => {
      if (out[k] === undefined && data[k] !== undefined && data[k] !== null && !_SANITIZE_HANDLED.has(k)) {
        out[k] = data[k];
      }
    });
    return out;
  }
