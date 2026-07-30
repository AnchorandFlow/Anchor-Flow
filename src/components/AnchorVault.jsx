import React, { useState, useEffect, useRef } from "react"
import MomentsSection from "./MomentsSection"
import DosingTracker from "./DosingTracker"
import RipplesRoom from "../shell/RipplesRoom"
import SafeHarbor from "../shell/SafeHarbor"
// CareerSection is defined inline below

// ── Safe URL helper — prevents invalid URLs from crashing the PWA ─────────────
function safeUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  var s = raw.trim();
  if (!s) return null;
  // Already has a valid scheme
  if (/^https?:\/\//i.test(s)) {
    try { new URL(s); return s; } catch(e) { return null; }
  }
  // Looks like a domain (contains a dot, no spaces)
  if (/^[^\s]+\.[^\s]+/.test(s) && !s.includes(" ")) {
    try { new URL("https://" + s); return "https://" + s; } catch(e) { return null; }
  }
  return null;
}

// ── Global input/select color fix (prevents browser black-text override) ──────
const VAULT_INPUT_STYLE = `
  .af-vault input, .af-vault select, .af-vault textarea {
    color: #faf8f4 !important;
    caret-color: #c8a97a !important;
  }
  .af-vault input::placeholder, .af-vault textarea::placeholder {
    color: rgba(250,248,244,0.35) !important;
  }
  .af-vault select option {
    background: #243A5A;
    color: #faf8f4;
  }
  .af-vault input:-webkit-autofill,
  .af-vault input:-webkit-autofill:focus {
    -webkit-text-fill-color: #faf8f4 !important;
    -webkit-box-shadow: 0 0 0px 1000px #2E486B inset !important;
    transition: background-color 5000s ease-in-out 0s;
  }
`

const NAV = [
  { id: "home",      label: "Home",      icon: "home", emoji: "🏠" },
  { id: "inventory", label: "Inventory", icon: "inv",  emoji: "📦" },
  { id: "systems",   label: "Maintenance",   icon: "sys",  emoji: "🔧" },
  { id: "health",    label: "Health",    icon: "hlth", emoji: "🩺" },
  { id: "career",    label: "Career",    icon: "car",  emoji: "📋" },
  { id: "subs",      label: "Subs",      icon: "sub",  emoji: "🔄" },
  { id: "gifts",     label: "Celebrate", icon: "gift", emoji: "🎉" },
  { id: "pets",      label: "Pets",      icon: "pet",  emoji: "🐾" },
  { id: "ripple",    label: "Ripple",    icon: "rip",  emoji: "🌊" },
  { id: "settings",  label: "Settings",  icon: "set",  emoji: "⚙️" },
]

// ── Subcategory definitions per main category ────────────────────────────────
const SUBCATS = {
  pantry: [
    { id: "baking",    label: "Baking Supplies",       icon: "🧁" },
    { id: "spices",    label: "Spices & Seasonings",   icon: "🧂" },
    { id: "dried",     label: "Dried Goods",           icon: "🫙" },
    { id: "snacks",    label: "Snacks",                icon: "🍿" },
    { id: "canned",    label: "Canned & Jarred",       icon: "🥫" },
    { id: "condiments",label: "Condiments & Oils",     icon: "🫒" },
    { id: "drinks",    label: "Drinks & Coffee",       icon: "☕" },
    { id: "other",     label: "Other",                 icon: "📦" },
  ],
  freezer: [
    { id: "meats",     label: "Meats & Seafood",       icon: "🥩" },
    { id: "veggies",   label: "Vegetables",            icon: "🥦" },
    { id: "fruits",    label: "Fruits",                icon: "🍓" },
    { id: "meals",     label: "Meals & Leftovers",     icon: "🍱" },
    { id: "breads",    label: "Breads & Doughs",       icon: "🥖" },
    { id: "treats",    label: "Treats & Desserts",     icon: "🍦" },
    { id: "other",     label: "Other",                 icon: "📦" },
  ],
  fridge: [
    { id: "dairy",     label: "Dairy & Eggs",          icon: "🥛" },
    { id: "produce",   label: "Fresh Produce",         icon: "🥬" },
    { id: "proteins",  label: "Proteins",              icon: "🍗" },
    { id: "leftovers", label: "Leftovers",             icon: "🍲" },
    { id: "drinks",    label: "Drinks & Juices",       icon: "🧃" },
    { id: "condiments",label: "Condiments",            icon: "🫙" },
    { id: "other",     label: "Other",                 icon: "📦" },
  ],
  medications: [
    { id: "otc",       label: "OTC Medicine",          icon: "💊" },
    { id: "vitamins",  label: "Vitamins & Supplements",icon: "🌿" },
    { id: "firstaid",  label: "First Aid",             icon: "🩹" },
    { id: "other",     label: "Other",                 icon: "📦" },
  ],
  cosmetics: [
    { id: "hair",      label: "Hair Care",             icon: "💆" },
    { id: "skin",      label: "Skin Care",             icon: "🧴" },
    { id: "body",      label: "Body Care",             icon: "🚿" },
    { id: "dental",    label: "Dental",                icon: "🦷" },
    { id: "other",     label: "Other",                 icon: "📦" },
  ],
  cleaning: [
    { id: "kitchen",   label: "Kitchen",               icon: "🍽️" },
    { id: "laundry",   label: "Laundry",               icon: "🧺" },
    { id: "bathroom",  label: "Bathroom",              icon: "🚿" },
    { id: "surfaces",  label: "Surfaces & Floors",     icon: "🧹" },
    { id: "other",     label: "Other",                 icon: "📦" },
  ],
  paper: [
    { id: "paper",     label: "Paper Products",        icon: "🧻" },
    { id: "bags",      label: "Bags & Wraps",          icon: "🛍️" },
    { id: "other",     label: "Other",                 icon: "📦" },
  ],
  pet: [
    { id: "food",      label: "Food & Treats",         icon: "🐾" },
    { id: "hygiene",   label: "Hygiene & Grooming",    icon: "🛁" },
    { id: "supplies",  label: "Supplies",              icon: "🎾" },
    { id: "other",     label: "Other",                 icon: "📦" },
  ],
}

const DEFAULTS = {
  pantry: [
    { name: "All-purpose flour",   subcat: "baking" },
    { name: "Granulated sugar",    subcat: "baking" },
    { name: "Brown sugar",         subcat: "baking" },
    { name: "Baking powder",       subcat: "baking" },
    { name: "Baking soda",         subcat: "baking" },
    { name: "Vanilla extract",     subcat: "baking" },
    { name: "Cocoa powder",        subcat: "baking" },
    { name: "Salt",                subcat: "spices" },
    { name: "Black pepper",        subcat: "spices" },
    { name: "Garlic powder",       subcat: "spices" },
    { name: "Onion powder",        subcat: "spices" },
    { name: "Cumin",               subcat: "spices" },
    { name: "Paprika",             subcat: "spices" },
    { name: "Italian seasoning",   subcat: "spices" },
    { name: "Cinnamon",            subcat: "spices" },
    { name: "Chili powder",        subcat: "spices" },
    { name: "Red pepper flakes",   subcat: "spices" },
    { name: "Pasta",               subcat: "dried" },
    { name: "Rice",                subcat: "dried" },
    { name: "Oats",                subcat: "dried" },
    { name: "Quinoa",              subcat: "dried" },
    { name: "Lentils",             subcat: "dried" },
    { name: "Dried black beans",   subcat: "dried" },
    { name: "Panko breadcrumbs",   subcat: "dried" },
    { name: "Crackers",            subcat: "snacks" },
    { name: "Peanut butter",       subcat: "snacks" },
    { name: "Granola bars",        subcat: "snacks" },
    { name: "Popcorn",             subcat: "snacks" },
    { name: "Mixed nuts",          subcat: "snacks" },
    { name: "Cereal",              subcat: "snacks" },
    { name: "Canned tomatoes",     subcat: "canned" },
    { name: "Canned black beans",  subcat: "canned" },
    { name: "Canned chickpeas",    subcat: "canned" },
    { name: "Chicken broth",       subcat: "canned" },
    { name: "Coconut milk",        subcat: "canned" },
    { name: "Tomato paste",        subcat: "canned" },
    { name: "Canned tuna",         subcat: "canned" },
    { name: "Olive oil",           subcat: "condiments" },
    { name: "Vegetable oil",       subcat: "condiments" },
    { name: "Honey",               subcat: "condiments" },
    { name: "Soy sauce",           subcat: "condiments" },
    { name: "Hot sauce",           subcat: "condiments" },
    { name: "Apple cider vinegar", subcat: "condiments" },
    { name: "Maple syrup",         subcat: "condiments" },
    { name: "Coffee",              subcat: "drinks" },
    { name: "Tea bags",            subcat: "drinks" },
  ],
  freezer: [
    { name: "Chicken breasts",      subcat: "meats" },
    { name: "Ground beef",          subcat: "meats" },
    { name: "Chicken thighs",       subcat: "meats" },
    { name: "Salmon fillets",       subcat: "meats" },
    { name: "Shrimp",               subcat: "meats" },
    { name: "Italian sausage",      subcat: "meats" },
    { name: "Ground turkey",        subcat: "meats" },
    { name: "Frozen broccoli",      subcat: "veggies" },
    { name: "Frozen peas",          subcat: "veggies" },
    { name: "Frozen corn",          subcat: "veggies" },
    { name: "Stir fry vegetables",  subcat: "veggies" },
    { name: "Edamame",              subcat: "veggies" },
    { name: "Frozen spinach",       subcat: "veggies" },
    { name: "Frozen mixed berries", subcat: "fruits" },
    { name: "Frozen mango chunks",  subcat: "fruits" },
    { name: "Frozen banana slices", subcat: "fruits" },
    { name: "Backup burritos",      subcat: "meals" },
    { name: "Frozen pizza",         subcat: "meals" },
    { name: "Leftovers container",  subcat: "meals" },
    { name: "Frozen waffles",       subcat: "breads" },
    { name: "Bread loaf",           subcat: "breads" },
    { name: "Tortillas",            subcat: "breads" },
    { name: "Ice cream",            subcat: "treats" },
    { name: "Popsicles",            subcat: "treats" },
  ],
  fridge: [
    { name: "Eggs",              subcat: "dairy" },
    { name: "Butter",            subcat: "dairy" },
    { name: "Whole milk",        subcat: "dairy" },
    { name: "Shredded cheese",   subcat: "dairy" },
    { name: "Greek yogurt",      subcat: "dairy" },
    { name: "Cream cheese",      subcat: "dairy" },
    { name: "Sour cream",        subcat: "dairy" },
    { name: "Parmesan",          subcat: "dairy" },
    { name: "Salad greens",      subcat: "produce" },
    { name: "Carrots",           subcat: "produce" },
    { name: "Bell peppers",      subcat: "produce" },
    { name: "Celery",            subcat: "produce" },
    { name: "Lemons",            subcat: "produce" },
    { name: "Fresh garlic",      subcat: "produce" },
    { name: "Yellow onions",     subcat: "produce" },
    { name: "Apples",            subcat: "produce" },
    { name: "Grapes",            subcat: "produce" },
    { name: "Deli turkey",       subcat: "proteins" },
    { name: "Bacon",             subcat: "proteins" },
    { name: "Hummus",            subcat: "proteins" },
    { name: "Orange juice",      subcat: "drinks" },
    { name: "Ketchup",           subcat: "condiments" },
    { name: "Mustard",           subcat: "condiments" },
    { name: "Mayo",              subcat: "condiments" },
    { name: "Salad dressing",    subcat: "condiments" },
    { name: "Salsa",             subcat: "condiments" },
  ],
  medications: [
    { name: "Ibuprofen",          subcat: "otc" },
    { name: "Acetaminophen",      subcat: "otc" },
    { name: "Children's Tylenol", subcat: "otc" },
    { name: "Cold medicine",      subcat: "otc" },
    { name: "Allergy medicine",   subcat: "otc" },
    { name: "Antacid (Tums)",     subcat: "otc" },
    { name: "Cough syrup",        subcat: "otc" },
    { name: "Multivitamin",       subcat: "vitamins" },
    { name: "Vitamin D",          subcat: "vitamins" },
    { name: "Fish oil / Omega-3", subcat: "vitamins" },
    { name: "Magnesium",          subcat: "vitamins" },
    { name: "Probiotics",         subcat: "vitamins" },
    { name: "Band-aids (assorted)",subcat: "firstaid" },
    { name: "Gauze pads",         subcat: "firstaid" },
    { name: "Antiseptic spray",   subcat: "firstaid" },
    { name: "Digital thermometer",subcat: "firstaid" },
    { name: "Medical tape",       subcat: "firstaid" },
    { name: "Instant ice pack",   subcat: "firstaid" },
  ],
  cosmetics: [
    { name: "Shampoo",           subcat: "hair" },
    { name: "Conditioner",       subcat: "hair" },
    { name: "Dry shampoo",       subcat: "hair" },
    { name: "Hair ties",         subcat: "hair" },
    { name: "Face wash",         subcat: "skin" },
    { name: "Moisturizer",       subcat: "skin" },
    { name: "Sunscreen SPF 50",  subcat: "skin" },
    { name: "Eye cream",         subcat: "skin" },
    { name: "Lip balm",          subcat: "skin" },
    { name: "Body wash",         subcat: "body" },
    { name: "Body lotion",       subcat: "body" },
    { name: "Deodorant",         subcat: "body" },
    { name: "Razor / blades",    subcat: "body" },
    { name: "Toothpaste",        subcat: "dental" },
    { name: "Toothbrush",        subcat: "dental" },
    { name: "Floss",             subcat: "dental" },
    { name: "Mouthwash",         subcat: "dental" },
  ],
  cleaning: [
    { name: "Dish soap",           subcat: "kitchen" },
    { name: "Dishwasher pods",     subcat: "kitchen" },
    { name: "Sponges",             subcat: "kitchen" },
    { name: "Scrub brush",         subcat: "kitchen" },
    { name: "Laundry detergent",   subcat: "laundry" },
    { name: "Dryer sheets",        subcat: "laundry" },
    { name: "Stain remover",       subcat: "laundry" },
    { name: "Fabric softener",     subcat: "laundry" },
    { name: "Toilet bowl cleaner", subcat: "bathroom" },
    { name: "Shower spray",        subcat: "bathroom" },
    { name: "Bleach",              subcat: "bathroom" },
    { name: "All-purpose spray",   subcat: "surfaces" },
    { name: "Glass cleaner",       subcat: "surfaces" },
    { name: "Mop pads / Swiffer",  subcat: "surfaces" },
    { name: "Microfiber cloths",   subcat: "surfaces" },
    { name: "Vacuum bags / filter",subcat: "surfaces" },
  ],
  paper: [
    { name: "Paper towels",   subcat: "paper" },
    { name: "Toilet paper",   subcat: "paper" },
    { name: "Facial tissues", subcat: "paper" },
    { name: "Napkins",        subcat: "paper" },
    { name: "Trash bags (tall)",   subcat: "bags" },
    { name: "Trash bags (small)",  subcat: "bags" },
    { name: "Gallon zip bags",     subcat: "bags" },
    { name: "Quart zip bags",      subcat: "bags" },
    { name: "Aluminum foil",       subcat: "bags" },
    { name: "Plastic wrap",        subcat: "bags" },
    { name: "Parchment paper",     subcat: "bags" },
  ],
  pet: [
    { name: "Dog food / Cat food", subcat: "food" },
    { name: "Pet treats",          subcat: "food" },
    { name: "Wet food (canned)",   subcat: "food" },
    { name: "Pet water bowl",      subcat: "supplies" },
    { name: "Poop bags",           subcat: "supplies" },
    { name: "Cat litter",          subcat: "supplies" },
    { name: "Pet shampoo",         subcat: "hygiene" },
    { name: "Flea & tick treatment",subcat: "hygiene" },
    { name: "Pet brush / comb",    subcat: "hygiene" },
  ],
}


const CATS = [
  { id: "pantry",      label: "Pantry",       icon: "🌾" },
  { id: "freezer",     label: "Freezer",      icon: "❄️" },
  { id: "fridge",      label: "Fridge",       icon: "🧊" },
  { id: "medications", label: "Medications",  icon: "💊" },
  { id: "cosmetics",   label: "Cosmetics",    icon: "🪞" },
  { id: "cleaning",    label: "Cleaning",     icon: "🧹" },
  { id: "paper",       label: "Paper Goods",  icon: "🧻" },
  { id: "pet",         label: "Pet Supplies", icon: "🐾" },
]

// Best-guess subcat for an item name when migrating old data
function guessSubcat(catId, itemName) {
  var n = itemName.toLowerCase()
  var maps = {
    pantry: [
      ["baking",     ["flour","sugar","baking","vanilla","cocoa","yeast","salt","powder","soda","cornstarch","syrup","molasses","honey","extract"]],
      ["spices",     ["pepper","cumin","paprika","oregano","basil","thyme","cinnamon","turmeric","chili","seasoning","spice","herb","garlic powder","onion powder","bay","rosemary","cayenne"]],
      ["dried",      ["pasta","rice","oat","lentil","quinoa","bean","chickpea","noodle","barley","couscous","farro","grain","cereal"]],
      ["snacks",     ["cracker","chip","popcorn","pretzel","granola","bar","nut","almond","cashew","peanut butter","trail","jerky","cookie","biscuit"]],
      ["canned",     ["canned","tomato","broth","stock","soup","sauce","salsa","jar","pickl","olive","corn","tuna","salmon","sardine"]],
      ["condiments", ["oil","vinegar","soy","mustard","ketchup","mayo","dressing","hot sauce","worcestershire","tahini","miso"]],
      ["drinks",     ["coffee","tea","cocoa mix","hot chocolate","drink","juice","broth"]],
    ],
    freezer: [
      ["meats",    ["chicken","beef","pork","turkey","fish","salmon","shrimp","ground","steak","sausage","bacon","meat","seafood","lamb"]],
      ["veggies",  ["vegetable","veg","pea","corn","carrot","broccoli","spinach","edamame","kale","green bean","lima","stir fry","mix"]],
      ["fruits",   ["fruit","berry","strawberry","mango","peach","pineapple","cherry","blueberry","raspberry","banana"]],
      ["meals",    ["meal","burrito","pizza","lasagna","soup","stew","leftover","casserole","dinner","entrée","entree","backup"]],
      ["breads",   ["bread","dough","waffle","pancake","bagel","roll","bun","tortilla","biscuit","croissant","pretzel"]],
      ["treats",   ["ice cream","gelato","sorbet","popsicle","dessert","treat","cake","pie","cookie","yogurt bar"]],
    ],
    fridge: [
      ["dairy",     ["egg","butter","milk","cheese","yogurt","cream","creamer","sour cream","kefir","cottage","whipped","half"]],
      ["produce",   ["lettuce","salad","greens","carrot","celery","cucumber","pepper","tomato","onion","herb","cilantro","parsley","lemon","lime","apple","berry","grape","strawberry","produce","fruit","veg"]],
      ["proteins",  ["chicken","beef","deli","turkey","ham","bacon","sausage","tofu","tempeh","hummus","meat","fish","salmon"]],
      ["leftovers", ["leftover","leftover","soup","stew","casserole","pasta","rice","cooked"]],
      ["drinks",    ["juice","drink","water","kombucha","soda","lemonade","tea","milk alternative","oat milk","almond milk"]],
      ["condiments",["ketchup","mustard","mayo","sauce","dressing","pickle","jam","jelly","jello","syrup","hot sauce","butter","spread"]],
    ],
    medications: [
      ["otc",      ["ibuprofen","acetaminophen","tylenol","advil","aspirin","medicine","cold","flu","antacid","pepto","allergy","antihistamine","cough","sleep"]],
      ["vitamins", ["vitamin","supplement","probiotic","omega","zinc","iron","magnesium","calcium","multivitamin","fish oil","collagen","biotin","melatonin"]],
      ["firstaid", ["band","bandage","gauze","antiseptic","neosporin","thermometer","wrap","brace","tape","syringe","ice pack","heating"]],
    ],
    cosmetics: [
      ["hair",   ["shampoo","conditioner","hair","dry shampoo","mousse","gel","serum","mask","treatment","color","dye","spray"]],
      ["skin",   ["face","moisturizer","lotion","serum","toner","exfoliant","mask","cleanser","wash","retinol","sunscreen","spf","eye cream","foundation","concealer","primer"]],
      ["body",   ["body","wash","lotion","butter","deodorant","antiperspirant","scrub","soap","bath","shower"]],
      ["dental", ["toothpaste","toothbrush","floss","mouthwash","whitening","dental","teeth"]],
    ],
    cleaning: [
      ["kitchen",  ["dish","sponge","scrub","kitchen","grease","oven","microwave","dishwasher"]],
      ["laundry",  ["laundry","detergent","fabric","softener","dryer","stain","bleach pod","washing"]],
      ["bathroom", ["toilet","bathroom","shower","tub","mildew","tile","bleach"]],
      ["surfaces", ["all-purpose","multi","spray","wipe","floor","mop","dust","glass","window","furniture"]],
    ],
    paper: [
      ["paper",  ["paper towel","toilet paper","tissue","napkin","coffee filter","paper plate","cup"]],
      ["bags",   ["trash bag","zip","ziploc","foil","plastic wrap","parchment","wax paper","sandwich bag","storage bag","gallon","freezer bag"]],
    ],
    pet: [
      ["food",    ["food","treat","kibble","wet food","can","bone","chew","snack"]],
      ["hygiene", ["shampoo","flea","tick","grooming","brush","nail","ear","dental","wipe","collar","spray"]],
      ["supplies",["litter","bag","toy","leash","bowl","crate","pad","mat","cage"]],
    ],
  }
  var catMap = maps[catId]
  if (!catMap) return "other"
  for (var i = 0; i < catMap.length; i++) {
    var subcatId = catMap[i][0]
    var keywords = catMap[i][1]
    for (var j = 0; j < keywords.length; j++) {
      if (n.indexOf(keywords[j]) !== -1) return subcatId
    }
  }
  return "other"
}

function migrateInventory(saved) {
  if (!saved) return null
  const keys = Object.keys(saved)
  // Check if already migrated to subcategory format (items have subcat field)
  const hasFreezerKey = keys.includes("freezer")
  if (hasFreezerKey) {
    // May need subcat migration — add subcat:"other" to any items missing it
    const needsSubcatMigration = Object.entries(saved).some(function(entry) {
      return (entry[1] || []).some(function(i) { return typeof i === "object" && i.subcat === undefined })
    })
    if (!needsSubcatMigration) return saved
    // Add subcat:"other" to items that don't have one
    const patched = {}
    Object.keys(saved).forEach(function(k) {
      patched[k] = (saved[k] || []).map(function(i) {
        if (typeof i === "string") return { name: i, stocked: true, subcat: guessSubcat(k, i) }
        return i.subcat ? i : { ...i, subcat: guessSubcat(k, i.name || "") }
      })
    })
    return patched
  }
  // Full migration from old format
  const migrated = {}
  const NEW_KEYS = ["pantry","freezer","fridge","medications","cosmetics","cleaning","paper","pet"]
  NEW_KEYS.forEach(function(k) {
    if (saved[k]) {
      migrated[k] = saved[k].map(function(i) {
        return { name: typeof i==="string"?i:i.name, stocked: i.stocked!==undefined?i.stocked:true, qty: i.qty??null, threshold: i.threshold??null, subcat: guessSubcat(k, typeof i==="string"?i:i.name||"") }
      })
    } else {
      migrated[k] = DEFAULTS[k].map(function(d) { return { name: d.name, stocked: true, subcat: d.subcat } })
    }
  })
  if (saved.household) {
    const hh = saved.household.map(function(i) { return { name: typeof i==="string"?i:i.name, stocked: i.stocked!==undefined?i.stocked:true, subcat: "other" } })
    migrated.cleaning = [...migrated.cleaning, ...hh.filter(function(i) { return !migrated.cleaning.find(function(x) { return x.name===i.name }) })]
  }
  if (saved.pharmacy) {
    const rx = saved.pharmacy.map(function(i) { return { name: typeof i==="string"?i:i.name, stocked: i.stocked!==undefined?i.stocked:true, subcat: "other" } })
    migrated.medications = [...migrated.medications, ...rx.filter(function(i) { return !migrated.medications.find(function(x) { return x.name===i.name }) })]
  }
  return migrated
}

function InventorySection({ onAddToShopping }) {
  const [items, setItems] = useState(function() {
    try {
      const saved = JSON.parse(localStorage.getItem("af_inventory") || "null")
      const migrated = migrateInventory(saved)
      if (migrated) {
        try { localStorage.setItem("af_inventory", JSON.stringify(migrated)) } catch {}
        return migrated
      }
    } catch {}
    const init = {}
    Object.keys(DEFAULTS).forEach(function(k) {
      init[k] = DEFAULTS[k].map(function(d) { return { name: d.name, stocked: true, subcat: d.subcat } })
    })
    return init
  })
  React.useEffect(function() {
    function onRefresh(e) {
      if (!e.detail?.key || e.detail.key === "inventory") {
        try {
          var saved = JSON.parse(localStorage.getItem("af_inventory") || "null")
          var migrated = migrateInventory(saved)
          if (migrated) { setItems(migrated) }
        } catch {}
      }
    }
    window.addEventListener("af-data-changed", onRefresh)
    return function() { window.removeEventListener("af-data-changed", onRefresh) }
  }, [])
  const [activeTab, setActiveTab] = useState("inventory")
  const [activeCat, setActiveCat] = useState("pantry")
  const [toast, setToast] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState("")

  // inline quick-add per subcategory: { "pantry:baking": "Cocoa powder" }
  const [inlineAdding, setInlineAdding] = useState({})
  const [inlineVal, setInlineVal] = useState({})

  // Simple HTML5 drag-to-reorder
  const dragFrom = React.useRef(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  // collapsed subcategories: { "pantry:baking": true, ... }
  // Reset on mount so nothing is pre-hidden (clears any bad state from previous sessions)
  const [collapsedSubs, setCollapsedSubs] = useState({})
  const [invAZ, setInvAZ] = useState(false)
  React.useEffect(function() {
    try { localStorage.removeItem("af_inv_collapsed") } catch {}
  }, [])

  function toggleSubcat(catId, subcatId) {
    const key = catId + ":" + subcatId
    const updated = { ...collapsedSubs, [key]: !collapsedSubs[key] }
    setCollapsedSubs(updated)
    try { localStorage.setItem("af_inv_collapsed", JSON.stringify(updated)) } catch {}
  }

  const FAV_SUBCATS = [
    { id: "all",       label: "All",       icon: "⭐" },
    { id: "grocery",   label: "Grocery",   icon: "🛒" },
    { id: "beauty",    label: "Beauty",    icon: "💄" },
    { id: "cosmetics", label: "Cosmetics", icon: "🧴" },
    { id: "home",      label: "Home",      icon: "🏡" },
    { id: "diy",       label: "DIY",       icon: "🔧" },
    { id: "health",    label: "Health",    icon: "💊" },
    { id: "pet",       label: "Pet",       icon: "🐾" },
    { id: "other",     label: "Other",     icon: "📦" },
  ]

  const [favorites, setFavorites] = useState(function() {
    try { return JSON.parse(localStorage.getItem("af_favProducts") || "[]") } catch { return [] }
  })
  const [addingFav, setAddingFav] = useState(false)
  const [favSubcat, setFavSubcat] = useState("all")
  const [favForm, setFavForm] = useState({ name: "", brand: "", store: "", notes: "", url: "", emoji: "⭐", subcat: "grocery", photo: null })
  const FAV_EMOJIS = ["⭐","🧴","🧺","🫙","🥫","🧹","🧻","🧼","🍳","💊","🐾","🌿","☕","🧃","🫧","💄","🔧","🏡","🪴","🕯️"]
  const favPhotoRef = React.useRef(null)

  function saveFavs(updated) {
    setFavorites(updated)
    try { localStorage.setItem("af_favProducts", JSON.stringify(updated)) } catch {}
  }

  function handleFavPhoto(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = function(ev) {
      setFavForm(function(p) { return { ...p, photo: ev.target.result } })
    }
    reader.readAsDataURL(file)
  }

  function save(updated) {
    setItems(updated)
    afVaultChanged("inventory");
    try { localStorage.setItem("af_inventory", JSON.stringify(updated)) } catch {}
  }

  function toggle(globalIdx) {
    const cat = activeCat
    const updated = { ...items, [cat]: items[cat].map(function(x, i) { return i === globalIdx ? { ...x, stocked: !x.stocked } : x }) }
    const item = updated[cat][globalIdx]
    if (!item.stocked) {
      onAddToShopping(item.name)
      setToast(item.name + " added to shopping list")
      setTimeout(function() { setToast(null) }, 2500)
    }
    save(updated)
  }

  function deleteItem(globalIdx) {
    const updated = { ...items, [activeCat]: items[activeCat].filter(function(_, i) { return i !== globalIdx }) }
    save(updated)
  }

  function renameItem(globalIdx) {
    if (!editVal.trim()) return
    const updated = { ...items, [activeCat]: items[activeCat].map(function(x, i) { return i === globalIdx ? { ...x, name: editVal.trim() } : x }) }
    save(updated)
    setEditing(null)
    setEditVal("")
  }

  // Inline add per subcategory
  function addInlineItem(subcatId) {
    const key = activeCat + ":" + subcatId
    const val = (inlineVal[key] || "").trim()
    if (!val) { setInlineAdding(function(p) { var n = {...p}; delete n[key]; return n }); return }
    const updated = { ...items, [activeCat]: [...(items[activeCat] || []), { name: val, stocked: true, subcat: subcatId }] }
    save(updated)
    setInlineVal(function(p) { var n = {...p}; delete n[key]; return n })
    setInlineAdding(function(p) { var n = {...p}; delete n[key]; return n })
  }

  function openInlineAdd(subcatId) {
    const key = activeCat + ":" + subcatId
    // make sure subcat is expanded
    const colKey = activeCat + ":" + subcatId
    if (collapsedSubs[colKey]) toggleSubcat(activeCat, subcatId)
    setInlineAdding(function(p) { return { ...p, [key]: true } })
  }

  function onDragStart(e, idx) {
    dragFrom.current = idx
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", String(idx))
  }

  function onDragOver(e, idx) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (idx !== dragOverIdx) setDragOverIdx(idx)
  }

  function onDrop(e, idx) {
    e.preventDefault()
    var from = dragFrom.current
    if (from === null || from === idx) { setDragOverIdx(null); return }
    var arr = (items[activeCat] || []).slice()
    var moved = arr.splice(from, 1)[0]
    arr.splice(idx, 0, moved)
    save({ ...items, [activeCat]: arr })
    dragFrom.current = null
    setDragOverIdx(null)
  }

  function onDragEnd() {
    dragFrom.current = null
    setDragOverIdx(null)
  }

    const totalLow = Object.values(items).flat().filter(function(x) { return !x.stocked }).length

  return (
    <div>
      <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: "#faf8f4", marginBottom: 4 }}>Inventory</div>

      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(250,242,229,0.1)", marginBottom: 16 }}>
        {[["inventory","📦 Inventory"],["favorites","⭐ Favorites"]].map(function(pair) {
          const v = pair[0]; const l = pair[1]
          return (
            <button key={v} onClick={function() { setActiveTab(v) }} style={{ background: "none", border: "none", borderBottom: activeTab===v ? "2px solid #c8a97a" : "2px solid transparent", padding: "8px 14px", fontSize: 12, color: activeTab===v ? "#c8a97a" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: activeTab===v ? 700 : 400 }}>{l}</button>
          )
        })}
      </div>

      {activeTab === "favorites" && (
        <div>
          <div style={{ fontSize: 12, color: "rgba(250,248,244,0.42)", fontFamily: "DM Sans,sans-serif", marginBottom: 12, lineHeight: 1.5 }}>Your go-to products — brands you love, where to find them.</div>

          {/* ── Add form ── */}
          {addingFav ? (
            <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 12, padding: "14px", marginBottom: 14 }}>

              {/* Photo upload */}
              <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                <div
                  onClick={function() { favPhotoRef.current && favPhotoRef.current.click() }}
                  style={{ width: 72, height: 72, borderRadius: 10, border: "1.5px dashed rgba(200,169,122,0.35)", background: favForm.photo ? "transparent" : "rgba(250,242,229,0.03)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, overflow: "hidden", position: "relative" }}
                >
                  {favForm.photo
                    ? <img src={favForm.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ textAlign: "center" }}><div style={{ fontSize: 20 }}>📷</div><div style={{ fontSize: 9, color: "rgba(200,169,122,0.5)", fontFamily: "DM Sans,sans-serif", marginTop: 2 }}>Add photo</div></div>
                  }
                </div>
                <input ref={favPhotoRef} type="file" accept="image/*" onChange={handleFavPhoto} style={{ display: "none" }} />
                <div style={{ flex: 1 }}>
                  {/* Subcategory selector */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    {FAV_SUBCATS.filter(function(s) { return s.id !== "all" }).map(function(s) {
                      return (
                        <button key={s.id} onClick={function() { setFavForm(function(p) { return {...p, subcat: s.id} }) }} style={{ background: favForm.subcat===s.id ? "rgba(200,169,122,0.2)" : "rgba(250,242,229,0.04)", border: "1px solid " + (favForm.subcat===s.id ? "rgba(200,169,122,0.5)" : "rgba(250,242,229,0.08)"), borderRadius: 20, padding: "3px 9px", fontSize: 10, color: favForm.subcat===s.id ? "#c8a97a" : "rgba(250,248,244,0.45)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: favForm.subcat===s.id ? 700 : 400 }}>{s.icon} {s.label}</button>
                      )
                    })}
                  </div>
                  <input value={favForm.name} onChange={function(e) { setFavForm(function(p) { return {...p, name: e.target.value} }) }} placeholder="Product name *" style={{ width: "100%", background: "rgba(250,242,229,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Emoji picker */}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                {FAV_EMOJIS.map(function(e) {
                  return (
                    <button key={e} onClick={function() { setFavForm(function(p) { return {...p, emoji: e} }) }} style={{ background: favForm.emoji===e ? "rgba(200,169,122,0.2)" : "rgba(250,242,229,0.04)", border: "1px solid " + (favForm.emoji===e ? "rgba(200,169,122,0.5)" : "rgba(250,242,229,0.08)"), borderRadius: 8, padding: "4px 7px", fontSize: 14, cursor: "pointer" }}>{e}</button>
                  )
                })}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={favForm.brand} onChange={function(e) { setFavForm(function(p) { return {...p, brand: e.target.value} }) }} placeholder="Brand (opt)" style={{ flex: 1, background: "rgba(250,242,229,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
                <input value={favForm.store} onChange={function(e) { setFavForm(function(p) { return {...p, store: e.target.value} }) }} placeholder="Where to buy (opt)" style={{ flex: 1, background: "rgba(250,242,229,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
              </div>
              <input value={favForm.notes} onChange={function(e) { setFavForm(function(p) { return {...p, notes: e.target.value} }) }} placeholder="Notes (opt)" style={{ width: "100%", background: "rgba(250,242,229,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
              <input value={favForm.url||""} onChange={function(e) { setFavForm(function(p) { return {...p, url: e.target.value} }) }} placeholder="Link / URL (opt) — e.g. amazon.com/…" style={{ width: "100%", background: "rgba(250,242,229,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={function() {
                  if (!favForm.name.trim()) return
                  saveFavs([...favorites, { id: Date.now().toString(), ...favForm }])
                  setFavForm({ name: "", brand: "", store: "", notes: "", url: "", emoji: "⭐", subcat: "grocery", photo: null })
                  setAddingFav(false)
                }} style={{ flex: 1, background: "#c8a97a", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, color: "#243A5A", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Save product</button>
                <button onClick={function() { setAddingFav(false) }} style={{ background: "rgba(250,242,229,0.06)", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "rgba(250,248,244,0.4)", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={function() { setAddingFav(true) }} style={{ width: "100%", padding: "10px", background: "rgba(200,169,122,0.07)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 8, fontSize: 12, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 500, marginBottom: 12 }}>+ Add favorite product</button>
          )}

          {/* ── Subcat filter tabs ── */}
          <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(250,242,229,0.08)", marginBottom: 14, overflowX: "auto" }}>
            {FAV_SUBCATS.map(function(s) {
              const count = s.id === "all" ? favorites.length : favorites.filter(function(f) { return (f.subcat || "other") === s.id }).length
              if (count === 0 && s.id !== "all") return null
              return (
                <div key={s.id} onClick={function() { setFavSubcat(s.id) }} style={{ padding: "6px 11px", fontSize: 11, cursor: "pointer", borderBottom: favSubcat===s.id ? "2px solid #c8a97a" : "2px solid transparent", color: favSubcat===s.id ? "#c8a97a" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {s.icon} {s.label}
                  {count > 0 && <span style={{ fontSize: 9, color: favSubcat===s.id ? "#c8a97a" : "rgba(250,248,244,0.25)", marginLeft: 1 }}>({count})</span>}
                </div>
              )
            })}
          </div>

          {/* ── Favorites list ── */}
          {favorites.length === 0 ? (
            <div style={{ fontSize: 13, color: "rgba(250,248,244,0.3)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", textAlign: "center", padding: "32px 0" }}>No favorites yet — add a product above.</div>
          ) : (
            <div>
              {favorites.filter(function(f) { return favSubcat === "all" || (f.subcat || "other") === favSubcat }).map(function(fav) {
                const subInfo = FAV_SUBCATS.find(function(s) { return s.id === (fav.subcat || "other") }) || FAV_SUBCATS[FAV_SUBCATS.length-1]
                return (
                  <div key={fav.id} style={{ background: "rgba(250,242,229,0.03)", border: "1px solid rgba(250,242,229,0.07)", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
                      {/* Photo or emoji column */}
                      {fav.photo ? (
                        <div style={{ width: 72, height: 72, flexShrink: 0, overflow: "hidden" }}>
                          <img src={fav.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ) : (
                        <div style={{ width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 24, paddingLeft: 10, paddingTop: 10 }}>{fav.emoji}</div>
                      )}
                      <div style={{ flex: 1, padding: "10px 12px 8px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{fav.name}</div>
                            {fav.brand && <div style={{ fontSize: 11, color: "rgba(200,169,122,0.7)", fontFamily: "DM Sans,sans-serif", marginTop: 1 }}>{fav.brand}</div>}
                          </div>
                          <span style={{ fontSize: 9, color: "rgba(250,248,244,0.25)", fontFamily: "DM Sans,sans-serif", background: "rgba(250,242,229,0.05)", borderRadius: 10, padding: "2px 6px", whiteSpace: "nowrap", flexShrink: 0 }}>{subInfo.icon} {subInfo.label}</span>
                        </div>
                        {fav.store && <div style={{ fontSize: 11, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", marginTop: 3 }}>📍 {fav.store}</div>}
                        {fav.notes && <div style={{ fontSize: 11, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", marginTop: 3, fontStyle: "italic" }}>{fav.notes}</div>}
                        {fav.url && safeUrl(fav.url) && <a href={safeUrl(fav.url)} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", marginTop: 4, display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}>🔗 <span style={{ textDecoration: "underline", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", verticalAlign: "middle" }}>{fav.url.replace(/^https?:\/\/(www\.)?/,"").split("/")[0]}</span></a>}
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button onClick={function() { onAddToShopping(fav.brand ? fav.brand + " " + fav.name : fav.name); setToast(fav.name + " added to list"); setTimeout(function() { setToast(null) }, 2000) }} style={{ background: "rgba(122,158,142,0.15)", border: "1px solid rgba(122,158,142,0.3)", borderRadius: 6, padding: "4px 10px", fontSize: 10, color: "#7a9e8e", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>+ Shopping list</button>
                          <button onClick={function() { saveFavs(favorites.filter(function(f2) { return f2.id !== fav.id })) }} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.25, fontSize: 11, color: "#faf8f4", padding: "2px 4px" }}>✕ Remove</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {favorites.filter(function(f) { return favSubcat === "all" || (f.subcat || "other") === favSubcat }).length === 0 && (
                <div style={{ fontSize: 13, color: "rgba(250,248,244,0.3)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", textAlign: "center", padding: "24px 0" }}>No favorites in this category yet.</div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "inventory" && (
        <div>
          <div style={{ fontSize: 12, color: "rgba(250,248,244,0.42)", fontFamily: "DM Sans,sans-serif", marginBottom: 16, lineHeight: 1.5 }}>Tap ✓ to mark low (adds to shopping). Drag ⠿ to reorder. Click a category to type directly.</div>
          {totalLow > 0 && (
            <div style={{ background: "rgba(200,131,74,0.1)", border: "1px solid rgba(200,131,74,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#c8834a", fontFamily: "DM Sans,sans-serif" }}>
              {totalLow} item{totalLow > 1 ? "s" : ""} running low — added to your shopping list
            </div>
          )}
          {toast && (
            <div style={{ position: "fixed", top: 80, left: "calc(68px + 50%)", transform: "translateX(-50%)", background: "#7a9e8e", color: "#fff", padding: "8px 18px", borderRadius: 20, fontSize: 13, fontFamily: "DM Sans,sans-serif", zIndex: 9999, whiteSpace: "nowrap" }}>{toast}</div>
          )}

          {/* ── Main category tabs ── */}
          <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(250,242,229,0.08)", marginBottom: 16, overflowX: "auto" }}>
            {CATS.map(function(cat) {
              const low = (items[cat.id] || []).filter(function(x) { return !x.stocked }).length
              return (
                <div key={cat.id} onClick={function() { setActiveCat(cat.id); setEditing(null); setInlineAdding({}); setInlineVal({}) }} style={{ padding: "7px 12px", fontSize: 11, cursor: "pointer", borderBottom: activeCat === cat.id ? "2px solid #c8a97a" : "2px solid transparent", color: activeCat === cat.id ? "#c8a97a" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {cat.icon} {cat.label}
                  {low > 0 && <span style={{ background: "#c8834a", color: "#fff", fontSize: 8, borderRadius: 8, padding: "1px 5px", fontWeight: 700 }}>{low}</span>}
                </div>
              )
            })}
          </div>

          {/* ── Sort toggle ── */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button onClick={function(){ setInvAZ(!invAZ) }} style={{ fontSize: 11, color: invAZ?"#c8a97a":"rgba(250,248,244,0.5)", background: invAZ?"rgba(200,169,122,0.12)":"transparent", border: "0.5px solid "+(invAZ?"rgba(200,169,122,0.4)":"rgba(250,242,229,0.12)"), borderRadius: 7, padding: "4px 11px", cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>{invAZ?"A\u2013Z \u2713":"A\u2013Z"}</button>
          </div>

          {/* ── Subcategory accordions ── */}
          <div style={{ marginBottom: 12 }}>
            {(SUBCATS[activeCat] || []).map(function(sub) {
              const colKey = activeCat + ":" + sub.id
              const isCollapsed = !!collapsedSubs[colKey]
              const inlineKey = activeCat + ":" + sub.id
              const isInlineAdding = !!inlineAdding[inlineKey]
              const allCatItems = items[activeCat] || []
              const subItems = allCatItems.reduce(function(acc, item, globalIdx) {
                if ((item.subcat || "other") === sub.id) acc.push({ item: item, globalIdx: globalIdx })
                return acc
              }, [])
              const lowCount = subItems.filter(function(s) { return !s.item.stocked }).length

              return (
                <div key={sub.id} style={{ marginBottom: 6 }}>
                  {/* Subcategory header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(250,242,229,0.04)", borderRadius: isCollapsed ? 10 : "10px 10px 0 0", border: "1px solid rgba(250,242,229,0.06)", borderBottom: isCollapsed ? "1px solid rgba(250,242,229,0.06)" : "1px solid rgba(250,242,229,0.04)", userSelect: "none" }}>
                    <span onClick={function() { toggleSubcat(activeCat, sub.id) }} style={{ fontSize: 14, cursor: "pointer" }}>{sub.icon}</span>
                    <span onClick={function() { toggleSubcat(activeCat, sub.id) }} style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "rgba(250,248,244,0.7)", fontFamily: "DM Sans,sans-serif", letterSpacing: "0.02em", cursor: "pointer" }}>{sub.label}</span>
                    {lowCount > 0 && <span style={{ background: "#c8834a", color: "#fff", fontSize: 8, borderRadius: 8, padding: "1px 5px", fontWeight: 700 }}>{lowCount} low</span>}
                    {subItems.length > 0 && isCollapsed && <span style={{ fontSize: 10, color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif" }}>{subItems.length} item{subItems.length !== 1 ? "s" : ""}</span>}
                    {/* Quick-add button per subcategory */}
                    <button onClick={function() { openInlineAdd(sub.id) }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "rgba(200,169,122,0.5)", padding: "0 2px", lineHeight: 1 }} title="Add item here">+</button>
                    <span onClick={function() { toggleSubcat(activeCat, sub.id) }} style={{ fontSize: 10, color: "rgba(250,248,244,0.3)", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block", cursor: "pointer" }}>▾</span>
                  </div>

                  {/* Subcategory items + inline add */}
                  {!isCollapsed && (
                    <div style={{ background: "rgba(250,242,229,0.025)", border: "1px solid rgba(250,242,229,0.06)", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                      {subItems.length === 0 && !isInlineAdding && (
                        <div onClick={function() { openInlineAdd(sub.id) }} style={{ padding: "10px 14px", fontSize: 12, color: "rgba(250,248,244,0.2)", fontFamily: "DM Sans,sans-serif", fontStyle: "italic", cursor: "text" }}>tap to add an item…</div>
                      )}

                      {(invAZ?subItems.slice().sort(function(a,b){return (a.item.name||"").localeCompare(b.item.name||"");}):subItems).map(function(s) {
                        const item = s.item; const idx = s.globalIdx
                        const isDragOver = dragOverIdx === idx && dragFrom.current !== idx
                        return (
                          <div
                            key={idx}
                            draggable
                            onDragStart={function(e) { onDragStart(e, idx) }}
                            onDragOver={function(e) { onDragOver(e, idx) }}
                            onDrop={function(e) { onDrop(e, idx) }}
                            onDragEnd={onDragEnd}
                            onDragLeave={function() { if (dragOverIdx === idx) setDragOverIdx(null) }}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(250,242,229,0.04)", background: isDragOver ? "rgba(200,169,122,0.12)" : "transparent", borderLeft: isDragOver ? "3px solid #c8a97a" : "3px solid transparent", transition: "background 0.08s", opacity: dragFrom.current === idx ? 0.3 : 1, cursor: "grab" }}
                          >
                            {/* Stocked checkbox */}
                            <div onClick={function() { if (editing !== idx) toggle(idx) }} style={{ width: 20, height: 20, borderRadius: 5, border: "1.5px solid " + (item.stocked ? "#7a9e8e" : "rgba(250,242,229,0.2)"), background: item.stocked ? "#7a9e8e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                              {item.stocked && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
                            </div>
                            {editing === idx ? (
                              <input value={editVal} onChange={function(e) { setEditVal(e.target.value) }} onKeyDown={function(e) { if (e.key === "Enter") renameItem(idx); if (e.key === "Escape") setEditing(null) }} autoFocus style={{ flex: 1, background: "rgba(250,242,229,0.08)", border: "1px solid rgba(200,169,122,0.4)", borderRadius: 6, padding: "3px 8px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
                            ) : (
                              <span style={{ flex: 1, fontSize: 13, color: item.stocked ? "rgba(250,248,244,0.75)" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", textDecoration: item.stocked ? "none" : "line-through" }}>{item.name}</span>
                            )}
                            {!item.stocked && editing !== idx && <span style={{ fontSize: 10, color: "#c8834a", fontFamily: "DM Sans,sans-serif", flexShrink: 0 }}>→ list</span>}
                            {editing === idx ? (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={function() { renameItem(idx) }} style={{ background: "#7a9e8e", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#fff", cursor: "pointer" }}>save</button>
                                <button onClick={function() { setEditing(null) }} style={{ background: "rgba(250,242,229,0.08)", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "rgba(250,248,244,0.5)", cursor: "pointer" }}>cancel</button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={function() { setEditing(idx); setEditVal(item.name) }} style={{ background: "none", border: "none", fontSize: 11, color: "rgba(250,248,244,0.35)", cursor: "pointer", padding: "2px 4px" }}>✏️</button>
                                <button onClick={function() { deleteItem(idx) }} style={{ background: "none", border: "none", fontSize: 11, color: "rgba(200,131,74,0.5)", cursor: "pointer", padding: "2px 4px" }}>✕</button>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Inline quick-add row */}
                      {isInlineAdding && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderTop: subItems.length > 0 ? "1px solid rgba(250,242,229,0.04)" : "none" }}>
                          <input
                            autoFocus
                            value={inlineVal[inlineKey] || ""}
                            onChange={function(e) { var v = e.target.value; setInlineVal(function(p) { return { ...p, [inlineKey]: v } }) }}
                            onKeyDown={function(e) {
                              if (e.key === "Enter") { addInlineItem(sub.id) }
                              if (e.key === "Escape") { setInlineAdding(function(p) { var n={...p}; delete n[inlineKey]; return n }); setInlineVal(function(p) { var n={...p}; delete n[inlineKey]; return n }) }
                            }}
                            placeholder={"Add to " + sub.label + "…"}
                            style={{ flex: 1, background: "rgba(250,242,229,0.06)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 7, padding: "6px 10px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none" }}
                          />
                          <button onClick={function() { addInlineItem(sub.id) }} style={{ background: "#c8a97a", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, color: "#243A5A", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Add</button>
                          <button onClick={function() { setInlineAdding(function(p) { var n={...p}; delete n[inlineKey]; return n }); setInlineVal(function(p) { var n={...p}; delete n[inlineKey]; return n }) }} style={{ background: "none", border: "none", fontSize: 13, color: "rgba(250,248,244,0.3)", cursor: "pointer", padding: "2px" }}>✕</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Celebrations Section ──────────────────────────────────────────────────────
const CELEBRATION_TYPES = [
  { id: "birthday",   label: "Birthday",   emoji: "🎂" },
  { id: "anniversary",label: "Anniversary",emoji: "💍" },
  { id: "graduation", label: "Graduation", emoji: "🎓" },
  { id: "holiday",    label: "Holiday",    emoji: "🎄" },
  { id: "party",      label: "Party",      emoji: "🎈" },
  { id: "milestone",  label: "Milestone",  emoji: "⭐" },
  { id: "wedding",    label: "Wedding",    emoji: "💐" },
  { id: "babyshower", label: "Baby Shower",emoji: "🍼" },
  { id: "other",      label: "Other",      emoji: "🎉" },
]
// Planning dimensions counted toward a celebration's "N of 7 planned"
// status on the landing-page card. Overview and Photos aren't counted:
// Overview is always trivially "filled" (it's just the celebration's own
// core fields), Photos has no data model yet (placeholder card, Phase 2).
// Fields beyond gifts/celebgifts don't exist on celebration records yet
// (guestList/budget/food/decorations/activities/todo are Phase 2) — this
// is written now so Phase 1's status count is forward-compatible with
// Phase 2 filling those fields in, without another pass over this list.
var PLANNING_DIMENSIONS = ["guestList","gifts","budget","food","decorations","activities","todo"]
function planningFilledCount(c, hasGifts) {
  var n = 0
  if (Array.isArray(c.guestList) && c.guestList.length > 0) n++
  if (hasGifts) n++
  if (c.budget && (c.budget.planned || (Array.isArray(c.budget.items) && c.budget.items.length > 0))) n++
  if (Array.isArray(c.food) && c.food.length > 0) n++
  if (Array.isArray(c.decorations) && c.decorations.length > 0) n++
  if (Array.isArray(c.activities) && c.activities.length > 0) n++
  if (Array.isArray(c.todo) && c.todo.length > 0) n++
  return n
}
// Phase 2 — planning sub-card tiles inside a celebration's detail view.
// Same grid-tile / full-page-on-tap pattern as Travel's TripCardTile.
var CELEB_CARD_ORDER = ["overview","guestlist","gifts","budget","food","decorations","activities","todo","photos"]
var CELEB_CARD_META = {
  overview:    { icon: "📋", title: "Overview" },
  guestlist:   { icon: "👥", title: "Guest List" },
  gifts:       { icon: "🎁", title: "Gift Ideas" },
  budget:      { icon: "💰", title: "Budget" },
  food:        { icon: "🍰", title: "Food & Cake" },
  decorations: { icon: "🎈", title: "Decorations" },
  activities:  { icon: "🎯", title: "Activities" },
  todo:        { icon: "✅", title: "To-Do" },
  photos:      { icon: "📸", title: "Photos & Memories" },
}

function CelebrationsSection({ calEvents, onOpenRecipe, onBrowseRecipes }) {
  calEvents = calEvents || []
  // af_recipeBook lives in HomeFlow/MealsTab (App.jsx) — read directly from
  // localStorage, same as af_celebrations/af_birthdays above. This section
  // remounts fresh each time the user navigates into it (see activeSection
  // conditional in AnchorVault), so a mount-time read is sufficient — no
  // live cross-tab reactivity needed within a single view session.
  const [recipeBook] = useState(function() {
    try { var v = JSON.parse(localStorage.getItem("af_recipeBook") || "[]"); return Array.isArray(v) ? v : [] } catch { return [] }
  })
  // COUNTDOWN-1: reusable countdowns live in HomeFlow/App.jsx (af_countdowns) —
  // read directly, same reasoning as af_recipeBook above (separate component
  // tree from AnchorVault, remounts fresh on nav so a mount-time read suffices).
  const [countdowns] = useState(function() {
    try { var v = JSON.parse(localStorage.getItem("af_countdowns") || "[]"); return Array.isArray(v) ? v : [] } catch { return [] }
  })
  const [celebrations, setCelebrations] = useState(function() {
    try {
      const rawSaved = JSON.parse(localStorage.getItem("af_celebrations") || "[]")
      const saved = Array.isArray(rawSaved) ? rawSaved : []
      const rawBdays = JSON.parse(localStorage.getItem("af_birthdays") || "[]")
      const bdays = Array.isArray(rawBdays) ? rawBdays : []
      const migrated = bdays.filter(function(b) { return !saved.find(function(c) { return c.name === b.name && c.type === "birthday" }) })
        .map(function(b) { return { id: b.id, type: "birthday", name: b.name, month: b.month, day: b.day, year: b.year || null, notes: "" } })
      return [...saved, ...migrated]
    } catch { return [] }
  })
  const [adding, setAdding] = useState(false)
  const [celebType, setCelebType] = useState("birthday")
  const [form, setForm] = useState({ name: "", month: "", day: "", year: "", notes: "" })
  const [filter, setFilter] = useState("upcoming")
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: "", month: "", day: "", year: "", notes: "", type: "birthday" })
  const [celebTab, setCelebTab] = useState("celebrations")
  const myPersonId = (function() { try { return localStorage.getItem("af_myPersonId") || null } catch { return null } })()
  React.useEffect(function() {
    function onRefresh(e) {
      if (!e.detail?.key || e.detail.key === "celebrations") {
        try {
          const rawSaved = JSON.parse(localStorage.getItem("af_celebrations") || "[]")
          const saved = Array.isArray(rawSaved) ? rawSaved : []
          const rawBdays3 = JSON.parse(localStorage.getItem("af_birthdays") || "[]")
          const bdays = Array.isArray(rawBdays3) ? rawBdays3 : []
          const migrated = bdays.filter(function(b) { return !saved.find(function(c) { return c.name === b.name && c.type === "birthday" }) })
            .map(function(b) { return { id: b.id, type: "birthday", name: b.name, month: b.month, day: b.day, year: b.year || null, notes: "" } })
          setCelebrations([...saved, ...migrated])
        } catch {}
      }
    }
    window.addEventListener("af-data-changed", onRefresh)
    return function() { window.removeEventListener("af-data-changed", onRefresh) }
  }, [])

  // Auto-create birthday celebrations from the household roster — silent,
  // on mount only. Matches by personId first (celebrations created by
  // this effect), falling back to name+type (so a birthday entered
  // manually before this feature existed, or via the older af_birthdays
  // migration above, isn't duplicated).
  React.useEffect(function() {
    try {
      var roster = hLoadPeople()
      var missing = roster.filter(function(p) {
        if (!p.birthday) return false
        var parts = String(p.birthday).split("-")
        if (parts.length !== 3) return false
        return !celebrations.some(function(c) { return c.type === "birthday" && (c.personId === p.id || c.name === p.name) })
      })
      if (missing.length === 0) return
      var additions = missing.map(function(p) {
        var parts = p.birthday.split("-")
        return { id: "pb_"+p.id, type: "birthday", name: p.name, month: parseInt(parts[1]), day: parseInt(parts[2]), year: parseInt(parts[0]) || null, notes: "", personId: p.id }
      })
      save([...celebrations, ...additions])
    } catch {}
  }, [])

  // af_gifts — person-keyed map: { personId: [{ id, personId, title, notes,
  // price, url, imageUrl, purchased, private, occasion, assignedCelebId }] }
  const [gifts, setGifts] = useState(function() {
    try {
      var raw = JSON.parse(localStorage.getItem("af_gifts") || "null")
      return (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {}
    } catch { return {} }
  })
  React.useEffect(function() {
    function onRefresh(e) {
      if (!e.detail?.key || e.detail.key === "gifts") {
        try {
          var raw = JSON.parse(localStorage.getItem("af_gifts") || "null")
          setGifts((raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {})
        } catch {}
      }
    }
    window.addEventListener("af-data-changed", onRefresh)
    return function() { window.removeEventListener("af-data-changed", onRefresh) }
  }, [])

  // One-time defensive migration: the old af_gifts shape was a flat array of
  // {id,name,relation,occasions:[{id,type,date,gifts:[{id,item,cost,url,
  // photo,bought}]}]} (GiftsSection, never actually reachable in the UI —
  // but "never reachable" isn't "provably empty", so this still migrates
  // rather than assumes). af_celebgifts ({celebId:[{id,text,bought}]}, the
  // live inline gift panel this session replaced) is folded in too, then
  // retired. Runs once, after the birthday auto-create effect above so
  // celebId->personId resolution sees any birthdays created this same mount.
  React.useEffect(function() {
    try {
      if (localStorage.getItem("af_gifts_migrated_v1") === "1") return
      var merged = {}
      try {
        var current = JSON.parse(localStorage.getItem("af_gifts") || "null")
        if (current && typeof current === "object" && !Array.isArray(current)) {
          merged = JSON.parse(JSON.stringify(current))
        }
      } catch {}

      try {
        var oldPeopleShape = JSON.parse(localStorage.getItem("af_gifts") || "null")
        if (Array.isArray(oldPeopleShape)) {
          oldPeopleShape.forEach(function(person) {
            if (!person || !person.id) return
            var list = merged[person.id] || []
            ;(person.occasions || []).forEach(function(occ) {
              ;(occ.gifts || []).forEach(function(item) {
                if (!item) return
                list.push({
                  id: item.id || (Date.now().toString()+Math.random().toString(36).slice(2,6)),
                  personId: person.id,
                  title: item.item || "",
                  notes: "",
                  price: item.cost != null ? item.cost : null,
                  url: item.url || "",
                  imageUrl: item.photo || "",
                  purchased: !!item.bought,
                  private: false,
                  occasion: occ.type + (occ.date ? " "+occ.date : ""),
                  assignedCelebId: null,
                })
              })
            })
            merged[person.id] = list
          })
        }
      } catch {}

      try {
        var oldCelebGifts = JSON.parse(localStorage.getItem("af_celebgifts") || "{}")
        Object.keys(oldCelebGifts || {}).forEach(function(celebId) {
          var celeb = celebrations.find(function(c) { return c.id === celebId })
          var personId = (celeb && celeb.personId) || ("celeb_"+celebId)
          var list = merged[personId] || []
          ;(oldCelebGifts[celebId] || []).forEach(function(g) {
            if (!g) return
            list.push({
              id: g.id || (Date.now().toString()+Math.random().toString(36).slice(2,6)),
              personId: personId,
              title: g.text || "",
              notes: "",
              price: null,
              url: "",
              imageUrl: "",
              purchased: !!g.bought,
              private: false,
              occasion: celeb ? celeb.name : "",
              assignedCelebId: celebId,
            })
          })
          merged[personId] = list
        })
      } catch {}

      localStorage.setItem("af_gifts", JSON.stringify(merged))
      afVaultChanged("gifts")
      localStorage.setItem("af_gifts_migrated_v1", "1")
      setGifts(merged)
    } catch {}
  }, [])

  // Second migration, layered on top of the one above: af_gifts[personId]
  // used to be a flat gift array with a loose `occasion` display-grouping
  // string. Now it's an array of named lists (Birthday/Christmas/Easter/
  // custom), each holding its own gifts — holiday lists live under the
  // person they belong to instead of a separate global section. Depends on
  // [gifts] rather than running once on [] so it re-fires after the first
  // migration's async state update lands, same reasoning as that one.
  // Also folds in the short-lived global af_gifts["holiday_lists"] bucket
  // (shipped one commit before this restructure — matching each gift's
  // free-text forPerson against the household roster by name; unmatched
  // gifts land under a synthetic "unassigned" person rather than being
  // dropped) and removes that reserved key once folded in.
  React.useEffect(function() {
    try {
      if (localStorage.getItem("af_gifts_nested_lists_v1") === "1") return
      var roster = hLoadPeople()
      var updated = {}

      Object.keys(gifts).forEach(function(pid) {
        if (pid === "holiday_lists") return
        var val = gifts[pid]
        if (!Array.isArray(val)) return
        var alreadyNested = val.length > 0 && val[0] && Array.isArray(val[0].gifts)
        if (alreadyNested) { updated[pid] = val; return }
        var byOcc = {}; var order = []
        val.forEach(function(g) {
          var key = g.occasion || "General"
          if (!byOcc[key]) { byOcc[key] = []; order.push(key) }
          byOcc[key].push(Object.assign({ assignedTo: "" }, g))
        })
        updated[pid] = order.map(function(occName) {
          var lower = occName.toLowerCase()
          var type = lower.indexOf("birthday") === 0 ? "birthday" : lower.indexOf("christmas") === 0 ? "christmas" : lower.indexOf("easter") === 0 ? "easter" : "custom"
          return { id: Date.now().toString()+Math.random().toString(36).slice(2,6), name: occName, type: type, gifts: byOcc[occName] }
        })
      })

      var oldHolidayLists = gifts.holiday_lists || []
      oldHolidayLists.forEach(function(oldList) {
        ;(oldList.gifts || []).forEach(function(g) {
          if (!g) return
          var matched = roster.find(function(p) { return g.forPerson && p.name && p.name.toLowerCase() === String(g.forPerson).toLowerCase().trim() })
          var pid = matched ? matched.id : "unassigned"
          if (!updated[pid]) updated[pid] = []
          var newGift = {
            id: g.id || (Date.now().toString()+Math.random().toString(36).slice(2,6)),
            personId: pid, title: g.title || "", notes: g.notes || "",
            price: g.price != null ? g.price : null, url: g.url || "", imageUrl: "",
            purchased: !!g.purchased, private: false, occasion: oldList.name,
            assignedCelebId: null, assignedTo: g.assignedTo || "",
          }
          var existingList = updated[pid].find(function(l) { return l.name === oldList.name })
          if (existingList) { existingList.gifts = [...(existingList.gifts||[]), newGift] }
          else {
            var lower2 = oldList.name.toLowerCase()
            var type2 = lower2 === "christmas" ? "christmas" : lower2 === "easter" ? "easter" : "custom"
            updated[pid].push({ id: Date.now().toString()+Math.random().toString(36).slice(2,6), name: oldList.name, type: type2, gifts: [newGift] })
          }
        })
      })

      localStorage.setItem("af_gifts_nested_lists_v1", "1")
      saveGifts(updated)
    } catch {}
  }, [gifts])

  // Every household person always has Birthday (if they have a birthday
  // set), Christmas, and Easter lists — created once each, then left alone
  // (renaming/deleting is a user action, not something this effect should
  // fight). Re-checks on every gifts change so a newly added family member
  // gets seeded too, self-terminating once everyone's covered.
  React.useEffect(function() {
    try {
      var roster = hLoadPeople()
      var updated = Object.assign({}, gifts)
      var changed = false
      roster.forEach(function(p) {
        var lists = (updated[p.id] || []).slice()
        var hasType = function(t) { return lists.some(function(l) { return l.type === t }) }
        if (p.birthday && !hasType("birthday")) { lists.push({ id: "bl_"+p.id, name: "Birthday", type: "birthday", gifts: [] }); changed = true }
        if (!hasType("christmas")) { lists.push({ id: "cl_"+p.id, name: "Christmas", type: "christmas", gifts: [] }); changed = true }
        if (!hasType("easter")) { lists.push({ id: "el_"+p.id, name: "Easter", type: "easter", gifts: [] }); changed = true }
        if (lists.length !== (updated[p.id]||[]).length) updated[p.id] = lists
      })
      if (changed) saveGifts(updated)
    } catch {}
  }, [gifts])

  function saveGifts(updated) {
    setGifts(updated)
    afVaultChanged("gifts")
    try { localStorage.setItem("af_gifts", JSON.stringify(updated)) } catch {}
  }
  function personLists(personId) { return gifts[personId] || [] }
  function savePersonLists(personId, lists) { saveGifts(Object.assign({}, gifts, { [personId]: lists })) }
  function addPersonList(personId, name, type) {
    if (!name.trim()) return
    savePersonLists(personId, [...personLists(personId), { id: Date.now().toString()+Math.random().toString(36).slice(2,6), name: name.trim(), type: type || "custom", gifts: [] }])
  }
  function renamePersonList(personId, listId, name) {
    if (!name.trim()) return
    savePersonLists(personId, personLists(personId).map(function(l) { return l.id === listId ? Object.assign({}, l, { name: name.trim() }) : l }))
  }
  // Finds a person's list by name, creating a "custom" one if none matches —
  // used when adding a gift idea from a celebration's Gift Ideas card, where
  // there's a celebration name/type but not necessarily an existing list.
  function findOrCreatePersonList(personId, name, type) {
    var existing = personLists(personId).find(function(l) { return l.name === name })
    if (existing) return existing
    var created = { id: Date.now().toString()+Math.random().toString(36).slice(2,6), name: name, type: type || "custom", gifts: [] }
    savePersonLists(personId, [...personLists(personId), created])
    return created
  }
  function addGiftToList(personId, listId, fields) {
    var updated = personLists(personId).map(function(l) {
      if (l.id !== listId) return l
      var item = Object.assign({
        id: Date.now().toString()+Math.random().toString(36).slice(2,6),
        personId: personId, title: "", notes: "", price: null, url: "", imageUrl: "",
        purchased: false, private: false, occasion: l.name, assignedCelebId: null, assignedTo: "",
      }, fields)
      return Object.assign({}, l, { gifts: [...(l.gifts||[]), item] })
    })
    savePersonLists(personId, updated)
  }
  function updateGiftInList(personId, listId, giftId, patch) {
    var updated = personLists(personId).map(function(l) {
      if (l.id !== listId) return l
      return Object.assign({}, l, { gifts: (l.gifts||[]).map(function(g) { return g.id === giftId ? Object.assign({}, g, patch) : g }) })
    })
    savePersonLists(personId, updated)
  }
  function removeGiftFromList(personId, listId, giftId) {
    var updated = personLists(personId).map(function(l) {
      if (l.id !== listId) return l
      return Object.assign({}, l, { gifts: (l.gifts||[]).filter(function(g) { return g.id !== giftId }) })
    })
    savePersonLists(personId, updated)
  }
  function findGiftInList(personId, listId, giftId) {
    var l = personLists(personId).find(function(x) { return x.id === listId })
    return l && (l.gifts||[]).find(function(g) { return g.id === giftId })
  }
  function toggleGiftPurchased(personId, listId, giftId) {
    var g = findGiftInList(personId, listId, giftId)
    if (g) updateGiftInList(personId, listId, giftId, { purchased: !g.purchased })
  }
  function toggleGiftPrivate(personId, listId, giftId) {
    var g = findGiftInList(personId, listId, giftId)
    if (g) updateGiftInList(personId, listId, giftId, { private: !g.private })
  }
  function assignGiftToCeleb(personId, listId, giftId, celebId) { updateGiftInList(personId, listId, giftId, { assignedCelebId: celebId }) }
  function unassignGift(personId, listId, giftId) { updateGiftInList(personId, listId, giftId, { assignedCelebId: null }) }
  // Private gifts are hidden everywhere from the device user who is the
  // gift's own recipient — not just their title, the whole entry (counts,
  // badges, previews included), so nothing leaks a surprise indirectly.
  function visibleListGifts(personId, list) {
    var g = (list && list.gifts) || []
    if (myPersonId && myPersonId === personId) return g.filter(function(x) { return !x.private })
    return g
  }
  // All gifts relevant to a celebration: anything explicitly assigned to it
  // (assignedCelebId match, any person's any list), plus — if the
  // celebration has a linked person (auto-created birthdays do) — that
  // person's unassigned gifts too. Privacy-filtered the same way
  // visibleListGifts is. Each result is tagged with __listId so callers can
  // still target the right list for toggle/remove/assign actions.
  function celebGifts(celebId, personId) {
    var result = []
    Object.keys(gifts).forEach(function(pid) {
      if (pid === "holiday_lists") return // stray pre-migration key, defensive
      ;(gifts[pid] || []).forEach(function(list) {
        ;(list.gifts || []).forEach(function(g) {
          if (myPersonId && myPersonId === pid && g.private) return
          if (g.assignedCelebId === celebId) result.push(Object.assign({}, g, { __listId: list.id }))
          else if (!g.assignedCelebId && personId && pid === personId) result.push(Object.assign({}, g, { __listId: list.id }))
        })
      })
    })
    return result
  }
  function personDisplayName(personId) {
    if (personId === "unassigned") return "Unassigned"
    var roster = hLoadPeople()
    var p = roster.find(function(x) { return x.id === personId })
    if (p) return p.name
    if (personId.indexOf("celeb_") === 0) {
      var c = celebrations.find(function(x) { return x.id === personId.slice(6) })
      if (c) return c.name
    }
    return "Unknown"
  }

  // Level 2/3 nav (same pattern as Travel's detailTripId/activeTripCard):
  // detailCelebId null = list view; string = that celebration's detail
  // page. activeCelebCard null = the detail page's card grid; string =
  // that planning card's full-page view.
  const [detailCelebId, setDetailCelebId] = useState(null)
  const [activeCelebCard, setActiveCelebCard] = useState(null)
  function openCelebDetail(id) { setDetailCelebId(id); setActiveCelebCard(null) }
  function backToCelebrations() { setDetailCelebId(null); setActiveCelebCard(null) }

  // Draft input state for the planning sub-cards.
  const [guestDraft, setGuestDraft] = useState("")
  // Gifts tab UI state. Lists (Birthday/Christmas/Easter/custom) live under
  // each person now, not as a separate global section — openPersonSections
  // defaults OPEN (undefined !== false), openLists (keyed "personId:listId")
  // defaults COLLAPSED, matching the chevron convention used elsewhere.
  const [openPersonSections, setOpenPersonSections] = useState({})
  const [openLists, setOpenLists] = useState({})
  const [giftsAZ, setGiftsAZ] = useState(false)
  const [renamingListId, setRenamingListId] = useState(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [addingListFor, setAddingListFor] = useState(null) // personId or null
  const [newListName, setNewListName] = useState("")
  const [addingGiftTarget, setAddingGiftTarget] = useState(null) // { personId, listId, celebId? } or null
  const [giftDraft, setGiftDraft] = useState({ title: "", notes: "", price: "", url: "", imageUrl: "", assignedTo: "", private: false })

  function isPersonOpen(personId) { return openPersonSections[personId] !== false }
  function togglePersonOpen(personId) {
    setOpenPersonSections(function(p) { var n = Object.assign({}, p); n[personId] = !isPersonOpen(personId); return n })
  }
  function toggleListOpen(personId, listId) {
    var key = personId + ":" + listId
    setOpenLists(function(p) { var n = Object.assign({}, p); n[key] = !n[key]; return n })
  }

  const [budgetItemDraft, setBudgetItemDraft] = useState({ desc: "", amount: "" })
  const [foodDraft, setFoodDraft] = useState({ item: "", who: "", dietary: "" })
  const [usedRecipeConfirm, setUsedRecipeConfirm] = useState(null)
  const [decorDraft, setDecorDraft] = useState("")
  const [activityDraft, setActivityDraft] = useState("")
  const [todoDraft, setTodoDraft] = useState("")

  function updateCelebField(celebId, patch) {
    save(celebrations.map(function(c) { return c.id === celebId ? Object.assign({}, c, patch) : c }))
  }

  // Guest List
  function addGuest(celebId) {
    if (!guestDraft.trim()) return
    var c = celebrations.find(function(x) { return x.id === celebId })
    var list = (c && c.guestList) || []
    updateCelebField(celebId, { guestList: [...list, { id: Date.now().toString(), name: guestDraft.trim(), rsvp: "pending", plusOnes: 0 }] })
    setGuestDraft("")
  }
  function setGuestRsvp(celebId, guestId, rsvp) {
    var c = celebrations.find(function(x) { return x.id === celebId })
    var list = ((c && c.guestList) || []).map(function(g) { return g.id === guestId ? Object.assign({}, g, { rsvp: rsvp }) : g })
    updateCelebField(celebId, { guestList: list })
  }
  function setGuestPlusOnes(celebId, guestId, delta) {
    var c = celebrations.find(function(x) { return x.id === celebId })
    var list = ((c && c.guestList) || []).map(function(g) { return g.id === guestId ? Object.assign({}, g, { plusOnes: Math.max(0, (g.plusOnes||0) + delta) }) : g })
    updateCelebField(celebId, { guestList: list })
  }
  function removeGuest(celebId, guestId) {
    var c = celebrations.find(function(x) { return x.id === celebId })
    var list = ((c && c.guestList) || []).filter(function(g) { return g.id !== guestId })
    updateCelebField(celebId, { guestList: list })
  }

  // Budget
  function setBudgetPlanned(celebId, amount) {
    var c = celebrations.find(function(x) { return x.id === celebId })
    var budget = (c && c.budget) || { planned: null, items: [] }
    updateCelebField(celebId, { budget: Object.assign({}, budget, { planned: amount ? parseFloat(amount) : null }) })
  }
  function addBudgetItem(celebId) {
    if (!budgetItemDraft.desc.trim()) return
    var c = celebrations.find(function(x) { return x.id === celebId })
    var budget = (c && c.budget) || { planned: null, items: [] }
    var items = budget.items || []
    updateCelebField(celebId, { budget: Object.assign({}, budget, { items: [...items, { id: Date.now().toString(), desc: budgetItemDraft.desc.trim(), amount: budgetItemDraft.amount ? parseFloat(budgetItemDraft.amount) : 0, spent: false }] }) })
    setBudgetItemDraft({ desc: "", amount: "" })
  }
  function toggleBudgetItemSpent(celebId, itemId) {
    var c = celebrations.find(function(x) { return x.id === celebId })
    var budget = (c && c.budget) || { planned: null, items: [] }
    var items = (budget.items || []).map(function(it) { return it.id === itemId ? Object.assign({}, it, { spent: !it.spent }) : it })
    updateCelebField(celebId, { budget: Object.assign({}, budget, { items: items }) })
  }
  function removeBudgetItem(celebId, itemId) {
    var c = celebrations.find(function(x) { return x.id === celebId })
    var budget = (c && c.budget) || { planned: null, items: [] }
    var items = (budget.items || []).filter(function(it) { return it.id !== itemId })
    updateCelebField(celebId, { budget: Object.assign({}, budget, { items: items }) })
  }

  // Food & Cake
  function addFoodItem(celebId) {
    if (!foodDraft.item.trim()) return
    var c = celebrations.find(function(x) { return x.id === celebId })
    var list = (c && c.food) || []
    updateCelebField(celebId, { food: [...list, { id: Date.now().toString(), item: foodDraft.item.trim(), who: foodDraft.who.trim(), dietary: foodDraft.dietary.trim() }] })
    setFoodDraft({ item: "", who: "", dietary: "" })
  }
  // Copies a matched recipe's title into the dish checklist as a new food
  // item — the recipe itself is untouched, this only adds a dish entry.
  function useRecipeAsDish(celebId, recipe) {
    var c = celebrations.find(function(x) { return x.id === celebId })
    var list = (c && c.food) || []
    updateCelebField(celebId, { food: [...list, { id: Date.now().toString(), item: recipe.title, who: "", dietary: "", fromRecipe: recipe.title }] })
    setUsedRecipeConfirm(recipe.id)
    setTimeout(function() { setUsedRecipeConfirm(function(cur) { return cur === recipe.id ? null : cur }) }, 2500)
  }
  function toggleRecipePin(celebId, recipeId) {
    var c = celebrations.find(function(x) { return x.id === celebId })
    var pinned = (c && c.pinnedRecipes) || []
    var next = pinned.includes(recipeId) ? pinned.filter(function(id) { return id !== recipeId }) : [...pinned, recipeId]
    updateCelebField(celebId, { pinnedRecipes: next })
  }
  function removeFoodItem(celebId, itemId) {
    var c = celebrations.find(function(x) { return x.id === celebId })
    var list = ((c && c.food) || []).filter(function(it) { return it.id !== itemId })
    updateCelebField(celebId, { food: list })
  }

  // Decorations / Activities / To-Do — same flat checklist shape, one
  // generic set of helpers parameterized by field name.
  function addChecklistItem(celebId, field, text) {
    if (!text.trim()) return
    var c = celebrations.find(function(x) { return x.id === celebId })
    var list = (c && c[field]) || []
    var patch = {}; patch[field] = [...list, { id: Date.now().toString(), text: text.trim(), done: false }]
    updateCelebField(celebId, patch)
  }
  function toggleChecklistItem(celebId, field, itemId) {
    var c = celebrations.find(function(x) { return x.id === celebId })
    var list = ((c && c[field]) || []).map(function(it) { return it.id === itemId ? Object.assign({}, it, { done: !it.done }) : it })
    var patch = {}; patch[field] = list
    updateCelebField(celebId, patch)
  }
  function removeChecklistItem(celebId, field, itemId) {
    var c = celebrations.find(function(x) { return x.id === celebId })
    var list = ((c && c[field]) || []).filter(function(it) { return it.id !== itemId })
    var patch = {}; patch[field] = list
    updateCelebField(celebId, patch)
  }

  function save(updated) {
    setCelebrations(updated)
    afVaultChanged("celebrations");
    try { localStorage.setItem("af_celebrations", JSON.stringify(updated)) } catch {}
  }

  function addCelebration() {
    if (!form.name.trim() || !form.month || !form.day) return
    var newId = Date.now().toString()
    save([...celebrations, { id: newId, type: celebType, name: form.name.trim(), month: parseInt(form.month), day: parseInt(form.day), year: form.year ? parseInt(form.year) : null, notes: form.notes.trim() }])
    setForm({ name: "", month: "", day: "", year: "", notes: "" })
    setAdding(false)
    openCelebDetail(newId) // jump straight into the new celebration's detail view
  }

  function startEdit(c) {
    setEditingId(c.id)
    setEditForm({ name: c.name, month: String(c.month), day: String(c.day), year: c.year ? String(c.year) : "", notes: c.notes || "", type: c.type })
  }

  function saveEdit() {
    if (!editForm.name.trim() || !editForm.month || !editForm.day) return
    save(celebrations.map(function(c) {
      if (c.id !== editingId) return c
      return { ...c, name: editForm.name.trim(), month: parseInt(editForm.month), day: parseInt(editForm.day), year: editForm.year ? parseInt(editForm.year) : null, notes: editForm.notes.trim(), type: editForm.type }
    }))
    setEditingId(null)
  }

  const now = new Date(); now.setHours(0,0,0,0)
  const year = now.getFullYear()
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const INP = { background: "rgba(250,242,229,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none", boxSizing: "border-box" }
  const LBL = { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", marginBottom: 3 }
  const VAL = { fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }


  const passedThisYear = celebrations.filter(function(c) {
    const thisYear = new Date(year, c.month-1, c.day)
    return thisYear < now
  }).length

  const CELEBRATION_TYPE_OTHER = CELEBRATION_TYPES.find(function(t) { return t.id === "other" }) || CELEBRATION_TYPES[CELEBRATION_TYPES.length-1]
  function countdownLabel(diff) {
    if (diff < 0) return "passed"
    if (diff === 0) return "today"
    if (diff === 1) return "tomorrow"
    return "in " + diff + " days"
  }
  const celebEntries = celebrations.map(function(c) {
    const typeInfo = CELEBRATION_TYPES.find(function(t) { return t.id === c.type }) || CELEBRATION_TYPE_OTHER
    const next = new Date(year, c.month-1, c.day)
    if (next < now) next.setFullYear(next.getFullYear()+1)
    const diff = Math.round((next - now) / 86400000)
    const age = (c.type === "birthday" && c.year) ? (next.getFullYear() - c.year) : null
    const label = c.name + (age ? " turns " + age : c.type === "anniversary" ? " anniversary" : "")
    const cGifts = celebGifts(c.id, c.personId)
    const planned = planningFilledCount(c, cGifts.length > 0)
    return { ...c, typeInfo, next, diff, label, emoji: typeInfo.emoji, soon: diff <= 14, countdown: countdownLabel(diff), planned: planned, planTotal: PLANNING_DIMENSIONS.length }
  })

  const all = celebEntries.sort(function(a, b) { return a.diff - b.diff })
  const upcoming = all.filter(function(e) { return e.diff >= 0 && e.diff <= 30 })
  const past = all.filter(function(e) { return e.diff < 0 })
  const shown = filter === "upcoming" ? upcoming : all

  const detailCeleb = detailCelebId ? celebEntries.find(function(c) { return c.id === detailCelebId }) : null
  // F-recipes: a recipe matches this celebration when any of its occasion
  // tags appears as a substring of the celebration's name (case-insensitive) —
  // e.g. a recipe tagged "Christmas" matches a celebration named "Christmas 2026".
  const celebFoodMatchedRecipes = detailCeleb ? (recipeBook || []).filter(function(r) {
    var nameLower = (detailCeleb.name || "").toLowerCase()
    return (r.occasions || []).some(function(occ) { return nameLower.indexOf(String(occ).toLowerCase()) !== -1 })
  }).sort(function(a, b) {
    var pinned = detailCeleb.pinnedRecipes || []
    var aPinned = pinned.includes(a.id) ? 0 : 1
    var bPinned = pinned.includes(b.id) ? 0 : 1
    return aPinned - bPinned
  }) : []
  // COUNTDOWN-1: a countdown surfaces on this celebration's detail view when
  // it's tagged to show in Celebrations AND its target date's month/day
  // matches this celebration's own month/day (year-independent, since
  // celebrations recur annually).
  const celebMatchedCountdowns = detailCeleb ? (countdowns || []).filter(function(cd) {
    if (!cd || !cd.targetDate || !Array.isArray(cd.showOn) || !cd.showOn.includes("Celebrations")) return false
    var parts = String(cd.targetDate).split("-")
    if (parts.length !== 3) return false
    return parseInt(parts[1], 10) === detailCeleb.month && parseInt(parts[2], 10) === detailCeleb.day
  }) : []

  function celebCardPreview(c, cardId) {
    if (cardId === "overview") return c.notes ? c.notes : "Tap to view details"
    if (cardId === "guestlist") { var gl = c.guestList||[]; return gl.length ? gl.length+" guest"+(gl.length!==1?"s":"") : "No guests yet" }
    if (cardId === "gifts") { var gf = celebGifts(c.id, c.personId); if (!gf.length) return "No gift ideas yet"; var bought = gf.filter(function(g){return g.purchased}).length; return bought+" of "+gf.length+" bought" }
    if (cardId === "budget") { var b = c.budget; if (!b || (!b.planned && !(b.items&&b.items.length))) return "No budget set"; return b.planned ? "$"+b.planned+" planned" : (b.items.length+" item"+(b.items.length!==1?"s":"")) }
    if (cardId === "food") { var f = c.food||[]; return f.length ? f.length+" item"+(f.length!==1?"s":"") : "Nothing planned yet" }
    if (cardId === "decorations") { var d = c.decorations||[]; if (!d.length) return "No items yet"; var dd = d.filter(function(x){return x.done}).length; return dd+" of "+d.length+" done" }
    if (cardId === "activities") { var a = c.activities||[]; if (!a.length) return "No items yet"; var ad = a.filter(function(x){return x.done}).length; return ad+" of "+a.length+" done" }
    if (cardId === "todo") { var t = c.todo||[]; if (!t.length) return "No items yet"; var td = t.filter(function(x){return x.done}).length; return td+" of "+t.length+" done" }
    if (cardId === "photos") return "Coming soon"
    return ""
  }

  // Decorations / Activities / To-Do share one flat checklist shape and UI —
  // one render function parameterized by field name instead of three copies.
  function renderChecklistCard(field, title, draft, setDraft) {
    var list = (detailCeleb && detailCeleb[field]) || []
    return (
      <div>
        <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 16, fontWeight: 700, color: "#faf8f4", marginBottom: 12 }}>{title}</div>
        {list.length === 0 && <div style={{ fontSize: 12, color: "rgba(250,248,244,0.3)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", marginBottom: 10 }}>No items yet.</div>}
        {list.map(function(it) {
          return (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(250,242,229,0.06)" }}>
              <div onClick={function() { toggleChecklistItem(detailCeleb.id, field, it.id) }} style={{ width: 18, height: 18, borderRadius: 4, border: "1.5px solid " + (it.done ? "#7a9e8e" : "rgba(250,242,229,0.2)"), background: it.done ? "#7a9e8e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                {it.done && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
              </div>
              <span style={{ flex: 1, fontSize: 13, color: it.done ? "rgba(250,248,244,0.35)" : "rgba(250,248,244,0.85)", fontFamily: "DM Sans,sans-serif", textDecoration: it.done ? "line-through" : "none" }}>{it.text}</span>
              <button onClick={function() { removeChecklistItem(detailCeleb.id, field, it.id) }} style={{ background: "none", border: "none", fontSize: 12, color: "rgba(250,248,244,0.2)", cursor: "pointer" }}>✕</button>
            </div>
          )
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input value={draft} onChange={function(e) { setDraft(e.target.value) }} onKeyDown={function(e) { if (e.key === "Enter") { addChecklistItem(detailCeleb.id, field, draft); setDraft("") } }} placeholder="Add an item…" style={Object.assign({}, INP, { flex: 1 })} />
          <button onClick={function() { addChecklistItem(detailCeleb.id, field, draft); setDraft("") }} style={{ background: "#c8a97a", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#243A5A", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Add</button>
        </div>
      </div>
    )
  }

  // Shared gift row — used by both the celebration's Gift Ideas sub-card and
  // the standalone Gifts tab. opts.celebId, if passed, shows an assign/
  // unassign-to-this-celebration toggle (only meaningful from a celebration's
  // Gift Ideas card, not the person-based Gifts tab).
  function renderGiftRow(g, listId, opts) {
    opts = opts || {}
    return (
      <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(250,242,229,0.06)" }}>
        <div onClick={function() { toggleGiftPurchased(g.personId, listId, g.id) }} style={{ width: 18, height: 18, borderRadius: 4, border: "1.5px solid " + (g.purchased ? "#7a9e8e" : "rgba(250,242,229,0.2)"), background: g.purchased ? "#7a9e8e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
          {g.purchased && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
        </div>
        {g.imageUrl ? <img src={g.imageUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} /> : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: g.purchased ? "rgba(250,248,244,0.4)" : "#faf8f4", fontFamily: "DM Sans,sans-serif", textDecoration: g.purchased ? "line-through" : "none" }}>
            {g.title}
            {g.private && <span title="Private — hidden from the recipient" style={{ marginLeft: 6, fontSize: 11 }}>🔒</span>}
          </div>
          {g.notes && <div style={{ fontSize: 11, color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", marginTop: 1 }}>{g.notes}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
            {g.price != null && g.price !== "" && <span style={{ fontSize: 11, color: "#c8a97a", fontFamily: "DM Sans,sans-serif" }}>${(+g.price).toFixed(2)}</span>}
            {g.url && <a href={g.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#7EAEB4" }}>Link ↗</a>}
            {g.assignedTo && <span style={{ fontSize: 10, background: "rgba(200,169,122,0.15)", color: "#c8a97a", borderRadius: 8, padding: "1px 7px", fontFamily: "DM Sans,sans-serif" }}>→ {g.assignedTo}</span>}
          </div>
        </div>
        <button onClick={function() { toggleGiftPrivate(g.personId, listId, g.id) }} title={g.private ? "Make visible" : "Make private"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "rgba(250,248,244,0.3)", flexShrink: 0 }}>{g.private ? "🔒" : "🔓"}</button>
        {opts.celebId && (g.assignedCelebId === opts.celebId
          ? <button onClick={function() { unassignGift(g.personId, listId, g.id) }} style={{ background: "none", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 6, padding: "2px 7px", fontSize: 10, color: "#c8a97a", cursor: "pointer", fontFamily: "DM Sans,sans-serif", flexShrink: 0, whiteSpace: "nowrap" }}>Unassign</button>
          : <button onClick={function() { assignGiftToCeleb(g.personId, listId, g.id, opts.celebId) }} style={{ background: "none", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 6, padding: "2px 7px", fontSize: 10, color: "#c8a97a", cursor: "pointer", fontFamily: "DM Sans,sans-serif", flexShrink: 0, whiteSpace: "nowrap" }}>Assign here</button>
        )}
        <button onClick={function() { removeGiftFromList(g.personId, listId, g.id) }} style={{ background: "none", border: "none", fontSize: 12, color: "rgba(250,248,244,0.2)", cursor: "pointer", flexShrink: 0 }}>✕</button>
      </div>
    )
  }

  function renderGiftAddForm(onSubmit) {
    return (
      <div style={{ background: "rgba(250,242,229,0.03)", border: "1px solid rgba(250,242,229,0.08)", borderRadius: 10, padding: 12, marginTop: 8 }}>
        <input value={giftDraft.title} onChange={function(e) { setGiftDraft(function(p) { return Object.assign({}, p, { title: e.target.value }) }) }} placeholder="Gift idea…" style={Object.assign({}, INP, { width: "100%", marginBottom: 8 })} />
        <input value={giftDraft.notes} onChange={function(e) { setGiftDraft(function(p) { return Object.assign({}, p, { notes: e.target.value }) }) }} placeholder="Notes (optional)" style={Object.assign({}, INP, { width: "100%", marginBottom: 8 })} />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={giftDraft.price} onChange={function(e) { setGiftDraft(function(p) { return Object.assign({}, p, { price: e.target.value }) }) }} placeholder="Price" type="number" style={Object.assign({}, INP, { flex: 1 })} />
          <input value={giftDraft.url} onChange={function(e) { setGiftDraft(function(p) { return Object.assign({}, p, { url: e.target.value }) }) }} placeholder="Link URL (optional)" style={Object.assign({}, INP, { flex: 1 })} />
        </div>
        <input value={giftDraft.imageUrl} onChange={function(e) { setGiftDraft(function(p) { return Object.assign({}, p, { imageUrl: e.target.value }) }) }} placeholder="Image URL (optional)" style={Object.assign({}, INP, { width: "100%", marginBottom: 8 })} />
        <input value={giftDraft.assignedTo} onChange={function(e) { setGiftDraft(function(p) { return Object.assign({}, p, { assignedTo: e.target.value }) }) }} placeholder="Status (e.g. told Grandma, ordered from Amazon)" style={Object.assign({}, INP, { width: "100%", marginBottom: 8 })} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(250,248,244,0.5)", fontFamily: "DM Sans,sans-serif", marginBottom: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={giftDraft.private} onChange={function(e) { setGiftDraft(function(p) { return Object.assign({}, p, { private: e.target.checked }) }) }} />
          Private (hidden from the recipient)
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSubmit} style={{ flex: 1, background: "#c8a97a", border: "none", borderRadius: 8, padding: 8, fontSize: 12, color: "#243A5A", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Add</button>
          <button onClick={function() { setAddingGiftTarget(null) }} style={{ background: "rgba(250,242,229,0.06)", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "rgba(250,248,244,0.4)", cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    )
  }
  function resetGiftDraft() { setGiftDraft({ title: "", notes: "", price: "", url: "", imageUrl: "", assignedTo: "", private: false }) }
  function submitGiftDraft(personId, listId, assignedCelebId) {
    if (!giftDraft.title.trim()) return
    addGiftToList(personId, listId, {
      title: giftDraft.title.trim(), notes: giftDraft.notes.trim(),
      price: giftDraft.price ? parseFloat(giftDraft.price) : null,
      url: giftDraft.url.trim(), imageUrl: giftDraft.imageUrl.trim(),
      assignedTo: giftDraft.assignedTo.trim(), private: giftDraft.private,
      assignedCelebId: assignedCelebId || null,
    })
    resetGiftDraft()
    setAddingGiftTarget(null)
  }

  return (
    <div>
      {!detailCelebId && (<>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(250,242,229,0.08)", marginBottom: 16 }}>
        <button onClick={function() { setCelebTab("celebrations") }} style={{ background: "none", border: "none", borderBottom: celebTab==="celebrations" ? "2px solid #c8a97a" : "2px solid transparent", padding: "8px 16px", fontSize: 13, color: celebTab==="celebrations" ? "#c8a97a" : "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: celebTab==="celebrations" ? 700 : 500 }}>Celebrations</button>
        <button onClick={function() { setCelebTab("gifts") }} style={{ background: "none", border: "none", borderBottom: celebTab==="gifts" ? "2px solid #c8a97a" : "2px solid transparent", padding: "8px 16px", fontSize: 13, color: celebTab==="gifts" ? "#c8a97a" : "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: celebTab==="gifts" ? 700 : 500 }}>Gifts</button>
      </div>

      {celebTab === "celebrations" && (<>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: "#faf8f4" }}>Celebrations</div>
        <button onClick={function() { setAdding(function(p) { return !p }); setForm({ name: "", month: "", day: "", year: "", notes: "" }) }} style={{ background: "rgba(200,169,122,0.12)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>+ Add</button>
      </div>
      <div style={{ fontSize: 12, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", marginBottom: 16 }}>{upcoming.length} upcoming · {passedThisYear} passed this year</div>

      {adding && (
        <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 12, padding: "16px", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {CELEBRATION_TYPES.map(function(t) {
              return (
                <button key={t.id} onClick={function() { setCelebType(t.id) }} style={{ background: celebType === t.id ? "rgba(200,169,122,0.2)" : "rgba(250,242,229,0.04)", border: "1px solid " + (celebType === t.id ? "rgba(200,169,122,0.5)" : "rgba(250,242,229,0.1)"), borderRadius: 20, padding: "5px 11px", fontSize: 11, color: celebType === t.id ? "#c8a97a" : "rgba(250,248,244,0.45)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: celebType === t.id ? 700 : 400 }}>
                  {t.emoji} {t.label}
                </button>
              )
            })}
          </div>
          <input value={form.name} onChange={function(e) { setForm(function(p) { return {...p, name: e.target.value} }) }} placeholder={celebType === "birthday" ? "Person's name" : "What's the occasion?"} style={Object.assign({}, INP, {width: "100%", marginBottom: 8})} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select value={form.month} onChange={function(e) { setForm(function(p) { return {...p, month: e.target.value} }) }} style={Object.assign({}, INP, { flex: 2, color: form.month ? "#faf8f4" : "rgba(250,248,244,0.35)", WebkitAppearance: "none", appearance: "none" })}>
              <option value="" style={{ background: "#243A5A", color: "rgba(250,248,244,0.5)" }}>Month</option>
              {MONTHS.map(function(m, i) { return <option key={i} value={i+1} style={{ background: "#243A5A", color: "#faf8f4" }}>{m}</option> })}
            </select>
            <input value={form.day} onChange={function(e) { setForm(function(p) { return {...p, day: e.target.value} }) }} placeholder="Day" type="number" min="1" max="31" style={Object.assign({}, INP, { flex: 1 })} />
            {(celebType === "birthday" || celebType === "anniversary") && (
              <input value={form.year} onChange={function(e) { setForm(function(p) { return {...p, year: e.target.value} }) }} placeholder="Year (opt)" type="number" style={Object.assign({}, INP, { flex: 1 })} />
            )}
          </div>
          <input value={form.notes} onChange={function(e) { setForm(function(p) { return {...p, notes: e.target.value} }) }} placeholder="Notes (optional)" style={Object.assign({}, INP, {width: "100%", marginBottom: 12})} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addCelebration} style={{ flex: 1, background: "#c8a97a", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, color: "#243A5A", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Save celebration</button>
            <button onClick={function() { setAdding(false) }} style={{ background: "rgba(250,242,229,0.06)", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "rgba(250,248,244,0.4)", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(250,242,229,0.08)", marginBottom: 16 }}>
        {[["upcoming","Upcoming"],["all","All"]].map(function(pair) {
          const v = pair[0]; const l = pair[1]
          return (
            <button key={v} onClick={function() { setFilter(v) }} style={{ background: "none", border: "none", borderBottom: filter===v ? "2px solid #c8a97a" : "2px solid transparent", padding: "7px 14px", fontSize: 12, color: filter===v ? "#c8a97a" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: filter===v ? 700 : 400 }}>{l}</button>
          )
        })}
      </div>

      {shown.length === 0 && <div style={{ fontSize: 13, color: "rgba(250,248,244,0.3)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", textAlign: "center", padding: "32px 0" }}>No celebrations yet — tap + Add to get started.</div>}
      {shown.map(function(e, i) {
        const isPast = e.diff < 0
        const cGifts = celebGifts(e.id, e.personId)
        const boughtCount = cGifts.filter(function(g) { return g.purchased }).length
        const hasGifts = cGifts.length > 0

        return (
          <div key={e.id || i} onClick={function() { openCelebDetail(e.id) }} style={{ background: e.soon && !isPast ? "rgba(200,131,74,0.06)" : "rgba(250,242,229,0.03)", border: "1px solid " + (e.soon && !isPast ? "rgba(200,131,74,0.2)" : "rgba(250,242,229,0.07)"), borderRadius: 12, marginBottom: 10, opacity: isPast ? 0.5 : 1, overflow: "hidden", cursor: "pointer" }}>
            {/* Card header — icon, name, type, countdown */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px 8px" }}>
              <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{e.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isPast ? "rgba(250,248,244,0.45)" : "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{e.label}</span>
                  {hasGifts && <span style={{ fontSize: 12 }} title={boughtCount + "/" + cGifts.length + " bought"}>🎁</span>}
                  {hasGifts && boughtCount < cGifts.length && <span style={{ fontSize: 9, background: "rgba(200,131,74,0.2)", color: "#c8834a", borderRadius: 8, padding: "1px 5px", fontFamily: "DM Sans,sans-serif", fontWeight: 700 }}>{cGifts.length - boughtCount} to get</span>}
                </div>
                <div style={{ fontSize: 11, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", marginTop: 2 }}>
                  {e.month && MONTHS[e.month-1]+" "+e.day}{" · "}{e.typeInfo && e.typeInfo.label}
                  {" · "}<span style={{ color: isPast ? "rgba(250,248,244,0.3)" : e.diff<=7 ? "#c8834a" : "rgba(250,248,244,0.5)", fontWeight: e.diff<=7 && !isPast ? 700 : 500 }}>{e.countdown}</span>
                </div>
                {e.notes && <div style={{ fontSize: 11, color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", marginTop: 2, fontStyle: "italic" }}>{e.notes}</div>}
              </div>
              <button onClick={function(ev) { ev.stopPropagation(); save(celebrations.filter(function(x) { return x.id !== e.id })) }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: "2px 3px", color: "rgba(250,248,244,0.2)", flexShrink: 0 }}>✕</button>
            </div>

            {/* Planning status — N of 7 planning cards have content */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px 10px" }}>
              <div style={{ flex: 1, height: 4, background: "rgba(250,242,229,0.08)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: (e.planned/e.planTotal*100)+"%", height: "100%", background: e.planned===0 ? "rgba(250,242,229,0.12)" : "#c8a97a", transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 10, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", whiteSpace: "nowrap" }}>{e.planned} of {e.planTotal} planned</span>
            </div>
          </div>
        )
      })}
      </>)}

      {celebTab === "gifts" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button onClick={function() { setGiftsAZ(!giftsAZ) }} style={{ fontSize: 11, color: giftsAZ?"#c8a97a":"rgba(250,248,244,0.5)", background: giftsAZ?"rgba(200,169,122,0.12)":"transparent", border: "0.5px solid "+(giftsAZ?"rgba(200,169,122,0.4)":"rgba(250,242,229,0.12)"), borderRadius: 7, padding: "4px 11px", cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>{giftsAZ?"A–Z ✓":"A–Z"}</button>
          </div>
          {(function() {
            var roster = hLoadPeople()
            var giftPersonIds = Array.from(new Set(roster.map(function(p) { return p.id }).concat(Object.keys(gifts).filter(function(k) { return k !== "holiday_lists" }))))
            if (giftPersonIds.length === 0) return <div style={{ fontSize: 13, color: "rgba(250,248,244,0.3)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", textAlign: "center", padding: "32px 0" }}>No people yet.</div>
            return giftPersonIds.map(function(personId) {
              var name = personDisplayName(personId)
              var lists = personLists(personId)
              var personOpen = isPersonOpen(personId)
              return (
                <div key={personId} style={{ marginBottom: 16, background: "rgba(250,242,229,0.03)", border: "1px solid rgba(250,242,229,0.07)", borderRadius: 12, overflow: "hidden" }}>
                  <div onClick={function() { togglePersonOpen(personId) }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px", cursor: "pointer" }}>
                    <div style={{ flex: 1, fontFamily: "Cormorant Garamond,serif", fontSize: 15, fontWeight: 700, color: "#faf8f4" }}>{name}</div>
                    <span style={{ color: "rgba(250,248,244,0.35)", fontSize: "0.62rem", display: "inline-block", transform: personOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
                  </div>
                  {personOpen && (
                    <div style={{ padding: "0 14px 14px" }}>
                      {lists.length === 0 && <div style={{ fontSize: 12, color: "rgba(250,248,244,0.25)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", marginBottom: 8 }}>No lists yet.</div>}
                      {lists.map(function(list) {
                        var listKey = personId + ":" + list.id
                        var listOpen = !!openLists[listKey]
                        var visibleItems = visibleListGifts(personId, list)
                        if (giftsAZ) visibleItems = visibleItems.slice().sort(function(a, b) { return (a.title||"").localeCompare(b.title||"") })
                        var isAddingHere = addingGiftTarget && addingGiftTarget.personId === personId && addingGiftTarget.listId === list.id
                        return (
                          <div key={list.id} style={{ background: "rgba(250,242,229,0.03)", border: "1px solid rgba(250,242,229,0.07)", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                            <div onClick={function() { if (renamingListId !== list.id) toggleListOpen(personId, list.id) }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer" }}>
                              {renamingListId === list.id ? (
                                <input autoFocus value={renameDraft} onChange={function(e) { setRenameDraft(e.target.value) }} onClick={function(e) { e.stopPropagation() }}
                                  onKeyDown={function(e) { if (e.key === "Enter") { renamePersonList(personId, list.id, renameDraft); setRenamingListId(null) } if (e.key === "Escape") setRenamingListId(null) }}
                                  onBlur={function() { if (renameDraft.trim()) renamePersonList(personId, list.id, renameDraft); setRenamingListId(null) }}
                                  style={Object.assign({}, INP, { flex: 1 })} />
                              ) : (
                                <div onClick={function(e) { e.stopPropagation(); setRenamingListId(list.id); setRenameDraft(list.name) }} style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", cursor: "text" }}>{list.name}</div>
                              )}
                              <span style={{ fontSize: 11, color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif" }}>{visibleItems.length}</span>
                              <span style={{ color: "rgba(250,248,244,0.35)", fontSize: "0.62rem", display: "inline-block", transform: listOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
                            </div>
                            {listOpen && (
                              <div style={{ padding: "0 12px 12px" }}>
                                {visibleItems.length === 0 && <div style={{ fontSize: 12, color: "rgba(250,248,244,0.25)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", marginBottom: 8 }}>No gift ideas yet.</div>}
                                {visibleItems.map(function(g) { return renderGiftRow(g, list.id, {}) })}
                                {isAddingHere ? renderGiftAddForm(function() { submitGiftDraft(personId, list.id, null) }) : (
                                  <button onClick={function() { resetGiftDraft(); setAddingGiftTarget({ personId: personId, listId: list.id }) }} style={{ marginTop: 6, background: "rgba(200,169,122,0.12)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>+ Add gift</button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {addingListFor === personId ? (
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                          <input autoFocus value={newListName} onChange={function(e) { setNewListName(e.target.value) }} onKeyDown={function(e) { if (e.key === "Enter") { addPersonList(personId, newListName, "custom"); setNewListName(""); setAddingListFor(null) } }} placeholder="List name (e.g. Easter basket)…" style={Object.assign({}, INP, { flex: 1 })} />
                          <button onClick={function() { addPersonList(personId, newListName, "custom"); setNewListName(""); setAddingListFor(null) }} style={{ background: "#c8a97a", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#243A5A", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Add</button>
                          <button onClick={function() { setAddingListFor(null) }} style={{ background: "rgba(250,242,229,0.06)", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "rgba(250,248,244,0.4)", cursor: "pointer" }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={function() { setNewListName(""); setAddingListFor(personId) }} style={{ marginTop: 6, background: "rgba(200,169,122,0.12)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>+ Add list</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>
      )}
      </>)}

      {/* Level 2/3 — celebration detail view + planning sub-cards */}
      {detailCeleb && (
        <div>
          <button onClick={backToCelebrations} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(200,169,122,0.7)", fontSize: 13, fontFamily: "DM Sans,sans-serif", padding: "0 0 14px 0", display: "flex", alignItems: "center", gap: 5 }}>← Back to Celebrations</button>

          {!activeCelebCard ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div style={{ fontSize: 32, flexShrink: 0 }}>{detailCeleb.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 20, fontWeight: 700, color: "#faf8f4" }}>{detailCeleb.label}</div>
                  <div style={{ fontSize: 12, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", marginTop: 2 }}>
                    {detailCeleb.month && MONTHS[detailCeleb.month-1]+" "+detailCeleb.day}{" · "}{detailCeleb.typeInfo && detailCeleb.typeInfo.label}{" · "}{detailCeleb.countdown}
                  </div>
                </div>
              </div>
              {celebMatchedCountdowns.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {celebMatchedCountdowns.map(function(cd) {
                    return (
                      <div key={cd.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(250,242,229,0.04)", border: "1px solid " + (cd.color || "rgba(250,242,229,0.1)"), borderRadius: 20, padding: "4px 11px", fontSize: 12, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>
                        <span>{cd.emoji || "⭐"}</span><span style={{ fontWeight: 700 }}>{cd.title}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                {CELEB_CARD_ORDER.map(function(cardId) {
                  var meta = CELEB_CARD_META[cardId]
                  return (
                    <div key={cardId} onClick={function() { setActiveCelebCard(cardId) }} style={{ background: "rgba(250,242,229,0.04)", border: "1px solid rgba(250,242,229,0.08)", borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
                      <div style={{ fontSize: 18, marginBottom: 6 }}>{meta.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", marginBottom: 3 }}>{meta.title}</div>
                      <div style={{ fontSize: 11, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif" }}>{celebCardPreview(detailCeleb, cardId)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div>
              <button onClick={function() { setActiveCelebCard(null) }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(200,169,122,0.6)", fontSize: 12, fontFamily: "DM Sans,sans-serif", padding: "0 0 14px 0", display: "flex", alignItems: "center", gap: 5 }}>← {detailCeleb.name}</button>

              {activeCelebCard === "overview" && (
                <div style={{ background: "rgba(250,242,229,0.04)", border: "1px solid rgba(250,242,229,0.08)", borderRadius: 12, padding: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 16, fontWeight: 700, color: "#faf8f4" }}>Overview</div>
                    <button onClick={function() { startEdit(detailCeleb) }} style={{ background: "rgba(200,169,122,0.12)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 7, padding: "4px 12px", fontSize: 11, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>Edit</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div><div style={LBL}>Name</div><div style={VAL}>{detailCeleb.name}</div></div>
                    <div><div style={LBL}>Type</div><div style={VAL}>{detailCeleb.typeInfo.emoji} {detailCeleb.typeInfo.label}</div></div>
                    <div><div style={LBL}>Date</div><div style={VAL}>{detailCeleb.month && MONTHS[detailCeleb.month-1]+" "+detailCeleb.day}{detailCeleb.year ? ", "+detailCeleb.year : ""}</div></div>
                    <div><div style={LBL}>Notes</div><div style={VAL}>{detailCeleb.notes || "No notes yet."}</div></div>
                  </div>
                </div>
              )}

              {activeCelebCard === "guestlist" && (
                <div>
                  <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 16, fontWeight: 700, color: "#faf8f4", marginBottom: 12 }}>Guest List</div>
                  {(detailCeleb.guestList||[]).length === 0 && <div style={{ fontSize: 12, color: "rgba(250,248,244,0.3)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", marginBottom: 10 }}>No guests added yet.</div>}
                  {(detailCeleb.guestList||[]).map(function(g) {
                    return (
                      <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(250,242,229,0.03)", borderRadius: 9, marginBottom: 6, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 80, fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{g.name}</div>
                        <select value={g.rsvp} onChange={function(e) { setGuestRsvp(detailCeleb.id, g.id, e.target.value) }} style={{ background: "rgba(250,242,229,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 6, padding: "3px 6px", fontSize: 11, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>
                          <option value="pending" style={{ background: "#243A5A" }}>Pending</option>
                          <option value="yes" style={{ background: "#243A5A" }}>Yes</option>
                          <option value="no" style={{ background: "#243A5A" }}>No</option>
                          <option value="maybe" style={{ background: "#243A5A" }}>Maybe</option>
                        </select>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button onClick={function() { setGuestPlusOnes(detailCeleb.id, g.id, -1) }} style={{ background: "none", border: "none", color: "rgba(250,248,244,0.4)", cursor: "pointer", fontSize: 13, padding: "0 3px" }}>−</button>
                          <span style={{ fontSize: 11, color: "rgba(250,248,244,0.5)", minWidth: 14, textAlign: "center" }}>+{g.plusOnes||0}</span>
                          <button onClick={function() { setGuestPlusOnes(detailCeleb.id, g.id, 1) }} style={{ background: "none", border: "none", color: "rgba(250,248,244,0.4)", cursor: "pointer", fontSize: 13, padding: "0 3px" }}>+</button>
                        </div>
                        <button onClick={function() { removeGuest(detailCeleb.id, g.id) }} style={{ background: "none", border: "none", fontSize: 12, color: "rgba(250,248,244,0.2)", cursor: "pointer" }}>✕</button>
                      </div>
                    )
                  })}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input value={guestDraft} onChange={function(e) { setGuestDraft(e.target.value) }} onKeyDown={function(e) { if (e.key === "Enter") addGuest(detailCeleb.id) }} placeholder="Guest name…" style={Object.assign({}, INP, { flex: 1 })} />
                    <button onClick={function() { addGuest(detailCeleb.id) }} style={{ background: "#c8a97a", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#243A5A", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Add</button>
                  </div>
                </div>
              )}

              {activeCelebCard === "gifts" && (function() {
                var relevant = celebGifts(detailCeleb.id, detailCeleb.personId)
                var isAddingHere = addingGiftTarget && addingGiftTarget.celebId === detailCeleb.id
                return (
                  <div>
                    <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 16, fontWeight: 700, color: "#faf8f4", marginBottom: 12 }}>Gift Ideas</div>
                    {relevant.length === 0 && <div style={{ fontSize: 12, color: "rgba(250,248,244,0.3)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", marginBottom: 10 }}>No gift ideas yet.</div>}
                    {relevant.map(function(g) { return renderGiftRow(g, g.__listId, { celebId: detailCeleb.id }) })}
                    {detailCeleb.personId ? (
                      isAddingHere ? renderGiftAddForm(function() { submitGiftDraft(addingGiftTarget.personId, addingGiftTarget.listId, addingGiftTarget.celebId) }) : (
                        <button onClick={function() {
                          resetGiftDraft()
                          var list = findOrCreatePersonList(detailCeleb.personId, detailCeleb.name, detailCeleb.type)
                          setAddingGiftTarget({ personId: detailCeleb.personId, listId: list.id, celebId: detailCeleb.id })
                        }} style={{ marginTop: 10, background: "rgba(200,169,122,0.12)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>+ Add gift idea</button>
                      )
                    ) : (
                      <div style={{ fontSize: 11, color: "rgba(250,248,244,0.25)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", marginTop: 10 }}>This celebration isn't linked to a specific person — add and assign gift ideas from the Gifts tab instead.</div>
                    )}
                  </div>
                )
              })()}

              {activeCelebCard === "budget" && (
                <div>
                  <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 16, fontWeight: 700, color: "#faf8f4", marginBottom: 12 }}>Budget</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={LBL}>Planned</div>
                      <input value={detailCeleb.budget && detailCeleb.budget.planned!=null ? detailCeleb.budget.planned : ""} onChange={function(e) { setBudgetPlanned(detailCeleb.id, e.target.value) }} placeholder="0" type="number" style={INP} />
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={LBL}>Spent</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#c8a97a", fontFamily: "DM Sans,sans-serif" }}>${(detailCeleb.budget && detailCeleb.budget.items ? detailCeleb.budget.items.filter(function(it){return it.spent}).reduce(function(s,it){return s+(it.amount||0)},0) : 0).toFixed(2)}</div>
                    </div>
                  </div>
                  {((detailCeleb.budget && detailCeleb.budget.items) || []).map(function(it) {
                    return (
                      <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(250,242,229,0.06)" }}>
                        <div onClick={function() { toggleBudgetItemSpent(detailCeleb.id, it.id) }} style={{ width: 18, height: 18, borderRadius: 4, border: "1.5px solid " + (it.spent ? "#7a9e8e" : "rgba(250,242,229,0.2)"), background: it.spent ? "#7a9e8e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                          {it.spent && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
                        </div>
                        <span style={{ flex: 1, fontSize: 13, color: it.spent ? "rgba(250,248,244,0.35)" : "rgba(250,248,244,0.85)", fontFamily: "DM Sans,sans-serif", textDecoration: it.spent ? "line-through" : "none" }}>{it.desc}</span>
                        <span style={{ fontSize: 12, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif" }}>${(it.amount||0).toFixed(2)}</span>
                        <button onClick={function() { removeBudgetItem(detailCeleb.id, it.id) }} style={{ background: "none", border: "none", fontSize: 12, color: "rgba(250,248,244,0.2)", cursor: "pointer" }}>✕</button>
                      </div>
                    )
                  })}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <input value={budgetItemDraft.desc} onChange={function(e) { setBudgetItemDraft(function(p) { return Object.assign({}, p, { desc: e.target.value }) }) }} placeholder="Item…" style={Object.assign({}, INP, { flex: 2 })} />
                    <input value={budgetItemDraft.amount} onChange={function(e) { setBudgetItemDraft(function(p) { return Object.assign({}, p, { amount: e.target.value }) }) }} placeholder="$" type="number" style={Object.assign({}, INP, { flex: 1 })} />
                    <button onClick={function() { addBudgetItem(detailCeleb.id) }} style={{ background: "#c8a97a", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#243A5A", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Add</button>
                  </div>
                </div>
              )}

              {activeCelebCard === "food" && (
                <div>
                  <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 16, fontWeight: 700, color: "#faf8f4", marginBottom: 12 }}>Food & Cake</div>

                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif" }}>Recipes</div>
                      {onBrowseRecipes && <button onClick={onBrowseRecipes} style={{ background: "none", border: "none", fontSize: 11, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>Browse all recipes →</button>}
                    </div>
                    {celebFoodMatchedRecipes.length === 0 ? (
                      <div style={{ fontSize: 12, color: "rgba(250,248,244,0.3)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif" }}>
                        No recipes tagged for this occasion yet — {onBrowseRecipes ? <span onClick={onBrowseRecipes} style={{ color: "#c8a97a", cursor: "pointer", fontStyle: "normal", textDecoration: "underline" }}>add one in Meals → Recipes</span> : "add one in Meals → Recipes"}.
                      </div>
                    ) : celebFoodMatchedRecipes.map(function(r) {
                      var pinned = (detailCeleb.pinnedRecipes || []).includes(r.id)
                      return (
                        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: pinned ? "rgba(200,169,122,0.14)" : "rgba(200,169,122,0.06)", border: "1px solid " + (pinned ? "rgba(200,169,122,0.35)" : "rgba(200,169,122,0.15)"), borderRadius: 9, marginBottom: 6 }}>
                          <button onClick={function() { toggleRecipePin(detailCeleb.id, r.id) }} title={pinned ? "Unpin from this celebration" : "Pin to this celebration"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: pinned ? "#c8a97a" : "rgba(250,248,244,0.25)", flexShrink: 0, padding: 2, lineHeight: 1 }}>{pinned ? "📌" : "📍"}</button>
                          <div onClick={function() { onOpenRecipe && onOpenRecipe(r.id) }} style={{ flex: 1, cursor: onOpenRecipe ? "pointer" : "default" }}>
                            <div style={{ fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", fontWeight: 600 }}>{r.title}</div>
                            <div style={{ fontSize: 11, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", marginTop: 2 }}>{r.type === "full" ? "Full recipe" : "Simple dish"}{r.serves ? " · Serves " + r.serves : ""}</div>
                            {usedRecipeConfirm === r.id && <div style={{ fontSize: 11, color: "#7a9e8e", fontFamily: "DM Sans,sans-serif", marginTop: 3, fontWeight: 600 }}>✓ Added to dish checklist below</div>}
                          </div>
                          <button onClick={function() { useRecipeAsDish(detailCeleb.id, r) }} style={{ background: "rgba(200,169,122,0.15)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 7, padding: "4px 9px", fontSize: 11, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>Use this recipe</button>
                        </div>
                      )
                    })}
                  </div>

                  {(detailCeleb.food||[]).length === 0 && <div style={{ fontSize: 12, color: "rgba(250,248,244,0.3)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", marginBottom: 10 }}>Nothing planned yet.</div>}
                  {(detailCeleb.food||[]).map(function(f) {
                    return (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(250,242,229,0.03)", borderRadius: 9, marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{f.item}</div>
                          <div style={{ fontSize: 11, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif" }}>{f.who ? "Bringing: "+f.who : ""}{f.who && f.dietary ? " · " : ""}{f.dietary}{(f.who || f.dietary) && f.fromRecipe ? " · " : ""}{f.fromRecipe ? "From recipe: "+f.fromRecipe : ""}</div>
                        </div>
                        <button onClick={function() { removeFoodItem(detailCeleb.id, f.id) }} style={{ background: "none", border: "none", fontSize: 12, color: "rgba(250,248,244,0.2)", cursor: "pointer" }}>✕</button>
                      </div>
                    )
                  })}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    <input value={foodDraft.item} onChange={function(e) { setFoodDraft(function(p) { return Object.assign({}, p, { item: e.target.value }) }) }} placeholder="Dish or item…" style={INP} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={foodDraft.who} onChange={function(e) { setFoodDraft(function(p) { return Object.assign({}, p, { who: e.target.value }) }) }} placeholder="Who's bringing it (opt)" style={Object.assign({}, INP, { flex: 1 })} />
                      <input value={foodDraft.dietary} onChange={function(e) { setFoodDraft(function(p) { return Object.assign({}, p, { dietary: e.target.value }) }) }} placeholder="Dietary notes (opt)" style={Object.assign({}, INP, { flex: 1 })} />
                    </div>
                    <button onClick={function() { addFoodItem(detailCeleb.id) }} style={{ background: "#c8a97a", border: "none", borderRadius: 8, padding: "8px", fontSize: 12, color: "#243A5A", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Add</button>
                  </div>
                </div>
              )}

              {activeCelebCard === "decorations" && renderChecklistCard("decorations", "Decorations", decorDraft, setDecorDraft)}
              {activeCelebCard === "activities" && renderChecklistCard("activities", "Activities", activityDraft, setActivityDraft)}
              {activeCelebCard === "todo" && renderChecklistCard("todo", "To-Do", todoDraft, setTodoDraft)}

              {activeCelebCard === "photos" && (
                <div style={{ textAlign: "center", padding: "32px 20px", color: "rgba(250,248,244,0.3)", fontSize: 13, fontFamily: "DM Sans,sans-serif" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📸</div>
                  Add photos coming soon.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Overview edit modal — reachable from the Overview sub-card's Edit
          button (list-row inline editing was removed in Phase 2). */}
      {editingId && (
        <div onClick={function() { setEditingId(null) }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div onClick={function(e) { e.stopPropagation() }} style={{ background: "#243A5A", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 14, padding: "18px", maxWidth: 420, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 18, fontWeight: 700, color: "#faf8f4", marginBottom: 14 }}>Edit celebration</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {CELEBRATION_TYPES.map(function(t) {
                return (
                  <button key={t.id} onClick={function() { setEditForm(function(p) { return {...p, type: t.id} }) }} style={{ background: editForm.type === t.id ? "rgba(200,169,122,0.2)" : "rgba(250,242,229,0.04)", border: "1px solid " + (editForm.type === t.id ? "rgba(200,169,122,0.5)" : "rgba(250,242,229,0.1)"), borderRadius: 20, padding: "4px 10px", fontSize: 11, color: editForm.type === t.id ? "#c8a97a" : "rgba(250,248,244,0.45)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: editForm.type === t.id ? 700 : 400 }}>
                    {t.emoji} {t.label}
                  </button>
                )
              })}
            </div>
            <input value={editForm.name} onChange={function(ev) { setEditForm(function(p) { return {...p, name: ev.target.value} }) }} placeholder="Name" style={Object.assign({}, INP, {width: "100%", marginBottom: 8})} />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <select value={editForm.month} onChange={function(ev) { setEditForm(function(p) { return {...p, month: ev.target.value} }) }} style={Object.assign({}, INP, { flex: 2, color: editForm.month ? "#faf8f4" : "rgba(250,248,244,0.35)", WebkitAppearance: "none", appearance: "none" })}>
                <option value="" style={{ background: "#243A5A", color: "rgba(250,248,244,0.5)" }}>Month</option>
                {MONTHS.map(function(m, mi) { return <option key={mi} value={mi+1} style={{ background: "#243A5A", color: "#faf8f4" }}>{m}</option> })}
              </select>
              <input value={editForm.day} onChange={function(ev) { setEditForm(function(p) { return {...p, day: ev.target.value} }) }} placeholder="Day" type="number" min="1" max="31" style={Object.assign({}, INP, { flex: 1 })} />
              {(editForm.type === "birthday" || editForm.type === "anniversary") && (
                <input value={editForm.year} onChange={function(ev) { setEditForm(function(p) { return {...p, year: ev.target.value} }) }} placeholder="Year (opt)" type="number" style={Object.assign({}, INP, { flex: 1 })} />
              )}
            </div>
            <input value={editForm.notes} onChange={function(ev) { setEditForm(function(p) { return {...p, notes: ev.target.value} }) }} placeholder="Notes (optional)" style={Object.assign({}, INP, {width: "100%", marginBottom: 10})} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveEdit} style={{ flex: 1, background: "#c8a97a", border: "none", borderRadius: 8, padding: "8px", fontSize: 13, color: "#243A5A", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Save changes</button>
              <button onClick={function() { setEditingId(null) }} style={{ background: "rgba(250,242,229,0.06)", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "rgba(250,248,244,0.4)", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GiftsAndCelebrations({ calEvents, onOpenRecipe, onBrowseRecipes }) {
  calEvents = calEvents || []
  return <CelebrationsSection calEvents={calEvents} onOpenRecipe={onOpenRecipe} onBrowseRecipes={onBrowseRecipes} />
}

// ── Pets Section ──────────────────────────────────────────────────────────────
const VACCINE_LIST = ["Rabies","DHPP/DA2PP","Bordetella","Leptospirosis","Lyme","Canine Influenza","FVRCP","FeLV","Other"]
const PET_TYPES = ["Dog","Cat","Bird","Rabbit","Fish","Reptile","Other"]

function PetsSection() {
  const [pets, setPets] = useState(function() {
    try { const _p = JSON.parse(localStorage.getItem("af_pets") || "[]"); return Array.isArray(_p) ? _p : []; } catch { return [] }
  })
  React.useEffect(function() {
    function onRefresh(e) {
      if (!e.detail?.key || e.detail.key === "pets") {
        try { var _p = JSON.parse(localStorage.getItem("af_pets") || "[]"); setPets(Array.isArray(_p) ? _p : []) } catch {}
      }
    }
    window.addEventListener("af-data-changed", onRefresh)
    return function() { window.removeEventListener("af-data-changed", onRefresh) }
  }, [])
  const [activePetId, setActivePetId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newPetForm, setNewPetForm] = useState({ name: "", type: "Dog", breed: "", color: "", dob: "", photo: null })
  const [addingVaccine, setAddingVaccine] = useState(false)
  const [vaccineForm, setVaccineForm] = useState({ name: "Rabies", date: "", due: "", vet: "", notes: "" })
  const [addingMed, setAddingMed] = useState(false)
  const [medForm, setMedForm] = useState({ name: "", dose: "", freq: "", refill: "", notes: "", contact: "" })
  const [editingField, setEditingField] = useState(null)
  const [editVal, setEditVal] = useState("")
  const [addingDoc, setAddingDoc] = useState(false)
  const docInputRef = React.useRef(null)

  function save(updated) {
    setPets(updated)
    afVaultChanged("pets");
    try { localStorage.setItem("af_pets", JSON.stringify(updated)) } catch {}
  }

  const activePet = pets.find(function(p) { return p.id === activePetId })

  function addPet() {
    if (!newPetForm.name.trim()) return
    const pet = { id: Date.now().toString(), ...newPetForm, vaccines: [], medications: [], tags: { rabies: "", chip: "", registration: "" }, notes: "" }
    save([...pets, pet])
    setActivePetId(pet.id)
    setAdding(false)
    setNewPetForm({ name: "", type: "Dog", breed: "", color: "", dob: "", photo: null })
  }

  function updatePet(id, changes) {
    save(pets.map(function(p) { return p.id === id ? {...p, ...changes} : p }))
  }

  function petInjectCalendar(title, dateStr, calId, color) {
    if (!dateStr) return
    try {
      var events = JSON.parse(localStorage.getItem("af_calEvents") || "[]")
      if (!events.some(function(e) { return e.id === calId })) {
        events.push({ id: calId, title: title, date: dateStr, color: color || "#7EAEB4", notes: "Added from Pets" })
        localStorage.setItem("af_calEvents", JSON.stringify(events))
        window.dispatchEvent(new CustomEvent("af-cal-changed"))
      }
    } catch {}
  }

  function addVaccine(petId) {
    if (!vaccineForm.name) return
    const v = { id: Date.now().toString(), ...vaccineForm }
    updatePet(petId, { vaccines: [...(activePet.vaccines||[]), v] })
    if (vaccineForm.addToCalendar && vaccineForm.due) {
      petInjectCalendar("💉 " + activePet.name + " – " + vaccineForm.name + " due", vaccineForm.due, "petvax_" + v.id, "#7EAEB4")
    }
    setVaccineForm({ name: "Rabies", date: "", due: "", vet: "", notes: "", addToCalendar: false })
    setAddingVaccine(false)
  }

  function addMed(petId) {
    if (!medForm.name.trim()) return
    const m = { id: Date.now().toString(), ...medForm }
    updatePet(petId, { medications: [...(activePet.medications||[]), m] })
    if (medForm.addToCalendar && medForm.refill) {
      petInjectCalendar("💊 " + activePet.name + " – " + medForm.name + " refill", medForm.refill, "petmed_" + m.id, "#c8a97a")
    }
    setMedForm({ name: "", dose: "", freq: "", refill: "", notes: "", contact: "", addToCalendar: false })
    setAddingMed(false)
  }

  function handlePhoto(e, petId) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = function() { updatePet(petId, { photo: reader.result }) }
    reader.readAsDataURL(file)
  }

  function handleDoc(e, petId) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const pet = pets.find(function(p) { return p.id === petId })
    const existing = pet.documents || []
    var loaded = 0
    files.forEach(function(file) {
      const reader = new FileReader()
      reader.onload = function() {
        loaded++
        const doc = {
          id: Date.now().toString() + loaded,
          name: file.name,
          type: file.type,
          size: file.size,
          data: reader.result,
          uploaded: new Date().toLocaleDateString()
        }
        // Need to read current state fresh each time
        setPets(function(current) {
          const updated = current.map(function(p) {
            return p.id === petId ? { ...p, documents: [...(p.documents || []), doc] } : p
          })
          try { localStorage.setItem("af_pets", JSON.stringify(updated)) } catch {}
          return updated
        })
      }
      reader.readAsDataURL(file)
    })
    setAddingDoc(false)
  }

  function removeDoc(petId, docId) {
    const updated = pets.map(function(p) {
      return p.id === petId ? { ...p, documents: (p.documents || []).filter(function(d) { return d.id !== docId }) } : p
    })
    save(updated)
  }

  function openDoc(doc) {
    // Open in new tab
    const a = document.createElement("a")
    a.href = doc.data
    a.download = doc.name
    a.click()
  }

  function petDaysUntil(dateStr) {
    if (!dateStr) return null
    var now = new Date(); now.setHours(0,0,0,0)
    var parts = dateStr.split("-")
    if (parts.length === 3 && parts[0].length === 4) {
      // Full YYYY-MM-DD: use actual year, no annual wrap
      var d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]))
      return Math.round((d - now) / 86400000)
    }
    var d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return Math.round((d - now) / 86400000)
  }

  const navy = "#243A5A"; const sand = "#c8a97a"; const warm = "#faf8f4"
  const muted = "rgba(250,248,244,0.42)"; const border = "rgba(250,242,229,0.08)"; const cardBg = "rgba(250,242,229,0.04)"
  const inputStyle = { width: "100%", background: "rgba(250,242,229,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: warm, fontFamily: "DM Sans,sans-serif", outline: "none", boxSizing: "border-box" }
  const labelStyle = { fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", marginBottom: 4, display: "block" }

  if (!activePet) return (
    <div>
      <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: warm, marginBottom: 4 }}>Pets</div>
      <div style={{ fontSize: 12, color: muted, fontFamily: "DM Sans,sans-serif", marginBottom: 20 }}>Health records, vaccines, medications and tags — all in one place.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {pets.map(function(pet) {
          const upcoming = (pet.vaccines||[]).filter(function(v) { return v.due && petDaysUntil(v.due) !== null && petDaysUntil(v.due) <= 30 && petDaysUntil(v.due) >= 0 })
          const overdue = (pet.vaccines||[]).filter(function(v) { return v.due && petDaysUntil(v.due) !== null && petDaysUntil(v.due) < 0 })
          return (
            <div key={pet.id} onClick={function() { setActivePetId(pet.id) }} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: cardBg, border: "1px solid " + border, borderRadius: 12, cursor: "pointer" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(200,169,122,0.15)", border: "1.5px solid rgba(200,169,122,0.3)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {pet.photo ? <img src={pet.photo} alt={pet.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 22 }}>{pet.type==="Cat"?"🐱":pet.type==="Bird"?"🐦":pet.type==="Rabbit"?"🐰":"🐾"}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: warm, fontFamily: "DM Sans,sans-serif" }}>{pet.name}</div>
                <div style={{ fontSize: 11, color: muted, fontFamily: "DM Sans,sans-serif" }}>{pet.type}{pet.breed ? " · " + pet.breed : ""}</div>
                {(upcoming.length > 0 || overdue.length > 0) && (
                  <div style={{ marginTop: 4 }}>
                    {overdue.length > 0 && <span style={{ fontSize: 10, background: "rgba(200,80,80,0.15)", color: "#e88", border: "1px solid rgba(200,80,80,0.3)", borderRadius: 20, padding: "1px 8px", fontFamily: "DM Sans,sans-serif", marginRight: 4 }}>⚠ {overdue.length} overdue</span>}
                    {upcoming.length > 0 && <span style={{ fontSize: 10, background: "rgba(200,169,122,0.12)", color: sand, border: "1px solid rgba(200,169,122,0.25)", borderRadius: 20, padding: "1px 8px", fontFamily: "DM Sans,sans-serif" }}>📅 {upcoming.length} due soon</span>}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: "rgba(200,169,122,0.35)" }}>→</div>
            </div>
          )
        })}
      </div>
      {adding ? (
        <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: warm, fontFamily: "DM Sans,sans-serif", marginBottom: 14 }}>New pet</div>
          <label style={labelStyle}>Name *</label>
          <input value={newPetForm.name} onChange={function(e) { setNewPetForm(function(p){return{...p,name:e.target.value}}) }} placeholder="Pet's name" style={{...inputStyle, marginBottom: 10}} />
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Type</label>
              <select value={newPetForm.type} onChange={function(e) { setNewPetForm(function(p){return{...p,type:e.target.value}}) }} style={inputStyle}>
                {PET_TYPES.map(function(t) { return <option key={t} value={t} style={{background:navy}}>{t}</option> })}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Breed</label>
              <input value={newPetForm.breed} onChange={function(e) { setNewPetForm(function(p){return{...p,breed:e.target.value}}) }} placeholder="Optional" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Color / markings</label>
              <input value={newPetForm.color} onChange={function(e) { setNewPetForm(function(p){return{...p,color:e.target.value}}) }} placeholder="e.g. Black & white" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date of birth</label>
              <input type="date" value={newPetForm.dob} onChange={function(e) { setNewPetForm(function(p){return{...p,dob:e.target.value}}) }} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addPet} style={{ flex: 1, background: sand, border: "none", borderRadius: 8, padding: "9px", fontSize: 13, color: navy, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Add pet</button>
            <button onClick={function() { setAdding(false) }} style={{ background: "rgba(250,242,229,0.06)", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: muted, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={function() { setAdding(true) }} style={{ width: "100%", padding: 12, background: "rgba(200,169,122,0.07)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 10, fontSize: 13, color: sand, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 500 }}>+ Add a pet</button>
      )}
    </div>
  )

  // Pet detail view
  const vaccines = activePet.vaccines || []
  const medications = activePet.medications || []
  const tags = activePet.tags || {}

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={function() { setActivePetId(null) }} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 13, fontFamily: "DM Sans,sans-serif", padding: "4px 0" }}>← All pets</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: warm }}>{activePet.name}</div>
          <div style={{ fontSize: 11, color: muted, fontFamily: "DM Sans,sans-serif" }}>{activePet.type}{activePet.breed ? " · " + activePet.breed : ""}{activePet.dob ? " · born " + new Date(activePet.dob).getFullYear() : ""}</div>
        </div>
        <button onClick={function() { save(pets.filter(function(p) { return p.id !== activePetId })); setActivePetId(null) }} style={{ background: "none", border: "none", color: "rgba(200,80,80,0.4)", cursor: "pointer", fontSize: 11, fontFamily: "DM Sans,sans-serif" }}>remove</button>
      </div>

      {/* Photo */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, background: cardBg, border: "1px solid " + border, borderRadius: 12, padding: "12px 14px" }}>
        <div style={{ width: 72, height: 72, borderRadius: 12, background: "rgba(200,169,122,0.12)", border: "1.5px solid rgba(200,169,122,0.25)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {activePet.photo ? <img src={activePet.photo} alt={activePet.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 32 }}>{activePet.type==="Cat"?"🐱":activePet.type==="Bird"?"🐦":activePet.type==="Rabbit"?"🐰":"🐾"}</span>}
        </div>
        <div>
          <div style={{ fontSize: 12, color: muted, fontFamily: "DM Sans,sans-serif", marginBottom: 6 }}>Pet photo</div>
          <label style={{ background: "rgba(200,169,122,0.12)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 7, padding: "5px 12px", fontSize: 11, color: sand, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>
            {activePet.photo ? "Change photo" : "Upload photo"}
            <input type="file" accept="image/*" onChange={function(e) { handlePhoto(e, activePet.id) }} style={{ display: "none" }} />
          </label>
          {activePet.photo && <button onClick={function() { updatePet(activePet.id, { photo: null }) }} style={{ background: "none", border: "none", color: "rgba(200,80,80,0.4)", fontSize: 11, cursor: "pointer", fontFamily: "DM Sans,sans-serif", marginLeft: 8 }}>Remove</button>}
        </div>
      </div>

      {/* ID Tags */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.25)", fontFamily: "DM Sans,sans-serif", marginBottom: 8 }}>🏷 ID & Registration</div>
        <div style={{ background: cardBg, border: "1px solid " + border, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[{key:"rabies",label:"Rabies tag #"},{key:"chip",label:"Microchip #"},{key:"registration",label:"Registration #"}].map(function(f) {
            return (
              <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", marginBottom: 2 }}>{f.label}</div>
                  {editingField === f.key ? (
                    <input value={editVal} onChange={function(e) { setEditVal(e.target.value) }} onKeyDown={function(e) { if (e.key === "Enter") { updatePet(activePet.id, { tags: {...tags, [f.key]: editVal} }); setEditingField(null) } if (e.key === "Escape") setEditingField(null) }} onBlur={function() { updatePet(activePet.id, { tags: {...tags, [f.key]: editVal} }); setEditingField(null) }} autoFocus style={{...inputStyle, padding: "4px 8px", fontSize: 12}} />
                  ) : (
                    <div style={{ fontSize: 13, color: tags[f.key] ? warm : "rgba(250,248,244,0.2)", fontFamily: "DM Sans,sans-serif", fontStyle: tags[f.key] ? "normal" : "italic" }}>{tags[f.key] || "Not set"}</div>
                  )}
                </div>
                {editingField === f.key
                  ? <button onClick={function() { updatePet(activePet.id, { tags: {...tags, [f.key]: editVal} }); setEditingField(null) }} style={{ background: "rgba(122,158,142,0.2)", border: "1px solid rgba(122,158,142,0.4)", borderRadius: 6, padding: "3px 9px", fontSize: 10, color: "#7a9e8e", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>save</button>
                  : <button onClick={function() { setEditingField(f.key); setEditVal(tags[f.key]||"") }} style={{ background: "rgba(200,169,122,0.1)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 6, padding: "3px 9px", fontSize: 10, color: sand, fontFamily: "DM Sans,sans-serif", cursor: "pointer" }}>edit</button>
                }
              </div>
            )
          })}
        </div>
      </div>

      {/* Vaccines */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.25)", fontFamily: "DM Sans,sans-serif" }}>💉 Vaccines</div>
          <button onClick={function() { setAddingVaccine(function(p){return !p}) }} style={{ background: "rgba(200,169,122,0.1)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 7, padding: "3px 10px", fontSize: 11, color: sand, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>+ Add</button>
        </div>
        {addingVaccine && (
          <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.18)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>Vaccine</label>
                <select value={vaccineForm.name} onChange={function(e) { setVaccineForm(function(p){return{...p,name:e.target.value}}) }} style={inputStyle}>
                  {VACCINE_LIST.map(function(v) { return <option key={v} value={v} style={{background:navy}}>{v}</option> })}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Date given</label>
                <input type="date" value={vaccineForm.date} onChange={function(e) { setVaccineForm(function(p){return{...p,date:e.target.value}}) }} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Due date</label>
                <input type="date" value={vaccineForm.due} onChange={function(e) { setVaccineForm(function(p){return{...p,due:e.target.value}}) }} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Vet / clinic</label>
                <input value={vaccineForm.vet} onChange={function(e) { setVaccineForm(function(p){return{...p,vet:e.target.value}}) }} placeholder="Optional" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Notes</label>
                <input value={vaccineForm.notes} onChange={function(e) { setVaccineForm(function(p){return{...p,notes:e.target.value}}) }} placeholder="Optional" style={inputStyle} />
              </div>
            </div>
            {vaccineForm.due && (
              <div onClick={function() { setVaccineForm(function(p){return{...p,addToCalendar:!p.addToCalendar}}) }} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "6px 10px", background: "rgba(126,174,180,0.08)", borderRadius: 8, border: "0.5px solid rgba(126,174,180,0.2)", cursor: "pointer" }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: "1.5px solid rgba(126,174,180,0.5)", background: vaccineForm.addToCalendar ? "rgba(126,174,180,0.4)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#7EAEB4" }}>{vaccineForm.addToCalendar ? "✓" : ""}</div>
                <span style={{ fontSize: 11, color: "rgba(126,174,180,0.9)", fontFamily: "DM Sans,sans-serif" }}>Add due date to calendar</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={function() { addVaccine(activePet.id) }} style={{ flex: 1, background: sand, border: "none", borderRadius: 7, padding: "7px", fontSize: 12, color: navy, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Save</button>
              <button onClick={function() { setAddingVaccine(false) }} style={{ background: "rgba(250,242,229,0.06)", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: muted, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
        {vaccines.length === 0 && !addingVaccine ? (
          <div style={{ fontSize: 12, color: "rgba(250,248,244,0.25)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", padding: "8px 0" }}>No vaccines recorded yet.</div>
        ) : vaccines.map(function(v) {
          const days = petDaysUntil(v.due)
          const overdue = days !== null && days < 0
          const soon = days !== null && days >= 0 && days <= 30
          return (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: overdue ? "rgba(200,80,80,0.07)" : soon ? "rgba(200,169,122,0.07)" : cardBg, border: "1px solid " + (overdue ? "rgba(200,80,80,0.2)" : soon ? "rgba(200,169,122,0.2)" : border), borderRadius: 9, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: warm, fontFamily: "DM Sans,sans-serif" }}>{v.name}</div>
                <div style={{ fontSize: 11, color: muted, fontFamily: "DM Sans,sans-serif" }}>{v.date && "Given: " + v.date}{v.vet && " · " + v.vet}</div>
              </div>
              {v.due && (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: muted, fontFamily: "DM Sans,sans-serif" }}>Due</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: overdue ? "#e88" : soon ? sand : muted, fontFamily: "DM Sans,sans-serif" }}>{overdue ? Math.abs(days) + "d overdue" : days === 0 ? "Today!" : days + "d"}</div>
                </div>
              )}
              <button onClick={function() { updatePet(activePet.id, { vaccines: vaccines.filter(function(x) { return x.id !== v.id }) }) }} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.25, fontSize: 13, color: warm, padding: "2px 4px" }}>✕</button>
            </div>
          )
        })}
      </div>

      {/* Medications */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.25)", fontFamily: "DM Sans,sans-serif" }}>💊 Medications</div>
          <button onClick={function() { setAddingMed(function(p){return !p}) }} style={{ background: "rgba(200,169,122,0.1)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 7, padding: "3px 10px", fontSize: 11, color: sand, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>+ Add</button>
        </div>
        {addingMed && (
          <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.18)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <input value={medForm.name} onChange={function(e) { setMedForm(function(p){return{...p,name:e.target.value}}) }} placeholder="Medication name *" style={{...inputStyle, marginBottom: 8}} />
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={medForm.dose} onChange={function(e) { setMedForm(function(p){return{...p,dose:e.target.value}}) }} placeholder="Dose (e.g. 25mg)" style={{...inputStyle, flex:1}} />
              <input value={medForm.freq} onChange={function(e) { setMedForm(function(p){return{...p,freq:e.target.value}}) }} placeholder="Frequency" style={{...inputStyle, flex:1}} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input type="date" value={medForm.refill} onChange={function(e) { setMedForm(function(p){return{...p,refill:e.target.value}}) }} style={{...inputStyle, flex:1}} />
              <input value={medForm.notes} onChange={function(e) { setMedForm(function(p){return{...p,notes:e.target.value}}) }} placeholder="Notes" style={{...inputStyle, flex:1}} />
            </div>
            <input value={medForm.contact||""} onChange={function(e) { setMedForm(function(p){return{...p,contact:e.target.value}}) }} placeholder="Pharmacy URL or phone (optional)" style={{...inputStyle, marginBottom: 8}} />
            {medForm.refill && (
              <div onClick={function() { setMedForm(function(p){return{...p,addToCalendar:!p.addToCalendar}}) }} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "6px 10px", background: "rgba(200,169,122,0.07)", borderRadius: 8, border: "0.5px solid rgba(200,169,122,0.2)", cursor: "pointer" }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, border: "1.5px solid rgba(200,169,122,0.5)", background: medForm.addToCalendar ? "rgba(200,169,122,0.35)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: sand }}>{medForm.addToCalendar ? "✓" : ""}</div>
                <span style={{ fontSize: 11, color: "rgba(200,169,122,0.85)", fontFamily: "DM Sans,sans-serif" }}>Add refill date to calendar</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={function() { addMed(activePet.id) }} style={{ flex: 1, background: sand, border: "none", borderRadius: 7, padding: "7px", fontSize: 12, color: navy, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Save</button>
              <button onClick={function() { setAddingMed(false) }} style={{ background: "rgba(250,242,229,0.06)", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: muted, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
        {medications.length === 0 && !addingMed ? (
          <div style={{ fontSize: 12, color: "rgba(250,248,244,0.25)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", padding: "8px 0" }}>No medications recorded.</div>
        ) : medications.map(function(m) {
          const refillDays = petDaysUntil(m.refill)
          return (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: cardBg, border: "1px solid " + (refillDays !== null && refillDays <= 7 ? "rgba(200,169,122,0.3)" : border), borderRadius: 9, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: warm, fontFamily: "DM Sans,sans-serif" }}>{m.name}</div>
                <div style={{ fontSize: 11, color: muted, fontFamily: "DM Sans,sans-serif" }}>{m.dose}{m.freq ? " · " + m.freq : ""}{m.notes ? " · " + m.notes : ""}</div>
                {m.contact && (function(){
                  var c=m.contact; var isPhone=/^[\d\s\-\+\(\)]{7,}$/.test(c.trim()); var safe=safeUrl(c);
                  if(safe) return <a href={safe} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#7EAEB4",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:3,marginTop:2}}>🔗 Order</a>;
                  if(isPhone) return <a href={"tel:"+c.replace(/\s/g,"")} style={{fontSize:11,color:"#7EAEB4",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:3,marginTop:2}}>📞 {c}</a>;
                  return <span style={{fontSize:11,color:muted,display:"block",marginTop:2}}>{c}</span>;
                })()}
              </div>
              {m.refill && (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: muted, fontFamily: "DM Sans,sans-serif" }}>Refill</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: refillDays !== null && refillDays <= 7 ? sand : muted, fontFamily: "DM Sans,sans-serif" }}>{refillDays !== null && refillDays <= 0 ? "Now!" : refillDays + "d"}</div>
                </div>
              )}
              <button onClick={function() { updatePet(activePet.id, { medications: medications.filter(function(x) { return x.id !== m.id }) }) }} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.25, fontSize: 13, color: warm, padding: "2px 4px" }}>✕</button>
            </div>
          )
        })}
      </div>

      {/* Documents */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.25)", fontFamily: "DM Sans,sans-serif" }}>📄 Documents</div>
          <label style={{ background: "rgba(200,169,122,0.1)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 7, padding: "3px 10px", fontSize: 11, color: sand, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>
            + Upload
            <input ref={docInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,image/*" onChange={function(e) { handleDoc(e, activePet.id) }} style={{ display: "none" }} />
          </label>
        </div>
        <div style={{ fontSize: 11, color: "rgba(250,248,244,0.25)", fontFamily: "DM Sans,sans-serif", marginBottom: 8 }}>Vaccine records, vet summaries, insurance — any file.</div>
        {(activePet.documents || []).length === 0 ? (
          <label style={{ display: "block", border: "1.5px dashed rgba(200,169,122,0.2)", borderRadius: 10, padding: "20px", textAlign: "center", cursor: "pointer" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📁</div>
            <div style={{ fontSize: 12, color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif" }}>Tap to upload files</div>
            <div style={{ fontSize: 10, color: "rgba(250,248,244,0.18)", fontFamily: "DM Sans,sans-serif", marginTop: 3 }}>PDF, images, Word docs</div>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,image/*" onChange={function(e) { handleDoc(e, activePet.id) }} style={{ display: "none" }} />
          </label>
        ) : (
          <div>
            {(activePet.documents || []).map(function(doc) {
              const isImage = doc.type && doc.type.startsWith("image/")
              const isPdf = doc.type === "application/pdf"
              const icon = isImage ? "🖼️" : isPdf ? "📋" : "📄"
              const kb = doc.size ? Math.round(doc.size / 1024) : null
              return (
                <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: cardBg, border: "1px solid " + border, borderRadius: 10, marginBottom: 6 }}>
                  {isImage ? (
                    <div style={{ width: 40, height: 40, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
                      <img src={doc.data} alt={doc.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 6, background: "rgba(200,169,122,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: warm, fontFamily: "DM Sans,sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                    <div style={{ fontSize: 10, color: muted, fontFamily: "DM Sans,sans-serif" }}>{doc.uploaded}{kb ? " · " + kb + " KB" : ""}</div>
                  </div>
                  <button onClick={function() { openDoc(doc) }} style={{ background: "rgba(200,169,122,0.12)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 6, padding: "4px 10px", fontSize: 10, color: sand, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>Open</button>
                  <button onClick={function() { removeDoc(activePet.id, doc.id) }} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.25, fontSize: 13, color: warm, padding: "2px 4px", flexShrink: 0 }}>✕</button>
                </div>
              )
            })}
            <label style={{ display: "block", width: "100%", padding: "8px", background: "rgba(200,169,122,0.06)", border: "1px dashed rgba(200,169,122,0.2)", borderRadius: 8, fontSize: 11, color: "rgba(200,169,122,0.5)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 500, textAlign: "center", boxSizing: "border-box", marginTop: 4 }}>
              + Add another file
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,image/*" onChange={function(e) { handleDoc(e, activePet.id) }} style={{ display: "none" }} />
            </label>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,248,244,0.25)", fontFamily: "DM Sans,sans-serif", marginBottom: 8 }}>📝 Notes</div>
        <textarea value={activePet.notes || ""} onChange={function(e) { updatePet(activePet.id, { notes: e.target.value }) }} placeholder="Vet info, allergies, special care notes…" rows={3} style={{ width: "100%", background: cardBg, border: "1px solid " + border, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: warm, fontFamily: "DM Sans,sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
      </div>
    </div>
  )
}




// ── Packing Templates Panel (part of Travel Profile) ─────────────────────────
var TRIP_BAGS = ["My Bag","Cosmetics","Kid 1","Kid 2","Kid 3","Diaper Bag","Carry-On","Backpack","Overnight Bag","Extra Bag","Snacks","Extras"]

var DEFAULT_BAG_ITEMS = {
  "My Bag": {
    "Clothing":    ["Pants","Shirts","Dress","Underwear","Bras","Shoes / flip flops / sandals","Pajamas","Bathing suit","Cover-up","Jacket"],
    "Accessories": ["Sunglasses x2","Glasses","Hat","Jewelry"],
    "Toiletries":  ["Shampoo / conditioner","Hair products","Crimper / hair dryer","Clips","Brush","Deo","Toothbrush / toothpaste","Sunscreen","Chapstick","Nail file"],
    "Health":      ["Advil","Arnica / muscle mist","Pads / tampons","Snore thing","Bug / eucalyptus"],
    "Electronics": ["Cell phone charger / battery pack"]
  },
  "Cosmetics": {
    "Face":   ["Foundation / BB cream","Concealer","Blush / bronzer","Setting powder","Setting spray","Mascara","Eyeliner","Eyeshadow palette","Lip color"],
    "Tools":  ["Makeup brushes","Makeup sponge","Eyelash curler","Tweezers"],
    "Skin":   ["Moisturizer","SPF face sunscreen","Eye cream","Micellar water / makeup remover","Face wash","Toner","Serum"],
    "Extras": ["Cotton rounds","Q-tips","Makeup wipes","Mirror"]
  },
  "Kid 1": {
    "Clothing":      ["Pants","Shirts","Underwear","Socks","Shoes / flip flops / crocs","Pajamas","Bathing suit","Jacket"],
    "Comfort":       ["Blanket","Stuffed animal"],
    "Accessories":   ["Sunglasses","Hat","Snorkel / goggles"],
    "Toiletries":    ["Toothbrush / toothpaste","Hair gel","Chapstick"],
    "Entertainment": ["Tablet / computer + charger","Download movies before leaving","Toys","Coloring / learning activities","Airplane tray"]
  },
  "Kid 2": {
    "Clothing":      ["Pants","Shirts","Underwear","Socks","Shoes / flip flops","Pajamas","Bathing suit","Jacket"],
    "Comfort":       ["Blanket","Stuffed animal"],
    "Accessories":   ["Sunglasses","Hat"],
    "Toiletries":    ["Toothbrush / toothpaste","Chapstick","Hair ties / accessories"],
    "Entertainment": ["Tablet + headphones","Toys","Books / activities","Airplane tray"]
  },
  "Kid 3": {
    "Clothing":    ["Outfits","Bathing suit / cover up","Socks / shoes","Pajamas x2","Jacket","Bows / accessories"],
    "Sleep":       ["Sleep sack","Sound machine","Blankets"],
    "Feeding":     ["Burp cloths / bibs","Snacks","Spoon","Tupperware cups"],
    "Accessories": ["Sunglasses","Hat","Stuffed animal","Toys"],
    "Travel":      ["Airplane tray","iPad / extra phone","Car seat","Tush baby","Sling"]
  },
  "Diaper Bag": {
    "Baby essentials": ["Diapers","Wipes","Sanitizing wipes","Disposable table things","Bib","Spoon","Burp cloths","Diaper cream"],
    "Baby extras":     ["Baby table / seat","Baby toys"],
    "Family":          ["Sunglasses x4","Water bottles","Seat belt extender","Tampons","Advil","Hairbrush / ties","Chapstick","Trash bags","Snacks"]
  },
  "Carry-On": {
    "Documents":   ["Passport / ID","Boarding passes","Travel insurance docs","Credit cards","Cash"],
    "Comfort":     ["Neck pillow","Eye mask","Noise-canceling headphones","Blanket / wrap"],
    "Essentials":  ["Empty water bottle","Snacks","Phone charger","AirPods","TSA lock"],
    "Kids":        ["Tablet + headphones","Coloring activities","Airplane tray","Snacks","Small toy"]
  },
  "Backpack": {
    "Daily essentials": ["Water bottle","Snacks","Sunscreen","Chapstick","Phone charger"],
    "Activities":       ["Camera","Notebook","Earbuds"]
  },
  "Overnight Bag": {},
  "Extra Bag": {
    "Beach / outdoor": ["Beach toys","Beach towels","Powder sand","Laundry bags"],
    "Travel gear":     ["Stroller / bag / cup holder","Booster seat / car seat","Airplane bed thing","Tray table covers","Air tags","Luggage straps"],
    "Misc":            ["Spoons","Nightlights","Laundry soap / bags","Cash","Chargers / battery pack / extension cord"]
  }
}

function makeTripBags(extras, bagList) {
  var list = bagList || TRIP_BAGS
  var bags = {}
  list.forEach(function(bag) {
    var baseCats = DEFAULT_BAG_ITEMS[bag] || {}
    var extraCats = (extras && extras[bag]) ? extras[bag] : {}
    var merged = {}
    Object.keys(baseCats).forEach(function(cat) {
      merged[cat] = baseCats[cat].map(function(t){ return {text:t} })
    })
    Object.keys(extraCats).forEach(function(cat) {
      merged[cat] = (merged[cat]||[]).concat(extraCats[cat].map(function(t){ return {text:t} }))
    })
    bags[bag] = merged
  })
  return bags
}

var DEFAULT_PACKING_TEMPLATES = [
  {
    id: "flight", name: "Flight Trip", emoji: "✈️", type: "trip", locked: false,
    bagList: ["My Bag","Cosmetics","Kid 1","Kid 2","Kid 3","Diaper Bag","Carry-On","Backpack","Overnight Bag","Extra Bag","Snacks","Extras"],
    bags: makeTripBags({
      "My Bag": { "Travel docs": ["Passport / ID","Boarding passes","Travel insurance docs","Credit cards","Cash"] },
      "Carry-On": { "Flight extras": ["Neck pillow","Eye mask","Noise-canceling headphones","TSA lock","Empty water bottle"] }
    })
  },
  {
    id: "roadtrip", name: "Road Trip", emoji: "🚗", type: "trip", locked: false,
    bagList: ["My Bag","Cosmetics","Kid 1","Kid 2","Kid 3","Diaper Bag","Backpack","Overnight Bag","Extra Bag","Snacks","Extras"],
    bags: makeTripBags({
      "My Bag": { "Car essentials": ["Driver's license","Car insurance card","Registration","AAA card"] },
      "Extra Bag": { "Car extras": ["Aux cable / Bluetooth","Phone mount","Dash cam","Jumper cables","Emergency kit","Motion sickness meds"] }
    })
  },
  {
    id: "beach", name: "Beach Trip", emoji: "🏖️", type: "trip", locked: false,
    bagList: ["My Bag","Cosmetics","Kid 1","Kid 2","Kid 3","Diaper Bag","Carry-On","Backpack","Overnight Bag","Extra Bag","Snacks","Extras"],
    bags: makeTripBags({
      "My Bag": { "Beach": ["After-sun lotion","Waterproof mascara","Extra hair ties"] },
      "Kid 1": { "Beach": ["Snorkel / goggles","Rashguard","Water shoes"] },
      "Kid 2": { "Beach": ["Rashguard","Water shoes"] },
      "Kid 3": { "Beach": ["Swim diapers (extra)","Rashguard","Baby sunscreen SPF 70","Float / puddle jumper"] },
      "Extra Bag": { "Beach": ["Beach umbrella","Sand-proof blanket","Mesh bag for wet stuff","Portable speaker","Cooler"] }
    })
  },
  {
    id: "camping", name: "Camping Trip", emoji: "🏕️", type: "trip", locked: false,
    bagList: ["My Bag","Cosmetics","Kid 1","Kid 2","Kid 3","Gear Bin","Cooler","Kitchen Box","Backpack","Extra Bag","Snacks","Extras"],
    bags: makeTripBags({
      "Gear Bin": { "Shelter & sleep": ["Tent + stakes","Tarp / footprint","Sleeping bags","Sleeping pads","Pillows","Extra blankets","Camp chairs","Headlamps / flashlights","Lantern","Extra batteries"],
                    "Fire & tools": ["Matches / lighter","Firestarter","Hatchet","Pocket knife","Paracord","Duct tape","Work gloves"] },
      "Cooler": { "Cold food": ["Ice / ice packs","Eggs","Milk","Butter","Meat for grilling","Cheese","Drinks","Condiments"] },
      "Kitchen Box": { "Camp kitchen": ["Camp stove + fuel","Lighter / matches","Pots + pan","Plates / bowls","Cups / mugs","Utensils","Cooking spoon + spatula","Sharp knife","Cutting board","Dish soap + sponge","Dish towels","Trash bags","Paper towels","Foil","Coffee + maker","Water jugs"] },
      "My Bag": { "Camp extras": ["Bug spray","Sunscreen","First-aid kit","Camp soap","Quick-dry towel","Hand sanitizer","Wet wipes"] },
      "Kid 1": { "Camp": ["Warm layers","Rain jacket","Closed-toe shoes","Flashlight","Water bottle"] },
      "Kid 2": { "Camp": ["Warm layers","Rain jacket","Closed-toe shoes","Flashlight","Water bottle"] },
      "Kid 3": { "Camp": ["Warm layers","Rain jacket","Extra socks","Comfort item","Water bottle"] },
      "Extra Bag": { "Outdoor": ["Camp games","Cards","Marshmallow sticks","Outdoor blanket","Frisbee / ball","Field guide / binoculars"] }
    })
  },
  {
    id: "pretodo", name: "Pre-Trip To-Do", emoji: "✅", type: "custom", locked: false,
    items: {
      "Before leaving": ["Download music / games / videos","Label luggage","Charge everything — battery pack","Back up phones","Turn on tracking","Cash"].map(function(t){return{text:t}}),
      "Admin":          ["Taxes","Moving reimbursement"].map(function(t){return{text:t}})
    }
  }
]

var PACK_CATS = ["Clothing","Accessories","Toiletries","Health","Electronics","Entertainment","Comfort","Sleep","Feeding","Travel","Baby essentials","Baby extras","Beach / outdoor","Travel gear","Adult","Older kids","Baby","Family","Shared","Face","Tools","Skin","Extras","Car essentials","Car extras","Beach","Flight extras","Travel docs","Documents","Daily essentials","Activities","Before leaving","Admin","Kids stuff","Misc","Kids"]

// ── Expanded Packing Modal ────────────────────────────────────────────────────
function ExpandedPackingModal(props) {
  var t = props.template; var templates = props.templates; var saveTemplates = props.saveTemplates
  var saveBagCat = props.saveBagCat; var saveCat = props.saveCat; var printTemplate = props.printTemplate; var onClose = props.onClose
  var warm = props.warm; var sand = props.sand; var navy = props.navy; var muted = props.muted; var border = props.border; var coastal = props.coastal

  var collapsedPair = useState({}); var collapsed = collapsedPair[0]; var setCollapsed = collapsedPair[1]
  var editingPair = useState(null); var editing = editingPair[0]; var setEditing = editingPair[1]
  var editValPair = useState(""); var editVal = editValPair[0]; var setEditVal = editValPair[1]
  var addingPair = useState(null); var adding = addingPair[0]; var setAdding = addingPair[1]
  var addValPair = useState(""); var addVal = addValPair[0]; var setAddVal = addValPair[1]
  var addingCatPair = useState(null); var addingCat = addingCatPair[0]; var setAddingCat = addingCatPair[1]
  var addCatValPair = useState(""); var addCatVal = addCatValPair[0]; var setAddCatVal = addCatValPair[1]
  var editingCatPair = useState(null); var editingCat = editingCatPair[0]; var setEditingCat = editingCatPair[1]
  var editCatValPair = useState(""); var editCatVal = editCatValPair[0]; var setEditCatVal = editCatValPair[1]
  // template name editing
  var editingNamePair = useState(false); var editingName = editingNamePair[0]; var setEditingName = editingNamePair[1]
  var editNameValPair = useState(""); var editNameVal = editNameValPair[0]; var setEditNameVal = editNameValPair[1]
  // bag management panel
  var showBagMgrPair = useState(false); var showBagMgr = showBagMgrPair[0]; var setShowBagMgr = showBagMgrPair[1]
  var newBagNamePair = useState(""); var newBagName = newBagNamePair[0]; var setNewBagName = newBagNamePair[1]
  var editingBagPair = useState(null); var editingBag = editingBagPair[0]; var setEditingBag = editingBagPair[1]
  var editBagValPair = useState(""); var editBagVal = editBagValPair[0]; var setEditBagVal = editBagValPair[1]
  // packed section collapse
  var packedCollapsedPair = useState(true); var packedCollapsed = packedCollapsedPair[0]; var setPackedCollapsed = packedCollapsedPair[1]

  var inputSt = { background:"rgba(250,242,229,0.08)", border:"1px solid rgba(200,169,122,0.3)", borderRadius:7, padding:"7px 11px", fontSize:13, color:warm, fontFamily:"DM Sans,sans-serif", outline:"none", flex:1 }

  function getBagList() {
    if (t.type !== "trip") return []
    return t.bagList || TRIP_BAGS
  }

  function toggleCollapse(key) {
    setCollapsed(function(prev){ var n=Object.assign({},prev); n[key]=!n[key]; return n })
  }

  function getBagsForModal() {
    if (t.type === "trip") {
      var list = getBagList()
      return list.filter(function(b){ return (t.bags||{})[b] !== undefined })
    }
    return ["__custom__"]
  }

  function getCatsForBag(bag) {
    if (t.type === "trip") return Object.keys((t.bags||{})[bag]||{})
    return Object.keys(t.items||{})
  }

  function getItemsForBagCat(bag, cat) {
    if (t.type === "trip") return (((t.bags||{})[bag])||{})[cat] || []
    return (t.items||{})[cat] || []
  }

  function toggleItem(bag, cat, idx) {
    var items = getItemsForBagCat(bag, cat)
    var updated = items.map(function(x,i){ return i===idx ? Object.assign({},x,{done:!x.done}) : x })
    if (t.type === "trip") saveBagCat(t.id, bag, cat, updated)
    else saveCat(t.id, cat, updated)
  }

  function deleteItem(bag, cat, idx) {
    var items = getItemsForBagCat(bag, cat).filter(function(_,i){ return i!==idx })
    if (t.type === "trip") saveBagCat(t.id, bag, cat, items)
    else saveCat(t.id, cat, items)
  }

  function saveEditItem(bag, cat, idx) {
    if (!editVal.trim()) return
    var items = getItemsForBagCat(bag, cat).map(function(x,i){ return i===idx ? Object.assign({},x,{text:editVal.trim()}) : x })
    if (t.type === "trip") saveBagCat(t.id, bag, cat, items)
    else saveCat(t.id, cat, items)
    setEditing(null); setEditVal("")
  }

  function saveAddItem(bag, cat) {
    if (!addVal.trim()) return
    var items = getItemsForBagCat(bag, cat).concat([{text:addVal.trim()}])
    if (t.type === "trip") saveBagCat(t.id, bag, cat, items)
    else saveCat(t.id, cat, items)
    setAddVal("")
  }

  function saveAddCat(bag) {
    if (!addCatVal.trim()) return
    if (t.type === "trip") saveBagCat(t.id, bag, addCatVal.trim(), [])
    else saveCat(t.id, addCatVal.trim(), [])
    setAddingCat(null); setAddCatVal("")
  }

  function renameCategory(bag, oldCat, newName) {
    if (!newName.trim() || newName.trim() === oldCat) { setEditingCat(null); setEditCatVal(""); return }
    var name = newName.trim()
    if (t.type === "trip") {
      var nb = JSON.parse(JSON.stringify(t.bags||{}))
      if (nb[bag] && nb[bag][oldCat] !== undefined) {
        var entries = Object.entries(nb[bag])
        var rebuilt = {}
        entries.forEach(function(pair){ rebuilt[pair[0]===oldCat ? name : pair[0]] = pair[1] })
        nb[bag] = rebuilt
      }
      saveTemplates(templates.map(function(tmpl){ return tmpl.id===t.id ? Object.assign({},tmpl,{bags:nb}) : tmpl }))
    } else {
      var ni = JSON.parse(JSON.stringify(t.items||{}))
      var entries2 = Object.entries(ni)
      var rebuilt2 = {}
      entries2.forEach(function(pair){ rebuilt2[pair[0]===oldCat ? name : pair[0]] = pair[1] })
      saveTemplates(templates.map(function(tmpl){ return tmpl.id===t.id ? Object.assign({},tmpl,{items:rebuilt2}) : tmpl }))
    }
    setEditingCat(null); setEditCatVal("")
  }

  function deleteCategory(bag, cat) {
    if (!window.confirm("Delete category \"" + cat + "\" and all its items?")) return
    if (t.type === "trip") {
      var newBags = JSON.parse(JSON.stringify(t.bags||{}))
      if (newBags[bag]) delete newBags[bag][cat]
      saveTemplates(templates.map(function(tmpl){ return tmpl.id===t.id ? Object.assign({},tmpl,{bags:newBags}) : tmpl }))
    } else {
      var newItems = JSON.parse(JSON.stringify(t.items||{}))
      delete newItems[cat]
      saveTemplates(templates.map(function(tmpl){ return tmpl.id===t.id ? Object.assign({},tmpl,{items:newItems}) : tmpl }))
    }
  }

  function uncheckAll() {
    var updated = templates.map(function(tmpl) {
      if (tmpl.id !== t.id) return tmpl
      if (tmpl.type === "trip") {
        var nb = JSON.parse(JSON.stringify(tmpl.bags||{}))
        var bl = tmpl.bagList || TRIP_BAGS
        bl.forEach(function(bag){ if(nb[bag]) Object.keys(nb[bag]).forEach(function(cat){ nb[bag][cat]=(nb[bag][cat]||[]).map(function(x){ return Object.assign({},x,{done:false}) }) }) })
        return Object.assign({},tmpl,{bags:nb})
      } else {
        var ni = JSON.parse(JSON.stringify(tmpl.items||{}))
        Object.keys(ni).forEach(function(cat){ ni[cat]=(ni[cat]||[]).map(function(x){ return Object.assign({},x,{done:false}) }) })
        return Object.assign({},tmpl,{items:ni})
      }
    })
    saveTemplates(updated)
  }

  // ── Move item to a different bag ──────────────────────────────────────────
  function moveItemToBag(fromBag, cat, idx, toBag) {
    if (fromBag === toBag) return
    var item = getItemsForBagCat(fromBag, cat)[idx]
    if (!item) return
    // remove from source
    var srcItems = getItemsForBagCat(fromBag, cat).filter(function(_,i){ return i!==idx })
    // add to dest bag, same category name if it exists, else create it
    var destItems = getItemsForBagCat(toBag, cat).concat([Object.assign({},item,{done:false})])
    var nb = JSON.parse(JSON.stringify(t.bags||{}))
    if (!nb[fromBag]) nb[fromBag] = {}
    nb[fromBag][cat] = srcItems
    if (!nb[toBag]) nb[toBag] = {}
    nb[toBag][cat] = destItems
    saveTemplates(templates.map(function(tmpl){ return tmpl.id===t.id ? Object.assign({},tmpl,{bags:nb}) : tmpl }))
  }

  // ── Rename template ───────────────────────────────────────────────────────
  function saveTemplateName() {
    if (!editNameVal.trim()) { setEditingName(false); return }
    saveTemplates(templates.map(function(tmpl){ return tmpl.id===t.id ? Object.assign({},tmpl,{name:editNameVal.trim()}) : tmpl }))
    setEditingName(false)
  }

  // ── Bag management ────────────────────────────────────────────────────────
  function addBag() {
    if (!newBagName.trim()) return
    var name = newBagName.trim()
    var nb = JSON.parse(JSON.stringify(t.bags||{}))
    nb[name] = {}
    var newList = (t.bagList || TRIP_BAGS.slice()).concat([name])
    saveTemplates(templates.map(function(tmpl){ return tmpl.id===t.id ? Object.assign({},tmpl,{bags:nb,bagList:newList}) : tmpl }))
    setNewBagName("")
  }

  function renameBag(oldName, newName) {
    if (!newName.trim() || newName.trim() === oldName) { setEditingBag(null); setEditBagVal(""); return }
    var name = newName.trim()
    var nb = JSON.parse(JSON.stringify(t.bags||{}))
    var entries = Object.entries(nb)
    var rebuilt = {}
    entries.forEach(function(pair){ rebuilt[pair[0]===oldName ? name : pair[0]] = pair[1] })
    var oldList = t.bagList || TRIP_BAGS.slice()
    var newList = oldList.map(function(b){ return b===oldName ? name : b })
    saveTemplates(templates.map(function(tmpl){ return tmpl.id===t.id ? Object.assign({},tmpl,{bags:rebuilt,bagList:newList}) : tmpl }))
    setEditingBag(null); setEditBagVal("")
  }

  function deleteBag(bag) {
    if (!window.confirm("Remove bag \"" + bag + "\" and all its items?")) return
    var nb = JSON.parse(JSON.stringify(t.bags||{}))
    delete nb[bag]
    var newList = (t.bagList || TRIP_BAGS.slice()).filter(function(b){ return b!==bag })
    saveTemplates(templates.map(function(tmpl){ return tmpl.id===t.id ? Object.assign({},tmpl,{bags:nb,bagList:newList}) : tmpl }))
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  var doneCount = 0; var totalCount = 0
  getBagsForModal().forEach(function(bag) {
    getCatsForBag(bag).forEach(function(cat) {
      var items = getItemsForBagCat(bag, cat)
      totalCount += items.length
      doneCount += items.filter(function(i){ return i.done }).length
    })
  })
  var pct = totalCount > 0 ? Math.round((doneCount/totalCount)*100) : 0

  var allBagsForMove = getBagsForModal()

  return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"#0d1624", zIndex:9999, overflowY:"auto" }}>

      {/* ── Sticky header ── */}
      <div style={{ position:"sticky", top:0, background:"rgba(13,22,36,0.97)", backdropFilter:"blur(8px)", borderBottom:"1px solid rgba(250,242,229,0.08)", padding:"13px 18px", display:"flex", alignItems:"center", gap:10, zIndex:10 }}>
        <span style={{ fontSize:22 }}>{t.emoji||"🧳"}</span>
        <div style={{ flex:1, minWidth:0 }}>
          {editingName ? (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <input value={editNameVal} onChange={function(e){setEditNameVal(e.target.value)}} onKeyDown={function(e){ if(e.key==="Enter") saveTemplateName(); if(e.key==="Escape") setEditingName(false) }} style={{ background:"rgba(250,242,229,0.1)", border:"1px solid rgba(200,169,122,0.4)", borderRadius:6, padding:"4px 9px", fontSize:15, fontWeight:700, color:warm, fontFamily:"DM Sans,sans-serif", outline:"none", minWidth:180 }} autoFocus/>
              <button onClick={saveTemplateName} style={{ background:coastal, border:"none", borderRadius:6, padding:"4px 10px", fontSize:12, color:"#fff", cursor:"pointer", fontWeight:600 }}>Save</button>
              <button onClick={function(){ setEditingName(false) }} style={{ background:"none", border:"none", color:muted, cursor:"pointer", fontSize:12 }}>✕</button>
            </div>
          ) : (
            <div onClick={function(){ setEditingName(true); setEditNameVal(t.name) }} style={{ fontSize:16, fontWeight:700, color:warm, fontFamily:"DM Sans,sans-serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", cursor:"text", display:"flex", alignItems:"center", gap:6 }}>
              {t.name}
              <span style={{ fontSize:11, color:muted, fontWeight:400 }}>✎</span>
            </div>
          )}
          <div style={{ fontSize:11, color:muted, fontFamily:"DM Sans,sans-serif" }}>{doneCount}/{totalCount} packed &nbsp;•&nbsp; {pct}%</div>
        </div>
        {t.type==="trip" && (
          <button onClick={function(){ setShowBagMgr(function(v){ return !v }) }} style={{ background:showBagMgr?"rgba(200,169,122,0.2)":"rgba(250,242,229,0.06)", border:"1px solid rgba(200,169,122,0.25)", borderRadius:8, padding:"7px 11px", fontSize:12, color:sand, fontFamily:"DM Sans,sans-serif", cursor:"pointer", flexShrink:0 }}>🎒 Bags</button>
        )}
        <button onClick={function(){ printTemplate(t) }} style={{ background:"rgba(200,169,122,0.12)", border:"1px solid rgba(200,169,122,0.25)", borderRadius:8, padding:"7px 12px", fontSize:12, color:sand, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, flexShrink:0 }}>🖨 Print</button>
        <button onClick={onClose} style={{ background:"rgba(250,242,229,0.06)", border:"1px solid rgba(250,242,229,0.1)", borderRadius:8, padding:"7px 12px", fontSize:12, color:warm, fontFamily:"DM Sans,sans-serif", cursor:"pointer", flexShrink:0 }}>✕ Close</button>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ height:4, background:"rgba(250,242,229,0.06)" }}>
        <div style={{ height:4, width:pct+"%", background:"linear-gradient(90deg,#5dcaa5,"+coastal+")", transition:"width 0.35s" }}/>
      </div>

      {/* ── Bag manager panel ── */}
      {showBagMgr && t.type==="trip" && (
        <div style={{ background:"rgba(200,169,122,0.06)", borderBottom:"1px solid rgba(200,169,122,0.15)", padding:"14px 18px", maxWidth:780, margin:"0 auto" }}>
          <div style={{ fontSize:12, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:sand, fontFamily:"DM Sans,sans-serif", marginBottom:10 }}>Manage Bags</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
            {getBagList().map(function(bag) {
              var inTemplate = (t.bags||{})[bag] !== undefined
              return (
                <div key={bag} style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(250,242,229,0.04)", border:"1px solid rgba(250,242,229,0.1)", borderRadius:8, padding:"4px 8px" }}>
                  {editingBag===bag ? (
                    <>
                      <input value={editBagVal} onChange={function(e){setEditBagVal(e.target.value)}} onKeyDown={function(e){ if(e.key==="Enter") renameBag(bag,editBagVal); if(e.key==="Escape"){setEditingBag(null);setEditBagVal("")} }} style={{ width:90, background:"rgba(250,242,229,0.1)", border:"1px solid rgba(200,169,122,0.4)", borderRadius:5, padding:"3px 6px", fontSize:12, color:warm, fontFamily:"DM Sans,sans-serif", outline:"none" }} autoFocus/>
                      <button onClick={function(){ renameBag(bag,editBagVal) }} style={{ background:coastal, border:"none", borderRadius:4, padding:"2px 7px", fontSize:11, color:"#fff", cursor:"pointer" }}>Save</button>
                      <button onClick={function(){setEditingBag(null);setEditBagVal("")}} style={{ background:"none", border:"none", color:muted, cursor:"pointer", fontSize:11 }}>✕</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize:12, color:inTemplate?warm:muted, fontFamily:"DM Sans,sans-serif" }}>{bag}</span>
                      <button onClick={function(){ setEditingBag(bag); setEditBagVal(bag) }} style={{ background:"none", border:"none", color:"rgba(200,169,122,0.4)", cursor:"pointer", fontSize:11, padding:"0 2px" }} title="Rename">✎</button>
                      {!TRIP_BAGS.includes(bag) && (
                        <button onClick={function(){ deleteBag(bag) }} style={{ background:"none", border:"none", color:"rgba(220,80,80,0.35)", cursor:"pointer", fontSize:12, padding:"0 2px" }} title="Remove bag">×</button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <input value={newBagName} onChange={function(e){setNewBagName(e.target.value)}} onKeyDown={function(e){ if(e.key==="Enter") addBag() }} placeholder="New bag name…" style={{ flex:1, background:"rgba(250,242,229,0.07)", border:"1px solid rgba(200,169,122,0.25)", borderRadius:7, padding:"6px 10px", fontSize:12, color:warm, fontFamily:"DM Sans,sans-serif", outline:"none" }}/>
            <button onClick={addBag} style={{ background:sand, border:"none", borderRadius:7, padding:"6px 14px", fontSize:12, color:navy, cursor:"pointer", fontWeight:700 }}>+ Add Bag</button>
          </div>
        </div>
      )}

      {/* ── Bag sections ── */}
      <div style={{ padding:"16px 16px 60px", maxWidth:780, margin:"0 auto" }}>
        {getBagsForModal().map(function(bag) {
          var cats = getCatsForBag(bag)
          var bagKey = "bag-"+bag
          var bagCollapsed = collapsed[bagKey]
          var bagUnpacked = []; var bagPacked = []
          cats.forEach(function(cat){
            var items = getItemsForBagCat(bag,cat)
            items.forEach(function(item, idx){
              if (item.done) bagPacked.push({cat:cat, item:item, idx:idx})
              else bagUnpacked.push({cat:cat, item:item, idx:idx})
            })
          })
          var bagTotal = bagUnpacked.length + bagPacked.length
          var bagDone = bagPacked.length
          return (
            <div key={bag} style={{ marginBottom:14, background:"rgba(250,242,229,0.025)", border:"1px solid rgba(250,242,229,0.07)", borderRadius:12, overflow:"hidden" }}>

              {/* Bag header */}
              <div onClick={function(){ toggleCollapse(bagKey) }} style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", cursor:"pointer", userSelect:"none" }}>
                <span style={{ fontSize:13, color:muted, transition:"transform 0.2s", display:"inline-block", transform:bagCollapsed?"rotate(-90deg)":"rotate(0deg)" }}>▾</span>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:t.type==="trip"?coastal:sand, fontFamily:"DM Sans,sans-serif" }}>{t.type==="trip"?bag:"Categories"}</span>
                  <span style={{ fontSize:11, color:muted, fontFamily:"DM Sans,sans-serif", marginLeft:8 }}>{bagDone}/{bagTotal}</span>
                </div>
                {bagDone > 0 && bagDone === bagTotal && (
                  <span style={{ fontSize:11, color:"#5dcaa5", fontFamily:"DM Sans,sans-serif", fontWeight:700 }}>✓ Done!</span>
                )}
              </div>

              {/* Categories inside bag */}
              {!bagCollapsed && (
                <div style={{ padding:"0 12px 12px" }}>
                  {cats.map(function(cat) {
                    var catKey = bag+"-"+cat
                    var catCollapsed = collapsed[catKey]
                    var items = getItemsForBagCat(bag, cat)
                    var unpacked = items.filter(function(i){ return !i.done })
                    var packed = items.filter(function(i){ return i.done })
                    var catDone = packed.length
                    return (
                      <div key={cat} style={{ marginBottom:10, background:"rgba(250,242,229,0.03)", border:"1px solid rgba(250,242,229,0.06)", borderRadius:9 }}>

                        {/* Category header */}
                        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", cursor:"pointer" }} onClick={function(){ if(!editingCat) toggleCollapse(catKey) }}>
                          <span style={{ fontSize:11, color:muted, display:"inline-block", transform:catCollapsed?"rotate(-90deg)":"rotate(0deg)", transition:"transform 0.2s" }}>▾</span>
                          {editingCat && editingCat.bag===bag && editingCat.cat===cat ? (
                            <input value={editCatVal} onChange={function(e){setEditCatVal(e.target.value)}} onKeyDown={function(e){ if(e.key==="Enter") renameCategory(bag,cat,editCatVal); if(e.key==="Escape"){setEditingCat(null);setEditCatVal("")} }} onClick={function(e){e.stopPropagation()}} style={{ flex:1, background:"rgba(250,242,229,0.08)", border:"1px solid rgba(200,169,122,0.4)", borderRadius:6, padding:"4px 8px", fontSize:12, fontWeight:700, color:sand, fontFamily:"DM Sans,sans-serif", outline:"none", letterSpacing:"0.07em", textTransform:"uppercase" }} autoFocus/>
                          ) : (
                            <span onClick={function(e){ e.stopPropagation(); setEditingCat({bag:bag,cat:cat}); setEditCatVal(cat); setCollapsed(function(prev){ var n=Object.assign({},prev); n[catKey]=false; return n }) }} style={{ flex:1, fontSize:12, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:sand, fontFamily:"DM Sans,sans-serif", cursor:"text" }} title="Tap to rename">{cat}</span>
                          )}
                          <span style={{ fontSize:11, color:muted, fontFamily:"DM Sans,sans-serif" }}>{catDone}/{items.length}</span>
                          <button onClick={function(e){ e.stopPropagation(); setAdding(catCollapsed?null:{bag:bag,cat:cat}); setCollapsed(function(prev){ var n=Object.assign({},prev); n[catKey]=false; return n }) }} style={{ background:"rgba(200,169,122,0.1)", border:"none", borderRadius:5, padding:"3px 8px", fontSize:11, color:sand, fontFamily:"DM Sans,sans-serif", cursor:"pointer" }} title="Add item">+ Add</button>
                          {editingCat && editingCat.bag===bag && editingCat.cat===cat ? (
                            <button onClick={function(e){ e.stopPropagation(); renameCategory(bag,cat,editCatVal) }} style={{ background:coastal, border:"none", borderRadius:5, padding:"3px 8px", fontSize:11, color:"#fff", cursor:"pointer" }}>Save</button>
                          ) : (
                            <button onClick={function(e){ e.stopPropagation(); deleteCategory(bag, cat) }} style={{ background:"none", border:"none", color:"rgba(220,80,80,0.3)", cursor:"pointer", fontSize:13, padding:"0 2px" }} title="Delete category">✕</button>
                          )}
                        </div>

                        {/* Unpacked items */}
                        {!catCollapsed && (
                          <div style={{ padding:"0 10px 10px" }}>
                            {unpacked.map(function(item) {
                              var i = items.indexOf(item)
                              var isEditing = editing && editing.bag===bag && editing.cat===cat && editing.idx===i
                              return (
                                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:7, background:"transparent", border:"1px solid rgba(250,242,229,0.05)", marginBottom:3 }}>
                                  {/* Checkbox */}
                                  <div onClick={function(){ if(!isEditing) toggleItem(bag, cat, i) }} style={{ width:20, height:20, borderRadius:4, border:"1.5px solid rgba(250,248,244,0.22)", background:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer" }}/>
                                  {/* Text or edit input */}
                                  {isEditing ? (
                                    <input value={editVal} onChange={function(e){setEditVal(e.target.value)}} onKeyDown={function(e){ if(e.key==="Enter") saveEditItem(bag,cat,i); if(e.key==="Escape"){setEditing(null);setEditVal("")} }} style={Object.assign({},inputSt,{fontSize:13,padding:"4px 8px"})} autoFocus/>
                                  ) : (
                                    <span onClick={function(){ setEditing({bag:bag,cat:cat,idx:i}); setEditVal(item.text) }} style={{ flex:1, fontSize:14, color:warm, fontFamily:"DM Sans,sans-serif", cursor:"text" }}>{item.text}</span>
                                  )}
                                  {/* Bag assignment pill — only for trip templates */}
                                  {t.type==="trip" && !isEditing && allBagsForMove.length > 1 && (
                                    <select
                                      value={bag}
                                      onChange={function(e){ moveItemToBag(bag, cat, i, e.target.value) }}
                                      onClick={function(e){ e.stopPropagation() }}
                                      style={{ background:"rgba(107,163,196,0.1)", border:"1px solid rgba(107,163,196,0.25)", borderRadius:6, padding:"3px 6px", fontSize:11, color:coastal, fontFamily:"DM Sans,sans-serif", cursor:"pointer", outline:"none", maxWidth:90, overflow:"hidden", textOverflow:"ellipsis" }}
                                      title="Move to bag"
                                    >
                                      {allBagsForMove.map(function(b){ return <option key={b} value={b} style={{ background:"#243A5A", color:warm }}>{b}</option> })}
                                    </select>
                                  )}
                                  {/* Edit save / delete */}
                                  {isEditing ? (
                                    <button onClick={function(){ saveEditItem(bag,cat,i) }} style={{ background:coastal, border:"none", borderRadius:5, padding:"3px 8px", fontSize:11, color:"#fff", cursor:"pointer" }}>Save</button>
                                  ) : (
                                    <button onClick={function(){ deleteItem(bag, cat, i) }} style={{ background:"none", border:"none", color:"rgba(250,248,244,0.15)", cursor:"pointer", fontSize:15, padding:"0 3px", lineHeight:1 }}>×</button>
                                  )}
                                </div>
                              )
                            })}

                            {/* ── Already Packed section ── */}
                            {packed.length > 0 && (
                              <div style={{ marginTop:6 }}>
                                <div onClick={function(){ setPackedCollapsed(function(v){ return !v }) }} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 8px", cursor:"pointer", userSelect:"none", borderRadius:6, background:"rgba(93,202,165,0.04)", border:"1px solid rgba(93,202,165,0.1)" }}>
                                  <span style={{ fontSize:10, color:"rgba(93,202,165,0.6)", display:"inline-block", transform:packedCollapsed?"rotate(-90deg)":"rotate(0deg)", transition:"transform 0.2s" }}>▾</span>
                                  <span style={{ fontSize:11, color:"rgba(93,202,165,0.7)", fontFamily:"DM Sans,sans-serif", fontWeight:600, letterSpacing:"0.06em" }}>✓ Already packed ({packed.length})</span>
                                </div>
                                {!packedCollapsed && packed.map(function(item) {
                                  var i = items.indexOf(item)
                                  return (
                                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", borderRadius:7, background:"rgba(93,202,165,0.05)", border:"1px solid rgba(93,202,165,0.1)", marginTop:2 }}>
                                      <div onClick={function(){ toggleItem(bag, cat, i) }} style={{ width:20, height:20, borderRadius:4, border:"1.5px solid #5dcaa5", background:"rgba(29,158,117,0.25)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer" }}>
                                        <span style={{ fontSize:12, color:"#5dcaa5", fontWeight:800, lineHeight:1 }}>✓</span>
                                      </div>
                                      <span style={{ flex:1, fontSize:13, color:"rgba(250,248,244,0.25)", fontFamily:"DM Sans,sans-serif", textDecoration:"line-through" }}>{item.text}</span>
                                      <button onClick={function(){ deleteItem(bag, cat, i) }} style={{ background:"none", border:"none", color:"rgba(250,248,244,0.1)", cursor:"pointer", fontSize:15, padding:"0 3px", lineHeight:1 }}>×</button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}

                            {/* Add item row */}
                            {adding && adding.bag===bag && adding.cat===cat ? (
                              <div style={{ display:"flex", gap:6, marginTop:6 }}>
                                <input value={addVal} onChange={function(e){setAddVal(e.target.value)}} onKeyDown={function(e){ if(e.key==="Enter"){saveAddItem(bag,cat);} if(e.key==="Escape"){setAdding(null);setAddVal("")} }} placeholder={"Add item to "+cat+"…"} style={inputSt} autoFocus/>
                                <button onClick={function(){ saveAddItem(bag,cat) }} style={{ background:coastal, border:"none", borderRadius:7, padding:"7px 12px", fontSize:12, color:"#fff", cursor:"pointer", fontWeight:600 }}>Add</button>
                                <button onClick={function(){ setAdding(null); setAddVal("") }} style={{ background:"rgba(250,242,229,0.05)", border:"none", borderRadius:7, padding:"7px 10px", fontSize:12, color:muted, cursor:"pointer" }}>✕</button>
                              </div>
                            ) : (
                              <button onClick={function(){ setAdding({bag:bag,cat:cat}); setAddVal("") }} style={{ marginTop:6, background:"none", border:"1px dashed rgba(200,169,122,0.15)", borderRadius:6, padding:"5px 10px", fontSize:11, color:"rgba(200,169,122,0.4)", fontFamily:"DM Sans,sans-serif", cursor:"pointer", width:"100%" }}>+ add item</button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Add category row */}
                  {addingCat === bag ? (
                    <div style={{ display:"flex", gap:6, marginTop:6 }}>
                      <input value={addCatVal} onChange={function(e){setAddCatVal(e.target.value)}} onKeyDown={function(e){ if(e.key==="Enter") saveAddCat(bag); if(e.key==="Escape"){setAddingCat(null);setAddCatVal("")} }} placeholder="New category name…" style={inputSt} autoFocus/>
                      <button onClick={function(){ saveAddCat(bag) }} style={{ background:sand, border:"none", borderRadius:7, padding:"7px 12px", fontSize:12, color:navy, cursor:"pointer", fontWeight:700 }}>Add</button>
                      <button onClick={function(){setAddingCat(null);setAddCatVal("")}} style={{ background:"rgba(250,242,229,0.05)", border:"none", borderRadius:7, padding:"7px 10px", fontSize:12, color:muted, cursor:"pointer" }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={function(){ setAddingCat(bag) }} style={{ marginTop:4, width:"100%", background:"rgba(200,169,122,0.04)", border:"1px dashed rgba(200,169,122,0.15)", borderRadius:8, padding:"7px", fontSize:11, color:"rgba(200,169,122,0.4)", fontFamily:"DM Sans,sans-serif", cursor:"pointer" }}>+ add category</button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {doneCount > 0 && (
          <div style={{ textAlign:"center", marginTop:20 }}>
            <button onClick={uncheckAll} style={{ background:"rgba(250,242,229,0.05)", border:"1px solid rgba(250,242,229,0.1)", borderRadius:10, padding:"10px 24px", fontSize:13, color:muted, fontFamily:"DM Sans,sans-serif", cursor:"pointer" }}>Uncheck all items</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Travel Profile Section ────────────────────────────────────────────────────
// Reusable masked field — same interaction shape as a password input: dots by
// default, tap the eye icon to reveal. Used for passport numbers, KTN, loyalty
// numbers, lock codes — anything sensitive enough to hide from a shoulder-surf
// but not sensitive enough to need a PIN gate. Expiry dates are never masked.
function MaskedField(props) {
  var pair = useState(false); var revealed = pair[0]; var setRevealed = pair[1]
  return (
    <div>
      {props.label && <label style={props.labelStyle}>{props.label}</label>}
      <div style={{ position:"relative" }}>
        <input
          type={revealed ? "text" : "password"}
          value={props.value || ""}
          onChange={props.onChange}
          placeholder={props.placeholder || ""}
          style={Object.assign({}, props.inputStyle, { paddingRight:34 })}
        />
        <button
          type="button"
          onClick={function() { setRevealed(function(r){ return !r }) }}
          aria-label={(revealed ? "Hide " : "Reveal ") + (props.label || "field")}
          style={{ position:"absolute", right:2, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:14, color:props.muted || "rgba(250,248,244,0.35)", padding:6, lineHeight:1 }}
        >{revealed ? "🙈" : "👁"}</button>
      </div>
    </div>
  )
}

function TravelProfileSection() {
  var warm = "#faf8f4"; var sand = "#c8a97a"; var navy = "#243A5A"
  var muted = "rgba(250,248,244,0.42)"; var border = "rgba(250,242,229,0.08)"; var cardBg = "rgba(250,242,229,0.04)"
  var coastal = "#7EAEB4"
  var inputStyle = { width:"100%", background:"rgba(250,242,229,0.06)", border:"1px solid rgba(200,169,122,0.25)", borderRadius:8, padding:"8px 12px", fontSize:13, color:warm, fontFamily:"DM Sans,sans-serif", outline:"none", boxSizing:"border-box" }
  var labelStyle = { fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(250,248,244,0.3)", fontFamily:"DM Sans,sans-serif", marginBottom:4, display:"block" }

  var pair = useState(function() { try { var s=localStorage.getItem("af_travel_profile"); return s?JSON.parse(s):{}; } catch{return{};} })
  var profile = pair[0]; var setProfileRaw = pair[1]

  function setProfile(changes) {
    var updated = Object.assign({}, profile, changes)
    setProfileRaw(updated)
    try { localStorage.setItem("af_travel_profile", JSON.stringify(updated)); afVaultChanged("travel_profile") } catch {}
  }

  function field(key, label, placeholder, type) {
    return (
      <div key={key}>
        <label style={labelStyle}>{label}</label>
        <input
          type={type||"text"}
          value={profile[key]||""}
          onChange={function(e) { var v={}; v[key]=e.target.value; setProfile(v) }}
          placeholder={placeholder||""}
          style={inputStyle}
        />
      </div>
    )
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null
    var now = new Date(); now.setHours(0,0,0,0)
    var parts = dateStr.split("-")
    if (parts.length===3 && parts[0].length===4) {
      return Math.round((new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2])) - now) / 86400000)
    }
    return null
  }

  function ExpiryBadge(props) {
    var d = daysUntil(props.date)
    if (d===null) return null
    var expired = d<0; var soon = d>=0&&d<=90; var color = expired?"#e88":soon?sand:muted
    var label = expired?"Expired "+Math.abs(d)+"d ago":d===0?"Expires today":d<=30?d+"d left":d<=90?"~"+Math.round(d/30)+"mo left":null
    if (!label) return null
    return React.createElement("span",{style:{fontSize:9,fontWeight:700,color:color,fontFamily:"DM Sans,sans-serif",marginLeft:6,background:"rgba(250,242,229,0.06)",borderRadius:20,padding:"1px 7px",border:"1px solid "+color+"44"}},label)
  }

  var AIRLINE_PROGRAMS = ["United MileagePlus","Delta SkyMiles","American AAdvantage","Southwest Rapid Rewards","Alaska Mileage Plan","JetBlue TrueBlue","Air Canada Aeroplan","British Airways Avios","Emirates Skywards","Other"]
  var HOTEL_PROGRAMS = ["Marriott Bonvoy","Hilton Honors","World of Hyatt","IHG One Rewards","Wyndham Rewards","Choice Privileges","Best Western Rewards","Other"]

  var ffPrograms = profile.ffPrograms || []
  var hotelPrograms = profile.hotelPrograms || []

  function addFF() { setProfile({ ffPrograms: [...ffPrograms, { id:Date.now().toString(), airline:"", number:"", tier:"" }] }) }
  function updateFF(id, changes) { setProfile({ ffPrograms: ffPrograms.map(function(p){ return p.id===id?Object.assign({},p,changes):p }) }) }
  function removeFF(id) { setProfile({ ffPrograms: ffPrograms.filter(function(p){ return p.id!==id }) }) }

  function addHotel() { setProfile({ hotelPrograms: [...hotelPrograms, { id:Date.now().toString(), chain:"", number:"", tier:"" }] }) }
  function updateHotel(id, changes) { setProfile({ hotelPrograms: hotelPrograms.map(function(p){ return p.id===id?Object.assign({},p,changes):p }) }) }
  function removeHotel(id) { setProfile({ hotelPrograms: hotelPrograms.filter(function(p){ return p.id!==id }) }) }

  var luggage = profile.luggage || []
  function addLuggage() { setProfile({ luggage: [...luggage, { id:Date.now().toString(), description:"", lockCode:"" }] }) }
  function updateLuggage(id, changes) { setProfile({ luggage: luggage.map(function(b){ return b.id===id?Object.assign({},b,changes):b }) }) }
  function removeLuggage(id) { setProfile({ luggage: luggage.filter(function(b){ return b.id!==id }) }) }

  var emergencyContacts = profile.emergencyContacts || []
  function addContact() { setProfile({ emergencyContacts: [...emergencyContacts, { id:Date.now().toString(), name:"", phone:"", relation:"" }] }) }
  function updateContact(id, changes) { setProfile({ emergencyContacts: emergencyContacts.map(function(c){ return c.id===id?Object.assign({},c,changes):c }) }) }
  function removeContact(id) { setProfile({ emergencyContacts: emergencyContacts.filter(function(c){ return c.id!==id }) }) }

  var sectionHead = function(emoji, title) {
    return React.createElement("div",{style:{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(250,248,244,0.25)",fontFamily:"DM Sans,sans-serif",marginBottom:10,marginTop:4,display:"flex",alignItems:"center",gap:6}},emoji," ",title)
  }

  return (
    <div>
      <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:22, fontWeight:600, color:warm, marginBottom:4 }}>Travel Profile</div>
      <div style={{ fontSize:12, color:muted, fontFamily:"DM Sans,sans-serif", marginBottom:20 }}>Loyalty numbers, travel documents and credentials — all in one place.</div>

      {/* Passports */}
      <div style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
        {sectionHead("📘","Passport")}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ flex:2 }}>{field("passportName","Name as on passport","Full name")}</div>
            <div style={{ flex:1 }}>{field("passportCountry","Country","e.g. USA")}</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ flex:1 }}>
              <MaskedField label="Passport number" value={profile.passportNum} onChange={function(e){setProfile({passportNum:e.target.value})}} placeholder="Passport #" inputStyle={inputStyle} labelStyle={labelStyle} muted={muted} />
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ flex:1 }}>
              <label style={labelStyle}>Expiration date</label>
              <div style={{ display:"flex", alignItems:"center" }}>
                <input type="date" value={profile.passportExp||""} onChange={function(e){setProfile({passportExp:e.target.value})}} style={inputStyle}/>
              </div>
              {profile.passportExp && React.createElement(ExpiryBadge,{date:profile.passportExp})}
            </div>
          </div>
          <div style={{ fontSize:10, color:"rgba(250,248,244,0.25)", fontFamily:"DM Sans,sans-serif" }}>
            💡 Most countries require passport valid 6+ months beyond travel dates.
          </div>
        </div>
      </div>

      {/* Second passport */}
      <div style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
        {sectionHead("📘","Second Passport (optional)")}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ flex:1 }}>{field("passport2Country","Country","e.g. Mexico")}</div>
          </div>
          <div style={{ flex:1 }}>
            <MaskedField label="Passport number" value={profile.passport2Num} onChange={function(e){setProfile({passport2Num:e.target.value})}} placeholder="Passport #" inputStyle={inputStyle} labelStyle={labelStyle} muted={muted} />
          </div>
          <div style={{ flex:1 }}>
            <label style={labelStyle}>Expiration date</label>
            <input type="date" value={profile.passport2Exp||""} onChange={function(e){setProfile({passport2Exp:e.target.value})}} style={inputStyle}/>
            {profile.passport2Exp && React.createElement(ExpiryBadge,{date:profile.passport2Exp})}
          </div>
        </div>
      </div>

      {/* Trusted Traveler */}
      <div style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
        {sectionHead("🛂","Trusted Traveler Programs")}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {[
            {key:"tsa",label:"TSA PreCheck",numKey:"tsaNum",expKey:"tsaExp"},
            {key:"ge",label:"Global Entry",numKey:"geNum",expKey:"geExp"},
            {key:"nexus",label:"NEXUS",numKey:"nexusNum",expKey:"nexusExp"},
            {key:"sentri",label:"SENTRI",numKey:"sentriNum",expKey:"sentriExp"},
          ].map(function(prog) {
            return (
              <div key={prog.key} style={{ background:"rgba(250,242,229,0.03)", borderRadius:9, padding:"10px 12px" }}>
                <div style={{ fontSize:12, fontWeight:700, color:warm, fontFamily:"DM Sans,sans-serif", marginBottom:8, display:"flex", alignItems:"center" }}>
                  {prog.label}
                  {profile[prog.expKey] && React.createElement(ExpiryBadge,{date:profile[prog.expKey]})}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ flex:1 }}>
                    <MaskedField label="Known Traveler #" value={profile[prog.numKey]} onChange={function(e){var v={};v[prog.numKey]=e.target.value;setProfile(v)}} placeholder="Number" inputStyle={inputStyle} labelStyle={labelStyle} muted={muted} />
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={labelStyle}>Expiration</label>
                    <input type="date" value={profile[prog.expKey]||""} onChange={function(e){var v={};v[prog.expKey]=e.target.value;setProfile(v)}} style={inputStyle}/>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Airline Frequent Flyer */}
      <div style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          {sectionHead("✈️","Frequent Flyer Numbers")}
          <button onClick={addFF} style={{ background:"rgba(200,169,122,0.1)", border:"1px solid rgba(200,169,122,0.2)", borderRadius:7, padding:"3px 10px", fontSize:11, color:sand, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, flexShrink:0, marginTop:-4 }}>+ Add</button>
        </div>
        {ffPrograms.length === 0 && (
          <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No programs added yet.</div>
        )}
        {ffPrograms.map(function(p) {
          return (
            <div key={p.id} style={{ background:"rgba(250,242,229,0.03)", borderRadius:9, padding:"10px 12px", marginBottom:8 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ flex:2 }}>
                    <label style={labelStyle}>Airline program</label>
                    <select value={p.airline||""} onChange={function(e){updateFF(p.id,{airline:e.target.value})}} style={Object.assign({},inputStyle,{WebkitAppearance:"none",appearance:"none",color:p.airline?warm:"rgba(250,248,244,0.3)"})}>
                      <option value="" style={{background:navy}}>Select program…</option>
                      {AIRLINE_PROGRAMS.map(function(a){ return React.createElement("option",{key:a,value:a,style:{background:navy}},a) })}
                    </select>
                  </div>
                  <div style={{ flex:1 }}>
                    <MaskedField label="Member #" value={p.number} onChange={function(e){updateFF(p.id,{number:e.target.value})}} placeholder="Number" inputStyle={inputStyle} labelStyle={labelStyle} muted={muted} />
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <div style={{ flex:1 }}>
                    <label style={labelStyle}>Status / Tier</label>
                    <input value={p.tier||""} onChange={function(e){updateFF(p.id,{tier:e.target.value})}} placeholder="e.g. Gold, 1K, Platinum" style={inputStyle}/>
                  </div>
                  <button onClick={function(){removeFF(p.id)}} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginTop:18 }}>remove</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Hotel Loyalty */}
      <div style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          {sectionHead("🏨","Hotel Loyalty Programs")}
          <button onClick={addHotel} style={{ background:"rgba(200,169,122,0.1)", border:"1px solid rgba(200,169,122,0.2)", borderRadius:7, padding:"3px 10px", fontSize:11, color:sand, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, flexShrink:0, marginTop:-4 }}>+ Add</button>
        </div>
        {hotelPrograms.length === 0 && (
          <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No programs added yet.</div>
        )}
        {hotelPrograms.map(function(p) {
          return (
            <div key={p.id} style={{ background:"rgba(250,242,229,0.03)", borderRadius:9, padding:"10px 12px", marginBottom:8 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ flex:2 }}>
                    <label style={labelStyle}>Hotel program</label>
                    <select value={p.chain||""} onChange={function(e){updateHotel(p.id,{chain:e.target.value})}} style={Object.assign({},inputStyle,{WebkitAppearance:"none",appearance:"none",color:p.chain?warm:"rgba(250,248,244,0.3)"})}>
                      <option value="" style={{background:navy}}>Select program…</option>
                      {HOTEL_PROGRAMS.map(function(h){ return React.createElement("option",{key:h,value:h,style:{background:navy}},h) })}
                    </select>
                  </div>
                  <div style={{ flex:1 }}>
                    <MaskedField label="Member #" value={p.number} onChange={function(e){updateHotel(p.id,{number:e.target.value})}} placeholder="Number" inputStyle={inputStyle} labelStyle={labelStyle} muted={muted} />
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <div style={{ flex:1 }}>
                    <label style={labelStyle}>Status / Tier</label>
                    <input value={p.tier||""} onChange={function(e){updateHotel(p.id,{tier:e.target.value})}} placeholder="e.g. Gold, Diamond, Platinum" style={inputStyle}/>
                  </div>
                  <button onClick={function(){removeHotel(p.id)}} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginTop:18 }}>remove</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Preferences */}
      <div style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
        {sectionHead("⭐","Preferences")}
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ flex:1 }}>{field("preferredAirline","Preferred airline","e.g. Delta")}</div>
          <div style={{ flex:1 }}>{field("preferredHotel","Preferred hotel","e.g. Marriott")}</div>
        </div>
      </div>

      {/* Luggage */}
      <div style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          {sectionHead("🧳","Luggage")}
          <button onClick={addLuggage} style={{ background:"rgba(200,169,122,0.1)", border:"1px solid rgba(200,169,122,0.2)", borderRadius:7, padding:"3px 10px", fontSize:11, color:sand, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, flexShrink:0, marginTop:-4 }}>+ Add</button>
        </div>
        {luggage.length === 0 && (
          <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No bags added yet.</div>
        )}
        {luggage.map(function(b) {
          return (
            <div key={b.id} style={{ background:"rgba(250,242,229,0.03)", borderRadius:9, padding:"10px 12px", marginBottom:8 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                  <div style={{ flex:2 }}>
                    <label style={labelStyle}>Description</label>
                    <input value={b.description||""} onChange={function(e){updateLuggage(b.id,{description:e.target.value})}} placeholder="e.g. Black hardshell 26in" style={inputStyle}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <MaskedField label="Lock code" value={b.lockCode} onChange={function(e){updateLuggage(b.id,{lockCode:e.target.value})}} placeholder="Code" inputStyle={inputStyle} labelStyle={labelStyle} muted={muted} />
                  </div>
                  <button onClick={function(){removeLuggage(b.id)}} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginBottom:9 }}>remove</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Emergency Travel Contacts */}
      <div style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          {sectionHead("🚨","Emergency Travel Contacts")}
          <button onClick={addContact} style={{ background:"rgba(200,169,122,0.1)", border:"1px solid rgba(200,169,122,0.2)", borderRadius:7, padding:"3px 10px", fontSize:11, color:sand, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, flexShrink:0, marginTop:-4 }}>+ Add</button>
        </div>
        {emergencyContacts.length === 0 && (
          <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No contacts added yet.</div>
        )}
        {emergencyContacts.map(function(c) {
          return (
            <div key={c.id} style={{ background:"rgba(250,242,229,0.03)", borderRadius:9, padding:"10px 12px", marginBottom:8 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ flex:2 }}>
                    <label style={labelStyle}>Name</label>
                    <input value={c.name||""} onChange={function(e){updateContact(c.id,{name:e.target.value})}} placeholder="Full name" style={inputStyle}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={labelStyle}>Relation</label>
                    <input value={c.relation||""} onChange={function(e){updateContact(c.id,{relation:e.target.value})}} placeholder="e.g. Grandparent" style={inputStyle}/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <div style={{ flex:1 }}>
                    <label style={labelStyle}>Phone</label>
                    <input value={c.phone||""} onChange={function(e){updateContact(c.id,{phone:e.target.value})}} placeholder="Phone number" style={inputStyle}/>
                  </div>
                  <button onClick={function(){removeContact(c.id)}} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginTop:18 }}>remove</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Trips (Travel redesign Step 3: Trips Dashboard) ─────────────────────────
// af_trips: array of trip records, registered in SYNC_KEYS + sanitizeHouseholdData's
// array-guard (see sync-core.js) — same treatment as celebrations/ownedProducts.
//
// Trip shape: { id, name, destination, startDate, endDate, notes, status, icon,
//   color, transportation, lodging, itinerary, packing, reservations, budget,
//   documents, dining, activities, emergencyInfo, cardOrder }
//
// Step 4a defines transportation and lodging as arrays of records — not
// single objects — same shape class as ffPrograms/hotelPrograms (Step 1):
// a connecting flight or a two-stay trip isn't an edge case for a real
// family trip. transportation[]: { id, type, carrier, confirmationNumber,
// departure, arrival }. lodging[]: { id, name, address, confirmationNumber,
// checkIn, checkOut }.
//
// Step 4b defines packing/itinerary/activities/reservations as checklist-
// shaped arrays — { id, text, done } — pattern copied from HouseFileSection's
// addChecklistItem/removeChecklistItem/toggleItem (~5724, not exported/
// importable, so a fresh implementation of the same shape). Packing's
// "Copy from Always Bring" button reads profile.alwaysBring from
// af_travel_profile as a one-time starting point, not a live link.
//
// TODO: budget/documents/dining/emergencyInfo/cardOrder remain unvalidated
// null placeholders until later steps define their real per-field shape —
// this is not a design decision to leave them loose permanently, just not
// yet defined.
//
// Wired into activeSection routing ("trips") and a PILLARS nav sibling next
// to "travel" in App.jsx.

// ── Reusable collapsible card shell — used by every sub-card in the trip
// detail view (Overview/Transportation/Lodging here; Itinerary/Packing/etc.
// in later steps). Self-contained (own open/closed state + base styling),
// so a caller only needs to supply icon/title/accent/children — same
// self-contained-prop-driven shape as MaskedField (Step 1).
function TripCard(props) {
  var s = useState(props.defaultOpen !== false); var open = s[0]; var setOpen = s[1]
  var accent = props.accent || "#c8a97a"
  return (
    <div style={{ background:"rgba(250,242,229,0.04)", border:"1px solid "+accent+"33", borderRadius:12, marginBottom:12, overflow:"hidden" }}>
      <div onClick={function(){ setOpen(function(o){ return !o }) }} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", cursor:"pointer" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Circular icon badge — same shape/sizing convention as Health's HPersonCard avatar (~5921), tinted from this card's own accent instead of a solid person-color */}
          <div style={{ width:30, height:30, borderRadius:"50%", background:accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{props.icon}</div>
          <div>
            <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:15, fontWeight:700, color:accent, lineHeight:1.2 }}>{props.title}</div>
            {/* Always-visible content preview, even collapsed — same stat/status-text convention as HPersonCard's preview rows (~5942) */}
            {props.preview && <div style={{ fontSize:11, color:props.previewColor||"rgba(250,248,244,0.4)", fontFamily:"DM Sans,sans-serif", marginTop:2 }}>{props.preview}</div>}
          </div>
        </div>
        <span style={{ fontSize:10, color:"rgba(250,248,244,0.3)", display:"inline-block", transform:open?"rotate(180deg)":"rotate(0deg)", transition:"transform 0.2s", flexShrink:0 }}>▾</span>
      </div>
      {open && <div style={{ padding:"0 14px 14px", borderTop:"1px solid rgba(250,242,229,0.06)" }}>{props.children}</div>}
    </div>
  )
}

// ── Tappable grid tile — Level 2→3 nav ──────────────────────────────────────
// Same visual language as TripCard (icon badge, title, preview line) but no
// chevron/collapse-in-place: the whole tile is a single tap target that
// navigates to that card's full-page detail view (setActiveTripCard) instead
// of expanding inline. Used only by cards with a built full-page view so far
// (packing, itinerary) — other CARD_RENDERERS entries still return a plain
// TripCard, untouched, until their own turn.
function TripCardTile(props) {
  var accent = props.accent || "#c8a97a"
  return (
    <div onClick={props.onClick} style={{ background:"rgba(250,242,229,0.04)", border:"1px solid "+accent+"33", borderRadius:12, marginBottom:12, overflow:"hidden", padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ width:30, height:30, borderRadius:"50%", background:accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{props.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:15, fontWeight:700, color:accent, lineHeight:1.2 }}>{props.title}</div>
        {props.preview && <div style={{ fontSize:11, color:"rgba(250,248,244,0.4)", fontFamily:"DM Sans,sans-serif", marginTop:2 }}>{props.preview}</div>}
      </div>
      <span style={{ fontSize:16, color:"rgba(250,248,244,0.25)", flexShrink:0 }}>›</span>
    </div>
  )
}

var TRIP_STATUSES = ["Planning","Booked","Upcoming","In Progress","Completed","Cancelled"]
// Same shape as CareerSection's STATUS_COLORS (~3680 as of Step 2's commit):
// a plain object mapping a status string to an rgba color, reusing the same
// rgba values for the equivalent semantic slot (gold=early stage, blue=
// confirmed, teal=active-soon, green=underway, gray=done, red=cancelled).
var TRIP_STATUS_COLORS = {
  "Planning":    "rgba(200,169,122,0.8)",
  "Booked":      "rgba(122,154,184,0.8)",
  "Upcoming":    "rgba(122,184,168,0.8)",
  "In Progress": "rgba(122,184,122,0.8)",
  "Completed":   "rgba(150,150,150,0.5)",
  "Cancelled":   "rgba(184,100,100,0.6)"
}
// Echoes PackingTemplatesPanel's DEFAULT_PACKING_TEMPLATES trip types (flight,
// roadtrip, beach, camping) plus a couple more, for icon/theme consistency
// across the Travel redesign.
var TRIP_ICONS = ["🧳","✈️","🚗","🏖️","🏕️","🚢","🎡","⛰️"]
var TRANSPORT_TYPES = ["Flight","Train","Car Rental","Rideshare","Ferry","Bus","Other"]
var TRANSPORT_TYPE_ICONS = { "Flight":"✈️", "Train":"🚂", "Car Rental":"🚗", "Rideshare":"🚕", "Ferry":"🚢", "Bus":"🚌", "Other":"🧳" }

// ── Step 4c: remaining sub-cards + hide/reorder ─────────────────────────────
// Every card except Overview (pinned first, not hideable/reorderable) is
// addressable by a stable id here. trip.cardOrder is an ordered array of
// VISIBLE ids — an id absent from it is hidden. null/empty cardOrder means
// "not customized yet," which defaults to DEFAULT_CARD_ORDER (all visible,
// in this order) so existing trips from Steps 4a/4b render unchanged.
//
// Accent colors follow Step 4b's discipline — reused from the file's
// existing PERSON_COLORS palette (~4979) where an unclaimed, non-semantic
// value was available, avoiding any hex that already carries meaning
// elsewhere (urgency, health-risk, job-status, complete/success).
// Two exceptions, both flagged for review rather than decided silently:
//  - Documents was specced as "navy," but the app's actual navy (#243A5A)
//    is a near-black background color — illegible as accent text on these
//    same dark card backgrounds. Using #6A9BB5 instead: the file's existing
//    lighter slate-blue "navy-family" tone (PERSON_COLORS default/generic,
//    used for calendar-reminder toasts — not tied to a specific warning).
//  - Budget was specced as "coral," but every existing coral-family hex in
//    this file is already claimed by a specific warning (#F0997B = heart-
//    risk, #d85a30 = vaccine-due, #e07070 = delete/overdue). No unclaimed
//    non-semantic coral existed, so #e0937a is a new value — chosen to sit
//    near the file's existing warm-tone family without exactly matching
//    any already-claimed color.
// Emergency Info reuses #c8834a (the file's established urgency/soon color)
// deliberately, unlike every other card here — for Emergency Info, urgency
// IS the correct meaning, so this is the one case where reapplying that
// signal is accurate rather than a collision.
var DEFAULT_CARD_ORDER = ["transportation","lodging","packing","itinerary","activities","reservations","budget","documents","dining","weather","notes","emergencyInfo","photos"]
var CARD_META = {
  transportation: { icon:"✈️", title:"Transportation", accent:"#7aa8c8" },
  lodging:        { icon:"🏨", title:"Lodging",         accent:"#7a9e8e" },
  packing:        { icon:"🎒", title:"Packing",          accent:"#a07ab5" },
  itinerary:      { icon:"🗓️", title:"Itinerary",        accent:"#d98a6e" },
  activities:     { icon:"🎯", title:"Activities",       accent:"#6ab5a0" },
  reservations:   { icon:"🎫", title:"Reservations",     accent:"#8e8eb5" },
  budget:         { icon:"💰", title:"Budget",           accent:"#e0937a" },
  documents:      { icon:"📄", title:"Documents",        accent:"#6A9BB5" },
  dining:         { icon:"🍽️", title:"Dining",           accent:"#b5856a" },
  weather:        { icon:"⛅", title:"Weather",          accent:"#7EAEB4" },
  notes:          { icon:"📝", title:"Notes",            accent:"#c8a97a" },
  emergencyInfo:  { icon:"🚨", title:"Emergency Info",   accent:"#c8834a" },
  photos:         { icon:"📷", title:"Photos",           accent:"rgba(250,248,244,0.4)" }
}

// Fixed structural grouping for the trip detail view — a static id -> group
// lookup, not a stored field. cardOrder/hiddenCardIds still fully control
// which cards show and their relative order; this only determines which
// fixed section a visible card renders under. Overview isn't part of this
// system at all (pinned above, unaffected).
var CARD_GROUPS_ORDER = ["logistics","whileThere","prep","extras"]
var CARD_GROUP_LABELS = { logistics:"Logistics", whileThere:"While You're There", prep:"Prep", extras:"Extras" }
var CARD_GROUP_OF = {
  transportation:"logistics", lodging:"logistics", documents:"logistics",
  itinerary:"whileThere", activities:"whileThere", dining:"whileThere", reservations:"whileThere",
  packing:"prep", budget:"prep",
  weather:"extras", notes:"extras", emergencyInfo:"extras", photos:"extras"
}

function TripsSection({ initialTripId, onTripIdConsumed, onNavigate }) {
  var warm = "#faf8f4"; var sand = "#c8a97a"; var navy = "#243A5A"
  var muted = "rgba(250,248,244,0.42)"; var border = "rgba(250,242,229,0.08)"; var cardBg = "rgba(250,242,229,0.04)"
  var coastal = "#7EAEB4"
  var inputStyle = { width:"100%", background:"rgba(250,242,229,0.06)", border:"1px solid rgba(200,169,122,0.25)", borderRadius:8, padding:"8px 12px", fontSize:13, color:warm, fontFamily:"DM Sans,sans-serif", outline:"none", boxSizing:"border-box" }
  var labelStyle = { fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(250,248,244,0.3)", fontFamily:"DM Sans,sans-serif", marginBottom:4, display:"block" }

  var pair = useState(function() {
    try {
      var s = localStorage.getItem("af_trips")
      var parsed = s ? JSON.parse(s) : []
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  })
  var trips = pair[0]; var setTripsRaw = pair[1]
  // COUNTDOWN-1: reusable countdowns tagged to show on Travel — additive,
  // alongside TripCountdownBadge below (not a replacement for it).
  var travelCountdowns = useState(function() {
    try {
      var s2 = localStorage.getItem("af_countdowns")
      var parsed2 = s2 ? JSON.parse(s2) : []
      return Array.isArray(parsed2) ? parsed2 : []
    } catch { return [] }
  })[0].filter(function(cd) {
    if (!cd || !cd.targetDate || !Array.isArray(cd.showOn) || !cd.showOn.includes("Travel")) return false
    var d = new Date(cd.targetDate + "T00:00:00")
    var today0 = new Date(); today0.setHours(0,0,0,0)
    return !isNaN(d.getTime()) && d >= today0
  })

  function saveTrips(updated) {
    setTripsRaw(updated)
    try { localStorage.setItem("af_trips", JSON.stringify(updated)); afVaultChanged("trips") } catch {}
  }

  // Gained an optional `data` param vs. the Step 2 stub, to support the add
  // form below — additive only: addTrip() with no args still produces the
  // exact same 20-field blank record as committed in Step 2, `data` just
  // overrides fields on top of that same template.
  function addTrip(data) {
    saveTrips([...trips, Object.assign({
      id: Date.now().toString(),
      name: "", destination: "", startDate: "", endDate: "", notes: "",
      status: "", icon: "", color: "",
      transportation: null, lodging: null, itinerary: null, packing: null,
      reservations: null, budget: null, documents: null, dining: null,
      activities: null, emergencyInfo: null, cardOrder: null
    }, data || {})])
  }
  function updateTrip(id, changes) {
    saveTrips(trips.map(function(t){ return t.id===id ? Object.assign({}, t, changes) : t }))
  }
  function removeTrip(id) {
    saveTrips(trips.filter(function(t){ return t.id!==id }))
  }

  // Adapted from TravelProfileSection's daysUntil (~3067 as of Step 1/2) — full
  // YYYY-MM-DD diff, no next-year rollover. Deliberately NOT CelebrationsSection's
  // daysUntil (~1162), which rolls forward to next year for recurring MM-DD
  // events — a trip is a one-off dated event, so an expired trip should read
  // as past, not silently jump a year ahead.
  function daysUntil(dateStr) {
    if (!dateStr) return null
    var now = new Date(); now.setHours(0,0,0,0)
    var parts = dateStr.split("-")
    if (parts.length===3 && parts[0].length===4) {
      return Math.round((new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2])) - now) / 86400000)
    }
    return null
  }

  // Adapted from CelebrationsSection's formatOccDate (~1171) — same month-
  // abbreviation array, extended to include the year since a trip (unlike a
  // recurring MM-DD celebration) needs one.
  function formatTripDate(dateStr) {
    if (!dateStr) return ""
    var parts = dateStr.split("-")
    if (parts.length!==3) return dateStr
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    return months[parseInt(parts[1])-1]+" "+parseInt(parts[2])+", "+parts[0]
  }
  // Header/banner trip length ("7 days") — inclusive of both start and end
  // dates, same manual YYYY-MM-DD part parsing as daysUntil above (avoids
  // the timezone ambiguity of new Date(dateStr) on a bare date string).
  function tripLengthDays(trip) {
    if (!trip.startDate || !trip.endDate) return null
    var sp = trip.startDate.split("-"); var ep = trip.endDate.split("-")
    if (sp.length!==3 || ep.length!==3) return null
    var s = new Date(parseInt(sp[0]),parseInt(sp[1])-1,parseInt(sp[2]))
    var e = new Date(parseInt(ep[0]),parseInt(ep[1])-1,parseInt(ep[2]))
    var n = Math.round((e-s)/86400000) + 1
    return n > 0 ? n : null
  }

  // Adapted from TravelProfileSection's ExpiryBadge (~3077) — same small pill
  // styling, different logic: a trip counts down to a start date and flags an
  // in-progress window, rather than counting down to a document's expiry.
  function TripCountdownBadge(props) {
    var trip = props.trip
    var start = daysUntil(trip.startDate)
    var end = daysUntil(trip.endDate)
    if (start === null) return null
    // No endDate means a single-day trip — it ends the same day it starts,
    // not "ongoing forever." Without this, any past-dated trip missing an
    // end date reads as permanently "In progress" instead of going "Past".
    var effectiveEnd = end !== null ? end : start
    var inProgress = start <= 0 && effectiveEnd >= 0
    var isPast = effectiveEnd < 0
    var color = inProgress ? coastal : isPast ? muted : sand
    var label = inProgress ? "In progress" : isPast ? "Past" : start===0 ? "Today!" : start===1 ? "Tomorrow" : start<=30 ? start+"d away" : "~"+Math.round(start/30)+"mo away"
    return <span style={{ fontSize:9, fontWeight:700, color:color, fontFamily:"DM Sans,sans-serif", background:"rgba(250,242,229,0.06)", borderRadius:20, padding:"1px 7px", border:"1px solid "+color+"44" }}>{label}</span>
  }

  // Read-only mirror of af_travel_profile for the Travel Wallet card at the
  // top of the trips grid — editing still happens in TravelProfileSection
  // (reached via the Edit button below), this is just a display copy, same
  // one-read-on-mount pattern TravelProfileSection itself uses.
  var travelProfile = useState(function() {
    try { var s = localStorage.getItem("af_travel_profile"); return s ? JSON.parse(s) : {} } catch { return {} }
  })[0]

  // Red/amber/green expiry coloring for the wallet card — a plain traffic-
  // light scheme (not TravelProfileSection's own ExpiryBadge, which only
  // flags "expired" and "soon" and leaves everything else a neutral muted
  // grey) since this card's spec calls for a third, reassuring "green" state.
  function walletExpiryColor(dateStr) {
    var d = daysUntil(dateStr)
    if (d === null) return null
    return d < 0 ? "rgba(200,100,100,0.9)" : d <= 180 ? sand : "rgba(122,184,122,0.9)"
  }
  function WalletExpiry(props) {
    var color = walletExpiryColor(props.date)
    if (!color) return null
    var d = daysUntil(props.date)
    var label = d < 0 ? "expired "+formatTripDate(props.date) : "expires "+formatTripDate(props.date)
    return <span style={{ fontSize:11, color:color, fontWeight:600 }}> · {label}</span>
  }
  function TravelWalletCard() {
    var p = travelProfile
    var hasPassport = !!(p.passportName || p.passportNum || p.passportExp)
    var trusted = [
      { label:"TSA PreCheck", num:p.tsaNum, exp:p.tsaExp },
      { label:"Global Entry", num:p.geNum, exp:p.geExp },
      { label:"NEXUS", num:p.nexusNum, exp:p.nexusExp },
      { label:"SENTRI", num:p.sentriNum, exp:p.sentriExp },
    ].filter(function(t){ return t.num || t.exp })
    var ff = (p.ffPrograms||[]).filter(function(f){ return f.airline || f.number })
    var hotels = (p.hotelPrograms||[]).filter(function(h){ return h.chain || h.number })
    var empty = !hasPassport && trusted.length===0 && ff.length===0 && hotels.length===0 && !p.preferredAirline && !p.preferredHotel

    return (
      <div style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"14px 16px", marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom: empty?0:12 }}>
          <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:16, fontWeight:700, color:warm, display:"flex", alignItems:"center", gap:6 }}>🧳 Travel Wallet</div>
          <button onClick={function(){ if (onNavigate) onNavigate("travel") }} style={{ background:"rgba(200,169,122,0.1)", border:"1px solid rgba(200,169,122,0.25)", borderRadius:7, padding:"4px 12px", fontSize:11, color:sand, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, flexShrink:0 }}>Edit</button>
        </div>
        {empty ? (
          <div style={{ fontSize:12, color:"rgba(250,248,244,0.3)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No travel documents or loyalty numbers yet — tap Edit to add some.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {hasPassport && (
              <div style={{ fontSize:12.5, color:warm, fontFamily:"DM Sans,sans-serif" }}>
                📘 {p.passportName || "Passport"}{p.passportNum ? " · "+p.passportNum : ""}
                <WalletExpiry date={p.passportExp} />
              </div>
            )}
            {trusted.map(function(t) {
              return (
                <div key={t.label} style={{ fontSize:12.5, color:warm, fontFamily:"DM Sans,sans-serif" }}>
                  🛂 {t.label}{t.num ? " · "+t.num : ""}
                  <WalletExpiry date={t.exp} />
                </div>
              )
            })}
            {ff.map(function(f) {
              return (
                <div key={f.id} style={{ fontSize:12.5, color:warm, fontFamily:"DM Sans,sans-serif" }}>
                  ✈️ {f.airline}{f.number ? " · "+f.number : ""}{f.tier ? " · "+f.tier : ""}
                </div>
              )
            })}
            {hotels.map(function(h) {
              return (
                <div key={h.id} style={{ fontSize:12.5, color:warm, fontFamily:"DM Sans,sans-serif" }}>
                  🏨 {h.chain}{h.number ? " · "+h.number : ""}{h.tier ? " · "+h.tier : ""}
                </div>
              )
            })}
            {(p.preferredAirline || p.preferredHotel) && (
              <div style={{ fontSize:11, color:muted, fontFamily:"DM Sans,sans-serif", marginTop:2 }}>
                ⭐ {[p.preferredAirline, p.preferredHotel].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // null = form closed; object = open, editing this local draft.
  // { id: null } means "new trip, not saved yet" — same add/edit-share-one-form
  // shape as HomeSystemsSection's MaintenancePanel (editIdx null vs. set).
  var s_form = useState(null)
  var formTrip = s_form[0]; var setFormTrip = s_form[1]
  // Snapshot of formTrip's values at the moment the modal opened — compared
  // against the live draft to detect unsaved changes, so closeForm/back-
  // navigation can warn before discarding (Phase B). Not the same object
  // reference as formTrip (a separate copy), so editing formTrip doesn't
  // silently drag this along too.
  var s_formOriginal = useState(null)
  var formTripOriginal = s_formOriginal[0]; var setFormTripOriginal = s_formOriginal[1]

  function openAdd() {
    var blank = { id:null, name:"", destination:"", startDate:"", endDate:"", status:TRIP_STATUSES[0], icon:TRIP_ICONS[0], notes:"" }
    setFormTrip(blank)
    setFormTripOriginal(Object.assign({}, blank))
  }
  function openEdit(trip) {
    var draft = { id:trip.id, name:trip.name||"", destination:trip.destination||"", startDate:trip.startDate||"", endDate:trip.endDate||"", status:trip.status||TRIP_STATUSES[0], icon:trip.icon||TRIP_ICONS[0], notes:trip.notes||"" }
    setFormTrip(draft)
    setFormTripOriginal(Object.assign({}, draft))
  }
  function hasUnsavedFormChanges() {
    if (!formTrip || !formTripOriginal) return false
    return ["name","destination","startDate","endDate","status","icon","notes"].some(function(k){ return formTrip[k] !== formTripOriginal[k] })
  }
  // Unconditional close — used after an intentional save, where there's
  // nothing to "discard" even though the draft still differs from the
  // pre-edit snapshot. closeForm (below) is the guarded one for dismissal.
  function forceCloseForm() { setFormTrip(null); setFormTripOriginal(null) }
  // Guards the modal's actual discard paths (✕ button, backdrop click —
  // both already call closeForm, unchanged) with the file's established
  // window.confirm pattern (matches deleteForm just below), same as
  // MaintenancePanel's delete-confirm — only prompts if something would
  // actually be lost.
  function closeForm() {
    if (hasUnsavedFormChanges() && !window.confirm("Discard unsaved changes to this trip?")) return
    forceCloseForm()
  }
  function saveForm() {
    if (!formTrip.name.trim()) return
    var data = { name:formTrip.name.trim(), destination:formTrip.destination.trim(), startDate:formTrip.startDate, endDate:formTrip.endDate, status:formTrip.status, icon:formTrip.icon, notes:formTrip.notes.trim() }
    if (formTrip.id) updateTrip(formTrip.id, data)
    else addTrip(data)
    forceCloseForm()
  }
  // Delete-with-confirm matches the file's established window.confirm pattern
  // (e.g. MaintenancePanel: "Delete "+sys.name+"?", ~5744) — not a new pattern.
  function deleteForm() {
    if (!formTrip || !formTrip.id) return
    if (!window.confirm("Delete "+(formTrip.name||"this trip")+"?")) return
    removeTrip(formTrip.id)
    if (detailTripId === formTrip.id) setDetailTripId(null)
    forceCloseForm()
  }
  // Safe back navigation (Phase B): if the edit modal is open with unsaved
  // changes, warn before leaving the detail view entirely — same guard as
  // closeForm, applied to the "← Back to Trips" path too, so tapping back
  // mid-edit can't silently discard a draft. Also closes the modal rather
  // than leaving it orphaned floating over the trips gallery underneath.
  function backToTrips() {
    if (formTrip && hasUnsavedFormChanges() && !window.confirm("Discard unsaved changes to this trip?")) return
    if (formTrip) forceCloseForm()
    setDetailTripId(null)
  }

  // Which trip's detail view is open — same shape as CelebrationsSection's
  // detailCelebId: a single selected id, or null when closed.
  var s_detail = useState(null)
  var detailTripId = s_detail[0]; var setDetailTripId = s_detail[1]
  function openDetail(trip) { setDetailTripId(trip.id) }
  var detailTrip = detailTripId ? (trips.find(function(t){ return t.id===detailTripId }) || null) : null

  // Deep-link from FlowHome's Travel overview card (tapping a specific trip
  // tile) — one-shot: consume it into local state, then tell the parent to
  // clear it so a later fresh visit to Trips doesn't reopen the same trip.
  useEffect(function() {
    if (initialTripId) { setDetailTripId(initialTripId); if (onTripIdConsumed) onTripIdConsumed() }
  }, [initialTripId])

  // Level 3 nav: null = card grid, string (a CARD_META id) = that card's
  // full-page detail view. Only "packing"/"itinerary" have a real full-page
  // view built so far — other card ids aren't reachable via activeTripCard
  // yet (their grid tiles still use the old TripCard collapse-in-place
  // behavior, untouched, until their turn).
  var s_activeCard = useState(null)
  var activeTripCard = s_activeCard[0]; var setActiveTripCard = s_activeCard[1]
  // Per-section/day collapse state for the two full-page views, and draft
  // inputs for adding items/sections — all local UI state, nothing persisted.
  var s_collapsedPackSecs = useState({})
  var collapsedPackingSections = s_collapsedPackSecs[0]; var setCollapsedPackingSections = s_collapsedPackSecs[1]
  var s_packDrafts = useState({})
  var packItemDrafts = s_packDrafts[0]; var setPackItemDrafts = s_packDrafts[1]
  var s_newPackSec = useState("")
  var newPackingSectionTitle = s_newPackSec[0]; var setNewPackingSectionTitle = s_newPackSec[1]
  var s_collapsedItinDays = useState({})
  var collapsedItineraryDays = s_collapsedItinDays[0]; var setCollapsedItineraryDays = s_collapsedItinDays[1]
  // Past Adventures section on the trips gallery — collapsed by default so
  // completed trips don't dominate the view; still fully accessible via
  // the chevron toggle.
  var s_pastCollapsed = useState(true)
  var collapsedPastAdventures = s_pastCollapsed[0]; var setCollapsedPastAdventures = s_pastCollapsed[1]
  // Import-from-saved-packing-template panel: closed / choosing a template /
  // a template chosen (showing the merge-vs-replace choice).
  var s_importOpen = useState(false)
  var importOpen = s_importOpen[0]; var setImportOpen = s_importOpen[1]
  var s_importTemplate = useState(null)
  var importSelectedTemplate = s_importTemplate[0]; var setImportSelectedTemplate = s_importTemplate[1]
  // Notes full-page view: local draft + 500ms debounced auto-save (500ms
  // per spec), so every keystroke doesn't write to storage. No existing
  // debounce pattern in this file to match — this is a new one, not
  // reusing an established convention.
  var s_notesDraft = useState("")
  var notesDraft = s_notesDraft[0]; var setNotesDraft = s_notesDraft[1]
  var notesDebounceRef = useRef(null)

  // Transportation/lodging are arrays, not single objects — a connecting
  // flight or a two-stay trip isn't an edge case for a real family trip.
  // Same add/update/remove pattern as ffPrograms/hotelPrograms (Step 1):
  // Object.assign merge on update, filter-by-id on remove.
  function addTransportation() {
    if (!detailTrip) return
    var list = detailTrip.transportation || []
    updateTrip(detailTrip.id, { transportation: [...list, { id:Date.now().toString(), type:"", carrier:"", confirmationNumber:"", departure:"", arrival:"" }] })
  }
  function updateTransportation(id, changes) {
    if (!detailTrip) return
    var list = detailTrip.transportation || []
    updateTrip(detailTrip.id, { transportation: list.map(function(t){ return t.id===id ? Object.assign({},t,changes) : t }) })
  }
  function removeTransportation(id) {
    if (!detailTrip) return
    var list = detailTrip.transportation || []
    updateTrip(detailTrip.id, { transportation: list.filter(function(t){ return t.id!==id }) })
  }

  function addLodging() {
    if (!detailTrip) return
    var list = detailTrip.lodging || []
    updateTrip(detailTrip.id, { lodging: [...list, { id:Date.now().toString(), name:"", address:"", confirmationNumber:"", checkIn:"", checkOut:"" }] })
  }
  function updateLodging(id, changes) {
    if (!detailTrip) return
    var list = detailTrip.lodging || []
    updateTrip(detailTrip.id, { lodging: list.map(function(l){ return l.id===id ? Object.assign({},l,changes) : l }) })
  }
  function removeLodging(id) {
    if (!detailTrip) return
    var list = detailTrip.lodging || []
    updateTrip(detailTrip.id, { lodging: list.filter(function(l){ return l.id!==id }) })
  }

  // ── Packing — sectioned shape, full-page detail view (Level 3 nav) ────────
  // detailTrip.packing was a flat {id,text,done} checklist (Step 4b) with no
  // section concept. New shape: [{id,title,items:[{id,text,done}]}], items
  // nested directly inside their section rather than cross-referenced by id
  // in a second parallel array — deliberately avoiding the class of bug that
  // hit Cove's cove_sections_v1/cove_items_v1 split (a dangling section_id
  // reference after any partial data loss). normalizePackingSections
  // tolerates either shape on read, so a trip with old flat items still
  // displays correctly (folded into one section) without a separate
  // migration step or effect — it only ever gets written in the new shape,
  // the first time any mutator below runs.
  function normalizePackingSections(raw) {
    var list = Array.isArray(raw) ? raw : []
    if (list.length > 0 && list[0] && list[0].items === undefined && list[0].text !== undefined) {
      return [{ id:"legacy", title:"Packing List", items: list.map(function(it){ return { id:it.id, text:it.text, done:!!it.done } }) }]
    }
    return list.map(function(sec){
      return { id:sec.id, title: sec.title || "Untitled", items:(sec.items||[]).map(function(it){ return { id:it.id, text:it.text, done:!!it.done } }) }
    })
  }
  function packingSections() { return normalizePackingSections(detailTrip && detailTrip.packing) }
  function savePackingSections(sections) { if (!detailTrip) return; updateTrip(detailTrip.id, { packing: sections }) }
  function addPackingSection(title) {
    savePackingSections([...packingSections(), { id:Date.now().toString(), title: (title||"").trim()||"New section", items:[] }])
  }
  function renamePackingSection(secId, title) {
    savePackingSections(packingSections().map(function(s){ return s.id===secId ? Object.assign({},s,{title:title}) : s }))
  }
  function deletePackingSection(secId) {
    if (!window.confirm("Delete this section and all its items?")) return
    savePackingSections(packingSections().filter(function(s){ return s.id!==secId }))
  }
  function addPackingItemToSection(secId, text) {
    if (!text || !text.trim()) return
    savePackingSections(packingSections().map(function(s){
      if (s.id!==secId) return s
      return Object.assign({}, s, { items:[...s.items, { id:Date.now().toString(), text:text.trim(), done:false }] })
    }))
  }
  function togglePackingItem(secId, itemId) {
    savePackingSections(packingSections().map(function(s){
      if (s.id!==secId) return s
      return Object.assign({}, s, { items: s.items.map(function(it){ return it.id===itemId ? Object.assign({},it,{done:!it.done}) : it }) })
    }))
  }
  function removePackingItem(secId, itemId) {
    savePackingSections(packingSections().map(function(s){
      if (s.id!==secId) return s
      return Object.assign({}, s, { items: s.items.filter(function(it){ return it.id!==itemId }) })
    }))
  }
  // Reads profile.alwaysBring directly from af_travel_profile — TripsSection
  // has no other connection to TravelProfileSection's state, same cross-
  // component localStorage read already used by this file's own
  // travelSummary() (~6101). Copies values in as a one-time starting point;
  // does NOT keep a live link — editing the trip's packing list afterward
  // never touches Always Bring, and vice versa.
  function readAlwaysBring() {
    try {
      var s = localStorage.getItem("af_travel_profile")
      var parsed = s ? JSON.parse(s) : {}
      return Array.isArray(parsed.alwaysBring) ? parsed.alwaysBring : []
    } catch { return [] }
  }
  function copyAlwaysBring() {
    if (!detailTrip) return
    var items = readAlwaysBring()
    if (!items.length) return
    var sections = packingSections()
    var copied = items.map(function(text, idx){ return { id: Date.now().toString()+"_"+idx, text: text, done:false } })
    if (sections.length === 0) {
      savePackingSections([{ id:Date.now().toString(), title:"Packing List", items: copied }])
    } else {
      savePackingSections(sections.map(function(s, i){ return i===0 ? Object.assign({},s,{items:[...s.items,...copied]}) : s }))
    }
  }
  // Import from a saved packing-list template (af_packing_templates) — reads
  // only, this session doesn't build the save-as-template side. The panel
  // that used to own creating/editing custom templates (PackingTemplatesPanel,
  // TravelProfileSection) was removed, along with the only code path that
  // seeded the built-in defaults into af_packing_templates on first use — so
  // that same defaults-merge now lives here instead, or a household that's
  // never touched that key would see an empty import picker forever.
  function readPackingTemplates() {
    try {
      var saved = JSON.parse(localStorage.getItem("af_packing_templates") || "null")
      if (Array.isArray(saved) && saved.length) {
        var ids = saved.map(function(t){ return t.id })
        var merged = saved.slice()
        DEFAULT_PACKING_TEMPLATES.forEach(function(d){
          if (ids.indexOf(d.id) === -1) merged.push(JSON.parse(JSON.stringify(d)))
        })
        return merged
      }
      return JSON.parse(JSON.stringify(DEFAULT_PACKING_TEMPLATES))
    } catch { return JSON.parse(JSON.stringify(DEFAULT_PACKING_TEMPLATES)) }
  }
  function uidLocal() { return Date.now().toString()+"_"+Math.random().toString(36).slice(2,8) }
  // Flattens a template into this view's one-level section shape.
  // type:"trip" templates are bag -> category -> items (3 levels) — using
  // "[Bag] — [Category]" as the section title, not category alone, since
  // multiple bags can share a category name (e.g. Beach template has
  // "Beach" under "My Bag", "Kid 1", and "Kid 3" — collapsing to just
  // "Beach" would silently merge different people's items into one
  // section). type:"custom" templates have no bag level, so the category
  // name alone is the section title. Every imported item is done:false
  // regardless of the template's own done state, per spec.
  function templateToSections(t) {
    var sections = []
    if (t.type === "trip") {
      var bags = t.bags || {}
      Object.keys(bags).forEach(function(bagName){
        var cats = bags[bagName] || {}
        Object.keys(cats).forEach(function(catName){
          var items = cats[catName] || []
          if (items.length === 0) return
          sections.push({ title: bagName+" — "+catName, items: items.map(function(it){ return { text: it.text, done:false } }) })
        })
      })
    } else {
      var itemsMap = t.items || {}
      Object.keys(itemsMap).forEach(function(catName){
        var items = itemsMap[catName] || []
        if (items.length === 0) return
        sections.push({ title: catName, items: items.map(function(it){ return { text: it.text, done:false } }) })
      })
    }
    return sections
  }
  function importTemplateMerge(t) {
    var incoming = templateToSections(t)
    var current = packingSections()
    incoming.forEach(function(inc){
      var existingIdx = current.findIndex(function(s){ return s.title === inc.title })
      var newItems = inc.items.map(function(it){ return { id:uidLocal(), text:it.text, done:false } })
      if (existingIdx !== -1) {
        current = current.map(function(s, i){ return i===existingIdx ? Object.assign({}, s, { items:[...s.items, ...newItems] }) : s })
      } else {
        current = current.concat([{ id:uidLocal(), title: inc.title, items: newItems }])
      }
    })
    savePackingSections(current)
  }
  // Returns true if the replace actually happened (so the caller only
  // closes the import panel on an actual replace, not a cancelled confirm).
  function importTemplateReplace(t) {
    if (!window.confirm("Replace your current packing list? This can't be undone.")) return false
    var incoming = templateToSections(t).map(function(sec){
      return { id:uidLocal(), title: sec.title, items: sec.items.map(function(it){ return { id:uidLocal(), text:it.text, done:false } }) }
    })
    savePackingSections(incoming)
    return true
  }

  // ── Itinerary — day-by-day shape, full-page detail view (Level 3 nav) ────
  // Same migration approach as packing: detailTrip.itinerary was a flat
  // {id,text,done} checklist; new shape is [{id,label,date,activities:
  // [{id,title,notes,time}]}], activities nested directly inside their day.
  function normalizeItineraryDays(raw) {
    var list = Array.isArray(raw) ? raw : []
    if (list.length > 0 && list[0] && list[0].activities === undefined && list[0].text !== undefined) {
      return [{ id:"legacy", label:"Day 1", date:null, activities: list.map(function(it){ return { id:it.id, title:it.text, notes:"", time:"" } }) }]
    }
    return list.map(function(d){
      return { id:d.id, label: d.label || "Day", date: d.date || null, activities:(d.activities||[]).map(function(a){ return { id:a.id, title:a.title||"", notes:a.notes||"", time:a.time||"" } }) }
    })
  }
  function itineraryDays() { return normalizeItineraryDays(detailTrip && detailTrip.itinerary) }
  function saveItineraryDays(days) { if (!detailTrip) return; updateTrip(detailTrip.id, { itinerary: days }) }
  // Auto-generation: one day per calendar day if both dates exist; 3 default
  // days from startDate alone if only that exists; empty (caller shows
  // "Add a day" only) if neither exists. Returns [] rather than writing
  // anything when there's nothing to generate from.
  function autoGenerateItineraryDays() {
    if (!detailTrip) return []
    var days = []
    if (detailTrip.startDate && detailTrip.endDate) {
      var start = new Date(detailTrip.startDate+"T00:00:00")
      var end = new Date(detailTrip.endDate+"T00:00:00")
      var cur = new Date(start)
      var dayNum = 1
      while (cur <= end && dayNum <= 60) { // sanity cap — a trip isn't 2 months of daily itinerary rows
        var iso = cur.toISOString().slice(0,10)
        days.push({ id:Date.now().toString()+"_"+dayNum, label:"Day "+dayNum+" — "+formatTripDate(iso), date: iso, activities:[] })
        cur.setDate(cur.getDate()+1)
        dayNum++
      }
    } else if (detailTrip.startDate) {
      var start2 = new Date(detailTrip.startDate+"T00:00:00")
      for (var i=0; i<3; i++) {
        var d = new Date(start2); d.setDate(d.getDate()+i)
        var iso2 = d.toISOString().slice(0,10)
        days.push({ id:Date.now().toString()+"_"+i, label:"Day "+(i+1)+" — "+formatTripDate(iso2), date: iso2, activities:[] })
      }
    }
    return days
  }
  function addItineraryDay() {
    saveItineraryDays([...itineraryDays(), { id:Date.now().toString(), label:"New day", date:null, activities:[] }])
  }
  function renameItineraryDay(dayId, label) {
    saveItineraryDays(itineraryDays().map(function(d){ return d.id===dayId ? Object.assign({},d,{label:label}) : d }))
  }
  function deleteItineraryDay(dayId) {
    if (!window.confirm("Delete this day and its activities?")) return
    saveItineraryDays(itineraryDays().filter(function(d){ return d.id!==dayId }))
  }
  function addItineraryActivity(dayId) {
    saveItineraryDays(itineraryDays().map(function(d){
      if (d.id!==dayId) return d
      return Object.assign({}, d, { activities:[...d.activities, { id:Date.now().toString(), title:"", notes:"", time:"" }] })
    }))
  }
  function updateItineraryActivity(dayId, actId, changes) {
    saveItineraryDays(itineraryDays().map(function(d){
      if (d.id!==dayId) return d
      return Object.assign({}, d, { activities: d.activities.map(function(a){ return a.id===actId ? Object.assign({},a,changes) : a }) })
    }))
  }
  function removeItineraryActivity(dayId, actId) {
    saveItineraryDays(itineraryDays().map(function(d){
      if (d.id!==dayId) return d
      return Object.assign({}, d, { activities: d.activities.filter(function(a){ return a.id!==actId }) })
    }))
  }
  // Generate-once-on-open: fires when the itinerary full-page view becomes
  // active and no days exist yet. Writes nothing if autoGenerateItineraryDays
  // returns [] (neither date set) — the empty state then shows "Add a day" only.
  useEffect(function(){
    if (activeTripCard !== "itinerary" || !detailTrip) return
    if (itineraryDays().length > 0) return
    var generated = autoGenerateItineraryDays()
    if (generated.length > 0) updateTrip(detailTrip.id, { itinerary: generated })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTripCard, detailTrip && detailTrip.id])

  // Notes full-page view: reset the local draft from the saved value each
  // time the view opens, then debounce-save 500ms after the draft actually
  // changes — not on mount/reset itself, so opening the view never fires a
  // spurious write when nothing was typed.
  useEffect(function(){
    if (activeTripCard !== "notes" || !detailTrip) return
    setNotesDraft(detailTrip.notes || "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTripCard, detailTrip && detailTrip.id])
  useEffect(function(){
    if (activeTripCard !== "notes" || !detailTrip) return
    if (notesDraft === (detailTrip.notes || "")) return
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current)
    notesDebounceRef.current = setTimeout(function(){
      updateTrip(detailTrip.id, { notes: notesDraft })
    }, 500)
    return function(){ if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesDraft])

  // Activities: was flat {id,text,done} — spec wants name/notes/date/done.
  // Same tolerate-old-shape-on-read approach as Packing/Itinerary: old
  // entries display with text promoted to name, notes/date default blank;
  // only ever written in the new shape once a mutator runs.
  function normalizeActivities(raw) {
    var list = Array.isArray(raw) ? raw : []
    return list.map(function(a){
      if (a.name !== undefined) return { id:a.id, name:a.name||"", notes:a.notes||"", date:a.date||"", done:!!a.done }
      return { id:a.id, name:a.text||"", notes:"", date:"", done:!!a.done }
    })
  }
  function activitiesList() { return normalizeActivities(detailTrip && detailTrip.activities) }
  function saveActivities(list) { if (!detailTrip) return; updateTrip(detailTrip.id, { activities: list }) }
  function addActivity() {
    saveActivities([...activitiesList(), { id:Date.now().toString(), name:"", notes:"", date:"", done:false }])
  }
  function updateActivity(id, changes) {
    saveActivities(activitiesList().map(function(a){ return a.id===id ? Object.assign({},a,changes) : a }))
  }
  function toggleActivity(id) {
    saveActivities(activitiesList().map(function(a){ return a.id===id ? Object.assign({},a,{done:!a.done}) : a }))
  }
  function removeActivity(id) {
    saveActivities(activitiesList().filter(function(a){ return a.id!==id }))
  }

  // Reservations: was flat {id,text,done} — spec wants name/type/date/time/
  // confirmationNumber/notes, sorted by date, no done/checkbox at all.
  function normalizeReservations(raw) {
    var list = Array.isArray(raw) ? raw : []
    return list.map(function(r){
      if (r.name !== undefined) return { id:r.id, name:r.name||"", type:r.type||"", date:r.date||"", time:r.time||"", confirmationNumber:r.confirmationNumber||"", notes:r.notes||"" }
      return { id:r.id, name:r.text||"", type:"", date:"", time:"", confirmationNumber:"", notes:"" }
    })
  }
  function reservationsList() {
    var list = normalizeReservations(detailTrip && detailTrip.reservations)
    // Sorted by date (blank dates last, stable relative order otherwise) —
    // .slice() first since .sort() mutates in place.
    return list.slice().sort(function(a,b){
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    })
  }
  function saveReservations(list) { if (!detailTrip) return; updateTrip(detailTrip.id, { reservations: list }) }
  function addReservation() {
    saveReservations([...normalizeReservations(detailTrip && detailTrip.reservations), { id:Date.now().toString(), name:"", type:"", date:"", time:"", confirmationNumber:"", notes:"" }])
  }
  function updateReservation(id, changes) {
    saveReservations(normalizeReservations(detailTrip && detailTrip.reservations).map(function(r){ return r.id===id ? Object.assign({},r,changes) : r }))
  }
  function removeReservation(id) {
    saveReservations(normalizeReservations(detailTrip && detailTrip.reservations).filter(function(r){ return r.id!==id }))
  }

  // Budget: estimated (planned) is unchanged. spent was a single running-
  // total number the user typed in directly — now an array of expense
  // records, per spec. Migration: an existing numeric spent value becomes
  // one expense entry (not discarded) so a trip's prior running total
  // isn't silently lost when the shape changes.
  var BUDGET_CATEGORIES = ["Food","Transport","Lodging","Activities","Shopping","Other"]
  function normalizeExpenses(budget) {
    var raw = (budget || {}).spent
    if (Array.isArray(raw)) {
      return raw.map(function(e){ return { id:e.id, description:e.description||"", amount:e.amount||"", category:e.category||"Other", date:e.date||"" } })
    }
    var legacy = parseFloat(raw)
    if (!isNaN(legacy) && legacy !== 0) {
      return [{ id:"legacy", description:"Previously recorded total", amount:legacy, category:"Other", date:"" }]
    }
    return []
  }
  function expensesTotal(expenses) {
    return expenses.reduce(function(sum, e){ var n = parseFloat(e.amount); return sum + (isNaN(n) ? 0 : n) }, 0)
  }
  function updateBudget(changes) {
    if (!detailTrip) return
    updateTrip(detailTrip.id, { budget: Object.assign({}, detailTrip.budget, changes) })
  }
  function saveExpenses(expenses) { updateBudget({ spent: expenses }) }
  function addExpense() {
    saveExpenses([...normalizeExpenses(detailTrip && detailTrip.budget), { id:Date.now().toString(), description:"", amount:"", category:"Other", date:"" }])
  }
  function updateExpense(id, changes) {
    saveExpenses(normalizeExpenses(detailTrip && detailTrip.budget).map(function(e){ return e.id===id ? Object.assign({},e,changes) : e }))
  }
  function removeExpense(id) {
    saveExpenses(normalizeExpenses(detailTrip && detailTrip.budget).filter(function(e){ return e.id!==id }))
  }

  // Documents: was flat {id,text,done} — spec wants name/type/expiryDate/
  // notes/confirmed. Deliberately does NOT re-collect passport numbers,
  // KTN, or any sensitive value already captured (masked) in
  // TravelProfileSection — this only tracks which documents are ready for
  // THIS trip.
  var DOCUMENT_TYPES = ["Passport","Visa","Insurance","Booking","Other"]
  function normalizeDocuments(raw) {
    var list = Array.isArray(raw) ? raw : []
    return list.map(function(d){
      if (d.name !== undefined) return { id:d.id, name:d.name||"", type:d.type||"", expiryDate:d.expiryDate||"", notes:d.notes||"", confirmed:!!d.confirmed }
      return { id:d.id, name:d.text||"", type:"", expiryDate:"", notes:"", confirmed:!!d.done }
    })
  }
  function documentsList() { return normalizeDocuments(detailTrip && detailTrip.documents) }
  function saveDocuments(list) { if (!detailTrip) return; updateTrip(detailTrip.id, { documents: list }) }
  function addDocument() {
    saveDocuments([...documentsList(), { id:Date.now().toString(), name:"", type:"", expiryDate:"", notes:"", confirmed:false }])
  }
  function updateDocument(id, changes) {
    saveDocuments(documentsList().map(function(d){ return d.id===id ? Object.assign({},d,changes) : d }))
  }
  function toggleDocument(id) {
    saveDocuments(documentsList().map(function(d){ return d.id===id ? Object.assign({},d,{confirmed:!d.confirmed}) : d }))
  }
  function removeDocument(id) {
    saveDocuments(documentsList().filter(function(d){ return d.id!==id }))
  }
  // Expiry warning: red if already expired, amber if expiring within 90
  // days — reuses the exact daysUntil() this component already defines
  // for trip countdown badges, not a new date-diffing implementation.
  function documentExpiryStatus(doc) {
    if (!doc.expiryDate) return null
    var d = daysUntil(doc.expiryDate)
    if (d === null) return null
    if (d < 0) return "expired"
    if (d <= 90) return "soon"
    return null
  }

  // Dining: was flat {id,text,done} — spec wants name/notes/mealType/visited.
  var MEAL_TYPES = ["Breakfast","Lunch","Dinner","Snack","Any"]
  function normalizeDining(raw) {
    var list = Array.isArray(raw) ? raw : []
    return list.map(function(d){
      if (d.name !== undefined) return { id:d.id, name:d.name||"", notes:d.notes||"", mealType:d.mealType||"Any", visited:!!d.visited }
      return { id:d.id, name:d.text||"", notes:"", mealType:"Any", visited:!!d.done }
    })
  }
  function diningList() { return normalizeDining(detailTrip && detailTrip.dining) }
  function saveDining(list) { if (!detailTrip) return; updateTrip(detailTrip.id, { dining: list }) }
  function addDiningSpot() {
    saveDining([...diningList(), { id:Date.now().toString(), name:"", notes:"", mealType:"Any", visited:false }])
  }
  function updateDiningSpot(id, changes) {
    saveDining(diningList().map(function(d){ return d.id===id ? Object.assign({},d,changes) : d }))
  }
  function toggleDiningSpot(id) {
    saveDining(diningList().map(function(d){ return d.id===id ? Object.assign({},d,{visited:!d.visited}) : d }))
  }
  function removeDiningSpot(id) {
    saveDining(diningList().filter(function(d){ return d.id!==id }))
  }

  // Emergency Info: household defaults from TravelProfileSection's
  // emergencyContacts ({ id, name, phone, relation } — confirmed against
  // the current file, not assumed from memory) are read live and shown
  // read-only; never written back to, so this can never mutate the
  // household list. Trip-specific contacts are ADDITIONS on top, stored in
  // trip.emergencyInfo with the same shape, full add/update/remove — a
  // non-destructive override in the sense that this trip can supplement
  // the household defaults without ever hiding or replacing them.
  function readHouseholdEmergencyContacts() {
    try {
      var s = localStorage.getItem("af_travel_profile")
      var parsed = s ? JSON.parse(s) : {}
      return Array.isArray(parsed.emergencyContacts) ? parsed.emergencyContacts : []
    } catch { return [] }
  }
  function addEmergencyContact() {
    if (!detailTrip) return
    var list = detailTrip.emergencyInfo || []
    updateTrip(detailTrip.id, { emergencyInfo: [...list, { id:Date.now().toString(), name:"", phone:"", relation:"" }] })
  }
  function updateEmergencyContact(id, changes) {
    if (!detailTrip) return
    var list = detailTrip.emergencyInfo || []
    updateTrip(detailTrip.id, { emergencyInfo: list.map(function(c){ return c.id===id ? Object.assign({},c,changes) : c }) })
  }
  function removeEmergencyContact(id) {
    if (!detailTrip) return
    var list = detailTrip.emergencyInfo || []
    updateTrip(detailTrip.id, { emergencyInfo: list.filter(function(c){ return c.id!==id }) })
  }

  // ── Hide/reorder — same native HTML5 drag-to-reorder mechanism as
  // InventorySection (~577-604: dragFrom ref + dragOverIdx state, onDragStart/
  // onDragOver/onDrop/onDragEnd), applied here to card ids instead of list
  // items. Persisted to trip.cardOrder.
  var s_manage = useState(false); var manageOpen = s_manage[0]; var setManageOpen = s_manage[1]
  var dragFromCard = React.useRef(null)
  var s_dragOverCard = useState(null); var dragOverCardIdx = s_dragOverCard[0]; var setDragOverCardIdx = s_dragOverCard[1]

  function onCardDragStart(e, idx) {
    dragFromCard.current = idx
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", String(idx))
  }
  function onCardDragOver(e, idx) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (idx !== dragOverCardIdx) setDragOverCardIdx(idx)
  }
  function onCardDrop(e, idx) {
    e.preventDefault()
    if (!detailTrip) return
    var from = dragFromCard.current
    if (from === null || from === idx) { setDragOverCardIdx(null); return }
    var visible = cardOrder.slice()
    var moved = visible.splice(from, 1)[0]
    visible.splice(idx, 0, moved)
    // Preserve any currently-unavailable id still sitting in raw storage (e.g. "photos"
    // saved during an earlier Completed period) — a reorder must never silently drop it.
    var rawOrder = (detailTrip.cardOrder && detailTrip.cardOrder.length) ? detailTrip.cardOrder : DEFAULT_CARD_ORDER
    var preserved = rawOrder.filter(function(id){ return visible.indexOf(id)===-1 && availableCardIds.indexOf(id)===-1 })
    updateTrip(detailTrip.id, { cardOrder: visible.concat(preserved) })
    dragFromCard.current = null
    setDragOverCardIdx(null)
  }
  function onCardDragEnd() {
    dragFromCard.current = null
    setDragOverCardIdx(null)
  }
  function toggleCardVisible(id) {
    if (!detailTrip) return
    var order = (detailTrip.cardOrder && detailTrip.cardOrder.length ? detailTrip.cardOrder : DEFAULT_CARD_ORDER).slice()
    var idx = order.indexOf(id)
    if (idx === -1) order.push(id)
    else order.splice(idx, 1)
    updateTrip(detailTrip.id, { cardOrder: order })
  }

  // Photos only makes sense once a trip is actually over — gated on the
  // real TRIP_STATUSES value "Completed" (not the lowercase "completed"
  // literally written in the spec, which would never match and leave the
  // card permanently unreachable).
  var availableCardIds = DEFAULT_CARD_ORDER.filter(function(id){ return id!=="photos" || (detailTrip && detailTrip.status==="Completed") })
  var cardOrder = detailTrip ? (detailTrip.cardOrder && detailTrip.cardOrder.length ? detailTrip.cardOrder.filter(function(id){ return availableCardIds.indexOf(id)!==-1 }) : availableCardIds) : []
  var hiddenCardIds = availableCardIds.filter(function(id){ return cardOrder.indexOf(id)===-1 })

  // Dispatch table, id -> render function. Built fresh each render so every
  // function closes over the current detailTrip/mutators — cheap, and keeps
  // each card's JSX exactly as authored in Steps 4a/4b (only wrapped, not
  // rewritten) plus the 7 new Step 4c cards alongside them.
  var CARD_RENDERERS = detailTrip ? {
    transportation: function(){
      var trList = detailTrip.transportation||[]
      var trFirst = trList[0]
      var trPreview = trList.length===0 ? "No transportation added yet." :
        (trFirst.carrier||trFirst.type||"Trip added")+(trFirst.departure?" · "+trFirst.departure:"")+(trList.length>1?" +"+(trList.length-1)+" more":"")
      return (
        <TripCardTile key="transportation" icon={CARD_META.transportation.icon} title={CARD_META.transportation.title} accent={CARD_META.transportation.accent} preview={trPreview} onClick={function(){ setActiveTripCard("transportation") }}/>
      )
    },
    lodging: function(){
      var lgList = detailTrip.lodging||[]
      var lgFirst = lgList[0]
      var lgPreview = lgList.length===0 ? "No lodging added yet." :
        (lgFirst.name||"Lodging added")+(lgList.length>1?" +"+(lgList.length-1)+" more":"")
      return (
        <TripCardTile key="lodging" icon={CARD_META.lodging.icon} title={CARD_META.lodging.title} accent={CARD_META.lodging.accent} preview={lgPreview} onClick={function(){ setActiveTripCard("lodging") }}/>
      )
    },
    packing: function(){
      var sections = normalizePackingSections(detailTrip.packing)
      var allItems = sections.reduce(function(acc,s){ return acc.concat(s.items) }, [])
      var packPreview = allItems.length===0 ? "No packing items added yet." : allItems.filter(function(i){return i.done}).length+"/"+allItems.length+" packed"
      return (
        <TripCardTile key="packing" icon={CARD_META.packing.icon} title={CARD_META.packing.title} accent={CARD_META.packing.accent} preview={packPreview} onClick={function(){ setActiveTripCard("packing") }}/>
      )
    },
    itinerary: function(){
      var days = normalizeItineraryDays(detailTrip.itinerary)
      var allActs = days.reduce(function(acc,d){ return acc.concat(d.activities) }, [])
      var itinPreview = days.length===0 ? "No itinerary yet." : days.length+" day"+(days.length===1?"":"s")+" · "+allActs.length+" activit"+(allActs.length===1?"y":"ies")
      return (
        <TripCardTile key="itinerary" icon={CARD_META.itinerary.icon} title={CARD_META.itinerary.title} accent={CARD_META.itinerary.accent} preview={itinPreview} onClick={function(){ setActiveTripCard("itinerary") }}/>
      )
    },
    activities: function(){
      var actList = normalizeActivities(detailTrip.activities)
      var actPreview = actList.length===0 ? "No activities added yet." : actList.filter(function(i){return i.done}).length+"/"+actList.length+" done"
      return (
        <TripCardTile key="activities" icon={CARD_META.activities.icon} title={CARD_META.activities.title} accent={CARD_META.activities.accent} preview={actPreview} onClick={function(){ setActiveTripCard("activities") }}/>
      )
    },
    reservations: function(){
      var resList = normalizeReservations(detailTrip.reservations)
      var resPreview = resList.length===0 ? "No reservations added yet." : resList.length+(resList.length===1?" reservation":" reservations")
      return (
        <TripCardTile key="reservations" icon={CARD_META.reservations.icon} title={CARD_META.reservations.title} accent={CARD_META.reservations.accent} preview={resPreview} onClick={function(){ setActiveTripCard("reservations") }}/>
      )
    },
    budget: function(){
      var b = detailTrip.budget || {}
      var est = parseFloat(b.estimated)
      var expenses = normalizeExpenses(b)
      var spentTotal = expensesTotal(expenses)
      var remaining = !isNaN(est) ? (est - spentTotal) : null
      var budgetPreview = remaining===null ? "No budget set yet." : "$"+spentTotal.toLocaleString()+" of $"+est.toLocaleString()+" planned"
      var budgetPreviewColor = remaining!==null && remaining<0 ? "#e07070" : undefined
      return (
        <TripCardTile key="budget" icon={CARD_META.budget.icon} title={CARD_META.budget.title} accent={CARD_META.budget.accent} preview={budgetPreview} previewColor={budgetPreviewColor} onClick={function(){ setActiveTripCard("budget") }}/>
      )
    },
    documents: function(){
      var docList = normalizeDocuments(detailTrip.documents)
      var warnCount = docList.filter(function(d){ return documentExpiryStatus(d)!==null }).length
      var docPreview = docList.length===0 ? "No documents added yet." : docList.filter(function(i){return i.confirmed}).length+"/"+docList.length+" ready"+(warnCount>0?" · ⚠️ "+warnCount+" expiring soon":"")
      return (
        <TripCardTile key="documents" icon={CARD_META.documents.icon} title={CARD_META.documents.title} accent={CARD_META.documents.accent} preview={docPreview} previewColor={warnCount>0?"#e0937a":undefined} onClick={function(){ setActiveTripCard("documents") }}/>
      )
    },
    dining: function(){
      var dineList = normalizeDining(detailTrip.dining)
      var dinePreview = dineList.length===0 ? "No dining spots added yet." : dineList.filter(function(i){return i.visited}).length+"/"+dineList.length+" visited"
      return (
        <TripCardTile key="dining" icon={CARD_META.dining.icon} title={CARD_META.dining.title} accent={CARD_META.dining.accent} preview={dinePreview} onClick={function(){ setActiveTripCard("dining") }}/>
      )
    },
    weather: function(){
      var weatherLine = (detailTrip.weather||"").split("\n")[0].trim()
      var weatherPreview = weatherLine ? (weatherLine.length>60?weatherLine.slice(0,60)+"…":weatherLine) : "No forecast noted yet."
      return (
        <TripCard key="weather" icon={CARD_META.weather.icon} title={CARD_META.weather.title} accent={CARD_META.weather.accent} defaultOpen={false} preview={weatherPreview}>
          <div style={{ paddingTop:10 }}>
            <div style={{ fontSize:11, color:"rgba(250,248,244,0.3)", fontFamily:"DM Sans,sans-serif", marginBottom:10, fontStyle:"italic" }}>No live forecast yet — this is just a place to jot expectations for packing purposes.</div>
            <textarea value={detailTrip.weather||""} onChange={function(e){ updateTrip(detailTrip.id,{weather:e.target.value}) }} placeholder="e.g. Highs near 85°F, chance of afternoon rain — pack a light rain jacket" rows={3} style={Object.assign({},inputStyle,{resize:"vertical"})}/>
          </div>
        </TripCard>
      )
    },
    notes: function(){
      var notesLine = (detailTrip.notes||"").split("\n")[0].trim()
      var notesPreview = notesLine ? (notesLine.length>60?notesLine.slice(0,60)+"…":notesLine) : "No notes yet."
      return (
        <TripCardTile key="notes" icon={CARD_META.notes.icon} title={CARD_META.notes.title} accent={CARD_META.notes.accent} preview={notesPreview} onClick={function(){ setActiveTripCard("notes") }}/>
      )
    },
    emergencyInfo: function(){
      var householdContacts = readHouseholdEmergencyContacts()
      var tripContacts = detailTrip.emergencyInfo || []
      var contactTotal = householdContacts.length + tripContacts.length
      var emergencyPreview = contactTotal===0 ? "No emergency contacts added yet." : contactTotal+" contact"+(contactTotal===1?"":"s")+" on file"
      return (
        <TripCardTile key="emergencyInfo" icon={CARD_META.emergencyInfo.icon} title={CARD_META.emergencyInfo.title} accent={CARD_META.emergencyInfo.accent} preview={emergencyPreview} onClick={function(){ setActiveTripCard("emergencyInfo") }}/>
      )
    },
    photos: function(){
      if (detailTrip.status !== "Completed") return null
      return (
        <TripCard key="photos" icon={CARD_META.photos.icon} title={CARD_META.photos.title} accent={CARD_META.photos.accent} defaultOpen={false} preview="No photos yet — coming soon.">
          <div style={{ paddingTop:10, textAlign:"center", padding:"20px 10px" }}>
            <div style={{ fontSize:24, marginBottom:8 }}>📷</div>
            <div style={{ fontSize:12, color:"rgba(250,248,244,0.3)", fontFamily:"DM Sans,sans-serif", fontStyle:"italic" }}>No photos yet — a place to hold memories from this trip is coming soon.</div>
          </div>
        </TripCard>
      )
    }
  } : {}

  return (
    <div>
      {detailTrip ? (
        <div>
          {activeTripCard ? (
            // ── Level 3: full-page card detail view ──────────────────────────
            <div>
              <button onClick={function(){ setActiveTripCard(null) }} style={{ background:"none", border:"none", color:"rgba(200,169,122,0.7)", cursor:"pointer", fontSize:13, fontFamily:"DM Sans,sans-serif", padding:"0 0 16px 0", display:"flex", alignItems:"center", gap:5 }}>← Back to {detailTrip.name || "trip"}</button>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:(CARD_META[activeTripCard]||{}).accent||sand, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{(CARD_META[activeTripCard]||{}).icon}</div>
                <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:22, fontWeight:700, color:warm }}>{(CARD_META[activeTripCard]||{}).title}</div>
              </div>

              {activeTripCard === "packing" && (function(){
                var sections = normalizePackingSections(detailTrip.packing)
                var allItems = sections.reduce(function(acc,s){ return acc.concat(s.items) }, [])
                return (
                  <div>
                    <div style={{ fontSize:13, color:muted, fontFamily:"DM Sans,sans-serif", marginBottom:10 }}>{allItems.filter(function(i){return i.done}).length} of {allItems.length} packed</div>
                    <button onClick={function(){ setImportOpen(true) }} style={{ background:"rgba(200,169,122,0.1)", border:"1px solid rgba(200,169,122,0.25)", borderRadius:7, padding:"5px 12px", fontSize:11, color:sand, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, marginBottom:12, display:"block" }}>📥 Import list</button>
                    {sections.length === 0 && readAlwaysBring().length > 0 && (
                      <button onClick={copyAlwaysBring} style={{ background:"rgba(160,122,181,0.12)", border:"1px solid rgba(160,122,181,0.3)", borderRadius:7, padding:"5px 12px", fontSize:11, color:"#a07ab5", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, marginBottom:12, display:"block" }}>📋 Copy from Always Bring ({readAlwaysBring().length})</button>
                    )}
                    {sections.length === 0 && (
                      <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif", marginBottom:12 }}>No packing sections yet.</div>
                    )}
                    {sections.map(function(sec){
                      var open = !collapsedPackingSections[sec.id]
                      return (
                        <div key={sec.id} style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, marginBottom:12, overflow:"hidden" }}>
                          <div onClick={function(){ setCollapsedPackingSections(function(p){ return Object.assign({},p,{[sec.id]:!p[sec.id]}) }) }} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", cursor:"pointer" }}>
                            <input value={sec.title} onClick={function(e){ e.stopPropagation() }} onChange={function(e){ renamePackingSection(sec.id, e.target.value) }} style={{ flex:1, fontSize:14, fontWeight:700, color:warm, background:"transparent", border:"none", outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
                            <span style={{ fontSize:11, color:muted, flexShrink:0 }}>{sec.items.filter(function(i){return i.done}).length}/{sec.items.length}</span>
                            <button onClick={function(e){ e.stopPropagation(); deletePackingSection(sec.id) }} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:12, flexShrink:0 }}>✕</button>
                            <span style={{ fontSize:10, color:muted, transform:open?"rotate(180deg)":"none", transition:"transform 0.2s", flexShrink:0 }}>▾</span>
                          </div>
                          {open && (
                            <div style={{ padding:"0 12px 12px" }}>
                              {sec.items.length === 0 && (
                                <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif", marginBottom:8 }}>No items in this section yet.</div>
                              )}
                              {sec.items.map(function(item){
                                return (
                                  <div key={item.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", borderBottom:"1px solid rgba(250,242,229,0.04)" }}>
                                    <div onClick={function(){ togglePackingItem(sec.id, item.id) }} style={{ width:16, height:16, borderRadius:4, border:"1.5px solid "+(item.done?"#a07ab5":"rgba(250,242,229,0.2)"), background:item.done?"#a07ab5":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer" }}>
                                      {item.done ? <span style={{color:"#fff",fontSize:10}}>✓</span> : null}
                                    </div>
                                    <span style={{ flex:1, fontSize:13, color:item.done?"rgba(250,248,244,0.35)":"rgba(250,248,244,0.8)", fontFamily:"DM Sans,sans-serif", textDecoration:item.done?"line-through":"none" }}>{item.text}</span>
                                    <button onClick={function(){ removePackingItem(sec.id, item.id) }} style={{ background:"none", border:"none", fontSize:11, color:"rgba(250,248,244,0.2)", cursor:"pointer", padding:"0 2px" }}>✕</button>
                                  </div>
                                )
                              })}
                              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                                <input value={packItemDrafts[sec.id]||""} onChange={function(e){ var v=e.target.value; setPackItemDrafts(function(p){ return Object.assign({},p,{[sec.id]:v}) }) }} onKeyDown={function(e){ if(e.key==="Enter"){ addPackingItemToSection(sec.id, packItemDrafts[sec.id]||""); setPackItemDrafts(function(p){ return Object.assign({},p,{[sec.id]:""}) }) } }} placeholder="Add an item…" style={Object.assign({},inputStyle,{flex:1})}/>
                                <button onClick={function(){ addPackingItemToSection(sec.id, packItemDrafts[sec.id]||""); setPackItemDrafts(function(p){ return Object.assign({},p,{[sec.id]:""}) }) }} style={{ background:"rgba(160,122,181,0.15)", border:"1px solid rgba(160,122,181,0.3)", borderRadius:8, padding:"0 14px", color:"#a07ab5", fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontWeight:600 }}>Add</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div style={{ display:"flex", gap:8, marginTop:8 }}>
                      <input value={newPackingSectionTitle} onChange={function(e){ setNewPackingSectionTitle(e.target.value) }} onKeyDown={function(e){ if(e.key==="Enter"){ addPackingSection(newPackingSectionTitle); setNewPackingSectionTitle("") } }} placeholder="New section name…" style={Object.assign({},inputStyle,{flex:1})}/>
                      <button onClick={function(){ addPackingSection(newPackingSectionTitle); setNewPackingSectionTitle("") }} style={{ background:"rgba(200,169,122,0.15)", border:"1px solid rgba(200,169,122,0.3)", borderRadius:8, padding:"0 14px", color:sand, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontWeight:600 }}>+ Section</button>
                    </div>
                  </div>
                )
              })()}

              {importOpen && (
                // Same bottom-sheet modal shape as formTrip's edit modal (~4477).
                <div style={{ position:"fixed", inset:0, background:"rgba(15,26,42,0.72)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={function(){ setImportOpen(false); setImportSelectedTemplate(null) }}>
                  <div onClick={function(e){ e.stopPropagation() }} style={{ background:"#1a2744", borderRadius:"18px 18px 0 0", padding:20, paddingBottom:"calc(20px + env(safe-area-inset-bottom,0px))", width:"min(480px,100%)", maxHeight:"calc(88dvh - env(safe-area-inset-top,0px))", overflowY:"auto", boxSizing:"border-box" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                      <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:19, fontWeight:700, color:warm }}>{importSelectedTemplate ? importSelectedTemplate.name : "Import packing list"}</div>
                      <button onClick={function(){ setImportOpen(false); setImportSelectedTemplate(null) }} style={{ background:"none", border:"none", color:"rgba(250,248,244,0.4)", cursor:"pointer", fontSize:18 }}>✕</button>
                    </div>
                    {!importSelectedTemplate ? (
                      <div>
                        {readPackingTemplates().length === 0 ? (
                          <div style={{ fontSize:13, color:muted, fontStyle:"italic", fontFamily:"DM Sans,sans-serif", padding:"12px 0" }}>No saved packing lists yet — you can save a packing list as a template from the Travel Profile section.</div>
                        ) : (
                          readPackingTemplates().map(function(t){
                            return (
                              <button key={t.id} onClick={function(){ setImportSelectedTemplate(t) }} style={{ width:"100%", textAlign:"left", background:"rgba(250,242,229,0.04)", border:"1px solid rgba(250,242,229,0.1)", borderRadius:10, padding:"10px 14px", marginBottom:8, color:warm, fontSize:14, fontFamily:"DM Sans,sans-serif", cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}>
                                <span>{t.emoji||"🧳"}</span><span>{t.name}</span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize:13, color:muted, fontFamily:"DM Sans,sans-serif", marginBottom:16 }}>How do you want to import "{importSelectedTemplate.name}"?</div>
                        <button onClick={function(){ importTemplateMerge(importSelectedTemplate); setImportOpen(false); setImportSelectedTemplate(null) }} style={{ width:"100%", background:"rgba(160,122,181,0.15)", border:"1px solid rgba(160,122,181,0.3)", borderRadius:10, padding:"10px 14px", color:"#a07ab5", fontSize:13, fontWeight:600, fontFamily:"DM Sans,sans-serif", cursor:"pointer", marginBottom:8 }}>Merge with current list</button>
                        <button onClick={function(){ if (importTemplateReplace(importSelectedTemplate)) { setImportOpen(false); setImportSelectedTemplate(null) } }} style={{ width:"100%", background:"rgba(226,75,74,0.08)", border:"1px solid rgba(226,75,74,0.25)", borderRadius:10, padding:"10px 14px", color:"rgba(240,153,123,0.9)", fontSize:13, fontWeight:600, fontFamily:"DM Sans,sans-serif", cursor:"pointer", marginBottom:8 }}>Replace current list</button>
                        <button onClick={function(){ setImportSelectedTemplate(null) }} style={{ width:"100%", background:"none", border:"none", color:muted, fontSize:12, fontFamily:"DM Sans,sans-serif", cursor:"pointer", padding:"6px 0" }}>← Choose a different list</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTripCard === "itinerary" && (function(){
                var days = normalizeItineraryDays(detailTrip.itinerary)
                return (
                  <div>
                    {days.length === 0 && (
                      <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif", marginBottom:12 }}>No days added yet.</div>
                    )}
                    {days.map(function(day){
                      var open = !collapsedItineraryDays[day.id]
                      return (
                        <div key={day.id} style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, marginBottom:12, overflow:"hidden" }}>
                          <div onClick={function(){ setCollapsedItineraryDays(function(p){ return Object.assign({},p,{[day.id]:!p[day.id]}) }) }} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", cursor:"pointer" }}>
                            <input value={day.label} onClick={function(e){ e.stopPropagation() }} onChange={function(e){ renameItineraryDay(day.id, e.target.value) }} style={{ flex:1, fontSize:14, fontWeight:700, color:warm, background:"transparent", border:"none", outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
                            <span style={{ fontSize:11, color:muted, flexShrink:0 }}>{day.activities.length} {day.activities.length===1?"activity":"activities"}</span>
                            <button onClick={function(e){ e.stopPropagation(); deleteItineraryDay(day.id) }} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:12, flexShrink:0 }}>✕</button>
                            <span style={{ fontSize:10, color:muted, transform:open?"rotate(180deg)":"none", transition:"transform 0.2s", flexShrink:0 }}>▾</span>
                          </div>
                          {open && (
                            <div style={{ padding:"0 12px 12px" }}>
                              {day.activities.length === 0 && (
                                <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif", marginBottom:8 }}>No activities yet.</div>
                              )}
                              {day.activities.map(function(act){
                                return (
                                  <div key={act.id} style={{ background:"rgba(250,242,229,0.03)", borderRadius:9, padding:"10px 12px", marginBottom:8 }}>
                                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                      <div style={{ display:"flex", gap:8 }}>
                                        <div style={{ flex:2 }}>
                                          <label style={labelStyle}>Activity</label>
                                          <input value={act.title} onChange={function(e){ updateItineraryActivity(day.id, act.id, {title:e.target.value}) }} placeholder="e.g. Dinner at 7" style={inputStyle}/>
                                        </div>
                                        <div style={{ flex:1 }}>
                                          <label style={labelStyle}>Time</label>
                                          <input value={act.time} onChange={function(e){ updateItineraryActivity(day.id, act.id, {time:e.target.value}) }} placeholder="Optional" style={inputStyle}/>
                                        </div>
                                      </div>
                                      <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                                        <div style={{ flex:1 }}>
                                          <label style={labelStyle}>Notes</label>
                                          <input value={act.notes} onChange={function(e){ updateItineraryActivity(day.id, act.id, {notes:e.target.value}) }} placeholder="Optional" style={inputStyle}/>
                                        </div>
                                        <button onClick={function(){ removeItineraryActivity(day.id, act.id) }} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginBottom:9 }}>remove</button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                              <button onClick={function(){ addItineraryActivity(day.id) }} style={{ background:"rgba(217,138,110,0.15)", border:"1px solid rgba(217,138,110,0.3)", borderRadius:8, padding:"5px 12px", color:"#d98a6e", fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontWeight:600 }}>+ Add activity</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <button onClick={addItineraryDay} style={{ background:"rgba(200,169,122,0.15)", border:"1px solid rgba(200,169,122,0.3)", borderRadius:8, padding:"6px 14px", color:sand, fontSize:12, cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontWeight:600 }}>+ Add a day</button>
                  </div>
                )
              })()}

              {activeTripCard === "transportation" && (
                <div>
                  <button onClick={addTransportation} style={{ background:"rgba(122,168,200,0.12)", border:"1px solid rgba(122,168,200,0.3)", borderRadius:7, padding:"5px 12px", fontSize:11, color:"#7aa8c8", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, marginBottom:12 }}>+ Add transportation</button>
                  {(detailTrip.transportation||[]).length === 0 && (
                    <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No transportation added yet</div>
                  )}
                  {(detailTrip.transportation||[]).map(function(tr) {
                    return (
                      <div key={tr.id} style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                          <span style={{ fontSize:18 }}>{TRANSPORT_TYPE_ICONS[tr.type]||"🧳"}</span>
                          <span style={{ fontSize:14, fontWeight:700, color:warm, fontFamily:"DM Sans,sans-serif" }}>{tr.carrier || tr.type || "Untitled leg"}</span>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                          <div style={{ display:"flex", gap:8 }}>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Type</label>
                              <select value={tr.type||""} onChange={function(e){ updateTransportation(tr.id,{type:e.target.value}) }} style={Object.assign({},inputStyle,{WebkitAppearance:"none",appearance:"none",color:tr.type?warm:"rgba(250,248,244,0.3)"})}>
                                <option value="" style={{background:navy}}>Select type…</option>
                                {TRANSPORT_TYPES.map(function(t){ return <option key={t} value={t} style={{background:navy}}>{t}</option> })}
                              </select>
                            </div>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Carrier</label>
                              <input value={tr.carrier||""} onChange={function(e){ updateTransportation(tr.id,{carrier:e.target.value}) }} placeholder="e.g. United Airlines" style={inputStyle}/>
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>Confirmation number</label>
                            <input value={tr.confirmationNumber||""} onChange={function(e){ updateTransportation(tr.id,{confirmationNumber:e.target.value}) }} placeholder="Confirmation #" style={inputStyle}/>
                          </div>
                          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Departure</label>
                              <input value={tr.departure||""} onChange={function(e){ updateTransportation(tr.id,{departure:e.target.value}) }} placeholder="e.g. Aug 10, 6:45 AM" style={inputStyle}/>
                            </div>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Arrival</label>
                              <input value={tr.arrival||""} onChange={function(e){ updateTransportation(tr.id,{arrival:e.target.value}) }} placeholder="e.g. Aug 10, 9:20 AM" style={inputStyle}/>
                            </div>
                            <button onClick={function(){ if(window.confirm("Remove this leg?")) removeTransportation(tr.id) }} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginBottom:9 }}>remove</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeTripCard === "lodging" && (
                <div>
                  <button onClick={addLodging} style={{ background:"rgba(122,158,142,0.12)", border:"1px solid rgba(122,158,142,0.3)", borderRadius:7, padding:"5px 12px", fontSize:11, color:"#7a9e8e", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, marginBottom:12 }}>+ Add lodging</button>
                  {(detailTrip.lodging||[]).length === 0 && (
                    <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No lodging added yet</div>
                  )}
                  {(detailTrip.lodging||[]).map(function(lg) {
                    return (
                      <div key={lg.id} style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                          <div>
                            <label style={labelStyle}>Name</label>
                            <input value={lg.name||""} onChange={function(e){ updateLodging(lg.id,{name:e.target.value}) }} placeholder="e.g. Beachside Resort" style={inputStyle}/>
                          </div>
                          <div>
                            <label style={labelStyle}>Address</label>
                            <input value={lg.address||""} onChange={function(e){ updateLodging(lg.id,{address:e.target.value}) }} style={inputStyle}/>
                          </div>
                          <div>
                            <label style={labelStyle}>Confirmation number</label>
                            <input value={lg.confirmationNumber||""} onChange={function(e){ updateLodging(lg.id,{confirmationNumber:e.target.value}) }} placeholder="Confirmation #" style={inputStyle}/>
                          </div>
                          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Check-in</label>
                              <input type="date" value={lg.checkIn||""} onChange={function(e){ updateLodging(lg.id,{checkIn:e.target.value}) }} style={inputStyle}/>
                            </div>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Check-out</label>
                              <input type="date" value={lg.checkOut||""} onChange={function(e){ updateLodging(lg.id,{checkOut:e.target.value}) }} style={inputStyle}/>
                            </div>
                            <button onClick={function(){ if(window.confirm("Remove this stay?")) removeLodging(lg.id) }} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginBottom:9 }}>remove</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeTripCard === "reservations" && (
                <div>
                  <button onClick={addReservation} style={{ background:"rgba(142,142,181,0.15)", border:"1px solid rgba(142,142,181,0.3)", borderRadius:7, padding:"5px 12px", fontSize:11, color:"#8e8eb5", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, marginBottom:12 }}>+ Add reservation</button>
                  {reservationsList().length === 0 && (
                    <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No reservations added yet</div>
                  )}
                  {reservationsList().map(function(r) {
                    return (
                      <div key={r.id} style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                          <div style={{ display:"flex", gap:8 }}>
                            <div style={{ flex:2 }}>
                              <label style={labelStyle}>Name</label>
                              <input value={r.name||""} onChange={function(e){ updateReservation(r.id,{name:e.target.value}) }} placeholder="e.g. Coastal Table" style={inputStyle}/>
                            </div>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Type</label>
                              <input value={r.type||""} onChange={function(e){ updateReservation(r.id,{type:e.target.value}) }} placeholder="e.g. Restaurant" style={inputStyle}/>
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:8 }}>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Date</label>
                              <input type="date" value={r.date||""} onChange={function(e){ updateReservation(r.id,{date:e.target.value}) }} style={inputStyle}/>
                            </div>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Time</label>
                              <input value={r.time||""} onChange={function(e){ updateReservation(r.id,{time:e.target.value}) }} placeholder="e.g. 7:00 PM" style={inputStyle}/>
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>Confirmation number</label>
                            <input value={r.confirmationNumber||""} onChange={function(e){ updateReservation(r.id,{confirmationNumber:e.target.value}) }} placeholder="Confirmation #" style={inputStyle}/>
                          </div>
                          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Notes</label>
                              <input value={r.notes||""} onChange={function(e){ updateReservation(r.id,{notes:e.target.value}) }} placeholder="Optional" style={inputStyle}/>
                            </div>
                            <button onClick={function(){ if(window.confirm("Remove this reservation?")) removeReservation(r.id) }} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginBottom:9 }}>remove</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeTripCard === "activities" && (
                <div>
                  <button onClick={addActivity} style={{ background:"rgba(106,181,160,0.15)", border:"1px solid rgba(106,181,160,0.3)", borderRadius:7, padding:"5px 12px", fontSize:11, color:"#6ab5a0", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, marginBottom:12 }}>+ Add activity</button>
                  {activitiesList().length === 0 && (
                    <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No activities added yet</div>
                  )}
                  {activitiesList().map(function(a) {
                    return (
                      <div key={a.id} style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                          <div onClick={function(){ toggleActivity(a.id) }} style={{ width:20, height:20, borderRadius:5, border:"1.5px solid "+(a.done?"#6ab5a0":"rgba(250,242,229,0.2)"), background:a.done?"#6ab5a0":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer", marginTop:16 }}>
                            {a.done ? <span style={{color:"#fff",fontSize:11}}>✓</span> : null}
                          </div>
                          <div style={{ flex:2 }}>
                            <label style={labelStyle}>Activity</label>
                            <input value={a.name} onChange={function(e){ updateActivity(a.id,{name:e.target.value}) }} placeholder="e.g. Snorkeling tour" style={Object.assign({},inputStyle,{textDecoration:a.done?"line-through":"none"})}/>
                          </div>
                          <div style={{ flex:1 }}>
                            <label style={labelStyle}>Date</label>
                            <input type="date" value={a.date} onChange={function(e){ updateActivity(a.id,{date:e.target.value}) }} style={inputStyle}/>
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                          <div style={{ flex:1 }}>
                            <label style={labelStyle}>Notes</label>
                            <input value={a.notes} onChange={function(e){ updateActivity(a.id,{notes:e.target.value}) }} placeholder="Optional" style={inputStyle}/>
                          </div>
                          <button onClick={function(){ if(window.confirm("Remove this activity?")) removeActivity(a.id) }} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginBottom:9 }}>remove</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeTripCard === "dining" && (
                <div>
                  <button onClick={addDiningSpot} style={{ background:"rgba(181,133,106,0.15)", border:"1px solid rgba(181,133,106,0.3)", borderRadius:7, padding:"5px 12px", fontSize:11, color:"#b5856a", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, marginBottom:12 }}>+ Add dining spot</button>
                  {diningList().length === 0 && (
                    <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No dining spots added yet</div>
                  )}
                  {diningList().map(function(d) {
                    return (
                      <div key={d.id} style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                          <div onClick={function(){ toggleDiningSpot(d.id) }} style={{ width:20, height:20, borderRadius:5, border:"1.5px solid "+(d.visited?"#b5856a":"rgba(250,242,229,0.2)"), background:d.visited?"#b5856a":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer", marginTop:16 }}>
                            {d.visited ? <span style={{color:"#fff",fontSize:11}}>✓</span> : null}
                          </div>
                          <div style={{ flex:2 }}>
                            <label style={labelStyle}>Name</label>
                            <input value={d.name} onChange={function(e){ updateDiningSpot(d.id,{name:e.target.value}) }} placeholder="e.g. The crab shack on the pier" style={Object.assign({},inputStyle,{textDecoration:d.visited?"line-through":"none"})}/>
                          </div>
                          <div style={{ flex:1 }}>
                            <label style={labelStyle}>Meal</label>
                            <select value={d.mealType||"Any"} onChange={function(e){ updateDiningSpot(d.id,{mealType:e.target.value}) }} style={Object.assign({},inputStyle,{WebkitAppearance:"none",appearance:"none"})}>
                              {MEAL_TYPES.map(function(m){ return <option key={m} value={m} style={{background:navy}}>{m}</option> })}
                            </select>
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                          <div style={{ flex:1 }}>
                            <label style={labelStyle}>Notes</label>
                            <input value={d.notes} onChange={function(e){ updateDiningSpot(d.id,{notes:e.target.value}) }} placeholder="Optional" style={inputStyle}/>
                          </div>
                          <button onClick={function(){ if(window.confirm("Remove this dining spot?")) removeDiningSpot(d.id) }} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginBottom:9 }}>remove</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeTripCard === "budget" && (function(){
                var b = detailTrip.budget || {}
                var est = parseFloat(b.estimated)
                var expenses = normalizeExpenses(b)
                var spentTotal = expensesTotal(expenses)
                var hasBudget = !isNaN(est) && est > 0
                var pct = hasBudget ? Math.min(100, Math.round((spentTotal/est)*100)) : 0
                var over = hasBudget && spentTotal > est
                return (
                  <div>
                    <div style={{ marginBottom:16 }}>
                      <label style={labelStyle}>Planned budget</label>
                      <input value={b.estimated||""} onChange={function(e){ updateBudget({estimated:e.target.value}) }} placeholder="e.g. 2000" style={inputStyle}/>
                    </div>
                    {!hasBudget && (
                      <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif", marginBottom:16 }}>Set a budget to track spending against it.</div>
                    )}
                    {hasBudget && (
                      <div style={{ marginBottom:16 }}>
                        <div style={{ fontSize:13, color: over?"#e07070":warm, fontFamily:"DM Sans,sans-serif", marginBottom:6 }}>
                          ${spentTotal.toLocaleString()} of ${est.toLocaleString()} planned
                        </div>
                        <div style={{ height:8, background:"rgba(250,242,229,0.08)", borderRadius:4, overflow:"hidden" }}>
                          <div style={{ width:pct+"%", height:"100%", background: over?"#e07070":"#e0937a", transition:"width 0.2s" }}/>
                        </div>
                        {over && <div style={{ fontSize:11, color:"#e07070", fontFamily:"DM Sans,sans-serif", marginTop:6 }}>Over by ${(spentTotal-est).toLocaleString()}</div>}
                      </div>
                    )}
                    <button onClick={addExpense} style={{ background:"rgba(224,147,122,0.15)", border:"1px solid rgba(224,147,122,0.3)", borderRadius:7, padding:"5px 12px", fontSize:11, color:"#e0937a", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, marginBottom:12 }}>+ Add expense</button>
                    {expenses.length === 0 && (
                      <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No expenses logged yet</div>
                    )}
                    {expenses.map(function(e){
                      return (
                        <div key={e.id} style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                            <div style={{ flex:2 }}>
                              <label style={labelStyle}>Description</label>
                              <input value={e.description||""} onChange={function(ev){ updateExpense(e.id,{description:ev.target.value}) }} placeholder="e.g. Groceries" style={inputStyle}/>
                            </div>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Amount</label>
                              <input value={e.amount||""} onChange={function(ev){ updateExpense(e.id,{amount:ev.target.value}) }} placeholder="0" style={inputStyle}/>
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Category</label>
                              <select value={e.category||"Other"} onChange={function(ev){ updateExpense(e.id,{category:ev.target.value}) }} style={Object.assign({},inputStyle,{WebkitAppearance:"none",appearance:"none"})}>
                                {BUDGET_CATEGORIES.map(function(c){ return <option key={c} value={c} style={{background:navy}}>{c}</option> })}
                              </select>
                            </div>
                            <div style={{ flex:1 }}>
                              <label style={labelStyle}>Date</label>
                              <input type="date" value={e.date||""} onChange={function(ev){ updateExpense(e.id,{date:ev.target.value}) }} style={inputStyle}/>
                            </div>
                            <button onClick={function(){ if(window.confirm("Remove this expense?")) removeExpense(e.id) }} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginBottom:9 }}>remove</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {activeTripCard === "documents" && (
                <div>
                  <div style={{ fontSize:11, color:"rgba(250,248,244,0.3)", fontFamily:"DM Sans,sans-serif", marginBottom:12, fontStyle:"italic" }}>What's ready for this trip — passport numbers, KTN, and other sensitive details live in Travel Profile, not here.</div>
                  <button onClick={addDocument} style={{ background:"rgba(106,155,181,0.15)", border:"1px solid rgba(106,155,181,0.3)", borderRadius:7, padding:"5px 12px", fontSize:11, color:"#6A9BB5", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, marginBottom:12 }}>+ Add document</button>
                  {documentsList().length === 0 && (
                    <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No documents added yet — add passports, visas, insurance, and booking confirmations here</div>
                  )}
                  {documentsList().map(function(d) {
                    var expiry = documentExpiryStatus(d)
                    return (
                      <div key={d.id} style={{ background:cardBg, border:"1px solid "+(expiry?(expiry==="expired"?"rgba(226,75,74,0.4)":"rgba(224,147,122,0.4)"):border), borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                          <div onClick={function(){ toggleDocument(d.id) }} style={{ width:20, height:20, borderRadius:5, border:"1.5px solid "+(d.confirmed?"#6A9BB5":"rgba(250,242,229,0.2)"), background:d.confirmed?"#6A9BB5":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer", marginTop:16 }}>
                            {d.confirmed ? <span style={{color:"#fff",fontSize:11}}>✓</span> : null}
                          </div>
                          <div style={{ flex:2 }}>
                            <label style={labelStyle}>Name</label>
                            <input value={d.name} onChange={function(e){ updateDocument(d.id,{name:e.target.value}) }} placeholder="e.g. Passport" style={Object.assign({},inputStyle,{textDecoration:d.confirmed?"line-through":"none"})}/>
                          </div>
                          <div style={{ flex:1 }}>
                            <label style={labelStyle}>Type</label>
                            <select value={d.type||""} onChange={function(e){ updateDocument(d.id,{type:e.target.value}) }} style={Object.assign({},inputStyle,{WebkitAppearance:"none",appearance:"none",color:d.type?warm:"rgba(250,248,244,0.3)"})}>
                              <option value="" style={{background:navy}}>Select…</option>
                              {DOCUMENT_TYPES.map(function(t){ return <option key={t} value={t} style={{background:navy}}>{t}</option> })}
                            </select>
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:8, alignItems:"flex-end", marginBottom: expiry?6:0 }}>
                          <div style={{ flex:1 }}>
                            <label style={labelStyle}>Expiry date</label>
                            <input type="date" value={d.expiryDate} onChange={function(e){ updateDocument(d.id,{expiryDate:e.target.value}) }} style={inputStyle}/>
                          </div>
                          <div style={{ flex:1 }}>
                            <label style={labelStyle}>Notes</label>
                            <input value={d.notes} onChange={function(e){ updateDocument(d.id,{notes:e.target.value}) }} placeholder="Optional" style={inputStyle}/>
                          </div>
                          <button onClick={function(){ if(window.confirm("Remove this document?")) removeDocument(d.id) }} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginBottom:9 }}>remove</button>
                        </div>
                        {expiry && (
                          <div style={{ fontSize:11, color: expiry==="expired"?"#e07070":"#e0937a", fontFamily:"DM Sans,sans-serif", fontWeight:600 }}>
                            {expiry==="expired" ? "⚠️ Expired" : "⚠️ Expiring within 90 days"}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {activeTripCard === "notes" && (
                <div>
                  <textarea value={notesDraft} onChange={function(e){ setNotesDraft(e.target.value) }} placeholder="Anything worth remembering…" rows={10} style={Object.assign({},inputStyle,{resize:"vertical"})}/>
                </div>
              )}

              {activeTripCard === "emergencyInfo" && (function(){
                var householdContacts = readHouseholdEmergencyContacts()
                var tripContacts = detailTrip.emergencyInfo || []
                return (
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"rgba(250,248,244,0.3)", fontFamily:"DM Sans,sans-serif", marginBottom:8 }}>From your Travel Profile</div>
                    {householdContacts.length === 0 && (
                      <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif", marginBottom:14 }}>No emergency contacts on file yet — add them in Travel Profile.</div>
                    )}
                    {householdContacts.length > 0 && (
                      <div style={{ marginBottom:14 }}>
                        {householdContacts.map(function(c) {
                          return (
                            <div key={c.id} style={{ padding:"6px 0", borderBottom:"1px solid rgba(250,242,229,0.04)" }}>
                              <div style={{ fontSize:13, color:warm, fontFamily:"DM Sans,sans-serif" }}>{c.name||"Unnamed"}{c.relation?" · "+c.relation:""}</div>
                              {c.phone && <div style={{ fontSize:11, color:"rgba(250,248,244,0.4)" }}>{c.phone}</div>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"rgba(250,248,244,0.3)", fontFamily:"DM Sans,sans-serif", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      For this trip only
                      <button onClick={addEmergencyContact} style={{ background:"rgba(200,131,74,0.12)", border:"1px solid rgba(200,131,74,0.3)", borderRadius:7, padding:"3px 10px", fontSize:11, color:"#c8834a", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600, textTransform:"none", letterSpacing:"normal" }}>+ Add</button>
                    </div>
                    {tripContacts.length === 0 && (
                      <div style={{ fontSize:12, color:"rgba(250,248,244,0.2)", fontStyle:"italic", fontFamily:"DM Sans,sans-serif" }}>No trip-specific contacts added.</div>
                    )}
                    {tripContacts.map(function(c) {
                      return (
                        <div key={c.id} style={{ background:"rgba(250,242,229,0.03)", borderRadius:9, padding:"10px 12px", marginBottom:8 }}>
                          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                            <div style={{ display:"flex", gap:8 }}>
                              <div style={{ flex:2 }}>
                                <label style={labelStyle}>Name</label>
                                <input value={c.name||""} onChange={function(e){ updateEmergencyContact(c.id,{name:e.target.value}) }} placeholder="Full name" style={inputStyle}/>
                              </div>
                              <div style={{ flex:1 }}>
                                <label style={labelStyle}>Relation</label>
                                <input value={c.relation||""} onChange={function(e){ updateEmergencyContact(c.id,{relation:e.target.value}) }} placeholder="e.g. Local guide" style={inputStyle}/>
                              </div>
                            </div>
                            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                              <div style={{ flex:1 }}>
                                <label style={labelStyle}>Phone</label>
                                <input value={c.phone||""} onChange={function(e){ updateEmergencyContact(c.id,{phone:e.target.value}) }} placeholder="Phone number" style={inputStyle}/>
                              </div>
                              <button onClick={function(){ if(window.confirm("Remove this contact?")) removeEmergencyContact(c.id) }} style={{ background:"none", border:"none", color:"rgba(200,80,80,0.4)", cursor:"pointer", fontSize:11, fontFamily:"DM Sans,sans-serif", marginTop:18 }}>remove</button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          ) : (
          <div>
          {/* Same "← Anchor Home" back-link style as AnchorVault's own top-level nav (~7384) */}
          <button onClick={backToTrips} style={{ background:"none", border:"none", color:"rgba(200,169,122,0.7)", cursor:"pointer", fontSize:13, fontFamily:"DM Sans,sans-serif", padding:"0 0 16px 0", display:"flex", alignItems:"center", gap:5 }}>← Back to Trips</button>

          {/* Header/banner (Phase C): trip identity + at-a-glance facts, primary
              quick actions front and center. Customize Cards demoted to a small
              icon-only ⋮ button — no longer co-equal with the primary actions. */}
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
              <span style={{ fontSize:26, flexShrink:0 }}>{detailTrip.icon || "🧳"}</span>
              <div style={{ minWidth:0 }}>
                <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:22, fontWeight:700, color:warm, lineHeight:1.2 }}>{detailTrip.name || "Untitled trip"}</div>
                {detailTrip.destination && <div style={{ fontSize:13, color:muted, fontFamily:"DM Sans,sans-serif", marginTop:2 }}>{detailTrip.destination}</div>}
              </div>
            </div>
            <button onClick={function(){ setManageOpen(true) }} title="Customize cards" style={{ background:"rgba(250,242,229,0.06)", border:"1px solid rgba(250,242,229,0.15)", borderRadius:8, padding:"6px 10px", fontSize:14, color:"rgba(250,248,244,0.6)", cursor:"pointer", flexShrink:0 }}>⋮</button>
          </div>
          <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:12 }}>
            {(detailTrip.startDate || detailTrip.endDate) && (
              <span style={{ fontSize:12, color:muted, fontFamily:"DM Sans,sans-serif" }}>
                {formatTripDate(detailTrip.startDate)}{detailTrip.startDate && detailTrip.endDate ? " – " + formatTripDate(detailTrip.endDate) : ""}
                {tripLengthDays(detailTrip) ? " · "+tripLengthDays(detailTrip)+" day"+(tripLengthDays(detailTrip)===1?"":"s") : ""}
              </span>
            )}
            <TripCountdownBadge trip={detailTrip} />
            {detailTrip.status && (
              <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ width:7, height:7, borderRadius:"50%", background:TRIP_STATUS_COLORS[detailTrip.status]||sand, display:"inline-block", flexShrink:0 }}/>
                <span style={{ fontSize:12, color:TRIP_STATUS_COLORS[detailTrip.status]||sand, fontFamily:"DM Sans,sans-serif" }}>{detailTrip.status}</span>
              </span>
            )}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:18 }}>
            <button onClick={function(){ addReservation(); setActiveTripCard("reservations") }} style={{ background:"rgba(142,142,181,0.12)", border:"1px solid rgba(142,142,181,0.3)", borderRadius:8, padding:"7px 12px", fontSize:12, color:"#8e8eb5", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600 }}>＋ Reservation</button>
            <button onClick={function(){ setActiveTripCard("itinerary") }} style={{ background:"rgba(217,138,110,0.12)", border:"1px solid rgba(217,138,110,0.3)", borderRadius:8, padding:"7px 12px", fontSize:12, color:"#d98a6e", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600 }}>＋ Itinerary item</button>
            <button onClick={function(){ setActiveTripCard("packing") }} style={{ background:"rgba(160,122,181,0.12)", border:"1px solid rgba(160,122,181,0.3)", borderRadius:8, padding:"7px 12px", fontSize:12, color:"#a07ab5", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600 }}>📦 Packing</button>
            <button onClick={function(){ openEdit(detailTrip) }} style={{ background:"rgba(200,169,122,0.12)", border:"1px solid rgba(200,169,122,0.3)", borderRadius:8, padding:"7px 12px", fontSize:12, color:sand, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600 }}>✏️ Edit trip</button>
          </div>

          {/* Phase B: read-only summary — editing now happens only through the
              "Edit trip info" header button, which opens the existing formTrip
              modal. Previously this card had its own always-editable inputs, a
              second, parallel edit surface for the exact same fields as the
              modal — removed rather than kept in sync with a duplicate draft. */}
          <TripCard icon="📋" title="Overview" accent={sand} defaultOpen={true}>
            <div style={{ display:"flex", flexDirection:"column", gap:12, paddingTop:10 }}>
              <div>
                <label style={labelStyle}>Trip name</label>
                <div style={{ fontSize:15, color:warm, fontFamily:"DM Sans,sans-serif" }}>{detailTrip.name || "Untitled trip"}</div>
              </div>
              <div>
                <label style={labelStyle}>Destination</label>
                <div style={{ fontSize:15, color:warm, fontFamily:"DM Sans,sans-serif" }}>{detailTrip.destination || "Not set"}</div>
              </div>
              <div style={{ display:"flex", gap:24 }}>
                <div>
                  <label style={labelStyle}>Start date</label>
                  <div style={{ fontSize:14, color:warm, fontFamily:"DM Sans,sans-serif" }}>{detailTrip.startDate ? formatTripDate(detailTrip.startDate) : "Not set"}</div>
                </div>
                <div>
                  <label style={labelStyle}>End date</label>
                  <div style={{ fontSize:14, color:warm, fontFamily:"DM Sans,sans-serif" }}>{detailTrip.endDate ? formatTripDate(detailTrip.endDate) : "Not set"}</div>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                {detailTrip.status ? (
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ width:7, height:7, borderRadius:"50%", background:TRIP_STATUS_COLORS[detailTrip.status]||sand, display:"inline-block", flexShrink:0 }}/>
                    <span style={{ fontSize:14, color:TRIP_STATUS_COLORS[detailTrip.status]||sand, fontFamily:"DM Sans,sans-serif" }}>{detailTrip.status}</span>
                  </div>
                ) : (
                  <div style={{ fontSize:14, color:warm, fontFamily:"DM Sans,sans-serif" }}>Not set</div>
                )}
              </div>
            </div>
          </TripCard>

          {CARD_GROUPS_ORDER.map(function(g) {
            var idsInGroup = cardOrder.filter(function(id){ return CARD_GROUP_OF[id]===g })
            if (idsInGroup.length === 0) return null
            return (
              <div key={g} style={{ marginBottom:18 }}>
                {/* Section header — same pattern as Cove's region headers (border-top +
                    uppercase small-caps + item-count badge), re-expressed with this
                    file's own dark-theme tokens rather than Cove's T.* values */}
                <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 0 8px", borderTop:"1px solid "+border, marginTop:4 }}>
                  <span style={{ flex:1, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:muted, fontFamily:"DM Sans,sans-serif" }}>{CARD_GROUP_LABELS[g]}</span>
                  <span style={{ fontSize:10, color:"rgba(250,248,244,0.3)", background:"rgba(250,242,229,0.04)", borderRadius:999, padding:"1px 7px", border:"1px solid "+border }}>{idsInGroup.length}</span>
                </div>
                {/* 2-column grid — same auto-fit pattern as Health's person-card grid
                    (~6126), not a rigid 1fr 1fr, so it collapses to 1 column on mobile
                    the same way Health's already does */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:12 }}>
                  {idsInGroup.map(function(id) {
                    return CARD_RENDERERS[id] ? CARD_RENDERERS[id]() : null
                  })}
                </div>
              </div>
            )
          })}
          </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:22, fontWeight:600, color:warm, marginBottom:4 }}>Travel</div>
          <div style={{ fontSize:12, color:muted, fontFamily:"DM Sans,sans-serif", marginBottom:20 }}>Every trip you're planning or have taken — dates, destination, and status at a glance.</div>

          <TravelWalletCard />

          {travelCountdowns.length > 0 && (
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:18 }}>
              {travelCountdowns.map(function(cd) {
                var d = new Date(cd.targetDate + "T00:00:00")
                var today0 = new Date(); today0.setHours(0,0,0,0)
                var days = Math.round((d - today0) / 86400000)
                var when = days===0 ? "Today!" : days===1 ? "Tomorrow" : "in "+days+" days"
                return (
                  <div key={cd.id} style={{ display:"flex", alignItems:"center", gap:7, background:cardBg, border:"1px solid "+(cd.color||border), borderRadius:20, padding:"5px 12px", fontSize:12, color:warm, fontFamily:"DM Sans,sans-serif" }}>
                    <span>{cd.emoji||"⭐"}</span><span style={{ fontWeight:700 }}>{cd.title}</span><span style={{ color:muted }}>{when}</span>
                  </div>
                )
              })}
            </div>
          )}

          {trips.length === 0 ? (
            // Richer empty state, matching HomeSystemsSection's tone (~5683): icon +
            // heading + one-line subtitle, not just the terser "No X added yet." used
            // by TravelProfileSection's smaller inline lists (ffPrograms/luggage/etc).
            <div style={{ textAlign:"center", padding:"40px 20px", color:muted, fontSize:13, fontFamily:"DM Sans,sans-serif" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🧳</div>
              <div>No trips planned yet.</div>
              <div style={{ marginTop:4, fontSize:12, marginBottom:16 }}>Plan flights, road trips, and everything in between.</div>
              <button onClick={openAdd} style={{ background:"rgba(200,169,122,0.1)", border:"1px solid rgba(200,169,122,0.25)", borderRadius:8, padding:"8px 16px", fontSize:12, color:sand, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600 }}>+ Add a trip</button>
            </div>
          ) : (function(){
              // Past Adventures split: completed trips move to their own
              // collapsible section below, sorted by end date descending.
              // Everything else (Planning/Booked/Upcoming/In Progress/
              // Cancelled/no status set) stays in the main active grid —
              // only an exact "Completed" status moves a trip out.
              var activeTrips = trips.filter(function(t){ return t.status !== "Completed" })
              var pastTrips = trips.filter(function(t){ return t.status === "Completed" }).slice().sort(function(a,b){
                if (!a.endDate && !b.endDate) return 0
                if (!a.endDate) return 1
                if (!b.endDate) return -1
                return a.endDate < b.endDate ? 1 : a.endDate > b.endDate ? -1 : 0
              })
              function renderTripCard(trip, mutedStyle) {
                return (
                  <div key={trip.id} onClick={function(){ openDetail(trip) }} style={{ background:cardBg, border:"1px solid "+border, borderRadius:12, padding:"12px 14px", cursor:"pointer", display:"flex", flexDirection:"column", gap:6, opacity: mutedStyle?0.7:1 }}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                      <span style={{ fontSize:20 }}>{trip.icon || "🧳"}</span>
                      <TripCountdownBadge trip={trip} />
                    </div>
                    <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:16, fontWeight:700, color:warm, lineHeight:1.2 }}>{trip.name || "Untitled trip"}</div>
                    {trip.destination ? <div style={{ fontSize:12, color:muted }}>{trip.destination}</div> : null}
                    {(trip.startDate || trip.endDate) ? (
                      <div style={{ fontSize:11, color:muted }}>
                        {formatTripDate(trip.startDate)}{trip.startDate && trip.endDate ? " – " + formatTripDate(trip.endDate) : ""}
                      </div>
                    ) : null}
                    {trip.status ? (
                      <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
                        <span style={{ width:7, height:7, borderRadius:"50%", background:TRIP_STATUS_COLORS[trip.status]||sand, display:"inline-block", flexShrink:0 }}/>
                        <span style={{ fontSize:11, color:TRIP_STATUS_COLORS[trip.status]||sand }}>{trip.status}</span>
                      </div>
                    ) : null}
                  </div>
                )
              }
              return (
                <div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                    {activeTrips.map(function(trip){ return renderTripCard(trip, false) })}
                    {/* Dashed add tile inside the grid — matches MaintenancePanel's system-grid add tile (~5704) */}
                    <div onClick={openAdd} style={{ background:"rgba(250,242,229,0.02)", border:"1px dashed rgba(250,242,229,0.13)", borderRadius:12, minHeight:100, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, cursor:"pointer" }}>
                      <span style={{ fontSize:20, color:"rgba(250,248,244,0.18)" }}>+</span>
                      <span style={{ fontSize:11, color:"rgba(250,248,244,0.28)", fontFamily:"DM Sans,sans-serif" }}>Add trip</span>
                    </div>
                  </div>
                  {pastTrips.length > 0 && (
                    <div>
                      <div onClick={function(){ setCollapsedPastAdventures(function(p){ return !p }) }} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 0", borderTop:"1px solid "+border, cursor:"pointer" }}>
                        <span style={{ flex:1, fontSize:13, fontWeight:700, color:muted, fontFamily:"DM Sans,sans-serif" }}>Past Adventures ({pastTrips.length})</span>
                        <span style={{ fontSize:11, color:muted, transform:collapsedPastAdventures?"rotate(0deg)":"rotate(180deg)", transition:"transform 0.2s" }}>▾</span>
                      </div>
                      {!collapsedPastAdventures && (
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:10 }}>
                          {pastTrips.map(function(trip){ return renderTripCard(trip, true) })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
        </div>
      )}

      {formTrip && (
        // Bottom-sheet modal, matching ProductsPanel/MaintenancePanel's modal
        // shape (~5581/~HModal) but with TravelProfileSection's own palette.
        <div style={{ position:"fixed", inset:0, background:"rgba(15,26,42,0.72)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={closeForm}>
          <div onClick={function(e){ e.stopPropagation() }} style={{ background:"#1a2744", borderRadius:"18px 18px 0 0", padding:20, paddingBottom:"calc(20px + env(safe-area-inset-bottom,0px))", width:"min(480px,100%)", maxHeight:"calc(88dvh - env(safe-area-inset-top,0px))", overflowY:"auto", boxSizing:"border-box" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:19, fontWeight:700, color:warm }}>{formTrip.id ? "Edit trip" : "Add trip"}</div>
              <button onClick={closeForm} style={{ background:"none", border:"none", color:"rgba(250,248,244,0.4)", cursor:"pointer", fontSize:18 }}>✕</button>
            </div>

            <label style={labelStyle}>Icon</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
              {TRIP_ICONS.map(function(ic) {
                return (
                  <button key={ic} type="button" onClick={function(){ setFormTrip(Object.assign({},formTrip,{icon:ic})) }} style={{ fontSize:16, background:formTrip.icon===ic?"rgba(200,169,122,0.18)":"rgba(250,242,229,0.04)", border:"1px solid "+(formTrip.icon===ic?"rgba(200,169,122,0.4)":"rgba(250,242,229,0.1)"), borderRadius:8, padding:"4px 8px", cursor:"pointer" }}>{ic}</button>
                )
              })}
            </div>

            <label style={labelStyle}>Trip name</label>
            <input autoFocus value={formTrip.name} onChange={function(e){ setFormTrip(Object.assign({},formTrip,{name:e.target.value})) }} placeholder="e.g. Cancún Family Trip" style={Object.assign({},inputStyle,{marginBottom:10})}/>

            <label style={labelStyle}>Destination</label>
            <input value={formTrip.destination} onChange={function(e){ setFormTrip(Object.assign({},formTrip,{destination:e.target.value})) }} placeholder="e.g. Cancún, Mexico" style={Object.assign({},inputStyle,{marginBottom:10})}/>

            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              <div style={{ flex:1 }}>
                <label style={labelStyle}>Start date</label>
                <input type="date" value={formTrip.startDate} onChange={function(e){ setFormTrip(Object.assign({},formTrip,{startDate:e.target.value})) }} style={inputStyle}/>
              </div>
              <div style={{ flex:1 }}>
                <label style={labelStyle}>End date</label>
                <input type="date" value={formTrip.endDate} onChange={function(e){ setFormTrip(Object.assign({},formTrip,{endDate:e.target.value})) }} style={inputStyle}/>
              </div>
            </div>

            <label style={labelStyle}>Status</label>
            <select value={formTrip.status} onChange={function(e){ setFormTrip(Object.assign({},formTrip,{status:e.target.value})) }} style={Object.assign({},inputStyle,{marginBottom:10,WebkitAppearance:"none",appearance:"none"})}>
              {TRIP_STATUSES.map(function(s){ return <option key={s} value={s} style={{background:navy}}>{s}</option> })}
            </select>

            <label style={labelStyle}>Notes</label>
            <textarea value={formTrip.notes} onChange={function(e){ setFormTrip(Object.assign({},formTrip,{notes:e.target.value})) }} placeholder="Anything worth remembering…" rows={3} style={Object.assign({},inputStyle,{resize:"vertical",marginBottom:14})}/>

            <div style={{ display:"flex", gap:8 }}>
              <button onClick={saveForm} style={{ flex:1, background:sand, color:navy, border:"none", borderRadius:10, padding:11, fontWeight:700, cursor:"pointer", fontFamily:"DM Sans,sans-serif", fontSize:14 }}>Save</button>
              {formTrip.id ? <button onClick={deleteForm} style={{ background:"rgba(226,75,74,0.06)", border:"0.5px solid rgba(226,75,74,0.18)", borderRadius:10, padding:"11px 16px", color:"rgba(240,153,123,0.7)", fontSize:13, cursor:"pointer", fontFamily:"DM Sans,sans-serif" }}>Delete</button> : null}
            </div>
          </div>
        </div>
      )}

      {/* Customize cards — Step 4c's manageOpen / onCardDrag* / toggleCardVisible
          logic, finally wired to a UI. Same bottom-sheet container as the trip-edit
          modal above; row drag-reorder mirrors InventorySection's dragOverIdx visual
          indicator (~809/819) applied here via dragOverCardIdx. */}
      {manageOpen && detailTrip && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,26,42,0.72)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={function(){ setManageOpen(false) }}>
          <div onClick={function(e){ e.stopPropagation() }} style={{ background:"#1a2744", borderRadius:"18px 18px 0 0", padding:20, paddingBottom:"calc(20px + env(safe-area-inset-bottom,0px))", width:"min(480px,100%)", maxHeight:"calc(88dvh - env(safe-area-inset-top,0px))", overflowY:"auto", boxSizing:"border-box" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontFamily:"Cormorant Garamond,serif", fontSize:19, fontWeight:700, color:warm }}>Customize cards</div>
              <button onClick={function(){ setManageOpen(false) }} style={{ background:"none", border:"none", color:"rgba(250,248,244,0.4)", cursor:"pointer", fontSize:18 }}>✕</button>
            </div>

            <label style={labelStyle}>Visible cards</label>
            <div style={{ marginBottom: hiddenCardIds.length > 0 ? 16 : 4 }}>
              {cardOrder.map(function(id, idx) {
                var meta = CARD_META[id]
                if (!meta) return null
                var isDragOver = dragOverCardIdx === idx && dragFromCard.current !== idx
                return (
                  <div key={id}
                    draggable
                    onDragStart={function(e){ onCardDragStart(e, idx) }}
                    onDragOver={function(e){ onCardDragOver(e, idx) }}
                    onDrop={function(e){ onCardDrop(e, idx) }}
                    onDragEnd={onCardDragEnd}
                    onDragLeave={function(){ if (dragOverCardIdx === idx) setDragOverCardIdx(null) }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", marginBottom:6, background:isDragOver?"rgba(200,169,122,0.12)":"rgba(250,242,229,0.04)", border:"1px solid "+meta.accent+"33", borderLeft:isDragOver?"3px solid #c8a97a":"3px solid "+meta.accent+"55", borderRadius:10, transition:"background 0.08s", opacity:dragFromCard.current===idx?0.3:1, cursor:"grab" }}>
                    <span style={{ fontSize:13, color:"rgba(250,248,244,0.25)", flexShrink:0, lineHeight:1 }}>⋮⋮</span>
                    <span style={{ fontSize:16, flexShrink:0 }}>{meta.icon}</span>
                    <span style={{ flex:1, fontSize:13, fontFamily:"DM Sans,sans-serif", color:warm }}>{meta.title}</span>
                    <button onClick={function(){ toggleCardVisible(id) }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:15, color:"rgba(250,248,244,0.4)", padding:"2px 4px", flexShrink:0 }} title={"Hide "+meta.title}>👁️</button>
                  </div>
                )
              })}
            </div>

            {hiddenCardIds.length > 0 && (
              <div>
                <label style={labelStyle}>Hidden cards</label>
                {hiddenCardIds.map(function(id) {
                  var meta = CARD_META[id]
                  if (!meta) return null
                  return (
                    <div key={id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", marginBottom:6, background:"rgba(250,242,229,0.02)", border:"1px solid rgba(250,242,229,0.08)", borderRadius:10 }}>
                      <span style={{ fontSize:16, flexShrink:0, opacity:0.4 }}>{meta.icon}</span>
                      <span style={{ flex:1, fontSize:13, fontFamily:"DM Sans,sans-serif", color:"rgba(250,248,244,0.35)" }}>{meta.title}</span>
                      <button onClick={function(){ toggleCardVisible(id) }} style={{ background:"rgba(200,169,122,0.1)", border:"1px solid rgba(200,169,122,0.25)", borderRadius:8, padding:"4px 10px", fontSize:11, color:sand, fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600 }}>Show</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


// ── Career Section ────────────────────────────────────────────────────────────
var CAREER_GOLD  = "#c8a97a"
var CAREER_NAVY  = "#243A5A"
var CAREER_SURF  = "rgba(250,242,229,0.05)"
var CAREER_SURF2 = "rgba(250,242,229,0.04)"
var CAREER_BORD  = "0.5px solid rgba(250,242,229,0.1)"
var CAREER_BORD2 = "0.5px solid rgba(250,242,229,0.08)"
var CAREER_WHITE = "#faf8f4"

var C_TABS = [
  { id: "resume",    label: "Resume & Skills"  },
  { id: "jobs",      label: "Job Tracker"      },
  { id: "goals",     label: "Goals"            },
  { id: "wins",      label: "Wins & Notes"     },
  { id: "docs",      label: "Docs & Links"     },
]

function cuid() { return Math.random().toString(36).slice(2,9) }
function cLoadCareer() { try { var s=localStorage.getItem("af_career"); return s?JSON.parse(s):{}; } catch(e){return {};} }
function cSaveCareer(v) { try { localStorage.setItem("af_career",JSON.stringify(v)); afVaultChanged("career"); } catch(e){} }
function useCareer() {
  var pair = useState(cLoadCareer); var val=pair[0]; var setRaw=pair[1];
  function set(next) { setRaw(function(prev){ var r=typeof next==="function"?next(prev):next; cSaveCareer(r); return r; }); }
  return [val, set];
}

// ── Shared Career UI primitives ───────────────────────────────────────────────
function CCard(props) {
  return React.createElement("div",{style:Object.assign({background:CAREER_SURF,border:CAREER_BORD,borderRadius:10,padding:"0.9rem 1.1rem"},props.style||{})},props.children)
}
function CHead(props) {
  return React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.7rem"}},
    React.createElement("span",{style:{fontSize:13,fontWeight:600,color:"rgba(250,248,244,0.75)",display:"flex",alignItems:"center",gap:6}},
      React.createElement("span",{style:{fontSize:15}},props.icon), props.label),
    props.onAdd&&React.createElement("button",{onClick:props.onAdd,style:{fontSize:12,color:CAREER_GOLD,background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:6,padding:"3px 10px",cursor:"pointer"}},"+ Add")
  )
}
function CModal(props) {
  return React.createElement("div",{style:{position:"fixed",top:0,left:68,right:0,bottom:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999},onClick:props.onClose},
    React.createElement("div",{style:{background:"#2E486B",border:CAREER_BORD,borderRadius:14,padding:"1.25rem 1.5rem",width:"min(480px,calc(100vw - 68px - 2rem))",maxHeight:"85dvh",overflowY:"auto",WebkitOverflowScrolling:"touch"},onClick:function(e){e.stopPropagation();}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}},
        React.createElement("span",{style:{color:CAREER_WHITE,fontSize:15,fontWeight:600}},props.title),
        React.createElement("button",{onClick:props.onClose,style:{background:"none",border:"none",color:"rgba(250,248,244,0.4)",cursor:"pointer",fontSize:18}},"✕")),
      props.children))
}
var C_INP_STYLE = {width:"100%",background:"rgba(250,242,229,0.07)",border:CAREER_BORD,borderRadius:8,padding:"0.5rem 0.7rem",color:CAREER_WHITE,WebkitTextFillColor:CAREER_WHITE,caretColor:CAREER_GOLD,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}
function CInput(props) {
  return React.createElement("div",{style:{marginBottom:"0.7rem"}},
    props.label&&React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},props.label),
    React.createElement("input",{type:props.type||"text",value:props.value,onChange:function(e){props.onChange(e.target.value);},placeholder:props.placeholder,style:C_INP_STYLE}))
}
function CTextarea(props) {
  return React.createElement("div",{style:{marginBottom:"0.7rem"}},
    props.label&&React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},props.label),
    React.createElement("textarea",{value:props.value,onChange:function(e){props.onChange(e.target.value);},placeholder:props.placeholder,rows:props.rows||4,style:Object.assign({},C_INP_STYLE,{resize:"vertical"})}))
}
function CSelect(props) {
  return React.createElement("div",{style:{marginBottom:"0.7rem"}},
    props.label&&React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},props.label),
    React.createElement("select",{value:props.value,onChange:function(e){props.onChange(e.target.value);},style:{width:"100%",background:"rgba(30,46,82,0.95)",border:CAREER_BORD,borderRadius:8,padding:"0.5rem 0.7rem",color:CAREER_WHITE,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}},
      props.options.map(function(o){return React.createElement("option",{key:o.value,value:o.value},o.label);})))
}
function CSaveBtn(props) {
  return React.createElement("button",{onClick:props.onClick,style:{width:"100%",background:CAREER_GOLD,color:CAREER_NAVY,border:"none",borderRadius:8,padding:"0.6rem",fontWeight:700,fontSize:13,fontFamily:"inherit",cursor:"pointer",marginTop:"0.5rem"}},props.label||"Save")
}
function CRow(props) {
  return React.createElement("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",padding:"0.5rem 0",borderBottom:CAREER_BORD2,gap:8}},
    React.createElement("div",{style:{flex:1}},
      React.createElement("p",{style:{fontSize:13,color:CAREER_WHITE,fontWeight:500,margin:"0 0 2px"}},props.title),
      props.sub&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.4)",margin:0}},props.sub)),
    React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
      props.badge&&React.createElement("span",{style:{fontSize:11,padding:"2px 8px",borderRadius:12,background:"rgba(200,169,122,0.12)",color:CAREER_GOLD,border:"0.5px solid rgba(200,169,122,0.25)",whiteSpace:"nowrap"}},props.badge),
      props.onDelete&&React.createElement("button",{onClick:props.onDelete,style:{background:"none",border:"none",color:"rgba(250,248,244,0.25)",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}},"✕")))
}
function CEmpty(props) {
  return React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",fontStyle:"italic",textAlign:"center",padding:"1rem 0"}},props.text||"Nothing here yet")
}

// ── Resume & Skills tab ───────────────────────────────────────────────────────
function CResumeTab({ pid, career, setCareer }) {
  var pd = career[pid] || {}
  var resume = pd.resume || {}
  var skills = pd.skills || []
  var s0=useState(false); var adding=s0[0]; var setAdding=s0[1];
  var s1=useState({title:"",company:"",from:"",to:"",desc:""}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(""); var skillInput=s2[0]; var setSkillInput=s2[1];
  var s3=useState(""); var skillDate=s3[0]; var setSkillDate=s3[1];
  var s4=useState(null); var expandedJob=s4[0]; var setExpandedJob=s4[1];
  var s5=useState(null); var editingJob=s5[0]; var setEditingJob=s5[1];
  var s6=useState({title:"",company:"",from:"",to:"",desc:""}); var editForm=s6[0]; var setEditForm=s6[1];
  var s7=useState(null); var editingSkill=s7[0]; var setEditingSkill=s7[1];
  var s8=useState({label:"",since:""}); var editSkillForm=s8[0]; var setEditSkillForm=s8[1];

  function save() {
    if(!form.title.trim()) return
    var entry = {id:cuid(),title:form.title,company:form.company,from:form.from,to:form.to,desc:form.desc}
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,resume:{...(p.resume||{}),history:[...((p.resume||{}).history||[]),entry]}}}})
    setForm({title:"",company:"",from:"",to:"",desc:""}); setAdding(false)
  }
  function removeJob(id) {
    setCareer(function(c){var p=c[pid]||{}; var r=p.resume||{}; return{...c,[pid]:{...p,resume:{...r,history:(r.history||[]).filter(function(h){return h.id!==id})}}}})
    if(expandedJob===id) setExpandedJob(null)
  }
  function startEditJob(h) {
    setEditingJob(h.id)
    setEditForm({title:h.title||"",company:h.company||"",from:h.from||"",to:h.to||"",desc:h.desc||""})
  }
  function saveEditJob() {
    setCareer(function(c){var p=c[pid]||{}; var r=p.resume||{}; return{...c,[pid]:{...p,resume:{...r,history:(r.history||[]).map(function(h){return h.id===editingJob?{...h,...editForm}:h})}}}})
    setEditingJob(null)
  }
  function addSkill() {
    if(!skillInput.trim()) return
    var sk = {id:cuid(),label:skillInput.trim(),since:skillDate.trim()}
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,skills:[...(p.skills||[]),sk]}}})
    setSkillInput(""); setSkillDate("")
  }
  function removeSkill(id) { setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,skills:(p.skills||[]).filter(function(s){return s.id!==id})}}}) }
  function startEditSkill(sk) { setEditingSkill(sk.id); setEditSkillForm({label:sk.label||"",since:sk.since||""}) }
  function saveEditSkill() {
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,skills:(p.skills||[]).map(function(s){return s.id===editingSkill?{...s,...editSkillForm}:s})}}})
    setEditingSkill(null)
  }
  function updateBio(v) { setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,resume:{...(p.resume||{}),bio:v}}}}) }

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"0.9rem"}},
    React.createElement(CCard,null,
      React.createElement(CHead,{icon:"📝",label:"Professional summary"}),
      React.createElement("textarea",{value:resume.bio||"",onChange:function(e){updateBio(e.target.value);},placeholder:"A short bio or professional summary…",rows:4,style:Object.assign({},C_INP_STYLE,{resize:"vertical"})})),

    // Work history — mobile-friendly cards
    React.createElement(CCard,null,
      React.createElement(CHead,{icon:"💼",label:"Work history",onAdd:function(){setAdding(true)}}),
      (resume.history||[]).length===0 ? React.createElement(CEmpty,{text:"No work history added yet"}) :
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:8}},
          (resume.history||[]).map(function(h){
            var isExpanded = expandedJob===h.id
            var isEditing = editingJob===h.id
            return React.createElement("div",{key:h.id,style:{background:"rgba(250,242,229,0.04)",border:CAREER_BORD,borderRadius:10,overflow:"hidden"}},
              // Header row — always visible, tappable
              !isEditing&&React.createElement("div",{onClick:function(){setExpandedJob(isExpanded?null:h.id)},style:{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer"}},
                React.createElement("div",{style:{flex:1,minWidth:0}},
                  React.createElement("div",{style:{fontSize:13,fontWeight:600,color:CAREER_WHITE,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},h.title||(h.company||"Role")),
                  React.createElement("div",{style:{fontSize:11,color:"rgba(250,248,244,0.45)",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}},(h.company||"")+(h.from||h.to?" · "+(h.from||"")+"–"+(h.to||"present"):"")),
                ),
                React.createElement("span",{style:{fontSize:10,color:"rgba(250,248,244,0.3)",flexShrink:0,transform:isExpanded?"rotate(180deg)":"rotate(0deg)",display:"inline-block",transition:"transform 0.2s"}},"\u25BE")
              ),
              // Expanded detail
              isExpanded&&!isEditing&&React.createElement("div",{style:{padding:"0 12px 12px",borderTop:CAREER_BORD2}},
                h.desc&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.6)",lineHeight:1.6,margin:"10px 0 0"}}),h.desc,
                React.createElement("div",{style:{display:"flex",gap:8,marginTop:10}},
                  React.createElement("button",{onClick:function(e){e.stopPropagation();startEditJob(h)},style:{fontSize:11,color:CAREER_GOLD,background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}},"✏️ Edit"),
                  React.createElement("button",{onClick:function(e){e.stopPropagation();removeJob(h.id)},style:{fontSize:11,color:"rgba(250,248,244,0.3)",background:"rgba(250,242,229,0.04)",border:CAREER_BORD2,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}},"Remove")
                )
              ),
              // Inline edit form
              isEditing&&React.createElement("div",{style:{padding:"12px"},onClick:function(e){e.stopPropagation()}},
                React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}},
                  React.createElement("input",{value:editForm.title,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{title:e.target.value})})},placeholder:"Job title",style:C_INP_STYLE}),
                  React.createElement("input",{value:editForm.company,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{company:e.target.value})})},placeholder:"Company",style:C_INP_STYLE})
                ),
                React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}},
                  React.createElement("input",{value:editForm.from,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{from:e.target.value})})},placeholder:"From (e.g. 2022)",style:C_INP_STYLE}),
                  React.createElement("input",{value:editForm.to,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{to:e.target.value})})},placeholder:"To (or 'present')",style:C_INP_STYLE})
                ),
                React.createElement("textarea",{value:editForm.desc,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{desc:e.target.value})})},placeholder:"What you built, led, or accomplished…",rows:3,style:Object.assign({},C_INP_STYLE,{resize:"vertical",marginBottom:8})}),
                React.createElement("div",{style:{display:"flex",gap:8}},
                  React.createElement("button",{onClick:saveEditJob,style:{flex:1,background:CAREER_GOLD,color:CAREER_NAVY,border:"none",borderRadius:7,padding:"7px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"Save"),
                  React.createElement("button",{onClick:function(){setEditingJob(null)},style:{background:"rgba(250,242,229,0.06)",border:CAREER_BORD2,borderRadius:7,padding:"7px 12px",fontSize:12,color:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"inherit"}},"Cancel")
                )
              )
            )
          })
        )
    ),

    // Skills with date
    React.createElement(CCard,null,
      React.createElement(CHead,{icon:"⚡",label:"Skills"}),
      skills.length===0
        ? React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",fontStyle:"italic",marginBottom:8}},"No skills added yet")
        : React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:6,marginBottom:"0.65rem"}},
            skills.map(function(sk){
              if(editingSkill===sk.id) {
                return React.createElement("div",{key:sk.id,style:{display:"flex",gap:6,alignItems:"center",background:"rgba(200,169,122,0.06)",borderRadius:8,padding:"6px 8px"}},
                  React.createElement("input",{value:editSkillForm.label,onChange:function(e){setEditSkillForm(function(f){return Object.assign({},f,{label:e.target.value})})},placeholder:"Skill",style:Object.assign({},C_INP_STYLE,{flex:2,padding:"4px 8px",marginBottom:0})}),
                  React.createElement("input",{value:editSkillForm.since,onChange:function(e){setEditSkillForm(function(f){return Object.assign({},f,{since:e.target.value})})},placeholder:"Since (e.g. 2021)",style:Object.assign({},C_INP_STYLE,{flex:1,padding:"4px 8px",marginBottom:0})}),
                  React.createElement("button",{onClick:saveEditSkill,style:{background:CAREER_GOLD,border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,color:CAREER_NAVY,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}},"✓"),
                  React.createElement("button",{onClick:function(){setEditingSkill(null)},style:{background:"none",border:"none",fontSize:13,color:"rgba(250,248,244,0.3)",cursor:"pointer",padding:"2px"}},"✕")
                )
              }
              return React.createElement("div",{key:sk.id,style:{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",background:"rgba(200,169,122,0.07)",borderRadius:8,border:"0.5px solid rgba(200,169,122,0.18)"}},
                React.createElement("div",{style:{flex:1}},
                  React.createElement("span",{style:{fontSize:13,color:CAREER_GOLD,fontWeight:500}}),sk.label,
                  sk.since&&React.createElement("span",{style:{fontSize:10,color:"rgba(250,248,244,0.35)",marginLeft:8}},"since "+sk.since)
                ),
                React.createElement("button",{onClick:function(){startEditSkill(sk)},style:{background:"none",border:"none",fontSize:12,color:"rgba(200,169,122,0.4)",cursor:"pointer",padding:"0 3px"}},"✏️"),
                React.createElement("button",{onClick:function(){removeSkill(sk.id)},style:{background:"none",border:"none",fontSize:13,color:"rgba(250,248,244,0.2)",cursor:"pointer",padding:"0 3px"}},"×")
              )
            })
          ),
      React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
        React.createElement("input",{value:skillInput,onChange:function(e){setSkillInput(e.target.value);},onKeyDown:function(e){if(e.key==="Enter")addSkill();},placeholder:"Add a skill…",style:Object.assign({},C_INP_STYLE,{flex:"2 1 120px",marginBottom:0})}),
        React.createElement("input",{value:skillDate,onChange:function(e){setSkillDate(e.target.value);},placeholder:"Since (opt)",style:Object.assign({},C_INP_STYLE,{flex:"1 1 90px",marginBottom:0})}),
        React.createElement("button",{onClick:addSkill,style:{background:"rgba(200,169,122,0.15)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:8,padding:"0.4rem 0.7rem",color:CAREER_GOLD,fontSize:12,cursor:"pointer",fontFamily:"inherit",flexShrink:0}},"Add")
      )
    ),

    adding&&React.createElement(CModal,{title:"Add work history",onClose:function(){setAdding(false);}},
      React.createElement(CInput,{label:"Job title",value:form.title,onChange:function(v){setForm(function(f){return Object.assign({},f,{title:v})});},placeholder:"e.g. Senior Designer"}),
      React.createElement(CInput,{label:"Company",value:form.company,onChange:function(v){setForm(function(f){return Object.assign({},f,{company:v})});},placeholder:"e.g. Acme Co."}),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}},
        React.createElement(CInput,{label:"From",value:form.from,onChange:function(v){setForm(function(f){return Object.assign({},f,{from:v})});},placeholder:"2020"}),
        React.createElement(CInput,{label:"To",value:form.to,onChange:function(v){setForm(function(f){return Object.assign({},f,{to:v})});},placeholder:"2023 or present"})),
      React.createElement(CTextarea,{label:"Notes",value:form.desc,onChange:function(v){setForm(function(f){return Object.assign({},f,{desc:v})});},placeholder:"What you built, led, or accomplished…",rows:3}),
      React.createElement(CSaveBtn,{onClick:save}))
  )
}

// ── Job Tracker tab ───────────────────────────────────────────────────────────
var JOB_STATUSES = ["Interested","Applied","Phone screen","Interview","Offer","Rejected","Withdrawn"]

function CJobsTab({ pid, career, setCareer }) {
  var jobs = (career[pid]||{}).jobs || []
  var s0=useState(false); var adding=s0[0]; var setAdding=s0[1];
  var s1=useState({company:"",role:"",status:"Interested",date:"",url:"",notes:""}); var form=s1[0]; var setForm=s1[1];
  var STATUS_COLORS = {"Interested":"rgba(200,169,122,0.8)","Applied":"rgba(122,154,184,0.8)","Phone screen":"rgba(122,184,168,0.8)","Interview":"rgba(184,156,100,0.9)","Offer":"rgba(122,184,122,0.8)","Rejected":"rgba(184,100,100,0.6)","Withdrawn":"rgba(150,150,150,0.5)"}

  function save() {
    if(!form.company.trim()&&!form.role.trim()) return
    var job={id:cuid(),...form,addedAt:new Date().toISOString().split("T")[0]}
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,jobs:[...(p.jobs||[]),job]}}})
    setForm({company:"",role:"",status:"Interested",date:"",url:"",notes:""}); setAdding(false)
  }
  function updateStatus(id,status) { setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,jobs:(p.jobs||[]).map(function(j){return j.id===id?{...j,status}:j})}}}) }
  function removeJob(id) { setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,jobs:(p.jobs||[]).filter(function(j){return j.id!==id})}}}) }

  var grouped = JOB_STATUSES.reduce(function(acc,s){acc[s]=jobs.filter(function(j){return j.status===s});return acc},{})
  var active = JOB_STATUSES.filter(function(s){return s!=="Rejected"&&s!=="Withdrawn"})

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"}},
    React.createElement("button",{onClick:function(){setAdding(true)},style:{width:"100%",background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:10,padding:"0.6rem",color:CAREER_GOLD,fontSize:13,fontFamily:"inherit",cursor:"pointer",fontWeight:600}},"+ Track a job opportunity"),
    jobs.length===0?React.createElement(CEmpty,{text:"No jobs tracked yet — add one above"}):
    React.createElement("div",null,
      active.map(function(status){
        var list=grouped[status]||[]; if(!list.length) return null;
        return React.createElement("div",{key:status,style:{marginBottom:"0.75rem"}},
          React.createElement("div",{style:{fontSize:10,fontWeight:700,color:"rgba(250,248,244,0.35)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}},status+" ("+list.length+")"),
          React.createElement(CCard,null,list.map(function(job){
            return React.createElement("div",{key:job.id,style:{display:"flex",alignItems:"flex-start",gap:10,padding:"0.5rem 0",borderBottom:CAREER_BORD2}},
              React.createElement("div",{style:{flex:1}},
                React.createElement("div",{style:{fontSize:13,color:CAREER_WHITE,fontWeight:600}},(job.role||"Role")+" · "+job.company),
                job.date&&React.createElement("div",{style:{fontSize:11,color:"rgba(250,248,244,0.35)",marginTop:2}},"Applied: "+job.date),
                job.notes&&React.createElement("div",{style:{fontSize:12,color:"rgba(250,248,244,0.45)",marginTop:3,lineHeight:1.5}}),job.url&&safeUrl(job.url)&&React.createElement("a",{href:safeUrl(job.url),target:"_blank",rel:"noreferrer",style:{fontSize:11,color:CAREER_GOLD,display:"block",marginTop:2}},"View posting →")),
              React.createElement("div",{style:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}},
                React.createElement("select",{value:job.status,onChange:function(e){updateStatus(job.id,e.target.value);},style:{fontSize:11,background:"rgba(30,46,82,0.95)",border:"0.5px solid rgba(250,242,229,0.1)",borderRadius:6,padding:"2px 6px",color:STATUS_COLORS[job.status]||CAREER_GOLD,fontFamily:"inherit",cursor:"pointer"}},JOB_STATUSES.map(function(s){return React.createElement("option",{key:s,value:s},s)})),
                React.createElement("button",{onClick:function(){removeJob(job.id)},style:{background:"none",border:"none",color:"rgba(250,248,244,0.2)",cursor:"pointer",fontSize:13,padding:0}},"✕")))
          })))
      }),
      (grouped["Rejected"]||[]).length>0||( grouped["Withdrawn"]||[]).length>0 ?
        React.createElement("details",{style:{marginTop:"0.5rem"}},
          React.createElement("summary",{style:{fontSize:11,color:"rgba(250,248,244,0.3)",cursor:"pointer",userSelect:"none"}},"Archived ("+(((grouped["Rejected"]||[]).length+(grouped["Withdrawn"]||[]).length))+")")):null),
    adding&&React.createElement(CModal,{title:"Track a job",onClose:function(){setAdding(false);}},
      React.createElement(CInput,{label:"Role / title",value:form.role,onChange:function(v){setForm(function(f){return{...f,role:v}});},placeholder:"e.g. Product Designer"}),
      React.createElement(CInput,{label:"Company",value:form.company,onChange:function(v){setForm(function(f){return{...f,company:v}});},placeholder:"e.g. Notion"}),
      React.createElement(CSelect,{label:"Status",value:form.status,onChange:function(v){setForm(function(f){return{...f,status:v}});},options:JOB_STATUSES.map(function(s){return{value:s,label:s}})}),
      React.createElement(CInput,{label:"Date applied",value:form.date,onChange:function(v){setForm(function(f){return{...f,date:v}});},placeholder:"e.g. May 12, 2026"}),
      React.createElement(CInput,{label:"Job posting URL",value:form.url,onChange:function(v){setForm(function(f){return{...f,url:v}});},placeholder:"https://…"}),
      React.createElement(CTextarea,{label:"Notes",value:form.notes,onChange:function(v){setForm(function(f){return{...f,notes:v}});},placeholder:"Recruiter name, salary range, interview notes…",rows:3}),
      React.createElement(CSaveBtn,{onClick:save})))
}

// ── Goals tab ─────────────────────────────────────────────────────────────────
var GOAL_AREAS = ["Career growth","Income","Skills","Work-life balance","Leadership","Entrepreneurship","Other"]

function cWriteGoalToCalendar(goal, personName) {
  if (!goal.targetDate) return
  try {
    var events = JSON.parse(localStorage.getItem("af_calEvents") || "[]")
    var goalId = "career_goal_" + goal.id
    events = events.filter(function(e){ return e.id !== goalId })
    events.push({
      id: goalId,
      title: "🎯 " + (personName ? personName + ": " : "") + goal.goal,
      date: goal.targetDate,
      color: "#c8a97a",
      notes: goal.notes || "",
      _careerGoal: true
    })
    localStorage.setItem("af_calEvents", JSON.stringify(events))
    window.dispatchEvent(new CustomEvent("af-cal-changed"))
  } catch(e) {}
}

function cRemoveGoalFromCalendar(goalId) {
  try {
    var events = JSON.parse(localStorage.getItem("af_calEvents") || "[]")
    localStorage.setItem("af_calEvents", JSON.stringify(events.filter(function(e){ return e.id !== "career_goal_"+goalId })))
    window.dispatchEvent(new CustomEvent("af-cal-changed"))
  } catch(e) {}
}

function CGoalsTab({ pid, career, setCareer, personName }) {
  var goals = (career[pid]||{}).goals || []
  var s0=useState(false); var adding=s0[0]; var setAdding=s0[1];
  var s1=useState({goal:"",area:"Career growth",targetDate:"",notes:"",done:false}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(null); var editingId=s2[0]; var setEditingId=s2[1];
  var s3=useState({goal:"",area:"Career growth",targetDate:"",notes:""}); var editForm=s3[0]; var setEditForm=s3[1];
  var s4=useState(null); var addingStepFor=s4[0]; var setAddingStepFor=s4[1];
  var s5=useState({text:"",date:"",sendTo:"none"}); var stepForm=s5[0]; var setStepForm=s5[1];
  var SEND_OPTS = [{value:"none",label:"Just here"},{value:"calendar",label:"Calendar"},{value:"brain",label:"Mind dump"},{value:"both",label:"Calendar + Mind"}];

  function writeStepToCalendar(goalLabel, step) {
    if(!step.date) return;
    try {
      var events=JSON.parse(localStorage.getItem("af_calEvents")||"[]");
      var calId="career_step_"+step.id;
      events=events.filter(function(e){return e.id!==calId;});
      events.push({id:calId,title:"🎯 "+step.text,date:step.date,color:CAREER_GOLD,notes:"Career goal step: "+goalLabel});
      localStorage.setItem("af_calEvents",JSON.stringify(events));
      window.dispatchEvent(new CustomEvent("af-cal-changed"));
    } catch(e){}
  }
  function writeStepToBrain(step) {
    try {
      var items=JSON.parse(localStorage.getItem("af_brainItems")||"[]");
      var cuid2="cstep_"+Date.now();
      items.push({id:cuid2,text:step.text,cat:"admin",done:false,scheduledDay:null,assignedTo:null});
      localStorage.setItem("af_brainItems",JSON.stringify(items));
    } catch(e){}
  }
  function addStep(goalId) {
    if(!stepForm.text.trim()) return;
    var step={id:Date.now().toString(),text:stepForm.text.trim(),date:stepForm.date,done:false};
    setCareer(function(c){
      var p=c[pid]||{};
      return Object.assign({},c,{[pid]:Object.assign({},p,{goals:(p.goals||[]).map(function(g){
        return g.id!==goalId?g:Object.assign({},g,{steps:[...(g.steps||[]),step]});
      })})});
    });
    var goalLabel=(goals.find(function(g){return g.id===goalId;})||{}).goal||"";
    if(stepForm.sendTo==="calendar"||stepForm.sendTo==="both") writeStepToCalendar(goalLabel,step);
    if(stepForm.sendTo==="brain"||stepForm.sendTo==="both") writeStepToBrain(step);
    setStepForm({text:"",date:"",sendTo:"none"});
    setAddingStepFor(null);
  }
  function toggleStep(goalId,stepId) {
    setCareer(function(c){
      var p=c[pid]||{};
      return Object.assign({},c,{[pid]:Object.assign({},p,{goals:(p.goals||[]).map(function(g){
        return g.id!==goalId?g:Object.assign({},g,{steps:(g.steps||[]).map(function(s){return s.id===stepId?Object.assign({},s,{done:!s.done}):s;})});
      })})});
    });
  }
  function removeStep(goalId,stepId) {
    setCareer(function(c){
      var p=c[pid]||{};
      return Object.assign({},c,{[pid]:Object.assign({},p,{goals:(p.goals||[]).map(function(g){
        return g.id!==goalId?g:Object.assign({},g,{steps:(g.steps||[]).filter(function(s){return s.id!==stepId;})});
      })})});
    });
    try{var evs=JSON.parse(localStorage.getItem("af_calEvents")||"[]");localStorage.setItem("af_calEvents",JSON.stringify(evs.filter(function(e){return e.id!=="career_step_"+stepId;})));window.dispatchEvent(new CustomEvent("af-cal-changed"));}catch(e){}
  }
  function save() {
    if(!form.goal.trim()) return;
    var item={id:Date.now().toString(),goal:form.goal,area:form.area,targetDate:form.targetDate,notes:form.notes,done:false,steps:[],addedAt:new Date().toISOString().split("T")[0]};
    setCareer(function(c){var p=c[pid]||{}; return Object.assign({},c,{[pid]:Object.assign({},p,{goals:[...(p.goals||[]),item]})});});
    if(form.targetDate) cWriteGoalToCalendar(item, personName);
    setForm({goal:"",area:"Career growth",targetDate:"",notes:"",done:false}); setAdding(false);
  }
  function toggle(id) {
    setCareer(function(c){var p=c[pid]||{}; return Object.assign({},c,{[pid]:Object.assign({},p,{goals:(p.goals||[]).map(function(g){return g.id===id?Object.assign({},g,{done:!g.done}):g;})})});});
  }
  function remove(id) {
    setCareer(function(c){var p=c[pid]||{}; return Object.assign({},c,{[pid]:Object.assign({},p,{goals:(p.goals||[]).filter(function(g){return g.id!==id;})})});});
    cRemoveGoalFromCalendar(id);
  }
  function startEdit(g) { setEditingId(g.id); setEditForm({goal:g.goal||"",area:g.area||"Career growth",targetDate:g.targetDate||"",notes:g.notes||""}); }
  function saveEdit() {
    setCareer(function(c){
      var p=c[pid]||{};
      return Object.assign({},c,{[pid]:Object.assign({},p,{goals:(p.goals||[]).map(function(g){return g.id!==editingId?g:Object.assign({},g,editForm);})})});
    });
    if(editForm.targetDate) cWriteGoalToCalendar(Object.assign({id:editingId},editForm), personName);
    else cRemoveGoalFromCalendar(editingId);
    setEditingId(null);
  }
  function fmtDate(d) {
    if(!d) return "";
    var parts=d.split("-"); var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[parseInt(parts[1])-1]+" "+parseInt(parts[2])+", "+parts[0];
  }
  function daysUntilGoal(d) {
    if(!d) return null;
    var now=new Date(); now.setHours(0,0,0,0);
    return Math.round((new Date(d+"T00:00:00")-now)/86400000);
  }

  var active=goals.filter(function(g){return !g.done;});
  var done=goals.filter(function(g){return g.done;});

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"}},
    React.createElement("button",{onClick:function(){setAdding(true);},style:{width:"100%",background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:10,padding:"0.6rem",color:CAREER_GOLD,fontSize:13,fontFamily:"inherit",cursor:"pointer",fontWeight:600}},"+ Add a goal"),

    active.length===0&&done.length===0
      ? React.createElement(CEmpty,{text:"No goals yet — what are you working toward?"})
      : React.createElement("div",null,
          active.length>0&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:8}},
            active.map(function(g){
              var days=daysUntilGoal(g.targetDate);
              var isEditing=editingId===g.id;
              var steps=g.steps||[];
              var doneSteps=steps.filter(function(s){return s.done;}).length;
              return React.createElement("div",{key:g.id,style:{background:CAREER_SURF,border:CAREER_BORD,borderRadius:10,overflow:"hidden"}},
                !isEditing&&React.createElement("div",{style:{padding:"10px 12px"}},
                  React.createElement("div",{style:{display:"flex",alignItems:"flex-start",gap:10}},
                    React.createElement("button",{onClick:function(){toggle(g.id);},style:{width:18,height:18,borderRadius:4,border:"1.5px solid rgba(200,169,122,0.4)",background:"none",cursor:"pointer",flexShrink:0,marginTop:2}}),
                    React.createElement("div",{style:{flex:1,minWidth:0}},
                      React.createElement("div",{style:{fontSize:13,color:CAREER_WHITE,fontWeight:600,lineHeight:1.4}},g.goal),
                      React.createElement("div",{style:{fontSize:11,color:CAREER_GOLD,marginTop:3}},g.area),
                      g.targetDate&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginTop:4}},
                        React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.5)"}},"📅 "+fmtDate(g.targetDate)),
                        days!==null&&React.createElement("span",{style:{fontSize:10,fontWeight:700,color:days<0?"rgba(250,248,244,0.3)":days<=14?"#c8834a":CAREER_GOLD,background:days<0?"rgba(250,242,229,0.04)":days<=14?"rgba(200,131,74,0.1)":"rgba(200,169,122,0.1)",borderRadius:8,padding:"1px 7px"}},days<0?"passed":days===0?"Today!":days+"d away")
                      ),
                      steps.length>0&&React.createElement("div",{style:{fontSize:11,color:"rgba(250,248,244,0.35)",marginTop:3}},doneSteps+"/"+steps.length+" steps done"),
                      g.notes&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.45)",lineHeight:1.5,margin:"6px 0 0"}},g.notes)
                    ),
                    React.createElement("div",{style:{display:"flex",gap:4,flexShrink:0}},
                      React.createElement("button",{onClick:function(){startEdit(g);},style:{background:"none",border:"none",fontSize:12,color:"rgba(200,169,122,0.4)",cursor:"pointer",padding:"2px 4px"}},"✏️"),
                      React.createElement("button",{onClick:function(){remove(g.id);},style:{background:"none",border:"none",fontSize:12,color:"rgba(250,248,244,0.2)",cursor:"pointer",padding:"2px 4px"}},"✕")
                    )
                  ),
                  // Steps list
                  React.createElement("div",{style:{marginTop:8,paddingLeft:26}},
                    steps.map(function(s){
                      return React.createElement("div",{key:s.id,style:{display:"flex",alignItems:"center",gap:7,padding:"4px 0",borderBottom:"0.5px solid rgba(250,242,229,0.05)"}},
                        React.createElement("button",{onClick:function(){toggleStep(g.id,s.id);},style:{width:15,height:15,borderRadius:3,border:"1.5px solid rgba(200,169,122,0.35)",background:s.done?"rgba(200,169,122,0.35)":"none",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:CAREER_GOLD}},s.done?"✓":""),
                        React.createElement("span",{style:{flex:1,fontSize:12,color:s.done?"rgba(250,248,244,0.3)":CAREER_WHITE,textDecoration:s.done?"line-through":"none",lineHeight:1.3}},s.text),
                        s.date&&React.createElement("span",{style:{fontSize:10,color:"rgba(250,248,244,0.3)",flexShrink:0}},fmtDate(s.date)),
                        React.createElement("button",{onClick:function(){removeStep(g.id,s.id);},style:{background:"none",border:"none",color:"rgba(250,248,244,0.2)",cursor:"pointer",fontSize:11,padding:0,flexShrink:0}},"✕")
                      );
                    }),
                    addingStepFor===g.id
                      ? React.createElement("div",{style:{marginTop:7,background:"rgba(250,242,229,0.04)",borderRadius:8,padding:"9px"}},
                          React.createElement("input",{value:stepForm.text,onChange:function(e){setStepForm(function(f){return Object.assign({},f,{text:e.target.value});});},placeholder:"Action step…",autoFocus:true,style:Object.assign({},C_INP_STYLE,{marginBottom:7,fontSize:12})}),
                          React.createElement("div",{style:{display:"flex",gap:7,marginBottom:7}},
                            React.createElement("div",{style:{flex:1}},
                              React.createElement("label",{style:{display:"block",fontSize:10,color:"rgba(250,248,244,0.35)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:3}},"Due date"),
                              React.createElement("input",{type:"date",value:stepForm.date,onChange:function(e){setStepForm(function(f){return Object.assign({},f,{date:e.target.value});});},style:C_INP_STYLE})
                            ),
                            React.createElement("div",{style:{flex:1}},
                              React.createElement("label",{style:{display:"block",fontSize:10,color:"rgba(250,248,244,0.35)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:3}},"Also send to"),
                              React.createElement("select",{value:stepForm.sendTo,onChange:function(e){setStepForm(function(f){return Object.assign({},f,{sendTo:e.target.value});});},style:Object.assign({},C_INP_STYLE,{background:"rgba(30,46,82,0.95)"})},
                                SEND_OPTS.map(function(o){return React.createElement("option",{key:o.value,value:o.value},o.label);})
                              )
                            )
                          ),
                          React.createElement("div",{style:{display:"flex",gap:6}},
                            React.createElement("button",{onClick:function(){addStep(g.id);},style:{flex:1,background:CAREER_GOLD,color:CAREER_NAVY,border:"none",borderRadius:7,padding:"6px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"Add step"),
                            React.createElement("button",{onClick:function(){setAddingStepFor(null);},style:{background:"rgba(250,242,229,0.06)",border:CAREER_BORD2,borderRadius:7,padding:"6px 10px",fontSize:12,color:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"inherit"}},"Cancel")
                          )
                        )
                      : React.createElement("button",{onClick:function(){setAddingStepFor(g.id);setStepForm({text:"",date:"",sendTo:"none"});},style:{marginTop:7,background:"rgba(200,169,122,0.07)",border:"0.5px solid rgba(200,169,122,0.2)",borderRadius:7,padding:"4px 10px",fontSize:11,color:CAREER_GOLD,fontFamily:"inherit",cursor:"pointer",width:"100%"}},"+ Add step")
                  )
                ),
                isEditing&&React.createElement("div",{style:{padding:"12px"}},
                  React.createElement("input",{value:editForm.goal,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{goal:e.target.value});});},placeholder:"Goal",style:Object.assign({},C_INP_STYLE,{marginBottom:8})}),
                  React.createElement("select",{value:editForm.area,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{area:e.target.value});});},style:Object.assign({},C_INP_STYLE,{marginBottom:8,background:"rgba(30,46,82,0.95)"})},
                    GOAL_AREAS.map(function(a){return React.createElement("option",{key:a,value:a},a);})
                  ),
                  React.createElement("div",{style:{marginBottom:8}},
                    React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},"Target date"),
                    React.createElement("input",{type:"date",value:editForm.targetDate,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{targetDate:e.target.value});});},style:C_INP_STYLE})
                  ),
                  React.createElement("textarea",{value:editForm.notes,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{notes:e.target.value});});},placeholder:"Notes…",rows:2,style:Object.assign({},C_INP_STYLE,{resize:"vertical",marginBottom:8})}),
                  React.createElement("div",{style:{display:"flex",gap:8}},
                    React.createElement("button",{onClick:saveEdit,style:{flex:1,background:CAREER_GOLD,color:CAREER_NAVY,border:"none",borderRadius:7,padding:"7px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"Save"),
                    React.createElement("button",{onClick:function(){setEditingId(null);},style:{background:"rgba(250,242,229,0.06)",border:CAREER_BORD2,borderRadius:7,padding:"7px 12px",fontSize:12,color:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"inherit"}},"Cancel")
                  )
                )
              );
            })
          ),
          done.length>0&&React.createElement("div",{style:{marginTop:"0.5rem"}},
            React.createElement("div",{style:{fontSize:10,color:"rgba(250,248,244,0.3)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}},"Achieved ("+done.length+")"),
            done.map(function(g){
              return React.createElement("div",{key:g.id,style:{display:"flex",alignItems:"center",gap:8,padding:"0.35rem 0",opacity:0.5}},
                React.createElement("span",{style:{fontSize:12,color:CAREER_GOLD,cursor:"pointer"},onClick:function(){toggle(g.id);}},"✓"),
                React.createElement("span",{style:{fontSize:12,color:CAREER_WHITE,textDecoration:"line-through"}},g.goal),
                React.createElement("button",{onClick:function(){remove(g.id);},style:{background:"none",border:"none",fontSize:11,color:"rgba(250,248,244,0.2)",cursor:"pointer",marginLeft:"auto",padding:0}},"✕")
              );
            })
          )
        ),

    adding&&React.createElement(CModal,{title:"Add a career goal",onClose:function(){setAdding(false);}},
      React.createElement(CInput,{label:"Goal",value:form.goal,onChange:function(v){setForm(function(f){return Object.assign({},f,{goal:v});});},placeholder:"e.g. Lead my first product launch"}),
      React.createElement(CSelect,{label:"Area",value:form.area,onChange:function(v){setForm(function(f){return Object.assign({},f,{area:v});});},options:GOAL_AREAS.map(function(a){return{value:a,label:a};})}),
      React.createElement("div",{style:{marginBottom:"0.7rem"}},
        React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},"Target date (adds to your calendar)"),
        React.createElement("input",{type:"date",value:form.targetDate,onChange:function(e){setForm(function(f){return Object.assign({},f,{targetDate:e.target.value});});},style:C_INP_STYLE})
      ),
      form.targetDate&&React.createElement("div",{style:{fontSize:11,color:"rgba(122,158,142,0.8)",background:"rgba(122,158,142,0.08)",borderRadius:7,padding:"6px 10px",marginBottom:"0.7rem"}},"\u2713 This goal will appear on your calendar and Compass will remind you."),
      React.createElement(CTextarea,{label:"Notes",value:form.notes,onChange:function(v){setForm(function(f){return Object.assign({},f,{notes:v});});},placeholder:"What does success look like?",rows:3}),
      React.createElement(CSaveBtn,{onClick:save}))
  );
}

// ── Wins & Notes tab ──────────────────────────────────────────────────────────
function CWinsTab({ pid, career, setCareer }) {
  var wins = (career[pid]||{}).wins || []
  var s0=useState(false); var adding=s0[0]; var setAdding=s0[1];
  var s1=useState({title:"",date:"",body:"",type:"win"}); var form=s1[0]; var setForm=s1[1];

  function save() {
    if(!form.title.trim()) return
    var item={id:cuid(),...form,addedAt:new Date().toISOString().split("T")[0]}
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,wins:[...(p.wins||[]),item]}}})
    setForm({title:"",date:"",body:"",type:"win"}); setAdding(false)
  }
  function remove(id) { setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,wins:(p.wins||[]).filter(function(w){return w.id!==id})}}}) }
  var TYPE_ICON = {win:"🏆",feedback:"💬",reflection:"💭",note:"📝"}

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"}},
    React.createElement("button",{onClick:function(){setAdding(true)},style:{width:"100%",background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:10,padding:"0.6rem",color:CAREER_GOLD,fontSize:13,fontFamily:"inherit",cursor:"pointer",fontWeight:600}},"+ Log a win or note"),
    wins.length===0?React.createElement(CEmpty,{text:"Start logging wins — they add up fast."}):
      React.createElement("div",null,wins.slice().reverse().map(function(w){
        return React.createElement(CCard,{key:w.id,style:{marginBottom:"0.5rem"}},
          React.createElement("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:w.body?"0.4rem":0}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,flex:1}},
              React.createElement("span",{style:{fontSize:16,flexShrink:0}},TYPE_ICON[w.type]||"📝"),
              React.createElement("span",{style:{fontSize:13,fontWeight:600,color:CAREER_WHITE}}),w.title),
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,flexShrink:0}},
              w.date&&React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.3)"}}),w.date,
              React.createElement("button",{onClick:function(){remove(w.id)},style:{background:"none",border:"none",color:"rgba(250,248,244,0.2)",cursor:"pointer",fontSize:13,padding:0}},"✕"))),
          w.body&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.5)",lineHeight:1.6,margin:0,paddingLeft:24}}),w.body)})),
    adding&&React.createElement(CModal,{title:"Log a win or note",onClose:function(){setAdding(false);}},
      React.createElement(CSelect,{label:"Type",value:form.type,onChange:function(v){setForm(function(f){return{...f,type:v}});},options:[{value:"win",label:"🏆 Win"},{value:"feedback",label:"💬 Feedback received"},{value:"reflection",label:"💭 Reflection"},{value:"note",label:"📝 Note"}]}),
      React.createElement(CInput,{label:"Title",value:form.title,onChange:function(v){setForm(function(f){return{...f,title:v}});},placeholder:"e.g. Landed the Acme account"}),
      React.createElement(CInput,{label:"Date",value:form.date,onChange:function(v){setForm(function(f){return{...f,date:v}});},placeholder:"e.g. May 2026"}),
      React.createElement(CTextarea,{label:"Details",value:form.body,onChange:function(v){setForm(function(f){return{...f,body:v}});},placeholder:"What happened? What did you do well?",rows:4}),
      React.createElement(CSaveBtn,{onClick:save})))
}

// ── Docs & Links tab ──────────────────────────────────────────────────────────
function CDocsTab({ pid, career, setCareer }) {
  var docs = (career[pid]||{}).docs || []
  var s0=useState(false); var adding=s0[0]; var setAdding=s0[1];
  var s1=useState({label:"",url:"",note:"",type:"resume",file:"",fileName:"",fileType:""}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(false); var uploading=s2[0]; var setUploading=s2[1];
  var DOC_TYPES = [{value:"resume",label:"Resume"},{value:"portfolio",label:"Portfolio"},{value:"linkedin",label:"LinkedIn"},{value:"cover",label:"Cover letter"},{value:"reference",label:"Reference"},{value:"cert",label:"Certification"},{value:"other",label:"Other"}]
  var TYPE_ICON = {resume:"📄",portfolio:"🎨",linkedin:"🔗",cover:"✉️",reference:"👤",cert:"🏅",other:"📎"}

  function handleFile(e) {
    var file = e.target.files[0]; if(!file) return
    setUploading(true)
    var reader = new FileReader()
    reader.onload = function(ev) {
      setForm(function(f){ return Object.assign({},f,{file:ev.target.result,fileName:file.name,fileType:file.type,label:f.label||file.name.replace(/\.[^.]+$/,"")}) })
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  function save() {
    if(!form.label.trim()) return
    var item = {id:cuid(),label:form.label,url:form.url,note:form.note,type:form.type,file:form.file,fileName:form.fileName,fileType:form.fileType}
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,docs:[...(p.docs||[]),item]}}})
    setForm({label:"",url:"",note:"",type:"resume",file:"",fileName:"",fileType:""}); setAdding(false)
  }
  function remove(id) { setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,docs:(p.docs||[]).filter(function(d){return d.id!==id})}}}) }

  function openFile(doc) {
    if(doc.file) {
      var a=document.createElement("a"); a.href=doc.file; a.download=doc.fileName||"document"; a.click()
    } else if(doc.url) {
      var safe = safeUrl(doc.url);
      if (safe) window.open(safe,"_blank","noreferrer");
      else alert("That doesn't look like a valid URL: \"" + doc.url + "\"");
    }
  }

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"}},
    React.createElement("button",{onClick:function(){setAdding(true)},style:{width:"100%",background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:10,padding:"0.6rem",color:CAREER_GOLD,fontSize:13,fontFamily:"inherit",cursor:"pointer",fontWeight:600}},"+ Add doc, file, or link"),

    docs.length===0?React.createElement(CEmpty,{text:"Store your resume, portfolio, certs, and more"}):
      React.createElement(CCard,null,docs.map(function(doc){
        return React.createElement("div",{key:doc.id,style:{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",borderBottom:CAREER_BORD2}},
          React.createElement("span",{style:{fontSize:18,flexShrink:0,marginTop:1}},(TYPE_ICON[doc.type]||"📎")),
          React.createElement("div",{style:{flex:1,minWidth:0}},
            React.createElement("div",{style:{fontSize:13,color:CAREER_WHITE,fontWeight:600}}),doc.label,
            doc.fileName&&React.createElement("div",{style:{fontSize:11,color:"rgba(250,248,244,0.4)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},"📎 "+doc.fileName),
            React.createElement("div",{style:{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"}},
              (doc.file||doc.url)&&React.createElement("button",{onClick:function(){openFile(doc)},style:{fontSize:11,color:CAREER_GOLD,background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.25)",borderRadius:6,padding:"3px 9px",cursor:"pointer",fontFamily:"inherit"}},doc.file?"⬇ Download":"Open →"),
              doc.note&&React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.35)"}}),doc.note
            )
          ),
          React.createElement("button",{onClick:function(){remove(doc.id)},style:{background:"none",border:"none",color:"rgba(250,248,244,0.2)",cursor:"pointer",fontSize:13,padding:0,flexShrink:0}},"✕")
        )
      })),

    adding&&React.createElement(CModal,{title:"Add doc, file, or link",onClose:function(){setAdding(false);}},
      React.createElement(CSelect,{label:"Type",value:form.type,onChange:function(v){setForm(function(f){return Object.assign({},f,{type:v})});},options:DOC_TYPES}),
      React.createElement(CInput,{label:"Label",value:form.label,onChange:function(v){setForm(function(f){return Object.assign({},f,{label:v})});},placeholder:"e.g. My resume (2026 version)"}),

      // File upload zone
      React.createElement("div",{style:{marginBottom:"0.7rem"}},
        React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}},"Upload a file"),
        React.createElement("label",{style:{display:"flex",alignItems:"center",gap:10,background:"rgba(250,242,229,0.05)",border:form.file?"0.5px solid rgba(122,158,142,0.4)":"0.5px dashed rgba(250,242,229,0.2)",borderRadius:10,padding:"12px 14px",cursor:"pointer"}},
          React.createElement("span",{style:{fontSize:20}}),form.file?"✅":"📂",
          React.createElement("div",null,
            form.file
              ? React.createElement("div",null,
                  React.createElement("div",{style:{fontSize:12,color:"rgba(122,158,142,0.9)",fontWeight:600}}),form.fileName,
                  React.createElement("div",{style:{fontSize:11,color:"rgba(250,248,244,0.3)",marginTop:2}},"Tap to replace")
                )
              : React.createElement("div",null,
                  React.createElement("div",{style:{fontSize:12,color:"rgba(250,248,244,0.6)",fontWeight:500}},uploading?"Uploading…":"Choose a file"),
                  React.createElement("div",{style:{fontSize:11,color:"rgba(250,248,244,0.3)",marginTop:2}},"PDF, Word, image — any file type")
                )
          ),
          React.createElement("input",{type:"file",accept:"*/*",style:{display:"none"},onChange:handleFile})
        )
      ),

      // OR a URL
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:"0.7rem"}},
        React.createElement("div",{style:{flex:1,height:1,background:"rgba(250,242,229,0.1)"}}),
        React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.3)"}},"or"),
        React.createElement("div",{style:{flex:1,height:1,background:"rgba(250,242,229,0.1)"}})
      ),
      React.createElement(CInput,{label:"Link / URL",value:form.url,onChange:function(v){setForm(function(f){return Object.assign({},f,{url:v})});},placeholder:"https://…"}),
      React.createElement(CInput,{label:"Note (optional)",value:form.note,onChange:function(v){setForm(function(f){return Object.assign({},f,{note:v})});},placeholder:"e.g. Last updated May 2026"}),
      React.createElement(CSaveBtn,{onClick:save}))
  )
}

// ── CareerSection (dashboard + drill-in) ─────────────────────────────────────
function CareerSection() {
  var s_people=useState(hLoadPeople()); var people=s_people[0]; var setPeople=s_people[1];
  var careerPair=useCareer(); var career=careerPair[0]; var setCareer=careerPair[1];
  // detail: null = dashboard, {pid, tab} = person detail
  var s_detail=useState(null); var detail=s_detail[0]; var setDetail=s_detail[1];
  var s_addP=useState(false); var addingPerson=s_addP[0]; var setAddingPerson=s_addP[1];
  var s_name=useState(""); var newPersonName=s_name[0]; var setNewPersonName=s_name[1];
  // person-level tab selection persisted in detail state
  var s_pidx=useState(0); var personIdx=s_pidx[0]; var setPersonIdx=s_pidx[1];

  function savePerson() {
    var name=newPersonName.trim(); if(!name) return;
    var color=PERSON_COLORS[people.length%PERSON_COLORS.length];
    var newP={id:"p_"+Math.random().toString(36).slice(2,9),name:name,color:color};
    var updated=people.concat([newP]);
    setPeople(updated); hSavePeople(updated);
    setNewPersonName(""); setAddingPerson(false);
  }

  function removePerson(idx) {
    if(people.length<=1) return;
    var updated=people.filter(function(_,i){return i!==idx;});
    hSavePeople(updated); setPeople(updated);
    setPersonIdx(Math.max(0,idx-1));
    if(detail&&detail.pid===updated[Math.max(0,idx-1)]&&!updated.find(function(p){return p.id===detail.pid;})) setDetail(null);
  }

  // helper: compute stats for a person
  function getStats(pid) {
    var d=career[pid]||{};
    var jobs=(d.jobs||[]);
    var activeJobs=jobs.filter(function(j){return j.status==="Interview"||j.status==="Applied"||j.status==="Offer";}).length;
    var goals=(d.goals||[]).filter(function(g){return !g.done;}).length;
    var skills=(d.skills||[]).length;
    var wins=(d.wins||[]).length;
    var interviews=jobs.filter(function(j){return j.status==="Interview";}).length;
    var goalsDone=(d.goals||[]).filter(function(g){return g.done;}).length;
    var lastWin=(d.wins||[])[0];
    return {activeJobs:activeJobs,goals:goals,skills:skills,wins:wins,interviews:interviews,goalsDone:goalsDone,lastWin:lastWin,jobs:jobs.slice(0,3),goalList:(d.goals||[]).filter(function(g){return !g.done;}).slice(0,2)};
  }

  var CSURF="rgba(250,242,229,0.05)";
  var CSURF2="rgba(250,242,229,0.04)";
  var CBORD2="0.5px solid rgba(250,242,229,0.08)";
  var STATUS_COLOR={"Interview":"#85B7EB","Applied":"#EF9F27","Offer":"#97C459","Researching":"rgba(250,248,244,0.4)","Rejected":"rgba(250,248,244,0.25)"};

  // ── Dashboard overview ────────────────────────────────────────────────────
  if(!detail) {
    return React.createElement("div",null,
      React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}},
        React.createElement("div",{style:{fontFamily:"Cormorant Garamond,serif",fontSize:22,fontWeight:600,color:CAREER_WHITE}},"Career"),
        React.createElement("button",{onClick:function(){setAddingPerson(true);},style:{fontSize:12,color:CAREER_GOLD,background:"rgba(200,169,122,0.08)",border:"0.5px solid rgba(200,169,122,0.28)",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"\u002B Add person")
      ),
      React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.35)",fontFamily:"DM Sans,sans-serif",marginBottom:18,marginTop:2}},"Tap a card to open"),
      React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:12}},
        people.map(function(p,i){
          var stats=getStats(p.id);
          var initials=p.name.split(" ").map(function(w){return w[0];}).join("").slice(0,2).toUpperCase();
          return React.createElement("div",{key:p.id,onClick:function(){setPersonIdx(i);setDetail({pid:p.id,tab:"resume"});},style:{background:CSURF,border:CAREER_BORD,borderRadius:12,padding:"14px 16px",cursor:"pointer"}},
            // person header
            React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10}},
                React.createElement("div",{style:{width:34,height:34,borderRadius:"50%",background:p.color||CAREER_GOLD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:CAREER_NAVY,flexShrink:0}},initials),
                React.createElement("span",{style:{fontSize:14,fontWeight:500,color:CAREER_WHITE}},p.name)
              ),
              React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.3)"}},">")
            ),
            // 4 stat grid
            React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:stats.jobs.length||stats.goalList.length?12:0}},
              React.createElement("div",{style:{background:CSURF2,borderRadius:8,padding:"7px 8px"}},
                React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.38)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Active apps"),
                React.createElement("p",{style:{fontSize:17,fontWeight:500,color:CAREER_WHITE,margin:0}},stats.activeJobs)
              ),
              React.createElement("div",{style:{background:CSURF2,borderRadius:8,padding:"7px 8px"}},
                React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.38)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Interviews"),
                React.createElement("p",{style:{fontSize:17,fontWeight:500,color:stats.interviews>0?CAREER_GOLD:CAREER_WHITE,margin:0}},stats.interviews)
              ),
              React.createElement("div",{style:{background:CSURF2,borderRadius:8,padding:"7px 8px"}},
                React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.38)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Goals"),
                React.createElement("p",{style:{fontSize:17,fontWeight:500,color:CAREER_WHITE,margin:0}},stats.goals)
              ),
              React.createElement("div",{style:{background:CSURF2,borderRadius:8,padding:"7px 8px"}},
                React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.38)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Skills"),
                React.createElement("p",{style:{fontSize:17,fontWeight:500,color:CAREER_WHITE,margin:0}},stats.skills)
              )
            ),
            // preview: top jobs
            stats.jobs.length>0&&React.createElement("div",{style:{borderTop:CBORD2,paddingTop:8}},
              stats.jobs.map(function(j,ji){
                return React.createElement("div",{key:ji,style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"3px 0",fontSize:12}},
                  React.createElement("span",{style:{color:"rgba(250,248,244,0.6)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"65%"}},(j.company||"Company")+(j.role?" — "+j.role:"")),
                  React.createElement("span",{style:{fontSize:11,padding:"1px 7px",borderRadius:10,background:"rgba(250,242,229,0.06)",color:STATUS_COLOR[j.status]||"rgba(250,248,244,0.4)",border:"0.5px solid rgba(250,242,229,0.1)",whiteSpace:"nowrap"}},j.status||"—")
                );
              })
            )
          );
        }),
        // add card
        React.createElement("div",{onClick:function(){setAddingPerson(true);},style:{background:"rgba(250,242,229,0.02)",border:"0.5px dashed rgba(250,242,229,0.15)",borderRadius:12,minHeight:60,display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}},
          React.createElement("span",{style:{fontSize:18,color:"rgba(250,248,244,0.2)"}},"+"),
          React.createElement("span",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",fontFamily:"DM Sans,sans-serif"}},"Add person")
        )
      ),
      addingPerson&&React.createElement(HModal,{title:"Add person",onClose:function(){setAddingPerson(false);setNewPersonName("");}},
        React.createElement(HInput,{label:"Name",value:newPersonName,onChange:setNewPersonName,placeholder:"e.g. Twyla, Ellie, Sam"}),
        React.createElement(HSaveBtn,{onClick:savePerson,label:"Add person"})
      )
    );
  }

  // ── Person detail view ────────────────────────────────────────────────────
  var person=people[personIdx];
  if(!person) { setDetail(null); return null; }
  var tp={pid:person.id,career:career,setCareer:setCareer,personName:person.name};
  var initials=person.name.split(" ").map(function(w){return w[0];}).join("").slice(0,2).toUpperCase();

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",height:"100%"}},
    // back + person header + person switcher
    React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:14}},
      React.createElement("button",{onClick:function(){setDetail(null);},style:{background:"rgba(250,242,229,0.06)",border:CAREER_BORD,borderRadius:8,padding:"5px 10px",fontSize:12,color:"rgba(250,248,244,0.5)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"\u2190 All"),
      React.createElement("div",{style:{width:28,height:28,borderRadius:"50%",background:person.color||CAREER_GOLD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:CAREER_NAVY,flexShrink:0}},initials),
      React.createElement("span",{style:{fontSize:15,fontWeight:500,color:CAREER_WHITE,flex:1}},person.name),
      personIdx>0&&React.createElement("button",{onClick:function(){removePerson(personIdx);},style:{background:"none",border:"none",fontSize:12,color:"rgba(250,248,244,0.25)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Remove")
    ),
    // subtabs
    React.createElement("div",{style:{display:"flex",borderBottom:"0.5px solid rgba(250,242,229,0.08)",background:"rgba(0,0,0,0.15)",overflowX:"auto",flexShrink:0}},
      C_TABS.map(function(t){
        return React.createElement("button",{key:t.id,onClick:function(){setDetail(function(d){return Object.assign({},d,{tab:t.id});});},style:{padding:"0.55rem 0.85rem",fontSize:12,background:"none",border:"none",borderBottom:t.id===detail.tab?"2px solid rgba(250,248,244,0.5)":"2px solid transparent",color:t.id===detail.tab?CAREER_WHITE:"rgba(250,248,244,0.4)",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}},t.label)
      })),
    React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"1rem 0",display:"flex",flexDirection:"column",gap:"0.9rem"}},
      detail.tab==="resume" && React.createElement(CResumeTab,tp),
      detail.tab==="jobs"   && React.createElement(CJobsTab,  tp),
      detail.tab==="goals"  && React.createElement(CGoalsTab, tp),
      detail.tab==="wins"   && React.createElement(CWinsTab,  tp),
      detail.tab==="docs"   && React.createElement(CDocsTab,  tp)
    ),
    addingPerson&&React.createElement(HModal,{title:"Add person",onClose:function(){setAddingPerson(false);setNewPersonName("");}},
      React.createElement(HInput,{label:"Name",value:newPersonName,onChange:setNewPersonName,placeholder:"e.g. Twyla, Ellie, Sam"}),
      React.createElement(HSaveBtn,{onClick:savePerson,label:"Add person"})
    )
  );
}

// ── Health Section ────────────────────────────────────────────────────────────
var HGOLD  = "#c8a97a"
var HWHITE = "#faf8f4"
var HNAVY  = "#243A5A"
var HSURF  = "rgba(250,242,229,0.05)"
var HSURF2 = "rgba(250,242,229,0.04)"
var HBORD  = "0.5px solid rgba(250,242,229,0.1)"
var HBORD2 = "0.5px solid rgba(250,242,229,0.08)"

var HBADGE = {
  ok:      { bg:"rgba(99,153,34,0.15)",    color:"#97C459", border:"rgba(99,153,34,0.2)"    },
  due:     { bg:"rgba(239,159,39,0.12)",   color:"#EF9F27", border:"rgba(239,159,39,0.2)"   },
  rx:      { bg:"rgba(55,138,221,0.12)",   color:"#85B7EB", border:"rgba(55,138,221,0.2)"   },
  allergy: { bg:"rgba(216,90,48,0.12)",    color:"#F0997B", border:"rgba(216,90,48,0.2)"    },
  alive:   { bg:"rgba(99,153,34,0.12)",    color:"#97C459", border:"rgba(99,153,34,0.2)"    },
  deceased:{ bg:"rgba(136,135,128,0.12)",  color:"rgba(250,248,244,0.4)", border:"rgba(136,135,128,0.2)" },
  gray:    { bg:"rgba(250,242,229,0.06)",  color:"rgba(250,248,244,0.45)", border:"rgba(250,242,229,0.1)" },
}
var HPILL = {
  heart:    { bg:"rgba(216,90,48,0.1)",    color:"#F0997B", border:"rgba(216,90,48,0.2)"    },
  cancer:   { bg:"rgba(153,53,86,0.12)",   color:"#ED93B1", border:"rgba(153,53,86,0.2)"    },
  diabetes: { bg:"rgba(239,159,39,0.12)",  color:"#EF9F27", border:"rgba(239,159,39,0.2)"   },
  mental:   { bg:"rgba(127,119,221,0.12)", color:"#AFA9EC", border:"rgba(127,119,221,0.2)"  },
  neuro:    { bg:"rgba(29,158,117,0.12)",  color:"#5DCAA5", border:"rgba(29,158,117,0.2)"   },
  other:    { bg:"rgba(250,242,229,0.06)", color:"rgba(250,248,244,0.5)", border:"rgba(250,242,229,0.1)" },
}
var H_TABS = [
  { id:"history",   label:"Medical history" },
  { id:"immunize",  label:"Immunizations"   },
  { id:"meds",      label:"Medications"     },
  { id:"dosing",    label:"Dosing"          },
  { id:"allergies", label:"Allergies"       },
  { id:"family",    label:"Family history"  },
  { id:"notes",     label:"Appt notes"      },
  { id:"appts",     label:"Appointments"    },
]
var H_REL_ROLES = ["Maternal grandmother","Maternal grandfather","Mother","Maternal aunt","Maternal uncle","Paternal grandmother","Paternal grandfather","Father","Paternal aunt","Paternal uncle","Sibling","Other"]
var H_COND_TYPES = [
  { id:"heart",    label:"Heart / cardiovascular" },
  { id:"cancer",   label:"Cancer" },
  { id:"diabetes", label:"Diabetes" },
  { id:"mental",   label:"Mental health" },
  { id:"neuro",    label:"Neurological" },
  { id:"other",    label:"Other" },
]

function huid() { return Math.random().toString(36).slice(2,9) }
function hLoadHealth() { try { var s=localStorage.getItem("af_health"); return s?JSON.parse(s):{}; } catch(e){return {};} }
function hSaveHealth(v) { try { localStorage.setItem("af_health",JSON.stringify(v)); } catch(e){} }
function useHealth() {
  var pair = useState(hLoadHealth); var val=pair[0]; var setRaw=pair[1];
  function set(next) { setRaw(function(prev){ var r=typeof next==="function"?next(prev):next; hSaveHealth(r); return r; }); }
  return [val, set];
}

// ── Private PIN helpers ───────────────────────────────────────────────────────
// F-46: PIN is stored as a SHA-256 hex hash, never plaintext. hHashPin is the
// only async piece here (Web Crypto's subtle.digest) — every caller below
// awaits it before comparing/storing.
function hIsHashedPin(v) { return typeof v==="string" && /^[0-9a-f]{64}$/i.test(v); }
async function hHashPin(pin) {
  var enc = new TextEncoder().encode(String(pin));
  var buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.prototype.map.call(new Uint8Array(buf), function(b){ return b.toString(16).padStart(2,"0"); }).join("");
}
function hGetPrivatePin() { try { return localStorage.getItem("af_health_pin")||null; } catch{return null;} }
function hSetPrivatePinRaw(hash) { try { localStorage.setItem("af_health_pin",hash); } catch{} }
async function hSetPrivatePin(pin) { hSetPrivatePinRaw(await hHashPin(pin)); }

// HPrivateLock: wraps content behind a PIN gate. Set pin=null to prompt setup.
function HPrivateLock(props) {
  var storedPin=hGetPrivatePin();
  var s0=useState(false); var unlocked=s0[0]; var setUnlocked=s0[1];
  var s1=useState(""); var entered=s1[0]; var setEntered=s1[1];
  var s2=useState(""); var confirm=s2[0]; var setConfirm=s2[1];
  var s3=useState(false); var setting=s3[0]; var setSetting=s3[1];
  var s4=useState(null); var err=s4[0]; var setErr=s4[1];
  var s5=useState(0); var migTick=s5[0]; var setMigTick=s5[1];
  // F-46: one-time silent migration. An existing plaintext PIN (a short
  // numeric string, not a 64-char hex hash) is hashed and re-stored the
  // first time this gate mounts post-change — existing users aren't logged
  // out or asked to re-set anything. migTick forces storedPin (read fresh
  // from localStorage above) to be re-evaluated once the rewrite lands.
  useEffect(function(){
    var raw=hGetPrivatePin();
    if(raw && !hIsHashedPin(raw)){
      hHashPin(raw).then(function(hash){ hSetPrivatePinRaw(hash); setMigTick(function(n){return n+1;}); });
    }
  },[]); // eslint-disable-line
  var inputStyle={width:"100%",background:"rgba(250,242,229,0.07)",border:HBORD,borderRadius:8,padding:"0.55rem 0.75rem",color:HWHITE,fontSize:18,letterSpacing:"0.4em",textAlign:"center",fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  if(unlocked) return React.createElement(React.Fragment,null,
    React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:"0.6rem"}},
      React.createElement("span",{style:{fontSize:11,color:HGOLD,opacity:0.7}},"🔒 Private"),
      React.createElement("button",{onClick:function(){setUnlocked(false);setEntered("");},style:{fontSize:11,color:"rgba(250,248,244,0.35)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}},"Lock")
    ),
    props.children
  );
  if(!storedPin||setting) return React.createElement("div",{style:{textAlign:"center",padding:"1.5rem 0.5rem"}},
    React.createElement("div",{style:{fontSize:28,marginBottom:8}},"🔒"),
    React.createElement("div",{style:{fontSize:14,color:HWHITE,fontWeight:500,marginBottom:4}},"Set a PIN for private notes"),
    React.createElement("div",{style:{fontSize:12,color:"rgba(250,248,244,0.4)",marginBottom:16,lineHeight:1.5}})  ,
    React.createElement("div",{style:{marginBottom:10}},
      React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},"Choose a PIN"),
      React.createElement("input",{type:"password",inputMode:"numeric",maxLength:8,value:entered,onChange:function(e){setEntered(e.target.value);setErr(null);},style:inputStyle})
    ),
    React.createElement("div",{style:{marginBottom:14}},
      React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},"Confirm PIN"),
      React.createElement("input",{type:"password",inputMode:"numeric",maxLength:8,value:confirm,onChange:function(e){setConfirm(e.target.value);setErr(null);},style:inputStyle})
    ),
    err&&React.createElement("p",{style:{fontSize:12,color:"#f0997b",marginBottom:8}},err),
    React.createElement("button",{onClick:async function(){
      if(!entered.trim()){setErr("Please enter a PIN.");return;}
      if(entered!==confirm){setErr("PINs don't match.");return;}
      await hSetPrivatePin(entered); setSetting(false); setUnlocked(true); setEntered(""); setConfirm("");
    },style:{background:HGOLD,color:HNAVY,border:"none",borderRadius:8,padding:"0.6rem 1.5rem",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",width:"100%"}},"Set PIN & unlock")
  );
  return React.createElement("div",{style:{textAlign:"center",padding:"1.5rem 0.5rem"}},
    React.createElement("div",{style:{fontSize:28,marginBottom:8}},"🔒"),
    React.createElement("div",{style:{fontSize:14,color:HWHITE,fontWeight:500,marginBottom:4}},"Private — my eyes only"),
    React.createElement("div",{style:{fontSize:12,color:"rgba(250,248,244,0.4)",marginBottom:16,lineHeight:1.5}})  ,
    React.createElement("div",{style:{marginBottom:14}},
      React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},"Enter PIN"),
      React.createElement("input",{type:"password",inputMode:"numeric",maxLength:8,autoFocus:true,value:entered,onKeyDown:async function(e){if(e.key==="Enter"){var h=await hHashPin(entered);if(h===storedPin){setUnlocked(true);setEntered("");setErr(null);}else{setErr("Incorrect PIN — try again.");}}},onChange:function(e){setEntered(e.target.value);setErr(null);},style:inputStyle})
    ),
    err&&React.createElement("p",{style:{fontSize:12,color:"#f0997b",marginBottom:8}},err),
    React.createElement("div",{style:{display:"flex",gap:8}},
      React.createElement("button",{onClick:async function(){
        var h=await hHashPin(entered);
        if(h===storedPin){setUnlocked(true);setEntered("");setErr(null);}
        else{setErr("Incorrect PIN — try again.");}
      },style:{flex:1,background:HGOLD,color:HNAVY,border:"none",borderRadius:8,padding:"0.6rem",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}},"Unlock"),
      React.createElement("button",{onClick:function(){setSetting(true);setEntered("");setConfirm("");setErr(null);},style:{background:"none",border:HBORD,borderRadius:8,padding:"0.6rem 0.9rem",color:"rgba(250,248,244,0.4)",cursor:"pointer",fontSize:12,fontFamily:"inherit"}},"Reset PIN")
    )
  );
}
function hLoadPeople() {
  try { var r=localStorage.getItem("af_people"); if(!r) return [{id:"default",name:"You",color:"#6A9BB5"}]; var p=JSON.parse(r); if(Array.isArray(p)&&p.length>0) return p; } catch(e){}
  return [{id:"default",name:"You",color:"#6A9BB5"}];
}
function hSavePeople(list) { try { localStorage.setItem("af_people", JSON.stringify(list)); afVaultChanged("people"); } catch(e){} }
var PERSON_COLORS = ["#6A9BB5","#c8a97a","#7a9e8e","#a07ab5","#d98a6e","#6ab5a0","#b5856a","#8e8eb5"]

function HBadge(props) { var b=HBADGE[props.type]||HBADGE.gray; return React.createElement("span",{style:{fontSize:11,padding:"2px 8px",borderRadius:12,whiteSpace:"nowrap",background:b.bg,color:b.color,border:"0.5px solid "+b.border}},props.label); }
function HCondPill(props) { var p=HPILL[props.type]||HPILL.other; return React.createElement("span",{style:{fontSize:11,padding:"2px 9px",borderRadius:12,background:p.bg,color:p.color,border:"0.5px solid "+p.border}},props.label); }
function HCard(props) { return React.createElement("div",{style:Object.assign({background:HSURF,border:HBORD,borderRadius:10,padding:"0.9rem 1.1rem"},props.style||{})},props.children); }
function HCardHead(props) {
  return React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.7rem"}},
    React.createElement("span",{style:{fontSize:13,fontWeight:500,color:"rgba(250,248,244,0.7)",display:"flex",alignItems:"center",gap:6}},React.createElement("span",{style:{fontSize:15,color:HGOLD}},props.icon),props.label),
    props.onAdd&&React.createElement("button",{onClick:props.onAdd,style:{fontSize:12,color:HGOLD,background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:6,padding:"3px 10px",cursor:"pointer"}},"+ Add")
  );
}
function HItemRow(props) {
  return React.createElement("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",padding:"0.45rem 0",borderBottom:HBORD2,gap:8}},
    React.createElement("div",{style:{flex:1}},React.createElement("p",{style:{fontSize:13,color:HWHITE,fontWeight:500,margin:"0 0 2px"}},props.name),props.detail&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.4)",margin:0}},props.detail)),
    React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
      props.badge&&React.createElement(HBadge,{type:props.badge,label:props.badgeLabel}),
      props.onEdit&&React.createElement("button",{onClick:props.onEdit,style:{background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.25)",borderRadius:5,color:HGOLD,cursor:"pointer",fontSize:11,padding:"2px 7px",lineHeight:1.4,fontFamily:"inherit"}},"Edit"),
      props.onDelete&&React.createElement("button",{onClick:props.onDelete,style:{background:"none",border:"none",color:"rgba(250,248,244,0.25)",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}},"✕"))
  );
}
function HModal(props) {
  return React.createElement("div",{style:{position:"fixed",top:0,left:68,right:0,bottom:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:"env(safe-area-inset-top,1rem) 1rem env(safe-area-inset-bottom,1rem)",overflowY:"auto",WebkitOverflowScrolling:"touch"},onClick:props.onClose},
    React.createElement("div",{style:{background:"#2E486B",border:HBORD,borderRadius:14,padding:"1.25rem 1.5rem",width:"min(480px,calc(100vw - 68px - 2rem))",maxHeight:"calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 2rem)",overflowY:"auto",WebkitOverflowScrolling:"touch"},onClick:function(e){e.stopPropagation();}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}},React.createElement("span",{style:{color:HWHITE,fontSize:15,fontWeight:500}},props.title),React.createElement("button",{onClick:props.onClose,style:{background:"none",border:"none",color:"rgba(250,248,244,0.4)",cursor:"pointer",fontSize:18}},"✕")),
      props.children
    )
  );
}
function HInput(props) {
  return React.createElement("div",{style:{marginBottom:"0.75rem"}},
    props.label&&React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},props.label),
    React.createElement("input",{type:props.type||"text",value:props.value,onChange:function(e){props.onChange(e.target.value);},placeholder:props.placeholder,style:{width:"100%",background:"rgba(250,242,229,0.07)",border:HBORD,borderRadius:8,padding:"0.55rem 0.75rem",color:HWHITE,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}})
  );
}
function HTextarea(props) {
  return React.createElement("div",{style:{marginBottom:"0.75rem"}},
    props.label&&React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},props.label),
    React.createElement("textarea",{value:props.value,onChange:function(e){props.onChange(e.target.value);},placeholder:props.placeholder,rows:props.rows||4,style:{width:"100%",background:"rgba(250,242,229,0.07)",border:HBORD,borderRadius:8,padding:"0.55rem 0.75rem",color:HWHITE,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box"}})
  );
}
function HSelect(props) {
  return React.createElement("div",{style:{marginBottom:"0.75rem"}},
    props.label&&React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},props.label),
    React.createElement("select",{value:props.value,onChange:function(e){props.onChange(e.target.value);},style:{width:"100%",background:"rgba(30,46,82,0.95)",border:HBORD,borderRadius:8,padding:"0.55rem 0.75rem",color:HWHITE,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}},
      props.options.map(function(o){return React.createElement("option",{key:o.value,value:o.value},o.label);})    )
  );
}
function HSaveBtn(props) {
  return React.createElement("button",{onClick:props.onClick,style:{width:"100%",background:HGOLD,color:HNAVY,border:"none",borderRadius:8,padding:"0.6rem",fontWeight:700,fontSize:13,fontFamily:"inherit",cursor:"pointer"}},props.label||"Save");
}

// ── AM/PM time picker — replaces plain text input for time fields ─────────────
function HTimePicker(props) {
  // Parse existing value like "10:30 AM" or "14:00" into parts
  var label=props.label||"Time (optional)";
  var value=props.value||"";
  var onChange=props.onChange;

  var HOURS=["12","1","2","3","4","5","6","7","8","9","10","11"];
  var MINS=["00","05","10","15","20","25","30","35","40","45","50","55"];

  function parse(v) {
    if(!v) return {h:"",m:"00",ampm:"AM"};
    var m24=/^(\d{1,2}):(\d{2})$/.exec(v);
    if(m24){var hr=parseInt(m24[1]);var mn=m24[2];var ap=hr>=12?"PM":"AM";var h12=hr%12||12;return{h:String(h12),m:mn,ampm:ap};}
    var m12=/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(v);
    if(m12) return{h:m12[1],m:m12[2],ampm:m12[3].toUpperCase()};
    return{h:"",m:"00",ampm:"AM"};
  }
  function compose(h,m,ampm) {
    if(!h) return "";
    return h+":"+m+" "+ampm;
  }
  var p=parse(value);

  var selStyle={background:"rgba(30,46,82,0.95)",border:HBORD,borderRadius:7,padding:"0.48rem 0.4rem",color:HWHITE,fontSize:13,fontFamily:"inherit",outline:"none",cursor:"pointer"};

  return React.createElement("div",{style:{marginBottom:"0.75rem"}},
    React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},label),
    React.createElement("div",{style:{display:"flex",gap:6,alignItems:"center"}},
      React.createElement("select",{value:p.h,onChange:function(e){onChange(compose(e.target.value,p.m,p.ampm));},style:Object.assign({},selStyle,{flex:1})},
        React.createElement("option",{value:""},"--"),
        HOURS.map(function(h){return React.createElement("option",{key:h,value:h},h);})
      ),
      React.createElement("span",{style:{color:"rgba(250,248,244,0.4)",fontWeight:700,fontSize:14}},":"),
      React.createElement("select",{value:p.m,onChange:function(e){if(p.h)onChange(compose(p.h,e.target.value,p.ampm));},style:Object.assign({},selStyle,{flex:1})},
        MINS.map(function(m){return React.createElement("option",{key:m,value:m},m);})
      ),
      React.createElement("select",{value:p.ampm,onChange:function(e){if(p.h)onChange(compose(p.h,p.m,e.target.value));},style:Object.assign({},selStyle,{width:64})},
        React.createElement("option",{value:"AM"},"AM"),
        React.createElement("option",{value:"PM"},"PM")
      ),
      value&&React.createElement("button",{onClick:function(){onChange("");},style:{background:"none",border:"none",color:"rgba(250,248,244,0.3)",cursor:"pointer",fontSize:14,padding:"0 4px",fontFamily:"inherit"}},"✕")
    )
  );
}

function HHistoryTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({name:"",detail:"",status:"Stable"}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(null); var editId=s2[0]; var setEditId=s2[1];
  var items=(health[pid]&&health[pid].history)||[];
  var STATUS=["Improving","Stable","Monitoring","Worsening","Resolved","Managed","Active Rx"].map(function(v){return{value:v,label:v};});
  function add(){
    if(!form.name.trim())return;
    var next=Object.assign({},health);if(!next[pid])next[pid]={};
    if(editId){
      next[pid].history=(next[pid].history||[]).map(function(x){return x.id===editId?Object.assign({},x,{name:form.name,detail:form.detail,status:form.status}):x;});
    } else {
      next[pid].history=(next[pid].history||[]).concat([{id:huid(),name:form.name,detail:form.detail,status:form.status}]);
    }
    setHealth(next);setForm({name:"",detail:"",status:"Stable"});setOpen(false);setEditId(null);
  }
  function startEdit(it){setForm({name:it.name,detail:it.detail||"",status:it.status||"Stable"});setEditId(it.id);setOpen(true);}
  function remove(id){var next=Object.assign({},health);next[pid].history=next[pid].history.filter(function(x){return x.id!==id;});setHealth(next);}
  return React.createElement(React.Fragment,null,
    React.createElement(HCard,null,React.createElement(HCardHead,{icon:"🩺",label:"Conditions & diagnoses",onAdd:function(){setForm({name:"",detail:"",status:"Stable"});setEditId(null);setOpen(true);}}),
      items.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No conditions added yet"),
      items.map(function(it){var badge=it.status==="Improving"?"ok":it.status==="Worsening"?"allergy":it.status==="Resolved"?"alive":it.status==="Monitoring"?"due":"gray";return React.createElement(HItemRow,{key:it.id,name:it.name,detail:it.detail,badge:badge,badgeLabel:it.status,onEdit:function(){startEdit(it);},onDelete:function(){remove(it.id);}});})),
    open&&React.createElement(HModal,{title:editId?"Edit condition":"Add condition / diagnosis",onClose:function(){setOpen(false);setEditId(null);}},
      React.createElement(HInput,{label:"Condition name",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. Asthma"}),
      React.createElement(HInput,{label:"Details",value:form.detail,onChange:function(v){setForm(function(f){return Object.assign({},f,{detail:v});});},placeholder:"e.g. Diagnosed 2008"}),
      React.createElement(HSelect,{label:"Status",value:form.status,onChange:function(v){setForm(function(f){return Object.assign({},f,{status:v});});},options:STATUS}),
      React.createElement(HSaveBtn,{onClick:add,label:editId?"Save changes":"Add condition"}))
  );
}
function HImmunizeTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({name:"",date:"",nextDue:"",status:"Up to date",addReminder:false}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(null); var editId=s2[0]; var setEditId=s2[1];
  var s3=useState(null); var toast=s3[0]; var setToast=s3[1];
  var items=(health[pid]&&health[pid].immunizations)||[];
  var STATUS=["Up to date","Due soon","Overdue","Declined"].map(function(v){return{value:v,label:v};});

  function writeReminderToCalendar(item) {
    if(!item.nextDue) return;
    try {
      var events=JSON.parse(localStorage.getItem("af_calEvents")||"[]");
      var calId="immun_"+item.id;
      events=events.filter(function(e){return e.id!==calId;});
      events.push({id:calId,title:"💉 "+item.name+" due",date:item.nextDue,color:"#6A9BB5",notes:"Immunization reminder from Health records"});
      localStorage.setItem("af_calEvents",JSON.stringify(events));
      window.dispatchEvent(new CustomEvent("af-cal-changed"));
    } catch(e){}
  }

  function add(){
    if(!form.name.trim())return;
    var next=Object.assign({},health);if(!next[pid])next[pid]={};
    var item;
    if(editId){
      item=Object.assign({},{id:editId},{name:form.name,date:form.date,nextDue:form.nextDue,status:form.status});
      next[pid].immunizations=(next[pid].immunizations||[]).map(function(x){return x.id===editId?item:x;});
    } else {
      item={id:huid(),name:form.name,date:form.date,nextDue:form.nextDue,status:form.status};
      next[pid].immunizations=(next[pid].immunizations||[]).concat([item]);
    }
    setHealth(next);
    if(form.addReminder&&form.nextDue){
      writeReminderToCalendar(item);
      setToast("Next due added to calendar!");
      setTimeout(function(){setToast(null);},2500);
    }
    setForm({name:"",date:"",nextDue:"",status:"Up to date",addReminder:false});
    setOpen(false);setEditId(null);
  }
  function startEdit(it){setForm({name:it.name,date:it.date||"",nextDue:it.nextDue||"",status:it.status||"Up to date",addReminder:false});setEditId(it.id);setOpen(true);}
  function remove(id){
    var next=Object.assign({},health);next[pid].immunizations=next[pid].immunizations.filter(function(x){return x.id!==id;});
    setHealth(next);
    // Remove from calendar too
    try{var evs=JSON.parse(localStorage.getItem("af_calEvents")||"[]");localStorage.setItem("af_calEvents",JSON.stringify(evs.filter(function(e){return e.id!=="immun_"+id;})));window.dispatchEvent(new CustomEvent("af-cal-changed"));}catch(e){}
  }
  return React.createElement(React.Fragment,null,
    toast&&React.createElement("div",{style:{background:"rgba(106,155,181,0.2)",border:"0.5px solid rgba(106,155,181,0.4)",borderRadius:8,padding:"0.5rem 0.9rem",fontSize:12,color:"#6A9BB5",marginBottom:"0.75rem",textAlign:"center"}},"📅 "+toast),
    React.createElement(HCard,null,React.createElement(HCardHead,{icon:"💉",label:"Immunizations",onAdd:function(){setForm({name:"",date:"",nextDue:"",status:"Up to date",addReminder:false});setEditId(null);setOpen(true);}}),
      items.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No immunizations added yet"),
      items.map(function(it){
        var badge=it.status==="Up to date"?"ok":it.status==="Overdue"?"allergy":"due";
        var detail=[it.date,it.nextDue?"Next: "+it.nextDue:""].filter(Boolean).join(" · ");
        return React.createElement(HItemRow,{key:it.id,name:it.name,detail:detail,badge:badge,badgeLabel:it.status,onEdit:function(){startEdit(it);},onDelete:function(){remove(it.id);}});
      })),
    open&&React.createElement(HModal,{title:editId?"Edit immunization":"Add immunization",onClose:function(){setOpen(false);setEditId(null);}},
      React.createElement(HInput,{label:"Vaccine name",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. Flu shot, Tdap, COVID booster"}),
      React.createElement(HInput,{label:"Date received",value:form.date,onChange:function(v){setForm(function(f){return Object.assign({},f,{date:v});});},placeholder:"e.g. Oct 2024"}),
      React.createElement(HInput,{label:"Next due date (optional)",value:form.nextDue,type:"date",onChange:function(v){setForm(function(f){return Object.assign({},f,{nextDue:v});});}}),
      React.createElement(HSelect,{label:"Status",value:form.status,onChange:function(v){setForm(function(f){return Object.assign({},f,{status:v});});},options:STATUS}),
      form.nextDue&&React.createElement("div",{onClick:function(){setForm(function(f){return Object.assign({},f,{addReminder:!f.addReminder});});},style:{display:"flex",alignItems:"center",gap:8,marginBottom:"0.75rem",padding:"0.5rem 0.75rem",background:"rgba(106,155,181,0.08)",borderRadius:8,border:"0.5px solid rgba(106,155,181,0.2)",cursor:"pointer"}},
        React.createElement("div",{style:{width:16,height:16,borderRadius:4,border:"1.5px solid rgba(106,155,181,0.5)",background:form.addReminder?"rgba(106,155,181,0.4)":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#6A9BB5"}},form.addReminder?"✓":""),
        React.createElement("span",{style:{fontSize:12,color:"rgba(106,155,181,0.9)",fontFamily:"inherit"}},"📅 Add next due date to calendar")
      ),
      React.createElement(HSaveBtn,{onClick:add,label:editId?"Save changes":"Add immunization"}))
  );
}
function HMedsTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({name:"",dose:"",frequency:"",type:"Rx",contact:""}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(null); var editId=s2[0]; var setEditId=s2[1];
  var items=(health[pid]&&health[pid].medications)||[];
  var TYPES=["Rx","OTC","Supplement","PRN"].map(function(v){return{value:v,label:v};});
  function add(){
    if(!form.name.trim())return;
    var next=Object.assign({},health);if(!next[pid])next[pid]={};
    if(editId){
      next[pid].medications=(next[pid].medications||[]).map(function(x){return x.id===editId?Object.assign({},x,{name:form.name,dose:form.dose,frequency:form.frequency,type:form.type,contact:form.contact}):x;});
    } else {
      next[pid].medications=(next[pid].medications||[]).concat([{id:huid(),name:form.name,dose:form.dose,frequency:form.frequency,type:form.type,contact:form.contact}]);
    }
    setHealth(next);setForm({name:"",dose:"",frequency:"",type:"Rx",contact:""});setOpen(false);setEditId(null);
  }
  function startEdit(it){setForm({name:it.name,dose:it.dose||"",frequency:it.frequency||"",type:it.type||"Rx",contact:it.contact||""});setEditId(it.id);setOpen(true);}
  function remove(id){var next=Object.assign({},health);next[pid].medications=next[pid].medications.filter(function(x){return x.id!==id;});setHealth(next);}

  function ContactLink(cprops) {
    var c=cprops.contact||"";
    if(!c) return null;
    var isPhone=/^[\d\s\-\+\(\)]{7,}$/.test(c.trim());
    var safe=safeUrl(c);
    if(safe) return React.createElement("a",{href:safe,target:"_blank",rel:"noreferrer",style:{fontSize:11,color:"#7EAEB4",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:3,marginTop:3}},"🔗 Order");
    if(isPhone) return React.createElement("a",{href:"tel:"+c.replace(/\s/g,""),style:{fontSize:11,color:"#7EAEB4",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:3,marginTop:3}},"📞 "+c);
    return React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.4)",marginTop:3}},c);
  }

  return React.createElement(React.Fragment,null,
    React.createElement(HCard,null,React.createElement(HCardHead,{icon:"💊",label:"Medications",onAdd:function(){setForm({name:"",dose:"",frequency:"",type:"Rx",contact:""});setEditId(null);setOpen(true);}}),
      items.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No medications added yet"),
      items.map(function(it){
        return React.createElement("div",{key:it.id,style:{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 0",borderBottom:"0.5px solid rgba(250,242,229,0.07)"}},
          React.createElement("div",{style:{flex:1}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
              React.createElement("span",{style:{fontSize:13,fontWeight:600,color:HWHITE}}),it.name,
              React.createElement("span",{style:{fontSize:10,padding:"1px 7px",borderRadius:10,background:"rgba(55,138,221,0.12)",color:"#85B7EB",border:"0.5px solid rgba(55,138,221,0.2)"}}),it.type
            ),
            React.createElement("div",{style:{fontSize:11,color:"rgba(250,248,244,0.4)",marginTop:2}}),[it.dose,it.frequency].filter(Boolean).join(" · "),
            it.contact&&React.createElement(ContactLink,{contact:it.contact})
          ),
          React.createElement("button",{onClick:function(){startEdit(it);},style:{background:"none",border:"none",fontSize:12,color:"rgba(200,169,122,0.4)",cursor:"pointer",padding:"2px 4px",flexShrink:0}},"✏️"),
          React.createElement("button",{onClick:function(){remove(it.id);},style:{background:"none",border:"none",color:"rgba(250,248,244,0.2)",cursor:"pointer",fontSize:13,padding:"0 2px",flexShrink:0}},"✕")
        );
      })),
    open&&React.createElement(HModal,{title:editId?"Edit medication":"Add medication",onClose:function(){setOpen(false);setEditId(null);}},
      React.createElement(HInput,{label:"Medication name",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. Albuterol"}),
      React.createElement(HInput,{label:"Dose",value:form.dose,onChange:function(v){setForm(function(f){return Object.assign({},f,{dose:v});});},placeholder:"e.g. 10mg"}),
      React.createElement(HInput,{label:"Frequency",value:form.frequency,onChange:function(v){setForm(function(f){return Object.assign({},f,{frequency:v});});},placeholder:"e.g. Daily, PRN"}),
      React.createElement(HSelect,{label:"Type",value:form.type,onChange:function(v){setForm(function(f){return Object.assign({},f,{type:v});});},options:TYPES}),
      React.createElement(HInput,{label:"Pharmacy / Order link (optional)",value:form.contact,onChange:function(v){setForm(function(f){return Object.assign({},f,{contact:v});});},placeholder:"URL or phone number"}),
      React.createElement(HSaveBtn,{onClick:add,label:editId?"Save changes":"Add medication"}))
  );
}
function HAllergiesTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({name:"",type:"Drug",severity:"Moderate"}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(null); var editId=s2[0]; var setEditId=s2[1];
  var items=(health[pid]&&health[pid].allergies)||[];
  var TYPES=["Drug","Food","Environmental","Contact","Other"].map(function(v){return{value:v,label:v};});
  var SEVS=["Mild","Moderate","Severe","Life-threatening"].map(function(v){return{value:v,label:v};});
  function add(){
    if(!form.name.trim())return;
    var next=Object.assign({},health);if(!next[pid])next[pid]={};
    if(editId){
      next[pid].allergies=(next[pid].allergies||[]).map(function(x){return x.id===editId?Object.assign({},x,{name:form.name,type:form.type,severity:form.severity}):x;});
    } else {
      next[pid].allergies=(next[pid].allergies||[]).concat([{id:huid(),name:form.name,type:form.type,severity:form.severity}]);
    }
    setHealth(next);setForm({name:"",type:"Drug",severity:"Moderate"});setOpen(false);setEditId(null);
  }
  function startEdit(it){setForm({name:it.name,type:it.type||"Drug",severity:it.severity||"Moderate"});setEditId(it.id);setOpen(true);}
  function remove(id){var next=Object.assign({},health);next[pid].allergies=next[pid].allergies.filter(function(x){return x.id!==id;});setHealth(next);}
  return React.createElement(React.Fragment,null,
    React.createElement(HCard,null,React.createElement(HCardHead,{icon:"⚠️",label:"Allergies",onAdd:function(){setForm({name:"",type:"Drug",severity:"Moderate"});setEditId(null);setOpen(true);}}),
      items.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No allergies added yet"),
      items.map(function(it){return React.createElement(HItemRow,{key:it.id,name:it.name,detail:it.type,badge:"allergy",badgeLabel:it.severity,onEdit:function(){startEdit(it);},onDelete:function(){remove(it.id);}});})),
    open&&React.createElement(HModal,{title:editId?"Edit allergy":"Add allergy",onClose:function(){setOpen(false);setEditId(null);}},
      React.createElement(HInput,{label:"Allergen",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. Penicillin"}),
      React.createElement(HSelect,{label:"Type",value:form.type,onChange:function(v){setForm(function(f){return Object.assign({},f,{type:v});});},options:TYPES}),
      React.createElement(HSelect,{label:"Severity",value:form.severity,onChange:function(v){setForm(function(f){return Object.assign({},f,{severity:v});});},options:SEVS}),
      React.createElement(HSaveBtn,{onClick:add,label:editId?"Save changes":"Add allergy"}))
  );
}
function HFamilyTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var maternalSourceId=props.maternalSourceId||null;
  var allPeople=props.allPeople||[];
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({role:"Mother",name:"",years:"",living:"Living",conditions:[],note:""}); var form=s1[0]; var setForm=s1[1];
  var s2=useState({type:"heart",label:""}); var condIn=s2[0]; var setCondIn=s2[1];
  var ownRelatives=(health[pid]&&health[pid].familyHistory)||[];
  // If linked to a maternal source, pull their family history as our maternal side
  var maternalSource=maternalSourceId?allPeople.find(function(p){return p.id===maternalSourceId;}):null;
  var inheritedMaternalEntries=maternalSource?(health[maternalSourceId]&&health[maternalSourceId].familyHistory)||[]:[];
  // Own entries (not-overridden) + inherited maternal entries shown in maternal column
  var relatives=ownRelatives;
  var riskMap={};
  relatives.forEach(function(r){(r.conditions||[]).forEach(function(c){riskMap[c.type]=(riskMap[c.type]||0)+1;});});
  inheritedMaternalEntries.forEach(function(r){(r.conditions||[]).forEach(function(c){riskMap[c.type]=(riskMap[c.type]||0)+1;});});
  var RISKS=[{key:"heart",label:"Cardiovascular",color:"#F0997B"},{key:"cancer",label:"Cancer",color:"#ED93B1"},{key:"diabetes",label:"Diabetes",color:"#EF9F27"},{key:"neuro",label:"Neurological",color:"#5DCAA5"},{key:"mental",label:"Mental health",color:"#AFA9EC"}];
  var maxCount=Math.max.apply(null,RISKS.map(function(r){return riskMap[r.key]||0;}).concat([1]));
  function addCond(){if(!condIn.label.trim())return;setForm(function(f){return Object.assign({},f,{conditions:f.conditions.concat([{type:condIn.type,label:condIn.label}])});});setCondIn(function(c){return Object.assign({},c,{label:""});});}
  function removeCond(i){setForm(function(f){return Object.assign({},f,{conditions:f.conditions.filter(function(_,idx){return idx!==i;})});});}
  function save(){if(!form.role)return;var next=Object.assign({},health);if(!next[pid])next[pid]={};next[pid].familyHistory=(next[pid].familyHistory||[]).concat([{id:huid(),role:form.role,name:form.name,years:form.years,living:form.living,conditions:form.conditions,note:form.note}]);setHealth(next);setForm({role:"Mother",name:"",years:"",living:"Living",conditions:[],note:""});setCondIn({type:"heart",label:""});setOpen(false);}
  function remove(id){var next=Object.assign({},health);next[pid].familyHistory=next[pid].familyHistory.filter(function(x){return x.id!==id;});setHealth(next);}
  var maternal=relatives.filter(function(r){return ["Maternal grandmother","Maternal grandfather","Mother","Maternal aunt","Maternal uncle"].indexOf(r.role)>=0;});
  var paternal=relatives.filter(function(r){return ["Paternal grandmother","Paternal grandfather","Father","Paternal aunt","Paternal uncle"].indexOf(r.role)>=0;});
  var other=relatives.filter(function(r){return maternal.indexOf(r)<0&&paternal.indexOf(r)<0;});
  // Merge inherited maternal entries (read-only, from linked source)
  var maternalAll=maternal.concat(inheritedMaternalEntries.map(function(r){return Object.assign({},r,{_inherited:true,_sourceName:maternalSource?maternalSource.name:""});}));
  var ROLE_OPTS=H_REL_ROLES.map(function(v){return{value:v,label:v};});
  var LIVE_OPTS=["Living","Deceased"].map(function(v){return{value:v,label:v};});
  function RelCard(rp){
    var rel=rp.rel;
    return React.createElement("div",{style:{background:rel._inherited?"rgba(200,169,122,0.04)":HSURF2,border:rel._inherited?"0.5px solid rgba(200,169,122,0.15)":HBORD2,borderRadius:8,padding:"0.7rem 0.9rem",marginBottom:"0.5rem"}},
      rel._inherited&&React.createElement("div",{style:{fontSize:10,color:"rgba(200,169,122,0.5)",marginBottom:4,letterSpacing:"0.05em",textTransform:"uppercase"}},"Inherited from "+rel._sourceName),
      React.createElement("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"0.45rem"}},
        React.createElement("div",null,React.createElement("p",{style:{fontSize:13,fontWeight:500,color:HWHITE,margin:"0 0 2px"}},rel.role+(rel.name?" — "+rel.name:"")),React.createElement("p",{style:{fontSize:11,color:"rgba(250,248,244,0.35)",margin:0}},rel.years)),
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
          React.createElement(HBadge,{type:rel.living==="Living"?"alive":"deceased",label:rel.living}),
          !rel._inherited&&React.createElement("button",{onClick:function(){remove(rel.id);},style:{background:"none",border:"none",color:"rgba(250,248,244,0.25)",cursor:"pointer",fontSize:14,padding:"0 2px"}},"✕")
        )
      ),
      rel.conditions&&rel.conditions.length>0&&React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:5,marginBottom:rel.note?"0.4rem":0}},rel.conditions.map(function(c,i){return React.createElement(HCondPill,{key:i,type:c.type,label:c.label});})),
      rel.note&&React.createElement("p",{style:{fontSize:11,color:"rgba(250,248,244,0.3)",margin:"0.35rem 0 0",fontStyle:"italic"}},rel.note)
    );
  }
  function SideCard(sp){return React.createElement(HCard,null,React.createElement(HCardHead,{icon:sp.icon,label:sp.title,onAdd:function(){setOpen(true);}}),sp.rels.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.5rem 0"}},"None added yet"),sp.rels.map(function(r){return React.createElement(RelCard,{key:r.id+(r._inherited?"_i":""),rel:r});}));}
  return React.createElement(React.Fragment,null,
    maternalSource&&React.createElement("div",{style:{background:"rgba(200,169,122,0.06)",border:"0.5px solid rgba(200,169,122,0.2)",borderRadius:8,padding:"0.55rem 0.85rem",fontSize:12,color:"rgba(200,169,122,0.7)",marginBottom:"0.75rem",display:"flex",alignItems:"center",gap:6}},"🔗 Maternal side inherited from ",React.createElement("strong",null,maternalSource.name)," · updates automatically"),
    (relatives.length>0||inheritedMaternalEntries.length>0)&&React.createElement(HCard,{style:{marginBottom:"0.9rem"}},React.createElement(HCardHead,{icon:"📊",label:"Hereditary risk summary"}),RISKS.filter(function(r){return riskMap[r.key];}).map(function(r){var pct=Math.round((riskMap[r.key]/maxCount)*100);return React.createElement("div",{key:r.key,style:{display:"flex",alignItems:"center",padding:"0.3rem 0",borderBottom:HBORD2}},React.createElement("span",{style:{fontSize:12,color:"rgba(250,248,244,0.65)",minWidth:130}},r.label),React.createElement("div",{style:{flex:1,margin:"0 12px",height:3,background:"rgba(250,242,229,0.07)",borderRadius:2}},React.createElement("div",{style:{width:pct+"%",height:3,borderRadius:2,background:r.color}})),React.createElement("span",{style:{fontSize:11,minWidth:60,textAlign:"right",color:r.color}},riskMap[r.key]+(riskMap[r.key]===1?" relative":" relatives")));}),React.createElement("p",{style:{fontSize:11,color:"rgba(250,248,244,0.25)",margin:"0.5rem 0 0",fontStyle:"italic"}},"Not a medical assessment — share with your provider")),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.9rem"}},React.createElement(SideCard,{title:"Maternal side",icon:"👩",rels:maternalAll}),React.createElement(SideCard,{title:"Paternal side",icon:"👨",rels:paternal})),
    other.length>0&&React.createElement(HCard,{style:{marginTop:"0.9rem"}},React.createElement(HCardHead,{icon:"👤",label:"Other relatives"}),other.map(function(r){return React.createElement(RelCard,{key:r.id,rel:r});})),
    open&&React.createElement(HModal,{title:"Add family member",onClose:function(){setOpen(false);}},
      React.createElement(HSelect,{label:"Relationship",value:form.role,onChange:function(v){setForm(function(f){return Object.assign({},f,{role:v});});},options:ROLE_OPTS}),
      React.createElement(HInput,{label:"Name (optional)",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. Grandma Ruth"}),
      React.createElement(HInput,{label:"Birth / death years",value:form.years,onChange:function(v){setForm(function(f){return Object.assign({},f,{years:v});});},placeholder:"e.g. b.1935 · d.2019"}),
      React.createElement(HSelect,{label:"Status",value:form.living,onChange:function(v){setForm(function(f){return Object.assign({},f,{living:v});});},options:LIVE_OPTS}),
      React.createElement("div",{style:{marginBottom:"0.75rem"}},
        React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},"Conditions"),
        React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}},form.conditions.map(function(c,i){var p=HPILL[c.type]||HPILL.other;return React.createElement("span",{key:i,onClick:function(){removeCond(i);},style:{fontSize:11,padding:"2px 8px",borderRadius:12,cursor:"pointer",background:p.bg,color:p.color,border:"0.5px solid "+p.border}},c.label+" ✕");})),
        React.createElement("div",{style:{display:"flex",gap:6}},
          React.createElement("select",{value:condIn.type,onChange:function(e){setCondIn(function(c){return Object.assign({},c,{type:e.target.value});});},style:{background:"rgba(30,46,82,0.95)",border:HBORD,borderRadius:8,padding:"0.4rem 0.5rem",color:HWHITE,fontSize:12,fontFamily:"inherit",outline:"none",flexShrink:0}},H_COND_TYPES.map(function(c){return React.createElement("option",{key:c.id,value:c.id},c.label);})),
          React.createElement("input",{value:condIn.label,onChange:function(e){setCondIn(function(c){return Object.assign({},c,{label:e.target.value});});},placeholder:"Condition name",style:{flex:1,background:"rgba(250,242,229,0.07)",border:HBORD,borderRadius:8,padding:"0.4rem 0.6rem",color:HWHITE,fontSize:12,fontFamily:"inherit",outline:"none"}}),
          React.createElement("button",{onClick:addCond,style:{background:"rgba(200,169,122,0.15)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:8,padding:"0.4rem 0.7rem",color:HGOLD,cursor:"pointer",fontSize:12}},"+ Add")
        )
      ),
      React.createElement(HTextarea,{label:"Notes",value:form.note,onChange:function(v){setForm(function(f){return Object.assign({},f,{note:v});});},placeholder:"Cause of death, age at diagnosis...",rows:3}),
      React.createElement(HSaveBtn,{onClick:save})
    )
  );
}
function HNotesTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var personName=props.personName||"";
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({title:"",date:"",provider:"",location:"",body:"",tags:"",addToCalendar:false}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(false); var editGen=s2[0]; var setEditGen=s2[1];
  var s3=useState(""); var genDraft=s3[0]; var setGenDraft=s3[1];
  var s4=useState(null); var editId=s4[0]; var setEditId=s4[1];
  var s5=useState(null); var calToast=s5[0]; var setCalToast=s5[1];
  var notes=(health[pid]&&health[pid].apptNotes)||[];
  var general=(health[pid]&&health[pid].generalNote)||"";
  var LOC_OPTS=["In-person","Telehealth","Urgent care","ER","Specialist","Other"].map(function(v){return{value:v,label:v};});

  function injectCalendar(note) {
    if(!note.date) return;
    try {
      var events=JSON.parse(localStorage.getItem("af_calEvents")||"[]");
      // parse note.date - accept YYYY-MM-DD or "Mar 14, 2025" style
      var dateStr=note.date;
      var parsed=new Date(note.date);
      if(!isNaN(parsed.getTime())) dateStr=parsed.toISOString().slice(0,10);
      var label=(personName?personName+"'s ":"")+note.title+(note.provider?" · "+note.provider:"");
      var calId="health_appt_"+note.id;
      var exists=events.some(function(e){return e.id===calId;});
      if(!exists) {
        events.push({id:calId,title:"🩺 "+label,date:dateStr,color:"#6A9BB5",notes:"Added from Health records"});
        localStorage.setItem("af_calEvents",JSON.stringify(events));
        // Fire storage event so main app React state updates
        window.dispatchEvent(new CustomEvent("af-cal-changed"));
        setCalToast("Added to calendar!");
        setTimeout(function(){setCalToast(null);},2500);
      }
    } catch(e){}
    // Also add to the appointments tab so it shows there
    setHealth(function(prev) {
      var next=Object.assign({},prev);
      if(!next[pid]) next[pid]={};
      var existing=(next[pid].appointments||[]);
      var apptId="health_appt_"+note.id;
      var alreadyThere=existing.some(function(a){return a.id===apptId;});
      if(!alreadyThere) {
        var dateStr2=note.date;
        try{var p2=new Date(note.date);if(!isNaN(p2.getTime()))dateStr2=p2.toISOString().slice(0,10);}catch(e){}
        next[pid].appointments=[...existing,{id:apptId,title:note.title,date:dateStr2,time:"",provider:note.provider||"",location:note.location||"",body:note.body||""}];
      }
      return next;
    });
  }

  function addNote(){
    if(!form.title.trim())return;
    var next=Object.assign({},health);if(!next[pid])next[pid]={};
    var tags=form.tags.split(",").map(function(t){return t.trim();}).filter(Boolean);
    var note={id:editId||huid(),title:form.title,date:form.date,provider:form.provider,location:form.location,body:form.body,tags:tags};
    if(editId){
      next[pid].apptNotes=(next[pid].apptNotes||[]).map(function(x){return x.id===editId?note:x;});
    } else {
      next[pid].apptNotes=[note].concat(next[pid].apptNotes||[]);
    }
    setHealth(next);
    if(form.addToCalendar) injectCalendar(note);
    setForm({title:"",date:"",provider:"",location:"",body:"",tags:"",addToCalendar:false});
    setOpen(false);setEditId(null);
  }

  function startEdit(n){
    setForm({title:n.title,date:n.date||"",provider:n.provider||"",location:n.location||"",body:n.body||"",tags:(n.tags||[]).join(", "),addToCalendar:false});
    setEditId(n.id);setOpen(true);
  }
  function removeNote(id){var next=Object.assign({},health);next[pid].apptNotes=next[pid].apptNotes.filter(function(x){return x.id!==id;});setHealth(next);}
  function saveGen(){var next=Object.assign({},health);if(!next[pid])next[pid]={};next[pid].generalNote=genDraft;setHealth(next);setEditGen(false);}

  return React.createElement(React.Fragment,null,
    calToast&&React.createElement("div",{style:{background:"rgba(106,155,181,0.2)",border:"0.5px solid rgba(106,155,181,0.4)",borderRadius:8,padding:"0.5rem 0.9rem",fontSize:12,color:"#6A9BB5",marginBottom:"0.75rem",textAlign:"center"}},"📅 "+calToast),
    // Standing notes — private locked
    React.createElement(HCard,{style:{marginBottom:"0.9rem"}},
      React.createElement(HCardHead,{icon:"📝",label:"Standing health notes · private",onAdd:null}),
      React.createElement(HPrivateLock,null,
        editGen
          ?React.createElement(React.Fragment,null,
            React.createElement(HTextarea,{value:genDraft,onChange:setGenDraft,rows:4,placeholder:"Insurance info, provider preferences, sensitive notes…"}),
            React.createElement("div",{style:{display:"flex",gap:8}},
              React.createElement(HSaveBtn,{onClick:saveGen,label:"Save"}),
              React.createElement("button",{onClick:function(){setEditGen(false);},style:{flex:1,background:"transparent",border:HBORD,borderRadius:8,color:"rgba(250,248,244,0.5)",cursor:"pointer",fontSize:13,fontFamily:"inherit"}},"Cancel")))
          :general
            ?React.createElement("p",{style:{fontSize:13,color:"rgba(250,248,244,0.6)",lineHeight:1.7,margin:0,cursor:"pointer"},onClick:function(){setGenDraft(general);setEditGen(true);}},general)
            :React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.5rem 0",cursor:"pointer"},onClick:function(){setGenDraft("");setEditGen(true);}},"Tap to add private standing notes…")
      )
    ),
    // Appointment notes
    React.createElement(HCard,null,
      React.createElement(HCardHead,{icon:"🗒️",label:"Appointment notes",onAdd:function(){setForm({title:"",date:"",provider:"",location:"",body:"",tags:"",addToCalendar:false});setEditId(null);setOpen(true);}}),
      notes.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No appointment notes yet"),
      notes.map(function(n){
        return React.createElement("div",{key:n.id,style:{background:HSURF2,border:HBORD2,borderRadius:8,padding:"0.75rem 0.9rem",marginBottom:"0.5rem"}},
          React.createElement("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"0.35rem"}},
            React.createElement("span",{style:{fontSize:13,fontWeight:500,color:HWHITE}},n.title),
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
              React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.35)"}},n.date),
              React.createElement("button",{onClick:function(){startEdit(n);},style:{background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.25)",borderRadius:5,color:HGOLD,cursor:"pointer",fontSize:11,padding:"2px 7px",lineHeight:1.4,fontFamily:"inherit"}},"Edit"),
              React.createElement("button",{onClick:function(){injectCalendar(n);},title:"Add to calendar",style:{background:"rgba(106,155,181,0.1)",border:"0.5px solid rgba(106,155,181,0.25)",borderRadius:5,color:"#6A9BB5",cursor:"pointer",fontSize:11,padding:"2px 7px",lineHeight:1.4,fontFamily:"inherit"}},"📅"),
              React.createElement("button",{onClick:function(){removeNote(n.id);},style:{background:"none",border:"none",color:"rgba(250,248,244,0.25)",cursor:"pointer",fontSize:14,padding:"0 2px"}},"✕")
            )
          ),
          (n.provider||n.location)&&React.createElement("p",{style:{fontSize:11,color:HGOLD,margin:"0 0 0.4rem"}},"🏥 "+[n.provider,n.location].filter(Boolean).join(" · ")),
          n.body&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.55)",lineHeight:1.65,margin:"0 0 0.45rem"}},n.body),
          n.tags&&n.tags.length>0&&React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:5}},n.tags.map(function(t,i){return React.createElement("span",{key:i,style:{fontSize:11,padding:"2px 8px",borderRadius:12,background:"rgba(250,242,229,0.05)",color:"rgba(250,248,244,0.4)",border:HBORD2}},t);}))
        );
      })
    ),
    open&&React.createElement(HModal,{title:editId?"Edit appointment note":"Add appointment note",onClose:function(){setOpen(false);setEditId(null);}},
      React.createElement(HInput,{label:"Visit title",value:form.title,onChange:function(v){setForm(function(f){return Object.assign({},f,{title:v});});},placeholder:"e.g. Annual physical"}),
      React.createElement(HInput,{label:"Date",value:form.date,onChange:function(v){setForm(function(f){return Object.assign({},f,{date:v});});},placeholder:"e.g. 2025-03-14"}),
      React.createElement(HInput,{label:"Provider",value:form.provider,onChange:function(v){setForm(function(f){return Object.assign({},f,{provider:v});});},placeholder:"e.g. Dr. Reyes"}),
      React.createElement(HSelect,{label:"Visit type",value:form.location,onChange:function(v){setForm(function(f){return Object.assign({},f,{location:v});});},options:LOC_OPTS}),
      React.createElement(HTextarea,{label:"Notes from visit",value:form.body,onChange:function(v){setForm(function(f){return Object.assign({},f,{body:v});});},placeholder:"What was discussed, prescribed, or ordered…",rows:5}),
      React.createElement(HInput,{label:"Tags (comma-separated)",value:form.tags,onChange:function(v){setForm(function(f){return Object.assign({},f,{tags:v});});},placeholder:"e.g. blood pressure, A1C, follow-up"}),
      form.date&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:"0.75rem",padding:"0.5rem 0.75rem",background:"rgba(106,155,181,0.08)",borderRadius:8,border:"0.5px solid rgba(106,155,181,0.2)",cursor:"pointer"},onClick:function(){setForm(function(f){return Object.assign({},f,{addToCalendar:!f.addToCalendar});});}},
        React.createElement("div",{style:{width:16,height:16,borderRadius:4,border:"1.5px solid rgba(106,155,181,0.5)",background:form.addToCalendar?"rgba(106,155,181,0.4)":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#6A9BB5"}},form.addToCalendar?"✓":""),
        React.createElement("span",{style:{fontSize:12,color:"rgba(106,155,181,0.9)",fontFamily:"inherit"}},"📅 Add this appointment to calendar")
      ),
      React.createElement(HSaveBtn,{onClick:addNote,label:editId?"Save changes":"Save note"})
    )
  );
}

// ── Health person card (used in dashboard overview) ───────────────────────────
function HPersonCard(props) {
  var p=props.person; var health=props.health; var onOpen=props.onOpen;
  var pid=p.id;
  var d=health[pid]||{};
  var meds=(d.meds||[]).length;
  var allergies=(d.allergies||[]).length;
  var immunizations=d.immunizations||[];
  var dueVax=immunizations.filter(function(v){return v.status==="due"||v.status==="overdue";}).length;
  var vaxColor=dueVax>0?"#d85a30":"#1d9e75";
  var vaxLabel=dueVax>0?(dueVax+" due"):"All clear";
  var initials=p.name.split(" ").map(function(w){return w[0];}).join("").slice(0,2).toUpperCase();
  // first overdue vax
  var firstDue=immunizations.find(function(v){return v.status==="overdue";}) || immunizations.find(function(v){return v.status==="due";});
  // first allergy
  var firstAllergy=(d.allergies||[])[0];
  var SURF="rgba(250,242,229,0.05)";
  var SURF2="rgba(250,242,229,0.04)";
  var BORD2="0.5px solid rgba(250,242,229,0.08)";
  return React.createElement("div",{onClick:function(){onOpen(pid);},style:{background:SURF,border:HBORD,borderRadius:12,padding:"14px 16px",cursor:"pointer",display:"flex",flexDirection:"column",gap:10}},
    // header
    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10}},
        React.createElement("div",{style:{width:34,height:34,borderRadius:"50%",background:p.color||HGOLD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:HNAVY,flexShrink:0}},initials),
        React.createElement("span",{style:{fontSize:14,fontWeight:500,color:HWHITE}},p.name)
      ),
      React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.3)"}},">")
    ),
    // 3 mini stats
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}},
      React.createElement("div",{style:{background:SURF2,borderRadius:8,padding:"7px 8px"}},
        React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Meds"),
        React.createElement("p",{style:{fontSize:17,fontWeight:500,color:HWHITE,margin:0}},meds)
      ),
      React.createElement("div",{style:{background:SURF2,borderRadius:8,padding:"7px 8px"}},
        React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Allergies"),
        React.createElement("p",{style:{fontSize:17,fontWeight:500,color:HWHITE,margin:0}},allergies)
      ),
      React.createElement("div",{style:{background:SURF2,borderRadius:8,padding:"7px 8px"}},
        React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Vaccines"),
        React.createElement("p",{style:{fontSize:14,fontWeight:500,color:vaxColor,margin:0}},vaxLabel)
      )
    ),
    // preview rows
    React.createElement("div",{style:{borderTop:BORD2,paddingTop:8,display:"flex",flexDirection:"column",gap:4}},
      firstDue&&React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12}},
        React.createElement("span",{style:{color:"rgba(250,248,244,0.6)"}},firstDue.name||"Vaccine"),
        React.createElement("span",{style:{fontSize:11,padding:"1px 7px",borderRadius:10,background:"rgba(216,90,48,0.15)",color:"#f0997b",border:"0.5px solid rgba(216,90,48,0.25)"}},firstDue.status==="overdue"?"Overdue":"Due")
      ),
      firstAllergy&&React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:12}},
        React.createElement("span",{style:{color:"rgba(250,248,244,0.6)"}},firstAllergy.substance||firstAllergy.name||"Allergy"),
        React.createElement("span",{style:{fontSize:11,padding:"1px 7px",borderRadius:10,background:"rgba(216,90,48,0.1)",color:"#f0997b",border:"0.5px solid rgba(216,90,48,0.2)"}},firstAllergy.severity||"Allergy")
      ),
      !firstDue&&!firstAllergy&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.28)",margin:0,textAlign:"center",padding:"2px 0"}},"Tap to add records")
    )
  );
}

// ── Appointments tab (upcoming + past, with calendar push) ───────────────────
function HAppointmentsTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var personName=props.personName||"";
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({title:"",date:"",time:"",provider:"",location:"",body:"",addToCalendar:true}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(null); var editId=s2[0]; var setEditId=s2[1];
  var s3=useState(null); var toast=s3[0]; var setToast=s3[1];
  var appts=(health[pid]&&health[pid].appointments)||[];
  var today=new Date().toISOString().slice(0,10);
  var upcoming=appts.filter(function(a){return a.date>=today;}).sort(function(a,b){return a.date<b.date?-1:1;});
  var past=appts.filter(function(a){return a.date<today;}).sort(function(a,b){return a.date<b.date?1:-1;});

  function injectCal(appt) {
    try {
      var events=JSON.parse(localStorage.getItem("af_calEvents")||"[]");
      var calId="health_appt_"+appt.id;
      if(!events.some(function(e){return e.id===calId;})) {
        var label=(personName?personName+"'s ":"")+appt.title+(appt.provider?" · "+appt.provider:"");
        events.push({id:calId,title:"🩺 "+label,date:appt.date,time:appt.time||"",color:"#6A9BB5",notes:appt.body||""});
        localStorage.setItem("af_calEvents",JSON.stringify(events));
        window.dispatchEvent(new CustomEvent("af-cal-changed"));
        return true;
      }
    } catch(e){}
    return false;
  }

  function save() {
    if(!form.title.trim()||!form.date)return;
    var next=Object.assign({},health);if(!next[pid])next[pid]={};
    var appt={id:editId||huid(),title:form.title,date:form.date,time:form.time,provider:form.provider,location:form.location,body:form.body};
    if(editId){
      next[pid].appointments=(next[pid].appointments||[]).map(function(x){return x.id===editId?appt:x;});
    } else {
      next[pid].appointments=(next[pid].appointments||[]).concat([appt]);
    }
    setHealth(next);
    if(form.addToCalendar) {
      var added=injectCal(appt);
      if(added){setToast("Added to calendar!");setTimeout(function(){setToast(null);},2500);}
    }
    setForm({title:"",date:"",time:"",provider:"",location:"",body:"",addToCalendar:true});
    setOpen(false);setEditId(null);
  }

  function startEdit(a){
    setForm({title:a.title,date:a.date||"",time:a.time||"",provider:a.provider||"",location:a.location||"",body:a.body||"",addToCalendar:false});
    setEditId(a.id);setOpen(true);
  }
  function remove(id){
    var next=Object.assign({},health);
    next[pid].appointments=(next[pid].appointments||[]).filter(function(x){return x.id!==id;});
    setHealth(next);
  }

  function ApptRow(ap) {
    var a=ap.appt;
    var isPast=a.date<today;
    return React.createElement("div",{style:{background:HSURF2,border:HBORD2,borderRadius:8,padding:"0.7rem 0.9rem",marginBottom:"0.5rem"}},
      React.createElement("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}},
        React.createElement("div",{style:{flex:1}},
          React.createElement("p",{style:{fontSize:13,fontWeight:500,color:HWHITE,margin:"0 0 2px"}},a.title),
          React.createElement("p",{style:{fontSize:11,color:HGOLD,margin:"0 0 2px"}},[a.date,a.time].filter(Boolean).join(" · ")+(a.provider?" · "+a.provider:"")),
          a.body&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.45)",margin:0,lineHeight:1.5}},a.body)
        ),
        React.createElement("div",{style:{display:"flex",gap:5,flexShrink:0,marginLeft:6}},
          !isPast&&React.createElement("button",{onClick:function(){injectCal(a);setToast("Added to calendar!");setTimeout(function(){setToast(null);},2500);},title:"Push to calendar",style:{background:"rgba(106,155,181,0.1)",border:"0.5px solid rgba(106,155,181,0.25)",borderRadius:5,color:"#6A9BB5",cursor:"pointer",fontSize:11,padding:"2px 7px",lineHeight:1.4,fontFamily:"inherit"}},"📅"),
          React.createElement("button",{onClick:function(){startEdit(a);},style:{background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.25)",borderRadius:5,color:HGOLD,cursor:"pointer",fontSize:11,padding:"2px 7px",lineHeight:1.4,fontFamily:"inherit"}},"Edit"),
          React.createElement("button",{onClick:function(){remove(a.id);},style:{background:"none",border:"none",color:"rgba(250,248,244,0.25)",cursor:"pointer",fontSize:14,padding:"0 2px"}},"✕")
        )
      )
    );
  }

  var LOC_OPTS=["In-person","Telehealth","Urgent care","ER","Specialist","Lab","Other"].map(function(v){return{value:v,label:v};});
  return React.createElement(React.Fragment,null,
    toast&&React.createElement("div",{style:{background:"rgba(106,155,181,0.2)",border:"0.5px solid rgba(106,155,181,0.4)",borderRadius:8,padding:"0.5rem 0.9rem",fontSize:12,color:"#6A9BB5",marginBottom:"0.75rem",textAlign:"center"}},"📅 "+toast),
    React.createElement(HCard,null,
      React.createElement(HCardHead,{icon:"📅",label:"Upcoming appointments",onAdd:function(){setForm({title:"",date:"",time:"",provider:"",location:"",body:"",addToCalendar:true});setEditId(null);setOpen(true);}}),
      upcoming.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No upcoming appointments"),
      upcoming.map(function(a){return React.createElement(ApptRow,{key:a.id,appt:a});})
    ),
    past.length>0&&React.createElement(HCard,{style:{marginTop:"0.9rem"}},
      React.createElement(HCardHead,{icon:"🗓️",label:"Past appointments"}),
      past.map(function(a){return React.createElement(ApptRow,{key:a.id,appt:a});})
    ),
    open&&React.createElement(HModal,{title:editId?"Edit appointment":"Add appointment",onClose:function(){setOpen(false);setEditId(null);}},
      React.createElement(HInput,{label:"Appointment title",value:form.title,onChange:function(v){setForm(function(f){return Object.assign({},f,{title:v});});},placeholder:"e.g. Annual physical, Cardiology follow-up"}),
      React.createElement(HInput,{label:"Date",value:form.date,type:"date",onChange:function(v){setForm(function(f){return Object.assign({},f,{date:v});});},placeholder:""}),
      React.createElement(HTimePicker,{label:"Time (optional)",value:form.time,onChange:function(v){setForm(function(f){return Object.assign({},f,{time:v});});}}),
      React.createElement(HInput,{label:"Provider",value:form.provider,onChange:function(v){setForm(function(f){return Object.assign({},f,{provider:v});});},placeholder:"e.g. Dr. Reyes"}),
      React.createElement(HSelect,{label:"Visit type",value:form.location,onChange:function(v){setForm(function(f){return Object.assign({},f,{location:v});});},options:LOC_OPTS}),
      React.createElement(HTextarea,{label:"Notes",value:form.body,onChange:function(v){setForm(function(f){return Object.assign({},f,{body:v});});},placeholder:"Reason for visit, instructions, prep notes…",rows:3}),
      form.date&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:"0.75rem",padding:"0.5rem 0.75rem",background:"rgba(106,155,181,0.08)",borderRadius:8,border:"0.5px solid rgba(106,155,181,0.2)",cursor:"pointer"},onClick:function(){setForm(function(f){return Object.assign({},f,{addToCalendar:!f.addToCalendar});});}},
        React.createElement("div",{style:{width:16,height:16,borderRadius:4,border:"1.5px solid rgba(106,155,181,0.5)",background:form.addToCalendar?"rgba(106,155,181,0.4)":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#6A9BB5"}},form.addToCalendar?"✓":""),
        React.createElement("span",{style:{fontSize:12,color:"rgba(106,155,181,0.9)",fontFamily:"inherit"}},"📅 Add to app calendar")
      ),
      React.createElement(HSaveBtn,{onClick:save,label:editId?"Save changes":"Add appointment"})
    )
  );
}

function HealthSection() {
  var s_people=useState(hLoadPeople()); var people=s_people[0]; var setPeople=s_people[1];
  var hPair=useHealth(); var health=hPair[0]; var setHealth=hPair[1];
  // "detail" view state: null = dashboard, {pid, tab} = person detail
  var s_detail=useState(null); var detail=s_detail[0]; var setDetail=s_detail[1];
  var s_addP=useState(false); var addingPerson=s_addP[0]; var setAddingPerson=s_addP[1];
  var s_name=useState(""); var newPersonName=s_name[0]; var setNewPersonName=s_name[1];

  function savePerson() {
    var name=newPersonName.trim(); if(!name) return;
    var color=PERSON_COLORS[people.length%PERSON_COLORS.length];
    var newP={id:"p_"+Math.random().toString(36).slice(2,9),name:name,color:color};
    var updated=people.concat([newP]);
    setPeople(updated); hSavePeople(updated);
    setNewPersonName(""); setAddingPerson(false);
  }

  function removePerson(pid) {
    if(people.length<=1) return;
    var updated=people.filter(function(p){return p.id!==pid;});
    hSavePeople(updated); setPeople(updated);
    if(detail&&detail.pid===pid) setDetail(null);
  }

  // ── Dashboard overview ────────────────────────────────────────────────────
  if(!detail) {
    return React.createElement("div",null,
      // header
      React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}},
        React.createElement("div",{style:{fontFamily:"Cormorant Garamond,serif",fontSize:22,fontWeight:600,color:HWHITE}},"Health"),
        React.createElement("button",{onClick:function(){setAddingPerson(true);},style:{fontSize:12,color:HGOLD,background:"rgba(200,169,122,0.08)",border:"0.5px solid rgba(200,169,122,0.28)",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"\u002B Add person")
      ),
      React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.35)",fontFamily:"DM Sans,sans-serif",marginBottom:18,marginTop:2}},"Tap a card to view details"),
      // Responsive person card grid — single column on phones (was fixed 2-col and cut off on mobile)
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))",gap:12}},
        people.map(function(p){
          return React.createElement(HPersonCard,{key:p.id,person:p,health:health,onOpen:function(pid){setDetail({pid:pid,tab:"history"});}});
        }),
        // add card
        React.createElement("div",{onClick:function(){setAddingPerson(true);},style:{background:"rgba(250,242,229,0.02)",border:"0.5px dashed rgba(250,242,229,0.15)",borderRadius:12,minHeight:140,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer"}},
          React.createElement("span",{style:{fontSize:22,color:"rgba(250,248,244,0.2)"}},"+"),
          React.createElement("span",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",fontFamily:"DM Sans,sans-serif"}},"Add person")
        )
      ),
      addingPerson&&React.createElement(HModal,{title:"Add person",onClose:function(){setAddingPerson(false);setNewPersonName("");}},
        React.createElement(HInput,{label:"Name",value:newPersonName,onChange:setNewPersonName,placeholder:"e.g. Twyla, Ellie, Sam"}),
        React.createElement(HSaveBtn,{onClick:savePerson,label:"Add person"})
      )
    );
  }

  // ── Person detail view ────────────────────────────────────────────────────
  var person=people.find(function(p){return p.id===detail.pid;});
  if(!person) { setDetail(null); return null; }
  var tp={personId:person.id,health:health,setHealth:setHealth,personName:person.name,allPeople:people};
  var initials=person.name.split(" ").map(function(w){return w[0];}).join("").slice(0,2).toUpperCase();

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",height:"100%"}},
    // back + person header
    React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:14}},
      React.createElement("button",{onClick:function(){setDetail(null);},style:{background:"rgba(250,242,229,0.06)",border:HBORD,borderRadius:8,padding:"5px 10px",fontSize:12,color:"rgba(250,248,244,0.5)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"\u2190 All"),
      React.createElement("div",{style:{width:28,height:28,borderRadius:"50%",background:person.color||HGOLD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:HNAVY,flexShrink:0}},initials),
      React.createElement("span",{style:{fontSize:15,fontWeight:500,color:HWHITE,flex:1}},person.name),
      // maternal link pill — show on non-"You" people when the first person exists
      people.length>1&&people.indexOf(person)>0&&React.createElement("div",{style:{position:"relative"}},
        React.createElement("button",{onClick:function(){setDetail(function(d){return Object.assign({},d,{showLink:!d.showLink});});},title:"Link family history",style:{fontSize:11,color:"rgba(250,248,244,0.4)",background:"rgba(250,242,229,0.06)",border:HBORD,borderRadius:7,padding:"4px 9px",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🔗 Hx link"),
        detail.showLink&&React.createElement("div",{style:{position:"absolute",right:0,top:"calc(100% + 4px)",background:"#2E486B",border:HBORD,borderRadius:10,padding:"0.75rem",zIndex:99,minWidth:220,boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}},
          React.createElement("p",{style:{fontSize:12,color:HWHITE,fontWeight:500,marginBottom:4}},"Inherit family history from:"),
          React.createElement("p",{style:{fontSize:11,color:"rgba(250,248,244,0.4)",marginBottom:10,lineHeight:1.5}},"Their history becomes this person's maternal side. Updates automatically."),
          React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:6}},
            React.createElement("button",{onClick:function(){var next=Object.assign({},health);if(!next[person.id])next[person.id]={};next[person.id].maternalSourceId=null;setHealth(next);setDetail(function(d){return Object.assign({},d,{showLink:false});});},style:{fontSize:11,padding:"5px 10px",borderRadius:6,background:(!health[person.id]||!health[person.id].maternalSourceId)?"rgba(200,169,122,0.15)":"transparent",border:HBORD,color:HGOLD,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}},"None (use own entries)"),
            people.filter(function(p){return p.id!==person.id;}).map(function(p){
              var isLinked=health[person.id]&&health[person.id].maternalSourceId===p.id;
              return React.createElement("button",{key:p.id,onClick:function(){var next=Object.assign({},health);if(!next[person.id])next[person.id]={};next[person.id].maternalSourceId=p.id;setHealth(next);setDetail(function(d){return Object.assign({},d,{showLink:false});});},style:{fontSize:11,padding:"5px 10px",borderRadius:6,background:isLinked?"rgba(200,169,122,0.15)":"transparent",border:HBORD,color:isLinked?HGOLD:"rgba(250,248,244,0.5)",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}},p.name+(isLinked?" ✓":""));
            })
          )
        )
      ),
      people.indexOf(person)>0&&React.createElement("button",{onClick:function(){removePerson(person.id);},style:{background:"none",border:"none",fontSize:12,color:"rgba(250,248,244,0.25)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Remove")
    ),
    // subtabs
    React.createElement("div",{style:{display:"flex",borderBottom:"0.5px solid rgba(250,242,229,0.08)",background:"rgba(0,0,0,0.15)",overflowX:"auto",flexShrink:0,marginBottom:0}},
      H_TABS.map(function(t){return React.createElement("button",{key:t.id,onClick:function(){setDetail(function(d){return Object.assign({},d,{tab:t.id});});},style:{padding:"0.55rem 0.85rem",fontSize:12,background:"none",border:"none",borderBottom:t.id===detail.tab?"2px solid rgba(250,248,244,0.5)":"2px solid transparent",color:t.id===detail.tab?HWHITE:"rgba(250,248,244,0.4)",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}},t.label);})
    ),
    React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"1rem 0",display:"flex",flexDirection:"column",gap:"0.9rem"}},
      detail.tab==="history"   &&React.createElement(HHistoryTab,  tp),
      detail.tab==="immunize"  &&React.createElement(HImmunizeTab, tp),
      detail.tab==="meds"      &&React.createElement(HMedsTab,     tp),
      detail.tab==="dosing"    &&React.createElement(DosingTracker, tp),
      detail.tab==="allergies" &&React.createElement(HAllergiesTab,tp),
      detail.tab==="family"    &&React.createElement(HFamilyTab,   Object.assign({},tp,{maternalSourceId:health[person.id]&&health[person.id].maternalSourceId})),
      detail.tab==="notes"     &&React.createElement(HNotesTab,    tp),
      detail.tab==="appts"     &&React.createElement(HAppointmentsTab, tp)
    )
  );
}

// ── Home Systems Section ──────────────────────────────────────────────────────
var SYS_ICONS = [
  {id:"hvac",    label:"HVAC",           emoji:"🌬️"},
  {id:"water",   label:"Water heater",   emoji:"💧"},
  {id:"electric",label:"Electrical",     emoji:"⚡"},
  {id:"roof",    label:"Roof",           emoji:"🏠"},
  {id:"gutters", label:"Gutters",        emoji:"🌿"},
  {id:"plumb",   label:"Plumbing",       emoji:"🔧"},
  {id:"pest",    label:"Pest control",   emoji:"🐛"},
  {id:"appliance",label:"Appliance",     emoji:"🫧"},
  {id:"other",   label:"Other",          emoji:"🔩"},
]
var SYS_FREQ = [
  {id:"1m",  label:"Monthly"},
  {id:"3m",  label:"Every 3 months"},
  {id:"6m",  label:"Every 6 months"},
  {id:"1y",  label:"Yearly"},
  {id:"2y",  label:"Every 2 years"},
  {id:"5y",  label:"Every 5 years"},
  {id:"once",label:"One-time"},
]

function sysLoadSystems() {
  try { var s=localStorage.getItem("af_vaultSystems"); return s?JSON.parse(s):[]; } catch(e){return [];}
}
function sysSaveSystems(v) { try { localStorage.setItem("af_vaultSystems",JSON.stringify(v)); afVaultChanged("vaultSystems"); } catch(e){} }

function sysDaysUntil(dateStr) {
  if(!dateStr) return null;
  var now=new Date(); now.setHours(0,0,0,0);
  var d=new Date(dateStr+"T00:00:00");
  return Math.round((d-now)/86400000);
}

function sysNextDate(lastDone, freqId) {
  if(!lastDone||!freqId||freqId==="once") return null;
  var d=new Date(lastDone+"T00:00:00");
  var map={
    "1m":function(x){x.setMonth(x.getMonth()+1);},
    "3m":function(x){x.setMonth(x.getMonth()+3);},
    "6m":function(x){x.setMonth(x.getMonth()+6);},
    "1y":function(x){x.setFullYear(x.getFullYear()+1);},
    "2y":function(x){x.setFullYear(x.getFullYear()+2);},
    "5y":function(x){x.setFullYear(x.getFullYear()+5);},
  };
  if(map[freqId]) map[freqId](d);
  return d.toISOString().slice(0,10);
}

function sysStatus(system) {
  var due = system.nextDue || sysNextDate(system.lastDone, system.freq);
  if(!due) return "ok";
  var days=sysDaysUntil(due);
  if(days===null) return "ok";
  if(days<0) return "overdue";
  if(days<=30) return "soon";
  return "ok";
}

function sysStatusColor(status) {
  if(status==="overdue") return "#e24b4a";
  if(status==="soon") return "#ef9f27";
  return "#1d9e75";
}

function sysStatusLabel(system) {
  var due = system.nextDue || sysNextDate(system.lastDone, system.freq);
  var status=sysStatus(system);
  if(!due) return system.lastDone ? ("Done "+system.lastDone) : "Not logged";
  var days=sysDaysUntil(due);
  if(days===null) return "Scheduled";
  if(days<0) return Math.abs(days)+"d overdue";
  if(days===0) return "Due today";
  if(days===1) return "Due tomorrow";
  return "Due in "+days+"d";
}

// ── House File (Records) ──────────────────────────────────────────────────────
var HF_CATS = [
  { id:"home",    label:"Home specs",       emoji:"🏠", desc:"Paint colors, flooring, fixtures, utility accounts" },
  { id:"vehicle", label:"Vehicles",         emoji:"🚗", desc:"VIN, insurance, registration, service history" },
  { id:"warranty",label:"Warranties",       emoji:"🛡️", desc:"Appliances, systems, electronics" },
  { id:"tax",     label:"Tax file",         emoji:"📄", desc:"Annual checklists and year summaries" },
  { id:"legal",   label:"Legal & financial",emoji:"⚖️", desc:"Wills, insurance policies, mortgage, emergency contacts" },
  { id:"other",   label:"Other",            emoji:"📋", desc:"Anything that doesn't fit elsewhere" },
]

// Card types: "note" (freeform fields), "checklist" (items with checkboxes)
// Each card: { id, catId, type, title, fields:[{label,value}], items:[{id,text,done}], notes }

function hfLoad() { try { var s=localStorage.getItem("af_houseFile"); if(!s) return []; var _hf=JSON.parse(s); return Array.isArray(_hf)?_hf:[]; } catch(e){return [];} }
function hfSave(v) { try { localStorage.setItem("af_houseFile",JSON.stringify(v)); afVaultChanged("houseFile"); } catch(e){} }

var HF_FIELD_TEMPLATES = {
  home: [
    {label:"Room / area",value:""},
    {label:"Paint brand",value:""},
    {label:"Paint color name",value:""},
    {label:"Paint code",value:""},
    {label:"Finish",value:""},
  ],
  vehicle: [
    {label:"Year / Make / Model",value:""},
    {label:"Color",value:""},
    {label:"VIN",value:""},
    {label:"License plate",value:""},
    {label:"Insurance carrier",value:""},
    {label:"Policy number",value:""},
    {label:"Registration expires",value:""},
    {label:"Tire size",value:""},
  ],
  warranty: [
    {label:"Item",value:""},
    {label:"Brand / model",value:""},
    {label:"Purchase date",value:""},
    {label:"Warranty expires",value:""},
    {label:"Serial number",value:""},
    {label:"Retailer",value:""},
    {label:"Support contact",value:""},
  ],
  tax: [],
  legal: [
    {label:"Document type",value:""},
    {label:"Institution / carrier",value:""},
    {label:"Account / policy number",value:""},
    {label:"Location of document",value:""},
    {label:"Contact / attorney",value:""},
    {label:"Notes",value:""},
  ],
  other: [
    {label:"Details",value:""},
  ],
}

var TAX_CHECKLIST_DEFAULTS = [
  "W-2 from employer(s)",
  "1099-NEC (freelance / contract income)",
  "1099-INT (bank interest)",
  "1099-DIV (dividends)",
  "1099-B (investment sales)",
  "1099-R (retirement distributions)",
  "SSA-1099 (Social Security)",
  "Mortgage interest statement (1098)",
  "Property tax statement",
  "Charitable donation receipts",
  "Medical expense receipts",
  "Childcare provider EIN + amount paid",
  "Student loan interest (1098-E)",
  "Prior year tax return",
  "Health insurance 1095-A / 1095-B / 1095-C",
]

function HouseFileSection() {
  var s_cards=useState(hfLoad); var cards=s_cards[0]; var setCards=s_cards[1];
  React.useEffect(function() {
    function onRefresh(e) {
      if (!e.detail?.key || e.detail.key === "houseFile") {
        setCards(hfLoad())
      }
    }
    window.addEventListener("af-data-changed", onRefresh)
    return function() { window.removeEventListener("af-data-changed", onRefresh) }
  }, [])
  var s_cat=useState("home"); var activeCat=s_cat[0]; var setActiveCat=s_cat[1];
  var s_detail=useState(null); var detail=s_detail[0]; var setDetail=s_detail[1];
  var s_adding=useState(false); var adding=s_adding[0]; var setAdding=s_adding[1];
  var s_cardType=useState("note"); var cardType=s_cardType[0]; var setCardType=s_cardType[1];
  var s_title=useState(""); var cardTitle=s_title[0]; var setCardTitle=s_title[1];
  var s_fields=useState([]); var cardFields=s_fields[0]; var setCardFields=s_fields[1];
  var s_items=useState([]); var cardItems=s_items[0]; var setCardItems=s_items[1];
  var s_newItem=useState(""); var newItem=s_newItem[0]; var setNewItem=s_newItem[1];
  var s_notes=useState(""); var cardNotes=s_notes[0]; var setCardNotes=s_notes[1];
  var s_editing=useState(null); var editingId=s_editing[0]; var setEditingId=s_editing[1];
  var s_fieldEdit=useState(null); var fieldEdit=s_fieldEdit[0]; var setFieldEdit=s_fieldEdit[1];

  function saveCards(updated) { setCards(updated); hfSave(updated); }

  var catCards=cards.filter(function(c){return c.catId===activeCat;});
  var cat=HF_CATS.find(function(c){return c.id===activeCat;})||HF_CATS[0];

  function openAdd() {
    var tmpl=HF_FIELD_TEMPLATES[activeCat]||[];
    var isChecklist=activeCat==="tax";
    setCardType(isChecklist?"checklist":"note");
    setCardTitle("");
    setCardFields(tmpl.map(function(f){return Object.assign({},f);}));
    setCardItems(isChecklist?TAX_CHECKLIST_DEFAULTS.map(function(t){return {id:huid(),text:t,done:false};}): []);
    setCardNotes("");
    setEditingId(null);
    setAdding(true);
  }

  function openEdit(card) {
    setCardType(card.type||"note");
    setCardTitle(card.title||"");
    setCardFields((card.fields||[]).map(function(f){return Object.assign({},f);}));
    setCardItems((card.items||[]).map(function(i){return Object.assign({},i);}));
    setCardNotes(card.notes||"");
    setEditingId(card.id);
    setAdding(true);
    setDetail(null);
  }

  function saveCard() {
    if(!cardTitle.trim()) return;
    var entry={id:editingId||huid(),catId:activeCat,type:cardType,title:cardTitle.trim(),fields:cardFields,items:cardItems,notes:cardNotes};
    if(editingId) {
      saveCards(cards.map(function(c){return c.id===editingId?entry:c;}));
    } else {
      saveCards(cards.concat([entry]));
    }
    setAdding(false); setEditingId(null); setDetail(entry.id);
  }

  function deleteCard(id) {
    saveCards(cards.filter(function(c){return c.id!==id;}));
    setDetail(null);
  }

  function toggleItem(cardId, itemId) {
    saveCards(cards.map(function(c){
      if(c.id!==cardId) return c;
      return Object.assign({},c,{items:(c.items||[]).map(function(it){return it.id===itemId?Object.assign({},it,{done:!it.done}):it;})});
    }));
    // also update detail view items if open
    setCardItems(function(prev){return prev.map(function(it){return it.id===itemId?Object.assign({},it,{done:!it.done}):it;});});
  }

  function addChecklistItem() {
    if(!newItem.trim()) return;
    var item={id:huid(),text:newItem.trim(),done:false};
    setCardItems(function(prev){return prev.concat([item]);});
    setNewItem("");
  }

  function removeChecklistItem(id) {
    setCardItems(function(prev){return prev.filter(function(i){return i.id!==id;});});
  }

  var SURF="rgba(250,242,229,0.05)";
  var SURF2="rgba(250,242,229,0.04)";
  var BORD2="0.5px solid rgba(250,242,229,0.08)";

  // ── Detail card view ───────────────────────────────────────────────────────
  if(detail) {
    var card=cards.find(function(c){return c.id===detail;});
    if(!card) { setDetail(null); return null; }
    var cardCat=HF_CATS.find(function(c){return c.id===card.catId;})||HF_CATS[0];
    var doneCount=(card.items||[]).filter(function(i){return i.done;}).length;
    var totalCount=(card.items||[]).length;
    return React.createElement("div",null,
      // back + actions
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:16}},
        React.createElement("button",{onClick:function(){setDetail(null);},style:{background:"rgba(250,242,229,0.06)",border:HBORD,borderRadius:8,padding:"5px 10px",fontSize:12,color:"rgba(250,248,244,0.5)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"\u2190 Back"),
        React.createElement("span",{style:{fontSize:15}},cardCat.emoji),
        React.createElement("span",{style:{fontSize:15,fontWeight:500,color:HWHITE,flex:1}},card.title),
        React.createElement("button",{onClick:function(){openEdit(card);},style:{fontSize:11,color:HGOLD,background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.25)",borderRadius:6,padding:"4px 10px",cursor:"pointer"}},"Edit"),
        React.createElement("button",{onClick:function(){if(window.confirm("Delete this record?")){deleteCard(card.id);}},style:{fontSize:11,color:"rgba(240,153,123,0.6)",background:"rgba(226,75,74,0.06)",border:"0.5px solid rgba(226,75,74,0.15)",borderRadius:6,padding:"4px 10px",cursor:"pointer"}},"Delete")
      ),
      // checklist
      card.type==="checklist"&&React.createElement("div",{style:{background:SURF,border:HBORD,borderRadius:12,padding:"14px 16px",marginBottom:12}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}},
          React.createElement("span",{style:{fontSize:12,color:"rgba(250,248,244,0.45)",fontFamily:"DM Sans,sans-serif"}},(doneCount+" of "+totalCount+" collected")),
          doneCount===totalCount&&totalCount>0&&React.createElement("span",{style:{fontSize:11,padding:"2px 8px",borderRadius:10,background:"rgba(29,158,117,0.15)",color:"#5dcaa5",border:"0.5px solid rgba(29,158,117,0.25)"}},"Complete \u2713")
        ),
        // progress bar
        totalCount>0&&React.createElement("div",{style:{height:3,background:"rgba(250,242,229,0.07)",borderRadius:2,marginBottom:12}},
          React.createElement("div",{style:{width:Math.round((doneCount/totalCount)*100)+"%",height:3,borderRadius:2,background:"#1d9e75",transition:"width 0.2s"}})
        ),
        (card.items||[]).map(function(item){
          return React.createElement("div",{key:item.id,style:{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:BORD2,cursor:"pointer"},onClick:function(){toggleItem(card.id,item.id);}},
            React.createElement("div",{style:{width:16,height:16,borderRadius:4,border:"0.5px solid "+(item.done?"rgba(29,158,117,0.6)":"rgba(250,242,229,0.2)"),background:item.done?"rgba(29,158,117,0.2)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},
              item.done&&React.createElement("span",{style:{fontSize:10,color:"#5dcaa5"}},"\u2713")
            ),
            React.createElement("span",{style:{fontSize:13,color:item.done?"rgba(250,248,244,0.3)":"rgba(250,248,244,0.8)",textDecoration:item.done?"line-through":"none",flex:1}},item.text)
          );
        })
      ),
      // fields
      card.type==="note"&&(card.fields||[]).filter(function(f){return f.value;}).length>0&&React.createElement("div",{style:{background:SURF,border:HBORD,borderRadius:12,padding:"14px 16px",marginBottom:12}},
        (card.fields||[]).map(function(f,i){
          if(!f.value) return null;
          return React.createElement("div",{key:i,style:{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:BORD2,gap:12}},
            React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.38)",textTransform:"uppercase",letterSpacing:"0.05em",flexShrink:0,paddingTop:1}},f.label),
            React.createElement("span",{style:{fontSize:13,color:HWHITE,textAlign:"right",wordBreak:"break-word"}},f.value)
          );
        })
      ),
      // notes
      card.notes&&React.createElement("div",{style:{background:SURF,border:HBORD,borderRadius:12,padding:"14px 16px",marginBottom:12}},
        React.createElement("p",{style:{fontSize:11,color:"rgba(250,248,244,0.38)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 6px"}},"Notes"),
        React.createElement("p",{style:{fontSize:13,color:"rgba(250,248,244,0.7)",lineHeight:1.65,margin:0}},card.notes)
      )
    );
  }

  // ── Category list + cards ──────────────────────────────────────────────────
  return React.createElement("div",null,
    // header
    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}},
      React.createElement("div",{style:{fontFamily:"Cormorant Garamond,serif",fontSize:22,fontWeight:600,color:HWHITE}},"House File"),
      React.createElement("button",{onClick:openAdd,style:{fontSize:12,color:HGOLD,background:"rgba(200,169,122,0.08)",border:"0.5px solid rgba(200,169,122,0.28)",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"\u002B Add record")
    ),
    // category pills
    React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}},
      HF_CATS.map(function(c){
        var count=cards.filter(function(r){return r.catId===c.id;}).length;
        return React.createElement("button",{key:c.id,onClick:function(){setActiveCat(c.id);},style:{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",fontSize:12,borderRadius:20,border:"0.5px solid "+(activeCat===c.id?"rgba(200,169,122,0.45)":"rgba(250,242,229,0.1)"),background:activeCat===c.id?"rgba(200,169,122,0.12)":"rgba(250,242,229,0.03)",color:activeCat===c.id?HGOLD:"rgba(250,248,244,0.45)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
          React.createElement("span",null,c.emoji),
          React.createElement("span",null,c.label),
          count>0&&React.createElement("span",{style:{fontSize:10,background:"rgba(200,169,122,0.2)",color:HGOLD,borderRadius:10,padding:"0 5px",lineHeight:"16px"}},count)
        );
      })
    ),
    // category description
    React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",fontFamily:"DM Sans,sans-serif",marginBottom:14,marginTop:-6}},cat.desc),
    // cards in active category
    catCards.length===0
      ? React.createElement("div",{style:{textAlign:"center",padding:"36px 20px",color:"rgba(250,248,244,0.28)",fontSize:13,fontFamily:"DM Sans,sans-serif",background:SURF2,border:"0.5px dashed rgba(250,242,229,0.1)",borderRadius:12}},
          React.createElement("div",{style:{fontSize:28,marginBottom:8}},cat.emoji),
          React.createElement("div",{style:{marginBottom:4}},"No "+cat.label+" records yet"),
          React.createElement("button",{onClick:openAdd,style:{marginTop:10,fontSize:12,color:HGOLD,background:"rgba(200,169,122,0.08)",border:"0.5px solid rgba(200,169,122,0.25)",borderRadius:7,padding:"6px 14px",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"\u002B Add first record")
        )
      : React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:8}},
          catCards.map(function(card){
            var doneC=(card.items||[]).filter(function(i){return i.done;}).length;
            var totalC=(card.items||[]).length;
            var filledFields=(card.fields||[]).filter(function(f){return f.value;}).length;
            return React.createElement("div",{key:card.id,onClick:function(){setDetail(card.id);},style:{background:SURF,border:HBORD,borderRadius:10,padding:"12px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:12}},
              React.createElement("span",{style:{fontSize:20,flexShrink:0}},cat.emoji),
              React.createElement("div",{style:{flex:1,minWidth:0}},
                React.createElement("p",{style:{fontSize:13,fontWeight:500,color:HWHITE,margin:"0 0 3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},card.title),
                card.type==="checklist"
                  ? React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},
                      React.createElement("div",{style:{flex:1,height:3,background:"rgba(250,242,229,0.08)",borderRadius:2,maxWidth:100}},
                        React.createElement("div",{style:{width:totalC>0?Math.round((doneC/totalC)*100)+"%":"0%",height:3,borderRadius:2,background:"#1d9e75"}})
                      ),
                      React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.35)"}},(doneC+"/"+totalC))
                    )
                  : React.createElement("p",{style:{fontSize:11,color:"rgba(250,248,244,0.3)",margin:0}},(filledFields>0?(filledFields+" field"+(filledFields===1?"":"s")+" filled"):"Tap to view"))
              ),
              React.createElement("span",{style:{fontSize:12,color:"rgba(250,248,244,0.25)",flexShrink:0}},">")
            );
          })
        ),

    // ── Add / edit modal ──────────────────────────────────────────────────
    adding&&React.createElement(HModal,{title:(editingId?"Edit":"New")+" "+cat.label+" record",onClose:function(){setAdding(false);setEditingId(null);}},
      // type toggle (skip for tax — always checklist)
      activeCat!=="tax"&&React.createElement("div",{style:{display:"flex",gap:6,marginBottom:12}},
        React.createElement("button",{onClick:function(){setCardType("note");},style:{flex:1,padding:"6px",fontSize:12,borderRadius:8,border:"0.5px solid "+(cardType==="note"?"rgba(200,169,122,0.4)":"rgba(250,242,229,0.1)"),background:cardType==="note"?"rgba(200,169,122,0.12)":"rgba(250,242,229,0.03)",color:cardType==="note"?HGOLD:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Fields"),
        React.createElement("button",{onClick:function(){setCardType("checklist");if(cardItems.length===0)setCardItems([{id:huid(),text:"",done:false}]);},style:{flex:1,padding:"6px",fontSize:12,borderRadius:8,border:"0.5px solid "+(cardType==="checklist"?"rgba(200,169,122,0.4)":"rgba(250,242,229,0.1)"),background:cardType==="checklist"?"rgba(200,169,122,0.12)":"rgba(250,242,229,0.03)",color:cardType==="checklist"?HGOLD:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Checklist")
      ),
      React.createElement(HInput,{label:"Title",value:cardTitle,onChange:setCardTitle,placeholder:activeCat==="tax"?"e.g. 2024 Tax Docs":activeCat==="vehicle"?"e.g. 2018 Honda CR-V":activeCat==="home"?"e.g. Living room paint":"Title"}),
      // fields mode
      cardType==="note"&&React.createElement("div",null,
        cardFields.map(function(f,i){
          return React.createElement("div",{key:i,style:{marginBottom:8}},
            React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.38)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:3}},f.label),
            React.createElement("input",{value:f.value,onChange:function(e){var v=e.target.value;setCardFields(function(prev){return prev.map(function(ff,ii){return ii===i?Object.assign({},ff,{value:v}):ff;});});},style:{width:"100%",background:"rgba(250,242,229,0.07)",border:HBORD,borderRadius:8,padding:"0.5rem 0.7rem",color:HWHITE,fontSize:13,fontFamily:"DM Sans,sans-serif",outline:"none",boxSizing:"border-box"}})
          );
        }),
        // add custom field
        fieldEdit!==null
          ? React.createElement("div",{style:{display:"flex",gap:6,marginTop:6}},
              React.createElement("input",{value:fieldEdit,onChange:function(e){setFieldEdit(e.target.value);},placeholder:"Field label",autoFocus:true,style:{flex:1,background:"rgba(250,242,229,0.07)",border:HBORD,borderRadius:8,padding:"0.45rem 0.65rem",color:HWHITE,fontSize:12,fontFamily:"DM Sans,sans-serif",outline:"none"}}),
              React.createElement("button",{onClick:function(){if(fieldEdit.trim()){setCardFields(function(prev){return prev.concat([{label:fieldEdit.trim(),value:""}]);});setFieldEdit(null);}},style:{background:"rgba(200,169,122,0.15)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:8,padding:"0.45rem 0.8rem",color:HGOLD,cursor:"pointer",fontSize:12}},"Add"),
              React.createElement("button",{onClick:function(){setFieldEdit(null);},style:{background:"none",border:HBORD,borderRadius:8,padding:"0.45rem 0.8rem",color:"rgba(250,248,244,0.35)",cursor:"pointer",fontSize:12}},"Cancel")
            )
          : React.createElement("button",{onClick:function(){setFieldEdit("");},style:{fontSize:11,color:"rgba(250,248,244,0.35)",background:"none",border:"0.5px dashed rgba(250,242,229,0.12)",borderRadius:7,padding:"4px 10px",cursor:"pointer",marginTop:4,fontFamily:"DM Sans,sans-serif"}},"\u002B Add custom field")
      ),
      // checklist mode
      cardType==="checklist"&&React.createElement("div",null,
        React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.38)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}},"Items"),
        cardItems.map(function(item,i){
          return React.createElement("div",{key:item.id,style:{display:"flex",alignItems:"center",gap:6,marginBottom:4}},
            React.createElement("input",{value:item.text,onChange:function(e){var v=e.target.value;setCardItems(function(prev){return prev.map(function(it,ii){return ii===i?Object.assign({},it,{text:v}):it;});});},style:{flex:1,background:"rgba(250,242,229,0.07)",border:HBORD,borderRadius:8,padding:"0.4rem 0.65rem",color:HWHITE,fontSize:12,fontFamily:"DM Sans,sans-serif",outline:"none"}}),
            React.createElement("button",{onClick:function(){removeChecklistItem(item.id);},style:{background:"none",border:"none",color:"rgba(250,248,244,0.25)",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1,flexShrink:0}},"✕")
          );
        }),
        React.createElement("div",{style:{display:"flex",gap:6,marginTop:4}},
          React.createElement("input",{value:newItem,onChange:function(e){setNewItem(e.target.value);},onKeyDown:function(e){if(e.key==="Enter"){addChecklistItem();}},placeholder:"Add item…",style:{flex:1,background:"rgba(250,242,229,0.07)",border:HBORD,borderRadius:8,padding:"0.4rem 0.65rem",color:HWHITE,fontSize:12,fontFamily:"DM Sans,sans-serif",outline:"none"}}),
          React.createElement("button",{onClick:addChecklistItem,style:{background:"rgba(200,169,122,0.15)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:8,padding:"0.4rem 0.8rem",color:HGOLD,cursor:"pointer",fontSize:12}},"\u002B")
        )
      ),
      React.createElement(HTextarea,{label:"Notes (optional)",value:cardNotes,onChange:setCardNotes,placeholder:"Anything else worth remembering…",rows:2}),
      React.createElement(HSaveBtn,{onClick:saveCard,label:editingId?"Save changes":"Add record"})
    )
  );
}

// ── Home section wrapper (Systems + House File tabs) ──────────────────────────
function HomeSection() {
  var s_tab=useState("systems"); var homeTab=s_tab[0]; var setHomeTab=s_tab[1];
  return React.createElement("div",null,
    // top tab row
    React.createElement("div",{style:{display:"flex",gap:0,borderBottom:HBORD,marginBottom:20}},
      React.createElement("button",{onClick:function(){setHomeTab("systems");},style:{padding:"8px 18px",fontSize:13,background:"none",border:"none",borderBottom:homeTab==="systems"?"2px solid "+HGOLD:"2px solid transparent",color:homeTab==="systems"?HGOLD:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"DM Sans,sans-serif",fontWeight:homeTab==="systems"?600:400}},"🔧 Maintenance"),
      React.createElement("button",{onClick:function(){setHomeTab("file");},style:{padding:"8px 18px",fontSize:13,background:"none",border:"none",borderBottom:homeTab==="file"?"2px solid "+HGOLD:"2px solid transparent",color:homeTab==="file"?HGOLD:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"DM Sans,sans-serif",fontWeight:homeTab==="file"?600:400}},"📁 House File")
    ),
    homeTab==="systems"&&React.createElement(HomeSystemsSection,null),
    homeTab==="file"&&React.createElement(HouseFileSection,null)
  );
}

// ── Owned Products / Manuals ──────────────────────────────────────────────────
function prodLoad() { try { var s=localStorage.getItem("af_ownedProducts"); return s?JSON.parse(s):[]; } catch(e){ return []; } }
function prodSave(v) { try { localStorage.setItem("af_ownedProducts", JSON.stringify(v)); } catch(e){} afVaultChanged("ownedProducts"); }

function ProductsPanel() {
  var s_cats=useState(prodLoad); var cats=s_cats[0]; var setCats=s_cats[1];
  var s_exp=useState(null); var expanded=s_exp[0]; var setExpanded=s_exp[1];
  var s_addCat=useState(false); var addingCat=s_addCat[0]; var setAddingCat=s_addCat[1];
  var s_catName=useState(""); var catName=s_catName[0]; var setCatName=s_catName[1];
  var s_modal=useState(null); var modal=s_modal[0]; var setModal=s_modal[1]; // {catId, itemId|null}
  var s_form=useState({name:"",link:"",purchasedAt:"",warranty:false,warrantyNote:"",notes:""}); var form=s_form[0]; var setForm=s_form[1];
  var s_sortAZ=useState(false); var sortAZ=s_sortAZ[0]; var setSortAZ=s_sortAZ[1];

  // Keep in sync with edits from other devices
  React.useEffect(function(){ var h=function(){ setCats(prodLoad()); }; window.addEventListener("af-data-changed",h); return function(){ window.removeEventListener("af-data-changed",h); }; },[]);

  function save(v){ setCats(v); prodSave(v); }
  function addCategory(){ if(!catName.trim())return; save(cats.concat([{id:huid(),name:catName.trim(),items:[]}])); setCatName(""); setAddingCat(false); }
  function deleteCategory(id){ save(cats.filter(function(c){return c.id!==id;})); }
  function openAdd(catId){ setForm({name:"",link:"",purchasedAt:"",warranty:false,warrantyNote:"",notes:""}); setModal({catId:catId,itemId:null}); }
  function openEdit(catId,item){ setForm({name:item.name||"",link:item.link||"",purchasedAt:item.purchasedAt||"",warranty:!!item.warranty,warrantyNote:item.warrantyNote||"",notes:item.notes||""}); setModal({catId:catId,itemId:item.id}); }
  function saveItem(){
    if(!form.name.trim()||!modal)return;
    var entry={id:modal.itemId||huid(),name:form.name.trim(),link:form.link.trim(),purchasedAt:form.purchasedAt.trim(),warranty:form.warranty,warrantyNote:form.warrantyNote.trim(),notes:form.notes.trim()};
    save(cats.map(function(c){
      if(c.id!==modal.catId)return c;
      var items=c.items||[];
      items = modal.itemId ? items.map(function(it){return it.id===modal.itemId?entry:it;}) : items.concat([entry]);
      return Object.assign({},c,{items:items});
    }));
    setModal(null);
  }
  function deleteItem(catId,itemId){ save(cats.map(function(c){return c.id!==catId?c:Object.assign({},c,{items:(c.items||[]).filter(function(it){return it.id!==itemId;})});})); }

  var SURF="rgba(250,242,229,0.05)";
  var inp={width:"100%",background:"rgba(250,242,229,0.04)",border:HBORD,borderRadius:8,padding:"9px 11px",color:HWHITE,fontSize:13,fontFamily:"DM Sans,sans-serif",outline:"none",boxSizing:"border-box"};
  var lbl={fontSize:11,color:"rgba(250,248,244,0.5)",fontFamily:"DM Sans,sans-serif",display:"block",marginBottom:4,marginTop:11};
  function up(k){ return function(e){ var v=e.target.value; setForm(function(p){var n=Object.assign({},p);n[k]=v;return n;}); }; }

  return React.createElement("div",null,
    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}},
      React.createElement("button",{onClick:function(){setSortAZ(!sortAZ);},style:{fontSize:11,color:sortAZ?HGOLD:"rgba(250,248,244,0.5)",background:sortAZ?"rgba(200,169,122,0.12)":"transparent",border:"0.5px solid "+(sortAZ?"rgba(200,169,122,0.4)":"rgba(250,242,229,0.12)"),borderRadius:7,padding:"5px 11px",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},sortAZ?"A–Z ✓":"A–Z"),
      React.createElement("button",{onClick:function(){setAddingCat(true);},style:{fontSize:12,color:HGOLD,background:"rgba(200,169,122,0.08)",border:"0.5px solid rgba(200,169,122,0.28)",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"+ Add category")
    ),
    React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.35)",fontFamily:"DM Sans,sans-serif",marginBottom:16,marginTop:2}},"Everything you own and its manuals — no more digging through drawers."),
    addingCat&&React.createElement("div",{style:{display:"flex",gap:8,marginBottom:14}},
      React.createElement("input",{autoFocus:true,value:catName,onChange:function(e){setCatName(e.target.value);},onKeyDown:function(e){if(e.key==="Enter")addCategory();},placeholder:"Category (Baby, Kitchen, Garage...)",style:inp}),
      React.createElement("button",{onClick:addCategory,style:{background:HGOLD,color:"#1a2744",border:"none",borderRadius:8,padding:"0 16px",fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",fontSize:13}},"Add"),
      React.createElement("button",{onClick:function(){setAddingCat(false);setCatName("");},style:{background:"none",color:"rgba(250,248,244,0.5)",border:HBORD,borderRadius:8,padding:"0 12px",cursor:"pointer",fontFamily:"DM Sans,sans-serif",fontSize:13}},"Cancel")
    ),
    (cats.length===0&&!addingCat)&&React.createElement("div",{style:{textAlign:"center",padding:"40px 20px",color:"rgba(250,248,244,0.3)",fontSize:13,fontFamily:"DM Sans,sans-serif"}},
      React.createElement("div",{style:{fontSize:32,marginBottom:10}},"📦"),
      React.createElement("div",null,"No products yet."),
      React.createElement("div",{style:{marginTop:4,fontSize:12}},"Add a category like Baby or Kitchen, then the products you own inside it.")
    ),
    cats.map(function(cat){
      var isOpen=expanded===cat.id; var items=cat.items||[];
      if(sortAZ) items=items.slice().sort(function(a,b){return (a.name||"").localeCompare(b.name||"");});
      return React.createElement("div",{key:cat.id,style:{background:SURF,border:HBORD,borderRadius:12,marginBottom:10,overflow:"hidden"}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"},onClick:function(){setExpanded(isOpen?null:cat.id);}},
          React.createElement("span",{style:{fontSize:13,color:"rgba(250,248,244,0.4)",transition:"transform 0.2s",display:"inline-block",transform:isOpen?"rotate(90deg)":"rotate(0deg)"}},"›"),
          React.createElement("div",{style:{flex:1,fontFamily:"Cormorant Garamond,serif",fontSize:17,fontWeight:700,color:HWHITE}},cat.name),
          React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.4)",fontFamily:"DM Sans,sans-serif"}},items.length+(items.length===1?" item":" items")),
          React.createElement("button",{onClick:function(e){e.stopPropagation();if(window.confirm("Delete category \""+cat.name+"\" and its items?"))deleteCategory(cat.id);},style:{background:"none",border:"none",cursor:"pointer",color:"rgba(226,75,74,0.7)",fontSize:15,padding:"0 2px"}},"✕")
        ),
        isOpen&&React.createElement("div",{style:{padding:"0 14px 12px"}},
          items.length===0&&React.createElement("div",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",fontStyle:"italic",fontFamily:"DM Sans,sans-serif",padding:"2px 0 10px"}},"No products in here yet."),
          items.map(function(item){
            return React.createElement("div",{key:item.id,style:{background:"rgba(250,242,229,0.03)",border:HBORD,borderRadius:9,padding:"10px 12px",marginBottom:8}},
              React.createElement("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}},
                React.createElement("div",{style:{flex:1,minWidth:0}},
                  React.createElement("div",{style:{fontSize:14,fontWeight:600,color:HWHITE,fontFamily:"DM Sans,sans-serif"}},item.name),
                  item.purchasedAt&&React.createElement("div",{style:{fontSize:11,color:"rgba(250,248,244,0.45)",fontFamily:"DM Sans,sans-serif",marginTop:2}},"Bought: "+item.purchasedAt),
                  item.warranty&&React.createElement("div",{style:{fontSize:11,color:"#8bbf9a",fontFamily:"DM Sans,sans-serif",marginTop:2}},"✓ Warranty"+(item.warrantyNote?" — "+item.warrantyNote:"")),
                  item.notes&&React.createElement("div",{style:{fontSize:11,color:"rgba(250,248,244,0.45)",fontFamily:"DM Sans,sans-serif",marginTop:2,fontStyle:"italic"}},item.notes)
                ),
                React.createElement("div",{style:{display:"flex",gap:6,flexShrink:0}},
                  React.createElement("button",{onClick:function(){openEdit(cat.id,item);},style:{background:"none",border:HBORD,borderRadius:6,padding:"3px 8px",fontSize:11,color:"rgba(250,248,244,0.6)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Edit"),
                  React.createElement("button",{onClick:function(){deleteItem(cat.id,item.id);},style:{background:"none",border:HBORD,borderRadius:6,padding:"3px 7px",fontSize:11,color:"rgba(226,75,74,0.7)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"✕")
                )
              ),
              item.link&&React.createElement("a",{href:(item.link.indexOf("http")===0?item.link:"https://"+item.link),target:"_blank",rel:"noopener noreferrer",onClick:function(e){e.stopPropagation();},style:{display:"inline-block",marginTop:7,fontSize:12,color:HGOLD,textDecoration:"none",fontFamily:"DM Sans,sans-serif"}},"📄 Manual / website ↗")
            );
          }),
          React.createElement("button",{onClick:function(){openAdd(cat.id);},style:{width:"100%",marginTop:4,background:"rgba(200,169,122,0.07)",border:"0.5px dashed rgba(200,169,122,0.3)",borderRadius:8,padding:"9px",color:HGOLD,fontSize:12,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"+ Add product")
        )
      );
    }),
    modal&&React.createElement("div",{style:{position:"fixed",inset:0,background:"rgba(15,26,42,0.72)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"},onClick:function(){setModal(null);}},
      React.createElement("div",{onClick:function(e){e.stopPropagation();},style:{background:"#1a2744",borderRadius:"18px 18px 0 0",padding:"20px",paddingBottom:"calc(20px + env(safe-area-inset-bottom,0px))",width:"min(480px,100%)",maxHeight:"calc(88dvh - env(safe-area-inset-top,0px))",overflowY:"auto"}},
        React.createElement("div",{style:{fontFamily:"Cormorant Garamond,serif",fontSize:19,fontWeight:700,color:HWHITE,marginBottom:2}},modal.itemId?"Edit product":"Add product"),
        React.createElement("label",{style:lbl},"Name"),
        React.createElement("input",{autoFocus:true,value:form.name,onChange:up("name"),placeholder:"Snoo, Graco carseat...",style:inp}),
        React.createElement("label",{style:lbl},"Link (manual or website)"),
        React.createElement("input",{value:form.link,onChange:up("link"),placeholder:"https://...",style:inp}),
        React.createElement("label",{style:lbl},"Where purchased"),
        React.createElement("input",{value:form.purchasedAt,onChange:up("purchasedAt"),placeholder:"Target, Amazon, gift...",style:inp}),
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:9,marginTop:13,cursor:"pointer"},onClick:function(){setForm(function(p){return Object.assign({},p,{warranty:!p.warranty});});}},
          React.createElement("span",{style:{width:18,height:18,borderRadius:5,border:"1.5px solid "+(form.warranty?HGOLD:"rgba(250,248,244,0.25)"),background:form.warranty?HGOLD:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},form.warranty?React.createElement("span",{style:{color:"#1a2744",fontSize:11,fontWeight:900}},"✓"):null),
          React.createElement("span",{style:{fontSize:13,color:HWHITE,fontFamily:"DM Sans,sans-serif"}},"Warranty purchased")
        ),
        form.warranty&&React.createElement("input",{value:form.warrantyNote,onChange:up("warrantyNote"),placeholder:"Expires 2028, receipt in email...",style:Object.assign({},inp,{marginTop:8})}),
        React.createElement("label",{style:lbl},"Notes"),
        React.createElement("textarea",{value:form.notes,onChange:up("notes"),placeholder:"Model number, serial, anything useful...",style:Object.assign({},inp,{minHeight:60,resize:"vertical"})}),
        React.createElement("div",{style:{display:"flex",gap:8,marginTop:16}},
          React.createElement("button",{onClick:saveItem,style:{flex:1,background:HGOLD,color:"#1a2744",border:"none",borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer",fontFamily:"DM Sans,sans-serif",fontSize:14}},"Save"),
          React.createElement("button",{onClick:function(){setModal(null);},style:{flex:1,background:"none",color:"rgba(250,248,244,0.6)",border:HBORD,borderRadius:10,padding:"11px",cursor:"pointer",fontFamily:"DM Sans,sans-serif",fontSize:14}},"Cancel")
        )
      )
    )
  );
}

function HomeSystemsSection() {
  var s_tab=useState("maintenance"); var sysTab=s_tab[0]; var setSysTab=s_tab[1];
  function tabBtn(id,label){
    var active=sysTab===id;
    return React.createElement("button",{onClick:function(){setSysTab(id);},style:{flex:1,background:active?"rgba(200,169,122,0.15)":"transparent",color:active?HGOLD:"rgba(250,248,244,0.5)",border:"0.5px solid "+(active?"rgba(200,169,122,0.4)":"rgba(250,242,229,0.1)"),borderRadius:8,padding:"8px 0",fontSize:12.5,fontWeight:active?700:500,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},label);
  }
  return React.createElement("div",null,
    React.createElement("div",{style:{fontFamily:"Cormorant Garamond,serif",fontSize:22,fontWeight:600,color:HWHITE,marginBottom:12}},"Maintenance"),
    React.createElement("div",{style:{display:"flex",gap:8,marginBottom:16}}, tabBtn("maintenance","Maintenance"), tabBtn("products","Products")),
    sysTab==="products" ? React.createElement(ProductsPanel,null) : React.createElement(MaintenancePanel,null)
  );
}

function MaintenancePanel() {
  var s_sys=useState(sysLoadSystems); var systems=s_sys[0]; var setSystems=s_sys[1];
  var s_detail=useState(null); var detail=s_detail[0]; var setDetail=s_detail[1];
  var s_adding=useState(false); var adding=s_adding[0]; var setAdding=s_adding[1];
  var s_form=useState({name:"",type:"other",freq:"1y",lastDone:"",nextDue:"",notes:""}); var form=s_form[0]; var setForm=s_form[1];
  var s_editIdx=useState(null); var editIdx=s_editIdx[0]; var setEditIdx=s_editIdx[1];

  function saveSystems(updated) { setSystems(updated); sysSaveSystems(updated); }

  function saveForm() {
    if(!form.name.trim()) return;
    var entry={id:huid(),name:form.name.trim(),type:form.type,freq:form.freq,lastDone:form.lastDone,nextDue:form.nextDue||sysNextDate(form.lastDone,form.freq)||"",notes:form.notes};
    if(editIdx!==null) {
      var updated=systems.map(function(s,i){return i===editIdx?entry:s;});
      saveSystems(updated); setEditIdx(null);
    } else {
      saveSystems(systems.concat([entry]));
    }
    setForm({name:"",type:"other",freq:"1y",lastDone:"",nextDue:"",notes:""});
    setAdding(false);
  }

  function markDone(idx) {
    var today=new Date().toISOString().slice(0,10);
    var updated=systems.map(function(s,i){
      if(i!==idx) return s;
      var next=sysNextDate(today,s.freq)||"";
      return Object.assign({},s,{lastDone:today,nextDue:next});
    });
    saveSystems(updated);
  }

  function deleteSystem(idx) { saveSystems(systems.filter(function(_,i){return i!==idx;})); }

  // alerts
  var overdue=systems.filter(function(s){return sysStatus(s)==="overdue";});
  var soon=systems.filter(function(s){return sysStatus(s)==="soon";});
  var SURF="rgba(250,242,229,0.05)";
  var SURF2="rgba(250,242,229,0.04)";

  return React.createElement("div",null,
    // header
    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}},
      React.createElement("div",null),
      React.createElement("button",{onClick:function(){setAdding(true);setEditIdx(null);setForm({name:"",type:"other",freq:"1y",lastDone:"",nextDue:"",notes:""});},style:{fontSize:12,color:HGOLD,background:"rgba(200,169,122,0.08)",border:"0.5px solid rgba(200,169,122,0.28)",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"\u002B Add system")
    ),
    React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.35)",fontFamily:"DM Sans,sans-serif",marginBottom:16,marginTop:2}},"Track maintenance schedules for every part of your home"),

    // alert banners
    overdue.length>0&&React.createElement("div",{style:{background:"rgba(226,75,74,0.08)",border:"0.5px solid rgba(226,75,74,0.2)",borderRadius:10,padding:"9px 13px",display:"flex",alignItems:"center",gap:9,fontSize:12,color:"#f0997b",marginBottom:10}},
      React.createElement("span",{style:{fontSize:15}},"\u26a0\ufe0f"),
      overdue.length===1
        ? (overdue[0].name+" is overdue")
        : (overdue.length+" systems are overdue")
    ),
    soon.length>0&&React.createElement("div",{style:{background:"rgba(239,159,39,0.08)",border:"0.5px solid rgba(239,159,39,0.18)",borderRadius:10,padding:"9px 13px",display:"flex",alignItems:"center",gap:9,fontSize:12,color:"#ef9f27",marginBottom:10}},
      React.createElement("span",{style:{fontSize:15}},"\u23f0"),
      soon.length===1
        ? (soon[0].name+" due soon")
        : (soon.length+" systems due within 30 days")
    ),

    // system grid
    systems.length===0
      ? React.createElement("div",{style:{textAlign:"center",padding:"40px 20px",color:"rgba(250,248,244,0.3)",fontSize:13,fontFamily:"DM Sans,sans-serif"}},
          React.createElement("div",{style:{fontSize:32,marginBottom:10}},"🏠"),
          React.createElement("div",null,"No systems added yet."),
          React.createElement("div",{style:{marginTop:4,fontSize:12}},"Track HVAC filters, water heaters, and anything that needs regular maintenance.")
        )
      : React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:12}},
          systems.map(function(sys,i){
            var status=sysStatus(sys);
            var statusColor=sysStatusColor(status);
            var typeIcon=(SYS_ICONS.find(function(s){return s.id===sys.type;})||SYS_ICONS[SYS_ICONS.length-1]).emoji;
            return React.createElement("div",{key:sys.id||i,style:{background:SURF,border:HBORD,borderRadius:10,padding:"12px 12px 10px",display:"flex",flexDirection:"column",gap:6,cursor:"pointer"},
              onClick:function(){setDetail(i);}},
              React.createElement("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}},
                React.createElement("span",{style:{fontSize:20}},typeIcon),
                React.createElement("span",{style:{width:8,height:8,borderRadius:"50%",background:statusColor,display:"inline-block",flexShrink:0,marginTop:3}})
              ),
              React.createElement("p",{style:{fontSize:12,fontWeight:500,color:HWHITE,margin:0,lineHeight:1.3}},sys.name),
              React.createElement("p",{style:{fontSize:11,color:statusColor,margin:0}},sysStatusLabel(sys))
            );
          }),
          // add tile
          React.createElement("div",{onClick:function(){setAdding(true);setEditIdx(null);setForm({name:"",type:"other",freq:"1y",lastDone:"",nextDue:"",notes:""});},style:{background:"rgba(250,242,229,0.02)",border:"0.5px dashed rgba(250,242,229,0.13)",borderRadius:10,minHeight:90,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,cursor:"pointer"}},
            React.createElement("span",{style:{fontSize:20,color:"rgba(250,248,244,0.18)"}},"+"),
            React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.28)",fontFamily:"DM Sans,sans-serif"}},"Add")
          )
        ),

    // detail drawer (shows below grid)
    detail!==null&&systems[detail]&&(function(){
      var sys=systems[detail];
      var status=sysStatus(sys);
      var freqLabel=(SYS_FREQ.find(function(f){return f.id===sys.freq;})||{label:sys.freq||"—"}).label;
      return React.createElement("div",{style:{background:SURF2,border:HBORD,borderRadius:12,padding:"16px",marginTop:4}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}},
          React.createElement("span",{style:{fontSize:14,fontWeight:500,color:HWHITE}},sys.name),
          React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center"}},
            React.createElement("button",{onClick:function(){setEditIdx(detail);setForm({name:sys.name,type:sys.type||"other",freq:sys.freq||"1y",lastDone:sys.lastDone||"",nextDue:sys.nextDue||"",notes:sys.notes||""});setAdding(true);setDetail(null);},style:{fontSize:11,color:HGOLD,background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.25)",borderRadius:6,padding:"3px 9px",cursor:"pointer"}},"Edit"),
            React.createElement("button",{onClick:function(){setDetail(null);},style:{background:"none",border:"none",color:"rgba(250,248,244,0.3)",cursor:"pointer",fontSize:16,padding:"0 2px"}},"✕")
          )
        ),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}},
          React.createElement("div",{style:{background:"rgba(250,242,229,0.03)",borderRadius:8,padding:"8px 10px"}},
            React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.35)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Frequency"),
            React.createElement("p",{style:{fontSize:13,color:HWHITE,margin:0}},freqLabel)
          ),
          React.createElement("div",{style:{background:"rgba(250,242,229,0.03)",borderRadius:8,padding:"8px 10px"}},
            React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.35)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Status"),
            React.createElement("p",{style:{fontSize:13,color:sysStatusColor(status),margin:0}},sysStatusLabel(sys))
          ),
          sys.lastDone&&React.createElement("div",{style:{background:"rgba(250,242,229,0.03)",borderRadius:8,padding:"8px 10px"}},
            React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.35)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Last done"),
            React.createElement("p",{style:{fontSize:13,color:HWHITE,margin:0}},sys.lastDone)
          ),
          (sys.nextDue||sysNextDate(sys.lastDone,sys.freq))&&React.createElement("div",{style:{background:"rgba(250,242,229,0.03)",borderRadius:8,padding:"8px 10px"}},
            React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.35)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Next due"),
            React.createElement("p",{style:{fontSize:13,color:HWHITE,margin:0}},sys.nextDue||sysNextDate(sys.lastDone,sys.freq))
          )
        ),
        sys.notes&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.45)",lineHeight:1.6,margin:"0 0 12px",fontStyle:"italic"}},sys.notes),
        React.createElement("div",{style:{display:"flex",gap:8}},
          React.createElement("button",{onClick:function(){markDone(detail);},style:{flex:1,background:"rgba(29,158,117,0.12)",border:"0.5px solid rgba(29,158,117,0.25)",borderRadius:8,padding:"8px",color:"#5dcaa5",fontSize:13,cursor:"pointer",fontFamily:"DM Sans,sans-serif",fontWeight:500}},"\u2713 Mark done today"),
          React.createElement("button",{onClick:function(){if(window.confirm("Delete "+sys.name+"?")){deleteSystem(detail);setDetail(null);}},style:{background:"rgba(226,75,74,0.06)",border:"0.5px solid rgba(226,75,74,0.18)",borderRadius:8,padding:"8px 12px",color:"rgba(240,153,123,0.7)",fontSize:13,cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Delete")
        )
      );
    }()),

    // add / edit modal
    adding&&React.createElement(HModal,{title:editIdx!==null?"Edit system":"Add system",onClose:function(){setAdding(false);setEditIdx(null);}},
      React.createElement(HInput,{label:"System name",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. HVAC filter, Water heater flush"}),
      React.createElement("div",{style:{marginBottom:"0.75rem"}},
        React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},"Type"),
        React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:5}},
          SYS_ICONS.map(function(s){
            return React.createElement("button",{key:s.id,onClick:function(){setForm(function(f){return Object.assign({},f,{type:s.id});});},style:{background:form.type===s.id?"rgba(200,169,122,0.18)":"rgba(250,242,229,0.04)",border:"0.5px solid "+(form.type===s.id?"rgba(200,169,122,0.4)":"rgba(250,242,229,0.1)"),borderRadius:8,padding:"5px 8px",fontSize:11,color:form.type===s.id?HGOLD:"rgba(250,248,244,0.5)",cursor:"pointer"}},s.emoji+" "+s.label);
          })
        )
      ),
      React.createElement("div",{style:{marginBottom:"0.75rem"}},
        React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},"Frequency"),
        React.createElement("select",{value:form.freq,onChange:function(e){setForm(function(f){return Object.assign({},f,{freq:e.target.value});});},style:{width:"100%",background:"rgba(30,46,82,0.95)",border:HBORD,borderRadius:8,padding:"0.5rem 0.7rem",color:HWHITE,fontSize:13,fontFamily:"DM Sans,sans-serif",outline:"none"}},
          SYS_FREQ.map(function(f){return React.createElement("option",{key:f.id,value:f.id},f.label);})
        )
      ),
      React.createElement(HInput,{label:"Last completed (optional)",value:form.lastDone,onChange:function(v){setForm(function(f){return Object.assign({},f,{lastDone:v});});},placeholder:"YYYY-MM-DD",type:"date"}),
      React.createElement(HTextarea,{label:"Notes (optional)",value:form.notes,onChange:function(v){setForm(function(f){return Object.assign({},f,{notes:v});});},placeholder:"Filter size, service provider, warranty info...",rows:2}),
      React.createElement(HSaveBtn,{onClick:saveForm,label:editIdx!==null?"Save changes":"Add system"})
    )
  );
}


// ── Recurring Reminders helpers ───────────────────────────────────────────────
var DAY_LABELS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

var FREQ_OPTIONS = [
  { id:"weekly",     label:"Every week" },
  { id:"biweekly",   label:"Every other week" },
  { id:"monthly",    label:"Monthly" },
  { id:"every6wk",   label:"Every 6 weeks" },
  { id:"every2mo",   label:"Every 2 months" },
  { id:"every3mo",   label:"Every 3 months" },
  { id:"every6mo",   label:"Every 6 months" },
  { id:"yearly",     label:"Once a year" },
]

// Built-in reminder templates — shown as quick-add suggestions
var BUILTIN_REMINDERS = [
  { id:"trash",       emoji:"🗑️",  label:"Trash",               type:"weekly_day",   defaultFreq:"weekly",   hint:"Which day is trash pickup?" },
  { id:"recycling",   emoji:"♻️",  label:"Recycling",            type:"weekly_day",   defaultFreq:"biweekly", hint:"Which day is recycling pickup?" },
  { id:"yard_waste",  emoji:"🌿",  label:"Yard Waste Pickup",    type:"weekly_day",   defaultFreq:"weekly",   hint:"Pickup day (often seasonal)" },
  { id:"bulk_pickup", emoji:"🛋️",  label:"Bulk / Heavy Trash",   type:"weekly_day",   defaultFreq:"monthly",  hint:"Large item pickup day" },
  { id:"street_sweep",emoji:"🚗",  label:"Street Sweeping",      type:"weekly_day",   defaultFreq:"weekly",   hint:"Move your car — ticketing day" },
  { id:"hvac_filter", emoji:"💨",  label:"HVAC Filter Change",   type:"interval",     defaultFreq:"every3mo", hint:"Every 1–3 months depending on filter type" },
  { id:"water_filter",emoji:"💧",  label:"Water Filter",         type:"interval",     defaultFreq:"every3mo", hint:"Fridge, under-sink, or pitcher" },
  { id:"smoke_detect",emoji:"🔋",  label:"Smoke Detector Batteries", type:"interval", defaultFreq:"every6mo", hint:"Test & replace batteries twice a year" },
  { id:"gutters",     emoji:"🏠",  label:"Gutter Cleaning",      type:"interval",     defaultFreq:"every6mo", hint:"Spring and fall" },
  { id:"septic",      emoji:"🔩",  label:"Septic Tank Service",  type:"interval",     defaultFreq:"yearly",   hint:"Every 3–5 years — set to yearly and note it" },
  { id:"watering",    emoji:"🌱",  label:"Yard Watering",        type:"weekly_days",  defaultFreq:"weekly",   hint:"Pick the days you water — Mon, Wed, Sat, etc." },
]

function recurLoad() {
  try { var s = localStorage.getItem("af_recurring"); if(!s) return []; var _r=JSON.parse(s); return Array.isArray(_r)?_r:[]; } catch { return [] }
}
function recurSave(v) {
  try { localStorage.setItem("af_recurring", JSON.stringify(v)); afVaultChanged("recurring"); } catch {}
}
function recurId() { return "r" + Math.random().toString(36).slice(2,9) }

// Returns next Date for a weekly-day reminder
function nextWeeklyDay(dayOfWeek, freq, lastDone) {
  if (dayOfWeek == null) return null
  var now = new Date(); now.setHours(0,0,0,0)
  var diff = (dayOfWeek - now.getDay() + 7) % 7
  var d = new Date(now); d.setDate(d.getDate() + diff)
  if (freq === "biweekly" && lastDone) {
    var lp = new Date(lastDone); lp.setHours(0,0,0,0)
    var weeksSince = Math.round((d - lp) / (7 * 86400000))
    if (weeksSince % 2 !== 0) d.setDate(d.getDate() + 7)
  }
  if (freq === "monthly") {
    var first = new Date(now.getFullYear(), now.getMonth(), 1)
    d = new Date(first); d.setDate(1 + (dayOfWeek - first.getDay() + 7) % 7)
    if (d < now) { d.setMonth(d.getMonth()+1); d.setDate(1); var b=new Date(d); d.setDate(1+(dayOfWeek-b.getDay()+7)%7) }
  }
  return d
}

var FREQ_DAYS = { weekly:7, biweekly:14, every6wk:42, every2mo:61, every3mo:91, every6mo:182, yearly:365, monthly:30 }

// Returns next Date for an interval reminder (based on lastDone)
function nextInterval(freq, lastDone) {
  var days = FREQ_DAYS[freq] || 90
  if (lastDone) {
    var last = new Date(lastDone); last.setHours(0,0,0,0)
    var next = new Date(last); next.setDate(next.getDate() + days)
    return next
  }
  // No lastDone — due now/soon
  var now = new Date(); now.setHours(0,0,0,0)
  return now
}

function nextWeeklyDays(days, freq, lastDone) {
  if (!days || !days.length) return null
  var now = new Date(); now.setHours(0,0,0,0)
  var earliest = null
  days.forEach(function(d) {
    var candidate = nextWeeklyDay(d, freq, lastDone)
    if (!earliest || candidate < earliest) earliest = candidate
  })
  return earliest
}

function daysUntilReminder(r) {
  var now = new Date(); now.setHours(0,0,0,0)
  var next
  if (r.type === "weekly_days") {
    next = nextWeeklyDays(r.days, r.freq, r.lastDone)
  } else if (r.type === "weekly_day") {
    next = nextWeeklyDay(r.day, r.freq, r.lastDone)
  } else {
    next = nextInterval(r.freq, r.lastDone)
  }
  if (!next) return null
  return Math.round((next - now) / 86400000)
}

function nextDateLabel(days) {
  if (days == null) return null
  if (days < 0) return "Overdue"
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  if (days <= 6) return "in " + days + "d"
  if (days <= 13) return "next week"
  if (days <= 30) return "in ~" + Math.round(days/7) + " wk"
  if (days <= 60) return "in ~" + Math.round(days/30) + " mo"
  return "in " + Math.round(days/30) + " months"
}

// ── Recurring Reminders Section ───────────────────────────────────────────────
function RecurringRemindersSection() {
  var NAVY="#243A5A"; var GOLD="#c8a97a"; var FAINT="rgba(250,248,244,0.35)"; var SOFT="rgba(250,248,244,0.65)"

  var [reminders, setReminders] = useState(function() {
    // Migrate old af_trash data if present
    var existing = recurLoad()
    if (existing.length) return existing
    try {
      var old = JSON.parse(localStorage.getItem("af_trash") || "null")
      if (old) {
        var migrated = []
        if (old.trash && old.trash.day != null) migrated.push({ id:recurId(), builtinId:"trash", emoji:"🗑️", label:"Trash", type:"weekly_day", day:old.trash.day, freq:old.trash.freq||"weekly", lastDone:null, remindEvening:old.remindEvening!==false, remindMorning:old.remindMorning!==false, active:true })
        if (old.recycling && old.recycling.day != null) migrated.push({ id:recurId(), builtinId:"recycling", emoji:"♻️", label:"Recycling", type:"weekly_day", day:old.recycling.day, freq:old.recycling.freq||"biweekly", lastDone:null, remindEvening:old.remindEvening!==false, remindMorning:old.remindMorning!==false, active:true })
        if (migrated.length) { recurSave(migrated); return migrated }
      }
    } catch {}
    return []
  })

  React.useEffect(function() {
    function onRefresh(e) {
      if (!e.detail?.key || e.detail.key === "recurring") {
        try { var _r = recurLoad(); setReminders(Array.isArray(_r) ? _r : []) } catch {}
      }
    }
    window.addEventListener("af-data-changed", onRefresh)
    return function() { window.removeEventListener("af-data-changed", onRefresh) }
  }, [])
  var [editing, setEditing] = useState(null) // null | "new" | reminder id
  var [draft, setDraft] = useState(null)
  var [showBuiltins, setShowBuiltins] = useState(false)
  var [saved, setSaved] = useState(false)

  function save(list) { setReminders(list); recurSave(list) }

  function openNew(template) {
    var base = template ? {
      id: recurId(), builtinId: template.id, emoji: template.emoji, label: template.label,
      type: template.type, freq: template.defaultFreq, day: null, days: [], lastDone: null,
      remindEvening: true, remindMorning: true, active: true, custom: false
    } : {
      id: recurId(), builtinId: null, emoji: "⏰", label: "", type: "interval",
      freq: "monthly", day: null, days: [], lastDone: null, remindEvening: true, remindMorning: false,
      active: true, custom: true
    }
    setDraft(base); setEditing("new"); setShowBuiltins(false)
  }

  function openEdit(r) { setDraft(JSON.parse(JSON.stringify(r))); setEditing(r.id) }

  function saveDraft() {
    if (!draft.label.trim()) return
    var updated = editing === "new"
      ? [...reminders, draft]
      : reminders.map(function(r) { return r.id === editing ? draft : r })
    save(updated); setEditing(null); setDraft(null)
    setSaved(true); setTimeout(function(){setSaved(false)}, 2000)
  }

  function deleteDraft() {
    save(reminders.filter(function(r){return r.id !== editing}))
    setEditing(null); setDraft(null)
  }

  function markDone(id) {
    var today = new Date().toISOString().split("T")[0]
    save(reminders.map(function(r){ return r.id===id ? {...r, lastDone:today} : r }))
  }

  var activeReminders = reminders.filter(function(r){return r.active!==false})
  var sorted = activeReminders.slice().sort(function(a,b){
    var da = daysUntilReminder(a); var db = daysUntilReminder(b)
    if (da==null) return 1; if (db==null) return -1; return da-db
  })

  var existingBuiltinIds = reminders.map(function(r){return r.builtinId}).filter(Boolean)
  var availableBuiltins = BUILTIN_REMINDERS.filter(function(b){return !existingBuiltinIds.includes(b.id)})

  var S = {
    card: { background:"rgba(250,242,229,0.03)", border:"1px solid rgba(200,169,122,0.18)", borderRadius:12, padding:"14px 16px", marginBottom:8 },
    lbl: { fontSize:11, fontWeight:700, color:"rgba(200,169,122,0.65)", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:6, display:"block", fontFamily:"DM Sans,sans-serif" },
    inp: { width:"100%", background:"rgba(250,242,229,0.06)", border:"1px solid rgba(250,242,229,0.12)", borderRadius:8, padding:"8px 10px", fontSize:13, color:"rgba(250,248,244,0.9)", fontFamily:"DM Sans,sans-serif", marginBottom:12, boxSizing:"border-box" },
    sel: { width:"100%", background:"rgba(250,242,229,0.06)", border:"1px solid rgba(250,242,229,0.12)", borderRadius:8, padding:"8px 10px", fontSize:13, color:"rgba(250,248,244,0.85)", fontFamily:"DM Sans,sans-serif", cursor:"pointer", marginBottom:12, boxSizing:"border-box" },
    toggle: function(on){ return { width:36, height:20, borderRadius:10, background:on?"#7a9e8e":"rgba(250,242,229,0.1)", border:"none", position:"relative", cursor:"pointer", flexShrink:0, transition:"background 0.2s" } },
    thumb: function(on){ return { position:"absolute", top:2, left:on?18:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" } },
    trow: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:"0.5px solid rgba(250,242,229,0.06)" },
  }

  // ── Edit / New form ──────────────────────────────────────────────────────────
  if (editing && draft) {
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <button onClick={function(){setEditing(null);setDraft(null)}} style={{background:"none",border:"none",color:GOLD,fontSize:20,cursor:"pointer",padding:0}}>←</button>
          <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:20,fontWeight:700,color:"#faf8f4"}}>
            {editing==="new"?"Add Reminder":"Edit Reminder"}
          </div>
        </div>

        <div style={S.card}>
          {/* Emoji + Label */}
          <div style={{display:"grid",gridTemplateColumns:"60px 1fr",gap:10,marginBottom:2}}>
            <div>
              <label style={S.lbl}>Icon</label>
              <input value={draft.emoji} onChange={function(e){setDraft(function(p){return {...p,emoji:e.target.value}})}} style={{...S.inp,textAlign:"center",fontSize:18,padding:"6px"}} maxLength={2}/>
            </div>
            <div>
              <label style={S.lbl}>Name</label>
              <input value={draft.label} onChange={function(e){setDraft(function(p){return {...p,label:e.target.value}})}} placeholder="e.g. Trash, HVAC Filter..." style={S.inp} autoFocus/>
            </div>
          </div>

          {/* Type toggle */}
          <label style={S.lbl}>Reminder type</label>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            {[{id:"weekly_day",label:"📅 One day"},{id:"weekly_days",label:"📅 Multiple days"},{id:"interval",label:"⏱ After X days"}].map(function(t){
              return <button key={t.id} onClick={function(){setDraft(function(p){return {...p,type:t.id,day:null,days:[]}})}} style={{flex:1,minWidth:"30%",background:draft.type===t.id?"rgba(200,169,122,0.2)":"rgba(250,242,229,0.04)",border:"1px solid "+(draft.type===t.id?"rgba(200,169,122,0.5)":"rgba(250,242,229,0.1)"),borderRadius:8,padding:"7px 4px",fontSize:11,color:draft.type===t.id?GOLD:SOFT,fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:draft.type===t.id?700:400}}>{t.label}</button>
            })}
          </div>

          {/* Single day selector */}
          {draft.type==="weekly_day"&&(
            <>
              <label style={S.lbl}>Pickup / service day</label>
              <select value={draft.day!=null?draft.day:""} onChange={function(e){setDraft(function(p){return {...p,day:e.target.value!==""?parseInt(e.target.value):null}})}} style={S.sel}>
                <option value="">Not set</option>
                {DAY_LABELS.map(function(d,i){return <option key={i} value={i}>{d}</option>})}
              </select>
            </>
          )}

          {/* Multi-day checkboxes (weekly_days) */}
          {draft.type==="weekly_days"&&(
            <>
              <label style={S.lbl}>Watering days (pick all that apply)</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                {DAY_LABELS.map(function(d,i){
                  var selected=(draft.days||[]).includes(i)
                  return <button key={i} onClick={function(){
                    var cur=draft.days||[]
                    setDraft(function(p){return {...p,days:selected?cur.filter(function(x){return x!==i}):[...cur,i].sort()}})
                  }} style={{background:selected?"rgba(107,163,196,0.25)":"rgba(250,242,229,0.04)",border:"1px solid "+(selected?"rgba(107,163,196,0.6)":"rgba(250,242,229,0.12)"),borderRadius:20,padding:"5px 11px",fontSize:12,color:selected?"#a8d4ea":SOFT,fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:selected?700:400}}>{d.slice(0,3)}</button>
                })}
              </div>
            </>
          )}

          {/* Frequency */}
          <label style={S.lbl}>Frequency</label>
          <select value={draft.freq} onChange={function(e){setDraft(function(p){return {...p,freq:e.target.value}})}} style={S.sel}>
            {FREQ_OPTIONS.filter(function(f){
              if(draft.type==="weekly_day"||draft.type==="weekly_days") return ["weekly","biweekly","monthly"].includes(f.id)
              return true
            }).map(function(f){return <option key={f.id} value={f.id}>{f.label}</option>})}
          </select>

          {/* Last done (interval only) */}
          {draft.type==="interval"&&(
            <>
              <label style={S.lbl}>Last completed (optional)</label>
              <input type="date" value={draft.lastDone||""} onChange={function(e){setDraft(function(p){return {...p,lastDone:e.target.value||null}})}} style={S.inp}/>
            </>
          )}
        </div>

        {/* Reminder toggles */}
        <div style={S.card}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(200,169,122,0.65)",textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:10,fontFamily:"DM Sans,sans-serif"}}>🔔 Reminders</div>
          <div style={S.trow}>
            <div>
              <div style={{fontSize:13,fontFamily:"DM Sans,sans-serif",fontWeight:600,color:"rgba(250,248,244,0.85)"}}>Evening before</div>
              <div style={{fontSize:11,color:FAINT,fontFamily:"DM Sans,sans-serif"}}>Night before it's due</div>
            </div>
            <button onClick={function(){setDraft(function(p){return {...p,remindEvening:!p.remindEvening}})}} style={S.toggle(draft.remindEvening)}>
              <div style={S.thumb(draft.remindEvening)}/>
            </button>
          </div>
          <div style={{...S.trow,borderBottom:"none"}}>
            <div>
              <div style={{fontSize:13,fontFamily:"DM Sans,sans-serif",fontWeight:600,color:"rgba(250,248,244,0.85)"}}>Morning of</div>
              <div style={{fontSize:11,color:FAINT,fontFamily:"DM Sans,sans-serif"}}>Day it's due</div>
            </div>
            <button onClick={function(){setDraft(function(p){return {...p,remindMorning:!p.remindMorning}})}} style={S.toggle(draft.remindMorning)}>
              <div style={S.thumb(draft.remindMorning)}/>
            </button>
          </div>
        </div>

        <div style={{display:"flex",gap:10,marginTop:4}}>
          {editing!=="new"&&<button onClick={deleteDraft} style={{background:"rgba(220,80,80,0.1)",border:"1px solid rgba(220,80,80,0.25)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#e07070",fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:600}}>Delete</button>}
          <button onClick={function(){setEditing(null);setDraft(null)}} style={{flex:1,background:"rgba(250,242,229,0.06)",border:"1px solid rgba(250,242,229,0.12)",borderRadius:10,padding:"10px",fontSize:13,color:SOFT,fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:600}}>Cancel</button>
          <button onClick={saveDraft} disabled={!draft.label.trim()} style={{flex:2,background:GOLD,border:"none",borderRadius:10,padding:"10px",fontSize:13,color:NAVY,fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:700,opacity:draft.label.trim()?1:0.5}}>Save</button>
        </div>
      </div>
    )
  }

  // ── Main list view ───────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>🔁</span>
          <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:22,fontWeight:700,color:"#faf8f4"}}>Recurring Reminders</div>
        </div>
        <button onClick={function(){openNew(null)}} style={{background:"rgba(200,169,122,0.12)",border:"1px solid rgba(200,169,122,0.3)",borderRadius:8,padding:"6px 12px",fontSize:12,color:GOLD,fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:600}}>+ Custom</button>
      </div>
      <div style={{fontSize:12,color:FAINT,fontFamily:"DM Sans,sans-serif",marginBottom:16,lineHeight:1.5}}>Set it once, never forget it again.</div>

      {/* Built-in quick-adds */}
      {availableBuiltins.length>0&&(
        <div style={{marginBottom:14}}>
          <button onClick={function(){setShowBuiltins(function(p){return !p})}} style={{background:"rgba(250,242,229,0.04)",border:"1px solid rgba(250,242,229,0.1)",borderRadius:8,padding:"7px 14px",fontSize:12,color:SOFT,fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:600,width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>➕ Add from common reminders</span>
            <span style={{opacity:0.5,fontSize:10}}>{showBuiltins?"▲":"▼"}</span>
          </button>
          {showBuiltins&&(
            <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
              {availableBuiltins.map(function(b){
                return(
                  <button key={b.id} onClick={function(){openNew(b)}} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(250,242,229,0.03)",border:"1px solid rgba(250,242,229,0.08)",borderRadius:10,padding:"10px 14px",cursor:"pointer",textAlign:"left"}}>
                    <span style={{fontSize:20,flexShrink:0}}>{b.emoji}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:"rgba(250,248,244,0.9)",fontFamily:"DM Sans,sans-serif"}}>{b.label}</div>
                      <div style={{fontSize:11,color:FAINT,fontFamily:"DM Sans,sans-serif",marginTop:1}}>{b.hint}</div>
                    </div>
                    <span style={{fontSize:11,color:GOLD,fontFamily:"DM Sans,sans-serif",fontWeight:600,flexShrink:0}}>Add →</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {sorted.length===0&&(
        <div style={{textAlign:"center",padding:"32px 20px",background:"rgba(250,242,229,0.02)",border:"1px dashed rgba(200,169,122,0.2)",borderRadius:14}}>
          <div style={{fontSize:32,marginBottom:10}}>🔁</div>
          <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:18,color:"#faf8f4",marginBottom:6}}>No reminders yet</div>
          <div style={{fontSize:12,color:FAINT,fontFamily:"DM Sans,sans-serif",marginBottom:18,lineHeight:1.6}}>Add trash day, HVAC filters, street sweeping — anything that repeats.</div>
          <button onClick={function(){setShowBuiltins(true);setTimeout(function(){document.querySelector("[data-builtin-list]")&&document.querySelector("[data-builtin-list]").scrollIntoView({behavior:"smooth"})},50)}} style={{background:GOLD,border:"none",borderRadius:10,padding:"10px 24px",fontSize:13,color:NAVY,fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:700}}>Add from common reminders</button>
        </div>
      )}

      {/* Reminder rows */}
      {sorted.map(function(r){
        var days = daysUntilReminder(r)
        var badge = nextDateLabel(days)
        var alert = days!=null&&days<=1
        var overdue = days!=null&&days<0
        return(
          <div key={r.id} style={{background:alert?"rgba(200,131,74,0.07)":"rgba(250,242,229,0.03)",border:"1px solid "+(overdue?"rgba(220,80,80,0.35)":alert?"rgba(200,131,74,0.35)":"rgba(200,169,122,0.15)"),borderRadius:12,padding:"13px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:22,flexShrink:0}}>{r.emoji}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:"rgba(250,248,244,0.92)",fontFamily:"DM Sans,sans-serif"}}>{r.label}</div>
              <div style={{fontSize:11,color:FAINT,fontFamily:"DM Sans,sans-serif",marginTop:1}}>
                {r.type==="weekly_days"&&r.days&&r.days.length>0?r.days.map(function(d){return DAY_LABELS[d].slice(0,3)}).join(", "):r.type==="weekly_day"&&r.day!=null?DAY_LABELS[r.day]+"s":""}{" "}
                {FREQ_OPTIONS.find(function(f){return f.id===r.freq})?FREQ_OPTIONS.find(function(f){return f.id===r.freq}).label:""}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              {badge&&<span style={{fontSize:11,fontWeight:700,color:overdue?"#e07070":alert?"#c8834a":GOLD}}>{badge}</span>}
              <button onClick={function(){markDone(r.id)}} title="Mark done / reset timer" style={{background:"rgba(122,158,142,0.15)",border:"1px solid rgba(122,158,142,0.3)",borderRadius:6,padding:"4px 8px",fontSize:11,color:"#7a9e8e",fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:600}}>✓ Done</button>
              <button onClick={function(){openEdit(r)}} style={{background:"rgba(250,242,229,0.06)",border:"1px solid rgba(250,242,229,0.1)",borderRadius:6,padding:"4px 8px",fontSize:11,color:SOFT,fontFamily:"DM Sans,sans-serif",cursor:"pointer"}}>Edit</button>
            </div>
          </div>
        )
      })}

      {saved&&<div style={{marginTop:10,textAlign:"center",fontSize:12,color:"#7a9e8e",fontFamily:"DM Sans,sans-serif",fontWeight:600}}>✓ Saved</div>}
    </div>
  )
}


function AnchorDashboard({ onNavigate, calEvents }) {
  calEvents = calEvents || []

  // ── Live data readers ──────────────────────────────────────────────────────
  function readCelebrations() {
    try {
      const rawSaved = JSON.parse(localStorage.getItem("af_celebrations") || "[]")
      const saved = Array.isArray(rawSaved) ? rawSaved : []
      const rawBdays2 = JSON.parse(localStorage.getItem("af_birthdays") || "[]")
      const bdays = Array.isArray(rawBdays2) ? rawBdays2 : []
      const migrated = bdays.filter(function(b) {
        return !saved.find(function(c) { return c.name === b.name && c.type === "birthday" })
      }).map(function(b) {
        return { id: b.id, type: "birthday", name: b.name, month: b.month, day: b.day, year: b.year || null, notes: "" }
      })
      var combined = [...saved, ...migrated]
      // Deduplicate by name+month+day (keep first occurrence)
      var seen = {}
      return combined.filter(function(c) {
        var key = (c.name||"").toLowerCase().trim() + "_" + c.month + "_" + c.day
        if (seen[key]) return false
        seen[key] = true
        return true
      })
    } catch { return [] }
  }

  function readPets() { try { var _rp=JSON.parse(localStorage.getItem("af_pets") || "[]"); return Array.isArray(_rp)?_rp:[]; } catch { return [] } }
  function readGifts() { try { var _rg=JSON.parse(localStorage.getItem("af_gifts") || "[]"); return Array.isArray(_rg)?_rg:[]; } catch { return [] } }
  function readMoments() { try { var _rm=JSON.parse(localStorage.getItem("af_moments") || "[]"); return Array.isArray(_rm)?_rm:[]; } catch { return [] } }
  function readHealth() { try { var s = localStorage.getItem("af_health"); return s ? JSON.parse(s) : {} } catch { return {} } }
  function readInventory() { try { return JSON.parse(localStorage.getItem("af_inventory") || "null") } catch { return null } }

  function daysUntil(month, day) {
    var now = new Date(); now.setHours(0,0,0,0)
    var next = new Date(now.getFullYear(), month - 1, day)
    if (next < now) next.setFullYear(next.getFullYear() + 1)
    return Math.round((next - now) / 86400000)
  }

  function daysUntilDate(dateStr) {
    if (!dateStr) return null
    var now = new Date(); now.setHours(0,0,0,0)
    var parts = dateStr.split("-")
    if (parts.length === 3 && parts[0].length === 4) {
      // Full YYYY-MM-DD: respect the actual year, no wrap
      var target = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]))
      return Math.round((target - now) / 86400000)
    }
    // Fallback for partial dates: wrap annually
    var target = new Date(now.getFullYear(), parseInt(parts[parts.length-2])-1, parseInt(parts[parts.length-1]))
    if (target < now) target.setFullYear(target.getFullYear()+1)
    return Math.round((target - now) / 86400000)
  }

  var MNAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

  // ── Summary builders ───────────────────────────────────────────────────────
  function celebSummary() {
    var list = readCelebrations()
    if (!list.length) return { highlight: null, countdown: null, count: 0 }
    var now = new Date(); now.setHours(0,0,0,0)
    // af_gifts (Phase 3): person-keyed map, not celebration-keyed — a gift
    // belongs to a celebration via assignedCelebId, or implicitly via the
    // celebration's own personId if unassigned. Private gifts never surface
    // in this dashboard glance, regardless of who's viewing.
    var giftsByPerson = {}
    try {
      var rawGifts = JSON.parse(localStorage.getItem("af_gifts") || "null")
      if (rawGifts && typeof rawGifts === "object" && !Array.isArray(rawGifts)) giftsByPerson = rawGifts
    } catch {}
    function giftsForCeleb(c) {
      var result = []
      Object.keys(giftsByPerson).forEach(function(pid) {
        if (pid === "holiday_lists") return // stray pre-migration key, defensive
        // af_gifts[personId] is an array of named lists (Birthday/Christmas/
        // Easter/custom), each holding its own gifts — one level deeper than
        // the flat per-person array this originally read.
        (giftsByPerson[pid] || []).forEach(function(gList) {
          (gList.gifts || []).forEach(function(g) {
            if (g.private) return
            if (g.assignedCelebId === c.id) result.push(g)
            else if (!g.assignedCelebId && c.personId && pid === c.personId) result.push(g)
          })
        })
      })
      return result
    }
    var entries = list.map(function(c) {
      var next = new Date(now.getFullYear(), c.month-1, c.day)
      if (next < now) next.setFullYear(next.getFullYear()+1)
      var diff = Math.round((next - now) / 86400000)
      var age = (c.type === "birthday" && c.year) ? (next.getFullYear() - c.year) : null
      var cGifts = giftsForCeleb(c)
      var unbought = cGifts.filter(function(g) { return !g.purchased }).length
      return { ...c, diff, age, giftCount: cGifts.length, unbought }
    }).sort(function(a,b) { return a.diff - b.diff })
    var next = entries[0]
    var label = next.name + (next.age ? " turns " + next.age : next.type === "anniversary" ? " anniversary" : "")
    var countdown = next.diff === 0 ? "Today! 🎉" : next.diff === 1 ? "Tomorrow" : "in " + next.diff + " days"
    var hasUnbought = entries.some(function(e) { return e.diff <= 30 && e.unbought > 0 })
    return { highlight: label, countdown: countdown, count: list.length, soon: next.diff <= 14, alert: hasUnbought, entries: entries.slice(0, 4) }
  }

  function petsSummary() {
    var pets = readPets()
    if (!pets.length) return { highlight: null, countdown: null, count: 0 }
    var nextVax = null; var nextVaxPet = null; var nextVaxDays = 9999
    pets.forEach(function(p) {
      (p.vaccines || []).forEach(function(v) {
        if (v.due) {
          var d = daysUntilDate(v.due)
          if (d !== null && d >= 0 && d < nextVaxDays) { nextVaxDays = d; nextVax = v; nextVaxPet = p.name }
        }
      })
    })
    var highlight = pets.map(function(p) { return p.name }).join(", ")
    var countdown = nextVax ? (nextVaxPet + " · " + nextVax.name + " due " + (nextVaxDays === 0 ? "today" : "in " + nextVaxDays + "d")) : "All up to date ✓"
    return { highlight: highlight, countdown: countdown, count: pets.length, entries: pets.slice(0,3) }
  }

  function giftsSummary() {
    var gifts = readGifts()
    var upcoming = []
    gifts.forEach(function(person) {
      (person.occasions || []).forEach(function(occ) {
        if (occ.date) {
          var parts = occ.date.split("-")
          var now = new Date(); now.setHours(0,0,0,0)
          var target = new Date(now.getFullYear(), parseInt(parts[1])-1, parseInt(parts[2]))
          if (target < now) target.setFullYear(target.getFullYear()+1)
          var days = Math.round((target - now) / 86400000)
          var unbought = (occ.gifts || []).filter(function(g) { return !g.bought }).length
          upcoming.push({ name: person.name, type: occ.type, days: days, unbought: unbought })
        }
      })
    })
    upcoming.sort(function(a,b) { return a.days - b.days })
    var soon = upcoming.filter(function(u) { return u.days <= 30 })
    if (!upcoming.length) return { highlight: null, countdown: null, count: 0 }
    var next = upcoming[0]
    return {
      highlight: next.name + " — " + next.type,
      countdown: next.days === 0 ? "Today! 🎁" : next.days === 1 ? "Tomorrow" : "in " + next.days + " days",
      count: upcoming.length,
      alert: soon.some(function(u) { return u.unbought > 0 }),
      entries: upcoming.slice(0,3)
    }
  }

  function momentsSummary() {
    var moments = readMoments()
    if (!moments.length) return { highlight: null, countdown: null, count: 0 }
    var now = new Date(); now.setHours(0,0,0,0)
    var upcoming = moments.filter(function(m) { return !m.date || new Date(m.date+"T00:00:00") >= now })
      .sort(function(a,b) {
        if (!a.date) return 1; if (!b.date) return -1
        return new Date(a.date+"T00:00:00") - new Date(b.date+"T00:00:00")
      })
    var next = upcoming[0]
    if (!next) return { highlight: moments[moments.length-1].name, countdown: "Past trip", count: moments.length }
    var days = next.date ? Math.round((new Date(next.date+"T00:00:00") - now) / 86400000) : null
    return {
      highlight: next.name,
      countdown: days === null ? "No date set" : days === 0 ? "Today! ✈️" : days === 1 ? "Tomorrow!" : "in " + days + " days",
      count: moments.length,
      entries: upcoming.slice(0,3)
    }
  }

  function travelSummary() {
    try {
      var tp = JSON.parse(localStorage.getItem("af_travel_profile") || "{}")
      var now = new Date(); now.setHours(0,0,0,0)
      var expDates = [
        { label: "Passport", key: tp.passportExp },
        { label: "Passport 2", key: tp.passport2Exp },
        { label: "TSA PreCheck", key: tp.tsaExp },
        { label: "Global Entry", key: tp.geExp },
        { label: "NEXUS", key: tp.nexusExp },
        { label: "SENTRI", key: tp.sentriExp },
      ].filter(function(x){ return x.key })
      var soonest = null; var soonestDays = 9999; var alert = false
      expDates.forEach(function(x) {
        var parts = x.key.split("-")
        if (parts.length === 3) {
          var d = Math.round((new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2])) - now) / 86400000)
          if (d < soonestDays) { soonestDays = d; soonest = x.label }
          if (d <= 180) alert = true
        }
      })
      var ffCount = (tp.ffPrograms||[]).length + (tp.hotelPrograms||[]).length
      var highlight = ffCount > 0 ? ffCount + " loyalty program" + (ffCount!==1?"s":"") : (tp.passportExp ? "Passport on file" : null)
      var countdown = soonest ? (soonestDays < 0 ? soonest+" expired" : soonest+" expires in "+soonestDays+"d") : (tp.passportExp ? "All docs current ✓" : null)
      return { highlight: highlight, countdown: countdown, count: ffCount, alert: alert }
    } catch { return { highlight: null, countdown: null, count: 0 } }
  }

  function healthSummary() {
    var h = readHealth()
    // Health is stored as health[personId] = { appointments:[], medications:[], ... }
    // Load people to resolve names
    var people = hLoadPeople()
    var now = new Date(); now.setHours(0,0,0,0)
    var upcoming = []
    var totalMeds = 0
    var trackedPeople = []
    people.forEach(function(person) {
      var pd = h[person.id] || {}
      var appts = pd.appointments || pd.history || []
      var meds = pd.medications || pd.meds || []
      totalMeds += meds.length
      var hasData = appts.length || meds.length || (pd.allergies||[]).length || (pd.immunizations||[]).length
      if (hasData) trackedPeople.push(person.name)
      appts.forEach(function(a) {
        var dateStr = a.date || a.next || ""
        if (dateStr) {
          var d = new Date(dateStr.includes("T") ? dateStr : dateStr+"T00:00:00")
          var days = Math.round((d - now) / 86400000)
          if (days >= 0) upcoming.push({ name: person.name, type: a.type||a.title||"Appointment", days: days })
        }
      })
    })
    upcoming.sort(function(a,b) { return a.days - b.days })
    if (!trackedPeople.length && !upcoming.length && !totalMeds) return { highlight: null, countdown: null, count: 0 }
    var count = trackedPeople.length || people.length
    return {
      highlight: trackedPeople.length ? trackedPeople.join(", ") : people.map(function(p){return p.name}).join(", "),
      countdown: upcoming.length
        ? upcoming[0].name + " · " + upcoming[0].type + " in " + upcoming[0].days + "d"
        : totalMeds ? totalMeds + " active med" + (totalMeds !== 1 ? "s" : "") : "No upcoming appointments",
      count: count,
      entries: upcoming.slice(0,3).map(function(e){
        return { label: e.name + " · " + e.type, badge: e.days === 0 ? "Today" : "in " + e.days + "d", badgeAlert: e.days <= 3 }
      })
    }
  }

  function inventorySummary() {
    var inv = readInventory()
    if (!inv) return { highlight: null, countdown: null, count: 0 }
    var allItems = []; var lowItems = []
    Object.values(inv).forEach(function(cat) {
      if (Array.isArray(cat)) {
        cat.forEach(function(item) {
          allItems.push(item)
          if (!item.stocked) lowItems.push(item)
        })
      }
    })
    return {
      highlight: allItems.length + " items tracked",
      countdown: lowItems.length ? lowItems.length + " running low" : "All stocked ✓",
      count: allItems.length,
      alert: lowItems.length > 0,
      entries: lowItems.slice(0,3).map(function(i) { return { name: i.name } })
    }
  }

  function recurringDashSummary() {
    var list = recurLoad()
    if (!list || !list.length) return { highlight:null, countdown:null, count:0 }
    var active = list.filter(function(r){return r.active!==false})
    if (!active.length) return { highlight:null, countdown:null, count:0 }
    var withDays = active.map(function(r){ return {...r, days:daysUntilReminder(r)} }).sort(function(a,b){
      if(a.days==null) return 1; if(b.days==null) return -1; return a.days-b.days
    })
    var soon = withDays.filter(function(r){return r.days!=null&&r.days<=1})
    var soonest = withDays[0]
    var soonestBadge = soonest&&soonest.days!=null ? nextDateLabel(soonest.days) : null
    var entries = withDays.slice(0,4).map(function(r){
      return { label:r.emoji+" "+r.label, badge:nextDateLabel(r.days), badgeAlert:r.days!=null&&r.days<=1 }
    })
    return {
      highlight: withDays.map(function(r){return r.emoji+" "+r.label}).slice(0,3).join(" · "),
      countdown: soonest ? soonest.emoji+" "+soonest.label+" — "+(soonestBadge||"") : null,
      count: active.length,
      alert: soon.length>0,
      entries: entries
    }
  }

  function safeHarborSummary() {
    try {
      var sh = JSON.parse(localStorage.getItem("af_safe_harbor") || "null")
      if (!sh) return { highlight: "Emergency plan — not set up yet", countdown: null, count: 0 }
      var itemCount = (sh.grabItems || []).length
      var hazardCount = (sh.hazards || []).length
      var lastReviewed = sh.lastReviewed || null
      var alert = false
      if (lastReviewed) {
        var lastMs = new Date(lastReviewed).getTime()
        if (!isNaN(lastMs) && (Date.now() - lastMs) > 365 * 86400000) alert = true
      } else {
        alert = true
      }
      return {
        highlight: itemCount + " grab items · " + hazardCount + " local plan" + (hazardCount !== 1 ? "s" : ""),
        countdown: lastReviewed ? "Reviewed " + lastReviewed.slice(5).replace("-","/") : "Never reviewed",
        count: itemCount,
        alert: alert,
      }
    } catch(e) { return { highlight: null, countdown: null, count: 0 } }
  }

  function careerSummary() {
    try {
      var c = JSON.parse(localStorage.getItem("af_career") || "{}")
      var people = hLoadPeople()
      var totalJobs = 0; var activeJobs = 0; var totalWins = 0; var recentWin = null
      people.forEach(function(p) {
        var pd = c[p.id] || {}
        var jobs = pd.jobs || []; totalJobs += jobs.length
        activeJobs += jobs.filter(function(j){return j.status!=="Rejected"&&j.status!=="Withdrawn"}).length
        var wins = pd.wins || []; totalWins += wins.length
        if (wins.length && (!recentWin)) recentWin = wins[wins.length-1]
      })
      if (!totalJobs && !totalWins) return { highlight: null, countdown: null, count: 0 }
      return {
        highlight: activeJobs ? activeJobs + " active application" + (activeJobs!==1?"s":"") : recentWin ? "Latest win: "+recentWin.title : null,
        countdown: totalWins ? totalWins + " win" + (totalWins!==1?"s":""+" logged") : null,
        count: totalJobs + totalWins,
        entries: recentWin ? [{ label: "🏆 " + recentWin.title, badge: recentWin.date||null }] : []
      }
    } catch { return { highlight: null, countdown: null, count: 0 } }
  }

  // ── Card component ─────────────────────────────────────────────────────────
  function DashCard({ id, icon, label, summary, onOpen, defaultOpen }) {
    var [open, setOpen] = useState(false)
    var hasAlert = summary.alert
    var borderColor = hasAlert ? "rgba(200,131,74,0.35)" : "rgba(250,242,229,0.1)"
    var bgColor = "rgba(250,242,229,0.04)"

    return (
      <div style={{ background: bgColor, border: "1px solid " + borderColor, borderRadius: 16, marginBottom: 12, breakInside: "avoid", WebkitColumnBreakInside: "avoid", overflow: "hidden", transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}>
        {/* Header — always visible */}
        <div onClick={function() { setOpen(function(p) { return !p }) }} style={{ padding: "13px 16px", cursor: "pointer" }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
            <div style={{ flex: 1, minWidth: 0, fontFamily: "Cormorant Garamond,serif", fontSize: 17, fontWeight: 700, color: "#faf8f4", letterSpacing: "0.01em", lineHeight: 1.15 }}>{label}</div>
            {summary.count > 0 && <div style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: "rgba(200,169,122,0.7)", background: "rgba(200,169,122,0.1)", borderRadius: 20, padding: "1px 7px" }}>{summary.count}</div>}
            <span style={{ fontSize: 11, color: "rgba(250,248,244,0.35)", flexShrink: 0, transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
          </div>
          {/* Summary line(s) — full width, aligned under the title */}
          <div style={{ paddingLeft: 30, marginTop: 4 }}>
            {summary.highlight
              ? <div style={{ fontSize: 12, color: "rgba(250,248,244,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary.highlight}</div>
              : <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 13, color: "rgba(250,248,244,0.4)", fontStyle: "italic" }}>Nothing added yet</div>
            }
            {summary.countdown && summary.count > 0 && (
              <div style={{ fontSize: 11, fontWeight: 700, color: hasAlert ? "#c8834a" : "#c8a97a", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary.countdown}</div>
            )}
          </div>
        </div>

        {/* Expanded content */}
        {open && (
          <div style={{ borderTop: "1px solid rgba(250,242,229,0.07)", padding: "10px 16px 14px" }}>
            {summary.count === 0 ? (
              <div style={{ fontSize: 12, color: "rgba(250,248,244,0.35)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", padding: "4px 0" }}>Nothing here yet — tap Open to add.</div>
            ) : (
              <div style={{ marginBottom: 10 }}>
                {(summary.entries || []).map(function(e, i) {
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: i < (summary.entries.length - 1) ? "1px solid rgba(250,242,229,0.05)" : "none" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#c8a97a", flexShrink: 0, opacity: 0.6 }}/>
                      <span style={{ flex: 1, fontSize: 12, color: "rgba(250,248,244,0.75)", fontFamily: "DM Sans,sans-serif" }}>
                        {e.label || e.name || e.text || "—"}
                        {e.sub && <span style={{ color: "rgba(250,248,244,0.4)", marginLeft: 6 }}>{e.sub}</span>}
                      </span>
                      {e.badge && <span style={{ fontSize: 10, fontWeight: 700, color: e.badgeAlert ? "#c8834a" : "#c8a97a" }}>{e.badge}</span>}
                    </div>
                  )
                })}
              </div>
            )}
            <button onClick={function() { onOpen(id) }} style={{ width: "100%", background: "rgba(200,169,122,0.12)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 8, padding: "8px", fontSize: 12, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>
              Open {label} →
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Build summaries ────────────────────────────────────────────────────────
  var celeb = celebSummary()
  var pets = petsSummary()
  var travelSum = travelSummary()
  var moments = momentsSummary()
  var health = healthSummary()
  var inventory = inventorySummary()
  var careerSum = careerSummary()
  var trashSum = recurringDashSummary()
  var safeHarborSum = safeHarborSummary()

  // Format celebration entries for display — include 🎁 if gifts recorded
  var celebEntries = (celeb.entries || []).map(function(e) {
    var age = (e.type === "birthday" && e.year)
      ? (e.diff >= 0
          ? (new Date().getFullYear() - e.year)          // birthday upcoming this year: turning currentYear - birthYear
          : (new Date().getFullYear() + 1 - e.year))     // birthday already passed: next year's age
      : null
    var giftNote = e.giftCount > 0 ? " 🎁" : ""
    return {
      label: e.name + (age ? " turns " + age : e.type === "anniversary" ? " anniversary" : "") + giftNote,
      badge: e.diff === 0 ? "Today! 🎉" : e.diff === 1 ? "Tomorrow" : "in " + e.diff + "d",
      badgeAlert: e.diff <= 7
    }
  })

  var petEntries = (pets.entries || []).map(function(p) {
    var nextVax = (p.vaccines || []).filter(function(v) { return v.due }).map(function(v) {
      var d = daysUntilDate(v.due); return { name: v.name, days: d }
    }).filter(function(v) { return v.days !== null && v.days >= 0 }).sort(function(a,b) { return a.days - b.days })[0]
    return {
      label: p.name + (p.type ? " · " + p.type : ""),
      badge: nextVax ? nextVax.name + " due in " + nextVax.days + "d" : null,
      badgeAlert: nextVax && nextVax.days <= 14
    }
  })

  var momentEntries = (moments.entries || []).map(function(m) {
    var days = m.date ? Math.round((new Date(m.date+"T00:00:00") - new Date()) / 86400000) : null
    return {
      label: (m.type === "party" ? "🎉" : "✈️") + " " + m.name,
      badge: days === null ? "" : days === 0 ? "Today!" : days === 1 ? "Tomorrow" : "in " + days + "d",
      badgeAlert: days !== null && days <= 3
    }
  })

  var healthEntries = health.entries || [] // entries already formatted in healthSummary()

  var inventoryEntries = (inventory.entries || []).map(function(e) {
    return { label: e.name, badge: "Low", badgeAlert: true }
  })

  var glance = []
  if (celeb.highlight && celeb.countdown) glance.push(celeb.highlight + " " + celeb.countdown)
  if (inventory && inventory.alert && (inventoryEntries||[]).length) glance.push((inventoryEntries.length) + " item" + (inventoryEntries.length>1?"s":"") + " running low")
  if (travelSum && travelSum.alert && travelSum.highlight) glance.push(travelSum.highlight)
  if (momentEntries && momentEntries.length) { var mn = momentEntries[0]; if (mn && mn.badge) glance.push((mn.label||"").replace(/^[^ ]+ /,"") + " " + mn.badge) }
  var glanceText = glance.length ? glance.slice(0,3).join("  ·  ") : "Everything's calm — nothing needs attention right now."

  var MEAL_DAYS_DASH = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  function readMealsDash(){ try { return JSON.parse(localStorage.getItem("af_meals")||"{}")||{} } catch(e){ return {} } }
  var weekMeals = readMealsDash()
  var dinnerRows = MEAL_DAYS_DASH.map(function(d){ var m=weekMeals[d]||{}; return { day:d, dinner:(m.Dinner||m.dinner||m.name||"") } })
  var plannedCount = dinnerRows.filter(function(r){ return r.dinner }).length

  var s_shop = useState(""); var shopVal = s_shop[0]; var setShopVal = s_shop[1]
  var s_shopMsg = useState(""); var shopMsg = s_shopMsg[0]; var setShopMsg = s_shopMsg[1]
  function quickAddShop(){
    var t = (shopVal||"").trim(); if(!t) return
    window.dispatchEvent(new CustomEvent("af-shopping-add",{detail:{text:t,store:"Grocery"}}))
    setShopVal(""); setShopMsg("Added to list: "+t); setTimeout(function(){ setShopMsg(""); }, 2200)
  }

  var leftCards = [
    { id:"gifts", icon:"🎉", label:"Celebrations & Gifts", summary:{ count: celeb.count, highlight: celeb.highlight, countdown: celeb.countdown, alert: celeb.soon || celeb.alert, entries: celebEntries } },
    { id:"recurring", icon:"🔁", label:"Recurring Reminders", summary: trashSum },
    { id:"inventory", icon:"📦", label:"Inventory", summary:{ ...inventory, entries: inventoryEntries } },
    { id:"trips", icon:"🧳", label:"Travel", summary: travelSum },
    { id:"safeharbor", icon:"⚓", label:"Safe Harbor", summary: safeHarborSum }
  ]
  var rightCards = [
    { id:"health", icon:"🩺", label:"Health", summary:{ ...health, entries: healthEntries } },
    { id:"pets", icon:"🐾", label:"Pets", summary:{ ...pets, entries: petEntries } },
    { id:"career", icon:"📋", label:"Career", summary: careerSum }
  ]
  // Cards for empty sections are hidden entirely rather than shown with a
  // "Nothing added yet" placeholder — keeps the dashboard to only what a
  // household has actually started using. A card reappears the moment its
  // section gets its first entry (summary.count flips from 0), so nothing
  // here is ever permanently hidden — it's purely presence-based.
  function renderCard(c){
    if (!c.summary || c.summary.count === 0) return null;
    return <DashCard key={c.id} id={c.id} icon={c.icon} label={c.label} onOpen={onNavigate} summary={c.summary} />;
  }
  // Brand-new household, day one — every card empty. Show one calm message
  // instead of an empty grid, rather than rendering nothing at all.
  var allCardsEmpty = leftCards.concat(rightCards).every(function(c){ return !c.summary || c.summary.count === 0; });

  return (
    <div style={{ paddingBottom: "2rem" }}>
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid rgba(250,242,229,0.1)" }}>
        <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 28, fontWeight: 700, color: "#faf8f4", letterSpacing: "0.02em", lineHeight: 1 }}>Anchor</div>
        <div style={{ fontSize: 13, color: "rgba(200,169,122,0.85)", fontFamily: "DM Sans,sans-serif", marginTop: 6, fontStyle: "italic", lineHeight: 1.5 }}>A place to hold what matters most — your people, your home, your story.</div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", marginBottom: 18, background: "rgba(200,169,122,0.07)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 14 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>👁️</span>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(200,169,122,0.8)", fontWeight: 700, marginBottom: 3 }}>At a glance</div>
          <div style={{ fontSize: 14, color: "rgba(250,248,244,0.9)", fontFamily: "Cormorant Garamond,serif", fontStyle: "italic", lineHeight: 1.45 }}>{glanceText}</div>
        </div>
      </div>

      <div style={{ background: "rgba(250,242,229,0.04)", border: "1px solid rgba(250,242,229,0.1)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 18 }}>🍽️</span>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>This Week's Dinners</div><div style={{ fontSize: 11, color: "rgba(250,248,244,0.45)" }}>{plannedCount} of 7 planned</div></div>
          </div>
          <span onClick={function(){ onNavigate("meals"); }} style={{ fontSize: 11, color: "#c8a97a", cursor: "pointer" }}>Plan →</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 14px" }}>
          {dinnerRows.map(function(r){ return (
            <div key={r.day} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderBottom: "1px solid rgba(250,242,229,0.05)" }}>
              <span style={{ fontSize: 11, color: "rgba(250,248,244,0.5)", flexShrink: 0 }}>{r.day.slice(0,3)}</span>
              <span style={{ fontSize: 12, color: r.dinner ? "rgba(250,248,244,0.85)" : "rgba(250,248,244,0.25)", textAlign: "right", fontStyle: r.dinner?"normal":"italic" }}>{r.dinner || "—"}</span>
            </div>
          ); })}
        </div>
      </div>

      <div style={{ background: "rgba(250,242,229,0.04)", border: "1px solid rgba(250,242,229,0.1)", borderRadius: 16, padding: "14px 16px", marginBottom: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 18 }}>🛒</span>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>Quick Add to Shopping</div>
          </div>
          <span onClick={function(){ onNavigate("shop"); }} style={{ fontSize: 11, color: "#c8a97a", cursor: "pointer" }}>List →</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={shopVal} onChange={function(e){ setShopVal(e.target.value); }} onKeyDown={function(e){ if(e.key==="Enter") quickAddShop(); }} placeholder="Add an item..." style={{ flex: 1, background: "rgba(250,242,229,0.06)", border: "0.5px solid rgba(250,242,229,0.15)", borderRadius: 8, padding: "9px 12px", color: "#faf8f4", fontFamily: "DM Sans,sans-serif", fontSize: 13, outline: "none" }} />
          <button onClick={quickAddShop} style={{ background: "#c8a97a", color: "#2E486B", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans,sans-serif" }}>Add</button>
        </div>
        {shopMsg && <div style={{ fontSize: 11, color: "#9ed4be", marginTop: 7, fontStyle: "italic" }}>{shopMsg}</div>}
      </div>

      {allCardsEmpty ? (
        <div style={{ padding: "24px 16px", textAlign: "center" }}>
          <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 15, color: "rgba(250,248,244,0.4)", fontStyle: "italic", lineHeight: 1.5 }}>
            Add your first thing — celebrations, pets, moments, and more will show up here once you start.
          </div>
        </div>
      ) : (
        <div style={{ columnWidth: 260, columnGap: 12 }}>
          {leftCards.concat(rightCards).map(renderCard)}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

// ── Anchor Settings ───────────────────────────────────────────────────────────
const ANCHOR_SECTIONS = [
  { id: "inventory",  label: "Inventory",     emoji: "📦" },
  { id: "systems",    label: "Maintenance",  emoji: "🏠" },
  { id: "health",     label: "Health",        emoji: "🩺" },
  { id: "career",     label: "Career",        emoji: "📋" },
  { id: "subs",       label: "Subscriptions", emoji: "🔄" },
  { id: "gifts",      label: "Celebrate",     emoji: "🎉" },
  { id: "pets",       label: "Pets",          emoji: "🐾" },
  { id: "trips",      label: "Travel",        emoji: "🧳" },
  { id: "safeharbor", label: "Safe Harbor",   emoji: "⚓" },
]

function AnchorSettings() {
  const [hidden, setHidden] = React.useState(function() {
    try { return JSON.parse(localStorage.getItem("af_anchor_hidden") || "{}") } catch { return {} }
  })

  function toggle(id) {
    const next = { ...hidden, [id]: !hidden[id] }
    setHidden(next)
    try { localStorage.setItem("af_anchor_hidden", JSON.stringify(next)) } catch {}
    window.dispatchEvent(new Event("af-anchor-hidden-changed"))
  }

  const S = {
    label: { fontSize: 13, fontFamily: "DM Sans,sans-serif", fontWeight: 600, color: "rgba(250,248,244,0.85)" },
    sub:   { fontSize: 11, fontFamily: "DM Sans,sans-serif", color: "rgba(250,248,244,0.35)", marginTop: 1 },
    row:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "0.5px solid rgba(250,242,229,0.06)" },
    track: function(on) { return { width: 40, height: 22, borderRadius: 11, background: on ? "#7a9e8e" : "rgba(250,242,229,0.1)", position: "relative", cursor: "pointer", transition: "background 0.2s", border: "none", flexShrink: 0 } },
    thumb: function(on) { return { position: "absolute", top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" } },
  }

  return (
    <div>
      <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: "#faf8f4", marginBottom: 4 }}>Anchor Settings</div>
      <div style={{ fontSize: 12, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", marginBottom: 20, lineHeight: 1.5 }}>Customise which sections appear in your Anchor Vault.</div>

      <div style={{ background: "rgba(250,242,229,0.03)", border: "1px solid rgba(250,242,229,0.07)", borderRadius: 14, padding: "4px 16px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(200,169,122,0.6)", textTransform: "uppercase", letterSpacing: "0.09em", padding: "12px 0 4px", fontFamily: "DM Sans,sans-serif" }}>Visible sections</div>
        {ANCHOR_SECTIONS.map(function(sec) {
          const on = !hidden[sec.id]
          return (
            <div key={sec.id} style={S.row}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{sec.emoji}</span>
                <div>
                  <div style={S.label}>{sec.label}</div>
                </div>
              </div>
              <button onClick={function() { toggle(sec.id) }} style={S.track(on)}>
                <div style={S.thumb(on)} />
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 20, background: "rgba(250,242,229,0.03)", border: "1px solid rgba(250,242,229,0.07)", borderRadius: 14, padding: "16px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(250,248,244,0.55)", fontFamily: "DM Sans,sans-serif", marginBottom: 10 }}>About Anchor Vault</div>
        <p style={{ fontSize: 12, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", lineHeight: 1.65, margin: 0 }}>
          Anchor holds the steady, permanent parts of your home — inventory, health records, career docs, and milestones. Flow handles the daily rhythm. Together they give your home a complete system.
        </p>
      </div>
    </div>
  )
}

// ── Subscriptions Section ─────────────────────────────────────────────────────
function SubscriptionsSection() {
  var GOLD = "#c8a97a"; var NAVY = "#243A5A"; var WHITE = "#faf8f4"
  var SURF = "rgba(250,242,229,0.04)"; var BORD = "0.5px solid rgba(250,242,229,0.08)"
  var SAGE = "#7a9e8e"; var BLUE = "#7EAEB4"
  var CYCLES = ["monthly","yearly","weekly","quarterly"]
  var PERK_TYPES = ["Kids eat free","Military discount","Student discount","Senior discount","AAA discount","Other"]
  function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || "null") || def } catch { return def } }
  function persist(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }
  var [subs, setSubs] = React.useState(function() { return load("af_subs", []) })
  var [coupons, setCoupons] = React.useState(function() { return load("af_coupons", []) })
  var [perks, setPerks] = React.useState(function() { return load("af_perks", []) })
  var [tab, setTab] = React.useState("subs")
  var [azSort, setAzSort] = React.useState(false)
  var [modal, setModal] = React.useState(null)
  var [form, setForm] = React.useState({})
  function saveSubs(v) { setSubs(v); persist("af_subs", v) }
  function saveCoupons(v) { setCoupons(v); persist("af_coupons", v); afVaultChanged("coupons") }
  function savePerks(v) { setPerks(v); persist("af_perks", v); afVaultChanged("perks") }
  function openAdd(type) { setModal(type); setForm({}) }
  function closeModal() { setModal(null); setForm({}) }
  function addSub() {
    if (!form.name) return
    var item = { id: Date.now().toString(), name: form.name, cycle: form.cycle||"monthly", amount: parseFloat(form.amount)||0, website: form.website||"", renewDate: form.renewDate||"" }
    saveSubs([...subs, item]); closeModal()
  }
  function deleteSub(id) { saveSubs(subs.filter(function(s) { return s.id !== id })) }
  function addCoupon() {
    if (!form.name) return
    var item = { id: Date.now().toString(), name: form.name, amount: form.amount||"", expires: form.expires||"", notes: form.notes||"", used: false }
    saveCoupons([...coupons, item]); closeModal()
  }
  function toggleCouponUsed(id) { saveCoupons(coupons.map(function(c) { return c.id===id ? Object.assign({},c,{used:!c.used}) : c })) }
  function deleteCoupon(id) { saveCoupons(coupons.filter(function(c) { return c.id !== id })) }
  function addPerk() {
    if (!form.name) return
    var item = { id: Date.now().toString(), type: form.type||"Other", name: form.name, detail: form.detail||"", notes: form.notes||"" }
    savePerks([...perks, item]); closeModal()
  }
  function deletePerk(id) { savePerks(perks.filter(function(p) { return p.id !== id })) }
  var monthly = subs.reduce(function(acc, s) {
    if (s.cycle==="monthly") return acc+(s.amount||0)
    if (s.cycle==="yearly") return acc+(s.amount||0)/12
    if (s.cycle==="weekly") return acc+(s.amount||0)*4.33
    if (s.cycle==="quarterly") return acc+(s.amount||0)/3
    return acc
  }, 0)
  var inp = { background: "rgba(250,242,229,0.06)", border: BORD, borderRadius: 8, padding: "9px 12px", color: WHITE, fontFamily: "DM Sans,sans-serif", fontSize: 13, width: "100%", outline: "none" }
  var lbl = { fontSize: 11, color: "rgba(250,248,244,0.5)", marginBottom: 4, display: "block", fontFamily: "DM Sans,sans-serif" }
  var tabBtn = function(id) { return { background: tab===id ? "rgba(200,169,122,0.15)" : "transparent", border: tab===id ? "0.5px solid rgba(200,169,122,0.35)" : BORD, borderRadius: 20, padding: "5px 14px", color: tab===id ? GOLD : "rgba(250,248,244,0.45)", fontSize: 12, fontFamily: "DM Sans,sans-serif", cursor: "pointer" } }
  var addBtnStyle = { background: "rgba(200,169,122,0.08)", border: "0.5px dashed rgba(200,169,122,0.3)", borderRadius: 10, padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", width: "100%" }
  var cardStyle = { background: SURF, border: BORD, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }
  var modalBg = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }
  var modalBox = { background: "#2E486B", border: "0.5px solid rgba(200,169,122,0.2)", borderRadius: 16, padding: "20px", width: "100%", maxWidth: 380 }
  return React.createElement("div", { style: { paddingBottom: "2rem" } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } },
      React.createElement("div", null,
        React.createElement("div", { style: { fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 700, color: WHITE } }, "Subscriptions"),
        React.createElement("div", { style: { fontSize: 12, color: "rgba(250,248,244,0.5)", marginTop: 2 } }, "Track what you pay, save & earn")
      ),
      (tab==="subs" && subs.length>1) && React.createElement("button", { onClick: function(){ setAzSort(!azSort) }, style: { fontSize: 11, color: azSort?GOLD:"rgba(250,248,244,0.5)", background: azSort?"rgba(200,169,122,0.12)":"transparent", border: "0.5px solid "+(azSort?"rgba(200,169,122,0.4)":"rgba(250,242,229,0.12)"), borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontFamily: "DM Sans,sans-serif" } }, azSort?"A\u2013Z \u2713":"A\u2013Z")
    ),
    React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" } },
      React.createElement("button", { style: tabBtn("subs"), onClick: function() { setTab("subs") } }, "Subscriptions"),
      React.createElement("button", { style: tabBtn("coupons"), onClick: function() { setTab("coupons") } }, "Coupons"),
      React.createElement("button", { style: tabBtn("perks"), onClick: function() { setTab("perks") } }, "Perks & Discounts")
    ),
    tab === "subs" && React.createElement("div", null,
      subs.length > 0 && React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 } },
        React.createElement("div", { style: { background: "rgba(250,242,229,0.05)", border: "0.5px solid rgba(200,169,122,0.15)", borderRadius: 10, padding: "10px 12px" } },
          React.createElement("div", { style: { fontSize: 10, color: "rgba(250,248,244,0.45)", marginBottom: 3, fontFamily: "DM Sans,sans-serif" } }, "Monthly total"),
          React.createElement("div", { style: { fontSize: 20, fontWeight: 500, color: WHITE, fontFamily: "DM Sans,sans-serif" } }, "$" + monthly.toFixed(2))
        ),
        React.createElement("div", { style: { background: "rgba(250,242,229,0.05)", border: "0.5px solid rgba(200,169,122,0.15)", borderRadius: 10, padding: "10px 12px" } },
          React.createElement("div", { style: { fontSize: 10, color: "rgba(250,248,244,0.45)", marginBottom: 3, fontFamily: "DM Sans,sans-serif" } }, "Yearly total"),
          React.createElement("div", { style: { fontSize: 20, fontWeight: 500, color: WHITE, fontFamily: "DM Sans,sans-serif" } }, "$" + (monthly*12).toFixed(2))
        )
      ),
      (azSort?subs.slice().sort(function(a,b){return (a.name||"").localeCompare(b.name||"");}):subs).map(function(s) {
        return React.createElement("div", { key: s.id, style: cardStyle },
          React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: "DM Sans,sans-serif" } }, s.name),
              React.createElement("div", { style: { fontSize: 11, color: "rgba(250,248,244,0.45)", marginTop: 2, fontFamily: "DM Sans,sans-serif", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
                React.createElement("span", null, s.cycle),
                s.website && React.createElement("a", { href: s.website.startsWith("http") ? s.website : "https://"+s.website, target: "_blank", rel: "noopener noreferrer", style: { color: BLUE, fontSize: 10 } }, "↗ website"),
                s.renewDate && React.createElement("span", { style: { fontSize: 9, padding: "2px 6px", borderRadius: 20, background: "rgba(239,159,39,0.15)", color: "#EF9F27", border: "0.5px solid rgba(239,159,39,0.3)" } }, "Renews " + s.renewDate)
              )
            ),
            React.createElement("div", { style: { textAlign: "right", flexShrink: 0, marginLeft: 12 } },
              React.createElement("div", { style: { fontSize: 16, fontWeight: 600, color: WHITE, fontFamily: "DM Sans,sans-serif" } }, "$" + (s.amount||0).toFixed(2)),
              React.createElement("button", { onClick: function() { deleteSub(s.id) }, style: { background: "none", border: "none", color: "rgba(250,248,244,0.25)", cursor: "pointer", fontSize: 11, fontFamily: "DM Sans,sans-serif" } }, "remove")
            )
          )
        )
      }),
      React.createElement("button", { style: addBtnStyle, onClick: function() { openAdd("sub") } },
        React.createElement("span", { style: { fontSize: 16, color: GOLD } }, "+"),
        React.createElement("span", { style: { fontSize: 13, color: GOLD, fontFamily: "DM Sans,sans-serif" } }, "Add subscription")
      )
    ),
    tab === "coupons" && React.createElement("div", null,
      coupons.length === 0 && React.createElement("div", { style: { textAlign: "center", padding: "32px 0", color: "rgba(250,248,244,0.35)", fontSize: 13, fontFamily: "DM Sans,sans-serif" } }, "No coupons yet — add Kohl\'s Cash, store credit, rewards..."),
      coupons.map(function(c) {
        return React.createElement("div", { key: c.id, style: Object.assign({}, cardStyle, { opacity: c.used ? 0.45 : 1 }) },
          React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
            React.createElement("div", { style: { flex: 1 } },
              React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: "DM Sans,sans-serif", textDecoration: c.used ? "line-through" : "none" } }, c.name),
              c.expires && React.createElement("div", { style: { fontSize: 11, color: "rgba(250,248,244,0.45)", marginTop: 2, fontFamily: "DM Sans,sans-serif" } }, "Use by " + c.expires),
              c.notes && React.createElement("div", { style: { fontSize: 11, color: "rgba(250,248,244,0.4)", marginTop: 2, fontFamily: "DM Sans,sans-serif" } }, c.notes)
            ),
            React.createElement("div", { style: { textAlign: "right", flexShrink: 0, marginLeft: 12 } },
              c.amount && React.createElement("div", { style: { fontSize: 18, fontWeight: 600, color: SAGE, fontFamily: "DM Sans,sans-serif" } }, c.amount),
              React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 4, justifyContent: "flex-end" } },
                React.createElement("button", { onClick: function() { toggleCouponUsed(c.id) }, style: { background: "none", border: "0.5px solid rgba(250,242,229,0.15)", borderRadius: 6, padding: "2px 8px", color: "rgba(250,248,244,0.45)", cursor: "pointer", fontSize: 11, fontFamily: "DM Sans,sans-serif" } }, c.used ? "unmark" : "used"),
                React.createElement("button", { onClick: function() { deleteCoupon(c.id) }, style: { background: "none", border: "none", color: "rgba(250,248,244,0.25)", cursor: "pointer", fontSize: 11, fontFamily: "DM Sans,sans-serif" } }, "✕")
              )
            )
          )
        )
      }),
      React.createElement("button", { style: addBtnStyle, onClick: function() { openAdd("coupon") } },
        React.createElement("span", { style: { fontSize: 16, color: GOLD } }, "+"),
        React.createElement("span", { style: { fontSize: 13, color: GOLD, fontFamily: "DM Sans,sans-serif" } }, "Add coupon or store credit")
      )
    ),
    tab === "perks" && React.createElement("div", null,
      perks.length === 0 && React.createElement("div", { style: { textAlign: "center", padding: "32px 0", color: "rgba(250,248,244,0.35)", fontSize: 13, fontFamily: "DM Sans,sans-serif" } }, "Record kids eat free spots, military discounts, and more..."),
      perks.map(function(p) {
        return React.createElement("div", { key: p.id, style: Object.assign({}, cardStyle, { background: "rgba(107,163,196,0.07)", border: "0.5px solid rgba(107,163,196,0.2)" }) },
          React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between" } },
            React.createElement("div", { style: { flex: 1 } },
              React.createElement("div", { style: { fontSize: 9, fontWeight: 700, color: BLUE, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3, fontFamily: "DM Sans,sans-serif" } }, p.type),
              React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: "DM Sans,sans-serif" } }, p.name),
              p.detail && React.createElement("div", { style: { fontSize: 12, color: "rgba(250,248,244,0.5)", marginTop: 3, fontFamily: "DM Sans,sans-serif" } }, p.detail),
              p.notes && React.createElement("div", { style: { fontSize: 11, color: "rgba(250,248,244,0.4)", marginTop: 2, fontFamily: "DM Sans,sans-serif" } }, p.notes)
            ),
            React.createElement("button", { onClick: function() { deletePerk(p.id) }, style: { background: "none", border: "none", color: "rgba(250,248,244,0.25)", cursor: "pointer", fontSize: 14, marginLeft: 8 } }, "✕")
          )
        )
      }),
      React.createElement("button", { style: addBtnStyle, onClick: function() { openAdd("perk") } },
        React.createElement("span", { style: { fontSize: 16, color: GOLD } }, "+"),
        React.createElement("span", { style: { fontSize: 13, color: GOLD, fontFamily: "DM Sans,sans-serif" } }, "Add perk or discount")
      )
    ),
    modal && React.createElement("div", { style: modalBg, onClick: function(e) { if (e.target === e.currentTarget) closeModal() } },
      React.createElement("div", { style: modalBox },
        React.createElement("div", { style: { fontFamily: "Cormorant Garamond,serif", fontSize: 18, fontWeight: 700, color: WHITE, marginBottom: 16 } },
          modal === "sub" ? "Add subscription" : modal === "coupon" ? "Add coupon / store credit" : "Add perk or discount"
        ),
        modal === "sub" && React.createElement("div", null,
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Service name"), React.createElement("input", { style: inp, placeholder: "e.g. Netflix, Spotify", value: form.name||"", onChange: function(e) { setForm(Object.assign({},form,{name:e.target.value})) } })),
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 } },
            React.createElement("div", null, React.createElement("label", { style: lbl }, "Amount ($)"), React.createElement("input", { style: inp, type: "number", placeholder: "0.00", value: form.amount||"", onChange: function(e) { setForm(Object.assign({},form,{amount:e.target.value})) } })),
            React.createElement("div", null, React.createElement("label", { style: lbl }, "Billing cycle"),
              React.createElement("select", { style: inp, value: form.cycle||"monthly", onChange: function(e) { setForm(Object.assign({},form,{cycle:e.target.value})) } },
                CYCLES.map(function(c) { return React.createElement("option", { key: c, value: c }, c) })
              )
            )
          ),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Website (optional)"), React.createElement("input", { style: inp, placeholder: "e.g. netflix.com", value: form.website||"", onChange: function(e) { setForm(Object.assign({},form,{website:e.target.value})) } })),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Renewal date (optional)"), React.createElement("input", { style: inp, type: "date", value: form.renewDate||"", onChange: function(e) { setForm(Object.assign({},form,{renewDate:e.target.value})) } }))
        ),
        modal === "coupon" && React.createElement("div", null,
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Name"), React.createElement("input", { style: inp, placeholder: "e.g. Kohl\'s Cash, Target Circle", value: form.name||"", onChange: function(e) { setForm(Object.assign({},form,{name:e.target.value})) } })),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Amount or value"), React.createElement("input", { style: inp, placeholder: "e.g. $30 or 20% off", value: form.amount||"", onChange: function(e) { setForm(Object.assign({},form,{amount:e.target.value})) } })),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Use by date"), React.createElement("input", { style: inp, type: "date", value: form.expires||"", onChange: function(e) { setForm(Object.assign({},form,{expires:e.target.value})) } })),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Notes (optional)"), React.createElement("input", { style: inp, placeholder: "e.g. in-store or online, app required", value: form.notes||"", onChange: function(e) { setForm(Object.assign({},form,{notes:e.target.value})) } }))
        ),
        modal === "perk" && React.createElement("div", null,
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Type"),
            React.createElement("select", { style: inp, value: form.type||"Other", onChange: function(e) { setForm(Object.assign({},form,{type:e.target.value})) } },
              PERK_TYPES.map(function(t) { return React.createElement("option", { key: t, value: t }, t) })
            )
          ),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Where / Name"), React.createElement("input", { style: inp, placeholder: "e.g. Chick-fil-A, Home Depot", value: form.name||"", onChange: function(e) { setForm(Object.assign({},form,{name:e.target.value})) } })),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Details"), React.createElement("input", { style: inp, placeholder: "e.g. Tuesdays, ages 12 & under, 10% off", value: form.detail||"", onChange: function(e) { setForm(Object.assign({},form,{detail:e.target.value})) } })),
          React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Notes (optional)"), React.createElement("input", { style: inp, placeholder: "e.g. ID required, app required", value: form.notes||"", onChange: function(e) { setForm(Object.assign({},form,{notes:e.target.value})) } }))
        ),
        React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
          React.createElement("button", { onClick: closeModal, style: { flex: 1, background: "transparent", border: "0.5px solid rgba(250,242,229,0.15)", borderRadius: 10, padding: "10px", color: "rgba(250,248,244,0.5)", fontFamily: "DM Sans,sans-serif", fontSize: 14, cursor: "pointer" } }, "Cancel"),
          React.createElement("button", { onClick: modal==="sub" ? addSub : modal==="coupon" ? addCoupon : addPerk, style: { flex: 1, background: GOLD, border: "none", borderRadius: 10, padding: "10px", color: NAVY, fontFamily: "DM Sans,sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" } }, "Save")
        )
      )
    )
  )
}

// ── Ripple Section (kid milestones & memories) ────────────────────────────────
var RIPPLE_CATS = [
  { id: "all", label: "All" },
  { id: "milestone", label: "Milestone" },
  { id: "firsts", label: "Firsts" },
  { id: "school", label: "School" },
  { id: "sports", label: "Sports" },
  { id: "funny", label: "Funny" },
  { id: "faith", label: "Faith" },
  { id: "other", label: "Other" },
]
function RippleSection() {
  var GOLD = "#c8a97a"; var NAVY = "#243A5A"; var WHITE = "#faf8f4"
  var SURF = "rgba(250,242,229,0.04)"; var BORD = "0.5px solid rgba(250,242,229,0.08)"
  var SAGE = "#7a9e8e"
  var allPeople = hLoadPeople()
  var tagPeople = allPeople.filter(function(p) { return p.role==="Kid"||p.role==="Teen"||p.role==="Baby" })
  if (tagPeople.length === 0) tagPeople = allPeople
  function loadR() { try { var _lr=JSON.parse(localStorage.getItem("af_ripples") || "[]"); return Array.isArray(_lr)?_lr:[]; } catch { return [] } }
  function persistR(v) { try { localStorage.setItem("af_ripples", JSON.stringify(v)); afVaultChanged("ripples"); } catch {} }
  var [ripples, setRipples] = React.useState(function() { return loadR() })
  React.useEffect(function() {
    function onRefresh(e) {
      if (!e.detail?.key || e.detail.key === "ripples") {
        try { var _lr = loadR(); setRipples(Array.isArray(_lr) ? _lr : []) } catch {}
      }
    }
    window.addEventListener("af-data-changed", onRefresh)
    return function() { window.removeEventListener("af-data-changed", onRefresh) }
  }, [])
  var [cat, setCat] = React.useState("all")
  var [personFolder, setPersonFolder] = React.useState("all")
  var [modal, setModal] = React.useState(false)
  var [form, setForm] = React.useState({ name: "", who: "", category: "milestone", date: "", note: "" })
  var [editId, setEditId] = React.useState(null)
  function saveR(v) { setRipples(v); persistR(v) }
  function openAdd() { setForm({ name: "", who: personFolder !== "all" ? personFolder : "", category: "milestone", date: new Date().toISOString().slice(0,10), note: "" }); setEditId(null); setModal(true) }
  function openEdit(r) { setForm({ name: r.name, who: r.who||"", category: r.category||"milestone", date: r.date||"", note: r.note||"" }); setEditId(r.id); setModal(true) }
  function closeModal() { setModal(false); setEditId(null) }
  function submit() {
    if (!form.name.trim()) return
    if (editId) { saveR(ripples.map(function(r) { return r.id===editId ? Object.assign({},r,form) : r })) }
    else { saveR([...ripples, Object.assign({ id: Date.now().toString() }, form)]) }
    closeModal()
  }
  function deleteRipple(id) { saveR(ripples.filter(function(r) { return r.id !== id })) }
  var filtered = ripples.filter(function(r) {
    var matchPerson = personFolder === "all" || r.who === personFolder
    var matchCat = cat === "all" || r.category === cat
    return matchPerson && matchCat
  })
  var sorted = filtered.slice().sort(function(a,b) {
    if (!a.date && !b.date) return 0; if (!a.date) return 1; if (!b.date) return -1
    return new Date(b.date) - new Date(a.date)
  })
  var groups = []
  var seen = {}
  sorted.forEach(function(r) {
    var d = r.date ? new Date(r.date+"T00:00:00").toLocaleDateString("en-US",{month:"long",year:"numeric"}) : "No date"
    if (!seen[d]) { seen[d]=true; groups.push({ label: d, items: [] }) }
    groups[groups.length-1].items.push(r)
  })
  var inp = { background: "rgba(250,242,229,0.06)", border: BORD, borderRadius: 8, padding: "9px 12px", color: WHITE, fontFamily: "DM Sans,sans-serif", fontSize: 13, width: "100%", outline: "none" }
  var lbl = { fontSize: 11, color: "rgba(250,248,244,0.5)", marginBottom: 4, display: "block", fontFamily: "DM Sans,sans-serif" }
  var modalBg = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }
  var modalBox = { background: "#2E486B", border: "0.5px solid rgba(200,169,122,0.2)", borderRadius: 16, padding: "20px", width: "100%", maxWidth: 380 }
  return React.createElement("div", { style: { paddingBottom: "2rem" } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } },
      React.createElement("div", null,
        React.createElement("div", { style: { fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 700, color: WHITE } }, "Ripple"),
        React.createElement("div", { style: { fontSize: 12, color: "rgba(250,248,244,0.5)", marginTop: 2 } }, "Every moment worth keeping")
      ),
      React.createElement("button", { onClick: openAdd, style: { background: GOLD, border: "none", borderRadius: 9, padding: "8px 16px", color: NAVY, fontFamily: "DM Sans,sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" } }, "+ Capture")
    ),
    tagPeople.length > 0 && React.createElement("div", { style: { marginBottom: 12 } },
      React.createElement("div", { style: { fontSize: 10, color: "rgba(200,169,122,0.5)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6, fontFamily: "DM Sans,sans-serif", fontWeight: 700 } }, "📁 Folders"),
      React.createElement("div", { style: { display: "flex", gap: 5, flexWrap: "wrap" } },
        [{ id: "all", name: "All" }].concat(tagPeople).map(function(p) {
          var fid = p.id === "all" ? "all" : p.name
          var active = personFolder === fid
          var count = fid === "all" ? ripples.length : ripples.filter(function(r) { return r.who === fid }).length
          return React.createElement("button", { key: p.id || "all", onClick: function() { setPersonFolder(fid) },
            style: { display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 20,
              background: active ? GOLD+"22" : "transparent",
              border: active ? "0.5px solid "+GOLD : BORD,
              color: active ? GOLD : "rgba(250,248,244,0.5)",
              fontSize: 12, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: active ? 700 : 400 } },
            fid !== "all" && p.color ? React.createElement("span", { style: { width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0, display: "inline-block" } }) : null,
            fid === "all" ? "All" : p.name,
            React.createElement("span", { style: { fontSize: 9, opacity: 0.6, marginLeft: 2 } }, "("+count+")")
          )
        })
      )
    ),
    React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 } },
      RIPPLE_CATS.map(function(c) {
        return React.createElement("button", { key: c.id, onClick: function() { setCat(c.id) }, style: { background: cat===c.id ? "rgba(200,169,122,0.15)" : "transparent", border: cat===c.id ? "0.5px solid rgba(200,169,122,0.35)" : BORD, borderRadius: 20, padding: "4px 12px", color: cat===c.id ? GOLD : "rgba(250,248,244,0.45)", fontSize: 11, fontFamily: "DM Sans,sans-serif", cursor: "pointer" } }, c.label)
      })
    ),
    ripples.length===0 && React.createElement("div", { style: { textAlign: "center", padding: "48px 20px" } },
      React.createElement("div", { style: { fontSize: 32, marginBottom: 12, opacity: 0.3 } }, "🌊"),
      React.createElement("div", { style: { fontFamily: "Cormorant Garamond,serif", fontSize: 20, color: WHITE, marginBottom: 8 } }, "No ripples yet"),
      React.createElement("div", { style: { fontSize: 13, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", lineHeight: 1.6 } }, "Capture first words, lost teeth, goals scored — anything worth remembering."),
      React.createElement("button", { onClick: openAdd, style: { marginTop: 20, background: GOLD, border: "none", borderRadius: 10, padding: "10px 24px", color: NAVY, fontFamily: "DM Sans,sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" } }, "Capture a ripple")
    ),
    groups.map(function(group) {
      return React.createElement("div", { key: group.label, style: { marginBottom: 8 } },
        React.createElement("div", { style: { fontSize: 10, color: "rgba(200,169,122,0.7)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, fontFamily: "DM Sans,sans-serif", fontWeight: 700 } }, group.label),
        group.items.map(function(r) {
          return React.createElement("div", { key: r.id, style: { background: SURF, border: BORD, borderRadius: 10, padding: "10px 12px", marginBottom: 8 } },
            React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between" } },
              React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", { style: { fontSize: 14, fontWeight: 600, color: WHITE, fontFamily: "DM Sans,sans-serif" } }, r.name),
                r.note && React.createElement("div", { style: { fontSize: 12, color: "rgba(250,248,244,0.55)", marginTop: 4, fontFamily: "DM Sans,sans-serif", lineHeight: 1.5 } }, r.note),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" } },
                  r.date && React.createElement("span", { style: { fontSize: 10, color: "rgba(200,169,122,0.6)", fontFamily: "DM Sans,sans-serif" } }, new Date(r.date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})),
                  r.who && React.createElement("span", { style: { fontSize: 10, color: "rgba(250,248,244,0.35)", padding: "1px 7px", background: "rgba(250,242,229,0.05)", borderRadius: 20, fontFamily: "DM Sans,sans-serif" } }, r.who),
                  r.category && r.category!=="other" && React.createElement("span", { style: { fontSize: 9, padding: "1px 7px", borderRadius: 20, background: "rgba(122,158,142,0.15)", color: SAGE, border: "0.5px solid rgba(122,158,142,0.3)", fontFamily: "DM Sans,sans-serif" } }, r.category)
                )
              ),
              React.createElement("div", { style: { display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 } },
                React.createElement("button", { onClick: function() { openEdit(r) }, style: { background: "none", border: "none", color: "rgba(250,248,244,0.3)", cursor: "pointer", fontSize: 14 } }, "✎"),
                React.createElement("button", { onClick: function() { deleteRipple(r.id) }, style: { background: "none", border: "none", color: "rgba(250,248,244,0.2)", cursor: "pointer", fontSize: 14 } }, "✕")
              )
            )
          )
        })
      )
    }),
    modal && React.createElement("div", { style: modalBg, onClick: function(e) { if (e.target===e.currentTarget) closeModal() } },
      React.createElement("div", { style: modalBox },
        React.createElement("div", { style: { fontFamily: "Cormorant Garamond,serif", fontSize: 18, fontWeight: 700, color: WHITE, marginBottom: 16 } }, editId ? "Edit ripple" : "Capture a ripple"),
        React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "What happened?"), React.createElement("input", { style: inp, placeholder: "e.g. Lost first tooth, First goal scored", value: form.name, onChange: function(e) { setForm(Object.assign({},form,{name:e.target.value})) } })),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 } },
          React.createElement("div", null,
            React.createElement("label", { style: lbl }, "Who"),
            tagPeople.length > 0 && React.createElement("div", { style: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 } },
              tagPeople.map(function(p) {
                var selected = form.who === p.name
                return React.createElement("button", { key: p.id, onClick: function() { setForm(Object.assign({},form,{who: selected ? "" : p.name})) },
                  style: { display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20,
                    background: selected ? GOLD+"33" : "rgba(250,242,229,0.05)",
                    border: selected ? "0.5px solid "+GOLD : BORD,
                    color: selected ? GOLD : "rgba(250,248,244,0.55)",
                    fontSize: 11, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: selected ? 700 : 400 } },
                  p.color && React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0 } }),
                  p.name
                )
              })
            ),
            React.createElement("input", { style: inp, placeholder: "Or type a name…", value: form.who, onChange: function(e) { setForm(Object.assign({},form,{who:e.target.value})) } })
          ),
          React.createElement("div", null, React.createElement("label", { style: lbl }, "Date"), React.createElement("input", { style: inp, type: "date", value: form.date, onChange: function(e) { setForm(Object.assign({},form,{date:e.target.value})) } }))
        ),
        React.createElement("div", { style: { marginBottom: 12 } }, React.createElement("label", { style: lbl }, "Category"),
          React.createElement("select", { style: inp, value: form.category, onChange: function(e) { setForm(Object.assign({},form,{category:e.target.value})) } },
            RIPPLE_CATS.filter(function(c) { return c.id!=="all" }).map(function(c) { return React.createElement("option", { key: c.id, value: c.id }, c.label) })
          )
        ),
        React.createElement("div", { style: { marginBottom: 16 } }, React.createElement("label", { style: lbl }, "Note (optional)"),
          React.createElement("textarea", { style: Object.assign({}, inp, { minHeight: 72, resize: "vertical" }), placeholder: "Any details you want to remember...", value: form.note, onChange: function(e) { setForm(Object.assign({},form,{note:e.target.value})) } })
        ),
        React.createElement("div", { style: { display: "flex", gap: 8 } },
          React.createElement("button", { onClick: closeModal, style: { flex: 1, background: "transparent", border: "0.5px solid rgba(250,242,229,0.15)", borderRadius: 10, padding: "10px", color: "rgba(250,248,244,0.5)", fontFamily: "DM Sans,sans-serif", fontSize: 14, cursor: "pointer" } }, "Cancel"),
          React.createElement("button", { onClick: submit, style: { flex: 1, background: GOLD, border: "none", borderRadius: 10, padding: "10px", color: NAVY, fontFamily: "DM Sans,sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" } }, editId ? "Save" : "Capture")
        )
      )
    )
  )
}

// Notify HomeFlow that vault data changed so debouncedSync fires
function afVaultChanged(key) {
  try {
    const dirty = JSON.parse(localStorage.getItem("af_dirtyKeys") || "[]");
    if (!dirty.includes(key)) {
      dirty.push(key);
      localStorage.setItem("af_dirtyKeys", JSON.stringify(dirty));
    }
    window.dispatchEvent(new CustomEvent("af-data-changed", { detail: { key } }));
  } catch(e) {}
}

export default function AnchorVault({ onClose, calEvents, vaultSection, initialTripId, onTripIdConsumed }) {
  // Recipes tab lives in HomeFlow/MealsTab (App.jsx), a sibling component
  // FlowWrapper renders separately from AnchorVault — there's no prop path
  // from here to there. Navigate the same way AnchorVault already talks to
  // HomeFlow elsewhere: close the vault, dispatch the existing af-set-tab
  // event to switch tabs, and dispatch a one-shot event carrying the recipe
  // to open. MealsTab/RecipeBookTab also check sessionStorage on mount, in
  // case they aren't mounted yet when this fires (tab switch is async).
  function handleOpenRecipe(recipeId) {
    try { sessionStorage.setItem("af_pendingRecipeId", recipeId); sessionStorage.setItem("af_pendingRecipesTab", "1"); } catch {}
    try { window.dispatchEvent(new CustomEvent("af-set-tab", { detail: "meals" })); } catch {}
    try { window.dispatchEvent(new CustomEvent("af-open-recipe", { detail: { recipeId } })); } catch {}
    onClose()
  }
  function handleBrowseRecipes() {
    try { sessionStorage.removeItem("af_pendingRecipeId"); sessionStorage.setItem("af_pendingRecipesTab", "1"); } catch {}
    try { window.dispatchEvent(new CustomEvent("af-set-tab", { detail: "meals" })); } catch {}
    try { window.dispatchEvent(new CustomEvent("af-open-recipes-tab")); } catch {}
    onClose()
  }
  calEvents = calEvents || []
  vaultSection = vaultSection || "home"

  const [activeSection, setActiveSection] = useState(vaultSection)
  const vaultScrollRef = React.useRef(null)
  useEffect(function() {
    setActiveSection(vaultSection)
    if (vaultScrollRef.current) vaultScrollRef.current.scrollTop = 0
  }, [vaultSection])
  useEffect(function() {
    if (vaultScrollRef.current) vaultScrollRef.current.scrollTop = 0
  }, [activeSection])

  const [anchorHidden, setAnchorHidden] = React.useState(function() {
    try { return JSON.parse(localStorage.getItem("af_anchor_hidden") || "{}") } catch { return {} }
  })
  // Sync when settings change
  React.useEffect(function() {
    function onStorage() {
      try { setAnchorHidden(JSON.parse(localStorage.getItem("af_anchor_hidden") || "{}")) } catch {}
    }
    window.addEventListener("storage", onStorage)
    return function() { window.removeEventListener("storage", onStorage) }
  }, [])

  const [inventory, setInventory] = useState(function() {
    try { return JSON.parse(localStorage.getItem("af_inventory") || "null") } catch { return null }
  })

  function handleAddToShopping(item) {
    try {
      // Read first store name so it matches the Shopping tab's store list
      var stores = []
      try { stores = JSON.parse(localStorage.getItem("af_stores") || "[]") } catch {}
      var store = (stores && stores[0]) ? stores[0] : "Grocery Store"
      // Dispatch custom event so App.jsx's React state (setShoppingItems) picks it up live
      window.dispatchEvent(new CustomEvent("af-shopping-add", { detail: { text: item, store: store } }))
      // Also write to localStorage as a fallback for cold reads
      const existing = JSON.parse(localStorage.getItem("af_shoppingItems") || "[]")
      const newItem = { id: Date.now().toString(), text: item, done: false, store: store, category: "grocery" }
      localStorage.setItem("af_shoppingItems", JSON.stringify([...existing, newItem]))
    } catch {}
  }

  return (
    <div className="af-vault" style={{ position: "fixed", top: 0, left: 68, right: 0, bottom: 0, zIndex: 150, display: "flex" }}>
      <style>{VAULT_INPUT_STYLE}</style>
      <div ref={vaultScrollRef} style={{ flex: 1, background: (activeSection === "ripples" ? "linear-gradient(165deg,#3E8B91 0%,#2B7378 55%,#1E5B63 100%)" : "linear-gradient(165deg,#334967 0%,#293B56 60%,#25344B 100%)"), transition: "background 0.3s", overflowY: "auto", padding: "24px 20px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {activeSection !== "home" && (
            <button onClick={function() { setActiveSection("home") }} style={{ background: "none", border: "none", color: "rgba(200,169,122,0.7)", cursor: "pointer", fontSize: 13, fontFamily: "DM Sans,sans-serif", padding: "0 0 16px 0", display: "flex", alignItems: "center", gap: 5 }}>← Anchor Home</button>
          )}
          {activeSection === "home" && <AnchorDashboard onNavigate={setActiveSection} calEvents={calEvents} />}
          {activeSection === "recurring" && <RecurringRemindersSection />}
          {activeSection === "inventory" && <InventorySection onAddToShopping={handleAddToShopping} />}
          {activeSection === "systems" && <HomeSection />}
          {activeSection === "health" && <HealthSection />}
          {activeSection === "gifts" && <GiftsAndCelebrations calEvents={calEvents} onOpenRecipe={handleOpenRecipe} onBrowseRecipes={handleBrowseRecipes} />}
          {activeSection === "pets" && <PetsSection />}
          {activeSection === "moments" && <MomentsSection />}
          {activeSection === "travel" && <TravelProfileSection />}
          {activeSection === "trips" && <TripsSection initialTripId={initialTripId} onTripIdConsumed={onTripIdConsumed} onNavigate={setActiveSection} />}
          {activeSection === "career" && <CareerSection />}
          {activeSection === "settings" && <AnchorSettings />}
          {activeSection === "subs" && <SubscriptionsSection />}
          {activeSection === "ripples" && <RipplesRoom />}
          {activeSection === "safeharbor" && <SafeHarbor />}
        </div>
      </div>
    </div>
  )
}
