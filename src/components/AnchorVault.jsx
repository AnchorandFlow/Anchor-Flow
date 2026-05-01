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
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("af_inventory") || "null") } catch {}
    return {
      pantry: PANTRY.map(n => ({ name: n, stocked: true })),
      household: HOUSEHOLD.map(n => ({ name: n, stocked: true })),
    }
  })
  const [toast, setToast] = useState(null)

  const save = (updated) => {
    setItems(updated)
    try { localStorage.setItem("af_inventory", JSON.stringify(updated)) } catch {}
  }

  const toggle = (cat, idx) => {
    const updated = { ...items, [cat]: items[cat].map((x, i) => i === idx ? { ...x, stocked: !x.stocked } : x) }
    const item = updated[cat][idx]
    if (!item.stocked) {
      onAddToShopping(item.name)
      setToast(item.name + " added to shopping list")
      setTimeout(() => setToast(null), 2500)
    }
    save(updated)
  }

  const lowPantry = items.pantry.filter(x => !x.stocked).length
  const lowHH = items.household.filter(x => !x.stocked).length

  return (
    <div>
      <div style={{ background: "rgba(200,169,122,0.08)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 16 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: lowPantry > 0 ? "#c8834a" : "#7a9e8e", fontFamily: "Cormorant Garamond,serif" }}>{lowPantry}</div>
          <div style={{ fontSize: 11, color: "rgba(250,248,244,0.5)", fontFamily: "DM Sans,sans-serif" }}>pantry low</div>
        </div>
        <div style={{ width: 1, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: lowHH > 0 ? "#c8834a" : "#7a9e8e", fontFamily: "Cormorant Garamond,serif" }}>{lowHH}</div>
          <div style={{ fontSize: 11, color: "rgba(250,248,244,0.5)", fontFamily: "DM Sans,sans-serif" }}>household low</div>
        </div>
        <div style={{ width: 1, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ flex: 2, display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "rgba(250,248,244,0.55)", fontFamily: "DM Sans,sans-serif", lineHeight: 1.4 }}>
            {lowPantry + lowHH === 0 ? "Everything stocked. Nice work." : `${lowPantry + lowHH} items low — tap to add to shopping`}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: "#7a9e8e", color: "#fff", padding: "8px 18px", borderRadius: 20, fontSize: 13, fontFamily: "DM Sans,sans-serif", zIndex: 9999, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      <div style={{ fontSize: 11, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        Quick weekly reset — check what you are low on
      </div>

      {[["pantry", "Pantry"], ["household", "Household"]].map(([cat, label]) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#c8a97a", fontFamily: "Cormorant Garamond,serif", marginBottom: 8, letterSpacing: "0.03em" }}>{label}</div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, overflow: "hidden" }}>
            {items[cat].map((item, idx) => (
              <div key={idx} onClick={() => toggle(cat, idx)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "background 0.15s" }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: "1.5px solid " + (item.stocked ? "#7a9e8e" : "rgba(255,255,255,0.25)"), background: item.stocked ? "#7a9e8e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {item.stocked && <span style={{ color: "#fff", fontSize: 10 }}>ok</span>}
                </div>
                <span style={{ fontSize: 13, color: item.stocked ? "rgba(250,248,244,0.8)" : "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", textDecoration: item.stocked ? "none" : "line-through" }}>{item.name}</span>
                {!item.stocked && <span style={{ marginLeft: "auto", fontSize: 10, color: "#c8834a", fontFamily: "DM Sans,sans-serif" }}>add to list</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AnchorHome({ onNav, inventory }) {
  const lowCount = inventory ? (inventory.pantry?.filter(x => !x.stocked).length || 0) + (inventory.household?.filter(x => !x.stocked).length || 0) : 0

  return (
    <div>
      <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 26, fontWeight: 600, color: "#faf8f4", marginBottom: 4 }}>Your Anchor</div>
      <div style={{ fontSize: 13, color: "rgba(250,248,244,0.45)", fontFamily: "DM Sans,sans-serif", marginBottom: 24, lineHeight: 1.5 }}>The foundation. Everything your home runs on.</div>

      {[
        { id: "inventory", label: "Inventory", desc: lowCount > 0 ? lowCount + " items running low" : "Everything stocked", signal: lowCount > 0, icon: "inv" },
        { id: "systems", label: "Home Systems", desc: "Rhythms that keep life running", signal: false, icon: "sys" },
        { id: "health", label: "Health Records", desc: "Premium", premium: true, icon: "hlth" },
        { id: "career", label: "Career & Docs", desc: "Premium", premium: true, icon: "car" },
        { id: "subs", label: "Subscriptions", desc: "Premium", premium: true, icon: "sub" },
        { id: "gifts", label: "Gifts & Birthdays", desc: "Premium", premium: true, icon: "gift" },
      ].map(item => (
        <div key={item.id} onClick={() => !item.premium && onNav(item.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid " + (item.signal ? "rgba(200,131,74,0.35)" : "rgba(255,255,255,0.08)"), borderRadius: 12, marginBottom: 10, cursor: item.premium ? "default" : "pointer", transition: "background 0.15s" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: item.premium ? "rgba(255,255,255,0.04)" : "rgba(200,169,122,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 14, opacity: item.premium ? 0.3 : 1 }}>
              {item.id === "inventory" ? "box" : item.id === "systems" ? "home" : item.id === "health" ? "heart" : item.id === "career" ? "doc" : item.id === "subs" ? "cal" : "gift"}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: item.premium ? "rgba(250,248,244,0.3)" : "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{item.label}</div>
            <div style={{ fontSize: 11, color: item.signal ? "#c8834a" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", marginTop: 1 }}>{item.desc}</div>
          </div>
          {item.premium && <span style={{ fontSize: 9, color: "rgba(200,169,122,0.5)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 10, padding: "2px 7px", fontFamily: "DM Sans,sans-serif" }}>Premium</span>}
          {!item.premium && <span style={{ fontSize: 14, color: "rgba(200,169,122,0.4)" }}>go</span>}
        </div>
      ))}
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
      <div style={{ width: 68, background: "#0f1a2e", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", borderRight: "1px solid rgba(200,169,122,0.15)" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", marginBottom: 12, padding: "6px 0", width: "100%", display: "flex", justifyContent: "center" }}>
          <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 12, color: "#c8a97a", letterSpacing: "0.04em", lineHeight: 1.1, textAlign: "center" }}>A&F</div>
        </button>
        <div style={{ width: 32, height: "0.5px", background: "rgba(200,169,122,0.2)", marginBottom: 8 }} />
        {NAV.map(item => (
          <button key={item.id} onClick={() => !item.premium && setActiveSection(item.id)} title={item.label} style={{ background: activeSection === item.id ? "rgba(200,169,122,0.12)" : "none", border: "none", borderLeft: activeSection === item.id ? "2px solid #c8a97a" : "2px solid transparent", borderRadius: "0 8px 8px 0", cursor: item.premium ? "default" : "pointer", padding: "9px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 9, color: item.premium ? "rgba(200,169,122,0.2)" : activeSection === item.id ? "#c8a97a" : "rgba(250,248,244,0.35)", fontWeight: activeSection === item.id ? 700 : 500, fontFamily: "DM Sans,sans-serif", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center" }}>{item.label.split(" ")[0]}</span>
          </button>
        ))}
        <div style={{ marginTop: "auto" }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 0", width: "56px", display: "flex", justifyContent: "center", opacity: 0.3, color: "#faf8f4", fontSize: 11, fontFamily: "DM Sans,sans-serif" }}>back</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, background: "#1a2744", overflowY: "auto", padding: "24px 20px" }}>
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
