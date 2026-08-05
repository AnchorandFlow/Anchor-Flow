import { useState, useEffect } from "react"

const B = {
  navy: "#faf8f4", coastal: "#6ba3c4", sage: "#7a9e8e", sand: "#c8a97a",
  warm: "#faf8f4", white: "rgba(255,255,255,0.06)", border: "rgba(200,169,122,0.22)",
  muted: "rgba(250,248,244,0.45)", soft: "rgba(255,255,255,0.05)", rose: "#c97a7a", lavender: "#9b8fd4",
}

const inp = (extra={}) => ({ border:"1.5px solid "+B.border, borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif", width:"100%", boxSizing:"border-box", background:"#1e3060", color:"#faf8f4", ...extra })
const uid = () => Math.random().toString(36).slice(2)

// Mark this key dirty and trigger a sync so the edit pushes to other devices.
// MomentsSection writes af_* keys directly (not via the app's setSaved), so
// without this the change stays local and never reaches Supabase. Same
// pattern as ExhaleSection.jsx's lsSet.
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch(e) {}
  try {
    var syncName = key.indexOf("af_") === 0 ? key.slice(3) : key
    var dirty = JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]")
    if (dirty.indexOf(syncName) === -1) {
      dirty.push(syncName)
      localStorage.setItem("af_dirtyKeys", JSON.stringify(dirty))
    }
  } catch(e2) {}
  try { window.dispatchEvent(new CustomEvent("af-data-changed")) } catch(e3) {}
}


function injectCalendarEvent(title, dateStr, id, color) {
  if (!dateStr) return false
  try {
    var events = JSON.parse(localStorage.getItem("af_calEvents") || "[]")
    if (!events.some(function(e) { return e.id === id })) {
      events.push({ id: id, title: title, date: dateStr, color: color || "#c8a97a", notes: "Added from Moments" })
      localStorage.setItem("af_calEvents", JSON.stringify(events))
      window.dispatchEvent(new CustomEvent("af-cal-changed"))
      return true
    }
  } catch {}
  return false
}

function addToGroceryList(items) {
  try {
    var stores = []
    try { stores = JSON.parse(localStorage.getItem("af_stores") || "[]") } catch {}
    var store = (stores && stores[0]) ? stores[0] : "Grocery Store"
    // Dispatch one event per item, matching the shape App.jsx's listener
    // actually consumes (e.detail.text/store) -- same contract as
    // AnchorVault.jsx's quickAddShop/handleAddToShopping. No raw
    // localStorage write here: the listener's setShoppingItems (useSaved's
    // setter) owns the write and dirty-marks it, same pattern as F-32's
    // af-cal-changed bridge.
    items.forEach(function(text) {
      window.dispatchEvent(new CustomEvent("af-shopping-add", { detail: { text: text, store: store } }))
    })
    return true
  } catch { return false }
}

function ProgressBar({ value, total, color }) {
  const pct = total === 0 ? 0 : Math.round((value/total)*100)
  return (
    <div style={{ marginTop:6 }}>
      <div style={{ height:4, background:"rgba(0,0,0,0.08)", borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:pct+"%", background:color, borderRadius:2, transition:"width 0.3s" }}/>
      </div>
      <div style={{ fontSize:10, color:B.muted, marginTop:3 }}>{value} of {total}{pct===100?" ✓":""}</div>
    </div>
  )
}

function GuestCard({ moment, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [newGuest, setNewGuest] = useState("")
  const guests = moment.guests || []
  const confirmed = guests.filter(g=>g.rsvp==="yes").length
  const declined = guests.filter(g=>g.rsvp==="no").length
  const pending = guests.filter(g=>!g.rsvp||g.rsvp==="pending").length
  return (
    <div style={{ background:B.white, border:"1.5px solid "+B.border, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>👥</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, color:B.navy }}>Guests</div>
          <div style={{ display:"flex", gap:10, marginTop:3 }}>
            <span style={{ fontSize:11, color:B.sage, fontWeight:600 }}>✓ {confirmed} confirmed</span>
            {declined>0&&<span style={{ fontSize:11, color:B.rose }}>✗ {declined} declined</span>}
            {pending>0&&<span style={{ fontSize:11, color:B.muted }}>⏳ {pending} pending</span>}
          </div>
          <ProgressBar value={confirmed} total={guests.length} color={B.sage}/>
        </div>
        <span style={{ fontSize:12, color:B.muted }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid "+B.border, padding:"10px 14px" }}>
          {guests.map((g,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"1px solid "+B.border }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:g.rsvp==="yes"?B.sage+"30":g.rsvp==="no"?B.rose+"30":B.soft, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:g.rsvp==="yes"?B.sage:g.rsvp==="no"?B.rose:B.muted, flexShrink:0 }}>
                {g.name[0]?.toUpperCase()}
              </div>
              <span style={{ flex:1, fontSize:13, color:B.navy, fontWeight:500 }}>{g.name}</span>
              <select value={g.rsvp||"pending"} onChange={e=>onUpdate({guests:guests.map((x,j)=>j===i?{...x,rsvp:e.target.value}:x)})} style={{ fontSize:11, border:"1.5px solid "+B.border, borderRadius:6, padding:"3px 6px", cursor:"pointer", fontFamily:"DM Sans,sans-serif", background:g.rsvp==="yes"?"#e8f5e9":g.rsvp==="no"?"#ffebee":"#fff" }}>
                <option value="pending">Pending</option>
                <option value="yes">✓ Coming</option>
                <option value="no">✗ Not coming</option>
                <option value="maybe">? Maybe</option>
              </select>
              <button onClick={()=>onUpdate({guests:guests.filter((_,j)=>j!==i)})} style={{ background:"none", border:"none", color:B.muted, cursor:"pointer", fontSize:16 }}>×</button>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <input value={newGuest} onChange={e=>setNewGuest(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&newGuest.trim()){ onUpdate({guests:[...guests,{name:newGuest.trim(),rsvp:"pending"}]}); setNewGuest(""); }}} placeholder="Add guest name..." style={{...inp(),flex:1}}/>
            <button onClick={()=>{ if(newGuest.trim()){ onUpdate({guests:[...guests,{name:newGuest.trim(),rsvp:"pending"}]}); setNewGuest(""); }}} style={{ background:B.sage, border:"none", borderRadius:8, padding:"8px 14px", color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Shopping list card with "Send to grocery list" button
function ShoppingCard({ moment, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [newItem, setNewItem] = useState("")
  const [toast, setToast] = useState("")
  const [selected, setSelected] = useState({})
  const items = moment.shopping || []
  const done = items.filter(i=>i.done).length

  function sendToGrocery() {
    var toSend = items.filter(function(item) { return selected[item.id||item.text] && !item.sentToGrocery })
    if (!toSend.length) { setToast("Select items first"); setTimeout(function(){setToast("")},2000); return }
    var texts = toSend.map(function(i){ return i.text })
    addToGroceryList(texts)
    var sentIds = {}
    toSend.forEach(function(i){ sentIds[i.id||i.text] = true })
    onUpdate({ shopping: items.map(function(i){ return sentIds[i.id||i.text] ? {...i, sentToGrocery:true} : i }) })
    setSelected({})
    setToast("Added to grocery list! ✓")
    setTimeout(function(){ setToast("") }, 2500)
  }

  function sendAllUnsent() {
    var unsent = items.filter(function(i){ return !i.sentToGrocery })
    if (!unsent.length) { setToast("All items already sent"); setTimeout(function(){setToast("")},2000); return }
    addToGroceryList(unsent.map(function(i){ return i.text }))
    onUpdate({ shopping: items.map(function(i){ return {...i, sentToGrocery:true} }) })
    setToast("Added all to grocery list! ✓")
    setTimeout(function(){ setToast("") }, 2500)
  }

  var anySelected = items.some(function(i){ return selected[i.id||i.text] })
  var unsentCount = items.filter(function(i){ return !i.sentToGrocery }).length

  return (
    <div style={{ background:B.white, border:"1.5px solid "+B.border, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>🛒</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, color:B.navy }}>Shopping List</div>
          <ProgressBar value={done} total={items.length} color={B.sage}/>
        </div>
        <span style={{ fontSize:12, color:B.muted }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid "+B.border, padding:"10px 14px" }}>
          {toast && (
            <div style={{ background:"rgba(122,158,142,0.15)", border:"1px solid rgba(122,158,142,0.3)", borderRadius:8, padding:"6px 12px", fontSize:12, color:B.sage, fontFamily:"DM Sans,sans-serif", marginBottom:10, textAlign:"center" }}>{toast}</div>
          )}
          {items.length > 0 && (
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              {anySelected && (
                <button onClick={sendToGrocery} style={{ flex:1, background:"rgba(122,158,142,0.15)", border:"1.5px solid rgba(122,158,142,0.4)", borderRadius:8, padding:"7px 10px", fontSize:11, color:B.sage, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:700 }}>
                  🛒 Send selected to grocery list
                </button>
              )}
              {!anySelected && unsentCount > 0 && (
                <button onClick={sendAllUnsent} style={{ flex:1, background:"rgba(122,158,142,0.08)", border:"1.5px solid rgba(122,158,142,0.25)", borderRadius:8, padding:"7px 10px", fontSize:11, color:"rgba(122,158,142,0.8)", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600 }}>
                  🛒 Send all {unsentCount} to grocery list
                </button>
              )}
            </div>
          )}
          {items.map(function(item,i) {
            var itemKey = item.id || item.text
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"1px solid "+B.border }}>
                <div onClick={function(){ setSelected(function(p){ var n={...p}; n[itemKey]=!n[itemKey]; return n }) }} style={{ width:16, height:16, borderRadius:4, border:"1.5px solid "+(selected[itemKey]?"#7a9e8e":"rgba(255,255,255,0.2)"), background:selected[itemKey]?"rgba(122,158,142,0.25)":"transparent", flexShrink:0, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:B.sage }}>
                  {selected[itemKey]?"✓":""}
                </div>
                <div onClick={function(){ onUpdate({shopping:items.map(function(x,j){ return j===i?{...x,done:!x.done}:x })}) }} style={{ width:16, height:16, borderRadius:4, border:"1.5px solid "+(item.done?B.sage:"rgba(0,0,0,0.15)"), background:item.done?B.sage:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, fontSize:9, color:"#fff" }}>
                  {item.done?"✓":""}
                </div>
                <span style={{ flex:1, fontSize:13, color:B.navy, textDecoration:item.done?"line-through":"none", opacity:item.done?0.5:1 }}>{item.text}</span>
                {item.sentToGrocery && <span style={{ fontSize:9, color:"rgba(122,158,142,0.6)", fontFamily:"DM Sans,sans-serif", flexShrink:0 }}>✓ sent</span>}
                <button onClick={function(){ onUpdate({shopping:items.filter(function(_,j){ return j!==i })}) }} style={{ background:"none", border:"none", color:B.muted, cursor:"pointer", fontSize:16 }}>×</button>
              </div>
            )
          })}
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&newItem.trim()){ onUpdate({shopping:[...items,{id:uid(),text:newItem.trim(),done:false}]}); setNewItem(""); }}} placeholder="Add item to buy..." style={{...inp(),flex:1}}/>
            <button onClick={function(){ if(newItem.trim()){ onUpdate({shopping:[...items,{id:uid(),text:newItem.trim(),done:false}]}); setNewItem(""); }}} style={{ background:B.sage, border:"none", borderRadius:8, padding:"8px 14px", color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Notes & Tasks card with optional due date and calendar inject
function NotesTasksCard({ moment, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [newText, setNewText] = useState("")
  const [newDue, setNewDue] = useState("")
  const [toast, setToast] = useState("")
  const items = moment.notes || []
  const done = items.filter(i=>i.done).length

  function addItem() {
    if (!newText.trim()) return
    var item = { id:uid(), text:newText.trim(), done:false, due:newDue||"" }
    if (newDue) {
      var added = injectCalendarEvent("📋 "+moment.name+": "+newText.trim(), newDue, "moment_task_"+item.id, "#9b8fd4")
      if (added) { setToast("Task added to calendar ✓"); setTimeout(function(){ setToast("") }, 2200) }
    }
    onUpdate({ notes: [...items, item] })
    setNewText(""); setNewDue("")
  }

  function addToCalendar(item) {
    if (!item.due) return
    var added = injectCalendarEvent("📋 "+moment.name+": "+item.text, item.due, "moment_task_"+item.id, "#9b8fd4")
    setToast(added ? "Added to calendar ✓" : "Already on calendar")
    setTimeout(function(){ setToast("") }, 2200)
  }

  return (
    <div style={{ background:B.white, border:"1.5px solid "+B.border, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>📋</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, color:B.navy }}>Notes & Tasks</div>
          {items.length > 0
            ? <ProgressBar value={done} total={items.length} color={B.lavender}/>
            : <div style={{ fontSize:11, color:B.muted, marginTop:2 }}>Add reminders, tasks, notes</div>
          }
        </div>
        <span style={{ fontSize:12, color:B.muted }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid "+B.border, padding:"10px 14px" }}>
          {toast && (
            <div style={{ background:"rgba(155,143,212,0.12)", border:"1px solid rgba(155,143,212,0.3)", borderRadius:8, padding:"6px 12px", fontSize:12, color:B.lavender, fontFamily:"DM Sans,sans-serif", marginBottom:8, textAlign:"center" }}>{toast}</div>
          )}
          {items.map(function(item,i) {
            return (
              <div key={item.id||i} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"7px 0", borderBottom:"1px solid "+B.border }}>
                <div onClick={function(){ onUpdate({notes:items.map(function(x,j){ return j===i?{...x,done:!x.done}:x })}) }} style={{ width:16, height:16, borderRadius:4, border:"1.5px solid "+(item.done?B.lavender:"rgba(0,0,0,0.15)"), background:item.done?B.lavender:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, marginTop:2, fontSize:9, color:"#fff" }}>
                  {item.done?"✓":""}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:B.navy, textDecoration:item.done?"line-through":"none", opacity:item.done?0.5:1, fontFamily:"DM Sans,sans-serif" }}>{item.text}</div>
                  {item.due && (
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                      <span style={{ fontSize:10, color:"rgba(155,143,212,0.8)", fontFamily:"DM Sans,sans-serif" }}>📅 {item.due}</span>
                      <button onClick={function(){ addToCalendar(item) }} style={{ background:"none", border:"none", fontSize:9, color:"rgba(155,143,212,0.6)", cursor:"pointer", fontFamily:"DM Sans,sans-serif", padding:0, fontWeight:600 }}>+ calendar</button>
                    </div>
                  )}
                </div>
                <button onClick={function(){ onUpdate({notes:items.filter(function(_,j){ return j!==i })}) }} style={{ background:"none", border:"none", color:B.muted, cursor:"pointer", fontSize:16, flexShrink:0 }}>×</button>
              </div>
            )
          })}
          <div style={{ marginTop:10, background:"rgba(155,143,212,0.06)", borderRadius:10, padding:10 }}>
            <input value={newText} onChange={e=>setNewText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Note or task..." style={{...inp(), marginBottom:6}}/>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10, color:B.muted, fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Due date (optional)</div>
                <input type="date" value={newDue} onChange={e=>setNewDue(e.target.value)} style={{...inp()}}/>
              </div>
              <button onClick={addItem} style={{ background:B.lavender, border:"none", borderRadius:8, padding:"8px 14px", color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:12, fontWeight:600, cursor:"pointer", marginTop:18 }}>Add</button>
            </div>
            {newDue && <div style={{ fontSize:10, color:"rgba(155,143,212,0.7)", fontFamily:"DM Sans,sans-serif", marginTop:5 }}>📅 Will add to calendar when saved</div>}
          </div>
        </div>
      )}
    </div>
  )
}

function LayoverRow({ layover, onChange, onRemove }) {
  return (
    <div style={{ background:"rgba(106,163,196,0.07)", border:"1px solid rgba(106,163,196,0.18)", borderRadius:8, padding:"8px 10px", marginBottom:6 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontSize:10, fontWeight:700, color:"rgba(106,163,196,0.8)", fontFamily:"DM Sans,sans-serif", textTransform:"uppercase", letterSpacing:"0.05em" }}>🔄 Layover</span>
        <button onClick={onRemove} style={{ background:"none", border:"none", color:"rgba(201,122,122,0.5)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif" }}>Remove</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        <div style={{ display:"flex", gap:6 }}>
          <div style={{ flex:1 }}><div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Airport / City</div><input value={layover.airport||""} onChange={e=>onChange({...layover,airport:e.target.value})} placeholder="e.g. ORD, Dallas" style={inp()}/></div>
          <div style={{ flex:1 }}><div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Duration</div><input value={layover.duration||""} onChange={e=>onChange({...layover,duration:e.target.value})} placeholder="e.g. 1h 45m" style={inp()}/></div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <div style={{ flex:1 }}><div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Arrives at layover</div><input type="time" value={layover.arriveTime||""} onChange={e=>onChange({...layover,arriveTime:e.target.value})} style={inp()}/></div>
          <div style={{ flex:1 }}><div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Departs layover</div><input type="time" value={layover.departTime||""} onChange={e=>onChange({...layover,departTime:e.target.value})} style={inp()}/></div>
        </div>
        <input value={layover.notes||""} onChange={e=>onChange({...layover,notes:e.target.value})} placeholder="Gate, terminal, notes…" style={inp()}/>
      </div>
    </div>
  )
}

function FlightCard({ moment, onUpdate }) {
  const [open, setOpen] = useState(false)
  const flights = moment.flights || [{}]

  function updateFlight(i, changes) {
    onUpdate({ flights: flights.map(function(x,j){ return j===i ? Object.assign({},x,changes) : x }) })
  }
  function updateLayover(fi, li, changes) {
    var layovers = (flights[fi].layovers||[]).map(function(l,j){ return j===li ? Object.assign({},l,changes) : l })
    updateFlight(fi, { layovers: layovers })
  }
  function addLayover(fi) {
    updateFlight(fi, { layovers: [...(flights[fi].layovers||[]), { id: Date.now().toString(), airport:"", duration:"", arriveTime:"", departTime:"", notes:"" }] })
  }
  function removeLayover(fi, li) {
    updateFlight(fi, { layovers: (flights[fi].layovers||[]).filter(function(_,j){ return j!==li }) })
  }

  return (
    <div style={{ background:B.white, border:"1.5px solid "+B.border, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>✈️</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, color:B.navy }}>Flights</div>
          <div style={{ fontSize:11, color:B.muted, marginTop:2 }}>{flights.filter(f=>f.airline).length} flight(s) · {flights.reduce(function(n,f){ return n+(f.layovers||[]).length },0)} layover(s)</div>
        </div>
        <span style={{ fontSize:12, color:B.muted }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid "+B.border, padding:"10px 14px" }}>
          {flights.map(function(f,i) {
            return (
              <div key={i} style={{ background:B.soft, borderRadius:10, padding:12, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:B.muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>Flight {i+1}</div>
                  {flights.length > 1 && <button onClick={()=>onUpdate({flights:flights.filter(function(_,j){ return j!==i })})} style={{ background:"none", border:"none", color:"rgba(201,122,122,0.5)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif" }}>Remove</button>}
                </div>
                {/* Airline + confirmation */}
                <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                  <input value={f.airline||""} onChange={e=>updateFlight(i,{airline:e.target.value})} placeholder="Airline & flight # (e.g. UA 1234)" style={{...inp(),flex:2}}/>
                  <input value={f.confirmation||""} onChange={e=>updateFlight(i,{confirmation:e.target.value})} placeholder="Confirmation #" style={{...inp(),flex:1}}/>
                </div>
                {/* Route */}
                <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                  <input value={f.departure||""} onChange={e=>updateFlight(i,{departure:e.target.value})} placeholder="From (DEN, Denver…)" style={{...inp(),flex:1}}/>
                  <input value={f.arrival||""} onChange={e=>updateFlight(i,{arrival:e.target.value})} placeholder="To (LAX, Los Angeles…)" style={{...inp(),flex:1}}/>
                </div>
                {/* Depart date + time */}
                <div style={{ fontSize:10, fontWeight:700, color:"rgba(250,248,244,0.3)", fontFamily:"DM Sans,sans-serif", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>Departure</div>
                <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                  <div style={{ flex:1 }}><div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Date</div><input type="date" value={f.departDate||""} onChange={e=>updateFlight(i,{departDate:e.target.value})} style={inp()}/></div>
                  <div style={{ flex:1 }}><div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Time</div><input type="time" value={f.departTime||""} onChange={e=>updateFlight(i,{departTime:e.target.value})} style={inp()}/></div>
                  <div style={{ flex:1 }}><div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Terminal / Gate</div><input value={f.departGate||""} onChange={e=>updateFlight(i,{departGate:e.target.value})} placeholder="e.g. B12" style={inp()}/></div>
                </div>
                {/* Layovers */}
                {(f.layovers||[]).map(function(lay,li) {
                  return <LayoverRow key={lay.id||li} layover={lay} onChange={function(c){ updateLayover(i,li,c) }} onRemove={function(){ removeLayover(i,li) }}/>
                })}
                <button onClick={function(){ addLayover(i) }} style={{ background:"rgba(106,163,196,0.08)", border:"1px dashed rgba(106,163,196,0.3)", borderRadius:7, padding:"5px 10px", fontSize:11, color:"rgba(106,163,196,0.7)", fontFamily:"DM Sans,sans-serif", cursor:"pointer", width:"100%", marginBottom:8 }}>+ Add layover</button>
                {/* Arrival date + time */}
                <div style={{ fontSize:10, fontWeight:700, color:"rgba(250,248,244,0.3)", fontFamily:"DM Sans,sans-serif", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.05em" }}>Arrival</div>
                <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                  <div style={{ flex:1 }}><div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Date</div><input type="date" value={f.arriveDate||""} onChange={e=>updateFlight(i,{arriveDate:e.target.value})} style={inp()}/></div>
                  <div style={{ flex:1 }}><div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Time</div><input type="time" value={f.arriveTime||""} onChange={e=>updateFlight(i,{arriveTime:e.target.value})} style={inp()}/></div>
                  <div style={{ flex:1 }}><div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Terminal / Gate</div><input value={f.arriveGate||""} onChange={e=>updateFlight(i,{arriveGate:e.target.value})} placeholder="e.g. C22" style={inp()}/></div>
                </div>
                <input value={f.notes||""} onChange={e=>updateFlight(i,{notes:e.target.value})} placeholder="Seat numbers, meal requests, notes…" style={inp()}/>
              </div>
            )
          })}
          <button onClick={()=>onUpdate({flights:[...flights,{}]})} style={{ background:"none", border:"1.5px dashed "+B.border, borderRadius:8, padding:"8px", color:B.muted, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif", width:"100%" }}>+ Add another flight</button>
        </div>
      )}
    </div>
  )
}

function HotelCard({ moment, onUpdate }) {
  const [open, setOpen] = useState(false)
  const hotels = moment.hotels || [{}]

  function updateHotel(i, changes) {
    onUpdate({ hotels: hotels.map(function(x,j){ return j===i ? Object.assign({},x,changes) : x }) })
  }

  var STAY_TYPES = [
    { id:"hotel", label:"🏨 Hotel", icon:"🏨" },
    { id:"airbnb", label:"🏠 Airbnb / VRBO", icon:"🏠" },
    { id:"hostel", label:"🛏 Hostel", icon:"🛏" },
    { id:"other", label:"📍 Other", icon:"📍" },
  ]

  return (
    <div style={{ background:B.white, border:"1.5px solid "+B.border, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>🏨</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, color:B.navy }}>Stays</div>
          <div style={{ fontSize:11, color:B.muted, marginTop:2 }}>{hotels.filter(h=>h.name).length} stay(s) added</div>
        </div>
        <span style={{ fontSize:12, color:B.muted }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid "+B.border, padding:"10px 14px" }}>
          {hotels.map(function(h,i) {
            var stayType = h.stayType || "hotel"
            var isAirbnb = stayType === "airbnb"
            return (
              <div key={i} style={{ background:B.soft, borderRadius:10, padding:12, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:B.muted, textTransform:"uppercase" }}>Stay {i+1}</div>
                  {hotels.length > 1 && <button onClick={()=>onUpdate({hotels:hotels.filter(function(_,j){ return j!==i })})} style={{ background:"none", border:"none", color:"rgba(201,122,122,0.5)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif" }}>Remove</button>}
                </div>
                {/* Type toggle */}
                <div style={{ display:"flex", gap:5, marginBottom:10, flexWrap:"wrap" }}>
                  {STAY_TYPES.map(function(t) {
                    return (
                      <button key={t.id} onClick={function(){ updateHotel(i,{stayType:t.id}) }} style={{ background:stayType===t.id?"rgba(200,169,122,0.2)":"transparent", border:"1.5px solid "+(stayType===t.id?"rgba(200,169,122,0.5)":"rgba(255,255,255,0.1)"), borderRadius:20, padding:"3px 10px", fontSize:11, color:stayType===t.id?"#c8a97a":"rgba(250,248,244,0.4)", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:stayType===t.id?700:400 }}>{t.label}</button>
                    )
                  })}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  <input value={h.name||""} onChange={e=>updateHotel(i,{name:e.target.value})} placeholder={isAirbnb?"Airbnb/VRBO listing name":"Hotel name"} style={inp()}/>
                  <div style={{ display:"flex", gap:6 }}>
                    <input value={h.confirmation||""} onChange={e=>updateHotel(i,{confirmation:e.target.value})} placeholder="Confirmation #" style={{...inp(),flex:1}}/>
                    {/* Door/house code — shown for Airbnb or always */}
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>{isAirbnb?"🔑 Door / House code":"🔑 Room / Access code"}</div>
                      <input value={h.doorCode||""} onChange={e=>updateHotel(i,{doorCode:e.target.value})} placeholder={isAirbnb?"e.g. 4829#":"e.g. key at desk"} style={inp()}/>
                    </div>
                  </div>
                  <input value={h.address||""} onChange={e=>updateHotel(i,{address:e.target.value})} placeholder="Address" style={inp()}/>
                  {h.address && (
                    <input value={h.addressUrl||""} onChange={e=>updateHotel(i,{addressUrl:e.target.value})} placeholder="Google Maps link (optional)" style={{...inp(), fontSize:11, color:"rgba(106,163,196,0.8)"}}/>
                  )}
                  <div style={{ display:"flex", gap:6 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Check-in</div>
                      <input type="date" value={h.checkIn||""} onChange={e=>updateHotel(i,{checkIn:e.target.value})} style={inp()}/>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Check-out</div>
                      <input type="date" value={h.checkOut||""} onChange={e=>updateHotel(i,{checkOut:e.target.value})} style={inp()}/>
                    </div>
                  </div>
                  {/* Check-in/out times */}
                  <div style={{ display:"flex", gap:6 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Check-in time</div>
                      <input type="time" value={h.checkInTime||""} onChange={e=>updateHotel(i,{checkInTime:e.target.value})} style={inp()}/>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:"rgba(250,248,244,0.35)", fontFamily:"DM Sans,sans-serif", marginBottom:3 }}>Check-out time</div>
                      <input type="time" value={h.checkOutTime||""} onChange={e=>updateHotel(i,{checkOutTime:e.target.value})} style={inp()}/>
                    </div>
                  </div>
                  <input value={h.notes||""} onChange={e=>updateHotel(i,{notes:e.target.value})} placeholder="WiFi, parking, host contact, notes…" style={inp()}/>
                </div>
              </div>
            )
          })}
          <button onClick={()=>onUpdate({hotels:[...hotels,{}]})} style={{ background:"none", border:"1.5px dashed "+B.border, borderRadius:8, padding:"8px", color:B.muted, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif", width:"100%" }}>+ Add another stay</button>
        </div>
      )}
    </div>
  )
}

function PackingCard({ moment, onUpdate }) {
  // Packing templates now live in Travel Profile (af_packing_templates).
  // This card lets you pick a template to start from, then check items off in-trip.
  const [open, setOpen] = useState(false)
  const [pickingTemplate, setPickingTemplate] = useState(false)
  const packing = moment.packing || { items: [] }  // flat list for trip use
  const items = packing.items || []
  const done = items.filter(function(i){ return i.done }).length

  function loadTemplates() {
    try { return JSON.parse(localStorage.getItem("af_packing_templates") || "[]") } catch { return [] }
  }

  function applyTemplate(tmpl) {
    var existing = items.map(function(i){ return i.text.toLowerCase() })
    var toAdd = []
    var CATS = ["Clothing","Toiletries","Electronics","Medications","Documents","Kids stuff","Snacks","Misc"]
    CATS.forEach(function(cat) {
      var catItems = ((tmpl.items||{})[cat]||[])
      catItems.forEach(function(item) {
        if (!existing.includes(item.text.toLowerCase())) {
          toAdd.push({ id: Date.now().toString()+Math.random().toString(36).slice(2,5), text: item.text, cat: cat, done: false })
        }
      })
    })
    onUpdate({ packing: { items: [...items, ...toAdd] } })
    setPickingTemplate(false)
  }

  var templates = loadTemplates()

  return (
    <div style={{ background:B.white, border:"1.5px solid "+B.border, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>🧳</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, color:B.navy }}>Packing</div>
          {items.length > 0
            ? <ProgressBar value={done} total={items.length} color={B.coastal}/>
            : <div style={{ fontSize:11, color:B.muted, marginTop:2 }}>Load a template from Travel Profile</div>
          }
        </div>
        <span style={{ fontSize:12, color:B.muted }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid "+B.border, padding:"10px 14px" }}>
          {/* Template picker */}
          {templates.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <button onClick={function(){ setPickingTemplate(function(p){ return !p }) }} style={{ background:"rgba(106,163,196,0.1)", border:"1.5px solid rgba(106,163,196,0.25)", borderRadius:8, padding:"6px 12px", fontSize:11, color:B.coastal, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, width:"100%" }}>
                📋 Load from packing template {pickingTemplate?"▲":"▼"}
              </button>
              {pickingTemplate && (
                <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:6 }}>
                  {templates.map(function(t) {
                    var count = Object.values(t.items||{}).reduce(function(n,arr){ return n+arr.length },0)
                    return (
                      <button key={t.id} onClick={function(){ applyTemplate(t) }} style={{ background:"rgba(255,255,255,0.04)", border:"1.5px solid rgba(106,163,196,0.2)", borderRadius:8, padding:"9px 12px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", textAlign:"left" }}>
                        <span style={{ fontSize:16 }}>{t.emoji||"🧳"}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"#faf8f4", fontFamily:"DM Sans,sans-serif" }}>{t.name}</div>
                          <div style={{ fontSize:10, color:B.muted, fontFamily:"DM Sans,sans-serif" }}>{count} items</div>
                        </div>
                        <span style={{ fontSize:11, color:B.coastal, fontFamily:"DM Sans,sans-serif" }}>Use →</span>
                      </button>
                    )
                  })}
                  <div style={{ fontSize:10, color:B.muted, fontFamily:"DM Sans,sans-serif", textAlign:"center", paddingTop:4 }}>Templates are managed in Anchor Vault → Travel Profile</div>
                </div>
              )}
            </div>
          )}
          {templates.length === 0 && items.length === 0 && (
            <div style={{ background:"rgba(106,163,196,0.06)", border:"1px solid rgba(106,163,196,0.2)", borderRadius:8, padding:"10px 12px", marginBottom:10, fontSize:12, color:"rgba(106,163,196,0.8)", fontFamily:"DM Sans,sans-serif", lineHeight:1.5 }}>
              💡 Create packing templates in <strong>Anchor Vault → Travel Profile</strong> to quickly load a pre-built list here (Road Trip, Flight, Beach Week, etc.)
            </div>
          )}
          {/* Item list */}
          {items.map(function(item,i) {
            return (
              <div key={item.id||i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:"1px solid "+B.border }}>
                <div onClick={function(){ var nextItems = items.map(function(x,j){ return j===i?{...x,done:!x.done}:x }); onUpdate({ packing:{ items: nextItems } }); if(nextItems.length>0 && nextItems.every(function(x){return x.done}) && !items.every(function(x){return x.done})){ window.dispatchEvent(new CustomEvent("af-celebrate", { detail: { heading: "All packed!", title: (moment && moment.name) ? moment.name : "", message: "Everything's checked off — you're ready to go." } })); } }} style={{ width:18, height:18, borderRadius:4, border:"1.5px solid "+(item.done?B.coastal:"rgba(0,0,0,0.15)"), background:item.done?B.coastal:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
                  {item.done&&<span style={{ color:"#fff", fontSize:10 }}>✓</span>}
                </div>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:13, color:B.navy, textDecoration:item.done?"line-through":"none", opacity:item.done?0.5:1 }}>{item.text}</span>
                  {item.cat && <span style={{ fontSize:10, color:B.muted, fontFamily:"DM Sans,sans-serif", marginLeft:6 }}>{item.cat}</span>}
                </div>
                <button onClick={function(){ onUpdate({ packing:{ items: items.filter(function(_,j){ return j!==i }) } }) }} style={{ background:"none", border:"none", color:B.muted, cursor:"pointer", fontSize:16 }}>×</button>
              </div>
            )
          })}
          {/* Add custom item */}
          <AddPackingItem onAdd={function(text,cat){ onUpdate({ packing:{ items:[...items,{id:Date.now().toString(),text:text,cat:cat,done:false}] } }) }}/>
        </div>
      )}
    </div>
  )
}

function AddPackingItem({ onAdd }) {
  var [text, setText] = useState("")
  var [cat, setCat] = useState("Misc")
  var CATS = ["Clothing","Toiletries","Electronics","Medications","Documents","Kids stuff","Snacks","Misc"]
  return (
    <div style={{ marginTop:10, background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"8px 10px" }}>
      <div style={{ display:"flex", gap:6, marginBottom:6 }}>
        <input value={text} onChange={function(e){setText(e.target.value)}} onKeyDown={function(e){if(e.key==="Enter"&&text.trim()){ onAdd(text.trim(),cat); setText("") }}} placeholder="Add item…" style={{...inp(),flex:1}}/>
        <button onClick={function(){if(text.trim()){onAdd(text.trim(),cat);setText("")}}} style={{ background:B.coastal, border:"none", borderRadius:8, padding:"8px 12px", color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>Add</button>
      </div>
      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
        {CATS.map(function(c){
          return <button key={c} onClick={function(){setCat(c)}} style={{ background:cat===c?"rgba(106,163,196,0.2)":"transparent", border:"1px solid "+(cat===c?"rgba(106,163,196,0.4)":"rgba(255,255,255,0.1)"), borderRadius:20, padding:"2px 8px", fontSize:10, color:cat===c?B.coastal:B.muted, cursor:"pointer", fontFamily:"DM Sans,sans-serif" }}>{c}</button>
        })}
      </div>
    </div>
  )
}

function ItineraryCard({ moment, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [newDay, setNewDay] = useState("")
  const [newTime, setNewTime] = useState("")
  const [newItem, setNewItem] = useState("")
  const itinerary = moment.itinerary || {}
  const addItinItem = () => {
    if (!newDay.trim()||!newItem.trim()) return
    const newItin={...itinerary}
    if(!newItin[newDay]) newItin[newDay]=[]
    newItin[newDay]=[...newItin[newDay],{time:newTime,text:newItem.trim()}]
    onUpdate({itinerary:newItin})
    setNewItem(""); setNewTime("")
  }
  return (
    <div style={{ background:B.white, border:"1.5px solid "+B.border, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>📅</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, color:B.navy }}>Itinerary</div>
          <div style={{ fontSize:11, color:B.muted, marginTop:2 }}>{Object.keys(itinerary).length} day(s) planned</div>
        </div>
        <span style={{ fontSize:12, color:B.muted }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid "+B.border, padding:"10px 14px" }}>
          {Object.entries(itinerary).sort().map(([day,items])=>(
            <div key={day} style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:B.coastal, marginBottom:6, display:"flex", justifyContent:"space-between" }}>
                <span>{day}</span>
                <button onClick={()=>{ const n={...itinerary}; delete n[day]; onUpdate({itinerary:n}); }} style={{ background:"none", border:"none", color:B.muted, cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif" }}>Remove</button>
              </div>
              {items.map((item,i)=>(
                <div key={i} style={{ display:"flex", gap:8, padding:"5px 8px", background:B.soft, borderRadius:6, marginBottom:4 }}>
                  {item.time&&<span style={{ color:B.muted, minWidth:40, fontSize:11, flexShrink:0 }}>{item.time}</span>}
                  <span style={{ flex:1, fontSize:13, color:B.navy }}>{item.text}</span>
                  <button onClick={()=>{ const n={...itinerary}; n[day]=items.filter((_,j)=>j!==i); if(!n[day].length) delete n[day]; onUpdate({itinerary:n}); }} style={{ background:"none", border:"none", color:B.muted, cursor:"pointer", fontSize:14 }}>×</button>
                </div>
              ))}
            </div>
          ))}
          <div style={{ background:B.soft, borderRadius:10, padding:12, marginTop:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:B.muted, marginBottom:8 }}>Add item</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <input value={newDay} onChange={e=>setNewDay(e.target.value)} placeholder="Day (e.g. Day 1, Monday)" style={inp()}/>
              <div style={{ display:"flex", gap:6 }}>
                <input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)} style={{...inp(),flex:"0 0 100px"}}/>
                <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItinItem()} placeholder="Activity" style={{...inp(),flex:1}}/>
              </div>
              <button onClick={addItinItem} style={{ background:B.coastal, border:"none", borderRadius:8, padding:"8px", color:"#fff", fontSize:12, fontFamily:"DM Sans,sans-serif", fontWeight:600, cursor:"pointer" }}>Add to Itinerary</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DocumentsCard({ moment, onUpdate }) {
  const [open, setOpen] = useState(false)
  const docs = moment.documents || []

  function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    var loaded = 0
    var newDocs = [...docs]
    files.forEach(function(file) {
      var reader = new FileReader()
      reader.onload = function() {
        loaded++
        newDocs = [...newDocs, { id: uid(), name: file.name, type: file.type, size: file.size, data: reader.result, uploaded: new Date().toLocaleDateString() }]
        if (loaded === files.length) onUpdate({ documents: newDocs })
      }
      reader.readAsDataURL(file)
    })
  }

  function removeDoc(id) { onUpdate({ documents: docs.filter(function(d) { return d.id !== id }) }) }
  function openDoc(doc) { var a = document.createElement("a"); a.href = doc.data; a.download = doc.name; a.click() }

  return (
    <div style={{ background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(200,169,122,0.22)", borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>📎</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, color:"#faf8f4" }}>Documents & Files</div>
          <div style={{ fontSize:11, color:"rgba(250,248,244,0.45)", marginTop:2 }}>{docs.length} file{docs.length!==1?"s":""} attached</div>
        </div>
        <span style={{ fontSize:12, color:"rgba(250,248,244,0.45)" }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid rgba(200,169,122,0.18)", padding:"10px 14px" }}>
          <div style={{ fontSize:11, color:"rgba(250,248,244,0.4)", fontFamily:"DM Sans,sans-serif", marginBottom:8 }}>Confirmation sheets, tickets, booking PDFs, photos…</div>
          {docs.map(function(doc) {
            var isImage = doc.type && doc.type.startsWith("image/")
            var isPdf = doc.type === "application/pdf"
            var icon = isImage ? "🖼️" : isPdf ? "📋" : "📄"
            var kb = doc.size ? Math.round(doc.size / 1024) : null
            return (
              <div key={doc.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(200,169,122,0.15)", borderRadius:9, marginBottom:6 }}>
                {isImage
                  ? <div style={{ width:36, height:36, borderRadius:6, overflow:"hidden", flexShrink:0 }}><img src={doc.data} alt={doc.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/></div>
                  : <div style={{ width:36, height:36, borderRadius:6, background:"rgba(200,169,122,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{icon}</div>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#faf8f4", fontFamily:"DM Sans,sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{doc.name}</div>
                  <div style={{ fontSize:10, color:"rgba(250,248,244,0.4)", fontFamily:"DM Sans,sans-serif" }}>{doc.uploaded}{kb?" · "+kb+" KB":""}</div>
                </div>
                <button onClick={function() { openDoc(doc) }} style={{ background:"rgba(200,169,122,0.12)", border:"1px solid rgba(200,169,122,0.2)", borderRadius:6, padding:"3px 9px", fontSize:10, color:"#c8a97a", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, flexShrink:0 }}>Open</button>
                <button onClick={function() { removeDoc(doc.id) }} style={{ background:"none", border:"none", cursor:"pointer", opacity:0.3, fontSize:14, color:"#faf8f4", padding:"2px 4px", flexShrink:0 }}>✕</button>
              </div>
            )
          })}
          <label style={{ display:"block", border:"1.5px dashed rgba(200,169,122,0.25)", borderRadius:9, padding:"12px", textAlign:"center", cursor:"pointer", marginTop:4 }}>
            <div style={{ fontSize:13, color:"rgba(200,169,122,0.6)", fontFamily:"DM Sans,sans-serif" }}>+ Upload file</div>
            <div style={{ fontSize:10, color:"rgba(250,248,244,0.25)", fontFamily:"DM Sans,sans-serif", marginTop:2 }}>PDF, images, Word docs</div>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,image/*" onChange={handleFiles} style={{ display:"none" }}/>
          </label>
        </div>
      )}
    </div>
  )
}

function MomentDetail({ moment, onUpdate, onBack, onDelete }) {
  const update = (changes) => onUpdate({ ...moment, ...changes })
  const isParty = moment.type === "party"
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"rgba(250,248,244,0.6)", cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontSize:13, padding:0, display:"flex", alignItems:"center", gap:4 }}>← Back</button>
        <button onClick={()=>{ if(window.confirm("Delete this moment?")) onDelete(moment.id) }} style={{ background:"none", border:"none", color:"#e74c3c88", cursor:"pointer", fontSize:12, fontFamily:"DM Sans,sans-serif" }}>Delete</button>
      </div>
      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <span style={{ fontSize:24 }}>{isParty?"🎉":"✈️"}</span>
          <input value={moment.name||""} onChange={e=>update({name:e.target.value})} style={{ background:"transparent", border:"none", outline:"none", fontFamily:"Cormorant Garamond,serif", fontSize:22, fontWeight:700, color:"#faf8f4", flex:1 }}/>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:6 }}>
          <input type="date" value={moment.date||""} onChange={e=>update({date:e.target.value})} style={{ background:"rgba(250,248,244,0.08)", border:"1.5px solid rgba(250,248,244,0.2)", borderRadius:8, padding:"5px 10px", fontSize:12, color:"#faf8f4", fontFamily:"DM Sans,sans-serif", outline:"none" }}/>
          {!isParty&&<input type="date" value={moment.endDate||""} onChange={e=>update({endDate:e.target.value})} style={{ background:"rgba(250,248,244,0.08)", border:"1.5px solid rgba(250,248,244,0.2)", borderRadius:8, padding:"5px 10px", fontSize:12, color:"#faf8f4", fontFamily:"DM Sans,sans-serif", outline:"none" }}/>}
          <input value={moment.location||""} onChange={e=>update({location:e.target.value})} placeholder={isParty?"Venue":"Destination"} style={{ background:"rgba(250,248,244,0.08)", border:"1.5px solid rgba(250,248,244,0.2)", borderRadius:8, padding:"5px 10px", fontSize:12, color:"#faf8f4", fontFamily:"DM Sans,sans-serif", outline:"none", flex:1, minWidth:120 }}/>
        </div>
        <input value={moment.locationUrl||""} onChange={e=>update({locationUrl:e.target.value})} placeholder="Location URL (Google Maps, Airbnb, venue link…)" style={{ background:"rgba(250,248,244,0.05)", border:"1.5px solid rgba(250,248,244,0.12)", borderRadius:8, padding:"5px 10px", fontSize:12, color:"rgba(106,163,196,0.9)", fontFamily:"DM Sans,sans-serif", outline:"none", width:"100%", boxSizing:"border-box" }}/>
        {moment.locationUrl && <a href={moment.locationUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:"rgba(106,163,196,0.7)", fontFamily:"DM Sans,sans-serif", display:"block", marginTop:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>🔗 {moment.locationUrl}</a>}
      </div>

      {isParty && (
        <>
          <GuestCard moment={moment} onUpdate={update}/>
          <ChecklistCard emoji="🍽️" title="Food & Menu" color={B.sand} items={moment.food||[]} onUpdate={items=>update({food:items})} placeholder="Add dish..."/>
          <ShoppingCard moment={moment} onUpdate={update}/>
          <NotesTasksCard moment={moment} onUpdate={update}/>
          <DocumentsCard moment={moment} onUpdate={update}/>
        </>
      )}
      {!isParty && (
        <>
          <FlightCard moment={moment} onUpdate={update}/>
          <HotelCard moment={moment} onUpdate={update}/>
          <PackingCard moment={moment} onUpdate={update}/>
          <ItineraryCard moment={moment} onUpdate={update}/>
          <NotesTasksCard moment={moment} onUpdate={update}/>
          <DocumentsCard moment={moment} onUpdate={update}/>
        </>
      )}
    </div>
  )
}

// Keep old ChecklistCard for Food & Menu (no shopping integration needed)
function ChecklistCard({ emoji, title, color, items, onUpdate, placeholder }) {
  const [open, setOpen] = useState(false)
  const [newItem, setNewItem] = useState("")
  const done = items.filter(i=>i.done).length
  return (
    <div style={{ background:B.white, border:"1.5px solid "+B.border, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>{emoji}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, color:B.navy }}>{title}</div>
          <ProgressBar value={done} total={items.length} color={color}/>
        </div>
        <span style={{ fontSize:12, color:B.muted }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid "+B.border, padding:"10px 14px" }}>
          {items.map((item,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:"1px solid "+B.border }}>
              <div onClick={()=>onUpdate(items.map((x,j)=>j===i?{...x,done:!x.done}:x))} style={{ width:18, height:18, borderRadius:4, border:"1.5px solid "+(item.done?color:"rgba(0,0,0,0.15)"), background:item.done?color:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
                {item.done&&<span style={{ color:"#fff", fontSize:10 }}>✓</span>}
              </div>
              <span style={{ flex:1, fontSize:13, color:B.navy, textDecoration:item.done?"line-through":"none", opacity:item.done?0.5:1 }}>{item.text}</span>
              <button onClick={()=>onUpdate(items.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", color:B.muted, cursor:"pointer", fontSize:16 }}>×</button>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&newItem.trim()){ onUpdate([...items,{text:newItem.trim(),done:false}]); setNewItem(""); }}} placeholder={placeholder} style={{...inp(),flex:1}}/>
            <button onClick={()=>{ if(newItem.trim()){ onUpdate([...items,{text:newItem.trim(),done:false}]); setNewItem(""); }}} style={{ background:color, border:"none", borderRadius:8, padding:"8px 14px", color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MomentsSection() {
  const [moments, setMoments] = useState(() => {
    try { return JSON.parse(localStorage.getItem("af_moments")||"[]") } catch { return [] }
  })
  const [adding, setAdding] = useState(false)
  const [newType, setNewType] = useState("party")
  const [newName, setNewName] = useState("")
  const [selected, setSelected] = useState(null)
  const [viewDetail, setViewDetail] = useState(false)

  const save = (updated) => { setMoments(updated); lsSet("af_moments", updated) }
  const addMoment = () => {
    if (!newName.trim()) return
    const m = { id:uid(), type:newType, name:newName.trim(), date:"", location:"", locationUrl:"", guests:[], food:[], shopping:[], notes:[], flights:[{}], hotels:[{}], packing:{}, itinerary:{}, travelers:["shared"], documents:[] }
    save([...moments, m]); setAdding(false); setNewName(""); setSelected(m.id)
  }
  const updateMoment = (updated) => save(moments.map(m=>m.id===updated.id?updated:m))
  const deleteMoment = (id) => { save(moments.filter(m=>m.id!==id)); setSelected(null) }
  const selectedMoment = moments.find(m=>m.id===selected)
  useEffect(function() { setViewDetail(false); }, [selected])

  const isPastMoment = selectedMoment && selectedMoment.date && new Date(selectedMoment.date + "T00:00:00") < new Date()

  function createTemplate() {
    try {
      var tmpls = JSON.parse(localStorage.getItem("af_moment_templates") || "[]")
      tmpls.push({ id: uid(), name: selectedMoment.name, type: selectedMoment.type, notes: selectedMoment.notes || [], shopping: selectedMoment.shopping || [], packing: selectedMoment.packing || {}, itinerary: selectedMoment.itinerary || {}, food: selectedMoment.food || [], createdFrom: selectedMoment.id })
      localStorage.setItem("af_moment_templates", JSON.stringify(tmpls))
    } catch(ex) {}
    setSelected(null)
  }

  if (selectedMoment && isPastMoment && !viewDetail) return (
    <div style={{ padding: "0 0 2rem" }}>
      <button onClick={function() { setSelected(null); }} style={{ background: "none", border: "none", color: "rgba(250,248,244,0.6)", cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: 13, padding: "0 0 16px", display: "flex", alignItems: "center", gap: 4 }}>← Back</button>
      <div style={{ textAlign: "center", padding: "32px 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>{selectedMoment.type === "party" ? "🎉" : "✈️"}</div>
        <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 700, color: "#faf8f4", marginBottom: 8 }}>{selectedMoment.name}</div>
        {selectedMoment.date && <div style={{ fontSize: 12, color: "rgba(250,248,244,0.4)", marginBottom: 20 }}>{new Date(selectedMoment.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>}
        <div style={{ fontSize: 15, color: "rgba(250,248,244,0.65)", fontFamily: "DM Sans,sans-serif", marginBottom: 28, lineHeight: 1.5 }}>This moment has passed — what would you like to do?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 280, margin: "0 auto" }}>
          <button onClick={createTemplate} style={{ background: "rgba(200,169,122,0.15)", border: "1.5px solid rgba(200,169,122,0.4)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>📋 Create a template</button>
          <button onClick={function() { setSelected(null); }} style={{ background: "rgba(106,163,196,0.12)", border: "1.5px solid rgba(106,163,196,0.3)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#6ba3c4", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>💾 Save & keep</button>
          <button onClick={function() { if (window.confirm("Delete this moment?")) deleteMoment(selectedMoment.id); }} style={{ background: "rgba(201,122,122,0.1)", border: "1.5px solid rgba(201,122,122,0.25)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#c97a7a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>🗑 Delete</button>
        </div>
        <button onClick={function() { setViewDetail(true); }} style={{ marginTop: 20, background: "none", border: "none", color: "rgba(250,248,244,0.3)", fontSize: 11, fontFamily: "DM Sans,sans-serif", cursor: "pointer" }}>View / edit details →</button>
      </div>
    </div>
  )

  if (selectedMoment) return <MomentDetail moment={selectedMoment} onUpdate={updateMoment} onBack={function(){ setSelected(null); setViewDetail(false); }} onDelete={deleteMoment}/>

  const upcoming = moments.filter(m=>!m.date||new Date(m.date+"T00:00:00")>=new Date())
  const past = moments.filter(m=>m.date&&new Date(m.date+"T00:00:00")<new Date())

  return (
    <div style={{ padding:"0 0 2rem" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:22, fontWeight:700, color:"#faf8f4" }}>Moments</div>
          <div style={{ fontSize:12, color:"rgba(250,248,244,0.5)", marginTop:2 }}>Trips, parties & special occasions</div>
        </div>
        <button onClick={()=>setAdding(v=>!v)} style={{ background:"#c8a97a", border:"none", borderRadius:9, padding:"8px 16px", color:"#1a2744", fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, cursor:"pointer" }}>+ New</button>
      </div>
      {adding && (
        <div style={{ background:"rgba(250,248,244,0.06)", border:"1.5px solid rgba(250,248,244,0.15)", borderRadius:12, padding:14, marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"rgba(250,248,244,0.6)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>New Moment</div>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <button onClick={()=>setNewType("party")} style={{ flex:1, background:newType==="party"?"#c8a97a":"transparent", border:"1.5px solid "+(newType==="party"?"#c8a97a":"rgba(250,248,244,0.2)"), borderRadius:8, padding:"8px", color:newType==="party"?"#1a2744":"rgba(250,248,244,0.7)", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" }}>🎉 Party / Event</button>
            <button onClick={()=>setNewType("travel")} style={{ flex:1, background:newType==="travel"?"#3a6b8a":"transparent", border:"1.5px solid "+(newType==="travel"?"#3a6b8a":"rgba(250,248,244,0.2)"), borderRadius:8, padding:"8px", color:newType==="travel"?"#fff":"rgba(250,248,244,0.7)", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif" }}>✈️ Travel</button>
          </div>
          <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMoment()} placeholder={newType==="party"?"Event name":"Trip name"} style={{ border:"1.5px solid rgba(250,248,244,0.2)", borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif", width:"100%", boxSizing:"border-box", background:"rgba(250,248,244,0.08)", color:"#faf8f4", marginBottom:10 }}/>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={addMoment} disabled={!newName.trim()} style={{ flex:2, background:"#c8a97a", border:"none", borderRadius:8, padding:"9px", color:"#1a2744", fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, cursor:"pointer", opacity:newName.trim()?1:0.5 }}>Create Moment</button>
            <button onClick={()=>setAdding(false)} style={{ flex:1, background:"transparent", border:"1.5px solid rgba(250,248,244,0.2)", borderRadius:8, padding:"9px", color:"rgba(250,248,244,0.6)", fontFamily:"DM Sans,sans-serif", fontSize:13, cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}
      {moments.length===0&&!adding&&(
        <div style={{ textAlign:"center", padding:"40px 20px" }}>
          <div style={{ fontSize:36, marginBottom:12 }}>✨</div>
          <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:20, color:"#faf8f4", marginBottom:8 }}>No moments yet</div>
          <div style={{ fontSize:13, color:"rgba(250,248,244,0.45)", lineHeight:1.6 }}>Add a trip, party, or special occasion.</div>
        </div>
      )}
      {upcoming.length>0&&(
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"rgba(250,248,244,0.4)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Upcoming</div>
          {upcoming.map(m=>{
            const daysUntil=m.date?Math.ceil((new Date(m.date+"T00:00:00")-new Date())/(1000*60*60*24)):null
            var cdColor = daysUntil===null ? null : daysUntil<=3 ? "#c97a7a" : daysUntil<=14 ? "#c8a97a" : "#6ba3c4"
            var cdLabel = daysUntil===null ? null : daysUntil===0 ? "Today! 🎉" : daysUntil===1 ? "Tomorrow" : daysUntil+" days away"
            var cdPct = (daysUntil!==null&&daysUntil<=90) ? Math.max(4, Math.round((1-(daysUntil/90))*100)) : null
            return (
              <div key={m.id} onClick={()=>setSelected(m.id)} style={{ background:"rgba(250,248,244,0.06)", border:"1.5px solid "+(daysUntil!==null&&daysUntil<=7?cdColor+"55":"rgba(250,248,244,0.15)"), borderRadius:12, padding:"12px 14px", marginBottom:8, cursor:"pointer" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:20 }}>{m.type==="party"?"🎉":"✈️"}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:14, fontWeight:700, color:"#faf8f4" }}>{m.name||"Unnamed"}</div>
                    <div style={{ display:"flex", gap:8, marginTop:2, flexWrap:"wrap", alignItems:"center" }}>
                      {m.date&&<span style={{ fontSize:11, color:"rgba(250,248,244,0.5)" }}>{new Date(m.date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
                      {m.location&&<span style={{ fontSize:11, color:"rgba(250,248,244,0.4)" }}>📍 {m.location}</span>}
                    </div>
                    {cdLabel&&(
                      <div style={{ marginTop:7 }}>
                        <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:cdColor+"22", border:"1px solid "+cdColor+"55", borderRadius:20, padding:"3px 9px", marginBottom:cdPct?5:0 }}>
                          <span style={{ fontSize:10, fontWeight:800, color:cdColor, letterSpacing:"0.04em", textTransform:"uppercase" }}>⏳ {cdLabel}</span>
                        </div>
                        {cdPct&&(
                          <div style={{ height:3, background:"rgba(255,255,255,0.08)", borderRadius:2, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:cdPct+"%", background:"linear-gradient(90deg,"+cdColor+"88,"+cdColor+")", borderRadius:2, transition:"width 0.3s" }}/>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize:12, color:"rgba(250,248,244,0.4)", flexShrink:0 }}>→</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {past.length>0&&(
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"rgba(250,248,244,0.3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Past</div>
          {past.map(m=>(
            <div key={m.id} onClick={()=>setSelected(m.id)} style={{ background:"rgba(250,248,244,0.03)", border:"1.5px solid rgba(250,248,244,0.08)", borderRadius:12, padding:"12px 14px", marginBottom:8, cursor:"pointer", opacity:0.7 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:20 }}>{m.type==="party"?"🎉":"✈️"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"rgba(250,248,244,0.7)", fontFamily:"DM Sans,sans-serif" }}>{m.name}</div>
                  {m.date&&<div style={{ fontSize:11, color:"rgba(250,248,244,0.4)" }}>{new Date(m.date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>}
                </div>
                <button onClick={e=>{e.stopPropagation();deleteMoment(m.id)}} style={{ background:"none", border:"none", color:"rgba(250,248,244,0.3)", cursor:"pointer", fontSize:16 }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
