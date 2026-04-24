import { useMemo, useEffect, useState } from 'react'
import useStore from '../../store/useStore'
import TRANSMISSION_CORRIDORS from '../../data/transmissionCorridors'
import { STATE_FACTS } from '../../data/stateHealthData'
import './USAtAGlance.css'

// Collapse STATE_FACTS' granular regions into 4 Census-style macro regions
// so the card's region row doesn't explode into 8+ sparsely-populated rows.
const REGION_BUCKETS = {
  'Northeast': 'Northeast',
  'New England': 'Northeast',
  'Mid-Atlantic': 'Northeast',
  'Southeast': 'South',
  'South': 'South',
  'South Central': 'South',
  'Appalachian': 'South',
  'Midwest': 'Midwest',
  'Central': 'Midwest',
  'West': 'West',
  'Mountain': 'West',
  'Pacific': 'West',
  'Pacific NW': 'West',
  'Southwest': 'West',
}

// ============================================
// US AT-A-GLANCE — national surveillance summary card
// Shown on the landing globe view (when no state or county is selected).
// Pulls live from hydrated store + corridor data so it updates when the
// backend comes online.
// ============================================
export default function USAtAGlance({ visible, rootRef }) {
  const stateData = useStore(s => s.stateData)
  const stateDataLoaded = useStore(s => s.stateDataLoaded)
  const openComparison = useStore(s => s.openComparison)
  const toggleHeatmap = useStore(s => s.toggleHeatmap)
  const heatmapEnabled = useStore(s => s.heatmapEnabled)

  // Fade-in after a short delay so it doesn't fight with the intro zoom
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (!visible) { setEntered(false); return }
    const t = setTimeout(() => setEntered(true), 400)
    return () => clearTimeout(t)
  }, [visible])

  const summary = useMemo(() => {
    const rows = Object.values(stateData).filter(r => r.name !== 'District of Columbia')

    // High-risk count
    const highRisk = rows.filter(r => r.outbreakRisk === 'High').length
    const mediumRisk = rows.filter(r => r.outbreakRisk === 'Medium').length
    const lowRisk = rows.filter(r => r.outbreakRisk === 'Low').length
    const totalWithRisk = highRisk + mediumRisk + lowRisk

    // Peak-risk state (highest riskScore)
    const rankedByRisk = rows
      .filter(r => r.riskScore != null)
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
    const peakState = rankedByRisk[0] || null

    // Most populous state
    const rankedByPop = rows
      .filter(r => r.populationNum != null)
      .sort((a, b) => b.populationNum - a.populationNum)
    const mostPopulous = rankedByPop[0] || null

    // Biggest corridor across the whole country
    let biggestCorridor = null
    for (const [from, arr] of Object.entries(TRANSMISSION_CORRIDORS)) {
      for (const c of arr) {
        if (!biggestCorridor || c.travelVolume > biggestCorridor.volume) {
          biggestCorridor = { from, to: c.target, volume: c.travelVolume, mechanism: c.mechanism }
        }
      }
    }

    // Aggregate daily cross-border travelers (sum of every corridor)
    let totalTravelers = 0
    for (const arr of Object.values(TRANSMISSION_CORRIDORS)) {
      for (const c of arr) totalTravelers += c.travelVolume
    }

    // Risk distribution bucketed by US region
    const regionStats = {}
    for (const r of rows) {
      const bucket = REGION_BUCKETS[STATE_FACTS[r.name]?.region] || 'Other'
      if (!regionStats[bucket]) {
        regionStats[bucket] = { name: bucket, total: 0, high: 0, medium: 0, low: 0 }
      }
      regionStats[bucket].total += 1
      if (r.outbreakRisk === 'High') regionStats[bucket].high += 1
      else if (r.outbreakRisk === 'Medium') regionStats[bucket].medium += 1
      else if (r.outbreakRisk === 'Low') regionStats[bucket].low += 1
    }
    // Hottest region = most high-risk states (ties broken by medium count)
    const regions = Object.values(regionStats)
    const hottestRegion = regions.length
      ? regions.slice().sort((a, b) =>
          (b.high - a.high) || (b.medium - a.medium) || (b.total - a.total)
        )[0]
      : null

    return {
      highRisk,
      mediumRisk,
      lowRisk,
      totalWithRisk,
      peakState,
      mostPopulous,
      biggestCorridor,
      totalTravelers,
      regions,
      hottestRegion,
    }
  }, [stateData])

  const fmtVol = (n) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
  }

  return (
    <div ref={rootRef} className={`us-ataglance ${entered ? 'visible' : ''}`}>
      <div className="uag-header">
        <span className="uag-dot" />
        <span className="uag-title">US · At a glance</span>
        <span className="uag-subtitle">{stateDataLoaded ? 'live' : '—'}</span>
      </div>

      {/* Risk distribution */}
      <div className="uag-row">
        <span className="uag-row-label">Risk distribution</span>
        {summary.totalWithRisk > 0 ? (
          <div className="uag-risk-bar">
            {summary.highRisk > 0 && (
              <span
                className="uag-risk-seg high"
                style={{ flex: summary.highRisk }}
                title={`${summary.highRisk} states at High risk`}
              >
                {summary.highRisk} High
              </span>
            )}
            {summary.mediumRisk > 0 && (
              <span
                className="uag-risk-seg medium"
                style={{ flex: summary.mediumRisk }}
                title={`${summary.mediumRisk} states at Medium risk`}
              >
                {summary.mediumRisk} Med
              </span>
            )}
            {summary.lowRisk > 0 && (
              <span
                className="uag-risk-seg low"
                style={{ flex: summary.lowRisk }}
                title={`${summary.lowRisk} states at Low risk`}
              >
                {summary.lowRisk} Low
              </span>
            )}
          </div>
        ) : (
          <span className="uag-row-empty">—</span>
        )}
      </div>

      {/* Peak-risk state */}
      {summary.peakState && (
        <div className="uag-row">
          <span className="uag-row-label">Highest risk</span>
          <span className="uag-row-value">
            {summary.peakState.name}
            <span className="uag-row-subtext">{summary.peakState.riskScore}/100</span>
          </span>
        </div>
      )}

      {/* Most populous state */}
      {summary.mostPopulous && (
        <div className="uag-row">
          <span className="uag-row-label">Most populous</span>
          <span className="uag-row-value">
            {summary.mostPopulous.name}
            <span className="uag-row-subtext">{summary.mostPopulous.population || '—'}</span>
          </span>
        </div>
      )}

      {/* Hottest region — uses orphaned region field */}
      {summary.hottestRegion && summary.totalWithRisk > 0 && (
        <div className="uag-row">
          <span className="uag-row-label">Hottest region</span>
          <span className="uag-row-value">
            {summary.hottestRegion.name}
            <span className="uag-row-subtext">
              {summary.hottestRegion.high} High · {summary.hottestRegion.medium} Med
            </span>
          </span>
        </div>
      )}

      {/* Biggest corridor */}
      {summary.biggestCorridor && (
        <div className="uag-row">
          <span className="uag-row-label">Biggest corridor</span>
          <span className="uag-row-value">
            {summary.biggestCorridor.from} ↔ {summary.biggestCorridor.to}
            <span className="uag-row-subtext">{fmtVol(summary.biggestCorridor.volume)}/day</span>
          </span>
        </div>
      )}

      {/* Aggregate daily cross-border travelers */}
      <div className="uag-row">
        <span className="uag-row-label">Daily interstate travel</span>
        <span className="uag-row-value">
          <span className="uag-big-num">{fmtVol(summary.totalTravelers)}</span>
          <span className="uag-row-subtext">sum of top corridors</span>
        </span>
      </div>

      {/* Quick actions */}
      <div className="uag-actions">
        <button
          className={`uag-action ${heatmapEnabled ? 'active' : ''}`}
          onClick={toggleHeatmap}
          title="Paint the globe by risk score"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Heatmap
        </button>
        <button
          className="uag-action"
          onClick={openComparison}
          title="Compare states side-by-side"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          Compare
        </button>
      </div>

      <div className="uag-footer">
        Census ACS 2016-20 · BTS T-100 2023 · /risk/map when live
      </div>
    </div>
  )
}
