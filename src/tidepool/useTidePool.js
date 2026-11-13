// src/tidepool/useTidePool.js — React binding for the shared Tide Pool ledger
// store (src/tidepool/ledger.js). Only does anything when af_tidepool_v2 is on.
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "../lib/supabase";
import { TIDEPOOL_V2, createLedgerStore } from "./ledger.js";

var store = null;
function getStore() {
  if (!store) {
    store = createLedgerStore({ client: supabase, storage: typeof localStorage !== "undefined" ? localStorage : null });
    if (typeof window !== "undefined") {
      window.addEventListener("online", function () { store.flush(); });
      document.addEventListener("visibilitychange", function () { if (!document.hidden) { store.flush(); store.refresh(); } });
    }
  }
  return store;
}

var OFF_STATE = { householdId: null, loaded: false, balances: {}, pendingCount: 0 };
function noopSubscribe() { return function () {}; }
function offState() { return OFF_STATE; }

// Returns { loaded, balances: {kidId: shells}, pendingCount }. Flag off: an
// inert constant — no channel, no fetch, no store created.
export function useTidePoolBalances(householdId) {
  var s = TIDEPOOL_V2 ? getStore() : null;
  var state = useSyncExternalStore(s ? s.subscribe : noopSubscribe, s ? s.getState : offState, s ? s.getState : offState);
  useEffect(function () {
    if (!s || !householdId) return;
    return s.start(householdId);
  }, [householdId]); // eslint-disable-line
  return state.householdId === householdId ? state : OFF_STATE;
}

export function recordTidePoolEvent(householdId, event) {
  if (!TIDEPOOL_V2 || !event) return;
  getStore().record(householdId, event);
}
