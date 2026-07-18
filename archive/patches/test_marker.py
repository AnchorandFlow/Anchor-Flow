# Task 2: Add visible test marker to AnchorTab
# "TODAY TEST BUILD 1" at the top of the Today screen
# If this appears live, AnchorTab is rendering correctly

with open('src/App.jsx') as f:
    src = f.read()

anchor_start = src.find('  function AnchorTab()')
anchor_end   = src.find('  function CalendarTab(', anchor_start)
anchor_fn    = src[anchor_start:anchor_end]
ret          = anchor_fn.find('    return (')
pre_return   = anchor_fn[:ret]

print(f"Lines: {src.count(chr(10))}")
print(f"AnchorTab lines {src[:anchor_start].count(chr(10))+1}–{src[:anchor_end].count(chr(10))+1}")
print(f"Return opens: {repr(anchor_fn[ret:ret+80])}")

NEW_RETURN = '''    return (
      <div style={{flex:1,overflowY:"auto",background:"#0e1b2e",display:"flex",flexDirection:"column",minHeight:0,padding:"28px",gap:14,color:"#f5f0e8"}}>
        <div style={{background:"#c8a97a",color:"#0e1b2e",padding:"12px 16px",borderRadius:8,fontWeight:700,fontSize:"1rem",fontFamily:"DM Sans,sans-serif"}}>
          TODAY TEST BUILD 1
        </div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"2rem",color:"#f5f0e8"}}>Today</div>
        <div style={{fontSize:"0.6rem",letterSpacing:"0.2em",textTransform:"uppercase",color:"#c8a97a"}}>What matters right now</div>
      </div>
    );
  }

'''

new_src = src[:anchor_start] + pre_return + NEW_RETURN + src[anchor_end:]

# Safety
for fn in ['isRemotePayloadSafe','SYNC_KEYS','closeDay','supabase.auth']:
    assert fn in new_src, f"SAFETY: {fn}"

# Verify closes
a2 = new_src.find('  function AnchorTab()')
c2 = new_src.find('  function CalendarTab(', a2)
assert '  }\n\n' in new_src[c2-30:c2], "Not closed"

with open('src/App.jsx','w') as f:
    f.write(new_src)

print(f"Lines after: {new_src.count(chr(10))}")
print("Marker added. Run: npm run build")
