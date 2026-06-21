#!/usr/bin/env python3
"""patch_exhale.py — run from ~/Desktop/anchor-and-flow"""
import os, sys, shutil, subprocess

ROOT     = os.path.abspath(os.path.dirname(__file__))
APP      = os.path.join(ROOT, "src", "App.jsx")
COMP_DIR = os.path.join(ROOT, "src", "components")
HOME     = os.path.expanduser("~")

edits = 0

def die(msg):
    print("✗ " + msg); sys.exit(1)

def ok(msg):
    global edits; edits += 1; print("  ✓ " + msg)

def warn(msg):
    print("  ⚠ " + msg)

def swap(label, old, new, code):
    if old not in code:
        warn("Anchor not found — " + label); return code
    ok(label); return code.replace(old, new, 1)

# ── 1. Copy ExhaleSection.jsx ─────────────────────────────────────────────
comp = "ExhaleSection.jsx"
src_path = None
for d in [ROOT, os.path.join(HOME, "Downloads"), os.path.join(HOME, "Desktop")]:
    p = os.path.join(d, comp)
    if os.path.exists(p): src_path = p; break
if not src_path:
    die("Cannot find ExhaleSection.jsx — expected in project root or ~/Downloads")
os.makedirs(COMP_DIR, exist_ok=True)
shutil.copy2(src_path, os.path.join(COMP_DIR, comp))
ok("Copied ExhaleSection.jsx → src/components/")

# ── 2. Read App.jsx ───────────────────────────────────────────────────────
if not os.path.exists(APP): die("src/App.jsx not found — run from ~/Desktop/anchor-and-flow")
with open(APP, "r", encoding="utf-8") as f:
    code = f.read()

# ── 3. Import ─────────────────────────────────────────────────────────────
if "import ExhaleSection" not in code:
    added = False
    for frag in ["from './components/RippleTab", "from './components/AnchorVault", "from 'react'"]:
        if frag in code:
            idx = code.index(frag)
            eol = code.index("\n", idx)
            code = (code[:eol]
                    + "\nimport ExhaleSection from './components/ExhaleSection.jsx';"
                    + code[eol:])
            ok("Added import ExhaleSection")
            added = True; break
    if not added:
        warn("Could not place import — add manually near other component imports:\n"
             "      import ExhaleSection from './components/ExhaleSection.jsx';")
else:
    print("  ℹ import already present")

# ── 4. Add exhaleItems + exhaleLabels state ───────────────────────────────
# Insert before the brainItems useSaved line (line ~2719)
if 'useSaved("exhaleItems"' not in code:
    anchor = 'const [brainItems,setBrainItems]'
    if anchor in code:
        idx = code.index(anchor)
        sol = code.rindex("\n", 0, idx) + 1
        insert = (
            '  const [exhaleItems,setExhaleItems]           = useSaved("exhaleItems",[]);\n'
            '  const [exhaleLabels,setExhaleLabels]         = useSaved("exhaleLabels",{});\n'
        )
        code = code[:sol] + insert + code[sol:]
        ok("Added exhaleItems + exhaleLabels state (before brainItems)")
    else:
        warn("Could not place state — add manually before brainItems useSaved line:\n"
             '      const [exhaleItems,setExhaleItems] = useSaved("exhaleItems",[]);\n'
             '      const [exhaleLabels,setExhaleLabels] = useSaved("exhaleLabels",{});')
else:
    print("  ℹ exhaleItems state already present")

# ── 5. Add to _ARRAY_KEYS_BG (line ~2466) ────────────────────────────────
code = swap(
    "Added exhaleItems to _ARRAY_KEYS_BG",
    '"brainCats",',
    '"brainCats","exhaleItems",',
    code
)

# ── 6. Replace <BrainTab/> render (line ~10733) ───────────────────────────
new_render = (
    '{t==="brain"    && <ExhaleSection\n'
    '                initialItems={exhaleItems.length > 0 ? exhaleItems : brainItems}\n'
    '                initialLabels={exhaleLabels}\n'
    '                onSave={function(items, labels) {\n'
    '                  setExhaleItems(items);\n'
    '                  setExhaleLabels(labels);\n'
    '                }}\n'
    '              />}'
)
code = swap(
    "Replaced <BrainTab/> with <ExhaleSection/>",
    '{t==="brain"    && <BrainTab/>}',
    new_render,
    code
)

# ── 7. Write App.jsx ──────────────────────────────────────────────────────
with open(APP, "w", encoding="utf-8") as f:
    f.write(code)
print("  File written (" + str(len(code)) + " chars)")

# ── 8. esbuild syntax check ───────────────────────────────────────────────
esbuild = os.path.join(ROOT, "node_modules", ".bin", "esbuild")
if os.path.exists(esbuild):
    r = subprocess.run(
        [esbuild, "src/App.jsx", "--bundle=false"],
        capture_output=True, text=True, cwd=ROOT
    )
    if r.returncode != 0:
        print("\n  ⚠ esbuild errors:")
        print(r.stderr[:800])
    else:
        ok("esbuild syntax OK")
else:
    print("  ℹ esbuild not found in node_modules/.bin — skipping syntax check")

print()
print("Applied: " + str(edits) + " edit(s)")
print()
print('If clean:  ./deploy.sh "exhale redesign — sea glass cards, editable columns"')
