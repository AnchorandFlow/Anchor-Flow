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

import { mergeSafeHarbor } from "./shell/safe-harbor-migrate.js";

// ── Meal day order ─────────────────────────────────────────────────────────────
// App.jsx line 514 (module scope). Three definitions exist in App.jsx; this is the
// authoritative one referenced by sanitizeHouseholdData. The other two
// (line 267 inside the IIFE as MEAL_DAYS_S; line 3400 inside MealsTab) remain
// in App.jsx as independent local copies and are not affected by this extraction.
export const MEAL_DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ── Household data keys that get synced to Supabase ───────────────────────────
// App.jsx lines 450-484 (verbatim).
export const SYNC_KEYS = [
  // Core data
  "tasks","brainItems","brainCats","calEvents","connectedCals","calColorLabels",
  // Meals
  "meals","mealsWeekOf","nextWeekMeals","mealCount","mealThemeEnabled","mealThemes","favMeals","mealBankCustom","recipes",
  // Recipes tab (occasion-tagged full/simple recipes; distinct from the
  // "recipes" URL-import feature above — af_recipes was already taken).
  "recipeBook",
  // Shopping
  "shoppingItems","stores","shopCategories",
  // People & household
  "people","familyProfile","birthdays","rhythm","homeSystems",
  // Reminders & notifications
  "notifications","recurring","notifSettings",
  // App preferences & state that should survive a reset
  "sections","flowMode","preferredName","flowGreetingTone","weatherLocation","burnoutChecked","aiMemory",
  // Anchor Vault — shared household data
  // celebgifts retired (Phase 3): migrated into gifts on read, no longer
  // synced independently. moments retired: no real user data, unregistered.
  "celebrations","gifts","inventory","pets","ripples","houseFile","favProducts","packing_templates",
  "subs","vaultSystems",
  "health","career","travel_profile",
  // Cove
  "cove_lists_v1","cove_items_v1","cove_sections_v1","cove_notes_v1",
  // Other shared
  "schoolData","coveData","dietaryFilters"
,"compassCache","compassEnabled",
  // OB-0 gap 2 — feature toggles, same classification as compassEnabled
  // (household-level preferences that should follow the household across
  // devices, not device-local).
  "tidePoolEnabled","lighthouseEnabled","celebrationsEnabled","mealsEnabled","careerEnabled","safeHarborEnabled",
  // Exhale standalone keys (ExhaleSection.jsx uses af_exhale_* keys)
  "exhale_groups","exhale_color_labels","exhale_people","exhale_labels",
  // exhale_columns: user-managed column config [{id,label,color,emoji}],
  // superseding exhale_labels as the source of truth for column identity.
  "exhale_columns",
  // exhale_buckets: Exhale Phase 1 bucket-card redesign — { bucketNames:[],
  // items:[{id,text,notes,bucketIndex,createdAt,color}] }. Separate key from
  // exhale_groups (kept registered, no longer written to) so existing sync
  // isn't disturbed.
  "exhale_buckets",
  // exhale_waves: Exhale Phase 2 — { daily:[], weekly:[], seasonal:[],
  // custom:[] }, each an array of wave cards with their own tasks. Today.jsx
  // already reads this key defensively; this is where it gets populated.
  "exhale_waves",
  // Home Phase 3 — Home hub expansion. Systems/Maintenance/Cleaning/
  // Inventory reuse existing keys (homeSystems/vaultSystems/exhale_waves/
  // inventory); these three are genuinely new.
  "home_projects","home_documents","home_supplies",
  // home_cleaning: Home dashboard redesign — cleaning zones are now their
  // own data source, independent of Waves. { zones:[{id,name,rooms,
  // tasks:[{id,text,done}]}], activeZoneIndex, supplies:[{id,name,low}],
  // schedule }. Object shape, own guard below (same class as exhale_waves).
  "home_cleaning",
  // home_info: Home cleanup — Household Info card replacing Systems in the
  // UI. Flat array [{id,label,value,category}], same simple-array-guard
  // class as home_projects/home_documents/home_supplies.
  "home_info",
  // Calendar emoji markers
  "cal_markers","cal_marker_types","workDays",
  // Traditions (RipplesRoom)
  "traditions",
  // Meals month grid + next-week meal count (July 3 sync-gap audit).
  // F-17 fix: this entry was "af_nwMealCount" (double-prefixed — useSaved adds its
  // own "af_", so it round-tripped to the dead key af_af_nwMealCount, invisible to
  // any direct read). App.jsx's useSaved call was renamed to useSaved("nwMealCount",1)
  // with a one-time local migration off the old key; this entry must match it.
  // Blob-side note: existing households.data blobs may still carry a legacy
  // "af_nwMealCount" field from before this fix — that field is orphaned
  // (harmless: a display-preference int, not user data) and intentionally NOT
  // migrated on pull. See F-17 follow-up discussion.
  "monthMeals","nwMealCount",
  // Safe Harbor — household emergency plan (SH-2b). Merge-on-receive via
  // applyHouseholdKey; never naive last-write-wins. See mergeSafeHarbor.
  "safe_harbor",
  // Owned products / manuals tracker (Home Systems -> Products). Array of
  // { id, name, items:[{id,name,link,purchasedAt,warranty,warrantyNote,notes}] }.
  "ownedProducts",
  // Subscriptions section extras — previously local-only (F-38): written raw in
  // AnchorVault with no dirty-marking AND absent from this list, so they never
  // synced in either direction. Receive-side is covered by the Session-1
  // defensive pass-through (any SYNC_KEYS entry not explicitly typed falls
  // through), so listing them here is sufficient for pull.
  "coupons","perks",
  // Forecast overrides (TodayBriefing) — user edits to today's shared forecast.
  // Previously device-local (F-44). Receive-side covered by the defensive
  // pass-through, same as coupons/perks.
  "forecastOverrides",
  // CareerSection.jsx vault data — previously local-only (F-33 residual, found in
  // the Batch 2 Fix 9 re-sweep): CareerSection's own useSaved() hook writes
  // af_career_licenses / af_career_contacts / af_career_retirement directly, and
  // none of these bare names existed here, so this data never synced in either
  // direction (not just missing dirty-marking — genuinely unregistered). Distinct
  // from the "career" entry above, which is a different key (af_career, written by
  // AnchorVault.jsx's cSaveCareer) — same word, unrelated data. Given explicit
  // array-guard treatment below (not defensive pass-through) since these are lists
  // of records, same as celebrations/gifts/pets/moments.
  "career_licenses","career_contacts","career_retirement",
  // Lighthouse — per-child learning records (LH-1). Object pass-through;
  // no merge hook yet (flag-gated OFF). useSaved("lighthouse") → af_lighthouse.
  "lighthouse",
  // Onboarding wizard completion state (OB-0). Shape: { complete, completedAt,
  // version }. Drives auto-launch/re-ambush logic on receive, so it gets an
  // explicit typed rule below rather than the defensive pass-through.
  "onboardingState",
  // Trips — concrete planned/past trips (Travel redesign, UI in
  // TripsSection/AnchorVault.jsx). Array of { id, name, destination,
  // startDate, endDate, notes, status, icon, color, transportation, lodging,
  // itinerary, packing, reservations, budget, documents, dining, activities,
  // emergencyInfo, cardOrder }. transportation/lodging (Step 4a) are arrays
  // of records, same shape class as ffPrograms/hotelPrograms. packing/
  // itinerary/activities/reservations (Step 4b) are checklist-shaped arrays
  // ({ id, text, done }).
  // TODO: budget/documents/dining/emergencyInfo/cardOrder are unvalidated
  // placeholders (null) until later steps define their real per-field
  // shape — not a decision to leave them loose permanently.
  // Distinct from travel_profile (documents/loyalty/preferences, an object)
  // and packing_templates (reusable per-type checklists) — this is calendar-
  // anchored trip instances. Array-guard treatment, same as celebrations/
  // ownedProducts (top-level array + null-entry guard only — sub-field
  // shapes inside each trip are not independently validated).
  "trips",
  // WORK-1 — per-person recurring work schedule. Object map { [personId]:
  // {days:[], type, color, notes} }. Distinct from workDays above (an
  // existing, unrelated household-wide date-keyed ad-hoc marker, e.g.
  // "2026-08-15": {type:"travel"}) — not a migration of that data, a new
  // additive feature; the two coexist. Object pass-through, same class as
  // gifts (object keyed by id, not an array).
  "work_schedules",
  // COUNTDOWN-1 — reusable named countdowns, independent of Travel/
  // Celebrations' own date fields. Array of { id, title, targetDate, emoji,
  // color, showOn }. Array-guard treatment, same as celebrations/trips.
  // Deliberately excluded from buildCompassContext() (compassEngine.js).
  "countdowns"];

// ── errorCode ─────────────────────────────────────────────────────────────────
// Stable 8-char hex support code derived from an error message string.
// Same message always produces the same code — suitable for bug reports.
// Uses djb2 hash (no external deps, ES2019 safe).
export function errorCode(message) {
  var s = String(message);
  var h = 5381;
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, "0").slice(0, 8);
}

// ── clearZombieAuthKeys ────────────────────────────────────────────────────────
// Called at each 401-recovery-failed call site (zombie-session detection).
// Clears only auth credentials from localStorage. SYNC_KEYS household data is
// intentionally NOT cleared — family data stays on-device through re-auth so
// unpushed edits can push once the session is restored.
export function clearZombieAuthKeys() {
  try { localStorage.removeItem("af_authToken"); } catch (_) {}
  try { localStorage.removeItem("af_authUser"); } catch (_) {}
}

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
  "recurring","celebrations","inventory","pets","houseFile",
  "cove_lists_v1","cove_notes_v1","burnoutChecked",
  "subs","vaultSystems","packing_templates",
  "coveData","ownedProducts",
  "career_licenses","career_contacts","career_retirement",
  "trips",
  // recipeBook: occasion-tagged full/simple recipes (Meals > Recipes tab).
  // Same array-guard class as celebrations/gifts-array — see SYNC_KEYS comment.
  "recipeBook",
  // countdowns: reusable named countdowns (COUNTDOWN-1). Same array-guard
  // class as celebrations/trips.
  "countdowns",
  // exhale_columns: user-managed Exhale board columns. Same array-guard
  // class as countdowns.
  "exhale_columns",
  // home_projects/home_documents/home_supplies (Home Phase 3). Same
  // array-guard class as trips/recipeBook.
  "home_projects","home_documents","home_supplies",
  // home_info: flat array, same array-guard class as home_projects above.
  "home_info",
  // home_cleaning: object, own guard (see SYNC_KEYS comment).
  "home_cleaning",
  // exhale_buckets: object { bucketNames:[], items:[] } (Exhale Phase 1).
  // Own guard for the same reason as gifts/work_schedules below — an object
  // misclassified by the array-guard mechanism silently vanishes every sync.
  "exhale_buckets",
  // exhale_waves: object { daily:[], weekly:[], seasonal:[], custom:[] }
  // (Exhale Phase 2). Same shape class as exhale_buckets above.
  "exhale_waves",
  // Specially structured
  "people","meals","nextWeekMeals","mealsWeekOf","rhythm",
  // gifts: object map { personId: [gift, ...] } (Phase 3) — moved off the
  // array-guard list below when the shape changed from a flat array of
  // people to this person-keyed map. Same fix class as cove_sections_v1:
  // an object misclassified as an array silently vanishes every sync.
  "gifts",
  // work_schedules: object map { personId: {days,type,color,notes} }
  // (WORK-1). Same shape class as gifts — object keyed by person id, needs
  // its own guard so a misclassified array doesn't vanish every sync.
  "work_schedules",
  // Scalars
  "mealCount","mealThemeEnabled","preferredName","flowGreetingTone","weatherLocation","flowMode",
  // Objects
  "familyProfile","aiMemory","collapsedStores","mealThemes","calColorLabels",
  "schoolData","cove_items_v1","cove_sections_v1","notifSettings","sections",
  "connectedCals","exhale_labels","health","career","travel_profile",
  // Explicitly normalized
  "ripples",
  // Merge-on-receive (applyHouseholdKey handles the merge)
  "safe_harbor",
  // Object pass-through (LH-1; flag-gated, no merge hook yet)
  "lighthouse",
  // Onboarding completion state — explicit shape guard, see below.
  "onboardingState",
]);

export function sanitizeHouseholdData(data) {
    if (!data || typeof data !== "object") return {};
    const out = {};
    // Arrays: only preserve if actually an array — never pass null/object through
    ["tasks","brainItems","shoppingItems","notifications","calEvents","connectedCals",
     "birthdays","favMeals","mealBankCustom","recipes","stores","shopCategories",
     "brainCats","homeSystems","dietaryFilters",
     // Vault arrays
     "recurring","celebrations","inventory","pets","houseFile",
     "cove_lists_v1","cove_notes_v1","burnoutChecked",
     "subs","vaultSystems","packing_templates",
     // coveData: array of per-kid records ({kidId, chores:[], treasures:[]}). Array rule
     // added — was previously dropped (object-only passthrough rejects arrays).
     "coveData",
     // ownedProducts: array of product categories, each with an items array.
     "ownedProducts",
     // CareerSection.jsx vault data (F-33 residual, Batch 2 Fix 9) — flat arrays
     // of records ({id, ...}), same shape class as celebrations/gifts/moments.
     "career_licenses","career_contacts","career_retirement",
     // trips: array of trip records. Only the top-level array and null entries
     // are guarded here — sub-field shapes (transportation/lodging/itinerary/
     // etc.) are unvalidated until Steps 3/4 define them. See SYNC_KEYS comment.
     "trips",
     // recipeBook: array of recipe records ({id, title, type, occasions,
     // serves, ingredients, steps, notes}). Only the top-level array and null
     // entries are guarded here — sub-field shapes are unvalidated.
     "recipeBook",
     // countdowns: array of { id, title, targetDate, emoji, color, showOn }.
     // Only the top-level array and null entries are guarded here.
     "countdowns",
     // exhale_columns: array of { id, label, color, emoji }, user-managed
     // Exhale board columns. Same guard class as countdowns — top-level
     // array + null entries only, sub-field shapes unvalidated.
     "exhale_columns",
     // Home Phase 3: home_projects ({id,name,status,budget,notes,tasks:[]}),
     // home_documents ({id,name,type,expiryDate,notes,url}), home_supplies
     // ({id,name,quantity,needToRestock}). Same guard class as trips/
     // recipeBook — top-level array + null entries only.
     "home_projects","home_documents","home_supplies",
     // home_info ({id,label,value,category}) — Home cleanup, same guard class.
     "home_info"
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
     "schoolData","cove_items_v1","cove_sections_v1","notifSettings","sections",
     "calColorLabels","connectedCals","exhale_labels",
     "health","career","travel_profile"
    ].forEach(k => {
      if (data[k] !== undefined && data[k] !== null && typeof data[k] === "object" && !Array.isArray(data[k])) out[k] = data[k];
    });
    // ripples: normalize to array — was stored as object in earlier versions
    if (data.ripples !== undefined) {
      out.ripples = Array.isArray(data.ripples) ? data.ripples : [];
    }
    // cove_items_v1: object map — pass through if object
    if (data["cove_items_v1"] && typeof data["cove_items_v1"] === "object") {
      out["cove_items_v1"] = data["cove_items_v1"];
    }
    // cove_sections_v1: object map — pass through if object. Was previously
    // in the array-guard block above, which silently dropped it on every
    // sync pass (its real shape is {listId: [sections]}, never an array) —
    // wiping every Cove list's sections while cove_items_v1 (correctly
    // object-pass-through already) survived, leaving the item count correct
    // but the detail view rendering zero items. Matches cove_items_v1's
    // exact handling now.
    if (data["cove_sections_v1"] && typeof data["cove_sections_v1"] === "object") {
      out["cove_sections_v1"] = data["cove_sections_v1"];
    }
    // gifts: object map { personId: [gift, ...] } (Phase 3 — was a flat array
    // of people before, now person-keyed). Validate the map itself is an
    // object, and each person's value is actually an array (nulls filtered) —
    // a malformed per-person value is dropped rather than passed through or
    // used to reject the whole map. Holiday lists (Phase 3b) reuse this same
    // handler under a reserved "holiday_lists" key whose value is also an
    // array (of { id, name, gifts } list objects rather than gift objects
    // directly) — already covered by the same Array.isArray check, no
    // separate rule needed.
    if (data.gifts && typeof data.gifts === "object" && !Array.isArray(data.gifts)) {
      const safeGifts = {};
      Object.keys(data.gifts).forEach(pid => {
        if (Array.isArray(data.gifts[pid])) safeGifts[pid] = data.gifts[pid].filter(g => g != null);
      });
      out.gifts = safeGifts;
    }
    // work_schedules: object map { personId: {days:[], type, color, notes, dates:[], startTime, endTime} }
    // (WORK-1). Same validation shape as gifts — map itself must be an
    // object (not array), and each person's entry must be an object with
    // days actually an array (nulls filtered); a malformed per-person entry
    // is dropped rather than rejecting the whole map.
    if (data.work_schedules && typeof data.work_schedules === "object" && !Array.isArray(data.work_schedules)) {
      const safeSchedules = {};
      Object.keys(data.work_schedules).forEach(pid => {
        const s = data.work_schedules[pid];
        if (s && typeof s === "object" && !Array.isArray(s)) {
          safeSchedules[pid] = {
            days: Array.isArray(s.days) ? s.days.filter(d => d != null) : [],
            type: typeof s.type === "string" ? s.type : "regular",
            color: typeof s.color === "string" ? s.color : "",
            notes: typeof s.notes === "string" ? s.notes : "",
            // WORK-1: irregular-shift dates and overnight start/end times —
            // dropped silently by this whitelist before this fix (Batch 3).
            dates: Array.isArray(s.dates) ? s.dates.filter(d => d != null) : [],
            startTime: typeof s.startTime === "string" ? s.startTime : "",
            endTime: typeof s.endTime === "string" ? s.endTime : "",
          };
        }
      });
      out.work_schedules = safeSchedules;
    }
    // exhale_buckets: { bucketNames:[string,...], items:[{id,text,notes,
    // bucketIndex,createdAt,color}] } (Exhale Phase 1). Validated per-field
    // rather than trusted wholesale, same reasoning as work_schedules above.
    if (data["exhale_buckets"] !== undefined && data["exhale_buckets"] !== null &&
        typeof data["exhale_buckets"] === "object" && !Array.isArray(data["exhale_buckets"])) {
      var eb = data["exhale_buckets"];
      out["exhale_buckets"] = {
        bucketNames: Array.isArray(eb.bucketNames) ? eb.bucketNames.filter(n => typeof n === "string") : [],
        items: Array.isArray(eb.items) ? eb.items.filter(it => it && typeof it === "object" && !Array.isArray(it)) : [],
      };
    }
    // exhale_waves: { daily:[], weekly:[], seasonal:[], custom:[] } (Exhale
    // Phase 2), each entry a wave card { id, name, tasks:[{id,text,
    // estimatedMinutes,done}], plus dayOfWeek (weekly, 0-6) or month
    // (seasonal, 1-12) }. Validated per-field, same reasoning as
    // exhale_buckets above.
    if (data["exhale_waves"] !== undefined && data["exhale_waves"] !== null &&
        typeof data["exhale_waves"] === "object" && !Array.isArray(data["exhale_waves"])) {
      var ew = data["exhale_waves"];
      var sanitizeWaveTasks = function(tasks) {
        return Array.isArray(tasks) ? tasks.filter(t => t && typeof t === "object" && !Array.isArray(t)).map(t => ({
          id: typeof t.id === "string" ? t.id : undefined,
          text: typeof t.text === "string" ? t.text : "",
          estimatedMinutes: typeof t.estimatedMinutes === "number" ? t.estimatedMinutes : null,
          done: typeof t.done === "boolean" ? t.done : false,
        })) : [];
      };
      var sanitizeWaveList = function(list, extraFields) {
        return Array.isArray(list) ? list.filter(w => w && typeof w === "object" && !Array.isArray(w)).map(w => {
          var out2 = { id: w.id, name: typeof w.name === "string" ? w.name : "", tasks: sanitizeWaveTasks(w.tasks) };
          (extraFields||[]).forEach(f => { if (typeof w[f] === "number") out2[f] = w[f]; });
          return out2;
        }) : [];
      };
      out["exhale_waves"] = {
        daily: sanitizeWaveList(ew.daily),
        weekly: sanitizeWaveList(ew.weekly, ["dayOfWeek"]),
        seasonal: sanitizeWaveList(ew.seasonal, ["month"]),
        custom: sanitizeWaveList(ew.custom),
      };
    }
    // safe_harbor: pass through as object; merge-on-receive happens in applyHouseholdKey
    if (data["safe_harbor"] !== undefined && data["safe_harbor"] !== null &&
        typeof data["safe_harbor"] === "object" && !Array.isArray(data["safe_harbor"])) {
      out["safe_harbor"] = data["safe_harbor"];
    }
    // lighthouse: pass through as object (LH-1; flag-gated, no merge hook yet)
    if (data["lighthouse"] !== undefined && data["lighthouse"] !== null &&
        typeof data["lighthouse"] === "object" && !Array.isArray(data["lighthouse"])) {
      out["lighthouse"] = data["lighthouse"];
    }
    // home_cleaning: pass through as object (Home dashboard redesign) —
    // { zones:[], activeZoneIndex, supplies:[], schedule }, same bare
    // type-check pattern as safe_harbor/lighthouse above.
    if (data["home_cleaning"] !== undefined && data["home_cleaning"] !== null &&
        typeof data["home_cleaning"] === "object" && !Array.isArray(data["home_cleaning"])) {
      out["home_cleaning"] = data["home_cleaning"];
    }
    // onboardingState: { complete: boolean, completedAt: string, version: number }.
    // Drives wizard auto-launch/re-ambush decisions on receive — a malformed
    // shape must not pass through, so fields are individually validated rather
    // than trusting the remote object wholesale.
    if (data["onboardingState"] !== undefined && data["onboardingState"] !== null &&
        typeof data["onboardingState"] === "object" && !Array.isArray(data["onboardingState"])) {
      var ob = data["onboardingState"];
      out["onboardingState"] = {
        complete: typeof ob.complete === "boolean" ? ob.complete : false,
        completedAt: typeof ob.completedAt === "string" ? ob.completedAt : "",
        version: typeof ob.version === "number" ? ob.version : 1
      };
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

// ── applyHouseholdKey ─────────────────────────────────────────────────────────
// Per-key apply handler for SYNC_KEYS apply loops. Use this everywhere instead
// of raw localStorage.setItem("af_" + k, ...) so that safe_harbor gets a merge
// rather than wholesale replacement.
//
// For all keys other than safe_harbor: behaves identically to the old raw setItem.
// For safe_harbor: reads local blob, merges with remote, writes merged result.
export function applyHouseholdKey(k, remoteVal) {
  if (k === "safe_harbor") {
    var localObj = null;
    try { var raw = localStorage.getItem("af_safe_harbor"); localObj = raw ? JSON.parse(raw) : null; } catch(_e) {}
    var merged = mergeSafeHarbor(localObj, remoteVal);
    try { localStorage.setItem("af_safe_harbor", JSON.stringify(merged)); } catch(_e) {}
    return;
  }
  try { localStorage.setItem("af_" + k, JSON.stringify(remoteVal)); } catch(_e) {}
}

// ── F-97 migration shims ─────────────────────────────────────────────────────
// Read-side only — do not bulk-rewrite existing calEvents. Same "orphan it,
// don't force a migration" precedent as the F-06 backup-key decision.

// responsibleParent had exactly one write site pre-F-97 (the CalEventFormModal
// "For"/"Responsible" dropdown), producing only "L" or "T" strings. These two
// literal ids are Lindsey's and Twyla's real people[].id values from a live
// export (2026-07-18) — legacy data migration only, not a new hardcoding
// pattern. Delete this function once no calEvents carry "L"/"T" anymore (grep
// af_calEvents for responsibleParent:"L" — if empty, remove).
var _LEGACY_RESPONSIBLE_PARENT_IDS = { L: "i3jfymz", T: "69uf6z6" };
export function resolveResponsibleParent(rp) {
  if (rp === "L" || rp === "T") return _LEGACY_RESPONSIBLE_PARENT_IDS[rp];
  return rp; // already a real personId, or null/undefined
}

// forPerson had no id concept pre-F-97 — every existing calEvent stores it as
// a bare display-name string (matched case-insensitively against people[].name
// by the old getPersonColor). Post-F-97 writes always use person.id. This
// resolves either shape for read/display: id match first (new data), then a
// legacy name match (old data), else passthrough (orphaned reference — same
// honesty principle as getPersonColor's own no-match case).
export function resolveForPerson(forPerson, people) {
  if (!forPerson || forPerson === "family") return forPerson;
  var list = people || [];
  if (list.some(function(p){ return p.id === forPerson; })) return forPerson;
  var target = String(forPerson).trim().toLowerCase();
  var byName = list.filter(function(p){ return p.name && p.name.trim().toLowerCase() === target; })[0];
  return byName ? byName.id : forPerson;
}

// ── isLighthouseDirty ─────────────────────────────────────────────────────────
// LH-7 local-wins guard predicate. Returns true when "lighthouse" appears in the
// dirty-keys list, meaning the local af_lighthouse blob has unsent edits that must
// not be overwritten by a pull. The pull path reads af_dirtyKeys once before its
// SYNC_KEYS forEach and passes the parsed array here.
// Exported so the pull-path guard is unit-testable without importing App.jsx.
export function isLighthouseDirty(dirtyKeys) {
  return Array.isArray(dirtyKeys) && dirtyKeys.indexOf("lighthouse") !== -1;
}
