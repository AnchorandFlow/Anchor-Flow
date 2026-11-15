// tests/ui/redesign-onboarding.test.js
// First-time onboarding under af_redesign. Flag off must render exactly as
// before (golden captured from the pre-redesign wizard); flag on adds the
// welcome screen, the new shell (Back / dots / Skip), the Look choice
// (showEmojis) and the Compass welcome on the last step.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import fs from "node:fs";
import OnboardingWizard from "../../src/onboarding/Onboarding.jsx";
import { captureLegacy } from "./onboarding-golden.capture.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
var h = React.createElement;
var GOLDEN = JSON.parse(fs.readFileSync("tests/ui/onboarding-legacy-golden.json", "utf8"));
function norm(s) { return s.replace(/ob_[a-z0-9]+_\d+/g, "ID"); }

var container, root;
beforeEach(function () { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(function () { act(function () { root.unmount(); }); container.remove(); });
async function render(el) { await act(async function () { root.render(el); }); }
function q(sel) { return container.querySelector(sel); }
function btn(label) {
  return Array.prototype.find.call(container.querySelectorAll("button"), function (b) { return b.textContent === label; });
}
async function click(label) {
  var b = btn(label);
  if (!b) throw new Error("no button: " + label + " in " + container.textContent.slice(0, 200));
  await act(async function () { b.click(); });
}
async function clickEl(el) { await act(async function () { el.click(); }); }
async function type(el, value) {
  var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  await act(async function () { setter.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
}

describe("onboarding — flag off is unchanged", function () {
  it("every screen and the payload match the pre-redesign golden", async function () {
    var r = await captureLegacy();
    expect(r.html.map(norm)).toEqual(GOLDEN.html);
    expect(JSON.parse(norm(JSON.stringify(r.payload)))).toEqual(JSON.parse(norm(JSON.stringify(GOLDEN.payload))));
  });

  it("redesign-only props are ignored when redesign is false", async function () {
    var r = await captureLegacy({ redesign: false, welcome: true, onJoinCode: function () {}, initialShowEmojis: true });
    expect(r.html.map(norm)).toEqual(GOLDEN.html);
    expect("showEmojis" in r.payload).toBe(false);
  });
});

describe("onboarding — af_redesign", function () {
  function wiz(extra) {
    var calls = { complete: null, skip: 0, join: 0 };
    var props = Object.assign({
      redesign: true, welcome: true, householdId: "hh_test",
      onComplete: function (p) { calls.complete = p; },
      onSkip: function () { calls.skip += 1; },
      onJoinCode: function () { calls.join += 1; },
    }, extra || {});
    return { el: h(OnboardingWizard, props), calls: calls };
  }

  it("opens on the cream welcome: logo, three-minute line, gold Get started, invite link", async function () {
    var w = wiz();
    await render(w.el);
    var welcome = q('[data-testid="ob-welcome"]');
    expect(welcome).not.toBe(null);
    expect(q('[data-testid="ob-redesign"]').style.background).toMatch(/rgb\(245, 240, 232\)|#F5F0E8/i);
    var img = welcome.querySelector("img");
    expect(img.getAttribute("src")).toBe("/af-logo.png");
    expect(img.getAttribute("alt")).toBe("Anchor & Flow");
    expect(welcome.textContent).toContain("Setup takes about three minutes.");
    expect(btn("Get started").style.background).toMatch(/rgb\(200, 162, 83\)|#C8A253/i);
    await click("Joining a household? Use an invite code");
    expect(w.calls.join).toBe(1);
  });

  it("falls back to a text wordmark if the logo file is missing", async function () {
    await render(wiz().el);
    await act(async function () { q('[data-testid="ob-welcome"] img').dispatchEvent(new Event("error")); });
    expect(q('[data-testid="ob-welcome"] img')).toBe(null);
    expect(q('[data-testid="ob-welcome"] h1').textContent).toBe("Anchor & Flow");
  });

  it("no welcome (and no invite link) for a Settings re-run", async function () {
    await render(wiz({ welcome: false, initialPeople: [{ name: "Wren", birthday: "" }] }).el);
    expect(q('[data-testid="ob-welcome"]')).toBe(null);
    expect(q('[data-testid="ob-step-0"]')).not.toBe(null);
  });

  it("each step: Playfair title, Lato body, dots, Back and Skip; Back from step 1 returns to welcome", async function () {
    await render(wiz().el);
    await click("Get started");
    var step = q('[data-testid="ob-step-0"]');
    expect(step.querySelector("h1").style.fontFamily).toContain("Playfair Display");
    expect(q('[data-testid="ob-redesign"]').style.fontFamily).toContain("Lato");
    expect(step.textContent).toContain("Step 1 of 5");
    expect(btn("‹ Back")).toBeTruthy();
    expect(btn("Skip")).toBeTruthy();
    await click("Skip");
    expect(q('[data-testid="ob-step-1"]')).not.toBe(null);
    await click("‹ Back");
    await click("‹ Back");
    expect(q('[data-testid="ob-welcome"]')).not.toBe(null);
  });

  it("Look defaults to Minimal (no decorative emoji) and Playful saves showEmojis: true", async function () {
    var w = wiz({ initialPeople: [{ name: "Sam", birthday: "1988-01-02" }, { name: "Wren", birthday: "2017-03-14" }] });
    await render(w.el);
    await click("Get started");
    await click("Continue");
    expect(q('[data-testid="ob-look-minimal"]').getAttribute("aria-checked")).toBe("true");
    expect(q('[data-testid="ob-look-playful"]').getAttribute("aria-checked")).toBe("false");
    await click("Yes"); // kids go to school → per-child school pills
    expect(container.textContent).toContain("Homeschool");
    expect(container.textContent).not.toContain("🏠");
    await clickEl(q('[data-testid="ob-look-playful"]'));
    expect(container.textContent).toContain("🏠 Homeschool");
    await click("Continue");
    await click("Skip"); // More → explore later
    await click("Skip"); // Today
    expect(btn("Skip")).toBeFalsy(); // last step has no Skip
    await click("Open my home");
    expect(w.calls.complete.showEmojis).toBe(true);
    expect(w.calls.complete.moreFeaturesEnabled).toBe(false);
  });

  it("skip-through still saves Minimal (showEmojis: false)", async function () {
    var w = wiz();
    await render(w.el);
    await click("Get started");
    for (var i = 0; i < 4; i++) await click("Skip");
    await click("Open my home");
    expect(w.calls.complete.showEmojis).toBe(false);
  });

  it("re-run keeps the household's current Look", async function () {
    var w = wiz({ welcome: false, initialShowEmojis: true });
    await render(w.el);
    for (var i = 0; i < 4; i++) await click("Skip");
    await click("Open my home");
    expect(w.calls.complete.showEmojis).toBe(true);
  });

  it("last step shows a Compass welcome built from the answers", async function () {
    var w = wiz({ initialHouseholdName: "The Harper Crew", initialPeople: [{ name: "Sam Harper", birthday: "1988-01-02" }, { name: "Wren", birthday: "2017-03-14" }] });
    await render(w.el);
    await click("Get started");
    await click("Costco");
    var meal = container.querySelector('input[placeholder="Favorite meal 1 (optional)"]');
    await type(meal, "Tacos");
    await click("Continue");
    // Treasure Chest yes (second Yes/No row when kids exist)
    var yesButtons = Array.prototype.filter.call(container.querySelectorAll("button"), function (b) { return b.textContent === "Yes"; });
    await clickEl(yesButtons[1]);
    await click("Continue");
    await click("Skip");
    await click("Skip");
    var card = q('[data-testid="ob-compass-welcome"]');
    expect(card).not.toBe(null);
    var t = card.textContent;
    expect(t).toContain("Welcome aboard, Sam.");
    expect(t).toContain("The Harper Crew is set up for you, Wren.");
    expect(t).toContain("Tacos is waiting in your meal bank, and your shopping list has tabs for Costco.");
    expect(t).toContain("Wren can start collecting shells in the Treasure Chest.");
    expect(container.textContent).toContain("hh_test"); // household code still offered
    await click("Open my home");
    expect(w.calls.complete.householdName).toBe("The Harper Crew");
    expect(w.calls.complete.treasureChestEnabled).toBe(true);
  });

  it("Compass welcome reads well for a skip-through", async function () {
    await render(wiz().el);
    await click("Get started");
    for (var i = 0; i < 4; i++) await click("Skip");
    var t = q('[data-testid="ob-compass-welcome"]').textContent;
    expect(t).toContain("Welcome aboard.");
    expect(t).toContain("Start with one small thing");
  });
});

describe("App wiring", function () {
  var src = fs.readFileSync("src/App.jsx", "utf8");
  it("passes the flag to both wizard mounts and saves the Look choice", function () {
    expect(src).toMatch(/showFirstVoyage&&!fvJoining&&<FirstVoyageWizard[^>]*redesign=\{REDESIGN\} welcome=\{REDESIGN\} onJoinCode=\{handleFirstVoyageJoinCode\}/);
    expect(src).toMatch(/showFirstVoyageRerun&&<FirstVoyageWizard\s+redesign=\{REDESIGN\}/);
    expect(src).toMatch(/payload\.showEmojis === true \|\| payload\.showEmojis === false\) \{\s+setShowEmojis\(payload\.showEmojis\)/);
  });
  it("closing the join modal brings the wizard back", function () {
    expect(src).toContain("onClose={()=>{setShowHouseholdModal(false);setFvJoining(false);}}");
  });
});
