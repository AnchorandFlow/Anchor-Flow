// src/lib/exhaleUpgrade.js — the one-time Exhale data upgrades, runnable at
// app start (af_redesign) instead of only when the old Exhale screen mounts.
//
// The redesigned Exhale screen never mounts the old ExhaleSection, so its two
// one-time upgrades never ran for a household on the new look:
//   1. columns -> buckets: af_exhale_groups (old column board) copied into
//      af_exhale_buckets, once (flag af_exhale_buckets_migrated)
//   2. 4 -> 5 buckets: "This Weekend" inserted as bucket 3, old bucket 3
//      (Someday) moved to 4, "Here" renamed "Exhaled", once (flag
//      af_exhale_buckets_v2_migrated)
// Same keys, flags and results as ExhaleSection's own effects (which stay, so
// whichever runs first does the work and the other sees the flag). One
// difference: on a device with no Exhale data at all yet (e.g. before the
// first sync pull), nothing is decided and no flag is set, so data that
// arrives later still gets upgraded. Writes mark af_dirtyKeys like
// ExhaleSection's lsSet so the result syncs.
export var LS_BUCKETS = "af_exhale_buckets";
export var LS_GROUPS = "af_exhale_groups";
export var LS_COLUMNS = "af_exhale_columns";
export var FLAG_MIGRATED = "af_exhale_buckets_migrated";
export var FLAG_V2 = "af_exhale_buckets_v2_migrated";
var DEFAULT_BUCKET_NAMES = ["Exhaled", "Today", "Tomorrow", "This Weekend", "Someday"];
var DEFAULT_COLS = ["inbox", "decide", "do", "waiting", "someday"];
var DEFAULT_CARD_COLOR = "seafoam";

function defaultStorage() {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}
function get(st, key) {
  try { var v = st.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function uuid() {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch { /* fall through */ }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function writeBuckets(st, val) {
  st.setItem(LS_BUCKETS, JSON.stringify(val));
  try {
    var dirty = JSON.parse(st.getItem("af_dirtyKeys") || "[]");
    if (dirty.indexOf("exhale_buckets") === -1) { dirty.push("exhale_buckets"); st.setItem("af_dirtyKeys", JSON.stringify(dirty)); }
  } catch { /* keep the data even if dirty-marking fails */ }
}

// 1. columns -> buckets. Returns true when it wrote bucket data.
export function migrateColumns(st, now) {
  if (st.getItem(FLAG_MIGRATED)) return false;
  var existing = get(st, LS_BUCKETS);
  if (existing && Array.isArray(existing.items) && existing.items.length > 0) { st.setItem(FLAG_MIGRATED, "1"); return false; }
  var g = get(st, LS_GROUPS);
  if (!g || typeof g !== "object") {
    // No column data. Decide only once Exhale has bucket data of its own;
    // with neither key yet, wait (a sync pull may still bring columns).
    if (existing) st.setItem(FLAG_MIGRATED, "1");
    return false;
  }
  var cols = get(st, LS_COLUMNS);
  var colIds = Array.isArray(cols) && cols.length ? cols.map(function (c) { return c && c.id; }) : DEFAULT_COLS;
  var migrated = [];
  colIds.forEach(function (colId, idx) {
    var bucketIdx = idx === 0 ? 0 : idx === 1 ? 1 : idx === 2 ? 2 : 4;
    (g[colId] || []).forEach(function (card) {
      if (!card) return;
      migrated.push({ id: card.id || uuid(), text: card.text || "", notes: card.notes || "", bucketIndex: bucketIdx, createdAt: card.createdAt || now, color: card.color || DEFAULT_CARD_COLOR });
    });
  });
  if (migrated.length === 0) { st.setItem(FLAG_MIGRATED, "1"); return false; }
  writeBuckets(st, {
    bucketNames: existing && Array.isArray(existing.bucketNames) && existing.bucketNames.length === 5 ? existing.bucketNames : DEFAULT_BUCKET_NAMES.slice(),
    items: migrated,
  });
  st.setItem(FLAG_MIGRATED, "1");
  return true;
}

// 2. 4 -> 5 buckets. Returns true when it wrote bucket data.
export function upgradeToFiveBuckets(st) {
  if (st.getItem(FLAG_V2)) return false;
  var current = get(st, LS_BUCKETS);
  if (!current) return false; // nothing here yet: decide when data arrives
  if (!Array.isArray(current.bucketNames) || current.bucketNames.length !== 4) { st.setItem(FLAG_V2, "1"); return false; }
  var old = current.bucketNames;
  var items = (Array.isArray(current.items) ? current.items : []).map(function (it) {
    if (!it) return it;
    return it.bucketIndex === 3 ? Object.assign({}, it, { bucketIndex: 4 }) : it;
  });
  writeBuckets(st, Object.assign({}, current, { bucketNames: [old[0] === "Here" ? "Exhaled" : old[0], old[1], old[2], "This Weekend", old[3]], items: items }));
  st.setItem(FLAG_V2, "1");
  return true;
}

// Both, in ExhaleSection's order. -> { migrated, upgraded }
export function runExhaleUpgrades(storage, now) {
  var st = storage === undefined ? defaultStorage() : storage;
  if (!st) return { migrated: false, upgraded: false };
  try {
    var migrated = migrateColumns(st, now || Date.now());
    var upgraded = upgradeToFiveBuckets(st);
    return { migrated: migrated, upgraded: upgraded };
  } catch {
    return { migrated: false, upgraded: false };
  }
}

// App start: run now, and again whenever app data changes (a sync pull or
// another screen's write) until both flags are set. Returns a stop function.
export function startExhaleUpgrades(win, storage) {
  var w = win === undefined ? (typeof window !== "undefined" ? window : null) : win;
  var st = storage === undefined ? defaultStorage() : storage;
  function done() { try { return !!(st && st.getItem(FLAG_MIGRATED) && st.getItem(FLAG_V2)); } catch { return true; } }
  function run() {
    var r = runExhaleUpgrades(st);
    if ((r.migrated || r.upgraded) && w) {
      try { w.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: "exhale_buckets" } })); } catch { /* no window */ }
    }
    if (done()) stop();
  }
  function stop() { if (w) w.removeEventListener("af-data-changed", run); }
  if (w && !done()) w.addEventListener("af-data-changed", run);
  run();
  return stop;
}
