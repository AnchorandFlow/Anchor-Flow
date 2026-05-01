import { useState, useEffect } from "react"

const B = { navy:"#1a2744",coastal:"#3a6b8a",sage:"#7a9e8e",warm:"#faf8f4",text:"#2c3e50",muted:"#7a8a9a",border:"#e8e4dc",white:"#ffffff" }

function RecipeCard({ recipe, onDelete, onAddToShopping }) {
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState([])
  const toggle = (ing) => {
    if (added.includes(ing)) { setAdded(p=>p.filter(x=>x!==ing)) }
    else { setAdded(p=>[...p,ing]); onAddToShopping(ing) }
  }
  return (
    <div style={{background:B.white,border:"1.5px solid "+B.border,borderRadius:14,marginBottom:12,overflow:"hidden"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:17,fontWeight:700,color:B.navy}}>{recipe.name}</div>
          {recipe.time&&<div style={{fontSize:12,color:B.muted,marginTop:2}}>{recipe.time}</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14,color:B.muted}}>{open?"▲":"▼"}</span>
          <button onClick={e=>{e.stopPropagation();onDelete(recipe.id)}} style={{background:"none",border:"none",cursor:"pointer",color:B.muted,fontSize:18,padding:0}}>×</button>
        </div>
      </div>
      {open&&(
        <div style={{borderTop:"1px solid "+B.border,padding:"14px 16px"}}>
          {recipe.description&&<p style={{fontSize:13,color:B.muted,marginBottom:12,lineHeight:1.5}}>{recipe.description}</p>}
          {recipe.ingredients&&recipe.ingredients.length>0&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:B.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Ingredients — tap to add to shopping</div>
              {recipe.ingredients.map((ing,i)=>(
                <div key={i} onClick={()=>toggle(ing)} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",cursor:"pointer",borderBottom:"1px solid "+B.border+"44"}}>
                  <div style={{width:18,height:18,borderRadius:"50%",border:"1.5px solid "+(added.includes(ing)?B.sage:B.border),background:added.includes(ing)?B.sage:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {added.includes(ing)&&<span style={{color:"#fff",fontSize:10}}>✓</span>}
                  </div>
                  <span style={{fontSize:13,color:added.includes(ing)?B.muted:B.text,textDecoration:added.includes(ing)?"line-through":"none"}}>{ing}</span>
                </div>
              ))}
              {added.length>0&&<div style={{fontSize:11,color:B.sage,marginTop:6,fontWeight:600}}>{added.length} item{added.length>1?"s":""} added to shopping</div>}
            </div>
          )}
          {recipe.instructions&&recipe.instructions.length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:B.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Instructions</div>
              {recipe.instructions.map((step,i)=>(
                <div key={i} style={{display:"flex",gap:10,marginBottom:8}}>
                  <div style={{width:20,height:20,borderRadius:"50%",background:B.coastal+"22",color:B.coastal,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                  <span style={{fontSize:13,color:B.text,lineHeight:1.5}}>{step}</span>
                </div>
              ))}
            </div>
          )}
          {recipe.source&&<div style={{marginTop:10,fontSize:11,color:B.muted}}>Source: {recipe.source}</div>}
        </div>
      )}
    </div>
  )
}

export default function RecipesTab({ onAddToShopping }) {
  const [recipes, setRecipes] = useState([])
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [manual, setManual] = useState(false)
  const [mr, setMr] = useState({name:"",time:"",ingredients:"",instructions:""})

  useEffect(() => {
    try { setRecipes(JSON.parse(localStorage.getItem("af_recipes")||"[]")) } catch {}
  }, [])

  const save = (updated) => {
    setRecipes(updated)
    try { localStorage.setItem("af_recipes", JSON.stringify(updated)) } catch {}
  }

  const extractFromUrl = async () => {
    if (!url.trim()) return
    setLoading(true); setError("")
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:"Extract the recipe from this URL and return ONLY a JSON object with: name, description, time, servings, ingredients (array of strings), instructions (array of strings). URL: "+url+". Return only valid JSON, no markdown."}]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text||""
      const clean = text.replace(/```json|```/g,"").trim()
      const recipe = JSON.parse(clean)
      recipe.id = Date.now().toString()
      recipe.source = url
      save([recipe,...recipes])
      setUrl("")
    } catch { setError("Could not extract recipe. Try adding manually.") }
    setLoading(false)
  }

  const addManual = () => {
    const r = {id:Date.now().toString(),name:mr.name,time:mr.time,
      ingredients:mr.ingredients.split("\n").map(s=>s.trim()).filter(Boolean),
      instructions:mr.instructions.split("\n").map(s=>s.trim()).filter(Boolean)}
    save([r,...recipes])
    setManual(false)
    setMr({name:"",time:"",ingredients:"",instructions:""})
  }

  return (
    <div style={{padding:"0 0 2rem"}}>
      <div style={{background:B.warm,border:"1.5px solid "+B.border,borderRadius:14,padding:16,marginBottom:16}}>
        <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:16,fontWeight:700,color:B.navy,marginBottom:10}}>Save a Recipe</div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&extractFromUrl()} placeholder="Paste recipe URL from any website..." style={{flex:1,border:"1.5px solid "+B.border,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",background:B.white,fontFamily:"DM Sans,sans-serif"}}/>
          <button onClick={extractFromUrl} disabled={loading} style={{background:B.navy,border:"none",borderRadius:8,padding:"9px 16px",color:"#fff",fontFamily:"DM Sans,sans-serif",fontSize:13,fontWeight:600,cursor:"pointer",opacity:loading?0.6:1}}>{loading?"Saving...":"Save"}</button>
        </div>
        {error&&<div style={{fontSize:12,color:"#c0392b",marginBottom:6}}>{error}</div>}
        <button onClick={()=>setManual(o=>!o)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:B.coastal,fontFamily:"DM Sans,sans-serif",padding:0}}>{manual?"Hide manual entry":"Or add manually"}</button>
        {manual&&(
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
            <input value={mr.name} onChange={e=>setMr(p=>({...p,name:e.target.value}))} placeholder="Recipe name" style={{border:"1.5px solid "+B.border,borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",fontFamily:"DM Sans,sans-serif"}}/>
            <input value={mr.time} onChange={e=>setMr(p=>({...p,time:e.target.value}))} placeholder="Cook time (e.g. 30 min)" style={{border:"1.5px solid "+B.border,borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",fontFamily:"DM Sans,sans-serif"}}/>
            <textarea value={mr.ingredients} onChange={e=>setMr(p=>({...p,ingredients:e.target.value}))} placeholder="Ingredients (one per line)" rows={4} style={{border:"1.5px solid "+B.border,borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"DM Sans,sans-serif"}}/>
            <textarea value={mr.instructions} onChange={e=>setMr(p=>({...p,instructions:e.target.value}))} placeholder="Instructions (one step per line)" rows={4} style={{border:"1.5px solid "+B.border,borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"DM Sans,sans-serif"}}/>
            <button onClick={addManual} disabled={!mr.name} style={{background:B.sage,border:"none",borderRadius:8,padding:9,color:"#fff",fontFamily:"DM Sans,sans-serif",fontSize:13,fontWeight:600,cursor:"pointer",opacity:mr.name?1:0.5}}>Save Recipe</button>
          </div>
        )}
      </div>
      {recipes.length===0
        ?<div style={{textAlign:"center",padding:"32px 20px",color:B.muted,fontFamily:"DM Sans,sans-serif",fontSize:13}}>
          <div style={{fontSize:32,marginBottom:8}}>🍽️</div>
          <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:18,color:B.navy,marginBottom:4}}>No recipes saved yet</div>
          <div>Paste a URL above to save your first recipe</div>
        </div>
        :<div>
          <div style={{fontSize:11,fontWeight:700,color:B.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>{recipes.length} saved recipe{recipes.length!==1?"s":""}</div>
          {recipes.map(r=><RecipeCard key={r.id} recipe={r} onDelete={id=>save(recipes.filter(x=>x.id!==id))} onAddToShopping={onAddToShopping}/>)}
        </div>
      }
    </div>
  )
}
