// tests/ui/redesign-flow-screens.test.js — the redesigned Flow full views
// (af_redesign): Shopping, Meals, Calendar, Waves, Tide Pool, Lighthouse.
// Covers the shared pieces (header, pill tabs, the 22px sage check), each
// screen's spec items, showEmojis, the pure helpers, and the App.jsx wiring
// (flag off never builds the new screens; the legacy markup is untouched —
// the rendered proof of that is flow-screens-legacy.test.js).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import fs from "node:fs";
import { FullViewHeader, PillTabs, CheckRow, CheckCircle, EmojiScope } from "../../src/redesign/FullView.jsx";
import { stripDecorativeEmoji, rdLegacyKit, RD_T, RD_YEAR_CAT_COLORS, RD_LH_CARD } from "../../src/redesign/fullViewKit.js";
import { groupByAisle, calendarDay, monthCells } from "../../src/redesign/fullViewData.js";
import ShoppingFull from "../../src/redesign/ShoppingFull.jsx";
import TidePoolFull from "../../src/redesign/TidePoolFull.jsx";
import WavesFull from "../../src/redesign/WavesFull.jsx";
import CalendarFull from "../../src/redesign/CalendarFull.jsx";
import MealsFull, { PrepTask } from "../../src/redesign/MealsFull.jsx";
import LighthouseFull from "../../src/redesign/LighthouseFull.jsx";
import { check, color, person, workDayTag } from "../../src/design/tokens.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
var h = React.createElement;
var container, root;
beforeEach(function () { localStorage.clear(); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(function () { act(function () { root.unmount(); }); container.remove(); });
async function render(el) { await act(async function () { root.render(el); }); }
async function click(el) { await act(async function () { el.click(); }); }
function q(sel) { return container.querySelector(sel); }
function qa(sel) { return Array.from(container.querySelectorAll(sel)); }
function byText(sel, t) { return qa(sel).find(function (e) { return e.textContent.trim() === t; }); }
function hexToRgb(hex) { var x = hex.replace("#", ""); return "rgb(" + [0, 2, 4].map(function (i) { return parseInt(x.slice(i, i + 2), 16); }).join(", ") + ")"; }
function hsl(hex) {
  var x = hex.replace("#", ""), r = parseInt(x.slice(0, 2), 16) / 255, g = parseInt(x.slice(2, 4), 16) / 255, b = parseInt(x.slice(4, 6), 16) / 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min, s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), hh = 0;
  if (d) { if (max === r) hh = ((g - b) / d) % 6; else if (max === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; hh = (hh * 60 + 360) % 360; }
  return { h: hh, s: s };
}

// ── Shared pieces ───────────────────────────────────────────────────────────
describe("full-view chrome", function () {
  it("header: ← Flow back button (goes to the Flow tab), Cormorant title, one-line subtitle", async function () {
    var seen = [];
    function on(e) { seen.push(e.detail); }
    window.addEventListener("af-set-tab", on);
    await render(h(FullViewHeader, { title: "Shopping", subtitle: "4 items left", emoji: "🛒", showEmojis: false }));
    var back = q('[data-testid="fullview-back"]');
    expect(back.textContent).toBe("←Flow");
    await click(back);
    expect(seen).toEqual(["flowhome"]);
    window.removeEventListener("af-set-tab", on);
    expect(q("h1").style.fontFamily).toMatch(/Cormorant Garamond/);
    var sub = q('[data-testid="fullview-subtitle"]');
    expect(sub.textContent).toBe("4 items left");
    expect(sub.style.whiteSpace).toBe("nowrap");
    expect(sub.style.textOverflow).toBe("ellipsis");
    expect(container.textContent).not.toContain("🛒");
  });

  it("pill tabs: rounded, wrap instead of scrolling, one selected", async function () {
    var picked = vi.fn();
    await render(h(PillTabs, { tabs: [{ id: "a", label: "One" }, { id: "b", label: "Two", count: 3 }], value: "a", onChange: picked }));
    var list = q('[role="tablist"]');
    expect(list.style.flexWrap).toBe("wrap");
    expect(list.style.overflowX).toBe("");
    var tabs = qa('[role="tab"]');
    tabs.forEach(function (t) { expect(t.style.borderRadius).toBe("999px"); });
    expect(tabs.map(function (t) { return t.getAttribute("aria-selected"); })).toEqual(["true", "false"]);
    await click(tabs[1]);
    expect(picked).toHaveBeenCalledWith("b");
  });

  it("check: 22px sage circle; done = filled, text crossed out at 45% opacity, 14px DM Sans", async function () {
    var toggle = vi.fn();
    await render(h("div", null,
      h(CheckRow, { testId: "open", text: "Bananas", done: false, onToggle: toggle }),
      h(CheckRow, { testId: "done", text: "Sourdough", done: true, onToggle: toggle })));
    var circles = qa('[data-testid="check"]');
    circles.forEach(function (c) {
      expect(c.style.width).toBe("22px");
      expect(c.style.height).toBe("22px");
      expect(c.style.borderRadius).toBe("50%");
      expect(c.style.border).toContain(hexToRgb(check.color));
    });
    expect(check.color).toBe("#7A9E8E");
    expect(circles[0].style.background).toBe("transparent");
    expect(circles[1].style.background).toBe(hexToRgb(check.color));
    var texts = qa('[data-testid="row-text"]');
    expect(texts[0].style.opacity).toBe("1");
    expect(texts[0].style.textDecoration).toBe("none");
    expect(texts[1].style.opacity).toBe("0.45");
    expect(texts[1].style.textDecoration).toBe("line-through");
    texts.forEach(function (t) { expect(t.style.fontSize).toBe("14px"); expect(t.style.fontFamily).toMatch(/^"?DM Sans/); });
    await click(circles[0]);
    await click(texts[0]);
    expect(toggle).toHaveBeenCalledTimes(2);
  });

  it("decorative check (inside another button) is a span, not a nested button", async function () {
    await render(h("button", null, h(CheckCircle, { decorative: true, done: true })));
    expect(q("button button")).toBe(null);
    expect(q('span[data-testid="check"]').getAttribute("data-done")).toBe("true");
  });
});

// ── showEmojis for reused legacy bodies ─────────────────────────────────────
describe("showEmojis", function () {
  it("stripDecorativeEmoji drops leading/trailing/standalone emoji, keeps ratings, pillar and lock icons", function () {
    expect(stripDecorativeEmoji("✨ Get smart prep tips")).toBe("Get smart prep tips");
    expect(stripDecorativeEmoji("🫙")).toBe("");
    expect(stripDecorativeEmoji("Keep saving 🐚")).toBe("Keep saving");
    expect(stripDecorativeEmoji("👨‍👩‍👧 Family")).toBe("Family");
    expect(stripDecorativeEmoji("⭐⭐⭐")).toBe("⭐⭐⭐");
    expect(stripDecorativeEmoji("🔒 Private")).toBe("🔒 Private");
    expect(stripDecorativeEmoji("⚓ Anchor")).toBe("⚓ Anchor");
    expect(stripDecorativeEmoji("10 🐚 · 2 more")).toBe("10 🐚 · 2 more");
    expect(stripDecorativeEmoji("✓ Clear completed")).toBe("✓ Clear completed");
  });

  it("EmojiScope strips when off, leaves text alone when on, and re-strips after React updates", async function () {
    function Body(p) { return h("div", null, h("span", null, p.label), h("input", { defaultValue: "🍕 pizza", readOnly: true })); }
    await render(h(EmojiScope, { showEmojis: false }, h(Body, { label: "🌙 Tonight" })));
    expect(q("span").textContent).toBe("Tonight");
    expect(q("input").value).toBe("🍕 pizza"); // inputs untouched
    await render(h(EmojiScope, { showEmojis: false }, h(Body, { label: "✨ Week type" })));
    await act(async function () { await new Promise(function (r) { setTimeout(r, 0); }); });
    expect(q("span").textContent).toBe("Week type");
    await render(h(EmojiScope, { showEmojis: true }, h(Body, { label: "✨ Week type" })));
    expect(q("span").textContent).toBe("✨ Week type");
  });
});

// ── Shopping ────────────────────────────────────────────────────────────────
function catLabel(c) { return typeof c === "string" ? c : c.label; }
function catEmoji(c) { return typeof c === "string" ? "" : c.emoji || ""; }
function catId(c) { return typeof c === "string" ? c : c.id; }
var STORES = [{ id: "grocery", label: "Grocery", emoji: "🛒", hasCats: true }, { id: "costco", label: "Costco", emoji: "🏪", hasCats: true }, { id: "target", label: "Target", emoji: "🎯", hasCats: false }];
var CATS = [{ id: "produce", label: "Produce", emoji: "🥦" }, { id: "dairy", label: "Dairy", emoji: "🥛" }];
function shopProps(over) {
  return Object.assign({
    items: [
      { id: "s1", text: "Bananas", store: "Grocery", done: false, category: "Produce" },
      { id: "s2", text: "Yogurt", store: "Grocery", done: false, category: "Dairy" },
      { id: "s3", text: "Bread", store: "Grocery", done: true, category: "" },
      { id: "s4", text: "Towels", store: "Costco", done: false, category: "" },
    ],
    stores: STORES, activeStore: "Grocery", normalizeStore: function (s) { return s; },
    onSelectStore: vi.fn(), categories: CATS, setCategories: vi.fn(), catLabel: catLabel, catEmoji: catEmoji, catId: catId,
    sort: function (l) { return l; }, az: false, toggleAZ: vi.fn(),
    onAdd: vi.fn(), onToggle: vi.fn(), onDelete: vi.fn(), onSave: vi.fn(), onMove: vi.fn(), onClearCompleted: vi.fn(), onClearAll: vi.fn(),
    voice: { listening: false, start: vi.fn(), stop: vi.fn() }, photo: { busy: false, pick: vi.fn() }, autoSort: { busy: false, run: vi.fn() },
    status: "", showEmojis: false,
  }, over || {});
}

describe("Shopping", function () {
  it("stores are pill tabs with open counts; picking one selects where items go", async function () {
    var p = shopProps();
    await render(h(ShoppingFull, p));
    var tabs = qa('[role="tab"]');
    expect(tabs.map(function (t) { return t.textContent; })).toEqual(["Grocery2", "Costco1", "Target"]);
    await click(tabs[1]);
    expect(p.onSelectStore).toHaveBeenCalledWith("Costco");
    expect(q('[data-testid="fullview-subtitle"]').textContent).toBe("3 items left across 2 stores");
  });

  it("rows grouped by aisle with the sage check; done crossed out; checking goes through onToggle", async function () {
    var p = shopProps();
    await render(h(ShoppingFull, p));
    var list = q('[data-testid="shop-list"]');
    expect(list.textContent).toContain("Produce");
    expect(list.textContent).toContain("Dairy");
    var bread = q('[data-testid="shop-item-s3"] [data-testid="row-text"]');
    expect(bread.style.textDecoration).toBe("line-through");
    expect(bread.style.opacity).toBe("0.45");
    await click(q('[data-testid="shop-item-s1"] [data-testid="check"]'));
    expect(p.onToggle).toHaveBeenCalledWith("s1", false);
  });

  it("keeps in-store mode: big tap rows by aisle, done items move to the cart, Done shopping exits", async function () {
    var p = shopProps();
    await render(h(ShoppingFull, p));
    await click(q('[data-testid="instore-enter"]'));
    expect(q('[data-testid="in-store"]')).not.toBe(null);
    var row = q('[data-testid="instore-item-s1"]');
    expect(parseInt(row.style.minHeight, 10)).toBeGreaterThanOrEqual(48);
    expect(q('[data-testid="in-store"]').textContent).toContain("In the cart · 1");
    await click(row);
    expect(p.onToggle).toHaveBeenCalledWith("s1", false);
    await click(q('[data-testid="instore-exit"]'));
    expect(q('[data-testid="in-store"]')).toBe(null);
  });

  it("adds to the selected store", async function () {
    var p = shopProps();
    await render(h(ShoppingFull, p));
    var input = q('[data-testid="shop-add"] input');
    await act(async function () { var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(input, "Milk"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await click(q('[data-testid="shop-add-btn"]'));
    expect(p.onAdd).toHaveBeenCalledWith("Milk", "Grocery");
  });

  it("showEmojis on shows store and aisle emoji; off hides them", async function () {
    await render(h(ShoppingFull, shopProps({ showEmojis: true })));
    expect(container.textContent).toContain("🛒");
    expect(container.textContent).toContain("🥦");
    await render(h(ShoppingFull, shopProps({ showEmojis: false })));
    expect(container.textContent).not.toContain("🛒");
    expect(container.textContent).not.toContain("🥦");
  });

  it("groupByAisle keeps Settings order and puts uncategorized last", function () {
    var g = groupByAisle([{ id: 1, category: "Dairy" }, { id: 2, category: "" }, { id: 3, category: "Produce" }, { id: 4, category: "Snacks" }], CATS, catLabel, catEmoji);
    expect(g.map(function (x) { return x.label; })).toEqual(["Produce", "Dairy", "Snacks", "Other"]);
  });
});

// ── Tide Pool ───────────────────────────────────────────────────────────────
function tpKids() {
  return [
    { kidId: "k1", kidName: "June", shells: 7, chores: [{ id: "c1", name: "Make bed", pts: 1, done: true }, { id: "c2", name: "Feed cat", pts: 2, done: false }], treasures: [], rewardHistory: [{ id: "r1", name: "Movie pick", icon: "🎬", cost: 20, date: "2026-11-01T18:00:00Z" }], bonusHistory: [] },
    { kidId: "k2", kidName: "Ollie", shells: 12, chores: [], treasures: [], rewardHistory: [], bonusHistory: [] },
  ];
}
function tpProps(over) {
  var kids = tpKids();
  return Object.assign({
    kids: kids, kid: kids[0], selIdx: 0, goal: 10, onSelectKid: vi.fn(), onToggleChore: vi.fn(),
    bonusReason: "", setBonusReason: vi.fn(), onBonus: vi.fn(),
    treasures: [{ id: "t1", name: "Extra screen time", icon: "📱", cost: 10 }, { id: "t2", name: "Special outing", icon: "🎡", cost: 35 }],
    selectedTreasure: null, onSelectTreasure: vi.fn(), onClaim: vi.fn(), claimed: null, onDismissClaim: vi.fn(), showEmojis: false,
  }, over || {});
}

describe("Tide Pool", function () {
  it("each kid's shells big, with a progress bar to the chest goal", async function () {
    await render(h(TidePoolFull, tpProps()));
    var june = q('[data-testid="tp-kid-k1"]'), ollie = q('[data-testid="tp-kid-k2"]');
    expect(june.querySelector('[data-testid="tp-shells"]').textContent).toBe("7");
    expect(parseInt(june.querySelector('[data-testid="tp-shells"]').style.fontSize, 10)).toBeGreaterThanOrEqual(44);
    var bar = june.querySelector('[role="progressbar"]');
    expect(bar.getAttribute("aria-valuenow")).toBe("7");
    expect(bar.getAttribute("aria-valuemax")).toBe("10");
    expect(bar.firstChild.style.width).toBe("70%");
    expect(june.textContent).toContain("3 more to open the chest");
    expect(ollie.querySelector('[role="progressbar"]').firstChild.style.width).toBe("100%");
    expect(ollie.textContent).toContain("Chest ready to open");
  });

  it("earn: chores use the sage check; bonus buttons +1/+2/+3 need a reason", async function () {
    var p = tpProps();
    await render(h(TidePoolFull, p));
    var done = q('[data-testid="tp-chore-c1"] [data-testid="row-text"]');
    expect(done.style.textDecoration).toBe("line-through");
    await click(q('[data-testid="tp-chore-c2"] [data-testid="check"]'));
    expect(p.onToggleChore).toHaveBeenCalledWith("c2");
    [1, 2, 3].forEach(function (n) { expect(q('[data-testid="tp-earn-' + n + '"]').disabled).toBe(true); });
    await render(h(TidePoolFull, tpProps({ bonusReason: "Helped", onBonus: p.onBonus })));
    await click(q('[data-testid="tp-earn-2"]'));
    expect(p.onBonus).toHaveBeenCalledWith(2);
  });

  it("treasure list: cost, what's affordable, choose then claim", async function () {
    var kids = tpKids();
    var p = tpProps({ kid: kids[1], selIdx: 1 });
    await render(h(TidePoolFull, p));
    await click(q('[data-testid="tp-tab-treasures"]'));
    var t1 = q('[data-testid="tp-treasure-t1"]'), t2 = q('[data-testid="tp-treasure-t2"]');
    expect(t1.textContent).toContain("Extra screen time");
    expect(t2.textContent).toContain("23 more");
    expect(byText("button", "Choose")).toBeTruthy();
    await click(byText("button", "Choose"));
    expect(p.onSelectTreasure).toHaveBeenCalledWith(p.treasures[0]);
    await render(h(TidePoolFull, Object.assign({}, p, { selectedTreasure: p.treasures[0] })));
    await click(q('[data-testid="tp-claim"]'));
    expect(p.onClaim).toHaveBeenCalled();
  });

  it("showEmojis: shells read as words when off, 🐚 when on", async function () {
    await render(h(TidePoolFull, tpProps()));
    expect(container.textContent).not.toContain("🐚");
    expect(container.textContent).toContain("+2 shells");
    await render(h(TidePoolFull, tpProps({ showEmojis: true })));
    expect(container.textContent).toContain("🐚");
  });
});

// ── Waves ───────────────────────────────────────────────────────────────────
function wavesApi() {
  return { add: vi.fn(), rename: vi.fn(), schedule: vi.fn(), remove: vi.fn(), addTask: vi.fn(), updateTask: vi.fn(), deleteTask: vi.fn(), reset: vi.fn(),
    scheduleLabel: function (t) { return t === "daily" ? "Resets daily" : "Resets weekly"; }, daysAgo: function () { return "today"; }, toDays: function (v) { return parseInt(v, 10) || null; },
    dayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], monthLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };
}
var WAVES = {
  daily: [{ id: "w1", name: "Morning reset", tasks: [{ id: "t1", text: "Make beds", done: true }, { id: "t2", text: "Vitamins", done: false }] }],
  weekly: [{ id: "w2", name: "Laundry day", dayOfWeek: 5, tasks: [] }], seasonal: [], custom: [],
};

describe("Waves", function () {
  it("Daily / Weekly / Seasonal / Custom are pill tabs; tasks use the sage check", async function () {
    var api = wavesApi();
    await render(h(WavesFull, { waves: WAVES, api: api, showEmojis: false }));
    expect(qa('[role="tab"]').map(function (t) { return t.textContent; })).toEqual(["Daily1", "Weekly1", "Seasonal", "Custom"]);
    expect(q('[data-testid="wave-task-t1"] [data-testid="row-text"]').style.opacity).toBe("0.45");
    await click(q('[data-testid="wave-task-t2"] [data-testid="check"]'));
    expect(api.updateTask).toHaveBeenCalledWith("daily", "w1", "t2", { done: true });
    await click(q('[data-testid="waves-tab-weekly"]'));
    expect(container.textContent).toContain("Laundry day");
    expect(container.textContent).not.toContain("Morning reset");
  });
});

// ── Calendar ────────────────────────────────────────────────────────────────
var PEOPLE = [
  { id: "p_lin", name: "Lindsey", role: "Parent" }, { id: "p_twy", name: "Twyla", role: "Parent" },
  { id: "p_jun", name: "June", role: "Kid" }, { id: "p_oll", name: "Ollie", role: "Kid" },
];
function calData(over) {
  return Object.assign({
    calEvents: [
      { id: "e1", date: "2026-11-13", time: "15:30", title: "Soccer", forPerson: "p_jun" },
      { id: "e2", date: "2026-11-13", time: "18:00", title: "Dinner out", forPerson: "p_twy" },
    ],
    workSchedules: { p_lin: { scheduleType: "set", days: { Friday: [{ start: "09:00", end: "13:00" }] } }, p_twy: { scheduleType: "on-call", onCallDays: ["Tuesday"] } },
    people: PEOPLE, myPersonId: "p_lin", workDays: { "2026-11-17": { type: "office" } }, calMarkers: {}, isPersonMinor: function () { return false; },
  }, over || {});
}
function calProps(over) {
  var vd = new Date(2026, 10, 13);
  return Object.assign({
    view: "month", viewDate: vd, today: vd, selectedDay: null, weekDates: [8, 9, 10, 11, 12, 13, 14].map(function (d) { return new Date(2026, 10, d); }),
    navTitle: "November 2026", onPrev: vi.fn(), onNext: vi.fn(), onView: vi.fn(), onSelectDay: vi.fn(), onOpenDay: vi.fn(),
    filter: "all", onFilter: vi.fn(), isDimmed: function () { return false; }, data: calData(),
    onAddEvent: vi.fn(), onEditEvent: vi.fn(), onDeleteEvent: vi.fn(), hasReminder: function () { return false; }, onRemind: vi.fn(),
    workLabel: function () { return "9am–1pm"; }, workDayTypeLabel: function () { return "In the office"; }, personName: function (id) { return id; },
    markerLabel: function () { return ""; }, onMarker: vi.fn(), onOpenWorkSchedules: vi.fn(), onEditWorkSchedule: vi.fn(),
    markerPicker: null, workDayStrip: null, workScheduleModal: null, reminderForm: null, yearView: null, googleConnected: false, onCalSync: vi.fn(), showEmojis: false,
  }, over || {});
}

describe("Calendar", function () {
  it("Month / Week / Day / Year are pill tabs", async function () {
    var p = calProps();
    await render(h(CalendarFull, p));
    expect(qa('[role="tab"]').map(function (t) { return t.textContent; })).toEqual(["Month", "Week", "Day", "Year"]);
    await click(q('[data-testid="cal-view-week"]'));
    expect(p.onView).toHaveBeenCalledWith("week");
  });

  it("keeps person dots in the person colors", async function () {
    await render(h(CalendarFull, calProps()));
    var dots = qa('[data-testid="cal-day-2026-11-13"] [data-testid="person-dot"]').map(function (d) { return d.getAttribute("data-color"); });
    expect(dots).toEqual([person.kids[0], person.twyla]);
  });

  it("work days are neutral striped tags with initials (schedules and the device's own work day)", async function () {
    await render(h(CalendarFull, calProps()));
    function tags(iso) { return qa('[data-testid="cal-day-' + iso + '"] span[title]').filter(function (s) { return s.style.background.indexOf("repeating-linear-gradient") !== -1; }); }
    var fri = tags("2026-11-13");
    expect(fri.map(function (t) { return t.textContent; })).toEqual(["LI"]);
    expect(fri[0].style.background).toContain("repeating-linear-gradient");
    expect(fri[0].style.color).toBe(hexToRgb(workDayTag.text));
    expect(tags("2026-11-17").map(function (t) { return t.textContent; })).toEqual(["TW", "LI"]);
    expect([person.lindsey, person.twyla].map(hexToRgb)).not.toContain(fri[0].style.color);
  });

  it("selected day lists events (tap to edit) and work; week rows open the day", async function () {
    var p = calProps({ selectedDay: new Date(2026, 10, 13) });
    await render(h(CalendarFull, p));
    var card = q('[data-testid="cal-selected"]');
    expect(card.textContent).toContain("Soccer");
    expect(card.textContent).toContain("for June");
    expect(card.textContent).toContain("9am–1pm");
    await click(card.querySelector('button[aria-label="Edit Soccer"]'));
    expect(p.onEditEvent).toHaveBeenCalled();
    await render(h(CalendarFull, calProps({ view: "week", onOpenDay: p.onOpenDay })));
    expect(q('[data-testid="cal-week"]').textContent).toContain("15:30 · Soccer");
  });

  it("calendarDay / monthCells", function () {
    var d = calendarDay(new Date(2026, 10, 17), calData());
    expect(d.work.map(function (w) { return w.initials; })).toEqual(["TW", "LI"]);
    expect(d.work[1].workDayType).toBe("office");
    var off = calendarDay(new Date(2026, 10, 17), calData({ workDays: { "2026-11-17": { type: "off" } } }));
    expect(off.work.map(function (w) { return w.initials; })).toEqual(["TW"]);
    var cells = monthCells(2026, 10); // Nov 2026 starts on a Sunday
    expect(cells[0].getDate()).toBe(1);
    expect(cells.length).toBe(30);
    expect(monthCells(2026, 11).slice(0, 2)).toEqual([null, null]); // Dec 1 is a Tuesday
  });
});

// ── Meals ───────────────────────────────────────────────────────────────────
describe("Meals", function () {
  function weekProps() {
    return { days: ["Sunday", "Monday"], mealsToShow: ["breakfast", "dinner"], meals: { Monday: { dinner: "Tacos" } }, todayName: "Monday",
      mealCount: 2, setMealCount: vi.fn(), onRotate: vi.fn(), swapDay: null, setSwapDay: vi.fn(), onSwapWith: vi.fn(), onEdit: vi.fn(), onTonight: vi.fn(),
      themeFor: function () { return null; }, bankInfo: function () { return null; }, renderBankPicker: function () { return null; } };
  }
  it("sub-sections (and Recipes) are pill tabs; Tonight shows as a pill while open", async function () {
    var onTab = vi.fn();
    await render(h(MealsFull, { tab: "week", onTab: onTab, week: weekProps(), weekTypeLabel: "Week type", onWeekType: vi.fn(), showEmojis: false }));
    expect(qa('[role="tab"]').map(function (t) { return t.textContent; })).toEqual(["This Week", "Next Week", "Month", "Prep", "SOS", "Meal Bank", "Recipes"]);
    await click(q('[data-testid="meals-tab-recipes"]'));
    expect(onTab).toHaveBeenCalledWith("recipes");
    expect(q('[data-testid="meals-day-Monday"]').textContent).toContain("Tacos");
    await render(h(MealsFull, { tab: "tonight", onTab: onTab, week: weekProps(), body: h("div", null, "🌙 Tonight body"), weekTypeLabel: "Week type", onWeekType: vi.fn(), showEmojis: false }));
    expect(q('[data-testid="meals-tab-tonight"]').getAttribute("aria-selected")).toBe("true");
    expect(q('[data-testid="meals-body-tonight"]').textContent).toBe("Tonight body"); // reused body, emoji stripped
  });

  it("prep tasks use the sage check", async function () {
    var toggle = vi.fn();
    await render(h(PrepTask, { task: { id: "p1", text: "Wash fruit", emoji: "🍎" }, done: true, onToggle: toggle, showEmojis: false }));
    expect(q('[data-testid="row-text"]').textContent).toBe("Wash fruit");
    expect(q('[data-testid="row-text"]').style.textDecoration).toBe("line-through");
    await click(q('[data-testid="check"]'));
    expect(toggle).toHaveBeenCalled();
  });
});

// ── Lighthouse ──────────────────────────────────────────────────────────────
describe("Lighthouse", function () {
  it("children and sections are pill tabs; checkboxes inside get the sage-circle stylesheet", async function () {
    var onSection = vi.fn();
    await render(h(LighthouseFull, {
      children_: [{ id: "a", name: "June", mode: "homeschool" }, { id: "b", name: "Ollie", mode: "school" }], activeChild: "a", onChild: vi.fn(),
      sections: [{ id: "overview", label: "Overview", emoji: "✨" }, { id: "plan", label: "Plan", emoji: "🗓️" }], section: "overview", onSection: onSection, showEmojis: false,
    }, h("div", null, h("input", { type: "checkbox", defaultChecked: true }), h("span", null, "Goal"))));
    expect(qa('[role="tab"]').map(function (t) { return t.textContent; })).toEqual(["June", "Ollie", "Overview", "Plan"]);
    await click(q('[data-testid="lh-tab-plan"]'));
    expect(onSection).toHaveBeenCalledWith("plan");
    var css = q("style").textContent;
    expect(css).toContain("input[type=checkbox]{-webkit-appearance:none;appearance:none;width:22px;height:22px");
    expect(css).toContain("border-radius:50%;border:2px solid " + check.color);
    expect(css).toContain(":checked ~ *{opacity:0.45;text-decoration:line-through;}");
    expect(q('[data-testid="lh-body"]').className).toBe("rd-lighthouse");
  });
});

// ── New-look palette ────────────────────────────────────────────────────────
describe("redesign palette", function () {
  it("no purple or pink in the reused-body palette, year categories or Lighthouse cards", function () {
    var hexes = Object.keys(RD_T).map(function (k) { return RD_T[k]; }).filter(function (v) { return /^#[0-9A-Fa-f]{6}$/.test(v); })
      .concat(Object.keys(RD_YEAR_CAT_COLORS).map(function (k) { return RD_YEAR_CAT_COLORS[k]; }), ["#8F4F44", "#5E8FA0", "#4D7A6A"]);
    var bad = hexes.filter(function (x) { var c = hsl(x); return c.s > 0.12 && c.h >= 260 && c.h <= 345; });
    expect(bad).toEqual([]);
    expect(RD_T.bg).toBe(color.flowBackground);
    expect(RD_LH_CARD.background).toBe("#FFFFFF");
    var k = rdLegacyKit();
    expect(k.card().background).toBe("#FFFFFF");
    expect(k.card().borderRadius).toBeGreaterThanOrEqual(14);
    expect(k.btnP().borderRadius).toBe(999);
  });
});

// ── App.jsx wiring ──────────────────────────────────────────────────────────
describe("App.jsx wiring", function () {
  var src = fs.readFileSync("src/App.jsx", "utf8");
  function closure(name, next) { var a = src.indexOf("_hfRenders." + name + " = function"); var b = src.indexOf("_hfRenders." + next + " = function", a); return src.slice(a, b); }

  [["ShoppingTab", "HomeTab", "ShoppingFull", '<SecHead emoji="🛒" title="Shopping List"'],
   ["TidePoolTab", "SettingSection", "TidePoolFull", "🏝️ Tide Pool"],
   ["WavesSection", "MealBankDrawer", "WavesFull", '<SecHead emoji="〰️" title="Waves"'],
   ["CalendarTab", "WeeklyTab", "CalendarFull", '<SecHead emoji="📆" title="Calendar"'],
   ["MealsTab", "RecipeBookTab", "MealsFull", '<SecHead emoji="🍽️" title="Meal Rhythm"'],
   ["LearningTab", "GoogleCalendarModal", "LighthouseFull", "📚 Lighthouse"]].forEach(function (row) {
    it(row[0] + ": the redesign is returned only under REDESIGN, before the untouched legacy markup", function () {
      var body = closure(row[0], row[1]);
      var rd = body.indexOf("<" + row[2]);
      var legacy = body.lastIndexOf(row[3]);
      expect(rd).toBeGreaterThan(-1);
      expect(legacy).toBeGreaterThan(rd);
      expect(body.slice(Math.max(0, rd - 1200), rd)).toMatch(/if\s*\(\s*REDESIGN[\s)&]/);
    });
  });

  it("legacy bodies shared with the redesign get HomeFlow's own style helpers when the flag is off", function () {
    expect(src).toContain("const HF_KIT = {T:T,inp:inp,lbl:lbl,btnP:btnP,btnS:btnS,card:card};");
    ["calMarkerPicker", "calWorkDayStrip", "calWorkScheduleModal", "calReminderForm", "calYearView",
     "mealsNextWeek", "mealsMonth", "mealsGrocery", "mealsTonight", "mealsBank", "mealsPrep", "mealsRescue", "mealsEditModal", "mealsThemesModal"].forEach(function (n) {
      expect(src).toContain("{" + n + "(HFK)}");
    });
    expect(src).toContain("{mealsWeekTypePicker()}"); // no style helpers inside
    expect(src).toContain("var _K=(props&&props.kit)||HF_KIT");
  });

  it("no new storage keys: the redesign files read and write nothing themselves", function () {
    ["FullView.jsx", "fullViewKit.js", "fullViewData.js", "ShoppingFull.jsx", "TidePoolFull.jsx", "WavesFull.jsx", "CalendarFull.jsx", "MealsFull.jsx", "LighthouseFull.jsx"].forEach(function (f) {
      var s = fs.readFileSync("src/redesign/" + f, "utf8");
      expect(s).not.toMatch(/localStorage|sessionStorage|supabase|useSaved/);
    });
  });
});
