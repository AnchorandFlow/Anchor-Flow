# Fix flowMode key mismatch — targeted, no design changes
import re

with open('src/App.jsx') as f:
    src = f.read()

print(f"Lines: {src.count(chr(10))}")
changes = []

# 1. Update FLOW_MODES_FN: Smooth/Busy → Calm/Waves
src = re.sub(
    r'FLOW_MODES_FN\s*=\s*T\s*=>\s*\(\{[^;]+\}\);',
    'FLOW_MODES_FN = T => ({\n'
    '  Calm:     {color:T.sage,  bg:T.sagePale, emoji:"\u2693",    label:"Calm Seas",     desc:"Feeling steady."},\n'
    '  Waves:    {color:T.sand,  bg:T.sandPale, emoji:"\U0001f30a",label:"Some Waves",    desc:"A bit much."},\n'
    '  Survival: {color:T.rose,  bg:T.rosePale, emoji:"\U0001f6df",label:"Survival Mode", desc:"Only what truly matters."},\n'
    '});',
    src, flags=re.DOTALL)
fm_ok = 'Calm:' in src and 'Waves:' in src and 'Smooth:' not in src
changes.append(f"{'✓' if fm_ok else '✗'} FLOW_MODES_FN: Calm/Waves/Survival (Smooth gone: {'Smooth:' not in src})")

# 2. flowMode default: "Smooth" → "Calm"
n = len(re.findall(r'useSaved\("flowMode"\s*,\s*"Smooth"\)', src))
src = re.sub(r'useSaved\("flowMode"\s*,\s*"Smooth"\)', 'useSaved("flowMode","Calm")', src)
changes.append(f"{'✓' if n else '~'} flowMode default Smooth→Calm: {n} replaced")

# 3. setFlowMode("Smooth") → setFlowMode("Calm")
n = src.count('setFlowMode("Smooth")')
src = src.replace('setFlowMode("Smooth")', 'setFlowMode("Calm")')
changes.append(f"{'✓' if n else '~'} setFlowMode Smooth→Calm: {n} replaced")

# 4. flowMode==="Busy" → flowMode==="Waves"
n = src.count('flowMode==="Busy"')
src = src.replace('flowMode==="Busy"', 'flowMode==="Waves"')
changes.append(f"{'✓' if n else '~'} flowMode===Busy→Waves: {n} replaced")

# 5. setFlowMode("Busy") → setFlowMode("Waves")
n = src.count('setFlowMode("Busy")')
src = src.replace('setFlowMode("Busy")', 'setFlowMode("Waves")')
changes.append(f"{'✓' if n else '~'} setFlowMode Busy→Waves: {n} replaced")

# 6. Pills options that still show Smooth/Busy labels
n = src.count('"Smooth"')
if n:
    src = src.replace('value:"Smooth",label:"Smooth"', 'value:"Calm",label:"Calm Seas"')
    src = src.replace('value:"Busy",label:"Busy"',     'value:"Waves",label:"Some Waves"')
    changes.append(f"{'✓'} Pills options updated: {n} Smooth refs remaining: {src.count('Smooth')}")

# Safety
for fn in ['isRemotePayloadSafe','SYNC_KEYS','closeDay','supabase.auth','setTasks']:
    assert fn in src, f"SAFETY: {fn}"

with open('src/App.jsx', 'w') as f:
    f.write(src)

print(f"Lines after: {src.count(chr(10))}")
for c in changes: print(c)
print(f"\nRemaining 'Smooth': {src.count(chr(34)+'Smooth'+chr(34))}")
print(f"Remaining 'Busy':   {src.count(chr(34)+'Busy'+chr(34))}")
print("Run: npm run build")
