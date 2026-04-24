import { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import useStore from '../../store/useStore'
import { batchPredictRisk } from '../../services/riskService'
import { getDiseaseById } from '../../data/trackedDiseases'
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
  const hasValue = value != null && Number.isFinite(value)
  const radius = (size - 4) / 2
  const circumference = 2 * Math.PI * radius
  const progress = hasValue ? (value / max) * circumference : 0
  const ringColor = hasValue ? color : 'rgba(255,255,255,0.08)'

  return (
    <div className="hover-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5"
        />
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={ringColor} strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          fill={hasValue ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'}
          fontSize="8" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
          {hasValue ? value : '—'}
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
  // State silhouette as a single feature — used to render the outer-edge
  // pulse during risk loading without tracing every county boundary.
  const [stateOutline, setStateOutline] = useState(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [loading, setLoading] = useState(true)
  const [animationPhase, setAnimationPhase] = useState('loading')
  const [visibleCounties, setVisibleCounties] = useState([])
  const [visibleLabels, setVisibleLabels] = useState([])

  // Controlled fade-in
  const [fadeIn, setFadeIn] = useState(false)

  // Enhanced hover state. Mouse position is a ref + rAF-driven DOM mutation
  // on hoverCardRef (not React state) so moving the cursor doesn't re-render
  // 100-300 SVG county paths on every pixel.
  const mousePosRef = useRef({ x: 0, y: 0 })
  const hoverCardRef = useRef(null)
  const mouseRafRef = useRef(null)
  const [hoveredData, setHoveredData] = useState(null)

  // Map filter state
  const [activeFilters, setActiveFilters] = useState(new Set(['low', 'medium', 'elevated', 'high']))

  // County Rankings state
  const [rankingsOpen, setRankingsOpen] = useState(false)
  const [sortMetric, setSortMetric] = useState('riskScore')
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const [rankingsFilter, setRankingsFilter] = useState('')

  // County color metric — local to the county view so it doesn't fight
  // the globe's heatmap selection. Risk is the most meaningful lens for
  // this tool; the getCountyColor helper paints counties neutral gray
  // when predictions aren't loaded yet, so this stays readable even if
  // the ML endpoint is slow or partially unavailable.
  const [colorMetric, setColorMetric] = useState('riskScore')
  const [colorMetricOpen, setColorMetricOpen] = useState(false)

  // Legend toggle (collapsed by default on mobile)
  const [legendOpen, setLegendOpen] = useState(window.innerWidth > 600)
  const [loadError, setLoadError] = useState(null)

  // Bumping this re-runs the county loader effect without a full page reload
  const [reloadTick, setReloadTick] = useState(0)

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
  const countyPopulations = useStore(state => state.countyPopulations)
  const selectedDisease = useStore(state => state.selectedDisease)
  const disease = getDiseaseById(selectedDisease)

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

  // Cache the whole-US TopoJSON so switching disease (or re-entering a state
  // view) doesn't re-download the same 1-2MB file from the CDN.
  const topologyCacheRef = useRef(null)

  // Load county geometry — only runs when the *selected state* changes.
  // Disease changes are handled by a separate effect below that re-fetches
  // just the risk data, so the user never sees the map go blank on a
  // disease switch.
  useEffect(() => {
    if (!selectedState) return

    const fetchWithTimeout = (url, ms = 6000) =>
      Promise.race([
        fetch(url).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ])

    const TOPOJSON_SOURCES = [
      'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json',
      'https://unpkg.com/us-atlas@3/counties-10m.json',
    ]

    let cancelled = false

    const loadCounties = async () => {
      setLoading(true)
      setLoadError(null)
      setAnimationPhase('loading')
      // Clear the old state's counties so the risk-fetch effect below
      // doesn't fire with stale FIPS during the fetch window.
      setCounties([])
      setStateOutline(null)
      setVisibleCounties([])
      setVisibleLabels([])
      animatedCountiesRef.current.clear()

      try {
        let topology = topologyCacheRef.current
        if (!topology) {
          let lastErr = null
          for (const url of TOPOJSON_SOURCES) {
            try {
              topology = await fetchWithTimeout(url)
              topologyCacheRef.current = topology
              break
            } catch (err) {
              lastErr = err
            }
          }
          if (!topology) throw lastErr || new Error('All county data sources failed')
        }
        if (cancelled) return

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

        // Pull the dissolved state silhouette from the same topology so the
        // loading pulse hugs the outer boundary instead of every county.
        // us-atlas may ship state ids as integers OR zero-padded strings
        // depending on the version, so compare both forms.
        const stateIdNum = parseInt(stateCode, 10)
        let outlineFeat = null
        if (topology.objects.states) {
          const statesGeo = feature(topology, topology.objects.states)
          outlineFeat = statesGeo.features.find(s =>
            s.id === stateIdNum ||
            String(s.id) === String(stateCode) ||
            String(s.id).padStart(2, '0') === String(stateCode).padStart(2, '0')
          ) ?? null
        }

        const countyNames = topology.objects.counties.geometries.reduce((acc, g) => {
          acc[g.id] = g.properties?.name || `County ${g.id}`
          return acc
        }, {})

        const fmtPop = (n) => {
          if (!n) return null
          if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
          if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
          return n.toLocaleString()
        }

        // Seed with geometry + fallback data. Risk data arrives via the
        // disease-aware effect below and is merged in without re-rendering
        // the whole map.
        const seededCounties = stateCounties.map(f => {
          const fips = f.id.toString().padStart(5, '0')
          const name = countyNames[f.id] || `County ${f.id}`
          const fallback = generateCountyData(name, selectedState.name)
          const realPop = countyPopulations?.[fips] ?? null
          return {
            ...f,
            properties: {
              ...f.properties,
              name,
              fips,
              ...fallback,
              ...(realPop != null ? {
                population: fmtPop(realPop),
                populationNum: realPop,
              } : {}),
            }
          }
        })

        if (cancelled) return
        setCounties(seededCounties)
        setStateOutline(outlineFeat)
        setLoading(false)
        setTimeout(() => { if (!cancelled) setAnimationPhase('counties') }, 100)
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load county data:', error)
        setLoadError(error?.message || 'Unknown error')
        setLoading(false)
      }
    }

    loadCounties()
    return () => { cancelled = true }
  }, [selectedState, stateFips, generateCountyData, reloadTick])

  // Whether the batch risk fetch is currently in flight. Used to drive the
  // pulse/overlay so the user knows the map is still resolving — the first
  // hit can take 5+s while the backend runs fresh ML predictions.
  const [riskLoading, setRiskLoading] = useState(false)

  // Gate the color-stagger animation so it runs exactly once per
  // (state, disease) pair — resetting when either changes. Without this,
  // color-metric toggles or incidental re-renders would re-trigger the
  // left-to-right reveal and feel glitchy.
  const colorStaggerDoneRef = useRef(false)

  // Fetch risk predictions separately — runs when state *or* disease changes.
  // On disease switch the geometry stays on screen; only the colors animate
  // once the new predictions arrive.
  useEffect(() => {
    if (!selectedState || counties.length === 0) return
    let cancelled = false

    const fipsList = counties.map(c => c.properties.fips).filter(Boolean)
    if (fipsList.length === 0) return

    setRiskLoading(true)
    // Reset so the upcoming data landing re-arms the stagger animation.
    colorStaggerDoneRef.current = false
    batchPredictRisk(fipsList, disease.apiKey)
      .then(riskData => {
        if (cancelled) return
        // If the response is null (backend offline) keep the previous
        // fallback colors. If it's an empty object (new disease has no
        // predictions for these counties), clear the old disease's risk
        // fields so we don't silently relabel them.
        if (!riskData) return
        setCounties(prev => prev.map(c => {
          const fips = c.properties.fips
          const real = riskData[fips]
          if (!real) {
            // New disease has no prediction for this county — clear any
            // stale values left over from the previous disease.
            return {
              ...c,
              properties: {
                ...c.properties,
                riskScore: null,
                outbreakRisk: null,
                vaccinationRate: null,
                healthIndex: null,
              },
            }
          }
          return {
            ...c,
            properties: {
              ...c.properties,
              riskScore: Math.round(real.riskScore),
              outbreakRisk: real.riskScore < 33 ? 'Low' : real.riskScore < 66 ? 'Medium' : 'High',
              vaccinationRate: Math.round(real.factors.vaccinationCoverage * 100),
              healthIndex: Math.round(
                real.factors.vaccinationCoverage * 50
                + (1 - real.factors.climateRisk) * 30
                + (1 - real.factors.historicalTrend) * 20
              ),
            },
          }
        }))
      })
      .catch(() => { /* backend offline — keep fallback colors */ })
      .finally(() => { if (!cancelled) setRiskLoading(false) })

    return () => { cancelled = true }
    // counties.length (not counties itself) — only trigger when the geometry
    // list changes (new state), not every time we patch a county in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState, disease.apiKey, counties.length])

  // Hydrate population into already-loaded counties when the store lookup
  // arrives (fires once when /locations resolves, even if county view was
  // opened before that).
  useEffect(() => {
    if (!counties.length || !countyPopulations || Object.keys(countyPopulations).length === 0) return
    const fmtPop = (n) => {
      if (!n) return null
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
      if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
      return n.toLocaleString()
    }
    // Only patch counties missing a populationNum — avoid clobbering riskData
    const needsPatch = counties.some(c => c.properties.populationNum == null && countyPopulations[c.properties.fips])
    if (!needsPatch) return
    setCounties(prev => prev.map(c => {
      if (c.properties.populationNum != null) return c
      const pop = countyPopulations[c.properties.fips]
      if (!pop) return c
      return { ...c, properties: { ...c.properties, population: fmtPop(pop), populationNum: pop } }
    }))
  }, [counties, countyPopulations])

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

    // Collect every timer ID so we can cancel on cleanup. Without this,
    // clicking Back → another state mid-animation fires stale timers into
    // the new state's DOM (wrong county paths animate).
    const timers = []

    sortedIndices.forEach(({ index }, i) => {
      timers.push(setTimeout(() => {
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
      }, i * staggerDelay))
    })

    // One batched update once the animations are underway so React's opacity
    // attribute matches reality (prevents later re-renders from flashing the
    // counties back to opacity 0).
    timers.push(setTimeout(() => {
      setVisibleCounties(counties.map((_, i) => i))
    }, Math.min(100, staggerDelay * 2)))

    timers.push(setTimeout(() => { setAnimationPhase('labels') }, totalDuration + 200))

    return () => { timers.forEach(clearTimeout) }
  }, [animationPhase, counties])

  // Staggered label animation — same batching treatment as counties to
  // avoid N re-renders across the 600ms label fade-in. CSS opacity
  // transition on .county-label handles the visual stagger via delay.
  useEffect(() => {
    if (animationPhase !== 'labels' || counties.length === 0) return

    const totalDuration = 600
    const staggerDelay = totalDuration / counties.length

    // Flip all labels to visible in one render; visual stagger is done
    // by CSS transition on .county-label (opacity 0.3s).
    setTimeout(() => {
      setVisibleLabels(counties.map((_, i) => i))
    }, Math.min(50, staggerDelay))

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

  // Normalization max per non-risk metric (computed once, keyed by metric)
  const metricMax = useMemo(() => {
    const out = { populationNum: 0, vaccinationRate: 100, healthIndex: 100 }
    for (const c of counties) {
      const p = c.properties
      if (p.populationNum && p.populationNum > out.populationNum) out.populationNum = p.populationNum
    }
    return out
  }, [counties])

  // Color based on active metric. Any metric that requires ML data falls
  // back to neutral gray when the backend is offline, so the map reads as
  // "no data" rather than a misleading uniform color.
  const NO_DATA_COLOR = 'rgba(120, 130, 150, 0.25)'
  const getCountyColor = useCallback((properties) => {
    if (colorMetric === 'riskScore') {
      if (properties.riskScore == null) return NO_DATA_COLOR
      const riskScore = properties.riskScore
      if (riskScore < 30) return '#10b981'
      if (riskScore < 50) return '#f59e0b'
      if (riskScore < 70) return '#f97316'
      return '#ef4444'
    }
    if (colorMetric === 'populationNum') {
      if (!metricMax.populationNum || properties.populationNum == null) {
        return NO_DATA_COLOR
      }
      const t = Math.min(1, properties.populationNum / metricMax.populationNum)
      const alpha = 0.2 + t * 0.7
      return `rgba(14, 165, 233, ${alpha.toFixed(2)})`
    }
    // Vaccination / Health: higher = greener; neutral gray when no data
    if (properties[colorMetric] == null) return NO_DATA_COLOR
    const v = properties[colorMetric]
    if (v >= 70) return '#10b981'
    if (v >= 50) return '#f59e0b'
    if (v >= 30) return '#f97316'
    return '#ef4444'
  }, [colorMetric, metricMax])

  // Color stagger — once risk data lands, sweep the counties' fills from
  // neutral gray to their risk color left-to-right. useLayoutEffect fires
  // synchronously after commit so we beat the browser to paint (no flash
  // of the target colors before the stagger kicks in). Guarded by a ref
  // so it runs exactly once per (state × disease) landing.
  // Placed here (below pathGenerator + getCountyColor) because it reads
  // both — moving it earlier hits a TDZ ReferenceError.
  useLayoutEffect(() => {
    if (riskLoading || colorStaggerDoneRef.current) return
    if (!pathGenerator || counties.length === 0) return
    const anyHasRisk = counties.some(c => c.properties.riskScore != null)
    if (!anyHasRisk) return
    colorStaggerDoneRef.current = true

    // Sort by centroid x so the reveal sweeps west → east.
    const ordered = counties
      .map((c, index) => {
        const centroid = pathGenerator.centroid(c)
        return {
          index,
          x: Number.isFinite(centroid[0]) ? centroid[0] : 0,
          targetColor: getCountyColor(c.properties),
        }
      })
      .sort((a, b) => a.x - b.x)

    // Cap per-step delay so wide states (Texas = 254 counties) don't
    // drag the reveal out to several seconds.
    const totalDuration = 900
    const staggerDelay = Math.min(10, totalDuration / ordered.length)
    const FROM_FILL = NO_DATA_COLOR

    ordered.forEach(({ index, targetColor }, i) => {
      const path = document.querySelector(`[data-county-index="${index}"]`)
      if (!path) return
      path.animate(
        [
          { fill: FROM_FILL },
          { fill: targetColor },
        ],
        {
          duration: 480,
          delay: i * staggerDelay,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          // `both` applies the first keyframe (gray) during the delay so
          // counties don't flash their target color before their turn.
          fill: 'both',
        }
      )
    })
  }, [riskLoading, counties, pathGenerator, getCountyColor, NO_DATA_COLOR])

  // Risk category for filtering — always based on riskScore regardless of
  // the active color metric (filters are a separate concern).
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

  // Sorted + filtered counties for rankings
  const sortedCounties = useMemo(() => {
    if (!counties.length) return []
    const q = rankingsFilter.trim().toLowerCase()
    const list = q
      ? counties.filter(c => c.properties.name?.toLowerCase().includes(q))
      : counties
    return [...list].sort((a, b) => {
      // Push null-valued counties to the bottom so they don't all tie at 0
      // with counties that legitimately scored 0.
      const aVal = a.properties[sortMetric]
      const bVal = b.properties[sortMetric]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      return bVal - aVal
    })
  }, [counties, sortMetric, rankingsFilter])

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
    selectCounty(county.properties.name, selectedState.name, county.properties.fips)
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

  // Mouse tracker — writes to a ref, then schedules a single rAF to mutate
  // the hover card's position in the DOM. This replaces a per-pixel setState
  // that was re-rendering all county paths.
  const handleMouseMove = useCallback((e) => {
    mousePosRef.current.x = e.clientX
    mousePosRef.current.y = e.clientY
    if (mouseRafRef.current != null) return
    mouseRafRef.current = requestAnimationFrame(() => {
      mouseRafRef.current = null
      const el = hoverCardRef.current
      if (!el) return
      const { x, y } = mousePosRef.current
      el.style.left = `${Math.min(x + 16, window.innerWidth - 260)}px`
      el.style.top = `${Math.max(y - 80, 10)}px`
    })
  }, [])

  // Cancel any pending rAF on unmount
  useEffect(() => () => {
    if (mouseRafRef.current != null) cancelAnimationFrame(mouseRafRef.current)
  }, [])

  // Back button
  const handleBackClick = useCallback(() => {
    // Close any open overlays so they don't reappear on the next county
    // view entry (state is retained in closure otherwise)
    setRankingsOpen(false)
    setColorMetricOpen(false)
    setSortDropdownOpen(false)
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

  // Rankings click — close the panel, select the county, and pan the map
  // so the newly-selected county is centered (otherwise in a big state like
  // Texas the user has no idea where their pick is on the map).
  const handleRankingClick = useCallback((county) => {
    selectCounty(county.properties.name, selectedState.name, county.properties.fips)
    setRankingsOpen(false)
    if (pathGenerator) {
      const centroid = pathGenerator.centroid(county)
      if (centroid && Number.isFinite(centroid[0]) && Number.isFinite(centroid[1])) {
        const t = transformRef.current
        // Bump zoom to 1.6x if currently at or near default so the county
        // is actually visible, not lost in the full state view.
        if (t.zoom < 1.2) t.zoom = 1.6
        const cx = (dimensions.width / 2 - 20)
        const cy = (dimensions.height / 2 - 120)
        t.panX = t.zoom * (cx - centroid[0])
        t.panY = t.zoom * (cy - centroid[1])
        applyTransform(true)
      }
    }
  }, [selectCounty, selectedState, pathGenerator, dimensions, applyTransform])

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

      {/* Top-center context — disease being predicted + county count.
          Keeps the user grounded in "what map am I looking at". */}
      <div className="map-context-cluster">
        <div className="map-disease-pill" title={`Colored by ${disease.name} risk score`}>
          <span className="map-disease-dot" style={{ background: disease.accent }} />
          <span className="map-disease-label">{disease.name}</span>
        </div>
        <div className="county-count-badge">
          {counties.length} Counties
          {(() => {
            const visibleCount = counties.filter(c =>
              activeFilters.has(getRiskCategory(c.properties.riskScore))
            ).length
            if (visibleCount === counties.length) return null
            return (
              <span className="county-count-filter"> · {visibleCount} shown</span>
            )
          })()}
        </div>
        {riskLoading && (
          <div className="risk-loading-pill" title="Running fresh ML predictions for this state">
            <span className="risk-loading-dot" />
            Resolving risk…
          </div>
        )}
      </div>

      {/* Top-right control cluster — keeps the metric picker and rankings
          toggle aligned and prevents overlap when labels grow. */}
      <div className="map-controls-cluster">
        {/* Color metric picker — paints the county fill by risk / pop / vax / health */}
        <div className="color-metric-wrap">
          <button
            className={`color-metric-toggle ${colorMetricOpen ? 'active' : ''}`}
            onClick={() => { setColorMetricOpen(o => !o); setRankingsOpen(false) }}
            title="Color counties by metric"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
            </svg>
            {{ riskScore: 'Risk', populationNum: 'Population', vaccinationRate: 'Vaccination', healthIndex: 'Health' }[colorMetric]}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={`toggle-chevron ${colorMetricOpen ? 'open' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {colorMetricOpen && (() => {
            // Detect which metrics have real data loaded right now. "No
            // prediction" is more honest than "offline" — the backend may
            // be fine, but Ahmed hasn't seeded every state × disease pair
            // yet, so some counties genuinely have no ML output.
            const hasMetric = (key) => counties.some(c => c.properties[key] != null)
            const availability = {
              riskScore: hasMetric('riskScore'),
              populationNum: hasMetric('populationNum'),
              vaccinationRate: hasMetric('vaccinationRate'),
              healthIndex: hasMetric('healthIndex'),
            }
            const subFor = (key, liveSub) =>
              availability[key] ? liveSub : 'no prediction for this state'
            return (
            <div className="color-metric-menu">
              {[
                { value: 'riskScore', label: 'Risk Score', sub: subFor('riskScore', 'ML prediction') },
                { value: 'populationNum', label: 'Population', sub: subFor('populationNum', 'Census / locations') },
                { value: 'vaccinationRate', label: 'Vaccination', sub: subFor('vaccinationRate', 'ML factor') },
                { value: 'healthIndex', label: 'Health Index', sub: subFor('healthIndex', 'derived composite') },
              ].map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  className={`dropdown-option ${colorMetric === opt.value ? 'selected' : ''}`}
                  onClick={() => { setColorMetric(opt.value); setColorMetricOpen(false) }}
                >
                  <span>{opt.label}</span>
                  <span className="color-metric-sub">{opt.sub}</span>
                </button>
              ))}
            </div>
            )
          })()}
        </div>

        {/* Rankings toggle button with rotating chevron */}
        <button
          className={`rankings-toggle ${rankingsOpen ? 'active' : ''}`}
          onClick={() => { setRankingsOpen(!rankingsOpen); setSortDropdownOpen(false); setColorMetricOpen(false) }}
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
      </div>

      {/* County Rankings Panel */}
      {rankingsOpen && (
        <div className="rankings-panel" data-lenis-prevent>
          <div className="rankings-header">
            <span className="rankings-title">County Rankings</span>
            <div className="custom-dropdown">
              <button
                className={`dropdown-trigger ${sortDropdownOpen ? 'open' : ''}`}
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
              >
                <span>{{ riskScore: 'Risk Score', vaccinationRate: 'Vaccination', healthIndex: 'Health Index', populationNum: 'Population' }[sortMetric]}</span>
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
                  ].map(opt => (
                    <button
                      type="button"
                      key={opt.value}
                      className={`dropdown-option ${sortMetric === opt.value ? 'selected' : ''}`}
                      onClick={() => { setSortMetric(opt.value); setSortDropdownOpen(false) }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick filter input */}
          <div className="rankings-filter">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder={`Filter ${counties.length} counties...`}
              value={rankingsFilter}
              onChange={(e) => setRankingsFilter(e.target.value)}
            />
            {rankingsFilter && (
              <button className="rankings-filter-clear" onClick={() => setRankingsFilter('')} title="Clear filter">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div className="rankings-list">
            {sortedCounties.length === 0 && rankingsFilter && (
              <div className="rankings-empty">No counties match "{rankingsFilter}"</div>
            )}
            {sortedCounties.map((county, i) => {
              const props = county.properties
              const isActive = selectedCounty?.name === props.name
              const rawVal = props[sortMetric]
              const hasVal = rawVal != null
              const displayVal = !hasVal
                ? '—'
                : sortMetric === 'populationNum'
                ? (props.population || '—')
                : sortMetric === 'vaccinationRate'
                ? `${rawVal}%`
                : `${rawVal}`
              const barWidth = !hasVal
                ? 0
                : sortMetric === 'populationNum'
                ? Math.min((rawVal / 500000) * 100, 100)
                : rawVal

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
                          width: `${barWidth}%`,
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

      {/* Fatal error state — both mirrors failed */}
      {loadError && !loading && counties.length === 0 && (
        <div className="loading-overlay county-error">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="county-error-title">County map unavailable</p>
          <p className="county-error-subtitle">
            Couldn't reach either county-geometry source. Check your network and retry, or return to the globe.
          </p>
          <div className="county-error-actions">
            <button
              className="county-error-btn primary"
              onClick={() => {
                // Re-trigger the loader without a full page reload
                // (a full reload would wipe Zustand state and dump the
                // user back on the landing globe)
                setLoadError(null)
                topologyCacheRef.current = null
                setReloadTick(t => t + 1)
              }}
            >
              Reload
            </button>
            <button className="county-error-btn" onClick={exitCountyView}>
              Back to globe
            </button>
          </div>
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

            // CDC NHSN / COVID / Salmonella public data sources only publish
            // state-level aggregates — there's no authoritative per-county
            // surveillance to advertise. Uniform subtle stroke across counties.
            const stroke = isSelected
              ? '#00ffcc'
              : isHovered
              ? '#ffffff'
              : 'rgba(255,255,255,0.4)'
            const strokeWidth = isSelected ? 2.5 : isHovered ? 1.5 : 0.5

            return (
              <path
                key={county.id}
                data-county-index={index}
                d={path}
                fill={getCountyColor(county.properties)}
                stroke={stroke}
                strokeWidth={strokeWidth}
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

          {/* Outer-edge loading pulse — sits ABOVE the counties so the
              county fills don't eat the inner half of the stroke. Rendered
              once per loading cycle; removed when batch predictions land. */}
          {riskLoading && stateOutline && pathGenerator && (
            <path
              className="state-outline-pulse"
              d={pathGenerator(stateOutline)}
              fill="none"
              pointerEvents="none"
            />
          )}
        </g>
        </g>
      </svg>

      {/* Zoom + Pan controls. Reset is always visible so accidental
          zooms (in *or* out) can be undone without hunting for a way back. */}
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
        <button className="zoom-btn zoom-reset" onClick={zoomReset} title="Reset view">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 109-9" /><polyline points="3 3 3 9 9 3" />
          </svg>
        </button>
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

      {/* Legend — content swaps to match the active color metric */}
      {legendOpen && (() => {
        const metricGradients = {
          populationNum: {
            heading: 'Population',
            gradient: 'linear-gradient(90deg, rgba(120,130,150,0.25) 0%, rgba(14,165,233,0.2) 20%, rgba(14,165,233,0.9) 100%)',
            lowLabel: 'Small',
            highLabel: 'Largest',
          },
          vaccinationRate: {
            heading: 'Vaccination Rate',
            gradient: 'linear-gradient(90deg, #ef4444 0%, #f97316 33%, #f59e0b 66%, #10b981 100%)',
            lowLabel: '0%',
            highLabel: '100%',
          },
          healthIndex: {
            heading: 'Health Index',
            gradient: 'linear-gradient(90deg, #ef4444 0%, #f97316 33%, #f59e0b 66%, #10b981 100%)',
            lowLabel: 'Poor',
            highLabel: 'Excellent',
          },
        }
        const activeMetric = metricGradients[colorMetric]
        return (
        <div className="map-legend">
          {activeMetric ? (
            // Non-risk metric — just a gradient reference
            <div className="legend-metric-section">
              <h4>{activeMetric.heading}</h4>
              <div className="legend-gradient-bar" style={{ background: activeMetric.gradient }} />
              <div className="legend-gradient-labels">
                <span>{activeMetric.lowLabel}</span>
                <span>{activeMetric.highLabel}</span>
              </div>
            </div>
          ) : (
            // Risk score — interactive filter buckets (filters counties on the map)
            <>
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
            </>
          )}

        </div>
        )
      })()}

      {/* Breadcrumb handled by App.jsx (external .breadcrumb) in county view */}


      {/* Rich Hover Card — position updated via ref + rAF in handleMouseMove,
          not React state, so cursor movement doesn't re-render the map. */}
      {hoveredData && !selectedCounty && (
        <div
          ref={hoverCardRef}
          className="county-hover-card"
          style={{
            left: Math.min(mousePosRef.current.x + 16, window.innerWidth - 260),
            top: Math.max(mousePosRef.current.y - 80, 10),
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