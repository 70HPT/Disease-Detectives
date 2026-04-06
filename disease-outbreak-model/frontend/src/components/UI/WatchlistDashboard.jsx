import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import useStore from '../../store/useStore'
import { getOutbreakHistory } from '../../services/dataService'
import './WatchlistDashboard.css'

function generateAlerts(watchlist, stateData) {
  const alerts = []
  const now = Date.now()

  watchlist.forEach((state, si) => {
    const d = stateData[state]
    if (!d) return
    const stateAlerts = []

    if (d.outbreakRisk === 'High') {
      stateAlerts.push({ type: 'outbreak', icon: '\u25C6', severity: 'critical',
        message: `${state} outbreak risk is elevated \u2014 risk score at ${d.riskScore}` })
    } else if (d.outbreakRisk === 'Medium') {
      stateAlerts.push({ type: 'increase', icon: '\u25B2', severity: 'warning',
        message: `${state} shows moderate outbreak risk \u2014 risk score at ${d.riskScore}` })
    } else if (d.outbreakRisk === 'Low' && d.riskScore != null) {
      stateAlerts.push({ type: 'resolved', icon: '\u2713', severity: 'good',
        message: `${state} outbreak risk is low \u2014 risk score at ${d.riskScore}` })
    }

    if (stateAlerts.length === 0) {
      stateAlerts.push({ type: 'update', icon: '\u25CF', severity: 'info',
        message: `${state} \u2014 awaiting risk data` })
    }

    stateAlerts.slice(0, 2).forEach((alert, i) => {
      alerts.push({
        id: `${state}-${i}`,
        state,
        ...alert,
        time: new Date(now - (si * 3 + i) * 3600000 * 1.5),
      })
    })
  })

  alerts.sort((a, b) => b.time - a.time)
  return alerts
}

function timeAgo(date) {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ============================================
// MINI RING (for state cards)
// ============================================
function MiniRing({ value, max = 100, color, size = 44, strokeWidth = 3 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = Math.min(value / max, 1)
  const dashOffset = circumference * (1 - percentage)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mini-ring-svg">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease 0.3s', filter: `drop-shadow(0 0 4px ${color}60)` }}
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="central"
        fill="rgba(255,255,255,0.85)"
        fontSize="11" fontFamily="'JetBrains Mono', monospace" fontWeight="500"
      >
        {value}
      </text>
    </svg>
  )
}

// ============================================
// SPARKLINE — real outbreak history data
// ============================================
function Sparkline({ stateName, color, width = 80, height = 28 }) {
  const [pathData, setPathData] = useState(null)
  const [endPt, setEndPt] = useState(null)
  const stateFips = useStore(s => s.stateFips)

  useEffect(() => {
    if (!stateName || !stateFips[stateName]) return
    let cancelled = false
    const fips = stateFips[stateName] + '001'
    getOutbreakHistory(fips, { diseaseType: 'influenza', limit: 12 }).then(data => {
      if (cancelled || !data || data.length < 2) return
      const cases = data.map(d => d.caseCount ?? 0).reverse()
      const min = Math.min(...cases)
      const max = Math.max(...cases, 1)
      const range = max - min || 1
      const pts = cases.map((c, i) => {
        const x = (i / (cases.length - 1)) * width
        const y = height - ((c - min) / range) * (height - 4) - 2
        return { x, y }
      })
      setPathData(pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
      setEndPt(pts[pts.length - 1])
    })
    return () => { cancelled = true }
  }, [stateName, stateFips, width, height])

  if (!pathData) {
    return <svg width={width} height={height} className="sparkline-svg">
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3,3" />
    </svg>
  }

  return (
    <svg width={width} height={height} className="sparkline-svg">
      <path d={pathData} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      {endPt && <circle cx={endPt.x} cy={endPt.y} r="2.5" fill={color} />}
    </svg>
  )
}

// ============================================
// STATE CARD
// ============================================
function StateCard({ stateName, data, index, onRemove, onView, animate }) {
  const getRiskColor = (risk) => {
    switch (risk) {
      case 'Low': return '#00ffcc'
      case 'Medium': return '#f0c040'
      case 'High': return '#ff4060'
      default: return '#8892a4'
    }
  }

  const getHealthColor = (v) => {
    if (v >= 70) return '#00ffcc'
    if (v >= 55) return '#0ea5e9'
    return '#f0c040'
  }

  const riskColor = getRiskColor(data.outbreakRisk)

  return (
    <div
      className={`wl-card ${animate ? 'animate' : ''}`}
      style={{ animationDelay: `${200 + index * 100}ms` }}
    >
      {/* Remove button */}
      <button className="wl-card-remove" onClick={() => onRemove(stateName)} title="Remove from watchlist">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Header */}
      <div className="wl-card-header">
        <div>
          <h3 className="wl-card-name">{stateName}</h3>
          <span className="wl-card-abbr">{data.abbr}{data.population ? ` \u00B7 ${data.population}` : ''}</span>
        </div>
        <div className="wl-card-risk-badge" style={{ borderColor: `${riskColor}50`, background: `${riskColor}10` }}>
          <span className="wl-card-risk-dot" style={{ background: riskColor, boxShadow: `0 0 6px ${riskColor}` }} />
          <span style={{ color: riskColor }}>{data.outbreakRisk || '\u2014'}</span>
        </div>
      </div>

      {/* Metrics row */}
      <div className="wl-card-metrics">
        <div className="wl-card-metric">
          <MiniRing value={data.healthIndex ?? 0} color={data.healthIndex != null ? getHealthColor(data.healthIndex) : '#8892a4'} />
          <span className="wl-card-metric-label">{data.healthIndex != null ? 'Health' : '\u2014'}</span>
        </div>
        <div className="wl-card-metric">
          <MiniRing value={data.vaccinationRate ?? 0} color={data.vaccinationRate != null ? getHealthColor(data.vaccinationRate) : '#8892a4'} />
          <span className="wl-card-metric-label">{data.vaccinationRate != null ? 'Vax Rate' : '\u2014'}</span>
        </div>
        <div className="wl-card-metric">
          <MiniRing value={data.riskScore ?? 0} color={data.riskScore != null ? (data.riskScore > 45 ? '#ff4060' : data.riskScore > 30 ? '#f0c040' : '#00ffcc') : '#8892a4'} />
          <span className="wl-card-metric-label">{data.riskScore != null ? 'Risk' : '\u2014'}</span>
        </div>
      </div>

      {/* Trend sparkline */}
      <div className="wl-card-trend">
        <span className="wl-card-trend-label">30-day trend</span>
        {data.riskScore != null
          ? <Sparkline stateName={stateName} color={getHealthColor(data.healthIndex ?? 50)} />
          : <span style={{ color: '#8892a4', fontSize: '11px' }}>{'\u2014'}</span>
        }
      </div>

      {/* View button */}
      <button className="wl-card-view" onClick={() => onView(stateName)}>
        View State
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

// ============================================
// ADD STATE SEARCH (within watchlist)
// ============================================
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
]

function AddStateSearch({ watchlist, onAdd }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const available = US_STATES.filter(s => !watchlist.includes(s))
  const filtered = query.length > 0
    ? available.filter(s => s.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : []

  return (
    <div className="wl-add-search">
      <div className="wl-add-input-wrapper">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <input
          type="text"
          placeholder="Add state to watchlist..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
        />
      </div>
      {focused && filtered.length > 0 && (
        <div className="wl-add-dropdown">
          {filtered.map(state => (
            <button key={state} className="wl-add-option" onClick={() => { onAdd(state); setQuery('') }}>
              {state}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// MAIN WATCHLIST DASHBOARD
// ============================================
export default function WatchlistDashboard() {
  const watchlistOpen = useStore((state) => state.watchlistOpen)
  const closeWatchlist = useStore((state) => state.closeWatchlist)
  const watchlist = useStore((state) => state.watchlist)
  const stateData = useStore((state) => state.stateData)
  const addToWatchlist = useStore((state) => state.addToWatchlist)
  const removeFromWatchlist = useStore((state) => state.removeFromWatchlist)
  const requestStateZoom = useStore((state) => state.requestStateZoom)
  const clearSelection = useStore((state) => state.clearSelection)

  const [animate, setAnimate] = useState(false)
  const [alertFilter, setAlertFilter] = useState('all')

  const alerts = useMemo(() => generateAlerts(watchlist, stateData), [watchlist, stateData])

  const filteredAlerts = alertFilter === 'all'
    ? alerts
    : alerts.filter(a => a.severity === alertFilter)

  useEffect(() => {
    if (watchlistOpen) {
      const timer = setTimeout(() => setAnimate(true), 100)
      return () => clearTimeout(timer)
    } else {
      setAnimate(false)
    }
  }, [watchlistOpen])

  const handleViewState = useCallback((stateName) => {
    closeWatchlist()
    clearSelection()
    // Small delay so overlay closes first
    setTimeout(() => requestStateZoom(stateName), 300)
  }, [closeWatchlist, clearSelection, requestStateZoom])

  if (!watchlistOpen) return null

  return (
    <div className="wl-overlay" onClick={closeWatchlist}>
      <div className={`wl-dashboard ${animate ? 'visible' : ''}`} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="wl-header">
          <div className="wl-header-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <div>
              <h2 className="wl-title">Watchlist</h2>
              <span className="wl-subtitle">Monitoring {watchlist.length} states</span>
            </div>
          </div>
          <button className="wl-close" onClick={closeWatchlist}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body — two columns */}
        <div className="wl-body">

          {/* LEFT — State cards */}
          <div className="wl-cards-section">
            <div className="wl-section-header">
              <span>Monitored States</span>
              <AddStateSearch watchlist={watchlist} onAdd={addToWatchlist} />
            </div>
            <div className="wl-cards-grid">
              {watchlist.map((stateName, i) => {
                const data = stateData[stateName]
                if (!data) return null
                return (
                  <StateCard
                    key={stateName}
                    stateName={stateName}
                    data={data}
                    index={i}
                    onRemove={removeFromWatchlist}
                    onView={handleViewState}
                    animate={animate}
                  />
                )
              })}
              {watchlist.length === 0 && (
                <div className="wl-empty">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>No states being monitored</span>
                  <span className="wl-empty-hint">Use the search above to add states</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Alert feed */}
          <div className="wl-alerts-section">
            <div className="wl-section-header">
              <span>Alert Feed</span>
              <div className="wl-alert-filters">
                {['all', 'critical', 'warning', 'good', 'info'].map(f => (
                  <button
                    key={f}
                    className={`wl-alert-filter ${alertFilter === f ? 'active' : ''}`}
                    onClick={() => setAlertFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="wl-alerts-list">
              {filteredAlerts.map((alert, i) => (
                <div
                  key={alert.id}
                  className={`wl-alert ${alert.severity} ${animate ? 'animate' : ''}`}
                  style={{ animationDelay: `${400 + i * 60}ms` }}
                >
                  <span className={`wl-alert-icon ${alert.severity}`}>{alert.icon}</span>
                  <div className="wl-alert-content">
                    <span className="wl-alert-message">{alert.message}</span>
                    <span className="wl-alert-time">{timeAgo(alert.time)}</span>
                  </div>
                </div>
              ))}
              {filteredAlerts.length === 0 && (
                <div className="wl-alerts-empty">No {alertFilter} alerts</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}