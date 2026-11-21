// src/design/redesignType.js — font loading and the type safety net.
//
// New look (af_redesign): Playfair Display (600/700, italic 500) for titles,
// headings, card titles 18px+, the Compass brief, Sunset title and big
// numbers; Lato (400/700/900) for everything else. One Google Fonts link
// with only those weights.
//
// Flag off: the original link (Cormorant Garamond + DM Sans + Lato +
// Playfair), exactly as index.html loaded it before.
//
// The new look still shows some shared screens whose inline styles name
// Cormorant Garamond / DM Sans directly (Vault records, Meals, Tide Pool…).
// Under html.af-rd the stylesheet below maps those to Playfair / Lato, and
// turns any serif set below 18px into Lato bold. Nothing here applies when
// the flag is off (no class, no stylesheet).
import { REDESIGN } from "./redesignFlag.js";

export var LEGACY_FONTS_URL = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&family=Lato:wght@400;700&family=Playfair+Display:wght@600;700&display=swap";
export var RD_FONTS_URL = "https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&family=Playfair+Display:ital,wght@0,600;0,700;1,500&display=swap";

export var PLAYFAIR = "'Playfair Display', Georgia, serif";
export var LATO = "'Lato', system-ui, sans-serif";

// Every inline font-size below 18px the app writes: whole and half px
// (React prints numbers as "13.5px") and rem in hundredths (".85rem" is
// serialized as "0.85rem").
function smallSizes() {
  var out = [];
  for (var t = 10; t < 36; t++) out.push(String(t / 2) + "px");
  for (var r = 30; r <= 112; r++) out.push(String(r / 100) + "rem");
  return out;
}

export function redesignTypeCss() {
  var serifSel = ['[style*="Cormorant"]', '[style*="Playfair"]'];
  var small = [];
  smallSizes().forEach(function (sz) {
    serifSel.forEach(function (s) { small.push("html.af-rd " + s + '[style*="font-size: ' + sz + ';"]'); });
  });
  return [
    "html.af-rd{--sans:" + LATO + ";--heading:" + PLAYFAIR + "}",
    "html.af-rd body,html.af-rd button{font-family:" + LATO + "}",
    // App.jsx's global <style> sets fields to DM Sans with !important.
    "html.af-rd input,html.af-rd textarea,html.af-rd select{font-family:" + LATO + "!important}",
    // Text fields are 16px everywhere in the new look, so iPhone never zooms
    // into a field on tap (it does below 16px). Not checkboxes, radios,
    // sliders, color swatches or buttons.
    'html.af-rd input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]),html.af-rd textarea,html.af-rd select{font-size:16px!important}',
    'html.af-rd [style*="DM Sans"]{font-family:' + LATO + "!important}",
    'html.af-rd [style*="Cormorant"]{font-family:' + PLAYFAIR + "!important}",
    // Playfair never below 18px: Lato bold instead.
    small.join(",") + "{font-family:" + LATO + "!important;font-weight:700!important;font-style:normal!important}",
  ].join("\n");
}

export function installFonts(doc, on) {
  if (!doc || !doc.head) return;
  if (doc.getElementById("af-fonts")) return;
  var link = doc.createElement("link");
  link.id = "af-fonts";
  link.rel = "stylesheet";
  link.href = on ? RD_FONTS_URL : LEGACY_FONTS_URL;
  doc.head.appendChild(link);
  if (!on) return;
  doc.documentElement.classList.add("af-rd");
  var st = doc.createElement("style");
  st.id = "af-rd-type";
  st.textContent = redesignTypeCss();
  doc.head.appendChild(st);
}

if (typeof document !== "undefined") installFonts(document, REDESIGN);
