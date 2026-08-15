// src/billing/PlusModal.jsx
// Paywall upgrade modal. Pure presentation — the upgrade button calls entitlement.js's
// startCheckout(), which hits the existing /api/stripe/create-checkout-session endpoint.
// This component never talks to Stripe or Supabase directly. BILLING_V1 (entitlement.js)
// gates whether anything ever renders this at all.
'use strict';

import { useState } from 'react';
import { startCheckout } from './entitlement.js';

// Placeholder copy — verify against whichever Stripe price IDs are actually configured
// (api/stripe/_shared.js PRICE_MONTHLY/PRICE_ANNUAL, or their env-var overrides) before
// BILLING_V1 ever flips on; these dollar figures are not derived from that config.
// The 14-day trial claim also needs a matching subscription_data.trial_period_days on
// the checkout session (or an equivalent Stripe product trial) — not present today.
var MONTHLY_PRICE_LABEL = '$12.99/month';
var ANNUAL_PRICE_LABEL = '$119/year';
var ANNUAL_SAVINGS_LABEL = 'Save 24%';
var TRIAL_LABEL = 'Start 14-Day Free Trial';

var DEFAULT_BENEFITS = [
  'Full family learning system — Lighthouse, Tide Pool, and more',
  'Every household member, not just one',
  'Home, People, and Horizon — your whole household in one place',
  'Priority Compass AI suggestions',
];

// featureName: shown as the small label above the headline (e.g. "Lighthouse").
// getToken: same synchronous token-getter contract entitlement.js's functions use.
// onClose: called for both the backdrop click and "Maybe later".
export default function PlusModal(props) {
  var featureName = props.featureName || 'This feature';
  var getToken = props.getToken;
  var onClose = props.onClose;
  var benefits = props.benefits || DEFAULT_BENEFITS;

  var s1 = useState('annual');
  var plan = s1[0];
  var setPlan = s1[1];
  var s2 = useState(false);
  var loading = s2[0];
  var setLoading = s2[1];
  var s3 = useState(null);
  var error = s3[0];
  var setError = s3[1];

  function handleUpgrade() {
    setLoading(true);
    setError(null);
    startCheckout(getToken, plan).catch(function (err) {
      setLoading(false);
      setError((err && err.message) || 'Something went wrong. Try again.');
    });
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,39,68,0.72)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
      <div onClick={function (e) { e.stopPropagation(); }} style={{ background: '#1a2744', border: '1px solid rgba(200,169,122,0.3)', borderRadius: '1.2rem', padding: '1.75rem 1.6rem', width: '100%', maxWidth: 400, boxShadow: '0 24px 80px rgba(0,0,0,0.4)', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8a97a', marginBottom: '0.4rem' }}>{featureName}</div>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 700, color: '#faf8f4', marginBottom: '0.9rem', lineHeight: 1.25 }}>This is a Plus feature</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1.25rem' }}>
          {benefits.map(function (b, i) {
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ color: '#c8a97a', fontSize: '0.85rem', lineHeight: 1.4, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: '0.85rem', color: 'rgba(250,248,244,0.85)', lineHeight: 1.4 }}>{b}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button onClick={function () { setPlan('monthly'); }} style={{ flex: 1, padding: '0.7rem 0.5rem', borderRadius: '0.7rem', border: '1.5px solid ' + (plan === 'monthly' ? '#c8a97a' : 'rgba(250,248,244,0.15)'), background: plan === 'monthly' ? 'rgba(200,169,122,0.12)' : 'transparent', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#faf8f4' }}>Monthly</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(250,248,244,0.6)', marginTop: 2 }}>{MONTHLY_PRICE_LABEL}</div>
          </button>
          <button onClick={function () { setPlan('annual'); }} style={{ flex: 1, padding: '0.7rem 0.5rem', borderRadius: '0.7rem', border: '1.5px solid ' + (plan === 'annual' ? '#c8a97a' : 'rgba(250,248,244,0.15)'), background: plan === 'annual' ? 'rgba(200,169,122,0.12)' : 'transparent', cursor: 'pointer', textAlign: 'center', position: 'relative', fontFamily: 'inherit' }}>
            <div style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', background: '#c8a97a', color: '#1a2744', fontSize: '0.6rem', fontWeight: 700, padding: '1px 8px', borderRadius: '1rem', whiteSpace: 'nowrap' }}>{ANNUAL_SAVINGS_LABEL}</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#faf8f4' }}>Annual</div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(250,248,244,0.6)', marginTop: 2 }}>{ANNUAL_PRICE_LABEL}</div>
          </button>
        </div>

        {error && <div style={{ fontSize: '0.75rem', color: '#e07070', marginBottom: '0.75rem', textAlign: 'center' }}>{error}</div>}

        <button onClick={handleUpgrade} disabled={loading} style={{ width: '100%', padding: '0.85rem', background: '#c8a97a', color: '#1a2744', border: 'none', borderRadius: '0.85rem', fontSize: '0.92rem', fontWeight: 700, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit', marginBottom: '0.6rem' }}>
          {loading ? 'Redirecting…' : TRIAL_LABEL}
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: '0.6rem', background: 'none', border: 'none', color: 'rgba(250,248,244,0.5)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
