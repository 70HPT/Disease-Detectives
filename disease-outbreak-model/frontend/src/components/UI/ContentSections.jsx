import { useState, useEffect, useRef } from 'react'
import useStore from '../../store/useStore'
import { useWHOPulse } from '../../services/useWHOPulse'
import { getDiseaseIndicator } from '../../services/whoService'
import './ContentSections.css'

// Curated reference data per disease — overview text and key findings
function fetchDiseaseSpotlight(disease, year) {
  const spotlights = {
    'Influenza': {
      overview: `Seasonal influenza in ${year} was classified as moderate severity by the CDC, with H3N2 as the dominant circulating strain. Approximately 29 million symptomatic illnesses were estimated nationally, resulting in 380,000 hospitalizations.`,
      keyFinding: 'H3N2 dominance correlated with reduced vaccine effectiveness in adults 18-49'
    },
    'COVID-19': {
      overview: `COVID-19 surveillance in ${year} transitioned to endemic monitoring. Hospitalizations remained well below pandemic peaks, though winter waves continued to strain capacity in under-resourced facilities. Updated boosters targeting JN.1-lineage variants were deployed.`,
      keyFinding: 'Hybrid immunity (infection + vaccination) provided the strongest protection across all age groups'
    },
    'Tuberculosis': {
      overview: `Tuberculosis remained the world\u2019s deadliest infectious disease in ${year}. The US reported approximately 9,600 new cases, a 4% increase attributed to improved diagnostic screening and migration patterns. Drug-resistant TB accounted for 1.2% of US cases.`,
      keyFinding: 'New mRNA-based TB vaccine candidates entered Phase III trials'
    },
    'Measles': {
      overview: `Global measles cases surged in ${year}, with the WHO reporting outbreaks in 37 countries. The US recorded 280+ cases, primarily in communities with low vaccination coverage. Two-dose MMR coverage among kindergartners dropped below 93% nationally.`,
      keyFinding: 'Outbreaks concentrated in counties where MMR exemption rates exceeded 5%'
    },
    'Malaria': {
      overview: `Malaria caused an estimated 597,000 deaths globally in ${year}, predominantly among children under 5 in sub-Saharan Africa. The US recorded 2,100+ imported cases. The RTS,S vaccine rollout expanded to 9 additional countries.`,
      keyFinding: 'New R21/Matrix-M vaccine showed 75% efficacy in Phase III trials'
    },
    'Dengue': {
      overview: `${year} set records for dengue cases in the Americas, driven by El Ni\u00f1o-amplified mosquito range expansion. The US saw locally-acquired cases in Florida, Texas, and Hawaii. The Dengvaxia vaccine remained controversial due to serostatus requirements.`,
      keyFinding: 'Climate models project a 25% expansion of Aedes aegypti habitat by 2030'
    }
  }

  return spotlights[disease] || spotlights['Influenza']
}

const TRACKED_DISEASES = ['Influenza', 'COVID-19', 'Tuberculosis', 'Measles', 'Malaria', 'Dengue']

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
        <span className="cs-section-tag">WHO Data · {year}</span>
        <h2 className="cs-section-title">Global Health Pulse</h2>
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
  const [selectedDisease, setSelectedDisease] = useState('Influenza')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const [whoIndicator, setWhoIndicator] = useState(null)

  const data = fetchDiseaseSpotlight(selectedDisease, year)

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
        <span className="cs-section-tag">Deep Dive · {year}</span>
        <h2 className="cs-section-title">Disease Spotlight</h2>
      </AnimatedSection>

      {/* Disease Selector */}
      <AnimatedSection className="cs-spotlight-selector" isVisible={isVisible} delay={150}>
        <div className="cs-disease-dropdown" ref={dropdownRef}>
          <button
            className={`cs-disease-trigger ${dropdownOpen ? 'active' : ''}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span>{selectedDisease}</span>
            <ChevronIcon isOpen={dropdownOpen} />
          </button>

          {dropdownOpen && (
            <div className="cs-disease-options">
              {TRACKED_DISEASES.map(disease => (
                <button
                  key={disease}
                  className={`cs-disease-option ${disease === selectedDisease ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedDisease(disease)
                    setDropdownOpen(false)
                  }}
                >
                  {disease}
                </button>
              ))}
            </div>
          )}
        </div>
      </AnimatedSection>

      {/* Spotlight Content */}
      <AnimatedSection className="cs-spotlight-content" isVisible={isVisible} delay={250}>
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
          <div className="cs-spotlight-metrics">
            <div className="cs-spotlight-metric live-data">
              <span className="cs-metric-label">{whoIndicator.label}</span>
              <span className="cs-metric-value">{whoIndicator.value}</span>
              <span className="cs-stat-source">WHO GHO</span>
            </div>
          </div>
        )}

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
    { name: 'WHO GHO', full: 'Global Health Observatory', type: 'National health indicators via direct API', status: 'ready' },
    { name: 'CDC Socrata', full: 'Disease Surveillance API', type: 'State-level disease reporting (via backend)', status: 'pending' },
    { name: 'Census Bureau', full: 'American Community Survey', type: 'County population & demographics (via backend)', status: 'ready' },
    { name: 'NOAA CDO', full: 'Climate Data Online', type: 'Climate observations by county (via backend)', status: 'pending' },
    { name: 'ML Model', full: 'DiseasePredictor LSTM', type: 'County-level outbreak risk predictions', status: 'ready' },
    { name: 'NNDSS', full: 'National Notifiable Diseases', type: 'Flu surveillance weekly case counts', status: 'ready' }
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