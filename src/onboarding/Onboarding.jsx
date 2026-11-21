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

import React, { useState, useRef, createContext, useContext } from 'react';
import { color as TK_COLOR, tone as TK_TONE, font as TK_FONT, radius as TK_RADIUS, shadow as TK_SHADOW } from '../design/tokens.js';

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
// Skins. Every component reads its styles from the Skin context. LEGACY is
// exactly the styles above (flag off renders byte-for-byte as before);
// redesignSkin() is the af_redesign look built from src/design/tokens.js.
// ---------------------------------------------------------------------------

function legacyEmo(e) { return e; }

var LEGACY = {
  redesign: false,
  S: S, dotOff: S_dotOff, dotOn: S_dotOn, pill: S_pill, pillOn: S_pillOn,
  arrowBtn: S_arrowBtn, iconRow: S_iconRow, checkboxRow: S_checkboxRow,
  NAVY: NAVY, MUTED: MUTED, SERIF: SERIF, SEAGLASS: SEAGLASS, SEAGLASS_TINT: SEAGLASS_TINT,
  emo: legacyEmo
};

var Skin = createContext(LEGACY);

var RD_NAVY = TK_COLOR.anchorNavy;
var RD_GOLD = TK_COLOR.gold;
var RD_MUTED = '#5B6472';
var RD_LINE = 'rgba(27, 43, 68, 0.14)';
var RD_HEAD = TK_FONT.anchor.heading;
var RD_BODY = TK_FONT.anchor.body;

// Card tone per wizard screen (Basics, Harbor, More, Today, Family).
var RD_STEP_TONES = ['sand', 'sage', 'blue', 'mist', 'teal'];

function redesignSkin(stepIndex, showEmojis) {
  var t = TK_TONE[RD_STEP_TONES[stepIndex] || 'sand'];
  var card = { background: t.tint, border: 'none', borderRadius: TK_RADIUS.md,
    padding: '14px 16px', marginBottom: 10 };
  var pill = { border: '1px solid ' + RD_LINE, borderRadius: 999, padding: '9px 16px',
    fontSize: 14, background: TK_COLOR.surface, color: RD_NAVY, cursor: 'pointer',
    fontFamily: RD_BODY, minHeight: 40 };
  var input = { background: TK_COLOR.surface, border: '1px solid ' + RD_LINE,
    borderRadius: 12, padding: '11px 12px', fontSize: 16, color: RD_NAVY,
    fontFamily: RD_BODY, width: '100%', boxSizing: 'border-box', outline: 'none', minHeight: 44 };
  var s = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: TK_COLOR.background, zIndex: 9000, overflowY: 'auto',
      WebkitOverflowScrolling: 'touch', fontFamily: RD_BODY, color: RD_NAVY },
    frame: { maxWidth: 560, margin: '0 auto', boxSizing: 'border-box',
      padding: 'calc(16px + env(safe-area-inset-top, 0px)) 20px calc(32px + env(safe-area-inset-bottom, 0px))',
      minHeight: '100%', display: 'flex', flexDirection: 'column' },
    stepLabel: { fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase',
      color: '#8C6D45', margin: '0 0 6px', fontWeight: 700 },
    title: { fontFamily: RD_HEAD, fontSize: 30, fontWeight: 700, lineHeight: 1.15,
      margin: '0 0 6px', color: RD_NAVY },
    subtitle: { fontSize: 15, color: RD_MUTED, margin: '0 0 22px', lineHeight: 1.55 },
    label: { fontSize: 15, fontWeight: 700, margin: '0 0 8px', display: 'block', color: t.ink },
    input: input,
    hint: { fontSize: 13, color: RD_MUTED, margin: '6px 0 0', lineHeight: 1.45 },
    card: card,
    cardTitle: { fontFamily: RD_HEAD, fontSize: 18, fontWeight: 700, margin: 0, color: t.ink },
    cardBody: { fontSize: 14, color: RD_NAVY, margin: '4px 0 0', lineHeight: 1.5 },
    primaryBtn: { background: RD_GOLD, color: RD_NAVY, border: 'none', borderRadius: 999,
      padding: '14px 18px', fontSize: 16, fontWeight: 700, fontFamily: RD_BODY,
      width: '100%', cursor: 'pointer', minHeight: 50, boxShadow: TK_SHADOW.card },
    ghostBtn: { background: 'transparent', color: RD_MUTED, border: 'none',
      padding: '10px 8px', fontSize: 14, fontFamily: RD_BODY, cursor: 'pointer',
      textDecoration: 'underline', textUnderlineOffset: 3 },
    backBtn: { background: 'transparent', color: RD_NAVY, border: '1px solid ' + RD_LINE,
      borderRadius: 999, padding: '13px 18px', fontSize: 15, fontFamily: RD_BODY,
      cursor: 'pointer', minHeight: 50, whiteSpace: 'nowrap' },
    footer: { display: 'flex', gap: 10, marginTop: 28, alignItems: 'center' },
    dots: { display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' },
    addLink: { fontSize: 15, color: TK_TONE.teal.ink, fontWeight: 700, cursor: 'pointer',
      background: 'transparent', border: 'none', fontFamily: RD_BODY, padding: '8px 0', minHeight: 40 },
    // redesign-only
    group: { background: t.tint, borderRadius: TK_RADIUS.lg, padding: '16px 16px 14px' },
    innerCard: { background: TK_COLOR.surface, border: 'none', borderRadius: TK_RADIUS.sm,
      padding: '12px 14px', margin: '8px 0 10px' },
    topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 8, minHeight: 44, marginBottom: 18 },
    navBtn: { background: 'transparent', border: 'none', color: RD_NAVY, fontFamily: RD_BODY,
      fontSize: 15, fontWeight: 700, padding: '10px 4px', minWidth: 64, minHeight: 44, cursor: 'pointer' },
    navSpacer: { minWidth: 64 }
  };
  var dotOff = { width: 8, height: 8, borderRadius: 999, background: 'rgba(27, 43, 68, 0.18)' };
  return {
    redesign: true,
    tone: t,
    S: s,
    dotOff: dotOff,
    dotOn: Object.assign({}, dotOff, { width: 22, background: RD_GOLD }),
    dotDone: Object.assign({}, dotOff, { background: 'rgba(200, 162, 83, 0.55)' }),
    pill: pill,
    pillOn: Object.assign({}, pill, { border: '1px solid ' + RD_NAVY, background: RD_NAVY, color: '#FFFFFF' }),
    arrowBtn: { background: 'transparent', border: '1px solid ' + RD_LINE, borderRadius: 12,
      width: 44, height: 44, cursor: 'pointer', color: RD_MUTED, fontSize: 18,
      fontFamily: RD_BODY, padding: 0, flexShrink: 0 },
    iconRow: { display: 'flex', gap: 12, alignItems: 'flex-start', background: t.tint,
      border: 'none', borderRadius: TK_RADIUS.md, padding: '14px 16px', marginBottom: 10 },
    checkboxRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
      fontSize: 15, color: RD_NAVY, minHeight: 24 },
    NAVY: RD_NAVY, MUTED: RD_MUTED, SERIF: RD_HEAD, SEAGLASS: TK_TONE.teal.full,
    SEAGLASS_TINT: TK_TONE.teal.tint,
    emo: function (e) { return showEmojis === true ? e : ''; }
  };
}

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

// New look (af_redesign): the school types from src/lib/schoolType.js —
// Hybrid / co-op and Other (with a short label) join the list.
var RD_SCHOOL_TYPE_OPTIONS = [
  { value: 'homeschool', label: 'Homeschool',     emoji: '🏠' },
  { value: 'public',     label: 'Public School',  emoji: '🏫' },
  { value: 'private',    label: 'Private School', emoji: '🎓' },
  { value: 'hybrid',     label: 'Hybrid / co-op', emoji: '🤝' },
  { value: 'other',      label: 'Other',          emoji: '✏️' },
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

// One question. Legacy: no wrapper DOM at all. Redesign: a rounded tinted card.
function Group(props) {
  var K = useContext(Skin);
  if (!K.redesign) { return <React.Fragment>{props.children}</React.Fragment>; }
  return <div style={K.S.group}>{props.children}</div>;
}

function withEmo(K, emoji, label) {
  var e = K.emo(emoji);
  return e ? e + ' ' + label : label;
}

function Dots(props) {
  var K = useContext(Skin);
  var items = [];
  for (var i = 0; i < props.total; i++) {
    items.push(<span key={i} style={i === props.index ? K.dotOn : K.dotOff} />);
  }
  return <div style={K.S.dots}>{items}</div>;
}

// af_redesign shell, shared by every screen: Back / progress dots / Skip
// along the top, Playfair title, then content and the gold primary button.
// props.p is the calling shell's own props.
function RdShell(props) {
  var K = useContext(Skin);
  var p = props.p;
  return (
    <div style={K.S.frame} data-testid={'ob-step-' + p.index}>
      <div style={K.S.topBar}>
        {p.onBack ? (
          <button type="button" style={Object.assign({}, K.S.navBtn, { textAlign: 'left' })} onClick={p.onBack}>{'‹ Back'}</button>
        ) : <span style={K.S.navSpacer} />}
        <Dots index={p.index} total={p.total} />
        {p.onSkip ? (
          <button type="button" style={Object.assign({}, K.S.navBtn, { textAlign: 'right', color: K.MUTED, fontWeight: 400 })} onClick={p.onSkip}>Skip</button>
        ) : <span style={K.S.navSpacer} />}
      </div>
      <p style={K.S.stepLabel}>{'Step ' + (p.index + 1) + ' of ' + p.total}</p>
      <h1 style={K.S.title}>{p.title}</h1>
      {p.subtitle ? <p style={K.S.subtitle}>{p.subtitle}</p> : <div style={{ height: 14 }} />}
      <div style={{ flex: 1 }}>{p.children}</div>
      <div style={K.S.footer}>
        {p.onSecondary ? (
          <button type="button" style={K.S.backBtn} onClick={p.onSecondary}>{p.secondaryLabel}</button>
        ) : null}
        <button type="button" style={K.S.primaryBtn} onClick={p.onNext}>
          {p.nextLabel || 'Continue'}
        </button>
      </div>
      {p.onSkipAll ? (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button type="button" style={K.S.ghostBtn} onClick={p.onSkipAll}>
            {'Skip setup entirely — start with a blank harbor'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Full shell — screens 1 & 2. Continue (+ Back where applicable).
function StepShell(props) {
  var K = useContext(Skin);
  if (K.redesign) { return <RdShell p={props} />; }
  return (
    <div style={K.S.frame}>
      <p style={K.S.stepLabel}>{'Screen ' + (props.index + 1) + ' of ' + props.total}</p>
      <h1 style={K.S.title}>{props.title}</h1>
      <p style={K.S.subtitle}>{props.subtitle}</p>
      <div style={{ flex: 1 }}>{props.children}</div>
      <div style={K.S.footer}>
        {props.onBack ? (
          <button type="button" style={K.S.backBtn} onClick={props.onBack}>Back</button>
        ) : null}
        <button type="button" style={K.S.primaryBtn} onClick={props.onNext}>
          {props.nextLabel || 'Continue'}
        </button>
      </div>
      {props.onSkipAll ? (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <button type="button" style={K.S.ghostBtn} onClick={props.onSkipAll}>
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
  var K = useContext(Skin);
  if (K.redesign) { return <RdShell p={props} />; }
  return (
    <div style={K.S.frame}>
      <p style={K.S.stepLabel}>{'Screen ' + (props.index + 1) + ' of ' + props.total}</p>
      <h1 style={K.S.title}>{props.title}</h1>
      <p style={K.S.subtitle}>{props.subtitle}</p>
      <div style={{ flex: 1 }}>{props.children}</div>
      <div style={K.S.footer}>
        {props.onSecondary ? (
          <button type="button" style={K.S.backBtn} onClick={props.onSecondary}>
            {props.secondaryLabel}
          </button>
        ) : null}
        <button type="button" style={K.S.primaryBtn} onClick={props.onNext}>
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
  var K = useContext(Skin);
  var person = props.person;
  function handleName(e) { props.onChange(person.id, 'name', e.target.value); }
  function handleBirthday(e) { props.onChange(person.id, 'birthday', e.target.value); }
  function handleRemove() { props.onRemove(person.id); }
  function handleMe() { props.onSetMe(person.id); }
  var rowStyle = { display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' };
  var nameStyle = Object.assign({}, K.S.input, { flex: 1.2 });
  var dateStyle = Object.assign({}, K.S.input, { flex: 1, color: person.birthday ? K.NAVY : K.MUTED });
  if (K.redesign) {
    // Name on its own line at phone width; date, Me and remove underneath.
    rowStyle = { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' };
    nameStyle = Object.assign({}, K.S.input, { flex: '1 1 220px' });
    dateStyle = Object.assign({}, K.S.input, { flex: '1 1 140px', width: 'auto', minWidth: 0, color: person.birthday ? K.NAVY : K.MUTED });
  }
  // "This is me" — explicit, not positional. The host defaults to whoever is
  // marked isMe (falling back to the first person if nobody is) when it
  // resolves "who am I" on this device — see App.jsx handleOnboardingComplete.
  var meStyle = {
    flexShrink: 0, padding: '0.4rem 0.55rem', borderRadius: 8, fontSize: 11, fontWeight: 700,
    border: '1.5px solid ' + (person.isMe ? '#c8a97a' : 'rgba(26,39,68,0.15)'),
    background: person.isMe ? 'rgba(200,169,122,0.15)' : 'transparent',
    color: person.isMe ? '#8a6a3a' : K.MUTED, cursor: 'pointer', whiteSpace: 'nowrap'
  };
  if (K.redesign) {
    meStyle = Object.assign({}, meStyle, { minHeight: 44, minWidth: 56, borderRadius: 12, fontSize: 13,
      background: person.isMe ? 'rgba(200, 162, 83, 0.22)' : '#FDFAF5', color: person.isMe ? '#5E4526' : K.MUTED,
      border: '1.5px solid ' + (person.isMe ? '#C8A253' : 'rgba(27, 43, 68, 0.14)') });
  }
  return (
    <div style={rowStyle}>
      <input style={nameStyle} placeholder="Name" value={person.name}
        onChange={handleName} />
      <input style={dateStyle} type="date" value={person.birthday}
        onChange={handleBirthday} aria-label="Birthday" />
      <button type="button" style={meStyle} onClick={handleMe}
        aria-pressed={!!person.isMe} aria-label="This is me">{person.isMe ? '✓ Me' : 'Me?'}</button>
      <button type="button" style={K.arrowBtn} onClick={handleRemove}
        aria-label="Remove">{'×'}</button>
    </div>
  );
}

function StorePicker(props) {
  var K = useContext(Skin);
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
              style={d.groceryStore === name ? K.pillOn : K.pill}
              onClick={pickFactory(name)}>{name}</button>
          );
        })}
      </div>
      {d.groceryStore === 'Other' ? (
        <input style={K.S.input} placeholder="Where do you shop?"
          value={d.groceryStoreOther} onChange={handleOther} />
      ) : null}
      <p style={K.S.hint}>We'll use this for your shopping list.</p>
    </div>
  );
}

function NonGroceryStorePicker(props) {
  var K = useContext(Skin);
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
              style={isOn ? K.pillOn : K.pill}
              onClick={toggleFactory(name)}>{name}</button>
          );
        })}
      </div>
      <p style={K.S.hint}>Tap all that apply — these show up as tabs on your shopping list too.</p>
    </div>
  );
}

function FavMealRow(props) {
  var K = useContext(Skin);
  function handleChange(e) { props.onChange(props.idx, e.target.value); }
  return (
    <input style={Object.assign({}, K.S.input, { marginBottom: 6 })}
      placeholder={'Favorite meal ' + (props.idx + 1) + ' (optional)'}
      value={props.value} onChange={handleChange} />
  );
}

function StepBasics(props) {
  var K = useContext(Skin);
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
      onNext={props.onNext} onBack={K.redesign ? props.onBack : null} onSkipAll={props.onSkipAll}
      onSkip={props.onSkip}>
      <Group>
      <label style={K.S.label}>What do you call your family?</label>
      <input style={K.S.input} placeholder="The Harper Crew"
        value={d.householdName} onChange={handleHousehold} />
      </Group>
      <div style={{ height: 16 }} />
      <Group>
      <label style={K.S.label}>Your crew</label>
      {d.people.map(function (p) {
        return <CrewRow key={p.id} person={p}
          onChange={handlePersonChange} onRemove={handlePersonRemove} onSetMe={handleSetMe} />;
      })}
      <button type="button" style={K.S.addLink} onClick={handleAddPerson}>
        + Add another
      </button>
      </Group>
      <div style={{ height: 18 }} />
      <Group>
      <label style={K.S.label}>Where do you usually grocery shop?</label>
      <StorePicker data={d} set={props.set} />
      </Group>
      <div style={{ height: 18 }} />
      <Group>
      <label style={K.S.label}>Where else do you often shop?</label>
      <NonGroceryStorePicker data={d} set={props.set} />
      </Group>
      <div style={{ height: 18 }} />
      <Group>
      <label style={K.S.label}>A couple of favorite meals?</label>
      <p style={K.S.hint}>{'We’ll add these to your meal bank to make planning easier.'}</p>
      <div style={{ height: 6 }} />
      {[0, 1, 2].map(function (idx) {
        return <FavMealRow key={idx} idx={idx} value={d.favMeals[idx]} onChange={handleFavMeal} />;
      })}
      </Group>
    </StepShell>
  );
}

// ---------------------------------------------------------------------------
// Screen 2 — Your Harbor
// ---------------------------------------------------------------------------

function YesNoRow(props) {
  var K = useContext(Skin);
  function handleYes() { props.onChange(true); }
  function handleNo() { props.onChange(false); }
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: props.value !== null ? 10 : 4 }}>
      <button type="button" style={props.value === true ? K.pillOn : K.pill} onClick={handleYes}>Yes</button>
      <button type="button" style={props.value === false ? K.pillOn : K.pill} onClick={handleNo}>No</button>
    </div>
  );
}

function SchoolTypeRow(props) {
  var K = useContext(Skin);
  var person = props.person;
  function selectFactory(value) {
    return function () { props.onChange(person.id, value); };
  }
  return (
    <div style={K.S.innerCard || K.S.card}>
      <p style={K.S.cardTitle}>{person.name}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {(K.redesign ? RD_SCHOOL_TYPE_OPTIONS : SCHOOL_TYPE_OPTIONS).map(function (opt) {
          return (
            <button key={opt.value} type="button" onClick={selectFactory(opt.value)}
              style={person.schoolType === opt.value ? K.pillOn : K.pill}>
              {withEmo(K, opt.emoji, opt.label)}
            </button>
          );
        })}
      </div>
      {K.redesign && person.schoolType === 'other' && props.onLabel ? (
        <input value={person.schoolLabel || ''} maxLength={30} aria-label={'Name ' + person.name + "'s school type"}
          placeholder="Name it, e.g. Online academy" onChange={function (e) { props.onLabel(person.id, e.target.value); }}
          style={Object.assign({}, K.S.input, { marginTop: 10 })} />
      ) : null}
    </div>
  );
}

function TreasureChestRow(props) {
  var K = useContext(Skin);
  var person = props.person;
  function handleToggle() { props.onChange(person.id, !(person.tidePoolEnabled !== false)); }
  var on = person.tidePoolEnabled !== false;
  return (
    <label style={K.checkboxRow}>
      <input type="checkbox" checked={on} onChange={handleToggle} />
      {person.name}
    </label>
  );
}

function PetRow(props) {
  var K = useContext(Skin);
  var pet = props.pet;
  function kindFactory(value) { return function () { props.onChange(pet.id, 'kind', value); }; }
  function handleName(e) { props.onChange(pet.id, 'name', e.target.value); }
  function handleRemove() { props.onRemove(pet.id); }
  return (
    <div style={Object.assign({}, K.S.innerCard || K.S.card, { marginBottom: 10 })}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {PET_KIND_OPTIONS.map(function (opt) {
          return (
            <button key={opt.value} type="button" onClick={kindFactory(opt.value)}
              style={pet.kind === opt.value ? K.pillOn : K.pill}>
              {withEmo(K, opt.emoji, opt.label)}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input style={Object.assign({}, K.S.input, { flex: 1 })} placeholder="Name"
          value={pet.name} onChange={handleName} />
        <button type="button" style={K.arrowBtn} onClick={handleRemove}
          aria-label="Remove pet">{'×'}</button>
      </div>
    </div>
  );
}

// af_redesign only: the household showEmojis setting. Minimal (off) is the
// default; Playful turns decorative emoji on.
var LOOK_OPTIONS = [
  { on: false, title: 'Minimal', body: 'Clean and quiet. Words only.' },
  { on: true, title: 'Playful', body: 'Adds emojis to your lists and pages. 🌊' }
];

function LookOption(props) {
  var K = useContext(Skin);
  var opt = props.opt;
  var selected = props.value === opt.on;
  function handleClick() { props.onChange(opt.on); }
  var style = Object.assign({}, K.S.card, {
    flex: '1 1 150px', margin: 0, textAlign: 'left', cursor: 'pointer', fontFamily: K.S.input.fontFamily,
    background: selected ? K.tone.tint : '#FDFAF5',
    border: selected ? '2px solid ' + K.NAVY : '2px solid rgba(27, 43, 68, 0.10)'
  });
  return (
    <button type="button" role="radio" aria-checked={selected} style={style} onClick={handleClick}
      data-testid={'ob-look-' + (opt.on ? 'playful' : 'minimal')}>
      <span style={Object.assign({}, K.S.cardTitle, { display: 'block' })}>{(selected ? '✓ ' : '') + opt.title}</span>
      <span style={Object.assign({}, K.S.cardBody, { display: 'block' })}>{opt.body}</span>
    </button>
  );
}

function LookChoice(props) {
  var K = useContext(Skin);
  return (
    <div style={{ marginTop: 18 }}>
      <label style={K.S.label} id="ob-look-label">Look</label>
      <p style={Object.assign({}, K.S.hint, { margin: '0 0 10px' })}>{'How should Anchor & Flow feel? You can change this anytime in Settings.'}</p>
      <div role="radiogroup" aria-labelledby="ob-look-label" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {LOOK_OPTIONS.map(function (opt) {
          return <LookOption key={opt.title} opt={opt} value={props.value} onChange={props.onChange} />;
        })}
      </div>
    </div>
  );
}

function StepHarbor(props) {
  var K = useContext(Skin);
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
  function handleSchoolLabelChange(id, value) {
    props.set('people', d.people.map(function (p) {
      return p.id === id ? Object.assign({}, p, { schoolLabel: value }) : p;
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
  function handleLook(on) { props.set('showEmojis', on); }
  function handleAddPet() {
    props.set('pets', d.pets.concat([{ id: uid(), kind: 'Dog', name: '' }]));
  }
  return (
    <StepShell index={props.index} total={props.total}
      title="Enhance your Harbor"
      subtitle="A few more things help us set up the right tools for your family."
      onNext={props.onNext} onBack={props.onBack} onSkip={props.onSkip}>
      {children.length > 0 ? (
        <div>
          <Group>
          <label style={K.S.label}>Do your kids go to school?</label>
          <YesNoRow value={d.goesToSchool} onChange={handleGoesToSchool} />
          {d.goesToSchool === true ? children.map(function (p) {
            return <SchoolTypeRow key={p.id} person={p} onChange={handleSchoolTypeChange} onLabel={handleSchoolLabelChange} />;
          }) : null}
          </Group>
          <div style={{ height: 18 }} />
          <Group>
          <label style={K.S.label}>{'Treasure Chest — a reward system for kids'}</label>
          <p style={K.S.hint}>{'Kids collect shells for chores and cash them in for treasures. Want to set this up?'}</p>
          <div style={{ height: 4 }} />
          <YesNoRow value={d.wantsTreasureChest} onChange={handleTreasureChest} />
          {d.wantsTreasureChest === true ? children.map(function (p) {
            return <TreasureChestRow key={p.id} person={p} onChange={handleTreasureChild} />;
          }) : null}
          </Group>
          <div style={{ height: 18 }} />
        </div>
      ) : null}
      <Group>
      <label style={K.S.label}>Any pets?</label>
      <YesNoRow value={d.hasPets} onChange={handleHasPets} />
      {d.hasPets === true ? (
        <div>
          {d.pets.map(function (p) {
            return <PetRow key={p.id} pet={p} onChange={handlePetChange} onRemove={handlePetRemove} />;
          })}
          <button type="button" style={K.S.addLink} onClick={handleAddPet}>
            + Add another pet
          </button>
        </div>
      ) : null}
      </Group>
      {K.redesign ? <LookChoice value={d.showEmojis === true} onChange={handleLook} /> : null}
    </StepShell>
  );
}

// ---------------------------------------------------------------------------
// Screen 3 — There's more (purely informational, no data collected)
// ---------------------------------------------------------------------------

function StepMore(props) {
  var K = useContext(Skin);
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
      onSecondary={handleExploreLater} secondaryLabel={'I’ll explore later'}
      onBack={props.onBack} onSkip={handleExploreLater}>
      {MORE_FEATURES.map(function (f, i) {
        return (
          <div key={i} style={K.iconRow}>
            {K.emo(f.emoji) ? <div style={{ fontSize: 22, lineHeight: '26px' }}>{K.emo(f.emoji)}</div> : null}
            <div style={{ flex: 1 }}>
              <p style={K.S.cardTitle}>{f.title}</p>
              <p style={K.S.cardBody}>{f.body}</p>
            </div>
          </div>
        );
      })}
      <p style={K.S.hint}>You can turn these on anytime in Settings.</p>
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
  var K = useContext(Skin);
  return (
    <InfoShell index={props.index} total={props.total}
      title="Meet your Today view"
      subtitle="Today summarizes your day and shows what matters most."
      onNext={props.onNext} nextLabel="Got it" onBack={props.onBack} onSkip={props.onSkip}>
      {TODAY_POINTS.map(function (pt, i) {
        return (
          <div key={i} style={K.iconRow}>
            {K.emo(pt.emoji) ? <div style={{ fontSize: 20, lineHeight: '24px' }}>{K.emo(pt.emoji)}</div> : null}
            <p style={Object.assign({}, K.S.cardBody, { fontSize: 13, margin: 0 })}>{pt.body}</p>
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
  var K = useContext(Skin);
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
    <div style={Object.assign({}, K.S.card, { background: K.SEAGLASS_TINT, border: '1px solid ' + K.SEAGLASS })}>
      <p style={K.S.cardTitle}>Household code</p>
      {props.householdId ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1, fontFamily: K.SERIF, fontSize: 16, fontWeight: 700, color: K.NAVY, wordBreak: 'break-all' }}>
            {props.householdId}
          </div>
          <button type="button" onClick={handleCopy}
            style={Object.assign({}, K.pill, copied ? { border: '1px solid ' + K.SEAGLASS, background: K.SEAGLASS, color: '#fff' } : {})}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      ) : (
        <p style={K.S.cardBody}>{'Your code will appear here once your harbor finishes setting up — find it anytime in Settings.'}</p>
      )}
      <p style={K.S.cardBody}>{'Other family members can join by going to Settings → Join Household and pasting this code.'}</p>
    </div>
  );
}

function SaveToPhoneCard() {
  var K = useContext(Skin);
  return (
    <div style={K.S.card}>
      <p style={K.S.cardTitle}>Save to your phone</p>
      <p style={Object.assign({}, K.S.cardBody, { marginTop: 8, fontWeight: 600 })}>iPhone</p>
      <p style={K.S.cardBody}>{'Tap the Share icon in Safari → "Add to Home Screen"'}</p>
      <p style={Object.assign({}, K.S.cardBody, { marginTop: 8, fontWeight: 600 })}>Android</p>
      <p style={K.S.cardBody}>{'Tap the menu (⋮) → "Add to Home Screen"'}</p>
    </div>
  );
}

// First Compass-style welcome, written from the answers on screens 1–3. Pure
// and deterministic (no AI call): every sentence is only included when the
// answer behind it was given, so a skip-through run still reads well.
function listJoin(items) {
  if (items.length <= 1) { return items.join(''); }
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}
function firstNameOf(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }

function buildCompassWelcome(d) {
  var p = buildPayload(d);
  var me = null;
  for (var i = 0; i < p.people.length; i++) { if (p.people[i].isMe) { me = p.people[i]; } }
  if (!me && p.people.length) { me = p.people[0]; }
  var lines = [];
  lines.push(me ? 'Welcome aboard, ' + firstNameOf(me.name) + '.' : 'Welcome aboard.');

  var others = p.people.filter(function (x) { return x !== me; }).map(function (x) { return firstNameOf(x.name); });
  var pets = p.pets.map(function (x) { return x.name; });
  var home = p.householdName || 'Your home';
  if (others.length || pets.length) {
    var crew = others.length ? ' for you, ' + listJoin(others) : '';
    var petBit = pets.length ? (others.length ? ' — plus ' : ' — and ') + listJoin(pets) : '';
    lines.push(home + ' is set up' + crew + petBit + '.');
  } else if (p.householdName) {
    lines.push(home + ' is set up.');
  }

  var stores = [];
  if (p.groceryStore) { stores.push(p.groceryStore); }
  p.nonGroceryStores.forEach(function (x) { if (stores.indexOf(x) === -1) { stores.push(x); } });
  if (p.favMeals.length) {
    lines.push(listJoin(p.favMeals) + (p.favMeals.length === 1 ? ' is' : ' are') + ' waiting in your meal bank' +
      (stores.length ? ', and your shopping list has tabs for ' + listJoin(stores) + '.' : '.'));
  } else if (stores.length) {
    lines.push('Your shopping list has tabs for ' + listJoin(stores) + '.');
  }

  if (p.treasureChestEnabled) {
    var collectors = d.people.filter(function (x) {
      return x.name.trim() !== '' && isMinorLocal(x.birthday) && x.tidePoolEnabled !== false;
    }).map(function (x) { return firstNameOf(x.name); });
    if (collectors.length) {
      lines.push(listJoin(collectors) + (collectors.length === 1 ? ' can' : ' can each') + ' start collecting shells in the Treasure Chest.');
    }
  }

  lines.push('Nothing else is needed today. Start with one small thing, and I’ll keep the rest in view.');
  return lines;
}

function CompassWelcome(props) {
  var K = useContext(Skin);
  var lines = buildCompassWelcome(props.data);
  var cardStyle = Object.assign({}, K.S.card, { padding: '18px 18px 16px', boxShadow: '0 1px 2px rgba(27, 43, 68, 0.04), 0 4px 14px rgba(27, 43, 68, 0.06)' });
  return (
    <div style={cardStyle} data-testid="ob-compass-welcome">
      <p style={Object.assign({}, K.S.stepLabel, { color: K.tone.ink, margin: '0 0 8px' })}>{withEmo(K, '🧭', 'Compass')}</p>
      {lines.map(function (line, i) {
        return (
          <p key={i} style={{ fontFamily: K.SERIF, fontStyle: 'italic', fontSize: i === 0 ? 22 : 17,
            fontWeight: i === 0 ? 700 : 400, lineHeight: 1.45, color: K.NAVY, margin: i === 0 ? '0 0 8px' : '0 0 6px' }}>{line}</p>
        );
      })}
    </div>
  );
}

function StepFamily(props) {
  var K = useContext(Skin);
  if (K.redesign) {
    return (
      <InfoShell index={props.index} total={props.total}
        title="Your home is ready"
        subtitle=""
        onBack={props.onBack}
        onNext={props.onFinish} nextLabel="Open my home">
        <CompassWelcome data={props.data} />
        <div style={{ height: 18 }} />
        <p style={K.S.label}>Bring your family aboard</p>
        <HouseholdCodeCard householdId={props.householdId} />
        <SaveToPhoneCard />
      </InfoShell>
    );
  }
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
// af_redesign welcome (first run only, before screen 1)
// ---------------------------------------------------------------------------

var LOGO_SRC = '/af-logo.png';

function WelcomeScreen(props) {
  var K = useContext(Skin);
  var logoState = useState(true);
  var logoOk = logoState[0];
  var setLogoOk = logoState[1];
  function handleLogoError() { setLogoOk(false); }
  var frame = Object.assign({}, K.S.frame, { justifyContent: 'center', alignItems: 'center', textAlign: 'center', maxWidth: 440 });
  return (
    <div style={frame} data-testid="ob-welcome">
      {logoOk ? (
        <img src={LOGO_SRC} alt="Anchor & Flow" onError={handleLogoError}
          style={{ width: 'min(78vw, 320px)', height: 'auto', display: 'block', margin: '0 auto 20px' }} />
      ) : (
        <h1 style={Object.assign({}, K.S.title, { fontSize: 36, margin: '0 0 20px' })}>{'Anchor & Flow'}</h1>
      )}
      <p style={Object.assign({}, K.S.subtitle, { margin: '0 0 28px' })}>{'Setup takes about three minutes.'}</p>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <button type="button" style={K.S.primaryBtn} onClick={props.onStart}>Get started</button>
        {props.onJoinCode ? (
          <button type="button" style={Object.assign({}, K.S.ghostBtn, { display: 'block', margin: '14px auto 0', color: K.NAVY, minHeight: 44 })}
            onClick={props.onJoinCode}>{'Joining a household? Use an invite code'}</button>
        ) : null}
      </div>
    </div>
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
      if (p.schoolLabel) { person.schoolLabel = p.schoolLabel; }
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
    pets: [],
    // af_redesign Look choice; null (flag off) keeps it out of the payload.
    showEmojis: props.redesign ? props.initialShowEmojis === true : null
  };
}

export function buildPayload(d) {
  var groceryStore = d.groceryStore === 'Other' ? d.groceryStoreOther.trim() : d.groceryStore;
  var payload = {
    householdName: d.householdName.trim(),
    people: d.people
      .filter(function (p) { return p.name.trim() !== ''; })
      .map(function (p) {
        var person = { name: p.name.trim(), birthday: p.birthday, schoolType: p.schoolType || 'none' };
        if (p.schoolType === 'other' && p.schoolLabel && String(p.schoolLabel).trim()) { person.schoolLabel = String(p.schoolLabel).trim().slice(0, 30); }
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
  if (d.showEmojis === true || d.showEmojis === false) { payload.showEmojis = d.showEmojis; }
  return payload;
}

export default function OnboardingWizard(props) {
  var redesign = props.redesign === true;
  var overlayRef = useRef(null);
  var welcomeArr = useState(redesign && props.welcome === true);
  var showWelcome = welcomeArr[0];
  var setShowWelcome = welcomeArr[1];
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
  function toTop() {
    if (typeof window !== 'undefined') { window.scrollTo(0, 0); }
    // The overlay is the scroller; window.scrollTo alone leaves it mid-page.
    if (redesign && overlayRef.current) { overlayRef.current.scrollTop = 0; }
  }
  function goNext() {
    setStep(function (s) { return Math.min(s + 1, STEPS.length - 1); });
    toTop();
  }
  function goBack() {
    setStep(function (s) { return Math.max(s - 1, 0); });
    toTop();
  }
  function backToWelcome() { setShowWelcome(true); toTop(); }
  function start() { setShowWelcome(false); setStep(0); toTop(); }
  function finish() {
    props.onComplete(buildPayload(data));
  }
  function skipAll() {
    props.onSkip();
  }

  var Step = STEPS[step];
  if (!redesign) {
    return (
      <div style={LEGACY.S.overlay}>
        <Step data={data} set={set}
          index={step} total={STEPS.length}
          onNext={goNext} onBack={step > 0 ? goBack : null}
          onFinish={finish} onSkipAll={step === 0 ? skipAll : null}
          householdId={props.householdId} />
      </div>
    );
  }
  var skin = redesignSkin(step, data.showEmojis);
  var welcomeBack = props.welcome === true ? backToWelcome : null;
  return (
    <Skin.Provider value={skin}>
      <div style={skin.S.overlay} ref={overlayRef} data-testid="ob-redesign">
        {showWelcome ? (
          <WelcomeScreen onStart={start} onJoinCode={props.onJoinCode} />
        ) : (
          <Step data={data} set={set}
            index={step} total={STEPS.length}
            onNext={goNext} onBack={step > 0 ? goBack : welcomeBack}
            onSkip={step < STEPS.length - 1 ? goNext : null}
            onFinish={finish} onSkipAll={step === 0 ? skipAll : null}
            householdId={props.householdId} />
        )}
      </div>
    </Skin.Provider>
  );
}
