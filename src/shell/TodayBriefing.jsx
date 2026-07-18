// src/shell/TodayBriefing.jsx — v3 (the Forecast experience)
// Big Thing / Helpful Thing / Meaningful Thing — directional, not informational.
// Reuses the navy hero + mode chips; body is now the Compass forecast.
import { useState, useEffect } from "react";
import { getDailyForecast } from "../compass/compassEngine";
import { readHouseholdState, TK } from "./shellKit";

var MODES = {
  Smooth:   { color: "#7eb89a", emoji: "⚓", label: "Calm Seas" },
  Busy:     { color: "#7aa8c8", emoji: "🌊", label: "Some Waves" },
  Survival: { color: "#c87a8a", emoji: "🛟", label: "Survival Mode" }
};

// Forecast label -> icon + accent (established A&F language)
var FORECAST = {
  "Calm Seas":     { icon: "⚓", color: "#7eb89a" },
  "Some Waves":    { icon: "🌊", color: "#7aa8c8" },
  "Survival Mode": { icon: "🛟", color: "#c87a8a" }
};

function cacheRead() { try { return JSON.parse(localStorage.getItem("af_compassCache")) || {}; } catch (e) { return {}; } }
function cacheWrite(next) { try { localStorage.setItem("af_compassCache", JSON.stringify(next)); } catch (e) {} }
function ovRead() { try { return JSON.parse(localStorage.getItem("af_forecastOverrides")) || {}; } catch (e) { return {}; } }
function ovWrite(o) {
  try {
    localStorage.setItem("af_forecastOverrides", JSON.stringify(o));
    // F-44: household-shared — mark dirty so edits push (see SYNC_KEYS note).
    var _dk = JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]");
    if (_dk.indexOf("forecastOverrides") === -1) { _dk.push("forecastOverrides"); localStorage.setItem("af_dirtyKeys", JSON.stringify(_dk)); }
  } catch (e) {}
}

export default function TodayBriefing(props) {
  const [fc, setFc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hhOff] = useState(function () { return readHouseholdState().compassEnabled === false; });
  const [overrides, setOverrides] = useState(ovRead);
  const [editing, setEditing] = useState(null); // which slot's text field is open

  function load(force) {
    setLoading(true); setError(null);
    var state = readHouseholdState();
    if (state.compassEnabled === false) { setLoading(false); return; }
    state.flowMode = props.flowMode || "Smooth";
    state.compassCache = props.compassCache || cacheRead();
    var save = props.setCompassCache || cacheWrite;
    getDailyForecast(state, save, force)
      .then(function (data) { setFc(data); setLoading(false); })
      .catch(function (e) { setError(e.message || "Compass couldn't load today."); setLoading(false); });
  }
  useEffect(function () { load(false); }, []); // eslint-disable-line
  function refresh() { setOverrides({}); ovWrite({}); load(true); }

  var dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  var hour = new Date().getHours();
  var fallbackGreet = (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening") + (props.userName ? ", " + props.userName : "");
  var mode = props.flowMode || "Smooth";
  var isSurvival = mode === "Survival";

  // A "Thing" the user has overridden takes precedence over Compass's pick
  function thingText(slot, data) {
    if (overrides[slot] && overrides[slot].text) return overrides[slot].text;
    return (data && data.text) || null;
  }
  function setThing(slot, text) {
    var next = Object.assign({}, overrides); next[slot] = { text: text, at: Date.now() };
    setOverrides(next); ovWrite(next); setEditing(null);
  }

  if (hhOff) {
    return (
      <div style={{ background: "linear-gradient(150deg,#1a2744,#0e1b2e 80%)", borderRadius: "1.5rem", padding: "1.2rem 1.4rem", marginBottom: "0.85rem", fontFamily: TK.sans }}>
        <div style={{ fontFamily: TK.serif, fontStyle: "italic", color: "rgba(245,240,232,.7)", fontSize: ".92rem" }}>
          Compass is off. Turn it on in Settings for your daily forecast.
        </div>
      </div>
    );
  }

  var THINGS = [
    { slot: "bigThing", label: "Big Thing", icon: "⛰️", hint: "The one that matters most", accent: "#c8a97a" },
    { slot: "helpfulThing", label: "Helpful Thing", icon: "🧭", hint: "Makes the week lighter", accent: "#7aa8c8" },
    { slot: "meaningfulThing", label: "Meaningful Thing", icon: "💛", hint: "For connection or joy", accent: "#7eb89a" }
  ];

  var fcInfo = fc && fc.forecast && FORECAST[fc.forecast] ? FORECAST[fc.forecast] : null;

  return (
    <div style={{ background: "linear-gradient(150deg,#1a2744,#0e1b2e 80%)", borderRadius: "1.5rem", padding: "1.5rem 1.4rem", marginBottom: "0.85rem", boxShadow: "0 4px 24px rgba(26,39,68,0.35)", fontFamily: TK.sans, fontWeight: 300, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 50% at 18% 8%, rgba(200,169,122,.09) 0%, transparent 55%)", pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: ".62rem", color: "rgba(200,169,122,0.9)", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 800 }}>{dateStr}</div>
          <div onClick={refresh} style={{ fontSize: ".62rem", color: TK.t3, border: "1px solid " + TK.border, borderRadius: 20, padding: "3px 10px", cursor: "pointer" }}>refresh</div>
        </div>

        <div style={{ fontFamily: TK.serif, fontSize: "1.95rem", fontWeight: 700, color: "#faf8f4", lineHeight: 1.08, marginBottom: 10 }}>
          {fc && fc.greeting ? fc.greeting : fallbackGreet}
        </div>

        {/* Forecast line */}
        {!loading && !error && fcInfo && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "10px 14px", background: "rgba(255,255,255,.04)", border: "1px solid " + fcInfo.color + "44", borderRadius: 12 }}>
            <span style={{ fontSize: "1.3rem" }}>{fcInfo.icon}</span>
            <div>
              <div style={{ fontSize: ".66rem", letterSpacing: ".14em", textTransform: "uppercase", color: fcInfo.color, fontWeight: 700 }}>Forecast · {fc.forecast}</div>
              {fc.forecastNote && <div style={{ fontSize: ".82rem", color: "rgba(245,240,232,.85)", fontFamily: TK.serif, fontStyle: "italic", marginTop: 2 }}>{fc.forecastNote}</div>}
            </div>
          </div>
        )}

        {/* Survival toggle only — the forecast is the single voice for the day */}
        {props.setFlowMode && (
          <div style={{ marginBottom: 16 }}>
            {isSurvival ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 14px", background: "rgba(200,122,138,.12)", border: "1px solid rgba(200,122,138,.3)", borderRadius: 12 }}>
                <div style={{ color: "#f4a0a0", fontSize: ".82rem", fontWeight: 600, fontStyle: "italic", fontFamily: TK.serif }}>🛟 You don't have to do everything. Just enough.</div>
                <span onClick={function () { props.setFlowMode("Smooth"); }} style={{ fontSize: ".68rem", color: "rgba(250,248,244,0.6)", cursor: "pointer", whiteSpace: "nowrap" }}>I'm okay →</span>
              </div>
            ) : (
              <div onClick={function () { props.setFlowMode("Survival"); }} style={{ fontSize: ".72rem", color: "rgba(250,248,244,0.5)", cursor: "pointer", fontStyle: "italic" }}>Hard day? Tap for 🛟 Survival Mode — it's okay.</div>
            )}
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 4px" }}>
            <span style={{ fontSize: "1rem" }}>🧭</span>
            <span style={{ fontFamily: TK.serif, fontStyle: "italic", color: "rgba(245,240,232,.7)", fontSize: ".95rem" }}>Compass is reading your day…</span>
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: "12px 15px", background: "rgba(200,122,138,.08)", border: "1px solid rgba(200,122,138,.25)", borderRadius: 9, fontSize: ".78rem", color: "rgba(245,240,232,.85)", lineHeight: 1.5 }}>
            {error} <span onClick={refresh} style={{ color: TK.goldLight, cursor: "pointer", textDecoration: "underline" }}>Try again</span>
          </div>
        )}

        {!loading && !error && fc && fc.worthNoticing && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "10px 14px", marginBottom: 12, background: "rgba(200,169,122,.08)", border: "1px solid rgba(200,169,122,.2)", borderRadius: 11 }}>
            <span style={{ fontSize: ".9rem", flexShrink: 0 }}>👁️</span>
            <div><div style={{ fontSize: ".58rem", letterSpacing: ".16em", textTransform: "uppercase", color: TK.goldLight, fontWeight: 700, marginBottom: 2 }}>Worth Noticing</div><div style={{ fontSize: ".84rem", color: "rgba(245,240,232,.9)", fontFamily: TK.serif, fontStyle: "italic", lineHeight: 1.4 }}>{fc.worthNoticing}</div></div>
          </div>
        )}

        {/* The three Things */}
        {!loading && !error && fc && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {THINGS.map(function (T) {
              var data = fc[T.slot] || {};
              var text = thingText(T.slot, data);
              var alts = Array.isArray(data.alts) ? data.alts : [];
              var isEditing = editing === T.slot;
              return (
                <div key={T.slot} style={{ padding: "13px 15px", background: "rgba(255,255,255,.05)", border: "1px solid " + T.accent + "33", borderRadius: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span>{T.icon}</span>
                      <span style={{ fontSize: ".62rem", letterSpacing: ".16em", textTransform: "uppercase", color: T.accent, fontWeight: 700 }}>{T.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span onClick={function () { setEditing(isEditing ? null : T.slot); }} style={{ fontSize: ".64rem", color: "rgba(245,240,232,.45)", cursor: "pointer" }}>{isEditing ? "cancel" : "edit"}</span>
                    </div>
                  </div>

                  {isEditing ? (
                    <input autoFocus defaultValue={text || ""} onKeyDown={function (e) { if (e.key === "Enter") setThing(T.slot, e.target.value); }} onBlur={function (e) { setThing(T.slot, e.target.value); }}
                      style={{ width: "100%", background: "rgba(0,0,0,.2)", border: "1px solid " + T.accent + "55", borderRadius: 8, padding: "8px 11px", color: "#faf8f4", fontFamily: TK.sans, fontSize: ".9rem", outline: "none", boxSizing: "border-box" }} />
                  ) : (
                    <div style={{ fontSize: ".95rem", color: "rgba(245,240,232,.95)", fontWeight: 400, lineHeight: 1.4 }}>{text || (isSurvival ? "Rest when you can." : "—")}</div>
                  )}

                  {!isEditing && alts.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
                      {alts.map(function (alt, i) {
                        return <span key={i} onClick={function () { setThing(T.slot, alt); }} style={{ fontSize: ".68rem", color: "rgba(245,240,232,.7)", background: "rgba(255,255,255,.05)", border: "1px solid rgba(245,240,232,.12)", borderRadius: 16, padding: "3px 10px", cursor: "pointer" }}>↺ {alt}</span>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
