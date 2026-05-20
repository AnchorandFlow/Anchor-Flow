import { useState, useEffect } from 'react'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import RippleBox from './RippleBox'

const SIDEBAR_SECTIONS = [
  { type: 'group', label: 'Vault' },
  { id: 'career', label: 'Career', icon: '💼', children: [
    { id: 'career-overview', label: 'Overview' },
    { id: 'career-history', label: 'Work history' },
    { id: 'career-highlights', label: 'Highlights' },
    { id: 'career-contacts', label: 'Pro contacts' },
  ]},
  { id: 'inventory', label: 'Inventory', icon: '📦', children: [
    { id: 'inventory-weekly', label: 'Weekly checklist' },
    { id: 'inventory-monthly', label: 'Monthly checklist' },
    { id: 'inventory-master', label: 'Master lists' },
  ]},
  { id: 'home-records', label: 'Home records', icon: '🏠' },
  { id: 'health', label: 'Health', icon: '🩺' },
  { id: 'vehicles', label: 'Vehicles', icon: '🚗' },
  { id: 'pets', label: 'Pets', icon: '🐾' },
  { id: 'address-book', label: 'Address book', icon: '📬' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '💳' },
  { id: 'gifts', label: 'Gifts', icon: '🎁' },
  { id: 'school', label: 'School', icon: '🎒' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'licenses', label: 'Licenses & IDs', icon: '📋' },
  { id: 'warranties', label: 'Warranties', icon: '🛡️' },
  { type: 'group', label: 'Cabinet' },
  { id: 'all-docs', label: 'All documents', icon: '📁' },
  { id: 'search', label: 'Search vault', icon: '🔍' },
  { type: 'group', label: 'Settings' },
  { id: 'vault-settings', label: 'Vault settings', icon: '⚙️' },
]

const T = {
  text: 'rgba(250,248,244,0.92)',
  muted: 'rgba(250,248,244,0.50)',
  dim: 'rgba(250,248,244,0.28)',
  accent: '#4a9ebb',
  surface: 'rgba(255,255,255,0.055)',
  border: 'rgba(255,255,255,0.08)',
}

const card = {
  background: T.surface,
  border: `0.5px solid ${T.border}`,
  borderRadius: '10px',
  padding: '13px 14px',
  marginBottom: '9px',
}

const sectionLabel = {
  fontSize: '9px', fontFamily: 'var(--font-sans)',
  letterSpacing: '0.10em', textTransform: 'uppercase',
  color: T.dim, margin: '0 0 9px', display: 'block',
}

function SectionHeader({ bc, title, subtitle, actions, tabs, activeTab, onTab }) {
  return (
    <div style={{ padding: '16px 18px 0', borderBottom: `0.5px solid ${T.border}`, background: 'var(--a-bg2)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: T.dim, marginBottom: '8px', fontFamily: 'var(--font-sans)' }}>
        {bc.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {i > 0 && <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>}
            <span style={i === bc.length - 1 ? { color: T.text, fontWeight: 500 } : {}}>{crumb}</span>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '19px', fontWeight: 500, color: T.text, fontFamily: 'var(--font-sans)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '12px', color: T.muted, marginTop: '2px', fontFamily: 'var(--font-sans)' }}>{subtitle}</div>}
        </div>
        {actions && <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>{actions}</div>}
      </div>
      {tabs && (
        <div style={{ display: 'flex', marginTop: '12px', overflowX: 'auto' }}>
          {tabs.map(tab => (
            <div key={tab.id} onClick={() => onTab?.(tab.id)} style={{ padding: '7px 13px', fontSize: '11px', cursor: 'pointer', borderBottom: activeTab === tab.id ? `2px solid ${T.accent}` : '2px solid transparent', color: activeTab === tab.id ? T.accent : T.muted, fontWeight: activeTab === tab.id ? 500 : 400, whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)', transition: 'all 0.14s' }}>{tab.label}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function Btn({ children, onClick, variant = 'filled' }) {
  const base = { padding: '7px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: 'none' }
  const s = variant === 'ripple'
    ? { ...base, background: 'rgba(123,94,167,0.14)', color: 'rgba(196,168,232,0.9)', border: '0.5px solid rgba(123,94,167,0.26)' }
    : variant === 'outline'
    ? { ...base, background: 'transparent', color: T.accent, border: `0.5px solid ${T.accent}` }
    : { ...base, background: 'rgba(74,158,187,0.14)', color: T.accent }
  return <button style={s} onClick={onClick}>{children}</button>
}

const WEEKLY_ITEMS = [
  { id: 'w1', name: 'Pasta', category: 'Pantry', note: '2 boxes' },
  { id: 'w2', name: 'Rice (5lb bag)', category: 'Pantry', note: '1 bag' },
  { id: 'w3', name: 'Olive oil', category: 'Pantry', note: '1 bottle' },
  { id: 'w4', name: 'Canned tomatoes', category: 'Pantry', note: '4 cans', preChecked: true },
  { id: 'w5', name: 'Eggs (dozen)', category: 'Fridge', note: '' },
  { id: 'w6', name: 'Milk (gallon)', category: 'Fridge', note: '' },
  { id: 'w7', name: 'Butter', category: 'Fridge', note: '', preChecked: true },
  { id: 'w8', name: 'Greek yogurt', category: 'Fridge', note: '' },
  { id: 'w9', name: 'Paper towels', category: 'Household', note: '' },
  { id: 'w10', name: 'Dish soap', category: 'Household', note: '' },
  { id: 'w11', name: 'Laundry pods', category: 'Household', note: '', preChecked: true },
  { id: 'w12', name: 'Trash bags (tall)', category: 'Household', note: '' },
]

function InventoryWeekly({ onPush }) {
  const [checked, setChecked] = useState(
    Object.fromEntries(WEEKLY_ITEMS.filter(i => i.preChecked).map(i => [i.id, true]))
  )
  const [pushed, setPushed] = useState(false)
  const toggle = (id) => { setChecked(prev => ({ ...prev, [id]: !prev[id] })); setPushed(false) }
  const unchecked = WEEKLY_ITEMS.filter(i => !checked[i.id])
  const categories = [...new Set(WEEKLY_ITEMS.map(i => i.category))]
  const handlePush = () => { onPush?.(unchecked.map(i => i.name)); setPushed(true) }

  return (
    <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
      {pushed && (
        <div style={{ background: 'rgba(29,158,117,0.12)', border: '0.5px solid rgba(29,158,117,0.22)', borderRadius: '8px', padding: '9px 12px', marginBottom: '12px', fontSize: '11px', color: '#5dcaa5', fontFamily: 'var(--font-sans)' }}>
          ✓ {unchecked.length} items pushed to Flow shopping list
        </div>
      )}
      {categories.map((cat, ci) => (
        <div key={cat}>
          <span style={{ ...sectionLabel, marginTop: ci > 0 ? '14px' : '0' }}>{cat}</span>
          <div style={{ ...card, padding: '10px 14px' }}>
            {WEEKLY_ITEMS.filter(i => i.category === cat).map((item, idx, arr) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: idx < arr.length - 1 ? `0.5px solid ${T.border}` : 'none' }}>
                <div onClick={() => toggle(item.id)} style={{ width: '18px', height: '18px', borderRadius: '4px', border: `1.5px solid ${checked[item.id] ? T.accent : T.dim}`, background: checked[item.id] ? T.accent : 'transparent', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checked[item.id] && (
                    <svg width="10" height="7" viewBox="0 0 10 7" fill="none">
                      <path d="M1 3.5L3.5 6L9 1" stroke="rgba(15,25,45,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: checked[item.id] ? T.dim : T.text, textDecoration: checked[item.id] ? 'line-through' : 'none', fontFamily: 'var(--font-sans)', flex: 1, transition: 'color 0.15s' }}>{item.name}</div>
                {item.note && <div style={{ fontSize: '10px', color: T.dim, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>{item.note}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={handlePush} style={{ marginTop: '16px', width: '100%', padding: '11px', background: 'rgba(74,158,187,0.14)', color: T.accent, border: `0.5px solid ${T.accent}`, borderRadius: '10px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em' }}>
        → Push unchecked items to Flow shopping list
      </button>
    </div>
  )
}

function Placeholder({ label }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '13px', color: T.muted, fontFamily: 'var(--font-sans)', marginBottom: '8px' }}>{label}</div>
        <div style={{ fontSize: '11px', color: T.dim, fontFamily: 'var(--font-sans)' }}>Connects to your existing app data.</div>
      </div>
    </div>
  )
}

const CAREER_TABS = [
  { id: 'career-overview', label: 'Overview' },
  { id: 'career-history', label: 'Work history' },
  { id: 'career-highlights', label: 'Highlights' },
  { id: 'career-contacts', label: 'Contacts' },
]

const INV_TABS = [
  { id: 'inventory-weekly', label: 'Weekly' },
  { id: 'inventory-monthly', label: 'Monthly' },
  { id: 'inventory-master', label: 'Master lists' },
]

export default function AnchorApp({ onHome, onInventoryPush }) {
  const [activeSection, setActiveSection] = useState('career-overview')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30)
    return () => clearTimeout(t)
  }, [])

  const handleSelect = (id) => {
    if (id === 'career') setActiveSection('career-overview')
    else if (id === 'inventory') setActiveSection('inventory-weekly')
    else setActiveSection(id)
  }

  const renderContent = () => {
    if (activeSection.startsWith('career')) {
      const tab = CAREER_TABS.find(t => t.id === activeSection)
      return (
        <>
          <SectionHeader
            bc={activeSection === 'career-overview' ? ['Vault', 'Career'] : ['Vault', 'Career', tab?.label]}
            title="Career" subtitle="Your living professional record"
            actions={<><Btn variant="ripple">✦ Resume</Btn><Btn>+ Add</Btn></>}
            tabs={CAREER_TABS} activeTab={activeSection} onTab={setActiveSection}
          />
          {activeSection === 'career-overview' ? (
            <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '16px' }}>
                {[['Years exp.','11'],['Roles held','6'],['Highlights','18'],['Contacts','24']].map(([l,v]) => (
                  <div key={l} style={{ background: T.surface, borderRadius: '8px', padding: '10px 11px' }}>
                    <div style={{ fontSize: '10px', color: T.dim, marginBottom: '3px', fontFamily: 'var(--font-sans)' }}>{l}</div>
                    <div style={{ fontSize: '20px', fontWeight: 500, color: T.text, fontFamily: 'var(--font-sans)' }}>{v}</div>
                  </div>
                ))}
              </div>
              <RippleBox theme="anchor" label="career insights" items={[
                { text: 'SHRM-CP expires 2025 — add renewal to highlights so it feeds the resume generator' },
                { text: '3 highlights not marked include on resume — review before next export' },
                { text: 'No highlight logged in 18 days — anything worth capturing from the recent build sprint?' },
              ]} />
              <span style={sectionLabel}>Current role</span>
              <div style={{ ...card, marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(74,158,187,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>💼</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: T.text, fontFamily: 'var(--font-sans)' }}>Founder & Developer</div>
                    <div style={{ fontSize: '11px', color: T.muted, fontFamily: 'var(--font-sans)' }}>Anchor & Flow · Mar 2024 – Present</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {['React','Supabase','Claude API','Product strategy'].map(s => (
                    <span key={s} style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 500, background: 'rgba(74,158,187,0.11)', color: T.accent, border: '0.5px solid rgba(74,158,187,0.18)', fontFamily: 'var(--font-sans)' }}>{s}</span>
                  ))}
                </div>
              </div>
              <span style={sectionLabel}>Recent highlights</span>
              {[
                { title: 'Launched Anchor & Flow — first paying users', type: 'Launch', tc: 'rgba(127,119,221,0.17)', tt: '#afa9ec', body: 'Full-stack PWA solo — concept to commercial in under 90 days.' },
                { title: 'Onboarding redesign — 17 to 11 weeks', type: 'Impact', tc: 'rgba(74,158,187,0.17)', tt: '#7ecae8', body: 'Rebuilt program from scratch. Reduced time-to-productivity 35%.' },
              ].map(h => (
                <div key={h.title} style={card}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: T.text, fontFamily: 'var(--font-sans)' }}>{h.title}</div>
                    <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: h.tc, color: h.tt, fontFamily: 'var(--font-sans)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h.type}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: T.muted, lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>{h.body}</div>
                </div>
              ))}
            </div>
          ) : <Placeholder label={tab?.label || 'Career'} />}
        </>
      )
    }

    if (activeSection.startsWith('inventory')) {
      const tab = INV_TABS.find(t => t.id === activeSection)
      return (
        <>
          <SectionHeader
            bc={activeSection === 'inventory-weekly' ? ['Vault', 'Inventory'] : ['Vault', 'Inventory', tab?.label]}
            title="Inventory" subtitle="Check stock — push needed items to Flow shopping list"
            tabs={INV_TABS} activeTab={activeSection} onTab={setActiveSection}
          />
          {activeSection === 'inventory-weekly' ? (
            <InventoryWeekly onPush={onInventoryPush} />
          ) : activeSection === 'inventory-master' ? (
            <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
              <RippleBox theme="anchor" label="inventory insights" items={[
                { text: 'Olive oil on weekly checklist 4 weeks running — consider switching to monthly Costco run' },
                { text: 'Kids vitamins not checked last month — flagging for this cycle' },
              ]} />
              <Placeholder label="Full master list with frequency and category filters" />
            </div>
          ) : (
            <Placeholder label="Monthly checklist — freezer, bathroom, kids" />
          )}
        </>
      )
    }

    const label = activeSection.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return (
      <>
        <SectionHeader bc={['Vault', label]} title={label} />
        <Placeholder label={`${label} — connects to your existing app data`} />
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--a-bg)', opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}>
      <Topbar theme="anchor" badge="Vault" onHome={onHome} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar theme="anchor" sections={SIDEBAR_SECTIONS} activeId={activeSection} onSelect={handleSelect} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  )
}