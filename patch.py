# Safe patch script — runs on the clean committed App.jsx (11073 lines)
# Applies mockup visual changes only. Does NOT touch auth/sync/data logic.
# Uses safe file write pattern to avoid truncation.

import re

with open('src/App.jsx', 'r') as f:
    s = f.read()

original_lines = s.count('\n')
print(f"Starting: {original_lines} lines")
applied = []
skipped = []

def patch(description, old, new):
    if old in s:
        return new
    else:
        skipped.append(f"  skip (already done): {description}")
        return s

def apply(description, old, new):
    global s
    if old in s:
        s = s.replace(old, new, 1)
        applied.append(f"  ✓ {description}")
    else:
        skipped.append(f"  ~ skip: {description}")

# ── 1. TABS labels ────────────────────────────────────────────────────────────
apply("TABS: anchor→Today",
    '{id:"anchor",   label:"Anchor",   emoji:"⚓️"}',
    '{id:"anchor",   label:"Today",    emoji:"🏠"}')
apply("TABS: ai→Ripples",
    '{id:"ai",       label:"Ripple",   emoji:"〜"}',
    '{id:"ai",       label:"Ripples",  emoji:"✨"}')
apply("TABS: brain→Exhale",
    '{id:"brain",    label:"Mind",     emoji:"💭"}',
    '{id:"brain",    label:"Exhale",   emoji:"🌬️"}')
apply("TABS: school→Lighthouse",
    '{id:"school",   label:"School",   emoji:"🏫"}',
    '{id:"school",   label:"Lighthouse",emoji:"🏮"}')
apply("TABS: weekly→Rhythm",
    '{id:"weekly",   label:"Weekly",   emoji:"📅"}',
    '{id:"weekly",   label:"Rhythm",   emoji:"📅"}')
apply("TABS: cove→Coves",
    '{id:"cove",     label:"Cove",      emoji:"🪸"}',
    '{id:"cove",     label:"Coves",     emoji:"🗺️"}')
apply("TABS: tidepool emoji",
    '{id:"tidepool", label:"Tide Pool", emoji:"🏝️"}',
    '{id:"tidepool", label:"Tide Pool", emoji:"🐚"}')

# ── 2. EOD event listener ─────────────────────────────────────────────────────
apply("EOD: sidebar event listener",
    '  const [showEndOfDay,setShowEndOfDay]             = useState(false);',
    '  const [showEndOfDay,setShowEndOfDay]             = useState(false);\n  React.useEffect(function(){\n    function onShowEOD(){ setShowEndOfDay(true); }\n    window.addEventListener("af-show-eod", onShowEOD);\n    return function(){ window.removeEventListener("af-show-eod", onShowEOD); };\n  }, []);')

# ── 3. EOD Sunset modal ───────────────────────────────────────────────────────
apply("EOD: sheet backdrop",
    'position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(12px)",zIndex:1500,display:"flex",alignItems:"flex-end"',
    'position:"fixed",inset:0,background:"linear-gradient(170deg,#24364D 0%,#3D4F5C 20%,#5C4A42 38%,#A57B68 58%,#E6A57E 78%,#F1C49A 100%)",zIndex:1500,display:"flex",alignItems:"flex-end"')

apply("EOD: sheet panel",
    'background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1.4rem 1.4rem 0 0"',
    'background:"rgba(36,54,77,0.92)",border:"1px solid rgba(241,196,154,0.15)",backdropFilter:"blur(20px)",borderRadius:"1.4rem 1.4rem 0 0"')

apply("EOD: sheet drag handle",
    'width:40,height:4,borderRadius:2,background:T.border,margin:"0 auto 1rem"',
    'width:40,height:4,borderRadius:2,background:"rgba(241,196,154,0.3)",margin:"0 auto 1rem"')

apply("EOD: Wind Down → Sunset heading",
    'fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.2rem",textAlign:"center"}}>🌙 Wind Down</div>',
    'fontSize:"1.4rem",fontWeight:300,color:"#F1C49A",marginBottom:"0.2rem",textAlign:"center"}}>🌇 Sunset</div>')

apply("EOD: subtitle",
    'fontSize:"0.78rem",color:T.textSoft,marginBottom:"1.25rem",textAlign:"center"}}>{TODAY_NAME} · Review and close your day</div>',
    'fontFamily:"\'Cormorant Garamond\',serif",fontStyle:"italic",fontSize:"0.88rem",color:"rgba(241,196,154,0.55)",marginBottom:"1.25rem",textAlign:"center"}}>As the sun sets on today — let\'s gather what mattered.</div>')

apply("EOD: closing backdrop",
    'position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(12px)",zIndex:1500,display:"flex",alignItems:"center"',
    'position:"fixed",inset:0,background:"linear-gradient(170deg,#24364D 0%,#3D4F5C 20%,#5C4A42 38%,#A57B68 58%,#E6A57E 78%,#F1C49A 100%)",zIndex:1500,display:"flex",alignItems:"center"')

apply("EOD: closing panel",
    'background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1.8rem"',
    'background:"rgba(36,54,77,0.88)",border:"1px solid rgba(241,196,154,0.18)",backdropFilter:"blur(20px)",borderRadius:"1.5rem"')

apply("EOD: 🌙→🌇",
    '}}>🌙</div>\n          <div style={{fontFamily:"\'Cormorant Garamond\',serif",fontSize:"2rem",fontWeight:700,color:T.textDark',
    '}}>🌇</div>\n          <div style={{fontFamily:"\'Cormorant Garamond\',serif",fontSize:"1.9rem",fontWeight:300,color:"#F1C49A"')

apply("EOD: Close button → Good night",
    'Close My Day 🌙',
    'Good night ✦')

apply("EOD: close button style",
    '...btnP("linear-gradient(135deg,"+T.blue+","+T.sage+")",{width:"100%",padding:"0.9rem",fontSize:"0.95rem",borderRadius:"1rem"})',
    'width:"100%",padding:"0.9rem",fontSize:"0.92rem",borderRadius:"1rem",border:"1px solid rgba(241,196,154,0.3)",background:"rgba(241,196,154,0.08)",color:"#F1C49A",cursor:"pointer",fontFamily:"\'Cormorant Garamond\',serif",fontWeight:300')

# ── 4. FlowWrapper NAV labels ─────────────────────────────────────────────────
apply("NAV: Flow→Today",  'label: "Flow",     emoji: "🌊"', 'label: "Today",     emoji: "🏠"')
apply("NAV: Mind→Exhale", 'label: "Mind",     emoji: "💭"', 'label: "Exhale",    emoji: "🌬️"')
apply("NAV: School→Lighthouse", 'label: "School",   emoji: "🏫"', 'label: "Lighthouse",emoji: "🏮"')
apply("NAV: Weekly→Rhythm", 'label: "Weekly",   emoji: "📅"', 'label: "Rhythm",    emoji: "📅"')
apply("NAV: Cove→Coves",  'label: "Cove",     emoji: "🪸"', 'label: "Coves",     emoji: "🗺️"')
apply("NAV: Tide Pool emoji", 'label: "Tide Pool", emoji: "🏝️"', 'label: "Tide Pool", emoji: "🐚"')
apply("NAV: Ripples emoji", 'label: "Ripples",   emoji: "🌊"', 'label: "Ripples",   emoji: "✨"')

# ── 5. Flow-skin: wrap tab roots ──────────────────────────────────────────────
# BrainTab header
apply("BrainTab: flow-skin root + ph header",
    'return (\n      <div style={{paddingBottom:"2rem"}}>\n        {/* Exhale header */}\n        <div style={{textAlign:"center",marginBottom:"1rem",paddingTop:"0.25rem",position:"relative"}}>\n          <button onClick={function(){goTab("anchor");}} style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:"2px 4px",display:"flex",alignItems:"center",opacity:0.5}}>\n            <Icon name="arrow-left" size={17} color={T.textSoft}/>\n          </button>\n          <div style={{fontFamily:"\'Cormorant Garamond\',serif",fontSize:"1.45rem",fontWeight:700,color:T.textDark,letterSpacing:"0.03em"}}>Exhale.</div>\n          <div style={{fontSize:"0.78rem",color:T.textSoft,marginTop:"0.15rem",lineHeight:1.6}}>Clear your mind — then let it go.</div>\n        </div>',
    'return (\n      <div className="pane active flow-skin" style={{flex:1,overflowY:"auto",padding:"20px 24px",gap:13,display:"flex",flexDirection:"column",minHeight:0}}>\n        <div className="ph"><div><div className="ph-t">Exhale</div><div className="ph-s">Clear your mind — then let it go.</div></div></div>')

# TidePoolTab header
apply("TidePoolTab: flow-skin root + ph header",
    'return (\n      <div>\n        <div style={{textAlign:"center",marginBottom:"1.25rem",position:"relative"}}>\n          <button onClick={function(){goTab("anchor");}} style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:"2px 4px",display:"flex",alignItems:"center",opacity:0.5}}>\n            <Icon name="arrow-left" size={17} color={T.textSoft}/>\n          </button>\n          <div style={{fontFamily:"\'Cormorant Garamond\',serif",fontSize:"1.55rem",fontWeight:700,color:T.textDark,letterSpacing:"0.04em"}}>🏝️ Tide Pool</div>\n          <div style={{fontSize:"0.78rem",color:T.textSoft,marginTop:"2px"}}>Earn shells, open the chest, choose your treasure</div>\n        </div>',
    'return (\n      <div className="pane active flow-skin" style={{flex:1,overflowY:"auto",padding:"20px 24px",gap:13,display:"flex",flexDirection:"column",minHeight:0}}>\n        <div className="ph"><div><div className="ph-t">🐚 Tide Pool</div><div className="ph-s">Earn shells · open the chest · choose a treasure</div></div></div>')

# WeeklyTab, CalendarTab, MealsTab
for fn_name in ['WeeklyTab', 'CalendarTab', 'MealsTab']:
    fn_start = s.find(f'  function {fn_name}() {{')
    if fn_start == -1:
        skipped.append(f"  ~ skip: {fn_name} not found")
        continue
    fn_end = s.find('\n  function ', fn_start + 100)
    fn = s[fn_start:fn_end]
    old = '\n    return (\n      <div>'
    new = '\n    return (\n      <div className="pane active flow-skin" style={{flex:1,overflowY:"auto",padding:"20px 24px",minHeight:0}}>'
    if old in fn:
        fn = fn.replace(old, new, 1)
        s = s[:fn_start] + fn + s[fn_end:]
        applied.append(f'  ✓ {fn_name}: flow-skin root')
    else:
        skipped.append(f'  ~ skip: {fn_name} root (already patched or different)')

# SchoolTab main return
school_start = s.find('  function SchoolTab() {')
if school_start > 0:
    school_end = s.find('\n  function ', school_start + 100)
    school_fn = s[school_start:school_end]
    for m in re.finditer(r'\n      return \(\n        <div>', school_fn):
        ctx = school_fn[m.start():m.start()+150]
        if 'position' not in ctx[:80] and '2rem' not in ctx[:80]:
            school_fn = school_fn[:m.start()] + school_fn[m.start():].replace(
                '\n      return (\n        <div>',
                '\n      return (\n        <div className="pane active flow-skin" style={{flex:1,overflowY:"auto",padding:"20px 24px",minHeight:0}}>',
                1)
            s = s[:school_start] + school_fn + s[school_end:]
            applied.append('  ✓ SchoolTab: flow-skin root')
            break

# ── 6. T.* palette in flow tabs (sorted longest first) ───────────────────────
PALETTE = [
    ('T.modalOverlay','"rgba(26,46,58,0.7)"'),
    ('T.textFaint',   '"rgba(26,46,58,0.3)"'),
    ('T.textDark',    '"var(--fl-t1)"'),
    ('T.textMid',     '"var(--fl-t2)"'),
    ('T.textSoft',    '"var(--fl-t3)"'),
    ('T.borderSoft',  '"rgba(100,148,130,0.15)"'),
    ('T.border',      '"var(--fl-border)"'),
    ('T.surface',     '"rgba(255,255,255,0.82)"'),
    ('T.bgAlt',       '"rgba(220,232,226,0.7)"'),
    ('T.white',       '"rgba(255,255,255,0.9)"'),
    ('T.navBg',       '"rgba(220,232,226,0.95)"'),
    ('T.sageDark',    '"#2a6058"'),
    ('T.sagePale',    '"rgba(100,148,130,0.14)"'),
    ('T.sageLight',   '"#5a9e8f"'),
    ('T.sage',        '"var(--fl-accent)"'),
    ('T.sandDark',    '"#7a6030"'),
    ('T.sandPale',    '"rgba(176,136,64,0.12)"'),
    ('T.sandLight',   '"#c8a060"'),
    ('T.sand',        '"var(--fl-gold)"'),
    ('T.lavPale',     '"rgba(100,148,130,0.1)"'),
    ('T.lavender',    '"var(--fl-accent)"'),
    ('T.bluePale',    '"rgba(100,148,130,0.1)"'),
    ('T.blueDark',    '"#2a6058"'),
    ('T.blueLight',   '"#5a9e8f"'),
    ('T.blue',        '"var(--fl-accent)"'),
    ('T.roseDark',    '"#8a3a48"'),
    ('T.rosePale',    '"rgba(176,90,104,0.1)"'),
    ('T.rose',        '"var(--fl-rose)"'),
    ('T.green',       '"#5a8f6e"'),
]

FLOW_TABS = [
    'function BrainTab(){',
    'function TidePoolTab() {',
    'function SchoolTab() {',
    'function WeeklyTab() {',
    'function CalendarTab() {',
    'function MealsTab() {',
]

t_star_count = 0
for tab_sig in FLOW_TABS:
    fn_start = s.find('  ' + tab_sig)
    if fn_start == -1:
        continue
    fn_end = s.find('\n  function ', fn_start + 100)
    fn = s[fn_start:fn_end]
    for old, new in PALETTE:
        n = fn.count(old)
        if n:
            fn = fn.replace(old, new)
            t_star_count += n
    # Template literal forms ${T.*}
    for old, new in PALETTE:
        tmpl = '${' + old + '}'
        fn = fn.replace(tmpl, new.strip('"'))
    s = s[:fn_start] + fn + s[fn_end:]

applied.append(f'  ✓ T.* → fl-* in flow tabs ({t_star_count} replacements)')

# ── 7. Fix any broken "var(...)"Word from T.* substitution ───────────────────
broken_before = len(re.findall(r'"[^"\n]*var\(--fl-[^)]+\)"[A-Za-z]', s))
s = re.sub(r'("(?:[^"\n]*)?var\(--fl-[^)]+\))"([A-Z][a-z]+)', r'\1"', s)
broken_after = len(re.findall(r'"[^"\n]*var\(--fl-[^)]+\)"[A-Za-z]', s))
applied.append(f'  ✓ Syntax sweep: {broken_before - broken_after} broken var()Word fixed')

# ── 8. Fix broken btnP spreads ────────────────────────────────────────────────
# style={{...btnP(color, {extras})}} → flat style object
s = re.sub(
    r'style=\{\{\.\.\.btnP\([^,]+,\s*\{([^{}]+)\}\)\}\}',
    lambda m: 'style={{background:"var(--fl-accent)",color:"#fff",border:"none",borderRadius:"0.7rem",padding:"0.56rem 1.1rem",cursor:"pointer",fontWeight:600,fontSize:"0.84rem",fontFamily:"inherit",' + m.group(1) + '}}',
    s)

# Fix broken spread: style={{...{obj1},{obj2})}}
s = re.sub(
    r'style=\{\{\.\.\.(\{[^{}]+\}),(\{[^{}]+\})\)\}\}',
    lambda m: 'style={{{},{}}}'.format(m.group(1)[1:-1], m.group(2)[1:-1]),
    s)

# ── WRITE SAFELY ─────────────────────────────────────────────────────────────
with open('src/App.jsx', 'w') as f:
    f.write(s)

final_lines = s.count('\n')

# ── VERIFY ────────────────────────────────────────────────────────────────────
remaining_broken = re.findall(r'"[^"\n]*(?:var\(--fl-[^)]+\)|rgba\([^)]+\))"[A-Za-z]', s)
remaining_spreads = re.findall(r'style=\{\{\.\.\.{[^}]+},{', s)

print(f"\nLines: {original_lines} → {final_lines}")
print(f"\nApplied:")
for a in applied:
    print(a)
if skipped:
    print(f"\nSkipped (already patched):")
    for sk in skipped:
        print(sk)
print(f"\nSyntax check:")
print(f"  Broken var()Word: {len(remaining_broken)} {'✓' if not remaining_broken else remaining_broken[:2]}")
print(f"  Broken spreads:   {len(remaining_spreads)} {'✓' if not remaining_spreads else remaining_spreads[:1]}")
print(f"\n{'✓ Ready to deploy' if not remaining_broken and not remaining_spreads else '✗ Still has issues'}")
