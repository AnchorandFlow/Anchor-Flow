// src/shell/SafeHarbor.jsx — Family emergency plan. "Prepared, not worried."
import { useState, useEffect, useRef } from "react"
import { DEFAULT_GRAB_ITEMS, DEFAULT_DATA, migrateToV2 } from "./safe-harbor-migrate.js"

// SAFE_HARBOR_V2 — opt-in (default OFF). Matches the Shopping V2 opt-in pattern.
// Read once at module scope; toggling requires a full page reload to take effect.
// Do NOT add a location.reload() call here — document that constraint in console instructions.
// To enable:  localStorage.setItem("af_safe_harbor_v2","true");  location.reload();
// To disable: localStorage.removeItem("af_safe_harbor_v2");      location.reload();
var SAFE_HARBOR_V2 = localStorage.getItem("af_safe_harbor_v2") === "true"

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
  card:       "#f7f1e3",
  cardBorder: "rgba(26,46,61,0.1)",
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
// DEFAULT_GRAB_ITEMS, DEFAULT_DATA, migrateToV2 are imported from safe-harbor-migrate.js
// so unit tests can import them without pulling in React or JSX.

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

function loadData() {
  try {
    var saved = JSON.parse(localStorage.getItem("af_safe_harbor") || "null")
    if (!saved || typeof saved !== "object") {
      var fresh = Object.assign({}, DEFAULT_DATA, { grabItems: DEFAULT_GRAB_ITEMS.map(function(i) { return Object.assign({},i) }) })
      if (SAFE_HARBOR_V2) fresh = migrateToV2(fresh)
      return fresh
    }
    if (!Array.isArray(saved.grabItems) || saved.grabItems.length === 0) {
      saved.grabItems = DEFAULT_GRAB_ITEMS.map(function(i) { return Object.assign({},i) })
    } else {
      // Hard-delete all tombstones on load — silently finalizes any unexpired undo windows.
      // removedDefaultIds already contains the stable identity, so defaults stay removed.
      saved.grabItems = saved.grabItems.filter(function(i) { return !i.removed })
    }
    if (!saved.contacts || typeof saved.contacts !== "object") saved.contacts = Object.assign({}, DEFAULT_DATA.contacts)
    if (!Array.isArray(saved.members)) saved.members = []
    if (!Array.isArray(saved.hazards)) saved.hazards  = []
    if (!Array.isArray(saved.removedDefaultIds)) saved.removedDefaultIds = []
    // V2: one-time migration when flag is on and blob is pre-V2.
    // migrateToV2 absorbs af_sh_remind into review.remindDismissedAt and adds new top-level fields.
    if (SAFE_HARBOR_V2 && (!saved.version || saved.version < 2)) {
      saved = migrateToV2(saved)
    }
    // Persist cleaned (and possibly migrated) state.
    try { localStorage.setItem("af_safe_harbor", JSON.stringify(saved)) } catch(_e) {}
    return saved
  } catch(e) {
    return Object.assign({}, DEFAULT_DATA, { grabItems: DEFAULT_GRAB_ITEMS.map(function(i) { return Object.assign({},i) }) })
  }
}

function saveData(d) {
  try { localStorage.setItem("af_safe_harbor", JSON.stringify(d)) } catch(e) {}
  // Mark safe_harbor dirty so the sync push pipeline picks up the change.
  // Safe to do unconditionally here — saveData is only called from update(), which is
  // only triggered by user interaction, never during hydration.
  try {
    var dirty = JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]");
    if (dirty.indexOf("safe_harbor") === -1) {
      dirty.push("safe_harbor");
      localStorage.setItem("af_dirtyKeys", JSON.stringify(dirty));
    }
  } catch(_e) {}
  try { window.dispatchEvent(new Event("af-data-changed")); } catch(_e) {}
}

// ── Shared style helpers ──────────────────────────────────────────────────────
function card(extra) { return Object.assign({ background:G.card, border:"1px solid "+G.cardBorder, borderRadius:8, padding:"16px 18px", marginBottom:14 }, extra || {}) }
function inp(extra)  { return Object.assign({ background:"rgba(26,46,61,0.05)", border:"1px solid "+G.goldBorder, borderRadius:8, padding:"8px 12px", color:"#1a2e3d", fontFamily:SANS, fontSize:13, outline:"none", width:"100%", boxSizing:"border-box" }, extra || {}) }
function goldBtn(extra)  { return Object.assign({ background:G.gold, color:G.navy, border:"none", borderRadius:9, padding:"9px 20px", fontFamily:SANS, fontSize:13, fontWeight:700, cursor:"pointer" }, extra || {}) }
function ghostBtn(extra) { return Object.assign({ background:"none", color:"#4a6275", border:"1px solid rgba(250,248,244,0.2)", borderRadius:9, padding:"9px 20px", fontFamily:SANS, fontSize:13, cursor:"pointer" }, extra || {}) }

// ── Print styles ──────────────────────────────────────────────────────────────
var PRINT_CSS = "@media print { .af-sh-no-print { display:none !important; } .af-sh-print { color:#000 !important; background:#fff !important; } }"

export default function SafeHarbor() {
  var [tab,        setTab]        = useState("ourPlan")
  var [data,       setData]       = useState(loadData)
  var [editCon,    setEditCon]    = useState(false)
  var [conDraft,   setConDraft]   = useState(null)
  var [memberForm, setMemberForm] = useState(null)   // null | { id, name, role, note }
  var [activeTier, setActiveTier] = useState(1)
  var [session,        setSession]        = useState(false)
  // V2: null = no session active; {} = practice-run session overlay.
  // Session overlay is transient — endSession clears it without touching persistent item.checked.
  var [sessionChecked, setSessionChecked] = useState(null)
  var [addingCat,  setAddingCat]  = useState(null)   // null | category string
  var [addName,    setAddName]    = useState("")
  var [addLoc,     setAddLoc]     = useState("")
  var [dismissedAt,setDismissedAt]= useState(function() {
    // V2: remindDismissedAt lives in the blob (absorbed from af_sh_remind by migrateToV2).
    // loadData() runs first and saves the migrated blob, so the blob is current by now.
    if (SAFE_HARBOR_V2) {
      try {
        var v2blob = JSON.parse(localStorage.getItem("af_safe_harbor") || "null")
        if (v2blob && v2blob.review && typeof v2blob.review.remindDismissedAt === "number") {
          return v2blob.review.remindDismissedAt
        }
      } catch(_e) {}
      return 0
    }
    try { return parseInt(localStorage.getItem("af_sh_remind") || "0") || 0 } catch(e) { return 0 }
  })
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
    if (SAFE_HARBOR_V2) {
      // V2: write lastReviewed (V1 compat) + review.lastReviewedAt + review.remindDismissedAt.
      // af_sh_remind is no longer used — remindDismissedAt lives in the blob.
      update({
        lastReviewed: today,
        review: Object.assign({}, data.review || {}, { lastReviewedAt: today, remindDismissedAt: nowMs }),
      })
    } else {
      update({ lastReviewed: today })
    }
    setDismissedAt(nowMs)
    if (contactsRef.current) {
      setTimeout(function() { contactsRef.current.scrollIntoView({ behavior:"smooth", block:"start" }) }, 120)
    }
  }

  function dismissNudge() {
    setDismissedAt(nowMs)
    if (SAFE_HARBOR_V2) {
      // V2: persist dismiss timestamp in the blob instead of a separate key.
      update({ review: Object.assign({}, data.review || {}, { remindDismissedAt: nowMs }) })
    } else {
      try { localStorage.setItem("af_sh_remind", String(nowMs)) } catch(e) {}
    }
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
  // V2: during a practice session, checked state comes from the transient sessionChecked overlay.
  // Outside a session (V2), checked state is the persistent item.checked flag (always toggleable).
  // V1: checked state is always item.checked; toggleItem is gated behind the session flag.
  function getChecked(item) {
    if (SAFE_HARBOR_V2 && sessionChecked !== null) return sessionChecked[item.id] === true
    return item.checked
  }

  var visibleItems  = (data.grabItems || []).filter(function(i) { return !i.removed && i.tier <= activeTier })
  var checkedCount  = visibleItems.filter(function(i) { return getChecked(i) }).length
  var pct           = visibleItems.length ? Math.round((checkedCount / visibleItems.length) * 100) : 0

  function toggleItem(id) {
    if (SAFE_HARBOR_V2) {
      if (sessionChecked !== null) {
        // Practice-run session: toggle transient overlay only — never mutates persistent checked.
        setSessionChecked(function(prev) {
          var cur = prev[id] !== undefined ? prev[id] : false
          var next = Object.assign({}, prev)
          next[id] = !cur
          return next
        })
      } else {
        // V2 outside session: checked is a persistent flag, toggleable any time.
        var _ts2 = Date.now()
        update({ grabItems: (data.grabItems || []).map(function(i) { return i.id === id ? Object.assign({},i,{checked:!i.checked, checkedAt:_ts2}) : i }) })
      }
      return
    }
    // V1: check-off is gated behind session mode.
    if (!session) return
    var _ts1 = Date.now()
    update({ grabItems: (data.grabItems || []).map(function(i) { return i.id === id ? Object.assign({},i,{checked:!i.checked, checkedAt:_ts1}) : i }) })
  }

  function removeItem(item) {
    // Tombstone the item so undo can clear it while still restoring position.
    // removedDefaultIds is the durable record that keeps defaults out until an
    // explicit restoreDefaults() — the tombstone itself is ephemeral.
    var now = Date.now()
    var nextItems = (data.grabItems || []).map(function(i) {
      return i.id === item.id ? Object.assign({}, i, { removed: true, removedAt: now }) : i
    })
    var nextRemovedIds = (data.removedDefaultIds || []).slice()
    if (item.defaultId && nextRemovedIds.indexOf(item.defaultId) === -1) {
      nextRemovedIds.push(item.defaultId)
    }
    update({ grabItems: nextItems, removedDefaultIds: nextRemovedIds })
    // Replace any existing undo entry for this id.
    setPendingUndo(function(prev) {
      if (prev[item.id]) clearTimeout(prev[item.id].timeoutId)
      var tid = setTimeout(function() {
        // Undo window expired — hard-delete the tombstone from storage.
        setData(function(d) {
          var next = Object.assign({}, d, {
            grabItems: (d.grabItems || []).filter(function(i) { return i.id !== item.id })
          })
          saveData(next)
          return next
        })
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
      // The item is still in grabItems as a tombstone — just clear the flag.
      // This preserves its original tier and array index automatically.
      setData(function(d) {
        var nextItems = (d.grabItems || []).map(function(i) {
          if (i.id !== itemId) return i
          var cleaned = Object.assign({}, i)
          delete cleaned.removed
          delete cleaned.removedAt
          return cleaned
        })
        var nextRemovedIds = (d.removedDefaultIds || []).filter(function(rid) {
          return rid !== entry.item.defaultId
        })
        var next = Object.assign({}, d, { grabItems: nextItems, removedDefaultIds: nextRemovedIds })
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
    if (!window.confirm("Restore removed ready.gov items? Your custom items won't be affected.")) return
    // Dedup by defaultId so a custom item that shares a name doesn't block restore.
    var currentDefaultIds = (data.grabItems || [])
      .filter(function(i) { return !i.removed && i.defaultId })
      .map(function(i) { return i.defaultId })
    var toAdd = DEFAULT_GRAB_ITEMS.filter(function(d) {
      return currentDefaultIds.indexOf(d.defaultId) === -1
    }).map(function(d) { return Object.assign({}, d) })
    var restoredIds = toAdd.map(function(d) { return d.defaultId })
    var remainingRemovedIds = (data.removedDefaultIds || []).filter(function(id) {
      return restoredIds.indexOf(id) === -1
    })
    // Always update removedDefaultIds even if no items were added (cleans up stale ids).
    update({ grabItems: (data.grabItems || []).concat(toAdd), removedDefaultIds: remainingRemovedIds })
  }

  function startSession() {
    if (SAFE_HARBOR_V2) {
      // V2: start a practice-run overlay; persistent checked flags are never touched.
      setSessionChecked({})
      return
    }
    setSession(true)
  }
  function endSession() {
    if (SAFE_HARBOR_V2) {
      // V2: discard the transient overlay — persistent checked flags remain intact.
      setSessionChecked(null)
      return
    }
    // V1: end session and wipe all persistent checked flags.
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
  var t1Count = (data.grabItems || []).filter(function(i) { return !i.removed && i.tier === 1 }).length
  var t2Count = (data.grabItems || []).filter(function(i) { return !i.removed && i.tier <= 2 }).length
  var t3Count = (data.grabItems || []).filter(function(i) { return !i.removed }).length

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
                background:on?G.gold:"transparent", color:on?G.navy:"rgba(250,248,244,0.35)",
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
              <div style={{ fontFamily:SERIF, fontSize:15, fontStyle:"italic", color:"#1a2e3d", lineHeight:1.65, marginBottom:14 }}>
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
                  <div style={{ fontSize:10, color:"#4a6275", lineHeight:1.3 }}>{s.l}</div>
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
                <div style={{ fontSize:11, color:"#4a6275" }}>Where to find each other and who to call</div>
              </div>
              {!editCon && <button onClick={openEditContacts} style={ghostBtn({ padding:"5px 14px", fontSize:12 })}>Edit</button>}
            </div>

            {editCon && conDraft ? (
              <div>
                {CON_FIELDS.map(function(f) {
                  return (
                    <div key={f.key} style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, color:"#4a6275", marginBottom:4 }}>{f.icon} {f.label}</div>
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
                    <div key={f.key} style={{ display:"flex", gap:10, padding:"9px 0", borderBottom:"0.5px solid rgba(26,46,61,0.08)" }}>
                      <span style={{ fontSize:15, flexShrink:0, opacity:0.55 }}>{f.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, color:"#4a6275", marginBottom:2 }}>{f.label}</div>
                        <div style={{ fontSize:13, color:val?"#1a2e3d":"#4a6275", fontStyle:val?"normal":"italic" }}>{val || "Not set — tap Edit to add"}</div>
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
                <div style={{ fontSize:11, color:"#4a6275" }}>{(data.members||[]).length} {(data.members||[]).length===1?"person":"people"} in your plan</div>
              </div>
              <button onClick={startAddMember} style={goldBtn({ padding:"6px 14px", fontSize:12 })}>+ Add</button>
            </div>

            {/* Add/edit form */}
            {memberForm && (
              <div style={{ background:"#f7f1e3", border:"1px solid "+G.goldBorder, borderRadius:8, padding:"13px 14px", marginBottom:12 }}>
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
                        style={{ flex:1, background:on?G.gold:"transparent", color:on?G.navy:"#4a6275",
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
              <div style={{ textAlign:"center", padding:"18px 0", color:"#4a6275", fontSize:13, fontStyle:"italic", fontFamily:SERIF }}>
                Add household members so everyone has a role in the plan.
              </div>
            )}

            {(data.members||[]).map(function(m) {
              return (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:"0.5px solid rgba(26,46,61,0.08)" }}>
                  <div style={{ width:32, height:32, borderRadius:"50%",
                    background:m.role==="Child"?G.seaPale:m.role==="Pet"?G.goldPale:"rgba(100,140,180,0.2)",
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>
                    {m.role==="Child"?"🧒":m.role==="Pet"?"🐾":"👤"}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#1a2e3d" }}>{m.name}</div>
                    <div style={{ fontSize:11, color:G.sea }}>{m.role}</div>
                    {m.note && <div style={{ fontSize:11, color:"#4a6275", marginTop:2 }}>{m.note}</div>}
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

          {/* V2: Emergency Plan shell — shows when SAFE_HARBOR_V2 is enabled.
              sixPs (SH-4) and familyPlan (SH-5) are null shells until those phases ship.
              review.cadence is editable in a future pass. */}
          {SAFE_HARBOR_V2 && (
            <div style={Object.assign(card({ marginTop:16 }), { border:"1px solid rgba(200,169,110,0.15)" })}>
              <div style={{ fontSize:10, letterSpacing:"0.16em", textTransform:"uppercase", color:G.gold, fontWeight:700, marginBottom:12 }}>Emergency Plan</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

                {/* Annual review cadence (live) */}
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>🔄</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:"#1a2e3d", fontWeight:600 }}>Annual Review</div>
                    <div style={{ fontSize:11, color:"#4a6275" }}>
                      Cadence: {(data.review && data.review.cadence) || "yearly"}
                      {data.review && data.review.lastReviewedAt && (
                        <span> · last reviewed {data.review.lastReviewedAt}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Six P's — SH-4 shell */}
                <div style={{ display:"flex", alignItems:"center", gap:10, opacity:0.45 }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>🏠</span>
                  <div>
                    <div style={{ fontSize:13, color:"#1a2e3d", fontWeight:600 }}>Six P's of Evacuation</div>
                    <div style={{ fontSize:11, color:"#4a6275" }}>Category notes layer — coming in SH-4</div>
                  </div>
                </div>

                {/* Family Plan — SH-5 shell */}
                <div style={{ display:"flex", alignItems:"center", gap:10, opacity:0.45 }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>👨‍👩‍👧</span>
                  <div>
                    <div style={{ fontSize:13, color:"#1a2e3d", fontWeight:600 }}>Family Emergency Plan</div>
                    <div style={{ fontSize:11, color:"#4a6275" }}>Full preparedness plan — coming in SH-5</div>
                  </div>
                </div>

              </div>
            </div>
          )}
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
                    color:on?"#fff":"rgba(250,248,244,0.5)", border:"1.5px solid "+(on?t.color:"rgba(250,248,244,0.15)"),
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

          {/* Session bar
              V1: gated on session boolean; end clears all checked flags.
              V2: gated on sessionChecked null-check; end discards overlay only.
                  Outside a V2 session, items are always tappable (persistent check). */}
          {(SAFE_HARBOR_V2 ? sessionChecked === null : !session) ? (
            <button onClick={startSession} style={goldBtn({ width:"100%", padding:"13px", fontSize:14, textAlign:"center", display:"block", marginBottom:16 })}>
              ▶ Start Grab & Go
            </button>
          ) : (
            <div style={{ marginBottom:16 }}>
              <div style={{ background:G.seaPale, border:"1px solid "+G.seaBorder, borderRadius:10, padding:"11px 14px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                  <div style={{ fontSize:13, color:G.sea, fontWeight:700 }}>{checkedCount} of {visibleItems.length} complete</div>
                  <div style={{ fontSize:11, color:"#4a6275" }}>{pct}%</div>
                </div>
                <div style={{ height:5, background:"rgba(250,248,244,0.1)", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:pct+"%", background:G.sea, transition:"width .3s", borderRadius:3 }} />
                </div>
              </div>
              <button onClick={endSession} style={ghostBtn({ width:"100%", textAlign:"center" })}>
                {SAFE_HARBOR_V2 ? "✓ End practice session" : "✓ Complete and reset list"}
              </button>
            </div>
          )}

          {/* Items by category */}
          {CAT_ORDER.map(function(cat) {
            var catItems = (data.grabItems||[]).filter(function(i) { return !i.removed && i.category===cat && i.tier<=activeTier })
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
                        borderBottom:"0.5px solid rgba(26,46,61,0.08)",
                        cursor:(SAFE_HARBOR_V2||session)?"pointer":"default" }}>
                      {/* Tier relevance already carries via the always-visible tier badge
                          below, not row opacity (never dim whole rows for status). */}
                      {/* Checkbox — V2: reflects sessionChecked overlay during sessions,
                          persistent item.checked otherwise. V1: always item.checked. */}
                      <div style={{ width:18, height:18, borderRadius:5, flexShrink:0, marginTop:2, transition:"all .15s",
                        border:"1.5px solid "+(getChecked(item)?G.sea:"rgba(250,248,244,0.25)"),
                        background:getChecked(item)?G.sea:"transparent",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {getChecked(item) && <span style={{ color:"#fff", fontSize:10 }}>✓</span>}
                      </div>
                      {/* Content */}
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:getChecked(item)?"#4a6275":"#1a2e3d", textDecoration:getChecked(item)?"line-through":"none" }}>{item.name}</div>
                        {item.location && <div style={{ fontSize:11, color:"#4a6275", marginTop:2 }}>📍 {item.location}</div>}
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
                        aria-label={"Remove " + item.name + " from " + TIER_META[item.tier-1].sub + " list"}
                        style={{ background:"none", border:"none", color:"rgba(250,248,244,0.18)", cursor:"pointer", fontSize:15, flexShrink:0, padding:"0 6px", lineHeight:1, marginTop:0, transition:"color .15s", minWidth:44, minHeight:44, display:"flex", alignItems:"center", justifyContent:"center" }}
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
                    <div key={"undo-"+id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"0.5px solid rgba(26,46,61,0.06)" }}>
                      <div style={{ width:18, height:18, borderRadius:5, flexShrink:0, border:"1.5px dashed rgba(250,248,244,0.15)", background:"transparent" }} />
                      <div style={{ flex:1, fontSize:12, color:"#4a6275", textDecoration:"line-through", fontStyle:"italic" }}>{entry.item.name}</div>
                      <div style={{ fontSize:12, color:G.sea, whiteSpace:"nowrap" }}>
                        Removed ·{" "}
                        <button onClick={function() { undoRemove(id) }} aria-label={"Undo removal of " + entry.item.name} style={{ background:"none", border:"none", color:G.sea, fontFamily:SANS, fontSize:12, fontWeight:700, cursor:"pointer", textDecoration:"underline", padding:"0 0 0 2px", minHeight:44, verticalAlign:"middle" }}>Undo</button>
                      </div>
                    </div>
                  )
                })}

                {/* Custom item form */}
                {addingCat === cat ? (
                  <div style={{ marginTop:10, background:"#f7f1e3", border:"1px dashed "+G.goldBorder, borderRadius:8, padding:"11px 12px" }}>
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
          <div style={{ textAlign:"center", padding:"14px 0 2px", borderTop:"0.5px solid rgba(26,46,61,0.08)", marginTop:6 }}>
            <div
              onClick={restoreDefaults}
              style={{ fontSize:12, color:"#4a6275", cursor:"pointer", marginBottom:10, display:"inline-block" }}
              onMouseEnter={function(e) { e.currentTarget.style.color = G.sea }}
              onMouseLeave={function(e) { e.currentTarget.style.color = "#4a6275" }}>
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
          <div style={{ fontSize:13, color:"rgba(250,248,244,0.5)", marginBottom:16, lineHeight:1.55 }}>
            Select the hazards most relevant to your area. Each one has a calm Before / During / After guide.
          </div>

          {/* Hazard toggle grid */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:20 }}>
            {HAZARD_META.map(function(h) {
              var on = (data.hazards||[]).indexOf(h.id) !== -1
              return (
                <div key={h.id} onClick={function() { toggleHazard(h.id) }}
                  style={{ background:on?h.pale:G.card, border:"1.5px solid "+(on?h.border:G.cardBorder),
                    borderRadius:8, padding:"13px 14px", cursor:"pointer", transition:"all .15s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:20 }}>{h.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:on?"#fff":"#1a2e3d" }}>{h.label}</div>
                      <div style={{ fontSize:10, color:on?h.color:"#4a6275", marginTop:2, fontWeight:on?700:400 }}>{h.urgent}</div>
                    </div>
                    <div style={{ width:18, height:18, borderRadius:"50%",
                      border:"1.5px solid "+(on?h.color:"rgba(26,46,61,0.25)"),
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
            <div style={{ textAlign:"center", padding:"28px 20px", background:G.card, border:"1px solid "+G.cardBorder, borderRadius:8 }}>
              <div style={{ fontSize:"1.5rem", marginBottom:8 }}>🗺️</div>
              <div style={{ fontFamily:SERIF, fontSize:18, color:"#1a2e3d", marginBottom:6 }}>Select your area's hazards above</div>
              <div style={{ fontSize:12, color:"#4a6275", lineHeight:1.6 }}>Tap any hazard to add a Before / During / After guide to your plan.</div>
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
                    <div style={{ fontFamily:SERIF, fontSize:19, fontWeight:700, color:"#1a2e3d" }}>{h.label}</div>
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
                            <div style={{ fontSize:13, color:"#4a6275", lineHeight:1.45 }}>{item}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                {/* Source attribution */}
                <div style={{ fontSize:10, color:"#4a6275", borderTop:"0.5px solid rgba(26,46,61,0.08)", paddingTop:8, marginTop:4 }}>
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
