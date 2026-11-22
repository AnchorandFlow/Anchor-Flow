// src/lib/seoRobots.js — search-engine visibility for the single-page app.
// The static index.html is the public entry / sign-in screen and stays
// indexable. Once someone is signed in, every screen is private household
// data, so we flip robots to noindex (and keep the generic title).
export var PUBLIC_ROBOTS = "index, follow, max-image-preview:large";
export var PRIVATE_ROBOTS = "noindex, nofollow";
export var PUBLIC_TITLE = "Anchor & Flow — Sign In to Your Family Planner";
export var PRIVATE_TITLE = "Anchor & Flow";

export function applyRobotsForSession(signedIn, doc) {
  var d = doc || (typeof document !== "undefined" ? document : null);
  if (!d || !d.head) return;
  var m = d.head.querySelector('meta[name="robots"]');
  if (!m) { m = d.createElement("meta"); m.setAttribute("name", "robots"); d.head.appendChild(m); }
  m.setAttribute("content", signedIn ? PRIVATE_ROBOTS : PUBLIC_ROBOTS);
  d.title = signedIn ? PRIVATE_TITLE : PUBLIC_TITLE;
}
