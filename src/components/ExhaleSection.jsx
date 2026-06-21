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

  var saveTimer = useRef(null);
  var mounted   = useRef(false);

  // Auto-save on data change
  useEffect(function() {
    if (!mounted.current) { mounted.current = true; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(function() {
      if (onSave) onSave(flattenGroups(groups), colLabels);
    }, 800);
    return function() { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [groups, colLabels]);

  // Sync noteText when selected card changes
  useEffect(function() {
    if (!selectedId) { setNoteText(""); return; }
    var found = findInGroups(groups, selectedId);
    if (found) setNoteText(found.card.notes);
  }, [selectedId]);

  var total = 0;
  for (var ci = 0; ci < COLS.length; ci++) total += groups[COLS[ci]].length;

  var selectedFound = selectedId ? findInGroups(groups, selectedId) : null;

  // ── data mutations ────────────────────────────────────────────────────────
  function updateCard(id, patch) {
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      for (var i = 0; i < COLS.length; i++) {
        for (var j = 0; j < next[COLS[i]].length; j++) {
          if (next[COLS[i]][j].id === id) {
            next[COLS[i]][j] = Object.assign({}, next[COLS[i]][j], patch);
            return next;
          }
        }
      }
      return next;
    });
  }

  function moveCardToCol(id, toCol) {
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      var found = null;
      var fromCol = null;
      for (var i = 0; i < COLS.length; i++) {
        for (var j = 0; j < next[COLS[i]].length; j++) {
          if (next[COLS[i]][j].id === id) { found = next[COLS[i]].splice(j, 1)[0]; fromCol = COLS[i]; break; }
        }
        if (found) break;
      }
      if (found) next[toCol].unshift(Object.assign({}, found, { category: toCol }));
      return next;
    });
  }

  function deleteCard(id) {
    setGroups(function(prev) {
      var next = cloneGroups(prev);
      for (var i = 0; i < COLS.length; i++) {
        next[COLS[i]] = next[COLS[i]].filter(function(c) { return c.id !== id; });
      }
      return next;
    });
    setSelectedId(null);
  }

  // ── handlers ─────────────────────────────────────────────────────────────
  function handleAdd() {
    var txt = inputText.trim();
    if (!txt) return;
    var colorId = CARD_COLORS[groups.inbox.length % CARD_COLORS.length].id;
    var item = { id: "e" + (_nid++), text: txt, notes: "", color: colorId, category: "inbox", createdAt: Date.now() };
    setGroups(function(prev) { var next = cloneGroups(prev); next.inbox = [item].concat(next.inbox); return next; });
    setInputText("");
  }

  function handleInputKeyDown(e) { if (e.key === "Enter") handleAdd(); }

  function handleDone() {
    // Save current note text before closing detail
    if (selectedId && noteText !== undefined) {
      updateCard(selectedId, { notes: noteText });
    }
    setSelectedId(null);
  }

  function handleSelectCard(cardId) {
    setSelectedId(cardId);
  }

  function handleLabelKeyDown(e) {
    if (e.key === "Enter" || e.key === "Escape") setEditingCol(null);
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

  // ── shared styles ─────────────────────────────────────────────────────────
  var border = "0.5px solid var(--color-border-tertiary, #e0e0e0)";
  var bgSec  = "var(--color-background-secondary, #f8f8f8)";
  var bgPri  = "var(--color-background-primary, #fff)";
  var txPri  = "var(--color-text-primary, #111)";
  var txSec  = "var(--color-text-secondary, #666)";

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  if (selectedFound) {
    var card = selectedFound.card;
    var cardCol = selectedFound.col;
    var c = getColor(card.color);

    return (
      <div style={{ fontFamily: "var(--font-sans, sans-serif)" }}>

        {/* Detail header */}
        <div style={{ background: c.bg, borderBottom: "0.5px solid " + c.bd, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={handleDone}
            style={{ background: "rgba(0,0,0,0.1)", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: c.tx, flexShrink: 0 }}
          >
            ← Back
          </button>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: c.tx, lineHeight: 1.3 }}>{card.text}</span>
        </div>

        {/* Notes */}
        <div style={{ padding: "14px 14px 10px" }}>
          <div style={{ fontSize: 11, color: txSec, marginBottom: 5 }}>Notes</div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add context, deadline, links..."
            rows={4}
            style={{ width: "100%", border: border, borderRadius: 8, padding: "9px 11px", fontSize: 13, resize: "none", background: bgPri, color: txPri, lineHeight: 1.5, fontFamily: "inherit" }}
          />
        </div>

        {/* Color picker */}
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ fontSize: 11, color: txSec, marginBottom: 7 }}>Color</div>
          <div style={{ display: "flex", gap: 8 }}>
            {CARD_COLORS.map(function(cl) {
              return (
                <div
                  key={cl.id}
                  onClick={() => updateCard(card.id, { color: cl.id })}
                  style={{ width: 26, height: 26, borderRadius: "50%", background: cl.bg, border: "2px solid " + (cl.id === card.color ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.12)"), cursor: "pointer", flexShrink: 0 }}
                />
              );
            })}
          </div>
        </div>

        {/* Move to column */}
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 11, color: txSec, marginBottom: 7 }}>Move to</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {COLS.map(function(col) {
              var isActive = col === cardCol;
              return (
                <button
                  key={col}
                  onClick={() => moveCardToCol(card.id, col)}
                  style={{
                    textAlign: "left", padding: "7px 11px", borderRadius: 7, border: border,
                    background: isActive ? NAVY : bgSec,
                    color: isActive ? "white" : txPri,
                    fontSize: 12, cursor: isActive ? "default" : "pointer",
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {colLabels[col]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Delete */}
        <div style={{ padding: "0 14px 16px", borderTop: border, paddingTop: 12, marginTop: 2 }}>
          <button
            onClick={() => deleteCard(card.id)}
            style={{ width: "100%", padding: "8px", borderRadius: 7, border: "0.5px solid rgba(180,0,0,0.3)", background: "rgba(180,0,0,0.06)", color: "#8B0000", fontSize: 12, cursor: "pointer" }}
          >
            ✕ Delete this card
          </button>
        </div>

      </div>
    );
  }

  // ── KANBAN VIEW ───────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "var(--font-sans, sans-serif)", fontSize: 13 }}>

      {/* App bar */}
      <div style={{ background: NAVY, padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
        <span>💨</span>
        <span style={{ color: "#E8C76A" }}>Exhale</span>
        <span style={{ marginLeft: "auto", fontSize: 10 }}>{total} items</span>
      </div>

      {/* Capture */}
      <div style={{ display: "flex", gap: 8, padding: "11px 12px", borderBottom: border, background: bgSec }}>
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="What's on your mind? Drop it here."
          style={{ flex: 1, padding: "8px 11px", fontSize: 13, border: border, borderRadius: 8, background: bgPri, color: txPri }}
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

          return (
            <div
              key={col}
              onDragOver={(e) => handleColDragOver(e, col)}
              onDrop={(e) => handleColDrop(e, col)}
              onDragLeave={() => setDropOver(null)}
              style={{
                padding: "10px 6px",
                borderRight: ci < 4 ? border : "none",
                background: isColTarget ? "rgba(27,46,79,0.04)" : "transparent",
              }}
            >
              {/* Column header */}
              <div style={{ marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 3 }}>
                {isEditing ? (
                  <input
                    autoFocus
                    value={colLabels[col]}
                    onChange={(e) => setColLabels(function(prev) { return Object.assign({}, prev, { [col]: e.target.value }); })}
                    onBlur={() => setEditingCol(null)}
                    onKeyDown={handleLabelKeyDown}
                    style={{ flex: 1, fontSize: 10, fontWeight: 500, border: "none", background: "transparent", color: txPri, outline: "none", borderBottom: "1.5px solid " + NAVY, padding: "0 0 1px 0", fontFamily: "inherit" }}
                  />
                ) : (
                  <span
                    onClick={() => setEditingCol(col)}
                    title="Click to rename"
                    style={{ flex: 1, fontSize: 10, fontWeight: 500, color: txSec, cursor: "text", lineHeight: 1.3 }}
                  >
                    {colLabels[col]}
                  </span>
                )}
                <span style={{ background: bgSec, borderRadius: 8, padding: "1px 4px", fontSize: 9, color: "var(--color-text-tertiary,#aaa)", flexShrink: 0 }}>
                  {groups[col].length}
                </span>
              </div>

              {/* Cards — tap to open detail */}
              {groups[col].map(function(card) {
                var c       = getColor(card.color);
                var isDrag  = drag && drag.id === card.id;
                var isAbove = dropOver && dropOver.type === "card" && dropOver.id === card.id && dropOver.above;
                var isBelow = dropOver && dropOver.type === "card" && dropOver.id === card.id && !dropOver.above;

                var cardStyle = {
                  borderRadius: 7, padding: "7px 8px", marginBottom: 5,
                  fontSize: 11.5, lineHeight: 1.4, cursor: "pointer",
                  borderWidth: "0.5px", borderStyle: "solid",
                  background: c.bg, borderColor: c.bd, color: c.tx,
                  opacity: isDrag ? 0.25 : 1,
                };
                if (isAbove) cardStyle.borderTop    = "2.5px solid " + NAVY;
                if (isBelow) cardStyle.borderBottom = "2.5px solid " + NAVY;

                return (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id, col)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleCardDragOver(e, card.id)}
                    onDrop={(e) => handleCardDrop(e, card.id, col)}
                    onClick={() => handleSelectCard(card.id)}
                    style={cardStyle}
                  >
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
