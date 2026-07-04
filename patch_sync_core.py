#!/usr/bin/env python3
"""Minimal App.jsx patch for sync-core.js extraction.

Three changes only:
  1. Add import after existing imports.
  2. Delete const SYNC_KEYS = [...] block.
  3. Delete const MEAL_DAYS line.
  4. Delete function sanitizeHouseholdData() from inside HomeFlow.
"""
import sys

def swap(src, old, new, tag=""):
    if old not in src:
        print(f"ERROR: anchor not found [{tag}]")
        print(f"  first 120 chars: {old[:120]!r}")
        sys.exit(1)
    if src.count(old) > 1:
        print(f"ERROR: anchor not unique ({src.count(old)} matches) [{tag}]")
        sys.exit(1)
    return src.replace(old, new, 1)

with open("src/App.jsx", "r") as f:
    src = f.read()

# 1. Add import after the last existing import line
src = swap(src,
    'import AuthScreen from "./components/AuthScreen"',
    'import AuthScreen from "./components/AuthScreen"\nimport { SYNC_KEYS, MEAL_DAYS, sanitizeHouseholdData } from "./sync-core.js"',
    "add import"
)

# 2. Remove SYNC_KEYS block (comment line + array + closing semicolon)
src = swap(src,
    """// Household data keys that get synced to Supabase
const SYNC_KEYS = [
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
  "monthMeals","af_nwMealCount"];""",
    "// SYNC_KEYS imported from ./sync-core.js",
    "remove SYNC_KEYS"
)

# 3. Remove MEAL_DAYS module-scope line (unique via WEEKDAYS_SUN which appears only at ~516)
src = swap(src,
    "const MEAL_DAYS = [\"Monday\",\"Tuesday\",\"Wednesday\",\"Thursday\",\"Friday\",\"Saturday\",\"Sunday\"];\nconst TREASURE_ICONS = [\"🎁\",\"📱\",\"🍕\",\"🎬\",\"🌙\",\"🎡\",\"🏖️\",\"🍦\",\"🎮\",\"🎨\",\"📚\",\"🎵\",\"🧁\",\"🎠\",\"🌮\"];\nconst WEEKDAYS_SUN",
    "// MEAL_DAYS imported from ./sync-core.js\nconst TREASURE_ICONS = [\"🎁\",\"📱\",\"🍕\",\"🎬\",\"🌙\",\"🎡\",\"🏖️\",\"🍦\",\"🎮\",\"🎨\",\"📚\",\"🎵\",\"🧁\",\"🎠\",\"🌮\"];\nconst WEEKDAYS_SUN",
    "remove MEAL_DAYS"
)

# 4. Remove sanitizeHouseholdData function from inside HomeFlow
src = swap(src,
    """  function sanitizeHouseholdData(data) {
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
    SYNC_KEYS.forEach(k => {
      if (out[k] === undefined && data[k] !== undefined && data[k] !== null) {
        out[k] = data[k];
      }
    });
    return out;
  }""",
    "  // sanitizeHouseholdData imported from ./sync-core.js",
    "remove sanitizeHouseholdData"
)

with open("src/App.jsx", "w") as f:
    f.write(src)

print("App.jsx patch applied.")
