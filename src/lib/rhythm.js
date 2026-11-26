// src/lib/rhythm.js — Rhythm (focus-block timer in Lighthouse): pure logic.
// No React, no App.jsx import, so it can be unit-tested directly.
//
// Feature flag: af_rhythm_v1 (per device, localStorage). Default OFF — only
// the exact string "true" turns it on.
//
// Three stores, all per kid (Lighthouse's person id):
//   af_rhythm_routines  SYNCED (SYNC_KEYS "rhythm_routines").
//                       { [kidId]: { blocks:[Block], updatedAt } }
//                       Every write marks the key dirty and dispatches
//                       af-data-changed, same as saveTraditions — the
//                       workDays / traditions / Tide Pool bug class was a
//                       write that skipped one of those two steps.
//   af_rhythm_stickers  LOCAL ONLY. Sticker state per kid. Today's tally
//                       (and "sets finished today") start fresh each day;
//                       the set being collected and its progress carry over,
//                       so a set fills up across days. Its own ledger,
//                       nothing to do with any other reward system in the app.
//   af_rhythm_run       LOCAL ONLY. The running timer per kid, so leaving
//                       Lighthouse and coming back keeps the block going.
//
// Block: { id, name, mins, type: "work"|"break", note, breakActivity }
//   note          the assignment, shown on screen while a work block runs
//   breakActivity a fixed movement idea; "" = spin the wheel

export var RHYTHM_FLAG_KEY = "af_rhythm_v1";
export var ROUTINES_KEY = "rhythm_routines";
var ROUTINES_LS = "af_" + ROUTINES_KEY;
var STICKERS_LS = "af_rhythm_stickers";
var RUN_LS = "af_rhythm_run";

export var WRAP_WARN_MS = 2 * 60 * 1000;
export var EXTEND_MS = 5 * 60 * 1000;
export var MIN_MINS = 1;
export var MAX_MINS = 120;

export var STICKER_SETS = [
  { name: "Night Sky", items: ["⭐", "🌙", "☄️", "🪐", "🌈", "🌟"] },
  { name: "Garden", items: ["🌻", "🦋", "🐝", "🌷", "🍄", "🐞"] },
  { name: "Jungle", items: ["🦁", "🐯", "🐘", "🦒", "🦜", "🐨"] },
];

export var BREAK_IDEAS = [
  "Ten jumping jacks, then shake it all out.",
  "Animal walks across the room — bear, then crab, then frog.",
  "Wall push-ups, ten slow ones.",
  "Balance on one foot, then switch. How long can you hold?",
  "Five big belly breaths — in slow, out slower.",
  "Dance to one song, any way you want.",
  "Stretch up tall like a tree, then flop to touch your toes.",
  "Crab-walk to the kitchen and back.",
  "Twenty seconds of running in place.",
  "Spin in a circle five times, then freeze like a statue.",
];

function ls(storage) {
  if (storage) return storage;
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}
function readJson(storage, key, fallback) {
  var s = ls(storage);
  if (!s) return fallback;
  try { var v = JSON.parse(s.getItem(key) || "null"); return v == null ? fallback : v; } catch { return fallback; }
}
function writeJson(storage, key, val) {
  var s = ls(storage);
  if (!s) return;
  try { s.setItem(key, JSON.stringify(val)); } catch { /* storage full / private mode */ }
}
function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }

// ── flag ─────────────────────────────────────────────────────────────────────
export function rhythmEnabled(storage) {
  var s = ls(storage);
  if (!s) return false;
  try { return s.getItem(RHYTHM_FLAG_KEY) === "true"; } catch { return false; }
}

// ── dates ────────────────────────────────────────────────────────────────────
function pad(n) { return (n < 10 ? "0" : "") + n; }
export function dayKey(d) {
  var x = d || new Date();
  return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate());
}

// ── blocks / routines ────────────────────────────────────────────────────────
export function newBlockId() { return "rb_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }

export function normalizeBlock(b) {
  var x = isObj(b) ? b : {};
  var type = x.type === "break" ? "break" : "work";
  var mins = Math.round(Number(x.mins));
  if (!isFinite(mins)) mins = type === "break" ? 10 : 20;
  return {
    id: typeof x.id === "string" && x.id ? x.id : newBlockId(),
    name: String(x.name == null ? (type === "break" ? "Break" : "Subject") : x.name).slice(0, 60),
    mins: Math.min(MAX_MINS, Math.max(MIN_MINS, mins)),
    type: type,
    note: String(x.note || "").slice(0, 500),
    breakActivity: String(x.breakActivity || "").slice(0, 160),
  };
}

export function defaultBlocks() {
  return [
    { name: "Spelling", mins: 20, type: "work", note: "" },
    { name: "Reading", mins: 20, type: "work", note: "" },
    { name: "Break", mins: 15, type: "break", breakActivity: "" },
    { name: "Math", mins: 20, type: "work", note: "" },
  ].map(normalizeBlock);
}

export function loadRoutines(storage) {
  var v = readJson(storage, ROUTINES_LS, {});
  return isObj(v) ? v : {};
}

// The kid's saved blocks, or the starter routine (not written until edited).
export function routineFor(routines, kidId) {
  var r = isObj(routines) ? routines[kidId] : null;
  if (r && Array.isArray(r.blocks) && r.blocks.length) return r.blocks.map(normalizeBlock);
  return defaultBlocks();
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

// Save one kid's routine. Re-reads the stored map first so another kid's
// routine (possibly just pulled from another device) is never overwritten by
// a stale in-memory copy. Then: write → mark dirty → af-data-changed (which
// HomeFlow's listener turns into a debounced push).
// deps (tests): { storage, markDirty(key), dispatch(key), now }
export function saveRoutine(kidId, blocks, deps) {
  var d = deps || {};
  if (!kidId) return null;
  var all = loadRoutines(d.storage);
  var next = Object.assign({}, all);
  next[kidId] = { blocks: (Array.isArray(blocks) ? blocks : []).map(normalizeBlock), updatedAt: d.now || Date.now() };
  writeJson(d.storage, ROUTINES_LS, next);
  (d.markDirty || function (k) { defaultMarkDirty(k, d.storage); })(ROUTINES_KEY);
  (d.dispatch || defaultDispatch)(ROUTINES_KEY);
  return next;
}

// List edits (pure; return a new array).
export function moveBlock(blocks, i, dir) {
  var j = i + dir;
  if (i < 0 || j < 0 || i >= blocks.length || j >= blocks.length) return blocks;
  var out = blocks.slice(); var t = out[i]; out[i] = out[j]; out[j] = t;
  return out;
}
export function updateBlock(blocks, id, patch) {
  return blocks.map(function (b) { return b.id === id ? normalizeBlock(Object.assign({}, b, patch)) : b; });
}
export function removeBlock(blocks, id) {
  if (blocks.length <= 1) return blocks;
  return blocks.filter(function (b) { return b.id !== id; });
}
export function toggleBlockType(blocks, id) {
  return blocks.map(function (b) {
    if (b.id !== id) return b;
    return normalizeBlock(Object.assign({}, b, { type: b.type === "break" ? "work" : "break" }));
  });
}
export function totalMins(blocks) {
  return blocks.reduce(function (t, b) { return t + (Number(b.mins) || 0); }, 0);
}

// ── daily stickers ──────────────────────────────────────────────────────────
export function freshStickerDay(date) {
  return { date: date, setIdx: 0, earned: [], completedSets: [], today: [] };
}

// Today's sticker state for a kid. On a new day the tally ("today") and the
// sets finished today reset; the active set and how far into it the kid got
// carry over from their last day.
export function stickerDayFor(ledger, kidId, date) {
  var v = isObj(ledger) ? ledger[kidId] : null;
  if (!v) return freshStickerDay(date);
  var setIdx = (Number(v.setIdx) || 0) % STICKER_SETS.length;
  var items = STICKER_SETS[setIdx].items;
  var earned = Array.isArray(v.earned) ? v.earned.filter(function (it) { return items.indexOf(it) !== -1; }) : [];
  if (v.date !== date) {
    return { date: date, setIdx: setIdx, earned: earned, completedSets: [], today: [] };
  }
  return {
    date: date, setIdx: setIdx, earned: earned,
    completedSets: Array.isArray(v.completedSets) ? v.completedSets.slice() : [],
    today: Array.isArray(v.today) ? v.today.slice() : [],
  };
}

// Earn one surprise sticker from the current set (never a repeat within the
// set). Completing the set records it and rolls to the next set.
// → { day, sticker, completedSet: { name, items } | null }
export function earnSticker(day, rand) {
  var r = typeof rand === "function" ? rand : Math.random;
  var d = {
    date: day.date, setIdx: day.setIdx, earned: day.earned.slice(),
    completedSets: day.completedSets.slice(), today: day.today.slice(),
  };
  var set = STICKER_SETS[d.setIdx % STICKER_SETS.length];
  var left = set.items.filter(function (it) { return d.earned.indexOf(it) === -1; });
  if (!left.length) left = set.items.slice();
  var pick = left[Math.min(left.length - 1, Math.floor(r() * left.length))];
  d.earned.push(pick);
  d.today.push(pick);
  var completed = null;
  if (d.earned.length >= set.items.length) {
    completed = { name: set.name, items: d.earned.slice() };
    d.completedSets.push(set.name);
    d.setIdx = (d.setIdx + 1) % STICKER_SETS.length;
    d.earned = [];
  }
  return { day: d, sticker: pick, completedSet: completed };
}

export function loadStickerLedger(storage) {
  var v = readJson(storage, STICKERS_LS, {});
  return isObj(v) ? v : {};
}
// Writes this kid's day. Other kids' entries are kept even from earlier days —
// their set progress carries over (one small object per kid).
export function saveStickerDay(kidId, day, storage) {
  var out = Object.assign({}, loadStickerLedger(storage));
  out[kidId] = day;
  writeJson(storage, STICKERS_LS, out);
  return out;
}

// ── run state (wall clock, same model as the Celebrate kitchen timers) ─────
// { date, blockId, endsAt, pausedLeft, durMs, warned, done:{[blockId]:true}, finished }
// pausedLeft != null means paused (ms left). Time is always endsAt - now, so
// a sleeping phone or a background tab never drifts.
export function idleRun(date) {
  return { date: date, blockId: null, endsAt: 0, pausedLeft: null, durMs: 0, warned: false, done: {}, finished: false };
}
export function timeLeftMs(run, now) {
  if (!run || !run.blockId) return 0;
  return run.pausedLeft != null ? run.pausedLeft : run.endsAt - now;
}
export function isRunning(run) { return !!(run && run.blockId && run.pausedLeft == null && !run.finished); }

// Warning window: the last 2 minutes of a work block (half the block if the
// block is shorter than 4 minutes, so it doesn't warn from the first second).
export function warnWindowMs(durMs) { return Math.min(WRAP_WARN_MS, Math.floor(durMs / 2)); }
export function isWrapping(block, run, now) {
  if (!block || block.type !== "work" || !run || !run.blockId) return false;
  var left = timeLeftMs(run, now);
  return left > 0 && left <= warnWindowMs(run.durMs);
}

export function startBlock(run, block, now) {
  var dur = block.mins * 60000;
  return Object.assign({}, run, { blockId: block.id, endsAt: now + dur, pausedLeft: null, durMs: dur, warned: false, finished: false });
}
export function pauseRun(run, now) {
  if (!isRunning(run)) return run;
  return Object.assign({}, run, { pausedLeft: Math.max(0, run.endsAt - now) });
}
export function resumeRun(run, now) {
  if (!run.blockId || run.pausedLeft == null) return run;
  return Object.assign({}, run, { endsAt: now + run.pausedLeft, pausedLeft: null });
}
export function extendRun(run) {
  if (!run.blockId) return run;
  var o = Object.assign({}, run, { durMs: run.durMs + EXTEND_MS, warned: false });
  if (o.pausedLeft != null) o.pausedLeft = o.pausedLeft + EXTEND_MS; else o.endsAt = o.endsAt + EXTEND_MS;
  return o;
}

// Finish the current block (time ran out, or Skip — Skip counts as done) and
// move on. The next block starts fresh from `now`; time away from the app
// never fast-forwards through several blocks. Returns
// { run, finishedBlock, next } — next null when the rhythm is complete.
export function completeCurrent(run, blocks, now) {
  var i = -1;
  for (var k = 0; k < blocks.length; k++) if (blocks[k].id === run.blockId) { i = k; break; }
  var finished = i >= 0 ? blocks[i] : null;
  var done = Object.assign({}, run.done);
  if (finished) done[finished.id] = true;
  var next = null;
  for (var j = i + 1; j < blocks.length; j++) if (!done[blocks[j].id]) { next = blocks[j]; break; }
  if (!next) {
    return { run: Object.assign({}, run, { blockId: null, pausedLeft: null, endsAt: 0, durMs: 0, warned: false, done: done, finished: true }), finishedBlock: finished, next: null };
  }
  var keepPaused = run.pausedLeft != null;
  var started = startBlock(Object.assign({}, run, { done: done }), next, now);
  if (keepPaused) started.pausedLeft = started.durMs;
  return { run: started, finishedBlock: finished, next: next };
}

export function loadRun(kidId, date, storage) {
  var all = readJson(storage, RUN_LS, {});
  var r = isObj(all) ? all[kidId] : null;
  if (!r || r.date !== date) return idleRun(date);
  return Object.assign(idleRun(date), r, { done: isObj(r.done) ? r.done : {} });
}
export function saveRun(kidId, run, storage) {
  var all = readJson(storage, RUN_LS, {});
  var out = {};
  if (isObj(all)) Object.keys(all).forEach(function (k) { if (all[k] && all[k].date === run.date) out[k] = all[k]; });
  out[kidId] = run;
  writeJson(storage, RUN_LS, out);
}

export function pickBreakIdea(rand, avoid) {
  var r = typeof rand === "function" ? rand : Math.random;
  var pool = BREAK_IDEAS.filter(function (x) { return x !== avoid; });
  return pool[Math.min(pool.length - 1, Math.floor(r() * pool.length))];
}
