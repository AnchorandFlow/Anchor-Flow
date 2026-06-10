import { useState, useEffect } from "react"

// ── Ripples (formerly Compass/AI tab) ───────────────────────────────────────
// Visual: deep cove teal mockup (#2f5d62) — ripples-skin palette
// Logic: insight dismiss, ask input, typing animation — all preserved
// ────────────────────────────────────────────────────────────────────────────

// Mockup ripples-skin palette
const R = {
  bg:      "#2f5d62",   // deep cove — primary bg
  bg2:     "#24484c",   // tide pool — darker depth
  bg3:     "#1d3a3e",   // ocean floor
  sg:      "#b7d4cf",   // sea glass accent
  sd:      "#d8c6a3",   // weathered sand warm
  cream:   "#f5f0e8",
  t1:      "#f5f0e8",
  t2:      "rgba(245,240,232,0.72)",
  t3:      "rgba(245,240,232,0.40)",
  t4:      "rgba(245,240,232,0.22)",
  card:    "rgba(36,72,76,0.65)",
  border:  "rgba(183,212,207,0.13)",
  ok:      "#7eb89a",
  warn:    "#c87a8a",
  gold:    "#d8c6a3",
}

const INSIGHTS = [
  {
    id: 1, icon: "⚡",
    title: "Wednesday looks full",
    body: "You have a lot stacked. I can help shift a few things.",
    detail: ["Move admin to Thursday", "Swap dinner to a rescue meal", "Defer pantry check"],
    color: R.warn, border: "rgba(200,122,138,0.25)",
    actions: ["Help me lighten it", "Show me what moves"]
  },
  {
    id: 2, icon: "🍽️",
    title: "4 dinners still unplanned",
    body: "I picked meals that match your energy each night.",
    detail: ["Mon · Pasta (20 min)", "Tue · Sheet pan chicken", "Thu · Tacos", "Fri · Your call"],
    color: R.sg, border: "rgba(183,212,207,0.25)",
    actions: ["Add all 4 meals", "Pick differently"]
  },
  {
    id: 3, icon: "☀️",
    title: "Your day is ready",
    body: "3 priorities set, dinner planned, school pickup blocked.",
    detail: ["Priority: Call pediatrician", "Block: School pickup 3:15pm", "Dinner: Pasta bake"],
    color: R.ok, border: "rgba(126,184,154,0.28)",
    actions: ["Looks good", "Adjust"]
  },
]

export default function RippleTab() {
  const [insights, setInsights] = useState(INSIGHTS)
  const [active, setActive] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [input, setInput] = useState("")
  const [typed, setTyped] = useState("")
  const greeting = "Good morning. Here is what I see for your week."

  // Typing animation — preserved from original
  useEffect(() => {
    let i = 0
    const t = setInterval(() => {
      if (i < greeting.length) { setTyped(greeting.slice(0, ++i)) }
      else clearInterval(t)
    }, 35)
    return () => clearInterval(t)
  }, [])

  // Handlers — preserved from original
  const dismiss = id => { setInsights(p => p.filter(x => x.id !== id)); if (active === id) setActive(null) }
  const ask = () => { if (!input.trim()) return; setThinking(true); setTimeout(() => setThinking(false), 2000); setInput("") }

  return (
    <div style={{ minHeight: "100%", background: R.bg, color: R.t1, fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
      <style>{`
        @keyframes af-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes af-ripple-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }
        .rip-insight { animation: af-ripple-in 0.25s ease both; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: R.bg3, borderBottom: `1px solid ${R.border}`, padding: "20px 24px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            {/* Typing greeting — ph-t style */}
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", fontWeight: 400, color: R.cream, lineHeight: 1, marginBottom: 4, minHeight: "1.6rem" }}>
              {typed}
              <span style={{ animation: "af-pulse 1s infinite", opacity: typed.length < greeting.length ? 1 : 0 }}>|</span>
            </div>
            <div style={{ fontSize: "0.67rem", color: R.t3, letterSpacing: "0.04em" }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
          </div>
          {/* Compass active badge */}
          <div style={{ background: "rgba(183,212,207,0.1)", border: `1px solid ${R.border}`, borderRadius: 10, padding: "5px 11px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: R.sd, animation: "af-pulse 2s infinite", display: "inline-block" }} />
            <span style={{ fontSize: "0.62rem", color: R.sd, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>Compass Active</span>
          </div>
        </div>
        {/* Status chips */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {[
            { l: "3 priorities set", c: R.ok },
            { l: "Wed looks full",   c: R.warn },
            { l: "4 dinners open",   c: R.sd },
          ].map(x => (
            <div key={x.l} style={{ background: `${x.c}1a`, border: `1px solid ${x.c}40`, borderRadius: 20, padding: "3px 10px", fontSize: "0.62rem", color: x.c, fontWeight: 500, letterSpacing: "0.04em" }}>
              {x.l}
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "18px 24px", maxWidth: 600, margin: "0 auto" }}>

        {/* Thinking indicator */}
        {thinking && (
          <div style={{ background: "rgba(183,212,207,0.08)", border: `1px solid ${R.border}`, borderRadius: 10, padding: "11px 15px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: R.sg, animation: `af-pulse 1.2s ${i * 0.2}s infinite` }} />
              ))}
            </div>
            <span style={{ fontSize: "0.72rem", color: R.t2 }}>Compass is thinking…</span>
          </div>
        )}

        {/* Section label */}
        <div style={{ fontSize: "0.54rem", color: R.sg, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 500, marginBottom: 12 }}>
          What I noticed
        </div>

        {/* Insights */}
        {insights.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 20px", background: R.card, border: `1px solid ${R.border}`, borderRadius: 14, backdropFilter: "blur(12px)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 10 }}>✦</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", color: R.cream, marginBottom: 6 }}>You are all clear</div>
            <div style={{ fontSize: "0.72rem", color: R.t3, lineHeight: 1.6 }}>I will let you know if anything needs attention.</div>
          </div>
        ) : (
          insights.map(ins => (
            <div
              key={ins.id}
              className="rip-insight"
              onClick={() => setActive(active === ins.id ? null : ins.id)}
              style={{
                background: active === ins.id ? "rgba(36,72,76,0.8)" : R.card,
                border: `1px solid ${active === ins.id ? ins.border : R.border}`,
                borderRadius: 11, padding: "15px 17px", marginBottom: 9,
                cursor: "pointer", transition: "all 0.18s",
                backdropFilter: "blur(12px)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                {/* Icon */}
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${ins.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
                  {ins.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Card title — ct style */}
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "0.95rem", fontWeight: 500, color: R.cream, marginBottom: 3, lineHeight: 1.25 }}>
                    {ins.title}
                  </div>
                  {/* Card body */}
                  <div style={{ fontSize: "0.71rem", color: R.t2, lineHeight: 1.5 }}>
                    {ins.body}
                  </div>
                </div>
                {/* Dismiss */}
                <button
                  onClick={e => { e.stopPropagation(); dismiss(ins.id) }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: R.t3, fontSize: "0.82rem", padding: "2px 4px", flexShrink: 0, lineHeight: 1, transition: "color 0.12s" }}
                  onMouseEnter={e => e.currentTarget.style.color = R.t1}
                  onMouseLeave={e => e.currentTarget.style.color = R.t3}
                >
                  ✕
                </button>
              </div>

              {/* Expanded detail */}
              {active === ins.id && (
                <div style={{ marginTop: 13 }}>
                  <div style={{ background: `${ins.color}12`, borderRadius: 8, padding: "9px 12px", marginBottom: 10 }}>
                    {ins.detail.map((d, i) => (
                      <div key={i} style={{ fontSize: "0.72rem", color: R.t2, padding: "3px 0", display: "flex", gap: 8, lineHeight: 1.5 }}>
                        <span style={{ color: ins.color, flexShrink: 0 }}>·</span>
                        <span>{d}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 7 }}>
                    {ins.actions.map((a, i) => (
                      <button
                        key={i}
                        style={{
                          flex: i === 0 ? 1 : "none",
                          padding: "8px 14px", borderRadius: 9,
                          border: i === 0 ? "none" : `1px solid ${ins.color}60`,
                          background: i === 0 ? ins.color : "transparent",
                          color: i === 0 ? "#fff" : ins.color,
                          fontFamily: "'DM Sans', sans-serif", fontSize: "0.72rem", fontWeight: 500,
                          cursor: "pointer", transition: "all 0.14s",
                        }}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* ── Ask Compass ── */}
        <div style={{ marginTop: 20, background: R.card, border: `1px solid ${R.border}`, borderRadius: 11, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, backdropFilter: "blur(12px)" }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(183,212,207,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", flexShrink: 0, color: R.sg }}>
            🧭
          </div>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && ask()}
            placeholder="Ask Compass anything about your week…"
            style={{ flex: 1, border: "none", outline: "none", fontFamily: "'DM Sans', sans-serif", fontSize: "0.78rem", color: R.t1, background: "transparent", fontWeight: 300 }}
          />
          <button
            onClick={ask}
            style={{ background: "rgba(183,212,207,0.15)", border: `1px solid ${R.border}`, borderRadius: 7, padding: "5px 11px", color: R.sg, fontFamily: "'DM Sans', sans-serif", fontSize: "0.65rem", fontWeight: 500, cursor: "pointer", letterSpacing: "0.04em", whiteSpace: "nowrap", transition: "all 0.14s" }}
          >
            Ask →
          </button>
        </div>

        <div style={{ textAlign: "center", fontSize: "0.6rem", color: R.t4, marginTop: 14, letterSpacing: "0.06em" }}>
          Compass · Anchor & Flow
        </div>
      </div>
    </div>
  )
}
