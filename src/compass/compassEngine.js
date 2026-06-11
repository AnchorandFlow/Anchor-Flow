// src/compass/compassEngine.js
// Compass v1 engine: household state → compact context → /api/claude → structured JSON.
//
// Pure logic, no UI, no JSX — designed to survive the redesign and plug into
// the new shell's floating Compass layer unchanged.
//
// All calls go through fetch("/api/claude") — the auth shim in App.jsx adds the
// session token automatically, and the hardened proxy maps "sonnet"/"haiku".
//
// ⚠️ INTEGRATION NOTES (read before wiring):
// 1. Add "compassCache" to SYNC_KEYS in App.jsx, or briefings won't sync to
//    Twyla's devices and won't survive reloads. (We know how that movie ends.)
// 2. The extractors below use flexible field lookups (pick()) because item
//    shapes vary across the app. Spot-check each section against real data
//    once, in the console: console.log(buildCompassContext(state, "today")).

import { COMPASS_PROMPTS } from "./compassPrompts";

// ── small utils ───────────────────────────────────────────────────────────────

function pick(obj, names, fallback) {
  if (!obj) return fallback;
  for (var i = 0; i < names.length; i++) {
    var v = obj[names[i]];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

function dateKey(d) {
  var x = d ? new Date(d) : new Date();
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}

// ISO week key like "2026-W24" — used to cache the weekly review
function weekKey(d) {
  var x = d ? new Date(d) : new Date();
  var day = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - day + 3);
  var firstThu = new Date(x.getFullYear(), 0, 4);
  var week = 1 + Math.round(((x - firstThu) / 86400000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
  return x.getFullYear() + "-W" + String(week).padStart(2, "0");
}

function daysFromNow(dateLike) {
  if (!dateLike) return null;
  var d = new Date(dateLike);
  if (isNaN(d)) return null;
  return Math.round((d.setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
}

function asArray(v) { return Array.isArray(v) ? v : []; }

// ── compact extractors ────────────────────────────────────────────────────────
// Each returns small plain objects — titles, dates, names — never whole records.

function slimEvent(e) {
  var rawDate = pick(e, ["date", "event_date", "start", "when", "day"], null);
  var weekday = null;
  if (rawDate) {
    var dd = new Date(String(rawDate).indexOf("T") === -1 ? rawDate + "T00:00:00" : rawDate);
    if (!isNaN(dd)) weekday = dd.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }
  return {
    weekday: weekday,
    title: pick(e, ["title", "name", "summary", "text"], "Untitled"),
    date: pick(e, ["date", "event_date", "start", "when", "day"], null),
    time: pick(e, ["time", "startTime", "start_time"], null),
    who: pick(e, ["who", "person", "people", "assignee", "kid"], null),
    type: pick(e, ["type", "event_type", "category"], null)
  };
}

function slimTask(t) {
  return {
    title: pick(t, ["title", "text", "name", "content"], "Untitled"),
    due: pick(t, ["due", "dueDate", "date", "day"], null),
    done: !!pick(t, ["done", "completed", "checked"], false),
    who: pick(t, ["who", "assignee", "person", "kid"], null)
  };
}

function slimMeal(m) {
  return {
    day: pick(m, ["day", "date", "weekday"], null),
    meal: pick(m, ["meal", "title", "name", "dinner", "text"], null),
    slot: pick(m, ["slot", "mealType", "type"], "dinner")
  };
}

function slimPerson(p) {
  return {
    name: pick(p, ["name", "displayName", "firstName"], "Someone"),
    role: pick(p, ["role", "relationship", "type"], null),
    birthday: pick(p, ["birthday", "birthdate", "dob"], null)
  };
}

function eventsInWindow(state, fromDays, toDays) {
  return asArray(state.calEvents).map(slimEvent).filter(function (e) {
    var d = daysFromNow(e.date);
    return d !== null && d >= fromDays && d <= toDays;
  }).slice(0, 30);
}

// ── context builder ───────────────────────────────────────────────────────────
// scope: "today" | "week" | "prep" | "ask"
export function buildCompassContext(state, scope, extra) {
  state = state || {};
  var ctx = {
    now: new Date().toString(),
    family: asArray(state.people).map(slimPerson).slice(0, 12),
    preferred_name: state.preferredName || null,
    ai_memory: state.aiMemory || null // answers from the onboarding questions
  };

  if (scope === "today") {
    ctx.flow_mode = state.flowMode || null;
    ctx.events_today_tomorrow = eventsInWindow(state, 0, 1);
    ctx.tasks_open = asArray(state.tasks).map(slimTask).filter(function (t) { return !t.done; }).slice(0, 25);
    ctx.meals_this_week = asArray(state.meals).map(slimMeal).slice(0, 14);
    ctx.shopping_open_count = asArray(state.shoppingItems).filter(function (i) { return !pick(i, ["checked", "done"], false); }).length;
    ctx.school = asArray(state.schoolData && state.schoolData.items || state.schoolData).slice(0, 10);
    ctx.recent_moments_count = asArray(state.moments).length;
  }

  if (scope === "week") {
    var tasks = asArray(state.tasks).map(slimTask);
    ctx.tasks_completed_count = tasks.filter(function (t) { return t.done; }).length;
    ctx.tasks_open = tasks.filter(function (t) { return !t.done; }).slice(0, 25);
    ctx.events_next_7_days = eventsInWindow(state, 0, 7);
    ctx.events_following_7_days = eventsInWindow(state, 8, 14);
    ctx.meals_this_week = asArray(state.meals).map(slimMeal).slice(0, 14);
    ctx.moments_logged = asArray(state.moments).slice(-8).map(function (m) {
      return { title: pick(m, ["title", "text", "note"], ""), date: pick(m, ["date", "createdAt"], null) };
    });
    ctx.ripples_count = asArray(state.ripples).length;
  }

  if (scope === "prep" && extra && extra.event) {
    ctx.PREP_EVENT = slimEvent(extra.event);
    ctx.PREP_EVENT.days_away = daysFromNow(ctx.PREP_EVENT.date);
    ctx.pets = asArray(state.pets).map(function (p) { return pick(p, ["name"], "pet") + " (" + pick(p, ["type", "species"], "pet") + ")"; });
    ctx.packing_templates = asArray(state.packing_templates).map(function (t) { return pick(t, ["name", "title"], "template"); });
    ctx.shopping_open = asArray(state.shoppingItems).filter(function (i) { return !pick(i, ["checked", "done"], false); })
      .map(function (i) { return pick(i, ["text", "name"], ""); }).slice(0, 20);
  }

  if (scope === "ask") {
    // The broadest slice — capped hard so chat stays cheap and fast.
    ctx.events_next_14_days = eventsInWindow(state, 0, 14);
    ctx.tasks_open = asArray(state.tasks).map(slimTask).filter(function (t) { return !t.done; }).slice(0, 30);
    ctx.meals_this_week = asArray(state.meals).map(slimMeal).slice(0, 14);
    ctx.shopping_open = asArray(state.shoppingItems).filter(function (i) { return !pick(i, ["checked", "done"], false); })
      .map(function (i) { return pick(i, ["text", "name"], ""); }).slice(0, 30);
    ctx.chores = asArray(state.choreData && state.choreData.chores || state.chores).slice(0, 20);
    ctx.school = asArray(state.schoolData && state.schoolData.items || state.schoolData).slice(0, 10);
  }

  // Hard cap: keep context under ~12k chars no matter what.
  var json = JSON.stringify(ctx);
  if (json.length > 12000) json = json.slice(0, 12000) + "…(truncated)";
  return json;
}

// ── engine ────────────────────────────────────────────────────────────────────

export async function runCompass(mode, state, opts) {
  opts = opts || {};
  var prompt = COMPASS_PROMPTS[mode];
  if (!prompt) throw new Error("Unknown Compass mode: " + mode);
  if (state && state.compassEnabled === false) throw new Error("Compass is turned off in Settings.");

  var scope = mode === "briefing" ? "today" : mode === "weeklyReview" ? "week" : mode === "prep" ? "prep" : mode === "nudge" ? "today" : "ask";
  var context = buildCompassContext(state, scope, opts);

  var userContent = "FAMILY CONTEXT:\n" + context;
  if (mode === "ask" && opts.question) userContent += "\n\nQUESTION: " + opts.question;

  var r = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: prompt.model,           // proxy maps "sonnet"/"haiku" to real models
      max_tokens: prompt.max_tokens,
      system: prompt.system,
      messages: [{ role: "user", content: userContent }]
    })
  });
  if (!r.ok) {
    var msg = r.status === 401 ? "Please sign in again to use Compass."
            : r.status === 429 ? "Compass needs a short breather — try again in a few minutes."
            : "Compass couldn't think just now.";
    throw new Error(msg);
  }
  var data = await r.json();
  var text = (data.content || []).map(function (b) { return b.text || ""; }).join("");
  var clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── cached features ───────────────────────────────────────────────────────────
// saveCache(newCache) should merge { compassCache: newCache } into household
// state through your normal save path so it syncs (see integration note #1).

export async function getDailyBriefing(state, saveCache, force) {
  var cache = (state && state.compassCache) || {};
  var today = dateKey();
  var mode = (state && state.flowMode) || "Smooth";
  var slot = "briefing_" + mode;
  if (!force && cache[slot] && cache[slot].date === today) return cache[slot].data;

  var data = await runCompass("briefing", state);
  var next = Object.assign({}, cache, (function(){ var o = {}; o[slot] = { date: today, data: data }; return o; })());
  if (saveCache) saveCache(next);
  return data;
}

export async function getWeeklyReview(state, saveCache, force) {
  var cache = (state && state.compassCache) || {};
  var wk = weekKey();
  if (!force && cache.weekly && cache.weekly.week === wk) return cache.weekly.data;

  var data = await runCompass("weeklyReview", state);
  var next = Object.assign({}, cache, { weekly: { week: wk, data: data } });
  if (saveCache) saveCache(next);
  return data;
}

export async function getPrepPlan(state, event) {
  return runCompass("prep", state, { event: event });
}

export async function askFamily(state, question) {
  return runCompass("ask", state, { question: question });
}

export async function getDailyNudge(state, saveCache, force) {
  var cache = (state && state.compassCache) || {};
  var today = dateKey();
  if (!force && cache.nudge && cache.nudge.date === today) return cache.nudge.data;
  var data = await runCompass("nudge", state);
  var next = Object.assign({}, cache, { nudge: { date: today, data: data } });
  if (saveCache) saveCache(next);
  return data;
}

export async function getPrepPlanCached(state, saveCache, event) {
  var cache = (state && state.compassCache) || {};
  var key = (event && (event.title || event.name || "") + "|" + (event.date || event.event_date || "")) || "";
  if (cache.prep && cache.prep.key === key) return cache.prep.data;
  var data = await runCompass("prep", state, { event: event });
  var next = Object.assign({}, cache, { prep: { key: key, data: data } });
  if (saveCache) saveCache(next);
  return data;
}
