// AILayer/useAILayer.js
// Rewired to match App.jsx patterns exactly:
//   - No supabase client import — reads tasks + meals from localStorage
//   - Same localStorage key pattern as useSaved ("af_" + key)
//   - Pass in { authToken, tasks, meals, flowMode } from your HomeFlow state

import { useState, useEffect, useCallback } from "react";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ─── Read localStorage the same way useSaved does ───────────────────────────
function readLocal(key) {
  try {
    const s = localStorage.getItem("af_" + key);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function writeLocal(key, val) {
  try { localStorage.setItem("af_" + key, JSON.stringify(val)); } catch {}
}

// ─── Build week load from localStorage tasks + meals ────────────────────────
function buildWeekLoad() {
  const tasks = readLocal("tasks") || [];
  const meals = readLocal("meals") || {};
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  return DAYS.map((dayName, i) => {
    const dayTasks = tasks.filter(t =>
      !t.archived && !t.done &&
      (t.day === dayName || t.day === dayName.slice(0, 3))
    );
    const hasMeal = !!(
      meals[dayName]?.dinner ||
      meals[dayName]?.lunch  ||
      meals[dayName]?.breakfast
    );
    const count = dayTasks.length;
    return {
      day: dayName.slice(0, 3),
      fullDay: dayName,
      taskCount: count,
      hasMeal,
      load: count >= 7 ? "heavy" : count >= 4 ? "medium" : "light",
    };
  });
}

// ─── Main hook ───────────────────────────────────────────────────────────────
// Usage inside HomeFlow():
//   const aiLayer = useAILayer({ authToken, flowMode });
//   Then destructure what you need.

export function useAILayer({ authToken, flowMode } = {}) {
  const [insights,   setInsights]   = useState([]);
  const [weekLoad,   setWeekLoad]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [aiThinking, setAiThinking] = useState(false);

  // ─── Fetch insights from Claude API ────────────────────────────────────
  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const load = buildWeekLoad();
      setWeekLoad(load);

      const heavyDays     = load.filter(d => d.load === "heavy").map(d => d.fullDay);
      const unplannedDays = load.filter(d => !d.hasMeal).map(d => d.fullDay);
      const weekSummary   = load
        .map(d => `${d.fullDay}: ${d.taskCount} tasks, dinner ${d.hasMeal ? "planned" : "MISSING"}, load: ${d.load}`)
        .join("\n");

      const prompt = `You are the AI layer of Anchor & Flow, a calm household planning app for busy families.

Flow mode: ${flowMode || "Smooth"}
Week:
${weekSummary}

Heavy days: ${heavyDays.join(", ") || "none"}
Missing dinners: ${unplannedDays.join(", ") || "none"}

Generate 1–3 short, warm, actionable insights. Be direct — like a helpful friend who noticed something.
Only surface "overload" if there are heavy days. Only surface "meals" if dinners are missing.
Always include at least one insight.

Each insight needs:
- type: "overload" | "meals" | "plan"
- title: max 6 words
- body: max 20 words, specific to their week
- primaryAction: max 4 words
- secondaryAction: max 3 words

Respond ONLY with a valid JSON array. No markdown, no backticks.
Example: [{"type":"overload","title":"Wednesday looks heavy","body":"9 tasks plus pickup — want me to shift 3 things to Thursday?","primaryAction":"Shift tasks","secondaryAction":"Show me"}]`;

      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data   = await res.json();
      const text   = data.content?.[0]?.text || "[]";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

      setInsights(parsed.map((ins, i) => ({
        ...ins,
        id: `ai-${Date.now()}-${i}`,
        color: ins.type === "overload" ? "#c8834a"
             : ins.type === "meals"    ? "#3a6b8a"
             : "#5a8a6a",
      })));
    } catch (err) {
      console.error("[AILayer] fetchInsights:", err);
      setInsights([{
        id: "fallback-1",
        type: "plan",
        title: "Let's look at your week",
        body: "Tap 'Lighten my week' and I'll help sort things out.",
        primaryAction: "Lighten my week",
        secondaryAction: "Not now",
        color: "#3a6b8a",
      }]);
    } finally {
      setLoading(false);
    }
  }, [flowMode]);

  useEffect(() => { fetchInsights(); }, []); // eslint-disable-line

  // ─── Lighten week: move up to 3 tasks from heavy → light day ───────────
  const lightenWeek = useCallback(() => {
    setAiThinking(true);
    try {
      const load  = buildWeekLoad();
      const heavy = load.find(d => d.load === "heavy");
      const light = load.find(d => d.load === "light" && d.fullDay !== heavy?.fullDay);
      if (!heavy || !light) return;

      const allTasks  = readLocal("tasks") || [];
      const toMove    = allTasks
        .filter(t => !t.archived && !t.done &&
          (t.day === heavy.fullDay || t.day === heavy.day))
        .slice(0, 3);

      const original  = [...allTasks];
      const updated   = allTasks.map(t =>
        toMove.find(m => m.id === t.id) ? { ...t, day: light.fullDay } : t
      );
      writeLocal("tasks", updated);

      setInsights(prev => [{
        id: `done-${Date.now()}`,
        type: "plan",
        title: "Week lightened ✓",
        body: `Moved ${toMove.length} task${toMove.length > 1 ? "s" : ""} from ${heavy.fullDay} to ${light.fullDay}.`,
        primaryAction: "Got it",
        secondaryAction: "Undo",
        color: "#5a8a6a",
        _undo: original,
      }, ...prev.filter(i => i.type !== "overload")]);
      setWeekLoad(buildWeekLoad());
    } catch (err) {
      console.error("[AILayer] lightenWeek:", err);
    } finally {
      setTimeout(() => setAiThinking(false), 500);
    }
  }, []);

  // ─── Decide dinner: Claude picks meals for unplanned nights ────────────
  const decideDinner = useCallback(async () => {
    setAiThinking(true);
    try {
      const load      = buildWeekLoad();
      const unplanned = load.filter(d => !d.hasMeal);
      if (!unplanned.length) return;

      const saved     = readLocal("meals") || {};
      const mealNames = Object.values(saved)
        .flatMap(d => Object.values(d)).filter(Boolean).slice(0, 15).join(", ")
        || "pasta, tacos, sheet pan chicken, soup, stir fry";

      const prompt = `Suggest dinner for these nights: ${unplanned.map(d => `${d.fullDay} (${d.load} day)`).join(", ")}.
Family's recent meals: ${mealNames}
Match effort to load (heavy = rescue/easy meal, light = anything).
Respond ONLY with JSON array, no markdown:
[{"day":"Monday","meal":"meal name"}]`;

      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 400,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data        = await res.json();
      const text        = data.content?.[0]?.text || "[]";
      const suggestions = JSON.parse(text.replace(/```json|```/g, "").trim());

      const current = readLocal("meals") || {};
      suggestions.forEach(s => {
        if (!current[s.day]) current[s.day] = {};
        current[s.day].dinner = s.meal;
      });
      writeLocal("meals", current);

      setInsights(prev => [{
        id: `meals-done-${Date.now()}`,
        type: "plan",
        title: "Dinners sorted ✓",
        body: `Added ${suggestions.length} dinner${suggestions.length > 1 ? "s" : ""}. Check your Meals tab.`,
        primaryAction: "See meals",
        secondaryAction: "Got it",
        color: "#5a8a6a",
      }, ...prev.filter(i => i.type !== "meals")]);
      setWeekLoad(buildWeekLoad());
    } catch (err) {
      console.error("[AILayer] decideDinner:", err);
    } finally {
      setTimeout(() => setAiThinking(false), 600);
    }
  }, []);

  // ─── Dismiss ──────────────────────────────────────────────────────────
  const dismissInsight = useCallback((id) => {
    setInsights(prev => prev.filter(i => i.id !== id));
  }, []);

  // ─── Handle primary button on any card ───────────────────────────────
  const handleInsightAction = useCallback((insight) => {
    if (insight.type === "overload") { lightenWeek(); return; }
    if (insight.type === "meals")    { decideDinner(); return; }
    if (insight._undo && insight.secondaryAction === "Undo") {
      writeLocal("tasks", insight._undo);
      setInsights(prev => prev.filter(i => i.id !== insight.id));
      fetchInsights();
      return;
    }
    dismissInsight(insight.id);
  }, [lightenWeek, decideDinner, dismissInsight, fetchInsights]);

  return {
    insights,
    weekLoad,
    loading,
    aiThinking,
    fetchInsights,
    lightenWeek,
    decideDinner,
    dismissInsight,
    handleInsightAction,
  };
}
