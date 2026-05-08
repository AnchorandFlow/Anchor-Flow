// ─────────────────────────────────────────────────────────────────────────────
// HOW TO INTEGRATE AILayer INTO YOUR EXISTING App.jsx
// ─────────────────────────────────────────────────────────────────────────────
//
// This file shows the EXACT changes to make. Do NOT replace your App.jsx —
// just add the lines marked with // ← ADD THIS
//
// TO REMOVE AILAYER LATER: reverse these changes and delete /src/components/AILayer/
// ─────────────────────────────────────────────────────────────────────────────

// STEP 1 — Add imports at the top of App.jsx
// ─────────────────────────────────────────────────────────────────────────────
import { AILayerDrawer, AILayerTab, AILayerNudge, useAILayer } from './components/AILayer'; // ← ADD THIS


// STEP 2 — Add useAILayer hook inside your App component
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  // ... your existing state ...

  const {                       // ← ADD THIS BLOCK
    insights,
    weekLoad,
    loading,
    aiThinking,
    drawerOpen,
    setDrawerOpen,
    lightenWeek,
    decideDinner,
    dismissInsight,
    fetchInsights,
  } = useAILayer();


  // STEP 3 — Add AILayerNudge at the TOP of each relevant tab's JSX
  // ─────────────────────────────────────────────────────────────────────────────
  // Inside your Anchor tab render:
  const AnchorTab = () => (
    <div>
      <AILayerNudge                     // ← ADD THIS
        insights={insights}
        tab="anchor"
        onAction={(insight) => {
          if (insight.type === 'overload') lightenWeek();
          if (insight.type === 'plan') {/* your plan day logic */}
        }}
        onDismiss={dismissInsight}
      />
      {/* ... rest of your existing Anchor tab JSX ... */}
    </div>
  );

  // Inside your Weekly tab render:
  const WeeklyTab = () => (
    <div>
      <AILayerNudge                     // ← ADD THIS
        insights={insights}
        tab="weekly"
        onAction={(insight) => lightenWeek()}
        onDismiss={dismissInsight}
      />
      {/* ... rest of your existing Weekly tab JSX ... */}
    </div>
  );

  // Inside your Meals tab render:
  const MealsTab = () => (
    <div>
      <AILayerNudge                     // ← ADD THIS
        insights={insights}
        tab="meals"
        onAction={(insight) => decideDinner()}
        onDismiss={dismissInsight}
      />
      {/* ... rest of your existing Meals tab JSX ... */}
    </div>
  );


  // STEP 4 — Add the AI tab to your tab switcher
  // ─────────────────────────────────────────────────────────────────────────────
  // In your tab content render (wherever you switch between tab views):
  const renderTab = () => {
    switch (activeTab) {
      case 'anchor':  return <AnchorTab />;
      case 'weekly':  return <WeeklyTab />;
      case 'meals':   return <MealsTab />;
      // ... your other tabs ...
      case 'ai':      return (                // ← ADD THIS CASE
        <AILayerTab
          insights={insights}
          weekLoad={weekLoad}
          loading={loading}
          aiThinking={aiThinking}
          onLightenWeek={lightenWeek}
          onDecideDinner={decideDinner}
          onReset={() => {/* wire to your existing reset flow */}}
          onPlanDay={() => {/* wire to your existing daily plan logic */}}
          onDismiss={dismissInsight}
          onRefresh={fetchInsights}
        />
      );
    }
  };


  // STEP 5 — Add AI tab to your bottom nav
  // ─────────────────────────────────────────────────────────────────────────────
  // In your bottom nav JSX, add this nav item:
  //
  //   <button
  //     onClick={() => setActiveTab('ai')}
  //     className={activeTab === 'ai' ? 'active' : ''}
  //   >
  //     <span>✦</span>
  //     <span>AI</span>
  //     {insights.length > 0 && <span className="badge">{insights.length}</span>}
  //   </button>


  // STEP 6 — Add AILayerDrawer just before your closing </div> in App return
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* ... all your existing JSX ... */}

      {renderTab()}

      {/* Bottom nav */}
      {/* ... your existing nav ... */}

      <AILayerDrawer                    // ← ADD THIS (just before closing </div>)
        insights={insights}
        aiThinking={aiThinking}
        onDismiss={dismissInsight}
        onPrimary={(insight) => {
          if (insight.type === 'overload') lightenWeek();
          if (insight.type === 'meals') decideDinner();
        }}
        onOpenTab={() => setActiveTab('ai')}
        activeTab={activeTab}
      />
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE: The AILayer expects these tables to exist.
// You likely have tasks and meal_plans already — just verify these columns:
// ─────────────────────────────────────────────────────────────────────────────
//
// tasks table needs:
//   - scheduled_date (date)
//   - completed (boolean)
//   - priority (integer, lower = higher priority)
//   - user_id (uuid)
//
// meal_plans table needs:
//   - planned_date (date)
//   - meal_name (text)
//   - effort_level (text: 'low' | 'medium' | 'rescue')
//   - source (text) — add 'ai' as a possible value
//   - user_id (uuid)
//
// meals table needs:
//   - name (text)
//   - effort_level (text)
//   - user_id (uuid)
// ─────────────────────────────────────────────────────────────────────────────
