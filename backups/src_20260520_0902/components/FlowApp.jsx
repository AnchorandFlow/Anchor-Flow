import { useState, useEffect } from 'react'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import RippleBox from './RippleBox'

const SIDEBAR_SECTIONS = [
  { type: 'group', label: 'Flow' },
  { id: 'flow', label: 'Flow', icon: '⚓' },
  { id: 'today', label: 'Home', icon: '🏠',children: [
    { id: 'today-anchor', label: 'Anchor view' },
    { id: 'today-tasks', label: 'Tasks' },
    { id: 'today-meals', label: 'Meals today' },
  ]},
{ id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'brain', label: 'Brain dump', icon: '🧠', children: [
    { id: 'brain-person', label: 'By person' },
    { id: 'brain-type', label: 'By type' },
  ]},
  { id: 'meal-planning', label: 'Meal planning', icon: '🍽' },
  { id: 'shopping', label: 'Shopping', icon: '🛒', children: [
    { id: 'shopping-list', label: 'Shopping list' },
    { id: 'shopping-past', label: 'Past lists' },
  ]},
  { id: 'weekly', label: 'Weekly', icon: '🗓' },
  { type: 'group', label: 'Wellbeing' }, icon: '🌊' },
  { type: 'group', label: 'Ripple AI' },
  { id: 'ripple', label: 'Ask Ripple', icon: '✦', isRipple: true, children: [
    { id: 'ripple-briefing', label: 'Daily briefing', isRipple: true },
    { id: 'ripple-suggestions', label: 'Suggestions', isRipple: true },
  ]},
  { type: 'group', label: 'Settings' },
  { id: 'flow-settings', label: 'Flow settings', icon: '⚙️' },
]

const T = {
  text: '#1a2744', muted: '#5a6678', dim: '#9aa3af',
  accent: '#3a6b8a', sand: '#c8a97a',
  white: '#ffffff', border: 'rgba(26,39,68,0.09)',
  accentLight: 'rgba(58,107,138,0.10)',
}

const card = { background: T.white, border: `0.5px solid ${T.border}`, borderRadius: '10px', padding: '13px 14px', marginBottom: '9px' }
const sectionLabel = { fontSize: '9px', fontFamily: 'var(--font-sans)', letterSpacing: '0.10em', textTransform: 'uppercase', color: T.dim, margin: '0 0 9px', display: 'block' }

function SectionHeader({ bc, title, subtitle, actions, tabs, activeTab, onTab }) {
  return (
    <div style={{ padding: '16px 18px 0', borderBottom: `0.5px solid ${T.border}`, background: T.white, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: T.dim, marginBottom: '8px', fontFamily: 'var(--font-sans)' }}>
        {bc.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {i > 0 && <span style={{ color: 'rgba(26,39,68,0.16)' }}>›</span>}
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
            <div key={tab.id} onClick={() => onTab?.(tab.id)} style={{
              padding: '7px 13px', fontSize: '11px', cursor: 'pointer',
              borderBottom: activeTab === tab.id ? `2px solid ${T.accent}` : '2px solid transparent',
              color: activeTab === tab.id ? T.accent : T.muted,
              fontWeight: activeTab === tab.id ? 500 : 400,
              whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)', transition: 'all 0.14s',
            }}>{tab.label}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function BtnF({ children, onClick, variant = 'filled' }) {
  const base = { padding: '7px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: 'none' }
  const styles = {
    filled: { ...base, background: 'var(--navy)', color: '#faf8f4' },
    outline: { ...base, background: 'transparent', color: T.accent, border: `0.5px solid ${T.accent}` },
    ripple: { ...base, background: 'rgba(123,94,167,0.08)', color: 'rgba(123,94,167,0.85)', border: '0.5px solid rgba(123,94,167,0.2)' },
  }
  return <button style={styles[variant] || styles.filled} onClick={onClick}>{children}</button>
}

function TaskRow({ label, done: initDone, time, badge }) {
  const [done, setDone] = useState(initDone || false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `0.5px solid ${T.border}` }}>
      <div onClick={() => setDone(d => !d)} style={{ width: '15px', height: '15px', borderRadius: '50%', border: `1.5px solid ${done ? T.accent : T.dim}`, background: done ? T.accent : 'transparent', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s' }} />
      <div style={{ fontSize: '12px', color: done ? T.dim : T.text, textDecoration: done ? 'line-through' : 'none', fontFamily: 'var(--font-sans)', flex: 1, transition: 'color 0.15s' }}>{label}</div>
      {badge && <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: '#eaf3de', color: '#3b6d11', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>{badge}</span>}
      {time && !badge && <span style={{ fontSize: '10px', color: T.muted, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>{time}</span>}
    </div>
  )
}

function TodayView({ onNavigate }) {
  const [mode, setMode] = useState('Steady')
  return (
    <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '23px', fontWeight: 500, color: T.text }}>
          Good morning, <em style={{ color: T.sand, fontStyle: 'italic' }}>Lindsey.</em>
        </div>
        <div style={{ fontSize: '11px', color: T.muted, fontFamily: 'var(--font-sans)' }}>84° · Sunny</div>
      </div>
      <div style={{ fontSize: '12px', color: T.muted, fontFamily: 'var(--font-sans)', marginBottom: '18px', marginTop: '3px' }}>6 things on deck — you've got this.</div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {['Steady', 'Deep work', 'Survival', 'Rest day'].map(m => (
          <div key={m} onClick={() => setMode(m)} style={{ flex: 1, textAlign: 'center', padding: '7px 4px', borderRadius: '8px', background: mode === m ? T.accentLight : 'transparent', border: `0.5px solid ${mode === m ? 'rgba(58,107,138,0.22)' : T.border}`, fontSize: '10px', color: mode === m ? T.accent : T.muted, fontFamily: 'var(--font-sans)', cursor: 'pointer', fontWeight: mode === m ? 500 : 400, transition: 'all 0.16s' }}>{m}</div>
        ))}
      </div>
      <button style={{ width: '100%', padding: '11px', background: 'var(--navy)', color: '#faf8f4', border: 'none', borderRadius: '10px', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', marginBottom: '14px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Start my day</button>
      <RippleBox theme="flow" label="smart daily briefing" items={[
        { text: "Noah's DHPP due this month — schedule before co-op deadline May 3", action: { label: 'add task', onClick: () => {} } },
        { text: "Mom's birthday in 12 days — no gift purchased yet", action: { label: 'gifts', onClick: () => {} } },
        { text: 'Weekly inventory has items to check', action: { label: 'view shopping list', onClick: () => onNavigate('shopping-list') } },
      ]} />
      <span style={sectionLabel}>Top 3 today</span>
      <div style={{ ...card, padding: '8px 14px', marginBottom: '14px' }}>
        <TaskRow label="Morning school block" done={true} badge="Done" />
        <TaskRow label="Deploy Vault career section" time="afternoon" />
        <TaskRow label="Order Mom's birthday gift — Kindle" time="today" />
      </div>
      <span style={sectionLabel}>Next 3</span>
      <div style={{ ...card, padding: '8px 14px', marginBottom: '14px' }}>
        <TaskRow label="Schedule Noah's DHPP appointment" time="this week" />
        <TaskRow label="Write 3 new Vault career highlights" time="this week" />
        <TaskRow label="Co-op health form for Ellie" time="by May 3" />
      </div>
      <span style={sectionLabel}>Meals today</span>
      <div style={{ ...card, padding: '8px 14px' }}>
        <TaskRow label="Breakfast — overnight oats" done={true} badge="Done" />
        <TaskRow label="Lunch — sandwiches + fruit" time="12:30" />
        <TaskRow label="Dinner — sheet pan chicken" time="6:00" />
      </div>
    </div>
  )
}

function ShoppingListView({ inventoryItems = [] }) {
  const preloaded = [
    { name: 'Canned tomatoes', category: 'pantry' },
    { name: 'Butter', category: 'dairy' },
  ]
  const [checked, setChecked] = useState({})
  const allInv = [...preloaded, ...inventoryItems.map(name => ({ name, category: 'inventory' }))]
  const toggle = (k) => setChecked(prev => ({ ...prev, [k]: !prev[k] }))

  return (
    <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: T.accent, flexShrink: 0 }} />
        <span style={{ ...sectionLabel, margin: 0, color: T.accent }}>From inventory check</span>
        <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: '#e6f1fb', color: '#185fa5', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>{allInv.length} items</span>
      </div>
      <div style={{ ...card, padding: '8px 14px', marginBottom: '16px' }}>
        {allInv.length === 0 ? (
          <div style={{ fontSize: '12px', color: T.dim, fontFamily: 'var(--font-sans)', padding: '6px 0' }}>
            No items pushed yet — go to Anchor → Inventory → Weekly and tap "Push to shopping list"
          </div>
        ) : allInv.map((item, i) => {
          const k = `inv-${i}`
          const done = checked[k]
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: i < allInv.length - 1 ? `0.5px solid ${T.border}` : 'none' }}>
              <div onClick={() => toggle(k)} style={{ width: '18px', height: '18px', borderRadius: '4px', border: `1.5px solid ${done ? T.accent : T.dim}`, background: done ? T.accent : 'transparent', flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {done && <svg width="10" height="7" viewBox="0 0 10 7" fill="none"><path d="M1 3.5L3.5 6L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div style={{ flex: 1, fontSize: '12px', color: done ? T.dim : T.text, textDecoration: done ? 'line-through' : 'none', fontFamily: 'var(--font-sans)', transition: 'color 0.15s' }}>{item.name}</div>
              <div style={{ fontSize: '10px', color: T.dim, fontFamily: 'var(--font-sans)' }}>{item.category}</div>
            </div>
          )
        })}
      </div>
      <span style={sectionLabel}>Added manually</span>
      <div style={{ ...card, padding: '8px 14px' }}>
        {[{ name: 'Bananas', cat: 'produce' }, { name: 'Ellie — sneakers (size 4)', cat: 'clothing' }, { name: 'Birthday card for Mom', cat: 'misc' }].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: `0.5px solid ${T.border}` }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `1.5px solid ${T.dim}`, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: '12px', color: T.text, fontFamily: 'var(--font-sans)' }}>{item.name}</div>
            <div style={{ fontSize: '10px', color: T.dim, fontFamily: 'var(--font-sans)' }}>{item.cat}</div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0' }}>
          <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `1.5px solid ${T.accent}`, background: T.accent, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="7" viewBox="0 0 10 7" fill="none"><path d="M1 3.5L3.5 6L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ flex: 1, fontSize: '12px', color: T.dim, textDecoration: 'line-through', fontFamily: 'var(--font-sans)' }}>Almond milk</div>
          <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: '#eaf3de', color: '#3b6d11', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>Got it</span>
        </div>
      </div>
    </div>
  )
}

function RipplePage() {
  return (
    <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
      <RippleBox theme="flow" label="cross-vault suggestions" items={[
        { text: 'Weekly inventory has 7 unchecked items — push to shopping list from Anchor Vault' },
        { text: "Noah's DHPP + co-op health form deadline May 3 → schedule this week" },
        { text: 'Olive oil on weekly checklist 4 weeks — switch to monthly Costco run?' },
        { text: 'Marriott Bonvoy expires Jan 2025 — San Diego trip in July is perfect timing' },
        { text: 'Disney+ price increase flagged — review or cancel before May 1' },
      ]} />
      <span style={{ ...sectionLabel, marginTop: '4px' }}>Ask Ripple anything</span>
      <div style={{ background: 'rgba(123,94,167,0.05)', border: '0.5px solid rgba(123,94,167,0.14)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontSize: '12px', color: 'rgba(123,94,167,0.35)', fontFamily: 'var(--font-sans)', flex: 1 }}>What should I prioritize this week?</span>
        <button style={{ padding: '6px 12px', background: 'rgba(123,94,167,0.08)', color: 'rgba(123,94,167,0.85)', border: '0.5px solid rgba(123,94,167,0.2)', borderRadius: '8px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Ask ↗</button>
      </div>
      <span style={sectionLabel}>Recent Ripple actions</span>
      <div style={{ ...card, padding: '8px 14px' }}>
        {[
          { text: 'Pushed 2 inventory items to shopping list', time: 'today' },
          { text: "Flagged Mom's birthday — 12 days out", time: 'today' },
          { text: 'Suggested olive oil move to monthly checklist', time: '2 days ago' },
        ].map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < 2 ? `0.5px solid ${T.border}` : 'none' }}>
            <span style={{ fontSize: '11px', color: 'rgba(123,94,167,0.45)', flexShrink: 0 }}>✦</span>
            <div style={{ flex: 1, fontSize: '11px', color: T.text, fontFamily: 'var(--font-sans)' }}>{a.text}</div>
            <div style={{ fontSize: '10px', color: T.muted, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>{a.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Placeholder({ label }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '13px', color: T.muted, fontFamily: 'var(--font-sans)', marginBottom: '8px' }}>{label}</div>
        <div style={{ fontSize: '11px', color: T.dim, fontFamily: 'var(--font-sans)' }}>Your existing app content loads here.</div>
      </div>
    </div>
  )
}

const TODAY_TABS = [
  { id: 'today-anchor', label: 'Anchor view' },
  { id: 'today-tasks', label: 'Tasks' },
  { id: 'today-meals', label: 'Meals' },
]

const SHOP_TABS = [
  { id: 'shopping-list', label: 'This week' },
  { id: 'shopping-past', label: 'Past lists' },
]

const SECTION_LABELS = {
  calendar: 'Calendar', weekly: 'Weekly', 'meal-planning': 'Meal planning',
  'home-tasks': 'Home tasks', burnout: 'Burnout check', 'flow-settings': 'Flow settings',
  'brain-person': 'Brain dump', 'brain-type': 'Brain dump',
}

export default function FlowApp({ onHome, inventoryItems = [] }) {
  const [activeSection, setActiveSection] = useState('flow')
  const [visible, setVisible] = useState(false)

  useEffect(() => { const t = setTimeout(() => setVisible(true), 30); return () => clearTimeout(t) }, [])

  const handleSelect = (id) => {
    if (id === 'flow') setActiveSection('flow')
    else if (id === 'today') setActiveSection('today-anchor')
    else if (id === 'shopping') setActiveSection('shopping-list')
    else if (id === 'ripple') setActiveSection('ripple-suggestions')
    else if (id === 'brain') setActiveSection('brain-person')
    else setActiveSection(id)
  }

  const renderContent = () => {
    if (activeSection === 'flow') {
      return (
        <>
          <SectionHeader bc={['Flow']} title="Flow" subtitle="Your home, anchored." />
          <TodayView onNavigate={setActiveSection} />
        </>
      )
    }
    if (activeSection.startsWith('today')) {
      return (
        <>
          <SectionHeader bc={['Flow', 'Today']} title="Today" subtitle="Wednesday, April 22 · 84° · Sunny"
            actions={<BtnF>Start my day</BtnF>}
            tabs={TODAY_TABS} activeTab={activeSection} onTab={setActiveSection}
          />
          {activeSection === 'today-anchor'
            ? <TodayView onNavigate={setActiveSection} />
            : <Placeholder label={activeSection === 'today-tasks' ? 'Full task list' : 'Meal detail view'} />
          }
        </>
      )
    }

    if (activeSection.startsWith('shopping')) {
      return (
        <>
          <SectionHeader bc={['Flow', 'Shopping']} title="Shopping list"
            subtitle={`This week · ${inventoryItems.length + 2} items from inventory`}
            actions={<BtnF>+ Add item</BtnF>}
            tabs={SHOP_TABS} activeTab={activeSection} onTab={setActiveSection}
          />
          {activeSection === 'shopping-list'
            ? <ShoppingListView inventoryItems={inventoryItems} />
            : <Placeholder label="Past shopping lists" />
          }
        </>
      )
    }

    if (activeSection.startsWith('ripple')) {
      return (
        <>
          <SectionHeader bc={['Flow', 'Ripple AI']} title="Ripple AI" subtitle="Surfacing what matters across your whole home" />
          <RipplePage />
        </>
      )
    }

    const label = SECTION_LABELS[activeSection] || activeSection
    return (
      <>
        <SectionHeader bc={['Flow', label]} title={label} />
        <Placeholder label={`${label} — your existing app content loads here`} />
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--f-bg)', opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease' }}>
      <Topbar theme="flow" badge="Daily Flow" onHome={onHome} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar theme="flow" sections={SIDEBAR_SECTIONS} activeId={activeSection} onSelect={handleSelect} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--f-bg)' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
