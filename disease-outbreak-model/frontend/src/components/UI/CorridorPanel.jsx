import { useState, useEffect, useMemo } from 'react'
import useStore from '../../store/useStore'
import TRANSMISSION_CORRIDORS from '../../data/transmissionCorridors'
import './CorridorPanel.css'

// Format numbers with K / M suffixes for compact display
function formatCount(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function RiskBar({ value }) {
  return (
    <div className="corr-risk-bar">
      <div
        className="corr-risk-fill"
        style={{
          width: `${value * 100}%`,
          background: value > 0.75
            ? 'linear-gradient(90deg, #ff6b4a, #ff4020)'
            : value > 0.55
            ? 'linear-gradient(90deg, #f0a030, #e88a10)'
            : 'linear-gradient(90deg, #00e0a0, #00c080)',
          boxShadow: value > 0.75
            ? '0 0 8px rgba(255,107,74,0.4)'
            : value > 0.55
            ? '0 0 8px rgba(240,160,48,0.3)'
            : '0 0 8px rgba(0,224,160,0.3)',
        }}
      />
    </div>
  )
}

export default function CorridorPanel() {
  const selectedState = useStore(s => s.selectedState)
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const stateData = useStore(s => s.stateData)
  const stateName = selectedState?.name
  const corridors = useMemo(() => {
    if (!stateName) return []
    const raw = TRANSMISSION_CORRIDORS[stateName] || []
    const sourceRisk = stateData[stateName]?.riskScore

    return raw.map(c => {
      const targetRisk = stateData[c.target]?.riskScore
      const dynamicWeight = (sourceRisk != null && targetRisk != null)
        ? (sourceRisk + targetRisk) / 200
        : c.riskWeight
      return { ...c, riskWeight: dynamicWeight }
    }).sort((a, b) => b.riskWeight - a.riskWeight)
  }, [stateName, stateData])

  useEffect(() => {
    if (stateName && corridors.length > 0) {
      const t = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
      setExpanded(null)
    }
  }, [stateName, corridors.length])

  if (!stateName || corridors.length === 0 || !visible) return null

  return (
    <div className="corridor-panel">
      <div className="corr-header">
        <div className="corr-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <div className="corr-header-text">
          <span className="corr-title">Transmission Corridors</span>
          <span className="corr-count">{corridors.length} active routes from {stateName}</span>
        </div>
      </div>

      <div className="corr-list">
        {corridors.map((c, i) => (
          <div
            key={c.target}
            className={`corr-item ${expanded === i ? 'expanded' : ''}`}
            style={{ animationDelay: `${i * 120}ms` }}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div className="corr-item-top">
              <div className="corr-route">
                <span className="corr-from">{stateName.length > 10 ? stateName.slice(0,8) + '…' : stateName}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="corr-arrow">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span className="corr-to">{c.target}</span>
              </div>
              <div className="corr-risk-wrap">
                <RiskBar value={c.riskWeight} />
                <span className="corr-risk-val">{Math.round(c.riskWeight * 100)}</span>
              </div>
            </div>

            <div className="corr-meta">
              <span className="corr-mechanism">{c.mechanism}</span>
              <span className="corr-volume">{formatCount(c.travelVolume)}/day</span>
            </div>

            {expanded === i && (
              <div className="corr-detail">
                <div className="corr-breakdown">
                  <div className="corr-ingredient">
                    <span className="corr-ingredient-label">Commuters</span>
                    <span className="corr-ingredient-value">{formatCount(c.commuters)}/day</span>
                    <span className="corr-ingredient-src">Census ACS</span>
                  </div>
                  <div className="corr-ingredient">
                    <span className="corr-ingredient-label">Air travel</span>
                    <span className="corr-ingredient-value">{formatCount(c.airPassengers)}/day</span>
                    <span className="corr-ingredient-src">BTS T-100</span>
                  </div>
                  <div className="corr-ingredient">
                    <span className="corr-ingredient-label">Border</span>
                    <span className="corr-ingredient-value">{c.adjacent ? 'Shared' : 'None'}</span>
                    <span className="corr-ingredient-src">{c.adjacent ? '+0.08 bonus' : 'air only'}</span>
                  </div>
                  <div className="corr-ingredient">
                    <span className="corr-ingredient-label">Risk score</span>
                    <span className="corr-ingredient-value" style={{ color: '#00ffcc' }}>{Math.round(c.riskWeight * 100)}</span>
                    <span className="corr-ingredient-src">normalized 0-100</span>
                  </div>
                </div>
                <p className="corr-factors">{c.factors}</p>
                <div className="corr-detail-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                  </svg>
                  Sources: Census ACS 2016-2020 · BTS T-100 2023 · ML model integration next
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}