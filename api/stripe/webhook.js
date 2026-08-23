// api/stripe/webhook.js
// Vercel Node serverless function. THE source of truth for entitlement.
// Security: raw-body signature verification + idempotency + service-role writes only.
//
// IMPORTANT (verify against repo before shipping):
//  - This assumes the api/ folder uses the Node runtime with the (req,res) handler shape,
//    matching api/anthropic.js. If anthropic.js is an Edge function, port this to
//    constructEventAsync + a Web Request/Response signature instead.
//  - bodyParser MUST be disabled so we can read the raw body for signature verification.
//
// Required env (Vercel, production scope): STRIPE_SECRET_KEY (sk_live_... live mode),
//   STRIPE_WEBHOOK_SECRET (whsec_... from the live endpoint registered in the Stripe dashboard),
//   SUPABASE_URL, SUPABASE_SERVICE_KEY (server-only, never VITE_). Note the deployed Vercel env
//   var is named SUPABASE_SERVICE_KEY, not the more conventional SUPABASE_SERVICE_ROLE_KEY —
//   this drifted from the code for a while and silently broke every api/stripe/* function's
//   admin() client (createClient threw "supabaseKey is required.") until caught 2026-08-21.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { subscriptionToRow } from './_shared.js';

// No apiVersion pinned — see create-checkout-session.js's matching comment:
// '2026-01-28' was not a real Stripe API version. Omitted so the installed
// stripe SDK (package.json: ^22.4.0) uses its own built-in default.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Service-role client: bypasses RLS. NEVER expose this key to the browser.
function admin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Disable Vercel's body parser: signature verification needs the raw bytes.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function upsertFromSubscription(db, subscription) {
  const row = subscriptionToRow(subscription);
  if (!row.household_id) {
    // Never write a row we can't attribute to a household. Log loudly for reconciliation.
    console.error('[stripe:webhook] subscription missing household_id metadata', subscription.id);
    return;
  }
  // Upsert keyed on stripe_subscription_id so re-delivered/updated events converge.
  const { error } = await db
    .from('subscriptions')
    .upsert(row, { onConflict: 'stripe_subscription_id' });
  if (error) throw error;
}

async function handleEvent(db, event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      // Pull the full subscription so we get items[].current_period_end + metadata.
      if (session.mode === 'subscription' && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
          { expand: ['items.data.price'] }
        );
        // Carry checkout metadata onto the subscription if it isn't already there.
        if (session.metadata && (!sub.metadata || !sub.metadata.household_id)) {
          sub.metadata = { ...(sub.metadata || {}), ...session.metadata };
        }
        await upsertFromSubscription(db, sub);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await upsertFromSubscription(db, event.data.object);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const { error } = await db
        .from('subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', sub.id);
      if (error) throw error;
      break;
    }
    case 'invoice.payment_failed': {
      // Stripe will also send subscription.updated (status past_due/unpaid); this is a
      // secondary hook if we later want to send a dunning email. No state change needed here.
      break;
    }
    default:
      // Ignore everything we don't explicitly handle.
      break;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  let event;
  try {
    const raw = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe:webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const db = admin();

  // No stripe_events idempotency table (sql/2026-07_billing.sql that would create it
  // was never applied to production — confirmed missing, causing every webhook
  // delivery to 500 on the insert). Every current handleEvent() write is already
  // idempotent on its own: upsertFromSubscription upserts onConflict
  // 'stripe_subscription_id', and the subscription-deleted handler just sets
  // status: 'canceled' — re-running either on a Stripe retry is harmless. Safe to
  // run without a separate event-id dedup table for now. If a future event type
  // needs a non-idempotent side effect (e.g. sending an email), re-add real
  // event-id tracking before relying on this path for it.
  try {
    await handleEvent(db, event);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe:webhook] handler error:', err);
    // 500 → Stripe retries with backoff (up to ~3 days).
    return res.status(500).json({ error: 'handler failed' });
  }
};
