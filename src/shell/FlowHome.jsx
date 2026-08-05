// src/shell/FlowHome.jsx — Flow pillar dashboard. Balanced two-column grid.
import { useState, useEffect } from "react";
import { isPersonMinor } from "../compass/compassEngine";

var SERIF = "'Cormorant Garamond', serif";
var SANS = "'DM Sans', sans-serif";
var DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

var C = {
  t1: "#1a2744", t2: "#3d4a5c", t3: "#8a96a3",
  sea: "#5E8FA0", seaL: "#7FB1B5", mist: "#DDEBEC",
  card: "#ffffff", cardBorder: "#e8edee", cream: "#f4f1ea",
  gold: "#C9A45B", green: "#7eb89a", blue: "#6A9BB5",
};

function rd(key, fb) {
  try { var v = JSON.parse(localStorage.getItem("af_" + key) || "null"); return v === null ? fb : v; }
  catch (e) { return fb; }
}
function go(tab) { window.dispatchEvent(new CustomEvent("af-set-tab", { detail: tab })); }
function goVault(section, tripId) { window.dispatchEvent(new CustomEvent("af-open-vault", { detail: { section: section, tripId: tripId || null } })); }
function uid() { return Math.random().toString(36).slice(2); }

// Write + dirty-mark + dispatch — same pattern as this file's own toggleTask,
// and as ExhaleSection.jsx/SunsetClose.jsx/MomentsSection.jsx's local lsSet
// helpers. FlowHome writes af_* keys directly (not via HomeFlow's setSaved),
// so without the dirty-mark the change would stay local and never sync.
function wr(key, val) {
  try { localStorage.setItem("af_" + key, JSON.stringify(val)); } catch (e) {}
  try {
    var dirty = rd("dirtyKeys", []);
    if (!Array.isArray(dirty)) dirty = [];
    if (dirty.indexOf(key) === -1) { dirty.push(key); localStorage.setItem("af_dirtyKeys", JSON.stringify(dirty)); }
  } catch (e2) {}
  try { window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: key } })); } catch (e3) {}
}

// Exhale bucket 0 is "Exhaled" (DEFAULT_BUCKET_NAMES in ExhaleSection.jsx).
// BUCKET_COLORS duplicated from there/sync-core.js — same small-constant
// duplication convention used throughout this codebase.
var BUCKET_COLORS = ["#4A9E8E", "#6ABAAA", "#7AB3D4", "#8BAF8B", "#A99AC4"];

// ── Reminders due-date math — duplicated from AnchorVault.jsx's
// RecurringRemindersSection (nextWeeklyDay/nextWeeklyDays/nextInterval/
// daysUntilReminder, ~AnchorVault.jsx:7844-7900), which are module-scope
// and not exported. Read-only here — Flow only surfaces upcoming
// reminders, editing still happens in Anchor → Reminders.
var REMINDER_FREQ_DAYS = { weekly:7, biweekly:14, every6wk:42, every2mo:61, every3mo:91, every6mo:182, yearly:365, monthly:30 };
function nextWeeklyDay(dayOfWeek, freq, lastDone) {
  if (dayOfWeek == null) return null;
  var now = new Date(); now.setHours(0,0,0,0);
  var diff = (dayOfWeek - now.getDay() + 7) % 7;
  var d = new Date(now); d.setDate(d.getDate() + diff);
  if (freq === "biweekly" && lastDone) {
    var lp = new Date(lastDone); lp.setHours(0,0,0,0);
    var weeksSince = Math.round((d - lp) / (7 * 86400000));
    if (weeksSince % 2 !== 0) d.setDate(d.getDate() + 7);
  }
  if (freq === "monthly") {
    var first = new Date(now.getFullYear(), now.getMonth(), 1);
    d = new Date(first); d.setDate(1 + (dayOfWeek - first.getDay() + 7) % 7);
    if (d < now) { d.setMonth(d.getMonth()+1); d.setDate(1); var b=new Date(d); d.setDate(1+(dayOfWeek-b.getDay()+7)%7); }
  }
  return d;
}
function nextWeeklyDays(days, freq, lastDone) {
  if (!days || !days.length) return null;
  var earliest = null;
  days.forEach(function(d) {
    var candidate = nextWeeklyDay(d, freq, lastDone);
    if (!earliest || candidate < earliest) earliest = candidate;
  });
  return earliest;
}
function nextInterval(freq, lastDone) {
  var days = REMINDER_FREQ_DAYS[freq] || 90;
  var now = new Date(); now.setHours(0,0,0,0);
  if (lastDone) {
    var last = new Date(lastDone); last.setHours(0,0,0,0);
    var next = new Date(last); next.setDate(next.getDate() + days);
    return next;
  }
  return now;
}
function daysUntilReminder(r) {
  var now = new Date(); now.setHours(0,0,0,0);
  var next;
  if (r.type === "weekly_days") next = nextWeeklyDays(r.days, r.freq, r.lastDone);
  else if (r.type === "weekly_day") next = nextWeeklyDay(r.day, r.freq, r.lastDone);
  else next = nextInterval(r.freq, r.lastDone);
  if (!next) return null;
  return Math.round((next - now) / 86400000);
}
function reminderDueLabel(days) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return "in " + days + " days";
}

// Same manual YYYY-MM-DD part parsing as AnchorVault's daysUntil/TripCountdownBadge
// (~AnchorVault.jsx:3606) — avoids the timezone ambiguity of new Date(dateStr).
function daysUntilDate(dateStr) {
  if (!dateStr) return null;
  var now = new Date(); now.setHours(0, 0, 0, 0);
  var parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return Math.round((new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])) - now) / 86400000);
  }
  return null;
}
function tripCountdown(trip) {
  var start = daysUntilDate(trip.startDate);
  var end = daysUntilDate(trip.endDate);
  if (start === null) return null;
  var effectiveEnd = end !== null ? end : start;
  if (start <= 0 && effectiveEnd >= 0) return "in progress";
  if (start === 0) return "today";
  if (start === 1) return "in 1 day";
  return "in " + start + " days";
}

function NextTripCard() {
  var s_trips = useState(function () { return rd("trips", []); });
  var trips = s_trips[0]; var setTrips = s_trips[1];

  useEffect(function () {
    function refresh(e) {
      if (!e || !e.detail || !e.detail.key || e.detail.key === "trips") setTrips(rd("trips", []));
    }
    window.addEventListener("af-data-changed", refresh);
    return function () { window.removeEventListener("af-data-changed", refresh); };
  }, []);

  if (!Array.isArray(trips)) trips = [];
  var todayISO = new Date().toISOString().slice(0, 10);
  var upcoming = trips.filter(function (t) { return t && t.status !== "Completed" && (!t.endDate || t.endDate >= todayISO); })
    .sort(function (a, b) { return (a.startDate || "") < (b.startDate || "") ? -1 : 1; });
  var next = upcoming[0] || null;
  var countdown = next ? tripCountdown(next) : null;

  return (
    <Card eyebrow="Anchor" title="Next Trip" open={false} link={{ label: "Open →", onClick: function () { goVault("trips"); } }}>
      {next ? (
        <div onClick={function () { goVault("trips", next.id); }} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{next.icon || "✈️"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: ".84rem", color: C.t1, fontWeight: 500 }}>{next.name}</div>
            <div style={{ fontSize: ".7rem", color: C.t3 }}>{next.destination}</div>
          </div>
          {countdown && <div style={{ fontSize: ".7rem", color: C.sea, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>{countdown}</div>}
        </div>
      ) : (
        <div style={{ fontSize: ".8rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF }}>No upcoming trips — <span onClick={function () { goVault("trips"); }} style={{ color: C.sea, cursor: "pointer" }}>plan one →</span></div>
      )}
    </Card>
  );
}

function Card(props) {
  var [open, setOpen] = useState(props.open !== false);
  return (
    <div style={{ background: C.card, border: "1px solid " + C.cardBorder, borderRadius: 16, padding: "16px 18px", boxShadow: "0 1px 3px rgba(26,39,68,0.04)" }}>
      <div onClick={function () { setOpen(!open); }} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", cursor: "pointer", gap: 10 }}>
        <div>
          <div style={{ fontSize: ".54rem", letterSpacing: ".18em", textTransform: "uppercase", color: C.sea, fontWeight: 600, marginBottom: 2 }}>{props.eyebrow}</div>
          <div style={{ fontFamily: SERIF, fontSize: "1.15rem", color: C.t1, fontWeight: 600, lineHeight: 1.2 }}>{props.title}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, paddingTop: 3 }}>
          {props.link && <span onClick={function (e) { e.stopPropagation(); props.link.onClick(); }} style={{ fontSize: ".7rem", color: C.sea, cursor: "pointer", whiteSpace: "nowrap" }}>{props.link.label}</span>}
          <span style={{ color: C.t3, fontSize: ".62rem", display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
        </div>
      </div>
      {open && <div style={{ marginTop: 13 }}>{props.children}</div>}
    </div>
  );
}

export default function FlowHome(props) {
  var [tasks, setTasks] = useState(function () { return rd("tasks", []); });
  var [exhaleBuckets, setExhaleBuckets] = useState(function () { return rd("exhale_buckets", { bucketNames: ["Exhaled","Today","Tomorrow","This Weekend","Someday"], items: [] }); });
  var [recurring, setRecurring] = useState(function () { return rd("recurring", []); });
  var [coveData, setCoveData] = useState(function () { return rd("coveData", []); });
  var [exhaleQuickText, setExhaleQuickText] = useState("");
  var [upNextOpen, setUpNextOpen] = useState(true);
  var [alsoTodayOpen, setAlsoTodayOpen] = useState(true);
  // Mode-impact: now live-reactive via the same af-flowmode-changed bridge
  // FlowWrapper's sidebar already uses (dispatched from HomeFlow's flowMode
  // effect), instead of the earlier one-time mount read — so switching modes
  // while already parked on this page updates it immediately too.
  var [flowMode, setFlowMode] = useState(function () { return rd("flowMode", "Smooth"); });

  useEffect(function () {
    function refresh(e) {
      if (!e || !e.detail || !e.detail.key || e.detail.key === "tasks") setTasks(rd("tasks", []));
      if (!e || !e.detail || !e.detail.key || e.detail.key === "exhale_buckets") setExhaleBuckets(rd("exhale_buckets", { bucketNames: ["Exhaled","Today","Tomorrow","This Weekend","Someday"], items: [] }));
      if (!e || !e.detail || !e.detail.key || e.detail.key === "recurring") setRecurring(rd("recurring", []));
      if (!e || !e.detail || !e.detail.key || e.detail.key === "coveData") setCoveData(rd("coveData", []));
    }
    window.addEventListener("af-data-changed", refresh);
    return function () { window.removeEventListener("af-data-changed", refresh); };
  }, []);

  useEffect(function () {
    function onFlowModeChanged(e) {
      if (e && e.type === "storage" && e.key !== "af_flowMode") return;
      setFlowMode(rd("flowMode", "Smooth"));
    }
    window.addEventListener("storage", onFlowModeChanged);
    window.addEventListener("af-flowmode-changed", onFlowModeChanged);
    return function () { window.removeEventListener("storage", onFlowModeChanged); window.removeEventListener("af-flowmode-changed", onFlowModeChanged); };
  }, []);

  // Survival auto-collapses "Also today" (the secondary zone) on arrival —
  // matches the same "collapse once on mode entry, don't fight a manual
  // reopen" behavior as the Today tab's Compass sections.
  useEffect(function () {
    if (flowMode === "Survival") setAlsoTodayOpen(false);
  }, [flowMode]);

  var now = new Date();
  var todayName = DAYS[now.getDay()];
  var tomorrowName = DAYS[(now.getDay() + 1) % 7];
  var rhythm = rd("rhythm", {});
  var todayRhythm = rhythm[todayName] || null;

  if (!Array.isArray(tasks)) tasks = [];
  var todayTasks = tasks.filter(function (t) { return t && (t.day === todayName || t.day === "Daily" || !t.day); });
  var doneCount = todayTasks.filter(function (t) { return t.done; }).length;
  var pct = todayTasks.length ? Math.round((doneCount / todayTasks.length) * 100) : 0;

  var meals = rd("meals", {});
  var tMeal = meals[todayName] || {};
  var dinner = tMeal.name || tMeal.dinner || tMeal.meal || null;
  var tmwMeal = meals[tomorrowName] || {};
  var tmwDinner = tmwMeal.name || tmwMeal.dinner || tmwMeal.meal || null;

  // WORK-1: per-person recurring work schedule (af_work_schedules), distinct
  // from the older af_workDays ad-hoc per-date marker used elsewhere.
  var flowPeople = rd("people", []);
  if (!Array.isArray(flowPeople)) flowPeople = [];
  var workSchedules = rd("work_schedules", {});
  if (!workSchedules || typeof workSchedules !== "object") workSchedules = {};
  var workTodayISO = now.toISOString().slice(0, 10);
  var workingToday = flowPeople.filter(function (p) {
    var s = workSchedules[p.id];
    if (!s) return false;
    // WORK-1: irregular schedules have no fixed weekday pattern — matched by
    // individual date instead of s.days.
    if (s.type === "irregular") return Array.isArray(s.dates) && s.dates.includes(workTodayISO);
    return Array.isArray(s.days) && s.days.includes(todayName);
  }).map(function (p) {
    var s = workSchedules[p.id];
    return { name: p.name, type: s.type, color: s.color || p.color, startTime: s.startTime, endTime: s.endTime };
  });

  var calEvents = rd("calEvents", []);
  if (!Array.isArray(calEvents)) calEvents = [];
  var todayISO = now.toISOString().slice(0, 10);
  var upcoming = calEvents.filter(function (e) { return e && e.date && e.date >= todayISO; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 5);

  // Fix 1 — Unload It: items from Exhale bucket 0 ("Exhaled"). Items array
  // is already newest-first (addBucketItem in ExhaleSection.jsx prepends),
  // so no re-sort needed here.
  var exhaleItemsAll = (exhaleBuckets && Array.isArray(exhaleBuckets.items)) ? exhaleBuckets.items : [];
  var exhaledItems = exhaleItemsAll.filter(function (it) { return it && !it.archived && it.bucketIndex === 0; });

  // Fix 2 — Household Alerts: reminders due today or within 3 days.
  var dueReminders = (Array.isArray(recurring) ? recurring : [])
    .filter(function (r) { return r && r.active !== false; })
    .map(function (r) { return Object.assign({}, r, { _days: daysUntilReminder(r) }); })
    .filter(function (r) { return r._days != null && r._days >= 0 && r._days <= 3; })
    .sort(function (a, b) { return a._days - b._days; });

  // Fix 3 — Tide Pool: one row per kid in the household, shells pulled from
  // af_coveData (0 if that kid has no record yet).
  var tidePoolKids = flowPeople.filter(function (p) { return isPersonMinor(p); }).map(function (p) {
    var rec = (Array.isArray(coveData) ? coveData : []).find(function (k) { return k.kidId === p.id; });
    return { id: p.id, name: p.name, shells: rec ? (rec.shells || 0) : 0 };
  });

  var upNext = todayTasks.filter(function (t) { return !t.done; })[0];
  var thenTask = todayTasks.filter(function (t) { return !t.done; })[1];

  function fmtEvDate(d) {
    var x = new Date(d + "T00:00:00");
    if (isNaN(x)) return "";
    return x.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  function toggleTask(id) {
    var next = tasks.map(function (t) { return t.id === id ? Object.assign({}, t, { done: !t.done }) : t; });
    localStorage.setItem("af_tasks", JSON.stringify(next));
    var dirty = rd("dirtyKeys", []); if (!dirty.includes("tasks")) { dirty.push("tasks"); localStorage.setItem("af_dirtyKeys", JSON.stringify(dirty)); }
    window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: "tasks" } }));
    setTasks(next);
  }

  function addExhaleItem() {
    var txt = (exhaleQuickText || "").trim();
    if (!txt) return;
    var item = { id: uid(), text: txt, notes: "", bucketIndex: 0, createdAt: Date.now(), color: BUCKET_COLORS[0] };
    var nb = Object.assign({}, exhaleBuckets, { items: [item].concat(exhaleItemsAll) });
    wr("exhale_buckets", nb);
    setExhaleBuckets(nb);
    setExhaleQuickText("");
  }

  // New-kid record (no existing af_coveData entry) matches TidePoolTab's own
  // new-kid merge defaults (~App.jsx:10573-10582) so a kid's first shell
  // gives the same starter chores/treasures whether it's tapped here or
  // seeded by opening the real Tide Pool tab first.
  function addShell(kidId, kidName) {
    var list = Array.isArray(coveData) ? coveData : [];
    var existing = list.find(function (k) { return k.kidId === kidId; });
    var next;
    if (existing) {
      next = list.map(function (k) { return k.kidId === kidId ? Object.assign({}, k, { shells: (k.shells || 0) + 1 }) : k; });
    } else {
      next = list.concat([{
        kidId: kidId, kidName: kidName, shells: 1,
        chores: [
          { id: uid(), name: "Make bed", pts: 1, done: false },
          { id: uid(), name: "Clear dishes", pts: 1, done: false },
        ],
        treasures: [
          { id: uid(), name: "Extra screen time", icon: "📱", cost: 10 },
          { id: uid(), name: "Pick dinner", icon: "🍕", cost: 15 },
          { id: uid(), name: "Movie night pick", icon: "🎬", cost: 20 },
          { id: uid(), name: "Stay up late", icon: "🌙", cost: 25 },
          { id: uid(), name: "Special outing", icon: "🎡", cost: 35 },
        ],
      }]);
    }
    wr("coveData", next);
    setCoveData(next);
  }

  return (
    <div style={{ paddingBottom: "3rem", fontFamily: SANS }}>
      <style>{`
        @media (max-width: 640px) {
          .af-flow-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {/* Header — Busy gets a subtle amber tint, matching the Today tab's
          own "Today at a Glance" card treatment for the same mode. */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid " + (flowMode === "Busy" ? "rgba(228,181,89,0.4)" : C.cardBorder), background: flowMode === "Busy" ? "rgba(228,181,89,0.06)" : "transparent" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <button onClick={function() { go("anchor"); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 4px 0 0", display: "flex", alignItems: "center", opacity: 0.5, flexShrink: 0, marginTop: 8 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: "1.9rem", fontWeight: 600, color: C.t1, lineHeight: 1 }}>Flow</div>
          <div style={{ fontSize: ".82rem", color: C.t3, marginTop: 4 }}>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {todayTasks.length - doneCount} things left</div>
          </div>
        </div>
        {todayRhythm && <div style={{ padding: "7px 16px", background: C.mist, borderRadius: 20, fontSize: ".76rem", color: C.sea, fontWeight: 600 }}>{todayRhythm.emoji} {todayRhythm.theme}</div>}
      </div>

      {/* Mode banners — same messages as the Today tab's, for a consistent
          signal across both surfaces. */}
      {flowMode === "Busy" && (
        <div style={{ background: "linear-gradient(135deg,rgba(228,181,89,0.22),rgba(228,181,89,0.1))", border: "2px solid rgba(228,181,89,0.5)", borderRadius: 14, padding: "14px 16px", marginBottom: 18, textAlign: "center", fontSize: ".98rem", fontWeight: 700, color: C.t1, boxShadow: "0 3px 16px rgba(228,181,89,0.25)" }}>
          Busy day — here's what matters most 🌊
        </div>
      )}
      {flowMode === "Survival" && (
        <div style={{ background: "linear-gradient(135deg,#EAF5F0,#DDEBEC)", border: "2px solid rgba(94,143,160,.4)", borderRadius: 14, padding: "16px 18px", marginBottom: 18, textAlign: "center", fontSize: "1.02rem", fontWeight: 700, color: C.t1, boxShadow: "0 3px 16px rgba(94,143,160,0.2)" }}>
          One step at a time. You've got this. 🌊
        </div>
      )}

      {/* Up Next focus — full width */}
      {upNext && (
        <div style={{ background: "linear-gradient(135deg,#F8FCFC,#DDEBEC)", border: "1px solid " + C.seaL, borderRadius: 16, padding: "16px 20px", marginBottom: 18 }}>
          <div onClick={function () { setUpNextOpen(!upNextOpen); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: 10 }}>
            <div style={{ fontSize: ".54rem", letterSpacing: ".18em", textTransform: "uppercase", color: C.sea, fontWeight: 600 }}>Up next</div>
            <span style={{ color: C.sea, fontSize: ".62rem", display: "inline-block", transform: upNextOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
          </div>
          {upNextOpen && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
              <div onClick={function () { toggleTask(upNext.id); }} style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid " + C.sea, color: C.sea, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: ".85rem" }}>○</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "1rem", color: C.t1, fontWeight: 500 }}>{upNext.text || upNext.title}</div>
              </div>
              {thenTask && (
                <div style={{ textAlign: "right", paddingLeft: 16, borderLeft: "1px solid rgba(94,143,160,0.2)" }}>
                  <div style={{ fontSize: ".54rem", letterSpacing: ".14em", textTransform: "uppercase", color: C.t3 }}>Then</div>
                  <div style={{ fontSize: ".82rem", color: C.t2 }}>{thenTask.text || thenTask.title}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mode-impact: Survival shows ONLY Up Next (above) + Today's Tasks —
          Calendar/Dinner/Work and the 2-col grid itself don't render at all.
          Smooth/Busy keep the full grid; Busy just tightens spacing. */}
      {flowMode === "Survival" ? (
        <Card eyebrow="Flow" title="Today's Tasks" link={{ label: "Open →", onClick: function () { go("anchor"); } }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 8, background: C.mist, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: pct + "%", height: "100%", background: C.sea, transition: "width .3s" }} />
            </div>
            <div style={{ fontSize: ".68rem", color: C.t3, whiteSpace: "nowrap" }}>{doneCount} of {todayTasks.length}</div>
          </div>
          {todayTasks.length === 0 ? (
            <div style={{ fontSize: ".82rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF, padding: "10px 0" }}>No tasks today — enjoy the open water.</div>
          ) : todayTasks.slice(0, 10).map(function (t) {
            return (
              <div key={t.id} onClick={function () { toggleTask(t.id); }} style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 0", borderBottom: "1px solid " + C.cream, cursor: "pointer" }}>
                <div style={{ width: 19, height: 19, borderRadius: "50%", border: "1.5px solid " + (t.done ? C.green : "#c4ccd4"), background: t.done ? C.green : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".6rem", flexShrink: 0 }}>{t.done ? "✓" : ""}</div>
                <div style={{ flex: 1, fontSize: ".84rem", color: t.done ? C.t3 : C.t1, textDecoration: t.done ? "line-through" : "none" }}>{t.text || t.title}</div>
              </div>
            );
          })}
        </Card>
      ) : (
      <div className="af-flow-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: flowMode === "Busy" ? 10 : 16, alignItems: "start", marginBottom: flowMode === "Busy" ? 14 : 20 }}>
        {/* LEFT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: flowMode === "Busy" ? 10 : 16 }}>
          <Card eyebrow="Flow" title="Today's Tasks" link={{ label: "Open →", onClick: function () { go("anchor"); } }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 8, background: C.mist, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: pct + "%", height: "100%", background: C.sea, transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: ".68rem", color: C.t3, whiteSpace: "nowrap" }}>{doneCount} of {todayTasks.length}</div>
            </div>
            {todayTasks.length === 0 ? (
              <div style={{ fontSize: ".82rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF, padding: "10px 0" }}>No tasks today — enjoy the open water.</div>
            ) : todayTasks.slice(0, 10).map(function (t) {
              return (
                <div key={t.id} onClick={function () { toggleTask(t.id); }} style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 0", borderBottom: "1px solid " + C.cream, cursor: "pointer" }}>
                  <div style={{ width: 19, height: 19, borderRadius: "50%", border: "1.5px solid " + (t.done ? C.green : "#c4ccd4"), background: t.done ? C.green : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".6rem", flexShrink: 0 }}>{t.done ? "✓" : ""}</div>
                  <div style={{ flex: 1, fontSize: ".84rem", color: t.done ? C.t3 : C.t1, textDecoration: t.done ? "line-through" : "none" }}>{t.text || t.title}</div>
                </div>
              );
            })}
          </Card>

          <Card eyebrow="Calendar" title="This Week" link={{ label: "Full →", onClick: function () { go("calendar"); } }}>
            {upcoming.length === 0 ? (
              <div style={{ fontSize: ".8rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF }}>Nothing scheduled — an open week.</div>
            ) : upcoming.map(function (e, i) {
              return (
                <div key={i} onClick={function () { go("calendar"); }} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0", borderBottom: i < upcoming.length - 1 ? "1px solid " + C.cream : "none", cursor: "pointer" }}>
                  <div style={{ width: 3, height: 34, borderRadius: 2, background: e.color || C.blue, flexShrink: 0 }} />
                  <div style={{ fontSize: ".66rem", color: C.t3, width: 64, flexShrink: 0, lineHeight: 1.3 }}>{fmtEvDate(e.date)}{e.time ? " · " + e.time : ""}</div>
                  <div style={{ fontSize: ".82rem", color: C.t1, flex: 1 }}>{e.title}</div>
                </div>
              );
            })}
          </Card>
        </div>

        {/* RIGHT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: flowMode === "Busy" ? 10 : 16 }}>
          <Card eyebrow="Tonight's Dinner · from Anchor" title={dinner || "Not planned yet"} link={{ label: "Edit →", onClick: function () { go("meals"); } }}>
            {dinner ? (
              <div style={{ fontSize: ".8rem", color: C.t2, lineHeight: 1.5 }}>
                {tMeal.time ? "~" + tMeal.time + " min · " : ""}tonight's plan.
                {tmwDinner && <div style={{ marginTop: 9, padding: "9px 12px", background: C.cream, borderRadius: 9, fontSize: ".76rem" }}>🌙 Tomorrow: <strong>{tmwDinner}</strong></div>}
              </div>
            ) : (
              <div style={{ fontSize: ".8rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF }}>No dinner planned. <span onClick={function () { go("meals"); }} style={{ color: C.sea, cursor: "pointer" }}>Plan one →</span></div>
            )}
          </Card>

          {/* WORK-1: who's working today, at a glance */}
          <Card eyebrow="Work" title="Working Today" link={{ label: "Edit →", onClick: function () { go("settings"); } }}>
            {workingToday.length === 0 ? (
              <div style={{ fontSize: ".8rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF }}>No one's scheduled to work today.</div>
            ) : workingToday.map(function (w, i) {
              var isOnCall = w.type === "on-call";
              var isOvernight = w.type === "overnight";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0", borderBottom: i < workingToday.length - 1 ? "1px solid " + C.cream : "none" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: isOnCall ? "transparent" : (w.color || C.sea), border: isOnCall ? "2px dashed " + (w.color || C.sea) : "none", flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: ".84rem", color: C.t1 }}>{w.name}</div>
                  {isOvernight ? (
                    <div style={{ fontSize: ".68rem", color: C.t3 }}>Overnight{w.startTime && w.endTime ? " · " + w.startTime + "→" + w.endTime + " next morning" : ""}</div>
                  ) : (
                    w.type && w.type !== "regular" && <div style={{ fontSize: ".68rem", color: C.t3, textTransform: "capitalize" }}>{w.type.replace("-", " ")}</div>
                  )}
                </div>
              );
            })}
          </Card>
        </div>
      </div>
      )}

      {/* Also today — lighter secondary zone: reflective/low-urgency content
          demoted below the anchors, set off by a thin label instead of a
          full Card header so it visually reads as "less than" the row above.
          Mode-impact: hidden entirely (header row included, not just its
          content) in both Busy and Survival — Smooth only. */}
      {flowMode === "Smooth" && (<>
      <div onClick={function () { setAlsoTodayOpen(!alsoTodayOpen); }} style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 16px", cursor: "pointer" }}>
        <span style={{ fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: C.t3, fontWeight: 600, whiteSpace: "nowrap" }}>Also today</span>
        <div style={{ flex: 1, height: 1, background: C.cardBorder }} />
        <span style={{ color: C.t3, fontSize: ".62rem", display: "inline-block", transform: alsoTodayOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
      </div>
      {alsoTodayOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card eyebrow="Exhale" title="Unload It" open={false} link={{ label: "All →", onClick: function () { go("brain"); } }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={exhaleQuickText}
                onChange={function (e) { setExhaleQuickText(e.target.value); }}
                onKeyDown={function (e) { if (e.key === "Enter") addExhaleItem(); }}
                placeholder="What's on your mind?"
                style={{ flex: 1, padding: "8px 11px", fontSize: ".78rem", border: "1px solid " + C.cardBorder, borderRadius: 8, background: "#fff", color: C.t1, fontFamily: SANS, outline: "none" }}
              />
              <button onClick={addExhaleItem} style={{ background: C.t1, color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", fontSize: ".74rem", fontWeight: 600, cursor: "pointer", fontFamily: SANS }}>+ Add</button>
            </div>
            {exhaledItems.length === 0 ? (
              <div style={{ fontSize: ".78rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF }}>Nothing waiting. Clear head.</div>
            ) : exhaledItems.slice(0, 4).map(function (it) {
              return <div key={it.id} onClick={function () { go("brain"); }} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", fontSize: ".8rem", color: C.t2, cursor: "pointer" }}>•&nbsp;{it.text}</div>;
            })}
          </Card>

          <Card eyebrow="From Anchor" title="Household Alerts" open={false}>
            {dueReminders.length === 0 ? (
              <div style={{ fontSize: ".78rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF }}>All clear for now.</div>
            ) : dueReminders.map(function (r) {
              return (
                <div key={r.id} onClick={function () { goVault("recurring"); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid " + C.cream, cursor: "pointer" }}>
                  <span style={{ fontSize: "1rem", flexShrink: 0 }}>{r.emoji || "⏰"}</span>
                  <div style={{ flex: 1, fontSize: ".82rem", color: C.t1 }}>{r.label}</div>
                  <div style={{ fontSize: ".68rem", color: C.sea, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>{reminderDueLabel(r._days)}</div>
                </div>
              );
            })}
          </Card>

          <Card eyebrow="Tide Pool" title="Today's Tide Pool" open={false} link={{ label: "View →", onClick: function () { go("tidepool"); } }}>
            {tidePoolKids.length === 0 ? (
              <div style={{ fontSize: ".78rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF }}>No kids added yet.</div>
            ) : tidePoolKids.map(function (k) {
              return (
                <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid " + C.cream }}>
                  <div style={{ flex: 1, fontSize: ".84rem", color: C.t1 }}>{k.name}</div>
                  <div style={{ fontSize: ".74rem", color: C.t3 }}>🐚 {k.shells}</div>
                  <button onClick={function () { addShell(k.id, k.name); }} style={{ background: C.sea, color: "#fff", border: "none", borderRadius: 20, width: 30, height: 30, fontSize: ".8rem", fontWeight: 700, cursor: "pointer", flexShrink: 0, fontFamily: SANS }}>+1</button>
                </div>
              );
            })}
          </Card>

          <NextTripCard />
        </div>
      )}
      </>)}
    </div>
  );
}
