// src/onboarding/preview.js — ?preview=onboarding: shows the redesigned
// onboarding to a beta household (af_redesign eligible) without changing
// anything. The host renders the wizard with completion handlers that only
// close the preview, so no answer is ever saved or synced.
export var PREVIEW_PARAM = "preview";
export var PREVIEW_ONBOARDING = "onboarding";

// search: location.search; eligible: getRedesignState().eligible
export function wantsOnboardingPreview(search, eligible) {
  if (!eligible) return false;
  try { return new URLSearchParams(search || "").get(PREVIEW_PARAM) === PREVIEW_ONBOARDING; } catch { return false; }
}

// Drop ?preview=onboarding from the address bar (so a reload doesn't reopen
// it), keeping every other parameter and the hash.
export function clearPreviewParam(win) {
  var w = win || (typeof window !== "undefined" ? window : null);
  if (!w || !w.history || !w.location) return;
  try {
    var u = new URL(w.location.href);
    if (!u.searchParams.has(PREVIEW_PARAM)) return;
    u.searchParams.delete(PREVIEW_PARAM);
    w.history.replaceState(w.history.state, "", u.pathname + u.search + u.hash);
  } catch { /* leave the URL */ }
}
