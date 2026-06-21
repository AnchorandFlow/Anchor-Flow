import { useState } from "react";

const COLORS = [
  { id: "seafoam", bg: "#C2E8DA", bd: "#85BFAB", tx: "#1C3A2E" },
  { id: "aqua",    bg: "#B2E0E8", bd: "#6ABEC8", tx: "#143640" },
  { id: "sage",    bg: "#C4D8B8", bd: "#8AB878", tx: "#243A1A" },
  { id: "cobalt",  bg: "#B8C8E8", bd: "#7898C8", tx: "#1A2E50" },
  { id: "amber",   bg: "#E8D8A8", bd: "#C4A860", tx: "#3A2C10" },
  { id: "lav",     bg: "#D0C8E8", bd: "#A098C8", tx: "#2A2248" },
];

const COLS = ["inbox", "decide", "do", "waiting", "someday"];

const DEFAULT_LABELS = {
  inbox:   "🌊 On My Mind",
  decide:  "🤔 Needs a Decision",
  do:      "✅ Ready for Action",
  waiting: "⏳ Waiting on Others",
  someday: "🌱 Maybe Later",
};

const INIT = {
  inbox: [
    { id: "c1", text: "Schedule dentist for both kids", notes: "", color: "seafoam" },
    { id: "c2", text: "Return Amazon package", notes: "By July 15 — use front door dropbox.", color: "cobalt" },
    { id: "c3", text: "Mom's birthday is next month", notes: "", color: "sage" },
    { id: "c4", text: "Check school registration deadline", notes: "", color: "aqua" },
  ],
  decide: [
    { id: "c5", text: "Summer camp — register or skip?", notes: "Deadline July 1. $450. Kids really want to go.", color: "amber" },
    { id: "c6", text: "Switch car insurance provider", notes: "", color: "seafoam" },
    { id: "c7", text: "Piano lessons — keep or pause?", notes: "", color: "lav" },
  ],
  do: [
    { id: "c8", text: "Buy dog food", notes: "", color: "sage" },
    { id: "c9", text: "Call insurance re: claim", notes: "Claim #4892-B. Before 5pm.", color: "aqua" },
    { id: "c10", text: "Plan 4th of July", notes: "", color: "amber" },
    { id: "c11", text: "Fix back porch light", notes: "", color: "cobalt" },
  ],
  waiting: [
    { id: "c12", text: "HOA response to fence request", notes: "Submitted June 3.", color: "seafoam" },
    { id: "c13", text: "Kids' report cards", notes: "", color: "aqua" },
    { id: "c14", text: "Refund from dentist office", notes: "", color: "sage" },
    { id: "c15", text: "Sister to confirm reunion dates", notes: "", color: "lav" },
  ],
  someday: [
    { id: "c16", text: "Family road trip — national parks", notes: "", color: "lav" },
    { id: "c17", text: "Learn sourdough baking", notes: "", color: "seafoam" },
    { id: "c18", text: "Set up dedicated art corner", notes: "", color: "aqua" },
    { id: "c19", text: "Start family podcast?", notes: "", color: "sage" },
  ],
};

let nextId = 20;

function getColor(id) {
  return COLORS.find((c) => c.id === id) || COLORS[0];
}

function findCard(state, id) {
  for (const col of COLS) {
    const idx = state[col].findIndex((c) => c.id === id);
    if (idx !== -1) return { col, idx, card: state[col][idx] };
  }
  return null;
}

function moveCard(state, dragId, fromCol, targetId, targetCol, above) {
  const next = {};
  for (const col of COLS) next[col] = [...state[col]];
  const fi = next[fromCol].findIndex((c) => c.id === dragId);
  if (fi === -1) return state;
  const [moved] = next[fromCol].splice(fi, 1);
  const ti = next[targetCol].findIndex((c) => c.id === targetId);
  const insertAt = ti === -1 ? next[targetCol].length : above ? ti : ti + 1;
  next[targetCol].splice(insertAt, 0, moved);
  return next;
}

function moveCardToCol(state, dragId, fromCol, toCol) {
  const next = {};
  for (const col of COLS) next[col] = [...state[col]];
  const fi = next[fromCol].findIndex((c) => c.id === dragId);
  if (fi === -1) return state;
  const [moved] = next[fromCol].splice(fi, 1);
  next[toCol].push(moved);
  return next;
}

const navy = "#1B2E4F";

export default function Exhale() {
  const [cards, setCards] = useState(INIT);
  const [expanded, setExpanded] = useState(null);
  const [input, setInput] = useState("");
  const [drag, setDrag] = useState(null);
  const [dropOver, setDropOver] = useState(null);
  const [colLabels, setColLabels] = useState(DEFAULT_LABELS);
  const [editingCol, setEditingCol] = useState(null);
  const [hoverCol, setHoverCol] = useState(null);

  const total = COLS.reduce((s, c) => s + cards[c].length, 0);
  const expFound = expanded ? findCard(cards, expanded) : null;

  function addCard() {
    const txt = input.trim();
    if (!txt) return;
    const color = COLORS[cards.inbox.length % COLORS.length].id;
    setCards((prev) => ({
      ...prev,
      inbox: [{ id: "c" + nextId++, text: txt, notes: "", color }, ...prev.inbox],
    }));
    setInput("");
  }

  function toggleExpand(id) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function setNote(id, val) {
    setCards((prev) => {
      const next = {};
      for (const col of COLS) next[col] = prev[col].map((c) => (c.id === id ? { ...c, notes: val } : c));
      return next;
    });
  }

  function setColor(id, color) {
    setCards((prev) => {
      const next = {};
      for (const col of COLS) next[col] = prev[col].map((c) => (c.id === id ? { ...c, color } : c));
      return next;
    });
  }

  function updateLabel(col, val) {
    setColLabels((prev) => ({ ...prev, [col]: val }));
  }

  function onDragStart(e, cardId, col) {
    setDrag({ id: cardId, fromCol: col });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text", cardId);
  }

  function onDragEnd() {
    setDrag(null);
    setDropOver(null);
  }

  function onCardDragOver(e, cardId, col) {
    if (!drag || drag.id === cardId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    setDropOver({ type: "card", id: cardId, col, above });
  }

  function onColDragOver(e, col) {
    e.preventDefault();
    if (dropOver && dropOver.type === "card") return;
    setDropOver({ type: "col", col });
  }

  function onCardDrop(e, cardId, col) {
    e.preventDefault();
    e.stopPropagation();
    if (!drag || drag.id === cardId) return;
    const above = dropOver && dropOver.id === cardId ? dropOver.above : true;
    setCards((prev) => moveCard(prev, drag.id, drag.fromCol, cardId, col, above));
    setDrag(null);
    setDropOver(null);
  }

  function onColDrop(e, col) {
    e.preventDefault();
    if (!drag) return;
    setCards((prev) => moveCardToCol(prev, drag.id, drag.fromCol, col));
    setDrag(null);
    setDropOver(null);
  }

  const baseCard = {
    borderRadius: 7,
    padding: "8px 9px",
    marginBottom: 5,
    fontSize: 11.5,
    lineHeight: 1.4,
    cursor: "grab",
    borderWidth: "0.5px",
    borderStyle: "solid",
    userSelect: "none",
    transition: "opacity 0.12s",
  };

  const qbtn = {
    fontSize: 10.5,
    padding: "3px 9px",
    borderRadius: 20,
    border: "0.5px solid rgba(0,0,0,0.18)",
    background: "rgba(0,0,0,0.06)",
    cursor: "pointer",
    color: "var(--color-text-secondary)",
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
  };

  return (
    <div style={{ fontFamily: "var(--font-sans)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden" }}>

      {/* App bar */}
      <div style={{ background: navy, padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
        <span>💨</span>
        <span style={{ color: "#E8C76A" }}>Exhale</span>
        <span style={{ marginLeft: "auto", fontSize: 10 }}>{total} items</span>
      </div>

      {/* Capture */}
      <div style={{ display: "flex", gap: 8, padding: "11px 12px", borderBottom: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCard()}
          placeholder="What's on your mind? Drop it here."
          style={{ flex: 1, padding: "8px 11px", fontSize: 13, border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
        />
        <button onClick={addCard} style={{ background: navy, color: "white", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12, cursor: "pointer" }}>
          + Add
        </button>
      </div>

      {/* Kanban */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", minHeight: 300, borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        {COLS.map((col, ci) => {
          const isColHover = dropOver && dropOver.type === "col" && dropOver.col === col;
          const isEditing = editingCol === col;
          const isHovering = hoverCol === col;

          return (
            <div
              key={col}
              onDragOver={(e) => onColDragOver(e, col)}
              onDrop={(e) => onColDrop(e, col)}
              onDragLeave={() => setDropOver(null)}
              onMouseEnter={() => setHoverCol(col)}
              onMouseLeave={() => setHoverCol(null)}
              style={{
                padding: "10px 7px",
                borderRight: ci < 4 ? "0.5px solid var(--color-border-tertiary)" : "none",
                background: isColHover ? "rgba(27,46,79,0.05)" : "transparent",
                transition: "background 0.12s",
              }}
            >
              {/* Editable column header */}
              <div style={{ marginBottom: 8, minHeight: 26, display: "flex", alignItems: "flex-start", gap: 4 }}>
                {isEditing ? (
                  <input
                    autoFocus
                    value={colLabels[col]}
                    onChange={(e) => updateLabel(col, e.target.value)}
                    onBlur={() => setEditingCol(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") setEditingCol(null);
                    }}
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontWeight: 500,
                      border: "none",
                      background: "transparent",
                      color: "var(--color-text-primary)",
                      outline: "none",
                      borderBottom: `1.5px solid ${navy}`,
                      padding: "0 0 2px 0",
                      fontFamily: "inherit",
                      lineHeight: 1.4,
                    }}
                  />
                ) : (
                  <span
                    onClick={() => setEditingCol(col)}
                    title="Click to rename"
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--color-text-secondary)",
                      cursor: "text",
                      lineHeight: 1.3,
                    }}
                  >
                    {colLabels[col]}
                  </span>
                )}
                <span style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "1px 4px", fontSize: 9, color: "var(--color-text-tertiary)", flexShrink: 0, marginTop: 2 }}>
                  {cards[col].length}
                </span>
                {isHovering && !isEditing && (
                  <span
                    onClick={() => setEditingCol(col)}
                    style={{ fontSize: 10, cursor: "pointer", color: "var(--color-text-tertiary)", flexShrink: 0, marginTop: 1, lineHeight: 1 }}
                    title="Rename"
                  >
                    ✎
                  </span>
                )}
              </div>

              {/* Cards */}
              {cards[col].map((card) => {
                const c = getColor(card.color);
                const isExp = expanded === card.id;
                const isDragging = drag && drag.id === card.id;
                const isAbove = dropOver && dropOver.type === "card" && dropOver.id === card.id && dropOver.above;
                const isBelow = dropOver && dropOver.type === "card" && dropOver.id === card.id && !dropOver.above;

                return (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, card.id, col)}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => onCardDragOver(e, card.id, col)}
                    onDrop={(e) => onCardDrop(e, card.id, col)}
                    style={{
                      ...baseCard,
                      background: c.bg,
                      borderColor: c.bd,
                      color: c.tx,
                      opacity: isDragging ? 0.25 : 1,
                      outline: isExp ? `1.5px solid ${navy}` : "none",
                      outlineOffset: 0,
                      ...(isAbove && { borderTop: `2.5px solid ${navy}` }),
                      ...(isBelow && { borderBottom: `2.5px solid ${navy}` }),
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                      <span style={{ flex: 1, fontSize: 11.5, lineHeight: 1.4 }}>{card.text}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(card.id); }}
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
        <div style={{ background: "var(--color-background-secondary)", borderTop: "0.5px solid var(--color-border-tertiary)", padding: "14px 16px", borderLeft: `3px solid ${getColor(expFound.card.color).bd}` }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 8 }}>
            {expFound.card.text}
          </div>
          <textarea
            value={expFound.card.notes}
            onChange={(e) => setNote(expanded, e.target.value)}
            placeholder="Add notes, context, deadline..."
            style={{ width: "100%", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, padding: "8px 10px", fontSize: 12, resize: "vertical", minHeight: 60, background: "var(--color-background-primary)", color: "var(--color-text-primary)", lineHeight: 1.5, fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>Color</span>
            {COLORS.map((cl) => (
              <div
                key={cl.id}
                onClick={() => setColor(expanded, cl.id)}
                title={cl.id}
                style={{ width: 16, height: 16, borderRadius: "50%", background: cl.bg, border: `2px solid ${cl.id === expFound.card.color ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.15)"}`, cursor: "pointer", flexShrink: 0 }}
              />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9, flexWrap: "wrap" }}>
            <button style={qbtn}>✓ Make task</button>
            <button style={qbtn}>📅 Calendar</button>
            <button style={qbtn}>🗂 Send to Anchor</button>
            <button style={qbtn}>🗃 Archive</button>
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
      <div style={{ margin: "10px 16px", background: "#EEF3FF", borderLeft: `3px solid ${navy}`, borderRadius: "0 8px 8px 0", padding: "10px 14px" }}>
        <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "#7A8FB5", marginBottom: 5 }}>
          🧭 Compass found 4 things it can help with
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
          {["✓ Create task", "📅 Add reminder", "🛒 Move to shopping", "📆 Add to calendar"].map((label) => (
            <button key={label} style={{ ...qbtn, background: "white", border: `0.5px solid ${navy}`, color: navy, fontSize: 10.5 }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        <button
          style={{ fontSize: 12, width: "100%", padding: 9, border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", cursor: "pointer", marginTop: 4 }}
        >
          Discuss Exhale build plan ↗
        </button>
      </div>
    </div>
  );
}
