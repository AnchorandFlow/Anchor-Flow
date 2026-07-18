#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch: fix silent receive-side data loss in sanitizeHouseholdData.

Bug: sanitizeHouseholdData is a hard allowlist. Nine SYNC_KEYS added after it
was written (compassCache, compassEnabled, exhale_groups, exhale_color_labels,
exhale_people, cal_markers, cal_marker_types, workDays, traditions) are absent
from it, so receiving devices strip them from every pull. Push worked; receive
silently dropped the keys.

Fix: defensive pass-through tail. Any SYNC_KEYS key not already handled by an
explicit rule above is passed through with a null guard. Future SYNC_KEYS
additions degrade to "unvalidated but syncs" instead of "silently eaten."

Run from repo root:  python3 patch_sanitizer_passthrough.py
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

swap(
    '    // cove_items_v1: object map — pass through if object\n'
    '    if (data["cove_items_v1"] && typeof data["cove_items_v1"] === "object") {\n'
    '      out["cove_items_v1"] = data["cove_items_v1"];\n'
    '    }\n'
    '    return out;\n'
    '  }',
    '    // cove_items_v1: object map — pass through if object\n'
    '    if (data["cove_items_v1"] && typeof data["cove_items_v1"] === "object") {\n'
    '      out["cove_items_v1"] = data["cove_items_v1"];\n'
    '    }\n'
    '    // Defensive pass-through: any SYNC_KEYS key not explicitly handled above\n'
    '    // syncs as-is (null-guarded) instead of being silently dropped. Fixes\n'
    '    // receive-side loss of workDays, traditions, cal_markers, cal_marker_types,\n'
    '    // compassCache, compassEnabled, exhale_groups, exhale_color_labels,\n'
    '    // exhale_people — and future-proofs new SYNC_KEYS additions.\n'
    '    SYNC_KEYS.forEach(k => {\n'
    '      if (out[k] === undefined && data[k] !== undefined && data[k] !== null) {\n'
    '        out[k] = data[k];\n'
    '      }\n'
    '    });\n'
    '    return out;\n'
    '  }',
    "sanitizer pass-through"
)

with open(PATH, "w", encoding="utf-8") as f:
    f.write(src)

print("\nApplied. Next steps:")
print("  npx esbuild src/App.jsx --target=es2019 --loader:.jsx=jsx --outfile=/dev/null")
print('  ./deploy.sh "fix receive-side sync loss: sanitizer passes through all SYNC_KEYS"')
