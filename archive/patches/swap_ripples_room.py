#!/usr/bin/env python3
"""swap_ripples_room.py — replaces src/shell/RipplesRoom.jsx. Run from ~/Desktop/anchor-and-flow"""
import os, sys, shutil, subprocess

ROOT = os.path.abspath(os.path.dirname(__file__))
HOME = os.path.expanduser("~")
COMP = "RipplesRoom.jsx"
DEST = os.path.join(ROOT, "src", "shell", COMP)

src = None
for d in [ROOT, os.path.join(HOME, "Downloads"), os.path.join(HOME, "Desktop")]:
    p = os.path.join(d, COMP)
    if os.path.exists(p) and os.path.abspath(p) != DEST:
        src = p; break

if not src:
    print("x Cannot find new RipplesRoom.jsx in root, Downloads, or Desktop"); sys.exit(1)

if not os.path.exists(os.path.dirname(DEST)):
    print("x src/shell/ not found — wrong directory?"); sys.exit(1)

shutil.copy2(src, DEST)
print("Copied RipplesRoom.jsx -> src/shell/")

esbuild = os.path.join(ROOT, "node_modules", ".bin", "esbuild")
if os.path.exists(esbuild):
    r = subprocess.run([esbuild, DEST, "--bundle=false"], capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        print("esbuild errors:"); print(r.stderr[:600]); sys.exit(1)
    print("esbuild syntax OK")
else:
    print("esbuild not found - skipping check")

print()
print("Applied: 1 edit(s)")
print()
print('./deploy.sh "ripples — add Traditions tab"')
