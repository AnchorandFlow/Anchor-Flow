// src/lib/friendlyError.js — one place that turns any thrown error into a
// plain, user-facing sentence with a next step.
//
//   friendlyError(err, "save")      → "Couldn't save — check your connection and try again."
//   friendlyError(err, "compass")   → "Compass is busy right now — try again in a minute."
//
// Rules: never put err.message, JSON bodies, status codes or stack text on the
// screen. The raw detail goes to console.warn only (tagged "[AF <context>]").
// Use it for every new error message instead of showing err.message.

// What kind of failure is this? Looks at status, name, and (only for
// classification, never display) the message text.
export function errorKind(err) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  var e = err || {};
  var status = Number(e.status || e.statusCode || (e.context && e.context.status)) || 0;
  var code = "";
  var msg = String(e.message || (typeof err === "string" ? err : "") || "");
  try { var b = JSON.parse(msg); if (b && typeof b === "object") { code = String(b.error || b.error_code || b.code || ""); if (!status && b.status) status = Number(b.status) || 0; msg = String(b.msg || b.message || b.error_description || b.error || msg); } } catch { /* not JSON */ }
  var m = (code + " " + msg).toLowerCase();
  if (e.name === "AbortError" || /timed? ?out|timeout/.test(m)) return "timeout";
  if (status === 413 || /too large|payload|file size|exceeds/.test(m)) return "tooLarge";
  if (e.name === "QuotaExceededError" || /quota/.test(m)) return "storageFull";
  if (status === 429 || /rate.?limit|too many|overloaded|busy|breather/.test(m)) return "busy";
  if (code === "reconnect" || /invalid_grant|token.*(expired|revoked)/.test(m) && /google/.test(m)) return "reconnect";
  if (status === 401 || /jwt|unauthori[sz]ed|not signed in|session.*expired|sign in again|unauthenticated/.test(m)) return "auth";
  if (status === 403 || /forbidden|permission|row-level security|rls/.test(m)) return "forbidden";
  if (/invalid login|invalid_credentials|invalid email or password/.test(m)) return "badLogin";
  if (/email not confirmed/.test(m)) return "unconfirmed";
  if (/already (registered|been registered|exists)|user already/.test(m)) return "exists";
  if (/password/.test(m) && /(weak|short|least|characters|strength)/.test(m)) return "weakPassword";
  if (/card|declined|payment|stripe/.test(m) && status !== 500) return "payment";
  if (status === 404) return "notFound";
  if (e.name === "TypeError" || /failed to fetch|networkerror|network request failed|load failed|err_internet/.test(m)) return "network";
  if (status >= 500 || /server_error|refresh_failed|internal/.test(m)) return "server";
  return "unknown";
}

var BY_KIND = {
  offline: "You're offline — reconnect to the internet and try again.",
  network: "Couldn't connect — check your connection and try again.",
  timeout: "That took too long — check your connection and try again.",
  busy: "Things are busy right now — try again in a minute.",
  server: "Something went wrong on our end — try again in a few minutes.",
  auth: "Your sign-in expired — sign in again to continue.",
  forbidden: "You don't have access to that — check you're signed in to the right household.",
  reconnect: "Google sign-in expired — tap Reconnect.",
  tooLarge: "That file is too large — try a smaller photo or file.",
  storageFull: "This device is out of space for Anchor & Flow — free up some storage, then try again.",
  notFound: "We couldn't find that — refresh and try again.",
  badLogin: "Incorrect email or password — check them and try again.",
  unconfirmed: "Please confirm your email first — check your inbox for the link.",
  exists: "This email already has an account — use Sign In instead.",
  weakPassword: "That password is too weak — use at least 8 characters with a mix of letters and numbers.",
  payment: "Your payment didn't go through — check your card details and try again.",
  unknown: "Something went wrong — try again.",
};

// Context-specific wording; falls back to BY_KIND, then the context default.
var BY_CONTEXT = {
  save: { _: "Couldn't save — check your connection and try again.", network: "Couldn't save — check your connection and try again.", offline: "Couldn't save — you're offline. Reconnect and try again." },
  sync: { _: "Couldn't sync — your changes are safe on this device. Try again in a minute.", network: "Sync paused — you're offline or the connection dropped. It'll retry when you're back online.", offline: "Sync paused — you're offline. It'll retry when you're back online.", auth: "Your sign-in expired — sign in again to keep syncing." },
  signin: { _: "Couldn't sign you in — try again in a minute.", network: "Couldn't reach Anchor & Flow — check your connection and try again.", forbidden: "Couldn't sign you in — try again in a minute." },
  signup: { _: "Couldn't create your account — try again in a minute.", network: "Couldn't reach Anchor & Flow — check your connection and try again." },
  reset: { _: "Couldn't send the reset email — check the address and try again." },
  checkout: { _: "Couldn't open checkout — try again in a minute. You haven't been charged.", auth: "Please sign in again, then tap Upgrade.", network: "Couldn't open checkout — check your connection and try again. You haven't been charged." },
  billing: { _: "Couldn't open billing — try again in a minute.", auth: "Please sign in again, then open billing." },
  compass: { _: "Compass couldn't answer just now — try again in a minute.", busy: "Compass is busy right now — try again in a minute.", server: "Compass is busy right now — try again in a minute.", auth: "Please sign in again to use Compass.", network: "Compass couldn't connect — check your connection and try again." },
  upload: { _: "Couldn't add that file — try again, or pick a different photo.", network: "Couldn't upload — check your connection and try again." },
  restore: { _: "Couldn't read that backup file — make sure it's an Anchor & Flow backup (.json) and try again." },
  gcal: { _: "Couldn't sync Google Calendar — try Sync now again.", auth: "Google sign-in expired — tap Reconnect.", forbidden: "Google sign-in expired — tap Reconnect.", server: "Google Calendar is having trouble right now — try Sync now again in a few minutes.", network: "Couldn't reach Google Calendar — check your connection and try Sync now again." },
  household: { _: "Couldn't update your household — try again in a minute.", notFound: "That household code didn't match — check it and try again." },
  notifications: { _: "Couldn't turn on notifications — try again, or check notification settings for this site." },
  import: { _: "Couldn't import that recipe — check the link, or add it by hand." },
};

export function friendlyMessage(err, context) {
  // Errors we wrote ourselves can carry a ready-made line (see userError).
  if (err && typeof err.userMessage === "string" && err.userMessage) return err.userMessage;
  var kind = errorKind(err);
  var c = BY_CONTEXT[context] || {};
  return c[kind] || (kind !== "unknown" && kind !== "server" && BY_KIND[kind]) || c._ || BY_KIND[kind] || BY_KIND.unknown;
}

// The one to call: logs the raw detail to the console, returns the friendly line.
export function friendlyError(err, context) {
  try {
    console.warn("[AF " + (context || "error") + "]", errorKind(err), err && err.status ? "status " + err.status : "", err && err.message !== undefined ? err.message : err);
  } catch { /* console unavailable */ }
  return friendlyMessage(err, context);
}

// Throw this when you already have the right words for the person.
export function userError(message, extra) {
  var e = new Error(message);
  e.userMessage = message;
  if (extra) Object.assign(e, extra);
  return e;
}

export default friendlyError;
