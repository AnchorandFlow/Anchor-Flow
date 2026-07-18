# Fix sidebar: add missing width/bg/flex to nav's inline style
import re

with open('src/App.jsx') as f:
    s = f.read()

old = '<nav className="sb" style={{zIndex:200,position:"fixed",top:0,left:0,bottom:0}}>'
new = '<nav className="sb" style={{zIndex:200,position:"fixed",top:0,left:0,bottom:0,width:"196px",background:"#0e1b2e",display:"flex",flexDirection:"column",overflowY:"auto"}}>'

n = s.count(old)
print(f"Pattern found: {n}")

if n == 0:
    # Show what nav tag exists
    m = re.search(r'<nav[^>]*className=["\']sb["\'][^>]*>', s)
    if m:
        print(f"Found different nav tag: {m.group()!r}")
        old = m.group()
        new = old.replace('style={{', 'style={{width:"196px",background:"#0e1b2e",display:"flex",flexDirection:"column",overflowY:"auto",')
        n = 1
    else:
        print("ERROR: no nav.sb found")
        exit(1)

s = s.replace(old, new, 1)

# Verify
assert 'width:"196px"' in s, "width not added"
assert 'background:"#0e1b2e"' in s, "background not added"

with open('src/App.jsx', 'w') as f:
    f.write(s)

print(f"Fixed. Lines: {s.count(chr(10))}")
print("Run: npm run build")
