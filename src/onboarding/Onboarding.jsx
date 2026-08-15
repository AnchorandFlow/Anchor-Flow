// ============================================================================
// Anchor & Flow — Onboarding Wizard ("First Voyage")
// ============================================================================
// Self-contained module. Owns NO persistence: builds a payload and hands it
// to the host via props.onComplete(payload). See docs/OB-0-onboarding-plan.md
// for the payload contract and sync-key mapping.
//
// HOST CONTRACT:
//   <OnboardingWizard
//     initialPeople={[{ name, birthday }]}     // optional, for re-run prefill
//     initialHouseholdName={string}            // optional
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
var S_chip = Object.assign({}, S_pill, { padding: '6px 13px', fontSize: 12 });
var S_chipOn = Object.assign({}, S_chip, { border: '1px solid ' + SEAGLASS,
  background: SEAGLASS_TINT, color: SEAGLASS_DARK });
var S_day = { width: 36, height: 36, borderRadius: '50%',
  border: '1px solid ' + INPUT_BORDER, background: '#fff', color: NAVY,
  fontSize: 12, cursor: 'pointer', fontFamily: SANS, padding: 0 };
var S_dayOn = Object.assign({}, S_day, { border: '1px solid ' + GOLD,
  background: GOLD, color: '#fff' });
var S_modeCard = Object.assign({}, S.card, { cursor: 'pointer',
  padding: '13px 15px' });
var S_modeCardOn = Object.assign({}, S_modeCard,
  { border: '2px solid ' + SEAGLASS, padding: '12px 14px' });
var S_modeTitleOn = Object.assign({}, S.cardTitle, { color: SEAGLASS_DARK });
var S_toggleRow = Object.assign({}, S.card,
  { display: 'flex', gap: 12, alignItems: 'flex-start' });
var S_exCard = Object.assign({}, S.card,
  { display: 'flex', gap: 8, alignItems: 'center' });
var S_exInput = Object.assign({}, S.input, { flex: 1, border: '1px solid transparent',
  background: 'transparent', padding: '6px 8px' });
var S_arrowBtn = { background: 'transparent', border: '1px solid ' + INPUT_BORDER,
  borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: SUBTLE,
  fontSize: 13, fontFamily: SANS, padding: 0 };

// ---------------------------------------------------------------------------
// Static config
// ---------------------------------------------------------------------------

var FEATURE_DEFS = [
  { key: 'tidePool', emoji: '\uD83D\uDC1A', name: 'Tide Pool', on: true,
    body: 'Chores and treasures for your kids \u2014 they collect shells to open their treasure box. Set your own, too.' },
  { key: 'lighthouse', emoji: '\uD83D\uDCD6', name: 'Lighthouse', on: true,
    body: 'One place for family learning \u2014 school activities, homeschool plans, reading challenges, and more.' },
  { key: 'celebrations', emoji: '\uD83C\uDF89', name: 'Celebrations', on: false,
    body: 'Birthdays and countdowns, remembered for you.' },
  { key: 'meals', emoji: '\uD83C\uDF7D\uFE0F', name: 'Meals', on: true,
    body: 'Plan dinners (and more) without the 5 PM scramble.' },
  { key: 'career', emoji: '\uD83D\uDCBC', name: 'Career', on: false,
    body: 'Work schedules, certifications, and renewals.' },
  { key: 'safeHarbor', emoji: '\u2693', name: 'Safe Harbor', on: false,
    body: 'Emergency plans and vital info, ready when you need them.' }
];

var DAYS = [
  { key: 'sun', label: 'S' }, { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' }, { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' }, { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' }
];

var MODES = [
  { key: 'calm', name: 'Calm',
    body: 'Full sails. Everything on deck \u2014 plans, chores, learning.' },
  { key: 'busy', name: 'Busy',
    body: "Just the essentials. Top priorities and today's must-dos." },
  { key: 'survival', name: 'Survival',
    body: "Bare minimum, zero guilt. We'll hold the rest for later." }
];

var DEFAULT_EXHALE = [
  { title: 'Groceries' },
  { title: 'Call the dentist' },
  { title: 'That thing I keep forgetting' }
];

function defaultFeatures() {
  var out = {};
  for (var i = 0; i < FEATURE_DEFS.length; i++) {
    out[FEATURE_DEFS[i].key] = FEATURE_DEFS[i].on;
  }
  return out;
}

var uidCounter = 0;
function uid() {
  uidCounter += 1;
  return 'ob_' + Date.now().toString(36) + '_' + uidCounter;
}

// Local, self-contained mirror of App.jsx's ageFromBirthday/personIsMinor —
// this module owns no persistence and imports nothing from the host app (see
// header), so "who's a child" for StepInSchool is computed independently
// rather than threaded in as a prop.
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

function Toggle(props) {
  var on = props.on;
  var trackStyle = {
    width: 40, height: 23, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
    background: on ? SEAGLASS : '#c9c3b5', position: 'relative',
    border: 'none', padding: 0, transition: 'background 0.15s'
  };
  var knobStyle = {
    position: 'absolute', top: 2.5, width: 18, height: 18, borderRadius: '50%',
    background: '#fff', left: on ? 19 : 2.5, transition: 'left 0.15s'
  };
  function handleClick() { props.onChange(!on); }
  return (
    <button type="button" style={trackStyle} onClick={handleClick}
      aria-pressed={on} aria-label={props.label}>
      <span style={knobStyle} />
    </button>
  );
}

function Dots(props) {
  var items = [];
  for (var i = 0; i < props.total; i++) {
    items.push(<span key={i} style={i === props.index ? S_dotOn : S_dotOff} />);
  }
  return <div style={S.dots}>{items}</div>;
}

function StepShell(props) {
  return (
    <div style={S.frame}>
      <p style={S.stepLabel}>{'Step ' + (props.index + 1) + ' of ' + props.total}</p>
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
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <button type="button" style={S.ghostBtn} onClick={props.onSkip}>
          {props.skipLabel || 'Skip for now \u2014 you can change this anytime in Settings'}
        </button>
      </div>
      <Dots index={props.index} total={props.total} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Harbor basics
// ---------------------------------------------------------------------------

function CrewRow(props) {
  var person = props.person;
  function handleName(e) { props.onChange(person.id, 'name', e.target.value); }
  function handleBirthday(e) { props.onChange(person.id, 'birthday', e.target.value); }
  function handleRemove() { props.onRemove(person.id); }
  var rowStyle = { display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' };
  var nameStyle = Object.assign({}, S.input, { flex: 1.2 });
  var dateStyle = Object.assign({}, S.input, { flex: 1, color: person.birthday ? NAVY : MUTED });
  return (
    <div style={rowStyle}>
      <input style={nameStyle} placeholder="Name" value={person.name}
        onChange={handleName} />
      <input style={dateStyle} type="date" value={person.birthday}
        onChange={handleBirthday} aria-label="Birthday" />
      <button type="button" style={S_arrowBtn} onClick={handleRemove}
        aria-label="Remove">{'\u00D7'}</button>
    </div>
  );
}

function StepBasics(props) {
  var d = props.data;
  function handleHousehold(e) { props.set('householdName', e.target.value); }
  function handleZip(e) {
    var v = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
    props.set('zip', v);
  }
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
  var zipStyle = Object.assign({}, S.input, { width: 120 });
  return (
    <StepShell index={props.index} total={props.total}
      title="Let's build your harbor"
      subtitle="A few basics so the app feels like yours from day one."
      onNext={props.onNext} onBack={null} onSkip={props.onSkipAll}
      skipLabel={'Skip setup entirely \u2014 start with a blank harbor'}>
      <label style={S.label}>Household name</label>
      <input style={S.input} placeholder="The Harper Crew"
        value={d.householdName} onChange={handleHousehold} />
      <div style={{ height: 16 }} />
      <label style={S.label}>Your crew</label>
      {d.people.map(function (p) {
        return <CrewRow key={p.id} person={p}
          onChange={handlePersonChange} onRemove={handlePersonRemove} />;
      })}
      <button type="button" style={S.addLink} onClick={handleAddPerson}>
        + Add another
      </button>
      <div style={{ height: 14 }} />
      <label style={S.label}>Zip code</label>
      <input style={zipStyle} inputMode="numeric" placeholder="84044"
        value={d.zip} onChange={handleZip} />
      <p style={S.hint}>{'For weather and local rhythms \u2014 never shared.'}</p>
    </StepShell>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Choose your rooms
// ---------------------------------------------------------------------------

function FeatureCard(props) {
  var def = props.def;
  var on = props.on;
  var style = on ? S_toggleRow : Object.assign({}, S_toggleRow, { opacity: 0.65 });
  function handleChange(next) { props.onChange(def.key, next); }
  return (
    <div style={style}>
      <div style={{ fontSize: 20, lineHeight: '24px' }}>{def.emoji}</div>
      <div style={{ flex: 1 }}>
        <p style={S.cardTitle}>{def.name}</p>
        <p style={S.cardBody}>{def.body}</p>
      </div>
      <Toggle on={on} onChange={handleChange} label={def.name} />
    </div>
  );
}

function StepRooms(props) {
  var d = props.data;
  function handleFeature(key, value) {
    var next = Object.assign({}, d.features);
    next[key] = value;
    props.set('features', next);
  }
  return (
    <StepShell index={props.index} total={props.total}
      title="Choose your rooms"
      subtitle="Turn on what fits your family. Change anytime in Settings."
      onNext={props.onNext} onBack={props.onBack} onSkip={props.onNext}>
      {FEATURE_DEFS.map(function (def) {
        return <FeatureCard key={def.key} def={def}
          on={d.features[def.key]} onChange={handleFeature} />;
      })}
    </StepShell>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Tune the details (conditional on step 2)
// ---------------------------------------------------------------------------

function StoreChips(props) {
  var stores = props.stores;
  var draft = props.draft;
  function handleDraft(e) { props.setDraft(e.target.value); }
  function commit() {
    var v = draft.trim();
    if (!v) { return; }
    if (stores.indexOf(v) === -1) { props.setStores(stores.concat([v])); }
    props.setDraft('');
  }
  function handleKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
  }
  function handleRemoveFactory(name) {
    return function () {
      props.setStores(stores.filter(function (s) { return s !== name; }));
    };
  }
  var rowStyle = { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' };
  var addInputStyle = Object.assign({}, S.input, { width: 130, padding: '6px 10px', fontSize: 12 });
  return (
    <div style={rowStyle}>
      {stores.map(function (name) {
        return (
          <button key={name} type="button" style={S_chipOn}
            onClick={handleRemoveFactory(name)}
            aria-label={'Remove ' + name}>{name + ' \u00D7'}</button>
        );
      })}
      <input style={addInputStyle} placeholder="+ Add a store" value={draft}
        onChange={handleDraft} onKeyDown={handleKey} onBlur={commit} />
    </div>
  );
}

function StepDetails(props) {
  var d = props.data;
  var mealsOn = d.features.meals;
  function mealsFactory(n) {
    return function () { props.set('mealsPerDay', n); };
  }
  function dayFactory(key) {
    return function () { props.set('trashDay', d.trashDay === key ? '' : key); };
  }
  function setStores(next) { props.set('stores', next); }
  function setDraft(next) { props.set('storeDraft', next); }
  var pillRow = { display: 'flex', gap: 8, marginBottom: 20 };
  var dayRow = { display: 'flex', gap: 6, marginBottom: 6 };
  return (
    <StepShell index={props.index} total={props.total}
      title="Tune the details"
      subtitle="Just for the rooms you turned on."
      onNext={props.onNext} onBack={props.onBack} onSkip={props.onNext}>
      {mealsOn ? (
        <div>
          <label style={S.label}>Meals to plan each day</label>
          <div style={pillRow}>
            {[1, 2, 3].map(function (n) {
              return (
                <button key={n} type="button"
                  style={d.mealsPerDay === n ? S_pillOn : S_pill}
                  onClick={mealsFactory(n)}>{n}</button>
              );
            })}
          </div>
          <label style={S.label}>Stores you shop most</label>
          <StoreChips stores={d.stores} draft={d.storeDraft}
            setStores={setStores} setDraft={setDraft} />
          <div style={{ height: 20 }} />
        </div>
      ) : null}
      <label style={S.label}>Trash day</label>
      <div style={dayRow}>
        {DAYS.map(function (day) {
          return (
            <button key={day.key} type="button"
              style={d.trashDay === day.key ? S_dayOn : S_day}
              onClick={dayFactory(day.key)}
              aria-label={day.key}>{day.label}</button>
          );
        })}
      </div>
      <p style={S.hint}>We'll nudge you the night before in Sunset.</p>
    </StepShell>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Meet Exhale (interactive mini-tutorial)
// ---------------------------------------------------------------------------

function ExhaleCardRow(props) {
  var card = props.card;
  function handleTitle(e) { props.onRename(props.idx, e.target.value); }
  function handleUp() { props.onMove(props.idx, -1); }
  function handleDown() { props.onMove(props.idx, 1); }
  return (
    <div style={S_exCard}>
      <input style={S_exInput} value={card.title} onChange={handleTitle}
        aria-label="Card title" />
      <button type="button" style={S_arrowBtn} onClick={handleUp}
        disabled={props.idx === 0} aria-label="Move up">{'\u2191'}</button>
      <button type="button" style={S_arrowBtn} onClick={handleDown}
        disabled={props.idx === props.count - 1} aria-label="Move down">{'\u2193'}</button>
    </div>
  );
}

function StepExhale(props) {
  var d = props.data;
  function handleRename(idx, value) {
    var next = d.exhaleCards.map(function (c, i) {
      if (i !== idx) { return c; }
      return Object.assign({}, c, { title: value });
    });
    props.set('exhaleCards', next);
  }
  function handleMove(idx, dir) {
    var to = idx + dir;
    if (to < 0 || to >= d.exhaleCards.length) { return; }
    var next = d.exhaleCards.slice();
    var tmp = next[idx];
    next[idx] = next[to];
    next[to] = tmp;
    props.set('exhaleCards', next);
  }
  return (
    <StepShell index={props.index} total={props.total}
      title="Empty your head"
      subtitle={'Exhale is your brain-dump. Tap a title to rename it, use the arrows to reorder. These cards are real \u2014 they\u2019ll be waiting in Exhale.'}
      onNext={props.onNext} onBack={props.onBack} onSkip={props.onNext}>
      {d.exhaleCards.map(function (card, idx) {
        return <ExhaleCardRow key={idx} card={card} idx={idx}
          count={d.exhaleCards.length} onRename={handleRename} onMove={handleMove} />;
      })}
    </StepShell>
  );
}

// ---------------------------------------------------------------------------
// Step (conditional) — Set birthdays. Only shown for anyone who left the
// birthday field blank back in StepBasics (it's optional there) — this is a
// follow-up nudge, not the first place birthdays are asked. Feeds Fix 1's
// birthday-celebration auto-seeding on the host side.
// ---------------------------------------------------------------------------

function BirthdayPromptRow(props) {
  var person = props.person;
  function handleChange(e) { props.onChange(person.id, e.target.value); }
  var dateStyle = Object.assign({}, S.input, { flex: 1 });
  var nameStyle = { flex: 1.2, fontSize: 13, fontWeight: 500, color: NAVY };
  var rowStyle = { display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' };
  return (
    <div style={rowStyle}>
      <div style={nameStyle}>{person.name}</div>
      <input style={dateStyle} type="date" value={person.birthday}
        onChange={handleChange} aria-label={person.name + ' birthday'} />
    </div>
  );
}

function StepBirthdays(props) {
  var d = props.data;
  var missing = d.people.filter(function (p) { return p.name.trim() !== '' && !p.birthday; });
  function handleChange(id, value) {
    var next = d.people.map(function (p) {
      return p.id === id ? Object.assign({}, p, { birthday: value }) : p;
    });
    props.set('people', next);
  }
  return (
    <StepShell index={props.index} total={props.total}
      title="Set birthdays"
      subtitle={'We’ll remember these for you — birthday celebrations show up automatically once they’re in.'}
      onNext={props.onNext} onBack={props.onBack} onSkip={props.onNext}>
      {missing.map(function (p) {
        return <BirthdayPromptRow key={p.id} person={p} onChange={handleChange} />;
      })}
    </StepShell>
  );
}

// ---------------------------------------------------------------------------
// Step (conditional) — How does each child learn right now? Same 5-option
// schoolType used by Settings' School section (App.jsx) — "homeschool" |
// "public" | "private" | "preschool" | "none" — replacing the old binary
// "in school" toggle. Only offered for people the birthday already marks as a
// minor — someone who skipped StepBirthdays entirely won't show up here
// (nothing to detect them by), which is why StepBirthdays runs first.
// ---------------------------------------------------------------------------

var SCHOOL_TYPE_OPTIONS = [
  { value: 'homeschool', label: 'Homeschool',      emoji: '\uD83C\uDFE0' },
  { value: 'public',     label: 'Public School',   emoji: '\uD83C\uDFEB' },
  { value: 'private',    label: 'Private School',  emoji: '\uD83C\uDF93' },
  { value: 'preschool',  label: 'Preschool',       emoji: '\uD83E\uDDF8' },
  { value: 'none',       label: 'Not school-age',  emoji: '\uD83D\uDC76' }
];

function SchoolTypePill(props) {
  function handleClick() { props.onSelect(props.option.value); }
  return (
    <button type="button" onClick={handleClick} style={props.selected ? S_pillOn : S_pill}>
      {props.option.emoji + ' ' + props.option.label}
    </button>
  );
}

function SchoolTypeRow(props) {
  var person = props.person;
  function handleSelect(value) { props.onChange(person.id, value); }
  return (
    <div style={S.card}>
      <p style={S.cardTitle}>{'How does ' + person.name + ' learn right now?'}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {SCHOOL_TYPE_OPTIONS.map(function (opt) {
          return <SchoolTypePill key={opt.value} option={opt}
            selected={person.schoolType === opt.value} onSelect={handleSelect} />;
        })}
      </div>
    </div>
  );
}

function StepSchoolType(props) {
  var d = props.data;
  var children = d.people.filter(function (p) {
    return p.name.trim() !== '' && isMinorLocal(p.birthday);
  });
  function handleChange(id, value) {
    var next = d.people.map(function (p) {
      return p.id === id ? Object.assign({}, p, { schoolType: value }) : p;
    });
    props.set('people', next);
  }
  return (
    <StepShell index={props.index} total={props.total}
      title="How do your kids learn?"
      subtitle="This shapes what Lighthouse shows for each child. Change anytime in Settings."
      onNext={props.onNext} onBack={props.onBack} onSkip={props.onNext}>
      {children.map(function (p) {
        return <SchoolTypeRow key={p.id} person={p} onChange={handleChange} />;
      })}
    </StepShell>
  );
}

// ---------------------------------------------------------------------------
// Step (conditional) — Per-child Tide Pool opt-in. Same gating as
// StepSchoolType (children only, skipped entirely if there are none), and
// always runs right after it. "Maybe later" deliberately clears the field
// rather than writing a value — that's the existing default (every kid gets
// Tide Pool) so picking it can't regress anyone relative to skipping this
// step entirely.
// ---------------------------------------------------------------------------

var TIDE_POOL_OPTIONS = [
  { value: true,  label: 'Yes, set it up' },
  { value: null,  label: 'Maybe later' },
  { value: false, label: 'No, hide it' }
];

function TidePoolPill(props) {
  function handleClick() { props.onSelect(props.option.value); }
  return (
    <button type="button" onClick={handleClick} style={props.selected ? S_pillOn : S_pill}>
      {props.option.label}
    </button>
  );
}

function TidePoolRow(props) {
  var person = props.person;
  function handleSelect(value) { props.onChange(person.id, value); }
  var current = person.tidePoolEnabled === true ? true
    : (person.tidePoolEnabled === false ? false : null);
  return (
    <div style={S.card}>
      <p style={S.cardTitle}>{'Would you like to use Tide Pool with ' + person.name + '?'}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {TIDE_POOL_OPTIONS.map(function (opt) {
          return <TidePoolPill key={String(opt.value)} option={opt}
            selected={current === opt.value} onSelect={handleSelect} />;
        })}
      </div>
    </div>
  );
}

function StepTidePool(props) {
  var d = props.data;
  var children = d.people.filter(function (p) {
    return p.name.trim() !== '' && isMinorLocal(p.birthday);
  });
  function handleChange(id, value) {
    var next = d.people.map(function (p) {
      if (p.id !== id) { return p; }
      var copy = Object.assign({}, p);
      if (value === null) { delete copy.tidePoolEnabled; } else { copy.tidePoolEnabled = value; }
      return copy;
    });
    props.set('people', next);
  }
  return (
    <StepShell index={props.index} total={props.total}
      title="Tide Pool for your kids"
      subtitle="Chores and treasures, kid by kid. Change anytime in Settings."
      onNext={props.onNext} onBack={props.onBack} onSkip={props.onNext}>
      {children.map(function (p) {
        return <TidePoolRow key={p.id} person={p} onChange={handleChange} />;
      })}
    </StepShell>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Pick your mode
// ---------------------------------------------------------------------------

function ModeCard(props) {
  var selected = props.selected;
  function handleClick() { props.onSelect(props.mode.key); }
  return (
    <div style={selected ? S_modeCardOn : S_modeCard} onClick={handleClick}
      role="button" tabIndex={0} aria-pressed={selected}>
      <p style={selected ? S_modeTitleOn : S.cardTitle}>{props.mode.name}</p>
      <p style={S.cardBody}>{props.mode.body}</p>
    </div>
  );
}

function StepMode(props) {
  var d = props.data;
  function handleSelect(key) { props.set('mode', key); }
  return (
    <StepShell index={props.index} total={props.total}
      title="How's today feeling?"
      subtitle="Your mode shapes what the app asks of you. Change it any morning."
      onNext={props.onFinish} onBack={props.onBack} onSkip={props.onFinish}
      nextLabel="Step into your harbor"
      skipLabel="Decide later">
      {MODES.map(function (mode) {
        return <ModeCard key={mode.key} mode={mode}
          selected={d.mode === mode.key} onSelect={handleSelect} />;
      })}
    </StepShell>
  );
}

// ---------------------------------------------------------------------------
// Wizard root
// ---------------------------------------------------------------------------

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
  return {
    householdName: props.initialHouseholdName || '',
    zip: '',
    people: people,
    features: defaultFeatures(),
    mealsPerDay: 2,
    stores: [],
    storeDraft: '',
    trashDay: '',
    exhaleCards: DEFAULT_EXHALE.map(function (c) { return Object.assign({}, c); }),
    mode: 'calm'
  };
}

export function buildPayload(d) {
  return {
    householdName: d.householdName.trim(),
    zip: d.zip,
    people: d.people
      .filter(function (p) { return p.name.trim() !== ''; })
      .map(function (p) {
        var person = { name: p.name.trim(), birthday: p.birthday, schoolType: p.schoolType || 'none' };
        if (p.tidePoolEnabled === true || p.tidePoolEnabled === false) { person.tidePoolEnabled = p.tidePoolEnabled; }
        return person;
      }),
    features: Object.assign({}, d.features),
    areaSettings: {
      mealsPerDay: d.mealsPerDay,
      stores: d.stores.slice(),
      trashDay: d.trashDay
    },
    exhaleCards: d.exhaleCards
      .filter(function (c) { return c.title.trim() !== ''; })
      .map(function (c) { return { title: c.title.trim() }; }),
    mode: d.mode
  };
}

// Dynamic step list — StepBirthdays/StepInSchool only included when relevant
// (someone missing a birthday / a detected child, respectively). Recomputed
// only at navigation time (goNext/goBack), never on every render, so a step
// already on screen can't have its content swapped out from under the user
// mid-edit just because they filled in the last blank birthday it was
// showing — see the comments on those two step components for why order matters.
function computeSteps(data) {
  var steps = [StepBasics, StepRooms, StepDetails, StepExhale];
  var hasMissingBirthday = data.people.some(function (p) {
    return p.name.trim() !== '' && !p.birthday;
  });
  if (hasMissingBirthday) { steps.push(StepBirthdays); }
  var hasChild = data.people.some(function (p) {
    return p.name.trim() !== '' && isMinorLocal(p.birthday);
  });
  if (hasChild) { steps.push(StepSchoolType); steps.push(StepTidePool); }
  steps.push(StepMode);
  return steps;
}

export default function OnboardingWizard(props) {
  var stateArr = useState(function () { return buildInitialData(props); });
  var data = stateArr[0];
  var setData = stateArr[1];
  var stepArr = useState(0);
  var step = stepArr[0];
  var setStep = stepArr[1];
  var stepsArr = useState(function () { return computeSteps(data); });
  var steps = stepsArr[0];
  var setSteps = stepsArr[1];

  function set(field, value) {
    setData(function (prev) {
      var next = Object.assign({}, prev);
      next[field] = value;
      return next;
    });
  }
  function goNext() {
    var nextSteps = computeSteps(data);
    setSteps(nextSteps);
    setStep(function (s) { return Math.min(s + 1, nextSteps.length - 1); });
    if (typeof window !== 'undefined') { window.scrollTo(0, 0); }
  }
  function goBack() {
    var prevSteps = computeSteps(data);
    setSteps(prevSteps);
    setStep(function (s) { return Math.max(s - 1, 0); });
  }
  function finish() {
    props.onComplete(buildPayload(data));
  }
  function skipAll() {
    props.onSkip();
  }

  var Step = steps[step];
  return (
    <div style={S.overlay}>
      <Step data={data} set={set}
        index={step} total={steps.length}
        onNext={goNext} onBack={step > 0 ? goBack : null}
        onFinish={finish} onSkipAll={skipAll} />
    </div>
  );
}
