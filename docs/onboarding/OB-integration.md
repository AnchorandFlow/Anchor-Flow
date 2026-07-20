# Onboarding Wizard — Integration Guide

Everything in this package is pre-built and pre-verified. When integration day
comes (post-refactor, post-billing, per OB-0 sequencing), this doc is the
runbook. Component compiles clean under `--target=es2019` with 0 warnings;
8/8 unit tests pass; step 1 render smoke-tested with prefill props.

## Package contents

```
docs/OB-0-onboarding-plan.md     — spec: flow, copy, data contract, test plan
src/Onboarding.jsx               — the wizard module (self-contained, flag-agnostic)
src/Onboarding.test.jsx          — Vitest spec (8 tests, joins the main suite)
```

## Pre-integration checklist

- [ ] RF extraction batches touching App shell + settings are landed
- [ ] Lighthouse GA decision made (affects whether Lighthouse card shows in step 2)
- [ ] Decide final feature list for step 2 (edit `FEATURE_DEFS` — copy is locked from design session, list may grow)

## Wiring steps (each its own commit — small-diff discipline)

**Commit 1 — land the module.** Copy `Onboarding.jsx` + `Onboarding.test.jsx`
into the repo (suggested: `src/onboarding/`). Run the suite. No App.jsx changes.

**Commit 2 — sync key registration.** Add `af_onboardingState` to `SYNC_KEYS`,
`NULL_SAFE_KEYS`, sanitizer allowlist (verify the RECEIVE path — the 9-key
silent-drop bug lived there), and export/import coverage. Shape:
`{ complete: boolean, completedAt: string, version: 1 }`.

**Commit 3 — one-time migration.** Existing households get
`af_onboardingState.complete = true` on next load so nobody is wizard-ambushed
when the flag flips. Fresh-household heuristic: no people AND no synced pillar
data.

**Commit 4 — render wiring + flag.** In App.jsx:

```
{ONBOARDING_V1 && showOnboarding ? (
  <OnboardingWizard
    onComplete={handleOnboardingComplete}
    onSkip={handleOnboardingSkip}
  />
) : null}
```

`showOnboarding` = flag ON && !onboardingState.complete && fresh household.
`handleOnboardingComplete(payload)` maps payload → sync keys per the OB-0
data contract table, marks complete, sets today's mode, routes to Today.
`handleOnboardingSkip()` marks complete only (so it never re-ambushes) and
routes to Today. **Never log the payload** (contains names/birthdays).

**Commit 5 — Settings re-run.** "Set up my harbor again" button. Pass
`initialPeople` and `initialHouseholdName` from current state. On complete,
MERGE: union people by name, append new exhale cards, overwrite settings/mode.
Never delete existing people or cards.

**Commit 6 — Playwright.** Extend the Phase C scaffold per OB-0 test plan
(fresh-household auto-launch, personalized Today landing, conditional step 3,
focus retention in crew inputs during sync-apply).

## Payload → sync key mapping

See OB-0 "Data contract" section — that table is the single source of truth.
The wizard never touches persistence; all writes happen in
`handleOnboardingComplete`.

## Design notes frozen from the July 2026 session

- Five steps: harbor basics → rooms → details (conditional) → Exhale tutorial → mode.
- Detail questions only for toggled-on sections; empty steps auto-skip.
- Finish CTA: "Step into your harbor" → lands on personalized Today.
- Exhale tutorial cards are real cards (persist after finish).
- Birthdays auto-seed Celebrations countdowns; people seed Lighthouse per-child records.
- Survival mode copy is load-bearing: "Bare minimum, zero guilt. We'll hold the rest for later."
- v2 ideas parked: drag-and-drop in Exhale step; joiner quick-tour; confetti on finish via existing celebration system.

---

## Claude Code kickoff prompt (paste when the day comes)

> We're integrating the pre-built onboarding wizard. Read
> `docs/onboarding/OB-0-onboarding-plan.md` and
> `docs/onboarding/OB-integration.md` first — they define the full spec,
> data contract, and commit plan. The wizard module and its tests already
> exist at `src/onboarding/Onboarding.jsx` and pass; do NOT redesign it.
> Work through integration commits 2–5 from the guide, one commit each, in
> order. Constraints: ES2019/Safari-13 target (no optional chaining, no
> nullish coalescing, no async/await, no arrow block bodies in JSX, no spread
> in JSX style props); all new components at module scope; never log payload
> contents; run the full test suite after each commit; no chained git merges.
> Stop after commit 5 and show me the diff summary before we do Playwright.
