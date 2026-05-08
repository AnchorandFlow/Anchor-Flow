import React, { useState, useRef, useEffect, useCallback } from "react";
import { AILayerDrawer, AILayerTab, AILayerNudge, useAILayer } from "./components/AILayer";

// ── Supabase client (household sync) ─────────────────────────────────────────
const SUPABASE_URL = "https://sbgbyptkunvyxjfpzght.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZ2J5cHRrdW52eXhqZnB6Z2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Njk2MDYsImV4cCI6MjA5MDA0NTYwNn0.jbrKplCdnPeqS3QEKMDMClsIVBvQYgph_U5xK5iCxY0";

async function sbFetch(path, opts={}) {
  const r = await fetch(SUPABASE_URL + path, {
    ...opts,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + (opts._token || SUPABASE_KEY),
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    }
  });
  if (!r.ok) { const e = await r.text(); throw new Error(e); }
  const ct = r.headers.get("content-type")||"";
  return ct.includes("json") ? r.json() : r.text();
}

async function sbAuth(email, password, mode="signin") {
  const path = mode === "signup"
    ? "/auth/v1/signup"
    : "/auth/v1/token?grant_type=password";
  return sbFetch(path, { method:"POST", body: JSON.stringify({ email, password }) });
}

async function sbSignOut(token) {
  return sbFetch("/auth/v1/logout", { method:"POST", _token: token });
}

// Household data keys that get synced to Supabase
const SYNC_KEYS = ["tasks","meals","calEvents","shoppingItems","rhythm","people","familyProfile","brainItems"];

const TODAY = new Date();
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const TODAY_NAME = DAY_NAMES[TODAY.getDay()];
const FORMAT_DATE = d => d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const FORMAT_SHORT = d => d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
const uid = () => Math.random().toString(36).slice(2,9);
const MEAL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const WEEKDAYS_SUN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const THEMES = {
  calm: {
    label:"Calm", emoji:"🌿",
    bg:"#F5F0E8", bgAlt:"#EDE8DF", surface:"#FDFAF5", border:"#D4CCB8", borderSoft:"#E0D8C8",
    sage:"#7a9e8e", sageDark:"#4d7a6a", sageLight:"#a0c0b0", sagePale:"#deeee8",
    sand:"#c4a882", sandDark:"#9a7a52", sandLight:"#ddc8a0", sandPale:"#f0e4d0",
    blue:"#6A9BB5", blueDark:"#4a7a94", blueLight:"#96bdd0", bluePale:"#deedf5",
    rose:"#b87265", roseDark:"#8f4f44", rosePale:"#f0ddd8",
    lavender:"#8878b8", lavPale:"#e5e0f5",
    textDark:"#2a2a38", textMid:"#5a5a6a", textSoft:"#8a8a9a", textFaint:"#b0b0be",
    white:"#FDFAF5", navBg:"#F0EBE0", topBg:"#FDFAF5",
    inputBg:"#FDFAF5", cardShadow:"rgba(80,70,50,0.08)", modalOverlay:"rgba(42,42,56,0.48)",
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
  Monday:    {theme:"Reset",        emoji:"🔄", desc:"Laundry, groceries, fresh start."},
  Tuesday:   {theme:"Taco Tuesday", emoji:"🌮", desc:"Taco night — family favourite!"},
  Wednesday: {theme:"Admin",        emoji:"📋", desc:"Emails, bills, scheduling."},
  Thursday:  {theme:"Clean",        emoji:"🧹", desc:"Deep clean, bathrooms, floors."},
  Friday:    {theme:"Prep + Fun",   emoji:"🎉", desc:"Weekend prep. Treat yourselves."},
  Saturday:  {theme:"Family",       emoji:"👨‍👩‍👧", desc:"Together time. Outings, memories."},
  Sunday:    {theme:"Rest + Reset", emoji:"🌿", desc:"Rest and gentle reset."},
};

const DEFAULT_MEAL_THEMES = {
  Monday:    {theme:"Meatless Monday",    emoji:"🥗"},
  Tuesday:   {theme:"Taco Tuesday",       emoji:"🌮"},
  Wednesday: {theme:"Pasta Wednesday",    emoji:"🍝"},
  Thursday:  {theme:"Throwback Thursday", emoji:"🍲"},
  Friday:    {theme:"Fish Friday",        emoji:"🐟"},
  Saturday:  {theme:"Slow Cook Saturday", emoji:"🫕"},
  Sunday:    {theme:"Sunday Roast",       emoji:"🍗"},
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

const HOME_SYSTEMS_DEFAULT = [
  {id:"laundry", label:"Laundry Rhythm", emoji:"🧺", items:["Wash Monday & Thursday","Fold same day — no pile-up","Put away within 24h","One load = one task"]},
  {id:"daily",   label:"Daily Reset",    emoji:"🌙", items:["Dishes done before bed","Counters wiped","10-min tidy sweep","Tomorrow's bag packed"]},
  {id:"weekly",  label:"Weekly Cleaning",emoji:"🧹", items:["Monday — Laundry + kitchen","Wednesday — Bathrooms","Thursday — Floors + surfaces","Friday — Tidy before weekend"]},
];

const BURNOUT_TASKS = [
  {id:"feed", label:"Feed everyone",    emoji:"🍳"},
  {id:"load", label:"One load laundry", emoji:"🧺"},
  {id:"reset",label:"10-min reset",     emoji:"✨"},
];

const BRAIN_BUCKETS = [
  {id:"top3",    label:"Top 3",    emoji:"🔥", desc:"Must happen today",         color:"rose"},
  {id:"next3",   label:"Next 3",   emoji:"⚡", desc:"Important, do soon",        color:"sand"},
  {id:"later",   label:"Later",    emoji:"📋", desc:"On the radar",              color:"blue"},
  {id:"delegate",label:"Delegate", emoji:"🤝", desc:"Someone else can own this", color:"lavender"},
];

// ── Brain Dump Categories (location/context groupings) ────────────────────────
const BRAIN_CATS = [
  {id:"household", label:"Household",    emoji:"🏠", desc:"Things to do at home",          suggestDay:"Clean",     color:"sage",     examples:["Fix the drawer","Wipe down fridge","Change lightbulb"]},
  {id:"errands",   label:"Errands",      emoji:"🚗", desc:"Out & about tasks",              suggestDay:"Errands",   color:"blue",     examples:["Pick up prescription","Return library books","Drop off dry cleaning"]},
  {id:"calls",     label:"Phone Calls",  emoji:"📞", desc:"Calls and voicemails to make",  suggestDay:"Admin",     color:"lavender", examples:["Call doctor","Chase insurance","Book dentist"]},
  {id:"orders",    label:"Orders",       emoji:"📦", desc:"Things to order or buy online",  suggestDay:"Admin",     color:"sand",     examples:["Order birthday gift","Restock vitamins","New shoes for Ella"]},
  {id:"admin",     label:"Admin",        emoji:"📋", desc:"Paperwork, emails, scheduling", suggestDay:"Admin",     color:"rose",     examples:["File tax docs","Reply to school email","Schedule oil change"]},
  {id:"someday",   label:"Someday",      emoji:"🌿", desc:"Nice to do, no rush",           suggestDay:null,        color:"sage",     examples:["Organise pantry","New family photos","Learn sourdough"]},
];

const TABS = [
  {id:"anchor",   label:"Anchor",   emoji:"⚓️"},
  {id:"calendar", label:"Calendar", emoji:"📆"},
  {id:"meals",    label:"Meals",    emoji:"🍽️"},
  {id:"shop",     label:"Shopping", emoji:"🛒"},
  {id:"ai",       label:"AI",       emoji:"✦"},
  {id:"weekly",   label:"Weekly",   emoji:"📅"},
  {id:"home",     label:"Home",     emoji:"🏠"},
  {id:"brain",    label:"Brain",    emoji:"🧠"},
  {id:"burnout",  label:"Burnout",  emoji:"🛟"},
  {id:"settings", label:"Settings", emoji:"⚙️"},
];
const PRIMARY_TABS = ["anchor","calendar","meals","shop","ai"];
const MORE_TABS    = ["weekly","home","brain","burnout","settings"];

const CAL_SOURCES = [
  {id:"google",  label:"Google Calendar", color:"#4285F4", icon:"G"},
  {id:"apple",   label:"Apple Calendar",  color:"#ff3b30", icon:"🍎"},
  {id:"outlook", label:"Outlook",         color:"#0078d4", icon:"O"},
  {id:"ical",    label:"iCal / Other",    color:"#888",    icon:"📅"},
];

const CAL_COLOR_OPTIONS = [
  {color:"#6A9BB5",label:"Blue"},{color:"#7a9e8e",label:"Sage"},{color:"#c4a882",label:"Sand"},
  {color:"#b87265",label:"Rose"},{color:"#8878b8",label:"Lavender"},{color:"#e8a838",label:"Gold"},
  {color:"#7ab8a8",label:"Teal"},{color:"#c878a8",label:"Pink"},
];

// ── Meal Bank Data ────────────────────────────────────────────────────────────
const MEAL_BANK_DATA = [
  {id:"m1",name:"Sheet Pan Chicken Fajitas",time:20,pans:1,tags:["kid-friendly","dairy-free","one-pan"],cleanup:"Easy",kidRating:5,ingredients:["chicken breast","bell peppers","onion","taco seasoning","tortillas","avocado","olive oil"],steps:["Slice chicken and veggies into strips","Toss with olive oil + taco seasoning","Spread on pan, bake 20 min at 400°F","Serve with warm tortillas + avocado"],swap:"Use pre-sliced frozen peppers + rotisserie chicken to skip all prep",skip:"Skip the avocado — still delicious",leftovers:"Roll into lunch wraps tomorrow",prepNote:"Slice peppers Sunday → dinner takes 5 min"},
  {id:"m2",name:"Rotisserie Chicken Bowls",time:10,pans:0,tags:["kid-friendly","dairy-free","under-15","no-cook"],cleanup:"Minimal",kidRating:4,ingredients:["rotisserie chicken","rice pouches","black beans","avocado","salsa","lime"],steps:["Shred the rotisserie chicken","Microwave rice pouches (90 sec)","Warm black beans on stove or microwave","Assemble bowls, top with salsa + avocado"],swap:"Frozen cauliflower rice instead of regular rice",skip:"Skip lime + avocado if rushed",leftovers:"Pack remaining chicken for tacos tomorrow",prepNote:"Buy rotisserie chicken same day — nothing to prep"},
  {id:"m3",name:"One-Pot Spaghetti",time:20,pans:1,tags:["kid-friendly","one-pan","freezer-friendly"],cleanup:"Easy",kidRating:5,ingredients:["ground turkey","spaghetti","marinara sauce","garlic","olive oil","parmesan"],steps:["Brown turkey with garlic in a large pot","Add pasta, marinara, and 2½ cups water","Simmer 12 min, stirring often","Top with parmesan — serve straight from pot"],swap:"Ground beef works. Skip meat for vegetarian.",skip:"No parmesan needed — kids won't notice",leftovers:"Perfect thermos lunch. Freezes beautifully.",prepNote:"None needed — everything cooks together"},
  {id:"m4",name:"Breakfast for Dinner",time:15,pans:1,tags:["kid-friendly","under-15","pantry-meal","dairy-free"],cleanup:"Easy",kidRating:5,ingredients:["eggs","bacon or turkey sausage","bread","butter","maple syrup"],steps:["Cook bacon/sausage first, set aside","Scramble eggs in the same pan","Toast bread while eggs cook","Serve everything family-style"],swap:"Turkey sausage instead of bacon",skip:"Skip toast if you're out of bread",leftovers:"Egg sandwich for tomorrow's breakfast",prepNote:"Nothing to prep — this is the rescue dinner"},
  {id:"m5",name:"Freezer Burritos",time:5,pans:0,tags:["survival-mode","under-15","no-thaw","dairy-free"],cleanup:"None",kidRating:4,ingredients:["frozen burritos","salsa","shredded cheese","sour cream"],steps:["Microwave burritos per package instructions","Top with salsa (+ cheese if using)","Done. Seriously."],swap:"Add a side of canned corn or frozen rice",skip:"Everything is optional — just eat the burrito",leftovers:"None — this is survival mode",prepNote:"Keep a box in the freezer always"},
  {id:"m6",name:"Snack Plate Night",time:5,pans:0,tags:["survival-mode","kid-friendly","dairy-free","under-15","no-cook"],cleanup:"None",kidRating:5,ingredients:["deli meat","crackers","grapes or berries","cucumber slices","hummus","cheese"],steps:["Arrange everything on a cutting board","Let kids build their own plates","Call it a 'picnic dinner' — they'll love it"],swap:"Whatever is in the fridge. No rules.",skip:"Everything is optional",leftovers:"Pack the leftovers for lunch tomorrow",prepNote:"No prep. Ever."},
  {id:"m7",name:"Sheet Pan Salmon",time:25,pans:1,tags:["dairy-free","protein-packed","one-pan"],cleanup:"Easy",kidRating:3,ingredients:["salmon fillets","asparagus","lemon","garlic","olive oil"],steps:["Preheat oven to 425°F","Season salmon with lemon, garlic, olive oil","Add asparagus to pan alongside","Bake 18 min. Squeeze lemon to serve."],swap:"Tilapia or cod if salmon unavailable",skip:"Asparagus can be swapped for frozen broccoli",leftovers:"Salmon rice bowls for tomorrow's lunch",prepNote:"Season salmon morning of — dinner is 5 min hands-on"},
  {id:"m8",name:"Black Bean Tacos",time:15,pans:1,tags:["kid-friendly","dairy-free","under-15","vegetarian","pantry-meal"],cleanup:"Easy",kidRating:4,ingredients:["canned black beans","taco shells","salsa","avocado","lime","cumin"],steps:["Warm beans with cumin + garlic powder","Warm taco shells in oven 3 min","Set up toppings on the table","Everyone builds their own"],swap:"Add rotisserie chicken for non-vegetarian",skip:"Skip avocado if out of stock",leftovers:"Bean quesadillas tomorrow",prepNote:"All pantry — no planning needed"},
  {id:"m9",name:"Slow Cooker Pulled Chicken",time:15,pans:0,tags:["dairy-free","freezer-friendly","protein-packed"],cleanup:"None",kidRating:4,ingredients:["chicken thighs","BBQ sauce","onion powder","garlic powder","chicken broth"],steps:["Add everything to slow cooker in the morning","Cook low 6–8 hrs or high 3–4 hrs","Shred with two forks","Serve on rolls, rice, or baked potatoes"],swap:"Use chicken breast for lower fat",skip:"Skip the rolls and serve over rice",leftovers:"Freezes perfectly. Make a double batch.",prepNote:"Set it in the morning — dinner is done"},
  {id:"m10",name:"Veggie Fried Rice",time:20,pans:1,tags:["kid-friendly","dairy-free","one-pan","pantry-meal"],cleanup:"Easy",kidRating:4,ingredients:["leftover rice","eggs","frozen peas + carrots","soy sauce","sesame oil","green onion"],steps:["Heat oil in large pan, scramble eggs","Add frozen veggies, cook 3 min","Add cold leftover rice, stir-fry 5 min","Season with soy sauce + sesame oil"],swap:"Add any leftover protein — chicken, shrimp, tofu",skip:"Skip sesame oil if you don't have it",leftovers:"Just as good cold for lunch",prepNote:"Use yesterday's leftover rice — actually better for fried rice"},
];

const WEEK_TYPE_PRESETS = {
  calm:     {label:"Calm Week",     emoji:"🌿", desc:"Real cooking, real food, a little more care.",      meals:{Monday:{dinner:"Sheet Pan Salmon"},Tuesday:{dinner:"Sheet Pan Chicken Fajitas"},Wednesday:{dinner:"One-Pot Spaghetti"},Thursday:{dinner:"Slow Cooker Pulled Chicken"},Friday:{dinner:"Black Bean Tacos"},Saturday:{dinner:"Veggie Fried Rice"},Sunday:{dinner:"Rotisserie Chicken Bowls"}}},
  busy:     {label:"Busy Week",     emoji:"⚡", desc:"Fast, reliable, minimal cleanup.",                   meals:{Monday:{dinner:"Rotisserie Chicken Bowls"},Tuesday:{dinner:"Black Bean Tacos"},Wednesday:{dinner:"Sheet Pan Chicken Fajitas"},Thursday:{dinner:"One-Pot Spaghetti"},Friday:{dinner:"Breakfast for Dinner"},Saturday:{dinner:"Slow Cooker Pulled Chicken"},Sunday:{dinner:"Snack Plate Night"}}},
  survival: {label:"Survival Week", emoji:"🛟", desc:"Minimum effort. Feed everyone. That's a win.",      meals:{Monday:{dinner:"Rotisserie Chicken Bowls"},Tuesday:{dinner:"Freezer Burritos"},Wednesday:{dinner:"Breakfast for Dinner"},Thursday:{dinner:"Snack Plate Night"},Friday:{dinner:"Freezer Burritos"},Saturday:{dinner:"One-Pot Spaghetti"},Sunday:{dinner:"Rotisserie Chicken Bowls"}}},
  reset:    {label:"Reset Week",    emoji:"✨", desc:"Back to basics. Nourishing and calm.",               meals:{Monday:{dinner:"Sheet Pan Salmon"},Tuesday:{dinner:"Sheet Pan Chicken Fajitas"},Wednesday:{dinner:"One-Pot Spaghetti"},Thursday:{dinner:"Veggie Fried Rice"},Friday:{dinner:"Black Bean Tacos"},Saturday:{dinner:"Slow Cooker Pulled Chicken"},Sunday:{dinner:"Rotisserie Chicken Bowls"}}},
};

const MEAL_TAG_FILTERS = [
  {id:"under-15",        label:"Under 15 min",     emoji:"⚡"},
  {id:"one-pan",         label:"One Pan",           emoji:"🍳"},
  {id:"dairy-free",      label:"Dairy Free",        emoji:"🥛"},
  {id:"kid-friendly",    label:"Kid Friendly",      emoji:"⭐"},
  {id:"no-cook",         label:"No Cook",           emoji:"🧊"},
  {id:"freezer-friendly",label:"Freezer Friendly",  emoji:"❄️"},
  {id:"survival-mode",   label:"Survival Mode",     emoji:"💪"},
  {id:"pantry-meal",     label:"Pantry Meal",       emoji:"🏠"},
  {id:"protein-packed",  label:"Protein Packed",    emoji:"🥩"},
  {id:"vegetarian",      label:"Vegetarian",        emoji:"🥦"},
  {id:"no-thaw",         label:"No Thaw Needed",    emoji:"🥶"},
];

const GTK_QUESTIONS = [
  "What's the hardest part of your week right now?",
  "What's one meal your family would eat every single week?",
  "Morning person or night owl? Helps me time suggestions better.",
  "Do you meal prep on Sundays, or more of a day-of cook?",
  "What does a really good week look like for your family?",
  "Any foods the kids absolutely won't touch?",
  "How many people are you cooking for most nights?",
  "Do you prefer quick 15-min meals or okay with 30+ when it's calm?",
  "What's your go-to survival dinner when everything falls apart?",
  "Is there a day of the week that's always chaotic for your family?",
];

function AnchorLogo({size=40, color="#6A9BB5"}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 58 Q25 50 40 58 Q55 66 70 58 Q85 50 92 54" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.8"/>
      <line x1="50" y1="22" x2="50" y2="72" stroke={color} strokeWidth="4" strokeLinecap="round"/>
      <circle cx="50" cy="15" r="6" stroke={color} strokeWidth="3.5" fill="none"/>
      <line x1="34" y1="32" x2="66" y2="32" stroke={color} strokeWidth="4" strokeLinecap="round"/>
      <path d="M50 72 Q34 72 30 62 L36 64" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <path d="M50 72 Q66 72 70 62 L64 64" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function Icon({name,size=16,color}){
  const s={width:size,height:size,display:"block",flexShrink:0};
  const p={fill:"none",stroke:color||"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};
  if(name==="anchor")   return <svg {...s} viewBox="0 0 24 24" {...p}><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="22"/><path d="M5 15H2a10 10 0 0 0 20 0h-3"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
  if(name==="close")    return <svg {...s} viewBox="0 0 24 24" {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
  if(name==="plus")     return <svg {...s} viewBox="0 0 24 24" {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
  if(name==="trash")    return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>;
  if(name==="edit")     return <svg {...s} viewBox="0 0 24 24" {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
  if(name==="check")    return <svg {...s} viewBox="0 0 24 24" {...p} strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>;
  if(name==="share")    return <svg {...s} viewBox="0 0 24 24" {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
  if(name==="sync")     return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
  if(name==="send")     return <svg {...s} viewBox="0 0 24 24" {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon fill={color||"currentColor"} stroke="none" points="22 2 15 22 11 13 2 9 22 2"/></svg>;
  if(name==="palette")  return <svg {...s} viewBox="0 0 24 24" {...p}><circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>;
  if(name==="chevL")    return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="15 18 9 12 15 6"/></svg>;
  if(name==="chevR")    return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="9 18 15 12 9 6"/></svg>;
  if(name==="chevD")    return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="6 9 12 15 18 9"/></svg>;
  if(name==="cal")      return <svg {...s} viewBox="0 0 24 24" {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if(name==="link")     return <svg {...s} viewBox="0 0 24 24" {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
  if(name==="drag")     return <svg {...s} viewBox="0 0 24 24" {...p}><circle cx="9" cy="7" r="1" fill={color||"currentColor"}/><circle cx="9" cy="12" r="1" fill={color||"currentColor"}/><circle cx="9" cy="17" r="1" fill={color||"currentColor"}/><circle cx="15" cy="7" r="1" fill={color||"currentColor"}/><circle cx="15" cy="12" r="1" fill={color||"currentColor"}/><circle cx="15" cy="17" r="1" fill={color||"currentColor"}/></svg>;
  if(name==="bell")     return <svg {...s} viewBox="0 0 24 24" {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  if(name==="carry")    return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>;
  if(name==="recipe")   return <svg {...s} viewBox="0 0 24 24" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
  if(name==="rotate")   return <svg {...s} viewBox="0 0 24 24" {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>;
  if(name==="google")   return <svg {...s} viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>;
  return null;
}

function getDaysInMonth(year,month){return new Date(year,month+1,0).getDate();}
function getFirstDayOfMonth(year,month){return new Date(year,month,1).getDay();}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("Anchor & Flow crash:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:"2rem",textAlign:"center",fontFamily:"sans-serif",background:"#faf8f4",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"1rem"}}>
          <div style={{fontSize:"2rem"}}>⚓️</div>
          <div style={{fontWeight:700,fontSize:"1.1rem",color:"#1a2744"}}>Something went wrong</div>
          <div style={{fontSize:"0.85rem",color:"#607090",maxWidth:320}}>{this.state.error?.message || "An unexpected error occurred."}</div>
          <button onClick={()=>{localStorage.clear();sessionStorage.clear();window.location.reload();}}
            style={{marginTop:"0.5rem",padding:"0.6rem 1.4rem",background:"#3a6b8a",color:"#fff",border:"none",borderRadius:"0.7rem",cursor:"pointer",fontWeight:700,fontSize:"0.9rem"}}>
            Clear & Restart
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function HomeFlow({ newShell = false }) {

  function useSaved(key, fallback) {
    const [val, setVal] = useState(() => {
      try { const s = localStorage.getItem("af_" + key); return s ? JSON.parse(s) : fallback; }
      catch { return fallback; }
    });
    function setSaved(next) {
      const resolved = typeof next === "function" ? next(val) : next;
      setVal(resolved);
      try { localStorage.setItem("af_" + key, JSON.stringify(resolved)); } catch {}
    }
    return [val, setSaved];
  }

  const [themeName, setThemeNameRaw] = useSaved("theme", "calm");
  const T = THEMES[themeName];

  const inp  = (x={}) => ({width:"100%",background:T.inputBg,border:`1.5px solid ${T.border}`,borderRadius:"0.7rem",padding:"0.62rem 0.82rem",color:T.textDark,fontSize:"0.87rem",outline:"none",boxSizing:"border-box",fontFamily:"inherit",...x});
  const lbl  = {display:"block",color:T.textMid,fontSize:"0.71rem",marginBottom:"0.35rem",textTransform:"uppercase",letterSpacing:"0.09em",fontWeight:700};
  const btnP = (bg,x={}) => ({background:bg||T.blue,color:"#fff",border:"none",borderRadius:"0.7rem",padding:"0.56rem 1.1rem",cursor:"pointer",fontWeight:700,fontSize:"0.84rem",fontFamily:"inherit",letterSpacing:"0.01em",...x});
  const btnS = (x={}) => ({background:T.white,color:T.textMid,border:`1.5px solid ${T.border}`,borderRadius:"0.7rem",padding:"0.56rem 1.1rem",cursor:"pointer",fontSize:"0.84rem",fontFamily:"inherit",fontWeight:600,...x});
  const card = (x={}) => ({background:T.surface,border:`1px solid ${T.borderSoft}`,borderRadius:"1.1rem",padding:"1.25rem",marginBottom:"0.85rem",boxShadow:`0 2px 10px ${T.cardShadow}`,...x});

  const FM = FLOW_MODES_FN(T);
  const DM = DIETARY_META_FN(T);
  const PC = [T.sage,T.blue,T.sand,T.rose,T.lavender,T.sageLight];

  // ── Auth & Household Sync State ─────────────────────────────────────────────
  const [authToken,  setAuthToken]  = useSaved("authToken",  null);
  const [authUser,   setAuthUser]   = useSaved("authUser",   null);
  const [householdId,setHouseholdId]= useSaved("householdId",null);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const [lastSyncTime,setLastSyncTime] = useState(null);
  const [showAuthModal,setShowAuthModal] = useState(false);
  const [showHouseholdModal,setShowHouseholdModal] = useState(false);
  const [anchorDayOpen,setAnchorDayOpen] = useState(false);
  const [googleCalToken,setGoogleCalToken]     = useSaved("googleCalToken", null);
  const [googleCalSyncing,setGoogleCalSyncing] = useState(false);
  const [googleCalError,setGoogleCalError]     = useState("");
  const syncChannelRef = useRef(null);

  // ── Household sync functions ─────────────────────────────────────────────────
  async function signUp(email, password, displayName) {
    try {
      setSyncStatus("syncing");
      const data = await sbAuth(email, password, "signup");
      if (!data.access_token) throw new Error(data.msg || data.error_description || "Signup failed");
      const token = data.access_token;
      const name = displayName || email.split("@")[0];
      // Save display name to Supabase user metadata
      try {
        await sbFetch("/auth/v1/user", {
          method: "PUT", _token: token,
          body: JSON.stringify({ data: { displayName: name } })
        });
      } catch {}
      setAuthToken(token);
      setAuthUser({ id: data.user.id, email, displayName: name });
      const hid = "hh_" + uid();
      setHouseholdId(hid);
      await pushHouseholdData(token, hid);
      await persistHouseholdId(token, hid);
      setSyncStatus("synced");
      setLastSyncTime(new Date().toLocaleTimeString());
      return { ok: true };
    } catch(e) {
      setSyncStatus("error");
      const msg = e.message||"";
      if (msg.includes("already registered") || msg.includes("User already")) {
        return { ok:false, error: "An account with this email already exists. Please sign in instead." };
      }
      return { ok:false, error: msg };
    }
  }

  async function signIn(email, password) {
    try {
      setSyncStatus("syncing");
      const data = await sbAuth(email, password, "signin");
      if (!data.access_token) throw new Error(data.msg || data.error_description || "Sign in failed");
      const token = data.access_token;
      // Get display name from metadata, with readable email fallback
      const rawName = data.user.user_metadata?.displayName
        || data.user.user_metadata?.full_name
        || data.user.user_metadata?.name
        || "";
      const emailFallback = email.split("@")[0].split(/[._-]/)
        .map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
      const displayName = rawName || emailFallback;
      setAuthToken(token);
      setAuthUser({ id: data.user.id, email, displayName });
      try {
        // Priority 1: use householdId saved in Supabase user metadata (set on join or signup)
        const savedHid = data.user.user_metadata?.householdId || null;
        if (savedHid) {
          // Load the specific household they previously joined or created
          const rows = await sbFetch(`/rest/v1/households?id=eq.${savedHid}&select=*`, { _token: token });
          if (rows && rows.length > 0) {
            setHouseholdId(savedHid);
            if (rows[0].data) {
              SYNC_KEYS.forEach(k => {
                if (rows[0].data[k] !== undefined) {
                  try { localStorage.setItem("af_"+k, JSON.stringify(rows[0].data[k])); } catch {}
                }
              });
            }
          } else {
            // Saved household no longer exists — fall through to create a new one
            const hid = "hh_" + uid();
            setHouseholdId(hid);
            await pushHouseholdData(token, hid);
            await persistHouseholdId(token, hid);
          }
        } else {
          // Priority 2: check if they own a household (original account, no metadata yet)
          const rows = await sbFetch(`/rest/v1/households?owner_id=eq.${data.user.id}&select=*&limit=1`, { _token: token });
          if (rows && rows.length > 0) {
            setHouseholdId(rows[0].id);
            if (rows[0].data) {
              SYNC_KEYS.forEach(k => {
                if (rows[0].data[k] !== undefined) {
                  try { localStorage.setItem("af_"+k, JSON.stringify(rows[0].data[k])); } catch {}
                }
              });
            }
            // Backfill metadata so future logins use Priority 1
            await persistHouseholdId(token, rows[0].id);
          } else {
            // Priority 3: truly new user with no household — create one
            const hid = "hh_" + uid();
            setHouseholdId(hid);
            await pushHouseholdData(token, hid);
            await persistHouseholdId(token, hid);
          }
        }
      } catch {}
      sessionStorage.removeItem("af_pulled"); // allow fresh pull after sign-in
      setSyncStatus("synced");
      setLastSyncTime(new Date().toLocaleTimeString());
      return { ok: true };
    } catch(e) {
      setSyncStatus("error");
      const msg = e.message||"";
      if (msg.includes("Invalid login") || msg.includes("invalid_grant") || msg.includes("400")) {
        return { ok:false, error: "Incorrect email or password. Please try again." };
      }
      return { ok:false, error: msg };
    }
  }

  // ── Save householdId to Supabase user metadata ──────────────────────────────
  async function persistHouseholdId(token, hid) {
    try {
      await sbFetch("/auth/v1/user", {
        method: "PUT", _token: token,
        body: JSON.stringify({ data: { householdId: hid } })
      });
    } catch {}
  }

  async function signOut() {
    if (authToken) { try { await sbSignOut(authToken); } catch {} }
    setAuthToken(null);
    setAuthUser(null);
    setHouseholdId(null);
    setSyncStatus("idle");
  }

  async function pushHouseholdData(token, hid) {
    if (!token || !hid) return;
    const payload = {};
    SYNC_KEYS.forEach(k => { try { payload[k] = JSON.parse(localStorage.getItem("af_"+k)||"null"); } catch {} });
    try {
      await sbFetch("/rest/v1/households", {
        method: "POST",
        _token: token,
        headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id: hid, data: payload, updated_at: new Date().toISOString() })
      });
    } catch {
      // Fallback: try PATCH if POST fails
      try {
        await sbFetch(`/rest/v1/households?id=eq.${hid}`, {
          method: "PATCH",
          _token: token,
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({ data: payload, updated_at: new Date().toISOString() })
        });
      } catch {}
    }
  }

  async function pullHouseholdData(token, hid) {
    if (!token) return;
    // Always use a specific household ID — never pull a random row
    const targetHid = hid || householdId;
    if (!targetHid) return;
    const rows = await sbFetch(`/rest/v1/households?id=eq.${targetHid}&select=*`, { _token: token });
    if (!rows || !rows.length) return;
    const row = rows[0];
    if (!row.data) return;
    setHouseholdId(row.id);
    SYNC_KEYS.forEach(k => {
      if (row.data[k] !== undefined) {
        try { localStorage.setItem("af_"+k, JSON.stringify(row.data[k])); } catch {}
      }
    });
    // Reload once to pick up synced localStorage, but prevent reload loops
    if (!sessionStorage.getItem("af_pulled")) {
      sessionStorage.setItem("af_pulled", "1");
      window.location.reload();
    }
  }

  async function joinHousehold(token, joinCode) {
    // joinCode is the householdId shared by the other person
    try {
      setSyncStatus("syncing");
      const rows = await sbFetch(`/rest/v1/households?id=eq.${joinCode}&select=*`, { _token: token });
      if (!rows || !rows.length) return { ok:false, error:"Household not found. Check the code and try again." };
      setHouseholdId(joinCode);
      await persistHouseholdId(authToken, joinCode);
      SYNC_KEYS.forEach(k => {
        if (rows[0].data?.[k] !== undefined) {
          try { localStorage.setItem("af_"+k, JSON.stringify(rows[0].data[k])); } catch {}
        }
      });
      setSyncStatus("synced");
      setLastSyncTime(new Date().toLocaleTimeString());
      window.location.reload();
      return { ok: true };
    } catch(e) { setSyncStatus("error"); return { ok:false, error: e.message }; }
  }

  async function syncNow() {
    if (!authToken || !householdId) return;
    try {
      setSyncStatus("syncing");
      await pushHouseholdData(authToken, householdId);
      setSyncStatus("synced");
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch { setSyncStatus("error"); }
  }

  // Auto-sync every 60s when logged in
  useEffect(() => {
    if (!authToken || !householdId) return;
    const iv = setInterval(syncNow, 60000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, householdId]);

  // Sync on task/meal/cal changes (debounced)
  const syncTimeoutRef = useRef(null);
  function debouncedSync() {
    if (!authToken || !householdId) return;
    clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(syncNow, 3000);
  }

  // ── All state ───────────────────────────────────────────────────────────────
  const [tab,setTabInner] = useState("anchor");
  const setTab = (t) => setTabInner(t);
  useEffect(() => {
    const handler = (e) => setTabInner(e.detail);
    window.addEventListener("af-set-tab", handler);
    return () => window.removeEventListener("af-set-tab", handler);
  }, []);
  const [modal,setModal]                       = useState(null);
  const [flowMode,setFlowMode]                 = useSaved("flowMode","Smooth");
  const [people,setPeople]                     = useSaved("people",[{id:uid(),name:"You",color:"#6A9BB5"},{id:uid(),name:"Partner",color:"#7a9e8e"}]);
  const [tasks,setTasks]                       = useSaved("tasks",[]);
  const [meals,setMeals]                       = useSaved("meals",{});
  const [mealCount,setMealCount]               = useSaved("mealCount",3);
  const [mealThemeEnabled,setMealThemeEnabled] = useSaved("mealThemeEnabled",false);
  const [mealThemes,setMealThemes]             = useSaved("mealThemes",DEFAULT_MEAL_THEMES);
  const [recipes,setRecipes]                   = useSaved("recipes",[]);
  const [shoppingItems,setShoppingItems]       = useSaved("shoppingItems",[]);
  const [stores,setStores]                     = useSaved("stores",["Grocery Store","Costco","Target","Amazon"]);
  const [brainItems,setBrainItems]             = useSaved("brainItems",[]);
  const [burnoutChecked,setBurnoutChecked]     = useSaved("burnoutChecked",[]);
  const [homeSystems,setHomeSystems]           = useSaved("homeSystems",HOME_SYSTEMS_DEFAULT);
  const [rhythm,setRhythm]                     = useSaved("rhythm",DEFAULT_RHYTHM);
  const [sections,setSections]                 = useSaved("sections",{anchor:true,calendar:true,weekly:true,meals:true,shop:true,home:true,brain:true,burnout:true});
  const [dietaryFilters,setDietaryFilters]     = useSaved("dietaryFilters",["Dairy-free"]);
  const [calEvents,setCalEvents]               = useSaved("calEvents",[]);
  const [connectedCals,setConnectedCals]       = useSaved("connectedCals",[]);
  const [collapsedStores,setCollapsedStores]   = useSaved("collapsedStores",{});
  const [familyProfile,setFamilyProfile]       = useSaved("familyProfile",null);
  const [notifications,setNotifications]       = useSaved("notifications",[]);
  const [aiMemory,setAiMemory]                 = useSaved("aiMemory",{});
  const [dailySummaryScheduled,setDailySummaryScheduled] = useSaved("dailySummaryScheduled",null);

  const [calViewDate,setCalViewDate]   = useState(new Date(TODAY.getFullYear(),TODAY.getMonth(),1));
  const [selectedDay,setSelectedDay]   = useState(null);
  const [calView,setCalView]           = useState("month");
  const [chatOpen,setChatOpen]         = useState(false);
  const [moreDrawerOpen,setMoreDrawerOpen] = useState(false);
  const [newPersonName,setNewPersonName]   = useState("");
  const [syncing,setSyncing]           = useState(false);
  const [lastSync,setLastSync]         = useState(null);
  const [copied,setCopied]             = useState(false);

  const [calFormMode,setCalFormMode]   = useState(null);
  const [calFormId,setCalFormId]       = useState(null);
  const [calFormInit,setCalFormInit]   = useState(null);

  const [showRecipeImport,setShowRecipeImport] = useState(false);
  const [recipeUrl,setRecipeUrl]       = useState("");
  const [recipeLoading,setRecipeLoading] = useState(false);
  const [recipeResult,setRecipeResult] = useState(null);
  const [recipeError,setRecipeError]   = useState("");
  const [manualRecipe,setManualRecipe] = useState({name:"",ingredients:"",servings:"",notes:"",source:""});

  const [onboardStep,setOnboardStep]   = useState(0);
  const [onboardAnswers,setOnboardAnswers] = useState({parentNames:"",numKids:"",kidAges:"",dietaryNeeds:"",biggestChallenge:"",favoriteDinner:"",cookingStyle:""});
  const [showOnboarding,setShowOnboarding] = useState(false);

  const [notifPermission,setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  // ── New feature state (all useSaved first, then useState) ───────────────────
  const [onboardingComplete,setOnboardingComplete] = useSaved("onboardingComplete",false);
  const [dayBriefing,setDayBriefing]               = useSaved("dayBriefing",null);
  const [briefingBuilt,setBriefingBuilt]           = useSaved("briefingBuilt",null);
  const [lastSeenDate,setLastSeenDate]             = useSaved("lastSeenDate",null);
  const [favMeals,setFavMeals]                     = useSaved("favMeals",[]);
  const [emailSubmitted,setEmailSubmitted]         = useSaved("emailSubmitted",false);

  const [showOnboardingWizard,setShowOnboardingWizard] = useState(false);
  const [showBriefing,setShowBriefing]             = useState(false);
  const [showEndOfDay,setShowEndOfDay]             = useState(false);
  const [showTomorrowPrep,setShowTomorrowPrep]     = useState(false);
  const [briefingLoading,setBriefingLoading]       = useState(false);
  const [sampleDayActive,setSampleDayActive]       = useState(false);
  const [showSurvivalBanner,setShowSurvivalBanner] = useState(true);
  const [aiNudgeDismissed,setAiNudgeDismissed]     = useState(false);
  const [showEmailCapture,setShowEmailCapture]     = useState(false);
  const [emailInput,setEmailInput]                 = useState("");
  const [overwhelmed,setOverwhelmed]               = useSaved("overwhelmed",false);
  const [checkedCalEvents,setCheckedCalEvents]     = useSaved("checkedCalEvents",[]);
  const [checkedMealItems,setCheckedMealItems]     = useSaved("checkedMealItems",[]);
  const [anchorNotifFor,setAnchorNotifFor]         = useState(null);

  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [installDismissed, setInstallDismissed] = useSaved("installDismissed", false);

  // ── AILayer — smart AI assistant layer ──────────────────────────────────────
  const {
    insights,
    weekLoad,
    loading:    aiLoading,
    aiThinking,
    fetchInsights,
    lightenWeek,
    decideDinner,
    dismissInsight,
    handleInsightAction,
  } = useAILayer({ authToken, flowMode });

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      if (!installDismissed) setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installDismissed]);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setShowInstallBanner(false);
    setInstallPrompt(null);
  }

  const fm = FM[flowMode];
  const close = () => setModal(null);
  const MEALS_TO_SHOW = mealCount===1?["dinner"]:mealCount===2?["lunch","dinner"]:["breakfast","lunch","dinner"];

  // ── Derived / constants ─────────────────────────────────────────────────────
  const todayDateStr       = TODAY.toISOString().split("T")[0];
  const briefingReadyToday = briefingBuilt === todayDateStr && !!dayBriefing;
  const hasExistingData    = tasks.length>0 || Object.keys(meals).length>0 || !!familyProfile || brainItems.length>0;
  const shouldShowOnboarding = showOnboardingWizard || (!onboardingComplete && !hasExistingData);

  const MICROCOPY = ["Let's keep this simple.","You're doing enough.","It's okay if today is messy.","We'll just focus on what matters.","One thing at a time.","You've got this — really.","Progress, not perfection."];
  const todayMicrocopy = MICROCOPY[TODAY.getDate() % MICROCOPY.length];

  const SAMPLE_TASKS = [
    {id:"s1",text:"School drop-off",day:TODAY_NAME,done:true,person:"",order:0},
    {id:"s2",text:"Grocery run — just the essentials",day:TODAY_NAME,done:false,person:"",order:1},
    {id:"s3",text:"One load of laundry",day:TODAY_NAME,done:false,person:"",order:2},
    {id:"s4",text:"15-min tidy before dinner",day:TODAY_NAME,done:false,person:"",order:3},
  ];

  // ── Build Daily Briefing ────────────────────────────────────────────────────
  async function buildDailyBriefing() {
    if (briefingBuilt === todayDateStr) { setShowBriefing(true); return; }
    setBriefingLoading(true);
    setShowBriefing(true);
    const tmrName = (()=>{ const d=new Date(TODAY); d.setDate(d.getDate()+1); return DAY_NAMES[d.getDay()]; })();
    const todayMealObj = meals[TODAY_NAME]||{};
    const tmrMeal  = meals[tmrName]||{};
    const dayRhythm= rhythm[TODAY_NAME]||{};
    const tmrRhythm= rhythm[tmrName]||{};
    const carried  = tasks.filter(t=>t.carried&&t.carriedTo===TODAY_NAME&&!t.archived);
    const existing = tasks.filter(t=>(t.day===TODAY_NAME||t.day==="Daily")&&!t.archived);
    const todayEvts= calEvents.filter(e=>{
      if(!e.date)return false;
      const ed=new Date(e.date+"T00:00:00");
      return ed.getDate()===TODAY.getDate()&&ed.getMonth()===TODAY.getMonth()&&ed.getFullYear()===TODAY.getFullYear();
    }).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
    const tmrEvts  = calEvents.filter(e=>{
      if(!e.date)return false;
      const ed=new Date(e.date+"T00:00:00");
      const d=new Date(TODAY); d.setDate(d.getDate()+1);
      return ed.getDate()===d.getDate()&&ed.getMonth()===d.getMonth()&&ed.getFullYear()===d.getFullYear();
    });
    const brainPending = brainItems.filter(b=>!b.done&&!b.scheduledDay);
    const brainForTheme = BRAIN_CATS.find(c=>
      c.suggestDay && dayRhythm.theme && c.suggestDay.toLowerCase()===dayRhythm.theme.toLowerCase()
    );
    const next7 = Array.from({length:7},(_,i)=>{const d=new Date(TODAY);d.setDate(d.getDate()+i+1);return d.toISOString().split("T")[0];});
    const upcomingEvts7 = calEvents.filter(e=>next7.includes(e.date)).slice(0,6);
    const ctx = [
      "Family: "+(familyProfile?JSON.stringify(familyProfile):"not set"),
      "Today: "+TODAY_NAME+", theme: "+(dayRhythm.theme||"none"),
      "Events today: "+(todayEvts.map(e=>(e.time||"all day")+" "+e.title).join(", ")||"none"),
      "Upcoming events next 7 days: "+(upcomingEvts7.map(e=>e.date+" "+e.title).join(", ")||"none"),
      "Meals: "+(Object.entries(todayMealObj).map(([k,v])=>k+"="+v).join(", ")||"none"),
      "Carried tasks: "+(carried.map(t=>t.text).join(", ")||"none"),
      "Existing tasks: "+(existing.map(t=>t.text).join(", ")||"none"),
      "Brain dump relevant to today's theme: "+(brainForTheme?brainPending.filter(b=>b.cat===brainForTheme.id).map(b=>b.text).join(", ")||"none":"none"),
      "Full brain dump (undone): "+brainPending.slice(0,12).map(b=>b.text).join(", ")||"none",
      "Tomorrow: "+tmrName+", theme="+(tmrRhythm.theme||"none")+", dinner="+(tmrMeal.dinner||"none")+", events="+(tmrEvts.map(e=>e.title).join(", ")||"none"),
      "Flow mode: "+flowMode,
    ].join(". ");
    const sysPrompt = `You are Anchor & Flow. Build a smart family daily anchor. Use the brain dump items to pull relevant tasks into today — especially ones matching the day theme. For upcoming events, suggest prep tasks (e.g. "Wash soccer jersey" for a soccer game, "Confirm reservation" for a dinner). Respond ONLY in valid JSON: {"greeting":"warm personal sentence","top3":["task","task","task"],"next3":["task","task","task"],"more":["task"],"prepItems":["meal prep step if needed"],"tomorrowNote":"one sentence about tomorrow","message":"closing encouragement"}. top3 must include appointments. Pull from brain dump where relevant — use EXACT brain dump text. Keep tasks under 55 chars.`;
    try {
      const res = await fetch("/api/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,system:sysPrompt,messages:[{role:"user",content:ctx}]})
      });
      const dat = await res.json();
      const txt = dat.content?.find(b=>b.type==="text")?.text||"{}";
      const p   = JSON.parse(txt.replace(/```json|```/g,"").trim());
      const newT = [
        ...(p.top3||[]).map((text,i)=>({id:uid(),text,day:TODAY_NAME,done:false,person:"",order:i,aiG:true,tier:"top3"})),
        ...(p.next3||[]).map((text,i)=>({id:uid(),text,day:TODAY_NAME,done:false,person:"",order:3+i,aiG:true,tier:"next3"})),
        ...(p.more||[]).map((text,i)=>({id:uid(),text,day:TODAY_NAME,done:false,person:"",order:6+i,aiG:true,tier:"more"})),
      ];
      setTasks(prev=>[...prev.filter(t=>!(t.aiG&&(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME))),...newT]);
      setDayBriefing({...p,todayEvts,tmrEvts,todayMealObj,tmrMeal,dayRhythm,tmrRhythm,tmrName});
      setBriefingBuilt(todayDateStr);
      setLastSeenDate(todayDateStr);
    } catch(err) {
      const fb = [
        {id:uid(),text:"Choose your most important task",day:TODAY_NAME,done:false,person:"",order:0,aiG:true,tier:"top3"},
        {id:uid(),text:"Check your calendar",day:TODAY_NAME,done:false,person:"",order:1,aiG:true,tier:"top3"},
        {id:uid(),text:"Plan tonight's dinner",day:TODAY_NAME,done:false,person:"",order:2,aiG:true,tier:"top3"},
      ];
      setTasks(prev=>[...prev,...fb]);
      setDayBriefing({greeting:"Let's take it one step at a time.",top3:fb.map(t=>t.text),next3:[],more:[],prepItems:[],tomorrowNote:"Tomorrow is a fresh start.",message:"You've got this.",todayEvts,tmrEvts,todayMealObj,tmrMeal,dayRhythm,tmrRhythm,tmrName});
      setBriefingBuilt(todayDateStr);
    }
    setBriefingLoading(false);
  }

  // ── Yesterday carry-over ────────────────────────────────────────────────────
  const yesterdayName = (() => { const d=new Date(TODAY); d.setDate(d.getDate()-1); return DAY_NAMES[d.getDay()]; })();
  const incompletePrevTasks = tasks.filter(t => !t.done && t.day===yesterdayName && !t.carried && !t.archived);

  function carryTasksOver() {
    setTasks(p => p.map(t =>
      incompletePrevTasks.find(x=>x.id===t.id) ? {...t, carried:true, carriedTo:TODAY_NAME} : t
    ));
  }

  // ── Notifications ───────────────────────────────────────────────────────────
  async function requestNotifPermission() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") scheduleDailySummary();
  }

  function scheduleNotification(title, body, fireAt) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const delay = fireAt instanceof Date
      ? fireAt.getTime() - Date.now()
      : typeof fireAt === "number" ? fireAt : 0;
    if (delay < 0) { new Notification(title, {body, icon:"/favicon.svg"}); return; }
    if (delay === 0) { new Notification(title, {body, icon:"/favicon.svg"}); return; }
    if (delay < 86400000) setTimeout(() => new Notification(title, {body, icon:"/favicon.svg"}), delay);
  }

  function addNotification(entityId, entityTitle, date, time, note) {
    const id = uid();
    const fireAt = date && time ? `${date}T${time}` : null;
    setNotifications(p => [
      ...p.filter(n => n.entityId !== entityId),
      {id, entityId, entityTitle, date, time, note, fireAt, fired:false}
    ]);
    if (fireAt && notifPermission === "granted") {
      scheduleNotification(entityTitle, note || "Reminder from Anchor & Flow", new Date(fireAt));
    }
  }

  async function requestNotifPermission() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") scheduleAllDailyNotifications();
  }

  function scheduleNotification(title, body, fireAt) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const delay = fireAt instanceof Date
      ? fireAt.getTime() - Date.now()
      : typeof fireAt === "number" ? fireAt : 0;
    if (delay < 0) { new Notification(title, {body, icon:"/favicon.svg"}); return; }
    if (delay === 0) { new Notification(title, {body, icon:"/favicon.svg"}); return; }
    if (delay < 86400000) setTimeout(() => new Notification(title, {body, icon:"/favicon.svg"}), delay);
  }

  function addNotification(entityId, entityTitle, date, time, note) {
    const id = uid();
    const fireAt = date && time ? `${date}T${time}` : null;
    setNotifications(p => [
      ...p.filter(n => n.entityId !== entityId),
      {id, entityId, entityTitle, date, time, note, fireAt, fired:false}
    ]);
    if (fireAt && notifPermission === "granted") {
      scheduleNotification(entityTitle, note || "Reminder from Anchor & Flow", new Date(fireAt));
    }
  }

  // ── Helper: fire time today at a given hour/minute ───────────────────────────
  function todayAt(hour, minute=0) {
    const t = new Date();
    t.setHours(hour, minute, 0, 0);
    return t;
  }

  // ── AI message generator ─────────────────────────────────────────────────────
  async function generateAIMessage(system, userContent, fallback) {
    try {
      const r = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 160,
          system, messages: [{ role: "user", content: userContent }]
        })
      });
      const d = await r.json();
      return d.content?.find(b => b.type === "text")?.text || fallback;
    } catch { return fallback; }
  }

  // ── Schedule all daily notifications ─────────────────────────────────────────
  async function scheduleAllDailyNotifications() {
    if (notifPermission !== "granted") return;
    const todayStr = TODAY.toDateString();
    if (dailySummaryScheduled === todayStr) return;
    setDailySummaryScheduled(todayStr);

    const todayTasks  = tasks.filter(t => (t.day===TODAY_NAME||t.day==="Daily") && !t.archived);
    const doneTasks   = todayTasks.filter(t => t.done);
    const pendingTasks= todayTasks.filter(t => !t.done);
    const todayMeal   = (meals[TODAY_NAME]||{}).dinner;
    const todayDateStr= TODAY.toISOString().split("T")[0];
    const todayEvts   = calEvents.filter(e => e.date === todayDateStr).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
    const tmrName     = DAY_NAMES[new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate()+1).getDay()];
    const tmrMeal     = (meals[tmrName]||{}).dinner;
    const familyCtx   = familyProfile ? `Family: ${familyProfile.parentNames}, ${familyProfile.numKids} kids.` : "";
    const dataCtx     = `Tasks: ${pendingTasks.slice(0,4).map(t=>t.text).join(", ")||"none"}. Dinner: ${todayMeal||"not planned"}. Events: ${todayEvts.slice(0,3).map(e=>`${e.time||"all day"} ${e.title}`).join(", ")||"none"}. ${familyCtx}`;

    const now = new Date();

    // ── 1. MORNING AGENDA (7am) ─────────────────────────────────────────────
    const morningTime = todayAt(7);
    if (morningTime > now) {
      const msg = await generateAIMessage(
        `You are Anchor & Flow. Write a warm, personal morning notification (max 140 chars). Start with "Good morning" and mention 1-2 specific things from their day. End with gentle encouragement. No bullet points.`,
        dataCtx,
        `Good morning! Your family's daily anchor is ready. ${todayEvts.length>0?`First up: ${todayEvts[0].title}.`:""} You've got this. ⚓️`
      );
      scheduleNotification("⚓️ Your daily anchor is ready", msg, morningTime);
    }

    // ── 2. MIDDAY CHECK-IN (12pm) ───────────────────────────────────────────
    const middayTime = todayAt(12);
    if (middayTime > now) {
      const msg = await generateAIMessage(
        `You are Anchor & Flow. Write a warm midday check-in notification (max 140 chars). Be encouraging about progress and gently remind about afternoon. Mention dinner if it's planned. Warm, not pushy.`,
        `${dataCtx} Completed so far: ${doneTasks.length} of ${todayTasks.length} tasks.`,
        `Midday check-in 🌿 ${doneTasks.length>0?`${doneTasks.length} things done — you're moving.`:"Fresh start for the afternoon."} ${todayMeal?`Dinner tonight: ${todayMeal}.`:""}`
      );
      scheduleNotification("🌊 Midday check-in", msg, middayTime);
    }

    // ── 3. MEAL REMINDER — defrost alert (3pm if dinner needs it) ───────────
    const defrostTime = todayAt(15);
    if (defrostTime > now && todayMeal && !["snack plate","freezer burrito","rotisserie","no-cook"].some(s=>todayMeal.toLowerCase().includes(s))) {
      const msg = await generateAIMessage(
        `You are Anchor & Flow. Write a friendly 3pm meal prep reminder (max 120 chars). Mention the specific dinner and suggest one thing to do now (defrost, start slow cooker, etc). Warm tone.`,
        `Dinner tonight: ${todayMeal}. Family: ${familyProfile?.numKids||""} kids.`,
        `🍽️ Dinner reminder — ${todayMeal} tonight. Good time to check if anything needs defrosting!`
      );
      scheduleNotification("🍽️ Dinner heads-up", msg, defrostTime);
    }

    // ── 4. EVENING RECAP — Doubtfire-style (5pm) ────────────────────────────
    const eveningTime = todayAt(17);
    if (eveningTime > now) {
      const msg = await generateAIMessage(
        `You are Anchor & Flow — warm, like a trusted family friend. Write an evening recap notification (max 160 chars). Acknowledge what they did today, gently note what's left, and mention tomorrow. Sound like Mrs. Doubtfire — caring and real.`,
        `${dataCtx} Done today: ${doneTasks.map(t=>t.text).join(", ")||"nothing yet"}. Tomorrow: ${tmrName}${tmrMeal?`, dinner: ${tmrMeal}`:""}. Events tomorrow: ${calEvents.filter(e=>e.date===new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate()+1).toISOString().split("T")[0]).map(e=>e.title).join(", ")||"none"}.`,
        `Good evening 🌙 ${doneTasks.length>0?`${doneTasks.length} things done today — well done.`:"Tomorrow is a fresh start."} ${pendingTasks.length>0?`${pendingTasks.length} things still on your list.`:""} Rest up.`
      );
      scheduleNotification("🌙 Evening recap", msg, eveningTime);
    }

    // ── 5. SMART EVENT NUDGES — 2hrs before each appointment ────────────────
    todayEvts.forEach(async (e) => {
      if (!e.time) return;
      const [h,m] = e.time.split(":").map(Number);
      const eventTime = todayAt(h, m);
      const nudgeTime = new Date(eventTime.getTime() - 2 * 60 * 60 * 1000); // 2hrs before
      if (nudgeTime <= now) return;
      const msg = await generateAIMessage(
        `You are Anchor & Flow. Write a friendly heads-up notification for an upcoming appointment in 2 hours (max 120 chars). Be warm and helpful — suggest one thing to do to prepare.`,
        `Event: ${e.title} at ${e.time}. ${familyCtx}`,
        `⏰ ${e.title} is in 2 hours — time to get ready!`
      );
      scheduleNotification(`⏰ Coming up: ${e.title}`, msg, nudgeTime);
    });
  }

  // ── Legacy alias ─────────────────────────────────────────────────────────────
  const scheduleDailySummary = scheduleAllDailyNotifications;

  // Auto-restore householdId from Supabase if logged in but missing locally
  useEffect(() => {
    if (!authToken || householdId) return;
    (async () => {
      try {
        const user = await sbFetch("/auth/v1/user", { _token: authToken });
        const hid = user?.user_metadata?.householdId;
        if (hid) setHouseholdId(hid);
      } catch {}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    if (notifPermission === "granted") scheduleAllDailyNotifications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifPermission]);

  // Sync household data when key state changes
  useEffect(() => { debouncedSync(); }, [tasks, meals, calEvents, shoppingItems]); // eslint-disable-line

  // ── Share text ──────────────────────────────────────────────────────────────
  function shareText() {
    const todayTasks = tasks.filter(t=>t.day===TODAY_NAME||t.day==="Daily");
    const tm = meals[TODAY_NAME]||{};
    const mealLines = MEALS_TO_SHOW.map(m=>`${m}: ${tm[m]||"—"}`);
    return `⚓️ Anchor & Flow — ${FORMAT_DATE(TODAY)}\nA steadier home, in every season\n\nFlow Mode: ${flowMode} ${fm.emoji}\n\nToday's Tasks:\n${todayTasks.map(t=>`• ${t.text}${t.carried?" ↩":""}`).join("\n")||"No tasks."}\n\nMeals:\n${mealLines.join("\n")}\n\nHave a beautiful day 🌿`;
  }

  // ── Calendar helpers ────────────────────────────────────────────────────────
  function localDateStr(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function calDayFromStr(str){ if(!str)return null; const [y,m,d]=str.split("-").map(Number); return new Date(y,m-1,d); }
  function openAddEvent(prefillDate){ setCalFormInit({title:"",date:prefillDate||"",time:"",color:"#6A9BB5",colorLabel:"Blue",colorCustom:"",note:""}); setCalFormMode("add"); setCalFormId(null); }
  function openEditEvent(e){ setCalFormInit({...e,colorCustom:e.colorCustom||""}); setCalFormId(e.id); setCalFormMode("edit"); }
  function closeCalForm(){ setCalFormMode(null); setCalFormId(null); setCalFormInit(null); }

  // ── Recipe import ───────────────────────────────────────────────────────────
  async function importRecipeFromUrl() {
    if (!recipeUrl.trim()) return;
    setRecipeLoading(true); setRecipeError(""); setRecipeResult(null);
    try {
      const r = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        model:"claude-sonnet-4-20250514", max_tokens:800,
        system:`Extract recipe info from a URL. Respond ONLY in JSON: {"name":"","ingredients":[],"servings":"","time":"","notes":"","source":""}. If social media video, set name to "Paste ingredients below" and notes to "Social media video — please paste the ingredient list manually."`,
        messages:[{role:"user",content:`URL: ${recipeUrl.trim()}`}]
      })});
      const d = await r.json();
      const txt = d.content?.find(b=>b.type==="text")?.text||"{}";
      setRecipeResult(JSON.parse(txt.replace(/```json|```/g,"").trim()));
    } catch { setRecipeError("Couldn't parse that URL. Try entering the recipe manually below."); }
    setRecipeLoading(false);
  }

  function saveImportedRecipe() {
    if (recipeResult) {
      setRecipes(p=>[...p,{...recipeResult,id:uid(),savedAt:new Date().toISOString()}]);
      setRecipeResult(null); setRecipeUrl(""); setShowRecipeImport(false);
    }
  }

  function saveManualRecipe() {
    if (!manualRecipe.name.trim()) return;
    const ing = manualRecipe.ingredients.split("\n").filter(Boolean);
    setRecipes(p=>[...p,{...manualRecipe,ingredients:ing,id:uid(),savedAt:new Date().toISOString()}]);
    setManualRecipe({name:"",ingredients:"",servings:"",notes:"",source:""});
    setShowRecipeImport(false);
  }

  // ── Shared UI helpers ───────────────────────────────────────────────────────
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
            <button onClick={onClose} style={{background:T.bgAlt,border:`1px solid ${T.border}`,color:T.textMid,cursor:"pointer",padding:6,display:"flex",borderRadius:"50%"}}><Icon name="close" size={16} color={T.textMid}/></button>
          </div>
          {children}
        </div>
      </div>
    );
  }

  // ── Anchor Check Item — checkable row with fade-out + inline bell ───────────
  function AnchorCheckItem({ id, text, checked, onCheck, color, badge, bell=true, entityTitle }) {
    const [removing, setRemoving] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [nd, setNd] = useState(""); const [nt, setNt] = useState(""); const [nn, setNn] = useState("");
    const hasNotif = notifications.some(n=>n.entityId===id&&!n.fired);

    function handleCheck() {
      setRemoving(true);
      setTimeout(() => onCheck(id), 380);
    }
    return (
      <div style={{
        transition:"all 0.35s ease",
        opacity: removing ? 0 : 1,
        transform: removing ? "translateX(24px)" : "none",
        maxHeight: removing ? 0 : 120,
        overflow: "hidden",
        marginBottom: removing ? 0 : "0.32rem",
      }}>
        <div style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.6rem 0.7rem",background:checked?T.bgAlt:T.white,borderRadius:"0.85rem",border:`1.5px solid ${checked?T.borderSoft:(color||T.blue)+"45"}`,transition:"all 0.2s"}}>
          <div onClick={handleCheck} style={{width:24,height:24,borderRadius:"50%",background:checked?(color||T.blue):"transparent",border:`2.5px solid ${checked?(color||T.blue):(color||T.blue)+"70"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s"}}>
            {checked&&<Icon name="check" size={11} color="#fff"/>}
          </div>
          <span style={{flex:1,fontSize:"0.88rem",fontWeight:checked?400:600,color:checked?T.textFaint:T.textDark,textDecoration:checked?"line-through":"none",lineHeight:1.35}}>{text}</span>
          {badge&&<span style={{fontSize:"0.58rem",background:(color||T.blue)+"18",color:color||T.blue,fontWeight:800,padding:"2px 6px",borderRadius:"1rem",whiteSpace:"nowrap"}}>{badge}</span>}
          {bell&&<button onClick={()=>setNotifOpen(v=>!v)} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex",flexShrink:0,opacity:hasNotif?1:0.4}}>
            <Icon name="bell" size={13} color={hasNotif?T.sand:T.textSoft}/>
          </button>}
        </div>
        {notifOpen&&(
          <div style={{background:T.bgAlt,border:`1px solid ${T.sand}50`,borderRadius:"0.7rem",padding:"0.7rem 0.85rem",marginTop:"0.3rem",marginBottom:"0.3rem"}}>
            <div style={{fontSize:"0.7rem",fontWeight:800,color:T.sandDark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.55rem"}}>🔔 Set Reminder</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.4rem",marginBottom:"0.4rem"}}>
              <input type="date" value={nd} onChange={e=>setNd(e.target.value)} style={inp({padding:"0.32rem 0.5rem",fontSize:"0.77rem"})}/>
              <input type="time" value={nt} onChange={e=>setNt(e.target.value)} style={inp({padding:"0.32rem 0.5rem",fontSize:"0.77rem"})}/>
            </div>
            <input value={nn} onChange={e=>setNn(e.target.value)} placeholder="Note (optional)" style={{...inp({marginBottom:"0.45rem",fontSize:"0.77rem",padding:"0.32rem 0.5rem"})}}/>
            <div style={{display:"flex",gap:"0.35rem"}}>
              <button onClick={()=>{ addNotification(id, entityTitle||text, nd, nt, nn); setNotifOpen(false); }} style={btnP(T.sand,{fontSize:"0.73rem",padding:"0.3rem 0.7rem"})}>Set</button>
              {hasNotif&&<button onClick={()=>{setNotifications(p=>p.filter(n=>n.entityId!==id));setNotifOpen(false);}} style={btnS({fontSize:"0.73rem",padding:"0.3rem 0.6rem",color:T.rose})}>Clear</button>}
              <button onClick={()=>setNotifOpen(false)} style={btnS({fontSize:"0.73rem",padding:"0.3rem 0.6rem"})}>✕</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Task Row ────────────────────────────────────────────────────────────────
  function TaskRow({t, onToggle, onDelete, onSave, accent, showNotifFor, setShowNotifFor}) {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(t.text);
    const [notifDate, setNotifDate] = useState("");
    const [notifTime, setNotifTime] = useState("");
    const [notifNote, setNotifNote] = useState("");
    const hasNotif = notifications.some(n=>n.entityId===t.id&&!n.fired);
    const isShowingNotif = showNotifFor===t.id;
    return (
      <div style={{borderBottom:`1px solid ${T.borderSoft}`}}>
        {editing ? (
          <div style={{display:"flex",gap:"0.5rem",padding:"0.45rem 0",alignItems:"center"}}>
            <input value={editVal} onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){onSave(t.id,editVal);setEditing(false);}if(e.key==="Escape")setEditing(false);}}
              style={{...inp({flex:1,padding:"0.4rem 0.65rem",fontSize:"0.85rem"})}} autoFocus/>
            <button onClick={()=>{onSave(t.id,editVal);setEditing(false);}} style={btnP(T.sage,{padding:"0.4rem 0.7rem",fontSize:"0.78rem"})}>Save</button>
            <button onClick={()=>setEditing(false)} style={btnS({padding:"0.4rem 0.7rem",fontSize:"0.78rem"})}>Cancel</button>
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.55rem 0"}}>
              <div style={{cursor:"grab",display:"flex",flexShrink:0,opacity:0.35}}><Icon name="drag" size={14} color={T.textSoft}/></div>
              <button onClick={()=>onToggle(t.id)} style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${t.done?(accent||T.sage):T.border}`,background:t.done?(accent||T.sage):"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                {t.done&&<Icon name="check" size={12} color="#fff"/>}
              </button>
              <span style={{flex:1,fontSize:"0.87rem",color:t.done?T.textFaint:T.textDark,textDecoration:t.done?"line-through":"none",fontWeight:t.done?400:600}}>
                {t.carried&&<span style={{fontSize:"0.64rem",color:T.sand,fontWeight:700,marginRight:"0.3rem"}}>↩</span>}
                {t.text}
              </span>
              {t.person&&<Pill label={t.person} color={people.find(p=>p.name===t.person)?.color||T.textSoft} tiny/>}
              {hasNotif&&<span style={{fontSize:"0.7rem"}}>🔔</span>}
              <button onClick={()=>setShowNotifFor(isShowingNotif?null:t.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex",opacity:0.5}}><Icon name="bell" size={13} color={hasNotif?T.sand:T.textSoft}/></button>
              <button onClick={()=>{setEditVal(t.text);setEditing(true);}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="edit" size={13} color={T.textSoft}/></button>
              <button onClick={()=>onDelete(t.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.textFaint}/></button>
            </div>
            {isShowingNotif&&(
              <div style={{background:T.bgAlt,border:`1px solid ${T.sand}50`,borderRadius:"0.7rem",padding:"0.75rem",marginBottom:"0.5rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.6rem"}}>
                  <Icon name="bell" size={13} color={T.sand}/>
                  <span style={{fontSize:"0.72rem",fontWeight:800,color:T.sandDark,textTransform:"uppercase",letterSpacing:"0.06em"}}>Set Reminder</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.45rem",marginBottom:"0.45rem"}}>
                  <input type="date" value={notifDate} onChange={e=>setNotifDate(e.target.value)} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
                  <input type="time" value={notifTime} onChange={e=>setNotifTime(e.target.value)} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
                </div>
                <input value={notifNote} onChange={e=>setNotifNote(e.target.value)} placeholder="Optional note…" style={{...inp({marginBottom:"0.5rem",fontSize:"0.79rem",padding:"0.35rem 0.5rem"})}}/>
                <div style={{display:"flex",gap:"0.4rem"}}>
                  <button onClick={()=>{addNotification(t.id,t.text,notifDate,notifTime,notifNote);setShowNotifFor(null);}} style={btnP(T.sand,{fontSize:"0.76rem",padding:"0.35rem 0.75rem"})}>Set Reminder</button>
                  {hasNotif&&<button onClick={()=>{setNotifications(p=>p.filter(n=>n.entityId!==t.id));setShowNotifFor(null);}} style={btnS({fontSize:"0.76rem",padding:"0.35rem 0.65rem",color:T.rose})}>Clear</button>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function DraggableTaskList({tasks:localTasks, setTasks:setAllTasks, accent}) {
    const dragItem = useRef(null), dragOver = useRef(null);
    const [showNotifFor, setShowNotifFor] = useState(null);
    function onDragStart(e,idx){ dragItem.current=idx; e.dataTransfer.effectAllowed="move"; e.currentTarget.style.opacity="0.5"; }
    function onDragEnter(idx){ dragOver.current=idx; }
    function onDragEnd(e){
      e.currentTarget.style.opacity="1";
      if(dragItem.current===null||dragOver.current===null||dragItem.current===dragOver.current){dragItem.current=null;dragOver.current=null;return;}
      const ids=localTasks.map(t=>t.id);
      const newIds=[...ids]; const [moved]=newIds.splice(dragItem.current,1); newIds.splice(dragOver.current,0,moved);
      setAllTasks(prev=>{ const others=prev.filter(t=>!ids.includes(t.id)); const reordered=newIds.map(id=>prev.find(t=>t.id===id)); return [...others,...reordered]; });
      dragItem.current=null; dragOver.current=null;
    }
    return (
      <>
        {localTasks.map((t,idx) => (
          <div key={t.id} draggable onDragStart={e=>onDragStart(e,idx)} onDragEnter={()=>onDragEnter(idx)} onDragEnd={onDragEnd} onDragOver={e=>e.preventDefault()} style={{cursor:"grab"}}>
            <TaskRow t={t} accent={accent} showNotifFor={showNotifFor} setShowNotifFor={setShowNotifFor}
              onToggle={id=>setAllTasks(p=>p.map(x=>x.id===id?{...x,done:!x.done}:x))}
              onDelete={id=>setAllTasks(p=>p.filter(x=>x.id!==id))}
              onSave={(id,val)=>setAllTasks(p=>p.map(x=>x.id===id?{...x,text:val}:x))}
            />
          </div>
        ))}
      </>
    );
  }

  // ── Shop Item Row with Photo ────────────────────────────────────────────────
  function ShopItemRow({item, onToggle, onDelete, onSave}) {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(item.text);
    const [showPhoto, setShowPhoto] = useState(false);
    return (
      <div style={{borderBottom:`1px solid ${T.borderSoft}`}}>
        {editing ? (
          <div style={{display:"flex",gap:"0.5rem",padding:"0.4rem 0",alignItems:"center"}}>
            <input value={editVal} onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){onSave(item.id,editVal);setEditing(false);}if(e.key==="Escape")setEditing(false);}}
              style={{...inp({flex:1,padding:"0.38rem 0.6rem",fontSize:"0.84rem"})}} autoFocus/>
            <button onClick={()=>{onSave(item.id,editVal);setEditing(false);}} style={btnP(T.sage,{padding:"0.38rem 0.65rem",fontSize:"0.76rem"})}>Save</button>
            <button onClick={()=>setEditing(false)} style={btnS({padding:"0.38rem 0.65rem",fontSize:"0.76rem"})}>✕</button>
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.44rem 0"}}>
              <button onClick={()=>onToggle(item.id)} style={{width:18,height:18,borderRadius:"0.3rem",border:`2px solid ${item.done?T.sage:T.border}`,background:item.done?T.sage:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                {item.done&&<Icon name="check" size={10} color="#fff"/>}
              </button>
              {item.photo&&(
                <button onClick={()=>setShowPhoto(v=>!v)} style={{width:28,height:28,borderRadius:"0.35rem",overflow:"hidden",border:`2px solid ${T.sage}50`,flexShrink:0,padding:0,cursor:"pointer",background:"none"}}>
                  <img src={item.photo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                </button>
              )}
              <span style={{flex:1,fontSize:"0.85rem",color:item.done?T.textFaint:T.textDark,textDecoration:item.done?"line-through":"none",fontWeight:item.done?400:600}}>
                {item.text}
                {item.photo&&<span style={{fontSize:"0.62rem",color:T.sage,fontWeight:700,marginLeft:"0.4rem"}}>📷</span>}
              </span>
              <button onClick={()=>{setEditVal(item.text);setEditing(true);}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="edit" size={12} color={T.textSoft}/></button>
              <button onClick={()=>onDelete(item.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={12} color={T.textFaint}/></button>
            </div>
            {showPhoto&&item.photo&&(
              <div style={{paddingBottom:"0.6rem"}}>
                <img src={item.photo} alt={item.text} style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:"0.65rem",border:`2px solid ${T.sage}40`}}/>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Brain Item Row ──────────────────────────────────────────────────────────
  function BrainItemRow({item, color, onToggle, onDelete, onSave, onMove, bDragStart, bDragEnter, bDragEnd}) {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(item.text);
    const [moveTo, setMoveTo] = useState(false);
    return (
      <div draggable onDragStart={e=>bDragStart(e,item.id,item.bucket)} onDragEnter={()=>bDragEnter(item.id)} onDragEnd={bDragEnd} onDragOver={e=>e.preventDefault()}
        style={{...card({borderLeft:`4px solid ${color}`,marginBottom:"0.5rem",padding:"0.88rem 1rem",cursor:"grab"})}}>
        {editing ? (
          <div style={{display:"flex",gap:"0.5rem",alignItems:"center"}}>
            <input value={editVal} onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){onSave(item.id,editVal);setEditing(false);}if(e.key==="Escape")setEditing(false);}}
              style={{...inp({flex:1,padding:"0.4rem 0.65rem",fontSize:"0.85rem"})}} autoFocus/>
            <button onClick={()=>{onSave(item.id,editVal);setEditing(false);}} style={btnP(T.sage,{padding:"0.4rem 0.7rem",fontSize:"0.78rem"})}>Save</button>
            <button onClick={()=>setEditing(false)} style={btnS({padding:"0.4rem 0.7rem",fontSize:"0.78rem"})}>✕</button>
          </div>
        ) : (
          <div style={{display:"flex",alignItems:"flex-start",gap:"0.6rem"}}>
            <div style={{opacity:0.35,flexShrink:0,marginTop:2}}><Icon name="drag" size={13} color={T.textSoft}/></div>
            <button onClick={()=>onToggle(item.id)} style={{width:21,height:21,borderRadius:"50%",border:`2px solid ${item.done?T.sage:T.border}`,background:item.done?T.sage:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,transition:"all 0.15s"}}>
              {item.done&&<Icon name="check" size={12} color="#fff"/>}
            </button>
            <div style={{flex:1}}>
              <span style={{fontSize:"0.87rem",color:item.done?T.textFaint:T.textDark,textDecoration:item.done?"line-through":"none",fontWeight:item.done?400:600,lineHeight:1.5}}>{item.text}</span>
              <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginTop:"0.35rem",flexWrap:"wrap"}}>
                {item.person&&<Pill label={item.person} color={people.find(p=>p.name===item.person)?.color||T.textSoft} tiny/>}
                {moveTo ? (
                  <div style={{display:"flex",gap:"0.3rem",flexWrap:"wrap"}}>
                    {BRAIN_BUCKETS.filter(b=>b.id!==item.bucket).map(b2=>(
                      <button key={b2.id} onClick={()=>{onMove(item.id,b2.id);setMoveTo(false);}} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"2rem",padding:"1px 7px",fontSize:"0.66rem",cursor:"pointer",fontWeight:700,fontFamily:"inherit",color:T.textMid}}>→ {b2.emoji} {b2.label}</button>
                    ))}
                    <button onClick={()=>setMoveTo(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.66rem",color:T.textFaint,fontFamily:"inherit"}}>cancel</button>
                  </div>
                ) : (
                  <button onClick={()=>setMoveTo(true)} style={{background:"none",border:`1px dashed ${T.border}`,borderRadius:"2rem",padding:"1px 7px",fontSize:"0.66rem",cursor:"pointer",fontWeight:700,fontFamily:"inherit",color:T.textSoft}}>move</button>
                )}
              </div>
            </div>
            <div style={{display:"flex",gap:"0.2rem",flexShrink:0}}>
              <button onClick={()=>{setEditVal(item.text);setEditing(true);}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="edit" size={13} color={T.textSoft}/></button>
              <button onClick={()=>onDelete(item.id)} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.textFaint}/></button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── AI Chat Panel ───────────────────────────────────────────────────────────
  function AIChatPanel({onClose}) {
    const unanswered = GTK_QUESTIONS.filter(q => !aiMemory[q]);
    const todayQuestion = useRef(
      unanswered.length > 0 ? unanswered[Math.floor(Math.random() * unanswered.length)] : null
    ).current;

    const profileCtx = familyProfile
      ? `Family: ${familyProfile.parentNames}, ${familyProfile.numKids} kids (ages ${familyProfile.kidAges}), dietary: ${familyProfile.dietaryNeeds}, challenge: ${familyProfile.biggestChallenge}, fav dinner: ${familyProfile.favoriteDinner}.`
      : "";
    const memoryCtx = Object.entries(aiMemory).slice(-8).map(([q,a])=>`Q: ${q} A: ${a}`).join(" | ");
    const appCtx = `Today: ${TODAY_NAME}, flow mode: ${flowMode}, dietary filters: ${dietaryFilters.join(", ")||"none"}.`;

    const openingMsg = todayQuestion
      ? `Hi! ⚓️ Quick question to help me know your family better:\n\n"${todayQuestion}"\n\nNo pressure — answer whenever, or just ask me anything!`
      : `Hi! ⚓️ ${familyProfile?`Good to see you, ${familyProfile.parentNames?.split(" ")[0]||"friend"}!`:""} What can I help with today?`;

    const [messages, setMessages] = useState([{role:"assistant",text:openingMsg}]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [awaitingGTK, setAwaitingGTK] = useState(!!todayQuestion);
    const bottomRef = useRef(null);
    useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

    const SUGGESTED = familyProfile
      ? ["What should I make tonight?","Help me plan this week","Quick grocery list","Tips for calmer mornings"]
      : ["What should I make for dinner?","Help me plan this week","Tips for a smoother morning","Quick grocery list"];

    async function send(text) {
      const q = text||input.trim(); if(!q||loading) return;
      setInput("");
      const msgs = [...messages,{role:"user",text:q}];
      setMessages(msgs);
      setLoading(true);
      if (awaitingGTK && todayQuestion) {
        setAiMemory(p=>({...p,[todayQuestion]:q}));
        setAwaitingGTK(false);
      }
      try {
        const r = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          system:`You are Anchor & Flow's warm, practical home management assistant. Be concise and encouraging. Use what you know about this family to personalise responses.\n${profileCtx}\n${memoryCtx?`What I know from past chats: ${memoryCtx}`:""}\n${appCtx}`,
          messages:msgs.map(m=>({role:m.role,content:m.text}))
        })});
        const d = await r.json();
        setMessages(prev=>[...prev,{role:"assistant",text:d.content?.find(b=>b.type==="text")?.text||"Sorry, try again."}]);
      } catch { setMessages(prev=>[...prev,{role:"assistant",text:"Something went wrong. Please try again."}]); }
      setLoading(false);
    }

    return (
      <div style={{position:"fixed",bottom:"5.5rem",right:"1rem",width:"min(390px,calc(100vw - 2rem))",height:530,background:T.surface,border:`2px solid ${T.blue}70`,borderRadius:"1.4rem",boxShadow:`0 24px 80px ${T.cardShadow}`,zIndex:500,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${T.blue},${T.blueDark})`,padding:"1rem 1.1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.65rem"}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid rgba(255,255,255,0.35)"}}>
              <AnchorLogo size={24} color="#fff"/>
            </div>
            <div>
              <div style={{color:"#fff",fontWeight:700,fontSize:"0.97rem",fontFamily:"'Cormorant Garamond',serif"}}>Anchor & Flow AI</div>
              <div style={{color:"rgba(255,255,255,0.75)",fontSize:"0.69rem",fontWeight:500}}>
                {Object.keys(aiMemory).length>0?`Remembers ${Object.keys(aiMemory).length} things about you`:"Getting to know your family"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",cursor:"pointer",borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="close" size={14} color="#fff"/></button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"1rem",display:"flex",flexDirection:"column",gap:"0.7rem",background:T.bgAlt}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"86%",padding:"0.68rem 0.95rem",borderRadius:m.role==="user"?"1rem 1rem 0.25rem 1rem":"1rem 1rem 1rem 0.25rem",background:m.role==="user"?T.blue:T.surface,color:m.role==="user"?"#fff":T.textDark,fontSize:"0.84rem",lineHeight:1.58,whiteSpace:"pre-wrap",border:m.role==="assistant"?`1px solid ${T.borderSoft}`:"none",fontWeight:m.role==="user"?600:400}}>{m.text}</div>
            </div>
          ))}
          {loading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{padding:"0.68rem 0.95rem",borderRadius:"1rem 1rem 1rem 0.25rem",background:T.surface,border:`1px solid ${T.borderSoft}`}}><div style={{display:"flex",gap:"5px"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.blueLight,animation:`bounce 1.2s ${i*0.2}s infinite ease-in-out`}}/>)}</div></div></div>}
          <div ref={bottomRef}/>
        </div>
        {messages.length===1&&!awaitingGTK&&(
          <div style={{padding:"0.6rem 0.75rem 0.3rem",background:T.bgAlt,display:"flex",flexWrap:"wrap",gap:"0.4rem"}}>
            {SUGGESTED.map((s,i)=><button key={i} onClick={()=>send(s)} style={{background:T.bluePale,border:`1.5px solid ${T.blueLight}`,color:T.blueDark,borderRadius:"2rem",padding:"0.33rem 0.78rem",fontSize:"0.73rem",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{s}</button>)}
          </div>
        )}
        <div style={{padding:"0.75rem",borderTop:`1.5px solid ${T.borderSoft}`,display:"flex",gap:"0.5rem",alignItems:"flex-end",background:T.surface}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder={awaitingGTK?"Type your answer…":"Ask anything about your home…"} rows={1} style={{...inp({resize:"none",flex:1,lineHeight:1.5,maxHeight:80,overflowY:"auto"})}}/>
          <button onClick={()=>send()} disabled={!input.trim()||loading} style={{...btnP(T.blue,{padding:"0.56rem 0.75rem",borderRadius:"0.7rem",flexShrink:0,opacity:!input.trim()||loading?0.4:1,display:"flex",alignItems:"center",justifyContent:"center"})}}>
            <Icon name="send" size={16} color="#fff"/>
          </button>
        </div>
      </div>
    );
  }

  // ── Today Snapshot ──────────────────────────────────────────────────────────
  function TodaySnapshot() {
    const todayEvents = calEvents.filter(e=>{
      if(!e.date)return false;
      const [y,m,d]=e.date.split("-").map(Number);
      return d===TODAY.getDate()&&(m-1)===TODAY.getMonth()&&y===TODAY.getFullYear();
    }).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
    const nowStr = new Date().getHours().toString().padStart(2,"0")+":"+new Date().getMinutes().toString().padStart(2,"0");
    const upcoming = todayEvents.filter(e=>!e.time||e.time>=nowStr);
    const past = todayEvents.filter(e=>e.time&&e.time<nowStr);
    return (
      <div style={{...card({background:`linear-gradient(135deg,${T.bluePale},${T.surface})`,border:`2px solid ${T.blue}50`,padding:"1rem 1.15rem"})}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:todayEvents.length?"0.85rem":"0"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
            <Icon name="cal" size={16} color={T.blueDark}/>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Today</span>
            <span style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500}}>{TODAY.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</span>
          </div>
          <button onClick={()=>setTab("calendar")} style={{...btnP(T.blue,{fontSize:"0.72rem",padding:"0.26rem 0.65rem"})}}>Calendar</button>
        </div>
        {!todayEvents.length&&<p style={{color:T.textFaint,fontSize:"0.82rem",fontWeight:600,textAlign:"center",padding:"0.4rem 0"}}>No events today — open space 🌿</p>}
        {upcoming.map(e=>(
          <div key={e.id} style={{display:"flex",alignItems:"center",gap:"0.7rem",padding:"0.5rem 0.65rem",background:T.white,borderRadius:"0.7rem",border:`1.5px solid ${e.color}40`,borderLeft:`4px solid ${e.color}`,marginBottom:"0.35rem"}}>
            <span style={{fontSize:"0.74rem",fontWeight:800,color:e.color,minWidth:36}}>{e.time||"all day"}</span>
            <span style={{flex:1,fontSize:"0.85rem",color:T.textDark,fontWeight:700}}>{e.title}</span>
            {notifications.some(n=>n.entityId===e.id)&&<span style={{fontSize:"0.75rem"}}>🔔</span>}
          </div>
        ))}
        {past.length>0&&<div style={{marginTop:"0.5rem",paddingTop:"0.5rem",borderTop:`1px dashed ${T.borderSoft}`}}>{past.map(e=>(
          <div key={e.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.22rem 0",opacity:0.5}}>
            <span style={{fontSize:"0.72rem",fontWeight:700,color:T.textSoft,minWidth:36}}>{e.time}</span>
            <div style={{width:6,height:6,borderRadius:"50%",background:e.color}}/>
            <span style={{fontSize:"0.8rem",color:T.textMid,fontWeight:500,textDecoration:"line-through"}}>{e.title}</span>
          </div>
        ))}</div>}
      </div>
    );
  }

  // ── Onboarding Wizard ───────────────────────────────────────────────────────
  function OnboardingWizard({onComplete}) {
    const [step,setStep] = useState(0);
    const [d,setD] = useState({name:"",partner:"",numKids:"",kidAges:"",kidNames:"",dietary:"",challenge:"",cal:false,m1name:"",m1time:"20",m1tags:"",m2name:"",m2time:"20",g1:"",g2:"",brain:""});
    const set = (k,v) => setD(p=>({...p,[k]:v}));
    const steps = ["welcome","family","kids","dietary","calendar","meal1","meal2","grocery","brain","done"];
    const prog  = step/(steps.length-1);
    function finish() {
      if(d.name) setFamilyProfile({parentNames:d.name+(d.partner?" & "+d.partner:""),numKids:d.numKids,kidAges:d.kidAges,kidNames:d.kidNames,dietaryNeeds:d.dietary,biggestChallenge:d.challenge,favoriteDinner:d.m1name,cookingStyle:""});
      if(d.m1name) setFavMeals(p=>[...p,{id:uid(),name:d.m1name,time:d.m1time,tags:d.m1tags}]);
      if(d.m2name) setFavMeals(p=>[...p,{id:uid(),name:d.m2name,time:d.m2time,tags:""}]);
      if(d.g1.trim()) setShoppingItems(p=>[...p,{id:uid(),text:d.g1.trim(),done:false,store:"Grocery Store"}]);
      if(d.g2.trim()) setShoppingItems(p=>[...p,{id:uid(),text:d.g2.trim(),done:false,store:"Grocery Store"}]);
      if(d.brain.trim()) { const lines=d.brain.split("\n").filter(Boolean); setBrainItems(p=>[...p,...lines.map(text=>({id:uid(),text:text.trim(),bucket:"later",done:false,person:""}))]); }
      if(d.dietary) setDietaryFilters([d.dietary.split(",")[0].trim()]);
      setOnboardingComplete(true);
      onComplete();
    }
    const s = steps[step];
    const ProgBar = () => <div style={{height:3,background:T.border,borderRadius:2,marginBottom:"1.4rem",overflow:"hidden"}}><div style={{height:"100%",width:(prog*100)+"%",background:"linear-gradient(90deg,"+T.sage+","+T.blue+")",transition:"width 0.4s"}}/></div>;
    const Btns = ({canNext=true,nextLabel="Next →",onNext,skipLabel}) => (
      <div style={{display:"flex",gap:"0.5rem",marginTop:"1.4rem",paddingTop:"0.9rem",borderTop:"1px solid "+T.borderSoft}}>
        {step>0&&<button onClick={()=>setStep(s=>s-1)} style={btnS({padding:"0.6rem 1rem",fontSize:"0.82rem"})}>← Back</button>}
        <div style={{flex:1}}/>
        {skipLabel&&<button onClick={()=>setStep(s=>s+1)} style={{background:"none",border:"none",cursor:"pointer",color:T.textFaint,fontSize:"0.8rem",padding:"0.6rem 0.9rem",fontFamily:"inherit"}}>{skipLabel}</button>}
        <button onClick={onNext||(()=>setStep(s=>s+1))} disabled={!canNext} style={{...btnP(T.sage,{padding:"0.65rem 1.3rem",fontSize:"0.88rem",borderRadius:"0.8rem",opacity:canNext?1:0.4,cursor:canNext?"pointer":"not-allowed"})}}>
          {nextLabel}
        </button>
      </div>
    );
    return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(16px)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1.6rem",padding:"2rem 1.8rem",width:"100%",maxWidth:460,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 40px 120px "+T.cardShadow}}>
          <ProgBar/>
          {s==="welcome"&&(<div>
            <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>⚓️</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.5rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>Welcome to Anchor & Flow</div>
            <div style={{color:T.textSoft,fontSize:"0.85rem",lineHeight:1.7,marginBottom:"1rem"}}>Let's set up your home in about 2 minutes.<br/>You can always update this later.</div>
            <div style={{background:"linear-gradient(135deg,"+T.sagePale+","+T.bluePale+")",borderRadius:"0.9rem",padding:"0.9rem 1rem",fontSize:"0.82rem",color:T.textMid,lineHeight:1.8}}>
              👨‍👩‍👧 Your family &nbsp;·&nbsp; 📆 Calendar &nbsp;·&nbsp; 🍽️ Favorite meals &nbsp;·&nbsp; 🛒 Grocery &nbsp;·&nbsp; 🧠 Brain dump
            </div>
            <Btns nextLabel="Let's go →"/>
          </div>)}
          {s==="family"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>👨‍👩‍👧 Your family</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>This helps personalise everything — from meal suggestions to daily rhythms.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div><label style={lbl}>Your name</label><input value={d.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Lindsey" style={inp()} autoFocus/></div>
              <div><label style={lbl}>Partner's name (optional)</label><input value={d.partner} onChange={e=>set("partner",e.target.value)} placeholder="e.g. Jake" style={inp()}/></div>
              <div><label style={lbl}>Biggest home management challenge</label>
                <select value={d.challenge} onChange={e=>set("challenge",e.target.value)} style={inp()}>
                  <option value="">Choose one…</option>
                  {["Keeping up with meals","Feeling behind on tasks","Managing everyone's schedules","Staying consistent","All of the above"].map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <Btns canNext={!!d.name} skipLabel="Skip"/>
          </div>)}
          {s==="kids"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🧒 The little ones</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>Ages help me suggest age-appropriate rhythms and meal ideas.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div><label style={lbl}>How many kids?</label>
                <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                  {["1","2","3","4","5+"].map(n=><button key={n} onClick={()=>set("numKids",n)} style={{background:d.numKids===n?T.blue:T.white,color:d.numKids===n?"#fff":T.textMid,border:"1.5px solid "+(d.numKids===n?T.blue:T.border),borderRadius:"0.6rem",padding:"0.5rem 1rem",cursor:"pointer",fontSize:"0.9rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{n}</button>)}
                </div>
              </div>
              <div><label style={lbl}>Their ages</label><input value={d.kidAges} onChange={e=>set("kidAges",e.target.value)} placeholder="e.g. 7, 4, infant" style={inp()}/></div>
              <div><label style={lbl}>Names (optional)</label><input value={d.kidNames} onChange={e=>set("kidNames",e.target.value)} placeholder="e.g. Emma, Liam, baby Mia" style={inp()}/></div>
            </div>
            <Btns skipLabel="Skip"/>
          </div>)}
          {s==="dietary"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🥗 Dietary needs</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>I'll filter meal suggestions and flag ingredients automatically.</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",marginBottom:"0.75rem"}}>
              {["Dairy-free","Gluten-free","Nut-free","Vegetarian","Vegan","No restrictions"].map(x=><button key={x} onClick={()=>set("dietary",d.dietary===x?"":x)} style={{background:d.dietary===x?T.sage:T.white,color:d.dietary===x?"#fff":T.textMid,border:"1.5px solid "+(d.dietary===x?T.sage:T.border),borderRadius:"2rem",padding:"0.38rem 0.85rem",cursor:"pointer",fontSize:"0.82rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{x}</button>)}
            </div>
            <div><label style={lbl}>Other (type it in)</label><input value={d.dietary.includes("-")||["Dairy-free","Gluten-free","Nut-free","Vegetarian","Vegan","No restrictions"].includes(d.dietary)?"":d.dietary} onChange={e=>set("dietary",e.target.value)} placeholder="e.g. Egg-free" style={inp()}/></div>
            <Btns skipLabel="Skip"/>
          </div>)}
          {s==="calendar"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>📆 Connect your calendar</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>I'll pull in your events every morning so nothing sneaks up on you.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
              {CAL_SOURCES.map(cs=>{
                const conn=connectedCals.includes(cs.id);
                return <div key={cs.id} onClick={()=>setConnectedCals(p=>p.includes(cs.id)?p.filter(x=>x!==cs.id):[...p,cs.id])} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.75rem 0.9rem",background:conn?cs.color+"12":T.bgAlt,border:"1.5px solid "+(conn?cs.color:T.border),borderRadius:"0.85rem",cursor:"pointer",transition:"all 0.15s"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:cs.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.9rem",flexShrink:0}}>{cs.id==="google"?<Icon name="google" size={16}/>:cs.icon}</div>
                  <div style={{flex:1,fontWeight:700,color:T.textDark,fontSize:"0.86rem"}}>{cs.label}</div>
                  <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+(conn?cs.color:T.border),background:conn?cs.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>{conn&&<Icon name="check" size={9} color="#fff"/>}</div>
                </div>;
              })}
            </div>
            <Btns skipLabel="Skip for now"/>
          </div>)}
          {s==="meal1"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🍽️ A meal your family loves</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>I'll suggest it when planning your week.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div><label style={lbl}>Meal name</label><input value={d.m1name} onChange={e=>set("m1name",e.target.value)} placeholder="e.g. Sheet Pan Chicken Fajitas" style={inp()} autoFocus/></div>
              <div><label style={lbl}>Cook time</label>
                <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                  {["10","15","20","30","45","60+"].map(t=><button key={t} onClick={()=>set("m1time",t)} style={{background:d.m1time===t?T.blue:T.white,color:d.m1time===t?"#fff":T.textMid,border:"1.5px solid "+(d.m1time===t?T.blue:T.border),borderRadius:"0.6rem",padding:"0.38rem 0.8rem",cursor:"pointer",fontSize:"0.82rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{t} min</button>)}
                </div>
              </div>
              <div><label style={lbl}>Tags (optional)</label><input value={d.m1tags} onChange={e=>set("m1tags",e.target.value)} placeholder="e.g. kid-friendly, dairy-free" style={inp()}/></div>
            </div>
            <Btns canNext={!!d.m1name} skipLabel="Skip meals"/>
          </div>)}
          {s==="meal2"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🍳 One more favourite?</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>Optional — the more I know the better I can plan.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div><label style={lbl}>Meal name</label><input value={d.m2name} onChange={e=>set("m2name",e.target.value)} placeholder="e.g. One-Pot Spaghetti" style={inp()} autoFocus/></div>
              <div><label style={lbl}>Cook time</label>
                <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                  {["10","15","20","30","45","60+"].map(t=><button key={t} onClick={()=>set("m2time",t)} style={{background:d.m2time===t?T.blue:T.white,color:d.m2time===t?"#fff":T.textMid,border:"1.5px solid "+(d.m2time===t?T.blue:T.border),borderRadius:"0.6rem",padding:"0.38rem 0.8rem",cursor:"pointer",fontSize:"0.82rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{t} min</button>)}
                </div>
              </div>
            </div>
            <Btns skipLabel="Skip"/>
          </div>)}
          {s==="grocery"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🛒 Anything you need?</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>I'll add it to your shopping list right now.</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div><label style={lbl}>Item 1</label><input value={d.g1} onChange={e=>set("g1",e.target.value)} placeholder="e.g. Milk" style={inp()} autoFocus/></div>
              <div><label style={lbl}>Item 2</label><input value={d.g2} onChange={e=>set("g2",e.target.value)} placeholder="e.g. Chicken thighs" style={inp()}/></div>
            </div>
            <Btns skipLabel="Skip"/>
          </div>)}
          {s==="brain"&&(<div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>🧠 What's on your mind?</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>Dump it all here. Tasks, worries, ideas — we'll sort it later.</div>
            <textarea value={d.brain} onChange={e=>set("brain",e.target.value)} placeholder={"Call doctor\nPick up dry cleaning\nEmail teacher…"} rows={5} style={{...inp({resize:"none",fontSize:"0.88rem",lineHeight:1.65})}}/>
            <Btns skipLabel="Skip"/>
          </div>)}
          {s==="done"&&(<div>
            <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>🌿</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.5rem",fontWeight:700,color:T.textDark,marginBottom:"0.3rem"}}>You're all set{d.name?", "+d.name.split(" ")[0]:""}!</div>
            <div style={{color:T.textSoft,fontSize:"0.83rem",marginBottom:"1rem"}}>Your home base is ready. Let's build your first daily anchor.</div>
            <div style={{background:"linear-gradient(135deg,"+T.sagePale+","+T.bluePale+")",borderRadius:"0.9rem",padding:"0.9rem 1rem",fontSize:"0.82rem",color:T.textMid,lineHeight:1.9}}>
              {d.name&&<div>👤 <strong>{d.name}{d.partner?" & "+d.partner:""}</strong></div>}
              {d.numKids&&<div>🧒 {d.numKids} kid{d.numKids!=="1"?"s":""}{d.kidAges?" · "+d.kidAges:""}</div>}
              {d.dietary&&<div>🥗 {d.dietary}</div>}
              {d.m1name&&<div>🍽️ {d.m1name}{d.m2name?" · "+d.m2name:""}</div>}
              {(d.g1||d.g2)&&<div>🛒 {[d.g1,d.g2].filter(Boolean).join(" · ")} added</div>}
              {d.brain&&<div>🧠 Brain dump saved</div>}
            </div>
            <Btns nextLabel="Build my first day →" onNext={finish}/>
          </div>)}
        </div>
      </div>
    );
  }

  // ── Daily Briefing Modal ─────────────────────────────────────────────────────
  function DailyBriefingModal({onClose}) {
    const b = dayBriefing;
    const allT = tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.archived);
    const top3T = allT.filter(t=>t.tier==="top3");
    const next3T= allT.filter(t=>t.tier==="next3");
    const moreT = allT.filter(t=>t.tier==="more");
    function TRow({t,color}) {
      return <div style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.55rem 0.7rem",background:T.white,borderRadius:"0.7rem",marginBottom:"0.28rem",border:"1.5px solid "+color+"28"}}>
        <div onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,done:!x.done}:x))} style={{width:22,height:22,borderRadius:"50%",background:t.done?color:"transparent",border:"2px solid "+color,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.18s"}}>{t.done&&<Icon name="check" size={11} color="#fff"/>}</div>
        <span style={{flex:1,fontSize:"0.86rem",fontWeight:t.done?400:600,color:t.done?T.textFaint:T.textDark,textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
      </div>;
    }
    return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(14px)",zIndex:1500,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.surface,borderRadius:"1.6rem 1.6rem 0 0",border:"1.5px solid "+T.border,padding:"1.5rem 1.4rem 2rem",maxWidth:520,width:"100%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 -12px 80px "+T.cardShadow}}>
          <div style={{width:40,height:4,borderRadius:2,background:T.border,margin:"0 auto 1.1rem"}}/>
          {briefingLoading ? (
            <div style={{textAlign:"center",padding:"2.5rem 1rem"}}>
              <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:"0.9rem"}}>{[0,1,2].map(i=><div key={i} style={{width:10,height:10,borderRadius:"50%",background:T.blue,animation:"bounce 1.2s "+(i*0.2)+"s infinite ease-in-out"}}/>)}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.2rem",color:T.textDark,fontWeight:600}}>Building your day…</div>
              <div style={{color:T.textSoft,fontSize:"0.81rem",marginTop:"0.35rem"}}>Looking at your calendar, meals, and rhythm</div>
            </div>
          ) : b ? (<>
            <div style={{fontSize:"0.6rem",color:T.blueDark,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:800,marginBottom:"0.25rem"}}>{FORMAT_DATE(TODAY)}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.5rem",fontWeight:700,color:T.textDark,marginBottom:"0.28rem"}}>Your Daily Anchor ⚓️</div>
            <div style={{color:T.textMid,fontSize:"0.84rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",marginBottom:"1rem",lineHeight:1.6}}>{b.greeting}</div>
            {b.todayEvts?.length>0&&<div style={{background:T.bluePale,border:"1px solid "+T.blue+"30",borderRadius:"0.85rem",padding:"0.7rem 0.85rem",marginBottom:"0.75rem"}}>
              <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.blueDark,marginBottom:"0.4rem"}}>📆 Today's schedule</div>
              {b.todayEvts.map(e=><div key={e.id} style={{display:"flex",gap:"0.5rem",alignItems:"center",marginBottom:"0.18rem"}}><span style={{fontSize:"0.71rem",fontWeight:800,color:e.color,minWidth:44}}>{e.time||"all day"}</span><span style={{fontSize:"0.83rem",color:T.textDark,fontWeight:600}}>{e.title}</span></div>)}
            </div>}
            {b.prepItems?.length>0&&<div style={{background:T.sandPale,border:"1.5px solid "+T.sand+"45",borderRadius:"0.85rem",padding:"0.7rem 0.85rem",marginBottom:"0.75rem"}}>
              <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.sandDark,marginBottom:"0.35rem"}}>⭐ Meal prep — do today</div>
              {b.prepItems.map((p,i)=><div key={i} style={{fontSize:"0.84rem",color:T.textDark,fontWeight:600,marginBottom:"0.18rem"}}>• {p}</div>)}
            </div>}
            {top3T.length>0&&<div style={{marginBottom:"0.75rem"}}><div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.blue,marginBottom:"0.35rem"}}>⚓️ Anchor — Top 3</div>{top3T.map(t=><TRow key={t.id} t={t} color={T.blue}/>)}</div>}
            {next3T.length>0&&<div style={{marginBottom:"0.75rem"}}><div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.sage,marginBottom:"0.35rem"}}>🌊 Flow — Next 3</div>{next3T.map(t=><TRow key={t.id} t={t} color={T.sage}/>)}</div>}
            {moreT.length>0&&<div style={{marginBottom:"0.75rem"}}><div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.sand,marginBottom:"0.35rem"}}>✨ More — if you can</div>{moreT.map(t=><TRow key={t.id} t={t} color={T.sand}/>)}</div>}
            {(b.todayMealObj?.dinner||b.todayMealObj?.lunch)&&<div style={{background:T.sagePale,border:"1px solid "+T.sage+"30",borderRadius:"0.85rem",padding:"0.7rem 0.85rem",marginBottom:"0.75rem"}}>
              <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.sageDark,marginBottom:"0.35rem"}}>🍽️ Meals today</div>
              {MEALS_TO_SHOW.map(m=>b.todayMealObj[m]&&<div key={m} style={{display:"flex",gap:"0.4rem",marginBottom:"0.18rem"}}><span style={{fontSize:"0.66rem",fontWeight:800,color:T.sageDark,textTransform:"uppercase",minWidth:58,opacity:0.7}}>{m}</span><span style={{fontSize:"0.83rem",color:T.textDark,fontWeight:600}}>{b.todayMealObj[m]}</span></div>)}
            </div>}
            {b.tomorrowNote&&<div style={{background:"linear-gradient(135deg,"+T.lavPale+","+T.bluePale+")",border:"1px solid "+T.lavender+"28",borderRadius:"0.85rem",padding:"0.7rem 0.85rem",marginBottom:"0.75rem"}}>
              <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.lavender,marginBottom:"0.22rem"}}>👁 Tomorrow — {b.tmrName}</div>
              <div style={{fontSize:"0.83rem",color:T.textDark,fontWeight:500,lineHeight:1.55}}>{b.tomorrowNote}</div>
              {b.tmrEvts?.map(e=><div key={e.id} style={{fontSize:"0.77rem",color:T.textMid,marginTop:"0.18rem"}}>· {e.time||"all day"} {e.title}</div>)}
            </div>}
            <div style={{textAlign:"center",padding:"0.2rem 0 0.6rem"}}><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"0.93rem",fontStyle:"italic",color:T.textSoft}}>{b.message}</span></div>
            <button onClick={onClose} style={{...btnP("linear-gradient(135deg,"+T.sage+","+T.blue+")",{width:"100%",padding:"0.9rem",fontSize:"0.95rem",borderRadius:"1rem"})}}>Let's do this ⚓️</button>
          </>) : null}
        </div>
      </div>
    );
  }

  // ── End of Day + Tomorrow Prep ───────────────────────────────────────────────
  function EndOfDayReset() {
    const allT = tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.archived);
    const done  = allT.filter(t=>t.done);
    const undone= allT.filter(t=>!t.done);
    const [step,setStep]   = useState("review");
    const [carry,setCarry] = useState([]);
    const [letGo,setLetGo] = useState([]);
    const [refl,setRefl]   = useState("");
    const [rLoad,setRLoad] = useState(false);
    const tmrName = (()=>{ const d=new Date(TODAY); d.setDate(d.getDate()+1); return DAY_NAMES[d.getDay()]; })();
    const tmrEvts = calEvents.filter(e=>{ if(!e.date)return false; const ed=new Date(e.date+"T00:00:00"); const d=new Date(TODAY); d.setDate(d.getDate()+1); return ed.getDate()===d.getDate()&&ed.getMonth()===d.getMonth()&&ed.getFullYear()===d.getFullYear(); });
    const tmrRhythm= rhythm[tmrName]||{};
    const tmrMeal  = meals[tmrName]||{};
    const [prepNote,setPrepNote] = useState("");

    async function finish() {
      if(letGo.length) setTasks(p=>p.map(t=>letGo.includes(t.id)?{...t,archived:true}:t));
      if(carry.length) setTasks(p=>p.map(t=>carry.includes(t.id)?{...t,carried:true,carriedTo:tmrName}:t));
      if(prepNote.trim()) setTasks(p=>[...p,{id:uid(),text:prepNote.trim(),day:tmrName,done:false,person:"",order:99}]);
      setStep("close"); setRLoad(true);
      try {
        const res = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:100,system:"You are Anchor & Flow. Write one warm personal closing reflection, 1-2 sentences max. Be specific to their data. Make them feel seen. No lists.",messages:[{role:"user",content:"Completed: "+(done.map(t=>t.text).join(", ")||"nothing")+". Let go: "+letGo.length+". Carried: "+carry.length+". Flow mode: "+flowMode+"."}]})});
        const dat = await res.json();
        setRefl(dat.content?.find(b=>b.type==="text")?.text||"You showed up today. That's what matters most.");
      } catch { setRefl("You showed up today. That's more than enough."); }
      setRLoad(false);
    }

    if(step==="close") return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(12px)",zIndex:1500,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
        <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1.8rem",padding:"2rem",maxWidth:400,width:"100%",textAlign:"center",boxShadow:"0 32px 100px "+T.cardShadow}}>
          <div style={{fontSize:"2.5rem",marginBottom:"0.6rem"}}>🌙</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.9rem",fontWeight:700,color:T.textDark,marginBottom:"0.5rem"}}>You made it.</div>
          {done.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:"0.3rem",justifyContent:"center",marginBottom:"0.75rem"}}>{done.map(t=><span key={t.id} style={{background:T.sagePale,color:T.sageDark,borderRadius:"2rem",padding:"0.22rem 0.7rem",fontSize:"0.73rem",fontWeight:600,border:"1px solid "+T.sage+"35"}}>✓ {t.text}</span>)}</div>}
          <div style={{background:"linear-gradient(135deg,"+T.bluePale+","+T.sagePale+")",borderRadius:"0.9rem",padding:"0.9rem 1rem",marginBottom:"1.1rem",minHeight:"2.8rem",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {rLoad?<div style={{display:"flex",gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.blue,animation:"bounce 1.2s "+(i*0.2)+"s infinite ease-in-out"}}/>)}</div>:<p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1rem",fontStyle:"italic",color:T.textDark,lineHeight:1.6,margin:0}}>{refl}</p>}
          </div>
          <div style={{color:T.textSoft,fontSize:"0.77rem",marginBottom:"1.1rem"}}>You did enough today.</div>
          <button onClick={()=>setShowEndOfDay(false)} style={{...btnP(T.sage,{width:"100%",padding:"0.85rem",fontSize:"0.92rem",borderRadius:"1rem"})}}>Close my day ✓</button>
        </div>
      </div>
    );

    return (
      <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(10px)",zIndex:1500,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div style={{background:T.surface,borderRadius:"1.4rem 1.4rem 0 0",border:"1.5px solid "+T.border,padding:"1.5rem 1.4rem 2rem",maxWidth:520,width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 -8px 60px "+T.cardShadow}}>
          <div style={{width:40,height:4,borderRadius:2,background:T.border,margin:"0 auto 1rem"}}/>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.45rem",fontWeight:700,color:T.textDark,marginBottom:"0.2rem"}}>Close your day</div>
          <div style={{color:T.textSoft,fontSize:"0.8rem",marginBottom:"1rem"}}>No judgment. Just a simple close.</div>
          {/* Tomorrow preview */}
          <div style={{background:"linear-gradient(135deg,"+T.lavPale+","+T.bluePale+")",border:"1px solid "+T.lavender+"28",borderRadius:"0.85rem",padding:"0.75rem 0.9rem",marginBottom:"0.85rem"}}>
            <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.lavender,marginBottom:"0.35rem"}}>👁 {tmrName} at a glance</div>
            {tmrRhythm.theme&&<div style={{fontSize:"0.82rem",color:T.textDark,marginBottom:"0.15rem"}}>📋 {tmrRhythm.theme} — {tmrRhythm.desc}</div>}
            {tmrMeal.dinner&&<div style={{fontSize:"0.82rem",color:T.textDark,marginBottom:"0.15rem"}}>🍽️ Dinner: {tmrMeal.dinner}</div>}
            {tmrEvts.map(e=><div key={e.id} style={{fontSize:"0.82rem",color:T.textDark,marginBottom:"0.15rem"}}>📆 {e.time||"all day"} — {e.title}</div>)}
            {!tmrRhythm.theme&&!tmrMeal.dinner&&tmrEvts.length===0&&<div style={{fontSize:"0.8rem",color:T.textFaint,fontStyle:"italic"}}>Nothing planned yet — clean slate.</div>}
          </div>
          {done.length>0&&<div style={{marginBottom:"0.8rem"}}><div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.sage,marginBottom:"0.35rem"}}>✓ Completed ({done.length})</div>{done.map(t=><div key={t.id} style={{display:"flex",alignItems:"center",gap:"0.45rem",padding:"0.45rem 0.65rem",background:T.sagePale,borderRadius:"0.65rem",marginBottom:"0.25rem"}}><div style={{width:14,height:14,borderRadius:"50%",background:T.sage,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="check" size={8} color="#fff"/></div><span style={{fontSize:"0.82rem",color:T.textDark,textDecoration:"line-through",opacity:0.65}}>{t.text}</span></div>)}</div>}
          {undone.length>0&&<div style={{marginBottom:"0.85rem"}}><div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.textSoft,marginBottom:"0.35rem"}}>Didn't get to ({undone.length})</div>
            {undone.map(t=><div key={t.id} style={{padding:"0.55rem 0.75rem",background:T.bgAlt,borderRadius:"0.75rem",marginBottom:"0.3rem",border:"1px solid "+T.borderSoft}}>
              <div style={{fontSize:"0.85rem",color:T.textDark,fontWeight:600,marginBottom:"0.38rem"}}>{t.text}</div>
              <div style={{display:"flex",gap:"0.35rem"}}>
                <button onClick={()=>{setCarry(p=>p.includes(t.id)?p.filter(x=>x!==t.id):[...p,t.id]);setLetGo(p=>p.filter(x=>x!==t.id));}} style={{flex:1,background:carry.includes(t.id)?T.sand:"transparent",color:carry.includes(t.id)?"#fff":T.textMid,border:"1.5px solid "+(carry.includes(t.id)?T.sand:T.border),borderRadius:"0.5rem",padding:"0.3rem",fontSize:"0.72rem",cursor:"pointer",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>↩ {tmrName}</button>
                <button onClick={()=>{setLetGo(p=>p.includes(t.id)?p.filter(x=>x!==t.id):[...p,t.id]);setCarry(p=>p.filter(x=>x!==t.id));}} style={{flex:1,background:letGo.includes(t.id)?T.rose:"transparent",color:letGo.includes(t.id)?"#fff":T.textMid,border:"1.5px solid "+(letGo.includes(t.id)?T.rose:T.border),borderRadius:"0.5rem",padding:"0.3rem",fontSize:"0.72rem",cursor:"pointer",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>✕ Let go</button>
              </div>
            </div>)}
          </div>}
          <div style={{marginBottom:"1rem"}}><label style={lbl}>Prep note for tomorrow (optional)</label><input value={prepNote} onChange={e=>setPrepNote(e.target.value)} placeholder="e.g. Defrost chicken tonight, pack bags" style={inp()}/></div>
          <div style={{display:"flex",gap:"0.5rem"}}>
            <button onClick={()=>setShowEndOfDay(false)} style={btnS({flex:1})}>Not yet</button>
            <button onClick={finish} style={{...btnP(T.blue,{flex:2})}}>Close my day →</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Anchor Tab ──────────────────────────────────────────────────────────────
  function AnchorTab() {
    const [newTask,setNewTask]   = useState("");
    const [showFlowIn,setShowFlowIn] = useState(false);
    const [fullDayDismissed,setFullDayDismissed] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [addingTask, setAddingTask] = useState(null);
    const dayOpen = anchorDayOpen;
    const setDayOpen = setAnchorDayOpen;

    const allToday   = tasks.filter(t=>(t.day===TODAY_NAME||t.day==="Daily"||t.carriedTo===TODAY_NAME)&&!t.archived);
    const todayMeal  = meals[TODAY_NAME]||{};
    const dayRhythm  = rhythm[TODAY_NAME]||{};
    const hour       = new Date().getHours();
    const isEvening  = hour >= 17;
    const noMealPlanned = !todayMeal.dinner;

    const todayEvents = calEvents.filter(e=>{
      if(!e.date) return false;
      const [y,m,d]=e.date.split("-").map(Number);
      return d===TODAY.getDate()&&(m-1)===TODAY.getMonth()&&y===TODAY.getFullYear();
    }).sort((a,b)=>(a.time||"").localeCompare(b.time||""));

    const tmrName2 = (()=>{ const d=new Date(TODAY); d.setDate(d.getDate()+1); return DAY_NAMES[d.getDay()]; })();
    const tmrEvents = calEvents.filter(e=>{
      if(!e.date) return false;
      const ed=new Date(e.date+"T00:00:00"); const d=new Date(TODAY); d.setDate(d.getDate()+1);
      return ed.getDate()===d.getDate()&&ed.getMonth()===d.getMonth()&&ed.getFullYear()===d.getFullYear();
    });
    const tmrMeal2 = meals[tmrName2]||{};

    const top3Raw = allToday.filter(t=>t.tier==="top3"||(t.aiG&&!t.tier));
    const next3Raw= allToday.filter(t=>t.tier==="next3");
    const moreRaw = allToday.filter(t=>t.tier==="more");
    const allTaskTiers = [...top3Raw, ...next3Raw, ...moreRaw];

    // Evening wind-down suggestions
    const eveningNudges = [
      "Wipe down the kitchen counters",
      tmrMeal2.dinner ? `Defrost meat for tomorrow's dinner (${tmrMeal2.dinner})` : "Check what's needed for tomorrow's dinner",
      "Pack bags or backpacks for tomorrow",
      tmrEvents.length>0 ? `Prep for ${tmrEvents[0].title} tomorrow` : "Lay out tomorrow's clothes",
      "Run the dishwasher before bed",
      "10-minute tidy — floors and surfaces",
    ];

    async function loadAiSuggestions() {
      if (aiSuggestions || aiLoading) return;
      setAiLoading(true);

      // ── Brain dump items not yet done or scheduled ───────────────────────────
      const brainPending = brainItems.filter(b=>!b.done&&!b.scheduledDay);

      // ── Day theme → brain category mapping ──────────────────────────────────
      // e.g. Errands day → pull errands brain items; Clean → household; Admin → admin/calls
      const THEME_TO_CATS = {
        "reset":    ["household","errands"],
        "errands":  ["errands","orders"],
        "admin":    ["admin","calls","orders"],
        "clean":    ["household"],
        "prep":     ["household","errands"],
        "family":   ["errands","household"],
        "rest":     ["someday"],
        "finance":  ["admin"],
        "fitness":  ["errands"],
        "batch cook":["household"],
      };
      const themeKey = (dayRhythm.theme||"").toLowerCase();
      const matchedCatIds = Object.entries(THEME_TO_CATS).find(([k])=>themeKey.includes(k))?.[1] || [];
      const brainForTheme = brainPending.filter(b=>matchedCatIds.includes(b.cat));

      // ── Calendar event → person/context extraction ───────────────────────────
      // Look at today + next 7 days to find events with names or activities
      const next7Days = Array.from({length:7},(_,i)=>{
        const d=new Date(TODAY); d.setDate(d.getDate()+i+1);
        return d.toISOString().split("T")[0];
      });
      const upcomingEvts = calEvents.filter(e=>next7Days.includes(e.date)).slice(0,6);

      // Extract person names from events (first word that's capitalized or matches a person)
      const peopleNames = people.map(p=>p.name.toLowerCase());
      const eventKeywords = [...todayEvents,...upcomingEvts].map(e=>e.title).join(" ");

      // Find brain items that mention people from events or share keywords
      const brainRelatedToEvents = brainPending.filter(b=>{
        const bText = b.text.toLowerCase();
        // Check if brain item mentions anyone in today's calendar
        return [...todayEvents,...upcomingEvts].some(e=>{
          const eTitle = e.title.toLowerCase();
          const words = eTitle.split(/\s+/);
          return words.some(w=>w.length>3&&bText.includes(w));
        }) || peopleNames.some(name=>name!=="you"&&name!=="partner"&&bText.includes(name));
      });

      // ── All brain items grouped for context ─────────────────────────────────
      const brainByCategory = {};
      BRAIN_CATS.forEach(cat=>{
        const items = brainPending.filter(b=>b.cat===cat.id);
        if(items.length) brainByCategory[cat.label] = items.map(b=>b.text).slice(0,4);
      });

      // ── Priority brain items: theme-matched + event-related ─────────────────
      const priorityBrain = [...new Set([
        ...brainForTheme,
        ...brainRelatedToEvents,
      ])].slice(0,6);

      const ctx = [
        `Today: ${TODAY_NAME}${dayRhythm.theme?" — "+dayRhythm.theme+" day":""}`,
        `Today's calendar events: ${todayEvents.map(e=>(e.time||"all day")+" — "+e.title).join(", ")||"none"}`,
        `Upcoming events next 7 days: ${upcomingEvts.map(e=>e.date.slice(5)+" "+e.title).join(", ")||"none"}`,
        `Dinner tonight: ${todayMeal.dinner||"not planned"}`,
        `Tomorrow (${tmrName2}): ${tmrEvents.map(e=>e.title).join(", ")||"no events"}${tmrMeal2.dinner?", dinner: "+tmrMeal2.dinner:""}`,
        `Tasks already on today's list: ${allTaskTiers.map(t=>t.text).join(", ")||"none"}`,
        `Priority brain items (theme + event-related): ${priorityBrain.map(b=>b.text).join(" | ")||"none"}`,
        `All brain dump items by category: ${Object.entries(brainByCategory).map(([k,v])=>k+": "+v.join(", ")).join(" || ")||"empty"}`,
        `Family: ${familyProfile?`${familyProfile.parentNames||""}, ${familyProfile.numKids||""} kids (ages: ${familyProfile.kidAges||""})`:"not set"}`,
        `Flow mode: ${flowMode}`,
      ].join("\n");

      try {
        const res = await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:700,
          system:`You are Anchor & Flow, a warm family home assistant. Suggest what to do today based on the family's real data.

RULES:
1. "brain_items": Pick 2-4 items from the brain dump that make sense TODAY. Prioritize:
   - Items matching today's theme (e.g. Errands day = pick errands items)
   - Items related to calendar events (e.g. soccer game coming up → "Wash soccer jersey")
   - Items mentioning people who appear in today's/upcoming calendar
   Use EXACT text from the brain dump. Include a short "reason" explaining why today.

2. "todos": 2-3 NEW tasks not in the brain dump. Be SPECIFIC and connected to their calendar:
   - If there's a game/practice → "Wash [name]'s jersey", "Pack snack bag for [event]"
   - If there's an appointment → "Confirm [appointment]", "Fill out paperwork for [appt]"
   - If dinner needs prep → specific prep step
   Do NOT repeat items already in tasks or brain_items.

3. "upcoming": 2 prep nudges for events in the next 7 days. Very specific:
   - "Wash soccer gear before Thursday's practice"
   - "Print directions for Monday's appointment"

Respond ONLY in valid JSON:
{"brain_items":[{"text":"exact text from brain dump","reason":"why today — 1 short phrase"}],"todos":["specific task"],"upcoming":["specific prep for upcoming event"]}`,
          messages:[{role:"user",content:ctx}]
        })});
        const dat = await res.json();
        const txt = dat.content?.find(b=>b.type==="text")?.text||"{}";
        const p = JSON.parse(txt.replace(/```json|```/g,"").trim());
        setAiSuggestions(p);
      } catch {
        setAiSuggestions({
          brain_items: priorityBrain.slice(0,2).map(b=>({text:b.text,reason:"on your radar for today"})),
          todos: ["Check your calendar","Do a 10-minute tidy"],
          upcoming: upcomingEvts.slice(0,2).map(e=>`Prep for ${e.title}`)
        });
      }
      setAiLoading(false);
    }

    function addQuickTask(text, tier="top3") {
      setTasks(p=>[...p,{id:uid(),text,day:TODAY_NAME,done:false,person:"",order:p.length,tier,aiG:true}]);
    }

    const greeting = hour < 12 ? "Good morning" : isEvening ? "Good evening" : "Good afternoon";
    const greetingEmoji = hour < 12 ? "🌿" : isEvening ? "🌙" : "☀️";
    // Get first name from auth user or family profile
    const firstName = (() => {
      if (authUser?.displayName) {
        const n = authUser.displayName.trim();
        // Clean up email-style names (border.steve → Steve)
        if (n.includes("@") || n.includes(".")) {
          return n.split(/[@._-]/)[0].charAt(0).toUpperCase() + n.split(/[@._-]/)[0].slice(1);
        }
        return n.split(" ")[0];
      }
      if (familyProfile?.parentNames) return familyProfile.parentNames.split(/[,&]/)[0].trim().split(" ")[0];
      return "";
    })();

    return (
      <div>
        {/* ── Hero greeting card ── */}
        <div style={{background:"linear-gradient(150deg,"+T.blue+"22,"+T.bluePale+" 80%)",border:"2px solid "+T.blue+"40",borderRadius:"1.5rem",padding:"1.6rem 1.5rem",marginBottom:"0.85rem",boxShadow:"0 4px 24px "+T.blue+"12"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1rem"}}>
            <div>
              <div style={{fontSize:"0.62rem",color:T.blueDark,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:800,marginBottom:"0.4rem"}}>{FORMAT_DATE(TODAY)}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"2rem",fontWeight:700,color:T.textDark,lineHeight:1.05}}>
                {greeting}{firstName ? `, ${firstName}` : ""} {greetingEmoji}
              </div>
              {dayRhythm.theme&&<div style={{color:T.textSoft,fontSize:"0.8rem",fontWeight:500,marginTop:"0.3rem"}}>{dayRhythm.emoji} {dayRhythm.theme} day</div>}
            </div>
            <button onClick={()=>setModal("share")} style={{background:"none",border:"none",cursor:"pointer",opacity:0.35,display:"flex",marginTop:"0.2rem"}}><Icon name="share" size={14} color={T.textMid}/></button>
          </div>

          {/* Flow mode chips */}
          <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap",marginBottom:"1.1rem"}}>
            {Object.entries(FM).map(([mode,m])=>(
              <button key={mode} onClick={()=>{setFlowMode(mode);if(mode==="Survival")setShowSurvivalBanner(true);}} style={{background:flowMode===mode?m.color:"transparent",color:flowMode===mode?"#fff":T.textMid,border:"2px solid "+(flowMode===mode?m.color:T.border),borderRadius:"2rem",padding:"0.28rem 0.8rem",cursor:"pointer",fontSize:"0.72rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{m.emoji} {mode}</button>
            ))}
          </div>

          {/* Primary CTA */}
          {!isEvening&&!dayOpen&&(
            <button onClick={()=>{ setDayOpen(true); loadAiSuggestions(); }} style={{width:"100%",background:"linear-gradient(135deg,"+T.sage+","+T.sageDark+")",color:"#fff",border:"none",borderRadius:"1.1rem",padding:"1rem",cursor:"pointer",fontWeight:700,fontSize:"1rem",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.55rem",boxShadow:"0 5px 22px "+T.sage+"40",letterSpacing:"0.01em"}}>
              ⚓️ Start my day
            </button>
          )}
          {isEvening&&!dayOpen&&(
            <button onClick={()=>setDayOpen(true)} style={{width:"100%",background:"linear-gradient(135deg,"+T.blue+","+T.blueDark+")",color:"#fff",border:"none",borderRadius:"1.1rem",padding:"1rem",cursor:"pointer",fontWeight:700,fontSize:"1rem",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.55rem",boxShadow:"0 5px 22px "+T.blue+"40"}}>
              🌙 Wind down my day
            </button>
          )}
          {dayOpen&&(
            <button onClick={()=>setDayOpen(false)} style={{width:"100%",background:T.bgAlt,color:T.textSoft,border:"1.5px solid "+T.border,borderRadius:"1.1rem",padding:"0.75rem",cursor:"pointer",fontWeight:600,fontSize:"0.84rem",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem"}}>
              ↑ Collapse
            </button>
          )}
        </div>

        {/* ── Expanded day panel ── */}
        {dayOpen&&!isEvening&&(
          <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          {incompletePrevTasks.length>0&&(
            <div style={{background:"linear-gradient(135deg,"+T.sandPale+","+T.surface+")",border:"1.5px solid "+T.sand+"50",borderRadius:"1rem",padding:"0.85rem 1rem",marginBottom:"0.75rem"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.65rem"}}>
                <Icon name="carry" size={14} color={T.sandDark}/>
                <span style={{fontWeight:700,color:T.sandDark,fontSize:"0.83rem",flex:1}}>{incompletePrevTasks.length} unfinished from yesterday</span>
                <button onClick={carryTasksOver} style={btnP(T.sand,{fontSize:"0.72rem",padding:"0.28rem 0.7rem"})}>Bring all</button>
                <button onClick={()=>setTasks(p=>p.map(t=>incompletePrevTasks.find(x=>x.id===t.id)?{...t,archived:true}:t))} style={btnS({fontSize:"0.72rem",padding:"0.28rem 0.6rem",color:T.textSoft})}>Let all go</button>
              </div>
              {incompletePrevTasks.map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.45rem 0.65rem",background:T.white,borderRadius:"0.75rem",marginBottom:"0.28rem",border:"1px solid "+T.sand+"30"}}>
                  <span style={{flex:1,fontSize:"0.84rem",color:T.textDark,fontWeight:500}}>{t.text}</span>
                  <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,carried:true,carriedTo:TODAY_NAME}:x))} style={btnP(T.sand,{fontSize:"0.68rem",padding:"0.22rem 0.6rem"})}>↩ Bring</button>
                  <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,archived:true}:x))} style={btnS({fontSize:"0.68rem",padding:"0.22rem 0.5rem",color:T.textSoft})}>✕</button>
                </div>
              ))}
            </div>
          )}

            {/* Calendar today */}
            <div style={{background:T.surface,border:"1.5px solid "+T.blue+"40",borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.6rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem"}}>
                  <Icon name="cal" size={15} color={T.blueDark}/>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Today's schedule</span>
                </div>
                <button onClick={()=>setTab("calendar")} style={btnS({fontSize:"0.7rem",padding:"0.25rem 0.65rem"})}>Open</button>
              </div>
              {todayEvents.length===0
                ?<p style={{color:T.textFaint,fontSize:"0.82rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",textAlign:"center",padding:"0.3rem 0"}}>No events today — open space 🌿</p>
                :todayEvents.filter(e=>!checkedCalEvents.includes(e.id)).map(e=>(
                  <AnchorCheckItem
                    key={e.id} id={e.id}
                    text={e.title}
                    checked={false}
                    onCheck={id=>setCheckedCalEvents(p=>[...p,id])}
                    color={e.color}
                    badge={e.time||"all day"}
                    entityTitle={e.title}
                  />
                ))
              }
              {todayEvents.some(e=>checkedCalEvents.includes(e.id))&&(
                <div style={{marginTop:"0.4rem",paddingTop:"0.4rem",borderTop:"1px dashed "+T.borderSoft}}>
                  {todayEvents.filter(e=>checkedCalEvents.includes(e.id)).map(e=>(
                    <div key={e.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.3rem 0.6rem",opacity:0.45}}>
                      <div style={{width:18,height:18,borderRadius:"50%",background:e.color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="check" size={9} color="#fff"/></div>
                      <span style={{fontSize:"0.8rem",color:T.textDark,textDecoration:"line-through"}}>{e.title}</span>
                    </div>
                  ))}
                  <button onClick={()=>setCheckedCalEvents(p=>p.filter(id=>!todayEvents.find(e=>e.id===id)))} style={{fontSize:"0.68rem",color:T.textFaint,background:"none",border:"none",cursor:"pointer",padding:"0.2rem 0.6rem",fontFamily:"inherit"}}>Clear done</button>
                </div>
              )}
            </div>

            {/* Today's tasks */}
            <div style={{background:T.surface,border:"3px solid "+T.blue,borderRadius:"1.2rem",padding:"1rem 1.1rem",boxShadow:"0 4px 20px "+T.blue+"14"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.7rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem"}}>
                  <span style={{fontSize:"1rem"}}>⚓️</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Today's tasks</span>
                  {allTaskTiers.length>0&&<span style={{background:T.blue,color:"#fff",fontSize:"0.6rem",fontWeight:800,padding:"2px 7px",borderRadius:"2rem"}}>{allTaskTiers.filter(t=>t.done).length}/{allTaskTiers.length}</span>}
                </div>
                <button onClick={()=>buildDailyBriefing()} disabled={briefingLoading} style={btnS({fontSize:"0.7rem",padding:"0.25rem 0.65rem",display:"flex",alignItems:"center",gap:"0.3rem",opacity:briefingLoading?0.6:1})}>
                  {briefingLoading?<>{[0,1,2].map(i=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:T.textMid,display:"inline-block",margin:"0 1px"}}/>)}</>:<>✨ Build</>}
                </button>
              </div>
              {allTaskTiers.filter(t=>!t.done).length===0&&allTaskTiers.length===0&&<p style={{color:T.textFaint,fontSize:"0.8rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",textAlign:"center",padding:"0.2rem 0 0.5rem"}}>No tasks yet — tap ✨ Build or add below.</p>}
              {top3Raw.filter(t=>!t.done).map(t=>(
                <AnchorCheckItem key={t.id} id={t.id} text={t.text} checked={false}
                  onCheck={id=>setTasks(p=>p.map(x=>x.id===id?{...x,done:true}:x))}
                  color={T.blue} badge="TOP" entityTitle={t.text}/>
              ))}
              {next3Raw.filter(t=>!t.done).map(t=>(
                <AnchorCheckItem key={t.id} id={t.id} text={t.text} checked={false}
                  onCheck={id=>setTasks(p=>p.map(x=>x.id===id?{...x,done:true}:x))}
                  color={T.sage} entityTitle={t.text}/>
              ))}
              {/* Completed tasks — collapsed */}
              {allTaskTiers.some(t=>t.done)&&(
                <div style={{marginTop:"0.5rem",paddingTop:"0.4rem",borderTop:"1px dashed "+T.borderSoft}}>
                  {allTaskTiers.filter(t=>t.done).map(t=>(
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.3rem 0.6rem",opacity:0.45}}>
                      <div style={{width:18,height:18,borderRadius:"50%",background:T.sage,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="check" size={9} color="#fff"/></div>
                      <span style={{fontSize:"0.8rem",color:T.textDark,textDecoration:"line-through"}}>{t.text}</span>
                      <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,done:false}:x))} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.65rem",color:T.textFaint,padding:"0 2px",fontFamily:"inherit"}}>undo</button>
                    </div>
                  ))}
                </div>
              )}
              {addingTask&&(
                <div style={{marginTop:"0.4rem"}}>
                  <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.4rem"}}>
                    <input value={newTask} onChange={e=>setNewTask(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter"){addQuickTask(newTask,addingTask);setNewTask("");setAddingTask(null);}if(e.key==="Escape"){setNewTask("");setAddingTask(null);}}}
                      placeholder={addingTask==="top3"?"Top priority…":"Flow task…"}
                      style={{...inp({flex:1,fontSize:"0.86rem",borderColor:addingTask==="top3"?T.blue+"70":T.sage+"70",padding:"0.6rem 0.85rem"})}} autoFocus/>
                    <button onClick={()=>{addQuickTask(newTask,addingTask);setNewTask("");setAddingTask(null);}} style={btnP(addingTask==="top3"?T.blue:T.sage,{padding:"0.58rem 0.8rem",display:"flex",alignItems:"center"})}><Icon name="plus" size={15} color="#fff"/></button>
                  </div>
                  {/* Brain dump suggestions */}
                  {brainItems.filter(b=>!b.done&&b.scheduledDay===TODAY_NAME).length>0&&(
                    <div style={{background:T.sagePale,border:"1px solid "+T.sage+"30",borderRadius:"0.75rem",padding:"0.6rem 0.75rem"}}>
                      <div style={{fontSize:"0.62rem",fontWeight:800,color:T.sageDark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.35rem"}}>🧠 Assigned from brain dump</div>
                      {brainItems.filter(b=>!b.done&&b.scheduledDay===TODAY_NAME).map(b=>(
                        <div key={b.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.32rem 0",borderBottom:"1px dashed "+T.sage+"25"}}>
                          <span style={{flex:1,fontSize:"0.82rem",color:T.textDark}}>{b.text}</span>
                          <button onClick={()=>{addQuickTask(b.text,addingTask);setBrainItems(p=>p.map(x=>x.id===b.id?{...x,done:true}:x));}} style={btnP(T.sage,{fontSize:"0.67rem",padding:"0.2rem 0.55rem"})}>+ Add</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {brainItems.filter(b=>!b.done&&!b.scheduledDay).slice(0,4).length>0&&(
                    <div style={{background:T.bgAlt,border:"1px solid "+T.borderSoft,borderRadius:"0.75rem",padding:"0.6rem 0.75rem",marginTop:"0.35rem"}}>
                      <div style={{fontSize:"0.62rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.35rem"}}>🧠 From brain dump</div>
                      {brainItems.filter(b=>!b.done&&!b.scheduledDay).slice(0,4).map(b=>(
                        <div key={b.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.32rem 0",borderBottom:"1px dashed "+T.borderSoft}}>
                          <span style={{flex:1,fontSize:"0.82rem",color:T.textMid,fontStyle:"italic"}}>{b.text}</span>
                          <button onClick={()=>{addQuickTask(b.text,addingTask);setBrainItems(p=>p.map(x=>x.id===b.id?{...x,scheduledDay:TODAY_NAME}:x));}} style={btnP(T.sage,{fontSize:"0.67rem",padding:"0.2rem 0.55rem"})}>+ Add</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={()=>{setNewTask("");setAddingTask(null);}} style={{fontSize:"0.72rem",color:T.textFaint,background:"none",border:"none",cursor:"pointer",padding:"0.4rem 0",fontFamily:"inherit"}}>Cancel</button>
                </div>
              )}
              {!addingTask&&(
                <div style={{display:"flex",gap:"0.4rem",marginTop:"0.55rem"}}>
                  <button onClick={()=>setAddingTask("top3")} style={btnP(T.blue,{flex:1,fontSize:"0.75rem",padding:"0.45rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.3rem"})}><Icon name="plus" size={12} color="#fff"/> Top priority</button>
                  <button onClick={()=>setAddingTask("next3")} style={{...btnS({flex:1,fontSize:"0.75rem",padding:"0.45rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.3rem",color:T.sage,borderColor:T.sage+"60"})}}><Icon name="plus" size={12} color={T.sage}/> Flow task</button>
                </div>
              )}
            </div>

            {/* Tonight's dinner */}
            <div style={{background:T.surface,border:"1.5px solid "+(noMealPlanned?T.rose+"50":T.sage+"45"),borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.5rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem"}}>
                  <span style={{fontSize:"0.95rem"}}>🍽️</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Tonight's dinner</span>
                </div>
                <button onClick={()=>setTab("meals")} style={btnS({fontSize:"0.7rem",padding:"0.25rem 0.65rem"})}>Plan meals</button>
              </div>
              {noMealPlanned
                ?<div style={{background:T.rose+"10",border:"1.5px dashed "+T.rose+"50",borderRadius:"0.75rem",padding:"0.65rem 0.85rem",display:"flex",alignItems:"center",gap:"0.55rem"}}>
                  <span style={{fontSize:"0.9rem"}}>⚠️</span>
                  <div>
                    <div style={{fontSize:"0.83rem",fontWeight:600,color:T.rose}}>No dinner planned</div>
                    <div style={{fontSize:"0.73rem",color:T.textSoft,marginTop:"0.12rem"}}>Tap "Plan meals" to add something — or wing it 🌿</div>
                  </div>
                </div>
                :<div>
                  {MEALS_TO_SHOW.map(m=>todayMeal[m]&&(
                    <AnchorCheckItem key={m} id={"meal_"+m+"_"+TODAY_NAME}
                      text={todayMeal[m]} checked={checkedMealItems.includes("meal_"+m+"_"+TODAY_NAME)}
                      onCheck={id=>setCheckedMealItems(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}
                      color={T.sage} badge={m} entityTitle={todayMeal[m]}/>
                  ))}
                  {todayMeal.dinner&&!checkedMealItems.includes("meal_dinner_"+TODAY_NAME)&&!todayMeal.dinner.toLowerCase().includes("snack")&&!todayMeal.dinner.toLowerCase().includes("burrito")&&(
                    <div style={{marginTop:"0.3rem",fontSize:"0.76rem",color:T.textSoft,fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",paddingLeft:"0.3rem"}}>💡 Check if anything needs defrosting.</div>
                  )}
                </div>
              }
            </div>


            {/* Brain dump items for today */}
            {!aiLoading&&aiSuggestions?.brain_items?.length>0&&(
              <div style={{background:"linear-gradient(135deg,"+T.sagePale+","+T.surface+")",border:"1.5px solid "+T.sage+"45",borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem",marginBottom:"0.6rem"}}>
                  <span style={{fontSize:"0.9rem"}}>🧠</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>From your brain dump</span>
                  {dayRhythm.theme&&<span style={{fontSize:"0.68rem",background:T.sage+"25",color:T.sageDark,fontWeight:700,padding:"2px 8px",borderRadius:"2rem"}}>{dayRhythm.emoji} {dayRhythm.theme} day</span>}
                </div>
                {aiSuggestions.brain_items.map((item,i)=>{
                  const text = typeof item==="string" ? item : item.text;
                  const reason = typeof item==="object" ? item.reason : null;
                  const brainItem = brainItems.find(b=>b.text===text&&!b.done);
                  const alreadyAdded = allTaskTiers.some(t=>t.text===text);
                  return (
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"0.55rem",padding:"0.5rem 0.65rem",background:alreadyAdded?T.sagePale:T.white,borderRadius:"0.75rem",marginBottom:"0.3rem",border:"1.5px solid "+(alreadyAdded?T.sage+"50":T.sage+"25")}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:"0.86rem",color:alreadyAdded?T.sageDark:T.textDark,fontWeight:600}}>{alreadyAdded&&"✓ "}{text}</div>
                        {reason&&<div style={{fontSize:"0.68rem",color:T.textSoft,marginTop:"0.1rem",fontStyle:"italic"}}>{reason}</div>}
                      </div>
                      {!alreadyAdded&&(
                        <button onClick={()=>{
                          addQuickTask(text,"next3");
                          // Mark as scheduled in brain dump
                          if(brainItem) setBrainItems(p=>p.map(b=>b.id===brainItem.id?{...b,scheduledDay:TODAY_NAME}:b));
                        }} style={btnP(T.sage,{fontSize:"0.7rem",padding:"0.25rem 0.65rem",flexShrink:0})}>+ Add</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* AI suggested to-dos */}
            {(!aiLoading&&aiSuggestions?.todos?.length>0)&&(
              <div style={{background:T.surface,border:"1.5px solid "+T.borderSoft,borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem",marginBottom:"0.65rem"}}>
                  <span style={{fontSize:"0.9rem"}}>✨</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Suggested to-dos</span>
                </div>
                {aiLoading&&<div style={{display:"flex",gap:8,justifyContent:"center",padding:"0.75rem 0"}}>{[0,1,2].map(i=><div key={i} style={{width:9,height:9,borderRadius:"50%",background:T.sage,animation:"bounce 1.2s "+(i*0.2)+"s infinite ease-in-out"}}/>)}</div>}
                {aiSuggestions.todos.map((text,i)=>{
                  const alreadyAdded = allTaskTiers.some(t=>t.text===text);
                  const sid = "suggestion_"+i+"_"+text.slice(0,10);
                  return alreadyAdded
                    ? <AnchorCheckItem key={i} id={allTaskTiers.find(t=>t.text===text)?.id||sid} text={text} checked={allTaskTiers.find(t=>t.text===text)?.done||false}
                        onCheck={id=>setTasks(p=>p.map(x=>x.id===id?{...x,done:true}:x))}
                        color={T.sage} badge="added" entityTitle={text}/>
                    : <div key={i} style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.5rem 0.65rem",background:T.bgAlt,borderRadius:"0.7rem",marginBottom:"0.3rem",border:"1px dashed "+T.borderSoft}}>
                        <span style={{flex:1,fontSize:"0.85rem",color:T.textMid,fontStyle:"italic"}}>{text}</span>
                        <button onClick={()=>addQuickTask(text,"next3")} style={btnP(T.sage,{fontSize:"0.7rem",padding:"0.25rem 0.65rem"})}>+ Add</button>
                      </div>;
                })}
              </div>
            )}

            {aiLoading&&(
              <div style={{background:T.surface,border:"1.5px solid "+T.borderSoft,borderRadius:"1.2rem",padding:"1.2rem",textAlign:"center"}}>
                <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:"0.5rem"}}>{[0,1,2].map(i=><div key={i} style={{width:9,height:9,borderRadius:"50%",background:T.sage,animation:"bounce 1.2s "+(i*0.2)+"s infinite ease-in-out"}}/>)}</div>
                <div style={{fontSize:"0.78rem",color:T.textSoft,fontStyle:"italic"}}>Looking at your brain dump and calendar…</div>
              </div>
            )}

            {/* Upcoming — prep nudges */}
            {(!aiLoading&&aiSuggestions?.upcoming?.length>0)&&(
              <div style={{background:"linear-gradient(135deg,"+T.lavPale+","+T.bluePale+")",border:"1.5px solid "+T.lavender+"35",borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem",marginBottom:"0.55rem"}}>
                  <span style={{fontSize:"0.9rem"}}>👁</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Coming up — prep today</span>
                </div>
                {aiSuggestions.upcoming.map((text,i)=>{
                  const upid = "upcoming_"+i+"_"+text.slice(0,10);
                  const upAdded = allTaskTiers.some(t=>t.text===text);
                  return upAdded
                    ? <AnchorCheckItem key={i} id={allTaskTiers.find(t=>t.text===text)?.id||upid} text={text}
                        checked={allTaskTiers.find(t=>t.text===text)?.done||false}
                        onCheck={id=>setTasks(p=>p.map(x=>x.id===id?{...x,done:true}:x))}
                        color={T.lavender} badge="added" entityTitle={text}/>
                    : <div key={i} style={{display:"flex",alignItems:"center",gap:"0.55rem",padding:"0.5rem 0.65rem",background:T.white,borderRadius:"0.7rem",marginBottom:"0.3rem",border:"1px solid "+T.lavender+"25"}}>
                        <span style={{flex:1,fontSize:"0.85rem",color:T.textMid}}>{text}</span>
                        <button onClick={()=>addQuickTask(text,"next3")} style={btnP(T.lavender,{fontSize:"0.7rem",padding:"0.25rem 0.65rem"})}>+ Add</button>
                      </div>;
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Evening wind-down panel ── */}
        {dayOpen&&isEvening&&(
          <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
            {/* Task wrap-up */}
            <div style={{background:T.surface,border:"1.5px solid "+T.blue+"40",borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.65rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.45rem"}}>
                  <span style={{fontSize:"0.95rem"}}>📋</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>Today at a glance</span>
                </div>
                {allTaskTiers.length>0&&<span style={{fontSize:"0.8rem",color:allTaskTiers.filter(t=>t.done).length===allTaskTiers.length?T.sage:T.textSoft,fontWeight:700}}>{allTaskTiers.filter(t=>t.done).length}/{allTaskTiers.length} done</span>}
              </div>
              {allTaskTiers.length===0?<p style={{color:T.textFaint,fontSize:"0.82rem",fontStyle:"italic",textAlign:"center"}}>No tasks today.</p>
              :allTaskTiers.slice(0,5).map(t=>(
                <AnchorCheckItem key={t.id} id={t.id}
                  text={t.text} checked={t.done}
                  onCheck={id=>setTasks(p=>p.map(x=>x.id===id?{...x,done:!x.done}:x))}
                  color={T.blue} bell={false} entityTitle={t.text}/>
              ))}
              <button onClick={()=>setShowEndOfDay(true)} style={{...btnP(T.blue,{width:"100%",marginTop:"0.65rem",fontSize:"0.88rem",padding:"0.75rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.45rem",borderRadius:"0.9rem",boxShadow:"0 3px 16px "+T.blue+"35"})}}>🌙 Close my day →</button>
            </div>

            {/* Tonight's dinner reminder */}
            {!noMealPlanned&&<div style={{background:T.surface,border:"1.5px solid "+T.sage+"40",borderRadius:"1.2rem",padding:"0.9rem 1.1rem",display:"flex",alignItems:"center",gap:"0.55rem"}}>
              <span style={{fontSize:"1rem"}}>🍽️</span>
              <div style={{flex:1}}>
                <div style={{fontSize:"0.72rem",color:T.sageDark,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.1rem"}}>Tonight's dinner</div>
                <div style={{fontSize:"0.9rem",fontWeight:600,color:T.textDark}}>{todayMeal.dinner}</div>
              </div>
            </div>}

            {/* Tomorrow peek */}
            <div style={{background:"linear-gradient(135deg,"+T.lavPale+","+T.bluePale+")",border:"1.5px solid "+T.lavender+"35",borderRadius:"1.2rem",padding:"1rem 1.1rem"}}>
              <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.lavender,marginBottom:"0.5rem"}}>👁 {tmrName2} — prep tonight</div>
              {eveningNudges.slice(0,4).map((n,i)=>(
                <AnchorCheckItem key={i} id={"evening_"+i}
                  text={n} checked={checkedMealItems.includes("evening_"+i)}
                  onCheck={id=>setCheckedMealItems(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}
                  color={T.lavender} bell={true} entityTitle={n}/>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Calendar Tab ────────────────────────────────────────────────────────────
  function CalendarTab() {
    const year=calViewDate.getFullYear(), month=calViewDate.getMonth();
    const daysInMonth=getDaysInMonth(year,month);
    const firstDay=getFirstDayOfMonth(year,month);
    function eventsForDay(d,m2,y2){const mm=m2!==undefined?m2:month,yy=y2!==undefined?y2:year;return calEvents.filter(e=>{if(!e.date)return false;const ed=new Date(e.date+"T00:00:00");return ed.getDate()===d&&ed.getMonth()===mm&&ed.getFullYear()===yy;}).sort((a,b)=>(a.time||"").localeCompare(b.time||""));}
    function getWeekDates(ref){const d=new Date(ref);const day=d.getDay();d.setDate(d.getDate()-day);return Array.from({length:7},(_,i)=>{const nd=new Date(d);nd.setDate(d.getDate()+i);return nd;});}
    const weekDates=getWeekDates(calViewDate);
    function navPrev(){if(calView==="month")setCalViewDate(new Date(year,month-1,1));else if(calView==="week"){const d=new Date(calViewDate);d.setDate(d.getDate()-7);setCalViewDate(d);}else{const d=new Date(calViewDate);d.setDate(d.getDate()-1);setCalViewDate(d);}}
    function navNext(){if(calView==="month")setCalViewDate(new Date(year,month+1,1));else if(calView==="week"){const d=new Date(calViewDate);d.setDate(d.getDate()+7);setCalViewDate(d);}else{const d=new Date(calViewDate);d.setDate(d.getDate()+1);setCalViewDate(d);}}
    function navTitle(){if(calView==="month")return calViewDate.toLocaleDateString("en-US",{month:"long",year:"numeric"});if(calView==="week"){const wk=getWeekDates(calViewDate);return `${wk[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${wk[6].toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;}return calViewDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});}
    function isToday(d){return d.getDate()===TODAY.getDate()&&d.getMonth()===TODAY.getMonth()&&d.getFullYear()===TODAY.getFullYear();}
    const EventDot=({e})=>(<div style={{background:e.color+"28",border:`1px solid ${e.color}55`,borderRadius:"0.25rem",padding:"1px 4px",marginBottom:"2px",fontSize:"0.62rem",fontWeight:700,color:e.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.time&&`${e.time} `}{e.title}</div>);
    const [showCalNotif,setShowCalNotif]=useState(null);
    const [cnd,setCnd]=useState(""); const [cnt,setCnt]=useState(""); const [cnn,setCnn]=useState("");
    return (
      <div>
        <SecHead emoji="📆" title="Calendar" sub="All your events in one place"/>
        {/* Google Calendar connect banner */}
        <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.85rem"}}>
          <button onClick={()=>openAddEvent("")} style={{...btnP(T.blue,{display:"flex",alignItems:"center",gap:"0.4rem",flex:1,justifyContent:"center",padding:"0.72rem",fontSize:"0.88rem",borderRadius:"0.9rem"})}}>
            <Icon name="plus" size={15} color="#fff"/> Add Event
          </button>
          <button onClick={()=>setModal("calSync")} style={{...btnS({display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.72rem 0.9rem",fontSize:"0.82rem",borderRadius:"0.9rem",background:connectedCals.includes("google")?T.sagePale:T.bgAlt,borderColor:connectedCals.includes("google")?T.sage+"60":T.border,color:connectedCals.includes("google")?T.sageDark:T.textMid})}}>
            <Icon name="google" size={14}/>
            {connectedCals.includes("google")?"Synced":"Connect Google"}
          </button>
        </div>
        <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.85rem",background:T.bgAlt,borderRadius:"0.8rem",padding:"0.3rem",border:`1px solid ${T.border}`}}>
          {["month","week","day"].map(v=>(
            <button key={v} onClick={()=>setCalView(v)} style={{flex:1,background:calView===v?T.blue:"transparent",color:calView===v?"#fff":T.textMid,border:"none",borderRadius:"0.55rem",padding:"0.42rem 0.5rem",cursor:"pointer",fontSize:"0.78rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s",textTransform:"capitalize"}}>{v}</button>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem",padding:"0 0.15rem"}}>
          <button onClick={navPrev} style={{background:T.bgAlt,border:`1px solid ${T.border}`,cursor:"pointer",padding:7,display:"flex",borderRadius:"50%"}}><Icon name="chevL" size={18} color={T.textMid}/></button>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.05rem",color:T.textDark,textAlign:"center"}}>{navTitle()}</span>
          <button onClick={navNext} style={{background:T.bgAlt,border:`1px solid ${T.border}`,cursor:"pointer",padding:7,display:"flex",borderRadius:"50%"}}><Icon name="chevR" size={18} color={T.textMid}/></button>
        </div>
        {calView==="month"&&(
          <div style={{...card({padding:"0",overflow:"hidden",borderRadius:"1.1rem"})}}>
            {/* Day headers */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:T.bgAlt,borderBottom:`1px solid ${T.borderSoft}`}}>
              {WEEKDAYS_SUN.map(d=>(
                <div key={d} style={{textAlign:"center",padding:"0.45rem 0",fontSize:"0.65rem",fontWeight:800,color:T.textSoft,letterSpacing:"0.05em"}}>{d}</div>
              ))}
            </div>
            {/* Calendar grid — fixed row heights */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
              {Array.from({length:firstDay}).map((_,i)=>(
                <div key={`e${i}`} style={{height:88,borderRight:`1px solid ${T.borderSoft}`,borderBottom:`1px solid ${T.borderSoft}`,background:T.bgAlt+"80"}}/>
              ))}
              {Array.from({length:daysInMonth}).map((_,i)=>{
                const day=i+1;
                const todayFlag=day===TODAY.getDate()&&month===TODAY.getMonth()&&year===TODAY.getFullYear();
                const dayEvts=eventsForDay(day);
                const thisDate=new Date(year,month,day);
                const isSelected=selectedDay&&selectedDay.getDate()===day&&selectedDay.getMonth()===month&&selectedDay.getFullYear()===year;
                const isLastCol=(firstDay+i)%7===6;
                return (
                  <div key={day} onClick={()=>setSelectedDay(isSelected?null:thisDate)}
                    style={{height:88,padding:"0.22rem 0.2rem",borderRight:isLastCol?"none":`1px solid ${T.borderSoft}`,borderBottom:`1px solid ${T.borderSoft}`,background:isSelected?T.sandPale:todayFlag?T.bluePale:T.surface,cursor:"pointer",transition:"background 0.1s",overflow:"hidden",display:"flex",flexDirection:"column",gap:"1px"}}>
                    {/* Date number */}
                    <div style={{width:22,height:22,borderRadius:"50%",background:todayFlag?T.blue:"transparent",color:todayFlag?"#fff":T.textDark,fontSize:"0.75rem",fontWeight:todayFlag?800:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginBottom:"1px"}}>{day}</div>
                    {/* Events — show up to 2, then +N more */}
                    {dayEvts.slice(0,2).map(e=>(
                      <div key={e.id} style={{background:e.color+"28",borderLeft:`2.5px solid ${e.color}`,borderRadius:"0 3px 3px 0",padding:"1px 3px",fontSize:"0.58rem",fontWeight:700,color:e.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.4}}>
                        {e.time&&<span style={{opacity:0.8,marginRight:2}}>{e.time}</span>}{e.title}
                      </div>
                    ))}
                    {dayEvts.length>2&&(
                      <div style={{fontSize:"0.56rem",color:T.textSoft,fontWeight:700,paddingLeft:"0.2rem"}}>+{dayEvts.length-2} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {calView==="week"&&(
          <div style={{...card({padding:"0",overflow:"hidden"})}}>
            {weekDates.map((d,i)=>{
              const todayFlag=isToday(d);
              const dayEvts=eventsForDay(d.getDate(),d.getMonth(),d.getFullYear());
              const dayName=d.toLocaleDateString("en-US",{weekday:"long"});
              const dateStr=d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
              return (
                <div key={i} style={{borderBottom:i<6?`1px solid ${T.borderSoft}`:"none",background:todayFlag?T.bluePale:T.surface}}>
                  {/* Day header row */}
                  <div style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.65rem 1rem",cursor:"pointer"}}
                    onClick={()=>{setCalViewDate(new Date(d));setCalView("day");}}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:todayFlag?T.blue:T.bgAlt,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,border:todayFlag?"none":`1px solid ${T.borderSoft}`}}>
                      <span style={{fontSize:"0.58rem",fontWeight:800,color:todayFlag?"rgba(255,255,255,0.8)":T.textSoft,lineHeight:1,letterSpacing:"0.04em"}}>{d.toLocaleDateString("en-US",{weekday:"short"}).toUpperCase()}</span>
                      <span style={{fontSize:"0.85rem",fontWeight:800,color:todayFlag?"#fff":T.textDark,lineHeight:1.2}}>{d.getDate()}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      {dayEvts.length===0
                        ? <span style={{fontSize:"0.78rem",color:T.textFaint,fontStyle:"italic"}}>No events</span>
                        : dayEvts.map(e=>(
                          <div key={e.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.2rem"}}>
                            <div style={{width:7,height:7,borderRadius:"50%",background:e.color,flexShrink:0}}/>
                            <span style={{fontSize:"0.8rem",color:T.textDark,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.time&&<span style={{color:e.color,fontSize:"0.72rem",fontWeight:700,marginRight:"0.3rem"}}>{e.time}</span>}{e.title}</span>
                          </div>
                        ))
                      }
                    </div>
                    <button onClick={e=>{e.stopPropagation();openAddEvent(localDateStr(d));}} style={{background:"none",border:"none",cursor:"pointer",padding:"4px",display:"flex",opacity:0.4,flexShrink:0}}><Icon name="plus" size={14} color={T.textMid}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {calView==="day"&&(
          <div style={{...card()}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.85rem"}}>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.05rem",color:T.textDark}}>{calViewDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</span>
              <button onClick={()=>openAddEvent(localDateStr(calViewDate))} style={{...btnP(T.blue,{fontSize:"0.76rem",padding:"0.32rem 0.75rem",display:"flex",alignItems:"center",gap:"0.35rem"})}}><Icon name="plus" size={13} color="#fff"/> Add</button>
            </div>
            {eventsForDay(calViewDate.getDate(),calViewDate.getMonth(),calViewDate.getFullYear()).length===0&&<p style={{color:T.textFaint,fontSize:"0.83rem",fontWeight:600,textAlign:"center",padding:"1rem 0"}}>No events — enjoy the open space 🌿</p>}
            {eventsForDay(calViewDate.getDate(),calViewDate.getMonth(),calViewDate.getFullYear()).map(e=>(
              <div key={e.id} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.7rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.18rem",flexShrink:0,minWidth:44}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:e.color,marginTop:3}}/>
                  {e.time?<span style={{fontSize:"0.74rem",fontWeight:800,color:e.color}}>{e.time}</span>:<span style={{fontSize:"0.68rem",color:T.textFaint,fontWeight:600}}>all day</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.9rem"}}>{e.title}</div>
                  {e.colorLabel&&<div style={{fontSize:"0.66rem",color:e.color,fontWeight:700,marginTop:"0.1rem"}}>{e.colorCustom?.trim()||e.colorLabel}</div>}
                  {e.note&&<div style={{color:T.textMid,fontSize:"0.78rem",marginTop:"0.28rem",fontStyle:"italic"}}>📝 {e.note}</div>}
                  {notifications.some(n=>n.entityId===e.id)&&<div style={{color:T.sand,fontSize:"0.72rem",fontWeight:600,marginTop:"0.2rem"}}>🔔 Reminder set</div>}
                </div>
                <div style={{display:"flex",gap:"0.25rem",flexShrink:0}}>
                  <button onClick={()=>setShowCalNotif(showCalNotif===e.id?null:e.id)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="bell" size={13} color={T.sand}/></button>
                  <button onClick={()=>openEditEvent(e)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="edit" size={13} color={T.textMid}/></button>
                  <button onClick={()=>setCalEvents(p=>p.filter(x=>x.id!==e.id))} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
                </div>
              </div>
            ))}
            {showCalNotif&&(
              <div style={{background:T.bgAlt,border:`1px solid ${T.sand}50`,borderRadius:"0.8rem",padding:"0.85rem",marginTop:"0.5rem"}}>
                <p style={{fontSize:"0.75rem",fontWeight:700,color:T.sandDark,marginBottom:"0.6rem"}}>🔔 Set reminder</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.45rem",marginBottom:"0.45rem"}}>
                  <input type="date" value={cnd} onChange={e=>setCnd(e.target.value)} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
                  <input type="time" value={cnt} onChange={e=>setCnt(e.target.value)} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
                </div>
                <input value={cnn} onChange={e=>setCnn(e.target.value)} placeholder="Note…" style={{...inp({marginBottom:"0.5rem",padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}}/>
                <button onClick={()=>{const ev=calEvents.find(e=>e.id===showCalNotif);if(ev)addNotification(ev.id,ev.title,cnd,cnt,cnn);setShowCalNotif(null);}} style={btnP(T.sand,{fontSize:"0.76rem",padding:"0.35rem 0.75rem"})}>Set Reminder</button>
              </div>
            )}
          </div>
        )}
        {calView==="month"&&selectedDay&&!calFormMode&&(
          <div style={{...card({border:`2px solid ${T.sand}60`,background:`linear-gradient(to right,${T.sandPale},${T.surface})`})}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
              <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1rem",color:T.textDark}}>{FORMAT_SHORT(selectedDay)}</span>
              <div style={{display:"flex",gap:"0.4rem"}}>
                <button onClick={()=>openAddEvent(localDateStr(selectedDay))} style={{...btnP(T.blue,{display:"flex",alignItems:"center",gap:"0.35rem",padding:"0.38rem 0.8rem",fontSize:"0.78rem",borderRadius:"0.65rem"})}}><Icon name="plus" size={13} color="#fff"/> Add Event</button>
                <button onClick={()=>setSelectedDay(null)} style={{...btnS({padding:"0.38rem 0.6rem",borderRadius:"0.65rem"})}}>✕</button>
              </div>
            </div>
            {eventsForDay(selectedDay.getDate()).length===0?<p style={{color:T.textFaint,fontSize:"0.83rem",fontWeight:600,textAlign:"center",padding:"0.5rem 0"}}>No events this day.</p>
            :eventsForDay(selectedDay.getDate()).map(e=>(
              <div key={e.id} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.65rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.18rem",flexShrink:0,minWidth:38}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:e.color,marginTop:3}}/>
                  <span style={{fontSize:"0.54rem",fontWeight:700,color:e.color,whiteSpace:"nowrap",textAlign:"center"}}>{e.colorCustom?.trim()||e.colorLabel||""}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem"}}>{e.title}</div>
                  {e.time&&<div style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500,marginTop:"0.1rem"}}>⏰ {e.time}</div>}
                  {e.note&&<div style={{color:T.textMid,fontSize:"0.79rem",marginTop:"0.35rem",lineHeight:1.5,fontStyle:"italic"}}>📝 {e.note}</div>}
                </div>
                <div style={{display:"flex",gap:"0.25rem",flexShrink:0}}>
                  <button onClick={()=>openEditEvent(e)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="edit" size={13} color={T.textMid}/></button>
                  <button onClick={()=>setCalEvents(p=>p.filter(x=>x.id!==e.id))} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.45rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {connectedCals.length===0&&(
          <div style={{...card({background:`linear-gradient(135deg,${T.bluePale},${T.lavPale})`,border:`2px solid ${T.blue}50`,textAlign:"center",padding:"1.5rem"})}}>
            <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📆</div>
            <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.textDark,marginBottom:"0.4rem"}}>Connect Your Calendars</h3>
            <p style={{color:T.textMid,fontSize:"0.83rem",fontWeight:500,marginBottom:"1rem",lineHeight:1.6}}>Sync Google, Apple, Outlook, or any iCal source.</p>
            <button onClick={()=>setModal("calSync")} style={{...btnP(T.blue,{display:"inline-flex",alignItems:"center",gap:"0.5rem"})}}><Icon name="link" size={15} color="#fff"/> Connect a Calendar</button>
          </div>
        )}
      </div>
    );
  }

  // ── Weekly Tab ──────────────────────────────────────────────────────────────
  function WeeklyTab() {
    const [newTaskText,setNewTaskText]=useState("");
    const [taskDay,setTaskDay]=useState(TODAY_NAME);
    const [taskPerson,setTaskPerson]=useState("");
    const [editingDay,setEditingDay]=useState(null);
    const [editForm,setEditForm]=useState({theme:"",emoji:"",desc:""});
    const DAY_COLORS=[T.blue,T.sage,T.sand,T.rose,T.lavender,T.blue,T.sage];
    function openEditDay(day){setEditingDay(day);setEditForm({...rhythm[day]});}
    function saveEditDay(){setRhythm(p=>({...p,[editingDay]:{...editForm}}));setEditingDay(null);}
    function applyPreset(preset){if(preset.theme==="Custom"){setEditForm(p=>({...p,emoji:preset.emoji}));return;}setEditForm({theme:preset.theme,emoji:preset.emoji,desc:preset.desc});}
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
          const dayTasks=tasks.filter(t=>t.day===day&&!t.archived);
          const dr=rhythm[day];const accent=DAY_COLORS[di%DAY_COLORS.length];
          return (
            <div key={day} style={{...card({borderLeft:`4px solid ${day===TODAY_NAME?accent:T.borderSoft}`})}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:dayTasks.length?"0.75rem":"0.1rem"}}>
                <span style={{fontSize:"1rem"}}>{dr?.emoji||"📋"}</span>
                <span style={{fontWeight:700,color:day===TODAY_NAME?accent:T.textDark,fontSize:"0.92rem"}}>{day}</span>
                {dr&&<span style={{color:T.textSoft,fontSize:"0.76rem",fontWeight:500}}>· {dr.theme}</span>}
                <div style={{flex:1}}/>
                {day===TODAY_NAME&&<Pill label="Today" color={accent} tiny/>}
                {day!=="Daily"&&<button onClick={()=>openEditDay(day)} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"0.5rem",cursor:"pointer",padding:"2px 7px",fontSize:"0.7rem",color:T.textSoft,fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.3rem"}}><Icon name="edit" size={11} color={T.textSoft}/> Edit Day</button>}
              </div>
              <DraggableTaskList tasks={dayTasks} setTasks={setTasks} accent={accent}/>
              {dayTasks.length===0&&<p style={{color:T.textFaint,fontSize:"0.77rem",fontWeight:500}}>Nothing yet</p>}
            </div>
          );
        })}
        {editingDay&&(
          <ModalBox title={`Edit ${editingDay}`} onClose={()=>setEditingDay(null)}>
            <div style={{marginBottom:"0.75rem"}}>
              <label style={lbl}>Quick Presets</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",marginBottom:"0.85rem"}}>
                {THEME_PRESETS.map((pr,i)=><button key={i} onClick={()=>applyPreset(pr)} style={{background:editForm.theme===pr.theme?T.blue:T.white,color:editForm.theme===pr.theme?"#fff":T.textMid,border:`1.5px solid ${editForm.theme===pr.theme?T.blue:T.border}`,borderRadius:"2rem",padding:"0.28rem 0.72rem",cursor:"pointer",fontSize:"0.75rem",fontFamily:"inherit",fontWeight:700}}>{pr.emoji} {pr.theme}</button>)}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"64px 1fr",gap:"0.65rem",marginBottom:"0.9rem"}}>
              <div><label style={lbl}>Emoji</label><input value={editForm.emoji} onChange={e=>setEditForm(p=>({...p,emoji:e.target.value}))} placeholder="🗓️" style={{...inp({textAlign:"center",fontSize:"1.2rem",padding:"0.5rem"})}}/></div>
              <div><label style={lbl}>Theme Name</label><input value={editForm.theme} onChange={e=>setEditForm(p=>({...p,theme:e.target.value}))} placeholder="e.g. Batch Cook" style={inp()}/></div>
            </div>
            <div style={{marginBottom:"1rem"}}><label style={lbl}>Description</label><input value={editForm.desc} onChange={e=>setEditForm(p=>({...p,desc:e.target.value}))} placeholder="What happens on this day…" style={inp()}/></div>
            <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
              <button onClick={()=>setEditingDay(null)} style={btnS()}>Cancel</button>
              <button onClick={saveEditDay} style={btnP(T.sage)}>Save</button>
            </div>
          </ModalBox>
        )}
      </div>
    );
  }

  // ── Meals Tab ───────────────────────────────────────────────────────────────
  function MealsTab() {
    const [editDay,setEditDay]=useState(null);
    const [editMeal,setEditMeal]=useState({});
    const [showRecipes,setShowRecipes]=useState(false);
    const [editingThemes,setEditingThemes]=useState(false);
    const [mealSubTab,setMealSubTab]=useState("week");
    const [weekTypeKey,setWeekTypeKey]=useState(null);
    const [showWeekTypePicker,setShowWeekTypePicker]=useState(false);
    const [bankFilters,setBankFilters]=useState([]);
    const [selectedBankMeal,setSelectedBankMeal]=useState(null);
    const [prepChecked,setPrepChecked]=useState([]);
    const [rescueInput,setRescueInput]=useState("");
    const [rescueResults,setRescueResults]=useState(null);
    const [rescueLoading,setRescueLoading]=useState(false);

    const tonightMealName=(meals[TODAY_NAME]||{}).dinner;
    const tonightMealData=MEAL_BANK_DATA.find(m=>m.name.toLowerCase()===(tonightMealName||"").toLowerCase());

    const weekMealNames=MEAL_DAYS.map(d=>(meals[d]||{}).dinner).filter(Boolean);
    const prepTaskPool=[
      {id:"wash-fruit",   text:"Wash and dry all fruit",         emoji:"🫐"},
      {id:"slice-veg",    text:"Slice peppers + onions",          emoji:"🫑"},
      {id:"cook-rice",    text:"Cook a big batch of rice",         emoji:"🍚"},
      {id:"shred-chicken",text:"Shred rotisserie chicken",         emoji:"🍗"},
      {id:"portion-snacks",text:"Portion snacks into containers",  emoji:"🍎"},
      {id:"boil-eggs",    text:"Hard boil 6 eggs",                 emoji:"🥚"},
      {id:"marinate",     text:"Marinate proteins for the week",   emoji:"🫙"},
      {id:"chop-garlic",  text:"Mince + store garlic (3 days)",    emoji:"🧄"},
    ];
    const activePrepTasks=prepTaskPool.filter(t=>{
      if(t.id==="shred-chicken"&&!weekMealNames.some(n=>n.toLowerCase().includes("chicken")))return false;
      if(t.id==="cook-rice"&&!weekMealNames.some(n=>n.toLowerCase().includes("rice")||n.toLowerCase().includes("bowl")))return false;
      return true;
    });

    function openEdit(day){setEditDay(day);setEditMeal(meals[day]||{});}
    function saveEdit(){setMeals(p=>({...p,[editDay]:editMeal}));setEditDay(null);}
    function rotateMeals(){const days=[...MEAL_DAYS];const cur={...meals};const rotated={};days.forEach((day,i)=>{const prev=days[(i-1+days.length)%days.length];rotated[day]={...cur[prev]};});setMeals(rotated);}
    function applyWeekType(key){
      const preset=WEEK_TYPE_PRESETS[key];if(!preset)return;
      setMeals(p=>{const next={...p};Object.entries(preset.meals).forEach(([day,m])=>{next[day]={...(next[day]||{}),...m};});return next;});
      setWeekTypeKey(key);setShowWeekTypePicker(false);
    }

    const filteredBank=bankFilters.length===0?MEAL_BANK_DATA:MEAL_BANK_DATA.filter(m=>bankFilters.every(f=>m.tags.includes(f)));

    async function findRescueMeals(){
      if(!rescueInput.trim())return;
      setRescueLoading(true);setRescueResults(null);
      try{
        const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:600,
          system:"You are a helpful family meal assistant. Given ingredients on hand, suggest 3 simple family-friendly meals. Respond ONLY in JSON: [{\"name\":\"\",\"desc\":\"\"}]",
          messages:[{role:"user",content:`I have: ${rescueInput}. What can I make for dinner tonight?`}]
        })});
        const d=await r.json();
        const txt=d.content?.find(b=>b.type==="text")?.text||"[]";
        setRescueResults(JSON.parse(txt.replace(/```json|```/g,"").trim()));
      }catch{setRescueResults([]);}
      setRescueLoading(false);
    }

    const subTabs=[{id:"week",label:"This Week",emoji:"📆"},{id:"tonight",label:"Tonight",emoji:"🌙"},{id:"bank",label:"Meal Bank",emoji:"📋"},{id:"prep",label:"Prep",emoji:"🫙"},{id:"rescue",label:"Rescue",emoji:"🆘"}];

    return (
      <div>
        <SecHead emoji="🍽️" title="Meal Rhythm" sub="Simple meals for full weeks"
          action={<button onClick={()=>setShowWeekTypePicker(v=>!v)} style={btnP(weekTypeKey?T.sage:T.blue,{fontSize:"0.74rem",padding:"0.32rem 0.75rem"})}>
            {weekTypeKey?`${WEEK_TYPE_PRESETS[weekTypeKey].emoji} ${WEEK_TYPE_PRESETS[weekTypeKey].label}`:"✨ Week Type"}
          </button>}/>

        {showWeekTypePicker&&(
          <div style={{...card({background:`linear-gradient(135deg,${T.sagePale},${T.bluePale})`,border:`2px solid ${T.sage}60`,padding:"1.1rem"})}}>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.05rem",fontWeight:700,color:T.textDark,marginBottom:"0.75rem"}}>What kind of week is it?</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.55rem"}}>
              {Object.entries(WEEK_TYPE_PRESETS).map(([key,wt])=>(
                <button key={key} onClick={()=>applyWeekType(key)} style={{background:weekTypeKey===key?T.sage:T.white,color:weekTypeKey===key?"#fff":T.textDark,border:`2px solid ${weekTypeKey===key?T.sage:T.border}`,borderRadius:"0.9rem",padding:"0.75rem",cursor:"pointer",textAlign:"left",fontFamily:"inherit",transition:"all 0.15s"}}>
                  <div style={{fontSize:"1.3rem",marginBottom:"0.25rem"}}>{wt.emoji}</div>
                  <div style={{fontWeight:700,fontSize:"0.84rem"}}>{wt.label}</div>
                  <div style={{fontSize:"0.72rem",color:weekTypeKey===key?"rgba(255,255,255,0.8)":T.textSoft,fontWeight:500,marginTop:"0.15rem"}}>{wt.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={()=>setShowWeekTypePicker(false)} style={{...btnS({width:"100%",marginTop:"0.65rem",fontSize:"0.76rem"})}}>Close</button>
          </div>
        )}

        <div style={{display:"flex",gap:"0.35rem",marginBottom:"0.85rem",background:T.bgAlt,borderRadius:"0.8rem",padding:"0.28rem",border:`1px solid ${T.border}`,overflowX:"auto"}}>
          {subTabs.map(st=>(
            <button key={st.id} onClick={()=>setMealSubTab(st.id)} style={{flex:1,minWidth:"fit-content",background:mealSubTab===st.id?T.sage:"transparent",color:mealSubTab===st.id?"#fff":T.textMid,border:"none",borderRadius:"0.55rem",padding:"0.4rem 0.55rem",cursor:"pointer",fontSize:"0.73rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"0.3rem",justifyContent:"center"}}>
              {st.emoji} {st.label}
            </button>
          ))}
        </div>

        {mealSubTab==="week"&&(
          <div>
            <div style={{...card({padding:"0.85rem 1rem",background:T.sagePale,border:`2px solid ${T.sage}50`,marginBottom:"0.85rem"})}}>
              <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginBottom:"0.6rem"}}>
                {[{v:1,label:"Dinner Only",emoji:"🌙"},{v:2,label:"Lunch + Dinner",emoji:"☀️🌙"},{v:3,label:"All 3 Meals",emoji:"🌅☀️🌙"}].map(o=>(
                  <button key={o.v} onClick={()=>setMealCount(o.v)} style={{background:mealCount===o.v?T.sage:T.white,color:mealCount===o.v?"#fff":T.textMid,border:`2px solid ${mealCount===o.v?T.sage:T.border}`,borderRadius:"2rem",padding:"0.28rem 0.82rem",cursor:"pointer",fontSize:"0.74rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>{o.emoji} {o.label}</button>
                ))}
              </div>
              <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginBottom:"0.6rem"}}>
                {Object.entries(DM).map(([k,v])=>(
                  <button key={k} onClick={()=>setDietaryFilters(p=>p.includes(k)?p.filter(x=>x!==k):[...p,k])} style={{background:dietaryFilters.includes(k)?v.color:T.white,color:dietaryFilters.includes(k)?"#fff":T.textMid,border:`2px solid ${dietaryFilters.includes(k)?v.color:T.border}`,borderRadius:"2rem",padding:"0.26rem 0.75rem",cursor:"pointer",fontSize:"0.72rem",fontFamily:"inherit",fontWeight:700,transition:"all 0.15s"}}>{v.emoji} {k}</button>
                ))}
              </div>
              <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",alignItems:"center"}}>
                <label style={{display:"flex",alignItems:"center",gap:"0.4rem",cursor:"pointer",fontSize:"0.78rem",fontWeight:700,color:T.sageDark}}>
                  <div onClick={()=>setMealThemeEnabled(v=>!v)} style={{width:36,height:20,borderRadius:"2rem",background:mealThemeEnabled?T.sage:T.border,position:"relative",transition:"background 0.22s",cursor:"pointer",flexShrink:0}}>
                    <div style={{position:"absolute",top:3,left:mealThemeEnabled?17:3,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.22s"}}/>
                  </div>
                  Themed days
                </label>
                {mealThemeEnabled&&<button onClick={()=>setEditingThemes(true)} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.55rem"})}><Icon name="edit" size={11} color={T.textMid}/> Edit</button>}
                <button onClick={rotateMeals} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.55rem",display:"flex",alignItems:"center",gap:"0.25rem"})}><Icon name="rotate" size={11} color={T.textMid}/> Rotate</button>
                <button onClick={()=>setShowRecipeImport(true)} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.55rem",display:"flex",alignItems:"center",gap:"0.25rem"})}><Icon name="link" size={11} color={T.textMid}/> Import</button>
                <button onClick={()=>setShowRecipes(v=>!v)} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.55rem",display:"flex",alignItems:"center",gap:"0.25rem"})}><Icon name="recipe" size={11} color={T.textMid}/> Recipes ({recipes.length})</button>
              </div>
            </div>
            {showRecipes&&(
              <div style={{...card({border:`2px solid ${T.sand}50`,background:`linear-gradient(135deg,${T.sandPale},${T.surface})`})}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.05rem",color:T.textDark}}>My Recipes</span>
                  <button onClick={()=>setShowRecipeImport(true)} style={btnP(T.sand,{fontSize:"0.74rem",padding:"0.28rem 0.7rem"})}>+ Import</button>
                </div>
                {recipes.length===0&&<p style={{color:T.textFaint,fontSize:"0.8rem",fontWeight:600,textAlign:"center"}}>No recipes yet — import from a URL or add manually.</p>}
                {recipes.map(r=>(
                  <div key={r.id} style={{padding:"0.65rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontWeight:700,color:T.textDark,fontSize:"0.87rem"}}>{r.name}</div>
                        <div style={{color:T.textSoft,fontSize:"0.72rem",marginTop:"0.1rem"}}>{r.servings&&`${r.servings} servings · `}{r.time&&`${r.time} · `}{r.source&&`from ${r.source}`}</div>
                        {r.ingredients?.length>0&&<div style={{color:T.textMid,fontSize:"0.71rem",marginTop:"0.22rem"}}>{r.ingredients.slice(0,3).join(", ")}{r.ingredients.length>3?` +${r.ingredients.length-3} more`:""}</div>}
                      </div>
                      <button onClick={()=>setRecipes(p=>p.filter(x=>x.id!==r.id))} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><Icon name="trash" size={12} color={T.textFaint}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {MEAL_DAYS.map(day=>{
              const m=meals[day]||{};const isToday=day===TODAY_NAME;const themeDay=mealThemes[day];
              const bankMatch=MEAL_BANK_DATA.find(b=>b.name.toLowerCase()===(m.dinner||"").toLowerCase());
              return (
                <div key={day} style={{...card({borderLeft:`4px solid ${isToday?T.sage:T.borderSoft}`,background:isToday?`linear-gradient(to right,${T.sagePale},${T.surface})`:T.surface})}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.65rem"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,color:isToday?T.sageDark:T.textDark,fontSize:"0.93rem"}}>{day}</span>
                      {isToday&&<Pill label="Today" color={T.sage} tiny/>}
                      {mealThemeEnabled&&themeDay&&<span style={{fontSize:"0.66rem",fontWeight:700,color:T.sand,background:T.sandPale,borderRadius:"2rem",padding:"2px 8px",border:`1px solid ${T.sand}35`}}>{themeDay.emoji} {themeDay.theme}</span>}
                    </div>
                    <div style={{display:"flex",gap:"0.35rem"}}>
                      {isToday&&m.dinner&&<button onClick={()=>setMealSubTab("tonight")} style={btnP(T.sage,{fontSize:"0.7rem",padding:"0.26rem 0.6rem"})}>🌙 Tonight</button>}
                      <button onClick={()=>openEdit(day)} style={btnS({padding:"0.28rem 0.7rem",fontSize:"0.74rem",display:"flex",alignItems:"center",gap:"0.25rem"})}><Icon name="edit" size={11} color={T.textMid}/> Edit</button>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:`repeat(${MEALS_TO_SHOW.length},1fr)`,gap:"0.45rem"}}>
                    {MEALS_TO_SHOW.map(meal=>(
                      <div key={meal} style={{background:T.white,borderRadius:"0.65rem",padding:"0.58rem 0.7rem",border:`1.5px solid ${T.borderSoft}`}}>
                        <div style={{fontSize:"0.6rem",color:T.textMid,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:800,marginBottom:"0.18rem"}}>{meal}</div>
                        <div style={{fontSize:"0.82rem",color:m[meal]?T.textDark:T.textFaint,fontWeight:m[meal]?700:400}}>{m[meal]||"—"}</div>
                      </div>
                    ))}
                  </div>
                  {bankMatch&&(
                    <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginTop:"0.55rem",alignItems:"center"}}>
                      <span style={{fontSize:"0.65rem",color:T.textSoft,fontWeight:600}}>⏱ {bankMatch.time} min · 🧹 {bankMatch.cleanup}</span>
                      {bankMatch.tags.slice(0,3).map(tag=>{const tf=MEAL_TAG_FILTERS.find(t=>t.id===tag);return tf?<span key={tag} style={{fontSize:"0.62rem",color:T.sage,background:T.sagePale,borderRadius:"2rem",padding:"1px 7px",fontWeight:600,border:`1px solid ${T.sage}30`}}>{tf.emoji} {tf.label}</span>:null;})}
                    </div>
                  )}
                  {m.notes&&<div style={{marginTop:"0.5rem",fontSize:"0.77rem",color:T.textMid,fontStyle:"italic"}}>📝 {m.notes}</div>}
                </div>
              );
            })}
          </div>
        )}

        {mealSubTab==="tonight"&&(
          <div>
            {tonightMealData?(
              <div>
                <div style={{...card({background:`linear-gradient(135deg,${T.sagePale},${T.surface})`,border:`2px solid ${T.sage}60`,padding:"1.25rem"})}}>
                  <div style={{fontSize:"0.65rem",color:T.sageDark,textTransform:"uppercase",letterSpacing:"0.12em",fontWeight:800,marginBottom:"0.3rem"}}>Tonight · {TODAY_NAME}</div>
                  <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.6rem",fontWeight:700,color:T.textDark,margin:"0 0 0.35rem"}}>{tonightMealData.name}</h2>
                  <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                    <span style={{fontSize:"0.72rem",fontWeight:600,color:T.textMid}}>⏱ {tonightMealData.time} min</span>
                    <span style={{fontSize:"0.72rem",fontWeight:600,color:T.textMid}}>· 🧹 {tonightMealData.cleanup}</span>
                    <span style={{fontSize:"0.72rem"}}>{"⭐".repeat(tonightMealData.kidRating)} kid rating</span>
                  </div>
                </div>
                <div style={{...card()}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.1rem",color:T.textDark,marginBottom:"0.65rem"}}>You'll Need</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem"}}>
                    {tonightMealData.ingredients.map((ing,i)=>(
                      <span key={i} style={{fontSize:"0.8rem",fontWeight:600,color:T.textDark,background:T.sandPale,border:`1px solid ${T.sand}40`,borderRadius:"2rem",padding:"0.22rem 0.75rem"}}>{ing}</span>
                    ))}
                  </div>
                </div>
                <div style={{...card()}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:"1.1rem",color:T.textDark,marginBottom:"0.75rem"}}>How to Make It</div>
                  {tonightMealData.steps.map((step,i)=>(
                    <div key={i} style={{display:"flex",gap:"0.75rem",marginBottom:"0.6rem",alignItems:"flex-start"}}>
                      <div style={{width:24,height:24,borderRadius:"50%",background:T.sage,color:"#fff",fontSize:"0.72rem",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</div>
                      <span style={{fontSize:"0.86rem",color:T.textDark,fontWeight:500,lineHeight:1.55}}>{step}</span>
                    </div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.55rem",marginBottom:"0.55rem"}}>
                  <div style={{...card({background:T.bluePale,border:`1.5px solid ${T.blue}40`,padding:"0.85rem"})}}>
                    <div style={{fontSize:"0.68rem",fontWeight:800,color:T.blueDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.35rem"}}>💡 Easy Swap</div>
                    <div style={{fontSize:"0.8rem",color:T.textDark,fontWeight:500,lineHeight:1.5}}>{tonightMealData.swap}</div>
                  </div>
                  <div style={{...card({background:T.rosePale,border:`1.5px solid ${T.rose}40`,padding:"0.85rem"})}}>
                    <div style={{fontSize:"0.68rem",fontWeight:800,color:T.roseDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.35rem"}}>😮‍💨 If Overwhelmed</div>
                    <div style={{fontSize:"0.8rem",color:T.textDark,fontWeight:500,lineHeight:1.5}}>{tonightMealData.skip}</div>
                  </div>
                </div>
                <div style={{...card({background:T.sandPale,border:`1.5px solid ${T.sand}40`,padding:"0.85rem"})}}>
                  <div style={{fontSize:"0.68rem",fontWeight:800,color:T.sandDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.3rem"}}>🍱 Leftovers</div>
                  <div style={{fontSize:"0.82rem",color:T.textDark,fontWeight:500}}>{tonightMealData.leftovers}</div>
                </div>
              </div>
            ):(
              <div style={{...card({textAlign:"center",padding:"2rem"})}}>
                <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>🌙</div>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark,marginBottom:"0.4rem"}}>No dinner set for tonight</p>
                <p style={{color:T.textMid,fontSize:"0.83rem",marginBottom:"1rem"}}>Head to This Week to plan {TODAY_NAME}'s dinner, or use Rescue Mode.</p>
                <div style={{display:"flex",gap:"0.5rem",justifyContent:"center",flexWrap:"wrap"}}>
                  <button onClick={()=>setMealSubTab("week")} style={btnP(T.sage)}>Plan This Week</button>
                  <button onClick={()=>setMealSubTab("rescue")} style={btnP(T.rose)}>🆘 Rescue Mode</button>
                </div>
              </div>
            )}
          </div>
        )}

        {mealSubTab==="bank"&&(
          <div>
            <p style={{color:T.textMid,fontSize:"0.82rem",fontWeight:500,marginBottom:"0.65rem",lineHeight:1.55}}>Filter by what you need tonight. Tap a meal to see details.</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",marginBottom:"0.85rem"}}>
              {MEAL_TAG_FILTERS.map(tf=>(
                <button key={tf.id} onClick={()=>setBankFilters(p=>p.includes(tf.id)?p.filter(x=>x!==tf.id):[...p,tf.id])} style={{background:bankFilters.includes(tf.id)?T.sage:T.white,color:bankFilters.includes(tf.id)?"#fff":T.textMid,border:`1.5px solid ${bankFilters.includes(tf.id)?T.sage:T.border}`,borderRadius:"2rem",padding:"0.26rem 0.72rem",cursor:"pointer",fontSize:"0.72rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s"}}>
                  {tf.emoji} {tf.label}
                </button>
              ))}
              {bankFilters.length>0&&<button onClick={()=>setBankFilters([])} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:"0.72rem",fontFamily:"inherit",fontWeight:600}}>Clear</button>}
            </div>
            <p style={{color:T.textSoft,fontSize:"0.75rem",fontWeight:500,marginBottom:"0.65rem"}}>{filteredBank.length} meal{filteredBank.length!==1?"s":""} match</p>
            {filteredBank.map(m=>(
              <div key={m.id} onClick={()=>setSelectedBankMeal(selectedBankMeal===m.id?null:m.id)} style={{...card({cursor:"pointer",borderLeft:`4px solid ${selectedBankMeal===m.id?T.sage:T.borderSoft}`,background:selectedBankMeal===m.id?`linear-gradient(to right,${T.sagePale},${T.surface})`:T.surface,transition:"all 0.15s"})}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"0.5rem"}}>
                  <div>
                    <div style={{fontWeight:700,color:T.textDark,fontSize:"0.92rem"}}>{m.name}</div>
                    <div style={{display:"flex",gap:"0.5rem",marginTop:"0.2rem"}}>
                      <span style={{fontSize:"0.69rem",color:T.textSoft,fontWeight:600}}>⏱ {m.time} min · 🧹 {m.cleanup} · {"⭐".repeat(m.kidRating)}</span>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"0.3rem",marginTop:"0.4rem"}}>
                      {m.tags.slice(0,4).map(tag=>{const tf=MEAL_TAG_FILTERS.find(t=>t.id===tag);return tf?<span key={tag} style={{fontSize:"0.62rem",color:T.sage,background:T.sagePale,borderRadius:"2rem",padding:"1px 7px",fontWeight:600,border:`1px solid ${T.sage}30`}}>{tf.emoji} {tf.label}</span>:null;})}
                    </div>
                  </div>
                  <Icon name={selectedBankMeal===m.id?"chevD":"chevR"} size={16} color={T.textSoft}/>
                </div>
                {selectedBankMeal===m.id&&(
                  <div style={{marginTop:"0.85rem",paddingTop:"0.85rem",borderTop:`1px solid ${T.borderSoft}`}}>
                    <div style={{fontSize:"0.72rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.4rem"}}>Ingredients</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"0.35rem",marginBottom:"0.75rem"}}>
                      {m.ingredients.map((ing,i)=><span key={i} style={{fontSize:"0.77rem",color:T.textDark,background:T.sandPale,border:`1px solid ${T.sand}30`,borderRadius:"2rem",padding:"1px 8px",fontWeight:500}}>{ing}</span>)}
                    </div>
                    <div style={{fontSize:"0.72rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.4rem"}}>Steps</div>
                    {m.steps.map((step,i)=>(
                      <div key={i} style={{display:"flex",gap:"0.6rem",marginBottom:"0.4rem",alignItems:"flex-start"}}>
                        <div style={{width:20,height:20,borderRadius:"50%",background:T.sage,color:"#fff",fontSize:"0.65rem",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                        <span style={{fontSize:"0.82rem",color:T.textDark,fontWeight:500,lineHeight:1.5}}>{step}</span>
                      </div>
                    ))}
                    <div style={{background:T.bluePale,border:`1px solid ${T.blue}30`,borderRadius:"0.6rem",padding:"0.55rem 0.75rem",marginTop:"0.5rem",fontSize:"0.78rem",color:T.textDark,fontWeight:500}}>💡 <strong>Swap:</strong> {m.swap}</div>
                    <div style={{marginTop:"0.65rem",display:"flex",gap:"0.45rem"}}>
                      <button onClick={e=>{e.stopPropagation();setMeals(p=>({...p,[TODAY_NAME]:{...(p[TODAY_NAME]||{}),dinner:m.name}}));setMealSubTab("tonight");}} style={btnP(T.sage,{fontSize:"0.76rem",padding:"0.35rem 0.8rem"})}>🌙 Make Tonight</button>
                      <button onClick={e=>{e.stopPropagation();openEdit(TODAY_NAME);}} style={btnS({fontSize:"0.76rem",padding:"0.35rem 0.75rem"})}>Add to Week</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredBank.length===0&&<div style={{...card({textAlign:"center",padding:"1.5rem"})}}>
              <p style={{color:T.textMid,fontWeight:600,fontSize:"0.85rem"}}>No meals match those filters. Try removing one.</p>
            </div>}
          </div>
        )}

        {mealSubTab==="prep"&&(
          <div>
            <div style={{...card({background:`linear-gradient(135deg,${T.sagePale},${T.bluePale})`,border:`2px solid ${T.sage}55`,padding:"1.2rem",textAlign:"center"})}}>
              <div style={{fontSize:"2rem",marginBottom:"0.4rem"}}>🫙</div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,margin:"0 0 0.35rem"}}>This Week's Prep</h2>
              <p style={{color:T.textMid,fontSize:"0.83rem",lineHeight:1.6,maxWidth:280,margin:"0 auto"}}>20 minutes on Sunday changes everything.</p>
            </div>
            {activePrepTasks.map(t=>{
              const done=prepChecked.includes(t.id);
              return (
                <button key={t.id} onClick={()=>setPrepChecked(p=>p.includes(t.id)?p.filter(x=>x!==t.id):[...p,t.id])} style={{...card({cursor:"pointer",display:"flex",alignItems:"center",gap:"0.9rem",padding:"1rem 1.1rem",background:done?`linear-gradient(135deg,${T.sagePale},${T.sage}15)`:T.surface,border:`2px solid ${done?T.sage:T.borderSoft}`,width:"100%",textAlign:"left",transition:"all 0.18s"})}}>
                  <span style={{fontSize:"1.4rem"}}>{t.emoji}</span>
                  <span style={{flex:1,fontWeight:600,color:done?T.sageDark:T.textDark,fontSize:"0.88rem",textDecoration:done?"line-through":"none"}}>{t.text}</span>
                  <div style={{width:24,height:24,borderRadius:"50%",border:`2.5px solid ${done?T.sage:T.border}`,background:done?T.sage:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.18s"}}>{done&&<Icon name="check" size={12} color="#fff"/>}</div>
                </button>
              );
            })}
            {prepChecked.length===activePrepTasks.length&&activePrepTasks.length>0&&(
              <div style={{...card({background:`linear-gradient(135deg,${T.sagePale},${T.bluePale})`,border:`2px solid ${T.sage}60`,textAlign:"center",padding:"1.5rem"})}}>
                <p style={{color:T.sageDark,fontWeight:700,fontSize:"1rem"}}>🌿 Prep complete. This week is going to be so much easier.</p>
              </div>
            )}
            <div style={{...card({background:T.sandPale,border:`1.5px solid ${T.sand}40`,padding:"0.9rem"})}}>
              <div style={{fontSize:"0.68rem",fontWeight:800,color:T.sandDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.35rem"}}>💡 Skip this if needed</div>
              <p style={{color:T.textMid,fontSize:"0.8rem",lineHeight:1.58}}>Buy pre-cut produce, microwave rice pouches, and rotisserie chicken. No-prep weeks are valid weeks.</p>
            </div>
          </div>
        )}

        {mealSubTab==="rescue"&&(
          <div>
            <div style={{...card({background:`linear-gradient(135deg,${T.rosePale},${T.sandPale})`,border:`2px solid ${T.rose}50`,padding:"1.2rem",textAlign:"center"})}}>
              <div style={{fontSize:"2rem",marginBottom:"0.4rem"}}>🆘</div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.4rem",fontWeight:700,color:T.textDark,margin:"0 0 0.3rem"}}>What Can I Make Tonight?</h2>
              <p style={{color:T.textMid,fontSize:"0.82rem",lineHeight:1.6,maxWidth:280,margin:"0 auto"}}>Tell me what you have. I'll find something.</p>
            </div>
            <div style={{...card()}}>
              <label style={lbl}>What's in your fridge / pantry?</label>
              <textarea value={rescueInput} onChange={e=>setRescueInput(e.target.value)} placeholder="e.g. chicken, rice, black beans, avocado, tortillas, eggs…" style={{...inp({height:80,resize:"none",marginBottom:"0.75rem"})}}/>
              <button onClick={findRescueMeals} disabled={!rescueInput.trim()||rescueLoading} style={btnP(T.rose,{width:"100%",justifyContent:"center",display:"flex",opacity:!rescueInput.trim()||rescueLoading?0.5:1,fontSize:"0.88rem",padding:"0.65rem"})}>
                {rescueLoading?"Finding meals…":"🆘 Find My Dinner"}
              </button>
            </div>
            {rescueResults&&rescueResults.length>0&&(
              <div>
                <p style={{color:T.textSoft,fontSize:"0.78rem",fontWeight:600,marginBottom:"0.55rem"}}>You can make any of these right now:</p>
                {rescueResults.map((r,i)=>(
                  <div key={i} style={{...card({borderLeft:`4px solid ${T.rose}`,background:`linear-gradient(to right,${T.rosePale},${T.surface})`})}}>
                    <div style={{fontWeight:700,color:T.textDark,fontSize:"0.92rem",marginBottom:"0.3rem"}}>{r.name}</div>
                    <div style={{color:T.textMid,fontSize:"0.8rem",lineHeight:1.5}}>{r.desc}</div>
                    <button onClick={()=>{setMeals(p=>({...p,[TODAY_NAME]:{...(p[TODAY_NAME]||{}),dinner:r.name}}));setMealSubTab("tonight");}} style={btnP(T.rose,{fontSize:"0.74rem",padding:"0.3rem 0.75rem",marginTop:"0.65rem"})}>🌙 Make This Tonight</button>
                  </div>
                ))}
              </div>
            )}
            {rescueResults&&rescueResults.length===0&&<div style={{...card({textAlign:"center",padding:"1.5rem"})}}>
              <p style={{color:T.textMid,fontWeight:600}}>Couldn't find meals with those ingredients. Try adding a protein or pantry staple.</p>
            </div>}
          </div>
        )}

        {editDay&&(
          <ModalBox title={`Meals for ${editDay}`} onClose={()=>setEditDay(null)}>
            {mealThemeEnabled&&mealThemes[editDay]&&<div style={{background:T.sandPale,border:`1px solid ${T.sand}40`,borderRadius:"0.65rem",padding:"0.5rem 0.8rem",marginBottom:"0.85rem",display:"flex",alignItems:"center",gap:"0.5rem"}}><span style={{fontSize:"1.1rem"}}>{mealThemes[editDay].emoji}</span><span style={{fontSize:"0.82rem",fontWeight:700,color:T.sandDark}}>{mealThemes[editDay].theme}</span></div>}
            {MEALS_TO_SHOW.map(m=>(
              <div key={m} style={{marginBottom:"0.9rem"}}>
                <label style={lbl}>{m}</label>
                <div style={{display:"flex",gap:"0.4rem"}}>
                  <input value={editMeal[m]||""} onChange={e=>setEditMeal(p=>({...p,[m]:e.target.value}))} placeholder={`${m[0].toUpperCase()+m.slice(1)}…`} style={{...inp({flex:1})}}/>
                  {recipes.length>0&&<select onChange={e=>{if(e.target.value){const r=recipes.find(x=>x.id===e.target.value);if(r)setEditMeal(p=>({...p,[m]:r.name}));e.target.value=""}}} style={{...inp({width:"auto",flex:"none",fontSize:"0.74rem"})}}>
                    <option value="">From recipes…</option>
                    {recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>}
                </div>
              </div>
            ))}
            <div style={{marginBottom:"0.9rem"}}><label style={lbl}>Notes</label><textarea value={editMeal.notes||""} onChange={e=>setEditMeal(p=>({...p,notes:e.target.value}))} placeholder="Dietary notes, prep reminders…" style={{...inp({height:65,resize:"none"})}}/></div>
            <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}><button onClick={()=>setEditDay(null)} style={btnS()}>Cancel</button><button onClick={saveEdit} style={btnP(T.sage)}>Save</button></div>
          </ModalBox>
        )}
        {editingThemes&&(
          <ModalBox title="Themed Days" onClose={()=>setEditingThemes(false)} wide>
            {MEAL_DAYS.map(day=>(
              <div key={day} style={{display:"flex",gap:"0.5rem",alignItems:"center",marginBottom:"0.55rem"}}>
                <span style={{minWidth:90,fontSize:"0.82rem",fontWeight:700,color:T.textMid}}>{day}</span>
                <input value={mealThemes[day]?.emoji||""} onChange={e=>setMealThemes(p=>({...p,[day]:{...p[day],emoji:e.target.value}}))} style={{...inp({width:52,textAlign:"center",fontSize:"1.1rem",padding:"0.35rem"})}} placeholder="🍽️"/>
                <input value={mealThemes[day]?.theme||""} onChange={e=>setMealThemes(p=>({...p,[day]:{...p[day],theme:e.target.value}}))} style={{...inp({flex:1})}} placeholder="e.g. Taco Tuesday"/>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:"1rem"}}><button onClick={()=>setEditingThemes(false)} style={btnP(T.sage)}>Done</button></div>
          </ModalBox>
        )}
        {showRecipeImport&&(
          <ModalBox title="Import Recipe" onClose={()=>{setShowRecipeImport(false);setRecipeResult(null);setRecipeError("");setRecipeUrl("");}} wide>
            <div style={{marginBottom:"0.9rem"}}>
              <label style={lbl}>Paste a URL</label>
              <p style={{color:T.textSoft,fontSize:"0.77rem",marginBottom:"0.6rem",lineHeight:1.5}}>Works with recipe websites and Pinterest. For TikTok/Instagram, paste ingredients manually below.</p>
              <div style={{display:"flex",gap:"0.5rem"}}>
                <input value={recipeUrl} onChange={e=>setRecipeUrl(e.target.value)} placeholder="https://..." style={{...inp({flex:1})}}/>
                <button onClick={importRecipeFromUrl} disabled={recipeLoading||!recipeUrl.trim()} style={btnP(T.blue,{flexShrink:0,opacity:recipeLoading||!recipeUrl.trim()?0.5:1})}>{recipeLoading?"…":"Import"}</button>
              </div>
              {recipeError&&<p style={{color:T.rose,fontSize:"0.77rem",marginTop:"0.4rem"}}>{recipeError}</p>}
            </div>
            {recipeResult&&(
              <div style={{...card({background:T.sagePale,border:`2px solid ${T.sage}50`,marginBottom:"0.9rem"})}}>
                <p style={{fontWeight:700,color:T.sageDark,fontSize:"0.95rem",marginBottom:"0.4rem"}}>✓ Found: {recipeResult.name}</p>
                <p style={{fontSize:"0.78rem",color:T.textMid}}>{recipeResult.ingredients?.length} ingredients · {recipeResult.servings||"?"} servings · {recipeResult.time||"?"}</p>
                <button onClick={saveImportedRecipe} style={{...btnP(T.sage,{marginTop:"0.65rem",display:"flex",alignItems:"center",gap:"0.4rem"})}}><Icon name="check" size={14} color="#fff"/> Save Recipe</button>
              </div>
            )}
            <div style={{borderTop:`1px solid ${T.borderSoft}`,paddingTop:"0.9rem"}}>
              <label style={lbl}>Or enter manually</label>
              <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
                <input value={manualRecipe.name} onChange={e=>setManualRecipe(p=>({...p,name:e.target.value}))} placeholder="Recipe name" style={inp()}/>
                <textarea value={manualRecipe.ingredients} onChange={e=>setManualRecipe(p=>({...p,ingredients:e.target.value}))} placeholder="Ingredients (one per line)" style={{...inp({height:80,resize:"none"})}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
                  <input value={manualRecipe.servings} onChange={e=>setManualRecipe(p=>({...p,servings:e.target.value}))} placeholder="Servings" style={inp()}/>
                  <input value={manualRecipe.source} onChange={e=>setManualRecipe(p=>({...p,source:e.target.value}))} placeholder="Source" style={inp()}/>
                </div>
                <textarea value={manualRecipe.notes} onChange={e=>setManualRecipe(p=>({...p,notes:e.target.value}))} placeholder="Notes or instructions" style={{...inp({height:65,resize:"none"})}}/>
                <button onClick={saveManualRecipe} disabled={!manualRecipe.name.trim()} style={btnP(T.blue,{opacity:manualRecipe.name.trim()?1:0.5})}>Save Recipe</button>
              </div>
            </div>
          </ModalBox>
        )}
      </div>
    );
  }

  // ── SHOPPING TAB (voice + photo) ──────────────────────────────────────────
  function ShoppingTab(){
    const[newItem,setNewItem]=useState("");
    const[newStore,setNewStore]=useState(stores[0]);
    const[addingStore,setAddingStore]=useState(false);
    const[newStoreName,setNewStoreName]=useState("");
    const[isListening,setIsListening]=useState(false);
    const[voiceStatus,setVoiceStatus]=useState("");
    const[isAnalyzingPhoto,setIsAnalyzingPhoto]=useState(false);
    const[photoStatus,setPhotoStatus]=useState("");
    const recognitionRef=useRef(null);
    const photoInputRef=useRef(null);
    const STORE_COLORS=[T.blue,T.sage,T.sand,T.rose,T.lavender,"#e8a838","#7ab8a8","#c878a8"];

    function toggleCollapse(store){setCollapsedStores(p=>({...p,[store]:!p[store]}));}
    function addItem(text,store,photoUrl){if(!text.trim())return;setShoppingItems(p=>[...p,{id:uid(),text:text.trim(),store:store||newStore,done:false,photo:photoUrl||null}]);setNewItem("");}
    function addStore(){if(!newStoreName.trim())return;const ns=newStoreName.trim();setStores(p=>[...p,ns]);setNewStore(ns);setNewStoreName("");setAddingStore(false);}

    function startListening(){
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR){setVoiceStatus("Voice input not supported. Try Chrome.");return;}
      const recognition=new SR();recognitionRef.current=recognition;
      recognition.continuous=false;recognition.interimResults=true;recognition.lang="en-US";
      recognition.onstart=()=>{setIsListening(true);setVoiceStatus("Listening… say your item");};
      recognition.onresult=e=>{
        const transcript=Array.from(e.results).map(r=>r[0].transcript).join("");
        setVoiceStatus(`Heard: "${transcript}"`);
        if(e.results[0].isFinal){
          const items=transcript.split(/\band\b/i).map(s=>s.trim()).filter(Boolean);
          items.forEach(item=>addItem(item,newStore));
          setIsListening(false);setVoiceStatus(`✓ Added ${items.length} item${items.length>1?"s":""}`);
          setTimeout(()=>setVoiceStatus(""),2500);
        }
      };
      recognition.onerror=e=>{setIsListening(false);setVoiceStatus(e.error==="not-allowed"?"Microphone access denied.":`Error: ${e.error}`);setTimeout(()=>setVoiceStatus(""),3000);};
      recognition.onend=()=>setIsListening(false);
      recognition.start();
    }
    function stopListening(){recognitionRef.current?.stop();setIsListening(false);}

    async function handlePhotoUpload(e){
      const file=e.target.files?.[0];if(!file)return;
      setIsAnalyzingPhoto(true);setPhotoStatus("Analyzing photo…");
      const base64=await new Promise(res=>{const reader=new FileReader();reader.onload=()=>res(reader.result.split(",")[1]);reader.readAsDataURL(file);});
      const photoUrl=URL.createObjectURL(file);
      try{
        const r=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          model:"claude-sonnet-4-20250514",max_tokens:300,
          system:`You are a grocery list assistant. Given an image, identify the grocery item and return ONLY JSON: {"name":"","category":""}. Category: produce/protein/dairy/pantry/frozen/bakery/extras. Keep name short like a grocery list item. If unclear, return {"name":"Item from photo","category":"extras"}.`,
          messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:base64}},{type:"text",text:"What grocery item is in this photo?"}]}]
        })});
        const d=await r.json();
        const txt=d.content?.find(b=>b.type==="text")?.text||'{"name":"Item from photo","category":"extras"}';
        const parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());
        const itemName=parsed.name||"Item from photo";
        setShoppingItems(p=>[...p,{id:uid(),text:itemName,store:newStore,done:false,photo:photoUrl}]);
        setPhotoStatus(`✓ Added "${itemName}" with photo`);
      }catch{
        setShoppingItems(p=>[...p,{id:uid(),text:"Item from photo",store:newStore,done:false,photo:photoUrl}]);
        setPhotoStatus("✓ Added item with photo");
      }
      setIsAnalyzingPhoto(false);setTimeout(()=>setPhotoStatus(""),3000);e.target.value="";
    }

    return(
      <div>
        <SecHead emoji="🛒" title="Shopping Lists" sub={`${shoppingItems.filter(i=>!i.done).length} items remaining`}/>
        <div style={{...card({background:T.sandPale,border:`2px solid ${T.sand}55`})}}>
          <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginBottom:"0.6rem"}}>
            <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addItem(newItem,newStore);}} placeholder="Add item…" style={{...inp({flex:1,minWidth:120})}}/>
            <select value={newStore} onChange={e=>setNewStore(e.target.value)} style={{...inp({width:"auto",flex:"none"})}}>
              {stores.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={()=>addItem(newItem,newStore)} style={btnP(T.sand)}>Add</button>
          </div>
          <div style={{display:"flex",gap:"0.5rem",alignItems:"center",flexWrap:"wrap",marginBottom:"0.5rem"}}>
            <button onClick={isListening?stopListening:startListening} style={{background:isListening?T.rose:T.blue,color:"#fff",border:"none",borderRadius:"0.7rem",padding:"0.5rem 0.9rem",cursor:"pointer",fontSize:"0.8rem",fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.4rem",transition:"all 0.15s",boxShadow:isListening?`0 0 0 3px ${T.rose}40`:"none"}}>
              <span style={{fontSize:"1rem"}}>{isListening?"⏹":"🎙️"}</span>{isListening?"Stop":"Speak Item"}
            </button>
            <button onClick={()=>photoInputRef.current?.click()} disabled={isAnalyzingPhoto} style={{background:T.sage,color:"#fff",border:"none",borderRadius:"0.7rem",padding:"0.5rem 0.9rem",cursor:isAnalyzingPhoto?"wait":"pointer",fontSize:"0.8rem",fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.4rem",opacity:isAnalyzingPhoto?0.65:1,transition:"all 0.15s"}}>
              <span style={{fontSize:"1rem"}}>📷</span>{isAnalyzingPhoto?"Analyzing…":"Photo to List"}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} style={{display:"none"}}/>
            <span style={{fontSize:"0.72rem",color:T.textSoft,fontWeight:500}}>→ {newStore}</span>
          </div>
          {(voiceStatus||photoStatus)&&(
            <div style={{background:T.white,border:`1.5px solid ${T.border}`,borderRadius:"0.6rem",padding:"0.45rem 0.75rem",fontSize:"0.78rem",color:T.textMid,fontWeight:600,display:"flex",alignItems:"center",gap:"0.5rem"}}>
              {(isListening||isAnalyzingPhoto)&&<div style={{width:8,height:8,borderRadius:"50%",background:isListening?T.rose:T.sage,animation:"bounce 0.8s infinite"}}/>}
              {voiceStatus||photoStatus}
            </div>
          )}
          <div style={{marginTop:"0.5rem"}}>
            {addingStore?(
              <div style={{display:"flex",gap:"0.5rem",alignItems:"center"}}>
                <input value={newStoreName} onChange={e=>setNewStoreName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addStore();}} placeholder="Store name…" style={{...inp({flex:1})}} autoFocus/>
                <button onClick={addStore} style={btnP(T.sage,{padding:"0.45rem 0.85rem"})}>Add</button>
                <button onClick={()=>setAddingStore(false)} style={btnS({padding:"0.45rem 0.85rem"})}>Cancel</button>
              </div>
            ):(
              <button onClick={()=>setAddingStore(true)} style={{background:"none",border:`1.5px dashed ${T.sand}`,color:T.sandDark,borderRadius:"0.6rem",padding:"0.28rem 0.7rem",cursor:"pointer",fontSize:"0.74rem",fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                <Icon name="plus" size={11} color={T.sandDark}/> Add Store
              </button>
            )}
          </div>
        </div>
        <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.5rem",justifyContent:"flex-end"}}>
          <button onClick={()=>setCollapsedStores(stores.reduce((a,s)=>({...a,[s]:true}),{}))} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.6rem"})}>Collapse All</button>
          <button onClick={()=>setCollapsedStores({})} style={btnS({fontSize:"0.7rem",padding:"0.22rem 0.6rem"})}>Expand All</button>
        </div>
        {stores.map((store,si)=>{
          const items=shoppingItems.filter(i=>i.store===store);
          const accent=STORE_COLORS[si%STORE_COLORS.length];
          const isCollapsed=!!collapsedStores[store];
          const pendingCount=items.filter(i=>!i.done).length;
          const doneCount=items.filter(i=>i.done).length;
          return(
            <div key={store} style={{...card({borderLeft:`4px solid ${accent}`,padding:"0"})}}>
              <div onClick={()=>toggleCollapse(store)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0.9rem 1.1rem",cursor:"pointer",userSelect:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.55rem"}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:accent,flexShrink:0}}/>
                  <span style={{fontWeight:700,color:T.textDark,fontSize:"0.93rem"}}>{store}</span>
                </div>
                <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
                  {doneCount>0&&<Pill label={`${doneCount} done`} color={T.sage} tiny/>}
                  <Pill label={pendingCount===0?"All done!":pendingCount===1?"1 left":`${pendingCount} left`} color={pendingCount===0?T.sage:accent} tiny/>
                  {!["Grocery Store","Costco","Target","Amazon"].includes(store)&&<button onClick={e=>{e.stopPropagation();setStores(p=>p.filter(s=>s!==store));setShoppingItems(p=>p.filter(i=>i.store!==store));}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.textFaint}/></button>}
                  <div style={{display:"flex",transition:"transform 0.2s",transform:isCollapsed?"rotate(-90deg)":"rotate(0deg)"}}><Icon name="chevD" size={16} color={T.textSoft}/></div>
                </div>
              </div>
              {!isCollapsed&&(
                <div style={{padding:"0 1.1rem 0.9rem",borderTop:`1px solid ${T.borderSoft}`}}>
                  {items.length===0&&<p style={{color:T.textFaint,fontSize:"0.78rem",fontWeight:600,padding:"0.6rem 0"}}>Nothing here yet</p>}
                  {items.map(item=>(
                    <ShopItemRow key={item.id} item={item}
                      onToggle={id=>setShoppingItems(p=>p.map(x=>x.id===id?{...x,done:!x.done}:x))}
                      onDelete={id=>setShoppingItems(p=>p.filter(x=>x.id!==id))}
                      onSave={(id,val)=>setShoppingItems(p=>p.map(x=>x.id===id?{...x,text:val}:x))}/>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {shoppingItems.some(i=>i.done)&&<button onClick={()=>setShoppingItems(p=>p.filter(i=>!i.done))} style={{...btnS({width:"100%",color:T.rose,borderColor:T.rose+"66",fontWeight:700})}}>Clear completed items</button>}
      </div>
    );
  }

  function HomeTab(){
    const SYSTEM_COLORS=[T.blue,T.sage,T.sand,T.rose,T.lavender,"#7ab8a8","#e8a838","#c878a8"];
    const[editingSystem,setEditingSystem]=useState(null);
    const[editForm,setEditForm]=useState({label:"",emoji:"",items:[]});
    const[newItemText,setNewItemText]=useState("");
    const sysDrag=useRef(null),sysOver=useRef(null);
    const itemDrag=useRef(null),itemOver=useRef(null);
    function sysDragStart(e,i){sysDrag.current=i;e.dataTransfer.effectAllowed="move";e.currentTarget.style.opacity="0.5";}
    function sysDragEnter(i){sysOver.current=i;}
    function sysDragEnd(e){e.currentTarget.style.opacity="1";if(sysDrag.current===null||sysOver.current===null||sysDrag.current===sysOver.current){sysDrag.current=null;sysOver.current=null;return;}const next=[...homeSystems];const[m]=next.splice(sysDrag.current,1);next.splice(sysOver.current,0,m);setHomeSystems(next);sysDrag.current=null;sysOver.current=null;}
    function itemDragStart(e,i){itemDrag.current=i;e.dataTransfer.effectAllowed="move";e.currentTarget.style.opacity="0.5";}
    function itemDragEnter(i){itemOver.current=i;}
    function itemDragEnd(e){e.currentTarget.style.opacity="1";if(itemDrag.current===null||itemOver.current===null||itemDrag.current===itemOver.current){itemDrag.current=null;itemOver.current=null;return;}const next=[...editForm.items];const[m]=next.splice(itemDrag.current,1);next.splice(itemOver.current,0,m);setEditForm(p=>({...p,items:next}));itemDrag.current=null;itemOver.current=null;}
    function openEdit(sys){setEditingSystem(sys.id);setEditForm({label:sys.label,emoji:sys.emoji,items:[...sys.items]});setNewItemText("");}
    function openNew(){setEditingSystem("new");setEditForm({label:"",emoji:"🏡",items:[]});setNewItemText("");}
    function saveSystem(){if(!editForm.label.trim())return;if(editingSystem==="new")setHomeSystems(p=>[...p,{id:uid(),label:editForm.label.trim(),emoji:editForm.emoji,items:editForm.items}]);else setHomeSystems(p=>p.map(s=>s.id===editingSystem?{...s,label:editForm.label,emoji:editForm.emoji,items:editForm.items}:s));setEditingSystem(null);}
    function addEditItem(){if(!newItemText.trim())return;setEditForm(p=>({...p,items:[...p.items,newItemText.trim()]}));setNewItemText("");}
    return(
      <div>
        <SecHead emoji="🏠" title="Home Systems" sub="Rhythms that keep life running" action={<button onClick={openNew} style={{...btnP(T.sage,{display:"flex",alignItems:"center",gap:"0.4rem",fontSize:"0.8rem",padding:"0.42rem 0.85rem"})}}><Icon name="plus" size={14} color="#fff"/> Add System</button>}/>
        {homeSystems.map((sys,i)=>(
          <div key={sys.id} draggable onDragStart={e=>sysDragStart(e,i)} onDragEnter={()=>sysDragEnter(i)} onDragEnd={sysDragEnd} onDragOver={e=>e.preventDefault()} style={{...card({borderLeft:`4px solid ${SYSTEM_COLORS[i%SYSTEM_COLORS.length]}`,cursor:"grab"})}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.55rem",marginBottom:"0.85rem"}}>
              <div style={{opacity:0.35,flexShrink:0}}><Icon name="drag" size={14} color={T.textSoft}/></div>
              <span style={{fontSize:"1.15rem"}}>{sys.emoji}</span>
              <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark,flex:1}}>{sys.label}</h2>
              <button onClick={()=>openEdit(sys)} style={{background:T.bgAlt,border:`1px solid ${T.border}`,borderRadius:"0.5rem",cursor:"pointer",padding:"4px 9px",display:"flex",alignItems:"center",gap:"0.3rem",fontSize:"0.72rem",color:T.textMid,fontWeight:700,fontFamily:"inherit"}}><Icon name="edit" size={12} color={T.textMid}/> Edit</button>
              <button onClick={()=>setHomeSystems(p=>p.filter(s=>s.id!==sys.id))} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:"0.5rem",cursor:"pointer",padding:"4px 7px",display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
            </div>
            {sys.items.map((item,j)=>(
              <div key={j} style={{display:"flex",alignItems:"flex-start",gap:"0.65rem",padding:"0.48rem 0",borderBottom:j<sys.items.length-1?`1px solid ${T.borderSoft}`:"none"}}>
                <div style={{width:9,height:9,borderRadius:"50%",background:SYSTEM_COLORS[i%SYSTEM_COLORS.length],flexShrink:0,marginTop:5}}/>
                <span style={{fontSize:"0.86rem",color:T.textDark,fontWeight:600,lineHeight:1.5}}>{item}</span>
              </div>
            ))}
            {sys.items.length===0&&<p style={{color:T.textFaint,fontSize:"0.79rem"}}>No items yet — tap Edit to add some.</p>}
          </div>
        ))}
        {editingSystem&&(
          <ModalBox title={editingSystem==="new"?"New System":`Edit: ${editForm.label||"System"}`} onClose={()=>setEditingSystem(null)} wide>
            <div style={{display:"grid",gridTemplateColumns:"64px 1fr",gap:"0.65rem",marginBottom:"0.9rem"}}>
              <div><label style={lbl}>Emoji</label><input value={editForm.emoji} onChange={e=>setEditForm(p=>({...p,emoji:e.target.value}))} style={{...inp({textAlign:"center",fontSize:"1.3rem",padding:"0.5rem"})}}/></div>
              <div><label style={lbl}>System Name</label><input value={editForm.label} onChange={e=>setEditForm(p=>({...p,label:e.target.value}))} placeholder="e.g. Morning Routine" style={inp()} autoFocus/></div>
            </div>
            <label style={lbl}>Items</label>
            <div style={{marginBottom:"0.7rem",border:`1.5px solid ${T.border}`,borderRadius:"0.8rem",overflow:"hidden"}}>
              {editForm.items.length===0&&<p style={{color:T.textFaint,fontSize:"0.79rem",padding:"0.6rem 0.85rem",fontWeight:500}}>No items yet</p>}
              {editForm.items.map((item,i)=>(
                <div key={i} draggable onDragStart={e=>itemDragStart(e,i)} onDragEnter={()=>itemDragEnter(i)} onDragEnd={itemDragEnd} onDragOver={e=>e.preventDefault()} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.45rem 0.65rem",borderBottom:i<editForm.items.length-1?`1px solid ${T.borderSoft}`:"none",background:T.surface,cursor:"grab"}}>
                  <div style={{opacity:0.35,flexShrink:0}}><Icon name="drag" size={13} color={T.textSoft}/></div>
                  <input value={item} onChange={e=>setEditForm(p=>({...p,items:p.items.map((x,j)=>j===i?e.target.value:x)}))} style={{...inp({flex:1,padding:"0.3rem 0.55rem",fontSize:"0.84rem",border:"none",background:"transparent"})}}/>
                  <button onClick={()=>setEditForm(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.rose}/></button>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.2rem"}}>
              <input value={newItemText} onChange={e=>setNewItemText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addEditItem();}} placeholder="Add an item…" style={{...inp({flex:1})}}/>
              <button onClick={addEditItem} style={btnP(T.sage,{padding:"0.5rem 0.85rem",display:"flex",alignItems:"center",gap:"0.35rem"})}><Icon name="plus" size={14} color="#fff"/> Add</button>
            </div>
            <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
              <button onClick={()=>setEditingSystem(null)} style={btnS()}>Cancel</button>
              <button onClick={saveSystem} style={btnP(T.sage)}>{editingSystem==="new"?"Create System":"Save Changes"}</button>
            </div>
          </ModalBox>
        )}
      </div>
    );
  }

  function BrainTab(){
    const [newText,setNewText]   = useState("");
    const [newCat,setNewCat]     = useState("household");
    const [activeFilter,setActiveFilter] = useState("all");
    const [scheduleItem,setScheduleItem] = useState(null); // {item, cat}

    // colour helpers
    function catTheme(cat){
      const map={sage:{color:T.sage,pale:T.sagePale},blue:{color:T.blue,pale:T.bluePale},lavender:{color:T.lavender,pale:T.lavPale},sand:{color:T.sand,pale:T.sandPale},rose:{color:T.rose,pale:T.rosePale}};
      return map[cat?.color]||{color:T.sage,pale:T.sagePale};
    }

    // find which rhythm day matches a suggestDay label
    function findSuggestedDay(suggestDay){
      if(!suggestDay) return null;
      const match = Object.entries(rhythm).find(([,v])=>v.theme&&v.theme.toLowerCase().includes(suggestDay.toLowerCase()));
      return match?match[0]:null;
    }

    function addItem(){
      if(!newText.trim()) return;
      setBrainItems(p=>[...p,{id:uid(),text:newText.trim(),cat:newCat,done:false,scheduledDay:null,person:""}]);
      setNewText("");
    }

    function scheduleToDay(item, day){
      // add as a task on that day + mark scheduled
      setTasks(p=>[...p,{id:uid(),text:item.text,day,done:false,person:item.person||"",order:p.length}]);
      setBrainItems(p=>p.map(x=>x.id===item.id?{...x,scheduledDay:day}:x));
      setScheduleItem(null);
    }

    const activeCats = BRAIN_CATS.filter(c=> activeFilter==="all" || c.id===activeFilter);
    const totalActive = brainItems.filter(i=>!i.done).length;

    function BrainRow({item, cat}){
      const [editing,setEditing] = useState(false);
      const [val,setVal]         = useState(item.text);
      const {color,pale}         = catTheme(cat);
      const sugDay               = findSuggestedDay(cat.suggestDay);
      return (
        <div style={{background:T.white,borderRadius:"0.85rem",padding:"0.65rem 0.85rem",marginBottom:"0.35rem",border:"1.5px solid "+color+"28",display:"flex",alignItems:"flex-start",gap:"0.6rem",transition:"all 0.15s"}}>
          {/* checkbox */}
          <div onClick={()=>setBrainItems(p=>p.map(x=>x.id===item.id?{...x,done:!x.done}:x))}
            style={{width:20,height:20,borderRadius:"50%",border:"2px solid "+color,background:item.done?color:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"0.1rem",transition:"all 0.15s"}}>
            {item.done&&<Icon name="check" size={10} color="#fff"/>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            {editing?(
              <div style={{display:"flex",gap:"0.4rem"}}>
                <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setBrainItems(p=>p.map(x=>x.id===item.id?{...x,text:val}:x));setEditing(false);}if(e.key==="Escape")setEditing(false);}} style={{...inp({flex:1,padding:"0.3rem 0.55rem",fontSize:"0.84rem"})}} autoFocus/>
                <button onClick={()=>{setBrainItems(p=>p.map(x=>x.id===item.id?{...x,text:val}:x));setEditing(false);}} style={btnP(T.sage,{padding:"0.3rem 0.65rem",fontSize:"0.76rem"})}>Save</button>
              </div>
            ):(
              <span style={{fontSize:"0.88rem",fontWeight:item.done?400:600,color:item.done?T.textFaint:T.textDark,textDecoration:item.done?"line-through":"none",lineHeight:1.45}}>{item.text}</span>
            )}
            {/* scheduled pill */}
            {item.scheduledDay&&<span style={{display:"inline-flex",alignItems:"center",gap:"3px",background:T.sagePale,color:T.sageDark,borderRadius:"2rem",padding:"2px 8px",fontSize:"0.65rem",fontWeight:700,marginTop:"0.28rem"}}>📅 Scheduled {item.scheduledDay}</span>}
          </div>
          {/* actions */}
          <div style={{display:"flex",gap:"0.25rem",alignItems:"center",flexShrink:0}}>
            {/* suggest day button */}
            {!item.done&&!item.scheduledDay&&sugDay&&(
              <button onClick={()=>setScheduleItem({item,cat})} title={"Schedule to "+sugDay}
                style={{background:pale,border:"1px solid "+color+"40",color:color,borderRadius:"0.5rem",padding:"0.25rem 0.55rem",cursor:"pointer",fontSize:"0.66rem",fontWeight:800,fontFamily:"inherit",whiteSpace:"nowrap"}}>
                📅 {sugDay}
              </button>
            )}
            {!item.done&&!item.scheduledDay&&!sugDay&&(
              <button onClick={()=>setScheduleItem({item,cat})} title="Schedule to a day"
                style={{background:T.bgAlt,border:"1px solid "+T.border,color:T.textSoft,borderRadius:"0.5rem",padding:"0.25rem 0.55rem",cursor:"pointer",fontSize:"0.66rem",fontWeight:700,fontFamily:"inherit"}}>
                📅
              </button>
            )}
            {!editing&&<button onClick={()=>{setVal(item.text);setEditing(true);}} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex",opacity:0.45}}><Icon name="edit" size={13} color={T.textSoft}/></button>}
            <button onClick={()=>setBrainItems(p=>p.filter(x=>x.id!==item.id))} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex",opacity:0.35}}><Icon name="trash" size={13} color={T.textSoft}/></button>
          </div>
        </div>
      );
    }

    return(
      <div>
        <SecHead emoji="🧠" title="Brain Dump" sub="Capture everything — sorted by where it happens"/>

        {/* Schedule day picker modal */}
        {scheduleItem&&(
          <div style={{position:"fixed",inset:0,background:T.modalOverlay,backdropFilter:"blur(8px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
            <div style={{background:T.surface,border:"1.5px solid "+T.border,borderRadius:"1.3rem",padding:"1.6rem",width:"100%",maxWidth:400,boxShadow:"0 32px 80px "+T.cardShadow}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.25rem",fontWeight:700,color:T.textDark,marginBottom:"0.2rem"}}>Schedule this task</div>
              <div style={{color:T.textSoft,fontSize:"0.82rem",marginBottom:"1rem"}}>"{scheduleItem.item.text}"</div>
              {/* Suggested day highlight */}
              {findSuggestedDay(scheduleItem.cat.suggestDay)&&(
                <div style={{background:T.sagePale,border:"1.5px solid "+T.sage+"50",borderRadius:"0.8rem",padding:"0.65rem 0.85rem",marginBottom:"0.85rem",display:"flex",alignItems:"center",gap:"0.6rem"}}>
                  <span style={{fontSize:"0.95rem"}}>✨</span>
                  <div>
                    <div style={{fontSize:"0.77rem",fontWeight:700,color:T.sageDark}}>Best fit: {findSuggestedDay(scheduleItem.cat.suggestDay)}</div>
                    <div style={{fontSize:"0.71rem",color:T.textSoft}}>Matches your {scheduleItem.cat.suggestDay} day theme</div>
                  </div>
                  <button onClick={()=>scheduleToDay(scheduleItem.item,findSuggestedDay(scheduleItem.cat.suggestDay))} style={{...btnP(T.sage,{fontSize:"0.78rem",padding:"0.35rem 0.8rem",marginLeft:"auto"})}}>Add it</button>
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.4rem",marginBottom:"1rem"}}>
                {[...MEAL_DAYS,"Daily"].map(day=>(
                  <button key={day} onClick={()=>scheduleToDay(scheduleItem.item,day)}
                    style={{background:T.bgAlt,border:"1.5px solid "+T.border,borderRadius:"0.65rem",padding:"0.55rem 0.7rem",cursor:"pointer",fontSize:"0.82rem",fontWeight:600,fontFamily:"inherit",color:T.textDark,textAlign:"left",transition:"all 0.12s",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                    <span style={{fontSize:"0.8rem"}}>{rhythm[day]?.emoji||"📅"}</span>
                    <div>
                      <div style={{fontSize:"0.8rem",fontWeight:700}}>{day}</div>
                      {rhythm[day]?.theme&&<div style={{fontSize:"0.66rem",color:T.textSoft}}>{rhythm[day].theme}</div>}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={()=>setScheduleItem(null)} style={btnS({width:"100%"})}>Cancel</button>
            </div>
          </div>
        )}

        {/* Add item */}
        <div style={{...card({background:T.bgAlt,border:"1.5px solid "+T.border})}}>
          <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.6rem"}}>
            <input value={newText} onChange={e=>setNewText(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")addItem();}}
              placeholder="What's on your mind…" style={{...inp({flex:1})}} autoFocus/>
            <button onClick={addItem} style={{...btnP(T.blue,{padding:"0.56rem 0.85rem",flexShrink:0,display:"flex",alignItems:"center",borderRadius:"0.7rem"})}}><Icon name="plus" size={16} color="#fff"/></button>
          </div>
          {/* Category selector */}
          <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap"}}>
            {BRAIN_CATS.map(c=>{const{color}=catTheme(c);return(
              <button key={c.id} onClick={()=>setNewCat(c.id)}
                style={{background:newCat===c.id?color:T.white,color:newCat===c.id?"#fff":T.textMid,border:"1.5px solid "+(newCat===c.id?color:T.border),borderRadius:"2rem",padding:"0.26rem 0.72rem",cursor:"pointer",fontSize:"0.73rem",fontWeight:700,fontFamily:"inherit",transition:"all 0.15s",display:"flex",alignItems:"center",gap:"0.28rem"}}>
                {c.emoji} {c.label}
              </button>
            );})}
          </div>
          {/* Show example for selected category */}
          <div style={{fontSize:"0.7rem",color:T.textFaint,marginTop:"0.5rem",fontStyle:"italic"}}>
            e.g. {BRAIN_CATS.find(c=>c.id===newCat)?.examples.join(" · ")}
          </div>
        </div>

        {/* Filter pills */}
        <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap",marginBottom:"0.85rem"}}>
          <button onClick={()=>setActiveFilter("all")} style={{background:activeFilter==="all"?T.blue:T.white,color:activeFilter==="all"?"#fff":T.textMid,border:"1.5px solid "+(activeFilter==="all"?T.blue:T.border),borderRadius:"2rem",padding:"0.26rem 0.72rem",cursor:"pointer",fontSize:"0.73rem",fontWeight:700,fontFamily:"inherit"}}>
            All {totalActive>0?"("+totalActive+")":""}
          </button>
          {BRAIN_CATS.map(c=>{const{color}=catTheme(c);const cnt=brainItems.filter(i=>i.cat===c.id&&!i.done).length;if(cnt===0&&activeFilter!==c.id)return null;return(
            <button key={c.id} onClick={()=>setActiveFilter(activeFilter===c.id?"all":c.id)}
              style={{background:activeFilter===c.id?color:T.white,color:activeFilter===c.id?"#fff":T.textMid,border:"1.5px solid "+(activeFilter===c.id?color:T.border),borderRadius:"2rem",padding:"0.26rem 0.72rem",cursor:"pointer",fontSize:"0.73rem",fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"0.28rem",transition:"all 0.15s"}}>
              {c.emoji} {c.label}{cnt>0?" ("+cnt+")":""}
            </button>
          );})}
        </div>

        {/* Category groups */}
        {activeCats.map(cat=>{
          const items = brainItems.filter(i=>i.cat===cat.id&&(activeFilter==="all"||i.cat===activeFilter));
          if(items.length===0) return null;
          const {color,pale} = catTheme(cat);
          const sugDay = findSuggestedDay(cat.suggestDay);
          const unscheduled = items.filter(i=>!i.done&&!i.scheduledDay);
          return(
            <div key={cat.id} style={{marginBottom:"1rem"}}>
              {/* Category header */}
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.5rem 0.75rem",background:pale,borderRadius:"0.8rem",border:"1.5px solid "+color+"38",marginBottom:"0.45rem"}}>
                <span style={{fontSize:"1.05rem"}}>{cat.emoji}</span>
                <div style={{flex:1}}>
                  <span style={{fontWeight:800,color,fontSize:"0.84rem",letterSpacing:"0.02em"}}>{cat.label}</span>
                  <span style={{color:T.textSoft,fontSize:"0.72rem",fontWeight:400,marginLeft:"0.4rem"}}>— {cat.desc}</span>
                </div>
                {/* Day suggestion chip */}
                {sugDay&&unscheduled.length>0&&(
                  <div style={{display:"flex",alignItems:"center",gap:"0.3rem",background:T.white,border:"1.5px solid "+color+"40",borderRadius:"2rem",padding:"0.22rem 0.65rem",cursor:"pointer"}}
                    onClick={()=>{
                      // bulk schedule all unscheduled items in this category
                      unscheduled.forEach(item=>scheduleToDay(item,sugDay));
                    }}>
                    <span style={{fontSize:"0.65rem"}}>📅</span>
                    <span style={{fontSize:"0.67rem",fontWeight:800,color,whiteSpace:"nowrap"}}>Do on {sugDay}</span>
                  </div>
                )}
                <span style={{color,fontSize:"0.73rem",fontWeight:700,flexShrink:0}}>{items.filter(i=>!i.done).length} left</span>
              </div>
              {/* Items */}
              {items.map(item=><BrainRow key={item.id} item={item} cat={cat}/>)}
            </div>
          );
        })}

        {brainItems.length===0&&(
          <div style={{...card({textAlign:"center",padding:"2rem"})}}>
            <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>🌿</div>
            <p style={{color:T.textMid,fontSize:"0.87rem",fontWeight:700}}>Your mind is clear.<br/><span style={{color:T.textSoft,fontWeight:400,fontSize:"0.82rem"}}>Add anything that's on your radar.</span></p>
          </div>
        )}

        {/* Completed section */}
        {brainItems.some(i=>i.done)&&(
          <div style={{marginTop:"0.5rem",paddingTop:"0.75rem",borderTop:"1px dashed "+T.borderSoft}}>
            <div style={{fontSize:"0.67rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.textFaint,marginBottom:"0.45rem"}}>Completed</div>
            {brainItems.filter(i=>i.done).map(item=>{
              const cat=BRAIN_CATS.find(c=>c.id===item.cat)||BRAIN_CATS[0];
              return <BrainRow key={item.id} item={item} cat={cat}/>;
            })}
            <button onClick={()=>setBrainItems(p=>p.filter(i=>!i.done))} style={{...btnS({fontSize:"0.76rem",padding:"0.35rem 0.8rem",color:T.rose,marginTop:"0.4rem"})}}>Clear completed</button>
          </div>
        )}
      </div>
    );
  }

  function BurnoutTab(){
    return(
      <div>
        <div style={{...card({background:`linear-gradient(135deg,${T.rosePale},${T.sandPale})`,border:`2px solid ${T.rose}55`,textAlign:"center",padding:"2rem"})}}>
          <div style={{fontSize:"2.8rem",marginBottom:"0.6rem"}}>🛟</div>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.7rem",color:T.textDark,margin:"0 0 0.5rem",fontWeight:700}}>Survival Mode</h2>
          <p style={{color:T.textMid,fontSize:"0.87rem",lineHeight:1.65,maxWidth:300,margin:"0 auto",fontWeight:600}}>Some days, just getting through is enough.<br/><span style={{fontWeight:400}}>Only three things matter today.</span></p>
        </div>
        {BURNOUT_TASKS.map(t=>{const checked=burnoutChecked.includes(t.id);return(
          <button key={t.id} onClick={()=>setBurnoutChecked(p=>p.includes(t.id)?p.filter(x=>x!==t.id):[...p,t.id])} style={{...card({cursor:"pointer",display:"flex",alignItems:"center",gap:"1rem",padding:"1.15rem 1.3rem",background:checked?`linear-gradient(135deg,${T.sagePale},${T.sage}18)`:T.surface,border:`2px solid ${checked?T.sage:T.borderSoft}`,width:"100%",textAlign:"left",transition:"all 0.18s"})}}>
            <span style={{fontSize:"1.6rem"}}>{t.emoji}</span>
            <span style={{flex:1,fontWeight:700,color:checked?T.sageDark:T.textDark,fontSize:"1rem",textDecoration:checked?"line-through":"none"}}>{t.label}</span>
            <div style={{width:28,height:28,borderRadius:"50%",border:`2.5px solid ${checked?T.sage:T.border}`,background:checked?T.sage:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.18s"}}>{checked&&<Icon name="check" size={14} color="#fff"/>}</div>
          </button>
        );})}
        {burnoutChecked.length===3&&<div style={{...card({background:`linear-gradient(135deg,${T.sagePale},${T.bluePale})`,border:`2px solid ${T.sage}60`,textAlign:"center",padding:"1.5rem"})}}>
          <div style={{fontSize:"2rem",marginBottom:"0.4rem"}}>🌿</div>
          <p style={{color:T.sageDark,fontWeight:700,fontSize:"1.05rem",margin:0}}>You did it. That's everything.<br/><span style={{fontWeight:500,fontSize:"0.86rem",color:T.textMid}}>Rest now.</span></p>
        </div>}
      </div>
    );
  }

  function SettingsTab(){
    const ONBOARD_QUESTIONS=[
      {key:"parentNames",q:"What should I call you?",placeholder:"e.g. Lindsey & Jake"},
      {key:"numKids",q:"How many little ones are in your home?",placeholder:"e.g. 3"},
      {key:"kidAges",q:"What are their ages?",placeholder:"e.g. 7, 4, infant"},
      {key:"dietaryNeeds",q:"Any dietary needs I should always know?",placeholder:"e.g. Dairy-free, nut-free"},
      {key:"biggestChallenge",q:"Your biggest home management challenge?",placeholder:"e.g. Keeping up with meals"},
      {key:"favoriteDinner",q:"A dinner your family loves on repeat?",placeholder:"e.g. Tacos, pasta"},
      {key:"cookingStyle",q:"How would you describe your cooking style?",placeholder:"e.g. Quick & simple"},
    ];
    const currentQ=ONBOARD_QUESTIONS[onboardStep];
    return(
      <div>
        <SecHead emoji="⚙️" title="Settings"/>
        <div style={card()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.85rem"}}>
            <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark}}>👥 Family Profile</h2>
            <div style={{display:"flex",gap:"0.4rem"}}>
              <button onClick={()=>setShowOnboardingWizard(true)} style={btnP(T.sage,{fontSize:"0.74rem",padding:"0.3rem 0.75rem"})}>🔄 Setup wizard</button>
              <button onClick={()=>setShowOnboarding(v=>!v)} style={btnP(T.blue,{fontSize:"0.76rem",padding:"0.32rem 0.78rem"})}>{familyProfile?"Edit":"Set up"}</button>
            </div>
          </div>
          {familyProfile&&!showOnboarding&&(
            <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
              {[["Names",familyProfile.parentNames],["Kids",`${familyProfile.numKids} (ages: ${familyProfile.kidAges})`],["Diet",familyProfile.dietaryNeeds],["Challenge",familyProfile.biggestChallenge],["Fav dinner",familyProfile.favoriteDinner]].filter(([,v])=>v).map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:"0.5rem"}}>
                  <span style={{fontSize:"0.72rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.06em",minWidth:80}}>{k}</span>
                  <span style={{fontSize:"0.82rem",color:T.textDark,fontWeight:600}}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
          {!familyProfile&&!showOnboarding&&<p style={{color:T.textSoft,fontSize:"0.8rem",lineHeight:1.6}}>Set up your family profile to get personalised meal ideas and AI support.</p>}
          {showOnboarding&&(
            <div style={{marginTop:"0.75rem"}}>
              <div style={{width:"100%",height:4,background:T.borderSoft,borderRadius:"2rem",marginBottom:"1rem",overflow:"hidden"}}>
                <div style={{width:`${((onboardStep+1)/ONBOARD_QUESTIONS.length)*100}%`,height:"100%",background:T.blue,borderRadius:"2rem",transition:"width 0.3s"}}/>
              </div>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:600,color:T.textDark,marginBottom:"0.75rem"}}>{currentQ.q}</p>
              <input value={onboardAnswers[currentQ.key]||""} onChange={e=>setOnboardAnswers(p=>({...p,[currentQ.key]:e.target.value}))} placeholder={currentQ.placeholder} style={{...inp({marginBottom:"0.75rem"})}} autoFocus
                onKeyDown={e=>{if(e.key==="Enter"){if(onboardStep<ONBOARD_QUESTIONS.length-1)setOnboardStep(s=>s+1);else{setFamilyProfile(onboardAnswers);setShowOnboarding(false);setOnboardStep(0);}}}}/>
              <div style={{display:"flex",gap:"0.5rem",justifyContent:"space-between"}}>
                <div style={{display:"flex",gap:"0.45rem"}}>
                  {onboardStep>0&&<button onClick={()=>setOnboardStep(s=>s-1)} style={btnS({padding:"0.5rem 1rem"})}>← Back</button>}
                  <button onClick={()=>setShowOnboarding(false)} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:"0.76rem",fontFamily:"inherit",padding:"0.5rem"}}>Skip</button>
                </div>
                <button onClick={()=>{if(onboardStep<ONBOARD_QUESTIONS.length-1)setOnboardStep(s=>s+1);else{setFamilyProfile(onboardAnswers);setShowOnboarding(false);setOnboardStep(0);}}} style={btnP(T.blue,{padding:"0.5rem 1.2rem"})}>
                  {onboardStep<ONBOARD_QUESTIONS.length-1?"Continue →":"Save ✨"}
                </button>
              </div>
            </div>
          )}
        </div>
        {/* AI Memory */}
        {Object.keys(aiMemory).length>0&&(
          <div style={card()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
              <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark}}>🧠 What the AI Knows</h2>
              <button onClick={()=>setAiMemory({})} style={btnS({fontSize:"0.72rem",padding:"0.24rem 0.6rem",color:T.rose})}>Clear</button>
            </div>
            {Object.entries(aiMemory).map(([q,a],i)=>(
              <div key={i} style={{padding:"0.5rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                <div style={{fontSize:"0.72rem",color:T.textSoft,fontWeight:600,marginBottom:"0.15rem"}}>{q}</div>
                <div style={{fontSize:"0.84rem",color:T.textDark,fontWeight:500}}>{a}</div>
              </div>
            ))}
          </div>
        )}
        <div style={card()}>
          <h2 style={{margin:"0 0 0.65rem",fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark}}>🔔 Notifications</h2>
          <p style={{color:T.textSoft,fontSize:"0.8rem",lineHeight:1.65,marginBottom:"0.85rem"}}>Anchor & Flow sends warm AI-powered notifications throughout your day — like having a family assistant checking in.</p>

          {/* Notification types */}
          {[
            {time:"7:00 am", emoji:"🌅", label:"Morning anchor", desc:"Your daily agenda, tasks & events"},
            {time:"12:00 pm", emoji:"🌊", label:"Midday check-in", desc:"Progress update & encouragement"},
            {time:"3:00 pm", emoji:"🍽️", label:"Dinner heads-up", desc:"Defrost reminders & meal prep"},
            {time:"5:00 pm", emoji:"🌙", label:"Evening recap", desc:"Doubtfire-style day summary + tomorrow preview"},
            {time:"2hrs before", emoji:"⏰", label:"Event nudges", desc:"Smart reminders before appointments"},
          ].map((n,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.55rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
              <span style={{fontSize:"1.1rem",flexShrink:0}}>{n.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:T.textDark,fontSize:"0.85rem"}}>{n.label}</div>
                <div style={{color:T.textSoft,fontSize:"0.72rem"}}>{n.desc}</div>
              </div>
              <span style={{fontSize:"0.68rem",color:T.textSoft,fontWeight:600,flexShrink:0}}>{n.time}</span>
            </div>
          ))}

          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.65rem 0",borderBottom:`1px solid ${T.borderSoft}`,marginTop:"0.25rem"}}>
            <span style={{fontSize:"0.85rem",fontWeight:600,color:T.textDark}}>Browser notifications</span>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              <span style={{fontSize:"0.74rem",color:notifPermission==="granted"?T.sage:T.textSoft,fontWeight:700}}>{notifPermission==="granted"?"Enabled":notifPermission==="denied"?"Blocked":"Not enabled"}</span>
              {notifPermission!=="granted"&&notifPermission!=="denied"&&<button onClick={requestNotifPermission} style={btnP(T.blue,{fontSize:"0.74rem",padding:"0.28rem 0.7rem"})}>Enable</button>}
            </div>
          </div>

          {notifPermission==="granted"&&(
            <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginTop:"0.75rem"}}>
              <button onClick={()=>{
                const todayTasks=tasks.filter(t=>(t.day===TODAY_NAME||t.day==="Daily")&&!t.archived);
                const todayMeal=(meals[TODAY_NAME]||{}).dinner;
                const todayEvts=calEvents.filter(e=>e.date===TODAY.toISOString().split("T")[0]);
                new Notification("⚓️ Your daily anchor is ready", {body:`${todayEvts.length>0?`First up: ${todayEvts[0].title}. `:""}${todayTasks.filter(t=>!t.done).length} tasks today.${todayMeal?` Dinner: ${todayMeal}.`:""}`, icon:"/favicon.svg"});
              }} style={btnS({fontSize:"0.73rem",padding:"0.32rem 0.75rem"})}>Preview morning</button>
              <button onClick={()=>{
                const done=tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&t.done&&!t.archived).length;
                const pending=tasks.filter(t=>(t.day===TODAY_NAME||t.carriedTo===TODAY_NAME)&&!t.done&&!t.archived).length;
                new Notification("🌙 Evening recap", {body:`${done>0?`${done} things done today.`:""} ${pending>0?`${pending} still on your list.`:""} Rest up — tomorrow is a fresh start.`, icon:"/favicon.svg"});
              }} style={btnS({fontSize:"0.73rem",padding:"0.32rem 0.75rem"})}>Preview evening</button>
              <button onClick={()=>{setDailySummaryScheduled(null);scheduleAllDailyNotifications();}} style={btnP(T.blue,{fontSize:"0.73rem",padding:"0.32rem 0.75rem"})}>Schedule today's</button>
            </div>
          )}

          {notifications.filter(n=>!n.fired).length>0&&(
            <div style={{marginTop:"0.85rem"}}>
              <div style={{fontSize:"0.7rem",color:T.textSoft,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.35rem"}}>Upcoming reminders</div>
              {notifications.filter(n=>!n.fired).map(n=>(
                <div key={n.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.38rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
                  <span style={{fontSize:"0.8rem"}}>🔔</span>
                  <span style={{flex:1,fontSize:"0.8rem",color:T.textDark,fontWeight:600}}>{n.entityTitle}</span>
                  <span style={{fontSize:"0.7rem",color:T.textSoft}}>{n.date} {n.time}</span>
                  <button onClick={()=>setNotifications(p=>p.filter(x=>x.id!==n.id))} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={11} color={T.textFaint}/></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{...card({background:`linear-gradient(135deg,${T.bluePale},${T.sagePale})`,border:`2px solid ${T.blue}55`})}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.85rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              <Icon name="sync" size={18} color={T.blueDark}/>
              <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark}}>Family Sync</h2>
            </div>
            {syncStatus==="synced"&&<span style={{fontSize:"0.72rem",color:T.sage,fontWeight:700}}>✓ Synced</span>}
            {syncStatus==="syncing"&&<span style={{fontSize:"0.72rem",color:T.sand,fontWeight:700}}>⟳ Syncing…</span>}
            {syncStatus==="error"&&<span style={{fontSize:"0.72rem",color:T.rose,fontWeight:700}}>⚠ Error</span>}
          </div>
          {!authUser ? (
            <div>
              <p style={{color:T.textMid,fontSize:"0.82rem",lineHeight:1.65,marginBottom:"0.85rem"}}>Sign in to sync your household across multiple devices and share with your partner. Each person has their own login — same household, one shared view.</p>
              <button onClick={()=>setShowAuthModal(true)} style={btnP("linear-gradient(135deg,"+T.blue+","+T.blueDark+")",{width:"100%",padding:"0.8rem",fontSize:"0.9rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem"})}>
                ⚓️ Sign in / Create account
              </button>
            </div>
          ) : (
            <div>
              <div style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.65rem 0.85rem",background:T.white,borderRadius:"0.75rem",marginBottom:"0.75rem",border:"1px solid "+T.borderSoft}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${T.blue},${T.sage})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{color:"#fff",fontWeight:800,fontSize:"0.9rem"}}>{(authUser.displayName||authUser.email).charAt(0).toUpperCase()}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:T.textDark,fontSize:"0.88rem"}}>{authUser.displayName||authUser.email}</div>
                  <div style={{color:T.textSoft,fontSize:"0.74rem"}}>{authUser.email}</div>
                </div>
                <button onClick={signOut} style={btnS({fontSize:"0.73rem",padding:"0.28rem 0.65rem",color:T.rose})}>Sign out</button>
              </div>
              {lastSyncTime&&<p style={{fontSize:"0.74rem",color:T.sage,fontWeight:700,marginBottom:"0.65rem"}}>Last synced: {lastSyncTime}</p>}
              <div style={{display:"flex",gap:"0.4rem"}}>
                <button onClick={()=>setShowHouseholdModal(true)} style={btnP(T.blue,{flex:1,fontSize:"0.8rem",padding:"0.55rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.3rem"})}>
                  👥 Manage household
                </button>
                <button onClick={syncNow} style={btnS({fontSize:"0.8rem",padding:"0.55rem 0.85rem",display:"flex",alignItems:"center",gap:"0.3rem"})}>
                  <Icon name="sync" size={13} color={T.textMid}/> Sync
                </button>
              </div>
            </div>
          )}
        </div>
        <div style={{...card({background:`linear-gradient(135deg,${T.bluePale},${T.sagePale})`,border:`2px solid ${T.blue}55`})}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"1rem"}}>
            <Icon name="palette" size={18} color={T.blueDark}/>
            <h2 style={{margin:0,fontFamily:"'Cormorant Garamond',serif",fontSize:"1.15rem",fontWeight:700,color:T.textDark}}>Appearance</h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"0.65rem"}}>
            {Object.entries(THEMES).map(([key,th])=>(
              <button key={key} onClick={()=>setThemeNameRaw(key)} style={{background:themeName===key?T.blue:T.white,color:themeName===key?"#fff":T.textDark,border:`2px solid ${themeName===key?T.blue:T.border}`,borderRadius:"0.9rem",padding:"0.9rem 0.5rem",cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",textAlign:"center"}}>
                <div style={{fontSize:"1.5rem",marginBottom:"0.32rem"}}>{th.emoji}</div>
                <div style={{fontWeight:700,fontSize:"0.82rem"}}>{th.label}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={card()}>
          <SecHead emoji="👥" title="Household Members"/>
          {people.map(p=>(
            <div key={p.id} style={{padding:"0.6rem 0",borderBottom:`1px solid ${T.borderSoft}`}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.6rem",marginBottom:"0.5rem"}}>
                <div style={{width:12,height:12,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                <span style={{flex:1,fontSize:"0.87rem",color:T.textDark,fontWeight:600}}>{p.name}</span>
                <button onClick={()=>setPeople(p2=>p2.filter(x=>x.id!==p.id))} style={{background:"none",border:"none",cursor:"pointer",padding:2,display:"flex"}}><Icon name="trash" size={13} color={T.textFaint}/></button>
              </div>
              <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap",paddingLeft:"1.5rem"}}>
                {["#6A9BB5","#7a9e8e","#c4a882","#b87265","#8878b8","#7ab8a8","#c878a8","#e8a838","#6b9e6b","#4a7a9e"].map(c=>(
                  <button key={c} onClick={()=>setPeople(prev=>prev.map(x=>x.id===p.id?{...x,color:c}:x))} style={{width:22,height:22,borderRadius:"50%",background:c,border:p.color===c?`3px solid ${T.textDark}`:`2px solid transparent`,cursor:"pointer",transition:"border 0.15s",flexShrink:0}}/>
                ))}
              </div>
            </div>
          ))}
          <div style={{display:"flex",gap:"0.5rem",marginTop:"0.82rem"}}>
            <input value={newPersonName} onChange={e=>setNewPersonName(e.target.value)} placeholder="Add person…" style={inp()}/>
            <button onClick={()=>{if(newPersonName.trim()){setPeople(p=>[...p,{id:uid(),name:newPersonName.trim(),color:PC[p.length%PC.length]}]);setNewPersonName("");}}} style={btnP(T.sage)}>Add</button>
          </div>
        </div>
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
        <div style={{...card({background:T.bluePale,border:`2px solid ${T.blue}55`,textAlign:"center",padding:"1.8rem"})}}>
          <AnchorLogo size={44} color={T.blue}/>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.3rem",fontWeight:700,color:T.textDark,marginTop:"0.65rem",letterSpacing:"0.06em"}}>ANCHOR & FLOW</div>
          <div style={{color:T.textSoft,fontSize:"0.8rem",fontStyle:"italic",marginTop:"0.15rem",fontFamily:"'Cormorant Garamond',serif"}}>A steadier home, in every season</div>
          <p style={{color:T.textMid,fontSize:"0.8rem",lineHeight:1.72,marginTop:"0.85rem",marginBottom:"0.5rem"}}>Data saved locally · AI powered by Claude · Native app coming soon</p>
          <div style={{display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap"}}>
            <a href="/privacy.html" target="_blank" style={{color:T.blue,fontSize:"0.78rem",fontWeight:600,textDecoration:"none"}}>Privacy Policy</a>
            <a href="mailto:hello@anchorandflowapp.com" style={{color:T.blue,fontSize:"0.78rem",fontWeight:600,textDecoration:"none"}}>Contact Us</a>
          </div>
        </div>
      </div>
    );
  }

  // ── Google Calendar Modal ────────────────────────────────────────────────────
  function GoogleCalendarModal({onClose}) {
    const isConnected = connectedCals.includes("google") && googleCalToken;
    const [syncing, setSyncing2] = useState(false);
    const [error, setError] = useState(googleCalError||"");
    const [lastSynced, setLastSynced] = useState(null);

    // Google OAuth using Google Identity Services (GIS) — works without redirect URI issues
    function connectGoogle() {
      setError("");
      const GOOGLE_CLIENT_ID = "1071398827259-kt8fuuclq8riohieaeu4r58sk93484u9.apps.googleusercontent.com";

      // Load Google Identity Services script if not already loaded
      function initTokenClient() {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly",
          callback: (response) => {
            if (response.error) { setError("Google sign-in failed: " + response.error); return; }
            const token = response.access_token;
            setGoogleCalToken(token);
            setConnectedCals(p => [...p.filter(x=>x!=="google"), "google"]);
            fetchGoogleEvents(token);
          },
        });
        client.requestAccessToken();
      }

      if (window.google?.accounts?.oauth2) {
        initTokenClient();
      } else {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.onload = initTokenClient;
        script.onerror = () => setError("Failed to load Google sign-in. Check your connection.");
        document.head.appendChild(script);
      }
    }

    async function fetchGoogleEvents(token) {
      setSyncing2(true); setError("");
      try {
        const now = new Date();
        const timeMin = encodeURIComponent(new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
        const timeMax = encodeURIComponent(new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString());

        // Step 1: Get all calendars in the account
        const calListRes = await fetch(
          "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (calListRes.status === 401) {
          setGoogleCalToken(null);
          setConnectedCals(p=>p.filter(x=>x!=="google"));
          setError("Session expired. Please reconnect Google Calendar.");
          setSyncing2(false); return;
        }
        const calListData = await calListRes.json();
        if (calListData.error) { setError(calListData.error.message||"Google Calendar error"); setSyncing2(false); return; }

        const calendars = calListData.items || [];

        // Step 2: Fetch events from every calendar in parallel
        const calColors = {
          "cocoa": "#c4a882", "flamingo": "#b87265", "grape": "#8878b8",
          "graphite": "#607890", "lavender": "#8878b8", "peacock": "#6A9BB5",
          "sage": "#7a9e8e", "tangerine": "#e8a838", "tomato": "#b87265",
          "banana": "#e8c838", "basil": "#3a7a60", "blueberry": "#2e6ea0"
        };
        const fallbackColors = ["#6A9BB5","#7a9e8e","#c4a882","#b87265","#8878b8","#e8a838","#7ab8a8","#3a7a60"];

        const allEventPromises = calendars.map(async (cal, calIdx) => {
          try {
            const calId = encodeURIComponent(cal.id);
            const res = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) return [];
            const data = await res.json();
            if (data.error) return [];

            // Use the calendar's color, or fall back to rotating colors
            const calColor = calColors[cal.colorId] || cal.backgroundColor || fallbackColors[calIdx % fallbackColors.length];

            return (data.items || []).map(ev => {
              const start = ev.start?.dateTime || ev.start?.date || "";
              const dateStr = start.slice(0, 10);
              const timeStr = start.length > 10 ? start.slice(11, 16) : "";
              // Use event's own color if set, otherwise use calendar color
              const evColor = ev.colorId ? (calColors[ev.colorId] || calColor) : calColor;
              return {
                id: "gcal_" + ev.id,
                title: ev.summary || "(No title)",
                date: dateStr,
                time: timeStr,
                color: evColor,
                colorLabel: cal.summary || "Google",
                note: ev.description || "",
                fromGoogle: true,
              };
            });
          } catch { return []; }
        });

        const allEventsNested = await Promise.all(allEventPromises);
        const allEvents = allEventsNested.flat();

        // Merge: keep manual events, replace all Google-sourced ones
        setCalEvents(prev => [
          ...prev.filter(e => !e.fromGoogle),
          ...allEvents
        ]);
        setLastSynced(new Date().toLocaleTimeString());
        setLastSync(new Date().toLocaleTimeString());
        setGoogleCalError("");
      } catch(e) {
        setError("Couldn't fetch events: " + e.message);
      }
      setSyncing2(false);
    }

    async function resync() {
      if (googleCalToken) await fetchGoogleEvents(googleCalToken);
    }

    function disconnect() {
      setGoogleCalToken(null);
      setConnectedCals(p=>p.filter(x=>x!=="google"));
      setCalEvents(prev=>prev.filter(e=>!e.fromGoogle));
    }

    return (
      <ModalBox title="Connect Google Calendar" onClose={onClose} wide>
        {/* Google */}
        <div style={{background:isConnected?T.sage+"12":T.bgAlt,border:`1.5px solid ${isConnected?T.sage:T.border}`,borderRadius:"1rem",padding:"1rem 1.1rem",marginBottom:"1rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.85rem"}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:"#4285F422",border:"2px solid #4285F444",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Icon name="google" size={22}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:T.textDark,fontSize:"0.9rem"}}>Google Calendar</div>
              <div style={{color:T.textSoft,fontSize:"0.76rem",marginTop:"0.12rem"}}>
                {isConnected ? "✓ Connected — events synced to Anchor & Flow" : "Connect to pull your real events into the app"}
              </div>
              {lastSynced&&<div style={{color:T.sage,fontSize:"0.72rem",fontWeight:700,marginTop:"0.1rem"}}>Last synced: {lastSynced}</div>}
            </div>
            {isConnected
              ? <div style={{display:"flex",gap:"0.4rem"}}>
                  <button onClick={resync} disabled={syncing} style={btnS({fontSize:"0.76rem",padding:"0.35rem 0.75rem",display:"flex",alignItems:"center",gap:"0.3rem"})}>
                    {syncing?"Syncing…":"↻ Sync"}
                  </button>
                  <button onClick={disconnect} style={btnS({fontSize:"0.76rem",padding:"0.35rem 0.75rem",color:T.rose,borderColor:T.rose+"55"})}>
                    Disconnect
                  </button>
                </div>
              : <button onClick={connectGoogle} style={btnP("#4285F4",{fontSize:"0.78rem",padding:"0.4rem 0.9rem"})}>
                  Connect
                </button>
            }
          </div>
        </div>

        {error&&<div style={{background:T.rosePale,border:"1.5px solid "+T.rose+"50",borderRadius:"0.75rem",padding:"0.65rem 0.9rem",marginBottom:"0.85rem",fontSize:"0.82rem",color:T.rose,fontWeight:600}}>{error}</div>}

        {/* Other calendars */}
        <div style={{borderTop:"1px solid "+T.borderSoft,paddingTop:"0.85rem",marginTop:"0.2rem"}}>
          <div style={{fontSize:"0.7rem",fontWeight:800,color:T.textSoft,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.6rem"}}>Other calendars</div>
          {[{id:"apple",label:"Apple Calendar",color:"#ff3b30",icon:"🍎",note:"Export .ics from Apple Calendar and import below"},
            {id:"outlook",label:"Outlook",color:"#0078d4",icon:"Ο",note:"Export .ics from Outlook and import below"}].map(cs=>{
            const connected=connectedCals.includes(cs.id);
            return (
              <div key={cs.id} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.7rem 0",borderBottom:"1px solid "+T.borderSoft}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:cs.color+"22",border:"2px solid "+cs.color+"44",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"0.95rem"}}>{cs.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,color:T.textDark,fontSize:"0.85rem"}}>{cs.label}</div>
                  <div style={{color:T.textSoft,fontSize:"0.72rem"}}>{cs.note}</div>
                </div>
                <button onClick={()=>setConnectedCals(p=>connected?p.filter(x=>x!==cs.id):[...p,cs.id])}
                  style={connected?btnS({fontSize:"0.74rem",padding:"0.3rem 0.7rem",color:T.rose}):btnP(cs.color,{fontSize:"0.74rem",padding:"0.3rem 0.7rem"})}>
                  {connected?"Remove":"Mark connected"}
                </button>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:"1rem"}}>
          <button onClick={onClose} style={btnP(T.blue)}>Done</button>
        </div>
      </ModalBox>
    );
  }

  // ── Auth Modal ──────────────────────────────────────────────────────────────
  function AuthModal({onClose}) {
    const [mode, setMode] = useState("signin"); // signin | signup
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    async function handleSubmit() {
      if (!email || !password) { setError("Email and password are required."); return; }
      setLoading(true); setError("");
      const result = mode==="signup" ? await signUp(email, password, displayName) : await signIn(email, password);
      setLoading(false);
      if (result.ok) { onClose(); }
      else { setError(result.error || "Something went wrong. Please try again."); }
    }
    return (
      <ModalBox title={mode==="signin"?"Sign In to Anchor & Flow":"Create Your Account"} onClose={onClose}>
        <div style={{marginBottom:"0.75rem",color:T.textSoft,fontSize:"0.82rem",lineHeight:1.6}}>
          {mode==="signin"?"Sign in to sync with your household and restore your data across devices.":"Create an account to sync your household data across all devices and with family members."}
        </div>
        {mode==="signup"&&<div style={{marginBottom:"0.75rem"}}><label style={lbl}>Your name</label><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="e.g. Lindsey" style={inp()}/></div>}
        <div style={{marginBottom:"0.75rem"}}><label style={lbl}>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" style={inp()} autoFocus autoComplete="email"/></div>
        <div style={{marginBottom:"1rem"}}><label style={lbl}>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleSubmit();}} placeholder="••••••••" style={inp()} autoComplete={mode==="signup"?"new-password":"current-password"}/></div>
        {error&&<div style={{background:T.rosePale,border:"1.5px solid "+T.rose+"50",borderRadius:"0.65rem",padding:"0.6rem 0.85rem",marginBottom:"0.85rem",fontSize:"0.82rem",color:T.rose,fontWeight:600}}>{error}</div>}
        <button onClick={handleSubmit} disabled={loading} style={btnP("linear-gradient(135deg,"+T.blue+","+T.blueDark+")",{width:"100%",padding:"0.85rem",fontSize:"0.95rem",marginBottom:"0.75rem",opacity:loading?0.7:1})}>
          {loading ? "Please wait…" : mode==="signin" ? "Sign In & Sync" : "Create Account"}
        </button>
        <div style={{textAlign:"center"}}>
          <button onClick={()=>{setMode(m=>m==="signin"?"signup":"signin");setError("");}} style={{background:"none",border:"none",color:T.blue,cursor:"pointer",fontSize:"0.82rem",fontFamily:"inherit",fontWeight:600}}>
            {mode==="signin"?"Don't have an account? Sign up →":"Already have an account? Sign in →"}
          </button>
        </div>
      </ModalBox>
    );
  }

  // ── Household Modal ─────────────────────────────────────────────────────────
  function HouseholdModal({onClose}) {
    const [joinCode, setJoinCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopiedHH] = useState(false);
    const [lastSynced, setLastSynced] = useState(null);
    async function handleSync() {
      if (!authToken) return;
      setSyncing(true);
      try {
        if (!householdId) {
          const hid = "hh_" + uid();
          setHouseholdId(hid);
          await pushHouseholdData(authToken, hid);
          await persistHouseholdId(authToken, hid);
        } else {
          await pushHouseholdData(authToken, householdId);
        }
        setLastSynced(new Date().toLocaleTimeString());
        setSyncStatus("synced");
        setLastSyncTime(new Date().toLocaleTimeString());
      } catch(e) { setError("Sync failed: " + e.message); }
      setSyncing(false);
    }
    async function handleJoin() {
      if (!joinCode.trim()) { setError("Enter the household code from the other device."); return; }
      setLoading(true); setError("");
      const result = await joinHousehold(authToken, joinCode.trim());
      setLoading(false);
      if (!result.ok) setError(result.error || "Couldn't join that household.");
    }
    return (
      <ModalBox title="Family Household Sync" onClose={onClose} wide>
        <div style={{marginBottom:"1.2rem"}}>
          <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.blue,marginBottom:"0.6rem"}}>Your household code</div>
          <div style={{background:T.bluePale,border:"2px solid "+T.blue+"40",borderRadius:"0.9rem",padding:"1rem",display:"flex",alignItems:"center",gap:"0.75rem"}}>
            <div style={{flex:1}}>
              {householdId
                ? <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.1rem",fontWeight:700,color:T.textDark,wordBreak:"break-all"}}>{householdId}</div>
                : <div style={{fontSize:"0.85rem",color:T.textSoft,fontStyle:"italic"}}>No household yet — tap Generate to create one.</div>
              }
              <div style={{color:T.textSoft,fontSize:"0.74rem",marginTop:"0.2rem"}}>Share this code with your partner. They'll enter it on their device to join this household.</div>
            </div>
            {householdId
              ? <button onClick={()=>{navigator.clipboard?.writeText(householdId||"");setCopiedHH(true);setTimeout(()=>setCopiedHH(false),2000);}}
                  style={btnP(copied?T.sage:T.blue,{fontSize:"0.78rem",padding:"0.45rem 0.9rem",flexShrink:0})}>
                  {copied?"✓ Copied!":"Copy"}
                </button>
              : <button onClick={handleSync} disabled={syncing}
                  style={btnP(T.blue,{fontSize:"0.78rem",padding:"0.45rem 0.9rem",flexShrink:0,opacity:syncing?0.7:1})}>
                  {syncing?"Creating…":"Generate"}
                </button>
            }
          </div>
        </div>
        <div style={{borderTop:"1px solid "+T.borderSoft,paddingTop:"1.2rem",marginBottom:"1.2rem"}}>
          <div style={{fontSize:"0.63rem",fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",color:T.sage,marginBottom:"0.6rem"}}>Join a household</div>
          <div style={{color:T.textSoft,fontSize:"0.82rem",lineHeight:1.6,marginBottom:"0.75rem"}}>Have a household code from another device? Enter it here to sync and share all data.</div>
          <div style={{display:"flex",gap:"0.5rem"}}>
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="Paste household code…" style={{...inp({flex:1})}}/>
            <button onClick={handleJoin} disabled={loading} style={btnP(T.sage,{flexShrink:0,opacity:loading?0.7:1})}>
              {loading?"Joining…":"Join"}
            </button>
          </div>
          {error&&<div style={{marginTop:"0.6rem",fontSize:"0.8rem",color:T.rose,fontWeight:600}}>{error}</div>}
        </div>
        <div style={{background:T.sagePale,border:"1.5px solid "+T.sage+"40",borderRadius:"0.85rem",padding:"0.85rem 1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:"0.8rem",color:T.textMid,lineHeight:1.65}}>
            <strong style={{color:T.sageDark}}>How it works:</strong><br/>
            • Both people sign in with their own email + password<br/>
            • One person shares their household code<br/>
            • The other enters it to join — data syncs automatically every 60 seconds<br/>
            • Changes on either device appear on the other within a minute
          </div>
        </div>
        <div style={{display:"flex",gap:"0.5rem",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:"0.75rem",color:syncStatus==="synced"?T.sage:syncStatus==="syncing"?T.sand:T.textFaint,fontWeight:700}}>
            {syncStatus==="synced"&&"✓ Synced "+lastSyncTime}
            {syncStatus==="syncing"&&"⟳ Syncing…"}
            {syncStatus==="error"&&"⚠ Sync error"}
            {syncStatus==="idle"&&"Not synced yet"}
          </div>
          <div style={{display:"flex",gap:"0.4rem"}}>
            <button onClick={handleSync} style={btnS({fontSize:"0.78rem",padding:"0.35rem 0.8rem"})}>Sync now</button>
            <button onClick={onClose} style={btnP(T.blue,{fontSize:"0.78rem",padding:"0.35rem 0.8rem"})}>Done</button>
          </div>
        </div>
      </ModalBox>
    );
  }

  // ── Calendar Event Form Modal ────────────────────────────────────────────────
  function CalEventFormModal(){
    const[f,setF]=useState(calFormInit||{title:"",date:"",time:"",color:"#6A9BB5",colorLabel:"Blue",colorCustom:"",note:""});
    const prevMode=useRef(calFormMode);
    if(prevMode.current!==calFormMode){prevMode.current=calFormMode;if(calFormMode&&calFormInit)setF(calFormInit);}
    if(!calFormMode)return null;
    function handleSave(){
      if(!f.title||!f.date)return;
      const finalLabel=f.colorCustom.trim()||f.colorLabel;const ev={...f,colorLabel:finalLabel};
      if(calFormMode==="add")setCalEvents(p=>[...p,{id:uid(),...ev}]);
      else setCalEvents(p=>p.map(e=>e.id===calFormId?{...ev,id:calFormId}:e));
      // Set reminder if provided
      if(f.remindDate&&f.remindTime) {
        const eid = calFormMode==="add" ? (calEvents.length+"_new") : calFormId;
        addNotification(eid, f.title, f.remindDate, f.remindTime, f.note||"");
      }
      closeCalForm();setSelectedDay(null);
    }
    return(
      <ModalBox title={calFormMode==="add"?"Add Event":"Edit Event"} onClose={closeCalForm}>
        <div style={{marginBottom:"0.9rem"}}><label style={lbl}>Event Title</label><input value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} placeholder="e.g. Doctor appointment" style={inp()} autoFocus/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",marginBottom:"0.9rem"}}>
          <div><label style={lbl}>Date</label><input type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))} style={inp()}/></div>
          <div><label style={lbl}>Time (optional)</label><input type="time" value={f.time} onChange={e=>setF(p=>({...p,time:e.target.value}))} style={inp()}/></div>
        </div>
        <div style={{marginBottom:"0.9rem"}}><label style={lbl}>Note (optional)</label><textarea value={f.note||""} onChange={e=>setF(p=>({...p,note:e.target.value}))} placeholder="Any details, reminders…" style={{...inp({height:68,resize:"none"})}}/></div>
        {/* Inline reminder */}
        <div style={{marginBottom:"0.9rem",background:T.bgAlt,border:"1px solid "+T.border,borderRadius:"0.8rem",padding:"0.75rem 0.9rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.55rem"}}>
            <Icon name="bell" size={13} color={T.sand}/>
            <span style={{fontSize:"0.7rem",fontWeight:800,color:T.sandDark,textTransform:"uppercase",letterSpacing:"0.06em"}}>Set Reminder (optional)</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.45rem"}}>
            <input type="date" value={f.remindDate||""} onChange={e=>setF(p=>({...p,remindDate:e.target.value}))} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
            <input type="time" value={f.remindTime||""} onChange={e=>setF(p=>({...p,remindTime:e.target.value}))} style={inp({padding:"0.35rem 0.5rem",fontSize:"0.79rem"})}/>
          </div>
        </div>
        <div style={{marginBottom:"0.9rem"}}>
          <label style={lbl}>Colour</label>
          <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginBottom:"0.65rem"}}>
            {CAL_COLOR_OPTIONS.map(({color,label})=>(
              <button key={color} onClick={()=>setF(p=>({...p,color,colorLabel:label,colorCustom:""}))} title={label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.28rem",background:"none",border:"none",cursor:"pointer",padding:"0.2rem"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:color,border:f.color===color?`3px solid ${T.textDark}`:`3px solid transparent`,transition:"border 0.15s"}}/>
                <span style={{fontSize:"0.6rem",fontWeight:700,color:f.color===color?T.textDark:T.textSoft}}>{label}</span>
              </button>
            ))}
          </div>
          <input value={f.colorCustom||""} onChange={e=>setF(p=>({...p,colorCustom:e.target.value}))} placeholder={`Custom label e.g. "Kids", "Work"…`} style={inp()}/>
        </div>
        <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end"}}>
          <button onClick={closeCalForm} style={btnS()}>Cancel</button>
          <button onClick={handleSave} style={btnP(T.blue)}>{calFormMode==="add"?"Add Event":"Save Changes"}</button>
        </div>
      </ModalBox>
    );
  }

  // ── MAIN RENDER ────────────────────────────────────────────────────────────
  const primaryVisible=TABS.filter(t=>PRIMARY_TABS.includes(t.id)&&sections[t.id]!==false);
  const moreVisible=TABS.filter(t=>MORE_TABS.includes(t.id)&&(t.id==="settings"||sections[t.id]!==false));
  const activeInMore=moreVisible.some(t=>t.id===tab);

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${T.bg};font-family:'DM Sans',sans-serif;color:${T.textDark};transition:background 0.3s,color 0.3s}
        input,select,textarea{font-family:'DM Sans',sans-serif!important;color:${T.textDark}!important}
        input[type="date"],input[type="time"]{color-scheme:${themeName==="night"?"dark":"light"}}
        input:focus,select:focus,textarea:focus{border-color:${T.blue}!important;box-shadow:0 0 0 3px ${T.blue}22!important;outline:none}
        select option{background:${T.surface};color:${T.textDark}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:${T.bgAlt}}::-webkit-scrollbar-thumb{background:${T.blueLight};border-radius:4px}
        @keyframes fu{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}.fu{animation:fu 0.22s ease both}
        @keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1.1)}}
        [draggable]:active{cursor:grabbing!important}
      `}</style>

      <div style={{minHeight:"100vh",background:T.bg,paddingBottom:newShell?"0":"5.5rem",transition:"background 0.3s"}}>
        <div style={{background:T.topBg,borderBottom:`2px solid ${T.border}`,padding:"0.75rem 1.1rem",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:100,boxShadow:`0 2px 14px ${T.cardShadow}`}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.65rem"}}>
            <AnchorLogo size={36} color={T.blue}/>
            <div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.25rem",fontWeight:700,color:T.textDark,letterSpacing:"0.07em",textTransform:"uppercase",lineHeight:1.1}}>Anchor &amp; Flow</div>
              <div style={{color:T.textMid,fontSize:"0.75rem",fontStyle:"italic",fontFamily:"'Cormorant Garamond',serif",letterSpacing:"0.01em",fontWeight:500}}>A steadier home, in every season</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"0.45rem",flexWrap:"wrap",justifyContent:"flex-end"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.35rem",background:fm.bg,border:`2px solid ${fm.color}60`,borderRadius:"2rem",padding:"0.27rem 0.78rem"}}>
              <span style={{fontSize:"0.82rem"}}>{fm.emoji}</span>
              <span style={{color:fm.color,fontSize:"0.73rem",fontWeight:800}}>{flowMode}</span>
            </div>
            {authUser&&(
              <div style={{display:"flex",alignItems:"center",gap:"0.3rem",background:syncStatus==="synced"?T.sagePale:syncStatus==="syncing"?T.sandPale:T.bgAlt,border:`1.5px solid ${syncStatus==="synced"?T.sage+"50":syncStatus==="syncing"?T.sand+"50":T.borderSoft}`,borderRadius:"2rem",padding:"0.22rem 0.65rem",cursor:"pointer"}} onClick={()=>setShowHouseholdModal(true)}>
                <span style={{fontSize:"0.65rem"}}>{syncStatus==="synced"?"✓":syncStatus==="syncing"?"⟳":"⚠"}</span>
                <span style={{fontSize:"0.65rem",fontWeight:700,color:syncStatus==="synced"?T.sage:syncStatus==="syncing"?T.sand:T.textSoft}}>Sync</span>
              </div>
            )}
          </div>
        </div>

        <div style={{maxWidth:700,margin:"0 auto",padding:"1.1rem 0.9rem 0.5rem"}}>
          <div className="fu" key={tab}>
            {tab==="anchor"   && <>
              <AILayerNudge
                insights={insights}
                tab="anchor"
                onAction={(ins) => {
                  if (ins.type==="overload") lightenWeek();
                  else handleInsightAction(ins);
                }}
                onDismiss={dismissInsight}
              />
              <AnchorTab/>
            </>}
            {tab==="calendar" && <CalendarTab/>}
            {tab==="weekly"   && <>
              <AILayerNudge
                insights={insights}
                tab="weekly"
                onAction={() => lightenWeek()}
                onDismiss={dismissInsight}
              />
              <WeeklyTab/>
            </>}
            {tab==="meals"    && <>
              <AILayerNudge
                insights={insights}
                tab="meals"
                onAction={() => decideDinner()}
                onDismiss={dismissInsight}
              />
              <MealsTab/>
            </>}
            {tab==="shop"     && <ShoppingTab/>}
            {tab==="ai"       && <AILayerTab
              insights={insights}
              weekLoad={weekLoad}
              loading={aiLoading}
              aiThinking={aiThinking}
              onLightenWeek={lightenWeek}
              onDecideDinner={decideDinner}
              onReset={() => setTab("burnout")}
              onPlanDay={() => setTab("anchor")}
              onDismiss={dismissInsight}
              onRefresh={fetchInsights}
            />}
            {tab==="home"     && <HomeTab/>}
            {tab==="brain"    && <BrainTab/>}
            {tab==="burnout"  && <BurnoutTab/>}
            {tab==="settings" && <SettingsTab/>}
          </div>
        </div>

        {/* More drawer */}
        {moreDrawerOpen&&(
          <>
            <div onClick={()=>setMoreDrawerOpen(false)} style={{position:"fixed",inset:0,zIndex:98,background:"rgba(0,0,0,0.18)"}}/>
            <div style={{position:"fixed",bottom:"4.2rem",left:"50%",transform:"translateX(-50%)",width:"min(400px,calc(100vw - 1.5rem))",background:T.navBg,border:`1.5px solid ${T.border}`,borderRadius:"1.2rem 1.2rem 0.5rem 0.5rem",boxShadow:`0 -4px 28px ${T.cardShadow}`,zIndex:99,padding:"0.6rem 0.5rem 0.4rem"}}>
              <div style={{display:"flex",justifyContent:"center",marginBottom:"0.55rem"}}>
                <div style={{width:36,height:4,borderRadius:2,background:T.border}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-around",flexWrap:"wrap",gap:"0.3rem"}}>
                {moreVisible.map(t=>(
                  <button key={t.id} onClick={()=>{setTab(t.id);setMoreDrawerOpen(false);}} style={{background:tab===t.id?T.blue+"18":"transparent",border:`1.5px solid ${tab===t.id?T.blue+"60":T.border}`,borderRadius:"0.9rem",cursor:"pointer",padding:"0.55rem 0.9rem",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",minWidth:64,flex:"1 1 60px",transition:"all 0.14s"}}>
                    <span style={{fontSize:"1.1rem"}}>{t.emoji}</span>
                    <span style={{fontSize:"0.62rem",color:tab===t.id?T.blue:T.textMid,fontWeight:tab===t.id?800:600,letterSpacing:"0.02em",fontFamily:"inherit"}}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* PWA Install Banner */}
        {showInstallBanner&&!installDismissed&&(
          <div style={{position:"fixed",bottom:"4.5rem",left:"50%",transform:"translateX(-50%)",width:"min(420px,calc(100vw - 1.5rem))",background:`linear-gradient(135deg,${T.blue},${T.blueDark})`,borderRadius:"1.1rem",padding:"0.85rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",boxShadow:`0 8px 32px ${T.blue}50`,zIndex:200,animation:"fu 0.3s ease"}}>
            <AnchorLogo size={32} color="#fff"/>
            <div style={{flex:1}}>
              <div style={{color:"#fff",fontWeight:700,fontSize:"0.88rem",fontFamily:"'Cormorant Garamond',serif"}}>Add Anchor & Flow to your home screen</div>
              <div style={{color:"rgba(255,255,255,0.75)",fontSize:"0.72rem",marginTop:"0.1rem"}}>Works like an app — no App Store needed</div>
            </div>
            <div style={{display:"flex",gap:"0.4rem",flexShrink:0}}>
              <button onClick={handleInstall} style={{background:"#fff",color:T.blueDark,border:"none",borderRadius:"0.65rem",padding:"0.45rem 0.85rem",cursor:"pointer",fontWeight:700,fontSize:"0.78rem",fontFamily:"inherit"}}>Install</button>
              <button onClick={()=>{setShowInstallBanner(false);setInstallDismissed(true);}} style={{background:"rgba(255,255,255,0.2)",color:"#fff",border:"none",borderRadius:"0.65rem",padding:"0.45rem 0.6rem",cursor:"pointer",fontSize:"0.78rem",fontFamily:"inherit"}}>✕</button>
            </div>
          </div>
        )}

        {/* Bottom nav bar — Option C */}
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.navBg,borderTop:`2px solid ${T.border}`,display:"flex",justifyContent:"space-around",padding:"0.38rem 0 0.55rem",zIndex:100,boxShadow:`0 -2px 14px ${T.cardShadow}`}}>
          {primaryVisible.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setMoreDrawerOpen(false);}} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",padding:"0.3rem 0.5rem",minWidth:0,flex:1}}>
              <span style={{fontSize:"1.05rem",filter:tab===t.id?"none":"grayscale(0.4)",opacity:tab===t.id?1:0.5,transition:"all 0.15s"}}>{t.emoji}</span>
              <span style={{fontSize:"0.58rem",color:tab===t.id?T.blue:T.textFaint,fontWeight:tab===t.id?800:500,letterSpacing:"0.02em",whiteSpace:"nowrap",transition:"color 0.15s"}}>{t.label}</span>
              {tab===t.id&&<div style={{width:18,height:2.5,borderRadius:2,background:T.blue,marginTop:1}}/>}
            </button>
          ))}
          <button onClick={()=>setMoreDrawerOpen(o=>!o)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",padding:"0.3rem 0.5rem",minWidth:0,flex:1}}>
            <div style={{display:"flex",gap:3,alignItems:"center",height:"1.05rem",opacity:moreDrawerOpen||activeInMore?1:0.45,transition:"opacity 0.15s"}}>
              {[0,1,2].map(i=><div key={i} style={{width:4,height:4,borderRadius:"50%",background:moreDrawerOpen||activeInMore?T.blue:T.textMid,transition:"background 0.15s"}}/>)}
            </div>
            <span style={{fontSize:"0.58rem",color:moreDrawerOpen||activeInMore?T.blue:T.textFaint,fontWeight:moreDrawerOpen||activeInMore?800:500,letterSpacing:"0.02em",transition:"color 0.15s"}}>
              {activeInMore&&!moreDrawerOpen?TABS.find(t=>t.id===tab)?.label:"More"}
            </span>
            {activeInMore&&<div style={{width:18,height:2.5,borderRadius:2,background:T.blue,marginTop:1}}/>}
          </button>
        </div>
      </div>

      {/* AI chat button */}
      <button onClick={()=>setChatOpen(o=>!o)} title="Anchor & Flow AI" style={{position:"fixed",bottom:"5.6rem",right:"1rem",width:54,height:54,borderRadius:"50%",background:`linear-gradient(135deg,${T.blue},${T.blueDark})`,border:`2px solid ${T.blueLight}`,boxShadow:`0 4px 22px ${T.blue}60`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:499,transition:"all 0.2s"}}>
        <AnchorLogo size={30} color="#fff"/>
      </button>
      {chatOpen&&<AIChatPanel onClose={()=>setChatOpen(false)}/>}
      {showEndOfDay&&<EndOfDayReset/>}
      {showBriefing&&<DailyBriefingModal onClose={()=>setShowBriefing(false)}/>}
      {shouldShowOnboarding&&<OnboardingWizard onComplete={()=>{setShowOnboardingWizard(false);buildDailyBriefing();}}/>}
      {showAuthModal&&<AuthModal onClose={()=>setShowAuthModal(false)}/>}
      {showHouseholdModal&&<HouseholdModal onClose={()=>setShowHouseholdModal(false)}/>}
      <CalEventFormModal/>

      {modal==="share"&&(
        <ModalBox title="Share Today's Briefing" onClose={close} wide>
          <textarea readOnly value={shareText()} style={{...inp({height:240,fontFamily:"monospace",fontSize:"0.77rem",resize:"none",lineHeight:1.72})}}/>
          <div style={{display:"flex",gap:"0.5rem",justifyContent:"flex-end",marginTop:"0.85rem"}}>
            <button onClick={close} style={btnS()}>Close</button>
            <button onClick={()=>{navigator.clipboard?.writeText(shareText());setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={btnP(copied?T.sage:T.blue,{color:"#fff"})}>{copied?"✓ Copied!":"Copy to Clipboard"}</button>
          </div>
        </ModalBox>
      )}
      {modal==="calSync"&&(
        <GoogleCalendarModal onClose={close}/>
      )}

      {/* ── AILayer floating button + drawer ───────────────────────────────
          To remove AILayer: delete this block + the import + the useAILayer
          hook call + the AILayerNudge wrappers + the tab==="ai" case above. */}
      <AILayerDrawer
        insights={insights}
        aiThinking={aiThinking}
        onDismiss={dismissInsight}
        onPrimary={handleInsightAction}
        onOpenTab={() => setTab("ai")}
        activeTab={tab}
      />

    </>
  );
}

export { HomeFlow }
export default function App() {
  return <ErrorBoundary><HomeFlow /></ErrorBoundary>;
}
