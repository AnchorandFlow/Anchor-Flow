// src/shell/TodayBriefing.jsx
// The new front door: renders Compass's daily briefing in the redesign's
// visual language. First shell component of the migration.
//
// Usage in App.jsx (inside HomeFlow):
//   const [compassCache, setCompassCache] = useSaved("compassCache", {});
//   ...
//   <TodayBriefing compassCache={compassCache} setCompassCache={setCompassCache}/>
//
// Passing the useSaved pair makes briefings sync across devices. If omitted,
// it falls back to plain localStorage (works, just doesn't sync).

import { useState, useEffect } from "react";
import { getDailyBriefing } from "../compass/compassEngine";
import { readHouseholdState, TK } from "./shellKit";

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
    if (props.compassCache) state.compassCache = props.compassCache;
    else state.compassCache = fallbackCacheRead();

    var save = props.setCompassCache || fallbackCacheWrite;

    getDailyBriefing(state, save, force)
      .then(function (data) { setBrief(data); setLoading(false); })
      .catch(function (e) { setError(e.message || "Compass couldn't load today."); setLoading(false); });
  }

  useEffect(function () { load(false); }, []); // eslint-disable-line

  function refresh() { load(true); }

  var dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // ── shared bits ──
  var labelStyle = { fontFamily: TK.sans, fontSize: ".57rem", letterSpacing: ".2em", textTransform: "uppercase", color: TK.gold, fontWeight: 500, marginBottom: 8 };
  var cardStyle = { display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", background: TK.card, border: "1px solid " + TK.border, borderRadius: 11 };

  return (
    <div style={{ background: TK.navy, borderRadius: "1.2rem", padding: "22px 20px", fontFamily: TK.sans, fontWeight: 300, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 50% at 18% 8%, rgba(200,169,122,.08) 0%, transparent 55%)", pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: TK.serif, fontSize: "1.48rem", fontWeight: 400, color: TK.cream, lineHeight: 1 }}>
              {brief && brief.greeting ? brief.greeting : "Here's today."}
            </div>
            <div style={{ fontSize: ".67rem", color: TK.t3, marginTop: 5 }}>{dateStr}</div>
          </div>
          <div onClick={refresh} style={{ fontSize: ".62rem", color: TK.t3, border: "1px solid " + TK.border, borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>
            refresh
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 4px" }}>
            <span style={{ fontSize: "1rem" }}>🧭</span>
            <span style={{ fontFamily: TK.serif, fontStyle: "italic", color: TK.t2, fontSize: ".95rem" }}>
              Compass is looking at your day…
            </span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ padding: "12px 15px", background: "rgba(200,122,138,.06)", border: "1px solid rgba(200,122,138,.18)", borderRadius: 9, fontSize: ".74rem", color: TK.t2, lineHeight: 1.5 }}>
            {error}{" "}
            <span onClick={refresh} style={{ color: TK.gold, cursor: "pointer", textDecoration: "underline" }}>Try again</span>
          </div>
        )}

        {/* Briefing */}
        {!loading && !error && brief && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {Array.isArray(brief.today) && brief.today.length > 0 && (
              <div>
                <div style={labelStyle}>What matters</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {brief.today.map(function (item, i) {
                    return (
                      <div key={i} style={cardStyle}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: TK.gold, flexShrink: 0, marginTop: 7 }} />
                        <div style={{ fontFamily: TK.serif, fontSize: ".97rem", color: TK.cream, lineHeight: 1.35 }}>{item}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {Array.isArray(brief.pinch_points) && brief.pinch_points.length > 0 && (
              <div>
                <div style={labelStyle}>Worth noticing</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {brief.pinch_points.map(function (p, i) {
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", background: "rgba(200,122,138,.06)", border: "1px solid rgba(200,122,138,.18)", borderRadius: 9, fontSize: ".74rem", color: TK.t2, lineHeight: 1.5 }}>
                        {p}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {brief.suggested_focus && (
              <div style={{ padding: "11px 15px", background: "rgba(200,169,122,.07)", border: "1px solid rgba(200,169,122,.2)", borderRadius: 11 }}>
                <div style={labelStyle}>Today's focus</div>
                <div style={{ fontFamily: TK.serif, fontSize: ".95rem", color: TK.cream, lineHeight: 1.4 }}>{brief.suggested_focus}</div>
              </div>
            )}

            {brief.small_win && (
              <div style={{ padding: "11px 15px", background: "linear-gradient(120deg, rgba(126,184,154,.07), rgba(14,27,46,.45))", border: "1px solid rgba(126,184,154,.14)", borderRadius: 11 }}>
                <div style={{ fontFamily: TK.serif, fontSize: ".88rem", color: TK.cream, fontStyle: "italic", lineHeight: 1.44 }}>{brief.small_win}</div>
              </div>
            )}

          </div>
        )}

        <div style={{ textAlign: "center", fontSize: ".59rem", color: TK.t3, marginTop: 16, fontFamily: TK.serif, fontStyle: "italic" }}>
          Compass · pays attention so you don't have to
        </div>
      </div>
    </div>
  );
}
