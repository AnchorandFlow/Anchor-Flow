// src/redesign/anchorKit.js — colors, fonts and scoped CSS for the
// redesigned Anchor full views (components in ./AnchorFullView.jsx).
import { color, radius, font } from "../design/tokens.js";

export var NAVY = color.anchorNavy;            // #1B2B44
export var CARD = color.surface;               // light card on the navy
export var INK = NAVY;                          // text on cards
export var INK_SOFT = "#4A5568";                // secondary text on cards (AA on CARD)
export var IVORY_SOFT = "rgba(242,234,216,0.72)";
export var IVORY_LINE = "rgba(242,234,216,0.28)";
export var CARD_LINE = "rgba(27,43,68,0.09)";
export var GOLD = color.gold;
export var HEAD = font.anchor.heading;
export var BODY = font.anchor.body;
export var ROW = font.anchor.rowSize;

// Scoped to the Anchor full views. Inline styles name their font, so attribute
// selectors retarget legacy bodies: Cormorant -> Playfair Display, DM Sans ->
// Lato. Controls without a font of their own inherit Lato. Media and wide
// tables can't push the page sideways.
export var ANCHOR_CSS =
  "[data-anchor-room] [style*='Cormorant']{font-family:" + HEAD + " !important}" +
  "[data-anchor-room] [style*='DM Sans']{font-family:" + BODY + " !important}" +
  "[data-anchor-room] button,[data-anchor-room] input,[data-anchor-room] select,[data-anchor-room] textarea{font-family:inherit}" +
  "[data-anchor-body] img,[data-anchor-body] video,[data-anchor-body] table{max-width:100%}" +
  "[data-anchor-body]{min-width:0;overflow-wrap:anywhere}" +
  // Vault sections and Safe Harbor draw their own light cards (#F7F1E3);
  // round them and give them the section's tint, to match the Anchor cards.
  "[data-anchor-body] [style*='background: rgb(247, 241, 227)']{border-radius:" + radius.md + "px !important;background:var(--anchor-tint, rgb(247, 241, 227)) !important}" +
  // No sideways scrolling: tab strips that scroll sideways in the legacy
  // bodies (Inventory categories, Health people, Career tabs) wrap instead.
  "[data-anchor-body] [style*='display: flex'][style*='overflow-x: auto']{flex-wrap:wrap !important;overflow-x:visible !important}";
