// api/stripe/create-portal-session.js
// Auth-gated. Opens the Stripe Customer Portal for the caller's household so they can
// update card, cancel, or switch monthly/annual. Cancellation/plan-change state comes back
// to us via customer.subscription.updated / .deleted webhooks — we never trust the redirect.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-01-28' });

function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
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

export default async function handler(req, res) {
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
    if (userErr || !userData || !userData.user) return res.status(401).json({ error: 'invalid session' });

    const householdId = await resolveHouseholdId(db, userData.user.id);
    if (!householdId) return res.status(400).json({ error: 'no household for user' });

    const { data: sub } = await db
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('household_id', householdId)
      .not('stripe_customer_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1);
    const customerId = sub && sub.length ? sub[0].stripe_customer_id : null;
    if (!customerId) return res.status(404).json({ error: 'no billing customer for household' });

    const origin = req.headers.origin || process.env.APP_ORIGIN || 'https://anchorandflowapp.com';
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/?billing=return`,
    });
    return res.status(200).json({ url: portal.url });
  } catch (err) {
    console.error('[stripe:create-portal-session] error:', err);
    return res.status(500).json({ error: 'could not create portal session' });
  }
};
