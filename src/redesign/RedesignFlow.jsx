// src/redesign/RedesignFlow.jsx — the new Flow screen (af_redesign only).
// A 4-per-row tab grid of the Flow sections that are turned on; the selected
// tab shows one summary card built from that section's real data, with an
// "Open full view" link to its existing screen. Read-only, except in-store
// mode, which checks items off through the same path as the Shopping tab
// (onToggleShoppingItem from HomeFlow).
import { useState, useEffect } from "react";
import { color, gradient, radius, shadow, font, workDayTag, shouldShowEmoji } from "../design/tokens.js";
import { useTidePoolBalances } from "../tidepool/useTidePool.js";
import { TIDEPOOL_V2 } from "../tidepool/ledger.js";
import { isPersonMinor } from "../compass/compassEngine";
import { readBuckets } from "./exhaleModel.js";
import { calendarWeek, exhaleCounts, shoppingByAisle, mealsStrip, wavesToday, tidePoolKids, lessonsToday, visibleFlowTabs } from "./flowData.js";

var NAVY = color.anchorNavy;
var MUTED = "#5B6472";
var IVORY = gradient.sunset.text;

function rd(key, fb) { try { var v = JSON.parse(localStorage.getItem("af_" + key) || "null"); return v === null ? fb : v; } catch { return fb; } }
function goTab(tab) { try { window.dispatchEvent(new CustomEvent("af-set-tab", { detail: tab })); } catch { /* no window */ } }
var wrap = { minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" };

function Empty(props) {
  return <div style={{ fontFamily: font.heading, fontStyle: "italic", fontSize: 16, color: MUTED, lineHeight: 1.45 }}>{props.children}</div>;
}
function Row(props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: props.first ? "none" : "1px solid rgba(27,43,68,0.07)" }}>
      <span style={Object.assign({ flex: 1, fontSize: font.checklistItem.size, color: NAVY }, wrap)}>{props.label}</span>
      {props.value != null && <span style={{ fontSize: 13, color: MUTED, flexShrink: 0, whiteSpace: "nowrap" }}>{props.value}</span>}
    </div>
  );
}

export function WorkTag(props) {
  return (
    <span title={props.title} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 22, height: 18, padding: "0 4px", boxSizing: "border-box", background: workDayTag.background, border: "1px solid " + workDayTag.border, borderRadius: workDayTag.radius, color: workDayTag.text, fontSize: workDayTag.fontSize, fontWeight: 700, letterSpacing: "0.02em" }}>{props.initials}</span>
  );
}

export default function RedesignFlow(props) {
  var tabs = visibleFlowTabs(props.enabled);
  var [sel, setSel] = useState(tabs.length ? tabs[0].id : null);
  var [buckets, setBuckets] = useState(readBuckets);
  var [waves, setWaves] = useState(function () { return rd("exhale_waves", {}); });
  var [inStore, setInStore] = useState(false);
  var ledger = useTidePoolBalances(TIDEPOOL_V2 && props.tidePoolOn !== false ? props.householdId : null);

  useEffect(function () {
    function refresh() { setBuckets(readBuckets()); setWaves(rd("exhale_waves", {})); }
    window.addEventListener("af-data-changed", refresh);
    window.addEventListener("storage", refresh);
    return function () { window.removeEventListener("af-data-changed", refresh); window.removeEventListener("storage", refresh); };
  }, []);

  if (sel && !tabs.some(function (t) { return t.id === sel; })) sel = tabs.length ? tabs[0].id : null;
  var current = tabs.filter(function (t) { return t.id === sel; })[0] || null;
  var se = props.showEmojis === true;
  var now = props.now ? props.now() : new Date();

  function body() {
    if (!current) return <Empty>Every Flow section is turned off. Turn them on in Settings.</Empty>;
    if (current.id === "exhale") {
      var counts = exhaleCounts(buckets, props.myPersonId);
      var total = counts.reduce(function (s, c) { return s + c.open; }, 0);
      return (
        <div>
          {counts.map(function (c, i) { return <Row key={c.index} first={i === 0} label={c.name} value={c.open ? c.open + " open" : "clear"} />; })}
          {!total && <div style={{ marginTop: 8 }}><Empty>Nothing on your mind right now. Lovely.</Empty></div>}
        </div>
      );
    }
    if (current.id === "shopping") {
      var sh = shoppingByAisle(props.shoppingItems, props.shopCategories);
      if (!sh.total) return <Empty>The list is empty. Nothing to pick up.</Empty>;
      if (inStore) {
        return (
          <div data-testid="in-store">
            {sh.aisles.map(function (a) {
              return (
                <div key={a.name} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, fontWeight: 700, margin: "4px 0 6px" }}>{a.name}</div>
                  {a.items.map(function (it) {
                    return (
                      <button key={it.id} type="button" onClick={function () { if (props.onToggleShoppingItem) props.onToggleShoppingItem(it.id, !!it.done); }}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box", minHeight: 48, background: "#FFFFFF", border: "none", borderRadius: radius.sm, boxShadow: shadow.card, padding: "10px 14px", marginBottom: 6, textAlign: "left", cursor: "pointer", fontFamily: font.body, fontSize: 16, color: NAVY }}>
                        <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid " + NAVY, flexShrink: 0 }} />
                        <span style={wrap}>{it.text}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            <button type="button" onClick={function () { setInStore(false); }} style={{ background: "transparent", border: "1px solid " + NAVY, color: NAVY, borderRadius: 999, padding: "8px 16px", fontFamily: font.body, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Done shopping</button>
          </div>
        );
      }
      return (
        <div>
          {sh.aisles.map(function (a, i) { return <Row key={a.name} first={i === 0} label={a.name} value={a.items.length + " left"} />; })}
          <button type="button" onClick={function () { setInStore(true); }} style={{ marginTop: 10, background: NAVY, color: IVORY, border: "none", borderRadius: 999, padding: "9px 18px", fontFamily: font.body, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>In-store mode</button>
        </div>
      );
    }
    if (current.id === "meals") {
      var strip = mealsStrip(props.meals, now);
      var planned = strip.filter(function (d) { return !d.empty; }).length;
      return (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
            {strip.map(function (d) {
              return (
                <div key={d.day} title={d.dinner || "Nothing planned"} data-empty={d.empty ? "true" : "false"}
                  style={{ minWidth: 0, borderRadius: 10, border: d.empty ? "1.5px dashed rgba(27,43,68,0.28)" : "1.5px solid " + (d.isToday ? color.gold : "transparent"), background: d.empty ? "transparent" : "#FFFFFF", padding: "6px 3px", textAlign: "center", boxShadow: d.empty ? "none" : shadow.card }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: d.isToday ? NAVY : MUTED }}>{d.short}</div>
                  <div style={{ fontSize: 10.5, color: NAVY, marginTop: 3, lineHeight: 1.25, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" }}>{d.empty ? "" : d.dinner}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 10 }}>{planned ? planned + " of 7 dinners planned" : "No dinners planned yet this week."}</div>
        </div>
      );
    }
    if (current.id === "calendar") {
      var wk = calendarWeek(props.calEvents, props.workSchedules, props.people, now, isPersonMinor);
      var any = wk.some(function (d) { return d.events.length || d.work.length; });
      return (
        <div>
          {wk.map(function (d, i) {
            return (
              <div key={d.iso} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid rgba(27,43,68,0.07)" }}>
                <div style={{ width: 38, flexShrink: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: d.isToday ? NAVY : MUTED, textTransform: "uppercase" }}>{d.label}</div>
                  <div style={{ fontFamily: font.heading, fontSize: 18, fontWeight: 700, color: NAVY, lineHeight: 1 }}>{d.dayNum}</div>
                </div>
                <div style={Object.assign({ flex: 1, display: "flex", flexDirection: "column", gap: 4 }, wrap)}>
                  {(d.work.length > 0 || d.dots.length > 0) && (
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
                      {d.dots.map(function (c) { return <span key={c} data-testid="person-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />; })}
                      {d.work.map(function (w) { return <WorkTag key={w.personId} initials={w.initials} title={w.onCall ? "On call" : "Working"} />; })}
                    </div>
                  )}
                  {d.events.slice(0, 3).map(function (e, j) {
                    return <div key={(e.id || j) + d.iso} style={{ fontSize: font.checklistItem.size, color: NAVY }}>{(e.time ? e.time + " · " : "") + (e.title || "Event")}</div>;
                  })}
                  {d.events.length > 3 && <div style={{ fontSize: 12, color: MUTED }}>{"+" + (d.events.length - 3) + " more"}</div>}
                  {!d.events.length && !d.work.length && <div style={{ fontSize: 12.5, color: "rgba(91,100,114,0.7)" }}>Open</div>}
                </div>
              </div>
            );
          })}
          {!any && <div style={{ marginTop: 6 }}><Empty>A wide-open week.</Empty></div>}
        </div>
      );
    }
    if (current.id === "waves") {
      var ws = wavesToday(waves, now);
      if (!ws.length) return <Empty>No routines for today. Set some up in Waves.</Empty>;
      return <div>{ws.map(function (w, i) { return <Row key={w.id || i} first={i === 0} label={w.name} value={w.total ? w.done + " of " + w.total : null} />; })}</div>;
    }
    if (current.id === "tidepool") {
      var kids = tidePoolKids(props.people, props.coveData, TIDEPOOL_V2 ? ledger : null, isPersonMinor);
      if (!kids.length) return <Empty>No kids in Tide Pool yet.</Empty>;
      return <div>{kids.map(function (k, i) { return <Row key={k.id} first={i === 0} label={k.name} value={k.shells + " shell" + (k.shells === 1 ? "" : "s")} />; })}</div>;
    }
    if (current.id === "lighthouse") {
      var ls = lessonsToday(props.people, props.schoolData, now);
      if (!ls.length) return <Empty>No lessons planned for today.</Empty>;
      return (
        <div>
          {ls.map(function (l, i) {
            return <Row key={l.id} first={i === 0} label={(l.child ? l.child + " — " : "") + l.subject + (l.lesson ? ": " + l.lesson : "")} value={l.done ? "done" : null} />;
          })}
        </div>
      );
    }
    return null;
  }

  return (
    <div data-testid="redesign-flow" style={{ background: color.flowBackground, margin: "-1.1rem -0.9rem -0.5rem", padding: "16px 16px calc(28px + env(safe-area-inset-bottom, 0px))", minHeight: "100dvh", boxSizing: "border-box", fontFamily: font.body, color: NAVY, overflowX: "hidden" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={function () { goTab("anchor"); }} aria-label="Back to Home"
            style={{ background: "#FFFFFF", border: "none", borderRadius: 999, boxShadow: shadow.card, padding: "7px 14px 7px 12px", fontFamily: font.body, fontSize: 13, fontWeight: 600, color: NAVY, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderLeft: "2px solid " + NAVY, borderBottom: "2px solid " + NAVY, transform: "rotate(45deg)", display: "inline-block" }} />Home
          </button>
          <h1 style={{ margin: 0, fontFamily: font.heading, fontSize: 28, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden="true" style={{ fontSize: 22 }}>🌊</span>Flow
          </h1>
        </div>

        {tabs.length > 0 && (
          <div role="tablist" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            {tabs.map(function (t) {
              var on = t.id === sel;
              return (
                <button key={t.id} type="button" role="tab" aria-selected={on} data-testid={"flowtab-" + t.id}
                  onClick={function () { setSel(t.id); setInStore(false); }}
                  style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, minHeight: 58, padding: "8px 4px", borderRadius: radius.sm, border: on ? "none" : "1px solid rgba(27,43,68,0.08)", background: on ? NAVY : "#FFFFFF", color: on ? IVORY : NAVY, boxShadow: on ? shadow.raised : shadow.card, cursor: "pointer", fontFamily: font.body }}>
                  {shouldShowEmoji("item", se) && <span aria-hidden="true" style={{ fontSize: 17 }}>{t.icon}</span>}
                  <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, textAlign: "center", overflowWrap: "anywhere" }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <section data-testid="flow-summary" style={{ background: color.surface, borderRadius: radius.lg, boxShadow: shadow.card, padding: "16px 18px" }}>
          {current && (
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontFamily: font.heading, fontSize: 22, fontWeight: 700 }}>{current.label}</h2>
              <button type="button" onClick={function () { goTab(current.tab); }} style={{ background: "none", border: "none", padding: 0, color: gradient.ripples.from, fontFamily: font.body, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Open full view</button>
            </div>
          )}
          {body()}
        </section>
      </div>
    </div>
  );
}
