# Pass: Replace AnchorTab Today return with navy/gold mockup structure
# Preserves ALL pre-return data/handlers — only JSX return is replaced
# No sidebar, no CSS injection, no other components touched

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

# ── New Today return: navy/gold, mockup structure ──────────────────────────────
NEW_RETURN = '''    return (
      <div style={{flex:1,overflowY:"auto",background:"#0e1b2e",padding:"28px 28px 40px",display:"flex",flexDirection:"column",gap:18,minHeight:0,color:"#f5f0e8"}}>

        {/* ── Page header ── */}
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:"0.54rem",letterSpacing:"0.22em",textTransform:"uppercase",color:"#c8a97a",fontWeight:500,marginBottom:6}}>{FORMAT_DATE(TODAY)}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.7rem",fontWeight:400,color:"#f5f0e8",lineHeight:1}}>
              {greeting}{(preferredName||authUser?.displayName)?", "+(preferredName||authUser.displayName.split(" ")[0]):""}
            </div>
          </div>
          <div onClick={function(){setShowEndOfDay(true);}} style={{fontSize:"0.65rem",color:"rgba(241,196,154,0.6)",cursor:"pointer",padding:"6px 10px",border:"1px solid rgba(241,196,154,0.15)",borderRadius:8,transition:"all 0.15s",fontFamily:"'DM Sans',sans-serif"}}
            onMouseEnter={function(e){e.currentTarget.style.borderColor="rgba(241,196,154,0.4)";e.currentTarget.style.color="#F1C49A";}}
            onMouseLeave={function(e){e.currentTarget.style.borderColor="rgba(241,196,154,0.15)";e.currentTarget.style.color="rgba(241,196,154,0.6)";}}>
            🌇 Sunset
          </div>
        </div>

        {/* ── Forecast: Calm Seas / Some Waves / Survival ── */}
        <div style={{display:"flex",gap:8}}>
          {[
            {id:"Calm",   emoji:"⚓", label:"Calm Seas",    sub:"Feeling good",  color:"rgba(200,169,122,0.25)", active:"rgba(200,169,122,0.18)", border:"rgba(200,169,122,0.35)"},
            {id:"Busy",   emoji:"🌊", label:"Some Waves",   sub:"A bit much",    color:"rgba(122,168,200,0.15)", active:"rgba(122,168,200,0.2)",  border:"rgba(122,168,200,0.4)"},
            {id:"Survival",emoji:"🛟",label:"Survival Mode",sub:"Just today",    color:"rgba(200,122,138,0.12)", active:"rgba(200,122,138,0.18)", border:"rgba(200,122,138,0.38)"},
          ].map(function(m){
            var isAct = flowMode===m.id;
            return(
              <div key={m.id} onClick={function(){setModal("flowPicker");}}
                style={{flex:1,display:"flex",alignItems:"center",gap:10,padding:"11px 13px",borderRadius:11,cursor:"pointer",border:"1px solid "+(isAct?m.border:"rgba(245,240,232,0.08)"),background:isAct?m.active:"rgba(255,255,255,0.03)",transition:"all 0.15s",position:"relative",overflow:"hidden"}}>
                <span style={{fontSize:"1.35rem",flexShrink:0}}>{m.emoji}</span>
                <div>
                  <div style={{fontSize:"0.72rem",fontWeight:isAct?600:400,color:isAct?"#f5f0e8":"rgba(245,240,232,0.55)",lineHeight:1}}>{m.label}</div>
                  <div style={{fontSize:"0.57rem",color:"rgba(245,240,232,0.3)",marginTop:2}}>{m.sub}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Compass briefing ── */}
        {visibleInsights.length>0&&visibleInsights[0]&&(
          <div style={{background:"rgba(200,169,122,0.06)",border:"1px solid rgba(200,169,122,0.14)",borderRadius:11,padding:"13px 15px",display:"flex",gap:11,alignItems:"flex-start"}}>
            <span style={{fontSize:"1.1rem",flexShrink:0}}>🧭</span>
            <div style={{flex:1}}>
              <div style={{fontSize:"0.57rem",letterSpacing:"0.18em",textTransform:"uppercase",color:"#c8a97a",marginBottom:5,fontWeight:500}}>Compass</div>
              <div style={{fontSize:"0.78rem",color:"rgba(245,240,232,0.8)",lineHeight:1.55}}>{visibleInsights[0].title}{visibleInsights[0].body?" — "+visibleInsights[0].body:""}</div>
            </div>
            <div onClick={function(){setShowRippleFeed(true);}} style={{fontSize:"0.62rem",color:"#c8a97a",cursor:"pointer",flexShrink:0,padding:"2px 0",marginTop:18}}>More →</div>
          </div>
        )}

        {/* ── Focus: Big / Helpful / Meaningful ── */}
        <div>
          <div style={{fontSize:"0.54rem",letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(245,240,232,0.28)",marginBottom:10,fontWeight:500}}>Today's Focus</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[
              {task:top3Raw[0],   label:"Big Thing",       color:"#c8a97a"},
              {task:next3Raw[0],  label:"Helpful Thing",   color:"rgba(122,168,200,0.9)"},
              {task:allToday.find(function(t){return !t.done&&t.tier!=="top3"&&t.tier!=="next3";}), label:"Meaningful Thing", color:"rgba(126,184,154,0.9)"},
            ].map(function(item,i){
              if(!item.task) return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,border:"1px dashed rgba(245,240,232,0.08)",background:"transparent"}}>
                  <div style={{width:18,height:18,borderRadius:"50%",border:"1px dashed rgba(245,240,232,0.2)",flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"0.57rem",color:"rgba(245,240,232,0.25)",marginBottom:2,letterSpacing:"0.1em",textTransform:"uppercase"}}>{item.label}</div>
                    <div style={{fontSize:"0.75rem",color:"rgba(245,240,232,0.2)",fontStyle:"italic"}}>Nothing set yet</div>
                  </div>
                  <div onClick={function(){setAddingTask("top3");}} style={{fontSize:"0.65rem",color:"rgba(245,240,232,0.25)",cursor:"pointer"}}>+ Add</div>
                </div>
              );
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,border:"1px solid rgba(245,240,232,0.08)",background:item.task.done?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.04)",transition:"all 0.15s",cursor:"pointer"}}
                  onClick={function(){setTasks(function(p){return p.map(function(x){return x.id===item.task.id?{...x,done:!item.task.done}:x;});});}}>
                  <div style={{width:18,height:18,borderRadius:"50%",border:"1.5px solid "+(item.task.done?item.color:"rgba(245,240,232,0.25)"),background:item.task.done?item.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
                    {item.task.done&&<span style={{fontSize:"0.5rem",color:"#0e1b2e",fontWeight:900}}>✓</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"0.57rem",color:item.color,marginBottom:2,letterSpacing:"0.1em",textTransform:"uppercase",opacity:item.task.done?0.4:1}}>{item.label}</div>
                    <div style={{fontSize:"0.8rem",color:item.task.done?"rgba(245,240,232,0.3)":"rgba(245,240,232,0.85)",textDecoration:item.task.done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.task.text}</div>
                    {item.task.person&&<div style={{fontSize:"0.6rem",color:"rgba(245,240,232,0.3)",marginTop:2}}>{item.task.person}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Quick add */}
          {addingTask?(
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <input value={newTask} onChange={function(e){setNewTask(e.target.value);}}
                onKeyDown={function(e){if(e.key==="Enter"&&newTask.trim()){addQuickTask(newTask,addingTask,newTaskPerson);setNewTask("");setNewTaskPerson("");setAddingTask(null);}if(e.key==="Escape"){setNewTask("");setAddingTask(null);}}}
                placeholder="Add task…" autoFocus
                style={{flex:1,fontSize:"0.76rem",padding:"8px 10px",borderRadius:8,border:"1px solid rgba(200,169,122,0.25)",background:"rgba(255,255,255,0.05)",color:"#f5f0e8",fontFamily:"inherit",outline:"none"}}/>
              <button onClick={function(){if(newTask.trim()){addQuickTask(newTask,addingTask,newTaskPerson);}setNewTask("");setNewTaskPerson("");setAddingTask(null);}}
                style={{fontSize:"0.72rem",padding:"8px 12px",borderRadius:8,border:"none",background:"rgba(200,169,122,0.2)",color:"#c8a97a",cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>Add</button>
            </div>
          ):(
            <div onClick={function(){setAddingTask("top3");}} style={{marginTop:8,padding:"8px 0",fontSize:"0.7rem",color:"rgba(200,169,122,0.45)",cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:"color 0.12s"}}
              onMouseEnter={function(e){e.currentTarget.style.color="rgba(200,169,122,0.75)";}}
              onMouseLeave={function(e){e.currentTarget.style.color="rgba(200,169,122,0.45)";}}>
              <span style={{fontSize:"0.9rem"}}>+</span> Add a task
            </div>
          )}
        </div>

        {/* ── Family Moment / dinner tonight ── */}
        <div style={{display:"flex",gap:10}}>
          {/* Tonight */}
          <div style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,240,232,0.07)",borderRadius:11,padding:"13px 14px"}}>
            <div style={{fontSize:"0.54rem",letterSpacing:"0.16em",textTransform:"uppercase",color:"rgba(245,240,232,0.28)",marginBottom:6,fontWeight:500}}>Tonight</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1rem",color:todayMeal.dinner?"#f5f0e8":"rgba(245,240,232,0.25)",fontStyle:todayMeal.dinner?"normal":"italic"}}>
              {todayMeal.dinner||"No dinner planned"}
            </div>
            <div onClick={function(){goTab("meals");}} style={{fontSize:"0.62rem",color:"rgba(200,169,122,0.5)",marginTop:5,cursor:"pointer"}}>Plan →</div>
          </div>
          {/* On the Horizon */}
          <div style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(245,240,232,0.07)",borderRadius:11,padding:"13px 14px"}}>
            <div style={{fontSize:"0.54rem",letterSpacing:"0.16em",textTransform:"uppercase",color:"rgba(245,240,232,0.28)",marginBottom:6,fontWeight:500}}>On the Horizon</div>
            {tmrEvents.length>0?(
              <div>
                {tmrEvents.slice(0,2).map(function(e,i){return(
                  <div key={i} style={{fontSize:"0.75rem",color:"rgba(245,240,232,0.65)",marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</div>
                );})}
              </div>
            ):(
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1rem",color:"rgba(245,240,232,0.25)",fontStyle:"italic"}}>Clear skies ahead</div>
            )}
            {tmrMeal2.dinner&&<div style={{fontSize:"0.62rem",color:"rgba(245,240,232,0.35)",marginTop:4}}>Dinner: {tmrMeal2.dinner}</div>}
          </div>
        </div>

        {/* ── Today's events (if any) ── */}
        {todayEvents.length>0&&(
          <div>
            <div style={{fontSize:"0.54rem",letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(245,240,232,0.28)",marginBottom:8,fontWeight:500}}>Today's Calendar</div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {todayEvents.slice(0,4).map(function(e){return(
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0",borderBottom:"1px solid rgba(245,240,232,0.05)"}}>
                  <div style={{width:3,height:3,borderRadius:"50%",background:e.color||"#c8a97a",flexShrink:0,marginLeft:2}}/>
                  <div style={{fontSize:"0.65rem",color:"rgba(245,240,232,0.4)",flexShrink:0,width:52}}>{e.time||"all day"}</div>
                  <div style={{fontSize:"0.76rem",color:"rgba(245,240,232,0.75)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</div>
                </div>
              );})}
            </div>
          </div>
        )}

        {/* ── Day rhythm ── */}
        {dayRhythm.theme&&(
          <div style={{padding:"12px 14px",background:"rgba(200,169,122,0.04)",border:"1px solid rgba(200,169,122,0.1)",borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:"1.2rem"}}>{dayRhythm.emoji||"📅"}</span>
            <div>
              <div style={{fontSize:"0.72rem",color:"rgba(245,240,232,0.65)",fontWeight:500}}>{dayRhythm.theme}</div>
              {dayRhythm.desc&&<div style={{fontSize:"0.62rem",color:"rgba(245,240,232,0.35)",marginTop:2}}>{dayRhythm.desc}</div>}
            </div>
          </div>
        )}

      </div>
    );
  }

'''

new_src = src[:anchor_start] + pre_return + NEW_RETURN + src[anchor_end:]

for fn in CRITICAL:
    assert fn in new_src, f"POST SAFETY: {fn}"

# Syntax check
import re
broken = re.findall(r'"[^"\n]*(?:var\(--fl-[^)]+\)|rgba\([^)]+\))"[A-Za-z]', new_src)
assert len(broken) == 0, f"Broken patterns: {broken[:2]}"

# Verify AnchorTab closes properly  
a2 = new_src.find('  function AnchorTab()')
c2 = new_src.find('  function CalendarTab(', a2)
last40 = new_src[c2-40:c2]
assert '  }\n\n' in last40, f"AnchorTab not properly closed: {last40!r}"

with open('src/App.jsx','w') as f:
    f.write(new_src)

print(f"Lines after: {new_src.count(chr(10))}")
print("AnchorTab closes with:", repr(new_src[c2-30:c2]))
print("Safety: ✓")
print("Syntax: ✓")
print("Run: npm run build")
