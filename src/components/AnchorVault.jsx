import React, { useState, useEffect } from "react"
import MomentsSection from "./MomentsSection"
// CareerSection is defined inline below

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
    background: #1a2744;
    color: #faf8f4;
  }
  .af-vault input:-webkit-autofill,
  .af-vault input:-webkit-autofill:focus {
    -webkit-text-fill-color: #faf8f4 !important;
    -webkit-box-shadow: 0 0 0px 1000px #1e3360 inset !important;
    transition: background-color 5000s ease-in-out 0s;
  }
`

const NAV = [
  { id: "home",      label: "Home",         icon: "home" },
  { id: "inventory", label: "Inventory",    icon: "inv"  },
  { id: "systems",   label: "Home Systems", icon: "sys"  },
  { id: "health",    label: "Health",       icon: "hlth" },
  { id: "career",    label: "Career",       icon: "car",  premium: true },
  { id: "subs",      label: "Subscriptions",icon: "sub",  premium: true },
  { id: "gifts",     label: "Celebrate",    icon: "gift" },
  { id: "pets",      label: "Pets",         icon: "pet"  },
  { id: "moments",   label: "Moments",      icon: "mom"  },
  { id: "settings",  label: "Settings",     icon: "set"  },
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
  const [favForm, setFavForm] = useState({ name: "", brand: "", store: "", notes: "", emoji: "⭐", subcat: "grocery", photo: null })
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

      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(255,255,255,0.1)", marginBottom: 16 }}>
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
                  style={{ width: 72, height: 72, borderRadius: 10, border: "1.5px dashed rgba(200,169,122,0.35)", background: favForm.photo ? "transparent" : "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, overflow: "hidden", position: "relative" }}
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
                        <button key={s.id} onClick={function() { setFavForm(function(p) { return {...p, subcat: s.id} }) }} style={{ background: favForm.subcat===s.id ? "rgba(200,169,122,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid " + (favForm.subcat===s.id ? "rgba(200,169,122,0.5)" : "rgba(255,255,255,0.08)"), borderRadius: 20, padding: "3px 9px", fontSize: 10, color: favForm.subcat===s.id ? "#c8a97a" : "rgba(250,248,244,0.45)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: favForm.subcat===s.id ? 700 : 400 }}>{s.icon} {s.label}</button>
                      )
                    })}
                  </div>
                  <input value={favForm.name} onChange={function(e) { setFavForm(function(p) { return {...p, name: e.target.value} }) }} placeholder="Product name *" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Emoji picker */}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                {FAV_EMOJIS.map(function(e) {
                  return (
                    <button key={e} onClick={function() { setFavForm(function(p) { return {...p, emoji: e} }) }} style={{ background: favForm.emoji===e ? "rgba(200,169,122,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid " + (favForm.emoji===e ? "rgba(200,169,122,0.5)" : "rgba(255,255,255,0.08)"), borderRadius: 8, padding: "4px 7px", fontSize: 14, cursor: "pointer" }}>{e}</button>
                  )
                })}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={favForm.brand} onChange={function(e) { setFavForm(function(p) { return {...p, brand: e.target.value} }) }} placeholder="Brand (opt)" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
                <input value={favForm.store} onChange={function(e) { setFavForm(function(p) { return {...p, store: e.target.value} }) }} placeholder="Where to buy (opt)" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
              </div>
              <input value={favForm.notes} onChange={function(e) { setFavForm(function(p) { return {...p, notes: e.target.value} }) }} placeholder="Notes (opt)" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={function() {
                  if (!favForm.name.trim()) return
                  saveFavs([...favorites, { id: Date.now().toString(), ...favForm }])
                  setFavForm({ name: "", brand: "", store: "", notes: "", emoji: "⭐", subcat: "grocery", photo: null })
                  setAddingFav(false)
                }} style={{ flex: 1, background: "#c8a97a", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, color: "#1a2744", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Save product</button>
                <button onClick={function() { setAddingFav(false) }} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "rgba(250,248,244,0.4)", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={function() { setAddingFav(true) }} style={{ width: "100%", padding: "10px", background: "rgba(200,169,122,0.07)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 8, fontSize: 12, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 500, marginBottom: 12 }}>+ Add favorite product</button>
          )}

          {/* ── Subcat filter tabs ── */}
          <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(255,255,255,0.08)", marginBottom: 14, overflowX: "auto" }}>
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
                  <div key={fav.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
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
                          <span style={{ fontSize: 9, color: "rgba(250,248,244,0.25)", fontFamily: "DM Sans,sans-serif", background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "2px 6px", whiteSpace: "nowrap", flexShrink: 0 }}>{subInfo.icon} {subInfo.label}</span>
                        </div>
                        {fav.store && <div style={{ fontSize: 11, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", marginTop: 3 }}>📍 {fav.store}</div>}
                        {fav.notes && <div style={{ fontSize: 11, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", marginTop: 3, fontStyle: "italic" }}>{fav.notes}</div>}
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
          <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(255,255,255,0.08)", marginBottom: 16, overflowX: "auto" }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: isCollapsed ? 10 : "10px 10px 0 0", border: "1px solid rgba(255,255,255,0.06)", borderBottom: isCollapsed ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(255,255,255,0.04)", userSelect: "none" }}>
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
                    <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                      {subItems.length === 0 && !isInlineAdding && (
                        <div onClick={function() { openInlineAdd(sub.id) }} style={{ padding: "10px 14px", fontSize: 12, color: "rgba(250,248,244,0.2)", fontFamily: "DM Sans,sans-serif", fontStyle: "italic", cursor: "text" }}>tap to add an item…</div>
                      )}

                      {subItems.map(function(s) {
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
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: isDragOver ? "rgba(200,169,122,0.12)" : "transparent", borderLeft: isDragOver ? "3px solid #c8a97a" : "3px solid transparent", transition: "background 0.08s", opacity: dragFrom.current === idx ? 0.3 : 1, cursor: "grab" }}
                          >
                            {/* Stocked checkbox */}
                            <div onClick={function() { if (editing !== idx) toggle(idx) }} style={{ width: 20, height: 20, borderRadius: 5, border: "1.5px solid " + (item.stocked ? "#7a9e8e" : "rgba(255,255,255,0.2)"), background: item.stocked ? "#7a9e8e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                              {item.stocked && <span style={{ color: "#fff", fontSize: 11 }}>✓</span>}
                            </div>
                            {editing === idx ? (
                              <input value={editVal} onChange={function(e) { setEditVal(e.target.value) }} onKeyDown={function(e) { if (e.key === "Enter") renameItem(idx); if (e.key === "Escape") setEditing(null) }} autoFocus style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(200,169,122,0.4)", borderRadius: 6, padding: "3px 8px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
                            ) : (
                              <span style={{ flex: 1, fontSize: 13, color: item.stocked ? "rgba(250,248,244,0.75)" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", textDecoration: item.stocked ? "none" : "line-through" }}>{item.name}</span>
                            )}
                            {!item.stocked && editing !== idx && <span style={{ fontSize: 10, color: "#c8834a", fontFamily: "DM Sans,sans-serif", flexShrink: 0 }}>→ list</span>}
                            {editing === idx ? (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={function() { renameItem(idx) }} style={{ background: "#7a9e8e", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#fff", cursor: "pointer" }}>save</button>
                                <button onClick={function() { setEditing(null) }} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "rgba(250,248,244,0.5)", cursor: "pointer" }}>cancel</button>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderTop: subItems.length > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                          <input
                            autoFocus
                            value={inlineVal[inlineKey] || ""}
                            onChange={function(e) { var v = e.target.value; setInlineVal(function(p) { return { ...p, [inlineKey]: v } }) }}
                            onKeyDown={function(e) {
                              if (e.key === "Enter") { addInlineItem(sub.id) }
                              if (e.key === "Escape") { setInlineAdding(function(p) { var n={...p}; delete n[inlineKey]; return n }); setInlineVal(function(p) { var n={...p}; delete n[inlineKey]; return n }) }
                            }}
                            placeholder={"Add to " + sub.label + "…"}
                            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 7, padding: "6px 10px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none" }}
                          />
                          <button onClick={function() { addInlineItem(sub.id) }} style={{ background: "#c8a97a", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 12, color: "#1a2744", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Add</button>
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
  { id: "wedding",    label: "Wedding",    emoji: "💐" },
  { id: "babyshower", label: "Baby Shower",emoji: "🍼" },
  { id: "other",      label: "Other",      emoji: "🎉" },
]

function CelebrationsSection({ calEvents }) {
  calEvents = calEvents || []
  const [celebrations, setCelebrations] = useState(function() {
    try {
      const saved = JSON.parse(localStorage.getItem("af_celebrations") || "[]")
      const bdays = JSON.parse(localStorage.getItem("af_birthdays") || "[]")
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
  const [expandedGifts, setExpandedGifts] = useState(null) // celebId with gift panel open
  const [newGiftText, setNewGiftText] = useState("")

  // Load/save gifts keyed by celebId
  const [giftMap, setGiftMap] = useState(function() {
    try { return JSON.parse(localStorage.getItem("af_celebgifts") || "{}") } catch { return {} }
  })
  function saveGiftMap(updated) {
    setGiftMap(updated)
    try { localStorage.setItem("af_celebgifts", JSON.stringify(updated)) } catch {}
  }
  function addGift(celebId) {
    if (!newGiftText.trim()) return
    var existing = giftMap[celebId] || []
    var item = { id: Date.now().toString(), text: newGiftText.trim(), bought: false }
    saveGiftMap(Object.assign({}, giftMap, { [celebId]: [...existing, item] }))
    setNewGiftText("")
  }
  function toggleGift(celebId, giftId) {
    var existing = (giftMap[celebId] || []).map(function(g) { return g.id === giftId ? Object.assign({}, g, { bought: !g.bought }) : g })
    saveGiftMap(Object.assign({}, giftMap, { [celebId]: existing }))
  }
  function removeGift(celebId, giftId) {
    var existing = (giftMap[celebId] || []).filter(function(g) { return g.id !== giftId })
    saveGiftMap(Object.assign({}, giftMap, { [celebId]: existing }))
  }

  function save(updated) {
    setCelebrations(updated)
    try { localStorage.setItem("af_celebrations", JSON.stringify(updated)) } catch {}
  }

  function addCelebration() {
    if (!form.name.trim() || !form.month || !form.day) return
    var newId = Date.now().toString()
    save([...celebrations, { id: newId, type: celebType, name: form.name.trim(), month: parseInt(form.month), day: parseInt(form.day), year: form.year ? parseInt(form.year) : null, notes: form.notes.trim() }])
    setForm({ name: "", month: "", day: "", year: "", notes: "" })
    setAdding(false)
    setExpandedGifts(newId) // auto-open gift panel after adding
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
  const INP = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none", boxSizing: "border-box" }

  const celebEntries = celebrations.map(function(c) {
    const typeInfo = CELEBRATION_TYPES.find(function(t) { return t.id === c.type }) || CELEBRATION_TYPES[6]
    const next = new Date(year, c.month-1, c.day)
    if (next < now) next.setFullYear(next.getFullYear()+1)
    const diff = Math.round((next - now) / 86400000)
    const age = (c.type === "birthday" && c.year) ? (next.getFullYear() - c.year) : null
    const label = c.name + (age ? " turns " + age : c.type === "anniversary" ? " anniversary" : "")
    return { ...c, typeInfo, next, diff, label, emoji: typeInfo.emoji, soon: diff <= 14 }
  })

  const all = celebEntries.sort(function(a, b) { return a.diff - b.diff })
  const upcoming = all.filter(function(e) { return e.diff >= 0 })
  const past = all.filter(function(e) { return e.diff < 0 })
  const shown = filter === "upcoming" ? upcoming : all

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: "#faf8f4" }}>Celebrations</div>
        <button onClick={function() { setAdding(function(p) { return !p }); setForm({ name: "", month: "", day: "", year: "", notes: "" }) }} style={{ background: "rgba(200,169,122,0.12)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }}>+ Add</button>
      </div>
      <div style={{ fontSize: 12, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", marginBottom: 16 }}>{upcoming.length} upcoming · {past.length} passed this year</div>

      {adding && (
        <div style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 12, padding: "16px", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {CELEBRATION_TYPES.map(function(t) {
              return (
                <button key={t.id} onClick={function() { setCelebType(t.id) }} style={{ background: celebType === t.id ? "rgba(200,169,122,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid " + (celebType === t.id ? "rgba(200,169,122,0.5)" : "rgba(255,255,255,0.1)"), borderRadius: 20, padding: "5px 11px", fontSize: 11, color: celebType === t.id ? "#c8a97a" : "rgba(250,248,244,0.45)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: celebType === t.id ? 700 : 400 }}>
                  {t.emoji} {t.label}
                </button>
              )
            })}
          </div>
          <input value={form.name} onChange={function(e) { setForm(function(p) { return {...p, name: e.target.value} }) }} placeholder={celebType === "birthday" ? "Person's name" : "What's the occasion?"} style={Object.assign({}, INP, {width: "100%", marginBottom: 8})} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select value={form.month} onChange={function(e) { setForm(function(p) { return {...p, month: e.target.value} }) }} style={Object.assign({}, INP, { flex: 2, color: form.month ? "#faf8f4" : "rgba(250,248,244,0.35)", WebkitAppearance: "none", appearance: "none" })}>
              <option value="" style={{ background: "#1a2744", color: "rgba(250,248,244,0.5)" }}>Month</option>
              {MONTHS.map(function(m, i) { return <option key={i} value={i+1} style={{ background: "#1a2744", color: "#faf8f4" }}>{m}</option> })}
            </select>
            <input value={form.day} onChange={function(e) { setForm(function(p) { return {...p, day: e.target.value} }) }} placeholder="Day" type="number" min="1" max="31" style={Object.assign({}, INP, { flex: 1 })} />
            {(celebType === "birthday" || celebType === "anniversary") && (
              <input value={form.year} onChange={function(e) { setForm(function(p) { return {...p, year: e.target.value} }) }} placeholder="Year (opt)" type="number" style={Object.assign({}, INP, { flex: 1 })} />
            )}
          </div>
          <input value={form.notes} onChange={function(e) { setForm(function(p) { return {...p, notes: e.target.value} }) }} placeholder="Notes (optional)" style={Object.assign({}, INP, {width: "100%", marginBottom: 12})} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addCelebration} style={{ flex: 1, background: "#c8a97a", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, color: "#1a2744", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Save celebration</button>
            <button onClick={function() { setAdding(false) }} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "rgba(250,248,244,0.4)", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(255,255,255,0.08)", marginBottom: 16 }}>
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
        const gifts = giftMap[e.id] || []
        const boughtCount = gifts.filter(function(g) { return g.bought }).length
        const hasGifts = gifts.length > 0
        const isGiftOpen = expandedGifts === e.id

        if (editingId === e.id) {
          return (
            <div key={e.id || i} style={{ background: "rgba(200,169,122,0.06)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 12, padding: "14px", marginBottom: 7 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {CELEBRATION_TYPES.map(function(t) {
                  return (
                    <button key={t.id} onClick={function() { setEditForm(function(p) { return {...p, type: t.id} }) }} style={{ background: editForm.type === t.id ? "rgba(200,169,122,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid " + (editForm.type === t.id ? "rgba(200,169,122,0.5)" : "rgba(255,255,255,0.1)"), borderRadius: 20, padding: "4px 10px", fontSize: 11, color: editForm.type === t.id ? "#c8a97a" : "rgba(250,248,244,0.45)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: editForm.type === t.id ? 700 : 400 }}>
                      {t.emoji} {t.label}
                    </button>
                  )
                })}
              </div>
              <input value={editForm.name} onChange={function(ev) { setEditForm(function(p) { return {...p, name: ev.target.value} }) }} placeholder="Name" style={Object.assign({}, INP, {width: "100%", marginBottom: 8})} />
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <select value={editForm.month} onChange={function(ev) { setEditForm(function(p) { return {...p, month: ev.target.value} }) }} style={Object.assign({}, INP, { flex: 2, color: editForm.month ? "#faf8f4" : "rgba(250,248,244,0.35)", WebkitAppearance: "none", appearance: "none" })}>
                  <option value="" style={{ background: "#1a2744", color: "rgba(250,248,244,0.5)" }}>Month</option>
                  {MONTHS.map(function(m, mi) { return <option key={mi} value={mi+1} style={{ background: "#1a2744", color: "#faf8f4" }}>{m}</option> })}
                </select>
                <input value={editForm.day} onChange={function(ev) { setEditForm(function(p) { return {...p, day: ev.target.value} }) }} placeholder="Day" type="number" min="1" max="31" style={Object.assign({}, INP, { flex: 1 })} />
                {(editForm.type === "birthday" || editForm.type === "anniversary") && (
                  <input value={editForm.year} onChange={function(ev) { setEditForm(function(p) { return {...p, year: ev.target.value} }) }} placeholder="Year (opt)" type="number" style={Object.assign({}, INP, { flex: 1 })} />
                )}
              </div>
              <input value={editForm.notes} onChange={function(ev) { setEditForm(function(p) { return {...p, notes: ev.target.value} }) }} placeholder="Notes (optional)" style={Object.assign({}, INP, {width: "100%", marginBottom: 10})} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveEdit} style={{ flex: 1, background: "#c8a97a", border: "none", borderRadius: 8, padding: "8px", fontSize: 13, color: "#1a2744", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Save changes</button>
                <button onClick={function() { setEditingId(null) }} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "rgba(250,248,244,0.4)", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )
        }

        return (
          <div key={e.id || i} style={{ background: e.soon && !isPast ? "rgba(200,131,74,0.06)" : "rgba(255,255,255,0.03)", border: "1px solid " + (e.soon && !isPast ? "rgba(200,131,74,0.2)" : "rgba(255,255,255,0.07)"), borderRadius: 10, marginBottom: 8, opacity: isPast ? 0.5 : 1, overflow: "hidden" }}>
            {/* Main row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
              <div style={{ width: 40, textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 18, lineHeight: 1 }}>{e.emoji}</div>
                {e.month && <div style={{ fontSize: 11, fontWeight: 700, color: e.soon && !isPast ? "#c8834a" : "rgba(200,169,122,0.6)", fontFamily: "Cormorant Garamond,serif" }}>{MONTHS[e.month-1]} {e.day}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isPast ? "rgba(250,248,244,0.45)" : "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{e.label}</span>
                  {hasGifts && <span style={{ fontSize: 12 }} title={boughtCount + "/" + gifts.length + " bought"}>🎁</span>}
                  {hasGifts && boughtCount < gifts.length && <span style={{ fontSize: 9, background: "rgba(200,131,74,0.2)", color: "#c8834a", borderRadius: 8, padding: "1px 5px", fontFamily: "DM Sans,sans-serif", fontWeight: 700 }}>{gifts.length - boughtCount} to get</span>}
                </div>
                <div style={{ fontSize: 11, color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", marginTop: 1 }}>{e.typeInfo && e.typeInfo.label}{e.notes ? " · " + e.notes : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{ textAlign: "right" }}>
                  {isPast ? <span style={{ fontSize: 10, color: "rgba(250,248,244,0.2)", fontFamily: "DM Sans,sans-serif" }}>passed</span>
                  : e.diff === 0 ? <span style={{ fontSize: 11, fontWeight: 800, color: "#c8834a" }}>Today!</span>
                  : e.diff === 1 ? <span style={{ fontSize: 11, fontWeight: 700, color: "#c8834a" }}>Tomorrow</span>
                  : <span style={{ fontSize: 11, color: e.diff <= 7 ? "#c8834a" : "rgba(250,248,244,0.3)", fontWeight: e.diff <= 7 ? 600 : 400 }}>in {e.diff}d</span>}
                </div>
                <button onClick={function() { setExpandedGifts(isGiftOpen ? null : e.id); setNewGiftText("") }} style={{ background: "rgba(200,169,122,0.1)", border: "0.5px solid rgba(200,169,122,0.25)", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#c8a97a", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 600 }} title="Gifts">🎁</button>
                <button onClick={function() { startEdit(e) }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: "2px 3px", color: "rgba(200,169,122,0.4)" }}>✏️</button>
                <button onClick={function() { save(celebrations.filter(function(x) { return x.id !== e.id })) }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: "2px 3px", color: "rgba(250,248,244,0.2)" }}>✕</button>
              </div>
            </div>

            {/* Gift panel — inline, no extra navigation */}
            {isGiftOpen && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "10px 14px 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(250,248,244,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, fontFamily: "DM Sans,sans-serif" }}>Gift ideas for {e.name}</div>
                {gifts.map(function(g) {
                  return (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div onClick={function() { toggleGift(e.id, g.id) }} style={{ width: 18, height: 18, borderRadius: 4, border: "1.5px solid " + (g.bought ? "#7a9e8e" : "rgba(255,255,255,0.2)"), background: g.bought ? "#7a9e8e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                        {g.bought && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
                      </div>
                      <span style={{ flex: 1, fontSize: 12, color: g.bought ? "rgba(250,248,244,0.35)" : "rgba(250,248,244,0.8)", fontFamily: "DM Sans,sans-serif", textDecoration: g.bought ? "line-through" : "none" }}>{g.text}</span>
                      <button onClick={function() { removeGift(e.id, g.id) }} style={{ background: "none", border: "none", fontSize: 11, color: "rgba(250,248,244,0.2)", cursor: "pointer", padding: "0 2px" }}>✕</button>
                    </div>
                  )
                })}
                {gifts.length === 0 && <div style={{ fontSize: 12, color: "rgba(250,248,244,0.25)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", marginBottom: 8 }}>No gift ideas yet</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <input
                    value={newGiftText}
                    onChange={function(ev) { setNewGiftText(ev.target.value) }}
                    onKeyDown={function(ev) { if (ev.key === "Enter") addGift(e.id) }}
                    placeholder="Add a gift idea…"
                    autoFocus={isGiftOpen}
                    style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#faf8f4", WebkitTextFillColor: "#faf8f4", caretColor: "#c8a97a", fontFamily: "DM Sans,sans-serif", outline: "none" }}
                  />
                  <button onClick={function() { addGift(e.id) }} style={{ background: "#c8a97a", border: "none", borderRadius: 7, padding: "7px 13px", fontSize: 12, color: "#1a2744", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Add</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}


// ── Gifts Section ─────────────────────────────────────────────────────────────
const OCCASION_TYPES = ["Birthday","Anniversary","Christmas","Mother's Day","Father's Day","Valentine's Day","Graduation","Wedding","Baby Shower","Hanukkah","Easter","Other"]
const GIFT_FREE_LIMIT = 15

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  const parts = dateStr.split("-")
  let target = new Date(today.getFullYear(), parseInt(parts[1])-1, parseInt(parts[2]))
  if (target < today) target.setFullYear(today.getFullYear()+1)
  return Math.ceil((target-today)/(1000*60*60*24))
}

function formatOccDate(dateStr) {
  if (!dateStr) return ""
  const parts = dateStr.split("-")
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return months[parseInt(parts[1])-1]+" "+parseInt(parts[2])
}

function GiftsSection({ people, celebrations, isPremium, calEvents }) {
  people = people || []
  celebrations = celebrations || []
  isPremium = isPremium || false
  calEvents = calEvents || []

  const [gifts, setGifts] = useState(function() {
    try { return JSON.parse(localStorage.getItem("af_gifts") || "[]") } catch { return [] }
  })
  const [view, setView] = useState("upcoming")
  const [activePerson, setActivePerson] = useState(null)
  const [activeOccasion, setActiveOccasion] = useState(null)
  const [addingPerson, setAddingPerson] = useState(false)
  const [addingOccasion, setAddingOccasion] = useState(false)
  const [addingGift, setAddingGift] = useState(false)
  const [newPerson, setNewPerson] = useState({ name: "", relation: "" })
  const [newOccasion, setNewOccasion] = useState({ type: "Birthday", date: "" })
  const [newGift, setNewGift] = useState({ item: "", cost: "", url: "", photo: "" })
  const [editingGift, setEditingGift] = useState(null)
  const [editGiftVal, setEditGiftVal] = useState({ item: "", cost: "", url: "", photo: "" })

  function gUid() { return Math.random().toString(36).slice(2,9) }

  function saveGifts(updated) {
    setGifts(updated)
    try { localStorage.setItem("af_gifts", JSON.stringify(updated)) } catch {}
  }

  const celebPeople = celebrations.map(function(c) {
    return { id: "celeb_" + c.id, name: c.name, relation: c.type.charAt(0).toUpperCase() + c.type.slice(1), fromCeleb: true, celebMonth: c.month, celebDay: c.day, celebYear: c.year }
  })

  const allPeople = [
    ...people.map(function(p) { return { id: p.id, name: p.name, relation: "Family", fromApp: true } }),
    ...celebPeople.filter(function(cp) { return !gifts.find(function(g) { return g.id === cp.id }) && !people.find(function(p) { return p.name === cp.name }) }),
    ...gifts.filter(function(g) { return !people.find(function(p) { return p.id === g.id }) })
  ]

  const atLimit = gifts.filter(function(g) { return !people.find(function(p) { return p.id === g.id }) }).length >= GIFT_FREE_LIMIT && !isPremium

  const upcoming = []
  gifts.forEach(function(person) {
    (person.occasions || []).forEach(function(occ) {
      if (occ.date) {
        const days = daysUntil(occ.date)
        const unbought = (occ.gifts || []).filter(function(g) { return !g.bought }).length
        upcoming.push({ personId: person.id, personName: person.name, occasion: occ, days, unbought })
      }
    })
  })
  upcoming.sort(function(a,b) { return (a.days??999)-(b.days??999) })
  const soonUpcoming = upcoming.filter(function(u) { return u.days !== null && u.days <= 60 })
  const totalSpent = gifts.reduce(function(sum,p) { return sum+(p.occasions||[]).reduce(function(s2,o) { return s2+(o.gifts||[]).filter(function(g){return g.bought&&g.cost}).reduce(function(s3,g){return s3+g.cost},0) },0) },0)
  const totalUnbought = gifts.reduce(function(sum,p) { return sum+(p.occasions||[]).reduce(function(s2,o) { return s2+(o.gifts||[]).filter(function(g){return !g.bought}).length },0) },0)

  function addPerson() {
    if (!newPerson.name.trim() || atLimit) return
    const entry = { id: gUid(), name: newPerson.name.trim(), relation: newPerson.relation.trim(), occasions: [] }
    saveGifts([...gifts, entry])
    setNewPerson({ name: "", relation: "" })
    setAddingPerson(false)
    setActivePerson(entry.id)
    setView("person")
  }

  function addOccasion(personId) {
    if (!newOccasion.type) return
    const occ = { id: gUid(), type: newOccasion.type, date: newOccasion.date, gifts: [] }
    const exists = gifts.find(function(p) { return p.id === personId })
    if (!exists) {
      const appP = people.find(function(p) { return p.id === personId })
      const celebP = celebPeople.find(function(p) { return p.id === personId })
      if (appP) saveGifts([...gifts, { id: personId, name: appP.name, relation: "Family", occasions: [occ] }])
      else if (celebP) saveGifts([...gifts, { id: personId, name: celebP.name, relation: celebP.relation, occasions: [occ] }])
    } else {
      saveGifts(gifts.map(function(p) { return p.id===personId ? {...p, occasions:[...(p.occasions||[]),occ]} : p }))
    }
    setNewOccasion({ type: "Birthday", date: "" })
    setAddingOccasion(false)
    setActiveOccasion(occ.id)
  }

  function addGiftItem(personId, occId) {
    if (!newGift.item.trim()) return
    const item = { id: gUid(), item: newGift.item.trim(), cost: newGift.cost ? parseFloat(newGift.cost) : null, url: newGift.url || "", photo: newGift.photo || "", bought: false }
    saveGifts(gifts.map(function(p) { return p.id===personId ? {...p, occasions:(p.occasions||[]).map(function(o) { return o.id===occId ? {...o, gifts:[...(o.gifts||[]),item]} : o })} : p }))
    setNewGift({ item: "", cost: "", url: "", photo: "" })
    setAddingGift(false)
  }

  function toggleBought(personId, occId, giftId) {
    saveGifts(gifts.map(function(p) { return p.id===personId ? {...p, occasions:(p.occasions||[]).map(function(o) { return o.id===occId ? {...o, gifts:(o.gifts||[]).map(function(g) { return g.id===giftId?{...g,bought:!g.bought}:g })} : o })} : p }))
  }

  function deleteGiftItem(personId, occId, giftId) {
    saveGifts(gifts.map(function(p) { return p.id===personId ? {...p, occasions:(p.occasions||[]).map(function(o) { return o.id===occId ? {...o, gifts:(o.gifts||[]).filter(function(g){return g.id!==giftId})} : o })} : p }))
  }

  function saveEditGift(personId, occId, giftId) {
    saveGifts(gifts.map(function(p) { return p.id===personId ? {...p, occasions:(p.occasions||[]).map(function(o) { return o.id===occId ? {...o, gifts:(o.gifts||[]).map(function(g) { return g.id===giftId?{...g,item:editGiftVal.item,cost:editGiftVal.cost?parseFloat(editGiftVal.cost):null,url:editGiftVal.url||"",photo:editGiftVal.photo||""}:g })} : o })} : p }))
    setEditingGift(null)
  }

  const currentPerson = gifts.find(function(p){return p.id===activePerson}) || (activePerson?allPeople.find(function(p){return p.id===activePerson}):null)
  const currentOccasion = currentPerson && currentPerson.occasions && currentPerson.occasions.find(function(o){return o.id===activeOccasion})

  const gS = {
    card:{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"12px 14px", marginBottom:10 },
    inp:{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(200,169,122,0.3)", borderRadius:8, padding:"8px 12px", fontSize:13, color:"#faf8f4", WebkitTextFillColor:"#faf8f4", caretColor:"#c8a97a", fontFamily:"DM Sans,sans-serif", outline:"none", boxSizing:"border-box" },
    btn:{ background:"#c8a97a", border:"none", borderRadius:8, padding:"8px 14px", fontSize:12, color:"#1a2744", fontFamily:"DM Sans,sans-serif", cursor:"pointer", fontWeight:600 },
    ghost:{ background:"rgba(255,255,255,0.06)", border:"none", borderRadius:8, padding:"8px 12px", fontSize:12, color:"rgba(250,248,244,0.5)", fontFamily:"DM Sans,sans-serif", cursor:"pointer" },
  }

  if (activeOccasion && currentPerson && currentOccasion) {
    const giftList = currentOccasion.gifts||[]
    const spent = giftList.filter(function(g){return g.bought&&g.cost}).reduce(function(s,g){return s+g.cost},0)
    const days = daysUntil(currentOccasion.date)
    return (
      <div>
        <button onClick={function(){setActiveOccasion(null)}} style={{...gS.ghost,marginBottom:16,fontSize:11}}>← Back</button>
        <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:20,fontWeight:600,color:"#faf8f4",marginBottom:2}}>{currentPerson.name}</div>
        <div style={{fontSize:12,color:"#c8a97a",fontFamily:"DM Sans,sans-serif",marginBottom:4}}>{currentOccasion.type}{currentOccasion.date?" · "+formatOccDate(currentOccasion.date):""}</div>
        {days!==null&&<div style={{fontSize:11,color:days<=14?"#c8834a":"rgba(250,248,244,0.4)",fontFamily:"DM Sans,sans-serif",marginBottom:16}}>{days===0?"Today!":days+" days away"}</div>}
        {spent>0&&<div style={{fontSize:11,color:"#7a9e8e",fontFamily:"DM Sans,sans-serif",marginBottom:12}}>${spent.toFixed(2)} spent</div>}
        <div style={{...gS.card,padding:0,overflow:"hidden",marginBottom:12}}>
          {giftList.length===0&&<div style={{padding:14,fontSize:12,color:"rgba(250,248,244,0.3)",fontFamily:"DM Sans,sans-serif"}}>No gift ideas yet</div>}
          {giftList.map(function(g){
            return (
              <div key={g.id} style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px"}}>
                  {g.photo&&<img src={g.photo} alt="" style={{width:44,height:44,borderRadius:6,objectFit:"cover",flexShrink:0,border:"1px solid rgba(255,255,255,0.1)"}}/>}
                  <div onClick={function(){toggleBought(currentPerson.id,currentOccasion.id,g.id)}} style={{width:20,height:20,borderRadius:5,border:"1.5px solid "+(g.bought?"#7a9e8e":"rgba(255,255,255,0.2)"),background:g.bought?"#7a9e8e":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",marginTop:2}}>
                    {g.bought&&<span style={{color:"#fff",fontSize:11}}>✓</span>}
                  </div>
                  {editingGift===g.id?(
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:6,marginBottom:6}}>
                        <input value={editGiftVal.item} onChange={function(e){setEditGiftVal(function(v){return{...v,item:e.target.value}})}} style={{...gS.inp,flex:2,padding:"4px 8px"}}/>
                        <input value={editGiftVal.cost} onChange={function(e){setEditGiftVal(function(v){return{...v,cost:e.target.value}})}} placeholder="$" style={{...gS.inp,flex:1,padding:"4px 8px"}}/>
                      </div>
                      <input value={editGiftVal.url||""} onChange={function(e){setEditGiftVal(function(v){return{...v,url:e.target.value}})}} placeholder="Link (optional)" style={{...gS.inp,marginBottom:6,padding:"4px 8px"}}/>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                        <label style={{fontSize:11,color:"rgba(250,248,244,0.45)",fontFamily:"DM Sans,sans-serif",cursor:"pointer",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(200,169,122,0.2)",borderRadius:6,padding:"4px 10px"}}>
                          📷 {editGiftVal.photo?"Change photo":"Add photo"}
                          <input type="file" accept="image/*" style={{display:"none"}} onChange={function(e){
                            var file=e.target.files[0]; if(!file)return
                            var reader=new FileReader()
                            reader.onload=function(ev){setEditGiftVal(function(v){return{...v,photo:ev.target.result}})}
                            reader.readAsDataURL(file)
                          }}/>
                        </label>
                        {editGiftVal.photo&&<button onClick={function(){setEditGiftVal(function(v){return{...v,photo:""}})}} style={{background:"none",border:"none",fontSize:11,color:"rgba(200,131,74,0.5)",cursor:"pointer",padding:"2px"}}>✕ remove</button>}
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={function(){saveEditGift(currentPerson.id,currentOccasion.id,g.id)}} style={{...gS.btn,padding:"4px 10px",fontSize:11}}>Save</button>
                        <button onClick={function(){setEditingGift(null)}} style={{...gS.ghost,padding:"4px 8px",fontSize:11}}>Cancel</button>
                      </div>
                    </div>
                  ):(
                    <React.Fragment>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,color:g.bought?"rgba(250,248,244,0.4)":"rgba(250,248,244,0.85)",fontFamily:"DM Sans,sans-serif",textDecoration:g.bought?"line-through":"none",wordBreak:"break-word"}}>{g.item}</div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:3,flexWrap:"wrap"}}>
                          {g.cost&&<span style={{fontSize:11,color:"rgba(250,248,244,0.4)",fontFamily:"DM Sans,sans-serif"}}>${g.cost.toFixed(2)}</span>}
                          {g.url&&<a href={g.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#6ba3c4",textDecoration:"none",display:"flex",alignItems:"center",gap:2}}>🔗 <span style={{textDecoration:"underline",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"inline-block",verticalAlign:"middle"}}>{g.url.replace(/^https?:\/\/(www\.)?/,"").split("/")[0]}</span></a>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:4,flexShrink:0}}>
                        <button onClick={function(){setEditingGift(g.id);setEditGiftVal({item:g.item,cost:g.cost?String(g.cost):"",url:g.url||"",photo:g.photo||""})}} style={{background:"none",border:"none",fontSize:11,color:"rgba(250,248,244,0.25)",cursor:"pointer",padding:"2px 4px"}}>✏️</button>
                        <button onClick={function(){deleteGiftItem(currentPerson.id,currentOccasion.id,g.id)}} style={{background:"none",border:"none",fontSize:11,color:"rgba(200,131,74,0.4)",cursor:"pointer",padding:"2px 4px"}}>✕</button>
                      </div>
                    </React.Fragment>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {addingGift?(
          <div style={{...gS.card,marginBottom:12}}>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input value={newGift.item} onChange={function(e){setNewGift(function(v){return{...v,item:e.target.value}})}} onKeyDown={function(e){if(e.key==="Enter")addGiftItem(currentPerson.id,currentOccasion.id)}} placeholder="Gift idea..." autoFocus style={{...gS.inp,flex:2}}/>
              <input value={newGift.cost} onChange={function(e){setNewGift(function(v){return{...v,cost:e.target.value}})}} placeholder="$" type="number" style={{...gS.inp,flex:1}}/>
            </div>
            <input value={newGift.url} onChange={function(e){setNewGift(function(v){return{...v,url:e.target.value}})}} placeholder="Link / URL (optional)" style={{...gS.inp,marginBottom:8}}/>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <label style={{fontSize:12,color:"rgba(250,248,244,0.5)",fontFamily:"DM Sans,sans-serif",cursor:"pointer",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(200,169,122,0.2)",borderRadius:7,padding:"7px 14px",display:"flex",alignItems:"center",gap:6}}>
                📷 {newGift.photo?"Photo added ✓":"Add photo"}
                <input type="file" accept="image/*" style={{display:"none"}} onChange={function(e){
                  var file=e.target.files[0]; if(!file)return
                  var reader=new FileReader()
                  reader.onload=function(ev){setNewGift(function(v){return{...v,photo:ev.target.result}})}
                  reader.readAsDataURL(file)
                }}/>
              </label>
              {newGift.photo&&(
                <React.Fragment>
                  <img src={newGift.photo} alt="" style={{width:36,height:36,borderRadius:5,objectFit:"cover",border:"1px solid rgba(200,169,122,0.3)"}}/>
                  <button onClick={function(){setNewGift(function(v){return{...v,photo:""}})}} style={{background:"none",border:"none",fontSize:11,color:"rgba(200,131,74,0.5)",cursor:"pointer"}}>✕</button>
                </React.Fragment>
              )}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={function(){addGiftItem(currentPerson.id,currentOccasion.id)}} style={gS.btn}>Add gift</button>
              <button onClick={function(){setAddingGift(false);setNewGift({item:"",cost:"",url:"",photo:""})}} style={gS.ghost}>Cancel</button>
            </div>
          </div>
        ):(
          <button onClick={function(){setAddingGift(true)}} style={{width:"100%",padding:10,background:"rgba(200,169,122,0.08)",border:"1px solid rgba(200,169,122,0.2)",borderRadius:8,fontSize:12,color:"#c8a97a",fontFamily:"DM Sans,sans-serif",cursor:"pointer",marginBottom:12}}>+ Add gift idea</button>
        )}
      </div>
    )
  }

  if (activePerson && currentPerson) {
    const personData = gifts.find(function(p){return p.id===activePerson})
    const occasions = (personData && personData.occasions) || []
    const celebSource = celebPeople.find(function(p){return p.id===activePerson})
    // Build a suggested date string from celeb data if available
    var celebSuggestedDate = ""
    if (celebSource && celebSource.celebMonth && celebSource.celebDay) {
      var yr = celebSource.celebYear ? celebSource.celebYear : new Date().getFullYear()
      celebSuggestedDate = yr + "-" + String(celebSource.celebMonth).padStart(2,"0") + "-" + String(celebSource.celebDay).padStart(2,"0")
    }
    return (
      <div>
        <button onClick={function(){setActivePerson(null);setView("people")}} style={{...gS.ghost,marginBottom:16,fontSize:11}}>← Back</button>
        <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:20,fontWeight:600,color:"#faf8f4",marginBottom:2}}>{currentPerson.name}</div>
        <div style={{fontSize:11,color:"rgba(250,248,244,0.4)",fontFamily:"DM Sans,sans-serif",marginBottom:16}}>{currentPerson.relation}</div>
        {celebSource && occasions.length===0 && (
          <div style={{background:"rgba(200,169,122,0.08)",border:"1px solid rgba(200,169,122,0.2)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"rgba(250,248,244,0.6)",fontFamily:"DM Sans,sans-serif"}}>
            🎂 From your Celebrations list — tap <span style={{color:"#c8a97a",fontWeight:600}}>+ Add occasion</span> below to start tracking gifts for their birthday.
          </div>
        )}
        {occasions.length===0&&<div style={{fontSize:12,color:"rgba(250,248,244,0.3)",fontFamily:"DM Sans,sans-serif",marginBottom:16}}>No occasions yet</div>}
        {occasions.map(function(occ){
          const days=daysUntil(occ.date)
          const unbought=(occ.gifts||[]).filter(function(g){return !g.bought}).length
          const bought=(occ.gifts||[]).filter(function(g){return g.bought}).length
          return (
            <div key={occ.id} onClick={function(){setActiveOccasion(occ.id)}} style={{...gS.card,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:"#faf8f4",fontFamily:"DM Sans,sans-serif"}}>{occ.type}</div>
                <div style={{fontSize:11,color:"rgba(250,248,244,0.4)",marginTop:2}}>{occ.date?formatOccDate(occ.date):"No date"}{days!==null&&days<=30?<span style={{color:days<=7?"#c8834a":"#c8a97a",marginLeft:6}}>· {days===0?"Today!":days+"d"}</span>:null}</div>
                {(occ.gifts||[]).length>0&&<div style={{fontSize:10,color:"rgba(250,248,244,0.3)",marginTop:3}}>{bought>0?bought+" bought":""}{bought>0&&unbought>0?" · ":""}{unbought>0?unbought+" to get":""}</div>}
              </div>
              {unbought>0&&<span style={{background:"#c8834a",color:"#fff",fontSize:9,borderRadius:8,padding:"2px 6px",fontWeight:700}}>{unbought}</span>}
              <span style={{fontSize:12,color:"rgba(200,169,122,0.35)"}}>→</span>
            </div>
          )
        })}
        {addingOccasion?(
          <div style={gS.card}>
            <select value={newOccasion.type} onChange={function(e){setNewOccasion(function(v){return{...v,type:e.target.value}})}} style={{...gS.inp,marginBottom:8}}>
              {OCCASION_TYPES.map(function(t){return <option key={t} value={t}>{t}</option>})}
            </select>
            <input type="date" value={newOccasion.date} onChange={function(e){setNewOccasion(function(v){return{...v,date:e.target.value}})}} style={{...gS.inp,marginBottom:10}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={function(){addOccasion(activePerson)}} style={gS.btn}>Add occasion</button>
              <button onClick={function(){setAddingOccasion(false)}} style={gS.ghost}>Cancel</button>
            </div>
          </div>
        ):(
          <button onClick={function(){ setAddingOccasion(true); if(celebSuggestedDate) setNewOccasion({ type: "Birthday", date: celebSuggestedDate }) }} style={{width:"100%",padding:10,background:"rgba(200,169,122,0.08)",border:"1px solid rgba(200,169,122,0.2)",borderRadius:8,fontSize:12,color:"#c8a97a",fontFamily:"DM Sans,sans-serif",cursor:"pointer"}}>+ Add occasion</button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:22,fontWeight:600,color:"#faf8f4",marginBottom:4}}>Gifts & Occasions</div>
      <div style={{fontSize:12,color:"rgba(250,248,244,0.42)",fontFamily:"DM Sans,sans-serif",marginBottom:16,lineHeight:1.5}}>Track gift ideas for everyone you care about.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
        {[{num:soonUpcoming.length,lbl:"coming up",alert:soonUpcoming.length>0},{num:totalUnbought,lbl:"to buy",alert:totalUnbought>0},{num:"$"+totalSpent.toFixed(0),lbl:"spent",alert:false}].map(function(s,i){
          return (
            <div key={i} style={{background:s.alert?"rgba(200,131,74,0.06)":"rgba(122,158,142,0.06)",border:"1px solid "+(s.alert?"rgba(200,131,74,0.28)":"rgba(122,158,142,0.25)"),borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:20,fontWeight:700,color:s.alert?"#c8834a":"#7a9e8e",lineHeight:1}}>{s.num}</div>
              <div style={{fontSize:9,color:"rgba(250,248,244,0.4)",marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:"DM Sans,sans-serif"}}>{s.lbl}</div>
            </div>
          )
        })}
      </div>
      <div style={{display:"flex",borderBottom:"0.5px solid rgba(255,255,255,0.08)",marginBottom:16}}>
        {["upcoming","people"].map(function(t){
          return (
            <div key={t} onClick={function(){setView(t)}} style={{padding:"7px 14px",fontSize:11,cursor:"pointer",borderBottom:view===t?"2px solid #c8a97a":"2px solid transparent",color:view===t?"#c8a97a":"rgba(250,248,244,0.35)",fontFamily:"DM Sans,sans-serif",textTransform:"capitalize"}}>
              {t==="upcoming"?"Upcoming":"All People"}
            </div>
          )
        })}
      </div>
      {view==="upcoming"&&(
        <div>
          {soonUpcoming.length===0&&<div style={{fontSize:12,color:"rgba(250,248,244,0.3)",fontFamily:"DM Sans,sans-serif",padding:"20px 0",textAlign:"center"}}>No occasions in the next 60 days</div>}
          {soonUpcoming.map(function(u,i){
            return (
              <div key={i} onClick={function(){setActivePerson(u.personId);setActiveOccasion(u.occasion.id)}} style={{...gS.card,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:36,height:36,borderRadius:8,background:u.days<=7?"rgba(200,131,74,0.2)":"rgba(200,169,122,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                  {u.occasion.type==="Birthday"?"🎂":u.occasion.type==="Anniversary"?"💍":u.occasion.type==="Christmas"?"🎄":"🎁"}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,color:"#faf8f4",fontFamily:"DM Sans,sans-serif"}}>{u.personName} — {u.occasion.type}</div>
                  <div style={{fontSize:11,color:u.days<=7?"#c8834a":"rgba(250,248,244,0.4)",marginTop:2}}>{formatOccDate(u.occasion.date)} · {u.days===0?"Today!":u.days+" days away"}</div>
                  {u.unbought>0&&<div style={{fontSize:10,color:"#c8834a",marginTop:2}}>{u.unbought} gift{u.unbought>1?"s":""} to buy</div>}
                </div>
                <span style={{fontSize:12,color:"rgba(200,169,122,0.35)"}}>→</span>
              </div>
            )
          })}
        </div>
      )}
      {view==="people"&&(
        <div>
          {allPeople.map(function(person){
            const personData=gifts.find(function(p){return p.id===person.id})
            const totalOcc=(personData&&personData.occasions||[]).length
            const nextOcc=(personData&&personData.occasions||[]).filter(function(o){return o.date&&daysUntil(o.date)!==null}).sort(function(a,b){return daysUntil(a.date)-daysUntil(b.date)})[0]
            const days=nextOcc?daysUntil(nextOcc.date):null
            return (
              <div key={person.id} onClick={function(){setActivePerson(person.id);setView("person")}} style={{...gS.card,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(200,169,122,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#c8a97a",fontFamily:"DM Sans,sans-serif",fontWeight:700,flexShrink:0}}>{person.name[0]}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:13,fontWeight:500,color:"#faf8f4",fontFamily:"DM Sans,sans-serif"}}>{person.name}</span>
                    {person.fromCeleb && totalOcc===0 && <span style={{fontSize:9,background:"rgba(200,169,122,0.15)",color:"#c8a97a",borderRadius:4,padding:"1px 5px",fontFamily:"DM Sans,sans-serif",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>from celebrations</span>}
                  </div>
                  <div style={{fontSize:11,color:"rgba(250,248,244,0.4)",marginTop:2}}>{totalOcc===0?"No occasions added":totalOcc+" occasion"+(totalOcc>1?"s":"")}{days!==null&&days<=30?<span style={{color:days<=7?"#c8834a":"#c8a97a",marginLeft:6}}>· next in {days}d</span>:null}</div>
                </div>
                <span style={{fontSize:12,color:"rgba(200,169,122,0.35)"}}>→</span>
              </div>
            )
          })}
          {addingPerson?(
            <div style={gS.card}>
              <input value={newPerson.name} onChange={function(e){setNewPerson(function(v){return{...v,name:e.target.value}})}} placeholder="Name" autoFocus style={{...gS.inp,marginBottom:8}}/>
              <input value={newPerson.relation} onChange={function(e){setNewPerson(function(v){return{...v,relation:e.target.value}})}} placeholder="Relationship (e.g. Mom, Friend)" style={{...gS.inp,marginBottom:10}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={addPerson} style={gS.btn}>Add person</button>
                <button onClick={function(){setAddingPerson(false)}} style={gS.ghost}>Cancel</button>
              </div>
            </div>
          ):(
            <button onClick={function(){if(!atLimit)setAddingPerson(true)}} style={{width:"100%",padding:10,background:atLimit?"rgba(255,255,255,0.03)":"rgba(200,169,122,0.08)",border:"1px solid "+(atLimit?"rgba(255,255,255,0.08)":"rgba(200,169,122,0.2)"),borderRadius:8,fontSize:12,color:atLimit?"rgba(250,248,244,0.25)":"#c8a97a",fontFamily:"DM Sans,sans-serif",cursor:atLimit?"default":"pointer"}}>
              {atLimit?"Free limit reached — upgrade for more":"+ Add person"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function GiftsAndCelebrations({ calEvents }) {
  calEvents = calEvents || []
  return <CelebrationsSection calEvents={calEvents} />
}

// ── Pets Section ──────────────────────────────────────────────────────────────
const VACCINE_LIST = ["Rabies","DHPP/DA2PP","Bordetella","Leptospirosis","Lyme","Canine Influenza","FVRCP","FeLV","Other"]
const PET_TYPES = ["Dog","Cat","Bird","Rabbit","Fish","Reptile","Other"]

function PetsSection() {
  const [pets, setPets] = useState(function() {
    try { return JSON.parse(localStorage.getItem("af_pets") || "[]") } catch { return [] }
  })
  const [activePetId, setActivePetId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newPetForm, setNewPetForm] = useState({ name: "", type: "Dog", breed: "", color: "", dob: "", photo: null })
  const [addingVaccine, setAddingVaccine] = useState(false)
  const [vaccineForm, setVaccineForm] = useState({ name: "Rabies", date: "", due: "", vet: "", notes: "" })
  const [addingMed, setAddingMed] = useState(false)
  const [medForm, setMedForm] = useState({ name: "", dose: "", freq: "", refill: "", notes: "" })
  const [editingField, setEditingField] = useState(null)
  const [editVal, setEditVal] = useState("")
  const [addingDoc, setAddingDoc] = useState(false)
  const docInputRef = React.useRef(null)

  function save(updated) {
    setPets(updated)
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

  function addVaccine(petId) {
    if (!vaccineForm.name) return
    const v = { id: Date.now().toString(), ...vaccineForm }
    updatePet(petId, { vaccines: [...(activePet.vaccines||[]), v] })
    setVaccineForm({ name: "Rabies", date: "", due: "", vet: "", notes: "" })
    setAddingVaccine(false)
  }

  function addMed(petId) {
    if (!medForm.name.trim()) return
    const m = { id: Date.now().toString(), ...medForm }
    updatePet(petId, { medications: [...(activePet.medications||[]), m] })
    setMedForm({ name: "", dose: "", freq: "", refill: "", notes: "" })
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

  const now = new Date()
  function petDaysUntil(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return Math.round((d - now) / 86400000)
  }

  const navy = "#1a2744"; const sand = "#c8a97a"; const warm = "#faf8f4"
  const muted = "rgba(250,248,244,0.42)"; const border = "rgba(255,255,255,0.08)"; const cardBg = "rgba(255,255,255,0.04)"
  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: warm, fontFamily: "DM Sans,sans-serif", outline: "none", boxSizing: "border-box" }
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
            <button onClick={function() { setAdding(false) }} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: muted, cursor: "pointer" }}>Cancel</button>
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
                    <input value={editVal} onChange={function(e) { setEditVal(e.target.value) }} onBlur={function() { updatePet(activePet.id, { tags: {...tags, [f.key]: editVal} }); setEditingField(null) }} autoFocus style={{...inputStyle, padding: "4px 8px", fontSize: 12}} />
                  ) : (
                    <div style={{ fontSize: 13, color: tags[f.key] ? warm : "rgba(250,248,244,0.2)", fontFamily: "DM Sans,sans-serif", fontStyle: tags[f.key] ? "normal" : "italic" }}>{tags[f.key] || "Not set"}</div>
                  )}
                </div>
                <button onClick={function() { setEditingField(f.key); setEditVal(tags[f.key]||"") }} style={{ background: "rgba(200,169,122,0.1)", border: "1px solid rgba(200,169,122,0.2)", borderRadius: 6, padding: "3px 9px", fontSize: 10, color: sand, fontFamily: "DM Sans,sans-serif", cursor: "pointer" }}>edit</button>
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
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={function() { addVaccine(activePet.id) }} style={{ flex: 1, background: sand, border: "none", borderRadius: 7, padding: "7px", fontSize: 12, color: navy, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Save</button>
              <button onClick={function() { setAddingVaccine(false) }} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: muted, cursor: "pointer" }}>Cancel</button>
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
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input type="date" value={medForm.refill} onChange={function(e) { setMedForm(function(p){return{...p,refill:e.target.value}}) }} style={{...inputStyle, flex:1}} />
              <input value={medForm.notes} onChange={function(e) { setMedForm(function(p){return{...p,notes:e.target.value}}) }} placeholder="Notes" style={{...inputStyle, flex:1}} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={function() { addMed(activePet.id) }} style={{ flex: 1, background: sand, border: "none", borderRadius: 7, padding: "7px", fontSize: 12, color: navy, fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: 700 }}>Save</button>
              <button onClick={function() { setAddingMed(false) }} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 12, color: muted, cursor: "pointer" }}>Cancel</button>
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


// ── Career Section ────────────────────────────────────────────────────────────
var CAREER_GOLD  = "#c8a97a"
var CAREER_NAVY  = "#1a2744"
var CAREER_SURF  = "rgba(255,255,255,0.05)"
var CAREER_SURF2 = "rgba(255,255,255,0.04)"
var CAREER_BORD  = "0.5px solid rgba(255,255,255,0.1)"
var CAREER_BORD2 = "0.5px solid rgba(255,255,255,0.08)"
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
function cSaveCareer(v) { try { localStorage.setItem("af_career",JSON.stringify(v)); } catch(e){} }
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
    React.createElement("div",{style:{background:"#1e2e52",border:CAREER_BORD,borderRadius:14,padding:"1.25rem 1.5rem",width:"min(480px,calc(100vw - 68px - 2rem))",maxHeight:"85dvh",overflowY:"auto",WebkitOverflowScrolling:"touch"},onClick:function(e){e.stopPropagation();}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}},
        React.createElement("span",{style:{color:CAREER_WHITE,fontSize:15,fontWeight:600}},props.title),
        React.createElement("button",{onClick:props.onClose,style:{background:"none",border:"none",color:"rgba(250,248,244,0.4)",cursor:"pointer",fontSize:18}},"✕")),
      props.children))
}
var C_INP_STYLE = {width:"100%",background:"rgba(255,255,255,0.07)",border:CAREER_BORD,borderRadius:8,padding:"0.5rem 0.7rem",color:CAREER_WHITE,WebkitTextFillColor:CAREER_WHITE,caretColor:CAREER_GOLD,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}
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
            return React.createElement("div",{key:h.id,style:{background:"rgba(255,255,255,0.04)",border:CAREER_BORD,borderRadius:10,overflow:"hidden"}},
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
                  React.createElement("button",{onClick:function(e){e.stopPropagation();removeJob(h.id)},style:{fontSize:11,color:"rgba(250,248,244,0.3)",background:"rgba(255,255,255,0.04)",border:CAREER_BORD2,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit"}},"Remove")
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
                  React.createElement("button",{onClick:function(){setEditingJob(null)},style:{background:"rgba(255,255,255,0.06)",border:CAREER_BORD2,borderRadius:7,padding:"7px 12px",fontSize:12,color:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"inherit"}},"Cancel")
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
                job.notes&&React.createElement("div",{style:{fontSize:12,color:"rgba(250,248,244,0.45)",marginTop:3,lineHeight:1.5}}),job.url&&React.createElement("a",{href:job.url,target:"_blank",rel:"noreferrer",style:{fontSize:11,color:CAREER_GOLD,display:"block",marginTop:2}},"View posting →")),
              React.createElement("div",{style:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}},
                React.createElement("select",{value:job.status,onChange:function(e){updateStatus(job.id,e.target.value);},style:{fontSize:11,background:"rgba(30,46,82,0.95)",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"2px 6px",color:STATUS_COLORS[job.status]||CAREER_GOLD,fontFamily:"inherit",cursor:"pointer"}},JOB_STATUSES.map(function(s){return React.createElement("option",{key:s,value:s},s)})),
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
  } catch(e) {}
}

function cRemoveGoalFromCalendar(goalId) {
  try {
    var events = JSON.parse(localStorage.getItem("af_calEvents") || "[]")
    localStorage.setItem("af_calEvents", JSON.stringify(events.filter(function(e){ return e.id !== "career_goal_"+goalId })))
  } catch(e) {}
}

function CGoalsTab({ pid, career, setCareer, personName }) {
  var goals = (career[pid]||{}).goals || []
  var s0=useState(false); var adding=s0[0]; var setAdding=s0[1];
  var s1=useState({goal:"",area:"Career growth",targetDate:"",notes:"",done:false}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(null); var editingId=s2[0]; var setEditingId=s2[1];
  var s3=useState({goal:"",area:"Career growth",targetDate:"",notes:""}); var editForm=s3[0]; var setEditForm=s3[1];

  function save() {
    if(!form.goal.trim()) return
    var item = {id:cuid(),goal:form.goal,area:form.area,targetDate:form.targetDate,notes:form.notes,done:false,addedAt:new Date().toISOString().split("T")[0]}
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,goals:[...(p.goals||[]),item]}}})
    if(form.targetDate) cWriteGoalToCalendar(item, personName)
    setForm({goal:"",area:"Career growth",targetDate:"",notes:"",done:false}); setAdding(false)
  }
  function toggle(id) {
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,goals:(p.goals||[]).map(function(g){return g.id===id?Object.assign({},g,{done:!g.done}):g})}}})
  }
  function remove(id) {
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,goals:(p.goals||[]).filter(function(g){return g.id!==id})}}})
    cRemoveGoalFromCalendar(id)
  }
  function startEdit(g) {
    setEditingId(g.id)
    setEditForm({goal:g.goal||"",area:g.area||"Career growth",targetDate:g.targetDate||"",notes:g.notes||""})
  }
  function saveEdit() {
    var updated = null
    setCareer(function(c){
      var p=c[pid]||{}
      var newGoals = (p.goals||[]).map(function(g){
        if(g.id!==editingId) return g
        updated = Object.assign({},g,editForm)
        return updated
      })
      return Object.assign({},c,{[pid]:Object.assign({},p,{goals:newGoals})})
    })
    if(editForm.targetDate) setTimeout(function(){ cWriteGoalToCalendar(Object.assign({id:editingId},editForm), personName) }, 100)
    else cRemoveGoalFromCalendar(editingId)
    setEditingId(null)
  }

  function daysUntilDate(d) {
    if(!d) return null
    var now=new Date(); now.setHours(0,0,0,0)
    var target=new Date(d+"T00:00:00")
    return Math.round((target-now)/86400000)
  }
  function fmtDate(d) {
    if(!d) return ""
    var parts=d.split("-"); var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    return months[parseInt(parts[1])-1]+" "+parseInt(parts[2])+", "+parts[0]
  }

  var active=goals.filter(function(g){return !g.done})
  var done=goals.filter(function(g){return g.done})

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"}},
    React.createElement("button",{onClick:function(){setAdding(true)},style:{width:"100%",background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:10,padding:"0.6rem",color:CAREER_GOLD,fontSize:13,fontFamily:"inherit",cursor:"pointer",fontWeight:600}},"+ Add a goal"),

    active.length===0&&done.length===0?React.createElement(CEmpty,{text:"No goals yet — what are you working toward?"}):
      React.createElement("div",null,
        active.length>0&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:8}},
          active.map(function(g){
            var days = daysUntilDate(g.targetDate)
            var isEditing = editingId===g.id
            return React.createElement("div",{key:g.id,style:{background:CAREER_SURF,border:CAREER_BORD,borderRadius:10,overflow:"hidden"}},
              !isEditing&&React.createElement("div",{style:{padding:"10px 12px"}},
                React.createElement("div",{style:{display:"flex",alignItems:"flex-start",gap:10}},
                  React.createElement("button",{onClick:function(){toggle(g.id)},style:{width:18,height:18,borderRadius:4,border:"1.5px solid rgba(200,169,122,0.4)",background:"none",cursor:"pointer",flexShrink:0,marginTop:2}}),
                  React.createElement("div",{style:{flex:1,minWidth:0}},
                    React.createElement("div",{style:{fontSize:13,color:CAREER_WHITE,fontWeight:600,lineHeight:1.4}}),g.goal,
                    React.createElement("div",{style:{fontSize:11,color:CAREER_GOLD,marginTop:3}}),g.area,
                    g.targetDate&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginTop:4}},
                      React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.5)"}},"📅 "+fmtDate(g.targetDate)),
                      days!==null&&React.createElement("span",{style:{fontSize:10,fontWeight:700,color:days<0?"rgba(250,248,244,0.3)":days<=14?"#c8834a":CAREER_GOLD,background:days<0?"rgba(255,255,255,0.04)":days<=14?"rgba(200,131,74,0.1)":"rgba(200,169,122,0.1)",borderRadius:8,padding:"1px 7px"}},days<0?"passed":days===0?"Today!":days+"d away")
                    ),
                    g.targetDate&&React.createElement("div",{style:{fontSize:10,color:"rgba(122,158,142,0.7)",marginTop:3}},"\u2713 Added to calendar · Ripple will remind you")
                  ),
                  React.createElement("div",{style:{display:"flex",gap:4,flexShrink:0}},
                    React.createElement("button",{onClick:function(){startEdit(g)},style:{background:"none",border:"none",fontSize:12,color:"rgba(200,169,122,0.4)",cursor:"pointer",padding:"2px 4px"}},"✏️"),
                    React.createElement("button",{onClick:function(){remove(g.id)},style:{background:"none",border:"none",fontSize:12,color:"rgba(250,248,244,0.2)",cursor:"pointer",padding:"2px 4px"}},"✕")
                  )
                ),
                g.notes&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.45)",lineHeight:1.5,margin:"6px 0 0",paddingLeft:28}}),g.notes
              ),
              isEditing&&React.createElement("div",{style:{padding:"12px"}},
                React.createElement("input",{value:editForm.goal,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{goal:e.target.value})})},placeholder:"Goal",style:Object.assign({},C_INP_STYLE,{marginBottom:8})}),
                React.createElement("select",{value:editForm.area,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{area:e.target.value})})},style:Object.assign({},C_INP_STYLE,{marginBottom:8,background:"rgba(30,46,82,0.95)"})},
                  GOAL_AREAS.map(function(a){return React.createElement("option",{key:a,value:a},a)})
                ),
                React.createElement("div",{style:{marginBottom:8}},
                  React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},"Target date"),
                  React.createElement("input",{type:"date",value:editForm.targetDate,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{targetDate:e.target.value})})},style:C_INP_STYLE})
                ),
                React.createElement("textarea",{value:editForm.notes,onChange:function(e){setEditForm(function(f){return Object.assign({},f,{notes:e.target.value})})},placeholder:"Notes…",rows:2,style:Object.assign({},C_INP_STYLE,{resize:"vertical",marginBottom:8})}),
                React.createElement("div",{style:{display:"flex",gap:8}},
                  React.createElement("button",{onClick:saveEdit,style:{flex:1,background:CAREER_GOLD,color:CAREER_NAVY,border:"none",borderRadius:7,padding:"7px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}},"Save"),
                  React.createElement("button",{onClick:function(){setEditingId(null)},style:{background:"rgba(255,255,255,0.06)",border:CAREER_BORD2,borderRadius:7,padding:"7px 12px",fontSize:12,color:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"inherit"}},"Cancel")
                )
              )
            )
          })
        ),
        done.length>0&&React.createElement("div",{style:{marginTop:"0.5rem"}},
          React.createElement("div",{style:{fontSize:10,color:"rgba(250,248,244,0.3)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}},"Achieved ("+done.length+")"),
          done.map(function(g){return React.createElement("div",{key:g.id,style:{display:"flex",alignItems:"center",gap:8,padding:"0.35rem 0",opacity:0.5}},
            React.createElement("span",{style:{fontSize:12,color:CAREER_GOLD,cursor:"pointer"},onClick:function(){toggle(g.id)}},"✓"),
            React.createElement("span",{style:{fontSize:12,color:CAREER_WHITE,textDecoration:"line-through"}}),g.goal,
            React.createElement("button",{onClick:function(){remove(g.id)},style:{background:"none",border:"none",fontSize:11,color:"rgba(250,248,244,0.2)",cursor:"pointer",marginLeft:"auto",padding:0}},"✕")
          )})
        )
      ),

    adding&&React.createElement(CModal,{title:"Add a career goal",onClose:function(){setAdding(false);}},
      React.createElement(CInput,{label:"Goal",value:form.goal,onChange:function(v){setForm(function(f){return Object.assign({},f,{goal:v})});},placeholder:"e.g. Lead my first product launch"}),
      React.createElement(CSelect,{label:"Area",value:form.area,onChange:function(v){setForm(function(f){return Object.assign({},f,{area:v})});},options:GOAL_AREAS.map(function(a){return{value:a,label:a}})}),
      React.createElement("div",{style:{marginBottom:"0.7rem"}},
        React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},"Target date (adds to your calendar)"),
        React.createElement("input",{type:"date",value:form.targetDate,onChange:function(e){setForm(function(f){return Object.assign({},f,{targetDate:e.target.value})})},style:C_INP_STYLE})
      ),
      form.targetDate&&React.createElement("div",{style:{fontSize:11,color:"rgba(122,158,142,0.8)",background:"rgba(122,158,142,0.08)",borderRadius:7,padding:"6px 10px",marginBottom:"0.7rem"}},"\u2713 This goal will appear on your calendar and Ripple will remind you as the date approaches."),
      React.createElement(CTextarea,{label:"Notes",value:form.notes,onChange:function(v){setForm(function(f){return Object.assign({},f,{notes:v})});},placeholder:"What does success look like? What's in the way?",rows:3}),
      React.createElement(CSaveBtn,{onClick:save})))
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
      window.open(doc.url,"_blank","noreferrer")
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
        React.createElement("label",{style:{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.05)",border:form.file?"0.5px solid rgba(122,158,142,0.4)":"0.5px dashed rgba(255,255,255,0.2)",borderRadius:10,padding:"12px 14px",cursor:"pointer"}},
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
        React.createElement("div",{style:{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}),
        React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.3)"}},"or"),
        React.createElement("div",{style:{flex:1,height:1,background:"rgba(255,255,255,0.1)"}})
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

  var CSURF="rgba(255,255,255,0.05)";
  var CSURF2="rgba(255,255,255,0.04)";
  var CBORD2="0.5px solid rgba(255,255,255,0.08)";
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
                  React.createElement("span",{style:{fontSize:11,padding:"1px 7px",borderRadius:10,background:"rgba(255,255,255,0.06)",color:STATUS_COLOR[j.status]||"rgba(250,248,244,0.4)",border:"0.5px solid rgba(255,255,255,0.1)",whiteSpace:"nowrap"}},j.status||"—")
                );
              })
            )
          );
        }),
        // add card
        React.createElement("div",{onClick:function(){setAddingPerson(true);},style:{background:"rgba(255,255,255,0.02)",border:"0.5px dashed rgba(255,255,255,0.15)",borderRadius:12,minHeight:60,display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}},
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
      React.createElement("button",{onClick:function(){setDetail(null);},style:{background:"rgba(255,255,255,0.06)",border:CAREER_BORD,borderRadius:8,padding:"5px 10px",fontSize:12,color:"rgba(250,248,244,0.5)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"\u2190 All"),
      React.createElement("div",{style:{width:28,height:28,borderRadius:"50%",background:person.color||CAREER_GOLD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:CAREER_NAVY,flexShrink:0}},initials),
      React.createElement("span",{style:{fontSize:15,fontWeight:500,color:CAREER_WHITE,flex:1}},person.name),
      personIdx>0&&React.createElement("button",{onClick:function(){removePerson(personIdx);},style:{background:"none",border:"none",fontSize:12,color:"rgba(250,248,244,0.25)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Remove")
    ),
    // subtabs
    React.createElement("div",{style:{display:"flex",borderBottom:"0.5px solid rgba(255,255,255,0.08)",background:"rgba(0,0,0,0.15)",overflowX:"auto",flexShrink:0}},
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
var HNAVY  = "#1a2744"
var HSURF  = "rgba(255,255,255,0.05)"
var HSURF2 = "rgba(255,255,255,0.04)"
var HBORD  = "0.5px solid rgba(255,255,255,0.1)"
var HBORD2 = "0.5px solid rgba(255,255,255,0.08)"

var HBADGE = {
  ok:      { bg:"rgba(99,153,34,0.15)",    color:"#97C459", border:"rgba(99,153,34,0.2)"    },
  due:     { bg:"rgba(239,159,39,0.12)",   color:"#EF9F27", border:"rgba(239,159,39,0.2)"   },
  rx:      { bg:"rgba(55,138,221,0.12)",   color:"#85B7EB", border:"rgba(55,138,221,0.2)"   },
  allergy: { bg:"rgba(216,90,48,0.12)",    color:"#F0997B", border:"rgba(216,90,48,0.2)"    },
  alive:   { bg:"rgba(99,153,34,0.12)",    color:"#97C459", border:"rgba(99,153,34,0.2)"    },
  deceased:{ bg:"rgba(136,135,128,0.12)",  color:"rgba(250,248,244,0.4)", border:"rgba(136,135,128,0.2)" },
  gray:    { bg:"rgba(255,255,255,0.06)",  color:"rgba(250,248,244,0.45)", border:"rgba(255,255,255,0.1)" },
}
var HPILL = {
  heart:    { bg:"rgba(216,90,48,0.1)",    color:"#F0997B", border:"rgba(216,90,48,0.2)"    },
  cancer:   { bg:"rgba(153,53,86,0.12)",   color:"#ED93B1", border:"rgba(153,53,86,0.2)"    },
  diabetes: { bg:"rgba(239,159,39,0.12)",  color:"#EF9F27", border:"rgba(239,159,39,0.2)"   },
  mental:   { bg:"rgba(127,119,221,0.12)", color:"#AFA9EC", border:"rgba(127,119,221,0.2)"  },
  neuro:    { bg:"rgba(29,158,117,0.12)",  color:"#5DCAA5", border:"rgba(29,158,117,0.2)"   },
  other:    { bg:"rgba(255,255,255,0.06)", color:"rgba(250,248,244,0.5)", border:"rgba(255,255,255,0.1)" },
}
var H_TABS = [
  { id:"history",   label:"Medical history" },
  { id:"immunize",  label:"Immunizations"   },
  { id:"meds",      label:"Medications"     },
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
function hGetPrivatePin() { try { return localStorage.getItem("af_health_pin")||null; } catch{return null;} }
function hSetPrivatePin(pin) { try { localStorage.setItem("af_health_pin",pin); } catch{} }

// HPrivateLock: wraps content behind a PIN gate. Set pin=null to prompt setup.
function HPrivateLock(props) {
  var storedPin=hGetPrivatePin();
  var s0=useState(false); var unlocked=s0[0]; var setUnlocked=s0[1];
  var s1=useState(""); var entered=s1[0]; var setEntered=s1[1];
  var s2=useState(""); var confirm=s2[0]; var setConfirm=s2[1];
  var s3=useState(false); var setting=s3[0]; var setSetting=s3[1];
  var s4=useState(null); var err=s4[0]; var setErr=s4[1];
  var inputStyle={width:"100%",background:"rgba(255,255,255,0.07)",border:HBORD,borderRadius:8,padding:"0.55rem 0.75rem",color:HWHITE,fontSize:18,letterSpacing:"0.4em",textAlign:"center",fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
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
    React.createElement("button",{onClick:function(){
      if(!entered.trim()){setErr("Please enter a PIN.");return;}
      if(entered!==confirm){setErr("PINs don't match.");return;}
      hSetPrivatePin(entered); setSetting(false); setUnlocked(true); setEntered(""); setConfirm("");
    },style:{background:HGOLD,color:HNAVY,border:"none",borderRadius:8,padding:"0.6rem 1.5rem",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",width:"100%"}},"Set PIN & unlock")
  );
  return React.createElement("div",{style:{textAlign:"center",padding:"1.5rem 0.5rem"}},
    React.createElement("div",{style:{fontSize:28,marginBottom:8}},"🔒"),
    React.createElement("div",{style:{fontSize:14,color:HWHITE,fontWeight:500,marginBottom:4}},"Private — my eyes only"),
    React.createElement("div",{style:{fontSize:12,color:"rgba(250,248,244,0.4)",marginBottom:16,lineHeight:1.5}})  ,
    React.createElement("div",{style:{marginBottom:14}},
      React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},"Enter PIN"),
      React.createElement("input",{type:"password",inputMode:"numeric",maxLength:8,autoFocus:true,value:entered,onKeyDown:function(e){if(e.key==="Enter"&&entered===storedPin){setUnlocked(true);setEntered("");setErr(null);}},onChange:function(e){setEntered(e.target.value);setErr(null);},style:inputStyle})
    ),
    err&&React.createElement("p",{style:{fontSize:12,color:"#f0997b",marginBottom:8}},err),
    React.createElement("div",{style:{display:"flex",gap:8}},
      React.createElement("button",{onClick:function(){
        if(entered===storedPin){setUnlocked(true);setEntered("");setErr(null);}
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
function hSavePeople(list) { try { localStorage.setItem("af_people", JSON.stringify(list)); } catch(e){} }
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
    React.createElement("div",{style:{background:"#1e2e52",border:HBORD,borderRadius:14,padding:"1.25rem 1.5rem",width:"min(480px,calc(100vw - 68px - 2rem))",maxHeight:"calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 2rem)",overflowY:"auto",WebkitOverflowScrolling:"touch"},onClick:function(e){e.stopPropagation();}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}},React.createElement("span",{style:{color:HWHITE,fontSize:15,fontWeight:500}},props.title),React.createElement("button",{onClick:props.onClose,style:{background:"none",border:"none",color:"rgba(250,248,244,0.4)",cursor:"pointer",fontSize:18}},"✕")),
      props.children
    )
  );
}
function HInput(props) {
  return React.createElement("div",{style:{marginBottom:"0.75rem"}},
    props.label&&React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},props.label),
    React.createElement("input",{type:props.type||"text",value:props.value,onChange:function(e){props.onChange(e.target.value);},placeholder:props.placeholder,style:{width:"100%",background:"rgba(255,255,255,0.07)",border:HBORD,borderRadius:8,padding:"0.55rem 0.75rem",color:HWHITE,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}})
  );
}
function HTextarea(props) {
  return React.createElement("div",{style:{marginBottom:"0.75rem"}},
    props.label&&React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},props.label),
    React.createElement("textarea",{value:props.value,onChange:function(e){props.onChange(e.target.value);},placeholder:props.placeholder,rows:props.rows||4,style:{width:"100%",background:"rgba(255,255,255,0.07)",border:HBORD,borderRadius:8,padding:"0.55rem 0.75rem",color:HWHITE,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box"}})
  );
}
function HSelect(props) {
  return React.createElement("div",{style:{marginBottom:"0.75rem"}},
    props.label&&React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},props.label),
    React.createElement("select",{value:props.value,onChange:function(e){props.onChange(e.target.value);},style:{width:"100%",background:"rgba(30,46,82,0.95)",border:HBORD,borderRadius:8,padding:"0.55rem 0.75rem",color:HWHITE,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}},
      props.options.map(function(o){return React.createElement("option",{key:o.value,value:o.value},o.label);})
    )
  );
}
function HSaveBtn(props) {
  return React.createElement("button",{onClick:props.onClick,style:{width:"100%",background:HGOLD,color:HNAVY,border:"none",borderRadius:8,padding:"0.6rem",fontWeight:700,fontSize:13,fontFamily:"inherit",cursor:"pointer"}},props.label||"Save");
}

function HHistoryTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({name:"",detail:"",status:"Stable"}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(null); var editId=s2[0]; var setEditId=s2[1];
  var items=(health[pid]&&health[pid].history)||[];
  var STATUS=["Stable","Managed","Active Rx","Monitoring","Resolved"].map(function(v){return{value:v,label:v};});
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
      items.map(function(it){return React.createElement(HItemRow,{key:it.id,name:it.name,detail:it.detail,badge:"ok",badgeLabel:it.status,onEdit:function(){startEdit(it);},onDelete:function(){remove(it.id);}});})),
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
  var s1=useState({name:"",date:"",status:"Up to date"}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(null); var editId=s2[0]; var setEditId=s2[1];
  var items=(health[pid]&&health[pid].immunizations)||[];
  var STATUS=["Up to date","Due soon","Overdue","Declined"].map(function(v){return{value:v,label:v};});
  function add(){
    if(!form.name.trim())return;
    var next=Object.assign({},health);if(!next[pid])next[pid]={};
    if(editId){
      next[pid].immunizations=(next[pid].immunizations||[]).map(function(x){return x.id===editId?Object.assign({},x,{name:form.name,date:form.date,status:form.status}):x;});
    } else {
      next[pid].immunizations=(next[pid].immunizations||[]).concat([{id:huid(),name:form.name,date:form.date,status:form.status}]);
    }
    setHealth(next);setForm({name:"",date:"",status:"Up to date"});setOpen(false);setEditId(null);
  }
  function startEdit(it){setForm({name:it.name,date:it.date||"",status:it.status||"Up to date"});setEditId(it.id);setOpen(true);}
  function remove(id){var next=Object.assign({},health);next[pid].immunizations=next[pid].immunizations.filter(function(x){return x.id!==id;});setHealth(next);}
  return React.createElement(React.Fragment,null,
    React.createElement(HCard,null,React.createElement(HCardHead,{icon:"💉",label:"Immunizations",onAdd:function(){setForm({name:"",date:"",status:"Up to date"});setEditId(null);setOpen(true);}}),
      items.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No immunizations added yet"),
      items.map(function(it){return React.createElement(HItemRow,{key:it.id,name:it.name,detail:it.date,badge:it.status==="Up to date"?"ok":"due",badgeLabel:it.status,onEdit:function(){startEdit(it);},onDelete:function(){remove(it.id);}});})),
    open&&React.createElement(HModal,{title:editId?"Edit immunization":"Add immunization",onClose:function(){setOpen(false);setEditId(null);}},
      React.createElement(HInput,{label:"Vaccine name",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. Flu shot"}),
      React.createElement(HInput,{label:"Date received",value:form.date,onChange:function(v){setForm(function(f){return Object.assign({},f,{date:v});});},placeholder:"e.g. Oct 2024"}),
      React.createElement(HSelect,{label:"Status",value:form.status,onChange:function(v){setForm(function(f){return Object.assign({},f,{status:v});});},options:STATUS}),
      React.createElement(HSaveBtn,{onClick:add,label:editId?"Save changes":"Add immunization"}))
  );
}
function HMedsTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({name:"",dose:"",frequency:"",type:"Rx"}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(null); var editId=s2[0]; var setEditId=s2[1];
  var items=(health[pid]&&health[pid].medications)||[];
  var TYPES=["Rx","OTC","Supplement","PRN"].map(function(v){return{value:v,label:v};});
  function add(){
    if(!form.name.trim())return;
    var next=Object.assign({},health);if(!next[pid])next[pid]={};
    if(editId){
      next[pid].medications=(next[pid].medications||[]).map(function(x){return x.id===editId?Object.assign({},x,{name:form.name,dose:form.dose,frequency:form.frequency,type:form.type}):x;});
    } else {
      next[pid].medications=(next[pid].medications||[]).concat([{id:huid(),name:form.name,dose:form.dose,frequency:form.frequency,type:form.type}]);
    }
    setHealth(next);setForm({name:"",dose:"",frequency:"",type:"Rx"});setOpen(false);setEditId(null);
  }
  function startEdit(it){setForm({name:it.name,dose:it.dose||"",frequency:it.frequency||"",type:it.type||"Rx"});setEditId(it.id);setOpen(true);}
  function remove(id){var next=Object.assign({},health);next[pid].medications=next[pid].medications.filter(function(x){return x.id!==id;});setHealth(next);}
  return React.createElement(React.Fragment,null,
    React.createElement(HCard,null,React.createElement(HCardHead,{icon:"💊",label:"Medications",onAdd:function(){setForm({name:"",dose:"",frequency:"",type:"Rx"});setEditId(null);setOpen(true);}}),
      items.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No medications added yet"),
      items.map(function(it){return React.createElement(HItemRow,{key:it.id,name:it.name,detail:[it.dose,it.frequency].filter(Boolean).join(" · "),badge:"rx",badgeLabel:it.type,onEdit:function(){startEdit(it);},onDelete:function(){remove(it.id);}});})),
    open&&React.createElement(HModal,{title:editId?"Edit medication":"Add medication",onClose:function(){setOpen(false);setEditId(null);}},
      React.createElement(HInput,{label:"Medication name",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. Albuterol"}),
      React.createElement(HInput,{label:"Dose",value:form.dose,onChange:function(v){setForm(function(f){return Object.assign({},f,{dose:v});});},placeholder:"e.g. 10mg"}),
      React.createElement(HInput,{label:"Frequency",value:form.frequency,onChange:function(v){setForm(function(f){return Object.assign({},f,{frequency:v});});},placeholder:"e.g. Daily, PRN"}),
      React.createElement(HSelect,{label:"Type",value:form.type,onChange:function(v){setForm(function(f){return Object.assign({},f,{type:v});});},options:TYPES}),
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
    (relatives.length>0||inheritedMaternalEntries.length>0)&&React.createElement(HCard,{style:{marginBottom:"0.9rem"}},React.createElement(HCardHead,{icon:"📊",label:"Hereditary risk summary"}),RISKS.filter(function(r){return riskMap[r.key];}).map(function(r){var pct=Math.round((riskMap[r.key]/maxCount)*100);return React.createElement("div",{key:r.key,style:{display:"flex",alignItems:"center",padding:"0.3rem 0",borderBottom:HBORD2}},React.createElement("span",{style:{fontSize:12,color:"rgba(250,248,244,0.65)",minWidth:130}},r.label),React.createElement("div",{style:{flex:1,margin:"0 12px",height:3,background:"rgba(255,255,255,0.07)",borderRadius:2}},React.createElement("div",{style:{width:pct+"%",height:3,borderRadius:2,background:r.color}})),React.createElement("span",{style:{fontSize:11,minWidth:60,textAlign:"right",color:r.color}},riskMap[r.key]+(riskMap[r.key]===1?" relative":" relatives")));}),React.createElement("p",{style:{fontSize:11,color:"rgba(250,248,244,0.25)",margin:"0.5rem 0 0",fontStyle:"italic"}},"Not a medical assessment — share with your provider")),
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
          React.createElement("input",{value:condIn.label,onChange:function(e){setCondIn(function(c){return Object.assign({},c,{label:e.target.value});});},placeholder:"Condition name",style:{flex:1,background:"rgba(255,255,255,0.07)",border:HBORD,borderRadius:8,padding:"0.4rem 0.6rem",color:HWHITE,fontSize:12,fontFamily:"inherit",outline:"none"}}),
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
        setCalToast("Added to calendar!");
        setTimeout(function(){setCalToast(null);},2500);
      }
    } catch(e){}
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
          n.tags&&n.tags.length>0&&React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:5}},n.tags.map(function(t,i){return React.createElement("span",{key:i,style:{fontSize:11,padding:"2px 8px",borderRadius:12,background:"rgba(255,255,255,0.05)",color:"rgba(250,248,244,0.4)",border:HBORD2}},t);}))
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
  var SURF="rgba(255,255,255,0.05)";
  var SURF2="rgba(255,255,255,0.04)";
  var BORD2="0.5px solid rgba(255,255,255,0.08)";
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
      React.createElement(HInput,{label:"Time (optional)",value:form.time,onChange:function(v){setForm(function(f){return Object.assign({},f,{time:v});});},placeholder:"e.g. 10:30 AM"}),
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
      // 2-column person card grid
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}},
        people.map(function(p){
          return React.createElement(HPersonCard,{key:p.id,person:p,health:health,onOpen:function(pid){setDetail({pid:pid,tab:"history"});}});
        }),
        // add card
        React.createElement("div",{onClick:function(){setAddingPerson(true);},style:{background:"rgba(255,255,255,0.02)",border:"0.5px dashed rgba(255,255,255,0.15)",borderRadius:12,minHeight:140,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer"}},
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
      React.createElement("button",{onClick:function(){setDetail(null);},style:{background:"rgba(255,255,255,0.06)",border:HBORD,borderRadius:8,padding:"5px 10px",fontSize:12,color:"rgba(250,248,244,0.5)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"\u2190 All"),
      React.createElement("div",{style:{width:28,height:28,borderRadius:"50%",background:person.color||HGOLD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:HNAVY,flexShrink:0}},initials),
      React.createElement("span",{style:{fontSize:15,fontWeight:500,color:HWHITE,flex:1}},person.name),
      // maternal link pill — show on non-"You" people when the first person exists
      people.length>1&&people.indexOf(person)>0&&React.createElement("div",{style:{position:"relative"}},
        React.createElement("button",{onClick:function(){setDetail(function(d){return Object.assign({},d,{showLink:!d.showLink});});},title:"Link family history",style:{fontSize:11,color:"rgba(250,248,244,0.4)",background:"rgba(255,255,255,0.06)",border:HBORD,borderRadius:7,padding:"4px 9px",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"🔗 Hx link"),
        detail.showLink&&React.createElement("div",{style:{position:"absolute",right:0,top:"calc(100% + 4px)",background:"#1e2e52",border:HBORD,borderRadius:10,padding:"0.75rem",zIndex:99,minWidth:220,boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}},
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
    React.createElement("div",{style:{display:"flex",borderBottom:"0.5px solid rgba(255,255,255,0.08)",background:"rgba(0,0,0,0.15)",overflowX:"auto",flexShrink:0,marginBottom:0}},
      H_TABS.map(function(t){return React.createElement("button",{key:t.id,onClick:function(){setDetail(function(d){return Object.assign({},d,{tab:t.id});});},style:{padding:"0.55rem 0.85rem",fontSize:12,background:"none",border:"none",borderBottom:t.id===detail.tab?"2px solid rgba(250,248,244,0.5)":"2px solid transparent",color:t.id===detail.tab?HWHITE:"rgba(250,248,244,0.4)",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}},t.label);})
    ),
    React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"1rem 0",display:"flex",flexDirection:"column",gap:"0.9rem"}},
      detail.tab==="history"   &&React.createElement(HHistoryTab,  tp),
      detail.tab==="immunize"  &&React.createElement(HImmunizeTab, tp),
      detail.tab==="meds"      &&React.createElement(HMedsTab,     tp),
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
  try { var s=localStorage.getItem("af_homeSystems"); return s?JSON.parse(s):[]; } catch(e){return [];}
}
function sysSaveSystems(v) { try { localStorage.setItem("af_homeSystems",JSON.stringify(v)); } catch(e){} }

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

function hfLoad() { try { var s=localStorage.getItem("af_houseFile"); return s?JSON.parse(s):[]; } catch(e){return [];} }
function hfSave(v) { try { localStorage.setItem("af_houseFile",JSON.stringify(v)); } catch(e){} }

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

  var SURF="rgba(255,255,255,0.05)";
  var SURF2="rgba(255,255,255,0.04)";
  var BORD2="0.5px solid rgba(255,255,255,0.08)";

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
        React.createElement("button",{onClick:function(){setDetail(null);},style:{background:"rgba(255,255,255,0.06)",border:HBORD,borderRadius:8,padding:"5px 10px",fontSize:12,color:"rgba(250,248,244,0.5)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"\u2190 Back"),
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
        totalCount>0&&React.createElement("div",{style:{height:3,background:"rgba(255,255,255,0.07)",borderRadius:2,marginBottom:12}},
          React.createElement("div",{style:{width:Math.round((doneCount/totalCount)*100)+"%",height:3,borderRadius:2,background:"#1d9e75",transition:"width 0.2s"}})
        ),
        (card.items||[]).map(function(item){
          return React.createElement("div",{key:item.id,style:{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:BORD2,cursor:"pointer"},onClick:function(){toggleItem(card.id,item.id);}},
            React.createElement("div",{style:{width:16,height:16,borderRadius:4,border:"0.5px solid "+(item.done?"rgba(29,158,117,0.6)":"rgba(255,255,255,0.2)"),background:item.done?"rgba(29,158,117,0.2)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},
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
        return React.createElement("button",{key:c.id,onClick:function(){setActiveCat(c.id);},style:{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",fontSize:12,borderRadius:20,border:"0.5px solid "+(activeCat===c.id?"rgba(200,169,122,0.45)":"rgba(255,255,255,0.1)"),background:activeCat===c.id?"rgba(200,169,122,0.12)":"rgba(255,255,255,0.03)",color:activeCat===c.id?HGOLD:"rgba(250,248,244,0.45)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},
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
      ? React.createElement("div",{style:{textAlign:"center",padding:"36px 20px",color:"rgba(250,248,244,0.28)",fontSize:13,fontFamily:"DM Sans,sans-serif",background:SURF2,border:"0.5px dashed rgba(255,255,255,0.1)",borderRadius:12}},
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
                      React.createElement("div",{style:{flex:1,height:3,background:"rgba(255,255,255,0.08)",borderRadius:2,maxWidth:100}},
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
        React.createElement("button",{onClick:function(){setCardType("note");},style:{flex:1,padding:"6px",fontSize:12,borderRadius:8,border:"0.5px solid "+(cardType==="note"?"rgba(200,169,122,0.4)":"rgba(255,255,255,0.1)"),background:cardType==="note"?"rgba(200,169,122,0.12)":"rgba(255,255,255,0.03)",color:cardType==="note"?HGOLD:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Fields"),
        React.createElement("button",{onClick:function(){setCardType("checklist");if(cardItems.length===0)setCardItems([{id:huid(),text:"",done:false}]);},style:{flex:1,padding:"6px",fontSize:12,borderRadius:8,border:"0.5px solid "+(cardType==="checklist"?"rgba(200,169,122,0.4)":"rgba(255,255,255,0.1)"),background:cardType==="checklist"?"rgba(200,169,122,0.12)":"rgba(255,255,255,0.03)",color:cardType==="checklist"?HGOLD:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"DM Sans,sans-serif"}},"Checklist")
      ),
      React.createElement(HInput,{label:"Title",value:cardTitle,onChange:setCardTitle,placeholder:activeCat==="tax"?"e.g. 2024 Tax Docs":activeCat==="vehicle"?"e.g. 2018 Honda CR-V":activeCat==="home"?"e.g. Living room paint":"Title"}),
      // fields mode
      cardType==="note"&&React.createElement("div",null,
        cardFields.map(function(f,i){
          return React.createElement("div",{key:i,style:{marginBottom:8}},
            React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.38)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:3}},f.label),
            React.createElement("input",{value:f.value,onChange:function(e){var v=e.target.value;setCardFields(function(prev){return prev.map(function(ff,ii){return ii===i?Object.assign({},ff,{value:v}):ff;});});},style:{width:"100%",background:"rgba(255,255,255,0.07)",border:HBORD,borderRadius:8,padding:"0.5rem 0.7rem",color:HWHITE,fontSize:13,fontFamily:"DM Sans,sans-serif",outline:"none",boxSizing:"border-box"}})
          );
        }),
        // add custom field
        fieldEdit!==null
          ? React.createElement("div",{style:{display:"flex",gap:6,marginTop:6}},
              React.createElement("input",{value:fieldEdit,onChange:function(e){setFieldEdit(e.target.value);},placeholder:"Field label",autoFocus:true,style:{flex:1,background:"rgba(255,255,255,0.07)",border:HBORD,borderRadius:8,padding:"0.45rem 0.65rem",color:HWHITE,fontSize:12,fontFamily:"DM Sans,sans-serif",outline:"none"}}),
              React.createElement("button",{onClick:function(){if(fieldEdit.trim()){setCardFields(function(prev){return prev.concat([{label:fieldEdit.trim(),value:""}]);});setFieldEdit(null);}},style:{background:"rgba(200,169,122,0.15)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:8,padding:"0.45rem 0.8rem",color:HGOLD,cursor:"pointer",fontSize:12}},"Add"),
              React.createElement("button",{onClick:function(){setFieldEdit(null);},style:{background:"none",border:HBORD,borderRadius:8,padding:"0.45rem 0.8rem",color:"rgba(250,248,244,0.35)",cursor:"pointer",fontSize:12}},"Cancel")
            )
          : React.createElement("button",{onClick:function(){setFieldEdit("");},style:{fontSize:11,color:"rgba(250,248,244,0.35)",background:"none",border:"0.5px dashed rgba(255,255,255,0.12)",borderRadius:7,padding:"4px 10px",cursor:"pointer",marginTop:4,fontFamily:"DM Sans,sans-serif"}},"\u002B Add custom field")
      ),
      // checklist mode
      cardType==="checklist"&&React.createElement("div",null,
        React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.38)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}},"Items"),
        cardItems.map(function(item,i){
          return React.createElement("div",{key:item.id,style:{display:"flex",alignItems:"center",gap:6,marginBottom:4}},
            React.createElement("input",{value:item.text,onChange:function(e){var v=e.target.value;setCardItems(function(prev){return prev.map(function(it,ii){return ii===i?Object.assign({},it,{text:v}):it;});});},style:{flex:1,background:"rgba(255,255,255,0.07)",border:HBORD,borderRadius:8,padding:"0.4rem 0.65rem",color:HWHITE,fontSize:12,fontFamily:"DM Sans,sans-serif",outline:"none"}}),
            React.createElement("button",{onClick:function(){removeChecklistItem(item.id);},style:{background:"none",border:"none",color:"rgba(250,248,244,0.25)",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1,flexShrink:0}},"✕")
          );
        }),
        React.createElement("div",{style:{display:"flex",gap:6,marginTop:4}},
          React.createElement("input",{value:newItem,onChange:function(e){setNewItem(e.target.value);},onKeyDown:function(e){if(e.key==="Enter"){addChecklistItem();}},placeholder:"Add item…",style:{flex:1,background:"rgba(255,255,255,0.07)",border:HBORD,borderRadius:8,padding:"0.4rem 0.65rem",color:HWHITE,fontSize:12,fontFamily:"DM Sans,sans-serif",outline:"none"}}),
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
      React.createElement("button",{onClick:function(){setHomeTab("systems");},style:{padding:"8px 18px",fontSize:13,background:"none",border:"none",borderBottom:homeTab==="systems"?"2px solid "+HGOLD:"2px solid transparent",color:homeTab==="systems"?HGOLD:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"DM Sans,sans-serif",fontWeight:homeTab==="systems"?600:400}},"🏠 Systems"),
      React.createElement("button",{onClick:function(){setHomeTab("file");},style:{padding:"8px 18px",fontSize:13,background:"none",border:"none",borderBottom:homeTab==="file"?"2px solid "+HGOLD:"2px solid transparent",color:homeTab==="file"?HGOLD:"rgba(250,248,244,0.4)",cursor:"pointer",fontFamily:"DM Sans,sans-serif",fontWeight:homeTab==="file"?600:400}},"📁 House File")
    ),
    homeTab==="systems"&&React.createElement(HomeSystemsSection,null),
    homeTab==="file"&&React.createElement(HouseFileSection,null)
  );
}

function HomeSystemsSection() {
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
  var SURF="rgba(255,255,255,0.05)";
  var SURF2="rgba(255,255,255,0.04)";

  return React.createElement("div",null,
    // header
    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}},
      React.createElement("div",{style:{fontFamily:"Cormorant Garamond,serif",fontSize:22,fontWeight:600,color:HWHITE}},"Home Systems"),
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
          React.createElement("div",{onClick:function(){setAdding(true);setEditIdx(null);setForm({name:"",type:"other",freq:"1y",lastDone:"",nextDue:"",notes:""});},style:{background:"rgba(255,255,255,0.02)",border:"0.5px dashed rgba(255,255,255,0.13)",borderRadius:10,minHeight:90,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,cursor:"pointer"}},
            React.createElement("span",{style:{fontSize:20,color:"rgba(250,248,244,0.18)"}},"+"),
            React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.28)",fontFamily:"DM Sans,sans-serif"}},"Add")
          )
        ),

    // detail drawer (shows below grid)
    detail!==null&&systems[detail]&&function(){
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
          React.createElement("div",{style:{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"8px 10px"}},
            React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.35)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Frequency"),
            React.createElement("p",{style:{fontSize:13,color:HWHITE,margin:0}},freqLabel)
          ),
          React.createElement("div",{style:{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"8px 10px"}},
            React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.35)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Status"),
            React.createElement("p",{style:{fontSize:13,color:sysStatusColor(status),margin:0}},sysStatusLabel(sys))
          ),
          sys.lastDone&&React.createElement("div",{style:{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"8px 10px"}},
            React.createElement("p",{style:{fontSize:10,color:"rgba(250,248,244,0.35)",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 2px"}},"Last done"),
            React.createElement("p",{style:{fontSize:13,color:HWHITE,margin:0}},sys.lastDone)
          ),
          (sys.nextDue||sysNextDate(sys.lastDone,sys.freq))&&React.createElement("div",{style:{background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"8px 10px"}},
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
    }(),

    // add / edit modal
    adding&&React.createElement(HModal,{title:editIdx!==null?"Edit system":"Add system",onClose:function(){setAdding(false);setEditIdx(null);}},
      React.createElement(HInput,{label:"System name",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. HVAC filter, Water heater flush"}),
      React.createElement("div",{style:{marginBottom:"0.75rem"}},
        React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},"Type"),
        React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:5}},
          SYS_ICONS.map(function(s){
            return React.createElement("button",{key:s.id,onClick:function(){setForm(function(f){return Object.assign({},f,{type:s.id});});},style:{background:form.type===s.id?"rgba(200,169,122,0.18)":"rgba(255,255,255,0.04)",border:"0.5px solid "+(form.type===s.id?"rgba(200,169,122,0.4)":"rgba(255,255,255,0.1)"),borderRadius:8,padding:"5px 8px",fontSize:11,color:form.type===s.id?HGOLD:"rgba(250,248,244,0.5)",cursor:"pointer"}},s.emoji+" "+s.label);
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
]

function recurLoad() {
  try { var s = localStorage.getItem("af_recurring"); return s ? JSON.parse(s) : [] } catch { return [] }
}
function recurSave(v) {
  try { localStorage.setItem("af_recurring", JSON.stringify(v)) } catch {}
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

function daysUntilReminder(r) {
  var now = new Date(); now.setHours(0,0,0,0)
  var next
  if (r.type === "weekly_day") {
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
  var NAVY="#1a2744"; var GOLD="#c8a97a"; var FAINT="rgba(250,248,244,0.35)"; var SOFT="rgba(250,248,244,0.65)"

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

  var [editing, setEditing] = useState(null) // null | "new" | reminder id
  var [draft, setDraft] = useState(null)
  var [showBuiltins, setShowBuiltins] = useState(false)
  var [saved, setSaved] = useState(false)

  function save(list) { setReminders(list); recurSave(list) }

  function openNew(template) {
    var base = template ? {
      id: recurId(), builtinId: template.id, emoji: template.emoji, label: template.label,
      type: template.type, freq: template.defaultFreq, day: null, lastDone: null,
      remindEvening: true, remindMorning: true, active: true, custom: false
    } : {
      id: recurId(), builtinId: null, emoji: "⏰", label: "", type: "interval",
      freq: "monthly", day: null, lastDone: null, remindEvening: true, remindMorning: false,
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
    card: { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(200,169,122,0.18)", borderRadius:12, padding:"14px 16px", marginBottom:8 },
    lbl: { fontSize:11, fontWeight:700, color:"rgba(200,169,122,0.65)", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:6, display:"block", fontFamily:"DM Sans,sans-serif" },
    inp: { width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"8px 10px", fontSize:13, color:"rgba(250,248,244,0.9)", fontFamily:"DM Sans,sans-serif", marginBottom:12, boxSizing:"border-box" },
    sel: { width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"8px 10px", fontSize:13, color:"rgba(250,248,244,0.85)", fontFamily:"DM Sans,sans-serif", cursor:"pointer", marginBottom:12, boxSizing:"border-box" },
    toggle: function(on){ return { width:36, height:20, borderRadius:10, background:on?"#7a9e8e":"rgba(255,255,255,0.1)", border:"none", position:"relative", cursor:"pointer", flexShrink:0, transition:"background 0.2s" } },
    thumb: function(on){ return { position:"absolute", top:2, left:on?18:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" } },
    trow: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:"0.5px solid rgba(255,255,255,0.06)" },
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
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {[{id:"weekly_day",label:"📅 Specific day"},{id:"interval",label:"⏱ After X days"}].map(function(t){
              return <button key={t.id} onClick={function(){setDraft(function(p){return {...p,type:t.id,day:null}})}} style={{flex:1,background:draft.type===t.id?"rgba(200,169,122,0.2)":"rgba(255,255,255,0.04)",border:"1px solid "+(draft.type===t.id?"rgba(200,169,122,0.5)":"rgba(255,255,255,0.1)"),borderRadius:8,padding:"7px",fontSize:12,color:draft.type===t.id?GOLD:SOFT,fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:draft.type===t.id?700:400}}>{t.label}</button>
            })}
          </div>

          {/* Day selector (weekly_day only) */}
          {draft.type==="weekly_day"&&(
            <>
              <label style={S.lbl}>Pickup / service day</label>
              <select value={draft.day!=null?draft.day:""} onChange={function(e){setDraft(function(p){return {...p,day:e.target.value!==""?parseInt(e.target.value):null}})}} style={S.sel}>
                <option value="">Not set</option>
                {DAY_LABELS.map(function(d,i){return <option key={i} value={i}>{d}</option>})}
              </select>
            </>
          )}

          {/* Frequency */}
          <label style={S.lbl}>Frequency</label>
          <select value={draft.freq} onChange={function(e){setDraft(function(p){return {...p,freq:e.target.value}})}} style={S.sel}>
            {FREQ_OPTIONS.filter(function(f){
              if(draft.type==="weekly_day") return ["weekly","biweekly","monthly"].includes(f.id)
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
          <button onClick={function(){setEditing(null);setDraft(null)}} style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"10px",fontSize:13,color:SOFT,fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:600}}>Cancel</button>
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
          <button onClick={function(){setShowBuiltins(function(p){return !p})}} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"7px 14px",fontSize:12,color:SOFT,fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:600,width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>➕ Add from common reminders</span>
            <span style={{opacity:0.5,fontSize:10}}>{showBuiltins?"▲":"▼"}</span>
          </button>
          {showBuiltins&&(
            <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
              {availableBuiltins.map(function(b){
                return(
                  <button key={b.id} onClick={function(){openNew(b)}} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 14px",cursor:"pointer",textAlign:"left"}}>
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
        <div style={{textAlign:"center",padding:"32px 20px",background:"rgba(255,255,255,0.02)",border:"1px dashed rgba(200,169,122,0.2)",borderRadius:14}}>
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
          <div key={r.id} style={{background:alert?"rgba(200,131,74,0.07)":"rgba(255,255,255,0.03)",border:"1px solid "+(overdue?"rgba(220,80,80,0.35)":alert?"rgba(200,131,74,0.35)":"rgba(200,169,122,0.15)"),borderRadius:12,padding:"13px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:22,flexShrink:0}}>{r.emoji}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:"rgba(250,248,244,0.92)",fontFamily:"DM Sans,sans-serif"}}>{r.label}</div>
              <div style={{fontSize:11,color:FAINT,fontFamily:"DM Sans,sans-serif",marginTop:1}}>
                {r.type==="weekly_day"&&r.day!=null?DAY_LABELS[r.day]+"s":""}{" "}
                {FREQ_OPTIONS.find(function(f){return f.id===r.freq})?FREQ_OPTIONS.find(function(f){return f.id===r.freq}).label:""}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              {badge&&<span style={{fontSize:11,fontWeight:700,color:overdue?"#e07070":alert?"#c8834a":GOLD}}>{badge}</span>}
              <button onClick={function(){markDone(r.id)}} title="Mark done / reset timer" style={{background:"rgba(122,158,142,0.15)",border:"1px solid rgba(122,158,142,0.3)",borderRadius:6,padding:"4px 8px",fontSize:11,color:"#7a9e8e",fontFamily:"DM Sans,sans-serif",cursor:"pointer",fontWeight:600}}>✓ Done</button>
              <button onClick={function(){openEdit(r)}} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"4px 8px",fontSize:11,color:SOFT,fontFamily:"DM Sans,sans-serif",cursor:"pointer"}}>Edit</button>
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
      const saved = JSON.parse(localStorage.getItem("af_celebrations") || "[]")
      const bdays = JSON.parse(localStorage.getItem("af_birthdays") || "[]")
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

  function readPets() { try { return JSON.parse(localStorage.getItem("af_pets") || "[]") } catch { return [] } }
  function readGifts() { try { return JSON.parse(localStorage.getItem("af_gifts") || "[]") } catch { return [] } }
  function readMoments() { try { return JSON.parse(localStorage.getItem("af_moments") || "[]") } catch { return [] } }
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
    var target = new Date(now.getFullYear(), parseInt(parts[1])-1, parseInt(parts[2]))
    if (target < now) target.setFullYear(target.getFullYear()+1)
    return Math.round((target - now) / 86400000)
  }

  var MNAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

  // ── Summary builders ───────────────────────────────────────────────────────
  function celebSummary() {
    var list = readCelebrations()
    if (!list.length) return { highlight: null, countdown: null, count: 0 }
    var now = new Date(); now.setHours(0,0,0,0)
    var giftMap = {}
    try { giftMap = JSON.parse(localStorage.getItem("af_celebgifts") || "{}") } catch {}
    var entries = list.map(function(c) {
      var next = new Date(now.getFullYear(), c.month-1, c.day)
      if (next < now) next.setFullYear(next.getFullYear()+1)
      var diff = Math.round((next - now) / 86400000)
      var age = (c.type === "birthday" && c.year) ? (next.getFullYear() - c.year) : null
      var gifts = giftMap[c.id] || []
      var unbought = gifts.filter(function(g) { return !g.bought }).length
      return { ...c, diff, age, giftCount: gifts.length, unbought }
    }).sort(function(a,b) { return a.diff - b.diff })
    var next = entries[0]
    var label = next.name + (next.age ? " turns " + next.age : next.type === "anniversary" ? " anniversary" : "")
    var countdown = next.diff === 0 ? "Today! 🎉" : next.diff === 1 ? "Tomorrow" : "in " + next.diff + " days"
    var hasUnbought = entries.some(function(e) { return e.diff <= 30 && e.unbought > 0 })
    return { highlight: label, countdown: countdown, count: list.length, soon: next.diff <= 14, alert: hasUnbought, entries: entries.slice(0, 4), giftMap: giftMap }
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
    var [open, setOpen] = useState(defaultOpen || false)
    var hasAlert = summary.alert
    var borderColor = hasAlert ? "rgba(200,131,74,0.4)" : "rgba(200,169,122,0.18)"
    var bgColor = hasAlert ? "rgba(200,131,74,0.05)" : "rgba(255,255,255,0.035)"

    return (
      <div style={{ background: bgColor, border: "1px solid " + borderColor, borderRadius: 14, marginBottom: 10, overflow: "hidden", transition: "all 0.2s" }}>
        {/* Header — always visible */}
        <div onClick={function() { setOpen(function(p) { return !p }) }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", cursor: "pointer" }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontFamily: "DM Sans,sans-serif", fontSize: 13, fontWeight: 700, color: "#faf8f4" }}>{label}</div>
              {summary.count > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(200,169,122,0.7)", background: "rgba(200,169,122,0.1)", borderRadius: 20, padding: "1px 7px" }}>{summary.count}</div>}
            </div>
            {summary.highlight && (
              <div style={{ fontSize: 12, color: "rgba(250,248,244,0.6)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary.highlight}</div>
            )}
            {!summary.highlight && (
              <div style={{ fontSize: 12, color: "rgba(250,248,244,0.3)", marginTop: 2, fontStyle: "italic" }}>Nothing added yet</div>
            )}
          </div>
          <div style={{ flexShrink: 0, textAlign: "right", marginRight: 8 }}>
            {summary.countdown && summary.count > 0 && (
              <div style={{ fontSize: 11, fontWeight: 700, color: hasAlert ? "#c8834a" : "#c8a97a", whiteSpace: "nowrap" }}>{summary.countdown}</div>
            )}
          </div>
          <span style={{ fontSize: 11, color: "rgba(250,248,244,0.35)", flexShrink: 0, transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
        </div>

        {/* Expanded content */}
        {open && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "10px 16px 14px" }}>
            {summary.count === 0 ? (
              <div style={{ fontSize: 12, color: "rgba(250,248,244,0.35)", fontStyle: "italic", fontFamily: "DM Sans,sans-serif", padding: "4px 0" }}>Nothing here yet — tap Open to add.</div>
            ) : (
              <div style={{ marginBottom: 10 }}>
                {(summary.entries || []).map(function(e, i) {
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: i < (summary.entries.length - 1) ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
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
  var moments = momentsSummary()
  var health = healthSummary()
  var inventory = inventorySummary()
  var careerSum = careerSummary()
  var trashSum = recurringDashSummary()

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

  return (
    <div style={{ paddingBottom: "2rem" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 26, fontWeight: 700, color: "#faf8f4", letterSpacing: "0.02em" }}>⚓ Anchor</div>
        <div style={{ fontSize: 13, color: "rgba(200,169,122,0.85)", fontFamily: "DM Sans,sans-serif", marginTop: 4, fontStyle: "italic", lineHeight: 1.5 }}>A place to hold what matters most — your people, your home, your story.</div>
      </div>

      <DashCard id="recurring" icon="🔁" label="Recurring Reminders" onOpen={onNavigate}
        summary={trashSum} defaultOpen={trashSum.alert} />
      <DashCard id="gifts" icon="🎉" label="Celebrations & Gifts" onOpen={onNavigate}
        summary={{
          count: celeb.count,
          highlight: celeb.highlight,
          countdown: celeb.countdown,
          alert: celeb.soon || celeb.alert,
          entries: celebEntries
        }}
        defaultOpen={celeb.soon || celeb.alert} />
      <DashCard id="inventory" icon="📦" label="Inventory" onOpen={onNavigate}
        summary={{ ...inventory, entries: inventoryEntries }} defaultOpen={inventory.alert} />
      <DashCard id="career" icon="📋" label="Career" onOpen={onNavigate}
        summary={careerSum} />
      <DashCard id="health" icon="🩺" label="Health" onOpen={onNavigate}
        summary={{ ...health, entries: healthEntries }} />
      <DashCard id="pets" icon="🐾" label="Pets" onOpen={onNavigate}
        summary={{ ...pets, entries: petEntries }} />
      <DashCard id="moments" icon="✨" label="Moments" onOpen={onNavigate}
        summary={{ ...moments, entries: momentEntries }} />
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

// ── Anchor Settings ───────────────────────────────────────────────────────────
const ANCHOR_SECTIONS = [
  { id: "inventory", label: "Inventory",     emoji: "📦" },
  { id: "systems",   label: "Home Systems",  emoji: "🏠" },
  { id: "health",    label: "Health",        emoji: "🩺" },
  { id: "career",    label: "Career",        emoji: "📋" },
  { id: "subs",      label: "Subscriptions", emoji: "🔄" },
  { id: "gifts",     label: "Celebrate",     emoji: "🎉" },
  { id: "pets",      label: "Pets",          emoji: "🐾" },
  { id: "moments",   label: "Moments",       emoji: "✨" },
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
    row:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "0.5px solid rgba(255,255,255,0.06)" },
    track: function(on) { return { width: 40, height: 22, borderRadius: 11, background: on ? "#7a9e8e" : "rgba(255,255,255,0.1)", position: "relative", cursor: "pointer", transition: "background 0.2s", border: "none", flexShrink: 0 } },
    thumb: function(on) { return { position: "absolute", top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" } },
  }

  return (
    <div>
      <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, fontWeight: 600, color: "#faf8f4", marginBottom: 4 }}>Anchor Settings</div>
      <div style={{ fontSize: 12, color: "rgba(250,248,244,0.4)", fontFamily: "DM Sans,sans-serif", marginBottom: 20, lineHeight: 1.5 }}>Customise which sections appear in your Anchor Vault.</div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "4px 16px" }}>
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

      <div style={{ marginTop: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(250,248,244,0.55)", fontFamily: "DM Sans,sans-serif", marginBottom: 10 }}>About Anchor Vault</div>
        <p style={{ fontSize: 12, color: "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", lineHeight: 1.65, margin: 0 }}>
          Anchor holds the steady, permanent parts of your home — inventory, health records, career docs, and milestones. Flow handles the daily rhythm. Together they give your home a complete system.
        </p>
      </div>
    </div>
  )
}

export default function AnchorVault({ onClose, calEvents, vaultSection }) {
  calEvents = calEvents || []
  vaultSection = vaultSection || "home"

  const [activeSection, setActiveSection] = useState(vaultSection)
  useEffect(function() { setActiveSection(vaultSection) }, [vaultSection])

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
      <div style={{ flex: 1, background: "#1e2e50", overflowY: "auto", padding: "24px 20px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {activeSection === "home" && <AnchorDashboard onNavigate={setActiveSection} calEvents={calEvents} />}
          {activeSection === "recurring" && <RecurringRemindersSection />}
          {activeSection === "inventory" && <InventorySection onAddToShopping={handleAddToShopping} />}
          {activeSection === "systems" && <HomeSection />}
          {activeSection === "health" && <HealthSection />}
          {activeSection === "gifts" && <GiftsAndCelebrations calEvents={calEvents} />}
          {activeSection === "pets" && <PetsSection />}
          {activeSection === "moments" && <MomentsSection />}
          {activeSection === "career" && <CareerSection />}
          {activeSection === "settings" && <AnchorSettings />}
          {activeSection === "subs" && (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🔒</div>
              <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, color: "#faf8f4", marginBottom: 8 }}>Premium section</div>
              <div style={{ fontSize: 13, color: "rgba(250,248,244,0.45)", fontFamily: "DM Sans,sans-serif", lineHeight: 1.6, marginBottom: 20 }}>Unlock the full Anchor Vault with premium.</div>
              <button style={{ background: "#c8a97a", border: "none", borderRadius: 10, padding: "12px 24px", color: "#1a2744", fontFamily: "DM Sans,sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Unlock full system</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
