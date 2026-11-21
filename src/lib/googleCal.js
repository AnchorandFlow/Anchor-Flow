// src/lib/googleCal.js — Google Calendar (read-only) for the new look.
//
// Auth is Google Identity Services' token flow (unchanged client id and
// scopes): an access token that lasts about an hour, no refresh token, so the
// connection is per device (af_googleCal, never synced). When it expires the
// app says so and one tap ("Sync now" / "Reconnect") asks Google again —
// usually without a prompt, since consent was already given.
//
// Events land in the shared calEvents (so both members see them) tagged with
// the Google account they came from: a sync replaces only that account's
// events, never the other member's.
import { ymd } from "./calEvents.js";

export var GOOGLE_CLIENT_ID = "1071398827259-kt8fuuclq8riohieaeu4r58sk93484u9.apps.googleusercontent.com";
export var GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly";
export var GOOGLE_AUTO_SYNC_MS = 30 * 60 * 1000;

var COLORS = {
  cocoa: "#c4a882", flamingo: "#b87265", grape: "#8878b8", graphite: "#607890", lavender: "#8878b8", peacock: "#6A9BB5",
  sage: "#7a9e8e", tangerine: "#e8a838", tomato: "#b87265", banana: "#e8c838", basil: "#3a7a60", blueberry: "#2e6ea0",
};

export function tokenValid(g, now) {
  return !!(g && g.token && g.expiresAt && (now || Date.now()) < g.expiresAt - 60000);
}

function hhmm(d) { return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function dayBefore(iso) { var p = iso.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() - 1); return ymd(d); }

// One Google event → one app event (timed events in the device's own time
// zone; multi-day all-day events repeat daily through their last day).
export function mapGoogleEvent(ev, cal, account) {
  if (!ev || ev.status === "cancelled") return null;
  var s = ev.start || {}, e = ev.end || {};
  var out = {
    id: "gcal_" + ev.id, title: String(ev.summary || "(No title)").slice(0, 200), date: "", time: "",
    color: String(COLORS[ev.colorId] || (cal && cal.backgroundColor) || "#6A9BB5"),
    colorLabel: String((cal && cal.summary) || "Google"), note: String(ev.description || "").slice(0, 500),
    fromGoogle: true, googleAccount: account || "", googleCalendar: String((cal && cal.summary) || ""),
  };
  if (s.dateTime) {
    var d = new Date(s.dateTime);
    if (isNaN(d.getTime())) return null;
    out.date = ymd(d); out.time = hhmm(d);
  } else if (s.date) {
    out.date = s.date;
    var last = e.date ? dayBefore(e.date) : s.date;
    if (last > s.date) { out.repeat = "daily"; out.repeatEnd = { type: "on", date: last }; }
  } else return null;
  return out;
}

// Replace this account's Google events (and older untagged ones) with fresh ones.
export function mergeGoogleEvents(calEvents, account, fresh) {
  var keep = (Array.isArray(calEvents) ? calEvents : []).filter(function (e) {
    return !(e && e.fromGoogle && (!e.googleAccount || e.googleAccount === account));
  });
  return keep.concat(fresh || []);
}

export function fetchWindow(now) {
  var n = now || new Date();
  return { timeMin: new Date(n.getFullYear(), n.getMonth() - 1, 1).toISOString(), timeMax: new Date(n.getFullYear(), n.getMonth() + 7, 1).toISOString() };
}

function fetchJson(fetchFn, url, token) {
  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = setTimeout(function () { if (controller) controller.abort(); }, 12000);
  return fetchFn(url, Object.assign({ headers: { Authorization: "Bearer " + token } }, controller ? { signal: controller.signal } : {}))
    .then(function (r) {
      clearTimeout(timer);
      if (r.status === 401 || r.status === 403) { var err = new Error("auth"); err.status = r.status; throw err; }
      return r.json();
    }, function (e) { clearTimeout(timer); throw e; });
}

// → { account, events, calendars } ; throws {status:401|403} when the token is bad.
export async function fetchGoogleCalendar(token, opts) {
  var o = opts || {};
  var f = o.fetch || fetch;
  var list = await fetchJson(f, "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader", token);
  if (list && list.error) { var le = new Error(list.error.message || "Google Calendar error"); le.status = list.error.code; throw le; }
  var items = (list && list.items) || [];
  var primary = items.filter(function (c) { return c.primary; })[0];
  var account = (primary && primary.id) || o.account || "";
  // Only the calendars ticked in Google Calendar (hidden / unticked ones stay out).
  var cals = items.filter(function (c) { return c.selected !== false && !c.hidden; }).slice(0, 40);
  var w = fetchWindow(o.now);
  var nested = await Promise.all(cals.map(async function (cal) {
    var out = [], page = "", n = 0;
    try {
      do {
        var url = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(cal.id) + "/events?singleEvents=true&orderBy=startTime&maxResults=250&timeMin=" + encodeURIComponent(w.timeMin) + "&timeMax=" + encodeURIComponent(w.timeMax) + (page ? "&pageToken=" + encodeURIComponent(page) : "");
        var data = await fetchJson(f, url, token);
        (data.items || []).forEach(function (ev) { var m = mapGoogleEvent(ev, cal, account); if (m) out.push(m); });
        page = data.nextPageToken || ""; n++;
      } while (page && n < 4);
    } catch (e) { if (e && (e.status === 401 || e.status === 403)) throw e; }
    return out;
  }));
  return { account: account, calendars: cals.length, events: [].concat.apply([], nested) };
}

export function syncErrorText(e) {
  if (e && (e.status === 401 || e.status === 403)) return "Google needs you to confirm access again (Google asks about once an hour). Tap Reconnect.";
  if (e && e.name === "AbortError") return "Google Calendar didn't answer in time. Try Sync now again.";
  return "Couldn't reach Google Calendar" + (e && e.message && e.message !== "auth" ? ": " + e.message : ".") + " Try Sync now again.";
}
