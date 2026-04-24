import { useState, useEffect, useMemo, useRef } from 'react'
import useStore from '../../store/useStore'
import { feature } from 'topojson-client'
import { getOutbreakHistory } from '../../services/dataService'
import { getDiseaseById, TRACKED_DISEASES } from '../../data/trackedDiseases'
import TRANSMISSION_CORRIDORS from '../../data/transmissionCorridors'
import './ComparisonMode.css'

// Inline disease picker — lets the user switch diseases without leaving the modal
function DiseasePicker({ selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const current = TRACKED_DISEASES.find(d => d.id === selected) || TRACKED_DISEASES[0]

  return (
    <div className="cmp-disease-picker" ref={ref}>
      <button
        type="button"
        className={`cmp-disease-badge ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Switch the disease used for trend comparison"
      >
        {current.name}
        <svg className={`cmp-disease-chevron ${open ? 'open' : ''}`} width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="cmp-disease-dropdown">
          {TRACKED_DISEASES.map(d => (
            <button
              key={d.id}
              className={`cmp-disease-option ${d.id === selected ? 'selected' : ''}`}
              onClick={() => { onChange(d.id); setOpen(false) }}
            >
              {d.name}
              {d.id === selected && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// CONSTANTS
// ============================================
const STATE_COLORS = [
  { fill: 'rgba(0,255,204,0.15)', stroke: '#00ffcc', glow: 'rgba(0,255,204,0.4)', bg: 'rgba(0,255,204,0.06)', text: '#00ffcc' },
  { fill: 'rgba(14,165,233,0.15)', stroke: '#0ea5e9', glow: 'rgba(14,165,233,0.4)', bg: 'rgba(14,165,233,0.06)', text: '#0ea5e9' },
  { fill: 'rgba(240,192,64,0.15)', stroke: '#f0c040', glow: 'rgba(240,192,64,0.4)', bg: 'rgba(240,192,64,0.06)', text: '#f0c040' },
]

const RADAR_AXES = [
  { key: 'healthIndex', label: 'Health Index', max: 100 },
  { key: 'vaccinationRate', label: 'Vaccination', max: 100 },
  { key: 'riskScoreInv', label: 'Safety Score', max: 100 },
  { key: 'airQualityNum', label: 'Air Quality', max: 100 },
  { key: 'infrastructureScore', label: 'Infrastructure', max: 100 },
]

const AIR_QUALITY_MAP = { 'Good': 85, 'Moderate': 60, 'Poor': 35, 'Unhealthy': 15 }

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

// Module-level cache for loaded GeoJSON features
let cachedFeatures = null

function getNumericData(state) {
  const hi = state.healthIndex ?? 0
  const vr = state.vaccinationRate ?? 0
  const rs = state.riskScore ?? 0
  const aq = AIR_QUALITY_MAP[state.airQuality] ?? 0
  return {
    healthIndex: hi,
    vaccinationRate: vr,
    riskScoreInv: state.riskScore != null ? 100 - rs : 0,
    airQualityNum: aq,
    infrastructureScore: (state.healthIndex != null || state.vaccinationRate != null)
      ? Math.round(hi * 0.4 + vr * 0.4 + (100 - rs) * 0.2)
      : 0,
  }
}

// ============================================
// HOOK — Load detailed TopoJSON once
// ============================================
function useDetailedGeo() {
  const [features, setFeatures] = useState(cachedFeatures)

  useEffect(() => {
    if (cachedFeatures) { setFeatures(cachedFeatures); return }

    let cancelled = false
    fetch(TOPO_URL)
      .then(r => r.json())
      .then(topo => {
        if (cancelled) return
        const geo = feature(topo, topo.objects.states)
        // Map FIPS to state names
        const fipsToName = {
          '01':'Alabama','02':'Alaska','04':'Arizona','05':'Arkansas','06':'California',
          '08':'Colorado','09':'Connecticut','10':'Delaware','11':'District of Columbia',
          '12':'Florida','13':'Georgia','15':'Hawaii','16':'Idaho','17':'Illinois',
          '18':'Indiana','19':'Iowa','20':'Kansas','21':'Kentucky','22':'Louisiana',
          '23':'Maine','24':'Maryland','25':'Massachusetts','26':'Michigan','27':'Minnesota',
          '28':'Mississippi','29':'Missouri','30':'Montana','31':'Nebraska','32':'Nevada',
          '33':'New Hampshire','34':'New Jersey','35':'New Mexico','36':'New York',
          '37':'North Carolina','38':'North Dakota','39':'Ohio','40':'Oklahoma',
          '41':'Oregon','42':'Pennsylvania','44':'Rhode Island','45':'South Carolina',
          '46':'South Dakota','47':'Tennessee','48':'Texas','49':'Utah','50':'Vermont',
          '51':'Virginia','53':'Washington','54':'West Virginia','55':'Wisconsin','56':'Wyoming',
        }
        geo.features.forEach(f => {
          f.properties.name = fipsToName[f.id] || f.properties.name || ''
        })
        cachedFeatures = geo.features
        setFeatures(geo.features)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return features
}

// ============================================
// HELPER — Convert GeoJSON feature to SVG path
// ============================================
function geoToSvgPath(geom, viewW, viewH, padding) {
  // Collect all coordinate rings
  const allRings = []
  if (geom.type === 'Polygon') {
    geom.coordinates.forEach(ring => allRings.push(ring))
  } else if (geom.type === 'MultiPolygon') {
    geom.coordinates.forEach(poly => poly.forEach(ring => allRings.push(ring)))
  }
  if (allRings.length === 0) return null

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  allRings.forEach(ring => ring.forEach(([lng, lat]) => {
    if (lng < minX) minX = lng; if (lng > maxX) maxX = lng
    if (lat < minY) minY = lat; if (lat > maxY) maxY = lat
  }))

  const geoW = maxX - minX || 1
  const geoH = maxY - minY || 1
  const usableW = viewW - padding * 2
  const usableH = viewH - padding * 2
  const scale = Math.min(usableW / geoW, usableH / geoH)
  const offsetX = padding + (usableW - geoW * scale) / 2
  const offsetY = padding + (usableH - geoH * scale) / 2

  return allRings.map(ring => {
    const pts = ring.map(([lng, lat]) => {
      const x = (lng - minX) * scale + offsetX
      const y = (maxY - lat) * scale + offsetY
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    return `M${pts.join('L')}Z`
  }).join(' ')
}

// ============================================
// STATE CARD — Silhouette background + name
// ============================================
function StateCard({ stateName, colorIndex, onRemove, animate, stateInfo, geoFeatures }) {
  const color = STATE_COLORS[colorIndex] || STATE_COLORS[0]

  const pathD = useMemo(() => {
    if (!geoFeatures) return null
    const feat = geoFeatures.find(f => f.properties.name === stateName)
    if (!feat) return null
    return geoToSvgPath(feat.geometry, 320, 180, 14)
  }, [stateName, geoFeatures])

  return (
    <div className={`cmp-state-card ${animate ? 'animate' : ''}`}
      style={{
        '--card-color': color.stroke,
        '--card-glow': color.glow,
        '--card-bg': color.bg,
        animationDelay: `${200 + colorIndex * 150}ms`,
      }}>

      {/* Blurred silhouette background */}
      <div className="cmp-card-sil-bg">
        <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id={`blur-${colorIndex}`}>
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          {pathD && (
            <>
              {/* Blurred fill layer */}
              <path d={pathD}
                fill={color.fill}
                stroke="none"
                filter={`url(#blur-${colorIndex})`}
                opacity="0.8"
              />
              {/* Crisp outline on top */}
              <path d={pathD}
                fill="none"
                stroke={color.stroke}
                strokeWidth="1.2"
                strokeLinejoin="round"
                opacity="0.35"
              />
            </>
          )}
        </svg>
      </div>

      {/* Content overlay */}
      <div className="cmp-card-content">
        <div className="cmp-card-info">
          <h3 className="cmp-card-name" style={{ color: color.text }}>{stateName}</h3>
          <span className="cmp-card-pop">{stateInfo?.population || '\u2014'}</span>
        </div>
        <span className="cmp-card-grade" style={{ color: color.stroke }}>
          {stateInfo?.healthIndex != null ? (stateInfo.healthIndex >= 70 ? 'A' : stateInfo.healthIndex >= 60 ? 'B' : 'C') : '\u2014'}
        </span>
      </div>

      {/* Color accent line at bottom */}
      <div className="cmp-card-accent" style={{ background: `linear-gradient(90deg, transparent, ${color.stroke}, transparent)` }} />

      {/* Remove button */}
      <button className="cmp-card-remove" onClick={(e) => { e.stopPropagation(); onRemove() }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

// ============================================
// SEARCH BAR — lives above cards, outside overflow
// ============================================
function StateSearchBar({ onAdd, existingStates, stateData, disabled }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)

  const available = useMemo(() => {
    const allNames = Object.keys(stateData)
    return allNames
      .filter(n => !existingStates.includes(n))
      .filter(n => n.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 6)
  }, [query, existingStates, stateData])

  const handleSelect = (name) => {
    onAdd(name)
    setQuery('')
    setFocused(false)
    inputRef.current?.blur()
  }

  const showDropdown = focused && query.length > 0 && available.length > 0

  return (
    <div className="cmp-search-bar">
      <div className={`cmp-search-box ${focused ? 'focused' : ''}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder={disabled ? 'Max 3 states selected' : 'Search states to compare...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          disabled={disabled}
        />
        {query && (
          <button className="cmp-search-clear" onClick={() => { setQuery(''); inputRef.current?.focus() }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      {showDropdown && (
        <div className="cmp-search-dropdown" data-lenis-prevent>
          {available.map(name => (
            <button key={name} className="cmp-search-dropdown-item" onMouseDown={() => handleSelect(name)}>
              <span className="cmp-search-item-name">{name}</span>
              <span className="cmp-search-item-add">+ Add</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// RADAR CHART
// ============================================
function RadarChart({ statesData, animate }) {
  const cx = 180, cy = 180, maxR = 120
  const numAxes = RADAR_AXES.length
  const angleStep = (2 * Math.PI) / numAxes
  const gridRings = [0.2, 0.4, 0.6, 0.8, 1.0]

  const getPoint = (axisIndex, value) => {
    const angle = axisIndex * angleStep - Math.PI / 2
    const r = (value / 100) * maxR
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }

  const getPolygonPoints = (data) => {
    return RADAR_AXES.map((axis, i) => {
      const val = data[axis.key] || 0
      const pt = getPoint(i, val)
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
    }).join(' ')
  }

  return (
    <svg className="cmp-radar-svg" viewBox="0 0 360 360">
      {/* Grid */}
      {gridRings.map((pct, i) => {
        const pts = RADAR_AXES.map((_, ai) => {
          const pt = getPoint(ai, pct * 100)
          return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`
        }).join(' ')
        return <polygon key={i} points={pts} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={i === 4 ? 1 : 0.5} />
      })}
      {/* Axis lines */}
      {RADAR_AXES.map((_, i) => {
        const pt = getPoint(i, 100)
        return <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      })}
      {/* Axis labels — anchored based on position */}
      {RADAR_AXES.map((axis, i) => {
        const pt = getPoint(i, 132)
        // Left-side labels anchor end, right-side anchor start, top/bottom middle
        const anchor = pt.x < cx - 10 ? 'end' : pt.x > cx + 10 ? 'start' : 'middle'
        return (
          <text key={i} x={pt.x} y={pt.y} textAnchor={anchor} dominantBaseline="central" className="cmp-radar-label">
            {axis.label}
          </text>
        )
      })}
      {/* Data polygons */}
      {statesData.map((item, i) => (
        <g key={i}>
          <polygon
            points={animate ? getPolygonPoints(item.data) : `${cx},${cy} `.repeat(numAxes)}
            fill={STATE_COLORS[i]?.fill || STATE_COLORS[0].fill}
            stroke={STATE_COLORS[i]?.stroke || STATE_COLORS[0].stroke}
            strokeWidth="2"
            strokeLinejoin="round"
            className="cmp-radar-polygon"
            style={{
              transition: 'all 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              transitionDelay: `${400 + i * 200}ms`,
              filter: `drop-shadow(0 0 8px ${STATE_COLORS[i]?.glow || STATE_COLORS[0].glow})`,
            }}
          />
          {animate && RADAR_AXES.map((axis, ai) => {
            const pt = getPoint(ai, item.data[axis.key] || 0)
            return (
              <circle key={ai} cx={pt.x} cy={pt.y} r="3"
                fill={STATE_COLORS[i]?.stroke || '#00ffcc'}
                className="cmp-radar-dot"
                style={{ animationDelay: `${800 + i * 200 + ai * 80}ms`, filter: `drop-shadow(0 0 4px ${STATE_COLORS[i]?.glow})` }}
              />
            )
          })}
        </g>
      ))}
    </svg>
  )
}

// ============================================
// SHARED CORRIDORS — detect bidirectional transmission links between
// the compared states and surface them as a callout
// ============================================
function SharedCorridors({ stateNames }) {
  const links = useMemo(() => {
    if (stateNames.length < 2) return []
    const results = []
    for (let i = 0; i < stateNames.length; i++) {
      for (let j = i + 1; j < stateNames.length; j++) {
        const a = stateNames[i]
        const b = stateNames[j]
        const aToB = (TRANSMISSION_CORRIDORS[a] || []).find(c => c.target === b)
        const bToA = (TRANSMISSION_CORRIDORS[b] || []).find(c => c.target === a)
        if (aToB || bToA) {
          const c = aToB || bToA
          const combinedVolume = (aToB?.travelVolume || 0) + (bToA?.travelVolume || 0) || c.travelVolume
          results.push({
            from: a,
            to: b,
            mechanism: c.mechanism,
            adjacent: c.adjacent,
            volume: combinedVolume,
            factors: c.factors,
            colorA: STATE_COLORS[i]?.stroke,
            colorB: STATE_COLORS[j]?.stroke,
          })
        }
      }
    }
    return results.sort((x, y) => y.volume - x.volume)
  }, [stateNames])

  if (links.length === 0) return null

  const fmt = (n) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
  }

  return (
    <div className="cmp-shared-section">
      <div className="cmp-panel-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 7h8M8 12h8M8 17h5" />
          <path d="M3 3l18 18" strokeDasharray="2 3" opacity="0.5" />
        </svg>
        Shared Corridors
      </div>
      <div className="cmp-shared-list">
        {links.map((link, i) => (
          <div key={`${link.from}-${link.to}`} className="cmp-shared-link">
            <div className="cmp-shared-link-states">
              <span className="cmp-shared-link-dot" style={{ background: link.colorA, boxShadow: `0 0 4px ${link.colorA}` }} />
              <span className="cmp-shared-link-name">{link.from}</span>
              <svg className="cmp-shared-link-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
                <path d="M19 12H5M12 19l-7-7 7-7" opacity="0.4" />
              </svg>
              <span className="cmp-shared-link-dot" style={{ background: link.colorB, boxShadow: `0 0 4px ${link.colorB}` }} />
              <span className="cmp-shared-link-name">{link.to}</span>
            </div>
            <div className="cmp-shared-link-meta">
              <span className="cmp-shared-link-mechanism">{link.mechanism}</span>
              <span className="cmp-shared-link-volume">{fmt(link.volume)}/day</span>
              {link.adjacent && <span className="cmp-shared-link-adjacent">shared border</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="cmp-shared-footnote">
        Based on Census ACS commuter flows and BTS T-100 air passengers. Elevated volume = stronger bi-directional transmission coupling.
      </div>
    </div>
  )
}

// ============================================
// METRIC COMPARISON BAR
// ============================================
function MetricBar({ label, values, stateNames, maxVal = 100, animate, suffix = '' }) {
  const best = Math.max(...values)

  return (
    <div className="cmp-metric-bar">
      <span className="cmp-metric-label">{label}</span>
      <div className="cmp-metric-tracks">
        {values.map((val, i) => (
          <div key={i} className="cmp-metric-track-row">
            <span className="cmp-metric-state-tag" style={{ color: STATE_COLORS[i]?.text || '#fff' }}>
              {stateNames[i]?.slice(0, 3).toUpperCase()}
            </span>
            <div className="cmp-metric-track">
              <div className="cmp-metric-fill"
                style={{
                  width: animate ? `${(val / maxVal) * 100}%` : '0%',
                  background: STATE_COLORS[i]?.stroke || '#00ffcc',
                  boxShadow: `0 0 8px ${STATE_COLORS[i]?.glow || 'transparent'}`,
                  transitionDelay: `${600 + i * 100}ms`,
                }}
              />
            </div>
            <span className={`cmp-metric-val ${val === best && values.filter(v => v === best).length === 1 ? 'winner' : ''}`}
              style={{ color: STATE_COLORS[i]?.text || '#fff' }}>
              {val}{suffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// TREND COMPARISON — overlaid 12-week sparklines per state, disease-scoped
// ============================================
function TrendComparison({ stateNames, disease, animate }) {
  const stateFips = useStore(s => s.stateFips)
  const stateData = useStore(s => s.stateData)
  const [rawSeries, setRawSeries] = useState({})
  const [loading, setLoading] = useState(true)
  const [normalize, setNormalize] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setRawSeries({})

    Promise.all(stateNames.map(name => {
      const fips = stateFips[name]
      if (!fips) return Promise.resolve([name, null])
      // Statewide rollup FIPS — auto-populates once Jacob's SUM seed runs.
      return getOutbreakHistory(fips + '000', { diseaseType: disease.apiKey, limit: 12 })
        .then(data => [name, data])
        .catch(() => [name, null])
    })).then(results => {
      if (cancelled) return
      const out = {}
      for (const [name, data] of results) {
        if (data && data.length >= 2) {
          out[name] = data.map(d => d.caseCount ?? 0).reverse()
        }
      }
      setRawSeries(out)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [stateNames.join(','), stateFips, disease.apiKey])

  // Apply per-100K normalization if requested (divides by pop / 100,000)
  const series = useMemo(() => {
    if (!normalize) return rawSeries
    const out = {}
    for (const [name, values] of Object.entries(rawSeries)) {
      const pop = stateData[name]?.populationNum
      if (!pop) { out[name] = values; continue }
      const per100k = pop / 100_000
      out[name] = values.map(v => v / per100k)
    }
    return out
  }, [rawSeries, normalize, stateData])

  const w = 720, h = 180
  const padL = 40, padR = 16, padT = 12, padB = 24

  // Compute shared y-axis domain across all series
  const allValues = Object.values(series).flat()
  const maxVal = Math.max(...allValues, 1)
  const maxLen = Math.max(...Object.values(series).map(s => s.length), 1)
  const hasAnyData = Object.keys(series).length > 0

  const xOf = (i, len) => padL + (len > 1 ? (i / (len - 1)) * (w - padL - padR) : (w - padL - padR) / 2)
  const yOf = (v) => padT + (h - padT - padB) - (v / maxVal) * (h - padT - padB)

  const fmtY = (v) => normalize ? v.toFixed(1) : Math.round(v).toLocaleString()

  return (
    <div className="cmp-trend-section">
      <div className="cmp-trend-header-row">
        <div className="cmp-panel-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          {disease.name} Trend — last 12 weeks
        </div>
        <div className="cmp-normalize-toggle" role="group" aria-label="Scale">
          <button
            type="button"
            className={`cmp-normalize-btn ${!normalize ? 'active' : ''}`}
            onClick={() => setNormalize(false)}
            title="Raw case counts"
          >
            Total
          </button>
          <button
            type="button"
            className={`cmp-normalize-btn ${normalize ? 'active' : ''}`}
            onClick={() => setNormalize(true)}
            title="Weekly cases divided by population/100k — eliminates state-size bias"
          >
            Per 100K
          </button>
        </div>
      </div>

      <div className="cmp-trend-chart-wrap">
        <svg viewBox={`0 0 ${w} ${h}`} className="cmp-trend-svg" preserveAspectRatio="none">
          {/* Gridlines */}
          {[0, 0.5, 1].map((pct, i) => {
            const yVal = maxVal * pct
            return (
              <g key={i}>
                <line x1={padL} x2={w - padR} y1={yOf(yVal)} y2={yOf(yVal)}
                  stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
                <text x={padL - 6} y={yOf(yVal) + 3} textAnchor="end"
                  fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="'JetBrains Mono', monospace">
                  {fmtY(yVal)}
                </text>
              </g>
            )
          })}

          {/* One line per state */}
          {stateNames.map((name, idx) => {
            const data = series[name]
            if (!data || data.length < 2) return null
            const color = STATE_COLORS[idx] || STATE_COLORS[0]
            const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i, data.length).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
            const endX = xOf(data.length - 1, data.length)
            const endY = yOf(data[data.length - 1])
            return (
              <g key={name} style={{ opacity: animate ? 1 : 0, transition: `opacity 0.6s ease ${400 + idx * 120}ms` }}>
                <path d={path} fill="none" stroke={color.stroke} strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 6px ${color.glow})` }} />
                <circle cx={endX} cy={endY} r="3.5" fill={color.stroke} stroke="#0a1020" strokeWidth="1.5" />
              </g>
            )
          })}
        </svg>

        {loading && (
          <div className="cmp-trend-loading">Loading…</div>
        )}
        {!loading && !hasAnyData && (
          <div className="cmp-trend-empty">
            No {disease.name.toLowerCase()} surveillance data for the selected states yet.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="cmp-trend-legend">
        {stateNames.map((name, i) => {
          const color = STATE_COLORS[i] || STATE_COLORS[0]
          const data = series[name]
          const latest = data && data.length > 0 ? data[data.length - 1] : null
          return (
            <div key={name} className="cmp-trend-legend-item">
              <span className="cmp-trend-legend-dot" style={{ background: color.stroke, boxShadow: `0 0 6px ${color.glow}` }} />
              <span className="cmp-trend-legend-name" style={{ color: color.text }}>{name}</span>
              <span className="cmp-trend-legend-val">
                {latest != null
                  ? (normalize ? `${latest.toFixed(1)} / 100K` : `${Math.round(latest).toLocaleString()} cases`)
                  : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function ComparisonMode() {
  const comparisonOpen = useStore(s => s.comparisonOpen)
  const closeComparison = useStore(s => s.closeComparison)
  const comparisonStates = useStore(s => s.comparisonStates)
  const addComparisonState = useStore(s => s.addComparisonState)
  const removeComparisonState = useStore(s => s.removeComparisonState)
  const stateData = useStore(s => s.stateData)
  const selectedDisease = useStore(s => s.selectedDisease)
  const setSelectedDisease = useStore(s => s.setSelectedDisease)
  const disease = getDiseaseById(selectedDisease)

  const [animate, setAnimate] = useState(false)
  const geoFeatures = useDetailedGeo()

  // Lock page scroll when modal is open — use Lenis if available
  useEffect(() => {
    if (comparisonOpen) {
      const lenis = window.__lenis
      if (lenis) {
        lenis.stop()
        return () => lenis.start()
      } else {
        const html = document.documentElement
        const prev = html.style.overflow
        html.style.overflow = 'hidden'
        return () => { html.style.overflow = prev }
      }
    }
  }, [comparisonOpen])

  useEffect(() => {
    if (comparisonOpen) {
      const t = setTimeout(() => setAnimate(true), 150)
      return () => clearTimeout(t)
    } else {
      setAnimate(false)
    }
  }, [comparisonOpen])

  useEffect(() => {
    if (comparisonOpen && comparisonStates.length > 0) {
      setAnimate(false)
      const t = setTimeout(() => setAnimate(true), 100)
      return () => clearTimeout(t)
    }
  }, [comparisonStates.length])

  const statesWithData = useMemo(() => {
    return comparisonStates.map(name => ({
      name,
      raw: stateData[name] || {},
      data: getNumericData(stateData[name] || {}),
    }))
  }, [comparisonStates, stateData])

  if (!comparisonOpen) return null

  const hasStates = statesWithData.length > 0

  return (
    <div className="cmp-overlay" onClick={closeComparison}>
      <div className={`cmp-page ${animate ? 'visible' : ''}`} data-lenis-prevent onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="cmp-header">
          <div className="cmp-header-left">
            <h2 className="cmp-title">Compare States</h2>
            <span className="cmp-subtitle">
              Select up to 3 states for side-by-side analysis
              <DiseasePicker selected={selectedDisease} onChange={setSelectedDisease} />
            </span>
          </div>
          <button className="cmp-close" onClick={closeComparison}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ====== SEARCH BAR — outside overflow containers ====== */}
        <StateSearchBar
          onAdd={addComparisonState}
          existingStates={comparisonStates}
          stateData={stateData}
          disabled={comparisonStates.length >= 3}
        />

        {/* ====== STATE CARDS SLIDER ====== */}
        {comparisonStates.length > 0 && (
          <div className="cmp-cards-slider">
            <div className="cmp-cards-track">
              {comparisonStates.map((name, i) => (
                <StateCard
                  key={name}
                  stateName={name}
                  colorIndex={i}
                  stateInfo={stateData[name]}
                  geoFeatures={geoFeatures}
                  onRemove={() => removeComparisonState(name)}
                  animate={animate}
                />
              ))}
            </div>
          </div>
        )}

        {/* ====== BODY ====== */}
        <div className="cmp-body">
          {!hasStates ? (
            <div className="cmp-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.15">
                <path d="M18 20V10M12 20V4M6 20v-6" />
              </svg>
              <span>Search and add states above to begin comparing</span>
            </div>
          ) : (
            <>
              {/* Live disease trend */}
              <TrendComparison
                stateNames={comparisonStates}
                disease={disease}
                animate={animate}
              />

              {/* Shared transmission corridors between compared states */}
              <SharedCorridors stateNames={comparisonStates} />

              {/* Radar Chart */}
              <div className="cmp-radar-section">
                <div className="cmp-panel-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                  </svg>
                  Radar Analysis
                </div>
                <RadarChart statesData={statesWithData} animate={animate} />
              </div>

              {/* Metric bars */}
              <div className="cmp-metrics-section">
                <div className="cmp-panel-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 20V10M12 20V4M6 20v-6" />
                  </svg>
                  Detailed Comparison
                </div>
                <div className="cmp-metrics-grid">
                  <MetricBar label="Health Index" stateNames={comparisonStates}
                    values={statesWithData.map(s => s.data.healthIndex)} animate={animate} />
                  <MetricBar label="Vaccination Rate" stateNames={comparisonStates}
                    values={statesWithData.map(s => s.data.vaccinationRate)} animate={animate} />
                  <MetricBar label="Safety Score" stateNames={comparisonStates}
                    values={statesWithData.map(s => s.data.riskScoreInv)} animate={animate} />
                  <MetricBar label="Air Quality" stateNames={comparisonStates}
                    values={statesWithData.map(s => s.data.airQualityNum)} animate={animate} />
                  <MetricBar label="Infrastructure" stateNames={comparisonStates}
                    values={statesWithData.map(s => s.data.infrastructureScore)} animate={animate} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}