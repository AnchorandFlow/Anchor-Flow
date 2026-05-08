// AILayer/AILayerTab.jsx
// The full AI tab — week load bar, quick actions, all insights.
// Add this as a tab in your bottom nav alongside Anchor, Weekly, Meals, etc.
//
// TO REMOVE: Delete this file and remove the AI tab from your nav.

import { useState } from 'react';

const BRAND = {
  navy: '#1a2744',
  navyLight: '#243258',
  coastal: '#3a6b8a',
  sand: '#c8a97a',
  warm: '#faf8f4',
  warning: '#c8834a',
  success: '#5a8a6a',
  textMuted: '#7a8a9a',
  text: '#2c3e50',
};

// ─── Week Load Bar ────────────────────────────────────────────────────────────
function AILayerWeekBar({ weekLoad }) {
  const heavyDays = weekLoad.filter(d => d.load === 'heavy').map(d => d.day);

  return (
    <div style={{
      background: '#fff',
      border: '1.5px solid #e8e4dc',
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <span style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 15, fontWeight: 700, color: BRAND.navy,
        }}>
          Week at a Glance
        </span>
        {heavyDays.length > 0 && (
          <span style={{
            fontSize: 11, color: BRAND.warning, fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            ⚡ {heavyDays.join(', ')} {heavyDays.length === 1 ? 'is' : 'are'} heavy
          </span>
        )}
      </div>

      <div style={{
        display: 'flex',
        gap: 6,
        alignItems: 'flex-end',
        height: 52,
      }}>
        {weekLoad.map(d => (
          <div key={d.day} style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}>
            <div style={{
              width: '100%',
              height: Math.max(8, d.taskCount * 5),
              maxHeight: 44,
              background: d.load === 'heavy' ? BRAND.warning
                : d.load === 'medium' ? BRAND.coastal
                : BRAND.success,
              borderRadius: '3px 3px 0 0',
              position: 'relative',
              transition: 'height 0.3s ease',
            }}>
              {/* Dot for missing dinner */}
              {!d.hasMeal && (
                <div style={{
                  position: 'absolute',
                  top: -5, right: -2,
                  width: 7, height: 7,
                  borderRadius: '50%',
                  background: BRAND.sand,
                  border: '1.5px solid #fff',
                }} />
              )}
            </div>
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 10,
              color: d.load === 'heavy' ? BRAND.warning : BRAND.textMuted,
              fontWeight: d.load === 'heavy' ? 700 : 400,
            }}>{d.day}</span>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex', gap: 12, marginTop: 10,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 10, color: BRAND.textMuted,
      }}>
        <span>🟡 no dinner</span>
        <span style={{ color: BRAND.success }}>● light</span>
        <span style={{ color: BRAND.coastal }}>● medium</span>
        <span style={{ color: BRAND.warning }}>● heavy</span>
      </div>
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────
function QuickActions({ onLighten, onDecideDinner, onReset, onPlanDay }) {
  const actions = [
    { icon: '⚖️', label: 'Lighten my week', sub: 'Move tasks for me', fn: onLighten, color: BRAND.coastal },
    { icon: '🍽️', label: 'Decide dinner', sub: 'Fill missing nights', fn: onDecideDinner, color: BRAND.success },
    { icon: '🔄', label: 'Help me reset', sub: 'Clear + restart', fn: onReset, color: BRAND.sand },
    { icon: '📋', label: 'Plan my day', sub: 'Set top 3 priorities', fn: onPlanDay, color: BRAND.navy },
  ];

  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 10, color: BRAND.textMuted,
        margin: '0 0 10px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 600,
      }}>Ask AI to...</p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}>
        {actions.map(a => (
          <button
            key={a.label}
            onClick={a.fn}
            style={{
              background: `${a.color}0f`,
              border: `1.5px solid ${a.color}25`,
              borderRadius: 12,
              padding: '11px 12px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `${a.color}1e`;
              e.currentTarget.style.borderColor = `${a.color}60`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = `${a.color}0f`;
              e.currentTarget.style.borderColor = `${a.color}25`;
            }}
          >
            <span style={{ fontSize: 18, display: 'block', marginBottom: 4 }}>{a.icon}</span>
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12.5, fontWeight: 600,
              color: BRAND.text, display: 'block',
            }}>{a.label}</span>
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11, color: BRAND.textMuted,
            }}>{a.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────────
function InsightCard({ insight, onDismiss, onPrimary }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        background: expanded ? `${insight.color}08` : '#fff',
        border: `1.5px solid ${expanded ? insight.color : '#e8e4dc'}`,
        borderRadius: 14,
        padding: '14px 16px',
        marginBottom: 10,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: insight.color,
          marginTop: 6, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 16, fontWeight: 700,
            color: BRAND.navy, margin: '0 0 3px',
          }}>{insight.title}</p>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, color: BRAND.textMuted,
            margin: 0, lineHeight: 1.45,
          }}>{insight.body}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDismiss(insight.id); }}
          style={{
            background: 'none', border: 'none',
            color: BRAND.textMuted, fontSize: 16,
            cursor: 'pointer', padding: 0, lineHeight: 1,
            flexShrink: 0,
          }}
        >×</button>
      </div>

      {expanded && (
        <div
          style={{ marginTop: 12 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onPrimary(insight)}
              style={{
                flex: 1, padding: '8px 0',
                background: insight.color, border: 'none',
                borderRadius: 9, color: '#fff',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {insight.primaryAction}
            </button>
            <button
              onClick={() => onDismiss(insight.id)}
              style={{
                padding: '8px 14px',
                background: 'none',
                border: `1.5px solid ${insight.color}`,
                borderRadius: 9,
                color: insight.color,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13, cursor: 'pointer',
              }}
            >
              {insight.secondaryAction}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main AILayerTab component ────────────────────────────────────────────────
export default function AILayerTab({
  insights = [],
  weekLoad = [],
  loading = false,
  aiThinking = false,
  onLightenWeek,
  onDecideDinner,
  onReset,
  onPlanDay,
  onDismiss,
  onRefresh,
}) {
  const [chatInput, setChatInput] = useState('');

  const handlePrimary = (insight) => {
    if (insight.type === 'overload') onLightenWeek?.();
    if (insight.type === 'meals') onDecideDinner?.();
  };

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;
    // You can wire this to your existing AI chat / brain dump
    console.log('[AILayer] Chat query:', chatInput);
    setChatInput('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#faf8f4',
      fontFamily: "'DM Sans', sans-serif",
      paddingBottom: 90,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');
      `}</style>

      {/* Header */}
      <div style={{
        background: BRAND.navy,
        padding: '20px 18px 22px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div>
            <p style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 22, fontWeight: 700,
              color: '#fff', margin: '0 0 3px',
            }}>✦ AI Assistant</p>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13, color: `${BRAND.sand}cc`, margin: 0,
            }}>
              {loading ? 'Looking at your week…'
                : aiThinking ? 'Working on it…'
                : insights.length > 0
                  ? `I noticed ${insights.length} thing${insights.length > 1 ? 's' : ''}`
                  : "You're all set"}
            </p>
          </div>
          <button
            onClick={onRefresh}
            style={{
              background: `${BRAND.coastal}33`,
              border: `1px solid ${BRAND.coastal}55`,
              borderRadius: 10, padding: '6px 12px',
              color: BRAND.sand,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* AI thinking indicator */}
        {aiThinking && (
          <div style={{
            background: `${BRAND.coastal}12`,
            border: `1.5px solid ${BRAND.coastal}30`,
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13.5, color: BRAND.coastal,
            }}>
              Rearranging things for you…
            </span>
          </div>
        )}

        {/* Week load bar */}
        {weekLoad.length > 0 && <AILayerWeekBar weekLoad={weekLoad} />}

        {/* Quick actions */}
        <QuickActions
          onLighten={onLightenWeek}
          onDecideDinner={onDecideDinner}
          onReset={onReset}
          onPlanDay={onPlanDay}
        />

        {/* Insights */}
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 10, color: BRAND.textMuted,
          margin: '0 0 10px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 600,
        }}>What I noticed</p>

        {loading ? (
          <div style={{
            textAlign: 'center', padding: '32px 0',
            color: BRAND.textMuted, fontSize: 14,
          }}>
            Looking at your week…
          </div>
        ) : insights.length === 0 ? (
          <div style={{
            background: '#fff',
            border: '1.5px solid #e8e4dc',
            borderRadius: 14,
            padding: '28px 20px',
            textAlign: 'center',
          }}>
            <p style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 19, color: BRAND.navy, margin: '0 0 6px',
            }}>You're all clear ✓</p>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13, color: BRAND.textMuted, margin: 0,
            }}>I'll let you know if anything needs attention.</p>
          </div>
        ) : (
          insights.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onDismiss={onDismiss}
              onPrimary={handlePrimary}
            />
          ))
        )}

        {/* Freeform chat */}
        <div style={{
          marginTop: 20,
          background: '#fff',
          border: '1.5px solid #e8e4dc',
          borderRadius: 14,
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            width: 30, height: 30, borderRadius: 9,
            background: BRAND.navy,
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            color: BRAND.sand, fontSize: 14, flexShrink: 0,
          }}>✦</span>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleChatSubmit()}
            placeholder="Ask me anything about your week…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13.5, background: 'transparent',
              color: BRAND.text,
            }}
          />
          <button
            onClick={handleChatSubmit}
            style={{
              background: BRAND.navy, border: 'none',
              borderRadius: 8, padding: '6px 12px',
              color: '#fff',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >Ask</button>
        </div>
      </div>
    </div>
  );
}
