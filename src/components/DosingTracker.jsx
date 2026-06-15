// src/components/DosingTracker.jsx — medication dose log (per person).
// A TRACKING LOG, not medical advice: records what you enter, shows the
// interval YOU set and the last dose given. Never recommends doses/amounts.
// Data lives in health[personId].dosing[] and saves via setHealth (syncs).
import React, { useState } from "react";

var WHITE = "#faf8f4";
var GOLD = "#c8a97a";
var NAVY = "#2E486B";
var BORD = "0.5px solid rgba(250,242,229,0.15)";
var SANS = "DM Sans, sans-serif";
var SERIF = "Cormorant Garamond, serif";

function nowLocalInput() {
  var d = new Date();
  var off = d.getTimezoneOffset();
  var local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16); // yyyy-mm-ddThh:mm
}
function fmt(ts) {
  if (!ts) return "";
  var d = new Date(ts);
  if (isNaN(d)) return "";
  return d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
}
function shortFmt(ts) {
  var d = new Date(ts); if (isNaN(d)) return "";
  return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function DosingTracker(props) {
  var personId = props.personId;
  var health = props.health || {};
  var setHealth = props.setHealth;
  var who = props.allPeople || [];

  var personHealth = health[personId] || {};
  var meds = Array.isArray(personHealth.dosing) ? personHealth.dosing : [];

  var s_add = useState(false); var adding = s_add[0]; var setAdding = s_add[1];
  var s_form = useState({ name: "", type: "scheduled", intervalHours: 12, courseDays: 10, note: "" });
  var form = s_form[0]; var setForm = s_form[1];
  var s_giver = useState(""); var giver = s_giver[0]; var setGiver = s_giver[1];

  function persist(nextMeds) {
    var nextPerson = Object.assign({}, personHealth, { dosing: nextMeds });
    var nextHealth = Object.assign({}, health); nextHealth[personId] = nextPerson;
    if (setHealth) setHealth(nextHealth);
  }

  function addMed() {
    if (!form.name.trim()) return;
    var med = {
      id: "dose_" + Math.random().toString(36).slice(2, 9),
      name: form.name.trim(),
      type: form.type, // "scheduled" | "asneeded"
      intervalHours: Number(form.intervalHours) || null,
      courseDays: form.type === "scheduled" ? (Number(form.courseDays) || null) : null,
      startedAt: form.type === "scheduled" ? Date.now() : null,
      note: form.note.trim(),
      doses: []
    };
    persist(meds.concat([med]));
    setForm({ name: "", type: "scheduled", intervalHours: 12, courseDays: 10, note: "" });
    setAdding(false);
  }

  function logDose(medId, atISO) {
    var when = atISO ? new Date(atISO).getTime() : Date.now();
    var next = meds.map(function (m) {
      if (m.id !== medId) return m;
      var doses = (m.doses || []).concat([{ at: when, by: giver || null }]);
      doses.sort(function (a, b) { return b.at - a.at; });
      return Object.assign({}, m, { doses: doses });
    });
    persist(next);
  }
  function undoLast(medId) {
    var next = meds.map(function (m) {
      if (m.id !== medId) return m;
      var doses = (m.doses || []).slice(); doses.shift();
      return Object.assign({}, m, { doses: doses });
    });
    persist(next);
  }
  function removeMed(medId) {
    persist(meds.filter(function (m) { return m.id !== medId; }));
  }

  function medStatus(m) {
    var doses = m.doses || [];
    var last = doses[0] || null;
    var nextDue = null, overWindow = false;
    if (last && m.intervalHours) {
      nextDue = last.at + m.intervalHours * 3600000;
      overWindow = Date.now() >= nextDue;
    }
    var courseDone = false, dayN = null, totalDoses = null;
    if (m.type === "scheduled" && m.startedAt && m.courseDays) {
      var elapsed = (Date.now() - m.startedAt) / 86400000;
      dayN = Math.floor(elapsed) + 1;
      courseDone = dayN > m.courseDays;
      if (m.intervalHours) totalDoses = Math.round(m.courseDays * 24 / m.intervalHours);
    }
    return { last: last, nextDue: nextDue, overWindow: overWindow, courseDone: courseDone, dayN: dayN, totalDoses: totalDoses, count: doses.length };
  }

  var inp = { background: "rgba(250,242,229,0.06)", border: BORD, borderRadius: 8, padding: "8px 11px", color: WHITE, fontFamily: SANS, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };
  var lbl = { fontSize: 11, color: "rgba(250,248,244,0.45)", marginBottom: 4, display: "block", fontFamily: SANS };

  return React.createElement("div", { style: { fontFamily: SANS } },

    // Safety/footer note
    React.createElement("div", { style: { fontSize: 11, color: "rgba(250,248,244,0.4)", fontStyle: "italic", marginBottom: 14, lineHeight: 1.5, fontFamily: SERIF } },
      "A shared log of doses given — so everyone stays in sync. It tracks what you enter and the interval you set; it doesn't advise on doses or amounts."),

    // Giver selector (who's logging)
    who.length > 0 && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" } },
      React.createElement("span", { style: { fontSize: 11, color: "rgba(250,248,244,0.4)" } }, "Logging as:"),
      who.map(function (p) {
        var on = giver === p.name;
        return React.createElement("span", { key: p.id, onClick: function () { setGiver(on ? "" : p.name); }, style: { fontSize: 12, padding: "3px 10px", borderRadius: 16, cursor: "pointer", background: on ? GOLD : "rgba(250,242,229,0.06)", color: on ? NAVY : "rgba(250,248,244,0.6)", border: BORD, fontWeight: on ? 600 : 400 } }, p.name);
      })
    ),

    // Med cards
    meds.length === 0 && !adding && React.createElement("div", { style: { textAlign: "center", padding: "24px 12px", color: "rgba(250,248,244,0.35)", fontStyle: "italic", fontFamily: SERIF, fontSize: 14 } }, "No medications tracked yet."),

    meds.map(function (m) {
      var st = medStatus(m);
      return React.createElement("div", { key: m.id, style: { background: "rgba(250,242,229,0.04)", border: st.overWindow ? "1px solid rgba(126,184,154,0.5)" : BORD, borderRadius: 12, padding: "13px 15px", marginBottom: 11 } },
        // header
        React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 } },
          React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 15, fontWeight: 600, color: WHITE } }, m.name),
            React.createElement("div", { style: { fontSize: 11, color: "rgba(250,248,244,0.45)", marginTop: 2 } },
              (m.type === "scheduled" ? "Every " + m.intervalHours + "h" : "As needed" + (m.intervalHours ? " · min " + m.intervalHours + "h apart" : "")) +
              (m.type === "scheduled" && st.dayN ? " · Day " + Math.min(st.dayN, m.courseDays) + " of " + m.courseDays : ""))
          ),
          React.createElement("span", { onClick: function () { removeMed(m.id); }, style: { fontSize: 11, color: "rgba(250,248,244,0.3)", cursor: "pointer" } }, "remove")
        ),

        // last dose + next due
        React.createElement("div", { style: { marginTop: 10, padding: "9px 12px", background: "rgba(0,0,0,0.15)", borderRadius: 9 } },
          st.last
            ? React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 13, color: WHITE } }, "Last dose: " + fmt(st.last.at) + (st.last.by ? " · by " + st.last.by : "")),
                st.nextDue && React.createElement("div", { style: { fontSize: 12, color: st.overWindow ? "#9ed4be" : "rgba(250,248,244,0.5)", marginTop: 3, fontWeight: st.overWindow ? 600 : 400 } },
                  st.overWindow ? "✓ Next dose OK now" : "Next dose at " + shortFmt(st.nextDue))
              )
            : React.createElement("div", { style: { fontSize: 13, color: "rgba(250,248,244,0.5)", fontStyle: "italic" } }, "No doses logged yet.")
        ),

        // course progress
        m.type === "scheduled" && st.courseDone && React.createElement("div", { style: { fontSize: 12, color: "#9ed4be", marginTop: 8, fontStyle: "italic" } }, "Course complete 🎉"),

        // log dose row
        React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 11, alignItems: "center", flexWrap: "wrap" } },
          React.createElement("button", { onClick: function () { logDose(m.id, null); }, style: { background: GOLD, color: NAVY, border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: SANS } }, "✓ Log dose now"),
          React.createElement("input", { type: "datetime-local", defaultValue: nowLocalInput(), onChange: function (e) { e.target.dataset.val = e.target.value; }, style: Object.assign({}, inp, { width: "auto", fontSize: 12, padding: "5px 8px" }),
            onKeyDown: function (e) { if (e.key === "Enter" && e.target.value) logDose(m.id, e.target.value); } }),
          React.createElement("span", { onClick: function (e) { var el = e.currentTarget.parentNode.querySelector("input[type=datetime-local]"); if (el && el.value) logDose(m.id, el.value); }, style: { fontSize: 11, color: GOLD, cursor: "pointer" } }, "log at time"),
          st.count > 0 && React.createElement("span", { onClick: function () { undoLast(m.id); }, style: { fontSize: 11, color: "rgba(250,248,244,0.4)", cursor: "pointer", marginLeft: "auto" } }, "undo last")
        ),

        // recent history
        st.count > 0 && React.createElement("div", { style: { marginTop: 10, borderTop: BORD, paddingTop: 8 } },
          React.createElement("div", { style: { fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(250,248,244,0.35)", marginBottom: 5 } }, "Recent (" + st.count + " total)"),
          (m.doses || []).slice(0, 4).map(function (d, i) {
            return React.createElement("div", { key: i, style: { fontSize: 12, color: "rgba(250,248,244,0.6)", padding: "2px 0" } }, "• " + fmt(d.at) + (d.by ? " · " + d.by : ""));
          })
        )
      );
    }),

    // add form
    adding
      ? React.createElement("div", { style: { background: "rgba(250,242,229,0.04)", border: BORD, borderRadius: 12, padding: 15, marginTop: 4 } },
          React.createElement("div", { style: { marginBottom: 11 } },
            React.createElement("label", { style: lbl }, "Medication name"),
            React.createElement("input", { autoFocus: true, value: form.name, onChange: function (e) { setForm(Object.assign({}, form, { name: e.target.value })); }, placeholder: "e.g. Amoxicillin, Tylenol", style: inp })
          ),
          React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 11 } },
            React.createElement("button", { onClick: function () { setForm(Object.assign({}, form, { type: "scheduled" })); }, style: { flex: 1, padding: "8px", borderRadius: 8, border: BORD, cursor: "pointer", fontFamily: SANS, fontSize: 12, background: form.type === "scheduled" ? GOLD : "transparent", color: form.type === "scheduled" ? NAVY : "rgba(250,248,244,0.6)", fontWeight: form.type === "scheduled" ? 700 : 400 } }, "Scheduled course"),
            React.createElement("button", { onClick: function () { setForm(Object.assign({}, form, { type: "asneeded" })); }, style: { flex: 1, padding: "8px", borderRadius: 8, border: BORD, cursor: "pointer", fontFamily: SANS, fontSize: 12, background: form.type === "asneeded" ? GOLD : "transparent", color: form.type === "asneeded" ? NAVY : "rgba(250,248,244,0.6)", fontWeight: form.type === "asneeded" ? 700 : 400 } }, "As needed")
          ),
          React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 11 } },
            React.createElement("div", { style: { flex: 1 } },
              React.createElement("label", { style: lbl }, form.type === "scheduled" ? "Every (hours)" : "Min hours between"),
              React.createElement("input", { type: "number", value: form.intervalHours, onChange: function (e) { setForm(Object.assign({}, form, { intervalHours: e.target.value })); }, style: inp })
            ),
            form.type === "scheduled" && React.createElement("div", { style: { flex: 1 } },
              React.createElement("label", { style: lbl }, "Course length (days)"),
              React.createElement("input", { type: "number", value: form.courseDays, onChange: function (e) { setForm(Object.assign({}, form, { courseDays: e.target.value })); }, style: inp })
            )
          ),
          React.createElement("div", { style: { marginBottom: 13 } },
            React.createElement("label", { style: lbl }, "Note (optional — e.g. 5ml, with food)"),
            React.createElement("input", { value: form.note, onChange: function (e) { setForm(Object.assign({}, form, { note: e.target.value })); }, placeholder: "dose amount, instructions", style: inp })
          ),
          React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("button", { onClick: function () { setAdding(false); }, style: { flex: 1, background: "transparent", border: BORD, borderRadius: 8, padding: 9, color: "rgba(250,248,244,0.6)", cursor: "pointer", fontFamily: SANS, fontSize: 13 } }, "Cancel"),
            React.createElement("button", { onClick: addMed, style: { flex: 1, background: GOLD, border: "none", borderRadius: 8, padding: 9, color: NAVY, fontWeight: 700, cursor: "pointer", fontFamily: SANS, fontSize: 13 } }, "Add medication")
          )
        )
      : React.createElement("button", { onClick: function () { setAdding(true); }, style: { width: "100%", background: "rgba(200,169,122,0.08)", border: "0.5px dashed rgba(200,169,122,0.3)", borderRadius: 10, padding: 11, color: GOLD, cursor: "pointer", fontFamily: SANS, fontSize: 13, marginTop: 4 } }, "+ Add medication")
  );
}
