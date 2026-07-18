content = open('src/App.jsx').read()

if '?BRAIN_BUCKETS.map' in content:
    # Find and replace the problem block
    start = content.find('        {activeFilter==="all"\n          ?BRAIN_BUCKETS.map')
    end = content.find('\n        }', start) + len('\n        }')
    old = content[start:end]
    new = '''        {activeFilter==="all" && BRAIN_BUCKETS.map(b=>{
          const items=brainItems.filter(i=>i.bucket===b.id);
          if(items.length===0) return null;
          const bt=getBucketTheme(b); const bColor=bt.color; const bPale=bt.pale;
          return(
            <div key={b.id} style={{marginBottom:"0.85rem"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.5rem",padding:"0.55rem 0.75rem",background:bPale,borderRadius:"0.75rem",border:`1.5px solid ${bColor}40`}}>
                <span style={{fontSize:"1rem"}}>{b.emoji}</span>
                <span style={{fontWeight:800,color:bColor,fontSize:"0.85rem",textTransform:"uppercase",letterSpacing:"0.06em"}}>{b.label}</span>
                <span style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500}}>— {b.desc}</span>
                <span style={{marginLeft:"auto",color:bColor,fontSize:"0.75rem",fontWeight:700}}>{items.filter(i=>!i.done).length} left</span>
              </div>
              {items.map(item=>{ const ic=getBucketTheme(b).color; return <BrainItemRow key={item.id} item={item} color={ic} bDragStart={bDragStart} bDragEnter={bDragEnter} bDragEnd={bDragEnd} onToggle={id=>setBrainItems(p=>p.map(x=>x.id===id?{...x,done:!x.done}:x))} onDelete={id=>setBrainItems(p=>p.filter(x=>x.id!==id))} onSave={(id,val)=>setBrainItems(p=>p.map(x=>x.id===id?{...x,text:val}:x))} onMove={(id,nb)=>setBrainItems(p=>p.map(x=>x.id===id?{...x,bucket:nb}:x))}/>; })}
            </div>
          );
        })}
        {activeFilter!=="all" && displayed.map(item=>{ const b=BRAIN_BUCKETS.find(x=>x.id===item.bucket); const ic=getBucketTheme(b||BRAIN_BUCKETS[2]).color; return <BrainItemRow key={item.id} item={item} color={ic} bDragStart={bDragStart} bDragEnter={bDragEnter} bDragEnd={bDragEnd} onToggle={id=>setBrainItems(p=>p.map(x=>x.id===id?{...x,done:!x.done}:x))} onDelete={id=>setBrainItems(p=>p.filter(x=>x.id!==id))} onSave={(id,val)=>setBrainItems(p=>p.map(x=>x.id===id?{...x,text:val}:x))} onMove={(id,nb)=>setBrainItems(p=>p.map(x=>x.id===id?{...x,bucket:nb}:x))}/>; })}'''
    open('src/App.jsx','w').write(content[:start] + new + content[end:])
    print('Fixed!')
else:
    print('Pattern not found - already fixed or different format')
    print('Line 1769:', content.split('\n')[1768][:80])
