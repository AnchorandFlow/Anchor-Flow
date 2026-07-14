import { useState, useEffect, useRef } from "react";

// ─── palette ──────────────────────────────────────────────────────────────
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

// ─── helpers ──────────────────────────────────────────────────────────────
function getColor(id) {
  for (var i = 0; i < CARD_COLORS.length; i++) {
    if (CARD_COLORS[i].id === id) return CARD_COLORS[i];
  }
  return CARD_COLORS[0];
}

// Flat array (stored in household) → grouped object (used in UI)
// Migrates old string[] braindump automatically
function groupItems(raw) {
  var groups = { inbox: [], decide: [], do: [], waiting: [], someday: [] };
  if (!raw || !Array.isArray(raw)) return groups;
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var cat;
    var entry;
    if (typeof item === "string") {
      cat = "inbox";
      entry = {
        id: "legacy-" + i + "-" + Date.now(),
        text: item,
        notes: "",
        color: CARD_COLORS[i % CARD_COLORS.length].id,
        category: "inbox",
        createdAt: Date.now(),
      };
    } else {
      cat = (item.category && groups[item.category]) ? item.category : "inbox";
      entry = {
        id: item.id || ("e-" + i),
        text: item.text || "",
        notes: item.notes || "",
        color: item.color || "seafoam",
        category: cat,
        createdAt: item.createdAt || Date.now(),
      };
    }
    groups[cat].push(entry);
  }
  return groups;
}

// Grouped object → flat array (for saving back to household)
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

function findInGroups(groups, id) {
  for (var i = 0; i < COLS.length; i++) {
    var col = COLS[i];
    for (var j = 0; j < groups[col].length; j++) {
      if (groups[col][j].id === id) return { col: col, idx: j, card: groups[col][j] };
    }
  }
  return null;
}

function cloneGroups(groups) {
  var next = {};
  for (var i = 0; i < COLS.length; i++) {
    next[COLS[i]] = groups[COLS[i]].slice();
  }
  return next;
}

// ─── component ────────────────────────────────────────────────────────────
// Props:
//   initialItems  — household.exhaleItems (array) or household.braindump (legacy)
//   initialLabels — household.exhaleLabels (object, optional)
//   onSave(items, labels) — called after 800ms debounce on any change
//     → items is the flat array to store back in household.exhaleItems
//     → labels is the column labels object to store in household.exhaleLabels

export default function ExhaleSection(props) {
  var initialItems  = props.initialItems  || [];
  var initialLabels = props.initialLabels || DEFAULT_LABELS;
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

  var expFound = expanded ? findInGroups(groups, expanded) : null;

  // ── named event handlers ────────────────────────────────────────────────
  function handleAdd() {
    var txt = inputText.trim();
    if (!txt) return;
    var colorId = CARD_COLORS[groups.inbox.length % CARD_COLORS.length].id;
    var newItem = { id: "e" + (_nid++), text: txt, notes: "", color: colorId, category: "inbox", createdAt: Date.now() };
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      next.inbox = [newItem].concat(next.inbox);
      return next;
    });
    setInputText("");
  }

  function handleInputKeyDown(e) {
    if (e.key === "Enter") handleAdd();
  }

  function handleExpandClick(e, cardId) {
    e.stopPropagation();
    setExpanded(function(prev) { return prev === cardId ? null : cardId; });
  }

  function handleLabelKeyDown(e) {
    if (e.key === "Enter" || e.key === "Escape") setEditingCol(null);
  }

  function handleNoteChange(e) {
    if (!expanded) return;
    var val = e.target.value;
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      for (var i = 0; i < COLS.length; i++) {
        var col = COLS[i];
        for (var j = 0; j < next[col].length; j++) {
          if (next[col][j].id === expanded) {
            next[col][j] = Object.assign({}, next[col][j], { notes: val });
            return next;
          }
        }
      }
      return next;
    });
  }

  function handleColorDot(colorId) {
    if (!expanded) return;
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      for (var i = 0; i < COLS.length; i++) {
        var col = COLS[i];
        for (var j = 0; j < next[col].length; j++) {
          if (next[col][j].id === expanded) {
            next[col][j] = Object.assign({}, next[col][j], { color: colorId });
            return next;
          }
        }
      }
      return next;
    });
  }

  function handleLabelChange(col, val) {
    setColLabels(function(prev) { return Object.assign({}, prev, { [col]: val }); });
  }

  // ── drag handlers ───────────────────────────────────────────────────────
  function handleDragStart(e, cardId, col) {
    setDrag({ id: cardId, fromCol: col });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text", cardId);
  }

  function handleDragEnd() {
    setDrag(null);
    setDropOver(null);
  }

  function handleCardDragOver(e, cardId, col) {
    if (!drag || drag.id === cardId) return;
    e.preventDefault();
    e.stopPropagation();
    var rect = e.currentTarget.getBoundingClientRect();
    var above = e.clientY < rect.top + rect.height / 2;
    setDropOver({ type: "card", id: cardId, col: col, above: above });
  }

  function handleColDragOver(e, col) {
    e.preventDefault();
    if (dropOver && dropOver.type === "card") return;
    setDropOver({ type: "col", col: col });
  }

  function handleCardDrop(e, cardId, col) {
    e.preventDefault();
    e.stopPropagation();
    if (!drag || drag.id === cardId) return;
    var above = (dropOver && dropOver.id === cardId) ? dropOver.above : true;
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      var fi = -1;
      for (var i = 0; i < next[drag.fromCol].length; i++) {
        if (next[drag.fromCol][i].id === drag.id) { fi = i; break; }
      }
      if (fi === -1) return prev;
      var moved = next[drag.fromCol].splice(fi, 1)[0];
      moved = Object.assign({}, moved, { category: col });
      var ti = -1;
      for (var j = 0; j < next[col].length; j++) {
        if (next[col][j].id === cardId) { ti = j; break; }
      }
      if (ti === -1) ti = next[col].length;
      next[col].splice(above ? ti : ti + 1, 0, moved);
      return next;
    });
    setDrag(null);
    setDropOver(null);
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
      var moved = next[drag.fromCol].splice(fi, 1)[0];
      moved = Object.assign({}, moved, { category: col });
      next[col].push(moved);
      return next;
    });
    setDrag(null);
    setDropOver(null);
  }

  // ── styles ───────────────────────────────────────────────────────────────
  var S = {
    wrap: { fontFamily: "var(--font-sans, DM Sans, sans-serif)", fontSize: 13 },
    appBar: { background: NAVY, padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 11 },
    captureRow: { display: "flex", gap: 8, padding: "11px 12px", borderBottom: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)" },
    captureInput: { flex: 1, padding: "8px 11px", fontSize: 13, border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, background: "var(--color-background-primary)", color: "var(--color-text-primary)" },
    captureBtn: { background: NAVY, color: "white", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12, cursor: "pointer" },
    kanban: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", minHeight: 300, borderBottom: "0.5px solid var(--color-border-tertiary)" },
    baseCard: { borderRadius: 7, padding: "8px 9px", marginBottom: 5, fontSize: 11.5, lineHeight: 1.4, cursor: "grab", borderWidth: "0.5px", borderStyle: "solid", userSelect: "none" },
    expandPanel: { borderTop: "0.5px solid var(--color-border-tertiary)", padding: "14px 16px", background: "var(--color-background-secondary)" },
    compass: { margin: "10px 16px", background: "#EEF3FF", borderLeft: "3px solid " + NAVY, borderRadius: "0 8px 8px 0", padding: "10px 14px" },
    compassLabel: { fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "#7A8FB5", marginBottom: 6 },
    qbtn: { fontSize: 10.5, padding: "3px 9px", borderRadius: 20, border: "0.5px solid rgba(0,0,0,0.18)", background: "rgba(0,0,0,0.06)", cursor: "pointer", color: "var(--color-text-secondary)" },
    actionBtn: { fontSize: 10.5, padding: "3px 9px", borderRadius: 20, border: "0.5px solid " + NAVY, background: "white", cursor: "pointer", color: NAVY },
  };

  return (
    <div style={S.wrap}>

      {/* App bar */}
      <div style={S.appBar}>
        <span>💨</span>
        <span style={{ color: "#E8C76A" }}>Exhale</span>
        <span style={{ marginLeft: "auto", fontSize: 10 }}>{total} items</span>
      </div>

      {/* Capture */}
      <div style={S.captureRow}>
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="What's on your mind? Drop it here."
          style={S.captureInput}
        />
        <button onClick={handleAdd} style={S.captureBtn}>+ Add</button>
      </div>

      {/* Kanban */}
      <div style={S.kanban}>
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
                padding: "10px 7px",
                borderRight: ci < 4 ? "0.5px solid var(--color-border-tertiary)" : "none",
                background: isColTarget ? "rgba(27,46,79,0.05)" : "transparent",
                transition: "background 0.12s",
              }}
            >
              {/* Editable column header */}
              <div style={{ marginBottom: 8, minHeight: 26, display: "flex", alignItems: "flex-start", gap: 4 }}>
                {isEditing ? (
                  <input
                    autoFocus
                    value={colLabels[col]}
                    onChange={(e) => handleLabelChange(col, e.target.value)}
                    onBlur={() => setEditingCol(null)}
                    onKeyDown={handleLabelKeyDown}
                    style={{ flex: 1, fontSize: 11, fontWeight: 500, border: "none", background: "transparent", color: "var(--color-text-primary)", outline: "none", borderBottom: "1.5px solid " + NAVY, padding: "0 0 2px 0", fontFamily: "inherit" }}
                  />
                ) : (
                  <span
                    onClick={() => setEditingCol(col)}
                    title="Click to rename"
                    style={{ flex: 1, fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", cursor: "text", lineHeight: 1.3 }}
                  >
                    {colLabels[col]}
                  </span>
                )}
                <span style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "1px 4px", fontSize: 9, color: "var(--color-text-tertiary)", flexShrink: 0, marginTop: 2 }}>
                  {groups[col].length}
                </span>
                {isHovering && !isEditing && (
                  <span onClick={() => setEditingCol(col)} style={{ fontSize: 10, cursor: "pointer", color: "var(--color-text-tertiary)", flexShrink: 0, marginTop: 1 }} title="Rename">✎</span>
                )}
              </div>

              {/* Cards */}
              {groups[col].map(function(card) {
                var c        = getColor(card.color);
                var isExp    = expanded === card.id;
                var isDrag   = drag && drag.id === card.id;
                var isAbove  = dropOver && dropOver.type === "card" && dropOver.id === card.id && dropOver.above;
                var isBelow  = dropOver && dropOver.type === "card" && dropOver.id === card.id && !dropOver.above;

                var cardStyle = Object.assign({}, S.baseCard, {
                  background:  c.bg,
                  borderColor: c.bd,
                  color:       c.tx,
                  opacity:     isDrag ? 0.25 : 1,
                  outline:     isExp ? "1.5px solid " + NAVY : "none",
                  outlineOffset: 0,
                });
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
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                      <span style={{ flex: 1, fontSize: 11.5, lineHeight: 1.4 }}>{card.text}</span>
                      <button
                        onClick={(e) => handleExpandClick(e, card.id)}
                        style={{ background: "rgba(0,0,0,0.1)", border: "none", borderRadius: 3, width: 16, height: 16, fontSize: 9, cursor: "pointer", flexShrink: 0, color: "inherit", opacity: 0.8, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        {isExp ? "▲" : "▼"}
                      </button>
                    </div>
                    {card.notes && !isExp && (
                      <div style={{ fontSize: 10, marginTop: 3, opacity: 0.7, fontStyle: "italic", overflow: "hidden", maxHeight: "2.7em", lineHeight: 1.35 }}>
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

      {/* Expanded panel */}
      {expFound && (
        <div style={Object.assign({}, S.expandPanel, { borderLeft: "3px solid " + getColor(expFound.card.color).bd })}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 8 }}>
            {expFound.card.text}
          </div>
          <textarea
            value={expFound.card.notes}
            onChange={handleNoteChange}
            placeholder="Add notes, context, deadline..."
            style={{ width: "100%", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, padding: "8px 10px", fontSize: 12, resize: "vertical", minHeight: 60, background: "var(--color-background-primary)", color: "var(--color-text-primary)", lineHeight: 1.5, fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>Color</span>
            {CARD_COLORS.map(function(cl) {
              return (
                <div
                  key={cl.id}
                  onClick={() => handleColorDot(cl.id)}
                  title={cl.id}
                  style={{ width: 16, height: 16, borderRadius: "50%", background: cl.bg, border: "2px solid " + (cl.id === expFound.card.color ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.15)"), cursor: "pointer", flexShrink: 0 }}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9, flexWrap: "wrap" }}>
            <button style={S.qbtn}>✓ Make task</button>
            <button style={S.qbtn}>📅 Calendar</button>
            <button style={S.qbtn}>🗂 Send to Anchor</button>
            <button style={S.qbtn}>🗃 Archive</button>
            <button
              onClick={() => setExpanded(null)}
              style={{ marginLeft: "auto", fontSize: 11, padding: "4px 10px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", cursor: "pointer", color: "var(--color-text-secondary)" }}
            >
              Done ↑
            </button>
          </div>
        </div>
      )}

      {/* Compass */}
      <div style={S.compass}>
        <div style={S.compassLabel}>🧭 Compass found 4 things it can help with</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          <button style={S.actionBtn}>✓ Create task</button>
          <button style={S.actionBtn}>📅 Add reminder</button>
          <button style={S.actionBtn}>🛒 Move to shopping</button>
          <button style={S.actionBtn}>📆 Add to calendar</button>
        </div>
      </div>

    </div>
  );
}
