import { useEffect, useState } from 'react'

function PulseDot({ color }) {
  const [bright, setBright] = useState(true)
  useEffect(() => {
    const id = setInterval(() => setBright(b => !b), 1200)
    return () => clearInterval(id)
  }, [])
  return (
    <span style={{
      display: 'inline-block', width: '5px', height: '5px',
      borderRadius: '50%', background: color, flexShrink: 0,
      opacity: bright ? 1 : 0.45,
      transition: 'opacity 0.8s ease-in-out',
    }} />
  )
}

export default function RippleBox({ theme = 'anchor', label = 'Ripple AI', items = [] }) {
  const isAnchor = theme === 'anchor'
  const dotColor = isAnchor ? 'rgba(196,168,232,0.9)' : 'rgba(123,94,167,0.7)'
  const labelColor = isAnchor ? 'rgba(196,168,232,0.9)' : 'rgba(123,94,167,0.8)'
  const numColor = isAnchor ? 'rgba(196,168,232,0.9)' : 'rgba(123,94,167,0.8)'
  const textColor = isAnchor ? 'rgba(250,248,244,0.50)' : '#5a6678'
  return (
    <div style={{
      borderRadius: '10px', padding: '12px 14px', marginBottom: '12px',
      ...(isAnchor
        ? { background: 'rgba(123,94,167,0.10)', border: '0.5px solid rgba(123,94,167,0.22)' }
        : { background: 'rgba(123,94,167,0.06)', border: '0.5px solid rgba(123,94,167,0.15)' }
      ),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '9px' }}>
        <PulseDot color={dotColor} />
        <span style={{ fontSize: '9px', letterSpacing: '0.10em', textTransform: 'uppercase', color: labelColor, fontFamily: 'var(--font-sans)' }}>
          Ripple AI · {label}
        </span>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: i < items.length - 1 ? '6px' : 0 }}>
          <span style={{ fontSize: '10px', fontWeight: 500, color: numColor, fontFamily: 'var(--font-sans)', flexShrink: 0, marginTop: '1px' }}>✦</span>
          <span style={{ fontSize: '11px', color: textColor, fontFamily: 'var(--font-sans)', lineHeight: 1.55 }}>
            {item.text}
            {item.action && (
              <button onClick={item.action.onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', padding: '1px 7px', borderRadius: '4px', marginLeft: '4px', cursor: 'pointer', border: 'none', color: isAnchor ? 'rgba(196,168,232,0.9)' : 'rgba(123,94,167,0.85)', background: isAnchor ? 'rgba(123,94,167,0.14)' : 'rgba(123,94,167,0.08)', fontFamily: 'var(--font-sans)' }}>
                ✦ {item.action.label}
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
