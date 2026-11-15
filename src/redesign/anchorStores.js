// src/redesign/anchorStores.js — reads every key the redesigned Anchor
// screens summarize (RedesignAnchor, VaultFull). Read-only; each key is owned
// by AnchorVault / HomeFlow, so callers re-read on af-data-changed / storage /
// af-anchor-hidden-changed.
function rd(key, fb) { try { var v = JSON.parse(localStorage.getItem("af_" + key) || "null"); return v === null ? fb : v; } catch { return fb; } }
export function readAnchorStores() {
  return {
    anchorHidden: rd("anchor_hidden", {}),
    showEmojis: rd("showEmojis", false),
    inventory: rd("inventory", {}), vaultSystems: rd("vaultSystems", []), ownedProducts: rd("ownedProducts", []),
    houseFile: rd("houseFile", []), health: rd("health", {}), career: rd("career", {}), subs: rd("subs", []),
    celebrations: rd("celebrations", []), birthdays: rd("birthdays", []), pets: rd("pets", []), trips: rd("trips", []),
    travelProfile: rd("travel_profile", {}), people: rd("people", []),
    safeHarbor: rd("safe_harbor", null), homeCleaning: rd("home_cleaning", null),
    coveNotes: rd("cove_notes_v1", []), coveLists: rd("cove_lists_v1", []), coveItems: rd("cove_items_v1", {}),
  };
}

