# Ripples — The Family Story Engine
*Product roadmap & emotional spec — Lindsey, June 12, 2026*

## Why Ripples is the moat
Nobody else in the category does both *"help me run my family today"* AND *"help me remember our life."* Ripples is where Anchor & Flow becomes something people keep for years instead of months. Next product work goes here — not another vault feature, not another planner feature.

## Locked design decisions (June 12, 2026)
- **Sunset:** locked. Gradient close-the-day screen, 9.7/10 — "the house is quiet, the day is done."
- **Ripples teal:** locked (bright tune: `#3E8B91 → #2B7378 → #1E5B63`). The richest room.
- **Today navy:** locked, 9.5/10. Coffee, morning light, getting your bearings.
- **Flow:** 9.3/10. Fine-tune only — more sea-glass, never another dashboard. Open windows, ocean breeze.
- **Anchor:** 9.1/10. **Denim is the winner** — not teal, not cream. Built-in bookshelves, family binder. Fine-tune sea-glass interactions only.
- Gold stays the CTA/action color everywhere; sea-glass is the location/interaction color.

## Room emotional jobs
| Room | Emotion | Feeling |
|---|---|---|
| 🧭 Today | Focus, clarity, confidence | "Okay. What matters?" |
| 🌊 Flow | Breathing room | "I've got room." |
| 🏠 Anchor | Stability | "Important things live here." |
| 🌀 Ripples | Meaning | The family's story |
| 🌅 Sunset | Peace | Gather what mattered, release the rest |

## Ripples build phases
**V1 — Timeline (mockup structure).** Inner tabs: Timeline · Kid Quotes · Recaps · Yearbook. "On This Day" strip, dotted timeline with Milestone/Memory/Win/Learning tags, stats column, daily Compass ripple prompt, quick-add chips. Runs on existing `af_ripples` data (`{id, name, who, category, date, note}`).

**V2 — Month Recap (FIRST PRIORITY per Lindsey).** One button: *Generate Month Recap*. Compass synthesizes the month's ripples + milestones + trips into a narrative recap. Lives in the Recaps tab. Requires a new Compass prompt (`getMonthRecap`) in `src/compass/`.

**V3 — Family Storybooks.** Compass-composed books ("Rylan's First Grade," "Summer 2026") from photos, milestones, quotes, memories. PDF export → printed book. **Premium-tier magic.**

**V4 — Memory Prompts.** Compass notices capture gaps ("no memories in 3 weeks") and asks tiny, low-effort, high-return questions. Note: Sunset's "Save a Ripple" (shipped June 12) is the first prompt surface.

**V5 — Family Legacy (years out).** "Tell me about Rylan when he was 7" — Compass searches milestones, photos, memories, homeschool records and answers. Not a planner. A family archive.

## Next session needs
To build V1 + V2: upload fresh exports of `AnchorVault.jsx`, `src/compass/compassEngine.js`, and `src/compass/compassPrompts.js`. Recap generation should respect the AI-cost work (cached once per month per the existing `compassCache` pattern) and ride along with the background-AI audit (4 uncached call sites / 429s) still open from the June 11 handoff.
