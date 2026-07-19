# F-97 — Person Self-Identification ("This is me") — Full Spec
Unblocks F-48 (CalEventFormModal), F-13 (calendar Mine/Twy filter), F-53
(Compass mine/partner split). All four ship as ONE atomic change — per Batch 1's
own hold decision, since responsibleParent's write format and read format must
agree, or new events break the one household where the feature currently works.

**Verified against App.jsx:** `preferredName` is a free-text string
(`useSaved("preferredName","")`, line 3322) used at **6 separate sites**
(5446, 5474, 5517, 5771, 8104, 11865) purely for greeting/closing-day text — it
has zero structural link to `people[]`. `people[]` entries are created at line
1309 with `{id, name, color, birthday, age, role, isMinor}` — no `isSelf`, no
device link. This confirms F-97's original diagnosis: the self-link genuinely
does not exist anywhere in the codebase today.

---

## 1. Data model

**Add one field to each `people[]` entry:**
```js
{ id, name, color, birthday, age, role, isMinor,
  marker: null }   // NEW — { type: "emoji"|"initial", value: string } | null
```

**Add one field to the auth/session layer** — where `myPersonId` actually lives
needs one decision (see §4): either on the `people[]` entry itself
(`isSelf: true`, only one entry per household can have it *per device*, which
doesn't work for shared devices) — **or**, correctly, keyed to the session:

```js
// af_myPersonId — NOT part of people[], NOT part of SYNC_KEYS (see below).
// Device+session-local: "which roster person am I, on THIS sign-in."
localStorage.setItem("af_myPersonId", personId)
```

**Why session-local, not synced:** if two people share a device (a family
tablet), each sign-in should resolve independently. If it were a synced
household-level field, the last person to sign in on ANY device would silently
become "me" for everyone. Session-local is correct here — this is the one
piece of Cluster A's "LOCAL vs SERVER origin" thinking applied to identity
itself: `myPersonId` is inherently per-device-per-session, never a shared fact.

---

## 2. The marker — optional, with a sensible default

Per your decision: **optional at setup, default to first-letter-of-name.**

```js
function personMarker(person) {
  if (person.marker && person.marker.value) return person.marker.value;
  return (person.name || "?").trim().charAt(0).toUpperCase(); // default
}
```

- Setup UI offers a small emoji picker (curated set — reuse whatever library
  F-73's icon audit finds, or a hand-picked ~24-emoji grid; NOT unlimited
  emoji, same reasoning as the audit's calendar-marker guidance) plus a
  manual initial override, both optional.
- **Collision is a soft nudge, not a hard block:** if the marker matches an
  existing person's marker, show "Rylan already uses 🌟 — pick another, or
  keep it" — never prevent saving. The actual code NEVER compares by marker
  (see §5) so a collision is a display ambiguity, not a data-integrity risk.
- Markers display everywhere a person is currently shown as a colored dot/chip
  — calendar pills, Tide Pool kid tabs, CalEventFormModal's "For" list. This is
  additive to F-12's color work, not a replacement.

---

## 3. Sign-in flow

**Trigger: first sign-in on a device where `af_myPersonId` is unset**, OR an
explicit "This is me" entry in Settings (for correcting a wrong pick, or for
shared-device households re-identifying per session).

**UI, inserted right after `AuthScreen`'s `onAuth` succeeds (App.jsx ~12270),
before the household loads normally:**

1. If `af_myPersonId` is already set AND still resolves to a real `people[]`
   entry → skip silently, proceed to normal load.
2. Otherwise, show a lightweight modal: **"Which one are you?"** — list of
   current `people[].filter(p => !p.isMinor)` as tappable cards (name + marker
   + color), plus a "That's not me — I'm new" option that opens the existing
   add-member flow (name/birthday/role) and then links the newly-created
   entry.
3. Selecting a card sets `localStorage.setItem("af_myPersonId", person.id)`
   and closes the modal. No sync key involved — purely local.
4. **Skippable.** A "Skip for now" link proceeds without setting it — the app
   must not block someone from using it because they haven't answered this.
   Anything reading `myPersonId` must handle `null` gracefully (§5).

**Why `!isMinor` in the list:** the sign-in flow authenticates adults (kids
don't have their own Supabase accounts in this model) — filtering avoids an
adult accidentally selecting a child's roster entry as "me."

---

## 4. Migration for existing L/T events

**Confirmed from prior analysis:** `responsibleParent` has exactly one write
site (App.jsx ~11424, the "For"/"Responsible" dropdown), producing only `"L"`
or `"T"` strings. Since the field is otherwise unused by any non-developer
household, the only real data at risk is Lindsey's own household's existing
events.

**One-time, read-time shim** (not a bulk rewrite — matches the "orphan it,
don't force a migration" precedent from F-06's backup-key decision):

```js
// Read-side only. Old string values map to today's roster once "me" is known.
// This shim can be deleted once no calEvents carry "L"/"T" anymore (grep
// af_calEvents for responsibleParent:"L" — if empty, remove this function).
function resolveResponsibleParent(rp, myPersonId, people) {
  if (rp === "L") return /* Lindsey's people[] id — set once, by hand, at deploy */;
  if (rp === "T") return /* Twyla's people[] id — same */;
  return rp; // already a real personId, or null
}
```
Claude Code: at implementation time, look up Lindsey's and Twyla's actual
`people[].id` values from a real export and hardcode them into this shim with
a comment explaining they're legacy literals, not a new hardcoding pattern —
this is explicitly temporary and bounded (F-97's fix, not Cluster B's disease,
because it's data migration for two known historical string values, not a
feature that silently fails for other households).

---

## 5. Wiring F-48 / F-13 / F-53 (the atomic part)

**F-48 — CalEventFormModal (~11414-11424):**
- "For" dropdown: map over `people` (all, kids included — a dentist
  appointment can be for a kid). Value = `person.id`.
- "Responsible" buttons: map over `people.filter(p => !p.isMinor)` (adults
  only, reusing the existing pattern already at App.jsx:8173/8786 — extract to
  one shared helper while touching this, per the earlier F-33-adjacent note).
  Value = `person.id`, written to `responsibleParent`.

**F-13 — calendar Mine/Twy filter (~5965, 6036, 6149, 6200 — the 4 sites the
re-anchor found, not the original 2):**
```js
// OLD: (calFilter==="mine" && e.responsibleParent!=="L") || (calFilter==="twy" && e.responsibleParent!=="T")
// NEW:
var myId = localStorage.getItem("af_myPersonId");
var _dimmed = (calFilter==="mine" && myId && e.responsibleParent!==myId)
           || (calFilter==="mine" && !myId)   // no self set → "Mine" can't filter meaningfully; don't dim anything as a guess
           || (calFilter==="twy" && e.responsibleParent===myId); // crude "not-me" for the partner filter; see note
```
**Design note to resolve at implementation, not guessed here:** with 2+ adults
and real ids (not just L/T), "Twy filter" as a concept needs to become "filter
by any OTHER specific adult," not a hardcoded second slot. Minimal viable:
keep two filter pills (Mine / Partner) where "Partner" means "any adult who
isn't me" for now; a proper multi-adult picker is a future enhancement, not
in scope for F-97's close.

**F-53 — Compass mine/partner split (compassEngine.js ~123-127):**
```js
// state must carry myPersonId (pass it in from wherever buildCompassContext
// is called — App.jsx already has af_myPersonId in localStorage; read it
// into state alongside preferredName, same pattern).
ctx.events_today_mine = _todaySlim.filter(function(e) {
  return state.myPersonId ? e.responsibleParent === state.myPersonId : false;
});
ctx.events_today_partner = _todaySlim.filter(function(e) {
  return state.myPersonId ? e.responsibleParent && e.responsibleParent !== state.myPersonId : false;
});
// If myPersonId is unset, both arrays are empty rather than guessing — an
// empty "mine" is honest; a wrong guess (e.g. defaulting to "L") is not.
```
Remove the F-13/F-53 hold-comment Batch 2 planted at compassEngine.js ~124
(Fix 5) once this lands — it was placed exactly here for this purpose.

---

## 6. What does NOT change

- `af_myPersonId` is **not added to SYNC_KEYS** — deliberately local (§1).
- `preferredName` stays as-is for greeting text — it's a display string, not
  an identity link, and the two can coexist (someone's greeting name and their
  roster link don't have to be the same value).
- F-12's color derivation is untouched — markers are additive, not a
  replacement for the color system.

---

## 7. Claude Code prompt (paste when ready to build)

```
Task: F-97 — implement per docs/F-97-spec.md. Branch: fix-f97. VERIFY BEFORE
EDITING — this spec makes claims about exact line numbers and existing patterns
(MINOR_ROLES filter at 8173/8786, the "For"/"Responsible" dropdown at
~11414-11424, the 4 dimming sites at 5965/6036/6149/6200) that may have shifted
since the spec was written. Re-locate each by content, confirm before changing.

1. Add `marker` to people[] entries (§2) with the default-to-initial function.
2. Build the sign-in "Which one are you?" modal (§3) — skippable, adults-only
   list, sets af_myPersonId locally, no sync key.
3. Look up Lindsey's and Twyla's real people[].id from a fresh export (ask me
   for it if you don't have one) and write the L/T migration shim (§4) with
   those two literal ids, clearly commented as legacy/temporary.
4. Wire F-48, F-13, F-53 together (§5) — all four sites, one PR, one commit.
   Do NOT ship F-48's write-side without F-13/F-53's read-side, or vice versa
   — that recreates the exact bug this hold was protecting against.
5. Extract the MINOR_ROLES adult-filter (currently duplicated at 8173 and
   8786) to one shared function while you're touching this logic anyway.
6. ES2019, pure additions where possible. Run npx vitest run (current baseline
   — check what HEAD's count is before you start). Full diff. Do NOT commit.

This is a design-decision-heavy spec, not a mechanical one — flag anything in
here that reads wrong once you're looking at the real, current code.
```

## Test matrix (two devices, both signed in as different people)

1. Fresh sign-in on Device A (never set myPersonId) → "Which one are you?"
   appears → select → modal closes → doesn't reappear on next load
2. Skip the modal → app still fully usable → Mine filter shows nothing dimmed
   (honest empty, not a wrong guess)
3. Create an event, assign "Responsible: Twyla" → on Twyla's device, "Mine"
   filter correctly un-dims it
4. Old "L"-tagged event still displays correctly under the migration shim
5. Compass forecast's mine/partner split matches the calendar's own split for
   the same day
6. A new household (fresh export, no L/T legacy) never hits the migration
   shim at all — confirm it's inert for them

---

## 5b. Greeting & "you"-facing text must read from myPersonId, not preferredName (ADDENDUM)

**Confirmed live bug, found during testing:** `preferredName` is currently a
SINGLE shared household string (`useSaved("preferredName","")`) — not
per-person. Whoever last typed into that Settings field sets it for **every
person who signs into this household, on every device.** Observed directly:
Twyla opened the app and was greeted "Good afternoon, Mama boss" — someone
else's self-description, applied to Twyla, because it's one shared field.

**This is not a new problem F-97 creates — it's an existing bug F-97 is
positioned to fix, and must, or "Mama boss" keeps happening after F-97 ships.**
A household could correctly filter calendars by person while still being
greeted by the wrong name — which undermines trust in the whole feature.

**Fix — once `af_myPersonId` resolves, prefer the identified person's real
`people[].name` over `preferredName` at every greeting/self-reference site.**
`preferredName` becomes the fallback ONLY for the pre-identification window
(before the "Which one are you?" modal resolves, or if skipped).

**One helper, six call-site swaps — all verified against current App.jsx:**

```js
function myDisplayName(people, myPersonId, preferredName, authUser) {
  if (myPersonId) {
    var me = (people || []).find(function(p) { return p.id === myPersonId; });
    if (me && me.name) return me.name;
  }
  return preferredName || (authUser && authUser.displayName ? authUser.displayName.split(" ")[0] : "");
}
```

| Site | App.jsx (approx) | What it does today | Replace with |
|---|---|---|---|
| 1 | ~5446 | FlowHome greeting, inline IIFE reading preferredName/authUser | `myDisplayName(people, myPersonId, preferredName, authUser)` |
| 2 | ~5474 | Second greeting variant, same pattern | same helper |
| 3 | ~5517 | Wind-down-day card greeting, same pattern | same helper |
| 4 | ~5771 | TodayBriefing's `userName` prop, same pattern | myDisplayName(...) passed as the prop value |
| 5 | ~8104 | BrainTab default-tab logic — does its OWN string match: finds a people[] entry by `name === myName` to pick which tab opens by default | Replace the WHOLE lookup, not just the name source: `var myPerson = myPersonId ? people.find(function(p){return p.id===myPersonId;}) : null; if (myPerson) return "person_"+myPerson.id;` — drops string-matching entirely |
| 6 | ~11865 | SunsetClose's `closerName`, same pattern | myDisplayName(...) |

**Site 5 is the one to be most careful with** — it isn't a greeting, it's using
name-matching to SELECT UI STATE (which brain-dump tab opens by default). This
is exactly the bug class F-97 exists to kill, found in a location the original
greeting-text search didn't catch because its purpose isn't display text.
Claude Code: re-grep `preferredName` across the whole file at implementation
time rather than trusting this table as exhaustive — this same file already
demonstrated once that a targeted grep undercounts (F-13 was "2 sites" in the
original audit, turned out to be 4 on re-anchor).

**Keep `preferredName`, scoped narrower, don't delete it or its Settings UI:**
it remains the fallback display name only for the pre-identification window.
Once `myPersonId` is set, it's simply unused by these six sites. Someone who
skips identification still deserves a personalized greeting from something.

**Add to the test matrix:** sign in as Twyla on a device where Lindsey
previously typed something into `preferredName` → confirm the greeting says
"Twyla," not the stale shared string.
