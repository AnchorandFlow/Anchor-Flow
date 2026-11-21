// src/lib/schoolType.js — a child's school type (person.schoolType, synced with
// people) and what it means in Lighthouse.
//
// person.schoolType is the single source of truth. lighthouse.modes[id] is kept
// in step for older readers, but Lighthouse (new look) derives the mode from
// the person: homeschool → "homeschool", public/private → "school", hybrid →
// "hybrid" (both), other → "other" (basics + notes), preschool → "preschool".
// "none" (Not school-age) keeps a child out of Lighthouse.
//
// Switching type never deletes anything: sections a type doesn't normally
// show, but that hold data, are listed under "More" (lhSections).

export var SCHOOL_TYPES = [
  { value: "homeschool", label: "Homeschool", emoji: "🏠", desc: "Lessons, curriculum, attendance and portfolio" },
  { value: "public", label: "Public school", emoji: "🏫", desc: "School info, teachers, homework and report cards" },
  { value: "private", label: "Private school", emoji: "🎓", desc: "School info, teachers, homework and report cards" },
  { value: "hybrid", label: "Hybrid / co-op", emoji: "🤝", desc: "Both: home lessons plus a school or co-op" },
  { value: "other", label: "Other", emoji: "✏️", desc: "The basics and notes — name it yourself" },
];
// Settings also keeps the two earlier choices that aren't school types as such.
export var SCHOOL_TYPES_SETTINGS = SCHOOL_TYPES.concat([
  { value: "preschool", label: "Preschool", emoji: "🧸", desc: "Early learning, not yet school-age curriculum" },
  { value: "none", label: "Not school-age", emoji: "👶", desc: "Not in school or a learning program yet" },
]);

export function schoolTypeToMode(t) {
  if (t === "homeschool") return "homeschool";
  if (t === "public" || t === "private") return "school";
  if (t === "hybrid") return "hybrid";
  if (t === "other") return "other";
  if (t === "preschool") return "preschool";
  return null;
}

// "Homeschool", "Public school", … ; Other shows the family's own label.
export function schoolTypeLabel(person) {
  var t = person && person.schoolType;
  if (t === "other") {
    var l = String((person && person.schoolLabel) || "").trim();
    return l || "Other";
  }
  var all = SCHOOL_TYPES_SETTINGS.filter(function (o) { return o.value === t; })[0];
  return all ? all.label : "Not set";
}
export function cleanSchoolLabel(s) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, 30); }

// What each mode shows, per area. "both" for hybrid is the union.
var RECORDS = {
  homeschool: ["umbrella", "activities", "teachers", "notes"],
  school: ["schoolinfo", "teachers", "events", "comms", "homework", "notes"],
  hybrid: ["schoolinfo", "umbrella", "activities", "teachers", "events", "comms", "homework", "notes"],
  other: ["notes"],
  preschool: ["umbrella", "activities", "teachers", "notes"],
};
var GROWTH = {
  homeschool: ["attendance", "goals", "portfolio", "breakgoals"],
  school: ["attendance", "grades", "goals", "breakgoals"],
  hybrid: ["attendance", "grades", "goals", "portfolio", "breakgoals"],
  other: ["goals", "breakgoals"],
  preschool: ["attendance", "goals", "portfolio", "breakgoals"],
};
var PLAN = {
  homeschool: ["today", "week", "month", "year", "loops"],
  school: ["today", "week"],
  hybrid: ["today", "week", "month", "year", "loops"],
  other: ["today", "week"],
  preschool: ["today", "week", "month", "year", "loops"],
};
var AREAS = { records: RECORDS, growth: GROWTH, plan: PLAN };
var ORDER = {
  records: ["schoolinfo", "umbrella", "activities", "teachers", "events", "comms", "homework", "notes"],
  growth: ["attendance", "grades", "goals", "portfolio", "breakgoals"],
  plan: ["today", "week", "month", "year", "loops"],
};

// { shown: [...], more: [...] } — `more` = sections this mode hides that hold
// data (hasData(id) → true), so nothing ever disappears on a switch.
export function lhSections(area, mode, hasData) {
  var table = AREAS[area] || {};
  var shown = (table[mode] || table.homeschool || []).slice();
  var more = (ORDER[area] || []).filter(function (id) { return shown.indexOf(id) === -1 && typeof hasData === "function" && !!hasData(id); });
  return { shown: shown, more: more };
}

// Mode for a child: from the person's school type; an unset type falls back to
// the older lighthouse.modes entry.
export function childMode(person, modes) {
  var m = schoolTypeToMode(person && person.schoolType);
  if (m) return m;
  return (modes && person && modes[person.id]) || null;
}

// Default for a child with no type yet (new look): the older setting it came
// from (af_schoolData's type / inSchool, via App's migratedSchoolType), else
// Homeschool. A type that's set — including "none" (Not school-age), a choice —
// is never changed.
export function defaultSchoolType(p, migrated) {
  if (p && p.schoolType) return p.schoolType;
  if (migrated && migrated !== "none") return migrated;
  return "homeschool";
}
