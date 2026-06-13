// src/shell/RipplesRoom.jsx — the family story engine (V1)
// Built to the mockup (anchor-flow-full-app v28), brighter teal tune.
// Reads/writes the SAME af_ripples data as the legacy RippleSection:
//   { id, name, who, category, date, note }
// Categories map to the app's real RIPPLE_CATS (not the mockup's fictional tags).
import { useState, useEffect } from "react";

var SERIF = "'Cormorant Garamond', serif";
var SANS = "'DM Sans', sans-serif";

// Brighter teal room palette (locked June 12)
var C = {
  bg1: "#3E8B91", bg2: "#2B7378", bg3: "#1E5B63",
  sea: "#b7d4cf", sand: "#d8c6a3", cream: "#f5f0e8",
  t1: "#f5f0e8", t2: "rgba(245,240,232,.72)", t3: "rgba(245,240,232,.40)",
  card: "rgba(30,91,99,.45)", cardSolid: "rgba(23,71,78,.7)",
  border: "rgba(183,212,207,.14)",
};

// Map real categories -> a dot color + display label for the timeline
var CAT_STYLE = {
  milestone: { color: "#b7d4cf", label: "Milestone" },
  firsts:    { color: "#9ec8c0", label: "First" },
  school:    { color: "#e8a0b0", label: "Learning win" },
  sports:    { color: "#7fb1b5", label: "Sports" },
  funny:     { color: "#d8c6a3", label: "Funny" },
  faith:     { color: "#c3b0d8", label: "Faith" },
  other:     { color: "#b7d4cf", label: "Memory" },
};
function catStyle(id) { return CAT_STYLE[id] || CAT_STYLE.other; }

function loadRipples() {
  try { var v = JSON.parse(localStorage.getItem("af_ripples") || "[]"); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}
function fmtDate(d, opts) {
  if (!d) return "";
  var x = new Date(d + "T00:00:00");
  if (isNaN(x)) return "";
  return x.toLocaleDateString("en-US", opts || { month: "short", day: "numeric" });
}

var TABS = [
  { id: "timeline", label: "Timeline" },
  { id: "quotes", label: "Kid Quotes" },
  { id: "recaps", label: "Recaps" },
  { id: "yearbook", label: "Yearbook" },
];

export default function RipplesRoom(props) {
  var [tab, setTab] = useState("timeline");
  var [ripples, setRipples] = useState(loadRipples);

  useEffect(function () {
    function onRefresh(e) {
      if (!e || !e.detail || !e.detail.key || e.detail.key === "ripples") setRipples(loadRipples());
    }
    window.addEventListener("af-data-changed", onRefresh);
    return function () { window.removeEventListener("af-data-changed", onRefresh); };
  }, []);

  var sorted = ripples.slice().sort(function (a, b) {
    if (!a.date && !b.date) return 0; if (!a.date) return 1; if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  // On This Day: a ripple from a prior year matching today's month/day
  var today = new Date();
  var onThisDay = sorted.find(function (r) {
    if (!r.date) return false;
    var d = new Date(r.date + "T00:00:00");
    return !isNaN(d) && d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear();
  });

  // Stats for current month
  var thisMonth = sorted.filter(function (r) {
    if (!r.date) return false;
    var d = new Date(r.date + "T00:00:00");
    return !isNaN(d) && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });
  var milestoneCount = sorted.filter(function (r) { return r.category === "milestone"; }).length;
  var quoteRipples = sorted.filter(function (r) { return r.category === "funny" || (r.name && r.name.indexOf('"') !== -1); });

  function quickAdd(category) { if (props.onCapture) props.onCapture(category); }

  // ── shared bits ──
  function ph(title, sub) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: "1.6rem", fontWeight: 600, color: C.t1 }}>{title}</div>
          <div style={{ fontSize: ".78rem", color: C.t3, fontFamily: SANS }}>{sub}</div>
        </div>
        <div onClick={function () { quickAdd(null); }} style={{ padding: "7px 15px", border: "1px solid " + C.border, borderRadius: 9, color: C.sea, fontSize: ".78rem", cursor: "pointer", fontFamily: SANS }}>+ Add ripple</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "2rem", fontFamily: SANS }}>
      {ph("Ripples", "The story of your family")}

      {/* Inner tab bar */}
      <div style={{ display: "flex", gap: 3, background: "rgba(29,58,62,.5)", border: "1px solid " + C.border, borderRadius: 10, padding: 3, width: "fit-content", marginBottom: 16 }}>
        {TABS.map(function (t) {
          var on = tab === t.id;
          return <div key={t.id} onClick={function () { setTab(t.id); }} style={{ padding: "6px 14px", borderRadius: 8, fontSize: ".74rem", cursor: "pointer", color: on ? C.bg3 : C.t2, background: on ? C.sea : "transparent", fontWeight: on ? 700 : 400, transition: "all .15s" }}>{t.label}</div>;
        })}
      </div>

      {/* ── TIMELINE ── */}
      {tab === "timeline" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {onThisDay && (
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "13px 15px", background: C.card, border: "1px solid " + C.border, borderRadius: 12 }}>
              <span style={{ fontSize: "1.35rem" }}>✨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: ".58rem", letterSpacing: ".16em", textTransform: "uppercase", color: C.sea, marginBottom: 3 }}>On This Day · {fmtDate(onThisDay.date, { month: "long", day: "numeric", year: "numeric" })}</div>
                <div style={{ fontSize: ".88rem", color: C.t1, fontFamily: SERIF, fontStyle: "italic", lineHeight: 1.4 }}>{onThisDay.name}</div>
                {onThisDay.who && <div style={{ fontSize: ".61rem", color: C.t3, marginTop: 3 }}>{onThisDay.who}</div>}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
            {/* Timeline list */}
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: C.sea, opacity: .8 }}>Timeline</div>
                  <div style={{ fontFamily: SERIF, fontSize: "1.1rem", color: C.t1 }}>Memories & Milestones</div>
                </div>
              </div>
              {sorted.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 12px" }}>
                  <div style={{ fontSize: "1.8rem", opacity: .3, marginBottom: 8 }}>🌊</div>
                  <div style={{ fontFamily: SERIF, fontSize: "1.05rem", color: C.t1, marginBottom: 6 }}>The story starts here</div>
                  <div style={{ fontSize: ".76rem", color: C.t3, lineHeight: 1.6 }}>Capture first words, lost teeth, goals scored — anything worth remembering.</div>
                </div>
              ) : sorted.slice(0, 30).map(function (r) {
                var cs = catStyle(r.category);
                return (
                  <div key={r.id} style={{ display: "flex", gap: 11, marginBottom: 14 }}>
                    <div style={{ fontFamily: SERIF, fontStyle: "italic", color: C.t3, fontSize: ".76rem", width: 46, flexShrink: 0, paddingTop: 1 }}>{fmtDate(r.date)}</div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: cs.color, boxShadow: "0 0 6px " + cs.color + "88" }} />
                      <div style={{ width: 1, flex: 1, background: "rgba(183,212,207,.15)", marginTop: 4 }} />
                    </div>
                    <div style={{ flex: 1, paddingBottom: 2 }}>
                      <div style={{ fontSize: ".82rem", color: C.t1, lineHeight: 1.37 }}>{r.name}</div>
                      {r.note && <div style={{ fontSize: ".72rem", color: C.t2, marginTop: 2, lineHeight: 1.4 }}>{r.note}</div>}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                        {r.who && <span style={{ fontSize: ".64rem", color: C.t3 }}>{r.who}</span>}
                        <span style={{ fontSize: ".6rem", padding: "1px 8px", borderRadius: 20, background: cs.color + "26", color: cs.color }}>{cs.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right column: stats + daily prompt + quick add */}
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[{ n: thisMonth.length, l: "This month" }, { n: milestoneCount, l: "Milestones" }, { n: quoteRipples.length, l: "Quotes" }].map(function (s, i) {
                  return (
                    <div key={i} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 11, padding: "12px 8px", textAlign: "center" }}>
                      <div style={{ fontFamily: SERIF, fontSize: "1.5rem", color: C.sea, lineHeight: 1 }}>{s.n}</div>
                      <div style={{ fontSize: ".58rem", color: C.t3, marginTop: 4 }}>{s.l}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: 16, background: C.cardSolid, border: "1px solid " + C.border, borderRadius: 11 }}>
                <div style={{ fontSize: ".56rem", letterSpacing: ".18em", textTransform: "uppercase", color: C.sea, marginBottom: 8, opacity: .8 }}>Today's Ripple Prompt</div>
                <div style={{ fontFamily: SERIF, fontSize: "1.05rem", color: C.t1, fontStyle: "italic", lineHeight: 1.55, marginBottom: 12 }}>"What's one moment from today worth holding onto?"</div>
                <div onClick={function () { quickAdd(null); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(183,212,207,.07)", border: "1px solid rgba(183,212,207,.14)", borderRadius: 8, cursor: "pointer" }}>
                  <span style={{ opacity: .25, fontSize: ".85rem" }}>✎</span>
                  <span style={{ fontSize: ".75rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF }}>Just a sentence or two is enough.</span>
                </div>
                <div style={{ fontSize: ".6rem", color: C.t3, marginTop: 8, textAlign: "right" }}>from Compass 🧭</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: ".57rem", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(183,212,207,.45)" }}>Quick add</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[{ l: "📷 Photo memory", c: "other" }, { l: "💬 Kid quote", c: "funny" }, { l: "⭐ Milestone", c: "milestone" }, { l: "🏆 First", c: "firsts" }].map(function (q) {
                    return <div key={q.l} onClick={function () { quickAdd(q.c); }} style={{ padding: "4px 10px", background: "rgba(36,72,76,.7)", border: "1px solid rgba(183,212,207,.15)", borderRadius: 20, fontSize: ".64rem", color: C.t2, cursor: "pointer" }}>{q.l}</div>;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── KID QUOTES ── */}
      {tab === "quotes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontFamily: SERIF, fontSize: "1.2rem", color: C.t1 }}>Kid Quotes</div>
            <div style={{ fontSize: ".76rem", color: C.t3 }}>Things they said</div>
          </div>
          {quoteRipples.length === 0 ? (
            <div style={{ padding: "10px 14px", background: C.card, border: "1px dashed " + C.border, borderRadius: 9, textAlign: "center" }}>
              <div style={{ fontSize: ".76rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF }}>No quotes yet — tag a ripple "Funny" or wrap it in quotes to see it here.</div>
            </div>
          ) : quoteRipples.map(function (r) {
            return (
              <div key={r.id} style={{ padding: "14px 16px", background: C.card, border: "1px solid " + C.border, borderRadius: 11 }}>
                <div style={{ fontFamily: SERIF, fontSize: "1.05rem", fontStyle: "italic", color: C.t1, lineHeight: 1.4 }}>{r.name}</div>
                <div style={{ fontSize: ".66rem", color: C.t3, marginTop: 6 }}>{[r.who, fmtDate(r.date, { month: "long", day: "numeric", year: "numeric" })].filter(Boolean).join(" · ")}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── RECAPS (Pass 2 wires generation here) ── */}
      {tab === "recaps" && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: SERIF, fontSize: "1.2rem", color: C.t1 }}>Monthly Recaps</div>
            <div style={{ fontSize: ".76rem", color: C.t3 }}>Your family's story, month by month</div>
          </div>
          {props.recapSlot || (
            <div style={{ padding: "28px 20px", background: C.card, border: "1px solid " + C.border, borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>🧭</div>
              <div style={{ fontFamily: SERIF, fontSize: "1.1rem", color: C.t1, marginBottom: 8 }}>Month recaps are coming soon</div>
              <div style={{ fontSize: ".76rem", color: C.t3, lineHeight: 1.6 }}>Compass will gather each month's memories, milestones, and trips into a warm recap you can keep.</div>
            </div>
          )}
        </div>
      )}

      {/* ── YEARBOOK (V3, deferred) ── */}
      {tab === "yearbook" && (
        <div style={{ padding: "28px 20px", background: C.card, border: "1px solid " + C.border, borderRadius: 12, textAlign: "center" }}>
          <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>📖</div>
          <div style={{ fontFamily: SERIF, fontSize: "1.1rem", color: C.t1, marginBottom: 8 }}>Family Yearbook</div>
          <div style={{ fontSize: ".76rem", color: C.t3, lineHeight: 1.6 }}>One day soon, Compass will weave a year of ripples into a keepsake book — photos, milestones, and quotes together.</div>
        </div>
      )}
    </div>
  );
}
