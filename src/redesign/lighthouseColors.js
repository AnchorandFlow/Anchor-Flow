// src/redesign/lighthouseColors.js — Lighthouse colors under af_redesign.
//
// Lighthouse is the school section, so it gets the wider school palette
// (tokens.schoolTones: sage, sand gold, blue, teal, terracotta, mustard,
// denim; no purple or pink):
//   - each subject has its own color (tokens.subjectTone): chips, lesson rows,
//     subject cards, homework, grades, curricula and library resources
//   - each area has its own color: the section pills and the area's cards
//     (Overview's summary cards each get one too)
//   - the child's work carries that child's person color as a left accent
//
// Every helper takes `on` (REDESIGN) and returns the legacy style object
// unchanged when it is false, so flag-off renders exactly as before.
import { schoolTones, subjectTone, shadow, radius } from "../design/tokens.js";

export var LH_AREA_TONE = {
  overview: schoolTones.sandGold,
  plan: schoolTones.teal,
  records: schoolTones.terracotta,
  growth: schoolTones.sage,
  library: schoolTones.denim,
};

// Overview's summary cards, one color each.
export var LH_DASH_TONE = {
  plan: schoolTones.teal, attendance: schoolTones.terracotta, subjects: schoolTones.blue,
  goals: schoolTones.mustard, umbrella: schoolTones.denim, books: schoolTones.sandGold,
  thisweek: schoolTones.teal, homework: schoolTones.terracotta, teachers: schoolTones.sage,
};

// "plan-week" -> plan, "records" -> records.
export function lhAreaTone(tabName) {
  var k = String(tabName || "").split("-")[0];
  return LH_AREA_TONE[k] || schoolTones.sage;
}

// A subject chip: filled in the subject color with white text (AA). With
// `textOnly`, just the subject color as text.
export function lhChipStyle(on, name, base, textOnly) {
  if (!on || !String(name || "").trim()) return base;
  var t = subjectTone(name);
  if (textOnly) return Object.assign({}, base, { color: t.ink });
  return Object.assign({}, base, { background: t.full, color: "#FFFFFF", fontWeight: 800, borderRadius: "2rem", padding: base.padding || "1px 8px" });
}

// A lesson / subject row: the subject's tint with a bar in its color.
export function lhRowStyle(on, name, base, extra) {
  if (!on || !String(name || "").trim()) return base;
  var t = subjectTone(name);
  return Object.assign({}, base, extra || {}, { background: t.tint, border: "none", borderBottom: "none", boxShadow: "inset 4px 0 0 " + t.full, paddingLeft: "0.95rem" });
}

export function lhTextStyle(on, name, base) {
  if (!on || !String(name || "").trim()) return base;
  return Object.assign({}, base, { color: subjectTone(name).ink });
}

// An area card (SectionShell): white body so subject rows stand out, header
// band in the area color, the child's person color as the left accent.
export function lhSectionCard(tone, kidColor) {
  return {
    background: "#FFFFFF", border: "none", borderRadius: radius.lg, overflow: "hidden", marginBottom: "0.6rem",
    boxShadow: "inset 5px 0 0 " + (kidColor || tone.full) + ", " + shadow.card,
  };
}
export function lhSectionHead(tone) {
  return { background: tone.tint, color: tone.ink };
}

// An Overview summary card: its own tint, child accent on the left.
export function lhDashCard(tone, kidColor) {
  return {
    background: tone.tint, border: "none", borderRadius: radius.lg, marginBottom: 0, overflow: "hidden",
    boxShadow: "inset 5px 0 0 " + (kidColor || tone.full) + ", " + shadow.card,
  };
}

// Pill tone for a child, from their person color: tinted pill, and when
// selected a darker fill of the same hue (white text stays readable).
export function kidTone(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return null;
  var n = parseInt(m[1], 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  function mix(c, w, f) { return Math.round(c + (w - c) * f); }
  function hx(rr, gg, bb) { return "#" + [rr, gg, bb].map(function (v) { return ("0" + v.toString(16)).slice(-2); }).join("").toUpperCase(); }
  return {
    tint: hx(mix(r, 255, 0.72), mix(g, 255, 0.72), mix(b, 255, 0.72)),
    full: hx(mix(r, 0, 0.38), mix(g, 0, 0.38), mix(b, 0, 0.38)),
    ink: hx(mix(r, 0, 0.6), mix(g, 0, 0.6), mix(b, 0, 0.6)),
  };
}
