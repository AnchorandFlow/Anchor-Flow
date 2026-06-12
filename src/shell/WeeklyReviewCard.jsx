// src/shell/WeeklyReviewCard.jsx — the Sunday family review, rendered
// Reskin (room palette spec, June 12 2026): mist/sea-glass surface, navy as structure.
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

  var label = { fontFamily: TK.sans, fontSize: ".6rem", letterSpacing: ".18em", textTransform: "uppercase", color: "#5E8FA0", fontWeight: 700, marginBottom: 6 };
  var item = { fontFamily: TK.sans, fontSize: ".8rem", color: "#3d4a5c", lineHeight: 1.5, padding: "2px 0" };

  if (hhOff) return null;

  return (
    <div style={{ background: "linear-gradient(135deg,#F8FCFC,#DDEBEC)", border: "1.5px solid #A9C9CC", borderRadius: "1.2rem", padding: "1.1rem 1.3rem", marginBottom: ".85rem", fontFamily: TK.sans }}>
      <div onClick={load} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div style={{ fontFamily: TK.serif, fontSize: "1.1rem", fontWeight: 600, color: "#0A2240" }}>🌊 Your week in review</div>
        <div style={{ fontSize: ".65rem", color: "#7a8799" }}>{open ? "" : "tap to open"}</div>
      </div>

      {open && loading && (
        <div style={{ fontFamily: TK.serif, fontStyle: "italic", color: "#5E8FA0", fontSize: ".9rem", marginTop: 10 }}>
          Compass is looking back at your week…
        </div>
      )}

      {open && !loading && review && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontFamily: TK.serif, fontSize: "1rem", color: "#0A2240", fontStyle: "italic", lineHeight: 1.45 }}>{review.headline}</div>
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
            <div style={{ padding: "9px 13px", background: "rgba(201,164,91,.12)", border: "1px solid rgba(201,164,91,.35)", borderRadius: 10, fontSize: ".78rem", color: "#3d4a5c", lineHeight: 1.45 }}>{review.load_note}</div>
          )}
        </div>
      )}
    </div>
  );
}
