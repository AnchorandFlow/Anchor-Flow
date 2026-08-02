// src/shell/PrepCard.jsx — Compass spots the next big event and helps you get ahead
import { useState } from "react";
import { getPrepPlanCached } from "../compass/compassEngine";
import { readHouseholdState, TK } from "./shellKit";

// Phase 3 Item 1 — regex is now just ONE of four candidate sources, kept
// only for generic calEvents (which have no structural "this is a big deal"
// signal). Celebrations/trips/school events are inherently curated records,
// so they need no keyword guessing at all.
var BIG = /trip|camp|vacation|visit|party|birthday|holiday|wedding|recital|tournament|move|travel/i;

function isoDate(y, m, d) { return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }

function gatherCandidates(s) {
  var now = new Date(); now.setHours(0, 0, 0, 0);
  var out = [];

  (s.calEvents || []).forEach(function (e) {
    if (!e || !e.date || !BIG.test(e.title || "")) return;
    var d = new Date(e.date + "T00:00:00");
    var days = isNaN(d) ? null : Math.round((d - now) / 86400000);
    if (days !== null && days >= 2 && days <= 14) out.push({ title: e.title, date: e.date, days: days });
  });

  (s.celebrations || []).forEach(function (c) {
    var month = parseInt(c && c.month, 10), day = parseInt(c && c.day, 10);
    if (!month || !day) return;
    var next = new Date(now.getFullYear(), month - 1, day);
    if (next < now) next.setFullYear(next.getFullYear() + 1);
    var days = Math.round((next - now) / 86400000);
    if (days >= 2 && days <= 14) out.push({ title: (c.name || "Celebration"), date: isoDate(next.getFullYear(), month, day), days: days });
  });

  (s.trips || []).forEach(function (t) {
    if (!t || !t.startDate) return;
    var d = new Date(t.startDate + "T00:00:00");
    var days = isNaN(d) ? null : Math.round((d - now) / 86400000);
    if (days !== null && days >= 2 && days <= 30) out.push({ title: (t.name || "Trip"), date: t.startDate, days: days });
  });

  var people = s.people || [];
  Object.keys(s.schoolData || {}).forEach(function (cid) {
    var cd = (s.schoolData || {})[cid] || {};
    var events = (cd.public && Array.isArray(cd.public.calEvents)) ? cd.public.calEvents : [];
    events.forEach(function (it) {
      if (!it || !it.date) return;
      var d = new Date(it.date + "T00:00:00");
      var days = isNaN(d) ? null : Math.round((d - now) / 86400000);
      if (days === null || days < 2 || days > 14) return;
      var kid = people.find(function (p) { return p.id === cid; });
      out.push({ title: (it.title || it.subject || "School item") + (kid && kid.name ? " (" + kid.name.split(" ")[0] + ")" : ""), date: it.date, days: days });
    });
  });

  out.sort(function (a, b) { return a.days - b.days; });
  return out;
}

export default function PrepCard(props) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  const [s] = useState(readHouseholdState);
  if (s.compassEnabled === false) return null;

  var target = gatherCandidates(s)[0];
  if (!target) return null;

  var ev = { title: target.title, date: target.date };
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
