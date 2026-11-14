// src/redesign/RedesignExhale.jsx — the new Exhale screen (af_redesign only).
// Quick-add into Exhaled, five stacked bucket cards (Today open by default,
// one open at a time), and one 14px row per item:
//   circle  -> toggle done (done items drop to the bottom, crossed out)
//   text    -> edit in place (Enter or tap away saves, Escape cancels)
//   move    -> bucket chips, one tap moves
//   swipe   -> right completes, left moves to Tomorrow
// All writes go through exhaleModel.commit (existing af_exhale_buckets key,
// existing fields, same sync path as the current Exhale screen).
import { useState, useEffect, useRef } from "react";
import { color, gradient, radius, shadow, font } from "../design/tokens.js";
import { readBuckets, commit, bucketItems, openCount, bucketName, toggleDone, setDone, moveTo, editText, addItem, BUCKET_COLORS, EXHALED, TODAY, TOMORROW, SWIPE_PX } from "./exhaleModel.js";

var NAVY = color.anchorNavy;
var MUTED = "#5B6472";
var IVORY = gradient.sunset.text;

function uuid() {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch { /* fall through */ }
  return "x-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
function goTab(tab) { try { window.dispatchEvent(new CustomEvent("af-set-tab", { detail: tab })); } catch { /* no window */ } }

function ItemRow(props) {
  var it = props.item;
  var [editing, setEditing] = useState(false);
  var [draft, setDraft] = useState(it.text || "");
  var [dx, setDx] = useState(0);
  var drag = useRef(null);
  var cancelled = useRef(false);

  function startEdit() { if (it.done) return; setDraft(it.text || ""); cancelled.current = false; setEditing(true); }
  function finishEdit() { setEditing(false); if (!cancelled.current) props.onEdit(it.id, draft); }

  function onPointerDown(e) {
    if (editing) return;
    drag.current = { x: e.clientX, y: e.clientY, active: false };
  }
  function onPointerMove(e) {
    var d = drag.current;
    if (!d) return;
    var mx = e.clientX - d.x, my = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) { drag.current = null; setDx(0); return; } // vertical scroll
      if (Math.abs(mx) < 8) return;
      d.active = true;
    }
    setDx(Math.max(-140, Math.min(140, mx)));
  }
  function onPointerUp(e) {
    var d = drag.current;
    drag.current = null;
    if (!d || !d.active) { setDx(0); return; }
    var mx = e.clientX - d.x;
    setDx(0);
    if (mx >= SWIPE_PX) props.onSwipeRight(it.id);
    else if (mx <= -SWIPE_PX) props.onSwipeLeft(it.id);
  }

  var hint = dx > 0 ? "Done" : dx < 0 ? "Tomorrow" : "";
  return (
    <div data-testid={"item-" + it.id} data-done={it.done ? "true" : "false"} style={{ position: "relative", borderRadius: radius.sm, overflow: "hidden" }}>
      {dx !== 0 && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: dx > 0 ? "flex-start" : "flex-end", padding: "0 16px", background: dx > 0 ? gradient.ripples.from : color.tint.blue, color: dx > 0 ? IVORY : NAVY, fontSize: 13, fontWeight: 700 }}>{hint}</div>
      )}
      <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={function () { drag.current = null; setDx(0); }}
        style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, background: "#FFFFFF", borderRadius: radius.sm, boxShadow: shadow.card, padding: "10px 10px 10px 12px", transform: "translateX(" + dx + "px)", transition: dx === 0 ? "transform .18s" : "none", touchAction: "pan-y" }}>
        <button type="button" data-testid="toggle-done" aria-label={it.done ? "Mark not done" : "Mark done"} aria-pressed={!!it.done} onClick={function () { props.onToggle(it.id); }}
          style={{ width: 24, height: 24, flexShrink: 0, borderRadius: "50%", border: "2px solid " + (it.done ? gradient.ripples.from : "rgba(27,43,68,0.35)"), background: it.done ? gradient.ripples.from : "transparent", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {it.done && <span aria-hidden="true" style={{ width: 6, height: 11, borderRight: "2px solid #FFFFFF", borderBottom: "2px solid #FFFFFF", transform: "rotate(45deg)", marginTop: -2 }} />}
        </button>
        {editing ? (
          <input autoFocus value={draft} data-testid="edit-input" aria-label="Edit item"
            onChange={function (e) { setDraft(e.target.value); }}
            onKeyDown={function (e) { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } if (e.key === "Escape") { cancelled.current = true; e.target.blur(); } }}
            onBlur={finishEdit}
            style={{ flex: 1, minWidth: 0, border: "none", borderBottom: "1.5px solid " + gradient.ripples.from, outline: "none", background: "transparent", fontFamily: font.checklistItem.family, fontSize: 16, color: NAVY, padding: "2px 0" }} />
        ) : (
          <span data-testid="item-text" onClick={startEdit}
            style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word", fontFamily: font.checklistItem.family, fontSize: font.checklistItem.size, lineHeight: 1.4, color: it.done ? "rgba(27,43,68,0.45)" : NAVY, textDecoration: it.done ? "line-through" : "none", cursor: it.done ? "default" : "text" }}>{it.text}</span>
        )}
        <button type="button" data-testid="move-btn" aria-label="Move to another bucket" aria-expanded={props.moveOpen} onClick={function () { props.onMoveToggle(it.id); }}
          style={{ flexShrink: 0, background: props.moveOpen ? color.tint.blue : "transparent", border: "1px solid rgba(27,43,68,0.15)", borderRadius: 999, padding: "4px 10px", fontFamily: font.body, fontSize: 12, fontWeight: 600, color: NAVY, cursor: "pointer" }}>Move</button>
      </div>
      {props.moveOpen && (
        <div data-testid="move-chips" style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 2px 2px" }}>
          {props.bucketNames.map(function (n, i) {
            if (i === it.bucketIndex) return null;
            return (
              <button key={i} type="button" data-testid={"chip-" + i} onClick={function () { props.onMove(it.id, i); }}
                style={{ background: "#FFFFFF", border: "1.5px solid " + BUCKET_COLORS[i], color: NAVY, borderRadius: 999, padding: "5px 12px", fontFamily: font.body, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{n}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RedesignExhale(props) {
  var [b, setB] = useState(readBuckets);
  var [openIdx, setOpenIdx] = useState(TODAY);
  var [moveFor, setMoveFor] = useState(null);
  var [draft, setDraft] = useState("");
  var [flash, setFlash] = useState(false);
  var me = props.myPersonId || null;

  useEffect(function () {
    function refresh() { setB(readBuckets()); }
    window.addEventListener("af-data-changed", refresh);
    window.addEventListener("storage", refresh);
    return function () { window.removeEventListener("af-data-changed", refresh); window.removeEventListener("storage", refresh); };
  }, []);

  function apply(fn) { setB(commit(fn)); }
  function onToggle(id) { apply(function (cur) { return toggleDone(cur, id); }); }
  function onEdit(id, text) { apply(function (cur) { return editText(cur, id, text); }); }
  function onMove(id, idx) { setMoveFor(null); apply(function (cur) { return moveTo(cur, id, idx); }); }
  function onSwipeRight(id) { apply(function (cur) { return setDone(cur, id, true); }); }
  function onSwipeLeft(id) { apply(function (cur) { return moveTo(cur, id, TOMORROW); }); }
  function add(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!draft.trim()) return;
    apply(function (cur) { return addItem(cur, draft, EXHALED, uuid, Date.now); });
    setDraft("");
    setFlash(true);
    setTimeout(function () { setFlash(false); }, 2000);
  }

  var names = [0, 1, 2, 3, 4].map(function (i) { return bucketName(b, i); });

  return (
    <div data-testid="redesign-exhale" style={{ background: color.flowBackground, margin: "-1.1rem -0.9rem -0.5rem", padding: "16px 16px calc(28px + env(safe-area-inset-bottom, 0px))", minHeight: "100dvh", boxSizing: "border-box", fontFamily: font.body, color: NAVY, overflowX: "hidden" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={function () { goTab("flowhome"); }} aria-label="Back to Flow"
            style={{ background: "#FFFFFF", border: "none", borderRadius: 999, boxShadow: shadow.card, padding: "7px 14px 7px 12px", fontFamily: font.body, fontSize: 13, fontWeight: 600, color: NAVY, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderLeft: "2px solid " + NAVY, borderBottom: "2px solid " + NAVY, transform: "rotate(45deg)", display: "inline-block" }} />Flow
          </button>
          <h1 style={{ margin: 0, fontFamily: font.heading, fontSize: 28, fontWeight: 700 }}>Exhale</h1>
        </div>

        <form onSubmit={add} style={{ display: "flex", gap: 8, background: "#FFFFFF", borderRadius: radius.lg, boxShadow: shadow.card, padding: 8 }}>
          <input value={draft} onChange={function (e) { setDraft(e.target.value); }} aria-label="Exhale a thought"
            placeholder={flash ? "Exhaled. Let it go." : "What's on your mind?"}
            style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontFamily: font.body, fontSize: 16, color: NAVY, padding: "8px 10px", outline: "none" }} />
          <button type="submit" disabled={!draft.trim()}
            style={{ flexShrink: 0, background: draft.trim() ? NAVY : "rgba(27,43,68,0.25)", color: IVORY, border: "none", borderRadius: radius.sm, padding: "0 16px", fontFamily: font.body, fontWeight: 700, fontSize: 14, cursor: draft.trim() ? "pointer" : "default" }}>Add</button>
        </form>

        {[0, 1, 2, 3, 4].map(function (idx) {
          var open = openIdx === idx;
          var items = bucketItems(b, idx, me);
          var count = openCount(b, idx, me);
          return (
            <section key={idx} data-testid={"bucket-" + idx} style={{ background: color.surface, borderRadius: radius.lg, boxShadow: shadow.card, borderTop: "3px solid " + BUCKET_COLORS[idx], overflow: "hidden" }}>
              <button type="button" aria-expanded={open} onClick={function () { setMoveFor(null); setOpenIdx(open ? null : idx); }}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box", background: "transparent", border: "none", padding: "14px 16px", cursor: "pointer", textAlign: "left", color: NAVY }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: font.heading, fontSize: 21, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names[idx]}</span>
                <span data-testid="open-count" style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: count ? NAVY : MUTED, background: count ? color.tint.sand : "transparent", borderRadius: 999, padding: "2px 9px" }}>{count}</span>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRight: "2px solid " + MUTED, borderBottom: "2px solid " + MUTED, transform: open ? "rotate(225deg)" : "rotate(45deg)", transition: "transform .2s", flexShrink: 0, marginTop: open ? 4 : -4 }} />
              </button>
              {open && (
                <div style={{ padding: "0 12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.length === 0 && (
                    <div style={{ fontFamily: font.heading, fontStyle: "italic", fontSize: 16, color: MUTED, padding: "2px 4px" }}>
                      {idx === EXHALED ? "Nothing here yet. Exhale a thought above." : "Clear. Nothing waiting in " + names[idx] + "."}
                    </div>
                  )}
                  {items.map(function (it) {
                    return <ItemRow key={it.id} item={it} bucketNames={names} moveOpen={moveFor === it.id}
                      onToggle={onToggle} onEdit={onEdit} onMove={onMove} onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft}
                      onMoveToggle={function (id) { setMoveFor(moveFor === id ? null : id); }} />;
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

