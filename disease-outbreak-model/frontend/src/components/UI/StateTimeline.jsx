import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import useStore from '../../store/useStore'
import { NATIONAL_EVENTS, STATE_EVENTS } from '../../data/stateHealthData'
import { getOutbreakHistory } from '../../services/dataService'
import { getDiseaseById } from '../../data/trackedDiseases'
import './StateTimeline.css'

// ============================================
// SEVERITY CONFIG
// ============================================
const SEVERITY_CONFIG = {
  critical: { color: '#ff4060', glow: 'rgba(255, 64, 96, 0.5)', pulseSpeed: '1.5s', size: 14 },
  high:     { color: '#f0a030', glow: 'rgba(240, 160, 48, 0.4)', pulseSpeed: '2s', size: 12 },
  medium:   { color: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.4)', pulseSpeed: '2.5s', size: 10 },
  low:      { color: '#00ffcc', glow: 'rgba(0, 255, 204, 0.3)', pulseSpeed: '3s', size: 8 },
}

// ============================================
// TIMELINE NODE
// ============================================
function TimelineNode({ event, index, isActive, onClick, animate }) {
  const config = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.medium

  return (
    <div
      className={`tl-node ${isActive ? 'active' : ''} ${animate ? 'animate' : ''}`}
      style={{ animationDelay: `${300 + index * 80}ms` }}
      onClick={() => onClick(event)}
    >
      {/* Year label */}
      <span className="tl-year">{event.year}</span>

      {/* Dot with pulse */}
      <div className="tl-dot-wrapper">
        <div
          className="tl-pulse"
          style={{
            borderColor: config.color,
            animationDuration: config.pulseSpeed,
            width: config.size + 16,
            height: config.size + 16,
          }}
        />
        <div
          className="tl-dot"
          style={{
            background: config.color,
            width: config.size,
            height: config.size,
            boxShadow: `0 0 8px ${config.glow}, 0 0 20px ${config.glow}`,
          }}
        />
      </div>

      {/* Event name */}
      <span className="tl-name">{event.name}</span>
    </div>
  )
}

// ============================================
// EVENT DETAIL CARD
// ============================================
function EventCard({ event, onClose }) {
  if (!event) return null
  const config = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.medium

  return (
    <div className="tl-card" onClick={(e) => e.stopPropagation()}>
      <button className="tl-card-close" onClick={onClose}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="tl-card-header">
        <div className="tl-card-severity" style={{ background: `${config.color}18`, borderColor: `${config.color}40` }}>
          <span className="tl-card-severity-dot" style={{ background: config.color, boxShadow: `0 0 6px ${config.glow}` }} />
          <span style={{ color: config.color }}>{event.severity.toUpperCase()}</span>
        </div>
        <span className="tl-card-year">{event.year}</span>
      </div>

      <h3 className="tl-card-title">{event.name}</h3>

      <div className="tl-card-meta">
        <div className="tl-card-meta-item">
          <span className="tl-card-meta-label">Pathogen</span>
          <span className="tl-card-meta-value">{event.type}</span>
        </div>
        <div className="tl-card-meta-item">
          <span className="tl-card-meta-label">U.S. Deaths</span>
          <span className="tl-card-meta-value">{event.deaths}</span>
        </div>
      </div>

      <p className="tl-card-desc">{event.desc}</p>
    </div>
  )
}

// ============================================
// CASE TREND CHART — real surveillance data from API
// ============================================
// ============================================
// CASE TREND CHART \u2014 detailed surveillance visualization
// ============================================
// Number formatter \u2014 readable for both small (176) and large (29000) values
const fmt = (n) => Math.round(n).toLocaleString()

// Compute a centered moving average window
function movingAverage(values, window = 3) {
  if (!values || values.length < 2) return values
  const half = Math.floor(window / 2)
  return values.map((_, i) => {
    const start = Math.max(0, i - half)
    const end = Math.min(values.length, i + half + 1)
    const slice = values.slice(start, end)
    const sum = slice.reduce((s, v) => s + v, 0)
    return sum / slice.length
  })
}

// Filter rows by recency: 'all' | '12m' | '6m'
// Rows come in ascending date order (we .reverse() in fetch).
function applyRange(rows, range) {
  if (!rows || rows.length === 0 || range === 'all') return rows
  const latest = new Date(rows[rows.length - 1].date)
  if (Number.isNaN(latest.getTime())) return rows
  const cutoff = new Date(latest)
  cutoff.setMonth(cutoff.getMonth() - (range === '6m' ? 6 : 12))
  return rows.filter(r => new Date(r.date) >= cutoff)
}

// Extract Jan-1 markers for year labels along the x-axis
function yearTicks(rows) {
  if (!rows || rows.length < 2) return []
  const seen = new Set()
  const ticks = []
  rows.forEach((r, i) => {
    const y = r.date?.slice(0, 4)
    if (y && !seen.has(y)) {
      seen.add(y)
      ticks.push({ year: y, index: i })
    }
  })
  return ticks
}

function CaseTrendChart({ stateName, animate }) {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState('all')
  const [hoverIdx, setHoverIdx] = useState(null)
  const svgRef = useRef(null)
  const stateFips = useStore(s => s.stateFips)
  const selectedDisease = useStore(s => s.selectedDisease)
  const disease = getDiseaseById(selectedDisease)

  useEffect(() => {
    if (!stateName || !stateFips[stateName]) return
    let cancelled = false
    let timer

    setLoading(true)
    setRawData(null)
    setRange('all')
    setHoverIdx(null)

    // Statewide rollup FIPS ({state_fips}000). When Jacob's aggregation seed
    // runs, this automatically starts returning real state-level totals. Until
    // then the chart honestly shows the empty state rather than pretending a
    // single county's data represents the whole state.
    const fips = stateFips[stateName] + '000'

    // Retry up to 3 times with backoff — handles backend cold-start and the
    // api.js offline cooldown that can reject the first request when another
    // endpoint fails first. Distinguish null (offline/transient) from a 404
    // (the county genuinely isn't in the DB — retrying won't help).
    const attempt = (tries = 0) => {
      getOutbreakHistory(fips, { diseaseType: disease.apiKey, limit: 52 })
        .then(result => {
          if (cancelled) return
          if (result && result.length > 0) {
            setRawData(result.reverse())
            setLoading(false)
            return
          }
          if (tries < 2) {
            timer = setTimeout(() => { if (!cancelled) attempt(tries + 1) }, 1200)
          } else {
            setLoading(false)
          }
        })
        .catch(err => {
          if (cancelled) return
          // 404 → location not in the DB. No point retrying.
          if (err?.status === 404) {
            setLoading(false)
            return
          }
          if (tries < 2) {
            timer = setTimeout(() => { if (!cancelled) attempt(tries + 1) }, 1200)
          } else {
            setLoading(false)
          }
        })
    }
    attempt(0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [stateName, stateFips, disease.apiKey])

  const data = useMemo(() => applyRange(rawData, range), [rawData, range])

  // Re-clamp hover when range changes
  useEffect(() => {
    if (data && hoverIdx !== null && hoverIdx >= data.length) setHoverIdx(null)
  }, [data, hoverIdx])

  // Placeholder header shown in loading + empty states so the card never feels blank
  const headerFrame = (
    <div className="tl-trend-header">
      <span className="tl-trend-title">{disease.name} Surveillance</span>
      <span className="tl-trend-range tl-trend-range-muted">{stateName}</span>
    </div>
  )

  if (loading) {
    return (
      <div className={`tl-trend-chart ${animate ? 'visible' : ''}`}>
        {headerFrame}
        <div className="tl-trend-skeleton" aria-busy="true" aria-live="polite">
          <div className="tl-trend-skeleton-chart">
            <div className="tl-trend-skeleton-bar" style={{ left: '8%', height: '30%' }} />
            <div className="tl-trend-skeleton-bar" style={{ left: '22%', height: '55%' }} />
            <div className="tl-trend-skeleton-bar" style={{ left: '36%', height: '42%' }} />
            <div className="tl-trend-skeleton-bar" style={{ left: '50%', height: '70%' }} />
            <div className="tl-trend-skeleton-bar" style={{ left: '64%', height: '50%' }} />
            <div className="tl-trend-skeleton-bar" style={{ left: '78%', height: '65%' }} />
            <div className="tl-trend-skeleton-bar" style={{ left: '92%', height: '38%' }} />
          </div>
          <span className="tl-trend-skeleton-text">Loading surveillance data…</span>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className={`tl-trend-chart ${animate ? 'visible' : ''}`}>
        {headerFrame}
        <div className="tl-trend-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 14l4-4 3 3 5-6" strokeDasharray="3 3" opacity="0.6" />
          </svg>
          <div className="tl-trend-empty-title">State-level data pending</div>
          <div className="tl-trend-empty-subtitle">
            {disease.name} surveillance for {stateName} is awaiting a statewide rollup in the database. The UI will populate automatically once the aggregated weekly totals are seeded.
          </div>
        </div>
      </div>
    )
  }

  // \u2500\u2500 Derived metrics \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const cases = data.map(d => d.case_count ?? d.caseCount ?? 0)
  const maxCase = Math.max(...cases, 1)
  const minCase = Math.min(...cases, 0)
  const meanCase = cases.reduce((s, v) => s + v, 0) / cases.length
  const peakIdx = cases.indexOf(maxCase)
  const current = cases[cases.length - 1]
  const ma = movingAverage(cases, 3)
  const ticks = yearTicks(data)

  // Trend direction (first half vs second half mean)
  const midIdx = Math.floor(cases.length / 2)
  const firstHalfMean = cases.slice(0, midIdx).reduce((s, v) => s + v, 0) / Math.max(1, midIdx)
  const secondHalfMean = cases.slice(midIdx).reduce((s, v) => s + v, 0) / Math.max(1, cases.length - midIdx)
  const trendPct = firstHalfMean > 0 ? ((secondHalfMean - firstHalfMean) / firstHalfMean) * 100 : 0
  const trendDir = trendPct > 3 ? 'up' : trendPct < -3 ? 'down' : 'flat'
  const trendSymbol = trendDir === 'up' ? '\u2191' : trendDir === 'down' ? '\u2193' : '\u2192'
  const trendColor = trendDir === 'up' ? '#f87171' : trendDir === 'down' ? '#4ade80' : 'rgba(255,255,255,0.5)'

  // \u2500\u2500 SVG coordinate system \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const w = 800, h = 180
  const padL = 40, padR = 20, padT = 14, padB = 26
  const plotW = w - padL - padR
  const plotH = h - padT - padB
  const xOf = (i) => padL + (cases.length > 1 ? (i / (cases.length - 1)) * plotW : plotW / 2)
  const yOf = (v) => padT + plotH - ((v - minCase) / (maxCase - minCase || 1)) * plotH

  const lineCoords = cases.map((c, i) => `${xOf(i).toFixed(1)},${yOf(c).toFixed(1)}`)
  const linePath = lineCoords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ')
  const areaPath = `${linePath} L${xOf(cases.length - 1).toFixed(1)},${padT + plotH} L${xOf(0).toFixed(1)},${padT + plotH} Z`
  const maCoords = ma.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`)
  const maPath = maCoords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ')

  // Y-axis gridline values (3 lines: 0%, 50%, 100% of range)
  const gridValues = [minCase, (minCase + maxCase) / 2, maxCase]

  const dateRange = data.length > 1
    ? `${data[0].date?.slice(0, 7) || ''} \u2013 ${data[data.length - 1].date?.slice(0, 7) || ''}`
    : ''

  // Hover handler \u2014 convert mouse x to data index
  const onMove = (e) => {
    const svg = svgRef.current
    if (!svg) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const local = pt.matrixTransform(ctm.inverse())
    const rel = (local.x - padL) / plotW
    const idx = Math.round(rel * (cases.length - 1))
    setHoverIdx(Math.max(0, Math.min(cases.length - 1, idx)))
  }

  return (
    <div className={`tl-trend-chart ${animate ? 'visible' : ''}`}>
      <div className="tl-trend-header">
        <span className="tl-trend-title">{disease.name} Surveillance</span>
        <div className="tl-trend-badges">
          <span
            className="tl-trend-badge"
            style={{ color: trendColor }}
            title={`Average cases in the second half of the range vs the first half. ${trendSymbol} ${Math.abs(trendPct).toFixed(0)}% means ${trendDir === 'up' ? 'rising' : trendDir === 'down' ? 'declining' : 'roughly flat'}.`}
          >
            {trendSymbol} {Math.abs(trendPct).toFixed(0)}%
          </span>
          <span className="tl-trend-badge-hint">2nd half vs 1st</span>
          <span className="tl-trend-range">{dateRange}</span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="tl-trend-svg"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Gridlines + y-axis labels */}
        {gridValues.map((v, i) => (
          <g key={`grid-${i}`}>
            <line
              x1={padL} x2={w - padR}
              y1={yOf(v)} y2={yOf(v)}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="2 4"
            />
            <text
              x={padL - 6} y={yOf(v) + 3}
              textAnchor="end"
              fontSize="9"
              fill="rgba(255,255,255,0.4)"
              fontFamily="'JetBrains Mono', monospace"
            >
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* Mean baseline */}
        <line
          x1={padL} x2={w - padR}
          y1={yOf(meanCase)} y2={yOf(meanCase)}
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="0.8"
          strokeDasharray="4 3"
        />
        <text
          x={w - padR - 4} y={yOf(meanCase) - 3}
          textAnchor="end"
          fontSize="8"
          fill="rgba(255,255,255,0.4)"
          fontFamily="'JetBrains Mono', monospace"
        >
          avg {fmt(meanCase)}
        </text>

        {/* Area + raw line */}
        <path d={areaPath} fill="url(#trendGrad)" />
        <path d={linePath} fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeLinejoin="round" />

        {/* Moving average overlay */}
        {ma.length > 2 && (
          <path d={maPath} fill="none" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="1.2" strokeDasharray="3 2" />
        )}

        {/* Peak marker */}
        <g transform={`translate(${xOf(peakIdx)}, ${yOf(maxCase)})`}>
          <circle r="4" fill="#f0a030" stroke="#0a1020" strokeWidth="1.5" />
          <text
            x="0" y="-8"
            textAnchor="middle"
            fontSize="9"
            fill="#f0a030"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="600"
          >
            peak {fmt(maxCase)}
          </text>
        </g>

        {/* Current (latest) marker */}
        {cases.length > 1 && peakIdx !== cases.length - 1 && (
          <g transform={`translate(${xOf(cases.length - 1)}, ${yOf(current)})`}>
            <circle r="3.5" fill="#00ffcc" stroke="#0a1020" strokeWidth="1.5" />
            <text
              x="-6" y="4"
              textAnchor="end"
              fontSize="9"
              fill="#00ffcc"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="600"
            >
              {fmt(current)}
            </text>
          </g>
        )}

        {/* Year ticks on x-axis */}
        {ticks.map((t, i) => (
          <g key={`tick-${i}`} transform={`translate(${xOf(t.index)}, ${padT + plotH})`}>
            <line y1="0" y2="4" stroke="rgba(255,255,255,0.25)" />
            <text
              y="14"
              textAnchor="middle"
              fontSize="9"
              fill="rgba(255,255,255,0.45)"
              fontFamily="'JetBrains Mono', monospace"
            >
              {t.year}
            </text>
          </g>
        ))}

        {/* Hover crosshair + point */}
        {hoverIdx !== null && (
          <g>
            <line
              x1={xOf(hoverIdx)} x2={xOf(hoverIdx)}
              y1={padT} y2={padT + plotH}
              stroke="rgba(0, 255, 204, 0.35)"
              strokeWidth="0.8"
            />
            <circle
              cx={xOf(hoverIdx)} cy={yOf(cases[hoverIdx])}
              r="4"
              fill="#00ffcc"
              stroke="#0a1020"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && (
        <div className="tl-trend-tooltip">
          <span className="tl-trend-tooltip-date">{data[hoverIdx].date?.slice(0, 10)}</span>
          <span className="tl-trend-tooltip-value">{fmt(cases[hoverIdx])} cases</span>
        </div>
      )}

      {/* Controls + footer */}
      <div className="tl-trend-controls">
        <div className="tl-trend-range-wrapper" title="Filter the chart to a time window">
          <span className="tl-trend-range-label">Range</span>
          <div className="tl-trend-range-group" role="group" aria-label="Time range filter">
            {[
              ['6m', '6M', 'Show the most recent 6 months of weekly cases'],
              ['12m', '12M', 'Show the most recent 12 months of weekly cases'],
              ['all', 'All', 'Show the full available history'],
            ].map(([key, label, tip]) => (
              <button
                key={key}
                className={`tl-trend-range-btn ${range === key ? 'active' : ''}`}
                onClick={() => setRange(key)}
                title={tip}
                aria-label={tip}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="tl-trend-stats">
          <span><em>Peak</em> {fmt(maxCase)}</span>
          <span><em>Avg</em> {fmt(meanCase)}</span>
          <span><em>Latest</em> {fmt(current)}</span>
        </div>
        <span className="tl-trend-source">Source: {disease.sourceLabel}</span>
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function StateTimeline() {
  const selectedState = useStore((state) => state.selectedState)
  const viewMode = useStore((state) => state.viewMode)
  const [activeEvent, setActiveEvent] = useState(null)
  const [animate, setAnimate] = useState(false)
  const [visible, setVisible] = useState(false)
  const trendView = useStore((state) => state.trendView)
  const setTrendView = useStore((state) => state.setTrendView)
  const selectedDisease = useStore((state) => state.selectedDisease)
  const scrollRef = useRef(null)
  const prevStateRef = useRef(null)

  const isCountyView = viewMode === 'state-counties'

  // Build merged + sorted timeline for this state
  const getEvents = useCallback(() => {
    if (!selectedState) return []
    const stateSpecific = STATE_EVENTS[selectedState.name] || []
    // Merge national + state, mark origin
    const merged = [
      ...NATIONAL_EVENTS.map(e => ({ ...e, scope: 'national' })),
      ...stateSpecific.map(e => ({ ...e, scope: 'state' })),
    ]
    merged.sort((a, b) => a.year - b.year)
    return merged
  }, [selectedState])

  const events = getEvents()

  // Animation triggers
  useEffect(() => {
    if (selectedState && !isCountyView) {
      if (prevStateRef.current !== selectedState.name) {
        setAnimate(false)
        setVisible(false)
        setActiveEvent(null)
      }
      prevStateRef.current = selectedState.name

      const showTimer = setTimeout(() => setVisible(true), 400)
      const animTimer = setTimeout(() => setAnimate(true), 700)
      return () => { clearTimeout(showTimer); clearTimeout(animTimer) }
    } else {
      setVisible(false)
      setAnimate(false)
      setActiveEvent(null)
    }
  }, [selectedState, isCountyView])

  // Scroll to center on state events when they appear
  useEffect(() => {
    if (animate && scrollRef.current && selectedState) {
      const stateEvents = STATE_EVENTS[selectedState.name]
      if (stateEvents && stateEvents.length > 0) {
        // Scroll to first state-specific event
        const firstStateYear = stateEvents[0].year
        const nodeIndex = events.findIndex(e => e.year === firstStateYear && e.scope === 'state')
        if (nodeIndex >= 0) {
          const node = scrollRef.current.children[nodeIndex]
          if (node) {
            setTimeout(() => {
              node.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
            }, 800)
          }
        }
      }
    }
  }, [animate, selectedState, events])

  if (!selectedState || isCountyView) return null

  return (
    <div className={`state-timeline mode-${trendView} ${visible ? 'visible' : ''}`}>
      {/* Scan line effect */}
      <div className={`tl-scanline ${animate ? 'active' : ''}`} />

      {/* Header */}
      <div className="tl-header">
        <div className="tl-header-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="tl-title">Disease Timeline</span>
        </div>

        <div className="tl-view-toggle" role="tablist">
          <button
            role="tab"
            aria-selected={trendView === 'surveillance'}
            className={`tl-view-btn ${trendView === 'surveillance' ? 'active' : ''}`}
            onClick={() => setTrendView('surveillance')}
          >
            Surveillance
          </button>
          <button
            role="tab"
            aria-selected={trendView === 'history'}
            className={`tl-view-btn ${trendView === 'history' ? 'active' : ''}`}
            onClick={() => setTrendView('history')}
          >
            History
          </button>
        </div>

        {trendView === 'history' ? (
          <div className="tl-legend">
            {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
              <div key={key} className="tl-legend-item">
                <span className="tl-legend-dot" style={{ background: config.color }} />
                <span>{key}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="tl-legend-spacer" />
        )}
      </div>

      {trendView === 'surveillance' && (
        <CaseTrendChart
          key={`${selectedState.name}-${selectedDisease}`}
          stateName={selectedState.name}
          animate={animate}
        />
      )}

      {trendView === 'history' && (
        <>
          <div className="tl-track-wrapper">
            <div className="tl-track-line" />
            <div className="tl-track" ref={scrollRef}>
              {events.map((event, i) => (
                <TimelineNode
                  key={`${event.year}-${event.name}`}
                  event={event}
                  index={i}
                  isActive={activeEvent?.name === event.name && activeEvent?.year === event.year}
                  onClick={setActiveEvent}
                  animate={animate}
                />
              ))}
            </div>
          </div>

          {activeEvent && (
            <EventCard event={activeEvent} onClose={() => setActiveEvent(null)} />
          )}
        </>
      )}
    </div>
  )
}