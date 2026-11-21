// @vitest-environment node
// The real App in headless Chrome with a stand-in Google (harness gcal=1):
// Settings › Calendar connects, the row shows "Connected as … · Last synced …",
// events render in Month / Week / Day in their Google style (read-only), the
// unticked calendar stays out, and a rejected token shows a readable error
// with Reconnect. Skipped when no Chrome binary is found (set CHROME_PATH).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, captureScreen, CHROME } from "../visual/capture.mjs";

describe.skipIf(!CHROME)("Google Calendar (new look)", function () {
  var srv, st, cal, bad;
  beforeAll(async function () {
    srv = await startServer();
    var o = { redesign: true, plus: true, scope: "root" };
    st = await captureScreen(srv.url, "settings", [["before", "#settings-pill-calendar"], ["connect", "^#gcal-connect"], ["after", "!wait:1500"]], Object.assign({ anchor: true, gcal: "1" }, o));
    cal = await captureScreen(srv.url, "calendar", [["connect", "^#gcal-connect"], ["month", "!wait:1500"], ["day13", "#cal-day-2026-11-13"], ["day21", "#cal-day-2026-11-21"], ["week", "^#cal-view-week"]], Object.assign({ gcal: "1" }, o));
    bad = await captureScreen(srv.url, "settings", [["open", "#settings-pill-calendar"], ["connect", "^#gcal-connect"], ["after", "!wait:1500"]], Object.assign({ anchor: true, gcal: "401" }, o));
  }, 400000);
  afterAll(async function () { if (srv) await srv.server.close(); });
  function t(h) { return h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "|"); }

  it("Settings › Calendar: Connect, then Connected as <email> · Last synced · Sync now · Disconnect", function () {
    expect(st.before).toContain('data-testid="gcal-connect"');
    expect(t(st.before)).toContain("Not connected on this device");
    expect(t(st.after)).toContain("Connected as lindsey@example.com · Last synced today");
    expect(st.after).toContain('data-testid="gcal-sync"');
    expect(st.after).toContain('data-testid="gcal-disconnect"');
  });
  it("events show in Day and Week in the Google style, read-only; multi-day spans every day; unticked calendar left out", function () {
    expect(cal.day13).toContain('data-testid="cal-event-gcal_g1"');
    expect(cal.day13).toMatch(/data-testid="cal-event-gcal_g1" data-google="true"/);
    expect(cal.day13).not.toContain('data-testid="cal-edit-gcal_g1"');
    expect(t(cal.day13)).toContain("Lindsey · edit in Google Calendar");
    expect(t(cal.day21)).toContain("Grandparents visiting (Google)");
    expect(cal.week).toMatch(/data-google="true"[^>]*>.*?Grandparents visiting \(Google\)/); // the week of the 21st
    [cal.month, cal.day13, cal.day21, cal.week].forEach(function (h) { expect(h).not.toContain("SHOULD NOT SHOW"); });
  });
  it("a rejected token: readable error and Reconnect", function () {
    expect(bad.after).toContain('data-testid="gcal-reconnect"');
    expect(t(bad.after)).toContain("Google needs you to confirm access again (Google asks about once an hour). Tap Reconnect.");
  });
});
