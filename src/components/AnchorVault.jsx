import { useState } from "react"

const NAV = [
  { id: "home",        label: "Home",        icon: "home" },
  { id: "inventory",   label: "Inventory",   icon: "inv"  },
  { id: "systems",     label: "Home Systems",icon: "sys"  },
  { id: "health",      label: "Health",      icon: "hlth", premium: true },
  { id: "career",      label: "Career",      icon: "car",  premium: true },
  { id: "subs",        label: "Subscriptions",icon: "sub", premium: true },
  { id: "gifts",       label: "Gifts",       icon: "gift", premium: true },
]

const PANTRY = ["Pasta","Rice","Olive oil","Canned tomatoes","Peanut butter","Oats","Flour","Sugar","Coffee","Cereal"]
const HOUSEHOLD = ["Paper towels","Dish soap","Laundry pods","Trash bags","Toilet paper","Hand soap","Sponges","Foil"]

const CATS = {
  pantry:    { label: "Pantry",        icon: "🥫", items: ["Pasta","Rice","Olive oil","Canned tomatoes","Peanut butter","Oats","Flour","Sugar","Coffee","Cereal","Bread","Honey"] },
  household: { label: "Household",     icon: "🧴", items: ["Paper towels","Dish soap","Laundry pods","Trash bags","Toilet paper","Hand soap","Sponges","Foil","Zip bags","Batteries"] },
  fridge:    { label: "Fridge",        icon: "🧊", items: ["Milk","Eggs","Butter","Yogurt","Cheese","Leftovers","Juice","Condiments"] },
  bathroom:  { label: "Bathroom",      icon: "🪥", items: ["Toothpaste","Shampoo","Conditioner","Body wash","Razors","Cotton rounds","Floss","Lotion"] },
}

function InventorySection({ onAddToShopping }) {
  const [cats, setCats] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("af_inv_cats") || "null")
      if (saved) return saved
    } catch(e) {}
    const out = {}
    Object.entries(CATS).forEach(function([k, v]) {
      out[k] = { label: v.label, icon: v.icon, items: v.items.map(function(n) { return { name: n, stocked: true } }) }
    })
    return out
  })

  const [activeTab, setActiveTab] = React.useState("pantry")
  const [editing, setEditing] = React.useState(null)
  const [editVal, setEditVal] = React.useState("")
  const [newItem, setNewItem] = React.useState("")
  const [addingNew, setAddingNew] = React.useState(false)
  const [toast, setToast] = React.useState(null)

  const save = function(updated) {
    setCats(updated)
    try { localStorage.setItem("af_inv_cats", JSON.stringify(updated)) } catch(e) {}
  }

  const toggle = function(cat, idx) {
    const catData = cats[cat]
    const newItems = catData.items.map(function(x, i) { return i === idx ? { name: x.name, stocked: !x.stocked } : x })
    const updated = Object.assign({}, cats, { [cat]: Object.assign({}, catData, { items: newItems }) })
    const item = updated[cat].items[idx]
    if (!item.stocked) {
      onAddToShopping(item.name)
      setToast(item.name + " added to shopping list")
      setTimeout(function() { setToast(null) }, 2500)
    }
    save(updated)
  }

  const startEdit = function(cat, idx) {
    setEditing({ cat: cat, idx: idx })
    setEditVal(cats[cat].items[idx].name)
  }

  const saveEdit = function() {
    if (!editing || !editVal.trim()) { setEditing(null); return }
    const catData = cats[editing.cat]
    const newItems = catData.items.map(function(x, i) { return i === editing.idx ? { name: editVal.trim(), stocked: x.stocked } : x })
    const updated = Object.assign({}, cats, { [editing.cat]: Object.assign({}, catData, { items: newItems }) })
    save(updated)
    setEditing(null)
  }

  const deleteItem = function(cat, idx) {
    const catData = cats[cat]
    const newItems = catData.items.filter(function(_, i) { return i !== idx })
    const updated = Object.assign({}, cats, { [cat]: Object.assign({}, catData, { items: newItems }) })
    save(updated)
  }

  const addItem = function() {
    if (!newItem.trim()) return
    const catData = cats[activeTab]
    const newItems = catData.items.concat([{ name: newItem.trim(), stocked: true }])
    const updated = Object.assign({}, cats, { [activeTab]: Object.assign({}, catData, { items: newItems }) })
    save(updated)
    setNewItem("")
    setAddingNew(false)
    setToast(newItem.trim() + " added to " + catData.label)
    setTimeout(function() { setToast(null) }, 2000)
  }

  const resetCat = function(cat) {
    const original = CATS[cat]
    if (!original) return
    const updated = Object.assign({}, cats, { [cat]: { label: original.label, icon: original.icon, items: original.items.map(function(n) { return { name: n, stocked: true } }) } })
    save(updated)
  }

  const currentCat = cats[activeTab] || { label: "", icon: "", items: [] }
  const lowInCat = currentCat.items.filter(function(x) { return !x.stocked }).length
  const totalLow = Object.values(cats).reduce(function(acc, c) { return acc + c.items.filter(function(x) { return !x.stocked }).length }, 0)

  return (
    <div>
      <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: "#faf8f4", marginBottom: 2 }}>Inventory</div>
      <div style={{ fontSize: 12, color: "rgba(250,248,244,0.42)", fontFamily: "DM Sans,sans-serif", marginBottom: 16, lineHeight: 1.5 }}>Tap to mark low — items push to your shopping list. Edit or add items to fit your family.</div>

      {totalLow > 0 && (
        <div style={{ background: "rgba(200,131,74,0.1)", border: "1px solid rgba(200,131,74,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#c8834a", fontFamily: "DM Sans,sans-serif" }}>
          {totalLow} {totalLow === 1 ? "item" : "items"} running low across all categories
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
        {Object.entries(cats).map(function([key, cat]) {
          const low = cat.items.filter(function(x) { return !x.stocked }).length
          return (
            <button key={key} onClick={function() { setActiveTab(key); setAddingNew(false); setEditing(null) }} style={{ background: "none", border: "none", borderBottom: activeTab === key ? "2px solid #c8a97a" : "2px solid transparent", padding: "7px 12px", fontSize: 12, color: activeTab === key ? "#c8a97a" : "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {low > 0 && <span style={{ fontSize: 9, background: "rgba(200,131,74,0.2)", color: "#c8834a", borderRadius: 8, padding: "1px 5px", fontWeight: 700 }}>{low}</span>}
            </button>
          )
        })}
      </div>

      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: "#7a9e8e", color: "#fff", padding: "8px 18px", borderRadius: 20, fontSize: 13, fontFamily: "DM Sans,sans-serif", zIndex: 9999, whiteSpace: "nowrap" }}>{toast}</div>
      )}

      {/* Items list */}
      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
        {currentCat.items.map(function(item, idx) {
          const isEditing = editing && editing.cat === activeTab && editing.idx === idx
          return (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div onClick={function() { toggle(activeTab, idx) }} style={{ width: 20, height: 20, borderRadius: 5, border: "1.5px solid " + (item.stocked ? "#7a9e8e" : "rgba(255,255,255,0.2)"), background: item.stocked ? "#7a9e8e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                {item.stocked && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              {isEditing ? (
                <input autoFocus value={editVal} onChange={function(e) { setEditVal(e.target.value) }} onKeyDown={function(e) { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null) }} style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(200,169,122,0.4)", borderRadius: 6, padding: "4px 8px", color: "#faf8f4", fontSize: 13, fontFamily: "DM Sans,sans-serif", outline: "none" }} />
              ) : (
                <span style={{ flex: 1, fontSize: 13, color: item.stocked ? "rgba(250,248,244,0.8)" : "rgba(250,248,244,0.35)", textDecoration: item.stocked ? "none" : "line-through", fontFamily: "DM Sans,sans-serif" }}>{item.name}</span>
              )}
              {!item.stocked && !isEditing && <span style={{ fontSize: 10, color: "#c8834a", fontFamily: "DM Sans,sans-serif", flexShrink: 0 }}>on list</span>}
              {isEditing ? (
                <button onClick={saveEdit} style={{ background: "#7a9e8e", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#fff", cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>Save</button>
              ) : (
                <button onClick={function() { startEdit(activeTab, idx) }} style={{ background: "none", border: "none", color: "rgba(250,248,244,0.2)", fontSize: 11, cursor: "pointer", padding: "2px 4px", fontFamily: "DM Sans,sans-serif" }}>edit</button>
              )}
              <button onClick={function() { deleteItem(activeTab, idx) }} style={{ background: "none", border: "none", color: "rgba(250,248,244,0.15)", fontSize: 13, cursor: "pointer", padding: "2px 4px" }}>×</button>
            </div>
          )
        })}
      </div>

      {/* Add new item */}
      {addingNew ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input autoFocus value={newItem} onChange={function(e) { setNewItem(e.target.value) }} onKeyDown={function(e) { if (e.key === "Enter") addItem(); if (e.key === "Escape") setAddingNew(false) }} placeholder={"Add to " + currentCat.label + "..."} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 8, padding: "8px 12px", color: "#faf8f4", fontSize: 13, fontFamily: "DM Sans,sans-serif", outline: "none" }} />
          <button onClick={addItem} style={{ background: "#c8a97a", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#1a2744", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 500 }}>Add</button>
          <button onClick={function() { setAddingNew(false) }} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "rgba(250,248,244,0.5)", fontFamily: "DM Sans,sans-serif", cursor: "pointer" }}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={function() { setAddingNew(true) }} style={{ flex: 1, background: "rgba(200,169,122,0.1)", border: "1px solid rgba(200,169,122,0.22)", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", textAlign: "left" }}>+ Add item to {currentCat.label}</button>
          <button onClick={function() { resetCat(activeTab) }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 12px", fontSize: 11, color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", cursor: "pointer" }} title="Reset to defaults">↺</button>
        </div>
      )}
    </div>
  )
}


function AnchorHome({ onNav, inventory }) {
  const lowPantry = inventory ? inventory.pantry.filter(x => !x.stocked).length : 0
  const lowHH = inventory ? inventory.household.filter(x => !x.stocked).length : 0
  const lowTotal = lowPantry + lowHH
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: "#faf8f4", marginBottom: 2 }}>Your Anchor — {today}</div>
        <div style={{ fontSize: 11, color: "rgba(250,248,244,0.38)", fontFamily: "DM Sans,sans-serif" }}>Here is what your home is telling you right now.</div>
      </div>

      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 18 }}>
        {[
          { num: lowTotal, lbl: "items low", alert: lowTotal > 0 },
          { num: 1, lbl: "expiring soon", alert: true },
          { num: 3, lbl: "birthdays", alert: true },
          { num: 0, lbl: "overdue", alert: false },
        ].map((s, i) => (
          <div key={i} style={{ background: s.alert ? "rgba(200,131,74,0.06)" : "rgba(122,158,142,0.06)", border: "1px solid " + (s.alert ? "rgba(200,131,74,0.28)" : "rgba(122,158,142,0.25)"), borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 700, color: s.alert ? "#c8834a" : "#7a9e8e", lineHeight: 1 }}>{s.num}</div>
            <div style={{ fontSize: 9, color: "rgba(250,248,244,0.4)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "DM Sans,sans-serif" }}>{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Inventory feed */}
      <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.25)", fontFamily: "DM Sans,sans-serif", marginBottom: 8 }}>
        <span style={{ background: "rgba(200,169,122,0.12)", color: "#c8a97a", fontSize: 8, padding: "1px 7px", borderRadius: 10, fontWeight: 700, letterSpacing: "0.04em" }}>Inventory</span>
      </div>
      <div onClick={() => onNav("inventory")} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", background: lowTotal > 0 ? "rgba(200,131,74,0.1)" : "rgba(255,255,255,0.04)", border: "1px solid " + (lowTotal > 0 ? "rgba(200,131,74,0.25)" : "rgba(255,255,255,0.08)"), borderRadius: 10, marginBottom: 16, cursor: "pointer" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(200,131,74,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>📦</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{lowTotal > 0 ? lowTotal + " items running low" : "Everything stocked"}</div>
          {lowTotal > 0 && <div style={{ fontSize: 11, color: "#c8834a", marginTop: 2 }}>Tap to add to your shopping list</div>}
          {lowTotal === 0 && <div style={{ fontSize: 11, color: "rgba(250,248,244,0.42)", marginTop: 2 }}>Nice work — pantry and household stocked</div>}
        </div>
        <div style={{ fontSize: 12, color: "rgba(200,169,122,0.35)" }}>→</div>
      </div>

      {/* Premium feeds */}
      {[
        { src: "Gifts & Birthdays", srcColor: "#c8834a", srcBg: "rgba(200,131,74,0.12)", icon: "🎂", title: "Mom's birthday in 6 days", sub: "May 7 — no gift recorded yet", badge: "Act now", badgeColor: "#c8834a", badgeBg: "rgba(200,131,74,0.18)" },
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
  )
}
export default function AnchorVault({ onClose }) {
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
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", marginBottom: 12, padding: "6px 0", width: "100%", display: "flex", justifyContent: "center" }}>
          <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 12, color: "#c8a97a", letterSpacing: "0.04em", lineHeight: 1.1, textAlign: "center" }}>A&F</div>
        </button>
        <button onClick={onClose} style={{ background: "rgba(58,107,138,0.18)", border: "1px solid rgba(58,107,138,0.35)", borderRadius: 8, cursor: "pointer", padding: "7px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginBottom: 8 }}>
          <span style={{ fontSize: 9, color: "#6ba3c4", fontWeight: 700, fontFamily: "DM Sans,sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>Flow</span>
        </button>
        <div style={{ width: 32, height: "0.5px", background: "rgba(200,169,122,0.2)", marginBottom: 8 }} />
        {NAV.map(item => (
          <button key={item.id} onClick={() => !item.premium && setActiveSection(item.id)} title={item.label} style={{ background: activeSection === item.id ? "rgba(200,169,122,0.12)" : "none", border: "none", borderLeft: activeSection === item.id ? "2px solid #c8a97a" : "2px solid transparent", borderRadius: "0 8px 8px 0", cursor: item.premium ? "default" : "pointer", padding: "9px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 9, color: item.premium ? "rgba(200,169,122,0.2)" : activeSection === item.id ? "#c8a97a" : "rgba(250,248,244,0.35)", fontWeight: activeSection === item.id ? 700 : 500, fontFamily: "DM Sans,sans-serif", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center" }}>{item.label.split(" ")[0]}</span>
          </button>
        ))}
        <div style={{ marginTop: "auto" }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, background: "#1e2e50", overflowY: "auto", padding: "24px 20px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {activeSection === "home" && <AnchorHome onNav={setActiveSection} inventory={inventory} />}
          {activeSection === "inventory" && <InventorySection onAddToShopping={handleAddToShopping} />}
          {activeSection === "systems" && (
            <div style={{ color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>
              <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, marginBottom: 16 }}>Home Systems</div>
              <div style={{ fontSize: 13, color: "rgba(250,248,244,0.5)", lineHeight: 1.6 }}>Your home system rhythms live here. Add them in the Flow Anchor tab and they will appear here too.</div>
            </div>
          )}
          {["health","career","subs","gifts"].includes(activeSection) && (
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
