// src/shell/SunsetClose.jsx — Sunset: a 6-step guided end-of-day close.
// Reflection (mood) → Today's wins → Carry forward → Tomorrow →
// Before you go (clear your mind / kid quote) → Good night.
// Session-only: step/mood/decisions live in component state, never synced —
// only the writes each step makes (tasks, exhale_buckets, ripples) persist.
import { useState, useEffect, useRef } from "react";
import { isPersonMinor, getDailyBriefing } from "../compass/compassEngine";
import { SYNC_KEYS } from "../sync-core";

var SERIF = "'Cormorant Garamond', serif";
var SANS = "'DM Sans', sans-serif";
var DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
var GOLD = "#DAA520";
var NAVY = "#1a2d4a";
// Persistent step-header gradient, per spec.
var GRADIENT = "linear-gradient(180deg, #1a2d4a 0%, #2d4a6e 25%, #8B4513 55%, #CD853F 75%, #DAA520 100%)";
// tokens.css has no --surface-1/--border-strong; these are the closest
// existing dark-theme tokens (a-surface2/a-border2) standing in for them.
var SURFACE = "var(--a-surface2)";
var BORDER_STRONG = "var(--a-border2)";

function read(key, fallback) {
  try { var v = JSON.parse(localStorage.getItem("af_" + key) || "null"); return v === null ? fallback : v; } catch (e) { return fallback; }
}
function writeKey(key, val) {
  try {
    localStorage.setItem("af_" + key, JSON.stringify(val));
    var dirty = JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]");
    if (dirty.indexOf(key) === -1) { dirty.push(key); localStorage.setItem("af_dirtyKeys", JSON.stringify(dirty)); }
    window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: key } }));
  } catch (e) {}
}
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function personName(p) { return (p && (p.name || p.displayName || p.firstName)) || "Someone"; }

function sectionLabel(text, color) {
  return <div style={{ fontSize: ".55rem", letterSpacing: ".18em", textTransform: "uppercase", color: color, marginBottom: 5, fontFamily: SANS }}>{text}</div>;
}
function cardStyle(extra) {
  return Object.assign({ background: SURFACE, border: "0.5px solid rgba(218,165,32,0.3)", borderRadius: 11, padding: "13px 15px" }, extra || {});
}

// Exhale bucket layout is fixed 5-slot (DEFAULT_BUCKET_NAMES in
// ExhaleSection.jsx): 0 Exhaled, 1 Today, 2 Tomorrow, 3 This Weekend, 4
// Someday. A "Tomorrow" decision here goes into the Exhale "Today" bucket
// (not "Tomorrow") deliberately — by the time the user opens Exhale in the
// morning, "Today" is what's actionable; nothing auto-advances buckets by
// date, so landing it straight in "Today" means it's already where they'll
// look, matching the spec's explicit bucket choice.
var BUCKET_COLORS = ["#4A9E8E", "#6ABAAA", "#7AB3D4", "#8BAF8B", "#A99AC4"];
var DECISION_BUCKET = { tomorrow: 1, thisweek: 3, someday: 4 };

var MOODS = [
  { id: "great", emoji: "😊", label: "Great" },
  { id: "good", emoji: "🙂", label: "Good" },
  { id: "busy", emoji: "😐", label: "Busy" },
  { id: "survival", emoji: "😮‍💨", label: "Survival" },
];
var MOOD_CLOSING = {
  great: "Today truly was great — carry that lightness into tomorrow.",
  good: "A good day, gently closed.",
  busy: "A full day, well handled. Rest now.",
  survival: "You made it through — that's enough tonight.",
};
var DECISIONS = [
  { id: "tomorrow", label: "Tomorrow" },
  { id: "thisweek", label: "This week" },
  { id: "someday", label: "Someday" },
  { id: "letgo", label: "Let it go" },
];

function StepHeader(props) {
  if (props.big) {
    return (
      <div style={{ background: GRADIENT, borderRadius: 16, padding: 24, marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: 8 }}>🌅</div>
        <div style={{ fontFamily: SERIF, fontSize: "1.4rem", fontWeight: 600, color: "#fff" }}>{props.title}</div>
        <div style={{ fontSize: ".78rem", color: "rgba(255,255,255,.78)", marginTop: 4, fontFamily: SANS }}>{props.subtitle}</div>
      </div>
    );
  }
  return (
    <div style={{ background: GRADIENT, borderRadius: 16, padding: 24, marginBottom: 16 }}>
      <div style={{ fontFamily: SERIF, fontSize: "1.3rem", fontWeight: 600, color: "#fff" }}>{props.title}</div>
      {props.subtitle && <div style={{ fontSize: ".78rem", color: "rgba(255,255,255,.8)", marginTop: 4, fontFamily: SANS }}>{props.subtitle}</div>}
    </div>
  );
}

function ProgressDots(props) {
  var dots = [];
  for (var i = 0; i < 6; i++) {
    var active = i === props.step;
    dots.push(<div key={i} style={{ height: 6, width: active ? 20 : 6, borderRadius: 3, background: active ? GOLD : BORDER_STRONG, transition: "all .2s" }} />);
  }
  return <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 14 }}>{dots}</div>;
}

function NavRow(props) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
      {!props.hideBack && (
        <button onClick={props.onBack} style={{ background: "none", border: "1px solid " + BORDER_STRONG, color: "rgba(233,220,203,.7)", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontFamily: SANS, fontSize: ".82rem" }}>← Back</button>
      )}
      <button onClick={props.onNext} style={{ flex: 1, background: GOLD, color: NAVY, border: "none", borderRadius: 10, padding: "11px 16px", cursor: "pointer", fontFamily: SANS, fontWeight: 700, fontSize: ".85rem" }}>{props.nextLabel || "Next →"}</button>
    </div>
  );
}

export default function SunsetClose(props) {
  var [step, setStep] = useState(0);
  var [mood, setMood] = useState(null);

  var now = new Date();
  var hh = now.getHours();
  var mm = now.getMinutes();
  var nowHHMM = (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
  var todayName = DAYS[now.getDay()];
  var todayISO = now.toISOString().slice(0, 10);
  var tomorrow = new Date(now.getTime() + 86400000);
  var tomorrowName = DAYS[tomorrow.getDay()];
  var tomorrowISO = tomorrow.toISOString().slice(0, 10);
  var dateLine = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  var tomorrowDateLine = tomorrow.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  var preferredName = read("preferredName", "") || "there";
  var greeting = hh < 21 ? "evening" : "night";

  // ── source data — read fresh each open; Sunset is a short session modal,
  // not a long-lived view, so a one-time read (no live-sync listener) is fine ──
  var tasks = read("tasks", []); if (!Array.isArray(tasks)) tasks = [];
  var calEvents = read("calEvents", []); if (!Array.isArray(calEvents)) calEvents = [];
  var meals = read("meals", {}) || {};
  var people = read("people", []); if (!Array.isArray(people)) people = [];
  var exhaleWaves = read("exhale_waves", null);
  var exhaleBucketsInit = read("exhale_buckets", null);
  if (!exhaleBucketsInit || !Array.isArray(exhaleBucketsInit.items)) {
    exhaleBucketsInit = { bucketNames: ["Exhaled","Today","Tomorrow","This Weekend","Someday"], items: [] };
  }

  // ── Step 2 — Today's wins ──
  var winsCount = tasks.filter(function (t) { return t && t.done && (t.day === todayName || t.day === "Daily"); }).length;
  var pastEventsToday = calEvents.filter(function (e) { return e && e.date === todayISO && (!e.time || e.time <= nowHHMM); });
  var todayMealObj = meals[todayName];
  var dinnerPlanned = !!(todayMealObj && (todayMealObj.dinner || todayMealObj.main || (typeof todayMealObj === "string" && todayMealObj)));
  var wavesCompletedToday = !!(exhaleWaves && Array.isArray(exhaleWaves.daily) && exhaleWaves.daily.some(function (w) {
    return (w.tasks || []).some(function (t) { return t.done; });
  }));

  // Compass notice — reuses the same cached daily-briefing "notice" AnchorTab
  // already fetches (compassCache, keyed by day+flowMode). This is a cache
  // hit (no new API call) whenever Today's tab was opened today already;
  // otherwise it's one on-demand call, same as every other Compass feature.
  var [compassNotice, setCompassNotice] = useState(null);
  useEffect(function () {
    if (read("compassEnabled", true) === false) return;
    var state = {};
    SYNC_KEYS.forEach(function (k) { state[k] = read(k, null); });
    state.flowMode = read("flowMode", "Smooth");
    state.myPersonId = localStorage.getItem("af_myPersonId") || null;
    getDailyBriefing(state, function (next) { writeKey("compassCache", next); }).then(function (data) {
      setCompassNotice(data || null);
    }).catch(function () { setCompassNotice(null); });
  }, []); // eslint-disable-line
  var compassText = (compassNotice && compassNotice.notice)
    ? compassNotice.notice + (compassNotice.connection ? " " + compassNotice.connection : "")
    : null;

  // ── Step 3 — Carry forward ──
  var unfinishedTasks = tasks.filter(function (t) { return t && !t.done && !t.archived && (t.day === todayName || t.day === "Daily"); });
  var [decisions, setDecisions] = useState({}); // taskId -> "tomorrow"|"thisweek"|"someday"|"letgo"
  var appliedRef = useRef(false);
  function decide(taskId, choice) { setDecisions(function (p) { return Object.assign({}, p, { [taskId]: choice }); }); }
  function applyCarryForwardDecisions() {
    if (appliedRef.current) return;
    appliedRef.current = true;
    var ids = Object.keys(decisions);
    if (ids.length === 0) return;
    var newItems = [];
    ids.forEach(function (id) {
      var choice = decisions[id];
      var task = tasks.find(function (t) { return t.id === id; });
      if (!task) return;
      var bucketIdx = DECISION_BUCKET[choice];
      if (bucketIdx !== undefined) {
        newItems.push({ id: newId(), text: task.text || task.title || task.name || "", notes: "", bucketIndex: bucketIdx, createdAt: Date.now(), color: BUCKET_COLORS[bucketIdx % BUCKET_COLORS.length] });
      }
    });
    var newTasks = tasks.map(function (t) { return ids.indexOf(t.id) !== -1 ? Object.assign({}, t, { archived: true }) : t; });
    writeKey("tasks", newTasks);
    if (newItems.length > 0) {
      var latestBuckets = read("exhale_buckets", exhaleBucketsInit);
      if (!latestBuckets || !Array.isArray(latestBuckets.items)) latestBuckets = exhaleBucketsInit;
      writeKey("exhale_buckets", Object.assign({}, latestBuckets, { items: latestBuckets.items.concat(newItems) }));
    }
  }

  // ── Step 4 — Tomorrow ──
  var tomorrowEvents = calEvents.filter(function (e) { return e && e.date === tomorrowISO; });
  var movedToTomorrow = unfinishedTasks.filter(function (t) { return decisions[t.id] === "tomorrow"; })
    .map(function (t) { return t.text || t.title || t.name; }).filter(Boolean);
  var tomorrowWeather = (Array.isArray(props.weatherData) && props.weatherData.find(function (d) { return d.date === tomorrowISO; })) || null;

  // ── Step 5 — Clear your mind / kid quote ──
  var [clearMindText, setClearMindText] = useState("");
  var [savedClearMind, setSavedClearMind] = useState(false);
  var [kidQuoteText, setKidQuoteText] = useState("");
  var [kidQuoteChildId, setKidQuoteChildId] = useState(null);
  var [savedKidQuote, setSavedKidQuote] = useState(false);
  var minors = people.filter(function (p) { return isPersonMinor(p); });

  function saveClearMind() {
    var t = clearMindText.trim();
    if (!t) return;
    var latest = read("exhale_buckets", exhaleBucketsInit);
    if (!latest || !Array.isArray(latest.items)) latest = exhaleBucketsInit;
    var item = { id: newId(), text: t, notes: "", bucketIndex: 0, createdAt: Date.now(), color: BUCKET_COLORS[0] };
    writeKey("exhale_buckets", Object.assign({}, latest, { items: latest.items.concat([item]) }));
    setSavedClearMind(true); setClearMindText("");
  }
  function saveKidQuote() {
    var t = kidQuoteText.trim();
    if (!t) return;
    var child = minors.find(function (p) { return p.id === kidQuoteChildId; });
    var latest = read("ripples", []);
    if (!Array.isArray(latest)) latest = [];
    latest = latest.concat([{ id: newId(), name: t, who: child ? personName(child) : "", category: "funny", date: todayISO, note: "" }]);
    writeKey("ripples", latest);
    setSavedKidQuote(true); setKidQuoteText("");
  }

  // ── Step 6 — Good night ──
  var closingSentence = (mood && MOOD_CLOSING[mood]) || "Today is closed, whatever it held.";
  var tomorrowMealObj = meals[tomorrowName];
  var tomorrowDinner = tomorrowMealObj ? (tomorrowMealObj.dinner || tomorrowMealObj.main || (typeof tomorrowMealObj === "string" ? tomorrowMealObj : null)) : null;
  var giftText = tomorrowDinner
    ? "Dinner's already planned — " + tomorrowDinner + ". One less thing to think about."
    : tomorrowEvents.length > 0
      ? "First thing tomorrow: " + tomorrowEvents[0].title + (tomorrowEvents[0].time ? " at " + tomorrowEvents[0].time : "") + " — already on the calendar."
      : tomorrowWeather
        ? "Tomorrow looks " + tomorrowWeather.emoji + " " + tomorrowWeather.high + "°. One less thing to check in the morning."
        : "Nothing urgent is waiting for you in the morning. A clean start.";

  function renderStep0() {
    return (
      <div>
        <StepHeader big title={"Good " + greeting + ", " + preferredName} subtitle={todayName + ", " + dateLine + " · Let's close today with intention."} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {MOODS.map(function (m) {
            var on = mood === m.id;
            return (
              <div key={m.id} onClick={function () { setMood(m.id); }} style={cardStyle({ textAlign: "center", cursor: "pointer", border: on ? "1.5px solid " + GOLD : "0.5px solid rgba(218,165,32,0.3)", background: on ? "rgba(218,165,32,0.14)" : SURFACE })}>
                <div style={{ fontSize: "1.6rem", marginBottom: 4 }}>{m.emoji}</div>
                <div style={{ fontSize: ".8rem", fontWeight: 700, color: "#E9DCCB", fontFamily: SANS }}>{m.label}</div>
              </div>
            );
          })}
        </div>
        <NavRow hideBack onNext={function () { setStep(1); }} />
      </div>
    );
  }

  function renderStep1() {
    var rows = [
      { label: winsCount + " task" + (winsCount !== 1 ? "s" : "") + " completed", ok: winsCount > 0 },
      { label: pastEventsToday.length + " event" + (pastEventsToday.length !== 1 ? "s" : "") + " today", ok: pastEventsToday.length > 0 },
      { label: dinnerPlanned ? "Dinner was planned" : "Dinner wasn't planned", ok: dinnerPlanned },
      { label: wavesCompletedToday ? "A Waves task was completed" : "No Waves tasks completed", ok: wavesCompletedToday },
    ];
    return (
      <div>
        <StepHeader title="Today's wins" subtitle="Whatever else happened, this happened too." />
        <div style={cardStyle({ marginBottom: 10 })}>
          {rows.map(function (r, i) {
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < rows.length - 1 ? "1px solid rgba(218,165,32,0.15)" : "none" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: r.ok ? GOLD : "rgba(218,165,32,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {r.ok && <span style={{ fontSize: ".65rem", color: NAVY, fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ fontSize: ".84rem", color: "#E9DCCB", fontFamily: SANS }}>{r.label}</span>
              </div>
            );
          })}
        </div>
        {compassText && (
          <div style={{ borderLeft: "3px solid " + GOLD, background: "rgba(218,165,32,0.08)", borderRadius: "0 8px 8px 0", padding: "10px 13px", marginBottom: 10 }}>
            <div style={{ fontSize: ".62rem", letterSpacing: ".1em", textTransform: "uppercase", color: GOLD, fontWeight: 700, marginBottom: 3, fontFamily: SANS }}>Compass noticed</div>
            <div style={{ fontSize: ".8rem", color: "#E9DCCB", fontFamily: SANS, lineHeight: 1.5 }}>{compassText}</div>
          </div>
        )}
        <NavRow onBack={function () { setStep(0); }} onNext={function () { setStep(2); }} />
      </div>
    );
  }

  function renderStep2() {
    return (
      <div>
        <StepHeader title="Still waiting" subtitle="These didn't happen today. No guilt — just decide." />
        {unfinishedTasks.length === 0 ? (
          <div style={cardStyle({ textAlign: "center", color: "#E9DCCB", fontFamily: SERIF, fontStyle: "italic", fontSize: ".9rem" })}>All clear — nothing left behind 🌊</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {unfinishedTasks.map(function (t) {
              var text = t.text || t.title || t.name || "";
              var chosen = decisions[t.id];
              return (
                <div key={t.id} style={cardStyle()}>
                  <div style={{ fontSize: ".84rem", color: "#E9DCCB", fontFamily: SANS, marginBottom: 8 }}>{text}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {DECISIONS.map(function (d) {
                      var on = chosen === d.id;
                      return (
                        <button key={d.id} onClick={function () { decide(t.id, d.id); }} style={{ background: on ? GOLD : "rgba(218,165,32,0.1)", color: on ? NAVY : "#F1C49A", border: "1px solid rgba(218,165,32," + (on ? ".9" : ".3") + ")", borderRadius: 20, padding: "5px 11px", fontSize: ".7rem", fontWeight: 700, cursor: "pointer", fontFamily: SANS }}>{d.label}</button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <NavRow onBack={function () { setStep(1); }} onNext={function () { applyCarryForwardDecisions(); setStep(3); }} />
      </div>
    );
  }

  function renderStep3() {
    return (
      <div>
        <StepHeader title="Tomorrow" subtitle={tomorrowName + ", " + tomorrowDateLine} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={cardStyle()}>
            {sectionLabel("📆 On the calendar", "#F1C49A")}
            {tomorrowEvents.length > 0 ? tomorrowEvents.map(function (e, i) {
              return <div key={i} style={{ fontSize: ".82rem", color: "#E9DCCB", fontFamily: SANS, padding: "3px 0" }}>{e.title}{e.time ? " · " + e.time : ""}</div>;
            }) : <div style={{ fontSize: ".8rem", color: "rgba(233,220,203,.55)", fontStyle: "italic", fontFamily: SERIF }}>Nothing on the calendar yet.</div>}
          </div>
          {movedToTomorrow.length > 0 && (
            <div style={cardStyle()}>
              {sectionLabel("↦ Carried from today", "#F1C49A")}
              {movedToTomorrow.map(function (txt, i) { return <div key={i} style={{ fontSize: ".82rem", color: "#E9DCCB", fontFamily: SANS, padding: "3px 0" }}>{txt}</div>; })}
            </div>
          )}
          {compassText && (
            <div style={{ borderLeft: "3px solid " + GOLD, background: "rgba(218,165,32,0.08)", borderRadius: "0 8px 8px 0", padding: "10px 13px" }}>
              <div style={{ fontSize: ".62rem", letterSpacing: ".1em", textTransform: "uppercase", color: GOLD, fontWeight: 700, marginBottom: 3, fontFamily: SANS }}>Compass noticed</div>
              <div style={{ fontSize: ".8rem", color: "#E9DCCB", fontFamily: SANS, lineHeight: 1.5 }}>{compassText}</div>
            </div>
          )}
          {tomorrowWeather && (
            <div style={cardStyle()}>
              {sectionLabel("🌤 Weather", "#F1C49A")}
              <div style={{ fontSize: ".82rem", color: "#E9DCCB", fontFamily: SANS }}>{tomorrowWeather.emoji} {tomorrowWeather.high}° / {tomorrowWeather.low}°{tomorrowWeather.precip != null ? " · " + tomorrowWeather.precip + "% precip" : ""}</div>
            </div>
          )}
        </div>
        <NavRow onBack={function () { setStep(2); }} onNext={function () { setStep(4); }} />
      </div>
    );
  }

  function renderStep4() {
    return (
      <div>
        <StepHeader title="Before you go" subtitle="Set down what's in your head, and save what made you smile." />
        <div style={cardStyle({ marginBottom: 10 })}>
          {sectionLabel("💭 Clear your mind", "#F1C49A")}
          {savedClearMind ? (
            <div style={{ fontSize: ".78rem", color: "#F1C49A", fontStyle: "italic", fontFamily: SERIF }}>Saved to Exhale. ✦</div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", background: "rgba(36,54,77,.5)", border: "1px solid rgba(230,165,126,.15)", borderRadius: 8, marginBottom: 8 }}>
                <input value={clearMindText} onChange={function (e) { setClearMindText(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") saveClearMind(); }} placeholder="Anything on your mind before tomorrow…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: ".78rem", color: "#E9DCCB", fontStyle: "italic", fontFamily: SERIF }} />
              </div>
              {clearMindText.trim() && <span onClick={saveClearMind} style={{ fontSize: ".68rem", color: "#F1C49A", cursor: "pointer", fontFamily: SANS }}>Save ✦</span>}
            </div>
          )}
        </div>
        <div style={cardStyle()}>
          {sectionLabel("💬 Tonight's kid quote", "#F1C49A")}
          {savedKidQuote ? (
            <div style={{ fontSize: ".78rem", color: "#F1C49A", fontStyle: "italic", fontFamily: SERIF }}>Saved to Ripples. ✦</div>
          ) : (
            <div>
              {minors.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  {minors.map(function (p) {
                    var on = kidQuoteChildId === p.id;
                    return <div key={p.id} onClick={function () { setKidQuoteChildId(on ? null : p.id); }} style={{ padding: "4px 10px", background: on ? "rgba(230,165,126,.3)" : "rgba(230,165,126,.12)", border: "1px solid rgba(230,165,126," + (on ? ".55" : ".22") + ")", borderRadius: 20, fontSize: ".68rem", color: "#F1C49A", cursor: "pointer", fontFamily: SANS }}>{personName(p)}</div>;
                  })}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", background: "rgba(36,54,77,.5)", border: "1px solid rgba(230,165,126,.15)", borderRadius: 8, marginBottom: 8 }}>
                <input value={kidQuoteText} onChange={function (e) { setKidQuoteText(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") saveKidQuote(); }} placeholder="What did they say tonight?" style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: ".78rem", color: "#E9DCCB", fontStyle: "italic", fontFamily: SERIF }} />
              </div>
              {kidQuoteText.trim() && <span onClick={saveKidQuote} style={{ fontSize: ".68rem", color: "#F1C49A", cursor: "pointer", fontFamily: SANS }}>Save ✦</span>}
            </div>
          )}
        </div>
        <NavRow onBack={function () { setStep(3); }} onNext={function () { setStep(5); }} />
      </div>
    );
  }

  function renderStep5() {
    return (
      <div>
        <div style={{ background: GRADIENT, borderRadius: 16, padding: 26, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 10 }}>🌇</div>
          <div style={{ fontFamily: SERIF, fontSize: "1.35rem", fontWeight: 600, color: "#fff", lineHeight: 1.4 }}>{closingSentence}</div>
          <div style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 10, padding: "12px 14px", marginTop: 14, textAlign: "left" }}>
            <div style={{ fontSize: ".62rem", letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.7)", fontWeight: 700, marginBottom: 4, fontFamily: SANS }}>🎁 A gift for tomorrow-you</div>
            <div style={{ fontSize: ".82rem", color: "#fff", fontFamily: SANS, lineHeight: 1.5 }}>{giftText}</div>
          </div>
        </div>
        <button onClick={function () { setStep(4); }} style={{ background: "none", border: "1px solid " + BORDER_STRONG, color: "rgba(233,220,203,.7)", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontFamily: SANS, fontSize: ".82rem", marginBottom: 10 }}>← Back</button>
        <div onClick={props.onCloseDay} style={{ width: "100%", padding: 14, background: GOLD, color: NAVY, borderRadius: 11, textAlign: "center", cursor: "pointer", fontFamily: SERIF, fontSize: "1rem", fontWeight: 700, boxSizing: "border-box" }}>Close day ✦</div>
        <div onClick={props.onClose} style={{ textAlign: "center", fontSize: ".72rem", color: "rgba(233,220,203,.45)", cursor: "pointer", marginTop: 10, fontFamily: SANS }}>Not tonight</div>
      </div>
    );
  }

  var STEPS = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];

  return (
    <div onClick={props.onClose} style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }}>
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(170deg, #24364D 0%, #3D4F5C 20%, #5C4A42 38%, #A57B68 58%, #E6A57E 78%, #F1C49A 100%)", zIndex: -1 }} />
      <div onClick={function (e) { e.stopPropagation(); }} style={{ background: "rgba(36,54,77,.9)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(230,165,126,.2)", borderRadius: 20, padding: "22px 20px", maxWidth: 460, width: "92%", margin: "20px auto", position: "relative" }}>
        <button onClick={props.onClose} aria-label="Close" style={{ position: "absolute", top: 12, right: 14, zIndex: 2, background: "rgba(233,220,203,.12)", border: "1px solid rgba(230,165,126,.25)", color: "#E9DCCB", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: ".95rem", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, padding: 0 }}>✕</button>
        <ProgressDots step={step} />
        {STEPS[step]()}
      </div>
    </div>
  );
}
