// Sunset "Anchored" state (af_redesign): household-date math, the per-member
// per-date record, its sync registration and its merge-on-receive.
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import {
  householdDate, todayKey, currentMemberId, getSunsetEntry, saveSunsetEntry,
  isAnchoredToday, mergeSunsetLog, pruneSunsetLog, readSunsetLog,
} from "../../src/lib/sunsetLog.js";
import { SYNC_KEYS, sanitizeHouseholdData, applyHouseholdKey, MERGE_WHILE_DIRTY } from "../../src/sync-core.js";

function set(k, v) { localStorage.setItem("af_" + k, JSON.stringify(v)); }
beforeEach(function () { localStorage.clear(); });

describe("householdDate", function () {
  // 2026-11-14 04:30 UTC = Nov 13, 9:30 PM in Denver, Nov 14 in London.
  var t = new Date(Date.UTC(2026, 10, 14, 4, 30));
  it("uses the household time zone, not UTC", function () {
    expect(householdDate(t, "America/Denver")).toBe("2026-11-13");
    expect(householdDate(t, "Europe/London")).toBe("2026-11-14");
  });
  it("falls back to the device's local date for a missing or unknown zone", function () {
    var local = new Date(2026, 10, 13, 22, 0);
    expect(householdDate(local, null)).toBe("2026-11-13");
    expect(householdDate(local, "Not/AZone")).toBe("2026-11-13");
  });
  it("todayKey reads familyProfile.timezone", function () {
    set("familyProfile", { timezone: "America/Denver" });
    expect(todayKey(t)).toBe("2026-11-13");
    set("familyProfile", { timezone: "Asia/Tokyo" });
    expect(todayKey(t)).toBe("2026-11-14");
  });
});

describe("the per-member, per-date record", function () {
  it("save → Anchored for that member and date only; resets the next day", function () {
    localStorage.setItem("af_myPersonId", "p_lin");
    var evening = new Date(2026, 10, 13, 21, 0);
    expect(isAnchoredToday(evening)).toBe(false);
    saveSunsetEntry(currentMemberId(), todayKey(evening), { mood: "calm", released: [], exhaled: [] });
    expect(isAnchoredToday(evening)).toBe(true);
    expect(isAnchoredToday(new Date(2026, 10, 13, 23, 59))).toBe(true);
    expect(isAnchoredToday(new Date(2026, 10, 14, 0, 1))).toBe(false); // next day: Begin again
    localStorage.setItem("af_myPersonId", "p_twy");
    expect(isAnchoredToday(evening)).toBe(false); // another member hasn't closed yet
  });
  it("marks the key dirty (so it syncs) and announces the change", function () {
    var seen = [];
    window.addEventListener("af-data-changed", function (e) { seen.push(e.detail.key); });
    saveSunsetEntry("p_lin", "2026-11-13", { mood: "calm" });
    expect(JSON.parse(localStorage.getItem("af_dirtyKeys"))).toContain("sunset_log");
    expect(seen).toContain("sunset_log");
  });
  it("an edit keeps completedAt and the fields it does not touch", function () {
    var first = saveSunsetEntry("p_lin", "2026-11-13", { mood: "calm", released: [{ text: "A", choice: "later" }], exhaled: ["x"] }, Date.UTC(2026, 10, 14, 3, 0));
    var second = saveSunsetEntry("p_lin", "2026-11-13", { mood: "grateful" }, Date.UTC(2026, 10, 14, 3, 30));
    expect(second.completedAt).toBe(first.completedAt);
    expect(second.mood).toBe("grateful");
    expect(second.released).toEqual([{ text: "A", choice: "later" }]);
    expect(second.updatedAt > first.updatedAt).toBe(true);
  });
  it("keeps 60 days", function () {
    var log = { p: { "2026-09-01": { mood: "a" }, "2026-11-01": { mood: "b" }, junk: { mood: "c" } } };
    expect(Object.keys(pruneSunsetLog(log, "2026-11-13").p)).toEqual(["2026-11-01"]);
  });
});

describe("sync", function () {
  it("is a synced key that survives sanitize", function () {
    expect(SYNC_KEYS).toContain("sunset_log");
    var v = { p_lin: { "2026-11-13": { mood: "calm" } } };
    expect(sanitizeHouseholdData({ sunset_log: v }).sunset_log).toEqual(v);
    expect(sanitizeHouseholdData({ sunset_log: ["nope"] }).sunset_log).toBeUndefined();
  });
  it("merge keeps every member and date; same member + date keeps the newer edit", function () {
    var local = { p_lin: { "2026-11-13": { mood: "calm", updatedAt: "2026-11-14T03:30:00Z" } } };
    var remote = {
      p_lin: { "2026-11-13": { mood: "rough", updatedAt: "2026-11-14T03:00:00Z" }, "2026-11-12": { mood: "full", updatedAt: "x" } },
      p_twy: { "2026-11-13": { mood: "grateful", updatedAt: "2026-11-14T04:00:00Z" } },
    };
    var m = mergeSunsetLog(local, remote);
    expect(m.p_lin["2026-11-13"].mood).toBe("calm");
    expect(m.p_lin["2026-11-12"].mood).toBe("full");
    expect(m.p_twy["2026-11-13"].mood).toBe("grateful");
    var newer = mergeSunsetLog(local, { p_lin: { "2026-11-13": { mood: "rough", updatedAt: "2026-11-14T05:00:00Z" } } });
    expect(newer.p_lin["2026-11-13"].mood).toBe("rough");
  });
  it("a pull merges instead of replacing — another member's same-night entry is never lost", function () {
    set("sunset_log", { p_lin: { "2026-11-13": { mood: "calm", updatedAt: "2026-11-14T03:30:00Z" } } });
    applyHouseholdKey("sunset_log", { p_twy: { "2026-11-13": { mood: "grateful", updatedAt: "2026-11-14T04:00:00Z" } } });
    var log = readSunsetLog();
    expect(getSunsetEntry("p_lin", "2026-11-13", log).mood).toBe("calm");
    expect(getSunsetEntry("p_twy", "2026-11-13", log).mood).toBe("grateful");
  });
  it("pull loops let sunset_log merge even while it has unpushed edits", function () {
    expect(MERGE_WHILE_DIRTY).toEqual(["sunset_log"]);
    var app = fs.readFileSync("src/App.jsx", "utf8");
    expect(app).toContain("if (dirtyKeys.indexOf(k) !== -1 && MERGE_WHILE_DIRTY.indexOf(k) === -1) return;");
    expect(app.match(/MERGE_WHILE_DIRTY\.indexOf\(k\) === -1\) return;/g).length).toBe(4);
  });
});
