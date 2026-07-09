// src/shell/SunsetClose.jsx — "As the sun sets on today..."
// Built to the mockup (anchor-flow-full-app v28): sunset gradient backdrop,
// glass modal, Today's Win / Save a Ripple / Tomorrow's Horizon / Set It Down.
import { useState } from "react";

var SERIF = "'Cormorant Garamond', serif";
var SANS = "'DM Sans', sans-serif";
var DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function read(key, fallback) {
  try { var v = JSON.parse(localStorage.getItem("af_" + key) || "null"); return v === null ? fallback : v; } catch (e) { return fallback; }
}

function sectionLabel(text, color) {
  return <div style={{ fontSize: ".55rem", letterSpacing: ".18em", textTransform: "uppercase", color: color, marginBottom: 5, fontFamily: SANS }}>{text}</div>;
}

var CHIPS = [
  { label: "💬 Kid quote", category: "funny" },
  { label: "📷 Memory", category: "other" },
  { label: "⭐ Milestone", category: "milestone" },
  { label: "🏆 Win", category: "other" },
];

export default function SunsetClose(props) {
  var [chip, setChip] = useState(null);
  var [text, setText] = useState("");
  var [savedRipple, setSavedRipple] = useState(false);

  var now = new Date();
  var todayName = DAYS[now.getDay()];
  var tomorrow = new Date(now.getTime() + 86400000);
  var tomorrowName = DAYS[tomorrow.getDay()];
  var tomorrowISO = tomorrow.toISOString().slice(0, 10);
  var dateLine = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // ── Today's Win: tasks that are BOTH done and today's (fixes the old bug) ──
  var tasks = read("tasks", []);
  if (!Array.isArray(tasks)) tasks = [];
  var wins = tasks.filter(function (t) {
    return t && t.done && (t.day === todayName || t.day === "Daily");
  }).map(function (t) { return t.text || t.title || t.name; }).filter(Boolean).slice(0, 4);

  // ── Tomorrow's Horizon: events + dinner ──
  var calEvents = read("calEvents", []);
  if (!Array.isArray(calEvents)) calEvents = [];
  var tmwEvents = calEvents.filter(function (e) { return e && e.date === tomorrowISO; }).slice(0, 3);
  var meals = read("meals", {});
  var tMeal = (meals && meals[tomorrowName]) || null;
  var dinner = tMeal ? (tMeal.dinner || tMeal.main || (typeof tMeal === "string" ? tMeal : null)) : null;

  // ── Set It Down: gentle proof that things are already held ──
  var celebrations = read("celebrations", []);
  var celebCount = Array.isArray(celebrations) ? celebrations.length : 0;

  function saveRipple() {
    var t = text.trim();
    if (!t) return;
    try {
      var cur = read("ripples", []);
      if (!Array.isArray(cur)) cur = [];
      cur.push({ id: Date.now().toString(), name: t, who: "", category: (chip && chip.category) || "other", date: now.toISOString().slice(0, 10), note: "" });
      localStorage.setItem("af_ripples", JSON.stringify(cur));
      window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: "ripples" } }));
      setSavedRipple(true); setText(""); setChip(null);
    } catch (e) {}
  }

  var cardBase = { padding: "13px 15px", borderRadius: 11 };
  var itemTxt = { fontSize: ".76rem", color: "#E9DCCB", fontFamily: SANS };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }}>
      {/* Sunset gradient backdrop */}
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(170deg, #24364D 0%, #3D4F5C 20%, #5C4A42 38%, #A57B68 58%, #E6A57E 78%, #F1C49A 100%)", zIndex: -1 }} />

      <div style={{ background: "rgba(36,54,77,.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(230,165,126,.2)", borderRadius: 20, padding: "28px 26px", maxWidth: 430, width: "92%", margin: "20px auto", position: "relative" }}>

        {/* Close — always-visible escape so the flow never feels trapping */}
        <button onClick={props.onClose} aria-label="Close" style={{ position: "absolute", top: 12, right: 14, background: "rgba(233,220,203,.12)", border: "1px solid rgba(230,165,126,.25)", color: "#E9DCCB", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: ".95rem", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, padding: 0 }}>✕</button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>🌇</div>
          <div style={{ fontFamily: SERIF, fontSize: "1.5rem", fontWeight: 300, color: "#F1C49A", marginBottom: 4 }}>As the sun sets on today...</div>
          <div style={{ fontSize: ".76rem", color: "rgba(241,196,154,.55)", fontStyle: "italic", fontFamily: SERIF }}>Let's gather what mattered and release the rest.</div>
          <div style={{ fontSize: ".63rem", color: "rgba(233,220,203,.4)", marginTop: 6, fontFamily: SANS }}>{dateLine}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>

          {/* Today's Win */}
          <div style={Object.assign({}, cardBase, { background: "rgba(126,184,154,.1)", border: "1px solid rgba(126,184,154,.2)" })}>
            {sectionLabel("🌊 Today's Win", "#9ed4be")}
            <div style={{ fontSize: ".8rem", color: "#E9DCCB", lineHeight: 1.5, fontFamily: SANS }}>
              {wins.length > 0 ? wins.join(" · ") + "." : "Today counted — even the quiet parts."}
            </div>
          </div>

          {/* Save a Ripple */}
          <div style={Object.assign({}, cardBase, { background: "rgba(230,165,126,.1)", border: "1px solid rgba(230,165,126,.2)" })}>
            {sectionLabel("✨ Save a Ripple", "#F1C49A")}
            {savedRipple ? (
              <div style={{ fontSize: ".78rem", color: "#F1C49A", fontStyle: "italic", fontFamily: SERIF }}>Saved to Ripples. ✦</div>
            ) : (
              <div>
                <div style={{ fontSize: ".76rem", color: "rgba(241,196,154,.65)", fontStyle: "italic", fontFamily: SERIF, marginBottom: 9 }}>Anything from today worth remembering?</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 9 }}>
                  {CHIPS.map(function (c) {
                    var on = chip && chip.label === c.label;
                    return <div key={c.label} onClick={function () { setChip(on ? null : c); }} style={{ padding: "4px 10px", background: on ? "rgba(230,165,126,.3)" : "rgba(230,165,126,.12)", border: "1px solid rgba(230,165,126," + (on ? ".55" : ".22") + ")", borderRadius: 20, fontSize: ".63rem", color: "#F1C49A", cursor: "pointer", fontFamily: SANS }}>{c.label}</div>;
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", background: "rgba(36,54,77,.5)", border: "1px solid rgba(230,165,126,.15)", borderRadius: 8 }}>
                  <span style={{ opacity: .3, fontSize: ".82rem", color: "#E9DCCB" }}>✎</span>
                  <input value={text} onChange={function (e) { setText(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") saveRipple(); }} placeholder="A moment, a quote, a small win..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: ".78rem", color: "#E9DCCB", fontStyle: "italic", fontFamily: SERIF }} />
                  {text.trim() && <span onClick={saveRipple} style={{ fontSize: ".68rem", color: "#F1C49A", cursor: "pointer", fontFamily: SANS, whiteSpace: "nowrap" }}>Save ✦</span>}
                </div>
              </div>
            )}
          </div>

          {/* Tomorrow's Horizon */}
          <div style={Object.assign({}, cardBase, { background: "rgba(93,123,122,.15)", border: "1px solid rgba(93,123,122,.3)" })}>
            {sectionLabel("🧭 Tomorrow's Horizon", "#a0c4c2")}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {tmwEvents.map(function (e, i) { return <div key={i} style={itemTxt}>📆 {e.title}{e.time ? " · " + e.time : ""}</div>; })}
              {dinner && <div style={itemTxt}>🍽️ {dinner}</div>}
              {tmwEvents.length === 0 && !dinner && <div style={{ fontSize: ".76rem", color: "rgba(233,220,203,.55)", fontStyle: "italic", fontFamily: SERIF }}>An open horizon — nothing scheduled yet.</div>}
            </div>
          </div>

          {/* Set It Down */}
          <div style={Object.assign({}, cardBase, { background: "rgba(230,165,126,.07)", border: "1px solid rgba(230,165,126,.15)" })}>
            {sectionLabel("⚓ Set It Down", "#E9DCCB")}
            <div style={{ fontSize: ".75rem", color: "rgba(233,220,203,.6)", lineHeight: 1.65, fontFamily: SANS }}>
              {celebCount > 0 ? "Your reminders are set and your lists are saved in Anchor." : "Everything you've written down is held in Anchor."}
            </div>
            <div style={{ fontSize: ".76rem", color: "#E9DCCB", marginTop: 6, fontFamily: SERIF, fontStyle: "italic" }}>You don't need to carry these tonight.</div>
          </div>
        </div>

        <div onClick={props.onCloseDay} style={{ width: "100%", padding: 12, background: "linear-gradient(135deg,rgba(230,165,126,.25),rgba(93,123,122,.2))", border: "1px solid rgba(230,165,126,.3)", borderRadius: 11, textAlign: "center", color: "#F1C49A", cursor: "pointer", fontFamily: SERIF, fontSize: ".95rem", boxSizing: "border-box" }}>
          Good night ✦
        </div>
        <div onClick={props.onClose} style={{ textAlign: "center", fontSize: ".72rem", color: "rgba(233,220,203,.45)", cursor: "pointer", marginTop: 10, fontFamily: SANS }}>Not tonight</div>
      </div>
    </div>
  );
}
