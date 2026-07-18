#!/usr/bin/env python3
import sys

def swap(path, old, new, label):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        count = content.count(old)
        if count == 0:
            print(f"✗ {label} — anchor not found in {path}")
            return False
        if count > 1:
            print(f"✗ {label} — anchor appears {count} times (not unique) in {path}")
            return False
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content.replace(old, new, 1))
        print(f"✓ {label}")
        return True
    except Exception as e:
        print(f"✗ {label} — {e}")
        return False

results = []
APP = "src/App.jsx"
FLOW = "src/shell/FlowHome.jsx"

# ── 1. FIX: Cove section addItem key mismatch ────────────────────────────────
# addItem(sec.id) reads newItemTexts[sec.id], but the input stores text at
# newItemTexts["sec_"+sec.id]. Fix: drop the "sec_" prefix from addKey so
# both the input and addItem use the same key.
results.append(swap(APP,
'              var addKey = "sec_"+sec.id;',
'              var addKey = sec.id;',
"1. Cove: fix addKey prefix so addItem can find the typed text"))

# ── 2. FIX: Cove notes list — add back arrow ────────────────────────────────
# The notes list view (coveTab==="notes", no activeNoteId) shows the Cove
# title but has no way to go back to the main nav. Add a back arrow matching
# the pattern used in the Cove lists view.
results.append(swap(APP,
'''      // Notes list
      return (
        <div style={{paddingBottom:"2rem"}}>
          <div style={{padding:"18px 16px 8px",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
            <div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.5rem",fontWeight:700,color:T.textDark}}>🪸 Cove</div>
              <div style={{fontSize:"0.72rem",color:T.textSoft,marginTop:2}}>Your lists, notes, ideas, and keeps.</div>
            </div>''',
'''      // Notes list
      return (
        <div style={{paddingBottom:"2rem"}}>
          <div style={{padding:"18px 16px 8px",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:"6px"}}>
              <button onClick={function(){goTab("anchor");}} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 4px 0 0",display:"flex",alignItems:"center",opacity:0.5,flexShrink:0,marginTop:4}}>
                <Icon name="arrow-left" size={17} color={T.textSoft}/>
              </button>
              <div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.5rem",fontWeight:700,color:T.textDark}}>🪸 Cove</div>
                <div style={{fontSize:"0.72rem",color:T.textSoft,marginTop:2}}>Your lists, notes, ideas, and keeps.</div>
              </div>
            </div>''',
"2. Cove notes list: add back arrow to anchor"))

# ── 3. FIX: FlowHome — add back arrow ────────────────────────────────────────
# FlowHome has no way to go back to Anchor. Add a back arrow before the "Flow"
# title in the header, using the same go("anchor") navigation the component
# already uses internally, and an inline SVG arrow (no Icon import needed).
results.append(swap(FLOW,
'      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid " + C.cardBorder }}>\n        <div>\n          <div style={{ fontFamily: SERIF, fontSize: "1.9rem", fontWeight: 600, color: C.t1, lineHeight: 1 }}>Flow</div>',
'      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid " + C.cardBorder }}>\n        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>\n          <button onClick={function() { go("anchor"); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 4px 0 0", display: "flex", alignItems: "center", opacity: 0.5, flexShrink: 0, marginTop: 8 }}>\n            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>\n          </button>\n          <div>\n            <div style={{ fontFamily: SERIF, fontSize: "1.9rem", fontWeight: 600, color: C.t1, lineHeight: 1 }}>Flow</div>',
"3. FlowHome: add back arrow to anchor"))

# FlowHome header closing — need to close the new <div> wrapping both button
# and the content div. Find the closing tag after the subtitle/date line.
results.append(swap(FLOW,
'          <div style={{ fontSize: ".82rem", color: C.t3, marginTop: 4 }}>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {todayTasks.length - doneCount} things left</div>\n        </div>',
'          <div style={{ fontSize: ".82rem", color: C.t3, marginTop: 4 }}>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {todayTasks.length - doneCount} things left</div>\n          </div>\n        </div>',
"3b. FlowHome: close inner wrapping div"))

passed = sum(1 for r in results if r)
total  = len(results)
print(f"\nApplied: {passed} of {total}")
sys.exit(0 if passed == total else 1)
