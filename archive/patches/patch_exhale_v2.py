#!/usr/bin/env python3
"""
Anchor & Flow - Flip EXHALE_V2 to default-on.

Run this from the project root:
    cd ~/Desktop/anchor-and-flow
    python3 patch_exhale_v2.py

It will:
  1. Locate ExhaleSection.jsx anywhere in the project (excluding node_modules)
  2. Apply the one-line change (=== "true"  ->  !== "false")
  3. Run an esbuild syntax check on the patched file
  4. Print a clear pass/fail report

Safe to re-run: if the change has already been applied, it detects that
and reports "already applied" instead of failing or double-patching.
"""

import subprocess
import sys
import os


def find_file():
    result = subprocess.run(
        ["find", ".", "-name", "ExhaleSection.jsx", "-not", "-path", "*/node_modules/*"],
        capture_output=True, text=True
    )
    paths = [p for p in result.stdout.strip().split("\n") if p]
    return paths


def main():
    if len(sys.argv) > 1:
        path = sys.argv[1]
        print("Step 1: Using explicit path: " + path)
        if not os.path.isfile(path):
            print("FAILED - no file found at " + path)
            sys.exit(1)
    else:
        print("Step 1: Locating ExhaleSection.jsx ...")
        paths = find_file()

        if len(paths) == 0:
            print("FAILED - no ExhaleSection.jsx found under " + os.getcwd())
            print("Make sure you're running this from the project root (~/Desktop/anchor-and-flow).")
            sys.exit(1)

        if len(paths) > 1:
            print("FAILED - found " + str(len(paths)) + " matching files, expected exactly 1:")
            for p in paths:
                print("  - " + p)
            print("\nRe-run with the correct path as an argument, e.g.:")
            print("  python3 patch_exhale_v2.py " + paths[0])
            sys.exit(1)

        path = paths[0]
        print("  Found: " + path)

    with open(path, "r") as f:
        content = f.read()

    old = 'var EXHALE_V2 = localStorage.getItem("af_exhale_v2") === "true";'
    new = 'var EXHALE_V2 = localStorage.getItem("af_exhale_v2") !== "false";'

    print("\nStep 2: Applying patch ...")
    if new in content:
        print("  Already applied - no change needed. Skipping to syntax check.")
    elif old in content:
        count = content.count(old)
        if count != 1:
            print("FAILED - anchor line found " + str(count) + " times, expected exactly 1. No changes made.")
            sys.exit(1)
        content = content.replace(old, new)
        with open(path, "w") as f:
            f.write(content)
        print("  Applied: 1 of 1 - EXHALE_V2 default flip")
    else:
        print("FAILED - could not find the expected EXHALE_V2 line in " + path)
        print("The file may have changed since this script was written. No changes made.")
        sys.exit(1)

    print("\nStep 3: Running esbuild syntax check ...")
    result = subprocess.run(
        ["npx", "esbuild", path, "--target=es2019", "--outfile=/dev/null"],
        capture_output=True, text=True
    )

    if result.returncode == 0:
        print("  PASSED - no syntax errors.")
    else:
        print("FAILED - esbuild reported errors:")
        print(result.stdout)
        print(result.stderr)
        sys.exit(1)

    print("\nAll done. Next steps:")
    print("  1. git diff               (review the one-line change)")
    print('  2. ./deploy.sh "flip exhale v2 to default-on"')
    print("  3. curl -s https://www.anchorandflowapp.com/ | grep -o 'index-[A-Za-z0-9_-]*\\.js'")
    print("     (confirm the hash changed - git push != deployed)")


if __name__ == "__main__":
    main()
