// src/shell/navModel.js — af_redesign top nav: which section is current and
// what the screen is called (passed to Compass as context).
import { tone, accentTone } from "../design/tokens.js";

// Pillar colors: Today sand, Flow teal, Anchor navy, Ripples teal-green.
export var NAV_SECTIONS = [
  { id: "today", label: "Today", tone: tone.sand },
  { id: "flow", label: "Flow", tone: tone.teal },
  { id: "anchor", label: "Anchor", tone: tone.navy },
  { id: "ripples", label: "Ripples", tone: accentTone.seafoam },
];

export var RD_NAVY_TABS = ["cove","home","people","horizon","settings"];
export var RD_TAB_SECTION = { anchor:"today", flowhome:"flow", calendar:"flow", brain:"flow", waves:"flow", tidepool:"flow", lighthouse:"flow", meals:"flow", shop:"flow", cove:"anchor", home:"anchor", people:"anchor", horizon:"anchor" };
var RD_TAB_SCREEN = { anchor:"Today", flowhome:"Flow", calendar:"Calendar", brain:"Exhale", waves:"Waves", tidepool:"Tide Pool", lighthouse:"Lighthouse", meals:"Meals", shop:"Shopping", cove:"Cove", home:"Home", people:"People", horizon:"Horizon", settings:"Settings" };
export function navCurrent(showAnchor, vaultSection, tab) {
  if (showAnchor) return vaultSection === "ripples" ? "ripples" : "anchor";
  return RD_TAB_SECTION[tab] || null;
}
export function navScreenName(showAnchor, vaultSection, tab) {
  if (showAnchor) return vaultSection === "ripples" ? "Ripples" : vaultSection === "home" ? "Anchor" : vaultSection === "safeharbor" ? "Safe Harbor" : "Vault";
  return RD_TAB_SCREEN[tab] || "Today";
}


// Compass panel quick prompts.
export var QUICK_PROMPTS = ["Plan dinners this week", "What's due soon?", "I'm overwhelmed"];
// Footer links: the existing contact page and privacy policy on the site.
export var CONTACT_URL = "https://home.anchorandflowapp.com/contact.html";
export var PRIVACY_URL = "https://home.anchorandflowapp.com/privacy.html";
