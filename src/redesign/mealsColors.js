// src/redesign/mealsColors.js — Meals colors for af_redesign: the Meals
// section tone (sand) for its own controls, and one approved tone per meal
// tag so the Meal Bank filters and tags read apart. No purple or pink.
import { tone, accentTone, toneFor, hashIndex } from "../design/tokens.js";

export var MEALS_TONE = toneFor("meals"); // sand

// Tags grouped by meaning so related ones share a color.
var TAG_TONE = {
  "under-15": accentTone.gold, "one-pan": tone.sand, "easy-cleanup": tone.teal, "dairy-free": tone.blue,
  "kid-friendly": accentTone.mustard, "no-cook": accentTone.seafoam, "freezer-friendly": tone.blue,
  "survival-mode": accentTone.terracotta, "pantry-meal": tone.sand, "protein-packed": accentTone.terracotta,
  "vegetarian": tone.sage, "no-thaw": accentTone.seafoam, "crockpot": accentTone.gold, "paper-plates": tone.teal,
};
var CYCLE = [tone.sand, accentTone.gold, tone.sage, tone.teal, accentTone.seafoam, accentTone.terracotta, accentTone.mustard, tone.blue];

export function mealTagTone(id) {
  return TAG_TONE[id] || CYCLE[hashIndex(id, CYCLE.length)];
}
