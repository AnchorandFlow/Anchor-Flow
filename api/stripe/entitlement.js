// api/stripe/entitlement.js
// Auth-gated. Returns the SERVER-DERIVED entitlement for the caller's household.
// The client calls this on load and for the "Restore / recheck subscription" button.
// This is the authority; the client's cached af_entitlement is only a UX hint.
//
// Note: household members can also SELECT their own subscriptions row directly via RLS
// (see sql/2026-07_billing.sql). This endpoint exists so "recheck" can additionally
// reconcile against Stripe if the row looks stale, and so the entitlement RULE lives in
// exactly one place (_shared.isEntitled) rather than being re-implemented client-side.

const { createClient } = require('@supabase/supabase-js');
const { isEntitled, subscriptionToRow } = require('./_shared.js');

function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveHouseholdId(db, userId) {
  const { data: owned } = await db.from('households').select('id').eq('owner_id', userId).limit(1);
  if (owned && owned.length) return owned[0].id;
  const { data: mem } = await db
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .limit(1);
  if (mem && mem.length) return mem[0].household_id;
  return null;
}

module.exports = async function handler(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'missing bearer token' });

    const db = admin();
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData || !userData.user) return res.status(401).json({ error: 'invalid session' });

    const householdId = await resolveHouseholdId(db, userData.user.id);
    if (!householdId) return res.status(200).json({ entitled: false, plan: null, reason: 'no household' });

    const { data: rows } = await db
      .from('subscriptions')
      .select('status, plan, current_period_end, cancel_at_period_end')
      .eq('household_id', householdId)
      .order('updated_at', { ascending: false })
      .limit(1);
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
    return res.status(500).json({ error: 'could not resolve entitlement' });
  }
};
