// src/redesign/fullViewData.js — pure helpers for the redesigned Flow full
// views (af_redesign). Existing data and keys only.
import { eventsOn, workersOn, personColor, ymd } from "./flowData.js";
import { resolveForPerson } from "../sync-core.js";
import { initialsFor, tone, accentTone, calendarTones, hashIndex } from "../design/tokens.js";

var UNCAT = "__uncat__";

// Group a store's items by subcategory in Settings order; uncategorized last.
export function groupByAisle(items, categories, catLabel, catEmoji) {
  var grouped = {};
  items.forEach(function (it) {
    var c = it.category && it.category !== "" && it.category !== "grocery" ? it.category : UNCAT;
    (grouped[c] = grouped[c] || []).push(it);
  });
  var order = (categories || []).map(catLabel).filter(function (l) { return grouped[l] && grouped[l].length; });
  Object.keys(grouped).forEach(function (k) { if (k !== UNCAT && order.indexOf(k) === -1) order.push(k); });
  if (grouped[UNCAT]) order.push(UNCAT);
  return order.map(function (k) {
    var cat = (categories || []).filter(function (c) { return catLabel(c) === k; })[0];
    return { key: k, label: k === UNCAT ? "Other" : k, emoji: k === UNCAT ? "📦" : (cat ? catEmoji(cat) : "📦"), items: grouped[k] };
  });
}

// ── Calendar ────────────────────────────────────────────────────────────────
// Built on the Flow summary helpers so both screens agree: eventsOn mirrors
// CalendarTab's eventsForDay (repeat rules included), workersOn its work
// schedules, personColor the token person colors.

export var WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export function eventPersonId(e, people) {
  return resolveForPerson((e && (e.forPerson || e.responsibleParent)) || null, people) || null;
}

// One calendar day: its events, the person-color dots for them (one per
// person), and who's working — scheduled people (af_work_schedules) plus the
// device's own date-keyed work day (af_workDays) under `me`'s initials.
export function calendarDay(date, d) {
  var events = eventsOn(d.calEvents, date);
  var dots = [];
  events.forEach(function (e) {
    var pid = eventPersonId(e, d.people);
    var c = pid ? personColor(pid, d.people, d.isPersonMinor) : null;
    if (c && dots.indexOf(c) === -1) dots.push(c);
  });
  var iso = ymd(date);
  var work = workersOn(d.workSchedules, d.people, date);
  var mine = d.workDays && d.workDays[iso];
  if (mine && mine.type !== "off") {
    var me = (d.people || []).filter(function (p) { return p && p.id === d.myPersonId; })[0];
    var already = me && work.some(function (w) { return w.personId === me.id; });
    if (!already) work = work.concat([{ personId: me ? me.id : "me", initials: initialsFor(me ? me.name : "") || "ME", onCall: false, workDayType: mine.type }]);
  }
  return { iso: iso, date: date, events: events, dots: dots, work: work, markers: (d.calMarkers && d.calMarkers[iso]) || [] };
}

// Sunday-first month grid (same layout as the legacy month view): leading
// nulls for the days before the 1st, then each date.
export function monthCells(year, month) {
  var first = new Date(year, month, 1).getDay();
  var days = new Date(year, month + 1, 0).getDate();
  var cells = [];
  for (var i = 0; i < first; i++) cells.push(null);
  for (var dnum = 1; dnum <= days; dnum++) cells.push(new Date(year, month, dnum));
  return cells;
}

// ── Calendar event colors ───────────────────────────────────────────────────
var DEFAULT_EVENT_COLOR = "#6a9bb5"; // the add-event form's default

function hueSat(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  var n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = Math.round(h * 60); if (h < 0) h += 360;
  var l = (mx + mn) / 2, sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return { h: h, s: sat };
}
// An event's tone. Purple/pink stored colors (birthdays, celebrations) land
// on gold, since the redesign has no purple or pink outside Sunset.
export function eventTone(e) {
  var c = String((e && e.color) || "").toLowerCase();
  var hs = c && c !== DEFAULT_EVENT_COLOR ? hueSat(c) : null;
  // Blue-family stored colors (the form default and its neighbors, which is
  // most events) are treated as "no color chosen" and spread like unset ones.
  if (hs && hs.s >= 0.18 && !(hs.h >= 195 && hs.h < 260)) {
    var h = hs.h;
    if (h >= 260 || h < 20) return accentTone.gold;
    if (h < 45) return tone.sand;
    if (h < 70) return accentTone.gold;
    if (h < 150) return tone.sage;
    if (h < 172) return accentTone.seafoam;
    return tone.teal;
  }
  return calendarTones[hashIndex((e && (e.title || e.id)) || "", calendarTones.length)];
}
