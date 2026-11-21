// src/redesign/fullViewKit.js — constants and helpers shared by the
// redesigned Flow full views (components are in ./FullView.jsx).
//   emo / emoPrefix  decorative emoji, shown only when showEmojis is on
//   inputStyle       text input in the new look (16px so iOS doesn't zoom)
//   rdLegacyKit      T/card/btnP/btnS/inp/lbl in the new look, for the few
//                    legacy sub-section bodies reused as-is in the new screens
import { color, gradient, radius, shadow, font, check, shouldShowEmoji, toneFor, tone, accentTone } from "../design/tokens.js";

export var NAVY = color.anchorNavy;
export var MUTED = "#5B6472";
export var SAGE = check.color;
export var SAGE_TEXT = "#4D7A6A"; // sage for text on white (AA contrast); SAGE is for fills
export var IVORY = gradient.sunset.text;
export var HAIRLINE = "rgba(27,43,68,0.08)";
export var wrapText = { minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" };

export function goTab(tab) { try { window.dispatchEvent(new CustomEvent("af-set-tab", { detail: tab })); } catch { /* no window */ } }
// "← Anchor" from a HomeFlow tab (Home, People, Cove, Horizon, Settings):
// FlowWrapper opens the Anchor screen, behind the same Plus gate as the
// sidebar's Anchor header.
export function goAnchor() { try { window.dispatchEvent(new CustomEvent("af-open-anchor")); } catch { /* no window */ } }

// Decorative emoji: shown only when the household's showEmojis is on.
export function emo(showEmojis, glyph) { return shouldShowEmoji("item", showEmojis === true) ? glyph : null; }
// Same, with a trailing space, for "🍕 Label" style text.
export function emoPrefix(showEmojis, glyph) { var g = emo(showEmojis, glyph); return g ? g + " " : ""; }

export var inputStyle = { width: "100%", minWidth: 0, boxSizing: "border-box", background: "#FFFFFF", border: "1px solid rgba(27,43,68,0.14)", borderRadius: radius.sm, padding: "10px 14px", fontFamily: font.body, fontSize: 16, color: NAVY, outline: "none" };

// ── Reused legacy bodies ─────────────────────────────────────────────────────
// HomeFlow's own T/card/btnP/btnS/inp/lbl, in the new look (fixed light
// palette, white cards, pill buttons, Lato). Same shapes as HomeFlow's so a
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

// Lighthouse section/dashboard card shell under the redesign: rounded card in
// the Lighthouse tone.
export var RD_LH_CARD = { background: toneFor("lighthouse").tint, border: "none", borderRadius: radius.lg, boxShadow: shadow.card, marginBottom: "0.6rem", overflow: "hidden" };

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
// lock icons, which tokens.emoji.alwaysShown says always show, and the
// show/hide eye on masked sensitive fields (part of the lock UI: an emptied
// reveal button would leave the record unreadable).
var KEEP = ["⭐", "⚓", "🌊", "🌀", "🧭", "🔒", "🔐", "👁", "🙈"];
var EMOJI = "(?:\\p{Extended_Pictographic}\\uFE0F?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?)*[\\u{1F3FB}-\\u{1F3FF}]?)";
var LEAD = new RegExp("^(\\s*)((?:" + EMOJI + "\\s*)+)", "u");
var TRAIL = new RegExp("((?:\\s*" + EMOJI + ")+)(\\s*)$", "u");
function keeps(run) { return KEEP.some(function (k) { return run.indexOf(k) !== -1; }); }
export function isAlwaysShownGlyph(glyph) { return typeof glyph === "string" && keeps(glyph); }
export function stripDecorativeEmoji(text) {
  if (typeof text !== "string" || !text) return text;
  var out = text;
  var m = out.match(LEAD);
  if (m && !keeps(m[2])) out = m[1] + out.slice(m[0].length);
  var t = out.match(TRAIL);
  if (t && !keeps(t[1]) && t.index > 0) out = out.slice(0, t.index) + t[2];
  return out;
}

// ── Popups, sheets and chips in the new look ────────────────────────────────
// Shared by ModalBox, the in-app confirm/prompt, the Calendar sheets and the
// legacy forms af_redesign still renders. Flag-off code never calls these.
export var RD_OVERLAY = { position: "fixed", inset: 0, background: "rgba(27,43,68,0.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 9000 };
// Centered dialog card.
export var RD_DIALOG = { background: "#FFFFFF", border: "none", borderRadius: radius.lg, boxShadow: shadow.raised, fontFamily: font.body, color: NAVY, boxSizing: "border-box", minWidth: 0 };
// Bottom sheet (Calendar work schedules, year-view day detail).
export var RD_SHEET = { background: "#FFFFFF", borderRadius: radius.lg + "px " + radius.lg + "px 0 0", padding: "18px 18px calc(22px + env(safe-area-inset-bottom, 0px))", maxWidth: 520, width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 -10px 32px rgba(27,43,68,0.16)", fontFamily: font.body, color: NAVY, boxSizing: "border-box" };
export var RD_SHEET_TITLE = { fontFamily: font.heading, fontWeight: 700, fontSize: 22, lineHeight: 1.15, color: NAVY, minWidth: 0, overflowWrap: "anywhere" };
export var RD_CLOSE = { background: "#F3EFE7", border: "none", borderRadius: 999, width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: NAVY, fontSize: 18, lineHeight: 1, flexShrink: 0, fontFamily: font.body };
export var RD_SECTION_LABEL = { fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontFamily: font.body };

// A choice chip in a tone ({tint, full, ink}): selected = full with white
// text, otherwise the tint with ink text.
export function rdChip(on, tn, x) {
  return Object.assign({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "6px 13px", borderRadius: 999, border: "none", background: on ? tn.full : tn.tint, color: on ? "#FFFFFF" : tn.ink, fontFamily: font.body, fontSize: 12.5, fontWeight: on ? 700 : 600, cursor: "pointer", lineHeight: 1.2, maxWidth: "100%" }, x || {});
}
// The same chip in a person's own color (hex): selected = the color, else a pale wash.
export function rdPersonChip(on, hex, x) {
  var c = hex || NAVY;
  return Object.assign({ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 999, border: "1px solid " + (on ? c : c + "55"), background: on ? c : c + "1F", color: on ? "#FFFFFF" : NAVY, fontFamily: font.body, fontSize: 12.5, fontWeight: on ? 700 : 600, cursor: "pointer", lineHeight: 1.2 }, x || {});
}
// Segmented control: a white track holding pill options.
export var RD_SEG_TRACK = { display: "flex", gap: 4, background: "#FFFFFF", borderRadius: 999, padding: 4, boxShadow: shadow.card, minWidth: 0 };
export function rdSeg(on, tn) {
  return { flex: 1, minWidth: 0, background: on ? tn.full : "transparent", color: on ? "#FFFFFF" : NAVY, border: "none", borderRadius: 999, padding: "7px 10px", cursor: "pointer", fontFamily: font.body, fontSize: 13, fontWeight: on ? 700 : 600, whiteSpace: "nowrap" };
}
// Text-only action in a tone (Edit, Remove, + Add shift).
export function rdLink(hex) { return { background: "none", border: "none", padding: 0, cursor: "pointer", color: hex || NAVY, fontFamily: font.body, fontSize: 12.5, fontWeight: 700 }; }
export var RD_DANGER = "#A0533A"; // terracotta (accentTone.terracotta.full), not pink

// Calendar year categories in the approved palette (no purple or pink).
export var RD_YEAR_CAT_TONES = {
  birthdays: accentTone.gold, trips: tone.teal, school: tone.sage, work: tone.mist, appointments: tone.blue,
  holidays: accentTone.seafoam, celebrations: accentTone.mustard, custody: tone.sand, deadlines: accentTone.terracotta,
  other: { tint: "#E8E4DC", full: "#5B6472", ink: "#3B4250" },
};
export function rdYearCatTone(id) { return RD_YEAR_CAT_TONES[id] || RD_YEAR_CAT_TONES.other; }

// HomeFlow's inp/lbl/btnP/btnS for af_redesign (every form and popup that
// still uses them). btnP keeps the caller's meaning: the theme's blue, sage,
// sand and rose map to the matching tone, anything else stays as given.
export function rdFormKit(T) {
  var k = rdLegacyKit();
  var map = {};
  // the new-look palette's own (RD_T) colors too, for forms that read it
  [RD_T, T].forEach(function (pal) {
    if (!pal) return;
    map[pal.blue] = tone.blue.full; map[pal.blueDark] = tone.blue.full;
    map[pal.sage] = tone.sage.full; map[pal.sageDark] = tone.sage.full;
    map[pal.sand] = tone.sand.full; map[pal.sandDark] = tone.sand.full;
    map[pal.rose] = RD_DANGER; map[pal.lavender] = tone.mist.full;
  });
  return {
    inp: function (x) { return k.inp(Object.assign({ borderRadius: 12 }, x || {})); },
    lbl: k.lbl,
    btnP: function (bg, x) { return k.btnP(bg ? (map[bg] || bg) : NAVY, x); },
    btnS: k.btnS,
  };
}
