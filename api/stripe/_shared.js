// api/stripe/_shared.js
// Vercel treats files/dirs under api/ that start with "_" as NON-routes (helpers only).
// Pure, side-effect-free logic lives here so it can be unit-tested with no network/DB.
// Runtime: Node (Vercel serverless). Modern JS is fine here — this is NOT bundled to the
// ES2019/Safari-13 client target.

// ---- Config surface (all IDs come from env or the known product IDs) --------------------
// Price IDs from backlog §7. Verify against the Stripe SANDBOX before shipping.
export const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || 'price_1TkGSxEUKkaRdCdIpI0A3To0';
export const PRICE_ANNUAL  = process.env.STRIPE_PRICE_ANNUAL  || 'price_1TkGTrEUKkaRdCdIRjq3Ts75';

// Statuses that grant household access. "past_due" intentionally still grants access during
// the grace window; "unpaid"/"canceled"/"incomplete_expired" do not.
export const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);

export function planFromPriceId(priceId) {
  if (priceId === PRICE_MONTHLY) return 'monthly';
  if (priceId === PRICE_ANNUAL) return 'annual';
  return null;
}

export function priceIdFromPlan(plan) {
  if (plan === 'monthly') return PRICE_MONTHLY;
  if (plan === 'annual') return PRICE_ANNUAL;
  return null;
}

// Read the current period end in a version-proof way.
// API >= 2025-03-31 moved current_period_end onto the subscription ITEM.
// We prefer the item value and fall back to the (legacy) subscription-level field.
export function periodEndSeconds(subscription) {
  const items = subscription && subscription.items && subscription.items.data;
  if (Array.isArray(items) && items.length > 0) {
    let maxEnd = 0;
    for (const it of items) {
      if (typeof it.current_period_end === 'number' && it.current_period_end > maxEnd) {
        maxEnd = it.current_period_end;
      }
    }
    if (maxEnd > 0) return maxEnd;
  }
  if (typeof subscription.current_period_end === 'number') {
    return subscription.current_period_end; // legacy fallback
  }
  return null;
}

export function firstPriceId(subscription) {
  const items = subscription && subscription.items && subscription.items.data;
  if (Array.isArray(items) && items.length > 0) {
    const p = items[0].price;
    if (p && typeof p.id === 'string') return p.id;
    if (typeof items[0].plan === 'object' && items[0].plan && items[0].plan.id) return items[0].plan.id;
  }
  return null;
}

// Map a Stripe Subscription object -> the row we upsert into public.subscriptions.
// householdId/userId come from subscription.metadata (set at checkout) so the webhook
// never has to guess who this belongs to.
export function subscriptionToRow(subscription) {
  const md = subscription.metadata || {};
  const priceId = firstPriceId(subscription);
  const periodEnd = periodEndSeconds(subscription);
  return {
    user_id: md.app_user_id || null,
    household_id: md.household_id || null,
    stripe_customer_id:
      typeof subscription.customer === 'string'
        ? subscription.customer
        : (subscription.customer && subscription.customer.id) || null,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plan: planFromPriceId(priceId), // 'monthly' | 'annual' | null
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    // cancel_at_period_end intentionally omitted — see entitlement.js's matching comment.
    // The column doesn't exist in production yet, so including it here made every
    // webhook upsert fail (checkout completions, renewals, cancellations, all of it).
    updated_at: new Date().toISOString(),
  };
}

// SERVER-DERIVED entitlement. This is the single source of truth for "does this household
// have Plus". The client may CACHE the answer but must never compute or be trusted for it.
export function isEntitled(row, nowMs) {
  if (!row) return false;
  if (!ENTITLED_STATUSES.has(row.status)) return false;
  // Grace: if we have a period end, require it to be in the future (with a small skew).
  if (row.current_period_end) {
    const end = Date.parse(row.current_period_end);
    if (!Number.isNaN(end)) {
      const skewMs = 60 * 1000;
      return end + skewMs >= (typeof nowMs === 'number' ? nowMs : Date.now());
    }
  }
  // No period end recorded yet (e.g. just created) but status is entitled → allow.
  return true;
}
