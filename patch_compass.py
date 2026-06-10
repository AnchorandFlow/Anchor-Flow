# Insert Compass card into AnchorTab Today return
# Inserted after forecast card, before closing div
# No other changes

with open('src/App.jsx') as f:
    src = f.read()

print(f"Lines: {src.count(chr(10))}")

CRITICAL = ['isRemotePayloadSafe','SYNC_KEYS','closeDay','supabase.auth','setTasks']
for fn in CRITICAL:
    assert fn in src, f"SAFETY: {fn}"

a = src.find('  function AnchorTab()')
c = src.find('  function CalendarTab(', a)
fn_body = src[a:c]
ret = fn_body.find('    return (')
block = fn_body[ret:]

# Find the last </div>\n    ); which closes the Today return
closing = '\n      </div>\n    );'
closing_pos = block.rfind(closing)
assert closing_pos > 0, f"Closing not found. Block ends: {block[-80:]!r}"
print(f"Closing found at block offset: {closing_pos}")

COMPASS = '''

        {/* ── Compass briefing ── */}
        <div style={{background:"rgba(22,36,64,0.6)",border:"1px solid rgba(200,169,122,0.13)",borderRadius:13,padding:"16px 18px",backdropFilter:"blur(12px)"}}>
          <div style={{fontSize:"0.54rem",letterSpacing:"0.18em",textTransform:"uppercase",color:"#c8a97a",fontWeight:500,marginBottom:10}}>🧭 Compass</div>
          {visibleInsights.length>0&&visibleInsights[0] ? (
            <div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"0.95rem",color:"rgba(245,240,232,0.82)",lineHeight:1.6}}>
                {visibleInsights[0].title}
              </div>
              {visibleInsights[0].body&&(
                <div style={{fontSize:"0.72rem",color:"rgba(245,240,232,0.45)",marginTop:7,lineHeight:1.55}}>
                  {visibleInsights[0].body}
                </div>
              )}
            </div>
          ) : (
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"0.95rem",color:"rgba(245,240,232,0.82)",lineHeight:1.6}}>
              {flowMode==="Calm"
                ? "Today has room to breathe. Keep your rhythm steady and enjoy the margin."
                : flowMode==="Waves"
                ? "There are a few waves today. Let's protect your energy and focus on what matters most."
                : "Only the essentials today. Anchor will hold the rest."}
            </div>
          )}
        </div>'''

new_block = block[:closing_pos] + COMPASS + block[closing_pos:]
new_fn = fn_body[:ret] + new_block
new_src = src[:a] + new_fn + src[c:]

for fn_name in CRITICAL:
    assert fn_name in new_src, f"POST SAFETY: {fn_name}"

# Verify AnchorTab still closes properly
a2 = new_src.find('  function AnchorTab()')
c2 = new_src.find('  function CalendarTab(', a2)
# closing check: CalendarTab follows AnchorTab
assert '  function CalendarTab(' in new_src[a2+100:a2+100000], 'CalendarTab not found after AnchorTab'

with open('src/App.jsx', 'w') as f:
    f.write(new_src)

print(f"Lines after: {new_src.count(chr(10))}")
print("Safety ✓")
print("Run: npm run build")
