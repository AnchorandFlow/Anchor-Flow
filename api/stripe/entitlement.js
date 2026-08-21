// api/stripe/entitlement.js
// ESM (import/export), not CommonJS — package.json has "type":"module", so a bare require()
// here threw "ReferenceError: require is not defined in ES module scope" in production.
// (A .cjs rename was tried first; Vercel's router didn't resolve it, so the whole
// api/stripe/ directory is genuine ESM instead — see webhook.js, create-checkout-session.js,
// create-portal-session.js, _shared.js, all converted alongside this file.)
//
// Auth-gated. Returns the SERVER-DERIVED entitlement for the caller's household.
// The client calls this on load and for the "Restore / recheck subscription" button.
// This is the authority; the client's cached af_entitlement is only a UX hint.
//
// Note: household members can also SELECT their own subscriptions row directly via RLS
// (see sql/2026-07_billing.sql). This endpoint exists so "recheck" can additionally
// reconcile against Stripe if the row looks stale, and so the entitlement RULE lives in
// exactly one place (_shared.isEntitled) rather than being re-implemented client-side.

import { createClient } from '@supabase/supabase-js';
import { isEntitled } from './_shared.js';

function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveHouseholdId(db, userId) {
  const { data: owned, error: ownedErr } = await db.from('households').select('id').eq('owner_id', userId).limit(1);
  // TEMP DIAGNOSTIC — remove once the mismatch is found.
  console.log('[TEMP DIAG] households query for userId=' + userId + ':', JSON.stringify({ owned, ownedErr }));
  if (ownedErr) throw new Error('households lookup failed: ' + ownedErr.message);
  if (owned && owned.length) return owned[0].id;
  const { data: mem, error: memErr } = await db
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .limit(1);
  // TEMP DIAGNOSTIC — remove once the mismatch is found.
  console.log('[TEMP DIAG] household_members query for userId=' + userId + ':', JSON.stringify({ mem, memErr }));
  if (memErr) throw new Error('household_members lookup failed: ' + memErr.message);
  if (mem && mem.length) return mem[0].household_id;
  return null;
}

export default async function handler(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'missing bearer token' });

    const db = admin();
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData || !userData.user) return res.status(401).json({ error: 'invalid session' });

    // TEMP DIAGNOSTIC — remove once the mismatch is found.
    console.log('[TEMP DIAG] userData.user.id=' + userData.user.id + ' user_metadata=' + JSON.stringify(userData.user.user_metadata || {}) + ' app_metadata=' + JSON.stringify(userData.user.app_metadata || {}));

    const householdId = await resolveHouseholdId(db, userData.user.id);
    // TEMP DIAGNOSTIC — remove once the mismatch is found.
    console.log('[TEMP DIAG] resolveHouseholdId returned:', JSON.stringify(householdId));
    if (!householdId) return res.status(200).json({ entitled: false, plan: null, reason: 'no household' });

    const { data: rows, error: subsErr } = await db
      .from('subscriptions')
      .select('status, plan, current_period_end, cancel_at_period_end')
      .eq('household_id', householdId)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (subsErr) {
      // Distinct from "no subscription row" — this is a query FAILURE (bad
      // column type, RLS denial, transient DB error), previously discarded
      // silently and indistinguishable from a genuinely unsubscribed household.
      console.error('[stripe:entitlement] subscriptions query error:', subsErr);
      return res.status(500).json({ error: 'could not resolve entitlement', detail: subsErr.message });
    }
    const row = rows && rows.length ? rows[0] : null;

    return res.status(200).json({
      entitled: isEntitled(row, Date.now()),
      plan: row ? row.plan : null,
      status: row ? row.status : null,
      current_period_end: row ? row.current_period_end : null,
      cancel_at_period_end: row ? !!row.cancel_at_period_end : false,
    });
  } catch (err) {
    console.error('[stripe:entitlement] error:', err);
    // Fail CLOSED for entitlement decisions on the server side; the client keeps its last
    // known-good cache for UX but should not be granted new access on an error.
    // TEMP DIAGNOSTIC — `detail` added to the response so the actual thrown message is
    // visible from curl directly, without needing the Vercel log dashboard. Remove once
    // the mismatch is found (matches the pattern already used for subsErr above).
    return res.status(500).json({ error: 'could not resolve entitlement', detail: err && err.message });
  }
};
