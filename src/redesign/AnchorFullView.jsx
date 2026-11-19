// src/redesign/AnchorFullView.jsx — shared pieces for the redesigned Anchor
// full views (Vault, Safe Harbor, Home, People, Cove, Horizon, Settings),
// used only when af_redesign is on. Each screen keeps its own state and
// write paths; these are markup only.
//
//   AnchorPage     navy 1B2B44 page with ivory text, phone-safe (no sideways
//                  scroll). `overlay` makes it the fixed AnchorVault overlay.
//   AnchorHeader   "← Anchor" back button, Playfair Display title, Lato subtitle
//   AnchorPills    a screen's sub-sections as rounded pill tabs (wrap, never scroll)
//   AnchorCard     light rounded card on the navy
//   ARow           one 15px Lato row inside a card
//   LockRow        a sensitive record: lock + hint only, until tapped
//   AnchorScreen   page + header + pills + children, the usual composition
//
// Reused legacy bodies (vault sections, Safe Harbor tabs, Cove, Settings) sit
// inside [data-anchor-body]: their inline Cormorant / DM Sans text is set in
// Playfair Display / Lato by the scoped rules in ANCHOR_CSS, and they are
// wrapped in EmojiScope (FullView.jsx) so showEmojis is respected.
import { createContext, useContext } from "react";
import { radius, shadow, toneFor, fullBleed } from "../design/tokens.js";
import { IVORY, wrapText, isAlwaysShownGlyph, emo } from "./fullViewKit.js";
import { NAVY, CARD, INK, INK_SOFT, IVORY_SOFT, IVORY_LINE, CARD_LINE, HEAD, BODY, ROW, ANCHOR_CSS } from "./anchorKit.js";


// Decorative glyph next to a title: pillar and lock icons always show, the
// rest only with showEmojis on.
function glyphFor(showEmojis, g) {
  if (!g) return null;
  return isAlwaysShownGlyph(g) ? g : emo(showEmojis, g);
}

// The section's tone (tokens.sectionTone): AnchorCard reads it. The legacy
// bodies' own light cards pick it up through --anchor-tint (ANCHOR_CSS).
var ToneContext = createContext(toneFor("vault"));

// section: vault | safeharbor | home | people | cove | horizon | settings
export function AnchorPage(props) {
  var tn = toneFor(props.section);
  var inner = (
    <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      {props.children}
    </div>
  );
  var base = { background: NAVY, color: IVORY, fontFamily: BODY, fontSize: ROW, boxSizing: "border-box", overflowX: "hidden", "--anchor-tint": tn.tint };
  if (props.overlay) {
    return (
      <ToneContext.Provider value={tn}>
        <div className="af-vault" ref={props.scrollRef} data-testid={props.testId} data-redesign="full-view" data-anchor-room="true" data-section={props.section}
          style={Object.assign(base, { position: "fixed", top: 0, left: 68, right: 0, bottom: 0, zIndex: 150, overflowY: "auto" })}>
          <style>{ANCHOR_CSS}</style>
          <div style={{ padding: "calc(12px + env(safe-area-inset-top, 0px)) 14px calc(28px + env(safe-area-inset-bottom, 0px))", boxSizing: "border-box", minWidth: 0 }}>{inner}</div>
        </div>
      </ToneContext.Provider>
    );
  }
  // In HomeFlow's content column: navy edge to edge and all the way down on
  // wide screens (fullBleed), content centered at maxWidth 680.
  return (
    <ToneContext.Provider value={tn}>
      <div data-testid={props.testId} data-redesign="full-view" data-anchor-room="true" data-section={props.section}
        style={Object.assign(base, { margin: "-1.1rem -0.9rem -0.5rem", padding: "12px 14px calc(28px + env(safe-area-inset-bottom, 0px))", minHeight: "100dvh" }, fullBleed(NAVY))}>
        <style>{ANCHOR_CSS}</style>
        {inner}
      </div>
    </ToneContext.Provider>
  );
}

export function BackToAnchor(props) {
  return (
    <button type="button" data-testid="fullview-back" onClick={props.onClick} aria-label="Back to Anchor"
      style={{ alignSelf: "flex-start", background: "transparent", border: "1px solid " + IVORY_LINE, borderRadius: 999, padding: "7px 14px 7px 12px", fontFamily: BODY, fontSize: 14, fontWeight: 700, color: IVORY, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span aria-hidden="true">←</span>Anchor
    </button>
  );
}

export function AnchorHeader(props) {
  var glyph = glyphFor(props.showEmojis, props.emoji);
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <BackToAnchor onClick={props.onBack} />
        {props.action || null}
      </div>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 30, fontWeight: 700, lineHeight: 1.15, color: IVORY, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {glyph && <span aria-hidden="true" style={{ fontSize: 24 }}>{glyph}</span>}
          <span style={wrapText}>{props.title}</span>
        </h1>
        {props.subtitle && (
          <div data-testid="fullview-subtitle" style={Object.assign({ marginTop: 5, fontFamily: BODY, fontSize: 14, lineHeight: 1.45, color: IVORY_SOFT }, wrapText)}>{props.subtitle}</div>
        )}
      </div>
    </header>
  );
}

// tabs: [{ id, label, emoji?, count? }]
export function AnchorPills(props) {
  return (
    <div role="tablist" aria-label={props.label} style={{ display: "flex", flexWrap: "wrap", gap: 8, minWidth: 0 }}>
      {props.tabs.map(function (t) {
        var on = t.id === props.value;
        // Pill glyphs are decorative section icons (even when one happens to
        // be a pillar or lock glyph): shown only with showEmojis on.
        var glyph = t.emoji ? emo(props.showEmojis, t.emoji) : null;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} data-testid={(props.testIdPrefix || "pill-") + t.id}
            onClick={function () { props.onChange(t.id); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", minWidth: 0, padding: "8px 15px", borderRadius: 999, border: "1px solid " + (on ? IVORY : IVORY_LINE), background: on ? IVORY : "transparent", color: on ? NAVY : IVORY, fontFamily: BODY, fontSize: 14, fontWeight: on ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>
            {glyph && <span aria-hidden="true">{glyph}</span>}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
            {t.count != null && <span style={{ fontSize: 12, fontWeight: 700, opacity: on ? 0.75 : 0.65 }}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function AnchorCard(props) {
  var tn = useContext(ToneContext);
  return (
    <section data-testid={props.testId} data-anchor-card="true"
      style={Object.assign({ background: tn.tint, color: INK, borderRadius: radius.lg, boxShadow: shadow.raised, padding: "12px 14px", minWidth: 0, boxSizing: "border-box", fontFamily: BODY, fontSize: ROW }, props.style || {})}>
      {(props.title || props.right) && (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: props.title ? "space-between" : "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          {props.title && <h2 style={Object.assign({ margin: 0, fontFamily: HEAD, fontSize: 20, fontWeight: 700, color: INK }, wrapText)}>{props.title}</h2>}
          {props.right || null}
        </div>
      )}
      {props.children}
    </section>
  );
}

export function ALabel(props) {
  return <div style={Object.assign({ fontFamily: BODY, fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: INK_SOFT, fontWeight: 700, margin: props.first ? "0 0 4px" : "14px 0 4px" }, props.style || {})}>{props.children}</div>;
}

export function AEmpty(props) {
  return <div data-testid={props.testId} style={{ fontFamily: BODY, fontStyle: "italic", fontSize: ROW, color: INK_SOFT, lineHeight: 1.5 }}>{props.children}</div>;
}

// One 15px Lato row on a light card. icon (already emoji-gated by the caller),
// label, optional sub line, optional value at the end. onClick makes it a button.
export function ARow(props) {
  var inner = (
    <>
      {props.icon && <span aria-hidden="true" style={{ fontSize: 16, flexShrink: 0, width: 20, textAlign: "center" }}>{props.icon}</span>}
      {props.dot && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: props.dot, flexShrink: 0 }} />}
      <span style={Object.assign({ flex: 1, display: "flex", flexDirection: "column", gap: 2 }, wrapText)}>
        <span data-testid="row-text" style={{ fontFamily: BODY, fontSize: ROW, color: INK, lineHeight: 1.4, opacity: props.done ? 0.45 : 1, textDecoration: props.done ? "line-through" : "none" }}>{props.label}</span>
        {props.sub && <span style={{ fontFamily: BODY, fontSize: 13, color: INK_SOFT, lineHeight: 1.4 }}>{props.sub}</span>}
      </span>
      {props.value != null && <span style={{ fontFamily: BODY, fontSize: 13.5, color: INK_SOFT, flexShrink: 0, whiteSpace: "nowrap", fontWeight: 700 }}>{props.value}</span>}
      {props.right || null}
    </>
  );
  var style = { display: "flex", alignItems: "center", gap: 10, width: "100%", minWidth: 0, boxSizing: "border-box", padding: "11px 0", borderTop: props.first ? "none" : "1px solid " + CARD_LINE, background: "none", borderLeft: "none", borderRight: "none", borderBottom: "none", textAlign: "left", fontFamily: BODY, color: INK };
  if (props.onClick) return <button type="button" data-testid={props.testId} onClick={props.onClick} style={Object.assign(style, { cursor: "pointer" })}>{inner}</button>;
  return <div data-testid={props.testId} style={style}>{inner}</div>;
}

// The lock always shows (tokens.emoji.alwaysShown). Until tapped, only the
// hint is visible. pin: true records are never revealed here — tapping goes
// to the place that asks for the PIN (Health).
export function LockRow(props) {
  var r = props.record;
  var shown = !r.pin && props.revealed === true;
  var sub = r.pin ? "PIN protected · tap to open Health" : (shown ? r.value : "•••••••• · tap to show");
  return (
    <ARow first={props.first} testId={"sensitive-" + r.id} icon="🔒" label={r.hint}
      sub={<span data-revealed={shown ? "true" : "false"} style={shown ? { color: INK, fontWeight: 700, letterSpacing: "0.02em" } : null}>{sub}</span>}
      onClick={props.onTap} />
  );
}

export function APill(props) {
  var primary = props.variant !== "secondary";
  return (
    <button type="button" data-testid={props.testId} onClick={props.onClick} aria-label={props.ariaLabel}
      style={Object.assign({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, maxWidth: "100%", borderRadius: 999, padding: props.small ? "6px 13px" : "9px 18px", fontFamily: BODY, fontWeight: 700, fontSize: props.small ? 13 : 14, cursor: "pointer", whiteSpace: "nowrap", background: primary ? NAVY : "transparent", color: primary ? IVORY : NAVY, border: primary ? "none" : "1px solid " + CARD_LINE }, props.style || {})}>
      {props.children}
    </button>
  );
}

// The 22px circle check for checkable rows (Home › Cleaning).
export function ACheck(props) {
  var done = !!props.done;
  return (
    <button type="button" data-testid={props.testId || "check"} aria-pressed={done} aria-label={(done ? "Mark not done: " : "Mark done: ") + (props.label || "")}
      onClick={function (e) { e.stopPropagation(); props.onToggle(); }}
      style={{ width: 22, height: 22, minWidth: 22, flexShrink: 0, boxSizing: "border-box", borderRadius: "50%", border: "2px solid " + NAVY, background: done ? NAVY : "transparent", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {done && <span aria-hidden="true" style={{ width: 5, height: 10, borderRight: "2px solid " + IVORY, borderBottom: "2px solid " + IVORY, transform: "rotate(45deg)", marginTop: -2 }} />}
    </button>
  );
}

// Page + header + pills. `above` sits on the navy between the pills and the
// content (e.g. Cove's category filters).
export function AnchorScreen(props) {
  return (
    <AnchorPage testId={props.testId} section={props.section} overlay={props.overlay} scrollRef={props.scrollRef}>
      <AnchorHeader title={props.title} subtitle={props.subtitle} emoji={props.emoji} showEmojis={props.showEmojis} onBack={props.onBack} action={props.action} />
      {props.tabs && props.tabs.length > 0 && (
        <AnchorPills tabs={props.tabs} value={props.value} onChange={props.onChange} showEmojis={props.showEmojis} label={props.title + " sections"} testIdPrefix={props.testIdPrefix} />
      )}
      {props.above || null}
      {props.children}
    </AnchorPage>
  );
}

// Wrapper for a reused legacy body inside the Anchor room.
export function AnchorBody(props) {
  return <div data-anchor-body="true" style={{ minWidth: 0 }}>{props.children}</div>;
}
