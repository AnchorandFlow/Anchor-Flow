import React, { useState, useEffect } from "react"
import MomentsSection from "./MomentsSection"
// CareerSection is defined inline below

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
                  <input value={favForm.name} onChange={function(e) { setFavForm(function(p) { return {...p, name: e.target.value} }) }} placeholder="Product name *" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none", boxSizing: "border-box" }} />
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
                <input value={favForm.brand} onChange={function(e) { setFavForm(function(p) { return {...p, brand: e.target.value} }) }} placeholder="Brand (opt)" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
                <input value={favForm.store} onChange={function(e) { setFavForm(function(p) { return {...p, store: e.target.value} }) }} placeholder="Where to buy (opt)" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
              </div>
              <input value={favForm.notes} onChange={function(e) { setFavForm(function(p) { return {...p, notes: e.target.value} }) }} placeholder="Notes (opt)" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none", marginBottom: 10, boxSizing: "border-box" }} />
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
            <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", background: "#7a9e8e", color: "#fff", padding: "8px 18px", borderRadius: 20, fontSize: 13, fontFamily: "DM Sans,sans-serif", zIndex: 9999, whiteSpace: "nowrap" }}>{toast}</div>
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
                              <input value={editVal} onChange={function(e) { setEditVal(e.target.value) }} onKeyDown={function(e) { if (e.key === "Enter") renameItem(idx); if (e.key === "Escape") setEditing(null) }} autoFocus style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(200,169,122,0.4)", borderRadius: 6, padding: "3px 8px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
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
                            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.3)", borderRadius: 7, padding: "6px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }}
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

  function save(updated) {
    setCelebrations(updated)
    try { localStorage.setItem("af_celebrations", JSON.stringify(updated)) } catch {}
  }

  function addCelebration() {
    if (!form.name.trim() || !form.month || !form.day) return
    save([...celebrations, { id: Date.now().toString(), type: celebType, name: form.name.trim(), month: parseInt(form.month), day: parseInt(form.day), year: form.year ? parseInt(form.year) : null, notes: form.notes.trim() }])
    setForm({ name: "", month: "", day: "", year: "", notes: "" })
    setAdding(false)
  }

  const now = new Date(); now.setHours(0,0,0,0)
  const year = now.getFullYear()
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

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
          <input value={form.name} onChange={function(e) { setForm(function(p) { return {...p, name: e.target.value} }) }} placeholder={celebType === "birthday" ? "Person's name" : "What's the occasion?"} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select value={form.month} onChange={function(e) { setForm(function(p) { return {...p, month: e.target.value} }) }} style={{ flex: 2, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: form.month ? "#faf8f4" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", outline: "none" }}>
              <option value="">Month</option>
              {MONTHS.map(function(m, i) { return <option key={i} value={i+1} style={{ background: "#1a2744" }}>{m}</option> })}
            </select>
            <input value={form.day} onChange={function(e) { setForm(function(p) { return {...p, day: e.target.value} }) }} placeholder="Day" type="number" min="1" max="31" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
            {(celebType === "birthday" || celebType === "anniversary") && (
              <input value={form.year} onChange={function(e) { setForm(function(p) { return {...p, year: e.target.value} }) }} placeholder="Year (opt)" type="number" style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
            )}
          </div>
          <input value={form.notes} onChange={function(e) { setForm(function(p) { return {...p, notes: e.target.value} }) }} placeholder="Notes (optional)" style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(200,169,122,0.25)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#faf8f4", fontFamily: "DM Sans,sans-serif", outline: "none", marginBottom: 12, boxSizing: "border-box" }} />
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
        return (
          <div key={e.id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: e.soon && !isPast ? "rgba(200,131,74,0.07)" : "rgba(255,255,255,0.03)", border: "1px solid " + (e.soon && !isPast ? "rgba(200,131,74,0.2)" : "rgba(255,255,255,0.07)"), borderRadius: 10, marginBottom: 7, opacity: isPast ? 0.45 : 1 }}>
            <div style={{ width: 40, textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 18, lineHeight: 1 }}>{e.emoji}</div>
              {e.month && <div style={{ fontSize: 13, fontWeight: 700, color: e.soon && !isPast ? "#c8834a" : "rgba(200,169,122,0.6)", fontFamily: "Cormorant Garamond,serif" }}>{MONTHS[e.month-1]} {e.day}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: isPast ? "rgba(250,248,244,0.45)" : "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>{e.label}</div>
              <div style={{ fontSize: 11, color: "rgba(250,248,244,0.3)", fontFamily: "DM Sans,sans-serif", marginTop: 2 }}>{e.typeInfo && e.typeInfo.label}{e.notes ? " · " + e.notes : ""}</div>
            </div>
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              {isPast ? <span style={{ fontSize: 10, color: "rgba(250,248,244,0.2)", fontFamily: "DM Sans,sans-serif" }}>passed</span>
              : e.diff === 0 ? <span style={{ fontSize: 11, fontWeight: 800, color: "#c8834a" }}>Today! 🎉</span>
              : e.diff === 1 ? <span style={{ fontSize: 11, fontWeight: 700, color: "#c8834a" }}>Tomorrow</span>
              : <span style={{ fontSize: 11, color: e.diff <= 7 ? "#c8834a" : "rgba(250,248,244,0.3)", fontWeight: e.diff <= 7 ? 600 : 400 }}>in {e.diff}d</span>}
            </div>
            <button onClick={function() { save(celebrations.filter(function(x) { return x.id !== e.id })) }} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.25, fontSize: 13, padding: "2px 4px", color: "#faf8f4" }}>✕</button>
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

function GiftsSection({ people, isPremium, calEvents }) {
  people = people || []
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
  const [newGift, setNewGift] = useState({ item: "", cost: "", url: "" })
  const [editingGift, setEditingGift] = useState(null)
  const [editGiftVal, setEditGiftVal] = useState({ item: "", cost: "" })

  function gUid() { return Math.random().toString(36).slice(2,9) }

  function saveGifts(updated) {
    setGifts(updated)
    try { localStorage.setItem("af_gifts", JSON.stringify(updated)) } catch {}
  }

  const allPeople = [
    ...people.map(function(p) { return { id: p.id, name: p.name, relation: "Family", fromApp: true } }),
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
      if (appP) saveGifts([...gifts, { id: personId, name: appP.name, relation: "Family", occasions: [occ] }])
    } else {
      saveGifts(gifts.map(function(p) { return p.id===personId ? {...p, occasions:[...(p.occasions||[]),occ]} : p }))
    }
    setNewOccasion({ type: "Birthday", date: "" })
    setAddingOccasion(false)
    setActiveOccasion(occ.id)
  }

  function addGiftItem(personId, occId) {
    if (!newGift.item.trim()) return
    const item = { id: gUid(), item: newGift.item.trim(), cost: newGift.cost ? parseFloat(newGift.cost) : null, url: newGift.url || "", bought: false }
    saveGifts(gifts.map(function(p) { return p.id===personId ? {...p, occasions:(p.occasions||[]).map(function(o) { return o.id===occId ? {...o, gifts:[...(o.gifts||[]),item]} : o })} : p }))
    setNewGift({ item: "", cost: "", url: "" })
    setAddingGift(false)
  }

  function toggleBought(personId, occId, giftId) {
    saveGifts(gifts.map(function(p) { return p.id===personId ? {...p, occasions:(p.occasions||[]).map(function(o) { return o.id===occId ? {...o, gifts:(o.gifts||[]).map(function(g) { return g.id===giftId?{...g,bought:!g.bought}:g })} : o })} : p }))
  }

  function deleteGiftItem(personId, occId, giftId) {
    saveGifts(gifts.map(function(p) { return p.id===personId ? {...p, occasions:(p.occasions||[]).map(function(o) { return o.id===occId ? {...o, gifts:(o.gifts||[]).filter(function(g){return g.id!==giftId})} : o })} : p }))
  }

  function saveEditGift(personId, occId, giftId) {
    saveGifts(gifts.map(function(p) { return p.id===personId ? {...p, occasions:(p.occasions||[]).map(function(o) { return o.id===occId ? {...o, gifts:(o.gifts||[]).map(function(g) { return g.id===giftId?{...g,item:editGiftVal.item,cost:editGiftVal.cost?parseFloat(editGiftVal.cost):null}:g })} : o })} : p }))
    setEditingGift(null)
  }

  const currentPerson = gifts.find(function(p){return p.id===activePerson}) || (activePerson?allPeople.find(function(p){return p.id===activePerson}):null)
  const currentOccasion = currentPerson && currentPerson.occasions && currentPerson.occasions.find(function(o){return o.id===activeOccasion})

  const gS = {
    card:{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"12px 14px", marginBottom:10 },
    inp:{ width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(200,169,122,0.3)", borderRadius:8, padding:"8px 12px", fontSize:13, color:"#faf8f4", fontFamily:"DM Sans,sans-serif", outline:"none", boxSizing:"border-box" },
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
              <div key={g.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <div onClick={function(){toggleBought(currentPerson.id,currentOccasion.id,g.id)}} style={{width:20,height:20,borderRadius:5,border:"1.5px solid "+(g.bought?"#7a9e8e":"rgba(255,255,255,0.2)"),background:g.bought?"#7a9e8e":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer"}}>
                  {g.bought&&<span style={{color:"#fff",fontSize:11}}>✓</span>}
                </div>
                {editingGift===g.id?(
                  <div style={{flex:1,display:"flex",gap:6}}>
                    <input value={editGiftVal.item} onChange={function(e){setEditGiftVal(function(v){return{...v,item:e.target.value}})}} style={{...gS.inp,flex:2,padding:"4px 8px"}}/>
                    <input value={editGiftVal.cost} onChange={function(e){setEditGiftVal(function(v){return{...v,cost:e.target.value}})}} placeholder="$" style={{...gS.inp,flex:1,padding:"4px 8px"}}/>
                    <button onClick={function(){saveEditGift(currentPerson.id,currentOccasion.id,g.id)}} style={{...gS.btn,padding:"4px 8px",fontSize:11}}>save</button>
                    <button onClick={function(){setEditingGift(null)}} style={{...gS.ghost,padding:"4px 8px",fontSize:11}}>✕</button>
                  </div>
                ):(
                  <React.Fragment>
                    <span style={{flex:1,fontSize:13,color:g.bought?"rgba(250,248,244,0.4)":"rgba(250,248,244,0.8)",fontFamily:"DM Sans,sans-serif",textDecoration:g.bought?"line-through":"none"}}>{g.item}</span>
                    {g.cost&&<span style={{fontSize:11,color:"rgba(250,248,244,0.4)",fontFamily:"DM Sans,sans-serif"}}>${g.cost.toFixed(2)}</span>}
                    {g.url&&<a href={g.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#6ba3c4",textDecoration:"none"}}>🔗</a>}
                    <button onClick={function(){setEditingGift(g.id);setEditGiftVal({item:g.item,cost:g.cost?String(g.cost):""})}} style={{background:"none",border:"none",fontSize:11,color:"rgba(250,248,244,0.25)",cursor:"pointer",padding:"2px 4px"}}>✏️</button>
                    <button onClick={function(){deleteGiftItem(currentPerson.id,currentOccasion.id,g.id)}} style={{background:"none",border:"none",fontSize:11,color:"rgba(200,131,74,0.4)",cursor:"pointer",padding:"2px 4px"}}>✕</button>
                  </React.Fragment>
                )}
              </div>
            )
          })}
        </div>
        {addingGift?(
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input value={newGift.item} onChange={function(e){setNewGift(function(v){return{...v,item:e.target.value}})}} onKeyDown={function(e){if(e.key==="Enter")addGiftItem(currentPerson.id,currentOccasion.id)}} placeholder="Gift idea..." autoFocus style={{...gS.inp,flex:2}}/>
              <input value={newGift.cost} onChange={function(e){setNewGift(function(v){return{...v,cost:e.target.value}})}} placeholder="$" style={{...gS.inp,flex:1}}/>
              <button onClick={function(){addGiftItem(currentPerson.id,currentOccasion.id)}} style={gS.btn}>Add</button>
              <button onClick={function(){setAddingGift(false)}} style={gS.ghost}>✕</button>
            </div>
            <input value={newGift.url} onChange={function(e){setNewGift(function(v){return{...v,url:e.target.value}})}} placeholder="Link (optional)" style={{...gS.inp}}/>
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
    return (
      <div>
        <button onClick={function(){setActivePerson(null);setView("people")}} style={{...gS.ghost,marginBottom:16,fontSize:11}}>← Back</button>
        <div style={{fontFamily:"Cormorant Garamond,serif",fontSize:20,fontWeight:600,color:"#faf8f4",marginBottom:2}}>{currentPerson.name}</div>
        <div style={{fontSize:11,color:"rgba(250,248,244,0.4)",fontFamily:"DM Sans,sans-serif",marginBottom:16}}>{currentPerson.relation}</div>
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
          <button onClick={function(){setAddingOccasion(true)}} style={{width:"100%",padding:10,background:"rgba(200,169,122,0.08)",border:"1px solid rgba(200,169,122,0.2)",borderRadius:8,fontSize:12,color:"#c8a97a",fontFamily:"DM Sans,sans-serif",cursor:"pointer"}}>+ Add occasion</button>
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
                  <div style={{fontSize:13,fontWeight:500,color:"#faf8f4",fontFamily:"DM Sans,sans-serif"}}>{person.name}</div>
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
  const [tab, setTab] = useState("celebrations")
  return (
    <div>
      <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid rgba(255,255,255,0.1)", marginBottom: 20 }}>
        {[["celebrations","🎉 Celebrations"],["gifts","🎁 Gifts"]].map(function(pair) {
          const v = pair[0]; const l = pair[1]
          return (
            <button key={v} onClick={function() { setTab(v) }} style={{ background: "none", border: "none", borderBottom: tab===v ? "2px solid #c8a97a" : "2px solid transparent", padding: "9px 16px", fontSize: 13, color: tab===v ? "#c8a97a" : "rgba(250,248,244,0.35)", fontFamily: "DM Sans,sans-serif", cursor: "pointer", fontWeight: tab===v ? 700 : 400 }}>{l}</button>
          )
        })}
      </div>
      {tab === "celebrations" && <CelebrationsSection calEvents={calEvents} />}
      {tab === "gifts" && <GiftsSection people={[]} isPremium={false} calEvents={calEvents} />}
    </div>
  )
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
  return React.createElement("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999},onClick:props.onClose},
    React.createElement("div",{style:{background:"#1e2e52",border:CAREER_BORD,borderRadius:14,padding:"1.25rem 1.5rem",width:"min(480px,92vw)",maxHeight:"85vh",overflowY:"auto"},onClick:function(e){e.stopPropagation();}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}},
        React.createElement("span",{style:{color:CAREER_WHITE,fontSize:15,fontWeight:600}},props.title),
        React.createElement("button",{onClick:props.onClose,style:{background:"none",border:"none",color:"rgba(250,248,244,0.4)",cursor:"pointer",fontSize:18}},"✕")),
      props.children))
}
function CInput(props) {
  return React.createElement("div",{style:{marginBottom:"0.7rem"}},
    props.label&&React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},props.label),
    React.createElement("input",{type:props.type||"text",value:props.value,onChange:function(e){props.onChange(e.target.value);},placeholder:props.placeholder,style:{width:"100%",background:"rgba(255,255,255,0.07)",border:CAREER_BORD,borderRadius:8,padding:"0.5rem 0.7rem",color:CAREER_WHITE,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}))
}
function CTextarea(props) {
  return React.createElement("div",{style:{marginBottom:"0.7rem"}},
    props.label&&React.createElement("label",{style:{display:"block",fontSize:11,color:"rgba(250,248,244,0.4)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}},props.label),
    React.createElement("textarea",{value:props.value,onChange:function(e){props.onChange(e.target.value);},placeholder:props.placeholder,rows:props.rows||4,style:{width:"100%",background:"rgba(255,255,255,0.07)",border:CAREER_BORD,borderRadius:8,padding:"0.5rem 0.7rem",color:CAREER_WHITE,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box"}}))
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

  function save() {
    if(!form.title.trim()) return
    var entry = {id:cuid(),...form}
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,resume:{...(p.resume||{}),history:[...((p.resume||{}).history||[]),entry]}}}})
    setForm({title:"",company:"",from:"",to:"",desc:""}); setAdding(false)
  }
  function removeJob(id) { setCareer(function(c){var p=c[pid]||{}; var r=p.resume||{}; return{...c,[pid]:{...p,resume:{...r,history:(r.history||[]).filter(function(h){return h.id!==id})}}}}) }
  function addSkill() {
    if(!skillInput.trim()) return
    var sk = {id:cuid(),label:skillInput.trim()}
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,skills:[...(p.skills||[]),sk]}}})
    setSkillInput("")
  }
  function removeSkill(id) { setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,skills:(p.skills||[]).filter(function(s){return s.id!==id})}}}) }
  function updateBio(v) { setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,resume:{...(p.resume||{}),bio:v}}}}) }

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"0.9rem"}},
    React.createElement(CCard,null,
      React.createElement(CHead,{icon:"📝",label:"Professional summary"}),
      React.createElement("textarea",{value:resume.bio||"",onChange:function(e){updateBio(e.target.value);},placeholder:"A short bio or professional summary…",rows:4,style:{width:"100%",background:"rgba(255,255,255,0.07)",border:CAREER_BORD,borderRadius:8,padding:"0.5rem 0.7rem",color:CAREER_WHITE,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box"}})),
    React.createElement(CCard,null,
      React.createElement(CHead,{icon:"💼",label:"Work history",onAdd:function(){setAdding(true)}}),
      (resume.history||[]).length===0 ? React.createElement(CEmpty,{text:"No work history added yet"}) :
        React.createElement("div",null,(resume.history||[]).map(function(h){
          return React.createElement(CRow,{key:h.id,title:h.title+(h.company?" · "+h.company:""),sub:(h.from?h.from:"")+((h.from||h.to)?" – ":"")+(h.to||"present"),badge:null,onDelete:function(){removeJob(h.id)}})
        }))),
    React.createElement(CCard,null,
      React.createElement(CHead,{icon:"⚡",label:"Skills"}),
      React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:"0.65rem"}},
        skills.length===0?React.createElement("span",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",fontStyle:"italic"}},"No skills added yet"):
        skills.map(function(sk){return React.createElement("span",{key:sk.id,style:{display:"flex",alignItems:"center",gap:4,fontSize:12,padding:"3px 10px",borderRadius:12,background:"rgba(200,169,122,0.1)",color:CAREER_GOLD,border:"0.5px solid rgba(200,169,122,0.25)"}},sk.label,React.createElement("button",{onClick:function(){removeSkill(sk.id);},style:{background:"none",border:"none",color:"rgba(200,169,122,0.4)",cursor:"pointer",fontSize:12,padding:0,lineHeight:1,marginLeft:2}},"×"))})),
      React.createElement("div",{style:{display:"flex",gap:6}},
        React.createElement("input",{value:skillInput,onChange:function(e){setSkillInput(e.target.value);},onKeyDown:function(e){if(e.key==="Enter")addSkill();},placeholder:"Add a skill…",style:{flex:1,background:"rgba(255,255,255,0.07)",border:CAREER_BORD,borderRadius:8,padding:"0.4rem 0.6rem",color:CAREER_WHITE,fontSize:12,fontFamily:"inherit",outline:"none"}}),
        React.createElement("button",{onClick:addSkill,style:{background:"rgba(200,169,122,0.15)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:8,padding:"0.4rem 0.7rem",color:CAREER_GOLD,fontSize:12,cursor:"pointer",fontFamily:"inherit"}},"Add"))),
    adding&&React.createElement(CModal,{title:"Add work history",onClose:function(){setAdding(false);}},
      React.createElement(CInput,{label:"Job title",value:form.title,onChange:function(v){setForm(function(f){return{...f,title:v}});},placeholder:"e.g. Senior Designer"}),
      React.createElement(CInput,{label:"Company",value:form.company,onChange:function(v){setForm(function(f){return{...f,company:v}});},placeholder:"e.g. Acme Co."}),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}},
        React.createElement(CInput,{label:"From",value:form.from,onChange:function(v){setForm(function(f){return{...f,from:v}});},placeholder:"2020"}),
        React.createElement(CInput,{label:"To",value:form.to,onChange:function(v){setForm(function(f){return{...f,to:v}});},placeholder:"2023 or present"})),
      React.createElement(CTextarea,{label:"Notes",value:form.desc,onChange:function(v){setForm(function(f){return{...f,desc:v}});},placeholder:"What you built, led, or accomplished…",rows:3}),
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

function CGoalsTab({ pid, career, setCareer }) {
  var goals = (career[pid]||{}).goals || []
  var s0=useState(false); var adding=s0[0]; var setAdding=s0[1];
  var s1=useState({goal:"",area:"Career growth",target:"",notes:"",done:false}); var form=s1[0]; var setForm=s1[1];

  function save() {
    if(!form.goal.trim()) return
    var item={id:cuid(),...form,addedAt:new Date().toISOString().split("T")[0]}
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,goals:[...(p.goals||[]),item]}}})
    setForm({goal:"",area:"Career growth",target:"",notes:"",done:false}); setAdding(false)
  }
  function toggle(id) { setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,goals:(p.goals||[]).map(function(g){return g.id===id?{...g,done:!g.done}:g})}}}) }
  function remove(id) { setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,goals:(p.goals||[]).filter(function(g){return g.id!==id})}}}) }

  var active=goals.filter(function(g){return !g.done})
  var done=goals.filter(function(g){return g.done})

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"}},
    React.createElement("button",{onClick:function(){setAdding(true)},style:{width:"100%",background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:10,padding:"0.6rem",color:CAREER_GOLD,fontSize:13,fontFamily:"inherit",cursor:"pointer",fontWeight:600}},"+ Add a goal"),
    active.length===0&&done.length===0?React.createElement(CEmpty,{text:"No goals yet — what are you working toward?"}):
      React.createElement("div",null,
        active.length>0&&React.createElement(CCard,null,active.map(function(g){return React.createElement("div",{key:g.id,style:{display:"flex",alignItems:"flex-start",gap:10,padding:"0.5rem 0",borderBottom:CAREER_BORD2}},
          React.createElement("button",{onClick:function(){toggle(g.id)},style:{width:18,height:18,borderRadius:4,border:"1.5px solid rgba(200,169,122,0.4)",background:"none",cursor:"pointer",flexShrink:0,marginTop:1}}),
          React.createElement("div",{style:{flex:1}},
            React.createElement("div",{style:{fontSize:13,color:CAREER_WHITE,fontWeight:600}}),g.goal,
            React.createElement("div",{style:{fontSize:11,color:CAREER_GOLD,marginTop:2}}),g.area,
            g.target&&React.createElement("div",{style:{fontSize:11,color:"rgba(250,248,244,0.4)",marginTop:2}},"Target: "+g.target)),
          React.createElement("button",{onClick:function(){remove(g.id)},style:{background:"none",border:"none",color:"rgba(250,248,244,0.2)",cursor:"pointer",fontSize:13,padding:0}},"✕"))})),
        done.length>0&&React.createElement("div",{style:{marginTop:"0.5rem"}},
          React.createElement("div",{style:{fontSize:10,color:"rgba(250,248,244,0.3)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}},"Achieved ("+done.length+")"),
          done.map(function(g){return React.createElement("div",{key:g.id,style:{display:"flex",alignItems:"center",gap:8,padding:"0.35rem 0",opacity:0.5}},
            React.createElement("span",{style:{fontSize:12,color:CAREER_GOLD}},"✓"),
            React.createElement("span",{style:{fontSize:12,color:CAREER_WHITE,textDecoration:"line-through"}}),g.goal)}))),
    adding&&React.createElement(CModal,{title:"Add a career goal",onClose:function(){setAdding(false);}},
      React.createElement(CInput,{label:"Goal",value:form.goal,onChange:function(v){setForm(function(f){return{...f,goal:v}});},placeholder:"e.g. Lead my first product launch"}),
      React.createElement(CSelect,{label:"Area",value:form.area,onChange:function(v){setForm(function(f){return{...f,area:v}});},options:GOAL_AREAS.map(function(a){return{value:a,label:a}})}),
      React.createElement(CInput,{label:"Target date or milestone",value:form.target,onChange:function(v){setForm(function(f){return{...f,target:v}});},placeholder:"e.g. Q3 2026, or 'before next review'"}),
      React.createElement(CTextarea,{label:"Notes",value:form.notes,onChange:function(v){setForm(function(f){return{...f,notes:v}});},placeholder:"What does success look like? What's in the way?",rows:3}),
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
  var s1=useState({label:"",url:"",note:"",type:"resume"}); var form=s1[0]; var setForm=s1[1];
  var DOC_TYPES = [{value:"resume",label:"Resume"},{value:"portfolio",label:"Portfolio"},{value:"linkedin",label:"LinkedIn"},{value:"cover",label:"Cover letter"},{value:"reference",label:"Reference"},{value:"cert",label:"Certification"},{value:"other",label:"Other"}]
  var TYPE_ICON = {resume:"📄",portfolio:"🎨",linkedin:"🔗",cover:"✉️",reference:"👤",cert:"🏅",other:"📎"}

  function save() {
    if(!form.label.trim()) return
    var item={id:cuid(),...form}
    setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,docs:[...(p.docs||[]),item]}}})
    setForm({label:"",url:"",note:"",type:"resume"}); setAdding(false)
  }
  function remove(id) { setCareer(function(c){var p=c[pid]||{}; return{...c,[pid]:{...p,docs:(p.docs||[]).filter(function(d){return d.id!==id})}}}) }

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"0.75rem"}},
    React.createElement("button",{onClick:function(){setAdding(true)},style:{width:"100%",background:"rgba(200,169,122,0.1)",border:"0.5px solid rgba(200,169,122,0.3)",borderRadius:10,padding:"0.6rem",color:CAREER_GOLD,fontSize:13,fontFamily:"inherit",cursor:"pointer",fontWeight:600}},"+ Add a doc or link"),
    docs.length===0?React.createElement(CEmpty,{text:"Store links to your resume, portfolio, certs…"}):
      React.createElement(CCard,null,docs.map(function(doc){
        return React.createElement("div",{key:doc.id,style:{display:"flex",alignItems:"flex-start",gap:10,padding:"0.5rem 0",borderBottom:CAREER_BORD2}},
          React.createElement("span",{style:{fontSize:16,flexShrink:0,marginTop:1}},(TYPE_ICON[doc.type]||"📎")),
          React.createElement("div",{style:{flex:1}},
            React.createElement("div",{style:{fontSize:13,color:CAREER_WHITE,fontWeight:600}}),doc.label,
            doc.url&&React.createElement("a",{href:doc.url,target:"_blank",rel:"noreferrer",style:{fontSize:11,color:CAREER_GOLD,display:"block",marginTop:2}},"Open →"),
            doc.note&&React.createElement("div",{style:{fontSize:11,color:"rgba(250,248,244,0.35)",marginTop:2}}),doc.note),
          React.createElement("button",{onClick:function(){remove(doc.id)},style:{background:"none",border:"none",color:"rgba(250,248,244,0.2)",cursor:"pointer",fontSize:13,padding:0}},"✕"))
      })),
    adding&&React.createElement(CModal,{title:"Add doc or link",onClose:function(){setAdding(false);}},
      React.createElement(CSelect,{label:"Type",value:form.type,onChange:function(v){setForm(function(f){return{...f,type:v}});},options:DOC_TYPES}),
      React.createElement(CInput,{label:"Label",value:form.label,onChange:function(v){setForm(function(f){return{...f,label:v}});},placeholder:"e.g. My resume (2026 version)"}),
      React.createElement(CInput,{label:"URL / link",value:form.url,onChange:function(v){setForm(function(f){return{...f,url:v}});},placeholder:"https://…"}),
      React.createElement(CInput,{label:"Note",value:form.note,onChange:function(v){setForm(function(f){return{...f,note:v}});},placeholder:"e.g. Last updated May 2026"}),
      React.createElement(CSaveBtn,{onClick:save})))
}

// ── CareerSection (main export) ───────────────────────────────────────────────
function CareerSection() {
  var people = hLoadPeople()
  var careerPair = useCareer(); var career = careerPair[0]; var setCareer = careerPair[1];
  var s0=useState(0); var personIdx=s0[0]; var setPersonIdx=s0[1];
  var s1=useState("resume"); var careerTab=s1[0]; var setCareerTab=s1[1];
  var person = people[personIdx]
  if (!person) return null
  var tp = { pid: person.id, career: career, setCareer: setCareer }

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",height:"100%"}},
    // Per-person tabs
    React.createElement("div",{style:{display:"flex",borderBottom:CAREER_BORD,overflowX:"auto",flexShrink:0}},
      people.map(function(p,i){
        return React.createElement("button",{key:p.id,onClick:function(){setPersonIdx(i);},style:{padding:"0.65rem 1rem",fontSize:13,background:"none",border:"none",borderBottom:i===personIdx?"2px solid "+CAREER_GOLD:"2px solid transparent",color:i===personIdx?CAREER_GOLD:"rgba(250,248,244,0.45)",cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit"}},
          React.createElement("span",{style:{width:7,height:7,borderRadius:"50%",background:i===personIdx?CAREER_GOLD:(p.color||"rgba(250,248,244,0.3)"),flexShrink:0,display:"inline-block"}}),
          p.name)
      })),
    // Career subtabs
    React.createElement("div",{style:{display:"flex",borderBottom:"0.5px solid rgba(255,255,255,0.08)",background:"rgba(0,0,0,0.15)",overflowX:"auto",flexShrink:0}},
      C_TABS.map(function(t){
        return React.createElement("button",{key:t.id,onClick:function(){setCareerTab(t.id);},style:{padding:"0.55rem 0.85rem",fontSize:12,background:"none",border:"none",borderBottom:t.id===careerTab?"2px solid rgba(250,248,244,0.5)":"2px solid transparent",color:t.id===careerTab?CAREER_WHITE:"rgba(250,248,244,0.4)",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}},t.label)
      })),
    // Tab content
    React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"1rem 1.25rem",display:"flex",flexDirection:"column",gap:"0.9rem"}},
      careerTab==="resume"   && React.createElement(CResumeTab,  tp),
      careerTab==="jobs"     && React.createElement(CJobsTab,    tp),
      careerTab==="goals"    && React.createElement(CGoalsTab,   tp),
      careerTab==="wins"     && React.createElement(CWinsTab,    tp),
      careerTab==="docs"     && React.createElement(CDocsTab,    tp)))
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
function hLoadPeople() {
  try { var r=localStorage.getItem("af_people"); if(!r) return [{id:"default",name:"You",color:"#6A9BB5"}]; var p=JSON.parse(r); if(Array.isArray(p)&&p.length>0) return p; } catch(e){}
  return [{id:"default",name:"You",color:"#6A9BB5"}];
}

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
    React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},props.badge&&React.createElement(HBadge,{type:props.badge,label:props.badgeLabel}),props.onDelete&&React.createElement("button",{onClick:props.onDelete,style:{background:"none",border:"none",color:"rgba(250,248,244,0.25)",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}},"✕"))
  );
}
function HModal(props) {
  return React.createElement("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999},onClick:props.onClose},
    React.createElement("div",{style:{background:"#1e2e52",border:HBORD,borderRadius:14,padding:"1.25rem 1.5rem",width:"min(480px,92vw)",maxHeight:"85vh",overflowY:"auto"},onClick:function(e){e.stopPropagation();}},
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
  var items=(health[pid]&&health[pid].history)||[];
  function add(){if(!form.name.trim())return;var next=Object.assign({},health);if(!next[pid])next[pid]={};next[pid].history=(next[pid].history||[]).concat([{id:huid(),name:form.name,detail:form.detail,status:form.status}]);setHealth(next);setForm({name:"",detail:"",status:"Stable"});setOpen(false);}
  function remove(id){var next=Object.assign({},health);next[pid].history=next[pid].history.filter(function(x){return x.id!==id;});setHealth(next);}
  var STATUS=["Stable","Managed","Active Rx","Monitoring","Resolved"].map(function(v){return{value:v,label:v};});
  return React.createElement(React.Fragment,null,
    React.createElement(HCard,null,React.createElement(HCardHead,{icon:"🩺",label:"Conditions & diagnoses",onAdd:function(){setOpen(true);}}),items.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No conditions added yet"),items.map(function(it){return React.createElement(HItemRow,{key:it.id,name:it.name,detail:it.detail,badge:"ok",badgeLabel:it.status,onDelete:function(){remove(it.id);}});})),
    open&&React.createElement(HModal,{title:"Add condition / diagnosis",onClose:function(){setOpen(false);}},React.createElement(HInput,{label:"Condition name",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. Asthma"}),React.createElement(HInput,{label:"Details",value:form.detail,onChange:function(v){setForm(function(f){return Object.assign({},f,{detail:v});});},placeholder:"e.g. Diagnosed 2008"}),React.createElement(HSelect,{label:"Status",value:form.status,onChange:function(v){setForm(function(f){return Object.assign({},f,{status:v});});},options:STATUS}),React.createElement(HSaveBtn,{onClick:add}))
  );
}
function HImmunizeTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({name:"",date:"",status:"Up to date"}); var form=s1[0]; var setForm=s1[1];
  var items=(health[pid]&&health[pid].immunizations)||[];
  function add(){if(!form.name.trim())return;var next=Object.assign({},health);if(!next[pid])next[pid]={};next[pid].immunizations=(next[pid].immunizations||[]).concat([{id:huid(),name:form.name,date:form.date,status:form.status}]);setHealth(next);setForm({name:"",date:"",status:"Up to date"});setOpen(false);}
  function remove(id){var next=Object.assign({},health);next[pid].immunizations=next[pid].immunizations.filter(function(x){return x.id!==id;});setHealth(next);}
  var STATUS=["Up to date","Due soon","Overdue","Declined"].map(function(v){return{value:v,label:v};});
  return React.createElement(React.Fragment,null,
    React.createElement(HCard,null,React.createElement(HCardHead,{icon:"💉",label:"Immunizations",onAdd:function(){setOpen(true);}}),items.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No immunizations added yet"),items.map(function(it){return React.createElement(HItemRow,{key:it.id,name:it.name,detail:it.date,badge:it.status==="Up to date"?"ok":"due",badgeLabel:it.status,onDelete:function(){remove(it.id);}});})),
    open&&React.createElement(HModal,{title:"Add immunization",onClose:function(){setOpen(false);}},React.createElement(HInput,{label:"Vaccine name",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. Flu shot"}),React.createElement(HInput,{label:"Date received",value:form.date,onChange:function(v){setForm(function(f){return Object.assign({},f,{date:v});});},placeholder:"e.g. Oct 2024"}),React.createElement(HSelect,{label:"Status",value:form.status,onChange:function(v){setForm(function(f){return Object.assign({},f,{status:v});});},options:STATUS}),React.createElement(HSaveBtn,{onClick:add}))
  );
}
function HMedsTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({name:"",dose:"",frequency:"",type:"Rx"}); var form=s1[0]; var setForm=s1[1];
  var items=(health[pid]&&health[pid].medications)||[];
  function add(){if(!form.name.trim())return;var next=Object.assign({},health);if(!next[pid])next[pid]={};next[pid].medications=(next[pid].medications||[]).concat([{id:huid(),name:form.name,dose:form.dose,frequency:form.frequency,type:form.type}]);setHealth(next);setForm({name:"",dose:"",frequency:"",type:"Rx"});setOpen(false);}
  function remove(id){var next=Object.assign({},health);next[pid].medications=next[pid].medications.filter(function(x){return x.id!==id;});setHealth(next);}
  var TYPES=["Rx","OTC","Supplement","PRN"].map(function(v){return{value:v,label:v};});
  return React.createElement(React.Fragment,null,
    React.createElement(HCard,null,React.createElement(HCardHead,{icon:"💊",label:"Medications",onAdd:function(){setOpen(true);}}),items.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No medications added yet"),items.map(function(it){return React.createElement(HItemRow,{key:it.id,name:it.name,detail:[it.dose,it.frequency].filter(Boolean).join(" · "),badge:"rx",badgeLabel:it.type,onDelete:function(){remove(it.id);}});})),
    open&&React.createElement(HModal,{title:"Add medication",onClose:function(){setOpen(false);}},React.createElement(HInput,{label:"Medication name",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. Albuterol"}),React.createElement(HInput,{label:"Dose",value:form.dose,onChange:function(v){setForm(function(f){return Object.assign({},f,{dose:v});});},placeholder:"e.g. 10mg"}),React.createElement(HInput,{label:"Frequency",value:form.frequency,onChange:function(v){setForm(function(f){return Object.assign({},f,{frequency:v});});},placeholder:"e.g. Daily, PRN"}),React.createElement(HSelect,{label:"Type",value:form.type,onChange:function(v){setForm(function(f){return Object.assign({},f,{type:v});});},options:TYPES}),React.createElement(HSaveBtn,{onClick:add}))
  );
}
function HAllergiesTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({name:"",type:"Drug",severity:"Moderate"}); var form=s1[0]; var setForm=s1[1];
  var items=(health[pid]&&health[pid].allergies)||[];
  function add(){if(!form.name.trim())return;var next=Object.assign({},health);if(!next[pid])next[pid]={};next[pid].allergies=(next[pid].allergies||[]).concat([{id:huid(),name:form.name,type:form.type,severity:form.severity}]);setHealth(next);setForm({name:"",type:"Drug",severity:"Moderate"});setOpen(false);}
  function remove(id){var next=Object.assign({},health);next[pid].allergies=next[pid].allergies.filter(function(x){return x.id!==id;});setHealth(next);}
  var TYPES=["Drug","Food","Environmental","Contact","Other"].map(function(v){return{value:v,label:v};});
  var SEVS=["Mild","Moderate","Severe","Life-threatening"].map(function(v){return{value:v,label:v};});
  return React.createElement(React.Fragment,null,
    React.createElement(HCard,null,React.createElement(HCardHead,{icon:"⚠️",label:"Allergies",onAdd:function(){setOpen(true);}}),items.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No allergies added yet"),items.map(function(it){return React.createElement(HItemRow,{key:it.id,name:it.name,detail:it.type,badge:"allergy",badgeLabel:it.severity,onDelete:function(){remove(it.id);}});})),
    open&&React.createElement(HModal,{title:"Add allergy",onClose:function(){setOpen(false);}},React.createElement(HInput,{label:"Allergen",value:form.name,onChange:function(v){setForm(function(f){return Object.assign({},f,{name:v});});},placeholder:"e.g. Penicillin"}),React.createElement(HSelect,{label:"Type",value:form.type,onChange:function(v){setForm(function(f){return Object.assign({},f,{type:v});});},options:TYPES}),React.createElement(HSelect,{label:"Severity",value:form.severity,onChange:function(v){setForm(function(f){return Object.assign({},f,{severity:v});});},options:SEVS}),React.createElement(HSaveBtn,{onClick:add}))
  );
}
function HFamilyTab(props) {
  var pid=props.personId; var health=props.health; var setHealth=props.setHealth;
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({role:"Mother",name:"",years:"",living:"Living",conditions:[],note:""}); var form=s1[0]; var setForm=s1[1];
  var s2=useState({type:"heart",label:""}); var condIn=s2[0]; var setCondIn=s2[1];
  var relatives=(health[pid]&&health[pid].familyHistory)||[];
  var riskMap={};
  relatives.forEach(function(r){(r.conditions||[]).forEach(function(c){riskMap[c.type]=(riskMap[c.type]||0)+1;});});
  var RISKS=[{key:"heart",label:"Cardiovascular",color:"#F0997B"},{key:"cancer",label:"Cancer",color:"#ED93B1"},{key:"diabetes",label:"Diabetes",color:"#EF9F27"},{key:"neuro",label:"Neurological",color:"#5DCAA5"},{key:"mental",label:"Mental health",color:"#AFA9EC"}];
  var maxCount=Math.max.apply(null,RISKS.map(function(r){return riskMap[r.key]||0;}).concat([1]));
  function addCond(){if(!condIn.label.trim())return;setForm(function(f){return Object.assign({},f,{conditions:f.conditions.concat([{type:condIn.type,label:condIn.label}])});});setCondIn(function(c){return Object.assign({},c,{label:""});});}
  function removeCond(i){setForm(function(f){return Object.assign({},f,{conditions:f.conditions.filter(function(_,idx){return idx!==i;})});});}
  function save(){if(!form.role)return;var next=Object.assign({},health);if(!next[pid])next[pid]={};next[pid].familyHistory=(next[pid].familyHistory||[]).concat([{id:huid(),role:form.role,name:form.name,years:form.years,living:form.living,conditions:form.conditions,note:form.note}]);setHealth(next);setForm({role:"Mother",name:"",years:"",living:"Living",conditions:[],note:""});setCondIn({type:"heart",label:""});setOpen(false);}
  function remove(id){var next=Object.assign({},health);next[pid].familyHistory=next[pid].familyHistory.filter(function(x){return x.id!==id;});setHealth(next);}
  var maternal=relatives.filter(function(r){return ["Maternal grandmother","Maternal grandfather","Mother","Maternal aunt","Maternal uncle"].indexOf(r.role)>=0;});
  var paternal=relatives.filter(function(r){return ["Paternal grandmother","Paternal grandfather","Father","Paternal aunt","Paternal uncle"].indexOf(r.role)>=0;});
  var other=relatives.filter(function(r){return maternal.indexOf(r)<0&&paternal.indexOf(r)<0;});
  var ROLE_OPTS=H_REL_ROLES.map(function(v){return{value:v,label:v};});
  var LIVE_OPTS=["Living","Deceased"].map(function(v){return{value:v,label:v};});
  function RelCard(rp){var rel=rp.rel;return React.createElement("div",{style:{background:HSURF2,border:HBORD2,borderRadius:8,padding:"0.7rem 0.9rem",marginBottom:"0.5rem"}},React.createElement("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"0.45rem"}},React.createElement("div",null,React.createElement("p",{style:{fontSize:13,fontWeight:500,color:HWHITE,margin:"0 0 2px"}},rel.role+(rel.name?" — "+rel.name:"")),React.createElement("p",{style:{fontSize:11,color:"rgba(250,248,244,0.35)",margin:0}},rel.years)),React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},React.createElement(HBadge,{type:rel.living==="Living"?"alive":"deceased",label:rel.living}),React.createElement("button",{onClick:function(){remove(rel.id);},style:{background:"none",border:"none",color:"rgba(250,248,244,0.25)",cursor:"pointer",fontSize:14,padding:"0 2px"}},"✕"))),rel.conditions&&rel.conditions.length>0&&React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:5,marginBottom:rel.note?"0.4rem":0}},rel.conditions.map(function(c,i){return React.createElement(HCondPill,{key:i,type:c.type,label:c.label});})),rel.note&&React.createElement("p",{style:{fontSize:11,color:"rgba(250,248,244,0.3)",margin:"0.35rem 0 0",fontStyle:"italic"}},rel.note));}
  function SideCard(sp){return React.createElement(HCard,null,React.createElement(HCardHead,{icon:sp.icon,label:sp.title,onAdd:function(){setOpen(true);}}),sp.rels.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.5rem 0"}},"None added yet"),sp.rels.map(function(r){return React.createElement(RelCard,{key:r.id,rel:r});}));}
  return React.createElement(React.Fragment,null,
    relatives.length>0&&React.createElement(HCard,{style:{marginBottom:"0.9rem"}},React.createElement(HCardHead,{icon:"📊",label:"Hereditary risk summary"}),RISKS.filter(function(r){return riskMap[r.key];}).map(function(r){var pct=Math.round((riskMap[r.key]/maxCount)*100);return React.createElement("div",{key:r.key,style:{display:"flex",alignItems:"center",padding:"0.3rem 0",borderBottom:HBORD2}},React.createElement("span",{style:{fontSize:12,color:"rgba(250,248,244,0.65)",minWidth:130}},r.label),React.createElement("div",{style:{flex:1,margin:"0 12px",height:3,background:"rgba(255,255,255,0.07)",borderRadius:2}},React.createElement("div",{style:{width:pct+"%",height:3,borderRadius:2,background:r.color}})),React.createElement("span",{style:{fontSize:11,minWidth:60,textAlign:"right",color:r.color}},riskMap[r.key]+(riskMap[r.key]===1?" relative":" relatives")));}),React.createElement("p",{style:{fontSize:11,color:"rgba(250,248,244,0.25)",margin:"0.5rem 0 0",fontStyle:"italic"}},"Not a medical assessment — share with your provider")),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.9rem"}},React.createElement(SideCard,{title:"Maternal side",icon:"👩",rels:maternal}),React.createElement(SideCard,{title:"Paternal side",icon:"👨",rels:paternal})),
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
  var s0=useState(false); var open=s0[0]; var setOpen=s0[1];
  var s1=useState({title:"",date:"",provider:"",location:"",body:"",tags:""}); var form=s1[0]; var setForm=s1[1];
  var s2=useState(false); var editGen=s2[0]; var setEditGen=s2[1];
  var s3=useState(""); var genDraft=s3[0]; var setGenDraft=s3[1];
  var notes=(health[pid]&&health[pid].apptNotes)||[];
  var general=(health[pid]&&health[pid].generalNote)||"";
  function addNote(){if(!form.title.trim())return;var next=Object.assign({},health);if(!next[pid])next[pid]={};var tags=form.tags.split(",").map(function(t){return t.trim();}).filter(Boolean);next[pid].apptNotes=[{id:huid(),title:form.title,date:form.date,provider:form.provider,location:form.location,body:form.body,tags:tags}].concat(next[pid].apptNotes||[]);setHealth(next);setForm({title:"",date:"",provider:"",location:"",body:"",tags:""});setOpen(false);}
  function removeNote(id){var next=Object.assign({},health);next[pid].apptNotes=next[pid].apptNotes.filter(function(x){return x.id!==id;});setHealth(next);}
  function saveGen(){var next=Object.assign({},health);if(!next[pid])next[pid]={};next[pid].generalNote=genDraft;setHealth(next);setEditGen(false);}
  var LOC_OPTS=["In-person","Telehealth","Urgent care","ER","Specialist","Other"].map(function(v){return{value:v,label:v};});
  return React.createElement(React.Fragment,null,
    React.createElement(HCard,null,
      React.createElement(HCardHead,{icon:"📝",label:"Standing health notes",onAdd:editGen?null:function(){setGenDraft(general);setEditGen(true);}}),
      editGen
        ?React.createElement(React.Fragment,null,React.createElement(HTextarea,{value:genDraft,onChange:setGenDraft,rows:4,placeholder:"Allergies, provider preferences, insurance notes..."}),React.createElement("div",{style:{display:"flex",gap:8}},React.createElement(HSaveBtn,{onClick:saveGen,label:"Save note"}),React.createElement("button",{onClick:function(){setEditGen(false);},style:{flex:1,background:"transparent",border:HBORD,borderRadius:8,color:"rgba(250,248,244,0.5)",cursor:"pointer",fontSize:13,fontFamily:"inherit"}},"Cancel")))
        :general?React.createElement("p",{style:{fontSize:13,color:"rgba(250,248,244,0.6)",lineHeight:1.7,margin:0,cursor:"pointer"},onClick:function(){setGenDraft(general);setEditGen(true);}},general):React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.5rem 0",cursor:"pointer"},onClick:function(){setGenDraft("");setEditGen(true);}},"Tap to add standing notes…")
    ),
    React.createElement(HCard,null,
      React.createElement(HCardHead,{icon:"🗒️",label:"Appointment notes",onAdd:function(){setOpen(true);}}),
      notes.length===0&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.3)",textAlign:"center",padding:"0.75rem 0"}},"No appointment notes yet"),
      notes.map(function(n){return React.createElement("div",{key:n.id,style:{background:HSURF2,border:HBORD2,borderRadius:8,padding:"0.75rem 0.9rem",marginBottom:"0.5rem"}},React.createElement("div",{style:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"0.35rem"}},React.createElement("span",{style:{fontSize:13,fontWeight:500,color:HWHITE}},n.title),React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},React.createElement("span",{style:{fontSize:11,color:"rgba(250,248,244,0.35)"}},n.date),React.createElement("button",{onClick:function(){removeNote(n.id);},style:{background:"none",border:"none",color:"rgba(250,248,244,0.25)",cursor:"pointer",fontSize:14,padding:"0 2px"}},"✕"))),(n.provider||n.location)&&React.createElement("p",{style:{fontSize:11,color:HGOLD,margin:"0 0 0.4rem"}},"🏥 "+[n.provider,n.location].filter(Boolean).join(" · ")),n.body&&React.createElement("p",{style:{fontSize:12,color:"rgba(250,248,244,0.55)",lineHeight:1.65,margin:"0 0 0.45rem"}},n.body),n.tags&&n.tags.length>0&&React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:5}},n.tags.map(function(t,i){return React.createElement("span",{key:i,style:{fontSize:11,padding:"2px 8px",borderRadius:12,background:"rgba(255,255,255,0.05)",color:"rgba(250,248,244,0.4)",border:HBORD2}},t);})));})
    ),
    open&&React.createElement(HModal,{title:"Add appointment note",onClose:function(){setOpen(false);}},React.createElement(HInput,{label:"Visit title",value:form.title,onChange:function(v){setForm(function(f){return Object.assign({},f,{title:v});});},placeholder:"e.g. Annual physical"}),React.createElement(HInput,{label:"Date",value:form.date,onChange:function(v){setForm(function(f){return Object.assign({},f,{date:v});});},placeholder:"e.g. Mar 14, 2025"}),React.createElement(HInput,{label:"Provider",value:form.provider,onChange:function(v){setForm(function(f){return Object.assign({},f,{provider:v});});},placeholder:"e.g. Dr. Reyes"}),React.createElement(HSelect,{label:"Visit type",value:form.location,onChange:function(v){setForm(function(f){return Object.assign({},f,{location:v});});},options:LOC_OPTS}),React.createElement(HTextarea,{label:"Notes from visit",value:form.body,onChange:function(v){setForm(function(f){return Object.assign({},f,{body:v});});},placeholder:"What was discussed, prescribed, or ordered…",rows:5}),React.createElement(HInput,{label:"Tags (comma-separated)",value:form.tags,onChange:function(v){setForm(function(f){return Object.assign({},f,{tags:v});});},placeholder:"e.g. blood pressure, A1C, follow-up"}),React.createElement(HSaveBtn,{onClick:addNote,label:"Save note"}))
  );
}

function HealthSection() {
  var people=hLoadPeople();
  var hPair=useHealth(); var health=hPair[0]; var setHealth=hPair[1];
  var s0=useState(0); var personIdx=s0[0]; var setPersonIdx=s0[1];
  var s1=useState("history"); var healthTab=s1[0]; var setHealthTab=s1[1];
  var person=people[personIdx];
  if(!person) return null;
  var tp={personId:person.id,health:health,setHealth:setHealth};
  return React.createElement("div",{style:{display:"flex",flexDirection:"column",height:"100%"}},
    React.createElement("div",{style:{display:"flex",borderBottom:HBORD,overflowX:"auto",flexShrink:0}},
      people.map(function(p,i){return React.createElement("button",{key:p.id,onClick:function(){setPersonIdx(i);},style:{padding:"0.65rem 1rem",fontSize:13,background:"none",border:"none",borderBottom:i===personIdx?"2px solid "+HGOLD:"2px solid transparent",color:i===personIdx?HGOLD:"rgba(250,248,244,0.45)",cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit"}},React.createElement("span",{style:{width:7,height:7,borderRadius:"50%",background:i===personIdx?HGOLD:(p.color||"rgba(250,248,244,0.3)"),flexShrink:0,display:"inline-block"}}),p.name);})
    ),
    React.createElement("div",{style:{display:"flex",borderBottom:"0.5px solid rgba(255,255,255,0.08)",background:"rgba(0,0,0,0.15)",overflowX:"auto",flexShrink:0}},
      H_TABS.map(function(t){return React.createElement("button",{key:t.id,onClick:function(){setHealthTab(t.id);},style:{padding:"0.55rem 0.85rem",fontSize:12,background:"none",border:"none",borderBottom:t.id===healthTab?"2px solid rgba(250,248,244,0.5)":"2px solid transparent",color:t.id===healthTab?HWHITE:"rgba(250,248,244,0.4)",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}},t.label);})
    ),
    React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"1rem 1.25rem",display:"flex",flexDirection:"column",gap:"0.9rem"}},
      healthTab==="history"   &&React.createElement(HHistoryTab,  tp),
      healthTab==="immunize"  &&React.createElement(HImmunizeTab, tp),
      healthTab==="meds"      &&React.createElement(HMedsTab,     tp),
      healthTab==="allergies" &&React.createElement(HAllergiesTab,tp),
      healthTab==="family"    &&React.createElement(HFamilyTab,   tp),
      healthTab==="notes"     &&React.createElement(HNotesTab,    tp)
    )
  );
}

// ── Anchor Dashboard ──────────────────────────────────────────────────────────
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
      return [...saved, ...migrated]
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
    var entries = list.map(function(c) {
      var next = new Date(now.getFullYear(), c.month-1, c.day)
      if (next < now) next.setFullYear(next.getFullYear()+1)
      var diff = Math.round((next - now) / 86400000)
      var age = (c.type === "birthday" && c.year) ? (next.getFullYear() - c.year) : null
      return { ...c, diff, age }
    }).sort(function(a,b) { return a.diff - b.diff })
    var next = entries[0]
    var label = next.name + (next.age ? " turns " + next.age : next.type === "anniversary" ? " anniversary" : "")
    var countdown = next.diff === 0 ? "Today! 🎉" : next.diff === 1 ? "Tomorrow" : "in " + next.diff + " days"
    return { highlight: label, countdown: countdown, count: list.length, soon: next.diff <= 14, entries: entries.slice(0, 3) }
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
  var gifts = giftsSummary()
  var moments = momentsSummary()
  var health = healthSummary()
  var inventory = inventorySummary()
  var careerSum = careerSummary()

  // Format celebration entries for display
  var celebEntries = (celeb.entries || []).map(function(e) {
    var age = (e.type === "birthday" && e.year) ? (new Date().getFullYear() - e.year + (e.diff > 0 ? 1 : 0)) : null
    return {
      label: e.name + (age ? " turns " + age : e.type === "anniversary" ? " anniversary" : ""),
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

  var giftEntries = (gifts.entries || []).map(function(e) {
    return {
      label: e.name + " — " + e.type,
      badge: e.days === 0 ? "Today!" : e.days === 1 ? "Tomorrow" : "in " + e.days + "d",
      badgeAlert: e.days <= 7,
      sub: e.unbought > 0 ? e.unbought + " to buy" : null
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

      <DashCard id="gifts" icon="🎉" label="Celebrations & Gifts" onOpen={onNavigate}
        summary={{
          count: celeb.count + gifts.count,
          highlight: celeb.highlight || gifts.highlight,
          countdown: celeb.countdown || gifts.countdown,
          alert: celeb.soon || gifts.alert,
          entries: [
            ...celebEntries,
            ...giftEntries.map(function(g) { return { ...g, label: "🎁 " + g.label } })
          ]
        }}
        defaultOpen={celeb.soon || gifts.alert} />
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
      const existing = JSON.parse(localStorage.getItem("af_shoppingItems") || "[]")
      const newItem = { id: Date.now().toString(), text: item, done: false, store: "Grocery", category: "grocery" }
      localStorage.setItem("af_shoppingItems", JSON.stringify([...existing, newItem]))
    } catch {}
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 68, right: 0, bottom: 0, zIndex: 150, display: "flex" }}>
      <div style={{ flex: 1, background: "#1e2e50", overflowY: "auto", padding: "24px 20px" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          {activeSection === "home" && <AnchorDashboard onNavigate={setActiveSection} calEvents={calEvents} />}
          {activeSection === "inventory" && <InventorySection onAddToShopping={handleAddToShopping} />}
          {activeSection === "systems" && (
            <div style={{ color: "#faf8f4", fontFamily: "DM Sans,sans-serif" }}>
              <div style={{ fontFamily: "Cormorant Garamond,serif", fontSize: 22, marginBottom: 16 }}>Home Systems</div>
              <div style={{ fontSize: 13, color: "rgba(250,248,244,0.5)", lineHeight: 1.6 }}>Your home system rhythms live here. Add them in the Flow Anchor tab and they will appear here too.</div>
            </div>
          )}
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
