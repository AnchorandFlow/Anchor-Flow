// src/lib/sunsetLog.js — Sunset completion, per member per date (af_redesign).
//
// af_sunset_log (synced) = { [personId]: { [YYYY-MM-DD]: entry } }
//   entry = { completedAt, updatedAt, mood, released: [{ text, choice }],
//             exhaled: [text] }
// The date is the household's local date (familyProfile.timezone, else the
// device's), so Sunset reads "Anchored" until the household's midnight and
// "Begin" after it. Two members (or two devices) can write the same night:
// on receive, mergeSunsetLog keeps every member's every date and, for the
// same member and date, the newer updatedAt — never last-write-wins on the
// whole key. Entries older than KEEP_DAYS are dropped on write.
export var SUNSET_KEY = "sunset_log";
var KEEP_DAYS = 60;

function readJSON(key, fb) {
  try { var v = JSON.parse(localStorage.getItem("af_" + key) || "null"); return v === null ? fb : v; } catch { return fb; }
}
function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }

export function householdTimeZone() {
  var fp = readJSON("familyProfile", null);
  return fp && typeof fp.timezone === "string" && fp.timezone ? fp.timezone : null;
}

// "YYYY-MM-DD" for `now` in the given IANA zone (device local when absent or
// unknown).
export function householdDate(now, tz) {
  var d = now || new Date();
  if (tz) {
    try {
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
      var get = function (t) { var p = parts.filter(function (x) { return x.type === t; })[0]; return p ? p.value : ""; };
      var s = get("year") + "-" + get("month") + "-" + get("day");
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    } catch { /* unknown zone: fall through */ }
  }
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
}

export function todayKey(now) { return householdDate(now, householdTimeZone()); }

export function currentMemberId() {
  try { return localStorage.getItem("af_myPersonId") || "me"; } catch { return "me"; }
}

export function readSunsetLog() {
  var v = readJSON(SUNSET_KEY, {});
  return isObj(v) ? v : {};
}

export function getSunsetEntry(personId, date, log) {
  var l = log || readSunsetLog();
  var p = l[personId];
  return isObj(p) && isObj(p[date]) ? p[date] : null;
}

export function isAnchoredToday(now) {
  return !!getSunsetEntry(currentMemberId(), todayKey(now));
}

function dayNumber(date) {
  var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
  return p ? Date.UTC(+p[1], +p[2] - 1, +p[3]) / 86400000 : null;
}

export function pruneSunsetLog(log, today) {
  var cut = dayNumber(today);
  var out = {};
  Object.keys(log || {}).forEach(function (pid) {
    if (!isObj(log[pid])) return;
    var days = {};
    Object.keys(log[pid]).forEach(function (date) {
      var n = dayNumber(date);
      if (n === null || !isObj(log[pid][date])) return;
      if (cut !== null && cut - n > KEEP_DAYS) return;
      days[date] = log[pid][date];
    });
    if (Object.keys(days).length) out[pid] = days;
  });
  return out;
}

// Write (merge `patch` into the entry), dirty-mark for sync, notify screens.
export function saveSunsetEntry(personId, date, patch, nowMs) {
  var log = readSunsetLog();
  var prev = getSunsetEntry(personId, date, log) || {};
  var t = new Date(nowMs || Date.now()).toISOString();
  var entry = Object.assign({ completedAt: prev.completedAt || t, released: [], exhaled: [] }, prev, patch, { updatedAt: t });
  var next = Object.assign({}, log);
  next[personId] = Object.assign({}, isObj(log[personId]) ? log[personId] : {});
  next[personId][date] = entry;
  next = pruneSunsetLog(next, date);
  try {
    localStorage.setItem("af_" + SUNSET_KEY, JSON.stringify(next));
    var dirty = JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]");
    if (!Array.isArray(dirty)) dirty = [];
    if (dirty.indexOf(SUNSET_KEY) === -1) { dirty.push(SUNSET_KEY); localStorage.setItem("af_dirtyKeys", JSON.stringify(dirty)); }
  } catch { /* storage blocked */ }
  try { window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: SUNSET_KEY } })); } catch { /* no window */ }
  return entry;
}

// Pull-side merge: union of members and dates; same member + date keeps the
// newer updatedAt (local wins a tie, so an unsent edit is never lost).
export function mergeSunsetLog(local, remote) {
  var a = isObj(local) ? local : {}, b = isObj(remote) ? remote : {};
  var out = {};
  Object.keys(a).concat(Object.keys(b)).forEach(function (pid) {
    if (out[pid]) return;
    var la = isObj(a[pid]) ? a[pid] : {}, lb = isObj(b[pid]) ? b[pid] : {};
    var days = {};
    Object.keys(la).concat(Object.keys(lb)).forEach(function (date) {
      var x = isObj(la[date]) ? la[date] : null, y = isObj(lb[date]) ? lb[date] : null;
      if (!x && !y) return;
      if (!x) { days[date] = y; return; }
      if (!y) { days[date] = x; return; }
      days[date] = String(y.updatedAt || "") > String(x.updatedAt || "") ? y : x;
    });
    out[pid] = days;
  });
  return out;
}
