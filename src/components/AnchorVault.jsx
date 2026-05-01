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

function InventorySection({ onAddToShopping }) {
  const DEFAULTS = {
    pantry: { label: "Pantry", icon: "🥫", items: ["Pasta","Rice","Olive oil","Canned tomatoes","Peanut butter","Oats","Flour","Sugar","Coffee","Cereal","Bread","Honey"] },
    household: { label: "Household", icon: "🧹", items: ["Paper towels","Dish soap","Laundry pods","Trash bags","Toilet paper","Hand soap","Sponges","Foil","Ziploc bags","Cleaning spray"] },
    bathroom: { label: "Bathroom", icon: "🛁", items: ["Shampoo","Conditioner","Body wash","Toothpaste","Floss","Cotton rounds","Razors"] },
    kids: { label: "Kids", icon: "🧸", items: ["Wipes","Diapers","Kids shampoo","Sunscreen","Band-aids","Kids vitamins"] },
  }

  const [cats, setCats] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("af_inv_cats") || "null")
      if (saved) return saved
    } catch(e) {}
    const out = {}
    Object.entries(DEFAULTS).forEach(([k, v]) => {
      out[k] = { label: v.label, icon: v.icon, items: v.items.map(n => ({ name: n, stocked: true })) }
    })
    return out
  })

  const [activeTab, setActiveTab] = React.useState("pantry")
  const [editing, setEditing] = React.useState(null)
  const [editVal, setEditVal] = React.useState("")
  const [newItem, setNewItem] = React.useState("")
  const [addingNew, setAddingNew] = React.useState(false)
  const [toast, setToast] = React.useState(null)

  const save = (updated) => {
    setCats(updated)
    try { localStorage.setItem("af_inv_cats", JSON.stringify(updated)) } catch(e) {}
  }

  const toggle = (cat, idx) => {
    const updated = { ...cats, [cat]: { ...cats[cat], items: cats[cat].items.map((x, i) => i === idx ? { ...x, stocked: !x.stocked } : x) } }
    const item = updated[cat].items[idx]
    if (!item.stocked) {
      onAddToShopping(item.name)
      setToast(item.name + " added to shopping")
      setTimeout(() => setToast(null), 2200)
    }
    save(updated)
  }

  const startEdit = (idx, name) => { setEditing(idx); setEditVal(name) }

  const saveEdit = (cat, idx) => {
    if (!editVal.trim()) return
    const updated = { ...cats, [cat]: { ...cats[cat], items: cats[cat].items.map((x, i) => i === idx ? { ...x, name: editVal.trim() } : x) } }
    save(updated); setEditing(null)
  }

  const removeItem = (cat, idx) => {
    const updated = { ...cats, [cat]: { ...cats[cat], items: cats[cat].items.filter((_, i) => i !== idx) } }
    save(updated)
  }

  const addItem = (cat) => {
    if (!newItem.trim()) return
    const updated = { ...cats, [cat]: { ...cats[cat], items: [...cats[cat].items, { name: newItem.trim(), stocked: true }] } }
    save(updated); setNewItem(""); setAddingNew(false)
  }

  const resetCat = (cat) => {
    if (!DEFAULTS[cat]) return
    const updated = { ...cats, [cat]: { ...cats[cat], items: DEFAULTS[cat].items.map(n => ({ name: n, stocked: true })) } }
    save(updated)
  }

  const cur = cats[activeTab]
  const lowCount = cur ? cur.items.filter(x => !x.stocked).length : 0
  const totalLow = Object.values(cats).reduce((a, c) => a + c.items.filter(x => !x.stocked).length, 0)

  const T = { navy: "#1a2744", sand: "#c8a97a", sage: "#7a9e8e", warm: "#faf8f4", orange: "#c8834a" }

  return (
    <div>
      <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: T.warm, marginBottom: 3 }}>Inventory</div>
      <div style={{ fontSize: 11, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", marginBottom: 16, lineHeight: 1.5 }}>Check what you are low on. Unchecked items go straight to your shopping list.</div>

      {/* Signal bar */}
      <div style={{ background: "rgba(200,169,122,0.08)", border: "1px solid rgba(200,169,122,0.18)", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 700, color: totalLow > 0 ? T.orange : T.sage }}>{totalLow}</div>
          <div style={{ fontSize: 9, color: "rgba(250,248,244,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "DM Sans,sans-serif" }}>items low</div>
        </div>
        <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.08)" }} />
        <div style={{ fontSize: 12, color: "rgba(250,248,244,0.5)", fontFamily: "DM Sans,sans-serif", lineHeight: 1.4, flex: 1 }}>
          {totalLow === 0 ? "All stocked. Nice work." : totalLow + " items running low across all categories"}
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
        {Object.entries(cats).map(([key, cat]) => {
          const low = cat.items.filter(x => !x.stocked).length
          return (
            <div key={key} onClick={() => { setActiveTab(key); setEditing(null); setAddingNew(false) }} style={{ padding: "7px 12px", fontSize: 11, cursor: "pointer", borderBottom: activeTab === key ? "2px solid " + T.sand : "2px solid transparent", color: activeTab === key ? T.sand : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", position: "relative", display: "flex", alignItems: "center", gap: 5 }}>
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {low > 0 && <span style={{ background: T.orange, color: "#fff", fontSize: 8, borderRadius: 8, padding: "1px 5px", fontWeight: 700 }}>{low}</span>}
            </div>
          )
        })}
      </div>

      {/* Toast */}
      {toast && <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: T.sage, color: "#fff", padding: "8px 18px", borderRadius: 20, fontSize: 12, fontFamily: "DM Sans,sans-serif", zIndex: 9999, whiteSpace: "nowrap", pointerEvents: "none" }}>{toast}</div>}

      {/* Item list */}
      {cur && (
        <div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
            {cur.items.map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                {/* Checkbox */}
                <div onClick={() => editing !== idx && toggle(activeTab, idx)} style={{ width: 18, height: 18, borderRadius: 4, border: "1.5px solid " + (item.stocked ? T.sage : "rgba(255,255,255,0.2)"), background: item.stocked ? T.sage : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                  {item.stocked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                </div>

                {/* Name or edit input */}
                {editing === idx ? (
                  <input
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveEdit(activeTab, idx); if (e.key === "Escape") setEditing(null) }}
                    autoFocus
                    style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(200,169,122,0.4)", borderRadius: 6, padding: "4px 8px", color: T.warm, fontSize: 13, fontFamily: "DM Sans,sans-serif", outline: "none" }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: item.stocked ? "rgba(250,248,244,0.8)" : "rgba(250,248,244,0.35)", textDecoration: item.stocked ? "none" : "line-through", fontFamily: "DM Sans,sans-serif" }}>{item.name}</span>
                )}

                {/* Actions */}
                {editing === idx ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => saveEdit(activeTab, idx)} style={{ background: T.sage, border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 10, color: "#fff", cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>save</button>
                    <button onClick={() => setEditing(null)} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 10, color: "rgba(250,248,244,0.5)", cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>cancel</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6, opacity: 0, transition: "opacity .15s" }} className="item-actions">
                    <button onClick={() => startEdit(idx, item.name)} style={{ background: "none", border: "none", fontSize: 11, color: "rgba(250,248,244,0.3)", cursor: "pointer", padding: "2px 4px" }}>✏️</button>
                    <button onClick={() => removeItem(activeTab, idx)} style={{ background: "none", border: "none", fontSize: 11, color: "rgba(250,248,244,0.25)", cursor: "pointer", padding: "2px 4px" }}>✕</button>
                  </div>
                )}

                {!item.stocked && editing !== idx && <span style={{ fontSize: 10, color: T.orange, fontFamily: "DM Sans,sans-serif", marginLeft: 4 }}>on list</span>}
              </div>
            ))}
          </div>

          {/* Add item */}
          {addingNew ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addItem(activeTab); if (e.key === "Escape") setAddingNew(false) }}
                placeholder={"Add to " + cur.label + "..."}
                autoFocus
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.35)", borderRadius: 8, padding: "8px 12px", color: T.warm, fontSize: 13, fontFamily: "DM Sans,sans-serif", outline: "none" }}
              />
              <button onClick={() => addItem(activeTab)} style={{ background: T.sand, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 500, color: T.navy, fontFamily: "DM Sans,sans-serif", cursor: "pointer" }}>Add</button>
              <button onClick={() => setAddingNew(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", cursor: "pointer" }}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAddingNew(true)} style={{ flex: 1, background: "rgba(200,169,122,0.1)", border: "1px solid rgba(200,169,122,0.22)", borderRadius: 8, padding: "9px", fontSize: 12, color: T.sand, fontFamily: "DM Sans,sans-serif", cursor: "pointer" }}>+ Add item</button>
              <button onClick={() => resetCat(activeTab)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 14px", fontSize: 11, color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", cursor: "pointer" }}>Reset defaults</button>
            </div>
          )}
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
