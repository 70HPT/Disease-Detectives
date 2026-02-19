import { useState, useRef, useEffect } from 'react'
import useStore from '../../store/useStore'
import './HeatmapLegend.css'

const METRICS = [
  { key: 'riskScore', label: 'Risk Score', low: 'Low Risk', high: 'High Risk', inverted: true },
  { key: 'vaccinationRate', label: 'Vaccination Rate', low: '0%', high: '100%', inverted: false },
  { key: 'healthIndex', label: 'Health Index', low: 'Poor', high: 'Excellent', inverted: false },
  { key: 'airQuality', label: 'Air Quality', low: 'Unhealthy', high: 'Good', inverted: false },
]

export default function HeatmapLegend() {
  const heatmapEnabled = useStore(s => s.heatmapEnabled)
  const heatmapMetric = useStore(s => s.heatmapMetric)
  const toggleHeatmap = useStore(s => s.toggleHeatmap)
  const setHeatmapMetric = useStore(s => s.setHeatmapMetric)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const selectorRef = useRef(null)

  const active = METRICS.find(m => m.key === heatmapMetric) || METRICS[0]

  useEffect(() => {
    const handleClick = (e) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target)) {
        setSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!heatmapEnabled) return null

  return (
    <div className="heatmap-legend">
      {/* Metric selector */}
      <div className="hm-selector-wrap" ref={selectorRef}>
        <button className="hm-metric-btn" onClick={() => setSelectorOpen(p => !p)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
          </svg>
          <span>{active.label}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`hm-chevron ${selectorOpen ? 'open' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {selectorOpen && (
          <div className="hm-dropdown">
            {METRICS.map(m => (
              <button key={m.key}
                className={`hm-dropdown-item ${m.key === heatmapMetric ? 'active' : ''}`}
                onClick={() => { setHeatmapMetric(m.key); setSelectorOpen(false) }}>
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Gradient bar */}
      <div className="hm-gradient-bar">
        <div className="hm-gradient-track" />
      </div>

      {/* Range labels */}
      <div className="hm-range">
        <span className="hm-range-low">{active.low}</span>
        <span className="hm-range-high">{active.high}</span>
      </div>

      {/* Close button */}
      <button className="hm-close" onClick={toggleHeatmap} title="Close heatmap">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}