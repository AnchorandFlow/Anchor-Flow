import React, { useState } from "react"

function uid() { return Math.random().toString(36).slice(2, 9) }

function useSaved(key, fallback) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem("af_career_" + key)
      if (!raw) return fallback
      const parsed = JSON.parse(raw)
      return parsed != null ? parsed : fallback
    } catch { return fallback }
  })
  function setSaved(next) {
    setVal(prev => {
      const resolved = typeof next === "function" ? next(prev) : next
      try { localStorage.setItem("af_career_" + key, JSON.stringify(resolved)) } catch {}
      return resolved
    })
  }
  return [val, setSaved]
}

function formatDate(ds) {
  if (!ds) return "—"
  const d = new Date(ds + "T12:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function expiryStatus(ds) {
  if (!ds) return null
  const diff = (new Date(ds) - new Date()) / (1000 * 60 * 60 * 24)
  if (diff < 0)  return { label: "Expired",      bg: "rgba(184,114,101,0.15)", color: "#b87265", border: "rgba(184,114,101,0.3)" }
  if (diff < 90) return { label: "Expires soon", bg: "rgba(200,169,122,0.14)", color: "#c8a97a", border: "rgba(200,169,122,0.3)" }
  return               { label: "Active",        bg: "rgba(122,158,142,0.14)", color: "#7a9e8e", border: "rgba(122,158,142,0.3)" }
}

function getInitials(name) {
  const parts = (name || "").trim().split(" ")
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name || "?").slice(0, 2).toUpperCase()
}

const T = {
  navy: "#1a2744", gold: "#c8a97a", goldDark: "#9a7a52",
  blue: "#3a6b8a", sage: "#7a9e8e", rose: "#b87265",
  text: "#faf8f4", textMid: "rgba(250,248,244,0.65)",
  textSoft: "rgba(250,248,244,0.42)", textFaint: "rgba(250,248,244,0.25)",
  surf: "rgba(255,255,255,0.04)", bord: "1px solid rgba(255,255,255,0.08)",
  bordGold: "1px solid rgba(200,169,122,0.25)",
}

const inp = {
  width: "100%", background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8,
  padding: "8px 12px", fontSize: 13, color: T.text,
  fontFamily: "DM Sans, sans-serif", outline: "none", boxSizing: "border-box",
}

const lbl = {
  display: "block", fontSize: 10, fontWeight: 700,
  letterSpacing: "0.1em", textTransform: "uppercase",
  color: T.textFaint, fontFamily: "DM Sans, sans-serif", marginBottom: 4,
}

function Modal({ title, onClose, children }) {
  return (
    <div
      onClick={function(e) { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(10,18,36,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
    >
      <div style={{ background: "#1e2e50", border: T.bordGold, borderRadius: 14, padding: "1.4rem 1.5rem", width: "100%", maxWidth: 500, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.1rem" }}>
          <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 18, fontWeight: 600, color: T.text }}>{title}</span>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.textSoft, fontSize: 16 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function PrimaryBtn({ onClick, bg, textColor, children, style }) {
  return (
    <button onClick={onClick} style={{ background: bg || T.blue, color: textColor || "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontFamily: "DM Sans, sans-serif", cursor: "pointer", fontWeight: 600, ...(style || {}) }}>
      {children}
    </button>
  )
}

function GhostBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontFamily: "DM Sans, sans-serif", cursor: "pointer", color: T.textSoft }}>
      {children}
    </button>
  )
}

function Field({ label, children }) {
  return <div style={{ marginBottom: "0.75rem" }}><label style={lbl}>{label}</label>{children}</div>
}

function FieldRow({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>{children}</div>
}

function SectionHeader({ title, sub, onAdd, addBg, addColor }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.85rem" }}>
      <div>
        <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 18, fontWeight: 600, color: T.text }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: T.textSoft, marginTop: 2 }}>{sub}</div>}
      </div>
      <PrimaryBtn onClick={onAdd} bg={addBg} textColor={addColor} style={{ fontSize: 11 }}>+ Add</PrimaryBtn>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div style={{ background: T.surf, border: T.bord, borderRadius: 10, padding: "1.5rem", textAlign: "center", fontSize: 12, color: T.textFaint, fontFamily: "DM Sans, sans-serif" }}>
      {message}
    </div>
  )
}

// ── Licenses ──────────────────────────────────────────────────────────────────
function LicenseForm({ initial, onSave, onClose }) {
  const blank = { title: "", state: "", expiry: "", ceuNeeded: 0, ceuCompleted: 0, website: "", notes: "" }
  const [f, setF] = useState(initial || blank)
  const set = function(k, v) { setF(function(p) { return { ...p, [k]: v } }) }
  return (
    <div>
      <FieldRow>
        <Field label="License / certification"><input value={f.title} onChange={function(e) { set("title", e.target.value) }} placeholder="e.g. Registered Nurse (RN)" style={inp} autoFocus /></Field>
        <Field label="State / jurisdiction"><input value={f.state} onChange={function(e) { set("state", e.target.value) }} placeholder="e.g. Colorado" style={inp} /></Field>
      </FieldRow>
      <FieldRow>
        <Field label="Expiration date"><input type="date" value={f.expiry} onChange={function(e) { set("expiry", e.target.value) }} style={inp} /></Field>
        <Field label="Renewal website"><input value={f.website} onChange={function(e) { set("website", e.target.value) }} placeholder="https://" style={inp} /></Field>
      </FieldRow>
      <FieldRow>
        <Field label="CEU hours required"><input type="number" min="0" value={f.ceuNeeded} onChange={function(e) { set("ceuNeeded", parseInt(e.target.value) || 0) }} style={inp} /></Field>
        <Field label="CEU hours completed"><input type="number" min="0" value={f.ceuCompleted} onChange={function(e) { set("ceuCompleted", parseInt(e.target.value) || 0) }} style={inp} /></Field>
      </FieldRow>
      <Field label="Notes"><textarea value={f.notes} onChange={function(e) { set("notes", e.target.value) }} placeholder="Renewal requirements, reminders…" rows={3} style={{ ...inp, resize: "vertical" }} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={function() { if (!f.title.trim()) return; onSave({ ...f, id: f.id || uid() }) }} bg={T.blue}>Save</PrimaryBtn>
      </div>
    </div>
  )
}

function LicensesPanel({ licenses, setLicenses }) {
  const [editing, setEditing] = useState(null)
  const totalNeeded    = licenses.reduce(function(a, l) { return a + (l.ceuNeeded    || 0) }, 0)
  const totalCompleted = licenses.reduce(function(a, l) { return a + (l.ceuCompleted || 0) }, 0)
  function save(item) {
    if (editing === "new") setLicenses(function(p) { return [...p, item] })
    else setLicenses(function(p) { return p.map(function(x) { return x.id === item.id ? item : x }) })
    setEditing(null)
  }
  return (
    <section style={{ marginBottom: "1.75rem" }}>
      <SectionHeader title="Licenses & Certifications" sub={totalNeeded > 0 ? "CEU total: " + totalCompleted + " / " + totalNeeded + " hrs" : null} onAdd={function() { setEditing("new") }} addBg={T.blue} />
      {licenses.length === 0 && <EmptyState message="No licenses yet — add your professional licenses and certifications." />}
      {licenses.map(function(l) {
        const st  = expiryStatus(l.expiry)
        const pct = l.ceuNeeded > 0 ? Math.min(100, Math.round((l.ceuCompleted / l.ceuNeeded) * 100)) : null
        return (
          <div key={l.id} style={{ background: T.surf, border: T.bord, borderLeft: "4px solid " + T.blue, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: "DM Sans, sans-serif" }}>{l.title}</div>
                {l.state && <div style={{ fontSize: 11, color: T.textSoft, marginTop: 2, fontFamily: "DM Sans, sans-serif" }}>{l.state}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {st && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, whiteSpace: "nowrap", background: st.bg, color: st.color, border: "1px solid " + st.border, fontFamily: "DM Sans, sans-serif", fontWeight: 600 }}>{st.label}</span>}
                <button onClick={function() { setEditing(l) }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSoft, fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>Edit</button>
                <button onClick={function() { if (window.confirm("Remove this license?")) setLicenses(function(p) { return p.filter(function(x) { return x.id !== l.id }) }) }} style={{ background: "none", border: "none", cursor: "pointer", color: T.rose, fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>Remove</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem 1rem", marginBottom: pct !== null ? 8 : 0 }}>
              {l.expiry && <div><div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "DM Sans, sans-serif" }}>Expires</div><div style={{ fontSize: 13, color: T.text, fontFamily: "DM Sans, sans-serif" }}>{formatDate(l.expiry)}</div></div>}
              {l.website && <div><div style={{ fontSize: 10, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "DM Sans, sans-serif" }}>Renewal site</div><a href={l.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: T.blue, textDecoration: "none" }}>Open ↗</a></div>}
            </div>
            {pct !== null && (
              <div style={{ marginBottom: l.notes ? 8 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textSoft, marginBottom: 4, fontFamily: "DM Sans, sans-serif" }}>
                  <span>CEU progress</span><span>{l.ceuCompleted} / {l.ceuNeeded} hrs ({pct}%)</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 2, background: pct >= 100 ? T.sage : T.blue, width: pct + "%" }} />
                </div>
              </div>
            )}
            {l.notes && <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: T.textSoft, fontStyle: "italic", fontFamily: "DM Sans, sans-serif" }}>{l.notes}</div>}
          </div>
        )
      })}
      {editing && <Modal title={editing === "new" ? "Add license" : "Edit license"} onClose={function() { setEditing(null) }}><LicenseForm initial={editing === "new" ? null : editing} onSave={save} onClose={function() { setEditing(null) }} /></Modal>}
    </section>
  )
}

// ── Past Contacts ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: "rgba(58,107,138,0.25)",  text: "#6ba3c4" },
  { bg: "rgba(122,158,142,0.25)", text: "#7a9e8e"  },
  { bg: "rgba(200,169,122,0.2)",  text: "#c8a97a"  },
  { bg: "rgba(184,114,101,0.2)",  text: "#b87265"  },
  { bg: "rgba(136,120,184,0.2)",  text: "#8878b8"  },
]

function ContactForm({ initial, onSave, onClose }) {
  const blank = { name: "", title: "", company: "", email: "", phone: "", relationship: "", notes: "" }
  const [f, setF] = useState(initial || blank)
  const set = function(k, v) { setF(function(p) { return { ...p, [k]: v } }) }
  return (
    <div>
      <FieldRow>
        <Field label="Full name"><input value={f.name} onChange={function(e) { set("name", e.target.value) }} placeholder="Name" style={inp} autoFocus /></Field>
        <Field label="Job title"><input value={f.title} onChange={function(e) { set("title", e.target.value) }} placeholder="e.g. Director of Nursing" style={inp} /></Field>
      </FieldRow>
      <Field label="Company / organization"><input value={f.company} onChange={function(e) { set("company", e.target.value) }} placeholder="e.g. UCHealth" style={inp} /></Field>
      <FieldRow>
        <Field label="Email"><input type="email" value={f.email} onChange={function(e) { set("email", e.target.value) }} placeholder="email@example.com" style={inp} /></Field>
        <Field label="Phone"><input value={f.phone} onChange={function(e) { set("phone", e.target.value) }} placeholder="(555) 000-0000" style={inp} /></Field>
      </FieldRow>
      <Field label="Relationship / context"><input value={f.relationship} onChange={function(e) { set("relationship", e.target.value) }} placeholder="e.g. Former manager, reference for ICU role" style={inp} /></Field>
      <Field label="Notes"><textarea value={f.notes} onChange={function(e) { set("notes", e.target.value) }} placeholder="What they can speak to, when you last connected…" rows={3} style={{ ...inp, resize: "vertical" }} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={function() { if (!f.name.trim()) return; onSave({ ...f, id: f.id || uid() }) }} bg={T.gold} textColor={T.navy}>Save</PrimaryBtn>
      </div>
    </div>
  )
}

function ContactsPanel({ contacts, setContacts }) {
  const [editing, setEditing] = useState(null)
  function save(item) {
    if (editing === "new") setContacts(function(p) { return [...p, item] })
    else setContacts(function(p) { return p.map(function(x) { return x.id === item.id ? item : x }) })
    setEditing(null)
  }
  return (
    <section style={{ marginBottom: "1.75rem" }}>
      <SectionHeader title="Past Contacts" onAdd={function() { setEditing("new") }} addBg={T.gold} addColor={T.navy} />
      {contacts.length === 0 && <EmptyState message="No contacts yet — keep track of managers and references here." />}
      {contacts.map(function(c, idx) {
        const av = AVATAR_COLORS[idx % AVATAR_COLORS.length]
        return (
          <div key={c.id} style={{ background: T.surf, border: T.bord, borderLeft: "4px solid " + T.gold, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: av.bg, color: av.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, fontFamily: "DM Sans, sans-serif", flexShrink: 0 }}>{getInitials(c.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: "DM Sans, sans-serif" }}>{c.name}</div>
                    {(c.title || c.company) && <div style={{ fontSize: 11, color: T.textSoft, marginTop: 2, fontFamily: "DM Sans, sans-serif" }}>{[c.title, c.company].filter(Boolean).join(" · ")}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={function() { setEditing(c) }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSoft, fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>Edit</button>
                    <button onClick={function() { if (window.confirm("Remove this contact?")) setContacts(function(p) { return p.filter(function(x) { return x.id !== c.id }) }) }} style={{ background: "none", border: "none", cursor: "pointer", color: T.rose, fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>Remove</button>
                  </div>
                </div>
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                  {c.email && <div style={{ fontSize: 12, color: T.textSoft, fontFamily: "DM Sans, sans-serif" }}>✉ {c.email}</div>}
                  {c.phone && <div style={{ fontSize: 12, color: T.textSoft, fontFamily: "DM Sans, sans-serif" }}>☎ {c.phone}</div>}
                  {c.relationship && <div style={{ fontSize: 11, color: T.textFaint, fontStyle: "italic", fontFamily: "DM Sans, sans-serif" }}>{c.relationship}</div>}
                </div>
                {c.notes && <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: T.textSoft, fontStyle: "italic", fontFamily: "DM Sans, sans-serif" }}>{c.notes}</div>}
              </div>
            </div>
          </div>
        )
      })}
      {editing && <Modal title={editing === "new" ? "Add contact" : "Edit contact"} onClose={function() { setEditing(null) }}><ContactForm initial={editing === "new" ? null : editing} onSave={save} onClose={function() { setEditing(null) }} /></Modal>}
    </section>
  )
}

// ── Retirement Accounts ───────────────────────────────────────────────────────
const ACCT_TYPES = ["401(k)", "403(b)", "IRA", "Roth IRA", "457(b)", "Pension", "Other"]

function RetirementForm({ initial, onSave, onClose }) {
  const blank = { institution: "", accountType: "401(k)", employer: "", website: "", notes: "" }
  const [f, setF] = useState(initial || blank)
  const set = function(k, v) { setF(function(p) { return { ...p, [k]: v } }) }
  return (
    <div>
      <FieldRow>
        <Field label="Institution"><input value={f.institution} onChange={function(e) { set("institution", e.target.value) }} placeholder="e.g. Fidelity, Vanguard" style={inp} autoFocus /></Field>
        <Field label="Account type">
          <select value={f.accountType} onChange={function(e) { set("accountType", e.target.value) }} style={{ ...inp, appearance: "none" }}>
            {ACCT_TYPES.map(function(t) { return <option key={t} value={t} style={{ background: T.navy }}>{t}</option> })}
          </select>
        </Field>
      </FieldRow>
      <Field label="Former employer (if applicable)"><input value={f.employer} onChange={function(e) { set("employer", e.target.value) }} placeholder="Company that held this account" style={inp} /></Field>
      <Field label="Portal website"><input value={f.website} onChange={function(e) { set("website", e.target.value) }} placeholder="https://" style={inp} /></Field>
      <Field label="Notes"><textarea value={f.notes} onChange={function(e) { set("notes", e.target.value) }} placeholder="Account # (last 4), rollover status, advisor contact…" rows={3} style={{ ...inp, resize: "vertical" }} /></Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <PrimaryBtn onClick={function() { if (!f.institution.trim()) return; onSave({ ...f, id: f.id || uid() }) }} bg={T.gold} textColor={T.navy}>Save</PrimaryBtn>
      </div>
    </div>
  )
}

function RetirementPanel({ accounts, setAccounts }) {
  const [editing, setEditing] = useState(null)
  function save(item) {
    if (editing === "new") setAccounts(function(p) { return [...p, item] })
    else setAccounts(function(p) { return p.map(function(x) { return x.id === item.id ? item : x }) })
    setEditing(null)
  }
  return (
    <section style={{ marginBottom: "1.75rem" }}>
      <SectionHeader title="Retirement Accounts" onAdd={function() { setEditing("new") }} addBg={T.gold} addColor={T.navy} />
      {accounts.length === 0 && <EmptyState message="No accounts yet — track where your 401(k)s and IRAs are held." />}
      {accounts.map(function(a) {
        return (
          <div key={a.id} style={{ background: T.surf, border: T.bord, borderLeft: "4px solid rgba(200,169,122,0.6)", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(200,169,122,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🏦</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: "DM Sans, sans-serif" }}>{a.institution}</div>
                  <div style={{ fontSize: 11, color: T.textSoft, marginTop: 2, fontFamily: "DM Sans, sans-serif" }}>{a.accountType}{a.employer ? " · " + a.employer : ""}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={function() { setEditing(a) }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textSoft, fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>Edit</button>
                <button onClick={function() { if (window.confirm("Remove this account?")) setAccounts(function(p) { return p.filter(function(x) { return x.id !== a.id }) }) }} style={{ background: "none", border: "none", cursor: "pointer", color: T.rose, fontSize: 11, fontFamily: "DM Sans, sans-serif" }}>Remove</button>
              </div>
            </div>
            {a.website && <a href={a.website} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: T.blue, textDecoration: "none", marginBottom: a.notes ? 6 : 0 }}>Account portal ↗</a>}
            {a.notes && <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: T.textSoft, fontStyle: "italic", fontFamily: "DM Sans, sans-serif" }}>{a.notes}</div>}
          </div>
        )
      })}
      {editing && <Modal title={editing === "new" ? "Add account" : "Edit account"} onClose={function() { setEditing(null) }}><RetirementForm initial={editing === "new" ? null : editing} onSave={save} onClose={function() { setEditing(null) }} /></Modal>}
    </section>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CareerSection() {
  const [licenses,   setLicenses]   = useSaved("licenses",   [])
  const [contacts,   setContacts]   = useSaved("contacts",   [])
  const [retirement, setRetirement] = useSaved("retirement", [])

  return (
    <div style={{ fontFamily: "DM Sans, sans-serif" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(200,169,122,0.5)", marginBottom: 4 }}>Anchor Vault</div>
        <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 24, fontWeight: 600, color: "#faf8f4" }}>Career</div>
        <div style={{ fontSize: 12, color: "rgba(250,248,244,0.42)", marginTop: 2 }}>Licenses, references &amp; retirement accounts.</div>
      </div>
      <LicensesPanel   licenses={licenses}   setLicenses={setLicenses}     />
      <ContactsPanel   contacts={contacts}   setContacts={setContacts}     />
      <RetirementPanel accounts={retirement} setAccounts={setRetirement}   />
    </div>
  )
}
