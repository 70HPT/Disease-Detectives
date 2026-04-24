import { Canvas } from '@react-three/fiber'
import { Suspense, useRef, useEffect, useState } from 'react'
import Lenis from 'lenis'
import useStore from './store/useStore'
import StatePanel from './components/UI/StatePanel'
import StateHealthRings from './components/UI/StateHealthRings'
import StateTimeline from './components/UI/StateTimeline'
import WatchlistDashboard from './components/UI/WatchlistDashboard'
import ComparisonMode from './components/UI/ComparisonMode'
import HeatmapLegend from './components/UI/HeatmapLegend'
import EarthWithStates from './components/Earth3D/EarthWithStates'
import StateCountyMap from './components/Map/StateCountyMap'
import ContentSections from './components/UI/ContentSections'
import Navbar from './components/Layout/Navbar'
import SettingsPanel from './components/UI/SettingsPanel'
import ErrorBoundary from './components/UI/ErrorBoundary'
import USAtAGlance from './components/UI/USAtAGlance'
import StateHoverTooltip from './components/UI/StateHoverTooltip'
import { getMapData, getAvailableDiseases } from './services/riskService'
import { listLocations } from './services/locationService'
import { getDiseaseById } from './data/trackedDiseases'

import 'lenis/dist/lenis.css'
import './App.css'

let lenisInstance = null

function useLenis() {
  useEffect(() => {
    lenisInstance = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      autoRaf: false, // We drive RAF manually for tighter control
    })

    // Start stopped — EarthWithStates will start Lenis when intro completes
    // This prevents Lenis from accumulating scroll targets during the intro
    lenisInstance.stop()
    window.__lenis = lenisInstance

    function raf(time) {
      lenisInstance?.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)

    return () => {
      lenisInstance.destroy()
      lenisInstance = null
      window.__lenis = null
    }
  }, [])
}

function useScrollProgress() {
  const scrollTargetRef = useRef(0)

  // DOM refs — manipulated directly, bypassing React
  const headerRef = useRef(null)
  const scrollIndicatorRef = useRef(null)
  const contentWrapperRef = useRef(null)
  const breadcrumbRef = useRef(null)
  const ataglanceRef = useRef(null)

  useEffect(() => {
    let prev = { faded: false, indicator: true, content: false, breadcrumb: false }

    const updateDOM = (progress) => {
      const faded = progress > 0.3
      const indicator = progress < 0.1
      const content = progress > 0.2
      const animated = progress > 0.3
      const breadcrumb = progress > 0.5

      if (faded !== prev.faded) {
        prev.faded = faded
        headerRef.current?.classList.toggle('faded', faded)
      }
      if (indicator !== prev.indicator) {
        prev.indicator = indicator
        scrollIndicatorRef.current?.classList.toggle('scroll-hidden', !indicator)
      }
      if (content !== prev.content) {
        prev.content = content
        contentWrapperRef.current?.classList.toggle('visible', content)
      }
      // LATCH: sections-animated only gets ADDED, never removed.
      // CSS animation fill-mode: forwards keeps sections visible after animation.
      // Removing the class would snap them back to opacity: 0.
      // On content remount (state deselect), fresh DOM has no class — resets naturally.
      if (animated && !contentWrapperRef.current?.classList.contains('sections-animated')) {
        contentWrapperRef.current?.classList.add('sections-animated')
      }
      if (breadcrumb !== prev.breadcrumb) {
        prev.breadcrumb = breadcrumb
        breadcrumbRef.current?.classList.toggle('hidden', breadcrumb)
        // US at-a-glance vanishes on the same threshold as the breadcrumb
        ataglanceRef.current?.classList.toggle('scroll-hidden', breadcrumb)
      }
    }

    const handleScroll = () => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight
      const progress = Math.min(1, Math.max(0, scrollY / windowHeight))
      scrollTargetRef.current = progress
      updateDOM(progress)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return { scrollTargetRef, headerRef, scrollIndicatorRef, contentWrapperRef, breadcrumbRef, ataglanceRef }
}

// ============================================
// LOADING SCREEN DISMISSAL
// The loading animation lives in index.html as pure CSS — renders instantly
// before any JS loads. This hook fades it out when Three.js is ready.
// ============================================
function useDismissLoadingScreen() {
  const sceneReady = useStore((state) => state.sceneReady)

  useEffect(() => {
    if (sceneReady) {
      const overlay = document.getElementById('loading-screen')
      if (overlay) {
        overlay.classList.add('fade-out')
        setTimeout(() => overlay.remove(), 800)
      }
    }
  }, [sceneReady])
}

function App() {
  // Smooth scroll — Lenis intercepts wheel/touch and smooths them out
  useLenis()

  // Dismiss the index.html loading screen when Three.js scene is ready
  useDismissLoadingScreen()

  // Hydrate store with live API data on mount
  const hydrateStateData = useStore((state) => state.hydrateStateData)
  const selectedDisease = useStore((state) => state.selectedDisease)

  // Re-fetch /risk/map whenever the selected disease changes so the globe
  // colors + state panel metrics reflect the correct per-disease aggregation.
  useEffect(() => {
    const apiKey = getDiseaseById(selectedDisease).apiKey
    let cancelled = false
    getMapData(apiKey).then((data) => {
      if (cancelled) return
      hydrateStateData(data)
    })
    return () => { cancelled = true }
  }, [selectedDisease, hydrateStateData])

  // One-time: discover which diseases the backend has active models for.
  // If this fails, we fall back to showing all TRACKED_DISEASES.
  useEffect(() => {
    getAvailableDiseases().then((keys) => {
      if (keys) useStore.getState().hydrateAvailableDiseases(keys)
    })
  }, [])

  // One-time hydration: populations from /locations (independent of disease).
  useEffect(() => {
    listLocations({ limit: 4000 }).then((locations) => {
      if (!locations) return
      const statePops = {}
      const countyPops = {}
      for (const loc of locations) {
        if (!loc.population) continue
        // State-level aggregate (skip STATEWIDE rollups to avoid double-counting)
        if (loc.fips && !loc.fips.endsWith('000')) {
          if (!statePops[loc.state]) statePops[loc.state] = 0
          statePops[loc.state] += loc.population
        }
        // Per-county lookup (exclude rollups — they're not real counties)
        if (loc.fips && loc.fips.length === 5 && !loc.fips.endsWith('000')) {
          countyPops[loc.fips] = loc.population
        }
      }
      useStore.getState().hydratePopulations(statePops)
      useStore.getState().hydrateCountyPopulations(countyPops)
    })
  }, [])

  const selectedState = useStore((state) => state.selectedState)
  const viewMode = useStore((state) => state.viewMode)
  const clearSelection = useStore((state) => state.clearSelection)
  const trendView = useStore((state) => state.trendView)

  const isCountyView = viewMode === 'state-counties'

  // Track county view entries to force fresh animations on remount
  const [countyViewKey, setCountyViewKey] = useState(0)

  // Navbar animate-in state
  const [navVisible, setNavVisible] = useState(false)

  // Animate navbar in after textures have had time to load
  useEffect(() => {
    const timer = setTimeout(() => {
      setNavVisible(true)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  // Increment key each time we enter county view to force fresh animation
  useEffect(() => {
    if (isCountyView) {
      setCountyViewKey(prev => prev + 1)
    }
  }, [isCountyView])

  // Scroll — direct DOM manipulation, zero re-renders during scroll
  const { scrollTargetRef, headerRef, scrollIndicatorRef, contentWrapperRef, breadcrumbRef, ataglanceRef } = useScrollProgress()

  // Scroll to top when state is selected
  useEffect(() => {
    if (selectedState) {
      if (lenisInstance) {
        lenisInstance.scrollTo(0, { immediate: true })
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
    }
  }, [selectedState])

  return (
    <div className={`app ${selectedState ? 'state-selected' : ''}`}>
      {/* Navbar — always visible, handles its own county-view styling */}
      <Navbar visible={navVisible} />

      {/* Settings slide-out panel */}
      <SettingsPanel />

      {/* Dashboard title — appears below navbar, fades on scroll */}
      {!isCountyView && !selectedState && (
        <header ref={headerRef} className={`header ${navVisible ? 'visible' : ''}`}>
          <h1>Disease Detectives</h1>
        </header>
      )}

      {/* 3D Canvas - fixed, full viewport, fades out in county view */}
      <div className={`canvas-wrapper ${isCountyView ? 'hidden' : ''}`}>
        <Canvas
          camera={{ position: [0, 4, 5.5], fov: 45 }}
          style={{ background: 'transparent' }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            toneMapping: 3,
            toneMappingExposure: 1.1,
            powerPreference: "high-performance",
            pixelRatio: Math.min(window.devicePixelRatio, 2)
          }}
        >
          <Suspense fallback={null}>
            <EarthWithStates scrollTargetRef={scrollTargetRef} />
          </Suspense>
        </Canvas>
      </div>

      {/* Scroll indicator - always rendered when no state, hidden via CSS class */}
      {!selectedState && (
        <div ref={scrollIndicatorRef} className="scroll-indicator">
          <span>Scroll to explore</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </div>
      )}

      {/* US at-a-glance — landing view only */}
      {!selectedState && !isCountyView && (
        <ErrorBoundary label="US at-a-glance" compact>
          <USAtAGlance visible={navVisible} rootRef={ataglanceRef} />
        </ErrorBoundary>
      )}

      {/* Globe hover tooltip — always mounted; self-gates on hoveredState */}
      <StateHoverTooltip />

      {/* Scroll spacer and content - only when no state selected */}
      {!selectedState && (
        <>
          <div className="scroll-spacer" />
          <div ref={contentWrapperRef} className="content-wrapper">
            <ErrorBoundary label="Content sections">
              <ContentSections isVisible={true} />
            </ErrorBoundary>
          </div>
        </>
      )}

      {/* UI Overlays */}
      {isCountyView && (
        <ErrorBoundary label="County map">
          <StateCountyMap key={countyViewKey} />
        </ErrorBoundary>
      )}
      {selectedState && (
        <ErrorBoundary label="State panel">
          <StatePanel />
        </ErrorBoundary>
      )}
      {selectedState && (
        <ErrorBoundary label="Health rings" compact>
          <StateHealthRings />
        </ErrorBoundary>
      )}
      {selectedState && (
        <ErrorBoundary label="Disease timeline">
          <StateTimeline />
        </ErrorBoundary>
      )}

      {/* External breadcrumb — only for the default globe view.
          In state-view, the breadcrumb lives inside the StateHealthRings panel.
          In county-view, the Back to Globe button handles navigation. */}
      {!selectedState && (
        <div ref={breadcrumbRef} className="breadcrumb">
          <span
            className="crumb clickable"
            onClick={() => {
              clearSelection()
              if (lenisInstance) {
                lenisInstance.scrollTo(0)
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            }}
          >
            United States
          </span>
        </div>
      )}

      {/* Watchlist Dashboard Overlay */}
      <ErrorBoundary label="Watchlist">
        <WatchlistDashboard />
      </ErrorBoundary>
      <ErrorBoundary label="Comparison mode">
        <ComparisonMode />
      </ErrorBoundary>
      <ErrorBoundary label="Heatmap legend" compact>
        <HeatmapLegend />
      </ErrorBoundary>
    </div>
  )
}

export default App