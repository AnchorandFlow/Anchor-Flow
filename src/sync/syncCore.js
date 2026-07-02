/**
 * syncCore.js — pure sync helpers, copied verbatim from App.jsx for testability.
 *
 * DRIFT WARNING (Phase B task):
 *   These are COPIES, not imports. Any change to the originals in App.jsx must be
 *   manually mirrored here until Phase B, when App.jsx is refactored to import
 *   from this file. Track drift by comparing each function's body against the
 *   App.jsx line cited in the comment above it. Running `npm test` does NOT catch
 *   App.jsx drift — a Phase B prerequisite is a linter rule or script that diffs
 *   the two sources.
 *
 * ES2019 note:
 *   No optional chaining (?.), no nullish coalescing (??), no async/await.
 *   These restrictions match the App.jsx coding style so the code can move back
 *   without modification.
 */

// App.jsx:508 — module-scope constant
var MEAL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// App.jsx:451 — logical sync keys (first 10 shown; full list is in App.jsx)
// Included here so helpers that iterate SYNC_KEYS can be tested in isolation.
var SYNC_KEYS = [
  "tasks","brainItems","brainCats","calEvents","connectedCals","calColorLabels",
  "meals","mealsWeekOf","nextWeekMeals","mealCount","mealThemeEnabled","mealThemes",
  "favMeals","mealBankCustom","recipes",
  "shoppingItems","stores","shopCategories",
  "people","familyProfile","birthdays","rhythm","homeSystems",
  "notifications","recurring","notifSettings",
  "sections","flowMode","preferredName","flowGreetingTone","weatherLocation",
  "burnoutChecked","aiMemory",
  "celebrations","celebgifts","gifts","inventory","pets","ripples","houseFile",
  "favProducts","packing_templates","moments","subs","vaultSystems",
  "health","career","travel_profile",
  "cove_lists_v1","cove_items_v1","cove_sections_v1","cove_notes_v1",
  "schoolData","coveData","dietaryFilters","compassCache","compassEnabled",
  "exhale_groups","exhale_color_labels","exhale_people","exhale_labels",
  "cal_markers","cal_marker_types","workDays",
  "traditions"
];

// App.jsx:1676-1678 — keys never marked dirty (system/session state)
var _DIRTY_EXCLUDE = [
  "authToken","authUser","refreshToken","householdId",
  "dailySummaryScheduled","lastSeenDate","checkedCalEvents","checkedMealItems",
  "insights","insightsBuilt","dismissedInsights","lastHHSync","lastPushedAt",
  "deviceId","dirtyKeys","theme","activeTab"
];

var AF_DEBUG = false;

// ---------------------------------------------------------------------------
// Dirty-key helpers
// ---------------------------------------------------------------------------

/**
 * App.jsx:1684 — markKeyDirty
 * Appends key to af_dirtyKeys unless hydrating or key is excluded.
 * @param {string} key       - logical key name (no "af_" prefix)
 * @param {Storage} _ls      - localStorage-compatible object (default: localStorage)
 * @param {boolean} _hydrating - true during initial hydration (default: false)
 * @param {string[]} _exclude  - exclude list (default: _DIRTY_EXCLUDE)
 */
function markKeyDirty(key, _ls, _hydrating, _exclude) {
  var ls = _ls || localStorage;
  var hydrating = _hydrating !== undefined ? _hydrating : false;
  var exclude = _exclude || _DIRTY_EXCLUDE;
  if (hydrating) return;
  if (exclude.indexOf(key) !== -1) return;
  try {
    var dirty = JSON.parse(ls.getItem("af_dirtyKeys") || "[]");
    if (!Array.isArray(dirty)) dirty = [];
    if (dirty.indexOf(key) === -1) {
      dirty.push(key);
      ls.setItem("af_dirtyKeys", JSON.stringify(dirty));
      AF_DEBUG && console.log("[AF DIRTY] marked dirty:", key);
    }
  } catch(e) {}
}

/**
 * Read af_dirtyKeys from localStorage; return [] on error.
 * @param {Storage} _ls
 * @returns {string[]}
 */
function readDirtyKeys(_ls) {
  var ls = _ls || localStorage;
  try {
    var v = JSON.parse(ls.getItem("af_dirtyKeys") || "[]");
    return Array.isArray(v) ? v : [];
  } catch(e) { return []; }
}

// ---------------------------------------------------------------------------
// Own-write detection
// App.jsx:2604 — serverTs === lastPushedAt short-circuit
// ---------------------------------------------------------------------------

/**
 * Returns true when serverTs exactly matches the value we last pushed,
 * meaning this server update is our own write and we should not reload.
 * @param {string} serverTs
 * @param {Storage} _ls
 * @returns {boolean}
 */
function isOwnWrite(serverTs, _ls) {
  var ls = _ls || localStorage;
  if (!serverTs) return false;
  var lastPushedAt = ls.getItem("af_lastPushedAt") || "";
  // af_lastPushedAt is stored as JSON string (with quotes) by the push path.
  // Normalize: strip surrounding quotes if present.
  if (lastPushedAt.length > 2 && lastPushedAt[0] === '"') {
    try { lastPushedAt = JSON.parse(lastPushedAt); } catch(e) {}
  }
  return serverTs === lastPushedAt;
}

/**
 * Returns true when the server timestamp is newer than what we last synced —
 * i.e., a genuine remote change exists and we should consider applying it.
 * @param {string} serverTs
 * @param {Storage} _ls
 * @returns {boolean}
 */
function shouldApplyRemote(serverTs, _ls) {
  var ls = _ls || localStorage;
  if (!serverTs) return false;
  var lastSync = ls.getItem("af_lastHHSync") || "";
  return serverTs !== lastSync;
}

// ---------------------------------------------------------------------------
// Safety check
// App.jsx:1863 — isRemotePayloadSafe
// ---------------------------------------------------------------------------

/**
 * Returns false when the remote payload looks dangerously empty, indicating
 * a server error or a blank push that would erase local data.
 * @param {object|null} remoteData
 * @param {string} remoteTs
 * @param {Storage} _ls
 * @returns {boolean}
 */
function isRemotePayloadSafe(remoteData, remoteTs, _ls) {
  var ls = _ls || localStorage;
  if (!remoteData || typeof remoteData !== "object") {
    AF_DEBUG && console.log("[AF SAFETY] refused empty remote apply — null or non-object");
    return false;
  }
  var remoteKeyCount = Object.keys(remoteData).filter(function(k) {
    return remoteData[k] !== null;
  }).length;
  if (remoteKeyCount < 2) {
    AF_DEBUG && console.log("[AF SAFETY] refused empty remote apply — only", remoteKeyCount, "non-null keys");
    return false;
  }
  var coreKeys = ["tasks","meals","brainItems","shoppingItems","people"];
  var hasCoreData = coreKeys.some(function(k) {
    try {
      var v = JSON.parse(ls.getItem("af_" + k) || "null");
      return Array.isArray(v) && v.length > 0;
    } catch(e) { return false; }
  });
  if (hasCoreData) {
    var remoteCoreCount = coreKeys.filter(function(k) {
      return Array.isArray(remoteData[k]) && remoteData[k].length > 0;
    }).length;
    var localCoreCount = coreKeys.filter(function(k) {
      try {
        var v = JSON.parse(ls.getItem("af_" + k) || "null");
        return Array.isArray(v) && v.length > 0;
      } catch(e) { return false; }
    }).length;
    if (remoteCoreCount === 0 && localCoreCount > 0) {
      AF_DEBUG && console.log("[AF SAFETY] refused empty remote apply — remote has 0 core arrays, local has", localCoreCount);
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Data sanitizer
// App.jsx:1890 — sanitizeHouseholdData
// ---------------------------------------------------------------------------

/**
 * Strips malformed entries from a remote household payload before applying
 * it to localStorage. Protects against type confusion (null stored as array,
 * empty objects overwriting valid data, etc.).
 * @param {object} data - raw remote household data
 * @returns {object} - clean copy safe to write to localStorage
 */
function sanitizeHouseholdData(data) {
  if (!data || typeof data !== "object") return {};
  var out = {};

  // Arrays: only preserve if actually an array — never pass null/object through
  [
    "tasks","brainItems","shoppingItems","notifications","calEvents","connectedCals",
    "birthdays","favMeals","mealBankCustom","recipes","stores","shopCategories",
    "brainCats","homeSystems","dietaryFilters",
    "recurring","celebrations","gifts","inventory","pets","houseFile",
    "cove_lists_v1","cove_sections_v1","cove_notes_v1","burnoutChecked",
    "moments","subs","vaultSystems","packing_templates"
  ].forEach(function(k) {
    if (Array.isArray(data[k])) {
      out[k] = data[k].filter(function(item) { return item != null; });
    }
  });

  // people: filter nulls, ensure each has id/name
  if (Array.isArray(data.people)) {
    out.people = data.people.filter(function(p) { return p != null && p.id && p.name; });
  }

  // meals: ensure each day is an object not null
  if (data.meals && typeof data.meals === "object") {
    var safeMeals = {};
    MEAL_DAYS.forEach(function(day) {
      var m = data.meals[day];
      if (!m || typeof m !== "object") {
        safeMeals[day] = {};
      } else {
        var clean = {};
        Object.keys(m).forEach(function(k) {
          clean[k] = (m[k] == null) ? "" : String(m[k]);
        });
        safeMeals[day] = clean;
      }
    });
    out.meals = safeMeals;
  }

  // nextWeekMeals: same shape as meals — pass through if object
  if (data.nextWeekMeals && typeof data.nextWeekMeals === "object") {
    out.nextWeekMeals = data.nextWeekMeals;
  }

  // mealsWeekOf: string date (handled again below in string scalars)
  if (typeof data.mealsWeekOf === "string") out.mealsWeekOf = data.mealsWeekOf;

  // rhythm: pass through if object
  if (data.rhythm && typeof data.rhythm === "object") {
    out.rhythm = data.rhythm;
  }

  // Scalar number
  if (typeof data.mealCount === "number") out.mealCount = data.mealCount;

  // String scalars
  ["preferredName","flowGreetingTone","weatherLocation","flowMode","mealsWeekOf"].forEach(function(k) {
    if (typeof data[k] === "string") out[k] = data[k];
  });

  // Boolean scalars
  ["mealThemeEnabled"].forEach(function(k) {
    if (typeof data[k] === "boolean") out[k] = data[k];
  });

  // Objects: pass through if valid non-null object (not array)
  [
    "familyProfile","aiMemory","collapsedStores","mealThemes","calColorLabels",
    "coveData","schoolData","cove_items_v1","notifSettings","sections",
    "connectedCals","exhale_labels",
    "health","career","travel_profile"
  ].forEach(function(k) {
    if (data[k] !== undefined && typeof data[k] === "object" && !Array.isArray(data[k])) {
      out[k] = data[k];
    }
  });

  // ripples: normalize to array — was stored as object in earlier versions
  if (data.ripples !== undefined) {
    out.ripples = Array.isArray(data.ripples) ? data.ripples : [];
  }

  // cove_items_v1: object map — pass through if object
  if (data["cove_items_v1"] && typeof data["cove_items_v1"] === "object") {
    out["cove_items_v1"] = data["cove_items_v1"];
  }

  return out;
}

// ---------------------------------------------------------------------------
// P1-1 fix: dirty-local-wins merge
// NEW — not yet in App.jsx; will be introduced in Phase B.
// ---------------------------------------------------------------------------

/**
 * Given a sanitized remote payload and the current dirty-key list, returns
 * which keys should be written (remote wins) and which should be skipped
 * (local wins because the device has unsaved edits).
 *
 * The caller is responsible for:
 *   1. Writing toWrite keys to localStorage.
 *   2. If skipped is non-empty, calling debouncedSync() afterward so the
 *      local dirty edits reach the server before the next poll cycle can
 *      overwrite them again.
 *
 * Failure modes:
 *   - If the push after skip fails (network error), the dirty keys remain
 *     and the next poll cycle will call this again — dirty-local-wins repeats
 *     until the push succeeds. This is safe but means the device can stay
 *     diverged from the server until connectivity is restored.
 *   - If two devices both have dirty keys for the same logical key and both
 *     call this, neither will adopt the other's value — last-push-wins at the
 *     server level. This is acceptable for now and deferred to item-level sync.
 *
 * @param {object} remoteClean - output of sanitizeHouseholdData(remote)
 * @param {string[]} dirtyKeys - from readDirtyKeys()
 * @returns {{ toWrite: object, skipped: string[] }}
 */
function mergeDirtyLocalWins(remoteClean, dirtyKeys) {
  var toWrite = {};
  var skipped = [];
  Object.keys(remoteClean).forEach(function(k) {
    if (dirtyKeys.indexOf(k) !== -1) {
      skipped.push(k);
    } else {
      toWrite[k] = remoteClean[k];
    }
  });
  return { toWrite: toWrite, skipped: skipped };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  SYNC_KEYS,
  MEAL_DAYS,
  _DIRTY_EXCLUDE,
  markKeyDirty,
  readDirtyKeys,
  isOwnWrite,
  shouldApplyRemote,
  isRemotePayloadSafe,
  sanitizeHouseholdData,
  mergeDirtyLocalWins
};
