// af_redesign navigation: top-right section icons + Compass button (TopNav),
// the Compass panel, the footer, and the FlowWrapper wiring that replaced the
// side rail. Flag off: FlowWrapper's original return (rail + layout) is the
// path taken, untouched.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import fs from "node:fs";
import TopNav from "../../src/shell/TopNav.jsx";
import CompassPanel from "../../src/shell/CompassPanel.jsx";
import AppFooter from "../../src/shell/AppFooter.jsx";
import { navCurrent, navScreenName, NAV_SECTIONS, QUICK_PROMPTS, CONTACT_URL, PRIVACY_URL } from "../../src/shell/navModel.js";
import * as engine from "../../src/compass/compassEngine";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
var h = React.createElement;
var container, root;
function q(s) { return container.querySelector(s); }
function qa(s) { return Array.from(container.querySelectorAll(s)); }
async function render(el) { await act(async function () { root.render(el); }); }
async function click(el) { await act(async function () { el.click(); }); }
beforeEach(function () { localStorage.clear(); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(function () { act(function () { root.unmount(); }); container.remove(); vi.restoreAllMocks(); });

describe("which section is current", function () {
  it("maps every screen to its pillar", function () {
    expect(navCurrent(false, "home", "anchor")).toBe("today");
    ["flowhome", "calendar", "brain", "waves", "tidepool", "lighthouse", "meals", "shop"].forEach(function (t) { expect(navCurrent(false, "home", t)).toBe("flow"); });
    ["cove", "home", "people", "horizon"].forEach(function (t) { expect(navCurrent(false, "home", t)).toBe("anchor"); });
    expect(navCurrent(true, "home", "anchor")).toBe("anchor");
    expect(navCurrent(true, "trips", "anchor")).toBe("anchor");
    expect(navCurrent(true, "ripples", "anchor")).toBe("ripples");
    expect(navCurrent(false, "home", "settings")).toBe(null);
  });
  it("names the screen for Compass", function () {
    expect(navScreenName(false, "home", "meals")).toBe("Meals");
    expect(navScreenName(true, "safeharbor", "anchor")).toBe("Safe Harbor");
    expect(navScreenName(true, "ripples", "anchor")).toBe("Ripples");
    expect(navScreenName(true, "home", "anchor")).toBe("Anchor");
    var all = ["anchor", "flowhome", "calendar", "brain", "waves", "tidepool", "lighthouse", "meals", "shop", "cove", "home", "people", "horizon", "settings"].map(function (t) { return navScreenName(false, "home", t); })
      .concat(["home", "safeharbor", "ripples", "trips"].map(function (s) { return navScreenName(true, s, "anchor"); }));
    all.forEach(function (n) { expect(engine.COMPASS_SCREENS).toContain(n); }); // only allow-listed names reach the prompt
  });
});

describe("TopNav", function () {
  it("four section icons in pillar colors; current is solid with aria-current=page", async function () {
    var go = vi.fn();
    await render(h(TopNav, { current: "flow", onSection: go, onCompass: function () {} }));
    var ids = qa("[data-testid^=nav-]").map(function (b) { return b.getAttribute("data-testid"); });
    expect(ids).toEqual(["nav-brand", "nav-today", "nav-flow", "nav-anchor", "nav-ripples", "nav-compass"]);
    expect(q("[data-testid=nav-flow]").getAttribute("aria-current")).toBe("page");
    expect(q("[data-testid=nav-today]").getAttribute("aria-current")).toBeNull();
    var flow = NAV_SECTIONS.find(function (s) { return s.id === "flow"; }).tone;
    var today = NAV_SECTIONS.find(function (s) { return s.id === "today"; }).tone;
    var d = document.createElement("div");
    d.style.background = flow.full; expect(q("[data-testid=nav-flow] .af-tn-ico").style.background).toBe(d.style.background);
    d.style.background = today.tint; expect(q("[data-testid=nav-today] .af-tn-ico").style.background).toBe(d.style.background);
    expect(q("[data-testid=nav-today]").textContent).toBe("Today");
    await click(q("[data-testid=nav-anchor]"));
    expect(go).toHaveBeenCalledWith("anchor");
  });
  it("every control is a real button (tabbable) with a visible focus style; phone hides labels at 40px", async function () {
    await render(h(TopNav, { current: "today", onSection: function () {}, onCompass: function () {} }));
    qa(".af-topnav button").forEach(function (b) { expect(b.tagName).toBe("BUTTON"); expect(b.tabIndex).toBe(0); });
    var css = q(".af-topnav style").textContent;
    expect(css).toContain(".af-topnav button:focus-visible");
    var phone = css.slice(css.indexOf("@media (max-width:600px)"));
    expect(phone).toContain(".af-tn-word,.af-tn-label,.af-tn-compass-label{display:none}.af-tn-ico{width:40px;height:40px}");
    expect(q("[data-testid=nav-compass]").textContent).toBe("Compass");
  });
  it("Ripples icon follows the Ripples feature toggle", async function () {
    await render(h(TopNav, { current: "today", ripplesOn: false, onSection: function () {}, onCompass: function () {} }));
    expect(q("[data-testid=nav-ripples]")).toBeNull();
  });
});

describe("Compass panel", function () {
  function open(extra) { return h(CompassPanel, Object.assign({ open: true, screen: "Meals", onClose: vi.fn() }, extra || {})); }
  it("three quick prompts, a close button, and the current screen as context", async function () {
    var ask = vi.spyOn(engine, "askFamily").mockResolvedValue({ answer: "Library books are due Friday.", details: [] });
    await render(open());
    expect(q('[role="dialog"]').getAttribute("aria-label")).toBe("Compass");
    expect(qa("[data-testid=compass-prompts] button").map(function (b) { return b.textContent; })).toEqual(QUICK_PROMPTS);
    expect(QUICK_PROMPTS).toEqual(["Plan dinners this week", "What's due soon?", "I'm overwhelmed"]);
    await click(qa("[data-testid=compass-prompts] button")[1]);
    expect(ask).toHaveBeenCalled();
    expect(ask.mock.calls[0][1]).toBe("What's due soon?");
    expect(ask.mock.calls[0][3]).toBe("Meals");
    expect(container.textContent).toContain("Library books are due Friday.");
  });
  it("Esc, the backdrop and the close button all close it", async function () {
    var close = vi.fn();
    await render(open({ onClose: close }));
    await act(async function () { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    await click(q("[data-testid=compass-backdrop]"));
    await click(q("[data-testid=compass-close]"));
    expect(close).toHaveBeenCalledTimes(3);
  });
  it("Compass turned off in Settings: says so, asks nothing", async function () {
    localStorage.setItem("af_compassEnabled", "false");
    var ask = vi.spyOn(engine, "askFamily");
    await render(open());
    expect(container.textContent).toContain("Compass is resting");
    expect(q("[data-testid=compass-input]").disabled).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });
  it("a question from Today's Ask box is sent on open", async function () {
    var ask = vi.spyOn(engine, "askFamily").mockResolvedValue({ answer: "ok", details: [] });
    await render(open({ screen: "Today", initialQuestion: "What's for dinner?" }));
    expect(ask.mock.calls[0][1]).toBe("What's for dinner?");
  });
});

describe("footer", function () {
  it("tagline left; Settings, Contact us, Help, Privacy right", async function () {
    var seen = [];
    function rec(e) { seen.push(e.type); }
    window.addEventListener("af-open-settings", rec); window.addEventListener("af-open-feedback", rec);
    await render(h(AppFooter, {}));
    expect(q("[data-testid=app-footer]").textContent).toContain("Anchor & Flow · a steadier home, in every season");
    expect(qa(".af-foot-links > *").map(function (e) { return e.textContent; })).toEqual(["Settings", "Contact us", "Help", "Privacy"]);
    expect(q("[data-testid=footer-contact]").getAttribute("href")).toBe(CONTACT_URL);
    expect(q("[data-testid=footer-privacy]").getAttribute("href")).toBe("https://home.anchorandflowapp.com/privacy.html");
    expect(PRIVACY_URL).toBe("https://home.anchorandflowapp.com/privacy.html");
    await click(q("[data-testid=footer-settings]"));
    await click(q("[data-testid=footer-help]"));
    expect(seen).toEqual(["af-open-settings", "af-open-feedback"]);
    window.removeEventListener("af-open-settings", rec); window.removeEventListener("af-open-feedback", rec);
  });
});

describe("FlowWrapper wiring", function () {
  var app = fs.readFileSync("src/App.jsx", "utf8");
  var rd = app.slice(app.indexOf("  if (REDESIGN) {\n    var navCur"), app.indexOf('    <div style={{ display: "flex", minHeight: "100dvh" }}>'));
  it("the new-look branch has no side rail; flag off keeps the original return", function () {
    expect(rd).toContain("<TopNav current={navCur}");
    expect(rd).toContain("<AppFooter");
    expect(rd).toContain("<CompassPanel open={compassOpen} screen={screenName}");
    expect(rd).not.toContain('width: "68px"');
    expect(rd).not.toContain('marginLeft: "68px"');
    expect(app).toContain('<div style={{ width: "68px", background: "#1a2744"'); // flag-off rail, unchanged
  });
  it("Compass keeps the existing Plus gate; the daily brief stays free", function () {
    expect(app).toContain('if (BILLING_V1 && !sub.isPremium) { setPlusModalFeature("Ask Compass"); return; }');
    expect(app).toContain("loadCompassBrief={function(){");
  });
  it("Anchor keeps its Plus gate from the new icon", function () {
    expect(app).toMatch(/else if \(id === "anchor"\) \{\s*setOpenGroup\("Anchor"\);\s*if \(BILLING_V1 && !sub\.isPremium\) \{ setPlusModalFeature\("Home"\); return; \}/);
  });
  it("Flow hub tiles carry the rail's Plus gate for Waves, Lighthouse and Tide Pool only", function () {
    expect(app).toContain("plusGatedTabs={BILLING_V1 && !sub.isPremium ? { waves:true, lighthouse:true, tidepool:true } : null}");
    expect(app).toContain("onPlusGate={function(label){ setPlusModalFeature(label); }}");
  });
  it("HomeFlow's own bottom tab bar is not rendered in the new look", function () {
    expect(app).toContain('{!REDESIGN&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:T.navBg');
  });
  it("Anchor overlays start below the nav and run full width", function () {
    expect(fs.readFileSync("src/redesign/AnchorFullView.jsx", "utf8")).toContain('top: "var(--af-nav-h, 0px)", left: 0,');
    expect(fs.readFileSync("src/redesign/RedesignAnchor.jsx", "utf8")).toContain('top: "var(--af-nav-h, 0px)", left: 0,');
    expect(fs.readFileSync("src/components/AnchorVault.jsx", "utf8")).toContain('top: REDESIGN ? "var(--af-nav-h, 0px)" : 0, left: REDESIGN ? 0 : 68,');
  });
});
