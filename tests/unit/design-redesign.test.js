// tests/unit/design-redesign.test.js
// af_redesign flag (default OFF, device-local), showEmojis household setting
// (synced, default OFF), and the design-token rules in src/design/tokens.js.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readRedesignFlag, writeRedesignFlag, getRedesignState, isRedesignEligible, REDESIGN_FLAG_KEY, REDESIGN_PUBLIC, BETA_HOUSEHOLDS } from "../../src/design/redesignFlag.js";
import tokens, { color, gradient, radius, font, person, workDayTag, shouldShowEmoji, initialsFor, tone, sectionTone, toneFor, fullBleed } from "../../src/design/tokens.js";
import { SYNC_KEYS, sanitizeHouseholdData } from "../../src/sync-core.js";

function memStorage(init) {
  var m = Object.assign({}, init || {});
  return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, _m: m };
}

var BETA = "hh_o7yzu28";
function hh(id, extra) { return memStorage(Object.assign({ af_householdId: JSON.stringify(id) }, extra || {})); }

describe("af_redesign gating config", function () {
  it("ships with REDESIGN_PUBLIC false and hh_o7yzu28 as the only beta household", function () {
    expect(REDESIGN_PUBLIC).toBe(false);
    expect(BETA_HOUSEHOLDS).toEqual([BETA]);
  });
});

describe("af_redesign — no household / fresh device", function () {
  beforeEach(function () { localStorage.clear(); vi.resetModules(); });
  it("defaults to OFF and is not eligible", async function () {
    expect(getRedesignState(memStorage())).toEqual({ eligible: false, on: false, householdId: null });
    expect(readRedesignFlag()).toBe(false);
    var mod = await import("../../src/design/redesignFlag.js");
    expect(mod.REDESIGN).toBe(false);
  });
  it("is OFF when storage is missing or throws", function () {
    expect(readRedesignFlag(null)).toBe(false);
    expect(readRedesignFlag({ getItem: function () { throw new Error("blocked"); } })).toBe(false);
  });
});

describe("af_redesign — beta household", function () {
  beforeEach(function () { localStorage.clear(); vi.resetModules(); });
  it("is ON by default with no per-device value, switch visible (eligible)", function () {
    expect(getRedesignState(hh(BETA))).toEqual({ eligible: true, on: true, householdId: BETA });
  });
  it("per-device switch turns it off and back on, without affecting eligibility", function () {
    var s = hh(BETA);
    writeRedesignFlag(false, s);
    expect(s._m[REDESIGN_FLAG_KEY]).toBe("false");
    expect(getRedesignState(s)).toMatchObject({ eligible: true, on: false });
    writeRedesignFlag(true, s);
    expect(getRedesignState(s)).toMatchObject({ eligible: true, on: true });
  });
  it("module constant is ON at load for a beta-household device", async function () {
    localStorage.setItem("af_householdId", JSON.stringify(BETA));
    var mod = await import("../../src/design/redesignFlag.js");
    expect(mod.REDESIGN).toBe(true);
  });
  it("module constant respects a device opt-out at load", async function () {
    localStorage.setItem("af_householdId", JSON.stringify(BETA));
    localStorage.setItem("af_redesign", "false");
    var mod = await import("../../src/design/redesignFlag.js");
    expect(mod.REDESIGN).toBe(false);
  });
});

describe("af_redesign — non-beta household", function () {
  beforeEach(function () { localStorage.clear(); vi.resetModules(); });
  it("is always OFF and the switch is hidden (not eligible)", function () {
    expect(getRedesignState(hh("hh_someone"))).toEqual({ eligible: false, on: false, householdId: "hh_someone" });
  });
  it("ignores a stored \"true\" (e.g. left over from the opt-in version)", async function () {
    expect(readRedesignFlag(hh("hh_someone", { af_redesign: "true" }))).toBe(false);
    localStorage.setItem("af_householdId", JSON.stringify("hh_someone"));
    localStorage.setItem("af_redesign", "true");
    var mod = await import("../../src/design/redesignFlag.js");
    expect(mod.REDESIGN).toBe(false);
  });
  it("near-miss ids don't match", function () {
    ["HH_O7YZU28", "hh_o7yzu2", "hh_o7yzu28 ", ""].forEach(function (id) {
      expect(isRedesignEligible(id)).toBe(false);
    });
  });
});

describe("af_redesign — REDESIGN_PUBLIC true", function () {
  var PUB = { isPublic: true };
  it("turns it on for every household, including non-beta and no household", function () {
    expect(getRedesignState(hh("hh_someone"), PUB)).toEqual({ eligible: true, on: true, householdId: "hh_someone" });
    expect(getRedesignState(hh(BETA), PUB)).toMatchObject({ eligible: true, on: true });
    expect(getRedesignState(memStorage(), PUB)).toMatchObject({ eligible: true, on: true });
  });
  it("a device can still opt out to compare", function () {
    expect(readRedesignFlag(hh("hh_someone", { af_redesign: "false" }), PUB)).toBe(false);
  });
  it("public=false with an explicit beta list behaves like the shipped config", function () {
    expect(isRedesignEligible("hh_x", { isPublic: false, beta: ["hh_x"] })).toBe(true);
    expect(isRedesignEligible("hh_y", { isPublic: false, beta: ["hh_x"] })).toBe(false);
  });
});

describe("af_redesign is device-local", function () {
  it("is not a synced household key", function () {
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
    expect(stops.map(function (s) { return s.name; })).toEqual(["glow", "coral", "dustyRose", "mauve", "duskIndigo"]);
    expect(gradient.sunset.css).toBe("linear-gradient(180deg, " + stops.map(function (s) { return s.hex + " " + s.at + "%"; }).join(", ") + ")");
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

  it("section tones: sage, sand, blue, teal, mist, navy; every Flow and Anchor section has one", function () {
    expect(Object.keys(tone).sort()).toEqual(["blue", "mist", "navy", "sage", "sand", "teal"]);
    ["exhale", "shopping", "meals", "calendar", "waves", "tidepool", "lighthouse", "vault", "safeharbor", "home", "people", "cove", "horizon"].forEach(function (id) {
      expect(tone[sectionTone[id]]).toBeTruthy();
      expect(toneFor(id)).toBe(tone[sectionTone[id]]);
    });
    function lum(hex) {
      var c = [1, 3, 5].map(function (i) { var v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    Object.keys(tone).forEach(function (k) {
      expect((1.05) / (lum(tone[k].full) + 0.05)).toBeGreaterThanOrEqual(4.5); // white text on the selected tab
      expect((lum(tone[k].tint) + 0.05) / (lum(tone[k].ink) + 0.05)).toBeGreaterThanOrEqual(4.5); // ink on the tint
    });
    expect(fullBleed("#1B2B44").boxShadow).toBe("0 0 0 100vmax #1B2B44");
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

// ── More approved colors: Waves, Calendar, Lighthouse ───────────────────────
import { accentTone, waveTone, calendarTones, schoolTones, subjectTone } from "../../src/design/tokens.js";
import { eventTone } from "../../src/redesign/fullViewData.js";
import { lhChipStyle, lhRowStyle, lhTextStyle, LH_AREA_TONE, lhAreaTone, kidTone } from "../../src/redesign/lighthouseColors.js";

describe("approved color mix (af_redesign)", function () {
  function lum2(hex) { var c = [1, 3, 5].map(function (i) { var v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function hue(hex) { var n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255; var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; var l = (mx + mn) / 2; return { h: h, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0 }; }

  it("accent tones pass AA (white on full, ink on tint) and none is purple or pink", function () {
    Object.keys(accentTone).forEach(function (k) {
      var t = accentTone[k];
      expect(1.05 / (lum2(t.full) + 0.05)).toBeGreaterThanOrEqual(4.5);
      expect((lum2(t.tint) + 0.05) / (lum2(t.ink) + 0.05)).toBeGreaterThanOrEqual(4.5);
      [t.tint, t.full, t.ink].forEach(function (x) { var c = hue(x); expect(c.s > 0.12 && c.h >= 260 && c.h <= 345).toBe(false); });
    });
  });

  it("Waves: each rhythm has its own color, and not all blue", function () {
    var fulls = ["daily", "weekly", "seasonal", "custom"].map(function (k) { return waveTone[k].full; });
    expect(new Set(fulls).size).toBe(4);
    expect(fulls.filter(function (f) { var h = hue(f).h; return h >= 195 && h < 260; }).length).toBe(0);
  });

  it("Calendar: default-blue events spread over the palette; chosen colors keep their family; pink lands on gold", function () {
    var titles = ["Dentist", "Soccer", "Piano", "Library day", "Field trip", "Date night", "Swim", "Book club", "Co-op", "Vet"];
    var seen = new Set(titles.map(function (t) { return eventTone({ title: t, color: "#6A9BB5" }).full; }));
    expect(seen.size).toBeGreaterThanOrEqual(4);
    expect(eventTone({ title: "x", color: "#7A9E8E" })).toBe(calendarTones[0]); // sage stays sage
    expect(eventTone({ title: "Birthday", color: "#c878a8" })).toBe(accentTone.gold);
    expect(eventTone({ title: "same" })).toBe(eventTone({ title: "same" })); // stable
  });

  it("Lighthouse: subjects get distinct school colors; seven-color palette, no purple/pink", function () {
    expect(Object.keys(schoolTones).sort()).toEqual(["blue", "denim", "mustard", "sage", "sandGold", "teal", "terracotta"]);
    var subs = ["Math", "Reading", "Science", "History", "PE", "Art", "Music"];
    expect(new Set(subs.map(function (s) { return subjectTone(s).full; })).size).toBe(7);
    expect(subjectTone("Algebra")).toBe(subjectTone("Math"));
    expect(subjectTone("Bible")).toBe(subjectTone("bible"));
    Object.keys(LH_AREA_TONE).forEach(function (k) { expect(LH_AREA_TONE[k]).toBeTruthy(); });
    expect(lhAreaTone("plan-week")).toBe(LH_AREA_TONE.plan);
    expect(new Set(Object.keys(LH_AREA_TONE).map(function (k) { return LH_AREA_TONE[k].full; })).size).toBe(5);
  });

  it("Lighthouse helpers leave flag-off styles untouched", function () {
    var base = { color: "#6ABAAA", fontSize: "0.65rem" };
    expect(lhChipStyle(false, "Math", base)).toBe(base);
    expect(lhRowStyle(false, "Math", base)).toBe(base);
    expect(lhTextStyle(false, "Math", base)).toBe(base);
    expect(lhChipStyle(true, "", base)).toBe(base);
    expect(lhChipStyle(true, "Math", base).background).toBe(subjectTone("Math").full);
    expect(lhRowStyle(true, "Math", base).background).toBe(subjectTone("Math").tint);
    var k = kidTone("#7A9E8E");
    expect(1.05 / (lum2(k.full) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
