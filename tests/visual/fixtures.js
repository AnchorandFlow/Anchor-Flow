// tests/visual/fixtures.js — fixed household data for the screen-capture
// harness. Every key the six Flow full views read is filled with stable ids
// so nothing seeds random uid()s (which would make captures differ per run).
// The clock is pinned to FIXED_NOW (Fri 13 Nov 2026, 09:00 local).
export var FIXED_NOW = new Date(2026, 10, 13, 9, 0, 0).getTime();
export var BETA_HH = "hh_o7yzu28";
export var OTHER_HH = "hh_harness";

var TODAY = "2026-11-13";

var people = [
  { id: "p_lin", name: "Lindsey", role: "Parent", color: "#4A7FA8" },
  { id: "p_twy", name: "Twyla", role: "Parent", color: "#3AAA91" },
  { id: "p_jun", name: "June", role: "Kid", color: "#7A9E8E", birthday: "2018-04-02", schoolType: "homeschool", grade: "3" },
  { id: "p_oll", name: "Ollie", role: "Kid", color: "#C4A882", birthday: "2020-09-15", schoolType: "public", grade: "K" },
];

function tasks(prefix, names, doneCount) {
  return names.map(function (n, i) { return { id: prefix + i, text: n, estimatedMinutes: null, done: i < (doneCount || 0) }; });
}

var waves = {
  daily: [
    { id: "wd1", name: "Morning reset", lastReset: TODAY, tasks: tasks("wd1t", ["Make beds", "Feed pets", "Vitamins"], 2) },
    { id: "wd2", name: "Evening wind-down", lastReset: TODAY, tasks: tasks("wd2t", ["Tidy living areas", "Pack bags for tomorrow"], 0) },
  ],
  weekly: [
    { id: "ww1", name: "Laundry day", dayOfWeek: 5, lastReset: TODAY, tasks: tasks("ww1t", ["Wash & dry all loads", "Change bed sheets"], 1) },
    { id: "ww2", name: "Sunday reset", dayOfWeek: 0, lastReset: TODAY, tasks: tasks("ww2t", ["Meal plan for the week", "Grocery order"], 0) },
  ],
  seasonal: [
    { id: "ws1", name: "Holiday Prep", month: 11, lastReset: TODAY, tasks: tasks("ws1t", ["Gift list", "Decorations out"], 0) },
  ],
  custom: [
    { id: "wc1", name: "Travel Prep", lastReset: TODAY, tasks: tasks("wc1t", ["Passports check", "Stop mail"], 1) },
  ],
};

var coveData = [
  {
    kidId: "p_jun", kidName: "June", shells: 7,
    chores: [
      { id: "cj1", name: "Make bed", pts: 1, done: true },
      { id: "cj2", name: "Clear dishes", pts: 1, done: false },
      { id: "cj3", name: "Feed the cat", pts: 2, done: false },
    ],
    treasures: [
      { id: "tj1", name: "Extra screen time", icon: "📱", cost: 10 },
      { id: "tj2", name: "Pick dinner", icon: "🍕", cost: 15 },
      { id: "tj3", name: "Special outing", icon: "🎡", cost: 35 },
    ],
    rewardHistory: [{ id: "rh1", name: "Movie night pick", icon: "🎬", cost: 20, date: "2026-11-01T18:00:00.000Z" }],
    bonusHistory: [{ id: "bh1", reason: "Helped carry groceries", pts: 2, date: "2026-11-10T18:00:00.000Z" }],
    shellLog: [{ id: "sl1", reason: "Make bed", pts: 1, choreId: "cj1", date: "2026-11-13T08:00:00.000Z" }],
  },
  {
    kidId: "p_oll", kidName: "Ollie", shells: 12,
    chores: [{ id: "co1", name: "Put toys away", pts: 1, done: false }],
    treasures: [{ id: "to1", name: "Stay up late", icon: "🌙", cost: 10 }],
    rewardHistory: [], bonusHistory: [], shellLog: [],
  },
];

// ── Anchor full views (Vault, Safe Harbor, Home, People, Cove, Horizon,
// Settings). Every key those screens read, filled with stable ids so no
// screen seeds its own defaults (HomeTab seeds cleaning zones with uid()s
// when af_home_cleaning is empty). Includes sensitive records: a passport
// number and TSA number (masked in Travel) and a PIN-locked health note.
var anchorData = {
  sections: { anchor: true, calendar: true, weekly: true, meals: true, shop: true, home: true, brain: true, school: true, cove: true, people: true, horizon: true },
  anchor_hidden: {},
  home_info: [
    { id: "hi1", label: "Wi-Fi network", value: "Harbor-5G", category: "Wi-Fi" },
    { id: "hi2", label: "Plumber", value: "Ridge Plumbing 555-0142", category: "Vendors" },
    { id: "hi3", label: "Water shutoff", value: "Garage, left wall", category: "Emergency" },
  ],
  home_cleaning: {
    zones: [
      { id: "z1", name: "Zone 1 · Kitchen", rooms: "Kitchen, dining", tasks: [{ id: "z1t1", text: "Wipe counters", done: true }, { id: "z1t2", text: "Mop floor", done: false }] },
      { id: "z2", name: "Zone 2 · Baths", rooms: "Both bathrooms", tasks: [{ id: "z2t1", text: "Scrub tubs", done: false }, { id: "z2t2", text: "Restock towels", done: false }] },
      { id: "z3", name: "Zone 3 · Living", rooms: "Living room", tasks: [{ id: "z3t1", text: "Vacuum", done: false }] },
    ],
    activeZoneIndex: 1, zonePinned: true, supplies: [], schedule: "",
  },
  vaultSystems: [
    { id: "vs1", name: "HVAC filter", type: "hvac", freq: "3m", lastDone: "2026-08-20", nextDue: "2026-11-20", notes: "" },
    { id: "vs2", name: "Gutter cleaning", type: "other", freq: "6m", lastDone: "2026-06-01", nextDue: "2026-12-01", notes: "" },
  ],
  ownedProducts: [],
  houseFile: [],
  inventory: {
    pantry: [{ id: "iv1", name: "Olive oil", stocked: true, subcat: "condiments" }, { id: "iv2", name: "Flour", stocked: false, subcat: "baking" }],
    cleaning: [{ id: "iv3", name: "Dish soap", stocked: false, subcat: "" }],
  },
  recurring: [
    { id: "rc1", label: "Trash out", emoji: "🗑️", type: "weekly_days", days: [1, 4] },
    { id: "rc2", label: "Water plants", emoji: "🪴", type: "interval", freq: "weekly" },
  ],
  subs: [
    { id: "sb1", name: "Streaming", amount: 15.99, cycle: "monthly", category: "entertainment" },
    { id: "sb2", name: "Cloud storage", amount: 2.99, cycle: "monthly", category: "software" },
  ],
  health: {
    p_lin: { appointments: [{ id: "ha1", date: "2026-12-02", type: "Dentist", provider: "Dr. Shore", notes: "" }], medications: [], allergies: [], immunizations: [], generalNote: "Private note text" },
    p_jun: { appointments: [], medications: [{ id: "hm1", name: "Allergy drops", dose: "1 drop", freq: "daily" }], allergies: [], immunizations: [] },
  },
  career: {
    p_lin: { jobs: [{ id: "cj1", company: "Tidewater Co", title: "Designer", status: "Applied" }], wins: [] },
  },
  pets: [
    { id: "pt1", name: "Biscuit", type: "Dog", vaccines: [{ id: "pv1", name: "Rabies", due: "2026-12-10" }] },
  ],
  trips: [
    { id: "tr1", name: "Coast weekend", startDate: "2026-12-05", endDate: "2026-12-07", destination: "Cannon Beach", travelers: ["p_lin", "p_twy"], packing: [], itinerary: [] },
  ],
  travel_profile: { passportName: "Lindsey", passportNum: "X1234567", passportExp: "2030-05-01", tsaNum: "TT9876543" },
  celebrations: [
    { id: "ce1", type: "birthday", name: "June's birthday", month: 4, day: 2, year: 2018, notes: "" },
    { id: "ce2", type: "anniversary", name: "Our anniversary", month: 12, day: 18, year: null, notes: "" },
  ],
  birthdays: [],
  safe_harbor: {
    lastReviewed: "2026-03-02",
    remindDismissedAt: FIXED_NOW - 86400000,
    contacts: { meetNearby: "Front porch", meetAway: "Library parking lot", evacuatePrimary: "", evacuateBackup: "", outOfStateContact: "Aunt Rae 555-0199" },
    members: [{ id: "shm1", name: "Lindsey", role: "Adult", note: "" }, { id: "shm2", name: "June", role: "Child", note: "Inhaler" }],
    grabItems: null, // filled from DEFAULT_GRAB_ITEMS by safeHarborWithItems()
    hazards: ["wildfire"],
    reviewDue: false,
    removedDefaultIds: [],
  },
  cove_lists_v1: [
    { id: "cl1", title: "Camping gear", category: "family", color_accent: "#3a6b8a", created_at: "2026-10-01T00:00:00.000Z" },
  ],
  cove_sections_v1: { cl1: [{ id: "cs1", title: "Shelter", sort_order: 0 }] },
  cove_items_v1: { cl1: [{ id: "ci1", content: "Tent", checked: true, section_id: "cs1", sort_order: 0 }, { id: "ci2", content: "Sleeping pads", checked: false, section_id: "cs1", sort_order: 1 }] },
  cove_notes_v1: [
    { id: "cn1", title: "Gift ideas", body: "Kite for Ollie", color: "#3a6b8a", createdAt: FIXED_NOW - 86400000 * 3, updatedAt: FIXED_NOW - 86400000 * 2 },
  ],
};

// Safe Harbor's 21 default grab-and-go items (fixed ids g01..g21), with a
// few checked so the 10/30/60 tiers show progress.
export function safeHarborWithItems(defaults) {
  var sh = JSON.parse(JSON.stringify(anchorData.safe_harbor));
  sh.grabItems = defaults.map(function (i) { return Object.assign({}, i, { checked: ["g01", "g03", "g07", "g10"].indexOf(i.id) !== -1 }); });
  return sh;
}

export var MY_PERSON_ID = "p_lin";
export var AUTH_USER_ID = "u_harness";

// anchor: true adds the Anchor full-view keys above (the Flow captures run
// without them, exactly as they were recorded).
export function householdData(householdId, opts) {
  var base = flowData(householdId);
  if (opts && opts.anchor) Object.keys(anchorData).forEach(function (k) { base[k] = anchorData[k]; });
  return base;
}

function flowData(householdId) {
  return {
    householdId: householdId,
    householdOwnerId: "u_harness",
    myPersonId: null, // stored raw by main.jsx (not JSON)
    myPersonId_authUserId: null,
    authUser: { id: "u_harness", email: "harness@example.invalid", displayName: "Lindsey" },
    authToken: "harness-token",
    lastHHSync: FIXED_NOW - 60000,
    lastPushedAt: FIXED_NOW - 60000,
    onboardingState: { complete: true, completedAt: "2026-01-01T00:00:00.000Z" },
    firstVoyageDone: true,
    welcomeSeen: true,
    preferredName: "Lindsey",
    theme: "calm",
    people: people,
    showEmojis: false,
    mealsEnabled: true,
    tidePoolEnabled: true,
    lighthouseEnabled: true,
    compassEnabled: false,
    ripplesEnabled: true,
    stores: ["Grocery", "Costco", "Target", "Amazon"],
    shoppingItems: [
      { id: "s1", text: "Bananas", store: "Grocery", done: false, photo: null, category: "produce" },
      { id: "s2", text: "Greek yogurt", store: "Grocery", done: false, photo: null, category: "dairy" },
      { id: "s3", text: "Sourdough", store: "Grocery", done: true, photo: null, category: "bakery" },
      { id: "s4", text: "Paper towels", store: "Costco", done: false, photo: null, category: "" },
      { id: "s5", text: "Birthday candles", store: "Target", done: false, photo: null, category: "" },
    ],
    meals: {
      Monday: { breakfast: "Oatmeal", lunch: "", dinner: "Chicken soup" },
      Tuesday: { breakfast: "", lunch: "", dinner: "Tacos" },
      Wednesday: { breakfast: "", lunch: "", dinner: "" },
      Thursday: { breakfast: "", lunch: "", dinner: "Pasta night" },
      Friday: { breakfast: "Pancakes", lunch: "Leftovers", dinner: "Homemade pizza" },
      Saturday: { breakfast: "", lunch: "", dinner: "" },
      Sunday: { breakfast: "", lunch: "", dinner: "Roast chicken" },
    },
    nextWeekMeals: { Monday: { dinner: "Chili" } },
    mealSubTab: "week",
    mealBankCustom: [],
    recipeBook: [{ id: "rb1", name: "Grandma's chili", ingredients: "beans\ntomatoes", steps: "Simmer", tags: [] }],
    calEvents: [
      { id: "e1", date: "2026-11-13", time: "15:30", title: "Soccer practice", color: "#4A7FA8", forPerson: "p_jun" },
      { id: "e2", date: "2026-11-14", time: "10:00", title: "Farmers market", color: "#3AAA91", forPerson: "p_twy" },
      { id: "e3", date: "2026-11-11", time: "", title: "Library day", color: "#7A9E8E", repeat: "weekly", forPerson: "p_oll" },
      { id: "e4", date: "2026-11-20", time: "18:00", title: "Pumpkin pancakes", color: "#C4A882" },
    ],
    work_schedules: {
      p_lin: { scheduleType: "set", days: { Monday: [{ start: "09:00", end: "17:00" }], Wednesday: [{ start: "09:00", end: "17:00" }], Friday: [{ start: "09:00", end: "13:00" }] }, notes: "" },
      p_twy: { scheduleType: "on-call", onCallDays: ["Tuesday", "Thursday"], notes: "" },
    },
    workDays: { "2026-11-17": { type: "office", startHour: 9, endHour: 17, location: "", note: "" } },
    cal_markers: { "2026-11-26": ["🦃"] },
    exhale_waves: waves,
    coveData: coveData,
    choreResetDate: null, // set raw below (not JSON) — see seed()
    schoolData: {},
    lighthouse: { version: 2, modes: { p_jun: "homeschool", p_oll: "school" }, shared: {}, homeschool: { p_jun: { monthlyGoals: [{ id: "g1", text: "Finish the multiplication unit", done: true }, { id: "g2", text: "Read three chapter books", done: false }] } }, school: {}, household: { readAlouds: [], calendar: [], settings: {} } },
  };
}
