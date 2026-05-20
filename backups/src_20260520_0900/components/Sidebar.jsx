import { useState } from "react"

const ANCHOR = {
  sidebar: { background: "rgba(10,17,32,0.55)", borderRight: "0.5px solid rgba(255,255,255,0.08)" },
  groupLabel: { color: "rgba(250,248,244,0.28)" },
  item: { color: "rgba(250,248,244,0.50)" },
  itemHover: { background: "rgba(255,255,255,0.055)", color: "rgba(250,248,244,0.92)" },
  itemActive: { color: "#4a9ebb", background: "rgba(74,158,187,0.09)", borderLeftColor: "#4a9ebb" },
  subItem: { color: "rgba(250,248,244,0.50)" },
  subHover: { color: "rgba(250,248,244,0.92)" },
  subActive: { color: "#4a9ebb", background: "rgba(74,158,187,0.07)", borderLeftColor: "#4a9ebb" },
  rippleItem: { color: "rgba(196,168,232,0.65)" },
  rippleActive: { color: "rgba(196,168,232,0.9)", background: "rgba(123,94,167,0.1)", borderLeftColor: "rgba(196,168,232,0.5)" },
}

const FLOW = {
  sidebar: { background: "#faf8f4", borderRight: "0.5px solid rgba(26,39,68,0.09)" },
  groupLabel: { color: "#9aa3af" },
  item: { color: "#5a6678" },
  itemHover: { background: "rgba(58,107,138,0.06)", color: "#1a2744" },
  itemActive: { color: "#3a6b8a", background: "rgba(58,107,138,0.10)", borderLeftColor: "#3a6b8a" },
  subItem: { color: "#5a6678" },
  subHover: { color: "#1a2744" },
  subActive: { color: "#3a6b8a", background: "rgba(58,107,138,0.07)", borderLeftColor: "#3a6b8a" },
  rippleItem: { color: "rgba(123,94,167,0.65)" },
  rippleActive: { color: "rgba(123,94,167,0.85)", background: "rgba(123,94,167,0.07)", borderLeftColor: "rgba(123,94,167,0.45)" },
}

export default function Sidebar({ theme, sections, activeId, onSelect }) {
  const T = theme === "anchor" ? ANCHOR : FLOW
  const [hovered, setHovered] = useState(null)

  const itemStyle = (id, isRipple) => {
    const active = activeId === id
    const base = { display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px", fontSize: "12px", cursor: "pointer", borderLeft: "2px solid transparent", fontFamily: "var(--font-sans)", transition: "all 0.14s", userSelect: "none", fontWeight: active ? 500 : 400 }
    if (active) return { ...base, ...(isRipple ? T.rippleActive : T.itemActive) }
    if (hovered === id) return { ...base, ...(isRipple ? T.rippleItem : T.itemHover) }
    return { ...base, ...(isRipple ? T.rippleItem : T.item) }
  }

  const subStyle = (id, isRipple) => {
    const active = activeId === id
    const base = { padding: "5px 14px 5px 36px", fontSize: "11px", cursor: "pointer", borderLeft: "2px solid transparent", fontFamily: "var(--font-sans)", transition: "all 0.14s", userSelect: "none", fontWeight: active ? 500 : 400 }
    if (active) return { ...base, ...(isRipple ? T.rippleActive : T.subActive) }
    if (hovered === id) return { ...base, ...(isRipple ? T.rippleItem : T.subHover) }
    return { ...base, ...(isRipple ? T.rippleItem : T.subItem) }
  }

  return (
    <div style={{ width: "var(--sidebar-width)", flexShrink: 0, padding: "10px 0", overflowY: "auto", maxHeight: "calc(100dvh - 48px)", ...T.sidebar }}>
      {sections.map((section, i) => {
        if (section.type === "group") {
          return <span key={"g"+i} style={{ fontSize: "9px", fontFamily: "var(--font-sans)", letterSpacing: "0.10em", textTransform: "uppercase", padding: "0 14px", margin: (i===0?"2px":"12px")+" 0 4px", display: "block", ...T.groupLabel }}>{section.label}</span>
        }
        return (
          <div key={section.id}>
            <div style={itemStyle(section.id, section.isRipple)} onClick={() => onSelect(section.id)} onMouseEnter={() => setHovered(section.id)} onMouseLeave={() => setHovered(null)}>
              {section.icon && <span style={{ fontSize: "13px", width: "15px", textAlign: "center" }}>{section.icon}</span>}
              {section.label}
            </div>
            {section.children && section.children.map(child => (
              <div key={child.id} style={subStyle(child.id, child.isRipple)} onClick={() => onSelect(child.id)} onMouseEnter={() => setHovered(child.id)} onMouseLeave={() => setHovered(null)}>{child.label}</div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
