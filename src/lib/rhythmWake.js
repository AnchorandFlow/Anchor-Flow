// src/lib/rhythmWake.js — keep the screen awake while a Rhythm timer runs.
// Screen Wake Lock API, best effort only: feature-detected, every call in
// try/catch, every promise rejection swallowed. Unsupported browsers and
// in-app webviews simply get no lock; the timer never depends on it.
//
// Usage: var wake = createScreenWake(); wake.want(true|false); wake.dispose();
// want(true) requests the lock; want(false) releases it. The browser drops the
// lock whenever the tab is hidden, so while wanted it is re-requested on
// visibilitychange once the page is visible again.
// nav / doc are injectable for tests (default: navigator / document).
export function createScreenWake(nav, doc) {
  var n = nav || (typeof navigator !== "undefined" ? navigator : null);
  var d = doc || (typeof document !== "undefined" ? document : null);
  var supported = !!(n && n.wakeLock && typeof n.wakeLock.request === "function");
  var wanted = false, sentinel = null, pending = false, disposed = false;

  function release() {
    var s = sentinel;
    sentinel = null;
    if (!s) return;
    try {
      var p = s.release();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch { /* already released */ }
  }

  function acquire() {
    if (!supported || disposed || !wanted || sentinel || pending) return;
    if (d && d.visibilityState && d.visibilityState !== "visible") return;
    pending = true;
    var p;
    try { p = n.wakeLock.request("screen"); } catch { pending = false; return; }
    if (!p || typeof p.then !== "function") { pending = false; return; }
    p.then(function (s) {
      pending = false;
      if (!s) return;
      if (!wanted || disposed) { sentinel = s; release(); return; }
      sentinel = s;
      try {
        if (typeof s.addEventListener === "function") {
          s.addEventListener("release", function () { if (sentinel === s) sentinel = null; });
        }
      } catch { /* ignore */ }
    }, function () { pending = false; /* denied, battery saver, not visible… */ });
  }

  function onVisible() {
    if (d && d.visibilityState === "visible" && wanted) acquire();
  }
  if (supported && d && typeof d.addEventListener === "function") {
    try { d.addEventListener("visibilitychange", onVisible); } catch { /* ignore */ }
  }

  return {
    supported: supported,
    want: function (on) {
      wanted = !!on;
      if (wanted) acquire(); else release();
    },
    held: function () { return !!sentinel; },
    dispose: function () {
      wanted = false; disposed = true;
      release();
      if (supported && d && typeof d.removeEventListener === "function") {
        try { d.removeEventListener("visibilitychange", onVisible); } catch { /* ignore */ }
      }
    },
  };
}
