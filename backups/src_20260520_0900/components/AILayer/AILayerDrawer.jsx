// AILayer/AILayerDrawer.jsx
// The floating ✦ button that appears on every tab EXCEPT the AI tab.
// Tap it to open a slide-up drawer with the top 2 urgent insights.
//
// TO REMOVE: Delete this file and remove <AILayerDrawer /> from App.jsx

import { useState, useEffect } from 'react';

const BRAND = {
  navy: '#1a2744',
  coastal: '#3a6b8a',
  sand: '#c8a97a',
  warm: '#faf8f4',
  warning: '#c8834a',
};

function InsightMini({ insight, onDismiss, onPrimary }) {
  return (
    <div style={{
      background: '#fff',
      border: '1.5px solid #e8e4dc',
      borderRadius: 14,
      padding: '12px 14px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: insight.color, marginTop: 5, flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <p style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 15, fontWeight: 700,
            color: BRAND.navy, margin: '0 0 3px',
          }}>{insight.title}</p>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12.5, color: '#7a8a9a',
            margin: '0 0 10px', lineHeight: 1.4,
          }}>{insight.body}</p>
          <div style={{ display: 'flex', gap: 7 }}>
            <button
              onClick={() => onPrimary(insight)}
              style={{
                flex: 1, padding: '7px 0',
                background: insight.color, border: 'none',
                borderRadius: 8, color: '#fff',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {insight.primaryAction}
            </button>
            <button
              onClick={() => onDismiss(insight.id)}
              style={{
                padding: '7px 12px',
                background: 'none',
                border: '1.5px solid #e8e4dc',
                borderRadius: 8, color: '#7a8a9a',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12.5, cursor: 'pointer',
              }}
            >
              {insight.secondaryAction}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AILayerDrawer({
  insights = [],
  aiThinking = false,
  onDismiss,
  onPrimary,
  onOpenTab,        // callback to switch to the AI tab
  activeTab,        // current tab name — hides button on 'ai' tab
}) {
  const [open, setOpen] = useState(false);
  const urgentInsights = insights.slice(0, 2); // Show max 2 in drawer

  // Close drawer when tab changes
  useEffect(() => {
    setOpen(false);
  }, [activeTab]);

  // Hide entirely on AI tab
  if (activeTab === 'ai') return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open AI assistant"
        style={{
          position: 'fixed',
          bottom: 80, // above bottom nav
          right: 18,
          width: 48, height: 48,
          borderRadius: '50%',
          background: BRAND.navy,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: BRAND.sand,
          fontSize: 20,
          boxShadow: '0 4px 16px rgba(26,39,68,0.3)',
          zIndex: 100,
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        ✦
        {/* Unread badge */}
        {urgentInsights.length > 0 && (
          <span style={{
            position: 'absolute',
            top: 2, right: 2,
            width: 16, height: 16,
            borderRadius: '50%',
            background: BRAND.warning,
            border: '2px solid #fff',
            fontSize: 9,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}>
            {urgentInsights.length}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.2)',
            zIndex: 101,
          }}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: '#faf8f4',
          borderRadius: '18px 18px 0 0',
          borderTop: '1.5px solid #e8e4dc',
          padding: '14px 16px 90px',
          zIndex: 102,
          transform: open ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: '70vh',
          overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div style={{
          width: 40, height: 4,
          background: '#ddd',
          borderRadius: 2,
          margin: '0 auto 16px',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}>
          <p style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 18, fontWeight: 700,
            color: BRAND.navy, margin: 0,
          }}>
            {urgentInsights.length > 0
              ? `✦ ${urgentInsights.length} thing${urgentInsights.length > 1 ? 's' : ''} need attention`
              : '✦ You\'re all clear'}
          </p>
        </div>

        {/* AI thinking state */}
        {aiThinking && (
          <div style={{
            background: `${BRAND.coastal}12`,
            border: `1.5px solid ${BRAND.coastal}30`,
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13, color: BRAND.coastal,
            }}>
              Working on it…
            </span>
          </div>
        )}

        {/* Insights */}
        {urgentInsights.length === 0 && !aiThinking ? (
          <div style={{
            textAlign: 'center',
            padding: '24px 0',
          }}>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14, color: '#7a8a9a',
            }}>
              Nothing urgent right now. Check back later.
            </p>
          </div>
        ) : (
          urgentInsights.map(insight => (
            <InsightMini
              key={insight.id}
              insight={insight}
              onDismiss={(id) => { onDismiss(id); }}
              onPrimary={(ins) => { onPrimary(ins); setOpen(false); }}
            />
          ))
        )}

        {/* Open full AI tab */}
        <button
          onClick={() => { setOpen(false); onOpenTab(); }}
          style={{
            width: '100%',
            padding: '10px 0',
            background: 'none',
            border: '1.5px solid #e8e4dc',
            borderRadius: 10,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, color: '#7a8a9a',
            cursor: 'pointer',
            marginTop: 4,
          }}
        >
          Open full AI tab →
        </button>
      </div>
    </>
  );
}
