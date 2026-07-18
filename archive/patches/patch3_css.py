import os, sys
here = os.path.dirname(os.path.abspath(__file__))
css_path = os.path.join(here, 'mockup.css')
if not os.path.exists(css_path):
    print("ERROR: mockup.css not found next to this script")
    sys.exit(1)
with open(css_path) as f:
    css = f.read()
with open('src/App.jsx') as f:
    src = f.read()
print("Lines:", src.count("\n"))
if ".sb{" in src and "--navy:#0e1b2e" in src:
    print("Already done"); sys.exit(0)
i = src.find("<style>{`")
j = src.find("`}", i+9)
assert i != -1, "style block not found"
print(f"Replacing style block ({j-i-9} chars) with mockup CSS ({len(css)} chars)")
out = src[:i+9] + "\n" + css.strip() + "\n        [draggable]:active{cursor:grabbing!important}\n      " + src[j:]
for fn in ["isRemotePayloadSafe","SYNC_KEYS","closeDay","supabase.auth"]:
    assert fn in out, f"SAFETY: {fn}"
with open("src/App.jsx","w") as f:
    f.write(out)
print("Lines after:", out.count("\n"))
print(".sb{:", ".sb{" in out)
print(".np{:", ".np{" in out)
print(".flow-skin:", ".flow-skin {" in out)
print(".pane{:", ".pane{" in out)
print("Done. Run: npm run build")
