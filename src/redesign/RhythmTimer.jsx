// src/redesign/RhythmTimer.jsx — Rhythm: a focus-block timer for one child,
// shown as a Lighthouse area when af_rhythm_v1 is on (flag off: never
// imported into a render path, nothing changes).
//
// The child works through an ordered list of blocks (subjects and movement
// breaks). The active block shows a countdown ring with Now / Next; in the
// last ~2 minutes of a work block a gentle banner and soft chime say "start
// wrapping up" and the ring turns gold. Finishing a work block earns a
// surprise sticker for today's collection. All logic lives in
// src/lib/rhythm.js; this file is the screen.
import { useState, useEffect, useRef } from "react";
import { font, color as COLOR, tone, accentTone } from "../design/tokens.js";
import {
  dayKey, loadRoutines, routineFor, saveRoutine, moveBlock, updateBlock, removeBlock, toggleBlockType,
  totalMins, newBlockId, normalizeBlock, STICKER_SETS, stickerDayFor, earnSticker, loadStickerLedger,
  saveStickerDay, idleRun, timeLeftMs, isRunning, isWrapping, startBlock, pauseRun, resumeRun, extendRun,
  completeCurrent, loadRun, saveRun, pickBreakIdea, MIN_MINS, MAX_MINS, ROUTINES_KEY,
} from "../lib/rhythm.js";
import { audioReady, chime } from "../lib/rhythmSound.js";
import { createScreenWake } from "../lib/rhythmWake.js";

var NAVY = COLOR.anchorNavy, MUTED = "#5B6472", LINE = "rgba(27,43,68,0.14)", SURFACE = "#FFFFFF", SUNK = "#F4EFE6";
var WORK = tone.blue, BREAK = tone.sage, GOLD = accentTone.gold, DONE = tone.sage;
var R = 104, CIRC = 2 * Math.PI * R;
var S = "rh";

var CSS = [
  "." + S + "{font-family:" + font.body + ";color:" + NAVY + ";display:flex;flex-direction:column;gap:16px;min-width:0;}",
  "." + S + " button{font-family:" + font.body + ";cursor:pointer;}",
  "." + S + " button:focus-visible,." + S + " input:focus-visible,." + S + " textarea:focus-visible{outline:2px solid " + WORK.full + ";outline-offset:2px;}",
  "." + S + "-card{background:" + SURFACE + ";border:1px solid " + LINE + ";border-radius:20px;padding:16px;box-shadow:0 1px 2px rgba(27,43,68,.04),0 4px 14px rgba(27,43,68,.06);min-width:0;}",
  "." + S + "-ring-fg{transition:stroke-dashoffset .3s linear,stroke .6s ease;}",
  "." + S + "-slot.pop{animation:" + S + "pop .5s ease;}",
  "@keyframes " + S + "pop{0%{transform:scale(0) rotate(-25deg)}70%{transform:scale(1.18)}100%{transform:scale(1)}}",
  "." + S + "-row.settle{animation:" + S + "settle .5s ease;}",
  "@keyframes " + S + "settle{0%{transform:scale(1.04)}55%{transform:scale(.985)}100%{transform:scale(1)}}",
  "." + S + "-pulse{animation:" + S + "pulse 2.4s ease-in-out infinite;display:inline-block;}",
  "@keyframes " + S + "pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}",
  "@media (prefers-reduced-motion: reduce){." + S + "-ring-fg{transition:stroke .3s ease}." + S + "-slot.pop,." + S + "-row.settle,." + S + "-pulse{animation:none !important}}",
].join("\n");

function fmt(ms) {
  var sec = Math.max(0, Math.ceil(ms / 1000));
  var m = Math.floor(sec / 60), s = sec % 60;
  return m + ":" + (s < 10 ? "0" : "") + s;
}
function reducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { return false; }
}

// Confetti (from the mockup). Skipped entirely for reduced motion.
function fireConfetti() {
  if (reducedMotion() || typeof document === "undefined") return;
  var cv = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(cv);
  var ctx = cv.getContext && cv.getContext("2d");
  if (!ctx) { cv.remove(); return; }
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = cv.width = window.innerWidth * DPR, H = cv.height = window.innerHeight * DPR;
  var colors = [WORK.full, BREAK.full, "#D4A240", "#B87265", "#4D7A6A", "#9EC6D2"], P = [];
  for (var i = 0; i < 150; i++) P.push({ x: Math.random() * W, y: -Math.random() * H * 0.4, w: (6 + Math.random() * 7) * DPR, h: (9 + Math.random() * 11) * DPR, vx: (-1.2 + Math.random() * 2.4) * DPR, vy: (2 + Math.random() * 4) * DPR, rot: Math.random() * 6.28, vr: -0.22 + Math.random() * 0.44, col: colors[i % colors.length] });
  var start = Date.now(), dur = 3000;
  function frame() {
    var el = Date.now() - start;
    ctx.clearRect(0, 0, W, H);
    for (var k = 0; k < P.length; k++) {
      var p = P[k]; p.vy += 0.05 * DPR; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(0, 1 - el / dur); ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (el < dur) requestAnimationFrame(frame); else cv.remove();
  }
  requestAnimationFrame(frame);
}

var btn = { minHeight: 44, padding: "0 18px", borderRadius: 999, border: "1.5px solid " + LINE, background: SURFACE, color: NAVY, fontSize: 15, fontWeight: 700 };
var btnPrimary = Object.assign({}, btn, { background: NAVY, borderColor: NAVY, color: "#FFFFFF", minWidth: 128 });
var smallBtn = { width: 30, height: 30, padding: 0, borderRadius: 9, border: "1px solid " + LINE, background: SUNK, color: MUTED, fontSize: 16, lineHeight: 1 };

// props: kidId, kidName, showEmojis (the household setting; default true).
// Stickers always show — they are the reward, not decoration. Decorative
// emoji (🌟 🎡 🌾 🎉 ✏️) follow showEmojis.
export default function RhythmTimer(props) {
  var kidId = props.kidId;
  var se = props.showEmojis !== false;
  function deco(s) { return se ? s : ""; }
  var today = dayKey(new Date());
  var [blocks, setBlocks] = useState(function () { return routineFor(loadRoutines(), kidId); });
  var [run, setRun] = useState(function () { return loadRun(kidId, today); });
  var [stickers, setStickers] = useState(function () { return stickerDayFor(loadStickerLedger(), kidId, today); });
  var [now, setNow] = useState(Date.now());
  var [justDone, setJustDone] = useState(null);
  var [popSlot, setPopSlot] = useState(-1);
  var [setParty, setSetParty] = useState(null); // { name, items } just completed
  // Coming back to a break that's already running: show its fixed movement,
  // or land the wheel on an idea straight away (no spin on load).
  var [breakIdea, setBreakIdea] = useState(function () {
    var b = blocks.filter(function (x) { return x.id === run.blockId; })[0];
    if (!b || b.type !== "break") return "";
    return b.breakActivity.trim() || pickBreakIdea();
  });
  var [spinning, setSpinning] = useState(false);
  var [listSpin, setListSpin] = useState(null); // { id, text } while a block's 🎡 Spin is rolling
  var [openNote, setOpenNote] = useState({});

  var runRef = useRef(run); runRef.current = run;
  var blocksRef = useRef(blocks); blocksRef.current = blocks;
  var stickersRef = useRef(stickers); stickersRef.current = stickers;
  var timers = useRef([]);
  function later(fn, ms) { timers.current.push(setTimeout(fn, ms)); }
  useEffect(function () { var pending = timers.current; return function () { pending.forEach(clearTimeout); }; }, []);

  // Routines pulled from another device (or edited in another tab) show up here.
  useEffect(function () {
    function reload(e) {
      if (e && e.type === "af-data-changed" && e.detail && e.detail.key === ROUTINES_KEY) return; // our own write
      setBlocks(routineFor(loadRoutines(), kidId));
    }
    window.addEventListener("storage", reload);
    window.addEventListener("af-data-changed", reload);
    return function () { window.removeEventListener("storage", reload); window.removeEventListener("af-data-changed", reload); };
  }, [kidId]);

  function commitBlocks(next) { setBlocks(next); saveRoutine(kidId, next); }
  function commitRun(next) { setRun(next); saveRun(kidId, next); }

  function awardSticker() {
    var res = earnSticker(stickersRef.current);
    stickersRef.current = res.day;
    setStickers(res.day); saveStickerDay(kidId, res.day);
    chime.sticker();
    if (res.completedSet) {
      setPopSlot(STICKER_SETS[0].items.length - 1);
      setSetParty(res.completedSet);
      later(function () { chime.setDone(); }, 300);
      later(function () { setSetParty(null); setPopSlot(-1); }, 2600);
    } else {
      setPopSlot(res.day.earned.length - 1);
      later(function () { setPopSlot(-1); }, 600);
    }
  }

  // The 🎡 wheel: flicks through ideas with soft ticks, slowing down, then
  // lands. show(text) paints each frame (the break panel by default).
  function spin(onDone, show) {
    var paint = show || setBreakIdea;
    audioReady();
    setSpinning(true);
    var n = 0, max = 16, last = "";
    function step() {
      last = pickBreakIdea(Math.random, last); paint(last); chime.tick(); n++;
      if (n < max) later(step, 60 + n * 14); else { setSpinning(false); if (onDone) onDone(last); }
    }
    if (reducedMotion()) { last = pickBreakIdea(); paint(last); setSpinning(false); if (onDone) onDone(last); return; }
    step();
  }

  function enterBlock(b) {
    if (!b) return;
    if (b.type === "break") {
      chime.brk();
      if (b.breakActivity && b.breakActivity.trim()) setBreakIdea(b.breakActivity.trim()); else spin();
    } else { chime.work(); setBreakIdea(""); }
  }

  // One step of the clock: end the block when time is up; warn near the end.
  function finishCurrent() {
    var r = runRef.current;
    var res = completeCurrent(r, blocksRef.current, Date.now());
    if (res.finishedBlock) {
      setJustDone(res.finishedBlock.id);
      later(function () { setJustDone(null); }, 700);
      if (res.finishedBlock.type === "work") awardSticker();
    }
    runRef.current = res.run;
    commitRun(res.run);
    if (res.next) enterBlock(res.next);
    else { later(function () { chime.allDone(); fireConfetti(); }, 250); }
  }

  useEffect(function () {
    if (!isRunning(run)) return undefined;
    var id = setInterval(function () {
      var t = Date.now();
      setNow(t);
      var r = runRef.current;
      if (!isRunning(r)) return;
      var b = blocksRef.current.filter(function (x) { return x.id === r.blockId; })[0];
      if (timeLeftMs(r, t) <= 0) { finishCurrent(); return; }
      if (!r.warned && isWrapping(b, r, t)) {
        var w = Object.assign({}, r, { warned: true });
        runRef.current = w; commitRun(w); chime.warn();
      }
    }, 250);
    return function () { clearInterval(id); };
  }, [run.blockId, run.pausedLeft, run.finished]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the screen awake while the clock is running (start / resume); let it
  // sleep on pause, finish and reset. Best effort — see rhythmWake.js.
  var wakeRef = useRef(null);
  var runningNow = isRunning(run);
  useEffect(function () {
    if (!wakeRef.current) { try { wakeRef.current = createScreenWake(); } catch { wakeRef.current = null; } }
    var w = wakeRef.current;
    if (w) { try { w.want(runningNow); } catch { /* ignore */ } }
  }, [runningNow]);
  useEffect(function () {
    return function () { var w = wakeRef.current; wakeRef.current = null; if (w) { try { w.dispose(); } catch { /* ignore */ } } };
  }, []);

  // ── controls ──
  function onStartPause() {
    audioReady();
    var t = Date.now();
    if (run.finished) return;
    if (!run.blockId) {
      var first = blocks.filter(function (b) { return !run.done[b.id]; })[0];
      if (!first) return;
      commitRun(startBlock(run, first, t)); setNow(t); enterBlock(first); return;
    }
    if (run.pausedLeft != null) { commitRun(resumeRun(run, t)); setNow(t); }
    else { commitRun(pauseRun(run, t)); setNow(t); }
  }
  function onExtend() { if (run.blockId) { commitRun(extendRun(run)); setNow(Date.now()); } }
  function onSkip() { if (run.blockId) finishCurrent(); }
  function onReset() { commitRun(idleRun(today)); setBreakIdea(""); setNow(Date.now()); }

  // ── derived ──
  var curIdx = -1;
  for (var i = 0; i < blocks.length; i++) if (blocks[i].id === run.blockId) { curIdx = i; break; }
  var cur = curIdx >= 0 ? blocks[curIdx] : null;
  var firstOpen = blocks.filter(function (b) { return !run.done[b.id]; })[0] || blocks[0];
  var shown = cur || firstOpen;
  var left = cur ? timeLeftMs(run, now) : shown.mins * 60000;
  var frac = cur && run.durMs ? Math.max(0, Math.min(1, left / run.durMs)) : 1;
  var wrapping = cur ? isWrapping(cur, run, now) : false;
  var ringColor = shown.type === "break" ? BREAK.full : wrapping ? "#D4A240" : WORK.full;
  var nextBlock = null;
  var from = cur ? curIdx : blocks.indexOf(shown);
  for (var j = from + 1; j < blocks.length; j++) if (!run.done[blocks[j].id]) { nextBlock = blocks[j]; break; }
  var running = isRunning(run);
  var paused = !!run.blockId && run.pausedLeft != null;
  var set = STICKER_SETS[stickers.setIdx % STICKER_SETS.length];
  var slotSet = setParty ? { name: setParty.name, items: setParty.items } : set;
  var slotFilled = setParty ? setParty.items : stickers.earned;
  var doneCount = blocks.filter(function (b) { return run.done[b.id]; }).length;

  return (
    <div className={S} data-testid="rhythm">
      <style>{CSS}</style>

      {/* Today's stickers */}
      <section className={S + "-card"} aria-label="Today's stickers" data-testid="rhythm-stickers" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontFamily: font.heading, fontSize: 19, fontWeight: 600 }}>Collecting: <span style={{ color: WORK.full }}>{slotSet.name}</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: MUTED, fontWeight: 700 }}>{slotFilled.length + " of " + slotSet.items.length}</span>
            <span title="Stickers collected today" data-testid="rhythm-tally" style={{ fontWeight: 800, color: GOLD.ink, background: GOLD.tint, borderRadius: 999, padding: "4px 12px", fontSize: 14, whiteSpace: "nowrap" }}>{deco("🌟 ") + stickers.today.length + " today"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} aria-label={slotFilled.length + " of " + slotSet.items.length + " stickers in the " + slotSet.name + " set"}>
          {slotSet.items.map(function (_x, k) {
            var filled = k < slotFilled.length;
            return <div key={k} className={S + "-slot" + (k === popSlot ? " pop" : "")} aria-hidden="true"
              style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: filled ? WORK.tint : SUNK, border: filled ? "1.5px solid " + WORK.tint : "1.5px dashed rgba(27,43,68,0.25)" }}>{filled ? slotFilled[k] : ""}</div>;
          })}
        </div>
        {setParty && <div role="status" style={{ background: GOLD.tint, color: GOLD.ink, borderRadius: 12, padding: "8px 12px", fontWeight: 700, fontSize: 15, textAlign: "center" }}>{deco("✨ ") + "You finished the " + setParty.name + " set!"}</div>}
        {stickers.completedSets.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {stickers.completedSets.map(function (nm, k) { return <span key={k} style={{ fontSize: 12, fontWeight: 800, background: DONE.tint, color: DONE.ink, borderRadius: 999, padding: "4px 10px" }}>{"✓ " + nm}</span>; })}
          </div>
        )}
      </section>

      {/* The stage: running, or all done */}
      {run.finished ? (
        <section className={S + "-card"} data-testid="rhythm-done" style={{ textAlign: "center", padding: "26px 18px" }}>
          {se && <div className={S + "-pulse"} style={{ fontSize: 48, lineHeight: 1 }} aria-hidden="true">🎉</div>}
          <h2 style={{ fontFamily: font.heading, fontSize: 30, margin: "10px 0 4px", color: NAVY }}>Great work today!</h2>
          <p style={{ color: MUTED, margin: 0, fontSize: 15 }}>{(props.kidName ? props.kidName + " moved" : "You moved") + " through every block — one at a time, start to finish."}</p>
          {stickers.today.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", margin: "14px auto 0", maxWidth: 360 }} aria-label={stickers.today.length + " stickers today"}>
              {stickers.today.map(function (em, k) { return <span key={k} aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: WORK.tint }}>{em}</span>; })}
            </div>
          )}
          <div style={{ marginTop: 18 }}><button type="button" style={btnPrimary} onClick={onReset} data-testid="rhythm-again">Start again</button></div>
        </section>
      ) : (
        <section className={S + "-card"} data-testid="rhythm-stage" style={{ textAlign: "center", padding: "22px 16px" }}>
          <div style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED, fontWeight: 700 }}>
            {cur ? ((paused ? "Paused" : "Now") + " · block " + (curIdx + 1) + " of " + blocks.length) : (doneCount ? "Ready for the next block" : "Ready when you are")}
          </div>
          <div style={{ position: "relative", width: 230, height: 230, maxWidth: "100%", margin: "12px auto 4px" }}>
            <svg viewBox="0 0 240 240" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }} aria-hidden="true">
              <circle cx="120" cy="120" r={R} fill="none" stroke={SUNK} strokeWidth="14" />
              <circle className={S + "-ring-fg"} data-testid="rhythm-ring" data-ring={shown.type === "break" ? "break" : wrapping ? "wrap" : "work"} cx="120" cy="120" r={R} fill="none" stroke={ringColor} strokeWidth="14" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: "0 26px" }}>
              <div style={{ fontFamily: font.heading, fontSize: 23, fontWeight: 600, lineHeight: 1.1, overflowWrap: "anywhere" }} data-testid="rhythm-now">{shown.name}</div>
              <div role="timer" aria-label={fmt(left) + " left"} style={{ fontSize: 46, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.05 }}>{fmt(left)}</div>
              <div style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED, fontWeight: 700 }}>{shown.type === "break" ? "Movement break" : "Work block"}</div>
            </div>
          </div>

          {cur && cur.type === "work" && cur.note.trim() && (
            <div data-testid="rhythm-note" style={{ margin: "8px auto 0", maxWidth: 420, background: GOLD.tint, color: GOLD.ink, borderRadius: 14, padding: "9px 14px", textAlign: "left", fontSize: 15, lineHeight: 1.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              <span style={{ display: "block", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 800, opacity: 0.85 }}>Assignment</span>{cur.note}
            </div>
          )}
          {cur && cur.type === "break" && (
            <div data-testid="rhythm-break" style={{ margin: "8px auto 0", maxWidth: 420, background: BREAK.tint, color: BREAK.ink, borderRadius: 16, padding: "14px 15px" }}>
              <span style={{ display: "block", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 800, opacity: 0.85, marginBottom: 4 }}>{cur.breakActivity.trim() ? "Movement break" : deco("🎡 ") + "Spin the wheel — movement break"}</span>
              <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3, minHeight: "1.3em" }} aria-live="polite">{breakIdea}</div>
              <button type="button" disabled={spinning} onClick={function () { spin(); }} style={Object.assign({}, btn, { minHeight: 38, marginTop: 10, background: "#D4A240", borderColor: "#D4A240", color: "#FFFFFF", opacity: spinning ? 0.7 : 1 })}>{deco("🎡 ") + "Spin again"}</button>
            </div>
          )}

          <div style={{ marginTop: 10, color: MUTED, fontSize: 15, minHeight: "1.3em" }}>
            {nextBlock ? <span>Next: <b style={{ color: NAVY }}>{nextBlock.name}</b>{" · " + nextBlock.mins + " min"}</span> : "Last block — you're almost there" + deco(" 🌊")}
          </div>
          {wrapping && (
            <div role="status" data-testid="rhythm-wrap" style={{ margin: "12px auto 0", maxWidth: 360, background: GOLD.tint, color: GOLD.ink, borderRadius: 14, padding: "9px 14px", fontSize: 15, fontWeight: 700 }}>{deco("🌾 ") + "Almost time to switch — start wrapping up"}</div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 18 }}>
            <button type="button" style={btnPrimary} onClick={onStartPause} data-testid="rhythm-start">{running ? "Pause" : paused ? "Resume" : "Start"}</button>
            <button type="button" style={Object.assign({}, btn, { opacity: cur ? 1 : 0.45 })} disabled={!cur} onClick={onExtend} data-testid="rhythm-extend">+5 min</button>
            <button type="button" style={Object.assign({}, btn, { opacity: cur ? 1 : 0.45 })} disabled={!cur} onClick={onSkip} data-testid="rhythm-skip">Skip ›</button>
            <button type="button" style={Object.assign({}, btn, { opacity: (cur || doneCount) ? 1 : 0.45 })} disabled={!cur && !doneCount} onClick={onReset} data-testid="rhythm-reset">Reset</button>
          </div>
        </section>
      )}

      {/* The blocks */}
      <section aria-label="Blocks">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "4px 2px 10px" }}>
          <h3 style={{ fontFamily: font.heading, fontSize: 21, margin: 0, color: NAVY }}>The blocks</h3>
          <span style={{ color: MUTED, fontSize: 14 }}>{totalMins(blocks) + " min total"}</span>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {blocks.map(function (b, k) {
            var isBreak = b.type === "break", isDone = !!run.done[b.id], isCur = b.id === run.blockId;
            var bg = isDone ? DONE.tint : isBreak ? BREAK.tint : SURFACE;
            var border = isDone ? "1.5px solid " + DONE.full : isCur ? "2px solid " + (isBreak ? BREAK.full : WORK.full) : isBreak ? "1.5px dashed " + BREAK.full : "1px solid " + LINE;
            return (
              <li key={b.id} className={S + "-row" + (justDone === b.id ? " settle" : "")} data-testid={"rhythm-block-" + k} data-state={isDone ? "done" : isCur ? "current" : "todo"}
                style={{ background: bg, border: border, borderRadius: 16, padding: "10px 10px 10px 8px", display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", margin: isBreak ? "0 12px" : 0, minWidth: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: "0 0 auto" }}>
                  <button type="button" aria-label={"Move " + b.name + " up"} disabled={k === 0} onClick={function () { commitBlocks(moveBlock(blocks, k, -1)); }} style={Object.assign({}, smallBtn, { width: 28, height: 22, fontSize: 11, opacity: k === 0 ? 0.3 : 1 })}>▲</button>
                  <button type="button" aria-label={"Move " + b.name + " down"} disabled={k === blocks.length - 1} onClick={function () { commitBlocks(moveBlock(blocks, k, 1)); }} style={Object.assign({}, smallBtn, { width: 28, height: 22, fontSize: 11, opacity: k === blocks.length - 1 ? 0.3 : 1 })}>▼</button>
                </div>
                <div aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, background: isDone ? DONE.full : isBreak ? "#FFFFFF" : WORK.tint, color: isDone ? "#FFFFFF" : NAVY, fontWeight: 900 }}>{isDone ? "✓" : se ? (isBreak ? "🎡" : "✏️") : String(k + 1)}</div>
                <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input value={b.name} aria-label="Block name" maxLength={60} onChange={function (e) { commitBlocks(updateBlock(blocks, b.id, { name: e.target.value })); }}
                      style={{ fontWeight: 700, border: "none", borderBottom: "1.5px solid transparent", background: "transparent", fontFamily: font.body, fontSize: 16, color: isDone ? DONE.ink : NAVY, minWidth: 0, flex: "1 1 auto", padding: "2px 0" }} />
                    {!isBreak && !isDone && <button type="button" aria-expanded={!!openNote[b.id]} aria-label={"Assignment details for " + b.name} onClick={function () { var o = Object.assign({}, openNote); o[b.id] = !o[b.id]; setOpenNote(o); }} style={Object.assign({}, smallBtn, { width: 28, height: 28, background: openNote[b.id] ? WORK.tint : "transparent" })}>{openNote[b.id] ? "▾" : "⊕"}</button>}
                  </div>
                  <div style={{ fontSize: 12, color: isDone ? DONE.ink : MUTED, letterSpacing: ".04em", textTransform: "uppercase", fontWeight: 700, marginTop: 1 }}>{isDone ? "Done" : isBreak ? "Movement break · " + b.mins + " min" : (b.note.trim() ? "Work · has details" : "Work block") + " · " + b.mins + " min"}</div>
                </div>
                {isDone ? (
                  <span style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 800, color: "#FFFFFF", background: DONE.full, padding: "5px 10px", borderRadius: 999, alignSelf: "center" }}>✓ Done</span>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" title="Switch work ⇄ break" aria-label={"Make " + b.name + " a " + (isBreak ? "work block" : "break")} disabled={isCur} onClick={function () { commitBlocks(toggleBlockType(blocks, b.id)); }}
                      style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 800, padding: "6px 10px", borderRadius: 999, border: "1px solid " + LINE, background: SUNK, color: MUTED, opacity: isCur ? 0.45 : 1 }}>{isBreak ? "Break" : "Work"}</button>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <button type="button" aria-label={"Fewer minutes for " + b.name} onClick={function () { commitBlocks(updateBlock(blocks, b.id, { mins: Math.max(MIN_MINS, b.mins - 5) })); }} style={smallBtn}>−</button>
                      <span style={{ minWidth: 44, textAlign: "center", fontWeight: 800, fontVariantNumeric: "tabular-nums", fontSize: 15 }}>{b.mins}<small style={{ display: "block", fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginTop: -2 }}>min</small></span>
                      <button type="button" aria-label={"More minutes for " + b.name} onClick={function () { commitBlocks(updateBlock(blocks, b.id, { mins: Math.min(MAX_MINS, b.mins + 5) })); }} style={smallBtn}>+</button>
                    </div>
                    <button type="button" aria-label={"Remove " + b.name} disabled={blocks.length <= 1 || isCur} onClick={function () { commitBlocks(removeBlock(blocks, b.id)); }} style={Object.assign({}, smallBtn, { background: "transparent", border: "1px solid transparent", fontSize: 18, opacity: (blocks.length <= 1 || isCur) ? 0.3 : 1 })}>×</button>
                  </div>
                )}
                {!isBreak && !isDone && openNote[b.id] && (
                  <div style={{ flexBasis: "100%", margin: "2px 2px 2px 44px", minWidth: 0 }}>
                    <textarea value={b.note} maxLength={500} aria-label={"Assignment for " + b.name} placeholder="e.g. This week's spelling words, or workbook pages 2–6…"
                      onChange={function (e) { commitBlocks(updateBlock(blocks, b.id, { note: e.target.value })); }}
                      style={{ width: "100%", boxSizing: "border-box", fontFamily: font.body, fontSize: 15, color: NAVY, background: SUNK, border: "1px solid " + LINE, borderRadius: 12, padding: "9px 11px", minHeight: 52, lineHeight: 1.4, resize: "vertical" }} />
                    <div style={{ fontSize: 12, color: MUTED, margin: "4px 2px 0" }}>Shows on screen while this block is running.</div>
                  </div>
                )}
                {isBreak && !isDone && (
                  <div style={{ flexBasis: "100%", margin: "2px 2px 0 44px", display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                    <input value={listSpin && listSpin.id === b.id ? listSpin.text : b.breakActivity} maxLength={160} aria-label={"Movement for " + b.name} placeholder="Spin the wheel"
                      onChange={function (e) { commitBlocks(updateBlock(blocks, b.id, { breakActivity: e.target.value })); }}
                      style={{ flex: "1 1 auto", minWidth: 0, fontFamily: font.body, fontSize: 15, color: BREAK.ink, background: "rgba(255,255,255,.7)", border: "1px solid " + BREAK.full, borderRadius: 999, padding: "7px 13px" }} />
                    <button type="button" disabled={spinning} onClick={function () { spin(function (v) { setListSpin(null); commitBlocks(updateBlock(blocksRef.current, b.id, { breakActivity: v })); }, function (t) { setListSpin({ id: b.id, text: t }); }); }}
                      style={{ flex: "0 0 auto", border: "none", borderRadius: 999, padding: "8px 14px", fontWeight: 800, fontSize: 14, background: "#D4A240", color: "#FFFFFF", whiteSpace: "nowrap" }}>{deco("🎡 ") + "Spin"}</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" data-testid="rhythm-add-subject" onClick={function () { var nb = normalizeBlock({ id: newBlockId(), name: "New subject", mins: 20, type: "work" }); var o = Object.assign({}, openNote); o[nb.id] = true; setOpenNote(o); commitBlocks(blocks.concat([nb])); }}
            style={Object.assign({}, btn, { flex: "1 1 140px", border: "1.5px dashed rgba(27,43,68,0.3)", background: "transparent", color: MUTED })}>+ Subject</button>
          <button type="button" data-testid="rhythm-add-break" onClick={function () { commitBlocks(blocks.concat([normalizeBlock({ id: newBlockId(), name: "Break", mins: 10, type: "break" })])); }}
            style={Object.assign({}, btn, { flex: "1 1 140px", border: "1.5px dashed " + BREAK.full, background: "transparent", color: BREAK.ink })}>+ Break</button>
        </div>
        <p style={{ marginTop: 14, color: MUTED, fontSize: 13, lineHeight: 1.5, textAlign: "center" }}>{"Reorder with ▲▼ · tap ⊕ on a subject to add the assignment · breaks spin the " + deco("🎡 ") + "wheel · each finished subject earns a sticker. The day's count starts fresh each morning; the set you're collecting carries on."}</p>
      </section>
    </div>
  );
}
