import { useState } from "react"
import { supabase } from "../lib/supabase"

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("signup")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [focused, setFocused] = useState(null)

  const inputStyle = (id) => ({
    width: "100%", padding: "12px 14px",
    background: "rgba(255,255,255,0.07)",
    border: "0.5px solid " + (focused === id ? "rgba(200,169,122,0.5)" : "rgba(255,255,255,0.14)"),
    borderRadius: "8px", fontSize: "14px",
    color: "#faf8f4", fontFamily: "var(--font-sans)",
    marginBottom: "14px", outline: "none",
    boxSizing: "border-box",
  })

  const handleSubmit = async () => {
    setError(null)
    if (!email || !password) { setError("Please enter your email and password."); return }
    if (mode === "signup" && !name) { setError("Please enter your name."); return }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return }
    setLoading(true)
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } })
        if (err) throw err
        onAuth(data.session, true)
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (err) throw err
        onAuth(data.session, false)
      }
    } catch (err) {
      setError(err.message || "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })
    if (err) setError(err.message)
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#1a2744", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", fontFamily: "var(--font-sans)" }}>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: 500, color: "#faf8f4", letterSpacing: "0.04em", textAlign: "center", marginBottom: "6px" }}>
        anchor <em style={{ color: "#c8a97a", fontStyle: "italic" }}>&</em> flow
      </div>
      <div style={{ fontSize: "12px", color: "rgba(250,248,244,0.38)", letterSpacing: "0.08em", textAlign: "center", marginBottom: "32px" }}>a steadier home, in every season</div>
      <div style={{ width: "100%", maxWidth: "380px", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: "16px", padding: "28px 28px 24px" }}>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "3px", marginBottom: "24px" }}>
          {["signup", "signin"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(null) }} style={{ flex: 1, padding: "8px", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-sans)", background: mode === m ? "rgba(200,169,122,0.18)" : "transparent", color: mode === m ? "#c8a97a" : "rgba(250,248,244,0.45)" }}>
              {m === "signup" ? "Create account" : "Sign in"}
            </button>
          ))}
        </div>
        {error && <div style={{ background: "rgba(226,75,74,0.12)", border: "0.5px solid rgba(226,75,74,0.3)", borderRadius: "8px", padding: "10px 13px", fontSize: "13px", color: "#f0a0a0", marginBottom: "14px", fontFamily: "var(--font-sans)" }}>{error}</div>}
        {mode === "signup" && (
          <>
            <label style={{ fontSize: "12px", color: "rgba(250,248,244,0.55)", marginBottom: "6px", display: "block" }}>Your name</label>
            <input style={inputStyle("name")} type="text" placeholder="Lindsey" value={name} onChange={e => setName(e.target.value)} onFocus={() => setFocused("name")} onBlur={() => setFocused(null)} autoComplete="given-name" />
          </>
        )}
        <label style={{ fontSize: "12px", color: "rgba(250,248,244,0.55)", marginBottom: "6px", display: "block" }}>Email</label>
        <input style={inputStyle("email")} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} onKeyDown={e => e.key === "Enter" && handleSubmit()} autoComplete="email" />
        <label style={{ fontSize: "12px", color: "rgba(250,248,244,0.55)", marginBottom: "6px", display: "block" }}>Password</label>
        <input style={{ ...inputStyle("password"), marginBottom: "6px" }} type="password" placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setFocused("password")} onBlur={() => setFocused(null)} onKeyDown={e => e.key === "Enter" && handleSubmit()} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        {mode === "signin" && (
          <div style={{ textAlign: "right", marginBottom: "14px" }}>
            <button onClick={async () => { if (!email) { setError("Enter your email first."); return } await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: (typeof window !== "undefined" && window.location && window.location.origin) ? window.location.origin : "https://www.anchorandflowapp.com" }); alert("Check your email for a reset link.") }} style={{ background: "none", border: "none", color: "rgba(200,169,122,0.6)", fontSize: "12px", cursor: "pointer", fontFamily: "var(--font-sans)" }}>Forgot password?</button>
          </div>
        )}
        <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "13px", background: "#c8a97a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600, color: "#1a2744", cursor: "pointer", fontFamily: "var(--font-sans)", marginBottom: "10px", opacity: loading ? 0.7 : 1 }}>{loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}</button>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "18px 0" }}>
          <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontSize: "11px", color: "rgba(250,248,244,0.3)", letterSpacing: "0.06em" }}>or</span>
          <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.1)" }} />
        </div>
        <button onClick={handleGoogle} style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.14)", borderRadius: "10px", fontSize: "14px", fontWeight: 500, color: "rgba(250,248,244,0.82)", cursor: "pointer", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
      <div style={{ marginTop: "20px", fontSize: "12px", color: "rgba(250,248,244,0.25)", textAlign: "center", lineHeight: 1.6 }}>By continuing you agree to our Terms of Service and Privacy Policy.</div>
    </div>
  )
}
