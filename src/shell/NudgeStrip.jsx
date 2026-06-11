// src/shell/NudgeStrip.jsx — Compass's one daily load-lightening suggestion
import { useState, useEffect } from "react";
import { getDailyNudge } from "../compass/compassEngine";
import { readHouseholdState, TK } from "./shellKit";

export default function NudgeStrip(props) {
  const [nudge, setNudge] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(function () {
    var state = readHouseholdState();
    if (state.compassEnabled === false) return;
    state.compassCache = props.compassCache || state.compassCache || {};
    getDailyNudge(state, props.setCompassCache)
      .then(function (d) { if (d && d.nudge) setNudge(d); })
      .catch(function () {});
  }, []); // eslint-disable-line

  if (hidden || !nudge) return null;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(200,169,122,.1)", border: "1px solid rgba(200,169,122,.35)", borderRadius: "1rem", padding: ".75rem 1rem", marginBottom: ".85rem", fontFamily: TK.sans }}>
      <span style={{ fontSize: ".95rem", flexShrink: 0 }}>🧭</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: ".8rem", color: "#1a2744", lineHeight: 1.5 }}>{nudge.nudge}</div>
        {nudge.why && <div style={{ fontSize: ".68rem", color: "#7a8799", marginTop: 2, fontStyle: "italic" }}>{nudge.why}</div>}
      </div>
      <span onClick={function () { setHidden(true); }} style={{ color: "#7a8799", cursor: "pointer", fontSize: ".85rem", flexShrink: 0, padding: "0 2px" }}>✕</span>
    </div>
  );
}
