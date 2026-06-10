# Remove test marker. Replace AnchorTab return with Forecast card only.
# Exactly as approved — no other sections, no design additions.

with open('src/App.jsx') as f:
    src = f.read()

print(f"Lines: {src.count(chr(10))}")

CRITICAL = ['isRemotePayloadSafe','createLocalBackup','SYNC_KEYS','closeDay',
            'supabase.auth','householdId','debouncedSync','setTasks']
for fn in CRITICAL:
    assert fn in src, f"SAFETY: {fn}"

anchor_start = src.find('  function AnchorTab()')
anchor_end   = src.find('  function CalendarTab(', anchor_start)
anchor_fn    = src[anchor_start:anchor_end]
ret_pos      = anchor_fn.find('    return (')
pre_return   = anchor_fn[:ret_pos]

NEW_RETURN = '''    return (
      <div style={{flex:1,overflowY:"auto",background:"#0e1b2e",display:"flex",flexDirection:"column",minHeight:0,padding:"28px 28px 48px",gap:14,color:"#f5f0e8"}}>

        {/* ── 1. Header ── */}
        <div style={{marginBottom:4}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"2rem",fontWeight:400,color:"#f5f0e8",lineHeight:1,marginBottom:5}}>Today</div>
          <div style={{fontSize:"0.54rem",letterSpacing:"0.22em",textTransform:"uppercase",color:"#c8a97a",fontWeight:500}}>What matters right now</div>
        </div>

        {/* ── 2. Forecast card ── */}
        <div style={{background:"rgba(22,36,64,0.6)",border:"1px solid rgba(200,169,122,0.13)",borderRadius:13,padding:"16px 18px",backdropFilter:"blur(12px)"}}>
          <div style={{fontSize:"0.72rem",color:"rgba(245,240,232,0.55)",marginBottom:14}}>How does today feel?</div>
          <div style={{display:"flex",gap:8}}>
            {[
              {id:"Calm",     emoji:"⚓", label:"Calm Seas",    border:"rgba(200,169,122,0.45)", bg:"rgba(200,169,122,0.1)"},
              {id:"Busy",     emoji:"🌊", label:"Some Waves",   border:"rgba(122,168,200,0.45)", bg:"rgba(122,168,200,0.1)"},
              {id:"Survival", emoji:"🛟", label:"Survival Mode",border:"rgba(200,122,138,0.45)", bg:"rgba(200,122,138,0.1)"},
            ].map(function(m){
              var isAct = flowMode===m.id;
              return (
                <div key={m.id} onClick={function(){setModal("flowPicker");}}
                  style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"13px 8px 11px",borderRadius:11,cursor:"pointer",transition:"all 0.18s",border:"1px solid "+(isAct?m.border:"rgba(245,240,232,0.08)"),background:isAct?m.bg:"transparent"}}>
                  <span style={{fontSize:"1.5rem"}}>{m.emoji}</span>
                  <div style={{fontSize:"0.66rem",color:isAct?"#f5f0e8":"rgba(245,240,232,0.45)",fontWeight:isAct?500:400,textAlign:"center",lineHeight:1.3}}>{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  }

'''

new_src = src[:anchor_start] + pre_return + NEW_RETURN + src[anchor_end:]

for fn in CRITICAL:
    assert fn in new_src, f"POST SAFETY: {fn}"

import re
broken = re.findall(r'"[^"\n]*(?:var\(--fl-[^)]+\)|rgba\([^)]+\))"[A-Za-z]', new_src)
assert not broken, f"Broken syntax: {broken[:2]}"

a2 = new_src.find('  function AnchorTab()')
c2 = new_src.find('  function CalendarTab(', a2)
assert '  }\n\n' in new_src[c2-30:c2], "AnchorTab not closed"

with open('src/App.jsx','w') as f:
    f.write(new_src)

print(f"Lines after: {new_src.count(chr(10))}")
print("Safety ✓  Syntax ✓")
print("Run: npm run build")
