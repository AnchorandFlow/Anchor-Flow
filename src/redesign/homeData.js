// src/redesign/homeData.js — pure data model for the redesigned Home
// (af_redesign). Reads ONLY existing data keys, never writes, never adds keys.
// Each derivation mirrors the existing screen that owns that data so the
// numbers match what the user sees elsewhere:
//   exhale Today/Exhaled  — ExhaleSection DEFAULT_BUCKET_NAMES (0 Exhaled, 1 Today)
//   Safe Harbor %         — SafeHarbor.jsx pct (tier 1, persistent item.checked)
//   next Horizon event    — HorizonTab nextTrip (days > 0) / nextCeleb (annual)
//   kid quote             — RipplesRoom quoteRipples (category funny or "quoted")
//   next tradition        — RipplesRoom daysUntil("MM-DD")
import { MEAL_DAYS } from "../sync-core.js";

export var EXHALED_BUCKET = 0;
export var TODAY_BUCKET = 1;
export var SUNSET_HOUR = 17;

function arr(v) { return Array.isArray(v) ? v : []; }
function str(v) { return typeof v === "string" ? v.trim() : ""; }

export function localDateStr(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

export function greetingFor(hour) {
  return hour < 12 ? "Good morning" : hour < SUNSET_HOUR ? "Good afternoon" : "Good evening";
}

// Same rules as the current Home greeting (AnchorTab): hide emails/handles,
// capitalize; first word only (the redesign asks for first name).
export function firstNameFrom(displayName) {
  var n = str(displayName);
  if (!n || n.indexOf("@") !== -1 || n.indexOf(".") !== -1) return "";
  var first = n.split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function dinnerText(meals, dayName) {
  var m = (meals && meals[dayName]) || {};
  var d = m.dinner;
  if (typeof d === "string") return d.trim();
  if (d && typeof d === "object") return str(d.name || d.title || d.text);
  return "";
}

export function mealsPlannedThisWeek(meals) {
  return MEAL_DAYS.filter(function (day) { return !!dinnerText(meals, day); }).length;
}

export function exhaleItems(buckets, index) {
  var items = buckets && Array.isArray(buckets.items) ? buckets.items : [];
  return items.filter(function (it) { return it && !it.archived && it.bucketIndex === index; });
}

export function todayEvents(calEvents, now) {
  var today = localDateStr(now);
  return arr(calEvents)
    .filter(function (e) { return e && e.date === today; })
    .sort(function (a, b) { return String(a.time || "").localeCompare(String(b.time || "")); });
}

// Shopping: open (not done) items. "Who added" only when an item actually
// carries a name — today no write path records one, so this is null.
export function shoppingSummary(items) {
  var open = arr(items).filter(function (i) { return i && !i.done; });
  var last = open.length ? open[open.length - 1] : null;
  var by = last ? str(last.addedByName || last.addedBy || last.createdByName) : "";
  return { count: open.length, lastAddedBy: by || null };
}

export function safeHarborReadiness(sh) {
  if (!sh || typeof sh !== "object" || !Array.isArray(sh.grabItems) || !sh.grabItems.length) return null;
  var visible = sh.grabItems.filter(function (i) { return i && !i.removed && (i.tier == null || i.tier <= 1); });
  if (!visible.length) return null;
  var checked = visible.filter(function (i) { return !!i.checked; }).length;
  return Math.round((checked / visible.length) * 100);
}

function daysUntilYmd(dateStr, now) {
  if (!dateStr) return null;
  var p = String(dateStr).split("-");
  if (p.length !== 3) return null;
  var t = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  if (isNaN(t.getTime())) return null;
  return Math.round((t - startOfDay(now)) / 86400000);
}

export function nextHorizonEvent(trips, celebrations, now) {
  var today = startOfDay(now);
  var cands = [];
  arr(trips).forEach(function (t) {
    var d = t ? daysUntilYmd(t.startDate, now) : null;
    if (d !== null && d > 0) cands.push({ kind: "trip", name: str(t.name) || "Trip", days: d });
  });
  arr(celebrations).forEach(function (c) {
    if (!c) return;
    var next = new Date(today.getFullYear(), (c.month || 1) - 1, c.day || 1);
    if (next < today) next.setFullYear(next.getFullYear() + 1);
    cands.push({ kind: "celebration", name: str(c.name) || "Celebration", days: Math.round((next - today) / 86400000) });
  });
  cands.sort(function (a, b) { return a.days - b.days; });
  return cands[0] || null;
}

export function latestKidQuote(ripples) {
  var quotes = arr(ripples).filter(function (r) { return r && (r.category === "funny" || (r.name && String(r.name).indexOf('"') !== -1)); });
  quotes.sort(function (a, b) {
    if (!a.date && !b.date) return 0; if (!a.date) return 1; if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });
  var q = quotes[0];
  return q ? { text: str(q.name), who: str(q.who) } : null;
}

function daysUntilMonthDay(monthDay, now) {
  if (!monthDay) return null;
  var p = String(monthDay).split("-");
  if (p.length !== 2) return null;
  var m = parseInt(p[0], 10) - 1, d = parseInt(p[1], 10);
  if (isNaN(m) || isNaN(d)) return null;
  var today = startOfDay(now);
  var next = new Date(today.getFullYear(), m, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m, d);
  return Math.round((next - today) / 86400000);
}

export function nextTradition(traditions, now) {
  var best = null;
  arr(traditions).forEach(function (t) {
    if (!t) return;
    var d = daysUntilMonthDay(t.when, now);
    if (d === null) return;
    if (!best || d < best.days) best = { title: str(t.title) || "Tradition", emoji: t.emoji || "", days: d };
  });
  return best;
}

export function daysLabel(days) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return "in " + days + " days";
}

// Driftwood is not built yet (docs/audit/launch-assessment.md lists it as
// deferred) — no data key exists, so there is never unread Driftwood.
export function hasUnreadDriftwood() { return false; }

export function buildHomeModel(input) {
  var now = input.now || new Date();
  var dayName = MEAL_DAYS[now.getDay()];
  var mealsOn = input.mealsEnabled !== false;
  var dinner = mealsOn ? dinnerText(input.meals, dayName) : "";
  var events = todayEvents(input.calEvents, now);
  var exhaleToday = exhaleItems(input.exhaleBuckets, TODAY_BUCKET);
  return {
    greeting: greetingFor(now.getHours()),
    firstName: firstNameFrom(input.displayName),
    dateLabel: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    mode: input.flowMode || "Smooth",
    showSunset: now.getHours() >= SUNSET_HOUR,
    today: { events: events, exhale: exhaleToday, dinner: dinner },
    flow: {
      exhaleTodayCount: exhaleToday.length,
      shopping: shoppingSummary(input.shoppingItems),
      mealsPlanned: mealsOn ? mealsPlannedThisWeek(input.meals) : null,
    },
    anchor: {
      safeHarborPct: safeHarborReadiness(input.safeHarbor),
      horizon: nextHorizonEvent(input.trips, input.celebrations, now),
    },
    ripples: {
      quote: latestKidQuote(input.ripples),
      tradition: nextTradition(input.traditions, now),
      unreadDriftwood: hasUnreadDriftwood(),
    },
  };
}
