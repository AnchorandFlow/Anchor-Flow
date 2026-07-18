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

# ── BUG 1: Ripples add flow ───────────────────────────────────────────────────
# RipplesRoom.jsx: quickAdd delegates to props.onCapture which is never passed.
# Fix: add self-contained add-ripple modal with direct localStorage write.
RIPPLES = "src/shell/RipplesRoom.jsx"

# 1a. Replace quickAdd + add state vars + saveRipple function
results.append(swap(RIPPLES,
'  function quickAdd(category) { if (props.onCapture) props.onCapture(category); }\n\n  // ── tradition helpers ──',
'''  var [addOpen, setAddOpen] = useState(false);
  var [addForm, setAddForm] = useState({ name: "", who: "", category: "milestone", date: "", note: "" });

  function quickAdd(category) {
    var today = new Date().toISOString().slice(0, 10);
    setAddForm({ name: "", who: "", category: category || "milestone", date: today, note: "" });
    setAddOpen(true);
  }
  function saveRipple(form) {
    var item = { id: "r-" + Date.now(), name: form.name.trim(), who: form.who, category: form.category, date: form.date, note: form.note };
    var next = [item].concat(ripples);
    setRipples(next);
    try { localStorage.setItem("af_ripples", JSON.stringify(next)); } catch(e) {}
    window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key: "ripples" } }));
    setAddOpen(false);
  }

  // ── tradition helpers ──''',
"1a. RipplesRoom: quickAdd → opens modal + saveRipple + addOpen/addForm state"))

# 1b. Add the add-ripple modal overlay before the component's closing div
results.append(swap(RIPPLES,
'      <div style={{ fontSize: ".76rem", color: C.t3, lineHeight: 1.6 }}>One day soon, Compass will weave a year of ripples into a keepsake book — photos, milestones, and quotes together.</div>\n        </div>\n      )}\n    </div>\n  );\n}',
'''      <div style={{ fontSize: ".76rem", color: C.t3, lineHeight: 1.6 }}>One day soon, Compass will weave a year of ripples into a keepsake book — photos, milestones, and quotes together.</div>
        </div>
      )}

    {/* ── Add-ripple modal ── */}
    {addOpen && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
        <div style={{ background: "#1E5B63", border: "1px solid " + C.border, borderRadius: 16, padding: "20px", width: "100%", maxWidth: 380 }}>
          <div style={{ fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: C.sea, marginBottom: 12 }}>Capture a ripple</div>
          <input value={addForm.name} onChange={function(e){ setAddForm(function(p){ return Object.assign({},p,{name:e.target.value}); }); }} placeholder="What happened? (e.g. First steps!)"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.border, background: "rgba(183,212,207,.06)", color: C.t1, fontSize: ".82rem", fontFamily: SANS, marginBottom: 10, outline: "none", boxSizing: "border-box" }} autoFocus />
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ".62rem", color: C.t3, marginBottom: 4 }}>Category</div>
              <select value={addForm.category} onChange={function(e){ setAddForm(function(p){ return Object.assign({},p,{category:e.target.value}); }); }}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.border, background: "rgba(23,71,78,.9)", color: C.t1, fontSize: ".78rem", fontFamily: SANS, outline: "none" }}>
                <option value="milestone">Milestone</option>
                <option value="firsts">First</option>
                <option value="school">Learning win</option>
                <option value="sports">Sports</option>
                <option value="funny">Funny</option>
                <option value="faith">Faith</option>
                <option value="other">Memory</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ".62rem", color: C.t3, marginBottom: 4 }}>Date</div>
              <input type="date" value={addForm.date} onChange={function(e){ setAddForm(function(p){ return Object.assign({},p,{date:e.target.value}); }); }}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid " + C.border, background: "rgba(23,71,78,.9)", color: C.t1, fontSize: ".78rem", fontFamily: SANS, outline: "none" }} />
            </div>
          </div>
          <textarea value={addForm.note} onChange={function(e){ setAddForm(function(p){ return Object.assign({},p,{note:e.target.value}); }); }} placeholder="Notes (optional)" rows={2}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.border, background: "rgba(183,212,207,.06)", color: C.t1, fontSize: ".78rem", fontFamily: SANS, resize: "none", marginBottom: 12, outline: "none", lineHeight: 1.5, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <div onClick={function(){ if(addForm.name.trim()) saveRipple(addForm); }} style={{ flex: 1, padding: "9px 16px", borderRadius: 9, background: C.sea, color: C.bg3, fontSize: ".78rem", fontWeight: 700, cursor: "pointer", textAlign: "center" }}>Save ripple</div>
            <div onClick={function(){ setAddOpen(false); }} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid " + C.border, color: C.t2, fontSize: ".78rem", cursor: "pointer" }}>Cancel</div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}''',
"1b. RipplesRoom: add-ripple modal overlay"))

# ── BUG 2: Dashboard grocery quick-add ───────────────────────────────────────
# AnchorVault.jsx: quickAddShop writes directly to localStorage but App.jsx's
# shoppingItems React state never gets updated, so items don't appear in the UI.
# Fix: dispatch af-shopping-add (which App.jsx listens for) instead.
VAULT = "src/components/AnchorVault.jsx"

results.append(swap(VAULT,
'''  function quickAddShop(){
    var t = (shopVal||"").trim(); if(!t) return
    var list = []
    try { list = JSON.parse(localStorage.getItem("af_shoppingItems")||"[]"); if(!Array.isArray(list)) list=[] } catch(e){ list=[] }
    var item = { id: "s_"+Math.random().toString(36).slice(2,9), text: t, done: false, store: "Grocery Store" }
    localStorage.setItem("af_shoppingItems", JSON.stringify(list.concat([item])))
    try { var dk = JSON.parse(localStorage.getItem("af_dirtyKeys")||"[]"); if(!dk.includes("shoppingItems")){ dk.push("shoppingItems"); localStorage.setItem("af_dirtyKeys", JSON.stringify(dk)); } } catch(e){}
    window.dispatchEvent(new CustomEvent("af-data-changed",{detail:{key:"shoppingItems"}}))
    setShopVal(""); setShopMsg("Added: "+t); setTimeout(function(){ setShopMsg(""); }, 2200)
  }''',
'''  function quickAddShop(){
    var t = (shopVal||"").trim(); if(!t) return
    window.dispatchEvent(new CustomEvent("af-shopping-add",{detail:{text:t,store:"Grocery"}}))
    setShopVal(""); setShopMsg("Added to list: "+t); setTimeout(function(){ setShopMsg(""); }, 2200)
  }''',
"2. AnchorVault: quickAddShop → dispatch af-shopping-add (updates React state)"))

# ── BUG 3: Flow name persistence ─────────────────────────────────────────────
# App.jsx SettingsTab "Flow — Your Preferences" section: the preferred-name
# input uses defaultValue + onBlur. If the user navigates away before blur
# fires (mobile tap, or pressing Enter without blurring), the edit is lost.
# Fix: convert to controlled input (value + onChange) so every keystroke
# persists immediately via useSaved → localStorage.
APP = "src/App.jsx"

results.append(swap(APP,
'              <input defaultValue={preferredName} onBlur={function(e){var v=e.target.value.trim();setPreferredName(v);var updated=Object.assign({},authUser,{displayName:v||authUser&&authUser.displayName});setAuthUser(updated);try{localStorage.setItem("af_authUser",JSON.stringify(updated));}catch{};}} placeholder={familyProfile&&familyProfile.parentNames?familyProfile.parentNames.split(/[&,]/)[0].trim():"e.g. Lindsey"} style={{...inp({width:110,fontSize:"0.8rem",padding:"0.28rem 0.55rem"})}}/>',
'              <input value={preferredName||""} onChange={function(e){setPreferredName(e.target.value);}} onBlur={function(e){var v=e.target.value.trim();setPreferredName(v);var updated=Object.assign({},authUser,{displayName:v||authUser&&authUser.displayName});setAuthUser(updated);try{localStorage.setItem("af_authUser",JSON.stringify(updated));}catch{};}} placeholder={familyProfile&&familyProfile.parentNames?familyProfile.parentNames.split(/[&,]/)[0].trim():"e.g. Lindsey"} style={{...inp({width:110,fontSize:"0.8rem",padding:"0.28rem 0.55rem"})}}/>',
"3. App.jsx: preferredName input → controlled (value+onChange) so every keystroke persists"))

passed = sum(1 for r in results if r)
total  = len(results)
print(f"\nApplied: {passed} of {total}")
sys.exit(0 if passed == total else 1)
