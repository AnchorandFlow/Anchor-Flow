// src/redesign/KidWaveView.jsx — the kid-friendly presentation of an existing
// daily Waves routine (af_waves_kid_v1, wave.kidView). Same wave, same tasks,
// same write path (api.updateTask → WavesSection.persistWaves); only the look
// changes: a feelings check-in, a filling wave, big picture cards to tap, a
// gentle-day mode (essential steps only), and an "all done" celebration.
//
// TODO(photos): a real photo per step. The app has no image upload/storage
// yet (photos elsewhere are base64 in localStorage), and inlining base64 into
// the synced household document is off the table. Next step: a Supabase
// Storage bucket (private, household-scoped RLS) + task.photo holding the
// object path, rendered via a signed URL in StepPicture below. Until then the
// picture is task.icon (or a suggested emoji).
import { useState, useEffect, useRef } from "react";
import { font, color as COLOR, tone } from "../design/tokens.js";
import {
  FEELINGS, feelingInfo, dayKey, kidKeyFor, loadFeelings, feelingFor, saveFeeling, FEELINGS_KEY,
  visibleSteps, hasEssential, stepProgress, stepIcon,
} from "../lib/wavesKid.js";
import { audioReady, chime } from "../lib/rhythmSound.js";

var NAVY = COLOR.anchorNavy, MUTED = "#5B6472", LINE = "rgba(27,43,68,0.14)";
var SEA = tone.blue, SAGE = tone.sage, LAV = { tint: "#E9E6F6", full: "#6F66A8", ink: "#4A447A" }, GOLD = { tint: "#FDF1D6", ink: "#7A5A12" };
var S = "kw";
var CSS = [
  "." + S + "{font-family:" + font.body + ";color:" + NAVY + ";display:flex;flex-direction:column;gap:12px;min-width:0;}",
  "." + S + " button{font-family:" + font.body + ";cursor:pointer;}",
  "." + S + " button:focus-visible{outline:2px solid " + SEA.full + ";outline-offset:2px;}",
  "." + S + "-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;}",
  "." + S + "-fill{transition:width .5s cubic-bezier(.3,.9,.3,1);}",
  "." + S + "-pop{animation:" + S + "pop .4s ease;}",
  "@keyframes " + S + "pop{0%{transform:scale(1)}45%{transform:scale(1.07)}100%{transform:scale(1)}}",
  "@media (prefers-reduced-motion: reduce){." + S + "-pop{animation:none !important}." + S + "-fill{transition:width .15s}}",
].join("\n");

function StepPicture(props) {
  return <span aria-hidden="true" style={{ width: 72, height: 72, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, background: props.done ? "#FFFFFF" : SEA.tint }}>{stepIcon(props.task)}</span>;
}

// props: wave, type, api, kidName, onGrownUp
export default function KidWaveView(props) {
  var w = props.wave, x = props.api;
  var kidKey = kidKeyFor(w);
  var today = dayKey(new Date());
  var [day, setDay] = useState(function () { return feelingFor(loadFeelings(), kidKey, today); });
  var [pop, setPop] = useState(null);
  var [cheered, setCheered] = useState(false);
  var timers = useRef([]);
  useEffect(function () { var pending = timers.current; return function () { pending.forEach(clearTimeout); }; }, []);

  // A check-in from another device (or tab) shows up here.
  useEffect(function () {
    function reload(e) {
      if (e && e.type === "af-data-changed" && e.detail && e.detail.key === FEELINGS_KEY) return;
      setDay(feelingFor(loadFeelings(), kidKey, today));
    }
    window.addEventListener("storage", reload);
    window.addEventListener("af-data-changed", reload);
    return function () { window.removeEventListener("storage", reload); window.removeEventListener("af-data-changed", reload); };
  }, [kidKey, today]);

  function update(patch) {
    var all = saveFeeling(kidKey, today, patch);
    if (all) setDay(feelingFor(all, kidKey, today));
  }
  function pickFeeling(id) { audioReady(); chime.tick(); update({ feeling: id }); }
  function setGentle(on) { update({ gentle: on }); }

  var tasks = w.tasks || [];
  var gentleOn = day.gentle && hasEssential(tasks);
  var shown = visibleSteps(tasks, gentleOn);
  var prog = stepProgress(tasks, gentleOn);

  // Cheer once when the (visible) routine is finished.
  useEffect(function () {
    if (prog.allDone && !cheered) { setCheered(true); chime.allDone(); }
    if (!prog.allDone && cheered) setCheered(false);
  }, [prog.allDone]); // eslint-disable-line react-hooks/exhaustive-deps

  function tap(t) {
    audioReady();
    if (!t.done) { chime.sticker(); setPop(t.id); timers.current.push(setTimeout(function () { setPop(null); }, 420)); } else chime.tick();
    x.updateTask(props.type, w.id, t.id, { done: !t.done });
  }

  var info = day.feeling ? feelingInfo(day.feeling) : null;
  var hour = new Date().getHours();
  var hello = (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening") + (props.kidName ? ", " + props.kidName : "") + "!";

  return (
    <div className={S} data-testid={"kid-wave-" + w.id}>
      <style>{CSS}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 800, color: MUTED }}>{w.name}</div>
        <div style={{ fontFamily: font.heading, fontSize: 24, fontWeight: 600, marginTop: 2 }}>{hello}</div>
      </div>

      {/* Feelings check-in */}
      <section aria-label="How are you feeling?" data-testid="kid-feelings" style={{ background: "#FFFFFF", border: "1px solid " + LINE, borderRadius: 20, padding: "14px 12px 14px", textAlign: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 10 }}>How do your waves feel?</div>
        <div role="radiogroup" aria-label="Feelings" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
          {FEELINGS.map(function (f) {
            var on = day.feeling === f.id;
            return (
              <button key={f.id} type="button" role="radio" aria-checked={on} data-testid={"kid-feel-" + f.id} onClick={function () { pickFeeling(f.id); }}
                style={{ border: "2px solid " + (on ? SEA.full : "rgba(27,43,68,0.12)"), background: on ? SEA.tint : "#F2F6F5", borderRadius: 16, padding: "10px 2px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
                <span aria-hidden="true" style={{ fontSize: 30, lineHeight: 1 }}>{f.icon}</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: on ? SEA.ink : MUTED, lineHeight: 1.1 }}>{f.label}</span>
              </button>
            );
          })}
        </div>
        {info && <div role="status" style={{ marginTop: 10, color: SEA.ink, fontWeight: 700, fontSize: 15 }}>{info.line}</div>}
        {day.feeling === "big" && !gentleOn && (
          <div style={{ marginTop: 10, background: LAV.tint, color: LAV.ink, borderRadius: 14, padding: "11px 13px", display: "flex", alignItems: "center", gap: 10, textAlign: "left", flexWrap: "wrap" }}>
            <span style={{ flex: "1 1 180px", fontWeight: 700, fontSize: 15 }}>{hasEssential(tasks) ? "Looks like a big-feelings day. Want to make it gentle — just the must-dos?" : "Looks like a big-feelings day. Take it slow — every step can wait a minute."}</span>
            {hasEssential(tasks) && <button type="button" data-testid="kid-make-gentle" onClick={function () { setGentle(true); }} style={{ border: "none", borderRadius: 999, padding: "9px 15px", fontWeight: 800, fontSize: 14, background: LAV.full, color: "#FFFFFF", whiteSpace: "nowrap" }}>Make it gentle</button>}
          </div>
        )}
        {day.feeling === "wiggly" && (
          <div style={{ marginTop: 10, background: GOLD.tint, color: GOLD.ink, borderRadius: 14, padding: "11px 13px", textAlign: "left", fontWeight: 700, fontSize: 15 }}>Wiggly energy! Shake it out with a quick movement break before you start.</div>
        )}
      </section>

      {/* Progress: the filling wave */}
      <section aria-label={w.name} style={{ background: "#FFFFFF", border: "1px solid " + LINE, borderRadius: 20, padding: "14px 14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <div style={{ fontFamily: font.heading, fontSize: 20, fontWeight: 600 }}>{gentleOn ? "Just the must-dos" : "Your routine"}</div>
          <div style={{ fontWeight: 800, color: SEA.ink, fontVariantNumeric: "tabular-nums" }} data-testid="kid-progress">{prog.done + " of " + prog.total}</div>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.done} aria-label="Routine progress" style={{ height: 18, borderRadius: 999, background: "#EAF1EF", overflow: "hidden", position: "relative" }}>
          <i className={S + "-fill"} style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: prog.pct + "%", borderRadius: 999, background: "linear-gradient(90deg," + SAGE.full + "," + SEA.full + ")" }} />
        </div>
        {hasEssential(tasks) && (
          <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: LAV.full, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {gentleOn ? <span>Gentle day — showing just the essentials.</span> : <span>Need a lighter day?</span>}
            <button type="button" data-testid="kid-gentle-toggle" aria-pressed={gentleOn} onClick={function () { setGentle(!gentleOn); }}
              style={{ border: "1.5px solid " + LAV.full, background: gentleOn ? LAV.full : "transparent", color: gentleOn ? "#FFFFFF" : LAV.full, borderRadius: 999, padding: "4px 12px", fontWeight: 800, fontSize: 13 }}>{gentleOn ? "Show full routine" : "Gentle day"}</button>
          </div>
        )}

        {!shown.length && <div style={{ color: MUTED, marginTop: 12 }}>No steps yet — a grown-up can add some.</div>}
        <div className={S + "-grid"} style={{ marginTop: 14 }}>
          {shown.map(function (t) {
            return (
              <button key={t.id} type="button" aria-pressed={!!t.done} data-testid={"kid-step-" + t.id} className={pop === t.id ? S + "-pop" : undefined} onClick={function () { tap(t); }}
                style={{ position: "relative", border: "2px solid " + (t.done ? SAGE.full : "rgba(27,43,68,0.12)"), background: t.done ? SAGE.tint : "#FFFFFF", borderRadius: 20, padding: "16px 10px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minHeight: 150, color: NAVY }}>
                <span aria-hidden="true" style={{ position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: "50%", border: "2px solid " + (t.done ? SAGE.full : "rgba(27,43,68,0.2)"), background: t.done ? SAGE.full : "#F2F6F5", color: "#FFFFFF", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{t.done ? "✓" : ""}</span>
                <StepPicture task={t} done={t.done} />
                <span style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.15, overflowWrap: "anywhere", color: t.done ? SAGE.ink : NAVY }}>{t.text}</span>
              </button>
            );
          })}
        </div>
        {prog.allDone && (
          <div role="status" data-testid="kid-all-done" style={{ marginTop: 14, background: GOLD.tint, color: GOLD.ink, borderRadius: 16, padding: "13px 16px", textAlign: "center", fontWeight: 800, fontSize: 18 }}>
            <span aria-hidden="true">🌟 </span>All done — way to go!
          </div>
        )}
      </section>

      <div style={{ textAlign: "center" }}>
        <button type="button" data-testid="kid-grownup" onClick={props.onGrownUp} style={{ border: "none", background: "transparent", color: MUTED, fontWeight: 700, fontSize: 13, textDecoration: "underline", minHeight: 32 }}>Grown-up view</button>
      </div>
    </div>
  );
}
