// Vault cleanup (af_redesign): trip date ranges, trip status pills, and the
// flag-gating of the section headings / stray marks in AnchorVault.jsx.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { formatTripRange, tripTiming, VAULT_DESCRIPTIONS } from "../../src/redesign/vaultChrome.js";

var TODAY = new Date(2026, 10, 13, 9, 0, 0); // Nov 13, 2026

describe("formatTripRange", function () {
  it("same month", function () { expect(formatTripRange("2026-06-12", "2026-06-18")).toBe("Jun 12–18, 2026"); });
  it("across months", function () { expect(formatTripRange("2026-06-28", "2026-07-03")).toBe("Jun 28 – Jul 3, 2026"); });
  it("across years", function () { expect(formatTripRange("2026-12-30", "2027-01-02")).toBe("Dec 30, 2026 – Jan 2, 2027"); });
  it("one day, or only one date", function () {
    expect(formatTripRange("2026-06-12", "2026-06-12")).toBe("Jun 12, 2026");
    expect(formatTripRange("2026-06-12", "")).toBe("Jun 12, 2026");
    expect(formatTripRange(undefined, "2026-06-18")).toBe("Jun 18, 2026");
  });
  it("no usable dates", function () {
    expect(formatTripRange("", "")).toBe("");
    expect(formatTripRange(null, undefined)).toBe("");
    expect(formatTripRange("June", "soon")).toBe("");
  });
});

describe("tripTiming", function () {
  it("upcoming with a countdown", function () {
    expect(tripTiming({ startDate: "2026-12-05", endDate: "2026-12-07" }, TODAY)).toEqual({ label: "Upcoming", past: false, away: 22 });
  });
  it("no dates is Upcoming (still planning)", function () {
    expect(tripTiming({ status: "Planning" }, TODAY)).toEqual({ label: "Upcoming", past: false, away: null });
  });
  it("in progress, including a start-only trip today", function () {
    expect(tripTiming({ startDate: "2026-11-10", endDate: "2026-11-16" }, TODAY).label).toBe("In progress");
    expect(tripTiming({ startDate: "2026-11-13" }, TODAY).label).toBe("In progress");
  });
  it("past by dates even if the status was never updated", function () {
    expect(tripTiming({ startDate: "2026-06-12", endDate: "2026-06-18", status: "Booked" }, TODAY)).toEqual({ label: "Past", past: true, away: null });
    expect(tripTiming({ startDate: "2026-11-01" }, TODAY).label).toBe("Past");
  });
  it("Completed and Cancelled statuses win over dates", function () {
    expect(tripTiming({ startDate: "2027-01-01", status: "Completed" }, TODAY).label).toBe("Past");
    expect(tripTiming({ startDate: "2027-01-01", status: "Cancelled" }, TODAY).label).toBe("Cancelled");
  });
});

describe("AnchorVault flag-off is untouched", function () {
  var src = fs.readFileSync(path.join(__dirname, "../../src/components/AnchorVault.jsx"), "utf8");
  var full = fs.readFileSync(path.join(__dirname, "../../src/redesign/VaultFull.jsx"), "utf8");
  it("only VaultFull provides the context, so legacy sections read null", function () {
    expect(full).toContain("<VaultChromeContext.Provider value={chrome}>{props.body}</VaultChromeContext.Provider>");
    expect(src).not.toContain("VaultChromeContext.Provider");
  });
  it("every section heading and description is kept behind !vc", function () {
    [
      '{!vc && <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: "#faf8f4", marginBottom: 4 }}>Inventory</div>}',
      '{!vc && <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:22, fontWeight:600, color:warm, marginBottom:4 }}>Travel</div>}',
      "{!vc && <div style={{ fontSize:12, color:muted, fontFamily:\"DM Sans,sans-serif\", marginBottom:20 }}>Every trip you're planning",
      '{!vc && <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: warm, marginBottom: 4 }}>Pets</div>}',
      '!vc&&React.createElement("div",{style:{fontFamily:"Cormorant Garamond,serif",fontSize:22,fontWeight:600,color:CAREER_MODAL_TEXT}},"Career")',
      '!vc&&React.createElement("div",{style:{fontFamily:"Cormorant Garamond,serif",fontSize:22,fontWeight:600,color:HMODAL_TEXT}},"Health")',
      '!vc&&React.createElement("div",{style:{fontFamily:"Cormorant Garamond,serif",fontSize:22,fontWeight:600,color:"#faf8f4",marginBottom:12}},"Maintenance")',
      '{!vc&&<div style={{fontSize:12,color:FAINT,fontFamily:"DM Sans,sans-serif",marginBottom:16,lineHeight:1.5}}>Set it once, never forget it again.</div>}',
      '!vc && React.createElement("div", null,\n        React.createElement("div", { style: { fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 700, color: WHITE } }, "Subscriptions")',
    ].forEach(function (s) { expect(src).toContain(s); });
  });
  it("trip card status dot and chevron only render without the redesign", function () {
    expect(src).toContain("if (vc) {\n                  // af_redesign: one same-height card per trip");
    expect(src).toContain('{trip.status ? <span title={trip.status} style={{ width:7, height:7, borderRadius:"50%"');
    expect(src).toContain('!vc&&React.createElement("span",{style:{width:8,height:8,borderRadius:"50%",background:statusColor');
  });
  it("each redesign empty state carries its section description", function () {
    ["trips", "pets", "systems", "recurring", "subs"].forEach(function (k) {
      expect(VAULT_DESCRIPTIONS[k]).toBeTruthy();
      expect(src).toContain("VAULT_DESCRIPTIONS." + k);
    });
  });
});
