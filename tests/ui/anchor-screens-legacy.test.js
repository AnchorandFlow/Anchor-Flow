// @vitest-environment node
// tests/ui/anchor-screens-legacy.test.js — af_redesign OFF: the seven Anchor
// full views (Vault and each of its sections, Safe Harbor, Home, People, Cove,
// Horizon, Settings) must render exactly what they rendered before the
// redesign. The golden (__golden__/anchor-screens-legacy.json) was captured
// from the untouched code by tests/visual/capture.mjs --write-anchor: the real
// App, signed in against a stubbed Supabase, fixed data (fixtures.js, anchor
// keys included), pinned clock, a non-beta household (flag off), walking every
// sub-section. This test re-captures the same walk and compares markup.
//
// Skipped when no Chrome binary is found (set CHROME_PATH).
// Intended changes to the legacy look: `node tests/visual/capture.mjs --write-anchor`.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import { captureAll, CHROME, ANCHOR_GOLDEN, ANCHOR_LEGACY_STEPS } from "../visual/capture.mjs";

// The Settings footer shows the build stamp, which deploy.sh rewrites on
// every deploy (src/buildStamp.js). It is not part of the look, so both sides
// compare with the stamp blanked.
function unstamp(html) { return String(html).replace(/Build: [0-9A-Za-z-]+/g, "Build: <stamp>"); }
function unstampAll(o) { var out = {}; Object.keys(o).forEach(function (k) { out[k] = unstamp(o[k]); }); return out; }
var golden = unstampAll(JSON.parse(fs.readFileSync(ANCHOR_GOLDEN, "utf8")));
var live = null;

describe.skipIf(!CHROME)("Anchor full views — af_redesign off is unchanged", function () {
  beforeAll(async function () { live = unstampAll(await captureAll({ redesign: false, anchor: true, steps: ANCHOR_LEGACY_STEPS })); }, 600000);

  it("captures every screen and sub-section in the golden", function () {
    var expected = [];
    Object.keys(ANCHOR_LEGACY_STEPS).forEach(function (tab) { ANCHOR_LEGACY_STEPS[tab].forEach(function (s) { expected.push(tab + ":" + s[0]); }); });
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
