# Anchor & Flow — Beta Handoff

_Last updated: 2026-07-29 · build `836202c`_

This is a living snapshot for beta testers — what's working, what's still
rough, and where to send feedback. It is not an engineering doc.

## What's shipped and working

- **Today / Flow dashboards** — daily task list, calendar, dinner plan,
  quick "Up Next" focus, Top 3 priorities, collapsible sections throughout.
- **Anchor Vault** — household systems in one place: Inventory, Home
  Systems, Health, Career, Subscriptions, Celebrations & Gifts, Pets,
  Recurring Reminders, Safe Harbor.
- **Travel** — trip planning with full detail views (packing, itinerary,
  transportation, lodging, reservations, activities, dining, budget,
  documents, notes, emergency info), a Travel Wallet card for passport/TSA/
  loyalty numbers, and an import-from-template packing flow.
- **Cove** — custom and template-based checklists and notes, with a color
  picker for custom lists (swatch picker on create, and on any existing
  list's card in the gallery).
- **Meals, Shopping, Calendar, Exhale (brain dump)** — day-to-day
  household planning tools. Meals now has a Recipes tab (occasion-tagged
  full recipes and simple dishes, with "Import from URL" and manual entry,
  plus linking a recipe to a Celebration's Food & Cake card) — this
  replaces the old recipe-import feature that lived inside Meal Bank.
- **Tide Pool** — kids' chores and rewards tracking.
- **Lighthouse** — homeschool/school tracking (opt-in).
- **Compass** — AI assistant answering questions from your household's own
  data (tasks, calendar, meals); also drives daily briefings and nudges.
- **Onboarding** — guided first-time setup (household basics, rooms/
  features, people, mode).
- **Cross-device sync** — household data syncs via Supabase; local-first
  with a dirty-key queue and pull/push reconciliation.

## Experimental / labeled as such

- **Notifications** — local scheduled reminders (daily briefing, dinner
  prep, event nudges, recurring reminders) plus web push where supported.
  iOS Safari doesn't support native web notifications, so it falls back to
  in-app banners only when the app is open. Treat this as beta-quality —
  delivery timing can be inconsistent across browsers/OS versions.

## Known open issues

- **Two-device sync** — needs a real end-to-end test with two signed-in
  devices on the same household (e.g. Twyla's two devices) to confirm
  conflict resolution behaves as expected under concurrent edits.
- **Icon registry** — an earlier pass fixed all known unregistered icon
  names (`Icon` silently renders nothing for a name it doesn't recognize).
  No live instances remain as of this build; worth a final sweep before
  wider release in case new call sites slipped in.
- **Security review** — auth flows and data-access rules haven't had a
  dedicated pre-launch security pass yet. Required before any paid tier
  ships, not required for the current free beta.

## Feedback

Found a bug, or something feels off? Email **support@anchorandflowapp.com**
with what you were doing and what you expected to happen — screenshots
help a lot.

## Version

- Build stamp: `20260729-035639-76dd9ba`
- Latest commit: `836202c` — "Today tab: collapsible sea-glass cards;
  revert Flow tints"
