import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import ColorPicker from "./ColorPicker.jsx";
import UndoToast from "./UndoToast.jsx";

var CARD_COLORS = [
  { id: "seafoam", bg: "#C2E8DA", bd: "#85BFAB", tx: "#1C3A2E" },
  { id: "aqua",    bg: "#B2E0E8", bd: "#6ABEC8", tx: "#143640" },
  { id: "sage",    bg: "#C4D8B8", bd: "#8AB878", tx: "#243A1A" },
  { id: "cobalt",  bg: "#B8C8E8", bd: "#7898C8", tx: "#1A2E50" },
  { id: "amber",   bg: "#E8D8A8", bd: "#C4A860", tx: "#3A2C10" },
  { id: "lav",     bg: "#D0C8E8", bd: "#A098C8", tx: "#2A2248" },
];

var EMOJIS = ["⭐","🌟","❤️","🔴","💙","🟡","🟢","📌","⚡","🎯","💡","🔔"];

// Exhale columns — user-managed (af_exhale_columns). COLS/DEFAULT_LABELS
// below are now only the SEED for a first-run migration, not the live
// column list — every runtime read goes through the `columns` state
// (an array of {id,label,color,emoji}), never these two directly.
var COLS = ["inbox","decide","do","waiting","someday"];

var DEFAULT_LABELS = {
  inbox:   "🌊 On My Mind",
  decide:  "🤔 Needs a Decision",
  do:      "✅ Ready for Action",
  waiting: "⏳ Waiting on Others",
  someday: "🌱 Maybe Later",
};

var DEFAULT_LABEL_TEXT = { inbox: "On My Mind", decide: "Needs a Decision", do: "Ready for Action", waiting: "Waiting on Others", someday: "Maybe Later" };
var DEFAULT_EMOJI = { inbox: "🌊", decide: "🤔", do: "✅", waiting: "⏳", someday: "🌱" };
// Column color cycles through the same 6-swatch palette already used for
// card colors (CARD_COLORS) — there is no separate column-color palette,
// this reuses the one that already exists.
var DEFAULT_COLUMN_COLOR_IDS = ["seafoam","aqua","sage","cobalt","amber"];
var MAX_COLUMNS = 8;

// F-39: was hardcoded to the developer's own family names. ExhaleSection is
// self-contained (own af_exhale_people key, no people[] prop from App.jsx) — a
// new household starting with zero preset assignee tags is correct behavior,
// not a gap; they add their own via the UI.
var DEFAULT_PEOPLE = [];

var NAVY = "#1B2E4F";
var _nid = Date.now();
var LS_G    = "af_exhale_groups";
var LS_L    = "af_exhale_labels";
var LS_CL   = "af_exhale_color_labels";
var LS_P    = "af_exhale_people";
var LS_COLS = "af_exhale_columns";
// Person assignment + category tags — a new key, deliberately not reusing
// LS_CL (af_exhale_color_labels): that key's actual shape is a color-id ->
// label-string rename map for the old Kanban board's fixed palette, not a
// list of {id,label,color} category objects.
var LS_CAT = "af_exhale_categories";
var CATEGORY_COLOR_PRESETS = [
  { id: "coral",     label: "Coral",      color: "#d98a6e" },
  { id: "sage",      label: "Sage",       color: "#7a9e8e" },
  { id: "sky",       label: "Sky blue",   color: "#7aa8c8" },
  { id: "butter",    label: "Butter",     color: "#c8a97a" },
  { id: "dustyrose", label: "Dusty rose", color: "#c4849a" },
  { id: "navy",      label: "Navy",       color: "#1B2E4F" },
];
var EXHALE_V2 = localStorage.getItem("af_exhale_v2") !== "false";

// Exhale Phase 1 — bucket cards replace the column Kanban board as the
// primary UI. af_exhale_groups (LS_G above) stays registered in SYNC_KEYS
// and its Supabase realtime/migration effects below keep running untouched
// (so existing sync isn't broken and a later phase could still read it) —
// this is a new, separate key that the new UI reads/writes exclusively.
var LS_B = "af_exhale_buckets";
var EXHALE_BUCKETS_MIGRATED_FLAG = "af_exhale_buckets_migrated";
// v2: added "This Weekend" as a 5th bucket, renamed "Here" → "Exhaled".
// Separate flag from EXHALE_BUCKETS_MIGRATED_FLAG above so a household that
// already has real 4-bucket data (from before this change) gets upgraded
// in place exactly once, without re-running the columns→buckets migration.
var EXHALE_BUCKETS_V2_MIGRATED_FLAG = "af_exhale_buckets_v2_migrated";
var DEFAULT_BUCKET_NAMES = ["Exhaled", "Today", "Tomorrow", "This Weekend", "Someday"];
var BUCKET_COLORS = ["#4A9E8E", "#6ABAAA", "#7AB3D4", "#8BAF8B", "#A99AC4"];
function defaultBuckets() { return { bucketNames: DEFAULT_BUCKET_NAMES.slice(), items: [] }; }
// Onboarding Fix 2 — starter cards. Single source of truth for "has the
// first-use decision been made yet": onboarding's own seedExhaleStarterCards
// (App.jsx, wires the wizard's real user-edited cards) writes items directly
// but never touches this flag — it relies on this check seeing those items
// already present and skipping the tutorial fallback below, same as it would
// for any other pre-existing data. Checked once per mount, not per-render,
// so deleting every item afterward (the whole point of "dismissable") never
// resurrects these.
var EXHALE_STARTER_SEEDED_FLAG = "af_exhale_starter_seeded";
var EXHALE_STARTER_CARDS = [
  "Welcome to Exhale — dump anything on your mind here",
  "Try moving items to Today or Tomorrow using the arrow",
  "Add a thought and assign it to a family member",
];

// First-run seed: migrates any existing af_exhale_labels customization
// (or the initialLabels prop) onto the new {id,label,color,emoji} shape,
// so a household that already renamed a column doesn't lose that rename.
// A stored label that still matches the OLD baked-in "emoji + text" default
// is treated as never-customized and gets the clean split; anything else
// is preserved verbatim as the label (paired with the default emoji for
// that column, since a custom string's own emoji intent can't be inferred).
function seedDefaultColumns(existingLabels) {
  existingLabels = existingLabels || {};
  return COLS.map(function(id, i) {
    var stored = existingLabels[id];
    var customized = stored !== undefined && stored !== DEFAULT_LABELS[id];
    return {
      id: id,
      label: customized ? stored : DEFAULT_LABEL_TEXT[id],
      emoji: DEFAULT_EMOJI[id],
      color: DEFAULT_COLUMN_COLOR_IDS[i]
    };
  });
}

// Guaranteed-valid UUID v4, for values written to Postgres uuid columns.
// crypto.randomUUID() is unavailable pre-Safari 15.4 and outside secure
// contexts; crypto.getRandomValues() has much broader support (works in
// those same cases) and still yields a real UUID, not a downgraded format.
// Math.random() is the last-resort fallback if neither Crypto API exists.
function uuidv4() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch(e) {}
  }
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    try {
      var buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40;
      buf[8] = (buf[8] & 0x3f) | 0x80;
      var hex = Array.prototype.map.call(buf, function(b) { return b.toString(16).padStart(2, "0"); }).join("");
      return hex.slice(0,8) + "-" + hex.slice(8,12) + "-" + hex.slice(12,16) + "-" + hex.slice(16,20) + "-" + hex.slice(20);
    } catch(e) {}
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ─── helpers ───────────────────────────────────────────────────────────────
function getColor(id) {
  for (var i = 0; i < CARD_COLORS.length; i++) {
    if (CARD_COLORS[i].id === id) return CARD_COLORS[i];
  }
  return CARD_COLORS[0];
}

function lsGet(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e) { return fallback; }
}

function lsSet(key, val, opId) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
  if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] LOCALSTORAGE_WRITTEN key="+key);
  // Mark this key dirty and trigger a sync so the edit pushes to other devices.
  // ExhaleSection writes af_* keys directly (not via the app's setSaved), so
  // without this the change stays local and never reaches Supabase.
  try {
    var syncName = key.indexOf("af_") === 0 ? key.slice(3) : key;
    var dirty = JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]");
    if (dirty.indexOf(syncName) === -1) {
      dirty.push(syncName);
      localStorage.setItem("af_dirtyKeys", JSON.stringify(dirty));
      if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] DIRTY_KEY_ADDED key="+syncName);
    } else {
      if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] DIRTY_KEY_ALREADY_PRESENT key="+syncName);
    }
  } catch(e2) {}
  try {
    window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { opId: opId } }));
    if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] SYNC_EVENT_DISPATCHED");
  } catch(e3) {}
}

// columns: array of {id,label,color,emoji} — the live column set. Building
// from `columns` (not from whatever `g` already has) ensures a newly added
// or renamed-but-not-yet-reflected column always gets a bucket.
function emptyGroups(columns) {
  return Object.fromEntries(columns.map(function(c) { return [c.id, []]; }));
}

// effPos: treats stored 0 as "unset" (all inserts default to 0) — uses idx*1000 as virtual.
function effPos(card, idx) {
  if (typeof card.position === "number" && card.position !== 0) return card.position;
  return idx * 1000;
}

// Given a column array AFTER the splice and the moved card's index,
// returns a fractional position between its new neighbors.
function computeNewPosition(colCards, movedIdx) {
  var prevCard = movedIdx > 0 ? colCards[movedIdx - 1] : null;
  var nextCard = movedIdx < colCards.length - 1 ? colCards[movedIdx + 1] : null;
  var prevPos = prevCard ? effPos(prevCard, movedIdx - 1) : null;
  var nextPos = nextCard ? effPos(nextCard, movedIdx + 1) : null;
  if (prevPos === null && nextPos === null) return 1000;
  if (prevPos === null) return nextPos - 1000;
  if (nextPos === null) return prevPos + 1000;
  return (prevPos + nextPos) / 2;
}

// On load, assign real positions (1000, 2000, ...) to any card still at position=0.
// Mutates g in place. Called once at mount so all dragged positions compute correctly.
function bootstrapPositions(g, columns) {
  columns.forEach(function(c) {
    var col = g[c.id];
    if (!col) return;
    for (var j = 0; j < col.length; j++) {
      if (!col[j].position || col[j].position === 0) {
        col[j] = Object.assign({}, col[j], { position: (j + 1) * 1000 });
      }
    }
  });
  return g;
}

function groupItems(raw, columns) {
  var g = emptyGroups(columns);
  var colIds = columns.map(function(c) { return c.id; });
  var fallback = colIds[0] || "inbox";
  if (!raw || !Array.isArray(raw)) return g;
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var cat, entry;
    if (typeof item === "string") {
      cat   = fallback;
      entry = { id: "lg-" + i, text: item, notes: "", color: CARD_COLORS[i % CARD_COLORS.length].id, category: cat, createdAt: Date.now(), emoji: null, dueDate: null, assignedTo: null };
    } else {
      cat   = (item.category && g[item.category]) ? item.category : fallback;
      entry = { id: item.id || ("e-" + i), text: item.text || "", notes: item.notes || "", color: item.color || CARD_COLORS[i % CARD_COLORS.length].id, category: cat, createdAt: item.createdAt || Date.now(), emoji: item.emoji || null, dueDate: item.dueDate || null, assignedTo: item.assignedTo || null };
    }
    g[cat].push(entry);
  }
  return g;
}

// Unused in this file currently (kept for parity/reference) — Object.keys(g)
// based rather than columns-based, since it only needs to mirror whatever
// `g` already contains, same reasoning as clone()/findIn() below.
function flattenGroups(g) {
  var out = [];
  Object.keys(g).forEach(function(col) {
    (g[col] || []).forEach(function(c) {
      out.push({ id: c.id, text: c.text, notes: c.notes, color: c.color, category: col, createdAt: c.createdAt, emoji: c.emoji || null, dueDate: c.dueDate || null, assignedTo: c.assignedTo || null });
    });
  });
  return out;
}

// Structural — mirrors whatever keys `g` already has, no `columns` param
// needed. (A stale/missing key relative to the live `columns` array is a
// non-issue here: every mutation that can change the column set keeps
// `groups`'s own keys in sync at the same time — see addColumn/deleteColumn.)
function clone(g) {
  var n = {};
  Object.keys(g).forEach(function(k) { n[k] = (g[k] || []).slice(); });
  return n;
}

function findIn(g, id) {
  var keys = Object.keys(g);
  for (var i = 0; i < keys.length; i++) {
    var arr = g[keys[i]] || [];
    for (var j = 0; j < arr.length; j++) {
      if (arr[j].id === id) return { col: keys[i], card: arr[j] };
    }
  }
  return null;
}

function getToday() { return new Date().toISOString().split("T")[0]; }
function getTomorrow() { return new Date(Date.now() + 86400000).toISOString().split("T")[0]; }

function getDueMeta(dueDate) {
  if (!dueDate) return null;
  var today = getToday(), tomorrow = getTomorrow();
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var parts = dueDate.split("-");
  var label = months[parseInt(parts[1]) - 1] + " " + parseInt(parts[2]);
  if (dueDate === today)    return { label: "Today",    color: "#C4A860" };
  if (dueDate === tomorrow) return { label: "Tomorrow", color: "#8AB878" };
  if (dueDate < today)      return { label: label,      color: "#8B0000" };
  return                           { label: label,      color: "#7898C8" };
}

function cardMatchesFilters(card, filters) {
  if (filters.color  && card.color      !== filters.color)   return false;
  if (filters.emoji  && card.emoji      !== filters.emoji)   return false;
  if (filters.person && card.assignedTo !== filters.person)  return false;
  if (filters.date) {
    var today = getToday(), tomorrow = getTomorrow();
    if (filters.date === "today"    && card.dueDate !== today)                     return false;
    if (filters.date === "tomorrow" && card.dueDate !== tomorrow)                  return false;
    if (filters.date === "overdue"  && (!card.dueDate || card.dueDate >= today))   return false;
    if (filters.date === "upcoming" && (!card.dueDate || card.dueDate <= today))   return false;
  }
  return true;
}

function countFilters(filters) {
  return (filters.color ? 1 : 0) + (filters.emoji ? 1 : 0) + (filters.person ? 1 : 0) + (filters.date ? 1 : 0);
}

function initials(name) {
  if (!name) return "";
  var parts = name.trim().split(" ");
  return parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
}

// ─── component ─────────────────────────────────────────────────────────────
export default function ExhaleSection(props) {
  var initialItems  = props.initialItems  || [];
  var initialLabels = props.initialLabels || {};
  var householdId   = props.householdId   || null;

  // columns must be seeded before groups — groups' own initializer needs it.
  var [columns,     setColumns]     = useState(function() { return lsGet(LS_COLS, null) || seedDefaultColumns(lsGet(LS_L, null) || initialLabels); });
  var [groups,      setGroups]      = useState(function() {
    var g = lsGet(LS_G, null) || groupItems(initialItems, columns);
    if (EXHALE_V2) {
      bootstrapPositions(g, columns);
      lsSet(LS_G, g);
    }
    return g;
  });
  var [colorLabels, setColorLabels] = useState(function() { return lsGet(LS_CL, {}); });
  var [people,      setPeople]      = useState(function() { return lsGet(LS_P, null) || DEFAULT_PEOPLE; });
  var [filters,     setFilters]     = useState({ color: null, emoji: null, person: null, date: null });
  var [showFilters, setShowFilters] = useState(false);
  var [selectedId,  setSelectedId]  = useState(null);
  var [noteText,    setNoteText]    = useState("");
  var [inputText,   setInputText]   = useState("");
  var [editingCol,  setEditingCol]  = useState(null);
  var [addingPerson,setAddingPerson]= useState(false);
  var [newPerson,   setNewPerson]   = useState("");
  var [drag,        setDrag]        = useState(null);
  var [dropOver,    setDropOver]    = useState(null);
  var [showColPanel,setShowColPanel]= useState(false);
  var [colDrag,     setColDrag]     = useState(null); // index of the column row being dragged in the panel
  // V2: track per-card server confirmation state. "saving"|"saved"|"failed"
  var [cardSaveState, setCardSaveState] = useState({});
  // Tracks in-flight RPC ops so own Realtime echoes are ignored.
  // Keys: "<cardId>:UPDATE" or "<cardId>:DELETE"
  var pendingOps = useRef(new Set());

  useEffect(function() {
    if (!selectedId) { setNoteText(""); return; }
    var f = findIn(groups, selectedId);
    setNoteText(f ? f.card.notes : "");
  }, [selectedId]);

  // ── Exhale Phase 1 — bucket state ──────────────────────────────────────────
  var myPersonId = props.myPersonId || null;
  // The real household roster, passed in the same way myPersonId already is —
  // named householdPeople, not `people`, since this file already has its own
  // unrelated `people` state above (the old Kanban board's internal fake
  // people list for its retired assignedTo field, af_exhale_people).
  var householdPeople = props.people || [];
  var [categories, setCategories] = useState(function() { return lsGet(LS_CAT, []); });
  var [addingCategoryFor, setAddingCategoryFor] = useState(null); // itemId or null
  var [newCategoryLabel, setNewCategoryLabel] = useState("");
  var [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLOR_PRESETS[0].color);
  function persistCategories(next) {
    setCategories(next);
    lsSet(LS_CAT, next);
  }
  function addCategory(label, color) {
    var cat = { id: uuidv4(), label: label, color: color };
    persistCategories(categories.concat([cat]));
    return cat.id;
  }
  var [buckets, setBuckets] = useState(function() {
    var b = lsGet(LS_B, null);
    if (b && typeof b === "object" && Array.isArray(b.bucketNames) && Array.isArray(b.items)) return b;
    return defaultBuckets();
  });
  // All buckets default open so each card shows its items inline (sliced to
  // BUCKET_ITEM_LIMIT with a "Show N more" expand, below) rather than just a
  // header until tapped — previously only buckets 0/1 ("Exhaled"/"Today")
  // started open, so "Tomorrow"/"This Weekend"/"Someday" showed no items at
  // all on load.
  var [openBuckets, setOpenBuckets] = useState({ 0: true, 1: true, 2: true, 3: true, 4: true });
  var [expandedItemId, setExpandedItemId] = useState(null);
  // Direct bucket routing (Fix 4) — which item's "Move to..." menu is open,
  // one at a time. Replaced the old forward-only "→ {nextName}" chip, which
  // could only step to the adjacent bucket.
  var [moveMenuForItemId, setMoveMenuForItemId] = useState(null);
  var [editingBucketIdx, setEditingBucketIdx] = useState(null);
  var [bucketInputText, setBucketInputText] = useState("");
  var [bucketInputTarget, setBucketInputTarget] = useState(0);
  var [bucketAddOpenFor, setBucketAddOpenFor] = useState(null);
  var [bucketAddText, setBucketAddText] = useState("");
  // Show-more per bucket (idx -> bool) — local component state only, not
  // persisted, so it resets to collapsed on every reload by design.
  var [bucketShowAll, setBucketShowAll] = useState({});
  var BUCKET_ITEM_LIMIT = 5;
  // Checkbox bulk delete — select mode is per-bucket (idx -> bool), selected
  // item ids are a single flat set (item ids are globally unique, so no
  // bucket-scoping needed there; only one bucket can be in select mode at a
  // time in practice since entering it elsewhere doesn't clear this, but
  // ids from other buckets simply won't appear since their rows aren't
  // rendered with checkboxes unless that bucket is also in select mode).
  var [selectModeBucket, setSelectModeBucket] = useState({});
  var [selectedItemIds, setSelectedItemIds] = useState({});
  // Filter by person/category — local-only (not synced), per bucket:
  // { [bucketIdx]: { personId, categoryId } }. Independent single-select per
  // dimension (an item has at most one person and one category, so "person A
  // AND person B" would always be empty) — "All" just clears both.
  var [bucketFilters, setBucketFilters] = useState({});
  function getBucketFilter(idx) { return bucketFilters[idx] || { personId: null, categoryId: null }; }
  function setBucketPersonFilter(idx, personId) {
    var cur = getBucketFilter(idx);
    setBucketFilters(function(prev) { return Object.assign({}, prev, { [idx]: { personId: cur.personId === personId ? null : personId, categoryId: cur.categoryId } }); });
  }
  function setBucketCategoryFilter(idx, categoryId) {
    var cur = getBucketFilter(idx);
    setBucketFilters(function(prev) { return Object.assign({}, prev, { [idx]: { personId: cur.personId, categoryId: cur.categoryId === categoryId ? null : categoryId } }); });
  }
  function clearBucketFilter(idx) {
    setBucketFilters(function(prev) { return Object.assign({}, prev, { [idx]: { personId: null, categoryId: null } }); });
  }
  // Pointer-based drag between/within buckets — same idiom as Cove's
  // itemPointerDown (App.jsx CoveTab), not native HTML5 drag-and-drop.
  var [dragFromId, setDragFromId] = useState(null);
  var [dragOverId, setDragOverId] = useState(null);
  var bucketDragItem = useRef({ from: null, fromBucket: null, toBucket: null, toIdx: null, clone: null });

  function persistBuckets(nb) { setBuckets(nb); lsSet(LS_B, nb); }

  // Undo toast — one at a time (a new action replaces whatever's showing).
  // Pattern: mutators below snapshot `buckets` *before* they persist the
  // change, and undoFn just re-persists that snapshot wholesale. Timer lives
  // in a ref (not state) so setting it doesn't trigger an extra render.
  var [undoToast, setUndoToast] = useState(null); // { message, undoFn }
  var undoTimeoutRef = useRef(null);
  function showUndoToast(message, undoFn) {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoToast({ message: message, undoFn: undoFn });
    undoTimeoutRef.current = setTimeout(function() { setUndoToast(null); undoTimeoutRef.current = null; }, 4000);
  }
  function handleUndoClick() {
    if (undoTimeoutRef.current) { clearTimeout(undoTimeoutRef.current); undoTimeoutRef.current = null; }
    if (undoToast && undoToast.undoFn) undoToast.undoFn();
    setUndoToast(null);
  }

  // Onboarding Fix 2 — starter cards, first-mount only (see
  // EXHALE_STARTER_SEEDED_FLAG comment above for why this owns the flag).
  useEffect(function() {
    if (localStorage.getItem(EXHALE_STARTER_SEEDED_FLAG)) return;
    if (buckets.items.length === 0) {
      var starterItems = EXHALE_STARTER_CARDS.map(function(text) {
        return { id: uuidv4(), text: text, notes: "", bucketIndex: 0, createdAt: Date.now(), isExample: true };
      });
      persistBuckets(Object.assign({}, buckets, { items: starterItems.concat(buckets.items) }));
    }
    localStorage.setItem(EXHALE_STARTER_SEEDED_FLAG, "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Compass smart features — inert unless compassEnabled ──────────────────
  var compassEnabled = !!props.compassEnabled;

  // Fix 3: auto-categorize suggestion on add. Per-item suggestion, dismissed
  // or applied individually; never persisted, never blocks the add itself.
  var [compassSuggestions, setCompassSuggestions] = useState({});
  async function requestCompassSuggestion(item) {
    if (categories.length === 0 && householdPeople.length === 0) return;
    try {
      var catList = categories.map(function(c) { return c.id + ": " + c.label; }).join("\n") || "(none)";
      var peopleList = householdPeople.map(function(p) { return p.id + ": " + p.name; }).join("\n") || "(none)";
      var system = "You are a household task assistant. Given a short task description, suggest the best matching category and person from the provided lists, ONLY if one clearly applies. Respond ONLY with JSON: {\"categoryId\":null,\"personId\":null}. Use ONLY the exact ids provided, or null.";
      var userMsg = "Categories (id: label):\n" + catList + "\n\nHousehold members (id: name):\n" + peopleList + "\n\nTask: " + item.text;
      var r = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 150, system: system, messages: [{ role: "user", content: userMsg }] }) });
      if (!r.ok) return;
      var d = await r.json();
      var txtBlock = (d.content && d.content.find(function(b) { return b.type === "text"; })) || {};
      var parsed = JSON.parse((txtBlock.text || "{}").replace(/```json|```/g, "").trim());
      var cat = parsed.categoryId ? categories.find(function(c) { return c.id === parsed.categoryId; }) : null;
      var person = parsed.personId ? householdPeople.find(function(p) { return p.id === parsed.personId; }) : null;
      if (!cat && !person) return;
      setCompassSuggestions(function(prev) {
        return Object.assign({}, prev, { [item.id]: { categoryId: cat ? cat.id : null, categoryLabel: cat ? cat.label : null, personId: person ? person.id : null, personName: person ? person.name : null } });
      });
    } catch (e) { /* suggestion is best-effort — never surfaces an error to the user */ }
  }
  function applyCompassSuggestion(itemId) {
    var sug = compassSuggestions[itemId];
    if (!sug) return;
    var patch = {};
    if (sug.categoryId) patch.categoryId = sug.categoryId;
    if (sug.personId) patch.personId = sug.personId;
    updateBucketItem(itemId, patch);
    dismissCompassSuggestion(itemId);
  }
  function dismissCompassSuggestion(itemId) {
    setCompassSuggestions(function(prev) { var next = Object.assign({}, prev); delete next[itemId]; return next; });
  }

  // Fix 4: stale item nudge, Exhaled bucket (index 0) only. "Stale" = sitting
  // in bucket 0 for more than 7 days. Referenced by bucketIndex, not name,
  // since bucket names are user-renameable (same convention used elsewhere
  // in this file for the Exhaled bucket).
  var STALE_MS = 7 * 24 * 60 * 60 * 1000;
  var STALE_NUDGE_LS_KEY = "af_exhale_compass_nudge_last_shown";
  var staleItems = buckets.items
    .filter(function(it) { return it.bucketIndex === 0 && !it.archived && (Date.now() - (it.createdAt || 0)) > STALE_MS; })
    .sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
  var [staleReviewIds, setStaleReviewIds] = useState({});
  var [staleNudgeShownToday, setStaleNudgeShownToday] = useState(function() {
    return localStorage.getItem(STALE_NUDGE_LS_KEY) === new Date().toDateString();
  });
  var showStaleNudge = compassEnabled && staleItems.length > 0 && !staleNudgeShownToday;
  useEffect(function() {
    if (showStaleNudge) {
      localStorage.setItem(STALE_NUDGE_LS_KEY, new Date().toDateString());
      setStaleNudgeShownToday(true);
    }
  }, [showStaleNudge]);
  function reviewStaleItems() {
    var ids = {};
    staleItems.forEach(function(it) { ids[it.id] = true; });
    setStaleReviewIds(ids);
    setOpenBuckets(function(p) { return Object.assign({}, p, { 0: true }); });
  }
  function moveOldestStaleToSomeday() {
    if (staleItems.length === 0) return;
    updateBucketItem(staleItems[0].id, { bucketIndex: buckets.bucketNames.length - 1 });
  }
  // Lets "Review now" force-expand every stale item (overlaying the normal
  // single-expandedItemId model) while still letting each one be individually
  // collapsed afterward.
  function toggleItemExpanded(id) {
    var isExp = expandedItemId === id || !!staleReviewIds[id];
    if (isExp) {
      setExpandedItemId(function(cur) { return cur === id ? null : cur; });
      if (staleReviewIds[id]) setStaleReviewIds(function(prev) { var next = Object.assign({}, prev); delete next[id]; return next; });
    } else {
      setExpandedItemId(id);
    }
  }

  // One-time migration: af_exhale_groups (column data) → af_exhale_buckets.
  // Flag-gated (not just "buckets.items.length===0") so a household that
  // later archives/deletes every bucket item never re-migrates and silently
  // resurrects old column cards. Never overwrites existing bucket data.
  useEffect(function() {
    if (localStorage.getItem(EXHALE_BUCKETS_MIGRATED_FLAG)) return;
    var existing = lsGet(LS_B, null);
    if (existing && Array.isArray(existing.items) && existing.items.length > 0) {
      localStorage.setItem(EXHALE_BUCKETS_MIGRATED_FLAG, "1");
      return;
    }
    var g = lsGet(LS_G, null);
    if (!g || typeof g !== "object") { localStorage.setItem(EXHALE_BUCKETS_MIGRATED_FLAG, "1"); return; }
    var colIds = columns.map(function(c) { return c.id; });
    var migrated = [];
    colIds.forEach(function(colId, idx) {
      // Column 0 → Exhaled(0), 1 → Today(1), 2 → Tomorrow(2), anything
      // else → Someday(4). "This Weekend"(3) is new and has no column
      // equivalent, so migration never populates it.
      var bucketIdx = idx === 0 ? 0 : idx === 1 ? 1 : idx === 2 ? 2 : 4;
      (g[colId] || []).forEach(function(card) {
        if (!card) return;
        migrated.push({
          id: card.id || uuidv4(),
          text: card.text || "",
          notes: card.notes || "",
          bucketIndex: bucketIdx,
          createdAt: card.createdAt || Date.now(),
          color: card.color || CARD_COLORS[0].id,
        });
      });
    });
    if (migrated.length === 0) { localStorage.setItem(EXHALE_BUCKETS_MIGRATED_FLAG, "1"); return; }
    var nb = {
      bucketNames: (existing && Array.isArray(existing.bucketNames) && existing.bucketNames.length === 5) ? existing.bucketNames : DEFAULT_BUCKET_NAMES.slice(),
      items: migrated,
    };
    persistBuckets(nb);
    localStorage.setItem(EXHALE_BUCKETS_MIGRATED_FLAG, "1");
  }, []); // one-time on mount — deliberately no deps

  // One-time upgrade: households that already ran the migration above before
  // "This Weekend" existed have real 4-bucket data (bucketIndex 0-3). Inserts
  // "This Weekend" as the new bucket 3 and shifts old bucket 3 (Someday) to
  // 4. Reads localStorage directly (not the `buckets` state closure) so it
  // sees the OTHER migration's result correctly even when both run in the
  // same mount — see the comment on EXHALE_BUCKETS_V2_MIGRATED_FLAG.
  useEffect(function() {
    if (localStorage.getItem(EXHALE_BUCKETS_V2_MIGRATED_FLAG)) return;
    var current = lsGet(LS_B, null);
    if (!current || !Array.isArray(current.bucketNames) || current.bucketNames.length !== 4) {
      localStorage.setItem(EXHALE_BUCKETS_V2_MIGRATED_FLAG, "1");
      return;
    }
    var oldNames = current.bucketNames;
    var newNames = [
      oldNames[0] === "Here" ? "Exhaled" : oldNames[0],
      oldNames[1],
      oldNames[2],
      "This Weekend",
      oldNames[3],
    ];
    var newItems = (Array.isArray(current.items) ? current.items : []).map(function(it) {
      if (!it) return it;
      return it.bucketIndex === 3 ? Object.assign({}, it, { bucketIndex: 4 }) : it;
    });
    var nb = { bucketNames: newNames, items: newItems };
    persistBuckets(nb);
    localStorage.setItem(EXHALE_BUCKETS_V2_MIGRATED_FLAG, "1");
  }, []); // one-time on mount — deliberately no deps

  function visibleBucketItems(idx) {
    return buckets.items.filter(function(it) {
      if (!it || it.archived) return false;
      if (it.bucketIndex !== idx) return false;
      // Defensive private-item filter — nothing in this UI sets `private`
      // today, but if a future capture path (or migrated data) does, this
      // keeps the same createdBy/myPersonId contract Cove Notes uses.
      if (it.private && it.createdBy && myPersonId && it.createdBy !== myPersonId) return false;
      return true;
    });
  }

  function addBucketItem(text, bucketIndex) {
    var txt = (text || "").trim();
    if (!txt) return;
    var item = { id: uuidv4(), text: txt, notes: "", bucketIndex: bucketIndex, createdAt: Date.now(), color: BUCKET_COLORS[bucketIndex % BUCKET_COLORS.length] };
    var nb = Object.assign({}, buckets, { items: [item].concat(buckets.items) });
    persistBuckets(nb);
    if (compassEnabled) requestCompassSuggestion(item);
  }

  function updateBucketItem(id, patch) {
    var nb = Object.assign({}, buckets, {
      items: buckets.items.map(function(it) { return it.id === id ? Object.assign({}, it, patch) : it; })
    });
    persistBuckets(nb);
  }

  function togglePersonAssignment(itemId, personId) {
    var it = buckets.items.find(function(x) { return x.id === itemId; });
    updateBucketItem(itemId, { personId: (it && it.personId === personId) ? null : personId });
  }
  function toggleCategoryAssignment(itemId, categoryId) {
    var it = buckets.items.find(function(x) { return x.id === itemId; });
    updateBucketItem(itemId, { categoryId: (it && it.categoryId === categoryId) ? null : categoryId });
  }

  function deleteBucketItem(id, text) {
    if (!window.confirm("Delete \"" + (text || "this item") + "\"?")) return;
    var nb = Object.assign({}, buckets, { items: buckets.items.filter(function(it) { return it.id !== id; }) });
    persistBuckets(nb);
    if (expandedItemId === id) setExpandedItemId(null);
  }

  // Quick X button — deletes immediately, no confirm. Kept separate from
  // deleteBucketItem above (which the expanded view's "Delete" chip still
  // uses) so that existing confirm-before-delete behavior isn't touched.
  function deleteBucketItemImmediate(id) {
    var existed = buckets.items.some(function(it) { return it.id === id; });
    var snapshot = buckets;
    var nb = Object.assign({}, buckets, { items: buckets.items.filter(function(it) { return it.id !== id; }) });
    persistBuckets(nb);
    if (expandedItemId === id) setExpandedItemId(null);
    setSelectedItemIds(function(prev) {
      if (!(id in prev)) return prev;
      var n = Object.assign({}, prev); delete n[id]; return n;
    });
    if (existed) showUndoToast("Item deleted", function() { persistBuckets(snapshot); });
  }

  function toggleSelectMode(idx) {
    setSelectModeBucket(function(prev) {
      var next = Object.assign({}, prev, { [idx]: !prev[idx] });
      return next;
    });
    // Leaving select mode (or entering a different bucket's) clears any
    // checked items so a stale selection can't linger into a later session.
    setSelectedItemIds(function(prev) {
      var n = {};
      Object.keys(prev).forEach(function(id) {
        var it = buckets.items.find(function(x) { return x.id === id; });
        if (it && it.bucketIndex === idx) return; // dropping this bucket's selections
        n[id] = true;
      });
      return n;
    });
  }

  function toggleItemSelected(id) {
    setSelectedItemIds(function(prev) {
      var n = Object.assign({}, prev);
      if (n[id]) delete n[id]; else n[id] = true;
      return n;
    });
  }

  function deleteSelectedItems(idx) {
    var idsInBucket = buckets.items.filter(function(it) { return it.bucketIndex === idx && selectedItemIds[it.id]; }).map(function(it) { return it.id; });
    if (idsInBucket.length === 0) return;
    var idSet = {}; idsInBucket.forEach(function(id) { idSet[id] = true; });
    var nb = Object.assign({}, buckets, { items: buckets.items.filter(function(it) { return !idSet[it.id]; }) });
    persistBuckets(nb);
    setSelectedItemIds(function(prev) {
      var n = Object.assign({}, prev);
      idsInBucket.forEach(function(id) { delete n[id]; });
      return n;
    });
    if (expandedItemId && idSet[expandedItemId]) setExpandedItemId(null);
  }

  // Fix 4 — direct bucket routing: jump to any bucket, not just one step
  // forward. Replaces the old moveBucketItemForward (single-step "→ next").
  function moveBucketItemTo(id, destIdx) {
    var it = buckets.items.find(function(x) { return x.id === id; });
    if (!it || it.bucketIndex === destIdx) return;
    var snapshot = buckets;
    updateBucketItem(id, { bucketIndex: destIdx });
    // Bug fix: moving an item into a bucket that defaults collapsed (Tomorrow/
    // This Weekend/Someday — see openBuckets init) looked like the item had
    // vanished, since nothing ever opened the destination. Auto-open it here.
    setOpenBuckets(function(prev) { return Object.assign({}, prev, { [destIdx]: true }); });
    showUndoToast("Item moved to " + buckets.bucketNames[destIdx], function() { persistBuckets(snapshot); });
  }

  function renameBucket(idx, name) {
    var nb = Object.assign({}, buckets, {
      bucketNames: buckets.bucketNames.map(function(n, i) { return i === idx ? name : n; })
    });
    persistBuckets(nb);
    setEditingBucketIdx(null);
  }

  function toggleBucketOpen(idx) {
    setOpenBuckets(function(prev) { return Object.assign({}, prev, { [idx]: !prev[idx] }); });
  }

  // Header "Collapse all" — closes every bucket, including Exhaled/Today
  // (which default open). No expand-all counterpart: opening one back up is
  // a single tap.
  function collapseAllBuckets() {
    var next = {};
    for (var i = 0; i < buckets.bucketNames.length; i++) { next[i] = false; }
    setOpenBuckets(next);
  }

  // Pointer-based drag for bucket items — same idiom as Cove's
  // itemPointerDown (App.jsx CoveTab): clone the row, follow the pointer,
  // hit-test with document.elementFromPoint against data-bucketitemid (drop
  // onto a specific item) and data-bucketidx (drop onto a bucket's header/
  // body with no specific item target — appended to the end of that bucket).
  function bucketItemPointerDown(e, item) {
    // Drag now initiates from anywhere on the row (not just a handle dot), so
    // a plain tap-to-expand must not be misread as "dropped in place" and
    // pushed to the end of the bucket. Gate the actual drag machinery (clone,
    // preventDefault, reorder-on-release) behind a small movement threshold —
    // below it, this is just a click and the row's own onClick handles it.
    if (e.button !== undefined && e.button !== 0) return;
    var rowEl = e.currentTarget.closest("[data-bucketitemid]") || e.currentTarget;
    var startX = e.clientX, startY = e.clientY;
    var dragStarted = false, clone = null;

    function beginDrag(ev) {
      dragStarted = true;
      bucketDragItem.current.from = item.id;
      bucketDragItem.current.fromBucket = item.bucketIndex;
      bucketDragItem.current.toBucket = item.bucketIndex;
      bucketDragItem.current.toIdx = null;
      setDragFromId(item.id);

      clone = rowEl.cloneNode(true);
      clone.setAttribute("data-bucket-drag-clone", "1");
      clone.style.cssText = "position:fixed;pointer-events:none;opacity:0.85;z-index:9999;width:" + rowEl.offsetWidth + "px;background:" + bgP + ";border:1.5px solid " + (item.color || "#888") + ";border-radius:8px;padding:8px 10px;box-shadow:0 4px 18px rgba(0,0,0,0.15);transition:none;";
      clone.style.left = (ev.clientX - 20) + "px";
      clone.style.top  = (ev.clientY - 16) + "px";
      document.body.appendChild(clone);
      bucketDragItem.current.clone = clone;
    }
    function onMove(ev) {
      if (!dragStarted) {
        if (Math.abs(ev.clientX - startX) < 6 && Math.abs(ev.clientY - startY) < 6) return;
        beginDrag(ev);
      }
      clone.style.left = (ev.clientX - 20) + "px";
      clone.style.top  = (ev.clientY - 16) + "px";
      clone.style.display = "none";
      var el = document.elementFromPoint(ev.clientX, ev.clientY);
      clone.style.display = "";
      var row = el && el.closest("[data-bucketitemid]");
      var bucketEl = el && el.closest("[data-bucketidx]");
      bucketDragItem.current.toBucket = bucketEl ? parseInt(bucketEl.getAttribute("data-bucketidx"), 10) : bucketDragItem.current.fromBucket;
      if (row) {
        var rid = row.getAttribute("data-bucketitemid");
        if (rid !== bucketDragItem.current.from) { bucketDragItem.current.toIdx = rid; setDragOverId(rid); }
      } else { bucketDragItem.current.toIdx = null; setDragOverId(null); }
    }
    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
      document.querySelectorAll("[data-bucket-drag-clone]").forEach(function(el) { try { el.remove(); } catch(e) {} });
      bucketDragItem.current.clone = null;
      setDragFromId(null); setDragOverId(null);
    }
    function onUp() {
      if (!dragStarted) { cleanup(); return; } // plain tap — let the row's own onClick handle it
      var fromId = bucketDragItem.current.from;
      var toBucket = bucketDragItem.current.toBucket;
      var toId = bucketDragItem.current.toIdx;
      bucketDragItem.current.from = bucketDragItem.current.toIdx = null;
      cleanup();
      if (!fromId) return;
      var arr = buckets.items.slice();
      var fromIdx = arr.findIndex(function(i) { return i.id === fromId; });
      if (fromIdx === -1) return;
      var moved = Object.assign({}, arr[fromIdx], { bucketIndex: toBucket });
      arr.splice(fromIdx, 1);
      var toIdx2 = toId ? arr.findIndex(function(i) { return i.id === toId; }) : -1;
      if (toIdx2 === -1) arr.push(moved); else arr.splice(toIdx2, 0, moved);
      persistBuckets(Object.assign({}, buckets, { items: arr }));
      // Same fix as moveBucketItemTo — a drag drop into a collapsed
      // bucket (Tomorrow/This Weekend/Someday) must open it, or the moved
      // item looks like it vanished.
      setOpenBuckets(function(prev) { return Object.assign({}, prev, { [toBucket]: true }); });
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", cleanup, { once: true });
  }

  // V2 first-run migration: contribute this device's local cards to exhale_cards.
  // Per-device flag (af_exhale_migrated_<householdId>) so every device runs once,
  // regardless of whether another device already populated the table.
  // ON CONFLICT (id) DO NOTHING means duplicate card ids are silently skipped.
  // Flag is only set on success — failed migration retries on next mount.
  useEffect(function() {
    if (!EXHALE_V2) return;
    if (!householdId) return;
    var flagKey = "af_exhale_migrated_" + householdId;
    if (localStorage.getItem(flagKey)) return;

    var localGroups = lsGet(LS_G, null);
    var cards = [];
    if (localGroups) {
      Object.keys(localGroups).forEach(function(col) {
        var colCards = Array.isArray(localGroups[col]) ? localGroups[col] : [];
        colCards.forEach(function(card, idx) {
          if (!card || !card.id) return;
          cards.push({
            id:           card.id,
            household_id: householdId,
            text:         card.text    || "",
            notes:        card.notes   || "",
            color:        card.color   || "",
            category:     col,
            emoji:        card.emoji   || null,
            due_date:     card.dueDate ? new Date(card.dueDate).toISOString().slice(0,10) : null,
            assigned_to:  card.assignedTo || null,
            position:     idx,
            created_at:   card.createdAt ? new Date(card.createdAt).toISOString() : new Date().toISOString(),
          });
        });
      });
    }

    if (cards.length === 0) {
      localStorage.setItem(flagKey, "1");
      return;
    }

    supabase
      .from("exhale_cards")
      .upsert(cards, { onConflict: "id", ignoreDuplicates: true })
      .then(function(result) {
        if (result.error) {
          console.warn("[AF] Exhale migration error:", result.error.message);
          return; // flag NOT set — retries on next re-run
        }
        // F-40(b): heal cards this device inserted with a null household_id
        // during the pre-resolution window (handleAdd, before householdId
        // resolved). Column-only update, gated on household_id IS NULL, so
        // we never touch text/notes/position/etc. on rows another device
        // may have already edited since this local snapshot was taken.
        var ids = cards.map(function(c) { return c.id; });
        supabase
          .from("exhale_cards")
          .update({ household_id: householdId })
          .in("id", ids)
          .is("household_id", null)
          .then(function(healResult) {
            if (healResult.error) {
              console.warn("[AF] Exhale orphan household_id heal failed:", healResult.error.message);
            }
            // Flag set regardless of heal outcome -- heal is best-effort on
            // top of an already-successful migration; retrying the whole
            // migration for a heal-only failure would be wasteful/risky.
            localStorage.setItem(flagKey, "1");
            window.AF_DEBUG && console.log("[AF] Exhale migration done:", cards.length, "card(s) contributed.");
          });
      });
  }, [householdId]); // re-runs when householdId resolves null → real id; flag guards re-migration

  // V2 initial load: fetch all household cards from exhale_cards on mount.
  // Runs independently of migration so devices where migration already ran
  // (including those that had 0 local cards to migrate) still load the
  // household's current cards from the DB on every mount.
  useEffect(function() {
    if (!EXHALE_V2) return;
    if (!householdId) return;
    supabase
      .from("exhale_cards")
      .select("*")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .then(function(result) {
        if (result.error) {
          console.warn("[AF] Exhale load error:", result.error.message);
          return;
        }
        if (!result.data || !result.data.length) return;
        var newGroups = {};
        // Null/unknown category → the first live column (a real, visible one).
        // The old "brain" default predates F-62 and wasn't a member of COLS at
        // the time, so clone()/flattenGroups (COLS-only then) silently dropped
        // those cards on the next mutation — legacy/uncategorized cards vanished.
        // Now validated against the LIVE column set (not the static seed list),
        // so a card orphaned by a since-deleted/renamed column still lands
        // somewhere visible instead of becoming an invisible ghost.
        var loadColIds = columns.map(function(c) { return c.id; });
        result.data.forEach(function(row) {
          var col = (row.category && loadColIds.indexOf(row.category) !== -1) ? row.category : (loadColIds[0] || "inbox");
          if (!newGroups[col]) newGroups[col] = [];
          newGroups[col].push({
            id:         row.id,
            text:       row.text        || "",
            notes:      row.notes       || "",
            color:      row.color       || "",
            emoji:      row.emoji       || null,
            dueDate:    row.due_date    || null,
            assignedTo: row.assigned_to || null,
            position:   row.position    || 0,
            createdAt:  row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          });
        });
        Object.keys(newGroups).forEach(function(col) {
          newGroups[col].sort(function(a, b) { return (a.position || 0) - (b.position || 0) || (a.createdAt || 0) - (b.createdAt || 0); });
        });
        setGroups(function(prev) {
          return Object.assign({}, prev, newGroups);
        });
      });
  }, [householdId]);

  // V2 Realtime: apply remote INSERTs in-place — no window.location.reload().
  // Dedupes on card id (own echo after optimistic add returns prev unchanged).
  // Deps: [householdId] — re-runs when householdId resolves null → real id.
  // Cleanup removes the channel before re-running so we never double-subscribe.
  useEffect(function() {
    if (!EXHALE_V2) return;
    if (!householdId) return;

    var channel = supabase
      .channel("exhale-" + householdId)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "exhale_cards",
        filter: "household_id=eq." + householdId
      }, function(payload) {
        if (payload.eventType === "INSERT") {
          var row = payload.new;
          if (!row || !row.id) return;
          var col = row.category || "inbox";
          setGroups(function(prev) {
            var allCols = Object.keys(prev);
            for (var i = 0; i < allCols.length; i++) {
              var arr = prev[allCols[i]];
              for (var j = 0; j < arr.length; j++) {
                if (arr[j].id === row.id) return prev; // own echo, skip
              }
            }
            var card = {
              id:         row.id,
              text:       row.text        || "",
              notes:      row.notes       || "",
              color:      row.color       || "",
              category:   col,
              emoji:      row.emoji       || null,
              dueDate:    row.due_date    || null,
              assignedTo: row.assigned_to || null,
              createdAt:  row.created_at ? new Date(row.created_at).getTime() : Date.now(),
              position:   typeof row.position === "number" ? row.position : 0,
            };
            var ng = clone(prev);
            if (!ng[col]) ng[col] = [];
            ng[col] = [card].concat(ng[col]);
            // SERVER-origin (dedup guard above rules out own echo) — do NOT lsSet, would echo-push back. See F-61.
            try { localStorage.setItem(LS_G, JSON.stringify(ng)); } catch(e) {}
            return ng;
          });

        } else if (payload.eventType === "UPDATE") {
          var opKey = payload.new.id + ":UPDATE";
          if (pendingOps.current.has(opKey)) { pendingOps.current.delete(opKey); return; }
          var row = payload.new;
          setGroups(function(prev) {
            var ng = clone(prev);
            Object.keys(ng).forEach(function(k) { ng[k] = ng[k].filter(function(c) { return c.id !== row.id; }); });
            var card = {
              id:         row.id,
              text:       row.text        || "",
              notes:      row.notes       || "",
              color:      row.color       || "",
              category:   row.category    || "inbox",
              emoji:      row.emoji       || null,
              dueDate:    row.due_date    || null,
              assignedTo: row.assigned_to || null,
              createdAt:  row.created_at  ? new Date(row.created_at).getTime() : Date.now(),
              position:   typeof row.position === "number" ? row.position : 0,
            };
            var col = card.category;
            if (!ng[col]) ng[col] = [];
            ng[col].push(card);
            ng[col].sort(function(a, b) { return (a.position || 0) - (b.position || 0) || (a.createdAt || 0) - (b.createdAt || 0); });
            // SERVER-origin (dedup guard above rules out own echo) — do NOT lsSet, would echo-push back. See F-61.
            try { localStorage.setItem(LS_G, JSON.stringify(ng)); } catch(e) {}
            return ng;
          });

        } else if (payload.eventType === "DELETE") {
          var opKey = (payload.old && payload.old.id) ? payload.old.id + ":DELETE" : null;
          if (opKey && pendingOps.current.has(opKey)) { pendingOps.current.delete(opKey); return; }
          var deletedId = payload.old && payload.old.id;
          if (!deletedId) return;
          setGroups(function(prev) {
            var ng = clone(prev);
            Object.keys(ng).forEach(function(k) { ng[k] = ng[k].filter(function(c) { return c.id !== deletedId; }); });
            // SERVER-origin (dedup guard above rules out own echo) — do NOT lsSet, would echo-push back. See F-61.
            try { localStorage.setItem(LS_G, JSON.stringify(ng)); } catch(e) {}
            return ng;
          });
        }
      })
      .subscribe();

    return function() { supabase.removeChannel(channel); };
  }, [householdId]);

  function persist(ng, ncols, ncl, np, opId) {
    if (EXHALE_V2) {
      // Cards (ng) also go to the exhale_cards realtime table, but the local mirror
      // (af_exhale_groups) MUST be marked dirty on every local write. It is a SYNC_KEY,
      // so the household-blob pull applies the server's copy onto this mirror. A raw
      // setItem (the old behavior) left it never-dirty and never-pushed, so the server
      // copy stayed frozen-stale and clobbered freshly added/moved cards on the next
      // pull — cards vanished on refresh. lsSet marks it dirty (so F-16's dirty-skip
      // protects it from being overwritten) and pushes the current blob so it stays
      // in sync. The mount fetch from exhale_cards remains the final source of truth.
      if (ng    !== undefined) lsSet(LS_G, ng, opId);
      // Columns, color labels, people: no realtime table — still in the households blob
      // (SYNC_KEYS). Must mark dirty and dispatch af-data-changed so the blob push
      // carries them to other devices. Bug fix: V2 was skipping dirty marking for these
      // keys, leaving label renames permanently local.
      if (ncols !== undefined) lsSet(LS_COLS, ncols, opId);
      if (ncl   !== undefined) lsSet(LS_CL,   ncl,   opId);
      if (np    !== undefined) lsSet(LS_P,    np,    opId);
    } else {
      if (ng    !== undefined) lsSet(LS_G,    ng,    opId);
      if (ncols !== undefined) lsSet(LS_COLS, ncols, opId);
      if (ncl   !== undefined) lsSet(LS_CL,   ncl,   opId);
      if (np    !== undefined) lsSet(LS_P,    np,    opId);
    }
  }

  var total = columns.reduce(function(sum, c) { return sum + (groups[c.id] || []).length; }, 0);
  var sel = selectedId ? findIn(groups, selectedId) : null;
  var nFilters = countFilters(filters);

  // ── mutations ──────────────────────────────────────────────────────────────
  function patchCard(id, patch) {
    var prevGroups = groups;
    var ng = clone(groups);
    var updatedCard = null;
    var pcKeys = Object.keys(ng);
    for (var i = 0; i < pcKeys.length && !updatedCard; i++) {
      var pcCol = ng[pcKeys[i]];
      for (var j = 0; j < pcCol.length; j++) {
        if (pcCol[j].id === id) {
          pcCol[j] = Object.assign({}, pcCol[j], patch);
          updatedCard = pcCol[j];
          break;
        }
      }
    }
    setGroups(ng); persist(ng);

    if (EXHALE_V2 && updatedCard) {
      var _au; try { _au = JSON.parse(localStorage.getItem("af_authUser") || "null"); } catch(e) { _au = null; }
      var updatedBy = (_au && _au.id) ? _au.id : null;
      pendingOps.current.add(id + ":UPDATE");
      supabase.rpc("exhale_update_card", {
        p_id:           id,
        p_household_id: householdId,
        p_text:         updatedCard.text,
        p_notes:        updatedCard.notes,
        p_color:        updatedCard.color,
        p_emoji:        updatedCard.emoji        || null,
        p_due_date:     updatedCard.dueDate       || null,
        p_assigned_to:  updatedCard.assignedTo    || null,
        p_updated_by:   updatedBy,
      }).then(function(result) {
        if (result.error) {
          console.warn("[AF] exhale_update_card failed:", result.error.message);
          pendingOps.current.delete(id + ":UPDATE");
          setGroups(prevGroups);
          setCardSaveState(function(p) { return Object.assign({}, p, { [id]: "failed" }); });
        }
      });
    }

    return ng;
  }

  function handleAdd() {
    var txt = inputText.trim();
    if (!txt) return;
    var opId; try { opId = crypto.randomUUID(); } catch(e) { opId = "op-" + Date.now(); }
    var cardId = EXHALE_V2 ? uuidv4() : "e" + (_nid++);
    var item = { id: cardId, text: txt, notes: "", color: CARD_COLORS[groups.inbox.length % CARD_COLORS.length].id, category: "inbox", createdAt: Date.now(), emoji: null, dueDate: null, assignedTo: null };
    if (window.AF_TRACE) console.log("[AF_TRACE "+opId+"] EXHALE_ADD_CLICK cardId="+item.id+' text="'+txt+'"');
    var ng = clone(groups); ng.inbox = [item].concat(ng.inbox);
    // Same call as handleMoveToCol:633 — "before any existing cards". Without a real
    // position every new card ties at 0, so any position-sort (initial load, UPDATE
    // handler) can reorder them arbitrarily instead of newest-first.
    var newPos = computeNewPosition(ng.inbox, 0);
    item.position = newPos;
    setGroups(ng);
    setInputText("");

    if (EXHALE_V2) {
      lsSet(LS_G, ng, opId);
      var hhId = householdId;
      var _au; try { _au = JSON.parse(localStorage.getItem("af_authUser") || "null"); } catch(e) { _au = null; }
      var createdBy = (_au && _au.id) ? _au.id : null;
      setCardSaveState(function(p) { return Object.assign({}, p, { [cardId]: "saving" }); });
      supabase.from("exhale_cards").insert({
        id:           cardId,
        household_id: hhId,
        text:         txt,
        notes:        "",
        color:        item.color,
        category:     "inbox",
        emoji:        null,
        due_date:     null,
        assigned_to:  null,
        position:     newPos,
        created_at:   new Date(item.createdAt).toISOString(),
        created_by:   createdBy,
        updated_by:   createdBy,
      }).then(function(result) {
        if (result.error) {
          console.warn("[AF] Exhale card insert failed:", result.error.message);
          setCardSaveState(function(p) { return Object.assign({}, p, { [cardId]: "failed" }); });
          return;
        }
        setCardSaveState(function(p) { return Object.assign({}, p, { [cardId]: "saved" }); });
      });
    } else {
      // V2=OFF: blob path entirely unchanged
      persist(ng, undefined, undefined, undefined, opId);
    }
  }

  function handleInputKeyDown(e) { if (e.key === "Enter") handleAdd(); }

  function handleDone() {
    if (selectedId) {
      var prevGroups = groups;
      var ng = clone(groups);
      var updatedCard = null;
      var hdKeys = Object.keys(ng);
      for (var i = 0; i < hdKeys.length && !updatedCard; i++) {
        var hdCol = ng[hdKeys[i]];
        for (var j = 0; j < hdCol.length; j++) {
          if (hdCol[j].id === selectedId) {
            hdCol[j] = Object.assign({}, hdCol[j], { notes: noteText });
            updatedCard = hdCol[j];
            break;
          }
        }
      }
      setGroups(ng); persist(ng);

      if (EXHALE_V2 && updatedCard) {
        var _au; try { _au = JSON.parse(localStorage.getItem("af_authUser") || "null"); } catch(e) { _au = null; }
        var updatedBy = (_au && _au.id) ? _au.id : null;
        var cid = updatedCard.id;
        pendingOps.current.add(cid + ":UPDATE");
        supabase.rpc("exhale_update_card", {
          p_id:           cid,
          p_household_id: householdId,
          p_text:         updatedCard.text,
          p_notes:        updatedCard.notes,
          p_color:        updatedCard.color,
          p_emoji:        updatedCard.emoji        || null,
          p_due_date:     updatedCard.dueDate       || null,
          p_assigned_to:  updatedCard.assignedTo    || null,
          p_updated_by:   updatedBy,
        }).then(function(result) {
          if (result.error) {
            console.warn("[AF] exhale_update_card (notes) failed:", result.error.message);
            pendingOps.current.delete(cid + ":UPDATE");
            setGroups(prevGroups);
          }
        });
      }
    }
    setSelectedId(null);
  }

  function handleDelete(id) {
    var prevGroups = groups;
    var ng = clone(groups);
    Object.keys(ng).forEach(function(k) { ng[k] = ng[k].filter(function(c) { return c.id !== id; }); });
    setGroups(ng); setSelectedId(null); persist(ng);

    if (EXHALE_V2) {
      pendingOps.current.add(id + ":DELETE");
      supabase.rpc("exhale_delete_card", {
        p_id:           id,
        p_household_id: householdId,
      }).then(function(result) {
        if (result.error) {
          console.warn("[AF] exhale_delete_card failed:", result.error.message);
          pendingOps.current.delete(id + ":DELETE");
          setGroups(prevGroups);
        }
      });
    }
  }

  function handleMoveToCol(id, toCol) {
    var prevGroups = groups;
    var ng = clone(groups), moved = null;
    var mtKeys = Object.keys(ng);
    for (var i = 0; i < mtKeys.length; i++) {
      var mtCol = ng[mtKeys[i]];
      for (var j = 0; j < mtCol.length; j++) {
        if (mtCol[j].id === id) { moved = mtCol.splice(j, 1)[0]; break; }
      }
      if (moved) break;
    }
    if (moved) ng[toCol].unshift(Object.assign({}, moved, { category: toCol }));
    setGroups(ng); persist(ng);

    if (EXHALE_V2 && moved) {
      // ng[toCol][0] is the moved card; compute position before any existing cards
      var newPos = computeNewPosition(ng[toCol], 0);
      var _au; try { _au = JSON.parse(localStorage.getItem("af_authUser") || "null"); } catch(e) { _au = null; }
      var updatedBy = (_au && _au.id) ? _au.id : null;
      pendingOps.current.add(id + ":UPDATE");
      supabase.rpc("exhale_move_card", {
        p_id:           id,
        p_household_id: householdId,
        p_category:     toCol,
        p_position:     newPos,
        p_updated_by:   updatedBy,
      }).then(function(result) {
        if (result.error) {
          console.warn("[AF] exhale_move_card failed:", result.error.message);
          pendingOps.current.delete(id + ":UPDATE");
          setGroups(prevGroups);
        }
      });
    }
  }

  function handleLabelSave(colId, val) {
    var ncols = columns.map(function(c) { return c.id === colId ? Object.assign({}, c, { label: val }) : c; });
    setColumns(ncols); setEditingCol(null); persist(undefined, ncols);
  }

  // ── column management ──────────────────────────────────────────────────────
  function cycleColumnColor(colId) {
    var ncols = columns.map(function(c) {
      if (c.id !== colId) return c;
      var idx = CARD_COLORS.findIndex(function(cc) { return cc.id === c.color; });
      var next = CARD_COLORS[(idx + 1) % CARD_COLORS.length];
      return Object.assign({}, c, { color: next.id });
    });
    setColumns(ncols); persist(undefined, ncols);
  }

  function addColumn() {
    if (columns.length >= MAX_COLUMNS) return;
    var newCol = { id: uuidv4(), label: "New column", color: CARD_COLORS[columns.length % CARD_COLORS.length].id, emoji: "✨" };
    var ncols = columns.concat([newCol]);
    setColumns(ncols);
    setGroups(function(prev) { var ng = Object.assign({}, prev); ng[newCol.id] = []; return ng; });
    persist(undefined, ncols);
  }

  // Deletion is only ever allowed for an empty column — never silently drops
  // cards, so there's no "what happens to the cards" migration to design.
  function deleteColumn(colId) {
    if ((groups[colId] || []).length > 0) return;
    var ncols = columns.filter(function(c) { return c.id !== colId; });
    setColumns(ncols);
    setGroups(function(prev) {
      var ng = Object.assign({}, prev);
      delete ng[colId];
      return ng;
    });
    persist(undefined, ncols);
  }

  function reorderColumns(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    var ncols = columns.slice();
    var moved = ncols.splice(fromIdx, 1)[0];
    ncols.splice(toIdx, 0, moved);
    setColumns(ncols); persist(undefined, ncols);
  }

  // Reuses the same native HTML5 drag-and-drop idiom the cards themselves
  // already use in this file (handleDragStart/handleCardDragOver/handleCardDrop
  // below) rather than introducing a second drag paradigm just for this panel.
  function handleColRowDragStart(idx) { setColDrag(idx); }
  function handleColRowDragOver(e) { e.preventDefault(); }
  function handleColRowDrop(e, idx) {
    e.preventDefault();
    if (colDrag === null || colDrag === idx) { setColDrag(null); return; }
    reorderColumns(colDrag, idx);
    setColDrag(null);
  }

  function handleColorLabelSave(colorId, val) {
    var ncl = Object.assign({}, colorLabels, { [colorId]: val });
    setColorLabels(ncl); persist(undefined, undefined, ncl);
  }

  function handleAddPerson() {
    var name = newPerson.trim();
    if (!name) { setAddingPerson(false); return; }
    var np = people.concat([name]);
    setPeople(np); setNewPerson(""); setAddingPerson(false); persist(undefined, undefined, undefined, np);
  }

  function toggleFilter(key, val) {
    setFilters(function(prev) {
      var next = Object.assign({}, prev);
      next[key] = prev[key] === val ? null : val;
      return next;
    });
  }

  function clearFilters() { setFilters({ color: null, emoji: null, person: null, date: null }); }

  // ── drag ──────────────────────────────────────────────────────────────────
  function handleDragStart(e, id, col) {
    setDrag({ id: id, fromCol: col });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text", id);
  }

  function handleDragEnd() { setDrag(null); setDropOver(null); }

  function handleCardDragOver(e, id) {
    if (!drag || drag.id === id) return;
    e.preventDefault(); e.stopPropagation();
    var rect = e.currentTarget.getBoundingClientRect();
    setDropOver({ type: "card", id: id, above: e.clientY < rect.top + rect.height / 2 });
  }

  function handleColDragOver(e, col) {
    e.preventDefault();
    if (dropOver && dropOver.type === "card") return;
    setDropOver({ type: "col", col: col });
  }

  function handleCardDrop(e, targetId, col) {
    e.preventDefault(); e.stopPropagation();
    if (!drag || drag.id === targetId) return;
    var prevGroups = groups;
    var dragId = drag.id;
    var above = (dropOver && dropOver.id === targetId) ? dropOver.above : true;
    var ng = clone(groups), fi = -1;
    for (var i = 0; i < ng[drag.fromCol].length; i++) { if (ng[drag.fromCol][i].id === drag.id) { fi = i; break; } }
    if (fi === -1) { setDrag(null); setDropOver(null); return; }
    var moved = Object.assign({}, ng[drag.fromCol].splice(fi, 1)[0], { category: col });
    var ti = -1;
    for (var j = 0; j < ng[col].length; j++) { if (ng[col][j].id === targetId) { ti = j; break; } }
    if (ti === -1) ti = ng[col].length;
    ng[col].splice(above ? ti : ti + 1, 0, moved);
    setGroups(ng); setDrag(null); setDropOver(null); persist(ng);

    if (EXHALE_V2) {
      var movedIdx = ng[col].findIndex(function(c) { return c.id === dragId; });
      var newPos = computeNewPosition(ng[col], movedIdx);
      var _au; try { _au = JSON.parse(localStorage.getItem("af_authUser") || "null"); } catch(e) { _au = null; }
      var updatedBy = (_au && _au.id) ? _au.id : null;
      pendingOps.current.add(dragId + ":UPDATE");
      supabase.rpc("exhale_move_card", {
        p_id:           dragId,
        p_household_id: householdId,
        p_category:     col,
        p_position:     newPos,
        p_updated_by:   updatedBy,
      }).then(function(result) {
        if (result.error) {
          console.warn("[AF] exhale_move_card (card drop) failed:", result.error.message);
          pendingOps.current.delete(dragId + ":UPDATE");
          setGroups(prevGroups);
        }
      });
    }
  }

  function handleColDrop(e, col) {
    e.preventDefault();
    if (!drag) return;
    var prevGroups = groups;
    var dragId = drag.id;
    var ng = clone(groups), fi = -1;
    for (var i = 0; i < ng[drag.fromCol].length; i++) { if (ng[drag.fromCol][i].id === drag.id) { fi = i; break; } }
    if (fi === -1) { setDrag(null); setDropOver(null); return; }
    var moved = Object.assign({}, ng[drag.fromCol].splice(fi, 1)[0], { category: col });
    ng[col].push(moved); setGroups(ng); setDrag(null); setDropOver(null); persist(ng);

    if (EXHALE_V2) {
      // Card appended to end of column
      var movedIdx = ng[col].length - 1;
      var newPos = computeNewPosition(ng[col], movedIdx);
      var _au; try { _au = JSON.parse(localStorage.getItem("af_authUser") || "null"); } catch(e) { _au = null; }
      var updatedBy = (_au && _au.id) ? _au.id : null;
      pendingOps.current.add(dragId + ":UPDATE");
      supabase.rpc("exhale_move_card", {
        p_id:           dragId,
        p_household_id: householdId,
        p_category:     col,
        p_position:     newPos,
        p_updated_by:   updatedBy,
      }).then(function(result) {
        if (result.error) {
          console.warn("[AF] exhale_move_card (col drop) failed:", result.error.message);
          pendingOps.current.delete(dragId + ":UPDATE");
          setGroups(prevGroups);
        }
      });
    }
  }

  // ── styles ─────────────────────────────────────────────────────────────────
  var br  = "0.5px solid var(--color-border-tertiary,#e0e0e0)";
  var bgS = "var(--color-background-secondary,#f8f8f8)";
  var bgP = "var(--color-background-primary,#fff)";
  var txP = "var(--color-text-primary,#111)";
  var txS = "var(--color-text-secondary,#666)";

  var chip = { fontSize: 10, padding: "2px 7px", borderRadius: 20, border: br, background: bgS, cursor: "pointer", color: txP, whiteSpace: "nowrap" };

  // ── EXHALE PHASE 1 RENDER — bucket cards + tab switcher ────────────────────
  // The old Kanban board (columns/groups/drag/filter UI) and its detail view
  // are gone from here; the data layer above (columns/groups/Supabase
  // realtime/drag handlers) is untouched and keeps af_exhale_groups syncing,
  // it's just no longer read by anything below this line.
  var totalVisible = buckets.items.filter(function(it) { return it && !it.archived; }).length;

  function renderBucketCard(idx) {
    var bucketName = buckets.bucketNames[idx];
    var bItems = visibleBucketItems(idx);
    var isOpen = !!openBuckets[idx];
    var accent = BUCKET_COLORS[idx % BUCKET_COLORS.length];
    var isDropTarget = dragOverId === null && bucketDragItem.current.from && bucketDragItem.current.toBucket === idx;
    var selectMode = !!selectModeBucket[idx];
    var selectedCount = bItems.filter(function(it) { return selectedItemIds[it.id]; }).length;
    // Filter by person/category — counts computed off the full bucket (bItems)
    // so pill options stay stable while a filter is active; filteredItems is
    // what actually renders as rows.
    var peopleInBucket = {}, categoriesInBucket = {};
    bItems.forEach(function(it) {
      if (it.personId) peopleInBucket[it.personId] = (peopleInBucket[it.personId] || 0) + 1;
      if (it.categoryId) categoriesInBucket[it.categoryId] = (categoriesInBucket[it.categoryId] || 0) + 1;
    });
    var hasAnyAssignment = Object.keys(peopleInBucket).length > 0 || Object.keys(categoriesInBucket).length > 0;
    var bucketFilter = getBucketFilter(idx);
    var filteredItems = bItems.filter(function(it) {
      if (bucketFilter.personId && it.personId !== bucketFilter.personId) return false;
      if (bucketFilter.categoryId && it.categoryId !== bucketFilter.categoryId) return false;
      return true;
    });
    return (
      <div key={idx} data-bucketidx={idx}
        style={{ borderRadius: 12, border: br, borderTop: "3px solid " + accent, background: bgP, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer" }}
          onClick={() => toggleBucketOpen(idx)}>
          {editingBucketIdx === idx ? (
            <input autoFocus defaultValue={bucketName} onClick={(e) => e.stopPropagation()}
              onBlur={(e) => renameBucket(idx, e.target.value.trim() || bucketName)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }}
              style={{ flex: 1, fontSize: 18, fontWeight: 700, border: "none", background: "transparent", color: txP, outline: "none", borderBottom: "1.5px solid " + accent, fontFamily: "inherit" }} />
          ) : (
            <span onClick={(e) => { e.stopPropagation(); setEditingBucketIdx(idx); }} title="Tap to rename"
              style={{ flex: 1, fontSize: 18, fontWeight: 700, color: txP, cursor: "text" }}>{bucketName}</span>
          )}
          <span style={{ fontSize: 11, color: txS, background: bgS, borderRadius: 20, padding: "1px 8px" }}>{bItems.length}</span>
          <button onClick={(e) => { e.stopPropagation(); toggleSelectMode(idx); }}
            style={{ background: selectMode ? accent : "transparent", color: selectMode ? "white" : txS, border: selectMode ? "none" : br, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>{selectMode ? "Done" : "Select"}</button>
          <button onClick={(e) => { e.stopPropagation(); setBucketAddOpenFor(bucketAddOpenFor === idx ? null : idx); setOpenBuckets(function(p) { return Object.assign({}, p, { [idx]: true }); }); }}
            style={{ background: accent, color: "white", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>+ Add</button>
          <span style={{ fontSize: 11, color: txS, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s", display: "inline-block" }}>▾</span>
        </div>

        {isOpen && (
          <div style={{ padding: "0 12px 10px", minHeight: 8, background: isDropTarget ? "rgba(27,46,79,0.04)" : "transparent" }}>
            {idx === 0 && showStaleNudge && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: accent + "14", border: "1px solid " + accent + "33" }}>
                <div style={{ fontSize: 11.5, color: txP }}>
                  You have {staleItems.length} item{staleItems.length === 1 ? "" : "s"} sitting here for over a week. Ready to act on any?
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={reviewStaleItems}
                    style={{ background: accent, color: "white", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Review now</button>
                  <button onClick={moveOldestStaleToSomeday}
                    style={{ background: "none", border: "1px solid " + accent, color: accent, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Move oldest to Someday</button>
                </div>
              </div>
            )}
            {selectMode && selectedCount > 0 && (
              <div style={{ marginBottom: 8 }}>
                <button onClick={() => deleteSelectedItems(idx)}
                  style={{ background: "#8B0000", color: "white", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Delete selected ({selectedCount})</button>
              </div>
            )}
            {bucketAddOpenFor === idx && (
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input autoFocus value={bucketAddText} onChange={(e) => setBucketAddText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { addBucketItem(bucketAddText, idx); setBucketAddText(""); setBucketAddOpenFor(null); } if (e.key === "Escape") { setBucketAddText(""); setBucketAddOpenFor(null); } }}
                  placeholder={"Add to " + bucketName + "..."}
                  style={{ flex: 1, padding: "6px 9px", fontSize: 12, border: br, borderRadius: 7, background: bgP, color: txP }} />
                <button onClick={() => { addBucketItem(bucketAddText, idx); setBucketAddText(""); setBucketAddOpenFor(null); }}
                  style={{ background: accent, color: "white", border: "none", borderRadius: 7, padding: "6px 11px", fontSize: 11, cursor: "pointer" }}>Add</button>
              </div>
            )}

            {hasAnyAssignment && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                <button onClick={() => clearBucketFilter(idx)}
                  style={{ background: (!bucketFilter.personId && !bucketFilter.categoryId) ? accent : bgS, color: (!bucketFilter.personId && !bucketFilter.categoryId) ? "white" : txS, border: "none", borderRadius: 20, padding: "2px 9px", fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}>All ({bItems.length})</button>
                {householdPeople.filter(function(p) { return peopleInBucket[p.id]; }).map(function(p) {
                  var active = bucketFilter.personId === p.id;
                  var pc = p.color || "#888";
                  return (
                    <button key={"pf" + p.id} onClick={() => setBucketPersonFilter(idx, p.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, background: active ? pc + "22" : bgS, border: "1px solid " + (active ? pc : "transparent"), borderRadius: 20, padding: "2px 9px", fontSize: 10.5, color: txS, cursor: "pointer" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: pc, flexShrink: 0 }} />
                      {p.name} ({peopleInBucket[p.id]})
                    </button>
                  );
                })}
                {categories.filter(function(c) { return categoriesInBucket[c.id]; }).map(function(c) {
                  var active = bucketFilter.categoryId === c.id;
                  return (
                    <button key={"cf" + c.id} onClick={() => setBucketCategoryFilter(idx, c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, background: active ? c.color + "22" : bgS, border: "1px solid " + (active ? c.color : "transparent"), borderRadius: 20, padding: "2px 9px", fontSize: 10.5, color: txS, cursor: "pointer" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                      {c.label} ({categoriesInBucket[c.id]})
                    </button>
                  );
                })}
              </div>
            )}

            {bItems.length === 0 && (
              <div style={{ fontSize: 11.5, color: txS, fontStyle: "italic", padding: "6px 0" }}>Nothing here yet.</div>
            )}
            {bItems.length > 0 && filteredItems.length === 0 && (
              <div style={{ fontSize: 11.5, color: txS, fontStyle: "italic", padding: "6px 0" }}>No items match this filter.</div>
            )}

            {(bucketShowAll[idx] ? filteredItems : filteredItems.slice(0, BUCKET_ITEM_LIMIT)).map(function(item) {
              var isExpanded = expandedItemId === item.id || !!staleReviewIds[item.id];
              var isBeingDragged = dragFromId === item.id;
              var isDragOverThis = dragOverId === item.id;
              var isSelected = !!selectedItemIds[item.id];
              // Color dot priority: assigned person, else category, else no dot.
              var assignedPerson = item.personId ? householdPeople.find(function(p) { return p.id === item.personId; }) : null;
              var assignedCategory = (!assignedPerson && item.categoryId) ? categories.find(function(c) { return c.id === item.categoryId; }) : null;
              var dotColor = assignedPerson ? assignedPerson.color : (assignedCategory ? assignedCategory.color : null);
              return (
                <div key={item.id} data-bucketitemid={item.id} className="af-exhale-row"
                  onClick={() => toggleItemExpanded(item.id)}
                  onPointerDown={selectMode ? undefined : (e) => bucketItemPointerDown(e, item)}
                  style={{ borderRadius: 8, border: br, padding: "5px 8px", marginBottom: 4, background: bgS, opacity: isBeingDragged ? 0.3 : 1, outline: isDragOverThis ? "2px dashed " + accent : "none", outlineOffset: 2, cursor: "pointer", touchAction: selectMode ? "auto" : "none" }}>
                  {/* Condensed-rows fix: this padding/margin/gap only affects the
                      collapsed row shell — everything inside {isExpanded && (...)}
                      below (textarea, Assign to/Category rows, action chips) is
                      untouched, matching "do not change expanded item view sizing". */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    {selectMode && (
                      <input type="checkbox" checked={isSelected} onChange={() => toggleItemSelected(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ flexShrink: 0, marginTop: 2, cursor: "pointer" }} />
                    )}
                    {dotColor && <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, marginTop: 5, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => toggleItemExpanded(item.id)}>
                      <div style={{ fontSize: 12.5, lineHeight: 1.4, color: item.isExample ? txS : txP, fontStyle: item.isExample ? "italic" : "normal", display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{item.text}</span>
                        {item.isExample && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: txS, background: bgS, borderRadius: 4, padding: "1px 5px", flexShrink: 0, fontStyle: "normal" }}>example</span>}
                      </div>
                      {!isExpanded && item.notes && (
                        <div style={{ fontSize: 10.5, marginTop: 2, opacity: 0.7, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.notes}</div>
                      )}
                    </div>
                    <span onClick={() => toggleItemExpanded(item.id)}
                      style={{ fontSize: 11, color: txS, cursor: "pointer", flexShrink: 0, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .15s", display: "inline-block" }}>⌄</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteBucketItemImmediate(item.id); }}
                      className="af-exhale-x" aria-label="Delete item"
                      style={{ background: "none", border: "none", color: txS, fontSize: 13, lineHeight: 1, padding: "0 2px", cursor: "pointer", flexShrink: 0, marginTop: 1 }}>×</button>
                  </div>
                  {compassSuggestions[item.id] && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, padding: "4px 7px", borderRadius: 6, background: accent + "14", fontSize: 10.5, color: txS }}>
                      <span style={{ flex: 1 }}>
                        Compass suggests: {[compassSuggestions[item.id].categoryLabel, compassSuggestions[item.id].personName].filter(Boolean).join(" · ")} — Apply?
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); applyCompassSuggestion(item.id); }}
                        style={{ background: accent, color: "white", border: "none", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Apply</button>
                      <button onClick={(e) => { e.stopPropagation(); dismissCompassSuggestion(item.id); }}
                        style={{ background: "none", border: "none", color: txS, fontSize: 12, cursor: "pointer", padding: "0 2px", flexShrink: 0 }}>×</button>
                    </div>
                  )}
                  {isExpanded && (
                    <div style={{ marginTop: 8 }}>
                      <textarea value={item.notes || ""} onChange={(e) => updateBucketItem(item.id, { notes: e.target.value })}
                        placeholder="Notes..." rows={2}
                        style={{ width: "100%", border: br, borderRadius: 6, padding: "6px 8px", fontSize: 11.5, resize: "none", background: bgP, color: txP, fontFamily: "inherit", marginBottom: 6 }} />
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: txS, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Assign to</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {householdPeople.length === 0 && <div style={{ fontSize: 11, color: txS, fontStyle: "italic" }}>No household members yet.</div>}
                          {householdPeople.map(function(p) {
                            var active = item.personId === p.id;
                            var pc = p.color || "#888";
                            return (
                              <button key={p.id} onClick={() => togglePersonAssignment(item.id, p.id)}
                                style={{ display: "flex", alignItems: "center", gap: 5, background: active ? pc + "22" : bgP, border: "1px solid " + (active ? pc : "var(--color-border-tertiary,#e0e0e0)"), borderRadius: 20, padding: "3px 9px", fontSize: 11, color: txP, cursor: "pointer" }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: pc, flexShrink: 0 }} />
                                {p.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: txS, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Category</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {categories.map(function(c) {
                            var active = item.categoryId === c.id;
                            return (
                              <button key={c.id} onClick={() => toggleCategoryAssignment(item.id, c.id)}
                                style={{ display: "flex", alignItems: "center", gap: 5, background: active ? c.color + "22" : bgP, border: "1px solid " + (active ? c.color : "var(--color-border-tertiary,#e0e0e0)"), borderRadius: 20, padding: "3px 9px", fontSize: 11, color: txP, cursor: "pointer" }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                                {c.label}
                              </button>
                            );
                          })}
                          <button onClick={() => { setAddingCategoryFor(addingCategoryFor === item.id ? null : item.id); setNewCategoryLabel(""); setNewCategoryColor(CATEGORY_COLOR_PRESETS[0].color); }}
                            style={{ background: "none", border: br, borderRadius: 20, padding: "3px 9px", fontSize: 11, color: txS, cursor: "pointer" }}>+ New</button>
                        </div>
                        {addingCategoryFor === item.id && (
                          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                            <input autoFocus value={newCategoryLabel} onChange={(e) => setNewCategoryLabel(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Escape") { setAddingCategoryFor(null); } }}
                              placeholder="Category name..." style={{ padding: "5px 8px", fontSize: 11.5, border: br, borderRadius: 6, background: bgP, color: txP, fontFamily: "inherit" }} />
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <ColorPicker value={newCategoryColor} onChange={setNewCategoryColor} size={20} />
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => {
                                var label = newCategoryLabel.trim();
                                if (!label) return;
                                var newId = addCategory(label, newCategoryColor);
                                toggleCategoryAssignment(item.id, newId);
                                setNewCategoryLabel(""); setAddingCategoryFor(null);
                              }} style={{ background: accent, color: "white", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>Add</button>
                              <button onClick={() => { setNewCategoryLabel(""); setAddingCategoryFor(null); }}
                                style={{ background: "none", border: br, borderRadius: 7, padding: "5px 12px", fontSize: 11, color: txS, cursor: "pointer" }}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", position: "relative" }}>
                        <button onClick={(e) => { e.stopPropagation(); setMoveMenuForItemId(moveMenuForItemId === item.id ? null : item.id); }} style={{ ...chip, background: bgP }}>Move to… ▾</button>
                        <button onClick={() => deleteBucketItem(item.id, item.text)} style={{ ...chip, background: bgP, color: "#8B0000", border: "0.5px solid rgba(180,0,0,0.3)" }}>Delete</button>
                        {moveMenuForItemId === item.id && (
                          <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", bottom: "calc(100% + 4px)", left: 0, background: bgP, border: br, borderRadius: 8, boxShadow: "0 4px 14px rgba(0,0,0,0.18)", zIndex: 20, minWidth: 150, overflow: "hidden" }}>
                            {buckets.bucketNames.map(function(name, destIdx) {
                              if (destIdx === item.bucketIndex) return null;
                              return (
                                <button key={destIdx} onClick={() => { moveBucketItemTo(item.id, destIdx); setMoveMenuForItemId(null); }}
                                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, background: "none", border: "none", cursor: "pointer", color: txP }}>{name}</button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!bucketShowAll[idx] && filteredItems.length > BUCKET_ITEM_LIMIT && (
              <button onClick={(e) => { e.stopPropagation(); setBucketShowAll(function(p) { return Object.assign({}, p, { [idx]: true }); }); }}
                style={{ width: "100%", background: "none", border: br, borderRadius: 8, padding: "6px 8px", fontSize: 11.5, color: txS, cursor: "pointer", marginTop: 2 }}>
                Show {filteredItems.length - BUCKET_ITEM_LIMIT} more
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-sans,sans-serif)", fontSize: 13 }}>
      {/* Quick-delete × button: hidden until hover on hover-capable (desktop)
          devices, always visible where hover isn't available (touch/mobile). */}
      <style>{"\n        .af-exhale-x { opacity: 0; }\n        .af-exhale-row:hover .af-exhale-x { opacity: 1; }\n        @media (hover: none) { .af-exhale-x { opacity: 1; } }\n      "}</style>
      {/* App bar */}
      <div style={{ background: NAVY, padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
        <span>💨</span>
        <span style={{ color: "#E8C76A", fontSize: 22 }}>Exhale</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={collapseAllBuckets} style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", background: "none", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, padding: "3px 7px", cursor: "pointer" }}>Collapse all</button>
          <span style={{ fontSize: 10 }}>{totalVisible} items</span>
        </div>
      </div>

        <div>
          {/* Quick capture */}
          <div style={{ padding: "10px 12px", borderBottom: br, background: bgP, borderRadius: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={bucketInputText} onChange={(e) => setBucketInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { addBucketItem(bucketInputText, bucketInputTarget); setBucketInputText(""); } }}
                placeholder="+ Exhale a thought"
                style={{ flex: 1, padding: "8px 11px", fontSize: 15, border: br, borderRadius: 8, background: bgP, color: txP }} />
              <button onClick={() => { addBucketItem(bucketInputText, bucketInputTarget); setBucketInputText(""); }}
                style={{ background: NAVY, color: "white", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12, cursor: "pointer" }}>+ Add</button>
            </div>
            <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: txS }}>Add to:</span>
              {buckets.bucketNames.map(function(name, idx) {
                var isActive = bucketInputTarget === idx;
                var bc = BUCKET_COLORS[idx % BUCKET_COLORS.length];
                return (
                  <button key={idx} onClick={() => setBucketInputTarget(idx)}
                    style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, border: isActive ? "1.5px solid " + bc : br, background: isActive ? bc + "22" : bgS, color: isActive ? bc : txS, fontWeight: isActive ? 700 : 400, cursor: "pointer" }}>
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bucket cards — Exhaled full-width, then a 2×2 grid for the rest */}
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
            {renderBucketCard(0)}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {renderBucketCard(1)}
              {renderBucketCard(2)}
              {renderBucketCard(3)}
              {renderBucketCard(4)}
            </div>
          </div>
        </div>
      <UndoToast toast={undoToast} onUndo={handleUndoClick} />
    </div>
  );
}
