// src/shell/WeeklyReviewCard.jsx — the Sunday family review, rendered
import { useState } from "react";
import { getWeeklyReview } from "../compass/compassEngine";
import { readHouseholdState, TK } from "./shellKit";

export default function WeeklyReviewCard(props) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [hhOff] = useState(function () { return readHouseholdState().compassEnabled === false; });

  function load() {
    setOpen(true);
    if (review) return;
    setLoading(true);
    var state = readHouseholdState();
    state.compassCache = props.compassCache || state.compassCache || {};
    getWeeklyReview(state, props.setCompassCache)
      .then(function (d) { setReview(d); setLoading(false); })
      .catch(function () { setLoading(false); });
  }

  var label = { fontFamily: TK.sans, fontSize: ".6rem", letterSpacing: ".18em", textTransform: "uppercase", color: TK.goldLight, fontWeight: 600, marginBottom: 6 };
  var item = { fontFamily: TK.sans, fontSize: ".8rem", color: "rgba(245,240,232,.9)", lineHeight: 1.5, padding: "2px 0" };

  if (hhOff) return null;

  return (
    <div style={{ background: "linear-gradient(150deg,#1a2744,#0e1b2e 80%)", borderRadius: "1.2rem", padding: "1.1rem 1.3rem", marginBottom: ".85rem", fontFamily: TK.sans }}>
      <div onClick={load} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div style={{ fontFamily: TK.serif, fontSize: "1.1rem", color: "#f5f0e8" }}>🌊 Your week in review</div>
        <div style={{ fontSize: ".65rem", color: "rgba(245,240,232,.5)" }}>{open ? "" : "tap to open"}</div>
      </div>

      {open && loading && (
        <div style={{ fontFamily: TK.serif, fontStyle: "italic", color: "rgba(245,240,232,.65)", fontSize: ".9rem", marginTop: 10 }}>
          Compass is looking back at your week…
        </div>
      )}

      {open && !loading && review && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontFamily: TK.serif, fontSize: "1rem", color: "#f5f0e8", fontStyle: "italic", lineHeight: 1.45 }}>{review.headline}</div>
          {Array.isArray(review.wins) && review.wins.length > 0 && (
            <div><div style={label}>Wins</div>{review.wins.map(function (w, i) { return <div key={i} style={item}>🏆 {w}</div>; })}</div>
          )}
          {Array.isArray(review.slipped) && review.slipped.length > 0 && (
            <div><div style={label}>Gently noted</div>{review.slipped.map(function (w, i) { return <div key={i} style={item}>{w}</div>; })}</div>
          )}
          {Array.isArray(review.next_week) && review.next_week.length > 0 && (
            <div><div style={label}>Next week</div>{review.next_week.map(function (w, i) { return <div key={i} style={item}>→ {w}</div>; })}</div>
          )}
          {review.load_note && (
            <div style={{ padding: "9px 13px", background: "rgba(200,169,122,.1)", border: "1px solid rgba(200,169,122,.25)", borderRadius: 10, fontSize: ".78rem", color: "rgba(245,240,232,.92)", lineHeight: 1.45 }}>{review.load_note}</div>
          )}
        </div>
      )}
    </div>
  );
}
