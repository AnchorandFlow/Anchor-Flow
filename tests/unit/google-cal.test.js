// Google Calendar (src/lib/googleCal.js): token lifetime, event mapping (time
// zone, multi-day all-day), only ticked calendars, and a sync that replaces
// only its own account's events.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { tokenValid, mapGoogleEvent, mergeGoogleEvents, fetchGoogleCalendar, syncErrorText, fetchWindow, GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from "../../src/lib/googleCal.js";
import { eventsOn } from "../../src/redesign/flowData.js";

function res(v, status) { return Promise.resolve({ status: status || 200, json: function () { return Promise.resolve(v); } }); }

describe("token", function () {
  it("valid until a minute before it expires; a token without an expiry is not trusted", function () {
    var now = 1000000;
    expect(tokenValid({ token: "t", expiresAt: now + 3600000 }, now)).toBe(true);
    expect(tokenValid({ token: "t", expiresAt: now + 30000 }, now)).toBe(false);
    expect(tokenValid({ token: "t" }, now)).toBe(false);
    expect(tokenValid(null, now)).toBe(false);
  });
  it("client id and read-only scopes are unchanged", function () {
    expect(GOOGLE_CLIENT_ID).toBe("1071398827259-kt8fuuclq8riohieaeu4r58sk93484u9.apps.googleusercontent.com");
    expect(GOOGLE_SCOPES).toBe("https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly");
  });
});

describe("events", function () {
  it("timed events land on the phone's own day and time (not the calendar's time zone text)", function () {
    var start = new Date(2026, 10, 13, 18, 30);
    var m = mapGoogleEvent({ id: "a", summary: "Dentist", start: { dateTime: start.toISOString() } }, { summary: "Lindsey" }, "l@x.com");
    expect(m).toMatchObject({ id: "gcal_a", date: "2026-11-13", time: "18:30", fromGoogle: true, googleAccount: "l@x.com", googleCalendar: "Lindsey" });
  });
  it("multi-day all-day events show on every day through the last (end date is exclusive)", function () {
    var m = mapGoogleEvent({ id: "b", summary: "Grandparents", start: { date: "2026-11-20" }, end: { date: "2026-11-23" } }, {}, "l@x.com");
    expect(m).toMatchObject({ date: "2026-11-20", repeat: "daily", repeatEnd: { type: "on", date: "2026-11-22" } });
    [20, 21, 22].forEach(function (d) { expect(eventsOn([m], new Date(2026, 10, d)).length).toBe(1); });
    expect(eventsOn([m], new Date(2026, 10, 23)).length).toBe(0);
    var one = mapGoogleEvent({ id: "c", start: { date: "2026-11-20" }, end: { date: "2026-11-21" } }, {}, "x");
    expect(one.repeat).toBeUndefined();
    expect(mapGoogleEvent({ id: "d", status: "cancelled", start: { date: "2026-11-20" } }, {}, "x")).toBe(null);
  });
  it("a sync replaces only its own account's events (Lindsey's and Twyla's stay side by side)", function () {
    var list = [
      { id: "m1", title: "Mine" },
      { id: "gcal_l1", fromGoogle: true, googleAccount: "lindsey@x.com" },
      { id: "gcal_t1", fromGoogle: true, googleAccount: "twyla@x.com" },
      { id: "gcal_old", fromGoogle: true },
    ];
    var next = mergeGoogleEvents(list, "twyla@x.com", [{ id: "gcal_t2", fromGoogle: true, googleAccount: "twyla@x.com" }]);
    expect(next.map(function (e) { return e.id; })).toEqual(["m1", "gcal_l1", "gcal_t2"]);
  });
  it("window: from the start of last month to six months ahead", function () {
    var w = fetchWindow(new Date(2026, 10, 13));
    expect(new Date(w.timeMin).getMonth()).toBe(9);
    expect(new Date(w.timeMax).getMonth()).toBe(5);
  });
});

describe("fetch", function () {
  it("reads the account from the primary calendar and skips calendars unticked in Google", async function () {
    var asked = [];
    var fake = function (url) {
      asked.push(url);
      if (url.indexOf("calendarList") !== -1) return res({ items: [
        { id: "lindsey@x.com", primary: true, summary: "Lindsey" },
        { id: "fam", summary: "Family" },
        { id: "hol", summary: "Holidays", selected: false },
        { id: "hid", summary: "Hidden", hidden: true },
      ] });
      if (url.indexOf("pageToken=p2") !== -1) return res({ items: [{ id: "2", summary: "B", start: { date: "2026-11-21" } }] });
      if (url.indexOf("/calendars/lindsey%40x.com/") !== -1) return res({ items: [{ id: "1", summary: "A", start: { date: "2026-11-20" } }], nextPageToken: "p2" });
      return res({ items: [{ id: "3", summary: "C", start: { date: "2026-11-22" } }] });
    };
    var r = await fetchGoogleCalendar("tok", { fetch: fake, now: new Date(2026, 10, 13) });
    expect(r.account).toBe("lindsey@x.com");
    expect(r.events.map(function (e) { return e.title; }).sort()).toEqual(["A", "B", "C"]);
    expect(asked.some(function (u) { return u.indexOf("/calendars/hol/") !== -1 || u.indexOf("/calendars/hid/") !== -1; })).toBe(false);
  });
  it("a rejected token surfaces as an auth error with a readable message", async function () {
    var err = null;
    try { await fetchGoogleCalendar("bad", { fetch: function () { return res({ error: { code: 401 } }, 401); } }); } catch (e) { err = e; }
    expect(err && err.status).toBe(401);
    expect(syncErrorText(err)).toBe("Google needs you to confirm access again (Google asks about once an hour). Tap Reconnect.");
  });
});

describe("wiring", function () {
  var app = fs.readFileSync("src/App.jsx", "utf8");
  it("per-device connection, never synced; Settings › Calendar and the Calendar tab show the row", function () {
    expect(app).toContain('const [gcal,setGcal] = useSaved("googleCal", null);');
    expect(app).toContain('"googleCal","googleCalToken",');
    expect(app).toContain('{id:"calendar",label:"Calendar",emoji:"📆"}');
    expect(app).toContain("calendarPanel={REDESIGN ? gcalRow(false) : null}");
    expect(app).toContain("googleRow={gcalRow(true)}");
    expect(app).toContain("setCalEvents(function(prev){ return mergeGoogleEvents(prev, r.account, r.events); });");
  });
});
