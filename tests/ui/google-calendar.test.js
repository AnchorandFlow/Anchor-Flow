// @vitest-environment node
// The real App in headless Chrome with a stand-in Google and a stand-in
// google-calendar Edge Function (harness gcal=…):
//   - Connect (code flow → server exchange) → "Connected as … · Last synced …"
//   - events in Day / Week (Google style, read-only), unticked calendar left out
//   - the server says the stored connection is gone → readable error + Reconnect
//   - no refresh token from Google → asks to tap Connect once more
//   - an existing hourly-token connection → one-time Reconnect prompt
//   - the old household "google" flag never shows as connected
// Skipped when no Chrome binary is found (set CHROME_PATH).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, captureScreen, CHROME } from "../visual/capture.mjs";

describe.skipIf(!CHROME)("Google Calendar — persistent connection (new look)", function () {
  var srv, st, cal, bad, norefresh, legacy, oldFlag;
  beforeAll(async function () {
    srv = await startServer();
    var o = { redesign: true, plus: true, scope: "root" };
    var S = [["open", "#settings-pill-calendar"], ["connect", "^#gcal-connect"], ["after", "!wait:1500"]];
    st = await captureScreen(srv.url, "settings", S.concat([["disconnected", "^#gcal-disconnect"]]), Object.assign({ anchor: true, gcal: "1" }, o));
    cal = await captureScreen(srv.url, "calendar", [["connect", "^#gcal-connect"], ["month", "!wait:1500"], ["day13", "#cal-day-2026-11-13"], ["day21", "#cal-day-2026-11-21"], ["week", "^#cal-view-week"]], Object.assign({ gcal: "1" }, o));
    bad = await captureScreen(srv.url, "settings", S, Object.assign({ anchor: true, gcal: "401" }, o));
    norefresh = await captureScreen(srv.url, "settings", S, Object.assign({ anchor: true, gcal: "norefresh" }, o));
    legacy = await captureScreen(srv.url, "settings", [["open", "#settings-pill-calendar"]], Object.assign({ anchor: true, gcal: "1", seed: { googleCal: { token: "old-hourly-token", expiresAt: 1, account: "lindsey@example.com" } } }, o));
    oldFlag = await captureScreen(srv.url, "calendar", [["month", null]], Object.assign({ gcal: "1", seed: { connectedCals: ["google"] } }, o));
  }, 500000);
  afterAll(async function () { if (srv) await srv.server.close(); });
  function t(h) { return h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "|"); }

  it("Settings › Calendar: Connect → Connected as <email> · Last synced · Sync now · Disconnect; Disconnect clears it", function () {
    expect(t(st.open)).toContain("Not connected on this device");
    expect(t(st.after)).toContain("Connected as lindsey@example.com · Last synced today");
    expect(st.after).toContain('data-testid="gcal-sync"');
    expect(st.disconnected).toContain('data-testid="gcal-connect"');
    expect(t(st.disconnected)).not.toContain("Dentist (Google)");
  });
  it("events show in Day and Week in the Google style, read-only; multi-day spans every day; unticked calendar left out", function () {
    expect(cal.day13).toMatch(/data-testid="cal-event-gcal_g1" data-google="true"/);
    expect(cal.day13).not.toContain('data-testid="cal-edit-gcal_g1"');
    expect(t(cal.day13)).toContain("Lindsey · edit in Google Calendar");
    expect(t(cal.day21)).toContain("Grandparents visiting (Google)");
    expect(cal.week).toMatch(/data-google="true"[^>]*>.*?Grandparents visiting \(Google\)/); // the week of the 21st
    [cal.month, cal.day13, cal.day21, cal.week].forEach(function (h) { expect(h).not.toContain("SHOULD NOT SHOW"); });
  });
  it("the stored connection was revoked in Google: readable error and Reconnect", function () {
    expect(bad.after).toContain('data-testid="gcal-reconnect"');
    expect(t(bad.after)).toContain("Google sign-in expired — tap Reconnect.");
  });
  it("no refresh token from Google: asks to tap Connect once more", function () {
    expect(t(norefresh.after)).toContain("Google didn't grant the lasting permission this time. Tap Connect once more to finish.");
  });
  it("existing hourly connections are asked to Reconnect once", function () {
    expect(legacy.open).toContain('data-testid="gcal-reconnect"');
    expect(t(legacy.open)).toContain("Google Calendar can now stay connected without asking again every hour. Tap Reconnect once to finish.");
  });
  it("the old household flag never reads as connected", function () {
    expect(t(oldFlag.month)).toContain("Not connected on this device");
    expect(t(oldFlag.month)).not.toMatch(/synced/i);
  });
});
