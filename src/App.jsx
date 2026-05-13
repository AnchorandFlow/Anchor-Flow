import React, { useState, useRef, useEffect, useCallback, memo, useMemo, lazy, Suspense } from "react";
import RippleTab from "./components/RippleTab";
import AnchorVault from "./components/AnchorVault";
import RecipesTab from "./components/RecipesTab";
import { supabase } from "./lib/supabase"
import AuthScreen from "./components/AuthScreen"
import HomeScreen from "./components/HomeScreen"

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
const VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDkBNjLskvIwt74kS7p-9jJHHhVWjyIw_dZ8IJBhDxk";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

function usePushNotifications() {
  const [permission, setPermission] = React.useState(Notification.permission);
  const [subscribed, setSubscribed] = React.useState(false);

  const subscribe = React.useCallback(async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;
      const existing = await reg.pushManager.getSubscription();
      if (existing) { setSubscribed(true); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await supabase.from("push_subscriptions").upsert({
        endpoint: sub.endpoint,
        subscription_json: JSON.stringify(sub),
        household_id: localStorage.getItem("af_householdId"),
        user_agent: navigator.userAgent.slice(0, 200),
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      setSubscribed(true);
    } catch(e) { console.warn("[PWA] Push subscribe failed:", e); }
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
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return { permission, subscribed, subscribe };
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
  const { permission, subscribed, subscribe } = usePushNotifications();

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
      {/* Push opt-in prompt — shown once if not yet subscribed */}
      {!subscribed && permission !== 'denied' && (
        <div style={{
          background: 'rgba(200,169,122,0.08)',
          border: '0.5px solid rgba(200,169,122,0.25)',
          borderRadius: 12,
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2a38', fontFamily: 'DM Sans, sans-serif' }}>Get Ripple on your phone</div>
            <div style={{ fontSize: 11, color: '#8a8a9a', fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>Morning follow-ups delivered as push notifications</div>
          </div>
          <button
            onClick={subscribe}
            style={{
              background: 'rgba(200,169,122,0.15)', border: '0.5px solid rgba(200,169,122,0.5)',
              borderRadius: 20, padding: '6px 14px', fontSize: 12, color: '#9a7a52',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
            }}
          >Turn on</button>
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
                Ripple
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
    const ARRAY_KEYS = ["af_tasks", "af_brainItems", "af_shoppingItems", "af_notifications", "af_calEvents", "af_connectedCals", "af_favMeals", "af_checkedCalEvents", "af_checkedMealItems", "af_burnoutChecked"];
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

// ── Error Boundary — catches any render crash and shows a recovery screen ────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { crashed: false, error: null }; }
  static getDerivedStateFromError(error) { return { crashed: true, error }; }
  componentDidCatch(error, info) { console.error("Anchor & Flow crashed:", error, info); }
  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem",fontFamily:"sans-serif",background:"#f5f0e8",textAlign:"center"}}>
        <div style={{fontSize:"3rem",marginBottom:"1rem"}}>⚓️</div>
        <h2 style={{marginBottom:"0.5rem",color:"#2a2a38"}}>Something went wrong</h2>
        <p style={{color:"#5a5a6a",marginBottom:"1.5rem",maxWidth:320}}>Anchor & Flow hit an unexpected error. Your data in the cloud is safe — tap restart to reload it.</p>
        <button onClick={()=>{
          try {
            // Save auth keys before clearing
            const authToken = localStorage.getItem("af_authToken");
            const authUser = localStorage.getItem("af_authUser");
            const householdId = localStorage.getItem("af_householdId");
            const theme = localStorage.getItem("af_theme");
            const flowMode = localStorage.getItem("af_flowMode");
            // Wipe everything
            localStorage.clear();
            sessionStorage.clear();
            // Restore only auth so Supabase can pull data back
            if (authToken) localStorage.setItem("af_authToken", authToken);
            if (authUser) localStorage.setItem("af_authUser", authUser);
            if (householdId) localStorage.setItem("af_householdId", householdId);
            if (theme) localStorage.setItem("af_theme", theme);
            if (flowMode) localStorage.setItem("af_flowMode", flowMode);
          } catch(e) {
            // If all else fails, just clear and reload
            try { localStorage.clear(); } catch {}
          }
          window.location.reload();
        }}
          style={{background:"#6A9BB5",color:"#fff",border:"none",borderRadius:"0.75rem",padding:"0.75rem 1.5rem",cursor:"pointer",fontWeight:700,fontSize:"1rem",marginBottom:"0.75rem"}}>
          Restart & Restore My Data
        </button>
        <button onClick={()=>window.location.reload()}
          style={{background:"transparent",color:"#8a8a9a",border:"1px solid #ccc",borderRadius:"0.75rem",padding:"0.5rem 1rem",cursor:"pointer",fontSize:"0.85rem"}}>
          Try again without clearing
        </button>
        <details style={{marginTop:"1.5rem",color:"#8a8a9a",fontSize:"0.72rem",maxWidth:400,textAlign:"left"}}>
          <summary style={{cursor:"pointer"}}>Error details</summary>
          <pre style={{marginTop:"0.5rem",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>{String(this.state.error)}</pre>
        </details>
      </div>
    );
  }
}

// ── Supabase client (household sync) ─────────────────────────────────────────
const SUPABASE_URL = "https://sbgbyptkunvyxjfpzght.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZ2J5cHRrdW52eXhqZnB6Z2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Njk2MDYsImV4cCI6MjA5MDA0NTYwNn0.jbrKplCdnPeqS3QEKMDMClsIVBvQYgph_U5xK5iCxY0";

async function sbFetch(path, opts={}) {
  const url = SUPABASE_URL + path;
  const r = await fetch(url, {
    ...opts,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + (opts._token || SUPABASE_KEY),
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

// Household data keys that get synced to Supabase
const SYNC_KEYS = ["tasks","meals","mealsWeekOf","nextWeekMeals","calEvents","shoppingItems","rhythm","people","familyProfile","brainItems","inventory","health"];

const TODAY = new Date();
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const TODAY_NAME = DAY_NAMES[TODAY.getDay()];
const FORMAT_DATE = d => d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const FORMAT_SHORT = d => d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
const uid = () => Math.random().toString(36).slice(2,9);
// Returns the ISO date string (YYYY-MM-DD) of the Monday starting the current week
const getThisMonday = () => {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
};
const MEAL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const WEEKDAYS_SUN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const THEMES = {
  calm: {
    label:"Calm", emoji:"🌿",
    bg:"#F5F0E8", bgAlt:"#EDE8DF", surface:"#FDFAF5", border:"#D4CCB8", borderSoft:"#E0D8C8",
    sage:"#7a9e8e", sageDark:"#4d7a6a", sageLight:"#a0c0b0", sagePale:"#deeee8",
    sand:"#c4a882", sandDark:"#9a7a52", sandLight:"#ddc8a0", sandPale:"#f0e4d0",
    blue:"#6A9BB5", blueDark:"#4a7a94", blueLight:"#96bdd0", bluePale:"#deedf5",
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
    blue:"#58a8d0", blueDark:"#3080a8", blueLight:"#88c8e8", bluePale:"#0c2838",
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
  {id:"weekly",   label:"Weekly",   emoji:"📅"},
  {id:"home",     label:"Home",     emoji:"🏠"},
  {id:"brain",    label:"Brain",    emoji:"🧠"},
  {id:"burnout",  label:"Burnout",  emoji:"🛟"},
  {id:"settings", label:"Settings", emoji:"⚙️"},
];
const PRIMARY_TABS = ["anchor","calendar","meals","shop"];
const MORE_TABS    = ["weekly","home","brain","burnout","settings"];

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
  const s={width:size,height:size,display:"block",flexShrink:0};
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

function HomeFlow() {

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
    function setSaved(next) {
      // Use React's functional updater so we always operate on the latest state,
      // avoiding stale-closure bugs when setSaved is called inside timeouts or
      // rapid successive updates (e.g. AnchorCheckItem animation + toggle).
      setVal(prev => {
        const resolved = typeof next === "function" ? next(prev) : next;
        try { localStorage.setItem("af_" + key, JSON.stringify(resolved)); } catch {}
        return resolved;
      });
    }
    return [val, setSaved];
  }

  const [themeName, setThemeNameRaw] = useSaved("theme", "calm");
  const T = THEMES[themeName];

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
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const [lastSyncTime,setLastSyncTime] = useState(null);
  const [showAuthModal,setShowAuthModal] = useState(false);
  const [showHouseholdModal,setShowHouseholdModal] = useState(false);
  const [anchorDayOpen,setAnchorDayOpen] = useState(false);
  const [googleCalToken,setGoogleCalToken]     = useSaved("googleCalToken", null);
  const [googleCalSyncing,setGoogleCalSyncing] = useState(false);
  const [googleCalError,setGoogleCalError]     = useState("");
  const syncChannelRef = useRef(null);


  // ── Validate auth token on load — clear if expired ───────────────────────
  useEffect(() => {
    if (!authToken) return;
    sbFetch("/auth/v1/user", { _token: authToken })
      .catch(() => {
        try { localStorage.removeItem("af_authToken"); } catch {}
        try { localStorage.removeItem("af_authUser"); } catch {}
        setAuthToken(null);
        setAuthUser(null);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Sanitize data from Supabase — removes null array entries, ensures safe types ──
  function sanitizeHouseholdData(data) {
    if (!data || typeof data !== "object") return {};
    const out = {};
    // Arrays: filter out null/undefined entries
    ["tasks","brainItems","shoppingItems","notifications","calEvents","connectedCals"].forEach(k => {
      if (Array.isArray(data[k])) {
        out[k] = data[k].filter(item => item != null && typeof item === "object");
      } else if (data[k] !== undefined) {
        out[k] = data[k];
      }
    });
    // people: filter nulls, ensure each has id/name/color
    if (Array.isArray(data.people)) {
      out.people = data.people.filter(p => p != null && p.id && p.name);
    }
    // meals: ensure each day is an object not null
    if (data.meals && typeof data.meals === "object") {
      const safeMeals = {};
      MEAL_DAYS.forEach(day => {
        const m = data.meals[day];
        if (!m || typeof m !== "object") { safeMeals[day] = {}; }
        else {
          const clean = {};
          Object.entries(m).forEach(([k,v]) => { clean[k] = (v == null) ? "" : String(v); });
          safeMeals[day] = clean;
        }
      });
      out.meals = safeMeals;
    }
    // rhythm: ensure each day is an object
    if (data.rhythm && typeof data.rhythm === "object") {
      out.rhythm = data.rhythm;
    }
    // Objects: pass through if valid
    ["familyProfile","aiMemory","collapsedStores"].forEach(k => {
      if (data[k] !== undefined) out[k] = data[k];
    });
    return out;
  }

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
      console.log("Supabase signup response:", JSON.stringify(data));

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

      console.log("Supabase signin response keys:", Object.keys(data));

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
            const clean = sanitizeHouseholdData(existingHH.data);
            SYNC_KEYS.forEach(k => {
              if (clean[k] !== undefined) {
                try { localStorage.setItem("af_" + k, JSON.stringify(clean[k])); } catch {}
              }
            });
            try { localStorage.setItem("af_lastHHSync", existingHH.updated_at || Date.now().toString()); } catch {}
          }
        } else {
          // No household owned by this user — check if they've joined someone else's.
          // joined_household_id is stored in Supabase user_metadata at join time.
          const joinedHhId = data.user?.user_metadata?.joined_household_id || null;
          console.log("[AF] No owned household. joined_household_id from metadata:", joinedHhId);
          if (joinedHhId) {
            try {
              const joinedRows = await sbFetch(`/rest/v1/households?id=eq.${joinedHhId}&select=*&limit=1`, { _token: token });
              if (joinedRows && joinedRows.length > 0 && joinedRows[0].data) {
                try { localStorage.setItem("af_householdId", JSON.stringify(joinedHhId)); } catch {}
                const clean = sanitizeHouseholdData(joinedRows[0].data);
                SYNC_KEYS.forEach(k => {
                  if (clean[k] !== undefined) {
                    try { localStorage.setItem("af_" + k, JSON.stringify(clean[k])); } catch {}
                  }
                });
                try { localStorage.setItem("af_lastHHSync", joinedRows[0].updated_at || Date.now().toString()); } catch {}
                console.log("[AF] Restored joined household on sign-in:", joinedHhId);
              }
            } catch(e) { console.warn("[AF] Failed to fetch joined household:", e.message); }
          }
        }
      } catch(hhErr) {
        console.warn("Household lookup failed:", hhErr.message);
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
    try { await supabase.auth.signOut(); } catch {}
    if (authToken) { try { await sbSignOut(authToken); } catch {} }
    // Clear localStorage directly then reload — avoids null authUser render crash
    try { localStorage.removeItem("af_authToken"); } catch {}
    try { localStorage.removeItem("af_authUser"); } catch {}
    try { localStorage.removeItem("af_householdId"); } catch {}
    try { localStorage.removeItem("af_lastHHSync"); } catch {}
    window.location.reload();
  }

  async function pushHouseholdData(token, hid) {
    if (!token || !hid) return;
    const payload = {};
    SYNC_KEYS.forEach(k => { try { payload[k] = JSON.parse(localStorage.getItem("af_"+k)||"null"); } catch {} });
    const updatedAt = new Date().toISOString();
    try {
      // return=representation so Supabase gives us back the actual row with
      // the server-stamped updated_at. We store that value (not our client
      // timestamp) so the startup sync check never sees a false mismatch.
      const rows = await sbFetch("/rest/v1/households", {
        method: "POST",
        _token: token,
        headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ id: hid, owner_id: (() => { try { return JSON.parse(localStorage.getItem("af_authUser")||"null")?.id||null; } catch { return null; } })(), data: payload, updated_at: updatedAt })
      });
      const serverTs = (rows && rows[0] && rows[0].updated_at) ? rows[0].updated_at : updatedAt;
      try { localStorage.setItem("af_lastHHSync", serverTs); } catch {}
    } catch {
      // Fallback: try PATCH if POST fails
      try {
        const patchRows = await sbFetch(`/rest/v1/households?id=eq.${hid}`, {
          method: "PATCH",
          _token: token,
          headers: { "Prefer": "return=representation" },
          body: JSON.stringify({ data: payload, updated_at: updatedAt })
        });
        const serverTs = (patchRows && patchRows[0] && patchRows[0].updated_at) ? patchRows[0].updated_at : updatedAt;
        try { localStorage.setItem("af_lastHHSync", serverTs); } catch {}
      } catch {}
    }
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
    setHouseholdId(row.id); // always trust Supabase over stale localStorage
    const clean1 = sanitizeHouseholdData(row.data);
    SYNC_KEYS.forEach(k => {
      if (clean1[k] !== undefined) {
        try { localStorage.setItem("af_"+k, JSON.stringify(clean1[k])); } catch {}
      }
    });
    window.location.reload();
  }

  async function joinHousehold(token, joinCode) {
    // joinCode is the householdId shared by the other person
    try {
      setSyncStatus("syncing");
      const rows = await sbFetch(`/rest/v1/households?id=eq.${joinCode}&select=*`, { _token: token });
      if (!rows || !rows.length) return { ok:false, error:"Household not found. Check the code and try again." };
      // Save householdId to localStorage BEFORE reload so it persists
      try { localStorage.setItem("af_householdId", JSON.stringify(joinCode)); } catch {}
      // Write joined household ID into Supabase user_metadata so it survives logout/login on any device
      try {
        await sbFetch("/auth/v1/user", {
          method: "PUT",
          _token: token,
          body: JSON.stringify({ data: { joined_household_id: joinCode } })
        });
        console.log("[AF] Saved joined_household_id to user metadata:", joinCode);
      } catch(e) { console.warn("[AF] Could not save joined_household_id to metadata:", e.message); }
      if (rows[0].data) {
        const clean2 = sanitizeHouseholdData(rows[0].data);
        SYNC_KEYS.forEach(k => {
          if (clean2[k] !== undefined) {
            try { localStorage.setItem("af_"+k, JSON.stringify(clean2[k])); } catch {}
          }
        });
      }
      setSyncStatus("synced");
      setLastSyncTime(new Date().toLocaleTimeString());
      window.location.reload();
      return { ok: true };
    } catch(e) { setSyncStatus("error"); return { ok:false, error: e.message }; }
  }

  async function syncNow() {
    if (!authToken || !householdId) return;
    try {
      setSyncStatus("syncing");
      // Push-only — called after user changes local state.
      // Pulling (and reloading) only happens in the startup useEffect below,
      // so user edits are never clobbered by a mid-session server overwrite.
      await pushHouseholdData(authToken, householdId);
      setSyncStatus("synced");
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch { setSyncStatus("error"); }
  }

  // Register Service Worker on first load (enables caching + persistent notifications)
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
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
            // Household exists — keep it regardless of owner (could be a joined household)
            console.log("[AF] Household ID valid:", currentId);
          } else {
            // Household doesn't exist — find the one owned by this user
            sbFetch(`/rest/v1/households?owner_id=eq.${userId}&select=id&order=updated_at.desc&limit=1`, { _token: authToken })
              .then(owned => {
                if (owned && owned.length > 0) {
                  console.log("[AF] Correcting to owned household:", owned[0].id);
                  localStorage.setItem("af_householdId", JSON.stringify(owned[0].id));
                  window.location.reload();
                } else {
                  console.log("[AF] No household found for user:", userId);
                }
              }).catch(() => {});
          }
        }).catch(() => {});
    } else {
      // No household stored — find the one owned by this user
      sbFetch(`/rest/v1/households?owner_id=eq.${userId}&select=id&order=updated_at.desc&limit=1`, { _token: authToken })
        .then(rows => {
          if (rows && rows.length > 0) {
            console.log("[AF] Setting owned household:", rows[0].id);
            localStorage.setItem("af_householdId", JSON.stringify(rows[0].id));
            window.location.reload();
          } else {
            console.log("[AF] No household found for user:", userId);
          }
        }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Background household sync — polls every 60s ─────────────────────────
  // Each tick fetches the server row and compares updated_at to af_lastHHSync.
  // If server is newer and the user isn't actively typing, writes fresh data
  // and reloads so the other household member's changes appear automatically.
  // Our own pushes update af_lastHHSync, so we never reload on our own writes.
  useEffect(() => {
    if (!authToken || !householdId) return;

    async function checkForUpdates() {
      try {
        const rows = await sbFetch(`/rest/v1/households?id=eq.${householdId}&select=*`, { _token: authToken });
        if (!rows || !rows.length || !rows[0].data) return;
        const row = rows[0];
        const serverTs = row.updated_at || "";
        const lastSync = localStorage.getItem("af_lastHHSync") || "";
        if (serverTs && serverTs !== lastSync) {
          const activeEl = document.activeElement;
          const isTyping = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT");
          const isDragging = !!document.querySelector("[data-taskid][style*='opacity: 0.35'],[data-brainid][style*='opacity: 0.35'],[data-shopid][style*='opacity: 0.35'],[data-sysid][style*='opacity: 0.35']");
          if (isTyping || isDragging) return;
          const cleanBg = sanitizeHouseholdData(row.data);
          const localWeekOf = (() => { try { const r=localStorage.getItem("af_mealsWeekOf"); return r?JSON.parse(r):null; } catch { return null; } })();
          SYNC_KEYS.forEach(k => {
            // Don't overwrite mealsWeekOf from server if local already has this week's value
            if (k === "mealsWeekOf" && localWeekOf === getThisMonday()) return;
            if (cleanBg[k] !== undefined) {
              try { localStorage.setItem("af_" + k, JSON.stringify(cleanBg[k])); } catch {}
            }
          });
          localStorage.setItem("af_lastHHSync", serverTs);
          window.location.reload();
        } else {
          setSyncStatus("synced");
          setLastSyncTime(new Date().toLocaleTimeString());
        }
      } catch {}
    }

    // First check after 5s, then every 60s
    const initial = setTimeout(checkForUpdates, 5000);
    const interval = setInterval(function(){
      // Don't sync while user is actively typing in an input
      const active = document.activeElement;
      const isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
      const shopFocused = window._shopInputFocused;
      if(!isTyping && !shopFocused) checkForUpdates();
    }, 60000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Push local changes every 30s ───────────────────────────────────────────
  // Only pushes — no reloads. Cross-device updates appear on next app open.
  useEffect(() => {
    if (!authToken || !householdId) return;
    const iv = setInterval(async () => {
      try {
        await pushHouseholdData(authToken, householdId);
        setSyncStatus("synced");
        setLastSyncTime(new Date().toLocaleTimeString());
      } catch {}
    }, 30000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, householdId]);

  // Sync on task/meal/cal changes (debounced)
  const syncTimeoutRef = useRef(null);
  function debouncedSync() {
    if (!authToken || !householdId) return;
    clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(syncNow, 3000);
  }

  // ── All state ───────────────────────────────────────────────────────────────
  const [tab,setTab] = useState(()=>{try{const s=sessionStorage.getItem("af_activeTab");if(s)return s;}catch{}return "anchor";});
  React.useEffect(() => { const h = (e) => goTab(e.detail); window.addEventListener("af-set-tab", h); return () => window.removeEventListener("af-set-tab", h); }, []);
  const visitedTabs = useRef(new Set(["anchor","calendar","weekly","meals","shop","home","brain","burnout","settings","ai"]));
  function goTab(t) { visitedTabs.current.add(t); setTab(t); try{sessionStorage.setItem("af_activeTab",t);}catch{} }
  homeFlowRef.tab = tab;
  homeFlowRef.goTab = goTab;
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
  const [brainItems,setBrainItems]             = useSaved("brainItems",[]);
  const [brainCats,setBrainCats]               = useSaved("brainCats", [
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
  const [sections,setSections]                 = useSaved("sections",{anchor:true,calendar:true,weekly:true,meals:true,shop:true,home:true,brain:true,burnout:true});
  const [dietaryFilters,setDietaryFilters]     = useSaved("dietaryFilters",["Dairy-free"]);
  const [calEvents,setCalEvents]               = useSaved("calEvents",[]);
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
  const [selectedDay,setSelectedDay]   = useState(null);
  const [calView,setCalView]           = useState("month");
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
  const [inAppBanner,setInAppBanner] = useState(null); // {title, body} shown as in-app toast

  // ── New feature state (all useSaved first, then useState) ───────────────────
  const [onboardingComplete,setOnboardingComplete] = useSaved("onboardingComplete",false);
  const [dayBriefing,setDayBriefing]               = useSaved("dayBriefing",null);
  const [briefingBuilt,setBriefingBuilt]           = useSaved("briefingBuilt",null);
  const [lastSeenDate,setLastSeenDate]             = useSaved("lastSeenDate",null);
  const [favMeals,setFavMeals]                     = useSaved("favMeals",[]);
  const [emailSubmitted,setEmailSubmitted]         = useSaved("emailSubmitted",false);

  const [showOnboardingWizard,setShowOnboardingWizard] = useState(false);
  const [showBriefing,setShowBriefing]             = useState(false);
  const [showEndOfDay,setShowEndOfDay]             = useState(false);
  const [dayClosed,setDayClosed]                   = useSaved("dayClosed_"+TODAY_NAME, false);
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
  const [insightsLoading,setInsightsLoading]       = useState(false);
  const [dismissedInsights,setDismissedInsights]   = useSaved("dismissedInsights",[]);
  const [expandedInsightReason,setExpandedInsightReason] = useState(null);


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
    const brainForTheme = BRAIN_CATS.find(c=>
      c.suggestDay && dayRhythm.theme && c.suggestDay.toLowerCase()===dayRhythm.theme.toLowerCase()
    );
    const next7 = Array.from({length:7},(_,i)=>{const d=new Date(TODAY);d.setDate(d.getDate()+i+1);return d.toISOString().split("T")[0];});
    const upcomingEvts7 = calEvents.filter(e=>next7.includes(e.date)).slice(0,6);
    const ctx = [
      "Family: "+(familyProfile?JSON.stringify(familyProfile):"not set"),
      "Household members: "+people.filter(function(p){return p&&p.name;}).map(function(p){return p.name+(p.role?" ("+p.role+")":"")+(p.age!=null?" age "+p.age:"")+(p.isMinor||(p.age!=null&&p.age<18)?" [minor]":"");}).join(", "),
      "Today: "+TODAY_NAME+", theme: "+(dayRhythm.theme||"none"),
      "Events today: "+(todayEvts.map(e=>(e.time||"all day")+" "+e.title).join(", ")||"none"),
      "Upcoming events next 7 days: "+(upcomingEvts7.map(e=>{const d=new Date(e.date+"T12:00:00");const dn=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];return dn+" "+e.date+" "+(e.time||"")+" "+e.title;}).join(", ")||"none"),
      "Meals: "+(Object.entries(todayMealObj).map(([k,v])=>k+"="+v).join(", ")||"none"),
      "Carried tasks: "+(carried.map(t=>t.text).join(", ")||"none"),
      "Existing tasks: "+(existing.map(t=>t.text).join(", ")||"none"),
      "Brain dump relevant to today's theme: "+(brainForTheme?brainPending.filter(b=>matchedCatIds.includes(b.cat)).map(b=>b.text).join(", "):"none"),
      "Full brain dump (undone): "+brainPending.slice(0,12).map(b=>b.text).join(", ")||"none",
      "Tomorrow: "+tmrName+", theme="+(tmrRhythm.theme||"none")+", events: "+(tmrEvts.map(e=>e.title).join(", ")||"none")+", meal: "+(tmrMeal.dinner||"not planned"),
      "Flow mode: "+flowMode,
      "Preferred name (use in greeting): "+(preferredName||familyProfile?.parentNames?.split(/[&,]/)[0]?.trim()||""),
      "Greeting tone: "+(flowGreetingTone||"warm"),
    ].join(". ");
    const sysPrompt = `You are Ripple, the Anchor & Flow AI. Build a smart family daily anchor. Use the brain dump items to pull relevant tasks into today — especially ones matching the day theme. For upcoming events, suggest prep tasks (e.g. "Wash soccer jersey" for a soccer game, "Confirm reservation" for a dinner). Respond ONLY in valid JSON: {"greeting":"warm personal sentence","top3":["task","task","task"],"next3":["task","task","task"],"more":["task"],"prepItems":["meal prep step if needed"],"tomorrowNote":"one sentence about tomorrow","message":"closing encouragement"}. top3 must include appointments. Pull from brain dump where relevant — use EXACT brain dump text. Keep tasks under 55 chars.`;
    try {
      const res = await fetch("/api/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,system:sysPrompt,messages:[{role:"user",content:ctx}]})
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
          return `${daysOut===0?"TODAY":daysOut===1?"TOMORROW":"in "+daysOut+"d"}: ${e.title}${e.time?" at "+e.time:""}`;
        });

      // ── Meals: full week plan ──────────────────────────────────────────────
      const MEAL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
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
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:`You are Ripple, Anchor & Flow's proactive insight engine — warm, practical, and specific like a brilliant family manager friend. Scan the family's real data and surface 3-5 things they might be missing or that deserve attention NOW.

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
      console.error("Insights error:",err);
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
    setInAppBanner({title, body});
    setTimeout(() => setInAppBanner(null), 8000);
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
          model: "claude-sonnet-4-20250514", max_tokens: 160,
          system, messages: [{ role: "user", content: userContent }]
        })
      });
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
    // Note: we intentionally do NOT guard with dailySummaryScheduled here.
    // setTimeout-based notifications don't survive the app being closed/refreshed,
    // so we reschedule every time the app opens. Times that have already passed
    // are filtered out below by checking `fireAt > now` in each branch.
    setDailySummaryScheduled(TODAY.toDateString());

    const todayTasks  = tasks.filter(t => (t.day===TODAY_NAME||t.day==="Daily") && !t.archived);
    const doneTasks   = todayTasks.filter(t => t.done);
    const pendingTasks= todayTasks.filter(t => !t.done);
    const todayMeal   = (meals[TODAY_NAME]||{}).dinner;
    const todayDateStr= TODAY.toISOString().split("T")[0];
    const todayEvts   = calEvents.filter(e => e.date === todayDateStr).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
    const tmrName     = DAY_NAMES[new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate()+1).getDay()];
    const tmrMeal     = (meals[tmrName]||{}).dinner;
    const familyCtx   = familyProfile ? `Family: ${familyProfile.parentNames}, ${familyProfile.numKids} kids.` : "";
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
    if (morningTime > now) {
      // Build a structured body that always lists the actual schedule
      const body = scheduleLines.length > 0
        ? scheduleStr
        : `${pendingTasks.length} tasks today. ${todayMeal ? `Dinner: ${todayMeal}.` : "No dinner planned yet."} You've got this ⚓️`;
      // Also get a warm AI greeting for the title
      const title = await generateAIMessage(
        `You are Ripple, the Anchor & Flow AI. Write a warm good morning greeting — max 50 chars, no punctuation at end. Start with "Good morning" and optionally one warm word. Examples: "Good morning, lovely day ahead", "Good morning — let's do this".`,
        dataCtx,
        "Good morning ⚓️ Here's your day"
      );
      scheduleNotification(title, body, morningTime);
    }

    // ── 2. MIDDAY CHECK-IN (12pm) ───────────────────────────────────────────
    const middayTime = todayAt(12);
    if (middayTime > now) {
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
    if (defrostTime > now && todayMeal && !["snack plate","freezer burrito","rotisserie","no-cook"].some(s=>todayMeal.toLowerCase().includes(s))) {
      const msg = await generateAIMessage(
        `You are Ripple, the Anchor & Flow AI. Write a friendly 3pm meal prep reminder (max 120 chars). Mention the specific dinner and suggest one thing to do now (defrost, start slow cooker, etc). Warm tone.`,
        `Dinner tonight: ${todayMeal}. Family: ${familyProfile?.numKids||""} kids.`,
        `🍽️ Dinner reminder — ${todayMeal} tonight. Good time to check if anything needs defrosting!`
      );
      scheduleNotification("🍽️ Dinner heads-up", msg, defrostTime);
    }

    // ── 4. EVENING RECAP — Ripple-style (5pm) ─────────────────────────────────
    const eveningTime = todayAt(17);
    if (eveningTime > now) {
      const tmrDateStr = new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate()+1).toISOString().split("T")[0];
      const tmrEvtsList = calEvents.filter(e=>e.date===tmrDateStr);
      const tmrStr = [
        ...tmrEvtsList.map(e=>`${e.time?fmtTime(e.time)+" ":""} ${e.title}`),
        ...(tmrMeal?[`Dinner: ${tmrMeal}`]:[])
      ].join(" · ");
      const body = await generateAIMessage(
        `You are Ripple, the Anchor & Flow AI — warm and real. Write an evening recap (max 160 chars). Acknowledge what they did, mention tomorrow briefly. Caring tone, not corporate.`,
        `Done today: ${doneTasks.map(t=>t.text).join(", ")||"none"}. Still pending: ${pendingTasks.length}. Tomorrow (${tmrName}): ${tmrStr||"nothing planned yet"}.`,
        `Good evening 🌙 ${doneTasks.length>0?`${doneTasks.length} things done today — well done.`:"Rest up."} ${tmrStr?`Tomorrow: ${tmrStr.slice(0,60)}.`:""}`
      );
      scheduleNotification("🌙 Evening recap", body, eveningTime);
    }

    // ── 5. SMART EVENT NUDGES — 2hrs before each appointment ────────────────
    todayEvts.forEach(async (e) => {
      if (!e.time) return;
      const [h,m] = e.time.split(":").map(Number);
      const eventTime = todayAt(h, m);
      const nudgeTime = new Date(eventTime.getTime() - 2 * 60 * 60 * 1000); // 2hrs before
      if (nudgeTime <= now) return;
      const msg = await generateAIMessage(
        `You are Ripple, the Anchor & Flow AI. Write a friendly heads-up notification for an upcoming appointment in 2 hours (max 120 chars). Be warm and helpful — suggest one thing to do to prepare.`,
        `Event: ${e.title} at ${e.time}. ${familyCtx}`,
        `⏰ ${e.title} is in 2 hours — time to get ready!`
      );
      scheduleNotification(`⏰ Coming up: ${e.title}`, msg, nudgeTime);
    });
  }

  // ── Legacy alias ─────────────────────────────────────────────────────────────
  const scheduleDailySummary = scheduleAllDailyNotifications;

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    // Run on iOS always (uses in-app banners), elsewhere only if permission granted
    if (notifPermission === "granted" || isIOS) scheduleAllDailyNotifications();
    // Register Service Worker for persistent notifications
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifPermission]);

  // Sync household data when key state changes
  useEffect(() => { debouncedSync(); }, [tasks, meals, calEvents, shoppingItems]); // eslint-disable-line

  // ── Share text ──────────────────────────────────────────────────────────────
  function shareText() {
    const todayTasks = tasks.filter(t=>t.day===TODAY_NAME||t.day==="Daily");
    const tm = meals[TODAY_NAME]||{};
    const mealLines = MEALS_TO_SHOW.map(m=>`${m}: ${tm[m]||"—"}`);
    return `⚓️ Anchor & Flow — ${FORMAT_DATE(TODAY)}\nA steadier home, in every season\n\nFlow Mode: ${flowMode} ${fm.emoji}\n\nToday's Tasks:\n${todayTasks.map(t=>`• ${t.text}${t.carried?" ↩":""}`).join("\n")||"No tasks."}\n\nMeals:\n${mealLines.join("\n")}\n\nHave a beautiful day 🌿`;
  }

  // ── Calendar helpers ────────────────────────────────────────────────────────
  function localDateStr(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function calDayFromStr(str){ if(!str)return null; const [y,m,d]=str.split("-").map(Number); return new Date(y,m-1,d); }
  function openAddEvent(prefillDate){ setCalFormInit({title:"",date:prefillDate||"",time:"",color:"#6A9BB5",colorLabel:calColorLabels["#6A9BB5"]||"Blue",colorCustom:"",note:"",repeat:""}); setCalFormMode("add"); setCalFormId(null); }
  function openEditEvent(e){ setCalFormInit({...e,colorCustom:e.colorCustom||""}); setCalFormId(e.id); setCalFormMode("edit"); }
  function closeCalForm(){ setCalFormMode(null); setCalFormId(null); setCalFormInit(null); }

  // ── Recipe import ───────────────────────────────────────────────────────────
  async function importRecipeFromUrl() {
    if (!recipeUrl.trim()) return;
    setRecipeLoading(true); setRecipeError(""); setRecipeResult(null);
    try {
      const r = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-sonnet-4-20250514", max_tokens:800,
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
  const Pill = ({label,color,tiny}) => (
    <span style={{display:"inline-flex",padding:tiny?"2px 8px":"3px 10px",borderRadius:"2rem",fontSize:tiny?"0.62rem":"0.69rem",fontWeight:700,background:(color||T.sage)+"28",color:color||T.sage,letterSpacing:"0.03em",whiteSpace:"nowrap",border:`1px solid ${(color||T.sage)}45`}}>{label}</span>
  );

  const SecHead = ({emoji,title,sub,action,color}) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1rem",gap:"0.5rem"}}>
      <div style={{minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
          {emoji&&<span style={{fontSize:"1.05rem",flexShrink:0}}>{emoji}</span>}
          <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.2rem",fontWeight:700,color:color||T.textDark}}>{title}</h2>
        </div>
        {sub&&<p style={{margin:"0.22rem 0 0",color:T.textSoft,fontSize:"0.79rem",fontWeight:500}}>{sub}</p>}
      </div>
      {action&&<div style={{flexShrink:0}}>{action}</div>}
    </div>
  );

  function ModalBox({title,onClose,children,wide}){
    return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(8px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",overflowY:"auto"}}>
        <div style={{background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:"1.4rem",padding:"1.8rem",width:"100%",maxWidth:wide?600:460,boxShadow:`0 32px 100px ${T.cardShadow}`,margin:"auto"}}>
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
  function PersonPill({name, people, T}) {
    const pc = people.find(p=>p.name===name);
    const color = pc?.color || T.textFaint;
    return (
      <span style={{display:"inline-flex",alignItems:"center",gap:"4px",background:color+"22",color,borderRadius:"2rem",padding:"2px 8px",fontSize:"0.65rem",fontWeight:700,border:"1px solid "+color+"50"}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:color,flexShrink:0}}/>{name}
      </span>
    );
  }

  // ── Anchor Check Item — checkable row with fade-out + inline bell ───────────
  function AnchorCheckItem({ id, text, checked, onCheck, color, badge, bell=true, entityTitle }) {
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
          <span style={{flex:1,fontSize:"0.88rem",fontWeight:checked?400:600,color:checked?T.textFaint:T.textDark,textDecoration:checked?"line-through":"none",lineHeight:1.35}}>{text}</span>
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
  function TaskRow({t, onToggle, onDelete, onSave, accent, showNotifFor, setShowNotifFor}) {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(t.text);
    const [notifDate, setNotifDate] = useState("");
    const [notifTime, setNotifTime] = useState("");
    const [notifNote, setNotifNote] = useState("");
    const hasNotif = notifications.some(n=>n.entityId===t.id&&!n.fired);
    const isShowingNotif = showNotifFor===t.id;
    return (
      <div style={{borderBottom:`1px solid ${T.borderSoft}`}}>
        {editing ? (
          <div style={{display:"flex",gap:"0.5rem",padding:"0.45rem 0",alignItems:"center"}}>
            <input value={editVal} onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){onSave(t.id,editVal);setEditing(false);}if(e.key==="Escape")setEditing(false);}}
              style={{...inp({flex:1,padding:"0.4rem 0.65rem",fontSize:"0.85rem"})}} autoFocus/>
            <button onClick={()=>{onSave(t.id,editVal);setEditing(false);}} style={btnP(T.sage,{padding:"0.4rem 0.7rem",fontSize:"0.78rem"})}>Save</button>
            <button onClick={()=>setEditing(false)} style={btnS({padding:"0.4rem 0.7rem",fontSize:"0.78rem"})}>Cancel</button>
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.55rem 0"}}>
              <div style={{cursor:"grab",display:"flex",flexShrink:0,opacity:0.35}}><Icon name="drag" size={14} color={T.textSoft}/></div>
              <button onClick={()=>onToggle(t.id)} style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${t.done?(accent||T.sage):T.border}`,background:t.done?(accent||T.sage):"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                {t.done&&<Icon name="check" size={12} color="#fff"/>}
              </button>
              <span style={{flex:1,fontSize:"0.87rem",color:t.done?T.textFaint:T.textDark,textDecoration:t.done?"line-through":"none",fontWeight:t.done?400:600}}>
                {t.carried&&<span style={{fontSize:"0.64rem",color:T.sand,fontWeight:700,marginRight:"0.3rem"}}>↩</span>}
                {t.text}
              </span>
              {t.person&&<Pill label={t.person} color={people.find(p=>p.name===t.person)?.color||T.textSoft} tiny/>}
              {hasNotif&&<span style={{fontSize:"0.7rem"}}>🔔</span>}
              <button onClick={()=>setShowNotifFor(isShowingNotif?null:t.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex",opacity:0.5}}><Icon name="bell" size={13} color={hasNotif?T.sand:T.textSoft}/></button>
              <button onClick={()=>{setEditVal(t.text);setEditing(true);}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="edit" size={13} color={T.textSoft}/></button>
              <button onClick={()=>onDelete(t.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.textFaint}/></button>
            </div>
            {isShowingNotif&&(
              <div style={{background:T.bgAlt,border:`1px solid ${T.sand}50`,borderRadius:"0.7rem",padding:"0.75rem",marginBottom:"0.5rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.6rem"}}>
                  <Icon name="bell" size={13} color={T.sand}/>
                  <span style={{fontSize:"0.72rem",fontWeight:800,color:T.sandDark,textTransform:"uppercase",letterSpacing:"0.06em"}}>Set Reminder</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.45rem",marginBottom:"0.45rem"}}>
                  <input type="date" value={notifDate} onChange={e=>setNotifDate(e.target.value)} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
                  <input type="time" value={notifTime} onChange={e=>setNotifTime(e.target.value)} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
                </div>
                <input value={notifNote} onChange={e=>setNotifNote(e.target.value)} placeholder="Optional note…" style={{...inp({marginBottom:"0.5rem",fontSize:"0.79rem",padding:"0.35rem 0.5rem"})}}/>
                <div style={{display:"flex",gap:"0.4rem"}}>
                  <button onClick={()=>{addNotification(t.id,t.text,notifDate,notifTime,notifNote);setShowNotifFor(null);}} style={btnP(T.sand,{fontSize:"0.76rem",padding:"0.35rem 0.75rem"})}>Set Reminder</button>
                  {hasNotif&&<button onClick={()=>{setNotifications(p=>p.filter(n=>n.entityId!==t.id));setShowNotifFor(null);}} style={btnS({fontSize:"0.76rem",padding:"0.35rem 0.65rem",color:T.rose})}>Clear</button>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function DraggableTaskList({tasks:localTasks, setTasks:setAllTasks, accent}) {
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
  function ShopItemRow({item, onToggle, onDelete, onSave, onSetCategory, categories=[]}) {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(item.text);
    const [showPhoto, setShowPhoto] = useState(false);
    const [showCatPicker, setShowCatPicker] = useState(false);
    const hasCat = item.category && item.category !== "" && item.category !== "grocery";
    return (
      <div style={{borderBottom:`1px solid ${T.borderSoft}`}}>
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
            <div style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.44rem 0"}}>
              <button onClick={()=>onToggle(item.id)} style={{width:18,height:18,borderRadius:"0.3rem",border:`2px solid ${item.done?T.sage:T.border}`,background:item.done?T.sage:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
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
              {categories.length>0&&(
                <button onClick={()=>setShowCatPicker(v=>!v)} title="Set category" style={{background:hasCat?T.sandPale:"none",border:hasCat?`1px solid ${T.sand}55`:"none",borderRadius:"2rem",padding:hasCat?"1px 6px":"2px",cursor:"pointer",fontSize:"0.65rem",color:hasCat?T.sandDark:T.textFaint,fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>
                  {hasCat?item.category:"tag"}
                </button>
              )}
              <button onClick={()=>{setEditVal(item.text);setEditing(true);}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="edit" size={12} color={T.textSoft}/></button>
              <button onClick={()=>onDelete(item.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={12} color={T.textFaint}/></button>
            </div>
            {showCatPicker&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:"0.3rem",paddingBottom:"0.5rem",paddingLeft:"1.6rem"}}>
                {categories.map(function(c){return(
                  <button key={c} onClick={()=>{onSetCategory&&onSetCategory(item.id,c);setShowCatPicker(false);}} style={{background:item.category===c?T.sand:T.soft,border:`1px solid ${item.category===c?T.sand:T.border}`,borderRadius:"2rem",padding:"2px 9px",fontSize:"0.68rem",fontWeight:item.category===c?700:400,color:item.category===c?T.sandDark:T.textMid,cursor:"pointer",fontFamily:"inherit"}}>
                    {c}
                  </button>
                );})}
                {hasCat&&<button onClick={()=>{onSetCategory&&onSetCategory(item.id,"");setShowCatPicker(false);}} style={{background:"none",border:`1px solid ${T.rose}44`,borderRadius:"2rem",padding:"2px 9px",fontSize:"0.68rem",color:T.rose,cursor:"pointer",fontFamily:"inherit"}}>Remove</button>}
              </div>
            )}
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
  function BrainItemRow({item, color, onToggle, onDelete, onSave, onMove, bDragStart, bDragEnter, bDragEnd}) {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(item.text);
    const [moveTo, setMoveTo] = useState(false);
    return (
      <div draggable onDragStart={e=>bDragStart(e,item.id,item.bucket)} onDragEnter={()=>bDragEnter(item.id)} onDragEnd={bDragEnd} onDragOver={e=>e.preventDefault()}
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
  function AIChatPanel({onClose}) {
    const unanswered = GTK_QUESTIONS.filter(q => !aiMemory[q]);
    const todayQuestion = useRef(
      unanswered.length > 0 ? unanswered[Math.floor(Math.random() * unanswered.length)] : null
    ).current;

    const profileCtx = familyProfile
      ? `Family: ${familyProfile.parentNames}, ${familyProfile.numKids} kids (ages ${familyProfile.kidAges}), dietary: ${familyProfile.dietaryNeeds}, challenge: ${familyProfile.biggestChallenge}, fav dinner: ${familyProfile.favoriteDinner}.`
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
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          system:`You are Ripple, Anchor & Flow's warm home assistant. Be concise and encouraging. Use what you know about this family to personalise responses.\n${profileCtx}\n${memoryCtx?`What I know from past chats: ${memoryCtx}`:""}\n${appCtx}`,
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
  function TodaySnapshot() {
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
  function OnboardingWizard({onComplete}) {
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
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(16px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1.6rem",padding:"2rem 1.8rem",width:"100%",maxWidth:460,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 40px 120px "+T.cardShadow}}>
          <ProgBar/>
          {s==="welcome"&&(<div>
            <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>⚓️</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.5rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>Welcome to Anchor & Flow</div>
            <div style={{color:T.textSoft,fontSize:"0.85rem",lineHeight:1.7,marginBottom:"1rem"}}>Let's set up your home in about 2 minutes.<br/>You can always update this later.</div>
            <div style={{background:"linear-gradient(135deg,"+T.sagePale+","+T.bluePale+")",borderRadius:"0.9rem",padding:"0.9rem 1rem",fontSize:"0.82rem",color:T.textMid,lineHeight:1.8}}>
              👨‍👩‍👧 Your family &nbsp;·&nbsp; 📆 Calendar &nbsp;·&nbsp; 🍽️ Favorite meals &nbsp;·&nbsp; 🛒 Grocery &nbsp;·&nbsp; 🧠 Brain dump
            </div>
            <Btns nextLabel="Let's go →"/>
          </div>)}
          {s==="family"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>👨‍👩‍👧 Your family</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>This helps personalise everything — from meal suggestions to daily rhythms.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div><label style={lbl}>Your name</label><input value={d.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Lindsey" style={inp()} autoFocus/></div>
              <div><label style={lbl}>Partner's name (optional)</label><input value={d.partner} onChange={e=>set("partner",e.target.value)} placeholder="e.g. Jake" style={inp()}/></div>
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
              <div><label style={lbl}>Their ages</label><input value={d.kidAges} onChange={e=>set("kidAges",e.target.value)} placeholder="e.g. 7, 4, infant" style={inp()}/></div>
              <div><label style={lbl}>Names (optional)</label><input value={d.kidNames} onChange={e=>set("kidNames",e.target.value)} placeholder="e.g. Emma, Liam, baby Mia" style={inp()}/></div>
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
              <div><label style={lbl}>Meal name</label><input value={d.m1name} onChange={e=>set("m1name",e.target.value)} placeholder="e.g. Sheet Pan Chicken Fajitas" style={inp()} autoFocus/></div>
              <div><label style={lbl}>Cook time</label>
                <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                  {["10","15","20","30","45","60+"].map(t=><button key={t} onClick={()=>set("m1time",t)} style={{background:d.m1time===t?T.blue:T.white,color:d.m1time===t?"#fff":T.textMid,border:"1.5px solid "+(d.m1time===t?T.blue:T.border),borderRadius:"0.6rem",padding:"0.38rem 0.8rem",cursor:"pointer",fontSize:"0.82rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{t} min</button>)}
                </div>
              </div>
              <div><label style={lbl}>Tags (optional)</label><input value={d.m1tags} onChange={e=>set("m1tags",e.target.value)} placeholder="e.g. kid-friendly, dairy-free" style={inp()}/></div>
            </div>
            <Btns canNext={!!d.m1name} skipLabel="Skip meals"/>
          </div>)}
          {s==="meal2"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🍳 One more favourite?</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>Optional — the more I know the better I can plan.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div><label style={lbl}>Meal name</label><input value={d.m2name} onChange={e=>set("m2name",e.target.value)} placeholder="e.g. One-Pot Spaghetti" style={inp()} autoFocus/></div>
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
              <div><label style={lbl}>Item 1</label><input value={d.g1} onChange={e=>set("g1",e.target.value)} placeholder="e.g. Milk" style={inp()} autoFocus/></div>
              <div><label style={lbl}>Item 2</label><input value={d.g2} onChange={e=>set("g2",e.target.value)} placeholder="e.g. Chicken thighs" style={inp()}/></div>
            </div>
            <Btns skipLabel="Skip"/>
          </div>)}
          {s==="brain"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🧠 What's on your mind?</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>Dump it all here. Tasks, worries, ideas — we'll sort it later.</div>
            <textarea value={d.brain} onChange={e=>set("brain",e.target.value)} placeholder={"Call doctor\nPick up dry cleaning\nEmail teacher…"} rows={5} style={{...inp({resize:"none",fontSize:"0.88rem",lineHeight:1.65})}}/>
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
            <Btns nextLabel="Build my first day →" onNext={finish}/>
          </div>)}
        </div>
      </div>
    );
  }

  // ── Daily Briefing Modal ─────────────────────────────────────────────────────
  function DailyBriefingModal({onClose}) {
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
        <div style={{background:T.surface,borderRadius:"1.6rem 1.6rem 0 0",border:"1.5px solid "+T.border,padding:"1.5rem 1.4rem 2rem",maxWidth:520,width:"100%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 -12px 80px "+T.cardShadow}}>
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
  function EndOfDayReset() {
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
      fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-sonnet-4-20250514",max_tokens:300,
        system:"Generate 3-4 specific tonight prep tasks based on tomorrow. Each under 8 words. Return ONLY JSON: {\"preps\":[\"task\"]}",
        messages:[{role:"user",content:ctx||"Standard family evening."}]
      })}).then(r=>r.json()).then(d=>{
        const txt = d.content?.find(b=>b.type==="text")?.text||"{}";
        try { const p=JSON.parse(txt.replace(/```json|```/g,"").trim()); if(p.preps) setPrepItems(p.preps); } catch {}
      }).catch(()=>setPrepItems(["Pack bags for tomorrow","Check tomorrow's meals","Set out clothes","Quick house reset"])).finally(()=>setPrepLoading(false));
    },[]);

    async function closeDay() {
      if(letGo.length) setTasks(p=>p.map(t=>letGo.includes(t.id)?{...t,archived:true}:t));
      if(carry.length) setTasks(p=>p.map(t=>carry.includes(t.id)?{...t,carried:true,carriedTo:tmrName}:t));
      setClosing(true); setReflLoad(true);
      try {
        const res = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:120,
          system:"You are Ripple. Write ONE warm closing sentence under 20 words. Be specific. Make them feel seen.",
          messages:[{role:"user",content:"Done: "+(done.map(t=>t.text).join(", ")||"nothing")+". Let go: "+letGo.length+". Tomorrow: "+(tmrEvts.map(e=>e.title).join(", ")||"quiet day")+". Mode: "+flowMode}]
        })});
        const dat = await res.json();
        setRefl(dat.content?.find(b=>b.type==="text")?.text||"You showed up. That's everything.");
      } catch { setRefl("You showed up. That's everything."); }
      setReflLoad(false);
      setTomorrowNote([tmrEvts.length?"📅 "+tmrEvts[0].title:"",tmrMeal.dinner?"🍽️ "+tmrMeal.dinner:""].filter(Boolean).join(" · ")||"A fresh start.");
    }

    if(closing) return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(12px)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1.8rem",padding:"2rem",maxWidth:400,width:"100%",textAlign:"center"}}>
          <div style={{fontSize:"2.5rem",marginBottom:"0.5rem"}}>🌙</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"2rem",fontWeight:700,color:T.textDark,marginBottom:"0.5rem"}}>You made it.</div>
          {done.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:"0.3rem",justifyContent:"center",marginBottom:"0.75rem"}}>{done.map(t=><span key={t.id} style={{background:T.sagePale,color:T.sageDark,borderRadius:"2rem",padding:"0.2rem 0.65rem",fontSize:"0.73rem",fontWeight:600}}>✓ {t.text}</span>)}</div>}
          {reflLoad?<div style={{color:T.textFaint,fontSize:"0.85rem",margin:"1rem 0"}}>✨ Reflecting on your day...</div>:(
            <>
              {refl&&<div style={{fontSize:"0.88rem",fontStyle:"italic",color:T.textSoft,lineHeight:1.6,margin:"0.75rem 0",padding:"0.75rem",background:T.bgAlt,borderRadius:"0.85rem"}}>{refl}</div>}
              {tomorrowNote&&<div style={{fontSize:"0.82rem",color:T.textMid,marginBottom:"1rem",padding:"0.6rem 0.85rem",background:"linear-gradient(135deg,"+T.lavPale+","+T.bluePale+")",borderRadius:"0.85rem"}}><span style={{fontWeight:700,fontSize:"0.68rem",textTransform:"uppercase",color:T.lavender}}>Tomorrow · </span>{tomorrowNote}</div>}
              <button onClick={()=>{setShowEndOfDay(false);setDayClosed(true);}} style={{...btnP(T.sage,{width:"100%",padding:"0.85rem",fontSize:"0.92rem",borderRadius:"1rem"})}}>Close my day ✓</button>
            </>
          )}
        </div>
      </div>
    );

    return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(12px)",zIndex:1500,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1.4rem 1.4rem 0 0",padding:"1.25rem 1.25rem 1.5rem",maxWidth:520,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
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
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.lavender}}>Ripple Suggestions</span>
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
  function AnchorTab() {
    const [newTask,setNewTask]   = useState("");
    const [showFlowIn,setShowFlowIn] = useState(false);
    const [showRippleFeed,setShowRippleFeed] = useState(false);
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
        `Upcoming events next 7 days: ${upcomingEvts.map(e=>{const d=new Date(e.date+"T12:00:00");const dayName=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];return dayName+" "+e.date.slice(5)+" "+(e.time||"")+" "+e.title;}).join(", ")||"none"}`,
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
          model:"claude-sonnet-4-20250514", max_tokens:700,
          system:`You are Ripple, the Anchor & Flow AI — a warm family home assistant. Suggest what to do today based on the family's real data.

RULES:
1. "brain_items": Pick 2-4 items from the brain dump that make sense TODAY. Prioritize:
   - Items matching today's theme (e.g. Errands day = pick errands items)
   - Items related to calendar events (e.g. soccer game coming up → "Wash soccer jersey")
   - Items mentioning people who appear in today's/upcoming calendar
   Use EXACT text from the brain dump. Include a short "reason" explaining why today.

2. "todos": 2-3 NEW tasks not in the brain dump. Be SPECIFIC and connected to their calendar:
   - If there's a game/practice → "Wash [name]'s jersey", "Pack snack bag for [event]"
   - If there's an appointment → "Confirm [appointment]", "Fill out paperwork for [appt]"
   - If dinner needs prep → specific prep step
   Do NOT repeat items already in tasks or brain_items.

3. "upcoming": 2 prep nudges for events in the next 7 days. Very specific:
   - "Wash soccer gear before Thursday's practice"
   - "Print directions for Monday's appointment"

Respond ONLY in valid JSON:
{"brain_items":[{"text":"exact text from brain dump","reason":"why today — 1 short phrase"}],"todos":["specific task"],"upcoming":["specific prep for upcoming event"]}`,
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

    function addQuickTask(text, tier="top3") {
      setTasks(p=>[...p,{id:uid(),text,day:TODAY_NAME,done:false,person:"",order:p.length,tier,aiG:true}]);
    }

    const greeting = hour < 12 ? "Good morning" : isEvening ? "Good evening" : "Good afternoon";
    const greetingEmoji = hour < 12 ? "🌿" : isEvening ? "🌙" : "☀️";

    // Category config for insight cards
    const CAT_CONFIG = {
      calendar: {emoji:"📅", color:T.blue,    bgColor:T.bluePale,   label:"Calendar"},
      meals:    {emoji:"🍽️", color:T.sage,    bgColor:T.sagePale,   label:"Meals"},
      brain:    {emoji:"🧠", color:T.lavender,bgColor:T.lavPale,    label:"Brain Dump"},
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
        {/* ── Hero greeting card ── */}
        <div style={{background:"linear-gradient(150deg,#1a2744,#253660 80%)",border:"none",borderRadius:"1.5rem",padding:"1.6rem 1.5rem",marginBottom:"0.85rem",boxShadow:"0 4px 24px rgba(26,39,68,0.35)"}}>
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
                {greeting}{authUser?.displayName ? ", " + authUser.displayName.split(" ")[0] : ""} {greetingEmoji}
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
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:"#3a5a50"}}>{greeting}{authUser?.displayName?", "+authUser.displayName.split(" ")[0]:""}</div>
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
        <RippleNotificationBanner />
        {/* ── Ripple Insights ── */}
        {(insightsLoading||visibleInsights.length>0)&&(
          <div style={{marginBottom:"0.9rem",background:T.surface,border:"1.5px solid "+T.borderSoft,borderRadius:"1.2rem",overflow:"hidden"}}>
            <div onClick={()=>setShowRippleFeed(p=>!p)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.85rem 1rem",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
                <span style={{fontSize:"0.85rem"}}>✦</span>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1rem",fontWeight:700,color:T.textDark}}>Ripple</span>
                {!insightsLoading&&<span style={{fontSize:"0.7rem",color:T.textFaint,marginLeft:"0.2rem"}}>({visibleInsights.length})</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                {!insightsLoading&&<button onClick={(e)=>{e.stopPropagation();setInsights(null);setInsightsBuilt(null);buildInsights();}} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.7rem",color:T.textFaint,fontFamily:"inherit"}}>refresh</button>}
                <span style={{fontSize:"0.72rem",color:T.textFaint}}>{showRippleFeed?"▲":"▼"}</span>
              </div>
            </div>
            {showRippleFeed&&(
              <div style={{padding:"0 0.75rem 0.75rem"}}>
                {insightsLoading&&<div style={{fontSize:"0.75rem",color:T.textSoft,fontStyle:"italic",padding:"0.5rem",textAlign:"center"}}>Ripple is looking at your week…</div>}
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
        {dayOpen&&!isEvening&&(
          <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          {incompletePrevTasks.length>0&&(
            <div style={{background:"linear-gradient(135deg,"+T.sandPale+","+T.surface+")",border:"1.5px solid "+T.sand+"50",borderRadius:"1rem",padding:"0.8rem 1rem",display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"}}>
              <Icon name="carry" size={14} color={T.sandDark}/>
              <span style={{fontWeight:600,color:T.sandDark,fontSize:"0.83rem",flex:1}}>{incompletePrevTasks.length} unfinished from yesterday</span>
              <button onClick={carryTasksOver} style={btnP(T.sand,{fontSize:"0.74rem",padding:"0.3rem 0.75rem",display:"flex",alignItems:"center",gap:"0.3rem"})}><Icon name="carry" size={12} color="#fff"/> Bring forward</button>
              <button onClick={()=>setTasks(p=>p.map(t=>incompletePrevTasks.find(x=>x.id===t.id)?{...t,archived:true}:t))} style={btnS({fontSize:"0.73rem",padding:"0.3rem 0.6rem",color:T.textSoft})}>Let go</button>
            </div>
          )}

            {/* Calendar today */}
            <div style={{background:T.surface,border:"1.5px solid "+T.blue+"40",borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.6rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem"}}>
                  <Icon name="cal" size={15} color={T.blueDark}/>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Today's schedule</span>
                </div>
                <button onClick={()=>goTab("calendar")} style={btnS({fontSize:"0.7rem",padding:"0.25rem 0.65rem"})}>Open</button>
              </div>
              {todayEvents.length===0
                ?<p style={{color:T.textFaint,fontSize:"0.82rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",textAlign:"center",padding:"0.3rem 0"}}>No events today — open space 🌿</p>
                :todayEvents.map(e=>(
                  <AnchorCheckItem
                    key={e.id} id={e.id}
                    text={e.title}
                    checked={checkedCalEvents.includes(e.id)}
                    onCheck={id=>setCheckedCalEvents(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}
                    color={e.color}
                    badge={e.time||"all day"}
                    entityTitle={e.title}
                  />
                ))
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

            {/* Survival mode quick-access banner */}
            {flowMode==="Survival"&&(
              <button onClick={()=>goTab("burnout")} style={{background:`linear-gradient(135deg,${T.rosePale},${T.sandPale})`,border:`2px solid ${T.rose}55`,borderRadius:"1.1rem",padding:"0.85rem 1.1rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.75rem",width:"100%",textAlign:"left",fontFamily:"inherit"}}>
                <span style={{fontSize:"1.5rem"}}>🛟</span>
                <div>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.9rem"}}>You're in Survival Mode</div>
                  <div style={{color:T.textSoft,fontSize:"0.77rem",marginTop:"0.1rem"}}>Tap to open your 3 essentials — that's all you need today.</div>
                </div>
              </button>
            )}

            {/* Today's tasks */}
            <div style={{background:T.surface,border:"3px solid "+T.blue,borderRadius:"1.2rem",padding:"1rem 1.1rem",boxShadow:"0 4px 20px "+T.blue+"14"}}>
              {people.length>1&&(
                <div style={{display:"flex",gap:"0.35rem",marginBottom:"0.65rem",flexWrap:"wrap"}}>
                  {[{id:"all",name:"Everyone"},...people].map(function(p){
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
                    {briefingLoading?<>{[0,1,2].map(i=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:T.textMid,display:"inline-block",margin:"0 1px"}}/>)}</>:<>✨ Build</>}
                  </button>
                </div>
              </div>
              {allTaskTiers.filter(t=>!t.done).length===0&&allTaskTiers.length===0&&<p style={{color:T.textFaint,fontSize:"0.8rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",textAlign:"center",padding:"0.2rem 0 0.5rem"}}>No tasks yet — tap ✨ Build or add below.</p>}
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
                <div style={{display:"flex",gap:"0.4rem",marginTop:"0.4rem"}}>
                  <input value={newTask} onChange={e=>setNewTask(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"){addQuickTask(newTask,addingTask);setNewTask("");setAddingTask(null);}if(e.key==="Escape"){setNewTask("");setAddingTask(null);}}}
                    placeholder={addingTask==="top3"?"Top priority…":"Flow task…"}
                    style={{...inp({flex:1,fontSize:"0.86rem",borderColor:addingTask==="top3"?T.blue+"70":T.sage+"70",padding:"0.6rem 0.85rem"})}} autoFocus/>
                  <button onClick={()=>{addQuickTask(newTask,addingTask);setNewTask("");setAddingTask(null);}} style={btnP(addingTask==="top3"?T.blue:T.sage,{padding:"0.58rem 0.8rem",display:"flex",alignItems:"center"})}><Icon name="plus" size={15} color="#fff"/></button>
                </div>
              )}
              {!addingTask&&(
                <div style={{display:"flex",gap:"0.4rem",marginTop:"0.55rem"}}>
                  <button onClick={()=>setAddingTask("top3")} style={btnP(T.blue,{flex:1,fontSize:"0.75rem",padding:"0.45rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.3rem"})}><Icon name="plus" size={12} color="#fff"/> Top priority</button>
                  <button onClick={()=>setAddingTask("next3")} style={{...btnS({flex:1,fontSize:"0.75rem",padding:"0.45rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.3rem",color:T.sage,borderColor:T.sage+"60"})}}><Icon name="plus" size={12} color={T.sage}/> Flow task</button>
                </div>
              )}
            </div>

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
                    <span style={{fontSize:"0.65rem",fontWeight:700,color:T.lavender,background:T.lavender+"18",borderRadius:"2rem",padding:"1px 7px"}}>{notYetTasks.length} from brain dump</span>
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

            {/* Brain dump items for today — hidden in Survival mode */}
            {flowMode!=="Survival"&&!aiLoading&&aiSuggestions?.brain_items?.length>0&&(
              <div style={{background:"linear-gradient(135deg,"+T.sagePale+","+T.surface+")",border:"1.5px solid "+T.sage+"45",borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem",marginBottom:"0.6rem"}}>
                  <span style={{fontSize:"0.9rem"}}>🧠</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>From your brain dump</span>
                  {dayRhythm.theme&&<span style={{fontSize:"0.68rem",background:T.sage+"25",color:T.sageDark,fontWeight:700,padding:"2px 8px",borderRadius:"2rem"}}>{dayRhythm.emoji} {dayRhythm.theme} day</span>}
                </div>
                {aiSuggestions.brain_items.map((item,i)=>{
                  const text = typeof item==="string" ? item : item.text;
                  const reason = typeof item==="object" ? item.reason : null;
                  const brainItem = brainItems.find(b=>b.text===text&&!b.done);
                  const alreadyAdded = allTaskTiers.some(t=>t.text===text);
                  return (
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"0.55rem",padding:"0.5rem 0.65rem",background:alreadyAdded?T.sagePale:T.white,borderRadius:"0.75rem",marginBottom:"0.3rem",border:"1.5px solid "+(alreadyAdded?T.sage+"50":T.sage+"25")}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:"0.86rem",color:alreadyAdded?T.sageDark:T.textDark,fontWeight:600}}>{alreadyAdded&&"✓ "}{text}</div>
                        {reason&&<div style={{fontSize:"0.68rem",color:T.textSoft,marginTop:"0.1rem",fontStyle:"italic"}}>{reason}</div>}
                      </div>
                      {!alreadyAdded&&(
                        <button onClick={()=>{
                          addQuickTask(text,"next3");
                          // Mark as scheduled in brain dump
                          if(brainItem) setBrainItems(p=>p.map(b=>b.id===brainItem.id?{...b,scheduledDay:TODAY_NAME}:b));
                        }} style={btnP(T.sage,{fontSize:"0.7rem",padding:"0.25rem 0.65rem",flexShrink:0})}>+ Add</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* AI suggested to-dos — hidden in Survival mode */}
            {flowMode!=="Survival"&&(!aiLoading&&aiSuggestions?.todos?.length>0)&&(
              <div style={{background:T.surface,border:"1.5px solid "+T.borderSoft,borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem",marginBottom:"0.65rem"}}>
                  <span style={{fontSize:"0.9rem"}}>✨</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Suggested to-dos</span>
                </div>
                {aiLoading&&<div style={{display:"flex",gap:8,justifyContent:"center",padding:"0.75rem 0"}}>{[0,1,2].map(i=><div key={i} style={{width:9,height:9,borderRadius:"50%",background:T.sage,animation:"bounce 1.2s "+(i*0.2)+"s infinite ease-in-out"}}/>)}</div>}
                {aiSuggestions.todos.map((text,i)=>{
                  const alreadyAdded = allTaskTiers.some(t=>t.text===text);
                  const sid = "suggestion_"+i+"_"+text.slice(0,10);
                  return alreadyAdded
                    ? <AnchorCheckItem key={i} id={allTaskTiers.find(t=>t.text===text)?.id||sid} text={text} checked={allTaskTiers.find(t=>t.text===text)?.done||false}
                        onCheck={id=>setTasks(p=>p.map(x=>x.id===id?{...x,done:true}:x))}
                        color={T.sage} badge="added" entityTitle={text}/>
                    : <div key={i} style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.5rem 0.65rem",background:T.bgAlt,borderRadius:"0.7rem",marginBottom:"0.3rem",border:"1px dashed "+T.borderSoft}}>
                        <span style={{flex:1,fontSize:"0.85rem",color:T.textMid,fontStyle:"italic"}}>{text}</span>
                        <button onClick={()=>addQuickTask(text,"next3")} style={btnP(T.sage,{fontSize:"0.7rem",padding:"0.25rem 0.65rem"})}>+ Add</button>
                      </div>;
                })}
              </div>
            )}

            {aiLoading&&(
              <div style={{background:T.surface,border:"1.5px solid "+T.borderSoft,borderRadius:"1.2rem",padding:"1.2rem",textAlign:"center"}}>
                <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:"0.5rem"}}>{[0,1,2].map(i=><div key={i} style={{width:9,height:9,borderRadius:"50%",background:T.sage,animation:"bounce 1.2s "+(i*0.2)+"s infinite ease-in-out"}}/>)}</div>
                <div style={{fontSize:"0.78rem",color:T.textSoft,fontStyle:"italic"}}>Looking at your brain dump and calendar…</div>
              </div>
            )}

            {/* Upcoming — prep nudges — hidden in Survival mode */}
            {flowMode!=="Survival"&&(!aiLoading&&aiSuggestions?.upcoming?.length>0)&&(
              <div style={{background:"linear-gradient(135deg,"+T.lavPale+","+T.bluePale+")",border:"1.5px solid "+T.lavender+"35",borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem",marginBottom:"0.55rem"}}>
                  <span style={{fontSize:"0.9rem"}}>👁</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Coming up — prep today</span>
                </div>
                {aiSuggestions.upcoming.map((text,i)=>{
                  const upid = "upcoming_"+i+"_"+text.slice(0,10);
                  const upAdded = allTaskTiers.some(t=>t.text===text);
                  return upAdded
                    ? <AnchorCheckItem key={i} id={allTaskTiers.find(t=>t.text===text)?.id||upid} text={text}
                        checked={allTaskTiers.find(t=>t.text===text)?.done||false}
                        onCheck={id=>setTasks(p=>p.map(x=>x.id===id?{...x,done:true}:x))}
                        color={T.lavender} badge="added" entityTitle={text}/>
                    : <div key={i} style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.5rem 0.65rem",background:T.white,borderRadius:"0.7rem",marginBottom:"0.3rem",border:"1px solid "+T.lavender+"25"}}>
                        <span style={{flex:1,fontSize:"0.85rem",color:T.textMid}}>{text}</span>
                        <button onClick={()=>addQuickTask(text,"next3")} style={btnP(T.lavender,{fontSize:"0.7rem",padding:"0.25rem 0.65rem"})}>+ Add</button>
                      </div>;
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Evening wind-down panel ── */}
        {dayOpen&&isEvening&&(
          <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
            {dayClosed?(
              <div style={{background:`linear-gradient(135deg,${T.sagePale},${T.bluePale})`,border:`2px solid ${T.sage}40`,borderRadius:"1.2rem",padding:"1.5rem",textAlign:"center"}}>
                <div style={{fontSize:"2rem",marginBottom:"0.4rem"}}>🌙</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.5rem"}}>Day closed</div>
                <div style={{color:T.textMid,fontSize:"0.84rem",lineHeight:1.65}}>You showed up. Rest well.</div>
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

                {/* Card 3: Ripple Suggestions */}
                <div style={{background:"rgba(123,94,167,0.06)",border:"1.5px solid "+T.lavender,borderRadius:"1rem",padding:"1rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
                    <span style={{fontSize:"1.1rem"}}>✦</span>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.lavender}}>Ripple Suggestions</span>
                  </div>
                  {eveningNudges.slice(0,4).map((n,i)=>(
                    <AnchorCheckItem key={"evening_"+i} id={"evening_"+i} text={n} checked={checkedMealItems.includes("evening_"+i)} onCheck={id=>setCheckedMealItems(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])} color={T.lavender} bell={false} entityTitle={n}/>
                  ))}
                  {eveningNudges.length===0&&<div style={{fontSize:"0.82rem",color:T.textSoft}}>✨ Generating suggestions...</div>}
                </div>

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
  function CalendarTab() {
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
    function getWeekDates(ref){const d=new Date(ref);const day=d.getDay();d.setDate(d.getDate()-day);return Array.from({length:7},(_,i)=>{const nd=new Date(d);nd.setDate(d.getDate()+i);return nd;});}
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
        <SecHead emoji="📆" title="Calendar" sub="All your events in one place"/>
        {/* Google Calendar connect banner */}
        <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.85rem"}}>
          <button onClick={()=>openAddEvent("")} style={{...btnP(T.blue,{display:"flex",alignItems:"center",gap:"0.4rem",flex:1,justifyContent:"center",padding:"0.72rem",fontSize:"0.88rem",borderRadius:"0.9rem"})}}>
            <Icon name="plus" size={15} color="#fff"/> Add Event
          </button>
          <button onClick={()=>setModal("calSync")} style={{...btnS({display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.72rem 0.9rem",fontSize:"0.82rem",borderRadius:"0.9rem",background:connectedCals.includes("google")?T.sagePale:T.bgAlt,borderColor:connectedCals.includes("google")?T.sage+"60":T.border,color:connectedCals.includes("google")?T.sageDark:T.textMid})}}>
            <Icon name="google" size={14}/>
            {connectedCals.includes("google")?"Synced":"Connect Google"}
          </button>
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
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem",padding:"0 0.15rem"}}>
          <button onClick={navPrev} style={{background:T.bgAlt,border:`1px solid ${T.border}`,cursor:"pointer",padding:7,display:"flex",borderRadius:"50%"}}><Icon name="chevL" size={18} color={T.textMid}/></button>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.05rem",color:T.textDark,textAlign:"center"}}>{navTitle()}</span>
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
                  <div key={day} onClick={()=>{const d=isSelected?null:thisDate;setSelectedDay(d);if(d)setCalViewDate(new Date(d));}}
                    style={{height:88,padding:"0.22rem 0.2rem",borderRight:isLastCol?"none":`1px solid ${T.borderSoft}`,borderBottom:`1px solid ${T.borderSoft}`,background:isSelected?T.sandPale:todayFlag?T.bluePale:T.surface,cursor:"pointer",transition:"background 0.1s",overflow:"hidden",display:"flex",flexDirection:"column",gap:"1px"}}>
                    {/* Date number */}
                    <div style={{width:22,height:22,borderRadius:"50%",background:todayFlag?T.blue:"transparent",color:todayFlag?"#fff":T.textDark,fontSize:"0.75rem",fontWeight:todayFlag?800:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginBottom:"1px"}}>{day}</div>
                    {/* Events — show up to 2, then +N more */}
                    {dayEvts.slice(0,2).map(e=>(
                      <div key={e.id} style={{background:e.color+"28",borderLeft:`2.5px solid ${e.color}`,borderRadius:"0 3px 3px 0",padding:"1px 3px",fontSize:"0.58rem",fontWeight:700,color:e.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.4}}>
                        {e.time&&<span style={{opacity:0.8,marginRight:2}}>{e.time}</span>}{e.title}
                      </div>
                    ))}
                    {dayEvts.length>2&&(
                      <div style={{fontSize:"0.56rem",color:T.textSoft,fontWeight:700,paddingLeft:"0.2rem"}}>+{dayEvts.length-2} more</div>
                    )}
                  </div>
                );
              })}
            </div>
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
                      :dayEvts.map(e=>(
                        <div key={e.id} style={{background:e.color||T.blue,borderRadius:"0.4rem",padding:"0.22rem 0.55rem",marginBottom:"0.25rem",fontSize:"0.75rem",color:"#fff",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.time?e.time+" ":""}{e.title}</div>
                      ))
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
            {eventsForDay(calViewDate.getDate(),calViewDate.getMonth(),calViewDate.getFullYear()).length===0&&<p style={{color:T.textFaint,fontSize:"0.83rem",fontWeight:600,textAlign:"center",padding:"1rem 0"}}>No events — enjoy the open space 🌿</p>}
            {eventsForDay(calViewDate.getDate(),calViewDate.getMonth(),calViewDate.getFullYear()).map(e=>(
              <div key={e.id} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.7rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.18rem",flexShrink:0,minWidth:44}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:e.color,marginTop:3}}/>
                  {e.time?<span style={{fontSize:"0.74rem",fontWeight:800,color:e.color}}>{e.time}</span>:<span style={{fontSize:"0.68rem",color:T.textFaint,fontWeight:600}}>all day</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.9rem"}}>{e.title}</div>
                  {e.colorLabel&&<div style={{fontSize:"0.66rem",color:e.color,fontWeight:700,marginTop:"0.1rem"}}>{calColorLabels[e.color]||e.colorCustom?.trim()||e.colorLabel}</div>}
                  {e.note&&<div style={{color:T.textMid,fontSize:"0.78rem",marginTop:"0.28rem",fontStyle:"italic"}}>📝 {e.note}</div>}
                  {notifications.some(n=>n.entityId===e.id)&&<div style={{color:T.sand,fontSize:"0.72rem",fontWeight:600,marginTop:"0.2rem"}}>🔔 Reminder set</div>}
                </div>
                <div style={{display:"flex",gap:"0.25rem",flexShrink:0}}>
                  <button onClick={()=>setShowCalNotif(showCalNotif===e.id?null:e.id)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="bell" size={13} color={T.sand}/></button>
                  <button onClick={()=>openEditEvent(e)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="edit" size={13} color={T.textMid}/></button>
                  <button onClick={()=>setCalEvents(p=>p.filter(x=>x.id!==e.id))} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
                </div>
              </div>
            ))}
            {showCalNotif&&(
              <div style={{background:T.bgAlt,border:`1px solid ${T.sand}50`,borderRadius:"0.8rem",padding:"0.85rem",marginTop:"0.5rem"}}>
                <p style={{fontSize:"0.75rem",fontWeight:700,color:T.sandDark,marginBottom:"0.6rem"}}>🔔 Set reminder</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.45rem",marginBottom:"0.45rem"}}>
                  <input type="date" value={cnd} onChange={e=>setCnd(e.target.value)} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
                  <input type="time" value={cnt} onChange={e=>setCnt(e.target.value)} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
                </div>
                <input value={cnn} onChange={e=>setCnn(e.target.value)} placeholder="Note…" style={{...inp({marginBottom:"0.5rem",padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}}/>
                <button onClick={()=>{const ev=calEvents.find(e=>e.id===showCalNotif);if(ev)addNotification(ev.id,ev.title,cnd,cnt,cnn);setShowCalNotif(null);}} style={btnP(T.sand,{fontSize:"0.76rem",padding:"0.35rem 0.75rem"})}>Set Reminder</button>
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
            :eventsForDay(selectedDay.getDate()).map(e=>(
              <div key={e.id} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.65rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.18rem",flexShrink:0,minWidth:38}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:e.color,marginTop:3}}/>
                  <span style={{fontSize:"0.54rem",fontWeight:700,color:e.color,whiteSpace:"nowrap",textAlign:"center"}}>{calColorLabels[e.color]||e.colorCustom?.trim()||e.colorLabel||""}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem"}}>{e.title}</div>
                  {e.time&&<div style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500,marginTop:"0.1rem"}}>⏰ {e.time}</div>}
                  {e.note&&<div style={{color:T.textMid,fontSize:"0.79rem",marginTop:"0.35rem",lineHeight:1.5,fontStyle:"italic"}}>📝 {e.note}</div>}
                </div>
                <div style={{display:"flex",gap:"0.25rem",flexShrink:0}}>
                  <button onClick={()=>openEditEvent(e)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="edit" size={13} color={T.textMid}/></button>
                  <button onClick={()=>setCalEvents(p=>p.filter(x=>x.id!==e.id))} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
                </div>
              </div>
            ))}
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
  function WeeklyTab() {
    const [newTaskText,setNewTaskText]=useState("");
    const [taskDay,setTaskDay]=useState(TODAY_NAME);
    const [taskPerson,setTaskPerson]=useState("");
    const [editingDay,setEditingDay]=useState(null);
    const [editForm,setEditForm]=useState({theme:"",emoji:"",desc:""});
    const DAY_COLORS=[T.blue,T.sage,T.sand,T.rose,T.lavender,T.blue,T.sage];
    function openEditDay(day){setEditingDay(day);setEditForm({...rhythm[day]});}
    function saveEditDay(){setRhythm(p=>({...p,[editingDay]:{...editForm}}));setEditingDay(null);}
    function applyPreset(preset){if(preset.theme==="Custom"){setEditForm(p=>({...p,emoji:preset.emoji}));return;}setEditForm({theme:preset.theme,emoji:preset.emoji,desc:preset.desc});}
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
        <SecHead emoji="📅" title="Weekly Rhythm" sub="Your week at a glance"/>
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
            <div style={{...card({background:T.bluePale,border:`2px solid ${T.blue}55`})}}>
          <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
            <input value={newTaskText} onChange={e=>setNewTaskText(e.target.value)} placeholder="Add a task…" style={{...inp({flex:1,minWidth:120})}}/>
            <select value={taskDay} onChange={e=>setTaskDay(e.target.value)} style={{...inp({width:"auto",flex:"none"})}}>
              {[...MEAL_DAYS,"Daily"].map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            <select value={taskPerson} onChange={e=>setTaskPerson(e.target.value)} style={{...inp({width:"auto",flex:"none"})}}>
              <option value="">Anyone</option>
              {people.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <button onClick={()=>{if(newTaskText.trim()){var nid=uid();setTasks(p=>[...p,{id:nid,text:newTaskText.trim(),day:taskDay,done:false,person:taskPerson,fromBoard:true}]);setBrainItems(p=>[...p,{id:uid(),text:newTaskText.trim(),cat:"uncategorized",done:false,scheduledDay:taskDay,assignedTo:taskPerson||null,linkedTaskId:nid}]);setNewTaskText("");}}} style={btnP(T.blue)}>Add</button>
          </div>
        </div>
        {weekSubTab==="tasks"&&[...MEAL_DAYS,"Daily"].map(function(day,di){
          var dayTasks=tasks.filter(function(t){return t.day===day&&!t.archived;});
          var dr=rhythm[day];var accent=DAY_COLORS[di%DAY_COLORS.length];
          var linkedTaskIds=dayTasks.filter(function(t){return t.fromBrain||t.brainId;}).map(function(t){return t.brainId||t.linkedTaskId;});
          var brainQueued=brainItems.filter(function(b){return b.scheduledDay===day&&!b.done&&!linkedTaskIds.includes(b.id);});
          var hasContent=dayTasks.length>0||brainQueued.length>0;
          return (
            <div key={day} style={{...card({borderLeft:"4px solid "+(day===TODAY_NAME?accent:T.borderSoft)})}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:hasContent?"0.75rem":"0.1rem"}}>
                <span style={{fontSize:"1rem"}}>{(dr&&dr.emoji)||"📋"}</span>
                <span style={{fontWeight:700,color:day===TODAY_NAME?accent:T.textDark,fontSize:"0.92rem"}}>{day}</span>
                {dr&&dr.theme&&<span style={{color:T.textSoft,fontSize:"0.76rem",fontWeight:500}}>{"· "+dr.theme}</span>}
                <div style={{flex:1}}/>
                {brainQueued.length>0&&<span style={{fontSize:"0.62rem",fontWeight:700,color:T.lavender,background:T.lavender+"18",borderRadius:"2rem",padding:"1px 7px"}}>🧠 {brainQueued.length}</span>}
                {day===TODAY_NAME&&<Pill label="Today" color={accent} tiny/>}
                {day!=="Daily"&&<button onClick={()=>openEditDay(day)} style={{background:"none",border:"1px solid "+T.border,borderRadius:"0.5rem",cursor:"pointer",padding:"2px 7px",fontSize:"0.7rem",color:T.textSoft,fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.3rem"}}><Icon name="edit" size={11} color={T.textSoft}/> Edit Day</button>}
              </div>
              <DraggableTaskList tasks={dayTasks} setTasks={setTasks} accent={accent}/>
              {dayTasks.length===0&&brainQueued.length===0&&<p style={{color:T.textFaint,fontSize:"0.77rem",fontWeight:500}}>Nothing yet</p>}
              {brainQueued.length>0&&(
                <div style={{marginTop:dayTasks.length?"0.65rem":"0",padding:"0.55rem 0.65rem",background:T.lavender+"12",border:"1px dashed "+T.lavender+"55",borderRadius:"0.75rem"}}>
                  <div style={{fontSize:"0.62rem",fontWeight:800,color:T.lavender,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.35rem"}}>🧠 From Brain Dump</div>
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
          <div style={{...card({background:`linear-gradient(135deg,${T.sandPale},${T.lavPale})`,border:`1.5px solid ${T.sand}55`,padding:"0.85rem 1rem",marginBottom:"0.25rem"})}}>
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
                <button onClick={()=>openEditDay(day)} style={{background:"none",border:"1px solid "+T.border,borderRadius:"0.5rem",cursor:"pointer",padding:"2px 8px",fontSize:"0.7rem",color:T.textSoft,fontWeight:700,fontFamily:"inherit",flexShrink:0}}>Edit</button>
              </div>
            </div>
          );
        })}

        {editingDay&&(
          <ModalBox title={`Edit ${editingDay}`} onClose={()=>setEditingDay(null)}>
            <div style={{marginBottom:"0.75rem"}}>
              <label style={lbl}>Quick Presets</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",marginBottom:"0.85rem"}}>
                {THEME_PRESETS.map((pr,i)=><button key={i} onClick={()=>applyPreset(pr)} style={{background:editForm.theme===pr.theme?T.blue:T.white,color:editForm.theme===pr.theme?"#fff":T.textMid,border:`1.5px solid ${editForm.theme===pr.theme?T.blue:T.border}`,borderRadius:"2rem",padding:"0.28rem 0.72rem",cursor:"pointer",fontSize:"0.75rem",fontFamily:"inherit",fontWeight:700}}>{pr.emoji} {pr.theme}</button>)}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"64px 1fr",gap:"0.65rem",marginBottom:"0.9rem"}}>
              <div><label style={lbl}>Emoji</label><input value={editForm.emoji} onChange={e=>setEditForm(p=>({...p,emoji:e.target.value}))} placeholder="🗓️" style={{...inp({textAlign:"center",fontSize:"1.2rem",padding:"0.5rem"})}}/></div>
              <div><label style={lbl}>Theme Name</label><input value={editForm.theme} onChange={e=>setEditForm(p=>({...p,theme:e.target.value}))} placeholder="e.g. Batch Cook" style={inp()}/></div>
            </div>
            <div style={{marginBottom:"1rem"}}><label style={lbl}>Description</label><input value={editForm.desc} onChange={e=>setEditForm(p=>({...p,desc:e.target.value}))} placeholder="What happens on this day…" style={inp()}/></div>
            <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
              <button onClick={()=>setEditingDay(null)} style={btnS()}>Cancel</button>
              <button onClick={saveEditDay} style={btnP(T.sage)}>Save</button>
            </div>
          </ModalBox>
        )}
      </div>
    );
  }

  // ── Meals Tab ───────────────────────────────────────────────────────────────
  function MealBankDrawer({mealType, allBank, onApply, onAddToShopping}) {
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

  function WeekTypePicker({weekTypeKey,applyWeekType,setShowWeekTypePicker,flowMode,dietaryFilters,setNextWeekMeals,setMeals,setMealSubTab,mealBankCustom,targetWeek,wtAiMeals,setWtAiMeals,wtSelected,setWtSelected}){
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
          model:"claude-sonnet-4-20250514",max_tokens:700,
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

  function MealsTab() {
    const [editDay,setEditDay]=useState(null);
    const [editMeal,setEditMeal]=useState({});
    const [showRecipes,setShowRecipes]=useState(false);
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
    function rotateMeals(){const days=[...MEAL_DAYS];const cur={...meals};const rotated={};days.forEach((day,i)=>{const prev=days[(i-1+days.length)%days.length];rotated[day]={...cur[prev]};});setMeals(rotated);}
    function applyWeekType(key){
      const preset=WEEK_TYPE_PRESETS[key];if(!preset)return;
      setWeekTypeKey(key);
      if(key==="busy"||key==="survival"){
        // Don't overwrite meals — just show AI suggestions
        return;
      }
      setMeals(p=>{const next={...p};Object.entries(preset.meals).forEach(([day,m])=>{next[day]={...(next[day]||{}),...m};});return next;});
      setShowWeekTypePicker(false);
    }

    const allBankMeals=[...MEAL_BANK_DATA,...mealBankCustom.map(m=>({...m,isCustom:true}))];const filteredBank=bankFilters.length===0?allBankMeals:allBankMeals.filter(m=>bankFilters.every(f=>(m.tags||[]).includes(f)));

    async function findRescueMeals(){
      if(!rescueInput.trim())return;
      setRescueLoading(true);setRescueResults(null);setRescueError(null);
      try{
        const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:800,
          system:`You are a helpful family meal assistant. Given ingredients on hand, suggest 3 simple family-friendly dinners.
Respond ONLY with a valid JSON array, no markdown, no explanation, nothing else.
Format: [{"name":"Meal Name","desc":"1-2 sentence description of how to make it"}]
Always return exactly 3 meals. Use only the ingredients provided plus assumed pantry staples (oil, salt, pepper, water).`,
          messages:[{role:"user",content:`I have: ${rescueInput}. What can I make for dinner tonight? Reply with only the JSON array.`}]
        })});
        if(!r.ok){
          const errText=await r.text();
          console.error("Rescue API error:",r.status,errText);
          setRescueError("API error "+r.status+". Please try again.");
          setRescueLoading(false);return;
        }
        const d=await r.json();
        const txt=(d.content?.find(b=>b.type==="text")?.text||"").trim();
        if(!txt){setRescueError("No response from AI. Please try again.");setRescueLoading(false);return;}
        // Extract JSON array robustly — find the first [ ... ] block
        const match=txt.match(/\[[\s\S]*\]/);
        if(!match){console.error("No JSON array found in:",txt);setRescueError("Unexpected response. Please try again.");setRescueLoading(false);return;}
        const parsed=JSON.parse(match[0]);
        if(!Array.isArray(parsed)||parsed.length===0){setRescueError("No meals found. Try listing a few more ingredients.");setRescueLoading(false);return;}
        setRescueResults(parsed);
      }catch(e){
        console.error("Rescue meal error:",e);
        setRescueError("Something went wrong. Check your connection and try again.");
        setRescueResults(null);
      }
      setRescueLoading(false);
    }

    const subTabs=[{id:"week",label:"This Week",emoji:"📆"},{id:"nextweek",label:"Next Week",emoji:"🗓️"},{id:"month",label:"Month",emoji:"📅"},{id:"prep",label:"Prep",emoji:"🫙"},{id:"rescue",label:"SOS",emoji:"🆘"},{id:"bank",label:"Meal Bank",emoji:"📋"}];

    return (
      <div>
        <SecHead emoji="🍽️" title="Meal Rhythm" sub="Simple meals for full weeks"
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
                {[{v:1,label:"Dinner Only",emoji:"🌙"},{v:2,label:"Lunch + Dinner",emoji:"☀️🌙"},{v:3,label:"All 3 Meals",emoji:"🌅☀️🌙"}].map(o=>(
                  <button key={o.v} onClick={()=>setMealCount(o.v)} style={{background:mealCount===o.v?T.sage:T.white,color:mealCount===o.v?"#fff":T.textMid,border:`2px solid ${mealCount===o.v?T.sage:T.border}`,borderRadius:"2rem",padding:"0.28rem 0.82rem",cursor:"pointer",fontSize:"0.74rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{o.emoji} {o.label}</button>
                ))}
              </div>

              <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",alignItems:"center"}}>
                <label style={{display:"flex",alignItems:"center",gap:"0.4rem",cursor:"pointer",fontSize:"0.78rem",fontWeight:700,color:T.sageDark}}>
                  <div onClick={()=>setMealThemeEnabled(v=>!v)} style={{width:36,height:20,borderRadius:"2rem",background:mealThemeEnabled?T.sage:T.border,position:"relative",transition:"background 0.22s",cursor:"pointer",flexShrink:0}}>
                    <div style={{position:"absolute",top:3,left:mealThemeEnabled?17:3,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.22s"}}/>
                  </div>
                  Themed days
                </label>
                {mealThemeEnabled&&<button onClick={()=>setEditingThemes(true)} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.55rem"})}><Icon name="edit" size={11} color={T.textMid}/> Edit</button>}
                <button onClick={rotateMeals} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.55rem",display:"flex",alignItems:"center",gap:"0.25rem"})}><Icon name="rotate" size={11} color={T.textMid}/> Rotate</button>
                <button onClick={()=>setShowRecipeImport(true)} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.55rem",display:"flex",alignItems:"center",gap:"0.25rem"})}><Icon name="link" size={11} color={T.textMid}/> Import</button>
                <button onClick={()=>setShowRecipes(v=>!v)} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.55rem",display:"flex",alignItems:"center",gap:"0.25rem"})}><Icon name="recipe" size={11} color={T.textMid}/> Recipes ({recipes.length})</button>
              </div>
            </div>
            {showRecipes&&(
              <div style={{...card({border:`2px solid ${T.sand}50`,background:`linear-gradient(135deg,${T.sandPale},${T.surface})`})}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.05rem",color:T.textDark}}>My Recipes</span>
                  <button onClick={()=>setShowRecipeImport(true)} style={btnP(T.sand,{fontSize:"0.74rem",padding:"0.28rem 0.7rem"})}>+ Import</button>
                </div>
                {recipes.length===0&&<p style={{color:T.textFaint,fontSize:"0.8rem",fontWeight:600,textAlign:"center"}}>No recipes yet — import from a URL or add manually.</p>}
                {recipes.map(r=>(
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
            {MEAL_DAYS.map(day=>{
              const m=meals[day]||{};const isToday=day===TODAY_NAME;const themeDay=mealThemes[day];
              const bankMatch=MEAL_BANK_DATA.find(b=>b.name.toLowerCase()===(m.dinner||"").toLowerCase());
              return (
                <div key={day} style={{...card({borderLeft:`4px solid ${isToday?T.sage:T.borderSoft}`,background:isToday?`linear-gradient(to right,${T.sagePale},${T.surface})`:T.surface})}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.65rem"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,color:isToday?T.sageDark:T.textDark,fontSize:"0.93rem"}}>{day}</span>
                      {isToday&&<Pill label="Today" color={T.sage} tiny/>}
                      {mealThemeEnabled&&themeDay&&<span style={{fontSize:"0.66rem",fontWeight:700,color:T.sand,background:T.sandPale,borderRadius:"2rem",padding:"2px 8px",border:`1px solid ${T.sand}35`}}>{themeDay.emoji} {themeDay.theme}</span>}
                    </div>
                    <div style={{display:"flex",gap:"0.35rem"}}>
                      {isToday&&m.dinner&&<button onClick={()=>setMealSubTab("tonight")} style={btnP(T.sage,{fontSize:"0.7rem",padding:"0.26rem 0.6rem"})}>🌙 Tonight</button>}
                      <button onClick={()=>openEdit(day)} style={btnS({padding:"0.28rem 0.7rem",fontSize:"0.74rem",display:"flex",alignItems:"center",gap:"0.25rem"})}><Icon name="edit" size={11} color={T.textMid}/> Edit</button>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:`repeat(${MEALS_TO_SHOW.length},1fr)`,gap:"0.45rem"}}>
                    {MEALS_TO_SHOW.map(meal=>(
                      <div key={meal} style={{background:T.white,borderRadius:"0.65rem",padding:"0.58rem 0.7rem",border:`1.5px solid ${T.borderSoft}`}}>
                        <div style={{fontSize:"0.6rem",color:T.textMid,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:800,marginBottom:"0.18rem"}}>{meal}</div>
                        <div style={{fontSize:"0.82rem",color:m[meal]?T.textDark:T.textFaint,fontWeight:m[meal]?700:400,marginBottom:"0.3rem"}}>{m[meal]||"—"}</div>
                        <MealBankDrawer mealType={meal} allBank={[...MEAL_BANK_DATA,...mealBankCustom].slice().sort(function(a,b){return a.name.localeCompare(b.name);})} onApply={function(mb){setMeals(function(p){var nd={...p};nd[day]={...(p[day]||{})};nd[day][meal]=mb.name;return nd;});}} onAddToShopping={addIngredientToShopping}/>
                      </div>
                    ))}
                  </div>
                  {bankMatch&&(
                    <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginTop:"0.55rem",alignItems:"center"}}>
                      <span style={{fontSize:"0.65rem",color:T.textSoft,fontWeight:600}}>⏱ {bankMatch.time} min · 🧹 {bankMatch.cleanup}</span>
                      {(bankMatch.tags||[]).slice(0,3).map(tag=>{const tf=MEAL_TAG_FILTERS.find(t=>t.id===tag);return tf?<span key={tag} style={{fontSize:"0.62rem",color:T.sage,background:T.sagePale,borderRadius:"2rem",padding:"1px 7px",fontWeight:600,border:`1px solid ${T.sage}30`}}>{tf.emoji} {tf.label}</span>:null;})}
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
                {[{v:1,label:"Dinner Only",emoji:"🌙"},{v:2,label:"Lunch + Dinner",emoji:"☀️🌙"},{v:3,label:"All 3 Meals",emoji:"🌅☀️🌙"}].map(o=>(
                  <button key={o.v} onClick={()=>setNextWeekMealCount(o.v)} style={{background:nextWeekMealCount===o.v?T.blue:T.white,color:nextWeekMealCount===o.v?"#fff":T.textMid,border:`2px solid ${nextWeekMealCount===o.v?T.blue:T.border}`,borderRadius:"2rem",padding:"0.28rem 0.82rem",cursor:"pointer",fontSize:"0.74rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{o.emoji} {o.label}</button>
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
                        <input key={day+meal+(m[meal]||"")} defaultValue={m[meal]||""} onBlur={function(e){var v=e.target.value;setNextWeekMeals(function(p){var nd={...p};nd[day]={...(p[day]||{})};nd[day][meal]=v;return nd;});}} placeholder="—" style={{...inp({padding:"0.28rem 0.45rem",fontSize:"0.8rem",border:"none",background:"transparent",width:"100%"})}}/>
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
          function saveMonthMeals(d){try{localStorage.setItem(monthKey,JSON.stringify(d));}catch{}}
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
            {bankInnerTab==="meals"&&(
              <div>
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
                      <input value={newBankMeal.name} onChange={function(e){setNewBankMeal(function(p){return{...p,name:e.target.value};});}} placeholder="e.g. Hamburgers" style={inp()} autoFocus/>
                    </div>
                    <div style={{marginBottom:"0.85rem"}}>
                      <label style={lbl}>Notes (optional)</label>
                      <textarea value={newBankMeal.notes} onChange={function(e){setNewBankMeal(function(p){return{...p,notes:e.target.value};});}} placeholder="Any notes, variations, family preferences…" style={{...inp({height:65,resize:"none"})}}/>
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
            )}

            {/* ── RECIPES inner tab ── */}
            {bankInnerTab==="recipes"&&<RecipesTab
              recipes={recipes}
              onSaveRecipe={function(r){setRecipes(function(p){return[...p,r];});}}
              onDeleteRecipe={function(id){setRecipes(function(p){return p.filter(function(x){return x.id!==id;});});}}
              onEditTags={function(id,tags){setRecipes(function(p){return p.map(function(r){return r.id===id?{...r,tags}:r;});});}}
              onAddToShopping={addIngredientToShopping}
              collapseAfterAdd={true}
              onAddToMealBank={function(name,tags,ingredients){
                var already=[...MEAL_BANK_DATA,...mealBankCustom].some(function(x){return x.name.toLowerCase()===name.trim().toLowerCase();});
                if(!already){setMealBankCustom(function(p){return[...p,{id:"r"+Date.now(),name:name.trim(),tags:tags||[],notes:"",ingredients:ingredients||[],isCustom:true}];});}
              }}
            />}
          </div>
        )}

        {mealSubTab==="prep"&&(function(){
          var [prepAiTips,setPrepAiTips]=React.useState(null);
          var [prepAiLoading,setPrepAiLoading]=React.useState(false);
          var [prepAiError,setPrepAiError]=React.useState("");
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
                model:"claude-sonnet-4-20250514",max_tokens:800,
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
                  <input value={editMeal[m]||""} onChange={e=>setEditMeal(p=>({...p,[m]:e.target.value}))} placeholder={`${m[0].toUpperCase()+m.slice(1)}…`} style={{...inp({flex:1})}}/>
                  {recipes.length>0&&<select onChange={e=>{if(e.target.value){const r=recipes.find(x=>x.id===e.target.value);if(r)setEditMeal(p=>({...p,[m]:r.name}));e.target.value=""}}} style={{...inp({width:"auto",flex:"none",fontSize:"0.74rem"})}}>
                    <option value="">From recipes…</option>
                    {recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>}
                  <MealBankDrawer mealType={m} allBank={[...MEAL_BANK_DATA,...mealBankCustom].slice().sort(function(a,b){return a.name.localeCompare(b.name);})} onApply={function(meal){setEditMeal(function(p){return {...p,[m]:meal.name};});}} onAddToShopping={addIngredientToShopping}/>
                </div>
              </div>
            ))}
            <div style={{marginBottom:"0.9rem"}}><label style={lbl}>Notes</label><textarea value={editMeal.notes||""} onChange={e=>setEditMeal(p=>({...p,notes:e.target.value}))} placeholder="Dietary notes, prep reminders…" style={{...inp({height:65,resize:"none"})}}/></div>
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
                <input value={addToBankMealName} onChange={function(e){setAddToBankMealName(e.target.value);}} placeholder="Meal name (e.g. Hamburgers)" style={{...inp({flex:1,fontSize:"0.82rem",background:T.white})}}/>
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
  function ShoppingTab(){
    const lastStore = useSaved("lastUsedStore", stores[0]);
    const[newItem,setNewItem]=useState("");
    const[newStore,setNewStore]=useState(lastStore[0]||stores[0]);
    const shopInputRef=useRef(null);
    const[addingStore,setAddingStore]=useState(false);
    const[newStoreName,setNewStoreName]=useState("");
    const[isListening,setIsListening]=useState(false);
    const[voiceStatus,setVoiceStatus]=useState("");
    const[isAnalyzingPhoto,setIsAnalyzingPhoto]=useState(false);
    const[photoStatus,setPhotoStatus]=useState("");
    const[editingStoreName,setEditingStoreName]=useState(null);
    const[editStoreVal,setEditStoreVal]=useState("");
    const[inlineStore,setInlineStore]=useState(null);
    const[inlineText,setInlineText]=useState("");
    const[isAutoCategorizing,setIsAutoCategorizing]=useState(false);
    const[autoCatStatus,setAutoCatStatus]=useState("");
    const[editingCategories,setEditingCategories]=useState(false);
    const[newCatName,setNewCatName]=useState("");
    const[collapsedCats,setCollapsedCats]=useState({});
    const recognitionRef=useRef(null);
    const photoInputRef=useRef(null);
    const STORE_COLORS=[T.blue,T.sage,T.sand,T.rose,T.lavender,"#e8a838","#7ab8a8","#c878a8"];
    function toggleCollapse(store){setCollapsedStores(p=>({...p,[store]:!p[store]}));}
    function toggleCatCollapse(key){setCollapsedCats(p=>({...p,[key]:!p[key]}));}
    function addItem(text,store,photoUrl){
      if(!text.trim())return;
      var s=store||newStore;
      setShoppingItems(p=>[...p,{id:uid(),text:text.trim(),store:s,done:false,photo:photoUrl||null,category:""}]);
      setNewItem("");lastStore[1](s);setNewStore(s);
    }
    function addStore(){if(!newStoreName.trim())return;const ns=newStoreName.trim();setStores(p=>[...p,ns]);setNewStore(ns);lastStore[1](ns);setNewStoreName("");setAddingStore(false);}
    function renameStore(oldName,newName){
      if(!newName.trim()||newName===oldName){setEditingStoreName(null);return;}
      setStores(p=>p.map(s=>s===oldName?newName.trim():s));
      setShoppingItems(p=>p.map(i=>i.store===oldName?{...i,store:newName.trim()}:i));
      if(newStore===oldName)setNewStore(newName.trim());
      setEditingStoreName(null);
    }
    function addInlineItem(store){
      if(!inlineText.trim())return;
      setShoppingItems(p=>[...p,{id:uid(),text:inlineText.trim(),store:store,done:false,photo:null,category:""}]);
      setInlineText("");lastStore[1](store);
    }
    async function autoCategorize(){
      var uncategorized=shoppingItems.filter(function(i){return !i.category||i.category===""||i.category==="grocery";});
      if(uncategorized.length===0){setAutoCatStatus("All items already have categories!");setTimeout(()=>setAutoCatStatus(""),2500);return;}
      setIsAutoCategorizing(true);setAutoCatStatus("Categorizing "+uncategorized.length+" items…");
      try{
        var r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,system:"You are a grocery assistant. Given a list of shopping items and a list of categories, assign each item to the best category. Respond ONLY with a JSON array: [{\"id\":\"\",\"category\":\"\"}]. Use ONLY the exact category names provided. If unsure, use Other.",messages:[{role:"user",content:"Categories: "+shopCatLabels().join(", ")+"\n\nItems:\n"+uncategorized.map(function(i){return i.id+": "+i.text;}).join("\n")}]})});
        var d=await r.json();
        var txt=d.content?.find(function(b){return b.type==="text";})||{};
        var parsed=JSON.parse((txt.text||"[]").replace(/```json|```/g,"").trim());
        setShoppingItems(function(prev){var map={};parsed.forEach(function(x){map[x.id]=x.category;});return prev.map(function(i){return map[i.id]?{...i,category:map[i.id]}:i;});});
        setAutoCatStatus("✓ "+parsed.length+" items categorized");
      }catch(e){setAutoCatStatus("Could not auto-categorize. Try again.");}
      setIsAutoCategorizing(false);setTimeout(()=>setAutoCatStatus(""),3000);
    }
    const dragState=useRef({id:null,fromStore:null,clone:null,startY:0,startX:0,lastTarget:null});
    const [draggingId,setDraggingId]=useState(null);
    const [dragOverId,setDragOverId]=useState(null);
    const [dragOverStoreTarget,setDragOverStoreTarget]=useState(null);
    function pointerDown(e,itemId,fromStore){
      if(e.button===1||e.button===2) return;
      const ds=dragState.current;ds.id=itemId;ds.fromStore=fromStore;ds.startY=e.clientY;ds.startX=e.clientX;ds.lastTarget=null;
      const el=document.querySelector(`[data-shopid="${itemId}"]`);
      if(el){const rect=el.getBoundingClientRect();const clone=el.cloneNode(true);clone.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;opacity:0.85;pointer-events:none;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.18);border-radius:0.6rem;transition:none;`;clone.setAttribute("data-drag-clone","1");document.body.appendChild(clone);ds.clone=clone;}
      setDraggingId(itemId);e.preventDefault();
    }
    function pointerMove(e){
      const ds=dragState.current;if(!ds.id) return;
      if(ds.clone){ds.clone.style.left=(e.clientX-(ds.clone.offsetWidth/2))+"px";ds.clone.style.top=(e.clientY-24)+"px";}
      if(ds.clone) ds.clone.style.display="none";
      const el=document.elementFromPoint(e.clientX,e.clientY);
      if(ds.clone) ds.clone.style.display="";
      if(!el) return;
      const storeEl=el.closest("[data-shopstore]");const itemEl=el.closest("[data-shopid]");
      if(itemEl){const overId=itemEl.getAttribute("data-shopid");if(overId!==ds.id){setDragOverId(overId);setDragOverStoreTarget(null);}}
      else if(storeEl){setDragOverStoreTarget(storeEl.getAttribute("data-shopstore"));setDragOverId(null);}
      else{setDragOverId(null);setDragOverStoreTarget(null);}
    }
    function pointerUp(e){
      const ds=dragState.current;if(!ds.id){return;}
      if(ds.clone){ds.clone.remove();ds.clone=null;}
      setDraggingId(null);
      const el=document.elementFromPoint(e.clientX,e.clientY);
      let targetItemId=dragOverId;let targetStore=dragOverStoreTarget;
      if(targetItemId){const targetItem=shoppingItems.find(i=>i.id===targetItemId);if(targetItem)targetStore=targetItem.store;}
      if((targetItemId||targetStore)&&(targetItemId!==ds.id)){
        setShoppingItems(function(prev){
          const items=[...prev];const fromIdx=items.findIndex(i=>i.id===ds.id);if(fromIdx===-1){ds.id=null;return prev;}
          const [moved]=items.splice(fromIdx,1);const finalStore=targetStore||moved.store;const movedItem={...moved,store:finalStore};
          if(targetItemId){const toIdx=items.findIndex(i=>i.id===targetItemId);items.splice(toIdx,0,movedItem);}
          else{const lastInStore=items.reduce(function(acc,item,idx){return item.store===finalStore?idx:acc;},-1);items.splice(lastInStore+1,0,movedItem);}
          return items;
        });
      }
      ds.id=null;ds.fromStore=null;ds.lastTarget=null;setDragOverId(null);setDragOverStoreTarget(null);
    }
    useEffect(()=>{
      if(!draggingId) return;
      window.addEventListener("pointermove",pointerMove);window.addEventListener("pointerup",pointerUp);
      return ()=>{window.removeEventListener("pointermove",pointerMove);window.removeEventListener("pointerup",pointerUp);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[draggingId,dragOverId,dragOverStoreTarget,shoppingItems]);
    function startListening(){
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setVoiceStatus("Voice input not supported. Try Chrome.");return;}
      const recognition=new SR();recognitionRef.current=recognition;recognition.continuous=false;recognition.interimResults=true;recognition.lang="en-US";
      recognition.onstart=()=>{setIsListening(true);setVoiceStatus("Listening… say your item");};
      recognition.onresult=e=>{const transcript=Array.from(e.results).map(r=>r[0].transcript).join("");setVoiceStatus(`Heard: "${transcript}"`);if(e.results[0].isFinal){const items=transcript.split(/\band\b/i).map(s=>s.trim()).filter(Boolean);items.forEach(item=>addItem(item,newStore));setIsListening(false);setVoiceStatus(`✓ Added ${items.length} item${items.length>1?"s":""}`);setTimeout(()=>setVoiceStatus(""),2500);}};
      recognition.onerror=e=>{setIsListening(false);setVoiceStatus(e.error==="not-allowed"?"Microphone access denied.":`Error: ${e.error}`);setTimeout(()=>setVoiceStatus(""),3000);};
      recognition.onend=()=>setIsListening(false);recognition.start();
    }
    function stopListening(){recognitionRef.current?.stop();setIsListening(false);}
    async function handlePhotoUpload(e){
      const file=e.target.files?.[0];if(!file)return;
      setIsAnalyzingPhoto(true);setPhotoStatus("Analyzing photo…");
      const base64=await new Promise(res=>{const reader=new FileReader();reader.onload=()=>res(reader.result.split(",")[1]);reader.readAsDataURL(file);});
      const photoUrl=URL.createObjectURL(file);
      try{
        const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,system:`You are a grocery list assistant. Given an image, identify the grocery item and return ONLY JSON: {"name":"","category":""}. Category must be one of: ${shopCatLabels().join(", ")}. Keep name short like a grocery list item. If unclear, return {"name":"Item from photo","category":"Other"}.`,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:base64}},{type:"text",text:"What grocery item is in this photo?"}]}]})});
        const d=await r.json();const txt=d.content?.find(b=>b.type==="text")?.text||'{"name":"Item from photo","category":"Other"}';
        const parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());const itemName=parsed.name||"Item from photo";const itemCat=shopCatLabels().includes(parsed.category)?parsed.category:"";
        setShoppingItems(p=>[...p,{id:uid(),text:itemName,store:newStore,done:false,photo:photoUrl,category:itemCat}]);setPhotoStatus(`✓ Added "${itemName}" with photo`);
      }catch{setShoppingItems(p=>[...p,{id:uid(),text:"Item from photo",store:newStore,done:false,photo:photoUrl,category:""}]);setPhotoStatus("✓ Added item with photo");}
      setIsAnalyzingPhoto(false);setTimeout(()=>setPhotoStatus(""),3000);e.target.value="";
    }
    return(
      <div>
        <SecHead emoji="🛒" title="Shopping List" sub={shoppingItems.filter(function(i){return !i.done;}).length+" items remaining"}/>
        {/* Add item card */}
        <div style={{...card({background:T.sandPale,border:"2px solid "+T.sand+"55"})}}>
          <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginBottom:"0.6rem"}}>
            <input ref={shopInputRef} defaultValue="" onKeyDown={function(e){if(e.key==="Enter"&&shopInputRef.current){addItem(shopInputRef.current.value,newStore);shopInputRef.current.value="";}}} placeholder="Add item…" style={{...inp({flex:1,minWidth:120})}}/>
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
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{display:"none"}}/>
          </div>
          {(voiceStatus||photoStatus||autoCatStatus)&&(
            <div style={{background:T.white,border:"1.5px solid "+T.border,borderRadius:"0.6rem",padding:"0.45rem 0.75rem",fontSize:"0.78rem",color:T.textMid,fontWeight:600,display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.4rem"}}>
              {(isListening||isAnalyzingPhoto||isAutoCategorizing)&&<div style={{width:8,height:8,borderRadius:"50%",background:isListening?T.rose:T.sage,animation:"bounce 0.8s infinite"}}/>}
              {autoCatStatus||voiceStatus||photoStatus}
            </div>
          )}
        </div>
        {/* Edit categories toggle */}
        <div style={{marginBottom:"0.75rem"}}>
          <button onClick={function(){setEditingCategories(function(v){return !v;});}} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.74rem",color:T.textSoft,fontWeight:600,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.3rem",padding:"0.2rem 0"}}>
            <Icon name="edit" size={11} color={T.textSoft}/> {editingCategories?"Done editing":"Edit categories"}
          </button>
          {editingCategories&&(
            <div style={{background:T.white,border:"1.5px solid "+T.border,borderRadius:"0.9rem",padding:"0.85rem 1rem",marginTop:"0.4rem"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.65rem"}}>
                <span style={{fontSize:"0.74rem",color:T.textMid,fontWeight:700}}>Shopping categories</span>
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
                <input value={newCatName} onChange={function(e){setNewCatName(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter"&&newCatName.trim()){setShopCategories(function(p){return[...p,{id:newCatName.trim().toLowerCase().replace(/\s+/g,"_"),label:newCatName.trim(),emoji:"📦"}];});setNewCatName("");}}} placeholder="New category name…" style={{...inp({flex:1,fontSize:"0.8rem",padding:"0.35rem 0.6rem"})}}/>
                <button onClick={function(){if(newCatName.trim()){setShopCategories(function(p){return[...p,{id:newCatName.trim().toLowerCase().replace(/\s+/g,"_"),label:newCatName.trim(),emoji:"📦"}];});setNewCatName("");}}} style={btnP(T.sand,{padding:"0.35rem 0.75rem",fontSize:"0.78rem"})}>+ Add</button>
              </div>
            </div>
          )}
        </div>
        {/* Collapse/expand all */}
        <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.5rem",justifyContent:"flex-end"}}>
          <button onClick={function(){var all={};shopCategories.forEach(function(c){all[catLabel(c)]=true;});all["__uncat__"]=true;setCollapsedCats(all);}} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.6rem"})}>Collapse All</button>
          <button onClick={function(){setCollapsedCats({});}} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.6rem"})}>Expand All</button>
        </div>
        {/* Unified category-grouped list */}
        {(function(){
          var uncatKey="__uncat__";
          var categorized={};
          shoppingItems.forEach(function(item){
            var cat=item.category&&item.category!==""&&item.category!=="grocery"?item.category:uncatKey;
            if(!categorized[cat])categorized[cat]=[];
            categorized[cat].push(item);
          });
          var orderedCats=shopCategories.filter(function(c){var lbl=catLabel(c);return categorized[lbl]&&categorized[lbl].length>0;}).map(function(c){return catLabel(c);});
          Object.keys(categorized).forEach(function(k){if(k!==uncatKey&&!orderedCats.includes(k))orderedCats.push(k);});
          if(categorized[uncatKey]&&categorized[uncatKey].length>0)orderedCats.push(uncatKey);
          if(orderedCats.length===0)return(
            <div style={{...card({textAlign:"center",padding:"2.5rem 1rem"})}}>
              <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>🛒</div>
              <p style={{color:T.textFaint,fontSize:"0.88rem",fontWeight:600}}>Your list is empty</p>
              <p style={{color:T.textFaint,fontSize:"0.78rem",marginTop:"0.25rem"}}>Add items above, or use Auto-sort to categorize what you have.</p>
            </div>
          );
          return orderedCats.map(function(cat){
            var catItems=categorized[cat]||[];
            var isCatCollapsed=!!collapsedCats[cat];
            var isUncat=cat===uncatKey;
            var catObj=shopCategories.find(function(c){return catLabel(c)===cat;});
            var catEmj=catObj?catEmoji(catObj):"📦";
            var accent=catObj?T.blue:T.textFaint;
            var pendingCount=catItems.filter(function(i){return !i.done;}).length;
            return(
              <div key={cat} style={{...card({padding:"0",marginBottom:"0.5rem",border:"1.5px solid "+T.borderSoft})}}>
                <div onClick={function(){setCollapsedCats(function(p){return {...p,[cat]:!p[cat]};});}} style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.75rem 1rem",cursor:"pointer",userSelect:"none"}}>
                  <span style={{fontSize:"1.1rem"}}>{isUncat?"📦":catEmj}</span>
                  <span style={{fontWeight:700,color:T.textDark,fontSize:"0.9rem",flex:1}}>{isUncat?"Uncategorized":cat}</span>
                  {pendingCount>0&&<span style={{fontSize:"0.7rem",color:T.textMid,fontWeight:700,background:T.surface,borderRadius:"2rem",padding:"1px 7px"}}>{pendingCount}</span>}
                  <div style={{display:"flex",transition:"transform 0.2s",transform:isCatCollapsed?"rotate(-90deg)":"rotate(0deg)"}}><Icon name="chevD" size={15} color={T.textSoft}/></div>
                </div>
                {!isCatCollapsed&&(
                  <div style={{padding:"0 1rem 0.85rem",borderTop:"1px solid "+T.borderSoft}}>
                    {catItems.map(function(item){
                      var isBeingDragged=draggingId===item.id;
                      var isDropTarget=dragOverId===item.id;
                      return(
                        <div key={item.id} data-shopid={item.id} onPointerDown={function(e){if(e.target.closest("button,input,select,textarea,[role=button]"))return;pointerDown(e,item.id,item.store||"");}} style={{cursor:"grab",opacity:isBeingDragged?0.35:1,borderRadius:"0.5rem",outline:isDropTarget?"2px dashed "+T.blue:"none",outlineOffset:"1px",transition:"opacity 0.15s"}}>
                          <ShopItemRow item={item} categories={shopCategories}
                            onToggle={function(id){setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,done:!x.done}:x;});});}}
                            onDelete={function(id){setShoppingItems(function(p){return p.filter(function(x){return x.id!==id;});});}}
                            onSave={function(id,val){setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,text:val}:x;});});}}
                            onSetCategory={function(id,cat){setShoppingItems(function(p){return p.map(function(x){return x.id===id?{...x,category:cat}:x;});});}}
                          />
                        </div>
                      );
                    })}
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
  function HomeTab(){
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
        setEditForm(p=>{ const arr=[...p.items]; const[m]=arr.splice(fromIdx,1); arr.splice(toIdx,0,m); return {...p,items:arr}; });
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
        <SecHead emoji="🏠" title="Home Systems" sub="Rhythms that keep life running" action={<button onClick={openNew} style={{...btnP(T.sage,{display:"flex",alignItems:"center",gap:"0.4rem",fontSize:"0.8rem",padding:"0.42rem 0.85rem"})}}><Icon name="plus" size={14} color="#fff"/> Add System</button>}/>
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

  function BrainTab(){
    const [newText,setNewText] = useState("");
    const [newCat,setNewCat] = useState("errands");
    const [aiRecatLoading,setAiRecatLoading] = useState(false);
    const [patternMsg,setPatternMsg] = useState(null);
    const [patternLoading,setPatternLoading] = useState(false);
    const [activeTab,setBrainActiveTab] = useState(function(){try{var s=sessionStorage.getItem("af_brainActiveTab");if(s)return s;}catch{}return brainCats&&brainCats.length>0?brainCats[0].id:"unfiled";});
    var _setBrainActiveTab=function(v){setBrainActiveTab(v);try{sessionStorage.setItem("af_brainActiveTab",v);}catch{}};
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
      return null;
    }

    function addItem(){
      if(!newText.trim()) return;
      const cat = smartCat(newText.trim()) || (newCat!=="unfiled"?newCat:null);
      setBrainItems(p=>[...p,{id:uid(),text:newText.trim(),cat:cat||"uncategorized",done:false,scheduledDay:null,assignedTo:null}]);
      setNewText("");
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
        const res = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:"Categorize brain dump items into these categories: "+catList+", or uncategorized. Return ONLY JSON: {results:[{id,cat}]}. Use exact category IDs.",messages:[{role:"user",content:"Categorize:\n"+pending.map(b=>b.id+": "+b.text).join("\n")}]})});
        const d = await res.json();
        const txt = d.content?.find(b=>b.type==="text")?.text||"{}";
        const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim());
        if(parsed.results){ const map={}; parsed.results.forEach(r=>{map[r.id]=r.cat;}); setBrainItems(p=>p.map(b=>map[b.id]?{...b,cat:map[b.id]}:b)); }
      } catch(e){ console.error(e); }
      setAiRecatLoading(false);
    }

    React.useEffect(function(){
      const pending = brainItems.filter(b=>!b.done);
      if(pending.length>=3&&!patternMsg&&!patternLoading){
        setPatternLoading(true);
        var grouped={};
        pending.forEach(function(b){ if(!grouped[b.cat])grouped[b.cat]=[]; grouped[b.cat].push(b.text); });
        var summary=Object.entries(grouped).map(function(kv){return kv[0]+": "+kv[1].length+" items ("+kv[1].slice(0,3).join(", ")+")";}).join("\n");
        fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:150,system:"You are a home assistant. Look at these brain dump categories and notice ONE useful pattern. Be specific and actionable. Under 25 words.",messages:[{role:"user",content:summary}]})})
          .then(function(r){return r.json();})
          .then(function(d){var msg=d.content?.find(function(b){return b.type==="text";})?.text||""; if(msg)setPatternMsg(msg);})
          .catch(function(){})
          .finally(function(){setPatternLoading(false);});
      }
    },[]);

    // Derived lists
    const active = brainItems.filter(function(b){return !b.done;});
    const done = brainItems.filter(function(b){return b.done;});
    const unfiled = active.filter(function(b){return !b.cat||b.cat==="uncategorized"||!brainCats.find(function(c){return c.id===b.cat;});});

    // Build person tabs from people state
    var personTabs = people.map(function(p){ return {id:"person_"+p.id, label:p.name, initials:p.name[0].toUpperCase(), color:p.color||T.blue}; });

    // Items for current tab
    function getTabItems(){
      var items;
      if(activeTab==="unfiled") items=unfiled;
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
          onDragStart={function(){brainDragId.current=item.id;}}
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
            <button onClick={function(){setBrainItems(function(p){return p.filter(function(x){return x.id!==item.id;});});}} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:T.textFaint,padding:"0 2px",flexShrink:0}}>×</button>
          </div>
          {/* Controls row: File · Date · Initials */}
          <div style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
            <select value={item.cat||"uncategorized"} onChange={function(e){fileItem(item.id,e.target.value);}} style={{fontSize:"0.7rem",padding:"2px 4px",borderRadius:5,border:"0.5px solid "+color+"50",background:"rgba(255,255,255,0.6)",color:T.textMid,fontFamily:"inherit",cursor:"pointer"}}>
              <option value="uncategorized">📁 Unfiled</option>
              {brainCats.map(function(c){return <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>;})}
            </select>
            <select value={item.scheduledDay||""} onChange={function(e){scheduleItem(item.id,e.target.value||null);}} style={{fontSize:"0.7rem",padding:"2px 4px",borderRadius:5,border:"0.5px solid "+color+"50",background:"rgba(255,255,255,0.6)",color:T.textMid,fontFamily:"inherit",cursor:"pointer"}}>
              <option value="">📅 Date</option>
              <option value={TODAY_NAME}>Today</option>
              <option value={DAY_NAMES_SHORT[(new Date(TODAY).getDay()+1)%7]}>Tomorrow</option>
              {DAY_NAMES_SHORT.map(function(d){return <option key={d} value={d}>{d.slice(0,3)}</option>;})}
            </select>
            <div style={{flex:1}}/>
            {people.map(function(p){
              var isAssigned=item.assignedTo===p.name;
              return(
                <button key={p.id} onClick={function(){assignItem(item.id,p.name);}} style={{width:22,height:22,borderRadius:"50%",border:"none",background:isAssigned?(p.color||T.blue):"rgba(0,0,0,0.08)",color:isAssigned?"#fff":T.textMid,fontSize:"0.68rem",fontWeight:700,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",transition:"all 0.15s"}}>
                  {p.name[0].toUpperCase()}
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
        {/* AI Pattern banner */}
        {patternMsg&&(
          <div style={{background:"linear-gradient(135deg,"+T.lavPale+","+T.bluePale+")",border:"1px solid "+T.lavender+"40",borderRadius:"0.9rem",padding:"0.75rem 1rem",marginBottom:"0.85rem",display:"flex",gap:"0.6rem",alignItems:"flex-start"}}>
            <span style={{fontSize:"1rem",flexShrink:0}}>✦</span>
            <div style={{flex:1}}>
              <div style={{fontSize:"0.68rem",fontWeight:800,color:T.lavender,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>Ripple noticed</div>
              <div style={{fontSize:"0.83rem",color:T.textDark,lineHeight:1.55}}>{patternMsg}</div>
            </div>
            <button onClick={function(){setPatternMsg(null);}} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:16,flexShrink:0}}>×</button>
          </div>
        )}

        {/* Input */}
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1rem",padding:"0.85rem",marginBottom:"0.75rem"}}>
          <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.5rem"}}>
            <input value={newText} onChange={function(e){setNewText(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")addItem();}} placeholder="What's on your mind..." style={{...inp({flex:1,fontSize:"0.88rem"})}}/>
            <button onClick={addItem} disabled={!newText.trim()} style={{...btnP(T.blue,{fontSize:"0.82rem",padding:"0.5rem 0.9rem",opacity:newText.trim()?1:0.4})}}>Add</button>
          </div>
          <div style={{display:"flex",gap:"0.3rem",flexWrap:"wrap"}}>
            {brainCats.map(function(c){
              var isSel=newCat===c.id;
              return <button key={c.id} onClick={function(){setNewCat(c.id);}} style={{background:isSel?c.color:"transparent",color:isSel?"#fff":T.textMid,border:"1.5px solid "+(isSel?c.color:T.border),borderRadius:"2rem",padding:"0.18rem 0.55rem",cursor:"pointer",fontSize:"0.68rem",fontFamily:"inherit",fontWeight:isSel?700:400,transition:"all 0.12s"}}>{c.emoji} {c.label}</button>;
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
          <button onClick={function(){_setBrainActiveTab("unfiled");}} style={{background:"none",border:"none",borderBottom:activeTab==="unfiled"?"2.5px solid #c8a97a":"2.5px solid transparent",color:activeTab==="unfiled"?"#c8834a":T.textFaint,padding:"0.45rem 0.75rem",cursor:"pointer",fontSize:"0.75rem",fontWeight:activeTab==="unfiled"?700:500,fontFamily:"inherit",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"0.3rem"}}>
            📥 Unfiled
            {unfiled.length>0&&<span style={{background:"#e05c5c",color:"#fff",borderRadius:"2rem",padding:"1px 6px",fontSize:"0.65rem",fontWeight:700}}>{unfiled.length}</span>}
          </button>
          {personTabs.map(function(pt){
            var count=active.filter(function(b){var pname=people.find(function(p){return p.id===pt.id.replace("person_","");})?.name||""; return b.assignedTo===pname;}).length;
            return(
              <button key={pt.id} onClick={function(){_setBrainActiveTab(pt.id);}} style={{background:"none",border:"none",borderBottom:activeTab===pt.id?"2.5px solid "+(pt.color||T.blue):"2.5px solid transparent",color:activeTab===pt.id?(pt.color||T.blue):T.textFaint,padding:"0.45rem 0.75rem",cursor:"pointer",fontSize:"0.75rem",fontWeight:activeTab===pt.id?700:500,fontFamily:"inherit",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                {pt.initials} {pt.label}
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
            {activeTab==="unfiled"?"All items are filed ✓":"Nothing here yet"}
          </div>
        )}
        {tabItems.map(function(item){return <BrainItemRow key={item.id} item={item} catId={item.cat||"_unc"}/>;}) }

        {/* Done */}
        {done.length>0&&(
          <div style={{marginTop:"1rem",paddingTop:"0.75rem",borderTop:"1px dashed "+T.borderSoft}}>
            <div style={{fontSize:"0.78rem",color:T.textFaint,fontWeight:700,marginBottom:"0.5rem"}}>✓ Done ({done.length})</div>
            {done.map(function(item){return <BrainItemRow key={item.id} item={item} catId={item.cat||"_unc"}/>;}) }
          </div>
        )}
      </div>
    );
  }

  function BurnoutTab(){
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
        {BURNOUT_TASKS.map(t=>{const checked=burnoutChecked.includes(t.id);return(
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

  function BrainCatsEditor({brainCats, setBrainCats}) {
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

  function SettingsTab(){
    const ONBOARD_QUESTIONS=[
      {key:"parentNames",q:"What should I call you?",placeholder:"e.g. Lindsey & Jake"},
      {key:"numKids",q:"How many little ones are in your home?",placeholder:"e.g. 3"},
      {key:"kidAges",q:"What are their ages?",placeholder:"e.g. 7, 4, infant"},
      {key:"dietaryNeeds",q:"Any dietary needs I should always know?",placeholder:"e.g. Dairy-free, nut-free"},
      {key:"biggestChallenge",q:"Your biggest home management challenge?",placeholder:"e.g. Keeping up with meals"},
      {key:"favoriteDinner",q:"A dinner your family loves on repeat?",placeholder:"e.g. Tacos, pasta"},
      {key:"cookingStyle",q:"How would you describe your cooking style?",placeholder:"e.g. Quick & simple"},
    ];
    const currentQ=ONBOARD_QUESTIONS[onboardStep];
    function saveSettingsProfile() {
      setFamilyProfile(onboardAnswers);
      if (onboardAnswers.parentNames) {
        const nameParts = onboardAnswers.parentNames.split(/[&,]/).map(function(s){ return s.trim(); }).filter(Boolean);
        setPeople(function(prev) {
          const updated = [...prev];
          if (nameParts[0] && updated[0]) updated[0] = {...updated[0], name: nameParts[0]};
          if (nameParts[1] && updated[1]) updated[1] = {...updated[1], name: nameParts[1]};
          return updated;
        });
      }
      setShowOnboarding(false);
      setOnboardStep(0);
    }
    const [settingsOpen, setSettingsOpen] = useState({});
    function toggleSetting(key){ setSettingsOpen(p=>({...p,[key]:!p[key]})); }
    function SettingSection({id, title, children, defaultOpen=true}){
      const isOpen = id in settingsOpen ? settingsOpen[id] : defaultOpen;
      return (
        <div style={card()}>
          <div onClick={()=>toggleSetting(id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",userSelect:"none",marginBottom:isOpen?"0.85rem":0}}>
            <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark}}>{title}</h2>
            <div style={{display:"flex",transition:"transform 0.2s",transform:isOpen?"rotate(0deg)":"rotate(-90deg)"}}><Icon name="chevD" size={16} color={T.textSoft}/></div>
          </div>
          {isOpen&&<div>{children}</div>}
        </div>
      );
    }

    // ── local state for new member input ───────────────────────────
    const [newPersonName, setNewPersonNameLocal] = useState("");

    return(
      <div>
        <SecHead emoji="⚙️" title="Settings"/>

        {/* ── FAMILY PROFILE ─────────────────────────────────────── */}
        <SettingSection id="family" title="👤 Family Profile">
          <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.85rem"}}>
            <button onClick={()=>setShowOnboardingWizard(true)} style={btnP(T.sage,{fontSize:"0.74rem",padding:"0.3rem 0.75rem"})}>🔄 Setup wizard</button>
            <button onClick={()=>setShowOnboarding(v=>!v)} style={btnP(T.blue,{fontSize:"0.76rem",padding:"0.32rem 0.78rem"})}>{familyProfile?"Edit profile":"Set up"}</button>
          </div>

          {familyProfile&&!showOnboarding&&(
            <div style={{display:"flex",flexDirection:"column",gap:"0.32rem",marginBottom:"1rem"}}>
              {[
                ["Names",familyProfile?.parentNames],
                ["Kids",familyProfile?.numKids?`${familyProfile.numKids} (ages: ${familyProfile.kidAges||"?"})`:null],
                ["Diet",familyProfile?.dietaryNeeds],
                ["Home vibe",familyProfile?.homeVibe],
                ["Pets",familyProfile?.pets],
                ["City",familyProfile?.city],
                ["School schedule",familyProfile?.schoolSchedule],
                ["Fav dinner",familyProfile?.favoriteDinner],
              ].filter(([,v])=>v).map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:"0.5rem",alignItems:"baseline"}}>
                  <span style={{fontSize:"0.68rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.06em",minWidth:96,flexShrink:0}}>{k}</span>
                  <span style={{fontSize:"0.82rem",color:T.textDark,fontWeight:600}}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
          {!familyProfile&&!showOnboarding&&<p style={{color:T.textSoft,fontSize:"0.8rem",lineHeight:1.6,marginBottom:"0.75rem"}}>Set up your family profile to get personalised meal ideas and AI support.</p>}

          {showOnboarding&&(
            <div style={{marginTop:"0.75rem"}}>
              <div style={{width:"100%",height:4,background:T.borderSoft,borderRadius:"2rem",marginBottom:"1rem",overflow:"hidden"}}>
                <div style={{width:`${((onboardStep+1)/ONBOARD_QUESTIONS.length)*100}%`,height:"100%",background:T.blue,borderRadius:"2rem",transition:"width 0.3s"}}/>
              </div>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:600,color:T.textDark,marginBottom:"0.75rem"}}>{currentQ.q}</p>
              <input value={onboardAnswers[currentQ.key]||""} onChange={e=>setOnboardAnswers(p=>({...p,[currentQ.key]:e.target.value}))} placeholder={currentQ.placeholder} style={{...inp({marginBottom:"0.75rem"})}} autoFocus
                onKeyDown={e=>{if(e.key==="Enter"){if(onboardStep<ONBOARD_QUESTIONS.length-1){setOnboardStep(s=>s+1);}else{saveSettingsProfile();}}}}/>
              <div style={{display:"flex",gap:"0.5rem",justifyContent:"space-between"}}>
                <div style={{display:"flex",gap:"0.45rem"}}>
                  {onboardStep>0&&<button onClick={()=>setOnboardStep(s=>s-1)} style={btnS({padding:"0.5rem 1rem"})}>← Back</button>}
                  <button onClick={()=>setShowOnboarding(false)} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:"0.76rem",fontFamily:"inherit",padding:"0.5rem"}}>Skip</button>
                </div>
                <button onClick={()=>{if(onboardStep<ONBOARD_QUESTIONS.length-1){setOnboardStep(s=>s+1);}else{saveSettingsProfile();}}} style={btnP(T.blue,{padding:"0.5rem 1.2rem"})}>
                  {onboardStep<ONBOARD_QUESTIONS.length-1?"Continue →":"Save ✨"}
                </button>
              </div>
            </div>
          )}

          {/* Extra profile fields — always editable inline */}
          {!showOnboarding&&(
            <div style={{marginTop:"0.75rem",borderTop:`1px solid ${T.borderSoft}`,paddingTop:"0.75rem"}}>
              <div style={{fontSize:"0.68rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.6rem"}}>Quick details</div>
              <div style={{display:"flex",flexDirection:"column",gap:"0.45rem"}}>
                {[
                  {key:"homeVibe",placeholder:"Home vibe / values (e.g. calm, adventurous, faith-led)"},
                  {key:"pets",placeholder:"Pets (e.g. 1 dog, 2 cats)"},
                  {key:"city",placeholder:"City or region (for weather & context)"},
                  {key:"schoolSchedule",placeholder:"School schedule note (e.g. M–F 8–3, homeschool)"},
                  {key:"vehicles",placeholder:"Vehicles (e.g. 2019 Honda Pilot, minivan)"},
                ].map(function(field){return(
                  <div key={field.key} style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                    <input
                      value={(familyProfile&&familyProfile[field.key])||""}
                      onChange={function(e){setFamilyProfile(function(p){return{...(p||{}),[field.key]:e.target.value};});}}
                      placeholder={field.placeholder}
                      style={{...inp({flex:1,fontSize:"0.8rem",padding:"0.38rem 0.65rem"})}}
                    />
                  </div>
                );})}
              </div>
            </div>
          )}

          {/* Household Members — merged here */}
          {!showOnboarding&&(function(){
            var [newMemberName,setNewMemberName]=useState("");
            var [newMemberAge,setNewMemberAge]=useState("");
            var [newMemberRole,setNewMemberRole]=useState("");
            var ROLES=["Mom","Dad","Guardian","Kid","Teen","Baby","Grandparent","Roommate","Other"];
            function addMember(){
              if(!newMemberName.trim())return;
              var age=newMemberAge.trim()?parseInt(newMemberAge.trim(),10):null;
              var isMinor=age!==null&&age<18;
              setPeople(function(p){return[...p,{id:uid(),name:newMemberName.trim(),color:PC[p.length%PC.length],age:age,role:newMemberRole||null,isMinor:isMinor}];});
              setNewMemberName("");setNewMemberAge("");setNewMemberRole("");
            }
            return(
              <div style={{marginTop:"0.9rem",borderTop:`1px solid ${T.borderSoft}`,paddingTop:"0.75rem"}}>
                <div style={{fontSize:"0.68rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.55rem"}}>People living in this home</div>
                {people.filter(function(p){return p&&p.id&&p.name;}).map(function(p){
                  var isMinorFlag=p.isMinor!=null?p.isMinor:(p.age!=null&&p.age<18);
                  return(
                    <div key={p.id} style={{padding:"0.6rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                      {/* Row 1: color dot + name + age badge + role badge + delete */}
                      <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                        <div style={{width:12,height:12,borderRadius:"50%",background:p.color,flexShrink:0,marginTop:1}}/>
                        <input
                          value={p.name}
                          onChange={function(e){setPeople(function(prev){return prev.map(function(x){return x.id===p.id?{...x,name:e.target.value}:x;});});}}
                          style={{flex:1,border:"none",background:"transparent",fontSize:"0.86rem",fontWeight:600,color:T.textDark,fontFamily:"inherit",padding:"0",outline:"none",minWidth:0}}
                        />
                        {p.age!=null&&(
                          <span style={{fontSize:"0.68rem",fontWeight:700,color:isMinorFlag?T.sand:T.blue,background:isMinorFlag?T.sandPale:T.bluePale,borderRadius:"2rem",padding:"1px 7px",flexShrink:0,whiteSpace:"nowrap"}}>
                            {isMinorFlag?"Age "+p.age:"Adult"}
                          </span>
                        )}
                        {p.role&&<span style={{fontSize:"0.68rem",fontWeight:700,color:T.textSoft,background:T.surface,borderRadius:"2rem",padding:"1px 7px",flexShrink:0}}>{p.role}</span>}
                        <button onClick={function(){setPeople(function(p2){return p2.filter(function(x){return x.id!==p.id;});});}} style={{background:"none",border:"none",cursor:"pointer",padding:"2px",display:"flex",flexShrink:0}}><Icon name="trash" size={13} color={T.textFaint}/></button>
                      </div>
                      {/* Row 2: age + role edit + color */}
                      <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap",paddingLeft:"1.4rem",marginTop:"0.4rem",alignItems:"center"}}>
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={p.age!=null?p.age:""}
                          onChange={function(e){
                            var v=e.target.value;
                            var age=v===""?null:parseInt(v,10);
                            setPeople(function(prev){return prev.map(function(x){return x.id===p.id?{...x,age:age,isMinor:age!=null&&age<18}:x;});});
                          }}
                          placeholder="Age"
                          style={{...inp({width:52,fontSize:"0.75rem",padding:"0.2rem 0.4rem",textAlign:"center"})}}
                        />
                        <select
                          value={p.role||""}
                          onChange={function(e){setPeople(function(prev){return prev.map(function(x){return x.id===p.id?{...x,role:e.target.value||null}:x;});});}}
                          style={{...inp({fontSize:"0.75rem",padding:"0.2rem 0.4rem",width:"auto"})}}
                        >
                          <option value="">Role…</option>
                          {ROLES.map(function(r){return <option key={r} value={r}>{r}</option>;})}
                        </select>
                        <div style={{display:"flex",gap:"0.25rem",flexWrap:"wrap",alignItems:"center"}}>
                          {["#6A9BB5","#7a9e8e","#c4a882","#b87265","#8878b8","#7ab8a8","#c878a8","#e8a838","#6b9e6b","#4a7a9e"].map(function(c){return(
                            <button key={c} onClick={function(){setPeople(function(prev){return prev.map(function(x){return x.id===p.id?{...x,color:c}:x;});});}} style={{width:18,height:18,borderRadius:"50%",background:c,border:p.color===c?`3px solid ${T.textDark}`:`2px solid transparent`,cursor:"pointer",transition:"border 0.15s",flexShrink:0}}/>
                          );})}
                          <label title="Custom color" style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${T.border}`,background:p.color,cursor:"pointer",flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}} >
                            <input type="color" value={p.color||"#6A9BB5"} onChange={function(e){var c=e.target.value;setPeople(function(prev){return prev.map(function(x){return x.id===p.id?{...x,color:c}:x;});});}} style={{opacity:0,position:"absolute",inset:0,width:"100%",height:"100%",cursor:"pointer",border:"none",padding:0}}/>
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Add new member */}
                <div style={{marginTop:"0.75rem",background:T.surface,borderRadius:"0.85rem",padding:"0.65rem 0.75rem",border:`1px solid ${T.borderSoft}`}}>
                  <div style={{fontSize:"0.65rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.5rem"}}>Add someone</div>
                  <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.4rem"}}>
                    <input value={newMemberName} onChange={function(e){setNewMemberName(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")addMember();}} placeholder="Name" style={{...inp({flex:1,fontSize:"0.82rem",padding:"0.38rem 0.6rem"})}}/>
                    <input type="number" min={0} max={120} value={newMemberAge} onChange={function(e){setNewMemberAge(e.target.value);}} placeholder="Age" style={{...inp({width:58,fontSize:"0.82rem",padding:"0.38rem 0.5rem",textAlign:"center"})}}/>
                  </div>
                  <div style={{display:"flex",gap:"0.4rem"}}>
                    <select value={newMemberRole} onChange={function(e){setNewMemberRole(e.target.value);}} style={{...inp({flex:1,fontSize:"0.8rem",padding:"0.38rem 0.5rem"})}}>
                      <option value="">Role (optional)</option>
                      {ROLES.map(function(r){return <option key={r} value={r}>{r}</option>;})}
                    </select>
                    <button onClick={addMember} style={btnP(T.sage,{padding:"0.38rem 0.9rem",fontSize:"0.82rem"})}>Add</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </SettingSection>

        {/* ── FLOW ───────────────────────────────────────────────── */}
        <SettingSection id="flow" title="🌊 Flow" defaultOpen={false}>
          <div style={{marginBottom:"1rem"}}>
            <label style={lbl}>What should Ripple call you?</label>
            <input
              value={preferredName}
              onChange={e=>setPreferredName(e.target.value)}
              placeholder={familyProfile?.parentNames?.split(/[&,]/)[0]?.trim()||"e.g. Lindsey"}
              style={inp()}
            />
            <p style={{fontSize:"0.72rem",color:T.textFaint,marginTop:"0.3rem"}}>Used in your daily anchor greeting and AI messages.</p>
          </div>
          <div style={{marginBottom:"0.85rem"}}>
            <label style={lbl}>Greeting tone</label>
            <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
              {[
                {id:"warm",label:"Warm & encouraging",emoji:"🌿"},
                {id:"calm",label:"Calm & minimal",emoji:"🌊"},
                {id:"motivating",label:"Energising",emoji:"⚡"},
                {id:"gentle",label:"Gentle & soft",emoji:"🕊️"},
              ].map(function(tone){return(
                <button key={tone.id} onClick={function(){setFlowGreetingTone(tone.id);}} style={{padding:"0.38rem 0.8rem",borderRadius:"2rem",border:`1.5px solid ${flowGreetingTone===tone.id?T.blue:T.border}`,background:flowGreetingTone===tone.id?T.bluePale:"transparent",color:flowGreetingTone===tone.id?T.blue:T.textMid,fontSize:"0.76rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  {tone.emoji} {tone.label}
                </button>
              );})}
            </div>
          </div>
          <div>
            <label style={lbl}>Flow mode default</label>
            <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
              {["Smooth","Busy","Survival"].map(function(mode){
                var m=FM[mode];
                return(
                  <button key={mode} onClick={function(){setFlowMode(mode);}} style={{padding:"0.38rem 0.9rem",borderRadius:"2rem",border:`1.5px solid ${flowMode===mode?m.color:T.border}`,background:flowMode===mode?m.color+"22":"transparent",color:flowMode===mode?m.color:T.textMid,fontSize:"0.76rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    {m.emoji} {mode}
                  </button>
                );
              })}
            </div>
          </div>
        </SettingSection>

        {/* ── BRAIN DUMP CATEGORIES ──────────────────────────────── */}
        <SettingSection id="braincats" title="🧠 Brain Dump Categories" defaultOpen={false}>
          <BrainCatsEditor brainCats={brainCats} setBrainCats={setBrainCats}/>
        </SettingSection>

        {/* ── WEEKLY / DAY THEMES ────────────────────────────────── */}
        <SettingSection id="daythemes" title="📅 Day Themes" defaultOpen={false}>
          <p style={{fontSize:"0.78rem",color:T.textSoft,lineHeight:1.6,marginBottom:"0.85rem"}}>Give each day a focus. These themes guide Ripple's suggestions and appear across your weekly view.</p>
          {(function(){
            const [editingDayS, setEditingDayS] = useState(null);
            const [editFormS, setEditFormS] = useState({theme:"",emoji:"",desc:""});
            const DAY_COLORS_S=[T.blue,T.sage,T.sand,T.rose,T.lavender,T.blue,T.sage];
            function openEdit(day){setEditingDayS(day);setEditFormS({...(rhythm[day]||{})});}
            function saveEdit(){setRhythm(p=>({...p,[editingDayS]:{...editFormS}}));setEditingDayS(null);}
            function applyP(preset){if(preset.theme==="Custom"){setEditFormS(p=>({...p,emoji:preset.emoji}));return;}setEditFormS({theme:preset.theme,emoji:preset.emoji,desc:preset.desc});}
            return(
              <div>
                {MEAL_DAYS.map(function(day,di){
                  var dr=rhythm[day]||{};var accent=DAY_COLORS_S[di%DAY_COLORS_S.length];
                  var isToday=day===TODAY_NAME;
                  return(
                    <div key={day} style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.6rem 0.5rem",borderBottom:`1px solid ${T.borderSoft}`}}>
                      <span style={{fontSize:"1.1rem",flexShrink:0}}>{dr.emoji||"📋"}</span>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:"0.4rem"}}>
                          <span style={{fontWeight:700,color:isToday?accent:T.textDark,fontSize:"0.88rem"}}>{day}</span>
                          {isToday&&<span style={{fontSize:"0.6rem",fontWeight:800,background:accent,color:"#fff",borderRadius:"2rem",padding:"1px 6px"}}>Today</span>}
                          {dr.theme&&<span style={{fontSize:"0.76rem",color:T.textSoft,fontWeight:500}}>· {dr.theme}</span>}
                        </div>
                        {dr.desc&&<div style={{fontSize:"0.7rem",color:T.textFaint,fontStyle:"italic"}}>{dr.desc}</div>}
                      </div>
                      <button onClick={()=>openEdit(day)} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"0.5rem",cursor:"pointer",padding:"2px 8px",fontSize:"0.7rem",color:T.textSoft,fontWeight:700,fontFamily:"inherit"}}>Edit</button>
                    </div>
                  );
                })}
                {editingDayS&&(
                  <ModalBox title={`Edit ${editingDayS}`} onClose={()=>setEditingDayS(null)}>
                    <div style={{marginBottom:"0.75rem"}}>
                      <label style={lbl}>Quick Presets</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",marginBottom:"0.85rem"}}>
                        {THEME_PRESETS.map((pr,i)=><button key={i} onClick={()=>applyP(pr)} style={{background:editFormS.theme===pr.theme?T.blue:T.white,color:editFormS.theme===pr.theme?"#fff":T.textMid,border:`1.5px solid ${editFormS.theme===pr.theme?T.blue:T.border}`,borderRadius:"2rem",padding:"0.28rem 0.72rem",cursor:"pointer",fontSize:"0.75rem",fontFamily:"inherit",fontWeight:700}}>{pr.emoji} {pr.theme}</button>)}
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"64px 1fr",gap:"0.65rem",marginBottom:"0.9rem"}}>
                      <div><label style={lbl}>Emoji</label><input value={editFormS.emoji} onChange={e=>setEditFormS(p=>({...p,emoji:e.target.value}))} placeholder="🗓️" style={{...inp({textAlign:"center",fontSize:"1.2rem",padding:"0.5rem"})}}/></div>
                      <div><label style={lbl}>Theme</label><input value={editFormS.theme} onChange={e=>setEditFormS(p=>({...p,theme:e.target.value}))} placeholder="e.g. Batch Cook" style={inp()}/></div>
                    </div>
                    <div style={{marginBottom:"1rem"}}><label style={lbl}>Description</label><input value={editFormS.desc} onChange={e=>setEditFormS(p=>({...p,desc:e.target.value}))} placeholder="What happens on this day…" style={inp()}/></div>
                    <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
                      <button onClick={()=>setEditingDayS(null)} style={btnS()}>Cancel</button>
                      <button onClick={saveEdit} style={btnP(T.sage)}>Save</button>
                    </div>
                  </ModalBox>
                )}
              </div>
            );
          })()}
        </SettingSection>

        {/* ── APPEARANCE ─────────────────────────────────────────── */}
        <SettingSection id="appearance" title="🎨 Appearance" defaultOpen={false}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0.65rem"}}>
            {Object.entries(THEMES).map(([key,th])=>(
              <button key={key} onClick={()=>setThemeNameRaw(key)} style={{background:themeName===key?T.blue:T.white,color:themeName===key?"#fff":T.textDark,border:`2px solid ${themeName===key?T.blue:T.border}`,borderRadius:"0.9rem",padding:"0.9rem 0.5rem",cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",textAlign:"center"}}>
                <div style={{fontSize:"1.5rem",marginBottom:"0.32rem"}}>{th.emoji}</div>
                <div style={{fontWeight:700,fontSize:"0.82rem"}}>{th.label}</div>
              </button>
            ))}
          </div>
        </SettingSection>

        {/* ── NOTIFICATIONS ──────────────────────────────────────── */}
        <SettingSection id="notifications" title="🔔 Notifications" defaultOpen={false}>
          <p style={{color:T.textSoft,fontSize:"0.8rem",lineHeight:1.65,marginBottom:"0.85rem"}}>Anchor & Flow sends warm AI-powered check-ins throughout your day.</p>
          {[
            {time:"7:00 am",emoji:"🌅",label:"Morning anchor",desc:"Your daily agenda, tasks & events"},
            {time:"12:00 pm",emoji:"🌊",label:"Midday check-in",desc:"Progress update & encouragement"},
            {time:"3:00 pm",emoji:"🍽️",label:"Dinner heads-up",desc:"Defrost reminders & meal prep"},
            {time:"5:00 pm",emoji:"🌙",label:"Evening recap",desc:"Ripple-style day summary + tomorrow preview"},
            {time:"2hrs before",emoji:"⏰",label:"Event nudges",desc:"Smart reminders before appointments"},
          ].map((n,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.55rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
              <span style={{fontSize:"1.1rem",flexShrink:0}}>{n.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:T.textDark,fontSize:"0.85rem"}}>{n.label}</div>
                <div style={{color:T.textSoft,fontSize:"0.72rem"}}>{n.desc}</div>
              </div>
              <span style={{fontSize:"0.68rem",color:T.textSoft,fontWeight:600,flexShrink:0}}>{n.time}</span>
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.65rem 0",borderBottom:`1px solid ${T.borderSoft}`,marginTop:"0.25rem"}}>
            <span style={{fontSize:"0.85rem",fontWeight:600,color:T.textDark}}>Browser notifications</span>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              <span style={{fontSize:"0.74rem",color:notifPermission==="granted"?T.sage:T.textSoft,fontWeight:700}}>{notifPermission==="granted"?"Enabled":notifPermission==="denied"?"Blocked":"Not enabled"}</span>
              {notifPermission!=="granted"&&notifPermission!=="denied"&&<button onClick={requestNotifPermission} style={btnP(T.blue,{fontSize:"0.74rem",padding:"0.28rem 0.7rem"})}>Enable</button>}
            </div>
          </div>
          {notifPermission==="granted"&&(
            <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginTop:"0.75rem"}}>
              <button onClick={()=>{const todayTasks=tasks.filter(t=>(t.day===TODAY_NAME||t.day==="Daily")&&!t.archived);const todayMeal=(meals[TODAY_NAME]||{}).dinner;const todayEvts=calEvents.filter(e=>e.date===TODAY.toISOString().split("T")[0]);new Notification("⚓️ Your daily anchor is ready",{body:`${todayEvts.length>0?`First up: ${todayEvts[0].title}. `:""}${todayTasks.filter(t=>!t.done).length} tasks today.${todayMeal?` Dinner: ${todayMeal}.`:""}`,icon:"/favicon.svg"});}} style={btnS({fontSize:"0.73rem",padding:"0.32rem 0.75rem"})}>Preview morning</button>
              <button onClick={()=>{const done=tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&t.done&&!t.archived).length;const pending=tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.done&&!t.archived).length;new Notification("🌙 Evening recap",{body:`${done>0?`${done} things done today.`:""} ${pending>0?`${pending} still on your list.`:""} Rest up — tomorrow is a fresh start.`,icon:"/favicon.svg"});}} style={btnS({fontSize:"0.73rem",padding:"0.32rem 0.75rem"})}>Preview evening</button>
              <button onClick={()=>{setDailySummaryScheduled(null);scheduleAllDailyNotifications();}} style={btnP(T.blue,{fontSize:"0.73rem",padding:"0.32rem 0.75rem"})}>Schedule today's</button>
            </div>
          )}
          {notifications.filter(n=>!n.fired).length>0&&(
            <div style={{marginTop:"0.85rem"}}>
              <div style={{fontSize:"0.7rem",color:T.textSoft,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.35rem"}}>Upcoming reminders</div>
              {notifications.filter(n=>!n.fired).map(n=>(
                <div key={n.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.38rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                  <span style={{fontSize:"0.8rem"}}>🔔</span>
                  <span style={{flex:1,fontSize:"0.8rem",color:T.textDark,fontWeight:600}}>{n.entityTitle}</span>
                  <span style={{fontSize:"0.7rem",color:T.textSoft}}>{n.date} {n.time}</span>
                  <button onClick={()=>setNotifications(p=>p.filter(x=>x.id!==n.id))} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={11} color={T.textFaint}/></button>
                </div>
              ))}
            </div>
          )}
        </SettingSection>

        {/* ── VISIBLE SECTIONS ───────────────────────────────────── */}
        <SettingSection id="sections" title="📋 Visible Sections" defaultOpen={false}>
          <p style={{fontSize:"0.78rem",color:T.textSoft,marginBottom:"0.75rem",lineHeight:1.55}}>Hide sections you don't use. You can bring them back any time.</p>
          {TABS.filter(t=>t.id!=="settings"&&t.id!=="anchor").map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.5rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
              <span style={{fontSize:"0.87rem",color:T.textDark,fontWeight:600}}>{t.emoji} {t.label}</span>
              <button onClick={()=>{setSections(p=>{const next={...p,[t.id]:!p[t.id]};try{localStorage.setItem("af_sections",JSON.stringify(next));}catch{}window.dispatchEvent(new Event("af-sections-changed"));return next;})}} style={{width:44,height:24,borderRadius:"2rem",border:"none",cursor:"pointer",background:sections[t.id]!==false?T.sage:T.border,position:"relative",transition:"background 0.22s",flexShrink:0}}>
                <div style={{position:"absolute",top:4,left:sections[t.id]!==false?22:4,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.22s",boxShadow:"0 1px 4px rgba(0,0,0,0.18)"}}/>
              </button>
            </div>
          ))}
        </SettingSection>

        {/* ── AI MEMORY ──────────────────────────────────────────── */}
        {Object.keys(aiMemory).length>0&&(
          <SettingSection id="aimemory" title="🧠 What Ripple Knows" defaultOpen={false}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
              <p style={{fontSize:"0.78rem",color:T.textSoft,margin:0}}>Things Ripple has learned about your household from conversations.</p>
              <button onClick={()=>setAiMemory({})} style={btnS({fontSize:"0.72rem",padding:"0.24rem 0.6rem",color:T.rose})}>Clear</button>
            </div>
            {Object.entries(aiMemory).map(([q,a],i)=>(
              <div key={i} style={{padding:"0.5rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                <div style={{fontSize:"0.72rem",color:T.textSoft,fontWeight:600,marginBottom:"0.15rem"}}>{q}</div>
                <div style={{fontSize:"0.84rem",color:T.textDark,fontWeight:500}}>{a}</div>
              </div>
            ))}
          </SettingSection>
        )}

        {/* ── SIGN IN / SYNC ─────────────────────────────────────── */}
        <SettingSection id="sync" title="🔐 Sign In & Sync" defaultOpen={false}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.85rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              <Icon name="sync" size={18} color={T.blueDark}/>
            </div>
            {syncStatus==="synced"&&<span style={{fontSize:"0.72rem",color:T.sage,fontWeight:700}}>✓ Synced</span>}
            {syncStatus==="syncing"&&<span style={{fontSize:"0.72rem",color:T.sand,fontWeight:700}}>⟳ Syncing…</span>}
            {syncStatus==="error"&&<span style={{fontSize:"0.72rem",color:T.rose,fontWeight:700}}>⚠ Error</span>}
          </div>
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
                <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${T.blue},${T.sage})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{color:"#fff",fontWeight:800,fontSize:"0.9rem"}}>{((authUser?.displayName||authUser?.email||"?").charAt(0)).toUpperCase()}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem"}}>{authUser?.displayName||authUser?.email||"Signed in"}</div>
                  <div style={{color:T.textSoft,fontSize:"0.74rem"}}>{authUser?.email||""}</div>
                </div>
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
        </SettingSection>

        <div style={{...card({background:T.bluePale,border:`2px solid ${T.blue}55`,textAlign:"center",padding:"1.8rem"})}}>
          <AnchorLogo size={44} color={T.blue}/>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.3rem",fontWeight:700,color:T.textDark,marginTop:"0.65rem",letterSpacing:"0.06em"}}>ANCHOR & FLOW</div>
          <div style={{color:T.textSoft,fontSize:"0.8rem",fontStyle:"italic",marginTop:"0.15rem",fontFamily:"'Cormorant Garamond',serif"}}>A steadier home, in every season</div>
          <p style={{color:T.textMid,fontSize:"0.8rem",lineHeight:1.72,marginTop:"0.85rem",marginBottom:0}}>Data saved locally · AI powered by Claude · Native app coming soon</p>
        </div>
      </div>
    );
  }

  // ── Google Calendar Modal ────────────────────────────────────────────────────
  function GoogleCalendarModal({onClose}) {
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
  function AuthModal({onClose}) {
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
              <button onClick={()=>switchMode("signin")} style={{display:"block",marginTop:"0.4rem",background:"none",border:"none",color:T.blue,cursor:"pointer",fontSize:"0.8rem",fontFamily:"inherit",fontWeight:700,padding:0,textDecoration:"underline"}}>
                Switch to Sign In →
              </button>
            )}
          </div>
        )}
        <button onClick={handleSubmit} disabled={loading} style={btnP("linear-gradient(135deg,"+T.blue+","+T.blueDark+")",{width:"100%",padding:"0.85rem",fontSize:"0.95rem",marginBottom:"0.75rem",opacity:loading?0.7:1,cursor:loading?"wait":"pointer"})}>
          {loading ? (mode==="reset"?"Sending…":mode==="signin"?"Signing in…":"Creating account…") : mode==="reset" ? "Send Reset Email" : mode==="signin" ? "Sign In" : "Create Account"}
        </button>
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
  function HouseholdModal({onClose}) {
    const [joinCode, setJoinCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState("");
    const [hhCopied, setHhCopied] = useState(false);
    const [lastSynced, setLastSynced] = useState(null);
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
      </ModalBox>
    );
  }

  // ── Calendar Event Form Modal ────────────────────────────────────────────────
  function CalEventFormModal(){
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
                  const active=(f.repeatDates||[]).includes(n);
                  return(
                    <button key={n} onClick={()=>setF(p=>{const cur=p.repeatDates||[];return{...p,repeatDates:active?cur.filter(x=>x!==n):[...cur,n].sort((a,b)=>a-b)};})} style={{width:32,height:32,borderRadius:"0.4rem",border:"1.5px solid "+(active?T.blue:T.border),background:active?T.blue:"transparent",color:active?"#fff":T.textMid,fontSize:"0.75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                      {n}
                    </button>
                  );
                })}
              </div>
              {(f.repeatDates||[]).length>0&&<div style={{fontSize:"0.7rem",color:T.textSoft,marginTop:"0.5rem"}}>Repeats on the {(f.repeatDates||[]).map(n=>{const s=n===1?"st":n===2?"nd":n===3?"rd":"th";return n+s;}).join(", ")} of each month</div>}
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
  function SetPasswordModal() {
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
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(8px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
        <div style={{background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:"1.4rem",padding:"1.8rem",width:"100%",maxWidth:420,boxShadow:`0 32px 100px ${T.cardShadow}`}}>
          {done ? (
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:"3rem",marginBottom:"0.75rem"}}>✅</div>
              <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.5rem"}}>Password updated!</h3>
              <p style={{color:T.textSoft,fontSize:"0.84rem",marginBottom:"1.25rem"}}>Your new password is set. You can now sign in.</p>
              <button onClick={()=>{ setShowSetPassword(false); setShowAuthModal(true); }}
                style={{...btnP(T.blue,{width:"100%",padding:"0.8rem",fontSize:"0.9rem"})}}>
                Sign In Now
              </button>
            </div>
          ) : (
            <div>
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
                  onKeyDown={e=>e.key==="Enter"&&handleSetPassword()}
                  placeholder="Type it again" style={inp()}/>
              </div>
              {error&&<div style={{background:T.rosePale,border:`1.5px solid ${T.rose}50`,borderRadius:"0.65rem",padding:"0.7rem 0.85rem",marginBottom:"0.85rem",fontSize:"0.83rem",color:T.rose,fontWeight:600}}>{error}</div>}
              <button onClick={handleSetPassword} disabled={loading}
                style={{...btnP(T.blue,{width:"100%",padding:"0.85rem",fontSize:"0.95rem",opacity:loading?0.7:1})}}>
                {loading ? "Saving…" : "Set Password"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const primaryVisible=TABS.filter(t=>PRIMARY_TABS.includes(t.id)&&(!sections||sections[t.id]!==false));
  const moreVisible=TABS.filter(t=>MORE_TABS.includes(t.id)&&(t.id==="settings"||!sections||sections[t.id]!==false));
  const activeInMore=false;

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&display=swap');
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

      {/* ── In-app notification banner (iOS + fallback) ── */}
      {inAppBanner&&(
        <div onClick={()=>setInAppBanner(null)} style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:9999,maxWidth:360,width:"calc(100% - 2rem)",background:T.navy,color:"#fff",borderRadius:"1rem",padding:"0.85rem 1.1rem",boxShadow:"0 6px 28px rgba(0,0,0,0.28)",cursor:"pointer",display:"flex",gap:"0.75rem",alignItems:"flex-start",animation:"slideDown 0.3s ease"}}>
          <span style={{fontSize:"1.3rem",flexShrink:0}}>⚓️</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:"0.88rem",marginBottom:"0.2rem",fontFamily:"'Cormorant Garamond',serif"}}>{inAppBanner.title}</div>
            <div style={{fontSize:"0.79rem",opacity:0.88,lineHeight:1.4}}>{inAppBanner.body}</div>
          </div>
          <span style={{fontSize:"0.75rem",opacity:0.6,flexShrink:0,marginTop:2}}>✕</span>
        </div>
      )}
      <div style={{minHeight:"100vh",background:T.bg,paddingBottom:"5.5rem",transition:"background 0.3s"}}>
        <div style={{background:T.topBg,borderBottom:`2px solid ${T.border}`,padding:"0.75rem 1.1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,boxShadow:`0 2px 14px ${T.cardShadow}`}}>
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
              <button onClick={()=>setChatOpen(o=>!o)} title="Ask the AI" style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${T.blue},${T.blueDark})`,border:`2px solid ${T.blueLight}`,boxShadow:`0 2px 12px ${T.blue}50`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <AnchorLogo size={20} color="#fff"/>
              </button>
            </div>
            {false&&(
              <div style={{display:"flex",alignItems:"center",gap:"0.3rem",background:syncStatus==="synced"?T.sagePale:syncStatus==="syncing"?T.sandPale:T.bgAlt,border:`1.5px solid ${syncStatus==="synced"?T.sage+"50":syncStatus==="syncing"?T.sand+"50":T.borderSoft}`,borderRadius:"2rem",padding:"0.22rem 0.65rem",cursor:"pointer",display:"none"}} onClick={()=>setShowHouseholdModal(true)}>
                <span style={{fontSize:"0.65rem"}}>{syncStatus==="synced"?"✓":syncStatus==="syncing"?"⟳":"⚠"}</span>
                <span style={{fontSize:"0.65rem",fontWeight:700,color:syncStatus==="synced"?T.sage:syncStatus==="syncing"?T.sand:T.textSoft}}>Sync</span>
              </div>
            )}
          </div>
        </div>

        <div style={{maxWidth:700,margin:"0 auto",padding:"1.1rem 0.9rem 0.5rem"}}>
          {/* Only render tabs that have been visited — avoids mounting all 9 on load */}
          {["anchor","calendar","weekly","meals","shop","home","brain","burnout","settings","ai"].map(t=>{
            if(!visitedTabs.current.has(t)) return null;
            return (
              <div key={t} onClick={e=>e.stopPropagation()} className={tab===t?"fu":""} style={{display:tab===t?"block":"none"}}>
                {t==="anchor"   && <AnchorTab/>}
                {t==="calendar" && <CalendarTab/>}
                {t==="weekly"   && <WeeklyTab/>}
                {t==="meals"    && <MealsTab/>}
                {t==="shop"     && <ShoppingTab/>}
                {t==="home"     && <HomeTab/>}
                {t==="brain"    && <BrainTab/>}
                {t==="burnout"  && <BurnoutTab/>}
                {t==="settings" && <SettingsTab/>}
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
                {[{id:"tasks",label:"Tasks",emoji:"✅"},{id:"brain",label:"Brain Dump",emoji:"🧠"},{id:"shopping",label:"Shopping",emoji:"🛒"}].map(d=>(
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
      {showEndOfDay&&<EndOfDayReset/>}
      {showBriefing&&<DailyBriefingModal onClose={()=>setShowBriefing(false)}/>}
      {showSetPassword&&resetToken&&<SetPasswordModal/>
      }
      {shouldShowOnboarding&&<OnboardingWizard onComplete={()=>{setShowOnboardingWizard(false);buildDailyBriefing();}}/>}
      {showAuthModal&&<AuthModal onClose={()=>setShowAuthModal(false)}/>}
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
    function onUp() {
      document.querySelectorAll("[data-drag-clone]").forEach(el => el.remove());
      if (!ds.current.id) return;
      if (ds.current.clone) { try { ds.current.clone.remove(); } catch {} ds.current.clone = null; }
      const fromId   = ds.current.id;
      const targetId = ds.current.dragOverId;
      ds.current.id = null;
      ds.current.dragOverId = null;
      setDraggingId(null);
      setDragOverId(null);
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
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup",   onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", onVisChange);
      document.removeEventListener("scroll", onVisChange);
      // Also clean up on visibility change (tab switch, scroll cancel)
      function onVisChange() {
        if (ds.current.clone) { try { ds.current.clone.remove(); } catch {} ds.current.clone = null; }
        ds.current.id = null; ds.current.dragOverId = null;
        setDraggingId(null); setDragOverId(null);
      }
      document.addEventListener("visibilitychange", onVisChange);
      document.addEventListener("scroll", onVisChange, { passive: true });
      // Safety: remove any orphaned clone on unmount
      if (ds.current.clone) { try { ds.current.clone.remove(); } catch {} ds.current.clone = null; }
    };
  // Register once — uses refs for fresh data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataAttr]);

  return { draggingId, dragOverId, pointerDown };
}


function FlowWrapper({ onHome, onSignOut }) {
  const [, forceUpdate] = React.useReducer(x => x+1, 0);
  const activeTab = homeFlowRef.tab;
  const _setActiveTab = React.useCallback((t) => { homeFlowRef.goTab(t); forceUpdate(); window.dispatchEvent(new CustomEvent("af-set-tab", { detail: t })); }, []);
  const [sections, setSections] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("af_sections") || "null") || {anchor:true,calendar:true,weekly:true,meals:true,shop:true,home:true,brain:true,burnout:true} } catch { return {anchor:true,calendar:true,weekly:true,meals:true,shop:true,home:true,brain:true,burnout:true} }
  })
  React.useEffect(() => {
    const onStorage = () => {
      try { const s = JSON.parse(localStorage.getItem("af_sections") || "null"); if(s) setSections(s); } catch {}
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("af-sections-changed", onStorage)
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("af-sections-changed", onStorage); }
  }, [])
  const [showAnchor, setShowAnchor] = React.useState(false)
  const [vaultSection, setVaultSection] = React.useState("home")
  const NAV = [
    { id: "brain",    label: "Brain",    emoji: "🧠" },
    { id: "calendar", label: "Calendar", emoji: "📆" },
    { id: "meals",    label: "Meals",    emoji: "🍽️" },
    { id: "shop",     label: "Shopping", emoji: "🛒" },
    { id: "home",     label: "Home",     emoji: "🏡" },
    { id: "weekly",   label: "Weekly",   emoji: "📅" },
    { id: "burnout",  label: "Survival", emoji: "🛟" },
    { id: "settings", label: "Settings", emoji: "⚙️" },
  ]
  const VAULT_NAV = [
    { id: "inventory", label: "Inventory", emoji: "📦" },
    { id: "systems",   label: "Systems",   emoji: "🏠" },
    { id: "health",    label: "Health",    emoji: "🩺" },
    { id: "career",    label: "Career",    emoji: "📋" },
    { id: "subs",      label: "Subscript", emoji: "🔄", premium: true },
    { id: "gifts",     label: "Celebrate", emoji: "🎉" },
    { id: "pets",      label: "Pets",      emoji: "🐾" },
    { id: "moments",   label: "Moments",   emoji: "✨" },
    { id: "settings",  label: "Settings",  emoji: "⚙️" },
  ]
  const [anchorHidden, setAnchorHidden] = React.useState(function() {
    try { return JSON.parse(localStorage.getItem("af_anchor_hidden") || "{}") } catch { return {} }
  })
  React.useEffect(function() {
    function onAnchorStorage() {
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
      <div style={{ width: "68px", background: "#1a2744", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0 8px", gap: "2px", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 200, borderRight: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onHome} style={{ background: "none", border: "none", cursor: "pointer", marginBottom: "8px", padding: "6px 0", width: "100%", display: "flex", justifyContent: "center" }}>
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "12px", color: "#c8a97a", letterSpacing: "0.04em", lineHeight: 1.1, textAlign: "center" }}>A&F</div>
        </button>
      
        <button onClick={() => { setShowAnchor(v => !v); setVaultSection("home"); }} title="Anchor" style={{ background: showAnchor ? "rgba(200,169,122,0.25)" : "rgba(200,169,122,0.08)", border: showAnchor ? "1px solid rgba(200,169,122,0.5)" : "1px solid rgba(200,169,122,0.2)", borderRadius: "8px", cursor: "pointer", padding: "8px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", marginBottom: "2px" }}>
          <span style={{ fontSize: "15px" }}>⚓</span>
          <span style={{ fontSize: "7px", color: showAnchor ? "#c8a97a" : "rgba(200,169,122,0.5)", fontWeight: 700, fontFamily: "DM Sans,sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>Anchor</span>
        </button>
        <button onClick={() => { setShowAnchor(false); _setActiveTab("anchor"); }} title="Flow" style={{ background: !showAnchor && activeTab === "anchor" ? "rgba(200,169,122,0.2)" : "rgba(200,169,122,0.06)", border: !showAnchor && activeTab === "anchor" ? "1px solid rgba(200,169,122,0.45)" : "1px solid rgba(200,169,122,0.15)", borderRadius: "8px", cursor: "pointer", padding: "8px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", marginBottom: "2px" }}>
          <span style={{ fontSize: "15px" }}>🌊</span>
          <span style={{ fontSize: "7px", color: !showAnchor && activeTab === "anchor" ? "#c8a97a" : "rgba(200,169,122,0.45)", fontWeight: 700, fontFamily: "DM Sans,sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>Flow</span>
        </button>
        <div style={{ width: "32px", height: "0.5px", background: "rgba(255,255,255,0.08)", marginBottom: "4px" }} />
        {showAnchor ? (
          <>
          {VAULT_NAV.filter(item => item.id === "settings" || item.id === "home" || !anchorHidden[item.id]).map(item => (
            <button key={item.id} onClick={() => setVaultSection(item.id)} title={item.label} style={{ background: vaultSection === item.id ? "rgba(200,169,122,0.14)" : "none", border: "none", borderLeft: vaultSection === item.id ? "2px solid #c8a97a" : "2px solid transparent", borderRadius: "0 8px 8px 0", cursor: item.premium ? "default" : "pointer", padding: "9px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", transition: "all 0.15s" }}>
              <span style={{ fontSize: "14px", lineHeight: 1, opacity: item.premium ? 0.25 : 1 }}>{item.emoji}</span>
              <span style={{ fontSize: "7px", color: item.premium ? "rgba(200,169,122,0.2)" : vaultSection === item.id ? "#c8a97a" : "rgba(250,248,244,0.5)", fontWeight: vaultSection === item.id ? 700 : 500, fontFamily: "DM Sans, sans-serif", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center" }}>{item.label}</span>
            </button>
          ))}
          </>
        ) : (
          NAV.filter(item => item.id === "settings" || !sections || sections[item.id] !== false).map(item => (
            <button key={item.id} onClick={() => { setShowAnchor(false); _setActiveTab(item.id); }} title={item.label} style={{ background: activeTab === item.id ? "rgba(200,169,122,0.14)" : "none", border: "none", borderLeft: activeTab === item.id ? "2px solid #c8a97a" : "2px solid transparent", borderRadius: "0 8px 8px 0", cursor: "pointer", padding: "8px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", transition: "all 0.15s" }}>
              <span style={{ fontSize: "14px", lineHeight: 1, opacity: activeTab === item.id ? 1 : 0.5 }}>{item.emoji}</span>
              <span style={{ fontSize: "7px", color: activeTab === item.id ? "#c8a97a" : "rgba(200,169,122,0.5)", fontWeight: activeTab === item.id ? 700 : 500, fontFamily: "DM Sans, sans-serif", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center" }}>{item.label}</span>
            </button>
          ))
        )}
        <div style={{ marginTop: "auto" }}>
          <button onClick={onSignOut} title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 0", width: "56px", display: "flex", justifyContent: "center", opacity: 0.3, color: "#faf8f4", fontSize: "11px", fontFamily: "DM Sans, sans-serif" }}>sign out</button>
        </div>
      </div>
      <div style={{ marginLeft: "68px", flex: 1, minWidth: 0 }}>
        <style>{`
          div[style*="bottom:0,left:0,right:0"],
          div[style*="position:sticky"][style*="top:0"],
          div[style*="borderBottom"][style*="sticky"],
          div[style*="topBg"],
          div[style*="bottom: 0"][style*="left: 0"][style*="right: 0"],
          div[style*="bottom:0"][style*="left:0"][style*="right:0"] {
            display: none !important;
          }
        `}</style>
        {showAnchor && <AnchorVault onClose={() => setShowAnchor(false)} vaultSection={vaultSection} />}

        <HomeFlow />
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = React.useState(undefined)
  const [mode, setMode] = React.useState(null)

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    if (session?.user) {
      const u = session.user
      const dn = (u.user_metadata && u.user_metadata.full_name) || u.email.split("@")[0]
      try { localStorage.setItem("af_authUser", JSON.stringify({ id: u.id, email: u.email, displayName: dn })) } catch(e) {}
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  const signOut = () => { supabase.auth.signOut(); setSession(null); setMode(null) }

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
      } catch(e) {}
    }
  }} />

  return <FlowWrapper onHome={() => setMode(null)} onSignOut={signOut} />
}
