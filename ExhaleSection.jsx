import { useState, useEffect } from "react";

var CARD_COLORS = [
  { id: "seafoam", bg: "#C2E8DA", bd: "#85BFAB", tx: "#1C3A2E" },
  { id: "aqua",    bg: "#B2E0E8", bd: "#6ABEC8", tx: "#143640" },
  { id: "sage",    bg: "#C4D8B8", bd: "#8AB878", tx: "#243A1A" },
  { id: "cobalt",  bg: "#B8C8E8", bd: "#7898C8", tx: "#1A2E50" },
  { id: "amber",   bg: "#E8D8A8", bd: "#C4A860", tx: "#3A2C10" },
  { id: "lav",     bg: "#D0C8E8", bd: "#A098C8", tx: "#2A2248" },
];

var COLS = ["inbox", "decide", "do", "waiting", "someday"];

var DEFAULT_LABELS = {
  inbox:   "🌊 On My Mind",
  decide:  "🤔 Needs a Decision",
  do:      "✅ Ready for Action",
  waiting: "⏳ Waiting on Others",
  someday: "🌱 Maybe Later",
};

var NAVY = "#1B2E4F";
var _nid = Date.now();

function getColor(id) {
  for (var i = 0; i < CARD_COLORS.length; i++) {
    if (CARD_COLORS[i].id === id) return CARD_COLORS[i];
  }
  return CARD_COLORS[0];
}

function groupItems(raw) {
  var groups = { inbox: [], decide: [], do: [], waiting: [], someday: [] };
  if (!raw || !Array.isArray(raw)) return groups;
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var cat, entry;
    if (typeof item === "string") {
      cat = "inbox";
      entry = { id: "legacy-" + i, text: item, notes: "", color: CARD_COLORS[i % CARD_COLORS.length].id, category: "inbox", createdAt: Date.now() };
    } else {
      cat = (item.category && groups[item.category]) ? item.category : "inbox";
      entry = {
        id: item.id || ("e-" + i),
        text: item.text || "",
        notes: item.notes || "",
        color: item.color || CARD_COLORS[i % CARD_COLORS.length].id,
        category: cat,
        createdAt: item.createdAt || Date.now(),
      };
    }
    groups[cat].push(entry);
  }
  return groups;
}

function flattenGroups(groups) {
  var out = [];
  for (var i = 0; i < COLS.length; i++) {
    var col = COLS[i];
    for (var j = 0; j < groups[col].length; j++) {
      var c = groups[col][j];
      out.push({ id: c.id, text: c.text, notes: c.notes, color: c.color, category: col, createdAt: c.createdAt });
    }
  }
  return out;
}

function cloneGroups(g) {
  var next = {};
  for (var i = 0; i < COLS.length; i++) next[COLS[i]] = g[COLS[i]].slice();
  return next;
}

function findInGroups(groups, id) {
  for (var i = 0; i < COLS.length; i++) {
    var col = COLS[i];
    for (var j = 0; j < groups[col].length; j++) {
      if (groups[col][j].id === id) return { col: col, card: groups[col][j] };
    }
  }
  return null;
}

// Props:
//   initialItems  — household.exhaleItems or household.brainItems (auto-migrates)
//   initialLabels — household.exhaleLabels
//   onSave(items, labels) — called only on explicit user actions, not on a timer
//                           so it won't trigger your sync reload loop
export default function ExhaleSection(props) {
  var initialItems  = props.initialItems  || [];
  var initialLabels = props.initialLabels || {};
  var onSave        = props.onSave        || null;

  var [groups,     setGroups]     = useState(function() { return groupItems(initialItems); });
  var [colLabels,  setColLabels]  = useState(function() { return Object.assign({}, DEFAULT_LABELS, initialLabels); });
  var [selectedId, setSelectedId] = useState(null);
  var [noteText,   setNoteText]   = useState("");
  var [inputText,  setInputText]  = useState("");
  var [editingCol, setEditingCol] = useState(null);
  var [drag,       setDrag]       = useState(null);
  var [dropOver,   setDropOver]   = useState(null);

  // Sync noteText when a card is selected — no save triggered here
  useEffect(function() {
    if (!selectedId) { setNoteText(""); return; }
    var found = findInGroups(groups, selectedId);
    setNoteText(found ? found.card.notes : "");
  }, [selectedId]);

  // No auto-save timer. Save is explicit at each action to avoid triggering your sync loop.
  function save(newGroups, newLabels) {
    if (onSave) onSave(flattenGroups(newGroups), newLabels);
  }

  var total = 0;
  for (var ci = 0; ci < COLS.length; ci++) total += groups[COLS[ci]].length;
  var selectedFound = selectedId ? findInGroups(groups, selectedId) : null;

  // ── add card ──────────────────────────────────────────────────────────────
  function handleAdd() {
    var txt = inputText.trim();
    if (!txt) return;
    var colorId = CARD_COLORS[groups.inbox.length % CARD_COLORS.length].id;
    var item = { id: "e" + (_nid++), text: txt, notes: "", color: colorId, category: "inbox", createdAt: Date.now() };
    var newGroups = cloneGroups(groups);
    newGroups.inbox = [item].concat(newGroups.inbox);
    setGroups(newGroups);
    setInputText("");
    save(newGroups, colLabels);
  }

  function handleInputKeyDown(e) { if (e.key === "Enter") handleAdd(); }

  // ── detail view actions ───────────────────────────────────────────────────
  function handleDone() {
    if (!selectedId) { setSelectedId(null); return; }
    // Commit note text to groups, then save once
    var newGroups = cloneGroups(groups);
    for (var i = 0; i < COLS.length; i++) {
      for (var j = 0; j < newGroups[COLS[i]].length; j++) {
        if (newGroups[COLS[i]][j].id === selectedId) {
          newGroups[COLS[i]][j] = Object.assign({}, newGroups[COLS[i]][j], { notes: noteText });
          break;
        }
      }
    }
    setGroups(newGroups);
    setSelectedId(null);
    save(newGroups, colLabels);
  }

  function handleColorChange(cardId, colorId) {
    var newGroups = cloneGroups(groups);
    for (var i = 0; i < COLS.length; i++) {
      for (var j = 0; j < newGroups[COLS[i]].length; j++) {
        if (newGroups[COLS[i]][j].id === cardId) {
          newGroups[COLS[i]][j] = Object.assign({}, newGroups[COLS[i]][j], { color: colorId });
          break;
        }
      }
    }
    setGroups(newGroups);
    save(newGroups, colLabels);
  }

  function handleMoveToCol(cardId, toCol) {
    var newGroups = cloneGroups(groups);
    var moved = null;
    for (var i = 0; i < COLS.length; i++) {
      for (var j = 0; j < newGroups[COLS[i]].length; j++) {
        if (newGroups[COLS[i]][j].id === cardId) {
          moved = newGroups[COLS[i]].splice(j, 1)[0];
          break;
        }
      }
      if (moved) break;
    }
    if (moved) newGroups[toCol].unshift(Object.assign({}, moved, { category: toCol }));
    setGroups(newGroups);
    save(newGroups, colLabels);
  }

  function handleDelete(cardId) {
    var newGroups = cloneGroups(groups);
    for (var i = 0; i < COLS.length; i++) {
      newGroups[COLS[i]] = newGroups[COLS[i]].filter(function(c) { return c.id !== cardId; });
    }
    setGroups(newGroups);
    setSelectedId(null);
    save(newGroups, colLabels);
  }

  function handleLabelBlur(col, val) {
    var newLabels = Object.assign({}, colLabels, { [col]: val });
    setColLabels(newLabels);
    setEditingCol(null);
    save(groups, newLabels);
  }

  function handleLabelKeyDown(e, col) {
    if (e.key === "Enter" || e.key === "Escape") handleLabelBlur(col, e.target.value);
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
    var newGroups = cloneGroups(groups);
    var fi = -1;
    for (var i = 0; i < newGroups[drag.fromCol].length; i++) {
      if (newGroups[drag.fromCol][i].id === drag.id) { fi = i; break; }
    }
    if (fi === -1) { setDrag(null); setDropOver(null); return; }
    var moved = Object.assign({}, newGroups[drag.fromCol].splice(fi, 1)[0], { category: col });
    var ti = -1;
    for (var j = 0; j < newGroups[col].length; j++) {
      if (newGroups[col][j].id === cardId) { ti = j; break; }
    }
    if (ti === -1) ti = newGroups[col].length;
    newGroups[col].splice(above ? ti : ti + 1, 0, moved);
    setGroups(newGroups);
    setDrag(null); setDropOver(null);
    save(newGroups, colLabels);
  }

  function handleColDrop(e, col) {
    e.preventDefault();
    if (!drag) return;
    var newGroups = cloneGroups(groups);
    var fi = -1;
    for (var i = 0; i < newGroups[drag.fromCol].length; i++) {
      if (newGroups[drag.fromCol][i].id === drag.id) { fi = i; break; }
    }
    if (fi === -1) { setDrag(null); setDropOver(null); return; }
    var moved = Object.assign({}, newGroups[drag.fromCol].splice(fi, 1)[0], { category: col });
    newGroups[col].push(moved);
    setGroups(newGroups);
    setDrag(null); setDropOver(null);
    save(newGroups, colLabels);
  }

  // ── shared style values ───────────────────────────────────────────────────
  var br = "0.5px solid var(--color-border-tertiary,#e0e0e0)";
  var bgS = "var(--color-background-secondary,#f8f8f8)";
  var bgP = "var(--color-background-primary,#fff)";
  var txP = "var(--color-text-primary,#111)";
  var txS = "var(--color-text-secondary,#666)";

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  if (selectedFound) {
    var card = selectedFound.card;
    var cardCol = selectedFound.col;
    var cc = getColor(card.color);

    return (
      <div style={{ fontFamily: "var(--font-sans,sans-serif)" }}>

        <div style={{ background: cc.bg, borderBottom: "0.5px solid " + cc.bd, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={handleDone} style={{ background: "rgba(0,0,0,0.1)", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: cc.tx, flexShrink: 0 }}>
            ← Back
          </button>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: cc.tx, lineHeight: 1.3 }}>{card.text}</span>
        </div>

        <div style={{ padding: "14px 14px 10px" }}>
          <div style={{ fontSize: 11, color: txS, marginBottom: 5 }}>Notes</div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Context, deadline, links..."
            rows={4}
            style={{ width: "100%", border: br, borderRadius: 8, padding: "9px 11px", fontSize: 13, resize: "none", background: bgP, color: txP, lineHeight: 1.5, fontFamily: "inherit" }}
          />
        </div>

        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 11, color: txS, marginBottom: 7 }}>Color</div>
          <div style={{ display: "flex", gap: 8 }}>
            {CARD_COLORS.map(function(cl) {
              return (
                <div key={cl.id} onClick={() => handleColorChange(card.id, cl.id)}
                  style={{ width: 26, height: 26, borderRadius: "50%", background: cl.bg, border: "2px solid " + (cl.id === card.color ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.12)"), cursor: "pointer" }} />
              );
            })}
          </div>
        </div>

        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 11, color: txS, marginBottom: 7 }}>Move to</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {COLS.map(function(col) {
              var isActive = col === cardCol;
              return (
                <button key={col} onClick={() => handleMoveToCol(card.id, col)}
                  style={{ textAlign: "left", padding: "7px 11px", borderRadius: 7, border: br, background: isActive ? NAVY : bgS, color: isActive ? "white" : txP, fontSize: 12, cursor: isActive ? "default" : "pointer", fontWeight: isActive ? 500 : 400 }}>
                  {colLabels[col]}
                </button>
              );
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
          var isEditing   = editingCol === col;

          return (
            <div key={col}
              onDragOver={(e) => handleColDragOver(e, col)}
              onDrop={(e) => handleColDrop(e, col)}
              onDragLeave={() => setDropOver(null)}
              style={{ padding: "10px 6px", borderRight: ci < 4 ? br : "none", background: isColTarget ? "rgba(27,46,79,0.04)" : "transparent" }}>

              <div style={{ marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 3 }}>
                {isEditing ? (
                  <input autoFocus value={colLabels[col]}
                    onChange={(e) => setColLabels(function(prev) { return Object.assign({}, prev, { [col]: e.target.value }); })}
                    onBlur={(e) => handleLabelBlur(col, e.target.value)}
                    onKeyDown={(e) => handleLabelKeyDown(e, col)}
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
                var cardStyle = {
                  borderRadius: 7, padding: "7px 8px", marginBottom: 5, fontSize: 11.5,
                  lineHeight: 1.4, cursor: "pointer", borderWidth: "0.5px", borderStyle: "solid",
                  background: c.bg, borderColor: c.bd, color: c.tx, opacity: isDrag ? 0.25 : 1,
                };
                if (isAbove) cardStyle.borderTop    = "2.5px solid " + NAVY;
                if (isBelow) cardStyle.borderBottom = "2.5px solid " + NAVY;

                return (
                  <div key={card.id} draggable
                    onDragStart={(e) => handleDragStart(e, card.id, col)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleCardDragOver(e, card.id)}
                    onDrop={(e) => handleCardDrop(e, card.id, col)}
                    onClick={() => setSelectedId(card.id)}
                    style={cardStyle}>
                    <div style={{ fontSize: 11.5, lineHeight: 1.4 }}>{card.text}</div>
                    {card.notes && (
                      <div style={{ fontSize: 10, marginTop: 3, opacity: 0.7, fontStyle: "italic", overflow: "hidden", maxHeight: "2.5em", lineHeight: 1.3 }}>
                        {card.notes}
                      </div>
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
