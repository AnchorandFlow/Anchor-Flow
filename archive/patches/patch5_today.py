# AnchorTab Today: replace return with mockup navy/gold briefing structure
# Pre-return data layer untouched. Only JSX return replaced.

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
      <div style={{flex:1,overflowY:"auto",background:"#0e1b2e",display:"flex",flexDirection:"column",minHeight:0}}>

        {/* ── Centered forecast view ── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 32px 28px",textAlign:"center"}}>

          {/* Date + greeting eyebrow */}
          <div style={{fontSize:"0.54rem",letterSpacing:"0.24em",textTransform:"uppercase",color:"#c8a97a",fontWeight:500,marginBottom:14}}>
            {FORMAT_DATE(TODAY)}
          </div>

          {/* Main greeting */}
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"2.2rem",fontWeight:300,color:"#f5f0e8",lineHeight:1.1,marginBottom:5}}>
            {greeting}{(preferredName||authUser?.displayName)?", "+(preferredName||authUser.displayName.split(" ")[0]):""}
          </div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"0.86rem",color:"rgba(245,240,232,0.35)",marginBottom:40}}>
            Compass will shape your briefing around your answer.
          </div>

          {/* Forecast question */}
          <div style={{fontSize:"0.78rem",color:"rgba(245,240,232,0.6)",marginBottom:24}}>
            How are things feeling today?
          </div>

          {/* Forecast chips — Calm / Waves / Survival */}
          <div style={{display:"flex",gap:12,justifyContent:"center",width:"100%",maxWidth:400}}>
            {[
              {id:"Calm",    emoji:"⚓", label:"Calm\nSeas",     sub:"Feeling good",  border:"rgba(200,169,122,0.35)", glow:"rgba(200,169,122,0.1)"},
              {id:"Busy",    emoji:"🌊", label:"Some\nWaves",    sub:"A bit much",    border:"rgba(122,168,200,0.35)", glow:"rgba(122,168,200,0.09)"},
              {id:"Survival",emoji:"🛟", label:"Survival\nMode", sub:"Just today",    border:"rgba(200,122,138,0.35)", glow:"rgba(200,122,138,0.09)"},
            ].map(function(m){
              var isAct = flowMode===m.id;
              return (
                <div key={m.id}
                  onClick={function(){setModal("flowPicker");}}
                  style={{
                    flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                    gap:7, padding:"16px 14px 13px",
                    border:"1px solid "+(isAct?m.border:"rgba(245,240,232,0.1)"),
                    borderRadius:15, cursor:"pointer", transition:"all 0.2s",
                    background:isAct?m.glow:"rgba(22,36,64,0.55)",
                    backdropFilter:"blur(12px)", position:"relative", overflow:"hidden",
                    transform:isAct?"translateY(-2px)":"none",
                  }}>
                  <span style={{fontSize:"1.8rem"}}>{m.emoji}</span>
                  <div style={{fontSize:"0.73rem",color:"#f5f0e8",fontWeight:400,lineHeight:1.28,whiteSpace:"pre-line",textAlign:"center"}}>{m.label}</div>
                  <div style={{fontSize:"0.59rem",color:"rgba(245,240,232,0.4)"}}>{m.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Scrollable briefing below forecast ── */}
        <div style={{padding:"0 28px 40px",display:"flex",flexDirection:"column",gap:16}}>

          {/* Compass briefing */}
          {visibleInsights.length>0&&visibleInsights[0]&&(
            <div style={{background:"rgba(200,169,122,0.06)",border:"1px solid rgba(200,169,122,0.15)",borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:"0.54rem",letterSpacing:"0.18em",textTransform:"uppercase",color:"#c8a97a",fontWeight:500,marginBottom:7}}>🧭 Compass</div>
              <div style={{fontSize:"0.82rem",color:"rgba(245,240,232,0.82)",lineHeight:1.6,fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic"}}>
                {visibleInsights[0].title}{visibleInsights[0].body?" — "+visibleInsights[0].body:""}
              </div>
              <div onClick={function(){setShowRippleFeed(true);}} style={{fontSize:"0.62rem",color:"rgba(200,169,122,0.55)",marginTop:8,cursor:"pointer"}}>
                Full briefing →
              </div>
            </div>
          )}

          {/* Big Thing / Helpful Thing / Meaningful Thing */}
          <div>
            <div style={{fontSize:"0.54rem",letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(245,240,232,0.28)",marginBottom:10,fontWeight:500}}>Today's Focus</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {[
                {task:top3Raw.find(function(t){return !t.done;}),   label:"Big Thing",       color:"#c8a97a",               dimColor:"rgba(200,169,122,0.35)"},
                {task:next3Raw.find(function(t){return !t.done;}),  label:"Helpful Thing",   color:"rgba(183,212,207,0.9)", dimColor:"rgba(183,212,207,0.3)"},
                {task:allToday.find(function(t){return !t.done&&t.tier!=="top3"&&t.tier!=="next3";}), label:"Meaningful Thing", color:"rgba(126,184,154,0.9)", dimColor:"rgba(126,184,154,0.3)"},
              ].map(function(item,i){
                if(!item.task) return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:10,border:"1px dashed rgba(245,240,232,0.07)"}}>
                    <div style={{width:20,height:20,borderRadius:"50%",border:"1px dashed rgba(245,240,232,0.15)",flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:"0.54rem",letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(245,240,232,0.22)",marginBottom:2}}>{item.label}</div>
                      <div style={{fontSize:"0.74rem",color:"rgba(245,240,232,0.2)",fontStyle:"italic"}}>Nothing set yet</div>
                    </div>
                    <div onClick={function(){setAddingTask(i===0?"top3":i===1?"next3":"more");}} style={{fontSize:"0.62rem",color:"rgba(245,240,232,0.2)",cursor:"pointer",padding:"2px 6px"}}>+ Add</div>
                  </div>
                );
                return (
                  <div key={i}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,border:"1px solid "+(item.task.done?"rgba(245,240,232,0.05)":"rgba(245,240,232,0.09)"),background:item.task.done?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.04)",cursor:"pointer",transition:"all 0.15s"}}
                    onClick={function(){setTasks(function(p){return p.map(function(x){return x.id===item.task.id?{...x,done:!item.task.done}:x;});});}}>
                    <div style={{width:20,height:20,borderRadius:"50%",border:"2px solid "+(item.task.done?item.color:item.dimColor),background:item.task.done?item.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
                      {item.task.done&&<span style={{fontSize:"0.55rem",color:"#0e1b2e",fontWeight:900}}>✓</span>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:"0.54rem",letterSpacing:"0.1em",textTransform:"uppercase",color:item.task.done?"rgba(245,240,232,0.2)":item.color,marginBottom:2}}>{item.label}</div>
                      <div style={{fontSize:"0.8rem",color:item.task.done?"rgba(245,240,232,0.28)":"rgba(245,240,232,0.88)",textDecoration:item.task.done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.task.text}</div>
                      {item.task.person&&!item.task.done&&<div style={{fontSize:"0.6rem",color:"rgba(245,240,232,0.32)",marginTop:2}}>{item.task.person}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Add task */}
            {addingTask?(
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <input value={newTask} onChange={function(e){setNewTask(e.target.value);}}
                  onKeyDown={function(e){if(e.key==="Enter"&&newTask.trim()){addQuickTask(newTask,addingTask,newTaskPerson);setNewTask("");setNewTaskPerson("");setAddingTask(null);}if(e.key==="Escape"){setNewTask("");setAddingTask(null);}}}
                  placeholder="Add task…" autoFocus
                  style={{flex:1,fontSize:"0.76rem",padding:"8px 10px",borderRadius:8,border:"1px solid rgba(200,169,122,0.25)",background:"rgba(255,255,255,0.05)",color:"#f5f0e8",fontFamily:"inherit",outline:"none"}}/>
                <button onClick={function(){if(newTask.trim()){addQuickTask(newTask,addingTask,newTaskPerson);}setNewTask("");setNewTaskPerson("");setAddingTask(null);}}
                  style={{fontSize:"0.72rem",padding:"8px 12px",borderRadius:8,border:"none",background:"rgba(200,169,122,0.2)",color:"#c8a97a",cursor:"pointer",fontFamily:"inherit"}}>Add</button>
              </div>
            ):(
              <div onClick={function(){setAddingTask("top3");}}
                style={{marginTop:8,padding:"7px 0",fontSize:"0.68rem",color:"rgba(200,169,122,0.38)",cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:"color 0.12s"}}
                onMouseEnter={function(e){e.currentTarget.style.color="rgba(200,169,122,0.65)";}}
                onMouseLeave={function(e){e.currentTarget.style.color="rgba(200,169,122,0.38)";}}>
                + Add a task
              </div>
            )}
          </div>

          {/* Family Moment + On the Horizon */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"rgba(22,36,64,0.55)",border:"1px solid rgba(200,169,122,0.1)",borderRadius:12,padding:"14px 15px",backdropFilter:"blur(10px)"}}>
              <div style={{fontSize:"0.54rem",letterSpacing:"0.16em",textTransform:"uppercase",color:"rgba(245,240,232,0.28)",marginBottom:8,fontWeight:500}}>Tonight</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.05rem",fontWeight:400,color:todayMeal.dinner?"#f5f0e8":"rgba(245,240,232,0.22)",fontStyle:todayMeal.dinner?"normal":"italic",marginBottom:6,lineHeight:1.3}}>
                {todayMeal.dinner||"No dinner planned"}
              </div>
              <div onClick={function(){goTab("meals");}} style={{fontSize:"0.6rem",color:"rgba(200,169,122,0.45)",cursor:"pointer",transition:"color 0.12s"}}
                onMouseEnter={function(e){e.currentTarget.style.color="rgba(200,169,122,0.75)";}}
                onMouseLeave={function(e){e.currentTarget.style.color="rgba(200,169,122,0.45)";}}>
                {todayMeal.dinner?"Change →":"Plan dinner →"}
              </div>
            </div>
            <div style={{background:"rgba(22,36,64,0.55)",border:"1px solid rgba(245,240,232,0.07)",borderRadius:12,padding:"14px 15px",backdropFilter:"blur(10px)"}}>
              <div style={{fontSize:"0.54rem",letterSpacing:"0.16em",textTransform:"uppercase",color:"rgba(245,240,232,0.28)",marginBottom:8,fontWeight:500}}>On the Horizon</div>
              {tmrEvents.length>0?(
                tmrEvents.slice(0,2).map(function(e,i){return(
                  <div key={i} style={{fontSize:"0.76rem",color:"rgba(245,240,232,0.65)",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"'Cormorant Garamond',serif"}}>{e.title}</div>
                );})
              ):(
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1rem",color:"rgba(245,240,232,0.2)",fontStyle:"italic"}}>Clear skies ahead</div>
              )}
              {tmrMeal2&&tmrMeal2.dinner&&(
                <div style={{fontSize:"0.6rem",color:"rgba(245,240,232,0.28)",marginTop:4}}>Dinner: {tmrMeal2.dinner}</div>
              )}
            </div>
          </div>

          {/* Today events (compact) */}
          {todayEvents.length>0&&(
            <div>
              <div style={{fontSize:"0.54rem",letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(245,240,232,0.28)",marginBottom:8,fontWeight:500}}>Today's Calendar</div>
              {todayEvents.slice(0,4).map(function(e){return(
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(245,240,232,0.05)"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:e.color||"#c8a97a",flexShrink:0}}/>
                  <div style={{fontSize:"0.63rem",color:"rgba(245,240,232,0.38)",width:50,flexShrink:0}}>{e.time||"all day"}</div>
                  <div style={{fontSize:"0.76rem",color:"rgba(245,240,232,0.72)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</div>
                </div>
              );})}
            </div>
          )}

          {/* Day rhythm */}
          {dayRhythm&&dayRhythm.theme&&(
            <div style={{padding:"12px 14px",background:"rgba(200,169,122,0.04)",border:"1px solid rgba(200,169,122,0.09)",borderRadius:10,display:"flex",alignItems:"center",gap:11}}>
              <span style={{fontSize:"1.2rem",flexShrink:0}}>{dayRhythm.emoji||"📅"}</span>
              <div>
                <div style={{fontSize:"0.74rem",color:"rgba(245,240,232,0.7)",fontWeight:400}}>{dayRhythm.theme}</div>
                {dayRhythm.desc&&<div style={{fontSize:"0.62rem",color:"rgba(245,240,232,0.35)",marginTop:2}}>{dayRhythm.desc}</div>}
              </div>
            </div>
          )}

          {/* Evening Sunset CTA */}
          {isEvening&&(
            <div onClick={function(){setShowEndOfDay(true);}}
              style={{padding:"14px 16px",background:"rgba(36,54,77,0.5)",border:"1px solid rgba(241,196,154,0.12)",borderRadius:11,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}
              onMouseEnter={function(e){e.currentTarget.style.borderColor="rgba(241,196,154,0.28)";}}
              onMouseLeave={function(e){e.currentTarget.style.borderColor="rgba(241,196,154,0.12)";}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"0.82rem",color:"rgba(241,196,154,0.55)",marginBottom:6}}>The day is winding down…</div>
              <div style={{fontSize:"0.76rem",color:"#F1C49A",fontWeight:400}}>🌇 Open Sunset</div>
            </div>
          )}

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
assert not broken, f"Broken patterns: {broken[:2]}"

a2 = new_src.find('  function AnchorTab()')
c2 = new_src.find('  function CalendarTab(', a2)
tail = new_src[c2-30:c2]
assert '  }\n\n' in tail, f"AnchorTab not closed: {tail!r}"

with open('src/App.jsx','w') as f:
    f.write(new_src)

print(f"Lines after: {new_src.count(chr(10))}")
print(f"AnchorTab closes: {tail!r}")
print("Safety ✓  Syntax ✓")
print("Run: npm run build")
