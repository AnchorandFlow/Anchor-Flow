// src/shell/PrepCard.jsx — Compass spots the next big event and helps you get ahead
import { useState } from "react";
import { getPrepPlanCached } from "../compass/compassEngine";
import { readHouseholdState, TK } from "./shellKit";

var BIG = /trip|camp|vacation|visit|party|birthday|holiday|wedding|recital|tournament|move|travel/i;

export default function PrepCard(props) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  const [s] = useState(readHouseholdState);
  if (s.compassEnabled === false) return null;

  var now = new Date(); now.setHours(0, 0, 0, 0);
  var target = (s.calEvents || []).map(function (e) {
    var d = new Date((e.date || "") + "T00:00:00");
    var days = isNaN(d) ? null : Math.round((d - now) / 86400000);
    return { e: e, days: days };
  }).filter(function (x) {
    return x.days !== null && x.days >= 2 && x.days <= 14 && BIG.test(x.e.title || "");
  }).sort(function (a, b) { return a.days - b.days; })[0];

  if (!target) return null;

  var ev = target.e;
  var wd = new Date(ev.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });

  function generate() {
    setLoading(true);
    var state = readHouseholdState();
    state.compassCache = props.compassCache || state.compassCache || {};
    getPrepPlanCached(state, props.setCompassCache, ev)
      .then(function (d) { setPlan(d); setLoading(false); })
      .catch(function () { setLoading(false); });
  }

  var item = { fontFamily: TK.sans, fontSize: ".8rem", color: "#3d4a5c", lineHeight: 1.6, display: "flex", gap: 8 };

  return (
    <div style={{ background: "#fff", border: "1.5px solid #e8e4dc", borderRadius: "1.2rem", padding: "1.1rem 1.3rem", marginBottom: ".85rem", fontFamily: TK.sans }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontFamily: TK.serif, fontSize: "1.1rem", fontWeight: 600, color: "#1a2744" }}>
          🧳 {ev.title} — {wd} ({target.days} days)
        </div>
        {!plan && !loading && (
          <button onClick={generate} style={{ background: "linear-gradient(135deg," + TK.gold + ",#b08840)", border: "none", borderRadius: "2rem", padding: ".4rem .95rem", color: "#1a2744", fontWeight: 700, fontSize: ".74rem", fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
            Help me prep
          </button>
        )}
      </div>

      {loading && (
        <div style={{ fontFamily: TK.serif, fontStyle: "italic", color: "#7a8799", fontSize: ".9rem", marginTop: 8 }}>
          Compass is thinking ahead…
        </div>
      )}

      {plan && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
          {plan.intro && <div style={{ fontFamily: TK.serif, fontStyle: "italic", fontSize: ".92rem", color: "#3d4a5c" }}>{plan.intro}</div>}
          {Array.isArray(plan.items) && plan.items.length > 0 && (
            <div>{plan.items.map(function (x, i) { return <div key={i} style={item}><span style={{ color: TK.gold }}>•</span>{x}</div>; })}</div>
          )}
          {Array.isArray(plan.tasks) && plan.tasks.length > 0 && (
            <div style={{ borderTop: "1px solid #eee8de", paddingTop: 8 }}>
              {plan.tasks.map(function (x, i) { return <div key={i} style={item}><span>📌</span>{x}</div>; })}
            </div>
          )}
          {Array.isArray(plan.uses_existing) && plan.uses_existing.length > 0 && (
            <div style={{ fontSize: ".72rem", color: "#7a8799", fontStyle: "italic" }}>Already covered: {plan.uses_existing.join(", ")}</div>
          )}
        </div>
      )}
    </div>
  );
}
