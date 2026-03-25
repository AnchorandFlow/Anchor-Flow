
import { useState, useRef, useEffect } from "react";

const TODAY = new Date();
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const TODAY_NAME = DAY_NAMES[TODAY.getDay()];
const FORMAT_DATE = d => d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const FORMAT_SHORT = d => d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
const uid = () => Math.random().toString(36).slice(2,9);
const MEAL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const FULL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ── Themes ────────────────────────────────────────────────────────────────────
const THEMES = {
  calm: {
    label:"Calm", emoji:"🌿",
    bg:"#f0ede8", bgAlt:"#e4dfd8", surface:"#faf8f5", border:"#c8c2b8", borderSoft:"#d8d2c8",
    sage:"#5a8a6e", sageDark:"#3d6b52", sageLight:"#8cb89d", sagePale:"#d5eadb",
    sand:"#b8945e", sandDark:"#8f6e3a", sandLight:"#d4b88a", sandPale:"#eeddd0",
    blue:"#5b8fa8", blueDark:"#3a6f88", blueLight:"#90bdd0", bluePale:"#d5eaf4",
    rose:"#b87265", roseDark:"#8f4f44", rosePale:"#f0ddd8",
    lavender:"#8878b8", lavPale:"#e5e0f5",
    textDark:"#252018", textMid:"#4e4840", textSoft:"#807870", textFaint:"#aaa298",
    white:"#fdfcfa", navBg:"#f5f2ed", topBg:"#faf8f5",
    inputBg:"#fdfcfa", cardShadow:"rgba(70,58,40,0.10)", modalOverlay:"rgba(50,40,28,0.52)",
  },
  coastal: {
    label:"Coastal", emoji:"🌊",
    bg:"#e4edf5", bgAlt:"#d4e2ef", surface:"#f2f7fc", border:"#a8c4dc", borderSoft:"#bdd0e4",
    sage:"#3a7a60", sageDark:"#1f5a42", sageLight:"#72b098", sagePale:"#c8e8da",
    sand:"#a87840", sandDark:"#7a5520", sandLight:"#d0a870", sandPale:"#ead8b8",
    blue:"#2e6ea0", blueDark:"#1a4e78", blueLight:"#68a8d0", bluePale:"#bcd8f0",
    rose:"#a05858", roseDark:"#783838", rosePale:"#ead8d5",
    lavender:"#6058a0", lavPale:"#d5d0f0",
    textDark:"#101828", textMid:"#284058", textSoft:"#507090", textFaint:"#80a8c8",
    white:"#f5faff", navBg:"#d8e8f5", topBg:"#c8ddf0",
    inputBg:"#f2f7fc", cardShadow:"rgba(10,40,80,0.10)", modalOverlay:"rgba(5,20,45,0.55)",
  },
  night: {
    label:"Night", emoji:"🌙",
    bg:"#151c24", bgAlt:"#1c2530", surface:"#1e2838", border:"#2c3d50", borderSoft:"#243244",
    sage:"#5aaa88", sageDark:"#3a8868", sageLight:"#88c8a8", sagePale:"#183828",
    sand:"#d4a870", sandDark:"#b08850", sandLight:"#e8c898", sandPale:"#2a1e0a",
    blue:"#58a8d0", blueDark:"#3080a8", blueLight:"#88c8e8", bluePale:"#0c2838",
    rose:"#d88878", roseDark:"#b05848", rosePale:"#2e1010",
    lavender:"#a898d8", lavPale:"#1c1838",
    textDark:"#e8f0f8", textMid:"#a0b8cc", textSoft:"#607890", textFaint:"#384e64",
    white:"#222e3e", navBg:"#111820", topBg:"#111820",
    inputBg:"#1a2438", cardShadow:"rgba(0,0,0,0.32)", modalOverlay:"rgba(0,0,0,0.72)",
  }
};

const FLOW_MODES_FN = T => ({
  Smooth:   {color:T.sage,  bg:T.sagePale, emoji:"🌊", desc:"Full capacity. System on."},
  Busy:     {color:T.sand,  bg:T.sandPale, emoji:"⚡", desc:"Lighter load. Focus on what matters."},
  Survival: {color:T.rose,  bg:T.rosePale, emoji:"🛟", desc:"Just today. You are doing enough."},
});

const DEFAULT_RHYTHM = {
  Monday:    {theme:"Reset",       emoji:"🔄", desc:"Laundry, groceries, fresh start."},
  Tuesday:   {theme:"Errands",     emoji:"🛒", desc:"Out & about. Appointments, pick-ups."},
  Wednesday: {theme:"Admin",       emoji:"📋", desc:"Emails, bills, scheduling."},
  Thursday:  {theme:"Clean",       emoji:"🧹", desc:"Deep clean, bathrooms, floors."},
  Friday:    {theme:"Prep + Fun",  emoji:"🎉", desc:"Weekend prep. Treat yourselves."},
  Saturday:  {theme:"Family",      emoji:"👨‍👩‍👧", desc:"Together time. Outings, memories."},
  Sunday:    {theme:"Rest + Reset",emoji:"🌿", desc:"Rest and gentle reset."},
};

const THEME_PRESETS = [
  {theme:"Reset",emoji:"🔄",desc:"Laundry, groceries, fresh start."},
  {theme:"Errands",emoji:"🛒",desc:"Out & about. Appointments, pick-ups."},
  {theme:"Admin",emoji:"📋",desc:"Emails, bills, scheduling."},
  {theme:"Clean",emoji:"🧹",desc:"Deep clean, bathrooms, floors."},
  {theme:"Prep + Fun",emoji:"🎉",desc:"Weekend prep. Treat yourselves."},
  {theme:"Family",emoji:"👨‍👩‍👧",desc:"Together time. Outings, memories."},
  {theme:"Rest + Reset",emoji:"🌿",desc:"Rest and gentle reset."},
  {theme:"Self-care",emoji:"💆",desc:"You first. Recharge your batteries."},
  {theme:"Batch Cook",emoji:"🍲",desc:"Prep meals for the week ahead."},
  {theme:"Finance",emoji:"💰",desc:"Budget, bills, financial check-in."},
  {theme:"Fitness",emoji:"🏃",desc:"Move your body, feel good."},
  {theme:"Custom",emoji:"✏️",desc:""},
];

const DIETARY_META_FN = T => ({
  "Dairy-free":  {color:T.blue,     emoji:"🥛"},
  "Gluten-free": {color:T.sand,     emoji:"🌾"},
  "Nut-free":    {color:T.rose,     emoji:"🥜"},
  "Vegetarian":  {color:T.sage,     emoji:"🥦"},
  "Vegan":       {color:T.sageDark, emoji:"🌱"},
  "Low-carb":    {color:T.lavender, emoji:"🍖"},
});

const HOME_SYSTEMS_DEFAULT = {
  laundry:{label:"Laundry Rhythm",emoji:"🧺",items:["Wash Monday & Thursday","Fold same day — no pile-up","Put away within 24h","One load = one task"]},
  daily:  {label:"Daily Reset",   emoji:"🌙",items:["Dishes done before bed","Counters wiped","10-min tidy sweep","Tomorrow's bag packed"]},
  weekly: {label:"Weekly Cleaning",emoji:"🧹",items:["Monday — Laundry + kitchen","Wednesday — Bathrooms","Thursday — Floors + surfaces","Friday — Tidy before weekend"]},
};
const BURNOUT_TASKS = [
  {id:"feed", label:"Feed everyone",    emoji:"🍳"},
  {id:"load", label:"One load laundry", emoji:"🧺"},
  {id:"reset",label:"10-min reset",     emoji:"✨"},
];

// Brain priority buckets
const BRAIN_BUCKETS = [
  {id:"top3",    label:"Top 3",      emoji:"🔥", desc:"Must happen today",        color:"rose"},
  {id:"next3",   label:"Next 3",     emoji:"⚡", desc:"Important, do soon",       color:"sand"},
  {id:"later",   label:"Later",      emoji:"📋", desc:"On the radar",             color:"blue"},
  {id:"delegate",label:"Delegate",   emoji:"🤝", desc:"Someone else can own this",color:"lavender"},
];

const TABS = [
  {id:"anchor",   label:"Anchor",   emoji:"⚓️"},
  {id:"calendar", label:"Calendar", emoji:"📆"},
  {id:"weekly",   label:"Weekly",   emoji:"📅"},
  {id:"meals",    label:"Meals",    emoji:"🍽️"},
  {id:"shop",     label:"Shopping", emoji:"🛒"},
  {id:"home",     label:"Home",     emoji:"🏠"},
  {id:"brain",    label:"Brain",    emoji:"🧠"},
  {id:"burnout",  label:"Burnout",  emoji:"🛟"},
  {id:"settings", label:"Settings", emoji:"⚙️"},
];

// Calendar sources
const CAL_SOURCES = [
  {id:"google",  label:"Google Calendar",  color:"#4285F4", icon:"G"},
  {id:"apple",   label:"Apple Calendar",   color:"#ff3b30", icon:"🍎"},
  {id:"outlook", label:"Outlook",          color:"#0078d4", icon:"O"},
  {id:"ical",    label:"iCal / Other",     color:"#888",    icon:"📅"},
];

// ── Icons ─────────────────────────────────────────────────────────────────────
function Icon({name,size=16,color}){
  const s={width:size,height:size,display:"block",flexShrink:0};
  const p={fill:"none",stroke:color||"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};
  if(name==="anchor")    return <svg {...s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="22"/><path d="M5 15H2a10 10 0 0 0 20 0h-3"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
  if(name==="close")     return <svg {...s} viewBox="0 0 24 24" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
  if(name==="plus")      return <svg {...s} viewBox="0 0 24 24" {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
  if(name==="trash")     return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>;
  if(name==="edit")      return <svg {...s} viewBox="0 0 24 24" {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
  if(name==="check")     return <svg {...s} viewBox="0 0 24 24" {...p} strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>;
  if(name==="share")     return <svg {...s} viewBox="0 0 24 24" {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
  if(name==="sync")      return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
  if(name==="send")      return <svg {...s} viewBox="0 0 24 24" {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon fill={color||"currentColor"} stroke="none" points="22 2 15 22 11 13 2 9 22 2"/></svg>;
  if(name==="palette")   return <svg {...s} viewBox="0 0 24 24" {...p}><circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>;
  if(name==="chevL")     return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="15 18 9 12 15 6"/></svg>;
  if(name==="chevR")     return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="9 18 15 12 9 6"/></svg>;
  if(name==="cal")       return <svg {...s} viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if(name==="link")      return <svg {...s} viewBox="0 0 24 24" {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
  if(name==="drag")      return <svg {...s} viewBox="0 0 24 24" {...p}><circle cx="9" cy="7" r="1" fill={color||"currentColor"}/><circle cx="9" cy="12" r="1" fill={color||"currentColor"}/><circle cx="9" cy="17" r="1" fill={color||"currentColor"}/><circle cx="15" cy="7" r="1" fill={color||"currentColor"}/><circle cx="15" cy="12" r="1" fill={color||"currentColor"}/><circle cx="15" cy="17" r="1" fill={color||"currentColor"}/></svg>;
  if(name==="google")    return <svg {...s} viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>;
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// ══════════════════════════════════════════════════════════════════════════════
export default function HomeFlow() {
  const [themeName, setThemeName] = useState("calm");
  const T = THEMES[themeName];

  const inp  = (x={}) => ({width:"100%",background:T.inputBg,border:`1.5px solid ${T.border}`,borderRadius:"0.7rem",padding:"0.62rem 0.82rem",color:T.textDark,fontSize:"0.87rem",outline:"none",boxSizing:"border-box",fontFamily:"inherit",...x});
  const lbl  = {display:"block",color:T.textMid,fontSize:"0.71rem",marginBottom:"0.35rem",textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700};
  const btnP = (bg,x={}) => ({background:bg||T.sage,color:"#fff",border:"none",borderRadius:"0.7rem",padding:"0.56rem 1.1rem",cursor:"pointer",fontWeight:700,fontSize:"0.84rem",fontFamily:"inherit",letterSpacing:"0.01em",...x});
  const btnS = (x={}) => ({background:T.white,color:T.textMid,border:`1.5px solid ${T.border}`,borderRadius:"0.7rem",padding:"0.56rem 1.1rem",cursor:"pointer",fontSize:"0.84rem",fontFamily:"inherit",fontWeight:600,...x});
  const card = (x={}) => ({background:T.surface,border:`1px solid ${T.borderSoft}`,borderRadius:"1.1rem",padding:"1.25rem",marginBottom:"0.85rem",boxShadow:`0 2px 10px ${T.cardShadow}`,...x});

  const FM = FLOW_MODES_FN(T);
  const DM = DIETARY_META_FN(T);
  const PC = [T.sage,T.blue,T.sand,T.rose,T.lavender,T.sageLight];

  // State
  const [tab,setTab]               = useState("anchor");
  const [modal,setModal]           = useState(null);
  const [flowMode,setFlowMode]     = useState("Smooth");
  const [people,setPeople]         = useState([{id:uid(),name:"You",color:T.sage},{id:uid(),name:"Partner",color:T.blue}]);
  const [tasks,setTasks]           = useState([]);
  const [meals,setMeals]           = useState({});
  const [mealCount,setMealCount]   = useState(3); // 1=dinner only, 2=lunch+dinner, 3=all
  const [shoppingItems,setShoppingItems] = useState([]);
  const [stores,setStores]         = useState(["Grocery Store","Costco","Target","Amazon"]);
  const [brainItems,setBrainItems] = useState([]);
  const [burnoutChecked,setBurnoutChecked] = useState([]);
  const [homeSystems]              = useState(HOME_SYSTEMS_DEFAULT);
  const [rhythm,setRhythm]         = useState(DEFAULT_RHYTHM);
  const [sections,setSections]     = useState({anchor:true,calendar:true,weekly:true,meals:true,shop:true,home:true,brain:true,burnout:true});
  const [syncing,setSyncing]       = useState(false);
  const [lastSync,setLastSync]     = useState(null);
  const [copied,setCopied]         = useState(false);
  const [newPersonName,setNewPersonName] = useState("");
  const [chatOpen,setChatOpen]     = useState(false);
  const [dietaryFilters,setDietaryFilters] = useState([]);
  const [calEvents,setCalEvents]   = useState([]);
  const [connectedCals,setConnectedCals] = useState([]);
  const [calViewDate,setCalViewDate] = useState(new Date(TODAY.getFullYear(),TODAY.getMonth(),1));
  const [selectedDay,setSelectedDay] = useState(null);

  const fm = FM[flowMode];
  const close = () => setModal(null);

  function handleSync(){setSyncing(true);setTimeout(()=>{setLastSync(new Date().toLocaleTimeString());setSyncing(false);close();},1600);}
  function shareText(){
    const todayTasks=tasks.filter(t=>t.day===TODAY_NAME||t.day==="Daily");
    const tm=meals[TODAY_NAME]||{};
    const mealLines=mealCount===1?[`dinner: ${tm.dinner||"—"}`]:mealCount===2?[`lunch: ${tm.lunch||"—"}`,`dinner: ${tm.dinner||"—"}`]:[`breakfast: ${tm.breakfast||"—"}`,`lunch: ${tm.lunch||"—"}`,`dinner: ${tm.dinner||"—"}`];
    return `⚓️ Anchor & Flow — ${FORMAT_DATE(TODAY)}\n\nFlow Mode: ${flowMode} ${fm.emoji}\n\nToday's Tasks:\n${todayTasks.map(t=>`• ${t.text}`).join("\n")||"No tasks."}\n\nMeals:\n${mealLines.join("\n")}\n\nHave a beautiful day 🌿`;
  }

  const MEALS_TO_SHOW = mealCount===1?["dinner"]:mealCount===2?["lunch","dinner"]:["breakfast","lunch","dinner"];

  // ── Shared UI ──────────────────────────────────────────────────────────────
  const Pill = ({label,color,tiny}) => (
    <span style={{display:"inline-flex",padding:tiny?"2px 8px":"3px 10px",borderRadius:"2rem",fontSize:tiny?"0.62rem":"0.69rem",fontWeight:700,background:(color||T.sage)+"28",color:color||T.sage,letterSpacing:"0.03em",whiteSpace:"nowrap",border:`1px solid ${(color||T.sage)}45`}}>{label}</span>
  );
  const SecHead = ({emoji,title,sub,action,color}) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1rem",gap:"0.5rem"}}>
      <div style={{minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
          {emoji&&<span style={{fontSize:"1.05rem",flexShrink:0}}>{emoji}</span>}
          <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.2rem",fontWeight:700,color:color||T.textDark}}>{title}</h2>
        </div>
        {sub&&<p style={{margin:"0.22rem 0 0",color:T.textSoft,fontSize:"0.79rem",fontWeight:500}}>{sub}</p>}
      </div>
      {action&&<div style={{flexShrink:0}}>{action}</div>}
    </div>
  );

  function ModalBox({title,onClose,children,wide}){
    return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(8px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",overflowY:"auto"}}>
        <div style={{background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:"1.4rem",padding:"1.8rem",width:"100%",maxWidth:wide?600:460,boxShadow:`0 32px 100px ${T.cardShadow}`,margin:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.4rem"}}>
            <h3 style={{margin:0,color:T.textDark,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.3rem",fontWeight:700}}>{title}</h3>
            <button onClick={onClose} style={{background:T.bgAlt,border:`1px solid ${T.border}`,color:T.textMid,cursor:"pointer",padding:6,display:"flex",borderRadius:"50%"}}>
              <Icon name="close" size={16} color={T.textMid}/>
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  }

  // ── AI Chat ────────────────────────────────────────────────────────────────
  function AIChatPanel({onClose}){
    const [messages,setMessages]=useState([{role:"assistant",text:"Hello! I'm your Anchor & Flow assistant ⚓️\n\nI can help with meal ideas, scheduling, shopping lists, or any home management question. What's on your mind?"}]);
    const [input,setInput]=useState("");
    const [loading,setLoading]=useState(false);
    const bottomRef=useRef(null);
    useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
    const SUGGESTED=["What should I make for dinner tonight?","Help me plan this week's meals","Create a quick grocery list","Tips for a smoother morning routine"];
    async function send(text){
      const q=text||input.trim();if(!q||loading)return;
      setInput("");const msgs=[...messages,{role:"user",text:q}];setMessages(msgs);setLoading(true);
      try{
        const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:`You are Anchor & Flow's warm, practical home management assistant. Help with meal planning, family scheduling, shopping, home routines. Be concise and encouraging.`,messages:msgs.map(m=>({role:m.role,content:m.text}))})});
        const d=await r.json();
        setMessages(prev=>[...prev,{role:"assistant",text:d.content?.find(b=>b.type==="text")?.text||"Sorry, try again."}]);
      }catch{setMessages(prev=>[...prev,{role:"assistant",text:"Something went wrong. Please try again."}]);}
      setLoading(false);
    }
    return (
      <div style={{position:"fixed",bottom:"5.5rem",right:"1rem",width:"min(390px,calc(100vw - 2rem))",height:530,background:T.surface,border:`2px solid ${T.blue}70`,borderRadius:"1.4rem",boxShadow:`0 24px 80px ${T.cardShadow}`,zIndex:500,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${T.blue},${T.blueDark})`,padding:"1rem 1.1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.65rem"}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid rgba(255,255,255,0.35)"}}>
              <Icon name="anchor" size={20} color="#fff"/>
            </div>
            <div>
              <div style={{color:"#fff",fontWeight:700,fontSize:"0.97rem",fontFamily:"'Cormorant Garamond',serif"}}>Anchor & Flow AI</div>
              <div style={{color:"rgba(255,255,255,0.75)",fontSize:"0.69rem",fontWeight:500}}>Your home management assistant</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",cursor:"pointer",borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Icon name="close" size={14} color="#fff"/>
          </button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"1rem",display:"flex",flexDirection:"column",gap:"0.7rem",background:T.bgAlt}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"86%",padding:"0.68rem 0.95rem",borderRadius:m.role==="user"?"1rem 1rem 0.25rem 1rem":"1rem 1rem 1rem 0.25rem",background:m.role==="user"?T.blue:T.surface,color:m.role==="user"?"#fff":T.textDark,fontSize:"0.84rem",lineHeight:1.58,whiteSpace:"pre-wrap",border:m.role==="assistant"?`1px solid ${T.borderSoft}`:"none",fontWeight:m.role==="user"?600:400}}>
                {m.text}
              </div>
            </div>
          ))}
          {loading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{padding:"0.68rem 0.95rem",borderRadius:"1rem 1rem 1rem 0.25rem",background:T.surface,border:`1px solid ${T.borderSoft}`}}><div style={{display:"flex",gap:"5px"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.blueLight,animation:`bounce 1.2s ${i*0.2}s infinite ease-in-out`}}/>)}</div></div></div>}
          <div ref={bottomRef}/>
        </div>
        {messages.length===1&&<div style={{padding:"0.6rem 0.75rem 0.3rem",background:T.bgAlt,display:"flex",flexWrap:"wrap",gap:"0.4rem"}}>{SUGGESTED.map((s,i)=><button key={i} onClick={()=>send(s)} style={{background:T.bluePale,border:`1.5px solid ${T.blueLight}`,color:T.blueDark,borderRadius:"2rem",padding:"0.33rem 0.78rem",fontSize:"0.73rem",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{s}</button>)}</div>}
        <div style={{padding:"0.75rem",borderTop:`1.5px solid ${T.borderSoft}`,display:"flex",gap:"0.5rem",alignItems:"flex-end",background:T.surface}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Ask anything about your home…" rows={1} style={{...inp({resize:"none",flex:1,lineHeight:1.5,maxHeight:80,overflowY:"auto"})}}/>
          <button onClick={()=>send()} disabled={!input.trim()||loading} style={{...btnP(T.blue,{padding:"0.56rem 0.75rem",borderRadius:"0.7rem",flexShrink:0,opacity:!input.trim()||loading?0.4:1,display:"flex",alignItems:"center",justifyContent:"center"})}}>
            <Icon name="send" size={16} color="#fff"/>
          </button>
        </div>
      </div>
    );
  }

  // ── Today Snapshot (Anchor) ───────────────────────────────────────────────
  function TodaySnapshot(){
    const todayEvents=calEvents
      .filter(e=>{const d=new Date(e.date);return d.getDate()===TODAY.getDate()&&d.getMonth()===TODAY.getMonth()&&d.getFullYear()===TODAY.getFullYear();})
      .sort((a,b)=>(a.time||"").localeCompare(b.time||""));

    // Upcoming events = later today (if time known) or all without a time
    const now=new Date();
    const nowStr=now.getHours().toString().padStart(2,"0")+":"+now.getMinutes().toString().padStart(2,"0");
    const upcoming=todayEvents.filter(e=>!e.time||e.time>=nowStr);
    const past=todayEvents.filter(e=>e.time&&e.time<nowStr);

    const hasAny=todayEvents.length>0;

    return (
      <div style={{...card({background:`linear-gradient(135deg,${T.bluePale},${T.surface})`,border:`2px solid ${T.blue}50`,padding:"1rem 1.15rem"})}}>
        {/* Header row */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:hasAny?"0.85rem":"0"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
            <Icon name="cal" size={16} color={T.blueDark}/>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Today</span>
            <span style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500}}>
              {TODAY.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
            </span>
          </div>
          <div style={{display:"flex",gap:"0.4rem"}}>
            {connectedCals.length===0&&(
              <button onClick={()=>setModal("calSync")} style={{...btnS({fontSize:"0.72rem",padding:"0.26rem 0.65rem",display:"flex",alignItems:"center",gap:"0.3rem"})}}>
                <Icon name="link" size={11} color={T.textMid}/> Connect
              </button>
            )}
            <button onClick={()=>setTab("calendar")} style={{...btnP(T.blue,{fontSize:"0.72rem",padding:"0.26rem 0.65rem",display:"flex",alignItems:"center",gap:"0.3rem"})}}>
              <Icon name="cal" size={11} color="#fff"/> Calendar
            </button>
          </div>
        </div>

        {/* No events state */}
        {!hasAny&&(
          <div style={{textAlign:"center",padding:"0.6rem 0 0.2rem"}}>
            <p style={{color:T.textFaint,fontSize:"0.82rem",fontWeight:600}}>No events today — open space 🌿</p>
          </div>
        )}

        {/* Upcoming events */}
        {upcoming.length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:"0.45rem"}}>
            {upcoming.map((e,i)=>(
              <div key={e.id} style={{display:"flex",alignItems:"center",gap:"0.7rem",padding:"0.5rem 0.65rem",background:T.white,borderRadius:"0.7rem",border:`1.5px solid ${e.color}40`,borderLeft:`4px solid ${e.color}`}}>
                <div style={{flexShrink:0,textAlign:"center",minWidth:36}}>
                  {e.time
                    ?<span style={{fontSize:"0.74rem",fontWeight:800,color:e.color,letterSpacing:"0.02em"}}>{e.time}</span>
                    :<span style={{fontSize:"0.68rem",color:T.textFaint,fontWeight:600}}>all day</span>
                  }
                </div>
                <div style={{width:1,height:28,background:e.color+"40",flexShrink:0}}/>
                <span style={{flex:1,fontSize:"0.85rem",color:T.textDark,fontWeight:700,lineHeight:1.3}}>{e.title}</span>
                {connectedCals.includes(e.source)&&(
                  <div style={{width:7,height:7,borderRadius:"50%",background:CAL_SOURCES.find(c=>c.id===e.source)?.color||T.blue,flexShrink:0}}/>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Past events — subtle */}
        {past.length>0&&(
          <div style={{marginTop:"0.6rem",paddingTop:"0.6rem",borderTop:`1px dashed ${T.borderSoft}`}}>
            <div style={{fontSize:"0.65rem",color:T.textFaint,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.35rem"}}>Earlier today</div>
            {past.map(e=>(
              <div key={e.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.28rem 0",opacity:0.55}}>
                <span style={{fontSize:"0.72rem",fontWeight:700,color:T.textSoft,minWidth:36}}>{e.time}</span>
                <div style={{width:6,height:6,borderRadius:"50%",background:e.color,flexShrink:0}}/>
                <span style={{fontSize:"0.8rem",color:T.textMid,fontWeight:500,textDecoration:"line-through"}}>{e.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Calendar Tab ───────────────────────────────────────────────────────────
  function CalendarTab(){
    const year=calViewDate.getFullYear(), month=calViewDate.getMonth();
    const daysInMonth=getDaysInMonth(year,month);
    const firstDay=(getFirstDayOfMonth(year,month)+6)%7;
    const monthName=calViewDate.toLocaleDateString("en-US",{month:"long",year:"numeric"});
    const [addingEvent,setAddingEvent]=useState(false);
    const [newEvent,setNewEvent]=useState({title:"",date:"",time:"",color:T.blue,source:"manual"});

    function eventsForDay(d){return calEvents.filter(e=>{const ed=new Date(e.date);return ed.getDate()===d&&ed.getMonth()===month&&ed.getFullYear()===year;});}

    function addEvent(){
      if(!newEvent.title||!newEvent.date)return;
      setCalEvents(prev=>[...prev,{id:uid(),...newEvent}]);
      setNewEvent({title:"",date:"",time:"",color:T.blue,source:"manual"});
      setAddingEvent(false);
    }

    return (
      <div>
        <SecHead emoji="📆" title="Calendar" sub="All your events in one place"
          action={<button onClick={()=>setAddingEvent(true)} style={{...btnP(T.blue,{display:"flex",alignItems:"center",gap:"0.4rem",fontSize:"0.8rem",padding:"0.42rem 0.85rem"})}}>
            <Icon name="plus" size={14} color="#fff"/> Add Event
          </button>}
        />

        {/* Connected calendars */}
        {connectedCals.length>0&&(
          <div style={{...card({padding:"0.85rem",marginBottom:"0.85rem"})}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem"}}>
              {connectedCals.map(cid=>{const cs=CAL_SOURCES.find(c=>c.id===cid);return cs?(<div key={cid} style={{display:"flex",alignItems:"center",gap:"0.4rem",background:cs.color+"18",border:`1.5px solid ${cs.color}44`,borderRadius:"2rem",padding:"0.25rem 0.7rem"}}><div style={{width:8,height:8,borderRadius:"50%",background:cs.color}}/><span style={{fontSize:"0.74rem",fontWeight:700,color:cs.color}}>{cs.label}</span></div>):null;})}
              <button onClick={()=>setModal("calSync")} style={{...btnS({padding:"0.25rem 0.7rem",fontSize:"0.74rem",display:"flex",alignItems:"center",gap:"0.3rem"})}}>
                <Icon name="plus" size={12} color={T.textMid}/> Add
              </button>
            </div>
          </div>
        )}

        {/* Month nav */}
        <div style={{...card({padding:"0"})}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0.85rem 1rem",borderBottom:`1px solid ${T.borderSoft}`}}>
            <button onClick={()=>setCalViewDate(new Date(year,month-1,1))} style={{background:"none",border:"none",cursor:"pointer",padding:6,display:"flex",borderRadius:"50%",color:T.textMid}}><Icon name="chevL" size={18} color={T.textMid}/></button>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.15rem",color:T.textDark}}>{monthName}</span>
            <button onClick={()=>setCalViewDate(new Date(year,month+1,1))} style={{background:"none",border:"none",cursor:"pointer",padding:6,display:"flex",borderRadius:"50%",color:T.textMid}}><Icon name="chevR" size={18} color={T.textMid}/></button>
          </div>
          {/* Day headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:T.bgAlt}}>
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>(
              <div key={d} style={{textAlign:"center",padding:"0.5rem 0",fontSize:"0.68rem",fontWeight:800,color:T.textSoft,letterSpacing:"0.05em"}}>{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderTop:`1px solid ${T.borderSoft}`}}>
            {Array.from({length:firstDay}).map((_,i)=>(
              <div key={`e${i}`} style={{minHeight:70,borderRight:`1px solid ${T.borderSoft}`,borderBottom:`1px solid ${T.borderSoft}`,background:T.bgAlt+"80"}}/>
            ))}
            {Array.from({length:daysInMonth}).map((_,i)=>{
              const day=i+1;
              const isToday=day===TODAY.getDate()&&month===TODAY.getMonth()&&year===TODAY.getFullYear();
              const dayEvts=eventsForDay(day);
              const col=(i+firstDay)%7;
              return (
                <div key={day} style={{minHeight:70,padding:"0.3rem",borderRight:`1px solid ${T.borderSoft}`,borderBottom:`1px solid ${T.borderSoft}`,background:isToday?T.bluePale:T.surface,cursor:"pointer",transition:"background 0.1s"}}
                  onClick={()=>setSelectedDay(new Date(year,month,day))}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:isToday?T.blue:"transparent",color:isToday?"#fff":T.textDark,fontSize:"0.78rem",fontWeight:isToday?800:600,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"0.2rem"}}>
                    {day}
                  </div>
                  {dayEvts.slice(0,2).map(e=>(
                    <div key={e.id} style={{background:e.color+"28",border:`1px solid ${e.color}55`,borderRadius:"0.25rem",padding:"1px 4px",marginBottom:"2px",fontSize:"0.62rem",fontWeight:700,color:e.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {e.time&&`${e.time} `}{e.title}
                    </div>
                  ))}
                  {dayEvts.length>2&&<div style={{fontSize:"0.6rem",color:T.textSoft,fontWeight:700}}>+{dayEvts.length-2} more</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Connect calendars CTA */}
        {connectedCals.length===0&&(
          <div style={{...card({background:`linear-gradient(135deg,${T.bluePale},${T.lavPale})`,border:`2px solid ${T.blue}50`,textAlign:"center",padding:"1.5rem"})}}>
            <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📆</div>
            <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.textDark,marginBottom:"0.4rem"}}>Connect Your Calendars</h3>
            <p style={{color:T.textMid,fontSize:"0.83rem",fontWeight:500,marginBottom:"1rem",lineHeight:1.6}}>Sync Google Calendar, Apple Calendar, Outlook, or any iCal source to see all your events here.</p>
            <button onClick={()=>setModal("calSync")} style={{...btnP(T.blue,{display:"inline-flex",alignItems:"center",gap:"0.5rem"})}}>
              <Icon name="link" size={15} color="#fff"/> Connect a Calendar
            </button>
          </div>
        )}

        {/* Add event modal */}
        {addingEvent&&(
          <ModalBox title="Add Event" onClose={()=>setAddingEvent(false)}>
            <div style={{marginBottom:"0.9rem"}}>
              <label style={lbl}>Event Title</label>
              <input value={newEvent.title} onChange={e=>setNewEvent(p=>({...p,title:e.target.value}))} placeholder="e.g. Doctor appointment" style={inp()}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",marginBottom:"0.9rem"}}>
              <div>
                <label style={lbl}>Date</label>
                <input type="date" value={newEvent.date} onChange={e=>setNewEvent(p=>({...p,date:e.target.value}))} style={inp()}/>
              </div>
              <div>
                <label style={lbl}>Time (optional)</label>
                <input type="time" value={newEvent.time} onChange={e=>setNewEvent(p=>({...p,time:e.target.value}))} style={inp()}/>
              </div>
            </div>
            <div style={{marginBottom:"1rem"}}>
              <label style={lbl}>Color</label>
              <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                {[T.blue,T.sage,T.sand,T.rose,T.lavender,"#e8a838"].map(c=>(
                  <button key={c} onClick={()=>setNewEvent(p=>({...p,color:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,border:newEvent.color===c?`3px solid ${T.textDark}`:`3px solid transparent`,cursor:"pointer"}}/>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
              <button onClick={()=>setAddingEvent(false)} style={btnS()}>Cancel</button>
              <button onClick={addEvent} style={btnP(T.blue)}>Add Event</button>
            </div>
          </ModalBox>
        )}

        {/* Selected day detail */}
        {selectedDay&&(
          <ModalBox title={FORMAT_SHORT(selectedDay)} onClose={()=>setSelectedDay(null)}>
            {eventsForDay(selectedDay.getDate()).length===0
              ?<p style={{color:T.textFaint,fontSize:"0.85rem",fontWeight:600,textAlign:"center",padding:"1rem 0"}}>No events this day.</p>
              :eventsForDay(selectedDay.getDate()).map(e=>(
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.6rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:e.color,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem"}}>{e.title}</div>
                    {e.time&&<div style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500}}>{e.time}</div>}
                  </div>
                  <button onClick={()=>setCalEvents(prev=>prev.filter(x=>x.id!==e.id))} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}>
                    <Icon name="trash" size={13} color={T.textFaint}/>
                  </button>
                </div>
              ))
            }
          </ModalBox>
        )}
      </div>
    );
  }

  // ── Anchor Tab ─────────────────────────────────────────────────────────────
  function AnchorTab(){
    const [newTask,setNewTask]=useState("");
    const todayTasks=tasks.filter(t=>t.day===TODAY_NAME||t.day==="Daily");
    const todayMeal=meals[TODAY_NAME]||{};
    const dayRhythm=rhythm[TODAY_NAME]||{};

    const hour=new Date().getHours();
    const greeting = hour<12 ? "Good morning" : hour<17 ? "Good afternoon" : "Good evening";
    const greetEmoji = hour<12 ? "🌿" : hour<17 ? "☀️" : "🌙";

    return (
      <div>
        {/* Hero */}
        <div style={{background:`linear-gradient(135deg,${T.blue}30,${T.bluePale})`,border:`2px solid ${T.blue}60`,borderRadius:"1.2rem",padding:"1.6rem",marginBottom:"0.85rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"0.75rem"}}>
            <div>
              <div style={{fontSize:"0.7rem",color:T.blueDark,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:800,marginBottom:"0.28rem"}}>{FORMAT_DATE(TODAY)}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"2.1rem",fontWeight:700,color:T.textDark,lineHeight:1.05}}>{greeting} {greetEmoji}</div>
              <div style={{color:T.textMid,fontSize:"0.83rem",marginTop:"0.45rem",fontWeight:600}}>{fm.emoji} {fm.desc}</div>
            </div>
            <div style={{display:"flex",gap:"0.45rem",flexWrap:"wrap"}}>
              <button onClick={()=>setModal("share")} style={{...btnS({display:"flex",alignItems:"center",gap:"0.35rem",fontSize:"0.78rem"})}}>
                <Icon name="share" size={13} color={T.textMid}/> Share
              </button>
            </div>
          </div>
          <div style={{display:"flex",gap:"0.45rem",marginTop:"1.1rem",flexWrap:"wrap"}}>
            {Object.entries(FM).map(([mode,m])=>(
              <button key={mode} onClick={()=>setFlowMode(mode)} style={{background:flowMode===mode?m.color:"transparent",color:flowMode===mode?"#fff":T.textMid,border:`2px solid ${flowMode===mode?m.color:T.border}`,borderRadius:"2rem",padding:"0.32rem 0.88rem",cursor:"pointer",fontSize:"0.77rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s",display:"flex",alignItems:"center",gap:"0.35rem"}}>
                {m.emoji} {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Today's Schedule Snapshot */}
        <TodaySnapshot/>

        {/* Day rhythm */}
        {dayRhythm.theme&&(
          <div style={{...card({background:`linear-gradient(to right,${T.sandPale},${T.surface})`,border:`2px solid ${T.sand}60`,padding:"1rem 1.25rem"})}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.65rem"}}>
              <span style={{fontSize:"1.4rem"}}>{dayRhythm.emoji}</span>
              <div>
                <div style={{fontWeight:700,color:T.textDark,fontSize:"0.95rem"}}>{TODAY_NAME} · <span style={{color:T.sandDark}}>{dayRhythm.theme}</span></div>
                <div style={{color:T.textMid,fontSize:"0.8rem",marginTop:"0.1rem",fontWeight:500}}>{dayRhythm.desc}</div>
              </div>
            </div>
          </div>
        )}

        {/* Meals preview */}
        {MEALS_TO_SHOW.some(m=>todayMeal[m])&&(
          <div style={{...card({background:`linear-gradient(to right,${T.sagePale},${T.surface})`,border:`2px solid ${T.sage}60`})}}>
            <SecHead emoji="🍽️" title="Today's Meals" color={T.sageDark}/>
            <div style={{display:"grid",gridTemplateColumns:`repeat(${MEALS_TO_SHOW.length},1fr)`,gap:"0.55rem"}}>
              {MEALS_TO_SHOW.map(m=>(
                <div key={m} style={{background:T.white,borderRadius:"0.75rem",padding:"0.68rem 0.78rem",border:`1.5px solid ${T.sage}35`}}>
                  <div style={{fontSize:"0.62rem",color:T.sageDark,textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:800,marginBottom:"0.22rem"}}>{m}</div>
                  <div style={{fontSize:"0.84rem",color:todayMeal[m]?T.textDark:T.textFaint,fontWeight:todayMeal[m]?700:400}}>{todayMeal[m]||"—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tasks */}
        <div style={{...card({borderLeft:`4px solid ${T.blue}`})}}>
          <SecHead emoji="✅" title="Today's Tasks" sub={`${todayTasks.filter(t=>t.done).length} of ${todayTasks.length} done`} color={T.blueDark}/>
          <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.85rem"}}>
            <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newTask.trim()){setTasks(p=>[...p,{id:uid(),text:newTask.trim(),day:TODAY_NAME,done:false,person:""}]);setNewTask("");}}} placeholder={`Add task for ${TODAY_NAME}…`} style={inp()}/>
            <button onClick={()=>{if(newTask.trim()){setTasks(p=>[...p,{id:uid(),text:newTask.trim(),day:TODAY_NAME,done:false,person:""}]);setNewTask("");}}} style={{...btnP(T.blue,{padding:"0.56rem 0.78rem",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"})}}>
              <Icon name="plus" size={16} color="#fff"/>
            </button>
          </div>
          {todayTasks.length===0&&<p style={{color:T.textFaint,fontSize:"0.83rem",textAlign:"center",padding:"0.8rem 0",fontWeight:600}}>No tasks today — enjoy the calm 🌿</p>}
          {todayTasks.map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.55rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
              <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,done:!x.done}:x))} style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${t.done?T.sage:T.border}`,background:t.done?T.sage:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                {t.done&&<Icon name="check" size={12} color="#fff"/>}
              </button>
              <span style={{flex:1,fontSize:"0.87rem",color:t.done?T.textFaint:T.textDark,textDecoration:t.done?"line-through":"none",fontWeight:t.done?400:600}}>{t.text}</span>
              <button onClick={()=>setTasks(p=>p.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={14} color={T.textFaint}/></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Weekly Tab — editable rhythms ──────────────────────────────────────────
  function WeeklyTab(){
    const [newTaskText,setNewTaskText]=useState("");
    const [taskDay,setTaskDay]=useState(TODAY_NAME);
    const [taskPerson,setTaskPerson]=useState("");
    const [editingDay,setEditingDay]=useState(null);
    const [editForm,setEditForm]=useState({theme:"",emoji:"",desc:""});
    const [presetPick,setPresetPick]=useState(null);
    const DAY_COLORS=[T.blue,T.sage,T.sand,T.rose,T.lavender,T.blue,T.sage];

    function openEditDay(day){
      setEditingDay(day);
      setEditForm({...rhythm[day]});
      setPresetPick(null);
    }
    function saveEditDay(){
      setRhythm(p=>({...p,[editingDay]:{...editForm}}));
      setEditingDay(null);
    }
    function applyPreset(preset){
      if(preset.theme==="Custom"){setEditForm(p=>({...p,emoji:preset.emoji}));return;}
      setEditForm({theme:preset.theme,emoji:preset.emoji,desc:preset.desc});
    }

    return (
      <div>
        <SecHead emoji="📅" title="Weekly Rhythm" sub="Your week at a glance"/>
        <div style={{...card({background:T.bluePale,border:`2px solid ${T.blue}55`})}}>
          <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
            <input value={newTaskText} onChange={e=>setNewTaskText(e.target.value)} placeholder="Add a task…" style={{...inp({flex:1,minWidth:120})}}/>
            <select value={taskDay} onChange={e=>setTaskDay(e.target.value)} style={{...inp({width:"auto",flex:"none"})}}>
              {[...MEAL_DAYS,"Daily"].map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            <select value={taskPerson} onChange={e=>setTaskPerson(e.target.value)} style={{...inp({width:"auto",flex:"none"})}}>
              <option value="">Anyone</option>
              {people.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <button onClick={()=>{if(newTaskText.trim()){setTasks(p=>[...p,{id:uid(),text:newTaskText.trim(),day:taskDay,done:false,person:taskPerson}]);setNewTaskText("");}}} style={btnP(T.blue)}>Add</button>
          </div>
        </div>

        {[...MEAL_DAYS,"Daily"].map((day,di)=>{
          const dayTasks=tasks.filter(t=>t.day===day);
          const dr=rhythm[day];
          const accent=DAY_COLORS[di%DAY_COLORS.length];
          return (
            <div key={day} style={{...card({borderLeft:`4px solid ${day===TODAY_NAME?accent:T.borderSoft}`})}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:dayTasks.length?"0.75rem":"0.1rem"}}>
                <span style={{fontSize:"1rem"}}>{dr?.emoji||"📋"}</span>
                <span style={{fontWeight:700,color:day===TODAY_NAME?accent:T.textDark,fontSize:"0.92rem"}}>{day}</span>
                {dr&&<span style={{color:T.textSoft,fontSize:"0.76rem",fontWeight:500}}>· {dr.theme}</span>}
                <div style={{flex:1}}/>
                {day===TODAY_NAME&&<Pill label="Today" color={accent} tiny/>}
                {day!=="Daily"&&(
                  <button onClick={()=>openEditDay(day)} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"0.5rem",cursor:"pointer",padding:"2px 7px",fontSize:"0.7rem",color:T.textSoft,fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                    <Icon name="edit" size={11} color={T.textSoft}/> Edit Day
                  </button>
                )}
              </div>
              {dayTasks.map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.42rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                  <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,done:!x.done}:x))} style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${t.done?T.sage:T.border}`,background:t.done?T.sage:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                    {t.done&&<Icon name="check" size={10} color="#fff"/>}
                  </button>
                  <span style={{flex:1,fontSize:"0.85rem",color:t.done?T.textFaint:T.textDark,textDecoration:t.done?"line-through":"none",fontWeight:t.done?400:600}}>{t.text}</span>
                  {t.person&&<Pill label={t.person} color={people.find(p=>p.name===t.person)?.color||T.textSoft} tiny/>}
                  <button onClick={()=>setTasks(p=>p.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.textFaint}/></button>
                </div>
              ))}
              {dayTasks.length===0&&<p style={{color:T.textFaint,fontSize:"0.77rem",fontWeight:500}}>Nothing yet</p>}
            </div>
          );
        })}

        {/* Edit day modal */}
        {editingDay&&(
          <ModalBox title={`Edit ${editingDay}`} onClose={()=>setEditingDay(null)}>
            <div style={{marginBottom:"0.75rem"}}>
              <label style={lbl}>Quick Presets</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",marginBottom:"0.85rem"}}>
                {THEME_PRESETS.map((pr,i)=>(
                  <button key={i} onClick={()=>applyPreset(pr)} style={{background:editForm.theme===pr.theme?T.blue:T.white,color:editForm.theme===pr.theme?"#fff":T.textMid,border:`1.5px solid ${editForm.theme===pr.theme?T.blue:T.border}`,borderRadius:"2rem",padding:"0.28rem 0.72rem",cursor:"pointer",fontSize:"0.75rem",fontFamily:"inherit",fontWeight:700,transition:"all 0.15s"}}>
                    {pr.emoji} {pr.theme}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"64px 1fr",gap:"0.65rem",marginBottom:"0.9rem"}}>
              <div>
                <label style={lbl}>Emoji</label>
                <input value={editForm.emoji} onChange={e=>setEditForm(p=>({...p,emoji:e.target.value}))} placeholder="🗓️" style={{...inp({textAlign:"center",fontSize:"1.2rem",padding:"0.5rem"})}}/>
              </div>
              <div>
                <label style={lbl}>Theme Name</label>
                <input value={editForm.theme} onChange={e=>setEditForm(p=>({...p,theme:e.target.value}))} placeholder="e.g. Batch Cook" style={inp()}/>
              </div>
            </div>
            <div style={{marginBottom:"1rem"}}>
              <label style={lbl}>Description</label>
              <input value={editForm.desc} onChange={e=>setEditForm(p=>({...p,desc:e.target.value}))} placeholder="What happens on this day…" style={inp()}/>
            </div>
            <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
              <button onClick={()=>setEditingDay(null)} style={btnS()}>Cancel</button>
              <button onClick={saveEditDay} style={btnP(T.sage)}>Save</button>
            </div>
          </ModalBox>
        )}
      </div>
    );
  }

  // ── Meals Tab ──────────────────────────────────────────────────────────────
  function MealsTab(){
    const [editDay,setEditDay]=useState(null);
    const [editMeal,setEditMeal]=useState({});
    function openEdit(day){setEditDay(day);setEditMeal(meals[day]||{});}
    function saveEdit(){setMeals(p=>({...p,[editDay]:editMeal}));setEditDay(null);}

    return (
      <div>
        <SecHead emoji="🍽️" title="Meal Planner" sub="Plan your week with ease"/>

        {/* Meal count toggle */}
        <div style={{...card({padding:"1rem",background:T.sagePale,border:`2px solid ${T.sage}50`,marginBottom:"0.85rem"})}}>
          <div style={{fontSize:"0.72rem",color:T.sageDark,marginBottom:"0.55rem",textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:800}}>Plan Meals</div>
          <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginBottom:"0.85rem"}}>
            {[{v:1,label:"Dinner Only",emoji:"🌙"},{v:2,label:"Lunch + Dinner",emoji:"☀️🌙"},{v:3,label:"All 3 Meals",emoji:"🌅☀️🌙"}].map(o=>(
              <button key={o.v} onClick={()=>setMealCount(o.v)} style={{background:mealCount===o.v?T.sage:T.white,color:mealCount===o.v?"#fff":T.textMid,border:`2px solid ${mealCount===o.v?T.sage:T.border}`,borderRadius:"2rem",padding:"0.32rem 0.88rem",cursor:"pointer",fontSize:"0.76rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>
                {o.emoji} {o.label}
              </button>
            ))}
          </div>
          {/* Dietary filters */}
          <div style={{fontSize:"0.72rem",color:T.sageDark,marginBottom:"0.45rem",textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:800}}>Dietary Filters</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem"}}>
            {Object.entries(DM).map(([k,v])=>(
              <button key={k} onClick={()=>setDietaryFilters(p=>p.includes(k)?p.filter(x=>x!==k):[...p,k])} style={{background:dietaryFilters.includes(k)?v.color:T.white,color:dietaryFilters.includes(k)?"#fff":T.textMid,border:`2px solid ${dietaryFilters.includes(k)?v.color:T.border}`,borderRadius:"2rem",padding:"0.3rem 0.82rem",cursor:"pointer",fontSize:"0.74rem",fontFamily:"inherit",fontWeight:700,transition:"all 0.15s"}}>
                {v.emoji} {k}
              </button>
            ))}
          </div>
        </div>

        {MEAL_DAYS.map(day=>{
          const m=meals[day]||{};
          const isToday=day===TODAY_NAME;
          return (
            <div key={day} style={{...card({borderLeft:`4px solid ${isToday?T.sage:T.borderSoft}`,background:isToday?`linear-gradient(to right,${T.sagePale},${T.surface})`:T.surface})}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                  <span style={{fontWeight:700,color:isToday?T.sageDark:T.textDark,fontSize:"0.93rem"}}>{day}</span>
                  {isToday&&<Pill label="Today" color={T.sage} tiny/>}
                </div>
                <button onClick={()=>openEdit(day)} style={{...btnS({padding:"0.3rem 0.78rem",fontSize:"0.76rem",display:"flex",alignItems:"center",gap:"0.3rem"})}}>
                  <Icon name="edit" size={12} color={T.textMid}/> Edit
                </button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:`repeat(${MEALS_TO_SHOW.length},1fr)`,gap:"0.5rem"}}>
                {MEALS_TO_SHOW.map(meal=>(
                  <div key={meal} style={{background:T.white,borderRadius:"0.65rem",padding:"0.62rem 0.72rem",border:`1.5px solid ${T.borderSoft}`}}>
                    <div style={{fontSize:"0.62rem",color:T.textMid,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:800,marginBottom:"0.2rem"}}>{meal}</div>
                    <div style={{fontSize:"0.83rem",color:m[meal]?T.textDark:T.textFaint,fontWeight:m[meal]?700:400}}>{m[meal]||"—"}</div>
                  </div>
                ))}
              </div>
              {m.notes&&<div style={{marginTop:"0.6rem",fontSize:"0.79rem",color:T.textMid,fontStyle:"italic",fontWeight:600}}>📝 {m.notes}</div>}
            </div>
          );
        })}

        {editDay&&(
          <ModalBox title={`Meals for ${editDay}`} onClose={()=>setEditDay(null)}>
            {MEALS_TO_SHOW.map(m=>(
              <div key={m} style={{marginBottom:"0.9rem"}}>
                <label style={lbl}>{m}</label>
                <input value={editMeal[m]||""} onChange={e=>setEditMeal(p=>({...p,[m]:e.target.value}))} placeholder={`${m[0].toUpperCase()+m.slice(1)}…`} style={inp()}/>
              </div>
            ))}
            <div style={{marginBottom:"1rem"}}>
              <label style={lbl}>Notes</label>
              <textarea value={editMeal.notes||""} onChange={e=>setEditMeal(p=>({...p,notes:e.target.value}))} placeholder="Dietary notes, prep reminders…" style={{...inp({height:70,resize:"none"})}}/>
            </div>
            <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
              <button onClick={()=>setEditDay(null)} style={btnS()}>Cancel</button>
              <button onClick={saveEdit} style={btnP(T.sage)}>Save</button>
            </div>
          </ModalBox>
        )}
      </div>
    );
  }

  // ── Shopping Tab ───────────────────────────────────────────────────────────
  function ShoppingTab(){
    const [newItem,setNewItem]=useState("");
    const [newStore,setNewStore]=useState(stores[0]);
    const [addingStore,setAddingStore]=useState(false);
    const [newStoreName,setNewStoreName]=useState("");
    const STORE_COLORS=[T.blue,T.sage,T.sand,T.rose,T.lavender,"#e8a838","#7ab8a8","#c878a8"];

    function addItem(){if(!newItem.trim())return;setShoppingItems(p=>[...p,{id:uid(),text:newItem.trim(),store:newStore,done:false}]);setNewItem("");}
    function addStore(){if(!newStoreName.trim())return;const ns=newStoreName.trim();setStores(p=>[...p,ns]);setNewStore(ns);setNewStoreName("");setAddingStore(false);}

    return (
      <div>
        <SecHead emoji="🛒" title="Shopping Lists" sub={`${shoppingItems.filter(i=>!i.done).length} items remaining`}/>
        <div style={{...card({background:T.sandPale,border:`2px solid ${T.sand}55`})}}>
          <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginBottom:"0.6rem"}}>
            <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addItem();}} placeholder="Add item…" style={{...inp({flex:1,minWidth:120})}}/>
            <select value={newStore} onChange={e=>setNewStore(e.target.value)} style={{...inp({width:"auto",flex:"none"})}}>
              {stores.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={addItem} style={btnP(T.sand)}>Add</button>
          </div>
          {/* Add custom store */}
          {addingStore?(
            <div style={{display:"flex",gap:"0.5rem",alignItems:"center",marginTop:"0.4rem"}}>
              <input value={newStoreName} onChange={e=>setNewStoreName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addStore();}} placeholder="Store name…" style={{...inp({flex:1})}} autoFocus/>
              <button onClick={addStore} style={btnP(T.sage,{padding:"0.45rem 0.85rem"})}>Add</button>
              <button onClick={()=>setAddingStore(false)} style={btnS({padding:"0.45rem 0.85rem"})}>Cancel</button>
            </div>
          ):(
            <button onClick={()=>setAddingStore(true)} style={{background:"none",border:`1.5px dashed ${T.sand}`,color:T.sandDark,borderRadius:"0.6rem",padding:"0.3rem 0.75rem",cursor:"pointer",fontSize:"0.76rem",fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.35rem"}}>
              <Icon name="plus" size={12} color={T.sandDark}/> Add Store
            </button>
          )}
        </div>

        {stores.map((store,si)=>{
          const items=shoppingItems.filter(i=>i.store===store);
          const accent=STORE_COLORS[si%STORE_COLORS.length];
          return (
            <div key={store} style={{...card({borderLeft:`4px solid ${accent}`})}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
                <span style={{fontWeight:700,color:T.textDark,fontSize:"0.93rem"}}>{store}</span>
                <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
                  {items.some(i=>i.done)&&<Pill label={`${items.filter(i=>i.done).length} done`} color={T.sage} tiny/>}
                  <Pill label={`${items.filter(i=>!i.done).length} left`} color={accent} tiny/>
                  {!["Grocery Store","Costco","Target","Amazon"].includes(store)&&(
                    <button onClick={()=>{setStores(p=>p.filter(s=>s!==store));setShoppingItems(p=>p.filter(i=>i.store!==store));}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.textFaint}/></button>
                  )}
                </div>
              </div>
              {items.length===0&&<p style={{color:T.textFaint,fontSize:"0.79rem",fontWeight:600}}>Nothing here yet</p>}
              {items.map(item=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.44rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                  <button onClick={()=>setShoppingItems(p=>p.map(x=>x.id===item.id?{...x,done:!x.done}:x))} style={{width:18,height:18,borderRadius:"0.3rem",border:`2px solid ${item.done?T.sage:T.border}`,background:item.done?T.sage:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                    {item.done&&<Icon name="check" size={10} color="#fff"/>}
                  </button>
                  <span style={{flex:1,fontSize:"0.85rem",color:item.done?T.textFaint:T.textDark,textDecoration:item.done?"line-through":"none",fontWeight:item.done?400:600}}>{item.text}</span>
                  <button onClick={()=>setShoppingItems(p=>p.filter(x=>x.id!==item.id))} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.textFaint}/></button>
                </div>
              ))}
            </div>
          );
        })}
        {shoppingItems.some(i=>i.done)&&(
          <button onClick={()=>setShoppingItems(p=>p.filter(i=>!i.done))} style={{...btnS({width:"100%",color:T.rose,borderColor:T.rose+"66",fontWeight:700})}}>
            Clear completed items
          </button>
        )}
      </div>
    );
  }

  // ── Home Tab ───────────────────────────────────────────────────────────────
  function HomeTab(){
    const SYSTEM_COLORS=[T.blue,T.sage,T.sand];
    return (
      <div>
        <SecHead emoji="🏠" title="Home Systems" sub="Rhythms that keep life running"/>
        {Object.entries(homeSystems).map(([key,sys],i)=>{
          const accent=SYSTEM_COLORS[i%SYSTEM_COLORS.length];
          return (
            <div key={key} style={{...card({borderLeft:`4px solid ${accent}`})}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.55rem",marginBottom:"0.85rem"}}>
                <span style={{fontSize:"1.15rem"}}>{sys.emoji}</span>
                <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark}}>{sys.label}</h2>
              </div>
              {sys.items.map((item,j)=>(
                <div key={j} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.48rem 0",borderBottom:j<sys.items.length-1?`1px solid ${T.borderSoft}`:"none"}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:accent,flexShrink:0,marginTop:5}}/>
                  <span style={{fontSize:"0.86rem",color:T.textDark,fontWeight:600,lineHeight:1.5}}>{item}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Brain Tab — priority buckets ───────────────────────────────────────────
  function BrainTab(){
    const [newBrain,setNewBrain]=useState("");
    const [brainPerson,setBrainPerson]=useState("");
    const [brainBucket,setBrainBucket]=useState("top3");
    const [activeFilter,setActiveFilter]=useState("all");

    function getBucketTheme(b){
      const colors={rose:T.rose,sand:T.sand,blue:T.blue,lavender:T.lavender};
      const pales={rose:T.rosePale,sand:T.sandPale,blue:T.bluePale,lavender:T.lavPale};
      return {color:colors[b.color]||T.sage,pale:pales[b.color]||T.sagePale};
    }

    const displayed = activeFilter==="all"?brainItems:brainItems.filter(i=>i.bucket===activeFilter);
    const bucketCounts = BRAIN_BUCKETS.reduce((acc,b)=>{acc[b.id]=brainItems.filter(i=>i.bucket===b.id&&!i.done).length;return acc;},{});

    return (
      <div>
        <SecHead emoji="🧠" title="Brain Dump" sub="Prioritise what matters"/>

        {/* Add item */}
        <div style={{...card({background:T.lavPale,border:`2px solid ${T.lavender}55`})}}>
          <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginBottom:"0.6rem"}}>
            <input value={newBrain} onChange={e=>setNewBrain(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newBrain.trim()){setBrainItems(p=>[...p,{id:uid(),text:newBrain.trim(),person:brainPerson,bucket:brainBucket,done:false}]);setNewBrain("");}}} placeholder="What's on your mind…" style={{...inp({flex:1,minWidth:130})}}/>
            <select value={taskPerson=>taskPerson} onChange={e=>setBrainPerson(e.target.value)} style={{...inp({width:"auto",flex:"none"})}}>
              <option value="">Anyone</option>
              {people.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          {/* Bucket selector */}
          <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginBottom:"0.6rem"}}>
            {BRAIN_BUCKETS.map(b=>{
              const {color,pale}=getBucketTheme(b);
              return (
                <button key={b.id} onClick={()=>setBrainBucket(b.id)} style={{background:brainBucket===b.id?color:T.white,color:brainBucket===b.id?"#fff":T.textMid,border:`2px solid ${brainBucket===b.id?color:T.border}`,borderRadius:"2rem",padding:"0.28rem 0.72rem",cursor:"pointer",fontSize:"0.74rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                  {b.emoji} {b.label}
                </button>
              );
            })}
          </div>
          <button onClick={()=>{if(newBrain.trim()){setBrainItems(p=>[...p,{id:uid(),text:newBrain.trim(),person:brainPerson,bucket:brainBucket,done:false}]);setNewBrain("");}}} style={{...btnP(T.lavender,{width:"100%",justifyContent:"center",display:"flex"})}}>
            Add to {BRAIN_BUCKETS.find(b=>b.id===brainBucket)?.label}
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginBottom:"0.75rem"}}>
          <button onClick={()=>setActiveFilter("all")} style={{background:activeFilter==="all"?T.lavender:T.white,color:activeFilter==="all"?"#fff":T.textMid,border:`1.5px solid ${activeFilter==="all"?T.lavender:T.border}`,borderRadius:"2rem",padding:"0.28rem 0.72rem",cursor:"pointer",fontSize:"0.75rem",fontWeight:700,fontFamily:"inherit"}}>
            All ({brainItems.filter(i=>!i.done).length})
          </button>
          {BRAIN_BUCKETS.map(b=>{
            const {color}=getBucketTheme(b);
            const cnt=bucketCounts[b.id];
            return (
              <button key={b.id} onClick={()=>setActiveFilter(b.id)} style={{background:activeFilter===b.id?color:T.white,color:activeFilter===b.id?"#fff":T.textMid,border:`1.5px solid ${activeFilter===b.id?color:T.border}`,borderRadius:"2rem",padding:"0.28rem 0.72rem",cursor:"pointer",fontSize:"0.75rem",fontWeight:700,fontFamily:"inherit"}}>
                {b.emoji} {b.label} {cnt>0?`(${cnt})`:""}
              </button>
            );
          })}
        </div>

        {/* Bucket groups */}
        {activeFilter==="all"
          ?BRAIN_BUCKETS.map(b=>{
            const items=brainItems.filter(i=>i.bucket===b.id);
            if(items.length===0)return null;
            const {color,pale}=getBucketTheme(b);
            return (
              <div key={b.id} style={{marginBottom:"0.85rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.5rem",padding:"0.55rem 0.75rem",background:pale,borderRadius:"0.75rem",border:`1.5px solid ${color}40`}}>
                  <span style={{fontSize:"1rem"}}>{b.emoji}</span>
                  <span style={{fontWeight:800,color,fontSize:"0.85rem",textTransform:"uppercase",letterSpacing:"0.06em"}}>{b.label}</span>
                  <span style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500}}>— {b.desc}</span>
                  <span style={{marginLeft:"auto",color,fontSize:"0.75rem",fontWeight:700}}>{items.filter(i=>!i.done).length} left</span>
                </div>
                {items.map(item=><BrainItem key={item.id} item={item} color={color}/>)}
              </div>
            );
          })
          :displayed.map(item=>{
            const b=BRAIN_BUCKETS.find(x=>x.id===item.bucket);
            const {color}=getBucketTheme(b||BRAIN_BUCKETS[2]);
            return <BrainItem key={item.id} item={item} color={color}/>;
          })
        }

        {brainItems.length===0&&(
          <div style={{...card({textAlign:"center",padding:"2rem"})}}>
            <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>🌿</div>
            <p style={{color:T.textMid,fontSize:"0.87rem",fontWeight:700}}>Your mind is clear.<br/><span style={{color:T.textSoft,fontWeight:400,fontSize:"0.82rem"}}>Add anything that's nagging at you.</span></p>
          </div>
        )}
      </div>
    );

    function BrainItem({item,color}){
      const [moveTo,setMoveTo]=useState(false);
      return (
        <div style={{...card({display:"flex",alignItems:"flex-start",gap:"0.6rem",padding:"0.88rem 1rem",borderLeft:`4px solid ${color}`,marginBottom:"0.5rem"})}}>
          <button onClick={()=>setBrainItems(p=>p.map(x=>x.id===item.id?{...x,done:!x.done}:x))} style={{width:21,height:21,borderRadius:"50%",border:`2px solid ${item.done?T.sage:T.border}`,background:item.done?T.sage:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all 0.15s"}}>
            {item.done&&<Icon name="check" size={12} color="#fff"/>}
          </button>
          <div style={{flex:1}}>
            <span style={{fontSize:"0.87rem",color:item.done?T.textFaint:T.textDark,textDecoration:item.done?"line-through":"none",fontWeight:item.done?400:600,lineHeight:1.5}}>{item.text}</span>
            <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginTop:"0.35rem",flexWrap:"wrap"}}>
              {item.person&&<Pill label={item.person} color={people.find(p=>p.name===item.person)?.color||T.textSoft} tiny/>}
              {/* Move to bucket */}
              {moveTo?(
                <div style={{display:"flex",gap:"0.3rem",flexWrap:"wrap"}}>
                  {BRAIN_BUCKETS.filter(b=>b.id!==item.bucket).map(b2=>(
                    <button key={b2.id} onClick={()=>{setBrainItems(p=>p.map(x=>x.id===item.id?{...x,bucket:b2.id}:x));setMoveTo(false);}} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"2rem",padding:"1px 7px",fontSize:"0.66rem",cursor:"pointer",fontWeight:700,fontFamily:"inherit",color:T.textMid}}>
                      → {b2.emoji} {b2.label}
                    </button>
                  ))}
                  <button onClick={()=>setMoveTo(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.66rem",color:T.textFaint,fontFamily:"inherit"}}>cancel</button>
                </div>
              ):(
                <button onClick={()=>setMoveTo(true)} style={{background:"none",border:`1px dashed ${T.border}`,borderRadius:"2rem",padding:"1px 7px",fontSize:"0.66rem",cursor:"pointer",fontWeight:700,fontFamily:"inherit",color:T.textSoft}}>move</button>
              )}
            </div>
          </div>
          <button onClick={()=>setBrainItems(p=>p.filter(x=>x.id!==item.id))} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.textFaint}/></button>
        </div>
      );
    }
  }

  // ── Burnout Tab ────────────────────────────────────────────────────────────
  function BurnoutTab(){
    return (
      <div>
        <div style={{...card({background:`linear-gradient(135deg,${T.rosePale},${T.sandPale})`,border:`2px solid ${T.rose}55`,textAlign:"center",padding:"2rem"})}}>
          <div style={{fontSize:"2.8rem",marginBottom:"0.6rem"}}>🛟</div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.7rem",color:T.textDark,margin:"0 0 0.5rem",fontWeight:700}}>Survival Mode</h2>
          <p style={{color:T.textMid,fontSize:"0.87rem",lineHeight:1.65,maxWidth:300,margin:"0 auto",fontWeight:600}}>Some days, just getting through is enough.<br/><span style={{fontWeight:400}}>Only three things matter today.</span></p>
        </div>
        {BURNOUT_TASKS.map(t=>{
          const checked=burnoutChecked.includes(t.id);
          return (
            <button key={t.id} onClick={()=>setBurnoutChecked(p=>p.includes(t.id)?p.filter(x=>x!==t.id):[...p,t.id])} style={{...card({cursor:"pointer",display:"flex",alignItems:"center",gap:"1rem",padding:"1.15rem 1.3rem",background:checked?`linear-gradient(135deg,${T.sagePale},${T.sage}18)`:T.surface,border:`2px solid ${checked?T.sage:T.borderSoft}`,width:"100%",textAlign:"left",transition:"all 0.18s"})}}>
              <span style={{fontSize:"1.6rem"}}>{t.emoji}</span>
              <span style={{flex:1,fontWeight:700,color:checked?T.sageDark:T.textDark,fontSize:"1rem",textDecoration:checked?"line-through":"none"}}>{t.label}</span>
              <div style={{width:28,height:28,borderRadius:"50%",border:`2.5px solid ${checked?T.sage:T.border}`,background:checked?T.sage:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.18s"}}>
                {checked&&<Icon name="check" size={14} color="#fff"/>}
              </div>
            </button>
          );
        })}
        {burnoutChecked.length===3&&(
          <div style={{...card({background:`linear-gradient(135deg,${T.sagePale},${T.bluePale})`,border:`2px solid ${T.sage}60`,textAlign:"center",padding:"1.5rem"})}}>
            <div style={{fontSize:"2rem",marginBottom:"0.4rem"}}>🌿</div>
            <p style={{color:T.sageDark,fontWeight:700,fontSize:"1.05rem",margin:0}}>You did it. That's everything.<br/><span style={{fontWeight:500,fontSize:"0.86rem",color:T.textMid}}>Rest now.</span></p>
          </div>
        )}
      </div>
    );
  }

  // ── Settings Tab ───────────────────────────────────────────────────────────
  function SettingsTab(){
    return (
      <div>
        <SecHead emoji="⚙️" title="Settings"/>
        {/* Theme */}
        <div style={{...card({background:`linear-gradient(135deg,${T.bluePale},${T.sagePale})`,border:`2px solid ${T.blue}55`})}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"1rem"}}>
            <Icon name="palette" size={18} color={T.blueDark}/>
            <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark}}>Appearance</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0.65rem"}}>
            {Object.entries(THEMES).map(([key,th])=>(
              <button key={key} onClick={()=>setThemeName(key)} style={{background:themeName===key?T.blue:T.white,color:themeName===key?"#fff":T.textDark,border:`2px solid ${themeName===key?T.blue:T.border}`,borderRadius:"0.9rem",padding:"0.9rem 0.5rem",cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",textAlign:"center"}}>
                <div style={{fontSize:"1.5rem",marginBottom:"0.32rem"}}>{th.emoji}</div>
                <div style={{fontWeight:700,fontSize:"0.82rem"}}>{th.label}</div>
                <div style={{fontSize:"0.67rem",opacity:0.7,marginTop:"0.12rem",fontWeight:500}}>{key==="calm"?"Warm cream":(key==="coastal"?"Soft blue":"Night mode")}</div>
              </button>
            ))}
          </div>
        </div>
        {/* People */}
        <div style={card()}>
          <SecHead emoji="👥" title="Household Members"/>
          {people.map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.5rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
              <div style={{width:12,height:12,borderRadius:"50%",background:p.color,flexShrink:0,boxShadow:`0 0 0 2.5px ${p.color}35`}}/>
              <span style={{flex:1,fontSize:"0.87rem",color:T.textDark,fontWeight:600}}>{p.name}</span>
              <button onClick={()=>setPeople(p2=>p2.filter(x=>x.id!==p.id))} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.textFaint}/></button>
            </div>
          ))}
          <div style={{display:"flex",gap:"0.5rem",marginTop:"0.82rem"}}>
            <input value={newPersonName} onChange={e=>setNewPersonName(e.target.value)} placeholder="Add person…" style={inp()}/>
            <button onClick={()=>{if(newPersonName.trim()){setPeople(p=>[...p,{id:uid(),name:newPersonName.trim(),color:PC[p.length%PC.length]}]);setNewPersonName("");}}} style={btnP(T.sage)}>Add</button>
          </div>
        </div>
        {/* Sections */}
        <div style={card()}>
          <SecHead emoji="📋" title="Visible Sections"/>
          {TABS.filter(t=>t.id!=="settings"&&t.id!=="anchor").map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.5rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
              <span style={{fontSize:"0.87rem",color:T.textDark,fontWeight:600}}>{t.emoji} {t.label}</span>
              <button onClick={()=>setSections(p=>({...p,[t.id]:!p[t.id]}))} style={{width:44,height:24,borderRadius:"2rem",border:"none",cursor:"pointer",background:sections[t.id]!==false?T.sage:T.border,position:"relative",transition:"background 0.22s",flexShrink:0}}>
                <div style={{position:"absolute",top:4,left:sections[t.id]!==false?22:4,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.22s",boxShadow:"0 1px 4px rgba(0,0,0,0.18)"}}/>
              </button>
            </div>
          ))}
        </div>
        <div style={{...card({background:T.bluePale,border:`2px solid ${T.blue}55`})}}>
          <SecHead emoji="ℹ️" title="About Anchor & Flow" color={T.blueDark}/>
          <p style={{color:T.textMid,fontSize:"0.83rem",lineHeight:1.72,margin:0,fontWeight:500}}>
            <strong style={{color:T.textDark,fontWeight:700}}>Data</strong> lives in-session and resets on refresh.<br/>
            <strong style={{color:T.textDark,fontWeight:700}}>AI Assistant</strong> ⚓️ is powered by Claude — tap the anchor button anytime.<br/>
            <strong style={{color:T.textDark,fontWeight:700}}>Calendar sync</strong> connects via Google, Apple, Outlook or iCal.
          </p>
        </div>
      </div>
    );
  }

  const visibleTabs=TABS.filter(t=>t.id==="settings"||t.id==="anchor"||sections[t.id]!==false);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Jost:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${T.bg};font-family:'Jost',sans-serif;color:${T.textDark};transition:background 0.3s,color 0.3s}
        input,select,textarea{font-family:'Jost',sans-serif!important;color:${T.textDark}!important}
        input[type="date"],input[type="time"]{color-scheme:${themeName==="night"?"dark":"light"}}
        input:focus,select:focus,textarea:focus{border-color:${T.blue}!important;box-shadow:0 0 0 3px ${T.blue}22!important;outline:none}
        select option{background:${T.surface};color:${T.textDark}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:${T.bgAlt}}::-webkit-scrollbar-thumb{background:${T.blueLight};border-radius:4px}
        @keyframes fu{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}.fu{animation:fu 0.22s ease both}
        @keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1.1)}}
      `}</style>

      <div style={{minHeight:"100vh",background:T.bg,paddingBottom:"5.5rem",transition:"background 0.3s"}}>
        {/* Top bar */}
        <div style={{background:T.topBg,borderBottom:`2px solid ${T.border}`,padding:"0.85rem 1.1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,boxShadow:`0 2px 14px ${T.cardShadow}`}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              <Icon name="anchor" size={19} color={T.blue}/>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.3rem",fontWeight:700,color:T.textDark,letterSpacing:"0.02em"}}>Anchor & Flow</span>
            </div>
            <div style={{color:T.textSoft,fontSize:"0.69rem",marginTop:"0.05rem",fontWeight:600}}>{FORMAT_DATE(TODAY)}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"0.45rem",flexWrap:"wrap",justifyContent:"flex-end"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.35rem",background:fm.bg,border:`2px solid ${fm.color}60`,borderRadius:"2rem",padding:"0.27rem 0.78rem"}}>
              <span style={{fontSize:"0.82rem"}}>{fm.emoji}</span>
              <span style={{color:fm.color,fontSize:"0.73rem",fontWeight:800}}>{flowMode}</span>
            </div>
            {people.map(p=>(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:"0.32rem",background:T.bgAlt,border:`1.5px solid ${T.border}`,borderRadius:"2rem",padding:"0.22rem 0.65rem"}}>
                <div style={{width:9,height:9,borderRadius:"50%",background:p.color,boxShadow:`0 0 0 2px ${p.color}35`}}/>
                <span style={{color:T.textMid,fontSize:"0.72rem",fontWeight:700}}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{maxWidth:700,margin:"0 auto",padding:"1.1rem 0.9rem 0.5rem"}}>
          <div className="fu" key={tab}>
            {tab==="anchor"   && <AnchorTab/>}
            {tab==="calendar" && <CalendarTab/>}
            {tab==="weekly"   && <WeeklyTab/>}
            {tab==="meals"    && <MealsTab/>}
            {tab==="shop"     && <ShoppingTab/>}
            {tab==="home"     && <HomeTab/>}
            {tab==="brain"    && <BrainTab/>}
            {tab==="burnout"  && <BurnoutTab/>}
            {tab==="settings" && <SettingsTab/>}
          </div>
        </div>

        {/* Bottom nav */}
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.navBg,borderTop:`2px solid ${T.border}`,display:"flex",justifyContent:"space-around",padding:"0.38rem 0 0.55rem",zIndex:100,overflowX:"auto",boxShadow:`0 -2px 14px ${T.cardShadow}`}}>
          {visibleTabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",padding:"0.3rem 0.4rem",minWidth:0,flex:1}}>
              <span style={{fontSize:"0.95rem",filter:tab===t.id?"none":"grayscale(0.5)",opacity:tab===t.id?1:0.5,transition:"all 0.15s"}}>{t.emoji}</span>
              <span style={{fontSize:"0.55rem",color:tab===t.id?T.blue:T.textFaint,fontWeight:tab===t.id?800:500,letterSpacing:"0.02em",whiteSpace:"nowrap",transition:"color 0.15s"}}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Floating AI button */}
      <button onClick={()=>setChatOpen(o=>!o)} title="Anchor & Flow AI" style={{position:"fixed",bottom:"5.6rem",right:"1rem",width:54,height:54,borderRadius:"50%",background:`linear-gradient(135deg,${T.blue},${T.blueDark})`,border:`2px solid ${T.blueLight}`,boxShadow:`0 4px 22px ${T.blue}60`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:499,transition:"all 0.2s"}}>
        <Icon name="anchor" size={24} color="#fff"/>
      </button>
      {chatOpen&&<AIChatPanel onClose={()=>setChatOpen(false)}/>}

      {/* Calendar sync modal */}
      {modal==="calSync"&&(
        <ModalBox title="Connect Calendars" onClose={close} wide>
          <p style={{color:T.textMid,fontSize:"0.86rem",lineHeight:1.65,marginBottom:"1.1rem",fontWeight:500}}>Connect your calendars to see all your events in Anchor & Flow. Choose one or more sources below.</p>
          <div style={{display:"flex",flexDirection:"column",gap:"0.6rem",marginBottom:"1.2rem"}}>
            {CAL_SOURCES.map(cs=>{
              const connected=connectedCals.includes(cs.id);
              return (
                <div key={cs.id} style={{display:"flex",alignItems:"center",gap:"0.85rem",padding:"0.85rem 1rem",background:connected?cs.color+"14":T.bgAlt,border:`1.5px solid ${connected?cs.color:T.border}`,borderRadius:"0.9rem",transition:"all 0.15s"}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:cs.color+"22",border:`2px solid ${cs.color}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"1.1rem"}}>
                    {cs.id==="google"?<Icon name="google" size={20}/>:cs.icon}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem"}}>{cs.label}</div>
                    <div style={{color:T.textSoft,fontSize:"0.74rem",fontWeight:500,marginTop:"0.1rem"}}>
                      {connected?"✓ Connected — events will appear in your calendar":"Tap to connect"}
                    </div>
                  </div>
                  <button onClick={()=>{
                    setConnectedCals(p=>p.includes(cs.id)?p.filter(x=>x!==cs.id):[...p,cs.id]);
                    if(!connectedCals.includes(cs.id)){
                      setSyncing(true);
                      setTimeout(()=>{setLastSync(new Date().toLocaleTimeString());setSyncing(false);},1200);
                    }
                  }} style={{...connected?btnS({color:T.rose,borderColor:T.rose+"55",fontSize:"0.78rem",padding:"0.38rem 0.8rem"}):btnP(cs.color,{fontSize:"0.78rem",padding:"0.38rem 0.8rem"})}}>
                    {connected?"Disconnect":"Connect"}
                  </button>
                </div>
              );
            })}
          </div>
          {lastSync&&<p style={{color:T.sage,fontSize:"0.76rem",fontWeight:700,marginBottom:"0.75rem"}}>Last synced: {lastSync}</p>}
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <button onClick={close} style={btnP(T.blue)}>Done</button>
          </div>
        </ModalBox>
      )}

      {/* Share modal */}
      {modal==="share"&&(
        <ModalBox title="Share Today's Briefing" onClose={close} wide>
          <textarea readOnly value={shareText()} style={{...inp({height:240,fontFamily:"monospace",fontSize:"0.77rem",resize:"none",lineHeight:1.72})}}/>
          <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end",marginTop:"0.85rem"}}>
            <button onClick={close} style={btnS()}>Close</button>
            <button onClick={()=>{navigator.clipboard?.writeText(shareText());setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={btnP(copied?T.sage:T.blue,{color:"#fff"})}>
              {copied?"✓ Copied!":"Copy to Clipboard"}
            </button>
          </div>
        </ModalBox>
      )}
    </>
  );
}
