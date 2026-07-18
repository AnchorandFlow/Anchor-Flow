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
CE  = "src/compass/compassEngine.js"
CP  = "src/compass/compassPrompts.js"

# ── 1. PERSON_COLORS constant + getPersonColor helper ─────────────────────────
results.append(swap(APP,
'const MEAL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];\nconst TREASURE_ICONS',
'''const MEAL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
var PERSON_COLORS = {
  Madi:    { bg: "#e0f5f1", border: "#3aaa91", text: "#1a6657" },
  Rylan:   { bg: "#faeae3", border: "#d4704a", text: "#8a3820" },
  Kinzlee: { bg: "#eeebf8", border: "#8b7dbf", text: "#4a3d85" },
  Briar:   { bg: "#fdf3dc", border: "#d4a240", text: "#7a5a10" },
  family:  { bg: "#e3eef7", border: "#4a7fa8", text: "#1c4a6e" },
};
var PERSON_COLOR_DEFAULT = { bg: "#f0ede8", border: "#a09080", text: "#4a3e36" };
function getPersonColor(forPerson) {
  if (!forPerson) return PERSON_COLOR_DEFAULT;
  return PERSON_COLORS[forPerson] || PERSON_COLOR_DEFAULT;
}
const TREASURE_ICONS''',
"1. PERSON_COLORS + getPersonColor"))

# ── 2. calFilter state ────────────────────────────────────────────────────────
results.append(swap(APP,
'  const [calView,setCalView]           = useState("month");',
'  const [calView,setCalView]           = useState("month");\n  const [calFilter,setCalFilter]       = useState("all");',
"2. calFilter state"))

# ── 3. Filter toggle (All / Mine / Twy's) above nav bar ──────────────────────
results.append(swap(APP,
'''            }} style={{flex:1,background:calView===v?T.blue:"transparent",color:calView===v?"#fff":T.textMid,border:"none",borderRadius:"0.55rem",padding:"0.42rem 0.5rem",cursor:"pointer",fontSize:"0.78rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s",textTransform:"capitalize"}}>{v}</button>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem",padding:"0 0.15rem"}}>''',
'''            }} style={{flex:1,background:calView===v?T.blue:"transparent",color:calView===v?"#fff":T.textMid,border:"none",borderRadius:"0.55rem",padding:"0.42rem 0.5rem",cursor:"pointer",fontSize:"0.78rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s",textTransform:"capitalize"}}>{v}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:"0.3rem",marginBottom:"0.65rem",justifyContent:"center"}}>
          {[["all","All"],["mine","Mine"],["twy","Twy’s"]].map(function(item){
            var _fv=item[0],_fl=item[1];
            return (
              <button key={_fv} onClick={function(){setCalFilter(_fv);}} style={{padding:"0.22rem 0.8rem",borderRadius:"50px",border:"1.5px solid "+(calFilter===_fv?"rgba(30,58,95,0.4)":"rgba(30,58,95,0.12)"),background:calFilter===_fv?"rgba(30,58,95,0.08)":"transparent",color:calFilter===_fv?"#1e3a5f":"#7a8a9a",fontSize:"0.7rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.12s"}}>
                {_fl}
              </button>
            );
          })}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem",padding:"0 0.15rem"}}>''',
"3. filter toggle (All / Mine / Twy's)"))

# ── 4. Month chip — person color + badge + filter dimming ────────────────────
results.append(swap(APP,
'''                    {dayEvts.slice(0,2).map(e=>(
                      <div key={e.id} style={{background:e.color+"28",borderLeft:`2.5px solid ${e.color}`,borderRadius:"0 3px 3px 0",padding:"1px 3px",fontSize:"0.58rem",fontWeight:700,color:e.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.4}}>
                        {e.time&&<span style={{opacity:0.8,marginRight:2}}>{e.time}</span>}{e.title}
                      </div>
                    ))}''',
'''                    {dayEvts.slice(0,2).map(function(e){
                      var _pc=getPersonColor(e.forPerson);
                      var _dimmed=(calFilter==="mine"&&e.responsibleParent!=="L")||(calFilter==="twy"&&e.responsibleParent!=="T");
                      return (
                        <div key={e.id} style={{background:e.forPerson?_pc.bg:(e.color+"28"),borderLeft:"2.5px solid "+(e.forPerson?_pc.border:e.color),borderRadius:"0 3px 3px 0",padding:"1px 3px",fontSize:"0.58rem",fontWeight:700,color:e.forPerson?_pc.text:e.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.4,opacity:_dimmed?0.25:1,display:"flex",alignItems:"center"}}>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",minWidth:0}}>{e.time&&<span style={{opacity:0.8,marginRight:2}}>{e.time}</span>}{e.title}</span>
                          {e.responsibleParent&&<span style={{marginLeft:2,fontSize:"6px",fontWeight:800,flexShrink:0,opacity:0.85}}>{e.responsibleParent}</span>}
                        </div>
                      );
                    })}''',
"4. month chip — person color + badge + dimming"))

# ── 5. Week chip — person color + filter dimming ─────────────────────────────
results.append(swap(APP,
'''                      :dayEvts.map(e=>(
                        <div key={e.id} style={{background:e.color||T.blue,borderRadius:"0.4rem",padding:"0.22rem 0.55rem",marginBottom:"0.25rem",fontSize:"0.75rem",color:"#fff",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.time?e.time+" ":""}{e.title}</div>
                      ))''',
'''                      :dayEvts.map(function(e){
                          var _pc=getPersonColor(e.forPerson);
                          var _dimmed=(calFilter==="mine"&&e.responsibleParent!=="L")||(calFilter==="twy"&&e.responsibleParent!=="T");
                          var _bg=e.forPerson?_pc.bg:(e.color||T.blue);
                          var _col=e.forPerson?_pc.text:"#fff";
                          return (<div key={e.id} style={{background:_bg,borderLeft:e.forPerson?("2.5px solid "+_pc.border):undefined,borderRadius:"0.4rem",padding:"0.22rem 0.55rem",marginBottom:"0.25rem",fontSize:"0.75rem",color:_col,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",opacity:_dimmed?0.25:1}}>{e.time?e.time+" ":""}{e.title}</div>);
                        })''',
"5. week chip — person color + dimming"))

# ── 6a. Day view — work-hours banner (after header, before empty-state) ───────
results.append(swap(APP,
'''<button onClick={()=>openAddEvent(localDateStr(calViewDate))} style={{...btnP(T.blue,{fontSize:"0.76rem",padding:"0.32rem 0.75rem",display:"flex",alignItems:"center",gap:"0.35rem"})}}><Icon name="plus" size={13} color="#fff"/> Add</button>
            </div>
            {eventsForDay(calViewDate.getDate(),calViewDate.getMonth(),calViewDate.getFullYear()).length===0&&<p''',
'''<button onClick={()=>openAddEvent(localDateStr(calViewDate))} style={{...btnP(T.blue,{fontSize:"0.76rem",padding:"0.32rem 0.75rem",display:"flex",alignItems:"center",gap:"0.35rem"})}}><Icon name="plus" size={13} color="#fff"/> Add</button>
            </div>
            {(function(){
              var _ws=(function(){try{return JSON.parse(localStorage.getItem("af_workSchedule")||"null")||[{id:"ws1",day:"weekdays",startHour:9,endHour:17}];}catch(_e){return [{id:"ws1",day:"weekdays",startHour:9,endHour:17}];}})();
              var _jsDay=calViewDate.getDay();
              var _wentry=null;
              for(var _wi=0;_wi<_ws.length;_wi++){var _en=_ws[_wi];var _m=_en.day==="weekdays"?(_jsDay>=1&&_jsDay<=5):_en.day==="weekend"?(_jsDay===0||_jsDay===6):_en.day===_jsDay;if(_m){_wentry=_en;break;}}
              if(!_wentry)return null;
              function _fmtH(h){var a=h<12?"am":"pm";var hh=h%12||12;return hh+a;}
              return (<div style={{background:"rgba(30,58,95,0.06)",borderLeft:"3px solid rgba(30,58,95,0.18)",borderRadius:"0 0.35rem 0.35rem 0",padding:"0.32rem 0.7rem",marginBottom:"0.75rem"}}><span style={{fontSize:"0.68rem",fontWeight:700,color:"rgba(30,58,95,0.55)",letterSpacing:"0.04em"}}>Work · {_fmtH(_wentry.startHour)}–{_fmtH(_wentry.endHour)}</span></div>);
            })()}
            {eventsForDay(calViewDate.getDate(),calViewDate.getMonth(),calViewDate.getFullYear()).length===0&&<p''',
"6a. day view work banner"))

# ── 6b. Day view event rows — person color + badge + dimming ─────────────────
results.append(swap(APP,
'''            {eventsForDay(calViewDate.getDate(),calViewDate.getMonth(),calViewDate.getFullYear()).map(e=>(
              <div key={e.id} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.7rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.18rem",flexShrink:0,minWidth:44}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:e.color,marginTop:3}}/>
                  {e.time?<span style={{fontSize:"0.74rem",fontWeight:800,color:e.color}}>{e.time}</span>:<span style={{fontSize:"0.68rem",color:T.textFaint,fontWeight:600}}>all day</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.9rem"}}>{e.title}</div>
                  {e.colorLabel&&<div style={{fontSize:"0.66rem",color:e.color,fontWeight:700,marginTop:"0.1rem"}}>{calColorLabels[e.color]||e.colorCustom?.trim()||e.colorLabel}</div>}
                  {e.note&&<div style={{color:T.textMid,fontSize:"0.78rem",marginTop:"0.28rem",fontStyle:"italic"}}>📝 {e.note}</div>}
                  {notifications.some(n=>n.entityId===e.id)&&<div style={{color:T.sand,fontSize:"0.72rem",fontWeight:600,marginTop:"0.2rem"}}>🔔 Reminder set</div>}
                </div>
                <div style={{display:"flex",gap:"0.25rem",flexShrink:0}}>
                  <button onClick={()=>setShowCalNotif(showCalNotif===e.id?null:e.id)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="bell" size={13} color={T.sand}/></button>
                  <button onClick={()=>openEditEvent(e)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="edit" size={13} color={T.textMid}/></button>
                  <button onClick={()=>setCalEvents(p=>p.filter(x=>x.id!==e.id))} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
                </div>
              </div>
            ))}''',
'''            {eventsForDay(calViewDate.getDate(),calViewDate.getMonth(),calViewDate.getFullYear()).map(function(e){
              var _pc=getPersonColor(e.forPerson);
              var _dotColor=e.forPerson?_pc.border:e.color;
              var _dimmed=(calFilter==="mine"&&e.responsibleParent!=="L")||(calFilter==="twy"&&e.responsibleParent!=="T");
              return (
              <div key={e.id} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.7rem 0",borderBottom:`1px solid ${T.borderSoft}`,opacity:_dimmed?0.25:1}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.18rem",flexShrink:0,minWidth:44}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:_dotColor,marginTop:3}}/>
                  {e.time?<span style={{fontSize:"0.74rem",fontWeight:800,color:_dotColor}}>{e.time}</span>:<span style={{fontSize:"0.68rem",color:T.textFaint,fontWeight:600}}>all day</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.9rem",display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"}}>
                    <span>{e.title}</span>
                    {e.responsibleParent&&<div style={{width:16,height:16,borderRadius:"50%",background:"rgba(255,255,255,0.85)",fontSize:"9px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(0,0,0,0.1)",color:"#1e3a5f",flexShrink:0}}>{e.responsibleParent}</div>}
                  </div>
                  {e.forPerson&&<div style={{fontSize:"0.66rem",color:_pc.text,fontWeight:700,marginTop:"0.1rem"}}>for {e.forPerson}</div>}
                  {e.colorLabel&&!e.forPerson&&<div style={{fontSize:"0.66rem",color:e.color,fontWeight:700,marginTop:"0.1rem"}}>{calColorLabels[e.color]||(e.colorCustom||"").trim()||e.colorLabel}</div>}
                  {e.note&&<div style={{color:T.textMid,fontSize:"0.78rem",marginTop:"0.28rem",fontStyle:"italic"}}>📝 {e.note}</div>}
                  {notifications.some(function(n){return n.entityId===e.id;})&&<div style={{color:T.sand,fontSize:"0.72rem",fontWeight:600,marginTop:"0.2rem"}}>🔔 Reminder set</div>}
                </div>
                <div style={{display:"flex",gap:"0.25rem",flexShrink:0}}>
                  <button onClick={()=>setShowCalNotif(showCalNotif===e.id?null:e.id)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="bell" size={13} color={T.sand}/></button>
                  <button onClick={()=>openEditEvent(e)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="edit" size={13} color={T.textMid}/></button>
                  <button onClick={()=>setCalEvents(p=>p.filter(x=>x.id!==e.id))} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
                </div>
              </div>
              );
            })}''',
"6b. day view event rows — person color + badge + dimming"))

# ── 7. Selected-day panel (month view) — person color + badge + dimming ───────
results.append(swap(APP,
'''            :eventsForDay(selectedDay.getDate()).map(e=>(
              <div key={e.id} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.65rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.18rem",flexShrink:0,minWidth:38}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:e.color,marginTop:3}}/>
                  <span style={{fontSize:"0.54rem",fontWeight:700,color:e.color,whiteSpace:"nowrap",textAlign:"center"}}>{calColorLabels[e.color]||e.colorCustom?.trim()||e.colorLabel||""}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem"}}>{e.title}</div>
                  {e.time&&<div style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500,marginTop:"0.1rem"}}>⏰ {e.time}</div>}
                  {e.note&&<div style={{color:T.textMid,fontSize:"0.79rem",marginTop:"0.35rem",lineHeight:1.5,fontStyle:"italic"}}>📝 {e.note}</div>}
                </div>
                <div style={{display:"flex",gap:"0.25rem",flexShrink:0}}>
                  <button onClick={()=>openEditEvent(e)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="edit" size={13} color={T.textMid}/></button>
                  <button onClick={()=>setCalEvents(p=>p.filter(x=>x.id!==e.id))} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
                </div>
              </div>
            ))}''',
'''            :eventsForDay(selectedDay.getDate()).map(function(e){
              var _pc=getPersonColor(e.forPerson);
              var _dotColor=e.forPerson?_pc.border:e.color;
              var _dimmed=(calFilter==="mine"&&e.responsibleParent!=="L")||(calFilter==="twy"&&e.responsibleParent!=="T");
              return (
              <div key={e.id} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.65rem 0",borderBottom:`1px solid ${T.borderSoft}`,opacity:_dimmed?0.25:1}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.18rem",flexShrink:0,minWidth:38}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:_dotColor,marginTop:3}}/>
                  <span style={{fontSize:"0.54rem",fontWeight:700,color:_dotColor,whiteSpace:"nowrap",textAlign:"center"}}>{e.forPerson?e.forPerson:(calColorLabels[e.color]||(e.colorCustom||"").trim()||e.colorLabel||"")}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem",display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"}}>
                    <span>{e.title}</span>
                    {e.responsibleParent&&<div style={{width:14,height:14,borderRadius:"50%",background:"rgba(255,255,255,0.85)",fontSize:"8px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(0,0,0,0.1)",color:"#1e3a5f",flexShrink:0}}>{e.responsibleParent}</div>}
                  </div>
                  {e.time&&<div style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500,marginTop:"0.1rem"}}>⏰ {e.time}</div>}
                  {e.note&&<div style={{color:T.textMid,fontSize:"0.79rem",marginTop:"0.35rem",lineHeight:1.5,fontStyle:"italic"}}>📝 {e.note}</div>}
                </div>
                <div style={{display:"flex",gap:"0.25rem",flexShrink:0}}>
                  <button onClick={()=>openEditEvent(e)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="edit" size={13} color={T.textMid}/></button>
                  <button onClick={()=>setCalEvents(p=>p.filter(x=>x.id!==e.id))} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
                </div>
              </div>
              );
            })}''',
"7. selected-day panel — person color + badge + dimming"))

# ── 8. openAddEvent — include forPerson + responsibleParent in init ───────────
results.append(swap(APP,
'  function openAddEvent(prefillDate){ setCalFormInit({title:"",date:prefillDate||"",time:"",color:"#6A9BB5",colorLabel:calColorLabels["#6A9BB5"]||"Blue",colorCustom:"",note:"",repeat:""}); setCalFormMode("add"); setCalFormId(null); }',
'  function openAddEvent(prefillDate){ setCalFormInit({title:"",date:prefillDate||"",time:"",color:"#6A9BB5",colorLabel:calColorLabels["#6A9BB5"]||"Blue",colorCustom:"",note:"",repeat:"",forPerson:null,responsibleParent:null}); setCalFormMode("add"); setCalFormId(null); }',
"8. openAddEvent — init forPerson + responsibleParent"))

# ── 9. Event form — forPerson + responsibleParent fields ─────────────────────
results.append(swap(APP,
'        <div style={{marginBottom:"0.9rem"}}><label style={lbl}>Note (optional)</label><textarea value={f.note||""} onChange={e=>setF(p=>({...p,note:e.target.value}))} placeholder="Any details, reminders…" style={{...inp({height:68,resize:"none"})}}/></div>\n        {/* Inline reminder */}',
'''        <div style={{marginBottom:"0.9rem"}}><label style={lbl}>Note (optional)</label><textarea value={f.note||""} onChange={e=>setF(p=>({...p,note:e.target.value}))} placeholder="Any details, reminders…" style={{...inp({height:68,resize:"none"})}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",marginBottom:"0.9rem"}}>
          <div>
            <label style={lbl}>For</label>
            <select value={f.forPerson||""} onChange={function(ev){setF(function(p){return Object.assign({},p,{forPerson:ev.target.value||null});});}} style={inp({padding:"0.4rem 0.5rem"})}>
              <option value="">Anyone</option>
              {["Madi","Rylan","Kinzlee","Briar","family"].map(function(nm){return <option key={nm} value={nm}>{nm==="family"?"Family":nm}</option>;})}
            </select>
          </div>
          <div>
            <label style={lbl}>Responsible</label>
            <div style={{display:"flex",gap:"0.35rem",marginTop:"0.25rem"}}>
              {[["","—"],["L","Lindsey"],["T","Twy"]].map(function(item){
                var _rv=item[0],_rl=item[1];
                var _ra=_rv===""?!f.responsibleParent:f.responsibleParent===_rv;
                return (
                  <button key={_rv} onClick={function(){setF(function(p){return Object.assign({},p,{responsibleParent:_rv||null});});}} style={{flex:1,padding:"0.35rem 0.3rem",borderRadius:"0.45rem",border:"1.5px solid "+(_ra?T.blue:T.border),background:_ra?T.bluePale:"transparent",color:_ra?T.blue:T.textMid,fontSize:"0.72rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    {_rl}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {/* Inline reminder */}''',
"9. event form — forPerson + responsibleParent fields"))

# ── 10. slimEvent — add forPerson + responsibleParent ─────────────────────────
results.append(swap(CE,
'''  return {
    weekday: weekday,
    title: pick(e, ["title", "name", "summary", "text"], "Untitled"),
    date: pick(e, ["date", "event_date", "start", "when", "day"], null),
    time: pick(e, ["time", "startTime", "start_time"], null),
    who: pick(e, ["who", "person", "people", "assignee", "kid"], null),
    type: pick(e, ["type", "event_type", "category"], null)
  };''',
'''  return {
    weekday: weekday,
    title: pick(e, ["title", "name", "summary", "text"], "Untitled"),
    date: pick(e, ["date", "event_date", "start", "when", "day"], null),
    time: pick(e, ["time", "startTime", "start_time"], null),
    who: pick(e, ["who", "person", "people", "assignee", "kid"], null),
    type: pick(e, ["type", "event_type", "category"], null),
    forPerson: (e && e.forPerson) || null,
    responsibleParent: (e && e.responsibleParent) || null
  };''',
"10. slimEvent — add forPerson + responsibleParent"))

# ── 11. buildCompassContext today — partitioned events ────────────────────────
results.append(swap(CE,
'''  if (scope === "today") {
    ctx.flow_mode = state.flowMode || null;
    ctx.events_today_tomorrow = eventsInWindow(state, 0, 1);''',
'''  if (scope === "today") {
    ctx.flow_mode = state.flowMode || null;
    ctx.events_today_tomorrow = eventsInWindow(state, 0, 1);
    var _todaySlim = eventsInWindow(state, 0, 0);
    ctx.events_today_mine = _todaySlim.filter(function(e) { return e.responsibleParent === "L" || !e.responsibleParent; });
    ctx.events_today_partner = _todaySlim.filter(function(e) { return e.responsibleParent && e.responsibleParent !== "L"; });''',
"11. buildCompassContext — partitioned today events"))

# ── 12. Briefing prompt — responsible-parent awareness ───────────────────────
results.append(swap(CP,
'If FLOW MODE in the context is "Survival": the family is having a hard day. Maximum 3 today items (only the truly unmissable), empty pinch_points unless something is genuinely urgent, suggested_focus is ONE gentle thing, and small_win should be extra kind. Pinch points are observations, not criticism. "No dinner planned tomorrow" not "You forgot dinner."`',
'''If FLOW MODE in the context is "Survival": the family is having a hard day. Maximum 3 today items (only the truly unmissable), empty pinch_points unless something is genuinely urgent, suggested_focus is ONE gentle thing, and small_win should be extra kind. Pinch points are observations, not criticism. "No dinner planned tomorrow" not "You forgot dinner."

RESPONSIBLE PARENT: The context may include events_today_mine (Lindsey handles) and events_today_partner (Twy handles). For partner events use phrasing like "Madi — orthodontist, 2pm. Twy is on it — you’re just in the loop." For your own events: "Rylan — soccer pickup, 9am. You’re on it." Never present a partner event as Lindsey’s responsibility.`''',
"12. briefing prompt — responsible-parent awareness"))

passed = sum(1 for r in results if r)
total  = len(results)
print(f"\nApplied: {passed} of {total}")
sys.exit(0 if passed == total else 1)
