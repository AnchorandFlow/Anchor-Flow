// Vault derived dates (src/lib/vaultDates.js): Maintenance next due is always
// last completed + frequency (or a date set by hand), stale stored copies
// self-correct, subscriptions renew forward, vaccine status follows its date,
// and every date reads "Nov 19, 2026".
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import { fmtVaultDate, localYmd, daysUntil, sysNextDate, sysNextDue, sysStatus, sysStatusLabel, normalizeSystems, subNextRenewal, vaxStatus } from "../../src/lib/vaultDates.js";
import { nextMaintenance } from "../../src/redesign/anchorData.js";
import { sanitizeHouseholdData, applyHouseholdKey, SYNC_KEYS } from "../../src/sync-core.js";

var NOV20 = new Date(2026, 10, 20, 9);
var PEST = { id: "vs3", name: "Pest control", type: "other", freq: "3m", lastDone: "2026-06-01", nextDue: "2026-09-01", notes: "" };

describe("Maintenance: next due always from last completed + frequency", function () {
  it("the reported case: last completed Nov 19, 2026, every 3 months → Feb 19, 2027, Due in 91d", function () {
    var edited = Object.assign({}, PEST, { lastDone: "2026-11-19" }); // nextDue still the stale "2026-09-01"
    expect(sysNextDue(edited)).toBe("2027-02-19");
    expect(fmtVaultDate(sysNextDue(edited))).toBe("Feb 19, 2027");
    expect(sysStatusLabel(edited, NOV20)).toBe("Due in 91d");
    expect(sysStatus(edited, NOV20)).toBe("ok");
    expect(sysStatusLabel(PEST, NOV20)).toBe("80d overdue"); // before the edit, as in the screenshot
  });
  it("Mark done today restarts the cycle from today (local date, never UTC)", function () {
    var today = localYmd(NOV20);
    expect(today).toBe("2026-11-20");
    var done = Object.assign({}, PEST, { lastDone: today, nextDue: sysNextDate(today, PEST.freq) });
    expect(sysStatusLabel(done, NOV20)).toBe("Due in 92d");
    var lateEvening = new Date(2026, 10, 20, 23, 30); // 7:30am next day in UTC for US Pacific users
    expect(localYmd(lateEvening)).toBe("2026-11-20");
  });
  it("changing the frequency recalculates; one-time and missing dates give no due date", function () {
    expect(sysNextDue(Object.assign({}, PEST, { lastDone: "2026-11-19", freq: "1y" }))).toBe("2027-11-19");
    expect(sysNextDue(Object.assign({}, PEST, { freq: "once" }))).toBe(null);
    expect(sysNextDue({ name: "x", freq: "3m", nextDue: "2026-09-01" })).toBe(null); // a stale copy with nothing behind it
    expect(sysStatusLabel({ name: "x", freq: "once", lastDone: "2026-03-02" }, NOV20)).toBe("Done Mar 2, 2026");
  });
  it("month ends clamp (Aug 31 + 6 months = Feb 28)", function () {
    expect(sysNextDate("2026-08-31", "6m")).toBe("2027-02-28");
    expect(sysNextDate("2027-11-30", "3m")).toBe("2028-02-29");
  });
  it("a next due set by hand is kept, and only then", function () {
    var manual = Object.assign({}, PEST, { lastDone: "2026-11-19", nextDue: "2026-12-05", nextDueManual: true });
    expect(sysNextDue(manual)).toBe("2026-12-05");
    expect(sysStatusLabel(manual, NOV20)).toBe("Due in 15d");
  });
  it("stored records self-correct on load; already-right lists are returned as-is (no write, no sync)", function () {
    var list = [Object.assign({}, PEST, { lastDone: "2026-11-19" }), { id: "vs1", name: "HVAC filter", freq: "3m", lastDone: "2026-08-20", nextDue: "2026-11-20" }];
    var fixed = normalizeSystems(list);
    expect(fixed).not.toBe(list);
    expect(fixed[0].nextDue).toBe("2027-02-19");
    expect(fixed[1]).toBe(list[1]);
    expect(normalizeSystems(fixed)).toBe(fixed);
  });
  it("the Anchor summary (next maintenance) uses the same rule", function () {
    var m = nextMaintenance([Object.assign({}, PEST, { lastDone: "2026-11-19" })], NOV20);
    expect(m).toMatchObject({ name: "Pest control", due: "2027-02-19", days: 91 });
  });
});

describe("two household members", function () {
  beforeEach(function () { localStorage.clear(); });
  it("an edit on one phone shows the recalculated due date on the other; a stale copy from an older app version self-corrects", function () {
    // Twyla's phone saves the edit (normalized, as sysSaveSystems writes it)
    var twyla = normalizeSystems([Object.assign({}, PEST, { lastDone: "2026-11-19" })]);
    var payload = sanitizeHouseholdData(JSON.parse(JSON.stringify({ vaultSystems: twyla })));
    expect(SYNC_KEYS).toContain("vaultSystems");
    // Lindsey's phone pulls it
    applyHouseholdKey("vaultSystems", payload.vaultSystems);
    var onLindsey = JSON.parse(localStorage.getItem("af_vaultSystems"));
    expect(sysStatusLabel(onLindsey[0], NOV20)).toBe("Due in 91d");
    expect(fmtVaultDate(sysNextDue(onLindsey[0]))).toBe("Feb 19, 2027");
    // An older app still sending the stale nextDue can't bring "80d overdue" back
    applyHouseholdKey("vaultSystems", [Object.assign({}, PEST, { lastDone: "2026-11-19" })]);
    var stale = JSON.parse(localStorage.getItem("af_vaultSystems"));
    expect(stale[0].nextDue).toBe("2026-09-01");
    expect(sysStatusLabel(stale[0], NOV20)).toBe("Due in 91d");
  });
});

describe("other Vault tabs", function () {
  it("subscriptions: the renewal date rolls forward by the billing cycle", function () {
    expect(subNextRenewal({ renewDate: "2026-03-05", cycle: "monthly" }, NOV20)).toBe("2026-12-05");
    expect(subNextRenewal({ renewDate: "2025-01-31", cycle: "monthly" }, NOV20)).toBe("2026-11-30");
    expect(subNextRenewal({ renewDate: "2026-11-20", cycle: "yearly" }, NOV20)).toBe("2026-11-20");
    expect(subNextRenewal({ renewDate: "2026-11-01", cycle: "weekly" }, NOV20)).toBe("2026-11-22");
    expect(subNextRenewal({ renewDate: "2026-02-10", cycle: "quarterly" }, NOV20)).toBe("2027-02-10");
    expect(subNextRenewal({ renewDate: "" }, NOV20)).toBe(null);
  });
  it("immunizations: status follows the next due date (Declined stays a choice)", function () {
    expect(vaxStatus({ status: "Up to date", nextDue: "2026-10-01" }, NOV20)).toBe("Overdue");
    expect(vaxStatus({ status: "Up to date", nextDue: "2026-12-01" }, NOV20)).toBe("Due soon");
    expect(vaxStatus({ status: "Overdue", nextDue: "2027-06-01" }, NOV20)).toBe("Up to date");
    expect(vaxStatus({ status: "Declined", nextDue: "2026-10-01" }, NOV20)).toBe("Declined");
    expect(vaxStatus({ status: "Due soon" }, NOV20)).toBe("Due soon");
  });
  it("dates read \"Nov 19, 2026\"; free text stays as typed", function () {
    expect(fmtVaultDate("2026-11-19")).toBe("Nov 19, 2026");
    expect(fmtVaultDate("Oct 2024")).toBe("Oct 2024");
    expect(fmtVaultDate("")).toBe("");
    expect(daysUntil("2026-11-19", NOV20)).toBe(-1);
  });
});

describe("wiring", function () {
  var v = fs.readFileSync("src/components/AnchorVault.jsx", "utf8");
  it("Maintenance saves keep the record id, derive next due, and Mark done uses the local date", function () {
    expect(v).toContain("var entry=Object.assign({},prev||{},{id:(prev&&prev.id)||huid(),");
    expect(v).toContain("var manual=!!form.nextDue&&form.nextDue!==auto;");
    expect(v).toContain("var today=localYmd(new Date());");
    expect(v).not.toContain("new Date().toISOString().slice(0,10);\n    var updated=systems.map");
    expect(v).toContain('fmtVaultDate(sysNextDue(sys))');
  });
  it("the Health vaccine count uses the derived status (it compared lowercase before and never counted)", function () {
    expect(v).toContain('var dueVax=immunizations.filter(function(v){var st=vaxStatus(v);return st==="Due soon"||st==="Overdue";}).length;');
  });
  it("Today's top-nav icon is a house, not the Compass glyph", function () {
    var nav = fs.readFileSync("src/shell/TopNav.jsx", "utf8");
    expect(nav).toContain('if (props.id === "today") {\n    // Today: a house');
  });
});
