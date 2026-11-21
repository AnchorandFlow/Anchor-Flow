// Calendar event rules (src/lib/calEvents.js): weekday repeats, ends, skipped
// dates, people and their Settings colors, and older events loading as before.
import { describe, it, expect } from "vitest";
import { occursOn, forIdsOf, forFields, colorForIds, refreshPersonColors, editOccurrence, deleteOccurrence, allCategories, categoryOf, newCategory, ymd, FAMILY_COLOR, DEFAULT_CATEGORIES, EVENT_PALETTE, REPEAT_OPTIONS } from "../../src/lib/calEvents.js";
import { eventsOn } from "../../src/redesign/flowData.js";

function days(from, n) { var out = []; for (var i = 0; i < n; i++) { var d = new Date(from); d.setDate(d.getDate() + i); out.push(d); } return out; }
function hits(e, from, n) { return days(from, n).filter(function (d) { return occursOn(e, d); }).map(ymd); }

// The rules exactly as CalendarTab / eventsOn had them before this change.
function legacyOccurs(e, target) {
  if (!e.date) return false;
  var d = target.getDate(), mm = target.getMonth(), yy = target.getFullYear();
  var ed = new Date(e.date + "T00:00:00");
  if (ed.getDate() === d && ed.getMonth() === mm && ed.getFullYear() === yy) return true;
  if (!e.repeat) return false;
  var t = new Date(yy, mm, d);
  if (t < ed) return false;
  if (e.repeat === "weekly") return ed.getDay() === t.getDay();
  if (e.repeat === "biweekly") return ed.getDay() === t.getDay() && Math.round((t - ed) / 86400000) % 14 === 0;
  if (e.repeat === "monthly") return ed.getDate() === d;
  if (e.repeat === "yearly") return ed.getDate() === d && ed.getMonth() === mm;
  if (e.repeat === "dates" && Array.isArray(e.repeatDates)) return e.repeatDates.includes(d);
  return false;
}

describe("repeat", function () {
  it("weekly on Wednesday shows on every Wednesday, and only Wednesdays", function () {
    var e = { id: "p", title: "Piano", date: "2026-11-04", repeat: "weekly", repeatDays: [3] };
    var got = hits(e, new Date(2026, 10, 1), 70);
    expect(got).toEqual(["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25", "2026-12-02", "2026-12-09", "2026-12-16", "2026-12-23", "2026-12-30", "2027-01-06"]);
    got.forEach(function (iso) { expect(new Date(iso + "T00:00:00").getDay()).toBe(3); });
    // Today/Flow and the Calendar read the same rule
    expect(eventsOn([e], new Date(2026, 11, 16)).map(function (x) { return x.id; })).toEqual(["p"]);
    expect(eventsOn([e], new Date(2026, 11, 17))).toEqual([]);
  });
  it("Tue + Thu weekly; every 2 weeks on chosen days; daily", function () {
    expect(hits({ date: "2026-11-03", repeat: "weekly", repeatDays: [2, 4] }, new Date(2026, 10, 1), 14)).toEqual(["2026-11-03", "2026-11-05", "2026-11-10", "2026-11-12"]);
    expect(hits({ date: "2026-11-03", repeat: "biweekly", repeatDays: [2, 4] }, new Date(2026, 10, 1), 28)).toEqual(["2026-11-03", "2026-11-05", "2026-11-17", "2026-11-19"]);
    expect(hits({ date: "2026-11-27", repeat: "daily" }, new Date(2026, 10, 25), 6)).toEqual(["2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30"]);
  });
  it("ends on a date or after N times", function () {
    expect(hits({ date: "2026-11-04", repeat: "weekly", repeatEnd: { type: "on", date: "2026-11-18" } }, new Date(2026, 10, 1), 40)).toEqual(["2026-11-04", "2026-11-11", "2026-11-18"]);
    expect(hits({ date: "2026-11-03", repeat: "weekly", repeatDays: [2, 4], repeatEnd: { type: "after", count: 3 } }, new Date(2026, 10, 1), 40)).toEqual(["2026-11-03", "2026-11-05", "2026-11-10"]);
    expect(hits({ date: "2026-01-31", repeat: "monthly", repeatEnd: { type: "after", count: 2 } }, new Date(2026, 0, 1), 120)).toEqual(["2026-01-31", "2026-03-31"]);
  });
  it("skipped dates (This event) drop out of the series", function () {
    expect(hits({ date: "2026-11-04", repeat: "weekly", exceptions: ["2026-11-11"] }, new Date(2026, 10, 1), 20)).toEqual(["2026-11-04", "2026-11-18"]);
  });
  it("older events (no repeatDays / repeatEnd / exceptions) land exactly where they used to", function () {
    var olds = [
      { date: "2026-02-10", repeat: "weekly" }, { date: "2026-02-10", repeat: "biweekly" }, { date: "2026-01-31", repeat: "monthly" },
      { date: "2024-02-29", repeat: "yearly" }, { date: "2026-03-05", repeat: "dates", repeatDates: [1, 15, 31] }, { date: "2026-04-01", repeat: "" },
      { date: "2026-04-01" }, { date: "2026-02-10", repeat: "dates" },
    ];
    var all = days(new Date(2024, 0, 1), 1200);
    olds.forEach(function (e) {
      all.forEach(function (d) { if (occursOn(e, d) !== legacyOccurs(e, d)) throw new Error(JSON.stringify(e) + " " + ymd(d)); });
    });
  });
  it("menu: None, Daily, Weekly, Every 2 weeks, Monthly, Yearly, Specific dates", function () {
    expect(REPEAT_OPTIONS.map(function (o) { return o.label; })).toEqual(["None", "Daily", "Weekly", "Every 2 weeks", "Monthly", "Yearly", "Specific dates"]);
  });
});

describe("people", function () {
  var people = [{ id: "a", name: "Lindsey", color: "#4A7FA8" }, { id: "b", name: "Twyla", color: "#3AAA91" }, { id: "k", name: "June" }];
  it("older forPerson values load as a For list; new lists store both fields", function () {
    expect(forIdsOf({ forPerson: "b" }, people)).toEqual(["b"]);
    expect(forIdsOf({ forPerson: "family" }, people)).toEqual(["everyone"]);
    expect(forIdsOf({ forPerson: "Twyla" }, people)).toEqual(["b"]); // legacy bare name
    expect(forIdsOf({ forPerson: null }, people)).toEqual([]);
    expect(forIdsOf({ forPeople: ["a", "k"], forPerson: "a" }, people)).toEqual(["a", "k"]);
    expect(forFields(["a", "k"])).toEqual({ forPeople: ["a", "k"], forPerson: "a" });
    expect(forFields(["everyone"])).toEqual({ forPeople: ["everyone"], forPerson: "family" });
    expect(forFields([])).toEqual({ forPeople: [], forPerson: null });
  });
  it("default color: the For person's Settings color; Everyone = the family color; fallback when unset", function () {
    expect(colorForIds(["b"], people)).toBe("#3AAA91");
    expect(colorForIds(["everyone"], people)).toBe(FAMILY_COLOR);
    expect(colorForIds(["k"], people, function () { return "#7A9E8E"; })).toBe("#7A9E8E");
    expect(colorForIds([], people)).toBe(null);
  });
  it("person colors follow Settings changes (only events whose color follows their person)", function () {
    var events = [
      { id: "1", forPeople: ["b"], forPerson: "b", color: "#3AAA91", colorFrom: "person" },
      { id: "2", forPeople: ["b"], forPerson: "b", color: "#e8a838", colorFrom: "palette" },
      { id: "3", forPerson: "b", color: "#6A9BB5" },
    ];
    expect(refreshPersonColors(events, people)).toBe(events); // nothing changed → same array, no write
    var recolored = people.map(function (p) { return p.id === "b" ? Object.assign({}, p, { color: "#C8A253" }) : p; });
    var next = refreshPersonColors(events, recolored);
    expect(next[0].color).toBe("#C8A253");
    expect(next[1]).toBe(events[1]);
    expect(next[2]).toBe(events[2]);
  });
});

describe("categories and This event / All events", function () {
  it("the eleven categories, in order, plus the household's own", function () {
    expect(DEFAULT_CATEGORIES.map(function (c) { return c.label; })).toEqual(["Appointment", "Activity/Sports", "School", "Church", "Work", "Birthday", "Holiday", "Family", "Travel", "Home/Chores", "Other"]);
    var c = newCategory("  Band   practice ", function () { return "x1"; });
    expect(c).toEqual({ id: "c_x1", label: "Band practice", emoji: "" });
    expect(allCategories([c]).slice(-1)[0]).toBe(c);
    expect(newCategory("   ")).toBe(null);
    expect(categoryOf({ schoolType: "school_day" })).toBe("school"); // older School events
  });
  it("palette is blue, sage, sand, teal, gold — no rose or purple", function () {
    expect(EVENT_PALETTE.map(function (o) { return o.label; })).toEqual(["Blue", "Sage", "Sand", "Teal", "Gold"]);
    EVENT_PALETTE.forEach(function (o) { expect(["#b87265", "#8878b8", "#c878a8"]).not.toContain(o.color.toLowerCase()); });
  });
  it("This event: the series skips that day and a one-off takes its place; All events: unchanged ids", function () {
    var s = [{ id: "s", title: "Piano", date: "2026-11-04", repeat: "weekly", repeatDays: [3] }];
    var next = editOccurrence(s, "s", "2026-11-18", { title: "Piano (recital)", time: "18:00" }, "one");
    expect(next[0].exceptions).toEqual(["2026-11-18"]);
    expect(next[1]).toMatchObject({ id: "one", title: "Piano (recital)", date: "2026-11-18", time: "18:00", repeat: "", seriesId: "s" });
    expect(eventsOn(next, new Date(2026, 10, 18)).map(function (e) { return e.title; })).toEqual(["Piano (recital)"]);
    expect(eventsOn(next, new Date(2026, 10, 25)).map(function (e) { return e.title; })).toEqual(["Piano"]);
    var del = deleteOccurrence(s, "s", "2026-11-11");
    expect(eventsOn(del, new Date(2026, 10, 11))).toEqual([]);
    expect(eventsOn(del, new Date(2026, 10, 4)).length).toBe(1);
  });
});
