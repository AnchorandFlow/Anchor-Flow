// tests/ui/redesign-anchor.test.js
// Redesigned Anchor screen (af_redesign). Flag-off wiring (legacy AnchorVault
// untouched, Plus gate untouched), the pure summaries, and each summary card.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import fs from "node:fs";
import HomeSwitch from "../../src/redesign/HomeSwitch.jsx";
import RedesignAnchor from "../../src/redesign/RedesignAnchor.jsx";
import { getRedesignState } from "../../src/design/redesignFlag.js";
import * as D from "../../src/redesign/anchorData.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
var h = React.createElement;
var NOW = new Date(2026, 10, 13, 10, 0, 0); // Fri 13 Nov 2026
function now() { return new Date(NOW); }

var container, root;
beforeEach(function () { localStorage.clear(); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(function () { act(function () { root.unmount(); }); container.remove(); });
async function render(el) { await act(async function () { root.render(el); }); }
function q(sel) { return container.querySelector(sel); }
function qa(sel) { return Array.from(container.querySelectorAll(sel)); }
async function click(el) { await act(async function () { el.click(); }); }
function set(key, v) { localStorage.setItem("af_" + key, JSON.stringify(v)); }
function tabIds() { return qa('[data-testid^="anchortab-"]').map(function (b) { return b.getAttribute("data-testid").slice(10); }); }
async function pick(id) { await click(q('[data-testid="anchortab-' + id + '"]')); }
function summary() { return q('[data-testid="anchor-summary"]').textContent; }

// ── Flag OFF ────────────────────────────────────────────────────────────────
describe("af_redesign off — Anchor stays exactly as it is", function () {
  var src = fs.readFileSync("src/App.jsx", "utf8");
  var start = src.indexOf('{showAnchor && <SectionErrorBoundary label="Anchor Vault">');
  var site = src.slice(start, src.indexOf("<div style={{ pointerEvents: showAnchor", start));

  it("overlay is behind HomeSwitch, redesign only for REDESIGN + the dashboard section", function () {
    expect(start).toBeGreaterThan(-1);
    expect(site).toContain('<HomeSwitch redesignOn={REDESIGN && vaultSection === "home" && !anchorFullVault}');
  });

  it("legacy branch renders AnchorVault with its original props and return path", function () {
    var legacy = site.slice(site.indexOf("renderLegacy"), site.indexOf("renderRedesign"));
    ["<AnchorVault onClose={() => setShowAnchor(false)}", "vaultSection={vaultSection}", "initialTripId={vaultTripId}",
      "onTripIdConsumed={() => setVaultTripId(null)}", "returnTo={vaultReturnTo}", "setShowAnchor(false); _setActiveTab(tabId); }} />"].forEach(function (p) {
      expect(legacy).toContain(p);
    });
    // The only new branch is for returnTo "anchor", which nothing sets while REDESIGN is off.
    expect(legacy).toContain('if (REDESIGN && tabId === "anchor")');
  });

  it("Anchor header keeps the same Plus gate before opening anything", function () {
    var i = src.indexOf('else if(pill.label==="Anchor"){');
    var hdr = src.slice(i, i + 400);
    expect(hdr).toMatch(/if \(BILLING_V1 && !sub\.isPremium\) \{ setPlusModalFeature\("Home"\); return; \} setNavSel\("v-home"\); setShowAnchor\(true\);/);
  });

  it("full-view links to gated tabs use the sidebar's Plus gate", function () {
    var red = site.slice(site.indexOf("renderRedesign"));
    expect(red).toContain("if (PLUS_GATED_NAV_IDS[tabId] && BILLING_V1 && !sub.isPremium) { setPlusModalFeature(label); return; }");
  });

  it("non-beta household renders the legacy vault; the redesign is never built", async function () {
    var st = getRedesignState({ getItem: function (k) { return k === "af_householdId" ? JSON.stringify("hh_other") : null; } });
    expect(st.on).toBe(false);
    var build = vi.fn();
    await render(h(HomeSwitch, { redesignOn: st.on && true, renderLegacy: function () { return h("div", { "data-testid": "legacy-vault" }); }, renderRedesign: build }));
    expect(q('[data-testid="legacy-vault"]')).not.toBe(null);
    expect(q('[data-testid="redesign-anchor"]')).toBe(null);
    expect(build).not.toHaveBeenCalled();
  });
});

// ── Data ────────────────────────────────────────────────────────────────────
describe("anchorData", function () {
  it("tabs follow Settings: sections, safeHarborEnabled, vault hidden sections", function () {
    expect(D.visibleAnchorTabs({}).map(function (t) { return t.id; })).toEqual(["vault", "safeharbor", "home", "people", "cove", "horizon"]);
    var ids = D.visibleAnchorTabs({ sections: { home: false, cove: false }, featureFlags: { safeHarborEnabled: false } }).map(function (t) { return t.id; });
    expect(ids).toEqual(["vault", "people", "horizon"]);
    expect(D.visibleAnchorTabs({ anchorHidden: { safeharbor: true } }).map(function (t) { return t.id; })).not.toContain("safeharbor");
    var allHidden = {}; D.VAULT_SECTIONS.forEach(function (s) { allHidden[s.id] = true; });
    expect(D.visibleAnchorTabs({ anchorHidden: allHidden }).map(function (t) { return t.id; })).not.toContain("vault");
  });

  it("vault sections count records and drop hidden / feature-off sections", function () {
    var secs = D.vaultSections({
      inventory: { pantry: [{}, {}], cleaning: [{}] }, vaultSystems: [{}], ownedProducts: [{}], houseFile: [{}],
      health: { p1: { medications: [{}, {}], allergies: [{}], generalNote: "x" } }, career: { p1: { jobs: [{}], wins: [{}, {}] } },
      subs: [{}], celebrations: [{ name: "A", type: "birthday" }], birthdays: [{ name: "A" }, { name: "B" }], pets: [{}], trips: [{}, {}],
    }, { subs: true }, { careerEnabled: false });
    var byId = {}; secs.forEach(function (s) { byId[s.id] = s.count; });
    expect(byId).toEqual({ inventory: 3, systems: 3, health: 4, gifts: 2, pets: 1, trips: 2 });
  });

  it("sensitive records: masked travel values carry the secret; health note is PIN-only", function () {
    var r = D.sensitiveRecords({ passportName: "Sam Lee", passportNum: "X123", tsaNum: " ", luggage: [{ id: "b", description: "Blue bag", lockCode: "042" }] },
      { p1: { generalNote: "private" } }, [{ id: "p1", name: "Sam" }], {}, {});
    expect(r.map(function (x) { return [x.hint, x.value, x.pin]; })).toEqual([
      ["Passport number · Sam Lee", "X123", false], ["Blue bag lock code", "042", false], ["Private health note · Sam", null, true]]);
    expect(D.sensitiveRecords({ passportNum: "X" }, {}, [], { trips: true }, {})).toEqual([]);
  });

  it("Safe Harbor: readiness, cumulative 10/30/60 tiers, Six P's, plan", function () {
    expect(D.safeHarborModel(null)).toBe(null);
    var m = D.safeHarborModel({
      grabItems: [
        { tier: 1, category: "people", checked: true }, { tier: 1, category: "papers", checked: false },
        { tier: 2, category: "people", checked: true }, { tier: 3, category: "priceless", checked: true },
        { tier: 1, category: "phones", checked: true, removed: true },
      ],
      contacts: { meetNearby: "Front yard", outOfStateContact: "" }, members: [{ id: "m", name: "Sam", role: "Adult" }],
    });
    expect(m.readiness).toBe(50);
    expect(m.tiers.map(function (t) { return [t.minutes, t.done, t.total]; })).toEqual([[10, 1, 2], [30, 2, 3], [60, 3, 4]]);
    var p = {}; m.sixPs.forEach(function (x) { p[x.id] = x.complete; });
    expect(p).toEqual({ people: true, prescriptions: false, papers: false, phones: false, personal: false, priceless: true });
    expect(m.plan[0]).toEqual({ key: "meetNearby", label: "Meet nearby", value: "Front yard" });
    expect(m.members).toEqual([{ id: "m", name: "Sam", role: "Adult" }]);
  });

  it("Home: rotating zone unless pinned; soonest maintenance incl. computed next date", function () {
    var zones = [{ name: "Z0", tasks: [] }, { name: "Z1", tasks: [{ done: true }, {}] }];
    expect(D.todayZone({ zones: zones }, NOW).name).toBe("Z1"); // 13 % 2
    expect(D.todayZone({ zones: zones, activeZoneIndex: 0, zonePinned: true }, NOW).name).toBe("Z0");
    expect(D.todayZone({ zones: [] }, NOW)).toBe(null);
    var m = D.nextMaintenance([{ name: "Gutters", nextDue: "2026-12-01" }, { name: "Filter", lastDone: "2026-08-20", freq: "3m" }, { name: "None" }], NOW);
    expect(m).toEqual({ name: "Filter", due: "2026-11-20", days: 7 });
  });

  it("People: one card per member then pet; Cove: recent notes + list progress, no pin; Horizon sorted", function () {
    var c = D.peopleCards([{ id: "a", name: "Ana", role: "Adult" }, { id: "k", name: "Kit", role: "Kid" }, { id: "x", name: "" }],
      [{ id: "d", name: "Rex", type: "Dog", vaccines: [{ name: "Rabies", due: "2026-11-20" }] }], { a: { medications: [{}] } }, NOW);
    expect(c.map(function (x) { return [x.kind, x.name, x.status]; })).toEqual([
      ["person", "Ana", "1 active med"], ["person", "Kit", "No health records yet"], ["pet", "Rex", "Rabies in 7d"]]);
    var cv = D.coveSummary([{ id: "1", title: "Old", updatedAt: 1 }, { id: "2", title: "New", updatedAt: 9 }], [{ id: "L", title: "Pack" }], { L: [{ checked: true }, {}] });
    expect(cv.pinned).toBe(null);
    expect(cv.notes.map(function (n) { return n.title; })).toEqual(["New", "Old"]);
    expect(cv.lists[0]).toEqual({ id: "L", title: "Pack", done: 1, total: 2, pct: 50 });
    var ev = D.horizonEvents([{ id: "t", name: "Beach", startDate: "2026-11-20" }, { id: "p", name: "Past", startDate: "2026-11-01" }], [{ id: "c", name: "Bday", month: 11, day: 15 }], NOW);
    expect(ev.map(function (e) { return [e.name, e.days]; })).toEqual([["Bday", 2], ["Beach", 7]]);
  });
});

// ── Screen ──────────────────────────────────────────────────────────────────
describe("RedesignAnchor screen", function () {
  function seedAll() {
    set("people", [{ id: "p1", name: "Ana", role: "Adult", color: "#4A7FA8" }]);
    set("pets", [{ id: "d", name: "Rex", type: "Dog" }]);
    set("inventory", { pantry: [{ name: "Rice" }] });
    set("travel_profile", { passportName: "Ana B", passportNum: "P9988" });
    set("health", { p1: { generalNote: "secret note" } });
    set("safe_harbor", { grabItems: [{ id: "g", tier: 1, category: "people", checked: true }], contacts: { meetNearby: "Oak tree" }, members: [] });
    set("home_cleaning", { zones: [{ name: "Kitchen", rooms: "Kitchen", tasks: [{ done: false }] }] });
    set("vaultSystems", [{ name: "HVAC filter", nextDue: "2026-11-15" }]);
    set("cove_notes_v1", [{ id: "n1", title: "Gift ideas", body: "Books", updatedAt: 5 }]);
    set("cove_lists_v1", [{ id: "L1", title: "Camping" }]);
    set("cove_items_v1", { L1: [{ checked: true }, { checked: false }] });
    set("trips", [{ id: "t", name: "Beach", startDate: "2026-11-20" }]);
  }

  it("navy page, back to Home, gear to Settings, 3-per-row tabs, no sideways scroll", async function () {
    var onBack = vi.fn(), onSettings = vi.fn();
    await render(h(RedesignAnchor, { now: now, onBack: onBack, onSettings: onSettings }));
    var page = q('[data-testid="redesign-anchor"]');
    expect(page.style.background).toMatch(/27, 43, 68|1B2B44/i);
    expect(page.style.overflowX).toBe("hidden");
    expect(q('[role="tablist"]').style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
    expect(tabIds()).toEqual(["vault", "safeharbor", "home", "people", "cove", "horizon"]);
    await click(q('[aria-label="Back to Home"]'));
    await click(q('[data-testid="anchor-settings"]'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it("only shows tabs turned on in Settings", async function () {
    set("anchor_hidden", { safeharbor: true });
    await render(h(RedesignAnchor, { now: now, sections: { people: false, horizon: false }, featureFlags: {} }));
    expect(tabIds()).toEqual(["vault", "home", "cove"]);
  });

  it("Vault: counts; sensitive rows always locked, hint only until tapped; PIN note opens Health", async function () {
    seedAll();
    var onOpenVault = vi.fn(), onDash = vi.fn();
    await render(h(RedesignAnchor, { now: now, onOpenVault: onOpenVault, onOpenVaultDashboard: onDash }));
    expect(q('[data-testid="vault-inventory"]').textContent).toContain("1 record");
    var pass = q('[data-testid="sensitive-passport"]');
    expect(pass.textContent).toContain("🔒"); // showEmojis is off, lock still shown
    expect(pass.textContent).toContain("Passport number · Ana B");
    expect(pass.textContent).not.toContain("P9988");
    await click(pass);
    expect(q('[data-testid="sensitive-passport"]').textContent).toContain("P9988");
    await click(q('[data-testid="sensitive-passport"]'));
    expect(q('[data-testid="sensitive-passport"]').textContent).not.toContain("P9988");
    var note = q('[data-testid="sensitive-hnote-p1"]');
    expect(note.textContent).toContain("🔒");
    expect(container.textContent).not.toContain("secret note");
    await click(note);
    expect(container.textContent).not.toContain("secret note");
    expect(onOpenVault).toHaveBeenCalledWith("health");
    await click(q('[data-testid="vault-inventory"]'));
    expect(onOpenVault).toHaveBeenLastCalledWith("inventory");
    await click(q('[data-testid="open-full"]'));
    expect(onDash).toHaveBeenCalledTimes(1);
  });

  it("showEmojis: item icons hidden by default, shown when on; pillar icon always", async function () {
    seedAll();
    await render(h(RedesignAnchor, { now: now }));
    expect(q("h1").textContent).toContain("🏠");
    expect(q('[data-testid="anchortab-cove"]').textContent).not.toContain("🪸");
    expect(q('[data-testid="vault-inventory"]').textContent).not.toContain("📦");
    act(function () { root.unmount(); }); root = createRoot(container);
    set("showEmojis", true);
    await render(h(RedesignAnchor, { now: now }));
    expect(q('[data-testid="anchortab-cove"]').textContent).toContain("🪸");
    expect(q('[data-testid="vault-inventory"]').textContent).toContain("📦");
  });

  it("Safe Harbor card: readiness, 10/30/60 progress, Six P checks, family plan; full view", async function () {
    seedAll();
    var onOpenVault = vi.fn();
    await render(h(RedesignAnchor, { now: now, onOpenVault: onOpenVault }));
    await pick("safeharbor");
    expect(q('[data-testid="sh-readiness"]').textContent).toBe("100%");
    expect(qa('[data-testid^="sh-tier-"]').map(function (e) { return e.getAttribute("data-testid"); })).toEqual(["sh-tier-10", "sh-tier-30", "sh-tier-60"]);
    expect(q('[data-testid="sixp-people"]').getAttribute("data-complete")).toBe("true");
    expect(q('[data-testid="sixp-papers"]').getAttribute("data-complete")).toBe("false");
    expect(summary()).toContain("Oak tree");
    await click(q('[data-testid="open-full"]'));
    expect(onOpenVault).toHaveBeenCalledWith("safeharbor");
  });

  it("Home, People, Cove, Horizon cards from real data; full view opens the tab", async function () {
    seedAll();
    var onOpenTab = vi.fn();
    await render(h(RedesignAnchor, { now: now, onOpenTab: onOpenTab }));
    await pick("home");
    expect(q('[data-testid="home-zone"]').textContent).toContain("Kitchen");
    expect(q('[data-testid="home-maint"]').textContent).toContain("HVAC filter");
    expect(q('[data-testid="home-maint"]').textContent).toContain("in 2 days");
    await click(q('[data-testid="open-full"]'));
    expect(onOpenTab).toHaveBeenLastCalledWith("home", "Home");

    await pick("people");
    expect(qa('[data-testid^="person-"]').map(function (e) { return e.textContent.slice(0, 3); })).toEqual(["Ana", "Rex"]);

    await pick("cove");
    expect(q('[data-testid="cove-note-n1"]').textContent).toContain("Gift ideas");
    expect(q('[data-testid="cove-list-L1"]').textContent).toContain("1 of 2");
    expect(q('[data-testid="cove-list-L1"] [role="progressbar"]').getAttribute("aria-valuenow")).toBe("50");

    await pick("horizon");
    expect(q('[data-testid="horizon-trip-t"]').textContent).toContain("in 7 days");
    await click(q('[data-testid="open-full"]'));
    expect(onOpenTab).toHaveBeenLastCalledWith("horizon", "Horizon");
  });

  it("calm empty states with no data", async function () {
    await render(h(RedesignAnchor, { now: now }));
    for (var id of ["safeharbor", "home", "people", "cove", "horizon"]) {
      await pick(id);
      expect(summary().length).toBeGreaterThan(10);
    }
    await pick("safeharbor");
    expect(summary()).toContain("Not set up yet");
  });
});
