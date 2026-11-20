// src/redesign/RedesignExhale.jsx — the new Exhale screen (af_redesign only).
// A big quick-add into Exhaled, then all five buckets at once:
//   desktop (>= 900px): five colored columns side by side
//   phone:              five stacked colored sections, all open
// Each bucket has its own tone (Exhaled sand, Today sage, Tomorrow blue,
// This Weekend teal, Someday mist), a colored top edge and an open count.
//
// Item row:
//   circle  -> toggle done (done items drop to the bottom, crossed out)
//   text    -> expands in place: text, Notes, Due, Who, Bucket, Delete, Done
//   handle  -> tap, then "Drop here" on another bucket (phone)
//   drag    -> drop on another column (desktop, mouse)
//   swipe   -> right completes, left moves to Tomorrow (touch)
// Collapsed rows show small tags for due date, person and notes.
// All writes go through exhaleModel.commit (existing af_exhale_buckets key,
// same sync path as the current Exhale screen).
import { useState, useEffect, useRef } from "react";
import { color, gradient, radius, shadow, font, tone, page, fullBleed } from "../design/tokens.js";
import { readBuckets, commit, bucketItems, openCount, bucketName, toggleDone, setDone, moveTo, editText, addItem, setFields, deleteItem, fields, duePresets, dueLabel, isOverdue, EXHALED, TOMORROW, SWIPE_PX, EVERYONE } from "./exhaleModel.js";
import { personColor, whoOf } from "./flowData.js";

var NAVY = color.anchorNavy;
var MUTED = "#5B6472";
var IVORY = gradient.sunset.text;
// Display tones per bucket. Stored item colors (BUCKET_COLORS) are left alone.
var BUCKET_TONES = [tone.sand, tone.sage, tone.blue, tone.teal, tone.mist];

var CSS =
  ".rx-wrap{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:12px}" +
  ".rx-board{display:flex;flex-direction:column;gap:12px}" +
  "@media (min-width:900px){" +
  ".rx-wrap{max-width:1480px}" +
  ".rx-board{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:start;gap:12px}" +
  ".rx-bucket{min-height:220px}" +
  "}";

function uuid() {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch { /* fall through */ }
  return "x-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
function goTab(tab) { try { window.dispatchEvent(new CustomEvent("af-set-tab", { detail: tab })); } catch { /* no window */ } }
function firstName(p) { return String((p && p.name) || "").trim().split(/\s+/)[0] || "Someone"; }

function chipStyle(on, accent) {
  return {
    display: "inline-flex", alignItems: "center", gap: 6, background: on ? accent : "#FFFFFF", color: on ? "#FFFFFF" : NAVY,
    border: "1.5px solid " + accent, borderRadius: 999, padding: "5px 11px", fontFamily: font.body, fontSize: 12.5, fontWeight: 600, cursor: "pointer", lineHeight: 1.2,
  };
}
function Dot(props) { return <span aria-hidden="true" style={{ width: props.size || 8, height: props.size || 8, borderRadius: "50%", background: props.color, flexShrink: 0, display: "inline-block", border: props.ring ? "1.5px solid #FFFFFF" : "none" }} />; }
function Label(props) { return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: MUTED, margin: "2px 0 6px" }}>{props.children}</div>; }

function Tags(props) {
  var f = props.f;
  var due = dueLabel(f.dueDate, props.now);
  var who = whoOf(f.personId, props.people);
  if (!due && !who && !f.notes.trim()) return null;
  var tag = { display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "2px 8px", lineHeight: 1.4, background: "rgba(27,43,68,0.06)", color: NAVY };
  var late = isOverdue(f.dueDate, props.now);
  return (
    <span data-testid="item-tags" style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
      {due && <span data-testid="tag-due" style={Object.assign({}, tag, late ? { background: "#F6E0DC", color: "#8A3324" } : null)}>{(late ? "Overdue · " : "Due ") + due}</span>}
      {who && <span data-testid="tag-who" style={tag}><Dot color={who.color} />{who.label}</span>}
      {f.notes.trim() && <span data-testid="tag-notes" style={tag}>Notes</span>}
    </span>
  );
}

function Details(props) {
  var it = props.item;
  var f = fields(it);
  var [notes, setNotes] = useState(f.notes);
  var [confirmDel, setConfirmDel] = useState(false);
  var accent = BUCKET_TONES[it.bucketIndex] ? BUCKET_TONES[it.bucketIndex].full : NAVY;
  var presets = duePresets(props.now);
  var matched = presets.filter(function (p) { return p.value === f.dueDate; })[0];
  var people = (props.people || []).filter(function (p) { return p && p.id; });

  useEffect(function () { setNotes(fields(it).notes); }, [it.notes]); // eslint-disable-line

  function saveNotes() { if (notes !== f.notes) props.onFields(it.id, { notes: notes }); }
  function pickWho(id) { props.onFields(it.id, { personId: f.personId === id ? null : id }); }

  return (
    <div data-testid="item-details" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 12px 12px", borderTop: "1px solid rgba(27,43,68,0.08)" }}>
      <div>
        <Label>Notes</Label>
        <textarea data-testid="notes-input" aria-label="Notes" value={notes} rows={2} placeholder="Add a note…"
          onChange={function (e) { setNotes(e.target.value); }} onBlur={saveNotes}
          style={{ width: "100%", boxSizing: "border-box", resize: "vertical", border: "1px solid rgba(27,43,68,0.15)", borderRadius: radius.sm, padding: "8px 10px", fontFamily: font.body, fontSize: 16, color: NAVY, background: "#FFFFFF", outline: "none" }} />
      </div>
      <div>
        <Label>Due</Label>
        <div data-testid="due-chips" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {presets.map(function (p) {
            var on = p.id === "none" ? !f.dueDate : (matched && matched.id === p.id);
            return <button key={p.id} type="button" data-testid={"due-" + p.id} aria-pressed={!!on} onClick={function () { props.onFields(it.id, { dueDate: p.value }); }} style={chipStyle(on, accent)}>{p.label}</button>;
          })}
          <input type="date" data-testid="due-date" aria-label="Pick a due date" value={f.dueDate}
            onChange={function (e) { props.onFields(it.id, { dueDate: e.target.value }); }}
            style={{ border: "1.5px solid " + (f.dueDate && !matched ? accent : "rgba(27,43,68,0.2)"), borderRadius: 999, padding: "4px 10px", fontFamily: font.body, fontSize: 13, color: NAVY, background: "#FFFFFF", minWidth: 0, maxWidth: "100%" }} />
        </div>
      </div>
      <div>
        <Label>Who</Label>
        <div data-testid="who-chips" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {people.map(function (p) {
            var c = personColor(p.id, props.people) || NAVY;
            var on = f.personId === p.id;
            return <button key={p.id} type="button" data-testid={"who-" + p.id} aria-pressed={on} onClick={function () { pickWho(p.id); }} style={chipStyle(on, c)}><Dot color={on ? "#FFFFFF" : c} />{firstName(p)}</button>;
          })}
          <button type="button" data-testid="who-everyone" aria-pressed={f.personId === EVERYONE} onClick={function () { pickWho(EVERYONE); }} style={chipStyle(f.personId === EVERYONE, NAVY)}>
            <Dot color={f.personId === EVERYONE ? "#FFFFFF" : NAVY} />Everyone
          </button>
        </div>
      </div>
      <div>
        <Label>Bucket</Label>
        <div data-testid="bucket-chips" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {props.bucketNames.map(function (n, i) {
            var on = i === it.bucketIndex;
            return <button key={i} type="button" data-testid={"chip-" + i} aria-pressed={on} onClick={function () { if (!on) props.onMove(it.id, i); }} style={chipStyle(on, BUCKET_TONES[i].full)}>{n}</button>;
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", paddingTop: 2 }}>
        <button type="button" data-testid="delete-btn" onClick={function () { if (confirmDel) props.onDelete(it.id); else setConfirmDel(true); }}
          style={{ background: confirmDel ? "#A8432F" : "transparent", color: confirmDel ? "#FFFFFF" : "#A8432F", border: "1.5px solid #A8432F", borderRadius: 999, padding: "7px 14px", fontFamily: font.body, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {confirmDel ? "Tap again to delete" : "Delete"}
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="done-btn" onClick={function () { props.onDoneBtn(it.id, !it.done); }}
          style={{ background: NAVY, color: IVORY, border: "none", borderRadius: 999, padding: "8px 18px", fontFamily: font.body, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {it.done ? "Not done" : "Done"}
        </button>
      </div>
    </div>
  );
}

function ItemRow(props) {
  var it = props.item;
  var f = fields(it);
  var expanded = props.expanded;
  var [draft, setDraft] = useState(it.text || "");
  var [dx, setDx] = useState(0);
  var drag = useRef(null);
  var cancelled = useRef(false);

  useEffect(function () { if (expanded) { setDraft(it.text || ""); cancelled.current = false; } }, [expanded]); // eslint-disable-line

  function finishEdit() { if (!cancelled.current) props.onEdit(it.id, draft); cancelled.current = false; }

  function onPointerDown(e) {
    if (expanded || e.pointerType === "mouse") return; // mouse drags are drag-and-drop
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
  var moving = props.moving;
  return (
    <div data-testid={"item-" + it.id} data-done={it.done ? "true" : "false"} data-expanded={expanded ? "true" : "false"}
      draggable={!expanded} onDragStart={function (e) { props.onDragStart(e, it.id); }} onDragEnd={props.onDragEnd}
      style={{ position: "relative", borderRadius: radius.sm, overflow: "hidden", background: "#FFFFFF", boxShadow: moving ? "0 0 0 2px " + NAVY : shadow.card, opacity: props.dragging ? 0.45 : 1 }}>
      {dx !== 0 && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: dx > 0 ? "flex-start" : "flex-end", padding: "0 16px", background: dx > 0 ? gradient.ripples.from : color.tint.blue, color: dx > 0 ? IVORY : NAVY, fontSize: 13, fontWeight: 700 }}>{hint}</div>
      )}
      <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={function () { drag.current = null; setDx(0); }}
        style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 10, background: "#FFFFFF", padding: "10px 8px 10px 12px", transform: "translateX(" + dx + "px)", transition: dx === 0 ? "transform .18s" : "none", touchAction: "pan-y" }}>
        <button type="button" data-testid="toggle-done" aria-label={it.done ? "Mark not done" : "Mark done"} aria-pressed={!!it.done} onClick={function () { props.onToggle(it.id); }}
          style={{ width: 24, height: 24, flexShrink: 0, borderRadius: "50%", border: "2px solid " + (it.done ? gradient.ripples.from : "rgba(27,43,68,0.35)"), background: it.done ? gradient.ripples.from : "transparent", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 0 }}>
          {it.done && <span aria-hidden="true" style={{ width: 6, height: 11, borderRight: "2px solid #FFFFFF", borderBottom: "2px solid #FFFFFF", transform: "rotate(45deg)", marginTop: -2 }} />}
        </button>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {expanded ? (
            <input value={draft} data-testid="edit-input" aria-label="Edit item"
              onChange={function (e) { setDraft(e.target.value); }}
              onKeyDown={function (e) { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } if (e.key === "Escape") { cancelled.current = true; setDraft(it.text || ""); e.target.blur(); } }}
              onBlur={finishEdit}
              style={{ width: "100%", boxSizing: "border-box", border: "none", borderBottom: "1.5px solid " + gradient.ripples.from, outline: "none", background: "transparent", fontFamily: font.checklistItem.family, fontSize: 16, color: NAVY, padding: "1px 0" }} />
          ) : (
            <span data-testid="item-text" role="button" tabIndex={0} aria-expanded={false} onClick={function () { props.onExpand(it.id); }}
              onKeyDown={function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); props.onExpand(it.id); } }}
              style={{ overflowWrap: "anywhere", wordBreak: "break-word", fontFamily: font.checklistItem.family, fontSize: font.checklistItem.size, lineHeight: 1.45, color: it.done ? "rgba(27,43,68,0.45)" : NAVY, textDecoration: it.done ? "line-through" : "none", cursor: "pointer", paddingTop: 2 }}>{it.text}</span>
          )}
          {!expanded && <Tags f={f} people={props.people} now={props.now} />}
        </div>
        {expanded ? (
          <button type="button" data-testid="collapse-btn" aria-label="Close details" onClick={function () { props.onExpand(null); }}
            style={{ flexShrink: 0, background: "transparent", border: "1px solid rgba(27,43,68,0.15)", borderRadius: 999, padding: "4px 10px", fontFamily: font.body, fontSize: 12, fontWeight: 600, color: NAVY, cursor: "pointer" }}>Close</button>
        ) : (
          <button type="button" data-testid="move-btn" aria-label={moving ? "Cancel move" : "Move to another bucket"} aria-pressed={moving} onClick={function () { props.onMoveToggle(it.id); }}
            style={{ flexShrink: 0, width: 32, height: 28, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: moving ? NAVY : "transparent", border: "1px solid " + (moving ? NAVY : "rgba(27,43,68,0.15)"), borderRadius: 8, cursor: "pointer", padding: 0 }}>
            {[0, 1, 2].map(function (k) { return <span key={k} aria-hidden="true" style={{ width: 14, height: 2, borderRadius: 1, background: moving ? IVORY : MUTED }} />; })}
          </button>
        )}
      </div>
      {expanded && <Details item={it} people={props.people} now={props.now} bucketNames={props.bucketNames}
        onFields={props.onFields} onMove={props.onMove} onDelete={props.onDelete} onDoneBtn={props.onDoneBtn} />}
    </div>
  );
}

export default function RedesignExhale(props) {
  var [b, setB] = useState(readBuckets);
  var [expandedId, setExpandedId] = useState(null);
  var [moveFor, setMoveFor] = useState(null);
  var [dragId, setDragId] = useState(null);
  var [overIdx, setOverIdx] = useState(null);
  var [draft, setDraft] = useState("");
  var [flash, setFlash] = useState(false);
  var me = props.myPersonId || null;
  var people = Array.isArray(props.people) ? props.people : [];
  var now = props.now ? props.now() : new Date();

  useEffect(function () {
    function refresh() { setB(readBuckets()); }
    window.addEventListener("af-data-changed", refresh);
    window.addEventListener("storage", refresh);
    return function () { window.removeEventListener("af-data-changed", refresh); window.removeEventListener("storage", refresh); };
  }, []);

  useEffect(function () {
    if (!moveFor) return;
    function onKey(e) { if (e.key === "Escape") setMoveFor(null); }
    window.addEventListener("keydown", onKey);
    return function () { window.removeEventListener("keydown", onKey); };
  }, [moveFor]);

  function apply(fn) { setB(commit(fn)); }
  function onToggle(id) { apply(function (cur) { return toggleDone(cur, id); }); }
  function onEdit(id, text) { apply(function (cur) { return editText(cur, id, text); }); }
  function onMove(id, idx) { setMoveFor(null); apply(function (cur) { return moveTo(cur, id, idx); }); }
  function onFields(id, patch) { apply(function (cur) { return setFields(cur, id, patch); }); }
  function onDelete(id) { setExpandedId(null); apply(function (cur) { return deleteItem(cur, id); }); }
  function onDoneBtn(id, done) { setExpandedId(null); apply(function (cur) { return setDone(cur, id, done); }); }
  function onSwipeRight(id) { apply(function (cur) { return setDone(cur, id, true); }); }
  function onSwipeLeft(id) { apply(function (cur) { return moveTo(cur, id, TOMORROW); }); }
  function onExpand(id) { setMoveFor(null); setExpandedId(id); }
  function onMoveToggle(id) { setExpandedId(null); setMoveFor(moveFor === id ? null : id); }
  function onDragStart(e, id) {
    try { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; } catch { /* no dataTransfer (tests) */ }
    setMoveFor(null);
    setDragId(id);
  }
  function onDragEnd() { setDragId(null); setOverIdx(null); }
  function onDrop(e, idx) {
    if (e && e.preventDefault) e.preventDefault();
    var id = dragId;
    try { id = id || e.dataTransfer.getData("text/plain"); } catch { /* no dataTransfer */ }
    setDragId(null); setOverIdx(null);
    if (id) onMove(id, idx);
  }
  function add(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!draft.trim()) return;
    apply(function (cur) { return addItem(cur, draft, EXHALED, uuid, Date.now); });
    setDraft("");
    setFlash(true);
    setTimeout(function () { setFlash(false); }, 2000);
  }

  var names = [0, 1, 2, 3, 4].map(function (i) { return bucketName(b, i); });
  var movingItem = moveFor ? b.items.filter(function (x) { return x && x.id === moveFor; })[0] : null;
  var draggingItem = dragId ? b.items.filter(function (x) { return x && x.id === dragId; })[0] : null;

  return (
    <div data-testid="redesign-exhale" style={Object.assign({ background: page.flow, margin: "-1.1rem -0.9rem -0.5rem", padding: "12px 14px calc(28px + env(safe-area-inset-bottom, 0px))", minHeight: "100dvh", boxSizing: "border-box", fontFamily: font.body, color: NAVY, overflowX: "hidden" }, fullBleed(page.flow))}>
      <style>{CSS}</style>
      <div className="rx-wrap">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={function () { goTab("flowhome"); }} aria-label="Back to Flow"
            style={{ background: "#FFFFFF", border: "none", borderRadius: 999, boxShadow: shadow.card, padding: "7px 14px 7px 12px", fontFamily: font.body, fontSize: 13, fontWeight: 600, color: NAVY, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderLeft: "2px solid " + NAVY, borderBottom: "2px solid " + NAVY, transform: "rotate(45deg)", display: "inline-block" }} />Flow
          </button>
          <h1 style={{ margin: 0, fontFamily: font.heading, fontSize: 28, fontWeight: 700 }}>Exhale</h1>
        </div>

        <form onSubmit={add} data-testid="exhale-quickadd" style={{ display: "flex", gap: 10, background: "#FFFFFF", borderRadius: radius.lg, boxShadow: shadow.raised || shadow.card, padding: 10, borderLeft: "5px solid " + BUCKET_TONES[EXHALED].full }}>
          <input value={draft} onChange={function (e) { setDraft(e.target.value); }} aria-label="Exhale a thought"
            placeholder={flash ? "Exhaled. Let it go." : "What's on your mind?"}
            style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontFamily: font.body, fontSize: 19, color: NAVY, padding: "12px 10px", outline: "none" }} />
          <button type="submit" disabled={!draft.trim()}
            style={{ flexShrink: 0, background: draft.trim() ? NAVY : "rgba(27,43,68,0.25)", color: IVORY, border: "none", borderRadius: radius.sm, padding: "0 22px", fontFamily: font.body, fontWeight: 700, fontSize: 15, cursor: draft.trim() ? "pointer" : "default" }}>Exhale</button>
        </form>

        {movingItem && (
          <div data-testid="move-banner" role="status" style={{ display: "flex", alignItems: "center", gap: 10, background: NAVY, color: IVORY, borderRadius: radius.sm, padding: "9px 12px", fontSize: 13, position: "sticky", top: "var(--af-nav-h, env(safe-area-inset-top, 0px))", zIndex: 2 }}>
            <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>Moving “{movingItem.text}”. Tap Drop here on a bucket.</span>
            <button type="button" onClick={function () { setMoveFor(null); }} style={{ flexShrink: 0, background: "transparent", color: IVORY, border: "1px solid rgba(242,234,216,0.5)", borderRadius: 999, padding: "4px 12px", fontFamily: font.body, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
          </div>
        )}

        <div className="rx-board" data-testid="exhale-board">
          {[0, 1, 2, 3, 4].map(function (idx) {
            var t = BUCKET_TONES[idx];
            var items = bucketItems(b, idx, me);
            var count = openCount(b, idx, me);
            var dropTarget = (movingItem && movingItem.bucketIndex !== idx) || (draggingItem && draggingItem.bucketIndex !== idx);
            var over = overIdx === idx && draggingItem && draggingItem.bucketIndex !== idx;
            return (
              <section key={idx} className="rx-bucket" data-testid={"bucket-" + idx} aria-label={names[idx]}
                onDragOver={function (e) { if (!dragId) return; e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
                onDragLeave={function (e) { if (overIdx === idx && !(e.currentTarget.contains && e.relatedTarget && e.currentTarget.contains(e.relatedTarget))) setOverIdx(null); }}
                onDrop={function (e) { onDrop(e, idx); }}
                style={{ background: t.tint, borderRadius: radius.lg, boxShadow: over ? "0 0 0 3px " + t.full : shadow.card, borderTop: "5px solid " + t.full, overflow: "hidden", minWidth: 0, transition: "box-shadow .15s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px 9px 14px" }}>
                  <h2 style={{ flex: 1, minWidth: 0, margin: 0, fontFamily: font.heading, fontSize: 21, fontWeight: 700, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{names[idx]}</h2>
                  <span data-testid="open-count" aria-label={count + " open"} style={{ flexShrink: 0, minWidth: 22, textAlign: "center", boxSizing: "border-box", fontSize: 12, fontWeight: 700, color: count ? "#FFFFFF" : t.ink, background: count ? t.full : "rgba(255,255,255,0.6)", borderRadius: 999, padding: "2px 8px" }}>{count}</span>
                </div>
                <div style={{ padding: "0 10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {movingItem && movingItem.bucketIndex !== idx && (
                    <button type="button" data-testid={"drop-" + idx} onClick={function () { onMove(movingItem.id, idx); }}
                      style={{ background: "rgba(255,255,255,0.7)", border: "2px dashed " + t.full, borderRadius: radius.sm, padding: "12px 10px", fontFamily: font.body, fontSize: 14, fontWeight: 700, color: t.ink, cursor: "pointer" }}>Drop here</button>
                  )}
                  {draggingItem && dropTarget && !movingItem && (
                    <div aria-hidden="true" style={{ border: "2px dashed " + t.full, borderRadius: radius.sm, padding: "10px", textAlign: "center", fontSize: 13, fontWeight: 700, color: t.ink, background: over ? "rgba(255,255,255,0.8)" : "transparent" }}>Drop here</div>
                  )}
                  {items.length === 0 && (
                    <div style={{ fontFamily: font.heading, fontStyle: "italic", fontSize: 15, color: MUTED, padding: "2px 4px" }}>
                      {idx === EXHALED ? "Nothing here yet. Exhale a thought above." : "Clear. Nothing waiting in " + names[idx] + "."}
                    </div>
                  )}
                  {items.map(function (it) {
                    return <ItemRow key={it.id} item={it} bucketNames={names} people={people} now={now}
                      expanded={expandedId === it.id} moving={moveFor === it.id} dragging={dragId === it.id}
                      onToggle={onToggle} onEdit={onEdit} onMove={onMove} onFields={onFields} onDelete={onDelete} onDoneBtn={onDoneBtn}
                      onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} onExpand={onExpand} onMoveToggle={onMoveToggle}
                      onDragStart={onDragStart} onDragEnd={onDragEnd} />;
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
