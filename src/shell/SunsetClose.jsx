// src/shell/SunsetClose.jsx — Sunset: an end-of-day close, 5 independent
// accordion cards (Reflect / Celebrate / Release / Prepare / Exhale) plus a
// single "Anchor the day" commit and a completion screen. Replaces the
// earlier 6-step wizard — same data, same writes, new shape.
//
// Session-only: mood/openSections/decisions/anchored live in component
// state, never synced — only the writes each section makes (tasks,
// exhale_buckets) persist. The old "tonight's kid quote" → Ripples save
// (and its child-picker) has no home in the 5-section spec and was
// dropped outright, by explicit user confirmation — af_ripples itself is
// untouched, this just removes Sunset as one entry point into it.
//
// Full visual overhaul — deep terracotta-to-dusk gradient, near-black glass
// cards, a single warm-clay accent (#C4876A). No emoji anywhere, including
// the chevron (drawn as a rotated CSS corner, not a glyph) and the close
// icon (drawn the same way, not "✕").
import { useState, useEffect, useRef } from "react";
import { getDailyBriefing } from "../compass/compassEngine";
import { SYNC_KEYS } from "../sync-core";

var SERIF = "'Cormorant Garamond', serif";
var SANS = "'DM Sans', sans-serif";
var DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

var ACCENT = "#C4876A";
var TEXT_PRIMARY = "#F2EAD8";
var TEXT_SECONDARY = "rgba(242,234,216,0.75)";
var TEXT_MUTED = "rgba(242,234,216,0.35)"; // placeholder / muted
var LABEL_COLOR = "rgba(212,168,130,0.7)"; // #D4A882 @ 70% — section labels
var LABEL_COLOR_SOLID = "#D4A882";
var CARD_BG = "rgba(15,10,30,0.32)";
var CARD_BORDER = "0.5px solid rgba(212,168,130,0.18)";
var ROW_ACCENT = "rgba(196,135,106,0.5)"; // #C4876A @ 50% — win/dinner row border
var PAGE_GRADIENT = "linear-gradient(175deg, #1E2A45 0%, #C4876A 14%, #A8695F 26%, #8C4F5A 40%, #6B3A52 55%, #4A2545 70%, #2D1F42 85%, #1E1535 100%)";

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

// Same WMO weather-code buckets as App.jsx's weatherEmoji(), just words
// instead of glyphs — weatherData only carries a numeric `code`, no text
// condition field, so this is a pure display mapping off data already in
// the existing weather integration, not a new fetch or stored field.
function weatherCondition(code) {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code <= 3) return "Overcast";
  if (code <= 48) return "Foggy";
  if (code <= 67) return "Rainy";
  if (code <= 77) return "Snowy";
  if (code <= 82) return "Showers";
  if (code <= 99) return "Stormy";
  return "";
}

function sectionLabel(text, extra) {
  return <div style={Object.assign({ fontSize: "10px", letterSpacing: "0.13em", textTransform: "uppercase", color: LABEL_COLOR, fontWeight: 600, marginBottom: 6, fontFamily: SANS }, extra || {})}>{text}</div>;
}
function cardStyle(extra) {
  return Object.assign({ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: "13px 15px" }, extra || {});
}
function emptyState(text) {
  return <div style={{ fontSize: ".82rem", color: TEXT_SECONDARY, fontStyle: "italic", fontFamily: SERIF }}>{text}</div>;
}

// Pure-CSS chevron (rotated border corner) — no unicode glyph, so it can
// never read as an emoji regardless of platform font.
function Chevron(props) {
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRight: "1.5px solid " + LABEL_COLOR_SOLID, borderBottom: "1.5px solid " + LABEL_COLOR_SOLID, transform: (props.open ? "rotate(225deg)" : "rotate(45deg)"), transition: "transform .2s", flexShrink: 0, marginTop: props.open ? 2 : -2 }} />;
}
// Same trick for the dismiss control, so it isn't a "✕" character either.
function CloseGlyph() {
  return <span style={{ position: "relative", width: 12, height: 12, display: "inline-block" }}>
    <span style={{ position: "absolute", top: 5, left: 0, width: 12, height: 1.5, background: TEXT_PRIMARY, transform: "rotate(45deg)" }} />
    <span style={{ position: "absolute", top: 5, left: 0, width: 12, height: 1.5, background: TEXT_PRIMARY, transform: "rotate(-45deg)" }} />
  </span>;
}

function AccordionCard(props) {
  return (
    <div style={cardStyle({ marginBottom: 10, padding: 0, overflow: "hidden" })}>
      <button type="button" onClick={props.onToggle} style={{ width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, background: "none", border: "none", cursor: "pointer", padding: "14px 15px", textAlign: "left", fontFamily: SANS }}>
        <div>
          {sectionLabel(props.label, { marginBottom: 4 })}
          <div style={{ fontFamily: SERIF, fontSize: "1.05rem", fontWeight: 600, color: TEXT_PRIMARY }}>{props.title}</div>
        </div>
        <span style={{ marginTop: 8 }}><Chevron open={props.open} /></span>
      </button>
      {props.open && <div style={{ padding: "0 15px 16px" }}>{props.children}</div>}
    </div>
  );
}

var MOODS = [
  { id: "calm", label: "Calm" },
  { id: "productive", label: "Productive" },
  { id: "rough", label: "Rough" },
  { id: "full", label: "Full" },
  { id: "scattered", label: "Scattered" },
  { id: "grateful", label: "Grateful" },
];

// Exhale bucket layout is fixed 5-slot (DEFAULT_BUCKET_NAMES in
// ExhaleSection.jsx): 0 Exhaled, 1 Today, 2 Tomorrow, 3 This Weekend, 4
// Someday. "Tomorrow" lands in the Exhale "Today" bucket (not "Tomorrow")
// deliberately — by the time the user opens Exhale in the morning,
// "Today" is what's actionable. "Later" lands in "Someday" — the vaguest
// bucket, matching its vaguer intent. "Remove" archives with no bucket
// item at all (old "letgo" behavior, carried over unchanged).
var BUCKET_COLORS = ["#4A9E8E", "#6ABAAA", "#7AB3D4", "#8BAF8B", "#A99AC4"];
var DECISION_BUCKET = { tomorrow: 1, later: 4 };
var DECISIONS = [
  { id: "tomorrow", label: "Tomorrow" },
  { id: "later", label: "Later" },
  { id: "remove", label: "Remove" },
];

export default function SunsetClose(props) {
  var [mood, setMood] = useState(null);
  var [openSections, setOpenSections] = useState({ reflect: false, celebrate: false, release: false, prepare: false, exhale: false });
  function toggleSection(key) { setOpenSections(function (p) { return Object.assign({}, p, { [key]: !p[key] }); }); }
  var [anchored, setAnchored] = useState(false);

  var now = new Date();
  var hh = now.getHours();
  var mm = now.getMinutes();
  var nowHHMM = (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
  var todayName = DAYS[now.getDay()];
  var todayISO = now.toISOString().slice(0, 10);
  var tomorrow = new Date(now.getTime() + 86400000);
  var tomorrowName = DAYS[tomorrow.getDay()];
  var tomorrowISO = tomorrow.toISOString().slice(0, 10);
  var preferredName = read("preferredName", "") || "there";
  var firstName = preferredName.split(" ")[0];

  // ── source data — read fresh each open; Sunset is a short session modal,
  // not a long-lived view, so a one-time read (no live-sync listener) is fine ──
  var tasks = read("tasks", []); if (!Array.isArray(tasks)) tasks = [];
  var calEvents = read("calEvents", []); if (!Array.isArray(calEvents)) calEvents = [];
  var meals = read("meals", {}) || {};
  var exhaleWaves = read("exhale_waves", null);
  var exhaleBucketsInit = read("exhale_buckets", null);
  if (!exhaleBucketsInit || !Array.isArray(exhaleBucketsInit.items)) {
    exhaleBucketsInit = { bucketNames: ["Exhaled","Today","Tomorrow","This Weekend","Someday"], items: [] };
  }

  // ── Celebrate — wins ──
  var winsCount = tasks.filter(function (t) { return t && t.done && (t.day === todayName || t.day === "Daily"); }).length;
  var pastEventsToday = calEvents.filter(function (e) { return e && e.date === todayISO && (!e.time || e.time <= nowHHMM); });
  var todayMealObj = meals[todayName];
  var dinnerPlanned = !!(todayMealObj && (todayMealObj.dinner || todayMealObj.main || (typeof todayMealObj === "string" && todayMealObj)));
  var wavesCompletedToday = !!(exhaleWaves && Array.isArray(exhaleWaves.daily) && exhaleWaves.daily.some(function (w) {
    return (w.tasks || []).some(function (t) { return t.done; });
  }));

  // Compass notice fetch — kept exactly as-is (shared cache with AnchorTab,
  // see original comment) even though the new 5-section spec has no slot to
  // display it. Removing the fetch would be a data/sync-behavior change,
  // which this pass is explicitly not supposed to make; it just goes unused
  // in render now.
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

  // ── Release — carry forward ──
  var unfinishedTasks = tasks.filter(function (t) { return t && !t.done && !t.archived && (t.day === todayName || t.day === "Daily"); });
  var [decisions, setDecisions] = useState({}); // taskId -> "tomorrow"|"later"|"remove"
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

  // ── Prepare — weather / schedule / dinner ──
  var tomorrowEvents = calEvents.filter(function (e) { return e && e.date === tomorrowISO; });
  var tomorrowWeather = (Array.isArray(props.weatherData) && props.weatherData.find(function (d) { return d.date === tomorrowISO; })) || null;
  var tomorrowMealObj = meals[tomorrowName];
  var tomorrowDinner = tomorrowMealObj ? (tomorrowMealObj.dinner || tomorrowMealObj.main || (typeof tomorrowMealObj === "string" ? tomorrowMealObj : null)) : null;

  // ── Exhale — lingering thought ──
  var [clearMindText, setClearMindText] = useState("");
  var [savedClearMind, setSavedClearMind] = useState(false);
  function saveClearMind() {
    var t = clearMindText.trim();
    if (!t) return;
    var latest = read("exhale_buckets", exhaleBucketsInit);
    if (!latest || !Array.isArray(latest.items)) latest = exhaleBucketsInit;
    var item = { id: newId(), text: t, notes: "", bucketIndex: 0, createdAt: Date.now(), color: BUCKET_COLORS[0] };
    writeKey("exhale_buckets", Object.assign({}, latest, { items: latest.items.concat([item]) }));
    setSavedClearMind(true); setClearMindText("");
  }

  // "Anchor the day" — applies any Release decisions (same write as the old
  // wizard's step-2-to-3 transition, just triggered by the single CTA now
  // that there's no forced step order), then shows the completion screen.
  // props.onCloseDay (which marks the day officially closed up in HomeFlow)
  // fires a moment later rather than synchronously — calling it immediately
  // would flip showEndOfDay to false on the very next parent render and
  // unmount this component before the completion screen ever painted.
  function handleAnchor() {
    applyCarryForwardDecisions();
    setAnchored(true);
    window.setTimeout(function () { if (props.onCloseDay) props.onCloseDay(); }, 3000);
  }

  if (anchored) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: PAGE_GRADIENT, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "1rem" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: TEXT_PRIMARY, fontFamily: SERIF, marginBottom: 10 }}>Your day is anchored.</div>
          <div style={{ fontSize: 18, color: TEXT_PRIMARY, opacity: 0.85, fontFamily: SERIF, marginBottom: 10 }}>Good night, {firstName}.</div>
          <div style={{ fontSize: 13, color: "rgba(242,234,216,0.45)", fontFamily: SANS }}>Tomorrow can wait until tomorrow.</div>
        </div>
      </div>
    );
  }

  return (
    <div onClick={props.onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: PAGE_GRADIENT, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
      <div onClick={function (e) { e.stopPropagation(); }} style={{ maxWidth: 460, width: "92%", margin: "20px auto 40px", position: "relative" }}>
        <button onClick={props.onClose} aria-label="Close" style={{ position: "absolute", top: -6, right: 0, zIndex: 2, background: "rgba(15,10,30,0.32)", border: CARD_BORDER, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><CloseGlyph /></button>

        <AccordionCard label="Reflect" title="How did today feel?" open={openSections.reflect} onToggle={function () { toggleSection("reflect"); }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MOODS.map(function (m) {
              var on = mood === m.id;
              return (
                <button key={m.id} type="button" onClick={function () { setMood(m.id); }} style={{ padding: "9px 14px", borderRadius: 20, border: on ? "1px solid " + ACCENT : "1px solid rgba(212,168,130,0.28)", background: on ? "rgba(196,135,106,0.35)" : "transparent", color: on ? TEXT_PRIMARY : "rgba(242,234,216,0.6)", fontWeight: on ? 700 : 500, fontSize: ".82rem", fontFamily: SANS, cursor: "pointer" }}>{m.label}</button>
              );
            })}
          </div>
        </AccordionCard>

        <AccordionCard label="Celebrate" title="What went well?" open={openSections.celebrate} onToggle={function () { toggleSection("celebrate"); }}>
          {(function () {
            var rows = [
              { label: winsCount + " task" + (winsCount !== 1 ? "s" : "") + " completed" },
              { label: pastEventsToday.length + " event" + (pastEventsToday.length !== 1 ? "s" : "") + " today" },
              { label: dinnerPlanned ? "Dinner was planned" : "Dinner wasn't planned" },
              { label: wavesCompletedToday ? "A Waves task was completed" : "No Waves tasks completed" },
            ];
            return rows.map(function (r, i) {
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 0 10px 12px", borderLeft: "3px solid " + ROW_ACCENT, borderBottom: i < rows.length - 1 ? "1px solid rgba(212,168,130,0.12)" : "none" }}>
                  <span style={{ fontSize: ".84rem", color: TEXT_PRIMARY, fontFamily: SANS }}>{r.label}</span>
                </div>
              );
            });
          })()}
        </AccordionCard>

        <AccordionCard label="Release" title="What can wait?" open={openSections.release} onToggle={function () { toggleSection("release"); }}>
          {unfinishedTasks.length === 0 ? emptyState("All clear — nothing left behind.") : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {unfinishedTasks.map(function (t) {
                var text = t.text || t.title || t.name || "";
                var chosen = decisions[t.id];
                return (
                  <div key={t.id} style={cardStyle()}>
                    <div style={{ fontSize: ".84rem", color: TEXT_PRIMARY, fontFamily: SANS, marginBottom: 8 }}>{text}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {DECISIONS.map(function (d) {
                        var on = chosen === d.id;
                        var isTomorrow = d.id === "tomorrow";
                        var borderColor = isTomorrow ? ACCENT : "rgba(212,168,130,0.28)";
                        var textColor = isTomorrow ? LABEL_COLOR_SOLID : "rgba(242,234,216,0.6)";
                        return (
                          <button key={d.id} type="button" onClick={function () { decide(t.id, d.id); }} style={{ border: "1px solid " + borderColor, background: "transparent", color: textColor, borderRadius: 16, padding: "5px 12px", fontSize: ".72rem", fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: SANS }}>{d.label}</button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AccordionCard>

        <AccordionCard label="Prepare" title="What's ahead?" open={openSections.prepare} onToggle={function () { toggleSection("prepare"); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              {sectionLabel("Weather")}
              {tomorrowWeather ? (
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: "1.4rem", fontWeight: 600, color: TEXT_PRIMARY }}>{tomorrowWeather.high}°</div>
                  <div style={{ fontSize: ".8rem", color: TEXT_SECONDARY, fontFamily: SANS, marginTop: 2 }}>{weatherCondition(tomorrowWeather.code)} · H:{tomorrowWeather.high}° L:{tomorrowWeather.low}° · {tomorrowName}</div>
                </div>
              ) : emptyState("No forecast yet.")}
            </div>
            <div>
              {sectionLabel("Schedule")}
              {tomorrowEvents.length > 0 ? tomorrowEvents.map(function (e, i) {
                return <div key={i} style={{ fontSize: ".82rem", color: TEXT_PRIMARY, fontFamily: SANS, padding: "3px 0" }}>{e.time ? e.time + " · " : ""}{e.title}</div>;
              }) : emptyState("Nothing on the calendar yet.")}
            </div>
            <div>
              {sectionLabel("Dinner")}
              {tomorrowDinner ? (
                <div style={{ borderLeft: "3px solid " + ROW_ACCENT, padding: "4px 0 4px 12px", fontSize: ".82rem", color: TEXT_PRIMARY, fontFamily: SANS }}>{tomorrowDinner}</div>
              ) : emptyState("Nothing planned yet.")}
            </div>
          </div>
        </AccordionCard>

        <AccordionCard label="Exhale" title="Anything still lingering?" open={openSections.exhale} onToggle={function () { toggleSection("exhale"); }}>
          {savedClearMind ? (
            <div style={{ fontSize: ".82rem", color: ACCENT, fontStyle: "italic", fontFamily: SERIF }}>Saved to Exhale.</div>
          ) : (
            <div>
              <div style={{ padding: "10px 12px", background: "rgba(0,0,0,0.2)", border: "0.5px solid rgba(212,168,130,0.15)", borderRadius: 10, marginBottom: 8 }}>
                <input value={clearMindText} onChange={function (e) { setClearMindText(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") saveClearMind(); }} placeholder="Write it here to let it go…" style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: ".82rem", color: TEXT_PRIMARY, fontStyle: "italic", fontFamily: SERIF, boxSizing: "border-box" }} />
              </div>
              {clearMindText.trim() && <span onClick={saveClearMind} style={{ fontSize: ".68rem", color: ACCENT, cursor: "pointer", fontFamily: SANS }}>Save</span>}
            </div>
          )}
        </AccordionCard>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <button type="button" onClick={handleAnchor} style={{ background: TEXT_PRIMARY, color: "#2D1F42", border: "none", borderRadius: 24, padding: "10px 40px", fontSize: 14, fontWeight: 500, fontFamily: SANS, cursor: "pointer" }}>Anchor the day</button>
        </div>
      </div>
    </div>
  );
}
