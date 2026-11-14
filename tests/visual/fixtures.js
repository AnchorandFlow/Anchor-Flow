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

export function householdData(householdId) {
  return {
    householdId: householdId,
    householdOwnerId: "u_harness",
    myPersonId: "p_lin",
    myPersonId_authUserId: "u_harness",
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
      { id: "e1", date: "2026-11-13", time: "15:30", title: "Soccer practice", color: "#4A7FA8", who: "p_jun" },
      { id: "e2", date: "2026-11-14", time: "10:00", title: "Farmers market", color: "#3AAA91" },
      { id: "e3", date: "2026-11-11", time: "", title: "Library day", color: "#7A9E8E", repeat: "weekly" },
      { id: "e4", date: "2026-11-20", time: "18:00", title: "Pumpkin pancakes", color: "#C4A882" },
    ],
    work_schedules: {
      p_lin: { scheduleType: "set", days: { Monday: [{ start: "09:00", end: "17:00" }], Wednesday: [{ start: "09:00", end: "17:00" }], Friday: [{ start: "09:00", end: "13:00" }] }, notes: "" },
      p_twy: { scheduleType: "on-call", onCallDays: ["Tuesday", "Thursday"], notes: "" },
    },
    exhale_waves: waves,
    coveData: coveData,
    choreResetDate: null, // set raw below (not JSON) — see seed()
    schoolData: {},
    lighthouse: { version: 2, modes: { p_jun: "homeschool", p_oll: "school" }, shared: {}, homeschool: {}, school: {}, household: { readAlouds: [], calendar: [], settings: {} } },
  };
}
