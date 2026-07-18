#!/usr/bin/env python3
"""
fix_marker_dot.py
The previous patch wrote literal backslash-u escape strings into JSX, so they
render as visible text like the literal characters backslash u 2 5 C F. This
replaces every literal escape with the real character.
Run from: ~/Desktop/anchor-and-flow
  python3 fix_marker_dot.py
"""
import os, sys, subprocess

ROOT = os.path.abspath(os.path.dirname(__file__))
APP  = os.path.join(ROOT, "src", "App.jsx")

if not os.path.exists(APP):
    print("x src/App.jsx not found - run from ~/Desktop/anchor-and-flow")
    sys.exit(1)

with open(APP, "r", encoding="utf-8") as f:
    code = f.read()

# Each pair: the LITERAL backslash-u text in the file -> real character.
# r"..." keeps the backslash literal so we match what is actually in the file.
pairs = [
    (r"\u25CF", "\u2022"),              # dot button -> bullet
    (r"\u00d7", "\u00d7"),              # close X
    (r"\u2713", "\u2713"),              # checkmark
    (r"\u2B50", "\u2B50"),              # custody star
    (r"\u260E\uFE0F", "\u260E\uFE0F"),  # on-call phone
    (r"\u2708\uFE0F", "\u2708\uFE0F"),  # travel plane
    (r"\uD83C\uDFEB", "\U0001F3EB"),    # school
    (r"\uD83D\uDC8A", "\U0001F48A"),    # medication
    (r"\uD83C\uDFC8", "\U0001F3C8"),    # practice (football)
    (r"\uD83C\uDF82", "\U0001F382"),    # birthday cake
    (r"\u2764\uFE0F", "\u2764\uFE0F"),  # date night heart
    (r"\uD83E\uDE7A", "\U0001FA7A"),    # work (stethoscope)
]

total = 0
for literal, real in pairs:
    n = code.count(literal)
    if n:
        code = code.replace(literal, real)
        total += n
        print("  v replaced one escape x" + str(n))

with open(APP, "w", encoding="utf-8") as f:
    f.write(code)
print("  File written (" + str(len(code)) + " chars)")

esbuild = os.path.join(ROOT, "node_modules", ".bin", "esbuild")
if os.path.exists(esbuild):
    r = subprocess.run([esbuild, "src/App.jsx", "--bundle=false"], capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        print("  ! esbuild errors:\n" + r.stderr[:600])
    else:
        print("  v esbuild syntax OK")
else:
    print("  i esbuild not found - skipping check")

print()
print("Applied: " + str(total) + " replacement(s)")
print()
print('If clean:  ./deploy.sh "fix calendar marker glyphs"')
