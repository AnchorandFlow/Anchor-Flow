// tests/unit/design-redesign.test.js
// af_redesign flag (default OFF, device-local), showEmojis household setting
// (synced, default OFF), and the design-token rules in src/design/tokens.js.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readRedesignFlag, writeRedesignFlag, REDESIGN_FLAG_KEY } from "../../src/design/redesignFlag.js";
import tokens, { color, gradient, radius, font, person, workDayTag, shouldShowEmoji, initialsFor } from "../../src/design/tokens.js";
import { SYNC_KEYS, sanitizeHouseholdData } from "../../src/sync-core.js";

function memStorage(init) {
  var m = Object.assign({}, init || {});
  return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, _m: m };
}

describe("af_redesign flag", function () {
  beforeEach(function () { localStorage.clear(); vi.resetModules(); });

  it("defaults to OFF on a fresh device", async function () {
    expect(readRedesignFlag(memStorage())).toBe(false);
    expect(readRedesignFlag()).toBe(false);
    var mod = await import("../../src/design/redesignFlag.js");
    expect(mod.REDESIGN).toBe(false);
  });

  it("is ON only for the exact string \"true\"", function () {
    expect(readRedesignFlag(memStorage({ af_redesign: "true" }))).toBe(true);
    expect(readRedesignFlag(memStorage({ af_redesign: "1" }))).toBe(false);
    expect(readRedesignFlag(memStorage({ af_redesign: "false" }))).toBe(false);
  });

  it("is OFF when storage is missing or throws", function () {
    expect(readRedesignFlag(null)).toBe(false);
    expect(readRedesignFlag({ getItem: function () { throw new Error("blocked"); } })).toBe(false);
  });

  it("write on/off round-trips; off removes the key", function () {
    var s = memStorage();
    writeRedesignFlag(true, s);
    expect(s._m[REDESIGN_FLAG_KEY]).toBe("true");
    expect(readRedesignFlag(s)).toBe(true);
    writeRedesignFlag(false, s);
    expect(REDESIGN_FLAG_KEY in s._m).toBe(false);
    expect(readRedesignFlag(s)).toBe(false);
  });

  it("module constant picks up a pre-set flag on load", async function () {
    localStorage.setItem("af_redesign", "true");
    var mod = await import("../../src/design/redesignFlag.js");
    expect(mod.REDESIGN).toBe(true);
  });

  it("is device-local: not a synced household key", function () {
    expect(SYNC_KEYS).not.toContain("redesign");
    expect(SYNC_KEYS).not.toContain("af_redesign");
  });
});

describe("showEmojis household setting", function () {
  it("is a synced household key", function () {
    expect(SYNC_KEYS).toContain("showEmojis");
  });
  it("survives sanitize for both values (false is a real value, not dropped)", function () {
    expect(sanitizeHouseholdData({ showEmojis: false }).showEmojis).toBe(false);
    expect(sanitizeHouseholdData({ showEmojis: true }).showEmojis).toBe(true);
  });
  it("defaults OFF; pillar and lock icons always show", function () {
    expect(tokens.emoji.defaultOn).toBe(false);
    expect(shouldShowEmoji("decorative", undefined)).toBe(false);
    expect(shouldShowEmoji("decorative", false)).toBe(false);
    expect(shouldShowEmoji("decorative", true)).toBe(true);
    expect(shouldShowEmoji("pillar", false)).toBe(true);
    expect(shouldShowEmoji("lock", false)).toBe(true);
  });
});

// ── Tokens ──────────────────────────────────────────────────────────────────
function hexToHsl(hex) {
  var h = hex.replace("#", "");
  var r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  var s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  var hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { h: hue, s: s, l: l };
}
function collectHexes(obj, path, out) {
  if (typeof obj === "string") { (obj.match(/#[0-9A-Fa-f]{6}\b/g) || []).forEach(function (x) { out.push({ path: path, hex: x }); }); return out; }
  if (obj && typeof obj === "object") Object.keys(obj).forEach(function (k) { collectHexes(obj[k], path + "." + k, out); });
  return out;
}

describe("design tokens", function () {
  it("calm palette matches spec", function () {
    expect(color).toMatchObject({ background: "#F5F0E8", surface: "#FDFAF5", flowBackground: "#FAF8F3", anchorNavy: "#1B2B44", gold: "#C8A253" });
    expect(color.tint).toEqual({ sage: "#DEEEE8", sand: "#F0E4D0", blue: "#DCEEF0", seafoam: "#E4EEEA", mist: "#E2EAF0" });
    expect(gradient.ripples).toMatchObject({ from: "#2F7E76", to: "#1D5751" });
  });

  it("sunset runs warm glow at top to dusk indigo 26263F at bottom, ivory text", function () {
    var stops = gradient.sunset.stops;
    expect(stops[0].at).toBe(0);
    expect(hexToHsl(stops[0].hex).h).toBeGreaterThanOrEqual(20);
    expect(hexToHsl(stops[0].hex).h).toBeLessThanOrEqual(45); // orange
    expect(stops[stops.length - 1]).toMatchObject({ hex: "#26263F", at: 100 });
    expect(stops.map(function (s) { return s.name; })).toEqual(["glow", "coral", "mauve", "duskIndigo"]);
    expect(gradient.sunset.text).toBe("#F2EAD8");
    expect(gradient.sunset.css.indexOf("180deg")).toBeGreaterThan(-1);
  });

  it("no purple or pink anywhere except Sunset", function () {
    var all = collectHexes(Object.assign({}, tokens, { gradient: { ripples: gradient.ripples } }), "tokens", []);
    expect(all.length).toBeGreaterThan(15);
    var offenders = all.filter(function (c) {
      var x = hexToHsl(c.hex);
      return x.s > 0.12 && x.h >= 260 && x.h <= 345; // violet/purple/magenta/pink
    });
    expect(offenders).toEqual([]);
  });

  it("card radius 14–20px; fonts; checklist items 14px DM Sans", function () {
    [radius.sm, radius.md, radius.lg].forEach(function (r) { expect(r).toBeGreaterThanOrEqual(14); expect(r).toBeLessThanOrEqual(20); });
    expect(font.heading).toMatch(/^'Cormorant Garamond'/);
    expect(font.body).toMatch(/^'DM Sans'/);
    expect(font.checklistItem.size).toBe(14);
    expect(font.checklistItem.family).toMatch(/^'DM Sans'/);
  });

  it("person colors; work days are neutral striped initials, not a person color", function () {
    expect(person).toMatchObject({ lindsey: "#4A7FA8", twyla: "#3AAA91", kids: ["#7A9E8E", "#C4A882"] });
    expect(workDayTag.showsInitials).toBe(true);
    expect(workDayTag.background).toMatch(/repeating-linear-gradient/);
    var personHexes = [person.lindsey, person.twyla].concat(person.kids);
    collectHexes(workDayTag, "workDayTag", []).forEach(function (c) {
      expect(personHexes).not.toContain(c.hex.toUpperCase());
      var h = c.hex.replace("#", "");
      var ch = [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); });
      expect(Math.max.apply(null, ch) - Math.min.apply(null, ch)).toBeLessThan(30); // low chroma = neutral
    });
    expect(initialsFor("Lindsey Border")).toBe("LB");
    expect(initialsFor("Twyla")).toBe("TW");
    expect(initialsFor("")).toBe("");
  });
});
