// src/redesign/FullView.jsx — shared pieces for the redesigned Flow full-view
// screens (Shopping, Meals, Calendar, Waves, Tide Pool, Lighthouse), used only
// when af_redesign is on. Each screen's HomeFlow closure keeps its own state
// and handlers and returns these instead of its legacy markup.
//
//   FullViewPage    very light FAF8F3 page, phone-safe (no sideways scroll)
//   FullViewHeader  "← Flow" back button, Cormorant Garamond title, one-line subtitle
//   PillTabs        a screen's sub-sections as rounded pill tabs (wrap, never scroll)
//   Card            white rounded card
//   CheckRow        14px DM Sans row with the 22px sage circle check
//                   (done = filled, text crossed out at 45% opacity)
//   rdLegacyKit     T/card/btnP/btnS/inp/lbl in the new look, for the few
//                   legacy sub-section bodies that are reused as-is inside
//                   the new screens
import { useRef, useLayoutEffect } from "react";
import { color, radius, shadow, font, check } from "../design/tokens.js";
import { NAVY, MUTED, SAGE, IVORY, HAIRLINE, wrapText, goTab, emo, stripDecorativeEmoji } from "./fullViewKit.js";

export function FullViewPage(props) {
  return (
    <div data-testid={props.testId} data-redesign="full-view"
      style={{ background: color.flowBackground, margin: "-1.1rem -0.9rem -0.5rem", padding: "16px 16px calc(32px + env(safe-area-inset-bottom, 0px))", minHeight: "100dvh", boxSizing: "border-box", fontFamily: font.body, fontSize: font.checklistItem.size, color: NAVY, overflowX: "hidden" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
        {props.children}
      </div>
    </div>
  );
}

export function BackToFlow(props) {
  return (
    <button type="button" data-testid="fullview-back" onClick={props.onClick || function () { goTab("flowhome"); }} aria-label="Back to Flow"
      style={{ alignSelf: "flex-start", background: "#FFFFFF", border: "none", borderRadius: 999, boxShadow: shadow.card, padding: "7px 14px 7px 12px", fontFamily: font.body, fontSize: 13, fontWeight: 600, color: NAVY, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span aria-hidden="true">←</span>Flow
    </button>
  );
}

export function FullViewHeader(props) {
  var glyph = props.emoji ? emo(props.showEmojis, props.emoji) : null;
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <BackToFlow onClick={props.onBack} />
        {props.action || null}
      </div>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontFamily: font.heading, fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: NAVY, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {glyph && <span aria-hidden="true" style={{ fontSize: 24 }}>{glyph}</span>}
          <span style={wrapText}>{props.title}</span>
        </h1>
        {props.subtitle && (
          <div data-testid="fullview-subtitle" style={{ marginTop: 4, fontSize: 13.5, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{props.subtitle}</div>
        )}
      </div>
    </header>
  );
}

// tabs: [{ id, label, emoji?, count? }]
export function PillTabs(props) {
  return (
    <div role="tablist" aria-label={props.label} style={{ display: "flex", flexWrap: "wrap", gap: 8, minWidth: 0 }}>
      {props.tabs.map(function (t) {
        var on = t.id === props.value;
        var glyph = t.emoji ? emo(props.showEmojis, t.emoji) : null;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} data-testid={(props.testIdPrefix || "pill-") + t.id}
            onClick={function () { props.onChange(t.id); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", padding: "8px 15px", borderRadius: 999, border: "1px solid " + (on ? NAVY : HAIRLINE), background: on ? NAVY : "#FFFFFF", color: on ? IVORY : NAVY, boxShadow: on ? "none" : shadow.card, fontFamily: font.body, fontSize: 13, fontWeight: on ? 700 : 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            {glyph && <span aria-hidden="true">{glyph}</span>}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
            {t.count != null && <span style={{ fontSize: 11.5, fontWeight: 700, opacity: on ? 0.85 : 0.6 }}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Card(props) {
  return (
    <section data-testid={props.testId} style={Object.assign({ background: "#FFFFFF", borderRadius: radius.lg, boxShadow: shadow.card, padding: "16px 18px", minWidth: 0, boxSizing: "border-box" }, props.style || {})}>
      {(props.title || props.right) && (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          {props.title && <h2 style={Object.assign({ margin: 0, fontFamily: font.heading, fontSize: 21, fontWeight: 700, color: NAVY }, wrapText)}>{props.title}</h2>}
          {props.right || null}
        </div>
      )}
      {props.children}
    </section>
  );
}

export function SectionLabel(props) {
  return <div style={Object.assign({ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, fontWeight: 700, margin: "10px 0 4px" }, props.style || {})}>{props.children}</div>;
}

export function Empty(props) {
  return <div style={{ fontFamily: font.heading, fontStyle: "italic", fontSize: 16, color: MUTED, lineHeight: 1.45 }}>{props.children}</div>;
}

// The 22px sage circle. A <button> so it is reachable by keyboard; with
// `decorative` it is a plain <span> (for use inside another button).
export function CheckCircle(props) {
  var done = !!props.done;
  var style = { width: check.size, height: check.size, minWidth: check.size, flexShrink: 0, boxSizing: "border-box", borderRadius: "50%", border: "2px solid " + SAGE, background: done ? SAGE : "transparent", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
  var tick = done ? <span aria-hidden="true" style={{ width: 5, height: 10, borderRight: "2px solid #FFFFFF", borderBottom: "2px solid #FFFFFF", transform: "rotate(45deg)", marginTop: -2 }} /> : null;
  if (props.decorative) return <span aria-hidden="true" data-testid={props.testId || "check"} data-done={done ? "true" : "false"} style={style}>{tick}</span>;
  return (
    <button type="button" data-testid={props.testId || "check"} aria-pressed={done} aria-label={props.label ? (done ? "Mark not done: " : "Mark done: ") + props.label : (done ? "Mark not done" : "Mark done")}
      onClick={function (e) { e.stopPropagation(); if (props.onToggle) props.onToggle(); }}
      style={style}>
      {tick}
    </button>
  );
}

// One 14px row. With onToggle it gets the sage check; done crosses the text
// out at 45% opacity. `meta` sits under the text; `right` at the end.
export function CheckRow(props) {
  var done = !!props.done;
  var checkable = typeof props.onToggle === "function";
  return (
    <div data-testid={props.testId} data-done={checkable ? (done ? "true" : "false") : undefined}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: props.first ? "none" : "1px solid " + HAIRLINE, minWidth: 0 }}>
      {checkable && <CheckCircle done={done} onToggle={props.onToggle} label={typeof props.text === "string" ? props.text : null} />}
      <div onClick={props.onTextClick || (checkable ? props.onToggle : undefined)} style={{ flex: 1, minWidth: 0, cursor: (props.onTextClick || checkable) ? "pointer" : "default" }}>
        <div data-testid="row-text" style={Object.assign({ fontFamily: font.checklistItem.family, fontSize: font.checklistItem.size, lineHeight: 1.4, color: NAVY, opacity: done ? check.doneTextOpacity : 1, textDecoration: done ? "line-through" : "none" }, wrapText)}>{props.text}</div>
        {props.meta && <div style={Object.assign({ fontSize: 12, color: MUTED, marginTop: 2 }, wrapText)}>{props.meta}</div>}
      </div>
      {props.right != null && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: MUTED, whiteSpace: "nowrap" }}>{props.right}</div>}
    </div>
  );
}

export function PillButton(props) {
  var v = props.variant || "primary";
  var base = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, padding: props.small ? "6px 12px" : "9px 18px", fontFamily: font.body, fontWeight: 700, fontSize: props.small ? 12.5 : 13, cursor: props.disabled ? "default" : "pointer", opacity: props.disabled ? 0.4 : 1, whiteSpace: "nowrap", maxWidth: "100%" };
  var look = v === "primary" ? { background: NAVY, color: IVORY, border: "none" }
    : v === "sage" ? { background: SAGE, color: "#FFFFFF", border: "none" }
    : v === "ghost" ? { background: "transparent", color: NAVY, border: "none", padding: props.small ? "6px 8px" : "9px 10px" }
    : { background: "#FFFFFF", color: NAVY, border: "1px solid " + HAIRLINE, boxShadow: shadow.card };
  return (
    <button type="button" data-testid={props.testId} aria-label={props.ariaLabel} disabled={props.disabled} onClick={props.onClick} style={Object.assign(base, look, props.style || {})}>{props.children}</button>
  );
}

export function ProgressBar(props) {
  var max = props.max > 0 ? props.max : 1;
  var pct = Math.max(0, Math.min(100, Math.round((props.value / max) * 100)));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(props.value, max)} aria-label={props.label}
      style={{ height: props.height || 10, borderRadius: 999, background: color.tint.sage, overflow: "hidden" }}>
      <div style={{ width: pct + "%", height: "100%", borderRadius: 999, background: props.color || SAGE, transition: "width .3s" }} />
    </div>
  );
}

// Wraps a reused legacy body. With showEmojis off, decorative emoji in its
// text are dropped (see stripDecorativeEmoji) and kept dropped as React
// re-renders it: only text values change, no nodes are added or removed.
// Changing the setting remounts the body (see the key below).
export function EmojiScope(props) {
  var ref = useRef(null);
  var on = props.showEmojis !== true;
  useLayoutEffect(function () {
    var root = ref.current;
    if (!on || !root || typeof document === "undefined") return undefined;
    function sweep() {
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var n;
      while ((n = w.nextNode())) {
        var next = stripDecorativeEmoji(n.nodeValue);
        if (next !== n.nodeValue) n.nodeValue = next;
      }
    }
    sweep();
    if (typeof MutationObserver === "undefined") return undefined;
    var mo = new MutationObserver(sweep);
    mo.observe(root, { subtree: true, childList: true, characterData: true });
    return function () { mo.disconnect(); };
  }, [on]);
  // Keyed on the setting: turning showEmojis back on remounts the subtree, so
  // text React never re-renders (unchanged props) gets its emoji back.
  return <div ref={ref} key={on ? "strip" : "keep"} data-emoji-scope={on ? "off" : "on"} style={{ minWidth: 0 }}>{props.children}</div>;
}
