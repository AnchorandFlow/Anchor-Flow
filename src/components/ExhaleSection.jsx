import { useState, useEffect } from "react";

var CARD_COLORS = [
  { id: "seafoam", bg: "#C2E8DA", bd: "#85BFAB", tx: "#1C3A2E" },
  { id: "aqua",    bg: "#B2E0E8", bd: "#6ABEC8", tx: "#143640" },
  { id: "sage",    bg: "#C4D8B8", bd: "#8AB878", tx: "#243A1A" },
  { id: "cobalt",  bg: "#B8C8E8", bd: "#7898C8", tx: "#1A2E50" },
  { id: "amber",   bg: "#E8D8A8", bd: "#C4A860", tx: "#3A2C10" },
  { id: "lav",     bg: "#D0C8E8", bd: "#A098C8", tx: "#2A2248" },
];

var COLS   = ["inbox", "decide", "do", "waiting", "someday"];
var NAVY   = "#1B2E4F";
var _nid   = Date.now();
var LS_G   = "af_exhale_groups";   // own localStorage — bypasses household sync
var LS_L   = "af_exhale_labels";

var DEFAULT_LABELS = {
  inbox:   "🌊 On My Mind",
  decide:  "🤔 Needs a Decision",
  do:      "✅ Ready for Action",
  waiting: "⏳ Waiting on Others",
  someday: "🌱 Maybe Later",
};

// ─── helpers ──────────────────────────────────────────────────────────────
function getColor(id) {
  for (var i = 0; i < CARD_COLORS.length; i++) {
    if (CARD_COLORS[i].id === id) return CARD_COLORS[i];
  }
  return CARD_COLORS[0];
}

function emptyGroups() {
  return { inbox: [], decide: [], do: [], waiting: [], someday: [] };
}

function groupItems(raw) {
  var g = emptyGroups();
  if (!raw || !Array.isArray(raw)) return g;
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var cat, entry;
    if (typeof item === "string") {
      cat   = "inbox";
      entry = { id: "lg-" + i, text: item, notes: "", color: CARD_COLORS[i % CARD_COLORS.length].id, category: "inbox", createdAt: Date.now() };
    } else {
      cat   = (item.category && g[item.category]) ? item.category : "inbox";
      entry = { id: item.id || ("e-" + i), text: item.text || "", notes: item.notes || "", color: item.color || CARD_COLORS[i % CARD_COLORS.length].id, category: cat, createdAt: item.createdAt || Date.now() };
    }
    g[cat].push(entry);
  }
  return g;
}

function clone(g) {
  var n = {};
  for (var i = 0; i < COLS.length; i++) n[COLS[i]] = g[COLS[i]].slice();
  return n;
}

function findIn(g, id) {
  for (var i = 0; i < COLS.length; i++) {
    for (var j = 0; j < g[COLS[i]].length; j++) {
      if (g[COLS[i]][j].id === id) return { col: COLS[i], card: g[COLS[i]][j] };
    }
  }
  return null;
}

function lsGet(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e) { return fallback; }
}

function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}

// ─── component ────────────────────────────────────────────────────────────
// Props:
//   initialItems — brainItems from household (used ONLY if af_exhale_groups is empty)
//   initialLabels — exhaleLabels from household (used ONLY if af_exhale_labels is empty)
//   NOTE: this component intentionally bypasses the household sync to prevent
//         triggering the Supabase reload loop. Re-enable onSave once that is fixed.
export default function ExhaleSection(props) {
  var initialItems  = props.initialItems  || [];
  var initialLabels = props.initialLabels || {};

  var [groups,     setGroups]     = useState(function() {
    var saved = lsGet(LS_G, null);
    return saved || groupItems(initialItems);
  });
  var [colLabels,  setColLabels]  = useState(function() {
    var saved = lsGet(LS_L, null);
    return saved || Object.assign({}, DEFAULT_LABELS, initialLabels);
  });
  var [selectedId, setSelectedId] = useState(null);
  var [noteText,   setNoteText]   = useState("");
  var [inputText,  setInputText]  = useState("");
  var [editingCol, setEditingCol] = useState(null);
  var [drag,       setDrag]       = useState(null);
  var [dropOver,   setDropOver]   = useState(null);

  useEffect(function() {
    if (!selectedId) { setNoteText(""); return; }
    var f = findIn(groups, selectedId);
    setNoteText(f ? f.card.notes : "");
  }, [selectedId]);

  function persist(newGroups, newLabels) {
    lsSet(LS_G, newGroups);
    lsSet(LS_L, newLabels);
  }

  var total = 0;
  for (var ci = 0; ci < COLS.length; ci++) total += groups[COLS[ci]].length;
  var sel = selectedId ? findIn(groups, selectedId) : null;

  // ── add ──────────────────────────────────────────────────────────────────
  function handleAdd() {
    var txt = inputText.trim();
    if (!txt) return;
    var item = { id: "e" + (_nid++), text: txt, notes: "", color: CARD_COLORS[groups.inbox.length % CARD_COLORS.length].id, category: "inbox", createdAt: Date.now() };
    var ng = clone(groups);
    ng.inbox = [item].concat(ng.inbox);
    setGroups(ng);
    setInputText("");
    persist(ng, colLabels);
  }

  function handleInputKeyDown(e) { if (e.key === "Enter") handleAdd(); }

  // ── detail actions ────────────────────────────────────────────────────────
  function handleDone() {
    if (!selectedId) { setSelectedId(null); return; }
    var ng = clone(groups);
    for (var i = 0; i < COLS.length; i++) {
      for (var j = 0; j < ng[COLS[i]].length; j++) {
        if (ng[COLS[i]][j].id === selectedId) {
          ng[COLS[i]][j] = Object.assign({}, ng[COLS[i]][j], { notes: noteText });
          break;
        }
      }
    }
    setGroups(ng);
    setSelectedId(null);
    persist(ng, colLabels);
  }

  function handleColorChange(cardId, colorId) {
    var ng = clone(groups);
    for (var i = 0; i < COLS.length; i++) {
      for (var j = 0; j < ng[COLS[i]].length; j++) {
        if (ng[COLS[i]][j].id === cardId) { ng[COLS[i]][j] = Object.assign({}, ng[COLS[i]][j], { color: colorId }); break; }
      }
    }
    setGroups(ng);
    persist(ng, colLabels);
  }

  function handleMoveToCol(cardId, toCol) {
    var ng = clone(groups);
    var moved = null;
    for (var i = 0; i < COLS.length; i++) {
      for (var j = 0; j < ng[COLS[i]].length; j++) {
        if (ng[COLS[i]][j].id === cardId) { moved = ng[COLS[i]].splice(j, 1)[0]; break; }
      }
      if (moved) break;
    }
    if (moved) ng[toCol].unshift(Object.assign({}, moved, { category: toCol }));
    setGroups(ng);
    persist(ng, colLabels);
  }

  function handleDelete(cardId) {
    var ng = clone(groups);
    for (var i = 0; i < COLS.length; i++) {
      ng[COLS[i]] = ng[COLS[i]].filter(function(c) { return c.id !== cardId; });
    }
    setGroups(ng);
    setSelectedId(null);
    persist(ng, colLabels);
  }

  function handleLabelSave(col, val) {
    var nl = Object.assign({}, colLabels, { [col]: val });
    setColLabels(nl);
    setEditingCol(null);
    persist(groups, nl);
  }

  // ── drag ─────────────────────────────────────────────────────────────────
  function handleDragStart(e, cardId, col) {
    setDrag({ id: cardId, fromCol: col });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text", cardId);
  }

  function handleDragEnd() { setDrag(null); setDropOver(null); }

  function handleCardDragOver(e, cardId) {
    if (!drag || drag.id === cardId) return;
    e.preventDefault(); e.stopPropagation();
    var rect = e.currentTarget.getBoundingClientRect();
    setDropOver({ type: "card", id: cardId, above: e.clientY < rect.top + rect.height / 2 });
  }

  function handleColDragOver(e, col) {
    e.preventDefault();
    if (dropOver && dropOver.type === "card") return;
    setDropOver({ type: "col", col: col });
  }

  function handleCardDrop(e, cardId, col) {
    e.preventDefault(); e.stopPropagation();
    if (!drag || drag.id === cardId) return;
    var above = (dropOver && dropOver.id === cardId) ? dropOver.above : true;
    var ng = clone(groups);
    var fi = -1;
    for (var i = 0; i < ng[drag.fromCol].length; i++) { if (ng[drag.fromCol][i].id === drag.id) { fi = i; break; } }
    if (fi === -1) { setDrag(null); setDropOver(null); return; }
    var moved = Object.assign({}, ng[drag.fromCol].splice(fi, 1)[0], { category: col });
    var ti = -1;
    for (var j = 0; j < ng[col].length; j++) { if (ng[col][j].id === cardId) { ti = j; break; } }
    if (ti === -1) ti = ng[col].length;
    ng[col].splice(above ? ti : ti + 1, 0, moved);
    setGroups(ng); setDrag(null); setDropOver(null);
    persist(ng, colLabels);
  }

  function handleColDrop(e, col) {
    e.preventDefault();
    if (!drag) return;
    var ng = clone(groups);
    var fi = -1;
    for (var i = 0; i < ng[drag.fromCol].length; i++) { if (ng[drag.fromCol][i].id === drag.id) { fi = i; break; } }
    if (fi === -1) { setDrag(null); setDropOver(null); return; }
    var moved = Object.assign({}, ng[drag.fromCol].splice(fi, 1)[0], { category: col });
    ng[col].push(moved);
    setGroups(ng); setDrag(null); setDropOver(null);
    persist(ng, colLabels);
  }

  // ── styles ────────────────────────────────────────────────────────────────
  var br  = "0.5px solid var(--color-border-tertiary,#e0e0e0)";
  var bgS = "var(--color-background-secondary,#f8f8f8)";
  var bgP = "var(--color-background-primary,#fff)";
  var txP = "var(--color-text-primary,#111)";
  var txS = "var(--color-text-secondary,#666)";

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  if (sel) {
    var card = sel.card;
    var cc = getColor(card.color);
    return (
      <div style={{ fontFamily: "var(--font-sans,sans-serif)" }}>
        <div style={{ background: cc.bg, borderBottom: "0.5px solid " + cc.bd, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={handleDone} style={{ background: "rgba(0,0,0,0.1)", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: cc.tx }}>
            ← Back
          </button>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: cc.tx, lineHeight: 1.3 }}>{card.text}</span>
        </div>

        <div style={{ padding: "14px 14px 10px" }}>
          <div style={{ fontSize: 11, color: txS, marginBottom: 5 }}>Notes</div>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Context, deadline, links..." rows={4}
            style={{ width: "100%", border: br, borderRadius: 8, padding: "9px 11px", fontSize: 13, resize: "none", background: bgP, color: txP, lineHeight: 1.5, fontFamily: "inherit" }} />
        </div>

        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 11, color: txS, marginBottom: 7 }}>Color</div>
          <div style={{ display: "flex", gap: 8 }}>
            {CARD_COLORS.map(function(cl) {
              return <div key={cl.id} onClick={() => handleColorChange(card.id, cl.id)}
                style={{ width: 26, height: 26, borderRadius: "50%", background: cl.bg, border: "2px solid " + (cl.id === card.color ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.12)"), cursor: "pointer" }} />;
            })}
          </div>
        </div>

        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 11, color: txS, marginBottom: 7 }}>Move to</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {COLS.map(function(col) {
              var isHere = col === sel.col;
              return <button key={col} onClick={() => handleMoveToCol(card.id, col)}
                style={{ textAlign: "left", padding: "7px 11px", borderRadius: 7, border: br, background: isHere ? NAVY : bgS, color: isHere ? "white" : txP, fontSize: 12, cursor: isHere ? "default" : "pointer", fontWeight: isHere ? 500 : 400 }}>
                {colLabels[col]}
              </button>;
            })}
          </div>
        </div>

        <div style={{ padding: "0 14px 16px", borderTop: br, paddingTop: 12 }}>
          <button onClick={() => handleDelete(card.id)}
            style={{ width: "100%", padding: 8, borderRadius: 7, border: "0.5px solid rgba(180,0,0,0.3)", background: "rgba(180,0,0,0.06)", color: "#8B0000", fontSize: 12, cursor: "pointer" }}>
            ✕ Delete this card
          </button>
        </div>
      </div>
    );
  }

  // ── KANBAN VIEW ───────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "var(--font-sans,sans-serif)", fontSize: 13 }}>
      <div style={{ background: NAVY, padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
        <span>💨</span>
        <span style={{ color: "#E8C76A" }}>Exhale</span>
        <span style={{ marginLeft: "auto", fontSize: 10 }}>{total} items</span>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "11px 12px", borderBottom: br, background: bgS }}>
        <input value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleInputKeyDown}
          placeholder="What's on your mind? Drop it here."
          style={{ flex: 1, padding: "8px 11px", fontSize: 13, border: br, borderRadius: 8, background: bgP, color: txP }} />
        <button onClick={handleAdd} style={{ background: NAVY, color: "white", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12, cursor: "pointer" }}>+ Add</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", minHeight: 200 }}>
        {COLS.map(function(col, ci) {
          var isColTarget = dropOver && dropOver.type === "col" && dropOver.col === col;
          return (
            <div key={col}
              onDragOver={(e) => handleColDragOver(e, col)}
              onDrop={(e) => handleColDrop(e, col)}
              onDragLeave={() => setDropOver(null)}
              style={{ padding: "10px 6px", borderRight: ci < 4 ? br : "none", background: isColTarget ? "rgba(27,46,79,0.04)" : "transparent" }}>

              <div style={{ marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 3 }}>
                {editingCol === col ? (
                  <input autoFocus value={colLabels[col]}
                    onChange={(e) => setColLabels(function(p) { return Object.assign({}, p, { [col]: e.target.value }); })}
                    onBlur={(e) => handleLabelSave(col, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") handleLabelSave(col, e.target.value); }}
                    style={{ flex: 1, fontSize: 10, fontWeight: 500, border: "none", background: "transparent", color: txP, outline: "none", borderBottom: "1.5px solid " + NAVY, padding: "0 0 1px 0", fontFamily: "inherit" }} />
                ) : (
                  <span onClick={() => setEditingCol(col)} title="Click to rename"
                    style={{ flex: 1, fontSize: 10, fontWeight: 500, color: txS, cursor: "text", lineHeight: 1.3 }}>
                    {colLabels[col]}
                  </span>
                )}
                <span style={{ background: bgS, borderRadius: 8, padding: "1px 4px", fontSize: 9, color: "var(--color-text-tertiary,#aaa)", flexShrink: 0 }}>
                  {groups[col].length}
                </span>
              </div>

              {groups[col].map(function(card) {
                var c = getColor(card.color);
                var isDrag  = drag && drag.id === card.id;
                var isAbove = dropOver && dropOver.type === "card" && dropOver.id === card.id && dropOver.above;
                var isBelow = dropOver && dropOver.type === "card" && dropOver.id === card.id && !dropOver.above;
                var cs = { borderRadius: 7, padding: "7px 8px", marginBottom: 5, fontSize: 11.5, lineHeight: 1.4, cursor: "pointer", borderWidth: "0.5px", borderStyle: "solid", background: c.bg, borderColor: c.bd, color: c.tx, opacity: isDrag ? 0.25 : 1 };
                if (isAbove) cs.borderTop    = "2.5px solid " + NAVY;
                if (isBelow) cs.borderBottom = "2.5px solid " + NAVY;
                return (
                  <div key={card.id} draggable
                    onDragStart={(e) => handleDragStart(e, card.id, col)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleCardDragOver(e, card.id)}
                    onDrop={(e) => handleCardDrop(e, card.id, col)}
                    onClick={() => setSelectedId(card.id)}
                    style={cs}>
                    <div style={{ fontSize: 11.5, lineHeight: 1.4 }}>{card.text}</div>
                    {card.notes && (
                      <div style={{ fontSize: 10, marginTop: 3, opacity: 0.7, fontStyle: "italic", overflow: "hidden", maxHeight: "2.5em", lineHeight: 1.3 }}>{card.notes}</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
