// @vitest-environment node
// The real App in headless Chrome (tests/visual/harness), new look, two kids
// on different school types: June Homeschool, Ollie Public school. The
// "School: …" control at the top of a child's Lighthouse tab switches type
// and Records follows it at once.
// Skipped when no Chrome binary is found (set CHROME_PATH).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, captureScreen, CHROME } from "../visual/capture.mjs";

describe.skipIf(!CHROME)("Lighthouse school type per child (new look)", function () {
  var srv, r;
  beforeAll(async function () {
    srv = await startServer();
    r = await captureScreen(srv.url, "lighthouse", [
      ["june records", "#lh-tab-records"],
      ["ollie records", "#lh-child-p_oll"],
      ["back to june", "#lh-child-p_jun"],
      ["menu", "^#lh-school-btn"],
      ["june hybrid", "^#lh-school-hybrid"],
    ], { redesign: true, plus: true, me: "p_twy", scope: "root" });
  }, 300000);
  afterAll(async function () { if (srv) await srv.server.close(); });
  function t(h) { return h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, "|"); }

  it("June (Homeschool): the control says so; Records shows umbrella school and activities, no school info", function () {
    var x = t(r["june records"]);
    expect(x).toMatch(/School:\|+Homeschool/);
    expect(x).toContain("Umbrella School");
    expect(x).not.toContain("School info");
    expect(r["june records"]).toContain('data-lh-mode="homeschool"');
  });
  it("Ollie (Public school): school info, teachers, events, homework", function () {
    var x = t(r["ollie records"]);
    expect(x).toMatch(/School:\|+Public school/);
    expect(x).toContain("School info");
    expect(x).toContain("Homework");
    expect(x).not.toContain("Umbrella School");
    expect(r["ollie records"]).toContain('data-lh-mode="school"');
  });
  it("the menu lists the five types; picking Hybrid shows both sets at once", function () {
    var m = t(r.menu);
    ["Homeschool", "Public school", "Private school", "Hybrid / co-op", "Other"].forEach(function (l) { expect(m).toContain("|" + l + "|"); });
    var x = t(r["june hybrid"]);
    expect(x).toMatch(/School:\|+Hybrid \/ co-op/);
    expect(x).toContain("School info");
    expect(x).toContain("Umbrella School");
    expect(r["june hybrid"]).toContain('data-lh-mode="hybrid"');
  });
});
