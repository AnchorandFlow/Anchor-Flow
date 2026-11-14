// tests/ui/redesign-home.test.js
// Redesigned Home (af_redesign). Covers: the old Home renders when the flag
// is off, the App render-site wiring, the pure data model, and the new
// screen's layout rules (accordion, empty states, showEmojis, Sunset, quick-add).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import fs from "node:fs";
import HomeSwitch from "../../src/redesign/HomeSwitch.jsx";
import RedesignHome from "../../src/redesign/RedesignHome.jsx";
import { getRedesignState } from "../../src/design/redesignFlag.js";
import {
  buildHomeModel, firstNameFrom, safeHarborReadiness, nextHorizonEvent, latestKidQuote,
  nextTradition, shoppingSummary, mealsPlannedThisWeek, daysLabel,
} from "../../src/redesign/homeData.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
var h = React.createElement;

function memStorage(init) {
  var m = Object.assign({}, init || {});
  return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } };
}
function at(y, mo, d, hr) { return function () { return new Date(y, mo - 1, d, hr || 9, 0, 0); }; }

var container, root;
beforeEach(function () { localStorage.clear(); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(function () { act(function () { root.unmount(); }); container.remove(); });
async function render(el) { await act(async function () { root.render(el); }); }
function q(sel) { return container.querySelector(sel); }
function text() { return container.textContent; }

// ── Flag OFF → old Home ─────────────────────────────────────────────────────
describe("HomeSwitch — af_redesign off renders the old Home", function () {
  function Legacy() { return h("div", { "data-testid": "legacy-home" }, "Legacy Today"); }

  it("non-beta household: flag off, legacy Home renders and the redesign is never built", async function () {
    var state = getRedesignState(memStorage({ af_householdId: JSON.stringify("hh_someoneelse") }));
    expect(state.on).toBe(false);
    var renderRedesign = vi.fn(function () { return h("div", { "data-testid": "redesign-home" }); });
    await render(h(HomeSwitch, { redesignOn: state.on, renderLegacy: function () { return h(Legacy); }, renderRedesign: renderRedesign }));
    expect(q('[data-testid="legacy-home"]')).not.toBe(null);
    expect(q('[data-testid="redesign-home"]')).toBe(null);
    expect(renderRedesign).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe('<div data-testid="legacy-home">Legacy Today</div>'); // no wrapper DOM
  });

  it("fresh device (no household): flag off, legacy Home renders", async function () {
    var state = getRedesignState(memStorage());
    await render(h(HomeSwitch, { redesignOn: state.on, renderLegacy: function () { return h(Legacy); }, renderRedesign: function () { throw new Error("must not build"); } }));
    expect(q('[data-testid="legacy-home"]')).not.toBe(null);
  });

  it("beta household device that switched it off: legacy Home renders", async function () {
    var state = getRedesignState(memStorage({ af_householdId: JSON.stringify("hh_o7yzu28"), af_redesign: "false" }));
    expect(state).toMatchObject({ eligible: true, on: false });
    await render(h(HomeSwitch, { redesignOn: state.on, renderLegacy: function () { return h(Legacy); }, renderRedesign: function () { throw new Error("must not build"); } }));
    expect(q('[data-testid="legacy-home"]')).not.toBe(null);
  });

  it("flag on renders the redesign instead", async function () {
    await render(h(HomeSwitch, { redesignOn: true, renderLegacy: function () { throw new Error("no legacy"); }, renderRedesign: function () { return h("div", { "data-testid": "redesign-home" }); } }));
    expect(q('[data-testid="redesign-home"]')).not.toBe(null);
  });

  it("App.jsx wires the Today tab through HomeSwitch with REDESIGN and <AnchorTab/> as legacy", function () {
    var src = fs.readFileSync("src/App.jsx", "utf8") /* vitest runs from the repo root */;
    var site = src.slice(src.indexOf('{t==="anchor"   &&'), src.indexOf('{t==="flowhome" &&'));
    expect(site).toMatch(/<HomeSwitch redesignOn=\{REDESIGN\}/);
    expect(site).toMatch(/renderLegacy=\{function\(\)\{ return <AnchorTab\/>; \}\}/);
    expect(site).toMatch(/<SectionErrorBoundary label="Anchor">/);
  });
});

// ── Data model ──────────────────────────────────────────────────────────────
describe("homeData", function () {
  var NOW = new Date(2026, 10, 13, 9, 0, 0); // Fri Nov 13 2026, 9am

  it("first name: first word, capitalized; hides emails", function () {
    expect(firstNameFrom("lindsey border")).toBe("Lindsey");
    expect(firstNameFrom("me@x.com")).toBe("");
    expect(firstNameFrom("")).toBe("");
  });

  it("empty data gives calm, empty model (no crash)", function () {
    var m = buildHomeModel({ now: NOW });
    expect(m).toMatchObject({ greeting: "Good morning", firstName: "", mode: "Smooth", showSunset: false });
    expect(m.today).toEqual({ events: [], exhale: [], dinner: "" });
    expect(m.flow).toEqual({ exhaleTodayCount: 0, shopping: { count: 0, lastAddedBy: null }, mealsPlanned: 0 });
    expect(m.anchor).toEqual({ safeHarborPct: null, horizon: null });
    expect(m.ripples).toEqual({ quote: null, tradition: null, unreadDriftwood: false });
  });

  it("today: calendar (sorted by time), Exhale Today bucket (not archived), dinner", function () {
    var m = buildHomeModel({
      now: NOW,
      calEvents: [{ id: 1, date: "2026-11-13", time: "15:00", title: "Swim" }, { id: 2, date: "2026-11-13", time: "08:30", title: "School" }, { id: 3, date: "2026-11-14", title: "No" }],
      exhaleBuckets: { items: [{ id: "a", text: "Call vet", bucketIndex: 1 }, { id: "b", text: "x", bucketIndex: 0 }, { id: "c", text: "old", bucketIndex: 1, archived: true }] },
      meals: { Friday: { dinner: "Tacos" }, Monday: { dinner: "Soup" } },
    });
    expect(m.today.events.map(function (e) { return e.title; })).toEqual(["School", "Swim"]);
    expect(m.today.exhale.map(function (e) { return e.id; })).toEqual(["a"]);
    expect(m.today.dinner).toBe("Tacos");
    expect(m.flow.mealsPlanned).toBe(2);
  });

  it("meals disabled hides dinner and the weekly count", function () {
    var m = buildHomeModel({ now: NOW, meals: { Friday: { dinner: "Tacos" } }, mealsEnabled: false });
    expect(m.today.dinner).toBe("");
    expect(m.flow.mealsPlanned).toBe(null);
  });

  it("meals planned counts days with a dinner (string or object)", function () {
    expect(mealsPlannedThisWeek({ Sunday: { dinner: "A" }, Monday: { dinner: { name: "B" } }, Tuesday: { dinner: "  " } })).toBe(2);
  });

  it("shopping: open items only; who-added only when an item records it", function () {
    expect(shoppingSummary([{ text: "a" }, { text: "b", done: true }, { text: "c" }])).toEqual({ count: 2, lastAddedBy: null });
    expect(shoppingSummary([{ text: "a", addedByName: "Twyla" }])).toEqual({ count: 1, lastAddedBy: "Twyla" });
  });

  it("Safe Harbor readiness matches SafeHarbor.jsx (tier 1, removed excluded); null when not set up", function () {
    expect(safeHarborReadiness(null)).toBe(null);
    expect(safeHarborReadiness({ grabItems: [] })).toBe(null);
    expect(safeHarborReadiness({ grabItems: [{ tier: 1, checked: true }, { tier: 1 }, { tier: 1, checked: true }, { tier: 2, checked: false }, { tier: 1, removed: true }] })).toBe(67);
  });

  it("next Horizon event: soonest of upcoming trips (days > 0) and annual celebrations", function () {
    var trips = [{ name: "Today trip", startDate: "2026-11-13" }, { name: "Beach", startDate: "2026-11-20" }];
    var celebs = [{ name: "Ava's birthday", month: 11, day: 16 }, { name: "New Year", month: 1, day: 1 }];
    expect(nextHorizonEvent(trips, celebs, NOW)).toEqual({ kind: "celebration", name: "Ava's birthday", days: 3 });
    expect(nextHorizonEvent(trips, [], NOW)).toEqual({ kind: "trip", name: "Beach", days: 7 });
    expect(nextHorizonEvent([], [], NOW)).toBe(null);
  });

  it("latest kid quote: newest funny / quoted ripple", function () {
    var r = [{ name: "First steps", category: "milestone", date: "2026-11-10" }, { name: "Mom you're a potato", category: "funny", who: "Ben", date: "2026-10-01" }, { name: '"I am the sun"', who: "Ava", date: "2026-11-01" }];
    expect(latestKidQuote(r)).toEqual({ text: '"I am the sun"', who: "Ava" });
    expect(latestKidQuote([])).toBe(null);
  });

  it("next tradition by MM-DD, wrapping the year", function () {
    var t = [{ title: "Pumpkins", when: "10-25" }, { title: "Cookies", when: "12-20" }, { title: "No date", when: null }];
    expect(nextTradition(t, NOW)).toMatchObject({ title: "Cookies", days: 37 });
    expect(nextTradition([{ title: "Pumpkins", when: "10-25" }], NOW).days).toBe(346);
    expect(nextTradition([], NOW)).toBe(null);
    expect(daysLabel(0)).toBe("today");
    expect(daysLabel(1)).toBe("tomorrow");
  });

  it("Sunset shows from 5 PM local", function () {
    expect(buildHomeModel({ now: new Date(2026, 10, 13, 16, 59) }).showSunset).toBe(false);
    expect(buildHomeModel({ now: new Date(2026, 10, 13, 17, 0) }).showSunset).toBe(true);
  });
});

// ── Screen ──────────────────────────────────────────────────────────────────
describe("RedesignHome screen", function () {
  function base(extra) {
    return Object.assign({ now: at(2026, 11, 13, 9), displayName: "Lindsey Border", flowMode: "Smooth", calEvents: [], meals: {}, shoppingItems: [], showEmojis: false, compassEnabled: true, loadCompassLine: function () { return Promise.resolve(null); } }, extra || {});
  }
  function pillarOpen(id) { return q('[data-testid="pillar-' + id + '"] > button').getAttribute("aria-expanded") === "true"; }
  async function click(el) { await act(async function () { el.click(); }); }

  it("header: greeting with first name, date, Compass mode", async function () {
    await render(h(RedesignHome, base({ flowMode: "Survival" })));
    expect(q("h1").textContent).toBe("Good morning, Lindsey");
    expect(text()).toContain("Friday, November 13 · Survival");
    expect(q("svg")).not.toBe(null); // anchor mark
  });

  it("four pillars, Today open by default, only one open at a time", async function () {
    await render(h(RedesignHome, base()));
    expect(["today", "flow", "anchor", "ripples"].map(pillarOpen)).toEqual([true, false, false, false]);
    await click(q('[data-testid="pillar-anchor"] > button'));
    expect(["today", "flow", "anchor", "ripples"].map(pillarOpen)).toEqual([false, false, true, false]);
    await click(q('[data-testid="pillar-anchor"] > button'));
    expect(["today", "flow", "anchor", "ripples"].map(pillarOpen)).toEqual([false, false, false, false]);
  });

  it("calm empty states everywhere with no data", async function () {
    await render(h(RedesignHome, base()));
    expect(text()).toContain("Compass is quiet for now.");
    expect(text()).toContain("Nothing scheduled today.");
    var expectations = { flow: ["Your Today bucket is clear.", "Nothing on the list.", "No dinners planned yet.", "0 of 7"], anchor: ["Not set up yet.", "Nothing on the horizon yet."], ripples: ["No kid quotes yet.", "No traditions saved yet."] };
    for (var id in expectations) {
      await click(q('[data-testid="pillar-' + id + '"] > button'));
      expectations[id].forEach(function (s) { expect(text()).toContain(s); });
    }
  });

  it("Compass line from the shared cached briefing; resting message when Compass is off", async function () {
    await render(h(RedesignHome, base({ loadCompassLine: function () { return Promise.resolve("Sunday is wide open."); } })));
    expect(q('[data-testid="compass-line"]').textContent).toBe("Sunday is wide open.");
    var spy = vi.fn();
    await render(h(RedesignHome, base({ compassEnabled: false, loadCompassLine: spy, flowMode: "Busy" })));
    expect(spy).not.toHaveBeenCalled();
    expect(text()).toContain("Compass is resting.");
  });

  it("showEmojis off: item emojis hidden, pillar icons and lock icon still shown", async function () {
    await render(h(RedesignHome, base({ calEvents: [{ date: "2026-11-13", title: "Swim", emoji: "🏊" }] })));
    expect(text()).not.toContain("🏊");
    ["🧭", "🌊", "🏠", "🌀"].forEach(function (i) { expect(text()).toContain(i); });
    await click(q('[data-testid="pillar-anchor"] > button'));
    expect(text()).toContain("🔒");
    expect(text()).not.toContain("⚓");
  });

  it("showEmojis on: item emojis shown", async function () {
    await render(h(RedesignHome, base({ showEmojis: true, calEvents: [{ date: "2026-11-13", title: "Swim", emoji: "🏊" }] })));
    expect(text()).toContain("🏊");
  });

  it("Sunset card only after 5 PM, and Begin opens the existing Sunset flow", async function () {
    await render(h(RedesignHome, base()));
    expect(q('[data-testid="sunset-card"]')).toBe(null);
    await render(h(RedesignHome, base({ now: at(2026, 11, 13, 18) })));
    var card = q('[data-testid="sunset-card"]');
    expect(card).not.toBe(null);
    expect(card.compareDocumentPosition(q('[data-testid="pillar-today"]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    var heard = vi.fn();
    window.addEventListener("af-open-sunset", heard);
    await click(card.querySelector("button"));
    window.removeEventListener("af-open-sunset", heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("items open their section", async function () {
    await render(h(RedesignHome, base({ calEvents: [{ date: "2026-11-13", title: "Swim" }] })));
    var tabs = [];
    function onTab(e) { tabs.push(e.detail); }
    window.addEventListener("af-set-tab", onTab);
    await click(Array.from(container.querySelectorAll("button")).find(function (b) { return b.textContent.indexOf("Swim") !== -1; }));
    window.removeEventListener("af-set-tab", onTab);
    expect(tabs).toEqual(["calendar"]);
  });

  it("Vault respects the Plus gate", async function () {
    var gated = vi.fn();
    await render(h(RedesignHome, base({ vaultGated: true, onVaultGated: gated })));
    await click(q('[data-testid="pillar-anchor"] > button'));
    var vaultSeen = vi.fn();
    window.addEventListener("af-open-vault", vaultSeen);
    var items = container.querySelectorAll('[data-testid="pillar-anchor"] > div button');
    await click(Array.from(items).find(function (b) { return b.textContent.indexOf("Vault") !== -1; }));
    window.removeEventListener("af-open-vault", vaultSeen);
    expect(gated).toHaveBeenCalledTimes(1);
    expect(vaultSeen).not.toHaveBeenCalled();
  });

  it("Exhale quick-add drops the thought into the Exhaled bucket (existing key), dirty-marked", async function () {
    localStorage.setItem("af_exhale_buckets", JSON.stringify({ bucketNames: ["Exhaled", "Today", "Tomorrow", "This Weekend", "Someday"], items: [{ id: "old", text: "keep", bucketIndex: 1 }] }));
    await render(h(RedesignHome, base()));
    var input = q('input[aria-label="Exhale a thought"]');
    await act(async function () {
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "Remember the permission slip");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async function () { q("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    var saved = JSON.parse(localStorage.getItem("af_exhale_buckets"));
    expect(saved.items.length).toBe(2);
    expect(saved.items[0]).toMatchObject({ text: "Remember the permission slip", bucketIndex: 0 });
    expect(saved.items[1].id).toBe("old");
    expect(Object.keys(saved).sort()).toEqual(["bucketNames", "items"]);
    expect(JSON.parse(localStorage.getItem("af_dirtyKeys"))).toContain("exhale_buckets");
    expect(input.value).toBe("");
  });

  it("no Driftwood dot (feature not built, no data key)", async function () {
    await render(h(RedesignHome, base()));
    await click(q('[data-testid="pillar-ripples"] > button'));
    expect(q('[aria-label="Unread"]')).toBe(null);
  });
});
