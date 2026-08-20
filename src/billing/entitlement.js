// src/billing/entitlement.js
// Client-side billing helper. Written ES2019-safe (no ?. / ?? / arrow-block-in-JSX) to match
// the Safari-13 build target.
//
// CONTRACT:
//  - The client NEVER decides entitlement on its own. It asks the server (api/stripe/entitlement)
//    and caches the answer in a DEVICE_LOCAL key purely for instant UX on the next load.
//  - af_entitlement MUST be added to the DEVICE_LOCAL list and MUST NOT be in SYNC_KEYS
//    (entitlement is server-derived per household; it must never ride the localStorage sync blob).
//  - BILLING_V1 defaults OFF. While OFF, everyone is treated as entitled, so merging this
//    subsystem changes nothing for existing users until billing is deliberately turned on.

'use strict';

// Flip to true only when billing goes live for users. Default OFF = no behavior change on merge.
export var BILLING_V1 = false;

var CACHE_KEY = 'af_entitlement'; // add to DEVICE_LOCAL list; do NOT add to SYNC_KEYS
var LAST_CHECK_KEY = 'af_entitlement_checkedAt';

function readCache() {
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeCache(obj) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  } catch (e) {
    /* ignore quota / private-mode errors */
  }
}

// Synchronous best-guess for first paint. If billing is off, always entitled.
// Otherwise fall back to the last server answer we cached. Absence of a cache = NOT entitled
// (fail closed) so a brand-new device can't flash premium UI before the server confirms.
export function isEntitledCached() {
  if (!BILLING_V1) return true;
  var c = readCache();
  if (!c) return false;
  return c.entitled === true;
}

// Authoritative check. Call on app load and from the "Restore / recheck" button.
// getToken() should return the current Supabase access token (same source the app already
// uses for authenticated requests). Returns a promise resolving to the server payload.
export function refreshEntitlement(getToken) {
  if (!BILLING_V1) {
    var openPayload = { entitled: true, plan: null, status: 'billing_off' };
    return Promise.resolve(openPayload);
  }
  var token = getToken ? getToken() : null;
  if (!token) return Promise.resolve(readCache() || { entitled: false });

  return fetch('/api/stripe/entitlement', {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token },
  })
    .then(function (r) {
      if (!r.ok) throw new Error('entitlement http ' + r.status);
      return r.json();
    })
    .then(function (data) {
      writeCache(data);
      return data;
    })
    .catch(function (err) {
      // Network / server error: keep the last known-good cache; do NOT grant new access.
      // eslint-disable-next-line no-console
      console.warn('[billing] entitlement refresh failed, using cache:', err && err.message);
      var cached = readCache();
      return cached || { entitled: false, offline: true };
    });
}

// Start a checkout. plan is 'monthly' | 'annual'. Redirects the browser to Stripe Checkout.
export function startCheckout(getToken, plan) {
  var token = getToken ? getToken() : null;
  if (!token) return Promise.reject(new Error('not signed in'));
  return fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ plan: plan === 'annual' ? 'annual' : 'monthly' }),
  })
    .then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data && data.error ? data.error : 'checkout failed');
        return data;
      });
    })
    .then(function (data) {
      if (data && data.url) {
        window.location.assign(data.url);
      }
      return data;
    });
}

// Open the Stripe customer portal (manage billing / cancel).
export function openBillingPortal(getToken) {
  var token = getToken ? getToken() : null;
  if (!token) return Promise.reject(new Error('not signed in'));
  return fetch('/api/stripe/create-portal-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  })
    .then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data && data.error ? data.error : 'portal failed');
        return data;
      });
    })
    .then(function (data) {
      if (data && data.url) window.location.assign(data.url);
      return data;
    });
}

export default {
  BILLING_V1: BILLING_V1,
  isEntitledCached: isEntitledCached,
  refreshEntitlement: refreshEntitlement,
  startCheckout: startCheckout,
  openBillingPortal: openBillingPortal,
};
