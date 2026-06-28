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

# ── 1. getWorkDays + saveWorkDays helpers (after getPersonColor) ──────────────
results.append(swap(APP,
'''var PERSON_COLOR_DEFAULT = { bg: "#f0ede8", border: "#a09080", text: "#4a3e36" };
function getPersonColor(forPerson) {
  if (!forPerson) return PERSON_COLOR_DEFAULT;
  return PERSON_COLORS[forPerson] || PERSON_COLOR_DEFAULT;
}''',
'''var PERSON_COLOR_DEFAULT = { bg: "#f0ede8", border: "#a09080", text: "#4a3e36" };
function getPersonColor(forPerson) {
  if (!forPerson) return PERSON_COLOR_DEFAULT;
  return PERSON_COLORS[forPerson] || PERSON_COLOR_DEFAULT;
}
function getWorkDays() {
  try { return JSON.parse(localStorage.getItem("af_workDays") || "{}"); } catch(e) { return {}; }
}
function saveWorkDays(wd) {
  try { localStorage.setItem("af_workDays", JSON.stringify(wd)); } catch(e) {}
}''',
"1. getWorkDays + saveWorkDays helpers"))

# ── 2. Add workDays to SYNC_KEYS ──────────────────────────────────────────────
results.append(swap(APP,
'  // Calendar emoji markers\n  "cal_markers","cal_marker_types",',
'  // Calendar emoji markers\n  "cal_markers","cal_marker_types","workDays",',
"2. workDays in SYNC_KEYS"))

# ── 3. workDays + workDayForm state ───────────────────────────────────────────
results.append(swap(APP,
'  const [markerPickerDate,setMarkerPickerDate] = useState(null);\n  const [selectedDay,setSelectedDay]   = useState(null);',
'  const [markerPickerDate,setMarkerPickerDate] = useState(null);\n  const [workDays,setWorkDays]         = useState(getWorkDays);\n  const [workDayForm,setWorkDayForm]   = useState({open:false,type:"wfh",startHour:9,endHour:17,location:"",note:""});\n  const [selectedDay,setSelectedDay]   = useState(null);',
"3. workDays + workDayForm state"))

# ── 4. Month cell: markers + work-type icon ───────────────────────────────────
results.append(swap(APP,
'''                    {/* Emoji markers */}
                    {calMarkers[localDateStr(thisDate)]&&calMarkers[localDateStr(thisDate)].length>0&&(
                      <div style={{display:"flex",gap:"1px",flexWrap:"wrap",marginTop:"auto",lineHeight:1}}>
                        {calMarkers[localDateStr(thisDate)].map(function(em,mi){
                          return <span key={mi} style={{fontSize:"0.62rem"}}>{em}</span>;
                        })}
                      </div>
                    )}''',
'''                    {/* Emoji markers + work-type icon */}
                    {(calMarkers[localDateStr(thisDate)]&&calMarkers[localDateStr(thisDate)].length>0||workDays[localDateStr(thisDate)])&&(
                      <div style={{display:"flex",gap:"2px",flexWrap:"wrap",marginTop:"auto",lineHeight:1,alignItems:"center"}}>
                        {(calMarkers[localDateStr(thisDate)]||[]).map(function(em,mi){
                          return <span key={mi} style={{fontSize:"0.62rem"}}>{em}</span>;
                        })}
                        {workDays[localDateStr(thisDate)]&&(function(){
                          var _wde=workDays[localDateStr(thisDate)];
                          var _wdIcons={wfh:"🏠",office:"🏢",travel:"✈️",off:"☀️"};
                          var _wdBg={wfh:"#e0f5f1",office:"#e3eef7",travel:"#fdf3dc",off:"#faeae3"};
                          var _wdCol={wfh:"#1a6657",office:"#1c4a6e",travel:"#7a5a10",off:"#8a3820"};
                          return (<span key="wdi" style={{fontSize:"0.6rem",background:_wdBg[_wde.type]||"#f0ede8",color:_wdCol[_wde.type]||"#4a3e36",borderRadius:"2px",padding:"0 1px",lineHeight:"14px",display:"inline-flex",alignItems:"center"}}>{_wdIcons[_wde.type]||"💼"}</span>);
                        })()}
                      </div>
                    )}''',
"4. month cell work-type icon"))

# ── 5. Day view: replace old af_workSchedule banner with per-day strip + form ─
results.append(swap(APP,
'''            {(function(){
              var _ws=(function(){try{return JSON.parse(localStorage.getItem("af_workSchedule")||"null")||[{id:"ws1",day:"weekdays",startHour:9,endHour:17}];}catch(_e){return [{id:"ws1",day:"weekdays",startHour:9,endHour:17}];}})();
              var _jsDay=calViewDate.getDay();
              var _wentry=null;
              for(var _wi=0;_wi<_ws.length;_wi++){var _en=_ws[_wi];var _m=_en.day==="weekdays"?(_jsDay>=1&&_jsDay<=5):_en.day==="weekend"?(_jsDay===0||_jsDay===6):_en.day===_jsDay;if(_m){_wentry=_en;break;}}
              if(!_wentry)return null;
              function _fmtH(h){var a=h<12?"am":"pm";var hh=h%12||12;return hh+a;}
              return (<div style={{background:"rgba(30,58,95,0.06)",borderLeft:"3px solid rgba(30,58,95,0.18)",borderRadius:"0 0.35rem 0.35rem 0",padding:"0.32rem 0.7rem",marginBottom:"0.75rem"}}><span style={{fontSize:"0.68rem",fontWeight:700,color:"rgba(30,58,95,0.55)",letterSpacing:"0.04em"}}>Work · {_fmtH(_wentry.startHour)}–{_fmtH(_wentry.endHour)}</span></div>);
            })()}''',
'''            {(function(){
              var _isoDate=localDateStr(calViewDate);
              var _wde=workDays[_isoDate];
              var _WD_ICONS={wfh:"🏠",office:"🏢",travel:"✈️",off:"☀️"};
              var _WD_LABELS={wfh:"Working from home",office:"In the office",travel:"Traveling",off:"PTO / off"};
              var _WD_BG={wfh:"#e0f5f1",office:"#e3eef7",travel:"#fdf3dc",off:"#faeae3"};
              var _WD_COL={wfh:"#1a6657",office:"#1c4a6e",travel:"#7a5a10",off:"#8a3820"};
              var _WD_BORDER={wfh:"#3aaa91",office:"#4a7fa8",travel:"#d4a240",off:"#d4704a"};
              function _fmtH(h){var a=h<12?"am":"pm";var hh=h%12||12;return hh+a;}
              function _openForm(){
                var _def=_wde?{type:_wde.type,startHour:_wde.startHour||9,endHour:_wde.endHour||17,location:_wde.location||"",note:_wde.note||""}:{type:"wfh",startHour:9,endHour:17,location:"",note:""};
                setWorkDayForm(Object.assign({},_def,{open:true}));
              }
              function _saveEntry(){
                var _upd=Object.assign({},workDays);
                _upd[_isoDate]={type:workDayForm.type,startHour:workDayForm.startHour,endHour:workDayForm.endHour,location:workDayForm.location,note:workDayForm.note};
                saveWorkDays(_upd);
                setWorkDays(_upd);
                setWorkDayForm(function(p){return Object.assign({},p,{open:false});});
              }
              function _removeEntry(){
                var _upd=Object.assign({},workDays);
                delete _upd[_isoDate];
                saveWorkDays(_upd);
                setWorkDays(_upd);
                setWorkDayForm(function(p){return Object.assign({},p,{open:false});});
              }
              var _stripBg=_wde?(_WD_BG[_wde.type]||"rgba(30,58,95,0.06)"):"rgba(30,58,95,0.03)";
              var _stripBorder=_wde?(_WD_BORDER[_wde.type]||"rgba(30,58,95,0.18)"):"rgba(30,58,95,0.12)";
              var _stripCol=_wde?(_WD_COL[_wde.type]||"#4a3e36"):T.textFaint;
              return (
                <div style={{marginBottom:"0.75rem"}}>
                  <div onClick={_openForm} style={{background:_stripBg,borderLeft:"3px solid "+_stripBorder,borderRadius:"0 0.35rem 0.35rem 0",padding:"0.32rem 0.7rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.45rem",minHeight:"1.8rem"}}>
                    {_wde?(
                      <span style={{fontSize:"0.68rem",fontWeight:700,color:_stripCol,flex:1,display:"flex",alignItems:"center",gap:"0.3rem",flexWrap:"wrap"}}>
                        <span style={{fontSize:"0.8rem"}}>{_WD_ICONS[_wde.type]||"💼"}</span>
                        <span>{_WD_LABELS[_wde.type]||_wde.type}</span>
                        {_wde.location?<span style={{fontWeight:500,opacity:0.75}}>· {_wde.location}</span>:null}
                        {_wde.type!=="off"?<span style={{fontWeight:500,opacity:0.75}}>· {_fmtH(_wde.startHour||9)}–{_fmtH(_wde.endHour||17)}</span>:null}
                      </span>
                    ):(
                      <span style={{fontSize:"0.68rem",color:T.textFaint,fontWeight:600}}>+ Log work day</span>
                    )}
                    {_wde&&<span style={{fontSize:"0.68rem",color:_stripCol,opacity:0.55,flexShrink:0}}>✏</span>}
                  </div>
                  {_wde&&_wde.note?<div style={{fontSize:"0.67rem",color:T.textSoft,fontStyle:"italic",paddingLeft:"0.75rem",marginTop:"0.15rem"}}>{_wde.note}</div>:null}
                  {workDayForm.open&&(
                    <div style={{background:T.bgAlt,border:"1px solid "+T.border,borderRadius:"0.65rem",padding:"0.85rem 0.9rem",marginTop:"0.4rem"}}>
                      <div style={{display:"flex",gap:"0.3rem",marginBottom:"0.7rem"}}>
                        {[["wfh","🏠","WFH"],["office","🏢","Office"],["travel","✈️","Travel"],["off","☀️","PTO"]].map(function(it){
                          var _t=it[0],_i=it[1],_l=it[2];
                          var _a=workDayForm.type===_t;
                          return (
                            <button key={_t} onClick={function(){setWorkDayForm(function(p){return Object.assign({},p,{type:_t});});}} style={{flex:1,padding:"0.35rem 0.15rem",borderRadius:"0.45rem",border:"1.5px solid "+(_a?_WD_BORDER[_t]:T.border),background:_a?_WD_BG[_t]:"transparent",color:_a?_WD_COL[_t]:T.textMid,fontSize:"0.65rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.12rem"}}>
                              <span style={{fontSize:"0.9rem"}}>{_i}</span>{_l}
                            </button>
                          );
                        })}
                      </div>
                      {workDayForm.type!=="off"&&(
                        <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.55rem"}}>
                          <span style={{fontSize:"0.7rem",fontWeight:700,color:T.textMid,whiteSpace:"nowrap"}}>Hours</span>
                          <div style={{flex:1}}>
                            <select value={workDayForm.startHour} onChange={function(ev){setWorkDayForm(function(p){return Object.assign({},p,{startHour:parseInt(ev.target.value,10)});});}} style={inp({padding:"0.3rem 0.4rem",fontSize:"0.75rem",width:"100%"})}>
                              {Array.from({length:24},function(_x,i){return i;}).filter(function(i){return i<workDayForm.endHour;}).map(function(i){return <option key={i} value={i}>{_fmtH(i)}</option>;})}
                            </select>
                          </div>
                          <span style={{fontSize:"0.72rem",color:T.textMid,flexShrink:0}}>to</span>
                          <div style={{flex:1}}>
                            <select value={workDayForm.endHour} onChange={function(ev){setWorkDayForm(function(p){return Object.assign({},p,{endHour:parseInt(ev.target.value,10)});});}} style={inp({padding:"0.3rem 0.4rem",fontSize:"0.75rem",width:"100%"})}>
                              {Array.from({length:24},function(_x,i){return i;}).filter(function(i){return i>workDayForm.startHour;}).map(function(i){return <option key={i} value={i}>{_fmtH(i)}</option>;})}
                            </select>
                          </div>
                        </div>
                      )}
                      <input value={workDayForm.location} onChange={function(ev){setWorkDayForm(function(p){return Object.assign({},p,{location:ev.target.value});});}} placeholder="Location (optional)" style={{...inp({marginBottom:"0.45rem",padding:"0.32rem 0.5rem",fontSize:"0.75rem"})}}/>
                      <input value={workDayForm.note} onChange={function(ev){setWorkDayForm(function(p){return Object.assign({},p,{note:ev.target.value});});}} placeholder="Note (optional)" style={{...inp({marginBottom:"0.6rem",padding:"0.32rem 0.5rem",fontSize:"0.75rem"})}}/>
                      <div style={{display:"flex",gap:"0.4rem",justifyContent:"flex-end"}}>
                        {_wde&&<button onClick={_removeEntry} style={{...btnS({fontSize:"0.72rem",padding:"0.3rem 0.65rem",color:T.rose})}}>Remove</button>}
                        <button onClick={function(){setWorkDayForm(function(p){return Object.assign({},p,{open:false});});}} style={btnS({fontSize:"0.72rem",padding:"0.3rem 0.65rem"})}>Cancel</button>
                        <button onClick={_saveEntry} style={btnP(T.blue,{fontSize:"0.72rem",padding:"0.3rem 0.75rem"})}>Save</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}''',
"5. day view work strip + inline form"))

passed = sum(1 for r in results if r)
total  = len(results)
print(f"\nApplied: {passed} of {total}")
sys.exit(0 if passed == total else 1)
