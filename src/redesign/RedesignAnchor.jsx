// src/redesign/RedesignAnchor.jsx — the new Anchor screen (af_redesign only).
// Rendered by FlowWrapper in place of the AnchorVault dashboard ("home"
// section) when REDESIGN is on. Navy page, a 3-per-row tab grid of the Anchor
// sections that are turned on, and one summary card for the selected tab
// built from real data, with "Open full view" to that section's existing
// screen. Read-only: it writes nothing.
//
// Data: every key here is owned by AnchorVault / HomeFlow tabs, so it is read
// from localStorage and re-read on af-data-changed / storage /
// af-anchor-hidden-changed.
import { useState, useEffect } from "react";
import { color, gradient, radius, font, shouldShowEmoji } from "../design/tokens.js";
import { isPersonMinor } from "../compass/compassEngine";
import { visibleAnchorTabs, vaultSections, sensitiveRecords, safeHarborModel, todayZone, nextMaintenance, peopleCards, coveSummary, horizonEvents } from "./anchorData.js";
import { daysLabel } from "./homeData.js";

var NAVY = color.anchorNavy;
var IVORY = gradient.sunset.text;
var SOFT = "rgba(242,234,216,0.68)";
var LINE = "rgba(242,234,216,0.12)";
var PANEL = "rgba(242,234,216,0.06)";
var GOLD = color.gold;
var wrap = { minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" };

function rd(key, fb) { try { var v = JSON.parse(localStorage.getItem("af_" + key) || "null"); return v === null ? fb : v; } catch { return fb; } }
function readAnchorStores() {
  return {
    anchorHidden: rd("anchor_hidden", {}),
    showEmojis: rd("showEmojis", false),
    inventory: rd("inventory", {}), vaultSystems: rd("vaultSystems", []), ownedProducts: rd("ownedProducts", []),
    houseFile: rd("houseFile", []), health: rd("health", {}), career: rd("career", {}), subs: rd("subs", []),
    celebrations: rd("celebrations", []), birthdays: rd("birthdays", []), pets: rd("pets", []), trips: rd("trips", []),
    travelProfile: rd("travel_profile", {}), people: rd("people", []),
    safeHarbor: rd("safe_harbor", null), homeCleaning: rd("home_cleaning", null),
    coveNotes: rd("cove_notes_v1", []), coveLists: rd("cove_lists_v1", []), coveItems: rd("cove_items_v1", {}),
  };
}

function Empty(props) {
  return <div style={{ fontFamily: font.heading, fontStyle: "italic", fontSize: 16, color: SOFT, lineHeight: 1.45 }}>{props.children}</div>;
}
function Label(props) {
  return <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: SOFT, fontWeight: 700, margin: props.first ? "0 0 6px" : "16px 0 6px" }}>{props.children}</div>;
}
function Row(props) {
  var inner = (
    <>
      {props.icon && <span aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }}>{props.icon}</span>}
      <span style={Object.assign({ flex: 1, display: "flex", flexDirection: "column", gap: 2 }, wrap)}>
        <span style={{ fontSize: font.checklistItem.size, color: IVORY, lineHeight: 1.35 }}>{props.label}</span>
        {props.sub && <span style={{ fontSize: 12, color: SOFT, lineHeight: 1.4 }}>{props.sub}</span>}
      </span>
      {props.value != null && <span style={{ fontSize: 13, color: SOFT, flexShrink: 0, whiteSpace: "nowrap" }}>{props.value}</span>}
    </>
  );
  var style = { display: "flex", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box", padding: "9px 0", borderTop: props.first ? "none" : "1px solid " + LINE, background: "none", borderLeft: "none", borderRight: "none", borderBottom: "none", textAlign: "left", fontFamily: font.body, color: IVORY };
  if (props.onClick) return <button type="button" data-testid={props.testId} onClick={props.onClick} style={Object.assign(style, { cursor: "pointer" })}>{inner}</button>;
  return <div data-testid={props.testId} style={style}>{inner}</div>;
}
function Bar(props) {
  return (
    <div role="progressbar" aria-valuenow={props.pct} aria-valuemin={0} aria-valuemax={100} aria-label={props.label}
      style={{ height: 6, borderRadius: 999, background: LINE, overflow: "hidden" }}>
      <div style={{ width: Math.max(0, Math.min(100, props.pct)) + "%", height: "100%", background: GOLD, borderRadius: 999 }} />
    </div>
  );
}
function Check(props) {
  return (
    <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box", border: "2px solid " + (props.on ? GOLD : "rgba(242,234,216,0.35)"), background: props.on ? GOLD : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {props.on && <span style={{ width: 4, height: 8, borderRight: "2px solid " + NAVY, borderBottom: "2px solid " + NAVY, transform: "rotate(45deg)", marginTop: -2 }} />}
    </span>
  );
}
function Gear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke={IVORY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

// props: sections, featureFlags, onBack, onSettings, onOpenTab(tabId, label),
//        onOpenVault(section), onOpenVaultDashboard, now (tests)
export default function RedesignAnchor(props) {
  var [s, setS] = useState(readAnchorStores);
  var [revealed, setRevealed] = useState({});
  var tabs = visibleAnchorTabs({ sections: props.sections, featureFlags: props.featureFlags, anchorHidden: s.anchorHidden });
  var [sel, setSel] = useState(tabs.length ? tabs[0].id : null);

  useEffect(function () {
    function refresh() { setS(readAnchorStores()); }
    window.addEventListener("af-data-changed", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("af-anchor-hidden-changed", refresh);
    return function () {
      window.removeEventListener("af-data-changed", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("af-anchor-hidden-changed", refresh);
    };
  }, []);

  if (sel && !tabs.some(function (t) { return t.id === sel; })) sel = tabs.length ? tabs[0].id : null;
  var current = tabs.filter(function (t) { return t.id === sel; })[0] || null;
  var se = s.showEmojis === true;
  var now = props.now ? props.now() : new Date();
  function icon(e) { return shouldShowEmoji("item", se) ? e : null; }
  var LOCK = shouldShowEmoji("lock", se) ? "🔒" : null; // always shown

  function openFull() {
    if (!current) return;
    if (current.id === "vault") { if (props.onOpenVaultDashboard) props.onOpenVaultDashboard(); return; }
    if (current.id === "safeharbor") { if (props.onOpenVault) props.onOpenVault("safeharbor"); return; }
    if (props.onOpenTab) props.onOpenTab(current.id, current.label);
  }

  function body() {
    if (!current) return <Empty>Every Anchor section is turned off. Turn them on in Settings.</Empty>;

    if (current.id === "vault") {
      var secs = vaultSections(s, s.anchorHidden, props.featureFlags);
      var sens = sensitiveRecords(s.travelProfile, s.health, s.people, s.anchorHidden, props.featureFlags);
      return (
        <div>
          {secs.map(function (v, i) {
            return <Row key={v.id} first={i === 0} testId={"vault-" + v.id} icon={icon(v.icon)} label={v.label}
              value={v.count ? v.count + " record" + (v.count === 1 ? "" : "s") : "empty"}
              onClick={function () { if (props.onOpenVault) props.onOpenVault(v.id); }} />;
          })}
          {sens.length > 0 && <Label>Sensitive</Label>}
          {sens.map(function (r, i) {
            var shown = !r.pin && revealed[r.id] === true;
            return (
              <Row key={r.id} first={i === 0} testId={"sensitive-" + r.id} icon={LOCK} label={r.hint}
                sub={r.pin ? "PIN protected. Tap to open Health." : (shown ? r.value : "•••••••• · tap to show")}
                onClick={function () {
                  if (r.pin) { if (props.onOpenVault) props.onOpenVault(r.section); return; }
                  setRevealed(function (p) { var n = Object.assign({}, p); n[r.id] = !p[r.id]; return n; });
                }} />
            );
          })}
        </div>
      );
    }

    if (current.id === "safeharbor") {
      var sh = safeHarborModel(s.safeHarbor);
      if (!sh) return <Empty>Not set up yet. A calm plan takes a few minutes.</Empty>;
      var planSet = sh.plan.filter(function (p) { return p.value; });
      return (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span data-testid="sh-readiness" style={{ fontFamily: font.heading, fontSize: 40, fontWeight: 700, color: IVORY, lineHeight: 1 }}>{(sh.readiness || 0) + "%"}</span>
            <span style={{ fontSize: 13, color: SOFT }}>ready to leave in 10 minutes</span>
          </div>

          <Label>Grab and go</Label>
          {sh.tiers.map(function (t) {
            return (
              <div key={t.minutes} data-testid={"sh-tier-" + t.minutes} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, marginBottom: 5 }}>
                  <span style={wrap}>{t.minutes + " min · " + t.label}</span>
                  <span style={{ color: SOFT, whiteSpace: "nowrap" }}>{t.done + " of " + t.total}</span>
                </div>
                <Bar pct={t.pct} label={t.minutes + " minute grab-and-go"} />
              </div>
            );
          })}

          <Label>The Six P's</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px 12px" }}>
            {sh.sixPs.map(function (p) {
              return (
                <div key={p.id} data-testid={"sixp-" + p.id} data-complete={p.complete ? "true" : "false"} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Check on={p.complete} />
                  <span style={Object.assign({ fontSize: 13, color: IVORY, lineHeight: 1.3 }, wrap)}>{p.label}</span>
                </div>
              );
            })}
          </div>

          <Label>Family plan</Label>
          {planSet.length === 0 && sh.members.length === 0
            ? <Empty>No meeting places or contacts yet.</Empty>
            : (
              <div>
                {sh.plan.map(function (p, i) { return <Row key={p.key} first={i === 0} label={p.label} sub={p.value || "Not set"} />; })}
                {sh.members.length > 0 && <Row label="In the plan" sub={sh.members.map(function (m) { return m.name; }).join(", ")} />}
              </div>
            )}
        </div>
      );
    }

    if (current.id === "home") {
      var z = todayZone(s.homeCleaning, now);
      var m = nextMaintenance(s.vaultSystems, now);
      return (
        <div>
          <Label first>Today's cleaning focus</Label>
          {z ? <Row first testId="home-zone" icon={icon("🧹")} label={z.name} sub={z.rooms || null} value={z.total ? z.done + " of " + z.total : null} />
            : <Empty>No cleaning zones set up yet.</Empty>}
          <Label>Next maintenance</Label>
          {m ? <Row first testId="home-maint" icon={icon("🔧")} label={m.name} value={m.days < 0 ? Math.abs(m.days) + "d overdue" : daysLabel(m.days)} />
            : <Empty>Nothing scheduled. All clear.</Empty>}
        </div>
      );
    }

    if (current.id === "people") {
      var cards = peopleCards(s.people, s.pets, s.health, now, isPersonMinor);
      if (!cards.length) return <Empty>No one added yet. Add your household in Settings.</Empty>;
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
          {cards.map(function (c) {
            return (
              <div key={c.id} data-testid={"person-" + c.id} style={{ minWidth: 0, background: PANEL, border: "1px solid " + LINE, borderRadius: radius.sm, padding: "12px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {c.kind === "pet"
                    ? (icon("🐾") ? <span aria-hidden="true" style={{ fontSize: 14 }}>🐾</span> : <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: GOLD, flexShrink: 0 }} />)
                    : <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: c.color || GOLD, flexShrink: 0 }} />}
                  <span style={Object.assign({ fontFamily: font.heading, fontSize: 18, fontWeight: 700, color: IVORY, lineHeight: 1.15 }, wrap)}>{c.name}</span>
                </div>
                <div style={{ fontSize: 12, color: SOFT, marginTop: 4 }}>{c.role}</div>
                <div style={Object.assign({ fontSize: 12.5, color: IVORY, marginTop: 6, lineHeight: 1.35 }, wrap)}>{c.status}</div>
              </div>
            );
          })}
        </div>
      );
    }

    if (current.id === "cove") {
      var cv = coveSummary(s.coveNotes, s.coveLists, s.coveItems);
      if (!cv.notes.length && !cv.lists.length) return <Empty>Cove is empty. Notes and lists will show up here.</Empty>;
      return (
        <div>
          {cv.notes.length > 0 && <Label first>Recent notes</Label>}
          {cv.notes.map(function (n, i) { return <Row key={n.id} first={i === 0} testId={"cove-note-" + n.id} label={n.title} sub={n.preview || null} />; })}
          {cv.lists.length > 0 && <Label first={!cv.notes.length}>Lists</Label>}
          {cv.lists.map(function (l) {
            return (
              <div key={l.id} data-testid={"cove-list-" + l.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: font.checklistItem.size, marginBottom: 5 }}>
                  <span style={wrap}>{l.title}</span>
                  <span style={{ color: SOFT, fontSize: 13, whiteSpace: "nowrap" }}>{l.total ? l.done + " of " + l.total : "empty"}</span>
                </div>
                <Bar pct={l.pct} label={l.title + " progress"} />
              </div>
            );
          })}
        </div>
      );
    }

    if (current.id === "horizon") {
      var ev = horizonEvents(s.trips, s.celebrations, now);
      if (!ev.length) return <Empty>Nothing on the horizon yet.</Empty>;
      return (
        <div>
          {ev.map(function (e, i) {
            return <Row key={e.id} first={i === 0} testId={"horizon-" + e.id} icon={icon(e.kind === "trip" ? "🧳" : "🎉")} label={e.name}
              sub={e.kind === "trip" ? "Trip" : "Celebration"} value={daysLabel(e.days)} />;
          })}
        </div>
      );
    }
    return null;
  }

  var pillBtn = { background: "transparent", border: "1px solid rgba(242,234,216,0.3)", borderRadius: 999, color: IVORY, fontFamily: font.body, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

  return (
    <div data-testid="redesign-anchor"
      style={{ position: "fixed", top: 0, left: 68, right: 0, bottom: 0, zIndex: 150, overflowY: "auto", overflowX: "hidden", background: NAVY, color: IVORY, fontFamily: font.body }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "calc(16px + env(safe-area-inset-top, 0px)) 16px calc(28px + env(safe-area-inset-bottom, 0px))", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={props.onBack} aria-label="Back to Home" style={Object.assign({}, pillBtn, { padding: "7px 14px 7px 12px", fontSize: 13, fontWeight: 600, gap: 6 })}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderLeft: "2px solid " + IVORY, borderBottom: "2px solid " + IVORY, transform: "rotate(45deg)", display: "inline-block" }} />Home
          </button>
          <h1 style={{ margin: 0, flex: 1, minWidth: 0, fontFamily: font.heading, fontSize: 28, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden="true" style={{ fontSize: 22 }}>🏠</span>Anchor
          </h1>
          <button type="button" onClick={props.onSettings} aria-label="Settings" data-testid="anchor-settings" style={Object.assign({}, pillBtn, { width: 38, height: 38, padding: 0 })}><Gear /></button>
        </div>

        {tabs.length > 0 && (
          <div role="tablist" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {tabs.map(function (t) {
              var on = t.id === sel;
              return (
                <button key={t.id} type="button" role="tab" aria-selected={on} data-testid={"anchortab-" + t.id}
                  onClick={function () { setSel(t.id); }}
                  style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, minHeight: 58, padding: "8px 4px", borderRadius: radius.sm, border: "1px solid " + (on ? IVORY : LINE), background: on ? IVORY : PANEL, color: on ? NAVY : IVORY, cursor: "pointer", fontFamily: font.body }}>
                  {icon(t.icon) && <span aria-hidden="true" style={{ fontSize: 17 }}>{t.icon}</span>}
                  <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2, textAlign: "center", overflowWrap: "anywhere" }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <section data-testid="anchor-summary" style={{ background: PANEL, border: "1px solid " + LINE, borderRadius: radius.lg, padding: "16px 18px" }}>
          {current && (
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontFamily: font.heading, fontSize: 22, fontWeight: 700 }}>{current.label}</h2>
              <button type="button" data-testid="open-full" onClick={openFull} style={{ background: "none", border: "none", padding: 0, color: GOLD, fontFamily: font.body, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Open full view</button>
            </div>
          )}
          {body()}
        </section>
      </div>
    </div>
  );
}
