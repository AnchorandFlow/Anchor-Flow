import { useState } from "react"

const B = {
  navy: "#faf8f4", coastal: "#6ba3c4", sage: "#7a9e8e", sand: "#c8a97a",
  warm: "#faf8f4", white: "rgba(255,255,255,0.06)", border: "rgba(200,169,122,0.22)",
  muted: "rgba(250,248,244,0.45)", soft: "rgba(255,255,255,0.05)", rose: "#c97a7a", lavender: "#9b8fd4",
}

const inp = (extra={}) => ({ border:"1.5px solid "+B.border, borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif", width:"100%", boxSizing:"border-box", background:"#1e3060", color:"#faf8f4", ...extra })
const uid = () => Math.random().toString(36).slice(2)

const PACKING_CATEGORIES = ["Clothing","Toiletries","Electronics","Medications","Documents","Kids stuff","Snacks","Misc"]

const PACKING_SUGGESTIONS = {
  "Clothing": ["T-shirts","Pants","Underwear","Socks","Pajamas","Swimsuit","Jacket","Shoes","Hat"],
  "Toiletries": ["Toothbrush","Toothpaste","Shampoo","Conditioner","Body wash","Deodorant","Sunscreen","Makeup","Razor"],
  "Electronics": ["Phone charger","Laptop","Laptop charger","Headphones","Camera","Power bank","Adapter"],
  "Medications": ["Prescription medications","Ibuprofen","Allergy medicine","Band-aids","Antacids"],
  "Documents": ["Passport","ID","Travel insurance","Booking confirmations","Cash","Credit cards"],
  "Kids stuff": ["Diapers","Wipes","Snacks","Favorite toy","Car seat","Stroller","Kids medications"],
  "Snacks": ["Protein bars","Trail mix","Water bottles","Crackers","Fruit"],
  "Misc": ["Umbrella","Book","Sunglasses","Reusable bags","First aid kit","Laundry bag"],
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

function FlightCard({ moment, onUpdate }) {
  const [open, setOpen] = useState(false)
  const flights = moment.flights || [{}]
  return (
    <div style={{ background:B.white, border:"1.5px solid "+B.border, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>✈️</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, color:B.navy }}>Flights</div>
          <div style={{ fontSize:11, color:B.muted, marginTop:2 }}>{flights.filter(f=>f.airline).length} flight(s) added</div>
        </div>
        <span style={{ fontSize:12, color:B.muted }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid "+B.border, padding:"10px 14px" }}>
          {flights.map((f,i)=>(
            <div key={i} style={{ background:B.soft, borderRadius:10, padding:12, marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:B.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Flight {i+1}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <input value={f.airline||""} onChange={e=>onUpdate({flights:flights.map((x,j)=>j===i?{...x,airline:e.target.value}:x)})} placeholder="Airline" style={inp()}/>
                <input value={f.confirmation||""} onChange={e=>onUpdate({flights:flights.map((x,j)=>j===i?{...x,confirmation:e.target.value}:x)})} placeholder="Confirmation #" style={inp()}/>
                <div style={{ display:"flex", gap:6 }}>
                  <input value={f.departure||""} onChange={e=>onUpdate({flights:flights.map((x,j)=>j===i?{...x,departure:e.target.value}:x)})} placeholder="From" style={{...inp(),flex:1}}/>
                  <input value={f.arrival||""} onChange={e=>onUpdate({flights:flights.map((x,j)=>j===i?{...x,arrival:e.target.value}:x)})} placeholder="To" style={{...inp(),flex:1}}/>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <div style={{ flex:1 }}><div style={{ fontSize:11, color:B.muted, marginBottom:3 }}>Departs</div><input type="time" value={f.departTime||""} onChange={e=>onUpdate({flights:flights.map((x,j)=>j===i?{...x,departTime:e.target.value}:x)})} style={inp()}/></div>
                  <div style={{ flex:1 }}><div style={{ fontSize:11, color:B.muted, marginBottom:3 }}>Arrives</div><input type="time" value={f.arriveTime||""} onChange={e=>onUpdate({flights:flights.map((x,j)=>j===i?{...x,arriveTime:e.target.value}:x)})} style={inp()}/></div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={()=>onUpdate({flights:[...flights,{}]})} style={{ background:"none", border:"1.5px dashed "+B.border, borderRadius:8, padding:"8px", color:B.muted, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif", width:"100%" }}>+ Add another flight</button>
        </div>
      )}
    </div>
  )
}

function HotelCard({ moment, onUpdate }) {
  const [open, setOpen] = useState(false)
  const hotels = moment.hotels || [{}]
  return (
    <div style={{ background:B.white, border:"1.5px solid "+B.border, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>🏨</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, color:B.navy }}>Hotels</div>
          <div style={{ fontSize:11, color:B.muted, marginTop:2 }}>{hotels.filter(h=>h.name).length} hotel(s) added</div>
        </div>
        <span style={{ fontSize:12, color:B.muted }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid "+B.border, padding:"10px 14px" }}>
          {hotels.map((h,i)=>(
            <div key={i} style={{ background:B.soft, borderRadius:10, padding:12, marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:B.muted, textTransform:"uppercase", marginBottom:8 }}>Hotel {i+1}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <input value={h.name||""} onChange={e=>onUpdate({hotels:hotels.map((x,j)=>j===i?{...x,name:e.target.value}:x)})} placeholder="Hotel name" style={inp()}/>
                <input value={h.confirmation||""} onChange={e=>onUpdate({hotels:hotels.map((x,j)=>j===i?{...x,confirmation:e.target.value}:x)})} placeholder="Confirmation #" style={inp()}/>
                <input value={h.address||""} onChange={e=>onUpdate({hotels:hotels.map((x,j)=>j===i?{...x,address:e.target.value}:x)})} placeholder="Address" style={inp()}/>
                <div style={{ display:"flex", gap:6 }}>
                  <div style={{ flex:1 }}><div style={{ fontSize:11, color:B.muted, marginBottom:3 }}>Check-in</div><input type="date" value={h.checkIn||""} onChange={e=>onUpdate({hotels:hotels.map((x,j)=>j===i?{...x,checkIn:e.target.value}:x)})} style={inp()}/></div>
                  <div style={{ flex:1 }}><div style={{ fontSize:11, color:B.muted, marginBottom:3 }}>Check-out</div><input type="date" value={h.checkOut||""} onChange={e=>onUpdate({hotels:hotels.map((x,j)=>j===i?{...x,checkOut:e.target.value}:x)})} style={inp()}/></div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={()=>onUpdate({hotels:[...hotels,{}]})} style={{ background:"none", border:"1.5px dashed "+B.border, borderRadius:8, padding:"8px", color:B.muted, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif", width:"100%" }}>+ Add another hotel</button>
        </div>
      )}
    </div>
  )
}

function PackingCard({ moment, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState("Clothing")
  const [activePerson, setActivePerson] = useState("shared")
  const [newItem, setNewItem] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const packing = moment.packing || {}
  const people = moment.travelers || ["shared"]
  const getCategoryItems = (person, cat) => (packing[person]?.[cat] || [])
  const totalItems = people.flatMap(p => PACKING_CATEGORIES.flatMap(c => getCategoryItems(p,c))).length
  const packedItems = people.flatMap(p => PACKING_CATEGORIES.flatMap(c => getCategoryItems(p,c).filter(i=>i.done))).length
  const updateItems = (person, cat, items) => {
    const newPacking = { ...packing, [person]: { ...(packing[person]||{}), [cat]: items } }
    onUpdate({ packing: newPacking })
  }
  const addItem = (text) => {
    if (!text.trim()) return
    updateItems(activePerson, activeCategory, [...getCategoryItems(activePerson,activeCategory), { text:text.trim(), done:false }])
    setNewItem("")
  }
  return (
    <div style={{ background:B.white, border:"1.5px solid "+B.border, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:18 }}>🧳</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:700, color:B.navy }}>Packing</div>
          <ProgressBar value={packedItems} total={totalItems} color={B.coastal}/>
        </div>
        <span style={{ fontSize:12, color:B.muted }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop:"1px solid "+B.border }}>
          <div style={{ padding:"10px 14px 0" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
              <div style={{ fontSize:11, fontWeight:700, color:B.muted, textTransform:"uppercase", letterSpacing:"0.06em" }}>Who</div>
              <button onClick={()=>{ const name=prompt("Traveler name:"); if(name?.trim()) onUpdate({travelers:[...people.filter(p=>p!=="shared"),name.trim(),"shared"]}) }} style={{ background:"none", border:"none", fontSize:11, color:B.coastal, cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontWeight:600 }}>+ Add person</button>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
              {people.map(p=>(
                <button key={p} onClick={()=>setActivePerson(p)} style={{ background:activePerson===p?B.coastal:"transparent", border:"1.5px solid "+(activePerson===p?B.coastal:B.border), borderRadius:20, padding:"4px 12px", fontSize:11, color:activePerson===p?"#fff":B.muted, cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontWeight:600 }}>
                  {p==="shared"?"🏠 Shared":p}
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowX:"auto", display:"flex", borderTop:"1px solid "+B.border, borderBottom:"1px solid "+B.border }}>
            {PACKING_CATEGORIES.map(cat=>{
              const count = getCategoryItems(activePerson,cat).length
              return (
                <button key={cat} onClick={()=>setActiveCategory(cat)} style={{ background:"none", border:"none", borderBottom:activeCategory===cat?"2px solid "+B.coastal:"2px solid transparent", color:activeCategory===cat?B.coastal:B.muted, padding:"7px 10px", fontSize:10, fontFamily:"DM Sans,sans-serif", fontWeight:activeCategory===cat?700:400, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
                  {cat} {count>0&&"("+count+")"}
                </button>
              )
            })}
          </div>
          <div style={{ padding:"10px 14px" }}>
            {getCategoryItems(activePerson,activeCategory).map((item,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:"1px solid "+B.border }}>
                <div onClick={()=>updateItems(activePerson,activeCategory,getCategoryItems(activePerson,activeCategory).map((x,j)=>j===i?{...x,done:!x.done}:x))} style={{ width:18, height:18, borderRadius:4, border:"1.5px solid "+(item.done?B.coastal:"rgba(0,0,0,0.15)"), background:item.done?B.coastal:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
                  {item.done&&<span style={{ color:"#fff", fontSize:10 }}>✓</span>}
                </div>
                <span style={{ flex:1, fontSize:13, color:B.navy, textDecoration:item.done?"line-through":"none", opacity:item.done?0.5:1 }}>{item.text}</span>
                <button onClick={()=>updateItems(activePerson,activeCategory,getCategoryItems(activePerson,activeCategory).filter((_,j)=>j!==i))} style={{ background:"none", border:"none", color:B.muted, cursor:"pointer", fontSize:16 }}>×</button>
              </div>
            ))}
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem(newItem)} placeholder={"Add to "+activeCategory+"..."} style={{...inp(),flex:1}}/>
              <button onClick={()=>addItem(newItem)} style={{ background:B.coastal, border:"none", borderRadius:8, padding:"8px 14px", color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:12, fontWeight:600, cursor:"pointer" }}>Add</button>
            </div>
            <button onClick={()=>setShowSuggestions(v=>!v)} style={{ background:"none", border:"none", fontSize:11, color:B.coastal, cursor:"pointer", fontFamily:"DM Sans,sans-serif", marginTop:8, padding:0 }}>
              {showSuggestions?"Hide":"Show"} suggestions
            </button>
            {showSuggestions && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:6 }}>
                {(PACKING_SUGGESTIONS[activeCategory]||[]).filter(s=>!getCategoryItems(activePerson,activeCategory).find(i=>i.text===s)).map(s=>(
                  <button key={s} onClick={()=>updateItems(activePerson,activeCategory,[...getCategoryItems(activePerson,activeCategory),{text:s,done:false}])} style={{ background:B.soft, border:"1px solid "+B.border, borderRadius:20, padding:"3px 10px", fontSize:11, color:B.navy, cursor:"pointer", fontFamily:"DM Sans,sans-serif" }}>+ {s}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
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
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <input type="date" value={moment.date||""} onChange={e=>update({date:e.target.value})} style={{ background:"rgba(250,248,244,0.08)", border:"1.5px solid rgba(250,248,244,0.2)", borderRadius:8, padding:"5px 10px", fontSize:12, color:"#faf8f4", fontFamily:"DM Sans,sans-serif", outline:"none" }}/>
          {!isParty&&<input type="date" value={moment.endDate||""} onChange={e=>update({endDate:e.target.value})} style={{ background:"rgba(250,248,244,0.08)", border:"1.5px solid rgba(250,248,244,0.2)", borderRadius:8, padding:"5px 10px", fontSize:12, color:"#faf8f4", fontFamily:"DM Sans,sans-serif", outline:"none" }}/>}
          <input value={moment.location||""} onChange={e=>update({location:e.target.value})} placeholder={isParty?"Venue":"Destination"} style={{ background:"rgba(250,248,244,0.08)", border:"1.5px solid rgba(250,248,244,0.2)", borderRadius:8, padding:"5px 10px", fontSize:12, color:"#faf8f4", fontFamily:"DM Sans,sans-serif", outline:"none", flex:1, minWidth:120 }}/>
        </div>
      </div>
      {isParty && (
        <>
          <GuestCard moment={moment} onUpdate={update}/>
          <ChecklistCard emoji="🍽️" title="Food & Menu" color={B.sand} items={moment.food||[]} onUpdate={items=>update({food:items})} placeholder="Add dish..."/>
          <ChecklistCard emoji="🛒" title="Shopping List" color={B.sage} items={moment.shopping||[]} onUpdate={items=>update({shopping:items})} placeholder="Add item to buy..."/>
          <ChecklistCard emoji="📋" title="Notes & Tasks" color={B.lavender} items={moment.notes||[]} onUpdate={items=>update({notes:items})} placeholder="Add note..."/>
        </>
      )}
      {!isParty && (
        <>
          <FlightCard moment={moment} onUpdate={update}/>
          <HotelCard moment={moment} onUpdate={update}/>
          <PackingCard moment={moment} onUpdate={update}/>
          <ItineraryCard moment={moment} onUpdate={update}/>
        </>
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

  const save = (updated) => { setMoments(updated); try { localStorage.setItem("af_moments", JSON.stringify(updated)) } catch {} }
  const addMoment = () => {
    if (!newName.trim()) return
    const m = { id:uid(), type:newType, name:newName.trim(), date:"", location:"", guests:[], food:[], shopping:[], notes:[], flights:[{}], hotels:[{}], packing:{}, itinerary:{}, travelers:["shared"] }
    save([...moments, m]); setAdding(false); setNewName(""); setSelected(m.id)
  }
  const updateMoment = (updated) => save(moments.map(m=>m.id===updated.id?updated:m))
  const deleteMoment = (id) => { save(moments.filter(m=>m.id!==id)); setSelected(null) }
  const selectedMoment = moments.find(m=>m.id===selected)

  if (selectedMoment) return <MomentDetail moment={selectedMoment} onUpdate={updateMoment} onBack={()=>setSelected(null)} onDelete={deleteMoment}/>

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
            return (
              <div key={m.id} onClick={()=>setSelected(m.id)} style={{ background:"rgba(250,248,244,0.06)", border:"1.5px solid rgba(250,248,244,0.15)", borderRadius:12, padding:"12px 14px", marginBottom:8, cursor:"pointer" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:20 }}>{m.type==="party"?"🎉":"✈️"}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:14, fontWeight:700, color:"#faf8f4" }}>{m.name||"Unnamed"}</div>
                    <div style={{ display:"flex", gap:8, marginTop:2 }}>
                      {m.date&&<span style={{ fontSize:11, color:"rgba(250,248,244,0.5)" }}>{new Date(m.date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
                      {daysUntil!==null&&daysUntil>=0&&<span style={{ fontSize:11, color:daysUntil<=7?"#c97a7a":"#c8a97a", fontWeight:700 }}>{daysUntil===0?"Today!":daysUntil===1?"Tomorrow":daysUntil+" days"}</span>}
                      {m.location&&<span style={{ fontSize:11, color:"rgba(250,248,244,0.4)" }}>📍 {m.location}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:12, color:"rgba(250,248,244,0.4)" }}>→</span>
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
