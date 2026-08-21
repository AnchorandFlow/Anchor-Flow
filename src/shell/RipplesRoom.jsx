// src/shell/RipplesRoom.jsx — the family story engine (V1)
// Built to the mockup (anchor-flow-full-app v28), brighter teal tune.
// Reads/writes the SAME af_ripples data as the legacy RippleSection:
//   { id, name, who, category, date, note }
// Categories map to the app's real RIPPLE_CATS (not the mockup's fictional tags).
// Traditions tab uses its own af_traditions localStorage key (bypasses household
// sync to avoid the reload loop, same pattern as Exhale).
import { useState, useEffect, useRef } from "react";
import UndoToast from "../components/UndoToast.jsx";

var SERIF = "'Cormorant Garamond', serif";
var SANS = "'DM Sans', sans-serif";

// Brighter teal room palette (locked June 12)
var C = {
  bg1: "#3E8B91", bg2: "#2B7378", bg3: "#1E5B63",
  sea: "#b7d4cf", sand: "#d8c6a3", cream: "#f5f0e8",
  t1: "#f5f0e8", t2: "rgba(245,240,232,.72)", t3: "rgba(245,240,232,.40)",
  card: "rgba(30,91,99,.45)", cardSolid: "rgba(23,71,78,.7)",
  border: "rgba(183,212,207,.14)",
  // Sand card variant — the "record a memory" prompt card uses this opaque
  // warm sand instead of the teal glass above, for variety. Matches
  // AnchorVault's own #f7f1e3 card convention, so it needs its own dark-on-
  // light text/accent set — the cream (t1/t2/t3) and light-teal (sea) tones
  // above are unreadable against it.
  sandBg: "#f7f1e3", sandBorder: "rgba(26,46,61,0.12)",
  sandT1: "#1a2e3d", sandT2: "#3d5568", sandT3: "#4a6275", sandAccent: "#2B7378",
  // Light-teal card variant — milestone/memory display cards (the Timeline
  // list and "On This Day" highlight) use this instead of the dark teal
  // glass, for visual distinction. Opaque and light, so it reuses the sand
  // variant's dark-on-light text/accent set above rather than duplicating it.
  teal2: "#b8d8d8", teal2Border: "rgba(26,46,61,0.12)", teal2Line: "rgba(26,46,61,.15)",
};

// Map real categories -> a dot color + display label for the timeline
var CAT_STYLE = {
  milestone: { color: "#b7d4cf", label: "Milestone" },
  firsts:    { color: "#9ec8c0", label: "First" },
  school:    { color: "#e8a0b0", label: "Learning win" },
  sports:    { color: "#7fb1b5", label: "Sports" },
  funny:     { color: "#d8c6a3", label: "Funny" },
  faith:     { color: "#c3b0d8", label: "Faith" },
  other:     { color: "#b7d4cf", label: "Memory" },
};
function catStyle(id) { return CAT_STYLE[id] || CAT_STYLE.other; }

// Emoji palette for traditions
var TRAD_EMOJIS = ["🎃","🎄","🦃","🥳","🇺🇸","🎂","🌸","☃️","🏖️","🍂","🎆","🕯️","🍪","🎁","⛄","🌟","🎒","🎓","📚"];

function loadRipples() {
  try { var v = JSON.parse(localStorage.getItem("af_ripples") || "[]"); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}
function loadTraditions() {
  try { var v = JSON.parse(localStorage.getItem("af_traditions") || "[]"); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}
function saveTraditions(list) {
  try { localStorage.setItem("af_traditions", JSON.stringify(list)); } catch (e) {}
  try {
    var _dirty = JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]");
    if (_dirty.indexOf("traditions") === -1) {
      _dirty.push("traditions");
      localStorage.setItem("af_dirtyKeys", JSON.stringify(_dirty));
    }
  } catch(e) {}
  try { window.dispatchEvent(new CustomEvent("af-data-changed")); } catch(e) {}
}
function fmtDate(d, opts) {
  if (!d) return "";
  var x = new Date(d + "T00:00:00");
  if (isNaN(x)) return "";
  return x.toLocaleDateString("en-US", opts || { month: "short", day: "numeric" });
}

// Days until next occurrence of a month/day (recurring annually)
function daysUntil(monthDay) {
  if (!monthDay) return null;
  var parts = monthDay.split("-"); // "MM-DD"
  if (parts.length !== 2) return null;
  var m = parseInt(parts[0]) - 1, d = parseInt(parts[1]);
  if (isNaN(m) || isNaN(d)) return null;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var next = new Date(today.getFullYear(), m, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m, d);
  return Math.round((next - today) / 86400000);
}

var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtMonthDay(monthDay) {
  if (!monthDay) return "";
  var parts = monthDay.split("-");
  if (parts.length !== 2) return "";
  return MONTHS[parseInt(parts[0]) - 1] + " " + parseInt(parts[1]);
}

var TABS = [
  { id: "timeline", label: "Timeline" },
  { id: "quotes", label: "Kid Quotes" },
  { id: "traditions", label: "Traditions" },
  { id: "recaps", label: "Recaps" },
  { id: "yearbook", label: "Yearbook" },
];

var THIS_YEAR = new Date().getFullYear();

export default function RipplesRoom(props) {
  var [tab, setTab] = useState("timeline");
  var [ripples, setRipples] = useState(loadRipples);
  var [traditions, setTraditions] = useState(loadTraditions);

  // Traditions editor state
  var [editing, setEditing] = useState(null); // tradition id, "new", or null
  var [fEmoji, setFEmoji] = useState("🎃");
  var [fTitle, setFTitle] = useState("");
  var [fStarted, setFStarted] = useState(String(THIS_YEAR));
  var [fWhen, setFWhen] = useState(""); // "MM-DD"
  var [fDesc, setFDesc] = useState("");

  useEffect(function () {
    function onRefresh(e) {
      if (!e || !e.detail || !e.detail.key || e.detail.key === "ripples") setRipples(loadRipples());
    }
    window.addEventListener("af-data-changed", onRefresh);
    return function () { window.removeEventListener("af-data-changed", onRefresh); };
  }, []);

  var sorted = ripples.slice().sort(function (a, b) {
    if (!a.date && !b.date) return 0; if (!a.date) return 1; if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  // On This Day: a ripple from a prior year matching today's month/day
  var today = new Date();
  var onThisDay = sorted.find(function (r) {
    if (!r.date) return false;
    var d = new Date(r.date + "T00:00:00");
    return !isNaN(d) && d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear();
  });

  // Stats for current month
  var thisMonth = sorted.filter(function (r) {
    if (!r.date) return false;
    var d = new Date(r.date + "T00:00:00");
    return !isNaN(d) && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });
  var milestoneCount = sorted.filter(function (r) { return r.category === "milestone"; }).length;
  var quoteRipples = sorted.filter(function (r) { return r.category === "funny" || (r.name && r.name.indexOf('"') !== -1); });

  var [addOpen, setAddOpen] = useState(false);
  var [addForm, setAddForm] = useState({ name: "", who: "", category: "milestone", date: "", note: "", photo: null });
  var [editingRippleId, setEditingRippleId] = useState(null); // ripple id being edited, or null when adding new

  // Undo toast — same pattern as WavesSection/MealsTab (App.jsx).
  var [undoToast, setUndoToast] = useState(null);
  var undoTimeoutRef = useRef(null);
  function showUndoToast(message, undoFn) {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoToast({ message: message, undoFn: undoFn });
    undoTimeoutRef.current = setTimeout(function () { setUndoToast(null); undoTimeoutRef.current = null; }, 4000);
  }
  function handleUndoClick() {
    if (undoTimeoutRef.current) { clearTimeout(undoTimeoutRef.current); undoTimeoutRef.current = null; }
    if (undoToast && undoToast.undoFn) undoToast.undoFn();
    setUndoToast(null);
  }

  function quickAdd(category) {
    var today = new Date().toISOString().slice(0, 10);
    setEditingRippleId(null);
    setAddForm({ name: "", who: "", category: category || "milestone", date: today, note: "", photo: null });
    setAddOpen(true);
  }
  function openRippleEdit(r) {
    setEditingRippleId(r.id);
    setAddForm({ name: r.name || "", who: r.who || "", category: r.category || "milestone", date: r.date || "", note: r.note || "", photo: r.photo || null });
    setAddOpen(true);
  }
  function closeAddModal() {
    setAddOpen(false);
    setEditingRippleId(null);
  }
  function saveRipple(form) {
    var next;
    if (editingRippleId) {
      next = ripples.map(function (r) {
        return r.id === editingRippleId ? Object.assign({}, r, { name: form.name.trim(), who: form.who, category: form.category, date: form.date, note: form.note, photo: form.photo || null }) : r;
      });
    } else {
      var item = { id: "r-" + Date.now(), name: form.name.trim(), who: form.who, category: form.category, date: form.date, note: form.note, photo: form.photo || null };
      next = [item].concat(ripples);
    }
    setRipples(next);
    try { localStorage.setItem("af_ripples", JSON.stringify(next)); } catch(e) {}
    window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: "ripples" } }));
    closeAddModal();
  }
  function persistRipples(next) {
    setRipples(next);
    try { localStorage.setItem("af_ripples", JSON.stringify(next)); } catch(e) {}
    window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: "ripples" } }));
  }
  function deleteRipple(id) {
    var snapshot = ripples;
    var deleted = ripples.find(function (r) { return r.id === id; });
    persistRipples(ripples.filter(function (r) { return r.id !== id; }));
    closeAddModal();
    if (deleted) {
      showUndoToast("\"" + (deleted.name || "Ripple") + "\" deleted", function () { persistRipples(snapshot); });
    }
  }

  // ── tradition helpers ──
  function resetForm() {
    setFEmoji("🎃"); setFTitle(""); setFStarted(String(THIS_YEAR)); setFWhen(""); setFDesc("");
  }
  function openNew() { resetForm(); setEditing("new"); }
  function openEdit(t) {
    setFEmoji(t.emoji || "🎃"); setFTitle(t.title || ""); setFStarted(String(t.startedYear || THIS_YEAR));
    setFWhen(t.when || ""); setFDesc(t.description || ""); setEditing(t.id);
  }
  function closeForm() { setEditing(null); resetForm(); }

  function saveForm() {
    var title = fTitle.trim();
    if (!title) { closeForm(); return; }
    var startedYear = parseInt(fStarted) || THIS_YEAR;
    // years celebrated: from startedYear through this year
    var years = [];
    for (var y = startedYear; y <= THIS_YEAR; y++) years.push(y);
    var next;
    if (editing === "new") {
      var item = { id: "trad-" + Date.now(), emoji: fEmoji, title: title, startedYear: startedYear, when: fWhen || null, description: fDesc.trim(), years: years };
      next = [item].concat(traditions);
    } else {
      next = traditions.map(function (t) {
        if (t.id !== editing) return t;
        return Object.assign({}, t, { emoji: fEmoji, title: title, startedYear: startedYear, when: fWhen || null, description: fDesc.trim(), years: years });
      });
    }
    setTraditions(next); saveTraditions(next); closeForm();
  }

  function deleteTradition(id) {
    var next = traditions.filter(function (t) { return t.id !== id; });
    setTraditions(next); saveTraditions(next); closeForm();
  }

  function markCelebrated(id) {
    var next = traditions.map(function (t) {
      if (t.id !== id) return t;
      var years = (t.years || []).slice();
      if (years.indexOf(THIS_YEAR) === -1) years.push(THIS_YEAR);
      return Object.assign({}, t, { years: years });
    });
    setTraditions(next); saveTraditions(next);
  }

  // Sort traditions by soonest upcoming
  var sortedTrad = traditions.slice().sort(function (a, b) {
    var da = daysUntil(a.when), db = daysUntil(b.when);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });

  // ── shared bits ──
  function ph(title, sub) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: "1.6rem", fontWeight: 600, color: C.t1 }}>{title}</div>
          <div style={{ fontSize: ".78rem", color: C.t3, fontFamily: SANS }}>{sub}</div>
        </div>
        <div onClick={function () { tab === "traditions" ? openNew() : quickAdd(tab === "quotes" ? "funny" : null); }} style={{ padding: "7px 15px", border: "1px solid " + C.border, borderRadius: 9, color: C.sea, fontSize: ".78rem", cursor: "pointer", fontFamily: SANS }}>{tab === "traditions" ? "+ Add tradition" : "+ Add ripple"}</div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "2rem", fontFamily: SANS }}>
      {ph("Ripples", "The story of your family")}

      {/* Inner tab bar */}
      <div style={{ display: "flex", gap: 3, background: "rgba(29,58,62,.5)", border: "1px solid " + C.border, borderRadius: 10, padding: 3, width: "fit-content", marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(function (t) {
          var on = tab === t.id;
          return <div key={t.id} onClick={function () { setTab(t.id); }} style={{ padding: "6px 14px", borderRadius: 8, fontSize: ".74rem", cursor: "pointer", color: on ? C.bg3 : C.t2, background: on ? C.sea : "transparent", fontWeight: on ? 700 : 400, transition: "all .15s" }}>{t.label}</div>;
        })}
      </div>

      {/* ── TIMELINE ── */}
      {tab === "timeline" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {onThisDay && (
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "13px 15px", background: C.teal2, border: "1px solid " + C.teal2Border, borderRadius: 12 }}>
              <span style={{ fontSize: "1.35rem" }}>✨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: ".58rem", letterSpacing: ".16em", textTransform: "uppercase", color: C.sandAccent, marginBottom: 3 }}>On This Day · {fmtDate(onThisDay.date, { month: "long", day: "numeric", year: "numeric" })}</div>
                <div style={{ fontSize: ".88rem", color: C.sandT1, fontFamily: SERIF, fontStyle: "italic", lineHeight: 1.4 }}>{onThisDay.name}</div>
                {onThisDay.who && <div style={{ fontSize: ".61rem", color: C.sandT3, marginTop: 3 }}>{onThisDay.who}</div>}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
            {/* Timeline list */}
            <div style={{ background: C.teal2, border: "1px solid " + C.teal2Border, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: C.sandAccent, opacity: .8 }}>Timeline</div>
                  <div style={{ fontFamily: SERIF, fontSize: "1.1rem", color: C.sandT1 }}>Memories & Milestones</div>
                </div>
              </div>
              {sorted.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 12px" }}>
                  <div style={{ fontSize: "1.8rem", opacity: .3, marginBottom: 8 }}>🌊</div>
                  <div style={{ fontFamily: SERIF, fontSize: "1.05rem", color: C.sandT1, marginBottom: 6 }}>The story starts here</div>
                  <div style={{ fontSize: ".76rem", color: C.sandT3, lineHeight: 1.6 }}>Capture first words, lost teeth, goals scored — anything worth remembering.</div>
                </div>
              ) : sorted.slice(0, 30).map(function (r) {
                var cs = catStyle(r.category);
                return (
                  <div key={r.id} onClick={function () { openRippleEdit(r); }} style={{ display: "flex", gap: 11, marginBottom: 14, cursor: "pointer" }}>
                    <div style={{ fontFamily: SERIF, fontStyle: "italic", color: C.sandT3, fontSize: ".76rem", width: 46, flexShrink: 0, paddingTop: 1 }}>{fmtDate(r.date)}</div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: cs.color, boxShadow: "0 0 6px " + cs.color + "88" }} />
                      <div style={{ width: 1, flex: 1, background: C.teal2Line, marginTop: 4 }} />
                    </div>
                    <div style={{ flex: 1, paddingBottom: 2 }}>
                      <div style={{ fontSize: ".82rem", color: C.sandT1, lineHeight: 1.37 }}>{r.name}</div>
                      {r.note && <div style={{ fontSize: ".72rem", color: C.sandT2, marginTop: 2, lineHeight: 1.4 }}>{r.note}</div>}
                      {r.photo && (
                        <div style={{ marginTop: 7, borderRadius: 8, overflow: "hidden" }}>
                          <img src={r.photo} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", display: "block", borderRadius: 8 }} />
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                        {r.who && <span style={{ fontSize: ".64rem", color: C.sandT3 }}>{r.who}</span>}
                        <span style={{ fontSize: ".6rem", padding: "1px 8px", borderRadius: 20, background: cs.color + "26", color: C.sandT1 }}>{cs.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right column: stats + daily prompt + quick add */}
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[{ n: thisMonth.length, l: "This month" }, { n: milestoneCount, l: "Milestones" }, { n: quoteRipples.length, l: "Quotes" }].map(function (s, i) {
                  return (
                    <div key={i} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 11, padding: "12px 8px", textAlign: "center" }}>
                      <div style={{ fontFamily: SERIF, fontSize: "1.5rem", color: C.sea, lineHeight: 1 }}>{s.n}</div>
                      <div style={{ fontSize: ".58rem", color: C.t3, marginTop: 4 }}>{s.l}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: 16, background: C.sandBg, border: "1px solid " + C.sandBorder, borderRadius: 11 }}>
                <div style={{ fontSize: ".56rem", letterSpacing: ".18em", textTransform: "uppercase", color: C.sandAccent, marginBottom: 8, opacity: .8 }}>Today's Ripple Prompt</div>
                <div style={{ fontFamily: SERIF, fontSize: "1.05rem", color: C.sandT1, fontStyle: "italic", lineHeight: 1.55, marginBottom: 12 }}>"What's one moment from today worth holding onto?"</div>
                <div onClick={function () { quickAdd(null); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(26,46,61,.05)", border: "1px solid " + C.sandBorder, borderRadius: 8, cursor: "pointer" }}>
                  <span style={{ opacity: .35, fontSize: ".85rem" }}>✎</span>
                  <span style={{ fontSize: ".75rem", color: C.sandT3, fontStyle: "italic", fontFamily: SERIF }}>Just a sentence or two is enough.</span>
                </div>
                <div style={{ fontSize: ".6rem", color: C.sandT3, marginTop: 8, textAlign: "right" }}>from Compass 🧭</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: ".57rem", letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(183,212,207,.45)" }}>Quick add</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[{ l: "📷 Photo memory", c: "other" }, { l: "💬 Kid quote", c: "funny" }, { l: "⭐ Milestone", c: "milestone" }, { l: "🏆 First", c: "firsts" }].map(function (q) {
                    return <div key={q.l} onClick={function () { quickAdd(q.c); }} style={{ padding: "4px 10px", background: "rgba(36,72,76,.7)", border: "1px solid rgba(183,212,207,.15)", borderRadius: 20, fontSize: ".64rem", color: C.t2, cursor: "pointer" }}>{q.l}</div>;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── KID QUOTES ── */}
      {tab === "quotes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontFamily: SERIF, fontSize: "1.2rem", color: C.t1 }}>Kid Quotes</div>
            <div style={{ fontSize: ".76rem", color: C.t3 }}>Things they said</div>
          </div>
          {quoteRipples.length === 0 ? (
            <div style={{ padding: "10px 14px", background: C.card, border: "1px dashed " + C.border, borderRadius: 9, textAlign: "center" }}>
              <div style={{ fontSize: ".76rem", color: C.t3, fontStyle: "italic", fontFamily: SERIF }}>No quotes yet — tag a ripple "Funny" or wrap it in quotes to see it here.</div>
            </div>
          ) : quoteRipples.map(function (r) {
            return (
              <div key={r.id} onClick={function () { openRippleEdit(r); }} style={{ padding: "14px 16px", background: C.sandBg, border: "1px solid " + C.sandBorder, borderRadius: 11, cursor: "pointer" }}>
                <div style={{ fontFamily: SERIF, fontSize: "1.05rem", fontStyle: "italic", color: C.sandT1, lineHeight: 1.4 }}>{r.name}</div>
                <div style={{ fontSize: ".66rem", color: C.sandT3, marginTop: 6 }}>{[r.who, fmtDate(r.date, { month: "long", day: "numeric", year: "numeric" })].filter(Boolean).join(" · ")}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TRADITIONS ── */}
      {tab === "traditions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ marginBottom: 2 }}>
            <div style={{ fontFamily: SERIF, fontSize: "1.2rem", color: C.t1 }}>Traditions</div>
            <div style={{ fontSize: ".76rem", color: C.t3 }}>The things that make your family yours</div>
          </div>

          {/* Editor form */}
          {editing && (
            <div style={{ background: C.cardSolid, border: "1px solid " + C.border, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: C.sea, marginBottom: 12, opacity: .8 }}>{editing === "new" ? "New tradition" : "Edit tradition"}</div>

              {/* Emoji picker */}
              <div style={{ fontSize: ".66rem", color: C.t2, marginBottom: 6 }}>Choose an emoji</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
                {TRAD_EMOJIS.map(function (em) {
                  var on = fEmoji === em;
                  return <div key={em} onClick={function () { setFEmoji(em); }} style={{ fontSize: "1.1rem", padding: "5px 7px", borderRadius: 8, cursor: "pointer", background: on ? C.sea : "rgba(183,212,207,.07)", border: "1px solid " + (on ? C.sea : C.border) }}>{em}</div>;
                })}
              </div>

              {/* Title */}
              <input value={fTitle} onChange={function (e) { setFTitle(e.target.value); }} placeholder="Tradition name (e.g. Pumpkin pancakes on first snow)"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.sandBorder, background: C.sandBg, color: C.sandT1, fontSize: ".82rem", fontFamily: SANS, marginBottom: 10, outline: "none" }} />

              {/* Started year + when */}
              <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: ".62rem", color: C.t3, marginBottom: 4 }}>Started in</div>
                  <input value={fStarted} onChange={function (e) { setFStarted(e.target.value.replace(/[^0-9]/g, "")); }} placeholder={String(THIS_YEAR)} maxLength={4}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.sandBorder, background: C.sandBg, color: C.sandT1, fontSize: ".78rem", fontFamily: SANS, outline: "none" }} />
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: ".62rem", color: C.t3, marginBottom: 4 }}>When (optional)</div>
                  <select value={fWhen} onChange={function (e) { setFWhen(e.target.value); }}
                    style={{ width: "100%", WebkitAppearance: "none", appearance: "none", padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.sandBorder, background: C.sandBg, color: C.sandT1, fontSize: ".78rem", fontFamily: SANS, outline: "none" }}>
                    <option value="">No set date</option>
                    {MONTHS.map(function (mo, mi) {
                      var mm = String(mi + 1).padStart(2, "0");
                      return <option key={mo} value={mm + "-01"}>{mo}</option>;
                    })}
                  </select>
                </div>
              </div>

              {/* Description */}
              <textarea value={fDesc} onChange={function (e) { setFDesc(e.target.value); }} placeholder="What happens? Why does it matter? (optional)" rows={3}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.sandBorder, background: C.sandBg, color: C.sandT1, fontSize: ".78rem", fontFamily: SANS, resize: "none", marginBottom: 12, outline: "none", lineHeight: 1.5 }} />

              {/* Buttons */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div onClick={saveForm} style={{ flex: 1, padding: "9px 16px", borderRadius: 9, background: C.sea, color: C.bg3, fontSize: ".78rem", fontWeight: 700, cursor: "pointer", textAlign: "center" }}>Save tradition</div>
                <div onClick={closeForm} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid " + C.border, color: C.t2, fontSize: ".78rem", cursor: "pointer" }}>Cancel</div>
                {editing !== "new" && <div onClick={function () { deleteTradition(editing); }} style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid rgba(232,160,176,.3)", color: "#e8a0b0", fontSize: ".78rem", cursor: "pointer" }}>Delete</div>}
              </div>
            </div>
          )}

          {/* Tradition cards */}
          {!editing && sortedTrad.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 20px", background: C.card, border: "1px solid " + C.border, borderRadius: 14 }}>
              <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>🎃</div>
              <div style={{ fontFamily: SERIF, fontSize: "1.1rem", color: C.t1, marginBottom: 6 }}>Your family's living traditions</div>
              <div style={{ fontSize: ".76rem", color: C.t3, lineHeight: 1.6, marginBottom: 14 }}>Pumpkin pancakes on the first snow. The Christmas Eve lights drive. The birthday breakfast plate. Capture the rituals that make you, you.</div>
              <div onClick={openNew} style={{ display: "inline-block", padding: "8px 18px", borderRadius: 9, background: C.sea, color: C.bg3, fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>+ Add your first tradition</div>
            </div>
          )}

          {!editing && sortedTrad.map(function (t) {
            var days = daysUntil(t.when);
            var years = t.years || [];
            return (
              <div key={t.id} onClick={function () { openEdit(t); }} style={{ background: C.sandBg, border: "1px solid " + C.sandBorder, borderRadius: 14, padding: "16px 18px", cursor: "pointer" }}>
                <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                  <div style={{ fontSize: "1.9rem", flexShrink: 0, lineHeight: 1 }}>{t.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: SERIF, fontSize: "1.15rem", color: C.sandT1, lineHeight: 1.3 }}>{t.title}</div>
                    <div style={{ fontSize: ".64rem", color: C.sandT3, marginTop: 3 }}>
                      {t.when ? fmtMonthDay(t.when) + " · " : ""}Started {t.startedYear} · {years.length} year{years.length === 1 ? "" : "s"} running
                    </div>
                    {t.description && <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: ".86rem", color: C.sandT2, marginTop: 8, lineHeight: 1.5 }}>"{t.description}"</div>}

                    {/* Year pills */}
                    {years.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 10 }}>
                        {years.map(function (y) {
                          return <span key={y} style={{ fontSize: ".6rem", padding: "2px 8px", borderRadius: 20, background: C.sandAccent + "18", border: "0.5px solid " + C.sandAccent + "55", color: C.sandAccent }}>{y}</span>;
                        })}
                      </div>
                    )}

                    {/* Countdown + mark celebrated */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                      {days !== null && (
                        <span style={{ fontSize: ".64rem", color: C.sandAccent }}>
                          {days === 0 ? "🎉 Today!" : days === 1 ? "Tomorrow" : days + " days away"}
                        </span>
                      )}
                      {years.indexOf(THIS_YEAR) === -1 && (
                        <div onClick={function (e) { e.stopPropagation(); markCelebrated(t.id); }} style={{ fontSize: ".64rem", padding: "3px 10px", borderRadius: 20, border: "1px solid " + C.sandBorder, color: C.sandAccent, cursor: "pointer" }}>✓ Celebrated this year</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Compass nudge — surfaces soonest tradition */}
          {!editing && sortedTrad.length > 0 && (function () {
            var soonest = sortedTrad.find(function (t) { var d = daysUntil(t.when); return d !== null && d <= 14; });
            if (!soonest) return null;
            var d = daysUntil(soonest.when);
            return (
              <div style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "13px 15px", background: C.cardSolid, border: "1px solid " + C.border, borderRadius: 12 }}>
                <span style={{ fontSize: "1.1rem" }}>🧭</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: C.sea, marginBottom: 3, opacity: .8 }}>From Compass</div>
                  <div style={{ fontSize: ".82rem", color: C.t1, lineHeight: 1.45 }}>
                    {soonest.title} is {d === 0 ? "today" : d === 1 ? "tomorrow" : "just " + d + " days away"}. Want to plan this year's?
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── RECAPS (Pass 2 wires generation here) ── */}
      {tab === "recaps" && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: SERIF, fontSize: "1.2rem", color: C.t1 }}>Monthly Recaps</div>
            <div style={{ fontSize: ".76rem", color: C.t3 }}>Your family's story, month by month</div>
          </div>
          {props.recapSlot || (
            <div style={{ padding: "28px 20px", background: C.card, border: "1px solid " + C.border, borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>🧭</div>
              <div style={{ fontFamily: SERIF, fontSize: "1.1rem", color: C.t1, marginBottom: 8 }}>Month recaps are coming soon</div>
              <div style={{ fontSize: ".76rem", color: C.t3, lineHeight: 1.6 }}>Compass will gather each month's memories, milestones, and trips into a warm recap you can keep.</div>
            </div>
          )}
        </div>
      )}

      {/* ── YEARBOOK (V3, deferred) ── */}
      {tab === "yearbook" && (
        <div style={{ padding: "28px 20px", background: C.card, border: "1px solid " + C.border, borderRadius: 12, textAlign: "center" }}>
          <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>📖</div>
          <div style={{ fontFamily: SERIF, fontSize: "1.1rem", color: C.t1, marginBottom: 8 }}>Family Yearbook</div>
          <div style={{ fontSize: ".76rem", color: C.t3, lineHeight: 1.6 }}>One day soon, Compass will weave a year of ripples into a keepsake book — photos, milestones, and quotes together.</div>
        </div>
      )}

    {/* ── Add-ripple modal ── */}
    {addOpen && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
        <div style={{ background: "#1E5B63", border: "1px solid " + C.border, borderRadius: 16, padding: "20px", width: "100%", maxWidth: 380 }}>
          <div style={{ fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: C.sea, marginBottom: 12 }}>{editingRippleId ? "Edit ripple" : "Capture a ripple"}</div>
          <input value={addForm.name} onChange={function(e){ setAddForm(function(p){ return Object.assign({},p,{name:e.target.value}); }); }} placeholder="What happened? (e.g. First steps!)"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.sandBorder, background: C.sandBg, color: C.sandT1, fontSize: ".82rem", fontFamily: SANS, marginBottom: 10, outline: "none", boxSizing: "border-box" }} autoFocus />
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ".62rem", color: C.t3, marginBottom: 4 }}>Category</div>
              <select value={addForm.category} onChange={function(e){ setAddForm(function(p){ return Object.assign({},p,{category:e.target.value}); }); }}
                style={{ width: "100%", WebkitAppearance: "none", appearance: "none", padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.sandBorder, background: C.sandBg, color: C.sandT1, fontSize: ".78rem", fontFamily: SANS, outline: "none" }}>
                <option value="milestone">Milestone</option>
                <option value="firsts">First</option>
                <option value="school">Learning win</option>
                <option value="sports">Sports</option>
                <option value="funny">Funny</option>
                <option value="faith">Faith</option>
                <option value="other">Memory</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ".62rem", color: C.t3, marginBottom: 4 }}>Date</div>
              <input type="date" value={addForm.date} onChange={function(e){ setAddForm(function(p){ return Object.assign({},p,{date:e.target.value}); }); }}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.sandBorder, background: C.sandBg, color: C.sandT1, fontSize: ".78rem", fontFamily: SANS, outline: "none" }} />
            </div>
          </div>
          <textarea value={addForm.note} onChange={function(e){ setAddForm(function(p){ return Object.assign({},p,{note:e.target.value}); }); }} placeholder="Notes (optional)" rows={2}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.sandBorder, background: C.sandBg, color: C.sandT1, fontSize: ".78rem", fontFamily: SANS, resize: "none", marginBottom: 10, outline: "none", lineHeight: 1.5, boxSizing: "border-box" }} />
          <label style={{ display: "block", marginBottom: 12, cursor: "pointer" }}>
            {addForm.photo ? (
              <div style={{ position: "relative" }}>
                <img src={addForm.photo} alt="" style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 9, display: "block" }} />
                <div onClick={function(e){ e.preventDefault(); setAddForm(function(p){ return Object.assign({},p,{photo:null}); }); }} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.55)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: ".7rem", color: "#fff" }}>✕</div>
              </div>
            ) : (
              <div style={{ padding: "11px 12px", background: "rgba(183,212,207,.06)", border: "1.5px dashed rgba(183,212,207,.25)", borderRadius: 9, textAlign: "center" }}>
                <div style={{ fontSize: ".66rem", color: C.t3, fontFamily: SANS }}>📷 Add a photo (optional)</div>
              </div>
            )}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={function(e){
              var file = e.target.files && e.target.files[0];
              if (!file) return;
              var reader = new FileReader();
              reader.onload = function(ev){ setAddForm(function(p){ return Object.assign({},p,{photo:ev.target.result}); }); };
              reader.readAsDataURL(file);
              e.target.value = "";
            }} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <div onClick={function(){ if(addForm.name.trim()) saveRipple(addForm); }} style={{ flex: 1, padding: "9px 16px", borderRadius: 9, background: C.sea, color: C.bg3, fontSize: ".78rem", fontWeight: 700, cursor: "pointer", textAlign: "center" }}>{editingRippleId ? "Save changes" : "Save ripple"}</div>
            <div onClick={closeAddModal} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid " + C.border, color: C.t2, fontSize: ".78rem", cursor: "pointer" }}>Cancel</div>
            {editingRippleId && <div onClick={function () { deleteRipple(editingRippleId); }} style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid rgba(232,160,176,.3)", color: "#e8a0b0", fontSize: ".78rem", cursor: "pointer" }}>Delete</div>}
          </div>
        </div>
      </div>
    )}
    <UndoToast toast={undoToast} onUndo={handleUndoClick} />
    </div>
  );
}
