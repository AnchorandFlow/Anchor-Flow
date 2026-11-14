// @vitest-environment node
// tests/ui/flow-screens-redesign-layout.test.js — af_redesign ON, the real App
// in headless Chrome (same harness as flow-screens-legacy.test.js), beta
// household, phone width 390px:
//   - every pill / sub-section of Shopping, Meals, Calendar, Waves, Tide Pool
//     and Lighthouse has nothing sticking out sideways and nothing scrolling
//     sideways (see measure() in tests/visual/harness/main.jsx)
//   - each screen is the redesigned full view (FAF8F3 page, "← Flow")
//   - showEmojis off hides decorative emoji; on shows them
// Skipped when no Chrome binary is found (set CHROME_PATH).
import { describe, it, expect, beforeAll } from "vitest";
import { measureAll, captureAll, CHROME, REDESIGN_STEPS } from "../visual/capture.mjs";

var FIRST = {};
Object.keys(REDESIGN_STEPS).forEach(function (tab) { FIRST[tab] = [REDESIGN_STEPS[tab][0]]; });

describe.skipIf(!CHROME)("Flow full views — af_redesign on, 390px phone", function () {
  var layout = null, plain = null, emoji = null;
  beforeAll(async function () {
    layout = await measureAll({});
    plain = await captureAll({ redesign: true, steps: FIRST });
    emoji = await captureAll({ redesign: true, steps: FIRST, emojis: true });
  }, 600000);

  Object.keys(REDESIGN_STEPS).forEach(function (tab) {
    REDESIGN_STEPS[tab].forEach(function (step) {
      it("no sideways overflow or scrolling: " + tab + " › " + step[0], function () {
        var m = layout[tab + ":" + step[0]];
        expect(m).toBeTruthy();
        expect(m.width).toBe(390);
        expect(m.offenders).toEqual([]);
      });
    });
  });

  Object.keys(FIRST).forEach(function (tab) {
    it(tab + " renders the redesigned full view with ← Flow and a subtitle", function () {
      var html = plain[tab + ":" + FIRST[tab][0][0]];
      expect(html).toContain('data-redesign="full-view"');
      expect(html).toContain("background: rgb(250, 248, 243)"); // #FAF8F3
      expect(html).toMatch(/data-testid="fullview-back"[^>]*>.*?←.*?Flow<\/button>/);
      expect(html).toContain('data-testid="fullview-subtitle"');
      expect(html).toContain('role="tablist"');
      expect(html).toContain("Cormorant Garamond");
    });
  });

  it("showEmojis: header and pill emoji only when the household setting is on", function () {
    expect(plain["tidepool:Earn"]).not.toContain("🏝️");
    expect(plain["tidepool:Earn"]).not.toContain("🐚");
    expect(emoji["tidepool:Earn"]).toContain("🏝️");
    expect(emoji["tidepool:Earn"]).toContain("🐚");
    expect(plain["shop:Grocery"]).not.toContain("🛒");
    expect(emoji["shop:Grocery"]).toContain("🛒");
  });
});
