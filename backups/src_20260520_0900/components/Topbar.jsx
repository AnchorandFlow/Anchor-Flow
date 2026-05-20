import { useState } from 'react'

export default function Topbar({ theme = 'anchor', badge, onHome, syncLabel = 'synced 2m ago' }) {
  const [backHovered, setBackHovered] = useState(false)
  const isAnchor = theme === 'anchor'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 18px', flexShrink: 0,
      background: isAnchor ? 'var(--a-bg)' : 'var(--navy)',
      borderBottom: `0.5px solid ${isAnchor ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.07)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={onHome}
          onMouseEnter={() => setBackHovered(true)}
          onMouseLeave={() => setBackHovered(false)}
          style={{
            fontFamily: 'var(--font-sans)', fontSize: '11px', padding: '4px 10px',
            borderRadius: '20px', border: '0.5px solid rgba(255,255,255,0.08)',
            cursor: 'pointer', background: 'transparent', transition: 'all 0.15s',
            color: backHovered ? 'rgba(250,248,244,0.92)' : 'rgba(250,248,244,0.50)',
            borderColor: backHovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
          }}
        >
          ← home
        </button>

        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 500,
          color: 'var(--warm-white)', letterSpacing: '0.03em',
        }}>
          anchor{' '}
          <em style={{ color: isAnchor ? 'var(--a-accent)' : 'var(--sand)', fontStyle: 'italic' }}>&</em>
          {' '}flow
        </div>

        {badge && (
          <span style={{
            fontSize: '9px', padding: '2px 8px', borderRadius: '20px',
            fontFamily: 'var(--font-sans)', letterSpacing: '0.06em',
            ...(isAnchor
              ? { background: 'rgba(74,158,187,0.14)', color: '#4a9ebb', border: '0.5px solid rgba(74,158,187,0.24)' }
              : { background: 'rgba(200,169,122,0.12)', color: 'var(--sand)', border: '0.5px solid rgba(200,169,122,0.28)' }
            ),
          }}>
            {badge}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {syncLabel && (
          <span style={{ fontSize: '11px', color: 'rgba(250,248,244,0.30)', fontFamily: 'var(--font-sans)' }}>
            {syncLabel}
          </span>
        )}
        <div style={{
          width: '26px', height: '26px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 500, fontFamily: 'var(--font-sans)',
          color: 'var(--sand)',
          ...(isAnchor
            ? { background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.15)' }
            : { background: 'rgba(200,169,122,0.16)', border: '1.5px solid rgba(200,169,122,0.35)' }
          ),
        }}>
          LM
        </div>
      </div>
    </div>
  )
}
