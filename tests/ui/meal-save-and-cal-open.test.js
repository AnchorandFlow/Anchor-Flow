// @vitest-environment node
// The real App in headless Chrome (tests/visual/harness), new look, signed in
// as Twyla — the household's second member:
//   - Meals › Edit a day › type a dinner › Save, with the field still focused
//     the way iPhone Safari leaves it (no blur before the tap): one tap saves
//     and the Meals tab shows it straight away.
//   - Flow › Calendar: a day row opens that day in the Calendar (it used to say
//     "Open" and do nothing).
// Skipped when no Chrome binary is found (set CHROME_PATH).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, captureScreen, CHROME } from "../visual/capture.mjs";

var DINNER = 'input[placeholder="Dinner…"]';

describe.skipIf(!CHROME)("second member (Twyla), new look", function () {
  var srv, meals, cal;
  beforeAll(async function () {
    srv = await startServer();
    meals = await captureScreen(srv.url, "meals", [
      ["before", null],
      ["typed", "#meals-edit-Tuesday"],
      ["typing", "!type:" + DINNER + "|Tacos al pastor"],
      ["saved", "^@button:Save"],
      ["notes typed", "#meals-edit-Wednesday"],
      ["notes", "!type:textarea[placeholder=\"Dietary notes, prep reminders…\"]|Double batch"],
      ["notes saved", "^@button:Save"],
    ], { redesign: true, plus: true, me: "p_twy", scope: "root" });
    cal = await captureScreen(srv.url, "flowhome", [
      ["calendar tab", "#flowtab-calendar"],
      ["day tapped", "#flow-cal-day-2026-11-15"],
    ], { redesign: true, plus: true, me: "p_twy", scope: "root" });
  }, 300000);
  afterAll(async function () { if (srv) await srv.server.close(); });

  function tuesday(html) { var i = html.indexOf('data-testid="meals-day-Tuesday"'); return html.slice(i, html.indexOf('data-testid="meals-day-Wednesday"')); }

  it("one tap on Save stores the dinner typed into a still-focused field, and the Meals tab shows it", function () {
    expect(tuesday(meals.before)).toContain(">Tacos<");
    expect(meals.typing).toContain('data-modal-open="true"');
    expect(meals.saved).not.toContain("Meals for Tuesday"); // the editor closed
    expect(tuesday(meals.saved)).toContain("Tacos al pastor");
    expect(meals["notes saved"]).toContain("Double batch");
  });

  it("Flow › Calendar day rows are buttons that open that day in the Calendar; no dead \"Open\"", function () {
    expect(cal["calendar tab"]).toContain('data-testid="flow-cal-day-2026-11-15"');
    expect(cal["calendar tab"]).not.toMatch(/>Open</);
    expect(cal["calendar tab"]).toContain(">Nothing planned<");
    expect(cal["calendar tab"]).not.toContain('data-testid="cal-day"');
    expect(cal["day tapped"]).toContain('data-testid="cal-day"');
    expect(cal["day tapped"]).toContain("Sunday, November 15, 2026");
  });
});
