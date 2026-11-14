// src/redesign/flowData.js — pure summaries for the redesigned Flow screen
// (af_redesign). Read-only, existing keys only. Each mirrors the existing
// screen that owns the data:
//   eventsOn        — CalendarTab eventsForDay (incl. repeat rules)
//   workersOn       — CalendarTab wsNormalizeSchedule / wsActiveForDate
//   wavesToday      — Today screen todaysDailyWaves / todaysWeeklyWaves
//   lessonsToday    — Today screen Lighthouse week-plan subjects
//   tidePoolKids    — TidePoolTab roster rule (minors, tidePoolEnabled!==false)
import { MEAL_DAYS, resolveForPerson } from "../sync-core.js";
import { person as PERSON_COLORS, initialsFor } from "../design/tokens.js";
import { bucketItems, bucketName } from "./exhaleModel.js";

// Flow tab grid, in display order. `flag` = the Settings toggle that hides it.
export var FLOW_TABS = [
  { id: "exhale", label: "Exhale", icon: "💭", tab: "brain" },
  { id: "shopping", label: "Shopping", icon: "🛒", tab: "shop" },
  { id: "meals", label: "Meals", icon: "🍽️", tab: "meals", flag: "mealsEnabled" },
  { id: "calendar", label: "Calendar", icon: "📆", tab: "calendar" },
  { id: "waves", label: "Waves", icon: "〰️", tab: "waves" },
  { id: "tidepool", label: "Tide Pool", icon: "🏝️", tab: "tidepool", flag: "tidePoolEnabled" },
  { id: "lighthouse", label: "Lighthouse", icon: "📚", tab: "lighthouse", flag: "lighthouseEnabled" },
];

export function visibleFlowTabs(enabled) {
  var e = enabled || {};
  return FLOW_TABS.filter(function (t) { return !t.flag || e[t.flag] !== false; });
}

export var WEEK_MON_FIRST = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function arr(v) { return Array.isArray(v) ? v : []; }
export function ymd(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Monday..Sunday of the week containing `now`.
export function weekDates(now) {
  var d = new Date(now); d.setHours(0, 0, 0, 0);
  var offset = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - offset);
  return [0, 1, 2, 3, 4, 5, 6].map(function (i) { var x = new Date(d); x.setDate(d.getDate() + i); return x; });
}

export function eventsOn(calEvents, date) {
  var d = date.getDate(), mm = date.getMonth(), yy = date.getFullYear();
  var target = new Date(yy, mm, d);
  return arr(calEvents).filter(function (e) {
    if (!e || !e.date) return false;
    var ed = new Date(e.date + "T00:00:00");
    if (isNaN(ed.getTime())) return false;
    if (ed.getDate() === d && ed.getMonth() === mm && ed.getFullYear() === yy) return true;
    if (!e.repeat || target < ed) return false;
    if (e.repeat === "weekly") return ed.getDay() === target.getDay();
    if (e.repeat === "biweekly") return ed.getDay() === target.getDay() && Math.round((target - ed) / 86400000) % 14 === 0;
    if (e.repeat === "monthly") return ed.getDate() === d;
    if (e.repeat === "yearly") return ed.getDate() === d && ed.getMonth() === mm;
    if (e.repeat === "dates" && Array.isArray(e.repeatDates)) return e.repeatDates.indexOf(d) !== -1;
    return false;
  }).sort(function (a, b) { return String(a.time || "").localeCompare(String(b.time || "")); });
}

function isMinor(p, isPersonMinor) {
  if (!p) return false;
  if (p.role === "Kid" || p.role === "Teen") return true;
  return typeof isPersonMinor === "function" ? !!isPersonMinor(p) : false;
}

// Person color from tokens: named adults, kids alternate sage/sand.
export function personColor(personId, people, isPersonMinor) {
  var list = arr(people);
  var p = list.filter(function (x) { return x && x.id === personId; })[0];
  if (!p) return null;
  var first = String(p.name || "").trim().split(/\s+/)[0].toLowerCase();
  if (first === "lindsey") return PERSON_COLORS.lindsey;
  if (first === "twyla") return PERSON_COLORS.twyla;
  if (isMinor(p, isPersonMinor)) {
    var kids = list.filter(function (x) { return isMinor(x, isPersonMinor); });
    var i = kids.indexOf(p);
    return PERSON_COLORS.kids[(i < 0 ? 0 : i) % PERSON_COLORS.kids.length];
  }
  return PERSON_COLORS.defaultAdult;
}

function normalizeSchedule(s) {
  if (!s) return null;
  if (s.scheduleType) return s;
  if (s.type === "on-call") return { scheduleType: "on-call", onCallDays: arr(s.days) };
  if (s.type === "irregular") { var dates = {}; arr(s.dates).forEach(function (d) { dates[d] = []; }); return { scheduleType: "varied", dates: dates }; }
  var days = {}; arr(s.days).forEach(function (d) { days[d] = []; });
  return { scheduleType: "set", days: days };
}
function worksOn(sched, iso, dayName) {
  if (!sched) return false;
  if (sched.scheduleType === "set") return !!(sched.days && sched.days[dayName]);
  if (sched.scheduleType === "varied") return !!(sched.dates && sched.dates[iso]);
  if (sched.scheduleType === "on-call") return arr(sched.onCallDays).indexOf(dayName) !== -1;
  return false;
}

// [{ personId, initials, onCall }] for people working that date.
export function workersOn(workSchedules, people, date) {
  var iso = ymd(date), dayName = MEAL_DAYS[date.getDay()];
  var out = [];
  Object.keys(workSchedules || {}).forEach(function (pid) {
    var s = normalizeSchedule(workSchedules[pid]);
    if (!worksOn(s, iso, dayName)) return;
    var p = arr(people).filter(function (x) { return x && x.id === pid; })[0];
    out.push({ personId: pid, initials: initialsFor(p ? p.name : "") || "W", onCall: s.scheduleType === "on-call" });
  });
  return out;
}

export function calendarWeek(calEvents, workSchedules, people, now, isPersonMinor) {
  var todayIso = ymd(now);
  return weekDates(now).map(function (d) {
    var evs = eventsOn(calEvents, d);
    var dots = [];
    evs.forEach(function (e) {
      var pid = resolveForPerson(e.forPerson || e.responsibleParent || null, people);
      var c = pid ? personColor(pid, people, isPersonMinor) : null;
      if (c && dots.indexOf(c) === -1) dots.push(c);
    });
    return { iso: ymd(d), label: WEEK_MON_FIRST[(d.getDay() + 6) % 7].slice(0, 3), dayNum: d.getDate(), isToday: ymd(d) === todayIso, events: evs, dots: dots, work: workersOn(workSchedules, people, d) };
  });
}

export function exhaleCounts(buckets, myPersonId) {
  return [0, 1, 2, 3, 4].map(function (i) {
    var items = bucketItems(buckets, i, myPersonId);
    return { index: i, name: bucketName(buckets, i), open: items.filter(function (it) { return !it.done; }).length };
  });
}

// Open shopping items grouped by aisle (item.category; blank -> "Other"),
// aisles in the household's shopCategories order when known.
export function shoppingByAisle(items, shopCategories) {
  var open = arr(items).filter(function (i) { return i && !i.done; });
  var groups = {};
  open.forEach(function (i) {
    var a = (typeof i.category === "string" && i.category.trim()) ? i.category.trim() : "Other";
    (groups[a] = groups[a] || []).push(i);
  });
  var order = arr(shopCategories).map(function (c) { return typeof c === "string" ? c : (c && (c.name || c.label)) || ""; });
  var names = Object.keys(groups).sort(function (a, b) {
    if (a === "Other") return 1; if (b === "Other") return -1;
    var ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.localeCompare(b);
  });
  return { total: open.length, aisles: names.map(function (n) { return { name: n, items: groups[n] }; }) };
}

function dinnerOf(meals, day) {
  var dn = meals && meals[day] && meals[day].dinner;
  if (typeof dn === "string") return dn.trim();
  if (dn && typeof dn === "object") return String(dn.name || dn.title || dn.text || "").trim();
  return "";
}
export function mealsStrip(meals, now) {
  var todayName = MEAL_DAYS[now.getDay()];
  return WEEK_MON_FIRST.map(function (day) { var t = dinnerOf(meals, day); return { day: day, short: day.slice(0, 3), dinner: t, empty: !t, isToday: day === todayName }; });
}

export function wavesToday(waves, now) {
  var w = waves && typeof waves === "object" ? waves : {};
  var daily = arr(w.daily).filter(function (x) { return x && Array.isArray(x.tasks); });
  var weekly = arr(w.weekly).filter(function (x) { return x && x.dayOfWeek === now.getDay() && Array.isArray(x.tasks); });
  return daily.concat(weekly).map(function (x) {
    return { id: x.id, name: x.name || "Routine", done: x.tasks.filter(function (t) { return t && t.done; }).length, total: x.tasks.length };
  });
}

export function tidePoolKids(people, coveData, ledger, isPersonMinor) {
  var recs = arr(coveData);
  return arr(people).filter(function (p) { return isMinor(p, isPersonMinor) && p.tidePoolEnabled !== false; }).map(function (p) {
    var rec = recs.filter(function (r) { return r && r.kidId === p.id; })[0];
    var shells = (ledger && ledger.loaded) ? (ledger.balances[p.id] || 0) : (rec ? (rec.shells || 0) : 0);
    return { id: p.id, name: p.name || "Kid", shells: shells };
  });
}

export function lessonsToday(people, schoolData, now) {
  var dayName = MEAL_DAYS[now.getDay()];
  var out = [];
  arr(people).forEach(function (p) {
    var hs = p && schoolData && schoolData[p.id] && schoolData[p.id].homeschool;
    var plan = hs && hs.weekPlan && hs.weekPlan[dayName];
    arr(plan && plan.subjects).forEach(function (s) {
      if (!s || !s.name) return;
      out.push({ id: p.id + ":" + (s.id || s.name), child: p.name || "", subject: s.name, lesson: s.title || "", done: !!s.done });
    });
  });
  return out;
}
