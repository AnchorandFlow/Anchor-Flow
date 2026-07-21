// Onboarding.test.jsx — drop into the existing Vitest suite.
// Covers payload assembly, prefill, and trim/filter rules from OB-0.

import { describe, it, expect } from 'vitest';
import { buildInitialData, buildPayload } from '../../src/onboarding/Onboarding.jsx';

function freshData(overrides) {
  var base = buildInitialData({});
  return Object.assign({}, base, overrides || {});
}

describe('onboarding buildInitialData', function () {
  it('starts with one empty crew row when no prefill', function () {
    var d = buildInitialData({});
    expect(d.people.length).toBe(1);
    expect(d.people[0].name).toBe('');
  });

  it('prefills people and household name for re-run', function () {
    var d = buildInitialData({
      initialPeople: [{ name: 'Wren', birthday: '2017-03-14' }],
      initialHouseholdName: 'The Harper Crew'
    });
    expect(d.householdName).toBe('The Harper Crew');
    expect(d.people[0].name).toBe('Wren');
    expect(d.people[0].birthday).toBe('2017-03-14');
    expect(typeof d.people[0].id).toBe('string');
  });

  it('defaults: meals=2, mode=calm, career+safeHarbor off, tidePool on', function () {
    var d = buildInitialData({});
    expect(d.mealsPerDay).toBe(2);
    expect(d.mode).toBe('calm');
    expect(d.features.career).toBe(false);
    expect(d.features.safeHarbor).toBe(false);
    expect(d.features.tidePool).toBe(true);
    expect(d.features.lighthouse).toBe(true);
  });
});

describe('onboarding buildPayload', function () {
  it('drops crew rows with empty names and trims the rest', function () {
    var d = freshData({
      people: [
        { id: 'a', name: '  Wren ', birthday: '2017-03-14' },
        { id: 'b', name: '   ', birthday: '2020-08-02' },
        { id: 'c', name: '', birthday: '' }
      ]
    });
    var p = buildPayload(d);
    expect(p.people.length).toBe(1);
    expect(p.people[0].name).toBe('Wren');
    expect(p.people[0].birthday).toBe('2017-03-14');
  });

  it('drops empty exhale card titles and trims', function () {
    var d = freshData({
      exhaleCards: [{ title: ' Groceries ' }, { title: '   ' }]
    });
    var p = buildPayload(d);
    expect(p.exhaleCards).toEqual([{ title: 'Groceries' }]);
  });

  it('copies features and stores (no shared references)', function () {
    var d = freshData({ stores: ['Costco'] });
    var p = buildPayload(d);
    p.features.tidePool = false;
    p.areaSettings.stores.push('Mutated');
    expect(d.features.tidePool).toBe(true);
    expect(d.stores.length).toBe(1);
  });

  it('carries area settings and mode through', function () {
    var d = freshData({
      mealsPerDay: 3, trashDay: 'tue', mode: 'survival',
      stores: ['Costco', "Smith's"], zip: '84044',
      householdName: '  The Harper Crew  '
    });
    var p = buildPayload(d);
    expect(p.areaSettings.mealsPerDay).toBe(3);
    expect(p.areaSettings.trashDay).toBe('tue');
    expect(p.mode).toBe('survival');
    expect(p.zip).toBe('84044');
    expect(p.householdName).toBe('The Harper Crew');
  });

  it('minimal skip-through run still yields a valid payload', function () {
    var p = buildPayload(freshData());
    expect(p.people).toEqual([]);
    expect(p.exhaleCards.length).toBe(3);
    expect(p.mode).toBe('calm');
    expect(p.areaSettings.trashDay).toBe('');
  });
});
