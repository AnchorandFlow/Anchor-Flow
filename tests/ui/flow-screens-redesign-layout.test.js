// @vitest-environment node
// tests/ui/flow-screens-redesign-layout.test.js — af_redesign ON, the real App
// in headless Chrome (same harness as flow-screens-legacy.test.js), beta
// household, phone width 390px:
//   - every pill / sub-section of Shopping, Meals, Calendar, Waves, Tide Pool
//     and Lighthouse has nothing sticking out sideways and nothing scrolling
//     sideways (see measure() in tests/visual/harness/main.jsx)
//   - each screen is the redesigned full view (sea-glass page, tinted cards, "← Flow")
//   - showEmojis off hides decorative emoji; on shows them
// Skipped when no Chrome binary is found (set CHROME_PATH).
import { describe, it, expect, beforeAll } from "vitest";
import { measureAll, captureAll, CHROME, REDESIGN_STEPS } from "../visual/capture.mjs";
import { toneFor, waveTone } from "../../src/design/tokens.js";
import { LH_DASH_TONE } from "../../src/redesign/lighthouseColors.js";

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

  Object.keys(FIRST).filter(function (tab) { return tab !== "tidepool"; }).forEach(function (tab) {
    it(tab + " renders the redesigned full view with ← Flow and a subtitle", function () {
      var html = plain[tab + ":" + FIRST[tab][0][0]];
      expect(html).toContain('data-redesign="full-view"');
      expect(html).toContain("background: rgb(230, 239, 239)"); // page.flow #E6EFEF (Flow sea glass)
      var sec = { shop: "shopping" }[tab] || tab;
      // Waves cards wear the selected rhythm's color (Daily first); Lighthouse
      // opens on Overview, whose first card is Today's Plan.
      var tint = tab === "waves" ? waveTone.daily.tint : tab === "lighthouse" ? LH_DASH_TONE.plan.tint : toneFor(sec).tint;
      var n = parseInt(tint.slice(1), 16);
      expect(html).toContain("background: rgb(" + (n >> 16 & 255) + ", " + (n >> 8 & 255) + ", " + (n & 255) + ")"); // cards in the screen's tint
      expect(html).toMatch(/data-testid="fullview-back"[^>]*>.*?←.*?Flow<\/button>/);
      expect(html).toContain('data-testid="fullview-subtitle"');
      expect(html).toContain('role="tablist"');
      expect(html).toContain("Playfair Display");
    });
  });

  it("tidepool renders the original screen inside the new page with ← Flow", function () {
    var html = plain["tidepool:Shells"];
    expect(html).toContain('data-redesign="full-view"');
    expect(html).toContain("background: rgb(230, 239, 239)"); // new page ground
    expect(html).toMatch(/data-testid="fullview-back"[^>]*>.*?←.*?Flow<\/button>/);
    expect(html).toContain("🏝️ Tide Pool"); // the original title, as it was
    expect(html).toContain('fill="#8B5E2A"'); // the original wooden chest
    expect(html).toContain("🐚"); // the original shells
    expect(html).not.toContain("data-tone-card"); // no redesigned cards
  });

  it("showEmojis: header and pill emoji only when the household setting is on", function () {
    expect(plain["shop:Grocery"]).not.toContain("🛒");
    expect(emoji["shop:Grocery"]).toContain("🛒");
  });
});
