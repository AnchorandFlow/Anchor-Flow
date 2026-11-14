// tests/ui/redesign-ripples-sunset.test.js
// Ripples and Sunset under af_redesign. Flag off: both render byte-for-byte
// what they rendered before the redesign (golden markup captured from the
// pre-change code), and the App/AnchorVault wiring only changes when REDESIGN
// is on. Flag on: the restyle rules from the spec.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import fs from "node:fs";
import RipplesRoom from "../../src/shell/RipplesRoom.jsx";
import SunsetClose from "../../src/shell/SunsetClose.jsx";
import { gradient } from "../../src/design/tokens.js";
import { renderScenarios } from "./legacy-golden.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
var h = React.createElement;
var NOW = new Date(2026, 10, 13, 19, 0, 0); // Fri 13 Nov 2026, 7 PM
var EMOJI = /\p{Extended_Pictographic}/u;
var GOLDEN = JSON.parse(fs.readFileSync("tests/ui/__golden__/ripples-sunset-legacy.json", "utf8"));

function rgb(hex) { var d = document.createElement("div"); d.style.color = hex; return d.style.color; }

// ── Flag OFF ────────────────────────────────────────────────────────────────
describe("af_redesign off — Ripples and Sunset stay exactly as they are", function () {
  beforeEach(function () { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); });
  afterEach(function () { vi.useRealTimers(); });

  it("no redesign prop: every tab, modal, and Sunset state matches the pre-redesign markup", async function () {
    var out = await renderScenarios(RipplesRoom, SunsetClose);
    expect(Object.keys(out)).toEqual(Object.keys(GOLDEN));
    Object.keys(GOLDEN).forEach(function (k) { expect(out[k], k).toBe(GOLDEN[k]); });
  });

  it("redesign={false} (what App passes when the flag is off) is identical too", async function () {
    var out = await renderScenarios(RipplesRoom, SunsetClose, {
      ripples: { redesign: false, onBack: undefined },
      sunset: { redesign: false },
    });
    Object.keys(GOLDEN).forEach(function (k) { expect(out[k], k).toBe(GOLDEN[k]); });
  });

  it("wiring: Sunset, vault background, and back-to-Home only change when REDESIGN is on", function () {
    var app = fs.readFileSync("src/App.jsx", "utf8");
    expect(app).toContain("{showEndOfDay&&<SunsetClose redesign={REDESIGN} weatherData={weatherData}");
    expect(app).toContain('onBackHome={REDESIGN ? function(){ setNavSel("today-pillar"); setShowAnchor(false); setOpenGroup(null); _setActiveTab("anchor"); } : undefined}');
    var vault = fs.readFileSync("src/components/AnchorVault.jsx", "utf8");
    expect(vault).toContain('(REDESIGN ? gradient.ripples.css : "linear-gradient(165deg,#3E8B91 0%,#2B7378 55%,#1E5B63 100%)")');
    expect(vault).toContain("<RipplesRoom redesign={REDESIGN} onBack={onBackHome} />");
  });
});

// ── Flag ON ─────────────────────────────────────────────────────────────────
var container, root;
function set(k, v) { localStorage.setItem("af_" + k, JSON.stringify(v)); }
async function render(el) { await act(async function () { root.render(el); }); }
async function click(el) { await act(async function () { el.click(); }); }
function q(sel) { return container.querySelector(sel); }
function qa(sel) { return Array.from(container.querySelectorAll(sel)); }
function byText(sel, text) { return qa(sel).find(function (e) { return e.textContent.trim() === text; }); }

beforeEach(function () {
  localStorage.clear();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(function () { act(function () { root.unmount(); }); container.remove(); vi.useRealTimers(); });

function seedRipples() {
  set("ripples", [
    { id: "q1", name: "\"Dinosaurs don't have bedtimes\"", who: "June", category: "funny", date: "2026-11-02", note: "" },
    { id: "m1", name: "First lost tooth", who: "Ollie", category: "milestone", date: "2026-10-30", note: "" },
  ]);
  set("traditions", [{ id: "t1", emoji: "🎃", title: "Pumpkin pancakes", startedYear: 2024, when: "11-20", description: "", years: [2024, 2025] }]);
}

describe("Ripples — af_redesign on", function () {
  it("back button goes Home; the existing five tabs are rounded pills", async function () {
    seedRipples();
    var back = vi.fn();
    await render(h(RipplesRoom, { redesign: true, onBack: back }));
    await click(q('[data-testid="ripples-back"]'));
    expect(back).toHaveBeenCalledTimes(1);
    expect(q('[data-testid="ripples-back"]').textContent).toMatch(/Home/);
    var tabs = qa('[role="tab"]');
    expect(tabs.map(function (t) { return t.textContent; })).toEqual(["Timeline", "Kid Quotes", "Traditions", "Recaps", "Yearbook"]);
    tabs.forEach(function (t) { expect(t.style.borderRadius).toBe("999px"); });
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("each entry is a soft light rounded card with dark text", async function () {
    seedRipples();
    await render(h(RipplesRoom, { redesign: true }));
    var cards = qa('[data-testid="ripple-card"]');
    expect(cards.length).toBe(2);
    cards.forEach(function (c) {
      expect(c.style.background).toBe(rgb("#FDFAF5"));
      expect(parseInt(c.style.borderRadius)).toBeGreaterThanOrEqual(14);
    });
    await click(q('[data-testid="ripples-tab-traditions"]'));
    expect(qa('[data-testid="tradition-card"]').length).toBe(1);
    expect(q('[data-testid="tradition-card"]').style.background).toBe(rgb("#FDFAF5"));
  });

  it("kid quotes: Cormorant Garamond italic quote, child's name and date below", async function () {
    seedRipples();
    await render(h(RipplesRoom, { redesign: true }));
    await click(q('[data-testid="ripples-tab-quotes"]'));
    var card = q('[data-testid="kid-quote-card"]');
    var text = card.querySelector('[data-testid="kid-quote-text"]');
    expect(text.textContent).toBe("\"Dinosaurs don't have bedtimes\"");
    expect(text.style.fontFamily).toContain("Cormorant Garamond");
    expect(text.style.fontStyle).toBe("italic");
    var who = card.querySelector('[data-testid="kid-quote-who"]');
    var date = card.querySelector('[data-testid="kid-quote-date"]');
    expect(who.textContent).toBe("June");
    expect(date.textContent).toBe("November 2, 2026");
    // name and date come after the quote
    expect(text.compareDocumentPosition(who) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(who.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("decorative emoji follow showEmojis (off by default)", async function () {
    seedRipples();
    await render(h(RipplesRoom, { redesign: true }));
    var tabsSeen = ["timeline", "quotes", "traditions", "recaps", "yearbook"];
    for (var i = 0; i < tabsSeen.length; i++) {
      await click(q('[data-testid="ripples-tab-' + tabsSeen[i] + '"]'));
      expect(EMOJI.test(q('[data-testid="ripples-redesign"]').textContent), tabsSeen[i]).toBe(false);
    }
    await act(async function () { root.unmount(); });
    root = createRoot(container);
    set("showEmojis", true);
    await render(h(RipplesRoom, { redesign: true }));
    await click(q('[data-testid="ripples-tab-traditions"]'));
    expect(q('[data-testid="tradition-card"]').textContent).toContain("🎃");
  });

  it("phone width: layout grid collapses to one column, nothing fixed wider than the screen", async function () {
    seedRipples();
    await render(h(RipplesRoom, { redesign: true }));
    var grid = qa('[data-testid="ripples-redesign"] div').find(function (d) { return d.style.gridTemplateColumns.indexOf("auto-fit") !== -1; });
    expect(grid.style.gridTemplateColumns).toContain("min(100%, 300px)");
    qa('[data-testid="ripples-redesign"] *').forEach(function (el) {
      ["width", "minWidth"].forEach(function (p) { var v = parseInt(el.style[p]); if (/px$/.test(el.style[p])) expect(v).toBeLessThanOrEqual(360); });
    });
  });
});

describe("Sunset — af_redesign on", function () {
  beforeEach(function () {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW);
    set("preferredName", "Lindsey");
    set("compassEnabled", false);
    set("tasks", [{ id: "a", text: "Return library books", day: "Friday", done: false }]);
    set("showEmojis", true); // Sunset must stay emoji-free regardless
  });

  it("realistic sunset gradient, warm glow at top to dusk indigo 26263F", async function () {
    await render(h(SunsetClose, { redesign: true }));
    var bg = q('[data-testid="sunset-page"]').style.background;
    expect(bg).toContain("linear-gradient(180deg");
    ["#F4A259", "#E2725B", "#C17C83", "#8A6283", "#26263F"].forEach(function (hex) { expect(bg).toContain(rgb(hex)); });
    expect(bg.indexOf(rgb("#F4A259"))).toBeLessThan(bg.indexOf(rgb("#26263F")));
  });

  it("dark plum text on the bright top; ivory text in the cards lower down", async function () {
    await render(h(SunsetClose, { redesign: true }));
    var head = q('[data-testid="sunset-head"]');
    var greet = byText("div", "Good evening, Lindsey.");
    expect(head.contains(greet)).toBe(true);
    expect(greet.style.color).toBe(rgb(gradient.sunset.plum));
    var title = byText("div", "How did today feel?");
    expect(title.style.color).toBe(rgb("#F2EAD8"));
    expect(title.style.fontFamily).toContain("Cormorant Garamond");
  });

  it("five existing sections, frosted glass, all closed by default", async function () {
    await render(h(SunsetClose, { redesign: true }));
    var sections = qa("[data-sunset-section]");
    expect(sections.map(function (s) { return s.getAttribute("data-sunset-section"); })).toEqual(["Reflect", "Celebrate", "Release", "Prepare", "Exhale"]);
    sections.forEach(function (s) {
      expect(s.querySelector("button").getAttribute("aria-expanded")).toBe("false");
      expect(s.children.length).toBe(1); // header only, no body
      expect(s.style.backdropFilter || s.style.webkitBackdropFilter || s.getAttribute("style")).toMatch(/blur/);
    });
    expect(byText("button", "Calm")).toBe(undefined);
  });

  it("selected chips use soft apricot", async function () {
    await render(h(SunsetClose, { redesign: true }));
    await click(qa("[data-sunset-section] > button")[0]); // Reflect
    await click(byText("button", "Calm"));
    expect(byText("button", "Calm").style.background).toBe(rgb(gradient.sunset.apricot));
    expect(byText("button", "Rough").style.background).toBe("transparent");
    await click(qa("[data-sunset-section] > button")[2]); // Release
    await click(byText("button", "Later"));
    expect(byText("button", "Later").style.background).toBe(rgb(gradient.sunset.apricot));
    expect(byText("button", "Tomorrow").style.background).toBe("transparent");
  });

  it("'Anchor the day' is an ivory pill near the bottom; closing screen follows", async function () {
    await render(h(SunsetClose, { redesign: true }));
    var bar = q('[data-testid="sunset-anchor-bar"]');
    var btn = byText("button", "Anchor the day");
    expect(bar.contains(btn)).toBe(true);
    expect(bar.style.position).toBe("sticky");
    expect(bar.style.bottom).toBe("0px");
    expect(btn.style.background).toBe(rgb("#F2EAD8"));
    expect(btn.style.borderRadius).toBe("999px");
    await click(btn);
    var done = q('[data-testid="sunset-done"]');
    expect(done.textContent).toContain("Your day is anchored.");
    expect(done.textContent).toContain("Good night, Lindsey.");
    expect(EMOJI.test(container.textContent)).toBe(false);
  });

  it("no emoji anywhere, even with showEmojis on and every section open", async function () {
    await render(h(SunsetClose, { redesign: true, weatherData: [{ date: "2026-11-14", high: 51, low: 33, code: 2 }] }));
    var btns = qa("[data-sunset-section] > button");
    for (var i = 0; i < btns.length; i++) await click(btns[i]);
    expect(EMOJI.test(container.textContent)).toBe(false);
  });

  it("phone width: content column is full-width with a 16px gutter", async function () {
    await render(h(SunsetClose, { redesign: true }));
    var col = q('[data-testid="sunset-page"]').children[1];
    expect(col.style.maxWidth).toBe("460px");
    expect(col.style.width).toBe("100%");
    expect(col.style.boxSizing).toBe("border-box");
    expect(col.style.paddingLeft).toBe("16px");
    expect(col.style.paddingRight).toBe("16px");
  });
});
