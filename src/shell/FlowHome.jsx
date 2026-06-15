// src/shell/FlowHome.jsx — Flow pillar dashboard. Balanced two-column grid.
import { useState, useEffect } from "react";

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
function goVault(section) { window.dispatchEvent(new CustomEvent("af-open-vault", { detail: { section: section } })); }

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
          <span style={{ color: C.t3, fontSize: ".62rem", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
        </div>
      </div>
      {open && <div style={{ marginTop: 13 }}>{props.children}</div>}
    </div>
  );
}

export default function FlowHome(props) {
  var [tasks, setTasks] = useState(function () { return rd("tasks", []); });
  var [brain, setBrain] = useState(function () { return rd("brainItems", []); });

  useEffect(function () {
    function refresh(e) {
      if (!e || !e.detail || !e.detail.key || e.detail.key === "tasks") setTasks(rd("tasks", []));
      if (!e || !e.detail || !e.detail.key || e.detail.key === "brainItems") setBrain(rd("brainItems", []));
    }
    window.addEventListener("af-data-changed", refresh);
    return function () { window.removeEventListener("af-data-changed", refresh); };
  }, []);

  var now = new Date();
  var todayName = DAYS[now.getDay()];
  var tomorrowName = DAYS[(now.getDay() + 1) % 7];
  var rhythm = rd("rhythm", {});
  var todayRhythm = rhythm[todayName] || null;

  if (!Array.isArray(tasks)) tasks = [];
  var todayTasks = tasks.filter(function (t) { return t && (t.day === todayName || t.day === "Daily" || !t.day); });
  var doneCount = todayTasks.filter(function (t) { return t.done; }).length;
  var pct = todayTasks.length ? Math.round((doneCount / todayTasks.length) * 100) : 0;

  var meals = rd("nextWeekMeals", {});
  var tMeal = meals[todayName] || {};
  var dinner = tMeal.name || tMeal.dinner || tMeal.meal || null;
  var tmwMeal = meals[tomorrowName] || {};
  var tmwDinner = tmwMeal.name || tmwMeal.dinner || tmwMeal.meal || null;

  var calEvents = rd("calEvents", []);
  if (!Array.isArray(calEvents)) calEvents = [];
  var todayISO = now.toISOString().slice(0, 10);
  var upcoming = calEvents.filter(function (e) { return e && e.date && e.date >= todayISO; })
    .sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 5);

  if (!Array.isArray(brain)) brain = [];
  var recentBrain = brain.slice(0, 4);

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

  return (
    <div style={{ paddingBottom: "3rem", fontFamily: SANS }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid " + C.cardBorder }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: "1.9rem", fontWeight: 600, color: C.t1, lineHeight: 1 }}>Flow</div>
          <div style={{ fontSize: ".82rem", color: C.t3, marginTop: 4 }}>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {todayTasks.length - doneCount} things left</div>
        </div>
        {todayRhythm && <div style={{ padding: "7px 16px", background: C.mist, borderRadius: 20, fontSize: ".76rem", color: C.sea, fontWeight: 600 }}>{todayRhythm.emoji} {todayRhythm.theme}</div>}
      </div>

      {/* Up Next focus — full width */}
      {upNext && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, background: "linear-gradient(135deg,#F8FCFC,#DDEBEC)", border: "1px solid " + C.seaL, borderRadius: 16, padding: "16px 20px", marginBottom: 18 }}>
          <div onClick={function () { toggleTask(upNext.id); }} style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid " + C.sea, color: C.sea, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: ".85rem" }}>○</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: ".54rem", letterSpacing: ".18em", textTransform: "uppercase", color: C.sea, fontWeight: 600 }}>Up next</div>
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

      {/* Balanced two-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* LEFT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

          <Card eyebrow="Exhale" title="Unload It" link={{ label: "All →", onClick: function () { go("brain"); } }}>
            <div onClick={function () { go("brain"); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderBottom: "1px solid " + C.cream, marginBottom: 8, cursor: "text" }}>
              <span style={{ opacity: .3, fontSize: ".82rem" }}>✎</span>
              <span style={{ fontSize: ".78rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF }}>What's on your mind?</span>
            </div>
            {recentBrain.length === 0 ? (
              <div style={{ fontSize: ".78rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF }}>Nothing waiting. Clear head.</div>
            ) : recentBrain.map(function (b) {
              return <div key={b.id} onClick={function () { go("brain"); }} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", fontSize: ".8rem", color: C.t2, cursor: "pointer" }}>•&nbsp;{b.text}</div>;
            })}
          </Card>
        </div>

        {/* RIGHT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

          <Card eyebrow="From Anchor" title="Household Alerts" open={false}>
            <div style={{ fontSize: ".78rem", color: C.t3, lineHeight: 1.6 }}>
              Expiring documents, low inventory, and packing reminders surface here from your Anchor vault.
              <div onClick={function () { goVault("household"); }} style={{ color: C.sea, cursor: "pointer", marginTop: 7 }}>Open Anchor →</div>
            </div>
          </Card>

          <Card eyebrow="Tide Pool" title="Today's Chores" open={false} link={{ label: "View →", onClick: function () { go("tidepool"); } }}>
            <div style={{ fontSize: ".78rem", color: C.t3, lineHeight: 1.6 }}>
              Kids' chore progress and shell goals live here.
              <div onClick={function () { go("tidepool"); }} style={{ color: C.sea, cursor: "pointer", marginTop: 7 }}>Open Tide Pool →</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
