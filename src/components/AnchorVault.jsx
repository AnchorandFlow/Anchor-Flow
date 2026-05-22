import React, { useState, useEffect } from "react"
import MomentsSection from "./MomentsSection"

const NAV = [
  { id: "home",        label: "Home",        icon: "home", emoji: "🏠" },
  { id: "inventory",   label: "Inventory",   icon: "inv",  emoji: "📦" },
  { id: "systems",     label: "Systems",     icon: "sys",  emoji: "🔧" },
  { id: "health",      label: "Health",      icon: "hlth", emoji: "🩺" },
  { id: "career",      label: "Career",      icon: "car",  emoji: "📋" },
  { id: "subs",        label: "Subs",        icon: "sub",  emoji: "🔄" },
  { id: "gifts",       label: "Celebrate",   icon: "gift", emoji: "🎉" },
  { id: "pets",        label: "Pets",        icon: "pet",  emoji: "🐾" },
  { id: "moments",     label: "Moments",     icon: "mom",  emoji: "✨" },
  { id: "ripples",     label: "Ripples",     icon: "rip",  emoji: "🌊" },
]

const PANTRY = ["Pasta","Rice","Olive oil","Canned tomatoes","Peanut butter","Oats","Flour","Sugar","Coffee","Cereal"]
const HOUSEHOLD = ["Paper towels","Dish soap","Laundry pods","Trash bags","Toilet paper","Hand soap","Sponges","Foil"]

const DEFAULT_INVENTORY = {
  pantry: [
    "Pasta","Rice","Olive oil","Canned tomatoes","Peanut butter",
    "Oats","Flour","Sugar","Coffee","Cereal","Honey","Bread","Canned beans","Broth","Vinegar"
  ].map(n => ({ name: n, stocked: true })),
  household: [
    "Paper towels","Dish soap","Laundry pods","Trash bags","Toilet paper",
    "Hand soap","Sponges","Foil","Plastic wrap","Zip bags","Cleaning spray","Dryer sheets"
  ].map(n => ({ name: n, stocked: true })),
  fridge: [
    "Milk","Eggs","Butter","Cheese","Yogurt","Juice","Leftovers","Condiments"
  ].map(n => ({ name: n, stocked: true })),
  freezer: [
    "Chicken","Ground beef","Frozen vegetables","Frozen fruit","Ice cream","Backup meals"
  ].map(n => ({ name: n, stocked: true })),
}

const CAT_LABELS = { pantry: "Pantry", household: "Household", fridge: "Fridge", freezer: "Freezer" }
const CAT_ICONS = { pantry: "🥫", household: "🧴", fridge: "🧊", freezer: "❄️" }


const DEFAULTS = {
  pantry:      ["Pasta","Rice","Olive oil","Canned tomatoes","Peanut butter","Oats","Flour","Sugar","Coffee","Cereal","Bread","Canned beans","Broth","Honey"],
  freezer:     ["Chicken","Ground beef","Frozen vegetables","Frozen fruit","Backup meals","Ice cream","Edamame"],
  fridge:      ["Eggs","Butter","Milk","Cheese","Greek yogurt","Salad greens","Carrots","Lemons","Condiments"],
  medications: ["Ibuprofen","Acetaminophen","Band-aids","Cold medicine","Vitamins","Allergy medicine","Thermometer"],
  cosmetics:   ["Shampoo","Conditioner","Body wash","Toothpaste","Deodorant","Face wash","Lotion","Sunscreen"],
  cleaning:    ["Dish soap","Laundry pods","All-purpose spray","Bleach","Sponges","Mop pads","Toilet cleaner"],
  paper:       ["Paper towels","Toilet paper","Trash bags","Zip bags","Foil","Plastic wrap","Napkins"],
  pet:         ["Dog food","Cat food","Pet treats","Litter","Poop bags","Flea treatment","Pet shampoo"],
}

const CATS = [
  { id: "pantry",      label: "Pantry",       icon: "🌾" },
  { id: "freezer",     label: "Freezer",      icon: "❄️" },
  { id: "fridge",      label: "Fridge",       icon: "🧊" },
  { id: "medications", label: "Medications",  icon: "💊" },
  { id: "cosmetics",   label: "Cosmetics",    icon: "🪞" },
  { id: "cleaning",    label: "Cleaning",     icon: "🧹" },
  { id: "paper",       label: "Paper Goods",  icon: "🧻" },
  { id: "pet",         label: "Pet Supplies", icon: "🐾" },
]

function migrateInventory(saved) {
  if (!saved) return null
  const keys = Object.keys(saved)
  if (keys.some(k => ["freezer","medications","cosmetics","cleaning","paper","pet"].includes(k))) return saved
  const migrated = {}
  const NEW_KEYS = ["pantry","freezer","fridge","medications","cosmetics","cleaning","paper","pet"]
  NEW_KEYS.forEach(k => {
    if (saved[k]) {
      migrated[k] = saved[k].map(i => ({ name: typeof i==="string"?i:i.name, stocked: i.stocked!==undefined?i.stocked:true, qty: i.qty??null, threshold: i.threshold??null }))
    } else {
      migrated[k] = DEFAULTS[k].map(n => ({ name: n, stocked: true, qty: null, threshold: null }))
    }
  })
  if (saved.household) {
    const hh = saved.household.map(i => ({ name: typeof i==="string"?i:i.name, stocked: i.stocked!==undefined?i.stocked:true, qty: null, threshold: null }))
    migrated.cleaning = [...migrated.cleaning, ...hh.filter(i => !migrated.cleaning.find(x => x.name===i.name))]
  }
  if (saved.pharmacy) {
    const rx = saved.pharmacy.map(i => ({ name: typeof i==="string"?i:i.name, stocked: i.stocked!==undefined?i.stocked:true, qty: null, threshold: null }))
    migrated.medications = [...migrated.medications, ...rx.filter(i => !migrated.medications.find(x => x.name===i.name))]
  }
  return migrated
}

function InventorySection({ onAddToShopping }) {
  
  const [items, setItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("af_inventory") || "null")
   const migrated = migrateInventory(saved)
      if (migrated) {
        try { localStorage.setItem("af_inventory", JSON.stringify(migrated)) } catch {}
        return migrated
      }
    } catch {}
    const init = {}
    Object.keys(DEFAULTS).forEach(k => { init[k] = DEFAULTS[k].map(n => ({ name: n, stocked: true })) })
    return init
  })
  const [activeTab, setActiveTab] = useState("inventory") // "inventory" | "favorites"
  const [activeCat, setActiveCat] = useState("pantry")
  const [toast, setToast] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState("")
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState("")

  // Favorites state
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem("af_favProducts") || "[]") } catch { return [] }
  })
  const [addingFav, setAddingFav] = useState(false)
  const [favForm, setFavForm] = useState({ name: "", brand: "", store: "", notes: "", emoji: "⭐" })
  const FAV_EMOJIS = ["⭐","🧴","🧺","🫙","🥫","🧹","🧻","🧼","🍳","💊","🐾","🌿","☕","🧃","🫧"]

  const saveFavs = (updated) => {
    setFavorites(updated)
    try { localStorage.setItem("af_favProducts", JSON.stringify(updated)) } catch {}
  }

  const save = (updated) => {
    setItems(updated)
    try { localStorage.setItem("af_inventory", JSON.stringify(updated)) } catch {}
  }

  const toggle = (idx) => {
    const cat = activeCat
    const updated = { ...items, [cat]: items[cat].map((x, i) => i === idx ? { ...x, stocked: !x.stocked } : x) }
    const item = updated[cat][idx]
    if (!item.stocked) {
      onAddToShopping(item.name)
      setToast(item.name + " added to shopping list")
      setTimeout(() => setToast(null), 2500)
    }
    save(updated)
  }

  const deleteItem = (idx) => {
    const updated = { ...items, [activeCat]: items[activeCat].filter((_, i) => i !== idx) }
    save(updated)
  }

  const renameItem = (idx) => {
    if (!editVal.trim()) return
    const updated = { ...items, [activeCat]: items[activeCat].map((x, i) => i === idx ? { ...x, name: editVal.trim() } : x) }
    save(updated)
    setEditing(null)
    setEditVal("")
  }

  const addItem = () => {
    if (!newItem.trim()) return
    const updated = { ...items, [activeCat]: [...(items[activeCat] || []), { name: newItem.trim(), stocked: true }] }
    save(updated)
    setNewItem("")
    setAdding(false)
  }

  const lowCount = (items[activeCat] || []).filter(x => !x.stocked).length
  const totalLow = Object.values(items).flat().filter(x => !x.stocked).length

  return (
    <div>
      <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: "#faf8f4", marginBottom: 4 }}>Inventory</div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(255,255,255,0.1)", marginBottom: 16 }}>
        {[["inventory","📦 Inventory"],["favorites","⭐ Favorites"]].map(([v,l]) => (
          <button key={v} onClick={() => setActiveTab(v)} style={{ background: "none", border: "none", borderBottom: activeTab===v ? "2px solid #c8a97a" : "2px solid transparent", padding: "8px 14px", fontSize: 12, color: activeTab===v ? "#c8a97a" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: activeTab===v ? 700 : 400 }}>{l}</button>
        ))}
      </div>

      {/* FAVORITES TAB */}
      {activeTab === "favorites" && (
        <div>
          <div style={{ fontSize: 12, color: "rgba(250,248,244,0.42)", fontFamily: "DM Sans,sans-serif", marginBottom: 16, lineHeight: 1.5 }}>
            Your go-to products — brands you love, where to get them. Tap to add to your shopping list.
          </div>

          {/* Add form */}
          {addingFav ? (
            <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 12, padding: "14px", marginBottom: 14 }}>
              {/* Emoji picker */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {FAV_EMOJIS.map(e => (
                  <button key={e} onClick={() => setFavForm(p => ({...p, emoji: e}))} style={{ background: favForm.emoji===e ? "rgba(200,169,122,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid " + (favForm.emoji===e ? "rgba(200,169,122,0.5)" : "rgba(255,255,255,0.08)"), borderRadius: 8, padding: "4px 7px", fontSize: 14, cursor: "pointer" }}>{e}</button>
                ))}
              </div>
              <input value={favForm.name} onChange={e => setFavForm(p => ({...p, name: e.target.value}))} placeholder="Product name *" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={favForm.brand} onChange={e => setFavForm(p => ({...p, brand: e.target.value}))} placeholder="Brand (opt)" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
                <input value={favForm.store} onChange={e => setFavForm(p => ({...p, store: e.target.value}))} placeholder="Where to buy (opt)" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
              </div>
              <input value={favForm.notes} onChange={e => setFavForm(p => ({...p, notes: e.target.value}))} placeholder="Notes — size, variety, why you love it (opt)" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => {
                  if (!favForm.name.trim()) return
                  saveFavs([...favorites, { id: Date.now().toString(), ...favForm }])
                  setFavForm({ name: "", brand: "", store: "", notes: "", emoji: "⭐" })
                  setAddingFav(false)
                }} style={{ flex: 1, background: "#c8a97a", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, color: "#1a2744", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Save product</button>
                <button onClick={() => setAddingFav(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "rgba(250,248,244,0.4)", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingFav(true)} style={{ width: "100%", padding: "10px", background: "rgba(200,169,122,0.07)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 8, fontSize: 12, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 500, marginBottom: 14 }}>+ Add favorite product</button>
          )}

          {/* Favorites list */}
          {favorites.length === 0 ? (
            <div style={{ fontSize: 13, color: "rgba(250,248,244,0.3)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", textAlign: "center", padding: "32px 0" }}>No favorites yet — add the products your family loves.</div>
          ) : favorites.map(fav => (
            <div key={fav.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "11px 14px", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{fav.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{fav.name}</div>
                {fav.brand && <div style={{ fontSize: 11, color: "rgba(200,169,122,0.7)", fontFamily: "DM Sans,sans-serif", marginTop: 1 }}>{fav.brand}</div>}
                {fav.store && <div style={{ fontSize: 11, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif" }}>📍 {fav.store}</div>}
                {fav.notes && <div style={{ fontSize: 11, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", marginTop: 3, fontStyle: "italic", lineHeight: 1.4 }}>{fav.notes}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button onClick={() => { onAddToShopping(fav.brand ? fav.brand + " " + fav.name : fav.name); setToast(fav.name + " added to list"); setTimeout(() => setToast(null), 2000) }} style={{ background: "rgba(122,158,142,0.15)", border: "1px solid rgba(122,158,142,0.3)", borderRadius: 6, padding: "4px 8px", fontSize: 10, color: "#7a9e8e", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>+ List</button>
                <button onClick={() => saveFavs(favorites.filter(f => f.id !== fav.id))} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.25, fontSize: 12, color: "#faf8f4", padding: "2px" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INVENTORY TAB */}
      {activeTab === "inventory" && <div>
      <div style={{ fontSize: 12, color: "rgba(250,248,244,0.42)", fontFamily: "DM Sans,sans-serif", marginBottom: 16, lineHeight: 1.5 }}>
        Quick weekly reset — tap to mark low, items go straight to your shopping list. Edit lists to match your family.
      </div>

      {totalLow > 0 && (
        <div style={{ background: "rgba(200,131,74,0.1)", border: "1px solid rgba(200,131,74,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#c8834a", fontFamily: "DM Sans,sans-serif" }}>
          {totalLow} item{totalLow > 1 ? "s" : ""} running low across all categories — added to your shopping list
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: "#7a9e8e", color: "#fff", padding: "8px 18px", borderRadius: 20, fontSize: 13, fontFamily: "DM Sans,sans-serif", zIndex: 9999, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
        {CATS.map(cat => {
          const low = (items[cat.id] || []).filter(x => !x.stocked).length
          return (
            <div key={cat.id} onClick={() => setActiveCat(cat.id)} style={{ padding: "7px 12px", fontSize: 11, cursor: "pointer", borderBottom: activeCat === cat.id ? "2px solid #c8a97a" : "2px solid transparent", color: activeCat === cat.id ? "#c8a97a" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
              {cat.icon} {cat.label}
              {low > 0 && <span style={{ background: "#c8834a", color: "#fff", fontSize: 8, borderRadius: 8, padding: "1px 5px", fontWeight: 700 }}>{low}</span>}
            </div>
          )
        })}
      </div>

      {/* Items list */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
        {(items[activeCat] || []).map((item, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {/* Checkbox */}
            <div onClick={() => { if (editing !== idx) toggle(idx) }} style={{ width: 20, height: 20, borderRadius: 5, border: "1.5px solid " + (item.stocked ? "#7a9e8e" : "rgba(255,255,255,0.2)"), background: item.stocked ? "#7a9e8e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
              {item.stocked && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
            </div>

            {/* Name or edit input */}
            {editing === idx ? (
              <input
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") renameItem(idx); if (e.key === "Escape") setEditing(null) }}
                autoFocus
                style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(200,169,122,0.4)", borderRadius: 6, padding: "3px 8px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }}
              />
            ) : (
              <span style={{ flex: 1, fontSize: 13, color: item.stocked ? "rgba(250,248,244,0.75)" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", textDecoration: item.stocked ? "none" : "line-through" }}>{item.name}</span>
            )}

            {!item.stocked && editing !== idx && <span style={{ fontSize: 10, color: "#c8834a", fontFamily: "DM Sans,sans-serif", flexShrink: 0 }}>→ list</span>}

            {/* Edit/save/delete */}
            {editing === idx ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => renameItem(idx)} style={{ background: "#7a9e8e", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#fff", cursor: "pointer" }}>save</button>
                <button onClick={() => setEditing(null)} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "rgba(250,248,244,0.5)", cursor: "pointer" }}>cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, opacity: 0 }} className="item-actions" onMouseEnter={e => e.currentTarget.style.opacity=1} onMouseLeave={e => e.currentTarget.style.opacity=0}>
                <button onClick={() => { setEditing(idx); setEditVal(item.name) }} style={{ background: "none", border: "none", fontSize: 11, color: "rgba(250,248,244,0.35)", cursor: "pointer", padding: "2px 4px" }}>✏️</button>
                <button onClick={() => deleteItem(idx)} style={{ background: "none", border: "none", fontSize: 11, color: "rgba(200,131,74,0.5)", cursor: "pointer", padding: "2px 4px" }}>✕</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add item */}
      {adding ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addItem(); if (e.key === "Escape") setAdding(false) }}
            placeholder={"Add to " + CATS.find(c => c.id === activeCat).label.toLowerCase() + "..."}
            autoFocus
            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }}
          />
          <button onClick={addItem} style={{ background: "#c8a97a", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#1a2744", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 500 }}>Add</button>
          <button onClick={() => setAdding(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "rgba(250,248,244,0.4)", cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ width: "100%", padding: "10px", background: "rgba(200,169,122,0.08)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 8, fontSize: 12, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 500 }}>
          + Add item to {CATS.find(c => c.id === activeCat)?.label}
        </button>
      )}
      </div>}
    </div>
  )
}


// ── Birthdays Section ────────────────────────────────────────────────────────
function BirthdaysSection() {
  const [birthdays, setBirthdays] = useState(() => {
    try { return JSON.parse(localStorage.getItem("af_birthdays") || "[]") } catch { return [] }
  })
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: "", month: "", day: "", year: "" })

  const save = (updated) => {
    setBirthdays(updated)
    try { localStorage.setItem("af_birthdays", JSON.stringify(updated)) } catch {}
  }

  const addBirthday = () => {
    if (!form.name.trim() || !form.month || !form.day) return
    save([...birthdays, { id: Date.now().toString(), name: form.name.trim(), month: parseInt(form.month), day: parseInt(form.day), year: form.year ? parseInt(form.year) : null }])
    setForm({ name: "", month: "", day: "", year: "" })
    setAdding(false)
  }

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const now = new Date(); now.setHours(0,0,0,0)

  const sorted = [...birthdays].sort((a, b) => {
    const da = new Date(now.getFullYear(), a.month-1, a.day); if (da < now) da.setFullYear(da.getFullYear()+1)
    const db = new Date(now.getFullYear(), b.month-1, b.day); if (db < now) db.setFullYear(db.getFullYear()+1)
    return da - db
  })

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif" }}>🎂 Birthdays</div>
        <button onClick={() => setAdding(p => !p)} style={{ background: "rgba(200,169,122,0.12)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 7, padding: "4px 12px", fontSize: 11, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>+ Add</button>
      </div>

      {adding && (
        <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
          <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Name" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={form.month} onChange={e => setForm(p => ({...p, month: e.target.value}))} placeholder="Month (1-12)" type="number" min="1" max="12" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
            <input value={form.day} onChange={e => setForm(p => ({...p, day: e.target.value}))} placeholder="Day" type="number" min="1" max="31" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
            <input value={form.year} onChange={e => setForm(p => ({...p, year: e.target.value}))} placeholder="Year (opt)" type="number" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addBirthday} style={{ flex: 1, background: "#c8a97a", border: "none", borderRadius: 7, padding: "8px", fontSize: 12, color: "#1a2744", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>Save</button>
            <button onClick={() => setAdding(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "rgba(250,248,244,0.4)", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: "rgba(250,248,244,0.3)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", padding: "8px 0" }}>No birthdays yet — they'll show on your calendar automatically once added.</div>
      ) : sorted.map(b => {
        const next = new Date(now.getFullYear(), b.month-1, b.day)
        if (next < now) next.setFullYear(next.getFullYear()+1)
        const diff = Math.round((next - now) / 86400000)
        const soon = diff <= 14
        const age = b.year ? (next.getFullYear() - b.year) : null
        return (
          <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: soon ? "rgba(200,131,74,0.08)" : "rgba(255,255,255,0.03)", border: "1px solid " + (soon ? "rgba(200,131,74,0.25)" : "rgba(255,255,255,0.07)"), borderRadius: 9, marginBottom: 6 }}>
            <span style={{ fontSize: 16 }}>🎂</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{b.name}</div>
              <div style={{ fontSize: 11, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif" }}>{MONTHS[b.month-1]} {b.day}{age ? " · turning " + age : ""}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {diff === 0 ? <span style={{ fontSize: 11, fontWeight: 800, color: "#c8834a" }}>Today! 🎉</span>
              : diff === 1 ? <span style={{ fontSize: 11, fontWeight: 700, color: "#c8834a" }}>Tomorrow</span>
              : soon ? <span style={{ fontSize: 11, color: "#c8834a", fontWeight: 600 }}>in {diff} days</span>
              : <span style={{ fontSize: 11, color: "rgba(250,248,244,0.3)" }}>in {diff} days</span>}
            </div>
            <button onClick={() => save(birthdays.filter(x => x.id !== b.id))} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.3, fontSize: 13, color: "#faf8f4", padding: "2px 4px" }}>✕</button>
          </div>
        )
      })}
    </div>
  )
}

// ── Celebrations Section ─────────────────────────────────────────────────────
const CELEBRATION_TYPES = [
  { id: "birthday", label: "Birthday", emoji: "🎂" },
  { id: "anniversary", label: "Anniversary", emoji: "💍" },
  { id: "graduation", label: "Graduation", emoji: "🎓" },
  { id: "holiday", label: "Holiday", emoji: "🎄" },
  { id: "wedding", label: "Wedding", emoji: "💐" },
  { id: "babyshower", label: "Baby Shower", emoji: "🍼" },
  { id: "other", label: "Other", emoji: "🎉" },
]

function CelebrationsSection({ calEvents = [] }) {
  const [celebrations, setCelebrations] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("af_celebrations") || "[]")
      // Migrate old birthdays if present
      const bdays = JSON.parse(localStorage.getItem("af_birthdays") || "[]")
      const migrated = bdays.filter(b => !saved.find(c => c.name === b.name && c.type === "birthday"))
        .map(b => ({ id: b.id, type: "birthday", name: b.name, month: b.month, day: b.day, year: b.year || null, notes: "" }))
      return [...saved, ...migrated]
    } catch { return [] }
  })
  const [adding, setAdding] = useState(false)
  const [celebType, setCelebType] = useState("birthday")
  const [form, setForm] = useState({ name: "", month: "", day: "", year: "", notes: "" })
  const [filter, setFilter] = useState("upcoming") // "upcoming" | "all"

  const save = (updated) => {
    setCelebrations(updated)
    try { localStorage.setItem("af_celebrations", JSON.stringify(updated)) } catch {}
  }

  const addCelebration = () => {
    if (!form.name.trim() || !form.month || !form.day) return
    save([...celebrations, {
      id: Date.now().toString(),
      type: celebType,
      name: form.name.trim(),
      month: parseInt(form.month),
      day: parseInt(form.day),
      year: form.year ? parseInt(form.year) : null,
      notes: form.notes.trim(),
    }])
    setForm({ name: "", month: "", day: "", year: "", notes: "" })
    setAdding(false)
  }

  // Also pull in calendar events
  const now = new Date(); now.setHours(0,0,0,0)
  const year = now.getFullYear()

  const celebEntries = celebrations.map(c => {
    const typeInfo = CELEBRATION_TYPES.find(t => t.id === c.type) || CELEBRATION_TYPES[6]
    const next = new Date(year, c.month-1, c.day)
    if (next < now) next.setFullYear(next.getFullYear()+1)
    const diff = Math.round((next - now) / 86400000)
    const age = (c.type === "birthday" && c.year) ? (next.getFullYear() - c.year) : null
    const label = c.name + (age ? " turns " + age : c.type === "anniversary" ? " anniversary" : "")
    return { ...c, typeInfo, next, diff, label, emoji: typeInfo.emoji, soon: diff <= 14 }
  })

  const calEntries = (calEvents || []).map(e => {
    const d = new Date(e.date + "T12:00:00")
    const diff = Math.round((d - now) / 86400000)
    return { id: e.id, type: "event", name: e.title, label: e.title, next: d, diff, emoji: "📅", soon: diff >= 0 && diff <= 3, typeInfo: { label: "Calendar event" } }
  })

  const all = [...celebEntries, ...calEntries].sort((a, b) => a.diff - b.diff)
  const upcoming = all.filter(e => e.diff >= 0)
  const past = all.filter(e => e.diff < 0).sort((a,b) => b.diff - a.diff)
  const shown = filter === "upcoming" ? upcoming : all

  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: "#faf8f4" }}>Celebrations</div>
        <button onClick={() => { setAdding(p => !p); setForm({ name: "", month: "", day: "", year: "", notes: "" }) }} style={{ background: "rgba(200,169,122,0.12)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>+ Add</button>
      </div>
      <div style={{ fontSize: 12, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", marginBottom: 16 }}>{upcoming.length} upcoming · {past.length} passed this year</div>

      {/* Add form */}
      {adding && (
        <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 12, padding: "16px", marginBottom: 16 }}>
          {/* Type picker */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", marginBottom: 8 }}>Type</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {CELEBRATION_TYPES.map(t => (
              <button key={t.id} onClick={() => setCelebType(t.id)} style={{ background: celebType === t.id ? "rgba(200,169,122,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid " + (celebType === t.id ? "rgba(200,169,122,0.5)" : "rgba(255,255,255,0.1)"), borderRadius: 20, padding: "5px 11px", fontSize: 11, color: celebType === t.id ? "#c8a97a" : "rgba(250,248,244,0.45)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: celebType === t.id ? 700 : 400 }}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          {/* Name */}
          <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder={celebType === "birthday" ? "Person's name" : "What's the occasion?"} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
          {/* Date */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select value={form.month} onChange={e => setForm(p => ({...p, month: e.target.value}))} style={{ flex: 2, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: form.month ? "#faf8f4" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", outline: "none" }}>
              <option value="">Month</option>
              {MONTHS.map((m,i) => <option key={i} value={i+1} style={{ background: "#1a2744" }}>{m}</option>)}
            </select>
            <input value={form.day} onChange={e => setForm(p => ({...p, day: e.target.value}))} placeholder="Day" type="number" min="1" max="31" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
            {(celebType === "birthday" || celebType === "anniversary") && (
              <input value={form.year} onChange={e => setForm(p => ({...p, year: e.target.value}))} placeholder="Year (opt)" type="number" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
            )}
          </div>
          <input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Notes (optional)" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none", marginBottom: 12, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addCelebration} style={{ flex: 1, background: "#c8a97a", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, color: "#1a2744", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Save celebration</button>
            <button onClick={() => setAdding(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "rgba(250,248,244,0.4)", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
        {[["upcoming","Upcoming"],["all","All"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ background: "none", border: "none", borderBottom: filter===v ? "2px solid #c8a97a" : "2px solid transparent", padding: "7px 14px", fontSize: 12, color: filter===v ? "#c8a97a" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: filter===v ? 700 : 400 }}>{l}</button>
        ))}
      </div>

      {/* List */}
      {shown.length === 0 && (
        <div style={{ fontSize: 13, color: "rgba(250,248,244,0.3)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", textAlign: "center", padding: "32px 0" }}>No celebrations yet — tap + Add to get started.</div>
      )}
      {shown.map((e, i) => {
        const isPast = e.diff < 0
        return (
          <div key={e.id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: e.soon && !isPast ? "rgba(200,131,74,0.07)" : "rgba(255,255,255,0.03)", border: "1px solid " + (e.soon && !isPast ? "rgba(200,131,74,0.2)" : "rgba(255,255,255,0.07)"), borderRadius: 10, marginBottom: 7, opacity: isPast ? 0.45 : 1 }}>
            <div style={{ width: 40, textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 18, lineHeight: 1 }}>{e.emoji}</div>
              {e.next && <div style={{ fontSize: 10, color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", marginTop: 1 }}>{DAYS[e.next.getDay()]}</div>}
              {e.month && <div style={{ fontSize: 13, fontWeight: 700, color: e.soon && !isPast ? "#c8834a" : "rgba(200,169,122,0.6)", fontFamily: "Cormorant Garamond,serif" }}>{MONTHS[e.month-1]} {e.day}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: isPast ? "rgba(250,248,244,0.45)" : "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{e.label}</div>
              <div style={{ fontSize: 11, color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", marginTop: 2 }}>{e.typeInfo?.label}{e.notes ? " · " + e.notes : ""}</div>
            </div>
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              {isPast ? <span style={{ fontSize: 10, color: "rgba(250,248,244,0.2)", fontFamily: "DM Sans,sans-serif" }}>passed</span>
              : e.diff === 0 ? <span style={{ fontSize: 11, fontWeight: 800, color: "#c8834a" }}>Today! 🎉</span>
              : e.diff === 1 ? <span style={{ fontSize: 11, fontWeight: 700, color: "#c8834a" }}>Tomorrow</span>
              : e.diff <= 7 ? <span style={{ fontSize: 11, color: "#c8834a", fontWeight: 600 }}>in {e.diff}d</span>
              : <span style={{ fontSize: 11, color: "rgba(250,248,244,0.3)" }}>in {e.diff}d</span>}
            </div>
            {e.type !== "event" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <button onClick={() => { setCelebType(e.type); setForm({ name: e.name, month: String(e.month), day: String(e.day), year: e.year ? String(e.year) : "", notes: e.notes||"" }); save(celebrations.filter(x => x.id !== e.id)); setAdding(true); }} style={{ background: "rgba(200,169,122,0.1)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 5, padding: "3px 7px", fontSize: 10, color: "#c8a97a", cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>edit</button>
                <button onClick={() => save(celebrations.filter(x => x.id !== e.id))} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.25, fontSize: 13, padding: "2px 4px", color: "#faf8f4" }}>✕</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const OCCASION_TYPES = [
  "Birthday","Anniversary","Christmas","Mother's Day","Father's Day",
  "Valentine's Day","Graduation","Wedding","Baby Shower","Hanukkah","Easter","Other"
]
const GIFT_FREE_LIMIT = 15

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  const parts = dateStr.split("-")
  let target = new Date(today.getFullYear(), parseInt(parts[1])-1, parseInt(parts[2]))
  if (target < today) target.setFullYear(today.getFullYear()+1)
  return Math.ceil((target-today)/(1000*60*60*24))
}

function formatOccDate(dateStr) {
  if (!dateStr) return ""
  const parts = dateStr.split("-")
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return months[parseInt(parts[1])-1]+" "+parseInt(parts[2])
}

function GiftsSection({ people = [], isPremium = false, calEvents = [] }) {
  const [gifts, setGifts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("af_gifts") || "[]") } catch { return [] }
  })
  const [view, setView] = useState("upcoming")
  const [activePerson, setActivePerson] = useState(null)
  const [activeOccasion, setActiveOccasion] = useState(null)
  const [addingPerson, setAddingPerson] = useState(false)
  const [addingOccasion, setAddingOccasion] = useState(false)
  const [addingGift, setAddingGift] = useState(false)
  const [newPerson, setNewPerson] = useState({ name: "", relation: "" })
  const [newOccasion, setNewOccasion] = useState({ type: "Birthday", date: "" })
  const [newGift, setNewGift] = useState({ item: "", cost: "" })
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [editingGift, setEditingGift] = useState(null)
  const [editGiftVal, setEditGiftVal] = useState({ item: "", cost: "" })

 const gUid = () => Math.random().toString(36).slice(2,9)

  const HOLIDAY_KEYWORDS = ["birthday","anniversary","christmas","hanukkah","easter","graduation","wedding","valentine"]

  const [calSuggestions, setCalSuggestions] = useState([])
  const [calBannerDismissed, setCalBannerDismissed] = useState(false)

  useEffect(() => {
    if (!calEvents.length) return
    setCalBannerDismissed(false)
    const found = []
    calEvents.forEach(ev => {
      if (!ev.title) return
      const t = ev.title.toLowerCase()
      const type = t.includes("birthday") ? "Birthday" : t.includes("anniversary") ? "Anniversary" : t.includes("christmas") ? "Christmas" : t.includes("hanukkah") ? "Hanukkah" : t.includes("easter") ? "Easter" : t.includes("mother") ? "Mother's Day" : t.includes("father") ? "Father's Day" : t.includes("valentine") ? "Valentine's Day" : t.includes("graduation") ? "Graduation" : t.includes("thanksgiving") ? "Other" : null
      if (!type) return
      let name = ev.title.replace(/birthday|anniversary|christmas|hanukkah|easter|graduation|thanksgiving/gi,"").replace(/[-:·|]/g,"").trim()
      if (!name || name.length < 2 || name.length > 50) name = ev.title
      const already = gifts.some(p => p.name.toLowerCase()===name.toLowerCase() && (p.occasions||[]).some(o=>o.type===type))
      if (!already) found.push({ name, type, date: ev.date||"", title: ev.title })
    })
    const unique = found.filter((f,i) => found.findIndex(x=>x.name===f.name&&x.type===f.type)===i)
    setCalSuggestions(unique)
  }, [calEvents])

  const saveGifts = (updated) => {
    setGifts(updated)
    try { localStorage.setItem("af_gifts", JSON.stringify(updated)) } catch {}
  }

  const allPeople = [
    ...people.map(p => ({ id: p.id, name: p.name, relation: "Family", fromApp: true })),
    ...gifts.filter(g => !people.find(p => p.id === g.id))
  ]

  const atLimit = gifts.filter(g => !people.find(p => p.id === g.id)).length >= GIFT_FREE_LIMIT && !isPremium

  const upcoming = []
  gifts.forEach(person => {
    (person.occasions || []).forEach(occ => {
      if (occ.date) {
        const days = daysUntil(occ.date)
        const unbought = (occ.gifts || []).filter(g => !g.bought).length
        upcoming.push({ personId: person.id, personName: person.name, occasion: occ, days, unbought })
      }
    })
  })
  upcoming.sort((a,b) => (a.days??999)-(b.days??999))
  const soonUpcoming = upcoming.filter(u => u.days !== null && u.days <= 60)

  const totalSpent = gifts.reduce((sum,p) => sum+(p.occasions||[]).reduce((s2,o) => s2+(o.gifts||[]).filter(g=>g.bought&&g.cost).reduce((s3,g)=>s3+g.cost,0),0),0)
  const totalUnbought = gifts.reduce((sum,p) => sum+(p.occasions||[]).reduce((s2,o) => s2+(o.gifts||[]).filter(g=>!g.bought).length,0),0)

  const addPerson = () => {
    if (!newPerson.name.trim() || atLimit) return
    const entry = { id: gUid(), name: newPerson.name.trim(), relation: newPerson.relation.trim(), occasions: [] }
    saveGifts([...gifts, entry])
    setNewPerson({ name: "", relation: "" })
    setAddingPerson(false)
    setActivePerson(entry.id)
    setView("person")
  }

  const addOccasion = (personId) => {
    if (!newOccasion.type) return
    const occ = { id: gUid(), type: newOccasion.type, date: newOccasion.date, gifts: [] }
    const exists = gifts.find(p => p.id === personId)
    if (!exists) {
      const appP = people.find(p => p.id === personId)
      if (appP) saveGifts([...gifts, { id: personId, name: appP.name, relation: "Family", occasions: [occ] }])
    } else {
      saveGifts(gifts.map(p => p.id===personId ? {...p, occasions:[...(p.occasions||[]),occ]} : p))
    }
    setNewOccasion({ type: "Birthday", date: "" })
    setAddingOccasion(false)
    setActiveOccasion(occ.id)
  }

  const addGiftItem = (personId, occId) => {
    if (!newGift.item.trim()) return
    const item = { id: gUid(), item: newGift.item.trim(), cost: newGift.cost ? parseFloat(newGift.cost) : null, bought: false }
    saveGifts(gifts.map(p => p.id===personId ? {...p, occasions:(p.occasions||[]).map(o => o.id===occId ? {...o, gifts:[...(o.gifts||[]),item]} : o)} : p))
    setNewGift({ item: "", cost: "" })
    setAddingGift(false)
  }

  const toggleBought = (personId, occId, giftId) => {
    saveGifts(gifts.map(p => p.id===personId ? {...p, occasions:(p.occasions||[]).map(o => o.id===occId ? {...o, gifts:(o.gifts||[]).map(g => g.id===giftId?{...g,bought:!g.bought}:g)} : o)} : p))
  }

  const deleteGiftItem = (personId, occId, giftId) => {
    saveGifts(gifts.map(p => p.id===personId ? {...p, occasions:(p.occasions||[]).map(o => o.id===occId ? {...o, gifts:(o.gifts||[]).filter(g=>g.id!==giftId)} : o)} : p))
  }

  const saveEditGift = (personId, occId, giftId) => {
    saveGifts(gifts.map(p => p.id===personId ? {...p, occasions:(p.occasions||[]).map(o => o.id===occId ? {...o, gifts:(o.gifts||[]).map(g => g.id===giftId?{...g,item:editGiftVal.item,cost:editGiftVal.cost?parseFloat(editGiftVal.cost):null}:g)} : o)} : p))
    setEditingGift(null)
  }

  const getAISuggestions = async (personName, relation, occasionType) => {
    if (!isPremium) return
    setAiLoading(true)
    setAiSuggestions(null)
    try {
      const res = await fetch("/api/claude", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:'You are a thoughtful gift advisor. Suggest 5 specific gift ideas. Respond ONLY in JSON: {"suggestions":[{"item":"name","why":"one sentence","price":"$XX-$XX"}]}. No markdown.',
          messages:[{role:"user",content:"Gift ideas for "+personName+" ("+relation+") for "+occasionType+". Mix price ranges. Be specific."}]
        })
      })
      const data = await res.json()
      const text = data.content?.find(b=>b.type==="text")?.text||""
      try { setAiSuggestions(JSON.parse(text).suggestions||[]) } catch { setAiSuggestions([]) }
    } catch { setAiSuggestions([]) }
    setAiLoading(false)
  }

  const currentPerson = gifts.find(p=>p.id===activePerson) || (activePerson?allPeople.find(p=>p.id===activePerson):null)
  const currentOccasion = currentPerson?.occasions?.find(o=>o.id===activeOccasion)

  const gS = {
    card:{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"12px 14px", marginBottom:10 },
    inp:{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(200,169,122,0.3)", borderRadius:8, padding:"8px 12px", fontSize:13, color:"#faf8f4", fontFamily:"DM Sans,sans-serif", outline:"none", boxSizing:"border-box", colorScheme:"dark", WebkitTextFillColor:"#faf8f4" },
    btn:{ background:"#c8a97a", border:"none", borderRadius:8, padding:"8px 14px", fontSize:12, color:"#1a2744", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600 },
    ghost:{ background:"rgba(255,255,255,0.06)", border:"none", borderRadius:8, padding:"8px 12px", fontSize:12, color:"rgba(250,248,244,0.5)", fontFamily:"DM Sans,sans-serif", cursor:"pointer" },
  }

  if (activeOccasion && currentPerson && currentOccasion) {
    const giftList = currentOccasion.gifts||[]
    const spent = giftList.filter(g=>g.bought&&g.cost).reduce((s,g)=>s+g.cost,0)
    const days = daysUntil(currentOccasion.date)
    return (
      <div>
        <button onClick={()=>setActiveOccasion(null)} style={{...gS.ghost,marginBottom:16,fontSize:11}}>← Back</button>
        <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:20,fontWeight:600,color:"#faf8f4",marginBottom:2}}>{currentPerson.name}</div>
        <div style={{fontSize:12,color:"#c8a97a",fontFamily:"DM Sans,sans-serif",marginBottom:4}}>{currentOccasion.type}{currentOccasion.date?" · "+formatOccDate(currentOccasion.date):""}</div>
        {days!==null&&<div style={{fontSize:11,color:days<=14?"#c8834a":"rgba(250,248,244,0.4)",fontFamily:"DM Sans,sans-serif",marginBottom:16}}>{days===0?"Today!":days+" days away"}</div>}
        {spent>0&&<div style={{fontSize:11,color:"#7a9e8e",fontFamily:"DM Sans,sans-serif",marginBottom:12}}>${spent.toFixed(2)} spent</div>}
        <div style={{...gS.card,padding:0,overflow:"hidden",marginBottom:12}}>
          {giftList.length===0&&<div style={{padding:14,fontSize:12,color:"rgba(250,248,244,0.3)",fontFamily:"DM Sans,sans-serif"}}>No gift ideas yet</div>}
          {giftList.map(g=>(
            <div key={g.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
              <div onClick={()=>toggleBought(currentPerson.id,currentOccasion.id,g.id)} style={{width:20,height:20,borderRadius:5,border:"1.5px solid "+(g.bought?"#7a9e8e":"rgba(255,255,255,0.2)"),background:g.bought?"#7a9e8e":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}}>
                {g.bought&&<span style={{color:"#fff",fontSize:11}}>✓</span>}
              </div>
              {editingGift===g.id?(
                <div style={{flex:1,display:"flex",gap:6}}>
                  <input value={editGiftVal.item} onChange={e=>setEditGiftVal(v=>({...v,item:e.target.value}))} style={{...gS.inp,flex:2,padding:"4px 8px"}}/>
                 <input value={editGiftVal.cost} onChange={e=>setEditGiftVal(v=>({...v,cost:e.target.value}))} placeholder="$" style={{...gS.inp,flex:1,padding:"4px 8px"}}/>
                  <input value={editGiftVal.url||""} onChange={e=>setEditGiftVal(v=>({...v,url:e.target.value}))} placeholder="Link" style={{...gS.inp,flex:2,padding:"4px 8px"}}/>
                  <button onClick={()=>saveEditGift(currentPerson.id,currentOccasion.id,g.id)} style={{...gS.btn,padding:"4px 8px",fontSize:11}}>save</button>
                  <button onClick={()=>setEditingGift(null)} style={{...gS.ghost,padding:"4px 8px",fontSize:11}}>✕</button>
                </div>
              ):(
                <>
                  <span style={{flex:1,fontSize:13,color:g.bought?"rgba(250,248,244,0.4)":"rgba(250,248,244,0.8)",fontFamily:"DM Sans,sans-serif",textDecoration:g.bought?"line-through":"none"}}>{g.item}</span>
                 {g.cost&&<span style={{fontSize:11,color:"rgba(250,248,244,0.4)",fontFamily:"DM Sans,sans-serif"}}>${g.cost.toFixed(2)}</span>}
                  {g.url&&<a href={g.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#6ba3c4",fontFamily:"DM Sans,sans-serif",textDecoration:"none"}} onClick={e=>e.stopPropagation()}>🔗</a>}
                  <button onClick={()=>{setEditingGift(g.id);setEditGiftVal({item:g.item,cost:g.cost?String(g.cost):""})}} style={{background:"none",border:"none",fontSize:11,color:"rgba(250,248,244,0.25)",cursor:"pointer",padding:"2px 4px"}}>✏️</button>
                  <button onClick={()=>deleteGiftItem(currentPerson.id,currentOccasion.id,g.id)} style={{background:"none",border:"none",fontSize:11,color:"rgba(200,131,74,0.4)",cursor:"pointer",padding:"2px 4px"}}>✕</button>
                </>
              )}
            </div>
          ))}
        </div>
       {addingGift?(<>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input value={newGift.item} onChange={e=>setNewGift(v=>({...v,item:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter")addGiftItem(currentPerson.id,currentOccasion.id)}} placeholder="Gift idea..." autoFocus style={{...gS.inp,flex:2}}/>
          <input value={newGift.cost} onChange={e=>setNewGift(v=>({...v,cost:e.target.value}))} placeholder="$" style={{...gS.inp,flex:1}}/>
           <button onClick={()=>addGiftItem(currentPerson.id,currentOccasion.id)} style={gS.btn}>Add</button>
     <button onClick={()=>setAddingGift(false)} style={gS.ghost}>✕</button>
        </div>
    <input value={newGift.url} onChange={e=>setNewGift(v=>({...v,url:e.target.value}))} placeholder="Link (optional — Amazon, Etsy, etc.)" style={{...gS.inp,marginTop:6,marginBottom:8}}/>
        </>):(
          <button onClick={()=>setAddingGift(true)} style={{width:"100%",padding:10,background:"rgba(200,169,122,0.08)",border:"1px solid rgba(200,169,122,0.2)",borderRadius:8,fontSize:12,color:"#c8a97a",fontFamily:"DM Sans,sans-serif",cursor:"pointer",marginBottom:12}}>+ Add gift idea</button>
        )}
        {isPremium?(
          <div>
            <button onClick={()=>getAISuggestions(currentPerson.name,currentPerson.relation,currentOccasion.type)} disabled={aiLoading} style={{width:"100%",padding:10,background:"rgba(123,94,167,0.1)",border:"1px solid rgba(123,94,167,0.25)",borderRadius:8,fontSize:12,color:"rgba(196,168,232,0.8)",fontFamily:"DM Sans,sans-serif",cursor:"pointer",marginBottom:12}}>
              {aiLoading?"Getting ideas...":"✨ AI gift suggestions"}
            </button>
            {aiSuggestions&&aiSuggestions.map((s,i)=>(
              <div key={i} style={{...gS.card,display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:"#faf8f4",fontFamily:"DM Sans,sans-serif",fontWeight:500}}>{s.item}</div>
                  <div style={{fontSize:11,color:"rgba(250,248,244,0.45)",marginTop:2}}>{s.why}</div>
                  <div style={{fontSize:11,color:"#c8a97a",marginTop:2}}>{s.price}</div>
                </div>
                <button onClick={()=>{setNewGift({item:s.item,cost:""});setAddingGift(true);setAiSuggestions(null)}} style={{...gS.btn,padding:"4px 10px",fontSize:10,flexShrink:0}}>+ Add</button>
              </div>
            ))}
          </div>
        ):(
          <div style={{background:"rgba(123,94,167,0.07)",border:"1px solid rgba(123,94,167,0.2)",borderRadius:8,padding:"10px 14px",fontSize:12,color:"rgba(196,168,232,0.6)",fontFamily:"DM Sans,sans-serif"}}>✨ Upgrade for AI gift suggestions for {currentPerson.name}</div>
        )}
      </div>
    )
  }

  if (activePerson && currentPerson) {
    const personData = gifts.find(p=>p.id===activePerson)
    const occasions = personData?.occasions||[]
    return (
      <div>
        <button onClick={()=>{setActivePerson(null);setView("people")}} style={{...gS.ghost,marginBottom:16,fontSize:11}}>← Back</button>
        <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:20,fontWeight:600,color:"#faf8f4",marginBottom:2}}>{currentPerson.name}</div>
        <div style={{fontSize:11,color:"rgba(250,248,244,0.4)",fontFamily:"DM Sans,sans-serif",marginBottom:16}}>{currentPerson.relation}</div>
        {occasions.length===0&&<div style={{fontSize:12,color:"rgba(250,248,244,0.3)",fontFamily:"DM Sans,sans-serif",marginBottom:16}}>No occasions yet</div>}
        {occasions.map(occ=>{
          const days=daysUntil(occ.date)
          const unbought=(occ.gifts||[]).filter(g=>!g.bought).length
          const bought=(occ.gifts||[]).filter(g=>g.bought).length
          return (
            <div key={occ.id} onClick={()=>{setActiveOccasion(occ.id);setAiSuggestions(null)}} style={{...gS.card,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:"#faf8f4",fontFamily:"DM Sans,sans-serif"}}>{occ.type}</div>
                <div style={{fontSize:11,color:"rgba(250,248,244,0.4)",marginTop:2}}>
                  {occ.date?formatOccDate(occ.date):"No date"}
                  {days!==null&&days<=30&&<span style={{color:days<=7?"#c8834a":"#c8a97a",marginLeft:6}}>· {days===0?"Today!":days+"d"}</span>}
                </div>
                {(occ.gifts||[]).length>0&&<div style={{fontSize:10,color:"rgba(250,248,244,0.3)",marginTop:3}}>{bought>0?bought+" bought":""}{bought>0&&unbought>0?" · ":""}{unbought>0?unbought+" to get":""}</div>}
              </div>
              {unbought>0&&<span style={{background:"#c8834a",color:"#fff",fontSize:9,borderRadius:8,padding:"2px 6px",fontWeight:700}}>{unbought}</span>}
              <span style={{fontSize:12,color:"rgba(200,169,122,0.35)"}}>→</span>
            </div>
          )
        })}
        {addingOccasion?(
          <div style={gS.card}>
            <select value={newOccasion.type} onChange={e=>setNewOccasion(v=>({...v,type:e.target.value}))} style={{...gS.inp,marginBottom:8}}>
              {OCCASION_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" value={newOccasion.date} onChange={e=>setNewOccasion(v=>({...v,date:e.target.value}))} style={{...gS.inp,marginBottom:10}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>addOccasion(activePerson)} style={gS.btn}>Add occasion</button>
              <button onClick={()=>setAddingOccasion(false)} style={gS.ghost}>Cancel</button>
            </div>
          </div>
        ):(
          <button onClick={()=>setAddingOccasion(true)} style={{width:"100%",padding:10,background:"rgba(200,169,122,0.08)",border:"1px solid rgba(200,169,122,0.2)",borderRadius:8,fontSize:12,color:"#c8a97a",fontFamily:"DM Sans,sans-serif",cursor:"pointer"}}>+ Add occasion</button>
        )}
      </div>
    )
  }

  return (
    <div>
     <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:22,fontWeight:600,color:"#faf8f4",marginBottom:4}}>Gifts & Occasions</div>
      {calSuggestions.length>0&&!calBannerDismissed&&(
        <div style={{background:"rgba(58,107,138,0.12)",border:"1px solid rgba(58,107,138,0.3)",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:600,color:"#6ba3c4",fontFamily:"DM Sans,sans-serif",marginBottom:8}}>📅 Found {calSuggestions.length} event{calSuggestions.length>1?"s":""} in your calendar</div>
          {calSuggestions.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <span style={{flex:1,fontSize:12,color:"rgba(250,248,244,0.75)",fontFamily:"DM Sans,sans-serif"}}>{s.title}</span>
              <button onClick={()=>{const occ={id:gUid(),type:s.type,date:s.date,gifts:[]};const exists=gifts.find(p=>p.name===s.name);if(exists){saveGifts(gifts.map(p=>p.name===s.name?{...p,occasions:[...(p.occasions||[]),occ]}:p))}else{saveGifts([...gifts,{id:gUid(),name:s.name,relation:"",occasions:[occ]}]);}setCalSuggestions(cs=>cs.filter((_,j)=>j!==i))}} style={{background:"#c8a97a",border:"none",borderRadius:6,padding:"4px 10px",fontSize:11,color:"#1a2744",fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:600,flexShrink:0}}>Add</button>
              <button onClick={()=>setCalSuggestions(cs=>cs.filter((_,j)=>j!==i))} style={{background:"none",border:"none",fontSize:11,color:"rgba(250,248,244,0.3)",cursor:"pointer",padding:"2px 4px"}}>✕</button>
            </div>
          ))}
          <button onClick={()=>setCalBannerDismissed(true)} style={{fontSize:11,color:"rgba(250,248,244,0.3)",background:"none",border:"none",cursor:"pointer",fontFamily:"DM Sans,sans-serif",marginTop:4}}>Dismiss all</button>
        </div>
      )}
      <div style={{fontSize:12,color:"rgba(250,248,244,0.42)",fontFamily:"DM Sans,sans-serif",marginBottom:16,lineHeight:1.5}}>Track gift ideas for everyone you care about.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
        {[{num:soonUpcoming.length,lbl:"coming up",alert:soonUpcoming.length>0},{num:totalUnbought,lbl:"to buy",alert:totalUnbought>0},{num:"$"+totalSpent.toFixed(0),lbl:"spent",alert:false}].map((s,i)=>(
          <div key={i} style={{background:s.alert?"rgba(200,131,74,0.06)":"rgba(122,158,142,0.06)",border:"1px solid "+(s.alert?"rgba(200,131,74,0.28)":"rgba(122,158,142,0.25)"),borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:20,fontWeight:700,color:s.alert?"#c8834a":"#7a9e8e",lineHeight:1}}>{s.num}</div>
            <div style={{fontSize:9,color:"rgba(250,248,244,0.4)",marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:"DM Sans,sans-serif"}}>{s.lbl}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",borderBottom:"0.5px solid rgba(255,255,255,0.08)",marginBottom:16}}>
        {["upcoming","people"].map(t=>(
          <div key={t} onClick={()=>setView(t)} style={{padding:"7px 14px",fontSize:11,cursor:"pointer",borderBottom:view===t?"2px solid #c8a97a":"2px solid transparent",color:view===t?"#c8a97a":"rgba(250,248,244,0.35)",fontFamily:"DM Sans,sans-serif",textTransform:"capitalize"}}>
            {t==="upcoming"?"Upcoming":"All People"}
          </div>
        ))}
      </div>
      {view==="upcoming"&&(
        <div>
          {soonUpcoming.length===0&&<div style={{fontSize:12,color:"rgba(250,248,244,0.3)",fontFamily:"DM Sans,sans-serif",padding:"20px 0",textAlign:"center"}}>No occasions in the next 60 days</div>}
          {soonUpcoming.map((u,i)=>(
            <div key={i} onClick={()=>{setActivePerson(u.personId);setActiveOccasion(u.occasion.id)}} style={{...gS.card,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:8,background:u.days<=7?"rgba(200,131,74,0.2)":"rgba(200,169,122,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                {u.occasion.type==="Birthday"?"🎂":u.occasion.type==="Anniversary"?"💍":u.occasion.type==="Christmas"?"🎄":"🎁"}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:"#faf8f4",fontFamily:"DM Sans,sans-serif"}}>{u.personName} — {u.occasion.type}</div>
                <div style={{fontSize:11,color:u.days<=7?"#c8834a":"rgba(250,248,244,0.4)",marginTop:2}}>{formatOccDate(u.occasion.date)} · {u.days===0?"Today!":u.days+" days away"}</div>
                {u.unbought>0&&<div style={{fontSize:10,color:"#c8834a",marginTop:2}}>{u.unbought} gift{u.unbought>1?"s":""} to buy</div>}
                {u.unbought===0&&(u.occasion.gifts||[]).length>0&&<div style={{fontSize:10,color:"#7a9e8e",marginTop:2}}>All gifts sorted ✓</div>}
              </div>
              <span style={{fontSize:12,color:"rgba(200,169,122,0.35)"}}>→</span>
            </div>
          ))}
        </div>
      )}
      {view==="people"&&(
        <div>
          {allPeople.map(person=>{
            const personData=gifts.find(p=>p.id===person.id)
            const totalOcc=(personData?.occasions||[]).length
            const nextOcc=(personData?.occasions||[]).filter(o=>o.date&&daysUntil(o.date)!==null).sort((a,b)=>daysUntil(a.date)-daysUntil(b.date))[0]
            const days=nextOcc?daysUntil(nextOcc.date):null
            return (
              <div key={person.id} onClick={()=>{setActivePerson(person.id);setView("person")}} style={{...gS.card,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(200,169,122,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#c8a97a",fontFamily:"DM Sans,sans-serif",fontWeight:700,flexShrink:0}}>{person.name[0]}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,color:"#faf8f4",fontFamily:"DM Sans,sans-serif"}}>{person.name}</div>
                  <div style={{fontSize:11,color:"rgba(250,248,244,0.4)",marginTop:2}}>
                    {totalOcc===0?"No occasions added":totalOcc+" occasion"+(totalOcc>1?"s":"")}
                    {days!==null&&days<=30&&<span style={{color:days<=7?"#c8834a":"#c8a97a",marginLeft:6}}>· next in {days}d</span>}
                  </div>
                </div>
                <span style={{fontSize:12,color:"rgba(200,169,122,0.35)"}}>→</span>
              </div>
            )
          })}
          {addingPerson?(
            <div style={gS.card}>
              <input value={newPerson.name} onChange={e=>setNewPerson(v=>({...v,name:e.target.value}))} placeholder="Name" autoFocus style={{...gS.inp,marginBottom:8}}/>
              <input value={newPerson.relation} onChange={e=>setNewPerson(v=>({...v,relation:e.target.value}))} placeholder="Relationship (e.g. Mom, Friend)" style={{...gS.inp,marginBottom:10}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={addPerson} style={gS.btn}>Add person</button>
                <button onClick={()=>setAddingPerson(false)} style={gS.ghost}>Cancel</button>
              </div>
            </div>
          ):(
            <button onClick={()=>{if(!atLimit)setAddingPerson(true)}} style={{width:"100%",padding:10,background:atLimit?"rgba(255,255,255,0.03)":"rgba(200,169,122,0.08)",border:"1px solid "+(atLimit?"rgba(255,255,255,0.08)":"rgba(200,169,122,0.2)"),borderRadius:8,fontSize:12,color:atLimit?"rgba(250,248,244,0.25)":"#c8a97a",fontFamily:"DM Sans,sans-serif",cursor:atLimit?"default":"pointer"}}>
              {atLimit?"Free limit reached — upgrade for more":"+ Add person"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}


function AnchorHome({ onNav, inventory, calEvents = [] }) {
  const lowTotal = inventory ? Object.values(inventory).flat().filter(x => !x.stocked).length : 0
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  // Live data from localStorage
  const celebrations = (() => { try { return JSON.parse(localStorage.getItem("af_celebrations") || "[]") } catch { return [] } })()
  const favorites = (() => { try { return JSON.parse(localStorage.getItem("af_favProducts") || "[]") } catch { return [] } })()

  const now = new Date(); now.setHours(0,0,0,0)
  const upcomingCelebs = celebrations.filter(c => {
    const next = new Date(now.getFullYear(), c.month-1, c.day)
    if (next < now) next.setFullYear(next.getFullYear()+1)
    return Math.round((next-now)/86400000) <= 30
  }).sort((a,b) => {
    const da = new Date(now.getFullYear(), a.month-1, a.day); if(da<now) da.setFullYear(da.getFullYear()+1)
    const db = new Date(now.getFullYear(), b.month-1, b.day); if(db<now) db.setFullYear(db.getFullYear()+1)
    return da-db
  })
  const nextCeleb = upcomingCelebs[0]
  const nextCelebDays = nextCeleb ? Math.round((new Date(now.getFullYear(), nextCeleb.month-1, nextCeleb.day) < now
    ? new Date(now.getFullYear()+1, nextCeleb.month-1, nextCeleb.day)
    : new Date(now.getFullYear(), nextCeleb.month-1, nextCeleb.day) - now) / 86400000) : null

  // Calendar events in next 30 days
  const upcomingCalEvents = (calEvents || []).map(e => {
    const d = new Date(e.date + "T12:00:00")
    const diff = Math.round((d - now) / 86400000)
    return { ...e, diff, d }
  }).filter(e => e.diff >= 0 && e.diff <= 30).sort((a,b) => a.diff - b.diff)

  // Merge celebrations + cal events for unified upcoming list
  const allUpcoming30 = [
    ...upcomingCelebs.map(c => {
      const next = new Date(now.getFullYear(), c.month-1, c.day)
      if (next < now) next.setFullYear(next.getFullYear()+1)
      return { key: c.id, emoji: CELEBRATION_TYPES.find(t=>t.id===c.type)?.emoji||"🎉", label: c.name, sub: c.type, diff: Math.round((next-now)/86400000), month: c.month, day: c.day, nav: "gifts" }
    }),
    ...upcomingCalEvents.map(e => ({ key: e.id, emoji: "📅", label: e.title, sub: "Calendar event", diff: e.diff, month: e.d.getMonth()+1, day: e.d.getDate(), nav: "home" }))
  ].sort((a,b) => a.diff - b.diff)

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const CELEB_TYPES = { birthday:"🎂", anniversary:"💍", graduation:"🎓", holiday:"🎄", wedding:"💐", babyshower:"🍼", other:"🎉" }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: "#faf8f4", marginBottom: 2 }}>Your Anchor — {today}</div>
        <div style={{ fontSize: 11, color: "rgba(250,248,244,0.38)", fontFamily: "DM Sans,sans-serif" }}>Here is what your home is telling you right now.</div>
      </div>

      {/* Live stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 18 }}>
        {[
          { num: lowTotal, lbl: "items low", alert: lowTotal > 0, nav: "inventory" },
          { num: upcomingCelebs.length, lbl: "celebrations", alert: upcomingCelebs.length > 0, nav: "gifts" },
          { num: favorites.length, lbl: "favorites", alert: false, nav: "inventory" },
        ].map((s, i) => (
          <div key={i} onClick={() => onNav(s.nav)} style={{ background: s.alert ? "rgba(200,131,74,0.06)" : "rgba(122,158,142,0.06)", border: "1px solid " + (s.alert ? "rgba(200,131,74,0.28)" : "rgba(122,158,142,0.25)"), borderRadius: 10, padding: "10px 12px", textAlign: "center", cursor: "pointer" }}>
            <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 700, color: s.alert ? "#c8834a" : "#7a9e8e", lineHeight: 1 }}>{s.num}</div>
            <div style={{ fontSize: 9, color: "rgba(250,248,244,0.4)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "DM Sans,sans-serif" }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Inventory card */}
      <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.25)", fontFamily: "DM Sans,sans-serif", marginBottom: 8 }}>
        <span style={{ background: "rgba(200,169,122,0.12)", color: "#c8a97a", fontSize: 8, padding: "1px 7px", borderRadius: 10, fontWeight: 700, letterSpacing: "0.04em" }}>Inventory & Favorites</span>
      </div>
      <div onClick={() => onNav("inventory")} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", background: lowTotal > 0 ? "rgba(200,131,74,0.1)" : "rgba(255,255,255,0.04)", border: "1px solid " + (lowTotal > 0 ? "rgba(200,131,74,0.25)" : "rgba(255,255,255,0.08)"), borderRadius: 10, marginBottom: 8, cursor: "pointer" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(200,131,74,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>📦</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{lowTotal > 0 ? lowTotal + " items running low" : "Everything stocked"}</div>
          <div style={{ fontSize: 11, color: lowTotal > 0 ? "#c8834a" : "rgba(250,248,244,0.42)", marginTop: 2 }}>{lowTotal > 0 ? "Tap to add to shopping list" : favorites.length > 0 ? favorites.length + " favorite products saved" : "Pantry & household stocked"}</div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(200,169,122,0.35)" }}>→</div>
      </div>

      {/* Celebrations card */}
      <div style={{ fontSize: 9, marginBottom: 8, marginTop: 16 }}>
        <span style={{ background: "rgba(200,131,74,0.12)", color: "#c8834a", fontSize: 8, padding: "1px 7px", borderRadius: 10, fontWeight: 700, letterSpacing: "0.04em", fontFamily: "DM Sans,sans-serif" }}>Celebrations</span>
      </div>
      <div onClick={() => onNav("gifts")} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", background: upcomingCelebs.length > 0 ? "rgba(200,131,74,0.08)" : "rgba(255,255,255,0.04)", border: "1px solid " + (upcomingCelebs.length > 0 ? "rgba(200,131,74,0.2)" : "rgba(255,255,255,0.08)"), borderRadius: 10, marginBottom: upcomingCelebs.length > 0 ? 6 : 16, cursor: "pointer" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(200,131,74,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>🎉</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>
            {nextCeleb ? (CELEB_TYPES[nextCeleb.type]||"🎉") + " " + nextCeleb.name + (nextCelebDays === 0 ? " — Today!" : nextCelebDays === 1 ? " — Tomorrow!" : " in " + nextCelebDays + " days") : "Gifts & Celebrations"}
          </div>
          <div style={{ fontSize: 11, color: "rgba(250,248,244,0.42)", marginTop: 2 }}>
            {upcomingCelebs.length > 0 ? upcomingCelebs.length + " coming up in the next 30 days" : "Birthdays, occasions and gift tracking"}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(200,169,122,0.35)" }}>→</div>
      </div>

      {/* Unified upcoming — celebrations + calendar events next 30 days */}
      {allUpcoming30.slice(0,5).map((e,i) => (
        <div key={e.key||i} onClick={() => onNav(e.nav)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, marginBottom: 5, cursor: "pointer" }}>
          <span style={{ fontSize: 14 }}>{e.emoji}</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", fontWeight: 500 }}>{e.label}</span>
            <span style={{ fontSize: 11, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", marginLeft: 6 }}>{MONTHS[e.month-1]} {e.day}</span>
          </div>
          <span style={{ fontSize: 11, color: e.diff <= 7 ? "#c8834a" : "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", fontWeight: e.diff <= 7 ? 600 : 400 }}>{e.diff === 0 ? "Today!" : e.diff === 1 ? "Tomorrow" : "in " + e.diff + "d"}</span>
        </div>
      ))}

      {/* Pets card */}
      {(() => {
        const petList = (() => { try { return JSON.parse(localStorage.getItem("af_pets")||"[]") } catch { return [] } })()
        if (!petList.length) return null
        const now = new Date()
        const alerts = petList.flatMap(p => (p.vaccines||[]).filter(v => v.due && Math.round((new Date(v.due)-now)/86400000) <= 14).map(v => ({pet:p.name, vaccine:v.name, days:Math.round((new Date(v.due)-now)/86400000)})))
        return (
          <div>
            <div style={{ fontSize: 9, marginBottom: 8, marginTop: 16 }}>
              <span style={{ background: "rgba(122,158,142,0.15)", color: "#7a9e8e", fontSize: 8, padding: "1px 7px", borderRadius: 10, fontWeight: 700, letterSpacing: "0.04em", fontFamily: "DM Sans,sans-serif" }}>Pets</span>
            </div>
            <div onClick={() => onNav("pets")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: alerts.length ? "rgba(200,169,122,0.08)" : "rgba(255,255,255,0.04)", border: "1px solid " + (alerts.length ? "rgba(200,169,122,0.2)" : "rgba(255,255,255,0.08)"), borderRadius: 10, marginBottom: alerts.length ? 6 : 16, cursor: "pointer" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(122,158,142,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>🐾</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{petList.map(p=>p.name).join(", ")}</div>
                <div style={{ fontSize: 11, color: "rgba(250,248,244,0.42)", marginTop: 2 }}>{alerts.length ? alerts.length + " vaccine" + (alerts.length>1?"s":"") + " due soon" : "All up to date"}</div>
              </div>
              <div style={{ fontSize: 12, color: "rgba(200,169,122,0.35)" }}>→</div>
            </div>
            {alerts.slice(0,2).map((a,i) => (
              <div key={i} onClick={() => onNav("pets")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, marginBottom: 5, cursor: "pointer" }}>
                <span style={{ fontSize: 13 }}>💉</span>
                <span style={{ fontSize: 12, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", flex: 1 }}>{a.pet} — {a.vaccine}</span>
                <span style={{ fontSize: 11, color: a.days < 0 ? "#e88" : "#c8a97a", fontFamily: "DM Sans,sans-serif" }}>{a.days < 0 ? Math.abs(a.days)+"d overdue" : a.days+"d"}</span>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Premium feeds */}
      <div style={{ marginTop: 20 }}>
      {[
        { src: "Career & Docs", srcColor: "#7a9e8e", srcBg: "rgba(122,158,142,0.15)", icon: "📋", title: "Driver's license expires in 47 days", sub: "June 17 — schedule renewal", badge: "47 days", badgeColor: "#6ba3c4", badgeBg: "rgba(58,107,138,0.15)" },
        { src: "Health", srcColor: "#6ba3c4", srcBg: "rgba(58,107,138,0.15)", icon: "🩺", title: "Annual checkup — no date set", sub: "Last visit was 14 months ago", badge: "Overdue", badgeColor: "#6ba3c4", badgeBg: "rgba(58,107,138,0.15)" },
      ].map((item, i) => (
        <div key={i} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, marginBottom: 7, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: item.srcBg, color: item.srcColor, fontSize: 8, padding: "1px 7px", borderRadius: 10, fontWeight: 700, letterSpacing: "0.04em", fontFamily: "DM Sans,sans-serif" }}>{item.src}</span>
            <span style={{ background: "rgba(255,255,255,0.06)", color: "rgba(250,248,244,0.25)", fontSize: 8, padding: "1px 7px", borderRadius: 10, fontFamily: "DM Sans,sans-serif" }}>Premium</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, opacity: 0.75 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(250,248,244,0.45)", fontFamily: "DM Sans,sans-serif" }}>{item.title}</div>
              <div style={{ fontSize: 11, color: "rgba(250,248,244,0.3)", marginTop: 2 }}>{item.sub}</div>
              <div style={{ marginTop: 5 }}><span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, fontWeight: 600, background: item.badgeBg, color: item.badgeColor, fontFamily: "DM Sans,sans-serif", opacity: 0.6 }}>{item.badge}</span></div>
            </div>
            <span style={{ fontSize: 9, color: "rgba(250,248,244,0.2)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "2px 8px", fontFamily: "DM Sans,sans-serif", alignSelf: "center" }}>Premium</span>
          </div>
        </div>
      ))}

      {/* Upgrade strip */}
      <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.15)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
        <div style={{ fontSize: 11, color: "rgba(250,248,244,0.5)", lineHeight: 1.5, flex: 1, fontStyle: "italic", fontFamily: "DM Sans,sans-serif" }}>"You have a license expiring, a birthday in 6 days, and a checkup overdue — and you didn't have to remember any of it."</div>
        <button style={{ background: "#c8a97a", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 11, fontWeight: 500, color: "#1a2744", fontFamily: "DM Sans,sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>Unlock full vault</button>
      </div>
      </div>
    </div>
  )
}
// ── Gifts & Celebrations Combined ────────────────────────────────────────────
function GiftsAndCelebrations({ calEvents = [] }) {
  const [tab, setTab] = useState("celebrations")

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(255,255,255,0.1)", marginBottom: 20 }}>
        {[["celebrations","🎉 Celebrations"],["gifts","🎁 Celebrate"]].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)} style={{ background: "none", border: "none", borderBottom: tab===v ? "2px solid #c8a97a" : "2px solid transparent", padding: "9px 16px", fontSize: 13, color: tab===v ? "#c8a97a" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: tab===v ? 700 : 400 }}>{l}</button>
        ))}
      </div>
      {tab === "celebrations" && <CelebrationsSection calEvents={calEvents} />}
      {tab === "gifts" && <GiftsSection people={[]} isPremium={false} calEvents={calEvents} />}
    </div>
  )
}


// ── Pets Section ─────────────────────────────────────────────────────────────
const VACCINE_LIST = ["Rabies","DHPP/DA2PP","Bordetella","Leptospirosis","Lyme","Canine Influenza","FVRCP","FeLV","Other"]
const PET_TYPES = ["Dog","Cat","Bird","Rabbit","Fish","Reptile","Other"]

function PetsSection() {
  const [pets, setPets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("af_pets") || "[]") } catch { return [] }
  })
  const [activePetId, setActivePetId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newPetForm, setNewPetForm] = useState({ name: "", type: "Dog", breed: "", color: "", dob: "", photo: null })
  const [addingVaccine, setAddingVaccine] = useState(false)
  const [vaccineForm, setVaccineForm] = useState({ name: "Rabies", date: "", due: "", vet: "", notes: "" })
  const [addingMed, setAddingMed] = useState(false)
  const [medForm, setMedForm] = useState({ name: "", dose: "", freq: "", refill: "", notes: "" })
  const [editingField, setEditingField] = useState(null)
  const [editVal, setEditVal] = useState("")

  const save = (updated) => {
    setPets(updated)
    try { localStorage.setItem("af_pets", JSON.stringify(updated)) } catch {}
  }

  const activePet = pets.find(p => p.id === activePetId)

  const addPet = () => {
    if (!newPetForm.name.trim()) return
    const pet = { id: Date.now().toString(), ...newPetForm, vaccines: [], medications: [], tags: { rabies: "", chip: "", registration: "" }, notes: "" }
    const updated = [...pets, pet]
    save(updated)
    setActivePetId(pet.id)
    setAdding(false)
    setNewPetForm({ name: "", type: "Dog", breed: "", color: "", dob: "", photo: null })
  }

  const updatePet = (id, changes) => save(pets.map(p => p.id === id ? {...p, ...changes} : p))
  const addVaccine = (petId) => {
    if (!vaccineForm.name) return
    const v = { id: Date.now().toString(), ...vaccineForm }
    updatePet(petId, { vaccines: [...(activePet.vaccines||[]), v] })
    setVaccineForm({ name: "Rabies", date: "", due: "", vet: "", notes: "" })
    setAddingVaccine(false)
  }
  const addMed = (petId) => {
    if (!medForm.name.trim()) return
    const m = { id: Date.now().toString(), ...medForm }
    updatePet(petId, { medications: [...(activePet.medications||[]), m] })
    setMedForm({ name: "", dose: "", freq: "", refill: "", notes: "" })
    setAddingMed(false)
  }

  const handlePhoto = (e, petId) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => updatePet(petId, { photo: reader.result })
    reader.readAsDataURL(file)
  }

  const now = new Date()
  const daysUntil = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return Math.round((d - now) / 86400000)
  }

  const s = { fontFamily: "DM Sans,sans-serif" }
  const navy = "#1a2744"
  const sand = "#c8a97a"
  const warm = "#faf8f4"
  const muted = "rgba(250,248,244,0.42)"
  const border = "rgba(255,255,255,0.08)"
  const cardBg = "rgba(255,255,255,0.04)"
  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: warm, fontFamily: "DM Sans,sans-serif", outline: "none", boxSizing: "border-box" }
  const labelStyle = { fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", marginBottom: 4, display: "block" }

  if (!activePet) return (
    <div>
      <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: warm, marginBottom: 4 }}>Pets</div>
      <div style={{ fontSize: 12, color: muted, ...s, marginBottom: 20 }}>Health records, vaccines, medications and tags — all in one place.</div>

      {/* Pet list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {pets.map(pet => {
          const upcoming = (pet.vaccines||[]).filter(v => v.due && daysUntil(v.due) !== null && daysUntil(v.due) <= 30 && daysUntil(v.due) >= 0)
          const overdue = (pet.vaccines||[]).filter(v => v.due && daysUntil(v.due) !== null && daysUntil(v.due) < 0)
          return (
            <div key={pet.id} onClick={() => setActivePetId(pet.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: cardBg, border: `1px solid ${border}`, borderRadius: 12, cursor: "pointer" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(200,169,122,0.15)", border: `1.5px solid rgba(200,169,122,0.3)`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {pet.photo ? <img src={pet.photo} alt={pet.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 22 }}>{pet.type==="Cat"?"🐱":pet.type==="Bird"?"🐦":pet.type==="Rabbit"?"🐰":"🐾"}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: warm, ...s }}>{pet.name}</div>
                <div style={{ fontSize: 11, color: muted, ...s }}>{pet.type}{pet.breed ? " · " + pet.breed : ""}</div>
                {(upcoming.length > 0 || overdue.length > 0) && (
                  <div style={{ marginTop: 4 }}>
                    {overdue.length > 0 && <span style={{ fontSize: 10, background: "rgba(200,80,80,0.15)", color: "#e88", border: "1px solid rgba(200,80,80,0.3)", borderRadius: 20, padding: "1px 8px", ...s, marginRight: 4 }}>⚠ {overdue.length} overdue</span>}
                    {upcoming.length > 0 && <span style={{ fontSize: 10, background: "rgba(200,169,122,0.12)", color: sand, border: "1px solid rgba(200,169,122,0.25)", borderRadius: 20, padding: "1px 8px", ...s }}>📅 {upcoming.length} due soon</span>}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: "rgba(200,169,122,0.35)" }}>→</div>
            </div>
          )
        })}
      </div>

      {/* Add pet form */}
      {adding ? (
        <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: warm, ...s, marginBottom: 14 }}>New pet</div>
          <label style={labelStyle}>Name *</label>
          <input value={newPetForm.name} onChange={e => setNewPetForm(p=>({...p,name:e.target.value}))} placeholder="Pet's name" style={{...inputStyle, marginBottom: 10}} />
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Type</label>
              <select value={newPetForm.type} onChange={e => setNewPetForm(p=>({...p,type:e.target.value}))} style={{...inputStyle}}>
                {PET_TYPES.map(t => <option key={t} value={t} style={{background:navy}}>{t}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Breed</label>
              <input value={newPetForm.breed} onChange={e => setNewPetForm(p=>({...p,breed:e.target.value}))} placeholder="Optional" style={{...inputStyle}} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Color / markings</label>
              <input value={newPetForm.color} onChange={e => setNewPetForm(p=>({...p,color:e.target.value}))} placeholder="e.g. Black & white" style={{...inputStyle}} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date of birth</label>
              <input type="date" value={newPetForm.dob} onChange={e => setNewPetForm(p=>({...p,dob:e.target.value}))} style={{...inputStyle}} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addPet} style={{ flex: 1, background: sand, border: "none", borderRadius: 8, padding: "9px", fontSize: 13, color: navy, ...s, cursor: "pointer", fontWeight: 700 }}>Add pet</button>
            <button onClick={() => setAdding(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: muted, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ width: "100%", padding: 12, background: "rgba(200,169,122,0.07)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 10, fontSize: 13, color: sand, ...s, cursor: "pointer", fontWeight: 500 }}>+ Add a pet</button>
      )}
    </div>
  )

  // Pet detail view
  const vaccines = activePet.vaccines || []
  const medications = activePet.medications || []
  const tags = activePet.tags || {}

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => setActivePetId(null)} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 13, ...s, padding: "4px 0" }}>← All pets</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: warm }}>{activePet.name}</div>
          <div style={{ fontSize: 11, color: muted, ...s }}>{activePet.type}{activePet.breed ? " · " + activePet.breed : ""}{activePet.dob ? " · born " + new Date(activePet.dob).getFullYear() : ""}</div>
        </div>
        <button onClick={() => save(pets.filter(p => p.id !== activePetId)) || setActivePetId(null)} style={{ background: "none", border: "none", color: "rgba(200,80,80,0.4)", cursor: "pointer", fontSize: 11, ...s }}>remove</button>
      </div>

      {/* Photo */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px" }}>
        <div style={{ width: 72, height: 72, borderRadius: 12, background: "rgba(200,169,122,0.12)", border: "1.5px solid rgba(200,169,122,0.25)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {activePet.photo ? <img src={activePet.photo} alt={activePet.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 32 }}>{activePet.type==="Cat"?"🐱":activePet.type==="Bird"?"🐦":activePet.type==="Rabbit"?"🐰":"🐾"}</span>}
        </div>
        <div>
          <div style={{ fontSize: 12, color: muted, ...s, marginBottom: 6 }}>Pet photo</div>
          <label style={{ background: "rgba(200,169,122,0.12)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 7, padding: "5px 12px", fontSize: 11, color: sand, ...s, cursor: "pointer", fontWeight: 600 }}>
            {activePet.photo ? "Change photo" : "Upload photo"}
            <input type="file" accept="image/*" onChange={e => handlePhoto(e, activePet.id)} style={{ display: "none" }} />
          </label>
          {activePet.photo && <button onClick={() => updatePet(activePet.id, { photo: null })} style={{ background: "none", border: "none", color: "rgba(200,80,80,0.4)", fontSize: 11, cursor: "pointer", ...s, marginLeft: 8 }}>Remove</button>}
        </div>
      </div>

      {/* ID Tags */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.25)", ...s, marginBottom: 8 }}>🏷 ID & Registration</div>
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { key: "rabies", label: "Rabies tag #" },
            { key: "chip", label: "Microchip #" },
            { key: "registration", label: "Registration #" },
          ].map(f => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "rgba(250,248,244,0.3)", ...s, marginBottom: 2 }}>{f.label}</div>
                {editingField === f.key ? (
                  <input value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => { updatePet(activePet.id, { tags: {...tags, [f.key]: editVal} }); setEditingField(null); }} autoFocus style={{...inputStyle, padding: "4px 8px", fontSize: 12}} />
                ) : (
                  <div style={{ fontSize: 13, color: tags[f.key] ? warm : "rgba(250,248,244,0.2)", ...s, fontStyle: tags[f.key] ? "normal" : "italic" }}>{tags[f.key] || "Not set"}</div>
                )}
              </div>
              <button onClick={() => { setEditingField(f.key); setEditVal(tags[f.key]||""); }} style={{ background: "rgba(200,169,122,0.1)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 6, padding: "3px 9px", fontSize: 10, color: sand, ...s, cursor: "pointer" }}>edit</button>
            </div>
          ))}
        </div>
      </div>

      {/* Vaccines */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.25)", ...s }}>💉 Vaccines</div>
          <button onClick={() => setAddingVaccine(p=>!p)} style={{ background: "rgba(200,169,122,0.1)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 7, padding: "3px 10px", fontSize: 11, color: sand, ...s, cursor: "pointer", fontWeight: 600 }}>+ Add</button>
        </div>

        {addingVaccine && (
          <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.18)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>Vaccine</label>
                <select value={vaccineForm.name} onChange={e => setVaccineForm(p=>({...p,name:e.target.value}))} style={{...inputStyle}}>
                  {VACCINE_LIST.map(v => <option key={v} value={v} style={{background:navy}}>{v}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Date given</label>
                <input type="date" value={vaccineForm.date} onChange={e => setVaccineForm(p=>({...p,date:e.target.value}))} style={{...inputStyle}} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Due date</label>
                <input type="date" value={vaccineForm.due} onChange={e => setVaccineForm(p=>({...p,due:e.target.value}))} style={{...inputStyle}} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Vet / clinic</label>
                <input value={vaccineForm.vet} onChange={e => setVaccineForm(p=>({...p,vet:e.target.value}))} placeholder="Optional" style={{...inputStyle}} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Notes</label>
                <input value={vaccineForm.notes} onChange={e => setVaccineForm(p=>({...p,notes:e.target.value}))} placeholder="Optional" style={{...inputStyle}} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => addVaccine(activePet.id)} style={{ flex: 1, background: sand, border: "none", borderRadius: 7, padding: "7px", fontSize: 12, color: navy, ...s, cursor: "pointer", fontWeight: 700 }}>Save</button>
              <button onClick={() => setAddingVaccine(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: muted, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {vaccines.length === 0 && !addingVaccine ? (
          <div style={{ fontSize: 12, color: "rgba(250,248,244,0.25)", fontStyle: "italic", ...s, padding: "8px 0" }}>No vaccines recorded yet.</div>
        ) : vaccines.map(v => {
          const days = daysUntil(v.due)
          const overdue = days !== null && days < 0
          const soon = days !== null && days >= 0 && days <= 30
          return (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: overdue ? "rgba(200,80,80,0.07)" : soon ? "rgba(200,169,122,0.07)" : cardBg, border: `1px solid ${overdue ? "rgba(200,80,80,0.2)" : soon ? "rgba(200,169,122,0.2)" : border}`, borderRadius: 9, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: warm, ...s }}>{v.name}</div>
                <div style={{ fontSize: 11, color: muted, ...s }}>
                  {v.date && "Given: " + v.date}{v.vet && " · " + v.vet}
                </div>
              </div>
              {v.due && (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: muted, ...s }}>Due</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: overdue ? "#e88" : soon ? sand : muted, ...s }}>
                    {overdue ? Math.abs(days) + "d overdue" : days === 0 ? "Today!" : days + "d"}
                  </div>
                </div>
              )}
              <button onClick={() => updatePet(activePet.id, { vaccines: vaccines.filter(x => x.id !== v.id) })} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.25, fontSize: 13, color: warm, padding: "2px 4px" }}>✕</button>
            </div>
          )
        })}
      </div>

      {/* Medications */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.25)", ...s }}>💊 Medications</div>
          <button onClick={() => setAddingMed(p=>!p)} style={{ background: "rgba(200,169,122,0.1)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 7, padding: "3px 10px", fontSize: 11, color: sand, ...s, cursor: "pointer", fontWeight: 600 }}>+ Add</button>
        </div>

        {addingMed && (
          <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.18)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <input value={medForm.name} onChange={e => setMedForm(p=>({...p,name:e.target.value}))} placeholder="Medication name *" style={{...inputStyle, marginBottom: 8}} />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={medForm.dose} onChange={e => setMedForm(p=>({...p,dose:e.target.value}))} placeholder="Dose (e.g. 25mg)" style={{...inputStyle, flex:1}} />
              <input value={medForm.freq} onChange={e => setMedForm(p=>({...p,freq:e.target.value}))} placeholder="Frequency (e.g. daily)" style={{...inputStyle, flex:1}} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input type="date" value={medForm.refill} onChange={e => setMedForm(p=>({...p,refill:e.target.value}))} placeholder="Refill date" style={{...inputStyle, flex:1}} />
              <input value={medForm.notes} onChange={e => setMedForm(p=>({...p,notes:e.target.value}))} placeholder="Notes" style={{...inputStyle, flex:1}} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => addMed(activePet.id)} style={{ flex: 1, background: sand, border: "none", borderRadius: 7, padding: "7px", fontSize: 12, color: navy, ...s, cursor: "pointer", fontWeight: 700 }}>Save</button>
              <button onClick={() => setAddingMed(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: muted, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {medications.length === 0 && !addingMed ? (
          <div style={{ fontSize: 12, color: "rgba(250,248,244,0.25)", fontStyle: "italic", ...s, padding: "8px 0" }}>No medications recorded.</div>
        ) : medications.map(m => {
          const refillDays = daysUntil(m.refill)
          return (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: cardBg, border: `1px solid ${refillDays !== null && refillDays <= 7 ? "rgba(200,169,122,0.3)" : border}`, borderRadius: 9, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: warm, ...s }}>{m.name}</div>
                <div style={{ fontSize: 11, color: muted, ...s }}>{m.dose}{m.freq ? " · " + m.freq : ""}{m.notes ? " · " + m.notes : ""}</div>
              </div>
              {m.refill && (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: muted, ...s }}>Refill</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: refillDays !== null && refillDays <= 7 ? sand : muted, ...s }}>
                    {refillDays !== null && refillDays <= 0 ? "Now!" : refillDays + "d"}
                  </div>
                </div>
              )}
              <button onClick={() => updatePet(activePet.id, { medications: medications.filter(x => x.id !== m.id) })} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.25, fontSize: 13, color: warm, padding: "2px 4px" }}>✕</button>
            </div>
          )
        })}
      </div>

      {/* Notes */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.25)", ...s, marginBottom: 8 }}>📝 Notes</div>
        <textarea value={activePet.notes || ""} onChange={e => updatePet(activePet.id, { notes: e.target.value })} placeholder="Vet info, allergies, special care notes…" rows={3} style={{ width: "100%", background: cardBg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: warm, fontFamily: "DM Sans,sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
      </div>
    </div>
  )
}

// ── Subscriptions Section ─────────────────────────────────────────────────────
function SubscriptionsSection() {
  var GOLD = "#c8a97a"; var NAVY = "#1a2744"; var WHITE = "#faf8f4"
  var SURF = "rgba(255,255,255,0.04)"; var BORD = "0.5px solid rgba(255,255,255,0.08)"
  var SAGE = "#7a9e8e"; var BLUE = "#6ba3c4"
  var CYCLES = ["monthly","yearly","weekly","quarterly"]
  var PERK_TYPES = ["Kids eat free","Military discount","Student discount","Senior discount","AAA discount","Other"]
  function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || "null") || def } catch { return def } }
  function persist(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }
  var [subs, setSubs] = React.useState(function() { return load("af_subs", []) })
  var [coupons, setCoupons] = React.useState(function() { return load("af_coupons", []) })
  var [perks, setPerks] = React.useState(function() { return load("af_perks", []) })
  var [tab, setTab] = React.useState("subs")
  var [modal, setModal] = React.useState(null)
  var [form, setForm] = React.useState({})
  function saveSubs(v) { setSubs(v); persist("af_subs", v) }
  function saveCoupons(v) { setCoupons(v); persist("af_coupons", v) }
  function savePerks(v) { setPerks(v); persist("af_perks", v) }
  function openAdd(type) { setModal(type); setForm({}) }
  function closeModal() { setModal(null); setForm({}) }
  function addSub() {
    if (!form.name) return
    var item = { id: Date.now().toString(), name: form.name, cycle: form.cycle||"monthly", amount: parseFloat(form.amount)||0, website: form.website||"", renewDate: form.renewDate||"" }
    saveSubs([...subs, item]); closeModal()
  }
  function deleteSub(id) { saveSubs(subs.filter(function(s) { return s.id !== id })) }
  function addCoupon() {
    if (!form.name) return
    var item = { id: Date.now().toString(), name: form.name, amount: form.amount||"", expires: form.expires||"", notes: form.notes||"", used: false }
    saveCoupons([...coupons, item]); closeModal()
  }
  function toggleCouponUsed(id) { saveCoupons(coupons.map(function(c) { return c.id===id ? Object.assign({},c,{used:!c.used}) : c })) }
  function deleteCoupon(id) { saveCoupons(coupons.filter(function(c) { return c.id !== id })) }
  function addPerk() {
    if (!form.name) return
    var item = { id: Date.now().toString(), type: form.type||"Other", name: form.name, detail: form.detail||"", notes: form.notes||"" }
    savePerks([...perks, item]); closeModal()
  }
  function deletePerk(id) { savePerks(perks.filter(function(p) { return p.id !== id })) }
  var monthly = subs.reduce(function(acc, s) {
    if (s.cycle==="monthly") return acc+(s.amount||0)
    if (s.cycle==="yearly") return acc+(s.amount||0)/12
    if (s.cycle==="weekly") return acc+(s.amount||0)*4.33
    if (s.cycle==="quarterly") return acc+(s.amount||0)/3
    return acc
  }, 0)
  var inp = { background: "rgba(255,255,255,0.06)", border: BORD, borderRadius: 8, padding: "9px 12px", color: WHITE, fontFamily: "DM Sans,sans-serif", fontSize: 13, width: "100%", outline: "none" }
  var lbl = { fontSize: 11, color: "rgba(250,248,244,0.5)", marginBottom: 4, display: "block", fontFamily: "DM Sans,sans-serif" }
  var tabBtn = function(id) { return { background: tab===id ? "rgba(200,169,122,0.15)" : "transparent", border: tab===id ? "0.5px solid rgba(200,169,122,0.35)" : BORD, borderRadius: 20, padding: "5px 14px", color: tab===id ? GOLD : "rgba(250,248,244,0.45)", fontSize: 12, fontFamily: "DM Sans,sans-serif", cursor: "pointer" } }
  var addBtnStyle = { background: "rgba(200,169,122,0.08)", border: "0.5px dashed rgba(200,169,122,0.3)", borderRadius: 10, padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", width: "100%" }
  var cardStyle = { background: SURF, border: BORD, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }
  var modalBg = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }
  var modalBox = { background: "#1e2e50", border: "0.5px solid rgba(200,169,122,0.2)", borderRadius: 16, padding: "20px", width: "100%", maxWidth: 380 }
  return React.createElement("div", { style: { paddingBottom: "2rem" } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } },
      React.createElement("div", null,
        React.createElement("div", { style: { fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 700, color: WHITE } }, "Subscriptions"),
        React.createElement("div", { style: { fontSize: 12, color: "rgba(250,248,244,0.5)", marginTop: 2 } }, "Track what you pay, save & earn")
      )
    ),
    React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" } },
      React.createElement("button", { style: tabBtn("subs"), onClick: function() { setTab("subs") } }, "Subscriptions"),
      React.createElement("button", { style: tabBtn("coupons"), onClick: function() { setTab("coupons") } }, "Coupons"),
      React.createElement("button", { style: tabBtn("perks"), onClick: function() { setTab("perks") } }, "Perks & Discounts")
    ),
    tab === "subs" && React.createElement("div", null,
      subs.length > 0 && React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 } },
        React.createElement("div", { style: { background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(200,169,122,0.15)", borderRadius: 10, padding: "10px 12px" } },
          React.createElement("div", { style: { fontSize: 10, color: "rgba(250,248,244,0.45)", marginBottom: 3, fontFamily: "DM Sans,sans-serif" } }, "Monthly total"),
          React.createElement("div", { style: { fontSize: 20, fontWeight: 500, color: WHITE, fontFamily: "DM Sans,sans-serif" } }, "$" + monthly.toFixed(2))
        ),
        React.createElement("div", { style: { background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(200,169,122,0.15)", borderRadius: 10, padding: "10px 12px" } },
          React.createElement("div", { style: { fontSize: 10, color: "rgba(250,248,244,0.45)", marginBottom: 3, fontFamily: "DM Sans,sans-serif" } }, "Yearly total"),
          React.createElement("div", { style: { fontSize: 20, fontWeight: 500, color: WHITE, fontFamily: "DM Sans,sans-serif" } }, "$" + (monthly*12).toFixed(2))
        )
      ),
      subs.map(function(s) {
        return React.createElement("div", { key: s.id, style: cardStyle },
          React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: "DM Sans,sans-serif" } }, s.name),
              React.createElement("div", { style: { fontSize: 11, color: "rgba(250,248,244,0.45)", marginTop: 2, fontFamily: "DM Sans,sans-serif", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
                React.createElement("span", null, s.cycle),
                s.website && React.createElement("a", { href: s.website.startsWith("http") ? s.website : "https://"+s.website, target: "_blank", rel: "noopener noreferrer", style: { color: BLUE, fontSize: 10 } }, "↗ website"),
                s.renewDate && React.createElement("span", { style: { fontSize: 9, padding: "2px 6px", borderRadius: 20, background: "rgba(239,159,39,0.15)", color: "#EF9F27", border: "0.5px solid rgba(239,159,39,0.3)" } }, "Renews " + s.renewDate)
              )
            ),
            React.createElement("div", { style: { textAlign: "right", flexShrink: 0, marginLeft: 12 } },
              React.createElement("div", { style: { fontSize: 16, fontWeight: 600, color: WHITE, fontFamily: "DM Sans,sans-serif" } }, "$" + (s.amount||0).toFixed(2)),
              React.createElement("button", { onClick: function() { deleteSub(s.id) }, style: { background: "none", border: "none", color: "rgba(250,248,244,0.25)", cursor: "pointer", fontSize: 11, fontFamily: "DM Sans,sans-serif" } }, "remove")
            )
          )
        )
      }),
      React.createElement("button", { style: addBtnStyle, onClick: function() { openAdd("sub") } },
        React.createElement("span", { style: { fontSize: 16, color: GOLD } }, "+"),
        React.createElement("span", { style: { fontSize: 13, color: GOLD, fontFamily: "DM Sans,sans-serif" } }, "Add subscription")
      )
    ),
    tab === "coupons" && React.createElement("div", null,
      coupons.length === 0 && React.createElement("div", { style: { textAlign: "center", padding: "32px 0", color: "rgba(250,248,244,0.35)", fontSize: 13, fontFamily: "DM Sans,sans-serif" } }, "No coupons yet — add Kohl's Cash, store credit, rewards..."),
      coupons.map(function(c) {
        return React.createElement("div", { key: c.id, style: Object.assign({}, cardStyle, { opacity: c.used ? 0.45 : 1 }) },
          React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
            React.createElement("div", { style: { flex: 1 } },
              React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: "DM Sans,sans-serif", textDecoration: c.used ? "line-through" : "none" } }, c.name),
              c.expires && React.createElement("div", { style: { fontSize: 11, color: "rgba(250,248,244,0.45)", marginTop: 2, fontFamily: "DM Sans,sans-serif" } }, "Use by " + c.expires),
              c.notes && React.createElement("div", { style: { fontSize: 11, color: "rgba(250,248,244,0.4)", marginTop: 2, fontFamily: "DM Sans,sans-serif" } }, c.notes)
            ),
            React.createElement("div", { style: { textAlign: "right", flexShrink: 0, marginLeft: 12 } },
              c.amount && React.createElement("div", { style: { fontSize: 18, fontWeight: 600, color: SAGE, fontFamily: "DM Sans,sans-serif" } }, c.amount),
              React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 4, justifyContent: "flex-end" } },
                React.createElement("button", { onClick: function() { toggleCouponUsed(c.id) }, style: { background: "none", border: "0.5px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "2px 8px", color: "rgba(250,248,244,0.45)", cursor: "pointer", fontSize: 11, fontFamily: "DM Sans,sans-serif" } }, c.used ? "unmark" : "used"),
                React.createElement("button", { onClick: function() { deleteCoupon(c.id) }, style: { background: "none", border: "none", color: "rgba(250,248,244,0.25)", cursor: "pointer", fontSize: 11, fontFamily: "DM Sans,sans-serif" } }, "✕")
              )
            )
          )
        )
      }),
      React.createElement("button", { style: addBtnStyle, onClick: function() { openAdd("coupon") } },
        React.createElement("span", { style: { fontSize: 16, color: GOLD } }, "+"),
        React.createElement("span", { style: { fontSize: 13, color: GOLD, fontFamily: "DM Sans,sans-serif" } }, "Add coupon or store credit")
      )
    ),
    tab === "perks" && React.createElement("div", null,
      perks.length === 0 && React.createElement("div", { style: { textAlign: "center", padding: "32px 0", color: "rgba(250,248,244,0.35)", fontSize: 13, fontFamily: "DM Sans,sans-serif" } }, "Record kids eat free spots, military discounts, and more..."),
      perks.map(function(p) {
        return React.createElement("div", { key: p.id, style: Object.assign({}, cardStyle, { background: "rgba(107,163,196,0.07)", border: "0.5px solid rgba(107,163,196,0.2)" }) },
          React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between" } },
            React.createElement("div", { style: { flex: 1 } },
              React.createElement("div", { style: { fontSize: 9, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3, fontFamily: "DM Sans,sans-serif" } }, p.type),
              React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: "DM Sans,sans-serif" } }, p.name),
              p.detail && React.createElement("div", { style: { fontSize: 12, color: "rgba(250,248,244,0.5)", marginTop: 3, fontFamily: "DM Sans,sans-serif" } }, p.detail),
              p.notes && React.createElement("div", { style: { fontSize: 11, color: "rgba(250,248,244,0.4)", marginTop: 2, fontFamily: "DM Sans,sans-serif" } }, p.notes)
            ),
            React.createElement("button", { onClick: function() { deletePerk(p.id) }, style: { background: "none", border: "none", color: "rgba(250,248,244,0.25)", cursor: "pointer", fontSize: 14, marginLeft: 8 } }, "✕")
          )
        )
      }),
      React.createElement("button", { style: addBtnStyle, onClick: function() { openAdd("perk") } },
        React.createElement("span", { style: { fontSize: 16, color: GOLD } }, "+"),
        React.createElement("span", { style: { fontSize: 13, color: GOLD, fontFamily: "DM Sans,sans-serif" } }, "Add perk or discount")
      )
    ),
    modal && React.createElement("div", { style: modalBg, onClick: function(e) { if (e.target === e.currentTarget) closeModal() } },
      React.createElement("div", { style: modalBox },
        React.createElement("div", { style: { fontFamily: "Cormorant Garamond,serif", fontSize: 18, fontWeight: 700, color: WHITE, marginBottom: 16 } },
          modal === "sub" ? "Add subscription" : modal === "coupon" ? "Add coupon / store credit" : "Add perk or discount"
        ),
        modal === "sub" && React.createElement("div", null,
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Service name"), React.createElement("input", { style: inp, placeholder: "e.g. Netflix, Spotify", value: form.name||"", onChange: function(e) { setForm(Object.assign({},form,{name:e.target.value})) } })),
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 } },
            React.createElement("div", null, React.createElement("label", { style: lbl }, "Amount ($)"), React.createElement("input", { style: inp, type: "number", placeholder: "0.00", value: form.amount||"", onChange: function(e) { setForm(Object.assign({},form,{amount:e.target.value})) } })),
            React.createElement("div", null, React.createElement("label", { style: lbl }, "Billing cycle"),
              React.createElement("select", { style: inp, value: form.cycle||"monthly", onChange: function(e) { setForm(Object.assign({},form,{cycle:e.target.value})) } },
                CYCLES.map(function(c) { return React.createElement("option", { key: c, value: c }, c) })
              )
            )
          ),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Website (optional)"), React.createElement("input", { style: inp, placeholder: "e.g. netflix.com", value: form.website||"", onChange: function(e) { setForm(Object.assign({},form,{website:e.target.value})) } })),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Renewal date (optional)"), React.createElement("input", { style: inp, type: "date", value: form.renewDate||"", onChange: function(e) { setForm(Object.assign({},form,{renewDate:e.target.value})) } }))
        ),
        modal === "coupon" && React.createElement("div", null,
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Name"), React.createElement("input", { style: inp, placeholder: "e.g. Kohl's Cash, Target Circle", value: form.name||"", onChange: function(e) { setForm(Object.assign({},form,{name:e.target.value})) } })),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Amount or value"), React.createElement("input", { style: inp, placeholder: "e.g. $30 or 20% off", value: form.amount||"", onChange: function(e) { setForm(Object.assign({},form,{amount:e.target.value})) } })),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Use by date"), React.createElement("input", { style: inp, type: "date", value: form.expires||"", onChange: function(e) { setForm(Object.assign({},form,{expires:e.target.value})) } })),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Notes (optional)"), React.createElement("input", { style: inp, placeholder: "e.g. in-store or online, app required", value: form.notes||"", onChange: function(e) { setForm(Object.assign({},form,{notes:e.target.value})) } }))
        ),
        modal === "perk" && React.createElement("div", null,
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Type"),
            React.createElement("select", { style: inp, value: form.type||"Other", onChange: function(e) { setForm(Object.assign({},form,{type:e.target.value})) } },
              PERK_TYPES.map(function(t) { return React.createElement("option", { key: t, value: t }, t) })
            )
          ),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Where / Name"), React.createElement("input", { style: inp, placeholder: "e.g. Chick-fil-A, Home Depot", value: form.name||"", onChange: function(e) { setForm(Object.assign({},form,{name:e.target.value})) } })),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Details"), React.createElement("input", { style: inp, placeholder: "e.g. Tuesdays, ages 12 & under, 10% off", value: form.detail||"", onChange: function(e) { setForm(Object.assign({},form,{detail:e.target.value})) } })),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Notes (optional)"), React.createElement("input", { style: inp, placeholder: "e.g. ID required, app required", value: form.notes||"", onChange: function(e) { setForm(Object.assign({},form,{notes:e.target.value})) } }))
        ),
        React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
          React.createElement("button", { onClick: closeModal, style: { flex: 1, background: "transparent", border: "0.5px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px", color: "rgba(250,248,244,0.5)", fontFamily: "DM Sans,sans-serif", fontSize: 14, cursor: "pointer" } }, "Cancel"),
          React.createElement("button", { onClick: modal==="sub" ? addSub : modal==="coupon" ? addCoupon : addPerk, style: { flex: 1, background: GOLD, border: "none", borderRadius: 10, padding: "10px", color: NAVY, fontFamily: "DM Sans,sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" } }, "Save")
        )
      )
    )
  )
}

// ── Ripples Section ───────────────────────────────────────────────────────────
var RIPPLE_CATS = [
  { id: "all", label: "All" },
  { id: "milestone", label: "Milestone" },
  { id: "firsts", label: "Firsts" },
  { id: "school", label: "School" },
  { id: "sports", label: "Sports" },
  { id: "funny", label: "Funny" },
  { id: "faith", label: "Faith" },
  { id: "other", label: "Other" },
]
function RipplesSection() {
  var GOLD = "#c8a97a"; var NAVY = "#1a2744"; var WHITE = "#faf8f4"
  var SURF = "rgba(255,255,255,0.04)"; var BORD = "0.5px solid rgba(255,255,255,0.08)"
  var SAGE = "#7a9e8e"
  function load() { try { return JSON.parse(localStorage.getItem("af_ripples") || "[]") } catch { return [] } }
  function persist(v) { try { localStorage.setItem("af_ripples", JSON.stringify(v)) } catch {} }
  var [ripples, setRipples] = React.useState(load)
  var [cat, setCat] = React.useState("all")
  var [modal, setModal] = React.useState(false)
  var [form, setForm] = React.useState({ name: "", who: "", category: "milestone", date: "", note: "" })
  var [editId, setEditId] = React.useState(null)
  function save(v) { setRipples(v); persist(v) }
  function openAdd() { setForm({ name: "", who: "", category: "milestone", date: new Date().toISOString().slice(0,10), note: "" }); setEditId(null); setModal(true) }
  function openEdit(r) { setForm({ name: r.name, who: r.who||"", category: r.category||"milestone", date: r.date||"", note: r.note||"" }); setEditId(r.id); setModal(true) }
  function closeModal() { setModal(false); setEditId(null) }
  function submit() {
    if (!form.name.trim()) return
    if (editId) { save(ripples.map(function(r) { return r.id===editId ? Object.assign({},r,form) : r })) }
    else { save([...ripples, Object.assign({ id: Date.now().toString() }, form)]) }
    closeModal()
  }
  function deleteRipple(id) { save(ripples.filter(function(r) { return r.id !== id })) }
  var filtered = cat==="all" ? ripples : ripples.filter(function(r) { return r.category===cat })
  var sorted = filtered.slice().sort(function(a,b) {
    if (!a.date && !b.date) return 0; if (!a.date) return 1; if (!b.date) return -1
    return new Date(b.date) - new Date(a.date)
  })
  var groups = []
  var seen = {}
  sorted.forEach(function(r) {
    var d = r.date ? new Date(r.date+"T00:00:00").toLocaleDateString("en-US",{month:"long",year:"numeric"}) : "No date"
    if (!seen[d]) { seen[d]=true; groups.push({ label: d, items: [] }) }
    groups[groups.length-1].items.push(r)
  })
  var inp = { background: "rgba(255,255,255,0.06)", border: BORD, borderRadius: 8, padding: "9px 12px", color: WHITE, fontFamily: "DM Sans,sans-serif", fontSize: 13, width: "100%", outline: "none" }
  var lbl = { fontSize: 11, color: "rgba(250,248,244,0.5)", marginBottom: 4, display: "block", fontFamily: "DM Sans,sans-serif" }
  var modalBg = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }
  var modalBox = { background: "#1e2e50", border: "0.5px solid rgba(200,169,122,0.2)", borderRadius: 16, padding: "20px", width: "100%", maxWidth: 380 }
  return React.createElement("div", { style: { paddingBottom: "2rem" } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } },
      React.createElement("div", null,
        React.createElement("div", { style: { fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 700, color: WHITE } }, "Ripples"),
        React.createElement("div", { style: { fontSize: 12, color: "rgba(250,248,244,0.5)", marginTop: 2 } }, "Every moment worth keeping")
      ),
      React.createElement("button", { onClick: openAdd, style: { background: GOLD, border: "none", borderRadius: 9, padding: "8px 16px", color: NAVY, fontFamily: "DM Sans,sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" } }, "+ Capture")
    ),
    React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 } },
      RIPPLE_CATS.map(function(c) {
        return React.createElement("button", { key: c.id, onClick: function() { setCat(c.id) }, style: { background: cat===c.id ? "rgba(200,169,122,0.15)" : "transparent", border: cat===c.id ? "0.5px solid rgba(200,169,122,0.35)" : BORD, borderRadius: 20, padding: "4px 12px", color: cat===c.id ? GOLD : "rgba(250,248,244,0.45)", fontSize: 11, fontFamily: "DM Sans,sans-serif", cursor: "pointer" } }, c.label)
      })
    ),
    ripples.length===0 && React.createElement("div", { style: { textAlign: "center", padding: "48px 20px" } },
      React.createElement("div", { style: { fontSize: 32, marginBottom: 12, opacity: 0.3 } }, "🌊"),
      React.createElement("div", { style: { fontFamily: "Cormorant Garamond,serif", fontSize: 20, color: WHITE, marginBottom: 8 } }, "No ripples yet"),
      React.createElement("div", { style: { fontSize: 13, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", lineHeight: 1.6 } }, "Capture first words, lost teeth, goals scored — anything worth remembering."),
      React.createElement("button", { onClick: openAdd, style: { marginTop: 20, background: GOLD, border: "none", borderRadius: 10, padding: "10px 24px", color: NAVY, fontFamily: "DM Sans,sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" } }, "Capture a ripple")
    ),
    groups.map(function(group) {
      return React.createElement("div", { key: group.label, style: { marginBottom: 8 } },
        React.createElement("div", { style: { fontSize: 10, color: "rgba(200,169,122,0.7)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, fontFamily: "DM Sans,sans-serif", fontWeight: 700 } }, group.label),
        group.items.map(function(r) {
          return React.createElement("div", { key: r.id, style: { background: SURF, border: BORD, borderRadius: 10, padding: "10px 12px", marginBottom: 8 } },
            React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between" } },
              React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: "DM Sans,sans-serif" } }, r.name),
                r.note && React.createElement("div", { style: { fontSize: 12, color: "rgba(250,248,244,0.55)", marginTop: 4, fontFamily: "DM Sans,sans-serif", lineHeight: 1.5 } }, r.note),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" } },
                  r.date && React.createElement("span", { style: { fontSize: 10, color: "rgba(200,169,122,0.6)", fontFamily: "DM Sans,sans-serif" } }, new Date(r.date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})),
                  r.who && React.createElement("span", { style: { fontSize: 10, color: "rgba(250,248,244,0.35)", padding: "1px 7px", background: "rgba(255,255,255,0.05)", borderRadius: 20, fontFamily: "DM Sans,sans-serif" } }, r.who),
                  r.category && r.category!=="other" && React.createElement("span", { style: { fontSize: 9, padding: "1px 7px", borderRadius: 20, background: "rgba(122,158,142,0.15)", color: SAGE, border: "0.5px solid rgba(122,158,142,0.3)", fontFamily: "DM Sans,sans-serif" } }, r.category)
                )
              ),
              React.createElement("div", { style: { display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 } },
                React.createElement("button", { onClick: function() { openEdit(r) }, style: { background: "none", border: "none", color: "rgba(250,248,244,0.3)", cursor: "pointer", fontSize: 14 } }, "✎"),
                React.createElement("button", { onClick: function() { deleteRipple(r.id) }, style: { background: "none", border: "none", color: "rgba(250,248,244,0.2)", cursor: "pointer", fontSize: 14 } }, "✕")
              )
            )
          )
        })
      )
    }),
    modal && React.createElement("div", { style: modalBg, onClick: function(e) { if (e.target===e.currentTarget) closeModal() } },
      React.createElement("div", { style: modalBox },
        React.createElement("div", { style: { fontFamily: "Cormorant Garamond,serif", fontSize: 18, fontWeight: 700, color: WHITE, marginBottom: 16 } }, editId ? "Edit ripple" : "Capture a ripple"),
        React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "What happened?"), React.createElement("input", { style: inp, placeholder: "e.g. Lost first tooth, First goal scored", value: form.name, onChange: function(e) { setForm(Object.assign({},form,{name:e.target.value})) } })),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 } },
          React.createElement("div", null, React.createElement("label", { style: lbl }, "Who"), React.createElement("input", { style: inp, placeholder: "e.g. Eli, Clara", value: form.who, onChange: function(e) { setForm(Object.assign({},form,{who:e.target.value})) } })),
          React.createElement("div", null, React.createElement("label", { style: lbl }, "Date"), React.createElement("input", { style: inp, type: "date", value: form.date, onChange: function(e) { setForm(Object.assign({},form,{date:e.target.value})) } }))
        ),
        React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Category"),
          React.createElement("select", { style: inp, value: form.category, onChange: function(e) { setForm(Object.assign({},form,{category:e.target.value})) } },
            RIPPLE_CATS.filter(function(c) { return c.id!=="all" }).map(function(c) { return React.createElement("option", { key: c.id, value: c.id }, c.label) })
          )
        ),
        React.createElement("div", { style: { marginBottom: 16 } }, React.createElement("label", { style: lbl }, "Note (optional)"),
          React.createElement("textarea", { style: Object.assign({}, inp, { minHeight: 72, resize: "vertical" }), placeholder: "Any details you want to remember...", value: form.note, onChange: function(e) { setForm(Object.assign({},form,{note:e.target.value})) } })
        ),
        React.createElement("div", { style: { display: "flex", gap: 8 } },
          React.createElement("button", { onClick: closeModal, style: { flex: 1, background: "transparent", border: "0.5px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px", color: "rgba(250,248,244,0.5)", fontFamily: "DM Sans,sans-serif", fontSize: 14, cursor: "pointer" } }, "Cancel"),
          React.createElement("button", { onClick: submit, style: { flex: 1, background: GOLD, border: "none", borderRadius: 10, padding: "10px", color: NAVY, fontFamily: "DM Sans,sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" } }, editId ? "Save" : "Capture")
        )
      )
    )
  )
}

export default function AnchorVault({ onClose, calEvents = [] }) {
  const [activeSection, setActiveSection] = useState("home")
  const [inventory, setInventory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("af_inventory") || "null") } catch { return null }
  })

  const handleAddToShopping = (item) => {
    try {
      const existing = JSON.parse(localStorage.getItem("af_shoppingItems") || "[]")
      const newItem = { id: Date.now().toString(), text: item, done: false, store: "Grocery", category: "grocery" }
      localStorage.setItem("af_shoppingItems", JSON.stringify([...existing, newItem]))
    } catch {}
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex" }}>
      {/* Sidebar */}
      <div style={{ width: 68, background: "#162035", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", borderRight: "1px solid rgba(200,169,122,0.15)" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", marginBottom: 8, padding: "6px 0", width: "100%", display: "flex", justifyContent: "center" }}>
          <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 12, color: "#c8a97a", letterSpacing: "0.04em", lineHeight: 1.1, textAlign: "center" }}>A&F</div>
        </button>
        {/* ⚓ Anchor — active/highlighted */}
        <button onClick={() => setActiveSection("home")} title="Anchor" style={{ background: "rgba(200,169,122,0.25)", border: "1px solid rgba(200,169,122,0.5)", borderRadius: 8, cursor: "pointer", padding: "8px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginBottom: 4 }}>
          <span style={{ fontSize: 15 }}>⚓</span>
          <span style={{ fontSize: 7, color: "#c8a97a", fontWeight: 700, fontFamily: "DM Sans,sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>Anchor</span>
        </button>
        {/* 🌊 Flow — click to go back */}
        <button onClick={onClose} title="Flow" style={{ background: "rgba(58,107,138,0.08)", border: "1px solid rgba(58,107,138,0.2)", borderRadius: 8, cursor: "pointer", padding: "8px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginBottom: 8 }}>
          <span style={{ fontSize: 15 }}>🌊</span>
          <span style={{ fontSize: 7, color: "rgba(107,163,196,0.5)", fontWeight: 700, fontFamily: "DM Sans,sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>Flow</span>
        </button>
        <div style={{ width: 32, height: "0.5px", background: "rgba(200,169,122,0.2)", marginBottom: 8 }} />
        {NAV.map(item => (
          <button key={item.id} onClick={() => setActiveSection(item.id)} title={item.label} style={{ background: activeSection === item.id ? "rgba(200,169,122,0.12)" : "none", border: "none", borderLeft: activeSection === item.id ? "2px solid #c8a97a" : "2px solid transparent", borderRadius: "0 8px 8px 0", cursor: "pointer", padding: "9px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 14 }}>{item.emoji}</span>
            <span style={{ fontSize: 8, color: activeSection === item.id ? "#c8a97a" : "rgba(250,248,244,0.7)", fontWeight: activeSection === item.id ? 700 : 500, fontFamily: "DM Sans,sans-serif", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center" }}>{item.label.split(" ")[0]}</span>
          </button>
        ))}
        <div style={{ marginTop: "auto" }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, background: "#1e2e50", overflowY: "auto", padding: "24px 20px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {activeSection === "home" && <AnchorHome onNav={setActiveSection} inventory={inventory} calEvents={calEvents} />}
          {activeSection === "inventory" && <InventorySection onAddToShopping={handleAddToShopping} />}
          {activeSection === "systems" && (
            <div style={{ color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>
              <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, marginBottom: 16 }}>Home Systems</div>
              <div style={{ fontSize: 13, color: "rgba(250,248,244,0.5)", lineHeight: 1.6 }}>Your home system rhythms live here. Add them in the Flow Anchor tab and they will appear here too.</div>
            </div>
          )}
          {activeSection === "health" && (
            <div style={{ color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>
              <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, marginBottom: 8 }}>Health</div>
              <div style={{ fontSize: 13, color: "rgba(250,248,244,0.5)", lineHeight: 1.6 }}>Health records and medical info coming soon.</div>
            </div>
          )}
          {activeSection === "career" && (
            <div style={{ color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>
              <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, marginBottom: 8 }}>Career</div>
              <div style={{ fontSize: 13, color: "rgba(250,248,244,0.5)", lineHeight: 1.6 }}>Career notes and goals coming soon.</div>
            </div>
          )}
          {activeSection === "gifts" && <GiftsAndCelebrations calEvents={calEvents} />}
          {activeSection === "pets" && <PetsSection />}
          {activeSection === "moments" && <MomentsSection />}
          {activeSection === "subs" && <SubscriptionsSection />}
          {activeSection === "ripples" && <RipplesSection />}
          {false && (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>lock</div>
              <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, color: "#faf8f4", marginBottom: 8 }}>Premium section</div>
              <div style={{ fontSize: 13, color: "rgba(250,248,244,0.45)", fontFamily: "DM Sans,sans-serif", lineHeight: 1.6, marginBottom: 20 }}>Unlock the full Anchor Vault with premium.</div>
              <button style={{ background: "#c8a97a", border: "none", borderRadius: 10, padding: "12px 24px", color: "#1a2744", fontFamily: "DM Sans,sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Unlock full system</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
