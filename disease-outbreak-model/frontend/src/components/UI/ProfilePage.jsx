import { useState, useEffect, useMemo } from 'react'
import useStore from '../../store/useStore'
import './ProfilePage.css'

// ============================================
// ACTIVITY RING — Apple Watch style
// ============================================
function ActivityRing({ value, max, color, glowColor, radius, strokeWidth, label, icon, delay = 0 }) {
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(value / max, 1)
  const size = (radius + strokeWidth) * 2

  return (
    <div className="prof-ring-item">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{
            transition: `stroke-dashoffset 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}ms`,
            filter: `drop-shadow(0 0 6px ${glowColor})`,
          }}
        />
      </svg>
      <div className="prof-ring-label">
        <span className="prof-ring-icon">{icon}</span>
        <span className="prof-ring-value" style={{ color }}>{value}</span>
        <span className="prof-ring-text">{label}</span>
      </div>
    </div>
  )
}

// ============================================
// NESTED TRIPLE RING — concentric rings
// ============================================
function TripleRing({ states, alerts, days, animate }) {
  const size = 160
  const rings = [
    { value: states, max: 50, color: '#00ffcc', glow: '#00ffcc40', radius: 68, sw: 7, label: 'States', delay: 200 },
    { value: alerts, max: 100, color: '#0ea5e9', glow: '#0ea5e940', radius: 55, sw: 7, label: 'Alerts', delay: 400 },
    { value: days, max: 365, color: '#f0c040', glow: '#f0c04040', radius: 42, sw: 7, label: 'Days', delay: 600 },
  ]

  return (
    <div className="prof-triple-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((r, i) => {
          const circ = 2 * Math.PI * r.radius
          const pct = animate ? Math.min(r.value / r.max, 1) : 0
          return (
            <g key={i}>
              <circle cx={size/2} cy={size/2} r={r.radius}
                fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={r.sw} />
              <circle cx={size/2} cy={size/2} r={r.radius}
                fill="none" stroke={r.color} strokeWidth={r.sw}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - pct)}
                transform={`rotate(-90 ${size/2} ${size/2})`}
                style={{
                  transition: `stroke-dashoffset 1.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${r.delay}ms`,
                  filter: `drop-shadow(0 0 5px ${r.glow})`,
                }}
              />
            </g>
          )
        })}
      </svg>
      <div className="prof-triple-center">
        <span className="prof-triple-number">{states}</span>
        <span className="prof-triple-label">States Analyzed</span>
      </div>
    </div>
  )
}

// ============================================
// TOGGLE SWITCH
// ============================================
function Toggle({ on, onChange, label }) {
  return (
    <div className="prof-toggle-row" onClick={onChange}>
      <span className="prof-toggle-label">{label}</span>
      <div className={`prof-toggle ${on ? 'on' : ''}`}>
        <div className="prof-toggle-thumb" />
      </div>
    </div>
  )
}

// ============================================
// SIMULATED ACTIVITY LOG
// ============================================
const ACTIVITY_LOG = [
  { action: 'Viewed', target: 'California', type: 'state', time: '2 min ago', icon: '◉' },
  { action: 'Explored counties in', target: 'Texas', type: 'county', time: '15 min ago', icon: '◈' },
  { action: 'Added to watchlist', target: 'Florida', type: 'watchlist', time: '1 hr ago', icon: '◆' },
  { action: 'Viewed', target: 'New York', type: 'state', time: '1 hr ago', icon: '◉' },
  { action: 'Compared', target: 'OH, MI, PA', type: 'compare', time: '3 hrs ago', icon: '◇' },
  { action: 'Exported report for', target: 'Georgia', type: 'export', time: '5 hrs ago', icon: '◈' },
  { action: 'Viewed', target: 'Washington', type: 'state', time: '1 day ago', icon: '◉' },
  { action: 'Explored counties in', target: 'North Carolina', type: 'county', time: '1 day ago', icon: '◈' },
  { action: 'Checked timeline for', target: 'Massachusetts', type: 'state', time: '2 days ago', icon: '◉' },
  { action: 'Updated notification prefs', target: '', type: 'settings', time: '3 days ago', icon: '⚙' },
]

const ACTION_COLORS = {
  state: '#00ffcc',
  county: '#0ea5e9',
  watchlist: '#f0c040',
  compare: '#c084fc',
  export: '#f0a030',
  settings: 'rgba(255,255,255,0.4)',
}

// ============================================
// DATA SOURCES
// ============================================
const DATA_SOURCES = [
  { name: 'U.S. Census Bureau', status: 'active', updated: 'Dec 2025' },
  { name: 'CDC WONDER', status: 'active', updated: 'Jan 2026' },
  { name: 'WHO GHO Database', status: 'active', updated: 'Nov 2025' },
  { name: 'EPA Air Quality Index', status: 'active', updated: 'Feb 2026' },
  { name: 'HHS Hospital Capacity', status: 'pending', updated: 'Awaiting sync' },
]

// ============================================
// MAIN PROFILE PAGE
// ============================================
export default function ProfilePage() {
  const profileOpen = useStore((s) => s.profileOpen)
  const closeProfile = useStore((s) => s.closeProfile)
  const watchlist = useStore((s) => s.watchlist)

  const [animate, setAnimate] = useState(false)
  const [notifs, setNotifs] = useState({
    outbreakAlerts: true,
    weeklyDigest: true,
    riskChanges: true,
    dataUpdates: false,
  })

  useEffect(() => {
    if (profileOpen) {
      const t = setTimeout(() => setAnimate(true), 150)
      return () => clearTimeout(t)
    } else {
      setAnimate(false)
    }
  }, [profileOpen])

  if (!profileOpen) return null

  return (
    <div className="prof-overlay" onClick={closeProfile}>
      <div className={`prof-page ${animate ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="prof-header">
          <h2 className="prof-title">Profile</h2>
          <button className="prof-close" onClick={closeProfile}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body — two columns */}
        <div className="prof-body">

          {/* ====== LEFT — User identity ====== */}
          <div className="prof-left">

            {/* Avatar card */}
            <div className="prof-user-card">
              <div className="prof-avatar-ring">
                <svg width="110" height="110" viewBox="0 0 110 110">
                  <circle cx="55" cy="55" r="50" fill="none" stroke="rgba(0,255,204,0.15)" strokeWidth="3" />
                  <circle cx="55" cy="55" r="50" fill="none" stroke="#00ffcc" strokeWidth="3"
                    strokeLinecap="round" strokeDasharray={2 * Math.PI * 50}
                    strokeDashoffset={animate ? 0 : 2 * Math.PI * 50}
                    transform="rotate(-90 55 55)"
                    style={{ transition: 'stroke-dashoffset 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.3s', filter: 'drop-shadow(0 0 8px rgba(0,255,204,0.3))' }}
                  />
                </svg>
                <div className="prof-avatar-inner">JW</div>
              </div>
              <h3 className="prof-user-name">Joshua Wusu</h3>
              <span className="prof-user-role">Developer</span>
              <span className="prof-user-org">CSC 490 Capstone</span>

              <div className="prof-user-meta">
                <div className="prof-meta-item">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <span>Joined Feb 2026</span>
                </div>
                <div className="prof-meta-item">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Active now</span>
                </div>
              </div>
            </div>

            {/* Activity rings */}
            <div className="prof-rings-card">
              <div className="prof-card-header">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                <span>Activity</span>
              </div>
              <div className="prof-rings-row">
                <TripleRing states={27} alerts={43} days={142} animate={animate} />
                <div className="prof-rings-legend">
                  <div className="prof-legend-item">
                    <span className="prof-legend-dot" style={{ background: '#00ffcc' }} />
                    <span className="prof-legend-label">States</span>
                    <span className="prof-legend-value" style={{ color: '#00ffcc' }}>27/50</span>
                  </div>
                  <div className="prof-legend-item">
                    <span className="prof-legend-dot" style={{ background: '#0ea5e9' }} />
                    <span className="prof-legend-label">Alerts</span>
                    <span className="prof-legend-value" style={{ color: '#0ea5e9' }}>43</span>
                  </div>
                  <div className="prof-legend-item">
                    <span className="prof-legend-dot" style={{ background: '#f0c040' }} />
                    <span className="prof-legend-label">Active Days</span>
                    <span className="prof-legend-value" style={{ color: '#f0c040' }}>142</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ====== RIGHT — Dashboard sections ====== */}
          <div className="prof-right">

            {/* Saved states */}
            <div className="prof-card">
              <div className="prof-card-header">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span>Saved States</span>
                <span className="prof-card-count">{watchlist.length}</span>
              </div>
              <div className="prof-chips">
                {watchlist.map((s) => (
                  <span key={s} className="prof-chip">{s}</span>
                ))}
                {watchlist.length === 0 && <span className="prof-empty-hint">No saved states yet</span>}
              </div>
            </div>

            {/* Recent activity */}
            <div className="prof-card prof-card-scroll">
              <div className="prof-card-header">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Recent Activity</span>
              </div>
              <div className="prof-activity-list">
                {ACTIVITY_LOG.map((item, i) => (
                  <div key={i} className={`prof-activity-item ${animate ? 'animate' : ''}`}
                    style={{ animationDelay: `${400 + i * 60}ms` }}>
                    <span className="prof-activity-icon" style={{ color: ACTION_COLORS[item.type] || '#8892a4' }}>{item.icon}</span>
                    <div className="prof-activity-content">
                      <span className="prof-activity-text">
                        {item.action} <strong style={{ color: ACTION_COLORS[item.type] }}>{item.target}</strong>
                      </span>
                      <span className="prof-activity-time">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notification preferences */}
            <div className="prof-card">
              <div className="prof-card-header">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span>Notifications</span>
              </div>
              <div className="prof-toggles">
                <Toggle label="Outbreak alerts" on={notifs.outbreakAlerts}
                  onChange={() => setNotifs(p => ({ ...p, outbreakAlerts: !p.outbreakAlerts }))} />
                <Toggle label="Weekly digest" on={notifs.weeklyDigest}
                  onChange={() => setNotifs(p => ({ ...p, weeklyDigest: !p.weeklyDigest }))} />
                <Toggle label="Risk score changes" on={notifs.riskChanges}
                  onChange={() => setNotifs(p => ({ ...p, riskChanges: !p.riskChanges }))} />
                <Toggle label="Data source updates" on={notifs.dataUpdates}
                  onChange={() => setNotifs(p => ({ ...p, dataUpdates: !p.dataUpdates }))} />
              </div>
            </div>

            {/* Data sources */}
            <div className="prof-card">
              <div className="prof-card-header">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
                <span>Data Sources</span>
              </div>
              <div className="prof-sources">
                {DATA_SOURCES.map((src, i) => (
                  <div key={i} className="prof-source-row">
                    <span className={`prof-source-dot ${src.status}`} />
                    <span className="prof-source-name">{src.name}</span>
                    <span className="prof-source-date">{src.updated}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}