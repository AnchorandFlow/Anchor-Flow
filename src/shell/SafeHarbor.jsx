// src/shell/SafeHarbor.jsx — Family emergency plan. "Prepared, not worried."
import { useState, useEffect, useRef } from "react"

var SERIF = "'Cormorant Garamond', serif"
var SANS  = "'DM Sans', sans-serif"

var G = {
  navy:       "#1B3A5C",
  gold:       "#C8A96E",
  goldPale:   "rgba(200,169,110,0.12)",
  goldBorder: "rgba(200,169,110,0.28)",
  cream:      "#faf8f4",
  muted:      "rgba(250,248,244,0.35)",
  soft:       "rgba(250,248,244,0.65)",
  sea:        "#7CB5B5",
  seaPale:    "rgba(124,181,181,0.14)",
  seaBorder:  "rgba(124,181,181,0.28)",
  denim:      "#3D6B8E",
  denimPale:  "rgba(61,107,142,0.18)",
  denimBorder:"rgba(61,107,142,0.35)",
  card:       "rgba(250,242,229,0.04)",
  cardBorder: "rgba(250,242,229,0.1)",
}

// ── 6 P categories ───────────────────────────────────────────────────────────
var CAT_ORDER  = ["people","prescriptions","papers","phones","personal","priceless"]
var CAT_LABELS = { people:"People & Pets", prescriptions:"Prescriptions", papers:"Papers", phones:"Phones & Tech", personal:"Personal Needs", priceless:"Priceless Items" }
var CAT_EMOJIS = { people:"👨‍👩‍👧", prescriptions:"💊", papers:"📄", phones:"📱", personal:"🎒", priceless:"📸" }

// ── Tier metadata ─────────────────────────────────────────────────────────────
var TIER_META = [
  { id:1, label:"Leave Now",        sub:"10 min",  color:G.denim, pale:G.denimPale, border:G.denimBorder },
  { id:2, label:"Prepare to Leave", sub:"30 min",  color:G.sea,   pale:G.seaPale,   border:G.seaBorder   },
  { id:3, label:"Time to Prepare",  sub:"60 min",  color:G.gold,  pale:G.goldPale,  border:G.goldBorder  },
]
var TIER_NOTE = {
  2: "Your 30-minute plan includes all Leave Now items.",
  3: "Your 60-minute plan includes all Leave Now and Prepare to Leave items.",
}

// ── Hazard metadata ───────────────────────────────────────────────────────────
var HAZARD_META = [
  { id:"homeFire",    emoji:"🔥", label:"Home Fire",    urgent:"Go now",              color:"#D08060", pale:"rgba(208,128,96,0.1)",  border:"rgba(208,128,96,0.3)"  },
  { id:"wildfire",    emoji:"🌲", label:"Wildfire",     urgent:"Prepare to evacuate", color:"#C8904E", pale:"rgba(200,144,78,0.1)",  border:"rgba(200,144,78,0.3)"  },
  { id:"tornado",     emoji:"🌪️", label:"Tornado",      urgent:"Shelter now",         color:"#8E7CB5", pale:"rgba(142,124,181,0.1)", border:"rgba(142,124,181,0.3)" },
  { id:"winterStorm", emoji:"❄️", label:"Winter Storm", urgent:"Prepare the home",    color:G.sea,     pale:G.seaPale,              border:G.seaBorder             },
  { id:"powerOutage", emoji:"⚡", label:"Power Outage", urgent:"Prepare the home",    color:"#B5A87C", pale:"rgba(181,168,124,0.1)", border:"rgba(181,168,124,0.3)" },
  { id:"extremeHeat", emoji:"☀️", label:"Extreme Heat", urgent:"Prepare the home",    color:G.gold,    pale:G.goldPale,             border:G.goldBorder            },
]

// ── Hazard Before/During/After content (sourced from ready.gov) ────────────
var HAZARD_CONTENT = {
  homeFire: {
    source:"ready.gov/home-fires",
    urgentNote:"Home fires move fast. Get everyone out immediately — there is no time to gather belongings.",
    before:[
      "Install smoke alarms on every floor and outside all sleeping areas — test monthly",
      "Create and practice a home fire escape plan with two exits per room",
      "Designate a meeting place outside, far enough from the home",
      "Teach all household members how to call 911",
      "Keep dryer lint clean and maintain appliances — most home fires start in the kitchen",
    ],
    during:[
      "GET OUT immediately — do not stop for any belongings",
      "If smoke is present, crawl low under it on your way out",
      "Feel doors before opening — if hot, use another exit",
      "Close doors behind you to slow the fire's spread",
      "Call 911 from outside once you are safely away",
      "Never go back inside a burning building",
    ],
    after:[
      "Do not re-enter until fire officials say it is safe",
      "Contact your insurance company as soon as possible",
      "Discard food, medications, or cosmetics exposed to heat or smoke",
      "Seek support if anyone is experiencing emotional distress",
    ],
  },
  wildfire: {
    source:"ready.gov/wildfires",
    urgentNote:"Leave early — wildfires can spread faster than a person can run.",
    before:[
      "Create a defensible space — clear vegetation at least 30 ft from your home",
      "Prepare your Go Bag and know at least two evacuation routes",
      "Sign up for community emergency alerts and monitor local conditions",
      "Move outdoor furniture, doormats, and cushions inside when a warning is issued",
      "Close all windows, doors, and garage doors to slow ember entry",
    ],
    during:[
      "Leave early — do not wait for a mandatory evacuation order",
      "Grab your Go Bag and follow your predetermined evacuation route",
      "Wear a mask, long sleeves, and sturdy shoes to protect from ash",
      "Alert neighbors who may need help evacuating",
      "If smoke is heavy and you cannot safely drive, shelter in a structure",
    ],
    after:[
      "Return only when authorities declare it safe",
      "Photograph damage before any cleanup begins",
      "Wear protective gear and an N95 mask when cleaning up ash",
      "Check for hot spots — ash can remain dangerously hot for days",
      "Contact your insurance company to begin a claim",
    ],
  },
  tornado: {
    source:"ready.gov/tornadoes",
    urgentNote:"Shelter immediately. There is no time to grab belongings once a tornado warning is issued.",
    before:[
      "Know your community's warning systems — sirens, weather alerts, local radio",
      "Identify the safest room in your home — interior room on the lowest floor, away from windows",
      "Practice a tornado drill with all household members so it becomes automatic",
      "Keep emergency supplies in your shelter area",
      "Stay weather-aware during severe weather seasons",
    ],
    during:[
      "Go immediately to the lowest floor interior room, away from windows",
      "Cover your head and neck with your arms or a heavy blanket",
      "Do not shelter in a mobile home — go to a nearby sturdy structure",
      "If outside with no shelter, lie in a low-lying ditch and cover your head",
      "Stay sheltered until the storm has fully passed and the all-clear is given",
    ],
    after:[
      "Stay away from downed power lines — treat all lines as live",
      "Check for injured people and call 911 if needed",
      "Wear sturdy shoes when walking through debris",
      "Photograph damage before cleanup begins",
      "Be cautious of weakened structures before entering damaged buildings",
    ],
  },
  winterStorm: {
    source:"ready.gov/winter-weather",
    urgentNote:null,
    before:[
      "Stock an emergency supply kit with at least 3 days of food, water, and medications",
      "Keep extra blankets, warm layering clothing, and waterproof boots on hand",
      "Service heating equipment and fireplaces before cold season begins",
      "Insulate pipes and know how to shut off the main water valve",
      "Keep your car's fuel tank at least half full during winter months",
    ],
    during:[
      "Stay indoors and limit travel to essential trips only",
      "Layer clothing and keep indoor temperatures safe to prevent hypothermia",
      "Never use generators, grills, or camp stoves indoors — carbon monoxide risk",
      "Check on elderly neighbors, relatives, and those with medical needs",
      "Watch for signs of frostbite and hypothermia in household members",
    ],
    after:[
      "Avoid overexertion when shoveling — take breaks and stay hydrated",
      "Check on vulnerable neighbors who may need assistance",
      "Inspect your home for damage from heavy snow or ice loads",
      "Thaw frozen pipes carefully — never use an open flame",
    ],
  },
  powerOutage: {
    source:"ready.gov/power-outages",
    urgentNote:null,
    before:[
      "Keep flashlights, extra batteries, and a battery-powered radio in an easy-to-find place",
      "Keep your phone and backup power banks charged",
      "Know the location of your circuit breakers and main shutoff",
      "Stock non-perishable food that doesn't require cooking",
      "If someone in the household depends on powered medical equipment, register with your utility company",
    ],
    during:[
      "Turn off major appliances to prevent damage when power returns",
      "Keep refrigerator and freezer doors closed — a full freezer stays safe for 48 hours",
      "Never run a generator indoors or in an attached garage",
      "Use battery-powered light sources when possible rather than candles",
      "Check on vulnerable neighbors who may need assistance",
    ],
    after:[
      "Discard food held above 40°F for more than 2 hours",
      "Turn appliances back on gradually when power returns to avoid overloads",
      "Report downed power lines to your utility company — never approach them",
      "Check in with family members and neighbors",
    ],
  },
  extremeHeat: {
    source:"ready.gov/heat",
    urgentNote:null,
    before:[
      "Know the signs of heat exhaustion and heat stroke — and what to do for each",
      "Identify air-conditioned cooling centers in your community",
      "Service your air conditioning before hot weather arrives",
      "Stock extra water — at least 1 gallon per person per day",
      "Never leave children or pets alone in a parked vehicle, even briefly",
    ],
    during:[
      "Stay indoors in air-conditioned spaces during peak heat hours (10am–4pm)",
      "Drink plenty of water even if you do not feel thirsty",
      "Wear lightweight, light-colored, loose-fitting clothing",
      "Check on elderly relatives, neighbors, and those without air conditioning",
      "Never leave children or pets in a parked car — even for a moment",
    ],
    after:[
      "Continue to monitor for heat-related illness symptoms in all household members",
      "Watch weather forecasts and stay prepared for additional heat events",
      "Check in on vulnerable neighbors who may still need assistance",
    ],
  },
}

// ── Default grab items (sourced from ready.gov/kit) ───────────────────────
var DEFAULT_GRAB_ITEMS = [
  // Tier 1 — People & Pets
  { id:"g01", name:"All household members accounted for",    location:"", assignedTo:"", tier:1, category:"people",        checked:false, custom:false, source:"people and their needs are the first priority" },
  { id:"g02", name:"Pets + leash or carrier",                location:"", assignedTo:"", tier:1, category:"people",        checked:false, custom:false, source:"animals, food, water and supplies for your pet" },
  // Tier 1 — Prescriptions
  { id:"g03", name:"Prescription medications",               location:"Medicine cabinet", assignedTo:"", tier:1, category:"prescriptions", checked:false, custom:false, source:"prescription medications are a basic kit essential" },
  { id:"g04", name:"First aid kit",                          location:"", assignedTo:"", tier:1, category:"prescriptions", checked:false, custom:false, source:"first aid kit is a basic kit essential" },
  // Tier 1 — Papers
  { id:"g05", name:"Passports + birth certificates",         location:"", assignedTo:"", tier:1, category:"papers",        checked:false, custom:false, source:"identification in a waterproof portable container" },
  { id:"g06", name:"Insurance policies",                     location:"", assignedTo:"", tier:1, category:"papers",        checked:false, custom:false, source:"copies of insurance policies in waterproof container" },
  // Tier 1 — Phones & Tech
  { id:"g07", name:"Phones + chargers + power bank",         location:"", assignedTo:"", tier:1, category:"phones",        checked:false, custom:false, source:"cell phones with chargers and a backup battery" },
  { id:"g08", name:"Keys + wallets",                         location:"", assignedTo:"", tier:1, category:"phones",        checked:false, custom:false, source:"keys and cash for your emergency kit" },
  // Tier 1 — Personal Needs
  { id:"g09", name:"Water — 1 gallon per person per day",    location:"", assignedTo:"", tier:1, category:"personal",      checked:false, custom:false, source:"water is the first basic kit essential" },
  // Tier 2 — People & Pets
  { id:"g10", name:"Pet food + water supply",                location:"", assignedTo:"", tier:2, category:"people",        checked:false, custom:false, source:"pet food, water and supplies for your pet" },
  // Tier 2 — Prescriptions
  { id:"g11", name:"Non-prescription medications",           location:"", assignedTo:"", tier:2, category:"prescriptions", checked:false, custom:false, source:"pain relievers, anti-diarrhea medication, antacids" },
  // Tier 2 — Papers
  { id:"g12", name:"Bank account records + cash in small bills", location:"", assignedTo:"", tier:2, category:"papers",   checked:false, custom:false, source:"bank account records and cash" },
  // Tier 2 — Phones & Tech
  { id:"g13", name:"Battery-powered or hand-crank radio",    location:"", assignedTo:"", tier:2, category:"phones",        checked:false, custom:false, source:"NOAA Weather Radio with tone alert is a basic kit essential" },
  { id:"g14", name:"Flashlights + extra batteries",          location:"", assignedTo:"", tier:2, category:"phones",        checked:false, custom:false, source:"flashlight is a basic kit essential" },
  { id:"g15", name:"Laptop or external hard drive",          location:"", assignedTo:"", tier:2, category:"phones",        checked:false, custom:false, source:"additional items — computers" },
  // Tier 2 — Personal Needs
  { id:"g16", name:"Non-perishable food — 3-day supply",     location:"", assignedTo:"", tier:2, category:"personal",      checked:false, custom:false, source:"food is the second basic kit essential" },
  { id:"g17", name:"Feminine supplies + hand sanitizer",     location:"", assignedTo:"", tier:2, category:"personal",      checked:false, custom:false, source:"feminine supplies and personal hygiene items" },
  { id:"g18", name:"Infant supplies if applicable",          location:"", assignedTo:"", tier:2, category:"personal",      checked:false, custom:false, source:"infant formula and diapers" },
  // Tier 3 — Personal Needs
  { id:"g19", name:"Sleeping bags or warm blankets",         location:"", assignedTo:"", tier:3, category:"personal",      checked:false, custom:false, source:"sleeping bag or warm blanket for each person" },
  { id:"g20", name:"Change of clothing + sturdy shoes",      location:"", assignedTo:"", tier:3, category:"personal",      checked:false, custom:false, source:"complete change of clothing including sturdy shoes" },
  // Tier 3 — Priceless Items
  { id:"g21", name:"Irreplaceable photos or keepsakes",      location:"", assignedTo:"", tier:3, category:"priceless",     checked:false, custom:false, source:"additional items — irreplaceable items" },
]

var DEFAULT_DATA = {
  lastReviewed: null,
  contacts: { meetNearby:"", meetAway:"", evacuatePrimary:"", evacuateBackup:"", outOfStateContact:"" },
  members: [],
  grabItems: DEFAULT_GRAB_ITEMS,
  hazards: [],
  reviewDue: false,
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

function loadData() {
  try {
    var saved = JSON.parse(localStorage.getItem("af_safe_harbor") || "null")
    if (!saved || typeof saved !== "object") {
      return Object.assign({}, DEFAULT_DATA, { grabItems: DEFAULT_GRAB_ITEMS.map(function(i) { return Object.assign({},i) }) })
    }
    if (!Array.isArray(saved.grabItems) || saved.grabItems.length === 0) {
      saved.grabItems = DEFAULT_GRAB_ITEMS.map(function(i) { return Object.assign({},i) })
    }
    if (!saved.contacts || typeof saved.contacts !== "object") saved.contacts = Object.assign({}, DEFAULT_DATA.contacts)
    if (!Array.isArray(saved.members)) saved.members = []
    if (!Array.isArray(saved.hazards)) saved.hazards  = []
    return saved
  } catch(e) {
    return Object.assign({}, DEFAULT_DATA, { grabItems: DEFAULT_GRAB_ITEMS.map(function(i) { return Object.assign({},i) }) })
  }
}

function saveData(d) { try { localStorage.setItem("af_safe_harbor", JSON.stringify(d)) } catch(e) {} }

// ── Shared style helpers ──────────────────────────────────────────────────────
function card(extra) { return Object.assign({ background:G.card, border:"1px solid "+G.cardBorder, borderRadius:14, padding:"16px 18px", marginBottom:14 }, extra || {}) }
function inp(extra)  { return Object.assign({ background:"rgba(250,242,229,0.06)", border:"1px solid "+G.goldBorder, borderRadius:8, padding:"8px 12px", color:"#faf8f4", fontFamily:SANS, fontSize:13, outline:"none", width:"100%", boxSizing:"border-box" }, extra || {}) }
function goldBtn(extra)  { return Object.assign({ background:G.gold, color:G.navy, border:"none", borderRadius:9, padding:"9px 20px", fontFamily:SANS, fontSize:13, fontWeight:700, cursor:"pointer" }, extra || {}) }
function ghostBtn(extra) { return Object.assign({ background:"none", color:G.soft, border:"1px solid rgba(250,248,244,0.2)", borderRadius:9, padding:"9px 20px", fontFamily:SANS, fontSize:13, cursor:"pointer" }, extra || {}) }

// ── Print styles ──────────────────────────────────────────────────────────────
var PRINT_CSS = "@media print { .af-sh-no-print { display:none !important; } .af-sh-print { color:#000 !important; background:#fff !important; } }"

export default function SafeHarbor() {
  var [tab,        setTab]        = useState("ourPlan")
  var [data,       setData]       = useState(loadData)
  var [editCon,    setEditCon]    = useState(false)
  var [conDraft,   setConDraft]   = useState(null)
  var [memberForm, setMemberForm] = useState(null)   // null | { id, name, role, note }
  var [activeTier, setActiveTier] = useState(1)
  var [session,    setSession]    = useState(false)
  var [addingCat,  setAddingCat]  = useState(null)   // null | category string
  var [addName,    setAddName]    = useState("")
  var [addLoc,     setAddLoc]     = useState("")
  var [dismissedAt,setDismissedAt]= useState(function() { try { return parseInt(localStorage.getItem("af_sh_remind") || "0") || 0 } catch(e) { return 0 } })
  var [pendingUndo,setPendingUndo]= useState({})     // { itemId: { item, timeoutId } }

  var contactsRef = useRef(null)

  function update(changes) {
    var next = Object.assign({}, data, changes)
    setData(next)
    saveData(next)
  }

  // ── Compass nudge logic ───────────────────────────────────────────────────
  var nowMs     = Date.now()
  var showNudge = false
  if (tab === "ourPlan") {
    var remindAfter = dismissedAt + 30 * 86400000
    if (nowMs > remindAfter) {
      if (!data.lastReviewed) {
        showNudge = true
      } else {
        var lastMs = new Date(data.lastReviewed).getTime()
        if (!isNaN(lastMs) && (nowMs - lastMs) > 365 * 86400000) showNudge = true
      }
    }
  }

  function markReviewed() {
    var today = new Date().toISOString().slice(0,10)
    update({ lastReviewed: today })
    setDismissedAt(nowMs)
    if (contactsRef.current) {
      setTimeout(function() { contactsRef.current.scrollIntoView({ behavior:"smooth", block:"start" }) }, 120)
    }
  }

  function dismissNudge() {
    setDismissedAt(nowMs)
    try { localStorage.setItem("af_sh_remind", String(nowMs)) } catch(e) {}
  }

  // ── Contacts ──────────────────────────────────────────────────────────────
  var CON_FIELDS = [
    { key:"meetNearby",       label:"Meet nearby",              icon:"📍", placeholder:"e.g. front yard, neighbor's driveway" },
    { key:"meetAway",         label:"Meet away from home",      icon:"🏫", placeholder:"e.g. school parking lot, community center" },
    { key:"evacuatePrimary",  label:"Primary evacuation route", icon:"🚗", placeholder:"e.g. Take Main St north to Hwy 34" },
    { key:"evacuateBackup",   label:"Backup evacuation route",  icon:"🔄", placeholder:"e.g. Back roads via Oak Ave" },
    { key:"outOfStateContact",label:"Out-of-state contact",     icon:"📞", placeholder:"Name + phone number" },
  ]

  function openEditContacts() { setConDraft(Object.assign({}, data.contacts)); setEditCon(true) }
  function saveContacts()     { update({ contacts: Object.assign({}, conDraft) }); setEditCon(false); setConDraft(null) }
  function cancelContacts()   { setEditCon(false); setConDraft(null) }

  // ── Members ───────────────────────────────────────────────────────────────
  function startAddMember()  { setMemberForm({ id:uid(), name:"", role:"Adult", note:"" }) }
  function saveMember(draft) {
    if (!draft.name.trim()) { setMemberForm(null); return }
    var existing = (data.members || []).find(function(m) { return m.id === draft.id })
    var next = existing
      ? (data.members || []).map(function(m) { return m.id === draft.id ? Object.assign({},draft) : m })
      : (data.members || []).concat([Object.assign({},draft)])
    update({ members: next })
    setMemberForm(null)
  }
  function removeMember(id) { update({ members: (data.members || []).filter(function(m) { return m.id !== id }) }) }

  // ── Grab & Go ─────────────────────────────────────────────────────────────
  var visibleItems  = (data.grabItems || []).filter(function(i) { return i.tier <= activeTier })
  var checkedCount  = visibleItems.filter(function(i) { return i.checked }).length
  var pct           = visibleItems.length ? Math.round((checkedCount / visibleItems.length) * 100) : 0

  function toggleItem(id) {
    if (!session) return
    update({ grabItems: (data.grabItems || []).map(function(i) { return i.id === id ? Object.assign({},i,{checked:!i.checked}) : i }) })
  }

  function removeItem(item) {
    // Remove from persisted data immediately
    update({ grabItems: (data.grabItems || []).filter(function(i) { return i.id !== item.id }) })
    // Clear any existing undo timer for this id
    setPendingUndo(function(prev) {
      if (prev[item.id]) clearTimeout(prev[item.id].timeoutId)
      var tid = setTimeout(function() {
        setPendingUndo(function(p) { var n = Object.assign({}, p); delete n[item.id]; return n })
      }, 5000)
      var next = Object.assign({}, prev)
      next[item.id] = { item: item, timeoutId: tid }
      return next
    })
  }

  function undoRemove(itemId) {
    setPendingUndo(function(prev) {
      var entry = prev[itemId]
      if (!entry) return prev
      clearTimeout(entry.timeoutId)
      // Re-insert the item — use functional update so we have fresh data
      setData(function(d) {
        var next = Object.assign({}, d, { grabItems: (d.grabItems || []).concat([entry.item]) })
        saveData(next)
        return next
      })
      var n = Object.assign({}, prev)
      delete n[itemId]
      return n
    })
  }

  function openAddItem(cat) { setAddingCat(cat); setAddName(""); setAddLoc("") }
  function submitCustom() {
    if (!addName.trim()) { setAddingCat(null); return }
    var item = { id:uid(), name:addName.trim(), location:addLoc.trim(), assignedTo:"", tier:activeTier, category:addingCat, checked:false, custom:true, source:"" }
    update({ grabItems: (data.grabItems || []).concat([item]) })
    setAddingCat(null); setAddName(""); setAddLoc("")
  }

  function restoreDefaults() {
    if (!window.confirm("Restore items from ready.gov you've removed?")) return
    var currentNames = (data.grabItems || []).map(function(i) { return i.name })
    var toAdd = DEFAULT_GRAB_ITEMS.filter(function(d) {
      return currentNames.indexOf(d.name) === -1
    }).map(function(d) { return Object.assign({}, d) })
    if (toAdd.length) update({ grabItems: (data.grabItems || []).concat(toAdd) })
  }

  function startSession() { setSession(true) }
  function endSession()   {
    setSession(false)
    update({ grabItems: (data.grabItems || []).map(function(i) { return Object.assign({},i,{checked:false}) }) })
  }

  // ── Hazards ───────────────────────────────────────────────────────────────
  function toggleHazard(id) {
    var hz  = data.hazards || []
    var idx = hz.indexOf(id)
    var next = idx !== -1 ? hz.filter(function(h) { return h !== id }) : hz.concat([id])
    update({ hazards: next })
  }

  // ── Grab item count by tier for summary ──────────────────────────────────
  var t1Count = (data.grabItems || []).filter(function(i) { return i.tier === 1 }).length
  var t2Count = (data.grabItems || []).filter(function(i) { return i.tier <= 2 }).length
  var t3Count = (data.grabItems || []).length

  return (
    <div style={{ paddingBottom:"3rem", fontFamily:SANS }}>
      <style>{PRINT_CSS}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom:16, paddingBottom:14, borderBottom:"1px solid rgba(200,169,110,0.15)" }}>
        <div style={{ fontFamily:SERIF, fontSize:26, fontWeight:700, color:"#faf8f4", lineHeight:1 }}>⚓ Safe Harbor</div>
        <div style={{ fontSize:12, color:G.muted, marginTop:5, lineHeight:1.5 }}>Your family's quiet plan for when life gets loud.</div>
        {data.lastReviewed && <div style={{ fontSize:11, color:G.gold, marginTop:4, opacity:0.7 }}>Last reviewed {data.lastReviewed}</div>}
      </div>

      {/* ── Tab bar ── */}
      <div className="af-sh-no-print" style={{ display:"flex", gap:3, background:"rgba(27,58,92,0.5)", border:"1px solid rgba(200,169,110,0.18)", borderRadius:11, padding:3, marginBottom:18 }}>
        {[{id:"ourPlan",label:"Our Plan"},{id:"grabGo",label:"Grab & Go"},{id:"ourArea",label:"Our Area"}].map(function(t) {
          var on = tab === t.id
          return (
            <div key={t.id} onClick={function() { setTab(t.id) }}
              style={{ flex:1, padding:"8px 4px", borderRadius:9, textAlign:"center", cursor:"pointer",
                background:on?G.gold:"transparent", color:on?G.navy:G.muted,
                fontWeight:on?700:400, fontSize:13, transition:"all .15s", fontFamily:SANS }}>
              {t.label}
            </div>
          )
        })}
      </div>

      {/* ══════════════════════════════════════════════════
          TAB 1 — OUR PLAN
      ══════════════════════════════════════════════════ */}
      {tab === "ourPlan" && (
        <div>

          {/* Compass nudge */}
          {showNudge && (
            <div style={card({ background:G.goldPale, border:"1px solid "+G.goldBorder, marginBottom:16 })}>
              <div style={{ fontSize:10, letterSpacing:"0.16em", textTransform:"uppercase", color:G.gold, fontWeight:700, marginBottom:6 }}>🧭 From Compass</div>
              <div style={{ fontFamily:SERIF, fontSize:15, fontStyle:"italic", color:"#faf8f4", lineHeight:1.65, marginBottom:14 }}>
                "A little preparation brings a lot of peace of mind.{" "}
                {data.lastReviewed ? "It's been a year since your family reviewed Safe Harbor." : "Your family hasn't reviewed Safe Harbor yet."}{" "}
                Want to take five quiet minutes to make sure everything is still current?"
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={markReviewed} style={goldBtn({ flex:1 })}>Review my plan</button>
                <button onClick={dismissNudge} style={ghostBtn({ flex:1 })}>Remind me later</button>
              </div>
            </div>
          )}

          {/* Summary row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9, marginBottom:16 }}>
            {[
              { n:String(t3Count), l:"Grab items" },
              { n:String((data.hazards||[]).length), l:"Local plans" },
              { n:data.lastReviewed ? data.lastReviewed.slice(5).replace("-","/") : "Never", l:"Reviewed" },
            ].map(function(s,i) {
              return (
                <div key={i} style={card({ padding:"12px 10px", marginBottom:0, textAlign:"center" })}>
                  <div style={{ fontFamily:SERIF, fontSize:i===2?14:20, color:G.gold, lineHeight:1, marginBottom:4 }}>{s.n}</div>
                  <div style={{ fontSize:10, color:G.muted, lineHeight:1.3 }}>{s.l}</div>
                  {i === 2 && <div onClick={markReviewed} style={{ fontSize:9, color:G.sea, cursor:"pointer", marginTop:5 }}>Mark reviewed →</div>}
                </div>
              )
            })}
          </div>

          {/* Contacts card */}
          <div ref={contactsRef} style={card()}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:G.gold, fontWeight:700, marginBottom:2 }}>Meeting Places & Contacts</div>
                <div style={{ fontSize:11, color:G.muted }}>Where to find each other and who to call</div>
              </div>
              {!editCon && <button onClick={openEditContacts} style={ghostBtn({ padding:"5px 14px", fontSize:12 })}>Edit</button>}
            </div>

            {editCon && conDraft ? (
              <div>
                {CON_FIELDS.map(function(f) {
                  return (
                    <div key={f.key} style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, color:G.muted, marginBottom:4 }}>{f.icon} {f.label}</div>
                      <input
                        value={conDraft[f.key] || ""}
                        onChange={function(e) { var v=e.target.value; setConDraft(function(p) { var n=Object.assign({},p); n[f.key]=v; return n }) }}
                        placeholder={f.placeholder}
                        style={inp()}
                      />
                    </div>
                  )
                })}
                <div style={{ display:"flex", gap:8, marginTop:6 }}>
                  <button onClick={saveContacts} style={goldBtn({ flex:1 })}>Save</button>
                  <button onClick={cancelContacts} style={ghostBtn({ flex:1 })}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                {CON_FIELDS.map(function(f) {
                  var val = data.contacts && data.contacts[f.key]
                  return (
                    <div key={f.key} style={{ display:"flex", gap:10, padding:"9px 0", borderBottom:"0.5px solid rgba(250,242,229,0.07)" }}>
                      <span style={{ fontSize:15, flexShrink:0, opacity:0.55 }}>{f.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, color:G.muted, marginBottom:2 }}>{f.label}</div>
                        <div style={{ fontSize:13, color:val?"#faf8f4":G.muted, fontStyle:val?"normal":"italic" }}>{val || "Not set — tap Edit to add"}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Members card */}
          <div style={card()}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:G.gold, fontWeight:700, marginBottom:2 }}>Household Members</div>
                <div style={{ fontSize:11, color:G.muted }}>{(data.members||[]).length} {(data.members||[]).length===1?"person":"people"} in your plan</div>
              </div>
              <button onClick={startAddMember} style={goldBtn({ padding:"6px 14px", fontSize:12 })}>+ Add</button>
            </div>

            {/* Add/edit form */}
            {memberForm && (
              <div style={{ background:"rgba(200,169,110,0.08)", border:"1px solid "+G.goldBorder, borderRadius:10, padding:"13px 14px", marginBottom:12 }}>
                <input
                  value={memberForm.name}
                  onChange={function(e) { var v=e.target.value; setMemberForm(function(p) { return Object.assign({},p,{name:v}) }) }}
                  placeholder="Name"
                  style={inp({ marginBottom:8 })}
                  autoFocus
                />
                <div style={{ display:"flex", gap:7, marginBottom:8 }}>
                  {["Adult","Child","Pet"].map(function(role) {
                    var on = memberForm.role === role
                    return (
                      <button key={role}
                        onClick={function() { setMemberForm(function(p) { return Object.assign({},p,{role:role}) }) }}
                        style={{ flex:1, background:on?G.gold:"transparent", color:on?G.navy:G.muted,
                          border:"1px solid "+(on?G.gold:G.goldBorder), borderRadius:8, padding:"6px",
                          fontSize:12, cursor:"pointer", fontFamily:SANS, fontWeight:on?700:400 }}>
                        {role}
                      </button>
                    )
                  })}
                </div>
                <input
                  value={memberForm.note}
                  onChange={function(e) { var v=e.target.value; setMemberForm(function(p) { return Object.assign({},p,{note:v}) }) }}
                  placeholder="Note — medical needs, dietary restrictions (optional)"
                  style={inp({ marginBottom:8 })}
                />
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={function() { saveMember(memberForm) }} style={goldBtn({ flex:1 })}>Save</button>
                  <button onClick={function() { setMemberForm(null) }} style={ghostBtn({ flex:1 })}>Cancel</button>
                </div>
              </div>
            )}

            {(data.members||[]).length === 0 && !memberForm && (
              <div style={{ textAlign:"center", padding:"18px 0", color:G.muted, fontSize:13, fontStyle:"italic", fontFamily:SERIF }}>
                Add household members so everyone has a role in the plan.
              </div>
            )}

            {(data.members||[]).map(function(m) {
              return (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:"0.5px solid rgba(250,242,229,0.07)" }}>
                  <div style={{ width:32, height:32, borderRadius:"50%",
                    background:m.role==="Child"?G.seaPale:m.role==="Pet"?G.goldPale:"rgba(100,140,180,0.2)",
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>
                    {m.role==="Child"?"🧒":m.role==="Pet"?"🐾":"👤"}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#faf8f4" }}>{m.name}</div>
                    <div style={{ fontSize:11, color:G.sea }}>{m.role}</div>
                    {m.note && <div style={{ fontSize:11, color:G.muted, marginTop:2 }}>{m.note}</div>}
                  </div>
                  <button onClick={function() { removeMember(m.id) }} style={{ background:"none", border:"none", color:"rgba(208,128,96,0.45)", cursor:"pointer", fontSize:18, padding:"0 4px", flexShrink:0 }}>×</button>
                </div>
              )
            })}
          </div>

          {/* Print */}
          <button onClick={function() { window.print() }} style={ghostBtn({ width:"100%", textAlign:"center" })} className="af-sh-no-print">
            🖨 Print this plan
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 2 — GRAB & GO
      ══════════════════════════════════════════════════ */}
      {tab === "grabGo" && (
        <div>
          {/* Tier selector */}
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            {TIER_META.map(function(t) {
              var on = activeTier === t.id
              return (
                <button key={t.id} onClick={function() { setActiveTier(t.id) }}
                  style={{ flex:1, background:on?t.color:"transparent",
                    color:on?"#fff":G.muted, border:"1.5px solid "+(on?t.color:"rgba(250,248,244,0.15)"),
                    borderRadius:10, padding:"10px 6px", cursor:"pointer", fontFamily:SANS, transition:"all .15s" }}>
                  <div style={{ fontSize:10, fontWeight:700, marginBottom:2 }}>{t.sub}</div>
                  <div style={{ fontSize:12, fontWeight:on?700:400 }}>{t.label}</div>
                </button>
              )
            })}
          </div>

          {/* Cumulative note */}
          {TIER_NOTE[activeTier] && (
            <div style={{ fontSize:12, color:G.sea, fontStyle:"italic", marginBottom:12, padding:"0 2px" }}>{TIER_NOTE[activeTier]}</div>
          )}

          {/* Session bar */}
          {!session ? (
            <button onClick={startSession} style={goldBtn({ width:"100%", padding:"13px", fontSize:14, textAlign:"center", display:"block", marginBottom:16 })}>
              ▶ Start Grab & Go
            </button>
          ) : (
            <div style={{ marginBottom:16 }}>
              <div style={{ background:G.seaPale, border:"1px solid "+G.seaBorder, borderRadius:10, padding:"11px 14px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                  <div style={{ fontSize:13, color:G.sea, fontWeight:700 }}>{checkedCount} of {visibleItems.length} complete</div>
                  <div style={{ fontSize:11, color:G.muted }}>{pct}%</div>
                </div>
                <div style={{ height:5, background:"rgba(250,248,244,0.1)", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:pct+"%", background:G.sea, transition:"width .3s", borderRadius:3 }} />
                </div>
              </div>
              <button onClick={endSession} style={ghostBtn({ width:"100%", textAlign:"center" })}>✓ Complete and reset list</button>
            </div>
          )}

          {/* Items by category */}
          {CAT_ORDER.map(function(cat) {
            var catItems = (data.grabItems||[]).filter(function(i) { return i.category===cat && i.tier<=activeTier })
            var undoInCat = Object.keys(pendingUndo).filter(function(id) {
              var e = pendingUndo[id]
              return e && e.item.category === cat && e.item.tier <= activeTier
            })
            if (catItems.length === 0 && addingCat !== cat && undoInCat.length === 0) return null
            return (
              <div key={cat} style={card({ marginBottom:12 })}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                  <span style={{ fontSize:18 }}>{CAT_EMOJIS[cat]}</span>
                  <div style={{ fontSize:11, fontWeight:700, color:G.gold, letterSpacing:"0.08em", textTransform:"uppercase" }}>{CAT_LABELS[cat]}</div>
                </div>

                {catItems.map(function(item) {
                  return (
                    <div key={item.id}
                      onClick={function() { toggleItem(item.id) }}
                      style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 0",
                        borderBottom:"0.5px solid rgba(250,242,229,0.06)",
                        cursor:session?"pointer":"default",
                        opacity:!session&&item.tier>activeTier?0.4:1 }}>
                      {/* Checkbox */}
                      <div style={{ width:18, height:18, borderRadius:5, flexShrink:0, marginTop:2, transition:"all .15s",
                        border:"1.5px solid "+(item.checked?G.sea:"rgba(250,248,244,0.25)"),
                        background:item.checked?G.sea:"transparent",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {item.checked && <span style={{ color:"#fff", fontSize:10 }}>✓</span>}
                      </div>
                      {/* Content */}
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:item.checked?G.muted:"#faf8f4", textDecoration:item.checked?"line-through":"none" }}>{item.name}</div>
                        {item.location && <div style={{ fontSize:11, color:G.muted, marginTop:2 }}>📍 {item.location}</div>}
                        {item.source  && <div style={{ fontSize:10, color:G.sea, fontStyle:"italic", marginTop:2 }}>{item.source}</div>}
                        {item.assignedTo && (
                          <div style={{ display:"inline-block", background:G.seaPale, border:"0.5px solid "+G.seaBorder, borderRadius:20, padding:"1px 8px", fontSize:10, color:G.sea, marginTop:3 }}>{item.assignedTo}</div>
                        )}
                      </div>
                      {/* Tier badge */}
                      <div style={{ fontSize:9, color:TIER_META[item.tier-1].color, background:TIER_META[item.tier-1].pale, border:"0.5px solid "+TIER_META[item.tier-1].border, borderRadius:20, padding:"2px 7px", flexShrink:0, marginTop:2, whiteSpace:"nowrap" }}>
                        {TIER_META[item.tier-1].sub}
                      </div>
                      {/* Remove button — all items */}
                      <button onClick={function(e) { e.stopPropagation(); removeItem(item) }}
                        style={{ background:"none", border:"none", color:"rgba(250,248,244,0.18)", cursor:"pointer", fontSize:15, flexShrink:0, padding:"0 2px", lineHeight:1, marginTop:2, transition:"color .15s" }}
                        onMouseEnter={function(e) { e.currentTarget.style.color="rgba(208,128,96,0.7)" }}
                        onMouseLeave={function(e) { e.currentTarget.style.color="rgba(250,248,244,0.18)" }}>
                        ✕
                      </button>
                    </div>
                  )
                })}

                {/* Undo rows for recently removed items in this category */}
                {undoInCat.map(function(id) {
                  var entry = pendingUndo[id]
                  if (!entry) return null
                  return (
                    <div key={"undo-"+id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"0.5px solid rgba(250,242,229,0.04)", opacity:0.7 }}>
                      <div style={{ width:18, height:18, borderRadius:5, flexShrink:0, border:"1.5px dashed rgba(250,248,244,0.15)", background:"transparent" }} />
                      <div style={{ flex:1, fontSize:12, color:G.muted, textDecoration:"line-through", fontStyle:"italic" }}>{entry.item.name}</div>
                      <div style={{ fontSize:12, color:G.sea, whiteSpace:"nowrap" }}>
                        Removed ·{" "}
                        <span onClick={function() { undoRemove(id) }} style={{ fontWeight:700, cursor:"pointer", textDecoration:"underline" }}>Undo</span>
                      </div>
                    </div>
                  )
                })}

                {/* Custom item form */}
                {addingCat === cat ? (
                  <div style={{ marginTop:10, background:"rgba(200,169,110,0.06)", border:"1px dashed "+G.goldBorder, borderRadius:9, padding:"11px 12px" }}>
                    <input value={addName} onChange={function(e){setAddName(e.target.value)}} placeholder="Item name" style={inp({ marginBottom:7 })} autoFocus />
                    <input value={addLoc}  onChange={function(e){setAddLoc(e.target.value)}}  placeholder="Where is it? (optional)" style={inp({ marginBottom:10 })} />
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={submitCustom}            style={goldBtn({ flex:1, padding:"7px" })}>Add</button>
                      <button onClick={function(){setAddingCat(null)}} style={ghostBtn({ flex:1, padding:"7px" })}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={function() { openAddItem(cat) }}
                    style={{ marginTop:10, background:"none", border:"1px dashed rgba(200,169,110,0.22)", borderRadius:8, padding:"6px 12px", color:G.gold, fontSize:12, cursor:"pointer", width:"100%", fontFamily:SANS }}>
                    + Add your own item
                  </button>
                )}
              </div>
            )
          })}

          {/* Restore defaults + ready.gov footer */}
          <div style={{ textAlign:"center", padding:"14px 0 2px", borderTop:"0.5px solid rgba(250,242,229,0.06)", marginTop:6 }}>
            <div
              onClick={restoreDefaults}
              style={{ fontSize:12, color:G.muted, cursor:"pointer", marginBottom:10, display:"inline-block" }}
              onMouseEnter={function(e) { e.currentTarget.style.color = G.sea }}
              onMouseLeave={function(e) { e.currentTarget.style.color = G.muted }}>
              ↩ Restore default items
            </div>
            <div style={{ fontSize:10, color:"rgba(250,248,244,0.2)" }}>
              Default items sourced from ready.gov ·{" "}
              <a href="https://www.ready.gov/kit" target="_blank" rel="noopener noreferrer" style={{ color:G.sea }}>ready.gov/kit</a>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 3 — OUR AREA
      ══════════════════════════════════════════════════ */}
      {tab === "ourArea" && (
        <div>
          <div style={{ fontSize:13, color:G.muted, marginBottom:16, lineHeight:1.55 }}>
            Select the hazards most relevant to your area. Each one has a calm Before / During / After guide.
          </div>

          {/* Hazard toggle grid */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:20 }}>
            {HAZARD_META.map(function(h) {
              var on = (data.hazards||[]).indexOf(h.id) !== -1
              return (
                <div key={h.id} onClick={function() { toggleHazard(h.id) }}
                  style={{ background:on?h.pale:G.card, border:"1.5px solid "+(on?h.border:G.cardBorder),
                    borderRadius:12, padding:"13px 14px", cursor:"pointer", transition:"all .15s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:20 }}>{h.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:on?"#fff":G.soft }}>{h.label}</div>
                      <div style={{ fontSize:10, color:on?h.color:G.muted, marginTop:2, fontWeight:on?700:400 }}>{h.urgent}</div>
                    </div>
                    <div style={{ width:18, height:18, borderRadius:"50%",
                      border:"1.5px solid "+(on?h.color:"rgba(250,248,244,0.2)"),
                      background:on?h.color:"transparent",
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#fff", flexShrink:0 }}>
                      {on?"✓":""}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Empty state */}
          {(data.hazards||[]).length === 0 && (
            <div style={{ textAlign:"center", padding:"28px 20px", background:G.card, border:"1px solid "+G.cardBorder, borderRadius:14 }}>
              <div style={{ fontSize:"1.5rem", marginBottom:8 }}>🗺️</div>
              <div style={{ fontFamily:SERIF, fontSize:18, color:"#faf8f4", marginBottom:6 }}>Select your area's hazards above</div>
              <div style={{ fontSize:12, color:G.muted, lineHeight:1.6 }}>Tap any hazard to add a Before / During / After guide to your plan.</div>
            </div>
          )}

          {/* Plan cards for selected hazards — in HAZARD_META order */}
          {HAZARD_META.filter(function(h) { return (data.hazards||[]).indexOf(h.id) !== -1 }).map(function(h) {
            var content = HAZARD_CONTENT[h.id] || {}
            return (
              <div key={h.id} style={card({ border:"1px solid "+h.border, marginBottom:16 })}>
                {/* Hazard header */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:content.urgentNote?8:14 }}>
                  <span style={{ fontSize:24 }}>{h.emoji}</span>
                  <div>
                    <div style={{ fontFamily:SERIF, fontSize:19, fontWeight:700, color:"#faf8f4" }}>{h.label}</div>
                    <div style={{ fontSize:11, color:h.color, fontWeight:700, marginTop:1 }}>{h.urgent}</div>
                  </div>
                </div>

                {/* Urgent note */}
                {content.urgentNote && (
                  <div style={{ background:"rgba(208,128,96,0.1)", border:"1px solid rgba(208,128,96,0.25)", borderRadius:9, padding:"9px 12px", marginBottom:14, fontSize:12, color:"#f0a080", fontStyle:"italic", lineHeight:1.5 }}>
                    {content.urgentNote}
                  </div>
                )}

                {/* Before / During / After */}
                {[
                  { phase:"Before", icon:"🕐", items:content.before||[] },
                  { phase:"During", icon:"⚡", items:content.during||[] },
                  { phase:"After",  icon:"🌅", items:content.after||[]  },
                ].map(function(ph) {
                  return (
                    <div key={ph.phase} style={{ marginBottom:13 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:G.gold, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:7 }}>
                        {ph.icon} {ph.phase}
                      </div>
                      {ph.items.map(function(item, idx) {
                        return (
                          <div key={idx} style={{ display:"flex", gap:8, padding:"3px 0" }}>
                            <div style={{ width:4, height:4, borderRadius:"50%", background:G.sea, flexShrink:0, marginTop:7 }} />
                            <div style={{ fontSize:13, color:G.soft, lineHeight:1.45 }}>{item}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                {/* Source attribution */}
                <div style={{ fontSize:10, color:G.muted, borderTop:"0.5px solid rgba(250,242,229,0.07)", paddingTop:8, marginTop:4 }}>
                  Source:{" "}
                  <a href={"https://www." + content.source} target="_blank" rel="noopener noreferrer" style={{ color:G.sea }}>{content.source}</a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
