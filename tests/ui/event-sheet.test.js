// Add/Edit Event sheet (af_redesign): always-visible Save, the short form with
// More options, people from Settings, categories, weekday repeats, color
// rules — and a new event syncing from one household member to the other.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import fs from "node:fs";
import EventSheet from "../../src/redesign/EventSheet.jsx";
import { allCategories, newCategory, FAMILY_COLOR } from "../../src/lib/calEvents.js";
import { eventsOn } from "../../src/redesign/flowData.js";
import { SYNC_KEYS, sanitizeHouseholdData } from "../../src/sync-core.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
var h = React.createElement;
var container, root;
function q(s) { return container.querySelector(s); }
function qa(s) { return Array.from(container.querySelectorAll(s)); }
function tid(id) { return q('[data-testid="' + id + '"]'); }
async function render(el) { await act(async function () { root.render(el); }); }
async function click(el) { await act(async function () { el.click(); }); }
async function type(el, v) {
  await act(async function () {
    var proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(function () { localStorage.clear(); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(function () { act(function () { root.unmount(); }); container.remove(); });

var PEOPLE = [
  { id: "p_lin", name: "Lindsey", role: "Parent", color: "#4A7FA8" },
  { id: "p_twy", name: "Twyla", role: "Parent", color: "#3AAA91" },
  { id: "p_jun", name: "June", role: "Kid", color: "#7A9E8E" },
];
function sheet(extra) {
  var people = (extra && extra.people) || PEOPLE;
  return h(EventSheet, Object.assign({
    mode: "add", init: { title: "", date: "2026-11-18" }, people: people,
    personColor: function (id) { var p = people.filter(function (x) { return x.id === id; })[0]; return p ? p.color : null; },
    categories: allCategories([]), schoolTypes: [{ id: "school_day", label: "School Day", color: "#5CADA0" }],
    showEmojis: false, today: new Date(2026, 10, 13),
    onSave: vi.fn(), onCancel: vi.fn(), onAddCategory: function (l) { return newCategory(l, function () { return "n1"; }); },
  }, extra || {}));
}

describe("layout", function () {
  it("header, scrolling body and a sticky footer with Cancel + Save; phone stacks Save full width", async function () {
    await render(sheet());
    var dlg = tid("event-sheet");
    expect(dlg.getAttribute("role")).toBe("dialog");
    expect(Array.from(dlg.children).map(function (c) { return c.tagName; })).toEqual(["HEADER", "DIV", "FOOTER"]);
    expect(tid("es-cancel").textContent).toBe("Cancel");
    expect(tid("es-save").textContent).toBe("Save event");
    var css = q("style").textContent;
    expect(css).toContain(".af-es{position:fixed;");
    expect(css).toContain("max-height:min(88dvh,860px)");
    expect(css).toContain(".af-es-body{flex:1;min-height:0;overflow-y:auto;");
    expect(css).toContain(".af-es-foot{flex-shrink:0;");
    expect(css).toContain("@media (max-width:600px){.af-es-foot{flex-direction:column-reverse;align-items:stretch;gap:6px}.af-es-foot .af-es-save{width:100%}}");
    // nothing runs off the right edge: two-column rows use minmax(0,1fr), fields can shrink
    expect(css).toContain(".af-es-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}");
    expect(css).toContain(".af-es-in{display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box;");
  });
  it("Playfair title, Lato everything else", async function () {
    await render(sheet());
    expect(q("#af-es-title").style.fontFamily).toMatch(/Playfair Display/);
    expect(tid("event-sheet").style.fontFamily).toMatch(/^"?Lato/);
    expect(container.innerHTML).not.toMatch(/Cormorant|DM Sans|Colour/);
  });
  it("essentials up front; Note, Category, Reminder and Color behind More options, remembered on this device", async function () {
    await render(sheet());
    ["es-title", "es-date", "es-time", "es-for", "es-resp", "es-repeat"].forEach(function (id) { expect(tid(id)).not.toBeNull(); });
    expect(tid("es-more-panel")).toBeNull();
    expect(tid("es-note")).toBeNull();
    await click(tid("es-more"));
    ["es-note", "es-cats", "es-remind-date", "es-remind-time", "es-colors"].forEach(function (id) { expect(tid(id)).not.toBeNull(); });
    expect(localStorage.getItem("af_eventSheetMore")).toBe("1");
    act(function () { root.unmount(); }); root = createRoot(container);
    await render(sheet());
    expect(tid("es-more-panel")).not.toBeNull();
  });
  it("Esc, the backdrop and the close button cancel", async function () {
    var cancel = vi.fn();
    await render(sheet({ onCancel: cancel }));
    await act(async function () { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    await click(tid("event-sheet-backdrop"));
    await click(tid("event-sheet-close"));
    expect(cancel).toHaveBeenCalledTimes(3);
  });
});

describe("people from Settings", function () {
  it("For: Everyone + every member (adults and kids) in their Settings colors; a new member appears", async function () {
    await render(sheet());
    expect(qa('[data-testid="es-for"] button').map(function (b) { return b.textContent; })).toEqual(["Everyone", "Lindsey", "Twyla", "June"]);
    expect(tid("es-for-p_twy").style.borderColor).toBe("rgba(58, 170, 145, 0.4)"); // tinted in Twyla's Settings color (#3AAA91)
    expect(qa('[data-testid="es-resp"] button').map(function (b) { return b.textContent; })).toEqual(["None", "Lindsey", "Twyla", "June"]);
    await render(sheet({ people: PEOPLE.concat([{ id: "p_new", name: "Grandma Rose", color: "#C4A882" }]) }));
    expect(tid("es-for-p_new").textContent).toBe("Grandma Rose");
    expect(tid("es-resp-p_new")).not.toBeNull();
    expect(fs.readFileSync("src/redesign/EventSheet.jsx", "utf8")).not.toMatch(/Lindsey|Twyla/); // no hard-coded names
  });
  it("For is multi-select with Everyone exclusive; Responsible is single or none; color follows For", async function () {
    var save = vi.fn();
    await render(sheet({ onSave: save }));
    await type(tid("es-title"), "Dentist");
    await click(tid("es-for-p_twy")); await click(tid("es-for-p_jun"));
    expect(tid("es-for-p_twy").getAttribute("aria-pressed")).toBe("true");
    expect(tid("es-for-p_jun").getAttribute("aria-pressed")).toBe("true");
    await click(tid("es-resp-p_lin")); await click(tid("es-resp-p_twy"));
    expect(tid("es-resp-p_lin").getAttribute("aria-pressed")).toBe("false");
    await click(tid("es-save"));
    var f = save.mock.calls[0][0];
    expect(f).toMatchObject({ title: "Dentist", date: "2026-11-18", forPeople: ["p_twy", "p_jun"], forPerson: "p_twy", responsibleParent: "p_twy", color: "#3AAA91", colorFrom: "person" });
    await click(tid("es-for-everyone"));
    expect(tid("es-for-p_twy").getAttribute("aria-pressed")).toBe("false");
    await click(tid("es-save"));
    expect(save.mock.calls[1][0]).toMatchObject({ forPeople: ["everyone"], forPerson: "family", color: FAMILY_COLOR });
  });
});

describe("repeat", function () {
  it("Weekly shows S M T W T F S defaulting to the date's weekday; multi-select; Ends", async function () {
    var save = vi.fn();
    await render(sheet({ onSave: save }));
    await type(tid("es-title"), "Piano");
    expect(tid("es-weekdays")).toBeNull();
    await click(tid("es-repeat-weekly"));
    expect(qa('[data-testid="es-weekdays"] button').map(function (b) { return b.textContent; }).join(" ")).toBe("S M T W T F S");
    expect(tid("es-day-3").getAttribute("aria-pressed")).toBe("true"); // Nov 18, 2026 is a Wednesday
    expect(tid("es-repeat-summary").textContent).toBe("Every Wednesday");
    await click(tid("es-day-5"));
    expect(tid("es-repeat-summary").textContent).toBe("Every Wednesday and Friday");
    await click(tid("es-end-after"));
    await type(tid("es-end-count"), "6");
    await click(tid("es-save"));
    expect(save.mock.calls[0][0]).toMatchObject({ repeat: "weekly", repeatDays: [3, 5], repeatEnd: { type: "after", count: 6 } });
    await click(tid("es-repeat-biweekly"));
    expect(tid("es-repeat-summary").textContent).toBe("Every other Wednesday and Friday");
  });
  it("editing one day of a repeating event asks This event / All events", async function () {
    var save = vi.fn();
    await render(sheet({ mode: "edit", init: { id: "s", title: "Piano", date: "2026-11-25", repeat: "weekly", repeatDays: [3], color: "#7A9E8E", colorFrom: "person", forPeople: ["p_jun"] }, occurrenceIso: "2026-11-25", onSave: save, onDelete: vi.fn() }));
    await click(tid("es-save"));
    expect(save).not.toHaveBeenCalled();
    expect(tid("es-scope").textContent).toContain("This is a repeating event. Save changes to:");
    await click(tid("es-scope-this"));
    expect(save.mock.calls[0][1]).toBe("this");
  });
  it("an older weekly event (no repeatDays) opens on its own weekday", async function () {
    await render(sheet({ mode: "edit", init: { id: "o", title: "Swim", date: "2026-11-03", repeat: "biweekly", forPerson: "p_twy", color: "#6A9BB5" } }));
    expect(tid("es-day-2").getAttribute("aria-pressed")).toBe("true");
    expect(tid("es-for-p_twy").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("categories and color", function () {
  it("the eleven categories as chips (2 rows, More), emoji only with the toggle, + Add category", async function () {
    var add = vi.fn(function (l) { return newCategory(l, function () { return "n1"; }); });
    await render(sheet({ onAddCategory: add }));
    await click(tid("es-more"));
    expect(qa('[data-testid="es-cats"] button').map(function (b) { return b.textContent; })).toEqual(["Appointment", "Activity/Sports", "School", "Church", "Work", "Birthday", "Holiday", "Family", "Travel", "Home/Chores", "Other"]);
    expect(tid("es-cats").style.maxHeight).toBe("84px");
    await click(tid("es-cat-add"));
    await type(tid("es-cat-new"), "Band practice");
    await act(async function () { tid("es-cat-new").closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(add).toHaveBeenCalledWith("Band practice");
    await render(sheet({ showEmojis: true }));
    expect(tid("es-cat-church").textContent).toBe("⛪Church");
  });
  it("Color: Auto + blue/sage/sand/teal/gold + person colors; hex box only behind Custom", async function () {
    await render(sheet());
    await click(tid("es-more"));
    var labels = qa('[data-testid="es-colors"] button').map(function (b) { return b.textContent; });
    expect(labels).toEqual(["Auto", "Blue", "Sage", "Sand", "Teal", "Gold", "Lindsey", "Twyla", "Custom"]); // June's color is Sage
    expect(labels.join(" ")).not.toMatch(/Rose|Lavender|Pink/);
    expect(tid("es-color-hex")).toBeNull();
    await click(tid("es-color-custom"));
    expect(tid("es-color-hex")).not.toBeNull();
    expect(tid("es-color-auto").getAttribute("aria-pressed")).toBe("false");
  });
});

describe("two household members", function () {
  it("an event Lindsey adds reaches Twyla's device and shows on every Wednesday there", async function () {
    // Lindsey's device: the sheet produces the event, HomeFlow appends it.
    var save = vi.fn();
    await render(sheet({ onSave: save }));
    await type(tid("es-title"), "Piano");
    await click(tid("es-for-p_jun"));
    await click(tid("es-repeat-weekly"));
    await click(tid("es-save"));
    var lindseyEvents = [{ id: "ev1", title: "Movie night", date: "2026-11-14" }].concat([Object.assign({ id: "ev_new" }, save.mock.calls[0][0])]);
    var lindseyCats = [newCategory("Band practice", function () { return "n1"; })];
    // push: the household payload goes through the same sanitize as the server round trip
    var payload = JSON.parse(JSON.stringify({ calEvents: lindseyEvents, calCategories: lindseyCats, people: PEOPLE }));
    var clean = sanitizeHouseholdData(payload);
    expect(SYNC_KEYS).toContain("calCategories");
    // Twyla's device: pull writes every SYNC_KEYS key as af_<key>
    localStorage.clear();
    SYNC_KEYS.forEach(function (k) { if (clean[k] !== undefined) localStorage.setItem("af_" + k, JSON.stringify(clean[k])); });
    var twylaEvents = JSON.parse(localStorage.getItem("af_calEvents"));
    var piano = twylaEvents.filter(function (e) { return e.id === "ev_new"; })[0];
    expect(piano).toMatchObject({ title: "Piano", repeat: "weekly", repeatDays: [3], forPeople: ["p_jun"], color: "#7A9E8E", colorFrom: "person" });
    ["2026-11-18", "2026-11-25", "2026-12-02", "2026-12-09"].forEach(function (iso) {
      var p = iso.split("-");
      expect(eventsOn(twylaEvents, new Date(+p[0], +p[1] - 1, +p[2])).map(function (e) { return e.title; })).toContain("Piano");
    });
    expect(eventsOn(twylaEvents, new Date(2026, 10, 19)).map(function (e) { return e.title; })).not.toContain("Piano");
    expect(JSON.parse(localStorage.getItem("af_calCategories"))).toEqual([{ id: "c_n1", label: "Band practice", emoji: "" }]);
  });
});

describe("wiring", function () {
  var app = fs.readFileSync("src/App.jsx", "utf8");
  it("new look renders EventSheet; flag off keeps the original form", function () {
    expect(app).toContain("    if(REDESIGN){\n      function attendanceFor(ev){");
    expect(app).toContain("return <EventSheet mode={calFormMode}");
    expect(app).toContain('<label style={lbl}>Colour</label>'); // flag-off form unchanged
    expect(app).toContain('const [calCategories,setCalCategories]       = useSaved("calCategories",[]);');
    expect(app).toContain("return calEvents.filter(e=>calOccursOn(e,targetDate))");
  });
});
