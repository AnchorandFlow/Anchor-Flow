// src/design/tokens.js — design tokens for the Anchor & Flow redesign
// (gated by af_redesign, see ./redesignFlag.js). Single source of truth for
// the new look. Nothing imports these for rendering yet.
//
// Rule: no purple or pink anywhere EXCEPT the Sunset gradient. Enforced by
// tests/unit/design-tokens.test.js (hue check on every non-Sunset color).

export var color = {
  // Calm base
  background: "#F5F0E8",
  surface: "#FDFAF5",
  flowBackground: "#FAF8F3", // very light Flow page background
  anchorNavy: "#1B2B44",
  gold: "#C8A253",

  // Pale tints
  tint: {
    sage: "#DEEEE8",
    sand: "#F0E4D0",
    blue: "#DCEEF0",
    seafoam: "#E4EEEA",
    mist: "#E2EAF0",
  },
};

export var gradient = {
  ripples: {
    from: "#2F7E76",
    to: "#1D5751",
    css: "linear-gradient(135deg, #2F7E76 0%, #1D5751 100%)",
  },
  // Sunset — the ONLY place purple/pink hues are allowed. Top to bottom:
  // warm orange glow -> coral -> mauve -> dusk indigo.
  sunset: {
    stops: [
      { name: "glow", hex: "#F4A259", at: 0 },
      { name: "coral", hex: "#E2725B", at: 32 },
      { name: "mauve", hex: "#9C6B8A", at: 64 },
      { name: "duskIndigo", hex: "#26263F", at: 100 },
    ],
    css: "linear-gradient(180deg, #F4A259 0%, #E2725B 32%, #9C6B8A 64%, #26263F 100%)",
    text: "#F2EAD8", // ivory
  },
};

export var radius = {
  sm: 14,
  md: 16,
  lg: 20,
  min: 14,
  max: 20,
};

export var shadow = {
  // Soft, navy-tinted (not black) so cards lift without looking heavy.
  card: "0 1px 2px rgba(27, 43, 68, 0.04), 0 4px 14px rgba(27, 43, 68, 0.06)",
  raised: "0 2px 4px rgba(27, 43, 68, 0.05), 0 10px 28px rgba(27, 43, 68, 0.08)",
};

export var font = {
  heading: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  body: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  checklistItem: { family: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", size: 14 },
};

// Person colors. Named entries are this household's people; kids cycle
// through `kids`. Any other adult falls back to `defaultAdult`.
export var person = {
  lindsey: "#4A7FA8", // denim
  twyla: "#3AAA91",   // teal
  kids: ["#7A9E8E", "#C4A882"], // sage, sand
  defaultAdult: "#4A7FA8",
};

// Work days are NOT color-coded by person: a neutral striped tag carrying
// the person's initials.
export var workDayTag = {
  background: "repeating-linear-gradient(135deg, #EDE8DF 0px, #EDE8DF 4px, #E3DDD2 4px, #E3DDD2 8px)",
  border: "#D6CFC2",
  text: "#5B6472",
  showsInitials: true,
  fontSize: 11,
  radius: 6,
};

// Emoji policy. `showEmojis` is a household setting (synced, default OFF).
// Pillar icons and lock icons are always shown regardless.
export var emoji = {
  settingKey: "showEmojis",
  defaultOn: false,
  alwaysShown: ["pillar", "lock"],
};

export function shouldShowEmoji(kind, showEmojis) {
  if (emoji.alwaysShown.indexOf(kind) !== -1) return true;
  return showEmojis === true;
}

export function initialsFor(name) {
  var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

var tokens = { color: color, gradient: gradient, radius: radius, shadow: shadow, font: font, person: person, workDayTag: workDayTag, emoji: emoji };
export default tokens;
