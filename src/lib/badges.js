// src/lib/badges.js — Badges & Stars (Lighthouse › Badges): pure logic.
// No React, no App.jsx import, so it can be unit-tested directly.
//
// Feature flag: af_badges_v1 (per device, localStorage). Default OFF — only
// the exact string "true" turns it on.
//
// A per-child achievement wall, KEPT ACROSS DAYS (nothing here resets — the
// opposite of Rhythm's daily stickers). Its own ledger; unrelated to any
// other reward system in the app.
//
// Store: af_kid_badges, SYNCED (SYNC_KEYS "kid_badges").
//   { [kidId]: { curriculum:[Shield], milestones:[Medal], updatedAt } }
//   Shield { id, subject, icon, level 0..MAX_LEVEL }
//   Medal  { id, label, icon, type:"count"|"once", have, goal, earned, earnedAt }
//     count: earned automatically once have reaches goal
//     once:  awarded (or un-awarded) by a parent
// A kid with no entry gets the starter wall; nothing is written until a
// parent changes something. Every write: write → mark dirty → dispatch
// af-data-changed (same discipline as Rhythm routines / traditions).

export var BADGES_FLAG_KEY = "af_badges_v1";
export var BADGES_KEY = "kid_badges";
var BADGES_LS = "af_" + BADGES_KEY;
export var MAX_LEVEL = 4;
export var MAX_GOAL = 9999;

function ls(storage) {
  if (storage) return storage;
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}
function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
function int(v, lo, hi, dflt) {
  var n = Math.round(Number(v));
  if (!isFinite(n)) n = dflt;
  return Math.min(hi, Math.max(lo, n));
}
function str(v, max, dflt) {
  var s = typeof v === "string" ? v : (v == null ? "" : String(v));
  s = s.trim();
  return (s || dflt || "").slice(0, max);
}
export function newBadgeId(prefix) { return (prefix || "b") + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }

// ── flag ─────────────────────────────────────────────────────────────────────
export function badgesEnabled(storage) {
  var s = ls(storage);
  if (!s) return false;
  try { return s.getItem(BADGES_FLAG_KEY) === "true"; } catch { return false; }
}

// ── shapes ───────────────────────────────────────────────────────────────────
export function normalizeShield(x) {
  var o = isObj(x) ? x : {};
  return {
    id: typeof o.id === "string" && o.id ? o.id : newBadgeId("cs"),
    subject: str(o.subject, 40, "Subject"),
    icon: str(o.icon, 8, "📘"),
    level: int(o.level, 0, MAX_LEVEL, 0),
  };
}

export function normalizeMedal(x) {
  var o = isObj(x) ? x : {};
  var type = o.type === "once" ? "once" : "count";
  var m = {
    id: typeof o.id === "string" && o.id ? o.id : newBadgeId("ms"),
    label: str(o.label, 60, "Milestone"),
    icon: str(o.icon, 8, "⭐"),
    type: type,
    goal: type === "count" ? int(o.goal, 1, MAX_GOAL, 10) : 1,
    have: 0,
    earned: false,
    earnedAt: typeof o.earnedAt === "number" && isFinite(o.earnedAt) ? o.earnedAt : null,
  };
  if (type === "count") {
    m.have = int(o.have, 0, m.goal, 0);
    m.earned = m.have >= m.goal;
  } else {
    m.earned = o.earned === true;
  }
  if (!m.earned) m.earnedAt = null;
  return m;
}

// Starter wall for a child (no data written until edited).
export function starterWall() {
  return {
    curriculum: [
      { subject: "Math", icon: "🔢" }, { subject: "Reading", icon: "📖" }, { subject: "Writing", icon: "✏️" },
      { subject: "Spelling", icon: "🔤" }, { subject: "Science", icon: "🔬" },
    ].map(function (c, i) { return normalizeShield({ id: "cs_start_" + i, subject: c.subject, icon: c.icon, level: 0 }); }),
    milestones: [
      { label: "Read 100 books", icon: "📚", type: "count", goal: 100 },
      { label: "100 spelling words", icon: "🔡", type: "count", goal: 100 },
      { label: "First presentation", icon: "🎤", type: "once" },
      { label: "Learn the times tables", icon: "✖️", type: "once" },
    ].map(function (m, i) { return normalizeMedal(Object.assign({ id: "ms_start_" + i }, m)); }),
  };
}

export function normalizeWall(x) {
  var o = isObj(x) ? x : null;
  if (!o) return starterWall();
  var cur = Array.isArray(o.curriculum) ? o.curriculum.filter(isObj).map(normalizeShield) : null;
  var mil = Array.isArray(o.milestones) ? o.milestones.filter(isObj).map(normalizeMedal) : null;
  if (!cur && !mil) return starterWall();
  return { curriculum: cur || [], milestones: mil || [] };
}

// ── storage ──────────────────────────────────────────────────────────────────
export function loadBadges(storage) {
  var s = ls(storage);
  if (!s) return {};
  try { var v = JSON.parse(s.getItem(BADGES_LS) || "null"); return isObj(v) ? v : {}; } catch { return {}; }
}
export function wallFor(all, kidId) {
  return normalizeWall(isObj(all) ? all[kidId] : null);
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

// Save one child's wall. Re-reads storage first so another child's wall
// (perhaps just pulled from another device) is never overwritten by a stale
// copy. deps (tests): { storage, markDirty(key), dispatch(key), now }
export function saveWall(kidId, wall, deps) {
  var d = deps || {};
  if (!kidId) return null;
  var s = ls(d.storage);
  var next = Object.assign({}, loadBadges(d.storage));
  var w = normalizeWall(wall);
  next[kidId] = { curriculum: w.curriculum, milestones: w.milestones, updatedAt: d.now || Date.now() };
  if (s) { try { s.setItem(BADGES_LS, JSON.stringify(next)); } catch { /* storage full */ } }
  (d.markDirty || function (k) { defaultMarkDirty(k, d.storage); })(BADGES_KEY);
  (d.dispatch || defaultDispatch)(BADGES_KEY);
  return next;
}

// ── shields (curriculum) ────────────────────────────────────────────────────
function mapShield(wall, id, fn) {
  return { curriculum: wall.curriculum.map(function (c) { return c.id === id ? normalizeShield(fn(c)) : c; }), milestones: wall.milestones };
}
export function levelUp(wall, id) { return mapShield(wall, id, function (c) { return Object.assign({}, c, { level: Math.min(MAX_LEVEL, c.level + 1) }); }); }
export function levelDown(wall, id) { return mapShield(wall, id, function (c) { return Object.assign({}, c, { level: Math.max(0, c.level - 1) }); }); }
export function addShield(wall, subject, icon) {
  return { curriculum: wall.curriculum.concat([normalizeShield({ subject: subject, icon: icon, level: 0 })]), milestones: wall.milestones };
}
export function removeShield(wall, id) {
  return { curriculum: wall.curriculum.filter(function (c) { return c.id !== id; }), milestones: wall.milestones };
}

// ── medals (milestones) ─────────────────────────────────────────────────────
export function medalState(m) {
  if (m.earned) return "earned";
  if (m.type === "count" && m.have > 0) return "progress";
  return "locked";
}
export function medalPct(m) {
  if (m.earned) return 100;
  if (m.type !== "count") return 0;
  return Math.min(100, Math.round((m.have / m.goal) * 100));
}
function mapMedal(wall, id, fn, now) {
  return {
    curriculum: wall.curriculum,
    milestones: wall.milestones.map(function (m) {
      if (m.id !== id) return m;
      var n = normalizeMedal(fn(m));
      if (n.earned && !m.earned) n.earnedAt = now || Date.now();
      else if (n.earned) n.earnedAt = m.earnedAt;
      return n;
    }),
  };
}
// count: +1 / −1 (earned automatically at goal; dropping below un-earns)
export function bump(wall, id, delta, now) {
  return mapMedal(wall, id, function (m) {
    if (m.type !== "count") return m;
    return Object.assign({}, m, { have: m.have + (delta || 1) });
  }, now);
}
// once: parent awards / un-awards
export function setAwarded(wall, id, on, now) {
  return mapMedal(wall, id, function (m) {
    if (m.type !== "once") return m;
    return Object.assign({}, m, { earned: !!on });
  }, now);
}
// Edit label / icon / goal (and have, for corrections).
export function editMedal(wall, id, patch, now) {
  return mapMedal(wall, id, function (m) {
    var p = isObj(patch) ? patch : {};
    var out = Object.assign({}, m);
    ["label", "icon", "goal", "have"].forEach(function (k) { if (p[k] !== undefined) out[k] = p[k]; });
    return out;
  }, now);
}
export function addMilestone(wall, fields) {
  var f = isObj(fields) ? fields : {};
  var m = normalizeMedal({ label: f.label, icon: f.icon, type: f.type, goal: f.goal, have: 0, earned: false });
  return { curriculum: wall.curriculum, milestones: wall.milestones.concat([m]) };
}
export function removeMilestone(wall, id) {
  return { curriculum: wall.curriculum, milestones: wall.milestones.filter(function (m) { return m.id !== id; }) };
}

// ── summary ──────────────────────────────────────────────────────────────────
export function wallSummary(wall) {
  return {
    stars: wall.milestones.filter(function (m) { return m.earned; }).length,
    levels: wall.curriculum.reduce(function (t, c) { return t + c.level; }, 0),
  };
}
