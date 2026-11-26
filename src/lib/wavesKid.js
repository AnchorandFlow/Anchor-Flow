// src/lib/wavesKid.js — Waves kid-friendly view: pure logic.
// No React, no App.jsx import, so it can be unit-tested directly.
//
// Feature flag: af_waves_kid_v1 (per device). Default OFF — only "true" on.
//
// This is NOT a new area: it layers onto the existing Waves routines
// (af_exhale_waves, SYNC_KEYS "exhale_waves"), written through WavesSection's
// own persistWaves (which already marks exhale_waves dirty). New fields:
//   wave.kidView  boolean  daily wave shows as picture cards (kid view)
//   wave.kidId    string   whose routine it is (a person id) — feelings and
//                          gentle mode attach to this child
//   task.essential boolean step stays on a gentle day
//   task.icon     string   the picture on the card (emoji); a real photo per
//                          step is a TODO — see KidWaveView.jsx
// sanitizeHouseholdData (sync-core.js) carries these through a pull.
//
// Daily feelings: af_kid_feelings, SYNCED (SYNC_KEYS "kid_feelings") so a
// check-in on the kid's tablet reaches the parent's Compass.
//   { [kidKey]: { "YYYY-MM-DD": { feeling, gentle, at } } }
// Only today's entry is read; entries older than FEELING_KEEP_DAYS are pruned
// on write (they expire). Writes mark kid_feelings dirty + af-data-changed.

export var WAVES_KID_FLAG_KEY = "af_waves_kid_v1";
export var FEELINGS_KEY = "kid_feelings";
var FEELINGS_LS = "af_" + FEELINGS_KEY;
export var FEELING_KEEP_DAYS = 7;

export var FEELINGS = [
  { id: "calm", label: "Calm", icon: "🌊", line: "Smooth seas today. Let's flow." },
  { id: "happy", label: "Happy", icon: "☀️", line: "Sunny day! Let's make it a good one." },
  { id: "wiggly", label: "Wiggly", icon: "🌀", line: "Lots of energy — we'll move and shake it out." },
  { id: "big", label: "Big feelings", icon: "⛈️", line: "Big feelings are okay. We'll go slow and gentle." },
];
var FEELING_IDS = FEELINGS.map(function (f) { return f.id; });
export function feelingInfo(id) { return FEELINGS.filter(function (f) { return f.id === id; })[0] || null; }

function ls(storage) {
  if (storage) return storage;
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}
function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
function pad(n) { return (n < 10 ? "0" : "") + n; }
export function dayKey(d) { var x = d || new Date(); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); }
function daysBetween(a, b) {
  var pa = String(a).split("-"), pb = String(b).split("-");
  var da = new Date(+pa[0], +pa[1] - 1, +pa[2]), db = new Date(+pb[0], +pb[1] - 1, +pb[2]);
  return Math.round((db - da) / 86400000);
}
function validDay(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }

// ── flag ─────────────────────────────────────────────────────────────────────
export function wavesKidEnabled(storage) {
  var s = ls(storage);
  if (!s) return false;
  try { return s.getItem(WAVES_KID_FLAG_KEY) === "true"; } catch { return false; }
}

// ── routine fields (pure transforms on the waves object) ───────────────────
// patchWave: shallow patch of one wave; used for kidView / kidId.
export function patchWave(waves, type, waveId, patch) {
  var w = isObj(waves) ? waves : {};
  var out = Object.assign({}, w);
  out[type] = (Array.isArray(w[type]) ? w[type] : []).map(function (x) {
    return x && x.id === waveId ? Object.assign({}, x, patch) : x;
  });
  return out;
}
export function isKidWave(type, w) { return type === "daily" && !!(w && w.kidView === true); }

// A friendly picture for a step that has none yet.
var ICON_HINTS = [
  [/teeth|brush.*teeth|floss/, "🪥"], [/bed\b|make.*bed/, "🛏️"], [/dress|clothes|shirt/, "👕"], [/breakfast|cereal|eat/, "🥣"],
  [/shoe/, "👟"], [/bag|backpack/, "🎒"], [/hair|comb/, "🪮"], [/bath|shower/, "🛁"], [/wash.*hand|soap/, "🧼"],
  [/pajama|pyjama|pj/, "🌙"], [/book|read/, "📖"], [/toy|tidy|clean/, "🧸"], [/water|drink/, "💧"], [/pet|feed|dog|cat/, "🐾"],
  [/vitamin|medicine/, "💊"], [/lights? out|sleep|bedtime/, "💡"], [/homework|school|folder/, "📚"], [/lunch/, "🥪"],
];
export function suggestIcon(text) {
  var t = String(text || "").toLowerCase();
  for (var i = 0; i < ICON_HINTS.length; i++) if (ICON_HINTS[i][0].test(t)) return ICON_HINTS[i][1];
  return "⭐";
}
export function stepIcon(task) { return (task && typeof task.icon === "string" && task.icon.trim()) ? task.icon.trim() : suggestIcon(task && task.text); }

// Gentle day = essential steps only. If nothing is marked essential yet, the
// whole routine stays (a gentle day never hides everything).
export function visibleSteps(tasks, gentle) {
  var list = Array.isArray(tasks) ? tasks.filter(function (t) { return t && typeof t === "object"; }) : [];
  if (!gentle) return list;
  var ess = list.filter(function (t) { return t.essential === true; });
  return ess.length ? ess : list;
}
export function hasEssential(tasks) { return (Array.isArray(tasks) ? tasks : []).some(function (t) { return t && t.essential === true; }); }
export function stepProgress(tasks, gentle) {
  var shown = visibleSteps(tasks, gentle);
  var done = shown.filter(function (t) { return t.done === true; }).length;
  return { done: done, total: shown.length, pct: shown.length ? Math.round((done / shown.length) * 100) : 0, allDone: shown.length > 0 && done === shown.length };
}

// ── feelings (per kid per day, synced, expiring) ────────────────────────────
export function kidKeyFor(wave) { return wave && typeof wave.kidId === "string" && wave.kidId ? wave.kidId : "wave_" + (wave && wave.id); }

export function loadFeelings(storage) {
  var s = ls(storage);
  if (!s) return {};
  try { var v = JSON.parse(s.getItem(FEELINGS_LS) || "null"); return isObj(v) ? v : {}; } catch { return {}; }
}
// Today's entry for a kid, cleaned: { feeling: id|null, gentle: bool } — never null.
export function feelingFor(all, kidKey, date) {
  var kid = isObj(all) ? all[kidKey] : null;
  var e = isObj(kid) ? kid[date] : null;
  if (!isObj(e)) return { feeling: null, gentle: false };
  return { feeling: FEELING_IDS.indexOf(e.feeling) !== -1 ? e.feeling : null, gentle: e.gentle === true };
}
// Drop days older than FEELING_KEEP_DAYS (and malformed ones) across every kid.
export function pruneFeelings(all, today) {
  var out = {};
  Object.keys(isObj(all) ? all : {}).forEach(function (k) {
    var kid = all[k];
    if (!isObj(kid)) return;
    var keep = {};
    Object.keys(kid).forEach(function (d) {
      if (!validDay(d) || !isObj(kid[d])) return;
      var age = daysBetween(d, today);
      if (age >= 0 && age < FEELING_KEEP_DAYS) keep[d] = kid[d];
    });
    if (Object.keys(keep).length) out[k] = keep;
  });
  return out;
}
function defaultMarkDirty(key, storage) {
  var s = ls(storage);
  if (!s) return;
  try {
    var dirty = JSON.parse(s.getItem("af_dirtyKeys") || "[]");
    if (!Array.isArray(dirty)) dirty = [];
    if (dirty.indexOf(key) === -1) { dirty.push(key); s.setItem("af_dirtyKeys", JSON.stringify(dirty)); }
  } catch { /* ignore */ }
}
function defaultDispatch(key) {
  try { window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: key } })); } catch { /* no window */ }
}
// patch: { feeling?: id|null, gentle?: bool }. Re-reads storage first, prunes,
// writes, marks dirty, dispatches. deps (tests): { storage, markDirty, dispatch, now }
export function saveFeeling(kidKey, date, patch, deps) {
  var d = deps || {};
  if (!kidKey || !validDay(date)) return null;
  var all = pruneFeelings(loadFeelings(d.storage), date);
  var cur = feelingFor(all, kidKey, date);
  var p = isObj(patch) ? patch : {};
  var next = {
    feeling: p.feeling === null ? null : (FEELING_IDS.indexOf(p.feeling) !== -1 ? p.feeling : cur.feeling),
    gentle: typeof p.gentle === "boolean" ? p.gentle : cur.gentle,
    at: d.now || Date.now(),
  };
  var kid = Object.assign({}, all[kidKey] || {});
  kid[date] = next;
  all[kidKey] = kid;
  var s = ls(d.storage);
  if (s) { try { s.setItem(FEELINGS_LS, JSON.stringify(all)); } catch { /* storage full */ } }
  (d.markDirty || function (k) { defaultMarkDirty(k, d.storage); })(FEELINGS_KEY);
  (d.dispatch || defaultDispatch)(FEELINGS_KEY);
  return all;
}

// ── Compass input ───────────────────────────────────────────────────────────
// Optional context for Compass: today's check-ins, by child name. null when
// there are none (so Compass context is unchanged on days without one).
export function compassFeelingContext(state, today) {
  var st = isObj(state) ? state : {};
  var all = st.kid_feelings;
  if (!isObj(all)) return null;
  var date = today || dayKey(new Date());
  var people = Array.isArray(st.people) ? st.people : [];
  var out = [];
  Object.keys(all).forEach(function (k) {
    var f = feelingFor(all, k, date);
    if (!f.feeling) return;
    var p = people.filter(function (x) { return x && x.id === k; })[0];
    out.push({ child: (p && p.name) || "A child", feeling: feelingInfo(f.feeling).label, gentle_day: f.gentle });
  });
  if (!out.length) return null;
  var big = out.some(function (o) { return o.feeling === "Big feelings"; });
  return {
    checkins: out,
    note: "Optional context from the kids' Waves check-in this morning." + (big
      ? " A child said they have big feelings — if it fits, gently suggest a lighter day (fewer must-dos, more slack). Never frame it as a problem."
      : " Use only if it naturally fits."),
  };
}
