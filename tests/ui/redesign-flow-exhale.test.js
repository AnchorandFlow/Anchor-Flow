// tests/ui/redesign-flow-exhale.test.js
// Redesigned Flow + Exhale screens (af_redesign). Flag-off wiring, every
// Exhale action (quick-add, complete/undo, edit, move chips, swipes), and
// each Flow summary card.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import fs from "node:fs";
import HomeSwitch from "../../src/redesign/HomeSwitch.jsx";
import RedesignExhale from "../../src/redesign/RedesignExhale.jsx";
import RedesignFlow from "../../src/redesign/RedesignFlow.jsx";
import { getRedesignState } from "../../src/design/redesignFlag.js";
import { tone } from "../../src/design/tokens.js";
import * as M from "../../src/redesign/exhaleModel.js";
import { weekDates, eventsOn, workersOn, shoppingByAisle, mealsStrip, personColor, visibleFlowTabs } from "../../src/redesign/flowData.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
var h = React.createElement;

var container, root;
beforeEach(function () { localStorage.clear(); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(function () { act(function () { root.unmount(); }); container.remove(); });
async function render(el) { await act(async function () { root.render(el); }); }
function q(sel, el) { return (el || container).querySelector(sel); }
function qa(sel, el) { return Array.from((el || container).querySelectorAll(sel)); }
async function click(el) { await act(async function () { el.click(); }); }
function stored() { return JSON.parse(localStorage.getItem("af_exhale_buckets")); }
function item(id) { return stored().items.filter(function (i) { return i.id === id; })[0]; }
function seed(items) {
  localStorage.setItem("af_exhale_buckets", JSON.stringify({ bucketNames: M.DEFAULT_BUCKET_NAMES.slice(), items: items }));
}
async function typeInto(input, value) {
  await act(async function () {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit(form) { await act(async function () { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); }
function hexRgb(hex) { var n = parseInt(hex.slice(1), 16); return "rgb(" + (n >> 16 & 255) + ", " + (n >> 8 & 255) + ", " + (n & 255) + ")"; }
async function key(el, k) { await act(async function () { el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })); }); }
async function blur(el) { if (!el) return; await act(async function () { el.blur(); el.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); }); }
async function swipe(rowEl, dx, dy) {
  var surface = qa("div", rowEl).filter(function (d) { return d.style.touchAction === "pan-y"; })[0];
  await act(async function () {
    surface.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 100 }));
    surface.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 100 + dx / 2, clientY: 100 + (dy || 0) / 2 }));
    surface.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 100 + dx, clientY: 100 + (dy || 0) }));
    surface.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 100 + dx, clientY: 100 + (dy || 0) }));
  });
}
async function fire(el, type) { await act(async function () { el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })); }); }
var SAT = function () { return new Date(2026, 10, 14, 9); }; // Sat Nov 14 2026
var PEOPLE = [{ id: "L", name: "Lindsey Border" }, { id: "T", name: "Twyla" }, { id: "k1", name: "Ava", role: "Kid" }];
function rowsIn(i) { return qa('[data-testid="bucket-' + i + '"] [data-done]').map(function (r) { return r.getAttribute("data-testid").slice(5); }); }

// ── Flag OFF ────────────────────────────────────────────────────────────────
describe("af_redesign off — Flow and Exhale stay exactly as they are", function () {
  var src = fs.readFileSync("src/App.jsx", "utf8"); // vitest runs from the repo root
  function site(start, end) { return src.slice(src.indexOf(start), src.indexOf(end)); }

  it("Flow tab: legacy <FlowHome/> behind HomeSwitch(REDESIGN)", function () {
    var s = site('{t==="flowhome" &&', '{t==="calendar" &&');
    expect(s).toMatch(/<SectionErrorBoundary label="Flow"><HomeSwitch redesignOn=\{REDESIGN\}/);
    expect(s).toMatch(/renderLegacy=\{function\(\)\{ return <FlowHome\/>; \}\}/);
  });

  it("Exhale tab: legacy <ExhaleSection> with its original props behind HomeSwitch(REDESIGN)", function () {
    var s = site('{t==="brain"    &&', '{t==="lighthouse" &&');
    expect(s).toMatch(/<SectionErrorBoundary label="Exhale"><HomeSwitch redesignOn=\{REDESIGN\}/);
    var legacy = s.slice(s.indexOf("renderLegacy"));
    ["initialItems={exhaleItems.length > 0 ? exhaleItems : brainItems}", "initialLabels={exhaleLabels}", "householdId={householdId}",
      "myPersonId={myPersonId}", "people={people}", "compassEnabled={compassEnabled}", "setExhaleItems(items);", "setExhaleLabels(labels);"].forEach(function (p) {
      expect(legacy).toContain(p);
    });
    expect(legacy).toMatch(/return <ExhaleSection/);
  });

  it("non-beta household renders the legacy screens; redesign never built", async function () {
    var off = getRedesignState({ getItem: function (k) { return k === "af_householdId" ? JSON.stringify("hh_other") : null; } }).on;
    expect(off).toBe(false);
    var build = vi.fn();
    await render(h("div", null,
      h(HomeSwitch, { redesignOn: off, renderLegacy: function () { return h("div", { "data-testid": "legacy-flow" }); }, renderRedesign: build }),
      h(HomeSwitch, { redesignOn: off, renderLegacy: function () { return h("div", { "data-testid": "legacy-exhale" }); }, renderRedesign: build })));
    expect(q('[data-testid="legacy-flow"]')).not.toBe(null);
    expect(q('[data-testid="legacy-exhale"]')).not.toBe(null);
    expect(build).not.toHaveBeenCalled();
  });
});

// ── Exhale model ────────────────────────────────────────────────────────────
describe("exhaleModel", function () {
  var base = { bucketNames: M.DEFAULT_BUCKET_NAMES.slice(), items: [
    { id: "a", text: "A", bucketIndex: 1, color: "#6ABAAA", personId: "p1", notes: "keep" },
    { id: "b", text: "B", bucketIndex: 1, done: true },
    { id: "c", text: "C", bucketIndex: 1 },
    { id: "z", text: "archived", bucketIndex: 1, archived: true },
    { id: "p", text: "private", bucketIndex: 1, private: true, createdBy: "other" },
  ] };
  it("open first, done at the bottom; archived and others' private hidden", function () {
    expect(M.bucketItems(base, 1, "me").map(function (i) { return i.id; })).toEqual(["a", "c", "b"]);
    expect(M.openCount(base, 1, "me")).toBe(2);
  });
  it("toggle/setDone/move/edit only touch existing fields and keep the rest", function () {
    var t = M.toggleDone(base, "a");
    expect(t.items[0]).toEqual(Object.assign({}, base.items[0], { done: true }));
    expect(M.toggleDone(t, "a").items[0].done).toBe(false);
    expect(M.setDone(base, "a", true).items[0].done).toBe(true);
    expect(M.moveTo(base, "a", 2).items[0]).toEqual(Object.assign({}, base.items[0], { bucketIndex: 2 }));
    expect(M.editText(base, "a", "  new  ").items[0].text).toBe("new");
    expect(M.editText(base, "a", "   ").items[0].text).toBe("A");
    expect(M.toggleDone(base, "missing").items).toEqual(base.items);
  });
  it("add uses ExhaleSection's item shape, prepended to Exhaled", function () {
    var n = M.addItem(base, " Hi ", 0, function () { return "new1"; }, function () { return 123; });
    expect(n.items[0]).toEqual({ id: "new1", text: "Hi", notes: "", dueDate: "", personId: null, bucketIndex: 0, createdAt: 123, color: "#4A9E8E" });
    expect(Object.keys(n).sort()).toEqual(["bucketNames", "items"]);
  });
  it("old items read the new fields as empty; bad values fall back to empty", function () {
    expect(M.fields({ id: "old", text: "x" })).toEqual({ notes: "", dueDate: "", personId: "" });
    expect(M.fields({ notes: null, dueDate: "soon", personId: 7 })).toEqual({ notes: "", dueDate: "", personId: "" });
    expect(M.fields({ notes: "n", dueDate: "2026-11-20", personId: "L" })).toEqual({ notes: "n", dueDate: "2026-11-20", personId: "L" });
    expect(M.fields({ personId: null })).toEqual({ notes: "", dueDate: "", personId: "" }); // old picker's "no one"
    expect(M.fields({ assignee: "T" }).personId).toBe("T"); // earlier redesign build
    expect(M.fields({ personId: "L", assignee: "T" }).personId).toBe("L");
  });
  it("setFields writes only notes/dueDate/personId and keeps everything else", function () {
    var n = M.setFields(base, "a", { notes: "call first", dueDate: "2026-11-20", personId: "everyone", bucketIndex: 4, text: "hack" });
    expect(n.items[0]).toEqual(Object.assign({}, base.items[0], { notes: "call first", dueDate: "2026-11-20", personId: "everyone" }));
  });
  it("setFields moves a legacy assignee into personId and clears to null", function () {
    var b = { bucketNames: base.bucketNames, items: [{ id: "a", text: "x", bucketIndex: 1, assignee: "T" }] };
    var n = M.setFields(b, "a", { personId: "L" });
    expect(n.items[0].personId).toBe("L");
    expect("assignee" in n.items[0]).toBe(false);
    expect(M.setFields(n, "a", { personId: "" }).items[0].personId).toBe(null);
    expect(M.setFields(base, "a", { dueDate: "tomorrow" }).items[0].dueDate).toBe("");
    expect(M.setFields(base, "missing", { notes: "x" }).items).toEqual(base.items);
  });
  it("deleteItem removes only that item", function () {
    expect(M.deleteItem(base, "c").items.map(function (i) { return i.id; })).toEqual(["a", "b", "z", "p"]);
  });
  it("due presets and labels (Saturday = the coming Saturday, today if Saturday)", function () {
    var fri = new Date(2026, 10, 13, 9);
    expect(M.duePresets(fri).map(function (p) { return p.value; })).toEqual(["2026-11-13", "2026-11-14", "2026-11-14", ""]);
    expect(M.duePresets(SAT())[2].value).toBe("2026-11-14");
    expect(M.duePresets(new Date(2026, 10, 15, 9))[2].value).toBe("2026-11-21");
    expect([M.dueLabel("2026-11-13", fri), M.dueLabel("2026-11-14", fri), M.dueLabel("2026-11-16", fri), M.dueLabel("2026-12-25", fri), M.dueLabel("", fri)])
      .toEqual(["Today", "Tomorrow", "Mon", "Dec 25", ""]);
    expect(M.isOverdue("2026-11-12", fri)).toBe(true);
    expect(M.isOverdue("2026-11-13", fri)).toBe(false);
  });
  it("commit reads the latest stored value (keeps another writer's change)", function () {
    seed([{ id: "a", text: "A", bucketIndex: 1 }]);
    var raw = stored(); raw.items.push({ id: "fromSunset", text: "S", bucketIndex: 0 }); localStorage.setItem("af_exhale_buckets", JSON.stringify(raw));
    M.commit(function (cur) { return M.toggleDone(cur, "a"); });
    expect(stored().items.map(function (i) { return i.id; })).toEqual(["a", "fromSunset"]);
    expect(JSON.parse(localStorage.getItem("af_dirtyKeys"))).toEqual(["exhale_buckets"]);
  });
});

// ── Exhale screen actions ───────────────────────────────────────────────────
describe("RedesignExhale actions", function () {
  beforeEach(function () {
    seed([
      { id: "t1", text: "Call the vet", bucketIndex: 1 },
      { id: "t2", text: "Sign permission slip", bucketIndex: 1 },
      { id: "s1", text: "Paint the fence", bucketIndex: 4 },
    ]);
  });

  it("all five buckets visible at once, each with its items and open count", async function () {
    await render(h(RedesignExhale, {}));
    expect(qa('section[data-testid^="bucket-"]').map(function (b) { return q("h2", b).textContent; })).toEqual(M.DEFAULT_BUCKET_NAMES);
    expect(qa('[data-testid="open-count"]').map(function (c) { return c.textContent; })).toEqual(["0", "2", "0", "0", "1"]);
    expect(rowsIn(1)).toEqual(["t1", "t2"]);
    expect(rowsIn(4)).toEqual(["s1"]);
    expect(q('[data-testid="bucket-1"] > button')).toBe(null); // no accordion headers
  });

  it("bucket tones: Exhaled sand, Today sage, Tomorrow blue, This Weekend teal, Someday mist (tint + colored top edge)", async function () {
    await render(h(RedesignExhale, {}));
    var tones = [tone.sand, tone.sage, tone.blue, tone.teal, tone.mist];
    tones.forEach(function (t, i) {
      var sec = q('[data-testid="bucket-' + i + '"]');
      expect(sec.style.background).toBe(hexRgb(t.tint));
      expect(sec.style.borderTop).toContain(hexRgb(t.full));
    });
  });

  it("five columns on desktop, stacked on phone (layout CSS)", async function () {
    await render(h(RedesignExhale, {}));
    var css = q("style").textContent;
    expect(css).toMatch(/\.rx-board\{display:flex;flex-direction:column/);
    expect(css).toMatch(/@media \(min-width:900px\)\{.*\.rx-board\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
    expect(q('[data-testid="exhale-board"]').className).toBe("rx-board");
  });

  it("rows are 14px DM Sans", async function () {
    await render(h(RedesignExhale, {}));
    var t = q('[data-testid="item-text"]');
    expect(t.style.fontSize).toBe("14px");
    expect(t.style.fontFamily).toMatch(/DM Sans/);
  });

  it("quick-add is the big bar at the top and adds new items with empty optional fields", async function () {
    await render(h(RedesignExhale, {}));
    var form = q('[data-testid="exhale-quickadd"]');
    expect(form.compareDocumentPosition(q('[data-testid="exhale-board"]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(q("input", form).style.fontSize).toBe("19px");
    await typeInto(q("input", form), "Renew tags");
    await submit(form);
    expect(stored().items[0]).toMatchObject({ text: "Renew tags", bucketIndex: 0, notes: "", dueDate: "", personId: null });
  });

  it("quick-add drops the thought into Exhaled and syncs via the existing key", async function () {
    var heard = vi.fn(); window.addEventListener("af-data-changed", heard);
    await render(h(RedesignExhale, {}));
    await typeInto(q('input[aria-label="Exhale a thought"]'), "Book dentist");
    await act(async function () { q("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    window.removeEventListener("af-data-changed", heard);
    expect(stored().items[0]).toMatchObject({ text: "Book dentist", bucketIndex: 0, notes: "" });
    expect(JSON.parse(localStorage.getItem("af_dirtyKeys"))).toContain("exhale_buckets");
    expect(heard).toHaveBeenCalled();
    expect(qa('[data-testid="open-count"]')[0].textContent).toBe("1");
  });

  it("tap the circle: completes (check, bottom, crossed out); tap again undoes", async function () {
    await render(h(RedesignExhale, {}));
    await click(q('[data-testid="item-t1"] [data-testid="toggle-done"]'));
    expect(item("t1").done).toBe(true);
    expect(rowsIn(1)).toEqual(["t2", "t1"]);
    var row = q('[data-testid="item-t1"]');
    expect(row.getAttribute("data-done")).toBe("true");
    expect(q('[data-testid="item-text"]', row).style.textDecoration).toBe("line-through");
    expect(q('[data-testid="toggle-done"]', row).getAttribute("aria-pressed")).toBe("true");
    expect(qa('[data-testid="open-count"]')[1].textContent).toBe("1");
    await click(q('[data-testid="item-t1"] [data-testid="toggle-done"]'));
    expect(item("t1").done).toBe(false);
    expect(rowsIn(1)).toEqual(["t1", "t2"]);
  });

  it("tap the text: expands in place with text, Notes, Due, Who, Bucket, Delete, Done; Enter saves the text; Close collapses", async function () {
    await render(h(RedesignExhale, { people: PEOPLE, now: SAT }));
    await click(q('[data-testid="item-t1"] [data-testid="item-text"]'));
    var row = q('[data-testid="item-t1"]');
    expect(row.getAttribute("data-expanded")).toBe("true");
    var d = q('[data-testid="item-details"]', row);
    ["Notes", "Due", "Who", "Bucket"].forEach(function (l) { expect(d.textContent).toContain(l); });
    expect(qa('[data-testid="due-chips"] button', d).map(function (b) { return b.textContent; })).toEqual(["Today", "Tomorrow", "Saturday", "None"]);
    expect(q('input[type="date"]', d)).not.toBe(null);
    expect(qa('[data-testid="who-chips"] button', d).map(function (b) { return b.textContent; })).toEqual(["Lindsey", "Twyla", "Ava", "Everyone"]);
    expect(qa('[data-testid="bucket-chips"] button', d).map(function (b) { return b.textContent; })).toEqual(M.DEFAULT_BUCKET_NAMES);
    expect(q('[data-testid="delete-btn"]', d).textContent).toBe("Delete");
    expect(q('[data-testid="done-btn"]', d).textContent).toBe("Done");
    var input = q('[data-testid="edit-input"]');
    expect(input.value).toBe("Call the vet");
    await typeInto(input, "Call the vet at 9");
    await key(input, "Enter");
    await blur(input);
    expect(item("t1").text).toBe("Call the vet at 9");
    await click(q('[data-testid="collapse-btn"]'));
    expect(q('[data-testid="item-details"]')).toBe(null);
    expect(q('[data-testid="item-t1"]').getAttribute("data-expanded")).toBe("false");
  });

  it("only one item expanded at a time", async function () {
    await render(h(RedesignExhale, {}));
    await click(q('[data-testid="item-t1"] [data-testid="item-text"]'));
    await click(q('[data-testid="item-s1"] [data-testid="item-text"]'));
    expect(qa('[data-expanded="true"]').map(function (r) { return r.getAttribute("data-testid"); })).toEqual(["item-s1"]);
  });

  it("Notes save on blur and show a Notes tag when collapsed", async function () {
    await render(h(RedesignExhale, {}));
    await click(q('[data-testid="item-t1"] [data-testid="item-text"]'));
    var ta = q('[data-testid="notes-input"]');
    await act(async function () {
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(ta, "Ask about the rash");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await blur(ta);
    expect(item("t1").notes).toBe("Ask about the rash");
    await click(q('[data-testid="collapse-btn"]'));
    expect(q('[data-testid="item-t1"] [data-testid="tag-notes"]').textContent).toBe("Notes");
  });

  it("Due: Today / Tomorrow / Saturday / None presets and the date picker", async function () {
    await render(h(RedesignExhale, { now: SAT }));
    await click(q('[data-testid="item-t1"] [data-testid="item-text"]'));
    await click(q('[data-testid="due-tomorrow"]'));
    expect(item("t1").dueDate).toBe("2026-11-15");
    expect(q('[data-testid="due-tomorrow"]').getAttribute("aria-pressed")).toBe("true");
    await click(q('[data-testid="due-today"]'));
    expect(item("t1").dueDate).toBe("2026-11-14");
    await click(q('[data-testid="due-none"]'));
    expect(item("t1").dueDate).toBe("");
    var picker = q('[data-testid="due-date"]');
    await typeInto(picker, "2026-12-25");
    expect(item("t1").dueDate).toBe("2026-12-25");
    await click(q('[data-testid="collapse-btn"]'));
    expect(q('[data-testid="item-t1"] [data-testid="tag-due"]').textContent).toBe("Due Dec 25");
  });

  it("Who: each household member plus Everyone, in person colors; tap again clears", async function () {
    await render(h(RedesignExhale, { people: PEOPLE, now: SAT }));
    await click(q('[data-testid="item-t1"] [data-testid="item-text"]'));
    expect(q('[data-testid="who-T"]').style.border).toContain(hexRgb("#3AAA91"));
    expect(q('[data-testid="who-k1"]').style.border).toContain(hexRgb("#7A9E8E"));
    await click(q('[data-testid="who-T"]'));
    expect(item("t1").personId).toBe("T");
    expect(q('[data-testid="who-T"]').style.background).toBe(hexRgb("#3AAA91"));
    await click(q('[data-testid="who-everyone"]'));
    expect(item("t1").personId).toBe("everyone");
    await click(q('[data-testid="who-everyone"]'));
    expect(item("t1").personId).toBe(null);
    await click(q('[data-testid="who-T"]'));
    await click(q('[data-testid="collapse-btn"]'));
    var tag = q('[data-testid="item-t1"] [data-testid="tag-who"]');
    expect(tag.textContent).toBe("Twyla");
    expect(q("span", tag).style.background).toBe(hexRgb("#3AAA91"));
  });

  it("Bucket chips move the item; Done completes and collapses; Delete needs a second tap", async function () {
    await render(h(RedesignExhale, {}));
    await click(q('[data-testid="item-t1"] [data-testid="item-text"]'));
    await click(q('[data-testid="chip-3"]'));
    expect(item("t1").bucketIndex).toBe(3);
    expect(rowsIn(3)).toEqual(["t1"]);
    await click(q('[data-testid="done-btn"]'));
    expect(item("t1").done).toBe(true);
    expect(q('[data-testid="item-details"]')).toBe(null);
    await click(q('[data-testid="item-t2"] [data-testid="item-text"]'));
    await click(q('[data-testid="delete-btn"]'));
    expect(item("t2")).toBeTruthy();
    expect(q('[data-testid="delete-btn"]').textContent).toBe("Tap again to delete");
    await click(q('[data-testid="delete-btn"]'));
    expect(item("t2")).toBeUndefined();
    expect(rowsIn(1)).toEqual([]);
  });

  it("old items with none of the new fields render with no tags", async function () {
    await render(h(RedesignExhale, { people: PEOPLE, now: SAT }));
    expect(q('[data-testid="item-tags"]')).toBe(null);
  });

  it("text: tap away saves; Escape cancels; blank text is not saved", async function () {
    await render(h(RedesignExhale, {}));
    await click(q('[data-testid="item-t1"] [data-testid="item-text"]'));
    await typeInto(q('[data-testid="edit-input"]'), "Saved on blur");
    await blur(q('[data-testid="edit-input"]'));
    expect(item("t1").text).toBe("Saved on blur");

    await click(q('[data-testid="item-t2"] [data-testid="item-text"]'));
    await typeInto(q('[data-testid="edit-input"]'), "Should not stick");
    await key(q('[data-testid="edit-input"]'), "Escape");
    await blur(q('[data-testid="edit-input"]'));
    expect(item("t2").text).toBe("Sign permission slip");

    await typeInto(q('[data-testid="edit-input"]'), "   ");
    await blur(q('[data-testid="edit-input"]'));
    expect(item("t2").text).toBe("Sign permission slip");
  });

  it("phone move: tap the handle, then Drop here on another bucket", async function () {
    await render(h(RedesignExhale, {}));
    expect(qa('[data-testid^="drop-"]')).toEqual([]);
    await click(q('[data-testid="item-t1"] [data-testid="move-btn"]'));
    expect(q('[data-testid="move-banner"]').textContent).toContain("Call the vet");
    expect(qa('[data-testid^="drop-"]').map(function (b) { return b.getAttribute("data-testid"); })).toEqual(["drop-0", "drop-2", "drop-3", "drop-4"]);
    await click(q('[data-testid="drop-3"]'));
    expect(item("t1").bucketIndex).toBe(3);
    expect(rowsIn(1)).toEqual(["t2"]);
    expect(rowsIn(3)).toEqual(["t1"]);
    expect(qa('[data-testid^="drop-"]')).toEqual([]);
    expect(qa('[data-testid="open-count"]')[3].textContent).toBe("1");
  });

  it("phone move: tapping the handle again (or Cancel) stops the move", async function () {
    await render(h(RedesignExhale, {}));
    await click(q('[data-testid="item-t1"] [data-testid="move-btn"]'));
    await click(q('[data-testid="item-t1"] [data-testid="move-btn"]'));
    expect(qa('[data-testid^="drop-"]')).toEqual([]);
    await click(q('[data-testid="item-t1"] [data-testid="move-btn"]'));
    await click(qa('[data-testid="move-banner"] button')[0]);
    expect(q('[data-testid="move-banner"]')).toBe(null);
    expect(item("t1").bucketIndex).toBe(1);
  });

  it("desktop drag and drop between buckets", async function () {
    await render(h(RedesignExhale, {}));
    var row = q('[data-testid="item-t2"]');
    expect(row.getAttribute("draggable")).toBe("true");
    await fire(row, "dragstart");
    var target = q('[data-testid="bucket-4"]');
    await fire(target, "dragover");
    expect(target.textContent).toContain("Drop here");
    await fire(target, "drop");
    expect(item("t2").bucketIndex).toBe(4);
    expect(rowsIn(4)).toEqual(["t2", "s1"]);
    expect(q('[data-testid="bucket-4"]').textContent).not.toContain("Drop here");
  });

  it("dropping on its own bucket does nothing", async function () {
    await render(h(RedesignExhale, {}));
    await fire(q('[data-testid="item-t2"]'), "dragstart");
    await fire(q('[data-testid="bucket-1"]'), "drop");
    expect(stored().items.map(function (i) { return [i.id, i.bucketIndex]; })).toEqual([["t1", 1], ["t2", 1], ["s1", 4]]);
  });

  it("swipe right completes", async function () {
    await render(h(RedesignExhale, {}));
    await swipe(q('[data-testid="item-t2"]'), M.SWIPE_PX + 10);
    expect(item("t2").done).toBe(true);
    expect(rowsIn(1)).toEqual(["t1", "t2"]);
  });

  it("swipe left moves to Tomorrow", async function () {
    await render(h(RedesignExhale, {}));
    await swipe(q('[data-testid="item-t1"]'), -(M.SWIPE_PX + 10));
    expect(item("t1").bucketIndex).toBe(M.TOMORROW);
    expect(rowsIn(1)).toEqual(["t2"]);
  });

  it("short or vertical drags do nothing", async function () {
    await render(h(RedesignExhale, {}));
    await swipe(q('[data-testid="item-t1"]'), 30);
    await swipe(q('[data-testid="item-t1"]'), -(M.SWIPE_PX + 10), 200);
    expect(item("t1")).toMatchObject({ bucketIndex: 1 });
    expect(item("t1").done).toBeUndefined();
  });

  it("reflects changes from other devices/screens (af-data-changed)", async function () {
    await render(h(RedesignExhale, {}));
    var raw = stored(); raw.items.unshift({ id: "remote", text: "From phone", bucketIndex: 1 });
    localStorage.setItem("af_exhale_buckets", JSON.stringify(raw));
    await act(async function () { window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: "exhale_buckets" } })); });
    expect(rowsIn(1)).toEqual(["remote", "t1", "t2"]);
  });

  it("calm empty state in an empty bucket", async function () {
    await render(h(RedesignExhale, {}));
    expect(q('[data-testid="bucket-2"]').textContent).toContain("Clear. Nothing waiting in Tomorrow.");
    expect(q('[data-testid="bucket-0"]').textContent).toContain("Nothing here yet. Exhale a thought above.");
  });
});

// ── Flow data ───────────────────────────────────────────────────────────────
describe("flowData", function () {
  var FRI = new Date(2026, 10, 13, 9); // Fri Nov 13 2026
  it("week is Monday to Sunday", function () {
    var w = weekDates(FRI);
    expect(w[0].getDay()).toBe(1); expect(w[0].getDate()).toBe(9);
    expect(w[6].getDay()).toBe(0); expect(w[6].getDate()).toBe(15);
  });
  it("events respect repeat rules like the Calendar", function () {
    var ev = [{ id: 1, title: "Swim", date: "2026-11-06", repeat: "weekly" }, { id: 2, title: "Later", date: "2026-11-20", repeat: "weekly" }];
    expect(eventsOn(ev, FRI).map(function (e) { return e.id; })).toEqual([1]);
  });
  it("work tags: set, varied and legacy schedules, with initials", function () {
    var people = [{ id: "L", name: "Lindsey Border" }, { id: "T", name: "Twyla" }, { id: "X", name: "Sam" }];
    var ws = { L: { scheduleType: "set", days: { Friday: [] } }, T: { type: "irregular", dates: ["2026-11-13"] }, X: { scheduleType: "set", days: { Monday: [] } } };
    expect(workersOn(ws, people, FRI)).toEqual([{ personId: "L", initials: "LB", onCall: false }, { personId: "T", initials: "TW", onCall: false }]);
  });
  it("person colors from tokens", function () {
    var people = [{ id: "L", name: "Lindsey" }, { id: "T", name: "Twyla" }, { id: "k1", name: "Ava", role: "Kid" }, { id: "k2", name: "Ben", role: "Kid" }];
    expect([personColor("L", people), personColor("T", people), personColor("k1", people), personColor("k2", people)]).toEqual(["#4A7FA8", "#3AAA91", "#7A9E8E", "#C4A882"]);
  });
  it("shopping grouped by aisle in category order, Other last", function () {
    var r = shoppingByAisle([{ id: 1, text: "Milk", category: "Dairy" }, { id: 2, text: "Tape" }, { id: 3, text: "Kale", category: "Produce" }, { id: 4, text: "Eggs", category: "Dairy", done: true }], ["Produce", "Dairy"]);
    expect(r.total).toBe(3);
    expect(r.aisles.map(function (a) { return [a.name, a.items.length]; })).toEqual([["Produce", 1], ["Dairy", 1], ["Other", 1]]);
  });
  it("meals strip Mon..Sun with empty nights", function () {
    var s = mealsStrip({ Monday: { dinner: "Soup" }, Sunday: { dinner: "Roast" } }, FRI);
    expect(s.map(function (d) { return d.short; })).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(s.map(function (d) { return d.empty; })).toEqual([false, true, true, true, true, true, false]);
    expect(s[4].isToday).toBe(true);
  });
});

// ── Flow screen ─────────────────────────────────────────────────────────────
describe("RedesignFlow screen", function () {
  var FRI = function () { return new Date(2026, 10, 13, 9); };
  var people = [{ id: "L", name: "Lindsey" }, { id: "k1", name: "Ava", role: "Kid" }, { id: "k2", name: "Ben", role: "Kid", tidePoolEnabled: false }];
  function base(extra) {
    return Object.assign({ now: FRI, people: people, calEvents: [], workSchedules: {}, meals: {}, shoppingItems: [], shopCategories: [], coveData: [], schoolData: {}, showEmojis: false, enabled: {} }, extra || {});
  }
  function tabIds() { return qa('[role="tab"]').map(function (b) { return b.getAttribute("data-testid").slice(8); }); }
  async function pick(id) { await click(q('[data-testid="flowtab-' + id + '"]')); }
  function summary() { return q('[data-testid="flow-summary"]').textContent; }

  it("Plus gate: Waves, Lighthouse and Tide Pool tiles show the Plus modal for non-Plus households; others open", async function () {
    var gate = vi.fn(), tabs = [];
    function on(e) { tabs.push(e.detail); }
    window.addEventListener("af-set-tab", on);
    await render(h(RedesignFlow, base({ plusGatedTabs: { waves: true, lighthouse: true, tidepool: true }, onPlusGate: gate })));
    await pick("waves"); await pick("lighthouse"); await pick("tidepool");
    expect(gate.mock.calls.map(function (c) { return c[0]; })).toEqual(["Waves", "Lighthouse", "Tide Pool"]);
    expect(tabs).toEqual([]);
    expect(q('[data-testid="flowtab-waves"]').getAttribute("aria-selected")).toBe("false");
    await pick("calendar"); expect(summary()).toContain("A wide-open week.");
    await pick("meals"); await pick("shopping"); await pick("exhale");
    expect(gate).toHaveBeenCalledTimes(3);
    // Plus households (plusGatedTabs null): every tile opens as before.
    await render(h(RedesignFlow, base({ plusGatedTabs: null, onPlusGate: gate })));
    await pick("waves"); expect(summary()).toContain("No routines for today.");
    await pick("tidepool"); expect(tabs).toEqual(["tidepool"]);
    expect(gate).toHaveBeenCalledTimes(3);
    window.removeEventListener("af-set-tab", on);
  });

  it("sea-glass background edge to edge, back to Home, 4-per-row tabs", async function () {
    await render(h(RedesignFlow, base()));
    var pg = q('[data-testid="redesign-flow"]');
    expect(pg.style.background).toMatch(/230, 239, 239|#E6EFEF/i);
    expect(pg.style.boxShadow).toMatch(/100vmax/); // fullBleed: fills wide screens
    var tabs = [];
    window.addEventListener("af-set-tab", function on(e) { tabs.push(e.detail); window.removeEventListener("af-set-tab", on); });
    await click(q('button[aria-label="Back to Home"]'));
    expect(tabs).toEqual(["anchor"]);
    expect(q('[role="tablist"]').style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
  });

  it("only sections turned on in Settings get tabs", async function () {
    expect(visibleFlowTabs({}).map(function (t) { return t.id; })).toEqual(["exhale", "shopping", "meals", "calendar", "waves", "tidepool", "lighthouse"]);
    await render(h(RedesignFlow, base({ enabled: { mealsEnabled: false, tidePoolEnabled: false, lighthouseEnabled: false } })));
    expect(tabIds()).toEqual(["exhale", "shopping", "calendar", "waves"]);
  });

  it("showEmojis: tab icons hidden when off, shown when on; Flow pillar icon always", async function () {
    await render(h(RedesignFlow, base()));
    expect(container.textContent).not.toContain("🛒");
    expect(container.textContent).toContain("🌊");
    await render(h(RedesignFlow, base({ showEmojis: true })));
    expect(container.textContent).toContain("🛒");
  });

  it("Exhale: bucket counts (open only) and Open full view", async function () {
    seed([{ id: "a", text: "x", bucketIndex: 1 }, { id: "b", text: "y", bucketIndex: 1, done: true }, { id: "c", text: "z", bucketIndex: 4 }]);
    await render(h(RedesignFlow, base()));
    expect(summary()).toContain("Today1 open");
    expect(summary()).toContain("Exhaledclear");
    expect(summary()).toContain("Someday1 open");
    var tabs = [];
    function on(e) { tabs.push(e.detail); }
    window.addEventListener("af-set-tab", on);
    await click(qa("button").filter(function (b) { return b.textContent === "Open full view"; })[0]);
    window.removeEventListener("af-set-tab", on);
    expect(tabs).toEqual(["brain"]);
  });

  it("Shopping: items left by aisle; in-store mode checks items off through the Shopping path", async function () {
    var toggle = vi.fn();
    await render(h(RedesignFlow, base({ shoppingItems: [{ id: "m", text: "Milk", category: "Dairy" }, { id: "k", text: "Kale", category: "Produce" }], shopCategories: ["Produce", "Dairy"], onToggleShoppingItem: toggle })));
    await pick("shopping");
    expect(summary()).toContain("Produce1 left");
    expect(summary()).toContain("Dairy1 left");
    await click(qa("button").filter(function (b) { return b.textContent === "In-store mode"; })[0]);
    expect(q('[data-testid="in-store"]')).not.toBe(null);
    await click(qa('[data-testid="in-store"] button').filter(function (b) { return b.textContent === "Milk"; })[0]);
    expect(toggle).toHaveBeenCalledWith("m", false);
  });

  it("Meals: Mon–Sun strip with empty nights dashed", async function () {
    await render(h(RedesignFlow, base({ meals: { Monday: { dinner: "Soup" } } })));
    await pick("meals");
    var cells = qa('[data-empty]');
    expect(cells.length).toBe(7);
    expect(cells[0].getAttribute("data-empty")).toBe("false");
    expect(cells[1].getAttribute("data-empty")).toBe("true");
    expect(cells[1].style.border).toMatch(/dashed/);
    expect(summary()).toContain("1 of 7 dinners planned");
  });

  it("Calendar: this week with person dots and neutral striped work tags", async function () {
    await render(h(RedesignFlow, base({
      calEvents: [{ id: 1, title: "Swim", date: "2026-11-13", forPerson: "k1" }],
      workSchedules: { L: { scheduleType: "set", days: { Friday: [] } } },
    })));
    await pick("calendar");
    expect(summary()).toContain("Swim");
    expect(q('[data-testid="person-dot"]').style.background).toMatch(/122, 158, 142|#7A9E8E/i);
    var tag = qa("span").filter(function (s) { return s.textContent === "LI" && s.title === "Working"; })[0];
    expect(tag).toBeTruthy();
    expect(tag.style.background).toMatch(/repeating-linear-gradient/);
  });

  it("Waves: today's routines", async function () {
    localStorage.setItem("af_exhale_waves", JSON.stringify({ daily: [{ id: "w1", name: "Morning reset", tasks: [{ done: true }, { done: false }] }], weekly: [{ id: "w2", name: "Friday tidy", dayOfWeek: 5, tasks: [{}] }, { id: "w3", name: "Monday only", dayOfWeek: 1, tasks: [{}] }] }));
    await render(h(RedesignFlow, base()));
    await pick("waves");
    expect(summary()).toContain("Morning reset1 of 2");
    expect(summary()).toContain("Friday tidy0 of 1");
    expect(summary()).not.toContain("Monday only");
  });

  it("Tide Pool: its tab opens the Tide Pool screen directly (no summary step)", async function () {
    await render(h(RedesignFlow, base({ coveData: [{ kidId: "k1", shells: 12 }] })));
    var went = [];
    function on(e) { went.push(e.detail); }
    window.addEventListener("af-set-tab", on);
    await pick("tidepool");
    window.removeEventListener("af-set-tab", on);
    expect(went).toEqual(["tidepool"]);
    expect(q('[data-testid="flowtab-exhale"]').getAttribute("aria-selected")).toBe("true");
  });

  it("each tab has its own tone: tinted, selected in its full color; summary takes the tint", async function () {
    await render(h(RedesignFlow, base()));
    var bgs = tabIds().map(function (id) { return q('[data-testid="flowtab-' + id + '"]').style.background; });
    expect(bgs[0]).toBe(hexRgb(tone.sage.full)); // Exhale, selected
    expect(bgs[1]).toBe(hexRgb(tone.teal.tint)); // Shopping
    expect(bgs[3]).toBe(hexRgb(tone.blue.tint)); // Calendar
    expect(bgs[4]).toBe(hexRgb(tone.mist.tint)); // Waves
    expect(bgs[6]).toBe(hexRgb(tone.navy.tint)); // Lighthouse
    expect(q('[data-testid="flow-summary"]').style.background).toBe(hexRgb(tone.sage.tint));
    await pick("calendar");
    expect(q('[data-testid="flowtab-calendar"]').style.background).toBe(hexRgb(tone.blue.full));
    expect(q('[data-testid="flowtab-exhale"]').style.background).toBe(hexRgb(tone.sage.tint));
    expect(q('[data-testid="flow-summary"]').style.background).toBe(hexRgb(tone.blue.tint));
  });

  it("Exhale quick-add writes to the Exhaled bucket without leaving Flow", async function () {
    localStorage.removeItem("af_exhale_buckets");
    await render(h(RedesignFlow, base()));
    var input = q('[data-testid="flow-quickadd-exhale"] input');
    await typeInto(input, "Call the dentist");
    await submit(q('[data-testid="flow-quickadd-exhale"]'));
    var stored = JSON.parse(localStorage.getItem("af_exhale_buckets"));
    expect(stored.items.map(function (i) { return [i.text, i.bucketIndex]; })).toEqual([["Call the dentist", 0]]);
    expect(summary()).toContain("1 open");
    expect(input.value).toBe("");
  });

  it("Shopping quick-add hands the text to onAddShoppingItem", async function () {
    var onAdd = vi.fn();
    await render(h(RedesignFlow, base({ onAddShoppingItem: onAdd, shopStore: "Costco" })));
    await pick("shopping");
    var input = q('[data-testid="flow-quickadd-shopping"] input');
    expect(input.placeholder).toBe("Add to Costco…");
    await typeInto(input, "Paper towels");
    await submit(q('[data-testid="flow-quickadd-shopping"]'));
    expect(onAdd).toHaveBeenCalledWith("Paper towels");
  });

  it("Lighthouse: today's lessons", async function () {
    await render(h(RedesignFlow, base({ schoolData: { k1: { homeschool: { weekPlan: { Friday: { subjects: [{ id: "s", name: "Math", title: "Fractions" }] } } } } } })));
    await pick("lighthouse");
    expect(summary()).toContain("Ava — Math: Fractions");
  });

  it("calm empty states for every section", async function () {
    await render(h(RedesignFlow, base()));
    var expected = { exhale: "Nothing on your mind", shopping: "The list is empty.", meals: "No dinners planned yet", calendar: "A wide-open week.", waves: "No routines for today.", lighthouse: "No lessons planned for today." };
    for (var id in expected) { await pick(id); expect(summary()).toContain(expected[id]); }
  });
});
