#!/usr/bin/env python3
"""
Anchor & Flow - Add V2 initial card fetch to ExhaleSection.

The migration useEffect bails early once the flag is set, meaning devices with
the migration already done (including those that migrated with 0 local cards)
never fetch household cards from exhale_cards on mount. Cards only load from
the local blob — blank on a fresh/wiped device.

Fix: add a separate initial-load useEffect that fetches all household cards from
exhale_cards whenever V2 is on and householdId is resolved. Runs every mount —
safe since it's a read-only SELECT. Merges DB result into groups state so all
column structure is preserved and DB cards override any stale local blob.

Run from project root:
    cd ~/Desktop/anchor-and-flow
    python3 patch_exhale_initial_load.py ./src/components/ExhaleSection.jsx
"""

import subprocess
import sys
import os

NEW_EFFECT = """
  // V2 initial load: fetch all household cards from exhale_cards on mount.
  // Runs independently of migration so devices where migration already ran
  // (including those that had 0 local cards to migrate) still load the
  // household's current cards from the DB on every mount.
  useEffect(function() {
    if (!EXHALE_V2) return;
    if (!householdId) return;
    supabase
      .from("exhale_cards")
      .select("*")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .then(function(result) {
        if (result.error) {
          console.warn("[AF] Exhale load error:", result.error.message);
          return;
        }
        if (!result.data || !result.data.length) return;
        var newGroups = {};
        result.data.forEach(function(row) {
          var col = row.category || "brain";
          if (!newGroups[col]) newGroups[col] = [];
          newGroups[col].push({
            id:         row.id,
            text:       row.text        || "",
            notes:      row.notes       || "",
            color:      row.color       || "",
            emoji:      row.emoji       || null,
            dueDate:    row.due_date    || null,
            assignedTo: row.assigned_to || null,
            position:   row.position    || 0,
            createdAt:  row.created_at  || null,
          });
        });
        Object.keys(newGroups).forEach(function(col) {
          newGroups[col].sort(function(a, b) { return (a.position || 0) - (b.position || 0); });
        });
        setGroups(function(prev) {
          return Object.assign({}, prev, newGroups);
        });
      });
  }, [householdId]);

"""

ANCHOR = '  }, [householdId]); // re-runs when householdId resolves null → real id; flag guards re-migration\n\n  // V2 Realtime:'

ALREADY_APPLIED = 'V2 initial load: fetch all household cards from exhale_cards on mount.'


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 patch_exhale_initial_load.py ./src/components/ExhaleSection.jsx")
        sys.exit(1)

    path = sys.argv[1]
    print("Step 1: Checking file: " + path)
    if not os.path.isfile(path):
        print("FAILED - file not found: " + path)
        sys.exit(1)

    with open(path, "r") as f:
        content = f.read()

    print("Step 2: Applying patch ...")
    if ALREADY_APPLIED in content:
        print("  Already applied - no change needed. Running syntax check.")
    elif ANCHOR in content:
        replacement = '  }, [householdId]); // re-runs when householdId resolves null → real id; flag guards re-migration\n' + NEW_EFFECT + '  // V2 Realtime:'
        content = content.replace(ANCHOR, replacement)
        with open(path, "w") as f:
            f.write(content)
        print("  Applied: V2 initial card fetch useEffect inserted after migration effect")
    else:
        print("FAILED - anchor not found. File may have changed. No edits made.")
        sys.exit(1)

    print("Step 3: Running esbuild syntax check ...")
    result = subprocess.run(
        ["npx", "esbuild", path, "--target=es2019", "--outfile=/dev/null"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print("  PASSED - no syntax errors.")
    else:
        print("FAILED - esbuild errors:")
        print(result.stdout)
        print(result.stderr)
        sys.exit(1)

    print("\nAll done. Next steps:")
    print("  1. git diff               (confirm only the new useEffect was added)")
    print('  2. ./deploy.sh "add v2 initial card fetch on mount"')
    print("  3. curl -s https://www.anchorandflowapp.com/ | grep -o 'index-[A-Za-z0-9_-]*\\.js'")
    print("     (confirm new hash - git push != deployed)")


if __name__ == "__main__":
    main()
