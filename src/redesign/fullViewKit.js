// src/redesign/fullViewKit.js — constants and helpers shared by the
// redesigned Flow full views (components are in ./FullView.jsx).
//   emo / emoPrefix  decorative emoji, shown only when showEmojis is on
//   inputStyle       text input in the new look (16px so iOS doesn't zoom)
//   rdLegacyKit      T/card/btnP/btnS/inp/lbl in the new look, for the few
//                    legacy sub-section bodies reused as-is in the new screens
import { color, gradient, radius, shadow, font, check, shouldShowEmoji } from "../design/tokens.js";

export var NAVY = color.anchorNavy;
export var MUTED = "#5B6472";
export var SAGE = check.color;
export var SAGE_TEXT = "#4D7A6A"; // sage for text on white (AA contrast); SAGE is for fills
export var IVORY = gradient.sunset.text;
export var HAIRLINE = "rgba(27,43,68,0.08)";
export var wrapText = { minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" };

export function goTab(tab) { try { window.dispatchEvent(new CustomEvent("af-set-tab", { detail: tab })); } catch { /* no window */ } }

// Decorative emoji: shown only when the household's showEmojis is on.
export function emo(showEmojis, glyph) { return shouldShowEmoji("item", showEmojis === true) ? glyph : null; }
// Same, with a trailing space, for "🍕 Label" style text.
export function emoPrefix(showEmojis, glyph) { var g = emo(showEmojis, glyph); return g ? g + " " : ""; }

export var inputStyle = { width: "100%", minWidth: 0, boxSizing: "border-box", background: "#FFFFFF", border: "1px solid rgba(27,43,68,0.14)", borderRadius: radius.sm, padding: "10px 14px", fontFamily: font.body, fontSize: 16, color: NAVY, outline: "none" };

// ── Reused legacy bodies ─────────────────────────────────────────────────────
// HomeFlow's own T/card/btnP/btnS/inp/lbl, in the new look (fixed light
// palette, white cards, pill buttons, DM Sans). Same shapes as HomeFlow's so a
// legacy sub-section body can be rendered unchanged with these in scope.
// No purple/pink: lavender maps to the blue family.
export var RD_T = {
  label: "Redesign", emoji: "",
  bg: color.flowBackground, bgAlt: "#F3EFE7", surface: "#FFFFFF", border: "#E3DDD2", borderSoft: "#EDE8DF",
  sage: SAGE, sageDark: "#4D7A6A", sageLight: "#A0C0B0", sagePale: color.tint.sage,
  sand: "#C4A882", sandDark: "#9A7A52", sandLight: "#DDC8A0", sandPale: color.tint.sand,
  blue: "#4A7FA8", blueDark: "#3A6A90", blueLight: "#96BDD0", bluePale: color.tint.blue,
  rose: "#B87265", roseDark: "#8F4F44", rosePale: "#F0DDD8",
  lavender: "#5E8FA0", lavPale: color.tint.mist,
  textDark: NAVY, textMid: "#4A5363", textSoft: MUTED, textFaint: "#6B7280",
  white: "#FFFFFF", navBg: color.flowBackground, topBg: color.flowBackground,
  inputBg: "#FFFFFF", cardShadow: "rgba(27,43,68,0.06)", modalOverlay: "rgba(27,43,68,0.45)",
};

// Lighthouse section/dashboard card shell under the redesign: white rounded card.
export var RD_LH_CARD = { background: "#FFFFFF", border: "none", borderRadius: radius.lg, boxShadow: shadow.card, marginBottom: "0.85rem", overflow: "hidden" };

// Calendar year-view categories whose legacy colors are purple/pink
// (Celebrations #A99AC4, Holidays #C4849A) get these under the redesign.
export var RD_YEAR_CAT_COLORS = { celebrations: "#C8A253", holidays: "#D9895B" };

export function rdLegacyKit() {
  var T = RD_T;
  return {
    T: T,
    inp: function (x) { return Object.assign({ width: "100%", background: "#FFFFFF", border: "1px solid rgba(27,43,68,0.14)", borderRadius: radius.sm, padding: "0.62rem 0.82rem", color: NAVY, fontSize: "0.87rem", outline: "none", boxSizing: "border-box", fontFamily: font.body }, x || {}); },
    lbl: { display: "block", color: MUTED, fontSize: "0.71rem", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 700, fontFamily: font.body },
    btnP: function (bg, x) { return Object.assign({ background: bg || NAVY, color: "#fff", border: "none", borderRadius: 999, padding: "0.56rem 1.1rem", cursor: "pointer", fontWeight: 700, fontSize: "0.84rem", fontFamily: font.body, letterSpacing: "0.01em" }, x || {}); },
    btnS: function (x) { return Object.assign({ background: "#FFFFFF", color: NAVY, border: "1px solid " + HAIRLINE, borderRadius: 999, padding: "0.56rem 1.1rem", cursor: "pointer", fontSize: "0.84rem", fontFamily: font.body, fontWeight: 600 }, x || {}); },
    card: function (x) { return Object.assign({ background: "#FFFFFF", border: "none", borderRadius: radius.lg, padding: "16px 18px", marginBottom: "0.85rem", boxShadow: shadow.card, boxSizing: "border-box", minWidth: 0 }, x || {}); },
  };
}

// ── showEmojis for reused legacy bodies ─────────────────────────────────────
// Those bodies have decorative emoji baked into their text ("✨ Get tips",
// "⚡ Under 15 min", a lone "🫙"). With showEmojis off, EmojiScope (FullView.jsx)
// runs every text node under it through stripDecorativeEmoji: a text that is
// only emoji becomes empty, and a leading or trailing emoji run is dropped.
// Emoji in the middle of a sentence stay. Kept: ⭐ (ratings) and the pillar /
// lock icons, which tokens.emoji.alwaysShown says always show.
var KEEP = ["⭐", "⚓", "🌊", "🌀", "🧭", "🔒", "🔐"];
var EMOJI = "(?:\\p{Extended_Pictographic}\\uFE0F?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*[\\u{1F3FB}-\\u{1F3FF}]?)";
var LEAD = new RegExp("^(\\s*)((?:" + EMOJI + "\\s*)+)", "u");
var TRAIL = new RegExp("((?:\\s*" + EMOJI + ")+)(\\s*)$", "u");
function keeps(run) { return KEEP.some(function (k) { return run.indexOf(k) !== -1; }); }
export function stripDecorativeEmoji(text) {
  if (typeof text !== "string" || !text) return text;
  var out = text;
  var m = out.match(LEAD);
  if (m && !keeps(m[2])) out = m[1] + out.slice(m[0].length);
  var t = out.match(TRAIL);
  if (t && !keeps(t[1]) && t.index > 0) out = out.slice(0, t.index) + t[2];
  return out;
}
