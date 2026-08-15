// src/billing/useSubscription.js
// React hook wrapping entitlement.js — the client NEVER computes entitlement itself
// (see entitlement.js's own contract comment: "asks the server, caches the answer").
// This hook only adapts that payload into the shape components want and re-checks
// when the household changes. Written ES2019-safe (no ?. / ?? / arrow-block-in-JSX)
// to match the Safari-13 build target, same as entitlement.js.
'use strict';

import { useState, useEffect } from 'react';
import { isEntitledCached, refreshEntitlement } from './entitlement.js';

// householdId: pass the current household id so a household switch (rare, but possible
// on a shared device) re-triggers the server check rather than showing a stale answer.
// getToken: same synchronous "() => token-string-or-null" contract entitlement.js's own
// functions already use — callers pass App.jsx's existing _afReadToken.
export default function useSubscription(householdId, getToken) {
  var initial = useState(function () {
    return { isPremium: isEntitledCached(), isTrialing: false, planType: null, loading: true };
  });
  var state = initial[0];
  var setState = initial[1];

  useEffect(function () {
    var cancelled = false;
    refreshEntitlement(getToken).then(function (data) {
      if (cancelled) return;
      setState({
        isPremium: !!(data && data.entitled),
        isTrialing: !!(data && data.status === 'trialing'),
        planType: (data && data.plan) || null,
        loading: false,
      });
    });
    return function () { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  return state;
}
