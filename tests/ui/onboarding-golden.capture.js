// Captures the flag-off wizard's HTML for every screen + both branches.
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import OnboardingWizard from "../../src/onboarding/Onboarding.jsx";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
var h = React.createElement;
export async function captureLegacy(extraProps) {
  var out = [];
  var c = document.createElement("div"); document.body.appendChild(c);
  var root = createRoot(c);
  var payload = null;
  await act(async function () { root.render(h(OnboardingWizard, Object.assign({ householdId: "hh_test", initialPeople: [{ name: "Wren", birthday: "2017-03-14" }, { name: "Sam", birthday: "1988-01-02" }], onComplete: function (p) { payload = p; }, onSkip: function () {} }, extraProps || {}))); });
  function click(label) {
    var b = Array.prototype.find.call(c.querySelectorAll("button"), function (x) { return x.textContent === label; });
    if (!b) throw new Error("no button " + label);
    return act(async function () { b.click(); });
  }
  out.push(c.innerHTML);
  await click("Continue"); out.push(c.innerHTML);
  await click("Yes"); out.push(c.innerHTML);
  await click("Continue"); out.push(c.innerHTML);
  await click("Turn these on now"); out.push(c.innerHTML);
  await click("Got it"); out.push(c.innerHTML.replace(/ob_[a-z0-9_]+/g, "ID"));
  await click("Let’s go!");
  act(function () { root.unmount(); }); c.remove();
  return { html: out, payload: payload };
}
