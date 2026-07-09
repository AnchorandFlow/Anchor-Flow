const AF_DEBUG = false; // flip to true when debugging
import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from "react";
import ExhaleSection from './components/ExhaleSection.jsx';
import { askFamily } from "./compass/compassEngine";
import TodayBriefing from "./shell/TodayBriefing";
import CompassFab from "./shell/CompassFab";
import DinnerCard from "./shell/DinnerCard";
import NudgeStrip from "./shell/NudgeStrip";
import WeeklyReviewCard from "./shell/WeeklyReviewCard";
import PrepCard from "./shell/PrepCard";
import SunsetClose from "./shell/SunsetClose";
import FlowHome from "./shell/FlowHome";
import RippleTab from "./components/RippleTab";
import AnchorVault from "./components/AnchorVault";
import RecipesTab from "./components/RecipesTab";
import { supabase } from "./lib/supabase"
import AuthScreen from "./components/AuthScreen"
import { SYNC_KEYS, MEAL_DAYS, sanitizeHouseholdData, clearZombieAuthKeys, errorCode, applyHouseholdKey } from "./sync-core.js"
import { BUILD_STAMP } from "./buildStamp.js"

// ── Ripple: day-after relationship notification hook ──────────────────────────
function useRippleNotifications() {
  const [notifications, setNotifications] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_pending_notifications');
      if (!error && data) setNotifications(data);
    } catch (e) {
      // Silently fail — feature is additive, never blocks the app
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10 * 60 * 1000); // re-check every 10 min
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const actionNotification = React.useCallback(async (notifId, action, touchpointType = null) => {
    // Optimistic — remove immediately so UI feels instant
    setNotifications(prev => prev.filter(n => n.id !== notifId));
    try {
      await supabase.rpc('action_notification', {
        notif_id: notifId,
        action,
        log_touchpoint: !['dismissed', 'snoozed'].includes(action),
        touchpoint_type: touchpointType ?? action,
        snooze_hours: 24,
      });
    } catch (e) {
      fetchNotifications(); // Re-sync on failure
    }
  }, [fetchNotifications]);

  return { notifications, actionNotification, loading };
}

// ── PWA push notification hook ───────────────────────────────────────────────
// VAPID public key — replace with your own from: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = "BKG2-qApAc3JjW9hBeAqKIOwE0ATMfoIksjGCrgd18bMWGC622J-JF-3PR0oNkXGxJ_eFYsaTvDZLkssZ8QSXJw";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

function usePushNotifications() {
  const [permission, setPermission] = React.useState(typeof Notification !== "undefined" ? Notification.permission : "default");
  const [subscribed, setSubscribed] = React.useState(false);
  const [subError, setSubError] = React.useState(null);

  const subscribe = React.useCallback(async () => {
    try {
      setSubError(null);
      if (!("serviceWorker" in navigator)) { setSubError("Service workers not supported."); return; }
      if (!("PushManager" in window)) { setSubError("Push not supported in this browser."); return; }
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") { setSubError("Permission denied — allow notifications in browser settings."); return; }
      const reg = await navigator.serviceWorker.ready;
      // Always unsubscribe first to force fresh subscription with current VAPID key
      let sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      // Use sbFetch (same as rest of app) — NOT supabase.from()
      const householdId = (() => { try { return JSON.parse(localStorage.getItem("af_householdId") || "null"); } catch { return null; } })();
      await sbFetch("/rest/v1/push_subscriptions", {
        method: "POST",
        headers: { "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          subscription_json: JSON.stringify(sub),
          household_id: householdId,
          user_agent: navigator.userAgent.slice(0, 200),
          updated_at: new Date().toISOString(),
        }),
      });
      setSubscribed(true);
      AF_DEBUG&&console.log("[AF] Push subscription saved ✓ household:", householdId);
    } catch(e) {
      console.error("[PWA] Push subscribe failed:", e);
      setSubError(e.message || "Something went wrong — try again.");
    }
  }, []);

  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub));
    });
    const onMessage = (e) => {
      if (e.data && e.data.type === "NOTIF_ACTION") {
        window.dispatchEvent(new CustomEvent("ripple-notif-action", { detail: e.data }));
      }
      if (e.data && e.data.type === "NOTIF_CLICK") {
        try { localStorage.setItem("af_open_ripple", "1"); } catch {}
        window.dispatchEvent(new CustomEvent("ripple-notif-action", { detail: e.data }));
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return { permission, subscribed, subscribe, subError };
}

// Action label → { action key, touchpoint type }
const RIPPLE_ACTION_MAP = {
  'Called her':       { action: 'called',   touchpoint: 'called' },
  'Called':           { action: 'called',   touchpoint: 'called' },
  'Texted':           { action: 'texted',   touchpoint: 'texted' },
  'Texted them':      { action: 'texted',   touchpoint: 'texted' },
  'Sent a gift':      { action: 'gifted',   touchpoint: 'gifted' },
  'Reached out':      { action: 'texted',   touchpoint: 'texted' },
  'Already sent one': { action: 'texted',   touchpoint: 'texted' },
  'Already on it':    { action: 'actioned', touchpoint: 'other'  },
  'I was there':      { action: 'visited',  touchpoint: 'visited'},
  'Log notes →':      { action: 'actioned', touchpoint: 'other'  },
  'All clear':        { action: 'actioned', touchpoint: 'other'  },
  'All good':         { action: 'dismissed',touchpoint: null     },
  'Skip':             { action: 'dismissed',touchpoint: null     },
  'Snooze 1 day':     { action: 'snoozed',  touchpoint: null     },
};

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function RippleNotificationBanner() {
  const { notifications, actionNotification } = useRippleNotifications();
  const { permission, subscribed, subscribe, subError } = usePushNotifications();
  const [notifBannerDismissed, setNotifBannerDismissed] = React.useState(function(){
    try { return localStorage.getItem('af_notifBannerDismissed') === '1'; } catch { return false; }
  });
  function dismissNotifBanner() {
    try { localStorage.setItem('af_notifBannerDismissed', '1'); } catch {}
    setNotifBannerDismissed(true);
  }

  const handleAction = (label) => {
    const notif = notifications[0];
    const mapped = RIPPLE_ACTION_MAP[label];
    if (!mapped || !notif) return;
    actionNotification(notif.id, mapped.action, mapped.touchpoint);
  };

  const notif = notifications[0];
  const hasMore = notifications.length > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 16px 0' }}>
      {/* Push opt-in prompt — shown once if not yet subscribed and not dismissed */}
      {!subscribed && permission !== 'denied' && !notifBannerDismissed && (
        <div style={{
          background: 'rgba(200,169,122,0.08)',
          border: '0.5px solid rgba(200,169,122,0.25)',
          borderRadius: 12,
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{flex:1}}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a38', fontFamily: 'DM Sans, sans-serif' }}>Get Compass on your phone</div>
            <div style={{ fontSize: 11, color: '#8a8a9a', fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>Morning briefing, midday check-in, dinner reminder & evening recap</div>
          </div>
          <button
            onClick={async function() {
              await subscribe();
              window.dispatchEvent(new CustomEvent('af-request-notif-permission'));
            }}
            style={{
              background: 'rgba(200,169,122,0.15)', border: '0.5px solid rgba(200,169,122,0.5)',
              borderRadius: 20, padding: '6px 14px', fontSize: 12, color: '#9a7a52',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
            }}
          >{subscribed ? '✓ On' : 'Turn on'}</button>
          <button onClick={dismissNotifBanner} aria-label="Dismiss" style={{background:'none',border:'none',cursor:'pointer',color:'#b0b0be',fontSize:18,lineHeight:1,padding:'2px 4px',flexShrink:0}}>×</button>
          {subError && <div style={{fontSize:10,color:'#c05050',marginTop:4,fontFamily:'DM Sans,sans-serif'}}>{subError}</div>}
        </div>
      )}

      {/* Notification card */}
      {notif && (
        <div style={{
          background: 'rgba(250,248,244,0.97)',
          border: '0.5px solid rgba(200,169,122,0.3)',
          borderRadius: 14,
          padding: '14px 16px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(200,169,122,0.15)', color: '#c8a97a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, flexShrink: 0, fontFamily: 'DM Sans, sans-serif',
            }}>
              {notif.person_name ? getInitials(notif.person_name) : '✦'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a38', fontFamily: 'DM Sans, sans-serif' }}>
                Compass
                {hasMore && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: '#8a8a9a' }}>+{notifications.length - 1} more</span>}
              </div>
              <div style={{ fontSize: 11, color: '#8a8a9a', fontFamily: 'DM Sans, sans-serif' }}>
                {new Date(notif.scheduled_for).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
            <button onClick={() => actionNotification(notif.id, 'dismissed')} aria-label="Dismiss"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b0b0be', fontSize: 20, lineHeight: 1, padding: '2px 4px' }}>×</button>
          </div>
          <p style={{ fontSize: 14, color: '#2a2a38', lineHeight: 1.55, margin: '0 0 10px', fontFamily: 'DM Sans, sans-serif' }}>
            {notif.generated_copy}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(notif.action_labels || []).map((label, i) => (
              <button key={label} onClick={() => handleAction(label)} style={{
                fontSize: 12, padding: '5px 13px', borderRadius: 20, border: '0.5px solid',
                borderColor: i === 0 ? 'rgba(200,169,122,0.6)' : 'rgba(90,90,106,0.25)',
                background: i === 0 ? 'rgba(200,169,122,0.12)' : 'transparent',
                color: i === 0 ? '#9a7a52' : '#5a5a6a',
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
              }}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Startup data sanitizer — runs before React mounts ───────────────────────
// Cleans any null entries from localStorage arrays so they never reach render
(function sanitizeLocalStorageOnLoad() {
  try {
    // Remove keys that were written as the string "null" — causes crashes in components
    // af_safe_harbor is included for belt-and-suspenders consistency. loadData() in
    // SafeHarbor.jsx already handles the "null" string case defensively (JSON.parse("null")
    // → null → fresh defaults), so this guard is redundant but not harmful.
    const NULL_SAFE_KEYS = ["af_inventory","af_gifts","af_houseFile","af_health","af_career","af_travel_profile","af_vaultSystems","af_sections","af_moments","af_subs","af_packing_templates","af_safe_harbor"];
    NULL_SAFE_KEYS.forEach(function(k) {
      try { if (localStorage.getItem(k) === "null") localStorage.removeItem(k); } catch {}
    });
    const ARRAY_KEYS = ["af_tasks", "af_brainItems", "af_shoppingItems", "af_notifications", "af_calEvents", "af_connectedCals", "af_favMeals", "af_checkedCalEvents", "af_checkedMealItems", "af_burnoutChecked", "af_recurring"];
    const MEAL_DAYS_S = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

    // Sanitize all array keys — filter out null/non-object entries
    ARRAY_KEYS.forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(item => item != null && typeof item === "object");
          if (clean.length !== parsed.length) {
            localStorage.setItem(key, JSON.stringify(clean));
          }
        }
      } catch {}
    });

    // Sanitize people — must have id and name
    try {
      const raw = localStorage.getItem("af_people");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(p => p != null && p.id && p.name);
          localStorage.setItem("af_people", JSON.stringify(clean));
        }
      }
    } catch {}

    // Sanitize meals — each day must be an object, values must be strings
    try {
      const raw = localStorage.getItem("af_meals");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const safeMeals = {};
          MEAL_DAYS_S.forEach(day => {
            const m = parsed[day];
            if (!m || typeof m !== "object") {
              safeMeals[day] = {};
            } else {
              const clean = {};
              Object.entries(m).forEach(([k,v]) => { clean[k] = (v == null) ? "" : String(v); });
              safeMeals[day] = clean;
            }
          });
          localStorage.setItem("af_meals", JSON.stringify(safeMeals));
        }
      }
    } catch {}

    // Sanitize tasks specifically — each must have id and text
    try {
      const raw = localStorage.getItem("af_tasks");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(t => t != null && typeof t === "object" && t.id && t.text != null);
          localStorage.setItem("af_tasks", JSON.stringify(clean));
        }
      }
    } catch {}

  } catch {}
})();

// ── RootErrorBoundary — app-level catch, branded recovery ────────────────────
// Wraps FlowWrapper in App and HomeFlow in FlowWrapper. Shows a calm, branded
// screen that never suggests clearing storage and never exposes raw error text.
// Support code is stable (same error message → same 8-char hex code).
class RootErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { crashed: false, code: "" }; }
  static getDerivedStateFromError(error) {
    return { crashed: true, code: errorCode(error && error.message ? error.message : String(error)) };
  }
  componentDidCatch(error, info) {
    if (typeof AF_DEBUG !== "undefined" && AF_DEBUG) { console.error("[AF] RootErrorBoundary:", error, info); }
  }
  render() {
    if (!this.state.crashed) return this.props.children;
    var code = this.state.code;
    return (
      <div style={{minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem",fontFamily:"DM Sans, sans-serif",background:"#1a2744",textAlign:"center"}}>
        <div style={{fontSize:"2.5rem",marginBottom:"1.25rem"}}>⚓</div>
        <h2 style={{marginBottom:"0.75rem",color:"#faf8f4",fontFamily:"Cormorant Garamond, serif",fontSize:"1.5rem",fontWeight:600}}>Something went sideways</h2>
        <p style={{color:"rgba(250,248,244,0.72)",marginBottom:"0.5rem",maxWidth:320,lineHeight:1.55,fontSize:"0.95rem"}}>Your data is safe.</p>
        <p style={{color:"rgba(250,248,244,0.55)",marginBottom:"2rem",maxWidth:320,lineHeight:1.55,fontSize:"0.88rem"}}>Close and reopen the app, or tap Reload below.</p>
        <button onClick={function(){ window.location.reload(); }} style={{background:"#c8a97a",color:"#1a2744",border:"none",borderRadius:"0.75rem",padding:"0.75rem 2rem",cursor:"pointer",fontWeight:700,fontSize:"1rem"}}>Reload</button>
        <p style={{marginTop:"2rem",color:"rgba(250,248,244,0.28)",fontSize:"0.7rem",letterSpacing:"0.04em"}}>{"Support code: " + code}</p>
      </div>
    );
  }
}

// ── SectionErrorBoundary — inline section-level catch ────────────────────────
// Wraps high-risk render surfaces (Exhale, Calendar, Safe Harbor) so a crash
// in one section does not blank the whole app. Shows an inline recovery card.
class SectionErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { crashed: false }; }
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(error, info) {
    if (typeof AF_DEBUG !== "undefined" && AF_DEBUG) { console.error("[AF] SectionErrorBoundary:", error, info); }
  }
  render() {
    if (!this.state.crashed) return this.props.children;
    var self = this;
    var label = this.props.label || "This section";
    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem",textAlign:"center",minHeight:"8rem",background:"#f7f3ec",borderRadius:"1rem",margin:"1rem"}}>
        <p style={{color:"#5a5a6a",marginBottom:"1rem",fontSize:"0.9rem"}}>{label + " hit a snag."}</p>
        <button
          onClick={function(){ self.setState({ crashed: false }); }}
          style={{background:"#1a2744",color:"#faf8f4",border:"none",borderRadius:"0.6rem",padding:"0.5rem 1.25rem",cursor:"pointer",fontWeight:600,fontSize:"0.85rem"}}
        >Reload section</button>
      </div>
    );
  }
}

// Keep alias so any legacy reference to ErrorBoundary still works.
var ErrorBoundary = RootErrorBoundary;

// ── Supabase client (household sync) ─────────────────────────────────────────
const SUPABASE_URL = "https://sbgbyptkunvyxjfpzght.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZ2J5cHRrdW52eXhqZnB6Z2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Njk2MDYsImV4cCI6MjA5MDA0NTYwNn0.jbrKplCdnPeqS3QEKMDMClsIVBvQYgph_U5xK5iCxY0";

// ── Claude proxy auth shim ────────────────────────────────────────────────────
const _afFetch = window.fetch.bind(window);
function _afReadToken() {
  try { return JSON.parse(localStorage.getItem("af_authToken") || "null") || ""; } catch (e) { return ""; }
}
var _afClaudeLast = 0;
var _afClaudeHits = [];
function _afCooldown() {
  var now = Date.now();
  _afClaudeHits = _afClaudeHits.filter(function (t) { return now - t < 60000; });
  if (now - _afClaudeLast < 1200) return "Compass is still thinking — one moment.";
  if (_afClaudeHits.length >= 12) return "Compass needs a short breather — try again in a minute.";
  _afClaudeLast = now;
  _afClaudeHits.push(now);
  return null;
}
function _afCooldownResponse(msg) {
  return new Response(JSON.stringify({ error: msg, cooled: true }), {
    status: 429, headers: { "Content-Type": "application/json" }
  });
}
window.fetch = async function(input, opts) {
  var isClaude = typeof input === "string" && (input === "/api/claude" || input === "/api/anthropic");
  if (!isClaude) return _afFetch(input, opts);
  var _cool = _afCooldown();
  if (_cool) return _afCooldownResponse(_cool);
  input = "/api/claude";
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers, { "Authorization": "Bearer " + _afReadToken() });
  var res = await _afFetch(input, opts);
  // On 401, refresh the session token once and retry
  if (res.status === 401 && typeof refreshAuthToken === "function") {
    try {
      var fresh = await refreshAuthToken();
      if (fresh) {
        opts.headers = Object.assign({}, opts.headers, { "Authorization": "Bearer " + fresh });
        res = await _afFetch(input, opts);
      }
    } catch (e) { /* fall through with original 401 */ }
  }
  return res;
};


async function sbFetch(path, opts={}) {
  const url = SUPABASE_URL + path;
  // Token precedence:
  //   1. opts._token (explicit caller override — signIn flow, validation probes, etc.)
  //   2. supabase.auth.getSession() — SDK's live, auto-refreshed token (no network call)
  //   3. SUPABASE_KEY — anon fallback for public endpoints with no session
  let _bearer;
  if (opts._token !== undefined) {
    _bearer = opts._token;
  } else {
    try {
      const { data: sd } = await supabase.auth.getSession();
      _bearer = sd?.session?.access_token || SUPABASE_KEY;
    } catch(e) {
      _bearer = SUPABASE_KEY;
    }
  }
  const r = await fetch(url, {
    cache: "no-store", // iOS Safari caches GET responses; no-store bypasses cache entirely
    ...opts,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + _bearer,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    }
  });
  const ct = r.headers.get("content-type")||"";
  const body = ct.includes("json") ? await r.json() : await r.text();
  if (!r.ok) {
    const errMsg = typeof body === "object" ? JSON.stringify(body) : body;
    throw new Error(errMsg);
  }
  return body;
}

async function sbAuth(email, password, mode="signin") {
  const path = mode === "signup"
    ? "/auth/v1/signup"
    : "/auth/v1/token?grant_type=password";
  return sbFetch(path, { method:"POST", body: JSON.stringify({ email, password }) });
}

async function sbSignOut(token) {
  return sbFetch("/auth/v1/logout", { method:"POST", _token: token });
}

// SYNC_KEYS imported from ./sync-core.js

function readHouseholdState() {
  var st = {};
  SYNC_KEYS.forEach(function (k) {
    try { st[k] = JSON.parse(localStorage.getItem("af_" + k)); } catch (e) { st[k] = null; }
  });
  try { st.preferredName = JSON.parse(localStorage.getItem("af_preferredName")); } catch (e) {}
  return st;
}
window.__compassTest = function (q) {
  return askFamily(readHouseholdState(), q || "what is for dinner this week?")
    .then(function (r) { AF_DEBUG && console.log("COMPASS:", r); return r; });
};

const APP_VERSION = "2026-06-03-vault-refresh";
// Module-level flag: controllerchange reload fires AT MOST ONCE per page lifetime.
// Prevents a second controllerchange (e.g. from a rapid double-update) from
// triggering a second reload while the first is already in progress.
var _swReloadFired = false;
// Set to true ONLY by explicit user-initiated sign-out before calling supabase.auth.signOut().
// The SIGNED_OUT listener uses this flag to decide whether to wipe household data:
//   true  → user chose to sign out → clear everything (expected behavior)
//   false → automatic sign-out (zombie/refresh-failure) → preserve household data so
//           unpushed edits can push once auth is restored after re-login
var _afUserInitiatedSignOut = false;
var SHOPPING_V2 = localStorage.getItem("af_shopping_v2") === "true";
const TODAY = new Date();
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const TODAY_NAME = DAY_NAMES[TODAY.getDay()];
const FORMAT_DATE = d => d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const FORMAT_SHORT = d => d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
const uid = () => Math.random().toString(36).slice(2,9);
// Derive current age from an ISO birthday string (YYYY-MM-DD). Returns null if missing/invalid.
function ageFromBirthday(birthday) {
  if (!birthday) return null;
  var parts = String(birthday).split("-");
  if (parts.length !== 3) return null;
  var by = parseInt(parts[0], 10); var bm = parseInt(parts[1], 10) - 1; var bd = parseInt(parts[2], 10);
  if (isNaN(by) || isNaN(bm) || isNaN(bd)) return null;
  var t = new Date(); var age = t.getFullYear() - by;
  var md = t.getMonth() - bm;
  if (md < 0 || (md === 0 && t.getDate() < bd)) age--;
  return age >= 0 ? age : null;
}
// Effective age for a person: birthday-derived if available, else legacy numeric age.
function personAge(p) { return p && p.birthday ? ageFromBirthday(p.birthday) : (p && p.age != null ? p.age : null); }
function personIsMinor(p) { var a = personAge(p); return a !== null && a < 18; }
// Returns the ISO date string (YYYY-MM-DD) of the Monday starting the current week
const getThisMonday = () => {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
};
// MEAL_DAYS imported from ./sync-core.js
const TREASURE_ICONS = ["🎁","📱","🍕","🎬","🌙","🎡","🏖️","🍦","🎮","🎨","📚","🎵","🧁","🎠","🌮"];
const WEEKDAYS_SUN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
var PERSON_COLORS = {
  Madi:    { bg: "#e0f5f1", border: "#3aaa91", text: "#1a6657" },
  Rylan:   { bg: "#faeae3", border: "#d4704a", text: "#8a3820" },
  Kinzlee: { bg: "#eeebf8", border: "#8b7dbf", text: "#4a3d85" },
  Briar:   { bg: "#fdf3dc", border: "#d4a240", text: "#7a5a10" },
  family:  { bg: "#e3eef7", border: "#4a7fa8", text: "#1c4a6e" },
};
var PERSON_COLOR_DEFAULT = { bg: "#f0ede8", border: "#a09080", text: "#4a3e36" };
function getPersonColor(forPerson) {
  if (!forPerson) return PERSON_COLOR_DEFAULT;
  return PERSON_COLORS[forPerson] || PERSON_COLOR_DEFAULT;
}
function getWorkDays() {
  try { return JSON.parse(localStorage.getItem("af_workDays") || "{}"); } catch(e) { return {}; }
}
function saveWorkDays(wd) {
  try { localStorage.setItem("af_workDays", JSON.stringify(wd)); } catch(e) {}
}

const THEMES = {
  calm: {
    label:"Calm", emoji:"🌿",
    bg:"#F5F0E8", bgAlt:"#EDE8DF", surface:"#FDFAF5", border:"#D4CCB8", borderSoft:"#E0D8C8",
    sage:"#7a9e8e", sageDark:"#4d7a6a", sageLight:"#a0c0b0", sagePale:"#deeee8",
    sand:"#c4a882", sandDark:"#9a7a52", sandLight:"#ddc8a0", sandPale:"#f0e4d0",
    blue:"#5E8FA0", blueDark:"#4a7a94", blueLight:"#96bdd0", bluePale:"#dceef0",
    rose:"#b87265", roseDark:"#8f4f44", rosePale:"#f0ddd8",
    lavender:"#8878b8", lavPale:"#e5e0f5",
    textDark:"#2a2a38", textMid:"#5a5a6a", textSoft:"#8a8a9a", textFaint:"#b0b0be",
    white:"#FDFAF5", navBg:"#F0EBE0", topBg:"#FDFAF5",
    inputBg:"#FDFAF5", cardShadow:"rgba(80,70,50,0.08)", modalOverlay:"rgba(42,42,56,0.48)",
  },
  coastal: {
    label:"Coastal", emoji:"🌊",
    bg:"#e4edf5", bgAlt:"#d4e2ef", surface:"#f2f7fc", border:"#a8c4dc", borderSoft:"#bdd0e4",
    sage:"#3a7a60", sageDark:"#1f5a42", sageLight:"#72b098", sagePale:"#c8e8da",
    sand:"#a87840", sandDark:"#7a5520", sandLight:"#d0a870", sandPale:"#ead8b8",
    blue:"#2e6ea0", blueDark:"#1a4e78", blueLight:"#68a8d0", bluePale:"#bcd8f0",
    rose:"#a05858", roseDark:"#783838", rosePale:"#ead8d5",
    lavender:"#6058a0", lavPale:"#d5d0f0",
    textDark:"#101828", textMid:"#284058", textSoft:"#507090", textFaint:"#80a8c8",
    white:"#f5faff", navBg:"#d8e8f5", topBg:"#c8ddf0",
    inputBg:"#f2f7fc", cardShadow:"rgba(10,40,80,0.10)", modalOverlay:"rgba(5,20,45,0.55)",
  },
  night: {
    label:"Night", emoji:"🌙",
    bg:"#151c24", bgAlt:"#1c2530", surface:"#1e2838", border:"#2c3d50", borderSoft:"#243244",
    sage:"#5aaa88", sageDark:"#3a8868", sageLight:"#88c8a8", sagePale:"#183828",
    sand:"#d4a870", sandDark:"#b08850", sandLight:"#e8c898", sandPale:"#2a1e0a",
    blue:"#6FA7AE", blueDark:"#3080a8", blueLight:"#88c8e8", bluePale:"#0c2838",
    rose:"#d88878", roseDark:"#b05848", rosePale:"#2e1010",
    lavender:"#a898d8", lavPale:"#1c1838",
    textDark:"#e8f0f8", textMid:"#a0b8cc", textSoft:"#607890", textFaint:"#384e64",
    white:"#222e3e", navBg:"#111820", topBg:"#111820",
    inputBg:"#1a2438", cardShadow:"rgba(0,0,0,0.32)", modalOverlay:"rgba(0,0,0,0.72)",
  }
};

const FLOW_MODES_FN = T => ({
  Smooth:   {color:T.sage,  bg:T.sagePale, emoji:"🌊", desc:"Balanced, realistic day."},
  Busy:     {color:T.sand,  bg:T.sandPale, emoji:"⚡", desc:"Fewer tasks, more focus."},
  Survival: {color:T.rose,  bg:T.rosePale, emoji:"🛟", desc:"Only what truly matters."},
});

const DEFAULT_RHYTHM = {
  Monday:    {theme:"Reset",        emoji:"🔄", desc:"Laundry, groceries, fresh start."},
  Tuesday:   {theme:"Taco Tuesday", emoji:"🌮", desc:"Taco night — family favourite!"},
  Wednesday: {theme:"Admin",        emoji:"📋", desc:"Emails, bills, scheduling."},
  Thursday:  {theme:"Clean",        emoji:"🧹", desc:"Deep clean, bathrooms, floors."},
  Friday:    {theme:"Prep + Fun",   emoji:"🎉", desc:"Weekend prep. Treat yourselves."},
  Saturday:  {theme:"Family",       emoji:"👨‍👩‍👧", desc:"Together time. Outings, memories."},
  Sunday:    {theme:"Rest + Reset", emoji:"🌿", desc:"Rest and gentle reset."},
};

const DEFAULT_MEAL_THEMES = {
  Monday:    {theme:"Meatless Monday",    emoji:"🥗"},
  Tuesday:   {theme:"Taco Tuesday",       emoji:"🌮"},
  Wednesday: {theme:"Pasta Wednesday",    emoji:"🍝"},
  Thursday:  {theme:"Throwback Thursday", emoji:"🍲"},
  Friday:    {theme:"Fish Friday",        emoji:"🐟"},
  Saturday:  {theme:"Slow Cook Saturday", emoji:"🫕"},
  Sunday:    {theme:"Sunday Roast",       emoji:"🍗"},
};

const THEME_PRESETS = [
  {theme:"Reset",emoji:"🔄",desc:"Laundry, groceries, fresh start."},
  {theme:"Errands",emoji:"🛒",desc:"Out & about. Appointments, pick-ups."},
  {theme:"Admin",emoji:"📋",desc:"Emails, bills, scheduling."},
  {theme:"Clean",emoji:"🧹",desc:"Deep clean, bathrooms, floors."},
  {theme:"Prep + Fun",emoji:"🎉",desc:"Weekend prep. Treat yourselves."},
  {theme:"Family",emoji:"👨‍👩‍👧",desc:"Together time. Outings, memories."},
  {theme:"Rest + Reset",emoji:"🌿",desc:"Rest and gentle reset."},
  {theme:"Self-care",emoji:"💆",desc:"You first. Recharge your batteries."},
  {theme:"Batch Cook",emoji:"🍲",desc:"Prep meals for the week ahead."},
  {theme:"Finance",emoji:"💰",desc:"Budget, bills, financial check-in."},
  {theme:"Fitness",emoji:"🏃",desc:"Move your body, feel good."},
  {theme:"Custom",emoji:"✏️",desc:""},
];

const DIETARY_META_FN = T => ({
  "Dairy-free":  {color:T.blue,     emoji:"🥛"},
  "Gluten-free": {color:T.sand,     emoji:"🌾"},
  "Nut-free":    {color:T.rose,     emoji:"🥜"},
  "Vegetarian":  {color:T.sage,     emoji:"🥦"},
  "Vegan":       {color:T.sageDark, emoji:"🌱"},
  "Low-carb":    {color:T.lavender, emoji:"🍖"},
});

const HOME_SYSTEMS_DEFAULT = [
  {id:"laundry", label:"Laundry Rhythm", emoji:"🧺", items:["Wash Monday & Thursday","Fold same day — no pile-up","Put away within 24h","One load = one task"]},
  {id:"daily",   label:"Daily Reset",    emoji:"🌙", items:["Dishes done before bed","Counters wiped","10-min tidy sweep","Tomorrow's bag packed"]},
  {id:"weekly",  label:"Weekly Cleaning",emoji:"🧹", items:["Monday — Laundry + kitchen","Wednesday — Bathrooms","Thursday — Floors + surfaces","Friday — Tidy before weekend"]},
];

const BURNOUT_TASKS = [
  {id:"feed", label:"Feed everyone",    emoji:"🍳"},
  {id:"load", label:"One load laundry", emoji:"🧺"},
  {id:"reset",label:"10-min reset",     emoji:"✨"},
];

const BRAIN_BUCKETS = [
  {id:"top3",    label:"Top 3",    emoji:"🔥", desc:"Must happen today",         color:"rose"},
  {id:"next3",   label:"Next 3",   emoji:"⚡", desc:"Important, do soon",        color:"sand"},
  {id:"later",   label:"Later",    emoji:"📋", desc:"On the radar",              color:"blue"},
  {id:"delegate",label:"Delegate", emoji:"🤝", desc:"Someone else can own this", color:"lavender"},
];

// ── Brain Dump Categories (location/context groupings) ────────────────────────
const BRAIN_CATS = [
  {id:"household", label:"Household",    emoji:"🏠", desc:"Things to do at home",          suggestDay:"Clean",     color:"sage",     examples:["Fix the drawer","Wipe down fridge","Change lightbulb"]},
  {id:"errands",   label:"Errands",      emoji:"🚗", desc:"Out & about tasks",              suggestDay:"Errands",   color:"blue",     examples:["Pick up prescription","Return library books","Drop off dry cleaning"]},
  {id:"calls",     label:"Phone Calls",  emoji:"📞", desc:"Calls and voicemails to make",  suggestDay:"Admin",     color:"lavender", examples:["Call doctor","Chase insurance","Book dentist"]},
  {id:"orders",    label:"Orders",       emoji:"📦", desc:"Things to order or buy online",  suggestDay:"Admin",     color:"sand",     examples:["Order birthday gift","Restock vitamins","New shoes for Ella"]},
  {id:"admin",     label:"Admin",        emoji:"📋", desc:"Paperwork, emails, scheduling", suggestDay:"Admin",     color:"rose",     examples:["File tax docs","Reply to school email","Schedule oil change"]},
  {id:"someday",   label:"Someday",      emoji:"🌿", desc:"Nice to do, no rush",           suggestDay:null,        color:"sage",     examples:["Organise pantry","New family photos","Learn sourdough"]},
];

const TABS = [
  {id:"anchor",   label:"Anchor",   emoji:"⚓️"},
  {id:"calendar", label:"Calendar", emoji:"📆"},
  {id:"meals",    label:"Meals",    emoji:"🍽️"},
  {id:"shop",     label:"Shopping", emoji:"🛒"},
  {id:"ai",       label:"Ripple",   emoji:"〜"},
  {id:"tidepool", label:"Tide Pool", emoji:"🏝️"},
  {id:"cove",     label:"Cove",      emoji:"🪸"},
  {id:"weekly",   label:"Weekly",   emoji:"📅"},
  {id:"home",     label:"Home",     emoji:"🏠"},
  {id:"brain",    label:"Mind",     emoji:"💭"},
  {id:"school",   label:"School",   emoji:"🏫"},
  {id:"settings", label:"Settings", emoji:"⚙️"},
];
const PRIMARY_TABS = ["anchor","calendar","meals","shop","ai"];
const MORE_TABS    = ["weekly","home","brain","school","tidepool","cove","settings"];

const CAL_SOURCES = [
  {id:"google",  label:"Google Calendar", color:"#4285F4", icon:"G"},
  {id:"apple",   label:"Apple Calendar",  color:"#ff3b30", icon:"🍎"},
  {id:"outlook", label:"Outlook",         color:"#0078d4", icon:"O"},
  {id:"ical",    label:"iCal / Other",    color:"#888",    icon:"📅"},
];

const CAL_COLOR_OPTIONS = [
  {color:"#6A9BB5",label:"Blue"},{color:"#7a9e8e",label:"Sage"},{color:"#c4a882",label:"Sand"},
  {color:"#b87265",label:"Rose"},{color:"#8878b8",label:"Lavender"},{color:"#e8a838",label:"Gold"},
  {color:"#7ab8a8",label:"Teal"},{color:"#c878a8",label:"Pink"},
];

// ── Meal Bank Data ────────────────────────────────────────────────────────────
const MEAL_BANK_DATA = [
  {id:"m1",name:"Sheet Pan Chicken Fajitas",time:20,pans:1,tags:["kid-friendly","dairy-free","one-pan"],cleanup:"Easy",kidRating:5,ingredients:["chicken breast","bell peppers","onion","taco seasoning","tortillas","avocado","olive oil"],steps:["Slice chicken and veggies into strips","Toss with olive oil + taco seasoning","Spread on pan, bake 20 min at 400°F","Serve with warm tortillas + avocado"],swap:"Use pre-sliced frozen peppers + rotisserie chicken to skip all prep",skip:"Skip the avocado — still delicious",leftovers:"Roll into lunch wraps tomorrow",prepNote:"Slice peppers Sunday → dinner takes 5 min"},
  {id:"m2",name:"Rotisserie Chicken Bowls",time:10,pans:0,tags:["kid-friendly","dairy-free","under-15","no-cook"],cleanup:"Minimal",kidRating:4,ingredients:["rotisserie chicken","rice pouches","black beans","avocado","salsa","lime"],steps:["Shred the rotisserie chicken","Microwave rice pouches (90 sec)","Warm black beans on stove or microwave","Assemble bowls, top with salsa + avocado"],swap:"Frozen cauliflower rice instead of regular rice",skip:"Skip lime + avocado if rushed",leftovers:"Pack remaining chicken for tacos tomorrow",prepNote:"Buy rotisserie chicken same day — nothing to prep"},
  {id:"m3",name:"One-Pot Spaghetti",time:20,pans:1,tags:["kid-friendly","one-pan","freezer-friendly"],cleanup:"Easy",kidRating:5,ingredients:["ground turkey","spaghetti","marinara sauce","garlic","olive oil","parmesan"],steps:["Brown turkey with garlic in a large pot","Add pasta, marinara, and 2½ cups water","Simmer 12 min, stirring often","Top with parmesan — serve straight from pot"],swap:"Ground beef works. Skip meat for vegetarian.",skip:"No parmesan needed — kids won't notice",leftovers:"Perfect thermos lunch. Freezes beautifully.",prepNote:"None needed — everything cooks together"},
  {id:"m4",name:"Breakfast for Dinner",time:15,pans:1,tags:["kid-friendly","under-15","pantry-meal","dairy-free"],cleanup:"Easy",kidRating:5,ingredients:["eggs","bacon or turkey sausage","bread","butter","maple syrup"],steps:["Cook bacon/sausage first, set aside","Scramble eggs in the same pan","Toast bread while eggs cook","Serve everything family-style"],swap:"Turkey sausage instead of bacon",skip:"Skip toast if you're out of bread",leftovers:"Egg sandwich for tomorrow's breakfast",prepNote:"Nothing to prep — this is the rescue dinner"},
  {id:"m5",name:"Freezer Burritos",time:5,pans:0,tags:["survival-mode","under-15","no-thaw","dairy-free"],cleanup:"None",kidRating:4,ingredients:["frozen burritos","salsa","shredded cheese","sour cream"],steps:["Microwave burritos per package instructions","Top with salsa (+ cheese if using)","Done. Seriously."],swap:"Add a side of canned corn or frozen rice",skip:"Everything is optional — just eat the burrito",leftovers:"None — this is survival mode",prepNote:"Keep a box in the freezer always"},
  {id:"m6",name:"Snack Plate Night",time:5,pans:0,tags:["survival-mode","kid-friendly","dairy-free","under-15","no-cook"],cleanup:"None",kidRating:5,ingredients:["deli meat","crackers","grapes or berries","cucumber slices","hummus","cheese"],steps:["Arrange everything on a cutting board","Let kids build their own plates","Call it a 'picnic dinner' — they'll love it"],swap:"Whatever is in the fridge. No rules.",skip:"Everything is optional",leftovers:"Pack the leftovers for lunch tomorrow",prepNote:"No prep. Ever."},
  {id:"m7",name:"Sheet Pan Salmon",time:25,pans:1,tags:["dairy-free","protein-packed","one-pan"],cleanup:"Easy",kidRating:3,ingredients:["salmon fillets","asparagus","lemon","garlic","olive oil"],steps:["Preheat oven to 425°F","Season salmon with lemon, garlic, olive oil","Add asparagus to pan alongside","Bake 18 min. Squeeze lemon to serve."],swap:"Tilapia or cod if salmon unavailable",skip:"Asparagus can be swapped for frozen broccoli",leftovers:"Salmon rice bowls for tomorrow's lunch",prepNote:"Season salmon morning of — dinner is 5 min hands-on"},
  {id:"m8",name:"Black Bean Tacos",time:15,pans:1,tags:["kid-friendly","dairy-free","under-15","vegetarian","pantry-meal"],cleanup:"Easy",kidRating:4,ingredients:["canned black beans","taco shells","salsa","avocado","lime","cumin"],steps:["Warm beans with cumin + garlic powder","Warm taco shells in oven 3 min","Set up toppings on the table","Everyone builds their own"],swap:"Add rotisserie chicken for non-vegetarian",skip:"Skip avocado if out of stock",leftovers:"Bean quesadillas tomorrow",prepNote:"All pantry — no planning needed"},
  {id:"m9",name:"Slow Cooker Pulled Chicken",time:15,pans:0,tags:["dairy-free","freezer-friendly","protein-packed"],cleanup:"None",kidRating:4,ingredients:["chicken thighs","BBQ sauce","onion powder","garlic powder","chicken broth"],steps:["Add everything to slow cooker in the morning","Cook low 6–8 hrs or high 3–4 hrs","Shred with two forks","Serve on rolls, rice, or baked potatoes"],swap:"Use chicken breast for lower fat",skip:"Skip the rolls and serve over rice",leftovers:"Freezes perfectly. Make a double batch.",prepNote:"Set it in the morning — dinner is done"},
  {id:"m10",name:"Veggie Fried Rice",time:20,pans:1,tags:["kid-friendly","dairy-free","one-pan","pantry-meal"],cleanup:"Easy",kidRating:4,ingredients:["leftover rice","eggs","frozen peas + carrots","soy sauce","sesame oil","green onion"],steps:["Heat oil in large pan, scramble eggs","Add frozen veggies, cook 3 min","Add cold leftover rice, stir-fry 5 min","Season with soy sauce + sesame oil"],swap:"Add any leftover protein — chicken, shrimp, tofu",skip:"Skip sesame oil if you don't have it",leftovers:"Just as good cold for lunch",prepNote:"Use yesterday's leftover rice — actually better for fried rice"},
];

const WEEK_TYPE_PRESETS = {
  calm:     {label:"Calm Week",     emoji:"🌿", desc:"Real cooking, real food, a little more care.",      meals:{Monday:{dinner:"Sheet Pan Salmon"},Tuesday:{dinner:"Sheet Pan Chicken Fajitas"},Wednesday:{dinner:"One-Pot Spaghetti"},Thursday:{dinner:"Slow Cooker Pulled Chicken"},Friday:{dinner:"Black Bean Tacos"},Saturday:{dinner:"Veggie Fried Rice"},Sunday:{dinner:"Rotisserie Chicken Bowls"}}},
  busy:     {label:"Busy Week",     emoji:"⚡", desc:"Fast, reliable, minimal cleanup.",                   meals:{Monday:{dinner:"Rotisserie Chicken Bowls"},Tuesday:{dinner:"Black Bean Tacos"},Wednesday:{dinner:"Sheet Pan Chicken Fajitas"},Thursday:{dinner:"One-Pot Spaghetti"},Friday:{dinner:"Breakfast for Dinner"},Saturday:{dinner:"Slow Cooker Pulled Chicken"},Sunday:{dinner:"Snack Plate Night"}}},
  survival: {label:"Survival Week", emoji:"🛟", desc:"Minimum effort. Feed everyone. That's a win.",      meals:{Monday:{dinner:"Rotisserie Chicken Bowls"},Tuesday:{dinner:"Freezer Burritos"},Wednesday:{dinner:"Breakfast for Dinner"},Thursday:{dinner:"Snack Plate Night"},Friday:{dinner:"Freezer Burritos"},Saturday:{dinner:"One-Pot Spaghetti"},Sunday:{dinner:"Rotisserie Chicken Bowls"}}},
  reset:    {label:"Reset Week",    emoji:"✨", desc:"Back to basics. Nourishing and calm.",               meals:{Monday:{dinner:"Sheet Pan Salmon"},Tuesday:{dinner:"Sheet Pan Chicken Fajitas"},Wednesday:{dinner:"One-Pot Spaghetti"},Thursday:{dinner:"Veggie Fried Rice"},Friday:{dinner:"Black Bean Tacos"},Saturday:{dinner:"Slow Cooker Pulled Chicken"},Sunday:{dinner:"Rotisserie Chicken Bowls"}}},
};

const MEAL_TAG_FILTERS = [
  {id:"under-15",        label:"Under 15 min",     emoji:"⚡"},
  {id:"one-pan",         label:"One Pan",           emoji:"🍳"},
  {id:"easy-cleanup",    label:"Easy Cleanup",      emoji:"🧹"},
  {id:"dairy-free",      label:"Dairy Free",        emoji:"🥛"},
  {id:"kid-friendly",    label:"Kid Friendly",      emoji:"⭐"},
  {id:"no-cook",         label:"No Cook",           emoji:"🧊"},
  {id:"freezer-friendly",label:"Freezer Friendly",  emoji:"❄️"},
  {id:"survival-mode",   label:"Survival Mode",     emoji:"💪"},
  {id:"pantry-meal",     label:"Pantry Meal",       emoji:"🏠"},
  {id:"protein-packed",  label:"Protein Packed",    emoji:"🥩"},
  {id:"vegetarian",      label:"Vegetarian",        emoji:"🥦"},
  {id:"no-thaw",         label:"No Thaw Needed",    emoji:"🥶"},
  {id:"crockpot",        label:"Crockpot",          emoji:"🫕"},
  {id:"paper-plates",    label:"Paper Plates OK",   emoji:"🧻"},
];

const GTK_QUESTIONS = [
  "What's the hardest part of your week right now?",
  "What's one meal your family would eat every single week?",
  "Morning person or night owl? Helps me time suggestions better.",
  "Do you meal prep on Sundays, or more of a day-of cook?",
  "What does a really good week look like for your family?",
  "Any foods the kids absolutely won't touch?",
  "How many people are you cooking for most nights?",
  "Do you prefer quick 15-min meals or okay with 30+ when it's calm?",
  "What's your go-to survival dinner when everything falls apart?",
  "Is there a day of the week that's always chaotic for your family?",
];

function AnchorLogo({size=40, color="#6A9BB5"}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 58 Q25 50 40 58 Q55 66 70 58 Q85 50 92 54" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.8"/>
      <line x1="50" y1="22" x2="50" y2="72" stroke={color} strokeWidth="4" strokeLinecap="round"/>
      <circle cx="50" cy="15" r="6" stroke={color} strokeWidth="3.5" fill="none"/>
      <line x1="34" y1="32" x2="66" y2="32" stroke={color} strokeWidth="4" strokeLinecap="round"/>
      <path d="M50 72 Q34 72 30 62 L36 64" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <path d="M50 72 Q66 72 70 62 L64 64" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
function CompassIcon({size=24, color="#fff"}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.6" fill="none"/>
      <polygon points="12,4.5 13.5,11 12,13 10.5,11" fill={color} opacity="0.95"/>
      <polygon points="12,19.5 10.5,13 12,11 13.5,13" fill={color} opacity="0.45"/>
      <circle cx="12" cy="12" r="1.5" fill={color}/>
    </svg>
  );
}


// ── ScrollTabs: horizontal tab bar with arrow nav on overflow ─────────────────
function ScrollTabs({ children, style={} }) {
  const ref = React.useRef(null)
  const [canLeft,  setCanLeft]  = React.useState(false)
  const [canRight, setCanRight] = React.useState(false)

  function check() {
    const el = ref.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  React.useEffect(function() {
    check()
    const el = ref.current
    if (!el) return
    el.addEventListener("scroll", check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return function() { el.removeEventListener("scroll", check); ro.disconnect() }
  }, [])

  function scroll(dir) {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * 120, behavior: "smooth" })
  }

  const arrowStyle = function(active) { return {
    flexShrink: 0, background: "none", border: "none", cursor: active ? "pointer" : "default",
    padding: "0 4px", fontSize: "0.8rem", color: active ? "inherit" : "transparent",
    opacity: active ? 1 : 0, transition: "opacity 0.15s", lineHeight: 1,
  }}

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, position: "relative", ...style }}>
      <button onClick={function(){scroll(-1)}} style={arrowStyle(canLeft)} tabIndex={-1}>‹</button>
      <div ref={ref} onScroll={check} style={{ flex: 1, display: "flex", overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}>
        {children}
      </div>
      <button onClick={function(){scroll(1)}} style={arrowStyle(canRight)} tabIndex={-1}>›</button>
    </div>
  )
}

function Icon({name,size=16,color}){
  const s={width:size,height:size,style:{display:"block",flexShrink:0}};
  const p={fill:"none",stroke:color||"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};
  if(name==="anchor")   return <svg {...s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="22"/><path d="M5 15H2a10 10 0 0 0 20 0h-3"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
  if(name==="close")    return <svg {...s} viewBox="0 0 24 24" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
  if(name==="plus")     return <svg {...s} viewBox="0 0 24 24" {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
  if(name==="trash")    return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>;
  if(name==="edit")     return <svg {...s} viewBox="0 0 24 24" {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
  if(name==="check")    return <svg {...s} viewBox="0 0 24 24" {...p} strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>;
  if(name==="share")    return <svg {...s} viewBox="0 0 24 24" {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
  if(name==="sync")     return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
  if(name==="send")     return <svg {...s} viewBox="0 0 24 24" {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon fill={color||"currentColor"} stroke="none" points="22 2 15 22 11 13 2 9 22 2"/></svg>;
  if(name==="palette")  return <svg {...s} viewBox="0 0 24 24" {...p}><circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>;
  if(name==="chevL")    return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="15 18 9 12 15 6"/></svg>;
  if(name==="chevR")    return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="9 18 15 12 9 6"/></svg>;
  if(name==="chevD")    return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="6 9 12 15 18 9"/></svg>;
  if(name==="cal")      return <svg {...s} viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if(name==="link")     return <svg {...s} viewBox="0 0 24 24" {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
  if(name==="drag")     return <svg {...s} viewBox="0 0 24 24" {...p}><circle cx="9" cy="7" r="1" fill={color||"currentColor"}/><circle cx="9" cy="12" r="1" fill={color||"currentColor"}/><circle cx="9" cy="17" r="1" fill={color||"currentColor"}/><circle cx="15" cy="7" r="1" fill={color||"currentColor"}/><circle cx="15" cy="12" r="1" fill={color||"currentColor"}/><circle cx="15" cy="17" r="1" fill={color||"currentColor"}/></svg>;
  if(name==="bell")     return <svg {...s} viewBox="0 0 24 24" {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  if(name==="carry")    return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>;
  if(name==="recipe")   return <svg {...s} viewBox="0 0 24 24" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
  if(name==="rotate")   return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>;
  if(name==="google")   return <svg {...s} viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>;
  return null;
}

function getDaysInMonth(year,month){return new Date(year,month+1,0).getDate();}
function getFirstDayOfMonth(year,month){return new Date(year,month,1).getDay();}

const homeFlowRef = { tab: "anchor", goTab: () => {} };


function Section({id,emoji,title,sub,children,defaultOpen=false,settingsOpen,toggleSetting,T}){
  var isOpen = id in settingsOpen ? settingsOpen[id] : defaultOpen;
  return(
    <div style={{borderRadius:"1.1rem",border:"1.5px solid "+T.border,background:T.white,marginBottom:"0.65rem"}}>
      <button onClick={function(e){e.preventDefault();toggleSetting(id,defaultOpen);}} style={{width:"100%",display:"flex",alignItems:"center",gap:"0.6rem",background:"none",border:"none",cursor:"pointer",padding:"0.85rem 1rem",textAlign:"left",fontFamily:"inherit"}}>
        <span style={{fontSize:"1.15rem",flexShrink:0}}>{emoji}</span>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.05rem",fontWeight:700,color:T.textDark,lineHeight:1.2}}>{title}</div>
          {sub&&<div style={{fontSize:"0.71rem",color:T.textFaint,marginTop:1}}>{sub}</div>}
        </div>
        <span style={{fontSize:"0.75rem",color:T.textFaint,transform:isOpen?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▾</span>
      </button>
      {/* display:none keeps children mounted so inputs never lose focus */}
      <div style={{display:isOpen?"block":"none",padding:"0 1rem 1rem",borderTop:"1px solid "+T.borderSoft}}>
        {children}
      </div>
    </div>
  );
}


function BrainCatsEditor({brainCats, setBrainCats, T, inp, btnP}) {
  const [editingCatId,setEditingCatId] = useState(null);
  const [editCatName,setEditCatName] = useState("");
  const [newCatName,setNewCatName] = useState("");
  const [newCatEmoji,setNewCatEmoji] = useState("");
  const [newCatColor,setNewCatColor] = useState("#7a9e8e");
  const PRESETS=["#e05c5c","#e07c3a","#d4a82a","#5a9e6a","#3a8ab4","#6a6ab4","#b46aaa","#7a9e8e","#c8a97a","#888780"];
  function addCat(){ if(!newCatName.trim())return; setBrainCats(function(p){return[...p,{id:"cat_"+Date.now(),label:newCatName.trim(),emoji:newCatEmoji||"📌",color:newCatColor}];}); setNewCatName(""); setNewCatEmoji(""); setNewCatColor("#7a9e8e"); }
  function saveEdit(cat){ setBrainCats(function(p){return p.map(function(c){return c.id===cat.id?{...c,label:editCatName.trim()||c.label}:c;});}); setEditingCatId(null); }
  return (
    <div>
      <div style={{marginBottom:"1rem"}}>
        <div style={{fontSize:"0.78rem",fontWeight:600,color:T.textDark,marginBottom:"0.5rem"}}>Add a category</div>
        <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.5rem"}}>
          <input value={newCatName} onChange={function(e){setNewCatName(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")addCat();}} placeholder="Name…" style={{...inp({flex:1,fontSize:"0.85rem"})}}/>
          <input value={newCatEmoji} onChange={function(e){setNewCatEmoji(e.target.value);}} placeholder="🏷️" style={{...inp({width:46,textAlign:"center",fontSize:"1rem"})}}/>
        </div>
        <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"0.5rem",alignItems:"center"}}>
          {PRESETS.map(function(c){return(
            <button key={c} onClick={function(){setNewCatColor(c);}} style={{width:22,height:22,borderRadius:"50%",background:c,border:newCatColor===c?"3px solid "+T.textDark:"2px solid transparent",cursor:"pointer",flexShrink:0,transition:"border 0.1s"}}/>
          );})}
          <input type="color" value={newCatColor} onChange={function(e){setNewCatColor(e.target.value);}} title="Custom color" style={{width:22,height:22,borderRadius:"50%",border:"none",cursor:"pointer",padding:0,background:"none"}}/>
          <span style={{fontSize:"0.7rem",color:T.textFaint,marginLeft:"0.25rem"}}>{newCatColor}</span>
        </div>
        <button onClick={addCat} style={{...btnP(T.sand,{fontSize:"0.78rem",padding:"0.35rem 0.85rem",opacity:newCatName.trim()?1:0.45})}}>Add Category</button>
      </div>
      <div style={{borderTop:"1px solid "+T.borderSoft,paddingTop:"0.75rem"}}>
        <div style={{fontSize:"0.7rem",fontWeight:700,color:T.textFaint,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.5rem"}}>Your categories</div>
        {brainCats.map(function(cat){return(
          <div key={cat.id} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.5rem 0.6rem",background:T.surface,borderRadius:"0.65rem",marginBottom:"0.35rem",border:"1px solid "+T.borderSoft}}>
            <div style={{width:12,height:12,borderRadius:"50%",background:cat.color,flexShrink:0}}/>
            {editingCatId===cat.id?(
              <input value={editCatName} onChange={function(e){setEditCatName(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")saveEdit(cat); if(e.key==="Escape")setEditingCatId(null);}} style={{...inp({flex:1,fontSize:"0.82rem",padding:"0.2rem 0.45rem"})}} autoFocus/>
            ):(
              <span style={{flex:1,fontSize:"0.85rem",color:T.textDark}}>{cat.emoji} {cat.label}</span>
            )}
            <input type="color" value={cat.color} onChange={function(e){var nc=e.target.value; setBrainCats(function(p){return p.map(function(c){return c.id===cat.id?{...c,color:nc}:c;});});}} title="Change color" style={{width:20,height:20,borderRadius:"50%",border:"none",cursor:"pointer",padding:0,background:"none",flexShrink:0}}/>
            <button onClick={function(){setEditingCatId(cat.id);setEditCatName(cat.label);}} style={{background:"none",border:"none",fontSize:"0.72rem",color:T.textFaint,cursor:"pointer",fontFamily:"inherit"}}>rename</button>
            <button onClick={function(){setBrainCats(function(p){return p.filter(function(c){return c.id!==cat.id;});});}} style={{background:"none",border:"none",fontSize:"0.72rem",color:T.rose,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
          </div>
        );})}
        <div style={{fontSize:"0.7rem",color:T.textFaint,fontStyle:"italic",marginTop:"0.5rem"}}>Tap the color circle to change it inline</div>
      </div>
    </div>
  );
}


function WeeklyRhythmSection({rhythm,setRhythm,T,inp,btnP,btnS,lbl,ModalBox}){
  React.useEffect(function(){AF_DEBUG&&console.log("[AF MOUNT] WeeklyRhythmSection");return function(){AF_DEBUG&&console.log("[AF UNMOUNT] WeeklyRhythmSection");};},[]);
  var _wrRender=React.useRef(0);_wrRender.current++;AF_DEBUG&&console.count("[AF RENDER] WeeklyRhythm-section");
  var [editingDay,setEditingDay]=useState(null);
  var [editForm,setEditForm]=useState({theme:"",emoji:"",desc:""});
  var [settingsOpen,setSettingsOpen]=useState({weekly:false});
  function toggleSetting(key,defaultOpen){
    setSettingsOpen(function(p){var current=key in p?p[key]:(defaultOpen||false);return Object.assign({},p,{[key]:!current});});
  }
  var WRlbl={display:"block",color:T.textMid,fontSize:"0.71rem",marginBottom:"0.35rem",textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700};
  var DAY_COLORS=[T.blue,T.sage,T.sand,T.rose,T.lavender,T.blue,T.sage];
  function openEdit(day){setEditingDay(day);setEditForm(Object.assign({},rhythm[day]||{}));}
  function saveEdit(){setRhythm(function(p){return Object.assign({},p,{[editingDay]:Object.assign({},editForm)});});setEditingDay(null);}
  return(
    <Section id="weekly" emoji="📅" title="Weekly Rhythm" sub="Themes for each day of the week" defaultOpen={false} settingsOpen={settingsOpen} toggleSetting={toggleSetting} T={T}>
      <div style={{paddingTop:"0.75rem"}}>
        <div style={{fontSize:"0.78rem",color:T.textSoft,lineHeight:1.55,marginBottom:"0.75rem"}}>Give each day a focus — Compass uses these to shape daily suggestions and your weekly overview.</div>
        <div>
          {MEAL_DAYS.map(function(day,di){
            var dr=rhythm[day]||{};var accent=DAY_COLORS[di%DAY_COLORS.length];
            var isToday=day===TODAY_NAME;
            return(
              <div key={day} style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.58rem 0.5rem",borderBottom:"1px solid "+T.borderSoft}}>
                <span style={{fontSize:"1.05rem",flexShrink:0}}>{dr.emoji||"📋"}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
                    <span style={{fontWeight:700,color:isToday?accent:T.textDark,fontSize:"0.86rem"}}>{day}</span>
                    {isToday&&<span style={{fontSize:"0.6rem",fontWeight:800,background:accent,color:"#fff",borderRadius:"2rem",padding:"1px 6px"}}>Today</span>}
                    {dr.theme&&<span style={{fontSize:"0.75rem",color:T.textSoft}}>· {dr.theme}</span>}
                  </div>
                  {dr.desc&&<div style={{fontSize:"0.68rem",color:T.textFaint,fontStyle:"italic"}}>{dr.desc}</div>}
                </div>
                <button onClick={function(){openEdit(day);}} style={{background:"none",border:"1px solid "+T.border,borderRadius:"0.5rem",cursor:"pointer",padding:"2px 8px",fontSize:"0.7rem",color:T.textSoft,fontWeight:700,fontFamily:"inherit"}}>Edit</button>
              </div>
            );
          })}
          {editingDay&&(
            <ModalBox title={"Edit "+editingDay} onClose={function(){setEditingDay(null);}}>
              <div style={{marginBottom:"0.75rem"}}>
                <label style={WRlbl}>Quick Presets</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",marginBottom:"0.85rem"}}>
                  {THEME_PRESETS.map(function(pr,i){return <button key={i} onClick={function(){if(pr.theme==="Custom"){setEditForm(function(p){return Object.assign({},p,{emoji:pr.emoji});});return;}setEditForm({theme:pr.theme,emoji:pr.emoji,desc:pr.desc});}} style={{background:editForm.theme===pr.theme?T.blue:T.white,color:editForm.theme===pr.theme?"#fff":T.textMid,border:"1.5px solid "+(editForm.theme===pr.theme?T.blue:T.border),borderRadius:"2rem",padding:"0.28rem 0.72rem",cursor:"pointer",fontSize:"0.75rem",fontFamily:"inherit",fontWeight:700}}>{pr.emoji} {pr.theme}</button>;})}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"64px 1fr",gap:"0.65rem",marginBottom:"0.9rem"}}>
                <div><label style={WRlbl}>Emoji</label><input defaultValue={editForm.emoji} onBlur={function(e){setEditForm(function(p){return Object.assign({},p,{emoji:e.target.value});});}} placeholder="🗓️" style={{...inp({textAlign:"center",fontSize:"1.2rem",padding:"0.5rem"})}}/></div>
                <div><label style={WRlbl}>Theme</label><input defaultValue={editForm.theme} onBlur={function(e){setEditForm(function(p){return Object.assign({},p,{theme:e.target.value});});}} placeholder="e.g. Batch Cook" style={inp()}/></div>
              </div>
              <div style={{marginBottom:"1rem"}}><label style={WRlbl}>Description</label><input defaultValue={editForm.desc} onBlur={function(e){setEditForm(function(p){return Object.assign({},p,{desc:e.target.value});});}} placeholder="What happens on this day…" style={inp()}/></div>
              <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
                <button onClick={function(){setEditingDay(null);}} style={btnS()}>Cancel</button>
                <button onClick={saveEdit} style={btnP(T.sage)}>Save</button>
              </div>
            </ModalBox>
          )}
        </div>
      </div>
    </Section>
  );
}

function TidePoolSection({people,coveData,setCoveData,T,inp,btnP,btnS}){
  React.useEffect(function(){AF_DEBUG&&console.log("[AF MOUNT] TidePoolSection");return function(){AF_DEBUG&&console.log("[AF UNMOUNT] TidePoolSection");};},[]);
  var _tpRender=React.useRef(0);_tpRender.current++;AF_DEBUG&&console.count("[AF RENDER] TidePool-section");
  var [tpKidIdx,setTpKidIdx]=useState(0);
  var [tpTab,setTpTab]=useState("chores");
  var [newChoreName,setNewChoreName]=useState("");
  var [newChorePts,setNewChorePts]=useState(1);
  var [newTreasureName,setNewTreasureName]=useState("");
  var [newTreasureCost,setNewTreasureCost]=useState("");
  var [editChoreId,setEditChoreId]=useState(null);
  var [editTreasureId,setEditTreasureId]=useState(null);
  var [settingsOpen,setSettingsOpen]=useState({tidepool:false});
  function toggleSetting(key,defaultOpen){
    setSettingsOpen(function(p){var current=key in p?p[key]:(defaultOpen||false);return Object.assign({},p,{[key]:!current});});
  }
  var rawKids=people.filter(function(p){return p.role==="Kid"||p.role==="Teen"||personIsMinor(p);});
  var saved=coveData||[];
  var sKidIdx=Math.min(tpKidIdx,Math.max(rawKids.length-1,0));
  var sKid=rawKids[sKidIdx];
  var sKidData=sKid?(saved.find(function(d){return d.kidId===sKid.id;})||{kidId:sKid.id,kidName:sKid.name,shells:0,chores:[],treasures:[]}):null;
  var sKidIdx2=sKid?saved.findIndex(function(d){return d.kidId===sKid.id;}):-1;
  function updateSaved(patch){
    setCoveData(function(prev){
      var arr=(prev||[]).slice();
      if(sKidIdx2>=0) arr[sKidIdx2]=Object.assign({},arr[sKidIdx2],patch);
      else if(sKidData) arr.push(Object.assign({},sKidData,patch));
      return arr;
    });
  }
  // Daily chore reset — runs when kid changes or on mount
  var todayStr = TODAY.toISOString().split("T")[0];
  React.useEffect(function(){
    if(!sKidData) return;
    var lastReset = sKidData.choreLastReset || "";
    if(lastReset !== todayStr){
      var resetChores = (sKidData.chores||[]).map(function(ch){ return Object.assign({},ch,{done:false}); });
      updateSaved({chores:resetChores, choreLastReset:todayStr});
    }
  },[sKid&&sKid.id, todayStr]);
  function toggleChore(chId){
    var ch = (sKidData.chores||[]).find(function(c){return c.id===chId;});
    if(!ch) return;
    var wasChecked = !!ch.done;
    var newChores = (sKidData.chores||[]).map(function(c){ return c.id===chId ? Object.assign({},c,{done:!wasChecked}) : c; });
    var shellDelta = wasChecked ? -(ch.pts||1) : (ch.pts||1);
    updateSaved({chores:newChores, shells:Math.max(0,(sKidData.shells||0)+shellDelta)});
  }
  return(
    <Section id="tidepool" emoji="🏝️" title="Tide Pool" sub="Chores and treasures for each child" defaultOpen={false} settingsOpen={settingsOpen} toggleSetting={toggleSetting} T={T}>
      <div style={{paddingTop:"0.75rem"}}>
        {rawKids.length===0?(
          <div style={{color:T.textSoft,fontSize:"0.82rem",lineHeight:1.6}}>No children added yet. Add them in the <strong>Family</strong> section above — then come back here to set up their chores and treasures.</div>
        ):(
          <div>
            <div style={{display:"flex",gap:"0.35rem",marginBottom:"0.75rem",flexWrap:"wrap"}}>
              {rawKids.map(function(k,i){
                return <button key={k.id} onClick={function(){setTpKidIdx(i);}} style={{...btnS({fontSize:"0.76rem",padding:"0.28rem 0.85rem",borderRadius:"99px"}),background:i===sKidIdx?T.sand:"transparent",color:i===sKidIdx?"#fff":T.textMid,borderColor:i===sKidIdx?T.sand:T.border}}>{k.name}</button>;
              })}
            </div>
            <div style={{display:"flex",gap:"0.35rem",marginBottom:"0.65rem"}}>
              {["chores","treasures"].map(function(t){
                return <button key={t} onClick={function(){setTpTab(t);}} style={{flex:1,padding:"0.38rem",borderRadius:"0.6rem",border:"none",background:tpTab===t?T.sand:"transparent",color:tpTab===t?"#fff":T.textMid,fontWeight:700,fontSize:"0.76rem",cursor:"pointer",fontFamily:"inherit",textTransform:"capitalize"}}>{t==="chores"?"🧹 Chores":"🎁 Treasures"}</button>;
              })}
            </div>
            {tpTab==="chores"&&(
              <div>
                {(sKidData.chores||[]).length===0&&<div style={{color:T.textSoft,fontSize:"0.8rem",marginBottom:"0.5rem"}}>No chores yet — add one below.</div>}
                {(sKidData.chores||[]).map(function(ch){
                  return(
                    <div key={ch.id} onClick={function(){toggleChore(ch.id);}} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.42rem 0.65rem",borderRadius:"0.6rem",border:"1px solid "+(ch.done?T.borderSoft:T.border),background:ch.done?T.surface:T.white,marginBottom:"0.3rem",fontSize:"0.83rem",cursor:"pointer",transition:"all 0.15s"}}>
                      <div style={{width:18,height:18,borderRadius:"50%",border:"1.5px solid "+(ch.done?T.sand:T.border),background:ch.done?T.sand:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
                        {ch.done&&<svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{flex:1,color:ch.done?T.textFaint:T.textDark,textDecoration:ch.done?"line-through":"none",transition:"all 0.15s"}}>{ch.name}</span>
                      <span style={{color:T.textSoft,fontSize:"0.76rem"}}>{ch.pts} 🐚</span>
                      <button onClick={function(e){e.stopPropagation();setNewChoreName(ch.name);setNewChorePts(ch.pts||1);setEditChoreId(ch.id);}} style={{background:"none",border:"none",cursor:"pointer",color:T.textMid,fontSize:"0.82rem",padding:"0 2px"}}>✎</button>
                      <button onClick={function(e){e.stopPropagation();updateSaved({chores:sKidData.chores.filter(function(c){return c.id!==ch.id;})});if(editChoreId===ch.id){setEditChoreId(null);setNewChoreName("");}}} style={{background:"none",border:"none",cursor:"pointer",color:T.rose,fontSize:"0.9rem",padding:"0 2px"}}>✕</button>
                    </div>
                  );
                })}
                <div style={{display:"flex",gap:"0.4rem",marginTop:"0.45rem"}}>
                  <input value={newChoreName}
                    onFocus={function(){AF_DEBUG&&console.log("[AF INPUT FOCUS] tidepool-chore");}}
                    onBlur={function(){AF_DEBUG&&console.log("[AF INPUT BLUR] tidepool-chore");}}
                    onChange={function(e){AF_DEBUG&&console.log("[AF INPUT CHANGE] tidepool-chore",e.target.value);setNewChoreName(e.target.value);}}
                    onKeyDown={function(e){if(e.key==="Enter"&&newChoreName.trim()){if(editChoreId){updateSaved({chores:(sKidData.chores||[]).map(function(c){return c.id===editChoreId?Object.assign({},c,{name:newChoreName.trim(),pts:newChorePts}):c;})});setEditChoreId(null);}else{updateSaved({chores:[...(sKidData.chores||[]),{id:uid(),name:newChoreName.trim(),pts:newChorePts,done:false}]});}setNewChoreName("");}}} placeholder={editChoreId?"Edit chore…":"New chore…"} style={{...inp({flex:1,fontSize:"0.8rem",padding:"0.38rem 0.6rem"})}}/>
                  <select value={newChorePts} onChange={function(e){setNewChorePts(parseInt(e.target.value));}} style={{...inp({width:74,padding:"0.38rem 0.4rem",fontSize:"0.8rem"})}}>
                    <option value={1}>1 🐚</option><option value={2}>2 🐚</option><option value={3}>3 🐚</option>
                  </select>
                  <button onClick={function(){if(newChoreName.trim()){if(editChoreId){updateSaved({chores:(sKidData.chores||[]).map(function(c){return c.id===editChoreId?Object.assign({},c,{name:newChoreName.trim(),pts:newChorePts}):c;})});setEditChoreId(null);}else{updateSaved({chores:[...(sKidData.chores||[]),{id:uid(),name:newChoreName.trim(),pts:newChorePts,done:false}]});}setNewChoreName("");}}} style={btnP(T.sand,{fontSize:"0.78rem",padding:"0.38rem 0.75rem"})}>{editChoreId?"Save":"Add"}</button>
                </div>
                {(function(){
                  var siblings=(saved||[]).filter(function(d){return d.kidId!==sKid.id&&d.chores&&d.chores.length>0;});
                  if(siblings.length===0) return null;
                  return(
                    <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginTop:"0.35rem"}}>
                      <span style={{color:T.textFaint,fontSize:"0.76rem",whiteSpace:"nowrap"}}>Copy from:</span>
                      {siblings.map(function(sib){
                        return(
                          <button key={sib.kidId} onClick={function(){
                            var existingNames=(sKidData.chores||[]).map(function(c){return c.name;});
                            var toAdd=sib.chores.filter(function(c){return !existingNames.includes(c.name);}).map(function(c){return {id:uid(),name:c.name,pts:c.pts,done:false};});
                            if(toAdd.length>0) updateSaved({chores:[...(sKidData.chores||[]),...toAdd]});
                          }} style={{background:"none",border:"1px solid "+T.borderSoft,borderRadius:"0.5rem",cursor:"pointer",color:T.textMid,fontSize:"0.74rem",padding:"0.22rem 0.55rem",fontFamily:"inherit"}}>
                            {sib.kidName}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
            {tpTab==="treasures"&&(
              <div>
                {(sKidData.treasures||[]).length===0&&<div style={{color:T.textSoft,fontSize:"0.8rem",marginBottom:"0.5rem"}}>No treasures yet — add some below.</div>}
                {(sKidData.treasures||[]).slice().sort(function(a,b){return a.cost-b.cost;}).map(function(t){
                  return(
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.42rem 0.65rem",borderRadius:"0.6rem",border:"1px solid "+T.borderSoft,background:T.white,marginBottom:"0.3rem",fontSize:"0.83rem"}}>
                      <span style={{fontSize:"1.05rem"}}>{t.icon}</span>
                      <span style={{flex:1,color:T.textDark}}>{t.name}</span>
                      <span style={{color:T.textSoft,fontSize:"0.76rem"}}>{t.cost} 🐚</span>
                      <button onClick={function(){setNewTreasureName(t.name);setNewTreasureCost(String(t.cost));setEditTreasureId(t.id);}} style={{background:"none",border:"none",cursor:"pointer",color:T.textMid,fontSize:"0.82rem",padding:"0 2px"}}>✎</button>
                      <button onClick={function(){updateSaved({treasures:(sKidData.treasures||[]).filter(function(x){return x.id!==t.id;})});if(editTreasureId===t.id){setEditTreasureId(null);setNewTreasureName("");setNewTreasureCost("");}}} style={{background:"none",border:"none",cursor:"pointer",color:T.rose,fontSize:"0.9rem",padding:"0 2px"}}>✕</button>
                    </div>
                  );
                })}
                <div style={{display:"flex",gap:"0.4rem",marginTop:"0.45rem"}}>
                  <input value={newTreasureName} onChange={function(e){setNewTreasureName(e.target.value);}} placeholder="New treasure…" style={{...inp({flex:1,fontSize:"0.8rem",padding:"0.38rem 0.6rem"})}}/>
                  <input value={newTreasureCost} onChange={function(e){setNewTreasureCost(e.target.value);}} type="number" min="1" max="99" placeholder="🐚" style={{...inp({width:58,fontSize:"0.8rem",padding:"0.38rem 0.4rem"})}}/>
                  <button onClick={function(){var cost=parseInt(newTreasureCost);if(!newTreasureName.trim()||!cost||cost<1)return;if(editTreasureId){updateSaved({treasures:(sKidData.treasures||[]).map(function(x){return x.id===editTreasureId?Object.assign({},x,{name:newTreasureName.trim(),cost:cost}):x;})});setEditTreasureId(null);}else{var icon=TREASURE_ICONS[(sKidData.treasures||[]).length%TREASURE_ICONS.length];updateSaved({treasures:[...(sKidData.treasures||[]),{id:uid(),name:newTreasureName.trim(),icon,cost}]});}setNewTreasureName("");setNewTreasureCost("");}} style={btnP(T.sand,{fontSize:"0.78rem",padding:"0.38rem 0.75rem"})}>{editTreasureId?"Save":"Add"}</button>
                </div>
                {rawKids.length>1&&(
                  <div style={{marginTop:"0.75rem",paddingTop:"0.65rem",borderTop:"1px solid "+T.borderSoft}}>
                    <div style={{fontSize:"0.7rem",color:T.textSoft,fontWeight:700,marginBottom:"0.35rem",textTransform:"uppercase",letterSpacing:"0.06em"}}>Copy from another child</div>
                    <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                      {rawKids.filter(function(_,i){return i!==sKidIdx;}).map(function(k){
                        return <button key={k.id} onClick={function(){var fromData=saved.find(function(d){return d.kidId===k.id;});if(!fromData)return;updateSaved({treasures:(fromData.treasures||[]).map(function(t){return Object.assign({},t,{id:uid()});})});}} style={{...btnS({fontSize:"0.74rem",padding:"0.28rem 0.8rem",borderRadius:"99px"})}}>Copy from {k.name}</button>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

function FamilySection({people,setPeople,familyProfile,setFamilyProfile,T,inp,btnP,PC,ROLES}){
  React.useEffect(function(){AF_DEBUG&&console.log("[AF MOUNT] FamilySection");return function(){AF_DEBUG&&console.log("[AF UNMOUNT] FamilySection");};},[]);
  var _fsRender=React.useRef(0);_fsRender.current++;AF_DEBUG&&console.count("[AF RENDER] Family-section");
  var [newMemberName,setNewMemberName]=useState("");
  var [newMemberBirthday,setNewMemberBirthday]=useState("");
  var [newMemberRole,setNewMemberRole]=useState("");
  var [settingsOpen,setSettingsOpen]=useState({family:true});
  function toggleSetting(key,defaultOpen){
    setSettingsOpen(function(p){
      var current=key in p?p[key]:(defaultOpen||false);
      return Object.assign({},p,{[key]:!current});
    });
  }
  function FRow({label,sub,children,tight}){
    return(
      <div style={{paddingTop:tight?"0.55rem":"0.75rem",paddingBottom:tight?"0.55rem":"0.1rem",borderBottom:"1px solid "+T.borderSoft}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.5rem"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:"0.85rem",fontWeight:600,color:T.textDark}}>{label}</div>
            {sub&&<div style={{fontSize:"0.72rem",color:T.textFaint,marginTop:1,lineHeight:1.45}}>{sub}</div>}
          </div>
          <div style={{flexShrink:0}}>{children}</div>
        </div>
      </div>
    );
  }
  function addMember(){
    if(!newMemberName.trim())return;
    var bday=newMemberBirthday.trim()||null;
    var derivedAge=ageFromBirthday(bday);
    setPeople(function(p){return[...p,{id:uid(),name:newMemberName.trim(),color:PC[p.length%PC.length],birthday:bday,age:derivedAge,role:newMemberRole||null,isMinor:derivedAge!=null&&derivedAge<18}];});
    setNewMemberName("");setNewMemberBirthday("");setNewMemberRole("");
  }
  return(
    <Section id="family" emoji="🏡" title="Family" sub="Who lives in your home" defaultOpen={true} settingsOpen={settingsOpen} toggleSetting={toggleSetting} T={T}>
      <div style={{paddingTop:"0.75rem"}}>
        {/* People list */}
        <div style={{fontSize:"0.68rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.55rem"}}>People in this home</div>
        {people.filter(function(p){return p&&p.id&&p.name;}).map(function(p){
          return(
            <div key={p.id} style={{padding:"0.65rem 0.75rem",borderRadius:"0.75rem",border:"1.5px solid "+T.borderSoft,background:T.surface,marginBottom:"0.4rem"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.45rem"}}>
                <div style={{width:14,height:14,borderRadius:"50%",background:p.color||T.blue,flexShrink:0}}/>
                <input
                  key={p.id+"_name"}
                  defaultValue={p.name}
                  onFocus={function(){AF_DEBUG&&console.log("[AF INPUT FOCUS] family-name-"+p.id);}}
                  onBlur={function(e){AF_DEBUG&&console.log("[AF INPUT BLUR] family-name-"+p.id);setPeople(function(prev){return prev.map(function(x){return x.id===p.id?Object.assign({},x,{name:e.target.value}):x;});});}}
                  onChange={function(e){AF_DEBUG&&console.log("[AF INPUT CHANGE] family-name",e.target.value);}}
                  style={{flex:1,border:"none",background:"transparent",fontSize:"0.88rem",fontWeight:700,color:T.textDark,fontFamily:"inherit",padding:0,outline:"none",minWidth:0}}
                />
                <button onClick={function(){setPeople(function(p2){return p2.filter(function(x){return x.id!==p.id;});});}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex",flexShrink:0}}>
                  <Icon name="trash" size={13} color={T.textFaint}/>
                </button>
              </div>
              <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap",alignItems:"center"}}>
                <input type="date" key={p.id+"_bday"} defaultValue={p.birthday||""} onBlur={function(e){var bday=e.target.value||null;var da=ageFromBirthday(bday);setPeople(function(prev){return prev.map(function(x){return x.id===p.id?Object.assign({},x,{birthday:bday,age:da,isMinor:da!=null&&da<18}):x;});});}} placeholder="Birthday" style={{...inp({width:130,fontSize:"0.76rem",padding:"0.2rem 0.4rem"})}}/>
                {p.birthday&&ageFromBirthday(p.birthday)!=null&&<span style={{fontSize:"0.72rem",color:T.textSoft,fontWeight:600}}>Age {ageFromBirthday(p.birthday)}</span>}
                {!p.birthday&&p.age!=null&&<span style={{fontSize:"0.72rem",color:T.textFaint,fontStyle:"italic"}} title="Age on file — add birthday for auto-updates">Age {p.age}</span>}
                <select value={p.role||""} onChange={function(e){setPeople(function(prev){return prev.map(function(x){return x.id===p.id?Object.assign({},x,{role:e.target.value||null}):x;});});}} style={{...inp({fontSize:"0.75rem",padding:"0.2rem 0.4rem",width:"auto"})}}>
                  <option value="">Role…</option>
                  {ROLES.map(function(r){return <option key={r} value={r}>{r}</option>;})}
                </select>
                <div style={{display:"flex",gap:"0.25rem",flexWrap:"wrap",alignItems:"center"}}>
                  {["#6A9BB5","#7a9e8e","#c4a882","#b87265","#8878b8","#7ab8a8","#c878a8","#e8a838","#6b9e6b","#4a7a9e"].map(function(c){return(
                    <button key={c} onClick={function(){setPeople(function(prev){return prev.map(function(x){return x.id===p.id?Object.assign({},x,{color:c}):x;});});}} style={{width:18,height:18,borderRadius:"50%",background:c,border:p.color===c?"3px solid "+T.textDark:"2px solid transparent",cursor:"pointer",transition:"border 0.15s",flexShrink:0}}/>
                  );})}
                  <label title="Custom color" style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+T.border,background:p.color,cursor:"pointer",flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                    <input type="color" value={p.color||"#6A9BB5"} onChange={function(e){var c=e.target.value;setPeople(function(prev){return prev.map(function(x){return x.id===p.id?Object.assign({},x,{color:c}):x;});});}} style={{opacity:0,position:"absolute",inset:0,width:"100%",height:"100%",cursor:"pointer",border:"none",padding:0}}/>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
        {/* Add member */}
        <div style={{background:T.surface,borderRadius:"0.85rem",padding:"0.65rem 0.75rem",border:"1.5px dashed "+T.border,marginBottom:"0.5rem"}}>
          <div style={{fontSize:"0.65rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.45rem"}}>Add someone</div>
          <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.4rem"}}>
            <input value={newMemberName}
              onFocus={function(){AF_DEBUG&&console.log("[AF INPUT FOCUS] family-addname");}}
              onBlur={function(){AF_DEBUG&&console.log("[AF INPUT BLUR] family-addname");}}
              onChange={function(e){AF_DEBUG&&console.log("[AF INPUT CHANGE] family-addname",e.target.value);setNewMemberName(e.target.value);}}
              onKeyDown={function(e){if(e.key==="Enter")addMember();}} placeholder="Name" style={{...inp({flex:1,fontSize:"0.82rem",padding:"0.38rem 0.6rem"})}}/>
            <input type="date" value={newMemberBirthday} onChange={function(e){setNewMemberBirthday(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")addMember();}} placeholder="Birthday" style={{...inp({width:130,fontSize:"0.82rem",padding:"0.38rem 0.5rem"})}}/>
          </div>
          <div style={{display:"flex",gap:"0.4rem"}}>
            <select value={newMemberRole} onChange={function(e){setNewMemberRole(e.target.value);}} style={{...inp({flex:1,fontSize:"0.8rem",padding:"0.38rem 0.5rem"})}}>
              <option value="">Role (optional)</option>
              {ROLES.map(function(r){return <option key={r} value={r}>{r}</option>;})}
            </select>
            <button onClick={addMember} style={btnP(T.sage,{padding:"0.38rem 0.9rem",fontSize:"0.82rem"})}>Add</button>
          </div>
        </div>
        {/* ZIP code + home vibe */}
        <FRow label="ZIP code" sub="For local weather and notification timing">
          <input defaultValue={(familyProfile&&familyProfile.zipcode)||""} onBlur={function(e){setFamilyProfile(function(p){return Object.assign({},p||{},{zipcode:e.target.value});});}} placeholder="e.g. 80903" style={{...inp({width:90,fontSize:"0.8rem",padding:"0.28rem 0.55rem",textAlign:"center"})}}/>
        </FRow>
        <FRow label="Home vibe" sub="Guides Compass's tone — calm, adventurous, faith-led…">
          <input defaultValue={(familyProfile&&familyProfile.homeVibe)||""} onBlur={function(e){setFamilyProfile(function(p){return Object.assign({},p||{},{homeVibe:e.target.value});});}} placeholder="e.g. calm & faith-led" style={{...inp({width:140,fontSize:"0.8rem",padding:"0.28rem 0.55rem"})}}/>
        </FRow>
      </div>
    </Section>
  );
}

function SettingsTab({people,setPeople,familyProfile,setFamilyProfile,flowMode,setFlowMode,flowGreetingTone,setFlowGreetingTone,mealCount,setMealCount,stores,setStores,rhythm,setRhythm,brainCats,setBrainCats,coveData,setCoveData,authUser,setAuthUser,preferredName,setPreferredName,notifSettings,setNotifSettings,setDailySummaryScheduled,tasks,meals,calEvents,goTab,notifPermission,requestNotifPermission,scheduleAllDailyNotifications,signOut,showInAppBanner,T,inp,lbl,btnP,btnS,PC,card,SecHead,ModalBox,themeName,setThemeNameRaw,setShowHouseholdModal,notifications,setNotifications,aiMemory,setAiMemory,setShowAuthModal,syncNow,lastSyncTime}){
  const [compassEnabled,setCompassEnabled] = useSaved("compassEnabled",true);
    React.useEffect(() => { AF_DEBUG&&console.log("[AF MOUNT] SettingsTab"); return () => AF_DEBUG&&console.log("[AF UNMOUNT] SettingsTab"); }, []);
  const _stRenderCount = React.useRef(0); _stRenderCount.current++; AF_DEBUG&&console.count("[AF RENDER] SettingsTab");
  React.useEffect(() => { AF_DEBUG&&console.log("[AF STATE CHANGE] people changed, SettingsTab render #" + _stRenderCount.current); }, [people]);
  React.useEffect(() => { AF_DEBUG&&console.log("[AF STATE CHANGE] familyProfile changed, SettingsTab render #" + _stRenderCount.current); }, [familyProfile]);
  React.useEffect(() => { AF_DEBUG&&console.log("[AF STATE CHANGE] stores changed, SettingsTab render #" + _stRenderCount.current); }, [stores]);
  React.useEffect(() => { AF_DEBUG&&console.log("[AF STATE CHANGE] T/theme changed, SettingsTab render #" + _stRenderCount.current); }, [T]);
  const [settingsOpen, setSettingsOpen] = useState({family:true});
  function toggleSetting(key,defaultOpen){
    setSettingsOpen(function(p){
      var current = key in p ? p[key] : (defaultOpen||false);
      return Object.assign({},p,{[key]:!current});
    });
  }

  // Section is defined outside SettingsTab (below) to avoid remount-on-rerender.
  // Pass settingsOpen + toggleSetting down explicitly.
  function Sec(props){ return Section(Object.assign({},props,{settingsOpen,toggleSetting,T})); }

  function Row({label,sub,children,tight}){
    return(
      <div style={{paddingTop:tight?"0.55rem":"0.75rem",paddingBottom:tight?"0.55rem":"0.1rem",borderBottom:"1px solid "+T.borderSoft}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.5rem"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:"0.85rem",fontWeight:600,color:T.textDark}}>{label}</div>
            {sub&&<div style={{fontSize:"0.72rem",color:T.textFaint,marginTop:1,lineHeight:1.45}}>{sub}</div>}
          </div>
          <div style={{flexShrink:0}}>{children}</div>
        </div>
      </div>
    );
  }
  function Toggle({on,onToggle,color}){
    return(
      <button onClick={onToggle} style={{width:44,height:24,borderRadius:"2rem",border:"none",cursor:"pointer",background:on?(color||T.sage):T.border,position:"relative",transition:"background 0.22s",flexShrink:0}}>
        <div style={{position:"absolute",top:3,left:on?23:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
      </button>
    );
  }
  function Pills({options,value,onChange,color}){
    return(
      <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap"}}>
        {options.map(function(o){
          var v=typeof o==="object"?o.value:o;
          var l=typeof o==="object"?(o.emoji?" "+o.emoji+" "+o.label:o.label):o;
          var sel=value===v;
          return <button key={v} onClick={()=>onChange(v)} style={{padding:"0.28rem 0.75rem",borderRadius:"50px",border:"1.5px solid "+(sel?(color||T.blue):T.border),background:sel?(color||T.blue)+"18":"transparent",color:sel?(color||T.blue):T.textMid,fontSize:"0.76rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>;
        })}
      </div>
    );
  }

  var ROLES=["Mom","Dad","Guardian","Kid","Teen","Baby","Grandparent","Roommate","Other"];

  // ── stores editing state ──
  var [editingStore,setEditingStore]=useState(null);
  var [storeEditVal,setStoreEditVal]=useState("");





  // ── school type per kid state ──
  // schoolData already persisted from SchoolTab — we read/write it here too
  var [sData,setSDataLocal]=useState(function(){
    try{var s=localStorage.getItem("af_schoolData");var parsed=s?JSON.parse(s):{};return parsed&&typeof parsed==="object"?parsed:{};}catch{return {};}
  });
  function setKidSchoolType(kidId,type){
    var next=Object.assign({},sData);
    if(!next[kidId]) next[kidId]={type:null,public:{teachers:[],calEvents:[],spiritDays:[],teacherAppWeek:{},schedule:"",notes:""},homeschool:{umbrella:{},curricula:[],lessons:[],activities:[],attendance:{}}};
    next[kidId]=Object.assign({},next[kidId],{type:type});
    setSDataLocal(next);
    try{localStorage.setItem("af_schoolData",JSON.stringify(next));}catch{}
  }

  var minorKids = people.filter(function(p){return p&&p.name&&personIsMinor(p);});

  return(
    <div>
      <SecHead emoji="⚙️" title="Settings" sub="Set it up once — Compass learns from everything here" onBack={function(){goTab("anchor");}}/>

      {/* ════════════════════════════════════
          1. FAMILY
      ════════════════════════════════════ */}
      <FamilySection
        people={people} setPeople={setPeople}
        familyProfile={familyProfile} setFamilyProfile={setFamilyProfile}
        T={T} inp={inp} btnP={btnP} PC={PC} ROLES={ROLES}
      />

      {/* ════════════════════════════════════
          2. FLOW (YOU)
      ════════════════════════════════════ */}
      <Sec id="flow" emoji="🌊" title="Flow — Your Preferences" sub="Name, tone, and daily defaults">
        <div style={{paddingTop:"0.75rem"}}>
          <Row label="What should Compass call you?" sub="Used in your morning anchor greeting">
            <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
              <input value={preferredName||""} onChange={function(e){setPreferredName(e.target.value);}} onBlur={function(e){var v=e.target.value.trim();setPreferredName(v);var updated=Object.assign({},authUser,{displayName:v||authUser&&authUser.displayName});setAuthUser(updated);try{localStorage.setItem("af_authUser",JSON.stringify(updated));}catch{};}} placeholder={familyProfile&&familyProfile.parentNames?familyProfile.parentNames.split(/[&,]/)[0].trim():"e.g. Lindsey"} style={{...inp({width:110,fontSize:"0.8rem",padding:"0.28rem 0.55rem"})}}/>
            </div>
          </Row>
          <Row label="Compass AI" sub="Daily briefing, suggestions, and Ask Compass">
            <Toggle on={compassEnabled!==false} onToggle={function(){setCompassEnabled(compassEnabled===false?true:false);}} color={T.sage}/>
          </Row>
          <div style={{paddingTop:"0.75rem",paddingBottom:"0.5rem",borderBottom:"1px solid "+T.borderSoft}}>
            <div style={{fontSize:"0.85rem",fontWeight:600,color:T.textDark,marginBottom:"0.45rem"}}>Greeting tone</div>
            <Pills options={[{value:"warm",label:"Warm",emoji:"🌿"},{value:"calm",label:"Calm",emoji:"🌊"},{value:"motivating",label:"Energising",emoji:"⚡"},{value:"gentle",label:"Gentle",emoji:"🕊️"}]} value={flowGreetingTone} onChange={setFlowGreetingTone} color={T.blue}/>
          </div>
          <div style={{paddingTop:"0.75rem",paddingBottom:"0.5rem",borderBottom:"1px solid "+T.borderSoft}}>
            <div style={{fontSize:"0.85rem",fontWeight:600,color:T.textDark,marginBottom:"0.45rem"}}>Flow mode default</div>
            <Pills options={[{value:"Smooth",label:"Smooth",emoji:"🌊"},{value:"Busy",label:"Busy",emoji:"⚡"},{value:"Survival",label:"Survival",emoji:"🆘"}]} value={flowMode} onChange={setFlowMode} color={T.sage}/>
          </div>
          <div style={{paddingTop:"0.75rem",paddingBottom:"0.5rem"}}>
            <div style={{fontSize:"0.85rem",fontWeight:600,color:T.textDark,marginBottom:"0.2rem"}}>Turn on notifications</div>
            <div style={{fontSize:"0.72rem",color:T.textFaint,marginBottom:"0.55rem"}}>Compass will check in with you throughout the day</div>
            {notifPermission==="denied"&&<div style={{fontSize:"0.78rem",color:T.rose,lineHeight:1.5}}>🚫 Notifications are blocked — open browser settings → Site permissions to allow.</div>}
            {notifPermission==="default"&&<button onClick={requestNotifPermission} style={{...btnP(T.sage,{fontSize:"0.82rem",padding:"0.5rem 1.1rem"})}}>🔔 Enable Compass notifications</button>}
            {notifPermission==="granted"&&<div style={{fontSize:"0.8rem",color:T.sage,fontWeight:700}}>✅ Notifications are on</div>}
          </div>
        </div>
      </Sec>

      {/* ════════════════════════════════════
          3. MIND
      ════════════════════════════════════ */}
      <Sec id="mind" emoji="💭" title="Mind" sub="Clear Your Mind categories and defaults">
        <div style={{paddingTop:"0.75rem"}}>
          <div style={{paddingBottom:"0.75rem",borderBottom:"1px solid "+T.borderSoft,marginBottom:"0.5rem"}}>
            <div style={{fontSize:"0.85rem",fontWeight:600,color:T.textDark,marginBottom:"0.45rem"}}>Default view</div>
            <Pills options={[{value:"all",label:"All entries"},{value:"mine",label:"My list only"}]} value={(familyProfile&&familyProfile.mindDefault)||"all"} onChange={function(v){setFamilyProfile(function(p){return Object.assign({},p||{},{mindDefault:v});});}} color={T.lavender}/>
          </div>
          <div style={{fontSize:"0.82rem",fontWeight:600,color:T.textDark,marginBottom:"0.5rem"}}>Categories & colours</div>
          <BrainCatsEditor brainCats={brainCats} setBrainCats={setBrainCats} T={T} inp={inp} btnP={btnP}/>
        </div>
      </Sec>

      {/* ════════════════════════════════════
          4. MEALS
      ════════════════════════════════════ */}
      <Sec id="meals" emoji="🍽️" title="Meals" sub="Planning preferences, dietary needs, and go-to dinners">
        <div style={{paddingTop:"0.75rem"}}>
          <div style={{paddingBottom:"0.65rem",borderBottom:"1px solid "+T.borderSoft,marginBottom:"0.1rem"}}>
            <div style={{fontSize:"0.85rem",fontWeight:600,color:T.textDark,marginBottom:"0.45rem"}}>How many meals do you plan each day?</div>
            <Pills options={[{value:1,label:"Dinner only"},{value:2,label:"Lunch + Dinner"},{value:3,label:"All 3 meals"}]} value={mealCount} onChange={setMealCount} color={T.sage}/>
          </div>

          <Row label="Go-to dinners" sub="Your family's favourite meals — separate with commas">
          </Row>
          <input defaultValue={(familyProfile&&familyProfile.favoriteDinner)||""} onBlur={function(e){setFamilyProfile(function(p){return Object.assign({},p||{},{favoriteDinner:e.target.value});});}} placeholder="e.g. Tacos, sheet pan chicken, pasta" style={{...inp({width:"100%",fontSize:"0.82rem",marginTop:"0.35rem",marginBottom:"0.65rem"})}}/>
          <Row label="Dietary needs" sub="Allergies, intolerances, or preferences">
          </Row>
          <input defaultValue={(familyProfile&&familyProfile.dietaryNeeds)||""} onBlur={function(e){setFamilyProfile(function(p){return Object.assign({},p||{},{dietaryNeeds:e.target.value});});}} placeholder="e.g. Dairy-free, nut allergy" style={{...inp({width:"100%",fontSize:"0.82rem",marginTop:"0.35rem",marginBottom:"0.65rem"})}}/>
          <Row label="Cooking style" sub="Helps Compass suggest appropriate recipes">
          </Row>
          <input defaultValue={(familyProfile&&familyProfile.cookingStyle)||""} onBlur={function(e){setFamilyProfile(function(p){return Object.assign({},p||{},{cookingStyle:e.target.value});});}} placeholder="e.g. Quick & simple, batch cook weekends" style={{...inp({width:"100%",fontSize:"0.82rem",marginTop:"0.35rem"})}}/>
        </div>
      </Sec>

      {/* ════════════════════════════════════
          5. SHOPPING
      ════════════════════════════════════ */}
      <Sec id="shopping" emoji="🛒" title="Shopping" sub="Your 4 default stores">
        <div style={{paddingTop:"0.75rem"}}>
          <div style={{fontSize:"0.78rem",color:T.textSoft,lineHeight:1.55,marginBottom:"0.75rem"}}>These show as tabs on your shopping list. Tap to rename any store.</div>
          {stores.map(function(store,i){
            return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.5rem 0.7rem",borderRadius:"0.7rem",border:"1.5px solid "+T.borderSoft,background:T.surface,marginBottom:"0.4rem"}}>
                <span style={{fontSize:"0.95rem"}}>🛒</span>
                {editingStore===i?(
                  <input autoFocus value={storeEditVal} onChange={function(e){setStoreEditVal(e.target.value);}} onBlur={function(){if(storeEditVal.trim()){setStores(function(p){var n=[...p];n[i]=storeEditVal.trim();return n;});}setEditingStore(null);}} onKeyDown={function(e){if(e.key==="Enter"){if(storeEditVal.trim()){setStores(function(p){var n=[...p];n[i]=storeEditVal.trim();return n;});}setEditingStore(null);}}} style={{...inp({flex:1,fontSize:"0.85rem",padding:"0.22rem 0.5rem"})}}/>
                ):(
                  <span onClick={function(){setEditingStore(i);setStoreEditVal(store);}} style={{flex:1,fontSize:"0.85rem",fontWeight:600,color:T.textDark,cursor:"pointer"}}>{store}</span>
                )}
                <button onClick={function(){setEditingStore(i);setStoreEditVal(store);}} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:"0.75rem",padding:"2px 5px"}}>✏️</button>
                <button onClick={function(){setStores(function(p){return p.filter(function(_,j){return j!==i;});});}} style={{background:"none",border:"none",cursor:"pointer",color:T.rose,fontSize:"0.85rem",padding:"2px 5px"}}>✕</button>
              </div>
            );
          })}
          {stores.length<6&&(
            <button onClick={function(){setStores(function(p){return [...p,"New Store"];});setEditingStore(stores.length);setStoreEditVal("New Store");}} style={{...btnS({fontSize:"0.8rem",padding:"0.38rem 0.85rem",display:"flex",alignItems:"center",gap:"0.35rem",marginTop:"0.2rem"})}}>
              <Icon name="plus" size={13} color={T.textMid}/> Add store
            </button>
          )}
        </div>
      </Sec>

      {/* ════════════════════════════════════
          6. TIDE POOL
      ════════════════════════════════════ */}
      <TidePoolSection
        people={people} coveData={coveData} setCoveData={setCoveData}
        T={T} inp={inp} btnP={btnP} btnS={btnS}
      />

      {/* ════════════════════════════════════
      {/* ════════════════════════════════════
          7. WEEKLY RHYTHM
      ════════════════════════════════════ */}
      <WeeklyRhythmSection
        rhythm={rhythm} setRhythm={setRhythm}
        T={T} inp={inp} btnP={btnP} btnS={btnS} lbl={lbl} ModalBox={ModalBox}
      />

      {/* ════════════════════════════════════
          8. SCHOOL
      ════════════════════════════════════ */}
      <Sec id="school" emoji="📚" title="School" sub="School type and settings for each child">
        <div style={{paddingTop:"0.75rem"}}>
          {minorKids.length===0&&(
            <div style={{color:T.textSoft,fontSize:"0.82rem",lineHeight:1.6}}>Add children in the <strong>Family</strong> section above to set up school preferences.</div>
          )}
          {minorKids.map(function(kid){
            var kidD = (sData||{})[kid.id];
            var currentType = kidD&&kidD.type;
            var SCHOOL_TYPES = [
              {value:"homeschool", label:"Homeschool",      emoji:"🏠", desc:"Learning at home — full curriculum"},
              {value:"public",     label:"Public school",   emoji:"🏫", desc:"Standard public school"},
              {value:"private",    label:"Private school",  emoji:"🎓", desc:"Private or charter school"},
              {value:"co-op",      label:"Co-op / hybrid",  emoji:"🤝", desc:"Mix of home and group learning"},
              {value:"online",     label:"Online school",   emoji:"💻", desc:"Accredited online program"},
              {value:"other",      label:"Other",           emoji:"📋", desc:"Something else entirely"},
            ];
            return(
              <div key={kid.id} style={{marginBottom:"0.85rem",padding:"0.75rem",borderRadius:"0.9rem",border:"1.5px solid "+T.borderSoft,background:T.surface}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.65rem"}}>
                  <div style={{width:12,height:12,borderRadius:"50%",background:kid.color||T.blue,flexShrink:0}}/>
                  <span style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem"}}>{kid.name}</span>
                  {personAge(kid)!=null&&<span style={{fontSize:"0.68rem",fontWeight:700,color:T.textSoft}}>Age {personAge(kid)}</span>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"0.3rem"}}>
                  {SCHOOL_TYPES.map(function(type){
                    var selected = currentType===type.value;
                    return(
                      <button key={type.value} onClick={function(){setKidSchoolType(kid.id,selected?null:type.value);}} style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.55rem 0.75rem",borderRadius:"0.7rem",border:"1.5px solid "+(selected?T.blue:T.border),background:selected?T.bluePale:"transparent",cursor:"pointer",fontFamily:"inherit",textAlign:"left",width:"100%",transition:"all 0.15s"}}>
                        <span style={{fontSize:"1.05rem",flexShrink:0}}>{type.emoji}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:"0.84rem",fontWeight:700,color:selected?T.blue:T.textDark}}>{type.label}</div>
                          <div style={{fontSize:"0.7rem",color:T.textFaint}}>{type.desc}</div>
                        </div>
                        <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+(selected?T.blue:T.border),background:selected?T.blue:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {selected&&<div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Sec>

      {/* ════════════════════════════════════
          9. APPEARANCE & NOTIFICATIONS
      ════════════════════════════════════ */}
      <Sec id="appearance" emoji="🎨" title="Appearance & Notifications" sub="Theme and notification schedule">
        <div style={{paddingTop:"0.75rem"}}>
          <div style={{fontSize:"0.8rem",fontWeight:700,color:T.textDark,marginBottom:"0.55rem"}}>Theme</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0.55rem",marginBottom:"1rem"}}>
            {Object.entries(THEMES).map(function(entry){
              var key=entry[0];var th=entry[1];
              return(
                <button key={key} onClick={()=>setThemeNameRaw(key)} style={{background:themeName===key?T.blue:T.white,color:themeName===key?"#fff":T.textDark,border:"2px solid "+(themeName===key?T.blue:T.border),borderRadius:"0.9rem",padding:"0.75rem 0.5rem",cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",textAlign:"center"}}>
                  <div style={{fontSize:"1.4rem",marginBottom:"0.25rem"}}>{th.emoji}</div>
                  <div style={{fontWeight:700,fontSize:"0.78rem"}}>{th.label}</div>
                </button>
              );
            })}
          </div>
          <div style={{height:"1px",background:T.borderSoft,margin:"0.75rem 0"}}/>
          <div style={{fontSize:"0.8rem",fontWeight:700,color:T.textDark,marginBottom:"0.2rem"}}>Notification schedule</div>
          <div style={{fontSize:"0.72rem",color:T.textFaint,marginBottom:"0.65rem"}}>Compass sends warm check-ins throughout your day</div>
          {(function(){
            var NOTIF_LIST = [
              {key:"morning",  time:"7:00 am",     emoji:"🌅", label:"Morning anchor",      desc:"Your agenda, tasks & events for the day"},
              {key:"midday",   time:"12:00 pm",    emoji:"🌊", label:"Midday check-in",     desc:"Progress update & encouragement"},
              {key:"dinner",   time:"3:00 pm",     emoji:"🍽️", label:"Dinner heads-up",     desc:"Defrost reminder & meal prep nudge"},
              {key:"evening",  time:"5:00 pm",     emoji:"🌙", label:"Evening recap",       desc:"Day summary + tomorrow preview"},
              {key:"events",   time:"2hrs before", emoji:"⏰", label:"Event nudges",        desc:"Smart reminder before each appointment"},
              {key:"recurring",time:"varies",      emoji:"🔁", label:"Recurring reminders", desc:"Trash, HVAC, street sweeping, custom"},
            ];
            return(
              <div style={{borderRadius:"0.9rem",border:"1px solid "+T.borderSoft,overflow:"hidden",marginBottom:"0.65rem"}}>
                {NOTIF_LIST.map(function(n,i){
                  var on = notifSettings[n.key]!==false;
                  return(
                    <div key={n.key} style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.62rem 0.9rem",borderBottom:i<NOTIF_LIST.length-1?"1px solid "+T.borderSoft:"none",background:on?"transparent":T.bgAlt+"60"}}>
                      <span style={{fontSize:"1rem",flexShrink:0,opacity:on?1:0.4}}>{n.emoji}</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,color:on?T.textDark:T.textFaint,fontSize:"0.82rem"}}>{n.label}</div>
                        <div style={{color:T.textSoft,fontSize:"0.7rem"}}>{n.desc} · <span style={{color:T.textFaint}}>{n.time}</span></div>
                      </div>
                      <Toggle on={on} onToggle={function(){setNotifSettings(function(p){var next=Object.assign({},p||{});next[n.key]=!on;return next;});setTimeout(function(){setDailySummaryScheduled(null);scheduleAllDailyNotifications();},100);}} color={T.sage}/>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {notifPermission==="granted"&&(
            <div style={{display:"flex",gap:"0.4rem"}}>
              <button onClick={()=>{setDailySummaryScheduled(null);scheduleAllDailyNotifications();}} style={btnP(T.blue,{fontSize:"0.76rem",padding:"0.4rem 0.85rem",flex:1,justifyContent:"center"})}>🔄 Reschedule today</button>
              <button onClick={()=>{var todayTasks=tasks.filter(function(t){return (t.day===TODAY_NAME||t.day==="Daily")&&!t.archived;});var todayMeal=(meals[TODAY_NAME]||{}).dinner;var todayEvts=calEvents.filter(function(e){return e.date===TODAY.toISOString().split("T")[0];});showInAppBanner("🌅 Morning anchor preview",(todayEvts.length>0?"First up: "+todayEvts[0].title+". ":"")+(todayTasks.filter(function(t){return !t.done;}).length+" tasks today.")+(todayMeal?" Dinner: "+todayMeal:""));}} style={btnS({fontSize:"0.76rem",padding:"0.4rem 0.85rem",flex:1})}>Preview</button>
            </div>
          )}
          {notifications.filter(function(n){return !n.fired;}).length>0&&(
            <div style={{marginTop:"0.85rem"}}>
              <div style={{fontSize:"0.68rem",color:T.textSoft,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.35rem"}}>Upcoming reminders</div>
              {notifications.filter(function(n){return !n.fired;}).map(function(n){return(
                <div key={n.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.38rem 0",borderBottom:"1px solid "+T.borderSoft}}>
                  <span style={{fontSize:"0.8rem"}}>🔔</span>
                  <span style={{flex:1,fontSize:"0.8rem",color:T.textDark,fontWeight:600}}>{n.entityTitle}</span>
                  <span style={{fontSize:"0.7rem",color:T.textSoft}}>{n.date} {n.time}</span>
                  <button onClick={()=>setNotifications(function(p){return p.filter(function(x){return x.id!==n.id;});})} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={11} color={T.textFaint}/></button>
                </div>
              );})}
            </div>
          )}
        </div>
      </Sec>

      {/* ════════════════════════════════════
          Sign In & Sync — always last
      ════════════════════════════════════ */}
      <Sec id="sync" emoji="🔐" title="Sign In & Sync" sub="Sync across devices and with your household">
        <div style={{paddingTop:"0.75rem"}}>
        {false ? (
          <div>
            <p style={{color:T.textMid,fontSize:"0.82rem",lineHeight:1.65,marginBottom:"0.85rem"}}>Sign in to sync your household across multiple devices and share with your partner.</p>
            <button onClick={()=>setShowAuthModal(true)} style={btnP("linear-gradient(135deg,"+T.blue+","+T.blueDark+")",{width:"100%",padding:"0.8rem",fontSize:"0.9rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem",marginBottom:"0.5rem"})}>
              ⚓️ Sign in / Create account
            </button>
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.65rem 0.85rem",background:T.white,borderRadius:"0.75rem",marginBottom:"0.75rem",border:"1px solid "+T.borderSoft}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,"+T.blue+","+T.sage+")",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{color:"#fff",fontWeight:800,fontSize:"0.9rem"}}>{((authUser&&(authUser.displayName||authUser.email)||"?").charAt(0)).toUpperCase()}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem"}}>{authUser&&(authUser.displayName||authUser.email)||"Signed in"}</div>
                <div style={{color:T.textSoft,fontSize:"0.74rem"}}>{authUser&&authUser.email||""}</div>
              </div>
            <button onClick={function(){
                var data = {};
                Object.keys(localStorage).forEach(function(k){ if(k.startsWith("af_")) data[k] = localStorage.getItem(k); });
                var blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
                var url = URL.createObjectURL(blob);
                var a = document.createElement("a");
                a.href = url;
                a.download = "anchor-flow-backup-" + new Date().toISOString().slice(0,10) + ".json";
                a.click();
                URL.revokeObjectURL(url);
              }} style={btnS({fontSize:"0.73rem",padding:"0.28rem 0.65rem",color:T.sage})}>Export Backup</button>
              <button onClick={function(){
                var input = document.createElement("input");
                input.type = "file";
                input.accept = ".json";
                input.onchange = function(e){
                  var file = e.target.files[0];
                  if(!file) return;
                  var reader = new FileReader();
                  reader.onload = function(ev){
                    try {
                      var data = JSON.parse(ev.target.result);
                      if(!data || typeof data !== "object") { alert("Invalid backup file."); return; }
                      var keys = Object.keys(data).filter(function(k){ return k.startsWith("af_"); });
                      if(keys.length < 5) { alert("This backup looks incomplete. Import cancelled."); return; }
                      if(!window.confirm("This will restore " + keys.length + " data keys from your backup. Continue?")) return;
                      keys.forEach(function(k){ try { localStorage.setItem(k, data[k]); } catch {} });
                      // af_safe_harbor: apply the same defensive guards as loadData().
                      // If the value is bad JSON, null, a non-object, or an array, remove it
                      // so loadData() reconstructs clean defaults on the next mount (never crashes).
                      // The export enumerates all af_* keys via Object.keys(localStorage), so
                      // af_safe_harbor, af_sh_remind, and af_safe_harbor_v2 are all included
                      // automatically — no explicit listing needed on the export side.
                      if (data["af_safe_harbor"] !== undefined) {
                        var _shOk = false;
                        try { var _shP = JSON.parse(data["af_safe_harbor"]); _shOk = _shP !== null && typeof _shP === "object" && !Array.isArray(_shP); } catch(_e2) {}
                        if (!_shOk) { try { localStorage.removeItem("af_safe_harbor"); } catch {} }
                      }
                      AF_DEBUG&&console.log("[AF SAFETY] restore available — imported", keys.length, "keys");
                      alert("Backup restored. Reloading...");
                      window.location.reload();
                    } catch(err) { alert("Could not read backup file: " + err.message); }
                  };
                  reader.readAsText(file);
                };
                input.click();
              }} style={btnS({fontSize:"0.73rem",padding:"0.28rem 0.65rem",color:T.blue})}>Import Backup</button>
              <button onClick={signOut} style={btnS({fontSize:"0.73rem",padding:"0.28rem 0.65rem",color:T.rose})}>Sign out</button>
            </div>
            {lastSyncTime&&<p style={{fontSize:"0.74rem",color:T.sage,fontWeight:700,marginBottom:"0.65rem"}}>Last synced: {lastSyncTime}</p>}
            <div style={{display:"flex",gap:"0.4rem"}}>
              <button onClick={()=>setShowHouseholdModal(true)} style={btnP(T.blue,{flex:1,fontSize:"0.8rem",padding:"0.55rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.3rem"})}>
                👥 Manage household
              </button>
              <button onClick={syncNow} style={btnS({fontSize:"0.8rem",padding:"0.55rem 0.85rem",display:"flex",alignItems:"center",gap:"0.3rem"})}>
                <Icon name="sync" size={13} color={T.textMid}/> Sync
              </button>
            </div>
          </div>
        )}
        </div>
      </Sec>

      {/* AI memory */}
      {Object.keys(aiMemory).length>0&&(
        <Sec id="aimemory" emoji="🧠" title="What Compass Knows" sub="Learned from your conversations">
          <div style={{paddingTop:"0.75rem"}}>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"0.55rem"}}>
              <button onClick={()=>setAiMemory({})} style={btnS({fontSize:"0.72rem",padding:"0.24rem 0.6rem",color:T.rose})}>Clear all</button>
            </div>
            {Object.entries(aiMemory).map(function(entry,i){return(
              <div key={i} style={{padding:"0.5rem 0",borderBottom:"1px solid "+T.borderSoft}}>
                <div style={{fontSize:"0.72rem",color:T.textSoft,fontWeight:600,marginBottom:"0.15rem"}}>{entry[0]}</div>
                <div style={{fontSize:"0.84rem",color:T.textDark,fontWeight:500}}>{entry[1]}</div>
              </div>
            );})}
          </div>
        </Sec>
      )}

      <div style={{...card({background:T.bluePale,border:"2px solid "+T.blue+"55",textAlign:"center",padding:"1.8rem"})}}>
        <AnchorLogo size={44} color={T.blue}/>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.3rem",fontWeight:700,color:T.textDark,marginTop:"0.65rem",letterSpacing:"0.06em"}}>ANCHOR & FLOW</div>
        <div style={{color:T.textSoft,fontSize:"0.8rem",fontStyle:"italic",marginTop:"0.15rem",fontFamily:"'Cormorant Garamond',serif"}}>A steadier home, in every season</div>
        <p style={{color:T.textMid,fontSize:"0.8rem",lineHeight:1.72,marginTop:"0.85rem",marginBottom:0}}>Data saved locally · AI powered by Claude · Native app coming soon</p>
        <p style={{color:T.textFaint,fontSize:"0.62rem",fontFamily:"monospace",marginTop:"0.35rem",marginBottom:0,textAlign:"center"}}>{APP_VERSION}</p>
        <p style={{color:T.textFaint,fontSize:"0.62rem",fontFamily:"monospace",marginTop:"0.1rem",marginBottom:0,textAlign:"center"}}>{"Build: "+BUILD_STAMP}</p>
      </div>
    </div>
  );
}


// ── Supabase token refresh ──────────────────────────────────────────────────
// Let the SDK own token refresh entirely — never manually call the token endpoint.
// getSession() returns the cached session WITHOUT validating expiry — the access
// token it returns may be expired. Always check the JWT exp claim before trusting it.
// refreshSession() is the only call that actually refreshes; it consumes the
// refresh token (single-use), so _refreshInFlight prevents concurrent callers from
// racing and double-consuming it.
var _refreshInFlight = null;
async function refreshAuthToken() {
  if (_refreshInFlight) return _refreshInFlight;
  const p = (async function() {
    try {
      const { data: sd } = await supabase.auth.getSession();
      if (sd?.session?.access_token) {
        // getSession() does not refresh expired tokens — check exp before trusting it.
        let stillValid = false;
        try {
          const exp = JSON.parse(atob(sd.session.access_token.split('.')[1])).exp;
          stillValid = exp * 1000 > Date.now() + 10000; // valid for at least 10 more seconds
        } catch(e) { /* malformed JWT — treat as expired, fall through to refreshSession() */ }
        if (stillValid) {
          try { localStorage.setItem("af_authToken", JSON.stringify(sd.session.access_token)); } catch {}
          AF_DEBUG && console.log("[AF AUTH] token from SDK getSession() — still valid");
          return sd.session.access_token;
        }
        AF_DEBUG && console.log("[AF AUTH] getSession() token expired — falling through to refreshSession()");
      }
      // No session, or cached token expired — attempt a real refresh
      const { data: rd, error: re } = await supabase.auth.refreshSession();
      if (rd?.session?.access_token) {
        try { localStorage.setItem("af_authToken", JSON.stringify(rd.session.access_token)); } catch {}
        AF_DEBUG && console.log("[AF AUTH] token from SDK refreshSession()");
        return rd.session.access_token;
      }
      // Both paths failed — hard auth failure, force re-login
      AF_DEBUG && console.warn("[AF AUTH] hard auth failure — signing out to force re-login", re && re.message);
      try { localStorage.removeItem("af_authToken"); } catch {}
      try { localStorage.removeItem("af_authUser"); } catch {}
      supabase.auth.signOut().catch(() => {}); // fires SIGNED_OUT → Fix 3 clears the rest
      return null;
    } catch(e) {
      AF_DEBUG && console.warn("[AF AUTH] token refresh error (network/unexpected)"); // message omitted: may contain auth details
      // Unexpected error (e.g. network failure). Clear manual token copy so callers
      // don't retry with a stale value, but don't force signOut — SDK session may
      // still be valid if the error was transient.
      try { localStorage.removeItem("af_authToken"); } catch {}
      return null;
    } finally {
      _refreshInFlight = null;
    }
  })();
  _refreshInFlight = p;
  return p;
}

// Hydration guard flag — see setSaved. True until ~1.5s after first mount.
let _afHydrating = true;
function _afEndHydration(){ _afHydrating = false; }

// Keys that must never be marked dirty — system/session state, not user data.
// Defined at module scope so markKeyDirty and setSaved share a single list.
var _DIRTY_EXCLUDE = ["authToken","authUser","refreshToken","householdId","householdOwnerId",
  "dailySummaryScheduled","lastSeenDate","checkedCalEvents","checkedMealItems",
  "insights","insightsBuilt","dismissedInsights","lastHHSync","lastPushedAt",
  "deviceId","dirtyKeys","theme","activeTab"];

// Shared dirty-marker for bespoke writers that bypass useSaved (e.g. saveWorkDays,
// saveCalMarkers). Respects the hydration guard and the exclude list exactly the
// way setSaved does, so all dirty-marking logic lives in one place.
function markKeyDirty(key) {
  if (_afHydrating) return;
  if (_DIRTY_EXCLUDE.indexOf(key) !== -1) return;
  try {
    var dirty = JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]");
    if (dirty.indexOf(key) === -1) {
      dirty.push(key);
      localStorage.setItem("af_dirtyKeys", JSON.stringify(dirty));
      AF_DEBUG&&console.log("[AF DIRTY] marked dirty:", key);
    }
  } catch(e) {}
}

function useSaved(key, fallback) {
  const [val, setVal] = useState(() => {
    try {
      const s = localStorage.getItem("af_" + key);
      if (!s) return fallback;
      const parsed = JSON.parse(s);
      // If parsed is null/undefined, return fallback instead
      // This handles the case where "null" is stored as a string
      if (parsed === null || parsed === undefined) return fallback;
      // If fallback is an array, ensure we return an array not null
      if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
      return parsed;
    }
    catch { return fallback; }
  });
  // ── Hydration guard ──────────────────────────────────────────────────
  // During initial mount, many setters fire with normalized/default values as
  // the app hydrates from localStorage (e.g. weatherLocation, familyProfile).
  // Those are NOT user edits and must not mark keys dirty — otherwise a push
  // fires on every load, advancing the server timestamp, which makes the poll
  // reload, which re-fires the setters: an infinite reload loop. While
  // _afHydrating is true, dirty-marking is suppressed. A mount effect flips it
  // false a moment after first render so real edits sync normally.
  function setSaved(next) {
    // Use React's functional updater so we always operate on the latest state,
    // avoiding stale-closure bugs when setSaved is called inside timeouts or
    // rapid successive updates (e.g. AnchorCheckItem animation + toggle).
    setVal(prev => {
      const resolved = typeof next === "function" ? next(prev) : next;
      try { localStorage.setItem("af_" + key, JSON.stringify(resolved)); } catch {}
      // Mark this key dirty so only this device pushes its own changes
      // Exclude system/session keys that are not user data (_DIRTY_EXCLUDE is module-scope)
      if (!_afHydrating && !_DIRTY_EXCLUDE.includes(key)) {
        try {
          const dirty = JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]");
          if (!dirty.includes(key)) {
            dirty.push(key);
            localStorage.setItem("af_dirtyKeys", JSON.stringify(dirty));
            AF_DEBUG&&console.log("[AF DIRTY] marked dirty:", key);
          }
        } catch {}
      }
      return resolved;
    });
  }
  return [val, setSaved];
}

// ── Stable component wrappers ─────────────────────────────────────────────────
// Created once at module level. React sees the same type across HomeFlow renders
// so it UPDATES instead of unmounting+remounting the component. The actual render
// logic lives in _hfRenders.X which is a fresh closure on each HomeFlow render.
const _hfRenders = {};
const _hfComps   = {};
[
  'Pill','SecHead',
  'ModalBox','PersonPill','AnchorCheckItem','TaskRow','DraggableTaskList',
  'ShopItemRow','BrainItemRow','AIChatPanel','TodaySnapshot','OnboardingWizard',
  'DailyBriefingModal','EndOfDayReset','AnchorTab','CalendarTab','WeeklyTab',
  'MealBankDrawer','WeekTypePicker','MealsTab','ShoppingTab','HomeTab','BrainTab',
  'BurnoutTab','TidePoolTab','SettingSection','CareerTab','ItemRow','CoveTab',
  'SchoolTab','GoogleCalendarModal','AuthModal','HouseholdModal','CalEventFormModal',
  'SetPasswordModal',
].forEach(n => {
  _hfComps[n] = function(p){ return _hfRenders[n](p); };
  Object.defineProperty(_hfComps[n], 'name', { value: n });
});

function HomeFlow() {

  const [themeName, setThemeNameRaw] = useSaved("theme", "calm");
  if (!THEMES[themeName]) {
    AF_DEBUG && console.warn("[AF THEME] Invalid theme — falling back to coastal");
  }
  const safeThemeName = THEMES[themeName] ? themeName : "coastal";
  const T = THEMES[safeThemeName];

  const inp  = (x={}) => ({width:"100%",background:T.inputBg,border:`1.5px solid ${T.border}`,borderRadius:"0.7rem",padding:"0.62rem 0.82rem",color:T.textDark,fontSize:"0.87rem",outline:"none",boxSizing:"border-box",fontFamily:"inherit",...x});
  const lbl  = {display:"block",color:T.textMid,fontSize:"0.71rem",marginBottom:"0.35rem",textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700};
  const btnP = (bg,x={}) => ({background:bg||T.blue,color:"#fff",border:"none",borderRadius:"0.7rem",padding:"0.56rem 1.1rem",cursor:"pointer",fontWeight:700,fontSize:"0.84rem",fontFamily:"inherit",letterSpacing:"0.01em",...x});
  const btnS = (x={}) => ({background:T.white,color:T.textMid,border:`1.5px solid ${T.border}`,borderRadius:"0.7rem",padding:"0.56rem 1.1rem",cursor:"pointer",fontSize:"0.84rem",fontFamily:"inherit",fontWeight:600,...x});
  const card = (x={}) => ({background:T.surface,border:`1px solid ${T.borderSoft}`,borderRadius:"1.1rem",padding:"1.25rem",marginBottom:"0.85rem",boxShadow:`0 2px 10px ${T.cardShadow}`,...x});

  const FM = FLOW_MODES_FN(T);
  const DM = DIETARY_META_FN(T);
  const PC = [T.sage,T.blue,T.sand,T.rose,T.lavender,T.sageLight];

  // ── Auth & Household Sync State ─────────────────────────────────────────────
  const [authToken,  setAuthToken]  = useSaved("authToken",  null);
  const [authUser,   setAuthUser]   = useSaved("authUser",   null);
  // ── Startup diagnostics ──
  useEffect(() => {
    const _au = (() => { try { return JSON.parse(localStorage.getItem("af_authUser")||"null"); } catch { return null; } })();
    const _hid = (() => { try { return JSON.parse(localStorage.getItem("af_householdId")||"null"); } catch { return null; } })();
    AF_DEBUG&&console.log("[AF DEBUG] email", _au?.email);
    AF_DEBUG&&console.log("[AF DEBUG] user id", _au?.id);
    AF_DEBUG&&console.log("[AF DEBUG] household id", _hid);
    AF_DEBUG&&console.log("[AF DEBUG] app version", APP_VERSION);
    AF_DEBUG && console.warn("[AF VERSION]", APP_VERSION);
    AF_DEBUG&&console.log("[AF DEBUG] lastPushedAt", localStorage.getItem("af_lastPushedAt"));
    AF_DEBUG&&console.log("[AF DEBUG] lastHHSync", localStorage.getItem("af_lastHHSync"));
    AF_DEBUG&&console.log("[AF SYNC] deviceId", localStorage.getItem("af_deviceId") || "(not yet set)");
  }, []);
  // Sync Supabase session into original app auth on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("af_authUser");
      const storedToken = localStorage.getItem("af_authToken");
      if (stored && !authUser) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) setAuthUser(parsed);
      }
      if (storedToken && !authToken) {
        const parsedToken = JSON.parse(storedToken);
        if (parsedToken) setAuthToken(parsedToken);
      }
    } catch(e) {}
  }, []);
  const [householdId,setHouseholdId]= useSaved("householdId",null);
  const [householdOwnerId,setHouseholdOwnerId]= useSaved("householdOwnerId",null);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const [lastSyncTime,setLastSyncTime] = useState(null);
  const [showAuthModal,setShowAuthModal] = useState(false);
  const [showHouseholdModal,setShowHouseholdModal] = useState(false);
  const [anchorDayOpen,setAnchorDayOpen] = useState(false);
  const [googleCalToken,setGoogleCalToken]     = useSaved("googleCalToken", null);
  const [googleCalSyncing,setGoogleCalSyncing] = useState(false);
  const [googleCalError,setGoogleCalError]     = useState("");
  const syncChannelRef = useRef(null);


  // ── Validate auth token on load — refresh if expired ────────────────────
  // Extends zombie-session detection to the boot path. When the stored token
  // is stale and refreshAuthToken() fails, surface the auth modal immediately
  // rather than leaving the app in a silent no-sync state.
  useEffect(() => {
    if (!authToken) return;
    sbFetch("/auth/v1/user", { _token: authToken })
      .catch(async () => {
        console.warn("[AF AUTH] boot token validation failed — attempting refresh");
        const newToken = await refreshAuthToken();
        if (newToken) {
          AF_DEBUG&&console.log("[AF AUTH] boot refresh succeeded — updating state");
          setAuthToken(newToken);
        } else {
          console.warn("[AF AUTH] boot refresh failed — zombie session detected");
          clearZombieAuthKeys();
          setAuthToken(null);
          setAuthUser(null);
          setShowAuthModal(true);
          showInAppBanner("Session expired — please sign in again.", "error");
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Sanitize data from Supabase — removes null array entries, ensures safe types ──
function createLocalBackup() {
    try {
      // Prune to keep only 2 existing backups before adding a new one (keeps last 3 total)
      var existing = Object.keys(localStorage).filter(function(k){ return k.startsWith("af_backup_"); }).sort();
      while (existing.length >= 3) { try { localStorage.removeItem(existing.shift()); } catch {} }
      var snapshot = {};
      Object.keys(localStorage).forEach(function(k){ if(k.startsWith("af_") && !k.startsWith("af_backup_")) snapshot[k] = localStorage.getItem(k); });
      var key = "af_backup_" + Date.now();
      localStorage.setItem(key, JSON.stringify(snapshot));
      AF_DEBUG&&console.log("[AF SAFETY] backup created", key);
    } catch(e) { console.warn("[AF SAFETY] backup failed —", e.message); }
  }

  function isRemotePayloadSafe(remoteData, remoteTs) {
    if (!remoteData || typeof remoteData !== "object") {
      AF_DEBUG&&console.log("[AF SAFETY] refused empty remote apply — null or non-object");
      return false;
    }
    var remoteKeyCount = Object.keys(remoteData).filter(function(k){ return remoteData[k] !== null; }).length;
    if (remoteKeyCount < 2) {
      AF_DEBUG&&console.log("[AF SAFETY] refused empty remote apply — only", remoteKeyCount, "non-null keys");
      return false;
    }
    var coreKeys = ["tasks","meals","brainItems","shoppingItems","people"];
    var hasCoreData = coreKeys.some(function(k){
      try { var v = JSON.parse(localStorage.getItem("af_"+k)||"null"); return Array.isArray(v) && v.length > 0; } catch { return false; }
    });
    if (hasCoreData) {
      var remoteCoreCount = coreKeys.filter(function(k){ return Array.isArray(remoteData[k]) && remoteData[k].length > 0; }).length;
      var localCoreCount = coreKeys.filter(function(k){
        try { var v = JSON.parse(localStorage.getItem("af_"+k)||"null"); return Array.isArray(v) && v.length > 0; } catch { return false; }
      }).length;
      if (remoteCoreCount === 0 && localCoreCount > 0) {
        AF_DEBUG&&console.log("[AF SAFETY] refused empty remote apply — remote has 0 core arrays, local has", localCoreCount);
        return false;
      }
    }
    return true;
  }

  // sanitizeHouseholdData imported from ./sync-core.js

  // ── Household sync functions ─────────────────────────────────────────────────
  async function signUp(email, password, displayName) {
    try {
      setSyncStatus("syncing");
      let data;
      try {
        data = await sbAuth(email, password, "signup");
      } catch(fetchErr) {
        // sbFetch threw — error message is the raw Supabase response body
        const raw = fetchErr.message || "";
        // Try to parse as JSON to get a clean message
        let cleanMsg = raw;
        try {
          const parsed = JSON.parse(raw);
          cleanMsg = parsed.msg || parsed.message || parsed.error_description || parsed.error || raw;
        } catch {}
        setSyncStatus("error");
        // Map common Supabase errors to friendly messages
        if (raw.includes("already registered") || raw.includes("User already") || raw.includes("already been registered")) {
          return { ok:false, error: "This email already has an account — use Sign In instead." };
        }
        if (raw.includes("Password") || raw.includes("password") || raw.includes("weak") || raw.includes("characters")) {
          return { ok:false, error: "Password issue: " + cleanMsg };
        }
        return { ok:false, error: cleanMsg, raw: raw.slice(0,300) };
      }

      // data is the parsed JSON response — show it for debugging
      AF_DEBUG && console.log("Supabase signup response:", JSON.stringify(data));

      // Hard error in response body
      if (data.error || data.error_code) {
        const msg = data.error_description || data.msg || data.error || "Signup failed";
        setSyncStatus("error");
        return { ok:false, error: msg };
      }

      // Case 1: Got a token immediately (email confirmation disabled)
      if (data.access_token && data.user) {
        const token = data.access_token;
        const userObj = { id: data.user?.id || "unknown", email, displayName: displayName || email.split("@")[0] };
        try { localStorage.setItem("af_authToken", JSON.stringify(token)); } catch {}
        try { localStorage.setItem("af_authUser", JSON.stringify(userObj)); } catch {}
        try { localStorage.removeItem("af_lastHHSync"); } catch {} // force fresh pull on next load
        // Don't auto-create household on signup — user will join or create via UI
        setSyncStatus("synced");
        window.location.reload();
        return { ok: true };
      }

      // Case 2: Email confirmation required (no token yet, but user created)
      if (data.user && data.user.id) {
        setSyncStatus("idle");
        return { ok: true, needsConfirmation: true };
      }

      // Case 3: Unexpected — show raw response so we can debug
      setSyncStatus("error");
      return { ok:false, error: "Unexpected response — raw: " + JSON.stringify(data).slice(0, 200) };

    } catch(e) {
      setSyncStatus("error");
      return { ok:false, error: "Error: " + (e.message || String(e)) };
    }
  }

  async function signIn(email, password) {
    try {
      setSyncStatus("syncing");
      let data;
      try {
        data = await sbAuth(email, password, "signin");
      } catch(fetchErr) {
        const raw = fetchErr.message || "";
        let cleanMsg = raw;
        try {
          const parsed = JSON.parse(raw);
          cleanMsg = parsed.msg || parsed.message || parsed.error_description || parsed.error || raw;
        } catch {}
        setSyncStatus("error");
        if (raw.includes("Invalid login") || raw.includes("invalid_grant") || raw.includes("Invalid email") || raw.includes("Bad Request")) {
          return { ok:false, error: "Incorrect email or password. Please try again." };
        }
        if (raw.includes("Email not confirmed")) {
          return { ok:false, error: "Please confirm your email first — check your inbox." };
        }
        return { ok:false, error: cleanMsg, raw: raw.slice(0,300) };
      }

      AF_DEBUG && console.log("Supabase signin response keys:", Object.keys(data));

      if (!data.access_token) {
        setSyncStatus("error");
        const reason = data.error_description || data.msg || data.error || JSON.stringify(data).slice(0,150);
        return { ok:false, error: "Sign in failed: " + reason };
      }

      const token = data.access_token;
      const userId = data.user?.id || "unknown";
      const displayName = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name || data.user?.user_metadata?.displayName || email.split("@")[0];

      try { localStorage.setItem("af_authToken", JSON.stringify(token)); } catch {}
      try { localStorage.setItem("af_authUser", JSON.stringify({ id: data.user.id, email: data.user.email, displayName })); } catch {}
      try { localStorage.removeItem("af_lastHHSync"); } catch {} // force fresh pull on next load
      try { localStorage.removeItem("af_householdId"); } catch {} // clear stale ID before lookup

      // Always look up Supabase on sign-in to find the real household with data
      // This ensures any device gets the right household, not a stale empty local one
      try {
        // Filter by owner_id so each user only finds their own household, never a stranger's
        const existingRows = await sbFetch(`/rest/v1/households?owner_id=eq.${userId}&select=*&order=updated_at.desc&limit=1`, { _token: token });
        if (existingRows && existingRows.length > 0) {
          const existingHH = existingRows[0];
          // Use the Supabase household (it has the real data)
          try { localStorage.setItem("af_householdId", JSON.stringify(existingHH.id)); } catch {}
         if (existingHH.data && Object.keys(existingHH.data).length > 0) {
            // Household has real data — restore it all
            if (isRemotePayloadSafe(existingHH.data, existingHH.updated_at)) {
              createLocalBackup();
              const clean = sanitizeHouseholdData(existingHH.data);
              const _AK1 = ["tasks","brainItems","shoppingItems","notifications","calEvents",
                "birthdays","favMeals","mealBankCustom","recipes","stores","shopCategories","brainCats",
                "homeSystems","dietaryFilters","recurring","celebrations","gifts","inventory","pets",
                "houseFile","cove_lists_v1","cove_sections_v1","cove_notes_v1","connectedCals","people"];
              SYNC_KEYS.forEach(k => {
                if (clean[k] !== undefined) {
                  if (_AK1.includes(k) && !Array.isArray(clean[k])) return;
                  applyHouseholdKey(k, clean[k]);
                }
              });
              try { localStorage.setItem("af_lastHHSync", existingHH.updated_at || Date.now().toString()); } catch {}
            }
          }
        } else {
          // Not an owner — query household_members directly (authoritative, no user_metadata dependency).
          try {
            const memberRows = await sbFetch(
              `/rest/v1/household_members?user_id=eq.${userId}&select=household_id&limit=1`,
              { _token: token }
            );
            const joinedHhId = memberRows && memberRows.length > 0 ? memberRows[0].household_id : null;
            AF_DEBUG&&console.log("[AF] No owned household. member of:", joinedHhId);
            if (joinedHhId) {
              const joinedRows = await sbFetch(`/rest/v1/households?id=eq.${joinedHhId}&select=*&limit=1`, { _token: token });
              if (joinedRows && joinedRows.length > 0) {
                try { localStorage.setItem("af_householdId", JSON.stringify(joinedHhId)); } catch {}
                if (joinedRows[0].data && isRemotePayloadSafe(joinedRows[0].data, joinedRows[0].updated_at)) {
                  createLocalBackup();
                  const clean = sanitizeHouseholdData(joinedRows[0].data);
                  const _AK2 = ["tasks","brainItems","shoppingItems","notifications","calEvents",
                    "birthdays","favMeals","mealBankCustom","recipes","stores","shopCategories","brainCats",
                    "homeSystems","dietaryFilters","recurring","celebrations","gifts","inventory","pets",
                    "houseFile","cove_lists_v1","cove_sections_v1","cove_notes_v1","connectedCals","people"];
                  SYNC_KEYS.forEach(k => {
                    if (clean[k] !== undefined) {
                      if (_AK2.includes(k) && !Array.isArray(clean[k])) return;
                      applyHouseholdKey(k, clean[k]);
                    }
                  });
                  try { localStorage.setItem("af_lastHHSync", joinedRows[0].updated_at || Date.now().toString()); } catch {}
                  AF_DEBUG&&console.log("[AF] Restored joined household on sign-in:", joinedHhId);
                }
              }
            }
          } catch(e) { console.warn("[AF] Member household lookup failed:", e.message); }
        }
      } catch(hhErr) {
        AF_DEBUG && console.warn("[AF] Household lookup failed"); // message omitted: may contain IDs
        // Fallback — ensure we at least have a household ID
        const storedHHId = (() => { try { return JSON.parse(localStorage.getItem("af_householdId")||"null"); } catch { return null; } })();
        if (!storedHHId) {
          const hid = "hh_" + uid();
          try { localStorage.setItem("af_householdId", JSON.stringify(hid)); } catch {}
        }
      }

      window.location.reload();
      return { ok: true };
    } catch(e) {
      setSyncStatus("error");
      return { ok:false, error: "Error: " + (e.message || String(e)) };
    }
  }

  async function signOut() {
    _afUserInitiatedSignOut = true;
    try { await supabase.auth.signOut(); } catch {}
    if (authToken) { try { await sbSignOut(authToken); } catch {} }
    // Clear localStorage directly then reload — avoids null authUser render crash
    try { localStorage.removeItem("af_authToken"); } catch {}
    try { localStorage.removeItem("af_authUser"); } catch {}
    try { localStorage.removeItem("af_householdId"); } catch {}
    try { localStorage.removeItem("af_lastHHSync"); } catch {}
    window.location.reload();
  }

 function isAuthExpiredError(err) {
    const msg = String(err?.message || err || "").toLowerCase();
    return msg.includes("jwt expired") ||
           msg.includes("401") ||
           msg.includes("unauthorized") ||
           msg.includes("invalid jwt") ||
           msg.includes("already used") ||
           msg.includes("invalid refresh");
  }

 async function pushHouseholdData(token, hid, opId) {
    if (!token || !hid) {
      if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] PUSH_SKIPPED: missing token/hid", { token: !!token, hid: hid });
      return;
    }
    if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] PUSH_STARTED hid="+hid);
    AF_DEBUG&&console.log("[AF SYNC] push start", hid);

    // ── Stale-push guard ──────────────────────────────────────────────────
    // Fetch server updated_at before doing anything.
    // Rule 1: if lastHHSync is missing, device has never confirmed server data — pull first.
    // Rule 2: if server is newer than lastHHSync, local data is stale — pull first.
    try {
      const checkRows = await sbFetch(`/rest/v1/households?id=eq.${hid}&select=updated_at,updated_by&limit=1`, { _token: token });
      if (checkRows && checkRows.length > 0) {
        const serverUpdatedAt = checkRows[0].updated_at || "";
        const lastApplied = localStorage.getItem("af_lastHHSync") || "";
        AF_DEBUG&&console.log("[AF SYNC] server updated_at", serverUpdatedAt, "| local lastHHSync", lastApplied || "(none)");
        if (serverUpdatedAt && !lastApplied) {
          if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] PUSH_SKIPPED: no-lastHHSync serverUpdatedAt="+serverUpdatedAt);
          console.warn("[AF SYNC] push blocked — no lastHHSync; pulling latest now", { serverUpdatedAt });
          await pullLatestHouseholdData("no-lastHHSync");
          return;
        }
        if (serverUpdatedAt && lastApplied && new Date(serverUpdatedAt).getTime() > new Date(lastApplied).getTime()) {
          // Own-push reconciliation. A successful push bumps the server updated_at but
          // intentionally does NOT advance af_lastHHSync. Without this guard the NEXT push
          // attempt reads our own write as a newer remote change, pulls, and reloads -
          // an infinite stale-pull-reload loop (nav resets to Compass, the briefing
          // re-fires /api/claude, the proxy returns 429). The poll path already guards
          // this via af_lastPushedAt; mirror it here.
          var lastPushedAt = localStorage.getItem("af_lastPushedAt") || "";
          var lastPushAt = Number(localStorage.getItem("af_lastPushAt") || 0);
          var lastPullAt = Number(localStorage.getItem("af_lastPullAt") || 0);
          var pushedRecently = lastPushAt && (Date.now() - lastPushAt) < 30000;
          var pulledRecently = lastPullAt && (Date.now() - lastPullAt) < 30000;
          if (serverUpdatedAt === lastPushedAt || pushedRecently) {  // pulledRecently removed: a recent PULL must not license overwriting newer server data
            try { localStorage.setItem("af_lastHHSync", serverUpdatedAt); } catch (e3) {}
            console.warn("[AF SYNC] stale-check: own push/pull (match or recent) - reconciled, not stale");
          } else {
            if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] PUSH_SKIPPED: stale-push-block serverUpdatedAt="+serverUpdatedAt+" lastApplied="+lastApplied);
            console.warn("[AF SYNC] push blocked stale — pulling latest now", { serverUpdatedAt, lastApplied });
            await pullLatestHouseholdData("stale-push-block");
            return;
          }
        }
        AF_DEBUG&&console.log("[AF SYNC] push allowed", { serverUpdatedAt, lastApplied });
      }
    } catch(e) {
      if (isAuthExpiredError(e)) {
        console.warn("[AF SYNC] stale-check auth expired — attempting token refresh");
        const newToken = await refreshAuthToken();
        if (newToken) { setAuthToken(newToken); AF_DEBUG&&console.log("[AF AUTH] refreshed mid-sync"); return; }
        console.warn("[AF SYNC] stale-check auth expired — refresh failed, zombie session detected");
        setSyncStatus("error");
        setAuthToken(null);
        setAuthUser(null);
        setShowAuthModal(true);
        clearZombieAuthKeys();
        showInAppBanner("Session expired — please sign in again.", "error");
      } else if (e?.message?.toLowerCase().includes("failed to fetch") || e?.message?.toLowerCase().includes("networkerror") || e?.message?.toLowerCase().includes("network request failed")) {
        console.warn("[AF SYNC] stale-check network error — push paused", e.message);
        setSyncStatus("error");
        showInAppBanner("Sync paused — offline or network error.", "error");
      } else {
        console.warn("[AF SYNC] stale-check unknown error — push blocked (safe default)", e.message);
        setSyncStatus("error");
      }
      return; // never proceed with push after a failed safety check
    }
    // ── end stale-push guard ───────────────────────────────────────────────

    // ── Dirty flag check ──────────────────────────────────────────────────
    const dirtyKeys = (() => { try { return JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]"); } catch { return []; } })();
    // Manual sync (syncNow) bypasses dirty check — always pushes
    // debouncedSync only calls this if dirty keys exist
    AF_DEBUG&&console.log("[AF SYNC] dirty keys at push time:", dirtyKeys);
    // ── end dirty flag check ───────────────────────────────────────────────

    const payload = {};
    SYNC_KEYS.forEach(k => { try { payload[k] = JSON.parse(localStorage.getItem("af_"+k)||"null"); } catch {} });
    AF_DEBUG&&console.log("[AF SYNC] push keys", Object.keys(payload).filter(k => payload[k] !== null));
    const nonNullCount = Object.values(payload).filter(v => v !== null).length;
    if (nonNullCount < 2) {
      if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] PUSH_SKIPPED: nonNull<2 count="+nonNullCount);
      AF_DEBUG&&console.log("[AF SAFETY] refused empty cloud push — only", nonNullCount, "non-null keys");
      return;
    }
    // ── Per-key merge patch ────────────────────────────────────────────────
    // Send ONLY the keys this device changed. The server merges them into the
    // existing row (data = data || patch), so a device can never overwrite a key
    // it didn't touch — two devices editing different things (meals vs chores vs
    // people) no longer clobber each other. Full whole-blob replace is gone.
    const mergePatch = {};
    (dirtyKeys || []).forEach(k => { if (SYNC_KEYS.indexOf(k) !== -1) { try { mergePatch[k] = JSON.parse(localStorage.getItem("af_"+k)||"null"); } catch {} } });
    const updatedAt = new Date().toISOString();
    const authUser = (() => { try { return JSON.parse(localStorage.getItem("af_authUser")||"null"); } catch { return null; } })();
    const ownerId = authUser?.id || null;
    // ── Patch 2: device ID ────────────────────────────────────────────────
    let deviceId = localStorage.getItem("af_deviceId");
    if (!deviceId) {
      try { deviceId = crypto.randomUUID(); } catch { deviceId = Date.now().toString(36) + Math.random().toString(36).slice(2); }
      try { localStorage.setItem("af_deviceId", deviceId); } catch {}
    }
    AF_DEBUG&&console.log("[AF SYNC] deviceId", deviceId);
    // ── end device ID ─────────────────────────────────────────────────────
    try {
      // Check if row exists first to decide POST vs PATCH
      const existing = await sbFetch(`/rest/v1/households?id=eq.${hid}&select=id,owner_id&limit=1`, { _token: token });
      if (existing && existing.length > 0) {
        // Row exists — MERGE only the dirty keys server-side (data = data || patch),
        // instead of replacing the whole row. This is the two-device clobbering fix.
        if (Object.keys(mergePatch).length === 0) {
          // Nothing real changed (dirty keys empty/stale) — nothing to merge.
          AF_DEBUG&&console.log("[AF SYNC] merge skipped — empty patch");
          try { localStorage.setItem("af_dirtyKeys", "[]"); } catch {}
          return;
        }
        const patchBody = Object.assign({}, mergePatch, { _meta: { updated_by_device: deviceId, app_version: APP_VERSION, pushed_at: updatedAt } });
        if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] SUPABASE_MERGE_SENT keys="+Object.keys(mergePatch).join(","));
        const rpcResp = await sbFetch("/rest/v1/rpc/merge_household_data", {
          method: "POST",
          _token: token,
          headers: { "Prefer": "return=representation" },
          body: JSON.stringify({ p_household_id: hid, p_patch: patchBody, p_updated_by: ownerId })
        });
        // Server sets updated_at = now() and returns it. Store THAT as our synced
        // marker so the stale-push guard doesn't read our own write as a remote change.
        const serverTs = (rpcResp && rpcResp[0] && rpcResp[0].merged_at) ? rpcResp[0].merged_at : updatedAt;
        if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] SUPABASE_MERGE_DONE serverTs="+serverTs);
        try { localStorage.setItem("af_lastPushedAt", serverTs); } catch {}
        try { localStorage.setItem("af_lastHHSync", serverTs); } catch {}
        try { localStorage.setItem("af_lastPushAt", String(Date.now())); } catch {}
        try { localStorage.setItem("af_dirtyKeys", "[]"); } catch {} // clear dirty — merge succeeded
        AF_DEBUG&&console.log("[AF SYNC] merge success updated_at", serverTs, "— keys:", Object.keys(mergePatch));
      } else {
        // Row does not exist — INSERT (first time only)
        const insertRows = await sbFetch("/rest/v1/households", {
          method: "POST",
          _token: token,
          headers: { "Prefer": "return=representation" },
          body: JSON.stringify({ id: hid, owner_id: ownerId, data: { ...payload, _meta: { updated_by_device: deviceId, app_version: APP_VERSION, pushed_at: updatedAt } }, updated_at: updatedAt })
        });
        const serverTs = (insertRows && insertRows[0] && insertRows[0].updated_at) ? insertRows[0].updated_at : updatedAt;
        // Same as PATCH branch: store the value we sent; the DB holds exactly it.
        try { localStorage.setItem("af_lastPushedAt", updatedAt); } catch {}
        try { localStorage.setItem("af_lastHHSync", updatedAt); } catch {}
        try { localStorage.setItem("af_lastPushAt", String(Date.now())); } catch {}
        try { localStorage.setItem("af_dirtyKeys", "[]"); } catch {} // clear dirty — insert succeeded
        // Record owner so HouseholdModal can show the correct owner/member UI.
        if (ownerId) { try { localStorage.setItem("af_householdOwnerId", JSON.stringify(ownerId)); } catch {} }
        // Write owner membership row so new accounts are self-sufficient under RLS.
        // Best-effort: household row already exists at this point, so log and continue on failure.
        if (ownerId) {
          try {
            await sbFetch("/rest/v1/household_members", {
              method: "POST",
              _token: token,
              headers: { "Prefer": "resolution=ignore-duplicates,return=minimal" },
              body: JSON.stringify({ household_id: hid, user_id: ownerId, role: "owner" })
            });
          } catch(e) { console.warn("[AF] Could not write household_members owner row:", e.message); }
        }
      }
    } catch(e) {
      if (isAuthExpiredError(e)) {
        console.warn("[AF SYNC] push auth expired — attempting token refresh");
        const newToken = await refreshAuthToken();
        if (newToken) { setAuthToken(newToken); AF_DEBUG&&console.log("[AF AUTH] refreshed mid-push"); return; }
        console.warn("[AF SYNC] push auth expired — refresh failed, zombie session detected");
        setSyncStatus("error");
        setAuthToken(null);
        setAuthUser(null);
        setShowAuthModal(true);
        clearZombieAuthKeys();
        showInAppBanner("Session expired — please sign in again.", "error");
        return;
      }
      if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] PUSH_SKIPPED: exception "+e.message);
      console.warn("[AF] pushHouseholdData failed:", e.message);
    }
  }

 // Applies remote household keys to localStorage and returns true iff ANY key's
  // stored value actually changed. Callers use this to skip a full-page reload when
  // a pull brought nothing new — the dominant case in steady-state polling and in
  // own-push echoes, and the cause of the constant reflicker/jumping when two
  // devices are active. Genuine remote changes still flip `changed` → caller reloads.
  // Interim mitigation until pulls can update React state in place without reload.
  function _applyHouseholdKeysDetectChange(clean, opts) {
    opts = opts || {};
    var arrayKeys = opts.arrayKeys || null;
    var skip = opts.skip || null;
    var changed = false;
    SYNC_KEYS.forEach(function(k) {
      if (clean[k] === undefined) return;
      if (skip && skip(k)) return;
      if (arrayKeys && arrayKeys.indexOf(k) !== -1 && !Array.isArray(clean[k])) return;
      var before = null, after = null;
      try { before = localStorage.getItem("af_" + k); } catch (_e) {}
      applyHouseholdKey(k, clean[k]);
      try { after = localStorage.getItem("af_" + k); } catch (_e) {}
      if (before !== after) changed = true;
    });
    return changed;
  }

 async function pullHouseholdData(token) {
    if (!token) return;
    const storedHid = (() => { try { return JSON.parse(localStorage.getItem("af_householdId")||"null"); } catch { return null; } })();
    const url = storedHid
      ? `/rest/v1/households?id=eq.${storedHid}&select=*&limit=1`
      : `/rest/v1/households?select=*&limit=1`;
    const rows = await sbFetch(url, { _token: token });
    if (!rows || !rows.length) return;
    const row = rows[0];
    if (!row.data) return;
    if (!isRemotePayloadSafe(row.data, row.updated_at)) return;
    createLocalBackup();
    setHouseholdId(row.id); // always trust Supabase over stale localStorage
    const clean1 = sanitizeHouseholdData(row.data);
    const _changed1 = _applyHouseholdKeysDetectChange(clean1, {});
    // Stamp lastHHSync to the version we just applied — otherwise the next stale-check
    // sees server > lastHHSync again and pulls+reloads forever (the blink loop).
    try { if (row.updated_at) localStorage.setItem("af_lastHHSync", row.updated_at); } catch (e) {}
    // Only reload if the pull actually changed local data. A bumped updated_at with
    // identical data (own echo / steady-state) no longer forces a reflicker.
    if (_changed1) window.location.reload();
  }

  async function joinHousehold(token, joinCode) {
    // joinCode is the household share code (householdId)
    try {
      setSyncStatus("syncing");
      // RPC: verifies household exists, writes household_members row, returns household_id.
      // Failure propagates to outer catch — user sees error, no false success.
      const rpcResult = await sbFetch("/rest/v1/rpc/join_household", {
        method: "POST",
        _token: token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_code: joinCode })
      });
      if (!rpcResult || !rpcResult.ok) {
        return { ok:false, error:(rpcResult && rpcResult.error) || "Could not join household." };
      }
      const joinedHhId = rpcResult.household_id;
      // householdId saved AFTER RPC confirms membership row written
      try { localStorage.setItem("af_householdId", JSON.stringify(joinedHhId)); } catch {}
      // user_metadata write: best-effort fallback only, non-blocking
      try {
        const metaResp = await fetch(SUPABASE_URL + "/auth/v1/user", {
          method: "PUT",
          headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({ data: { joined_household_id: joinedHhId } })
        });
        const metaBody = await metaResp.json();
        AF_DEBUG&&console.log("[AF] Metadata write status:", metaResp.status, "joined_household_id:", metaBody?.user_metadata?.joined_household_id);
      } catch(e) { console.warn("[AF] Could not save joined_household_id to metadata:", e.message); }
      // Pull the FRESHEST data — RLS now permits read since member row exists
      const freshRows = await sbFetch(`/rest/v1/households?id=eq.${joinedHhId}&select=*`, { _token: token });
      const sourceRow = freshRows && freshRows.length > 0 ? freshRows[0] : null;
      if (sourceRow && sourceRow.data) {
        const clean2 = sanitizeHouseholdData(sourceRow.data);
        SYNC_KEYS.forEach(k => {
          if (clean2[k] !== undefined) {
            applyHouseholdKey(k, clean2[k]);
          }
        });
        try { localStorage.setItem("af_lastHHSync", sourceRow.updated_at || Date.now().toString()); } catch {}
        // Record the household owner so HouseholdModal can show the correct owner/member UI.
        if (sourceRow.owner_id) { try { localStorage.setItem("af_householdOwnerId", JSON.stringify(sourceRow.owner_id)); } catch {} }
      }
      setSyncStatus("synced");
      setLastSyncTime(new Date().toLocaleTimeString());
      window.location.reload();
      return { ok: true };
    } catch(e) { setSyncStatus("error"); return { ok:false, error: e.message }; }
  }

  // ── pullLatestHouseholdData — safe pull/apply, callable from anywhere in HomeFlow ──
  // Same safe path as checkForUpdates: fetch → safety check → sanitize → write → reload.
  // Called directly when push is blocked stale, so the phone pulls immediately.
  async function pullLatestHouseholdData(reason) {
    if (!authToken || !householdId) { console.warn("[AF SYNC] pullLatest skipped — no auth/household"); return; }
    AF_DEBUG && console.warn("[AF PULL] EXECUTING", reason, new Date().toISOString());
    try {
      const rows = await sbFetch(`/rest/v1/households?id=eq.${householdId}&select=*`, { _token: authToken });
      if (!rows || !rows.length || !rows[0].data) { AF_DEBUG&&console.log("[AF SYNC] pullLatest — no rows returned"); return; }
      const row = rows[0];
      const serverTs = row.updated_at || "";
      AF_DEBUG&&console.log("[AF SYNC] pullLatest remote updated_at", serverTs);
      const _safe = isRemotePayloadSafe(row.data, serverTs);
      AF_DEBUG&&console.log("[AF SYNC] pullLatest remote safe", _safe);
      if (!_safe) { console.warn("[AF SYNC] pullLatest blocked by safety check"); return; }
      createLocalBackup();
      const clean = sanitizeHouseholdData(row.data);
      AF_DEBUG && console.warn("[AF PULL] APPLYING REMOTE", Object.keys(clean));
      const localWeekOf = (() => { try { const r=localStorage.getItem("af_mealsWeekOf"); return r?JSON.parse(r):null; } catch { return null; } })();
      const _ARRAY_KEYS = ["tasks","brainItems","shoppingItems","notifications","calEvents",
        "birthdays","favMeals","mealBankCustom","recipes","stores","shopCategories","brainCats",
        "homeSystems","dietaryFilters","recurring","celebrations","gifts","inventory","pets",
        "houseFile","cove_lists_v1","cove_sections_v1","cove_notes_v1","connectedCals","people"];
      const _changed = _applyHouseholdKeysDetectChange(clean, {
        arrayKeys: _ARRAY_KEYS,
        skip: function(k){ return k === "mealsWeekOf" && localWeekOf === getThisMonday(); }
      });
      // serverTs is the value the DB returned — store it directly. A confirm-GET re-read
      // can return a stale pooled/replica value, creating a phantom diff on the next poll.
      try { localStorage.setItem("af_lastHHSync", serverTs); } catch {}
      try { localStorage.setItem("af_lastPullAt", String(Date.now())); } catch {} // separate from af_lastPushAt — poll uses af_lastPushAt to gate reloads; this only gates the stale-push-guard
      // Do NOT clear af_dirtyKeys here. Dirty keys that survived the stale-blocked push
      // should push on the next sync cycle — now that af_lastHHSync === serverTs the guard
      // passes. Clearing them was the bug that left devices permanently unable to push:
      // any edit marked dirty before the pull was silently destroyed.
      // Only reload if the pull actually changed local data — otherwise a bumped
      // updated_at with identical data would reflicker the screen for nothing.
      if (_changed) { AF_DEBUG && console.warn("[AF PULL] RELOADING (local data changed)"); window.location.reload(); }
      else { AF_DEBUG && console.warn("[AF PULL] no local change — skipping reload"); }
    } catch(e) { console.warn("[AF SYNC] pullLatestHouseholdData failed:", e.message); }
  }

  async function syncNow(opId) {
    if (!authToken || !householdId) {
      if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] PUSH_SKIPPED: syncNow auth/household null", { authToken: !!authToken, householdId: householdId });
      return;
    }
    try {
      setSyncStatus("syncing");
      // Push our current local state up first
      await pushHouseholdData(authToken, householdId, opId);
      // Then pull back from server to confirm and get any changes from the other user
      const rows = await sbFetch(`/rest/v1/households?id=eq.${householdId}&select=*`, { _token: authToken });
   if (rows && rows.length > 0 && rows[0].data) {
        const lastSync = localStorage.getItem("af_lastHHSync");
        if (lastSync !== (rows[0].updated_at || "")) {
          if (!isRemotePayloadSafe(rows[0].data, rows[0].updated_at)) { setSyncStatus("synced"); return; }
          createLocalBackup();
          const clean = sanitizeHouseholdData(rows[0].data);
          const _AK3 = ["tasks","brainItems","shoppingItems","notifications","calEvents",
                "birthdays","favMeals","mealBankCustom","recipes","stores","shopCategories","brainCats",
                "homeSystems","dietaryFilters","recurring","celebrations","gifts","inventory","pets",
                "houseFile","cove_lists_v1","cove_sections_v1","cove_notes_v1","connectedCals","people"];
          const _changed = _applyHouseholdKeysDetectChange(clean, { arrayKeys: _AK3 });
          try { localStorage.setItem("af_lastHHSync", rows[0].updated_at || Date.now().toString()); } catch {}
          sessionStorage.removeItem("af_synced_this_session");
          // Never reload if user is actively typing or typed in the last 15s
          const activeEl2 = document.activeElement;
          const isTyping2 = activeEl2 && (activeEl2.tagName === "INPUT" || activeEl2.tagName === "TEXTAREA");
          const typedRecently2 = (Date.now() - lastTypedRef.current) < 15000;
          if (isTyping2 || typedRecently2) { setSyncStatus("synced"); return; }
          // Only reload if the pull actually changed local data. Kills the constant
          // reload loop where each device's push bumped updated_at but the returned
          // blob was identical to what this device already had.
          if (_changed) { window.location.reload(); return; }
          setSyncStatus("synced");
          return;
        }
      }
      setSyncStatus("synced");
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch { setSyncStatus("error"); }
  }

  // SW registration + update adoption
  //
  // Install lifecycle (sw.js no longer calls skipWaiting on install):
  //   1. New SW installs → state "installed" → reg.waiting is set.
  //   2. This effect detects the waiting worker → shows staleBanner.
  //   3. User clicks "Refresh Now" → button posts SKIP_WAITING to reg.waiting.
  //   4. SW calls skipWaiting() → becomes active → clients.claim() runs.
  //   5. controllerchange fires here → _swReloadFired guard → window.location.reload().
  //
  // Belt-and-suspenders update triggering (MOD 2):
  //   - visibilitychange → registration.update(): catches backgrounded-tab case (July 3 trap)
  //   - Poll-tick counter every 40 ticks (~10 min): catches foreground-left-open tabs
  //   Both are wired up below; swRegRef.current is available to the poll useEffect.
  useEffect(function() {
    if (!("serviceWorker" in navigator)) return;

    // Capture controller state BEFORE registration so the controllerchange listener
    // can distinguish a first-install claim from a genuine SW update adoption:
    //   hadController=false → brand-new device, no prior SW. install → activate →
    //     clients.claim() fires controllerchange normally, but the page is already
    //     running the only bundle that exists — reloading would be wrong.
    //   hadController=true  → a SW was already controlling this client. A new SW
    //     replaced it (via SKIP_WAITING) → reload to load the new bundle.
    var hadController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.register("/sw.js").then(function(reg) {
      swRegRef.current = reg;

      // A waiting worker may already exist if the page was hard-reloaded after a
      // prior SW installed. Show the banner immediately in that case.
      if (reg.waiting) { setStaleBanner(true); }

      // Watch for a new SW installing during this page session.
      reg.addEventListener("updatefound", function() {
        var newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", function() {
          // "installed" with reg.waiting set = new SW ready, waiting for SKIP_WAITING.
          if (newWorker.state === "installed" && reg.waiting) {
            setStaleBanner(true);
          }
        });
      });
    }).catch(function() {});

    // controllerchange: fires when a new SW has claimed this client after skipWaiting.
    // Two guards:
    //   _swReloadFired — fires AT MOST ONCE per page lifetime (no loop risk).
    //   hadController  — skips first-install claim; reload only when replacing a prior SW.
    navigator.serviceWorker.addEventListener("controllerchange", function() {
      if (_swReloadFired) return;
      if (!hadController) return; // first-install clients.claim() — no prior SW, no reload needed
      _swReloadFired = true;
      window.location.reload();
    });

    // visibilitychange → registration.update(): the primary fix for the July 3 trap.
    // When a tab returns from background the browser may not re-check the SW script;
    // calling update() forces a byte-for-byte comparison against the network copy.
    function onVisibleSW() {
      if (document.visibilityState === "visible" && swRegRef.current) {
        swRegRef.current.update().catch(function() {});
      }
    }
    document.addEventListener("visibilitychange", onVisibleSW);

    return function() {
      document.removeEventListener("visibilitychange", onVisibleSW);
    };
  }, []);

  // ── Startup: correct household ID by owner_id ────────────────────────────
  // Runs once on mount. If the stored household is owned by this user, use it.
  // If the stored household belongs to someone else (joined household), keep it.
  useEffect(() => {
    if (!authToken) return;
    const userId = (() => { try { return JSON.parse(localStorage.getItem("af_authUser")||"null")?.id; } catch { return null; } })();
    if (!userId) return;
    const currentId = (() => { try { return JSON.parse(localStorage.getItem("af_householdId")||"null"); } catch { return null; } })();
    // First check if the current household is valid (exists in Supabase)
    if (currentId) {
      sbFetch(`/rest/v1/households?id=eq.${currentId}&select=id,owner_id&limit=1`, { _token: authToken })
        .then(rows => {
          if (rows && rows.length > 0) {
            // Household exists — keep it regardless of owner (could be a joined household).
            // Persist owner_id so HouseholdModal can show the correct owner/member UI.
            if (rows[0].owner_id) { try { localStorage.setItem("af_householdOwnerId", JSON.stringify(rows[0].owner_id)); } catch {} }
            AF_DEBUG&&console.log("[AF] Household ID valid:", currentId);
          } else {
            // Household doesn't exist — find the one owned by this user
            sbFetch(`/rest/v1/households?owner_id=eq.${userId}&select=id&order=updated_at.desc&limit=1`, { _token: authToken })
              .then(owned => {
                if (owned && owned.length > 0) {
                  AF_DEBUG&&console.log("[AF] Correcting to owned household:", owned[0].id);
                  localStorage.setItem("af_householdId", JSON.stringify(owned[0].id));
                  window.location.reload();
                } else {
                  // Not an owner — check membership
                  sbFetch(
                    `/rest/v1/household_members?user_id=eq.${userId}&select=household_id&limit=1`,
                    { _token: authToken }
                  ).then(memberRows => {
                    if (memberRows && memberRows.length > 0) {
                      AF_DEBUG&&console.log("[AF] Correcting to member household:", memberRows[0].household_id);
                      localStorage.setItem("af_householdId", JSON.stringify(memberRows[0].household_id));
                      window.location.reload();
                    } else {
                      AF_DEBUG&&console.log("[AF] No household found for user:", userId);
                    }
                  }).catch(() => {});
                }
              }).catch(() => {});
          }
        }).catch(() => {});
    } else {
      // No household stored — owner query first, member fallback second
      sbFetch(`/rest/v1/households?owner_id=eq.${userId}&select=id&order=updated_at.desc&limit=1`, { _token: authToken })
        .then(rows => {
          if (rows && rows.length > 0) {
            AF_DEBUG&&console.log("[AF] Setting owned household:", rows[0].id);
            localStorage.setItem("af_householdId", JSON.stringify(rows[0].id));
            window.location.reload();
          } else {
            // Not an owner — check membership
            return sbFetch(
              `/rest/v1/household_members?user_id=eq.${userId}&select=household_id&limit=1`,
              { _token: authToken }
            ).then(memberRows => {
              if (memberRows && memberRows.length > 0) {
                AF_DEBUG&&console.log("[AF] Setting member household:", memberRows[0].household_id);
                localStorage.setItem("af_householdId", JSON.stringify(memberRows[0].household_id));
                window.location.reload();
              } else {
                AF_DEBUG&&console.log("[AF] No household found for user:", userId);
              }
            });
          }
        }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // ── Background household sync — polls every 60s ─────────────────────────
  // Each tick fetches the server row and compares updated_at to af_lastHHSync.
  // If server is newer and the user isn't actively typing, writes fresh data
  // and reloads so the other household member's changes appear automatically.
  // af_lastPushedAt tracks our own pushes. checkForUpdates skips reloading if serverTs === lastPushedAt.
  useEffect(() => {
    if (!authToken || !householdId) {
      AF_DEBUG&&console.log("[AF SYNC] poll waiting for auth/household", { hasToken: !!authToken, householdId });
      return;
    }
    AF_DEBUG&&console.log("[AF SYNC] poll started", householdId);

    async function checkForUpdates() {

      try {
        AF_DEBUG&&console.log("[AF SYNC] check start", householdId);
        const rows = await sbFetch(`/rest/v1/households?id=eq.${householdId}&select=*`, { _token: authToken });
        if (!rows || !rows.length || !rows[0].data) { AF_DEBUG&&console.log("[AF SYNC] check — no rows returned"); return; }
        const row = rows[0];
        const serverTs = row.updated_at || "";
        const lastSync = localStorage.getItem("af_lastHHSync") || "";
        const lastPushedAt = localStorage.getItem("af_lastPushedAt") || "";
        AF_DEBUG && console.warn("[AF POLL] heartbeat", { serverTs, lastHHSync: lastSync, lastPushedAt });
        AF_DEBUG&&console.log("[AF SYNC] remote updated_at", serverTs);
        AF_DEBUG&&console.log("[AF SYNC] last seen updated_at", lastSync);
        if (!serverTs || serverTs === lastSync) {
          AF_DEBUG && console.warn("[AF POLL RETURN] serverTs === lastSync (no change)");
          return;
        }
        if (serverTs && serverTs !== lastSync) {
          // If this new timestamp matches what WE just pushed (or we pushed seconds ago), it's our
          // own write — don't reload. The server may rewrite updated_at via a trigger, so the
          // value never matches; stamp lastHHSync to our own server time so the poll stops re-firing.
          var lastPushAtPoll = Number(localStorage.getItem("af_lastPushAt") || 0);
          var pushedRecentlyPoll = lastPushAtPoll && (Date.now() - lastPushAtPoll) < 30000;
          if (serverTs === lastPushedAt) {  // pushedRecentlyPoll removed: recent own-push must not cause us to ignore the OTHER device's remote change
            try { localStorage.setItem("af_lastHHSync", serverTs); } catch (ePoll) {}
            AF_DEBUG && console.warn("[AF POLL RETURN] own write (match or recent) - reconciled lastHHSync, no reload");
            setSyncStatus("synced");
            setLastSyncTime(new Date().toLocaleTimeString());
            return;
          }
          const activeEl = document.activeElement;
          const isTyping = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT");
          const typedRecently = (Date.now() - lastTypedRef.current) < 15000;
          const isDragging = !!document.querySelector("[data-taskid][style*='opacity: 0.35'],[data-brainid][style*='opacity: 0.35'],[data-shopid][style*='opacity: 0.35'],[data-sysid][style*='opacity: 0.35']");
          const hasOpenModal = !!document.querySelector("[data-modal-open='true']");
          if (isTyping) { AF_DEBUG && console.warn("[AF POLL RETURN] isTyping", activeEl?.tagName); return; }
          if (typedRecently) { AF_DEBUG && console.warn("[AF POLL RETURN] typedRecently", Date.now() - lastTypedRef.current, "ms ago"); return; }
          if (isDragging) { AF_DEBUG && console.warn("[AF POLL RETURN] isDragging"); return; }
          if (hasOpenModal) { AF_DEBUG && console.warn("[AF POLL RETURN] hasOpenModal"); return; }
          const _safe = isRemotePayloadSafe(row.data, serverTs);
          AF_DEBUG&&console.log("[AF SYNC] remote safe", _safe);
          if (!_safe) { AF_DEBUG && console.warn("[AF POLL RETURN] remote unsafe"); return; }
          createLocalBackup();
          const cleanBg = sanitizeHouseholdData(row.data);
          AF_DEBUG&&console.log("[AF SYNC] applying remote keys", Object.keys(cleanBg));
          const localWeekOf = (() => { try { const r=localStorage.getItem("af_mealsWeekOf"); return r?JSON.parse(r):null; } catch { return null; } })();
          const _ARRAY_KEYS_BG = ["tasks","brainItems","shoppingItems","notifications","calEvents",
            "birthdays","favMeals","mealBankCustom","recipes","stores","shopCategories","brainCats",
            "homeSystems","dietaryFilters","recurring","celebrations","gifts","inventory","pets",
            "houseFile","cove_lists_v1","cove_sections_v1","cove_notes_v1","connectedCals","people"];
          SYNC_KEYS.forEach(k => {
            // Don't overwrite mealsWeekOf from server if local already has this week's value
            if (k === "mealsWeekOf" && localWeekOf === getThisMonday()) return;
            if (cleanBg[k] !== undefined) {
              if (_ARRAY_KEYS_BG.includes(k) && !Array.isArray(cleanBg[k])) return;
              applyHouseholdKey(k, cleanBg[k]);
            }
          });
          localStorage.setItem("af_lastHHSync", serverTs);
          AF_DEBUG&&console.log("[AF SYNC] localStorage updated tasks", localStorage.getItem("af_tasks"));
          AF_DEBUG&&console.log("[AF SYNC] reloading now");
          window.location.reload();
          setSyncStatus("synced");
          setLastSyncTime(new Date().toLocaleTimeString());
        }
      } catch(e) {
        if (isAuthExpiredError(e)) {
          console.warn("[AF SYNC] poll auth expired — attempting token refresh");
          const newToken = await refreshAuthToken();
          if (newToken) { setAuthToken(newToken); AF_DEBUG&&console.log("[AF AUTH] refreshed mid-poll"); return; }
          console.warn("[AF SYNC] poll auth expired — refresh failed, zombie session detected");
          setSyncStatus("error");
          setAuthToken(null);
          setAuthUser(null);
          setShowAuthModal(true);
          clearZombieAuthKeys();
          showInAppBanner("Session expired — please sign in again.", "error");
          clearInterval(interval);
          clearTimeout(initial);
          return;
        }
      }
    }

    // First check after 5s, then every 60s — but never if user is actively typing
    const initial = setTimeout(function(){
      const active = document.activeElement;
      const isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
      const typedRecently = (Date.now() - lastTypedRef.current) < 15000;
      if (!isTyping && !typedRecently) checkForUpdates();
    }, 5000);
    // SW update: belt-and-suspenders check every 40 poll ticks (~10 min at 15s/tick).
    // Catches a tab left foregrounded for hours without a visibilitychange event.
    var _swPollTick = 0;
    const interval = setInterval(function(){
      const active = document.activeElement;
      const isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
      const typedRecently = (Date.now() - lastTypedRef.current) < 15000;
      const shopFocused = window._shopInputFocused;
      AF_DEBUG && console.warn("[AF POLL] interval tick", { isTyping, typedRecently, shopFocused });
      AF_DEBUG && console.warn("[AF FOCUS]", { tag: active?.tagName, type: active?.type, className: active?.className, id: active?.id });
      // Periodic SW update check — every 40 ticks regardless of typing state.
      _swPollTick++;
      if (_swPollTick % 40 === 0 && swRegRef.current) {
        swRegRef.current.update().catch(function() {});
      }
      if (isTyping) { AF_DEBUG && console.warn("[AF POLL RETURN] interval — isTyping"); return; }
      if (typedRecently) { AF_DEBUG && console.warn("[AF POLL RETURN] interval — typedRecently", Date.now() - lastTypedRef.current, "ms ago"); return; }
      if (shopFocused) { AF_DEBUG && console.warn("[AF POLL RETURN] interval — shopFocused"); return; }
      checkForUpdates();
    }, 15000);
    // On mobile, setInterval is paused when the browser goes to background.
    // Fire checkForUpdates immediately when the page becomes visible again.
    function onVisible() {
      if (document.visibilityState === "visible") {
        AF_DEBUG && console.warn("[AF POLL] visibilitychange — running checkForUpdates");
        checkForUpdates();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      AF_DEBUG&&console.log("[AF SYNC] poll stopped", householdId);
      clearTimeout(initial);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, householdId]);

  // (emergency restore removed — no longer needed)

  // ── Automatic 30s push DISABLED ─────────────────────────────────────────────
  // Push only happens on actual user edits (debouncedSync) and manual sync button.
  // Idle devices must never upload — they should only poll and pull.
  // (interval removed to prevent stale devices from overwriting newer cloud data)

  // Sync on task/meal/cal changes (debounced)
  const syncTimeoutRef = useRef(null);
  // Track last keystroke time — never reload within 15s of any typing
  const lastTypedRef = useRef(0);
  // Holds the active ServiceWorkerRegistration so update checks and SKIP_WAITING
  // posts can reach it from multiple places (poll loop, banner button, visibilitychange).
  const swRegRef = useRef(null);
  useEffect(() => {
    function onKey() { lastTypedRef.current = Date.now(); }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  // End hydration guard ~1.5s after first mount so real user edits sync.
  useEffect(function(){ var t=setTimeout(function(){ _afEndHydration(); },1500); return function(){ clearTimeout(t); }; }, []);
  function debouncedSync(opId) {
    if (!authToken || !householdId) {
      if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] PUSH_SKIPPED: debouncedSync auth/household null", { authToken: !!authToken, householdId: householdId });
      return;
    }
    const dirty = (() => { try { return JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]"); } catch { return []; } })();
    if (dirty.length === 0) {
      AF_DEBUG&&console.log("[AF SYNC] debouncedSync skipped — no dirty keys");
      if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] PUSH_SKIPPED: debouncedSync no dirty keys");
      return;
    }
    AF_DEBUG&&console.log("[AF SYNC] debouncedSync triggered — dirty keys:", dirty);
    if (window.AF_TRACE && opId) console.log("[AF_TRACE "+opId+"] DEBOUNCE_SCHEDULED dirty="+JSON.stringify(dirty));
    clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(function() { syncNow(opId); }, 3000);
  }

  // ── All state ───────────────────────────────────────────────────────────────
  const [tab,setTab] = useState(()=>{try{const s=sessionStorage.getItem("af_activeTab");if(s)return s;}catch{}return "anchor";});
  React.useEffect(() => { const h = (e) => goTab(e.detail); window.addEventListener("af-set-tab", h); return () => window.removeEventListener("af-set-tab", h); }, []);
  React.useEffect(() => {
    function nukeGhosts() { document.querySelectorAll("[data-drag-clone]").forEach(function(el){ try{el.remove();}catch{} }); }
    document.addEventListener("visibilitychange", nukeGhosts);
    window.addEventListener("af-set-tab", nukeGhosts);
    return () => { document.removeEventListener("visibilitychange", nukeGhosts); window.removeEventListener("af-set-tab", nukeGhosts); };
  }, []);
  // ── Ripple push notification click → open anchor tab + expand Ripple feed ──
  React.useEffect(() => {
    // Handle notification click while app is open (SW sends message)
    function handleRippleNotifAction() {
      goTab("anchor");
      setShowRippleFeed(true);
      try { localStorage.removeItem("af_open_ripple"); } catch {}
      setTimeout(function() {
        if (window._rippleBannerEl) {
          window._rippleBannerEl.scrollIntoView({behavior:"smooth", block:"start"});
        }
      }, 300);
    }
    window.addEventListener("ripple-notif-action", handleRippleNotifAction);
    // Handle app opened fresh from notification click
    // Check both localStorage flag (set by SW) and URL param ?ripple=1 (set by SW in open URL)
    try {
      var needsRipple = localStorage.getItem("af_open_ripple") === "1";
      try {
        var sp = new URLSearchParams(window.location.search);
        if (sp.get("ripple") === "1") { needsRipple = true; window.history.replaceState(null,"",window.location.pathname); }
      } catch {}
      if (needsRipple) {
        setTimeout(function() {
          goTab("anchor");
          setShowRippleFeed(true);
          try { localStorage.removeItem("af_open_ripple"); } catch {}
          setTimeout(function() {
            if (window._rippleBannerEl) {
              window._rippleBannerEl.scrollIntoView({behavior:"smooth", block:"start"});
            }
          }, 300);
        }, 400);
      }
    } catch {}
    return () => window.removeEventListener("ripple-notif-action", handleRippleNotifAction);
  }, []);
  const visitedTabs = useRef(new Set([tab]));
  // seenTabs tracks tabs that have already played their enter animation
  const seenTabs = useRef(new Set([tab]));
  // scrollPositions saves each tab's window scroll so switching back restores position
  const scrollPositions = useRef({});
  function goTab(t) {
    scrollPositions.current[tab] = window.scrollY;
    visitedTabs.current.add(t);
    setTab(t);
    try{sessionStorage.setItem("af_activeTab",t);}catch{}
    setTimeout(() => { seenTabs.current.add(t); }, 300);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.scrollTo(0, scrollPositions.current[t] || 0);
    }));
  }
  React.useLayoutEffect(() => { homeFlowRef.tab = tab; homeFlowRef.goTab = goTab; });
  var __roomKey = (tab==="flowhome"||tab==="calendar"||tab==="brain"||tab==="weekly"||tab==="tidepool"||tab==="school") ? "Flow"
    : (tab==="meals"||tab==="shop"||tab==="cove"||tab==="home") ? "Anchor"
    : (tab==="settings") ? null : "Today";
  var __ROOM = __roomKey ? ({
    Today:  { tint: "rgba(201,164,91,0.07)",  accent: "#C9A45B" },
    Flow:   { tint: "rgba(94,143,160,0.30)",  accent: "#5E8FA0" },
    Anchor: { tint: "rgba(203,183,157,0.20)", accent: "#8B7761" },
  })[__roomKey] : null;
  const [modal,setModal]                       = useState(null);
  const [flowMode,setFlowMode]                 = useSaved("flowMode","Smooth");
  const [people,setPeople]                     = useSaved("people",[{id:uid(),name:"You",color:"#6A9BB5"},{id:uid(),name:"Partner",color:"#7a9e8e"}]);
  const [tasks,setTasks]                       = useSaved("tasks",[]);
  // meals — sanitized at read time; rolls over to next week's plan if the calendar week has changed
  const [meals, setMealsRaw] = useState(() => {
    try {
      const thisMonday = getThisMonday();
      // Safely read mealsWeekOf — may be plain string or JSON-stringified string
      const storedWeekOf = (() => {
        try {
          const raw = localStorage.getItem("af_mealsWeekOf");
          if (!raw) return null;
          // Handle both plain "2026-04-14" and JSON-quoted '"2026-04-14"'
          const parsed = JSON.parse(raw);
          return typeof parsed === "string" ? parsed : null;
        } catch { return null; }
      })();

      // If we're in a new week, promote nextWeekMeals → current and clear the old plan
      if (storedWeekOf && storedWeekOf !== thisMonday) {
        const nextRaw = (() => { try { return JSON.parse(localStorage.getItem("af_nextWeekMeals")||"null"); } catch { return null; } })();
        const promoted = (nextRaw && typeof nextRaw === "object") ? nextRaw : {};
        const safe = {};
        MEAL_DAYS.forEach(day => {
          const m = promoted[day];
          if (!m || typeof m !== "object") { safe[day] = {}; }
          else {
            const clean = {};
            Object.entries(m).forEach(([k,v]) => { clean[k] = (v == null) ? "" : String(v); });
            safe[day] = clean;
          }
        });
        // Persist the promoted plan as this week and clear next week
        try { localStorage.setItem("af_meals", JSON.stringify(safe)); } catch {}
        try { localStorage.setItem("af_mealsWeekOf", JSON.stringify(thisMonday)); } catch {}
        try { localStorage.setItem("af_nextWeekMeals", JSON.stringify({})); } catch {}
        return safe;
      }

      // Same week — stamp mealsWeekOf if missing so future rollover works
      if (!storedWeekOf) {
        try { localStorage.setItem("af_mealsWeekOf", JSON.stringify(thisMonday)); } catch {}
      }

      const raw = localStorage.getItem("af_meals");
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== "object") return {};
      const safe = {};
      MEAL_DAYS.forEach(day => {
        const m = parsed[day];
        if (!m || typeof m !== "object") { safe[day] = {}; }
        else {
          const clean = {};
          Object.entries(m).forEach(([k,v]) => { clean[k] = (v == null) ? "" : String(v); });
          safe[day] = clean;
        }
      });
      return safe;
    } catch { return {}; }
  });
  function setMeals(next) {
    const resolved = typeof next === "function" ? next(meals) : next;
    // Sanitize before storing — ensure no nulls
    const safe = {};
    MEAL_DAYS.forEach(day => {
      const m = resolved[day];
      if (!m || typeof m !== "object") { safe[day] = {}; }
      else {
        const clean = {};
        Object.entries(m).forEach(([k,v]) => { clean[k] = (v == null) ? "" : String(v); });
        safe[day] = clean;
      }
    });
    setMealsRaw(safe);
    try { localStorage.setItem("af_meals", JSON.stringify(safe)); } catch {}
    try {
      if (!_afHydrating) {
        const dirty = JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]");
        if (!dirty.includes("meals")) {
          dirty.push("meals");
          localStorage.setItem("af_dirtyKeys", JSON.stringify(dirty));
        }
      }
    } catch {}
  }
  const [mealCount,setMealCount]               = useSaved("mealCount",3);
  const [mealThemeEnabled,setMealThemeEnabled] = useSaved("mealThemeEnabled",false);
  const [mealThemes,setMealThemes]             = useSaved("mealThemes",DEFAULT_MEAL_THEMES);
  const [recipes,setRecipes]                   = useSaved("recipes",[]);
  const [mealBankCustom,setMealBankCustom]     = useSaved("mealBankCustom",[]);
  const [wtAiMeals,setWtAiMeals]              = useState(null);
  const [wtSelected,setWtSelected]            = useState([]);
  const [weekTypeKey,setWeekTypeKey]           = useState(null);
  const [showWeekTypePicker,setShowWeekTypePicker] = useState(false);
  const [shoppingItems,setShoppingItems]       = useSaved("shoppingItems",[]);
  const [stores,setStores]                     = useSaved("stores",["Grocery Store","Costco","Target","Amazon"]);
  const [exhaleItems,setExhaleItems]           = useSaved("exhaleItems",[]);
  const [exhaleLabels,setExhaleLabels]         = useSaved("exhaleLabels",{});
  const [brainItems,setBrainItems]             = useSaved("brainItems",[]);
  const [brainCats,setBrainCats]               = useSaved("brainCats", [
    {id:"personal",  label:"Personal",   emoji:"🙋", color:"#b47ab4"},
    {id:"household", label:"Household",  emoji:"🏠", color:"#7a9e8e"},
    {id:"errands",   label:"Errands",    emoji:"🚗", color:"#e05c5c"},
    {id:"calls",     label:"Phone Calls",emoji:"📞", color:"#6a6ab4"},
    {id:"orders",    label:"Orders",     emoji:"📦", color:"#c8a97a"},
    {id:"admin",     label:"Admin",      emoji:"📋", color:"#3a8ab4"},
    {id:"someday",   label:"Someday",    emoji:"🌿", color:"#5a9e6a"},
  ]);
  const [burnoutChecked,setBurnoutChecked]     = useSaved("burnoutChecked",[]);
  const [homeSystems,setHomeSystems]           = useSaved("homeSystems",HOME_SYSTEMS_DEFAULT);
  const [rhythm,setRhythm]                     = useSaved("rhythm",DEFAULT_RHYTHM);
  const [sections,setSections]                 = useSaved("sections",{anchor:true,calendar:true,weekly:true,meals:true,shop:true,home:true,brain:true,tidepool:true,cove:true,school:true});
  const [coveData,setCoveData]                 = useSaved("coveData",null);
  const [dietaryFilters,setDietaryFilters]     = useSaved("dietaryFilters",["Dairy-free"]);
  const [calEvents,setCalEvents]               = useSaved("calEvents",[]);
  // Reload calEvents when AnchorVault writes to localStorage (immunizations, appointments, career goals)
  useEffect(function(){
    function onCalChanged(){
      try{var s=localStorage.getItem("af_calEvents");if(s)setCalEvents(JSON.parse(s));}catch{}
    }
    window.addEventListener("af-cal-changed",onCalChanged);
    return function(){window.removeEventListener("af-cal-changed",onCalChanged);};
  },[]);
  const [connectedCals,setConnectedCals]       = useSaved("connectedCals",[]);
  const [collapsedStores,setCollapsedStores]   = useSaved("collapsedStores",{});
  const [shopCategories,setShopCategories]     = useSaved("shopCategories",[
    {id:"produce",   label:"Produce",        emoji:"🥦"},
    {id:"dairy",     label:"Dairy",          emoji:"🥛"},
    {id:"meat",      label:"Meat & Seafood", emoji:"🥩"},
    {id:"frozen",    label:"Frozen",         emoji:"🧊"},
    {id:"canned",    label:"Canned & Pantry",emoji:"🥫"},
    {id:"bakery",    label:"Bakery",         emoji:"🍞"},
    {id:"beverages", label:"Beverages",      emoji:"🧃"},
    {id:"snacks",    label:"Snacks",         emoji:"🍿"},
    {id:"deli",      label:"Deli",           emoji:"🧀"},
    {id:"health",    label:"Health & Beauty",emoji:"🧴"},
    {id:"household", label:"Household",      emoji:"🧹"},
    {id:"baby",      label:"Baby & Kids",    emoji:"🍼"},
    {id:"pets",      label:"Pet Supplies",   emoji:"🐾"},
    {id:"other",     label:"Other",          emoji:"📦"},
  ]);
  // Helper: get category label string from id or legacy string
  function catLabel(c){ if(!c)return ""; if(typeof c==="string") return c; return c.label||""; }
  function catEmoji(c){ if(!c)return ""; if(typeof c==="string") return ""; return c.emoji||""; }
  function catId(c){ if(!c)return ""; if(typeof c==="string") return c; return c.id||c.label||""; }
  function shopCatLabels(){ return shopCategories.map(function(c){return catLabel(c);}); }
  const [calColorLabels,setCalColorLabels]     = useSaved("calColorLabels",{});
  const [familyProfile,setFamilyProfile]       = useSaved("familyProfile",null);
  const [notifications,setNotifications]       = useSaved("notifications",[]);
  const [aiMemory,setAiMemory]                 = useSaved("aiMemory",{});
  const [preferredName,setPreferredName]       = useSaved("preferredName","");
  const [flowGreetingTone,setFlowGreetingTone] = useSaved("flowGreetingTone","warm");
  const [dailySummaryScheduled,setDailySummaryScheduled] = useSaved("dailySummaryScheduled",null);
  // Weather
  const [weatherData,setWeatherData]           = useState(null);
  const [weatherLocation,setWeatherLocation]   = useSaved("weatherLocation",null);
  // Birthdays
  const [birthdays,setBirthdays]               = useSaved("birthdays",[]);
  // Quick Capture
  const [captureOpen,setCaptureOpen]           = useState(false);
  const [captureText,setCaptureText]           = useState("");
  const [captureDest,setCaptureDest]           = useState("tasks");
  const [captureCategory,setCaptureCategory]   = useState("");
  // Person filter on Anchor
  const [personFilter,setPersonFilter]         = useState("all");
  // Weekly subtab
  const [weekSubTab,setWeekSubTab]             = useState("glance");

  const [calViewDate,setCalViewDate]   = useState(new Date(TODAY));
  const [calMarkers,setCalMarkers]     = useState(loadCalMarkers);
  const [calMarkerTypes,setCalMarkerTypes] = useState(loadCalMarkerTypes);
  const [markerPickerDate,setMarkerPickerDate] = useState(null);
  const [workDays,setWorkDays]         = useState(getWorkDays);
  const [workDayForm,setWorkDayForm]   = useState({open:false,type:"wfh",startHour:9,endHour:17,location:"",note:""});
  const [selectedDay,setSelectedDay]   = useState(null);
  const [calView,setCalView]           = useState("month");
  const [calFilter,setCalFilter]       = useState("all");
  const goToToday = () => { setCalViewDate(new Date(TODAY)); };
  const [chatOpen,setChatOpen]         = useState(false);
  // Clean up any orphaned drag clones periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      document.querySelectorAll('[style*="z-index:9999"][style*="position:fixed"]').forEach(el => {
        if (el.style.pointerEvents === 'none' && el.getAttribute('data-drag-clone') !== null) {
          el.remove();
        }
      });
    }, 2000);
    return () => clearInterval(cleanup);
  }, []);
  React.useEffect(() => { const h = () => setChatOpen(true); window.addEventListener("af-open-chat", h); return () => window.removeEventListener("af-open-chat", h); }, []);
  // Listens for inventory → shopping additions fired by AnchorVault
  const storesRef = useRef(stores);
  useEffect(() => { storesRef.current = stores; }, [stores]);
  React.useEffect(() => {
    function onAddToShopping(e) {
      var text = e.detail && e.detail.text;
      var store = e.detail && e.detail.store;
      if(!text) return;
      setShoppingItems(function(prev) {
        return prev.concat([{id:Date.now().toString()+Math.random().toString(36).slice(2,5), text:text, done:false, store:store||storesRef.current[0]?.name||"Grocery", category:"grocery"}]);
      });
    }
    window.addEventListener("af-shopping-add", onAddToShopping);
    return () => window.removeEventListener("af-shopping-add", onAddToShopping);
  }, []); // stable — reads stores via ref

  // ── AnchorVault sync trigger ─────────────────────────────────────────────
  // AnchorVault dispatches "af-data-changed" after writing vault keys.
  // We listen here and call debouncedSync if dirty keys exist.
  React.useEffect(() => {
    function onVaultChanged(e) {
      const dirty = (() => { try { return JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]"); } catch { return []; } })();
      if (dirty.length > 0) {
        AF_DEBUG&&console.log("[AF SYNC] vault change detected — dirty keys:", dirty);
        debouncedSync(e && e.detail && e.detail.opId);
      }
    }
    window.addEventListener("af-data-changed", onVaultChanged);
    return () => window.removeEventListener("af-data-changed", onVaultChanged);
  }, []); // eslint-disable-line
  const [moreDrawerOpen,setMoreDrawerOpen] = useState(false);
  const [newPersonName,setNewPersonName]   = useState("");
  const [syncing,setSyncing]           = useState(false);
  const [lastSync,setLastSync]         = useState(null);
  const [copied,setCopied]             = useState(false);

  const [calFormMode,setCalFormMode]   = useState(null);
  const [calFormId,setCalFormId]       = useState(null);
  const [calFormInit,setCalFormInit]   = useState(null);

  const [showRecipeImport,setShowRecipeImport] = useState(false);
  const [recipeUrl,setRecipeUrl]       = useState("");
  const [recipeLoading,setRecipeLoading] = useState(false);
  const [recipeResult,setRecipeResult] = useState(null);
  const [recipeError,setRecipeError]   = useState("");
  const [manualRecipe,setManualRecipe] = useState({name:"",ingredients:"",servings:"",notes:"",source:""});

  const [onboardStep,setOnboardStep]   = useState(0);
  const [onboardAnswers,setOnboardAnswers] = useState({parentNames:"",numKids:"",kidAges:"",dietaryNeeds:"",biggestChallenge:"",favoriteDinner:"",cookingStyle:""});
  const [showOnboarding,setShowOnboarding] = useState(false);

  const [notifPermission,setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [notifSettings,setNotifSettings] = useSaved("notifSettings",{
    morning:true, midday:true, dinner:true, evening:true, events:true, recurring:true
  });
  const [inAppBanner,setInAppBanner] = useState(null); // {title, body} shown as in-app toast
  const bannerTimerRef = useRef(null);
  // SW update banner — shown when a new service worker is waiting for SKIP_WAITING.
  // No auto-dismiss; user-controlled. Cleared on reload (page is gone by then).
  const [staleBanner,setStaleBanner] = useState(false);

  // ── New feature state (all useSaved first, then useState) ───────────────────
  const [onboardingComplete,setOnboardingComplete] = useSaved("onboardingComplete",false);
  const [dayBriefing,setDayBriefing]               = useSaved("dayBriefing",null);
  const [briefingBuilt,setBriefingBuilt]           = useSaved("briefingBuilt",null);
  const [lastSeenDate,setLastSeenDate]             = useSaved("lastSeenDate",null);
  const [favMeals,setFavMeals]                     = useSaved("favMeals",[]);
  const [emailSubmitted,setEmailSubmitted]         = useSaved("emailSubmitted",false);

  const [showOnboardingWizard,setShowOnboardingWizard] = useState(false);
  const [showWelcomeModal,setShowWelcomeModal] = useState(function(){
    try {
      if(localStorage.getItem("af_welcomeSeen")) return false;
      // Only show for genuinely new users — if they have ANY existing data, mark as seen
      var hasData = Object.keys(localStorage).some(function(k){ return k.startsWith("af_"); });
      if(hasData) { try{localStorage.setItem("af_welcomeSeen","1");}catch{} return false; }
      return true;
    } catch { return false; }
  });
  const [showBriefing,setShowBriefing]             = useState(false);
  const [showEndOfDay,setShowEndOfDay]             = useState(false);
  React.useEffect(function(){ var h = function(){ setShowEndOfDay(true); }; window.addEventListener("af-open-sunset", h); return function(){ window.removeEventListener("af-open-sunset", h); }; }, []);
  const [appCelebrate,setAppCelebrate]            = useState(null);
  React.useEffect(function(){ var h = function(e){ setAppCelebrate((e && e.detail) ? e.detail : {}); }; window.addEventListener("af-celebrate", h); return function(){ window.removeEventListener("af-celebrate", h); }; }, []);
  const _dayClosedKey = "dayClosed_"+TODAY_NAME+"_"+(authUser?.id||"shared");
  const [dayClosed,setDayClosed]                   = useSaved(_dayClosedKey, false);
  // Personal anchor items — per user, stored separately so each person has their own morning checklist
  const _personalAnchorsKey = "personalAnchors_"+(authUser?.id||"shared");
  const [personalAnchors,setPersonalAnchors]       = useSaved(_personalAnchorsKey, []);
  const [checkedPersonalAnchors,setCheckedPersonalAnchors] = useSaved("checkedPersonalAnchors_"+TODAY_NAME+"_"+(authUser?.id||"shared"), []);
  const [addingPersonalAnchor,setAddingPersonalAnchor] = useState(false);
  const [newPersonalAnchorText,setNewPersonalAnchorText] = useState("");
  const [showTomorrowPrep,setShowTomorrowPrep]     = useState(false);
  const [briefingLoading,setBriefingLoading]       = useState(false);
  const [sampleDayActive,setSampleDayActive]       = useState(false);
  const [aiNudgeDismissed,setAiNudgeDismissed]     = useState(false);
  const [showEmailCapture,setShowEmailCapture]     = useState(false);
  const [emailInput,setEmailInput]                 = useState("");
  const [overwhelmed,setOverwhelmed]               = useSaved("overwhelmed",false);
  const [checkedCalEvents,setCheckedCalEvents]     = useSaved("checkedCalEvents",[]);
  const [checkedMealItems,setCheckedMealItems]     = useSaved("checkedMealItems",[]);
  const [anchorNotifFor,setAnchorNotifFor]         = useState(null);
  const [insights,setInsights]                     = useSaved("insights",null);
  const [insightsBuilt,setInsightsBuilt]           = useSaved("insightsBuilt",null);
  const [compassCache,setCompassCache] = useSaved("compassCache",{});
  const [insightsLoading,setInsightsLoading]       = useState(false);
  const [dismissedInsights,setDismissedInsights]   = useSaved("dismissedInsights",[]);
  const [expandedInsightReason,setExpandedInsightReason] = useState(null);
  const [showRippleFeed,setShowRippleFeed]         = useState(false);


  // ── Handle password reset redirect from email link ───────────────────────
  // When Supabase redirects back after reset, token is in the URL hash
  const [showSetPassword, setShowSetPassword] = useState(() => {
    try {
      const hash = window.location.hash;
      return hash.includes("type=recovery") || hash.includes("type=signup");
    } catch { return false; }
  });
  const [resetToken, setResetToken] = useState(() => {
    try {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      return params.get("access_token") || null;
    } catch { return null; }
  });

  const fm = FM[flowMode];
  const close = () => setModal(null);
  const MEALS_TO_SHOW = mealCount===1?["dinner"]:mealCount===2?["lunch","dinner"]:["breakfast","lunch","dinner"];

  // ── Auto carry-over on new day ──────────────────────────────────────────────
  // Runs once on mount. If it's a new calendar day since the app was last opened,
  // automatically marks yesterday's incomplete tasks as carried forward so the
  // user doesn't have to tap "Bring forward" manually every morning.
  useEffect(() => {
    const todayStr = TODAY.toDateString();
    if (!lastSeenDate) {
      setLastSeenDate(todayStr);
      return;
    }
    if (lastSeenDate !== todayStr) {
      const yName = (() => {
        const d = new Date(TODAY);
        d.setDate(d.getDate() - 1);
        return DAY_NAMES[d.getDay()];
      })();
      setTasks(p => p.map(t => {
        // Carry forward incomplete non-AI tasks from yesterday
        if (!t.done && t.day === yName && !t.carried && !t.archived && !t.aiG) {
          return { ...t, carried: true, carriedTo: TODAY_NAME };
        }
        // Archive AI-generated tasks from previous days so they don't linger
        if (t.aiG && t.day !== TODAY_NAME && t.carriedTo !== TODAY_NAME && !t.archived) {
          return { ...t, archived: true };
        }
        return t;
      }));
      // Also clear daily check state for the new day
      setCheckedCalEvents([]);
      setCheckedMealItems([]);
      setLastSeenDate(todayStr);
    }
  }, []); // eslint-disable-line

  // ── Birthday → Calendar injection ───────────────────────────────────────────
  useEffect(function(){
    if(!birthdays||birthdays.length===0)return;
    var today=new Date();today.setHours(0,0,0,0);
    var horizon=new Date(today);horizon.setFullYear(horizon.getFullYear()+2);
    var toAdd=[];
    birthdays.forEach(function(b){
      if(!b.month||!b.day)return;
      [-1,0,1,2].forEach(function(yOff){
        var yr=today.getFullYear()+yOff;
        var d=new Date(yr,b.month-1,b.day);
        if(d<today||d>horizon)return;
        var ds=yr+"-"+String(b.month).padStart(2,"0")+"-"+String(b.day).padStart(2,"0");
        var genId="bday_"+b.id+"_"+yr;
        if(!calEvents.some(function(e){return e.id===genId;})){
          var age=b.year?yr-b.year:null;
          toAdd.push({id:genId,title:"🎂 "+b.name+(age?" (turns "+age+")":""),date:ds,time:"",color:"#c878a8",colorLabel:"Birthday",note:"",_birthday:true});
        }
      });
    });
    if(toAdd.length>0)setCalEvents(function(prev){return[...prev,...toAdd];});
  },[birthdays.length]);//eslint-disable-line

  // ── Weather ──────────────────────────────────────────────────────────────────
  function weatherEmoji(code){
    if(code===0)return"☀️";if(code<=2)return"🌤️";if(code<=3)return"☁️";
    if(code<=48)return"🌫️";if(code<=67)return"🌧️";if(code<=77)return"❄️";
    if(code<=82)return"🌧️";if(code<=99)return"⛈️";return"🌡️";
  }
  async function fetchWeather(lat,lng){
    try{
      const res=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lng+"&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=14");
      const data=await res.json();
      if(data&&data.daily){
        setWeatherData(data.daily.time.map(function(date,i){
          return{date:date,high:Math.round(data.daily.temperature_2m_max[i]),low:Math.round(data.daily.temperature_2m_min[i]),code:data.daily.weathercode[i],precip:data.daily.precipitation_probability_max[i],emoji:weatherEmoji(data.daily.weathercode[i])};
        }));
      }
    }catch(e){}
  }
  function requestWeatherLocation(){
    if(!navigator.geolocation)return;
    navigator.geolocation.getCurrentPosition(function(pos){
      var lat=pos.coords.latitude,lng=pos.coords.longitude;
      fetch("https://nominatim.openstreetmap.org/reverse?lat="+lat+"&lon="+lng+"&format=json")
        .then(function(r){return r.json();})
        .then(function(d){var city=d.address&&(d.address.city||d.address.town||d.address.village)||"Your area";setWeatherLocation({lat:lat,lng:lng,city:city});fetchWeather(lat,lng);})
        .catch(function(){setWeatherLocation({lat:lat,lng:lng,city:"Your area"});fetchWeather(lat,lng);});
    },function(){});
  }
  useEffect(function(){if(weatherLocation&&weatherLocation.lat)fetchWeather(weatherLocation.lat,weatherLocation.lng);},[]);//eslint-disable-line

  // ── ZIP code → lat/lng/timezone/weather ──────────────────────────────────────
  useEffect(function(){
    var zip = familyProfile&&familyProfile.zipcode;
    if(!zip||zip.length<5) return;
    var timeout = setTimeout(async function(){
      try {
        // 1. Get lat/lng from zip
        var geoRes = await fetch("https://api.zippopotam.us/us/"+zip.trim());
        if(!geoRes.ok) return;
        var geoData = await geoRes.json();
        var lat = parseFloat(geoData.places[0].latitude);
        var lng = parseFloat(geoData.places[0].longitude);
        var city = geoData.places[0]["place name"]+", "+geoData.places[0]["state abbreviation"];
        // 2. Get timezone from Open-Meteo (already used for weather)
        var tzRes = await fetch("https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lng+"&timezone=auto&daily=weathercode&forecast_days=1");
        var tzData = await tzRes.json();
        var timezone = tzData.timezone || "America/Denver";
        var utcOffset = tzData.utc_offset_seconds ? Math.round(tzData.utc_offset_seconds/3600) : -6;
        // 3. Save to weatherLocation and familyProfile
        setWeatherLocation({lat:lat,lng:lng,city:city,timezone:timezone,utcOffset:utcOffset});
        setFamilyProfile(function(p){return{...(p||{}),city:city,timezone:timezone,utcOffsetHours:utcOffset};});
        fetchWeather(lat,lng);
        AF_DEBUG&&console.log("[AF] ZIP",zip,"→",city,timezone,"UTC"+utcOffset);
      } catch(e){ AF_DEBUG && console.warn("[AF] ZIP lookup failed (dev only)"); }
    }, 800);
    return function(){ clearTimeout(timeout); };
  },[familyProfile&&familyProfile.zipcode]); // eslint-disable-line

  // ── Derived / constants ─────────────────────────────────────────────────────
  const todayDateStr       = TODAY.toISOString().split("T")[0];
  const briefingReadyToday = briefingBuilt === todayDateStr && !!dayBriefing;
  // Auto-build insights once per day when Anchor tab loads
  useEffect(()=>{
    if(tab==="anchor"&&insightsBuilt!==todayDateStr&&!insightsLoading){
      buildInsights();
    }
  },[tab]); // eslint-disable-line
  const hasExistingData    = tasks.length>0 || Object.keys(meals).length>0 || !!familyProfile || brainItems.length>0;
  const shouldShowOnboarding = showOnboardingWizard; // wizard only from Settings

  const MICROCOPY = ["Let's keep this simple.","You're doing enough.","It's okay if today is messy.","We'll just focus on what matters.","One thing at a time.","You've got this — really.","Progress, not perfection."];
  const todayMicrocopy = MICROCOPY[TODAY.getDate() % MICROCOPY.length];

  const SAMPLE_TASKS = [
    {id:"s1",text:"School drop-off",day:TODAY_NAME,done:true,person:"",order:0},
    {id:"s2",text:"Grocery run — just the essentials",day:TODAY_NAME,done:false,person:"",order:1},
    {id:"s3",text:"One load of laundry",day:TODAY_NAME,done:false,person:"",order:2},
    {id:"s4",text:"15-min tidy before dinner",day:TODAY_NAME,done:false,person:"",order:3},
  ];

  // ── Build Daily Briefing ────────────────────────────────────────────────────
  async function buildDailyBriefing() {
    if (briefingBuilt === todayDateStr) { setShowBriefing(true); return; }
    setBriefingLoading(true);
    setShowBriefing(true);
    const tmrName = (()=>{ const d=new Date(TODAY); d.setDate(d.getDate()+1); return DAY_NAMES[d.getDay()]; })();
    const todayMealObj = meals[TODAY_NAME]||{};
    const tmrMeal  = meals[tmrName]||{};
    const dayRhythm= rhythm[TODAY_NAME]||{};
    const tmrRhythm= rhythm[tmrName]||{};
    const carried  = tasks.filter(t=>t.carried&&t.carriedTo===TODAY_NAME&&!t.archived);
    const existing = tasks.filter(t=>(t.day===TODAY_NAME||t.day==="Daily")&&!t.archived);
    const todayEvts= calEvents.filter(e=>{
      if(!e.date)return false;
      const ed=new Date(e.date+"T00:00:00");
      return ed.getDate()===TODAY.getDate()&&ed.getMonth()===TODAY.getMonth()&&ed.getFullYear()===TODAY.getFullYear();
    }).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
    const tmrEvts  = calEvents.filter(e=>{
      if(!e.date)return false;
      const ed=new Date(e.date+"T00:00:00");
      const d=new Date(TODAY); d.setDate(d.getDate()+1);
      return ed.getDate()===d.getDate()&&ed.getMonth()===d.getMonth()&&ed.getFullYear()===d.getFullYear();
    });
    const brainPending = brainItems.filter(b=>!b.done&&!b.scheduledDay);
    const next7 = Array.from({length:7},function(_,i){var d=new Date(TODAY);d.setDate(d.getDate()+i+1);return d.toISOString().split("T")[0];});
    const upcomingEvts7 = calEvents.filter(e=>next7.includes(e.date)).slice(0,6);
    const THEME_TO_CATS_BRIEF = {
      "reset":    ["household","errands"],
      "errands":  ["errands","orders"],
      "admin":    ["admin","calls","orders"],
      "clean":    ["household"],
      "prep":     ["household","errands"],
      "family":   ["errands","household"],
      "rest":     ["someday"],
      "finance":  ["admin"],
      "fitness":  ["errands"],
      "batch cook":["household"],
    };
    const themeKeyBrief = (dayRhythm.theme||"").toLowerCase();
    const matchedCatIds = Object.entries(THEME_TO_CATS_BRIEF).find(([k])=>themeKeyBrief.includes(k))?.[1] || [];
    const ctx = [
      "Family: "+(familyProfile?JSON.stringify(familyProfile):"not set"),
      "Work situation: "+(familyProfile?.workSituation||"not set"),
      "Household members: "+people.filter(function(p){return p&&p.name;}).map(function(p){var a=personAge(p);return p.name+(p.role?" ("+p.role+")":"")+(a!=null?" age "+a:"")+(p.birthday?" born "+p.birthday:"")+(personIsMinor(p)?" [minor]":"");}).join(", "),
      "Today: "+TODAY_NAME+", theme: "+(dayRhythm.theme||"none"),
      "Events today: "+(todayEvts.map(e=>(e.time||"all day")+" "+e.title).join(", ")||"none"),
      "Upcoming events next 7 days: "+(upcomingEvts7.map(function(e){var d=new Date(e.date+"T12:00:00");var dn=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];return dn+" "+e.date+" "+(e.time||"")+" "+e.title;}).join(", ")||"none"),
      "Meals: "+(Object.entries(todayMealObj).map(([k,v])=>k+"="+v).join(", ")||"none"),
      "Carried tasks: "+(carried.map(t=>t.text).join(", ")||"none"),
      "Existing tasks: "+(existing.map(t=>t.text).join(", ")||"none"),
      "Brain dump relevant to today's theme: "+(matchedCatIds.length?brainPending.filter(b=>matchedCatIds.includes(b.cat)).map(b=>b.text).join(", "):"none"),
      "Full brain dump (undone): "+brainPending.slice(0,12).map(b=>b.text).join(", ")||"none",
      "Tomorrow: "+tmrName+", theme="+(tmrRhythm.theme||"none")+", events: "+(tmrEvts.map(e=>e.title).join(", ")||"none")+", meal: "+(tmrMeal.dinner||"not planned"),
      "Flow mode: "+flowMode,
      "Preferred name (use in greeting): "+(preferredName||familyProfile?.parentNames?.split(/[&,]/)[0]?.trim()||""),
      "Greeting tone: "+(flowGreetingTone||"warm"),
    ].join(". ");
    const sysPrompt = `You are Compass, the Anchor & Flow AI. Build a smart family daily anchor. Use the brain dump items to pull relevant tasks into today — especially ones matching the day theme. For upcoming events, suggest prep tasks (e.g. "Wash soccer jersey" for a soccer game, "Confirm reservation" for a dinner). Respond ONLY in valid JSON: {"greeting":"warm personal sentence","top3":["task","task","task"],"next3":["task","task","task"],"more":["task"],"prepItems":["meal prep step if needed"],"tomorrowNote":"one sentence about tomorrow","message":"closing encouragement"}. top3 must include appointments. Pull from brain dump where relevant — use EXACT brain dump text. Keep tasks under 55 chars.`;
    try {
      const res = await fetch("/api/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:600,system:sysPrompt,messages:[{role:"user",content:ctx}]})
      });
      const dat = await res.json();
      const txt = dat.content?.find(b=>b.type==="text")?.text||"{}";
      const p   = JSON.parse(txt.replace(/```json|```/g,"").trim());
      setTasks(prev=>{
        const existingAiTasks = prev.filter(t=>t.aiG&&(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME));
        const newT = [
          ...(p.top3||[]).map((text,i)=>{
            const ex=existingAiTasks.find(t=>t.text===text);
            return ex?{...ex,tier:"top3"}:{id:uid(),text,day:TODAY_NAME,done:false,person:"",order:i,aiG:true,tier:"top3"};
          }),
          ...(p.next3||[]).map((text,i)=>{
            const ex=existingAiTasks.find(t=>t.text===text);
            return ex?{...ex,tier:"next3"}:{id:uid(),text,day:TODAY_NAME,done:false,person:"",order:3+i,aiG:true,tier:"next3"};
          }),
          ...(p.more||[]).map((text,i)=>{
            const ex=existingAiTasks.find(t=>t.text===text);
            return ex?{...ex,tier:"more"}:{id:uid(),text,day:TODAY_NAME,done:false,person:"",order:6+i,aiG:true,tier:"more"};
          }),
        ];
        return [...prev.filter(t=>!(t.aiG&&(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME))),...newT];
      });
      setDayBriefing({...p,todayEvts,tmrEvts,todayMealObj,tmrMeal,dayRhythm,tmrRhythm,tmrName});
      setBriefingBuilt(todayDateStr);
      setLastSeenDate(todayDateStr);
    } catch(err) {
      setTasks(prev=>{
        const hasAiToday = prev.some(t=>t.aiG&&(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME));
        if(hasAiToday) return prev;
        return [...prev,
          {id:uid(),text:"Choose your most important task",day:TODAY_NAME,done:false,person:"",order:0,aiG:true,tier:"top3"},
          {id:uid(),text:"Check your calendar",day:TODAY_NAME,done:false,person:"",order:1,aiG:true,tier:"top3"},
          {id:uid(),text:"Plan tonight's dinner",day:TODAY_NAME,done:false,person:"",order:2,aiG:true,tier:"top3"},
        ];
      });
      setDayBriefing({greeting:"Let's take it one step at a time.",top3:["Choose your most important task","Check your calendar","Plan tonight's dinner"],next3:[],more:[],prepItems:[],tomorrowNote:"Tomorrow is a fresh start.",message:"You've got this.",todayEvts,tmrEvts,todayMealObj,tmrMeal,dayRhythm,tmrRhythm,tmrName});
      setBriefingBuilt(todayDateStr);
    }
    setBriefingLoading(false);
  }

  // ── Ripple Insights — proactive AI suggestions feed ───────────────────────────
  async function buildInsights() {
    if (insightsBuilt === todayDateStr && insights) return;
    setInsightsLoading(true);
    try {
      // ── Calendar: next 14 days ─────────────────────────────────────────────
      const next14 = Array.from({length:14},(_,i)=>{
        const d=new Date(TODAY); d.setDate(d.getDate()+i);
        return d.toISOString().split("T")[0];
      });
      const upcomingCal = calEvents
        .filter(e=>next14.includes(e.date))
        .sort((a,b)=>a.date.localeCompare(b.date))
        .slice(0,20)
        .map(e=>{
          const daysOut = Math.round((new Date(e.date+"T00:00:00")-TODAY)/(1000*60*60*24));
          const wd = new Date(e.date+"T00:00:00").toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
          return `${daysOut===0?"TODAY":daysOut===1?"TOMORROW":"in "+daysOut+"d"} (${wd}): ${e.title}${e.time?" at "+e.time:""}`;
        });

      // ── Meals: full week plan ──────────────────────────────────────────────
      const MEAL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const TREASURE_ICONS = ["🎁","📱","🍕","🎬","🌙","🎡","🏖️","🍦","🎮","🎨","📚","🎵","🧁","🎠","🌮"];
      const mealSummary = MEAL_DAYS
        .map(day=>{
          const m=meals[day]||{};
          const parts=[m.breakfast&&"bfast:"+m.breakfast,m.lunch&&"lunch:"+m.lunch,m.dinner&&"dinner:"+m.dinner].filter(Boolean);
          return parts.length?`${day}: ${parts.join(", ")}`:null;
        })
        .filter(Boolean);

      // ── Brain dump: pending items grouped by category ─────────────────────
      const brainPending = brainItems.filter(b=>!b.done&&!b.scheduledDay);
      const brainByCat = {};
      brainPending.forEach(b=>{
        const cat = b.cat||"other";
        if(!brainByCat[cat]) brainByCat[cat]=[];
        brainByCat[cat].push(b.text);
      });

      // ── Shopping: unchecked items by store ────────────────────────────────
      const shopPending = shoppingItems.filter(i=>!i.done);
      const shopByCat = {};
      shopPending.forEach(i=>{
        const store = i.store||"General";
        if(!shopByCat[store]) shopByCat[store]=[];
        shopByCat[store].push(i.text);
      });

      // ── Patterns from aiMemory ─────────────────────────────────────────────
      const patternCtx = Object.entries(aiMemory).slice(-12).map(([q,a])=>`• ${q}: ${a}`).join("\n");


      const ctx = [
        `Today: ${TODAY_NAME}, ${todayDateStr}`,
        `Flow mode: ${flowMode}`,
        familyProfile ? `Family: ${familyProfile.parentNames}, ${familyProfile.numKids} kids (ages ${familyProfile.kidAges}), challenge: ${familyProfile.biggestChallenge}` : "No family profile set",
        `\nCALENDAR (next 14 days):\n${upcomingCal.join("\n")||"No events"}`,



        `\nMEAL PLAN THIS WEEK:\n${mealSummary.join("\n")||"Nothing planned"}`,



        `\nBRAIN DUMP (pending items):\n${Object.entries(brainByCat).map(([c,items])=>c+": "+items.slice(0,5).join(", ")).join("\n")||"Empty"}`,



        `\nSHOPPING LIST (pending):\n${Object.entries(shopByCat).map(([s,items])=>s+": "+items.slice(0,6).join(", ")).join("\n")||"Empty"}`,



        patternCtx ? `\nKNOWN PATTERNS:\n${patternCtx}` : "",


      ].filter(Boolean).join("\n");


      const res = await fetch("/api/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:1000,
          system:`Today is ${new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}. You are Compass, Anchor & Flow's proactive insight engine — warm, practical, and specific like a brilliant family manager friend. Scan the family's real data and surface 3-5 things they might be missing or that deserve attention NOW.

INSIGHT CATEGORIES (use exactly these ids):
- "calendar" — scheduling conflicts, tight transitions, prep needed for upcoming events
- "meals" — missing dinner plans on busy days, defrost reminders, meal-event conflicts  
- "brain" — brain dump items that connect to upcoming events or are overdue
- "shopping" — items needed for upcoming events or meals not yet on the list
- "pattern" — recurring things you notice (birthdays, seasonal, habit-based)

PRIORITY RULES:
- "hi" = needs action in next 48 hours, genuine risk of being missed
- "normal" = good to do this week

ACTION TYPES (pick the most useful):
- "addTask" — button says "Add Task", adds to today's tasks
- "addShopping" — button says "Add to List", for shopping items
- "planMeal" — button says "Plan Meal", opens meals tab
- "openCalendar" — button says "Open Calendar"
- "none" — informational only, no button needed

RULES:
1. Be SPECIFIC. Use real names, dates, meal names, event titles from their data.
2. Cross-reference sources: "Soccer game Thursday + no dinner planned Thursday = insight"
3. Never invent data. Only surface what's genuinely in their data.
4. Order by urgency (most urgent first).
5. Skip generic advice. Every insight must reference their actual data.

Respond ONLY with valid JSON array, no markdown:
[{
  "title": "Short specific title",
  "body": "1-2 sentences. Specific, warm, actionable. Name the actual event/meal/person.",
  "priority": "hi|normal",
  "category": "calendar|meals|brain|shopping|pattern",
  "actionType": "addTask|addShopping|planMeal|openCalendar|none",
  "actionLabel": "Button text",
  "actionPayload": "The task text or item to add (if actionType is addTask or addShopping)",
  "reason": "One sentence: exactly what data triggered this insight"
}]`,
          messages:[{role:"user",content:ctx}]
        })
      });
      const dat = await res.json();
      const txt = dat.content?.find(b=>b.type==="text")?.text||"[]";
      const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
      if(Array.isArray(parsed)&&parsed.length>0){
        setInsights(parsed);
        setInsightsBuilt(todayDateStr);
        setDismissedInsights([]);
      }
    } catch(err) {
      AF_DEBUG && console.error("[AF] Insights error (dev only)");
    }
    setInsightsLoading(false);
  }

  // ── Yesterday carry-over ────────────────────────────────────────────────────
  const yesterdayName = (() => { const d=new Date(TODAY); d.setDate(d.getDate()-1); return DAY_NAMES[d.getDay()]; })();
  const incompletePrevTasks = tasks.filter(t => !t.done && t.day===yesterdayName && !t.carried && !t.archived);

  function carryTasksOver() {
    setTasks(p => p.map(t =>
      incompletePrevTasks.find(x=>x.id===t.id) ? {...t, carried:true, carriedTo:TODAY_NAME} : t
    ));
  }

  // ── Notifications ───────────────────────────────────────────────────────────
  async function requestNotifPermission() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") scheduleAllDailyNotifications();
  }

  function showInAppBanner(title, body) {
    clearTimeout(bannerTimerRef.current);
    setInAppBanner({title, body});
    bannerTimerRef.current = setTimeout(() => setInAppBanner(null), 8000);
  }

  function scheduleNotification(title, body, fireAt) {
    const delay = fireAt instanceof Date
      ? fireAt.getTime() - Date.now()
      : typeof fireAt === "number" ? fireAt : 0;
    if (delay > 86400000) return; // ignore anything more than 24hrs out

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const hasNativeNotif = typeof Notification !== "undefined" && Notification.permission === "granted";

    function fire() {
      if (hasNativeNotif && !isIOS) {
        // Desktop / Android — use native notification via Service Worker
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "SHOW_NOTIFICATION", title, body, icon: "/favicon.svg"
          });
        } else {
          new Notification(title, {body, icon:"/favicon.svg"});
        }
      } else {
        // iOS Safari doesn't support Web Notifications — show in-app banner instead
        showInAppBanner(title, body);
      }
    }

    if (delay <= 0) { fire(); return; }
    setTimeout(fire, delay);
  }

  function addNotification(entityId, entityTitle, date, time, note) {
    const id = uid();
    const fireAt = date && time ? `${date}T${time}` : null;
    setNotifications(p => [
      ...p.filter(n => n.entityId !== entityId),
      {id, entityId, entityTitle, date, time, note, fireAt, fired:false}
    ]);
    if (fireAt && notifPermission === "granted") {
      scheduleNotification(entityTitle, note || "Reminder from Anchor & Flow", new Date(fireAt));
    }
  }

  // ── Helper: fire time today at a given hour/minute ───────────────────────────
  function todayAt(hour, minute=0) {
    const t = new Date();
    t.setHours(hour, minute, 0, 0);
    return t;
  }

  // ── Helper: format "14:30" → "2:30 PM" ──────────────────────────────────────
  function fmtTime(t) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
  }

  // ── AI message generator ─────────────────────────────────────────────────────
  async function generateAIMessage(system, userContent, fallback) {
    try {
      const r = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 160,
          system, messages: [{ role: "user", content: userContent }]
        })
      });
      if (!r.ok) {
        console.warn("[AF CLAUDE] request failed", r.status, "— using fallback, no retry");
        return fallback;
      }
      const d = await r.json();
      return d.content?.find(b => b.type === "text")?.text || fallback;
    } catch { return fallback; }
  }

  // ── Schedule all daily notifications ─────────────────────────────────────────
  async function scheduleAllDailyNotifications() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    // On iOS, native notifications aren't supported but we still run this
    // to schedule in-app banners. On other platforms, require permission.
    if (!isIOS && notifPermission !== "granted") return;
    // Session guard: only call Claude APIs once per app session per day.
    // Prevents repeated /api/claude calls on re-renders or repeated useEffect triggers.
    const sessionKey = "af_notifScheduled_" + TODAY.toDateString();
    if (sessionStorage.getItem(sessionKey)) {
      AF_DEBUG&&console.log("[AF CLAUDE] notifications already scheduled this session — skipping");
      return;
    }
    sessionStorage.setItem(sessionKey, "1");
    setDailySummaryScheduled(TODAY.toDateString());

    const todayTasks  = tasks.filter(t => (t.day===TODAY_NAME||t.day==="Daily") && !t.archived);
    const doneTasks   = todayTasks.filter(t => t.done);
    const pendingTasks= todayTasks.filter(t => !t.done);
    const todayMeal   = (meals[TODAY_NAME]||{}).dinner;
    const todayDateStr= TODAY.toISOString().split("T")[0];
    const todayEvts   = calEvents.filter(e => e.date === todayDateStr).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
    const tmrName     = DAY_NAMES[new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate()+1).getDay()];
    const tmrMeal     = (meals[tmrName]||{}).dinner;
    const familyCtx   = familyProfile ? `Family: ${familyProfile.parentNames}, ${familyProfile.numKids} kids. Work: ${familyProfile.workSituation||"not set"}.` : "";
    const dataCtx     = `Tasks: ${pendingTasks.slice(0,4).map(t=>t.text).join(", ")||"none"}. Dinner: ${todayMeal||"not planned"}. Events: ${todayEvts.slice(0,3).map(e=>`${e.time||"all day"} ${e.title}`).join(", ")||"none"}. ${familyCtx}`;

    const now = new Date();

    // ── Build a human-readable schedule string for today ────────────────────
    const scheduleLines = [
      ...todayEvts.map(e => `${e.time ? fmtTime(e.time) : "All day"}: ${e.title}`),
      ...(todayMeal ? [`Dinner: ${todayMeal}`] : []),
    ];
    const scheduleStr = scheduleLines.length > 0
      ? scheduleLines.join(" · ")
      : "Clear schedule today";

    // ── 1. MORNING AGENDA (7am) — Ripple style ────────────────────────────────
    const morningTime = todayAt(7);
    if (morningTime > now && notifSettings.morning !== false) {
      // Build a structured body that always lists the actual schedule
      const body = scheduleLines.length > 0
        ? scheduleStr
        : `${pendingTasks.length} tasks today. ${todayMeal ? `Dinner: ${todayMeal}.` : "No dinner planned yet."} You've got this ⚓️`;
      // Also get a warm AI greeting for the title
      const title = await generateAIMessage(
        `You are Compass, the Anchor & Flow AI. Write a warm good morning greeting — max 50 chars, no punctuation at end. Start with "Good morning" and optionally one warm word. Examples: "Good morning, lovely day ahead", "Good morning — let's do this".`,
        dataCtx,
        "Good morning ⚓️ Here's your day"
      );
      scheduleNotification(title, body, morningTime);
    }

    // ── 2. MIDDAY CHECK-IN (12pm) ───────────────────────────────────────────
    const middayTime = todayAt(12);
    if (middayTime > now && notifSettings.midday !== false) {
      const afternoonEvts = todayEvts.filter(e => {
        if (!e.time) return false;
        const [h] = e.time.split(":").map(Number);
        return h >= 12;
      });
      const afternoonStr = afternoonEvts.length > 0
        ? `Coming up: ${afternoonEvts.map(e=>`${fmtTime(e.time)} ${e.title}`).join(", ")}.`
        : "";
      const body = `${doneTasks.length > 0 ? `${doneTasks.length} done ✓ ` : ""}${afternoonStr}${todayMeal ? ` Dinner tonight: ${todayMeal}.` : ""}`.trim() || "Keep going — you're doing great 🌿";
      scheduleNotification("🌊 Midday check-in", body, middayTime);
    }

    // ── 3. MEAL REMINDER — defrost alert (3pm if dinner needs it) ───────────
    const defrostTime = todayAt(15);
    if (defrostTime > now && notifSettings.dinner !== false && todayMeal && !["snack plate","freezer burrito","rotisserie","no-cook"].some(s=>todayMeal.toLowerCase().includes(s))) {
      const msg = await generateAIMessage(
        `You are Compass, the Anchor & Flow AI. Write a friendly 3pm meal prep reminder (max 120 chars). Mention the specific dinner and suggest one thing to do now (defrost, start slow cooker, etc). Warm tone.`,
        `Dinner tonight: ${todayMeal}. Family: ${familyProfile?.numKids||""} kids.`,
        `🍽️ Dinner reminder — ${todayMeal} tonight. Good time to check if anything needs defrosting!`
      );
      scheduleNotification("🍽️ Dinner heads-up", msg, defrostTime);
    }

    // ── 4. EVENING RECAP — Ripple-style (5pm) ─────────────────────────────────
    const eveningTime = todayAt(17);
    if (eveningTime > now && notifSettings.evening !== false) {
      const tmrDateStr = new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate()+1).toISOString().split("T")[0];
      const tmrEvtsList = calEvents.filter(e=>e.date===tmrDateStr);
      const tmrStr = [
        ...tmrEvtsList.map(e=>`${e.time?fmtTime(e.time)+" ":""} ${e.title}`),
        ...(tmrMeal?[`Dinner: ${tmrMeal}`]:[])
      ].join(" · ");
      const body = await generateAIMessage(
        `You are Compass, the Anchor & Flow AI — warm and real. Write an evening recap (max 160 chars). Acknowledge what they did, mention tomorrow briefly. Caring tone, not corporate.`,
        `Done today: ${doneTasks.map(t=>t.text).join(", ")||"none"}. Still pending: ${pendingTasks.length}. Tomorrow (${tmrName}): ${tmrStr||"nothing planned yet"}.`,
        `Good evening 🌙 ${doneTasks.length>0?`${doneTasks.length} things done today — well done.`:"Rest up."} ${tmrStr?`Tomorrow: ${tmrStr.slice(0,60)}.`:""}`
      );
      scheduleNotification("🌙 Evening recap", body, eveningTime);
    }

    // ── 5. SMART EVENT NUDGES — 2hrs before each appointment ────────────────
    if (notifSettings.events !== false) todayEvts.forEach(async (e) => {
      if (!e.time) return;
      const [h,m] = e.time.split(":").map(Number);
      const eventTime = todayAt(h, m);
      const nudgeTime = new Date(eventTime.getTime() - 2 * 60 * 60 * 1000); // 2hrs before
      if (nudgeTime <= now) return;
      const msg = await generateAIMessage(
        `You are Compass, the Anchor & Flow AI. Write a friendly heads-up notification for an upcoming appointment in 2 hours (max 120 chars). Be warm and helpful — suggest one thing to do to prepare.`,
        `Event: ${e.title} at ${e.time}. ${familyCtx}`,
        `⏰ ${e.title} is in 2 hours — time to get ready!`
      );
      scheduleNotification(`⏰ Coming up: ${e.title}`, msg, nudgeTime);
    });

    // ── 6. RECURRING REMINDERS (trash, HVAC, street sweeping, custom, etc.) ──
    (function() {
      try {
        var recurList = JSON.parse(localStorage.getItem("af_recurring") || "null");
        // Also check legacy af_trash and migrate on the fly if needed
        if (!recurList || !recurList.length) {
          var oldTrash = JSON.parse(localStorage.getItem("af_trash") || "null");
          if (oldTrash) {
            recurList = [];
            if (oldTrash.trash && oldTrash.trash.day != null) recurList.push({ id:"legacy_trash", emoji:"🗑️", label:"Trash", type:"weekly_day", day:oldTrash.trash.day, freq:oldTrash.trash.freq||"weekly", lastDone:null, remindEvening:oldTrash.remindEvening!==false, remindMorning:oldTrash.remindMorning!==false, active:true });
            if (oldTrash.recycling && oldTrash.recycling.day != null) recurList.push({ id:"legacy_recycling", emoji:"♻️", label:"Recycling", type:"weekly_day", day:oldTrash.recycling.day, freq:oldTrash.recycling.freq||"biweekly", lastDone:null, remindEvening:oldTrash.remindEvening!==false, remindMorning:oldTrash.remindMorning!==false, active:true });
          }
        }
        if (!recurList || !recurList.length) return;

        var FREQ_DAYS_R = { weekly:7, biweekly:14, every6wk:42, every2mo:61, every3mo:91, every6mo:182, yearly:365, monthly:30 };
        var remindedKey = "af_recur_reminded_" + todayDateStr;
        var alreadyRemindedStr = localStorage.getItem(remindedKey) || "";

        function getNextDateR(r) {
          var base = new Date(now); base.setHours(0,0,0,0);
          if (r.type === "weekly_day") {
            if (r.day == null) return null;
            var diff = (r.day - base.getDay() + 7) % 7;
            var d = new Date(base); d.setDate(d.getDate() + diff);
            if (r.freq === "biweekly" && r.lastDone) {
              var lp = new Date(r.lastDone); lp.setHours(0,0,0,0);
              var ws = Math.round((d - lp) / (7 * 86400000));
              if (ws % 2 !== 0) d.setDate(d.getDate() + 7);
            }
            if (r.freq === "monthly") {
              var first = new Date(base.getFullYear(), base.getMonth(), 1);
              d = new Date(first); d.setDate(1 + (r.day - first.getDay() + 7) % 7);
              if (d < base) { d.setMonth(d.getMonth()+1); d.setDate(1); var b2=new Date(d); d.setDate(1+(r.day-b2.getDay()+7)%7); }
            }
            return d;
          } else {
            // interval-based
            var days = FREQ_DAYS_R[r.freq] || 90;
            if (r.lastDone) {
              var last = new Date(r.lastDone); last.setHours(0,0,0,0);
              var next = new Date(last); next.setDate(next.getDate() + days);
              return next;
            }
            return base; // no lastDone = due now
          }
        }

        function daysUntilR(r) {
          var next = getNextDateR(r); if (!next) return null;
          var base = new Date(now); base.setHours(0,0,0,0);
          return Math.round((next - base) / 86400000);
        }

        var toFire = [];
        recurList.filter(function(r){return r.active!==false;}).forEach(function(r) {
          var days = daysUntilR(r);
          if (days == null) return;
          var alreadyFired = alreadyRemindedStr.includes(r.id);
          if (r.remindEvening && days === 1 && !alreadyFired) {
            toFire.push({ r:r, when:"evening" });
          }
          if (r.remindMorning && days === 0) {
            toFire.push({ r:r, when:"morning" });
          }
        });

        toFire.forEach(function(item) {
          var r = item.r;
          var fireTime = item.when === "evening" ? todayAt(19, 30) : todayAt(7, 15);
          if (fireTime <= now) {
            if (item.when === "morning" && now.getHours() < 10) fireTime = now;
            else if (item.when === "evening" && now.getHours() < 21) fireTime = now;
            else return;
          }
          var title = item.when === "evening"
            ? r.emoji + " " + r.label + " — tomorrow"
            : r.emoji + " " + r.label + " — today!";
          var body = item.when === "evening"
            ? "Heads up — " + r.label + " is due tomorrow. Get ahead of it tonight."
            : r.type === "weekly_day"
              ? "Today is " + r.label + " day. Don't forget!"
              : "Time to take care of: " + r.label + ". Mark it done when finished.";
          scheduleNotification(title, body, fireTime);
        });

        if (toFire.filter(function(i){return i.when==="evening";}).length) {
          var firedIds = toFire.map(function(i){return i.r.id;}).join(",");
          localStorage.setItem(remindedKey, firedIds);
        }
      } catch(e) { AF_DEBUG && console.error("[AF] Recurring reminder error (dev only)"); }
    })();
  }

  // ── Legacy alias ─────────────────────────────────────────────────────────────
  const scheduleDailySummary = scheduleAllDailyNotifications;

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    // Run on iOS always (uses in-app banners), elsewhere only if permission granted
    if (notifPermission === "granted" || isIOS) scheduleAllDailyNotifications();
    // SW is registered once in the dedicated mount useEffect above.
    // No re-registration here — calling register() again is harmless but redundant.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifPermission]);

  // Listen for the banner's "Turn on" button — triggers full permission + scheduling
  useEffect(() => {
    function handleNotifRequest() { requestNotifPermission(); }
    window.addEventListener("af-request-notif-permission", handleNotifRequest);
    return () => window.removeEventListener("af-request-notif-permission", handleNotifRequest);
  }, []); // eslint-disable-line

  // On mount: recover notifications that were scheduled but couldn't fire because
  // the tab was closed or the device slept. Show missed ones as in-app banners,
  // and re-arm any future ones (within 24h) so they fire this session.
  useEffect(() => {
    const now = Date.now();
    notifications.forEach(n => {
      if (!n.fireAt || n.fired) return;
      const target = new Date(n.fireAt).getTime();
      if (isNaN(target)) return;
      if (target <= now) {
        showInAppBanner(n.entityTitle, n.note || "Reminder from Anchor & Flow");
        setNotifications(p => p.map(x => x.id === n.id ? {...x, fired: true} : x));
      } else {
        scheduleNotification(n.entityTitle, n.note || "Reminder from Anchor & Flow", new Date(n.fireAt));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // Sync household data when key state changes — skip initial hydration
  const hasMountedSync = useRef(false);
  useEffect(() => {
    if (!hasMountedSync.current) {
      hasMountedSync.current = true;
      AF_DEBUG&&console.log("[AF SYNC] skipping initial hydration sync");
      return;
    }
    const dirty2 = (() => { try { return JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]"); } catch { return []; } })();
    AF_DEBUG&&console.log("[AF SYNC] user change detected — syncing, dirty keys:", dirty2);
    debouncedSync();
  }, [tasks, meals, calEvents, shoppingItems, brainItems, brainCats, people, familyProfile, rhythm, stores, shopCategories, homeSystems, notifications, birthdays, aiMemory, coveData, dietaryFilters, recipes, mealBankCustom, favMeals, notifSettings, flowMode, sections]); // eslint-disable-line

  // ── Share text ──────────────────────────────────────────────────────────────
  function shareText() {
    const todayTasks = tasks.filter(t=>t.day===TODAY_NAME||t.day==="Daily");
    const tm = meals[TODAY_NAME]||{};
    const mealLines = MEALS_TO_SHOW.map(m=>`${m}: ${tm[m]||"—"}`);
    return `⚓️ Anchor & Flow — ${FORMAT_DATE(TODAY)}\nA steadier home, in every season\n\nFlow Mode: ${flowMode} ${fm.emoji}\n\nToday's Tasks:\n${todayTasks.map(t=>`• ${t.text}${t.carried?" ↩":""}`).join("\n")||"No tasks."}\n\nMeals:\n${mealLines.join("\n")}\n\nHave a beautiful day 🌿`;
  }

  // ── Calendar helpers ────────────────────────────────────────────────────────
  function toggleCalMarker(dateStr, emoji){
    setCalMarkers(function(prev){
      var next = Object.assign({}, prev);
      var arr = (next[dateStr] || []).slice();
      var idx = arr.indexOf(emoji);
      if (idx === -1) arr.push(emoji); else arr.splice(idx,1);
      if (arr.length) next[dateStr] = arr; else delete next[dateStr];
      saveCalMarkers(next);
      return next;
    });
  }
  // ── Calendar emoji markers (standalone localStorage, no household sync) ──
  function loadCalMarkers(){ try { var v = JSON.parse(localStorage.getItem("af_cal_markers")||"{}"); return (v && typeof v==="object") ? v : {}; } catch(e){ return {}; } }
  function saveCalMarkers(m){
    try { localStorage.setItem("af_cal_markers", JSON.stringify(m)); } catch(e){}
    markKeyDirty("cal_markers");
    try { window.dispatchEvent(new CustomEvent("af-data-changed")); } catch(e) {}
  }
  function loadCalMarkerTypes(){
    try { var v = JSON.parse(localStorage.getItem("af_cal_marker_types")||"null"); if (Array.isArray(v) && v.length) return v; } catch(e){}
    return [
      { emoji:"⭐", label:"Custody" },
      { emoji:"☎️", label:"On call" },
      { emoji:"✈️", label:"Travel" },
      { emoji:"🏫", label:"School closed" },
      { emoji:"💊", label:"Medication" },
      { emoji:"🏈", label:"Practice" },
      { emoji:"🎂", label:"Birthday" },
      { emoji:"❤️", label:"Date night" },
      { emoji:"🩺", label:"Work" }
    ];
  }
  function saveCalMarkerTypes(t){ try { localStorage.setItem("af_cal_marker_types", JSON.stringify(t)); } catch(e){} }

  function localDateStr(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function calDayFromStr(str){ if(!str)return null; const [y,m,d]=str.split("-").map(Number); return new Date(y,m-1,d); }
  function openAddEvent(prefillDate){ setCalFormInit({title:"",date:prefillDate||"",time:"",color:"#6A9BB5",colorLabel:calColorLabels["#6A9BB5"]||"Blue",colorCustom:"",note:"",repeat:"",forPerson:null,responsibleParent:null}); setCalFormMode("add"); setCalFormId(null); }
  function openEditEvent(e){ setCalFormInit({...e,colorCustom:e.colorCustom||""}); setCalFormId(e.id); setCalFormMode("edit"); }
  function closeCalForm(){ setCalFormMode(null); setCalFormId(null); setCalFormInit(null); }

  // ── Recipe import ───────────────────────────────────────────────────────────
  async function importRecipeFromUrl() {
    if (!recipeUrl.trim()) return;
    setRecipeLoading(true); setRecipeError(""); setRecipeResult(null);
    try {
      const r = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-sonnet-4-6", max_tokens:800,
        system:`Extract recipe info from a URL. Respond ONLY in JSON: {"name":"","ingredients":[],"servings":"","time":"","notes":"","source":""}. If social media video, set name to "Paste ingredients below" and notes to "Social media video — please paste the ingredient list manually."`,
        messages:[{role:"user",content:`URL: ${recipeUrl.trim()}`}]
      })});
      const d = await r.json();
      const txt = d.content?.find(b=>b.type==="text")?.text||"{}";
      setRecipeResult(JSON.parse(txt.replace(/```json|```/g,"").trim()));
    } catch { setRecipeError("Couldn't parse that URL. Try entering the recipe manually below."); }
    setRecipeLoading(false);
  }

  function saveImportedRecipe() {
    if (recipeResult) {
      setRecipes(p=>[...p,{...recipeResult,id:uid(),savedAt:new Date().toISOString()}]);
      setRecipeResult(null); setRecipeUrl(""); setShowRecipeImport(false);
    }
  }

  function saveManualRecipe() {
    if (!manualRecipe.name.trim()) return;
    const ing = manualRecipe.ingredients.split("\n").filter(Boolean);
    setRecipes(p=>[...p,{...manualRecipe,ingredients:ing,id:uid(),savedAt:new Date().toISOString()}]);
    setManualRecipe({name:"",ingredients:"",servings:"",notes:"",source:""});
    setShowRecipeImport(false);
  }

  // ── Shared UI helpers ───────────────────────────────────────────────────────
  _hfRenders.Pill = ({label,color,tiny}) => (
    <span style={{display:"inline-flex",padding:tiny?"2px 8px":"3px 10px",borderRadius:"2rem",fontSize:tiny?"0.62rem":"0.69rem",fontWeight:700,background:(color||T.sage)+"28",color:color||T.sage,letterSpacing:"0.03em",whiteSpace:"nowrap",border:`1px solid ${(color||T.sage)}45`}}>{label}</span>
  );

  _hfRenders.SecHead = ({emoji,title,sub,action,color,onBack}) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1rem",gap:"0.5rem"}}>
      <div style={{minWidth:0,flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
          {onBack && (
            <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",padding:"2px 4px 2px 0",display:"flex",alignItems:"center",flexShrink:0,opacity:0.55,marginRight:2}}>
              <Icon name="arrow-left" size={17} color={T.textSoft}/>
            </button>
          )}
          {emoji&&<span style={{fontSize:"1.05rem",flexShrink:0}}>{emoji}</span>}
          <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.2rem",fontWeight:700,color:color||T.textDark}}>{title}</h2>
        </div>
        {sub&&<p style={{margin:"0.22rem 0 0",color:T.textSoft,fontSize:"0.79rem",fontWeight:500}}>{sub}</p>}
      </div>
      {action&&<div style={{flexShrink:0}}>{action}</div>}
    </div>
  );

  // ── Alias stable wrappers to local names ─────────────────────────────────────
  // Must come BEFORE render delegates so component bodies can cross-reference.
  const { Pill, SecHead,
          ModalBox, PersonPill, AnchorCheckItem, TaskRow, DraggableTaskList,
          ShopItemRow, BrainItemRow, AIChatPanel, TodaySnapshot, OnboardingWizard,
          DailyBriefingModal, EndOfDayReset, AnchorTab, CalendarTab, WeeklyTab,
          MealBankDrawer, WeekTypePicker, MealsTab, ShoppingTab, HomeTab, BrainTab,
          BurnoutTab, TidePoolTab, SettingSection, CareerTab, ItemRow, CoveTab,
          SchoolTab, GoogleCalendarModal, AuthModal, HouseholdModal, CalEventFormModal,
          SetPasswordModal } = _hfComps;

  _hfRenders.ModalBox = function ModalBox({title,onClose,children,wide}){
    useEffect(() => {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }, []);
    return (
      <div data-modal-open="true" style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(8px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"env(safe-area-inset-top,1rem) 1rem env(safe-area-inset-bottom,1rem)",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:"1.4rem",padding:"1.8rem",width:"100%",maxWidth:wide?600:460,boxShadow:`0 32px 100px ${T.cardShadow}`,margin:"auto",maxHeight:"calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 2rem)",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.4rem"}}>
            <h3 style={{margin:0,color:T.textDark,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.3rem",fontWeight:700}}>{title}</h3>
            <button onClick={onClose} style={{background:T.bgAlt,border:`1px solid ${T.border}`,color:T.textMid,cursor:"pointer",padding:6,display:"flex",borderRadius:"50%"}}><Icon name="close" size={16} color={T.textMid}/></button>
          </div>
          {children}
        </div>
      </div>
    );
  }

  // ── Person Pill ─────────────────────────────────────────────────────────────
  _hfRenders.PersonPill = function PersonPill({name, people, T}) {
    const pc = people.find(p=>p.name===name);
    const color = pc?.color || T.textFaint;
    return (
      <span style={{display:"inline-flex",alignItems:"center",gap:"4px",background:color+"22",color,borderRadius:"2rem",padding:"2px 8px",fontSize:"0.65rem",fontWeight:700,border:"1px solid "+color+"50"}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:color,flexShrink:0}}/>{name}
      </span>
    );
  }

  // ── Anchor Check Item — checkable row with fade-out + inline bell ───────────
  _hfRenders.AnchorCheckItem = function AnchorCheckItem({ id, text, checked, onCheck, color, badge, bell=true, entityTitle, onTitleClick }) {
    const [removing, setRemoving] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [nd, setNd] = useState(""); const [nt, setNt] = useState(""); const [nn, setNn] = useState("");
    const hasNotif = notifications.some(n=>n.entityId===id&&!n.fired);

    function handleCheck() {
      setRemoving(true);
      setTimeout(() => onCheck(id), 380);
    }
    return (
      <div style={{
        transition:"all 0.35s ease",
        opacity: removing ? 0 : 1,
        transform: removing ? "translateX(24px)" : "none",
        maxHeight: removing ? 0 : 120,
        overflow: "hidden",
        marginBottom: removing ? 0 : "0.32rem",
      }}>
        <div style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.6rem 0.7rem",background:checked?T.bgAlt:T.white,borderRadius:"0.85rem",border:`1.5px solid ${checked?T.borderSoft:(color||T.blue)+"45"}`,transition:"all 0.2s"}}>
          <div onClick={handleCheck} style={{width:24,height:24,borderRadius:"50%",background:checked?(color||T.blue):"transparent",border:`2.5px solid ${checked?(color||T.blue):(color||T.blue)+"70"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
            {checked&&<Icon name="check" size={11} color="#fff"/>}
          </div>
          <span onClick={onTitleClick||undefined} style={{flex:1,fontSize:"0.88rem",fontWeight:checked?400:600,color:checked?T.textFaint:T.textDark,textDecoration:checked?"line-through":"none",lineHeight:1.35,cursor:onTitleClick?"pointer":"default"}}>{text}</span>
          {badge&&<span style={{fontSize:"0.58rem",background:(color||T.blue)+"18",color:color||T.blue,fontWeight:800,padding:"2px 6px",borderRadius:"1rem",whiteSpace:"nowrap"}}>{badge}</span>}
          {bell&&<button onClick={()=>setNotifOpen(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex",flexShrink:0,opacity:hasNotif?1:0.4}}>
            <Icon name="bell" size={13} color={hasNotif?T.sand:T.textSoft}/>
          </button>}
        </div>
        {notifOpen&&(
          <div style={{background:T.bgAlt,border:`1px solid ${T.sand}50`,borderRadius:"0.7rem",padding:"0.7rem 0.85rem",marginTop:"0.3rem",marginBottom:"0.3rem"}}>
            <div style={{fontSize:"0.7rem",fontWeight:800,color:T.sandDark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.55rem"}}>🔔 Set Reminder</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.4rem",marginBottom:"0.4rem"}}>
              <input type="date" value={nd} onChange={e=>setNd(e.target.value)} style={inp({padding:"0.32rem 0.5rem",fontSize:"0.77rem"})}/>
              <input type="time" value={nt} onChange={e=>setNt(e.target.value)} style={inp({padding:"0.32rem 0.5rem",fontSize:"0.77rem"})}/>
            </div>
            <input value={nn} onChange={e=>setNn(e.target.value)} placeholder="Note (optional)" style={{...inp({marginBottom:"0.45rem",fontSize:"0.77rem",padding:"0.32rem 0.5rem"})}}/>
            <div style={{display:"flex",gap:"0.35rem"}}>
              <button onClick={()=>{ addNotification(id, entityTitle||text, nd, nt, nn); setNotifOpen(false); }} style={btnP(T.sand,{fontSize:"0.73rem",padding:"0.3rem 0.7rem"})}>Set</button>
              {hasNotif&&<button onClick={()=>{setNotifications(p=>p.filter(n=>n.entityId!==id));setNotifOpen(false);}} style={btnS({fontSize:"0.73rem",padding:"0.3rem 0.6rem",color:T.rose})}>Clear</button>}
              <button onClick={()=>setNotifOpen(false)} style={btnS({fontSize:"0.73rem",padding:"0.3rem 0.6rem"})}>✕</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Task Row ────────────────────────────────────────────────────────────────
  _hfRenders.TaskRow = function TaskRow({t, onToggle, onDelete, onSave, accent, showNotifFor, setShowNotifFor, onMoveDay, allDays, currentDay}) {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(t.text);
    const [notifDate, setNotifDate] = useState("");
    const [notifTime, setNotifTime] = useState("");
    const [notifNote, setNotifNote] = useState("");
    const [showDayPicker, setShowDayPicker] = useState(false);
    const hasNotif = notifications.some(function(n){return n.entityId===t.id&&!n.fired;});
    const isShowingNotif = showNotifFor===t.id;
    return (
      <div style={{borderBottom:"1px solid "+T.borderSoft}}>
        {editing ? (
          <div style={{display:"flex",gap:"0.5rem",padding:"0.45rem 0",alignItems:"center"}}>
            <input value={editVal} onChange={function(e){setEditVal(e.target.value);}}
              onKeyDown={function(e){if(e.key==="Enter"){onSave(t.id,editVal);setEditing(false);}if(e.key==="Escape")setEditing(false);}}
              style={{...inp({flex:1,padding:"0.4rem 0.65rem",fontSize:"0.85rem"})}} autoFocus/>
            <button onClick={function(){onSave(t.id,editVal);setEditing(false);}} style={btnP(T.sage,{padding:"0.4rem 0.7rem",fontSize:"0.78rem"})}>Save</button>
            <button onClick={function(){setEditing(false);}} style={btnS({padding:"0.4rem 0.7rem",fontSize:"0.78rem"})}>Cancel</button>
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.55rem 0"}}>
              <div style={{cursor:"grab",display:"flex",flexShrink:0,opacity:0.35}}><Icon name="drag" size={14} color={T.textSoft}/></div>
              <button onClick={function(){onToggle(t.id);}} style={{width:22,height:22,borderRadius:"50%",border:"2px solid "+(t.done?(accent||T.sage):T.border),background:t.done?(accent||T.sage):"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                {t.done&&<Icon name="check" size={12} color="#fff"/>}
              </button>
              <span style={{flex:1,fontSize:"0.87rem",color:t.done?T.textFaint:T.textDark,textDecoration:t.done?"line-through":"none",fontWeight:t.done?400:600}}>
                {t.carried&&<span style={{fontSize:"0.64rem",color:T.sand,fontWeight:700,marginRight:"0.3rem"}}>↩</span>}
                {t.text}
              </span>
              {t.person&&<Pill label={t.person} color={people.find(function(p){return p.name===t.person;})?.color||T.textSoft} tiny/>}
              {hasNotif&&<span style={{fontSize:"0.7rem"}}>🔔</span>}
              {onMoveDay&&allDays&&(
                <div style={{position:"relative"}}>
                  <button onClick={function(){setShowDayPicker(function(v){return !v;});}} title="Move to another day" style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex",opacity:0.5,fontSize:"0.7rem"}}>📅</button>
                  {showDayPicker&&(
                    <div style={{position:"absolute",right:0,top:"calc(100% + 2px)",zIndex:50,background:T.white,border:"1.5px solid "+T.border,borderRadius:"0.75rem",boxShadow:"0 4px 16px rgba(0,0,0,0.12)",padding:"0.35rem",minWidth:120}}>
                      {allDays.filter(function(d){return d!==currentDay;}).map(function(d){return(
                        <button key={d} onClick={function(){onMoveDay(t.id,d);setShowDayPicker(false);}} style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"none",cursor:"pointer",padding:"0.3rem 0.6rem",fontSize:"0.78rem",fontWeight:600,color:T.textDark,borderRadius:"0.5rem",fontFamily:"inherit"}}
                          onMouseEnter={function(e){e.currentTarget.style.background=T.bgAlt;}}
                          onMouseLeave={function(e){e.currentTarget.style.background="";}}
                        >{d}</button>
                      );})}
                    </div>
                  )}
                </div>
              )}
              {setShowNotifFor&&<button onClick={function(){setShowNotifFor(isShowingNotif?null:t.id);}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex",opacity:0.5}}><Icon name="bell" size={13} color={hasNotif?T.sand:T.textSoft}/></button>}
              <button onClick={function(){setEditVal(t.text);setEditing(true);}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="edit" size={13} color={T.textSoft}/></button>
              <button onClick={function(){onDelete(t.id);}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.textFaint}/></button>
            </div>
            {isShowingNotif&&(
              <div style={{background:T.bgAlt,border:"1px solid "+T.sand+"50",borderRadius:"0.7rem",padding:"0.75rem",marginBottom:"0.5rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.6rem"}}>
                  <Icon name="bell" size={13} color={T.sand}/>
                  <span style={{fontSize:"0.72rem",fontWeight:800,color:T.sandDark,textTransform:"uppercase",letterSpacing:"0.06em"}}>Set Reminder</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.45rem",marginBottom:"0.45rem"}}>
                  <input type="date" value={notifDate} onChange={function(e){setNotifDate(e.target.value);}} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
                  <input type="time" value={notifTime} onChange={function(e){setNotifTime(e.target.value);}} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
                </div>
                <input value={notifNote} onChange={function(e){setNotifNote(e.target.value);}} placeholder="Optional note…" style={{...inp({marginBottom:"0.5rem",fontSize:"0.79rem",padding:"0.35rem 0.5rem"})}}/>
                <div style={{display:"flex",gap:"0.4rem"}}>
                  <button onClick={function(){addNotification(t.id,t.text,notifDate,notifTime,notifNote);setShowNotifFor(null);}} style={btnP(T.sand,{fontSize:"0.76rem",padding:"0.35rem 0.75rem"})}>Set Reminder</button>
                  {hasNotif&&<button onClick={function(){setNotifications(function(p){return p.filter(function(n){return n.entityId!==t.id;});});setShowNotifFor(null);}} style={btnS({fontSize:"0.76rem",padding:"0.35rem 0.65rem",color:T.rose})}>Clear</button>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  _hfRenders.DraggableTaskList = function DraggableTaskList({tasks:localTasks, setTasks:setAllTasks, accent}) {
    const [showNotifFor, setShowNotifFor] = useState(null);
    const groupIds = localTasks.map(t=>t.id);
    const {draggingId, dragOverId, pointerDown} = usePointerDrag(localTasks, updated => {
      setAllTasks(prev => { const others = prev.filter(t => !groupIds.includes(t.id)); return [...others, ...updated]; });
    }, {dataAttr:"data-taskid"});
    return (
      <>
        {localTasks.map((t) => {
          const isBeingDragged = draggingId === t.id;
          const isDropTarget   = dragOverId  === t.id;
          return (
          <div key={t.id} data-taskid={t.id} onPointerDown={e=>pointerDown(e,t.id)}
            style={{cursor:"grab",opacity:isBeingDragged?0.35:1,borderRadius:"0.6rem",
              outline:isDropTarget?"2px dashed "+accent:"none",outlineOffset:"2px",transition:"opacity 0.15s"}}>
            <TaskRow t={t} accent={accent} showNotifFor={showNotifFor} setShowNotifFor={setShowNotifFor}
              onToggle={id=>setAllTasks(p=>p.map(x=>x.id===id?{...x,done:!x.done}:x))}
              onDelete={id=>setAllTasks(p=>p.filter(x=>x.id!==id))}
              onSave={(id,val)=>setAllTasks(p=>p.map(x=>x.id===id?{...x,text:val}:x))}
            />
          </div>
        );})}
      </>
    );
  }

  // ── Shop Item Row with Photo ────────────────────────────────────────────────
  _hfRenders.ShopItemRow = function ShopItemRow({item, onToggle, onDelete, onSave, onDragStart}) {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(item.text);
    const [showPhoto, setShowPhoto] = useState(false);
    return (
      <div data-shopid={item.id} style={{borderBottom:`1px solid ${T.borderSoft}`}}>
        {editing ? (
          <div style={{display:"flex",gap:"0.5rem",padding:"0.4rem 0",alignItems:"center"}}>
            <input value={editVal} onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){onSave(item.id,editVal);setEditing(false);}if(e.key==="Escape")setEditing(false);}}
              style={{...inp({flex:1,padding:"0.38rem 0.6rem",fontSize:"0.84rem"})}} autoFocus/>
            <button onClick={()=>{onSave(item.id,editVal);setEditing(false);}} style={btnP(T.sage,{padding:"0.38rem 0.65rem",fontSize:"0.76rem"})}>Save</button>
            <button onClick={()=>setEditing(false)} style={btnS({padding:"0.38rem 0.65rem",fontSize:"0.76rem"})}>✕</button>
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.44rem 0"}}>
              {onDragStart&&<span onPointerDown={function(e){onDragStart(e,item.id);}} style={{cursor:"grab",color:T.textFaint,fontSize:"0.9rem",userSelect:"none",touchAction:"none",padding:"0 2px",flexShrink:0,lineHeight:1}}>⠿</span>}
              <button onClick={()=>onToggle(item.id,item.done)} style={{width:18,height:18,borderRadius:"0.3rem",border:`2px solid ${item.done?T.sage:T.border}`,background:item.done?T.sage:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                {item.done&&<Icon name="check" size={10} color="#fff"/>}
              </button>
              {item.photo&&(
                <button onClick={()=>setShowPhoto(v=>!v)} style={{width:28,height:28,borderRadius:"0.35rem",overflow:"hidden",border:`2px solid ${T.sage}50`,flexShrink:0,padding:0,cursor:"pointer",background:"none"}}>
                  <img src={item.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                </button>
              )}
              <span style={{flex:1,fontSize:"0.85rem",color:item.done?T.textFaint:T.textDark,textDecoration:item.done?"line-through":"none",fontWeight:item.done?400:600}}>
                {item.text}
                {item.photo&&<span style={{fontSize:"0.62rem",color:T.sage,fontWeight:700,marginLeft:"0.4rem"}}>📷</span>}
              </span>
              <button onClick={()=>{setEditVal(item.text);setEditing(true);}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="edit" size={12} color={T.textSoft}/></button>
              <button onClick={()=>onDelete(item.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={12} color={T.textFaint}/></button>
            </div>
            {showPhoto&&item.photo&&(
              <div style={{paddingBottom:"0.6rem"}}>
                <img src={item.photo} alt={item.text} style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:"0.65rem",border:`2px solid ${T.sage}40`}}/>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Brain Item Row ──────────────────────────────────────────────────────────
  _hfRenders.BrainItemRow = function BrainItemRow({item, color, onToggle, onDelete, onSave, onMove, bDragStart, bDragEnter, bDragEnd}) {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(item.text);
    const [moveTo, setMoveTo] = useState(false);
    return (
      <div draggable onDragStart={e=>{bDragStart(e,item.id,item.bucket); var g=document.createElement("div"); g.style.cssText="position:fixed;top:-9999px;left:-9999px;"; document.body.appendChild(g); e.dataTransfer.setDragImage(g,0,0); setTimeout(function(){try{g.remove();}catch{}},0);}} onDragEnter={()=>bDragEnter(item.id)} onDragEnd={bDragEnd} onDragOver={e=>e.preventDefault()}
        style={{...card({borderLeft:`4px solid ${color}`,marginBottom:"0.5rem",padding:"0.88rem 1rem",cursor:"grab"})}}>
        {editing ? (
          <div style={{display:"flex",gap:"0.5rem",alignItems:"center"}}>
            <input value={editVal} onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){onSave(item.id,editVal);setEditing(false);}if(e.key==="Escape")setEditing(false);}}
              style={{...inp({flex:1,padding:"0.4rem 0.65rem",fontSize:"0.85rem"})}} autoFocus/>
            <button onClick={()=>{onSave(item.id,editVal);setEditing(false);}} style={btnP(T.sage,{padding:"0.4rem 0.7rem",fontSize:"0.78rem"})}>Save</button>
            <button onClick={()=>setEditing(false)} style={btnS({padding:"0.4rem 0.7rem",fontSize:"0.78rem"})}>✕</button>
          </div>
        ) : (
          <div style={{display:"flex",alignItems:"flex-start",gap:"0.6rem"}}>
            <div style={{opacity:0.35,flexShrink:0,marginTop:2}}><Icon name="drag" size={13} color={T.textSoft}/></div>
            <button onClick={()=>onToggle(item.id)} style={{width:21,height:21,borderRadius:"50%",border:`2px solid ${item.done?T.sage:T.border}`,background:item.done?T.sage:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all 0.15s"}}>
              {item.done&&<Icon name="check" size={12} color="#fff"/>}
            </button>
            <div style={{flex:1}}>
              <span style={{fontSize:"0.87rem",color:item.done?T.textFaint:T.textDark,textDecoration:item.done?"line-through":"none",fontWeight:item.done?400:600,lineHeight:1.5}}>{item.text}</span>
              <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginTop:"0.35rem",flexWrap:"wrap"}}>
                {item.person&&<Pill label={item.person} color={people.find(p=>p.name===item.person)?.color||T.textSoft} tiny/>}
                {moveTo ? (
                  <div style={{display:"flex",gap:"0.3rem",flexWrap:"wrap"}}>
                    {BRAIN_BUCKETS.filter(b=>b.id!==item.bucket).map(b2=>(
                      <button key={b2.id} onClick={()=>{onMove(item.id,b2.id);setMoveTo(false);}} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"2rem",padding:"1px 7px",fontSize:"0.66rem",cursor:"pointer",fontWeight:700,fontFamily:"inherit",color:T.textMid}}>→ {b2.emoji} {b2.label}</button>
                    ))}
                    <button onClick={()=>setMoveTo(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.66rem",color:T.textFaint,fontFamily:"inherit"}}>cancel</button>
                  </div>
                ) : (
                  <button onClick={()=>setMoveTo(true)} style={{background:"none",border:`1px dashed ${T.border}`,borderRadius:"2rem",padding:"1px 7px",fontSize:"0.66rem",cursor:"pointer",fontWeight:700,fontFamily:"inherit",color:T.textSoft}}>move</button>
                )}
              </div>
            </div>
            <div style={{display:"flex",gap:"0.2rem",flexShrink:0}}>
              <button onClick={()=>{setEditVal(item.text);setEditing(true);}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="edit" size={13} color={T.textSoft}/></button>
              <button onClick={()=>onDelete(item.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.textFaint}/></button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── AI Chat Panel ───────────────────────────────────────────────────────────
  _hfRenders.AIChatPanel = function AIChatPanel({onClose}) {
    const unanswered = GTK_QUESTIONS.filter(q => !aiMemory[q]);
    const todayQuestion = useRef(
      unanswered.length > 0 ? unanswered[Math.floor(Math.random() * unanswered.length)] : null
    ).current;

    const profileCtx = familyProfile
      ? `Family: ${familyProfile.parentNames}, ${familyProfile.numKids} kids (ages ${familyProfile.kidAges}), dietary: ${familyProfile.dietaryNeeds}, challenge: ${familyProfile.biggestChallenge}, fav dinner: ${familyProfile.favoriteDinner}, work: ${familyProfile.workSituation||"not set"}.`
      : "";
    const memoryCtx = Object.entries(aiMemory).slice(-8).map(([q,a])=>`Q: ${q} A: ${a}`).join(" | ");
    const appCtx = `Today: ${TODAY_NAME}, flow mode: ${flowMode}, dietary filters: ${dietaryFilters.join(", ")||"none"}.`;

    const openingMsg = todayQuestion
      ? `Hi! ⚓️ Quick question to help me know your family better:\n\n"${todayQuestion}"\n\nNo pressure — answer whenever, or just ask me anything!`
      : `Hi! ⚓️ ${familyProfile?`Good to see you, ${familyProfile.parentNames?.split(" ")[0]||"friend"}!`:""} What can I help with today?`;

    const [messages, setMessages] = useState([{role:"assistant",text:openingMsg}]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [awaitingGTK, setAwaitingGTK] = useState(!!todayQuestion);
    const bottomRef = useRef(null);
    useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

    const SUGGESTED = familyProfile
      ? ["What should I make tonight?","Help me plan this week","Quick grocery list","Tips for calmer mornings"]
      : ["What should I make for dinner?","Help me plan this week","Tips for a smoother morning","Quick grocery list"];

    async function send(text) {
      const q = text||input.trim(); if(!q||loading) return;
      setInput("");
      const msgs = [...messages,{role:"user",text:q}];
      setMessages(msgs);
      setLoading(true);
      if (awaitingGTK && todayQuestion) {
        setAiMemory(p=>({...p,[todayQuestion]:q}));
        setAwaitingGTK(false);
      }
      try {
        const r = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          model:"claude-sonnet-4-6", max_tokens:1000,
          system:`Today is ${new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}. You are Compass, Anchor & Flow's warm home assistant. Be concise and encouraging. Use what you know about this family to personalise responses.\n${profileCtx}\n${memoryCtx?`What I know from past chats: ${memoryCtx}`:""}\n${appCtx}`,
          messages:msgs.map(m=>({role:m.role,content:m.text}))
        })});
        const d = await r.json();
        setMessages(prev=>[...prev,{role:"assistant",text:d.content?.find(b=>b.type==="text")?.text||"Sorry, try again."}]);
      } catch { setMessages(prev=>[...prev,{role:"assistant",text:"Something went wrong. Please try again."}]); }
      setLoading(false);
    }

    return (
      <div style={{position:"fixed",bottom:"4.8rem",right:"0.75rem",width:"min(390px,calc(100vw - 1.5rem))",height:530,background:T.surface,border:`2px solid ${T.blue}70`,borderRadius:"1.4rem",boxShadow:`0 24px 80px ${T.cardShadow}`,zIndex:500,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${T.blue},${T.blueDark})`,padding:"1rem 1.1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.65rem"}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid rgba(255,255,255,0.35)"}}>
              <AnchorLogo size={24} color="#fff"/>
            </div>
            <div>
              <div style={{color:"#fff",fontWeight:700,fontSize:"0.97rem",fontFamily:"'Cormorant Garamond',serif"}}>Anchor & Flow AI</div>
              <div style={{color:"rgba(255,255,255,0.75)",fontSize:"0.69rem",fontWeight:500}}>
                {Object.keys(aiMemory).length>0?`Remembers ${Object.keys(aiMemory).length} things about you`:"Getting to know your family"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",cursor:"pointer",borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="close" size={14} color="#fff"/></button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"1rem",display:"flex",flexDirection:"column",gap:"0.7rem",background:T.bgAlt}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"86%",padding:"0.68rem 0.95rem",borderRadius:m.role==="user"?"1rem 1rem 0.25rem 1rem":"1rem 1rem 1rem 0.25rem",background:m.role==="user"?T.blue:T.surface,color:m.role==="user"?"#fff":T.textDark,fontSize:"0.84rem",lineHeight:1.58,whiteSpace:"pre-wrap",border:m.role==="assistant"?`1px solid ${T.borderSoft}`:"none",fontWeight:m.role==="user"?600:400}}>{m.text}</div>
            </div>
          ))}
          {loading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{padding:"0.68rem 0.95rem",borderRadius:"1rem 1rem 1rem 0.25rem",background:T.surface,border:`1px solid ${T.borderSoft}`}}><div style={{display:"flex",gap:"5px"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.blueLight,animation:`bounce 1.2s ${i*0.2}s infinite ease-in-out`}}/>)}</div></div></div>}
          <div ref={bottomRef}/>
        </div>
        {messages.length===1&&!awaitingGTK&&(
          <div style={{padding:"0.6rem 0.75rem 0.3rem",background:T.bgAlt,display:"flex",flexWrap:"wrap",gap:"0.4rem"}}>
            {SUGGESTED.map((s,i)=><button key={i} onClick={()=>send(s)} style={{background:T.bluePale,border:`1.5px solid ${T.blueLight}`,color:T.blueDark,borderRadius:"2rem",padding:"0.33rem 0.78rem",fontSize:"0.73rem",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{s}</button>)}
          </div>
        )}
        <div style={{padding:"0.75rem",borderTop:`1.5px solid ${T.borderSoft}`,display:"flex",gap:"0.5rem",alignItems:"flex-end",background:T.surface}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder={awaitingGTK?"Type your answer…":"Ask anything about your home…"} rows={1} style={{...inp({resize:"none",flex:1,lineHeight:1.5,maxHeight:80,overflowY:"auto"})}}/>
          <button onClick={()=>send()} disabled={!input.trim()||loading} style={{...btnP(T.blue,{padding:"0.56rem 0.75rem",borderRadius:"0.7rem",flexShrink:0,opacity:!input.trim()||loading?0.4:1,display:"flex",alignItems:"center",justifyContent:"center"})}}>
            <Icon name="send" size={16} color="#fff"/>
          </button>
        </div>
      </div>
    );
  }

  // ── Today Snapshot ──────────────────────────────────────────────────────────
  _hfRenders.TodaySnapshot = function TodaySnapshot() {
    const todayEvents = calEvents.filter(e=>{
      if(!e.date)return false;
      const [y,m,d]=e.date.split("-").map(Number);
      return d===TODAY.getDate()&&(m-1)===TODAY.getMonth()&&y===TODAY.getFullYear();
    }).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
    const nowStr = new Date().getHours().toString().padStart(2,"0")+":"+new Date().getMinutes().toString().padStart(2,"0");
    const upcoming = todayEvents.filter(e=>!e.time||e.time>=nowStr);
    const past = todayEvents.filter(e=>e.time&&e.time<nowStr);
    return (
      <div style={{...card({background:`linear-gradient(135deg,${T.bluePale},${T.surface})`,border:`2px solid ${T.blue}50`,padding:"1rem 1.15rem"})}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:todayEvents.length?"0.85rem":"0"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
            <Icon name="cal" size={16} color={T.blueDark}/>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Today</span>
            <span style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500}}>{TODAY.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</span>
          </div>
          <button onClick={()=>goTab("calendar")} style={{...btnP(T.blue,{fontSize:"0.72rem",padding:"0.26rem 0.65rem"})}}>Calendar</button>
        </div>
        {!todayEvents.length&&<p style={{color:T.textFaint,fontSize:"0.82rem",fontWeight:600,textAlign:"center",padding:"0.4rem 0"}}>No events today — open space 🌿</p>}
        {upcoming.map(e=>(
          <div key={e.id} style={{display:"flex",alignItems:"center",gap:"0.7rem",padding:"0.5rem 0.65rem",background:T.white,borderRadius:"0.7rem",border:`1.5px solid ${e.color}40`,borderLeft:`4px solid ${e.color}`,marginBottom:"0.35rem"}}>
            <span style={{fontSize:"0.74rem",fontWeight:800,color:e.color,minWidth:36}}>{e.time||"all day"}</span>
            <span style={{flex:1,fontSize:"0.85rem",color:T.textDark,fontWeight:700}}>{e.title}</span>
            {notifications.some(n=>n.entityId===e.id)&&<span style={{fontSize:"0.75rem"}}>🔔</span>}
          </div>
        ))}
        {past.length>0&&<div style={{marginTop:"0.5rem",paddingTop:"0.5rem",borderTop:`1px dashed ${T.borderSoft}`}}>{past.map(e=>(
          <div key={e.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.22rem 0",opacity:0.5}}>
            <span style={{fontSize:"0.72rem",fontWeight:700,color:T.textSoft,minWidth:36}}>{e.time}</span>
            <div style={{width:6,height:6,borderRadius:"50%",background:e.color}}/>
            <span style={{fontSize:"0.8rem",color:T.textMid,fontWeight:500,textDecoration:"line-through"}}>{e.title}</span>
          </div>
        ))}</div>}
      </div>
    );
  }

  // ── Onboarding Wizard ───────────────────────────────────────────────────────
  _hfRenders.OnboardingWizard = function OnboardingWizard({onComplete}) {
    const [step,setStep] = useState(0);
    const [d,setD] = useState({name:"",partner:"",numKids:"",kidAges:"",kidNames:"",dietary:"",challenge:"",cal:false,m1name:"",m1time:"20",m1tags:"",m2name:"",m2time:"20",g1:"",g2:"",brain:""});
    const set = (k,v) => setD(p=>({...p,[k]:v}));
    const steps = ["welcome","family","kids","dietary","calendar","meal1","meal2","grocery","brain","done"];
    const prog  = step/(steps.length-1);
    function finish() {
      if(d.name) {
        setFamilyProfile({parentNames:d.name+(d.partner?" & "+d.partner:""),numKids:d.numKids,kidAges:d.kidAges,kidNames:d.kidNames,dietaryNeeds:d.dietary,biggestChallenge:d.challenge,favoriteDinner:d.m1name,cookingStyle:""});
        setPeople(prev => {
          const updated = [...prev];
          if(updated[0]) updated[0] = {...updated[0], name: d.name.split(" ")[0]};
          if(d.partner && updated[1]) updated[1] = {...updated[1], name: d.partner.split(" ")[0]};
          return updated;
        });
      }
      if(d.m1name) setFavMeals(p=>[...p,{id:uid(),name:d.m1name,time:d.m1time,tags:d.m1tags}]);
      if(d.m2name) setFavMeals(p=>[...p,{id:uid(),name:d.m2name,time:d.m2time,tags:""}]);
      if(d.g1.trim()) setShoppingItems(p=>[...p,{id:uid(),text:d.g1.trim(),done:false,store:"Grocery Store"}]);
      if(d.g2.trim()) setShoppingItems(p=>[...p,{id:uid(),text:d.g2.trim(),done:false,store:"Grocery Store"}]);
      if(d.brain.trim()) { const lines=d.brain.split("\n").filter(Boolean); setBrainItems(p=>[...p,...lines.map(text=>({id:uid(),text:text.trim(),bucket:"later",done:false,person:""}))]); }
      if(d.dietary) setDietaryFilters([d.dietary.split(",")[0].trim()]);
      setOnboardingComplete(true);
      onComplete();
    }
    const s = steps[step];
    const ProgBar = () => <div style={{height:3,background:T.border,borderRadius:2,marginBottom:"1.4rem",overflow:"hidden"}}><div style={{height:"100%",width:(prog*100)+"%",background:"linear-gradient(90deg,"+T.sage+","+T.blue+")",transition:"width 0.4s"}}/></div>;
    const Btns = ({canNext=true,nextLabel="Next →",onNext,skipLabel}) => (
      <div style={{display:"flex",gap:"0.5rem",marginTop:"1.4rem",paddingTop:"0.9rem",borderTop:"1px solid "+T.borderSoft}}>
        {step>0&&<button onClick={()=>setStep(s=>s-1)} style={btnS({padding:"0.6rem 1rem",fontSize:"0.82rem"})}>← Back</button>}
        <div style={{flex:1}}/>
        {skipLabel&&<button onClick={()=>setStep(s=>s+1)} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:"0.8rem",padding:"0.6rem 0.9rem",fontFamily:"inherit"}}>{skipLabel}</button>}
        <button onClick={onNext||(()=>setStep(s=>s+1))} disabled={!canNext} style={{...btnP(T.sage,{padding:"0.65rem 1.3rem",fontSize:"0.88rem",borderRadius:"0.8rem",opacity:canNext?1:0.4,cursor:canNext?"pointer":"not-allowed"})}}>
          {nextLabel}
        </button>
      </div>
    );
    return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(16px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"env(safe-area-inset-top,1rem) 1rem env(safe-area-inset-bottom,1rem)",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1.6rem",padding:"2rem 1.8rem",width:"100%",maxWidth:460,maxHeight:"calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 2rem)",overflowY:"auto",WebkitOverflowScrolling:"touch",boxShadow:"0 40px 120px "+T.cardShadow}}>
          <ProgBar/>
          {s==="welcome"&&(<div>
            <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>⚓️</div>
            {familyProfile ? (
              <div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.5rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>Welcome back!</div>
                <div style={{color:T.textSoft,fontSize:"0.85rem",lineHeight:1.7,marginBottom:"1rem"}}>Looks like your home is already set up. You don't need to go through this again.</div>
                <div style={{background:T.sagePale,border:"1.5px solid "+T.sage+"40",borderRadius:"0.9rem",padding:"0.9rem 1rem",fontSize:"0.83rem",color:T.textMid,lineHeight:1.65,marginBottom:"0.5rem"}}>
                  ✓ Your family profile, tasks, meals, and settings are all here.<br/>To make changes, head to <strong>Settings</strong>.
                </div>
                <div style={{display:"flex",gap:"0.5rem",marginTop:"1.4rem",paddingTop:"0.9rem",borderTop:"1px solid "+T.borderSoft}}>
                  <button onClick={()=>{onComplete();goTab&&goTab("settings");}} style={{...btnP(T.sage,{padding:"0.65rem 1.3rem",fontSize:"0.88rem",borderRadius:"0.8rem"})}}>Go to Settings →</button>
                  <button onClick={onComplete} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:"0.8rem",padding:"0.6rem 0.9rem",fontFamily:"inherit"}}>Continue anyway</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.5rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>Welcome to Anchor & Flow</div>
                <div style={{color:T.textSoft,fontSize:"0.85rem",lineHeight:1.7,marginBottom:"1rem"}}>Let's set up your home in about 2 minutes.<br/>You can always update this later.</div>
                <div style={{background:"linear-gradient(135deg,"+T.sagePale+","+T.bluePale+")",borderRadius:"0.9rem",padding:"0.9rem 1rem",fontSize:"0.82rem",color:T.textMid,lineHeight:1.8}}>
                  👨‍👩‍👧 Your family &nbsp;·&nbsp; 📆 Calendar &nbsp;·&nbsp; 🍽️ Favorite meals &nbsp;·&nbsp; 🛒 Grocery &nbsp;·&nbsp; 🧠 Brain dump
                </div>
                <Btns nextLabel="Let's go →"/>
              </div>
            )}
          </div>)}
          {s==="family"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>👨‍👩‍👧 Your family</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>This helps personalise everything — from meal suggestions to daily rhythms.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div><label style={lbl}>Your name</label><input defaultValue={d.name} onBlur={function(e){set("name",e.target.value);}} placeholder="e.g. Lindsey" style={inp()} autoFocus/></div>
              <div><label style={lbl}>Partner's name (optional)</label><input defaultValue={d.partner} onBlur={function(e){set("partner",e.target.value);}} placeholder="e.g. Jake" style={inp()}/></div>
              <div><label style={lbl}>Biggest home management challenge</label>
                <select value={d.challenge} onChange={e=>set("challenge",e.target.value)} style={inp()}>
                  <option value="">Choose one…</option>
                  {["Keeping up with meals","Feeling behind on tasks","Managing everyone's schedules","Staying consistent","All of the above"].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <Btns canNext={!!d.name} skipLabel="Skip"/>
          </div>)}
          {s==="kids"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🧒 The little ones</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>Ages help me suggest age-appropriate rhythms and meal ideas.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div><label style={lbl}>How many kids?</label>
                <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                  {["1","2","3","4","5+"].map(n=><button key={n} onClick={()=>set("numKids",n)} style={{background:d.numKids===n?T.blue:T.white,color:d.numKids===n?"#fff":T.textMid,border:"1.5px solid "+(d.numKids===n?T.blue:T.border),borderRadius:"0.6rem",padding:"0.5rem 1rem",cursor:"pointer",fontSize:"0.9rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{n}</button>)}
                </div>
              </div>
              <div><label style={lbl}>Their ages</label><input defaultValue={d.kidAges} onBlur={function(e){set("kidAges",e.target.value);}} placeholder="e.g. 7, 4, infant" style={inp()}/></div>
              <div><label style={lbl}>Names (optional)</label><input defaultValue={d.kidNames} onBlur={function(e){set("kidNames",e.target.value);}} placeholder="e.g. Emma, Liam, baby Mia" style={inp()}/></div>
            </div>
            <Btns skipLabel="Skip"/>
          </div>)}
          {s==="dietary"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🥗 Dietary needs</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>I'll filter meal suggestions and flag ingredients automatically.</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",marginBottom:"0.75rem"}}>
              {["Dairy-free","Gluten-free","Nut-free","Vegetarian","Vegan","No restrictions"].map(x=><button key={x} onClick={()=>set("dietary",d.dietary===x?"":x)} style={{background:d.dietary===x?T.sage:T.white,color:d.dietary===x?"#fff":T.textMid,border:"1.5px solid "+(d.dietary===x?T.sage:T.border),borderRadius:"2rem",padding:"0.38rem 0.85rem",cursor:"pointer",fontSize:"0.82rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{x}</button>)}
            </div>
            <div><label style={lbl}>Other (type it in)</label><input value={d.dietary.includes("-")||["Dairy-free","Gluten-free","Nut-free","Vegetarian","Vegan","No restrictions"].includes(d.dietary)?"":d.dietary} onChange={e=>set("dietary",e.target.value)} placeholder="e.g. Egg-free" style={inp()}/></div>
            <Btns skipLabel="Skip"/>
          </div>)}
          {s==="calendar"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>📆 Connect your calendar</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>I'll pull in your events every morning so nothing sneaks up on you.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
              {CAL_SOURCES.map(cs=>{
                const conn=connectedCals.includes(cs.id);
                return <div key={cs.id} onClick={()=>setConnectedCals(p=>p.includes(cs.id)?p.filter(x=>x!==cs.id):[...p,cs.id])} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem 0.9rem",background:conn?cs.color+"12":T.bgAlt,border:"1.5px solid "+(conn?cs.color:T.border),borderRadius:"0.85rem",cursor:"pointer",transition:"all 0.15s"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:cs.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.9rem",flexShrink:0}}>{cs.id==="google"?<Icon name="google" size={16}/>:cs.icon}</div>
                  <div style={{flex:1,fontWeight:700,color:T.textDark,fontSize:"0.86rem"}}>{cs.label}</div>
                  <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+(conn?cs.color:T.border),background:conn?cs.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>{conn&&<Icon name="check" size={9} color="#fff"/>}</div>
                </div>;
              })}
            </div>
            <Btns skipLabel="Skip for now"/>
          </div>)}
          {s==="meal1"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🍽️ A meal your family loves</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>I'll suggest it when planning your week.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div><label style={lbl}>Meal name</label><input defaultValue={d.m1name} onBlur={function(e){set("m1name",e.target.value);}} placeholder="e.g. Sheet Pan Chicken Fajitas" style={inp()} autoFocus/></div>
              <div><label style={lbl}>Cook time</label>
                <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                  {["10","15","20","30","45","60+"].map(t=><button key={t} onClick={()=>set("m1time",t)} style={{background:d.m1time===t?T.blue:T.white,color:d.m1time===t?"#fff":T.textMid,border:"1.5px solid "+(d.m1time===t?T.blue:T.border),borderRadius:"0.6rem",padding:"0.38rem 0.8rem",cursor:"pointer",fontSize:"0.82rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{t} min</button>)}
                </div>
              </div>
              <div><label style={lbl}>Tags (optional)</label><input defaultValue={d.m1tags} onBlur={function(e){set("m1tags",e.target.value);}} placeholder="e.g. kid-friendly, dairy-free" style={inp()}/></div>
            </div>
            <Btns canNext={!!d.m1name} skipLabel="Skip meals"/>
          </div>)}
          {s==="meal2"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🍳 One more favourite?</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>Optional — the more I know the better I can plan.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div><label style={lbl}>Meal name</label><input defaultValue={d.m2name} onBlur={function(e){set("m2name",e.target.value);}} placeholder="e.g. One-Pot Spaghetti" style={inp()} autoFocus/></div>
              <div><label style={lbl}>Cook time</label>
                <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                  {["10","15","20","30","45","60+"].map(t=><button key={t} onClick={()=>set("m2time",t)} style={{background:d.m2time===t?T.blue:T.white,color:d.m2time===t?"#fff":T.textMid,border:"1.5px solid "+(d.m2time===t?T.blue:T.border),borderRadius:"0.6rem",padding:"0.38rem 0.8rem",cursor:"pointer",fontSize:"0.82rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{t} min</button>)}
                </div>
              </div>
            </div>
            <Btns skipLabel="Skip"/>
          </div>)}
          {s==="grocery"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🛒 Anything you need?</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>I'll add it to your shopping list right now.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div><label style={lbl}>Item 1</label><input defaultValue={d.g1} onBlur={function(e){set("g1",e.target.value);}} placeholder="e.g. Milk" style={inp()} autoFocus/></div>
              <div><label style={lbl}>Item 2</label><input defaultValue={d.g2} onBlur={function(e){set("g2",e.target.value);}} placeholder="e.g. Chicken thighs" style={inp()}/></div>
            </div>
            <Btns skipLabel="Skip"/>
          </div>)}
          {s==="brain"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🧠 What's on your mind?</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>Dump it all here. Tasks, worries, ideas — we'll sort it later.</div>
            <textarea defaultValue={d.brain} onBlur={function(e){set("brain",e.target.value);}} placeholder={"Call doctor\nPick up dry cleaning\nEmail teacher…"} rows={5} style={{...inp({resize:"none",fontSize:"0.88rem",lineHeight:1.65})}}/>
            <Btns skipLabel="Skip"/>
          </div>)}
          {s==="done"&&(<div>
            <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>🌿</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.5rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>You're all set{d.name?", "+d.name.split(" ")[0]:""}!</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>Your home base is ready. Let's build your first daily anchor.</div>
            <div style={{background:"linear-gradient(135deg,"+T.sagePale+","+T.bluePale+")",borderRadius:"0.9rem",padding:"0.9rem 1rem",fontSize:"0.82rem",color:T.textMid,lineHeight:1.9}}>
              {d.name&&<div>👤 <strong>{d.name}{d.partner?" & "+d.partner:""}</strong></div>}
              {d.numKids&&<div>🧒 {d.numKids} kid{d.numKids!=="1"?"s":""}{d.kidAges?" · "+d.kidAges:""}</div>}
              {d.dietary&&<div>🥗 {d.dietary}</div>}
              {d.m1name&&<div>🍽️ {d.m1name}{d.m2name?" · "+d.m2name:""}</div>}
              {(d.g1||d.g2)&&<div>🛒 {[d.g1,d.g2].filter(Boolean).join(" · ")} added</div>}
              {d.brain&&<div>🧠 Brain dump saved</div>}
            </div>
            <Btns nextLabel="Plan my first day →" onNext={finish}/>
          </div>)}
        </div>
      </div>
    );
  }

  // ── Daily Briefing Modal ─────────────────────────────────────────────────────
  _hfRenders.DailyBriefingModal = function DailyBriefingModal({onClose}) {
    const b = dayBriefing;
    const allT = tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.archived);
    const top3T = allT.filter(t=>t.tier==="top3");
    const next3T= allT.filter(t=>t.tier==="next3");
    const moreT = allT.filter(t=>t.tier==="more");
    function TRow({t,color}) {
      return <div style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.55rem 0.7rem",background:T.white,borderRadius:"0.7rem",marginBottom:"0.28rem",border:"1.5px solid "+color+"28"}}>
        <div onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,done:!x.done}:x))} style={{width:22,height:22,borderRadius:"50%",background:t.done?color:"transparent",border:"2px solid "+color,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.18s"}}>{t.done&&<Icon name="check" size={11} color="#fff"/>}</div>
        <span style={{flex:1,fontSize:"0.86rem",fontWeight:t.done?400:600,color:t.done?T.textFaint:T.textDark,textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
      </div>;
    }
    return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(14px)",zIndex:1500,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.surface,borderRadius:"1.6rem 1.6rem 0 0",border:"1.5px solid "+T.border,padding:"1.5rem 1.4rem calc(2rem + env(safe-area-inset-bottom,0px))",maxWidth:520,width:"100%",maxHeight:"calc(92dvh - env(safe-area-inset-top,0px))",overflowY:"auto",WebkitOverflowScrolling:"touch",boxShadow:"0 -12px 80px "+T.cardShadow}}>
          <div style={{width:40,height:4,borderRadius:2,background:T.border,margin:"0 auto 1.1rem"}}/>
          {briefingLoading ? (
            <div style={{textAlign:"center",padding:"2.5rem 1rem"}}>
              <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:"0.9rem"}}>{[0,1,2].map(i=><div key={i} style={{width:10,height:10,borderRadius:"50%",background:T.blue,animation:"bounce 1.2s "+(i*0.2)+"s infinite ease-in-out"}}/>)}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.2rem",color:T.textDark,fontWeight:600}}>Building your day…</div>
              <div style={{color:T.textSoft,fontSize:"0.81rem",marginTop:"0.35rem"}}>Looking at your calendar, meals, and rhythm</div>
            </div>
          ) : b ? (<>
            <div style={{fontSize:"0.6rem",color:T.blueDark,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:800,marginBottom:"0.25rem"}}>{FORMAT_DATE(TODAY)}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.5rem",fontWeight:700,color:T.textDark,marginBottom:"0.28rem"}}>Your Daily Anchor ⚓️</div>
            <div style={{color:T.textMid,fontSize:"0.84rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",marginBottom:"1rem",lineHeight:1.6}}>{b.greeting}</div>
            {b.todayEvts?.length>0&&<div style={{background:T.bluePale,border:"1px solid "+T.blue+"30",borderRadius:"0.85rem",padding:"0.7rem 0.85rem",marginBottom:"0.75rem"}}>
              <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.blueDark,marginBottom:"0.4rem"}}>📆 Today's schedule</div>
              {b.todayEvts.map(e=><div key={e.id} style={{display:"flex",gap:"0.5rem",alignItems:"center",marginBottom:"0.18rem"}}><span style={{fontSize:"0.71rem",fontWeight:800,color:e.color,minWidth:44}}>{e.time||"all day"}</span><span style={{fontSize:"0.83rem",color:T.textDark,fontWeight:600}}>{e.title}</span></div>)}
            </div>}
            {b.prepItems?.length>0&&<div style={{background:T.sandPale,border:"1.5px solid "+T.sand+"45",borderRadius:"0.85rem",padding:"0.7rem 0.85rem",marginBottom:"0.75rem"}}>
              <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.sandDark,marginBottom:"0.35rem"}}>⭐ Meal prep — do today</div>
              {b.prepItems.map((p,i)=><div key={i} style={{fontSize:"0.84rem",color:T.textDark,fontWeight:600,marginBottom:"0.18rem"}}>• {p}</div>)}
            </div>}
            {top3T.length>0&&<div style={{marginBottom:"0.75rem"}}><div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.blue,marginBottom:"0.35rem"}}>⚓️ Anchor — Top 3</div>{top3T.map(t=><TRow key={t.id} t={t} color={T.blue}/>)}</div>}
            {next3T.length>0&&<div style={{marginBottom:"0.75rem"}}><div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.sage,marginBottom:"0.35rem"}}>🌊 Flow — Next 3</div>{next3T.map(t=><TRow key={t.id} t={t} color={T.sage}/>)}</div>}
            {moreT.length>0&&<div style={{marginBottom:"0.75rem"}}><div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.sand,marginBottom:"0.35rem"}}>✨ More — if you can</div>{moreT.map(t=><TRow key={t.id} t={t} color={T.sand}/>)}</div>}
            {(b.todayMealObj?.dinner||b.todayMealObj?.lunch)&&<div style={{background:T.sagePale,border:"1px solid "+T.sage+"30",borderRadius:"0.85rem",padding:"0.7rem 0.85rem",marginBottom:"0.75rem"}}>
              <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.sageDark,marginBottom:"0.35rem"}}>🍽️ Meals today</div>
              {MEALS_TO_SHOW.map(m=>b.todayMealObj[m]&&<div key={m} style={{display:"flex",gap:"0.4rem",marginBottom:"0.18rem"}}><span style={{fontSize:"0.66rem",fontWeight:800,color:T.sageDark,textTransform:"uppercase",minWidth:58,opacity:0.7}}>{m}</span><span style={{fontSize:"0.83rem",color:T.textDark,fontWeight:600}}>{b.todayMealObj[m]}</span></div>)}
            </div>}
            {b.tomorrowNote&&<div style={{background:"linear-gradient(135deg,"+T.lavPale+","+T.bluePale+")",border:"1px solid "+T.lavender+"28",borderRadius:"0.85rem",padding:"0.7rem 0.85rem",marginBottom:"0.75rem"}}>
              <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.lavender,marginBottom:"0.22rem"}}>👁 Tomorrow — {b.tmrName}</div>
              <div style={{fontSize:"0.83rem",color:T.textDark,fontWeight:500,lineHeight:1.55}}>{b.tomorrowNote}</div>
              {b.tmrEvts?.map(e=><div key={e.id} style={{fontSize:"0.77rem",color:T.textMid,marginTop:"0.18rem"}}>· {e.time||"all day"} {e.title}</div>)}
            </div>}
            <div style={{textAlign:"center",padding:"0.2rem 0 0.6rem"}}><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"0.93rem",fontStyle:"italic",color:T.textSoft}}>{b.message}</span></div>
            <button onClick={onClose} style={{...btnP("linear-gradient(135deg,"+T.sage+","+T.blue+")",{width:"100%",padding:"0.9rem",fontSize:"0.95rem",borderRadius:"1rem"})}}>Let's do this ⚓️</button>
          </>) : null}
        </div>
      </div>
    );
  }

  // ── End of Day + Tomorrow Prep ───────────────────────────────────────────────
  _hfRenders.EndOfDayReset = function EndOfDayReset() {
    const [carry, setCarry] = useState([]);
    const [letGo, setLetGo] = useState([]);
    const [checkedRhythm, setCheckedRhythm] = useState([]);
    const [checkedPrep, setCheckedPrep] = useState([]);
    const [prepItems, setPrepItems] = useState([]);
    const [prepLoading, setPrepLoading] = useState(true);
    const [closing, setClosing] = useState(false);
    const [refl, setRefl] = useState("");
    const [reflLoad, setReflLoad] = useState(false);
    const [tomorrowNote, setTomorrowNote] = useState("");
    const [closed, setClosed] = useState(false);

    const tmrName = (()=>{ const d=new Date(TODAY); d.setDate(d.getDate()+1); return DAY_NAMES[d.getDay()]; })();
    const tmrEvts = calEvents.filter(e=>{ if(!e.date)return false; const ed=new Date(e.date+"T00:00:00"); const d=new Date(TODAY); d.setDate(d.getDate()+1); return ed.getDate()===d.getDate()&&ed.getMonth()===d.getMonth()&&ed.getFullYear()===d.getFullYear(); });
    const tmrRhythm = rhythm[tmrName]||{};
    const tmrMeal = meals[tmrName]||{};
    const allT = tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.archived);
    const done = allT.filter(t=>t.done);
    const undone = allT.filter(t=>!t.done);
    const rhythmTasks = (tmrRhythm.tasks||[]).length>0 ? tmrRhythm.tasks : ["Tidy kitchen","Set out tomorrow's things","Quick 10-min reset"];

    React.useEffect(()=>{
      const ctx = [
        tmrEvts.length ? "Tomorrow events: "+tmrEvts.map(e=>e.title).join(", ") : "",
        tmrMeal.dinner ? "Dinner: "+tmrMeal.dinner : "",
        tmrRhythm.theme ? "Theme: "+tmrRhythm.theme : "",
      ].filter(Boolean).join(". ");
      // DEAD CODE (replaced by SunsetClose). API call disabled to prevent 429s
      // if this component is ever accidentally rendered. Remove in refactor.
      void ctx;
      setPrepItems(["Pack bags for tomorrow","Check tomorrow's meals","Set out clothes","Quick house reset"]);
      setPrepLoading(false);
    },[]);

    async function closeDay() {
      if(letGo.length) setTasks(p=>p.map(t=>letGo.includes(t.id)?{...t,archived:true}:t));
      if(carry.length) setTasks(p=>p.map(t=>carry.includes(t.id)?{...t,carried:true,carriedTo:tmrName}:t));
      setClosing(true); setReflLoad(true);
      try {
        const res = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          model:"claude-sonnet-4-6",max_tokens:120,
          system:"You are Compass. Write ONE warm closing sentence under 20 words. Be specific. Make them feel seen.",
          messages:[{role:"user",content:"Done: "+(done.map(t=>t.text).join(", ")||"nothing")+". Let go: "+letGo.length+". Tomorrow: "+(tmrEvts.map(e=>e.title).join(", ")||"quiet day")+". Mode: "+flowMode}]
        })});
        const dat = await res.json();
        setRefl(dat.content?.find(b=>b.type==="text")?.text||"You showed up. That's everything.");
      } catch { setRefl("You showed up. That's everything."); }
      setReflLoad(false);
      setTomorrowNote([tmrEvts.length?"📅 "+tmrEvts[0].title:"",tmrMeal.dinner?"🍽️ "+tmrMeal.dinner:""].filter(Boolean).join(" · ")||"A fresh start.");
    }

    if(closing) return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(12px)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:"env(safe-area-inset-top,1.5rem) 1.5rem env(safe-area-inset-bottom,1.5rem)",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1.8rem",padding:"2rem",maxWidth:400,width:"100%",textAlign:"center",maxHeight:"calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 3rem)",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
          <div style={{fontSize:"2.5rem",marginBottom:"0.5rem"}}>🌙</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"2rem",fontWeight:700,color:T.textDark,marginBottom:"0.5rem"}}>You made it.</div>
          {done.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:"0.3rem",justifyContent:"center",marginBottom:"0.75rem"}}>{done.map(t=><span key={t.id} style={{background:T.sagePale,color:T.sageDark,borderRadius:"2rem",padding:"0.2rem 0.65rem",fontSize:"0.73rem",fontWeight:600}}>✓ {t.text}</span>)}</div>}
          {reflLoad?<div style={{color:T.textFaint,fontSize:"0.85rem",margin:"1rem 0"}}>✨ Reflecting on your day...</div>:(
            <>
              {refl&&<div style={{fontSize:"0.88rem",fontStyle:"italic",color:T.textSoft,lineHeight:1.6,margin:"0.75rem 0",padding:"0.75rem",background:T.bgAlt,borderRadius:"0.85rem"}}>{refl}</div>}
              {tomorrowNote&&<div style={{fontSize:"0.82rem",color:T.textMid,marginBottom:"1rem",padding:"0.6rem 0.85rem",background:"linear-gradient(135deg,"+T.lavPale+","+T.bluePale+")",borderRadius:"0.85rem"}}><span style={{fontWeight:700,fontSize:"0.68rem",textTransform:"uppercase",color:T.lavender}}>Tomorrow · </span>{tomorrowNote}</div>}
              <button onClick={function(){ setShowEndOfDay(false); var closerName = preferredName || (authUser?.displayName ? authUser.displayName.split(" ")[0] : null); setDayClosed(closerName || true); }} style={{...btnP(T.sage,{width:"100%",padding:"0.85rem",fontSize:"0.92rem",borderRadius:"1rem"})}}>Close my day ✓</button>
            </>
          )}
        </div>
      </div>
    );

    return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(12px)",zIndex:1500,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1.4rem 1.4rem 0 0",padding:"1.25rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom,0px))",maxWidth:520,width:"100%",maxHeight:"calc(90dvh - env(safe-area-inset-top,0px))",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
          <div style={{width:40,height:4,borderRadius:2,background:T.border,margin:"0 auto 1rem"}}/>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.2rem",textAlign:"center"}}>🌙 Wind Down</div>
          <div style={{fontSize:"0.78rem",color:T.textSoft,marginBottom:"1.25rem",textAlign:"center"}}>{TODAY_NAME} · Review and close your day</div>

          {/* Card 1: Tasks */}
          <div style={{background:"rgba(122,158,142,0.08)",border:"1.5px solid "+T.sage,borderRadius:"1rem",padding:"1rem",marginBottom:"0.75rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
              <span style={{fontSize:"1.1rem"}}>📋</span>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.sageDark}}>Tasks</span>
              {done.length>0&&<span style={{marginLeft:"auto",fontSize:"0.7rem",color:T.sage,fontWeight:600}}>✓ {done.length} done</span>}
            </div>
            {done.length===0&&undone.length===0&&<div style={{fontSize:"0.82rem",color:T.sage,fontWeight:600}}>✓ All clear — nothing to review!</div>}
            {done.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:"0.25rem",marginBottom:"0.6rem"}}>{done.map(t=><span key={t.id} style={{background:T.sagePale,color:T.sageDark,borderRadius:"2rem",padding:"0.18rem 0.6rem",fontSize:"0.7rem",fontWeight:600}}>✓ {t.text}</span>)}</div>}
            {undone.length>0&&(
              <div>
                <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.textFaint,marginBottom:"0.5rem"}}>Still open</div>
                {undone.map(t=>(
                  <div key={t.id} style={{padding:"0.5rem 0.65rem",background:T.surface,borderRadius:"0.65rem",marginBottom:"0.3rem",border:"1px solid "+T.borderSoft}}>
                    <div style={{fontSize:"0.83rem",color:T.textDark,fontWeight:600,marginBottom:"0.3rem"}}>{t.text}</div>
                    <div style={{display:"flex",gap:"0.3rem"}}>
                      <button onClick={()=>{setCarry(p=>p.includes(t.id)?p.filter(x=>x!==t.id):[...p,t.id]);setLetGo(p=>p.filter(x=>x!==t.id));}} style={{flex:1,background:carry.includes(t.id)?T.sand:"transparent",color:carry.includes(t.id)?"#fff":T.textMid,border:"1.5px solid "+(carry.includes(t.id)?T.sand:T.border),borderRadius:"0.45rem",padding:"0.25rem",fontSize:"0.7rem",cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>↩ Tomorrow</button>
                      <button onClick={()=>{setLetGo(p=>p.includes(t.id)?p.filter(x=>x!==t.id):[...p,t.id]);setCarry(p=>p.filter(x=>x!==t.id));}} style={{flex:1,background:letGo.includes(t.id)?T.rose:"transparent",color:letGo.includes(t.id)?"#fff":T.textMid,border:"1.5px solid "+(letGo.includes(t.id)?T.rose:T.border),borderRadius:"0.45rem",padding:"0.25rem",fontSize:"0.7rem",cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>✕ Let go</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Rhythm */}
          <div style={{background:"rgba(58,107,138,0.06)",border:"1.5px solid "+T.blue,borderRadius:"1rem",padding:"1rem",marginBottom:"0.75rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
              <span style={{fontSize:"1.1rem"}}>🏠</span>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.blue}}>Tonight's Rhythm</span>
            </div>
            {rhythmTasks.map((task,i)=>(
              <div key={i} onClick={()=>setCheckedRhythm(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i])} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.5rem 0.65rem",background:checkedRhythm.includes(i)?T.bluePale:T.surface,borderRadius:"0.65rem",marginBottom:"0.3rem",cursor:"pointer",border:"1.5px solid "+(checkedRhythm.includes(i)?T.blue:T.borderSoft)}}>
                <div style={{width:18,height:18,borderRadius:4,border:"1.5px solid "+(checkedRhythm.includes(i)?T.blue:"rgba(0,0,0,0.15)"),background:checkedRhythm.includes(i)?T.blue:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {checkedRhythm.includes(i)&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                </div>
                <span style={{fontSize:"0.83rem",color:T.textDark,fontWeight:500}}>{task}</span>
              </div>
            ))}
          </div>

          {/* Card 3: Ripple AI */}
          <div style={{background:"rgba(123,94,167,0.06)",border:"1.5px solid "+T.lavender,borderRadius:"1rem",padding:"1rem",marginBottom:"1.25rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
              <span style={{fontSize:"1.1rem"}}>✦</span>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.lavender}}>Compass Suggestions</span>
            </div>
            {prepLoading?<div style={{fontSize:"0.82rem",color:T.textSoft,padding:"0.25rem 0"}}>✨ Generating prep suggestions...</div>:prepItems.map((item,i)=>(
              <div key={i} onClick={()=>setCheckedPrep(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i])} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.5rem 0.65rem",background:checkedPrep.includes(i)?T.lavPale:T.surface,borderRadius:"0.65rem",marginBottom:"0.3rem",cursor:"pointer",border:"1.5px solid "+(checkedPrep.includes(i)?T.lavender:T.borderSoft)}}>
                <div style={{width:18,height:18,borderRadius:4,border:"1.5px solid "+(checkedPrep.includes(i)?T.lavender:"rgba(0,0,0,0.15)"),background:checkedPrep.includes(i)?T.lavender:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {checkedPrep.includes(i)&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                </div>
                <span style={{fontSize:"0.83rem",color:T.textDark,fontWeight:500}}>{item}</span>
              </div>
            ))}
          </div>

          <button onClick={closeDay} style={{...btnP("linear-gradient(135deg,"+T.blue+","+T.sage+")",{width:"100%",padding:"0.9rem",fontSize:"0.95rem",borderRadius:"1rem"})}}>
            Close My Day 🌙
          </button>
          <button onClick={()=>setShowEndOfDay(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.78rem",color:T.textFaint,fontFamily:"inherit",width:"100%",marginTop:"0.5rem",padding:"0.3rem"}}>Not tonight</button>
        </div>
      </div>
    );
  }




  // ── Anchor Tab ──────────────────────────────────────────────────────────────
  _hfRenders.AnchorTab = function AnchorTab() {
    const [newTask,setNewTask]   = useState("");
    const [newTaskPerson,setNewTaskPerson] = useState("");
    const [showFlowIn,setShowFlowIn] = useState(false);
    const [fullDayDismissed,setFullDayDismissed] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [addingTask, setAddingTask] = useState(null);
    const dayOpen = anchorDayOpen;
    const setDayOpen = setAnchorDayOpen;

    const allToday   = tasks.filter(t=>(t.day===TODAY_NAME||t.day==="Daily"||t.carriedTo===TODAY_NAME)&&!t.archived);
    const todayMeal  = meals[TODAY_NAME]||{};
    const dayRhythm  = rhythm[TODAY_NAME]||{};
    const hour       = new Date().getHours();
    const isEvening  = hour >= 17;
    const noMealPlanned = !todayMeal.dinner;

    const todayEvents = calEvents.filter(e=>{
      if(!e.date) return false;
      const [y,m,d]=e.date.split("-").map(Number);
      return d===TODAY.getDate()&&(m-1)===TODAY.getMonth()&&y===TODAY.getFullYear();
    }).sort((a,b)=>(a.time||"").localeCompare(b.time||""));

    const tmrName2 = (()=>{ const d=new Date(TODAY); d.setDate(d.getDate()+1); return DAY_NAMES[d.getDay()]; })();
    const tmrEvents = calEvents.filter(e=>{
      if(!e.date) return false;
      const ed=new Date(e.date+"T00:00:00"); const d=new Date(TODAY); d.setDate(d.getDate()+1);
      return ed.getDate()===d.getDate()&&ed.getMonth()===d.getMonth()&&ed.getFullYear()===d.getFullYear();
    });
    const tmrMeal2 = meals[tmrName2]||{};

    const top3Raw = allToday.filter(t=>t.tier==="top3"||(t.aiG&&!t.tier));
    const next3Raw= allToday.filter(t=>t.tier==="next3");
    const moreRaw = allToday.filter(t=>t.tier==="more");
    const allTaskTiers = [...top3Raw, ...next3Raw, ...moreRaw];
    const filteredTaskTiers = personFilter==="all" ? allTaskTiers : allTaskTiers.filter(function(t){return !t.person||t.person===personFilter;});

    // Evening wind-down suggestions
    const eveningNudges = [
      "Wipe down the kitchen counters",
      tmrMeal2.dinner ? `Defrost meat for tomorrow's dinner (${tmrMeal2.dinner})` : "Check what's needed for tomorrow's dinner",
      "Pack bags or backpacks for tomorrow",
      tmrEvents.length>0 ? `Prep for ${tmrEvents[0].title} tomorrow` : "Lay out tomorrow's clothes",
      "Run the dishwasher before bed",
      "10-minute tidy — floors and surfaces",
    ];

    // Auto-load Ripple suggestions when tab mounts
    useEffect(() => { loadAiSuggestions(); }, []); // eslint-disable-line

    async function loadAiSuggestions() {
      if (aiSuggestions || aiLoading) return;
      setAiLoading(true);

      // ── Brain dump items not yet done or scheduled ───────────────────────────
      const brainPending = brainItems.filter(b=>!b.done&&!b.scheduledDay);

      // ── Day theme → brain category mapping ──────────────────────────────────
      // e.g. Errands day → pull errands brain items; Clean → household; Admin → admin/calls
      const THEME_TO_CATS = {
        "reset":    ["household","errands"],
        "errands":  ["errands","orders"],
        "admin":    ["admin","calls","orders"],
        "clean":    ["household"],
        "prep":     ["household","errands"],
        "family":   ["errands","household"],
        "rest":     ["someday"],
        "finance":  ["admin"],
        "fitness":  ["errands"],
        "batch cook":["household"],
      };
      const themeKey = (dayRhythm.theme||"").toLowerCase();
      const matchedCatIds = Object.entries(THEME_TO_CATS).find(([k])=>themeKey.includes(k))?.[1] || [];
      const brainForTheme = brainPending.filter(b=>matchedCatIds.includes(b.cat));

      // ── Calendar event → person/context extraction ───────────────────────────
      // Look at today + next 7 days to find events with names or activities
      const next7Days = Array.from({length:7},(_,i)=>{
        const d=new Date(TODAY); d.setDate(d.getDate()+i+1);
        return d.toISOString().split("T")[0];
      });
      const upcomingEvts = calEvents.filter(e=>next7Days.includes(e.date)).slice(0,6);

      // Extract person names from events (first word that's capitalized or matches a person)
      const peopleNames = people.filter(p=>p&&p.name).map(p=>p.name.toLowerCase());
      const eventKeywords = [...todayEvents,...upcomingEvts].map(e=>e.title).join(" ");

      // Find brain items that mention people from events or share keywords
      const brainRelatedToEvents = brainPending.filter(b=>{
        const bText = b.text.toLowerCase();
        // Check if brain item mentions anyone in today's calendar
        return [...todayEvents,...upcomingEvts].some(e=>{
          const eTitle = e.title.toLowerCase();
          const words = eTitle.split(/\s+/);
          return words.some(w=>w.length>3&&bText.includes(w));
        }) || peopleNames.some(name=>name!=="you"&&name!=="partner"&&bText.includes(name));
      });

      // ── All brain items grouped for context ─────────────────────────────────
      const brainByCategory = {};
      BRAIN_CATS.forEach(cat=>{
        const items = brainPending.filter(b=>b.cat===cat.id);
        if(items.length) brainByCategory[cat.label] = items.map(b=>b.text).slice(0,4);
      });

      // ── Priority brain items: theme-matched + event-related ─────────────────
      const priorityBrain = [...new Set([
        ...brainForTheme,
        ...brainRelatedToEvents,
      ])].slice(0,6);

      const ctx = [
        `Today: ${TODAY_NAME}${dayRhythm.theme?" — "+dayRhythm.theme+" day":""}`,
        `Today's calendar events: ${todayEvents.map(e=>(e.time||"all day")+" — "+e.title).join(", ")||"none"}`,
        `Upcoming events next 7 days: ${upcomingEvts.map(function(e){var d=new Date(e.date+"T12:00:00");var dayName=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];return dayName+" "+e.date.slice(5)+" "+(e.time||"")+" "+e.title;}).join(", ")||"none"}`,
        `Dinner tonight: ${todayMeal.dinner||"not planned"}`,
        `Tomorrow (${tmrName2}): ${tmrEvents.map(e=>e.title).join(", ")||"no events"}${tmrMeal2.dinner?", dinner: "+tmrMeal2.dinner:""}`,
        `Tasks already on today's list: ${allTaskTiers.map(t=>t.text).join(", ")||"none"}`,
        `Priority brain items (theme + event-related): ${priorityBrain.map(b=>b.text).join(" | ")||"none"}`,
        `All brain dump items by category: ${Object.entries(brainByCategory).map(([k,v])=>k+": "+v.join(", ")).join(" || ")||"empty"}`,
        `Family: ${familyProfile?`${familyProfile.parentNames||""}, ${familyProfile.numKids||""} kids (ages: ${familyProfile.kidAges||""})`:"not set"}`,
        `Flow mode: ${flowMode}`,
      ].join("\n");

      try {
        const res = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          model:"claude-sonnet-4-6", max_tokens:700,
          system:`Today is ${new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}. You are Compass, the Anchor & Flow AI — a warm family home assistant. Suggest what to do today based on the family's real data.

RULES:
1. "brain_items": Pick 2-4 items from the Clear Your Mind list that make sense TODAY. Prioritize:
   - Items matching today's theme (e.g. Errands day = pick errands items)
   - Items related to calendar events (e.g. soccer game coming up → "Wash soccer jersey")
   - Items mentioning people who appear in today's/upcoming calendar
   Use EXACT text from the list. Include a short "reason" explaining why today.

2. "todos": 2-3 NEW actionable tasks not already in the list. Be SPECIFIC and connected to their calendar:
   - If there's a game/practice → "Wash [name]'s jersey", "Pack snack bag for [event]"
   - If there's an appointment → "Confirm [appointment]", "Fill out paperwork for [appt]"
   - If dinner needs prep → specific prep step
   Do NOT repeat items already in tasks or brain_items.
   IMPORTANT: Do NOT include calendar appointments — those show separately. Only suggest actionable to-dos.

3. "upcoming": 2 "On the horizon" prep nudges for events in the next 7 days. Very specific:
   - "Wash soccer gear before Thursday's practice"
   - "Print directions for Monday's appointment"

Respond ONLY in valid JSON:
{"brain_items":[{"text":"exact text from list","reason":"why today — 1 short phrase"}],"todos":["specific task"],"upcoming":["specific prep for upcoming event"]}`,
          messages:[{role:"user",content:ctx}]
        })});
        const dat = await res.json();
        const txt = dat.content?.find(b=>b.type==="text")?.text||"{}";
        const p = JSON.parse(txt.replace(/```json|```/g,"").trim());
        setAiSuggestions(p);
      } catch {
        setAiSuggestions({
          brain_items: priorityBrain.slice(0,2).map(b=>({text:b.text,reason:"on your radar for today"})),
          todos: ["Check your calendar","Do a 10-minute tidy"],
          upcoming: upcomingEvts.slice(0,2).map(e=>`Prep for ${e.title}`)
        });
      }
      setAiLoading(false);
    }

    function addQuickTask(text, tier="top3", person) {
      setTasks(p=>[...p,{id:uid(),text,day:TODAY_NAME,done:false,person:person||"",order:p.length,tier,aiG:true}]);
    }

    const greeting = hour < 12 ? "Good morning" : isEvening ? "Good evening" : "Good afternoon";
    const greetingEmoji = hour < 12 ? "🌿" : isEvening ? "🌙" : "☀️";

    // Category config for insight cards
    const CAT_CONFIG = {
      calendar: {emoji:"📅", color:T.blue,    bgColor:T.bluePale,   label:"Calendar"},
      meals:    {emoji:"🍽️", color:T.sage,    bgColor:T.sagePale,   label:"Meals"},
      brain:    {emoji:"💭", color:T.lavender,bgColor:T.lavPale,    label:"Clear Your Mind"},
      shopping: {emoji:"🛒", color:T.sand,    bgColor:T.sandPale,   label:"Shopping"},
      pattern:  {emoji:"💡", color:T.rose,    bgColor:T.rosePale||T.surface, label:"Heads Up"},
    };

    const visibleInsights = (insights||[]).filter(ins=>!dismissedInsights.includes(ins.title));

    function handleInsightAction(ins) {
      if(ins.actionType==="addTask"&&ins.actionPayload){
        addQuickTask(ins.actionPayload,"next3");
        setDismissedInsights(p=>[...p,ins.title]);
      } else if(ins.actionType==="addShopping"&&ins.actionPayload){
        setShoppingItems(p=>[...p,{id:uid(),text:ins.actionPayload,done:false,store:"Grocery Store",addedAt:Date.now()}]);
        setDismissedInsights(p=>[...p,ins.title]);
      } else if(ins.actionType==="planMeal"){
        goTab("meals");
      } else if(ins.actionType==="openCalendar"){
        goTab("calendar");
      }
    }

    return (
      <div>
        {/* ── Mode strip (Calm / Busy / Survival) ── */}
        <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.85rem"}}>
          {Object.entries(FM).map(function(entry){
            var mode=entry[0]; var m=entry[1];
            var modeLabel=mode==="Smooth"?"Calm":mode;
            var active=flowMode===mode;
            return(
              <button key={mode} onClick={function(){setFlowMode(mode);}} style={{flex:1,background:active?m.color:T.surface,color:active?"#fff":T.textMid,border:"1.5px solid "+(active?m.color:T.border),borderRadius:"2rem",padding:"0.42rem 0.5rem",cursor:"pointer",fontSize:"0.78rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{m.emoji} {modeLabel}</button>
            );
          })}
        </div>
        {/* ── Hero greeting card ── */}
        <div style={{display:"none",background:"linear-gradient(150deg,#1a2744,#253660 80%)",border:"none",borderRadius:"1.5rem",padding:"1.6rem 1.5rem",marginBottom:"0.85rem",boxShadow:"0 4px 24px rgba(26,39,68,0.35)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1rem"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.4rem"}}>
                <div style={{fontSize:"0.62rem",color:"rgba(200,169,122,0.85)",textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:800}}>{FORMAT_DATE(TODAY)}</div>
                {weatherData&&weatherData.find(function(d){return d.date===TODAY.toISOString().split("T")[0];})?
                  <div style={{display:"flex",alignItems:"center",gap:"0.3rem",background:"rgba(255,255,255,0.1)",borderRadius:"50px",padding:"2px 8px"}}>
                    <span style={{fontSize:"0.85rem"}}>{weatherData.find(function(d){return d.date===TODAY.toISOString().split("T")[0];}).emoji}</span>
                    <span style={{fontSize:"0.65rem",fontWeight:700,color:"rgba(250,248,244,0.85)"}}>{weatherData.find(function(d){return d.date===TODAY.toISOString().split("T")[0];}).high}°</span>
                  </div>
                :!weatherLocation&&<button onClick={requestWeatherLocation} style={{fontSize:"0.62rem",color:"rgba(200,169,122,0.8)",background:"none",border:"1px solid rgba(200,169,122,0.3)",borderRadius:"50px",padding:"1px 7px",cursor:"pointer",fontFamily:"inherit"}}>+ weather</button>}
              </div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"2rem",fontWeight:700,color:"#faf8f4",lineHeight:1.05}}>
                {greeting}{(preferredName||authUser?.displayName)?", "+(preferredName||authUser.displayName.split(" ")[0]):""} {greetingEmoji}
              </div>
              {dayRhythm.theme&&<div style={{color:"rgba(250,248,244,0.65)",fontSize:"0.8rem",fontWeight:500,marginTop:"0.3rem"}}>{dayRhythm.emoji} {dayRhythm.theme} day</div>}
              {flowMode==="Survival"&&<div style={{color:"#f4a0a0",fontSize:"0.8rem",fontWeight:600,marginTop:"0.4rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>🛟 You don't have to do everything. Just enough.</div>}
            </div>
            <button onClick={()=>setModal("share")} style={{background:"none",border:"none",cursor:"pointer",opacity:0.45,display:"flex",marginTop:"0.2rem",flexShrink:0}}><Icon name="share" size={14} color="#faf8f4"/></button>
          </div>

          {/* Flow mode chips */}
          <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap",marginBottom:"0.5rem"}}>
            {Object.entries(FM).map(([mode,m])=>(
              <button key={mode} onClick={()=>setFlowMode(mode)} style={{background:flowMode===mode?m.color:"transparent",color:flowMode===mode?"#fff":"rgba(250,248,244,0.7)",border:"2px solid "+(flowMode===mode?m.color:"rgba(250,248,244,0.2)"),borderRadius:"2rem",padding:"0.28rem 0.8rem",cursor:"pointer",fontSize:"0.72rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{m.emoji} {mode}</button>
            ))}
          </div>
          {flowMode!=="Survival"
            ?<div style={{fontSize:"0.7rem",color:"rgba(250,248,244,0.45)",marginBottom:"0.75rem",paddingLeft:"0.2rem",fontStyle:"italic"}}>Hard day? Tap 🛟 Survival — it's okay.</div>
            :<div style={{marginBottom:"0.75rem"}}/>
          }
          {flowMode==="Busy"&&(
            <div style={{background:"rgba(200,169,122,0.12)",border:"1.5px solid rgba(200,169,122,0.3)",borderRadius:"0.9rem",padding:"0.7rem 0.9rem",marginBottom:"0.65rem",display:"flex",gap:"0.55rem",alignItems:"flex-start"}}>
              <span style={{fontSize:"1.1rem",flexShrink:0}}>⚡</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:"0.82rem",color:"#c8a97a",marginBottom:"0.2rem"}}>Let's lighten the load</div>
                <div style={{fontSize:"0.76rem",color:"rgba(250,248,244,0.65)",lineHeight:1.5}}>Pick just 1–2 things that actually matter today. Dinner can be simple. The rest can wait.</div>
                <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap",marginTop:"0.5rem"}}>
                  {["Order takeout tonight","Dinner from the freezer","Ask for help with one task","Say no to one thing today"].map(function(s){return(
                    <button key={s} onClick={function(){setTasks(function(p){return[...p,{id:uid(),text:s,day:TODAY_NAME,done:false,tier:"top3"}];});}} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(200,169,122,0.4)",borderRadius:"2rem",padding:"0.18rem 0.6rem",cursor:"pointer",fontSize:"0.68rem",fontWeight:600,fontFamily:"inherit",color:"#c8a97a",transition:"all 0.12s"}}>{"+ "+s}</button>
                  );})}
                </div>
              </div>
            </div>
          )}

          {/* Primary CTA */}
          {!isEvening&&!dayOpen&&(
            <button onClick={()=>{ setDayOpen(true); loadAiSuggestions(); }} style={{width:"100%",background:flowMode==="Survival"?`linear-gradient(135deg,${T.rose},${T.roseDark})`:"linear-gradient(135deg,"+T.sage+","+T.sageDark+")",color:"#fff",border:"none",borderRadius:"1.1rem",padding:"1rem",cursor:"pointer",fontWeight:700,fontSize:"1rem",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.55rem",boxShadow:"0 5px 22px "+(flowMode==="Survival"?T.rose:T.sage)+"40",letterSpacing:"0.01em"}}>
              {flowMode==="Survival"?"🛟 See my 3 things for today":"⚓️ See what matters today"}
            </button>
          )}
          {isEvening&&!dayOpen&&(
            <div style={{background:"linear-gradient(135deg,#e8f0ec,#eef3f7)",border:"1.5px solid rgba(122,158,142,0.3)",borderRadius:"1.2rem",padding:"1rem 1.2rem"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.3rem"}}>
                <span style={{fontSize:"1.2rem"}}>🌙</span>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:"#3a5a50"}}>{greeting}{(preferredName||authUser?.displayName)?", "+(preferredName||authUser.displayName.split(" ")[0]):""}</div>
              </div>
              <div style={{fontSize:"0.8rem",color:"#5a7a70",lineHeight:1.55,marginBottom:"0.75rem"}}>{tasks.filter(function(t){return(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.archived&&t.done;}).length>0?"You did "+tasks.filter(function(t){return(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.archived&&t.done;}).length+" things today. Rest well — tomorrow is a fresh start.":"Rest well tonight. Every day you show up is enough."}</div>
              <button onClick={()=>setDayOpen(true)} style={{width:"100%",background:"rgba(122,158,142,0.15)",border:"1.5px solid rgba(122,158,142,0.35)",borderRadius:"0.8rem",padding:"0.7rem",cursor:"pointer",fontWeight:700,fontSize:"0.88rem",fontFamily:"inherit",color:"#4a7a68"}}>🌙 Wind down my day</button>
            </div>
          )}
          {dayOpen&&(
            <button onClick={()=>setDayOpen(false)} style={{width:"100%",background:T.bgAlt,color:T.textSoft,border:"1.5px solid "+T.border,borderRadius:"1.1rem",padding:"0.75rem",cursor:"pointer",fontWeight:600,fontSize:"0.84rem",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem"}}>
              ↑ Collapse
            </button>
          )}
        </div>
        {/* ── Ripple notification banner ── */}
        <div ref={function(el){if(el)window._rippleBannerEl=el;}}>
          <RippleNotificationBanner />
        </div>
        {/* ── Ripple Insights ── */}
        <CompassFab/>
        <DinnerCard/>
        {(insightsLoading||visibleInsights.length>0)&&(
          <div style={{marginBottom:"0.9rem",background:T.surface,border:"1.5px solid "+T.borderSoft,borderRadius:"1.2rem",overflow:"hidden"}}>
            <div onClick={()=>setShowRippleFeed(p=>!p)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.85rem 1rem",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
                <span style={{fontSize:"0.85rem"}}>✦</span>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1rem",fontWeight:700,color:T.textDark}}>Compass</span>
                {!insightsLoading&&<span style={{fontSize:"0.7rem",color:T.textFaint,marginLeft:"0.2rem"}}>({visibleInsights.length})</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                {!insightsLoading&&<button onClick={(e)=>{e.stopPropagation();setInsights(null);setInsightsBuilt(null);buildInsights();}} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.7rem",color:T.textFaint,fontFamily:"inherit"}}>refresh</button>}
                <span style={{fontSize:"0.72rem",color:T.textFaint}}>{showRippleFeed?"▲":"▼"}</span>
              </div>
            </div>
            {showRippleFeed&&(
              <div style={{padding:"0 0.75rem 0.75rem"}}>
                {insightsLoading&&<div style={{fontSize:"0.75rem",color:T.textSoft,fontStyle:"italic",padding:"0.5rem",textAlign:"center"}}>Compass is looking at your week…</div>}
                {!insightsLoading&&visibleInsights.map((ins,idx)=>{
                  const cat=CAT_CONFIG[ins.category]||CAT_CONFIG.pattern;
                  return(
                    <div key={idx} style={{background:cat.pale,border:"1.5px solid "+cat.color+"40",borderRadius:"0.9rem",padding:"0.85rem 1rem",marginBottom:"0.5rem"}}>
                      <div style={{display:"flex",alignItems:"flex-start",gap:"0.6rem",marginBottom:"0.5rem"}}>
                        <div style={{width:28,height:28,borderRadius:"50%",background:cat.color+"20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:"0.9rem"}}>{cat.icon}</span></div>
                        <div style={{flex:1}}><div style={{fontSize:"0.85rem",fontWeight:700,color:T.textDark,marginBottom:"0.2rem"}}>{ins.title}</div><div style={{fontSize:"0.78rem",color:T.textSoft,lineHeight:1.55}}>{ins.body}</div></div>
                        <button onClick={()=>setInsights(p=>p.filter((_,i)=>i!==idx))} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:"1rem",padding:"0 0.25rem",flexShrink:0}}>x</button>
                      </div>
                      {ins.action&&(<div style={{display:"flex",gap:"0.4rem"}}><button onClick={()=>setInsights(p=>p.filter((_,i)=>i!==idx))} style={{flex:1,background:"none",border:"1px solid "+T.border,borderRadius:"0.55rem",padding:"0.35rem",fontSize:"0.72rem",cursor:"pointer",color:T.textMid,fontFamily:"inherit"}}>Not Now</button><button onClick={()=>{ins.action.fn&&ins.action.fn();setInsights(p=>p.filter((_,i)=>i!==idx));}} style={{flex:2,...btnP(cat.color,{fontSize:"0.72rem",padding:"0.35rem 0.75rem",borderRadius:"0.55rem"})}}>{ins.action.label}</button></div>)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Expanded day panel ── */}
        {!isEvening&&(
          <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          {incompletePrevTasks.length>0&&(
            <div style={{background:"linear-gradient(135deg,"+T.sandPale+","+T.surface+")",border:"1.5px solid "+T.sand+"50",borderRadius:"1rem",padding:"0.8rem 1rem"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.55rem"}}>
                <Icon name="carry" size={14} color={T.sandDark}/>
                <span style={{fontWeight:700,color:T.sandDark,fontSize:"0.83rem",flex:1}}>Unfinished from yesterday</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:"0.3rem",marginBottom:"0.65rem"}}>
                {incompletePrevTasks.map(function(t){return(
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:T.sand,flexShrink:0}}/>
                    <span style={{fontSize:"0.81rem",color:T.textDark,flex:1}}>{t.text}</span>
                    <button onClick={function(){setTasks(function(p){return p.map(function(x){return x.id===t.id?{...x,archived:true}:x;});});}} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:"1rem",lineHeight:1,padding:"0 2px",flexShrink:0}}>×</button>
                  </div>
                );})}
              </div>
              <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                <button onClick={carryTasksOver} style={btnP(T.sand,{fontSize:"0.74rem",padding:"0.3rem 0.75rem",display:"flex",alignItems:"center",gap:"0.3rem"})}><Icon name="carry" size={12} color="#fff"/> Bring all forward</button>
                <button onClick={()=>setTasks(p=>p.map(t=>incompletePrevTasks.find(x=>x.id===t.id)?{...t,archived:true}:t))} style={btnS({fontSize:"0.73rem",padding:"0.3rem 0.6rem",color:T.textSoft})}>Let all go</button>
              </div>
            </div>
          )}

            {/* ── Today's Reminders ── */}
            {(function(){
              var todayStr = TODAY.toISOString().split("T")[0];
              var todayReminders = notifications.filter(function(n){
                return !n.fired && n.date === todayStr;
              });
              // Also include calendar events today that have a reminder set
              var todayEvtReminders = calEvents.filter(function(e){
                return e.date === todayStr && notifications.some(function(n){ return n.entityId === e.id && !n.fired; });
              });
              if (todayReminders.length === 0) return null;
              return (
                <div style={{background:"linear-gradient(135deg,rgba(200,169,122,0.10),rgba(200,169,122,0.04))",border:"1.5px solid "+T.sand+"60",borderRadius:"1.2rem",padding:"0.9rem 1rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.45rem",marginBottom:"0.6rem"}}>
                    <span style={{fontSize:"1rem"}}>🔔</span>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.sandDark}}>Today's Reminders</span>
                    <span style={{marginLeft:"auto",fontSize:"0.7rem",color:T.sand,fontWeight:700,background:T.sand+"20",borderRadius:"999px",padding:"0.1rem 0.5rem"}}>{todayReminders.length}</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.3rem"}}>
                    {todayReminders.map(function(n){
                      var linkedTask = tasks.find(function(t){ return t.id === n.entityId; });
                      var linkedEvt  = calEvents.find(function(e){ return e.id === n.entityId; });
                      var isDone = linkedTask ? linkedTask.done || linkedTask.archived : false;
                      return (
                        <div key={n.id} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.45rem 0.6rem",background:isDone?"rgba(122,158,142,0.08)":T.surface,borderRadius:"0.65rem",border:"1px solid "+(isDone?T.sage+"30":T.sand+"30"),opacity:isDone?0.6:1}}>
                          <span style={{fontSize:"0.85rem",flexShrink:0}}>{linkedEvt?"📅":"📌"}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:"0.82rem",fontWeight:600,color:isDone?T.textSoft:T.textDark,textDecoration:isDone?"line-through":"none",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.entityTitle}</div>
                            {n.time&&<div style={{fontSize:"0.7rem",color:T.sand,fontWeight:700}}>{fmtTime(n.time)}</div>}
                            {n.note&&<div style={{fontSize:"0.71rem",color:T.textSoft,marginTop:"0.1rem"}}>{n.note}</div>}
                          </div>
                          {isDone&&<span style={{fontSize:"0.75rem",color:T.sage,fontWeight:700,flexShrink:0}}>✓ done</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Calendar today */}
            <div style={{background:T.surface,border:"1.5px solid "+T.blue+"40",borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.6rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem"}}>
                  <Icon name="cal" size={15} color={T.blueDark}/>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Today's schedule</span>
                </div>
                <button onClick={()=>{goTab("calendar");setCalView("day");setCalViewDate(new Date(TODAY));}} style={btnS({fontSize:"0.7rem",padding:"0.25rem 0.65rem"})}>Open</button>
              </div>
              {todayEvents.length===0
                ?<p style={{color:T.textFaint,fontSize:"0.82rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",textAlign:"center",padding:"0.3rem 0"}}>No events today — open space 🌿</p>
                :(function(){
                  var nowMin=new Date().getHours()*60+new Date().getMinutes();
                  var GRACE=60; // minutes past start before a timed event tucks into "Earlier today"
                  function evtMin(e){ if(!e.time) return null; var pp=e.time.split(":"); return (parseInt(pp[0],10)||0)*60+(parseInt(pp[1],10)||0); }
                  var upcoming=todayEvents.filter(function(e){ if(checkedCalEvents.includes(e.id)) return true; var mn=evtMin(e); return mn===null||mn+GRACE>nowMin; });
                  var earlier=todayEvents.filter(function(e){ if(checkedCalEvents.includes(e.id)) return false; var mn=evtMin(e); return mn!==null&&mn+GRACE<=nowMin; });
                  return(
                    <>
                      {upcoming.length===0&&earlier.length>0&&<p style={{color:T.textFaint,fontSize:"0.8rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",textAlign:"center",padding:"0.2rem 0"}}>Nothing left on the clock 🌙</p>}
                      {upcoming.map(function(e){return(
                        <AnchorCheckItem
                          key={e.id} id={e.id}
                          text={e.title}
                          checked={checkedCalEvents.includes(e.id)}
                          onCheck={function(id){setCheckedCalEvents(function(p){return p.includes(id)?p.filter(function(x){return x!==id;}):[...p,id];});}}
                          color={e.color}
                          badge={e.time||"all day"}
                          entityTitle={e.title}
                          onTitleClick={function(){goTab("calendar");setCalView("day");setCalViewDate(new Date(TODAY));}}
                        />
                      );})}
                      {earlier.length>0&&(
                        <details style={{marginTop:"0.35rem"}}>
                          <summary style={{listStyle:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.35rem 0.2rem",color:T.textFaint,fontSize:"0.72rem",fontWeight:600}}>
                            <span style={{fontSize:"0.8rem"}}>🕓</span> Earlier today · {earlier.length}
                          </summary>
                          <div style={{paddingTop:"0.15rem"}}>
                            {earlier.map(function(e){return(
                              <div key={e.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.3rem 0.6rem",opacity:0.5}}>
                                <div style={{width:8,height:8,borderRadius:"50%",background:e.color||T.blue,flexShrink:0}}/>
                                <span style={{fontSize:"0.8rem",color:T.textDark,flex:1}}>{e.title}</span>
                                <span style={{fontSize:"0.68rem",color:T.textFaint,fontWeight:700}}>{e.time||"all day"}</span>
                              </div>
                            );})}
                          </div>
                        </details>
                      )}
                    </>
                  );
                })()
              }
              {todayEvents.some(e=>checkedCalEvents.includes(e.id))&&(
                <div style={{marginTop:"0.4rem",paddingTop:"0.4rem",borderTop:"1px dashed "+T.borderSoft}}>
                  {todayEvents.filter(e=>checkedCalEvents.includes(e.id)).map(e=>(
                    <div key={e.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.3rem 0.6rem",opacity:0.45}}>
                      <div style={{width:18,height:18,borderRadius:"50%",background:e.color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="check" size={9} color="#fff"/></div>
                      <span style={{fontSize:"0.8rem",color:T.textDark,textDecoration:"line-through"}}>{e.title}</span>
                    </div>
                  ))}
                  <button onClick={()=>setCheckedCalEvents(p=>p.filter(id=>!todayEvents.find(e=>e.id===id)))} style={{fontSize:"0.68rem",color:T.textFaint,background:"none",border:"none",cursor:"pointer",padding:"0.2rem 0.6rem",fontFamily:"inherit"}}>Clear done</button>
                </div>
              )}
            </div>

            {/* Survival mode inline */}
            {flowMode==="Survival"&&(
              <div style={{display:"flex",flexDirection:"column",gap:"0.65rem"}}>
                <div style={{background:`linear-gradient(135deg,${T.rosePale},${T.sandPale})`,border:`2px solid ${T.rose}55`,borderRadius:"1.2rem",padding:"1.4rem 1.3rem",textAlign:"center"}}>
                  <div style={{fontSize:"2.2rem",marginBottom:"0.4rem"}}>🛟</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.45rem",fontWeight:700,color:T.textDark,marginBottom:"0.4rem"}}>Survival Mode</div>
                  <p style={{color:T.textMid,fontSize:"0.85rem",lineHeight:1.65,margin:"0 0 0.2rem",fontWeight:600}}>You are not behind. You are not failing.</p>
                  <p style={{color:T.textSoft,fontSize:"0.82rem",lineHeight:1.65,margin:0,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>Some days, just getting through is the win.</p>
                </div>
                <div style={{background:T.surface,border:`1.5px solid ${T.borderSoft}`,borderRadius:"1rem",padding:"0.8rem 1rem",textAlign:"center"}}>
                  <p style={{color:T.textSoft,fontSize:"0.82rem",margin:0,lineHeight:1.6,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>Only three things matter today. Check them off and you're done.</p>
                </div>
                {BURNOUT_TASKS.map(function(t){var checked=burnoutChecked.includes(t.id);return(
                  <button key={t.id} onClick={function(){setBurnoutChecked(function(p){return p.includes(t.id)?p.filter(function(x){return x!==t.id;}):[...p,t.id];});}} style={{background:checked?`linear-gradient(135deg,${T.sagePale},${T.sage}18)`:T.surface,border:`2px solid ${checked?T.sage:T.borderSoft}`,borderRadius:"1rem",padding:"1rem 1.2rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"1rem",width:"100%",textAlign:"left",fontFamily:"inherit",transition:"all 0.18s"}}>
                    <span style={{fontSize:"1.5rem"}}>{t.emoji}</span>
                    <span style={{flex:1,fontWeight:700,color:checked?T.sageDark:T.textDark,fontSize:"0.95rem",textDecoration:checked?"line-through":"none"}}>{t.label}</span>
                    <div style={{width:26,height:26,borderRadius:"50%",border:`2.5px solid ${checked?T.sage:T.border}`,background:checked?T.sage:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.18s"}}>{checked&&<Icon name="check" size={13} color="#fff"/>}</div>
                  </button>
                );})}
                {burnoutChecked.length===3&&(
                  <div style={{background:`linear-gradient(135deg,${T.sagePale},${T.bluePale})`,border:`2px solid ${T.sage}60`,borderRadius:"1.1rem",padding:"1.3rem",textAlign:"center"}}>
                    <div style={{fontSize:"1.8rem",marginBottom:"0.35rem"}}>🌿</div>
                    <p style={{color:T.sageDark,fontWeight:700,fontSize:"1rem",margin:"0 0 0.35rem"}}>You did it. That's everything.</p>
                    <p style={{fontWeight:500,fontSize:"0.84rem",color:T.textMid,margin:0}}>Rest now. You showed up today — that matters.</p>
                  </div>
                )}
                <div style={{background:"transparent",border:`1.5px dashed ${T.borderSoft}`,borderRadius:"1rem",padding:"0.9rem",textAlign:"center"}}>
                  <p style={{color:T.textFaint,fontSize:"0.77rem",margin:"0 0 0.5rem",fontStyle:"italic"}}>You don't have to do everything. Just enough.</p>
                  <button onClick={function(){setFlowMode("Smooth");}} style={{background:"none",border:`1.5px solid ${T.border}`,borderRadius:"2rem",padding:"0.3rem 1rem",cursor:"pointer",fontSize:"0.73rem",color:T.textSoft,fontFamily:"inherit",fontWeight:600}}>✨ Back to a full day when ready</button>
                </div>
              </div>
            )}

            {/* Today's tasks */}
            <div style={{background:T.surface,border:"3px solid "+T.blue,borderRadius:"1.2rem",padding:"1rem 1.1rem",boxShadow:"0 4px 20px "+T.blue+"14"}}>
              {people.filter(function(p){return !personIsMinor(p)&&!["Kid","Teen","Baby"].includes(p.role);}).length>0&&(
                <div style={{display:"flex",gap:"0.35rem",marginBottom:"0.65rem",flexWrap:"wrap"}}>
                  {[{id:"all",name:"Everyone"},...people.filter(function(p){return !personIsMinor(p)&&!["Kid","Teen","Baby"].includes(p.role);})].map(function(p){
                    return <button key={p.id} onClick={function(){setPersonFilter(p.id);}} style={{padding:"0.22rem 0.65rem",borderRadius:"50px",border:"1.5px solid "+(personFilter===p.id?(p.color||T.blue):T.border),background:personFilter===p.id?(p.color||T.blue)+"22":"transparent",color:personFilter===p.id?(p.color||T.blue):T.textMid,fontSize:"0.7rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{p.name}</button>;
                  })}
                </div>
              )}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.7rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem"}}>
                  <span style={{fontSize:"1rem"}}>⚓️</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Today's tasks</span>
                  {allTaskTiers.length>0&&<span style={{background:T.blue,color:"#fff",fontSize:"0.6rem",fontWeight:800,padding:"2px 7px",borderRadius:"2rem"}}>{allTaskTiers.filter(t=>t.done).length}/{allTaskTiers.length}</span>}
                </div>
                <div style={{display:"flex",gap:"0.3rem"}}>
                  {allTaskTiers.length>0&&<button onClick={function(){if(window.confirm("Clear all tasks for today?"))setTasks(function(p){return p.map(function(t){return(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)?{...t,archived:true}:t;});});}} style={btnS({fontSize:"0.68rem",padding:"0.22rem 0.55rem",color:T.textFaint})}>Clear</button>}
                  <button onClick={()=>buildDailyBriefing()} disabled={briefingLoading} style={btnS({fontSize:"0.7rem",padding:"0.25rem 0.65rem",display:"flex",alignItems:"center",gap:"0.3rem",opacity:briefingLoading?0.6:1})}>
                    {briefingLoading?<>{[0,1,2].map(i=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:T.textMid,display:"inline-block",margin:"0 1px"}}/>)}</>:<>✨ Plan my day</>}
                  </button>
                </div>
              </div>
              {allTaskTiers.filter(t=>!t.done).length===0&&allTaskTiers.length===0&&<p style={{color:T.textFaint,fontSize:"0.8rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",textAlign:"center",padding:"0.2rem 0 0.5rem"}}>No tasks yet — tap ✨ Plan my day or add one below.</p>}
              {/* Progress momentum line */}
              {allTaskTiers.length>0&&allTaskTiers.some(t=>t.done)&&allTaskTiers.some(t=>!t.done)&&(
                <div style={{fontSize:"0.72rem",color:T.sage,fontWeight:700,marginBottom:"0.5rem",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                  <span>✓</span>
                  <span>{allTaskTiers.filter(t=>t.done).length} done — you're doing great.</span>
                </div>
              )}
              {allTaskTiers.length>0&&allTaskTiers.every(t=>t.done)&&(
                <div style={{fontSize:"0.78rem",color:T.sage,fontWeight:700,marginBottom:"0.5rem",fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",textAlign:"center"}}>🌿 All done. That's everything for today.</div>
              )}
              {top3Raw.map(t=>(
                <AnchorCheckItem key={t.id} id={t.id} text={t.text} checked={t.done}
                  onCheck={id=>setTasks(p=>p.map(x=>x.id===id?{...x,done:!x.done}:x))}
                  color={T.blue} badge="TOP" entityTitle={t.text}/>
              ))}
              {next3Raw.map(t=>(
                <AnchorCheckItem key={t.id} id={t.id} text={t.text} checked={t.done}
                  onCheck={id=>setTasks(p=>p.map(x=>x.id===id?{...x,done:!x.done}:x))}
                  color={T.sage} entityTitle={t.text}/>
              ))}
              {/* Completed tasks — collapsed */}
              {allTaskTiers.some(t=>t.done)&&(
                <div style={{marginTop:"0.5rem",paddingTop:"0.4rem",borderTop:"1px dashed "+T.borderSoft}}>
                  {allTaskTiers.filter(t=>t.done).map(t=>(
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.3rem 0.6rem",opacity:0.45}}>
                      <div style={{width:18,height:18,borderRadius:"50%",background:T.sage,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="check" size={9} color="#fff"/></div>
                      <span style={{fontSize:"0.8rem",color:T.textDark,textDecoration:"line-through"}}>{t.text}</span>
                      <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,done:false}:x))} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.65rem",color:T.textFaint,padding:"0 2px",fontFamily:"inherit"}}>undo</button>
                    </div>
                  ))}
                </div>
              )}
              {top3Raw.length > 0 && top3Raw.every(t=>t.done) && (
                <div style={{textAlign:"center",padding:"0.75rem",background:"rgba(122,158,142,0.1)",borderRadius:"0.75rem",marginTop:"0.5rem",marginBottom:"0.25rem"}}>
                  <div style={{fontSize:"1.2rem",marginBottom:"0.2rem"}}>🌿</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1rem",color:"#4d7a6a",fontWeight:600}}>You did enough today.</div>
                  <div style={{fontSize:"0.75rem",color:"#7a9e8e",marginTop:"0.15rem"}}>That is a win.</div>
                </div>
              )}
              {addingTask&&(
                <div style={{display:"flex",flexDirection:"column",gap:"0.35rem",marginTop:"0.4rem"}}>
                  <div style={{display:"flex",gap:"0.4rem"}}>
                    <input value={newTask} onChange={e=>setNewTask(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter"){addQuickTask(newTask,addingTask,newTaskPerson);setNewTask("");setNewTaskPerson("");setAddingTask(null);}if(e.key==="Escape"){setNewTask("");setNewTaskPerson("");setAddingTask(null);}}}
                      placeholder={addingTask==="top3"?"Top priority…":"Flow task…"}
                      style={{...inp({flex:1,fontSize:"0.86rem",borderColor:addingTask==="top3"?T.blue+"70":T.sage+"70",padding:"0.6rem 0.85rem"})}} autoFocus/>
                    <button onClick={()=>{addQuickTask(newTask,addingTask,newTaskPerson);setNewTask("");setNewTaskPerson("");setAddingTask(null);}} style={btnP(addingTask==="top3"?T.blue:T.sage,{padding:"0.58rem 0.8rem",display:"flex",alignItems:"center"})}><Icon name="plus" size={15} color="#fff"/></button>
                  </div>
                  <div style={{display:"flex",gap:"0.3rem",flexWrap:"wrap",paddingLeft:"0.1rem"}}>
                    <button onClick={()=>setNewTaskPerson("")} style={{padding:"0.18rem 0.6rem",borderRadius:"50px",border:"1.5px solid "+(newTaskPerson===""?T.blue:T.border),background:newTaskPerson===""?T.bluePale:"transparent",color:newTaskPerson===""?T.blue:T.textFaint,fontSize:"0.68rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Household</button>
                    {people.map(function(p){return(<button key={p.id} onClick={()=>setNewTaskPerson(p.name)} style={{padding:"0.18rem 0.6rem",borderRadius:"50px",border:"1.5px solid "+(newTaskPerson===p.name?(p.color||T.blue):T.border),background:newTaskPerson===p.name?(p.color||T.blue)+"22":"transparent",color:newTaskPerson===p.name?(p.color||T.blue):T.textFaint,fontSize:"0.68rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{p.name}</button>);})}
                  </div>
                </div>
              )}
              {!addingTask&&(
                <div style={{display:"flex",gap:"0.4rem",marginTop:"0.55rem"}}>
                  <button onClick={()=>setAddingTask("top3")} style={btnP(T.blue,{flex:1,fontSize:"0.75rem",padding:"0.45rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.3rem"})}><Icon name="plus" size={12} color="#fff"/> Top priority</button>
                  <button onClick={()=>setAddingTask("next3")} style={{...btnS({flex:1,fontSize:"0.75rem",padding:"0.45rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.3rem",color:T.sage,borderColor:T.sage+"60"})}}><Icon name="plus" size={12} color={T.sage}/> Flow task</button>
                </div>
              )}
            </div>

            {/* ── My Morning Anchors — personal per-user checklist ── */}
            {(function(){
              var myName = preferredName || (authUser?.displayName ? authUser.displayName.split(" ")[0] : null);
              var unchecked = personalAnchors.filter(function(a){ return !checkedPersonalAnchors.includes(a.id); });
              var checked = personalAnchors.filter(function(a){ return checkedPersonalAnchors.includes(a.id); });
              return (
                <div style={{background:"linear-gradient(135deg,"+T.sandPale+","+T.surface+")",border:"1.5px solid "+T.sand+"60",borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.6rem"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"0.45rem"}}>
                      <span style={{fontSize:"0.95rem"}}>🌿</span>
                      <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>{myName ? myName+"'s anchors" : "My anchors"}</span>
                      <span style={{fontSize:"0.6rem",background:T.sand+"25",color:T.sandDark,fontWeight:800,padding:"2px 7px",borderRadius:"2rem"}}>just mine</span>
                    </div>
                    <button onClick={function(){ setAddingPersonalAnchor(function(v){ return !v; }); setNewPersonalAnchorText(""); }} style={{background:"none",border:"none",cursor:"pointer",padding:"2px 6px",fontSize:"1.1rem",color:T.sandDark,lineHeight:1}}>+</button>
                  </div>
                  {personalAnchors.length === 0 && !addingPersonalAnchor && (
                    <p style={{color:T.textFaint,fontSize:"0.8rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",margin:"0 0 0.3rem",textAlign:"center",padding:"0.3rem 0"}}>Your personal daily anchors — things only you need to check off each morning.</p>
                  )}
                  {unchecked.map(function(a){
                    return (
                      <AnchorCheckItem key={a.id} id={a.id} text={a.text}
                        checked={checkedPersonalAnchors.includes(a.id)}
                        onCheck={function(id){ setCheckedPersonalAnchors(function(p){ return p.includes(id)?p.filter(function(x){return x!==id;}):[...p,id]; }); }}
                        color={T.sand} bell={false} entityTitle={a.text}/>
                    );
                  })}
                  {checked.length > 0 && (
                    <div style={{marginTop:"0.35rem",paddingTop:"0.35rem",borderTop:"1px dashed "+T.borderSoft}}>
                      {checked.map(function(a){
                        return (
                          <div key={a.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.28rem 0.6rem",opacity:0.4}}>
                            <div style={{width:16,height:16,borderRadius:"50%",background:T.sand,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="check" size={8} color="#fff"/></div>
                            <span style={{fontSize:"0.78rem",color:T.textDark,textDecoration:"line-through",flex:1}}>{a.text}</span>
                            <button onClick={function(){ setPersonalAnchors(function(p){ return p.filter(function(x){ return x.id!==a.id; }); }); }} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.62rem",color:T.textFaint,padding:"0 2px",fontFamily:"inherit"}}>remove</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {addingPersonalAnchor && (
                    <div style={{display:"flex",gap:"0.4rem",marginTop:"0.4rem"}}>
                      <input value={newPersonalAnchorText} onChange={function(e){ setNewPersonalAnchorText(e.target.value); }}
                        onKeyDown={function(e){
                          if(e.key==="Enter" && newPersonalAnchorText.trim()){
                            var newA = {id:"pa_"+Date.now(), text:newPersonalAnchorText.trim()};
                            setPersonalAnchors(function(p){ return [...p, newA]; });
                            setNewPersonalAnchorText(""); setAddingPersonalAnchor(false);
                          }
                          if(e.key==="Escape"){ setAddingPersonalAnchor(false); setNewPersonalAnchorText(""); }
                        }}
                        placeholder="Add a personal anchor…"
                        style={{...inp({flex:1,fontSize:"0.86rem",borderColor:T.sand+"70",padding:"0.55rem 0.85rem"})}} autoFocus/>
                      <button onClick={function(){
                        if(newPersonalAnchorText.trim()){
                          var newA2 = {id:"pa_"+Date.now(), text:newPersonalAnchorText.trim()};
                          setPersonalAnchors(function(p){ return [...p, newA2]; });
                          setNewPersonalAnchorText(""); setAddingPersonalAnchor(false);
                        }
                      }} style={btnP(T.sand,{padding:"0.55rem 0.8rem",display:"flex",alignItems:"center"})}><Icon name="plus" size={15} color="#fff"/></button>
                      <button onClick={function(){ setAddingPersonalAnchor(false); setNewPersonalAnchorText(""); }} style={btnS({padding:"0.55rem 0.7rem",fontSize:"0.8rem"})}>✕</button>
                    </div>
                  )}
                  {!addingPersonalAnchor && personalAnchors.length > 0 && (
                    <button onClick={function(){ setAddingPersonalAnchor(true); setNewPersonalAnchorText(""); }} style={{...btnS({fontSize:"0.73rem",padding:"0.28rem 0.7rem",marginTop:"0.4rem",color:T.sandDark,borderColor:T.sand+"50",display:"flex",alignItems:"center",gap:"0.3rem"})}}>
                      <Icon name="plus" size={11} color={T.sandDark}/> Add anchor
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Tonight's dinner */}
            <div style={{background:T.surface,border:"1.5px solid "+(noMealPlanned?T.rose+"50":T.sage+"45"),borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.5rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem"}}>
                  <span style={{fontSize:"0.95rem"}}>🍽️</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Tonight's dinner</span>
                </div>
                <button onClick={()=>goTab("meals")} style={btnS({fontSize:"0.7rem",padding:"0.25rem 0.65rem"})}>Plan meals</button>
              </div>
              {noMealPlanned
                ?<div style={{background:T.rose+"10",border:"1.5px dashed "+T.rose+"50",borderRadius:"0.75rem",padding:"0.65rem 0.85rem",display:"flex",alignItems:"center",gap:"0.55rem"}}>
                  <span style={{fontSize:"0.9rem"}}>⚠️</span>
                  <div>
                    <div style={{fontSize:"0.83rem",fontWeight:600,color:T.rose}}>No dinner planned</div>
                    <div style={{fontSize:"0.73rem",color:T.textSoft,marginTop:"0.12rem"}}>Tap "Plan meals" to add something — or wing it 🌿</div>
                  </div>
                </div>
                :<div>
                  {MEALS_TO_SHOW.map(m=>todayMeal[m]&&(
                    <AnchorCheckItem key={m} id={"meal_"+m+"_"+TODAY_NAME}
                      text={todayMeal[m]} checked={checkedMealItems.includes("meal_"+m+"_"+TODAY_NAME)}
                      onCheck={id=>setCheckedMealItems(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}
                      color={T.sage} badge={m} entityTitle={todayMeal[m]}/>
                  ))}
                  {todayMeal.dinner&&!checkedMealItems.includes("meal_dinner_"+TODAY_NAME)&&!todayMeal.dinner.toLowerCase().includes("snack")&&!todayMeal.dinner.toLowerCase().includes("burrito")&&(
                    <div style={{marginTop:"0.3rem",fontSize:"0.76rem",color:T.textSoft,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",paddingLeft:"0.3rem"}}>💡 Check if anything needs defrosting.</div>
                  )}
                </div>
              }
            </div>


            {/* Brain items scheduled for today via Task Board — always visible bridge */}
            {flowMode!=="Survival"&&(function(){
              var scheduledToday=brainItems.filter(function(b){return b.scheduledDay===TODAY_NAME&&!b.done;});
              var notYetTasks=scheduledToday.filter(function(b){return !allTaskTiers.some(function(t){return t.brainId===b.id||t.linkedTaskId===b.id||t.text===b.text;});});
              if(notYetTasks.length===0) return null;
              return(
                <div style={{background:"linear-gradient(135deg,"+T.lavender+"10,"+T.surface+")",border:"1.5px solid "+T.lavender+"45",borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.45rem",marginBottom:"0.6rem"}}>
                    <span style={{fontSize:"0.9rem"}}>🧠</span>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Queued for today</span>
                    <span style={{fontSize:"0.65rem",fontWeight:700,color:T.lavender,background:T.lavender+"18",borderRadius:"2rem",padding:"1px 7px"}}>{notYetTasks.length} from Clear Your Mind</span>
                  </div>
                  {notYetTasks.map(function(b){return(
                    <div key={b.id} style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.45rem 0.6rem",background:T.white,borderRadius:"0.75rem",marginBottom:"0.3rem",border:"1.5px solid "+T.lavender+"25"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:T.lavender,flexShrink:0}}/>
                      <span style={{flex:1,fontSize:"0.85rem",color:T.textDark,fontWeight:500}}>{b.text}</span>
                      <button onClick={function(){addQuickTask(b.text,"next3");setBrainItems(function(p){return p.map(function(x){return x.id===b.id?{...x,scheduledDay:TODAY_NAME}:x;});});}} style={{...btnP(T.lavender,{fontSize:"0.68rem",padding:"0.22rem 0.6rem"})}}>+ Flow</button>
                      <button onClick={function(){addQuickTask(b.text,"top3");setBrainItems(function(p){return p.map(function(x){return x.id===b.id?{...x,scheduledDay:TODAY_NAME}:x;});});}} style={{...btnP(T.blue,{fontSize:"0.68rem",padding:"0.22rem 0.6rem"})}}>Top</button>
                    </div>
                  );})}
                </div>
              );
            })()}

            {/* ── Unified Today's prioritized list — hidden in Survival mode ── */}
            {flowMode!=="Survival"&&(function(){
              var brainSuggestions=(!aiLoading&&aiSuggestions?.brain_items?.length>0)
                ?aiSuggestions.brain_items.map(function(item){
                    var text=typeof item==="string"?item:item.text;
                    var reason=typeof item==="object"?item.reason:null;
                    return {text,reason,src:"brain",brainItem:brainItems.find(function(b){return b.text===text&&!b.done;})};
                  })
                :[];
              var todoSuggestions=(!aiLoading&&aiSuggestions?.todos?.length>0)
                ?aiSuggestions.todos.map(function(text){return {text,src:"todo"};})
                :[];
              var horizonSuggestions=(!aiLoading&&aiSuggestions?.upcoming?.length>0)
                ?aiSuggestions.upcoming.map(function(text){return {text,src:"horizon"};})
                :[];
              var MINOR_ROLES_T=["Kid","Teen","Baby"];
              var adultNames=people.filter(function(p){return !personIsMinor(p)&&!MINOR_ROLES_T.includes(p.role);}).map(function(p){return p.name;});
              var ideasPool=brainItems.filter(function(b){
                if(b.done) return false;
                if(b.scheduledDay&&b.scheduledDay!=="") return false;
                if(allTaskTiers.some(function(t){return t.text===b.text||t.brainId===b.id;})) return false;
                if(b.assignedTo&&!adultNames.includes(b.assignedTo)) return false;
                if(brainSuggestions.some(function(s){return s.text===b.text;})) return false;
                return true;
              });
              var THEME_TO_CATS_T={"reset":["household","errands"],"errands":["errands","orders"],"admin":["admin","calls","orders"],"clean":["household"],"prep":["household","errands"],"family":["errands","household"],"rest":["someday"],"finance":["admin"],"fitness":["errands"],"batch cook":["household"]};
              var themeKeyT=(dayRhythm.theme||"").toLowerCase();
              var themedCats=Object.entries(THEME_TO_CATS_T).find(function(kv){return themeKeyT.includes(kv[0]);})?.[1]||[];
              var themedIdeas=ideasPool.filter(function(b){return themedCats.includes(b.cat);});
              var otherIdeas=ideasPool.filter(function(b){return !themedCats.includes(b.cat)&&["errands","admin","household","calls","orders"].includes(b.cat);});
              var weeklyIdeas=[...themedIdeas,...otherIdeas].slice(0,3).map(function(b){return {text:b.text,src:"weekly",brainItem:b};});
              var allSuggestions=[...brainSuggestions,...todoSuggestions,...horizonSuggestions,...weeklyIdeas];
              var seen=new Set();
              allSuggestions=allSuggestions.filter(function(s){
                if(seen.has(s.text)) return false;
                if(allTaskTiers.some(function(t){return t.text===s.text;})) return false;
                seen.add(s.text);
                return true;
              });
              if(allSuggestions.length===0&&!aiLoading) return null;
              var top3=allSuggestions.slice(0,3);
              var alsoToday=allSuggestions.slice(3);
              return(
                <div style={{background:T.surface,border:"1.5px solid "+T.blue+"30",borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
                  {aiLoading&&(
                    <div style={{textAlign:"center",padding:"0.5rem 0 0.75rem"}}>
                      <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:"0.4rem"}}>{[0,1,2].map(function(i){return <div key={i} style={{width:9,height:9,borderRadius:"50%",background:T.sage,animation:"bounce 1.2s "+(i*0.2)+"s infinite ease-in-out"}}/>;})}</div>
                      <div style={{fontSize:"0.78rem",color:T.textSoft,fontStyle:"italic"}}>Looking at your list and calendar…</div>
                    </div>
                  )}
                  {top3.length>0&&(
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.55rem"}}>
                        <span style={{fontSize:"0.82rem"}}>⭐</span>
                        <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"0.95rem",color:T.textDark}}>Top 3 — focus here first</span>
                      </div>
                      {top3.map(function(s,i){
                        var sAdded=allTaskTiers.some(function(t){return t.text===s.text;});
                        var sEmoji=s.src==="horizon"?"🌅":"💭";
                        return(
                          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"0.55rem",padding:"0.5rem 0.65rem",background:(T.bluePale||"#ddeaf5"),borderRadius:"0.75rem",marginBottom:"0.3rem",border:"1.5px solid "+T.blue+"30"}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:"0.86rem",color:sAdded?T.sageDark:T.textDark,fontWeight:600,lineHeight:1.35}}>{sAdded&&"✓ "}{s.text}</div>
                              {s.reason&&<div style={{fontSize:"0.68rem",color:T.textSoft,marginTop:"0.1rem",fontStyle:"italic"}}>{s.reason}</div>}
                            </div>
                            <span style={{fontSize:"0.85rem",alignSelf:"center",flexShrink:0,opacity:0.7}}>{sEmoji}</span>
                            {!sAdded&&<button onClick={function(){addQuickTask(s.text,"top3");if(s.brainItem)setBrainItems(function(p){return p.map(function(x){return x.id===s.brainItem.id?{...x,scheduledDay:TODAY_NAME}:x;});});}} style={btnP(T.blue,{fontSize:"0.7rem",padding:"0.25rem 0.65rem",flexShrink:0})}>+ Add</button>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {alsoToday.length>0&&(
                    <div>
                      <div style={{height:"0.5px",background:T.borderSoft,margin:"0.75rem 0 0.6rem"}}/>
                      <div style={{fontSize:"0.72rem",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:T.textFaint,marginBottom:"0.5rem",fontFamily:"'DM Sans',sans-serif"}}>Also today</div>
                      {alsoToday.map(function(s,i){
                        var sAdded=allTaskTiers.some(function(t){return t.text===s.text;});
                        var sEmoji=s.src==="horizon"?"🌅":"💭";
                        return(
                          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"0.55rem",padding:"0.5rem 0.65rem",background:T.white,borderRadius:"0.75rem",marginBottom:"0.3rem",border:"1.5px solid "+T.borderSoft}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:"0.86rem",color:sAdded?T.sageDark:T.textDark,fontWeight:400,lineHeight:1.35}}>{sAdded&&"✓ "}{s.text}</div>
                              {s.reason&&<div style={{fontSize:"0.68rem",color:T.textSoft,marginTop:"0.1rem",fontStyle:"italic"}}>{s.reason}</div>}
                            </div>
                            <span style={{fontSize:"0.85rem",alignSelf:"center",flexShrink:0,opacity:0.7}}>{sEmoji}</span>
                            {!sAdded&&<button onClick={function(){addQuickTask(s.text,"next3");if(s.brainItem)setBrainItems(function(p){return p.map(function(x){return x.id===s.brainItem.id?{...x,scheduledDay:TODAY_NAME}:x;});});}} style={btnP(T.sage,{fontSize:"0.7rem",padding:"0.25rem 0.65rem",flexShrink:0})}>+ Add</button>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{marginTop:"0.6rem",paddingTop:"0.5rem",borderTop:"1px dashed "+T.borderSoft,display:"flex",gap:"0.8rem",flexWrap:"wrap"}}>
                    <span style={{fontSize:"0.65rem",color:T.textFaint}}>💭 Clear Your Mind</span>
                    <span style={{fontSize:"0.65rem",color:T.textFaint}}>🌅 On the horizon</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── For later · Compass notes ── */}
        <div style={{display:"flex",alignItems:"center",gap:"0.6rem",margin:"1.35rem 0 0.85rem"}}>
          <div style={{flex:1,height:1,background:T.borderSoft}}/>
          <span style={{fontSize:"0.66rem",letterSpacing:"0.1em",textTransform:"uppercase",color:T.blueDark||T.blue,fontWeight:800}}>For later</span>
          <div style={{flex:1,height:1,background:T.borderSoft}}/>
        </div>
        <TodayBriefing compassCache={compassCache} setCompassCache={setCompassCache} flowMode={flowMode} setFlowMode={setFlowMode} userName={preferredName||(authUser&&authUser.displayName?authUser.displayName.split(" ")[0]:"")}/>
        <NudgeStrip compassCache={compassCache} setCompassCache={setCompassCache}/>
        <PrepCard compassCache={compassCache} setCompassCache={setCompassCache}/>
        <WeeklyReviewCard compassCache={compassCache} setCompassCache={setCompassCache}/>

        {/* ── Evening wind-down panel ── */}
        {dayOpen&&isEvening&&(
          <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
            {dayClosed?(
              <div style={{background:`linear-gradient(135deg,${T.sagePale},${T.bluePale})`,border:`2px solid ${T.sage}40`,borderRadius:"1.2rem",padding:"1.5rem",textAlign:"center"}}>
                <div style={{fontSize:"2rem",marginBottom:"0.4rem"}}>🌙</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.5rem"}}>Day closed</div>
                <div style={{color:T.textMid,fontSize:"0.84rem",lineHeight:1.65}}>{typeof dayClosed === "string" ? dayClosed+" closed out tonight." : "You showed up."} Rest well.</div>
                <button onClick={function(){ setDayClosed(false); }} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.7rem",color:T.textFaint,fontFamily:"inherit",marginTop:"0.75rem",padding:"0.25rem 0.5rem"}}>↩ Reopen</button>
              </div>
            ):(
              <>
                {/* Card 1: Tasks */}
                <div style={{background:"rgba(122,158,142,0.08)",border:"1.5px solid "+T.sage,borderRadius:"1rem",padding:"1rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
                    <span style={{fontSize:"1.1rem"}}>📋</span>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.sageDark}}>Tasks</span>
                    {tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.archived&&t.done).length>0&&<span style={{marginLeft:"auto",fontSize:"0.7rem",color:T.sage,fontWeight:600}}>✓ {tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.archived&&t.done).length} done</span>}
                  </div>
                  {tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.archived).length===0?(
                    <div style={{fontSize:"0.82rem",color:T.sage,fontWeight:600}}>✓ All clear — nothing to review!</div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:"0.3rem"}}>
                      {tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.archived&&t.done).map(t=>(
                        <div key={t.id} style={{padding:"0.4rem 0.65rem",background:T.sagePale,borderRadius:"0.55rem",fontSize:"0.8rem",color:T.sageDark,fontWeight:600}}>✓ {t.text}</div>
                      ))}
                      {tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.archived&&!t.done).map(t=>(
                        <div key={t.id} style={{padding:"0.5rem 0.65rem",background:T.surface,borderRadius:"0.65rem",border:"1px solid "+T.borderSoft}}>
                          <div style={{fontSize:"0.83rem",color:T.textDark,fontWeight:600,marginBottom:"0.3rem"}}>{t.text}</div>
                          <div style={{display:"flex",gap:"0.3rem"}}>
                            <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,carried:true,carriedTo:DAY_NAMES[(new Date(TODAY).getDay()+1)%7]}:x))} style={{flex:1,background:"transparent",color:T.textMid,border:"1.5px solid "+T.border,borderRadius:"0.45rem",padding:"0.25rem",fontSize:"0.7rem",cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>↩ Tomorrow</button>
                            <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,archived:true}:x))} style={{flex:1,background:"transparent",color:T.textMid,border:"1.5px solid "+T.border,borderRadius:"0.45rem",padding:"0.25rem",fontSize:"0.7rem",cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>✕ Let go</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card 2: Tonight's Rhythm */}
                <div style={{background:"rgba(58,107,138,0.06)",border:"1.5px solid "+T.blue,borderRadius:"1rem",padding:"1rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
                    <span style={{fontSize:"1.1rem"}}>🏠</span>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.blue}}>Tonight's Rhythm</span>
                  </div>
                  {((rhythm[TODAY_NAME]||{}).tasks||["Tidy kitchen","Set out tomorrow's things","Quick 10-min reset"]).map((task,i)=>(
                    <div key={i} onClick={()=>setCheckedMealItems(p=>p.includes("rhythm_"+i)?p.filter(x=>x!=="rhythm_"+i):[...p,"rhythm_"+i])} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.5rem 0.65rem",background:checkedMealItems.includes("rhythm_"+i)?T.bluePale:T.surface,borderRadius:"0.65rem",marginBottom:"0.3rem",cursor:"pointer",border:"1.5px solid "+(checkedMealItems.includes("rhythm_"+i)?T.blue:T.borderSoft)}}>
                      <div style={{width:18,height:18,borderRadius:4,border:"1.5px solid "+(checkedMealItems.includes("rhythm_"+i)?T.blue:"rgba(0,0,0,0.15)"),background:checkedMealItems.includes("rhythm_"+i)?T.blue:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {checkedMealItems.includes("rhythm_"+i)&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                      </div>
                      <span style={{fontSize:"0.83rem",color:T.textDark,fontWeight:500}}>{task}</span>
                    </div>
                  ))}
                </div>

                {/* Card 3: Compass Suggestions */}
                <div style={{background:"rgba(123,94,167,0.06)",border:"1.5px solid "+T.lavender,borderRadius:"1rem",padding:"1rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
                    <span style={{fontSize:"1.1rem"}}>✦</span>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.lavender}}>Compass Suggestions</span>
                  </div>
                  {eveningNudges.slice(0,4).map((n,i)=>(
                    <AnchorCheckItem key={"evening_"+i} id={"evening_"+i} text={n} checked={checkedMealItems.includes("evening_"+i)} onCheck={id=>setCheckedMealItems(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])} color={T.lavender} bell={false} entityTitle={n}/>
                  ))}
                  {eveningNudges.length===0&&<div style={{fontSize:"0.82rem",color:T.textSoft}}>✨ Generating suggestions...</div>}
                </div>

                {/* ── Tonight & Tomorrow Reminders ── */}
                {(function(){
                  var todayStr = TODAY.toISOString().split("T")[0];
                  var tmrDate  = new Date(TODAY); tmrDate.setDate(tmrDate.getDate()+1);
                  var tmrStr   = tmrDate.toISOString().split("T")[0];
                  var tonightReminders = notifications.filter(function(n){
                    return !n.fired && n.date === todayStr && n.time && (function(){ var h=parseInt((n.time||"0:0").split(":")[0],10); return h>=17; })();
                  });
                  var tmrReminders = notifications.filter(function(n){
                    return !n.fired && n.date === tmrStr;
                  });
                  var allEvening = tonightReminders.concat(tmrReminders);
                  if (allEvening.length === 0) return null;
                  return (
                    <div style={{background:"linear-gradient(135deg,rgba(58,107,138,0.07),rgba(200,169,122,0.06))",border:"1.5px solid "+T.blue+"40",borderRadius:"1rem",padding:"0.9rem 1rem"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"0.45rem",marginBottom:"0.6rem"}}>
                        <span style={{fontSize:"1rem"}}>🔔</span>
                        <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.blue}}>Tonight &amp; Tomorrow</span>
                        <span style={{marginLeft:"auto",fontSize:"0.7rem",color:T.blue,fontWeight:700,background:T.bluePale,borderRadius:"999px",padding:"0.1rem 0.5rem"}}>{allEvening.length}</span>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:"0.3rem"}}>
                        {tonightReminders.length>0&&<div style={{fontSize:"0.68rem",fontWeight:800,color:T.textFaint,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.1rem"}}>Tonight</div>}
                        {tonightReminders.map(function(n){
                          return (
                            <div key={n.id} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.45rem 0.6rem",background:T.surface,borderRadius:"0.65rem",border:"1px solid "+T.sand+"30"}}>
                              <span style={{fontSize:"0.85rem",flexShrink:0}}>🌙</span>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:"0.82rem",fontWeight:600,color:T.textDark,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.entityTitle}</div>
                                {n.time&&<div style={{fontSize:"0.7rem",color:T.sand,fontWeight:700}}>{fmtTime(n.time)}</div>}
                                {n.note&&<div style={{fontSize:"0.71rem",color:T.textSoft,marginTop:"0.1rem"}}>{n.note}</div>}
                              </div>
                            </div>
                          );
                        })}
                        {tmrReminders.length>0&&<div style={{fontSize:"0.68rem",fontWeight:800,color:T.textFaint,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:"0.25rem",marginBottom:"0.1rem"}}>Tomorrow</div>}
                        {tmrReminders.map(function(n){
                          return (
                            <div key={n.id} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.45rem 0.6rem",background:T.surface,borderRadius:"0.65rem",border:"1px solid "+T.blue+"25"}}>
                              <span style={{fontSize:"0.85rem",flexShrink:0}}>☀️</span>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:"0.82rem",fontWeight:600,color:T.textDark,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.entityTitle}</div>
                                {n.time&&<div style={{fontSize:"0.7rem",color:T.blue,fontWeight:700}}>{fmtTime(n.time)}</div>}
                                {n.note&&<div style={{fontSize:"0.71rem",color:T.textSoft,marginTop:"0.1rem"}}>{n.note}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Close My Day button */}
                <button onClick={()=>setShowEndOfDay(true)} style={{...btnP("linear-gradient(135deg,"+T.blue+","+T.sage+")",{width:"100%",padding:"0.9rem",fontSize:"0.95rem",borderRadius:"1rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.45rem"})}}>
                  Close My Day 🌙
                </button>
              </>
            )}
          </div>
        )}

      </div>
    );
  }

  // ── Calendar Tab ────────────────────────────────────────────────────────────
  _hfRenders.CalendarTab = function CalendarTab() {
    const year=calViewDate.getFullYear(), month=calViewDate.getMonth();
    const daysInMonth=getDaysInMonth(year,month);
    const firstDay=getFirstDayOfMonth(year,month);
    function eventsForDay(d,m2,y2){
      const mm=m2!==undefined?m2:month,yy=y2!==undefined?y2:year;
      return calEvents.filter(e=>{
        if(!e.date)return false;
        const ed=new Date(e.date+"T00:00:00");
        const baseMatch=ed.getDate()===d&&ed.getMonth()===mm&&ed.getFullYear()===yy;
        if(baseMatch)return true;
        if(!e.repeat)return false;
        // Don't show recurring before the original date
        const targetDate=new Date(yy,mm,d);
        if(targetDate<ed)return false;
        if(e.repeat==="weekly")return ed.getDay()===targetDate.getDay();
        if(e.repeat==="biweekly"){const diffDays=Math.round((targetDate-ed)/(86400000));return ed.getDay()===targetDate.getDay()&&diffDays%14===0;}
        if(e.repeat==="monthly")return ed.getDate()===d;
        if(e.repeat==="yearly")return ed.getDate()===d&&ed.getMonth()===mm;
        if(e.repeat==="dates"&&Array.isArray(e.repeatDates))return e.repeatDates.includes(d);
        return false;
      }).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
    }
    function getWeekDates(ref){var d=new Date(ref);var day=d.getDay();d.setDate(d.getDate()-day);return Array.from({length:7},function(_,i){var nd=new Date(d);nd.setDate(d.getDate()+i);return nd;});}
    const weekDates=getWeekDates(calViewDate);
    function navPrev(){if(calView==="month")setCalViewDate(new Date(year,month-1,1));else if(calView==="week"){const d=new Date(calViewDate);d.setDate(d.getDate()-7);setCalViewDate(d);}else{const d=new Date(calViewDate);d.setDate(d.getDate()-1);setCalViewDate(d);}}
    function navNext(){if(calView==="month")setCalViewDate(new Date(year,month+1,1));else if(calView==="week"){const d=new Date(calViewDate);d.setDate(d.getDate()+7);setCalViewDate(d);}else{const d=new Date(calViewDate);d.setDate(d.getDate()+1);setCalViewDate(d);}}
    function navTitle(){if(calView==="month")return calViewDate.toLocaleDateString("en-US",{month:"long",year:"numeric"});if(calView==="week"){const wk=getWeekDates(calViewDate);return `${wk[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${wk[6].toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;}return calViewDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});}
    function isToday(d){return d.getDate()===TODAY.getDate()&&d.getMonth()===TODAY.getMonth()&&d.getFullYear()===TODAY.getFullYear();}
    const EventDot=({e})=>(<div style={{background:e.color+"28",border:`1px solid ${e.color}55`,borderRadius:"0.25rem",padding:"1px 4px",marginBottom:"2px",fontSize:"0.62rem",fontWeight:700,color:e.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.time&&`${e.time} `}{e.title}</div>);
    const [showCalNotif,setShowCalNotif]=useState(null);
    const [cnd,setCnd]=useState(""); const [cnt,setCnt]=useState(""); const [cnn,setCnn]=useState("");
    return (
      <div>
        <SecHead emoji="📆" title="Calendar" sub="All your events in one place" onBack={function(){goTab("anchor");}}/>
        {/* Google Calendar connect banner */}
        <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.5rem"}}>
          <button onClick={()=>openAddEvent("")} style={{...btnP(T.blue,{display:"flex",alignItems:"center",gap:"0.4rem",flex:1,justifyContent:"center",padding:"0.72rem",fontSize:"0.88rem",borderRadius:"0.9rem"})}}>
            <Icon name="plus" size={15} color="#fff"/> Add Event
          </button>
          <button onClick={()=>setModal("calSync")} style={{...btnS({display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.72rem 0.9rem",fontSize:"0.82rem",borderRadius:"0.9rem",background:connectedCals.includes("google")?T.sagePale:T.bgAlt,borderColor:connectedCals.includes("google")?T.sage+"60":T.border,color:connectedCals.includes("google")?T.sageDark:T.textMid})}}>
            <Icon name="google" size={14}/>
            {connectedCals.includes("google")?"Synced":"Connect Google"}
          </button>
        </div>
        <div style={{fontSize:"0.72rem",color:T.textFaint,marginBottom:"0.75rem",textAlign:"center",fontStyle:"italic"}}>
          More calendar sources syncing soon — Apple, Outlook & more.
        </div>
        <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.85rem",background:T.bgAlt,borderRadius:"0.8rem",padding:"0.3rem",border:`1px solid ${T.border}`}}>
          {["month","week","day"].map(v=>(
            <button key={v} onClick={()=>{
              setCalView(v);
              if(v==="week"&&selectedDay) setCalViewDate(new Date(selectedDay));
              else if(v==="day") setCalViewDate(selectedDay?new Date(selectedDay):new Date(TODAY));
            }} style={{flex:1,background:calView===v?T.blue:"transparent",color:calView===v?"#fff":T.textMid,border:"none",borderRadius:"0.55rem",padding:"0.42rem 0.5rem",cursor:"pointer",fontSize:"0.78rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s",textTransform:"capitalize"}}>{v}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:"0.3rem",marginBottom:"0.65rem",justifyContent:"center"}}>
          {[["all","All"],["mine","Mine"],["twy","Twy’s"]].map(function(item){
            var _fv=item[0],_fl=item[1];
            return (
              <button key={_fv} onClick={function(){setCalFilter(_fv);}} style={{padding:"0.22rem 0.8rem",borderRadius:"50px",border:"1.5px solid "+(calFilter===_fv?"rgba(30,58,95,0.4)":"rgba(30,58,95,0.12)"),background:calFilter===_fv?"rgba(30,58,95,0.08)":"transparent",color:calFilter===_fv?"#1e3a5f":"#7a8a9a",fontSize:"0.7rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.12s"}}>
                {_fl}
              </button>
            );
          })}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem",padding:"0 0.15rem"}}>
          <button onClick={navPrev} style={{background:T.bgAlt,border:`1px solid ${T.border}`,cursor:"pointer",padding:7,display:"flex",borderRadius:"50%"}}><Icon name="chevL" size={18} color={T.textMid}/></button>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.25rem"}}>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.05rem",color:T.textDark,textAlign:"center"}}>{navTitle()}</span>
            {calView==="month"&&(
              <div style={{display:"flex",gap:"0.3rem"}}>
                <button onClick={()=>setCalViewDate(new Date(year-1,month,1))} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"0.4rem",cursor:"pointer",padding:"1px 8px",fontSize:"0.68rem",color:T.textFaint,fontFamily:"inherit",fontWeight:700}}>‹ {year-1}</button>
                <button onClick={()=>setCalViewDate(new Date(year+1,month,1))} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"0.4rem",cursor:"pointer",padding:"1px 8px",fontSize:"0.68rem",color:T.textFaint,fontFamily:"inherit",fontWeight:700}}>{year+1} ›</button>
              </div>
            )}
          </div>
          <button onClick={navNext} style={{background:T.bgAlt,border:`1px solid ${T.border}`,cursor:"pointer",padding:7,display:"flex",borderRadius:"50%"}}><Icon name="chevR" size={18} color={T.textMid}/></button>
        </div>
        {calView==="month"&&(
          <div style={{...card({padding:"0",overflow:"hidden",borderRadius:"1.1rem"})}}>
            {/* Day headers */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:T.bgAlt,borderBottom:`1px solid ${T.borderSoft}`}}>
              {WEEKDAYS_SUN.map(d=>(
                <div key={d} style={{textAlign:"center",padding:"0.45rem 0",fontSize:"0.65rem",fontWeight:800,color:T.textSoft,letterSpacing:"0.05em"}}>{d}</div>
              ))}
            </div>
            {/* Calendar grid — fixed row heights */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
              {Array.from({length:firstDay}).map((_,i)=>(
                <div key={`e${i}`} style={{height:88,borderRight:`1px solid ${T.borderSoft}`,borderBottom:`1px solid ${T.borderSoft}`,background:T.bgAlt+"80"}}/>
              ))}
              {Array.from({length:daysInMonth}).map((_,i)=>{
                const day=i+1;
                const todayFlag=day===TODAY.getDate()&&month===TODAY.getMonth()&&year===TODAY.getFullYear();
                const dayEvts=eventsForDay(day);
                const thisDate=new Date(year,month,day);
                const isSelected=selectedDay&&selectedDay.getDate()===day&&selectedDay.getMonth()===month&&selectedDay.getFullYear()===year;
                const isLastCol=(firstDay+i)%7===6;
                return (
                  <div key={day} onClick={function(){var d=isSelected?null:thisDate;setSelectedDay(d);if(d)setCalViewDate(new Date(d));}}
                    style={{height:88,padding:"0.22rem 0.2rem",borderRight:isLastCol?"none":`1px solid ${T.borderSoft}`,borderBottom:`1px solid ${T.borderSoft}`,background:isSelected?T.sandPale:todayFlag?T.bluePale:T.surface,cursor:"pointer",transition:"background 0.1s",overflow:"hidden",display:"flex",flexDirection:"column",gap:"1px"}}>
                    {/* Date number + marker button */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:todayFlag?T.blue:"transparent",color:todayFlag?"#fff":T.textDark,fontSize:"0.75rem",fontWeight:todayFlag?800:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginBottom:"1px"}}>{day}</div>
                      <button onClick={function(ev){ev.stopPropagation();setMarkerPickerDate(localDateStr(thisDate));}} style={{background:"none",border:"none",fontSize:"0.6rem",color:T.textFaint,cursor:"pointer",padding:"0 2px",opacity:0.6}} title="Add marker">•</button>
                    </div>
                    {/* Events — show up to 2, then +N more */}
                    {dayEvts.slice(0,2).map(function(e){
                      var _pc=getPersonColor(e.forPerson);
                      var _dimmed=(calFilter==="mine"&&e.responsibleParent!=="L")||(calFilter==="twy"&&e.responsibleParent!=="T");
                      return (
                        <div key={e.id} style={{background:e.forPerson?_pc.bg:(e.color+"28"),borderLeft:"2.5px solid "+(e.forPerson?_pc.border:e.color),borderRadius:"0 3px 3px 0",padding:"1px 3px",fontSize:"0.58rem",fontWeight:700,color:e.forPerson?_pc.text:e.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.4,opacity:_dimmed?0.25:1,display:"flex",alignItems:"center"}}>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",minWidth:0}}>{e.time&&<span style={{opacity:0.8,marginRight:2}}>{e.time}</span>}{e.title}</span>
                          {e.responsibleParent&&<span style={{marginLeft:2,fontSize:"6px",fontWeight:800,flexShrink:0,opacity:0.85}}>{e.responsibleParent}</span>}
                        </div>
                      );
                    })}
                    {dayEvts.length>2&&(
                      <div style={{fontSize:"0.56rem",color:T.textSoft,fontWeight:700,paddingLeft:"0.2rem"}}>+{dayEvts.length-2} more</div>
                    )}
                    {/* Emoji markers + work-type icon */}
                    {(calMarkers[localDateStr(thisDate)]&&calMarkers[localDateStr(thisDate)].length>0||workDays[localDateStr(thisDate)])&&(
                      <div style={{display:"flex",gap:"2px",flexWrap:"wrap",marginTop:"auto",lineHeight:1,alignItems:"center"}}>
                        {(calMarkers[localDateStr(thisDate)]||[]).map(function(em,mi){
                          return <span key={mi} style={{fontSize:"0.62rem"}}>{em}</span>;
                        })}
                        {workDays[localDateStr(thisDate)]&&(function(){
                          var _wde=workDays[localDateStr(thisDate)];
                          var _wdIcons={wfh:"🏠",office:"🏢",travel:"✈️",off:"☀️"};
                          var _wdBg={wfh:"#e0f5f1",office:"#e3eef7",travel:"#fdf3dc",off:"#faeae3"};
                          var _wdCol={wfh:"#1a6657",office:"#1c4a6e",travel:"#7a5a10",off:"#8a3820"};
                          return (<span key="wdi" style={{fontSize:"0.6rem",background:_wdBg[_wde.type]||"#f0ede8",color:_wdCol[_wde.type]||"#4a3e36",borderRadius:"2px",padding:"0 1px",lineHeight:"14px",display:"inline-flex",alignItems:"center"}}>{_wdIcons[_wde.type]||"💼"}</span>);
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Marker picker popover */}
            {markerPickerDate&&(
              <div onClick={function(){setMarkerPickerDate(null);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
                <div onClick={function(e){e.stopPropagation();}} style={{background:T.surface,borderRadius:"1rem",padding:"1.1rem 1.2rem",maxWidth:340,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.18)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.85rem"}}>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.05rem",color:T.textDark}}>{new Date(markerPickerDate+"T00:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</span>
                    <button onClick={function(){setMarkerPickerDate(null);}} style={{background:"none",border:"none",fontSize:"1.1rem",cursor:"pointer",color:T.textSoft}}>×</button>
                  </div>
                  <div style={{fontSize:"0.66rem",color:T.textSoft,marginBottom:"0.6rem",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:700}}>Tap to add or remove</div>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
                    {calMarkerTypes.map(function(mt,ti){
                      var active=(calMarkers[markerPickerDate]||[]).indexOf(mt.emoji)!==-1;
                      return (
                        <div key={ti} onClick={function(){toggleCalMarker(markerPickerDate,mt.emoji);}} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.5rem 0.7rem",borderRadius:"0.6rem",cursor:"pointer",background:active?T.bluePale:T.bgAlt,border:"1px solid "+(active?T.blue:T.borderSoft)}}>
                          <span style={{fontSize:"1.1rem"}}>{mt.emoji}</span>
                          <span style={{flex:1,fontSize:"0.82rem",color:T.textDark,fontWeight:active?700:500}}>{mt.label}</span>
                          {active&&<span style={{fontSize:"0.72rem",color:T.blue,fontWeight:700}}>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {calView==="week"&&(
          <div style={{...card({padding:"0",overflow:"hidden"})}}>
            {WEEKDAYS_SUN.map((dn,i)=>{
              const d=weekDates[i],todayFlag=isToday(d),dayEvts=eventsForDay(d.getDate(),d.getMonth(),d.getFullYear());
              return (
                <div key={dn} onClick={()=>{setCalViewDate(d);setCalView("day");}} style={{display:"flex",alignItems:"flex-start",borderBottom:i<6?`1px solid ${T.borderSoft}`:"none",cursor:"pointer",background:todayFlag?T.bluePale:"transparent",padding:"0.55rem 0.85rem",gap:"0.85rem"}}>
                  <div style={{width:44,flexShrink:0,textAlign:"center"}}>
                    <div style={{fontSize:"0.62rem",fontWeight:800,color:todayFlag?T.blueDark:T.textSoft,letterSpacing:"0.08em",textTransform:"uppercase"}}>{dn}</div>
                    <div style={{width:28,height:28,borderRadius:"50%",background:todayFlag?T.blue:"transparent",display:"flex",alignItems:"center",justifyContent:"center",margin:"0.2rem auto 0",fontSize:"0.88rem",fontWeight:700,color:todayFlag?"#fff":T.textDark}}>{d.getDate()}</div>
                  </div>
                  <div style={{flex:1,minWidth:0,paddingTop:"0.2rem"}}>
                    {dayEvts.length===0
                      ?<div style={{fontSize:"0.75rem",color:T.textFaint,fontStyle:"italic",padding:"0.4rem 0"}}>No events</div>
                      :dayEvts.map(function(e){
                          var _pc=getPersonColor(e.forPerson);
                          var _dimmed=(calFilter==="mine"&&e.responsibleParent!=="L")||(calFilter==="twy"&&e.responsibleParent!=="T");
                          var _bg=e.forPerson?_pc.bg:(e.color||T.blue);
                          var _col=e.forPerson?_pc.text:"#fff";
                          return (<div key={e.id} style={{background:_bg,borderLeft:e.forPerson?("2.5px solid "+_pc.border):undefined,borderRadius:"0.4rem",padding:"0.22rem 0.55rem",marginBottom:"0.25rem",fontSize:"0.75rem",color:_col,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",opacity:_dimmed?0.25:1}}>{e.time?e.time+" ":""}{e.title}</div>);
                        })
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {calView==="day"&&(
          <div style={{...card()}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.85rem"}}>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.05rem",color:T.textDark}}>{calViewDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</span>
              <button onClick={()=>openAddEvent(localDateStr(calViewDate))} style={{...btnP(T.blue,{fontSize:"0.76rem",padding:"0.32rem 0.75rem",display:"flex",alignItems:"center",gap:"0.35rem"})}}><Icon name="plus" size={13} color="#fff"/> Add</button>
            </div>
            {(function(){
              var _isoDate=localDateStr(calViewDate);
              var _wde=workDays[_isoDate];
              var _WD_ICONS={wfh:"🏠",office:"🏢",travel:"✈️",off:"☀️"};
              var _WD_LABELS={wfh:"Working from home",office:"In the office",travel:"Traveling",off:"PTO / off"};
              var _WD_BG={wfh:"#e0f5f1",office:"#e3eef7",travel:"#fdf3dc",off:"#faeae3"};
              var _WD_COL={wfh:"#1a6657",office:"#1c4a6e",travel:"#7a5a10",off:"#8a3820"};
              var _WD_BORDER={wfh:"#3aaa91",office:"#4a7fa8",travel:"#d4a240",off:"#d4704a"};
              function _fmtH(h){var a=h<12?"am":"pm";var hh=h%12||12;return hh+a;}
              function _openForm(){
                var _def=_wde?{type:_wde.type,startHour:_wde.startHour||9,endHour:_wde.endHour||17,location:_wde.location||"",note:_wde.note||""}:{type:"wfh",startHour:9,endHour:17,location:"",note:""};
                setWorkDayForm(Object.assign({},_def,{open:true}));
              }
              function _saveEntry(){
                var _upd=Object.assign({},workDays);
                _upd[_isoDate]={type:workDayForm.type,startHour:workDayForm.startHour,endHour:workDayForm.endHour,location:workDayForm.location,note:workDayForm.note};
                saveWorkDays(_upd);
                setWorkDays(_upd);
                markKeyDirty("workDays");
                try { window.dispatchEvent(new CustomEvent("af-data-changed")); } catch(e) {}
                setWorkDayForm(function(p){return Object.assign({},p,{open:false});});
              }
              function _removeEntry(){
                var _upd=Object.assign({},workDays);
                delete _upd[_isoDate];
                saveWorkDays(_upd);
                setWorkDays(_upd);
                markKeyDirty("workDays");
                try { window.dispatchEvent(new CustomEvent("af-data-changed")); } catch(e) {}
                setWorkDayForm(function(p){return Object.assign({},p,{open:false});});
              }
              var _stripBg=_wde?(_WD_BG[_wde.type]||"rgba(30,58,95,0.06)"):"rgba(30,58,95,0.03)";
              var _stripBorder=_wde?(_WD_BORDER[_wde.type]||"rgba(30,58,95,0.18)"):"rgba(30,58,95,0.12)";
              var _stripCol=_wde?(_WD_COL[_wde.type]||"#4a3e36"):T.textFaint;
              return (
                <div style={{marginBottom:"0.75rem"}}>
                  <div onClick={_openForm} style={{background:_stripBg,borderLeft:"3px solid "+_stripBorder,borderRadius:"0 0.35rem 0.35rem 0",padding:"0.32rem 0.7rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.45rem",minHeight:"1.8rem"}}>
                    {_wde?(
                      <span style={{fontSize:"0.68rem",fontWeight:700,color:_stripCol,flex:1,display:"flex",alignItems:"center",gap:"0.3rem",flexWrap:"wrap"}}>
                        <span style={{fontSize:"0.8rem"}}>{_WD_ICONS[_wde.type]||"💼"}</span>
                        <span>{_WD_LABELS[_wde.type]||_wde.type}</span>
                        {_wde.location?<span style={{fontWeight:500,opacity:0.75}}>· {_wde.location}</span>:null}
                        {_wde.type!=="off"?<span style={{fontWeight:500,opacity:0.75}}>· {_fmtH(_wde.startHour||9)}–{_fmtH(_wde.endHour||17)}</span>:null}
                      </span>
                    ):(
                      <span style={{fontSize:"0.68rem",color:T.textFaint,fontWeight:600}}>+ Log work day</span>
                    )}
                    {_wde&&<span style={{fontSize:"0.68rem",color:_stripCol,opacity:0.55,flexShrink:0}}>✏</span>}
                  </div>
                  {_wde&&_wde.note?<div style={{fontSize:"0.67rem",color:T.textSoft,fontStyle:"italic",paddingLeft:"0.75rem",marginTop:"0.15rem"}}>{_wde.note}</div>:null}
                  {workDayForm.open&&(
                    <div style={{background:T.bgAlt,border:"1px solid "+T.border,borderRadius:"0.65rem",padding:"0.85rem 0.9rem",marginTop:"0.4rem"}}>
                      <div style={{display:"flex",gap:"0.3rem",marginBottom:"0.7rem"}}>
                        {[["wfh","🏠","WFH"],["office","🏢","Office"],["travel","✈️","Travel"],["off","☀️","PTO"]].map(function(it){
                          var _t=it[0],_i=it[1],_l=it[2];
                          var _a=workDayForm.type===_t;
                          return (
                            <button key={_t} onClick={function(){setWorkDayForm(function(p){return Object.assign({},p,{type:_t});});}} style={{flex:1,padding:"0.35rem 0.15rem",borderRadius:"0.45rem",border:"1.5px solid "+(_a?_WD_BORDER[_t]:T.border),background:_a?_WD_BG[_t]:"transparent",color:_a?_WD_COL[_t]:T.textMid,fontSize:"0.65rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.12rem"}}>
                              <span style={{fontSize:"0.9rem"}}>{_i}</span>{_l}
                            </button>
                          );
                        })}
                      </div>
                      {workDayForm.type!=="off"&&(
                        <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.55rem"}}>
                          <span style={{fontSize:"0.7rem",fontWeight:700,color:T.textMid,whiteSpace:"nowrap"}}>Hours</span>
                          <div style={{flex:1}}>
                            <select value={workDayForm.startHour} onChange={function(ev){setWorkDayForm(function(p){return Object.assign({},p,{startHour:parseInt(ev.target.value,10)});});}} style={inp({padding:"0.3rem 0.4rem",fontSize:"0.75rem",width:"100%"})}>
                              {Array.from({length:24},function(_x,i){return i;}).filter(function(i){return i<workDayForm.endHour;}).map(function(i){return <option key={i} value={i}>{_fmtH(i)}</option>;})}
                            </select>
                          </div>
                          <span style={{fontSize:"0.72rem",color:T.textMid,flexShrink:0}}>to</span>
                          <div style={{flex:1}}>
                            <select value={workDayForm.endHour} onChange={function(ev){setWorkDayForm(function(p){return Object.assign({},p,{endHour:parseInt(ev.target.value,10)});});}} style={inp({padding:"0.3rem 0.4rem",fontSize:"0.75rem",width:"100%"})}>
                              {Array.from({length:24},function(_x,i){return i;}).filter(function(i){return i>workDayForm.startHour;}).map(function(i){return <option key={i} value={i}>{_fmtH(i)}</option>;})}
                            </select>
                          </div>
                        </div>
                      )}
                      <input value={workDayForm.location} onChange={function(ev){setWorkDayForm(function(p){return Object.assign({},p,{location:ev.target.value});});}} placeholder="Location (optional)" style={{...inp({marginBottom:"0.45rem",padding:"0.32rem 0.5rem",fontSize:"0.75rem"})}}/>
                      <input value={workDayForm.note} onChange={function(ev){setWorkDayForm(function(p){return Object.assign({},p,{note:ev.target.value});});}} placeholder="Note (optional)" style={{...inp({marginBottom:"0.6rem",padding:"0.32rem 0.5rem",fontSize:"0.75rem"})}}/>
                      <div style={{display:"flex",gap:"0.4rem",justifyContent:"flex-end"}}>
                        {_wde&&<button onClick={_removeEntry} style={{...btnS({fontSize:"0.72rem",padding:"0.3rem 0.65rem",color:T.rose})}}>Remove</button>}
                        <button onClick={function(){setWorkDayForm(function(p){return Object.assign({},p,{open:false});});}} style={btnS({fontSize:"0.72rem",padding:"0.3rem 0.65rem"})}>Cancel</button>
                        <button onClick={_saveEntry} style={btnP(T.blue,{fontSize:"0.72rem",padding:"0.3rem 0.75rem"})}>Save</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            {eventsForDay(calViewDate.getDate(),calViewDate.getMonth(),calViewDate.getFullYear()).length===0&&<p style={{color:T.textFaint,fontSize:"0.83rem",fontWeight:600,textAlign:"center",padding:"1rem 0"}}>No events — enjoy the open space 🌿</p>}
            {eventsForDay(calViewDate.getDate(),calViewDate.getMonth(),calViewDate.getFullYear()).map(function(e){
              var _pc=getPersonColor(e.forPerson);
              var _dotColor=e.forPerson?_pc.border:e.color;
              var _dimmed=(calFilter==="mine"&&e.responsibleParent!=="L")||(calFilter==="twy"&&e.responsibleParent!=="T");
              return (
              <div key={e.id} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.7rem 0",borderBottom:`1px solid ${T.borderSoft}`,opacity:_dimmed?0.25:1}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.18rem",flexShrink:0,minWidth:44}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:_dotColor,marginTop:3}}/>
                  {e.time?<span style={{fontSize:"0.74rem",fontWeight:800,color:_dotColor}}>{e.time}</span>:<span style={{fontSize:"0.68rem",color:T.textFaint,fontWeight:600}}>all day</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.9rem",display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"}}>
                    <span>{e.title}</span>
                    {e.responsibleParent&&<div style={{width:16,height:16,borderRadius:"50%",background:"rgba(255,255,255,0.85)",fontSize:"9px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(0,0,0,0.1)",color:"#1e3a5f",flexShrink:0}}>{e.responsibleParent}</div>}
                  </div>
                  {e.forPerson&&<div style={{fontSize:"0.66rem",color:_pc.text,fontWeight:700,marginTop:"0.1rem"}}>for {e.forPerson}</div>}
                  {e.colorLabel&&!e.forPerson&&<div style={{fontSize:"0.66rem",color:e.color,fontWeight:700,marginTop:"0.1rem"}}>{calColorLabels[e.color]||(e.colorCustom||"").trim()||e.colorLabel}</div>}
                  {e.note&&<div style={{color:T.textMid,fontSize:"0.78rem",marginTop:"0.28rem",fontStyle:"italic"}}>📝 {e.note}</div>}
                  {notifications.some(function(n){return n.entityId===e.id;})&&<div style={{color:T.sand,fontSize:"0.72rem",fontWeight:600,marginTop:"0.2rem"}}>🔔 Reminder set</div>}
                </div>
                <div style={{display:"flex",gap:"0.25rem",flexShrink:0}}>
                  <button onClick={()=>setShowCalNotif(showCalNotif===e.id?null:e.id)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="bell" size={13} color={T.sand}/></button>
                  <button onClick={()=>openEditEvent(e)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="edit" size={13} color={T.textMid}/></button>
                  <button onClick={()=>setCalEvents(p=>p.filter(x=>x.id!==e.id))} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
                </div>
              </div>
              );
            })}
            {showCalNotif&&(
              <div style={{background:T.bgAlt,border:`1px solid ${T.sand}50`,borderRadius:"0.8rem",padding:"0.85rem",marginTop:"0.5rem"}}>
                <p style={{fontSize:"0.75rem",fontWeight:700,color:T.sandDark,marginBottom:"0.6rem"}}>🔔 Set reminder</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.45rem",marginBottom:"0.45rem"}}>
                  <input type="date" value={cnd} onChange={e=>setCnd(e.target.value)} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
                  <input type="time" value={cnt} onChange={e=>setCnt(e.target.value)} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
                </div>
                <input value={cnn} onChange={e=>setCnn(e.target.value)} placeholder="Note…" style={{...inp({marginBottom:"0.5rem",padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}}/>
                <button onClick={function(){var ev=calEvents.find(function(e){return e.id===showCalNotif;});if(ev)addNotification(ev.id,ev.title,cnd,cnt,cnn);setShowCalNotif(null);}} style={btnP(T.sand,{fontSize:"0.76rem",padding:"0.35rem 0.75rem"})}>Set Reminder</button>
              </div>
            )}
          </div>
        )}
        {calView==="month"&&selectedDay&&!calFormMode&&(
          <div style={{...card({border:`2px solid ${T.sand}60`,background:`linear-gradient(to right,${T.sandPale},${T.surface})`})}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>{FORMAT_SHORT(selectedDay)}</span>
              <div style={{display:"flex",gap:"0.4rem"}}>
                <button onClick={()=>openAddEvent(localDateStr(selectedDay))} style={{...btnP(T.blue,{display:"flex",alignItems:"center",gap:"0.35rem",padding:"0.38rem 0.8rem",fontSize:"0.78rem",borderRadius:"0.65rem"})}}><Icon name="plus" size={13} color="#fff"/> Add Event</button>
                <button onClick={()=>setSelectedDay(null)} style={{...btnS({padding:"0.38rem 0.6rem",borderRadius:"0.65rem"})}}>✕</button>
              </div>
            </div>
            {eventsForDay(selectedDay.getDate()).length===0?<p style={{color:T.textFaint,fontSize:"0.83rem",fontWeight:600,textAlign:"center",padding:"0.5rem 0"}}>No events this day.</p>
            :eventsForDay(selectedDay.getDate()).map(function(e){
              var _pc=getPersonColor(e.forPerson);
              var _dotColor=e.forPerson?_pc.border:e.color;
              var _dimmed=(calFilter==="mine"&&e.responsibleParent!=="L")||(calFilter==="twy"&&e.responsibleParent!=="T");
              return (
              <div key={e.id} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.65rem 0",borderBottom:`1px solid ${T.borderSoft}`,opacity:_dimmed?0.25:1}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.18rem",flexShrink:0,minWidth:38}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:_dotColor,marginTop:3}}/>
                  <span style={{fontSize:"0.54rem",fontWeight:700,color:_dotColor,whiteSpace:"nowrap",textAlign:"center"}}>{e.forPerson?e.forPerson:(calColorLabels[e.color]||(e.colorCustom||"").trim()||e.colorLabel||"")}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem",display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"}}>
                    <span>{e.title}</span>
                    {e.responsibleParent&&<div style={{width:14,height:14,borderRadius:"50%",background:"rgba(255,255,255,0.85)",fontSize:"8px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(0,0,0,0.1)",color:"#1e3a5f",flexShrink:0}}>{e.responsibleParent}</div>}
                  </div>
                  {e.time&&<div style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500,marginTop:"0.1rem"}}>⏰ {e.time}</div>}
                  {e.note&&<div style={{color:T.textMid,fontSize:"0.79rem",marginTop:"0.35rem",lineHeight:1.5,fontStyle:"italic"}}>📝 {e.note}</div>}
                </div>
                <div style={{display:"flex",gap:"0.25rem",flexShrink:0}}>
                  <button onClick={()=>openEditEvent(e)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="edit" size={13} color={T.textMid}/></button>
                  <button onClick={()=>setCalEvents(p=>p.filter(x=>x.id!==e.id))} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
                </div>
              </div>
              );
            })}
          </div>
        )}
        {connectedCals.length===0&&(
          <div style={{...card({background:`linear-gradient(135deg,${T.bluePale},${T.lavPale})`,border:`2px solid ${T.blue}50`,textAlign:"center",padding:"1.5rem"})}}>
            <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📆</div>
            <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.textDark,marginBottom:"0.4rem"}}>Connect Your Calendars</h3>
            <p style={{color:T.textMid,fontSize:"0.83rem",fontWeight:500,marginBottom:"1rem",lineHeight:1.6}}>Sync Google, Apple, Outlook, or any iCal source.</p>
            <button onClick={()=>setModal("calSync")} style={{...btnP(T.blue,{display:"inline-flex",alignItems:"center",gap:"0.5rem"})}}><Icon name="link" size={15} color="#fff"/> Connect a Calendar</button>
          </div>
        )}
      </div>
    );
  }

  // ── Weekly Tab ──────────────────────────────────────────────────────────────
  _hfRenders.WeeklyTab = function WeeklyTab() {
    const [newTaskText,setNewTaskText]=useState("");
    const [taskDay,setTaskDay]=useState(TODAY_NAME);
    const [taskPerson,setTaskPerson]=useState("");
    const [editingDay,setEditingDay]=useState(null);
    const [editForm,setEditForm]=useState({theme:"",emoji:"",desc:""});
    const DAY_COLORS=[T.blue,T.sage,T.sand,T.rose,T.lavender,T.blue,T.sage];
    function openEditDay(day){setEditingDay(day);setEditForm({...rhythm[day]});}
    function saveEditDay(){setRhythm(p=>({...p,[editingDay]:{...editForm}}));setEditingDay(null);}
    function applyPreset(preset){if(preset.theme==="Custom"){setEditForm(p=>({...p,emoji:preset.emoji}));return;}setEditForm({theme:preset.theme,emoji:preset.emoji,desc:preset.desc});}

    // ── Cross-day drag state ────────────────────────────────────────────────
    const crossDrag = useRef({id:null, fromDay:null, clone:null, overDay:null, overId:null});
    const [cdDraggingId, setCdDraggingId] = useState(null);
    const [cdOverDay,    setCdOverDay]    = useState(null);
    const [cdOverId,     setCdOverId]     = useState(null);

    function cdPointerDown(e, taskId, fromDay) {
      if (e.button===1||e.button===2) return;
      const el = document.querySelector('[data-cdtask="'+taskId+'"]');
      crossDrag.current = {id:taskId, fromDay, clone:null, overDay:null, overId:null};
      if (el) {
        const rect = el.getBoundingClientRect();
        const clone = el.cloneNode(true);
        clone.querySelectorAll("button,input,select,textarea").forEach(function(c){c.style.pointerEvents="none";});
        clone.style.cssText = "position:fixed;left:"+rect.left+"px;top:"+rect.top+"px;width:"+rect.width+"px;opacity:0.88;pointer-events:none;z-index:9999;box-shadow:0 8px 28px rgba(0,0,0,0.22);border-radius:0.7rem;transition:none;background:white;";
        document.body.appendChild(clone);
        crossDrag.current.clone = clone;
      }
      setCdDraggingId(taskId);
      setCdOverDay(null);
      setCdOverId(null);
      e.preventDefault();
    }

    useEffect(function(){
      if (!cdDraggingId) return;
      function onMove(e) {
        var cd = crossDrag.current;
        if (!cd.id) return;
        if (cd.clone) {
          cd.clone.style.left = (e.clientX - cd.clone.offsetWidth/2)+"px";
          cd.clone.style.top  = (e.clientY - 28)+"px";
          cd.clone.style.display = "none";
        }
        var el = document.elementFromPoint(e.clientX, e.clientY);
        if (cd.clone) cd.clone.style.display = "";
        if (!el) return;
        var taskEl  = el.closest("[data-cdtask]");
        var dayEl   = el.closest("[data-cdday]");
        var newOverId  = taskEl  ? taskEl.getAttribute("data-cdtask")  : null;
        var newOverDay = dayEl   ? dayEl.getAttribute("data-cdday")    : null;
        if (newOverId === cd.id) { newOverId = null; }
        if (newOverDay !== cd.overDay || newOverId !== cd.overId) {
          cd.overDay = newOverDay;
          cd.overId  = newOverId;
          setCdOverDay(newOverDay);
          setCdOverId(newOverId);
        }
      }
      function onUp(e) {
        var cd = crossDrag.current;
        if (cd.clone) { try{cd.clone.remove();}catch{} cd.clone=null; }
        var fromId  = cd.id;
        var fromDay = cd.fromDay;
        var toDay   = cd.overDay;
        var toId    = cd.overId;
        crossDrag.current = {id:null,fromDay:null,clone:null,overDay:null,overId:null};
        setCdDraggingId(null); setCdOverDay(null); setCdOverId(null);
        if (!fromId) return;
        // Determine destination day — fall back to fromDay if dropped outside any day card
        var destDay = toDay || fromDay;
        // Apply the move
        if (destDay !== fromDay || toId) {
          setTasks(function(prev) {
            var arr = prev.slice();
            var fi = arr.findIndex(function(x){return x.id===fromId;});
            if (fi===-1) return prev;
            var moved = Object.assign({}, arr[fi], {day: destDay});
            arr.splice(fi, 1);
            if (toId && toId !== fromId) {
              var ti = arr.findIndex(function(x){return x.id===toId;});
              if (ti!==-1) { arr.splice(ti, 0, moved); } else { arr.push(moved); }
            } else {
              // Drop onto day header — append to end of that day
              var lastInDay = -1;
              arr.forEach(function(x,i){ if(x.day===destDay) lastInDay=i; });
              arr.splice(lastInDay+1, 0, moved);
            }
            return arr;
          });
          // Sync day change back to brain dump
          if (destDay !== fromDay) {
            setBrainItems(function(prev){
              return prev.map(function(b){
                if (b.linkedTaskId===fromId || b.scheduledDay===fromDay) {
                  // Only update brain items that are linked to this specific task
                  if (b.linkedTaskId===fromId) return Object.assign({},b,{scheduledDay:destDay});
                }
                return b;
              });
            });
          }
        }
      }
      window.addEventListener("pointermove", onMove, {passive:true});
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      return function(){
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cdDraggingId]);

    // Pre-compute glance data
    var glanceData = MEAL_DAYS.map(function(day,di){
      var todayIdx=TODAY.getDay();
      var mealIdx=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].indexOf(day);
      var diff=mealIdx-todayIdx;if(diff<0)diff+=7;
      var dayDate=new Date(TODAY);dayDate.setDate(dayDate.getDate()+diff);
      var dateStr=dayDate.getFullYear()+"-"+String(dayDate.getMonth()+1).padStart(2,"0")+"-"+String(dayDate.getDate()).padStart(2,"0");
      var dayEvents=calEvents.filter(function(e){return e.date===dateStr&&!e._birthday;});
      var dinner=(meals[day]||{}).dinner||"";
      var dayTasks=tasks.filter(function(t){return(t.day===day||t.day==="Daily")&&!t.archived&&!t.done;});
      var isBusy=dayEvents.length>=2;
      var noMeal=!dinner;
      var isToday=day===TODAY_NAME;
      var w=weatherData&&weatherData.find(function(d){return d.date===dateStr;});
      return{day:day,dateStr:dateStr,dayEvents:dayEvents,dinner:dinner,dayTasks:dayTasks,isBusy:isBusy,noMeal:noMeal,isToday:isToday,weather:w};
    });

    return (
      <div>
        <SecHead emoji="📅" title="Weekly Rhythm" sub="Your week at a glance" onBack={function(){goTab("anchor");}}/>
        {/* Subtab nav */}
        <div style={{display:"flex",gap:"0.35rem",marginBottom:"1rem",background:T.surface,borderRadius:"0.85rem",padding:"0.3rem"}}>
          {[{id:"glance",label:"Glance",emoji:"👁"},{id:"rhythm",label:"Day Themes",emoji:"🗓️"},{id:"tasks",label:"Task Board",emoji:"✅"}].map(function(st){
            return <button key={st.id} onClick={function(){setWeekSubTab(st.id);}} style={{flex:1,padding:"0.4rem 0.3rem",borderRadius:"0.6rem",border:"none",background:weekSubTab===st.id?T.white:"transparent",color:weekSubTab===st.id?T.textDark:T.textFaint,fontWeight:700,fontSize:"0.72rem",cursor:"pointer",fontFamily:"inherit",boxShadow:weekSubTab===st.id?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>{st.emoji} {st.label}</button>;
          })}
        </div>

        {/* Week Glance */}
        {weekSubTab==="glance"&&(
          <div style={card()}>
            {glanceData.map(function(g,i){
              return(
                <div key={g.day} style={{display:"grid",gridTemplateColumns:"60px 1fr",gap:"0.5rem",padding:"0.55rem 0.25rem",borderBottom:i<glanceData.length-1?"1px solid "+T.borderSoft:"none",alignItems:"start"}}>
                  <div>
                    <div style={{fontSize:"0.65rem",fontWeight:800,textTransform:"uppercase",color:g.isToday?T.blue:T.textFaint}}>{g.day.slice(0,3)}</div>
                    {g.isToday&&<div style={{fontSize:"0.58rem",fontWeight:700,color:T.blue}}>Today</div>}
                    {g.weather&&<div style={{fontSize:"0.72rem",marginTop:"2px"}}>{g.weather.emoji} {g.weather.high}°</div>}
                  </div>
                  <div>
                    {g.dayEvents.length===0?<span style={{fontSize:"0.75rem",color:T.textFaint,fontStyle:"italic"}}>Open</span>:g.dayEvents.slice(0,2).map(function(e,ei){return <div key={ei} style={{fontSize:"0.75rem",color:T.textDark,marginBottom:"0.12rem"}}>{"· "+e.title}</div>;})}
                    {g.dinner?<div style={{fontSize:"0.72rem",color:T.sage,marginTop:"0.15rem"}}>{"🍽 "+g.dinner}</div>:g.isBusy&&<div style={{fontSize:"0.72rem",color:T.rose,fontWeight:600,marginTop:"0.15rem"}}>⚠ No dinner set</div>}
                    {g.dayTasks.length>0&&<div style={{fontSize:"0.68rem",color:T.textFaint,marginTop:"0.1rem"}}>{g.dayTasks.length+" task"+(g.dayTasks.length!==1?"s":"")}</div>}
                  </div>
                </div>
              );
            })}
            {!weatherLocation&&(
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginTop:"0.75rem",padding:"0.5rem 0.75rem",background:T.bluePale,borderRadius:"0.75rem"}}>
                <span>🌤️</span>
                <span style={{fontSize:"0.75rem",color:T.textMid,flex:1}}>Add weather to your week</span>
                <button onClick={requestWeatherLocation} style={btnP(T.blue,{fontSize:"0.72rem",padding:"0.28rem 0.7rem"})}>Enable</button>
              </div>
            )}
          </div>
        )}

        {/* Task Board */}
        {weekSubTab==="tasks"&&(
          <div>
            {/* Add task */}
            <div style={{...card({background:T.bluePale,border:"2px solid "+T.blue+"55"})}}>
              <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                <input value={newTaskText} onChange={function(e){setNewTaskText(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"&&newTaskText.trim()){var nid=uid();setTasks(function(p){return[...p,{id:nid,text:newTaskText.trim(),day:taskDay,done:false,person:taskPerson,fromBoard:true}];});setBrainItems(function(p){return[...p,{id:uid(),text:newTaskText.trim(),cat:"uncategorized",done:false,scheduledDay:taskDay,assignedTo:taskPerson||null,linkedTaskId:nid}];});setNewTaskText("");}}} placeholder="Add a task…" style={{...inp({flex:1,minWidth:120})}}/>
                <select value={taskDay} onChange={function(e){setTaskDay(e.target.value);}} style={{...inp({width:"auto",flex:"none"})}}>
                  {[...MEAL_DAYS,"Daily"].map(function(d){return <option key={d} value={d}>{d}</option>;})}
                </select>
                <select value={taskPerson} onChange={function(e){setTaskPerson(e.target.value);}} style={{...inp({width:"auto",flex:"none"})}}>
                  <option value="">Anyone</option>
                  {people.map(function(p){return <option key={p.id} value={p.name}>{p.name}</option>;})}
                </select>
                <button onClick={function(){if(newTaskText.trim()){var nid=uid();setTasks(function(p){return[...p,{id:nid,text:newTaskText.trim(),day:taskDay,done:false,person:taskPerson,fromBoard:true}];});setBrainItems(function(p){return[...p,{id:uid(),text:newTaskText.trim(),cat:"uncategorized",done:false,scheduledDay:taskDay,assignedTo:taskPerson||null,linkedTaskId:nid}];});setNewTaskText("");}}} style={btnP(T.blue)}>Add</button>
              </div>
              {cdDraggingId&&<div style={{marginTop:"0.5rem",fontSize:"0.72rem",color:T.blue,fontWeight:600,display:"flex",alignItems:"center",gap:"0.4rem"}}><span>↕</span> Drag to a different day to move it there</div>}
            </div>

            {/* Day columns */}
            {[...MEAL_DAYS,"Daily"].map(function(day,di){
              var dayTasks=tasks.filter(function(t){return t.day===day&&!t.archived;});
              var dr=rhythm[day];var accent=DAY_COLORS[di%DAY_COLORS.length];
              var isDayDropTarget=cdOverDay===day&&!cdOverId;
              var linkedTaskIds=dayTasks.filter(function(t){return t.fromBrain||t.brainId;}).map(function(t){return t.brainId||t.linkedTaskId;});
              var brainQueued=brainItems.filter(function(b){return b.scheduledDay===day&&!b.done&&!linkedTaskIds.includes(b.id);});
              var hasContent=dayTasks.length>0||brainQueued.length>0;
              return (
                <div key={day} data-cdday={day}
                  style={{...card({borderLeft:"4px solid "+(day===TODAY_NAME?accent:isDayDropTarget?accent:T.borderSoft),background:isDayDropTarget?accent+"0A":undefined,transition:"background 0.15s,border-color 0.15s"})}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:hasContent?"0.75rem":"0.1rem"}}>
                    <span style={{fontSize:"1rem"}}>{(dr&&dr.emoji)||"📋"}</span>
                    <span style={{fontWeight:700,color:day===TODAY_NAME?accent:T.textDark,fontSize:"0.92rem"}}>{day}</span>
                    {dr&&dr.theme&&<span style={{color:T.textSoft,fontSize:"0.76rem",fontWeight:500}}>{"· "+dr.theme}</span>}
                    <div style={{flex:1}}/>
                    {brainQueued.length>0&&<span style={{fontSize:"0.62rem",fontWeight:700,color:T.lavender,background:T.lavender+"18",borderRadius:"2rem",padding:"1px 7px"}}>🧠 {brainQueued.length}</span>}
                    {day===TODAY_NAME&&<Pill label="Today" color={accent} tiny/>}
                    {day!=="Daily"&&<button onClick={function(){openEditDay(day);}} style={{background:"none",border:"1px solid "+T.border,borderRadius:"0.5rem",cursor:"pointer",padding:"2px 7px",fontSize:"0.7rem",color:T.textSoft,fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.3rem"}}><Icon name="edit" size={11} color={T.textSoft}/> Edit Day</button>}
                  </div>

                  {/* Tasks — cross-day draggable */}
                  {dayTasks.map(function(t){
                    var isBeingDragged = cdDraggingId===t.id;
                    var isDropTarget   = cdOverId===t.id;
                    return (
                      <div key={t.id} data-cdtask={t.id}
                        onPointerDown={function(e){if(e.target.closest("button,input,select,textarea,[role=button]"))return;cdPointerDown(e,t.id,day);}}
                        style={{cursor:"grab",opacity:isBeingDragged?0.3:1,borderRadius:"0.6rem",outline:isDropTarget?"2px dashed "+accent:"none",outlineOffset:"2px",transition:"opacity 0.15s"}}>
                        <TaskRow t={t} accent={accent} showNotifFor={null} setShowNotifFor={function(){}}
                          onToggle={function(id){setTasks(function(p){return p.map(function(x){return x.id===id?{...x,done:!x.done}:x;});});}}
                          onDelete={function(id){setTasks(function(p){return p.filter(function(x){return x.id!==id;});});}}
                          onSave={function(id,val){setTasks(function(p){return p.map(function(x){return x.id===id?{...x,text:val}:x;});});}}
                          onMoveDay={function(id,newDay){
                            setTasks(function(p){return p.map(function(x){return x.id===id?{...x,day:newDay}:x;});});
                            setBrainItems(function(p){return p.map(function(b){return b.linkedTaskId===id?{...b,scheduledDay:newDay}:b;});});
                          }}
                          allDays={[...MEAL_DAYS,"Daily"]}
                          currentDay={day}
                        />
                      </div>
                    );
                  })}

                  {dayTasks.length===0&&brainQueued.length===0&&(
                    <p style={{color:isDayDropTarget?accent:T.textFaint,fontSize:"0.77rem",fontWeight:isDayDropTarget?700:500,transition:"color 0.15s"}}>
                      {isDayDropTarget?"Drop here":"Nothing yet"}
                    </p>
                  )}

                  {/* Brain dump queue */}
                  {brainQueued.length>0&&(
                    <div style={{marginTop:dayTasks.length?"0.65rem":"0",padding:"0.55rem 0.65rem",background:T.lavender+"12",border:"1px dashed "+T.lavender+"55",borderRadius:"0.75rem"}}>
                      <div style={{fontSize:"0.62rem",fontWeight:800,color:T.lavender,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.35rem"}}>💭 Clear Your Mind</div>
                      {brainQueued.map(function(b){return(
                        <div key={b.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.25rem 0",borderBottom:"1px solid "+T.lavender+"20"}}>
                          <div style={{width:7,height:7,borderRadius:"50%",background:T.lavender,flexShrink:0}}/>
                          <span style={{fontSize:"0.8rem",color:T.textDark,flex:1,fontWeight:500}}>{b.text}</span>
                          <button title="Move to tasks" onClick={function(){var nid=uid();setTasks(function(p){return[...p,{id:nid,text:b.text,day:day,done:false,fromBrain:true,brainId:b.id}];});setBrainItems(function(p){return p.map(function(x){return x.id===b.id?{...x,scheduledDay:day,linkedTaskId:nid}:x;});});}} style={{background:accent,border:"none",borderRadius:"0.4rem",cursor:"pointer",padding:"2px 8px",fontSize:"0.65rem",color:"#fff",fontWeight:700,fontFamily:"inherit",flexShrink:0}}>+ Task</button>
                          <button title="Clear from this day" onClick={function(){setBrainItems(function(p){return p.map(function(x){return x.id===b.id?{...x,scheduledDay:null}:x;});});}} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:T.textFaint,padding:"0 2px",flexShrink:0}}>×</button>
                        </div>
                      );})}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Day Themes subtab */}
        {weekSubTab==="rhythm"&&(
          <div style={{...card({background:"linear-gradient(135deg,"+T.sandPale+","+T.lavPale+")",border:"1.5px solid "+T.sand+"55",padding:"0.85rem 1rem",marginBottom:"0.25rem"})}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
              <span style={{fontSize:"1.3rem"}}>🌊</span>
              <div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.05rem",fontWeight:700,color:T.textDark,lineHeight:1.3}}>Give each day a shape</div>
                <div style={{fontSize:"0.75rem",color:T.textMid,fontWeight:500,marginTop:"0.15rem"}}>When the week has a rhythm, the days run themselves.</div>
              </div>
            </div>
          </div>
        )}
        {weekSubTab==="rhythm"&&MEAL_DAYS.map(function(day,di){
          var dr=rhythm[day]||{};var accent=DAY_COLORS[di%DAY_COLORS.length];
          var dayTaskCount=tasks.filter(function(t){return t.day===day&&!t.done&&!t.archived;}).length;
          var dayBrainCount=brainItems.filter(function(b){return b.scheduledDay===day&&!b.done;}).length;
          var isToday=day===TODAY_NAME;
          return(
            <div key={day} style={{...card({borderLeft:"4px solid "+(isToday?accent:accent+"60"),background:isToday?T.white:T.surface})}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flex:1}}>
                  <span style={{fontSize:"1.2rem"}}>{dr.emoji||"📋"}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
                      <span style={{fontWeight:700,color:isToday?accent:T.textDark,fontSize:"0.9rem"}}>{day}</span>
                      {isToday&&<span style={{fontSize:"0.6rem",fontWeight:800,background:accent,color:"#fff",borderRadius:"2rem",padding:"1px 6px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Today</span>}
                    </div>
                    {dr.theme&&<div style={{fontSize:"0.75rem",color:T.textMid,fontWeight:500}}>{dr.theme}</div>}
                    {dr.desc&&<div style={{fontSize:"0.7rem",color:T.textFaint,fontStyle:"italic",marginTop:"0.1rem"}}>{dr.desc}</div>}
                    {(dayTaskCount>0||dayBrainCount>0)&&(
                      <div style={{display:"flex",gap:"0.5rem",marginTop:"0.35rem"}}>
                        {dayTaskCount>0&&<span style={{fontSize:"0.65rem",fontWeight:700,color:accent,background:accent+"18",borderRadius:"2rem",padding:"1px 7px"}}>✅ {dayTaskCount} task{dayTaskCount!==1?"s":""}</span>}
                        {dayBrainCount>0&&<span style={{fontSize:"0.65rem",fontWeight:700,color:T.lavender,background:T.lavender+"18",borderRadius:"2rem",padding:"1px 7px"}}>🧠 {dayBrainCount} queued</span>}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={function(){openEditDay(day);}} style={{background:"none",border:"1px solid "+T.border,borderRadius:"0.5rem",cursor:"pointer",padding:"2px 8px",fontSize:"0.7rem",color:T.textSoft,fontWeight:700,fontFamily:"inherit",flexShrink:0}}>Edit</button>
              </div>
            </div>
          );
        })}

        {editingDay&&(
          <ModalBox title={"Edit "+editingDay} onClose={function(){setEditingDay(null);}}>
            <div style={{marginBottom:"0.75rem"}}>
              <label style={lbl}>Quick Presets</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",marginBottom:"0.85rem"}}>
                {THEME_PRESETS.map(function(pr,i){return <button key={i} onClick={function(){applyPreset(pr);}} style={{background:editForm.theme===pr.theme?T.blue:T.white,color:editForm.theme===pr.theme?"#fff":T.textMid,border:"1.5px solid "+(editForm.theme===pr.theme?T.blue:T.border),borderRadius:"2rem",padding:"0.28rem 0.72rem",cursor:"pointer",fontSize:"0.75rem",fontFamily:"inherit",fontWeight:700}}>{pr.emoji} {pr.theme}</button>;})}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"64px 1fr",gap:"0.65rem",marginBottom:"0.9rem"}}>
              <div><label style={lbl}>Emoji</label><input defaultValue={editForm.emoji} onBlur={function(e){setEditForm(function(p){return{...p,emoji:e.target.value};});}} placeholder="🗓️" style={{...inp({textAlign:"center",fontSize:"1.2rem",padding:"0.5rem"})}}/></div>
              <div><label style={lbl}>Theme Name</label><input defaultValue={editForm.theme} onBlur={function(e){setEditForm(function(p){return{...p,theme:e.target.value};});}} placeholder="e.g. Batch Cook" style={inp()}/></div>
            </div>
            <div style={{marginBottom:"1rem"}}><label style={lbl}>Description</label><input defaultValue={editForm.desc} onBlur={function(e){setEditForm(function(p){return{...p,desc:e.target.value};});}} placeholder="What happens on this day…" style={inp()}/></div>
            <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
              <button onClick={function(){setEditingDay(null);}} style={btnS()}>Cancel</button>
              <button onClick={saveEditDay} style={btnP(T.sage)}>Save</button>
            </div>
          </ModalBox>
        )}
      </div>
    );
  }

  // ── Meals Tab ───────────────────────────────────────────────────────────────
  _hfRenders.MealBankDrawer = function MealBankDrawer({mealType, allBank, onApply, onAddToShopping}) {
    const [open,setOpen] = useState(false);
    const [search,setSearch] = useState("");
    const [selected,setSelected] = useState(null);
    const [checkedIngs,setCheckedIngs] = useState({});
    const [addedMsg,setAddedMsg] = useState(false);
    const filtered = allBank.filter(function(m){return !search||m.name.toLowerCase().includes(search.toLowerCase());});
    function handleSelect(meal) {
      setSelected(meal);
      setCheckedIngs({});
      setOpen(false);
      onApply(meal);
    }
    function toggleIng(i){ setCheckedIngs(function(p){return {...p,[i]:!p[i]};}); }
    function addChecked(){
      var ings = (selected.ingredients||[]);
      ings.forEach(function(ing,i){ if(checkedIngs[i]) onAddToShopping&&onAddToShopping(ing); });
      setAddedMsg(true);
      setTimeout(function(){setAddedMsg(false);},2000);
      setCheckedIngs({});
    }
    return (
      <div style={{position:"relative"}}>
        <button onClick={function(){setOpen(function(p){return !p;});setSearch("");}} style={{...btnS({fontSize:"0.72rem",padding:"0.28rem 0.6rem",display:"flex",alignItems:"center",gap:"0.3rem",background:open?T.sagePale:"",borderColor:open?T.sage:""})}}>📋 {selected?selected.name.split(" ").slice(0,2).join(" ")+"…":"Meal Bank"}</button>
        {open&&(
          <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:50,background:T.white,border:"1.5px solid "+T.border,borderRadius:"0.85rem",boxShadow:"0 4px 20px rgba(0,0,0,0.12)",width:"220px",overflow:"hidden"}}>
            <div style={{padding:"0.5rem 0.6rem",borderBottom:"1px solid "+T.borderSoft}}>
              <input value={search} onChange={function(e){setSearch(e.target.value);}} placeholder="Search meals…" style={{...inp({fontSize:"0.8rem",padding:"0.3rem 0.55rem"})}} autoFocus/>
            </div>
            <div style={{maxHeight:"180px",overflowY:"auto"}}>
              {filtered.length===0&&<div style={{padding:"0.75rem",fontSize:"0.8rem",color:T.textFaint,textAlign:"center",fontStyle:"italic"}}>No meals found</div>}
              {filtered.map(function(meal){return(
                <div key={meal.id} onClick={function(){handleSelect(meal);}} style={{padding:"0.5rem 0.75rem",fontSize:"0.83rem",color:T.textDark,cursor:"pointer",borderBottom:"1px solid "+T.borderSoft,display:"flex",justifyContent:"space-between",alignItems:"center"}}
                  onMouseEnter={function(e){e.currentTarget.style.background=T.bgAlt;}}
                  onMouseLeave={function(e){e.currentTarget.style.background="";}}>
                  <span>{meal.name}</span>
                  {(meal.ingredients||[]).length>0&&<span style={{fontSize:"0.65rem",color:T.textFaint}}>🥘</span>}
                </div>
              );})}
            </div>
          </div>
        )}
        {selected&&(selected.ingredients||[]).length>0&&(
          <div style={{marginTop:"0.5rem",background:T.sagePale,border:"1px solid "+T.sage+"40",borderRadius:"0.75rem",padding:"0.6rem 0.75rem"}}>
            <div style={{fontSize:"0.65rem",fontWeight:800,color:T.sageDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.35rem"}}>Check what you need to buy</div>
            {(selected.ingredients||[]).map(function(ing,i){return(
              <label key={i} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.25rem 0",cursor:"pointer",fontSize:"0.8rem",color:T.textDark}}>
                <input type="checkbox" checked={!!checkedIngs[i]} onChange={function(){toggleIng(i);}} style={{accentColor:T.sage,width:13,height:13}}/>
                {ing}
              </label>
            );})}
            <div style={{display:"flex",gap:"0.4rem",marginTop:"0.5rem"}}>
              <button onClick={addChecked} style={{...btnP(T.sage,{fontSize:"0.72rem",padding:"0.3rem 0.65rem"})}}>Add to shopping list</button>
              <button onClick={function(){setCheckedIngs(Object.fromEntries((selected.ingredients||[]).map(function(_,i){return[i,true];})));}} style={{...btnS({fontSize:"0.72rem",padding:"0.3rem 0.55rem"})}}>All</button>
              <button onClick={function(){setSelected(null);}} style={{...btnS({fontSize:"0.72rem",padding:"0.3rem 0.55rem"})}}>✕</button>
            </div>
            {addedMsg&&<div style={{fontSize:"0.72rem",color:T.sage,fontWeight:600,marginTop:"0.35rem"}}>✓ Added to shopping list</div>}
          </div>
        )}
      </div>
    );
  }

  _hfRenders.WeekTypePicker = function WeekTypePicker({weekTypeKey,applyWeekType,setShowWeekTypePicker,flowMode,dietaryFilters,setNextWeekMeals,setMeals,setMealSubTab,mealBankCustom,targetWeek,wtAiMeals,setWtAiMeals,wtSelected,setWtSelected}){
    var [wtAiLoading,setWtAiLoading]=useState(false);
    var [wtAiError,setWtAiError]=useState("");
    var isBusySurv=weekTypeKey==="busy"||weekTypeKey==="survival";
    var effortColor={none:T.rose,minimal:T.sand,easy:T.sage};

    async function suggestMealsForMode(){
      setWtAiLoading(true);setWtAiMeals(null);setWtAiError("");
      var modeDesc=weekTypeKey==="survival"
        ?"Survival mode — absolute minimum effort. Frozen meals, snack plates, paper plates, takeout, leftovers, cereal for dinner. Nothing that requires real cooking or cleanup."
        :"Busy week — quick-cook only. Under 30 min, minimal dishes. Crockpot ok. Leftovers encouraged. Pickup/takeout 1-2 nights is fine.";
      var dietInfo=dietaryFilters&&dietaryFilters.length>0?"Dietary needs: "+dietaryFilters.join(", "):"No dietary restrictions.";
      var bankNames=[...MEAL_BANK_DATA,...(mealBankCustom||[])].map(function(m){return m.name;}).join(", ");
      try{
        var r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          model:"claude-sonnet-4-6",max_tokens:700,
          system:"You are a practical family meal planner. Suggest 7 dinners (one per day Mon–Sun) for a "+weekTypeKey+" week. "+modeDesc+" "+dietInfo+" Available meal bank options: "+bankNames+". Prefer meal bank options when they fit. Also suggest 1-2 non-cooking nights (takeout, paper plates, etc). Respond ONLY as JSON: [{\"day\":\"Monday\",\"meal\":\"name\",\"note\":\"one short tip\",\"effort\":\"none|minimal|easy\"}]. No preamble.",
          messages:[{role:"user",content:"Suggest meals for my "+weekTypeKey+" week."}]
        })});
        var d=await r.json();
        var txt=(d.content?.find(function(b){return b.type==="text";})||{}).text||"[]";
        var parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());
        setWtAiMeals(parsed);
        setWtSelected(parsed.map(function(m){return m.day;}));
      }catch(e){setWtAiError("Couldn't get suggestions. Try again.");}
      setWtAiLoading(false);
    }

    function applyAiMeals(){
      if(!wtAiMeals)return;
      var toApply=wtAiMeals.filter(function(item){return wtSelected.includes(item.day);});
      if(targetWeek==="this"){
        setMeals(function(p){
          var nd={...p};
          toApply.forEach(function(item){
            if(item.day&&item.meal){nd[item.day]={...(nd[item.day]||{}),dinner:item.meal};}
          });
          return nd;
        });
        setMealSubTab("week");
      } else {
        setNextWeekMeals(function(p){
          var nd={...p};
          toApply.forEach(function(item){
            if(item.day&&item.meal){nd[item.day]={...(nd[item.day]||{}),dinner:item.meal};}
          });
          return nd;
        });
        setMealSubTab("nextweek");
      }
      setShowWeekTypePicker(false);
    }

    return(
      <div style={{...card({background:`linear-gradient(135deg,${T.sagePale},${T.bluePale})`,border:`2px solid ${T.sage}60`,padding:"1.1rem"})}}>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.05rem",fontWeight:700,color:T.textDark,marginBottom:"0.75rem"}}>What kind of week is it?</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.55rem",marginBottom:"0.65rem"}}>
          {Object.entries(WEEK_TYPE_PRESETS).map(function([key,wt]){return(
            <button key={key} onClick={function(){applyWeekType(key);setWtAiMeals(null);setWtSelected([]);setWtAiError("");}} style={{background:weekTypeKey===key?T.sage:T.white,color:weekTypeKey===key?"#fff":T.textDark,border:`2px solid ${weekTypeKey===key?T.sage:T.border}`,borderRadius:"0.9rem",padding:"0.75rem",cursor:"pointer",textAlign:"left",fontFamily:"inherit",transition:"all 0.15s"}}>
              <div style={{fontSize:"1.3rem",marginBottom:"0.25rem"}}>{wt.emoji}</div>
              <div style={{fontWeight:700,fontSize:"0.84rem"}}>{wt.label}</div>
              <div style={{fontSize:"0.72rem",color:weekTypeKey===key?"rgba(255,255,255,0.8)":T.textSoft,fontWeight:500,marginTop:"0.15rem"}}>{wt.desc}</div>
            </button>
          );})}
        </div>
        {isBusySurv&&(
          <div style={{borderTop:`1px solid ${T.borderSoft}`,paddingTop:"0.65rem"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.5rem"}}>
              <span style={{fontSize:"0.75rem",fontWeight:700,color:weekTypeKey==="survival"?T.rose:T.sandDark}}>{weekTypeKey==="survival"?"🛟 Survival meal ideas":"⚡ Busy week meal ideas"}</span>
              <button onClick={suggestMealsForMode} disabled={wtAiLoading} style={{...btnP(weekTypeKey==="survival"?T.rose:T.sand,{fontSize:"0.72rem",padding:"0.3rem 0.75rem",display:"flex",alignItems:"center",gap:"0.3rem",opacity:wtAiLoading?0.6:1})}}>
                {wtAiLoading?"Thinking…":"✨ Suggest meals"}
              </button>
            </div>
            {wtAiError&&<p style={{fontSize:"0.75rem",color:T.rose,fontWeight:600,margin:"0 0 0.4rem"}}>{wtAiError}</p>}
            {wtAiMeals&&(
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.35rem"}}>
                  <span style={{fontSize:"0.7rem",color:T.textSoft,fontWeight:600}}>Tap to select</span>
                  <div style={{display:"flex",gap:"0.4rem"}}>
                    <button onClick={()=>setWtSelected(wtAiMeals.map(function(m){return m.day;}))} style={{fontSize:"0.67rem",background:"none",border:`1px solid ${T.border}`,borderRadius:"2rem",padding:"2px 8px",cursor:"pointer",fontFamily:"inherit",color:T.textMid}}>All</button>
                    <button onClick={()=>setWtSelected([])} style={{fontSize:"0.67rem",background:"none",border:`1px solid ${T.border}`,borderRadius:"2rem",padding:"2px 8px",cursor:"pointer",fontFamily:"inherit",color:T.textMid}}>None</button>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"0.3rem",marginBottom:"0.6rem"}}>
                  {wtAiMeals.map(function(item,i){
                    var ec=effortColor[item.effort]||T.textSoft;
                    var sel=wtSelected.includes(item.day);
                    return(
                      <div key={i} onClick={()=>setWtSelected(function(p){return sel?p.filter(function(d){return d!==item.day;}):[...p,item.day];})} style={{display:"flex",alignItems:"flex-start",gap:"0.5rem",background:sel?T.sagePale:T.white,borderRadius:"0.55rem",padding:"0.4rem 0.6rem",border:`1.5px solid ${sel?T.sage:T.borderSoft}`,cursor:"pointer",transition:"all 0.12s"}}>
                        <div style={{width:16,height:16,borderRadius:"0.25rem",border:`2px solid ${sel?T.sage:T.border}`,background:sel?T.sage:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>
                          {sel&&<span style={{color:"#fff",fontSize:"0.65rem",lineHeight:1}}>✓</span>}
                        </div>
                        <span style={{fontSize:"0.72rem",fontWeight:800,color:T.textFaint,width:28,flexShrink:0}}>{item.day&&item.day.slice(0,3)}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:"0.82rem",fontWeight:700,color:T.textDark}}>{item.meal}</div>
                          {item.note&&<div style={{fontSize:"0.68rem",color:T.textSoft,marginTop:"1px"}}>{item.note}</div>}
                        </div>
                        <span style={{fontSize:"0.62rem",fontWeight:700,color:ec,background:ec+"18",borderRadius:"2rem",padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap"}}>{item.effort}</span>
                      </div>
                    );
                  })}
                </div>
                <button onClick={applyAiMeals} disabled={wtSelected.length===0} style={{...btnP(weekTypeKey==="survival"?T.rose:T.sage,{width:"100%",justifyContent:"center",display:"flex",fontSize:"0.8rem",padding:"0.5rem",opacity:wtSelected.length===0?0.4:1})}}>
                  → Load {wtSelected.length} meal{wtSelected.length!==1?"s":""} into {targetWeek==="this"?"This Week":"Next Week"}
                </button>
              </div>
            )}
          </div>
        )}
        <button onClick={()=>setShowWeekTypePicker(false)} style={{...btnS({width:"100%",marginTop:"0.65rem",fontSize:"0.76rem"})}}>Close</button>
      </div>
    );
  }

  _hfRenders.MealsTab = function MealsTab() {
    const [editDay,setEditDay]=useState(null);
    const [editMeal,setEditMeal]=useState({});
    const [swapDay,setSwapDay]=useState(null);
    const [showRecipes,setShowRecipes]=useState(false);
    const [recipeAZ,setRecipeAZ]=useState(false);
    const [editingThemes,setEditingThemes]=useState(false);
    const [mealSubTab,setMealSubTab]=useSaved("mealSubTab","week");
    const addIngredientToShopping = useCallback((ing)=>setShoppingItems(p=>[...p,{id:Date.now().toString(),text:ing,done:false,store:"Grocery Store",category:"grocery"}]),[]);
    const [nextWeekMeals,setNextWeekMeals]=useSaved("nextWeekMeals",{});
    const [nextWeekMealCount,setNextWeekMealCount]=useSaved("af_nwMealCount",1);
    var nwMealsToShow = nextWeekMealCount===1?["dinner"]:nextWeekMealCount===2?["lunch","dinner"]:["breakfast","lunch","dinner"];
    const [showDietaryOptions,setShowDietaryOptions]=useState(false);
    const [bankFilters,setBankFilters]=useState([]);
    const [selectedBankMeal,setSelectedBankMeal]=useState(null);
    const [bankInnerTab,setBankInnerTab]=useState("meals");
    const [showAddToBank,setShowAddToBank]=useState(false);
    const [newBankMeal,setNewBankMeal]=useState({name:"",tags:[],notes:""});
    const [addToBankMealName,setAddToBankMealName]=useState("");
    const [prepChecked,setPrepChecked]=useState([]);
    const [prepAiTips,setPrepAiTips]=useState(null);
    const [prepAiLoading,setPrepAiLoading]=useState(false);
    const [prepAiError,setPrepAiError]=useState("");
    const [rescueInput,setRescueInput]=useState("");
    const [rescueResults,setRescueResults]=useState(null);
    const [rescueLoading,setRescueLoading]=useState(false);
    const [rescueError,setRescueError]=useState(null);

    const tonightMealName=(meals[TODAY_NAME]||{}).dinner;
    const tonightMealData=MEAL_BANK_DATA.find(m=>m.name.toLowerCase()===(tonightMealName||"").toLowerCase());

    const weekMealNames=MEAL_DAYS.map(d=>(meals[d]||{}).dinner).filter(Boolean);
    function getSmartPrepTasks(mealNames) {
      const tasks = [];
      const mn = mealNames.map(n=>(n||"").toLowerCase());
      const has = (...words) => words.some(w => mn.some(n => n.includes(w)));
      // Always useful
      tasks.push({id:"wash-fruit",     text:"Wash and store all fresh fruit",                          emoji:"🍓"});
      tasks.push({id:"slice-snacks",   text:"Prep veggie snack containers (carrots, celery, cucumber)", emoji:"🥕"});
      tasks.push({id:"boil-eggs",      text:"Hard boil 6 eggs — easy snacks + lunch add-ons",           emoji:"🥚"});
      tasks.push({id:"chop-garlic",    text:"Mince a full head of garlic, store in olive oil",           emoji:"🧄"});
      // Meal-specific
      if(has("chicken"))              tasks.push({id:"season-chicken", text:"Season or marinate chicken for the week",               emoji:"🍗"});
      if(has("rice","bowl","fried"))  tasks.push({id:"cook-rice",     text:"Cook a big batch of rice (stays good 4 days)",           emoji:"🍚"});
      if(has("pasta","spaghetti","noodle")) tasks.push({id:"cook-pasta", text:"Boil pasta, toss with olive oil and refrigerate",    emoji:"🍝"});
      if(has("taco","fajita","burrito"))   tasks.push({id:"prep-taco",  text:"Dice onion + jalapeño for taco nights, jar and fridge",emoji:"🌮"});
      if(has("salmon","fish","tilapia","cod")) tasks.push({id:"thaw-fish", text:"Move fish to fridge night before each fish dinner", emoji:"🐟"});
      if(has("bean","lentil","chickpea"))  tasks.push({id:"drain-beans", text:"Drain and rinse canned beans, store ready to use",   emoji:"🫘"});
      if(has("soup","stew","chili","slow cook","pulled")) tasks.push({id:"chop-soup", text:"Chop veg for soups/stews (onion, celery, carrots), bag together", emoji:"🥣"});
      if(has("salad","bowl","wrap","lunch")) tasks.push({id:"wash-greens", text:"Wash and spin salad greens, store in damp paper towel", emoji:"🥗"});
      if(mn.length === 0) {
        tasks.push({id:"stock-pantry",  text:"Check pantry staples — stock olive oil, canned tomatoes, pasta", emoji:"🫙"});
        tasks.push({id:"freeze-extras", text:"Portion and freeze any proteins before they expire",               emoji:"🧊"});
      }
      return tasks;
    }
    const activePrepTasks = getSmartPrepTasks(weekMealNames);

    function openEdit(day){setEditDay(day);setEditMeal(meals[day]||{});}
   function saveEdit(){
      const clean = {};
      Object.entries(editMeal).forEach(([k,v]) => {
        if (k === "groceryItems") { clean[k] = v; return; }
        clean[k] = v == null ? "" : String(v);
      });
      if (editMeal.groceryItems && editMeal.groceryItems.length > 0) {
        setShoppingItems(p=>[...p,...editMeal.groceryItems.map(g=>({id:Date.now().toString()+Math.random(),text:g,done:false,store:"Grocery Store",category:"grocery"}))]);
      }
      setMeals(p=>({...p,[editDay]:clean}));
      setEditDay(null);
    }
    function rotateMeals(){var days=MEAL_DAYS.slice();var cur=Object.assign({},meals);var rotated={};days.forEach(function(day,i){var prev=days[(i-1+days.length)%days.length];rotated[day]=Object.assign({},cur[prev]);});setMeals(rotated);}
    function applyWeekType(key){
      const preset=WEEK_TYPE_PRESETS[key];if(!preset)return;
      setWeekTypeKey(key);
      if(key==="busy"||key==="survival"){
        // Don't overwrite meals — just show AI suggestions
        return;
      }
      setMeals(function(p){var next=Object.assign({},p);Object.entries(preset.meals).forEach(function(entry){var day=entry[0];var m=entry[1];next[day]=Object.assign({},next[day]||{},m);});return next;});
      setShowWeekTypePicker(false);
    }

    const allBankMeals=[...MEAL_BANK_DATA,...mealBankCustom.map(m=>({...m,isCustom:true}))].slice().sort(function(a,b){return a.name.localeCompare(b.name);});const filteredBank=bankFilters.length===0?allBankMeals:allBankMeals.filter(m=>bankFilters.every(f=>(m.tags||[]).includes(f)));

    async function findRescueMeals(){
      if(!rescueInput.trim())return;
      setRescueLoading(true);setRescueResults(null);setRescueError(null);
      try{
        const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          model:"claude-sonnet-4-6",max_tokens:800,
          system:`You are a helpful family meal assistant. Given ingredients on hand, suggest 3 simple family-friendly dinners.
Respond ONLY with a valid JSON array, no markdown, no explanation, nothing else.
Format: [{"name":"Meal Name","desc":"1-2 sentence description of how to make it"}]
Always return exactly 3 meals. Use only the ingredients provided plus assumed pantry staples (oil, salt, pepper, water).`,
          messages:[{role:"user",content:`I have: ${rescueInput}. What can I make for dinner tonight? Reply with only the JSON array.`}]
        })});
        if(!r.ok){
          const errText=await r.text();
          AF_DEBUG && console.error("[AF] Rescue API error:", r.status); // errText omitted: may contain API response data
          setRescueError("API error "+r.status+". Please try again.");
          setRescueLoading(false);return;
        }
        const d=await r.json();
        const txt=(d.content?.find(b=>b.type==="text")?.text||"").trim();
        if(!txt){setRescueError("No response from AI. Please try again.");setRescueLoading(false);return;}
        // Extract JSON array robustly — find the first [ ... ] block
        const match=txt.match(/\[[\s\S]*\]/);
        if(!match){AF_DEBUG&&console.error("[AF] Rescue: no JSON array in response (dev only)");setRescueError("Unexpected response. Please try again.");setRescueLoading(false);return;}
        const parsed=JSON.parse(match[0]);
        if(!Array.isArray(parsed)||parsed.length===0){setRescueError("No meals found. Try listing a few more ingredients.");setRescueLoading(false);return;}
        setRescueResults(parsed);
      }catch(e){
        AF_DEBUG && console.error("[AF] Rescue meal error (dev only)");
        setRescueError("Something went wrong. Check your connection and try again.");
        setRescueResults(null);
      }
      setRescueLoading(false);
    }

    const subTabs=[{id:"week",label:"This Week",emoji:"📆"},{id:"nextweek",label:"Next Week",emoji:"🗓️"},{id:"month",label:"Month",emoji:"📅"},{id:"prep",label:"Prep",emoji:"🫙"},{id:"rescue",label:"SOS",emoji:"🆘"},{id:"bank",label:"Meal Bank",emoji:"📋"}];

    return (
      <div>
        <SecHead emoji="🍽️" title="Meal Rhythm" sub="Simple meals for full weeks"
          onBack={function(){goTab("anchor");}}
          action={<button onClick={()=>setShowWeekTypePicker(v=>!v)} style={btnP(weekTypeKey?T.sage:T.blue,{fontSize:"0.74rem",padding:"0.32rem 0.75rem"})}>
            {weekTypeKey?`${WEEK_TYPE_PRESETS[weekTypeKey].emoji} ${WEEK_TYPE_PRESETS[weekTypeKey].label}`:"✨ Week Type"}
          </button>}/>

        {showWeekTypePicker&&<WeekTypePicker weekTypeKey={weekTypeKey} applyWeekType={applyWeekType} setShowWeekTypePicker={setShowWeekTypePicker} flowMode={flowMode} dietaryFilters={dietaryFilters} setNextWeekMeals={setNextWeekMeals} setMeals={setMeals} setMealSubTab={setMealSubTab} mealBankCustom={mealBankCustom} targetWeek={mealSubTab==="week"?"this":"next"} wtAiMeals={wtAiMeals} setWtAiMeals={setWtAiMeals} wtSelected={wtSelected} setWtSelected={setWtSelected}/>}

        <ScrollTabs style={{marginBottom:"0.85rem",background:T.bgAlt,borderRadius:"0.8rem",padding:"0.28rem",border:`1px solid ${T.border}`}}>
          {subTabs.map(st=>(
            <button key={st.id} onClick={()=>setMealSubTab(st.id)} style={{flexShrink:0,background:mealSubTab===st.id?T.sage:"transparent",color:mealSubTab===st.id?"#fff":T.textMid,border:"none",borderRadius:"0.55rem",padding:"0.4rem 0.55rem",cursor:"pointer",fontSize:"0.73rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"0.3rem",justifyContent:"center"}}>
              {st.emoji} {st.label}
            </button>
          ))}
        </ScrollTabs>

        {mealSubTab==="week"&&(
          <div>
            <div style={{...card({padding:"0.85rem 1rem",background:T.sagePale,border:`2px solid ${T.sage}50`,marginBottom:"0.85rem"})}}>
              <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginBottom:"0.6rem"}}>
                {[{v:1,label:"Dinner Only"},{v:2,label:"Lunch + Dinner"},{v:3,label:"All 3 Meals"}].map(o=>(
                  <button key={o.v} onClick={()=>setMealCount(o.v)} style={{background:mealCount===o.v?T.sage:T.white,color:mealCount===o.v?"#fff":T.textMid,border:`2px solid ${mealCount===o.v?T.sage:T.border}`,borderRadius:"2rem",padding:"0.28rem 0.82rem",cursor:"pointer",fontSize:"0.74rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{o.label}</button>
                ))}
              </div>

              <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",alignItems:"center"}}>
                <button onClick={()=>setShowRecipes(v=>!v)} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.55rem",display:"flex",alignItems:"center",gap:"0.25rem"})}><Icon name="recipe" size={11} color={T.textMid}/> Recipes ({recipes.length})</button>
              </div>
            </div>
            {showRecipes&&(
              <div style={{...card({border:`2px solid ${T.sand}50`,background:`linear-gradient(135deg,${T.sandPale},${T.surface})`})}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.05rem",color:T.textDark}}>My Recipes</span>
                  <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
                    {recipes.length>1&&<button onClick={()=>setRecipeAZ(v=>!v)} style={btnS({fontSize:"0.7rem",padding:"0.24rem 0.55rem"})}>{recipeAZ?"A–Z ✓":"A–Z"}</button>}
                    <button onClick={()=>setShowRecipeImport(true)} style={btnP(T.sand,{fontSize:"0.74rem",padding:"0.28rem 0.7rem"})}>+ Import</button>
                  </div>
                </div>
                {recipes.length===0&&<p style={{color:T.textFaint,fontSize:"0.8rem",fontWeight:600,textAlign:"center"}}>No recipes yet — import from a URL or add manually.</p>}
                {(recipeAZ?recipes.slice().sort(function(a,b){return (a.name||"").localeCompare(b.name||"");}):recipes).map(r=>(
                  <div key={r.id} style={{padding:"0.65rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontWeight:700,color:T.textDark,fontSize:"0.87rem"}}>{r.name}</div>
                        <div style={{color:T.textSoft,fontSize:"0.72rem",marginTop:"0.1rem"}}>{r.servings&&`${r.servings} servings · `}{r.time&&`${r.time} · `}{r.source&&`from ${r.source}`}</div>
                        {Array.isArray(r.ingredients)&&r.ingredients.length>0&&<div style={{color:T.textMid,fontSize:"0.71rem",marginTop:"0.22rem"}}>{r.ingredients.slice(0,3).join(", ")}{r.ingredients.length>3?` +${r.ingredients.length-3} more`:""}</div>}
                      </div>
                      <button onClick={()=>setRecipes(p=>p.filter(x=>x.id!==r.id))} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><Icon name="trash" size={12} color={T.textFaint}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {swapDay&&(
              <div style={{background:T.sand+"22",border:"2px dashed "+T.sand,borderRadius:"0.9rem",padding:"0.65rem 1rem",marginBottom:"0.75rem",display:"flex",alignItems:"center",gap:"0.6rem",flexWrap:"wrap"}}>
                <span style={{fontSize:"0.85rem"}}>🔄</span>
                <span style={{fontSize:"0.82rem",fontWeight:700,color:T.sandDark,flex:1}}>Swapping <strong>{swapDay}</strong> with… tap another day</span>
                <button onClick={()=>setSwapDay(null)} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:"0.85rem",fontWeight:700,padding:"2px 6px",fontFamily:"inherit"}}>Cancel</button>
              </div>
            )}
            {MEAL_DAYS.map(day=>{
              const m=meals[day]||{};const isToday=day===TODAY_NAME;const themeDay=mealThemes[day];
              const bankMatch=MEAL_BANK_DATA.find(b=>b.name.toLowerCase()===(m.dinner||"").toLowerCase());
              const isSwapSource=swapDay===day;
              const isSwapTarget=swapDay&&swapDay!==day;
              return (
                <div key={day} onClick={isSwapTarget?function(){setMeals(function(p){var n=Object.assign({},p);var tmp=n[swapDay]||{};n[swapDay]=n[day]||{};n[day]=tmp;return n;});setSwapDay(null);}:undefined}
                  style={{...card({borderLeft:`4px solid ${isSwapSource?T.sand:isToday?T.sage:T.borderSoft}`,background:isSwapSource?`linear-gradient(to right,${T.sandPale},${T.surface})`:isSwapTarget?"linear-gradient(to right,"+T.sand+"18,"+T.surface+")":isToday?`linear-gradient(to right,${T.sagePale},${T.surface})`:T.surface,cursor:isSwapTarget?"pointer":"default",outline:isSwapTarget?"2px dashed "+T.sand+"80":"none",outlineOffset:"-2px"})}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.65rem"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,color:isSwapSource?T.sandDark:isToday?T.sageDark:T.textDark,fontSize:"0.93rem"}}>{day}</span>
                      {isToday&&!isSwapSource&&<Pill label="Today" color={T.sage} tiny/>}
                      {isSwapSource&&<Pill label="Swapping…" color={T.sand} tiny/>}
                      {isSwapTarget&&<span style={{fontSize:"0.66rem",fontWeight:700,color:T.sand,background:T.sandPale,borderRadius:"2rem",padding:"2px 8px"}}>tap to swap</span>}
                      {mealThemeEnabled&&themeDay&&!isSwapSource&&!isSwapTarget&&<span style={{fontSize:"0.66rem",fontWeight:700,color:T.sand,background:T.sandPale,borderRadius:"2rem",padding:"2px 8px",border:`1px solid ${T.sand}35`}}>{themeDay.emoji} {themeDay.theme}</span>}
                    </div>
                    <div style={{display:"flex",gap:"0.35rem"}}>
                      {!swapDay&&isToday&&m.dinner&&<button onClick={()=>setMealSubTab("tonight")} style={btnP(T.sage,{fontSize:"0.7rem",padding:"0.26rem 0.6rem"})}>🌙 Tonight</button>}
                      {!swapDay&&<button onClick={function(e){e.stopPropagation();openEdit(day);}} style={btnS({padding:"0.28rem 0.7rem",fontSize:"0.74rem",display:"flex",alignItems:"center",gap:"0.25rem"})}><Icon name="edit" size={11} color={T.textMid}/> Edit</button>}
                      <button onClick={function(e){e.stopPropagation();setSwapDay(isSwapSource?null:day);}} title="Swap this day" style={{...btnS({padding:"0.28rem 0.55rem",display:"flex",alignItems:"center"}),background:isSwapSource?T.sand:"transparent",borderColor:isSwapSource?T.sand:T.border}}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 5h10M2 5l3-3M2 5l3 3M14 11H4M14 11l-3-3M14 11l-3 3" stroke={isSwapSource?"#fff":T.textMid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:`repeat(${MEALS_TO_SHOW.length},1fr)`,gap:"0.45rem"}}>
                    {MEALS_TO_SHOW.map(meal=>(
                      <div key={meal} style={{background:T.white,borderRadius:"0.65rem",padding:MEALS_TO_SHOW.length===3?"0.4rem 0.45rem":"0.58rem 0.7rem",border:`1.5px solid ${T.borderSoft}`}}>
                        <div style={{fontSize:MEALS_TO_SHOW.length===3?"0.55rem":"0.6rem",color:T.textMid,textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:800,marginBottom:"0.15rem"}}>{meal}</div>
                        <div style={{fontSize:MEALS_TO_SHOW.length===3?"0.75rem":"0.82rem",color:m[meal]?T.textDark:T.textFaint,fontWeight:m[meal]?700:400,marginBottom:"0.25rem",lineHeight:1.3}}>{m[meal]||"—"}</div>
                        <MealBankDrawer mealType={meal} allBank={[...MEAL_BANK_DATA,...mealBankCustom].slice().sort(function(a,b){return a.name.localeCompare(b.name);})} onApply={function(mb){setMeals(function(p){var nd={...p};nd[day]={...(p[day]||{})};nd[day][meal]=mb.name;return nd;});}} onAddToShopping={addIngredientToShopping}/>
                      </div>
                    ))}
                  </div>
                  {bankMatch&&(
                    <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginTop:"0.55rem",alignItems:"center"}}>
                      <span style={{fontSize:"0.65rem",color:T.textSoft,fontWeight:600}}>⏱ {bankMatch.time} min · 🧹 {bankMatch.cleanup}</span>
                      {(bankMatch.tags||[]).slice(0,3).map(function(tag){var tf=MEAL_TAG_FILTERS.find(function(t){return t.id===tag;});return tf?React.createElement("span",{key:tag,style:{fontSize:"0.62rem",color:T.sage,background:T.sagePale,borderRadius:"2rem",padding:"1px 7px",fontWeight:600,border:"1px solid "+T.sage+"30"}},tf.emoji+" "+tf.label):null;})}
                    </div>
                  )}
                  {m.notes&&<div style={{marginTop:"0.5rem",fontSize:"0.77rem",color:T.textMid,fontStyle:"italic"}}>📝 {m.notes}</div>}
                </div>
              );
            })}
          </div>
        )}

        {mealSubTab==="nextweek"&&(
          <div>
            <div style={{...card({background:`linear-gradient(135deg,${T.bluePale},${T.lavPale})`,border:`2px solid ${T.blue}55`,padding:"1rem 1.1rem",marginBottom:"0.85rem"})}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.2rem",fontWeight:700,color:T.textDark,marginBottom:"0.35rem"}}>🗓️ Plan Next Week</div>
              <p style={{color:T.textSoft,fontSize:"0.8rem",marginBottom:"0.75rem",lineHeight:1.55}}>Fill in your meals ahead of time. Hit "Apply" when ready to load them into This Week.</p>
              <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginBottom:"0.7rem"}}>
                {[{v:1,label:"Dinner Only"},{v:2,label:"Lunch + Dinner"},{v:3,label:"All 3 Meals"}].map(o=>(
                  <button key={o.v} onClick={()=>setNextWeekMealCount(o.v)} style={{background:nextWeekMealCount===o.v?T.blue:T.white,color:nextWeekMealCount===o.v?"#fff":T.textMid,border:`2px solid ${nextWeekMealCount===o.v?T.blue:T.border}`,borderRadius:"2rem",padding:"0.28rem 0.82rem",cursor:"pointer",fontSize:"0.74rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{o.label}</button>
                ))}
              </div>
                </div>
            {MEAL_DAYS.map(function(day){
              var m=nextWeekMeals[day]||{};
              return (
                <div key={day} style={{...card({borderLeft:"4px solid "+T.blue+"50"})}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.93rem",marginBottom:"0.65rem"}}>{day}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat("+nwMealsToShow.length+",1fr)",gap:"0.45rem",marginBottom:"0.55rem"}}>
                    {nwMealsToShow.map(function(meal){return(
                      <div key={meal} style={{background:T.white,borderRadius:"0.65rem",padding:"0.58rem 0.7rem",border:"1.5px solid "+T.borderSoft}}>
                        <div style={{fontSize:"0.6rem",color:T.textMid,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:800,marginBottom:"0.22rem"}}>{meal}</div>
                        <input key={day+meal} defaultValue={m[meal]||""} onBlur={function(e){var v=e.target.value;setNextWeekMeals(function(p){var nd={...p};nd[day]={...(p[day]||{})};nd[day][meal]=v;return nd;});}} placeholder="—" style={{...inp({padding:"0.28rem 0.45rem",fontSize:"0.8rem",border:"none",background:"transparent",width:"100%"})}}/>
                        <div style={{marginTop:"0.35rem"}}>
                          <MealBankDrawer key={meal} mealType={meal} allBank={[...MEAL_BANK_DATA,...mealBankCustom].slice().sort(function(a,b){return a.name.localeCompare(b.name);})} onApply={function(mb){setNextWeekMeals(function(p){var nd={...p};nd[day]={...(p[day]||{})};nd[day][meal]=mb.name;return nd;});}} onAddToShopping={addIngredientToShopping}/>
                        </div>
                      </div>
                    );})}
                  </div>
                </div>
              );
            })}
            <button onClick={()=>{
              setMeals(prev=>{
                const next={...prev};
                Object.entries(nextWeekMeals).forEach(([day,m])=>{if(m&&Object.keys(m).length>0)next[day]={...(next[day]||{}),...m};});
                return next;
              });
              setNextWeekMeals({});
              setMealSubTab("week");
            }} style={{...btnP(T.blue,{width:"100%",padding:"0.85rem",fontSize:"0.9rem",marginTop:"0.5rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem"})}}>
              ✓ Apply as This Week's Meals
            </button>
          </div>
        )}
        {mealSubTab==="month"&&(function(){
          var BMONTHS2=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          var WEEK_LABELS=["Week 1","Week 2","Week 3","Week 4"];
          var monthKey="af_monthMeals";
          function getMonthMeals(){try{return JSON.parse(localStorage.getItem(monthKey)||"{}");}catch{return{};}}
          function saveMonthMeals(d){try{localStorage.setItem(monthKey,JSON.stringify(d));}catch{} markKeyDirty("monthMeals");}
          var monthMeals=getMonthMeals();
          return(
            <div>
              <div style={{...card({background:"linear-gradient(135deg,"+T.lavPale||T.bluePale+","+T.surface+")",border:"2px solid "+T.blue+"40",padding:"1rem 1.1rem",marginBottom:"0.85rem"})}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.2rem",fontWeight:700,color:T.textDark,marginBottom:"0.2rem"}}>📅 Monthly Meal Plan</div>
                <p style={{color:T.textSoft,fontSize:"0.8rem",lineHeight:1.5,margin:0}}>Plan dinners across four weeks. Hit Load Week to pull any week into your current plan.</p>
              </div>
              {WEEK_LABELS.map(function(wLabel,wi){
                return(
                  <div key={wi} style={{marginBottom:"1rem"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.45rem"}}>
                      <span style={{fontSize:"0.75rem",fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textMid}}>{wLabel}</span>
                      <button onClick={function(){
                        setMeals(function(prev){
                          var next={...prev};
                          MEAL_DAYS.forEach(function(day){
                            var val=monthMeals["w"+(wi+1)+"_"+day];
                            if(val)next[day]={...(next[day]||{}),dinner:val};
                          });
                          return next;
                        });
                        setMealSubTab("week");
                      }} style={btnP(T.sage,{fontSize:"0.7rem",padding:"0.25rem 0.7rem"})}>Load Week</button>
                    </div>
                    <div style={card({padding:"0.5rem 0.75rem"})}>
                      {MEAL_DAYS.map(function(day){
                        var k="w"+(wi+1)+"_"+day;
                        return(
                          <div key={day} style={{display:"grid",gridTemplateColumns:"70px 1fr auto",gap:"0.5rem",alignItems:"center",padding:"0.28rem 0",borderBottom:"1px solid "+T.borderSoft}}>
                            <span style={{fontSize:"0.72rem",fontWeight:700,color:T.textFaint}}>{day.slice(0,3)}</span>
                            <input defaultValue={monthMeals[k]||""} onBlur={function(e){var d=getMonthMeals();d[k]=e.target.value;saveMonthMeals(d);}} placeholder="Dinner…" style={{...inp({padding:"0.28rem 0.5rem",fontSize:"0.8rem",border:"none",background:"transparent",width:"100%"})}}/>
                            <MealBankDrawer mealType="dinner" allBank={[...MEAL_BANK_DATA,...mealBankCustom].slice().sort(function(a,b){return a.name.localeCompare(b.name);})} onApply={function(mb){var d=getMonthMeals();d[k]=mb.name;saveMonthMeals(d);}} onAddToShopping={addIngredientToShopping}/>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {mealSubTab==="grocery"&&(function(){
          var weekMeals=MEAL_DAYS.map(function(day){
            var mealObj=meals[day]||{};
            var dinnerName=mealObj.dinner||"";
            var bankMatch=MEAL_BANK_DATA.find(function(b){return b.name.toLowerCase()===(dinnerName).toLowerCase();});
            return{day:day,dinner:dinnerName,ingredients:bankMatch?bankMatch.ingredients:[],isToday:day===TODAY_NAME};
          }).filter(function(d){return d.dinner;});
          function inList(ing){return shoppingItems.some(function(s){return s.text.toLowerCase()===ing.toLowerCase();});}
          function addIng(ing){if(!inList(ing))setShoppingItems(function(p){return[...p,{id:uid(),text:ing,store:"Grocery Store",done:false}];});}
          function addAll(ings){ings.forEach(function(ing){if(!inList(ing))setShoppingItems(function(p){return[...p,{id:uid(),text:ing,store:"Grocery Store",done:false}];});});}
          return(
            <div>
              <div style={{...card({background:"linear-gradient(135deg,"+T.sagePale+","+T.surface+")",border:"2px solid "+T.sage+"50",padding:"1rem 1.1rem",marginBottom:"0.85rem"})}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.2rem",fontWeight:700,color:T.textDark,marginBottom:"0.2rem"}}>🛒 Meals → Grocery</div>
                <p style={{color:T.textSoft,fontSize:"0.8rem",lineHeight:1.5,margin:0}}>Tap ingredients to add to your shopping list, or add everything at once.</p>
              </div>
              {weekMeals.length===0?(
                <div style={{...card({textAlign:"center",padding:"2rem"})}}>
                  <p style={{color:T.textFaint,fontSize:"0.85rem"}}>No meals planned this week yet.</p>
                  <button onClick={function(){setMealSubTab("week");}} style={btnP(T.sage,{marginTop:"0.75rem",fontSize:"0.8rem"})}>Plan this week</button>
                </div>
              ):weekMeals.map(function(d){
                return(
                  <div key={d.day} style={{...card({marginBottom:"0.65rem"})}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.5rem"}}>
                      <div>
                        <div style={{fontSize:"0.65rem",fontWeight:800,textTransform:"uppercase",color:d.isToday?T.sage:T.textFaint,letterSpacing:"0.06em"}}>{d.day}{d.isToday?" · Tonight":""}</div>
                        <div style={{fontWeight:700,color:T.textDark,fontSize:"0.92rem"}}>{d.dinner}</div>
                      </div>
                      {d.ingredients.length>0&&<button onClick={function(){addAll(d.ingredients);}} style={btnP(T.sage,{fontSize:"0.7rem",padding:"0.25rem 0.65rem"})}>Add all</button>}
                    </div>
                    {d.ingredients.length>0?(
                      <div style={{display:"flex",flexWrap:"wrap",gap:"0.35rem"}}>
                        {d.ingredients.map(function(ing){
                          var added=inList(ing);
                          return(
                            <button key={ing} onClick={function(){addIng(ing);}} style={{padding:"0.22rem 0.65rem",borderRadius:"50px",border:"1px solid "+(added?T.sage:T.border),background:added?T.sagePale:"transparent",color:added?T.sageDark:T.textMid,fontSize:"0.73rem",fontWeight:600,cursor:added?"default":"pointer",fontFamily:"inherit"}}>
                              {added?"✓ ":""}{ing}
                            </button>
                          );
                        })}
                      </div>
                    ):<p style={{color:T.textFaint,fontSize:"0.78rem",fontStyle:"italic"}}>Not in meal bank — add ingredients manually.</p>}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {mealSubTab==="tonight"&&(
          <div>
            {tonightMealData?(
              <div>
                <div style={{...card({background:`linear-gradient(135deg,${T.sagePale},${T.surface})`,border:`2px solid ${T.sage}60`,padding:"1.25rem"})}}>
                  <div style={{fontSize:"0.65rem",color:T.sageDark,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:800,marginBottom:"0.3rem"}}>Tonight · {TODAY_NAME}</div>
                  <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.6rem",fontWeight:700,color:T.textDark,margin:"0 0 0.35rem"}}>{tonightMealData.name}</h2>
                  <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                    <span style={{fontSize:"0.72rem",fontWeight:600,color:T.textMid}}>⏱ {tonightMealData.time} min</span>
                    <span style={{fontSize:"0.72rem",fontWeight:600,color:T.textMid}}>· 🧹 {tonightMealData.cleanup}</span>
                    <span style={{fontSize:"0.72rem"}}>{"⭐".repeat(tonightMealData.kidRating)} kid rating</span>
                  </div>
                </div>
                <div style={{...card()}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.1rem",color:T.textDark,marginBottom:"0.65rem"}}>You'll Need</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem"}}>
                    {tonightMealData.ingredients.map((ing,i)=>(
                      <span key={i} style={{fontSize:"0.8rem",fontWeight:600,color:T.textDark,background:T.sandPale,border:`1px solid ${T.sand}40`,borderRadius:"2rem",padding:"0.22rem 0.75rem"}}>{ing}</span>
                    ))}
                  </div>
                </div>
                <div style={{...card()}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.1rem",color:T.textDark,marginBottom:"0.75rem"}}>How to Make It</div>
                  {tonightMealData.steps.map((step,i)=>(
                    <div key={i} style={{display:"flex",gap:"0.75rem",marginBottom:"0.6rem",alignItems:"flex-start"}}>
                      <div style={{width:24,height:24,borderRadius:"50%",background:T.sage,color:"#fff",fontSize:"0.72rem",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</div>
                      <span style={{fontSize:"0.86rem",color:T.textDark,fontWeight:500,lineHeight:1.55}}>{step}</span>
                    </div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.55rem",marginBottom:"0.55rem"}}>
                  <div style={{...card({background:T.bluePale,border:`1.5px solid ${T.blue}40`,padding:"0.85rem"})}}>
                    <div style={{fontSize:"0.68rem",fontWeight:800,color:T.blueDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.35rem"}}>💡 Easy Swap</div>
                    <div style={{fontSize:"0.8rem",color:T.textDark,fontWeight:500,lineHeight:1.5}}>{tonightMealData.swap}</div>
                  </div>
                  <div style={{...card({background:T.rosePale,border:`1.5px solid ${T.rose}40`,padding:"0.85rem"})}}>
                    <div style={{fontSize:"0.68rem",fontWeight:800,color:T.roseDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.35rem"}}>😮‍💨 If Overwhelmed</div>
                    <div style={{fontSize:"0.8rem",color:T.textDark,fontWeight:500,lineHeight:1.5}}>{tonightMealData.skip}</div>
                  </div>
                </div>
                <div style={{...card({background:T.sandPale,border:`1.5px solid ${T.sand}40`,padding:"0.85rem"})}}>
                  <div style={{fontSize:"0.68rem",fontWeight:800,color:T.sandDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.3rem"}}>🍱 Leftovers</div>
                  <div style={{fontSize:"0.82rem",color:T.textDark,fontWeight:500}}>{tonightMealData.leftovers}</div>
                </div>
              </div>
            ):(
              <div style={{...card({textAlign:"center",padding:"2rem"})}}>
                <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>🌙</div>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark,marginBottom:"0.4rem"}}>No dinner set for tonight</p>
                <p style={{color:T.textMid,fontSize:"0.83rem",marginBottom:"1rem"}}>Head to This Week to plan {TODAY_NAME}'s dinner, or use Rescue Mode.</p>
                <div style={{display:"flex",gap:"0.5rem",justifyContent:"center",flexWrap:"wrap"}}>
                  <button onClick={()=>setMealSubTab("week")} style={btnP(T.sage)}>Plan This Week</button>
                  <button onClick={()=>setMealSubTab("rescue")} style={btnP(T.rose)}>🆘 SOS Mode</button>
                </div>
              </div>
            )}
          </div>
        )}

        {mealSubTab==="bank"&&(
          <div>
            {/* ── Inner tab bar: Meals | Recipes ── */}
            <div style={{display:"flex",gap:"0.3rem",marginBottom:"1rem",background:T.bgAlt,borderRadius:"0.7rem",padding:"0.22rem",border:`1px solid ${T.border}`}}>
              {[{id:"meals",label:"Meal Bank",emoji:"📋"},{id:"recipes",label:"Recipes",emoji:"📖"}].map(function(it){return(
                <button key={it.id} onClick={function(){setBankInnerTab(it.id);}} style={{flex:1,background:bankInnerTab===it.id?T.sage:"transparent",color:bankInnerTab===it.id?"#fff":T.textMid,border:"none",borderRadius:"0.5rem",padding:"0.42rem 0.6rem",cursor:"pointer",fontSize:"0.78rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.3rem"}}>
                  {it.emoji} {it.label}
                </button>
              );})}
            </div>

            {/* ── MEALS inner tab ── */}
            <div style={{display:bankInnerTab==="meals"?"block":"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.55rem"}}>
                  <p style={{color:T.textMid,fontSize:"0.82rem",fontWeight:500,lineHeight:1.55,margin:0}}>Filter and find meals. Tap to see details.</p>
                  <button onClick={function(){setShowAddToBank(true);setNewBankMeal({name:"",tags:[],notes:"",isCustom:true});}} style={btnP(T.sage,{fontSize:"0.72rem",padding:"0.28rem 0.72rem"})}>+ Add Meal</button>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",marginBottom:"0.85rem"}}>
                  {MEAL_TAG_FILTERS.map(function(tf){return(
                    <button key={tf.id} onClick={function(){setBankFilters(function(p){return p.includes(tf.id)?p.filter(function(x){return x!==tf.id;}):[...p,tf.id];});}} style={{background:bankFilters.includes(tf.id)?T.sage:T.white,color:bankFilters.includes(tf.id)?"#fff":T.textMid,border:`1.5px solid ${bankFilters.includes(tf.id)?T.sage:T.border}`,borderRadius:"2rem",padding:"0.26rem 0.72rem",cursor:"pointer",fontSize:"0.72rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>
                      {tf.emoji} {tf.label}
                    </button>
                  );})}
                  {bankFilters.length>0&&<button onClick={function(){setBankFilters([]);}} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:"0.72rem",fontFamily:"inherit",fontWeight:600}}>Clear</button>}
                </div>
                <p style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500,marginBottom:"0.65rem"}}>{filteredBank.length} meal{filteredBank.length!==1?"s":""} found</p>
                {filteredBank.map(function(m){return(
                  <div key={m.id} onClick={function(){setSelectedBankMeal(selectedBankMeal===m.id?null:m.id);}} style={{...card({cursor:"pointer",borderLeft:`4px solid ${selectedBankMeal===m.id?T.sage:(m.isCustom?T.sand:T.borderSoft)}`,background:selectedBankMeal===m.id?`linear-gradient(to right,${T.sagePale},${T.surface})`:T.surface,transition:"all 0.15s"})}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"0.5rem"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:"0.45rem"}}>
                          <div style={{fontWeight:700,color:T.textDark,fontSize:"0.92rem"}}>{m.name}</div>
                          {m.isCustom&&<span style={{fontSize:"0.6rem",color:T.sand,background:T.sandPale,borderRadius:"2rem",padding:"1px 6px",fontWeight:700,border:`1px solid ${T.sand}40`}}>custom</span>}
                        </div>
                        {(m.time||m.cleanup||m.kidRating)&&(
                          <div style={{display:"flex",gap:"0.5rem",marginTop:"0.2rem"}}>
                            <span style={{fontSize:"0.69rem",color:T.textSoft,fontWeight:600}}>{m.time?`⏱ ${m.time} min`:""}{m.cleanup?` · 🧹 ${m.cleanup}`:""}{m.kidRating?` · ${"⭐".repeat(m.kidRating)}`:""}</span>
                          </div>
                        )}
                        {m.notes&&!selectedBankMeal&&<div style={{fontSize:"0.74rem",color:T.textSoft,marginTop:"0.2rem",fontStyle:"italic"}}>{m.notes}</div>}
                        <div style={{display:"flex",flexWrap:"wrap",gap:"0.3rem",marginTop:"0.4rem"}}>
                          {(m.tags||[]).slice(0,4).map(function(tag){const tf=MEAL_TAG_FILTERS.find(function(t){return t.id===tag;});return tf?<span key={tag} style={{fontSize:"0.62rem",color:T.sage,background:T.sagePale,borderRadius:"2rem",padding:"1px 7px",fontWeight:600,border:`1px solid ${T.sage}30`}}>{tf.emoji} {tf.label}</span>:null;})}
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"0.3rem"}}>
                        <Icon name={selectedBankMeal===m.id?"chevD":"chevR"} size={16} color={T.textSoft}/>
                        {m.isCustom&&<button onClick={function(e){e.stopPropagation();setMealBankCustom(function(p){return p.filter(function(x){return x.id!==m.id;});});if(selectedBankMeal===m.id)setSelectedBankMeal(null);}} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:"0.7rem",padding:0,fontFamily:"inherit"}}>✕</button>}
                      </div>
                    </div>
                    {selectedBankMeal===m.id&&(
                      <div style={{marginTop:"0.85rem",paddingTop:"0.85rem",borderTop:`1px solid ${T.borderSoft}`}}>
                        {m.notes&&<div style={{fontSize:"0.82rem",color:T.textDark,fontWeight:500,marginBottom:"0.65rem",fontStyle:"italic"}}>{m.notes}</div>}
                        {m.ingredients&&m.ingredients.length>0&&(
                          <div>
                            <div style={{fontSize:"0.72rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.4rem"}}>Ingredients</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:"0.35rem",marginBottom:"0.75rem"}}>
                              {m.ingredients.map(function(ing,i){return <span key={i} style={{fontSize:"0.77rem",color:T.textDark,background:T.sandPale,border:`1px solid ${T.sand}30`,borderRadius:"2rem",padding:"1px 8px",fontWeight:500}}>{ing}</span>;})}
                            </div>
                          </div>
                        )}
                        {m.steps&&m.steps.length>0&&(
                          <div>
                            <div style={{fontSize:"0.72rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.4rem"}}>Steps</div>
                            {m.steps.map(function(step,i){return(
                              <div key={i} style={{display:"flex",gap:"0.6rem",marginBottom:"0.4rem",alignItems:"flex-start"}}>
                                <div style={{width:20,height:20,borderRadius:"50%",background:T.sage,color:"#fff",fontSize:"0.65rem",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                                <span style={{fontSize:"0.82rem",color:T.textDark,fontWeight:500,lineHeight:1.5}}>{step}</span>
                              </div>
                            );})}
                          </div>
                        )}
                        {m.swap&&<div style={{background:T.bluePale,border:`1px solid ${T.blue}30`,borderRadius:"0.6rem",padding:"0.55rem 0.75rem",marginTop:"0.5rem",fontSize:"0.78rem",color:T.textDark,fontWeight:500}}>💡 <strong>Swap:</strong> {m.swap}</div>}
                        <div style={{marginTop:"0.65rem",display:"flex",gap:"0.45rem",flexWrap:"wrap"}}>
                          <button onClick={function(e){e.stopPropagation();setMeals(function(p){return{...p,[TODAY_NAME]:{...(p[TODAY_NAME]||{}),dinner:m.name}};});setMealSubTab("tonight");}} style={btnP(T.sage,{fontSize:"0.76rem",padding:"0.35rem 0.8rem"})}>🌙 Make Tonight</button>
                          <button onClick={function(e){e.stopPropagation();openEdit(TODAY_NAME);}} style={btnS({fontSize:"0.76rem",padding:"0.35rem 0.75rem"})}>Add to Week</button>
                        </div>
                      </div>
                    )}
                  </div>
                );})}
                {filteredBank.length===0&&<div style={{...card({textAlign:"center",padding:"1.5rem"})}}>
                  <p style={{color:T.textMid,fontWeight:600,fontSize:"0.85rem"}}>No meals match those filters. Try removing one or add a new meal.</p>
                  <button onClick={function(){setShowAddToBank(true);setNewBankMeal({name:"",tags:[],notes:"",isCustom:true});}} style={btnP(T.sage,{marginTop:"0.65rem",fontSize:"0.78rem"})}>+ Add Meal</button>
                </div>}

                {/* ── Add to Meal Bank modal ── */}
                {showAddToBank&&(
                  <ModalBox title="Add to Meal Bank" onClose={function(){setShowAddToBank(false);setNewBankMeal({name:"",tags:[],notes:""});}}>
                    <div style={{marginBottom:"0.85rem"}}>
                      <label style={lbl}>Meal name *</label>
                      <input defaultValue={newBankMeal.name} onBlur={function(e){setNewBankMeal(function(p){return{...p,name:e.target.value};});}} placeholder="e.g. Hamburgers" style={inp()} autoFocus/>
                    </div>
                    <div style={{marginBottom:"0.85rem"}}>
                      <label style={lbl}>Notes (optional)</label>
                      <textarea defaultValue={newBankMeal.notes} onBlur={function(e){setNewBankMeal(function(p){return{...p,notes:e.target.value};});}} placeholder="Any notes, variations, family preferences…" style={{...inp({height:65,resize:"none"})}}/>
                    </div>
                    <div style={{marginBottom:"1rem"}}>
                      <label style={lbl}>Tags</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",marginTop:"0.3rem"}}>
                        {MEAL_TAG_FILTERS.map(function(tf){var on=(newBankMeal.tags||[]).includes(tf.id);return(
                          <button key={tf.id} onClick={function(){setNewBankMeal(function(p){return{...p,tags:on?p.tags.filter(function(x){return x!==tf.id;}):[...(p.tags||[]),tf.id]};});}} style={{background:on?T.sage:T.white,color:on?"#fff":T.textMid,border:`1.5px solid ${on?T.sage:T.border}`,borderRadius:"2rem",padding:"0.26rem 0.72rem",cursor:"pointer",fontSize:"0.72rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>
                            {tf.emoji} {tf.label}
                          </button>
                        );})}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
                      <button onClick={function(){setShowAddToBank(false);setNewBankMeal({name:"",tags:[],notes:"",isCustom:true});}} style={btnS()}>Cancel</button>
                      <button disabled={!newBankMeal.name.trim()} onClick={function(){if(!newBankMeal.name.trim())return;setMealBankCustom(function(p){return[...p,{...newBankMeal,id:"c"+Date.now(),isCustom:true}];});setShowAddToBank(false);setNewBankMeal({name:"",tags:[],notes:"",isCustom:true});}} style={btnP(T.sage,{opacity:newBankMeal.name.trim()?1:0.5})}>Save to Bank</button>
                    </div>
                  </ModalBox>
                )}
            </div>

            {/* ── RECIPES inner tab ── */}
            <div style={{display:bankInnerTab==="recipes"?"block":"none"}}>
              <RecipesTab
                recipes={recipes}
                onSaveRecipe={function(r){setRecipes(function(p){return[...p,r];});}}
                onDeleteRecipe={function(id){setRecipes(function(p){return p.filter(function(x){return x.id!==id;});});}}
                onEditTags={function(id,tags){setRecipes(function(p){return p.map(function(r){return r.id===id?{...r,tags}:r;});});}}
                onAddToShopping={addIngredientToShopping}
                onAddToMealBank={function(name,tags,ingredients){
                  var already=[...MEAL_BANK_DATA,...mealBankCustom].some(function(x){return x.name.toLowerCase()===name.trim().toLowerCase();});
                  if(!already){setMealBankCustom(function(p){return[...p,{id:"r"+Date.now(),name:name.trim(),tags:tags||[],notes:"",ingredients:ingredients||[],isCustom:true}];});}
                }}
              />
            </div>
          </div>
        )}

        {mealSubTab==="prep"&&(function(){
          var weekMealSummary=MEAL_DAYS.map(function(day){
            var m=meals[day]||{};
            var names=[m.breakfast,m.lunch,m.dinner].filter(Boolean);
            if(!names.length)return null;
            var bankMatches=names.map(function(n){return MEAL_BANK_DATA.find(function(b){return b.name.toLowerCase()===n.toLowerCase();});}).filter(Boolean);
            return {day:day,meals:names,ingredients:bankMatches.flatMap(function(b){return b.ingredients||[];})};
          }).filter(Boolean);

          async function loadAiPrepTips(){
            if(!weekMealSummary.length){setPrepAiError("Add some meals to This Week first.");return;}
            setPrepAiLoading(true);setPrepAiError("");
            try{
              var r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
                model:"claude-sonnet-4-6",max_tokens:800,
                system:"You are a practical family meal prep assistant. Given a week of meals and their ingredients, generate smart prep tips. Focus on: shared ingredients that can be prepped once (e.g. chop all onions Sunday), leftover opportunities (e.g. swap meals to use leftovers), batch cooking ideas, and time-saving shortcuts. Also suggest if swapping 2 meals would create a leftover chain. Respond ONLY as JSON: {\"shared\":[{\"tip\":\"string\",\"emoji\":\"string\"}],\"swaps\":[{\"tip\":\"string\",\"emoji\":\"string\"}],\"batch\":[{\"tip\":\"string\",\"emoji\":\"string\"}]}. Max 3 items per category. Keep tips under 80 chars.",
                messages:[{role:"user",content:"Flow mode: "+flowMode+"\n\nThis week's meals:\n"+weekMealSummary.map(function(d){return d.day+": "+d.meals.join(", ")+(d.ingredients.length?" (ingredients: "+d.ingredients.slice(0,6).join(", ")+")":"");}).join("\n")}]
              })});
              var d=await r.json();
              var txt=(d.content?.find(function(b){return b.type==="text";})||{}).text||"{}";
              var parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());
              setPrepAiTips(parsed);
            }catch(e){setPrepAiError("Couldn't load tips. Try again.");}
            setPrepAiLoading(false);
          }

          return(
            <div>
              <div style={{...card({background:`linear-gradient(135deg,${T.sagePale},${T.bluePale})`,border:`2px solid ${T.sage}55`,padding:"1.2rem",textAlign:"center"})}}>
                <div style={{fontSize:"2rem",marginBottom:"0.4rem"}}>🫙</div>
                <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,margin:"0 0 0.35rem"}}>This Week's Prep</h2>
                <p style={{color:T.textMid,fontSize:"0.83rem",lineHeight:1.6,maxWidth:280,margin:"0 auto 0.75rem"}}>20 minutes on Sunday changes everything.</p>
                <button onClick={loadAiPrepTips} disabled={prepAiLoading} style={{...btnP(T.sage,{fontSize:"0.8rem",padding:"0.45rem 1.1rem",display:"inline-flex",alignItems:"center",gap:"0.4rem",opacity:prepAiLoading?0.6:1})}}>
                  {prepAiLoading?"✨ Analyzing meals…":"✨ Get smart prep tips"}
                </button>
              </div>

              {prepAiError&&<div style={{...card({background:T.rosePale,border:`1.5px solid ${T.rose}50`,textAlign:"center"})}}><p style={{color:T.rose,fontWeight:600,fontSize:"0.83rem",margin:0}}>{prepAiError}</p></div>}

              {prepAiTips&&(
                <div>
                  {prepAiTips.shared&&prepAiTips.shared.length>0&&(
                    <div style={{...card({borderLeft:`4px solid ${T.sage}`})}}>
                      <div style={{fontWeight:700,fontSize:"0.78rem",textTransform:"uppercase",letterSpacing:"0.07em",color:T.sage,marginBottom:"0.5rem"}}>🧅 Batch prep once</div>
                      {prepAiTips.shared.map(function(t,i){return(
                        <div key={i} style={{display:"flex",gap:"0.6rem",alignItems:"flex-start",padding:"0.35rem 0",borderBottom:i<prepAiTips.shared.length-1?"1px solid "+T.borderSoft:"none"}}>
                          <span style={{fontSize:"1rem",flexShrink:0}}>{t.emoji||"🔪"}</span>
                          <span style={{fontSize:"0.83rem",color:T.textDark,fontWeight:500,lineHeight:1.45}}>{t.tip}</span>
                        </div>
                      );})}
                    </div>
                  )}
                  {prepAiTips.swaps&&prepAiTips.swaps.length>0&&(
                    <div style={{...card({borderLeft:`4px solid ${T.sand}`})}}>
                      <div style={{fontWeight:700,fontSize:"0.78rem",textTransform:"uppercase",letterSpacing:"0.07em",color:T.sandDark,marginBottom:"0.5rem"}}>🔄 Leftover opportunities</div>
                      {prepAiTips.swaps.map(function(t,i){return(
                        <div key={i} style={{display:"flex",gap:"0.6rem",alignItems:"flex-start",padding:"0.35rem 0",borderBottom:i<prepAiTips.swaps.length-1?"1px solid "+T.borderSoft:"none"}}>
                          <span style={{fontSize:"1rem",flexShrink:0}}>{t.emoji||"♻️"}</span>
                          <span style={{fontSize:"0.83rem",color:T.textDark,fontWeight:500,lineHeight:1.45}}>{t.tip}</span>
                        </div>
                      );})}
                    </div>
                  )}
                  {prepAiTips.batch&&prepAiTips.batch.length>0&&(
                    <div style={{...card({borderLeft:`4px solid ${T.blue}`})}}>
                      <div style={{fontWeight:700,fontSize:"0.78rem",textTransform:"uppercase",letterSpacing:"0.07em",color:T.blue,marginBottom:"0.5rem"}}>⏱ Time savers</div>
                      {prepAiTips.batch.map(function(t,i){return(
                        <div key={i} style={{display:"flex",gap:"0.6rem",alignItems:"flex-start",padding:"0.35rem 0",borderBottom:i<prepAiTips.batch.length-1?"1px solid "+T.borderSoft:"none"}}>
                          <span style={{fontSize:"1rem",flexShrink:0}}>{t.emoji||"⚡"}</span>
                          <span style={{fontSize:"0.83rem",color:T.textDark,fontWeight:500,lineHeight:1.45}}>{t.tip}</span>
                        </div>
                      );})}
                    </div>
                  )}
                </div>
              )}

              {activePrepTasks.map(function(t){
                var done=prepChecked.includes(t.id);
                return (
                  <button key={t.id} onClick={()=>setPrepChecked(p=>p.includes(t.id)?p.filter(x=>x!==t.id):[...p,t.id])} style={{...card({cursor:"pointer",display:"flex",alignItems:"center",gap:"0.9rem",padding:"1rem 1.1rem",background:done?`linear-gradient(135deg,${T.sagePale},${T.sage}15)`:T.surface,border:`2px solid ${done?T.sage:T.borderSoft}`,width:"100%",textAlign:"left",transition:"all 0.18s"})}}>
                    <span style={{fontSize:"1.4rem"}}>{t.emoji}</span>
                    <span style={{flex:1,fontWeight:600,color:done?T.sageDark:T.textDark,fontSize:"0.88rem",textDecoration:done?"line-through":"none"}}>{t.text}</span>
                    <div style={{width:24,height:24,borderRadius:"50%",border:`2.5px solid ${done?T.sage:T.border}`,background:done?T.sage:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.18s"}}>{done&&<Icon name="check" size={12} color="#fff"/>}</div>
                  </button>
                );
              })}
              {prepChecked.length===activePrepTasks.length&&activePrepTasks.length>0&&(
                <div style={{...card({background:`linear-gradient(135deg,${T.sagePale},${T.bluePale})`,border:`2px solid ${T.sage}60`,textAlign:"center",padding:"1.5rem"})}}>
                  <p style={{color:T.sageDark,fontWeight:700,fontSize:"1rem"}}>🌿 Prep complete. This week is going to be so much easier.</p>
                </div>
              )}
              <div style={{...card({background:T.sandPale,border:`1.5px solid ${T.sand}40`,padding:"0.9rem"})}}>
                <div style={{fontSize:"0.68rem",fontWeight:800,color:T.sandDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.35rem"}}>💡 Skip this if needed</div>
                <p style={{color:T.textMid,fontSize:"0.8rem",lineHeight:1.58}}>Buy pre-cut produce, microwave rice pouches, and rotisserie chicken. No-prep weeks are valid weeks.</p>
              </div>
            </div>
          );
        })()}
        {mealSubTab==="rescue"&&(
          <div>
            <div style={{...card({background:`linear-gradient(135deg,${T.rosePale},${T.sandPale})`,border:`2px solid ${T.rose}50`,padding:"1.2rem",textAlign:"center"})}}>
              <div style={{fontSize:"2rem",marginBottom:"0.4rem"}}>🆘</div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,margin:"0 0 0.3rem"}}>What Can I Make Tonight?</h2>
              <p style={{color:T.textMid,fontSize:"0.82rem",lineHeight:1.6,maxWidth:280,margin:"0 auto"}}>Tell me what you have. I'll find something.</p>
            </div>
            <div style={{...card()}}>
              <label style={lbl}>What's in your fridge / pantry?</label>
              <textarea value={rescueInput} onChange={e=>{setRescueInput(e.target.value);if(rescueError)setRescueError(null);}} placeholder="e.g. chicken, rice, black beans, avocado, tortillas, eggs…" style={{...inp({height:80,resize:"none",marginBottom:"0.75rem"})}}/>
              <button onClick={findRescueMeals} disabled={!rescueInput.trim()||rescueLoading} style={btnP(T.rose,{width:"100%",justifyContent:"center",display:"flex",opacity:!rescueInput.trim()||rescueLoading?0.5:1,fontSize:"0.88rem",padding:"0.65rem"})}>
                {rescueLoading?"Finding meals…":"🆘 Find My Dinner"}
              </button>
            </div>
            {rescueError&&(
              <div style={{...card({background:T.rosePale,border:`1.5px solid ${T.rose}50`,textAlign:"center",padding:"1.1rem"})}}>
                <div style={{fontSize:"1.3rem",marginBottom:"0.35rem"}}>⚠️</div>
                <p style={{color:T.rose,fontWeight:700,fontSize:"0.85rem",margin:"0 0 0.55rem"}}>{rescueError}</p>
                <button onClick={()=>{setRescueError(null);findRescueMeals();}} style={btnP(T.rose,{fontSize:"0.78rem",padding:"0.35rem 0.85rem"})}>Try again</button>
              </div>
            )}
            {rescueResults&&rescueResults.length>0&&(
              <div>
                <p style={{color:T.textSoft,fontSize:"0.78rem",fontWeight:600,marginBottom:"0.55rem"}}>You can make any of these right now:</p>
                {rescueResults.map((r,i)=>(
                  <div key={i} style={{...card({borderLeft:`4px solid ${T.rose}`,background:`linear-gradient(to right,${T.rosePale},${T.surface})`})}}>
                    <div style={{fontWeight:700,color:T.textDark,fontSize:"0.92rem",marginBottom:"0.3rem"}}>{r.name}</div>
                    <div style={{color:T.textMid,fontSize:"0.8rem",lineHeight:1.5}}>{r.desc}</div>
                    <button onClick={()=>{setMeals(p=>({...p,[TODAY_NAME]:{...(p[TODAY_NAME]||{}),dinner:r.name}}));setMealSubTab("tonight");}} style={btnP(T.rose,{fontSize:"0.74rem",padding:"0.3rem 0.75rem",marginTop:"0.65rem"})}>🌙 Make This Tonight</button>
                  </div>
                ))}
              </div>
            )}
            {rescueResults&&rescueResults.length===0&&<div style={{...card({textAlign:"center",padding:"1.5rem"})}}>
              <div style={{fontSize:"1.3rem",marginBottom:"0.4rem"}}>🤔</div>
              <p style={{color:T.textMid,fontWeight:600,margin:"0 0 0.5rem"}}>Hmm, couldn't find a match.</p>
              <p style={{color:T.textSoft,fontSize:"0.8rem",margin:"0 0 0.75rem"}}>Try adding a protein, grain, or pantry staple to your list.</p>
              <button onClick={()=>{setRescueResults(null);}} style={btnS({fontSize:"0.78rem",padding:"0.35rem 0.85rem"})}>Edit my ingredients</button>
            </div>}
          </div>
        )}

        {editDay&&(
          <ModalBox title={`Meals for ${editDay}`} onClose={()=>setEditDay(null)}>
            {mealThemeEnabled&&mealThemes[editDay]&&<div style={{background:T.sandPale,border:`1px solid ${T.sand}40`,borderRadius:"0.65rem",padding:"0.5rem 0.8rem",marginBottom:"0.85rem",display:"flex",alignItems:"center",gap:"0.5rem"}}><span style={{fontSize:"1.1rem"}}>{mealThemes[editDay].emoji}</span><span style={{fontSize:"0.82rem",fontWeight:700,color:T.sandDark}}>{mealThemes[editDay].theme}</span></div>}
            {MEALS_TO_SHOW.map(m=>(
              <div key={m} style={{marginBottom:"0.9rem"}}>
                <label style={lbl}>{m}</label>
                <div style={{display:"flex",gap:"0.4rem"}}>
                  <input key={m+"_"+editDay} defaultValue={editMeal[m]||""} onBlur={e=>setEditMeal(p=>({...p,[m]:e.target.value}))} placeholder={`${m[0].toUpperCase()+m.slice(1)}…`} style={{...inp({flex:1})}}/>
                  {recipes.length>0&&<select onChange={e=>{if(e.target.value){const r=recipes.find(x=>x.id===e.target.value);if(r)setEditMeal(p=>({...p,[m]:r.name}));e.target.value=""}}} style={{...inp({width:"auto",flex:"none",fontSize:"0.74rem"})}}>
                    <option value="">From recipes…</option>
                    {recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>}
                  <MealBankDrawer mealType={m} allBank={[...MEAL_BANK_DATA,...mealBankCustom].slice().sort(function(a,b){return a.name.localeCompare(b.name);})} onApply={function(meal){setEditMeal(function(p){return {...p,[m]:meal.name};});}} onAddToShopping={addIngredientToShopping}/>
                </div>
              </div>
            ))}
            <div style={{marginBottom:"0.9rem"}}><label style={lbl}>Notes</label><textarea defaultValue={editMeal.notes||""} onBlur={e=>setEditMeal(p=>({...p,notes:e.target.value}))} placeholder="Dietary notes, prep reminders…" style={{...inp({height:65,resize:"none"})}}/></div>
            <div style={{marginBottom:"0.9rem"}}>
              <label style={lbl}>Grocery items needed</label>
              <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
                {(editMeal.groceryItems||[]).map((g,i)=>(
                  <div key={i} style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
                    <span style={{flex:1,fontSize:"0.83rem",color:T.textDark}}>{g}</span>
                    <button onClick={()=>setEditMeal(p=>({...p,groceryItems:(p.groceryItems||[]).filter((_,j)=>j!==i)}))} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:"0.8rem"}}>✕</button>
                  </div>
                ))}
                <div style={{display:"flex",gap:"0.4rem"}}>
                  <input value={editMeal.groceryInput||""} onChange={e=>setEditMeal(p=>({...p,groceryInput:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"&&(editMeal.groceryInput||"").trim()){setEditMeal(p=>({...p,groceryItems:[...(p.groceryItems||[]),p.groceryInput.trim()],groceryInput:""}));}}} placeholder="Add grocery item…" style={{...inp({flex:1,fontSize:"0.82rem"})}}/>
                  <button onClick={()=>{if((editMeal.groceryInput||"").trim()){setEditMeal(p=>({...p,groceryItems:[...(p.groceryItems||[]),p.groceryInput.trim()],groceryInput:""}));}}} style={btnP(T.sage,{fontSize:"0.78rem",padding:"0.35rem 0.7rem"})}>Add</button>
                </div>
              </div>
            </div>
            <div style={{marginBottom:"0.9rem",background:T.sandPale,border:`1px solid ${T.sand}40`,borderRadius:"0.65rem",padding:"0.65rem 0.8rem"}}>
              <label style={{...lbl,color:T.sandDark,marginBottom:"0.4rem"}}>📋 Save a meal to Meal Bank</label>
              <div style={{display:"flex",gap:"0.4rem"}}>
                <input defaultValue={addToBankMealName} onBlur={function(e){setAddToBankMealName(e.target.value);}} placeholder="Meal name (e.g. Hamburgers)" style={{...inp({flex:1,fontSize:"0.82rem",background:T.white})}}/>
                <button disabled={!addToBankMealName.trim()} onClick={function(){if(!addToBankMealName.trim())return;var already=[...MEAL_BANK_DATA,...mealBankCustom].some(function(x){return x.name.toLowerCase()===addToBankMealName.trim().toLowerCase();});if(!already){setMealBankCustom(function(p){return[...p,{id:"c"+Date.now(),name:addToBankMealName.trim(),tags:[],notes:"",isCustom:true}];});}setAddToBankMealName("");}} style={btnP(T.sand,{fontSize:"0.76rem",padding:"0.35rem 0.7rem",opacity:addToBankMealName.trim()?1:0.5})}>Add</button>
              </div>
            </div>
            <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}><button onClick={()=>setEditDay(null)} style={btnS()}>Cancel</button><button onClick={saveEdit} style={btnP(T.sage)}>Save</button></div>
          </ModalBox>
        )}
        {editingThemes&&(
          <ModalBox title="Themed Days" onClose={()=>setEditingThemes(false)} wide>
            {MEAL_DAYS.map(day=>(
              <div key={day} style={{display:"flex",gap:"0.5rem",alignItems:"center",marginBottom:"0.55rem"}}>
                <span style={{minWidth:90,fontSize:"0.82rem",fontWeight:700,color:T.textMid}}>{day}</span>
                <input value={mealThemes[day]?.emoji||""} onChange={e=>setMealThemes(p=>({...p,[day]:{...p[day],emoji:e.target.value}}))} style={{...inp({width:52,textAlign:"center",fontSize:"1.1rem",padding:"0.35rem"})}} placeholder="🍽️"/>
                <input value={mealThemes[day]?.theme||""} onChange={e=>setMealThemes(p=>({...p,[day]:{...p[day],theme:e.target.value}}))} style={{...inp({flex:1})}} placeholder="e.g. Taco Tuesday"/>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:"1rem"}}><button onClick={()=>setEditingThemes(false)} style={btnP(T.sage)}>Done</button></div>
          </ModalBox>
        )}
        {showRecipeImport&&(
          <ModalBox title="Import Recipe" onClose={()=>{setShowRecipeImport(false);setRecipeResult(null);setRecipeError("");setRecipeUrl("");}} wide>
            <div style={{marginBottom:"0.9rem"}}>
              <label style={lbl}>Paste a URL</label>
              <p style={{color:T.textSoft,fontSize:"0.77rem",marginBottom:"0.6rem",lineHeight:1.5}}>Works with recipe websites and Pinterest. For TikTok/Instagram, paste ingredients manually below.</p>
              <div style={{display:"flex",gap:"0.5rem"}}>
                <input value={recipeUrl} onChange={e=>setRecipeUrl(e.target.value)} placeholder="https://..." style={{...inp({flex:1})}}/>
                <button onClick={importRecipeFromUrl} disabled={recipeLoading||!recipeUrl.trim()} style={btnP(T.blue,{flexShrink:0,opacity:recipeLoading||!recipeUrl.trim()?0.5:1})}>{recipeLoading?"…":"Import"}</button>
              </div>
              {recipeError&&<p style={{color:T.rose,fontSize:"0.77rem",marginTop:"0.4rem"}}>{recipeError}</p>}
            </div>
            {recipeResult&&(
              <div style={{...card({background:T.sagePale,border:`2px solid ${T.sage}50`,marginBottom:"0.9rem"})}}>
                <p style={{fontWeight:700,color:T.sageDark,fontSize:"0.95rem",marginBottom:"0.4rem"}}>✓ Found: {recipeResult.name}</p>
                <p style={{fontSize:"0.78rem",color:T.textMid}}>{recipeResult.ingredients?.length} ingredients · {recipeResult.servings||"?"} servings · {recipeResult.time||"?"}</p>
                <button onClick={saveImportedRecipe} style={{...btnP(T.sage,{marginTop:"0.65rem",display:"flex",alignItems:"center",gap:"0.4rem"})}}><Icon name="check" size={14} color="#fff"/> Save Recipe</button>
              </div>
            )}
            <div style={{borderTop:`1px solid ${T.borderSoft}`,paddingTop:"0.9rem"}}>
              <label style={lbl}>Or enter manually</label>
              <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
                <input value={manualRecipe.name} onChange={e=>setManualRecipe(p=>({...p,name:e.target.value}))} placeholder="Recipe name" style={inp()}/>
                <textarea value={manualRecipe.ingredients} onChange={e=>setManualRecipe(p=>({...p,ingredients:e.target.value}))} placeholder="Ingredients (one per line)" style={{...inp({height:80,resize:"none"})}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
                  <input value={manualRecipe.servings} onChange={e=>setManualRecipe(p=>({...p,servings:e.target.value}))} placeholder="Servings" style={inp()}/>
                  <input value={manualRecipe.source} onChange={e=>setManualRecipe(p=>({...p,source:e.target.value}))} placeholder="Source" style={inp()}/>
                </div>
                <textarea value={manualRecipe.notes} onChange={e=>setManualRecipe(p=>({...p,notes:e.target.value}))} placeholder="Notes or instructions" style={{...inp({height:65,resize:"none"})}}/>
                <button onClick={saveManualRecipe} disabled={!manualRecipe.name.trim()} style={btnP(T.blue,{opacity:manualRecipe.name.trim()?1:0.5})}>Save Recipe</button>
              </div>
            </div>
          </ModalBox>
        )}
      </div>
    );
  }

  // ── SHOPPING TAB (voice + photo) ──────────────────────────────────────────
  _hfRenders.ShoppingTab = function ShoppingTab(){
    // Fixed stores with subcategory support for Grocery and Costco
    const FIXED_STORES = [
      {id:"grocery", label:"Grocery", emoji:"🛒", hasCats:true},
      {id:"costco",  label:"Costco",  emoji:"🏪", hasCats:true},
      {id:"target",  label:"Target",  emoji:"🎯", hasCats:false},
      {id:"amazon",  label:"Amazon",  emoji:"📦", hasCats:false},
    ];
    const lastStore = useSaved("lastUsedStore", "Grocery");
    const[newStore,setNewStore]=useState(lastStore[0]||"Grocery");
    const shopInputRef=useRef(null);
    const[isListening,setIsListening]=useState(false);
    const[voiceStatus,setVoiceStatus]=useState("");
    const[isAnalyzingPhoto,setIsAnalyzingPhoto]=useState(false);
    const[photoStatus,setPhotoStatus]=useState("");
    const[isAutoCategorizing,setIsAutoCategorizing]=useState(false);
    const[autoCatStatus,setAutoCatStatus]=useState("");
    const[newCatName,setNewCatName]=useState("");
    const[editingCategories,setEditingCategories]=useState(false);
    const[collapsedCats,setCollapsedCats]=useState({});
    const[shopAZ,setShopAZ]=useState(false);
    function shopSort(list){ return shopAZ?list.slice().sort(function(a,b){return (a.text||"").localeCompare(b.text||"");}):list; }
    const[collapsedStores,setCollapsedStores2]=useState({});
    const recognitionRef=useRef(null);
    const photoInputRef=useRef(null);
    var pendingOps=useRef(new Set());
    var shopDrag=useRef({id:null,clone:null,fromStore:null,overStore:null});
    var [shopDraggingId,setShopDraggingId]=useState(null);
    var [shopDragOverStore,setShopDragOverStore]=useState(null);
    function shopUserId(){try{var _u=JSON.parse(localStorage.getItem("af_authUser")||"null");return(_u&&_u.id)?_u.id:"";}catch(e){return "";}}

    useEffect(function(){
      if(!SHOPPING_V2||!householdId)return;
      var channel=supabase.channel("shopping-"+householdId)
        .on("postgres_changes",{event:"*",schema:"public",table:"shopping_items",filter:"household_id=eq."+householdId},function(payload){
          var et=payload.eventType;
          if(et==="INSERT"){
            var ins=payload.new;
            if(!ins||!ins.id)return;
            setShoppingItems(function(prev){
              if(prev.some(function(x){return x.id===ins.id;}))return prev;
              return prev.concat([{id:ins.id,text:ins.text||"",store:ins.store||"Grocery",done:!!ins.done,category:ins.category||"",photo:ins.photo||null}]);
            });
          } else if(et==="UPDATE"){
            var upd=payload.new;
            if(!upd||!upd.id)return;
            var toggleKey=upd.id+":"+String(upd.done);
            var editKey=upd.id+":UPDATE";
            if(pendingOps.current.has(toggleKey)){pendingOps.current.delete(toggleKey);return;}
            if(pendingOps.current.has(editKey)){pendingOps.current.delete(editKey);return;}
            setShoppingItems(function(prev){
              return prev.map(function(x){return x.id===upd.id?{id:x.id,text:upd.text||"",store:upd.store||"Grocery",done:!!upd.done,category:upd.category||"",photo:upd.photo||null}:x;});
            });
          } else if(et==="DELETE"){
            var delId=payload.old&&payload.old.id;
            if(!delId)return;
            var delKey=delId+":DELETE";
            if(pendingOps.current.has(delKey)){pendingOps.current.delete(delKey);return;}
            setShoppingItems(function(prev){return prev.filter(function(x){return x.id!==delId;});});
          }
        }).subscribe();
      return function(){supabase.removeChannel(channel);};
    },[householdId]);

    useEffect(function(){
      if(!SHOPPING_V2||!householdId)return;
      var flagKey="af_shopping_v2_backfilled_"+householdId;
      if(localStorage.getItem(flagKey))return;
      var items;
      try{items=JSON.parse(localStorage.getItem("af_shoppingItems")||"[]");}catch(e){items=[];}
      var toSync=items.filter(function(i){return !!i.id;});
      if(!toSync.length){localStorage.setItem(flagKey,"1");return;}
      // One-time transition: backfill inserts done:false for all items.
      // Any currently-checked items lose their checked state here. Acceptable for
      // a one-time migration; preserving done would require the add RPC to accept p_done.
      Promise.all(toSync.map(function(i){
        return supabase.rpc("shopping_add_item",{p_id:i.id,p_household_id:householdId,p_text:i.text||"",p_store:i.store||"Grocery",p_category:i.category||"",p_photo:i.photo||"",p_created_by:shopUserId()});
      })).then(function(){
        localStorage.setItem(flagKey,"1");
      }).catch(function(e){
      });
    },[householdId]);

    // Normalize store name from old free-text to fixed store id
    function normalizeStore(s){
      if(!s) return "Grocery";
      var sl=s.toLowerCase();
      if(sl.includes("costco")) return "Costco";
      if(sl.includes("target")) return "Target";
      if(sl.includes("amazon")) return "Amazon";
      if(sl.includes("grocery")) return "Grocery";
      return "Grocery";
    }

    function handleToggle(id,currentDone){
      var newDone=!currentDone;
      setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,done:newDone}:x;});});
      if(SHOPPING_V2&&householdId){
        pendingOps.current.add(id+":"+String(newDone));
        supabase.rpc("shopping_toggle_item",{p_id:id,p_household_id:householdId,p_done:newDone,p_updated_by:shopUserId()}).then(function(r){if(r&&r.error){pendingOps.current.delete(id+":"+String(newDone));setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,done:!newDone}:x;});});}else{}});
      }
    }
    function handleDelete(id){
      setShoppingItems(function(p){return p.filter(function(x){return x.id!==id;});});
      if(SHOPPING_V2&&householdId){
        pendingOps.current.add(id+":DELETE");
        supabase.rpc("shopping_delete_item",{p_id:id,p_household_id:householdId,p_updated_by:shopUserId()}).then(function(r){if(r&&r.error){pendingOps.current.delete(id+":DELETE");}else{}});
      }
    }
    function handleSave(id,val){
      var cur=shoppingItems.find(function(x){return x.id===id;})||{store:"Grocery",category:"",photo:null};
      setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,text:val}:x;});});
      if(SHOPPING_V2&&householdId){
        pendingOps.current.add(id+":UPDATE");
        supabase.rpc("shopping_update_item",{p_id:id,p_household_id:householdId,p_text:val,p_store:cur.store||"Grocery",p_category:cur.category||"",p_photo:cur.photo||"",p_updated_by:shopUserId()}).then(function(r){if(r&&r.error){pendingOps.current.delete(id+":UPDATE");}else{}});
      }
    }
    function handleMoveStore(id,targetStoreLabel){
      var cur=shoppingItems.find(function(x){return x.id===id;});
      if(!cur)return;
      setShoppingItems(function(p){return p.map(function(x){return x.id===id?Object.assign({},x,{store:targetStoreLabel,category:""}):x;});});
      if(SHOPPING_V2&&householdId){
        pendingOps.current.add(id+":UPDATE");
        supabase.rpc("shopping_update_item",{p_id:id,p_household_id:householdId,p_text:cur.text,p_store:targetStoreLabel,p_category:"",p_photo:cur.photo||"",p_updated_by:shopUserId()}).then(function(r){if(r&&r.error)pendingOps.current.delete(id+":UPDATE");});
      }
    }
    function shopPointerDown(e,id){
      if(e.button!==undefined&&e.button!==0)return;
      e.stopPropagation();
      var cur=shoppingItems.find(function(x){return x.id===id;});
      shopDrag.current.id=id;
      shopDrag.current.fromStore=cur?normalizeStore(cur.store):null;
      shopDrag.current.overStore=null;
      var srcEl=document.querySelector("[data-shopid='"+id+"']");
      if(srcEl){
        var clone=srcEl.cloneNode(true);
        clone.style.cssText="position:fixed;top:"+(e.clientY-20)+"px;left:"+(e.clientX-40)+"px;width:"+srcEl.offsetWidth+"px;opacity:0.85;background:white;boxShadow:0 4px 16px rgba(0,0,0,0.22);borderRadius:8px;zIndex:9999;pointerEvents:none;transition:none;";
        document.body.appendChild(clone);
        shopDrag.current.clone=clone;
      }
      setShopDraggingId(id);
    }
    useEffect(function(){
      if(!shopDraggingId)return;
      function onMove(e){
        if(shopDrag.current.clone){shopDrag.current.clone.style.top=(e.clientY-20)+"px";shopDrag.current.clone.style.left=(e.clientX-40)+"px";}
        var el=document.elementFromPoint(e.clientX,e.clientY);
        var storeEl=el&&el.closest("[data-shopstore]");
        var overStore=storeEl?storeEl.getAttribute("data-shopstore"):null;
        if(overStore!==shopDrag.current.overStore){shopDrag.current.overStore=overStore;setShopDragOverStore(overStore);}
      }
      function onUp(){
        if(shopDrag.current.clone){try{shopDrag.current.clone.remove();}catch(ex){}shopDrag.current.clone=null;}
        var overStore=shopDrag.current.overStore;
        var fromStore=shopDrag.current.fromStore;
        var dragId=shopDrag.current.id;
        shopDrag.current={id:null,clone:null,fromStore:null,overStore:null};
        setShopDraggingId(null);
        setShopDragOverStore(null);
        if(dragId&&overStore){
          var targetSt=FIXED_STORES.find(function(s){return s.id===overStore;});
          if(targetSt&&targetSt.label!==fromStore)handleMoveStore(dragId,targetSt.label);
        }
      }
      window.addEventListener("pointermove",onMove);
      window.addEventListener("pointerup",onUp);
      return function(){window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);};
    },[shopDraggingId]);
    function addItem(text,store,photoUrl){
      if(!text.trim())return;
      var s=store||newStore;
      var _id=uid();
      setShoppingItems(p=>[...p,{id:_id,text:text.trim(),store:s,done:false,photo:photoUrl||null,category:""}]);
      lastStore[1](s);setNewStore(s);
      if(SHOPPING_V2&&householdId){
        supabase.rpc("shopping_add_item",{p_id:_id,p_household_id:householdId,p_text:text.trim(),p_store:s,p_category:"",p_photo:photoUrl||"",p_created_by:shopUserId()}).then(function(r){if(r&&r.error)console.warn("[AF] shopping_add_item failed:",r.error.message);});
      }
    }

    function addInlineItem(store){
      if(!shopInputRef.current||!shopInputRef.current.value.trim())return;
      addItem(shopInputRef.current.value,store);
      shopInputRef.current.value="";
    }

    async function autoCategorize(){
      var uncategorized=shoppingItems.filter(function(i){return (!i.category||i.category==="")&&(normalizeStore(i.store)==="Grocery"||normalizeStore(i.store)==="Costco");});
      if(uncategorized.length===0){setAutoCatStatus("All items already have categories!");setTimeout(()=>setAutoCatStatus(""),2500);return;}
      setIsAutoCategorizing(true);setAutoCatStatus("Categorizing "+uncategorized.length+" items…");
      try{
        var r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:600,system:"You are a grocery assistant. Given a list of shopping items and a list of categories, assign each item to the best category. Respond ONLY with a JSON array: [{\"id\":\"\",\"category\":\"\"}]. Use ONLY the exact category names provided. If unsure, use Other.",messages:[{role:"user",content:"Categories: "+shopCatLabels().join(", ")+"\n\nItems:\n"+uncategorized.map(function(i){return i.id+": "+i.text;}).join("\n")}]})});
        var d=await r.json();
        var txt=d.content?.find(function(b){return b.type==="text";})||{};
        var parsed=JSON.parse((txt.text||"[]").replace(/```json|```/g,"").trim());
        setShoppingItems(function(prev){var map={};parsed.forEach(function(x){map[x.id]=x.category;});return prev.map(function(i){return map[i.id]?{...i,category:map[i.id]}:i;});});
        setAutoCatStatus("✓ "+parsed.length+" items categorized");
      }catch(e){setAutoCatStatus("Could not auto-categorize. Try again.");}
      setIsAutoCategorizing(false);setTimeout(()=>setAutoCatStatus(""),3000);
    }

    function startListening(){
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setVoiceStatus("Voice input not supported. Try Chrome.");return;}
      const recognition=new SR();recognitionRef.current=recognition;recognition.continuous=false;recognition.interimResults=true;recognition.lang="en-US";
      recognition.onstart=()=>{setIsListening(true);setVoiceStatus("Listening… say your item");};
      recognition.onresult=function(e){var transcript=Array.from(e.results).map(function(r){return r[0].transcript;}).join("");setVoiceStatus("Heard: \""+transcript+"\"");if(e.results[0].isFinal){var voiceItems=transcript.split(/\band\b/i).map(function(s){return s.trim();}).filter(Boolean);voiceItems.forEach(function(item){addItem(item,newStore);});setIsListening(false);setVoiceStatus("✓ Added "+voiceItems.length+" item"+(voiceItems.length>1?"s":""));setTimeout(function(){setVoiceStatus("");},2500);}};
      recognition.onerror=e=>{setIsListening(false);setVoiceStatus(e.error==="not-allowed"?"Microphone access denied.":`Error: ${e.error}`);setTimeout(()=>setVoiceStatus(""),3000);};
      recognition.onend=()=>setIsListening(false);recognition.start();
    }
    function stopListening(){recognitionRef.current?.stop();setIsListening(false);}

    async function handlePhotoUpload(e){
      const file=e.target.files?.[0];if(!file)return;
      setIsAnalyzingPhoto(true);setPhotoStatus("Analyzing photo…");
      var base64=await new Promise(function(res){var reader=new FileReader();reader.onload=function(){res(reader.result.split(",")[1]);};reader.readAsDataURL(file);});
      const photoUrl=URL.createObjectURL(file);
      try{
        const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:300,system:`You are a grocery list assistant. Given an image, identify the grocery item and return ONLY JSON: {"name":"","category":""}. Category must be one of: ${shopCatLabels().join(", ")}. Keep name short like a grocery list item. If unclear, return {"name":"Item from photo","category":"Other"}.`,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:base64}},{type:"text",text:"What grocery item is in this photo?"}]}]})});
        const d=await r.json();const txt=d.content?.find(b=>b.type==="text")?.text||'{"name":"Item from photo","category":"Other"}';
        const parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());const itemName=parsed.name||"Item from photo";const itemCat=shopCatLabels().includes(parsed.category)?parsed.category:"";
        setShoppingItems(p=>[...p,{id:uid(),text:itemName,store:newStore,done:false,photo:photoUrl,category:itemCat}]);setPhotoStatus(`✓ Added "${itemName}" with photo`);
      }catch{setShoppingItems(p=>[...p,{id:uid(),text:"Item from photo",store:newStore,done:false,photo:photoUrl,category:""}]);setPhotoStatus("✓ Added item with photo");}
      setIsAnalyzingPhoto(false);setTimeout(()=>setPhotoStatus(""),3000);e.target.value="";
    }


    return(
      <div>
        <SecHead emoji="🛒" title="Shopping List" sub={shoppingItems.filter(function(i){return !i.done;}).length+" items remaining"} onBack={function(){goTab("anchor");}}/>

        {/* Add item card */}
        <div style={{...card({background:T.sandPale,border:"2px solid "+T.sand+"55"})}}>
          {/* Store tabs */}
          <div style={{display:"flex",gap:"0.3rem",marginBottom:"0.65rem",flexWrap:"wrap"}}>
            {FIXED_STORES.map(function(st){
              var isActive=newStore===st.label;
              return(
                <button key={st.id} onClick={()=>{setNewStore(st.label);lastStore[1](st.label);}} style={{background:isActive?T.sand:"transparent",color:isActive?"#fff":T.textMid,border:"2px solid "+(isActive?T.sand:T.border),borderRadius:"2rem",padding:"0.28rem 0.75rem",cursor:"pointer",fontSize:"0.74rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                  <span>{st.emoji}</span>{st.label}
                </button>
              );
            })}
          </div>
          <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.6rem"}}>
            <input ref={shopInputRef} defaultValue="" onKeyDown={function(e){if(e.key==="Enter"&&shopInputRef.current){addItem(shopInputRef.current.value,newStore);shopInputRef.current.value="";}}} placeholder={"Add to "+newStore+"…"} style={{...inp({flex:1,minWidth:120})}}/>
            <button onClick={function(){if(shopInputRef.current&&shopInputRef.current.value.trim()){addItem(shopInputRef.current.value,newStore);shopInputRef.current.value="";}}} style={btnP(T.sand)}>Add</button>
          </div>
          <div style={{display:"flex",gap:"0.5rem",alignItems:"center",flexWrap:"wrap",marginBottom:"0.5rem"}}>
            <button onClick={isListening?stopListening:startListening} style={{background:isListening?T.rose:T.blue,color:"#fff",border:"none",borderRadius:"0.7rem",padding:"0.5rem 0.9rem",cursor:"pointer",fontSize:"0.8rem",fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.4rem",transition:"all 0.15s",boxShadow:isListening?"0 0 0 3px "+T.rose+"40":"none"}}>
              <span style={{fontSize:"1rem"}}>{isListening?"⏹":"🎙️"}</span>{isListening?"Stop":"Speak Item"}
            </button>
            <button onClick={function(){photoInputRef.current&&photoInputRef.current.click();}} disabled={isAnalyzingPhoto} style={{background:T.sage,color:"#fff",border:"none",borderRadius:"0.7rem",padding:"0.5rem 0.9rem",cursor:isAnalyzingPhoto?"wait":"pointer",fontSize:"0.8rem",fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.4rem",opacity:isAnalyzingPhoto?0.65:1,transition:"all 0.15s"}}>
              <span style={{fontSize:"1rem"}}>📷</span>{isAnalyzingPhoto?"Analyzing…":"Photo to List"}
            </button>
            <button onClick={autoCategorize} disabled={isAutoCategorizing} style={{background:isAutoCategorizing?"#ccc":"#3a6b8a",color:"#fff",border:"none",borderRadius:"0.7rem",padding:"0.5rem 0.9rem",cursor:isAutoCategorizing?"wait":"pointer",fontSize:"0.8rem",fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.4rem",opacity:isAutoCategorizing?0.7:1,transition:"all 0.15s"}}>
              <span style={{fontSize:"1rem"}}>✨</span>{isAutoCategorizing?"Sorting…":"Auto-sort"}
            </button>
            <button onClick={function(){setShopAZ(function(v){return !v;});}} style={{background:shopAZ?T.sand:"transparent",color:shopAZ?"#fff":T.textMid,border:"2px solid "+(shopAZ?T.sand:T.border),borderRadius:"0.7rem",padding:"0.5rem 0.9rem",cursor:"pointer",fontSize:"0.8rem",fontWeight:700,fontFamily:"inherit"}}>A–Z</button>
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{display:"none"}}/>
          </div>
          {(voiceStatus||photoStatus||autoCatStatus)&&(
            <div style={{background:T.white,border:"1.5px solid "+T.border,borderRadius:"0.6rem",padding:"0.45rem 0.75rem",fontSize:"0.78rem",color:T.textMid,fontWeight:600,display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.4rem"}}>
              {(isListening||isAnalyzingPhoto||isAutoCategorizing)&&<div style={{width:8,height:8,borderRadius:"50%",background:isListening?T.rose:T.sage,animation:"bounce 0.8s infinite"}}/>}
              {autoCatStatus||voiceStatus||photoStatus}
            </div>
          )}
        </div>

        {/* Edit categories toggle (for Grocery/Costco subcategories) */}
        <div style={{marginBottom:"0.75rem"}}>
          <button onClick={function(){setEditingCategories(function(v){return !v;});}} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.74rem",color:T.textSoft,fontWeight:600,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.3rem",padding:"0.2rem 0"}}>
            <Icon name="edit" size={11} color={T.textSoft}/> {editingCategories?"Done editing":"Edit subcategories"}
          </button>
          {editingCategories&&(
            <div style={{background:T.white,border:"1.5px solid "+T.border,borderRadius:"0.9rem",padding:"0.85rem 1rem",marginTop:"0.4rem"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.65rem"}}>
                <span style={{fontSize:"0.74rem",color:T.textMid,fontWeight:700}}>Grocery & Costco subcategories</span>
                <button onClick={function(){setShopCategories([{id:"produce",label:"Produce",emoji:"🥦"},{id:"dairy",label:"Dairy",emoji:"🥛"},{id:"meat",label:"Meat & Seafood",emoji:"🥩"},{id:"frozen",label:"Frozen",emoji:"🧊"},{id:"canned",label:"Canned & Pantry",emoji:"🥫"},{id:"bakery",label:"Bakery",emoji:"🍞"},{id:"beverages",label:"Beverages",emoji:"🧃"},{id:"snacks",label:"Snacks",emoji:"🍿"},{id:"deli",label:"Deli",emoji:"🧀"},{id:"health",label:"Health & Beauty",emoji:"🧴"},{id:"household",label:"Household",emoji:"🧹"},{id:"baby",label:"Baby & Kids",emoji:"🍼"},{id:"pets",label:"Pet Supplies",emoji:"🐾"},{id:"other",label:"Other",emoji:"📦"}]);}} style={{background:"none",border:"1px solid "+T.border,borderRadius:"0.5rem",cursor:"pointer",fontSize:"0.68rem",color:T.textSoft,fontWeight:700,fontFamily:"inherit",padding:"1px 7px"}}>Reset</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:"0.3rem",marginBottom:"0.65rem"}}>
                {shopCategories.map(function(cat,ci){
                  var lbl=catLabel(cat);var emj=catEmoji(cat);var cid=catId(cat);
                  return(
                    <div key={cid||lbl} style={{display:"flex",alignItems:"center",gap:"0.4rem",background:T.surface,borderRadius:"0.6rem",padding:"0.3rem 0.5rem"}}>
                      <input value={emj} onChange={function(e){setShopCategories(function(p){return p.map(function(c,i){return i===ci?(typeof c==="string"?{id:c,label:c,emoji:e.target.value}:{...c,emoji:e.target.value}):c;});});}} style={{width:32,border:"none",background:"transparent",fontSize:"1rem",textAlign:"center",cursor:"text",fontFamily:"inherit",padding:0}} placeholder="📦"/>
                      <input value={lbl} onChange={function(e){setShopCategories(function(p){return p.map(function(c,i){return i===ci?(typeof c==="string"?{id:e.target.value,label:e.target.value,emoji:""}:{...c,label:e.target.value}):c;});});}} style={{flex:1,border:"none",background:"transparent",fontSize:"0.8rem",fontWeight:600,color:T.textDark,fontFamily:"inherit",padding:0,outline:"none"}} placeholder="Category name"/>
                      <button onClick={function(){setShopCategories(function(p){var a=[...p];if(ci>0){var t=a[ci-1];a[ci-1]=a[ci];a[ci]=t;}return a;});}} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:"0.75rem",padding:"0 2px"}} title="Move up">↑</button>
                      <button onClick={function(){setShopCategories(function(p){var a=[...p];if(ci<a.length-1){var t=a[ci+1];a[ci+1]=a[ci];a[ci]=t;}return a;});}} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:"0.75rem",padding:"0 2px"}} title="Move down">↓</button>
                      <button onClick={function(){setShopCategories(function(p){return p.filter(function(_,i){return i!==ci;});});}} style={{background:"none",border:"none",cursor:"pointer",color:T.rose,fontWeight:900,fontSize:"0.85rem",padding:"0 2px",lineHeight:1}}>×</button>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
                <input value={newCatName} onChange={function(e){setNewCatName(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"&&newCatName.trim()){setShopCategories(function(p){return[...p,{id:newCatName.trim().toLowerCase().replace(/\s+/g,"_"),label:newCatName.trim(),emoji:"📦"}];});setNewCatName("");}}} placeholder="New subcategory…" style={{...inp({flex:1,fontSize:"0.8rem",padding:"0.35rem 0.6rem"})}}/>
                <button onClick={function(){if(newCatName.trim()){setShopCategories(function(p){return[...p,{id:newCatName.trim().toLowerCase().replace(/\s+/g,"_"),label:newCatName.trim(),emoji:"📦"}];});setNewCatName("");}}} style={btnP(T.sand,{padding:"0.35rem 0.75rem",fontSize:"0.78rem"})}>+ Add</button>
              </div>
            </div>
          )}
        </div>

        {/* Store sections */}
        {(function(){
          var allEmpty=FIXED_STORES.every(function(st){return shoppingItems.filter(function(i){return normalizeStore(i.store)===st.label;}).length===0;});
          if(allEmpty) return(
            <div style={{...card({textAlign:"center",padding:"2.5rem 1rem"})}}>
              <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>🛒</div>
              <p style={{color:T.textFaint,fontSize:"0.88rem",fontWeight:600}}>Your list is empty</p>
              <p style={{color:T.textFaint,fontSize:"0.78rem",marginTop:"0.25rem"}}>Add items above, or use Auto-sort to categorize.</p>
            </div>
          );
          return FIXED_STORES.map(function(st){
            var storeItems=shoppingItems.filter(function(i){return normalizeStore(i.store)===st.label;});
            if(storeItems.length===0) return null;
            var isCollapsed=!!collapsedStores[st.id];
            var pendingCount=storeItems.filter(function(i){return !i.done;}).length;
            var storeColor=st.id==="grocery"?T.sage:st.id==="costco"?T.blue:st.id==="target"?"#cc3333":st.id==="amazon"?"#e8a838":T.sand;
            return(
              <div key={st.id} data-shopstore={st.id} style={{...card({padding:"0",marginBottom:"0.65rem",border:"1.5px solid "+(shopDragOverStore===st.id?"#4a7fa8":T.borderSoft),outline:shopDragOverStore===st.id?"2px solid #4a7fa8aa":"none",transition:"outline 0.1s,border 0.1s"})}}>
                {/* Store header */}
                <div style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.75rem 1rem",borderBottom:isCollapsed?"none":"1px solid "+T.borderSoft}}>
                  <button onClick={function(){setCollapsedStores2(function(p){return{...p,[st.id]:!p[st.id]};});}} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",flex:1,padding:0,textAlign:"left",fontFamily:"inherit"}}>
                    <span style={{fontSize:"1.15rem"}}>{st.emoji}</span>
                    <span style={{fontWeight:800,color:storeColor,fontSize:"0.95rem",flex:1}}>{st.label}</span>
                    {pendingCount>0&&<span style={{fontSize:"0.7rem",color:T.textMid,fontWeight:700,background:T.surface,borderRadius:"2rem",padding:"1px 7px",border:"1px solid "+T.borderSoft}}>{pendingCount}</span>}
                    <div style={{display:"flex",transition:"transform 0.2s",transform:isCollapsed?"rotate(-90deg)":"rotate(0deg)"}}><Icon name="chevD" size={15} color={T.textSoft}/></div>
                  </button>
                </div>
                {!isCollapsed&&(
                  <div style={{padding:"0 0 0.5rem"}}>
                    {st.hasCats ? (function(){
                      // Group by subcategory
                      var uncatKey="__uncat__";
                      var grouped={};
                      storeItems.forEach(function(item){
                        var cat=item.category&&item.category!==""&&item.category!=="grocery"?item.category:uncatKey;
                        if(!grouped[cat])grouped[cat]=[];
                        grouped[cat].push(item);
                      });
                      var orderedCats=shopCategories.filter(function(c){var lbl=catLabel(c);return grouped[lbl]&&grouped[lbl].length>0;}).map(function(c){return catLabel(c);});
                      Object.keys(grouped).forEach(function(k){if(k!==uncatKey&&!orderedCats.includes(k))orderedCats.push(k);});
                      if(grouped[uncatKey]&&grouped[uncatKey].length>0)orderedCats.push(uncatKey);
                      return orderedCats.map(function(cat){
                        var catItems=shopSort(grouped[cat]||[]);
                        var isUncat=cat===uncatKey;
                        var catColKey=st.id+"__"+cat;
                        var isCatCollapsed=!!collapsedCats[catColKey];
                        var catObj=shopCategories.find(function(c){return catLabel(c)===cat;});
                        var catEmj=catObj?catEmoji(catObj):"📦";
                        var catPending=catItems.filter(function(i){return !i.done;}).length;
                        return(
                          <div key={cat} style={{borderTop:"1px solid "+T.borderSoft+"88"}}>
                            <div onClick={function(){setCollapsedCats(function(p){return{...p,[catColKey]:!p[catColKey]};});}} style={{display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.4rem 1rem",cursor:"pointer",userSelect:"none",background:T.surface+"44"}}>
                              <span style={{fontSize:"0.85rem"}}>{isUncat?"📦":catEmj}</span>
                              <span style={{fontSize:"0.75rem",fontWeight:700,color:T.textMid,flex:1}}>{isUncat?"Uncategorized":cat}</span>
                              {catPending>0&&<span style={{fontSize:"0.65rem",color:T.textFaint,fontWeight:600}}>{catPending}</span>}
                              <div style={{display:"flex",transition:"transform 0.2s",transform:isCatCollapsed?"rotate(-90deg)":"rotate(0deg)"}}><Icon name="chevD" size={12} color={T.textFaint}/></div>
                            </div>
                            {!isCatCollapsed&&(
                              <div style={{padding:"0 1rem"}}>
                                {catItems.map(function(item){
                                  return(
                                    <ShopItemRow key={item.id} item={item}
                                      onToggle={handleToggle}
                                      onDelete={handleDelete}
                                      onSave={handleSave}
                                      onDragStart={shopPointerDown}
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })() : (
                      <div style={{padding:"0 1rem"}}>
                        {shopSort(storeItems).map(function(item){
                          return(
                            <ShopItemRow key={item.id} item={item}
                              onToggle={handleToggle}
                              onDelete={handleDelete}
                              onSave={handleSave}
                              onDragStart={shopPointerDown}
                            />
                          );
                        })}
                      </div>
                    )}
                    {/* Inline quick-add */}
                    <div style={{display:"flex",gap:"0.4rem",padding:"0.5rem 1rem 0.25rem",borderTop:"1px dashed "+T.borderSoft+"88"}}>
                      <input onKeyDown={function(e){if(e.key==="Enter"){addItem(e.target.value,st.label);e.target.value="";}}} placeholder={"Quick add to "+st.label+"…"} style={{...inp({flex:1,fontSize:"0.78rem",padding:"0.3rem 0.6rem",background:T.surface})}}/>
                    </div>
                  </div>
                )}
              </div>
            );
          });
        })()}
        {shoppingItems.some(function(i){return i.done;})&&<button onClick={function(){setShoppingItems(function(p){return p.filter(function(i){return !i.done;});});}} style={{...btnS({width:"100%",color:T.rose,borderColor:T.rose+"66",fontWeight:700})}}>Clear completed items</button>}
      </div>
    );
  }
  _hfRenders.HomeTab = function HomeTab(){
    const SYSTEM_COLORS=[T.blue,T.sage,T.sand,T.rose,T.lavender,"#7ab8a8","#e8a838","#c878a8"];
    const[editingSystem,setEditingSystem]=useState(null);
    const[editForm,setEditForm]=useState({label:"",emoji:"",items:[]});
    const[newItemText,setNewItemText]=useState("");
    const {draggingId:sysDragId, dragOverId:sysDropId, pointerDown:sysPointerDown} =
      usePointerDrag(homeSystems, setHomeSystems, {dataAttr:"data-sysid"});
    // editForm item drag (plain strings, not objects — handled with simple index refs)
    const editItemDs = useRef({from:null,to:null,clone:null});
    const [editDragIdx,setEditDragIdx] = useState(null);
    const [editDropIdx,setEditDropIdx] = useState(null);
    function editItemPointerDown(e,fromIdx){
      editItemDs.current.from=fromIdx; editItemDs.current.to=null;
      setEditDragIdx(fromIdx);
      function onMove(ev){
        const el=document.elementFromPoint(ev.clientX,ev.clientY);
        const row=el&&el.closest("[data-editidx]");
        const idx=row?parseInt(row.getAttribute("data-editidx")):null;
        editItemDs.current.to=idx!==null&&idx!==fromIdx?idx:null;
        setEditDropIdx(editItemDs.current.to);
      }
      function onUp(){
        const toIdx=editItemDs.current.to;
        setEditDragIdx(null); setEditDropIdx(null);
        editItemDs.current.from=null; editItemDs.current.to=null;
        window.removeEventListener("pointermove",onMove);
        if(toIdx===null||toIdx===fromIdx) return;
        setEditForm(function(p){ var arr=p.items.slice(); var moved=arr.splice(fromIdx,1)[0]; arr.splice(toIdx,0,moved); return Object.assign({},p,{items:arr}); });
      }
      window.addEventListener("pointermove",onMove);
      window.addEventListener("pointerup",onUp,{once:true});
      e.preventDefault();
    }
    function openEdit(sys){setEditingSystem(sys.id);setEditForm({label:sys.label,emoji:sys.emoji,items:[...sys.items]});setNewItemText("");}
    function openNew(){setEditingSystem("new");setEditForm({label:"",emoji:"🏡",items:[]});setNewItemText("");}
    function saveSystem(){if(!editForm.label.trim())return;if(editingSystem==="new")setHomeSystems(p=>[...p,{id:uid(),label:editForm.label.trim(),emoji:editForm.emoji,items:editForm.items}]);else setHomeSystems(p=>p.map(s=>s.id===editingSystem?{...s,label:editForm.label,emoji:editForm.emoji,items:editForm.items}:s));setEditingSystem(null);}
    function addEditItem(){if(!newItemText.trim())return;setEditForm(p=>({...p,items:[...p.items,newItemText.trim()]}));setNewItemText("");}
    return(
      <div>
        <SecHead emoji="🏠" title="Home Systems" sub="Rhythms that keep life flowing" onBack={function(){goTab("anchor");}} action={<button onClick={openNew} style={{...btnP(T.sage,{display:"flex",alignItems:"center",gap:"0.4rem",fontSize:"0.8rem",padding:"0.42rem 0.85rem"})}}><Icon name="plus" size={14} color="#fff"/> Add System</button>}/>
        {homeSystems.map((sys,i)=>(
          <div key={sys.id} data-sysid={sys.id} onPointerDown={e=>sysPointerDown(e,sys.id)}
            style={{...card({borderLeft:`4px solid ${SYSTEM_COLORS[i%SYSTEM_COLORS.length]}`,cursor:"grab",
              opacity:sysDragId===sys.id?0.35:1,
              outline:sysDropId===sys.id?`2px dashed ${SYSTEM_COLORS[i%SYSTEM_COLORS.length]}`:"none",
              outlineOffset:"2px"})}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.55rem",marginBottom:"0.85rem"}}>
              <div style={{opacity:0.35,flexShrink:0}}><Icon name="drag" size={14} color={T.textSoft}/></div>
              <span style={{fontSize:"1.15rem"}}>{sys.emoji}</span>
              <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark,flex:1}}>{sys.label}</h2>
              <button onClick={()=>openEdit(sys)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.5rem",cursor:"pointer",padding:"4px 9px",display:"flex",alignItems:"center",gap:"0.3rem",fontSize:"0.72rem",color:T.textMid,fontWeight:700,fontFamily:"inherit"}}><Icon name="edit" size={12} color={T.textMid}/> Edit</button>
              <button onClick={()=>setHomeSystems(p=>p.filter(s=>s.id!==sys.id))} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"0.5rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
            </div>
            {sys.items.map((item,j)=>(
              <div key={j} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.48rem 0",borderBottom:j<sys.items.length-1?`1px solid ${T.borderSoft}`:"none"}}>
                <div style={{width:9,height:9,borderRadius:"50%",background:SYSTEM_COLORS[i%SYSTEM_COLORS.length],flexShrink:0,marginTop:5}}/>
                <span style={{fontSize:"0.86rem",color:T.textDark,fontWeight:600,lineHeight:1.5}}>{item}</span>
              </div>
            ))}
            {sys.items.length===0&&<p style={{color:T.textFaint,fontSize:"0.79rem"}}>No items yet — tap Edit to add some.</p>}
          </div>
        ))}
        {editingSystem&&(
          <ModalBox title={editingSystem==="new"?"New System":`Edit: ${editForm.label||"System"}`} onClose={()=>setEditingSystem(null)} wide>
            <div style={{display:"grid",gridTemplateColumns:"64px 1fr",gap:"0.65rem",marginBottom:"0.9rem"}}>
              <div><label style={lbl}>Emoji</label><input value={editForm.emoji} onChange={e=>setEditForm(p=>({...p,emoji:e.target.value}))} style={{...inp({textAlign:"center",fontSize:"1.3rem",padding:"0.5rem"})}}/></div>
              <div><label style={lbl}>System Name</label><input value={editForm.label} onChange={e=>setEditForm(p=>({...p,label:e.target.value}))} placeholder="e.g. Morning Routine" style={inp()} autoFocus/></div>
            </div>
            <label style={lbl}>Items</label>
            <div style={{marginBottom:"0.7rem",border:`1.5px solid ${T.border}`,borderRadius:"0.8rem",overflow:"hidden"}}>
              {editForm.items.length===0&&<p style={{color:T.textFaint,fontSize:"0.79rem",padding:"0.6rem 0.85rem",fontWeight:500}}>No items yet</p>}
              {editForm.items.map((item,i)=>(
                <div key={i} data-editidx={String(i)} onPointerDown={e=>editItemPointerDown(e,i)}
                  style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.45rem 0.65rem",
                    borderBottom:i<editForm.items.length-1?`1px solid ${T.borderSoft}`:"none",
                    background:T.surface,cursor:"grab",
                    opacity:editDragIdx===i?0.35:1,
                    outline:editDropIdx===i?`2px dashed ${T.blue}`:"none",outlineOffset:"1px"}}>
                  <div style={{opacity:0.35,flexShrink:0}}><Icon name="drag" size={13} color={T.textSoft}/></div>
                  <input value={item} onChange={e=>setEditForm(p=>({...p,items:p.items.map((x,j)=>j===i?e.target.value:x)}))} style={{...inp({flex:1,padding:"0.3rem 0.55rem",fontSize:"0.84rem",border:"none",background:"transparent"})}}/>
                  <button onClick={()=>setEditForm(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.2rem"}}>
              <input value={newItemText} onChange={e=>setNewItemText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addEditItem();}} placeholder="Add an item…" style={{...inp({flex:1})}}/>
              <button onClick={addEditItem} style={btnP(T.sage,{padding:"0.5rem 0.85rem",display:"flex",alignItems:"center",gap:"0.35rem"})}><Icon name="plus" size={14} color="#fff"/> Add</button>
            </div>
            <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
              <button onClick={()=>setEditingSystem(null)} style={btnS()}>Cancel</button>
              <button onClick={saveSystem} style={btnP(T.sage)}>{editingSystem==="new"?"Create System":"Save Changes"}</button>
            </div>
          </ModalBox>
        )}
      </div>
    );
  }

  _hfRenders.BrainTab = function BrainTab(){
    const [newText,setNewText] = useState("");
    const [newCat,setNewCat] = useState(function(){try{var s=sessionStorage.getItem("af_brainNewCat");if(s)return s;}catch{}return "personal";});
    const [aiRecatLoading,setAiRecatLoading] = useState(false);
    const [patternMsg,setPatternMsg] = useState(null);
    const [patternLoading,setPatternLoading] = useState(false);
    const brainInputRef = React.useRef(null);
    const [activeTab,setBrainActiveTab] = useState(function(){
      try{var s=sessionStorage.getItem("af_brainActiveTab");if(s)return s;}catch{}
      // Default to current user's person tab if they have one, else all
      var myName=preferredName||(authUser&&authUser.displayName?authUser.displayName.split(" ")[0]:null);
      if(myName){var myPerson=people.find(function(p){return p.name===myName;});if(myPerson)return "person_"+myPerson.id;}
      return "all";
    });
    var _setBrainActiveTab=function(v){
      setBrainActiveTab(v);
      try{sessionStorage.setItem("af_brainActiveTab",v);}catch{}
      if(v!=="all"&&v!=="unfiled"&&!v.startsWith("person_")){
        setNewCat(v);
        try{sessionStorage.setItem("af_brainNewCat",v);}catch{}
      }
    };
    const [search,setBrainSearch] = useState("");
    const brainDragId = React.useRef(null);
    const brainDragOver = React.useRef(null);

    // allCats comes from brainCats (persisted, color-coded)
    const allCats = brainCats;
    const DAY_NAMES_SHORT = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

    function getCatColor(catId){ var c=brainCats.find(function(x){return x.id===catId;}); return c?c.color:"#c8a97a"; }
    function getCatEmoji(catId){ var c=brainCats.find(function(x){return x.id===catId;}); return c?c.emoji:"📌"; }

    function handleBrainDrop(catId) {
      const fromId = brainDragId.current;
      const toId = brainDragOver.current;
      if (!fromId || !toId || fromId === toId) { brainDragId.current=null; brainDragOver.current=null; return; }
      setBrainItems(function(prev) {
        const items = catId === "_unc"
          ? prev.filter(function(b){return !b.cat||b.cat==="uncategorized"||!brainCats.find(function(c){return c.id===b.cat;});})
          : prev.filter(function(b){return b.cat===catId&&!b.done;});
        const fromIdx = items.findIndex(function(b){return b.id===fromId;});
        const toIdx = items.findIndex(function(b){return b.id===toId;});
        if(fromIdx===-1||toIdx===-1) return prev;
        const reordered = [...items];
        const [moved] = reordered.splice(fromIdx,1);
        reordered.splice(toIdx,0,moved);
        const otherItems = prev.filter(function(b){return items.findIndex(function(x){return x.id===b.id;})===-1;});
        return [...otherItems,...reordered];
      });
      brainDragId.current=null; brainDragOver.current=null;
    }

    function smartCat(text){
      const t = text.toLowerCase();
      if(/order|buy|purchase|pick up|get more|restock|amazon|walmart|target|costco|ship|deliver|online|need to get/.test(t)) return "orders";
      if(/call|phone|voicemail|ring|text|email|reply|respond|message|reach out|follow up|contact|check with|ask/.test(t)) return "calls";
      if(/errand|drop off|return|library|pharmacy|prescription|dry clean|post office|bank|store|dentist|doctor|appointment|vet/.test(t)) return "errands";
      if(/paperwork|schedule|book|appoint|form|file|tax|insurance|admin|renewal|register|submit|sign|fill out|apply|renew/.test(t)) return "admin";
      if(/someday|maybe|eventually|would be nice|idea|dream|wish|research|look into|consider|explore/.test(t)) return "someday";
      if(/clean|fix|repair|organize|tidy|laundry|dishes|vacuum|wipe|declutter|home|house|mow|sweep|mop|bathroom|kitchen/.test(t)) return "household";
      if(/self|me time|read|journal|meditat|workout|gym|exercise|hobby|personal|hair|nails|skin|therapy/.test(t)) return "personal";
      return null;
    }

    function addItem(){
      if(!newText.trim()) return;
      const detected = smartCat(newText.trim());
      const cat = detected || (newCat!=="unfiled"&&newCat!=="all"?newCat:"uncategorized");
      AF_DEBUG && console.warn("[AF MIND ADD]", { text: newText.trim(), cat });
      setBrainItems(p=>[...p,{id:uid(),text:newText.trim(),cat:cat||"uncategorized",done:false,scheduledDay:null,assignedTo:null}]);
      setNewText("");
      setTimeout(function(){if(brainInputRef.current)brainInputRef.current.blur();},0);
    }

    function scheduleItem(id, day){
      setBrainItems(p=>p.map(function(b){
        if(b.id!==id) return b;
        var updated = {...b, scheduledDay:day};
        // Also add to tasks for that day
        if(day&&day!=="none"){
          setTasks(function(tp){return [...tp,{id:uid(),text:b.text,day:day,done:false,tier:"next3",fromBrain:true,brainId:id}];});
        }
        return updated;
      }));
    }

    function assignItem(id, person){
      setBrainItems(p=>p.map(function(b){return b.id===id?{...b,assignedTo:b.assignedTo===person?null:person}:b;}));
    }

    function fileItem(id, catId){
      setBrainItems(p=>p.map(function(b){return b.id===id?{...b,cat:catId}:b;}));
    }

    async function aiRecategorize(){
      const pending = brainItems.filter(b=>!b.done);
      if(!pending.length) return;
      setAiRecatLoading(true);
      try {
        const catList = allCats.map(c=>c.id+"="+c.label).join(", ");
        const res = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,system:"Categorize brain dump items into these categories: "+catList+", or uncategorized. Return ONLY JSON: {results:[{id,cat}]}. Use exact category IDs.",messages:[{role:"user",content:"Categorize:\n"+pending.map(b=>b.id+": "+b.text).join("\n")}]})});
        const d = await res.json();
        const txt = d.content?.find(b=>b.type==="text")?.text||"{}";
        const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
        if(parsed.results){ const map={}; parsed.results.forEach(r=>{map[r.id]=r.cat;}); setBrainItems(p=>p.map(b=>map[b.id]?{...b,cat:map[b.id]}:b)); }
      } catch(e){ AF_DEBUG && console.error("[AF] AI recategorize error (dev only)"); }
      setAiRecatLoading(false);
    }

    React.useEffect(function(){
      const pending = brainItems.filter(b=>!b.done);
      var _pc=null; try{_pc=JSON.parse(localStorage.getItem("af_brainPattern"));}catch(e){}
      if(_pc&&_pc.d===new Date().toDateString()){ if(!patternMsg&&_pc.m)setPatternMsg(_pc.m); }
      else if(pending.length>=3&&!patternMsg&&!patternLoading){
        setPatternLoading(true);
        var grouped={};
        pending.forEach(function(b){ if(!grouped[b.cat])grouped[b.cat]=[]; grouped[b.cat].push(b.text); });
        var summary=Object.entries(grouped).map(function(kv){return kv[0]+": "+kv[1].length+" items ("+kv[1].slice(0,3).join(", ")+")";}).join("\n");
        fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:150,system:"You are a home assistant. Look at these brain dump categories and notice ONE useful pattern. Be specific and actionable. Under 25 words.",messages:[{role:"user",content:summary}]})})
          .then(function(r){return r.json();})
          .then(function(d){var msg=d.content?.find(function(b){return b.type==="text";})?.text||""; if(msg){setPatternMsg(msg);try{localStorage.setItem("af_brainPattern",JSON.stringify({d:new Date().toDateString(),m:msg}));}catch(e){}}})
          .catch(function(){})
          .finally(function(){setPatternLoading(false);});
      }
    },[]);

    // Derived lists
    const active = brainItems.filter(function(b){return !b.done;});
    const done = brainItems.filter(function(b){return b.done;});
    const unfiled = active.filter(function(b){return !b.cat||b.cat==="uncategorized"||!brainCats.find(function(c){return c.id===b.cat;});});

    // Build person tabs from people state
    var MINOR_ROLES=["Kid","Teen","Baby"];
    var personTabs = people.filter(function(p){ return p&&p.name&&p.name.length>0 && !p.isMinor && !(p.age!=null && p.age<18) && !MINOR_ROLES.includes(p.role); }).map(function(p){ return {id:"person_"+p.id, label:p.name, initials:(p.name||"?")[0].toUpperCase(), color:p.color||T.blue}; });

    // Items for current tab
    function getTabItems(){
      var items;
      if(activeTab==="all") items=active;
      else if(activeTab==="unfiled") items=unfiled;
      else if(activeTab.startsWith("person_")){
        var pid=activeTab.replace("person_","");
        var pname=people.find(function(p){return p.id===pid;})?.name||"";
        items=active.filter(function(b){return b.assignedTo===pname;});
      } else {
        items=active.filter(function(b){return b.cat===activeTab;});
      }
      if(search) items=items.filter(function(b){return b.text.toLowerCase().includes(search.toLowerCase());});
      return items;
    }
    var tabItems = getTabItems();

    function BrainItemRow({item, catId}){
      const [editing,setEditing] = useState(false);
      const [val,setVal] = useState(item.text);
      const [isDragOver,setIsDragOver] = useState(false);
      const color = getCatColor(item.cat);
      const tint = color+"18";
      return (
        <div
          draggable
          onDragStart={function(e){brainDragId.current=item.id; var g=document.createElement("div"); g.style.cssText="position:fixed;top:-9999px;left:-9999px;"; document.body.appendChild(g); e.dataTransfer.setDragImage(g,0,0); setTimeout(function(){try{g.remove();}catch{}},0);}}
          onDragEnter={function(){brainDragOver.current=item.id;setIsDragOver(true);}}
          onDragLeave={function(){setIsDragOver(false);}}
          onDragOver={function(e){e.preventDefault();}}
          onDrop={function(){setIsDragOver(false);handleBrainDrop(catId||"_unc");}}
          onDragEnd={function(){setIsDragOver(false);}}
          style={{background:isDragOver?color+"30":tint,borderRadius:"0.75rem",padding:"0.6rem 0.75rem",marginBottom:"0.35rem",border:"1.5px solid "+(isDragOver?color:color+"30"),transition:"all 0.12s"}}>
          {/* Task text */}
          <div style={{display:"flex",alignItems:"flex-start",gap:"0.5rem",marginBottom:"0.45rem"}}>
            <div onClick={function(){setBrainItems(function(p){return p.map(function(x){return x.id===item.id?{...x,done:!x.done}:x;});});}} style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+color,background:item.done?color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,marginTop:2}}>
              {item.done&&<span style={{color:"#fff",fontSize:9}}>✓</span>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              {editing?(
                <div style={{display:"flex",gap:"0.3rem"}}>
                  <input value={val} onChange={function(e){setVal(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"){setBrainItems(function(p){return p.map(function(x){return x.id===item.id?{...x,text:val}:x;});});setEditing(false);}if(e.key==="Escape")setEditing(false);}} style={{...inp({flex:1,padding:"0.25rem 0.45rem",fontSize:"0.84rem"})}} autoFocus/>
                  <button onClick={function(){setBrainItems(function(p){return p.map(function(x){return x.id===item.id?{...x,text:val}:x;});});setEditing(false);}} style={btnP(color,{fontSize:"0.7rem",padding:"0.25rem 0.5rem"})}>✓</button>
                </div>
              ):(
                <span onClick={function(){setEditing(true);}} style={{fontSize:"0.88rem",color:item.done?T.textFaint:T.textDark,textDecoration:item.done?"line-through":"none",cursor:"text",lineHeight:1.4,display:"block"}}>{item.text}</span>
              )}
            </div>
            <button onClick={function(){ AF_DEBUG && console.warn("[AF MIND DELETE]", { id: item.id, text: item.text }); setBrainItems(function(p){return p.filter(function(x){return x.id!==item.id;});});}} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:T.textFaint,padding:"0 2px",flexShrink:0}}>×</button>
          </div>
          {/* Controls row: File · Date · Initials */}
          <div style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
            <select value={item.cat||"uncategorized"} onChange={function(e){fileItem(item.id,e.target.value);}} style={{fontSize:"0.7rem",padding:"2px 4px",borderRadius:5,border:"0.5px solid "+color+"50",background:"rgba(255,255,255,0.6)",color:T.textMid,fontFamily:"inherit",cursor:"pointer"}}>
              <option value="uncategorized">📁 Unfiled</option>
              {brainCats.map(function(c){return <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>;})}
            </select>
            {(function(){
              var [dateOpen,setDateOpen] = useState(false);
              var tomorrowName = DAY_NAMES_SHORT[(new Date(TODAY).getDay()+1)%7];
              var quickDays = [{label:"Today",val:TODAY_NAME},{label:"Tomorrow",val:tomorrowName}];
              var remainingDays = DAY_NAMES_SHORT.filter(function(d){return d!==TODAY_NAME&&d!==tomorrowName;});
              var hasDate = !!item.scheduledDay;
              return (
                <div style={{position:"relative",display:"inline-block"}}>
                  <button onClick={function(){setDateOpen(function(v){return !v;});}} style={{fontSize:"0.7rem",padding:"2px 7px",borderRadius:5,border:"0.5px solid "+(hasDate?color:color+"50"),background:hasDate?color+"18":"rgba(255,255,255,0.6)",color:hasDate?color:T.textMid,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",gap:"3px",fontWeight:hasDate?700:400}}>
                    📅 {hasDate?item.scheduledDay:"Date"}
                    {hasDate&&<span onClick={function(e){e.stopPropagation();scheduleItem(item.id,null);}} style={{marginLeft:2,opacity:0.6,fontWeight:900,fontSize:"0.8rem",lineHeight:1}}>×</span>}
                  </button>
                  {dateOpen&&(
                    <div onClick={function(e){e.stopPropagation();}} style={{position:"absolute",bottom:"calc(100% + 6px)",left:0,zIndex:200,background:T.surface,border:"1.5px solid "+T.border,borderRadius:"0.85rem",padding:"0.65rem 0.75rem",boxShadow:"0 8px 32px rgba(0,0,0,0.14)",minWidth:220}}>
                      <div style={{fontSize:"0.65rem",fontWeight:700,color:T.textFaint,marginBottom:"0.4rem",textTransform:"uppercase",letterSpacing:"0.06em"}}>Quick pick</div>
                      <div style={{display:"flex",gap:"0.3rem",flexWrap:"wrap",marginBottom:"0.55rem"}}>
                        {quickDays.map(function(q){
                          var isSel=item.scheduledDay===q.val;
                          return <button key={q.val} onClick={function(){scheduleItem(item.id,q.val);setDateOpen(false);}} style={{fontSize:"0.7rem",padding:"3px 9px",borderRadius:"2rem",border:"1.5px solid "+(isSel?color:T.border),background:isSel?color:"transparent",color:isSel?"#fff":T.textMid,fontFamily:"inherit",cursor:"pointer",fontWeight:isSel?700:400}}>{q.label}</button>;
                        })}
                      </div>
                      <div style={{fontSize:"0.65rem",fontWeight:700,color:T.textFaint,marginBottom:"0.4rem",textTransform:"uppercase",letterSpacing:"0.06em"}}>This week</div>
                      <div style={{display:"flex",gap:"0.25rem",flexWrap:"wrap",marginBottom:"0.55rem"}}>
                        {remainingDays.map(function(d){
                          var isSel=item.scheduledDay===d;
                          return <button key={d} onClick={function(){scheduleItem(item.id,d);setDateOpen(false);}} style={{fontSize:"0.7rem",padding:"3px 8px",borderRadius:"2rem",border:"1.5px solid "+(isSel?color:T.border),background:isSel?color:"transparent",color:isSel?"#fff":T.textMid,fontFamily:"inherit",cursor:"pointer",fontWeight:isSel?700:400}}>{d.slice(0,3)}</button>;
                        })}
                      </div>
                      <div style={{fontSize:"0.65rem",fontWeight:700,color:T.textFaint,marginBottom:"0.3rem",textTransform:"uppercase",letterSpacing:"0.06em"}}>Specific date</div>
                      <input type="date" defaultValue={item.scheduledExactDate||""} onChange={function(e){
                        var raw=e.target.value;
                        if(!raw){scheduleItem(item.id,null);return;}
                        var d=new Date(raw+"T12:00:00");
                        var dayName=DAY_NAMES_SHORT[d.getDay()];
                        var mo=d.toLocaleString("default",{month:"short"});
                        var label=mo+" "+d.getDate();
                        setBrainItems(function(p){return p.map(function(x){return x.id===item.id?{...x,scheduledDay:label,scheduledExactDate:raw}:x;});});
                        setDateOpen(false);
                      }} style={{...inp({fontSize:"0.72rem",padding:"0.28rem 0.5rem",width:"100%"})}}/>
                      {hasDate&&<button onClick={function(){scheduleItem(item.id,null);setDateOpen(false);}} style={{marginTop:"0.4rem",background:"none",border:"none",cursor:"pointer",fontSize:"0.68rem",color:T.rose,fontFamily:"inherit",fontWeight:600,padding:0}}>✕ Clear date</button>}
                    </div>
                  )}
                </div>
              );
            })()}
            <div style={{flex:1}}/>
            {people.filter(function(p){ return p&&p.name&&p.name.length>0 && !personIsMinor(p)&&!MINOR_ROLES.includes(p.role); }).map(function(p){
              var isAssigned=item.assignedTo===p.name;
              return(
                <button key={p.id} onClick={function(){assignItem(item.id,p.name);}} style={{width:22,height:22,borderRadius:"50%",border:"none",background:isAssigned?(p.color||T.blue):"rgba(0,0,0,0.08)",color:isAssigned?"#fff":T.textMid,fontSize:"0.68rem",fontWeight:700,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",transition:"all 0.15s"}}>
                  {(p.name||"?")[0].toUpperCase()}
                </button>
              );
            })}
          </div>
          {item.scheduledDay&&<div style={{fontSize:"0.65rem",color:color,fontWeight:600,marginTop:"0.3rem"}}>📅 {item.scheduledDay}</div>}
        </div>
      );
    }

    return (
      <div style={{paddingBottom:"2rem"}}>
        {/* Exhale header */}
        <div style={{textAlign:"center",marginBottom:"1rem",paddingTop:"0.25rem",position:"relative"}}>
          <button onClick={function(){goTab("anchor");}} style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:"2px 4px",display:"flex",alignItems:"center",opacity:0.5}}>
            <Icon name="arrow-left" size={17} color={T.textSoft}/>
          </button>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.45rem",fontWeight:700,color:T.textDark,letterSpacing:"0.03em"}}>Exhale.</div>
          <div style={{fontSize:"0.78rem",color:T.textSoft,marginTop:"0.15rem",lineHeight:1.6}}>Clear your mind — then let it go.</div>
        </div>
        {/* AI Pattern banner */}
        {patternMsg&&(
          <div style={{background:"linear-gradient(135deg,"+T.lavPale+","+T.bluePale+")",border:"1px solid "+T.lavender+"40",borderRadius:"0.9rem",padding:"0.75rem 1rem",marginBottom:"0.85rem",display:"flex",gap:"0.6rem",alignItems:"flex-start"}}>
            <span style={{fontSize:"1rem",flexShrink:0}}>✦</span>
            <div style={{flex:1}}>
              <div style={{fontSize:"0.68rem",fontWeight:800,color:T.lavender,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>Compass noticed</div>
              <div style={{fontSize:"0.83rem",color:T.textDark,lineHeight:1.55}}>{patternMsg}</div>
            </div>
            <button onClick={function(){setPatternMsg(null);try{localStorage.setItem("af_brainPattern",JSON.stringify({d:new Date().toDateString(),m:""}));}catch(e){}}} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:16,flexShrink:0}}>×</button>
          </div>
        )}

        {/* Input */}
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1rem",padding:"0.85rem",marginBottom:"0.75rem"}}>
          <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.5rem"}}>
            <input ref={brainInputRef} value={newText} onChange={function(e){setNewText(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"){addItem();}}} placeholder="Type it here — exhale…" style={{...inp({flex:1,fontSize:"0.88rem"})}} autoFocus/>
            <button onClick={addItem} disabled={!newText.trim()} style={{...btnP(T.blue,{fontSize:"0.82rem",padding:"0.5rem 0.9rem",opacity:newText.trim()?1:0.4})}}>Add</button>
          </div>
          <div style={{display:"flex",gap:"0.3rem",flexWrap:"wrap"}}>
            {brainCats.map(function(c){
              var isSel=newCat===c.id;
              return <button key={c.id} onClick={function(){setNewCat(c.id);try{sessionStorage.setItem("af_brainNewCat",c.id);}catch{}_setBrainActiveTab(c.id);}} style={{background:isSel?c.color:"transparent",color:isSel?"#fff":T.textMid,border:"1.5px solid "+(isSel?c.color:T.border),borderRadius:"2rem",padding:"0.18rem 0.55rem",cursor:"pointer",fontSize:"0.68rem",fontFamily:"inherit",fontWeight:isSel?700:400,transition:"all 0.12s"}}>{c.emoji} {c.label}</button>;
            })}
          </div>
        </div>

        {/* Search */}
        <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.6rem"}}>
          <input value={search} onChange={function(e){setBrainSearch(e.target.value);}} placeholder="Search..." style={{...inp({flex:1,fontSize:"0.82rem",padding:"0.35rem 0.65rem"})}}/>
          <div style={{fontSize:"0.72rem",color:T.textFaint}}>{active.length} active</div>
          <button onClick={aiRecategorize} disabled={aiRecatLoading} style={{background:"none",border:"1.5px solid "+T.lavender,borderRadius:"2rem",padding:"0.2rem 0.65rem",cursor:"pointer",fontSize:"0.7rem",fontWeight:700,color:T.lavender,opacity:aiRecatLoading?0.6:1,flexShrink:0}}>
            {aiRecatLoading?"⟳":"✨"} AI sort
          </button>
        </div>

        {/* Tab bar */}
        <ScrollTabs style={{borderBottom:"1.5px solid "+T.borderSoft,marginBottom:"0.75rem"}}>
          <button onClick={function(){_setBrainActiveTab("all");}} style={{background:"none",border:"none",borderBottom:activeTab==="all"?"2.5px solid "+T.blue:"2.5px solid transparent",color:activeTab==="all"?T.blue:T.textFaint,padding:"0.45rem 0.75rem",cursor:"pointer",fontSize:"0.75rem",fontWeight:activeTab==="all"?700:500,fontFamily:"inherit",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"0.3rem"}}>
            🗂 All
            <span style={{background:T.blue+"22",color:T.blue,borderRadius:"2rem",padding:"1px 5px",fontSize:"0.65rem",fontWeight:700}}>{active.length}</span>
          </button>
          <button onClick={function(){_setBrainActiveTab("unfiled");}} style={{background:"none",border:"none",borderBottom:activeTab==="unfiled"?"2.5px solid #c8a97a":"2.5px solid transparent",color:activeTab==="unfiled"?"#c8834a":T.textFaint,padding:"0.45rem 0.75rem",cursor:"pointer",fontSize:"0.75rem",fontWeight:activeTab==="unfiled"?700:500,fontFamily:"inherit",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"0.3rem"}}>
            📥 Unfiled
            {unfiled.length>0&&<span style={{background:"#e05c5c",color:"#fff",borderRadius:"2rem",padding:"1px 6px",fontSize:"0.65rem",fontWeight:700}}>{unfiled.length}</span>}
          </button>
          {personTabs.map(function(pt){
            var count=active.filter(function(b){var pname=people.find(function(p){return p.id===pt.id.replace("person_","");})?.name||""; return b.assignedTo===pname;}).length;
            return(
              <button key={pt.id} onClick={function(){_setBrainActiveTab(pt.id);}} style={{background:"none",border:"none",borderBottom:activeTab===pt.id?"2.5px solid "+(pt.color||T.blue):"2.5px solid transparent",color:activeTab===pt.id?(pt.color||T.blue):T.textFaint,padding:"0.45rem 0.75rem",cursor:"pointer",fontSize:"0.75rem",fontWeight:activeTab===pt.id?700:500,fontFamily:"inherit",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                {pt.label}
                {count>0&&<span style={{background:pt.color||T.blue,color:"#fff",borderRadius:"2rem",padding:"1px 6px",fontSize:"0.65rem",fontWeight:700}}>{count}</span>}
              </button>
            );
          })}
          {brainCats.map(function(cat){
            var count=active.filter(function(b){return b.cat===cat.id;}).length;
            if(count===0) return null;
            return(
              <button key={cat.id} onClick={function(){_setBrainActiveTab(cat.id);}} style={{background:"none",border:"none",borderBottom:activeTab===cat.id?"2.5px solid "+cat.color:"2.5px solid transparent",color:activeTab===cat.id?cat.color:T.textFaint,padding:"0.45rem 0.75rem",cursor:"pointer",fontSize:"0.75rem",fontWeight:activeTab===cat.id?700:500,fontFamily:"inherit",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:cat.color,display:"inline-block",flexShrink:0}}/>
                {cat.label}
                <span style={{background:cat.color+"22",color:cat.color,borderRadius:"2rem",padding:"1px 5px",fontSize:"0.65rem",fontWeight:700}}>{count}</span>
              </button>
            );
          })}
        </ScrollTabs>

        {/* Items */}
        {tabItems.length===0&&(
          <div style={{textAlign:"center",padding:"2rem 1rem",color:T.textFaint,fontStyle:"italic",fontSize:"0.84rem"}}>
            {activeTab==="all"?"Nothing in your Clear Your Mind list yet ✓":activeTab==="unfiled"?"All items are filed ✓":"Nothing here yet"}
          </div>
        )}
        {tabItems.map(function(item){return <BrainItemRow key={item.id} item={item} catId={item.cat||"_unc"}/>;}) }

        {/* Done */}
        {done.length>0&&(
          <div style={{marginTop:"1rem",paddingTop:"0.75rem",borderTop:"1px dashed "+T.borderSoft}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.5rem"}}>
              <div style={{fontSize:"0.78rem",color:T.textFaint,fontWeight:700}}>✓ Done ({done.length})</div>
              <button onClick={function(){setBrainItems(function(p){return p.filter(function(b){return !b.done;});});}} style={{fontSize:"0.72rem",color:T.rose||"#d85a30",background:"none",border:"1.5px solid "+T.borderSoft,borderRadius:"2rem",padding:"0.18rem 0.65rem",cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑 Clear completed</button>
            </div>
            {done.map(function(item){return <BrainItemRow key={item.id} item={item} catId={item.cat||"_unc"}/>;}) }
          </div>
        )}
      </div>
    );
  }

  _hfRenders.BurnoutTab = function BurnoutTab(){
    return(
      <div>
        <div style={{...card({background:`linear-gradient(135deg,${T.rosePale},${T.sandPale})`,border:`2px solid ${T.rose}55`,textAlign:"center",padding:"2rem"})}}>
          <div style={{fontSize:"2.8rem",marginBottom:"0.6rem"}}>🛟</div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.7rem",color:T.textDark,margin:"0 0 0.5rem",fontWeight:700}}>Survival Mode</h2>
          <p style={{color:T.textMid,fontSize:"0.87rem",lineHeight:1.65,maxWidth:300,margin:"0 auto",fontWeight:600}}>You are not behind. You are not failing.<br/><span style={{fontWeight:400,color:T.textSoft}}>Some days, just getting through is the win.</span></p>
        </div>
        <div style={{...card({background:T.surface,border:`1.5px solid ${T.borderSoft}`,padding:"0.85rem 1.1rem",textAlign:"center"})}}>
          <p style={{color:T.textSoft,fontSize:"0.82rem",margin:0,lineHeight:1.6,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>Only three things matter today. Check them off and you're done.</p>
        </div>
        {BURNOUT_TASKS.map(function(t){var checked=burnoutChecked.includes(t.id);return(
          <button key={t.id} onClick={()=>setBurnoutChecked(p=>p.includes(t.id)?p.filter(x=>x!==t.id):[...p,t.id])} style={{...card({cursor:"pointer",display:"flex",alignItems:"center",gap:"1rem",padding:"1.15rem 1.3rem",background:checked?`linear-gradient(135deg,${T.sagePale},${T.sage}18)`:T.surface,border:`2px solid ${checked?T.sage:T.borderSoft}`,width:"100%",textAlign:"left",transition:"all 0.18s"})}}>
            <span style={{fontSize:"1.6rem"}}>{t.emoji}</span>
            <span style={{flex:1,fontWeight:700,color:checked?T.sageDark:T.textDark,fontSize:"1rem",textDecoration:checked?"line-through":"none"}}>{t.label}</span>
            <div style={{width:28,height:28,borderRadius:"50%",border:`2.5px solid ${checked?T.sage:T.border}`,background:checked?T.sage:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.18s"}}>{checked&&<Icon name="check" size={14} color="#fff"/>}</div>
          </button>
        );})}
        {burnoutChecked.length===3&&<div style={{...card({background:`linear-gradient(135deg,${T.sagePale},${T.bluePale})`,border:`2px solid ${T.sage}60`,textAlign:"center",padding:"1.5rem"})}}>
          <div style={{fontSize:"2rem",marginBottom:"0.4rem"}}>🌿</div>
          <p style={{color:T.sageDark,fontWeight:700,fontSize:"1.05rem",margin:"0 0 0.5rem"}}>You did it. That's everything.</p>
          <p style={{fontWeight:500,fontSize:"0.86rem",color:T.textMid,margin:0}}>Rest now. You showed up today — that matters.</p>
        </div>}
        <div style={{...card({background:"transparent",border:`1.5px dashed ${T.borderSoft}`,textAlign:"center",padding:"1rem"})}}>
          <p style={{color:T.textFaint,fontSize:"0.78rem",margin:"0 0 0.5rem",fontStyle:"italic"}}>You don't have to do everything. Just enough.</p>
          <button onClick={()=>setFlowMode("Smooth")} style={{background:"none",border:`1.5px solid ${T.border}`,borderRadius:"2rem",padding:"0.3rem 1rem",cursor:"pointer",fontSize:"0.73rem",color:T.textSoft,fontFamily:"inherit",fontWeight:600}}>✨ Back to a full day when ready</button>
        </div>
      </div>
    );
  }

  // ── Tide Pool ───────────────────────────────────────────────────────────────
  const COVE_MIN_OPEN  = 10;

  function getDefaultTidePoolData() {
    var kids = people.filter(function(p){ return p.role==="Kid"||p.role==="Teen"||personIsMinor(p); });
    if(kids.length===0) kids = [{id:"k1",name:"Child 1"}];
    return kids.map(function(k){
      return {
        kidId: k.id,
        kidName: k.name,
        shells: 0,
        chores: [
          {id:uid(),name:"Make bed",pts:1,done:false},
          {id:uid(),name:"Clear dishes",pts:1,done:false},
          {id:uid(),name:"Read 20 mins",pts:1,done:false},
        ],
        treasures: [
          {id:uid(),name:"Extra screen time",icon:"📱",cost:10},
          {id:uid(),name:"Pick dinner",icon:"🍕",cost:15},
          {id:uid(),name:"Movie night pick",icon:"🎬",cost:20},
          {id:uid(),name:"Stay up late",icon:"🌙",cost:25},
          {id:uid(),name:"Special outing",icon:"🎡",cost:35},
        ],
      };
    });
  }

  _hfRenders.TidePoolTab = function TidePoolTab() {
    var realKids = people.filter(function(p){ return p.role==="Kid"||p.role==="Teen"||personIsMinor(p); });
    var rosterEmpty = realKids.length===0;
    // Display-only fallback so the tab renders when the roster hasn't loaded.
    // NEVER used to rebuild/prune saved coveData — see initializer below.
    var rawKids = rosterEmpty ? [{id:"k1",name:"Child 1",color:"#c8a97a"}] : realKids;

    // Merge persisted coveData with current people list.
    // Invariant: NEVER drop a saved kid record. Previously this rebuilt the list
    // as rawKids.map(...), which discarded any saved record whose kidId wasn't in
    // the current roster — and when af_people was empty, the synthetic fallback
    // matched nothing, so ALL real chores/treasures were replaced with defaults and
    // then persisted by the daily-reset/edit setCoveData calls. That was the
    // chores/treasures-erasing bug.
    var [kids, setKids] = useState(function(){
      var saved = coveData;
      if(!saved||!saved.length) return getDefaultTidePoolData();
      // Roster hasn't loaded (using synthetic fallback): do NOT reconcile against a
      // fake list. Return saved as-is so nothing is dropped.
      if(rosterEmpty) return saved.slice();
      // Roster is real: keep ALL saved records in place (orphans included — a saved
      // record whose kid isn't currently in people is preserved, not pruned), and
      // append a fresh record only for genuinely new kids.
      var savedIds = {};
      saved.forEach(function(d){ if(d && d.kidId) savedIds[d.kidId]=true; });
      var merged = saved.slice();
      realKids.forEach(function(p){
        if(!savedIds[p.id]){
          merged.push({kidId:p.id,kidName:p.name,shells:0,chores:[
            {id:uid(),name:"Make bed",pts:1,done:false},
            {id:uid(),name:"Clear dishes",pts:1,done:false},
          ],treasures:[
            {id:uid(),name:"Extra screen time",icon:"📱",cost:10},
            {id:uid(),name:"Pick dinner",icon:"🍕",cost:15},
            {id:uid(),name:"Movie night pick",icon:"🎬",cost:20},
            {id:uid(),name:"Stay up late",icon:"🌙",cost:25},
            {id:uid(),name:"Special outing",icon:"🎡",cost:35},
          ]});
        }
      });
      return merged;
    });

    var [selIdx, setSelIdx] = useState(0);
    var [chestOpen, setChestOpen] = useState(false);
    var [histOpen, setHistOpen] = useState(false);
    var [selectedTreasure, setSelectedTreasure] = useState(null);
    var [claimed, setClaimed] = useState(null);
    var [flyName, setFlyName] = useState("");
    var [flyPts, setFlyPts] = useState(1);

    // ── Daily chore reset ──
    React.useEffect(function(){
      var resetKey = "af_choreResetDate";
      var todayStr = TODAY.toISOString().split("T")[0];
      var lastReset;
      try { lastReset = localStorage.getItem(resetKey); } catch { lastReset = null; }
      if(lastReset !== todayStr) {
        setKids(function(prev){
          var next = prev.map(function(k){
            return Object.assign({},k,{chores:k.chores.map(function(c){return Object.assign({},c,{done:false});})});
          });
          setCoveData(next);
          return next;
        });
        try { localStorage.setItem(resetKey, todayStr); } catch {}
      }
    }, [TODAY]);

    var kid = kids[Math.min(selIdx, kids.length-1)] || kids[0];

    function updateKid(patch) {
      setKids(function(prev){
        var next = prev.map(function(k,i){ return i===selIdx?Object.assign({},k,patch):k; });
        setCoveData(next);
        return next;
      });
    }

    function toggleChore(choreId) {
      var ch = kid.chores.find(function(c){ return c.id===choreId; });
      if(!ch) return;
      var newShells = ch.done ? Math.max(0, kid.shells - ch.pts) : kid.shells + ch.pts;
      updateKid({
        shells: newShells,
        chores: kid.chores.map(function(c){ return c.id===choreId?Object.assign({},c,{done:!c.done}):c; })
      });
    }

    function giveShell() {
      if(!flyName.trim()) return;
      updateKid({shells: kid.shells + flyPts});
      setFlyName("");
    }

    function openChest() {
      if(kid.shells < COVE_MIN_OPEN) return;
      setChestOpen(true);
      setSelectedTreasure(null);
      setClaimed(null);
    }

    function claimTreasure() {
      if(!selectedTreasure || kid.shells < selectedTreasure.cost) return;
      var t = selectedTreasure;
      var entry = {id:uid(), name:t.name, icon:t.icon||"🎁", cost:t.cost, date:new Date().toISOString()};
      var hist = [entry].concat((kid.rewardHistory||[])).slice(0,50);
      updateKid({shells: kid.shells - t.cost, rewardHistory: hist});
      setClaimed(t);
      setSelectedTreasure(null);
      window.dispatchEvent(new CustomEvent("af-celebrate", { detail: { heading: "Prize claimed!", title: t.name, message: ((kid && kid.kidName) ? kid.kidName + ", enjoy your reward! " : "Enjoy your reward! ") + "You earned it." } }));
    }

    function closeChest() {
      setChestOpen(false);
      setSelectedTreasure(null);
      setClaimed(null);
    }

    var shellCount = kid.shells;
    var ready = shellCount >= COVE_MIN_OPEN;
    var nextThreshold = Math.ceil((shellCount + 1) / COVE_MIN_OPEN) * COVE_MIN_OPEN;
    var shellSlots = Math.max(nextThreshold, shellCount + 5);
    var sortedTreasures = (kid.treasures||[]).slice().sort(function(a,b){return a.cost-b.cost;});

    var navyHex = "#1a2744";
    var sandHex = "#c8a97a";
    var tealHex = "#1d9e75";

    return (
      <div>
        <div style={{textAlign:"center",marginBottom:"1.25rem",position:"relative"}}>
          <button onClick={function(){goTab("anchor");}} style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:"2px 4px",display:"flex",alignItems:"center",opacity:0.5}}>
            <Icon name="arrow-left" size={17} color={T.textSoft}/>
          </button>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.55rem",fontWeight:700,color:T.textDark,letterSpacing:"0.04em"}}>🏝️ Tide Pool</div>
          <div style={{fontSize:"0.78rem",color:T.textSoft,marginTop:"2px"}}>Earn shells, open the chest, choose your treasure</div>
        </div>

        {/* Kid selector */}
        {kids.length > 1 && (
          <div style={{display:"flex",justifyContent:"center",gap:"0.5rem",marginBottom:"1.25rem",flexWrap:"wrap"}}>
            {kids.map(function(k,i){
              return (
                <button key={k.kidId} onClick={function(){setSelIdx(i);setChestOpen(false);setSelectedTreasure(null);setClaimed(null);}}
                  style={{padding:"0.35rem 1.1rem",borderRadius:"99px",border:"1.5px solid "+(i===selIdx?navyHex:T.border),background:i===selIdx?navyHex:"transparent",color:i===selIdx?"#faf8f4":T.textMid,fontSize:"0.82rem",cursor:"pointer",fontFamily:"inherit",fontWeight:i===selIdx?700:500,transition:"all 0.15s"}}>
                  {k.kidName}
                </button>
              );
            })}
          </div>
        )}

        {/* Shell counter + Chest */}
        <div style={{textAlign:"center",marginBottom:"1rem"}}>
          <div style={{fontSize:"0.8rem",color:T.textSoft,marginBottom:"0.5rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem"}}>
            <span style={{fontSize:"1.1rem"}}>🐚</span>
            <span style={{fontSize:"1.5rem",fontWeight:700,color:navyHex,fontFamily:"'Cormorant Garamond',serif"}}>{shellCount}</span>
            <span style={{fontSize:"0.8rem"}}>shells</span>
          </div>

          {/* SVG Chest */}
          <div onClick={ready&&!chestOpen?openChest:undefined}
            style={{display:"inline-block",cursor:ready&&!chestOpen?"pointer":"default",transition:"transform 0.12s",userSelect:"none"}}
            title={ready&&!chestOpen?"Open the chest!":""}>
            <svg width="140" height="112" viewBox="0 0 160 128" xmlns="http://www.w3.org/2000/svg">
              {/* Body */}
              <rect x="10" y="58" width="140" height="60" rx="8" fill="#8B5E2A" stroke="#5c3a0e" strokeWidth="1.5"/>
              <rect x="10" y="58" width="140" height="14" rx="0" fill="#6b4720"/>
              {[66,73,80,87,94].map(function(y){ return <rect key={y} x="22" y={y} width="116" height="3" rx="1.5" fill={sandHex} opacity="0.5"/>; })}
              {/* Lid */}
              <rect x="10" y={chestOpen?6:24} width="140" height="38" rx="8" fill="#a06c30" stroke="#5c3a0e" strokeWidth="1.5"
                style={{transition:"y 0.3s ease"}}
                transform={chestOpen?"rotate(-20,80,62)":undefined}/>
              <rect x="10" y="54" width="140" height="8" rx="0" fill="#8B5E2A"/>
              {[30,37,44].map(function(y){ return <rect key={y} x="22" y={y} width="116" height="3" rx="1.5" fill={sandHex} opacity="0.45"/>; })}
              {/* Lock — hidden when open */}
              {!chestOpen && <>
                <rect x="67" y="46" width="26" height="20" rx="4" fill={sandHex} stroke="#8a6a2a" strokeWidth="1"/>
                <path d="M73 46 Q73 36 80 36 Q87 36 87 46" fill="none" stroke={sandHex} strokeWidth="3" strokeLinecap="round"/>
                <circle cx="80" cy="57" r="3.5" fill="#8B5E2A"/>
              </>}
            </svg>
          </div>

          <div style={{fontSize:"0.8rem",marginTop:"0.4rem",minHeight:"1.2rem",fontWeight:ready&&!chestOpen?700:400,color:ready&&!chestOpen?tealHex:T.textSoft}}>
            {chestOpen?"":ready?"Tap the chest to open it!":`${COVE_MIN_OPEN-shellCount} more shell${COVE_MIN_OPEN-shellCount===1?"":"s"} to open`}
          </div>
        </div>

        {/* Shell beach */}
        <div style={{display:"flex",justifyContent:"center",flexWrap:"wrap",gap:"5px",maxWidth:460,margin:"0 auto 0.5rem"}}>
          {Array.from({length:shellSlots}).map(function(_,i){
            return (
              <div key={i} style={{width:32,height:32,borderRadius:"50%",border:"1.5px "+(i<shellCount?"solid":"dashed")+" "+sandHex,background:i<shellCount?"#fdf5e8":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",transition:"all 0.2s"}}>
                {i<shellCount?"🐚":""}
              </div>
            );
          })}
        </div>
        <div style={{textAlign:"center",fontSize:"0.72rem",color:T.textFaint,marginBottom:"1.25rem"}}>
          {ready&&!chestOpen
            ? <span style={{color:tealHex,fontWeight:600}}>🎉 Ready to open!</span>
            : shellCount<COVE_MIN_OPEN&&<span>{COVE_MIN_OPEN-shellCount} more shell{COVE_MIN_OPEN-shellCount===1?"":"s"} to open</span>
          }
        </div>

        {/* Treasure chest panel */}
        {chestOpen && (
          <div style={{...card({background:"#fdf5e8",border:"1.5px solid "+sandHex}),marginBottom:"1rem"}}>
            {claimed ? (
              <div style={{textAlign:"center",padding:"0.5rem 0"}}>
                <div style={{fontSize:"2.5rem",marginBottom:"0.4rem"}}>{claimed.icon}</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.2rem",fontWeight:700,color:"#412402",marginBottom:"0.2rem"}}>{kid.kidName} claimed: {claimed.name}!</div>
                <div style={{fontSize:"0.8rem",color:"#633806",marginBottom:"0.85rem"}}>{kid.shells>0?(kid.shells>=COVE_MIN_OPEN?"Ready to open again! ":"Keep collecting — ")+kid.shells+" shell"+(kid.shells===1?"":"s")+" saved.":"Keep earning shells to fill the beach again! 🐚"}</div>
                <button onClick={closeChest} style={{...btnS(),fontSize:"0.8rem",border:"1px solid "+sandHex,color:"#854f0b"}}>Close chest</button>
              </div>
            ) : (
              <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.25rem"}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:"#412402"}}>The chest is open!</div>
                  <button onClick={closeChest} style={{background:"none",border:"none",cursor:"pointer",fontSize:"1.1rem",color:"#854f0b",padding:"2px 4px"}}>✕</button>
                </div>
                <div style={{fontSize:"0.78rem",color:"#633806",marginBottom:"1rem"}}>{selectedTreasure?"Nice choice! Tap \"Claim treasure\" to spend your shells.":"Pick your treasure — or close and keep saving for something bigger."}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:"0.5rem",marginBottom:"0.85rem"}}>
                  {sortedTreasures.map(function(t){
                    var canAfford = kid.shells >= t.cost;
                    var isSel = selectedTreasure&&selectedTreasure.id===t.id;
                    return (
                      <div key={t.id}
                        onClick={canAfford?function(){setSelectedTreasure(isSel?null:t);}:undefined}
                        style={{background:"#fffdf8",border:(isSel?"2px solid "+navyHex:"1px solid #e8d8b8"),borderRadius:"0.75rem",padding:"0.7rem 0.5rem",textAlign:"center",cursor:canAfford?"pointer":"default",opacity:canAfford?1:0.42,transition:"all 0.15s"}}>
                        <div style={{fontSize:"1.5rem",marginBottom:"0.3rem"}}>{t.icon}</div>
                        <div style={{fontSize:"0.76rem",fontWeight:600,color:"#412402",marginBottom:"0.2rem",lineHeight:1.3}}>{t.name}</div>
                        <div style={{fontSize:"0.7rem",color:canAfford?tealHex:"#b4b2a9"}}>{t.cost} 🐚{!canAfford?" · "+(t.cost-kid.shells)+" more":""}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
                  <button onClick={closeChest} style={{...btnS(),fontSize:"0.8rem",border:"1px solid "+sandHex,color:"#854f0b",padding:"0.45rem 1rem"}}>Keep saving 🐚</button>
                  <button onClick={claimTreasure} disabled={!selectedTreasure}
                    style={{...btnP(navyHex),fontSize:"0.8rem",padding:"0.45rem 1rem",opacity:selectedTreasure?1:0.35,cursor:selectedTreasure?"pointer":"default"}}>Claim treasure</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Reward history */}
        {(kid.rewardHistory||[]).length>0 && (
          <div style={{...card(),marginBottom:"1rem"}}>
            <div onClick={function(){setHistOpen(!histOpen);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
              <div style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem"}}>Reward history</div>
              <span style={{fontSize:"0.74rem",color:T.textFaint}}>{histOpen?"Hide":((kid.rewardHistory||[]).length+" claimed")}</span>
            </div>
            {histOpen && (
              <div style={{marginTop:"0.6rem"}}>
                {(kid.rewardHistory||[]).map(function(h){
                  return (
                    <div key={h.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.35rem 0",borderBottom:"1px solid "+T.borderSoft,fontSize:"0.8rem"}}>
                      <span style={{fontSize:"1rem"}}>{h.icon||"🎁"}</span>
                      <span style={{flex:1,color:T.textDark}}>{h.name}</span>
                      <span style={{color:T.textSoft,fontSize:"0.72rem"}}>{h.cost} 🐚</span>
                      <span style={{color:T.textFaint,fontSize:"0.7rem",minWidth:"56px",textAlign:"right"}}>{h.date?new Date(h.date).toLocaleDateString(undefined,{month:"short",day:"numeric"}):""}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Chores */}
        <div style={card()}>
          <div style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem",marginBottom:"0.75rem"}}>Today's chores</div>
          {(kid.chores||[]).length===0&&<div style={{color:T.textSoft,fontSize:"0.82rem",marginBottom:"0.65rem"}}>No chores yet — add some in Settings.</div>}
          {(kid.chores||[]).map(function(ch){
            return (
              <div key={ch.id} onClick={function(){toggleChore(ch.id);}}
                style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.55rem 0.75rem",borderRadius:"0.65rem",border:"1px solid "+(ch.done?T.sage+"60":T.border),background:ch.done?T.sagePale:T.white,marginBottom:"0.45rem",cursor:"pointer",transition:"all 0.15s"}}>
                <div style={{width:20,height:20,borderRadius:"50%",border:"1.5px solid "+(ch.done?tealHex:sandHex),background:ch.done?tealHex:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"11px",color:ch.done?"#fff":"transparent",transition:"all 0.15s"}}>
                  {ch.done?"✓":""}
                </div>
                <div style={{flex:1,fontSize:"0.85rem",color:ch.done?T.textSoft:T.textDark,textDecoration:ch.done?"line-through":"none"}}>{ch.name}</div>
                <div style={{fontSize:"0.76rem",color:"#8a6a3a",fontWeight:600}}>+{ch.pts} 🐚</div>
              </div>
            );
          })}

          {/* Bonus Tide */}
          <div style={{marginTop:"0.85rem",paddingTop:"0.85rem",borderTop:"1px solid "+T.borderSoft}}>
            <div style={{fontSize:"0.7rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.5rem"}}>Bonus Tide</div>
            <div style={{display:"flex",gap:"0.4rem"}}>
              <input value={flyName} onChange={function(e){setFlyName(e.target.value);}}
                placeholder="Something helpful they did..."
                style={{...inp({fontSize:"0.8rem",padding:"0.42rem 0.65rem",flex:1})}}/>
              <select value={flyPts} onChange={function(e){setFlyPts(parseInt(e.target.value));}}
                style={{...inp({width:72,padding:"0.42rem 0.4rem",fontSize:"0.8rem"})}}>
                <option value={1}>+1 🐚</option>
                <option value={2}>+2 🐚</option>
                <option value={3}>+3 🐚</option>
              </select>
              <button onClick={giveShell} style={{...btnP(T.sand),fontSize:"0.8rem",padding:"0.42rem 0.85rem",whiteSpace:"nowrap"}}>+ Bonus Tide</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  _hfRenders.SettingSection = function SettingSection({id, title, children, defaultOpen=true, settingsOpen, toggleSetting}){
    const isOpen = id in settingsOpen ? settingsOpen[id] : defaultOpen;
    return (
      <div style={card()}>
        <div onClick={function(){toggleSetting(id);}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",userSelect:"none",marginBottom:isOpen?"0.85rem":0}}>
          <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark}}>{title}</h2>
          <div style={{display:"flex",transition:"transform 0.2s",transform:isOpen?"rotate(0deg)":"rotate(-90deg)"}}><Icon name="chevD" size={16} color={T.textSoft}/></div>
        </div>
        {isOpen&&<div>{children}</div>}
      </div>
    );
  }

  _hfRenders.CareerTab = function CareerTab(){
    var ADULT_ROLES=["Mom","Dad","Guardian","Roommate","Other"];
    var MINOR_ROLES=["Kid","Teen","Baby"];
    var adults = people.filter(function(p){
      if(!p||!p.name) return false;
      if(MINOR_ROLES.includes(p.role)) return false;
      if(personIsMinor(p)) return false;
      // Only include if they have an explicit adult role OR confirmed adult age
      if(ADULT_ROLES.includes(p.role)) return true;
      var a = personAge(p);
      if(a!=null && a>=18) return true;
      // No role, no age/birthday — exclude to be safe
      return false;
    });
    var [activeCareerPerson, setActiveCareerPerson] = useState(function(){ return adults[0]?.id||null; });
    var activePerson = adults.find(function(p){ return p.id===activeCareerPerson; })||adults[0]||null;

    return(
      <div>
        <SecHead emoji="📋" title="Career" onBack={function(){goTab("anchor");}}/>

        {/* Person tabs — adults only */}
        {adults.length>0?(
          <div style={{display:"flex",gap:"0.4rem",marginBottom:"1.25rem",flexWrap:"wrap"}}>
            {adults.map(function(p){
              var active=p.id===activeCareerPerson;
              return(
                <button key={p.id} onClick={function(){setActiveCareerPerson(p.id);}}
                  style={{display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.38rem 0.85rem",borderRadius:"2rem",border:active?"none":"1px solid "+T.borderSoft,background:active?p.color||T.blue:"transparent",color:active?"#fff":T.textSoft,fontFamily:"inherit",fontSize:"0.82rem",fontWeight:active?700:500,cursor:"pointer",transition:"all 0.15s"}}>
                  <span style={{width:20,height:20,borderRadius:"50%",background:active?"rgba(255,255,255,0.3)":p.color||T.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.65rem",fontWeight:800,color:"#fff",flexShrink:0}}>{(p.name||"?")[0].toUpperCase()}</span>
                  {p.name}
                </button>
              );
            })}
          </div>
        ):(
          <p style={{color:T.textSoft,fontSize:"0.85rem",marginBottom:"1rem"}}>Add adults in Settings → People living in this home.</p>
        )}

        {/* Placeholder content — build out per person here */}
        {activePerson&&(
          <div style={{background:T.surface,borderRadius:"1rem",padding:"1.25rem",border:"1px solid "+T.borderSoft,color:T.textSoft,fontSize:"0.85rem",textAlign:"center"}}>
            <div style={{fontSize:"1.5rem",marginBottom:"0.5rem"}}>📋</div>
            <div style={{fontWeight:600,color:T.textDark,marginBottom:"0.25rem"}}>{activePerson.name}'s Career</div>
            <div>Goals, notes, and career tracking coming here.</div>
          </div>
        )}
      </div>
    );
  }


  // ── ItemRow — lifted outside CoveTab to prevent React hooks error #300 ──────
  _hfRenders.ItemRow = function ItemRow(props) {
    var item = props.item;
    var dragFromId = props.dragFromId;
    var dragOverId = props.dragOverId;
    var accent = props.accent;
    var T = props.T;
    var itemPointerDown = props.itemPointerDown;
    var toggleItem = props.toggleItem;
    var renameItem = props.renameItem;
    var deleteItem = props.deleteItem;
    var [editing, setEditing] = useState(false);
    var [draft, setDraft] = useState(item.content);
    var isDragging = dragFromId === item.id;
    var isOver = dragOverId === item.id && dragFromId !== item.id;
    return (
      <div data-itemid={item.id}
        onPointerDown={function(e){ itemPointerDown(e, item); }}
        style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",
          borderBottom:"1px solid "+T.borderSoft,
          borderTop: isOver ? "2px solid "+accent : "none",
          opacity: isDragging ? 0.3 : 1,
          cursor: "grab", userSelect:"none",
          background: isOver ? accent+"0a" : "transparent",
          transition:"background 0.1s"}}>
        {/* Drag handle */}
        <div style={{opacity:0.2,flexShrink:0,cursor:"grab",paddingRight:2}}>
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
            <circle cx="3" cy="3" r="1.2" fill={T.textSoft}/>
            <circle cx="7" cy="3" r="1.2" fill={T.textSoft}/>
            <circle cx="3" cy="7" r="1.2" fill={T.textSoft}/>
            <circle cx="7" cy="7" r="1.2" fill={T.textSoft}/>
            <circle cx="3" cy="11" r="1.2" fill={T.textSoft}/>
            <circle cx="7" cy="11" r="1.2" fill={T.textSoft}/>
          </svg>
        </div>
        {/* Check circle */}
        <div onClick={function(e){ e.stopPropagation(); toggleItem(item.id); }}
          onPointerDown={function(e){ e.stopPropagation(); }}
          style={{width:17,height:17,borderRadius:"50%",border:"1.5px solid "+(item.checked?accent:T.border),background:item.checked?accent:"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
          {item.checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
        {/* Text — single tap to edit */}
        {editing
          ? <input autoFocus value={draft}
              onChange={function(e){setDraft(e.target.value);}}
              onBlur={function(){ renameItem(item.id,draft.trim()||item.content); setEditing(false); }}
              onKeyDown={function(e){
                if(e.key==="Enter"){ renameItem(item.id,draft.trim()||item.content); setEditing(false); }
                if(e.key==="Escape"){ setDraft(item.content); setEditing(false); }
              }}
              onPointerDown={function(e){ e.stopPropagation(); }}
              style={{flex:1,fontSize:"0.85rem",border:"none",borderBottom:"1.5px solid "+accent,background:"transparent",color:T.textDark,padding:"0 0 1px",outline:"none",fontFamily:"inherit"}}/>
          : <span
              onClick={function(e){ e.stopPropagation(); setEditing(true); setDraft(item.content); }}
              onPointerDown={function(e){ e.stopPropagation(); }}
              style={{flex:1,fontSize:"0.85rem",color:item.checked?T.textFaint:T.textDark,textDecoration:item.checked?"line-through":"none",cursor:"text",lineHeight:1.45}}>
              {item.content}
            </span>
        }
        {/* Delete */}
        <button onClick={function(e){ e.stopPropagation(); deleteItem(item.id); }}
          onPointerDown={function(e){ e.stopPropagation(); }}
          style={{background:"none",border:"none",cursor:"pointer",opacity:0.25,padding:"0 2px",display:"flex",flexShrink:0,fontSize:13,color:T.textSoft,lineHeight:1}}>✕</button>
      </div>
    );
  }

  // ── Cove — organized lists, ideas, plans & keeps ────────────────────────────
  _hfRenders.CoveTab = function CoveTab() {
    const COVE_ACCENT_COLORS = [
      "#3a6b8a","#c8a97a","#5DCAA5","#AFA9EC","#D4537E","#EF9F27","#888780","#1a2744"
    ];

    const COVE_TEMPLATES = {
      "first-100-foods": {
        title:"Baby's first 100 foods",category:"family",list_type:"checklist",
        icon:"baby-carriage",color_accent:"#3a6b8a",show_progress:true,
        sections:[
          {title:"Fruits",items:[
            {content:"Banana",tags:["easy first"]},{content:"Avocado",tags:[]},
            {content:"Apple",tags:[]},{content:"Pear",tags:[]},{content:"Mango",tags:[]},
            {content:"Peach",tags:[]},{content:"Plum",tags:[]},{content:"Blueberry",tags:["allergen"]},
            {content:"Strawberry",tags:["allergen"]},{content:"Raspberry",tags:[]},
            {content:"Watermelon",tags:[]},{content:"Cantaloupe",tags:[]},{content:"Kiwi",tags:[]},
            {content:"Grape",tags:[]},{content:"Cherry",tags:[]},{content:"Papaya",tags:[]},
            {content:"Orange",tags:[]},{content:"Pineapple",tags:[]},{content:"Coconut",tags:[]},{content:"Apricot",tags:[]},
          ]},
          {title:"Vegetables",items:[
            {content:"Sweet potato",tags:["easy first"]},{content:"Broccoli",tags:[]},
            {content:"Carrot",tags:[]},{content:"Peas",tags:[]},{content:"Green beans",tags:[]},
            {content:"Butternut squash",tags:[]},{content:"Spinach",tags:[]},{content:"Cauliflower",tags:[]},
            {content:"Zucchini",tags:[]},{content:"Kale",tags:[]},{content:"Beets",tags:[]},
            {content:"Parsnip",tags:[]},{content:"Pumpkin",tags:[]},{content:"Corn",tags:[]},
            {content:"Bell pepper",tags:[]},{content:"Asparagus",tags:[]},{content:"Edamame",tags:[]},
            {content:"Cucumber",tags:[]},{content:"Tomato",tags:[]},{content:"Beet",tags:[]},
          ]},
          {title:"Proteins",items:[
            {content:"Peanut butter",tags:["allergen"]},{content:"Egg",tags:["allergen"]},
            {content:"Chicken",tags:[]},{content:"Salmon",tags:["allergen"]},{content:"Beef",tags:[]},
            {content:"Turkey",tags:[]},{content:"Lentils",tags:[]},{content:"Black beans",tags:[]},
            {content:"Chickpeas",tags:[]},{content:"Tofu",tags:[]},{content:"Almond butter",tags:["allergen"]},
            {content:"Tuna",tags:["allergen"]},{content:"Pork",tags:[]},{content:"Lamb",tags:[]},
            {content:"Shrimp",tags:["allergen"]},{content:"Cod",tags:[]},{content:"Sardines",tags:[]},
            {content:"White beans",tags:[]},{content:"Kidney beans",tags:[]},{content:"Edamame (shelled)",tags:[]},
          ]},
          {title:"Grains & starches",items:[
            {content:"Oatmeal",tags:[]},{content:"Brown rice",tags:[]},{content:"Quinoa",tags:[]},
            {content:"Barley",tags:[]},{content:"Millet",tags:[]},{content:"Whole wheat toast",tags:["allergen"]},
            {content:"Potato",tags:[]},{content:"Polenta",tags:[]},{content:"Cream of wheat",tags:["allergen"]},
            {content:"Buckwheat",tags:[]},
          ]},
          {title:"Dairy & fats",items:[
            {content:"Full-fat yogurt",tags:["allergen"]},{content:"Cottage cheese",tags:["allergen"]},
            {content:"Ricotta",tags:["allergen"]},{content:"Whole milk cheese",tags:["allergen"]},
            {content:"Cream cheese",tags:["allergen"]},{content:"Ghee",tags:[]},
            {content:"Olive oil",tags:[]},{content:"Coconut oil",tags:[]},
            {content:"Butter",tags:["allergen"]},{content:"Whole milk (in cooking)",tags:["allergen"]},
          ]},
        ],
      },
      "moving":{
        title:"Moving checklist",category:"family",list_type:"checklist",
        icon:"building",color_accent:"#5DCAA5",show_progress:true,
        sections:[
          {title:"8 weeks out",items:[
            {content:"Set your move date",tags:[]},{content:"Book moving company or truck rental",tags:[]},
            {content:"Start decluttering — donate, sell, toss",tags:[]},
            {content:"Request time off work for move day",tags:[]},
            {content:"Notify kids school of upcoming change",tags:[]},
            {content:"Research new area — schools, doctors, grocery",tags:[]},
            {content:"Start collecting boxes and packing supplies",tags:[]},
          ]},
          {title:"4 weeks out",items:[
            {content:"Begin packing non-essentials",tags:[]},
            {content:"Label every box with room + brief contents",tags:[]},
            {content:"Forward mail (USPS change of address)",tags:[]},
            {content:"Notify bank, insurance, subscriptions of new address",tags:[]},
            {content:"Transfer or find new doctors, dentists, vets",tags:[]},
            {content:"Arrange childcare or pet care for move day",tags:[]},
            {content:"Confirm moving company details",tags:[]},
            {content:"Take photos of electronics setups before unplugging",tags:[]},
          ]},
          {title:"1 week out",items:[
            {content:"Finish packing all rooms except essentials",tags:[]},
            {content:"Pack essentials bag (first night box)",tags:["priority"]},
            {content:"Defrost freezer",tags:[]},{content:"Confirm utilities transfer at new address",tags:[]},
            {content:"Clean out fridge — use up or toss food",tags:[]},
            {content:"Confirm moving truck arrival time",tags:[]},
            {content:"Charge all devices",tags:[]},{content:"Get cash for tips",tags:[]},
          ]},
          {title:"Moving day",items:[
            {content:"Final walkthrough of every room",tags:["priority"]},
            {content:"Check all closets, cabinets, attic, garage",tags:[]},
            {content:"Take meter readings at old place",tags:[]},
            {content:"Hand over keys to old place",tags:[]},
            {content:"Take meter readings at new place",tags:[]},
            {content:"Direct movers on box placement by room",tags:[]},
            {content:"Set up beds first — sleep is non-negotiable",tags:["priority"]},
            {content:"Locate essentials box",tags:["priority"]},
          ]},
          {title:"First week in",items:[
            {content:"Update drivers license address",tags:[]},
            {content:"Register vehicles in new state if needed",tags:[]},
            {content:"Find nearest urgent care and ER",tags:[]},
            {content:"Introduce yourself to neighbors",tags:[]},
            {content:"Set up internet",tags:["priority"]},
            {content:"Test smoke and carbon monoxide detectors",tags:["priority"]},
            {content:"Change locks",tags:["priority"]},
            {content:"Get kids settled in their rooms",tags:[]},
          ]},
          {title:"Settled",items:[
            {content:"Update voter registration",tags:[]},
            {content:"Find new pediatrician and schedule intro visit",tags:[]},
            {content:"Update address with IRS if needed",tags:[]},
            {content:"Hang art and make it feel like home",tags:[]},
            {content:"Celebrate — you did it! 🎉",tags:[]},
          ]},
        ],
      },
      "summer-bucket-list":{title:"Summer bucket list",category:"family",list_type:"checklist",icon:"sun",color_accent:"#c8a97a",show_progress:true,sections:[]},
      "house-projects":{title:"House projects",category:"home",list_type:"checklist",icon:"tool",color_accent:"#888780",show_progress:false,sections:[]},
      "books-to-read":{title:"Books to read",category:"personal",list_type:"freeform",icon:"book",color_accent:"#D4537E",show_progress:false,sections:[]},
      "goals":{title:"Goals",category:"personal",list_type:"checklist",icon:"target",color_accent:"#EF9F27",show_progress:true,sections:[]},
    };

    const TEMPLATE_GALLERY = [
      {id:"first-100-foods",label:"Baby's first 100 foods",icon:"baby-carriage",desc:"100 foods pre-loaded by category",category:"family"},
      {id:"moving",label:"Moving checklist",icon:"building",desc:"6 phases from 8 weeks out to settled",category:"family"},
      {id:"summer-bucket-list",label:"Summer bucket list",icon:"sun",desc:"Freeform family goals",category:"family"},
      {id:"house-projects",label:"House projects",icon:"tool",desc:"Track home to-dos with due dates",category:"home"},
      {id:"books-to-read",label:"Books to read",icon:"book",desc:"Your personal reading list",category:"personal"},
      {id:"goals",label:"Goals",icon:"target",desc:"Progress-tracked personal goals",category:"personal"},
    ];

    const CAT_LABELS = {all:"All",family:"Family",home:"Home",personal:"Personal"};

    var [coveLists, setCoveLists] = useSaved("cove_lists_v1", []);
    var [coveItemsMap, setCoveItemsMap] = useSaved("cove_items_v1", {});
    var [coveSectionsMap, setCoveSectionsMap] = useSaved("cove_sections_v1", {});
    var [coveNotes, setCoveNotes] = useSaved("cove_notes_v1", []);
    var [coveNotesAZ, setCoveNotesAZ] = React.useState(false);
    var [catFilter, setCatFilter] = useState("all");
    var [coveTab, setCoveTab] = useState("lists"); // "lists" | "notes"
    var [activeNoteId, setActiveNoteId] = useState(null);
    var [view, setView] = useState("list");
    var [activeListId, setActiveListId] = useState(null);
    var [collapsedSections, setCollapsedSections] = useState({});
    var [newItemTexts, setNewItemTexts] = useState({});
    var [showNewModal, setShowNewModal] = useState(false);
    var [newForm, setNewForm] = useState({title:"",category:"family",color_accent:"#3a6b8a"});
    var [saving, setSaving] = useState(false);
    var [aiLoading, setAiLoading] = useState(false);

    var activeList = coveLists.find(function(l){ return l.id === activeListId; }) || null;
    var activeItems = activeListId ? (coveItemsMap[activeListId] || []) : [];
    var activeSections = activeListId ? (coveSectionsMap[activeListId] || []) : [];

    // ── Notes helpers ─────────────────────────────────────────────────────────
    var activeNote = coveNotes.find(function(n){ return n.id === activeNoteId; }) || null;

    function newNote() {
      var id = uid2();
      var note = { id:id, title:"Untitled", body:"", createdAt:Date.now(), updatedAt:Date.now() };
      setCoveNotes(function(prev){ return [note].concat(prev); });
      setActiveNoteId(id);
      setCoveTab("notes");
    }
    function updateNote(id, patch) {
      setCoveNotes(function(prev){ return prev.map(function(n){
        return n.id===id ? Object.assign({},n,patch,{updatedAt:Date.now()}) : n;
      }); });
    }
    function deleteNote(id) {
      if (!window.confirm("Delete this note? This can't be undone.")) return;
      setCoveNotes(function(prev){ return prev.filter(function(n){ return n.id!==id; }); });
      setActiveNoteId(null);
    }
    function fmtNoteDate(ts) {
      var d=new Date(ts);
      return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:d.getFullYear()!==new Date().getFullYear()?"numeric":undefined});
    }

    // ── Notes view ────────────────────────────────────────────────────────────
    if (coveTab === "notes") {
      // Note detail
      if (activeNoteId && activeNote) {
        return (
          <div style={{paddingBottom:"2rem",minHeight:"100vh"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px 10px",borderBottom:"1px solid "+T.borderSoft}}>
              <button onClick={function(){ setActiveNoteId(null); }} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",flexShrink:0}}>
                <Icon name="arrow-left" size={18} color={T.textSoft}/>
              </button>
              <input
                value={activeNote.title==="Untitled"?"":activeNote.title}
                onChange={function(e){ updateNote(activeNote.id,{title:e.target.value||"Untitled"}); }}
                onKeyDown={function(e){ if(e.key==="Enter") e.target.blur(); }}
                placeholder="Note title"
                style={{flex:1,fontSize:"1rem",fontWeight:700,fontFamily:"'Cormorant Garamond',serif",color:T.textDark,border:"none",background:"transparent",outline:"none",padding:0}}
              />
              <span style={{fontSize:"0.65rem",color:T.textFaint,flexShrink:0}}>{fmtNoteDate(activeNote.updatedAt)}</span>
              {/* Delete — tucked away, requires deliberate tap */}
              <button onClick={function(){ deleteNote(activeNote.id); }}
                style={{background:"none",border:"1px solid "+T.border,borderRadius:6,cursor:"pointer",padding:"3px 7px",display:"flex",alignItems:"center",gap:3,opacity:0.4,flexShrink:0}}
                title="Delete note">
                <Icon name="trash" size={11} color={T.rose}/>
              </button>
            </div>
            <textarea
              value={activeNote.body}
              onChange={function(e){ updateNote(activeNote.id,{body:e.target.value}); }}
              onKeyDown={function(e){
                // Ctrl/Cmd+Enter saves and goes back
                if((e.metaKey||e.ctrlKey)&&e.key==="Enter"){ setActiveNoteId(null); }
              }}
              autoFocus={activeNote.body===""}
              placeholder={"Start writing…\n\n(⌘+Enter to save and go back)"}
              style={{width:"100%",minHeight:"72vh",padding:"14px 16px",fontSize:"0.92rem",lineHeight:1.8,color:T.textDark,background:"transparent",border:"none",outline:"none",resize:"none",fontFamily:"inherit",boxSizing:"border-box"}}
            />
          </div>
        );
      }
      // Notes list
      return (
        <div style={{paddingBottom:"2rem"}}>
          <div style={{padding:"18px 16px 8px",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:"6px"}}>
              <button onClick={function(){goTab("anchor");}} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 4px 0 0",display:"flex",alignItems:"center",opacity:0.5,flexShrink:0,marginTop:4}}>
                <Icon name="arrow-left" size={17} color={T.textSoft}/>
              </button>
              <div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.5rem",fontWeight:700,color:T.textDark}}>🪸 Cove</div>
                <div style={{fontSize:"0.72rem",color:T.textSoft,marginTop:2}}>Your lists, notes, ideas, and keeps.</div>
              </div>
            </div>
            <button onClick={newNote} style={{...btnP(T.blue,{fontSize:"0.75rem",padding:"0.35rem 0.85rem",display:"flex",alignItems:"center",gap:5})}}>
              <Icon name="plus" size={12} color="#fff"/> New note
            </button>
          </div>
          {/* Tab switcher */}
          <div style={{display:"flex",borderBottom:"1px solid "+T.border}}>
            {[{id:"lists",label:"Lists"},{id:"notes",label:"Notes"}].map(function(t){
              var active=coveTab===t.id;
              return(
                <button key={t.id} onClick={function(){setCoveTab(t.id);setActiveNoteId(null);}}
                  style={{flex:1,padding:"10px",fontSize:"0.8rem",fontWeight:active?700:500,color:active?T.blue:T.textSoft,background:"transparent",border:"none",borderBottom:"2px solid "+(active?T.blue:"transparent"),cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>
                  {t.label}
                  {t.id==="notes"&&coveNotes.length>0&&<span style={{marginLeft:5,fontSize:"0.65rem",background:T.blue+"22",color:T.blue,borderRadius:"999px",padding:"1px 6px",fontWeight:700}}>{coveNotes.length}</span>}
                </button>
              );
            })}
          </div>
          <div style={{padding:"14px 16px"}}>
            {coveNotes.length===0?(
              <div style={{textAlign:"center",padding:"2.5rem 0"}}>
                <div style={{fontSize:"2rem",marginBottom:8}}>📝</div>
                <div style={{fontSize:"0.85rem",color:T.textSoft,marginBottom:4}}>No notes yet.</div>
                <div style={{fontSize:"0.75rem",color:T.textFaint,marginBottom:16}}>Tap + to jot down anything — ideas, plans, thoughts.</div>
                <button onClick={newNote} style={{...btnP(T.blue,{fontSize:"0.78rem",padding:"0.4rem 1rem"})}}>+ New note</button>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {coveNotes.length>1&&<div style={{display:"flex",justifyContent:"flex-end",marginBottom:2}}><button onClick={function(){setCoveNotesAZ(function(v){return !v;});}} style={{...btnS({fontSize:"0.7rem",padding:"0.22rem 0.6rem"})}}>{coveNotesAZ?"A–Z ✓":"A–Z"}</button></div>}
                {(coveNotesAZ?coveNotes.slice().sort(function(a,b){return (a.title||a.body||"").localeCompare(b.title||b.body||"");}):coveNotes).map(function(note){
                  var preview=(note.body||"").replace(/\n/g," ").trim().slice(0,90);
                  return(
                    <div key={note.id} onClick={function(){setActiveNoteId(note.id);}}
                      style={{background:T.surface,border:"1.5px solid "+T.borderSoft,borderRadius:10,padding:"0.85rem 1rem",cursor:"pointer",transition:"all 0.12s"}}>
                      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:preview?4:0,gap:8}}>
                        <div style={{fontWeight:700,fontSize:"0.88rem",color:T.textDark,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {note.title==="Untitled"?<span style={{color:T.textFaint,fontStyle:"italic"}}>Untitled</span>:note.title}
                        </div>
                        <div style={{fontSize:"0.65rem",color:T.textFaint,flexShrink:0}}>{fmtNoteDate(note.updatedAt)}</div>
                      </div>
                      {preview&&<div style={{fontSize:"0.76rem",color:T.textSoft,lineHeight:1.5}}>{preview}{(note.body||"").length>90?"…":""}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    function uid2() { return Math.random().toString(36).slice(2,10); }

    function openList(list) {
      setActiveListId(list.id);
      setView("detail");
      setCollapsedSections({});
    }

    function toggleItem(itemId) {
      setCoveItemsMap(function(prev) {
        var items = (prev[activeListId] || []).map(function(i) {
          return i.id === itemId ? Object.assign({}, i, {checked: !i.checked}) : i;
        });
        return Object.assign({}, prev, {[activeListId]: items});
      });
    }

    function deleteItem(itemId) {
      setCoveItemsMap(function(prev) {
        var items = (prev[activeListId] || []).filter(function(i){ return i.id !== itemId; });
        return Object.assign({}, prev, {[activeListId]: items});
      });
    }

    function renameItem(itemId, newContent) {
      setCoveItemsMap(function(prev) {
        var items = (prev[activeListId] || []).map(function(i){
          return i.id === itemId ? Object.assign({}, i, {content: newContent}) : i;
        });
        return Object.assign({}, prev, {[activeListId]: items});
      });
    }

    function addItem(sectionId) {
      var key = sectionId || "__top__";
      var text = (newItemTexts[key] || "").trim();
      if (!text) return;
      var newItem = {id: uid2(), content: text, checked: false, tags: [], section_id: sectionId || null};
      setCoveItemsMap(function(prev) {
        var items = (prev[activeListId] || []).concat([newItem]);
        return Object.assign({}, prev, {[activeListId]: items});
      });
      setNewItemTexts(function(prev) { return Object.assign({}, prev, {[key]: ""}); });
    }

    function renameList(listId, newTitle) {
      setCoveLists(function(prev){ return prev.map(function(l){ return l.id===listId ? Object.assign({},l,{title:newTitle}) : l; }); });
    }

    function deleteList(listId) {
      if (!window.confirm("Delete this list?")) return;
      setCoveLists(function(prev){ return prev.filter(function(l){ return l.id!==listId; }); });
      setCoveItemsMap(function(prev){ var n=Object.assign({},prev); delete n[listId]; return n; });
      setCoveSectionsMap(function(prev){ var n=Object.assign({},prev); delete n[listId]; return n; });
      setView("list"); setActiveListId(null);
    }

    function addSection() {
      var title = window.prompt("Section name:"); if (!title || !title.trim()) return;
      var secId = uid2();
      setCoveSectionsMap(function(prev){
        var secs = (prev[activeListId]||[]).concat([{id:secId, title:title.trim(), sort_order:(prev[activeListId]||[]).length}]);
        return Object.assign({},prev,{[activeListId]:secs});
      });
    }

    function renameSection(secId, newTitle) {
      setCoveSectionsMap(function(prev){
        var secs = (prev[activeListId]||[]).map(function(s){ return s.id===secId ? Object.assign({},s,{title:newTitle}) : s; });
        return Object.assign({},prev,{[activeListId]:secs});
      });
    }

    function deleteSection(secId) {
      setCoveSectionsMap(function(prev){
        var secs = (prev[activeListId]||[]).filter(function(s){ return s.id!==secId; });
        return Object.assign({},prev,{[activeListId]:secs});
      });
      // Move items from deleted section to unsectioned
      setCoveItemsMap(function(prev){
        var items = (prev[activeListId]||[]).map(function(i){ return i.section_id===secId ? Object.assign({},i,{section_id:null}) : i; });
        return Object.assign({},prev,{[activeListId]:items});
      });
    }

    function createFromTemplate(templateId) {
      setSaving(true);
      var tmpl = COVE_TEMPLATES[templateId];
      if (!tmpl) { setSaving(false); return; }
      var listId = uid2();
      var newList = {
        id: listId, title: tmpl.title, category: tmpl.category,
        list_type: tmpl.list_type, icon: tmpl.icon,
        color_accent: tmpl.color_accent, show_progress: tmpl.show_progress,
        template_id: templateId, created_at: Date.now(),
      };
      var sections = [];
      var items = [];
      (tmpl.sections || []).forEach(function(sec, si) {
        var secId = uid2();
        sections.push({id: secId, title: sec.title, sort_order: si});
        (sec.items || []).forEach(function(item, ii) {
          items.push({id: uid2(), content: item.content, checked: false, tags: item.tags || [], section_id: secId, sort_order: ii});
        });
      });
      setCoveLists(function(prev) { return [newList].concat(prev); });
      setCoveSectionsMap(function(prev) { return Object.assign({}, prev, {[listId]: sections}); });
      setCoveItemsMap(function(prev) { return Object.assign({}, prev, {[listId]: items}); });
      setSaving(false);
      setShowNewModal(false);
      setActiveListId(listId);
      setView("detail");
      setCollapsedSections({});
    }

    function createBlank() {
      if (!newForm.title.trim()) return;
      setSaving(true);
      var listId = uid2();
      var newList = {
        id: listId, title: newForm.title.trim(), category: newForm.category,
        list_type: "checklist", icon: "list",
        color_accent: newForm.color_accent, show_progress: true,
        template_id: null, created_at: Date.now(),
      };
      setCoveLists(function(prev) { return [newList].concat(prev); });
      setCoveItemsMap(function(prev) { return Object.assign({}, prev, {[listId]: []}); });
      setCoveSectionsMap(function(prev) { return Object.assign({}, prev, {[listId]: []}); });
      setSaving(false);
      setShowNewModal(false);
      setNewForm({title:"",category:"family",color_accent:"#3a6b8a"});
      setActiveListId(listId);
      setView("detail");
    }

    async function askRipple() {
      setAiLoading(true);
      var unchecked = activeItems.filter(function(i){ return !i.checked; }).map(function(i){ return i.content; });
      var checked = activeItems.filter(function(i){ return i.checked; }).map(function(i){ return i.content; });
      var prompt = 'I have a list called "' + activeList.title + '". Already done: ' + (checked.slice(0,15).join(", ")||"none") + '. Still to do: ' + (unchecked.join(", ")||"none") + '. Suggest 3-5 items I might be missing. Be brief — just a short bulleted list, no preamble.';
      try {
        var res = await fetch("/api/anthropic", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({model:"claude-sonnet-4-6",max_tokens:400,messages:[{role:"user",content:prompt}]}),
        });
        var data = await res.json();
        var text = (data.content||[]).map(function(b){ return b.text||""; }).join("");
        alert("Ripple suggests:\n\n" + text);
      } catch(e) {
        alert("Ripple is unavailable right now.");
      }
      setAiLoading(false);
    }

    var filteredLists = coveLists.filter(function(l) {
      return catFilter === "all" || l.category === catFilter;
    });

    var accent = activeList ? (activeList.color_accent || T.blue) : T.blue;
    var totalItems = activeItems.length;
    var checkedCount = activeItems.filter(function(i){ return i.checked; }).length;
    var pct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

    // ── Drag state for items ──────────────────────────────────────────────────
    var dragItem = useRef({from:null, fromSec:null, toSec:null, toIdx:null, clone:null});
    var [dragFromId, setDragFromId] = useState(null);
    var [dragOverId, setDragOverId] = useState(null);

    function itemPointerDown(e, item) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
      dragItem.current.from = item.id;
      dragItem.current.fromSec = item.section_id || null;
      dragItem.current.toSec = item.section_id || null;
      dragItem.current.toIdx = null;
      setDragFromId(item.id);

      var clone = e.currentTarget.cloneNode(true);
      clone.setAttribute("data-drag-clone", "1");
      clone.style.cssText = "position:fixed;pointer-events:none;opacity:0.85;z-index:9999;width:"+e.currentTarget.offsetWidth+"px;background:"+T.surface+";border:1.5px solid "+accent+";border-radius:8px;padding:7px 12px;box-shadow:0 4px 18px rgba(0,0,0,0.15);transition:none;";
      clone.style.left = (e.clientX - 20) + "px";
      clone.style.top  = (e.clientY - 16) + "px";
      document.body.appendChild(clone);
      dragItem.current.clone = clone;

      function onMove(ev) {
        clone.style.left = (ev.clientX - 20) + "px";
        clone.style.top  = (ev.clientY - 16) + "px";
        clone.style.display = "none";
        var el = document.elementFromPoint(ev.clientX, ev.clientY);
        clone.style.display = "";
        var row = el && el.closest("[data-itemid]");
        var secEl = el && el.closest("[data-secid]");
        dragItem.current.toSec = secEl ? secEl.getAttribute("data-secid") : null;
        if (row) {
          var rid = row.getAttribute("data-itemid");
          if (rid !== dragItem.current.from) { dragItem.current.toIdx = rid; setDragOverId(rid); }
        } else { setDragOverId(null); }
      }
      function cleanup() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", cleanup);
        document.querySelectorAll("[data-drag-clone]").forEach(function(el){ try{el.remove();}catch{} });
        dragItem.current.clone = null;
        setDragFromId(null); setDragOverId(null);
      }
      function onUp() {
        var fromId = dragItem.current.from;
        var toId   = dragItem.current.toIdx;
        var toSec  = dragItem.current.toSec !== undefined ? dragItem.current.toSec : null;
        dragItem.current.from = dragItem.current.toIdx = null;
        cleanup();
        if (!fromId) return;
        setCoveItemsMap(function(prev) {
          var items = (prev[activeListId] || []).slice();
          var fromIdx = items.findIndex(function(i){ return i.id === fromId; });
          if (fromIdx === -1) return prev;
          var moved = Object.assign({}, items[fromIdx], { section_id: toSec || null });
          items.splice(fromIdx, 1);
          var toIdx2 = toId ? items.findIndex(function(i){ return i.id === toId; }) : -1;
          if (toIdx2 === -1) items.push(moved);
          else items.splice(toIdx2, 0, moved);
          return Object.assign({}, prev, {[activeListId]: items});
        });
      }
      window.addEventListener("pointermove", onMove, {passive:true});
      window.addEventListener("pointerup", onUp, {once:true});
      window.addEventListener("pointercancel", cleanup, {once:true});
      e.preventDefault();
    }

    // ── Item row ── (lifted above CoveTab — see ItemRow component above) ───────

    // ── Detail view ───────────────────────────────────────────────────────────
    if (view === "detail" && activeList) {
      var unsectionedItems = activeItems.filter(function(i){ return !i.section_id; });
      return (
        <div style={{paddingBottom:"3rem"}}>
          {/* Header */}
          <div style={{padding:"14px 16px 10px",display:"flex",alignItems:"flex-start",gap:8}}>
            <button onClick={function(){ setView("list"); }} style={{background:"none",border:"none",cursor:"pointer",color:T.textSoft,padding:"4px 0",display:"flex",alignItems:"center",flexShrink:0,marginTop:4}}>
              <Icon name="arrow-left" size={18} color={T.textSoft}/>
            </button>
            <div style={{flex:1,minWidth:0}}>
              <input
                value={activeList.title}
                onChange={function(e){ renameList(activeList.id, e.target.value); }}
                style={{width:"100%",fontSize:"1.4rem",fontWeight:700,fontFamily:"'Cormorant Garamond',serif",color:T.textDark,border:"none",background:"transparent",outline:"none",padding:0,lineHeight:1.2}}
              />
              <div style={{fontSize:"0.66rem",color:T.textFaint,marginTop:2}}>
                {totalItems > 0 ? checkedCount+" of "+totalItems+" done · tap text to edit · drag to reorder" : "Start adding below"}
              </div>
            </div>
            <button onClick={function(){ deleteList(activeList.id); }} style={{background:"none",border:"none",cursor:"pointer",opacity:0.3,padding:4,display:"flex",flexShrink:0,marginTop:2}}>
              <Icon name="trash" size={14} color={T.rose}/>
            </button>
          </div>

          {/* Progress */}
          {totalItems > 0 && (
            <div style={{padding:"0 16px 10px"}}>
              <div style={{height:3,background:T.borderSoft,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",background:accent,width:pct+"%",borderRadius:2,transition:"width 0.4s"}}/>
              </div>
            </div>
          )}

          <div style={{padding:"0 16px"}}>
            {/* Unsectioned items drop zone */}
            <div data-secid="__none__">
              {unsectionedItems.map(function(item){ return <ItemRow key={item.id} item={item} dragFromId={dragFromId} dragOverId={dragOverId} accent={accent} T={T} itemPointerDown={itemPointerDown} toggleItem={toggleItem} renameItem={renameItem} deleteItem={deleteItem}/>; })}
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:activeSections.length>0?"1px solid "+T.borderSoft:"none"}}>
                <div style={{width:17,height:17,flexShrink:0,opacity:0.3}}>
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
                    <circle cx="3" cy="3" r="1.2" fill={T.textSoft}/><circle cx="7" cy="3" r="1.2" fill={T.textSoft}/>
                    <circle cx="3" cy="7" r="1.2" fill={T.textSoft}/><circle cx="7" cy="7" r="1.2" fill={T.textSoft}/>
                    <circle cx="3" cy="11" r="1.2" fill={T.textSoft}/><circle cx="7" cy="11" r="1.2" fill={T.textSoft}/>
                  </svg>
                </div>
                <div style={{width:17,height:17,borderRadius:"50%",border:"1.5px dashed "+T.border,flexShrink:0}}/>
                <input
                  value={newItemTexts["__top__"]||""}
                  onChange={function(e){ setNewItemTexts(function(p){ return Object.assign({},p,{__top__:e.target.value}); }); }}
                  onKeyDown={function(e){ if(e.key==="Enter") addItem(null); }}
                  placeholder="Add item…"
                  style={{flex:1,fontSize:"0.85rem",border:"none",background:"transparent",color:T.textDark,outline:"none",fontFamily:"inherit",padding:"2px 0"}}
                />
              </div>
            </div>

            {/* Sections */}
            {activeSections.length > 0 && <div style={{height:8}}/>}
            {activeSections.map(function(sec) {
              var secItems = activeItems.filter(function(i){ return i.section_id === sec.id; });
              var isCollapsed = collapsedSections[sec.id];
              var addKey = sec.id;
              return (
                <div key={sec.id} style={{marginBottom:14}}>
                  {/* Section header */}
                  <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 0 4px",borderTop:"1px solid "+T.borderSoft}}>
                    {/* Collapse toggle */}
                    <button
                      onClick={function(){ setCollapsedSections(function(p){ return Object.assign({},p,{[sec.id]:!p[sec.id]}); }); }}
                      style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex",flexShrink:0,opacity:0.5}}>
                      <Icon name={isCollapsed?"chevron-right":"chevron-down"} size={13} color={T.textSoft}/>
                    </button>
                    {/* Editable section title */}
                    <input
                      value={sec.title}
                      onChange={function(e){ renameSection(sec.id, e.target.value); }}
                      style={{flex:1,fontSize:"0.75rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:T.textMid,border:"none",background:"transparent",outline:"none",fontFamily:"inherit",padding:0,cursor:"text"}}
                    />
                    {/* Item count badge */}
                    <span style={{fontSize:"0.6rem",color:T.textFaint,background:T.bgAlt,borderRadius:999,padding:"1px 6px",border:"1px solid "+T.border,flexShrink:0}}>
                      {secItems.filter(function(i){return i.checked;}).length}/{secItems.length}
                    </span>
                    {/* Delete section */}
                    <button onClick={function(){ deleteSection(sec.id); }}
                      style={{background:"none",border:"none",cursor:"pointer",opacity:0.25,padding:"0 2px",fontSize:12,color:T.textSoft,flexShrink:0}}>✕</button>
                  </div>

                  {/* Section items — collapsible, draggable */}
                  {!isCollapsed && (
                    <div data-secid={sec.id}>
                      {secItems.map(function(item){ return <ItemRow key={item.id} item={item} dragFromId={dragFromId} dragOverId={dragOverId} accent={accent} T={T} itemPointerDown={itemPointerDown} toggleItem={toggleItem} renameItem={renameItem} deleteItem={deleteItem}/>; })}
                      {/* Add to section */}
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0 2px"}}>
                        <div style={{width:10+8+2,flexShrink:0}}/>
                        <div style={{width:17,height:17,borderRadius:"50%",border:"1.5px dashed "+T.border,flexShrink:0}}/>
                        <input
                          value={newItemTexts[addKey]||""}
                          onChange={function(e){ setNewItemTexts(function(p){ return Object.assign({},p,{[addKey]:e.target.value}); }); }}
                          onKeyDown={function(e){ if(e.key==="Enter") addItem(sec.id); }}
                          placeholder={"Add to "+sec.title+"…"}
                          style={{flex:1,fontSize:"0.85rem",border:"none",background:"transparent",color:T.textDark,outline:"none",fontFamily:"inherit",padding:"2px 0"}}
                        />
                        {(newItemTexts[addKey]||"").trim() && (
                          <button
                            onClick={function(){ addItem(sec.id); }}
                            onPointerDown={function(e){ e.stopPropagation(); }}
                            style={{background:accent,color:"#fff",border:"none",borderRadius:6,padding:"2px 10px",fontSize:"0.78rem",cursor:"pointer",fontFamily:"inherit",fontWeight:700,flexShrink:0,lineHeight:"1.6"}}>
                            +
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bottom toolbar */}
            <div style={{display:"flex",gap:8,marginTop:18,flexWrap:"wrap",borderTop:"1px dashed "+T.borderSoft,paddingTop:12}}>
              <button onClick={addSection}
                style={{fontSize:"0.72rem",color:T.textSoft,background:"none",border:"1px dashed "+T.border,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit"}}>
                + section
              </button>
              <button onClick={askRipple} disabled={aiLoading}
                style={{fontSize:"0.72rem",color:T.blue,background:"none",border:"1px solid "+T.blue+"44",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,opacity:aiLoading?0.5:1}}>
                <Icon name="sparkles" size={12} color={T.blue}/>{aiLoading?"thinking…":"Ripple: suggest items"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{paddingBottom:"2rem"}}>
        <div style={{padding:"18px 16px 8px",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:"6px"}}>
            <button onClick={function(){goTab("anchor");}} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 4px 0 0",display:"flex",alignItems:"center",opacity:0.5,flexShrink:0,marginTop:4}}>
              <Icon name="arrow-left" size={17} color={T.textSoft}/>
            </button>
            <div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.5rem",fontWeight:700,color:T.textDark}}>🪸 Cove</div>
              <div style={{fontSize:"0.72rem",color:T.textSoft,marginTop:2}}>Your lists, notes, ideas, and keeps.</div>
            </div>
          </div>
        </div>

        <div style={{display:"flex",borderBottom:"1px solid "+T.border}}>
          {[{id:"lists",label:"Lists"},{id:"notes",label:"Notes"}].map(function(t){
            var active=coveTab===t.id;
            return(
              <button key={t.id} onClick={function(){setCoveTab(t.id);setActiveNoteId(null);}}
                style={{flex:1,padding:"10px",fontSize:"0.8rem",fontWeight:active?700:500,color:active?T.blue:T.textSoft,background:"transparent",border:"none",borderBottom:"2px solid "+(active?T.blue:"transparent"),cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>
                {t.label}
                {t.id==="notes"&&coveNotes.length>0&&<span style={{marginLeft:5,fontSize:"0.65rem",background:T.blue+"22",color:T.blue,borderRadius:"999px",padding:"1px 6px",fontWeight:700}}>{coveNotes.length}</span>}
              </button>
            );
          })}
        </div>

        <div style={{padding:"10px 16px 6px",display:"flex",gap:6,flexWrap:"wrap"}}>
          {["all","family","home","personal"].map(function(cat){
            var active=catFilter===cat;
            return(
              <button key={cat} onClick={function(){setCatFilter(cat);}}
                style={{fontSize:"0.7rem",padding:"3px 10px",borderRadius:999,border:"1px solid "+(active?T.blue:T.border),background:active?T.blue:"transparent",color:active?"#fff":T.textSoft,cursor:"pointer",fontFamily:"inherit"}}>
                {CAT_LABELS[cat]}
              </button>
            );
          })}
        </div>

        <div style={{padding:"8px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:T.bgAlt,borderRadius:10,marginBottom:12,border:"1px dashed "+T.border}}>
            <span style={{fontSize:"0.85rem",color:T.textFaint}}>+</span>
            <input
              value={newForm.title}
              onChange={function(e){setNewForm(function(f){return Object.assign({},f,{title:e.target.value});});}}
              onKeyDown={function(e){if(e.key==="Enter")createBlank();}}
              placeholder="New list name… (Enter to create)"
              style={{flex:1,fontSize:"0.84rem",border:"none",background:"transparent",color:T.textDark,outline:"none",fontFamily:"inherit"}}
            />
            {newForm.title.trim()&&(
              <button onClick={createBlank} style={{...btnP(T.blue,{fontSize:"0.7rem",padding:"3px 10px"})}}>Create</button>
            )}
          </div>

          {filteredLists.length===0?(
            <div style={{textAlign:"center",padding:"2rem 0"}}>
              <div style={{fontSize:"2rem",marginBottom:8}}>🪸</div>
              <div style={{fontSize:"0.85rem",color:T.textSoft,marginBottom:12}}>{coveLists.length===0?"Nothing here yet.":"No lists in this category."}</div>
              <button onClick={function(){setShowNewModal(true);}} style={{...btnS({fontSize:"0.78rem",padding:"0.4rem 1rem"})}}>Browse templates</button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filteredLists.map(function(list){
                var listItems=coveItemsMap[list.id]||[];
                var done=listItems.filter(function(i){return i.checked;}).length;
                var total=listItems.length;
                var lPct=total>0?Math.round((done/total)*100):0;
                var lAccent=list.color_accent||T.blue;
                return(
                  <div key={list.id} style={{background:T.surface,border:"1.5px solid "+T.borderSoft,borderRadius:12,overflow:"hidden"}}>
                    <div style={{height:3,background:lAccent}}/>
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px 8px"}}>
                      <div onClick={function(){openList(list);}} style={{flex:1,cursor:"pointer",minWidth:0}}>
                        <div style={{fontSize:"0.88rem",fontWeight:700,color:T.textDark,lineHeight:1.3}}>{list.title}</div>
                        <div style={{fontSize:"0.68rem",color:T.textFaint,marginTop:2}}>{total>0?done+" of "+total+" done · "+CAT_LABELS[list.category]:"Empty · "+CAT_LABELS[list.category]}</div>
                      </div>
                      <button onClick={function(){if(window.confirm("Delete \""+list.title+"\"?")){setCoveLists(function(p){return p.filter(function(l){return l.id!==list.id;})});setCoveItemsMap(function(p){var n=Object.assign({},p);delete n[list.id];return n;});setCoveSectionsMap(function(p){var n=Object.assign({},p);delete n[list.id];return n;});}}}
                        style={{background:"none",border:"none",cursor:"pointer",opacity:0.3,padding:3,display:"flex",flexShrink:0,fontSize:13,color:T.textSoft}}>&#10005;</button>
                    </div>
                    {total>0&&(
                      <div style={{height:2,background:T.borderSoft,margin:"0 12px 8px"}}>
                        <div style={{height:"100%",background:lAccent,width:lPct+"%",transition:"width 0.4s",borderRadius:1}}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={function(){setShowNewModal(true);}}
            style={{marginTop:14,width:"100%",background:"none",border:"1px dashed "+T.border,borderRadius:10,padding:"10px",fontSize:"0.75rem",color:T.textFaint,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <Icon name="layout-grid-add" size={13} color={T.textFaint}/> Start from a template
          </button>
        </div>

        {showNewModal&&(
          <div onClick={function(e){if(e.target===e.currentTarget)setShowNewModal(false);}}
            style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
            <div style={{background:T.white,borderRadius:16,width:"100%",maxWidth:480,padding:"18px 18px 24px",maxHeight:"85vh",overflowY:"auto"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontSize:"0.95rem",fontWeight:700,color:T.textDark}}>Templates</div>
                <button onClick={function(){setShowNewModal(false);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:T.textSoft,padding:0}}>&#10005;</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
                {TEMPLATE_GALLERY.map(function(tmpl){
                  return(
                    <button key={tmpl.id} onClick={function(){createFromTemplate(tmpl.id);}} disabled={saving}
                      style={{border:"1px solid "+T.border,borderRadius:10,padding:"10px 12px",cursor:"pointer",background:"transparent",textAlign:"left",width:"100%",fontFamily:"inherit"}}>
                      <div style={{marginBottom:5}}><Icon name={tmpl.icon} size={15} color={T.textSoft}/></div>
                      <div style={{fontSize:"0.78rem",fontWeight:700,color:T.textDark,marginBottom:2,lineHeight:1.3}}>{tmpl.label}</div>
                      <div style={{fontSize:"0.65rem",color:T.textFaint,lineHeight:1.4}}>{tmpl.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  function Celebration(props) {
    var data = props.data;
    React.useEffect(function() {
      if (!data) return;
      var t = setTimeout(function() { props.onClose(); }, 6000);
      return function() { clearTimeout(t); };
    }, [data]);
    if (!data) return null;
    var colors = ["#B08C3D", "#182B45", "#e8a84c", "#7db87a", "#6ba3c4", "#d98b8b"];
    var pieces = [];
    for (var i = 0; i < 70; i++) {
      var left = Math.random() * 100;
      var delay = Math.random() * 0.7;
      var dur = 2.4 + Math.random() * 2.0;
      var size = 7 + Math.random() * 8;
      var color = colors[i % colors.length];
      var rot = Math.random() * 360;
      var drift = (Math.random() * 2 - 1) * 70;
      pieces.push(
        React.createElement("div", { key: i, style: {
          position: "absolute", top: "-24px", left: left + "%",
          width: size + "px", height: (size * 0.6) + "px",
          background: color, opacity: 0.92,
          borderRadius: i % 3 === 0 ? "50%" : "1px",
          "--afDrift": drift + "px",
          animation: "afConfettiFall " + dur + "s " + delay + "s ease-in forwards"
        } })
      );
    }
    return (
      <div onClick={props.onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(24,43,69,0.28)" }}>
        <style>{"@keyframes afConfettiFall{0%{transform:translateY(0) translateX(0) rotate(0deg);opacity:1}100%{transform:translateY(106vh) translateX(var(--afDrift,0px)) rotate(720deg);opacity:0.9}}@keyframes afPop{0%{transform:scale(0.6);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}"}</style>
        {pieces}
        <div style={{ position: "relative", background: "#FDFBF5", borderRadius: "1.4rem", padding: "2rem 2.2rem", textAlign: "center", maxWidth: "340px", margin: "0 1.5rem", boxShadow: "0 20px 60px rgba(24,43,69,0.35)", animation: "afPop 0.5s ease-out both" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🎉</div>
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.7rem", fontWeight: 700, color: "#182B45", marginBottom: "0.35rem" }}>{data.heading || "Goal reached!"}</div>
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.15rem", fontStyle: "italic", color: "#B08C3D", marginBottom: "0.9rem" }}>{data.title}</div>
          <div style={{ fontSize: "0.86rem", color: "#5a6b7a", fontFamily: "DM Sans, sans-serif", lineHeight: 1.5 }}>{data.message || ((data.who ? data.who + ", you did it! " : "You did it! ") + "Every bit of effort added up.")}</div>
          <button onClick={props.onClose} style={{ marginTop: "1.2rem", background: "#182B45", color: "#fff", border: "none", borderRadius: "2rem", padding: "0.55rem 1.7rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Celebrate 🎊</button>
        </div>
      </div>
    );
  }
  _hfRenders.SchoolTab = function SchoolTab() {
    var [schoolData, setSchoolData] = useSaved("schoolData", {});
    var [activeChild, setActiveChild] = React.useState(null);
    var [subTab, setSubTab] = React.useState("overview");
    var [showTeacherModal, setShowTeacherModal] = React.useState(false);
    var [editingTeacher, setEditingTeacher] = React.useState(null);
    var [showEventModal, setShowEventModal] = React.useState(false);
    var [editingEvent, setEditingEvent] = React.useState(null);
    var [showCurriculumModal, setShowCurriculumModal] = React.useState(false);
    var [editingCurriculum, setEditingCurriculum] = React.useState(null);
    var [showLessonModal, setShowLessonModal] = React.useState(false);
    var [editingLesson, setEditingLesson] = React.useState(null);
    var [showActivityModal, setShowActivityModal] = React.useState(false);
    var [editingActivity, setEditingActivity] = React.useState(null);
    var [showSpiritModal, setShowSpiritModal] = React.useState(false);
    var [editingSpirit, setEditingSpirit] = React.useState(null);
    var [showTypeModal, setShowTypeModal] = React.useState(false);
    var [breakMode, setBreakMode] = React.useState(null); // null | "summer" | "winter" | "spring"
    var [showBreakGoalModal, setShowBreakGoalModal] = React.useState(false);
    var [breakGoalForm, setBreakGoalForm] = React.useState({ title: "", type: "goal", target: "", unit: "", notes: "" });
    var [editingBreakGoal, setEditingBreakGoal] = React.useState(null);
    var [teacherForm, setTeacherForm] = React.useState({ name: "", subject: "", email: "", phone: "", notes: "" });
    var [eventForm, setEventForm] = React.useState({ title: "", date: "", type: "event", notes: "" });
    var [curriculumForm, setCurriculumForm] = React.useState({ subject: "", name: "", website: "", notes: "" });
    var [lessonForm, setLessonForm] = React.useState({ date: "", subject: "", title: "", description: "", resources: "", duration: "" });
    var [activityForm, setActivityForm] = React.useState({ title: "", date: "", time: "", location: "", notes: "" });
    var [spiritForm, setSpiritForm] = React.useState({ date: "", theme: "", notes: "" });

    var schoolKids = people.filter(function(p) { return p && p.name && personIsMinor(p); });

    React.useEffect(function() {
      if (!activeChild && schoolKids.length > 0) { setActiveChild(schoolKids[0].id); }
    }, [schoolKids.length]);

    var child = schoolKids.find(function(p) { return p.id === activeChild; });
    var childData = (activeChild && schoolData[activeChild]) || { type: null, public: { teachers: [], calEvents: [], spiritDays: [], teacherAppWeek: {}, schedule: "", notes: "" }, homeschool: { umbrella: {}, curricula: [], lessons: [], activities: [], attendance: {} } };

    function saveChildData(patch) {
      setSchoolData(function(prev) {
        var existing = prev[activeChild] || { type: null, public: { teachers: [], calEvents: [], spiritDays: [], teacherAppWeek: {}, schedule: "", notes: "" }, homeschool: { umbrella: {}, curricula: [], lessons: [], activities: [], attendance: {} } };
        var next = Object.assign({}, prev);
        next[activeChild] = Object.assign({}, existing, patch);
        return next;
      });
    }
    function savePub(patch) { saveChildData({ public: Object.assign({}, childData.public, patch) }); }
    function saveHS(patch)  { saveChildData({ homeschool: Object.assign({}, childData.homeschool, patch) }); }
    function suid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

    var isPublic = childData.type === "public";
    var isHomeschool = childData.type === "homeschool";
    var todayISO = new Date().toISOString().slice(0, 10);
    var attendance = childData.homeschool.attendance || {};
    var totalPresent = Object.values(attendance).filter(function(v) { return v === "present"; }).length;
    var totalAbsent  = Object.values(attendance).filter(function(v) { return v === "absent"; }).length;

    function toggleAttendance(dateStr) {
      var current = attendance[dateStr];
      var next = Object.assign({}, attendance);
      if (!current) next[dateStr] = "present";
      else if (current === "present") next[dateStr] = "absent";
      else delete next[dateStr];
      saveHS({ attendance: next });
    }

    function getCalendarDays() {
      var now = new Date();
      var year = now.getFullYear();
      var month = now.getMonth();
      var firstDay = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var days = [];
      for (var i = 0; i < firstDay; i++) days.push(null);
      for (var d = 1; d <= daysInMonth; d++) {
        var iso = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
        days.push({ day: d, iso: iso });
      }
      return days;
    }

    var PUB_TABS = [
      { id: "overview", label: "Overview",  emoji: "🏫" },
      { id: "teachers", label: "Teachers",  emoji: "👩‍🏫" },
      { id: "schedule", label: "Schedule",  emoji: "⏰" },
      { id: "calendar", label: "Calendar",  emoji: "📆" },
      { id: "spirit",   label: "Spirit",    emoji: "🎉" },
    ];
    var HS_TABS = [
      { id: "overview",   label: "Overview",   emoji: "🏡" },
      { id: "umbrella",   label: "Umbrella",   emoji: "☂️" },
      { id: "curricula",  label: "Curricula",  emoji: "📚" },
      { id: "lessons",    label: "Lessons",    emoji: "✏️" },
      { id: "attendance", label: "Attendance", emoji: "📋" },
      { id: "activities", label: "Activities", emoji: "🌟" },
    ];
    var activeTabs = isPublic ? PUB_TABS : isHomeschool ? HS_TABS : [];

    if (schoolKids.length === 0) {
      return (
        <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🏫</div>
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.4rem", color: T.textDark, marginBottom: "0.5rem" }}>School</div>
          <div style={{ color: T.textMid, fontSize: "0.88rem", lineHeight: 1.6, marginBottom: "1.25rem" }}>Add children to your People list in Settings to track school info.</div>
          <button onClick={function() { goTab("settings"); }} style={btnP(T.blue)}>Go to Settings</button>
        </div>
      );
    }

    function TypePicker() {
      return (
        <div style={{ position: "fixed", inset: 0, background: T.modalOverlay, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "env(safe-area-inset-top,1rem) 1rem env(safe-area-inset-bottom,1rem)", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ background: T.surface, borderRadius: "1.2rem", padding: "2rem", width: "min(360px,100%)", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 2rem)", overflowY: "auto" }}>
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.4rem", color: T.textDark, marginBottom: "0.4rem", textAlign: "center" }}>
              School type for {child ? child.name : ""}?
            </div>
            <div style={{ color: T.textMid, fontSize: "0.82rem", textAlign: "center", marginBottom: "1.5rem" }}>You can change this anytime.</div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={function() { saveChildData({ type: "public" }); setSubTab("overview"); setShowTypeModal(false); }} style={{ flex: 1, background: T.bluePale, border: "2px solid " + T.blue, borderRadius: "1rem", padding: "1.25rem 0.75rem", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>🏫</div>
                <div style={{ fontWeight: 700, color: T.blue, fontSize: "0.88rem" }}>Public / Private</div>
                <div style={{ color: T.textMid, fontSize: "0.75rem", marginTop: "0.25rem" }}>Teachers, calendar, schedule</div>
              </button>
              <button onClick={function() { saveChildData({ type: "homeschool" }); setSubTab("overview"); setShowTypeModal(false); }} style={{ flex: 1, background: T.sagePale, border: "2px solid " + T.sage, borderRadius: "1rem", padding: "1.25rem 0.75rem", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>🏡</div>
                <div style={{ fontWeight: 700, color: T.sage, fontSize: "0.88rem" }}>Homeschool</div>
                <div style={{ color: T.textMid, fontSize: "0.75rem", marginTop: "0.25rem" }}>Curricula, lessons, attendance</div>
              </button>
            </div>
            <button onClick={function() { setShowTypeModal(false); }} style={Object.assign({}, btnS(), { width: "100%", marginTop: "1rem" })}>Cancel</button>
          </div>
        </div>
      );
    }

    function PublicOverview() {
      var [notes, setNotes] = React.useState(childData.public.notes || "");
      return (
        <div>
          <div style={card()}>
            <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "0.75rem" }}>📝 Important Notes</div>
            <textarea value={notes} onChange={function(e) { setNotes(e.target.value); }} onBlur={function() { savePub({ notes: notes }); }} placeholder="Allergies, accommodations, drop-off details, nurse info..." style={Object.assign({}, inp(), { minHeight: "90px", resize: "vertical" })} />
          </div>
          <div style={card({ background: T.bluePale, border: "1.5px solid " + T.blue + "40" })}>
            <div style={{ fontWeight: 700, color: T.blue, marginBottom: "0.5rem" }}>👩‍🏫 Teacher Appreciation Week</div>
            <div style={{ marginBottom: "0.5rem" }}>
              <label style={lbl}>Week of</label>
              <input type="date" value={childData.public.teacherAppWeek ? childData.public.teacherAppWeek.start || "" : ""} onChange={function(e) { var v = e.target.value; savePub({ teacherAppWeek: Object.assign({}, childData.public.teacherAppWeek, { start: v }) }); }} style={inp()} />
            </div>
            <label style={lbl}>Gift ideas / plan</label>
            <textarea value={childData.public.teacherAppWeek ? childData.public.teacherAppWeek.ideas || "" : ""} onChange={function(e) { var v = e.target.value; savePub({ teacherAppWeek: Object.assign({}, childData.public.teacherAppWeek, { ideas: v }) }); }} placeholder="Cards, donations, treats per teacher..." style={Object.assign({}, inp(), { minHeight: "60px", resize: "vertical" })} />
          </div>
          <button onClick={function() { setShowTypeModal(true); }} style={Object.assign({}, btnS(), { width: "100%", fontSize: "0.78rem" })}>🔄 Change school type</button>
        </div>
      );
    }

    function PublicTeachers() {
      var teachers = childData.public.teachers || [];
      return (
        <div>
          <button onClick={function() { setTeacherForm({ name: "", subject: "", email: "", phone: "", notes: "" }); setEditingTeacher(null); setShowTeacherModal(true); }} style={Object.assign({}, btnP(T.blue), { width: "100%", marginBottom: "0.85rem" })}>+ Add Teacher</button>
          {teachers.length === 0 && <div style={{ color: T.textFaint, textAlign: "center", padding: "2rem 0", fontSize: "0.85rem" }}>No teachers added yet</div>}
          {teachers.map(function(t) {
            return (
              <div key={t.id} style={card()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: T.textDark, fontSize: "0.95rem" }}>{t.name}</div>
                    {t.subject && <div style={{ color: T.blue, fontSize: "0.78rem", fontWeight: 600, marginTop: "0.1rem" }}>{t.subject}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button onClick={function() { setTeacherForm({ name: t.name, subject: t.subject, email: t.email, phone: t.phone, notes: t.notes }); setEditingTeacher(t.id); setShowTeacherModal(true); }} style={btnS({ padding: "0.3rem 0.65rem", fontSize: "0.72rem" })}>Edit</button>
                    <button onClick={function() { savePub({ teachers: teachers.filter(function(x) { return x.id !== t.id; }) }); }} style={btnS({ padding: "0.3rem 0.65rem", fontSize: "0.72rem", color: T.rose })}>✕</button>
                  </div>
                </div>
                {t.email && <div style={{ color: T.textMid, fontSize: "0.78rem", marginTop: "0.4rem" }}>✉️ {t.email}</div>}
                {t.phone && <div style={{ color: T.textMid, fontSize: "0.78rem", marginTop: "0.2rem" }}>📞 {t.phone}</div>}
                {t.notes && <div style={{ color: T.textSoft, fontSize: "0.76rem", marginTop: "0.4rem", fontStyle: "italic" }}>{t.notes}</div>}
              </div>
            );
          })}
          {showTeacherModal && (
            <div style={{ position: "fixed", inset: 0, background: T.modalOverlay, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0" }}>
              <div style={{ background: T.surface, borderRadius: "1.2rem 1.2rem 0 0", padding: "1.5rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom,0px))", width: "min(480px,100%)", maxHeight: "calc(85dvh - env(safe-area-inset-top,0px))", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "1rem" }}>{editingTeacher ? "Edit Teacher" : "Add Teacher"}</div>
                {[["name","Name","text"],["subject","Subject / Class","text"],["email","Email","email"],["phone","Phone","tel"]].map(function(f) {
                  return (
                    <div key={f[0]} style={{ marginBottom: "0.65rem" }}>
                      <label style={lbl}>{f[1]}</label>
                      <input type={f[2]} key={f[0]+"_"+(editingTeacher?editingTeacher.id:"new")} defaultValue={teacherForm[f[0]]} onBlur={function(e) { var v = e.target.value; var fk = f[0]; setTeacherForm(function(p) { var n = Object.assign({}, p); n[fk] = v; return n; }); }} style={inp()} />
                    </div>
                  );
                })}
                <div style={{ marginBottom: "0.85rem" }}>
                  <label style={lbl}>Notes</label>
                  <textarea defaultValue={teacherForm.notes} onBlur={function(e) { var v = e.target.value; setTeacherForm(function(p) { return Object.assign({}, p, { notes: v }); }); }} style={Object.assign({}, inp(), { minHeight: "60px" })} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={function() {
                    if (!teacherForm.name.trim()) return;
                    var current = childData.public.teachers || [];
                    if (editingTeacher) {
                      savePub({ teachers: current.map(function(t) { return t.id === editingTeacher ? Object.assign({}, teacherForm, { id: t.id }) : t; }) });
                    } else {
                      savePub({ teachers: current.concat([Object.assign({}, teacherForm, { id: suid() })]) });
                    }
                    setShowTeacherModal(false);
                  }} style={btnP(T.blue, { flex: 1 })}>Save</button>
                  <button onClick={function() { setShowTeacherModal(false); }} style={btnS({ flex: 1 })}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    function PublicSchedule() {
      var [localSched, setLocalSched] = React.useState(childData.public.schedule || "");
      return (
        <div style={card()}>
          <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "0.75rem" }}>⏰ Weekly Schedule</div>
          <textarea value={localSched} onChange={function(e) { setLocalSched(e.target.value); }} onBlur={function() { savePub({ schedule: localSched }); }} placeholder={"7:45 — Drop-off\n8:00 — Math\n11:30 — Lunch\n2:45 — Pick-up"} style={Object.assign({}, inp(), { minHeight: "200px", resize: "vertical", fontFamily: "monospace", fontSize: "0.82rem", lineHeight: 1.7 })} />
          <div style={{ textAlign: "right", marginTop: "0.5rem" }}>
            <button onClick={function() { savePub({ schedule: localSched }); }} style={btnP(T.blue, { fontSize: "0.78rem", padding: "0.4rem 0.9rem" })}>Save</button>
          </div>
        </div>
      );
    }

    function PublicCalendar() {
      var events = (childData.public.calEvents || []).sort(function(a, b) { return a.date < b.date ? -1 : 1; });
      var EVENT_TYPES = [
        { id: "event",   label: "School Event",        color: T.blue },
        { id: "holiday", label: "Holiday / No School",  color: T.sage },
        { id: "early",   label: "Early Release",        color: T.sand },
        { id: "field",   label: "Field Trip",           color: T.rose },
        { id: "other",   label: "Other",                color: T.lavender },
      ];
      return (
        <div>
          <button onClick={function() { setEventForm({ title: "", date: "", type: "event", notes: "" }); setEditingEvent(null); setShowEventModal(true); }} style={Object.assign({}, btnP(T.blue), { width: "100%", marginBottom: "0.85rem" })}>+ Add Calendar Item</button>
          {events.length === 0 && <div style={{ color: T.textFaint, textAlign: "center", padding: "2rem 0", fontSize: "0.85rem" }}>No calendar items yet</div>}
          {events.map(function(ev) {
            var typeInfo = EVENT_TYPES.find(function(t) { return t.id === ev.type; }) || EVENT_TYPES[0];
            return (
              <div key={ev.id} style={card({ borderLeft: "3px solid " + typeInfo.color })}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: T.textDark, fontSize: "0.92rem" }}>{ev.title}</div>
                    <div style={{ color: typeInfo.color, fontSize: "0.72rem", fontWeight: 600, marginTop: "0.15rem" }}>{typeInfo.label}</div>
                    {ev.date && <div style={{ color: T.textMid, fontSize: "0.78rem", marginTop: "0.2rem" }}>📅 {new Date(ev.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button onClick={function() { setEventForm({ title: ev.title, date: ev.date, type: ev.type, notes: ev.notes }); setEditingEvent(ev.id); setShowEventModal(true); }} style={btnS({ padding: "0.3rem 0.65rem", fontSize: "0.72rem" })}>Edit</button>
                    <button onClick={function() { savePub({ calEvents: events.filter(function(x) { return x.id !== ev.id; }) }); }} style={btnS({ padding: "0.3rem 0.65rem", fontSize: "0.72rem", color: T.rose })}>✕</button>
                  </div>
                </div>
                {ev.notes && <div style={{ color: T.textSoft, fontSize: "0.76rem", marginTop: "0.4rem", fontStyle: "italic" }}>{ev.notes}</div>}
              </div>
            );
          })}
          {showEventModal && (
            <div style={{ position: "fixed", inset: 0, background: T.modalOverlay, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0" }}>
              <div style={{ background: T.surface, borderRadius: "1.2rem 1.2rem 0 0", padding: "1.5rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom,0px))", width: "min(480px,100%)", maxHeight: "calc(90dvh - env(safe-area-inset-top,0px))", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "1rem" }}>{editingEvent ? "Edit Item" : "Add Calendar Item"}</div>
                <div style={{ marginBottom: "0.65rem" }}>
                  <label style={lbl}>Title</label>
                  <input defaultValue={eventForm.title} onBlur={function(e) { var v = e.target.value; setEventForm(function(p) { return Object.assign({}, p, { title: v }); }); }} style={inp()} placeholder="Spring Concert, Picture Day..." />
                </div>
                <div style={{ marginBottom: "0.65rem" }}>
                  <label style={lbl}>Date</label>
                  <input type="date" defaultValue={eventForm.date} onBlur={function(e) { var v = e.target.value; setEventForm(function(p) { return Object.assign({}, p, { date: v }); }); }} style={inp()} />
                </div>
                <div style={{ marginBottom: "0.65rem" }}>
                  <label style={lbl}>Type</label>
                  <select value={eventForm.type} onChange={function(e) { var v = e.target.value; setEventForm(function(p) { return Object.assign({}, p, { type: v }); }); }} style={inp()}>
                    {[["event","School Event"],["holiday","Holiday / No School"],["early","Early Release"],["field","Field Trip"],["other","Other"]].map(function(o) { return <option key={o[0]} value={o[0]}>{o[1]}</option>; })}
                  </select>
                </div>
                <div style={{ marginBottom: "0.85rem" }}>
                  <label style={lbl}>Notes</label>
                  <textarea defaultValue={eventForm.notes} onBlur={function(e) { var v = e.target.value; setEventForm(function(p) { return Object.assign({}, p, { notes: v }); }); }} style={Object.assign({}, inp(), { minHeight: "50px" })} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={function() {
                    if (!eventForm.title.trim()) return;
                    var current = childData.public.calEvents || [];
                    if (editingEvent) {
                      savePub({ calEvents: current.map(function(e) { return e.id === editingEvent ? Object.assign({}, eventForm, { id: e.id }) : e; }) });
                    } else {
                      savePub({ calEvents: current.concat([Object.assign({}, eventForm, { id: suid() })]) });
                    }
                    setShowEventModal(false);
                  }} style={btnP(T.blue, { flex: 1 })}>Save</button>
                  <button onClick={function() { setShowEventModal(false); }} style={btnS({ flex: 1 })}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    function SpiritDays() {
      var spiritDays = (childData.public.spiritDays || []).sort(function(a, b) { return a.date < b.date ? -1 : 1; });
      return (
        <div>
          <button onClick={function() { setSpiritForm({ date: "", theme: "", notes: "" }); setEditingSpirit(null); setShowSpiritModal(true); }} style={Object.assign({}, btnP(T.rose), { width: "100%", marginBottom: "0.85rem" })}>+ Add Spirit Day</button>
          {spiritDays.length === 0 && <div style={{ color: T.textFaint, textAlign: "center", padding: "2rem 0", fontSize: "0.85rem" }}>No spirit days added yet</div>}
          {spiritDays.map(function(s) {
            return (
              <div key={s.id} style={card({ background: T.rosePale, borderColor: T.rose + "40" })}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: T.textDark, fontSize: "0.92rem" }}>🎉 {s.theme}</div>
                    {s.date && <div style={{ color: T.textMid, fontSize: "0.78rem", marginTop: "0.2rem" }}>📅 {new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button onClick={function() { setSpiritForm({ date: s.date, theme: s.theme, notes: s.notes }); setEditingSpirit(s.id); setShowSpiritModal(true); }} style={btnS({ padding: "0.3rem 0.65rem", fontSize: "0.72rem" })}>Edit</button>
                    <button onClick={function() { savePub({ spiritDays: spiritDays.filter(function(x) { return x.id !== s.id; }) }); }} style={btnS({ padding: "0.3rem 0.65rem", fontSize: "0.72rem", color: T.rose })}>✕</button>
                  </div>
                </div>
                {s.notes && <div style={{ color: T.textSoft, fontSize: "0.76rem", marginTop: "0.4rem", fontStyle: "italic" }}>{s.notes}</div>}
              </div>
            );
          })}
          {showSpiritModal && (
            <div style={{ position: "fixed", inset: 0, background: T.modalOverlay, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0" }}>
              <div style={{ background: T.surface, borderRadius: "1.2rem 1.2rem 0 0", padding: "1.5rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom,0px))", width: "min(480px,100%)", maxHeight: "calc(90dvh - env(safe-area-inset-top,0px))", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "1rem" }}>{editingSpirit ? "Edit Spirit Day" : "Add Spirit Day"}</div>
                <div style={{ marginBottom: "0.65rem" }}>
                  <label style={lbl}>Theme</label>
                  <input defaultValue={spiritForm.theme} onBlur={function(e) { var v = e.target.value; setSpiritForm(function(p) { return Object.assign({}, p, { theme: v }); }); }} style={inp()} placeholder="Pajama Day, Decade Day, Color Wars..." />
                </div>
                <div style={{ marginBottom: "0.85rem" }}>
                  <label style={lbl}>Date</label>
                  <input type="date" defaultValue={spiritForm.date} onBlur={function(e) { var v = e.target.value; setSpiritForm(function(p) { return Object.assign({}, p, { date: v }); }); }} style={inp()} />
                </div>
                <div style={{ marginBottom: "0.85rem" }}>
                  <label style={lbl}>Notes</label>
                  <textarea defaultValue={spiritForm.notes} onBlur={function(e) { var v = e.target.value; setSpiritForm(function(p) { return Object.assign({}, p, { notes: v }); }); }} style={Object.assign({}, inp(), { minHeight: "50px" })} placeholder="What to wear, items to bring..." />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={function() {
                    if (!spiritForm.theme.trim()) return;
                    var current = childData.public.spiritDays || [];
                    if (editingSpirit) {
                      savePub({ spiritDays: current.map(function(s) { return s.id === editingSpirit ? Object.assign({}, spiritForm, { id: s.id }) : s; }) });
                    } else {
                      savePub({ spiritDays: current.concat([Object.assign({}, spiritForm, { id: suid() })]) });
                    }
                    setShowSpiritModal(false);
                  }} style={btnP(T.rose, { flex: 1 })}>Save</button>
                  <button onClick={function() { setShowSpiritModal(false); }} style={btnS({ flex: 1 })}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    function HSOverview() {
      return (
        <div>
          <div style={card({ background: T.sagePale, borderColor: T.sage + "40" })}>
            <div style={{ fontWeight: 700, color: T.sage, fontSize: "1rem", marginBottom: "0.75rem" }}>📊 Attendance This Year</div>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: "2rem", fontWeight: 800, color: T.sage }}>{totalPresent}</div><div style={{ fontSize: "0.72rem", color: T.textMid, fontWeight: 600 }}>Present</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: "2rem", fontWeight: 800, color: T.rose }}>{totalAbsent}</div><div style={{ fontSize: "0.72rem", color: T.textMid, fontWeight: 600 }}>Absent</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: "2rem", fontWeight: 800, color: T.blue }}>{totalPresent + totalAbsent}</div><div style={{ fontSize: "0.72rem", color: T.textMid, fontWeight: 600 }}>Total Logged</div></div>
            </div>
          </div>
          <div style={card()}>
            <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "0.5rem" }}>📚 Active Curricula</div>
            {(childData.homeschool.curricula || []).length === 0
              ? <div style={{ color: T.textFaint, fontSize: "0.82rem" }}>No curricula added yet</div>
              : (childData.homeschool.curricula || []).map(function(c) { return <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0", borderBottom: "1px solid " + T.borderSoft, fontSize: "0.84rem", color: T.textDark }}><span>{c.subject}</span><span style={{ color: T.textMid }}>{c.name}</span></div>; })
            }
          </div>
          <div style={card()}>
            <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "0.5rem" }}>✏️ Recent Lessons</div>
            {(childData.homeschool.lessons || []).length === 0
              ? <div style={{ color: T.textFaint, fontSize: "0.82rem" }}>No lessons yet</div>
              : (childData.homeschool.lessons || []).slice(-3).reverse().map(function(l) {
                  return <div key={l.id} style={{ padding: "0.35rem 0", borderBottom: "1px solid " + T.borderSoft }}><div style={{ fontSize: "0.84rem", color: T.textDark, fontWeight: 600 }}>{l.title}</div><div style={{ fontSize: "0.72rem", color: T.textMid }}>{l.subject} · {l.date}</div></div>;
                })
            }
          </div>
          <button onClick={function() { setShowTypeModal(true); }} style={Object.assign({}, btnS(), { width: "100%", fontSize: "0.78rem" })}>🔄 Change school type</button>
        </div>
      );
    }

    function HSUmbrella() {
      var umbrella = childData.homeschool.umbrella || {};
      var [form, setForm] = React.useState({ name: umbrella.name || "", contact: umbrella.contact || "", email: umbrella.email || "", daysRequired: umbrella.daysRequired || "", notes: umbrella.notes || "" });
      return (
        <div style={card()}>
          <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "0.85rem" }}>☂️ Umbrella School Info</div>
          {[["name","School Name"],["contact","Contact Person"],["email","Email"],["daysRequired","Required Days / Year"]].map(function(f) {
            return (
              <div key={f[0]} style={{ marginBottom: "0.65rem" }}>
                <label style={lbl}>{f[1]}</label>
                <input value={form[f[0]]} onChange={function(e) { var v = e.target.value; var fk = f[0]; setForm(function(p) { var n = Object.assign({}, p); n[fk] = v; return n; }); }} style={inp()} />
              </div>
            );
          })}
          <div style={{ marginBottom: "0.85rem" }}>
            <label style={lbl}>Notes / Requirements</label>
            <textarea value={form.notes} onChange={function(e) { var v = e.target.value; setForm(function(p) { return Object.assign({}, p, { notes: v }); }); }} style={Object.assign({}, inp(), { minHeight: "70px", resize: "vertical" })} />
          </div>
          <button onClick={function() { saveHS({ umbrella: form }); }} style={btnP(T.sage, { width: "100%" })}>Save</button>
        </div>
      );
    }

    function HSCurricula() {
      var curricula = childData.homeschool.curricula || [];
      return (
        <div>
          <button onClick={function() { setCurriculumForm({ subject: "", name: "", website: "", notes: "" }); setEditingCurriculum(null); setShowCurriculumModal(true); }} style={Object.assign({}, btnP(T.sage), { width: "100%", marginBottom: "0.85rem" })}>+ Add Curriculum</button>
          {curricula.length === 0 && <div style={{ color: T.textFaint, textAlign: "center", padding: "2rem 0", fontSize: "0.85rem" }}>No curricula added yet</div>}
          {curricula.map(function(c) {
            return (
              <div key={c.id} style={card()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: T.textDark, fontSize: "0.92rem" }}>{c.subject}</div>
                    <div style={{ color: T.sage, fontSize: "0.78rem", fontWeight: 600 }}>{c.name}</div>
                    {c.website && <a href={c.website.startsWith("http") ? c.website : "https://" + c.website} target="_blank" rel="noreferrer" style={{ color: T.blue, fontSize: "0.75rem", display: "block", marginTop: "0.2rem" }}>🔗 {c.website}</a>}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button onClick={function() { setCurriculumForm({ subject: c.subject, name: c.name, website: c.website, notes: c.notes }); setEditingCurriculum(c.id); setShowCurriculumModal(true); }} style={btnS({ padding: "0.3rem 0.65rem", fontSize: "0.72rem" })}>Edit</button>
                    <button onClick={function() { saveHS({ curricula: curricula.filter(function(x) { return x.id !== c.id; }) }); }} style={btnS({ padding: "0.3rem 0.65rem", fontSize: "0.72rem", color: T.rose })}>✕</button>
                  </div>
                </div>
                {c.notes && <div style={{ color: T.textSoft, fontSize: "0.76rem", marginTop: "0.4rem", fontStyle: "italic" }}>{c.notes}</div>}
              </div>
            );
          })}
          {showCurriculumModal && (
            <div style={{ position: "fixed", inset: 0, background: T.modalOverlay, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0" }}>
              <div style={{ background: T.surface, borderRadius: "1.2rem 1.2rem 0 0", padding: "1.5rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom,0px))", width: "min(480px,100%)", maxHeight: "calc(90dvh - env(safe-area-inset-top,0px))", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "1rem" }}>{editingCurriculum ? "Edit Curriculum" : "Add Curriculum"}</div>
                {[["subject","Subject","text"],["name","Curriculum Name","text"],["website","Website","url"]].map(function(f) {
                  return (
                    <div key={f[0]} style={{ marginBottom: "0.65rem" }}>
                      <label style={lbl}>{f[1]}</label>
                      <input type={f[2]} key={f[0]+"_"+(editingCurriculum?editingCurriculum.id:"new")} defaultValue={curriculumForm[f[0]]} onBlur={function(e) { var v = e.target.value; var fk = f[0]; setCurriculumForm(function(p) { var n = Object.assign({}, p); n[fk] = v; return n; }); }} style={inp()} />
                    </div>
                  );
                })}
                <div style={{ marginBottom: "0.85rem" }}>
                  <label style={lbl}>Notes</label>
                  <textarea defaultValue={curriculumForm.notes} onBlur={function(e) { var v = e.target.value; setCurriculumForm(function(p) { return Object.assign({}, p, { notes: v }); }); }} style={Object.assign({}, inp(), { minHeight: "55px" })} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={function() {
                    if (!curriculumForm.subject.trim()) return;
                    var current = childData.homeschool.curricula || [];
                    if (editingCurriculum) {
                      saveHS({ curricula: current.map(function(c) { return c.id === editingCurriculum ? Object.assign({}, curriculumForm, { id: c.id }) : c; }) });
                    } else {
                      saveHS({ curricula: current.concat([Object.assign({}, curriculumForm, { id: suid() })]) });
                    }
                    setShowCurriculumModal(false);
                  }} style={btnP(T.sage, { flex: 1 })}>Save</button>
                  <button onClick={function() { setShowCurriculumModal(false); }} style={btnS({ flex: 1 })}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    function HSLessons() {
      // ── Week plan structure: { Monday: { subjects: [{id,name,title,todo,notes,done}], dayNotes: "" }, ... }
      var weekPlan = childData.homeschool.weekPlan || {};
      var curricula = childData.homeschool.curricula || [];
      var SCHOOL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
      var [lessonSubTab, setLessonSubTab] = React.useState("week");
      var [editingDay, setEditingDay] = React.useState(null);    // day name being edited
      var [editingSubjectIdx, setEditingSubjectIdx] = React.useState(null); // index in subjects array
      var [subjectModal, setSubjectModal] = React.useState(false);
      var [subjectForm, setSubjectForm] = React.useState({ name: "", title: "", todo: "", notes: "" });
      var [expandedDays, setExpandedDays] = React.useState({});
      var [copySourceDay, setCopySourceDay] = React.useState("");
      var [showCopyModal, setShowCopyModal] = React.useState(false);

      function getDayPlan(day) {
        return weekPlan[day] || { subjects: [], dayNotes: "" };
      }

      function saveDayPlan(day, patch) {
        var current = getDayPlan(day);
        var next = Object.assign({}, weekPlan);
        next[day] = Object.assign({}, current, patch);
        saveHS({ weekPlan: next });
      }

      function openAddSubject(day) {
        setEditingDay(day);
        setEditingSubjectIdx(null);
        setSubjectForm({ name: curricula.length > 0 ? curricula[0].subject : "", title: "", todo: "", notes: "" });
        setSubjectModal(true);
      }

      function openEditSubject(day, idx) {
        var s = getDayPlan(day).subjects[idx];
        setEditingDay(day);
        setEditingSubjectIdx(idx);
        setSubjectForm({ name: s.name || "", title: s.title || "", todo: s.todo || "", notes: s.notes || "" });
        setSubjectModal(true);
      }

      function saveSubject() {
        if (!subjectForm.name.trim()) return;
        var plan = getDayPlan(editingDay);
        var subjects = (plan.subjects || []).slice();
        if (editingSubjectIdx !== null) {
          subjects[editingSubjectIdx] = Object.assign({}, subjects[editingSubjectIdx], subjectForm);
        } else {
          subjects.push(Object.assign({}, subjectForm, { id: suid(), done: false }));
        }
        saveDayPlan(editingDay, { subjects: subjects });
        setSubjectModal(false);
      }

      function deleteSubject(day, idx) {
        var plan = getDayPlan(day);
        var subjects = (plan.subjects || []).filter(function(_, i) { return i !== idx; });
        saveDayPlan(day, { subjects: subjects });
      }

      function toggleSubjectDone(day, idx) {
        var plan = getDayPlan(day);
        var subjects = (plan.subjects || []).slice();
        subjects[idx] = Object.assign({}, subjects[idx], { done: !subjects[idx].done });
        saveDayPlan(day, { subjects: subjects });
      }

      function clearWeek() {
        var next = {};
        SCHOOL_DAYS.forEach(function(d) { next[d] = { subjects: [], dayNotes: "" }; });
        saveHS({ weekPlan: next });
      }

      function copyDayToAll(sourceDay) {
        var source = getDayPlan(sourceDay);
        var next = Object.assign({}, weekPlan);
        SCHOOL_DAYS.forEach(function(d) {
          if (d !== sourceDay) {
            next[d] = { subjects: source.subjects.map(function(s) { return Object.assign({}, s, { id: suid(), done: false }); }), dayNotes: "" };
          }
        });
        saveHS({ weekPlan: next });
        setShowCopyModal(false);
      }

      // Summary counts
      var totalSubjects = SCHOOL_DAYS.reduce(function(acc, d) { return acc + (getDayPlan(d).subjects || []).length; }, 0);
      var totalDone = SCHOOL_DAYS.reduce(function(acc, d) { return acc + (getDayPlan(d).subjects || []).filter(function(s) { return s.done; }).length; }, 0);

      var LESSON_TABS = [
        { id: "week",    label: "This Week", emoji: "📆" },
        { id: "history", label: "Past Plans", emoji: "🗂️" },
      ];

      return (
        <div>
          {/* Sub-tab bar */}
          <ScrollTabs style={{ marginBottom: "0.85rem", background: T.bgAlt, borderRadius: "0.8rem", padding: "0.28rem", border: "1px solid " + T.border }}>
            {LESSON_TABS.map(function(st) {
              return (
                <button key={st.id} onClick={function() { setLessonSubTab(st.id); }} style={{ flexShrink: 0, background: lessonSubTab === st.id ? T.sage : "transparent", color: lessonSubTab === st.id ? "#fff" : T.textMid, border: "none", borderRadius: "0.55rem", padding: "0.4rem 0.7rem", cursor: "pointer", fontSize: "0.73rem", fontWeight: 700, fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                  {st.emoji} {st.label}
                </button>
              );
            })}
          </ScrollTabs>

          {lessonSubTab === "week" && (
            <div>
              {/* Week summary bar */}
              <div style={card({ background: T.sagePale, border: "1.5px solid " + T.sage + "40", padding: "0.85rem 1rem", marginBottom: "0.85rem" })}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", gap: "1.5rem" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: T.sage }}>{totalSubjects}</div>
                      <div style={{ fontSize: "0.65rem", color: T.textMid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Planned</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: T.sageDark }}>{totalDone}</div>
                      <div style={{ fontSize: "0.65rem", color: T.textMid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Done</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: T.blue }}>{totalSubjects - totalDone}</div>
                      <div style={{ fontSize: "0.65rem", color: T.textMid, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Left</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button onClick={function() { setShowCopyModal(true); }} style={btnS({ fontSize: "0.72rem", padding: "0.3rem 0.65rem" })}>📋 Copy Day</button>
                    <button onClick={clearWeek} style={btnS({ fontSize: "0.72rem", padding: "0.3rem 0.65rem", color: T.rose })}>🗑 Clear Week</button>
                  </div>
                </div>
              </div>

              {/* Day cards */}
              {SCHOOL_DAYS.map(function(day) {
                var plan = getDayPlan(day);
                var subjects = plan.subjects || [];
                var isToday = day === TODAY_NAME;
                var expanded = expandedDays[day] !== false; // default expanded
                var doneCount = subjects.filter(function(s) { return s.done; }).length;
                return (
                  <div key={day} style={card({ borderLeft: "4px solid " + (isToday ? T.sage : T.borderSoft), background: isToday ? "linear-gradient(to right," + T.sagePale + "," + T.surface + ")" : T.surface, marginBottom: "0.75rem" })}>
                    {/* Day header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: expanded ? "0.75rem" : 0 }}>
                      <button onClick={function() { setExpandedDays(function(p) { var n = Object.assign({}, p); n[day] = !expanded; return n; }); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", padding: 0, fontFamily: "inherit" }}>
                        <span style={{ fontWeight: 700, color: isToday ? T.sageDark : T.textDark, fontSize: "0.95rem" }}>{day}</span>
                        {isToday && <span style={{ background: T.sage, color: "#fff", fontSize: "0.58rem", fontWeight: 800, borderRadius: "2rem", padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Today</span>}
                        {subjects.length > 0 && <span style={{ color: T.textFaint, fontSize: "0.72rem" }}>{doneCount}/{subjects.length}</span>}
                        <span style={{ color: T.textFaint, fontSize: "0.7rem" }}>{expanded ? "▾" : "▸"}</span>
                      </button>
                      <button onClick={function() { openAddSubject(day); }} style={btnS({ fontSize: "0.72rem", padding: "0.28rem 0.65rem", display: "flex", alignItems: "center", gap: "0.25rem" })}>
                        + Subject
                      </button>
                    </div>

                    {expanded && (
                      <div>
                        {/* Subject rows */}
                        {subjects.length === 0 && (
                          <div style={{ color: T.textFaint, fontSize: "0.8rem", textAlign: "center", padding: "0.75rem 0", fontStyle: "italic" }}>No subjects planned — tap + Subject to add</div>
                        )}
                        {subjects.map(function(s, idx) {
                          return (
                            <div key={s.id || idx} style={{ background: s.done ? T.bgAlt : T.white, border: "1.5px solid " + (s.done ? T.border : T.borderSoft), borderRadius: "0.65rem", padding: "0.6rem 0.75rem", marginBottom: "0.45rem", opacity: s.done ? 0.65 : 1, transition: "all 0.15s" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                                {/* Done checkbox */}
                                <button onClick={function() { toggleSubjectDone(day, idx); }} style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "0.35rem", border: "2px solid " + (s.done ? T.sage : T.border), background: s.done ? T.sage : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "1px", transition: "all 0.15s" }}>
                                  {s.done && <span style={{ color: "#fff", fontSize: "0.65rem", fontWeight: 900 }}>✓</span>}
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  {/* Subject name badge + title */}
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginBottom: s.todo || s.notes ? "0.3rem" : 0 }}>
                                    <span style={{ background: T.sagePale, color: T.sageDark, fontSize: "0.65rem", fontWeight: 800, borderRadius: "2rem", padding: "1px 8px", border: "1px solid " + T.sage + "30", flexShrink: 0, textDecoration: s.done ? "line-through" : "none" }}>{s.name}</span>
                                    {s.title && <span style={{ color: s.done ? T.textFaint : T.textDark, fontSize: "0.82rem", fontWeight: 600, textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>}
                                  </div>
                                  {/* To-do */}
                                  {s.todo && <div style={{ color: T.textMid, fontSize: "0.76rem", marginBottom: "0.15rem", lineHeight: 1.45 }}>📌 {s.todo}</div>}
                                  {/* Notes */}
                                  {s.notes && <div style={{ color: T.textSoft, fontSize: "0.73rem", fontStyle: "italic" }}>💬 {s.notes}</div>}
                                </div>
                                {/* Edit / delete */}
                                <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                                  <button onClick={function() { openEditSubject(day, idx); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: T.textFaint, fontSize: "0.72rem" }}>✏️</button>
                                  <button onClick={function() { deleteSubject(day, idx); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: T.rose, fontSize: "0.72rem" }}>✕</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Day notes */}
                        <div style={{ marginTop: "0.5rem" }}>
                          <textarea
                            key={day+"_notes"}
                            defaultValue={plan.dayNotes || ""}
                            onBlur={function(e) { var v = e.target.value; saveDayPlan(day, { dayNotes: v }); }}
                            placeholder="Day notes — field trips, appointments, special plans..."
                            style={Object.assign({}, inp({ fontSize: "0.76rem", padding: "0.45rem 0.65rem" }), { minHeight: "44px", resize: "none", color: T.textMid })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {lessonSubTab === "history" && (
            <div>
              <div style={card()}>
                <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "0.5rem" }}>🗂️ Past Lesson Plans</div>
                <div style={{ color: T.textMid, fontSize: "0.82rem", lineHeight: 1.6 }}>
                  Past plans are saved automatically each week when you clear or plan a new week. This feature is coming soon — for now your current week plan persists until you clear it.
                </div>
              </div>
            </div>
          )}

          {/* Subject add/edit modal */}
          {subjectModal && (
            <div style={{ position: "fixed", inset: 0, background: T.modalOverlay, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0" }}>
              <div style={{ background: T.surface, borderRadius: "1.2rem 1.2rem 0 0", padding: "1.5rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom,0px))", width: "min(480px,100%)", maxHeight: "calc(88dvh - env(safe-area-inset-top,0px))", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "1rem", fontSize: "1rem" }}>
                  {editingSubjectIdx !== null ? "Edit Subject" : "Add Subject"} — {editingDay}
                </div>
                {/* Subject / curriculum picker */}
                <div style={{ marginBottom: "0.65rem" }}>
                  <label style={lbl}>Subject</label>
                  {curricula.length > 0
                    ? <select defaultValue={subjectForm.name} onBlur={function(e) { var v = e.target.value; setSubjectForm(function(p) { return Object.assign({}, p, { name: v }); }); }} style={inp()}>
                        <option value="">Select subject...</option>
                        {curricula.map(function(c) { return <option key={c.id} value={c.subject}>{c.subject}</option>; })}
                        <option value="Other">Other</option>
                      </select>
                    : <input value={subjectForm.name} onChange={function(e) { var v = e.target.value; setSubjectForm(function(p) { return Object.assign({}, p, { name: v }); }); }} style={inp()} placeholder="Math, Reading, Science..." />
                  }
                </div>
                {/* Lesson / unit title */}
                <div style={{ marginBottom: "0.65rem" }}>
                  <label style={lbl}>Lesson / Unit Title</label>
                  <input defaultValue={subjectForm.title} onBlur={function(e) { var v = e.target.value; setSubjectForm(function(p) { return Object.assign({}, p, { title: v }); }); }} style={inp()} placeholder="Chapter 4: Fractions, Timeline of WWI..." />
                </div>
                {/* What to do */}
                <div style={{ marginBottom: "0.65rem" }}>
                  <label style={lbl}>What to do / pages / objectives</label>
                  <textarea defaultValue={subjectForm.todo} onBlur={function(e) { var v = e.target.value; setSubjectForm(function(p) { return Object.assign({}, p, { todo: v }); }); }} style={Object.assign({}, inp(), { minHeight: "70px", resize: "vertical" })} placeholder="Workbook pp. 42-45, watch Khan Academy video, complete worksheet 3..." />
                </div>
                {/* Notes */}
                <div style={{ marginBottom: "0.85rem" }}>
                  <label style={lbl}>Notes / Resources</label>
                  <input defaultValue={subjectForm.notes} onBlur={function(e) { var v = e.target.value; setSubjectForm(function(p) { return Object.assign({}, p, { notes: v }); }); }} style={inp()} placeholder="Manipulatives needed, print pages 8-9, video link..." />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={saveSubject} style={btnP(T.sage, { flex: 1 })}>Save</button>
                  <button onClick={function() { setSubjectModal(false); }} style={btnS({ flex: 1 })}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Copy day modal */}
          {showCopyModal && (
            <div style={{ position: "fixed", inset: 0, background: T.modalOverlay, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "env(safe-area-inset-top,1rem) 1rem env(safe-area-inset-bottom,1rem)", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
              <div style={{ background: T.surface, borderRadius: "1.2rem", padding: "1.5rem", width: "min(340px,100%)", maxHeight: "calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 2rem)", overflowY: "auto" }}>
                <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "0.4rem" }}>📋 Copy Day to All Days</div>
                <div style={{ color: T.textMid, fontSize: "0.82rem", marginBottom: "1rem" }}>Pick a day to copy its subjects to all other school days.</div>
                <div style={{ marginBottom: "0.85rem" }}>
                  <label style={lbl}>Copy from</label>
                  <select value={copySourceDay} onChange={function(e) { setCopySourceDay(e.target.value); }} style={inp()}>
                    <option value="">Select a day...</option>
                    {SCHOOL_DAYS.map(function(d) { return <option key={d} value={d}>{d}</option>; })}
                  </select>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={function() { if (copySourceDay) copyDayToAll(copySourceDay); }} style={btnP(T.sage, { flex: 1 })} disabled={!copySourceDay}>Copy</button>
                  <button onClick={function() { setShowCopyModal(false); }} style={btnS({ flex: 1 })}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    function HSAttendance() {
      var now = new Date();
      var calDays = getCalendarDays();
      var monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      return (
        <div>
          <div style={card()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div style={{ fontWeight: 700, color: T.textDark }}>{monthName}</div>
              <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.72rem" }}>
                <span style={{ color: T.sage, fontWeight: 700 }}>✓ {Object.values(attendance).filter(function(v) { return v === "present"; }).length} present</span>
                <span style={{ color: T.rose, fontWeight: 700 }}>✗ {Object.values(attendance).filter(function(v) { return v === "absent"; }).length} absent</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px", marginBottom: "0.5rem" }}>
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map(function(d) {
                return <div key={d} style={{ textAlign: "center", fontSize: "0.62rem", color: T.textFaint, fontWeight: 700, padding: "0.2rem 0" }}>{d}</div>;
              })}
              {calDays.map(function(dayObj, i) {
                if (!dayObj) return <div key={"e" + i} />;
                var status = attendance[dayObj.iso];
                var isToday = dayObj.iso === todayISO;
                var dow = new Date(dayObj.iso + "T12:00:00").getDay();
                var isWeekend = dow === 0 || dow === 6;
                return (
                  <button key={dayObj.iso} onClick={function() { if (!isWeekend) toggleAttendance(dayObj.iso); }} style={{ padding: "0.22rem 0", border: isToday ? "2px solid " + T.blue : "1.5px solid " + (status ? "transparent" : T.borderSoft), borderRadius: "0.4rem", cursor: isWeekend ? "default" : "pointer", background: status === "present" ? T.sage : status === "absent" ? T.rose : isWeekend ? T.bgAlt : T.surface, color: status ? "#fff" : isWeekend ? T.textFaint : T.textDark, fontSize: "0.7rem", fontWeight: isToday ? 800 : 500, fontFamily: "inherit", transition: "all 0.12s" }}>
                    {status === "present" ? "✓" : status === "absent" ? "✗" : dayObj.day}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: "0.72rem", color: T.textFaint, textAlign: "center" }}>Tap a weekday to cycle: unmarked → present → absent → clear</div>
          </div>
          <div style={card({ background: T.sagePale, borderColor: T.sage + "40" })}>
            <div style={{ fontWeight: 700, color: T.sage, marginBottom: "0.5rem" }}>📊 Year-to-Date</div>
            <div style={{ display: "flex", gap: "2rem" }}>
              <div><span style={{ fontSize: "1.6rem", fontWeight: 800, color: T.sage }}>{totalPresent}</span><div style={{ fontSize: "0.7rem", color: T.textMid }}>Present</div></div>
              <div><span style={{ fontSize: "1.6rem", fontWeight: 800, color: T.rose }}>{totalAbsent}</span><div style={{ fontSize: "0.7rem", color: T.textMid }}>Absent</div></div>
              {childData.homeschool.umbrella && childData.homeschool.umbrella.daysRequired && (
                <div><span style={{ fontSize: "1.6rem", fontWeight: 800, color: T.blue }}>{Math.max(0, parseInt(childData.homeschool.umbrella.daysRequired) - totalPresent)}</span><div style={{ fontSize: "0.7rem", color: T.textMid }}>Days left to goal</div></div>
              )}
            </div>
          </div>
        </div>
      );
    }

    function HSActivities() {
      var activities = (childData.homeschool.activities || []).sort(function(a, b) { return a.date < b.date ? -1 : 1; });
      var upcoming = activities.filter(function(a) { return a.date >= todayISO; });
      var past = activities.filter(function(a) { return a.date < todayISO; });
      return (
        <div>
          <button onClick={function() { setActivityForm({ title: "", date: "", time: "", location: "", notes: "" }); setEditingActivity(null); setShowActivityModal(true); }} style={Object.assign({}, btnP(T.lavender), { width: "100%", marginBottom: "0.85rem" })}>+ Add Activity</button>
          {upcoming.length > 0 && (
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.72rem", color: T.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>Upcoming</div>
              {upcoming.map(function(a) {
                return (
                  <div key={a.id} style={card({ borderLeft: "3px solid " + T.lavender })}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: T.textDark, fontSize: "0.92rem" }}>{a.title}</div>
                        {a.date && <div style={{ color: T.textMid, fontSize: "0.78rem", marginTop: "0.2rem" }}>📅 {new Date(a.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{a.time ? " · " + a.time : ""}</div>}
                        {a.location && <div style={{ color: T.textMid, fontSize: "0.75rem" }}>📍 {a.location}</div>}
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button onClick={function() { setActivityForm({ title: a.title, date: a.date, time: a.time, location: a.location, notes: a.notes }); setEditingActivity(a.id); setShowActivityModal(true); }} style={btnS({ padding: "0.3rem 0.65rem", fontSize: "0.72rem" })}>Edit</button>
                        <button onClick={function() { saveHS({ activities: activities.filter(function(x) { return x.id !== a.id; }) }); }} style={btnS({ padding: "0.3rem 0.65rem", fontSize: "0.72rem", color: T.rose })}>✕</button>
                      </div>
                    </div>
                    {a.notes && <div style={{ color: T.textSoft, fontSize: "0.76rem", marginTop: "0.4rem", fontStyle: "italic" }}>{a.notes}</div>}
                  </div>
                );
              })}
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div style={{ fontSize: "0.72rem", color: T.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>Past</div>
              {past.slice(-5).reverse().map(function(a) {
                return (
                  <div key={a.id} style={card({ opacity: 0.65 })}>
                    <div style={{ fontWeight: 600, color: T.textMid, fontSize: "0.88rem" }}>{a.title}</div>
                    {a.date && <div style={{ color: T.textFaint, fontSize: "0.75rem" }}>📅 {new Date(a.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>}
                  </div>
                );
              })}
            </div>
          )}
          {activities.length === 0 && <div style={{ color: T.textFaint, textAlign: "center", padding: "2rem 0", fontSize: "0.85rem" }}>No activities yet — add field trips, co-ops, classes</div>}
          {showActivityModal && (
            <div style={{ position: "fixed", inset: 0, background: T.modalOverlay, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0" }}>
              <div style={{ background: T.surface, borderRadius: "1.2rem 1.2rem 0 0", padding: "1.5rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom,0px))", width: "min(480px,100%)", maxHeight: "calc(90dvh - env(safe-area-inset-top,0px))", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "1rem" }}>{editingActivity ? "Edit Activity" : "Add Activity"}</div>
                {[["title","Title","text"],["date","Date","date"],["time","Time","time"],["location","Location","text"]].map(function(f) {
                  return (
                    <div key={f[0]} style={{ marginBottom: "0.65rem" }}>
                      <label style={lbl}>{f[1]}</label>
                      <input type={f[2]} key={f[0]+"_"+(editingActivity?editingActivity.id:"new")} defaultValue={activityForm[f[0]]} onBlur={function(e) { var v = e.target.value; var fk = f[0]; setActivityForm(function(p) { var n = Object.assign({}, p); n[fk] = v; return n; }); }} style={inp()} />
                    </div>
                  );
                })}
                <div style={{ marginBottom: "0.85rem" }}>
                  <label style={lbl}>Notes</label>
                  <textarea defaultValue={activityForm.notes} onBlur={function(e) { var v = e.target.value; setActivityForm(function(p) { return Object.assign({}, p, { notes: v }); }); }} style={Object.assign({}, inp(), { minHeight: "55px" })} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={function() {
                    if (!activityForm.title.trim()) return;
                    var current = childData.homeschool.activities || [];
                    if (editingActivity) {
                      saveHS({ activities: current.map(function(a) { return a.id === editingActivity ? Object.assign({}, activityForm, { id: a.id }) : a; }) });
                    } else {
                      saveHS({ activities: current.concat([Object.assign({}, activityForm, { id: suid() })]) });
                    }
                    setShowActivityModal(false);
                  }} style={btnP(T.lavender, { flex: 1 })}>Save</button>
                  <button onClick={function() { setShowActivityModal(false); }} style={btnS({ flex: 1 })}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── Break mode data helpers ────────────────────────────────────────────────
    var breakGoals = (activeChild && schoolData[activeChild] && schoolData[activeChild].breakGoals) || [];

    function saveBreakGoals(list) {
      setSchoolData(function(prev) {
        var next = Object.assign({}, prev);
        var existing = prev[activeChild] || {};
        next[activeChild] = Object.assign({}, existing, { breakGoals: list });
        return next;
      });
    }

    var BREAK_COLORS = { summer: "#e8a84c", winter: "#6ba3c4", spring: "#7db87a" };
    var BREAK_EMOJIS = { summer: "☀️", winter: "❄️", spring: "🌸" };
    var BREAK_LABELS = { summer: "Summer Break", winter: "Winter Break", spring: "Spring Break" };

    function BreakModePanel() {
      var currentBreakGoals = breakGoals.filter(function(g) { return g.break === breakMode; });
      var breakColor = BREAK_COLORS[breakMode] || T.sand;
      var breakEmoji = BREAK_EMOJIS[breakMode] || "🌟";
      var breakLabel = BREAK_LABELS[breakMode] || "Break";

      return (
        <div>
          {/* Break header banner */}
          <div style={{ background: "linear-gradient(135deg, " + breakColor + "22, " + breakColor + "08)", border: "1.5px solid " + breakColor + "55", borderRadius: "1rem", padding: "1rem 1.1rem", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "1.8rem" }}>{breakEmoji}</span>
              <div>
                <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.2rem", fontWeight: 700, color: breakColor }}>{breakLabel}</div>
                <div style={{ fontSize: "0.72rem", color: T.textMid }}>Goals, challenges & reading targets</div>
              </div>
            </div>
            <button onClick={function() { setBreakMode(null); }} style={{ background: "none", border: "1px solid " + T.border, borderRadius: "2rem", padding: "0.3rem 0.75rem", fontSize: "0.72rem", color: T.textMid, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
          </div>

          {/* Add goal button */}
          <button onClick={function() {
            setBreakGoalForm({ title: "", type: "goal", target: "", unit: "", notes: "" });
            setEditingBreakGoal(null);
            setShowBreakGoalModal(true);
          }} style={Object.assign({}, btnP(breakColor), { width: "100%", marginBottom: "0.85rem", color: "#fff" })}>+ Add Goal or Challenge</button>

          {/* Goal list */}
          {currentBreakGoals.length === 0 && (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: T.textFaint, fontSize: "0.85rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.6rem" }}>{breakEmoji}</div>
              No goals yet — add reading targets, challenges, or activities!
            </div>
          )}
          {currentBreakGoals.map(function(g) {
            var pct = g.target && g.progress != null ? Math.min(100, Math.round((g.progress / parseInt(g.target)) * 100)) : null;
            return (
              <div key={g.id} style={card({ borderLeft: "3px solid " + breakColor })}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
                      <span style={{ background: breakColor + "22", color: breakColor, fontSize: "0.62rem", fontWeight: 800, borderRadius: "2rem", padding: "1px 8px", border: "1px solid " + breakColor + "40", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {g.type === "reading" ? "📚 Reading" : g.type === "daily" ? "📆 Daily" : "🎯 Goal"}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, color: T.textDark, fontSize: "0.92rem" }}>{g.title}</div>
                    {g.target && <div style={{ color: T.textMid, fontSize: "0.78rem", marginTop: "0.2rem" }}>Target: {g.progress != null ? g.progress : 0} / {g.target} {g.unit}</div>}
                    {g.notes && <div style={{ color: T.textSoft, fontSize: "0.75rem", fontStyle: "italic", marginTop: "0.2rem" }}>{g.notes}</div>}
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
                    <button onClick={function() {
                      setBreakGoalForm({ title: g.title, type: g.type, target: g.target || "", unit: g.unit || "", notes: g.notes || "" });
                      setEditingBreakGoal(g.id);
                      setShowBreakGoalModal(true);
                    }} style={btnS({ padding: "0.3rem 0.6rem", fontSize: "0.7rem" })}>Edit</button>
                    <button onClick={function() {
                      saveBreakGoals(breakGoals.filter(function(x) { return x.id !== g.id; }));
                    }} style={btnS({ padding: "0.3rem 0.6rem", fontSize: "0.7rem", color: T.rose })}>✕</button>
                  </div>
                </div>
                {/* Progress bar */}
                {g.target && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                      <span style={{ fontSize: "0.7rem", color: T.textFaint }}>{pct}% complete</span>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <button onClick={function() {
                          var curProg = g.progress || 0;
                          if (curProg > 0) saveBreakGoals(breakGoals.map(function(x) { return x.id === g.id ? Object.assign({}, x, { progress: curProg - 1 }) : x; }));
                        }} style={{ background: T.bgAlt, border: "1px solid " + T.border, borderRadius: "0.4rem", width: "26px", height: "26px", cursor: "pointer", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <button onClick={function() {
                          var curProg = g.progress || 0;
                          var newProg = curProg + 1;
                          saveBreakGoals(breakGoals.map(function(x) { return x.id === g.id ? Object.assign({}, x, { progress: newProg }) : x; }));
                          var tgt = parseInt(g.target);
                          if (g.target && tgt > 0 && curProg < tgt && newProg >= tgt) {
                            window.dispatchEvent(new CustomEvent("af-celebrate", { detail: { heading: "Goal reached!", title: g.title, who: (child && child.name) ? child.name : "" } }));
                          }
                        }} style={{ background: breakColor + "22", border: "1px solid " + breakColor + "55", borderRadius: "0.4rem", width: "26px", height: "26px", cursor: "pointer", fontSize: "0.85rem", color: breakColor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>+</button>
                      </div>
                    </div>
                    <div style={{ background: T.bgAlt, borderRadius: "2rem", height: "6px", overflow: "hidden" }}>
                      <div style={{ background: breakColor, width: pct + "%", height: "100%", borderRadius: "2rem", transition: "width 0.3s" }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add/Edit modal */}
          {showBreakGoalModal && (
            <div style={{ position: "fixed", inset: 0, background: T.modalOverlay, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0" }}>
              <div style={{ background: T.surface, borderRadius: "1.2rem 1.2rem 0 0", padding: "1.5rem", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom,0px))", width: "min(480px,100%)", maxHeight: "calc(88dvh - env(safe-area-inset-top,0px))", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "1rem" }}>{editingBreakGoal ? "Edit Goal" : "Add Goal"}</div>

                <div style={{ marginBottom: "0.65rem" }}>
                  <label style={lbl}>Type</label>
                  <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.65rem" }}>
                    {[["goal","🎯 Goal"],["reading","📚 Reading"],["daily","📆 Daily habit"]].map(function(t) {
                      return <button key={t[0]} onClick={function() { setBreakGoalForm(function(p) { return Object.assign({}, p, { type: t[0] }); }); }} style={{ flex: 1, background: breakGoalForm.type === t[0] ? breakColor + "22" : T.bgAlt, border: "1.5px solid " + (breakGoalForm.type === t[0] ? breakColor + "88" : T.border), borderRadius: "0.65rem", padding: "0.55rem 0.3rem", fontSize: "0.72rem", color: breakGoalForm.type === t[0] ? breakColor : T.textMid, cursor: "pointer", fontFamily: "inherit", fontWeight: breakGoalForm.type === t[0] ? 700 : 400 }}>{t[1]}</button>;
                    })}
                  </div>
                </div>

                <div style={{ marginBottom: "0.65rem" }}>
                  <label style={lbl}>Title</label>
                  <input defaultValue={breakGoalForm.title} onBlur={function(e) { var v = e.target.value; setBreakGoalForm(function(p) { return Object.assign({}, p, { title: v }); }); }} style={inp()} placeholder={breakGoalForm.type === "reading" ? "Read 30 books this summer" : breakGoalForm.type === "daily" ? "15 min reading every day" : "Learn to ride a bike"} />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.65rem" }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Target number</label>
                    <input type="number" defaultValue={breakGoalForm.target} onBlur={function(e) { var v = e.target.value; setBreakGoalForm(function(p) { return Object.assign({}, p, { target: v }); }); }} style={inp()} placeholder="30" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Unit</label>
                    <input defaultValue={breakGoalForm.unit} onBlur={function(e) { var v = e.target.value; setBreakGoalForm(function(p) { return Object.assign({}, p, { unit: v }); }); }} style={inp()} placeholder="books, days, hours..." />
                  </div>
                </div>

                <div style={{ marginBottom: "0.85rem" }}>
                  <label style={lbl}>Notes</label>
                  <textarea defaultValue={breakGoalForm.notes} onBlur={function(e) { var v = e.target.value; setBreakGoalForm(function(p) { return Object.assign({}, p, { notes: v }); }); }} style={Object.assign({}, inp(), { minHeight: "55px" })} placeholder="Details, rewards, ideas..." />
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={function() {
                    if (!breakGoalForm.title.trim()) return;
                    if (editingBreakGoal) {
                      saveBreakGoals(breakGoals.map(function(g) { return g.id === editingBreakGoal ? Object.assign({}, g, breakGoalForm) : g; }));
                    } else {
                      saveBreakGoals(breakGoals.concat([Object.assign({}, breakGoalForm, { id: suid(), break: breakMode, progress: 0 })]));
                    }
                    setShowBreakGoalModal(false);
                  }} style={btnP(breakColor, { flex: 1, color: "#fff" })}>Save</button>
                  <button onClick={function() { setShowBreakGoalModal(false); }} style={btnS({ flex: 1 })}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ paddingBottom: "4rem" }}>
        {showTypeModal && <TypePicker />}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
            <button onClick={function(){goTab("anchor");}} style={{background:"none",border:"none",cursor:"pointer",padding:"2px 4px",display:"flex",alignItems:"center",opacity:0.5,flexShrink:0}}>
              <Icon name="arrow-left" size={17} color={T.textSoft}/>
            </button>
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.45rem", color: T.textDark }}>🏫 School</div>
          </div>
        </div>
        {schoolKids.length > 1 && (
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.85rem", overflowX: "auto", paddingBottom: "2px" }}>
            {schoolKids.map(function(k) {
              var isActive = k.id === activeChild;
              return (
                <button key={k.id} onClick={function() { setActiveChild(k.id); setSubTab("overview"); }} style={{ background: isActive ? (k.color || T.blue) : "transparent", color: isActive ? "#fff" : T.textMid, border: "1.5px solid " + (isActive ? (k.color || T.blue) : T.border), borderRadius: "2rem", padding: "0.3rem 0.9rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: isActive ? 700 : 500, fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.14s" }}>
                  {k.name}
                </button>
              );
            })}
          </div>
        )}
        {!childData.type && (
          <div style={card({ textAlign: "center", padding: "2.5rem 1rem" })}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>👋</div>
            <div style={{ fontWeight: 700, color: T.textDark, marginBottom: "0.4rem", fontSize: "1rem" }}>Set up school for {child ? child.name : ""}</div>
            <div style={{ color: T.textMid, fontSize: "0.84rem", marginBottom: "1.25rem" }}>Choose the type of school to see the right tools.</div>
            <button onClick={function() { setShowTypeModal(true); }} style={btnP(T.blue, { margin: "0 auto" })}>Get Started</button>
          </div>
        )}
        {childData.type && activeTabs.length > 0 && (
          <div style={{ display: "flex", gap: "0.25rem", overflowX: "auto", paddingBottom: "3px", marginBottom: "0.85rem" }}>
            {activeTabs.map(function(t) {
              var isActive = subTab === t.id;
              return (
                <button key={t.id} onClick={function() { setSubTab(t.id); setBreakMode(null); }} style={{ background: isActive && !breakMode ? T.blue : "transparent", color: isActive && !breakMode ? "#fff" : T.textMid, border: "1.5px solid " + (isActive && !breakMode ? T.blue : T.border), borderRadius: "2rem", padding: "0.3rem 0.75rem", cursor: "pointer", fontSize: "0.74rem", fontWeight: isActive && !breakMode ? 700 : 500, fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.14s" }}>
                  {t.emoji} {t.label}
                </button>
              );
            })}
          </div>
        )}
        {/* Break mode selector */}
        {childData.type && (
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.85rem", overflowX: "auto", paddingBottom: "2px" }}>
            <span style={{ fontSize: "0.7rem", color: T.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", alignSelf: "center", flexShrink: 0, marginRight: "0.1rem" }}>Break:</span>
            {[["summer","☀️ Summer","#e8a84c"],["winter","❄️ Winter","#6ba3c4"],["spring","🌸 Spring","#7db87a"]].map(function(b) {
              var isActive = breakMode === b[0];
              return (
                <button key={b[0]} onClick={function() { setBreakMode(isActive ? null : b[0]); }} style={{ background: isActive ? b[2] + "22" : "transparent", color: isActive ? b[2] : T.textMid, border: "1.5px solid " + (isActive ? b[2] + "88" : T.border), borderRadius: "2rem", padding: "0.28rem 0.75rem", cursor: "pointer", fontSize: "0.74rem", fontWeight: isActive ? 700 : 400, fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.14s" }}>
                  {b[1]}
                </button>
              );
            })}
          </div>
        )}
        {breakMode && childData.type && <BreakModePanel />}
        {!breakMode && childData.type === "public" && (
          <React.Fragment>
            {subTab === "overview" && <PublicOverview />}
            {subTab === "teachers" && <PublicTeachers />}
            {subTab === "schedule" && <PublicSchedule />}
            {subTab === "calendar" && <PublicCalendar />}
            {subTab === "spirit"   && <SpiritDays />}
          </React.Fragment>
        )}
        {!breakMode && childData.type === "homeschool" && (
          <React.Fragment>
            {subTab === "overview"   && <HSOverview />}
            {subTab === "umbrella"   && <HSUmbrella />}
            {subTab === "curricula"  && <HSCurricula />}
            {subTab === "lessons"    && <HSLessons />}
            {subTab === "attendance" && <HSAttendance />}
            {subTab === "activities" && <HSActivities />}
          </React.Fragment>
        )}
      </div>
    );
  }

  // Children stay mounted (display:none when closed) so inputs never lose focus.
    // ── Google Calendar Modal ────────────────────────────────────────────────────
  _hfRenders.GoogleCalendarModal = function GoogleCalendarModal({onClose}) {
    const isConnected = connectedCals.includes("google") && googleCalToken;
    const [syncing, setSyncing2] = useState(false);
    const [error, setError] = useState(googleCalError||"");
    const [lastSynced, setLastSynced] = useState(null);

    // Google OAuth using Google Identity Services (GIS) — works without redirect URI issues
    function connectGoogle() {
      setError("");
      const GOOGLE_CLIENT_ID = "1071398827259-kt8fuuclq8riohieaeu4r58sk93484u9.apps.googleusercontent.com";

      // Load Google Identity Services script if not already loaded
      function initTokenClient() {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly",
          callback: (response) => {
            if (response.error) { setError("Google sign-in failed: " + response.error); return; }
            const token = response.access_token;
            setGoogleCalToken(token);
            setConnectedCals(p => [...p.filter(x=>x!=="google"), "google"]);
            fetchGoogleEvents(token);
          },
        });
        client.requestAccessToken();
      }

      if (window.google?.accounts?.oauth2) {
        initTokenClient();
      } else {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.onload = initTokenClient;
        script.onerror = () => setError("Failed to load Google sign-in. Check your connection.");
        document.head.appendChild(script);
      }
    }

    async function fetchGoogleEvents(token) {
      setSyncing2(true); setError("");
      try {
        const now = new Date();
        const timeMin = encodeURIComponent(new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
        const timeMax = encodeURIComponent(new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString());

        // Step 1: Get all calendars in the account
        const calListRes = await fetch(
          "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (calListRes.status === 401) {
          setGoogleCalToken(null);
          setConnectedCals(p=>p.filter(x=>x!=="google"));
          setError("Session expired. Please reconnect Google Calendar.");
          setSyncing2(false); return;
        }
        const calListData = await calListRes.json();
        if (calListData.error) { setError(calListData.error.message||"Google Calendar error"); setSyncing2(false); return; }

        const calendars = calListData.items || [];

        // Step 2: Fetch events from every calendar in parallel
        const calColors = {
          "cocoa": "#c4a882", "flamingo": "#b87265", "grape": "#8878b8",
          "graphite": "#607890", "lavender": "#8878b8", "peacock": "#6A9BB5",
          "sage": "#7a9e8e", "tangerine": "#e8a838", "tomato": "#b87265",
          "banana": "#e8c838", "basil": "#3a7a60", "blueberry": "#2e6ea0"
        };
        const fallbackColors = ["#6A9BB5","#7a9e8e","#c4a882","#b87265","#8878b8","#e8a838","#7ab8a8","#3a7a60"];

        const allEventPromises = calendars.map(async (cal, calIdx) => {
          try {
            const calId = encodeURIComponent(cal.id);
            const res = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) return [];
            const data = await res.json();
            if (data.error) return [];

            // Use the calendar's color, or fall back to rotating colors
            const calColor = calColors[cal.colorId] || cal.backgroundColor || fallbackColors[calIdx % fallbackColors.length];

            return (data.items || []).map(ev => {
              const start = ev.start?.dateTime || ev.start?.date || "";
              const dateStr = start.slice(0, 10);
              const timeStr = start.length > 10 ? start.slice(11, 16) : "";
              // Use event's own color if set, otherwise use calendar color
              const evColor = ev.colorId ? (calColors[ev.colorId] || calColor) : calColor;
              return {
                id: "gcal_" + ev.id,
                title: ev.summary || "(No title)",
                date: dateStr,
                time: timeStr,
                color: evColor,
                colorLabel: cal.summary || "Google",
                note: ev.description || "",
                fromGoogle: true,
              };
            });
          } catch { return []; }
        });

        const allEventsNested = await Promise.all(allEventPromises);
        const allEvents = allEventsNested.flat();

        // Sanitize events — ensure all fields are safe strings to prevent render crashes
        const safeEvents = allEvents.map(ev => ({
          ...ev,
          id: String(ev.id || "gcal_" + Math.random().toString(36).slice(2)),
          title: String(ev.title || "(No title)").slice(0, 200),
          date: String(ev.date || ""),
          time: String(ev.time || ""),
          color: String(ev.color || "#6A9BB5"),
          colorLabel: String(ev.colorLabel || "Google"),
          note: String(ev.note || "").slice(0, 500),
          fromGoogle: true,
        }));

        // Merge: keep manual events, replace all Google-sourced ones
        setCalEvents(prev => [
          ...prev.filter(e => !e.fromGoogle),
          ...safeEvents
        ]);
        setLastSynced(new Date().toLocaleTimeString());
        setLastSync(new Date().toLocaleTimeString());
        setGoogleCalError("");
      } catch(e) {
        setError("Couldn't fetch events: " + (e.message || "Unknown error"));
      }
      setSyncing2(false);
    }

    async function resync() {
      if (googleCalToken) await fetchGoogleEvents(googleCalToken);
    }

    function disconnect() {
      setGoogleCalToken(null);
      setConnectedCals(p=>p.filter(x=>x!=="google"));
      setCalEvents(prev=>prev.filter(e=>!e.fromGoogle));
    }

    return (
      <ModalBox title="Connect Google Calendar" onClose={onClose} wide>
        {/* Google */}
        <div style={{background:isConnected?T.sage+"12":T.bgAlt,border:`1.5px solid ${isConnected?T.sage:T.border}`,borderRadius:"1rem",padding:"1rem 1.1rem",marginBottom:"1rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.85rem"}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:"#4285F422",border:"2px solid #4285F444",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Icon name="google" size={22}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:T.textDark,fontSize:"0.9rem"}}>Google Calendar</div>
              <div style={{color:T.textSoft,fontSize:"0.76rem",marginTop:"0.12rem"}}>
                {isConnected ? "✓ Connected — events synced to Anchor & Flow" : "Connect to pull your real events into the app"}
              </div>
              {lastSynced&&<div style={{color:T.sage,fontSize:"0.72rem",fontWeight:700,marginTop:"0.1rem"}}>Last synced: {lastSynced}</div>}
            </div>
            {isConnected
              ? <div style={{display:"flex",gap:"0.4rem"}}>
                  <button onClick={resync} disabled={syncing} style={btnS({fontSize:"0.76rem",padding:"0.35rem 0.75rem",display:"flex",alignItems:"center",gap:"0.3rem"})}>
                    {syncing?"Syncing…":"↻ Sync"}
                  </button>
                  <button onClick={disconnect} style={btnS({fontSize:"0.76rem",padding:"0.35rem 0.75rem",color:T.rose,borderColor:T.rose+"55"})}>
                    Disconnect
                  </button>
                </div>
              : <button onClick={connectGoogle} style={btnP("#4285F4",{fontSize:"0.78rem",padding:"0.4rem 0.9rem"})}>
                  Connect
                </button>
            }
          </div>
        </div>

        {error&&<div style={{background:T.rosePale,border:"1.5px solid "+T.rose+"50",borderRadius:"0.75rem",padding:"0.65rem 0.9rem",marginBottom:"0.85rem",fontSize:"0.82rem",color:T.rose,fontWeight:600}}>{error}</div>}

        {/* Other calendars */}
        <div style={{borderTop:"1px solid "+T.borderSoft,paddingTop:"0.85rem",marginTop:"0.2rem"}}>
          <div style={{fontSize:"0.7rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.6rem"}}>Other calendars</div>
          {[{id:"apple",label:"Apple Calendar",color:"#ff3b30",icon:"🍎",note:"Export .ics from Apple Calendar and import below"},
            {id:"outlook",label:"Outlook",color:"#0078d4",icon:"Ο",note:"Export .ics from Outlook and import below"}].map(cs=>{
            const connected=connectedCals.includes(cs.id);
            return (
              <div key={cs.id} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.7rem 0",borderBottom:"1px solid "+T.borderSoft}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:cs.color+"22",border:"2px solid "+cs.color+"44",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"0.95rem"}}>{cs.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,color:T.textDark,fontSize:"0.85rem"}}>{cs.label}</div>
                  <div style={{color:T.textSoft,fontSize:"0.72rem"}}>{cs.note}</div>
                </div>
                <button onClick={()=>setConnectedCals(p=>connected?p.filter(x=>x!==cs.id):[...p,cs.id])}
                  style={connected?btnS({fontSize:"0.74rem",padding:"0.3rem 0.7rem",color:T.rose}):btnP(cs.color,{fontSize:"0.74rem",padding:"0.3rem 0.7rem"})}>
                  {connected?"Remove":"Mark connected"}
                </button>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:"1rem"}}>
          <button onClick={onClose} style={btnP(T.blue)}>Done</button>
        </div>
      </ModalBox>
    );
  }

  // ── Auth Modal ──────────────────────────────────────────────────────────────
  _hfRenders.AuthModal = function AuthModal({onClose}) {
    const [mode, setMode] = useState("signin"); // default to signin
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [rawDebug, setRawDebug] = useState(""); // show exact Supabase error

    // Clear fields when switching modes to prevent autofill bleed
    function switchMode(newMode) {
      setMode(newMode);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setError("");
      setRawDebug("");
      setConfirmed(false);
    }

    async function handleReset() {
      const trimEmail = email.trim();
      if (!trimEmail) { setError("Please enter your email address."); return; }
      setLoading(true); setError("");
      try {
        await sbFetch("/auth/v1/recover", {
          method: "POST",
          body: JSON.stringify({
            email: trimEmail,
            redirect_to: "https://anchor-and-flow.vercel.app"
          })
        });
        setError("");
        setConfirmed(true);
      } catch(e) {
        setError("Couldn't send reset email. Please try again.");
      }
      setLoading(false);
    }

    async function handleSubmit() {
      if (mode === "reset") { handleReset(); return; }
      const trimEmail = email.trim();
      const trimPass = password;
      if (!trimEmail || !trimPass) { setError("Email and password are required."); return; }
      if (mode==="signup" && trimPass.length < 6) { setError("Password must be at least 6 characters."); return; }
      setLoading(true); setError(""); setRawDebug("");
      const result = mode==="signup"
        ? await signUp(trimEmail, trimPass, displayName.trim())
        : await signIn(trimEmail, trimPass);

      if (result && result.ok && result.needsConfirmation) {
        setLoading(false);
        setConfirmed(true);
        return;
      }
      if (result && !result.ok) {
        setLoading(false);
        setError(result.error || "Something went wrong. Please try again.");
        if (result.raw) setRawDebug(result.raw);
        return;
      }
    }

    if (confirmed) {
      return (
        <ModalBox title="Check your email" onClose={onClose}>
          <div style={{textAlign:"center",padding:"1rem 0"}}>
            <div style={{fontSize:"3rem",marginBottom:"0.75rem"}}>📧</div>
            <p style={{color:T.textDark,fontWeight:700,fontSize:"1rem",marginBottom:"0.5rem"}}>
              {mode==="reset" ? "Password reset email sent!" : "Confirmation email sent!"}
            </p>
            <p style={{color:T.textSoft,fontSize:"0.84rem",lineHeight:1.65,marginBottom:"1.25rem"}}>
              {mode==="reset"
                ? <>We sent a password reset link to <strong>{email}</strong>.<br/><br/>
                   1. Check your inbox (and spam folder)<br/>
                   2. Tap the link in the email<br/>
                   3. It will open the app where you can set a new password<br/><br/>
                   <span style={{fontSize:"0.78rem",color:T.textSoft}}>If the link doesn't open the app, copy it and paste into Safari/Chrome.</span></>
                : <>We sent a link to <strong>{email}</strong>. Click it then come back to sign in.</>
              }
            </p>
            <button onClick={()=>switchMode("signin")}
              style={btnP(T.blue,{width:"100%",padding:"0.8rem",fontSize:"0.9rem"})}>
              Back to Sign In
            </button>
          </div>
        </ModalBox>
      );
    }

    return (
      <ModalBox title={mode==="signin"?"Sign In":mode==="reset"?"Reset Password":"Create Account"} onClose={onClose}>
        <div style={{marginBottom:"0.75rem",color:T.textSoft,fontSize:"0.82rem",lineHeight:1.6}}>
          {mode==="signin"
            ? "Welcome back — sign in to access your household."
            : mode==="reset"
            ? "Enter your email and we'll send a password reset link."
            : "Create your personal login. Your partner needs their own account."}
        </div>
        <form onSubmit={e=>{e.preventDefault();handleSubmit();}}>
        {/* Hidden fake fields to defeat browser autofill */}
        <input type="text" style={{display:"none"}} autoComplete="username"/>
        <input type="password" style={{display:"none"}} autoComplete="current-password"/>
        {mode==="signup"&&(
          <div style={{marginBottom:"0.75rem"}}>
            <label style={lbl}>Your name</label>
            <input
              value={displayName}
              onChange={e=>setDisplayName(e.target.value)}
              placeholder="e.g. Sarah"
              autoComplete="off"
              style={inp()}
            />
          </div>
        )}
        <div style={{marginBottom:"0.75rem"}}>
          <label style={lbl}>Email address</label>
          <input
            type="text"
            inputMode="email"
            value={email}
            onChange={e=>{setEmail(e.target.value);setError("");}}
            placeholder="your@email.com"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            style={inp()}
          />
        </div>
        {mode !== "reset" && (
        <div style={{marginBottom:"1rem"}}>
          <label style={lbl}>Password {mode==="signup"&&<span style={{fontWeight:400,textTransform:"none",letterSpacing:0,fontSize:"0.68rem"}}> — min. 6 characters</span>}</label>
          <input
            type="password"
            value={password}
            onChange={e=>{setPassword(e.target.value);setError("");}}
            onKeyDown={e=>{if(e.key==="Enter")handleSubmit();}}
            placeholder="••••••••"
            autoComplete="new-password"
            style={inp()}
          />
        </div>
        )}
        {error&&(
          <div style={{background:T.rosePale,border:"1.5px solid "+T.rose+"50",borderRadius:"0.65rem",padding:"0.7rem 0.85rem",marginBottom:"0.85rem",fontSize:"0.83rem",color:T.rose,fontWeight:600,lineHeight:1.5}}>
            {error}
            {rawDebug&&<div style={{marginTop:"0.35rem",fontSize:"0.7rem",color:T.textSoft,fontWeight:400,wordBreak:"break-all",fontFamily:"monospace"}}>{rawDebug}</div>}
            {(error.includes("already has an account")||error.includes("Sign In"))&&(
              <button type="button" onClick={()=>switchMode("signin")} style={{display:"block",marginTop:"0.4rem",background:"none",border:"none",color:T.blue,cursor:"pointer",fontSize:"0.8rem",fontFamily:"inherit",fontWeight:700,padding:0,textDecoration:"underline"}}>
                Switch to Sign In →
              </button>
            )}
          </div>
        )}
        <button type="submit" disabled={loading} style={btnP("linear-gradient(135deg,"+T.blue+","+T.blueDark+")",{width:"100%",padding:"0.85rem",fontSize:"0.95rem",marginBottom:"0.75rem",opacity:loading?0.7:1,cursor:loading?"wait":"pointer"})}>
          {loading ? (mode==="reset"?"Sending…":mode==="signin"?"Signing in…":"Creating account…") : mode==="reset" ? "Send Reset Email" : mode==="signin" ? "Sign In" : "Create Account"}
        </button>
        </form>
        <div style={{textAlign:"center",display:"flex",flexDirection:"column",gap:"0.5rem"}}>
          <button onClick={()=>switchMode(mode==="signin"?"signup":"signin")}
            style={{background:"none",border:"none",color:T.blue,cursor:"pointer",fontSize:"0.82rem",fontFamily:"inherit",fontWeight:600}}>
            {mode==="signin"?"Don't have an account? Sign up →":"Already have an account? Sign in →"}
          </button>
          {mode==="signin"&&(
            <button onClick={()=>switchMode("reset")}
              style={{background:"none",border:"none",color:T.textSoft,cursor:"pointer",fontSize:"0.78rem",fontFamily:"inherit"}}>
              Forgot password?
            </button>
          )}
        </div>
      </ModalBox>
    );
  }

  // ── Household Modal ─────────────────────────────────────────────────────────
  _hfRenders.HouseholdModal = function HouseholdModal({onClose}) {
    const [joinCode, setJoinCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState("");
    const [hhCopied, setHhCopied] = useState(false);
    const [lastSynced, setLastSynced] = useState(null);
    var _ownerId = householdOwnerId || (function(){ try { return JSON.parse(localStorage.getItem("af_householdOwnerId")||"null"); } catch(_e) { return null; } })();
    var isOwner = !!(authUser && authUser.id && householdId && _ownerId && authUser.id === _ownerId);
    var isMember = !!(authUser && authUser.id && householdId && !isOwner);
    function handleLeave() {
      if (!window.confirm("Leave this household? Your data stays on this device — you can join a different household any time.")) return;
      try { localStorage.removeItem("af_householdId"); } catch(_e) {}
      try { localStorage.removeItem("af_householdOwnerId"); } catch(_e) {}
      setHouseholdId(null);
      setHouseholdOwnerId(null);
      onClose();
    }
    async function handleSync() {
      if (!authToken) return;
      setSyncing(true);
      try {
        if (!householdId) {
          const hid = "hh_" + uid();
          setHouseholdId(hid);
          await pushHouseholdData(authToken, hid);
        } else {
          await pushHouseholdData(authToken, householdId);
        }
        setLastSynced(new Date().toLocaleTimeString());
        setSyncStatus("synced");
        setLastSyncTime(new Date().toLocaleTimeString());
      } catch(e) { setError("Sync failed: " + e.message); }
      setSyncing(false);
    }
    async function handleJoin() {
      if (!joinCode.trim()) { setError("Enter the household code from the other device."); return; }
      setLoading(true); setError("");
      const result = await joinHousehold(authToken, joinCode.trim());
      setLoading(false);
      if (!result.ok) setError(result.error || "Couldn't join that household.");
    }
    return (
      <ModalBox title="Family Household Sync" onClose={onClose} wide>
        <div style={{marginBottom:"1.2rem"}}>
          <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.blue,marginBottom:"0.6rem"}}>Your household code</div>
          <div style={{background:T.bluePale,border:"2px solid "+T.blue+"40",borderRadius:"0.9rem",padding:"1rem",display:"flex",alignItems:"center",gap:"0.75rem"}}>
            <div style={{flex:1}}>
              {householdId
                ? <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.textDark,wordBreak:"break-all"}}>{householdId}</div>
                : <div style={{fontSize:"0.85rem",color:T.textSoft,fontStyle:"italic"}}>No household yet — tap Generate to create one.</div>
              }
              <div style={{color:T.textSoft,fontSize:"0.74rem",marginTop:"0.2rem"}}>Share this code with your partner. They'll enter it on their device to join this household.</div>
            </div>
            {householdId
              ? <button onClick={()=>{navigator.clipboard?.writeText(householdId||"");setHhCopied(true);setTimeout(()=>setHhCopied(false),2000);}}
                  style={btnP(hhCopied?T.sage:T.blue,{fontSize:"0.78rem",padding:"0.45rem 0.9rem",flexShrink:0})}>
                  {hhCopied?"✓ Copied!":"Copy"}
                </button>
              : <button onClick={handleSync} disabled={syncing}
                  style={btnP(T.blue,{fontSize:"0.78rem",padding:"0.45rem 0.9rem",flexShrink:0,opacity:syncing?0.7:1})}>
                  {syncing?"Creating…":"Generate"}
                </button>
            }
          </div>
        </div>
        <div style={{borderTop:"1px solid "+T.borderSoft,paddingTop:"1.2rem",marginBottom:"1.2rem"}}>
          <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.sage,marginBottom:"0.6rem"}}>Join a household</div>
          <div style={{color:T.textSoft,fontSize:"0.82rem",lineHeight:1.6,marginBottom:"0.75rem"}}>Have a household code from another device? Enter it here to sync and share all data.</div>
          <div style={{display:"flex",gap:"0.5rem"}}>
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="Paste household code…" style={{...inp({flex:1})}}/>
            <button onClick={handleJoin} disabled={loading} style={btnP(T.sage,{flexShrink:0,opacity:loading?0.7:1})}>
              {loading?"Joining…":"Join"}
            </button>
          </div>
          {error&&<div style={{marginTop:"0.6rem",fontSize:"0.8rem",color:T.rose,fontWeight:600}}>{error}</div>}
        </div>
        <div style={{background:T.sagePale,border:"1.5px solid "+T.sage+"40",borderRadius:"0.85rem",padding:"0.85rem 1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:"0.8rem",color:T.textMid,lineHeight:1.65}}>
            <strong style={{color:T.sageDark}}>How it works:</strong><br/>
            • Both people sign in with their own email + password<br/>
            • One person shares their household code<br/>
            • The other enters it to join — data syncs automatically every 60 seconds<br/>
            • Changes on either device appear on the other within a minute
          </div>
        </div>
        <div style={{display:"flex",gap:"0.5rem",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:"0.75rem",color:syncStatus==="synced"?T.sage:syncStatus==="syncing"?T.sand:T.textFaint,fontWeight:700}}>
            {syncStatus==="synced"&&"✓ Synced "+lastSyncTime}
            {syncStatus==="syncing"&&"⟳ Syncing…"}
            {syncStatus==="error"&&"⚠ Sync error"}
            {syncStatus==="idle"&&"Not synced yet"}
          </div>
          <div style={{display:"flex",gap:"0.4rem"}}>
            <button onClick={handleSync} style={btnS({fontSize:"0.78rem",padding:"0.35rem 0.8rem"})}>Sync now</button>
            <button onClick={onClose} style={btnP(T.blue,{fontSize:"0.78rem",padding:"0.35rem 0.8rem"})}>Done</button>
          </div>
        </div>
        {isOwner&&(
          <div style={{borderTop:"1px solid "+T.borderSoft,paddingTop:"1rem",marginTop:"0.2rem",background:T.bgAlt,borderRadius:"0.85rem",padding:"0.85rem 1rem"}}>
            <div style={{fontSize:"0.68rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.textSoft,marginBottom:"0.4rem"}}>Household ownership</div>
            <div style={{fontSize:"0.8rem",color:T.textMid,lineHeight:1.65}}>
              You created this household. Owners can't leave — removing yourself would disconnect any household members who rely on this shared plan. To transfer ownership or dissolve the household, contact support.
            </div>
          </div>
        )}
        {isMember&&(
          <div style={{borderTop:"1px solid "+T.borderSoft,paddingTop:"1rem",marginTop:"0.2rem"}}>
            <button onClick={handleLeave} style={btnS({fontSize:"0.76rem",padding:"0.35rem 0.8rem",color:T.rose,borderColor:T.rose+"55",width:"100%"})}>Leave household</button>
          </div>
        )}
      </ModalBox>
    );
  }

  // ── Calendar Event Form Modal ────────────────────────────────────────────────
  _hfRenders.CalEventFormModal = function CalEventFormModal(){
    const[f,setF]=useState(calFormInit||{title:"",date:"",time:"",color:"#6A9BB5",colorLabel:"Blue",colorCustom:"",note:""});
    const prevMode=useRef(calFormMode);
    if(prevMode.current!==calFormMode){prevMode.current=calFormMode;if(calFormMode&&calFormInit)setF(calFormInit);}
    if(!calFormMode)return null;
    function handleSave(){
      if(!f.title||!f.date)return;
      const resolvedLabel=calColorLabels[f.color]||f.colorCustom.trim()||f.colorLabel;const ev={...f,colorLabel:resolvedLabel};
      if(calFormMode==="add")setCalEvents(p=>[...p,{id:uid(),...ev}]);
      else setCalEvents(p=>p.map(e=>e.id===calFormId?{...ev,id:calFormId}:e));
      // Set reminder if provided
      if(f.remindDate&&f.remindTime) {
        const eid = calFormMode==="add" ? (calEvents.length+"_new") : calFormId;
        addNotification(eid, f.title, f.remindDate, f.remindTime, f.note||"");
      }
      closeCalForm();setSelectedDay(null);
    }
    return(
      <ModalBox title={calFormMode==="add"?"Add Event":"Edit Event"} onClose={closeCalForm}>
        <div style={{marginBottom:"0.9rem"}}><label style={lbl}>Event Title</label><input value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} placeholder="e.g. Doctor appointment" style={inp()} autoFocus/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",marginBottom:"0.9rem"}}>
          <div><label style={lbl}>Date</label><input type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))} style={inp()}/></div>
          <div><label style={lbl}>Time (optional)</label><input type="time" value={f.time} onChange={e=>setF(p=>({...p,time:e.target.value}))} style={inp()}/></div>
        </div>
        <div style={{marginBottom:"0.9rem"}}><label style={lbl}>Note (optional)</label><textarea value={f.note||""} onChange={e=>setF(p=>({...p,note:e.target.value}))} placeholder="Any details, reminders…" style={{...inp({height:68,resize:"none"})}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",marginBottom:"0.9rem"}}>
          <div>
            <label style={lbl}>For</label>
            <select value={f.forPerson||""} onChange={function(ev){setF(function(p){return Object.assign({},p,{forPerson:ev.target.value||null});});}} style={inp({padding:"0.4rem 0.5rem"})}>
              <option value="">Anyone</option>
              {["Madi","Rylan","Kinzlee","Briar","family"].map(function(nm){return <option key={nm} value={nm}>{nm==="family"?"Family":nm}</option>;})}
            </select>
          </div>
          <div>
            <label style={lbl}>Responsible</label>
            <div style={{display:"flex",gap:"0.35rem",marginTop:"0.25rem"}}>
              {[["","—"],["L","Lindsey"],["T","Twy"]].map(function(item){
                var _rv=item[0],_rl=item[1];
                var _ra=_rv===""?!f.responsibleParent:f.responsibleParent===_rv;
                return (
                  <button key={_rv} onClick={function(){setF(function(p){return Object.assign({},p,{responsibleParent:_rv||null});});}} style={{flex:1,padding:"0.35rem 0.3rem",borderRadius:"0.45rem",border:"1.5px solid "+(_ra?T.blue:T.border),background:_ra?T.bluePale:"transparent",color:_ra?T.blue:T.textMid,fontSize:"0.72rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    {_rl}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {/* Inline reminder */}
        <div style={{marginBottom:"0.9rem",background:T.bgAlt,border:"1px solid "+T.border,borderRadius:"0.8rem",padding:"0.75rem 0.9rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.55rem"}}>
            <Icon name="bell" size={13} color={T.sand}/>
            <span style={{fontSize:"0.7rem",fontWeight:800,color:T.sandDark,textTransform:"uppercase",letterSpacing:"0.06em"}}>Set Reminder (optional)</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.45rem"}}>
            <input type="date" value={f.remindDate||""} onChange={e=>setF(p=>({...p,remindDate:e.target.value}))} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
            <input type="time" value={f.remindTime||""} onChange={e=>setF(p=>({...p,remindTime:e.target.value}))} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
          </div>
        </div>
        <div style={{marginBottom:"0.9rem"}}>
          <label style={lbl}>Colour</label>
          <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginBottom:"0.65rem"}}>
            {CAL_COLOR_OPTIONS.map(({color,label})=>(
              <button key={color} onClick={()=>setF(p=>({...p,color,colorLabel:label,colorCustom:""}))} title={label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.28rem",background:"none",border:"none",cursor:"pointer",padding:"0.2rem"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:color,border:f.color===color?`3px solid ${T.textDark}`:`3px solid transparent`,transition:"border 0.15s"}}/>
                <span style={{fontSize:"0.6rem",fontWeight:700,color:f.color===color?T.textDark:T.textSoft}}>{calColorLabels[color]||label}</span>
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:"0.5rem",alignItems:"center",marginTop:"0.35rem"}}>
            <input type="color" value={f.color||"#6A9BB5"} onChange={e=>setF(p=>({...p,color:e.target.value,colorLabel:"Custom",colorCustom:""}))} style={{width:36,height:36,border:"none",borderRadius:"0.5rem",cursor:"pointer",padding:2,background:"none"}}/>
            <span style={{fontSize:"0.72rem",color:T.textFaint}}>Pick any colour</span>
            <input value={f.color||""} onChange={e=>setF(p=>({...p,color:e.target.value,colorLabel:"Custom",colorCustom:""}))} placeholder="#hex" style={{...inp({flex:1,fontFamily:"monospace",fontSize:"0.8rem"})}}/>
          </div>
        </div>
        <div style={{marginBottom:"0.9rem"}}>
          <label style={lbl}>Repeat</label>
          <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginBottom:"0.5rem"}}>
            {[{v:"",label:"None"},{v:"weekly",label:"Weekly"},{v:"biweekly",label:"Every 2 wks"},{v:"monthly",label:"Monthly"},{v:"yearly",label:"Yearly"},{v:"dates",label:"Specific dates"}].map(o=>(
              <button key={o.v} onClick={()=>setF(p=>({...p,repeat:o.v,repeatDates:o.v==="dates"?(p.repeatDates||[]):[]}))} style={{padding:"0.25rem 0.7rem",borderRadius:"50px",border:"1.5px solid "+(f.repeat===o.v?T.blue:T.border),background:f.repeat===o.v?T.bluePale:"transparent",color:f.repeat===o.v?T.blue:T.textMid,fontSize:"0.72rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                {o.label}
              </button>
            ))}
          </div>
          {f.repeat==="dates"&&(
            <div style={{background:T.bgAlt,borderRadius:"0.7rem",padding:"0.6rem 0.75rem",border:`1px solid ${T.border}`}}>
              <div style={{fontSize:"0.72rem",color:T.textMid,fontWeight:700,marginBottom:"0.5rem"}}>Which days of the month?</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"0.3rem"}}>
                {Array.from({length:31},(_,i)=>i+1).map(function(n){
                  var active=(f.repeatDates||[]).includes(n);
                  return(
                    <button key={n} onClick={function(){setF(function(p){var rDates=p.repeatDates||[];return Object.assign({},p,{repeatDates:active?rDates.filter(function(x){return x!==n;}):[...rDates,n].sort(function(a,b){return a-b;})});});}} style={{width:32,height:32,borderRadius:"0.4rem",border:"1.5px solid "+(active?T.blue:T.border),background:active?T.blue:"transparent",color:active?"#fff":T.textMid,fontSize:"0.75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      {n}
                    </button>
                  );
                })}
              </div>
              {(f.repeatDates||[]).length>0&&<div style={{fontSize:"0.7rem",color:T.textSoft,marginTop:"0.5rem"}}>Repeats on the {(f.repeatDates||[]).map(function(n){var s=n===1?"st":n===2?"nd":n===3?"rd":"th";return n+s;}).join(", ")} of each month</div>}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
          <button onClick={closeCalForm} style={btnS()}>Cancel</button>
          <button onClick={handleSave} style={btnP(T.blue)}>{calFormMode==="add"?"Add Event":"Save Changes"}</button>
        </div>
      </ModalBox>
    );
  }

  // ── MAIN RENDER ────────────────────────────────────────────────────────────

  // ── Set New Password Modal (shown after clicking reset email link) ────────
  _hfRenders.SetPasswordModal = function SetPasswordModal() {
    const [newPass, setNewPass] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    async function handleSetPassword() {
      if (!newPass || newPass.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (newPass !== confirm) { setError("Passwords don't match."); return; }
      setLoading(true); setError("");
      try {
        await sbFetch("/auth/v1/user", {
          method: "PUT",
          _token: resetToken,
          body: JSON.stringify({ password: newPass })
        });
        setDone(true);
        // Clear the hash from URL
        window.history.replaceState(null, "", window.location.pathname);
      } catch(e) {
        setError("Couldn't set password. The reset link may have expired — request a new one.");
      }
      setLoading(false);
    }

    return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(8px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"env(safe-area-inset-top,1rem) 1rem env(safe-area-inset-bottom,1rem)",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:"1.4rem",padding:"1.8rem",width:"100%",maxWidth:420,boxShadow:`0 32px 100px ${T.cardShadow}`}}>
          {done ? (
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"3rem",marginBottom:"0.75rem"}}>✅</div>
              <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.5rem"}}>Password updated!</h3>
              <p style={{color:T.textSoft,fontSize:"0.84rem",marginBottom:"1.25rem"}}>Your new password is set. You can now sign in.</p>
              <button type="button" onClick={()=>{ setShowSetPassword(false); setShowAuthModal(true); }}
                style={{...btnP(T.blue,{width:"100%",padding:"0.8rem",fontSize:"0.9rem"})}}>
                Sign In Now
              </button>
            </div>
          ) : (
            <form onSubmit={function(e){e.preventDefault();handleSetPassword();}}>
              <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>Set New Password</h3>
              <p style={{color:T.textSoft,fontSize:"0.82rem",marginBottom:"1.1rem"}}>Choose a new password for your account.</p>
              <div style={{marginBottom:"0.75rem"}}>
                <label style={lbl}>New password</label>
                <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)}
                  placeholder="Min. 6 characters" style={inp()} autoFocus/>
              </div>
              <div style={{marginBottom:"1rem"}}>
                <label style={lbl}>Confirm password</label>
                <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)}
                  placeholder="Type it again" style={inp()}/>
              </div>
              {error&&<div style={{background:T.rosePale,border:`1.5px solid ${T.rose}50`,borderRadius:"0.65rem",padding:"0.7rem 0.85rem",marginBottom:"0.85rem",fontSize:"0.83rem",color:T.rose,fontWeight:600}}>{error}</div>}
              <button type="submit" disabled={loading}
                style={{...btnP(T.blue,{width:"100%",padding:"0.85rem",fontSize:"0.95rem",opacity:loading?0.7:1})}}>
                {loading ? "Saving…" : "Set Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const primaryVisible=TABS.filter(t=>PRIMARY_TABS.includes(t.id)&&(!sections||sections[t.id]!==false));
  const moreVisible=TABS.filter(t=>MORE_TABS.includes(t.id)&&(t.id==="settings"||!sections||sections[t.id]!==false));
  const activeInMore=!PRIMARY_TABS.includes(tab)&&tab!=="anchor";

  return(
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${T.bg};font-family:'DM Sans',sans-serif;color:${T.textDark};transition:background 0.3s,color 0.3s}
        input,select,textarea{font-family:'DM Sans',sans-serif!important;color:${T.textDark}!important}
        input[type="date"],input[type="time"]{color-scheme:${themeName==="night"?"dark":"light"}}
        input:focus,select:focus,textarea:focus{border-color:${T.blue}!important;box-shadow:0 0 0 3px ${T.blue}22!important;outline:none}
        select option{background:${T.surface};color:${T.textDark}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:${T.bgAlt}}::-webkit-scrollbar-thumb{background:${T.blueLight};border-radius:4px}
        @keyframes fu{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}.fu{animation:fu 0.22s ease both}
        @keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1.1)}}
        @keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        [draggable]:active{cursor:grabbing!important}
      `}</style>

      {/* ── SW update banner — shown when a new version is waiting for SKIP_WAITING ── */}
      {staleBanner&&(
        <div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:10000,maxWidth:360,width:"calc(100% - 2rem)",background:T.navy,color:"#faf8f4",borderRadius:"1rem",padding:"0.85rem 1.1rem",boxShadow:"0 6px 28px rgba(0,0,0,0.28)",display:"flex",gap:"0.75rem",alignItems:"center",animation:"slideDown 0.3s ease"}}>
          <span style={{fontSize:"1.2rem",flexShrink:0}}>🔄</span>
          <div style={{flex:1,fontSize:"0.82rem",fontWeight:500,fontFamily:"'DM Sans',sans-serif"}}>App update ready</div>
          <button onClick={function(){
            var didReload = false;
            function forceReload(){ if(!didReload){ didReload = true; try{ window.location.reload(); }catch(e){} } }
            try {
              var reg = swRegRef.current;
              if (reg && reg.waiting) {
                reg.waiting.postMessage({type:"SKIP_WAITING"});
                setTimeout(forceReload, 1500); // controllerchange should reload; fall back if it doesn't
              } else if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
                // ref went stale — re-query for a waiting worker
                navigator.serviceWorker.getRegistration().then(function(r){
                  if (r && r.waiting) { r.waiting.postMessage({type:"SKIP_WAITING"}); setTimeout(forceReload, 1500); }
                  else { forceReload(); }
                }).catch(forceReload);
              } else {
                forceReload();
              }
            } catch(e) { forceReload(); }
          }} style={{background:"rgba(200,169,122,0.25)",border:"1px solid rgba(200,169,122,0.5)",borderRadius:"0.5rem",color:"#c8a97a",fontSize:"0.75rem",fontWeight:700,padding:"0.3rem 0.7rem",cursor:"pointer",fontFamily:"inherit",flexShrink:0,minHeight:36,minWidth:36}}>Refresh Now</button>
          <span onClick={function(){setStaleBanner(false);}} style={{fontSize:"0.75rem",opacity:0.5,cursor:"pointer",flexShrink:0,padding:"0.25rem"}}>✕</span>
        </div>
      )}

      {/* ── In-app notification banner (iOS + fallback) ── */}
      {inAppBanner&&(
        <div onClick={()=>setInAppBanner(null)} style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:9999,maxWidth:360,width:"calc(100% - 2rem)",background:T.navy,color:"#faf8f4",borderRadius:"1rem",padding:"0.85rem 1.1rem",boxShadow:"0 6px 28px rgba(0,0,0,0.28)",cursor:"pointer",display:"flex",gap:"0.75rem",alignItems:"flex-start",animation:"slideDown 0.3s ease"}}>
          <span style={{fontSize:"1.3rem",flexShrink:0}}>⚓️</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:"0.88rem",marginBottom:"0.2rem",fontFamily:"'Cormorant Garamond',serif"}}>{inAppBanner.title}</div>
            <div style={{fontSize:"0.79rem",opacity:0.88,lineHeight:1.4}}>{inAppBanner.body}</div>
          </div>
          <span style={{fontSize:"0.75rem",opacity:0.6,flexShrink:0,marginTop:2}}>✕</span>
        </div>
      )}
      <div style={{minHeight:"100dvh",background:(__ROOM ? "linear-gradient("+__ROOM.tint+","+__ROOM.tint+"), " : "")+T.bg,paddingBottom:"5.5rem",paddingTop:"env(safe-area-inset-top,0px)",transition:"background 0.3s"}}>
        <div style={{background:T.topBg,borderBottom:"2px solid "+(__ROOM ? __ROOM.accent+"88" : T.border),padding:"0.75rem 1.1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,boxShadow:`0 2px 14px ${T.cardShadow}`}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.65rem"}}>
            <AnchorLogo size={36} color={T.blue}/>
            <div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.25rem",fontWeight:700,color:T.textDark,letterSpacing:"0.07em",textTransform:"uppercase",lineHeight:1.1}}>Anchor &amp; Flow</div>
              <div style={{color:T.textMid,fontSize:"0.75rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",letterSpacing:"0.01em",fontWeight:500}}>A steadier home, in every season</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"0.45rem",flexWrap:"wrap",justifyContent:"flex-end"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.35rem",background:fm.bg,border:`2px solid ${fm.color}60`,borderRadius:"2rem",padding:"0.27rem 0.78rem",cursor:"pointer"}} onClick={()=>setModal("flowPicker")}>
                <span style={{fontSize:"0.82rem"}}>{fm.emoji}</span>
                <span style={{color:fm.color,fontSize:"0.73rem",fontWeight:800}}>{flowMode}</span>
              </div>
              <button onClick={()=>setChatOpen(o=>!o)} title="Ask Compass" style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${T.blue},${T.blueDark})`,border:`2px solid ${T.blueLight}`,boxShadow:`0 2px 12px ${T.blue}50`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <CompassIcon size={20} color="#fff"/>
              </button>
            </div>
            {false&&(
              <div style={{alignItems:"center",gap:"0.3rem",background:syncStatus==="synced"?T.sagePale:syncStatus==="syncing"?T.sandPale:T.bgAlt,border:`1.5px solid ${syncStatus==="synced"?T.sage+"50":syncStatus==="syncing"?T.sand+"50":T.borderSoft}`,borderRadius:"2rem",padding:"0.22rem 0.65rem",cursor:"pointer",display:"none"}} onClick={()=>setShowHouseholdModal(true)}>
                <span style={{fontSize:"0.65rem"}}>{syncStatus==="synced"?"✓":syncStatus==="syncing"?"⟳":"⚠"}</span>
                <span style={{fontSize:"0.65rem",fontWeight:700,color:syncStatus==="synced"?T.sage:syncStatus==="syncing"?T.sand:T.textSoft}}>Sync</span>
              </div>
            )}
          </div>
        </div>

        <div style={{maxWidth:(tab==="flowhome"?1100:700),margin:"0 auto",padding:"1.1rem 0.9rem 0.5rem"}}>
          {/* Only render tabs that have been visited — avoids mounting all 9 on load */}
          {["anchor","flowhome","calendar","weekly","meals","shop","tidepool","cove","home","brain","school","settings","ai"].map(t=>{
            if(!visitedTabs.current.has(t)) return null;
            return (
              <div key={t} onClick={e=>e.stopPropagation()} className={tab===t && !seenTabs.current.has(t)?"fu":""} style={{display:tab===t?"block":"none"}}>
                {t==="anchor"   && <AnchorTab/>}
                {t==="flowhome" && <FlowHome/>}
                {t==="calendar" && <SectionErrorBoundary label="Calendar"><CalendarTab/></SectionErrorBoundary>}
                {t==="weekly"   && <WeeklyTab/>}
                {t==="meals"    && <MealsTab/>}
                {t==="shop"     && <ShoppingTab/>}
                {t==="tidepool" && <TidePoolTab/>}
                {t==="cove"     && <CoveTab/>}
                {t==="home"     && <HomeTab/>}
                {t==="brain"    && <SectionErrorBoundary label="Exhale"><ExhaleSection
                initialItems={exhaleItems.length > 0 ? exhaleItems : brainItems}
                initialLabels={exhaleLabels}
                householdId={householdId}
                onSave={function(items, labels) {
                  setExhaleItems(items);
                  setExhaleLabels(labels);
                }}
              /></SectionErrorBoundary>}
                {t==="school"   && <SchoolTab/>}
                {t==="career"   && <CareerTab/>}
                {t==="settings" && <SettingsTab
                  people={people} setPeople={setPeople}
                  familyProfile={familyProfile} setFamilyProfile={setFamilyProfile}
                  flowMode={flowMode} setFlowMode={setFlowMode}
                  flowGreetingTone={flowGreetingTone} setFlowGreetingTone={setFlowGreetingTone}
                  mealCount={mealCount} setMealCount={setMealCount}
                  stores={stores} setStores={setStores}
                  rhythm={rhythm} setRhythm={setRhythm}
                  brainCats={brainCats} setBrainCats={setBrainCats}
                  coveData={coveData} setCoveData={setCoveData}
                  authUser={authUser} setAuthUser={setAuthUser}
                  preferredName={preferredName} setPreferredName={setPreferredName}
                  notifSettings={notifSettings} setNotifSettings={setNotifSettings}
                  setDailySummaryScheduled={setDailySummaryScheduled}
                  tasks={tasks} meals={meals} calEvents={calEvents}
                  goTab={goTab} notifPermission={notifPermission}
                  requestNotifPermission={requestNotifPermission}
                  scheduleAllDailyNotifications={scheduleAllDailyNotifications}
                  signOut={signOut} showInAppBanner={showInAppBanner}
                  T={T} inp={inp} lbl={lbl} btnP={btnP} btnS={btnS} PC={PC}
                  SecHead={SecHead} ModalBox={ModalBox}
                  themeName={themeName} setThemeNameRaw={setThemeNameRaw}
                  setShowHouseholdModal={setShowHouseholdModal}
                  notifications={notifications} setNotifications={setNotifications}
                  aiMemory={aiMemory} setAiMemory={setAiMemory}
                  setShowAuthModal={setShowAuthModal}
                  syncNow={syncNow} lastSyncTime={lastSyncTime}
                  card={card}
                />}
                {t==="ai" && <RippleTab/>}
              </div>
            );
          })}
        </div>

        {/* More drawer */}
        {moreDrawerOpen&&(
          <>
            <div onClick={()=>setMoreDrawerOpen(false)} style={{position:"fixed",inset:0,zIndex:98,background:"rgba(0,0,0,0.18)"}}/>
            <div style={{position:"fixed",bottom:"4.2rem",left:"50%",transform:"translateX(-50%)",width:"min(400px,calc(100vw - 1.5rem))",background:T.navBg,border:`1.5px solid ${T.border}`,borderRadius:"1.2rem 1.2rem 0.5rem 0.5rem",boxShadow:`0 -4px 28px ${T.cardShadow}`,zIndex:99,padding:"0.6rem 0.5rem 0.4rem"}}>
              <div style={{display:"flex",justifyContent:"center",marginBottom:"0.55rem"}}>
                <div style={{width:36,height:4,borderRadius:2,background:T.border}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:"0.3rem"}}>
                {moreVisible.map(t=>(
                  <button key={t.id} onClick={()=>{goTab(t.id);setMoreDrawerOpen(false);}} style={{background:tab===t.id?T.blue+"18":"transparent",border:`1.5px solid ${tab===t.id?T.blue+"60":T.border}`,borderRadius:"0.9rem",cursor:"pointer",padding:"0.55rem 0.9rem",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",minWidth:64,flex:"1 1 60px",transition:"all 0.14s"}}>
                    <span style={{fontSize:"1.1rem"}}>{t.emoji}</span>
                    <span style={{fontSize:"0.62rem",color:tab===t.id?T.blue:T.textMid,fontWeight:tab===t.id?800:600,letterSpacing:"0.02em",fontFamily:"inherit"}}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Bottom nav bar — Option C */}
        {/* ── Quick Capture FAB ── */}
        <button onClick={()=>setCaptureOpen(true)} style={{position:"fixed",bottom:"4.8rem",right:"1.1rem",width:48,height:48,borderRadius:"50%",background:T.navy,color:"#fff",border:"none",cursor:"pointer",fontSize:"1.3rem",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(0,0,0,0.25)",zIndex:99,fontWeight:300,lineHeight:1}}>⚓</button>

        {/* ── Quick Capture Sheet ── */}
        {captureOpen&&(
          <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
            <div onClick={()=>setCaptureOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)"}}/>
            <div style={{position:"relative",background:T.surface,borderRadius:"1.4rem 1.4rem 0 0",padding:"1.25rem 1.25rem max(1.5rem,env(safe-area-inset-bottom))",boxShadow:"0 -8px 40px rgba(0,0,0,0.18)"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.textDark,marginBottom:"0.75rem"}}>Quick capture</div>
              <input value={captureText} onChange={e=>setCaptureText(e.target.value)} autoFocus placeholder="What's on your mind..." style={{...inp({marginBottom:"0.75rem",fontSize:"1rem"})}}/>
              <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginBottom:"0.85rem"}}>
                {[{id:"tasks",label:"Tasks",emoji:"✅"},{id:"brain",label:"Clear Your Mind",emoji:"💭"},{id:"shopping",label:"Shopping",emoji:"🛒"}].map(d=>(
                  <button key={d.id} onClick={()=>setCaptureDest(d.id)} style={{padding:"0.28rem 0.75rem",borderRadius:"50px",border:"1.5px solid "+(captureDest===d.id?T.blue:T.border),background:captureDest===d.id?T.bluePale:"transparent",color:captureDest===d.id?T.blue:T.textMid,fontSize:"0.75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    {d.emoji} {d.label}
                  </button>
                ))}
              </div>
              <button onClick={function(){
                if(!captureText.trim())return;
                var txt=captureText.trim();
                if(captureDest==="tasks"){setTasks(function(p){return[...p,{id:uid(),text:txt,day:TODAY_NAME,done:false,category:captureCategory||""}];});}
                else if(captureDest==="brain"){setBrainItems(function(p){return[...p,{id:uid(),text:txt,cat:"inbox",done:false}];});}
                else if(captureDest==="shopping"){setShoppingItems(function(p){return[...p,{id:uid(),text:txt,store:"Grocery Store",done:false}];});}
                setCaptureText("");setCaptureOpen(false);
              }} style={btnP(T.navy,{width:"100%",padding:"0.85rem",fontSize:"0.95rem"})}>Add →</button>
            </div>
          </div>
        )}

        <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.navBg,borderTop:`2px solid ${T.border}`,display:"flex",justifyContent:"space-around",padding:"0.5rem 0 max(0.75rem, env(safe-area-inset-bottom))",zIndex:100,boxShadow:`0 -2px 14px ${T.cardShadow}`}}>
          {primaryVisible.map(t=>(
            <button key={t.id} onClick={()=>{goTab(t.id);setMoreDrawerOpen(false);}} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",padding:"0.6rem 0.4rem",minWidth:48,flex:1,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
              <span style={{fontSize:"1.25rem",filter:tab===t.id?"none":"grayscale(0.3)",opacity:tab===t.id?1:0.6,transition:"all 0.15s"}}>{t.emoji}</span>
              <span style={{fontSize:"0.58rem",color:tab===t.id?T.blue:T.textFaint,fontWeight:tab===t.id?800:500,letterSpacing:"0.02em",whiteSpace:"nowrap",transition:"color 0.15s"}}>{t.label}</span>
              {tab===t.id&&<div style={{width:18,height:2.5,borderRadius:2,background:T.blue,marginTop:1}}/>}
            </button>
          ))}
          <button onClick={()=>setMoreDrawerOpen(o=>!o)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",padding:"0.6rem 0.4rem",minWidth:48,flex:1,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
            <div style={{display:"flex",gap:3,alignItems:"center",height:"1.05rem",opacity:moreDrawerOpen||activeInMore?1:0.45,transition:"opacity 0.15s"}}>
              {[0,1,2].map(i=><div key={i} style={{width:4,height:4,borderRadius:"50%",background:moreDrawerOpen||activeInMore?T.blue:T.textMid,transition:"background 0.15s"}}/>)}
            </div>
            <span style={{fontSize:"0.58rem",color:moreDrawerOpen||activeInMore?T.blue:T.textFaint,fontWeight:moreDrawerOpen||activeInMore?800:500,letterSpacing:"0.02em",transition:"color 0.15s"}}>
              {activeInMore&&!moreDrawerOpen?TABS.find(t=>t.id===tab)?.label:"More"}
            </span>
            {activeInMore&&<div style={{width:18,height:2.5,borderRadius:2,background:T.blue,marginTop:1}}/>}
          </button>
        </div>
      </div>

      {/* AI accessible from header button */}
      {chatOpen&&<AIChatPanel onClose={()=>setChatOpen(false)}/>}
      {showEndOfDay&&<SunsetClose onClose={function(){ setShowEndOfDay(false); }} onCloseDay={function(){ setShowEndOfDay(false); var closerName = preferredName || (authUser && authUser.displayName ? authUser.displayName.split(" ")[0] : null); setDayClosed(closerName || true); }}/>}
      {appCelebrate && <Celebration data={appCelebrate} onClose={function(){ setAppCelebrate(null); }} />}
      {showBriefing&&<DailyBriefingModal onClose={()=>setShowBriefing(false)}/>}
      {showSetPassword&&resetToken&&<SetPasswordModal/>
      }
      {shouldShowOnboarding&&<OnboardingWizard onComplete={()=>{setShowOnboardingWizard(false);buildDailyBriefing();}}/>}
      {showAuthModal&&<AuthModal onClose={()=>setShowAuthModal(false)}/>}
      {showWelcomeModal&&session&&(
        <div style={{position:"fixed",inset:0,background:"rgba(26,39,68,0.72)",backdropFilter:"blur(14px)",zIndex:2100,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
          <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1.6rem",padding:"2rem 1.8rem",width:"100%",maxWidth:400,textAlign:"center",boxShadow:"0 40px 120px "+T.cardShadow}}>
            <div style={{fontSize:"2.4rem",marginBottom:"0.6rem"}}>⚓️</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.55rem",fontWeight:700,color:T.textDark,marginBottom:"0.4rem"}}>You found your anchor.</div>
            <div style={{fontSize:"0.85rem",color:T.textSoft,lineHeight:1.75,marginBottom:"1.25rem"}}>
              Welcome to Anchor & Flow — a steadier home, in every season.<br/><br/>
              <span style={{fontWeight:600,color:T.textDark}}>Do this once:</span> head to <strong>Settings</strong> and spend 2 minutes filling in your family profile. The more you tell Compass, the smarter it gets — meal ideas, task suggestions, and daily rhythms all personalise to you.
            </div>
            <div style={{background:"linear-gradient(135deg,"+T.sagePale+","+T.bluePale+")",borderRadius:"0.9rem",padding:"0.75rem 1rem",fontSize:"0.79rem",color:T.textMid,lineHeight:1.75,marginBottom:"1.25rem",textAlign:"left"}}>
              💡 The more you set up and use it, the easier everything becomes — and the more Compass helps you.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
              <button onClick={function(){try{localStorage.setItem("af_welcomeSeen","1");}catch{}setShowWelcomeModal(false);goTab("settings");}} style={{...btnP(T.sage,{fontSize:"0.9rem",padding:"0.75rem",borderRadius:"0.9rem",width:"100%",justifyContent:"center"})}}>Set up now →</button>
              <button onClick={function(){try{localStorage.setItem("af_welcomeSeen","1");}catch{}setShowWelcomeModal(false);}} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:"0.8rem",fontFamily:"inherit",padding:"0.3rem"}}>I'll explore first</button>
            </div>
          </div>
        </div>
      )}
      {showHouseholdModal&&<HouseholdModal onClose={()=>setShowHouseholdModal(false)}/>}
      <CalEventFormModal/>

      {modal==="flowPicker"&&(
        <ModalBox title="How's your day?" onClose={close}>
          <p style={{color:T.textSoft,fontSize:"0.83rem",lineHeight:1.6,marginBottom:"1rem"}}>Set your mode — it adjusts what the app shows you today.</p>
          <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
            {Object.entries(FM).map(([mode,m])=>(
              <button key={mode} onClick={()=>{setFlowMode(mode);close();}} style={{display:"flex",alignItems:"center",gap:"0.85rem",padding:"0.85rem 1rem",background:flowMode===mode?m.bg:T.bgAlt,border:`2px solid ${flowMode===mode?m.color:T.border}`,borderRadius:"1rem",cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"all 0.15s"}}>
                <span style={{fontSize:"1.5rem"}}>{m.emoji}</span>
                <div>
                  <div style={{fontWeight:800,color:flowMode===mode?m.color:T.textDark,fontSize:"0.92rem"}}>{mode}</div>
                  <div style={{color:T.textSoft,fontSize:"0.79rem",marginTop:"0.1rem"}}>{m.desc}</div>
                </div>
                {flowMode===mode&&<div style={{marginLeft:"auto",flexShrink:0}}><Icon name="check" size={16} color={m.color}/></div>}
              </button>
            ))}
          </div>
        </ModalBox>
      )}
      {modal==="share"&&(
        <ModalBox title="Share Today's Briefing" onClose={close} wide>
          <textarea readOnly value={shareText()} style={{...inp({height:240,fontFamily:"monospace",fontSize:"0.77rem",resize:"none",lineHeight:1.72})}}/>
          <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end",marginTop:"0.85rem"}}>
            <button onClick={close} style={btnS()}>Close</button>
            <button onClick={()=>{navigator.clipboard?.writeText(shareText());setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={btnP(copied?T.sage:T.blue,{color:"#fff"})}>{copied?"✓ Copied!":"Copy to Clipboard"}</button>
          </div>
        </ModalBox>
      )}
      {modal==="calSync"&&(
        <GoogleCalendarModal onClose={close}/>
      )}
    </>
  );
}

// ── Shared pointer-based drag hook (touch + mouse) ───────────────────────────
// Stable-ref approach: all mutable state lives in a single ref so listeners
// never go stale and are registered only once per drag gesture.
function usePointerDrag(items, setItems, { dataAttr="data-dragid" } = {}) {
  const [draggingId, setDraggingId] = React.useState(null);
  const [dragOverId, setDragOverId] = React.useState(null);
  // Keep latest items/setItems accessible inside listeners without re-registering
  const latestItems    = useRef(items);
  const latestSetItems = useRef(setItems);
  useEffect(() => { latestItems.current = items; }, [items]);
  useEffect(() => { latestSetItems.current = setItems; }, [setItems]);

  const ds = useRef({ id:null, clone:null, dragOverId:null });

  function pointerDown(e, id) {
    if (e.button === 1 || e.button === 2) return;
    // Clean up any orphaned clone from a previous interrupted drag
    if (ds.current.clone) { try { ds.current.clone.remove(); } catch {} ds.current.clone = null; }
    ds.current.id = id;
    ds.current.dragOverId = null;
    const el = document.querySelector(`[${dataAttr}="${CSS.escape(id)}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const clone = el.cloneNode(true);
      // Strip pointer-events and interactions from clone children
      clone.querySelectorAll("button,input,select,textarea").forEach(c => { c.style.pointerEvents = "none"; });
      clone.setAttribute("data-drag-clone", "1");
      clone.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;` +
        `opacity:0.85;pointer-events:none;z-index:9999;` +
        `box-shadow:0 8px 28px rgba(0,0,0,0.2);border-radius:0.7rem;transition:none;`;
      document.body.appendChild(clone);
      ds.current.clone = clone;
    }
    setDraggingId(id);
    setDragOverId(null);
    e.preventDefault();
  }

  useEffect(() => {
    function onMove(e) {
      if (!ds.current.id) return;
      const clone = ds.current.clone;
      if (clone) {
        clone.style.left = (e.clientX - clone.offsetWidth / 2) + "px";
        clone.style.top  = (e.clientY - 28) + "px";
        clone.style.display = "none";
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (clone) clone.style.display = "";
      const row = el && el.closest(`[${dataAttr}]`);
      const tid = row ? row.getAttribute(dataAttr) : null;
      const next = (tid && tid !== ds.current.id) ? tid : null;
      if (next !== ds.current.dragOverId) {
        ds.current.dragOverId = next;
        setDragOverId(next);
      }
    }
    function cancelDrag() {
      document.querySelectorAll("[data-drag-clone]").forEach(el => { try{el.remove();}catch{} });
      if (ds.current.clone) { try { ds.current.clone.remove(); } catch {} ds.current.clone = null; }
      ds.current.id = null; ds.current.dragOverId = null;
      setDraggingId(null); setDragOverId(null);
    }
    function onUp() {
      if (!ds.current.id) { cancelDrag(); return; }
      const fromId   = ds.current.id;
      const targetId = ds.current.dragOverId;
      cancelDrag();
      if (!targetId || targetId === fromId) return;
      latestSetItems.current(prev => {
        const arr = [...prev];
        const fi = arr.findIndex(x => x.id === fromId);
        const ti = arr.findIndex(x => x.id === targetId);
        if (fi === -1 || ti === -1) return prev;
        const [moved] = arr.splice(fi, 1);
        arr.splice(ti, 0, moved);
        return arr;
      });
    }
    function onVisChange() { cancelDrag(); }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup",   onUp);
    window.addEventListener("pointercancel", cancelDrag);
    document.addEventListener("visibilitychange", onVisChange);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
      window.removeEventListener("pointercancel", cancelDrag);
      document.removeEventListener("visibilitychange", onVisChange);
      cancelDrag();
    };
  // Register once — uses refs for fresh data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataAttr]);

  return { draggingId, dragOverId, pointerDown };
}


function FlowWrapper({ onHome, onSignOut }) {
  const [openGroup, setOpenGroup] = React.useState(function() {
    try { var g = sessionStorage.getItem("af_openGroup"); return g || null; } catch { return null; }
  });
  const [navSel, setNavSel] = React.useState(function() {
    try { var n = sessionStorage.getItem("af_navSel"); return n || "today-pillar"; } catch { return "today-pillar"; }
  });
  const PILLAR_COLORS = {
    "Today":   { accent: "#C7A15A", glow: "rgba(199,161,90,0.35)" },
    "Flow":    { accent: "#8FC4CC", glow: "rgba(110,157,166,0.38)" },
    "Anchor":  { accent: "#D9C7A8", glow: "rgba(201,183,156,0.40)" },
    "Ripples": { accent: "#6FB5BD", glow: "rgba(62,124,132,0.40)" },
  };
  function pillColor(label){ return PILLAR_COLORS[label] || { accent: "#C7A15A", glow: "rgba(199,161,90,0.16)" }; }
  const [, forceUpdate] = React.useReducer(x => x+1, 0);
  const [activeTab, setActiveTabLocal] = React.useState(homeFlowRef.tab || "anchor");
  const _setActiveTab = React.useCallback((t) => {
    setActiveTabLocal(t);
    homeFlowRef.goTab(t);
    forceUpdate();
    window.dispatchEvent(new CustomEvent("af-set-tab", { detail: t }));
  }, []);
  const [sections, setSections] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("af_sections") || "null") || {anchor:true,calendar:true,weekly:true,meals:true,shop:true,home:true,brain:true,school:true} } catch { return {anchor:true,calendar:true,weekly:true,meals:true,shop:true,home:true,brain:true,school:true} }
  })
  React.useEffect(() => {
    const onStorage = (e) => {
      if (e && e.type === "storage" && e.key !== "af_sections") return;
      try { const s = JSON.parse(localStorage.getItem("af_sections") || "null"); if(s) setSections(s); } catch {}
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("af-sections-changed", onStorage)
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("af-sections-changed", onStorage); }
  }, [])
  const [showAnchor, setShowAnchor] = React.useState(function() {
    try { return sessionStorage.getItem("af_showAnchor") === "1"; } catch { return false; }
  });
  const [vaultSection, setVaultSection] = React.useState(function() {
    try { var v = sessionStorage.getItem("af_vaultSection"); return v || "home"; } catch { return "home"; }
  });
  // Persist nav state to sessionStorage so a sync-triggered reload restores the
  // user's exact position (vault section, active group, sidebar highlight).
  // These four mirror the af_activeTab pattern used by HomeFlow for the same reason.
  React.useEffect(function() {
    try { sessionStorage.setItem("af_showAnchor", showAnchor ? "1" : "0"); } catch {}
  }, [showAnchor]);
  React.useEffect(function() {
    try { sessionStorage.setItem("af_vaultSection", vaultSection); } catch {}
  }, [vaultSection]);
  React.useEffect(function() {
    try { sessionStorage.setItem("af_navSel", navSel); } catch {}
  }, [navSel]);
  React.useEffect(function() {
    try { sessionStorage.setItem("af_openGroup", openGroup || ""); } catch {}
  }, [openGroup]);
  const PILLARS = [
    { id: "anchor", label: "Today", emoji: "🧭", kind: "tab" },
    { label: "Flow", emoji: "🌊", kind: "group", items: [
      { id: "calendar", label: "Calendar",      emoji: "📆" },
      { id: "brain",    label: "Exhale",        emoji: "💭" },
      { id: "weekly",   label: "Weekly Rhythm", emoji: "📅" },
      { id: "tidepool", label: "Tide Pool",     emoji: "🏝️" },
      { id: "school",   label: "Lighthouse",    emoji: "📖" },
    ]},
    { label: "Anchor", emoji: "🏠", kind: "group", items: [
      { id: "meals", label: "Meals", emoji: "🍽️" },
      { id: "shop", label: "Shopping", emoji: "🛒" },
      { id: "cove", label: "Cove", emoji: "🪸" },
      { id: "home", label: "Home", emoji: "🏡" },
      { vault: "recurring", label: "Reminders", emoji: "🔁" },
      { vault: "inventory", label: "Inventory", emoji: "📦" },
      { vault: "systems", label: "Systems", emoji: "🔧" },
      { vault: "health", label: "Health", emoji: "🩺" },
      { vault: "career", label: "Career", emoji: "📋" },
      { vault: "subs", label: "Subscriptions", emoji: "🔄" },
      { vault: "gifts", label: "Celebrate", emoji: "🎉" },
      { vault: "pets", label: "Pets", emoji: "🐾" },
      { vault: "moments", label: "Moments", emoji: "✨" },
      { vault: "travel", label: "Travel", emoji: "✈️" },
      { vault: "safeharbor", label: "Safe Harbor", emoji: "⚓" },
    ]},
    { vault: "ripples", label: "Ripples", emoji: "🌀", kind: "vaulttab" },
  ]
  const VAULT_NAV = [
    { id: "recurring", label: "Reminders", emoji: "🔁" },
    { id: "inventory", label: "Inventory", emoji: "📦" },
    { id: "systems",   label: "Systems",   emoji: "🏠" },
    { id: "health",    label: "Health",    emoji: "🩺" },
    { id: "career",    label: "Career",    emoji: "📋" },
    { id: "subs",      label: "Subscript", emoji: "🔄" },
    { id: "gifts",     label: "Celebrate", emoji: "🎉" },
    { id: "pets",      label: "Pets",      emoji: "🐾" },
    { id: "moments",   label: "Moments",   emoji: "✨" },
    { id: "travel",    label: "Travel",    emoji: "✈️" },
    { id: "ripples",     label: "Ripples",    emoji: "🌊" },
    { id: "safeharbor", label: "Safe Harbor",emoji: "⚓" },
    { id: "settings",   label: "Settings",   emoji: "⚙️" },
  ]
  const [anchorHidden, setAnchorHidden] = React.useState(function() {
    try { return JSON.parse(localStorage.getItem("af_anchor_hidden") || "{}") } catch { return {} }
  })
  React.useEffect(function() {
    function onAnchorStorage(e) {
      if (e && e.type === "storage" && e.key !== "af_anchor_hidden") return;
      try { setAnchorHidden(JSON.parse(localStorage.getItem("af_anchor_hidden") || "{}")) } catch {}
    }
    window.addEventListener("storage", onAnchorStorage)
    return function() { window.removeEventListener("storage", onAnchorStorage) }
  }, [])
  // af-set-tab now dispatched immediately in _setActiveTab — no useEffect needed

  React.useEffect(() => {
    if (activeTab !== "anchor" && activeTab !== "settings" && sections && sections[activeTab] === false) {
      _setActiveTab("anchor")
    }
  }, [sections, activeTab])
  return (
    <div style={{ display: "flex", minHeight: "100dvh" }}>
      <div style={{ width: "68px", background: "#1a2744", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0 8px", gap: "2px", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 200, borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto" }}>
        <button onClick={onHome} style={{ background: "none", border: "none", cursor: "pointer", marginBottom: "8px", padding: "6px 0", width: "100%", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "12px", color: "#c8a97a", letterSpacing: "0.04em", lineHeight: 1.1, textAlign: "center" }}>A&F</div>
        </button>

        

        <div style={{ width: "32px", height: "0.5px", background: "rgba(255,255,255,0.08)", marginBottom: "4px", flexShrink: 0 }} />

        {(
          /* ── Four-pillar accordion ── */
          PILLARS.map(function(pill){
            function rowBtn(it, active, onClick, col){
              col = col || { accent: "#c8a97a", glow: "rgba(200,169,122,0.16)" };
              return (<button key={(it.id?"t-"+it.id:it.vault?"v-"+it.vault:it.label)+"-row"} onClick={onClick} title={it.label} style={{ background: active ? col.glow : "none", border: "none", borderLeft: "3px solid "+(active ? col.accent : "transparent"), borderRadius: "0 8px 8px 0", cursor: "pointer", padding: "7px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", flexShrink: 0 }}><span style={{ fontSize: "15px", lineHeight: 1, opacity: active?1:0.75 }}>{it.emoji}</span><span style={{ fontSize: "6.5px", color: active ? col.accent : "rgba(200,169,122,0.70)", fontWeight: active?700:500, fontFamily: "DM Sans, sans-serif", letterSpacing: "0.03em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.15 }}>{it.label}</span></button>);
            }
            if (pill.kind === "tab") { var a = !showAnchor && navSel === "today-pillar"; return rowBtn(pill, a, function(){ setNavSel("today-pillar"); setShowAnchor(false); _setActiveTab(pill.id); }, pillColor("Today")); }
            if (pill.kind === "vaulttab") { var av = showAnchor && vaultSection === pill.vault && navSel === "v-"+pill.vault; return rowBtn(pill, av, function(){ setNavSel("v-"+pill.vault); setShowAnchor(true); setVaultSection(pill.vault); }, pillColor("Ripples")); }
            var isOpen = openGroup === pill.label;
            var _isFlowPillar = pill.label === "Flow"; var header = (<button key={"h-"+pill.label} onClick={function(){ setOpenGroup(pill.label); if(_isFlowPillar){ setNavSel("flowhome"); setShowAnchor(false); _setActiveTab("flowhome"); } else if(pill.label==="Anchor"){ setNavSel("v-home"); setShowAnchor(true); setVaultSection("home"); } }} title={pill.label} style={{ background: "none", border: "none", borderLeft: "3px solid "+((pill.label==="Flow" && !showAnchor && navSel==="flowhome") ? pillColor("Flow").accent : "transparent"), cursor: "pointer", padding: "8px 0 3px", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", flexShrink: 0 }}><span style={{ fontSize: "18px" }}>{pill.emoji}</span><span style={{ fontSize: "6.5px", color: pillColor(pill.label).accent, fontWeight: 700, fontFamily: "DM Sans, sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>{pill.label} {isOpen?"▾":"▸"}</span></button>);
            if (!isOpen) return header;
            var kids = pill.items.map(function(it){
              if (it.vault) { var av2 = showAnchor && vaultSection === it.vault && navSel === "v-"+it.vault; return rowBtn(it, av2, function(){ setNavSel("v-"+it.vault); setShowAnchor(true); setVaultSection(it.vault); }, pillColor(pill.label)); }
              var hidden = it.id !== "anchor" && it.id !== "cove" && sections && sections[it.id] === false;
              if (hidden) return null;
              var a2 = !showAnchor && navSel === "c-"+pill.label+"-"+it.id; return rowBtn(it, a2, function(){ setNavSel("c-"+pill.label+"-"+it.id); setShowAnchor(false); _setActiveTab(it.id); }, pillColor(pill.label));
            });
            return (<div key={pill.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", paddingBottom: "3px", marginBottom: "2px" }}>{header}{kids}</div>);
          })
        )}
        <div style={{ marginTop: "auto", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <button onClick={function(){ window.dispatchEvent(new CustomEvent("af-open-sunset")); }} title="Sunset" style={{ background: "none", border: "none", cursor: "pointer", padding: "7px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}><span style={{ fontSize: "15px", opacity: 0.82 }}>🌅</span><span style={{ fontSize: "6.5px", color: "rgba(200,169,122,0.72)", fontWeight: 500, fontFamily: "DM Sans, sans-serif", letterSpacing: "0.03em", textTransform: "uppercase" }}>Sunset</span></button>
          <button onClick={() => { setShowAnchor(false); _setActiveTab("settings"); }} title="Settings" style={{ background: (!showAnchor && activeTab === "settings") ? "rgba(200,169,122,0.14)" : "none", border: "none", cursor: "pointer", padding: "8px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}><span style={{ fontSize: "16px", opacity: 0.82 }}>⚙️</span><span style={{ fontSize: "7px", color: "rgba(200,169,122,0.72)", fontWeight: 500, fontFamily: "DM Sans, sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>Settings</span></button>
          <button onClick={onSignOut} title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 0", width: "56px", display: "flex", justifyContent: "center", opacity: 0.3, color: "#faf8f4", fontSize: "11px", fontFamily: "DM Sans, sans-serif" }}>sign out</button>
        </div>
      </div>
      <div style={{ marginLeft: "68px", flex: 1, minWidth: 0 }}>
        <style>{`
          div[style*="bottom: 0"][style*="left: 0"][style*="right: 0"],
          div[style*="bottom:0"][style*="left:0"][style*="right:0"],
          div[style*="position: sticky"][style*="z-index: 100"] {
            display: none !important;
          }
        `}</style>
        {showAnchor && <SectionErrorBoundary label="Anchor Vault"><AnchorVault onClose={() => setShowAnchor(false)} vaultSection={vaultSection} /></SectionErrorBoundary>}

        <div style={{ pointerEvents: showAnchor ? "none" : "auto" }}>
          <ErrorBoundary>
            <HomeFlow />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = React.useState(undefined)
  const [mode, setMode] = React.useState(null)

  React.useEffect(() => {
    // Blank-screen guard: if getSession() never resolves (network failure, corrupted
    // session storage), the app sticks on the loading screen indefinitely. A 5-second
    // timeout forces session=null → AuthScreen so the user can sign in.
    var _sessionResolved = false;
    var _sessionTimeout = setTimeout(function() {
      if (!_sessionResolved) { console.warn("[AF AUTH] getSession() timed out — showing sign-in"); setSession(null); }
    }, 5000);
    supabase.auth.getSession().then(function(result) {
      _sessionResolved = true;
      clearTimeout(_sessionTimeout);
      var session = result && result.data && result.data.session;
      setSession(session || null);
      if (session && session.user) {
        var u = session.user;
        var dn = (u.user_metadata && u.user_metadata.full_name) || u.email.split("@")[0];
        try { localStorage.setItem("af_authUser", JSON.stringify({ id: u.id, email: u.email, displayName: dn })); } catch(e) {}
      }
    }).catch(function() {
      _sessionResolved = true;
      clearTimeout(_sessionTimeout);
      console.warn("[AF AUTH] getSession() failed — showing sign-in");
      setSession(null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.access_token) {
        try { localStorage.setItem("af_authToken", JSON.stringify(session.access_token)); } catch {}
      }
      if (session?.refresh_token) {
      }
      if (event === "SIGNED_OUT" || !session) {
        try { localStorage.removeItem("af_authToken"); } catch {}
        try { localStorage.removeItem("af_authUser"); } catch {}
        // Only wipe household data on an EXPLICIT user sign-out. Automatic sign-outs
        // (zombie-session detection, refreshAuthToken hard failure) preserve household
        // data so unpushed edits can push once the session is restored after re-login.
        if (_afUserInitiatedSignOut) {
          try { localStorage.removeItem("af_householdId"); } catch {}
          SYNC_KEYS.forEach(k => { try { localStorage.removeItem("af_" + k); } catch {} });
        }
        _afUserInitiatedSignOut = false;
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = () => { _afUserInitiatedSignOut = true; supabase.auth.signOut(); setSession(null); setMode(null) }

  if (session === undefined) {
    return <div style={{ minHeight: "100dvh", background: "#1a2744", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "serif", fontSize: "20px", color: "rgba(250,248,244,0.4)" }}>anchor & flow</div>
  }

  if (!session) return <AuthScreen onAuth={(s) => {
    setSession(s)
    // Set displayName in localStorage so original app greeting works
    if (s?.user) {
      const displayName = s.user.user_metadata?.full_name || s.user.email.split("@")[0]
      try {
        localStorage.setItem("af_authUser", JSON.stringify({ id: s.user.id, email: s.user.email, displayName }))
        if (s.access_token) {
          localStorage.setItem("af_token", s.access_token)
          localStorage.setItem("af_authToken", JSON.stringify(s.access_token))
        }
        if (s.refresh_token) {
        }
      } catch(e) {}
    }
  }} />

  return <RootErrorBoundary><FlowWrapper onHome={() => setMode(null)} onSignOut={signOut} /></RootErrorBoundary>
}
