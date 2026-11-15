// src/design/tokens.js — design tokens for the Anchor & Flow redesign
// (gated by af_redesign, see ./redesignFlag.js). Single source of truth for
// the new look.
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

// Section tones: every Flow and Anchor section has one. `tint` fills its
// cards and unselected tab, `full` is the selected tab (white text on it
// passes AA), `ink` is text in that hue on the tint. No purple or pink.
export var tone = {
  sage: { tint: "#D5E8E0", full: "#4D7A6A", ink: "#2F5446" },
  sand: { tint: "#EFE1C9", full: "#8C6D45", ink: "#5E4526" },
  blue: { tint: "#D3E6EE", full: "#3A6A90", ink: "#24496A" },
  teal: { tint: "#CFE6E2", full: "#2F7E76", ink: "#1D5751" },
  mist: { tint: "#DCE4EE", full: "#5B7690", ink: "#364C62" },
  navy: { tint: "#D9DFEA", full: "#1B2B44", ink: "#1B2B44" },
};

// More approved tones for screens that need several colors at once (Waves'
// rhythms, Calendar events and days, Lighthouse subjects). Same shape and
// contrast rules as `tone`. Still no purple or pink.
export var accentTone = {
  gold: { tint: "#F3E6C4", full: "#86681F", ink: "#5A4512" },
  seafoam: { tint: "#D7EEE6", full: "#3B7F6B", ink: "#21533F" },
  terracotta: { tint: "#F2DCD1", full: "#A0533A", ink: "#6C3321" },
  mustard: { tint: "#F1E6B2", full: "#7C6510", ink: "#524208" },
  denim: { tint: "#D8E1EE", full: "#3D5E8A", ink: "#253F63" },
};

// Waves: one color per rhythm.
export var waveTone = {
  daily: tone.teal, weekly: tone.sage, seasonal: accentTone.gold, custom: tone.sand,
};

// Calendar: the event/day palette (blue is one of six, not the default).
export var calendarTones = [tone.sage, tone.teal, accentTone.gold, tone.sand, accentTone.seafoam, tone.blue];

// Lighthouse: the wider school palette, one per subject.
export var schoolTones = {
  sage: tone.sage, sandGold: accentTone.gold, blue: tone.blue, teal: tone.teal,
  terracotta: accentTone.terracotta, mustard: accentTone.mustard, denim: accentTone.denim,
};
var SCHOOL_ORDER = ["blue", "terracotta", "teal", "sandGold", "sage", "mustard", "denim"];
// Common subjects get a fixed color so they read the same everywhere; any
// other subject is hashed by name onto the palette (stable across renders).
var SUBJECT_RULES = [
  [/math|algebra|geometry|calculus|arithmetic|number/, "blue"],
  [/read|english|ela\b|language arts|literature|writing|spelling|phonics|grammar|poetry/, "terracotta"],
  [/science|biology|chemistry|physics|nature|stem|astronomy|earth/, "teal"],
  [/history|social|geography|civics|government|econom/, "sandGold"],
  [/\bpe\b|p\.e|physical|gym|sport|health|outdoor|garden/, "sage"],
  [/\bart|draw|paint|craft|design/, "mustard"],
  [/music|piano|guitar|band|choir|violin|language|spanish|french|latin|german|asl|coding|computer|tech/, "denim"],
];
export function hashIndex(str, n) {
  var h = 0, s = String(str || "");
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}
export function subjectTone(name) {
  var s = String(name || "").trim().toLowerCase();
  if (!s) return schoolTones.sage;
  for (var i = 0; i < SUBJECT_RULES.length; i++) if (SUBJECT_RULES[i][0].test(s)) return schoolTones[SUBJECT_RULES[i][1]];
  return schoolTones[SCHOOL_ORDER[hashIndex(s, SCHOOL_ORDER.length)]];
}

// Section -> tone. Flow sections, then Anchor sections.
export var sectionTone = {
  exhale: "sage", shopping: "teal", meals: "sand", calendar: "blue", waves: "mist", tidepool: "sand", lighthouse: "navy",
  vault: "navy", safeharbor: "teal", home: "sand", people: "sage", cove: "blue", horizon: "mist", settings: "mist",
};

export function toneFor(section) { return tone[sectionTone[section]] || tone.mist; }

// Page grounds. Flow is sea glass (the original Flow room tint, lightened);
// Anchor stays navy.
export var page = {
  flow: "#E6EFEF",
};

// Paint an element's background edge to edge across the content area (and
// down past it) on wide screens, without making the page wider: a spread
// shadow in the same color. Shadows are not scrollable overflow, so nothing
// scrolls sideways; the fixed sidebar and sticky bars paint above it. (No
// clip-path: that would also clip the fixed modals these pages open.)
export function fullBleed(bg) {
  return { boxShadow: "0 0 0 100vmax " + bg };
}

export var gradient = {
  ripples: {
    from: "#2F7E76",
    to: "#1D5751",
    css: "linear-gradient(135deg, #2F7E76 0%, #1D5751 100%)",
  },
  // Sunset — the ONLY place purple/pink hues are allowed. Top to bottom:
  // warm orange glow -> coral -> dusty rose -> mauve -> dusk indigo.
  // Text: dark plum on the bright top, ivory lower down. Selected chips use
  // a soft apricot. The page is glass cards over this gradient.
  sunset: {
    stops: [
      { name: "glow", hex: "#F4A259", at: 0 },
      { name: "coral", hex: "#E2725B", at: 24 },
      { name: "dustyRose", hex: "#C17C83", at: 44 },
      { name: "mauve", hex: "#8A6283", at: 64 },
      { name: "duskIndigo", hex: "#26263F", at: 100 },
    ],
    css: "linear-gradient(180deg, #F4A259 0%, #E2725B 24%, #C17C83 44%, #8A6283 64%, #26263F 100%)",
    text: "#F2EAD8", // ivory
    plum: "#3A1F35", // dark plum, for text on the bright top area
    apricot: "#F8C9A0", // selected chips
    glass: "rgba(38, 38, 63, 0.28)", // frosted card fill (dusk-indigo tint)
    glassBorder: "rgba(242, 234, 216, 0.22)",
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
  // Anchor full views (Vault, Safe Harbor, Home, People, Cove, Horizon,
  // Settings): Playfair Display titles, Lato subtitles and rows (15px).
  anchor: {
    heading: "'Playfair Display', Georgia, 'Times New Roman', serif",
    body: "'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    rowSize: 15,
  },
};

// Person colors. Named entries are this household's people; kids cycle
// through `kids`. Any other adult falls back to `defaultAdult`.
export var person = {
  lindsey: "#4A7FA8", // denim
  twyla: "#3AAA91",   // teal
  kids: ["#7A9E8E", "#C4A882"], // sage, sand
  defaultAdult: "#4A7FA8",
};

// Checkable items (Flow full views): 22px sage circle. Done = filled sage
// with a white tick, and the item's text crossed out at 45% opacity.
export var check = {
  size: 22,
  color: "#7A9E8E", // sage
  doneTextOpacity: 0.45,
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

var tokens = { color: color, tone: tone, accentTone: accentTone, page: page, gradient: gradient, radius: radius, shadow: shadow, font: font, person: person, check: check, workDayTag: workDayTag, emoji: emoji };
export default tokens;
