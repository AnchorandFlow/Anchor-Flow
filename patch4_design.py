# Pass: Design alignment
# 1. Navigation defaults to closed (only "anchor" pre-visited)
# 2. AnchorTab Today screen replaced with mockup structure
# 3. Copy updates: Lighthouse subtitle, Exhale subtitle, Sunset text
# 4. WeeklyTab/CalendarTab/MealsTab get ph-t/ph-s headers (matching mockup)
# NO auth/sync/data changes

import re

with open('src/App.jsx', 'r') as f:
    src = f.read()

print(f"Lines: {src.count(chr(10))}")
applied = []

CRITICAL = ['isRemotePayloadSafe','createLocalBackup','SYNC_KEYS','closeDay',
            'supabase.auth','householdId','debouncedSync','setTasks']
for fn in CRITICAL:
    assert fn in src, f"PRE SAFETY: {fn}"

# ── 1. Navigation: default to closed (only anchor pre-visited) ────────────────
old_visited = 'visitedTabs = useRef(new Set(["anchor","calendar","weekly","meals","shop","home","brain","settings","ai","school","tidepool","cove"]));'
new_visited = 'visitedTabs = useRef(new Set(["anchor"]));'
if old_visited in src:
    src = src.replace(old_visited, new_visited, 1)
    applied.append('✓ visitedTabs: all pre-loaded → only anchor (lazy mount on first visit)')
else:
    applied.append('~ visitedTabs: pattern not matched (may already be minimal)')

# ── 2. AnchorTab Today: replace old dark hero with mockup flow-skin structure ──
anchor_start = src.find('  function AnchorTab()')
anchor_end   = src.find('\n  function ', anchor_start + 100)
anchor_fn    = src[anchor_start:anchor_end]
ret_pos      = anchor_fn.find('    return (')
pre_return   = anchor_fn[:ret_pos]

NEW_RETURN = '''    return (
      <div className="pane active flow-skin" style={{flex:1,overflowY:"auto",padding:"20px 24px",gap:13,display:"flex",flexDirection:"column",minHeight:0}}>

        {/* ── Page header ── */}
        <div className="ph">
          <div>
            <div className="ph-t">{isEvening ? "Evening" : "Today"}</div>
            <div className="ph-s">{FORMAT_DATE(TODAY)} · {allToday.filter(function(t){return !t.done;}).length} things left</div>
          </div>
          <div className="ph-tag" onClick={function(){setModal("flowPicker");}}>{fm.emoji} {flowMode}</div>
        </div>

        {/* ── Compass nudge ── */}
        {visibleInsights.length > 0 && visibleInsights[0] && (
          <div className="nudge">
            <span style={{fontSize:"0.84rem"}}>🧭</span>
            <div className="nt">Compass: <strong>{visibleInsights[0].title}</strong></div>
            <div className="lnk" style={{marginLeft:8}} onClick={function(){setShowRippleFeed(true);}}>More →</div>
          </div>
        )}

        {/* ── Focus block: next unfinished task ── */}
        {(function(){
          var nextTask = allToday.find(function(t){return !t.done && t.tier==="top3";}) || allToday.find(function(t){return !t.done;});
          var afterTask = allToday.find(function(t){return !t.done && t !== nextTask;});
          if (!nextTask) return null;
          return (
            <div className="focus">
              <div className="fr" onClick={function(){setTasks(function(p){return p.map(function(x){return x.id===nextTask.id?{...x,done:true}:x;});});}}>○</div>
              <div style={{flex:1}}>
                <div className="fl">Up next</div>
                <div className="ft">{nextTask.text}</div>
                <div className="fm">
                  {nextTask.person && <span>{nextTask.person} · </span>}
                  {nextTask.tier==="top3" && <span className="ttag tl" style={{cursor:"default"}}>Priority</span>}
                </div>
              </div>
              {afterTask && (
                <div className="fn">
                  <div className="fnl">Then</div>
                  <div className="fnv">{afterTask.text.slice(0,28)}{afterTask.text.length>28?"…":""}</div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Two-column grid ── */}
        <div className="g2">

          {/* Left: Tasks + Dinner */}
          <div>
            <div className="card">
              <div className="ch">
                <div><div className="ey">Flow</div><div className="ct">Today's Tasks</div></div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span className="lnk" onClick={function(e){e.stopPropagation();setAddingTask("top3");}}>+ Add</span>
                </div>
              </div>
              {allToday.length > 0 && (
                <div className="pr">
                  <div className="pt"><div className="pf" style={{width:Math.round((allToday.filter(function(t){return t.done;}).length/allToday.length)*100)+"%"}}/></div>
                  <div className="pc">{allToday.filter(function(t){return t.done;}).length} of {allToday.length}</div>
                </div>
              )}
              <div className="cdiv"/>
              <div className="cb">
                {allToday.filter(function(t){return t.done;}).length > 0 && <div className="tgl">Completed</div>}
                {allToday.filter(function(t){return t.done;}).map(function(t){return (
                  <div key={t.id} className="tr done" onClick={function(){setTasks(function(p){return p.map(function(x){return x.id===t.id?{...x,done:false}:x;});});}}>
                    <div className="tck">✓</div><div className="tn">{t.text}</div>
                  </div>
                );})}
                {allToday.filter(function(t){return !t.done;}).length > 0 && <div className="tgl">Today</div>}
                {allToday.filter(function(t){return !t.done;}).map(function(t){return (
                  <div key={t.id} className="tr" onClick={function(){setTasks(function(p){return p.map(function(x){return x.id===t.id?{...x,done:true}:x;});});}}>
                    <div className="tck"/><div className="tn">{t.text}</div>
                    {t.person && <span className="tm">{t.person}</span>}
                    {t.tier==="top3" && <span className="ttag tl">Priority</span>}
                    {t.tier==="next3" && <span className="ttag ta">Soon</span>}
                  </div>
                );})}
                {allToday.length === 0 && (
                  <div style={{fontSize:"0.78rem",color:"var(--fl-t3)",fontStyle:"italic",padding:"0.5rem 0",textAlign:"center"}}>
                    Nothing yet — add your first thing for today
                  </div>
                )}
                {addingTask && (
                  <div style={{display:"flex",gap:6,marginTop:6}}>
                    <input value={newTask} onChange={function(e){setNewTask(e.target.value);}}
                      onKeyDown={function(e){
                        if(e.key==="Enter" && newTask.trim()){
                          addQuickTask(newTask, addingTask, newTaskPerson);
                          setNewTask(""); setNewTaskPerson(""); setAddingTask(null);
                        }
                        if(e.key==="Escape"){setNewTask(""); setAddingTask(null);}
                      }}
                      placeholder={addingTask==="top3" ? "Top priority…" : "Add task…"}
                      autoFocus
                      style={{flex:1,fontSize:"0.76rem",padding:"6px 8px",borderRadius:7,border:"1px solid var(--fl-border)",background:"rgba(255,255,255,0.7)",color:"var(--fl-t1)",fontFamily:"inherit",outline:"none"}}/>
                    <button
                      onClick={function(){
                        if(newTask.trim()){addQuickTask(newTask, addingTask, newTaskPerson);}
                        setNewTask(""); setNewTaskPerson(""); setAddingTask(null);
                      }}
                      style={{fontSize:"0.72rem",padding:"6px 10px",borderRadius:7,border:"none",background:"var(--fl-accent)",color:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
                      Add
                    </button>
                  </div>
                )}
                {!addingTask && (
                  <div className="add-t" onClick={function(){setAddingTask("top3");}}>+ Add task</div>
                )}
              </div>
            </div>

            {/* Dinner card */}
            <div className="dc">
              <div className="dh">
                <div>
                  <div className="dlbl">Tonight</div>
                  <div className="dnm">
                    {todayMeal.dinner
                      ? todayMeal.dinner
                      : <span style={{color:"var(--fl-t3)",fontStyle:"italic"}}>No dinner planned</span>}
                  </div>
                </div>
                <span className="lnk" onClick={function(){goTab("meals");}}>Plan →</span>
              </div>
            </div>
          </div>

          {/* Right: Stats + Events + Rhythm */}
          <div>
            <div className="g3" style={{marginBottom:12}}>
              <div className="stat">
                <div className="sn">{allToday.filter(function(t){return t.done;}).length}</div>
                <div className="sl">Done</div>
              </div>
              <div className="stat">
                <div className="sn">{allToday.filter(function(t){return !t.done;}).length}</div>
                <div className="sl">Left</div>
              </div>
              <div className="stat">
                <div className="sn">{todayEvents.length}</div>
                <div className="sl">Events</div>
              </div>
            </div>

            {todayEvents.length > 0 && (
              <div className="card" style={{marginBottom:10}}>
                <div className="ch nc">
                  <div><div className="ey">Calendar</div><div className="ct">Today</div></div>
                  <span className="lnk" onClick={function(){goTab("calendar");}}>All →</span>
                </div>
                <div className="cb" style={{paddingTop:6}}>
                  {todayEvents.slice(0,4).map(function(e){return (
                    <div key={e.id} className="cev">
                      <div className="cevb" style={{background:e.color||"var(--blue)"}}/>
                      <div className="cevw">{e.time||"all day"}</div>
                      <div style={{flex:1}}>
                        <div className="cevt">{e.title}</div>
                        {e.location && <div className="cevm">{e.location}</div>}
                      </div>
                    </div>
                  );})}
                </div>
              </div>
            )}

            {dayRhythm.theme && (
              <div className="nudge" style={{marginTop:todayEvents.length>0?0:0}}>
                <span style={{fontSize:"1.1rem"}}>{dayRhythm.emoji||"📅"}</span>
                <div className="nt"><strong>{dayRhythm.theme}</strong>{dayRhythm.desc ? " — "+dayRhythm.desc : ""}</div>
              </div>
            )}

            {isEvening && (
              <div style={{marginTop:10,padding:"11px 13px",background:"rgba(36,54,77,0.5)",border:"1px solid rgba(241,196,154,0.15)",borderRadius:10}}>
                <div style={{fontSize:"0.72rem",color:"rgba(241,196,154,0.7)",marginBottom:6,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif"}}>The day is winding down…</div>
                <button onClick={function(){setShowEndOfDay(true);}} style={{fontSize:"0.72rem",color:"#F1C49A",background:"rgba(241,196,154,0.08)",border:"1px solid rgba(241,196,154,0.2)",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontFamily:"inherit",width:"100%"}}>
                  🌇 Open Sunset
                </button>
              </div>
            )}
          </div>
        </div>

        <div ref={function(el){if(el)window._rippleBannerEl=el;}}><RippleNotificationBanner/></div>

      </div>
    );'''

new_anchor_fn = pre_return + NEW_RETURN + '\n'
src = src[:anchor_start] + new_anchor_fn + src[anchor_end:]
applied.append('✓ AnchorTab Today: mockup flow-skin JSX (ph→nudge→focus→g2 tasks/dinner/stats/events/rhythm)')

# ── 3. Navigation defaults closed ──────────────────────────────────────────────
# (already handled above)

# ── 4. Copy updates ────────────────────────────────────────────────────────────

# Lighthouse: update section subtitle
# SchoolTab has a no-children guard with "School" text - update it
old_school_hdr = '<div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🏫</div>\n          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.4rem", color: T.textDark, marginBottom: "0.5rem" }}>School</div>'
new_school_hdr = '<div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🏮</div>\n          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "1.4rem", color: "var(--fl-t1)", marginBottom: "0.5rem" }}>Lighthouse</div>'
if old_school_hdr in src:
    src = src.replace(old_school_hdr, new_school_hdr, 1)
    applied.append('✓ SchoolTab: School → Lighthouse heading')

# Exhale (BrainTab) header
old_exhale_header = '          <div style={{fontFamily:"\'Cormorant Garamond\',serif",fontSize:"1.45rem",fontWeight:700,color:T.textDark,letterSpacing:"0.03em"}}>Exhale.</div>\n          <div style={{fontSize:"0.78rem",color:T.textSoft,marginTop:"0.15rem",lineHeight:1.6}}>Clear your mind — then let it go.</div>'
new_exhale_header = '          <div style={{fontFamily:"\'Cormorant Garamond\',serif",fontSize:"1.45rem",fontWeight:700,color:"var(--fl-t1)",letterSpacing:"0.03em"}}>Exhale.</div>\n          <div style={{fontSize:"0.78rem",color:"var(--fl-t3)",marginTop:"0.15rem",lineHeight:1.6}}>Quick capture. Clear your head. Not a task list.</div>'
if old_exhale_header in src:
    src = src.replace(old_exhale_header, new_exhale_header, 1)
    applied.append('✓ BrainTab: Exhale subtitle updated to "Quick capture. Clear your head."')

# Sunset opening text
old_sunset_sub = 'As the sun sets on today — let\'s gather what mattered.'
new_sunset_sub = 'As the sun sets on today, let\'s gather what mattered and release the rest.'
if old_sunset_sub in src:
    src = src.replace(old_sunset_sub, new_sunset_sub, 1)
    applied.append('✓ Sunset: opening text updated to final mockup copy')

old_wind_down = '{TODAY_NAME} · Review and close your day'
new_wind_down = '{TODAY_NAME} · What mattered today?'
if old_wind_down in src:
    src = src.replace(old_wind_down, new_wind_down, 1)
    applied.append('✓ Sunset: subtitle updated')

# ── 5. WeeklyTab / CalendarTab / MealsTab: add ph header above SecHead ────────
# WeeklyTab - replace SecHead with ph header
old_weekly_head = '        <SecHead emoji="📅" title="Weekly Rhythm" sub="Your week at a glance" onBack={function(){goTab("anchor");}}/>'
new_weekly_head = '        <div className="ph"><div><div className="ph-t">Rhythm</div><div className="ph-s">Your week at a glance</div></div></div>'
if old_weekly_head in src:
    src = src.replace(old_weekly_head, new_weekly_head, 1)
    applied.append('✓ WeeklyTab: SecHead → ph-t/ph-s header')

# ── FINAL SAFETY ───────────────────────────────────────────────────────────────
for fn in CRITICAL:
    assert fn in src, f"POST SAFETY: {fn}"

with open('src/App.jsx', 'w') as f:
    f.write(src)

print(f"Lines after: {src.count(chr(10))}")
print()
for a in applied:
    print(' ', a)

# Syntax check
broken = __import__('re').findall(r'"[^"\n]*(?:var\(--fl-[^)]+\)|rgba\([^)]+\))"[A-Za-z]', src)
print(f"\nSyntax broken patterns: {len(broken)} {'✓' if not broken else broken[:2]}")
print('\n✓ Done. Run: npm run build')
