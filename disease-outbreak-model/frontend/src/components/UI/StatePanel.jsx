import { useState, useMemo, useEffect } from 'react'
import useStore from '../../store/useStore'
import TRANSMISSION_CORRIDORS, { getCorridorRiskColor } from '../../data/transmissionCorridors'
import { getDiseaseById } from '../../data/trackedDiseases'
import { useMapData, useLocationRisk } from '../../services'
import { StatePanelSkeleton, EmptyPrediction } from './LoadingStates'
import './LoadingStates.css'
import './StatePanel.css'

// ============================================
// CIRCULAR GAUGE — animated ring with value
// ============================================
function CircularGauge({ value, max = 100, size = 56, strokeWidth = 4, color, label, suffix = '' }) {
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const hasValue = value != null
  const progress = hasValue ? (value / max) * circumference : 0

  return (
    <div className="circular-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          className="gauge-progress"
        />
        <text x={size/2} y={size/2 - 2} textAnchor="middle" dominantBaseline="central"
          fill={hasValue ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)'}
          fontSize="13" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
          {hasValue ? `${value}${suffix}` : '—'}
        </text>
        {hasValue && (
          <text x={size/2} y={size/2 + 11} textAnchor="middle"
            fill="rgba(255,255,255,0.25)" fontSize="6" fontFamily="'JetBrains Mono', monospace"
            style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            /{max}
          </text>
        )}
      </svg>
      <span className="gauge-label">{label}</span>
    </div>
  )
}

// ============================================
// MINI SPARKLINE — procedural trend line
// ============================================
function MiniSparkline({ fips, color, width = 80, height = 24 }) {
  const [points, setPoints] = useState(null)
  const selectedDisease = useStore(s => s.selectedDisease)
  const apiKey = getDiseaseById(selectedDisease).apiKey

  useEffect(() => {
    if (!fips) return
    let cancelled = false
    setPoints(null)
    import('../../services/dataService').then(({ getOutbreakHistory }) => {
      getOutbreakHistory(fips, { diseaseType: apiKey, limit: 12 })
        .then(data => {
          if (cancelled || !data || data.length < 2) return
          const cases = data.map(d => d.caseCount ?? 0).reverse()
          const max = Math.max(...cases, 1)
          const pts = cases.map((c, i) => ({
            x: (i / (cases.length - 1)) * width,
            y: height - 2 - (c / max) * (height - 4)
          }))
          setPoints(pts)
        })
        .catch(() => { /* 404 or offline — stay empty */ })
    })
    return () => { cancelled = true }
  }, [fips, width, height, apiKey])

  if (!points) {
    return <svg width={width} height={height} className="mini-sparkline">
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3,3" />
    </svg>
  }

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const gradId = `spark-${fips}`

  return (
    <svg width={width} height={height} className="mini-sparkline">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${pathD} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" fill={color} />
    </svg>
  )
}

// ============================================
// HEALTH GRADE RING — A-F letter grade
// ============================================
function HealthGradeRing({ healthIndex }) {
  let grade, color
  if (healthIndex >= 90) { grade = 'A'; color = '#10b981' }
  else if (healthIndex >= 80) { grade = 'B'; color = '#34d399' }
  else if (healthIndex >= 65) { grade = 'C'; color = '#f0a030' }
  else if (healthIndex >= 50) { grade = 'D'; color = '#f97316' }
  else { grade = 'F'; color = '#ef4444' }

  const size = 68
  const strokeWidth = 5
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (healthIndex / 100) * circumference

  return (
    <div className="health-grade-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          className="grade-ring-progress"
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          fill={color} fontSize="22" fontFamily="'Orbitron', sans-serif" fontWeight="700">
          {grade}
        </text>
      </svg>
      <span className="grade-ring-label">Health Grade</span>
    </div>
  )
}

// ============================================
// TRANSMISSION ANALYSIS — AI context card
// ============================================
function TransmissionAnalysis({ stateName }) {
  const corridors = useMemo(() => {
    if (!stateName) return []
    // Show all corridors (data file caps at 3-5 per state already)
    return (TRANSMISSION_CORRIDORS[stateName] || [])
      .slice()
      .sort((a, b) => b.riskWeight - a.riskWeight)
  }, [stateName])

  // Compact number formatting for the summary narrative
  const fmt = (n) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
  }

  // Generate a summary paragraph from top corridors
  const summary = useMemo(() => {
    if (!corridors.length) return null
    const top = corridors[0]
    const total = TRANSMISSION_CORRIDORS[stateName]?.length || 0
    const highRisk = corridors.filter(c => c.riskWeight > 0.7).length
    const totalTravel = corridors.reduce((sum, c) => sum + c.travelVolume, 0)

    const riskWord = highRisk >= 2 ? 'elevated' : highRisk === 1 ? 'moderate' : 'lower'
    return `${stateName} has ${total} active transmission corridors with ${riskWord} cross-state risk. The highest-volume pathway is the ${top.mechanism} to ${top.target}, carrying an estimated ${fmt(top.travelVolume)} daily interstate travelers. Combined daily exposure across top corridors: ~${fmt(totalTravel)} travelers.`
  }, [corridors, stateName])

  if (!corridors.length) return null

  // Shared helper — same function the globe arcs + pulse dots use, so the
  // panel bars and the 3D visuals always read the same color per corridor.
  const getRiskBarColor = getCorridorRiskColor

  return (
    <div className="transmission-analysis">
      <div className="ta-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span className="ta-title">Transmission Analysis</span>
        <span className="ta-badge" title="Travel volumes sourced from Census ACS and BTS; risk model integration next">Sourced</span>
      </div>

      <p className="ta-summary">{summary}</p>

      <div className="ta-corridors">
        {corridors.map((c, i) => (
          <div key={c.target} className="ta-corridor" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="ta-corridor-top">
              <span className="ta-corridor-target">{c.target}</span>
              <span className="ta-corridor-weight" style={{ color: getRiskBarColor(c.riskWeight) }}>
                {Math.round(c.riskWeight * 100)}
              </span>
            </div>
            <div className="ta-corridor-bar">
              <div
                className="ta-corridor-fill"
                style={{
                  width: `${c.riskWeight * 100}%`,
                  background: `linear-gradient(90deg, ${getRiskBarColor(c.riskWeight)}80, ${getRiskBarColor(c.riskWeight)})`,
                }}
              />
            </div>
            <span className="ta-corridor-mechanism">{c.mechanism}</span>
          </div>
        ))}
      </div>

      <div className="ta-footer-note">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        Travel data: Census ACS 2016-20 · BTS T-100 2023
      </div>
    </div>
  )
}

export default function StatePanel() {
  const selectedState = useStore((state) => state.selectedState)
  const selectedCounty = useStore((state) => state.selectedCounty)
  const viewMode = useStore((state) => state.viewMode)
  const clearSelection = useStore((state) => state.clearSelection)
  const clearCountySelection = useStore((state) => state.clearCountySelection)
  const enterCountyView = useStore((state) => state.enterCountyView)
  const exitCountyView = useStore((state) => state.exitCountyView)

  // ── API integration with fallback ──────────────────────────
  // Try to get real data from backend. If null (backend offline),
  // falls through to store defaults seamlessly.
  const { data: mapData, loading: mapLoading } = useMapData()
  const { data: countyRisk, loading: countyLoading } = useLocationRisk(
    selectedCounty?.fips || null
  )

  // Stop Lenis while panel is open so it doesn't fight panel scroll
  useEffect(() => {
    if (!selectedState) return
    const lenis = window.__lenis
    if (lenis) {
      lenis.stop()
      return () => lenis.start()
    }
  }, [selectedState])

  if (!selectedState) return null

  // Show skeleton only when backend is actively responding (loading = true).
  // If backend is offline, hooks return null immediately — no loading state.
  if (mapLoading || countyLoading) return <StatePanelSkeleton />

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'Low': return 'var(--accent-primary)'
      case 'Medium': return 'var(--accent-warning)'
      case 'High': return 'var(--accent-danger)'
      default: return 'var(--text-muted)'
    }
  }

  const getProgressColor = (value) => {
    if (value >= 70) return 'var(--accent-primary)'
    if (value >= 50) return 'var(--accent-warning)'
    return 'var(--accent-danger)'
  }

  const getMetricColor = (value) => {
    if (value >= 70) return '#10b981'
    if (value >= 50) return '#f0a030'
    return '#ef4444'
  }

  // Merge API data with store data — API values take priority when available.
  // If backend is offline, storeData passes through untouched.
  const storeData = selectedCounty || selectedState
  const displayData = {
    ...storeData,
    // Override with real API values for state-level view
    ...(mapData?.states?.[selectedState.abbr] && !selectedCounty ? {
      riskScore: Math.round(mapData.states[selectedState.abbr].avgRiskScore),
    } : {}),
    // Override with real API values for county-level view
    ...(countyRisk && selectedCounty ? {
      riskScore: countyRisk.riskScore,
      outbreakRisk: countyRisk.riskScore < 33 ? 'Low' : countyRisk.riskScore < 66 ? 'Medium' : 'High',
      vaccinationRate: Math.round(countyRisk.factors.vaccinationCoverage * 100),
      populationDensity: Math.round(countyRisk.factors.populationDensity * 100),
      climateRisk: Math.round(countyRisk.factors.climateRisk * 100),
      historicalTrend: Math.round(countyRisk.factors.historicalTrend * 100),
      searchTrend: Math.round(countyRisk.factors.searchTrend * 100),
    } : {}),
  }
  const hasApiFactors = !!(countyRisk && selectedCounty)
  const isCountyView = viewMode === 'state-counties'
  const isShowingCounty = !!selectedCounty

  return (
    <div className={`state-panel ${isShowingCounty ? 'county-mode' : ''}`} data-lenis-prevent>
      {/* Close/Back button */}
      <button
        className="close-btn"
        onClick={() => {
          if (isShowingCounty) {
            clearCountySelection()
          } else if (isCountyView) {
            exitCountyView()
          } else {
            clearSelection()
          }
        }}
        title={isShowingCounty ? 'Back to state' : isCountyView ? 'Back to globe' : 'Close'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {isShowingCounty || isCountyView ? (
            <polyline points="15 18 9 12 15 6" />
          ) : (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          )}
        </svg>
      </button>

      {/* Header */}
      <div className="panel-header">
        {isShowingCounty && (
          <span className="breadcrumb-mini">
            {selectedState.abbr} {'\u203A'} County
          </span>
        )}
        <h2>{displayData.name}</h2>
        <p className="population">
          {isShowingCounty ? `${selectedState.name}` : `Population: ${displayData.population || '\u2014'}`}
        </p>
        {isShowingCounty && (
          <p className="population" style={{ marginTop: '0.25rem' }}>
            Population: {displayData.population || '\u2014'}
          </p>
        )}
      </div>

      {/* ============================================
          COUNTY MODE: Enhanced view with gauges + grade
          ============================================ */}
      {isShowingCounty ? (
        <>
          {/* Health Grade + Risk Badge Row */}
          <div className="county-grade-row">
            <HealthGradeRing healthIndex={displayData.healthIndex ?? 0} />
            <div className="county-risk-card">
              <span className="county-risk-title">Outbreak Risk</span>
              <span className="county-risk-level" style={{ color: getRiskColor(displayData.outbreakRisk) }}>
                {displayData.outbreakRisk || '\u2014'}
              </span>
              <MiniSparkline
                fips={displayData.fips}
                color={displayData.riskScore != null ? getMetricColor(100 - displayData.riskScore) : '#8892a4'}
                width={90}
                height={20}
              />
            </div>
          </div>

          {/* Circular Gauges Grid */}
          <div className="county-gauges-grid">
            <CircularGauge
              value={displayData.riskScore}
              color={displayData.riskScore != null ? getMetricColor(100 - displayData.riskScore) : '#8892a4'}
              label="Risk Score"
            />
            <CircularGauge
              value={displayData.vaccinationRate}
              color={displayData.vaccinationRate != null ? getMetricColor(displayData.vaccinationRate) : '#8892a4'}
              label="Vaccination"
              suffix="%"
            />
            <CircularGauge
              value={displayData.healthIndex}
              color={displayData.healthIndex != null ? getMetricColor(displayData.healthIndex) : '#8892a4'}
              label="Health Idx"
            />
          </div>

          {/* Contributing Factors — real API data when available */}
          <div className="county-detail-metrics">
            {hasApiFactors ? (
              <>
                <div className="county-detail-row">
                  <div className="county-detail-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                  <span className="county-detail-label">Population Density</span>
                  <div className="county-detail-bar-wrap">
                    <div className="county-detail-bar">
                      <div className="county-detail-bar-fill" style={{ width: `${displayData.populationDensity}%`, backgroundColor: getMetricColor(100 - displayData.populationDensity) }} />
                    </div>
                    <span className="county-detail-value">{displayData.populationDensity}%</span>
                  </div>
                </div>
                <div className="county-detail-row">
                  <div className="county-detail-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                    </svg>
                  </div>
                  <span className="county-detail-label">Climate Risk</span>
                  <div className="county-detail-bar-wrap">
                    <div className="county-detail-bar">
                      <div className="county-detail-bar-fill" style={{ width: `${displayData.climateRisk}%`, backgroundColor: getMetricColor(100 - displayData.climateRisk) }} />
                    </div>
                    <span className="county-detail-value">{displayData.climateRisk}%</span>
                  </div>
                </div>
                <div className="county-detail-row">
                  <div className="county-detail-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                  </div>
                  <span className="county-detail-label">Historical Trend</span>
                  <div className="county-detail-bar-wrap">
                    <div className="county-detail-bar">
                      <div className="county-detail-bar-fill" style={{ width: `${displayData.historicalTrend}%`, backgroundColor: getMetricColor(100 - displayData.historicalTrend) }} />
                    </div>
                    <span className="county-detail-value">{displayData.historicalTrend}%</span>
                  </div>
                </div>
                <div className="county-detail-row">
                  <div className="county-detail-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <span className="county-detail-label">Search Trend</span>
                  <div className="county-detail-bar-wrap">
                    <div className="county-detail-bar">
                      <div className="county-detail-bar-fill" style={{ width: `${displayData.searchTrend}%`, backgroundColor: getMetricColor(100 - displayData.searchTrend) }} />
                    </div>
                    <span className="county-detail-value">{displayData.searchTrend}%</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="county-detail-row">
                  <div className="county-detail-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                  </div>
                  <span className="county-detail-label">Active Cases</span>
                  <span className="county-detail-value">{displayData.activeCases ?? '\u2014'}</span>
                </div>
                <div className="county-detail-row">
                  <div className="county-detail-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" />
                    </svg>
                  </div>
                  <span className="county-detail-label">Hospital Capacity</span>
                  <span className="county-detail-value">{displayData.hospitalCapacity != null ? `${displayData.hospitalCapacity}%` : '\u2014'}</span>
                </div>
                <div className="county-detail-row">
                  <div className="county-detail-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><path d="M12 8v4l2 2" />
                    </svg>
                  </div>
                  <span className="county-detail-label">Testing Rate</span>
                  <span className="county-detail-value">{displayData.testingRate != null ? `${displayData.testingRate}%` : '\u2014'}</span>
                </div>
                <div className="county-detail-row">
                  <div className="county-detail-icon">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                  <span className="county-detail-label">Air Quality</span>
                  <span className="county-detail-value air-quality">{displayData.airQuality || '\u2014'}</span>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="panel-footer">
            <p className="hint">ML model contributing factors</p>
          </div>
        </>
      ) : (
        <>
          {/* ============================================
              STATE MODE: Original layout
              ============================================ */}

          {/* Risk Badge */}
          <div className="risk-badge" style={{ borderColor: getRiskColor(displayData.outbreakRisk) }}>
            <span className="risk-label">Outbreak Risk</span>
            <span className="risk-value" style={{ color: getRiskColor(displayData.outbreakRisk) }}>
              {displayData.outbreakRisk || '\u2014'}
            </span>
          </div>

          {/* Metrics */}
          <div className="metrics">
            <div className="metric">
              <div className="metric-header">
                <span className="metric-label">Risk Score</span>
                <span className="metric-value">{displayData.riskScore != null ? `${displayData.riskScore}/100` : '\u2014'}</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${displayData.riskScore ?? 0}%`,
                    backgroundColor: displayData.riskScore != null ? getProgressColor(100 - displayData.riskScore) : '#8892a4'
                  }}
                />
              </div>
            </div>

            <div className="metric">
              <div className="metric-header">
                <span className="metric-label">Vaccination Rate</span>
                <span className="metric-value">{displayData.vaccinationRate != null ? `${displayData.vaccinationRate}%` : '\u2014'}</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${displayData.vaccinationRate ?? 0}%`,
                    backgroundColor: displayData.vaccinationRate != null ? getProgressColor(displayData.vaccinationRate) : '#8892a4'
                  }}
                />
              </div>
            </div>

            <div className="metric">
              <div className="metric-header">
                <span className="metric-label">Health Index</span>
                <span className="metric-value">{displayData.healthIndex != null ? `${displayData.healthIndex}/100` : '\u2014'}</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${displayData.healthIndex ?? 0}%`,
                    backgroundColor: displayData.healthIndex != null ? getProgressColor(displayData.healthIndex) : '#8892a4'
                  }}
                />
              </div>
            </div>

            <div className="metric simple">
              <span className="metric-label">Air Quality</span>
              <span className="metric-value">{displayData.airQuality || '\u2014'}</span>
            </div>
          </div>

          {/* Transmission Analysis — AI context card */}
          <TransmissionAnalysis stateName={selectedState.name} />

          {/* Footer */}
          <div className="panel-footer">
            {!isCountyView && !isShowingCounty && (
              <>
                <p className="hint">View detailed county-level data</p>
                <button className="view-counties-btn" onClick={enterCountyView}>
                  View Counties
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </>
            )}

            {isCountyView && !isShowingCounty && (
              <p className="hint">Click a county on the map for detailed data</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}