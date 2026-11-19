// App-wide cleanup (af_redesign): the Vault rules applied to every tabbed
// screen. Each change is behind the flag (REDESIGN / K.rd / rd / vc), so the
// flag-off markup is untouched (the flag-off golden tests cover that).
import { describe, it, expect } from "vitest";
import fs from "node:fs";

var read = function (p) { return fs.readFileSync(p, "utf8"); };
var app = read("src/App.jsx");
var vault = read("src/components/AnchorVault.jsx");

describe("no heading that repeats the selected pill", function () {
  it("Home / People / Horizon cards carry no title of their own", function () {
    var hubs = read("src/redesign/AnchorHubsFull.jsx");
    ["Household Info", "Maintenance", "Inventory", "Reminders", "Subscriptions", "Health", "Career", "Pets", "Celebrations", "Safe Harbor"].forEach(function (t) {
      expect(hubs).not.toContain('<AnchorCard title="' + t + '"');
    });
    expect(hubs).toContain('<AnchorCard title="Sensitive"'); // a second card on the pill keeps its name
  });
  it("Ripples: no section heading; each description sits in its empty state", function () {
    var rip = read("src/shell/RipplesRoom.jsx");
    expect(rip).not.toContain("rdSectionHead");
    ["Things they said.", "The things that make your family yours.", "Memories and milestones, newest first.", "Your family's story, month by month."].forEach(function (d) { expect(rip).toContain(d); });
  });
  it("Meals and Shopping headings are behind the flag", function () {
    expect(app).toContain("{!K.rd&&<div style={{fontFamily:\"'Cormorant Garamond',serif\",fontSize:K.rd?\"1.35rem\":\"1.2rem\",fontWeight:700,color:K.rd?MEALS_TONE.ink:T.textDark,marginBottom:\"0.35rem\"}}>🗓️ Plan Next Week</div>}");
    expect(app).toContain("{!K.rd&&<h2 style={{fontFamily:\"'Cormorant Garamond',serif\",fontSize:\"1.4rem\",fontWeight:700,color:T.textDark,margin:\"0 0 0.35rem\"}}>This Week's Prep</h2>}");
    expect(app).toContain("{!REDESIGN&&<span style={{fontFamily:\"'Cormorant Garamond',serif\",fontWeight:700,fontSize:\"1.05rem\",color:T.textDark}}>My Recipes</span>}");
    expect(read("src/redesign/ShoppingFull.jsx")).not.toContain("title={emoPrefix(se, store.emoji) + store.label}");
  });
});

describe("no stray dots, faint characters or empty icon circles", function () {
  it("Lighthouse disclosure chevrons are drawn under the flag", function () {
    expect(app).toContain("if (REDESIGN) return <DrawnChevron open={open} color={LH_INK} />;");
  });
  it("Safe Harbor: remove ✕ and checkboxes readable on light cards; initials instead of empty avatars", function () {
    var sh = read("src/shell/SafeHarbor.jsx");
    expect(sh).toContain('color:rd?"rgba(26,46,61,0.45)":"rgba(250,248,244,0.18)"');
    expect(sh).toContain('(rd?"rgba(26,46,61,0.35)":"rgba(250,248,244,0.25)")');
    expect(sh).toContain("(rd && !rdEmojis) ? <span");
  });
  it("Settings: no emoji on notification rows or theme tiles with emojis off", function () {
    expect(app).toContain('{(!REDESIGN||showEmojis===true)&&<span style={{fontSize:"1rem",flexShrink:0,opacity:on?1:0.4}}>{n.emoji}</span>}');
    expect(app).toContain('{(!REDESIGN||showEmojis===true)&&<div style={{fontSize:"1.4rem",marginBottom:"0.25rem"}}>{th.emoji}</div>}');
  });
});

describe("dates and equal heights", function () {
  it("Horizon trips show a date range or Add dates; review dates are written out", function () {
    var hubs = read("src/redesign/AnchorHubsFull.jsx");
    expect(hubs).toContain('sub={formatTripRange(x.trip.startDate, x.trip.endDate) || "Add dates"}');
    expect(hubs).toContain("formatTripRange(p.lastReviewed, p.lastReviewed)");
  });
  it("Safe Harbor summary tiles share one row height", function () {
    expect(read("src/shell/SafeHarbor.jsx")).toContain('gridAutoRows: rd ? "1fr" : undefined');
  });
});

describe("trip page at phone width", function () {
  it("planning cards stack (own class, no 2-column !important rule) with equal rows", function () {
    expect(vault).toContain('className={vc ? "af-trip-detail-grid-rd" : "af-trip-detail-grid"}');
    expect(vault).toContain('gridTemplateColumns:"repeat(auto-fill, minmax(min(100%, 220px), 1fr))", gridAutoRows:"1fr"');
    expect(vault).not.toContain(".af-trip-detail-grid-rd {");
  });
  it("no empty icon circles with emojis off; no mid-word breaks", function () {
    expect(vault.match(/\(!vc \|\| vc\.showEmojis\) && <div style=\{\{ width:30, height:30, borderRadius:"50%", background:accent/g).length).toBe(2);
    expect(vault).toContain('overflowWrap: vc ? "normal" : undefined, wordBreak: vc ? "normal" : undefined');
  });
});
