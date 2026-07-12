// tests/unit/update-banner.test.js
// Regression guards for the SW update banner and in-app notification toast.
//
// Bug context: both banners are position:fixed inside HomeFlow, which lives inside
// a FlowWrapper div that applies pointer-events:none when the AnchorVault is open
// (showAnchor=true). CSS pointer-events is an inherited property and propagates to
// position:fixed descendants. The fix is an explicit pointerEvents:"auto" on each
// banner container, overriding the inherited value.
//
// These source-text assertions prevent silent regression if the style is removed
// during a style refactor. They also serve as documentation of the root cause.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

var src = readFileSync(resolve(__dirname, "../../src/App.jsx"), "utf8");

describe("SW update banner — pointer-events regression guard", function() {
  it("banner container has pointerEvents:auto to override inherited pointer-events:none", function() {
    // Locate the banner block anchored on the unique staleBanner comment.
    var anchor = src.indexOf("SW update banner — shown when a new version is waiting");
    expect(anchor).not.toBe(-1);
    // 700 chars covers the full opening div line: the style string is ~280 chars long,
    // placed ~120 chars after the anchor comment, so pointerEvents:"auto" lands ~400+.
    var block = src.slice(anchor, anchor + 700);
    expect(block).toMatch(/pointerEvents\s*:\s*["']auto["']/);
  });

  it("banner container also has zIndex:10000 (fix must not remove the stacking guard)", function() {
    var anchor = src.indexOf("SW update banner — shown when a new version is waiting");
    var block = src.slice(anchor, anchor + 700);
    expect(block).toMatch(/zIndex\s*:\s*10000/);
  });

  it("banner is position:fixed (not relative — would lose viewport pinning)", function() {
    var anchor = src.indexOf("SW update banner — shown when a new version is waiting");
    var block = src.slice(anchor, anchor + 700);
    expect(block).toMatch(/position\s*:\s*["']fixed["']/);
  });
});

describe("In-app notification toast — pointer-events regression guard", function() {
  it("toast container has pointerEvents:auto (interactive: tap-to-dismiss)", function() {
    // Locate the toast block by its unique zIndex:9999 + setInAppBanner(null) onClick.
    // The toast container is the first element after the SW banner block.
    var anchor = src.indexOf("In-app notification banner (iOS + fallback)");
    expect(anchor).not.toBe(-1);
    // 700 chars: toast div style string is similar length to the SW banner div.
    var block = src.slice(anchor, anchor + 700);
    expect(block).toMatch(/pointerEvents\s*:\s*["']auto["']/);
  });
});

describe("No-waiting-worker path — attempts update() before force-reload", function() {
  it("else branch after getRegistration().waiting is null calls r.update() before forceReload", function() {
    // This is the path: getRegistration() returned r, but r.waiting is null.
    // r.update() fires a background update() check in passing — the reload does NOT
    // wait for it; it just nudges the SW to re-fetch its script in the background.
    var anchor = src.indexOf("ref went stale — re-query for a waiting worker");
    expect(anchor).not.toBe(-1);
    var block = src.slice(anchor, anchor + 500);
    expect(block).toMatch(/r\.update\(\)/);
    // update() must be called before forceReload() in the else branch
    var updatePos = block.indexOf("r.update()");
    var reloadPos = block.indexOf("forceReload()");
    expect(updatePos).not.toBe(-1);
    expect(reloadPos).not.toBe(-1);
    expect(updatePos).toBeLessThan(reloadPos);
  });
});
