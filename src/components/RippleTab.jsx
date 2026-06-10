import { useState, useEffect } from "react"

const B = { navy:"#1a2744",coastal:"#3a6b8a",sand:"#c8a97a",warm:"#faf8f4",text:"#2c3e50",muted:"#7a8a9a",ok:"#5a8a6a",warn:"#c8834a" }

const INSIGHTS = [
  {id:1,icon:"lightning",title:"Wednesday looks heavy",body:"You have a lot stacked. I can help shift a few things.",detail:["Move admin to Thursday","Swap dinner to rescue meal","Defer pantry check"],color:B.warn,bg:"#fff8f2",actions:["Help me lighten it","Show me what moves"]},
  {id:2,icon:"plate",title:"4 dinners still unplanned",body:"I picked meals that match your energy each night.",detail:["Mon - Pasta (20 min)","Tue - Sheet pan chicken","Thu - Tacos","Fri - Your call"],color:B.coastal,bg:"#f2f7fa",actions:["Add all 4 meals","Pick differently"]},
  {id:3,icon:"sun",title:"Your day is ready",body:"3 priorities set, dinner planned, school pickup blocked.",detail:["Priority: Call pediatrician","Block: School pickup 3:15pm","Dinner: Pasta bake"],color:B.ok,bg:"#f2faf5",actions:["Looks good","Adjust"]},
]

export default function CompassTab() {
  const [insights, setInsights] = useState(INSIGHTS)
  const [active, setActive] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [input, setInput] = useState("")
  const [typed, setTyped] = useState("")
  const greeting = "Good morning. Here is what I see for your week."

  useEffect(() => {
    let i = 0
    const t = setInterval(() => { if(i < greeting.length){setTyped(greeting.slice(0,++i))}else clearInterval(t) }, 35)
    return () => clearInterval(t)
  }, [])

  const dismiss = id => { setInsights(p=>p.filter(x=>x.id!==id)); if(active===id)setActive(null) }
  const ask = () => { if(!input.trim())return; setThinking(true); setTimeout(()=>setThinking(false),2000); setInput("") }

  return (
    <div style={{minHeight:"100vh",background:B.warm}}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap");@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}`}</style>
      <div style={{background:B.navy,padding:"20px 20px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:22,fontWeight:600,color:"#fff",minHeight:28}}>{typed}<span style={{animation:"pulse 1s infinite",opacity:typed.length<greeting.length?1:0}}>|</span></div>
            <div style={{fontFamily:"DM Sans,sans-serif",fontSize:13,color:`${B.sand}cc`,marginTop:4}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
          </div>
          <div style={{background:`${B.coastal}33`,border:`1px solid ${B.coastal}55`,borderRadius:12,padding:"6px 12px",display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:B.sand,animation:"pulse 2s infinite",display:"inline-block"}}/>
            <span style={{fontFamily:"DM Sans,sans-serif",fontSize:12,color:B.sand,fontWeight:600}}>Compass Active</span>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[{l:"3 priorities set",c:B.ok},{l:"Wed is heavy",c:B.warn},{l:"4 dinners open",c:B.sand}].map(x=><div key={x.l} style={{background:`${x.c}22`,border:`1px solid ${x.c}44`,borderRadius:20,padding:"4px 10px",fontSize:12,color:x.c,fontWeight:600,fontFamily:"DM Sans,sans-serif"}}>{x.l}</div>)}
        </div>
      </div>

      <div style={{padding:"20px 16px",maxWidth:540,margin:"0 auto"}}>
        {thinking && <div style={{background:`${B.coastal}12`,border:`1.5px solid ${B.coastal}30`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}><div style={{display:"flex",gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:B.coastal,animation:`pulse 1.2s ${i*0.2}s infinite`}}/>)}</div><span style={{fontSize:13.5,color:B.coastal,fontFamily:"DM Sans,sans-serif"}}>Compass is thinking...</span></div>}
        <div style={{fontFamily:"DM Sans,sans-serif",fontSize:12,color:B.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600,marginBottom:10}}>What I noticed</div>
        {insights.length===0
          ? <div style={{textAlign:"center",padding:"32px 20px",background:"#fff",borderRadius:16,border:"1.5px solid #e8e4dc"}}><div style={{fontSize:32,marginBottom:8}}>check</div><div style={{fontFamily:"Cormorant Garamond,serif",fontSize:18,color:B.navy}}>You are all clear</div><div style={{fontSize:13,color:B.muted,marginTop:4,fontFamily:"DM Sans,sans-serif"}}>I will let you know if anything needs attention.</div></div>
          : insights.map(ins=>(
            <div key={ins.id} onClick={()=>setActive(active===ins.id?null:ins.id)} style={{background:active===ins.id?ins.bg:"#fff",border:`1.5px solid ${active===ins.id?ins.color:"#e8e4dc"}`,borderRadius:16,padding:"18px 20px",marginBottom:12,cursor:"pointer",transition:"all 0.2s"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{width:40,height:40,borderRadius:12,background:`${ins.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{ins.icon==="lightning"?"⚡":ins.icon==="plate"?"🍽️":"☀️"}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:17,fontWeight:700,color:B.navy,marginBottom:4}}>{ins.title}</div>
                  <div style={{fontFamily:"DM Sans,sans-serif",fontSize:13,color:B.muted,lineHeight:1.5}}>{ins.body}</div>
                </div>
                <button onClick={e=>{e.stopPropagation();dismiss(ins.id)}} style={{background:"none",border:"none",cursor:"pointer",color:B.muted,fontSize:18,padding:0,flexShrink:0}}>x</button>
              </div>
              {active===ins.id&&(
                <div style={{marginTop:14}}>
                  <div style={{background:`${ins.color}10`,borderRadius:10,padding:"10px 14px",marginBottom:12}}>{ins.detail.map((d,i)=><div key={i} style={{fontFamily:"DM Sans,sans-serif",fontSize:13,color:B.text,padding:"3px 0",display:"flex",gap:8}}><span style={{color:ins.color}}>*</span>{d}</div>)}</div>
                  <div style={{display:"flex",gap:8}}>{ins.actions.map((a,i)=><button key={i} style={{flex:i===0?1:"none",padding:"9px 16px",borderRadius:10,border:i===0?"none":`1.5px solid ${ins.color}`,background:i===0?ins.color:"transparent",color:i===0?"#fff":ins.color,fontFamily:"DM Sans,sans-serif",fontSize:13,fontWeight:600,cursor:"pointer"}}>{a}</button>)}</div>
                </div>
              )}
            </div>
          ))
        }
        <div style={{marginTop:24,background:"#fff",border:"1.5px solid #e8e4dc",borderRadius:16,padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:10,background:B.navy,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,color:"#fff"}}>*</div>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder="Ask Compass anything about your week..." style={{flex:1,border:"none",outline:"none",fontFamily:"DM Sans,sans-serif",fontSize:14,color:B.text,background:"transparent"}}/>
          <button onClick={ask} style={{background:B.navy,border:"none",borderRadius:8,padding:"6px 12px",color:"#fff",fontFamily:"DM Sans,sans-serif",fontSize:12,fontWeight:600,cursor:"pointer"}}>Ask</button>
        </div>
        <div style={{textAlign:"center",fontFamily:"DM Sans,sans-serif",fontSize:11,color:B.muted,marginTop:16}}>Compass · Anchor and Flow AI</div>
      </div>
    </div>
  )
}
