import { useState } from "react"
import { supabase } from "../lib/supabase"

function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,39,68,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "24px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "400px", fontFamily: "var(--font-sans)", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "18px", background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#9aa3af" }}>×</button>
        {children}
      </div>
    </div>
  )
}

function HouseholdModal({ onClose, onComplete, householdId }) {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const save = async () => {
    if (!name.trim()) return
    setLoading(true)
    await supabase.from("households").update({ name: name.trim() }).eq("id", householdId)
    setLoading(false)
    onComplete("household")
    onClose()
  }
  return (
    <Modal onClose={onClose}>
      <div style={{ fontSize: "20px", fontWeight: 500, color: "#1a2744", marginBottom: "6px", fontFamily: "var(--font-serif)" }}>Name your household</div>
      <div style={{ fontSize: "13px", color: "#5a6678", marginBottom: "20px", lineHeight: 1.6 }}>This is how your home will be identified across Anchor and Flow.</div>
      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="The Miller House" style={{ width: "100%", padding: "11px 13px", border: "0.5px solid rgba(26,39,68,0.16)", borderRadius: "8px", fontSize: "14px", color: "#1a2744", fontFamily: "var(--font-sans)", marginBottom: "14px", boxSizing: "border-box" }} />
      <button onClick={save} disabled={loading} style={{ width: "100%", padding: "12px", background: "#1a2744", color: "#faf8f4", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-sans)" }}>{loading ? "Saving..." : "Save household name"}</button>
    </Modal>
  )
}

function FamilyModal({ onClose, onComplete, householdCode }) {
  const [copied, setCopied] = useState(false)
  const copyCode = () => { navigator.clipboard.writeText(householdCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }
  return (
    <Modal onClose={onClose}>
      <div style={{ fontSize: "20px", fontWeight: 500, color: "#1a2744", marginBottom: "6px", fontFamily: "var(--font-serif)" }}>Invite your family</div>
      <div style={{ fontSize: "13px", color: "#5a6678", marginBottom: "20px", lineHeight: 1.6 }}>Share this code with family members so they can join your household.</div>
      <div style={{ background: "rgba(58,107,138,0.06)", border: "0.5px solid rgba(58,107,138,0.16)", borderRadius: "10px", padding: "16px", textAlign: "center", marginBottom: "14px" }}>
        <div style={{ fontSize: "11px", color: "#9aa3af", marginBottom: "8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Your household code</div>
        <div style={{ fontSize: "28px", fontWeight: 500, color: "#1a2744", letterSpacing: "0.18em", fontFamily: "monospace" }}>{householdCode || "------"}</div>
      </div>
      <button onClick={copyCode} style={{ width: "100%", padding: "11px", background: copied ? "rgba(29,158,117,0.1)" : "rgba(58,107,138,0.08)", border: "0.5px solid " + (copied ? "rgba(29,158,117,0.25)" : "rgba(58,107,138,0.2)"), borderRadius: "8px", fontSize: "13px", fontWeight: 500, color: copied ? "#0f6e56" : "#3a6b8a", cursor: "pointer", fontFamily: "var(--font-sans)" }}>{copied ? "Copied!" : "Copy code"}</button>
      <button onClick={() => { onComplete("family"); onClose() }} style={{ width: "100%", padding: "10px", background: "#1a2744", color: "#faf8f4", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-sans)", marginTop: "8px" }}>Done</button>
    </Modal>
  )
}

function CalendarModal({ onClose, onComplete }) {
  const [loading, setLoading] = useState(false)
  const connect = () => {
    setLoading(true)
    if (window.google?.accounts?.oauth2) {
      const client = window.google.accounts.oauth2.initTokenClient({ client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID, scope: "https://www.googleapis.com/auth/calendar.readonly", callback: async (res) => { if (res.access_token) { await supabase.auth.updateUser({ data: { google_calendar_token: res.access_token } }); onComplete("calendar"); onClose() } setLoading(false) } })
      client.requestAccessToken()
    } else { setLoading(false) }
  }
  return (
    <Modal onClose={onClose}>
      <div style={{ fontSize: "20px", fontWeight: 500, color: "#1a2744", marginBottom: "6px", fontFamily: "var(--font-serif)" }}>Connect Google Calendar</div>
      <div style={{ fontSize: "13px", color: "#5a6678", marginBottom: "20px", lineHeight: 1.6 }}>See your events in daily Flow. Ripple AI uses your calendar to surface smarter suggestions.</div>
      <button onClick={connect} disabled={loading} style={{ width: "100%", padding: "12px", background: "#1a2744", color: "#faf8f4", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-sans)" }}>{loading ? "Connecting..." : "Connect Google Calendar"}</button>
      <button onClick={() => { onComplete("calendar"); onClose() }} style={{ width: "100%", padding: "10px", background: "none", border: "none", fontSize: "12px", color: "#9aa3af", cursor: "pointer", fontFamily: "var(--font-sans)", marginTop: "8px" }}>Skip for now</button>
    </Modal>
  )
}

function PremiumModal({ onClose, session }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const startCheckout = async () => {
    setLoading(true)
    try {
      const { data, error: err } = await supabase.functions.invoke("create-checkout-session", { body: { price_id: import.meta.env.VITE_STRIPE_PRICE_ID, user_id: session?.user?.id, email: session?.user?.email, success_url: window.location.origin + "?upgraded=true", cancel_url: window.location.origin } })
      if (err) throw err
      if (data?.url) window.location.href = data.url
    } catch (err) { setError(err.message); setLoading(false) }
  }
  return (
    <Modal onClose={onClose}>
      <div style={{ fontSize: "20px", fontWeight: 500, color: "#1a2744", marginBottom: "4px", fontFamily: "var(--font-serif)" }}>Anchor and Flow Full System</div>
      <div style={{ fontSize: "13px", color: "#5a6678", marginBottom: "16px", lineHeight: 1.6 }}>Unlock the complete home system.</div>
      <div style={{ background: "#f5f2ec", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px" }}>
        {["Weekly planning + recurring tasks", "Meal planning + auto shopping list", "Full Ripple AI cross-vault suggestions", "Full inventory system", "All Anchor Vault sections", "Multi-user family sync"].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: i < 5 ? "7px" : 0 }}>
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4 8L11 1" stroke="#3a6b8a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: "13px", color: "#1a2744", fontFamily: "var(--font-sans)" }}>{item}</span>
          </div>
        ))}
      </div>
      {error && <div style={{ fontSize: "12px", color: "#e24b4a", marginBottom: "10px" }}>{error}</div>}
      <button onClick={startCheckout} disabled={loading} style={{ width: "100%", padding: "14px", background: "#c8a97a", color: "#1a2744", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-sans)", opacity: loading ? 0.7 : 1 }}>{loading ? "Redirecting..." : "Unlock the full system — $9/mo"}</button>
      <div style={{ fontSize: "11px", color: "#9aa3af", textAlign: "center", marginTop: "10px", fontFamily: "var(--font-sans)" }}>Secure payment via Stripe. Cancel anytime.</div>
    </Modal>
  )
}

export default function SetupModals({ activeStep, onClose, onComplete, householdId, householdCode, session }) {
  if (!activeStep) return null
  return (
    <>
      {activeStep === "household" && <HouseholdModal onClose={onClose} onComplete={onComplete} householdId={householdId} />}
      {activeStep === "family" && <FamilyModal onClose={onClose} onComplete={onComplete} householdCode={householdCode} />}
      {activeStep === "calendar" && <CalendarModal onClose={onClose} onComplete={onComplete} />}
      {activeStep === "premium" && <PremiumModal onClose={onClose} session={session} />}
    </>
  )
}
