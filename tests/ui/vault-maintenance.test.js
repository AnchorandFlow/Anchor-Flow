// @vitest-environment node
// The real App in headless Chrome (tests/visual/harness), new look, signed in
// as Twyla. Vault › Maintenance: editing Last completed recalculates Next due
// and the status straight away (card, detail panel, overdue banner); Mark done
// today does the same; dates read "Nov 19, 2026". The harness clock is pinned
// to Fri Nov 13, 2026.
// Skipped when no Chrome binary is found (set CHROME_PATH).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, captureScreen, CHROME } from "../visual/capture.mjs";

var SEED = { vaultSystems: [
  { id: "vs1", name: "HVAC filter", type: "hvac", freq: "3m", lastDone: "2026-08-20", nextDue: "2026-11-20", notes: "" },
  { id: "vs3", name: "Pest control", type: "other", freq: "3m", lastDone: "2026-06-01", nextDue: "2026-09-01", notes: "" },
] };
var OPEN = [["overview", "#open-full"], ["systems", "#vault-pill-systems"], ["detail", "@p:Pest control"]];

describe.skipIf(!CHROME)("Vault › Maintenance recalculates (Twyla, new look)", function () {
  var srv, edit, done;
  beforeAll(async function () {
    srv = await startServer();
    var o = { redesign: true, anchor: true, plus: true, me: "p_twy", scope: "root", seed: SEED };
    edit = await captureScreen(srv.url, "vault:home", OPEN.concat([
      ["edit", "^#sys-edit"],
      ["typed", "!type:[data-testid=sys-form-last]|2026-11-19"],
      ["saved", "^Save changes"],
    ]), o);
    done = await captureScreen(srv.url, "vault:home", OPEN.concat([["marked", "^#sys-mark-done"]]), o);
  }, 300000);
  afterAll(async function () { if (srv) await srv.server.close(); });

  function text(h) { return h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "|"); }

  it("before: the stale record shows overdue, with the banner", function () {
    expect(text(edit.detail)).toContain("73d overdue");
    expect(text(edit.detail)).toContain("Pest control is overdue");
    expect(text(edit.detail)).toContain("Jun 1, 2026");
    expect(text(edit.detail)).not.toMatch(/\b2026-\d\d-\d\d\b/);
  });
  it("the edit sheet shows the calculated date as you type", function () {
    expect(text(edit.typed)).toContain("Next due Feb 19, 2027, calculated from last completed + frequency");
  });
  it("after Save: card, detail panel and banner all update at once", function () {
    var t = text(edit.saved);
    expect(t).toContain("Due in 98d");
    expect(t).not.toContain("73d overdue");
    expect(t).not.toContain("Pest control is overdue");
    expect(t).toContain("|Nov 19, 2026|");
    expect(t).toContain("|Feb 19, 2027|");
  });
  it("Mark done today: last done today, next due three months on", function () {
    var t = text(done.marked);
    expect(t).toContain("|Nov 13, 2026|");
    expect(t).toContain("|Feb 13, 2027|");
    expect(t).toContain("Due in 92d");
    expect(t).not.toContain("Pest control is overdue");
  });
});
