// src/design/redesignFlag.js — af_redesign: per-device switch for the new
// visual design (tokens in ./tokens.js). OFF by default.
//
// Device-local only: stored as localStorage "af_redesign" = "true". NOT in
// SYNC_KEYS, never synced, never dirty-marked — one device can preview the
// new look while every other household device stays on the current one.
// Switched in Settings › Design preview.
//
// Nothing renders differently based on this yet; it only exists so later
// redesign steps have a single gate to read.

export var REDESIGN_FLAG_KEY = "af_redesign";

export function readRedesignFlag(storage) {
  try {
    var s = storage === undefined ? (typeof localStorage !== "undefined" ? localStorage : null) : storage;
    return !!s && s.getItem(REDESIGN_FLAG_KEY) === "true";
  } catch { return false; }
}

// ON writes "true"; OFF removes the key (so "off" and "never set" are the
// same state), then notifies same-tab listeners.
export function writeRedesignFlag(on, storage) {
  var s = storage === undefined ? (typeof localStorage !== "undefined" ? localStorage : null) : storage;
  try {
    if (!s) return;
    if (on) s.setItem(REDESIGN_FLAG_KEY, "true");
    else s.removeItem(REDESIGN_FLAG_KEY);
  } catch { /* storage blocked — flag stays off */ }
  try { window.dispatchEvent(new CustomEvent("af-redesign-changed", { detail: { on: !!on } })); } catch { /* no window (tests/SSR) */ }
}

// Read once at module load, same convention as af_shopping_v2 / af_tidepool_v2.
export var REDESIGN = readRedesignFlag();
