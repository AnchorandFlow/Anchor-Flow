# Anchor & Flow — P1 Stripe Test-Mode Billing: Map, Plan & Gates

Branch this belongs on: **`billing-test-mode`** (clean, off `main`). Additive only. Do **not**
mix with the Playwright (P2) or Lighthouse (P3) work — separate branches.

Status of what's in this package: **reference implementation + passing logic tests.** It has
**not** been run against the live repo, live Supabase, or Stripe. Nothing here deploys or
charges. `BILLING_V1` defaults **OFF**, so merging changes nothing for users until you flip it.

---

## 1. Data-flow map (how one household gets & keeps "Plus")

```
                 ┌──────────────┐   Bearer <supabase access token>
  Settings UI ──▶│ /api/stripe/ │──────────────────────────────┐
  (upgrade CTA)  │ create-      │  resolve user → household     │
                 │ checkout-    │  reuse/create Stripe customer │
                 │ session      │  stamp metadata:              │
                 └──────┬───────┘   {household_id, app_user_id} │
                        │ returns session.url                   │
                        ▼                                        │
                 Stripe Checkout (hosted)  ── user pays (TEST card) ──┐
                        │                                             │
      redirect ?billing=success (UX ONLY — never grants access)      │
                        │                                             ▼
                        │                              ┌───────────────────────────┐
                        │                              │  Stripe sends webhooks     │
                        │                              │  checkout.session.completed│
                        │                              │  customer.subscription.*   │
                        │                              └──────────────┬────────────┘
                        │                                             ▼
                        │                              ┌───────────────────────────┐
                        │                              │ /api/stripe/webhook        │
                        │                              │ 1 verify signature (raw)   │
                        │                              │ 2 idempotency: stripe_events│
                        │                              │ 3 upsert public.subscriptions│
                        │                              │    (service role, bypass RLS)│
                        │                              └──────────────┬────────────┘
                        ▼                                             ▼
                 App reloads ──▶ /api/stripe/entitlement  ◀── reads subscriptions row
                 (or reads subscriptions row directly via RLS SELECT policy)
                        │  isEntitled(row, now)  ← the ONE rule (api/stripe/_shared.js)
                        ▼
                 af_entitlement (DEVICE_LOCAL cache, UX hint only, never trusted, never synced)
```

**The one invariant:** entitlement is written only by the signature-verified webhook using the
Supabase **service role**, and computed only by `isEntitled()` on the server. The browser can
read it (via the RLS SELECT policy or the entitlement endpoint) but can never write or forge it.

### Where each piece plugs into the existing app
| New file | Talks to | Existing convention it must match |
|---|---|---|
| `api/stripe/create-checkout-session.js` | Supabase (service role), Stripe | auth pattern of `api/anthropic.js` |
| `api/stripe/webhook.js` | Stripe, Supabase (service role) | Node runtime + raw body |
| `api/stripe/create-portal-session.js` | Stripe, Supabase | same auth pattern |
| `api/stripe/entitlement.js` | Supabase | same auth pattern |
| `api/stripe/_shared.js` | (pure) | none — helper, not a route |
| `src/billing/entitlement.js` | the 4 endpoints | ES2019/Safari-13 target; DEVICE_LOCAL |
| `sql/2026-07_billing.sql` | Supabase schema/RLS | **GATED — needs approval** |

---

## 2. Verify BEFORE editing anything (map-first gate)

These are unknowns I could not confirm without the repo. Confirm each, then adjust the files.

1. **API runtime shape.** Open `api/anthropic.js`. Is it Node (`module.exports = (req,res) => …`
   / `export default handler`) or an Edge function? These handlers assume **Node**. If Edge,
   the webhook must use `stripe.webhooks.constructEventAsync` + `await req.text()` and the
   `config.bodyParser` trick doesn't apply.
2. **Auth extraction.** Confirm how `anthropic.js` identifies the caller. These files expect a
   Supabase access token in `Authorization: Bearer …` and call `supabase.auth.getUser(token)`.
   Match whatever the proxy already does.
3. **Service-role key.** Confirm `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_URL` exist in Vercel
   (server scope, **not** `VITE_`). If only the anon key is present server-side, the webhook
   cannot write past RLS — add the service-role key (Vercel env, never git).
4. **`subscriptions` columns.** Confirm live columns match: `user_id, household_id,
   stripe_customer_id, stripe_subscription_id, status, plan, current_period_end`
   (+ new `cancel_at_period_end`, `updated_at`). Adjust the upsert row if names differ.
5. **Household ownership column.** `resolveHouseholdId` assumes `households.owner_id`. Confirm
   the actual owner column name and the `household_members(user_id, household_id)` shape.
6. **Price IDs / sandbox.** Confirm the two price IDs in `_shared.js` exist in the **same**
   Stripe sandbox as the rotated test keys (backlog §7 + Tier-1 item 2). Prefer setting
   `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL` env vars over the hardcoded fallbacks.
7. **Client token accessor.** Find how the app currently gets the Supabase access token for
   authed calls; pass that as `getToken` into the `src/billing/entitlement.js` functions.
8. **DEVICE_LOCAL list.** Add `af_entitlement` and `af_entitlement_checkedAt` to the
   DEVICE_LOCAL list so the A10 completeness lint passes and they never enter SYNC_KEYS.

---

## 3. Manual test steps (Stripe TEST mode, local)

Prereqs: Stripe CLI (`brew install stripe/stripe-cli/stripe`), test-mode keys in Vercel/`.env.local`,
the gated SQL applied to the **sandbox** Supabase project.

```bash
stripe login
# forward TEST webhooks to the local dev server; copy the whsec_… it prints into
# STRIPE_WEBHOOK_SECRET (.env.local)
stripe listen --forward-to localhost:5173/api/stripe/webhook \
  --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_failed
```

Then, from the app's Settings billing panel (with `BILLING_V1` temporarily true in dev):

1. **New monthly** — pick Monthly → Checkout → card `4242 4242 4242 4242`, any future exp/CVC →
   redirect back → recheck → household shows Plus, `plan=monthly`, period end ~1 month out.
2. **New annual** — same with Annual → `plan=annual`, period end ~1 year out.
3. **Existing customer** — start a second checkout for the same household → expect **409**
   (one subscription per household).
4. **Second member** — sign in as the member account (Twyla) on another browser/profile → she
   sees Plus **without paying** (household-scoped read).
5. **Abandon** — start checkout, close the tab → no subscription row appears (redirect never
   grants access; only the webhook does).
6. **Duplicate webhook** — `stripe trigger customer.subscription.updated`, then re-send the same
   event id from the CLI → `stripe_events` shows one row, one `completed`; no double-write.
7. **Cancel at period end** — in Checkout's portal (`/api/stripe/create-portal-session`) cancel →
   `customer.subscription.updated` sets `cancel_at_period_end=true`, access persists until period end.
8. **Immediate cancel** — `stripe trigger customer.subscription.deleted` → row `status=canceled`,
   recheck → household loses Plus.
9. **Payment failure** — card `4000 0000 0000 0341` (attaches then fails) or trigger
   `invoice.payment_failed` → status goes `past_due` (still in grace) then `unpaid`/`canceled`.
10. **Restore/recheck** — the Settings "Recheck subscription" button calls `/api/stripe/entitlement`
    and updates the cache; toggle a subscription in the dashboard and confirm the button reflects it.
11. **Stripe unavailable** — block the endpoint / return 500 → UI shows a non-blocking error and
    keeps the last cached state; no crash, no false upgrade.

Automated logic already run in this package (16/16 passing): signature accept/tamper/wrong-secret,
idempotency skip, item-level `current_period_end`, plan mapping, entitlement grace boundary.
See `test/billing/webhook.test.js`. Fold this file into the existing Vitest suite (it becomes
Suite G / billing) so it runs with the other 255.

---

## 4. Rollback plan

- **Pre-flip (BILLING_V1 = false):** merging is inert. To remove entirely: delete `api/stripe/*`,
  `src/billing/`, the billing UI block in Settings, revert the DEVICE_LOCAL additions. No data
  migration to undo. Single-branch revert.
- **DB:** the SQL is additive (`create table if not exists`, `add column if not exists`, one
  SELECT policy). Rollback = `drop policy members_can_read_household_subscription on
  public.subscriptions; drop table if exists public.stripe_events;` (and drop the added columns
  only if you're sure nothing else uses them). Do this on sandbox first.
- **Webhook:** disable/delete the test endpoint in the Stripe dashboard; no user impact while off.
- **Known-good commit:** tag the pre-billing `main` HEAD before merging so there's a labeled
  restore point (mirrors the backlog's rollback discipline).

---

## 5. Unresolved risks

- **Runtime mismatch (highest).** If `api/anthropic.js` is Edge, the webhook raw-body/signature
  path must be ported before it will verify at all. Confirm item 2.1 first.
- **Service-role key absence.** If it's not in Vercel, webhook writes silently fail RLS. Confirm 2.3.
- **Metadata gap.** If a subscription is ever created outside our checkout (e.g. dashboard), it
  won't carry `household_id` and the webhook logs + skips it → manual reconciliation. Acceptable
  for beta; note it in the support runbook.
- **No tombstones / historical rows.** Multiple subscription rows per household over time; the
  entitlement query takes the most-recently-updated. Fine for one-plan-per-household, but audit
  once at live launch.
- **Clock skew on grace boundary.** `isEntitled` allows a 60s skew; revisit if you add trials.
- **Item-level period end.** Handled, but re-verify after any future Stripe API version bump.

---

## 6. Exact human steps required before LIVE mode (do NOT skip)

1. **Governing-law decision** (Terms §15: Utah vs Colorado) — backlog Tier-1 item 3.
2. **Business bank account** opened with the EIN — Tier-1 item 4.
3. **Stripe business verification** completed in the dashboard.
4. Generate **live** keys (`pk_live`/`sk_live`) → Vercel **live/prod scope only, never git**.
5. Create a **separate live webhook endpoint** in Stripe → new `STRIPE_WEBHOOK_SECRET` for live.
6. Recreate the two **prices in live mode**; set live `STRIPE_PRICE_*` env vars.
7. Apply the **gated SQL to production** Supabase (with approval + backup).
8. Final **refund/trial/founding-member language** pass in Terms/Privacy (backlog §Terms).
9. Run one **controlled real live transaction** end-to-end, then refund it.
10. Flip **`BILLING_V1 = true`** and redeploy via `./deploy.sh`, then verify the live bundle hash.

Everything above line 10 is out of scope for this test-mode task and is a human/business gate.
