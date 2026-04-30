import { useEffect, useState } from "react"

export default function HomeScreen({ onAnchor, onFlow, session, onSignOut }) {
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  const fade = (delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(14px)",
    transition: "opacity 0.5s cubic-bezier(0.22,1,0.36,1) "+delay+"ms, transform 0.5s cubic-bezier(0.22,1,0.36,1) "+delay+"ms",
  })

  const shim = { position: "absolute", height: "1px", background: "rgba(200,169,122,0.055)", width: "200%", left: "-50%", pointerEvents: "none" }
  const screen = { minHeight: "100dvh", background: "#1a2744", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 28px 44px", position: "relative", overflow: "hidden", fontFamily: "var(--font-sans)" }

  return (
    <div style={screen}>
      <div style={{ ...shim, top: "13%" }} />
      <div style={{ ...shim, top: "49%" }} />
      <div style={{ ...shim, top: "82%" }} />

      <div style={{ ...fade(0), fontFamily: "var(--font-serif)", fontSize: "14px", fontWeight: 500, color: "rgba(250,248,244,0.38)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "28px" }}>
        anchor <em style={{ color: "#c8a97a", fontStyle: "normal" }}>&</em> flow
      </div>

      <div style={{ ...fade(80), fontFamily: "var(--font-serif)", fontSize: "36px", fontWeight: 500, color: "#faf8f4", textAlign: "center", lineHeight: 1.12, letterSpacing: "0.01em", marginBottom: "12px", maxWidth: "480px" }}>
        Anchor what matters.
        <br /><em style={{ color: "#c8a97a", fontStyle: "italic" }}>Flow</em> through your days.
      </div>

      <div style={{ ...fade(140), fontSize: "15px", color: "rgba(250,248,244,0.78)", textAlign: "center", lineHeight: 1.6, marginBottom: "10px", maxWidth: "320px" }}>
        A simple system to help your home run without constant catch-up.
      </div>

      <div style={{ ...fade(180), display: "flex", alignItems: "center", gap: "8px", marginBottom: "36px" }}>
        <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "rgba(200,169,122,0.4)" }} />
        <span style={{ fontSize: "12px", color: "rgba(250,248,244,0.36)", letterSpacing: "0.04em" }}>Built for real families</span>
        <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "rgba(200,169,122,0.4)" }} />
        <span style={{ fontSize: "12px", color: "rgba(250,248,244,0.36)", letterSpacing: "0.04em" }}>Made for real life, not perfect routines</span>
        <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "rgba(200,169,122,0.4)" }} />
      </div>

      <div
        style={{ ...fade(240), width: "100%", maxWidth: "360px", background: hovered==="flow" ? "rgba(200,169,122,0.15)" : "rgba(200,169,122,0.10)", border: "1px solid "+(hovered==="flow" ? "rgba(200,169,122,0.38)" : "rgba(200,169,122,0.24)"), borderRadius: "18px", padding: "24px 24px 20px", cursor: "pointer", transition: "background 0.2s,border-color 0.2s,transform 0.22s", transform: hovered==="flow" ? "translateY(-2px)" : "translateY(0)" }}
        onClick={onFlow}
        onMouseEnter={() => setHovered("flow")}
        onMouseLeave={() => setHovered(null)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "11px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "rgba(200,169,122,0.18)", border: "1px solid rgba(200,169,122,0.28)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="12" viewBox="0 0 22 14" fill="none"><path d="M1 7C3.5 3 6.5 3 9 7C11.5 11 14.5 11 17 7C19.5 3 21 5 21 7" stroke="rgba(200,169,122,0.92)" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 600, color: "#c8a97a", letterSpacing: "0.02em", lineHeight: 1 }}>Flow</div>
            <div style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(200,169,122,0.52)", marginTop: "2px" }}>your daily rhythm</div>
          </div>
        </div>
        <div style={{ fontSize: "14px", color: "rgba(200,169,122,0.82)", lineHeight: 1.6, marginBottom: "18px" }}>Get through today with clarity and calm.</div>
        <div onClick={onFlow} style={{ width: "100%", padding: "13px 16px", background: "#b8904a", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", cursor: "pointer", marginBottom: "14px", boxShadow: "0 0 0 3px rgba(200,169,122,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            {[6,11,5,9].map((h,i) => <span key={i} style={{ display: "inline-block", width: "3px", height: h+"px", borderRadius: "2px", background: "#1a2744", opacity: 0.4 }} />)}
          </div>
          <span style={{ fontSize: "16px", fontWeight: 500, color: "#1a2744", letterSpacing: "0.04em", fontFamily: "var(--font-sans)" }}>Start your day</span>
          <div style={{ display: "flex", alignItems: "center", gap: "3px", transform: "scaleX(-1)" }}>
            {[6,11,5,9].map((h,i) => <span key={i} style={{ display: "inline-block", width: "3px", height: h+"px", borderRadius: "2px", background: "#1a2744", opacity: 0.4 }} />)}
          </div>
        </div>
        <div style={{ fontSize: "13px", color: "rgba(200,169,122,0.62)", textAlign: "center", fontStyle: "italic" }}>
          Powered by your <strong style={{ color: "rgba(200,169,122,0.92)", fontStyle: "normal", fontWeight: 500 }}>Anchor</strong> — everything important, already in place.
        </div>
      </div>

      <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.08)", margin: "0 auto" }} />

      <div style={{ ...fade(360), fontSize: "12px", color: "rgba(250,248,244,0.28)", textAlign: "center", fontStyle: "italic", marginBottom: "18px" }}>Feeds your daily <strong style={{ color: "rgba(250,248,244,0.45)", fontStyle: "normal", fontWeight: 500 }}>Flow</strong>.</div>

      <div style={{ ...fade(400), fontSize: "13px", color: "rgba(250,248,244,0.38)", textAlign: "center", lineHeight: 1.65, marginBottom: "20px", maxWidth: "280px", fontStyle: "italic" }}>
        You do not have to keep everything in your head anymore.
      </div>

      <div style={{ ...fade(440), fontSize: "11px", color: "rgba(250,248,244,0.16)", letterSpacing: "0.07em" }}>a steadier home, in every season</div>
    </div>
  )
}
