# OB-0 — Onboarding Wizard ("First Voyage") Plan

**Status:** Built ahead of schedule; integration deferred until post-refactor, feature-complete capstone.
**Flag:** `ONBOARDING_V1` — defaults OFF. Wizard code ships dark.
**Component:** `src/onboarding/Onboarding.jsx` (self-contained module, zero App.jsx state coupling).

---

## Goals

1. Every question does double duty: configures the app AND teaches a feature.
2. New household lands on a Today screen that is already *theirs* — names, sections, mode.
3. Short for minimalists, thorough for all-in families: detail questions only appear for sections toggled ON.
4. Skippable at every step; re-runnable from Settings ("Set up my harbor again").
5. Zero throwaway data: everything entered becomes real app state (birthdays → Celebrations countdowns, Exhale tutorial cards → real Exhale cards).

## Non-goals (v1)

- No drag-and-drop in the Exhale tutorial (up/down buttons instead — drag is a v2 polish item).
- No per-member onboarding for joiners (Twyla). Household-level completion; joiners skip straight in.
- No billing/plan selection in the wizard. Billing has its own flow (`BILLING_V1`).
- No animation/confetti beyond the existing celebration system hook on finish.

---

## Flow — five steps

| # | Screen | Title (Cormorant) | Collects | Teaches |
|---|--------|-------------------|----------|---------|
| 1 | Harbor basics | "Let's build your harbor" | Household name, crew (names + birthdays), zip | The app is family-centric; zip note: "For weather and local rhythms — never shared." |
| 2 | Choose your rooms | "Choose your rooms" | Feature toggles (see table below) | What each pillar IS, in one poetic line each |
| 3 | Tune the details | "Tune the details" | Meals/day, stores, trash day — **conditional on step 2 toggles** | The app tracks household rhythms, not just tasks |
| 4 | Meet Exhale | "Empty your head" | 3 starter cards (rename inline, reorder with arrows) | Exhale mechanics via real interaction; cards persist |
| 5 | Pick your mode | "How's today feeling?" | calm / busy / survival | Modes shape what the app asks of you |

Finish CTA: **"Step into your harbor"** → `onComplete(payload)` → App writes state → land on Today.

### Step 2 — feature toggle cards (copy locked from design session)

| Feature | Emoji | Default | One-liner |
|---------|-------|---------|-----------|
| Tide Pool | 🐚 | ON | "Chores and treasures for your kids — they collect shells to open their treasure box. Set your own, too." |
| Lighthouse | 📖 | ON | "One place for family learning — school activities, homeschool plans, reading challenges, and more." |
| Celebrations | 🎉 | ON | "Birthdays and countdowns, remembered for you." |
| Meals | 🍽️ | ON | "Plan dinners (and more) without the 5 PM scramble." |
| Career | 💼 | OFF | "Work schedules, certifications, and renewals." |
| Safe Harbor | ⚓ | OFF | "Emergency plans and vital info, ready when you need them." |

### Step 3 — conditional detail questions

| Question | Shows only if | Writes to |
|----------|---------------|-----------|
| Meals to plan each day (1/2/3 pills) | Meals ON | meal-planning area settings |
| Stores you shop most (chips + add) | Meals ON (shopping ships with meals) | Shopping V2 store list |
| Trash day (day circles) | always | household rhythm settings; Sunset nudge night before |

If Meals is OFF, step 3 collapses to trash day only. If a step has zero questions, it is skipped entirely and the dots adjust.

### Step 5 — mode copy (locked)

- **Calm** — "Full sails. Everything on deck — plans, chores, learning."
- **Busy** — "Just the essentials. Top priorities and today's must-dos."
- **Survival** — "Bare minimum, zero guilt. We'll hold the rest for later."

---

## Data contract

The wizard owns NO persistence. It builds one payload and hands it to App.jsx via `onComplete`:

```
{
  householdName: string,
  zip: string,
  people: [{ name: string, birthday: string }],   // birthday: YYYY-MM-DD or ''
  features: { tidePool, lighthouse, celebrations, meals, career, safeHarbor },  // booleans
  areaSettings: { mealsPerDay: number, stores: string[], trashDay: string },     // trashDay: 'sun'..'sat' or ''
  exhaleCards: [{ title: string }],
  mode: 'calm' | 'busy' | 'survival'
}
```

### Payload → sync key mapping (App.jsx side, wired at integration time)

| Payload field | Destination |
|---------------|-------------|
| `householdName`, `zip` | household settings |
| `people` | `af_people` (also seeds Lighthouse per-child records) |
| `people[].birthday` | Celebrations countdowns (if celebrations ON) |
| `features.*` | existing per-feature enable flags (same pattern as `compassEnabled`) |
| `areaSettings.stores` | Shopping V2 store list |
| `areaSettings.mealsPerDay`, `trashDay` | area settings |
| `exhaleCards` | `exhale_cards` via existing Realtime insert path |
| `mode` | today's mode |
| completion | **NEW** `af_onboardingState` = `{ complete: true, completedAt, version: 1 }` |

### New sync key checklist (Safe Harbor pattern)

- [ ] Add `af_onboardingState` to `SYNC_KEYS`
- [ ] Register in `NULL_SAFE_KEYS`
- [ ] Add to sanitizer allowlist (remember the 9-key silent-drop bug — verify receive path)
- [ ] Include in export/import coverage
- [ ] Per-key merge strategy: last-write-wins is fine (single boolean-ish object)

---

## Launch & re-run rules

- Auto-launch when: `ONBOARDING_V1` flag ON **and** `af_onboardingState.complete !== true` **and** household has no synced data yet (fresh household heuristic — prevents surprising existing beta users when the flag flips on).
- Existing households when flag flips: mark `af_onboardingState.complete = true` in a one-time migration so nobody gets wizard-ambushed.
- Joiners (second member of an already-complete household): skip wizard; optional future "quick tour" is out of scope.
- Re-run: Settings → "Set up my harbor again" → wizard opens pre-filled from current state (pass current values as `initial*` props), finish merges rather than overwrites (never deletes people or cards).

## Landmines (from RF-0 docs — apply here)

1. **Every component in Onboarding.jsx is module-scope.** This flow is nothing but text inputs — maximum exposure to the focus-loss landmine. No components defined inside other components, ever.
2. **ES2019/Safari-13:** no optional chaining, no nullish coalescing, no async/await, no arrow block bodies in JSX, no spread in JSX style props. The shipped module complies; keep it that way in review.
3. Integration commits follow the pure-move / small-diff discipline. Wizard wiring is one commit; sync key registration is a separate commit.
4. No chained git merges when landing the branch.
5. Never log payload contents (contains names/birthdays) to console or analytics.

## Test plan

- Unit (Vitest, joins the 593): payload assembly per step; conditional step-3 rendering; skip-at-every-step produces valid minimal payload; re-run merge never drops existing people/cards; ES-lint target check passes with 0 esbuild warnings.
- E2E (Playwright, extends Phase C scaffold): fresh-household auto-launch; complete run lands on personalized Today; toggle Meals OFF hides meal questions; focus retention while typing in crew name inputs during a background sync-apply (reuse focus/nav suite pattern).
- Manual: Lindsey + Twyla device pair — Lindsey completes wizard, verify Twyla's device receives `af_onboardingState` and never shows the wizard.

## Sequencing

Blocked behind: RF extraction batches (at minimum the batches touching App shell + settings), Lighthouse GA decision, billing build. This is the final capstone before paid beta. Estimated: one Claude Code session for wiring + one for tests, given the component ships pre-built.
