// tests/visual/harness/main.jsx — boots the real App (src/App.jsx) signed in
// against a stubbed Supabase (see ../vite.config.mjs), with fixed household
// data and a pinned clock, opens one tab, then walks a list of steps
// (click a sub-section, snapshot) and writes every snapshot into
// <script id="__capture"> for capture.mjs to read from Chrome's --dump-dom.
//
// URL params: tab=<HomeFlow tab id>  hh=beta|other  steps=<json [[label, clickText|null], ...]>
//             emojis=1 (household showEmojis on)  shot=1 (no capture, for screenshots)
/* eslint-disable react-refresh/only-export-components -- harness entry, not a component module */
import { FIXED_NOW, BETA_HH, OTHER_HH, MY_PERSON_ID, AUTH_USER_ID, householdData } from "../fixtures.js";

var params = new URLSearchParams(location.search);

// ── Pinned clock: FIXED_NOW plus elapsed page time ─────────────────────────
var RealDate = Date;
var t0 = performance.now();
function nowMs() { return FIXED_NOW + Math.floor(performance.now() - t0); }
function FakeDate(...args) {
  if (!new.target) return new RealDate(nowMs()).toString();
  return args.length ? new RealDate(...args) : new RealDate(nowMs());
}
FakeDate.prototype = RealDate.prototype;
FakeDate.now = nowMs;
FakeDate.parse = RealDate.parse;
FakeDate.UTC = RealDate.UTC;
globalThis.Date = FakeDate;

// ── No network beyond the dev server ───────────────────────────────────────
var realFetch = window.fetch.bind(window);
window.fetch = function (input, init) {
  var url = typeof input === "string" ? input : (input && input.url) || "";
  var local = url.indexOf(location.origin) === 0 || url.charAt(0) === "/";
  var api = url.indexOf("/api/") !== -1;
  if (local && !api) return realFetch(input, init);
  return Promise.reject(new TypeError("harness: network disabled"));
};

// ── Seed storage ───────────────────────────────────────────────────────────
var hh = params.get("hh") === "beta" ? BETA_HH : OTHER_HH;
localStorage.clear();
sessionStorage.clear();
var data = householdData(hh);
if (params.get("emojis") === "1") data.showEmojis = true;
Object.keys(data).forEach(function (k) {
  if (data[k] === null) return;
  localStorage.setItem("af_" + k, JSON.stringify(data[k]));
});
// Raw (non-JSON) strings, the way the app itself stores these.
localStorage.setItem("af_choreResetDate", "2026-11-13");
localStorage.setItem("af_myPersonId", MY_PERSON_ID);
localStorage.setItem("af_myPersonId_authUserId", AUTH_USER_ID);
localStorage.setItem("af_supabase_session", JSON.stringify({ access_token: "harness-token" }));
sessionStorage.setItem("af_activeTab", params.get("tab") || "anchor");

var steps = [];
try { steps = JSON.parse(params.get("steps") || "[]"); } catch { steps = []; }

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function root() { return document.getElementById("root"); }

// The visible HomeFlow tab panel (display:block among the tab panels), or the
// whole root when it can't be found.
function panel() {
  var tab = params.get("tab");
  var el = document.querySelector('[data-harness-tab="' + tab + '"]');
  if (el) return el;
  var candidates = Array.from(root().querySelectorAll('div[style*="display: block"]'));
  for (var i = 0; i < candidates.length; i++) {
    var p = candidates[i].parentElement;
    if (p && p.style && p.style.maxWidth === "1100px") return candidates[i];
  }
  return root();
}

function findClickable(label) {
  var els = Array.from(panel().querySelectorAll("button, [role=tab], div, span"));
  function txt(e) { return (e.textContent || "").replace(/\s+/g, " ").trim(); }
  var exact = els.filter(function (e) { return txt(e) === label; });
  var loose = els.filter(function (e) { var t = txt(e); return t.length <= label.length + 4 && t.slice(-label.length) === label; });
  var list = exact.length ? exact : loose;
  // innermost-but-clickable: prefer buttons, then the deepest match
  var btn = list.filter(function (e) { return e.tagName === "BUTTON" || e.getAttribute("role") === "tab"; });
  return (btn[0] || list[list.length - 1]) || null;
}

// measure=1: layout check for the redesigned screens. Reports anything that
// sticks out sideways: elements past the full-view page's content box (or,
// for fixed overlays, past the viewport), containers that scroll sideways,
// and document-level horizontal overflow.
function measure() {
  var p = panel();
  var page = p.querySelector('[data-redesign="full-view"]') || p;
  var box = page.getBoundingClientRect();
  var vw = document.documentElement.clientWidth;
  var out = [];
  function inFixed(el) { for (var e = el; e && e !== page; e = e.parentElement) { if (getComputedStyle(e).position === "fixed") return true; } return false; }
  function hidden(el) { for (var e = el; e && e !== page; e = e.parentElement) { var cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return true; } return false; }
  function describe(el, why) { var r = el.getBoundingClientRect(); return { why: why, tag: el.tagName.toLowerCase(), text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50), left: Math.round(r.left), right: Math.round(r.right), limit: Math.round(box.right) }; }
  Array.from(page.querySelectorAll("*")).forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height || hidden(el)) return;
    var cs = getComputedStyle(el);
    if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) out.push(describe(el, "scrolls sideways"));
    if (inFixed(el)) { if (r.right > vw + 1 || r.left < -1) out.push(describe(el, "past viewport")); return; }
    if (r.right > box.right + 1 || r.left < box.left - 1) out.push(describe(el, "past page edge"));
  });
  var doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) out.push({ why: "document scrolls sideways", scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth });
  return { width: vw, pageWidth: Math.round(box.width), offenders: out.slice(0, 20), count: out.length };
}

async function run() {
  var { default: App } = await import("../../../src/App.jsx");
  var { StrictMode } = await import("react");
  var { createRoot } = await import("react-dom/client");
  await import("../../../src/index.css");
  createRoot(root()).render(<StrictMode><App /></StrictMode>);
  await wait(2500);
  var out = {};
  var errors = [];
  for (var i = 0; i < steps.length; i++) {
    var label = steps[i][0], click = steps[i][1];
    if (click) {
      var el = findClickable(click);
      if (!el) { errors.push("not found: " + click); continue; }
      el.click();
      await wait(500);
    }
    out[label] = params.get("measure") === "1" ? measure() : panel().innerHTML;
  }
  if (params.get("shot") === "1") { document.title = "READY"; return; }
  if (params.get("measure") === "1" && window.parent !== window) {
    window.parent.postMessage({ harnessCapture: encodeURIComponent(JSON.stringify({ snapshots: out, errors: errors })) }, "*");
  }
  var s = document.createElement("script");
  s.type = "application/json";
  s.id = "__capture";
  s.textContent = encodeURIComponent(JSON.stringify({ snapshots: out, errors: errors }));
  document.body.appendChild(s);
  document.title = "DONE";
}
run().catch(function (e) {
  var s = document.createElement("script");
  s.type = "application/json"; s.id = "__capture";
  s.textContent = encodeURIComponent(JSON.stringify({ fatal: String(e && e.stack || e) }));
  document.body.appendChild(s);
});
