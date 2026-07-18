#!/usr/bin/env python3
"""
patch_cal_markers.py
Adds emoji markers to the month calendar (custody, on-call, travel, etc.)
- Stores in af_cal_markers localStorage (no household sync, no reload risk)
- Renders a small emoji row in each month-grid day cell
- Tapping a day opens a marker picker popover
- Marker types are user-editable (rename "Custody" to "Kids' week" etc.)

Run from: ~/Desktop/anchor-and-flow
  python3 patch_cal_markers.py
"""
import os, sys, subprocess

ROOT = os.path.abspath(os.path.dirname(__file__))
APP  = os.path.join(ROOT, "src", "App.jsx")

if not os.path.exists(APP):
    print("x src/App.jsx not found - run from ~/Desktop/anchor-and-flow")
    sys.exit(1)

with open(APP, "r", encoding="utf-8") as f:
    code = f.read()

edits = 0
def swap(label, old, new):
    global code, edits
    if old not in code:
        print("  x Anchor not found: " + label)
        return False
    code = code.replace(old, new, 1)
    edits += 1
    print("  v " + label)
    return True

# ── 1. Marker helpers + default types, inserted before localDateStr ───────
HELPER_ANCHOR = '  function localDateStr(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }'

HELPER_BLOCK = '''  // ── Calendar emoji markers (standalone localStorage, no household sync) ──
  function loadCalMarkers(){ try { var v = JSON.parse(localStorage.getItem("af_cal_markers")||"{}"); return (v && typeof v==="object") ? v : {}; } catch(e){ return {}; } }
  function saveCalMarkers(m){ try { localStorage.setItem("af_cal_markers", JSON.stringify(m)); } catch(e){} }
  function loadCalMarkerTypes(){
    try { var v = JSON.parse(localStorage.getItem("af_cal_marker_types")||"null"); if (Array.isArray(v) && v.length) return v; } catch(e){}
    return [
      { emoji:"\\u2B50", label:"Custody" },
      { emoji:"\\u260E\\uFE0F", label:"On call" },
      { emoji:"\\u2708\\uFE0F", label:"Travel" },
      { emoji:"\\uD83C\\uDFEB", label:"School closed" },
      { emoji:"\\uD83D\\uDC8A", label:"Medication" },
      { emoji:"\\uD83C\\uDFC8", label:"Practice" },
      { emoji:"\\uD83C\\uDF82", label:"Birthday" },
      { emoji:"\\u2764\\uFE0F", label:"Date night" },
      { emoji:"\\uD83E\\uDE7A", label:"Work" }
    ];
  }
  function saveCalMarkerTypes(t){ try { localStorage.setItem("af_cal_marker_types", JSON.stringify(t)); } catch(e){} }

''' + HELPER_ANCHOR

swap("Marker helpers inserted", HELPER_ANCHOR, HELPER_BLOCK)

# ── 2. State hooks — add after calViewDate state line ─────────────────────
STATE_ANCHOR = '  const [calViewDate,setCalViewDate]   = useState(new Date(TODAY));'
STATE_NEW = STATE_ANCHOR + '''
  const [calMarkers,setCalMarkers]     = useState(loadCalMarkers);
  const [calMarkerTypes,setCalMarkerTypes] = useState(loadCalMarkerTypes);
  const [markerPickerDate,setMarkerPickerDate] = useState(null);'''
swap("State hooks added", STATE_ANCHOR, STATE_NEW)

# ── 3. Toggle fn — insert before localDateStr block we just made ──────────
TOGGLE_ANCHOR = '  // \u2500\u2500 Calendar emoji markers (standalone localStorage, no household sync) \u2500\u2500'
TOGGLE_NEW = '''  function toggleCalMarker(dateStr, emoji){
    setCalMarkers(function(prev){
      var next = Object.assign({}, prev);
      var arr = (next[dateStr] || []).slice();
      var idx = arr.indexOf(emoji);
      if (idx === -1) arr.push(emoji); else arr.splice(idx,1);
      if (arr.length) next[dateStr] = arr; else delete next[dateStr];
      saveCalMarkers(next);
      return next;
    });
  }
''' + TOGGLE_ANCHOR
swap("toggleCalMarker added", TOGGLE_ANCHOR, TOGGLE_NEW)

# ── 4. Render marker row in month cell — after the "+N more" block ────────
CELL_ANCHOR = '''                    {dayEvts.length>2&&(
                      <div style={{fontSize:"0.56rem",color:T.textSoft,fontWeight:700,paddingLeft:"0.2rem"}}>+{dayEvts.length-2} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {calView==="week"&&('''

CELL_NEW = '''                    {dayEvts.length>2&&(
                      <div style={{fontSize:"0.56rem",color:T.textSoft,fontWeight:700,paddingLeft:"0.2rem"}}>+{dayEvts.length-2} more</div>
                    )}
                    {/* Emoji markers */}
                    {calMarkers[localDateStr(thisDate)]&&calMarkers[localDateStr(thisDate)].length>0&&(
                      <div style={{display:"flex",gap:"1px",flexWrap:"wrap",marginTop:"auto",lineHeight:1}}>
                        {calMarkers[localDateStr(thisDate)].map(function(em,mi){
                          return <span key={mi} style={{fontSize:"0.62rem"}}>{em}</span>;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Marker picker popover */}
            {markerPickerDate&&(
              <div onClick={function(){setMarkerPickerDate(null);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.3)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
                <div onClick={function(e){e.stopPropagation();}} style={{background:T.surface,borderRadius:"1rem",padding:"1.1rem 1.2rem",maxWidth:340,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.18)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.85rem"}}>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.05rem",color:T.textDark}}>{new Date(markerPickerDate+"T00:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</span>
                    <button onClick={function(){setMarkerPickerDate(null);}} style={{background:"none",border:"none",fontSize:"1.1rem",cursor:"pointer",color:T.textSoft}}>\\u00d7</button>
                  </div>
                  <div style={{fontSize:"0.66rem",color:T.textSoft,marginBottom:"0.6rem",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:700}}>Tap to add or remove</div>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
                    {calMarkerTypes.map(function(mt,ti){
                      var active=(calMarkers[markerPickerDate]||[]).indexOf(mt.emoji)!==-1;
                      return (
                        <div key={ti} onClick={function(){toggleCalMarker(markerPickerDate,mt.emoji);}} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.5rem 0.7rem",borderRadius:"0.6rem",cursor:"pointer",background:active?T.bluePale:T.bgAlt,border:"1px solid "+(active?T.blue:T.borderSoft)}}>
                          <span style={{fontSize:"1.1rem"}}>{mt.emoji}</span>
                          <span style={{flex:1,fontSize:"0.82rem",color:T.textDark,fontWeight:active?700:500}}>{mt.label}</span>
                          {active&&<span style={{fontSize:"0.72rem",color:T.blue,fontWeight:700}}>\\u2713</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {calView==="week"&&('''

swap("Marker row + picker popover rendered", CELL_ANCHOR, CELL_NEW)

# ── 5. Wire day-cell click to open marker picker (long-press alt: dbl click)
# The cell already has an onClick selecting the day. Add a small marker button.
DOTBTN_ANCHOR = '''                    {/* Date number */}
                    <div style={{width:22,height:22,borderRadius:"50%",background:todayFlag?T.blue:"transparent",color:todayFlag?"#fff":T.textDark,fontSize:"0.75rem",fontWeight:todayFlag?800:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginBottom:"1px"}}>{day}</div>'''

DOTBTN_NEW = '''                    {/* Date number + marker button */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:todayFlag?T.blue:"transparent",color:todayFlag?"#fff":T.textDark,fontSize:"0.75rem",fontWeight:todayFlag?800:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginBottom:"1px"}}>{day}</div>
                      <button onClick={function(ev){ev.stopPropagation();setMarkerPickerDate(localDateStr(thisDate));}} style={{background:"none",border:"none",fontSize:"0.6rem",color:T.textFaint,cursor:"pointer",padding:"0 2px",opacity:0.6}} title="Add marker">\\u25CF</button>
                    </div>'''

swap("Day-cell marker button wired", DOTBTN_ANCHOR, DOTBTN_NEW)

# ── write + esbuild check ─────────────────────────────────────────────────
with open(APP, "w", encoding="utf-8") as f:
    f.write(code)
print("  File written (" + str(len(code)) + " chars)")

esbuild = os.path.join(ROOT, "node_modules", ".bin", "esbuild")
if os.path.exists(esbuild):
    r = subprocess.run([esbuild, "src/App.jsx", "--bundle=false"], capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        print("  ! esbuild errors:\\n" + r.stderr[:800])
    else:
        print("  v esbuild syntax OK")
else:
    print("  i esbuild not found - skipping check")

print()
print("Applied: " + str(edits) + " of 5 edit(s)")
print()
print('If clean:  ./deploy.sh "calendar emoji markers"')
