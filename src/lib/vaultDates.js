// src/lib/vaultDates.js — dates the Vault derives (next due, renewals,
// statuses) and how it shows them. Everything here is computed from the
// record's own facts each time it's read, so an edit can never leave a stale
// derived date behind.
//
// Dates are local calendar days ("YYYY-MM-DD"), never toISOString() (UTC),
// which shifted a day for anyone east of UTC — and, for "today", for US
// evenings once UTC had rolled over.

var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function localYmd(d) {
  var x = d || new Date();
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}
export function parseYmd(s) {
  var m = ISO.exec(String(s || "").trim());
  if (!m) return null;
  var d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d.getTime()) ? null : d;
}

// "2026-11-19" → "Nov 19, 2026". Anything that isn't a plain date (free text
// like "Oct 2024", already-formatted dates) is shown as entered.
export function fmtVaultDate(s) {
  var d = parseYmd(s);
  if (!d) return s == null ? "" : String(s);
  return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
}

export function daysUntil(s, now) {
  var d = parseYmd(s);
  if (!d) return null;
  var n = now || new Date();
  var t = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((d - t) / 86400000);
}

// Add months, clamping to the month's last day (Jan 31 + 1 month = Feb 28/29,
// not Mar 3).
function addMonths(d, n) {
  var y = d.getFullYear(), m = d.getMonth() + n, day = d.getDate();
  var last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, last));
}

// ── Maintenance (af_vaultSystems) ───────────────────────────────────────────
var SYS_MONTHS = { "1m": 1, "3m": 3, "6m": 6, "1y": 12, "2y": 24, "5y": 60 };

export function sysNextDate(lastDone, freq) {
  var d = parseYmd(lastDone);
  if (!d || !SYS_MONTHS[freq]) return null;
  return localYmd(addMonths(d, SYS_MONTHS[freq]));
}

// Next due: a date the user set by hand (nextDueManual) wins; otherwise it is
// always last completed + frequency. A stored nextDue without the manual flag
// is a leftover copy of an old calculation and is ignored.
export function sysNextDue(s) {
  if (!s) return null;
  if (s.nextDueManual && parseYmd(s.nextDue)) return s.nextDue;
  return sysNextDate(s.lastDone, s.freq);
}

export function sysStatus(s, now) {
  var days = daysUntil(sysNextDue(s), now);
  if (days === null) return "ok";
  if (days < 0) return "overdue";
  if (days <= 30) return "soon";
  return "ok";
}

export function sysStatusLabel(s, now) {
  var due = sysNextDue(s);
  if (!due) return s && s.lastDone ? "Done " + fmtVaultDate(s.lastDone) : "Not logged";
  var days = daysUntil(due, now);
  if (days < 0) return Math.abs(days) + "d overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return "Due in " + days + "d";
}

// Stored records with their nextDue brought in line (stale copies fixed, the
// manual ones kept). Returns the same array when nothing needed fixing.
export function normalizeSystems(list) {
  if (!Array.isArray(list)) return [];
  var changed = false;
  var out = list.map(function (s) {
    if (!s || typeof s !== "object") return s;
    var want = sysNextDue(s) || "";
    if ((s.nextDue || "") === want) return s;
    changed = true;
    return Object.assign({}, s, { nextDue: want });
  });
  return changed ? out : list;
}

// ── Subscriptions (af_subs) ─────────────────────────────────────────────────
// The renewal date the user entered rolls forward by the billing cycle until
// it's today or later — so "Renews" never shows a date that already passed.
var SUB_STEP = { weekly: { d: 7 }, monthly: { m: 1 }, quarterly: { m: 3 }, yearly: { m: 12 } };
export function subNextRenewal(sub, now) {
  var d = parseYmd(sub && sub.renewDate);
  if (!d) return null;
  var step = SUB_STEP[sub.cycle] || SUB_STEP.monthly;
  var n = now || new Date();
  var today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  var start = d, k = 0, cur = d;
  while (cur < today && k < 2000) {
    k++;
    cur = step.d ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + step.d * k) : addMonths(start, step.m * k);
  }
  return localYmd(cur);
}

// ── Health immunizations ────────────────────────────────────────────────────
// Status follows the next due date when there is one ("Declined" is a choice
// and stays); without a date, the status the user picked.
export function vaxStatus(it, now) {
  if (!it) return "Up to date";
  if (it.status === "Declined") return "Declined";
  var days = daysUntil(it.nextDue, now);
  if (days === null) return it.status || "Up to date";
  if (days < 0) return "Overdue";
  if (days <= 30) return "Due soon";
  return "Up to date";
}
