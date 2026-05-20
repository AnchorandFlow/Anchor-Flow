import { useState } from "react"

export default function SetupBanner({ steps = {}, onDismiss, onStep, isPremium }) {
  const [collapsed, setCollapsed] = useState(false)

  const allSteps = [
    { key: "household", label: "Name your household", sub: "Personalize your home base", done: steps.household },
    { key: "family", label: "Invite a family member", sub: "Share your household code", done: steps.family, optional: true },
    { key: "calendar", label: "Connect Google Calendar", sub: "See events in your daily flow", done: steps.calendar, optional: true },
    { key: "premium", label: "Unlock the full system", sub: "Meals, full inventory, Ripple AI", done: isPremium, optional: true, highlight: true },
  ]

  const completed = allSteps.filter(s => s.done).length
  if (completed === allSteps.length) return null

  return (
    <div style={{ background: "rgba(58,107,138,0.08)", border: "0.5px solid rgba(58,107,138,0.18)", borderRadius: "12px", padding: collapsed ? "12px 16px" : "14px 16px 16px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: collapsed ? 0 : "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", gap: "3px" }}>
            {allSteps.map((s, i) => <div key={i} style={{ width: "20px", height: "4px", borderRadius: "2px", background: s.done ? "#3a6b8a" : "rgba(58,107,138,0.2)" }} />)}
          </div>
          <span style={{ fontSize: "12px", color: "#3a6b8a", fontFamily: "var(--font-sans)", fontWeight: 500 }}>Finish setting up · {completed}/{allSteps.length}</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setCollapsed(c => !c)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "rgba(58,107,138,0.6)", fontFamily: "var(--font-sans)" }}>{collapsed ? "Show" : "Hide"}</button>
          <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "rgba(58,107,138,0.4)", lineHeight: 1 }}>×</button>
        </div>
      </div>
      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {allSteps.map(step => (
            <div key={step.key} onClick={() => !step.done && onStep?.(step.key)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "8px", cursor: "pointer", background: "rgba(58,107,138,0.05)", border: "0.5px solid rgba(58,107,138,0.1)" }}>
              <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: step.done ? "#3a6b8a" : "transparent", border: "1.5px solid " + (step.done ? "#3a6b8a" : "rgba(58,107,138,0.3)"), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {step.done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: 500, fontFamily: "var(--font-sans)", color: step.done ? "rgba(26,39,68,0.45)" : "#3a6b8a", textDecoration: step.done ? "line-through" : "none" }}>{step.label}</div>
                <div style={{ fontSize: "11px", color: "rgba(58,107,138,0.55)", fontFamily: "var(--font-sans)" }}>{step.sub}</div>
              </div>
              {!step.done && <span style={{ fontSize: "13px", color: "rgba(58,107,138,0.35)" }}>→</span>}
            </div>
          ))}
          <div style={{ marginTop: "6px", fontSize: "11px", color: "rgba(58,107,138,0.45)", fontFamily: "var(--font-sans)", fontStyle: "italic" }}>Start with just a few things — add more over time.</div>
        </div>
      )}
    </div>
  )
}
