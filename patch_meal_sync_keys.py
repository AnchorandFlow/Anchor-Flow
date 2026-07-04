#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch: sync the two meal-domain keys missed by SYNC_KEYS (July 3 gap audit).

1. monthMeals — month-view dinner grid. Stored at af_monthMeals via direct
   localStorage in saveMonthMeals; add to SYNC_KEYS + markKeyDirty on save.
2. nwMealCount — next-week meal count. Stored via useSaved("af_nwMealCount"),
   and useSaved adds its OWN af_ prefix, so the real localStorage key is
   af_af_nwMealCount. Sync loops prefix SYNC_KEYS entries with af_, therefore
   the correct SYNC_KEYS entry is "af_nwMealCount" (intentionally
   double-prefix-looking). Documented inline so it never gets "corrected."

Receive side is already covered: both keys ride the July 3 sanitizer
pass-through. Run from repo root:  python3 patch_meal_sync_keys.py
"""

PATH = "src/App.jsx"

with open(PATH, "r", encoding="utf-8") as f:
    src = f.read()

def swap(old, new, label):
    global src
    count = src.count(old)
    if count != 1:
        raise SystemExit("FAILED [" + label + "]: anchor found " + str(count) + " times (need exactly 1). No changes written.")
    src = src.replace(old, new)
    print("OK  [" + label + "]")

# ── 1. Add the two keys to SYNC_KEYS ─────────────────────────────────────────
swap(
    '  // Calendar emoji markers\n'
    '  "cal_markers","cal_marker_types","workDays",\n'
    '  // Traditions (RipplesRoom)\n'
    '  "traditions"];',
    '  // Calendar emoji markers\n'
    '  "cal_markers","cal_marker_types","workDays",\n'
    '  // Traditions (RipplesRoom)\n'
    '  "traditions",\n'
    '  // Meals month grid + next-week meal count (July 3 sync-gap audit).\n'
    '  // NOTE: "af_nwMealCount" is intentionally listed WITH the af_ prefix:\n'
    '  // useSaved("af_nwMealCount") adds its own prefix, so the stored key is\n'
    '  // af_af_nwMealCount, and sync loops prefix SYNC_KEYS entries with af_.\n'
    '  // Do NOT normalize this without a data migration for existing devices.\n'
    '  "monthMeals","af_nwMealCount"];',
    "SYNC_KEYS additions"
)

# ── 2. Dirty-mark monthMeals on save so edits trigger a push ─────────────────
swap(
    'function saveMonthMeals(d){try{localStorage.setItem(monthKey,JSON.stringify(d));}catch{}}',
    'function saveMonthMeals(d){try{localStorage.setItem(monthKey,JSON.stringify(d));}catch{} markKeyDirty("monthMeals");}',
    "monthMeals dirty-mark"
)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(src)

print("\nApplied. Next steps:")
print("  npx esbuild src/App.jsx --target=es2019 --loader:.jsx=jsx --outfile=/dev/null")
print('  ./deploy.sh "sync monthMeals and next-week meal count across household"')
