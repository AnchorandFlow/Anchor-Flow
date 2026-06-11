// src/shell/DinnerCard.jsx — tonight's dinner, fused with shopping + calendar
import { readHouseholdState, TK } from "./shellKit";

function parseTime(t) {
  if (!t) return null;
  var m = String(t).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  var h = parseInt(m[1], 10);
  var min = m[2] ? parseInt(m[2], 10) : 0;
  var ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + min;
}
function fmtTime(mins) {
  var h = Math.floor(mins / 60), m = mins % 60;
  var ap = h >= 12 ? "pm" : "am";
  var h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + (m ? ":" + String(m).padStart(2, "0") : "") + ap;
}

export default function DinnerCard() {
  var s = readHouseholdState();
  var now = new Date();
  var todayName = now.toLocaleDateString("en-US", { weekday: "long" });
  var todayISO = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  var tomorrowName = new Date(now.getTime() + 86400000).toLocaleDateString("en-US", { weekday: "long" });

  var meals = s.meals || {};
  var dinner = (meals[todayName] || {}).dinner || null;
  var tomorrowDinner = (meals[tomorrowName] || {}).dinner || null;

  // pending shopping items that share a word with the dinner name
  var matches = [];
  if (dinner) {
    var words = dinner.toLowerCase().split(/[^a-z]+/).filter(function (w) { return w.length > 3; });
    matches = (s.shoppingItems || []).filter(function (i) {
      if (i.done) return false;
      var t = (i.text || "").toLowerCase();
      return words.some(function (w) { return t.indexOf(w) !== -1; });
    }).map(function (i) { return i.text; }).slice(0, 4);
  }

  // earliest evening event tonight (3pm onward)
  var evening = (s.calEvents || []).filter(function (e) {
    if (e.date !== todayISO) return false;
    var t = parseTime(e.time);
    return t !== null && t >= 15 * 60;
  }).sort(function (a, b) { return parseTime(a.time) - parseTime(b.time); })[0] || null;
  var startBy = evening ? parseTime(evening.time) - 45 : null;

  var line = { fontFamily: TK.sans, fontSize: ".78rem", color: "#3d4a5c", lineHeight: 1.55 };

  return (
    <div style={{ background: "#fff", border: "1.5px solid #e8e4dc", borderRadius: "1.2rem", padding: "1.1rem 1.3rem", marginBottom: "0.85rem", fontFamily: TK.sans }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontFamily: TK.serif, fontSize: "1.15rem", fontWeight: 600, color: "#1a2744" }}>🍽️ Tonight's dinner</div>
        <div style={{ fontSize: ".62rem", color: "#7a8799", textTransform: "uppercase", letterSpacing: ".1em" }}>{todayName}</div>
      </div>

      {dinner ? (
        <div>
          <div style={{ fontFamily: TK.serif, fontSize: "1.35rem", color: "#1a2744", marginBottom: 8 }}>{dinner}</div>
          {matches.length > 0 ? (
            <div style={line}>🛒 Still on your shopping list: <strong>{matches.join(", ")}</strong></div>
          ) : (
            <div style={line}>✓ Nothing on your shopping list is waiting on this meal</div>
          )}
          {evening && startBy !== null && startBy > 0 && (
            <div style={line}>⏰ {evening.title} at {evening.time} — start cooking by <strong>{fmtTime(startBy)}</strong> to eat first</div>
          )}
          {!evening && (
            <div style={line}>🌊 Clear evening — no calendar pressure on dinner</div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ fontFamily: TK.serif, fontStyle: "italic", fontSize: "1rem", color: "#7a8799", marginBottom: 6 }}>Nothing planned for tonight yet.</div>
          {tomorrowDinner ? (
            <div style={line}>Tomorrow is covered ({tomorrowDinner}) — tonight could be your survival dinner. Tacos or pancakes? 😉</div>
          ) : (
            <div style={line}>Quick win: open Meals and drop something in for tonight and tomorrow.</div>
          )}
        </div>
      )}
    </div>
  );
}
