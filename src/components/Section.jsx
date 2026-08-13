export default function Section({id,emoji,title,sub,children,defaultOpen=false,settingsOpen,toggleSetting,T}){
  var isOpen = id in settingsOpen ? settingsOpen[id] : defaultOpen;
  return(
    <div id={"settings-sec-"+id} style={{borderRadius:"1.1rem",border:"1.5px solid "+T.border,background:T.white,marginBottom:"0.65rem"}}>
      <button onClick={function(e){e.preventDefault();toggleSetting(id,defaultOpen);}} style={{width:"100%",display:"flex",alignItems:"center",gap:"0.6rem",background:"none",border:"none",cursor:"pointer",padding:"0.85rem 1rem",textAlign:"left",fontFamily:"inherit"}}>
        <span style={{fontSize:"1.15rem",flexShrink:0}}>{emoji}</span>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.05rem",fontWeight:700,color:T.textDark,lineHeight:1.2}}>{title}</div>
          {sub&&<div style={{fontSize:"0.71rem",color:T.textFaint,marginTop:1}}>{sub}</div>}
        </div>
        <span style={{fontSize:"0.75rem",color:T.textFaint,transform:isOpen?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▾</span>
      </button>
      {/* display:none keeps children mounted so inputs never lose focus */}
      <div style={{display:isOpen?"block":"none",padding:"0 1rem 1rem",borderTop:"1px solid "+T.borderSoft}}>
        {children}
      </div>
    </div>
  );
}
