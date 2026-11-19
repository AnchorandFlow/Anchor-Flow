// Sunset "Anchored" (af_redesign): finishing writes tonight's record; the
// Today card then reads "Anchored" with a check; tapping reopens tonight's
// reflection to view / edit (no new Sunset, no second close-out).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import SunsetClose from "../../src/shell/SunsetClose.jsx";
import RedesignHome from "../../src/redesign/RedesignHome.jsx";
import { getSunsetEntry, todayKey } from "../../src/lib/sunsetLog.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
var h = React.createElement;
var EVENING = new Date(2026, 10, 13, 21, 0, 0);
var container, root;
function set(k, v) { localStorage.setItem("af_" + k, JSON.stringify(v)); }
function q(s) { return container.querySelector(s); }
function qa(s) { return Array.from(container.querySelectorAll(s)); }
function byText(sel, text) { return qa(sel).find(function (e) { return e.textContent.trim() === text; }); }
async function render(el) { await act(async function () { root.render(el); }); }
async function click(el) { await act(async function () { el.click(); }); }

beforeEach(function () {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(EVENING);
  localStorage.setItem("af_myPersonId", "p_lin");
  set("preferredName", "Lindsey");
  set("compassEnabled", false);
  set("tasks", [{ id: "a", text: "Return library books", day: "Friday", done: false }, { id: "b", text: "Fold laundry", day: "Friday", done: false }]);
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(function () { act(function () { root.unmount(); }); container.remove(); vi.useRealTimers(); });

function home() { return h(RedesignHome, { displayName: "Lindsey", calEvents: [], meals: {}, shoppingItems: [], people: [], compassEnabled: false }); }

describe("Sunset Anchored — af_redesign on", function () {
  it("finishing Sunset saves tonight's record for this member", async function () {
    var closed = vi.fn();
    await render(h(SunsetClose, { redesign: true, onCloseDay: closed }));
    await click(qa("[data-sunset-section] > button")[0]); // Reflect
    await click(byText("button", "Grateful"));
    await click(qa("[data-sunset-section] > button")[2]); // Release
    await click(qa("button").filter(function (b) { return b.textContent === "Tomorrow"; })[0]);
    await click(byText("button", "Anchor the day"));
    var e = getSunsetEntry("p_lin", todayKey(EVENING));
    expect(e.mood).toBe("grateful");
    expect(e.released).toEqual([{ text: "Return library books", choice: "tomorrow" }]);
    expect(q('[data-testid="sunset-done"]')).toBeTruthy();
  });

  it("Today card: Begin before, Anchored with a check after; resets the next day", async function () {
    await render(home());
    expect(q('[data-testid="sunset-card-button"]').textContent).toBe("Begin");
    set("sunset_log", { p_lin: { [todayKey(EVENING)]: { mood: "calm", released: [], exhaled: [], updatedAt: "t" } } });
    await act(async function () { window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: "sunset_log" } })); });
    var btn = q('[data-testid="sunset-card-button"]');
    expect(btn.textContent).toBe("Anchored");
    expect(btn.querySelector("svg")).toBeTruthy();
    expect(q('[data-testid="sunset-card"]').getAttribute("data-anchored")).toBe("true");
    var opened = vi.fn();
    window.addEventListener("af-open-sunset", opened);
    await click(btn);
    expect(opened).toHaveBeenCalled(); // same entry point; Sunset itself reopens the reflection
    window.removeEventListener("af-open-sunset", opened);
    vi.setSystemTime(new Date(2026, 10, 14, 19, 0, 0));
    await render(home());
    expect(q('[data-testid="sunset-card-button"]').textContent).toBe("Begin");
  });

  it("tapping Anchored reopens tonight's reflection to view and edit — not a new Sunset", async function () {
    set("tasks", [{ id: "a", text: "Return library books", day: "Friday", done: false, archived: true }, { id: "b", text: "Fold laundry", day: "Friday", done: false }]);
    set("sunset_log", { p_lin: { [todayKey(EVENING)]: { completedAt: "c", updatedAt: "u", mood: "calm", released: [{ text: "Return library books", choice: "tomorrow" }], exhaled: ["Call the dentist"] } } });
    var closeDay = vi.fn(), close = vi.fn();
    await render(h(SunsetClose, { redesign: true, onCloseDay: closeDay, onClose: close }));
    expect(q('[data-testid="sunset-anchored"]').textContent).toBe("Anchored");
    expect(byText("button", "Anchor the day")).toBeUndefined();
    await click(qa("[data-sunset-section] > button")[0]);
    expect(byText("button", "Calm").getAttribute("style")).toContain("font-weight: 700"); // saved mood shown
    await click(qa("[data-sunset-section] > button")[2]);
    expect(q('[data-testid="sunset-released"]').textContent).toContain("Return library books");
    expect(q('[data-testid="sunset-released"]').textContent).toContain("Moved to tomorrow");
    await click(qa("[data-sunset-section] > button")[4]);
    expect(q('[data-testid="sunset-exhaled"]').textContent).toContain("Call the dentist");
    await click(byText("button", "Rough"));
    await click(byText("button", "Save changes"));
    var e = getSunsetEntry("p_lin", todayKey(EVENING));
    expect(e.mood).toBe("rough");
    expect(e.completedAt).toBe("c");
    expect(close).toHaveBeenCalled();
    expect(closeDay).not.toHaveBeenCalled();
    expect(q('[data-testid="sunset-done"]')).toBeNull();
  });

  it("flag off: Sunset never reads or writes the record", async function () {
    set("sunset_log", { p_lin: { [todayKey(EVENING)]: { mood: "calm", released: [], exhaled: [], updatedAt: "u" } } });
    await render(h(SunsetClose, {}));
    expect(q('[data-testid="sunset-anchored"]')).toBeNull();
    expect(byText("button", "Anchor the day")).toBeTruthy();
    await click(byText("button", "Anchor the day"));
    expect(JSON.parse(localStorage.getItem("af_sunset_log")).p_lin[todayKey(EVENING)].mood).toBe("calm");
  });
});
