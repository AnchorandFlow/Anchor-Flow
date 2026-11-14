// tests/ui/legacy-golden.js — renders the legacy (af_redesign OFF) Ripples
// and Sunset screens through a fixed set of scenarios and returns their DOM.
// The golden file (tests/ui/__golden__/ripples-sunset-legacy.json) was
// captured from the code BEFORE the redesign touched these components, so a
// flag-off test comparing against it proves the old look is byte-identical.
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
var h = React.createElement;

function seed() {
  localStorage.clear();
  function set(k, v) { localStorage.setItem("af_" + k, JSON.stringify(v)); }
  set("ripples", [
    { id: "r1", name: "\"I'm not tired, my eyes are\"", who: "June", category: "funny", date: "2026-11-02", note: "" },
    { id: "r2", name: "First lost tooth", who: "Ollie", category: "milestone", date: "2025-11-13", note: "Front left" },
    { id: "r3", name: "Rode a bike", who: "June", category: "firsts", date: "2026-10-20", note: "" },
  ]);
  set("traditions", [
    { id: "t1", emoji: "🎃", title: "Pumpkin pancakes", startedYear: 2023, when: "11-20", description: "First snow", years: [2023, 2024, 2025] },
  ]);
  set("preferredName", "Lindsey Border");
  set("compassEnabled", false);
  set("tasks", [
    { id: "a", text: "Return library books", day: "Friday", done: false },
    { id: "b", text: "Pack lunches", day: "Friday", done: true },
  ]);
  set("calEvents", [{ date: "2026-11-14", time: "09:00", title: "Soccer" }]);
  set("meals", { Saturday: { dinner: "Tacos" } });
}

export async function renderScenarios(Ripples, Sunset, extraProps) {
  var out = {};
  var ep = extraProps || {};
  var container = document.createElement("div");
  document.body.appendChild(container);
  var root = createRoot(container);
  async function render(el) { await act(async function () { root.render(el); }); }
  async function click(el) { await act(async function () { el.click(); }); }
  function byText(sel, text) { return Array.from(container.querySelectorAll(sel)).find(function (e) { return e.textContent.trim() === text; }); }

  // Ripples — every tab, plus the add modal
  seed();
  await render(h(Ripples, ep.ripples || {}));
  var labels = ["Timeline", "Kid Quotes", "Traditions", "Recaps", "Yearbook"];
  for (var i = 0; i < labels.length; i++) {
    var tab = byText("div", labels[i]);
    if (tab) await click(tab);
    out["ripples:" + labels[i]] = container.innerHTML;
  }
  var add = byText("div", "+ Add ripple");
  if (add) { await click(add); out["ripples:addModal"] = container.innerHTML; }
  await render(h("div"));

  // Sunset — closed, every section open, a decision picked, then anchored
  seed();
  await render(h(Sunset, Object.assign({ weatherData: [{ date: "2026-11-14", high: 51, low: 33, code: 2 }] }, ep.sunset || {})));
  out["sunset:closed"] = container.innerHTML;
  var buttons = Array.from(container.querySelectorAll("button")).filter(function (b) { return /Reflect|Celebrate|Release|Prepare|Exhale/i.test(b.textContent); });
  for (var j = 0; j < buttons.length; j++) await click(buttons[j]);
  var mood = byText("button", "Calm"); if (mood) await click(mood);
  var later = byText("button", "Later"); if (later) await click(later);
  out["sunset:open"] = container.innerHTML;
  var anchor = byText("button", "Anchor the day");
  if (anchor) await click(anchor);
  out["sunset:anchored"] = container.innerHTML;

  await act(async function () { root.unmount(); });
  container.remove();
  return out;
}
