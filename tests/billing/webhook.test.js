// test/billing/webhook.test.js
// These tests exercise the security-critical + money-critical logic with NO network:
//  - Stripe signature verification (real SDK) accepts a correctly-signed body
//  - a tampered body / wrong secret is REJECTED
//  - idempotency guard skips a re-delivered event id
//  - subscription -> row mapping (incl. the item-level current_period_end move)
//  - server-derived entitlement rule at the grace boundary
import { describe, it, expect } from 'vitest';
import Stripe from 'stripe';
import {
  planFromPriceId,
  subscriptionToRow,
  isEntitled,
  periodEndSeconds,
  PRICE_MONTHLY,
  PRICE_ANNUAL,
} from '../../api/stripe/_shared.js';

// No apiVersion pinned — see api/stripe/create-checkout-session.js's matching
// comment: '2026-01-28' was not a real Stripe API version. Harmless here
// (this instance only does local signature gen/verification, never a real
// API call), but removed for consistency with the production fix.
const stripe = new Stripe('sk_test_dummy');
const WH_SECRET = 'whsec_test_secret_123';

function signed(payloadObj, secret = WH_SECRET) {
  const payload = JSON.stringify(payloadObj);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { payload, header };
}

describe('Stripe signature verification', () => {
  const evt = { id: 'evt_1', type: 'customer.subscription.updated', data: { object: {} } };

  it('accepts a correctly-signed payload', () => {
    const { payload, header } = signed(evt);
    const parsed = stripe.webhooks.constructEvent(payload, header, WH_SECRET);
    expect(parsed.id).toBe('evt_1');
  });

  it('rejects a tampered payload', () => {
    const { header } = signed(evt);
    const tampered = JSON.stringify({ ...evt, id: 'evt_HACKED' });
    expect(() => stripe.webhooks.constructEvent(tampered, header, WH_SECRET)).toThrow();
  });

  it('rejects a valid signature made with the wrong secret', () => {
    const { payload, header } = signed(evt, 'whsec_WRONG');
    expect(() => stripe.webhooks.constructEvent(payload, header, WH_SECRET)).toThrow();
  });
});

describe('idempotency guard', () => {
  // Mirrors the record-before-process pattern: a Set/table keyed by event.id.
  function makeGuard() {
    const seen = new Set();
    return {
      alreadyProcessed: (id) => seen.has(id),
      markProcessed: (id) => seen.add(id),
    };
  }

  it('processes a new event once and skips the duplicate', () => {
    const g = makeGuard();
    let processed = 0;
    const handle = (id) => {
      if (g.alreadyProcessed(id)) return 'skipped';
      processed += 1;
      g.markProcessed(id);
      return 'processed';
    };
    expect(handle('evt_dup')).toBe('processed');
    expect(handle('evt_dup')).toBe('skipped'); // Stripe re-delivery
    expect(processed).toBe(1);
  });
});

describe('planFromPriceId', () => {
  it('maps known price IDs', () => {
    expect(planFromPriceId(PRICE_MONTHLY)).toBe('monthly');
    expect(planFromPriceId(PRICE_ANNUAL)).toBe('annual');
  });
  it('returns null for unknown', () => {
    expect(planFromPriceId('price_unknown')).toBeNull();
  });
});

describe('subscriptionToRow (item-level period end)', () => {
  const periodEnd = Math.floor(Date.parse('2026-08-01T00:00:00Z') / 1000);
  const sub = {
    id: 'sub_123',
    status: 'active',
    customer: 'cus_abc',
    cancel_at_period_end: false,
    metadata: { household_id: 'hh_1', app_user_id: 'user_1' },
    items: {
      data: [
        { current_period_end: periodEnd, price: { id: PRICE_ANNUAL } },
      ],
    },
  };

  it('reads current_period_end from the subscription item, not the root', () => {
    expect(periodEndSeconds(sub)).toBe(periodEnd);
  });

  it('produces a clean row with household + plan + iso period end', () => {
    const row = subscriptionToRow(sub);
    expect(row).toMatchObject({
      household_id: 'hh_1',
      user_id: 'user_1',
      stripe_customer_id: 'cus_abc',
      stripe_subscription_id: 'sub_123',
      status: 'active',
      plan: 'annual',
    });
    // cancel_at_period_end is intentionally NOT written — the column doesn't exist in
    // production (sql/2026-07_billing.sql's ALTER TABLE for it was gated and never run
    // there), so including it made every webhook upsert fail outright.
    expect(row).not.toHaveProperty('cancel_at_period_end');
    expect(row.current_period_end).toBe('2026-08-01T00:00:00.000Z');
  });

  it('still works if only the legacy root-level field is present', () => {
    const legacy = { ...sub, items: { data: [{ price: { id: PRICE_MONTHLY } }] }, current_period_end: periodEnd };
    const row = subscriptionToRow(legacy);
    expect(row.plan).toBe('monthly');
    expect(row.current_period_end).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('isEntitled (server-derived, grace boundary)', () => {
  const future = '2999-01-01T00:00:00.000Z';
  const past = '2000-01-01T00:00:00.000Z';

  it('active + future period → entitled', () => {
    expect(isEntitled({ status: 'active', current_period_end: future })).toBe(true);
  });
  it('trialing + future → entitled', () => {
    expect(isEntitled({ status: 'trialing', current_period_end: future })).toBe(true);
  });
  it('past_due still inside grace (future end) → entitled', () => {
    expect(isEntitled({ status: 'past_due', current_period_end: future })).toBe(true);
  });
  it('canceled → not entitled even with future end', () => {
    expect(isEntitled({ status: 'canceled', current_period_end: future })).toBe(false);
  });
  it('active but period already ended → not entitled', () => {
    expect(isEntitled({ status: 'active', current_period_end: past })).toBe(false);
  });
  it('null row → not entitled', () => {
    expect(isEntitled(null)).toBe(false);
  });
  it('active, no period end recorded yet → entitled (just-created)', () => {
    expect(isEntitled({ status: 'active', current_period_end: null })).toBe(true);
  });
});
