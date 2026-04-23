import { useState, useEffect, useRef } from 'react'
import useStore from '../../store/useStore'
import { useWHOPulse } from '../../services/useWHOPulse'
import { getDiseaseIndicator } from '../../services/whoService'
import { TRACKED_DISEASES, getDiseaseById } from '../../data/trackedDiseases'
import './ContentSections.css'

// ============================================
// CHEVRON ICON
// ============================================
function ChevronIcon({ isOpen, size = 16 }) {
  return (
    <svg
      className={`cs-chevron ${isOpen ? 'open' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

// ============================================
// SECTION WRAPPER — handles scroll-triggered animation
// ============================================
function AnimatedSection({ children, className, delay = 0, isVisible }) {
  return (
    <div
      className={`cs-animated ${className || ''} ${isVisible ? 'animate-in' : ''}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// ============================================
// GLOBAL HEALTH PULSE — Year-reactive stats with live WHO data
// ============================================
function GlobalHealthPulse({ year, isVisible }) {
  const { stats: whoStats, loading, source } = useWHOPulse(year)

  const noDataStats = [
    { key: 'lifeExp', value: '\u2014', label: 'US Life Expectancy', trend: 'stable', change: '' },
    { key: 'measles', value: '\u2014', label: 'Measles Immunization (US)', trend: 'stable', change: '' },
    { key: 'tb', value: '\u2014', label: 'TB Incidence (per 100K)', trend: 'stable', change: '' },
    { key: 'healthExp', value: '\u2014', label: 'Health Spending (% GDP)', trend: 'stable', change: '' },
  ]

  const displayStats = whoStats || noDataStats
  const isLive = whoStats && whoStats.some(s => s.source === 'WHO')

  return (
    <section className="cs-section cs-pulse">
      <AnimatedSection className="cs-section-header" isVisible={isVisible}>
        <span className="cs-section-tag">WHO Data</span>
        <h2 className="cs-section-title">
          Global Health Pulse
          <span className="cs-year-pill" title="Year selected from the navbar — change it to pull WHO data for a different year">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            As of {year}
          </span>
        </h2>
      </AnimatedSection>

      {/* Stats Grid — WHO data when available, fallback when not */}
      <div className="cs-stats-grid">
        {displayStats.map((stat, i) => (
          <AnimatedSection
            key={stat.key}
            className={`cs-stat-card ${stat.source === 'WHO' ? 'live-data' : ''}`}
            isVisible={isVisible}
            delay={200 + i * 80}
          >
            <div className="cs-stat-value">{loading ? '...' : stat.value}</div>
            <div className="cs-stat-label">{stat.label}</div>
            {stat.change && (
              <div className={`cs-stat-trend ${stat.trend}`}>
                <span className="cs-trend-arrow">
                  {stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '→'}
                </span>
                {stat.change} vs. prior year
              </div>
            )}
            {stat.source === 'WHO' && (
              <span className="cs-stat-source">WHO GHO</span>
            )}
          </AnimatedSection>
        ))}
      </div>

      {/* Live data indicator */}
      {isLive && (
        <AnimatedSection className="cs-pulse-source" isVisible={isVisible} delay={600}>
          <span className="cs-live-dot" />
          Live data from WHO Global Health Observatory
        </AnimatedSection>
      )}
    </section>
  )
}

// ============================================
// DISEASE SPOTLIGHT — Deep-dive on a single disease
// ============================================
function DiseaseSpotlight({ year, isVisible }) {
  const selectedDisease = useStore(s => s.selectedDisease)
  const setSelectedDisease = useStore(s => s.setSelectedDisease)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const [whoIndicator, setWhoIndicator] = useState(null)

  const current = getDiseaseById(selectedDisease)
  const data = {
    overview: current.spotlight.overview(year),
    keyFinding: current.spotlight.keyFinding,
  }

  useEffect(() => {
    setWhoIndicator(null)
    getDiseaseIndicator(selectedDisease).then(result => {
      if (result) setWhoIndicator(result)
    })
  }, [selectedDisease])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <section className="cs-section cs-spotlight">
      <AnimatedSection className="cs-section-header" isVisible={isVisible} delay={100}>
        <span className="cs-section-tag">Deep Dive</span>
        <h2 className="cs-section-title">
          Disease Spotlight
          <span className="cs-year-pill" title="Year selected from the navbar — reflected in the narrative below">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            As of {year}
          </span>
        </h2>
      </AnimatedSection>

      {/* Disease Selector */}
      <AnimatedSection className="cs-spotlight-selector" isVisible={isVisible} delay={150}>
        <div className="cs-disease-dropdown" ref={dropdownRef}>
          <button
            className={`cs-disease-trigger ${dropdownOpen ? 'active' : ''}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span>{current.name}</span>
            <ChevronIcon isOpen={dropdownOpen} />
          </button>

          {dropdownOpen && (
            <div className="cs-disease-options">
              {TRACKED_DISEASES.map(disease => (
                <button
                  key={disease.id}
                  className={`cs-disease-option ${disease.id === selectedDisease ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedDisease(disease.id)
                    setDropdownOpen(false)
                  }}
                >
                  {disease.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </AnimatedSection>

      {/* Spotlight Content */}
      <AnimatedSection className="cs-spotlight-content" isVisible={isVisible} delay={250}>
        {/* Stats grid — headline burden numbers */}
        {current.spotlight.stats && (
          <div className="cs-dx-stats" style={{ '--dx-accent': current.accent || '#00ffcc' }}>
            {current.spotlight.stats.map((s, i) => (
              <div key={s.label} className="cs-dx-stat-card" style={{ animationDelay: `${300 + i * 80}ms` }}>
                <span className="cs-dx-stat-value">{s.value}</span>
                <span className="cs-dx-stat-label">{s.label}</span>
                <span className="cs-dx-stat-sub">{s.sub}</span>
              </div>
            ))}
          </div>
        )}

        {/* Two-column: Profile + Risk groups */}
        {current.spotlight.profile && (
          <div className="cs-dx-grid">
            <div className="cs-dx-card cs-dx-profile">
              <div className="cs-dx-card-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                Pathogen profile
              </div>
              <dl className="cs-dx-proflist">
                <div className="cs-dx-prof-row">
                  <dt>Pathogen</dt><dd>{current.spotlight.profile.pathogen}</dd>
                </div>
                <div className="cs-dx-prof-row">
                  <dt>Transmission</dt><dd>{current.spotlight.profile.transmission}</dd>
                </div>
                <div className="cs-dx-prof-row">
                  <dt>Incubation</dt><dd>{current.spotlight.profile.incubation}</dd>
                </div>
                <div className="cs-dx-prof-row">
                  <dt>Duration</dt><dd>{current.spotlight.profile.duration}</dd>
                </div>
                <div className="cs-dx-prof-row">
                  <dt>Peak season</dt><dd>{current.spotlight.profile.peakSeason}</dd>
                </div>
              </dl>
            </div>

            <div className="cs-dx-card cs-dx-risk">
              <div className="cs-dx-card-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7v6c0 5.5 4.5 10 10 10s10-4.5 10-10V7l-10-5z" />
                </svg>
                Populations at highest risk
              </div>
              <div className="cs-dx-risk-pills">
                {current.spotlight.riskGroups.map((g) => (
                  <span key={g} className="cs-dx-risk-pill">{g}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Narrative overview + live WHO indicator side-by-side */}
        <div className="cs-dx-narrative-grid">
          <div className="cs-spotlight-overview">
            <div className="cs-spotlight-ai-tag">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
              </svg>
              Summary · Reference
            </div>
            <p>{data.overview}</p>
          </div>

          {whoIndicator && (
            <div className="cs-dx-who-card">
              <div className="cs-dx-who-header">
                <span className="cs-live-dot" />
                WHO · Live
              </div>
              <span className="cs-dx-who-value">{whoIndicator.value}</span>
              <span className="cs-dx-who-label">{whoIndicator.label}</span>
              <span className="cs-stat-source">WHO GHO · {year}</span>
            </div>
          )}
        </div>

        {/* Prevention card */}
        {current.spotlight.prevention && (
          <div className="cs-dx-prevention">
            <div className="cs-dx-card-header">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              Prevention
            </div>
            <div className="cs-dx-prevention-grid">
              {current.spotlight.prevention.map((p) => (
                <div key={p.label} className="cs-dx-prevention-item">
                  <span className="cs-dx-prevention-label">{p.label}</span>
                  <span className="cs-dx-prevention-detail">{p.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key finding callout */}
        <div className="cs-spotlight-finding">
          <span className="cs-finding-label">Key Finding</span>
          <p>{data.keyFinding}</p>
        </div>
      </AnimatedSection>
    </section>
  )
}

// ============================================
// DATA SOURCES — Enhanced with real WHO dataset names
// ============================================
function DataSources({ isVisible }) {
  const sources = [
    { name: 'NNDSS', full: 'National Notifiable Diseases Surveillance System', type: 'Weekly case counts powering the state surveillance chart', status: 'ready' },
    { name: 'WHO GHO', full: 'Global Health Observatory', type: 'National indicators feeding the Global Health Pulse, direct API', status: 'ready' },
    { name: 'Internal DB', full: 'Neon Postgres · Locations + Predictions', type: 'County demographics and model outputs, served via FastAPI', status: 'ready' },
    { name: 'Outbreak LSTM', full: 'DiseasePredictor (Influenza · COVID-19 · Salmonella)', type: 'Per-disease risk scores and classification from the trained model', status: 'ready' },
    { name: 'CDC Socrata', full: 'CDC Surveillance API', type: 'State-level disease reporting — integration reserved', status: 'pending' },
    { name: 'NOAA CDO', full: 'Climate Data Online', type: 'Climate factors for outbreak risk — integration reserved', status: 'pending' },
  ]

  return (
    <section className="cs-section cs-sources">
      <AnimatedSection className="cs-section-header" isVisible={isVisible} delay={100}>
        <span className="cs-section-tag">Integration</span>
        <h2 className="cs-section-title">Data Sources</h2>
      </AnimatedSection>

      <div className="cs-sources-grid">
        {sources.map((source, i) => (
          <AnimatedSection
            key={source.name}
            className="cs-source-card"
            isVisible={isVisible}
            delay={200 + i * 60}
          >
            <div className="cs-source-top">
              <span className="cs-source-name">{source.name}</span>
              <span className={`cs-source-status status-${source.status}`}>
                {source.status === 'ready' ? 'Connected' : 'Pending'}
              </span>
            </div>
            <span className="cs-source-full">{source.full}</span>
            <span className="cs-source-type">{source.type}</span>
          </AnimatedSection>
        ))}
      </div>
    </section>
  )
}

// ============================================
// MAIN EXPORT
// ============================================
export default function ContentSections({ isVisible }) {
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const selectedYear = useStore((state) => state.selectedYear)

  useEffect(() => {
    if (isVisible && !shouldAnimate) {
      setShouldAnimate(true)
    }
  }, [isVisible, shouldAnimate])

  const year = selectedYear

  return (
    <div className="content-sections">
      <GlobalHealthPulse year={year} isVisible={shouldAnimate} />
      <DiseaseSpotlight year={year} isVisible={shouldAnimate} />
      <DataSources isVisible={shouldAnimate} />

      {/* CTA */}
      <section className="cs-section cs-cta">
        <AnimatedSection className="cs-cta-content" isVisible={shouldAnimate} delay={200}>
          <h2>Ready to Explore?</h2>
          <p>Click on any state on the globe above to view detailed outbreak risk data and county-level analysis.</p>
          <button
            className="cs-cta-button"
            onClick={() => window.__lenis ? window.__lenis.scrollTo(0) : window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Back to Globe
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </AnimatedSection>
      </section>

      {/* Footer */}
      <footer className="cs-footer">
        <p>Disease Detectives © {new Date().getFullYear()} — Senior Capstone Project</p>
        <p className="cs-footer-note">Live data from WHO GHO API and backend ML model — disease overviews are curated reference content</p>
      </footer>
    </div>
  )
}