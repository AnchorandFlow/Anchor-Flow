# Anchor & Flow — Billing Implementation To-Do

## Status: Pre-launch, no gating live yet. Everyone gets everything.
Complete these before charging real users.

---

## 1. Stripe Setup
- [ ] Create Stripe account (if not done)
- [ ] Create two products in Stripe:
  - Flow Monthly — $12.99/month
  - Flow Annual — $119/year
- [ ] Copy both Price IDs from Stripe dashboard
- [ ] Add Stripe secret key to Vercel environment variables (`STRIPE_SECRET_KEY`)
- [ ] Add Stripe webhook secret to Vercel env vars (`STRIPE_WEBHOOK_SECRET`)

## 2. Vercel Serverless Functions
- [ ] Create `api/create-checkout.js` — creates a Stripe checkout session
  - Accepts: `{ priceId, householdId, userId }`
  - Returns: `{ url }` — redirect user to this URL
- [ ] Create `api/stripe-webhook.js` — listens for Stripe events
  - On `checkout.session.completed` → upsert into `subscriptions` table with `household_id`
  - On `customer.subscription.updated` → update `status` and `plan`
  - On `customer.subscription.deleted` → set `status = 'cancelled'`

## 3. Supabase — subscriptions table
Current columns: `id`, `user_id`, `stripe_customer_id`, `stripe_subscription_id`,
`status`, `plan`, `current_period_end`, `created_at`, `updated_at`, `household_id`

- [ ] Confirm `household_id` is populated when new subscriptions are created (via webhook)
- [ ] Add RLS policy so users can only read their household's subscription:
  ```sql
  create policy "household members can read subscription"
  on subscriptions for select
  using (
    household_id = (
      select id from af_households
      where created_by = auth.uid()
      -- or however household membership is determined
    )
  );
  ```

## 4. App.jsx — Subscription Check
Currently: no gating logic exists.

- [ ] On app load, after household is loaded, fetch household subscription:
  ```js
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end')
    .eq('household_id', householdId)
    .eq('status', 'active')
    .maybeSingle()
  const isFlow = sub?.plan === 'flow'
  ```
- [ ] Store `isFlow` in state
- [ ] Gate these features behind `isFlow`:
  - Ripple AI full briefings
  - Anchor Vault (full access)
  - Google Calendar sync
  - Household sync (>1 member)
  - Meal Bank + Next Week planning
  - Evening wind-down flow
- [ ] Never gate: Survival Mode, basic Brain Dump, basic meal planning

## 5. App.jsx — Upgrade Flow
- [ ] Add upgrade button/modal for locked features
- [ ] Upgrade button calls `api/create-checkout.js` with chosen price ID
- [ ] Redirect user to Stripe checkout
- [ ] On return from Stripe (`?success=true`), refresh subscription state

## 6. Household Join Flow
- [ ] When a user joins via household code, check if that household has an active Flow subscription
- [ ] If yes, they automatically get Flow access (no separate payment needed)
- [ ] Show them a confirmation: "You've joined [Name]'s household — Flow features unlocked"

## 7. Testing
- [ ] Test monthly subscribe → partner joins → both get Flow
- [ ] Test cancellation → both lose Flow access at period end
- [ ] Test annual subscribe → correct price charged
- [ ] Test webhook retry handling (idempotency)

---

## Notes
- Survival Mode is NEVER paywalled (core brand promise)
- One subscription per household — do not allow multiple active subscriptions for same household
- Founding pricing: consider locking early subscribers at $12.99/mo forever via Stripe coupon
