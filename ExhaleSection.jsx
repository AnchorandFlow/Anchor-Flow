import { useState, useEffect, useRef } from "react";

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
      var item = groups[col][j];
      out.push({ id: item.id, text: item.text, notes: item.notes, color: item.color, category: col, createdAt: item.createdAt });
    }
  }
  return out;
}

function cloneGroups(groups) {
  var next = {};
  for (var i = 0; i < COLS.length; i++) next[COLS[i]] = groups[COLS[i]].slice();
  return next;
}

// Props:
//   initialItems  — household.exhaleItems or household.brainItems (migrates automatically)
//   initialLabels — household.exhaleLabels (optional)
//   onSave(items, labels) — called 800ms after any change
export default function ExhaleSection(props) {
  var initialItems  = props.initialItems  || [];
  var initialLabels = props.initialLabels || {};
  var onSave        = props.onSave        || null;

  var [groups,     setGroups]     = useState(function() { return groupItems(initialItems); });
  var [colLabels,  setColLabels]  = useState(function() { return Object.assign({}, DEFAULT_LABELS, initialLabels); });
  var [expanded,   setExpanded]   = useState(null);
  var [inputText,  setInputText]  = useState("");
  var [drag,       setDrag]       = useState(null);
  var [dropOver,   setDropOver]   = useState(null);
  var [editingCol, setEditingCol] = useState(null);
  var [hoverCol,   setHoverCol]   = useState(null);

  var saveTimer = useRef(null);
  var mounted   = useRef(false);

  useEffect(function() {
    if (!mounted.current) { mounted.current = true; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(function() {
      if (onSave) onSave(flattenGroups(groups), colLabels);
    }, 800);
    return function() { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [groups, colLabels]);

  var total = 0;
  for (var ci = 0; ci < COLS.length; ci++) total += groups[COLS[ci]].length;

  // ── handlers ─────────────────────────────────────────────────────────────
  function handleAdd() {
    var txt = inputText.trim();
    if (!txt) return;
    var colorId = CARD_COLORS[groups.inbox.length % CARD_COLORS.length].id;
    var item = { id: "e" + (_nid++), text: txt, notes: "", color: colorId, category: "inbox", createdAt: Date.now() };
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      next.inbox = [item].concat(next.inbox);
      return next;
    });
    setInputText("");
  }

  function handleInputKeyDown(e) { if (e.key === "Enter") handleAdd(); }

  function handleExpandToggle(e, cardId) {
    e.stopPropagation();
    setExpanded(function(prev) { return prev === cardId ? null : cardId; });
  }

  function handleLabelKeyDown(e) {
    if (e.key === "Enter" || e.key === "Escape") setEditingCol(null);
  }

  function handleNoteChange(e, cardId) {
    var val = e.target.value;
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      for (var i = 0; i < COLS.length; i++) {
        for (var j = 0; j < next[COLS[i]].length; j++) {
          if (next[COLS[i]][j].id === cardId) {
            next[COLS[i]][j] = Object.assign({}, next[COLS[i]][j], { notes: val });
            return next;
          }
        }
      }
      return next;
    });
  }

  function handleColorChange(cardId, colorId) {
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      for (var i = 0; i < COLS.length; i++) {
        for (var j = 0; j < next[COLS[i]].length; j++) {
          if (next[COLS[i]][j].id === cardId) {
            next[COLS[i]][j] = Object.assign({}, next[COLS[i]][j], { color: colorId });
            return next;
          }
        }
      }
      return next;
    });
  }

  function handleDelete(cardId) {
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      for (var i = 0; i < COLS.length; i++) {
        next[COLS[i]] = next[COLS[i]].filter(function(c) { return c.id !== cardId; });
      }
      return next;
    });
    setExpanded(null);
  }

  function handleLabelChange(col, val) {
    setColLabels(function(prev) { return Object.assign({}, prev, { [col]: val }); });
  }

  // ── drag ─────────────────────────────────────────────────────────────────
  function handleDragStart(e, cardId, col) {
    setDrag({ id: cardId, fromCol: col });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text", cardId);
  }

  function handleDragEnd() { setDrag(null); setDropOver(null); }

  function handleCardDragOver(e, cardId, col) {
    if (!drag || drag.id === cardId) return;
    e.preventDefault(); e.stopPropagation();
    var rect = e.currentTarget.getBoundingClientRect();
    setDropOver({ type: "card", id: cardId, col: col, above: e.clientY < rect.top + rect.height / 2 });
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
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      var fi = -1;
      for (var i = 0; i < next[drag.fromCol].length; i++) {
        if (next[drag.fromCol][i].id === drag.id) { fi = i; break; }
      }
      if (fi === -1) return prev;
      var moved = Object.assign({}, next[drag.fromCol].splice(fi, 1)[0], { category: col });
      var ti = -1;
      for (var j = 0; j < next[col].length; j++) {
        if (next[col][j].id === cardId) { ti = j; break; }
      }
      if (ti === -1) ti = next[col].length;
      next[col].splice(above ? ti : ti + 1, 0, moved);
      return next;
    });
    setDrag(null); setDropOver(null);
  }

  function handleColDrop(e, col) {
    e.preventDefault();
    if (!drag) return;
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      var fi = -1;
      for (var i = 0; i < next[drag.fromCol].length; i++) {
        if (next[drag.fromCol][i].id === drag.id) { fi = i; break; }
      }
      if (fi === -1) return prev;
      var moved = Object.assign({}, next[drag.fromCol].splice(fi, 1)[0], { category: col });
      next[col].push(moved);
      return next;
    });
    setDrag(null); setDropOver(null);
  }

  // ── styles ────────────────────────────────────────────────────────────────
  var qbtn = { fontSize: 10, padding: "2px 7px", borderRadius: 20, border: "0.5px solid rgba(0,0,0,0.18)", background: "rgba(0,0,0,0.07)", cursor: "pointer", color: "inherit" };
  var delbtn = { fontSize: 10, padding: "2px 7px", borderRadius: 20, border: "0.5px solid rgba(180,0,0,0.3)", background: "rgba(180,0,0,0.07)", cursor: "pointer", color: "#8B0000" };

  return (
    <div style={{ fontFamily: "var(--font-sans, sans-serif)", fontSize: 13 }}>

      {/* App bar */}
      <div style={{ background: NAVY, padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
        <span>💨</span>
        <span style={{ color: "#E8C76A" }}>Exhale</span>
        <span style={{ marginLeft: "auto", fontSize: 10 }}>{total} items</span>
      </div>

      {/* Capture bar */}
      <div style={{ display: "flex", gap: 8, padding: "11px 12px", borderBottom: "0.5px solid var(--color-border-tertiary,#e0e0e0)", background: "var(--color-background-secondary,#f8f8f8)" }}>
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="What's on your mind? Drop it here."
          style={{ flex: 1, padding: "8px 11px", fontSize: 13, border: "0.5px solid var(--color-border-secondary,#ccc)", borderRadius: 8, background: "var(--color-background-primary,#fff)", color: "var(--color-text-primary,#111)" }}
        />
        <button onClick={handleAdd} style={{ background: NAVY, color: "white", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12, cursor: "pointer" }}>
          + Add
        </button>
      </div>

      {/* Kanban */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", minHeight: 200 }}>
        {COLS.map(function(col, ci) {
          var isColTarget = dropOver && dropOver.type === "col" && dropOver.col === col;
          var isEditing   = editingCol === col;
          var isHovering  = hoverCol === col;

          return (
            <div
              key={col}
              onDragOver={(e) => handleColDragOver(e, col)}
              onDrop={(e) => handleColDrop(e, col)}
              onDragLeave={() => setDropOver(null)}
              onMouseEnter={() => setHoverCol(col)}
              onMouseLeave={() => setHoverCol(null)}
              style={{
                padding: "10px 6px",
                borderRight: ci < 4 ? "0.5px solid var(--color-border-tertiary,#e0e0e0)" : "none",
                background: isColTarget ? "rgba(27,46,79,0.04)" : "transparent",
                transition: "background 0.12s",
              }}
            >
              {/* Editable column header */}
              <div style={{ marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 3 }}>
                {isEditing ? (
                  <input
                    autoFocus
                    value={colLabels[col]}
                    onChange={(e) => handleLabelChange(col, e.target.value)}
                    onBlur={() => setEditingCol(null)}
                    onKeyDown={handleLabelKeyDown}
                    style={{ flex: 1, fontSize: 10, fontWeight: 500, border: "none", background: "transparent", color: "var(--color-text-primary,#111)", outline: "none", borderBottom: "1.5px solid " + NAVY, padding: "0 0 1px 0", fontFamily: "inherit" }}
                  />
                ) : (
                  <span
                    onClick={() => setEditingCol(col)}
                    title="Click to rename"
                    style={{ flex: 1, fontSize: 10, fontWeight: 500, color: "var(--color-text-secondary,#666)", cursor: "text", lineHeight: 1.3 }}
                  >
                    {colLabels[col]}
                  </span>
                )}
                <span style={{ background: "var(--color-background-secondary,#f0f0f0)", borderRadius: 8, padding: "1px 4px", fontSize: 9, color: "var(--color-text-tertiary,#999)", flexShrink: 0 }}>
                  {groups[col].length}
                </span>
                {isHovering && !isEditing && (
                  <span onClick={() => setEditingCol(col)} style={{ fontSize: 9, cursor: "pointer", color: "var(--color-text-tertiary,#aaa)", flexShrink: 0 }} title="Rename">✎</span>
                )}
              </div>

              {/* Cards */}
              {groups[col].map(function(card) {
                var c       = getColor(card.color);
                var isExp   = expanded === card.id;
                var isDrag  = drag && drag.id === card.id;
                var isAbove = dropOver && dropOver.type === "card" && dropOver.id === card.id && dropOver.above;
                var isBelow = dropOver && dropOver.type === "card" && dropOver.id === card.id && !dropOver.above;

                var cardStyle = {
                  borderRadius: 7, padding: "7px 8px", marginBottom: 5,
                  fontSize: 11.5, lineHeight: 1.4, cursor: "grab",
                  borderWidth: "0.5px", borderStyle: "solid",
                  background: c.bg, borderColor: c.bd, color: c.tx,
                  opacity: isDrag ? 0.25 : 1,
                  outline: isExp ? ("1.5px solid " + NAVY) : "none",
                };
                if (isAbove) cardStyle.borderTop    = "2.5px solid " + NAVY;
                if (isBelow) cardStyle.borderBottom = "2.5px solid " + NAVY;

                return (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id, col)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleCardDragOver(e, card.id, col)}
                    onDrop={(e) => handleCardDrop(e, card.id, col)}
                    style={cardStyle}
                  >
                    {/* Card header row */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 3 }}>
                      <span style={{ flex: 1, fontSize: 11.5, lineHeight: 1.4 }}>{card.text}</span>
                      <button
                        onClick={(e) => handleExpandToggle(e, card.id)}
                        style={{ background: "rgba(0,0,0,0.1)", border: "none", borderRadius: 3, width: 15, height: 15, fontSize: 8, cursor: "pointer", flexShrink: 0, color: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        {isExp ? "▲" : "▼"}
                      </button>
                    </div>

                    {/* Inline expand — no overflow issues */}
                    {isExp && (
                      <div style={{ marginTop: 8, borderTop: "0.5px solid rgba(0,0,0,0.15)", paddingTop: 8 }}>
                        <textarea
                          value={card.notes}
                          onChange={(e) => handleNoteChange(e, card.id)}
                          placeholder="Notes, context, deadline..."
                          rows={3}
                          style={{ width: "100%", border: "0.5px solid rgba(0,0,0,0.2)", borderRadius: 5, padding: "5px 7px", fontSize: 11, resize: "none", background: "rgba(255,255,255,0.5)", color: c.tx, lineHeight: 1.4, fontFamily: "inherit" }}
                        />
                        {/* Color picker */}
                        <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                          {CARD_COLORS.map(function(cl) {
                            return (
                              <div
                                key={cl.id}
                                onClick={() => handleColorChange(card.id, cl.id)}
                                style={{ width: 13, height: 13, borderRadius: "50%", background: cl.bg, border: "1.5px solid " + (cl.id === card.color ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.15)"), cursor: "pointer", flexShrink: 0 }}
                              />
                            );
                          })}
                        </div>
                        {/* Action buttons */}
                        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                          <button style={qbtn}>✓ Task</button>
                          <button style={qbtn}>📅 Cal</button>
                          <button onClick={() => handleDelete(card.id)} style={delbtn}>✕ Delete</button>
                        </div>
                        <button
                          onClick={() => setExpanded(null)}
                          style={{ marginTop: 6, width: "100%", fontSize: 10, padding: "3px 0", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: 5, background: "rgba(0,0,0,0.05)", cursor: "pointer", color: "inherit" }}
                        >
                          Done ↑
                        </button>
                      </div>
                    )}

                    {/* Notes preview when collapsed */}
                    {card.notes && !isExp && (
                      <div style={{ fontSize: 10, marginTop: 3, opacity: 0.7, fontStyle: "italic", overflow: "hidden", maxHeight: "2.6em", lineHeight: 1.3 }}>
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
