# Pass 1: Sidebar rebuild only
# - 196px mockup nav (Today/Flow group/Anchor/Ripples/Sunset/SignOut)
# - content area marginLeft 68px → 196px
# - AnchorVault left: 68 → 196
# NO CSS injection, NO AnchorTab changes, NO other JSX changes

import re

# ── App.jsx ───────────────────────────────────────────────────────────────────
with open('src/App.jsx', 'r') as f:
    src = f.read()

original_lines = src.count('\n')
print(f"App.jsx: {original_lines} lines")

CRITICAL = ['isRemotePayloadSafe','createLocalBackup','SYNC_KEYS','closeDay',
            'supabase.auth','householdId','debouncedSync']
for fn in CRITICAL:
    assert fn in src, f"SAFETY: {fn} missing"

applied = []

# ── 1. NAV labels (needed for sidebar sub-items to show correct names) ────────
nav_fixes = [
    ('label: "Flow",     emoji: "🌊"',  'label: "Today",     emoji: "🏠"'),
    ('label: "Mind",     emoji: "💭"',  'label: "Exhale",    emoji: "🌬️"'),
    ('label: "School",   emoji: "🏫"',  'label: "Lighthouse",emoji: "🏮"'),
    ('label: "Weekly",   emoji: "📅"',  'label: "Rhythm",    emoji: "📅"'),
    ('label: "Cove",     emoji: "🪸"',  'label: "Coves",     emoji: "🗺️"'),
    ('label: "Tide Pool", emoji: "🏝️"','label: "Tide Pool", emoji: "🐚"'),
    ('label: "Ripples",   emoji: "🌊"', 'label: "Ripples",   emoji: "✨"'),
]
for old, new in nav_fixes:
    if old in src:
        src = src.replace(old, new, 1)
        applied.append(f'  ✓ NAV label: {old[:25]!r}')

# ── 2. Replace the full old 68px sidebar with 196px mockup nav ────────────────
OLD_SIDEBAR = '''      <div style={{ width: "68px", background: "#1a2744", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0 8px", gap: "2px", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 200, borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto" }}>
        <button onClick={onHome} style={{ background: "none", border: "none", cursor: "pointer", marginBottom: "8px", padding: "6px 0", width: "100%", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "12px", color: "#c8a97a", letterSpacing: "0.04em", lineHeight: 1.1, textAlign: "center" }}>A&F</div>
        </button>

        {/* ── ⚓ Anchor vault button — always visible ── */}
        <button onClick={() => { setShowAnchor(true); setVaultSection("home"); }} title="Anchor Vault" style={{ background: showAnchor ? "rgba(200,169,122,0.25)" : "rgba(200,169,122,0.08)", border: showAnchor ? "1px solid rgba(200,169,122,0.5)" : "1px solid rgba(200,169,122,0.2)", borderRadius: "8px", cursor: "pointer", padding: "8px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", marginBottom: "2px", flexShrink: 0 }}>
          <span style={{ fontSize: "15px" }}>⚓</span>
          <span style={{ fontSize: "7px", color: showAnchor ? "#c8a97a" : "rgba(200,169,122,0.5)", fontWeight: 700, fontFamily: "DM Sans,sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>Anchor</span>
        </button>

        <div style={{ width: "32px", height: "0.5px", background: "rgba(255,255,255,0.08)", marginBottom: "4px", flexShrink: 0 }} />

        {showAnchor ? (
          <>
            {/* ── 🌊 Flow — always shown even inside vault ── */}
            <button onClick={() => { setShowAnchor(false); _setActiveTab("anchor"); }} title="Flow" style={{ background: "none", border: "none", borderLeft: "2px solid transparent", borderRadius: "0 8px 8px 0", cursor: "pointer", padding: "9px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", transition: "all 0.15s", flexShrink: 0 }}>
              <span style={{ fontSize: "14px", lineHeight: 1, opacity: 0.6 }}>🌊</span>
              <span style={{ fontSize: "7px", color: "rgba(200,169,122,0.5)", fontWeight: 500, fontFamily: "DM Sans, sans-serif", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center" }}>Flow</span>
            </button>
            <div style={{ width: "32px", height: "0.5px", background: "rgba(255,255,255,0.06)", margin: "2px 0 4px", flexShrink: 0 }} />
            {/* ── Vault section nav ── */}
            {VAULT_NAV.map(item => {
              var isActive = vaultSection === item.id;
              var isDimmed = item.id !== "settings" && item.id !== "home" && anchorHidden[item.id];
              return (
                <button key={item.id} onClick={() => setVaultSection(item.id)} title={item.label} style={{ background: isActive ? "rgba(200,169,122,0.14)" : "none", border: "none", borderLeft: isActive ? "2px solid #c8a97a" : "2px solid transparent", borderRadius: "0 8px 8px 0", cursor: "pointer", padding: "9px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", transition: "all 0.15s", opacity: isDimmed ? 0.35 : 1, flexShrink: 0 }}>
                  <span style={{ fontSize: "14px", lineHeight: 1 }}>{item.emoji}</span>
                  <span style={{ fontSize: "7px", color: isActive ? "#c8a97a" : "rgba(250,248,244,0.5)", fontWeight: isActive ? 700 : 500, fontFamily: "DM Sans, sans-serif", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center" }}>{item.label}</span>
                </button>
              );
            })}
          </>
        ) : (
          /* ── Regular app nav ── */
          NAV.map(item => {
            var isActive = !showAnchor && activeTab === item.id;
            var isHidden = item.id !== "settings" && item.id !== "anchor" && item.id !== "cove" && sections && sections[item.id] === false;
            if (isHidden) return null;
            return (
              <button key={item.id} onClick={() => { setShowAnchor(false); _setActiveTab(item.id); }} title={item.label} style={{ background: isActive ? "rgba(200,169,122,0.14)" : "none", border: "none", borderLeft: isActive ? "2px solid #c8a97a" : "2px solid transparent", borderRadius: "0 8px 8px 0", cursor: "pointer", padding: "8px 0", width: "56px", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", transition: "all 0.15s", flexShrink: 0 }}>
                <span style={{ fontSize: "14px", lineHeight: 1, opacity: isActive ? 1 : 0.5 }}>{item.emoji}</span>
                <span style={{ fontSize: "7px", color: isActive ? "#c8a97a" : "rgba(200,169,122,0.5)", fontWeight: isActive ? 700 : 500, fontFamily: "DM Sans, sans-serif", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "center" }}>{item.label}</span>
              </button>
            );
          })
        )}
        <div style={{ marginTop: "auto", flexShrink: 0 }}>
          <button onClick={onSignOut} title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 0", width: "56px", display: "flex", justifyContent: "center", opacity: 0.3, color: "#faf8f4", fontSize: "11px", fontFamily: "DM Sans, sans-serif" }}>sign out</button>
        </div>
      </div>'''

NEW_SIDEBAR = '''      <nav style={{ width: "196px", background: "#0e1b2e", display: "flex", flexDirection: "column", padding: "13px 10px 14px", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 200, borderRight: "1px solid rgba(200,169,122,0.08)", overflowY: "auto" }}>

        {/* ── Wordmark ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 2px 10px" }}>
          <button onClick={onHome} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Cormorant Garamond', serif", fontSize: "1.1rem", fontWeight: 500, color: "#f5f0e8", letterSpacing: "0.02em", lineHeight: 1.1, padding: 0 }}>
            Anchor <span style={{ color: "#c8a97a", fontStyle: "italic", fontWeight: 300 }}>&amp;</span> <span style={{ color: "#c8a97a" }}>Flow</span>
          </button>
        </div>
        <div style={{ height: 1, background: "rgba(200,169,122,0.07)", margin: "0 4px 6px" }} />

        {/* ── Today ── */}
        <div onClick={() => { setShowAnchor(false); _setActiveTab("anchor"); }}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 9, cursor: "pointer", transition: "all 0.15s", borderLeft: (!showAnchor && activeTab === "anchor") ? "2px solid #c8a97a" : "2px solid transparent", background: (!showAnchor && activeTab === "anchor") ? "rgba(200,169,122,0.10)" : "transparent" }}>
          <span style={{ fontSize: "0.9rem" }}>🏠</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.81rem", fontFamily: "'DM Sans', sans-serif", fontWeight: (!showAnchor && activeTab === "anchor") ? 600 : 400, color: (!showAnchor && activeTab === "anchor") ? "#dfc49a" : "rgba(245,240,232,0.55)", lineHeight: 1 }}>Today</div>
            <div style={{ fontSize: "0.57rem", color: "rgba(245,240,232,0.3)", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>Family briefing</div>
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(200,169,122,0.07)", margin: "4px 4px" }} />

        {/* ── Flow group ── */}
        <div style={{ fontSize: "0.54rem", color: "rgba(245,240,232,0.28)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 10px 2px", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>Flow</div>
        {["brain","tidepool","school","weekly","calendar"].map(function(id) {
          var item = NAV.find(function(n) { return n.id === id; });
          if (!item || (sections && sections[id] === false)) return null;
          var isAct = !showAnchor && activeTab === id;
          return (
            <div key={id} onClick={function() { setShowAnchor(false); _setActiveTab(id); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 20px", borderRadius: 7, cursor: "pointer", transition: "all 0.11s", background: isAct ? "rgba(200,169,122,0.08)" : "transparent", borderLeft: isAct ? "2px solid #c8a97a" : "2px solid transparent" }}>
              <span style={{ fontSize: "0.75rem", opacity: 0.65 }}>{item.emoji}</span>
              <span style={{ fontSize: "0.72rem", fontFamily: "'DM Sans', sans-serif", color: isAct ? "#dfc49a" : "rgba(245,240,232,0.42)", transition: "color 0.11s" }}>{item.label}</span>
            </div>
          );
        })}

        <div style={{ height: 1, background: "rgba(200,169,122,0.07)", margin: "4px 4px" }} />

        {/* ── Anchor ── */}
        <div onClick={function() { setShowAnchor(true); setVaultSection("home"); }}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 9, cursor: "pointer", transition: "all 0.15s", borderLeft: showAnchor ? "2px solid #c8a97a" : "2px solid transparent", background: showAnchor ? "rgba(200,169,122,0.10)" : "transparent" }}>
          <span style={{ fontSize: "0.9rem" }}>⚓</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.81rem", fontFamily: "'DM Sans', sans-serif", fontWeight: showAnchor ? 600 : 400, color: showAnchor ? "#dfc49a" : "rgba(245,240,232,0.55)", lineHeight: 1 }}>Anchor</div>
            <div style={{ fontSize: "0.57rem", color: "rgba(245,240,232,0.3)", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>Everything you carry</div>
          </div>
        </div>
        {showAnchor && VAULT_NAV.map(function(item) {
          var isAct = vaultSection === item.id;
          var isDim = item.id !== "settings" && item.id !== "home" && anchorHidden[item.id];
          return (
            <div key={item.id} onClick={function() { setVaultSection(item.id); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 20px", borderRadius: 7, cursor: "pointer", transition: "all 0.11s", background: isAct ? "rgba(200,169,122,0.08)" : "transparent", borderLeft: isAct ? "2px solid #c8a97a" : "2px solid transparent", opacity: isDim ? 0.35 : 1 }}>
              <span style={{ fontSize: "0.75rem", opacity: 0.65 }}>{item.emoji}</span>
              <span style={{ fontSize: "0.72rem", fontFamily: "'DM Sans', sans-serif", color: isAct ? "#dfc49a" : "rgba(245,240,232,0.42)" }}>{item.label}</span>
            </div>
          );
        })}

        <div style={{ height: 1, background: "rgba(200,169,122,0.07)", margin: "4px 4px" }} />

        {/* ── Ripples ── */}
        <div onClick={function() { setShowAnchor(false); _setActiveTab("ai"); }}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 9, cursor: "pointer", transition: "all 0.15s", borderLeft: (!showAnchor && activeTab === "ai") ? "2px solid #c8a97a" : "2px solid transparent", background: (!showAnchor && activeTab === "ai") ? "rgba(200,169,122,0.10)" : "transparent" }}>
          <span style={{ fontSize: "0.9rem" }}>✨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.81rem", fontFamily: "'DM Sans', sans-serif", fontWeight: (!showAnchor && activeTab === "ai") ? 600 : 400, color: (!showAnchor && activeTab === "ai") ? "#dfc49a" : "rgba(245,240,232,0.55)", lineHeight: 1 }}>Ripples</div>
            <div style={{ fontSize: "0.57rem", color: "rgba(245,240,232,0.3)", fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>Family story</div>
          </div>
        </div>

        {/* ── Bottom: Sunset + Sign out ── */}
        <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ height: 1, background: "rgba(200,169,122,0.07)", margin: "0 4px 6px" }} />
          <div onClick={function() { window.dispatchEvent(new CustomEvent("af-show-eod")); }}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 9, cursor: "pointer", color: "rgba(245,240,232,0.38)", transition: "all 0.15s" }}
            onMouseEnter={function(e) { e.currentTarget.style.background = "rgba(230,165,126,0.08)"; e.currentTarget.style.color = "#F1C49A"; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = ""; e.currentTarget.style.color = ""; }}>
            <span style={{ fontSize: "1rem" }}>🌇</span>
            <div>
              <div style={{ fontSize: "0.8rem", fontFamily: "'DM Sans', sans-serif" }}>Sunset</div>
              <div style={{ fontSize: "0.57rem", opacity: 0.7, fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>Close the day</div>
            </div>
          </div>
          <div onClick={onSignOut}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 9, cursor: "pointer", color: "rgba(245,240,232,0.38)", transition: "all 0.15s" }}
            onMouseEnter={function(e) { e.currentTarget.style.background = "rgba(200,122,138,0.08)"; e.currentTarget.style.color = "#c87a8a"; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = ""; e.currentTarget.style.color = ""; }}>
            <span style={{ fontSize: "1rem" }}>→</span>
            <div style={{ fontSize: "0.8rem", fontFamily: "'DM Sans', sans-serif" }}>Sign out</div>
          </div>
        </div>
      </nav>'''

assert OLD_SIDEBAR in src, "Old sidebar not found — may already be patched"
src = src.replace(OLD_SIDEBAR, NEW_SIDEBAR, 1)
applied.append('  ✓ Sidebar: 68px → 196px mockup nav with Today/Flow/Anchor/Ripples/Sunset/SignOut')

# ── 3. Content area marginLeft 68px → 196px ──────────────────────────────────
old_margin = '      <div style={{ marginLeft: "68px", flex: 1, minWidth: 0 }}>'
new_margin = '      <div style={{ marginLeft: "196px", flex: 1, minWidth: 0 }}>'
assert old_margin in src, "Content margin not found"
src = src.replace(old_margin, new_margin, 1)
applied.append('  ✓ Content area: marginLeft 68px → 196px')

# ── 4. EOD event listener (sidebar Sunset button needs this) ──────────────────
old_eod_state = '  const [showEndOfDay,setShowEndOfDay]             = useState(false);'
new_eod_state = ('  const [showEndOfDay,setShowEndOfDay]             = useState(false);\n'
                 '  React.useEffect(function(){\n'
                 '    function onShowEOD(){ setShowEndOfDay(true); }\n'
                 '    window.addEventListener("af-show-eod", onShowEOD);\n'
                 '    return function(){ window.removeEventListener("af-show-eod", onShowEOD); };\n'
                 '  }, []);')
if old_eod_state in src:
    src = src.replace(old_eod_state, new_eod_state, 1)
    applied.append('  ✓ EOD: event listener for sidebar Sunset button')
else:
    applied.append('  ~ EOD: listener already applied')

# ── SAFETY CHECK ──────────────────────────────────────────────────────────────
for fn in CRITICAL:
    assert fn in src, f"POST SAFETY: {fn} missing"

# ── WRITE ─────────────────────────────────────────────────────────────────────
with open('src/App.jsx', 'w') as f:
    f.write(src)

print(f"Lines: {original_lines} → {src.count(chr(10))}")
print('\nApplied:')
for a in applied: print(a)
print('\nSafety: all critical functions ✓')
print('\n✓ Pass 1 complete. Run: npm run build')

# ── AnchorVault.jsx — left: 68 → 196 ─────────────────────────────────────────
import os
vault_path = 'src/components/AnchorVault.jsx'
if os.path.exists(vault_path):
    with open(vault_path, 'r') as f:
        vault = f.read()
    vault_changes = 0
    # All three left:68 occurrences
    for old, new in [
        ('left:68,', 'left:196,'),
        ('left: 68,', 'left: 196,'),
    ]:
        n = vault.count(old)
        if n:
            vault = vault.replace(old, new)
            vault_changes += n
    with open(vault_path, 'w') as f:
        f.write(vault)
    print(f'  ✓ AnchorVault: {vault_changes} left:68 → left:196')
else:
    print('  ~ AnchorVault.jsx not found at expected path')
