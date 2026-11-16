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

// ── Inner cards, rows, buttons and text ─────────────────────────────────────
// Lighthouse's inner pieces are inline styles in its own warm-beige palette
// (hairline #F0EBDF / #E7E1D4 / #D8D2C4 borders, #FBF9F4 rows, small radii,
// #7a7568-ish grays). lhInnerStyle maps those to the new look:
//   - a bordered card or row: no border; a white card gets the soft shadow,
//     a cream row becomes a light warm fill (it sits on a white area card)
//   - a bordered button or chip: pill, white with a navy hairline
//   - radii up to the new 12 / 14 / 16; grays to the new navy-based grays
// Anything else (subject colors, the child's accent) is left as is. Flag off:
// the same object back, untouched.
var HAIRLINE_RE = /solid\s*#(F0EBDF|E7E1D4|D8D2C4|E5DFD3|E8E2D6|EDE8DF|E0D9CB)\b/i;
var CREAM = { "#fbf9f4": 1, "#f7f3ec": 1, "#faf7f0": 1, "#f0ebdf": 1 };
var WHITE = { "#fff": 1, "#ffffff": 1, "white": 1 };
var TEXT = { "#3a3a34": "#1B2B44", "#5a5a50": "#4A5363", "#7a7568": "#5B6472", "#8a8578": "#6B7280", "#9a9488": "#6B7280", "#a09a8c": "#6B7280" };
var RADIUS = { "0.4rem": 10, "0.45rem": 10, "0.5rem": 12, "0.6rem": 12, "0.65rem": 12, "0.7rem": 14, "0.75rem": 14, "0.8rem": 14, "0.9rem": 16, "1rem": 16 };
var SMALL_R = { "0.4rem": 1, "0.45rem": 1, "0.5rem": 1, "0.6rem": 1, "0.65rem": 1, "2rem": 1, "99px": 1, "50px": 1, "999px": 1, "50%": 1 };
var SOFT = "0 1px 2px rgba(27,43,68,0.04), 0 4px 14px rgba(27,43,68,0.06)";
export var LH_ROW_FILL = "#F7F5F0";

export function lhInnerStyle(on, st) {
  if (!on || !st || typeof st !== "object") return st;
  var out = Object.assign({}, st);
  var bg = typeof out.background === "string" ? out.background.toLowerCase() : "";
  var hair = typeof out.border === "string" && HAIRLINE_RE.test(out.border);
  // a clickable thing with a small radius is a button or chip; with a big
  // radius it is a clickable card
  var isBtn = out.cursor === "pointer" && (out.borderRadius === undefined || SMALL_R[out.borderRadius] === 1);
  if (hair && isBtn) {
    out.border = "1px solid rgba(27,43,68,0.14)";
    if (!bg || bg === "transparent" || bg === "none" || CREAM[bg]) out.background = "#FFFFFF";
    if (out.borderRadius !== "50%") out.borderRadius = 999;
  } else if (hair) {
    out.border = "none";
    if (WHITE[bg]) out.boxShadow = out.boxShadow || SOFT;
    else if (CREAM[bg] || !bg || bg === "transparent" || bg === "none") out.background = LH_ROW_FILL;
  } else if (isBtn && typeof out.border === "string" && /solid/.test(out.border) && out.borderRadius !== "50%") {
    // the selected state of a bordered chip: same pill shape as its siblings
    out.borderRadius = 999;
  }
  if (typeof out.borderRadius === "string" && RADIUS[out.borderRadius]) out.borderRadius = RADIUS[out.borderRadius];
  if (typeof out.color === "string" && TEXT[out.color.toLowerCase()]) out.color = TEXT[out.color.toLowerCase()];
  if (typeof out.borderBottom === "string" && HAIRLINE_RE.test(out.borderBottom)) out.borderBottom = "1px solid rgba(27,43,68,0.08)";
  if (typeof out.borderTop === "string" && HAIRLINE_RE.test(out.borderTop)) out.borderTop = "1px solid rgba(27,43,68,0.08)";
  return out;
}
