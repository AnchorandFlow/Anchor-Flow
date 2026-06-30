import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

var CARD_COLORS = [
  { id: "seafoam", bg: "#C2E8DA", bd: "#85BFAB", tx: "#1C3A2E" },
  { id: "aqua",    bg: "#B2E0E8", bd: "#6ABEC8", tx: "#143640" },
  { id: "sage",    bg: "#C4D8B8", bd: "#8AB878", tx: "#243A1A" },
  { id: "cobalt",  bg: "#B8C8E8", bd: "#7898C8", tx: "#1A2E50" },
  { id: "amber",   bg: "#E8D8A8", bd: "#C4A860", tx: "#3A2C10" },
  { id: "lav",     bg: "#D0C8E8", bd: "#A098C8", tx: "#2A2248" },
];

var EMOJIS = ["⭐","🌟","❤️","🔴","💙","🟡","🟢","📌","⚡","🎯","💡","🔔"];

var COLS = ["inbox","decide","do","waiting","someday"];

var DEFAULT_LABELS = {
  inbox:   "🌊 On My Mind",
  decide:  "🤔 Needs a Decision",
  do:      "✅ Ready for Action",
  waiting: "⏳ Waiting on Others",
  someday: "🌱 Maybe Later",
};

var DEFAULT_PEOPLE = ["Lindsey","Rylan","Madi","Kinzlee","Briar"];

var NAVY = "#1B2E4F";
var _nid = Date.now();
var LS_G  = "af_exhale_groups";
var LS_L  = "af_exhale_labels";
var LS_CL = "af_exhale_color_labels";
var LS_P  = "af_exhale_people";
var EXHALE_V2 = localStorage.getItem("af_exhale_v2") !== "false";

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

function emptyGroups() {
  return { inbox: [], decide: [], do: [], waiting: [], someday: [] };
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
function bootstrapPositions(g) {
  for (var i = 0; i < COLS.length; i++) {
    var col = g[COLS[i]];
    if (!col) continue;
    for (var j = 0; j < col.length; j++) {
      if (!col[j].position || col[j].position === 0) {
        col[j] = Object.assign({}, col[j], { position: (j + 1) * 1000 });
      }
    }
  }
  return g;
}

function groupItems(raw) {
  var g = emptyGroups();
  if (!raw || !Array.isArray(raw)) return g;
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var cat, entry;
    if (typeof item === "string") {
      cat   = "inbox";
      entry = { id: "lg-" + i, text: item, notes: "", color: CARD_COLORS[i % CARD_COLORS.length].id, category: "inbox", createdAt: Date.now(), emoji: null, dueDate: null, assignedTo: null };
    } else {
      cat   = (item.category && g[item.category]) ? item.category : "inbox";
      entry = { id: item.id || ("e-" + i), text: item.text || "", notes: item.notes || "", color: item.color || CARD_COLORS[i % CARD_COLORS.length].id, category: cat, createdAt: item.createdAt || Date.now(), emoji: item.emoji || null, dueDate: item.dueDate || null, assignedTo: item.assignedTo || null };
    }
    g[cat].push(entry);
  }
  return g;
}

function flattenGroups(g) {
  var out = [];
  for (var i = 0; i < COLS.length; i++) {
    var col = COLS[i];
    for (var j = 0; j < g[col].length; j++) {
      var c = g[col][j];
      out.push({ id: c.id, text: c.text, notes: c.notes, color: c.color, category: col, createdAt: c.createdAt, emoji: c.emoji || null, dueDate: c.dueDate || null, assignedTo: c.assignedTo || null });
    }
  }
  return out;
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

  var [groups,      setGroups]      = useState(function() {
    var g = lsGet(LS_G, null) || groupItems(initialItems);
    if (EXHALE_V2) {
      bootstrapPositions(g);
      try { localStorage.setItem(LS_G, JSON.stringify(g)); } catch(e) {}
    }
    return g;
  });
  var [colLabels,   setColLabels]   = useState(function() { return Object.assign({}, DEFAULT_LABELS, lsGet(LS_L, null) || initialLabels); });
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
        localStorage.setItem(flagKey, "1");
        console.log("[AF] Exhale migration done:", cards.length, "card(s) contributed.");
      });
  }, [householdId]); // re-runs when householdId resolves null → real id; flag guards re-migration

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
            try { localStorage.setItem(LS_G, JSON.stringify(ng)); } catch(e) {}
            return ng;
          });

        } else if (payload.eventType === "UPDATE") {
          var opKey = payload.new.id + ":UPDATE";
          if (pendingOps.current.has(opKey)) { pendingOps.current.delete(opKey); return; }
          var row = payload.new;
          setGroups(function(prev) {
            var ng = clone(prev);
            for (var i = 0; i < COLS.length; i++) {
              ng[COLS[i]] = ng[COLS[i]].filter(function(c) { return c.id !== row.id; });
            }
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
            ng[col].sort(function(a, b) { return (a.position || 0) - (b.position || 0); });
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
            for (var i = 0; i < COLS.length; i++) {
              ng[COLS[i]] = ng[COLS[i]].filter(function(c) { return c.id !== deletedId; });
            }
            try { localStorage.setItem(LS_G, JSON.stringify(ng)); } catch(e) {}
            return ng;
          });
        }
      })
      .subscribe();

    return function() { supabase.removeChannel(channel); };
  }, [householdId]);

  function persist(ng, nl, ncl, np, opId) {
    if (EXHALE_V2) {
      // V2: raw cache writes only — no dirty keys, no af-data-changed, no blob push
      if (ng  !== undefined) try { localStorage.setItem(LS_G,  JSON.stringify(ng));  } catch(e) {}
      if (nl  !== undefined) try { localStorage.setItem(LS_L,  JSON.stringify(nl));  } catch(e) {}
      if (ncl !== undefined) try { localStorage.setItem(LS_CL, JSON.stringify(ncl)); } catch(e) {}
      if (np  !== undefined) try { localStorage.setItem(LS_P,  JSON.stringify(np));  } catch(e) {}
    } else {
      if (ng  !== undefined) lsSet(LS_G,  ng,  opId);
      if (nl  !== undefined) lsSet(LS_L,  nl,  opId);
      if (ncl !== undefined) lsSet(LS_CL, ncl, opId);
      if (np  !== undefined) lsSet(LS_P,  np,  opId);
    }
  }

  var total = 0;
  for (var ci = 0; ci < COLS.length; ci++) total += groups[COLS[ci]].length;
  var sel = selectedId ? findIn(groups, selectedId) : null;
  var nFilters = countFilters(filters);

  // ── mutations ──────────────────────────────────────────────────────────────
  function patchCard(id, patch) {
    var prevGroups = groups;
    var ng = clone(groups);
    var updatedCard = null;
    for (var i = 0; i < COLS.length; i++) {
      for (var j = 0; j < ng[COLS[i]].length; j++) {
        if (ng[COLS[i]][j].id === id) {
          ng[COLS[i]][j] = Object.assign({}, ng[COLS[i]][j], patch);
          updatedCard = ng[COLS[i]][j];
          break;
        }
      }
      if (updatedCard) break;
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
    var cardId = EXHALE_V2
      ? (function(){ try { return crypto.randomUUID(); } catch(e) { return "e" + (_nid++); } })()
      : "e" + (_nid++);
    var item = { id: cardId, text: txt, notes: "", color: CARD_COLORS[groups.inbox.length % CARD_COLORS.length].id, category: "inbox", createdAt: Date.now(), emoji: null, dueDate: null, assignedTo: null };
    if (window.AF_TRACE) console.log("[AF_TRACE "+opId+"] EXHALE_ADD_CLICK cardId="+item.id+' text="'+txt+'"');
    var ng = clone(groups); ng.inbox = [item].concat(ng.inbox);
    setGroups(ng);
    setInputText("");

    if (EXHALE_V2) {
      // Raw cache write — NOT lsSet, no dirty key, no blob push triggered
      try { localStorage.setItem(LS_G, JSON.stringify(ng)); } catch(e) {}
      var hhId; try { hhId = JSON.parse(localStorage.getItem("af_householdId") || "null"); } catch(e) { hhId = null; }
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
        position:     0,
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
      for (var i = 0; i < COLS.length; i++) {
        for (var j = 0; j < ng[COLS[i]].length; j++) {
          if (ng[COLS[i]][j].id === selectedId) {
            ng[COLS[i]][j] = Object.assign({}, ng[COLS[i]][j], { notes: noteText });
            updatedCard = ng[COLS[i]][j];
            break;
          }
        }
        if (updatedCard) break;
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
    for (var i = 0; i < COLS.length; i++) ng[COLS[i]] = ng[COLS[i]].filter(function(c) { return c.id !== id; });
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
    for (var i = 0; i < COLS.length; i++) {
      for (var j = 0; j < ng[COLS[i]].length; j++) {
        if (ng[COLS[i]][j].id === id) { moved = ng[COLS[i]].splice(j, 1)[0]; break; }
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

  function handleLabelSave(col, val) {
    var nl = Object.assign({}, colLabels, { [col]: val });
    setColLabels(nl); setEditingCol(null); persist(undefined, nl);
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

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  if (sel) {
    var card = sel.card;
    var cc = getColor(card.color);
    var dueMeta = getDueMeta(card.dueDate);
    var today = getToday(), tomorrow = getTomorrow();

    return (
      <div style={{ fontFamily: "var(--font-sans,sans-serif)" }}>
        {/* Header */}
        <div style={{ background: cc.bg, borderBottom: "0.5px solid " + cc.bd, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={handleDone} style={{ background: "rgba(0,0,0,0.1)", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: cc.tx }}>← Back</button>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: cc.tx, lineHeight: 1.3 }}>{card.text}</span>
        </div>

        {/* Notes */}
        <div style={{ padding: "12px 14px 10px" }}>
          <div style={{ fontSize: 11, color: txS, marginBottom: 5 }}>Notes</div>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Context, deadline, links..." rows={3}
            style={{ width: "100%", border: br, borderRadius: 8, padding: "8px 10px", fontSize: 13, resize: "none", background: bgP, color: txP, lineHeight: 1.5, fontFamily: "inherit" }} />
        </div>

        {/* Color + label */}
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ fontSize: 11, color: txS, marginBottom: 7 }}>Color</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
            {CARD_COLORS.map(function(cl) {
              return <div key={cl.id} onClick={() => patchCard(card.id, { color: cl.id })}
                title={colorLabels[cl.id] || cl.id}
                style={{ width: 24, height: 24, borderRadius: "50%", background: cl.bg, border: "2px solid " + (cl.id === card.color ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.12)"), cursor: "pointer", flexShrink: 0 }} />;
            })}
          </div>
          <input value={colorLabels[card.color] || ""} onChange={(e) => handleColorLabelSave(card.color, e.target.value)}
            placeholder={"Label this color (e.g. Urgent, Work, Kids)"}
            style={{ marginTop: 7, width: "100%", border: br, borderRadius: 6, padding: "5px 9px", fontSize: 11, background: bgP, color: txP }} />
        </div>

        {/* Emoji */}
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ fontSize: 11, color: txS, marginBottom: 7 }}>Emoji marker</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {EMOJIS.map(function(em) {
              var isActive = card.emoji === em;
              return <button key={em} onClick={() => patchCard(card.id, { emoji: isActive ? null : em })}
                style={{ fontSize: 16, padding: "3px 5px", border: isActive ? ("2px solid " + NAVY) : br, borderRadius: 6, background: isActive ? "rgba(27,46,79,0.07)" : bgS, cursor: "pointer" }}>{em}</button>;
            })}
            {card.emoji && <button onClick={() => patchCard(card.id, { emoji: null })} style={{ ...chip, color: "#8B0000", border: "0.5px solid rgba(180,0,0,0.3)" }}>✕ Clear</button>}
          </div>
        </div>

        {/* Due date */}
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ fontSize: 11, color: txS, marginBottom: 7 }}>Due date</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => patchCard(card.id, { dueDate: card.dueDate === today ? null : today })}
              style={{ ...chip, background: card.dueDate === today ? "#E8D8A8" : bgS, borderColor: card.dueDate === today ? "#C4A860" : undefined, fontWeight: card.dueDate === today ? 600 : 400 }}>Today</button>
            <button onClick={() => patchCard(card.id, { dueDate: card.dueDate === tomorrow ? null : tomorrow })}
              style={{ ...chip, background: card.dueDate === tomorrow ? "#C4D8B8" : bgS, borderColor: card.dueDate === tomorrow ? "#8AB878" : undefined, fontWeight: card.dueDate === tomorrow ? 600 : 400 }}>Tomorrow</button>
            <input type="date" value={card.dueDate && card.dueDate !== today && card.dueDate !== tomorrow ? card.dueDate : ""}
              onChange={(e) => patchCard(card.id, { dueDate: e.target.value || null })}
              style={{ fontSize: 11, border: br, borderRadius: 6, padding: "3px 7px", background: bgP, color: txP }} />
            {card.dueDate && <button onClick={() => patchCard(card.id, { dueDate: null })} style={{ ...chip, color: "#8B0000" }}>✕</button>}
          </div>
          {dueMeta && <div style={{ marginTop: 5, fontSize: 11, color: dueMeta.color, fontWeight: 500 }}>{dueMeta.label}</div>}
        </div>

        {/* Assign to */}
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ fontSize: 11, color: txS, marginBottom: 7 }}>Assign to</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
            {people.map(function(p) {
              var isActive = card.assignedTo === p;
              return <button key={p} onClick={() => patchCard(card.id, { assignedTo: isActive ? null : p })}
                style={{ ...chip, background: isActive ? NAVY : bgS, color: isActive ? "white" : txP, fontWeight: isActive ? 500 : 400 }}>{p}</button>;
            })}
            {!addingPerson ? (
              <button onClick={() => setAddingPerson(true)} style={{ ...chip, color: txS }}>+ Add</button>
            ) : (
              <span style={{ display: "flex", gap: 4 }}>
                <input autoFocus value={newPerson} onChange={(e) => setNewPerson(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddPerson(); if (e.key === "Escape") { setAddingPerson(false); setNewPerson(""); } }}
                  placeholder="Name" style={{ fontSize: 11, border: br, borderRadius: 6, padding: "3px 7px", width: 80, background: bgP, color: txP }} />
                <button onClick={handleAddPerson} style={{ ...chip, background: NAVY, color: "white", border: "none" }}>Add</button>
              </span>
            )}
          </div>
        </div>

        {/* Move to */}
        <div style={{ padding: "0 14px 12px" }}>
          <div style={{ fontSize: 11, color: txS, marginBottom: 7 }}>Move to</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {COLS.map(function(col) {
              var isHere = col === sel.col;
              return <button key={col} onClick={() => handleMoveToCol(card.id, col)}
                style={{ textAlign: "left", padding: "6px 10px", borderRadius: 7, border: br, background: isHere ? NAVY : bgS, color: isHere ? "white" : txP, fontSize: 12, cursor: isHere ? "default" : "pointer", fontWeight: isHere ? 500 : 400 }}>
                {colLabels[col]}
              </button>;
            })}
          </div>
        </div>

        {/* Delete */}
        <div style={{ padding: "0 14px 14px", borderTop: br, paddingTop: 10 }}>
          <button onClick={() => handleDelete(card.id)}
            style={{ width: "100%", padding: 8, borderRadius: 7, border: "0.5px solid rgba(180,0,0,0.3)", background: "rgba(180,0,0,0.06)", color: "#8B0000", fontSize: 12, cursor: "pointer" }}>
            ✕ Delete this card
          </button>
        </div>
      </div>
    );
  }

  // ── KANBAN VIEW ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "var(--font-sans,sans-serif)", fontSize: 13 }}>

      {/* App bar */}
      <div style={{ background: NAVY, padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
        <span>💨</span>
        <span style={{ color: "#E8C76A" }}>Exhale</span>
        <span style={{ marginLeft: "auto", fontSize: 10 }}>{total} items</span>
      </div>

      {/* Filter toggle */}
      <div style={{ padding: "6px 12px", borderBottom: br, background: bgS, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <button onClick={() => setShowFilters(function(p) { return !p; })}
          style={{ ...chip, background: nFilters > 0 ? NAVY : bgS, color: nFilters > 0 ? "white" : txS, border: nFilters > 0 ? "none" : br }}>
          🔍 {nFilters > 0 ? nFilters + " filter" + (nFilters > 1 ? "s" : "") + " active" : "Filter"} {showFilters ? "▲" : "▼"}
        </button>
        {nFilters > 0 && <button onClick={clearFilters} style={{ ...chip, color: "#8B0000", border: "0.5px solid rgba(180,0,0,0.3)" }}>✕ Clear all</button>}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{ padding: "10px 12px", borderBottom: br, background: bgS }}>

          {/* Color filter */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: txS, marginBottom: 5, fontWeight: 500 }}>Color</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {CARD_COLORS.map(function(cl) {
                var isActive = filters.color === cl.id;
                var label = colorLabels[cl.id] || cl.id;
                return <button key={cl.id} onClick={() => toggleFilter("color", cl.id)}
                  style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: cl.bg, border: isActive ? ("2px solid " + NAVY) : ("0.5px solid " + cl.bd), cursor: "pointer", color: cl.tx, fontWeight: isActive ? 600 : 400 }}>
                  {label}
                </button>;
              })}
            </div>
          </div>

          {/* Emoji filter */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: txS, marginBottom: 5, fontWeight: 500 }}>Emoji</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {EMOJIS.map(function(em) {
                var isActive = filters.emoji === em;
                return <button key={em} onClick={() => toggleFilter("emoji", em)}
                  style={{ fontSize: 14, padding: "2px 4px", border: isActive ? ("2px solid " + NAVY) : br, borderRadius: 5, background: isActive ? "rgba(27,46,79,0.08)" : bgP, cursor: "pointer" }}>{em}</button>;
              })}
            </div>
          </div>

          {/* Person filter */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: txS, marginBottom: 5, fontWeight: 500 }}>Person</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {people.map(function(p) {
                var isActive = filters.person === p;
                return <button key={p} onClick={() => toggleFilter("person", p)}
                  style={{ ...chip, background: isActive ? NAVY : bgS, color: isActive ? "white" : txP, fontWeight: isActive ? 500 : 400 }}>{p}</button>;
              })}
            </div>
          </div>

          {/* Date filter */}
          <div>
            <div style={{ fontSize: 10, color: txS, marginBottom: 5, fontWeight: 500 }}>Date</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {[["today","Today"],["tomorrow","Tomorrow"],["overdue","Overdue"],["upcoming","Upcoming"]].map(function(pair) {
                var isActive = filters.date === pair[0];
                return <button key={pair[0]} onClick={() => toggleFilter("date", pair[0])}
                  style={{ ...chip, background: isActive ? NAVY : bgS, color: isActive ? "white" : txP, fontWeight: isActive ? 500 : 400 }}>{pair[1]}</button>;
              })}
            </div>
          </div>
        </div>
      )}

      {/* Capture */}
      <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderBottom: br, background: bgP }}>
        <input value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleInputKeyDown}
          placeholder="What's on your mind? Drop it here."
          style={{ flex: 1, padding: "8px 11px", fontSize: 13, border: br, borderRadius: 8, background: bgP, color: txP }} />
        <button onClick={handleAdd} style={{ background: NAVY, color: "white", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 12, cursor: "pointer" }}>+ Add</button>
      </div>

      {/* Kanban */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", minHeight: 200 }}>
        {COLS.map(function(col, ci) {
          var isColTarget = dropOver && dropOver.type === "col" && dropOver.col === col;
          var visibleCards = groups[col].filter(function(c) { return cardMatchesFilters(c, filters); });

          return (
            <div key={col}
              onDragOver={(e) => handleColDragOver(e, col)}
              onDrop={(e) => handleColDrop(e, col)}
              onDragLeave={() => setDropOver(null)}
              style={{ padding: "10px 6px", borderRight: ci < 4 ? br : "none", background: isColTarget ? "rgba(27,46,79,0.04)" : "transparent" }}>

              {/* Column header */}
              <div style={{ marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 3 }}>
                {editingCol === col ? (
                  <input autoFocus value={colLabels[col]}
                    onChange={(e) => setColLabels(function(p) { return Object.assign({}, p, { [col]: e.target.value }); })}
                    onBlur={(e) => handleLabelSave(col, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") handleLabelSave(col, e.target.value); }}
                    style={{ flex: 1, fontSize: 10, fontWeight: 500, border: "none", background: "transparent", color: txP, outline: "none", borderBottom: "1.5px solid " + NAVY, padding: "0 0 1px 0", fontFamily: "inherit" }} />
                ) : (
                  <span onClick={() => setEditingCol(col)} title="Click to rename"
                    style={{ flex: 1, fontSize: 10, fontWeight: 500, color: txS, cursor: "text", lineHeight: 1.3 }}>{colLabels[col]}</span>
                )}
                <span style={{ background: bgS, borderRadius: 8, padding: "1px 4px", fontSize: 9, color: "var(--color-text-tertiary,#aaa)", flexShrink: 0 }}>
                  {nFilters > 0 ? visibleCards.length + "/" + groups[col].length : groups[col].length}
                </span>
              </div>

              {/* Cards */}
              {visibleCards.map(function(card) {
                var c = getColor(card.color);
                var isDrag  = drag && drag.id === card.id;
                var isAbove = dropOver && dropOver.type === "card" && dropOver.id === card.id && dropOver.above;
                var isBelow = dropOver && dropOver.type === "card" && dropOver.id === card.id && !dropOver.above;
                var dm = getDueMeta(card.dueDate);
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
                    {/* Badges row */}
                    {(card.emoji || card.assignedTo || card.dueDate) && (
                      <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                        {card.emoji && <span style={{ fontSize: 10 }}>{card.emoji}</span>}
                        {card.assignedTo && (
                          <span style={{ fontSize: 9, background: "rgba(0,0,0,0.12)", borderRadius: 8, padding: "1px 4px" }}>{initials(card.assignedTo)}</span>
                        )}
                        {dm && (
                          <span style={{ fontSize: 9, color: dm.color, fontWeight: 500 }}>{dm.label}</span>
                        )}
                      </div>
                    )}
                    {card.notes && (
                      <div style={{ fontSize: 10, marginTop: 3, opacity: 0.7, fontStyle: "italic", overflow: "hidden", maxHeight: "2.5em", lineHeight: 1.3 }}>{card.notes}</div>
                    )}
                  </div>
                );
              })}

              {/* Show hidden count when filtering */}
              {nFilters > 0 && groups[col].length > visibleCards.length && (
                <div style={{ fontSize: 9, color: txS, textAlign: "center", padding: "4px 0", opacity: 0.6 }}>
                  {groups[col].length - visibleCards.length} hidden by filter
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
