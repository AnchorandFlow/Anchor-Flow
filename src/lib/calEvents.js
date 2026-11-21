// src/lib/calEvents.js — calendar event rules shared by every Calendar view
// (flag on and off), Today, Flow and the Add/Edit Event sheet.
//
// Event shape (all fields optional except date). The newer fields sit beside
// the original ones so events saved before this change load unchanged:
//   repeat        "" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly" | "dates"
//   repeatDays    [0-6] weekdays for weekly/biweekly; missing = the date's weekday
//   repeatDates   [1-31] days of the month for "dates" (original meaning)
//   repeatEnd     { type: "never" | "on" | "after", date: "YYYY-MM-DD", count: N }
//   exceptions    ["YYYY-MM-DD"] occurrences removed from a series ("this event")
//   forPeople     ["everyone"] or person ids; forPerson mirrors it for older
//                 readers ("family" for everyone, else the first id)
//   category      id from DEFAULT_CATEGORIES or the household's calCategories
//   colorFrom     "person" = color follows the For person(s) in Settings;
//                 "palette" / "custom" = picked; missing = an older event
// No stored event is rewritten on load.

export var REPEAT_OPTIONS = [
  { v: "", label: "None" },
  { v: "daily", label: "Daily" },
  { v: "weekly", label: "Weekly" },
  { v: "biweekly", label: "Every 2 weeks" },
  { v: "monthly", label: "Monthly" },
  { v: "yearly", label: "Yearly" },
  { v: "dates", label: "Specific dates" },
];

export var DEFAULT_CATEGORIES = [
  { id: "appointment", label: "Appointment", emoji: "🩺" },
  { id: "activity", label: "Activity/Sports", emoji: "⚽" },
  { id: "school", label: "School", emoji: "🏫" },
  { id: "church", label: "Church", emoji: "⛪" },
  { id: "work", label: "Work", emoji: "💼" },
  { id: "birthday", label: "Birthday", emoji: "🎂" },
  { id: "holiday", label: "Holiday", emoji: "🎉" },
  { id: "family", label: "Family", emoji: "🏡" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "home", label: "Home/Chores", emoji: "🧹" },
  { id: "other", label: "Other", emoji: "📌" },
];

// The event color palette (new look): the app's blue, sage, sand, teal and
// gold; the sheet adds each person's Settings color. No rose or purple.
export var EVENT_PALETTE = [
  { color: "#6A9BB5", label: "Blue" },
  { color: "#7a9e8e", label: "Sage" },
  { color: "#c4a882", label: "Sand" },
  { color: "#7ab8a8", label: "Teal" },
  { color: "#e8a838", label: "Gold" },
];

// The family color (Everyone): the app's navy.
export var FAMILY_COLOR = "#1B2B44";

export function ymd(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function parseYmd(s) {
  if (!s || typeof s !== "string") return null;
  var p = s.split("-");
  if (p.length !== 3) return null;
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  return isNaN(d.getTime()) ? null : d;
}
function dayDiff(a, b) { return Math.round((b - a) / 86400000); }
function startOfWeek(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - x.getDay()); return x; }

export function repeatDaysOf(e) {
  var start = parseYmd(e && e.date);
  var days = Array.isArray(e && e.repeatDays) ? e.repeatDays.filter(function (n) { return n >= 0 && n <= 6; }) : [];
  return days.length ? days : (start ? [start.getDay()] : []);
}

// Does the series rule (ignoring end and exceptions) hit `t`? t >= start.
function ruleHits(e, start, t) {
  var r = e.repeat;
  if (r === "daily") return true;
  if (r === "weekly") return repeatDaysOf(e).indexOf(t.getDay()) !== -1;
  if (r === "biweekly") {
    if (repeatDaysOf(e).indexOf(t.getDay()) === -1) return false;
    return Math.round(dayDiff(startOfWeek(start), startOfWeek(t)) / 7) % 2 === 0;
  }
  if (r === "monthly") return start.getDate() === t.getDate();
  if (r === "yearly") return start.getDate() === t.getDate() && start.getMonth() === t.getMonth();
  if (r === "dates") return Array.isArray(e.repeatDates) && e.repeatDates.indexOf(t.getDate()) !== -1;
  return false;
}

// Does event `e` happen on `date` (a Date)? The original date always counts;
// repeats run from it, through repeatEnd, minus exceptions.
export function occursOn(e, date) {
  if (!e || !e.date) return false;
  var start = parseYmd(e.date);
  if (!start) return false;
  var t = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  var iso = ymd(t);
  if (Array.isArray(e.exceptions) && e.exceptions.indexOf(iso) !== -1) return false;
  if (iso === e.date) return true;
  if (!e.repeat || t < start) return false;
  if (!ruleHits(e, start, t)) return false;
  var end = e.repeatEnd;
  if (end && end.type === "on" && end.date && iso > end.date) return false;
  if (end && end.type === "after" && end.count > 0) {
    // The original date is occurrence 1 (even if it isn't on a chosen weekday).
    var n = 1, d = new Date(start);
    for (var guard = 0; guard < 4000; guard++) {
      d.setDate(d.getDate() + 1);
      if (d > t) break;
      if (ruleHits(e, start, d)) { n++; if (n > end.count) return false; }
    }
  }
  return true;
}

// ── People ──────────────────────────────────────────────────────────────────
// Who the event is for, as a list: ["everyone"], person ids, or [].
export function forIdsOf(e, people) {
  if (!e) return [];
  if (Array.isArray(e.forPeople)) return e.forPeople.slice();
  var f = e.forPerson;
  if (!f) return [];
  if (f === "family") return ["everyone"];
  var list = Array.isArray(people) ? people : [];
  if (list.some(function (p) { return p && p.id === f; })) return [f];
  var byName = list.filter(function (p) { return p && p.name === f; })[0];
  return byName ? [byName.id] : [];
}
// The stored pair for a chosen list.
export function forFields(ids) {
  var list = Array.isArray(ids) ? ids.slice() : [];
  if (list.indexOf("everyone") !== -1) return { forPeople: ["everyone"], forPerson: "family" };
  return { forPeople: list, forPerson: list.length ? list[0] : null };
}

// A person's color: the one chosen in Settings, else the fallback (the new
// look's person-color tokens).
export function settingsColor(personId, people, fallback) {
  var p = (Array.isArray(people) ? people : []).filter(function (x) { return x && x.id === personId; })[0];
  if (!p) return null;
  return p.color || (typeof fallback === "function" ? fallback(personId) : null) || null;
}

// Default event color for a For list: the first person's color, Everyone =
// the family color, nobody = null (caller keeps its own default).
export function colorForIds(ids, people, fallback) {
  if (!ids || !ids.length) return null;
  if (ids.indexOf("everyone") !== -1) return FAMILY_COLOR;
  return settingsColor(ids[0], people, fallback);
}

// Events whose color follows their people get the current Settings colors.
// Returns the same array when nothing changed.
export function refreshPersonColors(events, people, fallback) {
  if (!Array.isArray(events)) return events;
  var changed = false;
  var out = events.map(function (e) {
    if (!e || e.colorFrom !== "person") return e;
    var c = colorForIds(forIdsOf(e, people), people, fallback);
    if (!c || c === e.color) return e;
    changed = true;
    return Object.assign({}, e, { color: c });
  });
  return changed ? out : events;
}

// ── Categories ──────────────────────────────────────────────────────────────
export function allCategories(custom) {
  var extra = (Array.isArray(custom) ? custom : []).filter(function (c) { return c && c.id && c.label; });
  return DEFAULT_CATEGORIES.concat(extra);
}
export function categoryOf(e) {
  if (!e) return null;
  if (e.category) return e.category;
  return e.schoolType ? "school" : null;
}
export function newCategory(label, idFn) {
  var l = String(label || "").trim().replace(/\s+/g, " ").slice(0, 30);
  if (!l) return null;
  return { id: "c_" + (idFn ? idFn() : Date.now().toString(36)), label: l, emoji: "" };
}

// ── "This event" / "All events" ─────────────────────────────────────────────
// Edit one occurrence: the series skips that date, and a standalone copy with
// the changes takes its place.
export function editOccurrence(events, seriesId, iso, changes, newId) {
  var series = events.filter(function (e) { return e.id === seriesId; })[0];
  if (!series) return events;
  var one = Object.assign({}, series, changes, { id: newId, date: changes && changes.date ? changes.date : iso, repeat: "", repeatDays: undefined, repeatDates: [], repeatEnd: undefined, exceptions: undefined, seriesId: seriesId });
  Object.keys(one).forEach(function (k) { if (one[k] === undefined) delete one[k]; });
  return events.map(function (e) { return e.id === seriesId ? Object.assign({}, e, { exceptions: (e.exceptions || []).concat([iso]) }) : e; }).concat([one]);
}
export function deleteOccurrence(events, seriesId, iso) {
  return events.map(function (e) { return e.id === seriesId ? Object.assign({}, e, { exceptions: (e.exceptions || []).concat([iso]) }) : e; });
}
export function isRepeating(e) { return !!(e && e.repeat); }
