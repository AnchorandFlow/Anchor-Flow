// Onboarding.test.jsx — drop into the existing Vitest suite.
// Covers payload assembly, prefill, and trim/filter rules for the rewritten
// (2026-08) 5-screen First Voyage wizard.

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

  it('defaults the first crew row to isMe when no prefill', function () {
    var d = buildInitialData({});
    expect(d.people[0].isMe).toBe(true);
  });

  it('prefills people and household name for re-run', function () {
    var d = buildInitialData({
      initialPeople: [{ name: 'Wren', birthday: '2017-03-14' }],
      initialHouseholdName: 'The Harper Crew'
    });
    expect(d.householdName).toBe('The Harper Crew');
    expect(d.people[0].name).toBe('Wren');
    expect(d.people[0].birthday).toBe('2017-03-14');
    expect(d.people[0].isMe).toBe(true);
    expect(typeof d.people[0].id).toBe('string');
  });

  it('defaults: no grocery store/favorites/school/treasure chest/pets answered yet', function () {
    var d = buildInitialData({});
    expect(d.groceryStore).toBe('');
    expect(d.groceryStoreOther).toBe('');
    expect(d.favMeals).toEqual(['', '', '']);
    expect(d.goesToSchool).toBeNull();
    expect(d.wantsTreasureChest).toBeNull();
    expect(d.hasPets).toBeNull();
    expect(d.pets).toEqual([]);
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

  it('carries isMe through only for the marked person', function () {
    var d = freshData({
      people: [
        { id: 'a', name: 'Wren', birthday: '', isMe: false },
        { id: 'b', name: 'Sam', birthday: '', isMe: true }
      ]
    });
    var p = buildPayload(d);
    expect(p.people[0].isMe).toBeUndefined();
    expect(p.people[1].isMe).toBe(true);
  });

  it('drops empty favorite-meal entries and trims the rest', function () {
    var d = freshData({ favMeals: [' Tacos ', '', '   '] });
    var p = buildPayload(d);
    expect(p.favMeals).toEqual(['Tacos']);
  });

  it('resolves grocery store: named option passes through as-is', function () {
    var d = freshData({ groceryStore: 'Costco', groceryStoreOther: 'ignored' });
    var p = buildPayload(d);
    expect(p.groceryStore).toBe('Costco');
  });

  it('resolves grocery store: "Other" uses the trimmed free-text field', function () {
    var d = freshData({ groceryStore: 'Other', groceryStoreOther: '  Harmons  ' });
    var p = buildPayload(d);
    expect(p.groceryStore).toBe('Harmons');
  });

  it('empty grocery store choice yields an empty string, not undefined', function () {
    var p = buildPayload(freshData());
    expect(p.groceryStore).toBe('');
  });

  it('treasureChestEnabled is a real boolean, true only when explicitly yes', function () {
    expect(buildPayload(freshData({ wantsTreasureChest: true })).treasureChestEnabled).toBe(true);
    expect(buildPayload(freshData({ wantsTreasureChest: false })).treasureChestEnabled).toBe(false);
    expect(buildPayload(freshData({ wantsTreasureChest: null })).treasureChestEnabled).toBe(false);
  });

  it('drops pets with empty names, trims the rest, keeps kind', function () {
    var d = freshData({
      pets: [
        { id: 'p1', kind: 'Dog', name: '  Biscuit ' },
        { id: 'p2', kind: 'Cat', name: '   ' }
      ]
    });
    var p = buildPayload(d);
    expect(p.pets).toEqual([{ kind: 'Dog', name: 'Biscuit' }]);
  });

  it('copies people/pets/favMeals (no shared references back into d)', function () {
    var d = freshData({
      people: [{ id: 'a', name: 'Wren', birthday: '' }],
      pets: [{ id: 'p1', kind: 'Dog', name: 'Biscuit' }],
      favMeals: ['Tacos', '', '']
    });
    var p = buildPayload(d);
    p.people[0].name = 'Mutated';
    p.pets[0].name = 'Mutated';
    p.favMeals.push('Mutated');
    expect(d.people[0].name).toBe('Wren');
    expect(d.pets[0].name).toBe('Biscuit');
    expect(d.favMeals).toEqual(['Tacos', '', '']);
  });

  it('minimal skip-through run still yields a valid payload', function () {
    var p = buildPayload(freshData());
    expect(p.people).toEqual([]);
    expect(p.favMeals).toEqual([]);
    expect(p.pets).toEqual([]);
    expect(p.groceryStore).toBe('');
    expect(p.treasureChestEnabled).toBe(false);
  });

  it('trims household name', function () {
    var d = freshData({ householdName: '  The Harper Crew  ' });
    var p = buildPayload(d);
    expect(p.householdName).toBe('The Harper Crew');
  });
});
