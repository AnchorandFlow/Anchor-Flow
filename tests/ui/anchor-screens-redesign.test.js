// @vitest-environment node
// tests/ui/anchor-screens-redesign.test.js — af_redesign ON: the seven Anchor
// full views (Vault, Safe Harbor, Home, People, Cove, Horizon, Settings) in
// the real App in headless Chrome (same harness as anchor-screens-legacy.test.js),
// beta household, anchor fixture data, phone width 390px:
//   - every pill / sub-section has nothing sticking out sideways and nothing
//     scrolling sideways (measure() in tests/visual/harness/main.jsx), with
//     showEmojis off and on
//   - each screen is the new look: navy 1B2B44 page, "← Anchor", Playfair
//     Display title, Lato subtitle, pill tabs, light cards, 15px Lato rows
//   - sensitive records: lock + hint only until tapped; Health's PIN-locked
//     note never shows and tapping it opens Health
//   - Safe Harbor keeps 10/30/60 grab-and-go, the Six P's and the family plan
//   - Settings has the redesign switch and Show emojis
//   - showEmojis respected; lock and pillar icons always shown
//   - "← Anchor" keeps the Plus paywall: free household gets the Plus modal,
//     Plus household gets the Anchor screen
// Skipped when no Chrome binary is found (set CHROME_PATH).
import { describe, it, expect, beforeAll } from "vitest";
import { measureAll, captureAll, CHROME, ANCHOR_REDESIGN_STEPS } from "../visual/capture.mjs";

var FIRST = {};
Object.keys(ANCHOR_REDESIGN_STEPS).forEach(function (tab) {
  // Vault's first step opens the full view from the Anchor screen; keep it.
  FIRST[tab] = [ANCHOR_REDESIGN_STEPS[tab][0]];
});
var SCREENS = Object.keys(ANCHOR_REDESIGN_STEPS);
function first(snaps, tab) { return snaps[tab + ":" + ANCHOR_REDESIGN_STEPS[tab][0][0]]; }

describe.skipIf(!CHROME)("Anchor full views — af_redesign on, 390px phone", function () {
  var layout = null, layoutEmoji = null, plain = null, emoji = null, freeBack = null, plusBack = null, vaultRoot = null;
  beforeAll(async function () {
    layout = await measureAll({ anchor: true, steps: ANCHOR_REDESIGN_STEPS });
    layoutEmoji = await measureAll({ anchor: true, steps: ANCHOR_REDESIGN_STEPS, emojis: true });
    plain = await captureAll({ redesign: true, anchor: true, steps: ANCHOR_REDESIGN_STEPS });
    emoji = await captureAll({ redesign: true, anchor: true, emojis: true, steps: FIRST });
    // Vault / Safe Harbor are the .af-vault overlay itself; capture the whole
    // app so the page element's own attributes are in the markup.
    vaultRoot = await captureAll({ redesign: true, anchor: true, scope: "root", steps: { "vault:home": FIRST["vault:home"], "vault:safeharbor": FIRST["vault:safeharbor"] } });
    var back = { home: [["back", "#fullview-back"]], settings: [["back", "#fullview-back"]] };
    freeBack = await captureAll({ redesign: true, anchor: true, scope: "root", steps: back });
    plusBack = await captureAll({ redesign: true, anchor: true, scope: "root", plus: true, steps: back });
  }, 900000);

  SCREENS.forEach(function (tab) {
    ANCHOR_REDESIGN_STEPS[tab].forEach(function (step) {
      it("no sideways overflow or scrolling: " + tab + " › " + step[0], function () {
        var m = layout[tab + ":" + step[0]];
        expect(m).toBeTruthy();
        expect(m.width).toBe(390);
        expect(m.offenders).toEqual([]);
        expect(layoutEmoji[tab + ":" + step[0]].offenders).toEqual([]);
      });
    });
  });

  SCREENS.forEach(function (tab) {
    it(tab + ": navy page, ← Anchor, Playfair title, Lato subtitle, pill tabs", function () {
      var html = tab.indexOf("vault:") === 0 ? first(vaultRoot, tab) : first(plain, tab);
      expect(html).toContain('data-redesign="full-view"');
      expect(html).toContain('data-anchor-room="true"');
      expect(html).toContain("background: rgb(27, 43, 68)"); // #1B2B44
      expect(html).toContain("color: rgb(242, 234, 216)");    // ivory
      expect(html).toMatch(/data-testid="fullview-back"[^>]*>.*?←.*?Anchor<\/button>/);
      expect(html).toMatch(/<h1[^>]*font-family: &quot;Playfair Display&quot;/);
      expect(html).toMatch(/data-testid="fullview-subtitle"[^>]*font-family: Lato/);
      expect(html).toContain('role="tablist"');
      expect(html).toContain('role="tab"');
    });
  });

  it("content sits in light rounded cards; rows are 15px Lato", function () {
    ["vault:home", "home", "people", "cove", "horizon", "settings"].forEach(function (tab) {
      expect(first(plain, tab)).toMatch(/data-anchor-card="true" style="background: rgb\(253, 250, 245\);[^"]*border-radius: 20px/);
    });
    expect(first(plain, "home")).toMatch(/data-testid="row-text" style="font-family: Lato[^"]*font-size: 15px/);
    // Reused legacy bodies (vault sections, Safe Harbor) are retyped and rounded by the scoped room CSS.
    expect(first(plain, "vault:safeharbor")).toContain("[data-anchor-room] [style*='DM Sans']{font-family:'Lato'");
  });

  it("every Vault section and every sub-section of each screen is a pill", function () {
    var v = plain["vault:home:Overview"];
    ["home", "inventory", "systems", "recurring", "health", "career", "subs", "gifts", "pets", "trips"].forEach(function (id) { expect(v).toContain('data-testid="vault-pill-' + id + '"'); });
    ["info", "cleaning", "maintenance", "inventory", "reminders", "subs"].forEach(function (id) { expect(first(plain, "home")).toContain('data-testid="pill-' + id + '"'); });
    ["health", "career", "pets"].forEach(function (id) { expect(first(plain, "people")).toContain('data-testid="pill-' + id + '"'); });
    ["travel", "celebrations", "safeharbor"].forEach(function (id) { expect(first(plain, "horizon")).toContain('data-testid="pill-' + id + '"'); });
    ["lists", "notes"].forEach(function (id) { expect(first(plain, "cove")).toContain('data-testid="pill-' + id + '"'); });
    ["ourPlan", "grabGo", "ourArea"].forEach(function (id) { expect(first(plain, "vault:safeharbor")).toContain('data-testid="sh-pill-' + id + '"'); });
    // Each pill shows its section's own content.
    expect(plain["vault:home:systems"]).toContain("HVAC filter");
    expect(plain["vault:home:pets"]).toContain("Biscuit");
    expect(plain["home:Cleaning"]).toContain("Scrub tubs");
    expect(plain["cove:List detail"]).toContain("Sleeping pads");
    expect(plain["cove:Note detail"]).toContain("Kite for Ollie");
  });

  it("sensitive records: lock and hint only until tapped", function () {
    var before = plain["vault:home:Overview"], after = plain["vault:home:Passport shown"];
    expect(before).toContain("Passport number");
    expect(before).not.toContain("X1234567");
    expect(before).toContain("🔒"); // lock shows with showEmojis off
    expect(after).toContain("X1234567");
    expect(after).not.toContain("TT9876543"); // only the tapped record reveals
    expect(plain["horizon:Travel"]).not.toContain("X1234567");
    expect(plain["horizon:Passport shown"]).toContain("X1234567");
    // Vault › Travel: the Travel Wallet summary shows each number as a lock
    // + hint; tapping one reveals only that one.
    var trips = plain["vault:home:trips"], shown = plain["vault:home:Wallet passport shown"];
    expect(trips).toContain('data-testid="wallet-secret"');
    expect(trips).toContain("🔒 •••••• tap to show");
    expect(trips).not.toContain("X1234567");
    expect(trips).not.toContain("TT9876543");
    expect(shown).toContain("X1234567");
    expect(shown).not.toContain("TT9876543");
    Object.keys(plain).forEach(function (k) { expect(plain[k]).not.toContain("TT9876543"); });
  });

  it("Health keeps its PIN: the private note never shows, tapping it opens Health", function () {
    Object.keys(plain).forEach(function (k) { expect(plain[k]).not.toContain("Private note text"); });
    expect(plain["vault:home:Overview"]).toContain("PIN protected");
    expect(plain["people:Health"]).toMatch(/data-testid="sensitive-hnote-p_lin"[\s\S]*PIN protected/);
    expect(plain["vault:home:Health PIN tap"]).toMatch(/aria-selected="true" data-testid="vault-pill-health"/);
  });

  it("Safe Harbor keeps 10/30/60 grab-and-go, the Six P's and the family plan", function () {
    var grab = plain["vault:safeharbor:Grab & Go"], grab60 = plain["vault:safeharbor:Grab & Go 60 min"], plan = plain["vault:safeharbor:Our Plan"];
    ["10 min", "30 min", "60 min", "Leave Now", "Prepare to Leave", "Time to Prepare"].forEach(function (t) { expect(grab).toContain(t); });
    expect(grab).not.toContain("Sleeping bags"); // 60-minute item, hidden at 10
    expect(grab60).toContain("Sleeping bags");
    ["People &amp; Pets", "Prescriptions", "Papers", "Phones &amp; Tech", "Personal Needs", "Priceless Items"].forEach(function (t) { expect(grab60).toContain(t); });
    ["Front porch", "Library parking lot", "Aunt Rae 555-0199", "June"].forEach(function (t) { expect(plan).toContain(t); });
    expect(plain["vault:safeharbor:Our Area"]).toContain("Wildfire");
  });

  it("Settings has the redesign switch and Show emojis (beta household)", function () {
    var dp = plain["settings:designpreview"];
    expect(dp).toContain("New look (preview)");
    expect(dp).toContain("Show emojis");
    expect(first(plain, "settings")).toContain('data-testid="settings-pill-designpreview"');
  });

  it("showEmojis: decorative emoji only when on; lock and pillar icons always", function () {
    expect(first(plain, "home")).not.toContain("🏡");
    expect(first(emoji, "home")).toContain("🏡");
    expect(first(plain, "cove")).not.toContain("👥");
    expect(first(emoji, "cove")).toContain("👥");
    expect(first(plain, "settings")).not.toContain("🌊");
    expect(first(emoji, "settings")).toContain("🌊");
    expect(first(plain, "vault:safeharbor")).toContain("⚓"); // pillar icon
    expect(first(plain, "vault:home")).toContain("🔒");       // lock icon
  });

  it("← Anchor keeps the Plus paywall", function () {
    ["home:back", "settings:back"].forEach(function (k) {
      expect(freeBack[k]).toContain("This is a Plus feature");
      expect(freeBack[k]).not.toContain('data-testid="redesign-anchor"');
      expect(plusBack[k]).toContain('data-testid="redesign-anchor"');
      expect(plusBack[k]).not.toContain("This is a Plus feature");
    });
  });
});
