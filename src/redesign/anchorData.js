// src/redesign/anchorData.js — pure summaries for the redesigned Anchor
// screen (af_redesign). Read-only, existing keys only. Each mirrors the
// screen that owns the data:
//   vaultSections     — AnchorVault sections (ANCHOR_SECTIONS minus Safe Harbor)
//   sensitiveRecords  — TravelProfileSection MaskedFields + Health's PIN-locked note
//   safeHarborModel   — SafeHarbor.jsx tiers (10/30/60), 6 P categories, Our Plan
//   todayZone         — HomeTab cleaning rotation (date % zones unless zonePinned)
//   nextMaintenance   — AnchorVault sysNextDate / HomeTab maintenanceDueSoon
//   peopleCards       — PeopleTab health status + petNextVet
//   coveSummary       — CoveTab notes (updatedAt) and lists (checked / total)
//   horizonEvents     — HorizonTab trips (days > 0) + celebrations (next yearly)
import { safeHarborReadiness } from "./homeData.js";

function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function str(v) { return typeof v === "string" ? v.trim() : ""; }
function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function ymdDays(dateStr, now) {
  if (!dateStr) return null;
  var p = String(dateStr).split("-");
  if (p.length !== 3) return null;
  var t = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  if (isNaN(t.getTime())) return null;
  return Math.round((t - startOfDay(now)) / 86400000);
}

// Tab grid, display order. `section` = the af_sections key (Settings ›
// sections); Vault and Safe Harbor are governed by the vault's own toggles.
export var ANCHOR_TABS = [
  { id: "vault", label: "Vault", icon: "🗝️" },
  { id: "safeharbor", label: "Safe Harbor", icon: "⚓" },
  { id: "home", label: "Home", icon: "🏡", section: "home" },
  { id: "people", label: "People", icon: "👥", section: "people" },
  { id: "cove", label: "Cove", icon: "🪸", section: "cove" },
  { id: "horizon", label: "Horizon", icon: "🌄", section: "horizon" },
];

// AnchorVault ANCHOR_SECTIONS minus Safe Harbor (its own tab). `feature` =
// the Settings feature toggle that also turns the section off.
export var VAULT_SECTIONS = [
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "systems", label: "Maintenance", icon: "🔧" },
  { id: "health", label: "Health", icon: "🩺" },
  { id: "career", label: "Career", icon: "📋", feature: "careerEnabled" },
  { id: "subs", label: "Subscriptions", icon: "🔄" },
  { id: "gifts", label: "Celebrate", icon: "🎉", feature: "celebrationsEnabled" },
  { id: "pets", label: "Pets", icon: "🐾" },
  { id: "trips", label: "Travel", icon: "🧳" },
];

function vaultSectionOn(s, anchorHidden, flags) {
  if (obj(anchorHidden)[s.id]) return false;
  if (s.feature && obj(flags)[s.feature] === false) return false;
  return true;
}

// opts: { sections, featureFlags, anchorHidden }
export function visibleAnchorTabs(opts) {
  var o = opts || {};
  var sections = obj(o.sections), flags = obj(o.featureFlags), hidden = obj(o.anchorHidden);
  return ANCHOR_TABS.filter(function (t) {
    if (t.id === "vault") return VAULT_SECTIONS.some(function (s) { return vaultSectionOn(s, hidden, flags); });
    if (t.id === "safeharbor") return flags.safeHarborEnabled !== false && !hidden.safeharbor;
    return sections[t.section] !== false;
  });
}

// Sum of every array field across per-person records ({pid: {...arrays}}).
function perPersonRecordCount(byPerson, extra) {
  var n = 0;
  Object.keys(obj(byPerson)).forEach(function (pid) {
    var pd = obj(byPerson[pid]);
    Object.keys(pd).forEach(function (k) { if (Array.isArray(pd[k])) n += pd[k].length; });
    if (extra) n += extra(pd);
  });
  return n;
}

function celebrationCount(celebrations, birthdays) {
  var list = arr(celebrations).filter(Boolean);
  var extra = arr(birthdays).filter(function (b) {
    return b && !list.some(function (c) { return c.name === b.name && c.type === "birthday"; });
  });
  return list.length + extra.length;
}

// store: { inventory, vaultSystems, ownedProducts, houseFile, health, career,
//          subs, celebrations, birthdays, pets, trips }
export function vaultSections(store, anchorHidden, flags) {
  var s = store || {};
  var counts = {
    inventory: Object.keys(obj(s.inventory)).reduce(function (n, k) { return n + arr(s.inventory[k]).length; }, 0),
    systems: arr(s.vaultSystems).length + arr(s.ownedProducts).length + arr(s.houseFile).length,
    health: perPersonRecordCount(s.health, function (pd) { return str(pd.generalNote) ? 1 : 0; }),
    career: perPersonRecordCount(s.career),
    subs: arr(s.subs).length,
    gifts: celebrationCount(s.celebrations, s.birthdays),
    pets: arr(s.pets).length,
    trips: arr(s.trips).length,
  };
  return VAULT_SECTIONS.filter(function (v) { return vaultSectionOn(v, anchorHidden, flags); })
    .map(function (v) { return { id: v.id, label: v.label, icon: v.icon, count: counts[v.id] || 0 }; });
}

// Sensitive records. `value` is the secret, revealed only on tap (same rule
// as the vault's MaskedField). `pin: true` records are PIN-locked in Health
// and are never revealed here — tapping opens Health, which asks for the PIN.
export function sensitiveRecords(travelProfile, health, people, anchorHidden, flags) {
  var out = [];
  var on = function (id) { return vaultSectionOn(VAULT_SECTIONS.filter(function (v) { return v.id === id; })[0], anchorHidden, flags); };
  if (on("trips")) {
    var tp = obj(travelProfile);
    function add(id, hint, value) { if (str(value)) out.push({ id: id, hint: hint, value: str(value), pin: false, section: "travel" }); }
    add("passport", "Passport number" + (str(tp.passportName) ? " · " + str(tp.passportName) : ""), tp.passportNum);
    add("passport2", "Second passport number" + (str(tp.passport2Country) ? " · " + str(tp.passport2Country) : ""), tp.passport2Num);
    [["tsaNum", "TSA PreCheck number"], ["geNum", "Global Entry number"], ["nexusNum", "NEXUS number"], ["sentriNum", "SENTRI number"]].forEach(function (k) { add(k[0], k[1], tp[k[0]]); });
    arr(tp.ffPrograms).forEach(function (p, i) { if (p) add("ff-" + (p.id || i), (str(p.airline) || "Airline") + " member number", p.number); });
    arr(tp.hotelPrograms).forEach(function (p, i) { if (p) add("hotel-" + (p.id || i), (str(p.chain) || "Hotel") + " member number", p.number); });
    arr(tp.luggage).forEach(function (b, i) { if (b) add("lock-" + (b.id || i), (str(b.description) || "Luggage") + " lock code", b.lockCode); });
  }
  if (on("health")) {
    var h = obj(health);
    Object.keys(h).forEach(function (pid) {
      if (!str(obj(h[pid]).generalNote)) return;
      var p = arr(people).filter(function (x) { return x && x.id === pid; })[0];
      out.push({ id: "hnote-" + pid, hint: "Private health note" + (p && p.name ? " · " + p.name : ""), value: null, pin: true, section: "health" });
    });
  }
  return out;
}

export var SIX_PS = [
  { id: "people", label: "People & Pets" },
  { id: "prescriptions", label: "Prescriptions" },
  { id: "papers", label: "Papers" },
  { id: "phones", label: "Phones & Tech" },
  { id: "personal", label: "Personal Needs" },
  { id: "priceless", label: "Priceless Items" },
];
export var PLAN_FIELDS = [
  { key: "meetNearby", label: "Meet nearby" },
  { key: "meetAway", label: "Meet away from home" },
  { key: "evacuatePrimary", label: "Primary route" },
  { key: "evacuateBackup", label: "Backup route" },
  { key: "outOfStateContact", label: "Out-of-state contact" },
];
var TIERS = [{ tier: 1, minutes: 10, label: "Leave now" }, { tier: 2, minutes: 30, label: "Prepare to leave" }, { tier: 3, minutes: 60, label: "Time to prepare" }];

// null when Safe Harbor has never been set up (no grab items saved).
export function safeHarborModel(sh) {
  if (!sh || typeof sh !== "object" || !arr(sh.grabItems).length) return null;
  var items = arr(sh.grabItems).filter(function (i) { return i && !i.removed; });
  var tiers = TIERS.map(function (t) {
    var inTier = items.filter(function (i) { return (i.tier == null ? 1 : i.tier) <= t.tier; });
    var done = inTier.filter(function (i) { return !!i.checked; }).length;
    return { minutes: t.minutes, label: t.label, done: done, total: inTier.length, pct: inTier.length ? Math.round(done / inTier.length * 100) : 0 };
  });
  var sixPs = SIX_PS.map(function (c) {
    var inCat = items.filter(function (i) { return i.category === c.id; });
    var done = inCat.filter(function (i) { return !!i.checked; }).length;
    return { id: c.id, label: c.label, done: done, total: inCat.length, complete: inCat.length > 0 && done === inCat.length };
  });
  var contacts = obj(sh.contacts);
  return {
    readiness: safeHarborReadiness(sh),
    tiers: tiers,
    sixPs: sixPs,
    plan: PLAN_FIELDS.map(function (f) { return { key: f.key, label: f.label, value: str(contacts[f.key]) }; }),
    members: arr(sh.members).filter(function (m) { return m && str(m.name); }).map(function (m) { return { id: m.id, name: str(m.name), role: str(m.role) || "Adult" }; }),
    lastReviewed: sh.lastReviewed || null,
  };
}

export function todayZone(cleaning, now) {
  var c = obj(cleaning);
  var zones = arr(c.zones).filter(Boolean);
  if (!zones.length) return null;
  var idx = c.zonePinned && typeof c.activeZoneIndex === "number" ? c.activeZoneIndex : now.getDate() % zones.length;
  var z = zones[idx] || zones[0];
  var tasks = arr(z.tasks).filter(Boolean);
  return { name: str(z.name) || "Zone", rooms: str(z.rooms), done: tasks.filter(function (t) { return t.done; }).length, total: tasks.length };
}

function sysNextDate(lastDone, freq) {
  if (!lastDone || !freq || freq === "once") return null;
  var d = new Date(lastDone + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  var m = { "1m": 1, "3m": 3, "6m": 6, "1y": 12, "2y": 24, "5y": 60 }[freq];
  if (!m) return null;
  d.setMonth(d.getMonth() + m);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Soonest due (overdue first). { name, due, days }
export function nextMaintenance(systems, now) {
  var best = null;
  arr(systems).forEach(function (s) {
    if (!s) return;
    var due = s.nextDue || sysNextDate(s.lastDone, s.freq);
    var days = ymdDays(due, now);
    if (days === null) return;
    if (!best || days < best.days) best = { name: str(s.name) || "Maintenance", due: due, days: days };
  });
  return best;
}

function petNextVaccine(p, now) {
  var best = null;
  arr(p.vaccines).forEach(function (v) {
    var d = v ? ymdDays(v.due, now) : null;
    if (d !== null && d >= 0 && (!best || d < best.days)) best = { name: str(v.name) || "Vaccine", days: d };
  });
  return best;
}

// One card per household member, then one per pet.
export function peopleCards(people, pets, health, now, isPersonMinor) {
  var h = obj(health);
  var out = arr(people).filter(function (p) { return p && str(p.name); }).map(function (p) {
    var pd = obj(h[p.id]);
    var appts = arr(pd.appointments).length ? arr(pd.appointments) : arr(pd.history);
    var meds = arr(pd.medications).length ? arr(pd.medications) : arr(pd.meds);
    var tracked = appts.length || meds.length || arr(pd.allergies).length || arr(pd.immunizations).length;
    var minor = p.role === "Kid" || p.role === "Teen" || (typeof isPersonMinor === "function" && !!isPersonMinor(p));
    return {
      id: p.id, kind: "person", name: str(p.name), color: p.color || null,
      role: str(p.role) || (minor ? "Kid" : "Adult"),
      status: !tracked ? "No health records yet" : (meds.length ? meds.length + " active med" + (meds.length !== 1 ? "s" : "") : "Health up to date"),
    };
  });
  arr(pets).filter(function (p) { return p && str(p.name); }).forEach(function (p, i) {
    var nv = petNextVaccine(p, now);
    out.push({ id: "pet-" + (p.id || i), kind: "pet", name: str(p.name), color: null, role: str(p.type) || "Pet", status: nv ? nv.name + " " + (nv.days === 0 ? "due today" : "in " + nv.days + "d") : "Vaccines up to date" });
  });
  return out;
}

// Cove notes and lists carry no pin field, so `pinned` is null today; notes
// are most-recently-updated first.
export function coveSummary(notes, lists, itemsMap, limit) {
  var n = limit || 3;
  var recent = arr(notes).filter(Boolean).slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })
    .slice(0, n).map(function (x) { return { id: x.id, title: str(x.title) || "Untitled", preview: str(x.body).replace(/\s+/g, " ").slice(0, 90) }; });
  var im = obj(itemsMap);
  var ls = arr(lists).filter(Boolean).slice(0, 4).map(function (l) {
    var items = arr(im[l.id]).filter(Boolean);
    var done = items.filter(function (i) { return i.checked; }).length;
    return { id: l.id, title: str(l.title) || "List", done: done, total: items.length, pct: items.length ? Math.round(done / items.length * 100) : 0 };
  });
  return { pinned: null, notes: recent, lists: ls };
}

// Trips starting after today + every celebration's next yearly date.
export function horizonEvents(trips, celebrations, now, limit) {
  var today = startOfDay(now);
  var out = [];
  arr(trips).forEach(function (t) {
    var d = t ? ymdDays(t.startDate, now) : null;
    if (d !== null && d > 0) out.push({ id: "trip-" + (t.id || t.name), kind: "trip", name: str(t.name) || "Trip", days: d });
  });
  arr(celebrations).forEach(function (c) {
    if (!c) return;
    var next = new Date(today.getFullYear(), (c.month || 1) - 1, c.day || 1);
    if (next < today) next.setFullYear(next.getFullYear() + 1);
    out.push({ id: "celeb-" + (c.id || c.name), kind: "celebration", name: str(c.name) || "Celebration", days: Math.round((next - today) / 86400000) });
  });
  out.sort(function (a, b) { return a.days - b.days; });
  return out.slice(0, limit || 6);
}
