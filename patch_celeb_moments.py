#!/usr/bin/env python3
import sys

def swap(path, old, new, label):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        count = content.count(old)
        if count == 0:
            print(f"✗ {label} — anchor not found in {path}")
            return False
        if count > 1:
            print(f"✗ {label} — anchor appears {count} times (not unique) in {path}")
            return False
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content.replace(old, new, 1))
        print(f"✓ {label}")
        return True
    except Exception as e:
        print(f"✗ {label} — {e}")
        return False

results = []
VAULT = "src/components/AnchorVault.jsx"
MOMENTS = "src/components/MomentsSection.jsx"

# ── 1. Celebrations: add passedThisYear + fix upcoming filter (≤30 days) ──────
# Root cause: `if (next < now) next.setFullYear(...)` advances every past date
# to next year, making diff always ≥ 0. Fix:
#   - Calculate passedThisYear BEFORE the year-advancement loop
#   - Limit upcoming to diff <= 30 (next 30 days only)
results.append(swap(VAULT,
'''  const celebEntries = celebrations.map(function(c) {
    const typeInfo = CELEBRATION_TYPES.find(function(t) { return t.id === c.type }) || CELEBRATION_TYPES[6]
    const next = new Date(year, c.month-1, c.day)
    if (next < now) next.setFullYear(next.getFullYear()+1)
    const diff = Math.round((next - now) / 86400000)
    const age = (c.type === "birthday" && c.year) ? (next.getFullYear() - c.year) : null
    const label = c.name + (age ? " turns " + age : c.type === "anniversary" ? " anniversary" : "")
    return { ...c, typeInfo, next, diff, label, emoji: typeInfo.emoji, soon: diff <= 14 }
  })

  const all = celebEntries.sort(function(a, b) { return a.diff - b.diff })
  const upcoming = all.filter(function(e) { return e.diff >= 0 })
  const past = all.filter(function(e) { return e.diff < 0 })
  const shown = filter === "upcoming" ? upcoming : all''',
'''  const passedThisYear = celebrations.filter(function(c) {
    const thisYear = new Date(year, c.month-1, c.day)
    return thisYear < now
  }).length

  const celebEntries = celebrations.map(function(c) {
    const typeInfo = CELEBRATION_TYPES.find(function(t) { return t.id === c.type }) || CELEBRATION_TYPES[6]
    const next = new Date(year, c.month-1, c.day)
    if (next < now) next.setFullYear(next.getFullYear()+1)
    const diff = Math.round((next - now) / 86400000)
    const age = (c.type === "birthday" && c.year) ? (next.getFullYear() - c.year) : null
    const label = c.name + (age ? " turns " + age : c.type === "anniversary" ? " anniversary" : "")
    return { ...c, typeInfo, next, diff, label, emoji: typeInfo.emoji, soon: diff <= 14 }
  })

  const all = celebEntries.sort(function(a, b) { return a.diff - b.diff })
  const upcoming = all.filter(function(e) { return e.diff >= 0 && e.diff <= 30 })
  const past = all.filter(function(e) { return e.diff < 0 })
  const shown = filter === "upcoming" ? upcoming : all''',
"1. Celebrations: add passedThisYear + limit upcoming to ≤30 days"))

# ── 2. Celebrations: fix stat display to use passedThisYear ───────────────────
results.append(swap(VAULT,
'      <div style={{ fontSize: 12, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", marginBottom: 16 }}>{upcoming.length} upcoming · {past.length} passed this year</div>',
'      <div style={{ fontSize: 12, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", marginBottom: 16 }}>{upcoming.length} upcoming · {passedThisYear} passed this year</div>',
"2. Celebrations: use passedThisYear in stat line"))

# ── 3. Moments: add useEffect to import ──────────────────────────────────────
results.append(swap(MOMENTS,
'import { useState } from "react"',
'import { useState, useEffect } from "react"',
"3. MomentsSection: add useEffect to import"))

# ── 4. Moments: add viewDetail state ─────────────────────────────────────────
results.append(swap(MOMENTS,
'  const [selected, setSelected] = useState(null)',
'  const [selected, setSelected] = useState(null)\n  const [viewDetail, setViewDetail] = useState(false)',
"4. MomentsSection: add viewDetail state"))

# ── 5. Moments: add useEffect reset, isPastMoment, createTemplate, and prompt ─
# Replaces the single `if (selectedMoment)` early return with:
#   - useEffect to reset viewDetail when selection changes
#   - isPastMoment check
#   - createTemplate helper (saves to af_moment_templates)
#   - Post-event prompt for past moments (with viewDetail escape hatch)
#   - Original MomentDetail for future/no-date moments (or after "View details")
results.append(swap(MOMENTS,
'''  const selectedMoment = moments.find(m=>m.id===selected)

  if (selectedMoment) return <MomentDetail moment={selectedMoment} onUpdate={updateMoment} onBack={()=>setSelected(null)} onDelete={deleteMoment}/>''',
'''  const selectedMoment = moments.find(m=>m.id===selected)
  useEffect(function() { setViewDetail(false); }, [selected])

  const isPastMoment = selectedMoment && selectedMoment.date && new Date(selectedMoment.date + "T00:00:00") < new Date()

  function createTemplate() {
    try {
      var tmpls = JSON.parse(localStorage.getItem("af_moment_templates") || "[]")
      tmpls.push({ id: uid(), name: selectedMoment.name, type: selectedMoment.type, notes: selectedMoment.notes || [], shopping: selectedMoment.shopping || [], packing: selectedMoment.packing || {}, itinerary: selectedMoment.itinerary || {}, food: selectedMoment.food || [], createdFrom: selectedMoment.id })
      localStorage.setItem("af_moment_templates", JSON.stringify(tmpls))
    } catch(ex) {}
    setSelected(null)
  }

  if (selectedMoment && isPastMoment && !viewDetail) return (
    <div style={{ padding: "0 0 2rem" }}>
      <button onClick={function() { setSelected(null); }} style={{ background: "none", border: "none", color: "rgba(250,248,244,0.6)", cursor: "pointer", fontFamily: "DM Sans,sans-serif", fontSize: 13, padding: "0 0 16px", display: "flex", alignItems: "center", gap: 4 }}>← Back</button>
      <div style={{ textAlign: "center", padding: "32px 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>{selectedMoment.type === "party" ? "🎉" : "✈️"}</div>
        <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 700, color: "#faf8f4", marginBottom: 8 }}>{selectedMoment.name}</div>
        {selectedMoment.date && <div style={{ fontSize: 12, color: "rgba(250,248,244,0.4)", marginBottom: 20 }}>{new Date(selectedMoment.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>}
        <div style={{ fontSize: 15, color: "rgba(250,248,244,0.65)", fontFamily: "DM Sans,sans-serif", marginBottom: 28, lineHeight: 1.5 }}>This moment has passed — what would you like to do?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 280, margin: "0 auto" }}>
          <button onClick={createTemplate} style={{ background: "rgba(200,169,122,0.15)", border: "1.5px solid rgba(200,169,122,0.4)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>📋 Create a template</button>
          <button onClick={function() { setSelected(null); }} style={{ background: "rgba(106,163,196,0.12)", border: "1.5px solid rgba(106,163,196,0.3)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#6ba3c4", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>💾 Save & keep</button>
          <button onClick={function() { if (window.confirm("Delete this moment?")) deleteMoment(selectedMoment.id); }} style={{ background: "rgba(201,122,122,0.1)", border: "1.5px solid rgba(201,122,122,0.25)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#c97a7a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>🗑 Delete</button>
        </div>
        <button onClick={function() { setViewDetail(true); }} style={{ marginTop: 20, background: "none", border: "none", color: "rgba(250,248,244,0.3)", fontSize: 11, fontFamily: "DM Sans,sans-serif", cursor: "pointer" }}>View / edit details →</button>
      </div>
    </div>
  )

  if (selectedMoment) return <MomentDetail moment={selectedMoment} onUpdate={updateMoment} onBack={function(){ setSelected(null); setViewDetail(false); }} onDelete={deleteMoment}/>''',
"5. MomentsSection: post-event prompt for past moments"))

passed = sum(1 for r in results if r)
total  = len(results)
print(f"\nApplied: {passed} of {total}")
sys.exit(0 if passed == total else 1)
