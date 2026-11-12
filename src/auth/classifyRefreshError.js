// Pure decision function for refreshAuthToken()'s failure path (App.jsx).
// refreshSession() either resolves with { error } or throws — either way the
// caller ends up with an error value to classify here:
//
//   "ok"     — no error. Refresh actually succeeded.
//   "retry"  — looks transient (offline, request never reached the server).
//              The same refresh may well succeed next time, so callers should
//              leave existing auth state alone and try again later, same as
//              today's behavior for a thrown network error.
//   "reauth" — a definitive rejection of the refresh token itself (revoked,
//              already used, malformed, or any other auth-level rejection).
//              Refreshing again will never succeed on its own — the user must
//              sign in again. Unrecognized error shapes default here too,
//              matching the pre-existing behavior of treating any resolved
//              refreshSession() error as a hard failure.
export function classifyRefreshError(err) {
  if (!err) return "ok";
  var msg = String((err && err.message) || err || "").toLowerCase();
  if (
    msg.indexOf("failed to fetch") !== -1 ||
    msg.indexOf("networkerror") !== -1 ||
    msg.indexOf("network request failed") !== -1 ||
    msg.indexOf("load failed") !== -1 ||
    msg.indexOf("timeout") !== -1 ||
    msg.indexOf("timed out") !== -1 ||
    msg.indexOf("offline") !== -1
  ) {
    return "retry";
  }
  return "reauth";
}
