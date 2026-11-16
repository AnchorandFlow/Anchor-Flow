// tests/unit/onboarding-preview.test.js — ?preview=onboarding: beta
// households only, shows the redesigned onboarding, and nothing is saved.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { wantsOnboardingPreview, clearPreviewParam } from "../../src/onboarding/preview.js";

describe("?preview=onboarding", function () {
  it("only for af_redesign-eligible (beta) households", function () {
    expect(wantsOnboardingPreview("?preview=onboarding", true)).toBe(true);
    expect(wantsOnboardingPreview("?tab=x&preview=onboarding", true)).toBe(true);
    expect(wantsOnboardingPreview("?preview=onboarding", false)).toBe(false);
    expect(wantsOnboardingPreview("?preview=other", true)).toBe(false);
    expect(wantsOnboardingPreview("", true)).toBe(false);
  });

  it("closing drops only the preview param from the address bar", function () {
    var calls = [];
    var win = { location: { href: "https://x.test/app?tab=calendar&preview=onboarding#top" }, history: { state: null, replaceState: function (s, t, u) { calls.push(u); } } };
    clearPreviewParam(win);
    expect(calls).toEqual(["/app?tab=calendar#top"]);
  });

  it("the preview wizard is the redesigned one and its finish/skip only close it", function () {
    var app = fs.readFileSync("src/App.jsx", "utf8");
    expect(app).toContain("wantsOnboardingPreview(window.location.search, getRedesignState().eligible)");
    var m = /\{obPreview&&<FirstVoyageWizard([^>]*)\/>\}/.exec(app);
    expect(m).toBeTruthy();
    expect(m[1]).toContain("redesign={true}");
    expect(m[1]).toContain("onComplete={closeObPreview}");
    expect(m[1]).toContain("onSkip={closeObPreview}");
    expect(m[1]).not.toContain("onJoinCode"); // joining a household would change data
    expect(app).toMatch(/function closeObPreview\(\)\{ setObPreview\(false\); clearPreviewParam\(\); \}/);
  });

  it("the wizard itself never writes storage (all saving goes through the host's onComplete)", function () {
    var src = fs.readFileSync("src/onboarding/Onboarding.jsx", "utf8");
    expect(src).not.toMatch(/localStorage\.setItem|sessionStorage\.setItem|supabase/);
  });
});
