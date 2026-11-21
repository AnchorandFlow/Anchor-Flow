// tests/visual/harness/main.jsx — boots the real App (src/App.jsx) signed in
// against a stubbed Supabase (see ../vite.config.mjs), with fixed household
// data and a pinned clock, opens one tab, then walks a list of steps
// (click a sub-section, snapshot) and writes every snapshot into
// <script id="__capture"> for capture.mjs to read from Chrome's --dump-dom.
//
// URL params: tab=<HomeFlow tab id> | vault:<AnchorVault section>  hh=beta|other
//             steps=<json [[label, clickText|null], ...]>  (clickText "@h2:Cleaning" =
//             the <h2> whose text is exactly "Cleaning"; "#some-id" = the element
//             with data-testid="some-id")
//             anchor=1 (seed the Anchor full-view data)  emojis=1 (household
//             showEmojis on)  exhale=1 (seed Exhale bucket items)  plus=1 (cached Plus entitlement)  scope=root
//             (snapshot the whole app, not just the tab panel)  shot=1 (no
//             capture, for screenshots)
/* eslint-disable react-refresh/only-export-components -- harness entry, not a component module */
import { FIXED_NOW, BETA_HH, OTHER_HH, MY_PERSON_ID, AUTH_USER_ID, householdData, safeHarborWithItems } from "../fixtures.js";
import { DEFAULT_GRAB_ITEMS } from "../../../src/shell/safe-harbor-migrate.js";

var params = new URLSearchParams(location.search);

// ── Pinned clock: FIXED_NOW plus elapsed page time ─────────────────────────
var RealDate = Date;
var t0 = performance.now();
// hour=<0-23> moves the pinned clock to that hour on the same day (e.g. 19
// for the evening Sunset card); default 09:00.
var hourShift = params.get("hour") ? (parseInt(params.get("hour"), 10) - 9) * 3600000 : 0;
function nowMs() { return FIXED_NOW + hourShift + Math.floor(performance.now() - t0); }
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
  // gcal=1: a stand-in Google Calendar API (gcal=401: Google rejects the token).
  if (params.get("gcal") && url.indexOf("https://www.googleapis.com/calendar/v3/") === 0) return harnessGoogle(url);
  if (params.get("gcal") && url.indexOf("/functions/v1/google-calendar") !== -1) return harnessGoogleFn(init);
  // hhsync=1: household REST calls go to the dev server's in-memory row (/__hh).
  var sb = url.indexOf(".supabase.co/rest/v1/");
  if (params.get("hhsync") === "1" && sb !== -1) { var hi = Object.assign({}, init || {}); hi.headers = Object.assign({}, (init && init.headers) || {}, { "x-harness-me": params.get("me") || "" }); return realFetch("/__hh" + url.slice(url.indexOf("/rest/v1/")), hi); }
  if (local && !api) return realFetch(input, init);
  return Promise.reject(new TypeError("harness: network disabled"));
};

// ── gcal=1: Google Identity Services + Calendar API stand-ins ─────────────
function harnessJson(v, status) { return Promise.resolve(new Response(JSON.stringify(v), { status: status || 200, headers: { "Content-Type": "application/json" } })); }
function harnessGoogle(url) {
  if (params.get("gcal") === "401") return harnessJson({ error: { code: 401, message: "Invalid Credentials" } }, 401);
  if (url.indexOf("/users/me/calendarList") !== -1) return harnessJson({ items: [
    { id: "lindsey@example.com", primary: true, summary: "Lindsey", backgroundColor: "#9fc6e7", selected: true },
    { id: "family123@group.calendar.google.com", summary: "Family", backgroundColor: "#7bd148", selected: true },
    { id: "holidays@group.v.calendar.google.com", summary: "Holidays (unticked)", backgroundColor: "#ff887c", selected: false },
  ] });
  function at(d, h, m) { return new RealDate(2026, 10, d, h, m).toISOString(); }
  if (url.indexOf("/calendars/lindsey%40example.com/events") !== -1) return harnessJson({ items: [
    { id: "g1", summary: "Dentist (Google)", start: { dateTime: at(13, 18, 30) }, end: { dateTime: at(13, 19, 30) } },
    { id: "g2", summary: "Book club (Google)", start: { dateTime: at(18, 19, 0) }, end: { dateTime: at(18, 20, 0) } },
  ] });
  if (url.indexOf("/calendars/family123") !== -1) return harnessJson({ items: [
    { id: "g3", summary: "Grandparents visiting (Google)", start: { date: "2026-11-20" }, end: { date: "2026-11-23" } },
  ] });
  if (url.indexOf("/calendars/holidays") !== -1) return harnessJson({ items: [{ id: "g4", summary: "SHOULD NOT SHOW", start: { date: "2026-11-26" }, end: { date: "2026-11-27" } }] });
  return harnessJson({ items: [] });
}
// The google-calendar Edge Function stand-in (refresh token stays "server-side":
// here, nowhere at all). gcal=401: the stored connection was revoked in Google;
// gcal=norefresh: Google didn't return a refresh token on the exchange.
var harnessFnCalls = [];
window.__harnessFnCalls = harnessFnCalls;
function harnessGoogleFn(init) {
  var body = {}; try { body = JSON.parse((init && init.body) || "{}"); } catch { body = {}; }
  harnessFnCalls.push(body.action);
  var mode = params.get("gcal");
  var ok = { access_token: "harness-google-token", expires_in: 3599, account: "lindsey@example.com" };
  if (body.action === "exchange") return mode === "norefresh" ? harnessJson({ error: "no_refresh_token" }, 409) : harnessJson(ok);
  if (body.action === "token") return mode === "401" ? harnessJson({ error: "reconnect" }, 401) : harnessJson(ok);
  if (body.action === "disconnect") return harnessJson({ ok: true });
  if (body.action === "status") return harnessJson({ connected: mode !== "401", account: "lindsey@example.com" });
  return harnessJson({ error: "unknown_action" }, 400);
}
if (params.get("gcal")) {
  window.google = { accounts: { oauth2: {
    initCodeClient: function (cfg) { return { requestCode: function () { setTimeout(function () { cfg.callback({ code: "harness-auth-code" }); }, 50); } }; },
    initTokenClient: function (cfg) { return { requestAccessToken: function () { setTimeout(function () { cfg.callback({ access_token: "harness-google-token", expires_in: 3599 }); }, 50); } }; },
    revoke: function (t, cb) { if (cb) cb(); },
  } } };
}

// ── Seed storage ───────────────────────────────────────────────────────────
var hh = params.get("hh") === "beta" ? BETA_HH : OTHER_HH;
// hhsync=1: a sync pull reloads the page — keep what this device already has
// (seed once per tab session) instead of re-seeding over the pulled data.
var reseed = !(params.get("hhsync") === "1" && sessionStorage.getItem("harness_seeded") === "1");
if (reseed) {
localStorage.clear();
sessionStorage.clear();
var anchor = params.get("anchor") === "1";
var data = householdData(hh, { anchor: anchor });
if (anchor) data.safe_harbor = safeHarborWithItems(DEFAULT_GRAB_ITEMS);
if (params.get("emojis") === "1") data.showEmojis = true;
Object.keys(data).forEach(function (k) {
  if (data[k] === null) return;
  localStorage.setItem("af_" + k, JSON.stringify(data[k]));
});
if (params.get("exhale") === "1") localStorage.setItem("af_exhale_buckets", JSON.stringify({ bucketNames: ["Exhaled", "Today", "Tomorrow", "This Weekend", "Someday"], items: [
  { id: "x1", text: "Look into piano lessons for Ava", notes: "", bucketIndex: 0, createdAt: FIXED_NOW, color: "#4A9E8E" },
  { id: "x2", text: "Call the vet about Biscuit's rash", notes: "Ask if they have Saturday hours", dueDate: "2026-11-13", personId: data.people && data.people[0] ? data.people[0].id : "", bucketIndex: 1, createdAt: FIXED_NOW, color: "#6ABAAA" },
  { id: "x3", text: "Sign the field trip permission slip", notes: "", dueDate: "2026-11-12", personId: "everyone", bucketIndex: 1, createdAt: FIXED_NOW, color: "#6ABAAA" },
  { id: "x4", text: "Return library books", notes: "", bucketIndex: 1, createdAt: FIXED_NOW, color: "#6ABAAA", done: true },
  { id: "x5", text: "Order the birthday cake", notes: "", dueDate: "2026-11-14", bucketIndex: 2, createdAt: FIXED_NOW, color: "#7AB3D4" },
  { id: "x6", text: "Clean out the garage", notes: "", personId: data.people && data.people[1] ? data.people[1].id : "", bucketIndex: 3, createdAt: FIXED_NOW, color: "#8BAF8B" },
  { id: "x7", text: "Plan a spring trip to the coast", notes: "", bucketIndex: 4, createdAt: FIXED_NOW, color: "#A99AC4" },
  { id: "x8", text: "Repaint the back fence", notes: "", bucketIndex: 4, createdAt: FIXED_NOW, color: "#A99AC4" },
] }));
// seed={"trips":[...],"pets":[]} overrides af_<key> after the fixtures.
try { var seed = JSON.parse(params.get("seed") || "null"); if (seed) Object.keys(seed).forEach(function (k) { localStorage.setItem("af_" + k, JSON.stringify(seed[k])); }); } catch { /* ignore */ }
if (params.get("plus") === "1") localStorage.setItem("af_entitlement", JSON.stringify({ entitled: true, plan: "plus", status: "active" }));
// Raw (non-JSON) strings, the way the app itself stores these.
localStorage.setItem("af_choreResetDate", "2026-11-13");
// me=<person id> signs this device in as that household member (default Lindsey).
localStorage.setItem("af_myPersonId", params.get("me") || MY_PERSON_ID);
localStorage.setItem("af_myPersonId_authUserId", AUTH_USER_ID);
localStorage.setItem("af_supabase_session", JSON.stringify({ access_token: "harness-token" }));
// "vault:<section>" opens the AnchorVault overlay on that section (Today
// underneath); anything else is a HomeFlow tab.
var tabParam = params.get("tab") || "anchor";
var vaultSection = tabParam.indexOf("vault:") === 0 ? tabParam.slice(6) : null;
sessionStorage.setItem("af_activeTab", vaultSection ? "anchor" : tabParam);
if (vaultSection) { sessionStorage.setItem("af_showAnchor", "1"); sessionStorage.setItem("af_vaultSection", vaultSection); }
// hhsync=1&t0=<server updated_at>: this device last synced at t0.
if (params.get("hhsync") === "1") { if (params.get("t0")) localStorage.setItem("af_lastHHSync", params.get("t0")); sessionStorage.setItem("harness_seeded", "1"); }
}

var steps = [];
try { steps = JSON.parse(params.get("steps") || "[]"); } catch { steps = []; }

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function root() { return document.getElementById("root"); }

// The visible HomeFlow tab panel (display:block among the tab panels), or the
// whole root when it can't be found.
var panelOverride = null;
function panel() {
  if (panelOverride) return panelOverride;
  if (vaultSection) return document.querySelector('.af-vault, [data-testid="redesign-anchor"]') || root();
  var tab = params.get("tab");
  var el = document.querySelector('[data-harness-tab="' + tab + '"]');
  if (el) return el;
  var candidates = Array.from(root().querySelectorAll('div[style*="display: block"]'));
  for (var i = 0; i < candidates.length; i++) {
    var p = candidates[i].parentElement;
    if (p && p.style && (p.style.maxWidth === "1100px" || p.style.maxWidth === "1200px")) return candidates[i];
  }
  return root();
}

function findClickable(label) {
  // "^#id" / "^Text": look in the whole page (overlays such as Sunset sit
  // outside the tab panel).
  if (label.charAt(0) === "^") { var saved = panelOverride; panelOverride = root(); try { return findClickable(label.slice(1)); } finally { panelOverride = saved; } }
  if (label.charAt(0) === "#") return panel().querySelector('[data-testid="' + label.slice(1) + '"]');
  var tagged = /^@([a-z0-9]+):(.*)$/.exec(label);
  if (tagged) {
    return Array.from(panel().querySelectorAll(tagged[1])).filter(function (e) { return (e.textContent || "").replace(/\s+/g, " ").trim() === tagged[2]; })[0] || null;
  }
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

// fonts=1: type audit of everything visible on the page (tab panel, nav,
// footer, overlays). For each element that holds its own text: the first
// font family the browser resolved from its stack, size, weight, style.
function fontAudit() {
  var vw = document.documentElement.clientWidth, vh = window.innerHeight;
  var rows = [];
  Array.from(document.body.querySelectorAll("*")).forEach(function (el) {
    if (/^(SCRIPT|STYLE|svg|path|circle)$/i.test(el.tagName)) return;
    var own = Array.from(el.childNodes).filter(function (n) { return n.nodeType === 3 && n.textContent.trim(); }).map(function (n) { return n.textContent.trim(); }).join(" ");
    var isField = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
    if (!own && !isField) return;
    if (isField) own = "[" + el.tagName.toLowerCase() + "] " + (el.value || el.placeholder || "");
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || +cs.opacity === 0) return;
    for (var e = el; e; e = e.parentElement) { var c2 = getComputedStyle(e); if (c2.display === "none") return; }
    var fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    var tidEl = el.closest("[data-testid]");
    rows.push({ tid: tidEl ? tidEl.getAttribute("data-testid") : "", cls: (el.closest("[class]") || {}).className || "", fam: fam, size: parseFloat(cs.fontSize), weight: cs.fontWeight, italic: cs.fontStyle === "italic", tag: el.tagName.toLowerCase(), text: own.replace(/\s+/g, " ").slice(0, 40), wraps: r.height > parseFloat(cs.lineHeight || 0) * 1.6 && cs.whiteSpace === "nowrap", over: el.scrollWidth > el.clientWidth + 1 && (cs.overflow === "hidden" || cs.textOverflow === "ellipsis") });
  });
  return { width: vw, height: vh, rows: rows };
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
    if (click && click.indexOf("!focus:") === 0) {
      // "!focus:<css selector>" focuses an element (keyboard focus ring check)
      var fe = document.querySelector(click.slice(7));
      if (!fe) { errors.push("not found: " + click); continue; }
      fe.focus();
      await wait(300);
    } else if (click && click.indexOf("!scroll:") === 0) {
      // "!scroll:<css selector>" scrolls the element (or its scroll box) to its end
      var se = document.querySelector(click.slice(8));
      if (se) { se.scrollTop = se.scrollHeight; } else { window.scrollTo(0, document.body.scrollHeight); }
      await wait(300);
    } else if (click && click.indexOf("!scrollby:") === 0) {
      // "!scrollby:<css selector>|<px>" scrolls that box (or the page) by px
      var sb2 = /^!scrollby:([^|]+)\|(-?\d+)$/.exec(click);
      var sbe = sb2 && document.querySelector(sb2[1]);
      if (sbe) sbe.scrollTop += +sb2[2]; else if (sb2) window.scrollBy(0, +sb2[2]);
      await wait(300);
    } else if (click && click.indexOf("!wait:") === 0) {
      await wait(parseInt(click.slice(6), 10) || 0); // "!wait:<ms>" (e.g. for a sync push/poll)
    } else if (click && click.indexOf("!type:") === 0) {
      // "!type:<css selector>|<text>" focuses the field and types into it the
      // way a keyboard does (input events, focus stays in the field — no blur).
      var tm = /^!type:([^|]+)\|(.*)$/.exec(click);
      var te = tm && document.querySelector(tm[1]);
      if (!te) { errors.push("not found: " + click); continue; }
      te.focus();
      var proto = te.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(te, tm[2]);
      te.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(300);
    } else if (click && click.indexOf("!event:") === 0) {
      // "!event:<name>:<json detail>" dispatches a window event (e.g. the
      // in-app confirm, which no harness screen opens by itself)
      var ev = /^!event:([a-z-]+):(.*)$/.exec(click);
      window.dispatchEvent(new CustomEvent(ev[1], { detail: JSON.parse(ev[2] || "{}") }));
      await wait(500);
    } else if (click) {
      var el = findClickable(click);
      if (!el) { errors.push("not found: " + click); continue; }
      el.click();
      await wait(500);
    }
    out[label] = params.get("fonts") === "1" ? fontAudit() : params.get("measure") === "1" ? measure() : (params.get("scope") === "root" ? root().innerHTML : panel().innerHTML);
  }
  if (params.get("shot") === "1") { document.title = "READY"; return; }
  if ((params.get("measure") === "1" || params.get("fonts") === "1") && window.parent !== window) {
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
