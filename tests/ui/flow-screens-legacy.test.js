// @vitest-environment node
// tests/ui/flow-screens-legacy.test.js — af_redesign OFF: the six Flow full
// views (Shopping, Meals, Calendar, Waves, Tide Pool, Lighthouse) must render
// exactly what they rendered before the redesign. The golden
// (__golden__/flow-screens-legacy.json) was captured from the untouched code
// by tests/visual/capture.mjs: the real App, signed in against a stubbed
// Supabase, fixed data, pinned clock, a non-beta household (flag off), walking
// every sub-section. This test re-captures the same walk and compares markup.
//
// App.jsx can't be imported in jsdom, so this drives headless Chrome; it is
// skipped when no Chrome binary is found (set CHROME_PATH to point at one).
// Intended changes to the legacy look: `node tests/visual/capture.mjs --write`.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import { captureAll, CHROME, GOLDEN, LEGACY_STEPS } from "../visual/capture.mjs";

var golden = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));
var live = null;

describe.skipIf(!CHROME)("Flow full views — af_redesign off is unchanged", function () {
  beforeAll(async function () { live = await captureAll({ redesign: false }); }, 600000);

  it("captures every screen and sub-section in the golden", function () {
    var expected = [];
    Object.keys(LEGACY_STEPS).forEach(function (tab) { LEGACY_STEPS[tab].forEach(function (s) { expected.push(tab + ":" + s[0]); }); });
    expect(Object.keys(golden).sort()).toEqual(expected.slice().sort());
    expect(Object.keys(live).sort()).toEqual(expected.slice().sort());
  });

  Object.keys(golden).forEach(function (key) {
    it("matches the recorded legacy markup: " + key, function () {
      expect(live[key].length).toBe(golden[key].length);
      expect(live[key] === golden[key]).toBe(true);
    });
  });
});
