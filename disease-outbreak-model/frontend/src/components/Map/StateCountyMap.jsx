import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import useStore from '../../store/useStore'
import './StateCountyMap.css'

// Cubic bezier easing functions for Web Animations API
const EASING = {
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  smoothOut: 'cubic-bezier(0, 0, 0.2, 1)',
  smoothIn: 'cubic-bezier(0.4, 0, 1, 1)',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  elastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
}

// ============================================
// MINI GAUGE RING (SVG) — for hover card
// ============================================
function MiniGauge({ value, max = 100, size = 28, color, label }) {
  const radius = (size - 4) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (value / max) * circumference

  return (
    <div className="hover-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5"
        />
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={color} strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          fill="rgba(255,255,255,0.7)" fontSize="8" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
          {value}
        </text>
      </svg>
      <span className="hover-gauge-label">{label}</span>
    </div>
  )
}

export default function StateCountyMap() {
  const svgRef = useRef()
  const containerRef = useRef()
  const labelsGroupRef = useRef()
  const animatedCountiesRef = useRef(new Set())

  const [counties, setCounties] = useState([])
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [loading, setLoading] = useState(true)
  const [animationPhase, setAnimationPhase] = useState('loading')
  const [visibleCounties, setVisibleCounties] = useState([])
  const [visibleLabels, setVisibleLabels] = useState([])

  // Controlled fade-in
  const [fadeIn, setFadeIn] = useState(false)

  // Enhanced hover state with mouse position
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [hoveredData, setHoveredData] = useState(null)

  // Map filter state
  const [activeFilters, setActiveFilters] = useState(new Set(['low', 'medium', 'elevated', 'high']))

  // County Rankings state
  const [rankingsOpen, setRankingsOpen] = useState(false)
  const [sortMetric, setSortMetric] = useState('riskScore')
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)

  // Legend toggle (collapsed by default on mobile)
  const [legendOpen, setLegendOpen] = useState(window.innerWidth > 600)

  // ============================================
  // ZOOM/PAN — ref-based, bypasses React render cycle entirely
  // ============================================
  const transformRef = useRef({ zoom: 1, panX: 0, panY: 0 })
  const [isZoomed, setIsZoomed] = useState(false) // only for UI (d-pad visibility, cursor)
  const [cursorStyle, setCursorStyle] = useState('default')
  const gestureRef = useRef({ startDist: 0, startZoom: 1, isPinching: false, lastX: 0, lastY: 0, dragging: false })
  const zoomGroupRef = useRef(null) // the inner <g> we transform

  // Apply transform directly to DOM — no React re-render
  const applyTransform = useCallback((smooth = false) => {
    const el = zoomGroupRef.current
    if (!el) return
    const { zoom, panX, panY } = transformRef.current
    const cx = (dimensions.width / 2 - 20)
    const cy = (dimensions.height / 2 - 120)
    const tx = cx * (1 - zoom) + panX
    const ty = cy * (1 - zoom) + panY
    if (smooth) {
      el.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    } else {
      el.style.transition = 'none'
    }
    el.setAttribute('transform', `translate(${tx}, ${ty}) scale(${zoom})`)
    const zoomed = zoom > 1.05
    setIsZoomed(zoomed)
    if (!gestureRef.current.dragging) {
      setCursorStyle(zoomed ? 'grab' : 'default')
    }
  }, [dimensions.width, dimensions.height])

  // Wheel zoom — only pinch (ctrlKey) or ctrl+scroll
  const handleMapWheel = useCallback((e) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const t = transformRef.current
    const delta = e.deltaY > 0 ? -0.12 : 0.12
    t.zoom = Math.max(0.5, Math.min(4, t.zoom + delta))
    if (t.zoom <= 1) { t.panX = 0; t.panY = 0 }
    applyTransform(false)
  }, [applyTransform])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.addEventListener('wheel', handleMapWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleMapWheel)
  }, [handleMapWheel])

  // Touch — pinch-to-zoom + single-finger pan
  const handleTouchStart = useCallback((e) => {
    const g = gestureRef.current
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      g.startDist = Math.hypot(dx, dy)
      g.startZoom = transformRef.current.zoom
      g.isPinching = true
      e.preventDefault()
    } else if (e.touches.length === 1 && transformRef.current.zoom > 1) {
      g.lastX = e.touches[0].clientX
      g.lastY = e.touches[0].clientY
      g.dragging = true
      e.preventDefault()
    }
  }, [])

  const handleTouchMove = useCallback((e) => {
    const g = gestureRef.current
    const t = transformRef.current
    if (e.touches.length === 2 && g.isPinching) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      t.zoom = Math.max(0.5, Math.min(4, g.startZoom * (dist / g.startDist)))
      if (t.zoom <= 1) { t.panX = 0; t.panY = 0 }
      applyTransform(false)
    } else if (e.touches.length === 1 && g.dragging && t.zoom > 1) {
      e.preventDefault()
      t.panX += e.touches[0].clientX - g.lastX
      t.panY += e.touches[0].clientY - g.lastY
      g.lastX = e.touches[0].clientX
      g.lastY = e.touches[0].clientY
      applyTransform(false)
    }
  }, [applyTransform])

  const handleTouchEnd = useCallback(() => {
    gestureRef.current.isPinching = false
    gestureRef.current.dragging = false
  }, [])

  // Mouse drag — desktop pan when zoomed
  const handleSvgMouseDown = useCallback((e) => {
    if (transformRef.current.zoom <= 1 || e.button !== 0) return
    gestureRef.current.lastX = e.clientX
    gestureRef.current.lastY = e.clientY
    gestureRef.current.dragging = true
    setCursorStyle('grabbing')
    e.preventDefault()

    const onMove = (ev) => {
      const g = gestureRef.current
      const t = transformRef.current
      if (!g.dragging) return
      t.panX += ev.clientX - g.lastX
      t.panY += ev.clientY - g.lastY
      g.lastX = ev.clientX
      g.lastY = ev.clientY
      applyTransform(false)
    }
    const onUp = () => {
      gestureRef.current.dragging = false
      setCursorStyle(transformRef.current.zoom > 1 ? 'grab' : 'default')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [applyTransform])

  // Button handlers — all use smooth transitions
  const zoomIn = useCallback(() => {
    transformRef.current.zoom = Math.min(4, transformRef.current.zoom + 0.5)
    applyTransform(true)
  }, [applyTransform])

  const zoomOut = useCallback(() => {
    const t = transformRef.current
    t.zoom = Math.max(0.5, t.zoom - 0.5)
    if (t.zoom <= 1) { t.panX = 0; t.panY = 0 }
    applyTransform(true)
  }, [applyTransform])

  const zoomReset = useCallback(() => {
    transformRef.current = { zoom: 1, panX: 0, panY: 0 }
    applyTransform(true)
  }, [applyTransform])

  const panBy = useCallback((dx, dy) => {
    transformRef.current.panX += dx
    transformRef.current.panY += dy
    applyTransform(true)
  }, [applyTransform])

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      setFadeIn(true)
    })
    return () => cancelAnimationFrame(timer)
  }, [])

  // Store
  const selectedState = useStore(state => state.selectedState)
  const selectedCounty = useStore(state => state.selectedCounty)
  const hoveredCounty = useStore(state => state.hoveredCounty)
  const selectCounty = useStore(state => state.selectCounty)
  const setHoveredCounty = useStore(state => state.setHoveredCounty)
  const exitCountyView = useStore(state => state.exitCountyView)
  const transitionComplete = useStore(state => state.transitionComplete)
  const isTransitioning = useStore(state => state.isTransitioning)
  const stateFips = useStore(state => state.stateFips)
  const stateCapitals = useStore(state => state.stateCapitals)
  const generateCountyData = useStore(state => state.generateCountyData)

  // Get dimensions
  useEffect(() => {
    const measureContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({ width: rect.width, height: rect.height })
          return true
        }
      }
      return false
    }

    let rafId
    const attemptMeasure = () => {
      if (!measureContainer()) {
        rafId = requestAnimationFrame(attemptMeasure)
      }
    }

    rafId = requestAnimationFrame(attemptMeasure)

    const handleResize = () => { requestAnimationFrame(measureContainer) }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Load county data
  useEffect(() => {
    if (!selectedState) return

    const loadCounties = async () => {
      setLoading(true)
      setAnimationPhase('loading')
      setVisibleCounties([])
      setVisibleLabels([])
      animatedCountiesRef.current.clear()

      try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json')
        const topology = await response.json()
        const countiesGeo = feature(topology, topology.objects.counties)

        const stateCode = stateFips[selectedState.name]
        if (!stateCode) {
          setLoading(false)
          return
        }

        const stateCounties = countiesGeo.features.filter(f => {
          const countyFips = f.id.toString().padStart(5, '0')
          return countyFips.startsWith(stateCode)
        })

        const countyNames = topology.objects.counties.geometries.reduce((acc, g) => {
          acc[g.id] = g.properties?.name || `County ${g.id}`
          return acc
        }, {})

        const enrichedCounties = stateCounties.map(f => ({
          ...f,
          properties: {
            ...f.properties,
            name: countyNames[f.id] || `County ${f.id}`,
            fips: f.id.toString().padStart(5, '0'),
            ...generateCountyData(countyNames[f.id] || `County ${f.id}`, selectedState.name)
          }
        }))

        setCounties(enrichedCounties)
        setLoading(false)

        setTimeout(() => { setAnimationPhase('counties') }, 100)
      } catch (error) {
        console.error('Failed to load county data:', error)
        setLoading(false)
      }
    }

    loadCounties()
  }, [selectedState, stateFips, generateCountyData])

  // Staggered county animation
  useEffect(() => {
    if (animationPhase !== 'counties' || counties.length === 0) return

    const sortedIndices = counties.map((county, index) => {
      const bounds = d3.geoBounds(county)
      const centerLon = (bounds[0][0] + bounds[1][0]) / 2
      const centerLat = (bounds[0][1] + bounds[1][1]) / 2
      return { index, sortValue: -centerLat + centerLon * 0.5 }
    }).sort((a, b) => a.sortValue - b.sortValue)

    const totalDuration = 800
    const staggerDelay = totalDuration / counties.length

    sortedIndices.forEach(({ index }, i) => {
      setTimeout(() => {
        setVisibleCounties(prev => [...prev, index])
        const countyPath = document.querySelector(`[data-county-index="${index}"]`)
        if (countyPath && !animatedCountiesRef.current.has(index)) {
          animatedCountiesRef.current.add(index)
          countyPath.animate([
            { opacity: 0, transform: 'scale(0.8)', filter: 'blur(4px)' },
            { opacity: 0.8, transform: 'scale(1)', filter: 'blur(0px)' }
          ], {
            duration: 400,
            easing: EASING.smooth,
            fill: 'forwards'
          })
        }
      }, i * staggerDelay)
    })

    setTimeout(() => { setAnimationPhase('labels') }, totalDuration + 200)
  }, [animationPhase, counties])

  // Staggered label animation
  useEffect(() => {
    if (animationPhase !== 'labels' || counties.length === 0) return

    const totalDuration = 600
    const staggerDelay = totalDuration / counties.length

    counties.forEach((_, index) => {
      setTimeout(() => {
        setVisibleLabels(prev => [...prev, index])
      }, index * staggerDelay)
    })

    setTimeout(() => {
      setAnimationPhase('complete')
      transitionComplete()
    }, totalDuration + 100)
  }, [animationPhase, counties, transitionComplete])

  // D3 projection and path generator
  const { pathGenerator, capital } = useMemo(() => {
    if (!counties.length || !selectedState) {
      return { pathGenerator: null, capital: null }
    }

    const stateFeatureCollection = { type: 'FeatureCollection', features: counties }
    const mapWidth = dimensions.width - 40
    const mapHeight = dimensions.height - 160

    const projection = d3.geoMercator().fitSize([mapWidth, mapHeight], stateFeatureCollection)
    const pathGenerator = d3.geoPath(projection)

    const capitalData = stateCapitals[selectedState.name]
    let capital = null
    if (capitalData && projection) {
      const projected = projection([capitalData.lon, capitalData.lat])
      if (projected) {
        capital = { ...capitalData, x: projected[0], y: projected[1] }
      }
    }

    return { pathGenerator, capital }
  }, [counties, dimensions, selectedState, stateCapitals])

  // Color based on risk score
  const getCountyColor = useCallback((properties) => {
    const riskScore = properties.riskScore || 50
    if (riskScore < 30) return '#10b981'
    if (riskScore < 50) return '#f59e0b'
    if (riskScore < 70) return '#f97316'
    return '#ef4444'
  }, [])

  // Risk category for filtering
  const getRiskCategory = useCallback((riskScore) => {
    if (riskScore < 30) return 'low'
    if (riskScore < 50) return 'medium'
    if (riskScore < 70) return 'elevated'
    return 'high'
  }, [])

  const toggleFilter = useCallback((level) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }, [])

  // Sorted counties for rankings
  const sortedCounties = useMemo(() => {
    if (!counties.length) return []
    return [...counties].sort((a, b) => {
      const aVal = a.properties[sortMetric] || 0
      const bVal = b.properties[sortMetric] || 0
      return bVal - aVal
    })
  }, [counties, sortMetric])

  // County click
  const handleCountyClick = useCallback((county, event) => {
    const target = event.currentTarget
    target.animate([
      { transform: 'scale(1)', filter: 'brightness(1)' },
      { transform: 'scale(1.05)', filter: 'brightness(1.3)' },
      { transform: 'scale(1)', filter: 'brightness(1)' }
    ], {
      duration: 300,
      easing: EASING.bounce
    })
    selectCounty(county.properties.name, selectedState.name)
  }, [selectCounty, selectedState])

  // Enhanced hover with full data + position
  const handleCountyEnter = useCallback((county, event) => {
    setHoveredCounty(county.properties.name)
    setHoveredData(county.properties)
    const target = event.currentTarget
    target.animate([
      { filter: 'brightness(1)' },
      { filter: 'brightness(1.2)' }
    ], {
      duration: 150,
      easing: EASING.smoothOut,
      fill: 'forwards'
    })
  }, [setHoveredCounty])

  const handleCountyLeave = useCallback((event) => {
    setHoveredCounty(null)
    setHoveredData(null)
    const target = event.currentTarget
    target.animate([
      { filter: 'brightness(1.2)' },
      { filter: 'brightness(1)' }
    ], {
      duration: 150,
      easing: EASING.smoothIn,
      fill: 'forwards'
    })
  }, [setHoveredCounty])

  const handleMouseMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  // Back button
  const handleBackClick = useCallback(() => {
    const countyPaths = document.querySelectorAll('.county-path')
    countyPaths.forEach((path, i) => {
      path.animate([
        { opacity: 0.8, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.9)' }
      ], {
        duration: 300,
        delay: i * 5,
        easing: EASING.smoothIn,
        fill: 'forwards'
      })
    })
    setTimeout(() => { exitCountyView() }, 400)
  }, [exitCountyView])

  // Rankings click
  const handleRankingClick = useCallback((county) => {
    selectCounty(county.properties.name, selectedState.name)
  }, [selectCounty, selectedState])

  // Gauge color helper
  const getGaugeColor = useCallback((value, inverted = false) => {
    const v = inverted ? 100 - value : value
    if (v >= 70) return '#10b981'
    if (v >= 50) return '#f0a030'
    return '#ef4444'
  }, [])

  if (!selectedState) return null

  return (
    <div
      ref={containerRef}
      className={`state-county-map ${isTransitioning ? 'transitioning' : ''} ${fadeIn ? 'fade-in' : ''}`}
      onMouseMove={handleMouseMove}
    >
      {/* Back button — positioned below navbar */}
      <button className="back-to-globe-btn" onClick={handleBackClick}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Globe
      </button>

      {/* County count badge — compact, beside back button */}
      <div className="county-count-badge">
        {counties.length} Counties
      </div>

      {/* Rankings toggle button with rotating chevron */}
      <button
        className={`rankings-toggle ${rankingsOpen ? 'active' : ''}`}
        onClick={() => { setRankingsOpen(!rankingsOpen); setSortDropdownOpen(false) }}
        title="County Rankings"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h12M3 18h6" />
        </svg>
        Rankings
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`toggle-chevron ${rankingsOpen ? 'open' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* County Rankings Panel */}
      {rankingsOpen && (
        <div className="rankings-panel">
          <div className="rankings-header">
            <span className="rankings-title">County Rankings</span>
            <div className="custom-dropdown">
              <button
                className={`dropdown-trigger ${sortDropdownOpen ? 'open' : ''}`}
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
              >
                <span>{{ riskScore: 'Risk Score', vaccinationRate: 'Vaccination', healthIndex: 'Health Index', populationNum: 'Population', hospitalCapacity: 'Hospital Cap.' }[sortMetric]}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`toggle-chevron ${sortDropdownOpen ? 'open' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {sortDropdownOpen && (
                <div className="dropdown-menu">
                  {[
                    { value: 'riskScore', label: 'Risk Score' },
                    { value: 'vaccinationRate', label: 'Vaccination' },
                    { value: 'healthIndex', label: 'Health Index' },
                    { value: 'populationNum', label: 'Population' },
                    { value: 'hospitalCapacity', label: 'Hospital Cap.' },
                  ].map(opt => (
                    <div
                      key={opt.value}
                      className={`dropdown-option ${sortMetric === opt.value ? 'selected' : ''}`}
                      onClick={() => { setSortMetric(opt.value); setSortDropdownOpen(false) }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="rankings-list">
            {sortedCounties.map((county, i) => {
              const props = county.properties
              const isActive = selectedCounty?.name === props.name
              const metricVal = props[sortMetric] || 0
              const displayVal = sortMetric === 'populationNum'
                ? props.population
                : sortMetric === 'vaccinationRate' || sortMetric === 'hospitalCapacity'
                ? `${metricVal}%`
                : `${metricVal}`

              return (
                <div
                  key={props.fips || props.name}
                  className={`ranking-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleRankingClick(county)}
                  style={{ animationDelay: `${Math.min(i * 20, 600)}ms` }}
                >
                  <span className="ranking-pos">{i + 1}</span>
                  <div className="ranking-info">
                    <span className="ranking-name">{props.name}</span>
                    <div className="ranking-bar-track">
                      <div
                        className="ranking-bar-fill"
                        style={{
                          width: `${sortMetric === 'populationNum'
                            ? Math.min((metricVal / 500000) * 100, 100)
                            : metricVal}%`,
                          backgroundColor: getCountyColor(props)
                        }}
                      />
                    </div>
                  </div>
                  <span className="ranking-value">{displayVal}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading county data...</p>
        </div>
      )}

      {/* SVG Map */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="county-svg"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleSvgMouseDown}
        style={{
          touchAction: isZoomed ? 'none' : 'pan-y',
          cursor: cursorStyle
        }}
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Counties — transform applied via DOM ref, not React state */}
        <g transform="translate(20, 120)">
          <g ref={zoomGroupRef} className="counties-group">
          {pathGenerator && counties.map((county, index) => {
            const isVisible = visibleCounties.includes(index)
            const isHovered = hoveredCounty === county.properties.name
            const isSelected = selectedCounty?.name === county.properties.name
            const path = pathGenerator(county)
            const riskCategory = getRiskCategory(county.properties.riskScore)
            const isFiltered = !activeFilters.has(riskCategory)

            if (!path) return null

            return (
              <path
                key={county.id}
                data-county-index={index}
                d={path}
                fill={getCountyColor(county.properties)}
                stroke={isSelected ? '#00ffcc' : isHovered ? '#ffffff' : 'rgba(255,255,255,0.4)'}
                strokeWidth={isSelected ? 2.5 : isHovered ? 1.5 : 0.5}
                opacity={isVisible ? (isFiltered ? 0.08 : isSelected ? 1 : 0.8) : 0}
                filter={isSelected ? 'url(#glow)' : 'none'}
                className="county-path"
                onClick={(e) => !isFiltered && handleCountyClick(county, e)}
                onMouseEnter={(e) => !isFiltered && handleCountyEnter(county, e)}
                onMouseLeave={handleCountyLeave}
                style={{
                  cursor: isFiltered ? 'default' : 'pointer',
                  transformOrigin: 'center',
                  transformBox: 'fill-box',
                  transition: 'opacity 0.3s ease'
                }}
              />
            )
          })}

          {/* County labels */}
          <g ref={labelsGroupRef} className="county-labels">
            {pathGenerator && counties.map((county, index) => {
              const centroid = pathGenerator.centroid(county)
              if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return null

              const isLabelVisible = visibleLabels.includes(index)
              const isHovered = hoveredCounty === county.properties.name
              const isSelected = selectedCounty?.name === county.properties.name
              const bounds = pathGenerator.bounds(county)
              const width = bounds[1][0] - bounds[0][0]
              const area = (bounds[1][0] - bounds[0][0]) * (bounds[1][1] - bounds[0][1])
              const riskCategory = getRiskCategory(county.properties.riskScore)
              const isFiltered = !activeFilters.has(riskCategory)

              const showLabel = area > 400 || width > 25 || isHovered || isSelected
              if (!showLabel && !isHovered && !isSelected) return null

              const fontSize = isHovered || isSelected ? 11 : Math.max(7, Math.min(10, width / 5))

              return (
                <text
                  key={`label-${county.id}`}
                  x={centroid[0]}
                  y={centroid[1]}
                  className={`county-label ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    pointerEvents: 'none',
                    opacity: isFiltered ? 0.06 : (isLabelVisible || isHovered || isSelected ? (isHovered || isSelected ? 1 : 0.85) : 0),
                    fontSize: `${fontSize}px`,
                    transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), font-size 0.2s ease'
                  }}
                >
                  {county.properties.name}
                </text>
              )
            })}
          </g>

          {/* State Capital marker */}
          {capital && animationPhase === 'complete' && (
            <g
              className="capital-marker"
              transform={`translate(${capital.x}, ${capital.y})`}
            >
              <circle r="8" fill="#000" opacity="0.4" className="capital-shadow" />
              <circle r="5" fill="#ffd700" stroke="#fff" strokeWidth="1.5" className="capital-dot" />
              <text y="18" textAnchor="middle" className="capital-label">
                ★ {capital.name}
              </text>
            </g>
          )}
        </g>
        </g>
      </svg>

      {/* Zoom + Pan controls */}
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={zoomIn} title="Zoom in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button className="zoom-btn" onClick={zoomOut} title="Zoom out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        {isZoomed && (
          <button className="zoom-btn zoom-reset" onClick={zoomReset} title="Reset zoom">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 109-9" /><polyline points="3 3 3 9 9 3" />
            </svg>
          </button>
        )}
      </div>

      {/* D-pad for panning (visible when zoomed) */}
      {isZoomed && (
        <div className="pan-dpad">
          <button className="dpad-btn dpad-up" onClick={() => panBy(0, 60)} title="Pan up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
          <div className="dpad-mid">
            <button className="dpad-btn dpad-left" onClick={() => panBy(60, 0)} title="Pan left">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="dpad-center" />
            <button className="dpad-btn dpad-right" onClick={() => panBy(-60, 0)} title="Pan right">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
          <button className="dpad-btn dpad-down" onClick={() => panBy(0, -60)} title="Pan down">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}

      {/* Legend toggle button (always visible) */}
      <button
        className={`legend-toggle-btn ${legendOpen ? 'active' : ''}`}
        onClick={() => setLegendOpen(!legendOpen)}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
        Filters
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`toggle-chevron ${legendOpen ? 'open' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Legend + Filter Toggles */}
      {legendOpen && (
        <div className="map-legend">
          <h4>Risk Level</h4>
          <div className="legend-items">
            {[
              { key: 'low', color: '#10b981', label: 'Low (0-29)' },
              { key: 'medium', color: '#f59e0b', label: 'Medium (30-49)' },
              { key: 'elevated', color: '#f97316', label: 'Elevated (50-69)' },
              { key: 'high', color: '#ef4444', label: 'High (70+)' },
            ].map(item => (
              <div
                key={item.key}
                className={`legend-item filterable ${activeFilters.has(item.key) ? 'active' : 'inactive'}`}
                onClick={() => toggleFilter(item.key)}
              >
                <span
                  className="legend-color"
                  style={{
                    background: activeFilters.has(item.key) ? item.color : 'rgba(255,255,255,0.08)',
                    borderColor: activeFilters.has(item.key) ? item.color : 'rgba(255,255,255,0.1)'
                  }}
                />
                <span>{item.label}</span>
                {activeFilters.has(item.key) ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="filter-check">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="filter-x">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="county-breadcrumb">
        United States / {selectedState.name} / <strong>Counties</strong>
      </div>

      {/* Rich Hover Card — follows cursor */}
      {hoveredData && !selectedCounty && (
        <div
          className="county-hover-card"
          style={{
            left: Math.min(mousePos.x + 16, window.innerWidth - 260),
            top: Math.max(mousePos.y - 80, 10),
          }}
        >
          <div className="hover-card-header">
            <span className="hover-card-name">{hoveredData.name}</span>
            <span
              className="hover-card-risk-badge"
              style={{
                color: hoveredData.riskScore >= 70 ? '#ef4444' :
                       hoveredData.riskScore >= 50 ? '#f97316' :
                       hoveredData.riskScore >= 30 ? '#f59e0b' : '#10b981',
                borderColor: hoveredData.riskScore >= 70 ? 'rgba(239,68,68,0.3)' :
                             hoveredData.riskScore >= 50 ? 'rgba(249,115,22,0.3)' :
                             hoveredData.riskScore >= 30 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)',
                backgroundColor: hoveredData.riskScore >= 70 ? 'rgba(239,68,68,0.08)' :
                                  hoveredData.riskScore >= 50 ? 'rgba(249,115,22,0.08)' :
                                  hoveredData.riskScore >= 30 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
              }}
            >
              {hoveredData.outbreakRisk}
            </span>
          </div>
          <div className="hover-card-pop">Pop. {hoveredData.population}</div>
          <div className="hover-card-gauges">
            <MiniGauge value={hoveredData.riskScore} color={getGaugeColor(hoveredData.riskScore, true)} label="Risk" />
            <MiniGauge value={hoveredData.vaccinationRate} color={getGaugeColor(hoveredData.vaccinationRate)} label="Vacc" />
            <MiniGauge value={hoveredData.healthIndex} color={getGaugeColor(hoveredData.healthIndex)} label="Health" />
          </div>
          <div className="hover-card-footer">Click for details</div>
        </div>
      )}
    </div>
  )
}