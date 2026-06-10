import re

with open('src/App.jsx', 'r') as f:
    s = f.read()

print(f"Lines: {s.count(chr(10))}")
total = 0

# ── Fix 1: broken "string"Word patterns ──────────────────────────────────────
fixes = [
    ('"1px solid var(--fl-border)"Soft',   '"1px solid rgba(100,148,130,0.15)"'),
    ('"1.5px solid var(--fl-border)"Soft', '"1.5px solid rgba(100,148,130,0.15)"'),
    ('"var(--fl-gold)"Dark',               '"#7a6030"'),
    ('"var(--fl-accent)"Dark',             '"#2a6058"'),
    ('"var(--fl-accent)"Pale',             '"rgba(61,122,110,0.12)"'),
    ('"var(--fl-rose)"Dark',               '"#8a3a48"'),
]
for old, new in fixes:
    n = s.count(old)
    if n:
        print(f"Fixed {n}x: {old}")
        s = s.replace(old, new)
        total += n

# ── Fix 2: broken double-spread on line 6917 ─────────────────────────────────
# style={{...{obj1},{obj2})}}  →  flat merged style object
old = 'style={{...{background:"var(--fl-accent)",color:"#fff",border:"none",borderRadius:"0.7rem",padding:"0.5rem 0.9rem",cursor:"pointer",fontWeight:600,fontSize:"0.84rem",fontFamily:"inherit"},{fontSize:"0.82rem",padding:"0.5rem 0.9rem",opacity:newText.trim()?1:0.4}})}}'
new = 'style={{background:"var(--fl-accent)",color:"#fff",border:"none",borderRadius:"0.7rem",cursor:"pointer",fontWeight:600,fontSize:"0.82rem",fontFamily:"inherit",padding:"0.5rem 0.9rem",opacity:newText.trim()?1:0.4}}'
n = s.count(old)
if n:
    print(f"Fixed {n}x: double-spread line 6917")
    s = s.replace(old, new)
    total += n

# ── Fix 3: catch-all for any remaining broken "...var(...)"Word patterns ──────
# Use regex to find and fix any we might have missed
def fix_var_suffix(m):
    return m.group(1)  # drop the trailing Word
fixed_regex = re.sub(r'("(?:[^"\n]*?)var\(--fl-[^)]+\))"([A-Z][a-z]+)', r'\1"', s)
regex_fixes = sum(1 for a, b in zip(s.split('"'), fixed_regex.split('"')) if a != b)
if fixed_regex != s:
    print(f"Fixed regex: additional broken var()Word patterns")
    s = fixed_regex
    total += 1

with open('src/App.jsx', 'w') as f:
    f.write(s)

# Verify
remaining = re.findall(r'"[^"\n]*(?:var\(--fl-[^)]+\)|rgba\([^)]+\))"[A-Za-z]', s)
spread_broken = s.count('style={{...{background:"var(--fl-accent)"')
print(f"\nTotal fixed: {total}")
print(f"Remaining broken string+word: {len(remaining)}", "OK" if not remaining else remaining[:2])
print(f"Remaining broken spreads: {spread_broken}", "OK" if not spread_broken else "STILL BROKEN")
