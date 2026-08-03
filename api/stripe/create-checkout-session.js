// api/stripe/create-checkout-session.js
// Auth-gated. Creates a Checkout Session for the caller's HOUSEHOLD (one plan per household).
// The household_id + app_user_id are stamped into subscription metadata so the webhook can
// attribute the resulting subscription without trusting anything the browser sends later.
//
// Verify against repo: how api/anthropic.js authenticates the caller. This uses the Supabase
// access token from the Authorization header + a service-role client to read membership.

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { priceIdFromPlan } = require('./_shared.js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-01-28' });

function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

// Resolve the caller's household id. A member account (e.g. Twyla) resolves via
// household_members, not via direct ownership — matches the app's own rule.
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'missing bearer token' });

    const db = admin();
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData || !userData.user) {
      return res.status(401).json({ error: 'invalid session' });
    }
    const user = userData.user;

    const body = await readJsonBody(req);
    const plan = body.plan === 'annual' ? 'annual' : 'monthly';
    const priceId = priceIdFromPlan(plan);
    if (!priceId) return res.status(400).json({ error: 'unknown plan' });

    const householdId = await resolveHouseholdId(db, user.id);
    if (!householdId) return res.status(400).json({ error: 'no household for user' });

    // One subscription per household: block a second active checkout if one already exists.
    const { data: existing } = await db
      .from('subscriptions')
      .select('status')
      .eq('household_id', householdId)
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1);
    if (existing && existing.length) {
      return res.status(409).json({ error: 'household already has an active subscription' });
    }

    // Reuse a Stripe customer for this household if we've seen one, else let Checkout make one.
    const { data: priorCust } = await db
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('household_id', householdId)
      .not('stripe_customer_id', 'is', null)
      .limit(1);
    const customerId = priorCust && priorCust.length ? priorCust[0].stripe_customer_id : undefined;

    const origin = req.headers.origin || process.env.APP_ORIGIN || 'https://anchorandflowapp.com';

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        ...(customerId ? { customer: customerId } : { customer_email: user.email }),
        client_reference_id: householdId,
        subscription_data: {
          metadata: { household_id: householdId, app_user_id: user.id, plan },
        },
        metadata: { household_id: householdId, app_user_id: user.id, plan },
        success_url: `${origin}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?billing=cancelled`,
        allow_promotion_codes: true,
      },
      // Idempotency key on the write op: a double-click won't create two sessions/customers.
      { idempotencyKey: `checkout:${householdId}:${plan}:${Math.floor(Date.now() / 60000)}` }
    );

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[stripe:create-checkout-session] error:', err);
    return res.status(500).json({ error: 'could not create checkout session' });
  }
};
