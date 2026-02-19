import { Canvas } from '@react-three/fiber'
import { Suspense, useRef, useEffect, useState } from 'react'
import useStore from './store/useStore'
import StatePanel from './components/UI/StatePanel'
import StateHealthRings from './components/UI/StateHealthRings'
import StateTimeline from './components/UI/StateTimeline'
import WatchlistDashboard from './components/UI/WatchlistDashboard'
import ProfilePage from './components/UI/ProfilePage'
import ComparisonMode from './components/UI/ComparisonMode'
import HeatmapLegend from './components/UI/HeatmapLegend'
import CorridorPanel from './components/UI/CorridorPanel'
import EarthWithStates from './components/Earth3D/EarthWithStates'
import StateCountyMap from './components/Map/StateCountyMap'
import ContentSections from './components/UI/ContentSections'
import Navbar from './components/Layout/Navbar'
import SettingsPanel from './components/UI/SettingsPanel'

import './App.css'

// ============================================
// SCROLL PROGRESS HOOK - Enhanced with smooth lerping
// Provides both raw (for thresholds) and smooth (for animations) values
// ============================================
// SCROLL PROGRESS — Performance-optimized
// scrollTargetRef: Raw ref for 3D scene — NO React re-renders, read in useFrame
// headerFaded / showScrollIndicator: Only update on threshold crossing (not every tick)
// ============================================
function useScrollProgress() {
  const [headerFaded, setHeaderFaded] = useState(false)
  const [showScrollIndicator, setShowScrollIndicator] = useState(true)
  const [contentVisible, setContentVisible] = useState(false)
  const [contentAnimated, setContentAnimated] = useState(false)
  const [breadcrumbHidden, setBreadcrumbHidden] = useState(false)
  const scrollTargetRef = useRef(0)

  useEffect(() => {
    let ticking = false
    // Track previous states to avoid redundant setState calls
    let prev = { faded: false, indicator: false, content: false, animated: false, breadcrumb: false }

    const handleScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(() => {
          const scrollY = window.scrollY
          const windowHeight = window.innerHeight
          const progress = Math.min(1, Math.max(0, scrollY / windowHeight))
          scrollTargetRef.current = progress

          // Only trigger React re-render when crossing thresholds
          const faded = progress > 0.3
          const indicator = progress >= 0.1
          const content = progress > 0.2
          const animated = progress > 0.3
          const breadcrumb = progress > 0.5

          if (faded !== prev.faded) { prev.faded = faded; setHeaderFaded(faded) }
          if (indicator !== prev.indicator) { prev.indicator = indicator; setShowScrollIndicator(!indicator) }
          if (content !== prev.content) { prev.content = content; setContentVisible(content) }
          if (animated !== prev.animated) { prev.animated = animated; setContentAnimated(animated) }
          if (breadcrumb !== prev.breadcrumb) { prev.breadcrumb = breadcrumb; setBreadcrumbHidden(breadcrumb) }

          ticking = false
        })
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return { headerFaded, showScrollIndicator, contentVisible, contentAnimated, breadcrumbHidden, scrollTargetRef }
}

function App() {
  const selectedState = useStore((state) => state.selectedState)
  const viewMode = useStore((state) => state.viewMode)
  const clearSelection = useStore((state) => state.clearSelection)
  const exitCountyView = useStore((state) => state.exitCountyView)

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

  // Scroll state — threshold-based, only re-renders on crossing specific points
  const { headerFaded, showScrollIndicator, contentVisible, contentAnimated, breadcrumbHidden, scrollTargetRef } = useScrollProgress()

  // Scroll to top when state is selected
  useEffect(() => {
    if (selectedState) {
      window.scrollTo({ top: 0, behavior: 'instant' })
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
        <header className={`header ${navVisible ? 'visible' : ''} ${headerFaded ? 'faded' : ''}`}>
          <h1>Disease Detectives</h1>
          <p className="subtitle">Public Health Intelligence Dashboard</p>
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

      {/* Scroll indicator - only when no state selected */}
      {!selectedState && showScrollIndicator && (
        <div className="scroll-indicator">
          <span>Scroll to explore</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </div>
      )}

      {/* Scroll spacer and content - only when no state selected */}
      {!selectedState && (
        <>
          <div className="scroll-spacer" />
          <div className={`content-wrapper ${contentVisible ? 'visible' : ''}`}>
            <ContentSections isVisible={contentAnimated} />
          </div>
        </>
      )}

      {/* UI Overlays */}
      {isCountyView && <StateCountyMap key={countyViewKey} />}
      {selectedState && <StatePanel />}
      {selectedState && <StateHealthRings />}
      {selectedState && <StateTimeline />}

      {/* Breadcrumb */}
      <div className={`breadcrumb ${breadcrumbHidden && !selectedState ? 'hidden' : ''} ${selectedState && !isCountyView ? 'raised' : ''}`}>
        <span
          className="crumb clickable"
          onClick={() => {
            if (isCountyView) {
              exitCountyView()
            } else {
              clearSelection()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          }}
        >
          United States
        </span>
        {selectedState && (
          <>
            <span className="separator">/</span>
            <span
              className={`crumb ${isCountyView ? 'clickable' : 'active'}`}
              onClick={() => { if (isCountyView) exitCountyView() }}
            >
              {selectedState.name}
            </span>
          </>
        )}
        {isCountyView && (
          <>
            <span className="separator">/</span>
            <span className="crumb active">Counties</span>
          </>
        )}
      </div>

      {/* Watchlist Dashboard Overlay */}
      <WatchlistDashboard />
      <ProfilePage />
      <ComparisonMode />
      <HeatmapLegend />
      <CorridorPanel />
    </div>
  )
}

export default App