// src/design/redesignFlag.js — af_redesign: gate for the new visual design
// (tokens in ./tokens.js).
//
// Who gets it:
//   REDESIGN_PUBLIC === true          -> every household is eligible
//   household id in BETA_HOUSEHOLDS   -> that household is eligible
//   anyone else                       -> always OFF, Settings switch hidden
//
// Eligible households are ON by default on every device. Each device can
// opt out via Settings › Design preview, stored device-locally as
// localStorage "af_redesign" = "false" (never synced, never dirty-marked).
// A stored value is ignored entirely for non-eligible households, so a stale
// "true" from the earlier opt-in version can't turn it on outside the beta.
//
// The household id is read from af_householdId (the synced household the
// device belongs to).

export var REDESIGN_PUBLIC = false;
export var BETA_HOUSEHOLDS = ["hh_o7yzu28"];
export var REDESIGN_FLAG_KEY = "af_redesign";

function defaultStorage() {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}

export function readHouseholdId(storage) {
  try {
    var raw = storage && storage.getItem("af_householdId");
    var v = raw ? JSON.parse(raw) : null;
    return v ? String(v) : null;
  } catch { return null; }
}

// opts (tests only): { isPublic, beta, householdId }
export function isRedesignEligible(householdId, opts) {
  var o = opts || {};
  var isPublic = o.isPublic === undefined ? REDESIGN_PUBLIC : o.isPublic;
  var beta = o.beta || BETA_HOUSEHOLDS;
  if (isPublic === true) return true;
  return !!householdId && beta.indexOf(householdId) !== -1;
}

// -> { eligible, on, householdId }
export function getRedesignState(storage, opts) {
  var s = storage === undefined ? defaultStorage() : storage;
  var o = opts || {};
  var hid = o.householdId !== undefined ? o.householdId : readHouseholdId(s);
  var eligible = isRedesignEligible(hid, o);
  if (!eligible) return { eligible: false, on: false, householdId: hid };
  var stored = null;
  try { stored = s ? s.getItem(REDESIGN_FLAG_KEY) : null; } catch { stored = null; }
  return { eligible: true, on: stored !== "false", householdId: hid };
}

export function readRedesignFlag(storage, opts) {
  return getRedesignState(storage, opts).on;
}

// Device-local opt-out for eligible households. ON stores "true" (same as
// the default), OFF stores "false".
export function writeRedesignFlag(on, storage) {
  var s = storage === undefined ? defaultStorage() : storage;
  try { if (s) s.setItem(REDESIGN_FLAG_KEY, on ? "true" : "false"); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new CustomEvent("af-redesign-changed", { detail: { on: !!on } })); } catch { /* no window */ }
}

// Read once at module load, same convention as af_shopping_v2 / af_tidepool_v2.
// Settings reads getRedesignState() live; render code that gates on REDESIGN
// picks up a household change (e.g. joining the beta household) on reload.
export var REDESIGN = readRedesignFlag();
