# Option A: Remove flowPicker modal, wire chips directly to setFlowMode
# Keys: Calm / Waves / Survival
# Labels: Calm Seas / Some Waves / Survival Mode
# localStorage key af_flowMode unchanged

with open('src/App.jsx') as f:
    src = f.read()

print(f"Lines: {src.count(chr(10))}")

CRITICAL = ['isRemotePayloadSafe','createLocalBackup','SYNC_KEYS','closeDay',
            'supabase.auth','householdId','debouncedSync','setTasks']
for fn in CRITICAL:
    assert fn in src, f"SAFETY: {fn}"

changes = []

# ── 1. Update FLOW_MODES_FN keys and labels ───────────────────────────────────
old_fm = '''FLOW_MODES_FN = T => ({
  Smooth:   {color:T.sage,  bg:T.sagePale, emoji:"🌊", desc:"Balanced, realistic day."},
  Busy:     {color:T.sand,  bg:T.sandPale, emoji:"⚡", desc:"Fewer tasks, more focus."},
  Survival: {color:T.rose,  bg:T.rosePale, emoji:"🛟", desc:"Only what truly matters."},
});'''
new_fm = '''FLOW_MODES_FN = T => ({
  Calm:     {color:T.sage,  bg:T.sagePale, emoji:"⚓", label:"Calm Seas",     desc:"Feeling steady. Let the day flow."},
  Waves:    {color:T.sand,  bg:T.sandPale, emoji:"🌊", label:"Some Waves",    desc:"A bit much. Focus on what matters."},
  Survival: {color:T.rose,  bg:T.rosePale, emoji:"🛟", label:"Survival Mode", desc:"Just today. Only what truly matters."},
});'''
assert old_fm in src, "FLOW_MODES_FN not found"
src = src.replace(old_fm, new_fm, 1)
changes.append('✓ FLOW_MODES_FN: Smooth→Calm, Busy→Waves, labels updated')

# ── 2. Default flowMode value: "Smooth" → "Calm" ─────────────────────────────
old_default = 'useSaved("flowMode","Smooth")'
new_default = 'useSaved("flowMode","Calm")'
if old_default in src:
    src = src.replace(old_default, new_default, 1)
    changes.append('✓ flowMode default: Smooth → Calm')
else:
    # Try with spaces
    old_default2 = 'useSaved("flowMode", "Smooth")'
    new_default2 = 'useSaved("flowMode", "Calm")'
    if old_default2 in src:
        src = src.replace(old_default2, new_default2, 1)
        changes.append('✓ flowMode default: Smooth → Calm (spaced)')
    else:
        changes.append('~ flowMode default: pattern not found (may already be Calm)')

# ── 3. Remove flowPicker modal block (lines 10683–10699) ─────────────────────
old_modal = '''      {modal==="flowPicker"&&(
        <ModalBox title="How\'s your day?" onClose={close}>
          <p style={{color:T.textSoft,fontSize:"0.83rem",lineHeight:1.6,marginBottom:"1rem"}}>Set your mode — it adjusts what the app shows you today.</p>
          <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
            {Object.entries(FM).map(([mode,m])=>(
              <button key={mode} onClick={()=>{setFlowMode(mode);close();}} style={{display:"flex",alignItems:"center",gap:"0.85rem",padding:"0.85rem 1rem",background:flowMode===mode?m.bg:T.bgAlt,border:`2px solid ${flowMode===mode?m.color:T.border}`,borderRadius:"1rem",cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"all 0.15s"}}>
                <span style={{fontSize:"1.5rem"}}>{m.emoji}</span>
                <div>
                  <div style={{fontWeight:800,color:flowMode===mode?m.color:T.textDark,fontSize:"0.92rem"}}>{mode}</div>
                  <div style={{color:T.textSoft,fontSize:"0.79rem",marginTop:"0.1rem"}}>{m.desc}</div>
                </div>
                {flowMode===mode&&<div style={{marginLeft:"auto",flexShrink:0}}><Icon name="check" size={16} color={m.color}/></div>}
              </button>
            ))}
          </div>
        </ModalBox>
      )}'''
assert old_modal in src, "flowPicker modal block not found"
src = src.replace(old_modal, '', 1)
changes.append('✓ flowPicker modal block removed')

# ── 4 & 5. Fix chip onClick and ids using regex (handles spacing variants) ────
import re as _re

# setModal("flowPicker") → setFlowMode(m.id)  anywhere in the file
n_modal = len(_re.findall(r'setModal\("flowPicker"\)', src))
src = _re.sub(r'setModal\("flowPicker"\)', 'setFlowMode(m.id)', src)
changes.append(f'✓ setModal("flowPicker") → setFlowMode(m.id): {n_modal} replaced')

# id:"Busy" → id:"Waves"  (only inside chip arrays — safe since "Busy" is only used there)
n_busy = src.count('id:"Busy"')
src = src.replace('id:"Busy"', 'id:"Waves"')
changes.append(f'✓ Chip id: "Busy" → "Waves": {n_busy} replaced')

# flowMode==="Busy" comparisons → flowMode==="Waves"
n_cmp = src.count('flowMode==="Busy"')
src = src.replace('flowMode==="Busy"', 'flowMode==="Waves"')
changes.append(f'✓ flowMode==="Busy" → "Waves" comparisons: {n_cmp} replaced')

# ── SAFETY CHECK ──────────────────────────────────────────────────────────────
for fn in CRITICAL:
    assert fn in src, f"POST SAFETY: {fn}"

# Confirm modal is gone
import re
assert 'flowPicker' not in src or src.count('flowPicker') == 1, \
    f"flowPicker still present {src.count('flowPicker')} times"
# The one remaining reference should be setModal("flowPicker") in AnchorTab
# which we've replaced — so count should be 0
remaining = src.count('"flowPicker"')
changes.append(f'✓ "flowPicker" remaining in file: {remaining} (should be 0)')

with open('src/App.jsx','w') as f:
    f.write(src)

print(f"Lines after: {src.count(chr(10))}")
print()
for c in changes: print(c)
print("\nRun: npm run build")
