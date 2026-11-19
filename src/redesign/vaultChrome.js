// src/redesign/vaultChrome.js — af_redesign Vault cleanup helpers.
//
// VaultChromeContext is provided only by VaultFull (the redesigned Vault), so
// a Vault section body reads null under the flag-off shell and renders exactly
// as before. Inside the redesign it gets { showEmojis }, and:
//   - drops its own repeated heading + description line (the selected pill
//     already names the section); the description moves into the empty state
//   - drops decorative marks that read as stray dots / characters on the new
//     light cards (status dots, faint "▾" glyphs, empty emoji circles)
import { createContext, useContext } from "react";

export var VaultChromeContext = createContext(null);
export function useVaultChrome() { return useContext(VaultChromeContext); }

// Each section's description, shown in its empty state under the redesign.
export var VAULT_DESCRIPTIONS = {
  trips: "Every trip you're planning or have taken — dates, destination, and status at a glance.",
  pets: "Health records, vaccines, medications and tags — all in one place.",
  systems: "Track maintenance schedules for every part of your home.",
  recurring: "Set it once, never forget it again.",
  subs: "Track what you pay, save & earn.",
};

var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function parts(d) {
  if (typeof d !== "string") return null;
  var p = d.split("-");
  if (p.length !== 3 || p[0].length !== 4) return null;
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10), day = parseInt(p[2], 10);
  if (!y || !m || !day || m > 12) return null;
  return { y: y, m: m, d: day };
}

// "Jun 12–18, 2026" · "Jun 28 – Jul 3, 2026" · "Dec 30, 2026 – Jan 2, 2027"
// · "Jun 12, 2026". "" when neither date is usable.
export function formatTripRange(start, end) {
  var s = parts(start), e = parts(end);
  if (!s && !e) return "";
  if (!s || !e) { var one = s || e; return MONTHS[one.m - 1] + " " + one.d + ", " + one.y; }
  if (s.y === e.y && s.m === e.m && s.d === e.d) return MONTHS[s.m - 1] + " " + s.d + ", " + s.y;
  if (s.y === e.y && s.m === e.m) return MONTHS[s.m - 1] + " " + s.d + "–" + e.d + ", " + s.y;
  if (s.y === e.y) return MONTHS[s.m - 1] + " " + s.d + " – " + MONTHS[e.m - 1] + " " + e.d + ", " + s.y;
  return MONTHS[s.m - 1] + " " + s.d + ", " + s.y + " – " + MONTHS[e.m - 1] + " " + e.d + ", " + e.y;
}

function dayDiff(d, today) {
  var p = parts(d);
  if (!p) return null;
  var t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(p.y, p.m - 1, p.d) - t) / 86400000);
}

// The status pill on a trip card: "Upcoming" | "In progress" | "Past" |
// "Cancelled". Completed (status) or ended (dates) trips are Past; a trip
// with no dates is Upcoming (still being planned). `away` is the days until
// the start for an upcoming dated trip, else null.
export function tripTiming(trip, today) {
  var now = today || new Date();
  var t = trip || {};
  if (t.status === "Cancelled") return { label: "Cancelled", past: true, away: null };
  if (t.status === "Completed") return { label: "Past", past: true, away: null };
  var start = dayDiff(t.startDate, now), end = dayDiff(t.endDate, now);
  if (start === null && end === null) return { label: "Upcoming", past: false, away: null };
  var s = start !== null ? start : end;
  var e = end !== null ? end : start;
  if (e < 0) return { label: "Past", past: true, away: null };
  if (s <= 0) return { label: "In progress", past: false, away: null };
  return { label: "Upcoming", past: false, away: s };
}
