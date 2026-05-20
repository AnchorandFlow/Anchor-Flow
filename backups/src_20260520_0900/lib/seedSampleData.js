import { supabase } from "./supabase"

export async function seedSampleData(userId, householdId) {
  const today = new Date()
  const fmt = (d) => d.toISOString().split("T")[0]
  const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d }

  try {
    await supabase.from("af_tasks").insert([
      { household_id: householdId, user_id: userId, title: "Morning school block", due_date: fmt(today), bucket: "top3", completed: true, sort_order: 1 },
      { household_id: householdId, user_id: userId, title: "Check in on this week meals", due_date: fmt(today), bucket: "top3", completed: false, sort_order: 2 },
      { household_id: householdId, user_id: userId, title: "Run through the weekly inventory", due_date: fmt(today), bucket: "top3", completed: false, sort_order: 3 },
      { household_id: householdId, user_id: userId, title: "Schedule any pending appointments", due_date: fmt(addDays(2)), bucket: "next3", completed: false, sort_order: 1 },
      { household_id: householdId, user_id: userId, title: "Review the shopping list", due_date: fmt(addDays(3)), bucket: "next3", completed: false, sort_order: 2 },
      { household_id: householdId, user_id: userId, title: "Set a rhythm for next week", due_date: fmt(addDays(5)), bucket: "next3", completed: false, sort_order: 3 },
    ])
    await supabase.from("af_meals").insert([
      { household_id: householdId, meal_date: fmt(today), meal_type: "breakfast", name: "Overnight oats", completed: true },
      { household_id: householdId, meal_date: fmt(today), meal_type: "lunch", name: "Sandwiches and fruit", completed: false },
      { household_id: householdId, meal_date: fmt(today), meal_type: "dinner", name: "Sheet pan chicken", completed: false },
    ])
    await supabase.from("af_inventory_items").insert([
      { household_id: householdId, user_id: userId, name: "Pasta", category: "Pantry", frequency: "weekly", stocked: false },
      { household_id: householdId, user_id: userId, name: "Olive oil", category: "Pantry", frequency: "weekly", stocked: false },
      { household_id: householdId, user_id: userId, name: "Canned tomatoes", category: "Pantry", frequency: "weekly", stocked: true },
      { household_id: householdId, user_id: userId, name: "Paper towels", category: "Household", frequency: "weekly", stocked: false },
      { household_id: householdId, user_id: userId, name: "Dish soap", category: "Household", frequency: "weekly", stocked: true },
    ])
    await supabase.from("af_shopping_items").insert([
      { household_id: householdId, name: "Bananas", category: "Produce", added_by: "sample", completed: false },
      { household_id: householdId, name: "Milk (gallon)", category: "Dairy", added_by: "sample", completed: false },
    ])
    await supabase.from("af_households").update({ sample_data_seeded: true }).eq("id", householdId)
    return true
  } catch (err) {
    console.warn("Seed failed:", err.message)
    return false
  }
}
