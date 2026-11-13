// src/tidepool/ledger.js — Tide Pool shell ledger (af_tidepool_v2).
//
// Flag OFF (default): every shell change is written to coveData[].shells,
// exactly as before. The "v1" branches of the planners below are the
// pre-flag App.jsx / FlowHome.jsx logic moved here verbatim.
//
// Flag ON: chores, treasures, kid names and the history arrays (shellLog,
// bonusHistory, rewardHistory) stay in coveData; ONLY the shell count moves.
// Each action produces a ledger event sent via the tide_pool_add_event RPC
// (sql: tide_pool_migration.sql), and the displayed count is
//   last tide_pool_balances snapshot + events not yet confirmed by the server.
// coveData[].shells is never written in v2 (it stays frozen at its pre-flag
// value, which is what the one-time SQL backfill copies).
//
// No React and no Supabase import here, so tests exercise this file directly.

var FLAG_KEY = "af_tidepool_v2";
export var PENDING_KEY = "af_tidepool_pending";

export function readTidePoolV2Flag(storage) {
  try { return !!storage && storage.getItem(FLAG_KEY) === "true"; } catch { return false; }
}

// Read once at module load, like af_shopping_v2 — flipping it needs a reload.
export var TIDEPOOL_V2 = readTidePoolV2Flag(typeof localStorage !== "undefined" ? localStorage : null);

export function newEventId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return "tpe_" + crypto.randomUUID();
  } catch { /* ignore */ }
  return "tpe_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export function getStoredHouseholdId(storage) {
  try {
    var s = (storage || localStorage).getItem("af_householdId");
    var v = s ? JSON.parse(s) : null;
    return v ? String(v) : null;
  } catch { return null; }
}

function ptsInt(p) {
  var n = parseInt(p, 10);
  return isFinite(n) && n > 0 ? n : 1;
}

function makeEvent(opts, kidId, kind, delta, reason, refId) {
  return { id: opts.makeEventId(), kid_id: kidId, kind: kind, delta: delta, reason: reason || null, ref_id: refId || null };
}

// opts for every planner:
//   v2          boolean
//   balance     number|null  — v2 ledger balance for this kid (null = not loaded yet)
//   makeId      () => string — id for shellLog/history entries (App's uid)
//   makeEventId () => string — id for the ledger event
//   now         () => ISO string

// TidePoolTab.toggleChore (main Tide Pool tab)
export function planTabChoreToggle(kid, choreId, opts) {
  var ch = kid.chores.find(function (c) { return c.id === choreId; });
  if (!ch) return null;
  var log;
  if (ch.done) {
    log = (kid.shellLog || []).slice();
    var rmIdx = log.findIndex(function (e) { return e.choreId === choreId; });
    if (rmIdx !== -1) log.splice(rmIdx, 1);
  } else {
    var newEntry = { id: opts.makeId(), reason: ch.name, pts: ch.pts, date: opts.now(), choreId: choreId };
    log = [newEntry].concat((kid.shellLog || [])).slice(0, 200);
  }
  var chores = kid.chores.map(function (c) { return c.id === choreId ? Object.assign({}, c, { done: !c.done }) : c; });
  if (!opts.v2) {
    var newShells = ch.done ? Math.max(0, kid.shells - ch.pts) : kid.shells + ch.pts;
    return { patch: { shells: newShells, chores: chores, shellLog: log }, event: null };
  }
  return { patch: { chores: chores, shellLog: log }, event: choreEvent(kid.kidId, ch, opts) };
}

// TidePoolSection.toggleChore (Settings > Tide Pool). v1 never touched shellLog.
export function planSectionChoreToggle(kidData, chId, opts) {
  var ch = (kidData.chores || []).find(function (c) { return c.id === chId; });
  if (!ch) return null;
  var wasChecked = !!ch.done;
  var newChores = (kidData.chores || []).map(function (c) { return c.id === chId ? Object.assign({}, c, { done: !wasChecked }) : c; });
  if (!opts.v2) {
    var shellDelta = wasChecked ? -(ch.pts || 1) : (ch.pts || 1);
    return { patch: { chores: newChores, shells: Math.max(0, (kidData.shells || 0) + shellDelta) }, event: null };
  }
  return { patch: { chores: newChores }, event: choreEvent(kidData.kidId, ch, opts) };
}

// Check = +pts. Uncheck = -pts, clamped so the balance never goes below 0
// (same floor as v1's Math.max(0, ...)); a clamp to 0 sends no event.
function choreEvent(kidId, ch, opts) {
  var pts = ptsInt(ch.pts);
  if (!ch.done) return makeEvent(opts, kidId, "chore", pts, ch.name, ch.id);
  var bal = opts.balance == null ? pts : Math.max(0, opts.balance);
  var delta = -Math.min(pts, bal);
  return delta === 0 ? null : makeEvent(opts, kidId, "chore_undo", delta, ch.name, ch.id);
}

// TidePoolTab.giveShell (Bonus Tide). Caller keeps the empty-reason guard.
export function planBonus(kid, reason, pts, opts) {
  var entry = { id: opts.makeId(), reason: reason, pts: pts, date: opts.now() };
  var hist = [entry].concat((kid.bonusHistory || [])).slice(0, 50);
  var log = [entry].concat((kid.shellLog || [])).slice(0, 200);
  if (!opts.v2) return { patch: { shells: kid.shells + pts, bonusHistory: hist, shellLog: log }, event: null };
  return { patch: { bonusHistory: hist, shellLog: log }, event: makeEvent(opts, kid.kidId, "bonus", ptsInt(pts), reason, entry.id) };
}

// TidePoolTab.claimTreasure. Returns null when the kid can't afford it
// (v2: or when the ledger balance hasn't loaded yet).
export function planClaim(kid, t, opts) {
  if (!t) return null;
  var have = opts.v2 ? opts.balance : kid.shells;
  if (have == null || have < t.cost) return null;
  var entry = { id: opts.makeId(), name: t.name, icon: t.icon || "🎁", cost: t.cost, date: opts.now() };
  var hist = [entry].concat((kid.rewardHistory || [])).slice(0, 50);
  if (!opts.v2) return { patch: { shells: kid.shells - t.cost, rewardHistory: hist }, event: null };
  return { patch: { rewardHistory: hist }, event: makeEvent(opts, kid.kidId, "redeem", -ptsInt(t.cost), t.name, t.id) };
}

// FlowHome addShell (+1 button). Returns the full next coveData list, or the
// same list reference when v2 needs no coveData write.
export function planQuickShell(list, kidId, kidName, opts) {
  var existing = list.find(function (k) { return k.kidId === kidId; });
  var event = opts.v2 ? makeEvent(opts, kidId, "bonus", 1, "Quick +1 from Flow", null) : null;
  if (existing) {
    if (opts.v2) return { next: list, event: event };
    return { next: list.map(function (k) { return k.kidId === kidId ? Object.assign({}, k, { shells: (k.shells || 0) + 1 }) : k; }), event: null };
  }
  var id = opts.makeId;
  return {
    next: list.concat([{
      kidId: kidId, kidName: kidName, shells: opts.v2 ? 0 : 1,
      chores: [
        { id: id(), name: "Make bed", pts: 1, done: false },
        { id: id(), name: "Clear dishes", pts: 1, done: false },
      ],
      treasures: [
        { id: id(), name: "Extra screen time", icon: "📱", cost: 10 },
        { id: id(), name: "Pick dinner", icon: "🍕", cost: 15 },
        { id: id(), name: "Movie night pick", icon: "🎬", cost: 20 },
        { id: id(), name: "Stay up late", icon: "🌙", cost: 25 },
        { id: id(), name: "Special outing", icon: "🎡", cost: 35 },
      ],
    }]),
    event: event,
  };
}

// ── Balance store ───────────────────────────────────────────────────────────
// One shared store per page (TidePoolTab, Settings' TidePoolSection and
// FlowHome all read it), one realtime channel, ref-counted.
//
// Correctness rule: server truth comes ONLY from tide_pool_balances
// snapshots. Realtime events and RPC confirmations never add deltas by hand;
// they trigger a re-fetch. Unconfirmed events are added on top of the
// snapshot (optimistic) and persisted to localStorage so they retry after a
// reload or when the device comes back online. The RPC is idempotent on id,
// so a retry of an event that already committed is a no-op server-side.
// A confirmed event keeps being counted until a snapshot that STARTED after
// its confirmation lands (that snapshot is guaranteed to include it), so the
// number never dips or double-counts across the confirm -> re-fetch gap.
export function createLedgerStore(deps) {
  var client = deps.client;
  var storage = deps.storage || null;
  var refreshDelay = deps.refreshDelay == null ? 250 : deps.refreshDelay;
  var setT = deps.setTimeout || setTimeout;
  var clearT = deps.clearTimeout || clearTimeout;

  var hid = null, refs = 0, channel = null;
  var snapshot = {}, loaded = false;
  var pending = loadPending();       // [{event fields + household_id, confirmedSeq?}]
  var inFlight = {};
  var seq = 0, fetching = false, refetchQueued = false, refreshTimer = null;
  var listeners = [];
  var cached = null;

  function loadPending() {
    try { var p = JSON.parse((storage && storage.getItem(PENDING_KEY)) || "[]"); return Array.isArray(p) ? p : []; }
    catch { return []; }
  }
  function savePending() {
    try {
      if (!storage) return;
      var unconfirmed = pending.filter(function (p) { return p.confirmedSeq == null; })
        .map(function (p) { return { id: p.id, household_id: p.household_id, kid_id: p.kid_id, kind: p.kind, delta: p.delta, reason: p.reason, ref_id: p.ref_id }; });
      if (unconfirmed.length) storage.setItem(PENDING_KEY, JSON.stringify(unconfirmed));
      else storage.removeItem(PENDING_KEY);
    } catch { /* ignore */ }
  }
  function emit() {
    cached = null;
    listeners.slice().forEach(function (fn) { try { fn(); } catch { /* ignore */ } });
  }

  function getState() {
    if (cached) return cached;
    var balances = {};
    Object.keys(snapshot).forEach(function (k) { balances[k] = snapshot[k]; });
    pending.forEach(function (p) {
      if (p.household_id !== hid) return;
      balances[p.kid_id] = (balances[p.kid_id] || 0) + p.delta;
    });
    Object.keys(balances).forEach(function (k) { if (balances[k] < 0) balances[k] = 0; });
    cached = { householdId: hid, loaded: loaded, balances: balances, pendingCount: pending.filter(function (p) { return p.household_id === hid && p.confirmedSeq == null; }).length };
    return cached;
  }

  function refresh() {
    if (!hid) return Promise.resolve();
    if (fetching) { refetchQueued = true; return Promise.resolve(); }
    fetching = true;
    var forHid = hid;
    var startSeq = ++seq;
    return Promise.resolve(client.from("tide_pool_balances").select("kid_id,shells").eq("household_id", forHid))
      .then(function (res) {
        if (forHid !== hid) return;
        if (res && res.error) return;
        var next = {};
        ((res && res.data) || []).forEach(function (r) { if (r && r.kid_id) next[r.kid_id] = Number(r.shells) || 0; });
        snapshot = next;
        loaded = true;
        pending = pending.filter(function (p) { return !(p.household_id === forHid && p.confirmedSeq != null && p.confirmedSeq < startSeq); });
        emit();
      })
      .catch(function () {})
      .then(function () {
        fetching = false;
        if (refetchQueued) { refetchQueued = false; refresh(); }
      });
  }

  function scheduleRefresh() {
    if (refreshTimer) clearT(refreshTimer);
    refreshTimer = setT(function () { refreshTimer = null; refresh(); }, refreshDelay);
  }

  function send(p) {
    if (inFlight[p.id] || p.confirmedSeq != null) return Promise.resolve();
    inFlight[p.id] = true;
    return Promise.resolve(client.rpc("tide_pool_add_event", {
      p_id: p.id, p_household_id: p.household_id, p_kid_id: p.kid_id, p_kind: p.kind,
      p_delta: p.delta, p_reason: p.reason || null, p_ref_id: p.ref_id || null,
    })).then(function (res) {
      delete inFlight[p.id];
      if (res && res.error) { p.lastError = String(res.error.message || res.error); return; }
      p.confirmedSeq = ++seq;
      savePending();
      if (p.household_id === hid) scheduleRefresh();
      emit();
    }, function (err) {
      delete inFlight[p.id];
      p.lastError = String((err && err.message) || err);
    });
  }

  function flush() {
    return Promise.all(pending.filter(function (p) { return p.confirmedSeq == null; }).map(send));
  }

  function record(householdId, event) {
    if (!householdId || !event || !event.delta) return Promise.resolve();
    var p = Object.assign({}, event, { household_id: householdId });
    pending.push(p);
    savePending();
    emit();
    return send(p);
  }

  function start(householdId) {
    if (!householdId) return function () {};
    if (hid !== householdId) {
      stopChannel();
      hid = householdId; snapshot = {}; loaded = false; refs = 0;
      channel = client.channel("tidepool-" + householdId)
        .on("postgres_changes", { event: "*", schema: "public", table: "tide_pool_events", filter: "household_id=eq." + householdId }, function () { scheduleRefresh(); })
        .subscribe(function (status) { if (status === "SUBSCRIBED") { refresh(); flush(); } });
      refresh();
      flush();
      emit();
    }
    refs++;
    var stopped = false;
    return function () {
      if (stopped) return; stopped = true;
      refs--;
      if (refs <= 0 && hid === householdId) { stopChannel(); hid = null; snapshot = {}; loaded = false; refs = 0; emit(); }
    };
  }
  function stopChannel() {
    if (channel) { try { client.removeChannel(channel); } catch { /* ignore */ } channel = null; }
    if (refreshTimer) { clearT(refreshTimer); refreshTimer = null; }
  }

  return {
    getState: getState,
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (l) { return l !== fn; }); }; },
    start: start,
    record: record,
    refresh: refresh,
    flush: flush,
  };
}
