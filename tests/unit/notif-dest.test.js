// tests/unit/notif-dest.test.js
// Tests for notification tap-to-open destination routing (notif-click branch).
//
// Coverage:
//   1. AF_DEST_MAP slug → tab id (pure logic, no App.jsx import needed)
//   2. Source-text assertions confirming the fixes exist in sw.js,
//      api/send-notifications.js, and App.jsx
//
// sw.js notificationclick logic is NOT unit-testable in Node (requires ServiceWorker
// globals: self, clients, event.waitUntil). Manual coverage: tap a push notification
// while the app is closed → confirm it opens /?af_dest=today; while open → confirm
// af-set-tab fires with "anchor" or the correct tab id.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── 1. Slug → tab id map (pure logic) ────────────────────────────────────────
// This map must be kept in sync with the inlined _DEST_MAP / _DEST_MAP objects
// in App.jsx (onMessage handler and boot shim) and NOTIF_DEST in
// api/send-notifications.js.
const AF_DEST_MAP = { today:"anchor", meals:"meals", calendar:"calendar", shopping:"shop", shop:"shop" };

// Valid TABS ids from main's App.jsx const TABS = [...].
// "lighthouse" is lh-2-only and must NOT appear here.
// This list is the acceptance gate: map values MUST be in here.
const VALID_TAB_IDS = [
  "anchor","calendar","meals","shop","ai",
  "tidepool","cove","weekly","home","brain",
  "school","settings"
];

describe("AF_DEST_MAP — slug → valid tab id", function() {
  it("every mapped value is a valid TABS id", function() {
    Object.entries(AF_DEST_MAP).forEach(function(entry) {
      var slug = entry[0];
      var tabId = entry[1];
      expect(VALID_TAB_IDS).toContain(tabId);
    });
  });

  it("today → anchor (dashboard)", function() {
    expect(AF_DEST_MAP["today"]).toBe("anchor");
  });

  it("meals → meals (Meals tab)", function() {
    expect(AF_DEST_MAP["meals"]).toBe("meals");
  });

  it("calendar → calendar", function() {
    expect(AF_DEST_MAP["calendar"]).toBe("calendar");
  });

  it("shopping → shop", function() {
    expect(AF_DEST_MAP["shopping"]).toBe("shop");
  });

  it("shop → shop (short alias)", function() {
    expect(AF_DEST_MAP["shop"]).toBe("shop");
  });

  it("unknown slug resolves to empty string via || ''", function() {
    expect(AF_DEST_MAP["unknown"] || "").toBe("");
    expect(AF_DEST_MAP["TODAY"] || "").toBe("");  // case-sensitive
    expect(AF_DEST_MAP[""] || "").toBe("");
  });

  it("undefined slug resolves to empty string via || ''", function() {
    expect(AF_DEST_MAP[undefined] || "").toBe("");
  });

  it("null slug resolves to empty string via || ''", function() {
    expect(AF_DEST_MAP[null] || "").toBe("");
  });
});

// ── 2. Source-text assertions ─────────────────────────────────────────────────
// These guard against regression — confirm the three file edits are present
// without importing the files (App.jsx has a module-scope IIFE; sw.js uses
// ServiceWorker globals; send-notifications.js uses web-push at module load).

describe("notif-click source — sw.js", function() {
  var sw = readFileSync(resolve(__dirname, "../../public/sw.js"), "utf8");

  it("notificationclick reads notification.data.url (not hardcoded /?ripple=1)", function() {
    expect(sw).toMatch(/event\.notification\.data && event\.notification\.data\.url/);
  });

  it("openWindow uses dest variable, not hardcoded string", function() {
    expect(sw).toMatch(/openWindow\(dest\)/);
    expect(sw).not.toMatch(/openWindow\("\/\?ripple=1"\)/);
  });

  it("postMessage includes url field", function() {
    expect(sw).toMatch(/postMessage\(\s*\{\s*type:\s*"NOTIF_CLICK",\s*url:\s*dest\s*\}/);
  });
});

describe("notif-click source — api/send-notifications.js", function() {
  var api = readFileSync(resolve(__dirname, "../../api/send-notifications.js"), "utf8");

  it("NOTIF_DEST map is defined with af_dest slugs", function() {
    expect(api).toMatch(/NOTIF_DEST/);
    expect(api).toMatch(/af_dest=today/);
    expect(api).toMatch(/af_dest=meals/);
  });

  it("dinner maps to /?af_dest=meals (not today)", function() {
    var dinnerMatch = api.match(/dinner['":\s]+['"]([^'"]+)['"]/);
    expect(dinnerMatch).not.toBeNull();
    expect(dinnerMatch[1]).toBe("/?af_dest=meals");
  });

  it("data.url uses NOTIF_DEST lookup (not hardcoded '/')", function() {
    expect(api).toMatch(/url:\s*NOTIF_DEST\[notifMeta\.type\]/);
    // Old hardcoded url: '/' must not appear in the sendNotification payload
    expect(api).not.toMatch(/data:\s*\{\s*type:\s*notifMeta\.type,\s*url:\s*'\/'\s*\}/);
  });

  it("error log includes endpoint tail (F4')", function() {
    expect(api).toMatch(/sub\.endpoint.*slice\(-40\)/);
  });
});

describe("notif-click source — App.jsx", function() {
  var src = readFileSync(resolve(__dirname, "../../src/App.jsx"), "utf8");

  it("onMessage handler parses af_dest from url in NOTIF_CLICK postMessage", function() {
    expect(src).toMatch(/e\.data\.type === "NOTIF_CLICK"/);
    expect(src).toMatch(/e\.data\.url/);
    expect(src).toMatch(/get\("af_dest"\)/);
  });

  it("onMessage dispatches af-set-tab for known dest, falls back to Ripple for unknown", function() {
    var onMsgStart = src.indexOf('e.data.type === "NOTIF_CLICK"');
    var onMsgEnd   = src.indexOf("NOTIF_ACTION", onMsgStart + 1);  // next handler
    var block = onMsgStart > -1 ? src.slice(onMsgStart, onMsgStart + 800) : "";
    expect(block).toMatch(/af-set-tab/);
    expect(block).toMatch(/ripple-notif-action/);  // fallback still present
  });

  it("boot shim reads af_dest from window.location.search", function() {
    expect(src).toMatch(/_afDest.*URLSearchParams.*window\.location\.search/s);
  });

  it("boot shim strips the param via history.replaceState", function() {
    var shimStart = src.indexOf("af_dest: destination-aware notification tap");
    var shim = shimStart > -1 ? src.slice(shimStart, shimStart + 700) : "";
    expect(shim).toMatch(/history\.replaceState/);
  });

  it("boot shim calls goTab with the mapped tab id", function() {
    var shimStart = src.indexOf("af_dest: destination-aware notification tap");
    var shim = shimStart > -1 ? src.slice(shimStart, shimStart + 700) : "";
    expect(shim).toMatch(/goTab\(_destTab\)/);
  });

  it("_DEST_MAP in App.jsx contains all expected slug keys", function() {
    expect(src).toMatch(/today\s*:\s*"anchor"/);
    expect(src).toMatch(/meals\s*:\s*"meals"/);
    expect(src).toMatch(/calendar\s*:\s*"calendar"/);
    expect(src).toMatch(/shopping\s*:\s*"shop"/);
  });
});
