import React, { useState } from "react"

const MEAL_TAGS = [
  { id: "dairy-free",       label: "Dairy-free",       emoji: "🥛" },
  { id: "gluten-free",      label: "Gluten-free",       emoji: "🌾" },
  { id: "vegetarian",       label: "Vegetarian",        emoji: "🥦" },
  { id: "vegan",            label: "Vegan",             emoji: "🌱" },
  { id: "nut-free",         label: "Nut-free",          emoji: "🥜" },
  { id: "breakfast",        label: "Breakfast",         emoji: "🍳" },
  { id: "one-pan",          label: "One pan",           emoji: "🥘" },
  { id: "easy",             label: "Easy",              emoji: "⚡" },
  { id: "requires-defrost", label: "Requires defrost",  emoji: "❄️" },
  { id: "family-favorite",  label: "Family favorite",   emoji: "⭐" },
  { id: "guest-approved",   label: "Guest approved",    emoji: "👥" },
  { id: "good-to-gift",     label: "Good to gift",      emoji: "🎁" },
  { id: "kid-friendly",     label: "Kid-friendly",      emoji: "👧" },
  { id: "pantry-meal",      label: "Pantry meal",       emoji: "🏪" },
  { id: "slow-cooker",      label: "Slow cooker",       emoji: "🫕" },
  { id: "30-min",           label: "30 min or less",    emoji: "⏱️" },
]

const B = {
  navy: "#1a2744", coastal: "#3a6b8a", sage: "#7a9e8e", sand: "#c8a97a",
  warm: "#faf8f4", white: "#ffffff", border: "rgba(26,39,68,0.12)",
  muted: "#7a8494", soft: "#f0ede8",
}

const inp = (extra={}) => ({ border:"1.5px solid "+B.border, borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif", width:"100%", boxSizing:"border-box", ...extra })

function TagPicker({ selected, onChange }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
      {MEAL_TAGS.map(t => {
        const on = selected.includes(t.id)
        return (
          <button key={t.id} onClick={() => onChange(on ? selected.filter(x=>x!==t.id) : [...selected, t.id])} style={{ background: on ? B.coastal : B.white, color: on ? "#fff" : B.muted, border: "1.5px solid "+(on ? B.coastal : B.border), borderRadius: "2rem", padding: "4px 10px", fontSize: 11, fontFamily: "DM Sans,sans-serif", fontWeight: on ? 700 : 400, cursor: "pointer" }}>
            {t.emoji} {t.label}
          </button>
        )
      })}
    </div>
  )
}

function RecipeCard({ recipe, onDelete, onAddToShopping, onAddToMealBank, onEditTags, open, setOpen }) {
  const [bankAdded, setBankAdded] = useState(false)
  const tags = Array.isArray(recipe.tags) ? recipe.tags : (recipe.tags||"").split(",").map(t=>t.trim()).filter(Boolean)
  const tagMeta = tags.map(id => MEAL_TAGS.find(t=>t.id===id)||{ id, label:id, emoji:"🏷️" })
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : (recipe.ingredients||"").split("\n").filter(Boolean)

  function handleAddToBank() {
    if (!onAddToMealBank) return
    onAddToMealBank(recipe.name, tags, ingredients)
    setBankAdded(true)
    setTimeout(function() { setBankAdded(false) }, 2500)
  }

  return (
    <div style={{ background:B.white, border:"1.5px solid "+B.border, borderRadius:12, marginBottom:10, overflow:"hidden" }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", cursor:"pointer" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:14, fontWeight:600, color:B.navy }}>{recipe.name}</div>
          {recipe.time && <div style={{ fontSize:11, color:B.muted, marginTop:2 }}>⏱ {recipe.time}</div>}
          {tagMeta.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
              {tagMeta.map(t => (
                <span key={t.id} style={{ background:B.soft, color:B.coastal, fontSize:10, borderRadius:"2rem", padding:"2px 7px", fontFamily:"DM Sans,sans-serif", fontWeight:600 }}>{t.emoji} {t.label}</span>
              ))}
            </div>
          )}
        </div>
        <span style={{ fontSize:12, color:B.muted }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ padding:"0 14px 14px", borderTop:"1px solid "+B.border }}>
          {recipe.notes && <div style={{ fontSize:12, color:B.muted, marginTop:10, marginBottom:8, fontStyle:"italic" }}>{recipe.notes}</div>}
          {recipe.source && <div style={{ fontSize:11, color:B.coastal, marginBottom:8 }}><a href={recipe.source} target="_blank" rel="noreferrer" style={{ color:B.coastal }}>View original recipe →</a></div>}
          {ingredients.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:B.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Ingredients</div>
              {ingredients.map((ing,i) => (
                <div key={i} style={{ fontSize:13, color:B.navy, padding:"3px 0", borderBottom:"1px solid "+B.border, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>{ing}</span>
                  <button onClick={()=>onAddToShopping&&onAddToShopping(ing)} style={{ background:"none", border:"none", fontSize:11, color:B.coastal, cursor:"pointer", padding:"0 4px" }}>+ list</button>
                </div>
              ))}
              <button onClick={()=>ingredients.forEach(i=>onAddToShopping&&onAddToShopping(i))} style={{ background:B.sage, border:"none", borderRadius:7, padding:"6px 12px", color:"#fff", fontSize:11, fontFamily:"DM Sans,sans-serif", fontWeight:600, cursor:"pointer", marginTop:8 }}>Add all to shopping list</button>
            </div>
          )}
          {recipe.steps && recipe.steps.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:B.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Steps</div>
              {(Array.isArray(recipe.steps) ? recipe.steps : recipe.steps.split("\n").filter(Boolean)).map((step,i) => (
                <div key={i} style={{ fontSize:13, color:B.navy, padding:"4px 0", display:"flex", gap:8 }}>
                  <span style={{ color:B.coastal, fontWeight:700, flexShrink:0 }}>{i+1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:B.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Tags</div>
            <TagPicker selected={tags} onChange={newTags=>onEditTags(recipe.id, newTags)} />
          </div>
          <div style={{ display:"flex", gap:8, marginTop:14, flexWrap:"wrap" }}>
            <button onClick={handleAddToBank} style={{ background: bankAdded ? B.sage : "rgba(122,158,142,0.1)", border:"1.5px solid "+(bankAdded ? B.sage : "rgba(122,158,142,0.4)"), borderRadius:7, padding:"6px 12px", color: bankAdded ? "#fff" : B.sage, fontSize:11, fontFamily:"DM Sans,sans-serif", fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}>
              {bankAdded ? "✓ Added to Meal Bank" : "📋 Add to Meal Bank"}
            </button>
            <button onClick={()=>onDelete(recipe.id)} style={{ background:"none", border:"1px solid #e74c3c44", borderRadius:7, padding:"5px 12px", color:"#e74c3c", fontSize:11, fontFamily:"DM Sans,sans-serif", cursor:"pointer" }}>Delete recipe</button>
          </div>
        </div>
      )}
    </div>
  )
}

const RecipesTab = React.memo(function RecipesTab({ recipes=[], onSaveRecipe, onDeleteRecipe, onEditTags, onAddToShopping, onAddToMealBank }) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [manual, setManual] = useState(false)
  const [mr, setMr] = useState({ name:"", time:"", ingredients:"", instructions:"" })
  const [newTags, setNewTags] = useState([])
  const [activeFilter, setActiveFilter] = useState("all")
  const [openCards, setOpenCards] = useState(()=>{ try{ return JSON.parse(sessionStorage.getItem("af_openCards")||"{}") }catch{ return {} } })
  const setOpenCard = (id, val) => { const next = {...openCards, [id]:val}; setOpenCards(next); try{ sessionStorage.setItem("af_openCards", JSON.stringify(next)) }catch{} }

  const extractFromUrl = async () => {
    if (!url.trim()) return
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/claude", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:800,
          system:`Extract recipe info from a URL. Respond ONLY in JSON: {"name":"","ingredients":[],"steps":[],"servings":"","time":"","notes":"","source":""}. If social media video, set name to "Paste ingredients below" and notes to "Social media video — please paste the ingredient list manually."`,
          messages:[{role:"user",content:`URL: ${url.trim()}`}]
        })
      })
      const d = await res.json()
      const txt = d.content?.find(b=>b.type==="text")?.text||"{}"
      const parsed = JSON.parse(txt.replace(/```json|```/g,"").trim())
      onSaveRecipe && onSaveRecipe({ ...parsed, id:Date.now().toString(), tags:newTags, savedAt:new Date().toISOString() })
      setUrl(""); setNewTags([])
    } catch { setError("Could not extract recipe. Try adding manually.") }
    setLoading(false)
  }

  const addManual = () => {
    if (!mr.name) return
    onSaveRecipe && onSaveRecipe({
      id: Date.now().toString(),
      name: mr.name, time: mr.time,
      ingredients: mr.ingredients.split("\n").filter(Boolean),
      steps: mr.instructions.split("\n").filter(Boolean),
      tags: newTags,
      savedAt: new Date().toISOString()
    })
    setManual(false)
    setMr({ name:"", time:"", ingredients:"", instructions:"" })
    setNewTags([])
  }

  const editTags = (id, tags) => {
    onEditTags && onEditTags(id, tags)
  }

  const usedTags = [...new Set(recipes.flatMap(r => Array.isArray(r.tags) ? r.tags : (r.tags||"").split(",").map(t=>t.trim()).filter(Boolean)))]

  // Alphabetical sort
  const sortedRecipes = recipes.slice().sort(function(a,b){ return a.name.localeCompare(b.name) })
  const filtered = activeFilter === "all"
    ? sortedRecipes
    : sortedRecipes.filter(r => {
        const tags = Array.isArray(r.tags) ? r.tags : (r.tags||"").split(",").map(t=>t.trim()).filter(Boolean)
        return tags.includes(activeFilter)
      })

  return (
    <div style={{ padding:"0 0 2rem" }}>
      <div style={{ background:B.warm, border:"1.5px solid "+B.border, borderRadius:14, padding:16, marginBottom:16 }}>
        <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:16, fontWeight:700, color:B.navy, marginBottom:10 }}>Save a Recipe</div>
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&extractFromUrl()} placeholder="Paste recipe URL from any website..." style={{ ...inp(), flex:1 }}/>
          <button onClick={extractFromUrl} disabled={loading} style={{ background:B.navy, border:"none", borderRadius:8, padding:"9px 16px", color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:600, cursor:"pointer", opacity:loading?0.6:1 }}>{loading?"Saving...":"Save"}</button>
        </div>
        {error&&<div style={{ fontSize:12, color:"#c0392b", marginBottom:6 }}>{error}</div>}
        <div style={{ fontSize:11, fontWeight:700, color:B.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4, marginTop:8 }}>Add tags</div>
        <TagPicker selected={newTags} onChange={setNewTags} />
        <button onClick={()=>setManual(o=>!o)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:B.coastal, fontFamily:"DM Sans,sans-serif", padding:0, marginTop:10, display:"block" }}>{manual?"Hide manual entry":"Or add manually"}</button>
        {manual&&(
          <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:8 }}>
            <input value={mr.name} onChange={e=>setMr(p=>({...p,name:e.target.value}))} placeholder="Recipe name" style={inp()}/>
            <input value={mr.time} onChange={e=>setMr(p=>({...p,time:e.target.value}))} placeholder="Cook time (e.g. 30 min)" style={inp()}/>
            <textarea value={mr.ingredients} onChange={e=>setMr(p=>({...p,ingredients:e.target.value}))} placeholder="Ingredients (one per line)" rows={4} style={{...inp(),resize:"vertical"}}/>
            <textarea value={mr.instructions} onChange={e=>setMr(p=>({...p,instructions:e.target.value}))} placeholder="Instructions (one step per line)" rows={4} style={{...inp(),resize:"vertical"}}/>
            <button onClick={addManual} disabled={!mr.name} style={{ background:B.sage, border:"none", borderRadius:8, padding:9, color:"#fff", fontFamily:"DM Sans,sans-serif", fontSize:13, fontWeight:600, cursor:"pointer", opacity:mr.name?1:0.5 }}>Save Recipe</button>
          </div>
        )}
      </div>
      {recipes.length > 0 && (
        <div style={{ display:"flex", gap:0, overflowX:"auto", borderBottom:"1px solid "+B.border, marginBottom:14, paddingBottom:1 }}>
          {["all", ...usedTags].map(tag => {
            const meta = MEAL_TAGS.find(t=>t.id===tag)
            const label = tag==="all" ? "All" : (meta?.emoji+" "+meta?.label || tag)
            const count = tag==="all" ? recipes.length : recipes.filter(r=>{
              const tags = Array.isArray(r.tags)?r.tags:(r.tags||"").split(",").map(t=>t.trim()).filter(Boolean)
              return tags.includes(tag)
            }).length
            return (
              <button key={tag} onClick={()=>setActiveFilter(tag)} style={{ background:"none", border:"none", borderBottom: activeFilter===tag ? "2px solid "+B.coastal : "2px solid transparent", color: activeFilter===tag ? B.coastal : B.muted, padding:"6px 12px", fontSize:11, fontFamily:"DM Sans,sans-serif", fontWeight: activeFilter===tag?700:400, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
                {label} <span style={{ fontSize:10, opacity:0.6 }}>({count})</span>
              </button>
            )
          })}
        </div>
      )}
      {recipes.length===0
        ? <div style={{ textAlign:"center", padding:"32px 20px", color:B.muted, fontFamily:"DM Sans,sans-serif", fontSize:13 }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🍽️</div>
            <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:18, color:B.navy, marginBottom:4 }}>No recipes saved yet</div>
            <div>Paste a URL above to save your first recipe</div>
          </div>
        : <div>
            <div style={{ fontSize:11, fontWeight:700, color:B.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>
              {filtered.length} recipe{filtered.length!==1?"s":""} · A–Z
              {activeFilter!=="all"&&<span style={{fontWeight:400}}> tagged {MEAL_TAGS.find(t=>t.id===activeFilter)?.label||activeFilter}</span>}
            </div>
            {filtered.map(r => <RecipeCard key={r.id} recipe={r} onDelete={id=>onDeleteRecipe&&onDeleteRecipe(id)} onAddToShopping={onAddToShopping} onAddToMealBank={onAddToMealBank} onEditTags={editTags} open={!!openCards[r.id]} setOpen={v=>setOpenCard(r.id,v)}/>)}
          </div>
      }
    </div>
  )
})

export default RecipesTab
