// ============================================================================
// Anchor & Flow — Onboarding Wizard ("First Voyage")
// ============================================================================
// Self-contained module. Owns NO persistence: builds a payload and hands it
// to the host via props.onComplete(payload).
//
// Rewritten 2026-08 in response to new-user feedback: the old wizard used
// unfamiliar app-internal jargon ("rooms") and asked for things (multi-store
// chip lists, trash day, Exhale card renaming, a Calm/Busy/Survival pick)
// with no context for why any of it mattered. Now a fixed 5-screen flow —
// no more dynamically-inserted conditional steps whose count/order shifted
// under the user — each screen explains itself in plain language before
// asking for anything.
//
// HOST CONTRACT:
//   <OnboardingWizard
//     initialPeople={[{ name, birthday }]}     // optional, for re-run prefill
//     initialHouseholdName={string}            // optional
//     householdId={string}                     // optional — shown on the
//                                               // last screen with a copy
//                                               // button; omitted gracefully
//                                               // if not yet known
//     onComplete={function (payload) {}}       // required
//     onSkip={function () {}}                  // required — dismiss entirely
//   />
//
// CONSTRAINTS (ES2019 / Safari 13 target — do not violate in edits):
//   - no optional chaining (?.)
//   - no nullish coalescing (??)
//   - no async/await
//   - no arrow block bodies in JSX (all handlers are named functions)
//   - no spread in JSX style props (styles precomputed via Object.assign)
//   - ALL components at module scope (focus-loss landmine)
// ============================================================================

import React, { useState } from 'react';

// ---------------------------------------------------------------------------
// Palette & shared styles
// ---------------------------------------------------------------------------

var NAVY = '#182B45';
var GOLD = '#B08C3D';
var CREAM = '#FDFBF5';
var SEAGLASS = '#2f8f7a';
var SEAGLASS_TINT = '#e7f3ef';
var SEAGLASS_DARK = '#1d6552';
var SAND_BORDER = '#e6e0d2';
var INPUT_BORDER = '#d8d2c4';
var MUTED = '#8a94a3';
var SUBTLE = '#5f6b7d';

var SERIF = "'Cormorant Garamond', serif";
var SANS = "'DM Sans', sans-serif";

var S = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: CREAM, zIndex: 9000, overflowY: 'auto',
    WebkitOverflowScrolling: 'touch', fontFamily: SANS, color: NAVY
  },
  frame: { maxWidth: 480, margin: '0 auto', padding: '28px 22px 40px',
    minHeight: '100%', display: 'flex', flexDirection: 'column' },
  stepLabel: { fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
    color: GOLD, margin: '0 0 4px', fontWeight: 500 },
  title: { fontFamily: SERIF, fontSize: 28, fontWeight: 600,
    margin: '0 0 4px', color: NAVY },
  subtitle: { fontSize: 13, color: SUBTLE, margin: '0 0 20px', lineHeight: 1.5 },
  label: { fontSize: 12, fontWeight: 500, margin: '0 0 5px', display: 'block' },
  input: { background: '#fff', border: '1px solid ' + INPUT_BORDER,
    borderRadius: 8, padding: '9px 11px', fontSize: 14, color: NAVY,
    fontFamily: SANS, width: '100%', boxSizing: 'border-box', outline: 'none' },
  hint: { fontSize: 11, color: MUTED, margin: '4px 0 0' },
  card: { background: '#fff', border: '1px solid ' + SAND_BORDER,
    borderRadius: 12, padding: '11px 13px', marginBottom: 8 },
  cardTitle: { fontFamily: SERIF, fontSize: 17, fontWeight: 600, margin: 0 },
  cardBody: { fontSize: 12, color: SUBTLE, margin: '2px 0 0', lineHeight: 1.45 },
  primaryBtn: { background: NAVY, color: CREAM, border: 'none', borderRadius: 10,
    padding: '13px 16px', fontSize: 14, fontWeight: 500, fontFamily: SANS,
    width: '100%', cursor: 'pointer' },
  ghostBtn: { background: 'transparent', color: SUBTLE, border: 'none',
    padding: '10px 8px', fontSize: 12, fontFamily: SANS, cursor: 'pointer' },
  backBtn: { background: 'transparent', color: SUBTLE,
    border: '1px solid ' + INPUT_BORDER, borderRadius: 10, padding: '13px 18px',
    fontSize: 14, fontFamily: SANS, cursor: 'pointer' },
  footer: { display: 'flex', gap: 10, marginTop: 24, alignItems: 'center' },
  dots: { display: 'flex', gap: 6, justifyContent: 'center', marginTop: 18 },
  addLink: { fontSize: 13, color: SEAGLASS, fontWeight: 500, cursor: 'pointer',
    background: 'transparent', border: 'none', fontFamily: SANS, padding: '6px 0' }
};

// Precomputed variants (no spread in JSX style props).
var S_dotOff = { width: 7, height: 7, borderRadius: '50%', background: INPUT_BORDER };
var S_dotOn = Object.assign({}, S_dotOff, { background: GOLD });
var S_pill = { border: '1px solid ' + INPUT_BORDER, borderRadius: 18,
  padding: '7px 16px', fontSize: 13, background: '#fff', color: NAVY,
  cursor: 'pointer', fontFamily: SANS };
var S_pillOn = Object.assign({}, S_pill, { border: '1px solid ' + SEAGLASS,
  background: SEAGLASS, color: '#fff' });
var S_arrowBtn = { background: 'transparent', border: '1px solid ' + INPUT_BORDER,
  borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: SUBTLE,
  fontSize: 13, fontFamily: SANS, padding: 0 };
var S_iconRow = { display: 'flex', gap: 12, alignItems: 'flex-start',
  background: '#fff', border: '1px solid ' + SAND_BORDER, borderRadius: 12,
  padding: '13px 15px', marginBottom: 10 };
var S_checkboxRow = { display: 'flex', alignItems: 'center', gap: 8,
  padding: '7px 0', fontSize: 13, color: NAVY };

// ---------------------------------------------------------------------------
// Static config
// ---------------------------------------------------------------------------

var STORE_OPTIONS = ['Target', 'Costco', "Sam's Club", 'Walmart', 'Other'];
// Common non-grocery stores — separate multi-select from the single-pick
// grocery StorePicker above. Not "Other" here: a free-text non-grocery store
// is a much rarer need than for groceries, and Settings' "Add store" already
// covers it after onboarding.
var NON_GROCERY_STORE_OPTIONS = ['Target', 'Amazon', 'Walmart', 'Costco', "Sam's Club", 'TJ Maxx'];

var SCHOOL_TYPE_OPTIONS = [
  { value: 'homeschool', label: 'Homeschool',     emoji: '🏠' },
  { value: 'public',     label: 'Public School',  emoji: '🏫' },
  { value: 'private',    label: 'Private School', emoji: '🎓' },
  { value: 'preschool',  label: 'Preschool',      emoji: '🧸' }
];

var PET_KIND_OPTIONS = [
  { value: 'Dog',   label: 'Dog',   emoji: '🐕' },
  { value: 'Cat',   label: 'Cat',   emoji: '🐈' },
  { value: 'Other', label: 'Other', emoji: '🐾' }
];

var MORE_FEATURES = [
  { emoji: '💼', title: 'Track health & careers', body: 'The People hub — appointments, certifications, renewals, one place per person.' },
  { emoji: '🎉', title: 'Celebrations & travel plans', body: 'The Horizon hub — birthdays, countdowns, trips, all the things ahead.' },
  { emoji: '🌊', title: 'Family memories', body: 'Ripples — traditions and rhythms worth repeating, kept somewhere you’ll actually see them again.' }
];

var uidCounter = 0;
function uid() {
  uidCounter += 1;
  return 'ob_' + Date.now().toString(36) + '_' + uidCounter;
}

// Local, self-contained mirror of App.jsx's ageFromBirthday/personIsMinor —
// this module owns no persistence and imports nothing from the host app (see
// header), so "who's a child" is computed independently rather than threaded
// in as a prop.
function ageFromBirthdayLocal(birthday) {
  if (!birthday) { return null; }
  var parts = String(birthday).split('-');
  if (parts.length !== 3) { return null; }
  var by = parseInt(parts[0], 10);
  var bm = parseInt(parts[1], 10) - 1;
  var bd = parseInt(parts[2], 10);
  if (isNaN(by) || isNaN(bm) || isNaN(bd)) { return null; }
  var t = new Date();
  var age = t.getFullYear() - by;
  var md = t.getMonth() - bm;
  if (md < 0 || (md === 0 && t.getDate() < bd)) { age -= 1; }
  return age >= 0 ? age : null;
}
function isMinorLocal(birthday) {
  var age = ageFromBirthdayLocal(birthday);
  return age !== null && age < 18;
}

// ---------------------------------------------------------------------------
// Small shared components (module scope — focus-loss rule)
// ---------------------------------------------------------------------------

function Dots(props) {
  var items = [];
  for (var i = 0; i < props.total; i++) {
    items.push(<span key={i} style={i === props.index ? S_dotOn : S_dotOff} />);
  }
  return <div style={S.dots}>{items}</div>;
}

// Full shell — screens 1 & 2. Continue (+ Back where applicable).
function StepShell(props) {
  return (
    <div style={S.frame}>
      <p style={S.stepLabel}>{'Screen ' + (props.index + 1) + ' of ' + props.total}</p>
      <h1 style={S.title}>{props.title}</h1>
      <p style={S.subtitle}>{props.subtitle}</p>
      <div style={{ flex: 1 }}>{props.children}</div>
      <div style={S.footer}>
        {props.onBack ? (
          <button type="button" style={S.backBtn} onClick={props.onBack}>Back</button>
        ) : null}
        <button type="button" style={S.primaryBtn} onClick={props.onNext}>
          {props.nextLabel || 'Continue'}
        </button>
      </div>
      {props.onSkipAll ? (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <button type="button" style={S.ghostBtn} onClick={props.onSkipAll}>
            {'Skip setup entirely — start with a blank harbor'}
          </button>
        </div>
      ) : null}
      <Dots index={props.index} total={props.total} />
    </div>
  );
}

// Mostly single-button shell — screens 3, 4 & 5. No back, no separate skip:
// the primary button IS "move on," whether that means "later," "got it," or
// "let's go." Screen 3 (StepMore) is the one exception with a real choice
// to offer, via the optional onSecondary/secondaryLabel props below —
// screens 4 & 5 don't pass them, so they render exactly as before.
function InfoShell(props) {
  return (
    <div style={S.frame}>
      <p style={S.stepLabel}>{'Screen ' + (props.index + 1) + ' of ' + props.total}</p>
      <h1 style={S.title}>{props.title}</h1>
      <p style={S.subtitle}>{props.subtitle}</p>
      <div style={{ flex: 1 }}>{props.children}</div>
      <div style={S.footer}>
        {props.onSecondary ? (
          <button type="button" style={S.backBtn} onClick={props.onSecondary}>
            {props.secondaryLabel}
          </button>
        ) : null}
        <button type="button" style={S.primaryBtn} onClick={props.onNext}>
          {props.nextLabel}
        </button>
      </div>
      <Dots index={props.index} total={props.total} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen 1 — Basics
// ---------------------------------------------------------------------------

function CrewRow(props) {
  var person = props.person;
  function handleName(e) { props.onChange(person.id, 'name', e.target.value); }
  function handleBirthday(e) { props.onChange(person.id, 'birthday', e.target.value); }
  function handleRemove() { props.onRemove(person.id); }
  function handleMe() { props.onSetMe(person.id); }
  var rowStyle = { display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' };
  var nameStyle = Object.assign({}, S.input, { flex: 1.2 });
  var dateStyle = Object.assign({}, S.input, { flex: 1, color: person.birthday ? NAVY : MUTED });
  // "This is me" — explicit, not positional. The host defaults to whoever is
  // marked isMe (falling back to the first person if nobody is) when it
  // resolves "who am I" on this device — see App.jsx handleOnboardingComplete.
  var meStyle = {
    flexShrink: 0, padding: '0.4rem 0.55rem', borderRadius: 8, fontSize: 11, fontWeight: 700,
    border: '1.5px solid ' + (person.isMe ? '#c8a97a' : 'rgba(26,39,68,0.15)'),
    background: person.isMe ? 'rgba(200,169,122,0.15)' : 'transparent',
    color: person.isMe ? '#8a6a3a' : MUTED, cursor: 'pointer', whiteSpace: 'nowrap'
  };
  return (
    <div style={rowStyle}>
      <input style={nameStyle} placeholder="Name" value={person.name}
        onChange={handleName} />
      <input style={dateStyle} type="date" value={person.birthday}
        onChange={handleBirthday} aria-label="Birthday" />
      <button type="button" style={meStyle} onClick={handleMe}
        aria-pressed={!!person.isMe} aria-label="This is me">{person.isMe ? '✓ Me' : 'Me?'}</button>
      <button type="button" style={S_arrowBtn} onClick={handleRemove}
        aria-label="Remove">{'×'}</button>
    </div>
  );
}

function StorePicker(props) {
  var d = props.data;
  function pickFactory(name) {
    return function () {
      props.set('groceryStore', name);
      if (name !== 'Other') { props.set('groceryStoreOther', ''); }
    };
  }
  function handleOther(e) { props.set('groceryStoreOther', e.target.value); }
  var rowStyle = { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 };
  return (
    <div>
      <div style={rowStyle}>
        {STORE_OPTIONS.map(function (name) {
          return (
            <button key={name} type="button"
              style={d.groceryStore === name ? S_pillOn : S_pill}
              onClick={pickFactory(name)}>{name}</button>
          );
        })}
      </div>
      {d.groceryStore === 'Other' ? (
        <input style={S.input} placeholder="Where do you shop?"
          value={d.groceryStoreOther} onChange={handleOther} />
      ) : null}
      <p style={S.hint}>We'll use this for your shopping list.</p>
    </div>
  );
}

function NonGroceryStorePicker(props) {
  var d = props.data;
  var selected = d.nonGroceryStores || [];
  function toggleFactory(name) {
    return function () {
      var isOn = selected.indexOf(name) !== -1;
      var next = isOn ? selected.filter(function (s) { return s !== name; }) : selected.concat([name]);
      props.set('nonGroceryStores', next);
    };
  }
  var rowStyle = { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 };
  return (
    <div>
      <div style={rowStyle}>
        {NON_GROCERY_STORE_OPTIONS.map(function (name) {
          var isOn = selected.indexOf(name) !== -1;
          return (
            <button key={name} type="button"
              style={isOn ? S_pillOn : S_pill}
              onClick={toggleFactory(name)}>{name}</button>
          );
        })}
      </div>
      <p style={S.hint}>Tap all that apply — these show up as tabs on your shopping list too.</p>
    </div>
  );
}

function FavMealRow(props) {
  function handleChange(e) { props.onChange(props.idx, e.target.value); }
  return (
    <input style={Object.assign({}, S.input, { marginBottom: 6 })}
      placeholder={'Favorite meal ' + (props.idx + 1) + ' (optional)'}
      value={props.value} onChange={handleChange} />
  );
}

function StepBasics(props) {
  var d = props.data;
  function handleHousehold(e) { props.set('householdName', e.target.value); }
  function handlePersonChange(id, field, value) {
    var next = d.people.map(function (p) {
      if (p.id !== id) { return p; }
      var copy = Object.assign({}, p);
      copy[field] = value;
      return copy;
    });
    props.set('people', next);
  }
  function handlePersonRemove(id) {
    props.set('people', d.people.filter(function (p) { return p.id !== id; }));
  }
  function handleAddPerson() {
    props.set('people', d.people.concat([{ id: uid(), name: '', birthday: '' }]));
  }
  function handleSetMe(id) {
    props.set('people', d.people.map(function (p) {
      return Object.assign({}, p, { isMe: p.id === id });
    }));
  }
  function handleFavMeal(idx, value) {
    var next = d.favMeals.slice();
    next[idx] = value;
    props.set('favMeals', next);
  }
  return (
    <StepShell index={props.index} total={props.total}
      title="Let's get you set up"
      subtitle="To help personalize your experience, we need a few things."
      onNext={props.onNext} onBack={null} onSkipAll={props.onSkipAll}>
      <label style={S.label}>What do you call your family?</label>
      <input style={S.input} placeholder="The Harper Crew"
        value={d.householdName} onChange={handleHousehold} />
      <div style={{ height: 16 }} />
      <label style={S.label}>Your crew</label>
      {d.people.map(function (p) {
        return <CrewRow key={p.id} person={p}
          onChange={handlePersonChange} onRemove={handlePersonRemove} onSetMe={handleSetMe} />;
      })}
      <button type="button" style={S.addLink} onClick={handleAddPerson}>
        + Add another
      </button>
      <div style={{ height: 18 }} />
      <label style={S.label}>Where do you usually grocery shop?</label>
      <StorePicker data={d} set={props.set} />
      <div style={{ height: 18 }} />
      <label style={S.label}>Where else do you often shop?</label>
      <NonGroceryStorePicker data={d} set={props.set} />
      <div style={{ height: 18 }} />
      <label style={S.label}>A couple of favorite meals?</label>
      <p style={S.hint}>{'We’ll add these to your meal bank to make planning easier.'}</p>
      <div style={{ height: 6 }} />
      {[0, 1, 2].map(function (idx) {
        return <FavMealRow key={idx} idx={idx} value={d.favMeals[idx]} onChange={handleFavMeal} />;
      })}
    </StepShell>
  );
}

// ---------------------------------------------------------------------------
// Screen 2 — Your Harbor
// ---------------------------------------------------------------------------

function YesNoRow(props) {
  function handleYes() { props.onChange(true); }
  function handleNo() { props.onChange(false); }
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: props.value !== null ? 10 : 4 }}>
      <button type="button" style={props.value === true ? S_pillOn : S_pill} onClick={handleYes}>Yes</button>
      <button type="button" style={props.value === false ? S_pillOn : S_pill} onClick={handleNo}>No</button>
    </div>
  );
}

function SchoolTypeRow(props) {
  var person = props.person;
  function selectFactory(value) {
    return function () { props.onChange(person.id, value); };
  }
  return (
    <div style={S.card}>
      <p style={S.cardTitle}>{person.name}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {SCHOOL_TYPE_OPTIONS.map(function (opt) {
          return (
            <button key={opt.value} type="button" onClick={selectFactory(opt.value)}
              style={person.schoolType === opt.value ? S_pillOn : S_pill}>
              {opt.emoji + ' ' + opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TreasureChestRow(props) {
  var person = props.person;
  function handleToggle() { props.onChange(person.id, !(person.tidePoolEnabled !== false)); }
  var on = person.tidePoolEnabled !== false;
  return (
    <label style={S_checkboxRow}>
      <input type="checkbox" checked={on} onChange={handleToggle} />
      {person.name}
    </label>
  );
}

function PetRow(props) {
  var pet = props.pet;
  function kindFactory(value) { return function () { props.onChange(pet.id, 'kind', value); }; }
  function handleName(e) { props.onChange(pet.id, 'name', e.target.value); }
  function handleRemove() { props.onRemove(pet.id); }
  return (
    <div style={Object.assign({}, S.card, { marginBottom: 10 })}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {PET_KIND_OPTIONS.map(function (opt) {
          return (
            <button key={opt.value} type="button" onClick={kindFactory(opt.value)}
              style={pet.kind === opt.value ? S_pillOn : S_pill}>
              {opt.emoji + ' ' + opt.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input style={Object.assign({}, S.input, { flex: 1 })} placeholder="Name"
          value={pet.name} onChange={handleName} />
        <button type="button" style={S_arrowBtn} onClick={handleRemove}
          aria-label="Remove pet">{'×'}</button>
      </div>
    </div>
  );
}

function StepHarbor(props) {
  var d = props.data;
  var children = d.people.filter(function (p) {
    return p.name.trim() !== '' && isMinorLocal(p.birthday);
  });
  function handleGoesToSchool(value) {
    props.set('goesToSchool', value);
    if (value === false) {
      // "No" answers the question for every kid — none of them need a
      // per-child type pick. Explicit true/false forced here (not falling
      // through to undefined) so a later "Yes" → "No" change cleanly resets
      // any type already picked, rather than leaving a stale one behind.
      props.set('people', d.people.map(function (p) {
        return isMinorLocal(p.birthday) ? Object.assign({}, p, { schoolType: 'none' }) : p;
      }));
    }
  }
  function handleSchoolTypeChange(id, value) {
    props.set('people', d.people.map(function (p) {
      return p.id === id ? Object.assign({}, p, { schoolType: value }) : p;
    }));
  }
  function handleTreasureChest(value) {
    props.set('wantsTreasureChest', value);
  }
  function handleTreasureChild(id, enabled) {
    props.set('people', d.people.map(function (p) {
      return p.id === id ? Object.assign({}, p, { tidePoolEnabled: enabled }) : p;
    }));
  }
  function handleHasPets(value) {
    props.set('hasPets', value);
    if (value === true && d.pets.length === 0) {
      props.set('pets', [{ id: uid(), kind: 'Dog', name: '' }]);
    }
  }
  function handlePetChange(id, field, value) {
    props.set('pets', d.pets.map(function (p) {
      return p.id === id ? Object.assign({}, p, { [field]: value }) : p;
    }));
  }
  function handlePetRemove(id) {
    props.set('pets', d.pets.filter(function (p) { return p.id !== id; }));
  }
  function handleAddPet() {
    props.set('pets', d.pets.concat([{ id: uid(), kind: 'Dog', name: '' }]));
  }
  return (
    <StepShell index={props.index} total={props.total}
      title="Enhance your Harbor"
      subtitle="A few more things help us set up the right tools for your family."
      onNext={props.onNext} onBack={props.onBack}>
      {children.length > 0 ? (
        <div>
          <label style={S.label}>Do your kids go to school?</label>
          <YesNoRow value={d.goesToSchool} onChange={handleGoesToSchool} />
          {d.goesToSchool === true ? children.map(function (p) {
            return <SchoolTypeRow key={p.id} person={p} onChange={handleSchoolTypeChange} />;
          }) : null}
          <div style={{ height: 18 }} />
          <label style={S.label}>{'Treasure Chest — a reward system for kids'}</label>
          <p style={S.hint}>{'Kids collect shells for chores and cash them in for treasures. Want to set this up?'}</p>
          <div style={{ height: 4 }} />
          <YesNoRow value={d.wantsTreasureChest} onChange={handleTreasureChest} />
          {d.wantsTreasureChest === true ? children.map(function (p) {
            return <TreasureChestRow key={p.id} person={p} onChange={handleTreasureChild} />;
          }) : null}
          <div style={{ height: 18 }} />
        </div>
      ) : null}
      <label style={S.label}>Any pets?</label>
      <YesNoRow value={d.hasPets} onChange={handleHasPets} />
      {d.hasPets === true ? (
        <div>
          {d.pets.map(function (p) {
            return <PetRow key={p.id} pet={p} onChange={handlePetChange} onRemove={handlePetRemove} />;
          })}
          <button type="button" style={S.addLink} onClick={handleAddPet}>
            + Add another pet
          </button>
        </div>
      ) : null}
    </StepShell>
  );
}

// ---------------------------------------------------------------------------
// Screen 3 — There's more (purely informational, no data collected)
// ---------------------------------------------------------------------------

function StepMore(props) {
  function handleTurnOnNow() {
    props.set('wantsMoreFeatures', true);
    props.onNext();
  }
  function handleExploreLater() {
    props.set('wantsMoreFeatures', false);
    props.onNext();
  }
  return (
    <InfoShell index={props.index} total={props.total}
      title="Anchor & Flow can do even more"
      subtitle="These features are available whenever you're ready."
      onNext={handleTurnOnNow} nextLabel={'Turn these on now'}
      onSecondary={handleExploreLater} secondaryLabel={'I’ll explore later'}>
      {MORE_FEATURES.map(function (f, i) {
        return (
          <div key={i} style={S_iconRow}>
            <div style={{ fontSize: 22, lineHeight: '26px' }}>{f.emoji}</div>
            <div style={{ flex: 1 }}>
              <p style={S.cardTitle}>{f.title}</p>
              <p style={S.cardBody}>{f.body}</p>
            </div>
          </div>
        );
      })}
      <p style={S.hint}>You can turn these on anytime in Settings.</p>
    </InfoShell>
  );
}

// ---------------------------------------------------------------------------
// Screen 4 — Your Today (purely informational, no data collected)
// ---------------------------------------------------------------------------

var TODAY_POINTS = [
  { emoji: '🧭', body: 'The Today icon shows your daily summary — what’s on, what’s due, what’s for dinner.' },
  { emoji: '⚡', body: 'Having a busy day? Tap "Busy" to simplify — just the essentials.' },
  { emoji: '🪟', body: 'Really struggling? Tap "Survival" — meals, tasks, and Compass (your AI guide) will adjust to help.' }
];

function StepToday(props) {
  return (
    <InfoShell index={props.index} total={props.total}
      title="Meet your Today view"
      subtitle="Today summarizes your day and shows what matters most."
      onNext={props.onNext} nextLabel="Got it">
      {TODAY_POINTS.map(function (pt, i) {
        return (
          <div key={i} style={S_iconRow}>
            <div style={{ fontSize: 20, lineHeight: '24px' }}>{pt.emoji}</div>
            <p style={Object.assign({}, S.cardBody, { fontSize: 13, margin: 0 })}>{pt.body}</p>
          </div>
        );
      })}
    </InfoShell>
  );
}

// ---------------------------------------------------------------------------
// Screen 5 — Family & save
// ---------------------------------------------------------------------------

function HouseholdCodeCard(props) {
  var codeState = useState(false);
  var copied = codeState[0];
  var setCopied = codeState[1];
  function handleCopy() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(props.householdId || '');
      }
    } catch (e) { /* clipboard API unavailable — copy silently no-ops */ }
    setCopied(true);
    setTimeout(function () { setCopied(false); }, 2000);
  }
  return (
    <div style={Object.assign({}, S.card, { background: SEAGLASS_TINT, border: '1px solid ' + SEAGLASS })}>
      <p style={S.cardTitle}>Household code</p>
      {props.householdId ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1, fontFamily: SERIF, fontSize: 16, fontWeight: 700, color: NAVY, wordBreak: 'break-all' }}>
            {props.householdId}
          </div>
          <button type="button" onClick={handleCopy}
            style={Object.assign({}, S_pill, copied ? { border: '1px solid ' + SEAGLASS, background: SEAGLASS, color: '#fff' } : {})}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      ) : (
        <p style={S.cardBody}>{'Your code will appear here once your harbor finishes setting up — find it anytime in Settings.'}</p>
      )}
      <p style={S.cardBody}>{'Other family members can join by going to Settings → Join Household and pasting this code.'}</p>
    </div>
  );
}

function SaveToPhoneCard() {
  return (
    <div style={S.card}>
      <p style={S.cardTitle}>Save to your phone</p>
      <p style={Object.assign({}, S.cardBody, { marginTop: 8, fontWeight: 600 })}>iPhone</p>
      <p style={S.cardBody}>{'Tap the Share icon in Safari → "Add to Home Screen"'}</p>
      <p style={Object.assign({}, S.cardBody, { marginTop: 8, fontWeight: 600 })}>Android</p>
      <p style={S.cardBody}>{'Tap the menu (⋮) → "Add to Home Screen"'}</p>
    </div>
  );
}

function StepFamily(props) {
  return (
    <InfoShell index={props.index} total={props.total}
      title="This is a family app"
      subtitle=""
      onNext={props.onFinish} nextLabel={'Let’s go!'}>
      <HouseholdCodeCard householdId={props.householdId} />
      <div style={{ height: 12 }} />
      <SaveToPhoneCard />
    </InfoShell>
  );
}

// ---------------------------------------------------------------------------
// Wizard root
// ---------------------------------------------------------------------------

var STEPS = [StepBasics, StepHarbor, StepMore, StepToday, StepFamily];

export function buildInitialData(props) {
  var people;
  if (props.initialPeople && props.initialPeople.length) {
    people = props.initialPeople.map(function (p) {
      var person = { id: uid(), name: p.name || '', birthday: p.birthday || '', schoolType: p.schoolType || '' };
      if (p.tidePoolEnabled === true || p.tidePoolEnabled === false) { person.tidePoolEnabled = p.tidePoolEnabled; }
      return person;
    });
  } else {
    people = [{ id: uid(), name: '', birthday: '' }];
  }
  // Default the first row to "this is me" — matches the host's existing
  // position-0 fallback (App.jsx handleOnboardingComplete) so nothing
  // changes for the common case, but now it's an explicit, visible,
  // user-correctable flag (the "Me?"/"✓ Me" pill on CrewRow) instead of a
  // silent positional guess.
  if (people.length > 0) { people[0] = Object.assign({}, people[0], { isMe: true }); }
  return {
    householdName: props.initialHouseholdName || '',
    people: people,
    groceryStore: '',
    groceryStoreOther: '',
    nonGroceryStores: [],
    favMeals: ['', '', ''],
    goesToSchool: null,
    wantsMoreFeatures: null,
    wantsTreasureChest: null,
    hasPets: null,
    pets: []
  };
}

export function buildPayload(d) {
  var groceryStore = d.groceryStore === 'Other' ? d.groceryStoreOther.trim() : d.groceryStore;
  return {
    householdName: d.householdName.trim(),
    people: d.people
      .filter(function (p) { return p.name.trim() !== ''; })
      .map(function (p) {
        var person = { name: p.name.trim(), birthday: p.birthday, schoolType: p.schoolType || 'none' };
        if (p.tidePoolEnabled === true || p.tidePoolEnabled === false) { person.tidePoolEnabled = p.tidePoolEnabled; }
        if (p.isMe) { person.isMe = true; }
        return person;
      }),
    groceryStore: groceryStore || '',
    nonGroceryStores: d.nonGroceryStores || [],
    favMeals: d.favMeals.filter(function (m) { return m.trim() !== ''; }).map(function (m) { return m.trim(); }),
    moreFeaturesEnabled: d.wantsMoreFeatures === true,
    treasureChestEnabled: d.wantsTreasureChest === true,
    pets: d.pets
      .filter(function (p) { return p.name.trim() !== ''; })
      .map(function (p) { return { kind: p.kind, name: p.name.trim() }; })
  };
}

export default function OnboardingWizard(props) {
  var stateArr = useState(function () { return buildInitialData(props); });
  var data = stateArr[0];
  var setData = stateArr[1];
  var stepArr = useState(0);
  var step = stepArr[0];
  var setStep = stepArr[1];

  function set(field, value) {
    setData(function (prev) {
      var next = Object.assign({}, prev);
      next[field] = value;
      return next;
    });
  }
  function goNext() {
    setStep(function (s) { return Math.min(s + 1, STEPS.length - 1); });
    if (typeof window !== 'undefined') { window.scrollTo(0, 0); }
  }
  function goBack() {
    setStep(function (s) { return Math.max(s - 1, 0); });
    if (typeof window !== 'undefined') { window.scrollTo(0, 0); }
  }
  function finish() {
    props.onComplete(buildPayload(data));
  }
  function skipAll() {
    props.onSkip();
  }

  var Step = STEPS[step];
  return (
    <div style={S.overlay}>
      <Step data={data} set={set}
        index={step} total={STEPS.length}
        onNext={goNext} onBack={step > 0 ? goBack : null}
        onFinish={finish} onSkipAll={step === 0 ? skipAll : null}
        householdId={props.householdId} />
    </div>
  );
}
