// src/redesign/RedesignHome.jsx — the new Home screen, shown only when
// af_redesign is on (see HomeSwitch + src/design/redesignFlag.js).
//
// Data: HomeFlow-owned state comes in as props (always current); keys owned
// by other screens are read from localStorage and re-read on af-data-changed /
// storage / visibility. Read-only except the Exhale quick-add, which appends
// to the existing exhale_buckets key exactly like FlowHome's quick-add.
import { useState, useEffect, useRef } from "react";
import AnchorLogo from "../components/AnchorLogo.jsx";
import { color, gradient, radius, shadow, font, shouldShowEmoji, tone, fullBleed } from "../design/tokens.js";
import { buildHomeModel, daysLabel, EXHALED_BUCKET } from "./homeData.js";
import { whoOf } from "./flowData.js";
import { personIdOf } from "./exhaleModel.js";
import { isAnchoredToday } from "../lib/sunsetLog.js";
import { AnchoredCheck } from "../shell/SunsetClose.jsx";
import { SectionGlyph } from "../shell/TopNav.jsx";

var IVORY = gradient.sunset.text;
var NAVY = color.anchorNavy;
var MUTED = "#5B6472";
var BUCKET_COLORS = ["#4A9E8E", "#6ABAAA", "#7AB3D4", "#8BAF8B", "#A99AC4"]; // = ExhaleSection/FlowHome
var DEFAULT_BUCKETS = { bucketNames: ["Exhaled", "Today", "Tomorrow", "This Weekend", "Someday"], items: [] };

// Pillar icons match the sidebar's own (FlowWrapper PILLARS). Always shown.
var PILLARS = [
  { id: "today", label: "Today", icon: "🧭" },
  { id: "flow", label: "Flow", icon: "🌊" },
  { id: "anchor", label: "Anchor", icon: "🏠" },
  { id: "ripples", label: "Ripples", icon: "🌀" },
];

function rd(key, fb) {
  try { var v = JSON.parse(localStorage.getItem("af_" + key) || "null"); return v === null ? fb : v; } catch { return fb; }
}
function readStores() {
  return {
    exhaleBuckets: rd("exhale_buckets", DEFAULT_BUCKETS),
    safeHarbor: rd("safe_harbor", null),
    trips: rd("trips", []),
    celebrations: rd("celebrations", []),
    ripples: rd("ripples", []),
    traditions: rd("traditions", []),
  };
}
function goTab(tab) { try { window.dispatchEvent(new CustomEvent("af-set-tab", { detail: tab })); } catch { /* no window */ } }
function openVault(section) { try { window.dispatchEvent(new CustomEvent("af-open-vault", { detail: { section: section } })); } catch { /* no window */ } }
function uid() { return Math.random().toString(36).slice(2, 9); }

// Same write path as FlowHome's wr(): write, dirty-mark, notify sync.
function writeKey(key, val) {
  try { localStorage.setItem("af_" + key, JSON.stringify(val)); } catch { /* storage blocked */ }
  try {
    var dirty = JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]");
    if (!Array.isArray(dirty)) dirty = [];
    if (dirty.indexOf(key) === -1) { dirty.push(key); localStorage.setItem("af_dirtyKeys", JSON.stringify(dirty)); }
  } catch { /* storage blocked */ }
  try { window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: key } })); } catch { /* no window */ }
}

var THEMES = {
  today:   { bg: color.tint.sand, text: NAVY, sub: MUTED, border: "rgba(200,162,83,0.28)" },
  flow:    { bg: "#D6E7E8", text: NAVY, sub: MUTED, border: "rgba(94,143,160,0.30)" }, // Flow sea glass
  anchor:  { bg: NAVY, text: IVORY, sub: "rgba(242,234,216,0.72)", border: "transparent" },
  ripples: { bg: gradient.ripples.css, text: IVORY, sub: "rgba(242,234,216,0.78)", border: "transparent" },
};

var wrapText = { minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" };
var BRIEF_LABEL = { fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#DDBB70", marginBottom: 6 };
var BRIEF_ITEM = { fontSize: 14, lineHeight: 1.45, padding: "3px 0", overflowWrap: "anywhere" };

function Item(props) {
  var showIcon = props.icon && shouldShowEmoji(props.iconKind || "item", props.showEmojis);
  return (
    <button type="button" onClick={props.onClick} data-testid={props.testId}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box", textAlign: "left", background: "#FFFFFF", border: "none", borderRadius: radius.sm, boxShadow: shadow.card, padding: "11px 14px", cursor: "pointer", fontFamily: font.body, color: NAVY }}>
      {showIcon && <span aria-hidden="true" style={{ fontSize: 16, flexShrink: 0 }}>{props.icon}</span>}
      <span style={Object.assign({ flex: 1, display: "flex", flexDirection: "column", gap: 2 }, wrapText)}>
        <span style={{ fontSize: font.checklistItem.size, fontWeight: 600, lineHeight: 1.35 }}>{props.title}</span>
        {props.sub && <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>{props.sub}</span>}
      </span>
      {props.who && <span data-testid="who-dot" title={props.who.label} aria-label={"For " + props.who.label} style={{ width: 10, height: 10, borderRadius: "50%", background: props.who.color, flexShrink: 0 }} />}
      {props.meta != null && <span style={{ fontSize: 12, color: MUTED, flexShrink: 0, whiteSpace: "nowrap" }}>{props.meta}</span>}
      {props.dot && <span aria-label="Unread" style={{ width: 8, height: 8, borderRadius: "50%", background: color.gold, flexShrink: 0 }} />}
    </button>
  );
}

function Empty(props) {
  return <div style={{ fontFamily: font.heading, fontStyle: "italic", fontSize: 16, color: props.color, lineHeight: 1.45, padding: "4px 2px" }}>{props.children}</div>;
}

function Pillar(props) {
  var th = THEMES[props.id];
  var open = props.open;
  return (
    <section data-testid={"pillar-" + props.id} style={{ background: th.bg, border: "1px solid " + th.border, borderRadius: radius.lg, boxShadow: shadow.card, overflow: "hidden" }}>
      <button type="button" aria-expanded={open} onClick={props.onToggle}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box", background: "transparent", border: "none", padding: "16px 18px", cursor: "pointer", color: th.text, textAlign: "left" }}>
        <span aria-hidden="true" style={{ fontSize: 20, flexShrink: 0 }}>{props.icon}</span>
        <span style={Object.assign({ flex: 1, display: "flex", flexDirection: "column" }, wrapText)}>
          <span style={{ fontFamily: font.heading, fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>{props.label}</span>
          {props.summary && <span style={{ fontFamily: font.body, fontSize: 12.5, color: th.sub, marginTop: 2 }}>{props.summary}</span>}
        </span>
        <span aria-hidden="true" style={{ width: 9, height: 9, borderRight: "2px solid " + th.sub, borderBottom: "2px solid " + th.sub, transform: open ? "rotate(225deg)" : "rotate(45deg)", transition: "transform .2s", flexShrink: 0, marginTop: open ? 4 : -4 }} />
      </button>
      {open && <div style={{ padding: "0 14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>{props.children}</div>}
    </section>
  );
}

export default function RedesignHome(props) {
  var [stores, setStores] = useState(readStores);
  var [openId, setOpenId] = useState("today");
  var [compassLine, setCompassLine] = useState(null);
  var [brief, setBrief] = useState(null); // { notice, connection } from the daily briefing
  var [ask, setAsk] = useState("");
  var askRef = useRef(null);
  var [compassDone, setCompassDone] = useState(false);
  var [draft, setDraft] = useState("");
  var [justAdded, setJustAdded] = useState(false);
  var [, setTick] = useState(0);

  useEffect(function () {
    function refresh() { setStores(readStores()); }
    function onVis() { if (!document.hidden) { refresh(); setTick(function (n) { return n + 1; }); } }
    window.addEventListener("af-data-changed", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", onVis);
    var iv = setInterval(function () { setTick(function (n) { return n + 1; }); }, 60000); // greeting / Sunset hour
    return function () {
      window.removeEventListener("af-data-changed", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(iv);
    };
  }, []);

  useEffect(function () {
    var alive = true;
    if (props.compassEnabled === false || typeof props.loadCompassLine !== "function") { setCompassLine(null); setCompassDone(true); return; }
    var load = typeof props.loadCompassBrief === "function" ? props.loadCompassBrief : props.loadCompassLine;
    Promise.resolve().then(load).then(function (d) {
      if (!alive) return;
      var b = d && typeof d === "object" ? d : { notice: d || "" };
      setBrief(b); setCompassLine(b.notice || null); setCompassDone(true);
    }, function () { if (alive) { setBrief(null); setCompassLine(null); setCompassDone(true); } });
    return function () { alive = false; };
  }, [props.flowMode, props.compassEnabled]); // eslint-disable-line

  var m = buildHomeModel({
    now: props.now ? props.now() : new Date(),
    displayName: props.displayName, flowMode: props.flowMode,
    calEvents: props.calEvents, meals: props.meals, shoppingItems: props.shoppingItems,
    mealsEnabled: props.mealsEnabled,
    exhaleBuckets: stores.exhaleBuckets, safeHarbor: stores.safeHarbor, trips: stores.trips,
    celebrations: stores.celebrations, ripples: stores.ripples, traditions: stores.traditions,
  });
  var se = props.showEmojis === true;
  // Sunset done tonight (this member, household date): "Anchored" until the
  // household's midnight. Re-read every render (minute tick, data changes).
  var anchored = isAnchoredToday(props.now ? props.now() : new Date());

  useEffect(function () {
    function onFocusAsk(e) {
      if (!askRef.current) return;
      if (e && e.detail) e.detail.handled = true;
      try { askRef.current.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* old browser */ }
      askRef.current.focus();
    }
    window.addEventListener("af-focus-compass-ask", onFocusAsk);
    return function () { window.removeEventListener("af-focus-compass-ask", onFocusAsk); };
  }, []);
  function askCompass(e) {
    if (e && e.preventDefault) e.preventDefault();
    var q = ask.trim();
    if (!q) return;
    setAsk("");
    try { window.dispatchEvent(new CustomEvent("af-open-compass", { detail: { question: q } })); } catch { /* no window */ }
  }

  function toggle(id) { setOpenId(function (cur) { return cur === id ? null : id; }); }

  function addExhale(e) {
    if (e && e.preventDefault) e.preventDefault();
    var txt = draft.trim();
    if (!txt) return;
    var current = rd("exhale_buckets", DEFAULT_BUCKETS);
    var items = current && Array.isArray(current.items) ? current.items : [];
    var item = { id: uid(), text: txt, notes: "", dueDate: "", personId: null, bucketIndex: EXHALED_BUCKET, createdAt: Date.now(), color: BUCKET_COLORS[0] };
    var next = Object.assign({}, current, { items: [item].concat(items) });
    writeKey("exhale_buckets", next);
    setStores(readStores());
    setDraft("");
    setJustAdded(true);
    setTimeout(function () { setJustAdded(false); }, 2200);
  }

  function onVault() {
    if (props.vaultGated && props.onVaultGated) { props.onVaultGated(); return; }
    openVault("home");
  }

  var t = m.today, f = m.flow, a = m.anchor, r = m.ripples;
  var todayCount = t.events.length + t.exhale.length + (t.dinner ? 1 : 0);

  return (
    <div data-testid="redesign-home" style={Object.assign({ background: color.background, margin: "-1.1rem -0.9rem -0.5rem", padding: "16px 14px calc(28px + env(safe-area-inset-bottom, 0px))", minHeight: "100dvh", boxSizing: "border-box", fontFamily: font.body, color: NAVY, overflowX: "hidden" }, fullBleed(color.background))}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 2px 6px" }}>
          <span style={{ flexShrink: 0, display: "flex" }}><AnchorLogo size={40} color={NAVY} /></span>
          <div style={wrapText}>
            <h1 style={{ margin: 0, fontFamily: font.heading, fontSize: 28, fontWeight: 700, lineHeight: 1.1, color: NAVY }}>
              {m.greeting + (m.firstName ? ", " + m.firstName : "")}
            </h1>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>{m.dateLabel + " · " + m.mode}</div>
          </div>
        </header>

        {/* Compass daily brief — the large navy card at the top of Today */}
        <style>{".af-brief-ask{outline:none}.af-brief-ask:focus-visible{outline:2px solid #DDBB70;outline-offset:2px}.af-brief-ask::placeholder{color:rgba(242,234,216,0.6)}"}</style>
        <section data-testid="compass-brief" aria-label="Compass daily brief"
          style={{ background: NAVY, color: IVORY, borderRadius: radius.lg, boxShadow: shadow.raised, padding: "18px 18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#DDBB70,#B08840)", color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><SectionGlyph id="compass" size={18} /></span>
            <div style={{ fontFamily: font.heading, fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>Compass</div>
          </div>
          {props.compassEnabled === false ? (
            <div data-testid="compass-line" style={{ fontFamily: font.heading, fontStyle: "italic", fontSize: 18, lineHeight: 1.45, color: "rgba(242,234,216,0.82)" }}>Compass is resting. Turn it on in Settings any time.</div>
          ) : (
            <>
              {compassLine
                ? <div data-testid="compass-line" style={{ fontFamily: font.heading, fontStyle: "italic", fontSize: 19, lineHeight: 1.45 }}>{compassLine}</div>
                : <div style={{ fontFamily: font.heading, fontStyle: "italic", fontSize: 18, lineHeight: 1.45, color: "rgba(242,234,216,0.82)" }}>{compassDone ? "Compass is quiet for now. A calm day." : "Compass is looking over your day…"}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 12 }}>
                <div data-testid="brief-noted">
                  <div style={BRIEF_LABEL}>Gently noted</div>
                  {brief && brief.connection
                    ? <div style={BRIEF_ITEM}>{brief.connection}</div>
                    : <div style={Object.assign({}, BRIEF_ITEM, { color: "rgba(242,234,216,0.65)" })}>Nothing needs you right now.</div>}
                  {t.exhale.length > 0 && <div style={BRIEF_ITEM}>{t.exhale.length + " Exhale item" + (t.exhale.length === 1 ? "" : "s") + " for today"}</div>}
                </div>
                <div data-testid="brief-coming">
                  <div style={BRIEF_LABEL}>Coming up</div>
                  {t.events.slice(0, 3).map(function (ev, i) {
                    return <div key={"bc" + (ev.id || i)} style={BRIEF_ITEM}>{(ev.time ? ev.time + " · " : "Today · ") + (ev.title || "Event")}</div>;
                  })}
                  {a.horizon && <div style={BRIEF_ITEM}>{a.horizon.name + " · " + daysLabel(a.horizon.days)}</div>}
                  {!t.events.length && !a.horizon && <div style={Object.assign({}, BRIEF_ITEM, { color: "rgba(242,234,216,0.65)" })}>Nothing on the calendar yet.</div>}
                </div>
              </div>
              <form onSubmit={askCompass} style={{ display: "flex", gap: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(242,234,216,0.16)", borderRadius: radius.md, padding: 6 }}>
                <input ref={askRef} value={ask} onChange={function (e) { setAsk(e.target.value); }} aria-label="Ask Compass anything" data-testid="brief-ask"
                  placeholder="Ask Compass anything…" className="af-brief-ask"
                  style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", color: IVORY, fontFamily: font.body, fontSize: 16, padding: "8px 10px", borderRadius: 8 }} />
                <button type="submit" disabled={!ask.trim()} style={{ flexShrink: 0, border: "none", borderRadius: radius.sm, padding: "0 16px", background: "linear-gradient(135deg,#DDBB70,#B08840)", color: NAVY, fontFamily: font.body, fontWeight: 800, fontSize: 14, cursor: ask.trim() ? "pointer" : "default", opacity: ask.trim() ? 1 : 0.55 }}>Ask</button>
              </form>
            </>
          )}
        </section>

        {/* Today */}
        <Pillar id="today" label="Today" icon={PILLARS[0].icon} open={openId === "today"} onToggle={function () { toggle("today"); }}
          summary={todayCount ? todayCount + " thing" + (todayCount === 1 ? "" : "s") + " today" : "A clear day"}>
          {t.events.map(function (ev, i) {
            return <Item key={"ev" + (ev.id || i)} showEmojis={se} icon={ev.emoji || "📅"} title={ev.title || "Event"} meta={ev.time || null} onClick={function () { goTab("calendar"); }} />;
          })}
          {t.exhale.map(function (it) {
            return <Item key={"ex" + it.id} testId={"home-exhale-" + it.id} showEmojis={se} icon="💭" title={it.text || "Untitled"} sub={it.due ? "Exhale · Due today" : "Exhale · Today"}
              who={whoOf(personIdOf(it), props.people)} onClick={function () { goTab("brain"); }} />;
          })}
          {t.dinner && <Item showEmojis={se} icon="🍽️" title={t.dinner} sub="Dinner" onClick={function () { goTab("meals"); }} />}
          {!todayCount && <Empty color={MUTED}>Nothing scheduled today. A quiet day is a good day.</Empty>}
        </Pillar>

        {/* Flow */}
        <Pillar id="flow" label="Flow" icon={PILLARS[1].icon} open={openId === "flow"} onToggle={function () { toggle("flow"); }} summary="Exhale, shopping, and meals">
          <Item showEmojis={se} icon="💭" title="Exhale · Today" onClick={function () { goTab("brain"); }}
            sub={f.exhaleTodayCount ? null : "Your Today bucket is clear."}
            meta={f.exhaleTodayCount ? String(f.exhaleTodayCount) : null} />
          <Item showEmojis={se} icon="🛒" title="Shopping list" onClick={function () { goTab("shop"); }}
            sub={f.shopping.count ? (f.shopping.lastAddedBy ? "Last added by " + f.shopping.lastAddedBy : null) : "Nothing on the list."}
            meta={f.shopping.count ? f.shopping.count + " item" + (f.shopping.count === 1 ? "" : "s") : null} />
          {f.mealsPlanned !== null && (
            <Item showEmojis={se} icon="🍽️" title="Meals this week" onClick={function () { goTab("meals"); }}
              sub={f.mealsPlanned ? null : "No dinners planned yet."}
              meta={f.mealsPlanned + " of 7"} />
          )}
        </Pillar>

        {/* Anchor */}
        <Pillar id="anchor" label="Anchor" icon={PILLARS[2].icon} open={openId === "anchor"} onToggle={function () { toggle("anchor"); }} summary="Vault, Safe Harbor, Horizon">
          <Item showEmojis={se} icon="🔒" iconKind="lock" title="Vault" sub="Records, reminders, and household details" onClick={onVault} />
          <Item showEmojis={se} icon="⚓" title="Safe Harbor" onClick={function () { openVault("safeharbor"); }}
            sub={a.safeHarborPct === null ? "Not set up yet. A calm plan takes a few minutes." : null}
            meta={a.safeHarborPct === null ? null : a.safeHarborPct + "% ready"} />
          <Item showEmojis={se} icon="🌄" title={a.horizon ? a.horizon.name : "Horizon"} onClick={function () { goTab("horizon"); }}
            sub={a.horizon ? (a.horizon.kind === "trip" ? "Trip" : "Celebration") : "Nothing on the horizon yet."}
            meta={a.horizon ? daysLabel(a.horizon.days) : null} />
        </Pillar>

        {/* Ripples */}
        <Pillar id="ripples" label="Ripples" icon={PILLARS[3].icon} open={openId === "ripples"} onToggle={function () { toggle("ripples"); }} summary="Quotes, traditions, and memories">
          <Item showEmojis={se} icon="💬" testId="kid-quote" onClick={function () { openVault("ripples"); }}
            title={r.quote ? r.quote.text : "Kid quotes"}
            sub={r.quote ? (r.quote.who || null) : "No kid quotes yet. The funny ones are worth keeping."} dot={r.unreadDriftwood} />
          <Item showEmojis={se} icon={(r.tradition && r.tradition.emoji) || "🕯️"} onClick={function () { openVault("ripples"); }}
            title={r.tradition ? r.tradition.title : "Traditions"}
            sub={r.tradition ? null : "No traditions saved yet."}
            meta={r.tradition ? daysLabel(r.tradition.days) : null} />
        </Pillar>

        {/* Sunset — after 5 PM local, at the bottom just above the Exhale quick-add */}
        {(m.showSunset || anchored) && (
          <div data-testid="sunset-card" data-anchored={anchored ? "true" : undefined} style={{ background: gradient.sunset.css, borderRadius: radius.lg, boxShadow: shadow.raised, padding: "20px 18px", color: IVORY, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={Object.assign({ flex: "1 1 180px" }, wrapText)}>
              <div style={{ fontFamily: font.heading, fontSize: 22, fontWeight: 700 }}>Sunset</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>{anchored ? "Today is anchored. Tap to see tonight's reflection." : "Close the day gently."}</div>
            </div>
            <button type="button" data-testid="sunset-card-button" aria-label={anchored ? "Anchored. Open tonight's reflection" : undefined} onClick={function () { try { window.dispatchEvent(new CustomEvent("af-open-sunset")); } catch { /* no window */ } }}
              style={{ background: IVORY, color: "#26263F", border: "none", borderRadius: 999, padding: "10px 22px", fontFamily: font.body, fontWeight: 700, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>{anchored && <AnchoredCheck color="#26263F" />}{anchored ? "Anchored" : "Begin"}</button>
          </div>
        )}

        {/* Exhale quick-add → Exhaled bucket */}
        <form onSubmit={addExhale} style={{ display: "flex", gap: 8, background: tone.sage.tint, borderRadius: radius.lg, boxShadow: shadow.card, padding: 8 }}>
          <input value={draft} onChange={function (e) { setDraft(e.target.value); }} aria-label="Exhale a thought"
            placeholder={justAdded ? "Exhaled. Let it go." : "Exhale a thought…"}
            style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontFamily: font.body, fontSize: 16, color: NAVY, padding: "8px 10px", outline: "none" }} />
          <button type="submit" disabled={!draft.trim()}
            style={{ flexShrink: 0, background: draft.trim() ? NAVY : "rgba(27,43,68,0.25)", color: IVORY, border: "none", borderRadius: radius.sm, padding: "0 16px", fontFamily: font.body, fontWeight: 700, fontSize: 14, cursor: draft.trim() ? "pointer" : "default" }}>Exhale</button>
        </form>
      </div>
    </div>
  );
}
