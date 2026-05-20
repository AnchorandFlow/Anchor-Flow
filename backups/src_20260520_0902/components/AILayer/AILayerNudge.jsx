// AILayer/AILayerNudge.jsx
// A small inline nudge card that appears at the TOP of Anchor, Weekly,
// and Meals tabs when there's an urgent AI insight relevant to that tab.
//
// Usage:
//   <AILayerNudge insights={insights} tab="anchor" onAction={handleAction} />
//
// TO REMOVE: Delete this file and remove <AILayerNudge /> from each tab.

const BRAND = {
  navy: '#1a2744',
  coastal: '#3a6b8a',
  sand: '#c8a97a',
  warning: '#c8834a',
  success: '#5a8a6a',
};

// Map each tab to the insight types it should surface
const TAB_INSIGHT_MAP = {
  anchor: ['overload', 'plan'],
  weekly: ['overload'],
  meals: ['meals'],
};

export default function AILayerNudge({ insights = [], tab, onAction, onDismiss }) {
  const relevantTypes = TAB_INSIGHT_MAP[tab] || [];
  const nudge = insights.find(ins => relevantTypes.includes(ins.type));

  if (!nudge) return null;

  return (
    <div style={{
      background: `${nudge.color}0e`,
      border: `1.5px solid ${nudge.color}30`,
      borderRadius: 12,
      padding: '10px 13px',
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      {/* Pulse dot */}
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: nudge.color, flexShrink: 0,
      }} />

      {/* Text */}
      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13, color: nudge.color,
        margin: 0, flex: 1, lineHeight: 1.4,
      }}>
        {nudge.body}
      </p>

      {/* Action button */}
      <button
        onClick={() => onAction?.(nudge)}
        style={{
          background: 'none',
          border: `1.5px solid ${nudge.color}`,
          borderRadius: 8,
          padding: '5px 10px',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12, fontWeight: 600,
          color: nudge.color,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {nudge.primaryAction}
      </button>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss?.(nudge.id)}
        style={{
          background: 'none', border: 'none',
          color: `${nudge.color}80`, fontSize: 15,
          cursor: 'pointer', padding: 0, flexShrink: 0,
          lineHeight: 1,
        }}
      >×</button>
    </div>
  );
}
