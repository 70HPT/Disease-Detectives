import { useEffect, useState, useMemo } from 'react'
import useStore from '../../store/useStore'
import TRANSMISSION_CORRIDORS from '../../data/transmissionCorridors'
import { STATE_EVENTS } from '../../data/stateHealthData'
import './StateHoverTooltip.css'

// Mirror StateEventMarkers' severity palette so the tooltip dot matches
// the colored dot the user saw pulsing on the globe.
const EVENT_SEVERITY_COLOR = {
  critical: '#ff4060',
  high: '#f0a030',
  medium: '#0ea5e9',
  low: '#00ffcc',
}
const SEVERITY_RANK = { critical: 3, high: 2, medium: 1, low: 0 }

// ============================================
// STATE HOVER TOOLTIP
// Floats next to the cursor when hovering a state on the globe.
// Shown only when no state is actively selected (landing globe view).
// ============================================
export default function StateHoverTooltip() {
  const hoveredState = useStore(s => s.hoveredState)
  const selectedState = useStore(s => s.selectedState)
  const viewMode = useStore(s => s.viewMode)
  const isTransitioning = useStore(s => s.isTransitioning)
  const stateData = useStore(s => s.stateData)

  const [pos, setPos] = useState({ x: 0, y: 0 })

  // Track the cursor so the tooltip follows it
  useEffect(() => {
    const onMove = (e) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  const shouldShow = hoveredState && !selectedState && viewMode === 'globe' && !isTransitioning
  const data = hoveredState ? stateData[hoveredState] : null
  const topCorridor = useMemo(
    () => hoveredState ? TRANSMISSION_CORRIDORS[hoveredState]?.[0] : null,
    [hoveredState],
  )

  // Pick the most severe historical event for this state (matches the
  // colored dot on the globe — worst-of severity drives the marker color).
  const historyEvent = useMemo(() => {
    if (!hoveredState) return null
    const events = STATE_EVENTS[hoveredState]
    if (!events || events.length === 0) return null
    return events.reduce((worst, e) =>
      (SEVERITY_RANK[e.severity] ?? 0) > (SEVERITY_RANK[worst.severity] ?? 0) ? e : worst,
      events[0]
    )
  }, [hoveredState])
  const historyCount = hoveredState ? (STATE_EVENTS[hoveredState]?.length ?? 0) : 0

  if (!shouldShow || !data) return null

  // Keep the tooltip on-screen (clamp to viewport). Height grows when a
  // history event is present so the footer doesn't get pushed off-screen
  // against the viewport edge.
  const OFFSET_X = 18
  const OFFSET_Y = -12
  const WIDTH = 240
  const HEIGHT_EST = historyEvent ? 260 : 160
  let left = pos.x + OFFSET_X
  let top = pos.y + OFFSET_Y
  if (left + WIDTH > window.innerWidth - 16) left = pos.x - OFFSET_X - WIDTH
  if (top + HEIGHT_EST > window.innerHeight - 16) top = window.innerHeight - HEIGHT_EST - 16
  if (top < 16) top = 16

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'Low': return '#00ffcc'
      case 'Medium': return '#f0c040'
      case 'High': return '#ff4060'
      default: return 'rgba(255,255,255,0.4)'
    }
  }

  const fmtVol = (n) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
  }

  const riskColor = getRiskColor(data.outbreakRisk)

  return (
    <div className="sht-tooltip" style={{ left, top, width: WIDTH }}>
      <div className="sht-header">
        <span className="sht-name">{hoveredState}</span>
        <span className="sht-abbr">{data.abbr}</span>
      </div>

      <div className="sht-row">
        <span className="sht-label">Population</span>
        <span className="sht-value">{data.population || '—'}</span>
      </div>

      <div className="sht-row">
        <span className="sht-label">Outbreak risk</span>
        <span className="sht-value" style={{ color: riskColor }}>
          <span className="sht-risk-dot" style={{ background: riskColor, boxShadow: `0 0 6px ${riskColor}` }} />
          {data.outbreakRisk || '—'}
          {data.riskScore != null && <span className="sht-value-sub">{data.riskScore}/100</span>}
        </span>
      </div>

      {topCorridor && (
        <div className="sht-corridor">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <span className="sht-corridor-label">Top corridor</span>
          <span className="sht-corridor-target">{topCorridor.target}</span>
          <span className="sht-corridor-volume">{fmtVol(topCorridor.travelVolume)}/day</span>
        </div>
      )}

      {historyEvent && (() => {
        const eventColor = EVENT_SEVERITY_COLOR[historyEvent.severity] || EVENT_SEVERITY_COLOR.medium
        return (
          <div className="sht-history">
            <div className="sht-history-head">
              <span className="sht-history-dot" style={{ background: eventColor, boxShadow: `0 0 6px ${eventColor}` }} />
              <span className="sht-history-label">Historical marker</span>
              {historyCount > 1 && <span className="sht-history-count">+{historyCount - 1}</span>}
            </div>
            <div className="sht-history-title">
              <span className="sht-history-year">{historyEvent.year}</span>
              <span className="sht-history-name">{historyEvent.name}</span>
            </div>
            <p className="sht-history-desc">{historyEvent.desc}</p>
          </div>
        )
      })()}

      <div className="sht-footer">Click to explore</div>
    </div>
  )
}
