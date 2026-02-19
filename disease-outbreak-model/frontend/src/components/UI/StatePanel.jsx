import { useMemo } from 'react'
import useStore from '../../store/useStore'
import TRANSMISSION_CORRIDORS from '../../data/transmissionCorridors'
import { useMapData, useLocationRisk } from '../../services'
import { StatePanelSkeleton, EmptyPrediction } from './LoadingStates'
import './LoadingStates.css'
import './StatePanel.css'

// ============================================
// CIRCULAR GAUGE â€” animated ring with value
// ============================================
function CircularGauge({ value, max = 100, size = 56, strokeWidth = 4, color, label, suffix = '' }) {
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (value / max) * circumference

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
          fill="rgba(255,255,255,0.85)" fontSize="13" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
          {value}{suffix}
        </text>
        <text x={size/2} y={size/2 + 11} textAnchor="middle"
          fill="rgba(255,255,255,0.25)" fontSize="6" fontFamily="'JetBrains Mono', monospace"
          textTransform="uppercase" letterSpacing="0.06em">
          /{max}
        </text>
      </svg>
      <span className="gauge-label">{label}</span>
    </div>
  )
}

// ============================================
// MINI SPARKLINE â€” procedural trend line
// ============================================
function MiniSparkline({ value, color, width = 80, height = 24 }) {
  // Generate deterministic "trend" from value
  const points = useMemo(() => {
    const pts = []
    const steps = 12
    let y = 50
    const seed = value * 137.5
    for (let i = 0; i <= steps; i++) {
      const noise = Math.sin(seed + i * 1.8) * 18 + Math.cos(seed * 0.7 + i * 2.4) * 10
      y = Math.max(5, Math.min(95, 50 + noise - (i / steps) * (value > 50 ? -15 : 15)))
      pts.push({ x: (i / steps) * width, y: (y / 100) * height })
    }
    return pts
  }, [value, width, height])

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  return (
    <svg width={width} height={height} className="mini-sparkline">
      <defs>
        <linearGradient id={`spark-${value}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathD} L ${width} ${height} L 0 ${height} Z`}
        fill={`url(#spark-${value})`}
      />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2" fill={color} />
    </svg>
  )
}

// ============================================
// HEALTH GRADE RING â€” A-F letter grade
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
// TRANSMISSION ANALYSIS â€” AI context card
// ============================================
function TransmissionAnalysis({ stateName }) {
  const corridors = useMemo(() => {
    if (!stateName) return []
    return (TRANSMISSION_CORRIDORS[stateName] || [])
      .sort((a, b) => b.riskWeight - a.riskWeight)
      .slice(0, 3)
  }, [stateName])

  // Generate a summary paragraph from top corridors
  const summary = useMemo(() => {
    if (!corridors.length) return null
    const top = corridors[0]
    const total = TRANSMISSION_CORRIDORS[stateName]?.length || 0
    const highRisk = corridors.filter(c => c.riskWeight > 0.7).length
    const totalTravel = corridors.reduce((sum, c) => sum + c.travelVolume, 0)

    const riskWord = highRisk >= 2 ? 'elevated' : highRisk === 1 ? 'moderate' : 'lower'
    return `${stateName} has ${total} active transmission corridors with ${riskWord} cross-state risk. The highest-volume pathway is the ${top.mechanism} to ${top.target}, carrying an estimated ${top.travelVolume}K daily interstate travelers. Combined daily exposure across top corridors: ~${totalTravel}K travelers.`
  }, [corridors, stateName])

  if (!corridors.length) return null

  const getRiskBarColor = (weight) => {
    if (weight > 0.75) return '#ff6b4a'
    if (weight > 0.55) return '#f0a030'
    return '#00e0a0'
  }

  return (
    <div className="transmission-analysis">
      <div className="ta-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <span className="ta-title">Transmission Analysis</span>
        <span className="ta-badge">Demo</span>
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
        Placeholder analysis â€” awaiting ML model
      </div>
    </div>
  )
}

// ============================================
// COUNTY TRANSMISSION ANALYSIS â€” WHO-style epi brief
// ============================================
function CountyTransmissionAnalysis({ countyData, stateName, allCounties }) {
  const analysis = useMemo(() => {
    if (!countyData) return null

    const { name, populationNum, riskScore, vaccinationRate, hospitalCapacity,
            testingRate, activeCases, healthIndex } = countyData

    // Deterministic pseudo-random from county name
    const hash = (name + stateName).split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0); return a & a
    }, 0)
    const pr = (seed) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x) }

    // WHO-style metrics
    const popDensity = populationNum > 200000 ? 'high' : populationNum > 50000 ? 'moderate' : 'low'
    const densityPer = populationNum > 200000 ? Math.floor(800 + pr(hash + 20) * 4000)
                     : populationNum > 50000 ? Math.floor(200 + pr(hash + 21) * 600)
                     : Math.floor(20 + pr(hash + 22) * 180)

    // Effective reproduction number (Rt) â€” derived from risk score and vaccination
    const vaccGap = 100 - vaccinationRate
    const rt = (0.5 + (riskScore / 100) * 1.8 + (vaccGap / 100) * 0.5).toFixed(2)
    const rtStatus = rt > 1.5 ? 'critical' : rt > 1.0 ? 'concerning' : 'controlled'

    // Case doubling time (days)
    const doublingTime = rt > 1.0
      ? Math.max(3, Math.floor(14 / (parseFloat(rt) - 0.3)))
      : null

    // Vulnerable population estimate
    const vulnerablePct = Math.floor(12 + pr(hash + 30) * 18)

    // Generate 2-3 plausible neighboring counties as spread targets
    const neighborNames = [
      ['Washington', 'Jefferson', 'Lincoln', 'Franklin', 'Jackson', 'Madison',
       'Monroe', 'Hamilton', 'Adams', 'Marshall', 'Clay', 'Warren',
       'Union', 'Lake', 'Greene', 'Marion', 'Fayette', 'Clark'],
      ['Riverside', 'Clearwater', 'Oakdale', 'Summit', 'Valley', 'Highland',
       'Fairview', 'Cedar', 'Pine', 'Maple', 'Eagle', 'Stone']
    ]

    const hashIdx = Math.abs(hash)
    const neighbors = [
      neighborNames[0][(hashIdx + 3) % neighborNames[0].length],
      neighborNames[0][(hashIdx + 7) % neighborNames[0].length],
      neighborNames[1][(hashIdx + 2) % neighborNames[1].length],
    ].filter(n => n !== name).slice(0, 3)

    // Spread risk per neighbor
    const spreadPaths = neighbors.map((n, i) => {
      const pathRisk = Math.min(95, Math.max(15, riskScore + Math.floor(pr(hash + 40 + i) * 30) - 15))
      const dailyCommuters = Math.floor(500 + pr(hash + 50 + i) * (populationNum > 100000 ? 8000 : 2000))
      const mechanism = [
        'Highway corridor / commuter traffic',
        'Shared healthcare facilities',
        'School district overlap / youth contact',
        'Commercial hub / retail workers',
        'Agricultural supply chain',
        'Public transit connectivity',
      ][Math.floor(pr(hash + 60 + i) * 6)]
      return { name: n, pathRisk, dailyCommuters, mechanism }
    })

    // Capacity strain assessment
    const strainLevel = hospitalCapacity < 70 ? 'strained' : hospitalCapacity < 85 ? 'moderate load' : 'adequate'
    const surgeCapacity = hospitalCapacity < 70
      ? `${Math.floor(pr(hash + 70) * 5 + 2)} day surge buffer`
      : `${Math.floor(pr(hash + 70) * 14 + 7)} day surge buffer`

    return {
      popDensity, densityPer, rt, rtStatus, doublingTime, vulnerablePct,
      spreadPaths, strainLevel, surgeCapacity, testingAdequacy:
        testingRate > 70 ? 'adequate' : testingRate > 40 ? 'below threshold' : 'critically low'
    }
  }, [countyData, stateName])

  if (!analysis) return null

  const rtColor = analysis.rtStatus === 'critical' ? '#ef4444'
    : analysis.rtStatus === 'concerning' ? '#f0a030' : '#10b981'

  return (
    <div className="county-transmission-analysis">
      <div className="cta-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
        </svg>
        <span className="cta-title">Epidemiological Brief</span>
        <span className="ta-badge">Demo</span>
      </div>

      {/* Key indicators row */}
      <div className="cta-indicators">
        <div className="cta-indicator">
          <span className="cta-ind-value" style={{ color: rtColor }}>{analysis.rt}</span>
          <span className="cta-ind-label">R<sub>t</sub> Est.</span>
        </div>
        <div className="cta-ind-divider" />
        <div className="cta-indicator">
          <span className="cta-ind-value" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {analysis.doublingTime ? `${analysis.doublingTime}d` : 'â€”'}
          </span>
          <span className="cta-ind-label">Doubling</span>
        </div>
        <div className="cta-ind-divider" />
        <div className="cta-indicator">
          <span className="cta-ind-value" style={{ color: 'rgba(255,255,255,0.6)' }}>{analysis.vulnerablePct}%</span>
          <span className="cta-ind-label">Vulnerable</span>
        </div>
      </div>

      {/* Brief summary */}
      <p className="cta-brief">
        {analysis.popDensity === 'high' ? 'High' : analysis.popDensity === 'moderate' ? 'Moderate' : 'Low'} density
        county (~{analysis.densityPer}/miÂ²) with R<sub>t</sub> {analysis.rtStatus === 'critical' ? 'above critical threshold' : analysis.rtStatus === 'concerning' ? 'above 1.0 indicating active spread' : 'below 1.0 indicating decline'}.
        Hospital capacity {analysis.strainLevel} with {analysis.surgeCapacity}.
        Testing coverage {analysis.testingAdequacy}.
      </p>

      {/* Spread pathways */}
      <div className="cta-spread-header">Projected Spread Pathways</div>
      <div className="cta-spread-paths">
        {analysis.spreadPaths.map((path, i) => (
          <div key={path.name} className="cta-path" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="cta-path-top">
              <span className="cta-path-name">â†’ {path.name} Co.</span>
              <span className="cta-path-risk" style={{
                color: path.pathRisk > 65 ? '#ef4444' : path.pathRisk > 40 ? '#f0a030' : '#10b981'
              }}>
                {path.pathRisk}
              </span>
            </div>
            <div className="cta-path-bar">
              <div className="cta-path-fill" style={{
                width: `${path.pathRisk}%`,
                backgroundColor: path.pathRisk > 65 ? '#ef4444' : path.pathRisk > 40 ? '#f0a030' : '#10b981'
              }} />
            </div>
            <div className="cta-path-meta">
              <span>{path.mechanism}</span>
              <span>~{path.dailyCommuters.toLocaleString()}/day</span>
            </div>
          </div>
        ))}
      </div>

      <div className="ta-footer-note">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        WHO methodology placeholder â€” awaiting ML model
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
  // falls through to store's mock data seamlessly.
  const { data: mapData, loading: mapLoading } = useMapData()
  const { data: countyRisk, loading: countyLoading } = useLocationRisk(
    selectedCounty?.fips || null
  )

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
      vaccinationRate: Math.round(countyRisk.factors.vaccinationCoverage * 100),
    } : {}),
  }
  const isCountyView = viewMode === 'state-counties'
  const isShowingCounty = !!selectedCounty

  return (
    <div className={`state-panel ${isShowingCounty ? 'county-mode' : ''}`}>
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
            {selectedState.abbr} â€º County
          </span>
        )}
        <h2>{displayData.name}</h2>
        <p className="population">
          {isShowingCounty ? `${selectedState.name}` : `Population: ${displayData.population}`}
        </p>
        {isShowingCounty && (
          <p className="population" style={{ marginTop: '0.25rem' }}>
            Population: {displayData.population}
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
            <HealthGradeRing healthIndex={displayData.healthIndex} />
            <div className="county-risk-card">
              <span className="county-risk-title">Outbreak Risk</span>
              <span className="county-risk-level" style={{ color: getRiskColor(displayData.outbreakRisk) }}>
                {displayData.outbreakRisk}
              </span>
              <MiniSparkline
                value={displayData.riskScore}
                color={getMetricColor(100 - displayData.riskScore)}
                width={90}
                height={20}
              />
            </div>
          </div>

          {/* Circular Gauges Grid */}
          <div className="county-gauges-grid">
            <CircularGauge
              value={displayData.riskScore}
              color={getMetricColor(100 - displayData.riskScore)}
              label="Risk Score"
            />
            <CircularGauge
              value={displayData.vaccinationRate}
              color={getMetricColor(displayData.vaccinationRate)}
              label="Vaccination"
              suffix="%"
            />
            <CircularGauge
              value={displayData.healthIndex}
              color={getMetricColor(displayData.healthIndex)}
              label="Health Idx"
            />
          </div>

          {/* Additional Metrics */}
          <div className="county-detail-metrics">
            <div className="county-detail-row">
              <div className="county-detail-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <span className="county-detail-label">Active Cases</span>
              <span className="county-detail-value">{displayData.activeCases}</span>
            </div>
            <div className="county-detail-row">
              <div className="county-detail-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" />
                </svg>
              </div>
              <span className="county-detail-label">Hospital Capacity</span>
              <div className="county-detail-bar-wrap">
                <div className="county-detail-bar">
                  <div
                    className="county-detail-bar-fill"
                    style={{
                      width: `${displayData.hospitalCapacity}%`,
                      backgroundColor: getMetricColor(displayData.hospitalCapacity)
                    }}
                  />
                </div>
                <span className="county-detail-value">{displayData.hospitalCapacity}%</span>
              </div>
            </div>
            <div className="county-detail-row">
              <div className="county-detail-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4l2 2" />
                </svg>
              </div>
              <span className="county-detail-label">Testing Rate</span>
              <div className="county-detail-bar-wrap">
                <div className="county-detail-bar">
                  <div
                    className="county-detail-bar-fill"
                    style={{
                      width: `${displayData.testingRate}%`,
                      backgroundColor: getMetricColor(displayData.testingRate)
                    }}
                  />
                </div>
                <span className="county-detail-value">{displayData.testingRate}%</span>
              </div>
            </div>
            <div className="county-detail-row">
              <div className="county-detail-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <span className="county-detail-label">Air Quality</span>
              <span className="county-detail-value air-quality">{displayData.airQuality}</span>
            </div>
          </div>

          {/* County Epidemiological Brief */}
          <CountyTransmissionAnalysis
            countyData={displayData}
            stateName={selectedState.name}
          />

          {/* Footer */}
          <div className="panel-footer">
            <p className="hint">County health metrics (placeholder data)</p>
            <div className="data-notice">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Data ready for backend integration</span>
            </div>
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
              {displayData.outbreakRisk}
            </span>
          </div>

          {/* Metrics */}
          <div className="metrics">
            <div className="metric">
              <div className="metric-header">
                <span className="metric-label">Risk Score</span>
                <span className="metric-value">{displayData.riskScore}/100</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${displayData.riskScore}%`,
                    backgroundColor: getProgressColor(100 - displayData.riskScore)
                  }}
                />
              </div>
            </div>

            <div className="metric">
              <div className="metric-header">
                <span className="metric-label">Vaccination Rate</span>
                <span className="metric-value">{displayData.vaccinationRate}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${displayData.vaccinationRate}%`,
                    backgroundColor: getProgressColor(displayData.vaccinationRate)
                  }}
                />
              </div>
            </div>

            <div className="metric">
              <div className="metric-header">
                <span className="metric-label">Health Index</span>
                <span className="metric-value">{displayData.healthIndex}/100</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${displayData.healthIndex}%`,
                    backgroundColor: getProgressColor(displayData.healthIndex)
                  }}
                />
              </div>
            </div>

            <div className="metric simple">
              <span className="metric-label">Air Quality</span>
              <span className="metric-value">{displayData.airQuality}</span>
            </div>
          </div>

          {/* Transmission Analysis â€” AI context card */}
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