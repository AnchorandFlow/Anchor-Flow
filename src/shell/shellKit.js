// src/shell/shellKit.js
// Shared pieces for the new shell components (redesign, phase 1).
// Tokens lifted directly from the mockup's :root so everything matches it.

export const TK = {
  navy: "#0e1b2e",
  navyLight: "#1e3052",
  gold: "#c8a97a",
  goldLight: "#dfc49a",
  cream: "#f5f0e8",
  t1: "#f5f0e8",
  t2: "rgba(245,240,232,.88)",
  t3: "rgba(245,240,232,.58)",
  card: "rgba(22,36,64,.55)",
  border: "rgba(200,169,122,.12)",
  green: "#7eb89a",
  blue: "#7aa8c8",
  rose: "#c87a8a",
  serif: "'Cormorant Garamond', serif",
  sans: "'DM Sans', sans-serif"
};

// Reads the full household state from localStorage (every af_* key).
// Self-contained on purpose — no imports from App.jsx, so the shell
// survives the migration without coupling.
export function readHouseholdState() {
  var s = {};
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key && key.indexOf("af_") === 0) {
      try { s[key.slice(3)] = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    }
  }
  return s;
}
