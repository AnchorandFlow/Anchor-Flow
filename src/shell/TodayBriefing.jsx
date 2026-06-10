// src/shell/TodayBriefing.jsx — v2.1 (mode chips, readability, off-switch)
import { useState, useEffect } from "react";
import { getDailyBriefing } from "../compass/compassEngine";
import { readHouseholdState, TK } from "./shellKit";

var MODES = {
  Smooth:   { color: "#7eb89a", emoji: "🌊" },
  Busy:     { color: "#c8a97a", emoji: "⚡" },
  Survival: { color: "#c87a8a", emoji: "🛟" }
};

function fallbackCacheRead() {
  try { return JSON.parse(localStorage.getItem("af_compassCache")) || {}; } catch (e) { return {}; }
}
function fallbackCacheWrite(next) {
  try { localStorage.setItem("af_compassCache", JSON.stringify(next)); } catch (e) {}
}

export default function TodayBriefing(props) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load(force) {
    setLoading(true);
    setError(null);
    var state = readHouseholdState();
    if (state.compassEnabled === false) { setLoading(false); return; }
    state.compassCache = props.compassCache || fallbackCacheRead();
    var save = props.setCompassCache || fallbackCacheWrite;
    getDailyBriefing(state, save, force)
      .then(function (data) { setBrief(data); setLoading(false); })
      .catch(function (e) { setError(e.message || "Compass couldn't load today."); setLoading(false); });
  }

  useEffect(function () { load(false); }, []); // eslint-disable-line

  function refresh() { load(true); }

  var dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  var hour = new Date().getHours();
  var fallbackGreet = (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening") +
    (props.userName ? ", " + props.userName : "");

  var mode = props.flowMode || "Smooth";
  var isSurvival = mode === "Survival";

  var labelStyle = { fontFamily: TK.sans, fontSize: ".6rem", letterSpacing: ".2em", textTransform: "uppercase", color: TK.goldLight, fontWeight: 600, marginBottom: 8 };
  var itemText = { fontFamily: TK.sans, fontSize: ".85rem", fontWeight: 400, color: "rgba(245,240,232,.92)", lineHeight: 1.45 };

  if (readHouseholdState().compassEnabled === false) {
    return (
      <div style={{ background: "linear-gradient(150deg,#1a2744,#0e1b2e 80%)", borderRadius: "1.5rem", padding: "1.2rem 1.4rem", marginBottom: "0.85rem", fontFamily: TK.sans }}>
        <div style={{ fontFamily: TK.serif, fontStyle: "italic", color: "rgba(245,240,232,.7)", fontSize: ".92rem" }}>
          Compass is off. Turn it on in Settings for your daily briefing.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "linear-gradient(150deg,#1a2744,#0e1b2e 80%)", borderRadius: "1.5rem", padding: "1.5rem 1.4rem", marginBottom: "0.85rem", boxShadow: "0 4px 24px rgba(26,39,68,0.35)", fontFamily: TK.sans, fontWeight: 300, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 50% at 18% 8%, rgba(200,169,122,.09) 0%, transparent 55%)", pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: ".62rem", color: "rgba(200,169,122,0.9)", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 800 }}>{dateStr}</div>
          <div onClick={refresh} style={{ fontSize: ".62rem", color: TK.t3, border: "1px solid " + TK.border, borderRadius: 20, padding: "3px 10px", cursor: "pointer" }}>refresh</div>
        </div>

        <div style={{ fontFamily: TK.serif, fontSize: "1.95rem", fontWeight: 700, color: "#faf8f4", lineHeight: 1.08, marginBottom: 12 }}>
          {brief && brief.greeting ? brief.greeting : fallbackGreet}
        </div>

        {props.setFlowMode && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.keys(MODES).map(function (m) {
                var mm = MODES[m];
                var on = mode === m;
                return (
                  <button key={m} onClick={function () { props.setFlowMode(m); }} style={{ background: on ? mm.color : "transparent", color: on ? "#fff" : "rgba(250,248,244,0.75)", border: "2px solid " + (on ? mm.color : "rgba(250,248,244,0.2)"), borderRadius: "2rem", padding: "0.28rem 0.8rem", cursor: "pointer", fontSize: ".72rem", fontWeight: 700, fontFamily: "inherit", transition: "all 0.15s" }}>
                    {mm.emoji} {m}
                  </button>
                );
              })}
            </div>
            {!isSurvival && (
              <div style={{ fontSize: ".68rem", color: "rgba(250,248,244,0.45)", marginTop: 6, fontStyle: "italic" }}>Hard day? Tap 🛟 Survival — it's okay.</div>
            )}
            {isSurvival && (
              <div style={{ color: "#f4a0a0", fontSize: ".8rem", fontWeight: 600, marginTop: 6, fontStyle: "italic", fontFamily: TK.serif }}>🛟 You don't have to do everything. Just enough.</div>
            )}
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 4px" }}>
            <span style={{ fontSize: "1rem" }}>🧭</span>
            <span style={{ fontFamily: TK.serif, fontStyle: "italic", color: "rgba(245,240,232,.7)", fontSize: ".95rem" }}>Compass is looking at your day…</span>
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: "12px 15px", background: "rgba(200,122,138,.08)", border: "1px solid rgba(200,122,138,.25)", borderRadius: 9, fontSize: ".78rem", color: "rgba(245,240,232,.85)", lineHeight: 1.5 }}>
            {error}{" "}
            <span onClick={refresh} style={{ color: TK.goldLight, cursor: "pointer", textDecoration: "underline" }}>Try again</span>
          </div>
        )}

        {!loading && !error && brief && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {Array.isArray(brief.today) && brief.today.length > 0 && (
              <div>
                <div style={labelStyle}>What matters</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {brief.today.map(function (item, i) {
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 14px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(200,169,122,.16)", borderRadius: 11 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: TK.gold, flexShrink: 0, marginTop: 7 }} />
                        <div style={itemText}>{item}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {Array.isArray(brief.pinch_points) && brief.pinch_points.length > 0 && (
              <div>
                <div style={labelStyle}>Worth noticing</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {brief.pinch_points.map(function (p, i) {
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", background: "rgba(200,122,138,.09)", border: "1px solid rgba(200,122,138,.25)", borderRadius: 9, fontSize: ".78rem", color: "rgba(245,240,232,.88)", lineHeight: 1.5, fontFamily: TK.sans }}>
                        {p}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {brief.suggested_focus && (
              <div style={{ padding: "11px 15px", background: "rgba(200,169,122,.1)", border: "1px solid rgba(200,169,122,.28)", borderRadius: 11 }}>
                <div style={labelStyle}>Today's focus</div>
                <div style={{ fontFamily: TK.sans, fontSize: ".87rem", fontWeight: 500, color: "rgba(245,240,232,.95)", lineHeight: 1.45 }}>{brief.suggested_focus}</div>
              </div>
            )}

            {brief.small_win && (
              <div style={{ padding: "11px 15px", background: "linear-gradient(120deg, rgba(126,184,154,.1), rgba(14,27,46,.45))", border: "1px solid rgba(126,184,154,.2)", borderRadius: 11 }}>
                <div style={{ fontFamily: TK.serif, fontSize: ".92rem", color: "rgba(245,240,232,.92)", fontStyle: "italic", lineHeight: 1.44 }}>{brief.small_win}</div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
