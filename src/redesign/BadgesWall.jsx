// src/redesign/BadgesWall.jsx — Badges & Stars: one child's achievement wall,
// a Lighthouse area when af_badges_v1 is on (flag off: never rendered).
// Curriculum shields (tap to level up, star pips show the level) and
// milestone medallions (count ones fill a ring and earn themselves at the
// goal; one-time ones a parent awards). Kept for keeps — nothing resets.
// All logic lives in src/lib/badges.js; this file is the screen.
import { useState, useEffect, useRef } from "react";
import { font, color as COLOR, tone, accentTone } from "../design/tokens.js";
import {
  loadBadges, wallFor, saveWall, levelUp, levelDown, addShield, removeShield, bump, setAwarded,
  editMedal, addMilestone, removeMilestone, medalState, medalPct, wallSummary, MAX_LEVEL, MAX_GOAL, BADGES_KEY,
} from "../lib/badges.js";
import { audioReady, chime } from "../lib/rhythmSound.js";

var NAVY = COLOR.anchorNavy, MUTED = "#5B6472", LINE = "rgba(27,43,68,0.14)", SURFACE = "#FFFFFF", SUNK = "#F4EFE6";
var SEA = tone.blue, SAGE = tone.sage, GOLD = accentTone.gold, RING_GOLD = "#E0AD45", RING_SOFT = "#ECC766";
var S = "bw";

var CSS = [
  "." + S + "{font-family:" + font.body + ";color:" + NAVY + ";display:flex;flex-direction:column;gap:14px;min-width:0;}",
  "." + S + " button{font-family:" + font.body + ";cursor:pointer;}",
  "." + S + " button:focus-visible,." + S + " input:focus-visible{outline:2px solid " + SEA.full + ";outline-offset:2px;}",
  "." + S + "-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}",
  "." + S + "-card{background:" + SURFACE + ";border:1px solid " + LINE + ";border-radius:18px;box-shadow:0 1px 2px rgba(27,43,68,.04),0 4px 14px rgba(27,43,68,.06);min-width:0;}",
  "." + S + "-pop{animation:" + S + "pop .45s ease;}",
  "@keyframes " + S + "pop{0%{transform:scale(1)}40%{transform:scale(1.07)}100%{transform:scale(1)}}",
  "@media (prefers-reduced-motion: reduce){." + S + "-pop{animation:none !important}}",
].join("\n");

var chip = { minHeight: 34, padding: "0 14px", borderRadius: 999, border: "1px solid " + LINE, background: SUNK, color: SEA.ink, fontSize: 14, fontWeight: 800 };
var quiet = { minHeight: 32, padding: "0 10px", borderRadius: 999, border: "none", background: "transparent", color: MUTED, fontSize: 13, fontWeight: 700, textDecoration: "underline", whiteSpace: "nowrap" };
var field = { minHeight: 40, borderRadius: 10, border: "1px solid " + LINE, background: SURFACE, padding: "0 10px", fontFamily: font.body, fontSize: 15, color: NAVY, minWidth: 0, boxSizing: "border-box" };

// props: kidId, kidName, showEmojis (household setting; default true).
// Subject and medal icons are the content itself and always show; the
// decorative ⭐ / 🛡️ in the summary follow showEmojis.
export default function BadgesWall(props) {
  var kidId = props.kidId;
  var se = props.showEmojis !== false;
  var [wall, setWall] = useState(function () { return wallFor(loadBadges(), kidId); });
  var [editing, setEditing] = useState(false);
  var [pop, setPop] = useState(null);
  var [adding, setAdding] = useState(false);
  var [draft, setDraft] = useState({ label: "", icon: "", type: "count", goal: 10 });
  var [newSubject, setNewSubject] = useState({ subject: "", icon: "" });
  var timers = useRef([]);
  useEffect(function () { var pending = timers.current; return function () { pending.forEach(clearTimeout); }; }, []);

  // Changes pulled from another device (or another tab) show up here.
  useEffect(function () {
    function reload(e) {
      if (e && e.type === "af-data-changed" && e.detail && e.detail.key === BADGES_KEY) return; // our own write
      setWall(wallFor(loadBadges(), kidId));
    }
    window.addEventListener("storage", reload);
    window.addEventListener("af-data-changed", reload);
    return function () { window.removeEventListener("storage", reload); window.removeEventListener("af-data-changed", reload); };
  }, [kidId]);

  function commit(next, popId) {
    setWall(next);
    saveWall(kidId, next);
    if (popId) {
      setPop(popId);
      timers.current.push(setTimeout(function () { setPop(null); }, 460));
    }
  }

  function onLevel(c, dir) {
    audioReady();
    var next = dir > 0 ? levelUp(wall, c.id) : levelDown(wall, c.id);
    var after = next.curriculum.filter(function (x) { return x.id === c.id; })[0];
    if (dir > 0 && after.level === MAX_LEVEL && c.level < MAX_LEVEL) chime.setDone(); else chime.tick();
    commit(next, c.id);
  }
  function onBump(m, d) {
    audioReady();
    var next = bump(wall, m.id, d);
    var after = next.milestones.filter(function (x) { return x.id === m.id; })[0];
    if (after.earned && !m.earned) chime.setDone(); else chime.tick();
    commit(next, m.id);
  }
  function onAward(m, on) {
    audioReady();
    if (on) chime.setDone();
    commit(setAwarded(wall, m.id, on), on ? m.id : null);
  }
  function saveDraft() {
    if (!draft.label.trim()) return;
    commit(addMilestone(wall, { label: draft.label, icon: draft.icon || "⭐", type: draft.type, goal: draft.goal }));
    setDraft({ label: "", icon: "", type: "count", goal: 10 });
    setAdding(false);
  }

  var sum = wallSummary(wall);
  var who = props.kidName || "your child";

  return (
    <div className={S} data-testid="badges">
      <style>{CSS}</style>

      <div style={{ textAlign: "center" }}>
        <h3 style={{ fontFamily: font.heading, fontSize: 26, margin: 0, color: NAVY }}>Badges &amp; Stars</h3>
        <div style={{ color: MUTED, fontSize: 15, marginTop: 4 }}>{"Everything " + who + " has earned so far — kept for keeps."}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }} data-testid="badges-summary">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: GOLD.tint, color: GOLD.ink, borderRadius: 999, padding: "7px 15px", fontWeight: 800, fontSize: 15 }}>
            {se ? "⭐ " : "★ "}<span data-testid="badges-stars">{sum.stars}</span>{sum.stars === 1 ? " star" : " stars"}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: SAGE.tint, color: SAGE.ink, borderRadius: 999, padding: "7px 15px", fontWeight: 800, fontSize: 15 }}>
            {se ? "🛡️ " : ""}<span data-testid="badges-levels">{sum.levels}</span>{sum.levels === 1 ? " level" : " levels"}
          </span>
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="button" style={chip} aria-pressed={editing} onClick={function () { setEditing(!editing); }} data-testid="badges-edit">{editing ? "Done editing" : "Edit"}</button>
        </div>
      </div>

      {/* Curriculum shields */}
      <section aria-label="Curriculum">
        <h4 style={{ fontFamily: font.heading, fontSize: 21, margin: "6px 2px 2px", color: NAVY }}>Curriculum</h4>
        <p style={{ color: MUTED, fontSize: 14, margin: "0 2px 12px" }}>How far along in each subject. Tap a shield to level up.</p>
        <div className={S + "-grid"}>
          {wall.curriculum.map(function (c) {
            var top = c.level >= MAX_LEVEL;
            return (
              <div key={c.id} className={S + "-card" + (pop === c.id ? " " + S + "-pop" : "")} data-testid={"badges-shield-" + c.id} style={{ padding: "14px 12px 12px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <button type="button" onClick={function () { if (!top) onLevel(c, 1); }} aria-disabled={top}
                  aria-label={c.subject + ", level " + c.level + " of " + MAX_LEVEL + (top ? ", top level" : ". Tap to level up")}
                  style={{ border: "none", background: "transparent", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: NAVY, cursor: top ? "default" : "pointer", width: "100%" }}>
                  <span aria-hidden="true" style={{ width: 58, height: 58, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, background: top ? GOLD.tint : SEA.tint }}>{c.icon}</span>
                  <span style={{ fontWeight: 800, fontSize: 16, overflowWrap: "anywhere" }}>{c.subject}</span>
                  <span style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED, fontWeight: 800 }}>{top ? "Top level" : "Level " + c.level + " of " + MAX_LEVEL}</span>
                  <span aria-hidden="true" style={{ fontSize: 17, letterSpacing: 2, lineHeight: 1 }}>
                    {[1, 2, 3, 4].map(function (i) { return <span key={i} style={{ color: i <= c.level ? RING_GOLD : "#D9D1C2" }}>★</span>; })}
                  </span>
                </button>
                {(editing || c.level > 0) && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {c.level > 0 && <button type="button" style={quiet} aria-label={"Lower " + c.subject + " one level"} onClick={function () { onLevel(c, -1); }}>− level</button>}
                    {editing && <button type="button" style={Object.assign({}, quiet, { color: "#A0533A" })} aria-label={"Remove " + c.subject} onClick={function () { commit(removeShield(wall, c.id)); }}>Remove</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {editing && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <input style={Object.assign({}, field, { width: 64, textAlign: "center" })} value={newSubject.icon} maxLength={8} placeholder="📘" aria-label="New subject icon" onChange={function (e) { setNewSubject({ subject: newSubject.subject, icon: e.target.value }); }} />
            <input style={Object.assign({}, field, { flex: "1 1 160px" })} value={newSubject.subject} maxLength={40} placeholder="Add a subject" aria-label="New subject name" onChange={function (e) { setNewSubject({ subject: e.target.value, icon: newSubject.icon }); }} />
            <button type="button" style={chip} disabled={!newSubject.subject.trim()} onClick={function () { commit(addShield(wall, newSubject.subject, newSubject.icon)); setNewSubject({ subject: "", icon: "" }); }}>Add subject</button>
          </div>
        )}
      </section>

      {/* Milestone medallions */}
      <section aria-label="Milestones">
        <h4 style={{ fontFamily: font.heading, fontSize: 21, margin: "10px 2px 2px", color: NAVY }}>Milestones</h4>
        <p style={{ color: MUTED, fontSize: 14, margin: "0 2px 12px" }}>Big accomplishments. Tap <b>Award</b>, or <b>+1</b> to log progress.</p>
        <div className={S + "-grid"}>
          {wall.milestones.map(function (m) {
            var st = medalState(m), pct = medalPct(m);
            var earned = st === "earned";
            var ring = earned ? "conic-gradient(" + RING_GOLD + " 0, " + RING_GOLD + " 100%)"
              : st === "progress" ? "conic-gradient(" + RING_SOFT + " " + pct + "%, " + SUNK + " 0)" : SUNK;
            return (
              <div key={m.id} className={S + "-card" + (pop === m.id ? " " + S + "-pop" : "")} data-testid={"badges-medal-" + m.id} data-state={st}
                style={{ padding: "16px 10px 12px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, background: earned ? GOLD.tint : SURFACE, borderColor: earned ? "#EFDCA6" : LINE }}>
                <div aria-hidden="true" style={{ width: 88, height: 88, borderRadius: "50%", padding: 7, boxSizing: "border-box", background: ring }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: earned ? "#FDF1D6" : SURFACE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, position: "relative" }}>
                    <span style={st === "locked" ? { filter: "grayscale(.6)", opacity: 0.55 } : null}>{m.icon}</span>
                    {earned && <span style={{ position: "absolute", bottom: -4, right: -4, fontSize: 19, color: RING_GOLD }}>★</span>}
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.25, overflowWrap: "anywhere" }}>{m.label}</div>
                <div style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: earned ? GOLD.ink : st === "progress" ? SEA.ink : MUTED }}>
                  {earned ? "Earned" : m.type === "count" ? m.have + " / " + m.goal : "Not yet"}
                </div>
                {!editing && !earned && m.type === "count" && <button type="button" style={chip} aria-label={"Add one to " + m.label} onClick={function () { onBump(m, 1); }}>+1</button>}
                {!editing && !earned && m.type === "once" && <button type="button" style={chip} onClick={function () { onAward(m, true); }}>Award</button>}
                {!editing && earned && m.type === "once" && <button type="button" style={quiet} aria-label={"Un-award " + m.label} onClick={function () { onAward(m, false); }}>Un-award</button>}
                {editing && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                    <input key={m.id + ":l:" + m.label} style={Object.assign({}, field, { width: "100%" })} defaultValue={m.label} maxLength={60} aria-label="Milestone name" onBlur={function (e) { if (e.target.value !== m.label) commit(editMedal(wall, m.id, { label: e.target.value })); }} />
                    <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", flexWrap: "wrap", fontSize: 13, color: MUTED, fontWeight: 700 }}>
                      <input key={m.id + ":i:" + m.icon} style={Object.assign({}, field, { width: 52, textAlign: "center", padding: "0 4px" })} defaultValue={m.icon} maxLength={8} aria-label={"Icon for " + m.label} onBlur={function (e) { if (e.target.value !== m.icon) commit(editMedal(wall, m.id, { icon: e.target.value })); }} />
                      {m.type === "count" && <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                        <input key={m.id + ":h:" + m.have} type="number" inputMode="numeric" min={0} max={m.goal} style={Object.assign({}, field, { width: 56, padding: "0 6px" })} defaultValue={m.have} aria-label={"Progress for " + m.label} onBlur={function (e) { if (e.target.value !== "" && Number(e.target.value) !== m.have) commit(editMedal(wall, m.id, { have: e.target.value })); else e.target.value = m.have; }} />
                        of
                        <input key={m.id + ":g:" + m.goal} type="number" inputMode="numeric" min={1} max={MAX_GOAL} style={Object.assign({}, field, { width: 64, padding: "0 6px" })} defaultValue={m.goal} aria-label={"Goal for " + m.label} onBlur={function (e) { if (e.target.value !== "" && Number(e.target.value) !== m.goal) commit(editMedal(wall, m.id, { goal: e.target.value })); else e.target.value = m.goal; }} />
                      </span>}
                    </div>
                    <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                      {m.type === "once" && <button type="button" style={quiet} onClick={function () { onAward(m, !earned); }}>{earned ? "Un-award" : "Award"}</button>}
                      <button type="button" style={Object.assign({}, quiet, { color: "#A0533A" })} aria-label={"Remove " + m.label} onClick={function () { commit(removeMilestone(wall, m.id)); }}>Remove</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {adding ? (
          <div className={S + "-card"} style={{ padding: 14, marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }} data-testid="badges-add-form">
            <div style={{ fontWeight: 800 }}>New milestone</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={Object.assign({}, field, { width: 64, textAlign: "center" })} value={draft.icon} maxLength={8} placeholder="⭐" aria-label="Icon" onChange={function (e) { setDraft(Object.assign({}, draft, { icon: e.target.value })); }} />
              <input style={Object.assign({}, field, { flex: 1 })} value={draft.label} maxLength={60} placeholder="e.g. Ride a bike without training wheels" aria-label="Milestone name" onChange={function (e) { setDraft(Object.assign({}, draft, { label: e.target.value })); }} />
            </div>
            <div role="radiogroup" aria-label="Kind of milestone" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {[["count", "Count up to a goal"], ["once", "One-time"]].map(function (o) {
                var on = draft.type === o[0];
                return <button key={o[0]} type="button" role="radio" aria-checked={on} onClick={function () { setDraft(Object.assign({}, draft, { type: o[0] })); }}
                  style={Object.assign({}, chip, { background: on ? NAVY : SUNK, color: on ? "#FFFFFF" : NAVY, borderColor: on ? NAVY : LINE })}>{o[1]}</button>;
              })}
              {draft.type === "count" && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: MUTED, fontWeight: 700 }}>Goal
                  <input type="number" inputMode="numeric" min={1} max={MAX_GOAL} style={Object.assign({}, field, { width: 80 })} value={draft.goal} onChange={function (e) { setDraft(Object.assign({}, draft, { goal: e.target.value })); }} />
                </label>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" disabled={!draft.label.trim()} onClick={saveDraft} data-testid="badges-add-save"
                style={Object.assign({}, chip, { background: NAVY, color: "#FFFFFF", borderColor: NAVY, opacity: draft.label.trim() ? 1 : 0.5 })}>Add milestone</button>
              <button type="button" style={quiet} onClick={function () { setAdding(false); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" data-testid="badges-add" onClick={function () { setAdding(true); }}
            style={{ marginTop: 12, width: "100%", minHeight: 44, borderRadius: 14, border: "1.5px dashed rgba(27,43,68,0.3)", background: "transparent", color: MUTED, fontWeight: 800, fontSize: 15 }}>+ Add a milestone</button>
        )}
      </section>
      <p style={{ textAlign: "center", color: MUTED, fontSize: 13, margin: "4px 0 0" }}>Badges and stars are kept across days — they never reset.</p>
    </div>
  );
}
