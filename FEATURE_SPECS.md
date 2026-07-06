# Feature Specs — Unimplemented

Design specs for features that have been scoped but not yet built.
Do not implement without reviewing the spec and confirming approach with the team.

---

## Spec 6d — Bigger Countdowns

**Status:** Spec only. Not implemented.

### Goal

Make countdown items (anniversary, vacation, birthday, event) feel more prominent and
celebration-worthy. Currently they render as compact list rows in Anchor. The request is
for a "big countdown" display mode — a focal, visually rich block for the highest-priority
upcoming countdown when the user is on the home screen.

### Proposed behavior

- When at least one countdown event is within 30 days, show a **hero countdown block**
  at the top of the Anchor tab (above the other sections).
- The block shows: event name, a large day-count (e.g. "12 days"), the event date
  formatted as "Thursday, August 14", and an emoji/icon matching the event type.
- If multiple countdowns are within 30 days, show the nearest one as the hero and
  list the others as compact secondary rows below it.
- Events with 0 days remaining ("Today!") show a celebration state (see Spec 6e).

### Data model

Countdowns are stored in `af_countdowns` (SYNC_KEYS). Existing shape:
```json
{ "id": "...", "name": "Anniversary", "date": "2026-08-14", "emoji": "🎉", "type": "anniversary" }
```
No schema change needed — hero display is purely a rendering change.

### Component placement

Inject a `<CountdownHero />` component at the top of `AnchorSection` (App.jsx ~line 7500).
It reads from `countdowns` state and returns null if no countdown is within 30 days.

### Design notes

- Background: gradient or frosted glass tile, brand navy (#1a2744) with sand accent.
- Day count: large (~4rem), bold, font-family: DM Sans.
- If `window.matchMedia("(prefers-reduced-motion: reduce)").matches`, skip any animation.
- Must not interfere with the "today's focus" block if both are present — show hero above focus.

### Open questions before implementing

1. Should the threshold be 30 days, 60 days, or user-configurable?
2. Should the hero show even if the countdown is months away (just less prominent)?
3. Does "Today!" state trigger a banner, a confetti, or just a styled tile?

---

## Spec 6e — Confetti on School Goal Completion

**Status:** Spec only. Not implemented.

### Goal

When a child completes a school goal in the Lighthouse section, show a brief confetti burst
to make the moment feel celebratory and reinforce the achievement.

### Proposed behavior

- Trigger: the last outstanding school goal for a given subject is toggled to "done", OR
  a kid's full week goal count reaches the weekly target.
- Effect: ~1.5 second confetti burst using a lightweight canvas-based effect (no library dep).
  Particles should use brand palette: sand, sage, rose, and navy.
- The effect renders in a fixed full-viewport overlay (`z-index: 9999`) so it appears
  above all content, then self-removes after the animation.

### Reduced-motion requirement

**CRITICAL:** Check `window.matchMedia("(prefers-reduced-motion: reduce)").matches` before
triggering. If reduced motion is preferred, show a "⭐ Goal achieved!" inline text badge
instead of confetti — no animation.

### Implementation approach

```javascript
function triggerConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Create a <canvas> appended to document.body
  // Animate ~120 particles with gravity and fade-out over 1.5s
  // Remove the canvas element when animation ends
}
```

Particle colors: `["#c8a96e", "#7a9e8e", "#c17f7f", "#1a2744", "#faf8f4"]`

### Trigger site

School goals live in Lighthouse section (App.jsx ~line 9500). The toggle handler
that marks a goal complete is the injection point.

### Open questions before implementing

1. Should confetti trigger per-goal or only on the "all goals done" event?
2. Should the effect work for parents reviewing from the Lighthouse tab, or only
   appear if the child is physically interacting (harder to gate)?
3. Can we reuse this for Tide Pool shell milestones (e.g. first 10 shells earned)?
