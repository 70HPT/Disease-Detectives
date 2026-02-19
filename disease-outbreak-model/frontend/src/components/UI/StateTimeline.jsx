import { useState, useEffect, useRef, useCallback } from 'react'
import useStore from '../../store/useStore'
import { NATIONAL_EVENTS, STATE_EVENTS } from '../../data/stateHealthData'
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
// MAIN COMPONENT
// ============================================
export default function StateTimeline() {
  const selectedState = useStore((state) => state.selectedState)
  const viewMode = useStore((state) => state.viewMode)
  const [activeEvent, setActiveEvent] = useState(null)
  const [animate, setAnimate] = useState(false)
  const [visible, setVisible] = useState(false)
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
    <div className={`state-timeline ${visible ? 'visible' : ''}`}>
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
        <div className="tl-legend">
          {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
            <div key={key} className="tl-legend-item">
              <span className="tl-legend-dot" style={{ background: config.color }} />
              <span>{key}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline track */}
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

      {/* Detail card */}
      {activeEvent && (
        <EventCard event={activeEvent} onClose={() => setActiveEvent(null)} />
      )}
    </div>
  )
}