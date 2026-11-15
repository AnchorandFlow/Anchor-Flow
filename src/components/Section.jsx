import { useContext } from "react";
import { SettingsPillContext } from "./settingsPillContext.js";

// af_redesign Settings: sections are pill tabs. SettingsTab provides
// { active } (SettingsPillContext) and only the active section renders, open,
// in a light card (no accordion header — the pill names it). No provider
// (flag off): the accordion below, unchanged.

export default function Section({id,emoji,title,sub,children,defaultOpen=false,settingsOpen,toggleSetting,T}){
  var pill = useContext(SettingsPillContext);
  if (pill) {
    if (pill.active !== id) return null;
    return (
      <div data-settings-section={id} style={{minWidth:0}}>
        {sub&&<div style={{fontSize:"0.85rem",color:T.textSoft,marginBottom:"0.25rem"}}>{sub}</div>}
        {children}
      </div>
    );
  }
  var isOpen = id in settingsOpen ? settingsOpen[id] : defaultOpen;
  return(
    <div style={{borderRadius:"1.1rem",border:"1.5px solid "+T.border,background:T.white,marginBottom:"0.65rem"}}>
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
