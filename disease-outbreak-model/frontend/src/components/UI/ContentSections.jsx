import { useState, useEffect, useCallback, useRef } from 'react'
import useStore from '../../store/useStore'
import { useWHOPulse } from '../../services/useWHOPulse'
import './ContentSections.css'

// ============================================
// MOCK DATA â€” Shaped exactly like future API responses
// Replace these functions with API calls when backend is ready
// ============================================

// Mock: GET /api/global-pulse?year={year}
function fetchGlobalPulse(year) {
  const baseData = {
    2026: {
      briefing: `Global health surveillance in ${year} shows continued progress in pandemic preparedness frameworks adopted post-COVID. WHO reports a 14% increase in member states meeting International Health Regulations benchmarks. Measles remains a concern with outbreaks in 37 countries, though global vaccination coverage has recovered to 86%. AI-driven early warning systems are now operational in 112 countries.`,
      stats: [
        { key: 'cases', value: '3.2M', label: 'Reportable Cases Tracked', trend: 'down', change: '-8%' },
        { key: 'countries', value: '194', label: 'WHO Member States', trend: 'stable', change: '' },
        { key: 'coverage', value: '86%', label: 'Global Vaccination Coverage', trend: 'up', change: '+3%' },
        { key: 'response', value: '< 72h', label: 'Avg. Outbreak Response Time', trend: 'up', change: '-12h' }
      ]
    },
    2025: {
      briefing: `In ${year}, the WHO documented a significant reduction in cholera-related mortality following the deployment of oral cholera vaccines across sub-Saharan Africa. However, antimicrobial resistance continued to rise, with WHO designating it a top-10 global public health threat. The US saw a 6% increase in respiratory illness hospitalizations during the winter season.`,
      stats: [
        { key: 'cases', value: '3.5M', label: 'Reportable Cases Tracked', trend: 'down', change: '-5%' },
        { key: 'countries', value: '194', label: 'WHO Member States', trend: 'stable', change: '' },
        { key: 'coverage', value: '83%', label: 'Global Vaccination Coverage', trend: 'up', change: '+1%' },
        { key: 'response', value: '< 84h', label: 'Avg. Outbreak Response Time', trend: 'up', change: '-6h' }
      ]
    },
    2024: {
      briefing: `${year} marked a pivotal year as the WHO declared the end of the COVID-19 global health emergency's aftermath monitoring. Mpox remained under surveillance following cross-border outbreaks in Central Africa. Dengue cases hit record highs in the Americas, driven by climate-linked mosquito range expansion. US flu season was classified as moderate severity.`,
      stats: [
        { key: 'cases', value: '3.7M', label: 'Reportable Cases Tracked', trend: 'up', change: '+2%' },
        { key: 'countries', value: '194', label: 'WHO Member States', trend: 'stable', change: '' },
        { key: 'coverage', value: '82%', label: 'Global Vaccination Coverage', trend: 'down', change: '-1%' },
        { key: 'response', value: '< 90h', label: 'Avg. Outbreak Response Time', trend: 'stable', change: '' }
      ]
    }
  }

  // Fallback for years without specific mock data
  if (!baseData[year]) {
    const seed = year * 137
    const pseudoRandom = (s) => ((Math.sin(s) * 10000) % 1 + 1) % 1
    const cases = (2 + pseudoRandom(seed) * 4).toFixed(1)
    const coverage = Math.floor(55 + pseudoRandom(seed + 1) * 35)

    return {
      briefing: `WHO health surveillance data for ${year} reflects the global health landscape of that period. Disease reporting systems ${year > 2000 ? 'were becoming increasingly digitized' : 'relied primarily on manual reporting channels'}, with member states contributing epidemiological data across major disease categories. Select a state on the globe above to explore regional health metrics for this year.`,
      stats: [
        { key: 'cases', value: `${cases}M`, label: 'Reportable Cases Tracked', trend: 'stable', change: '' },
        { key: 'countries', value: `${Math.min(194, Math.floor(60 + (year - 1948) * 1.5))}`, label: 'WHO Member States', trend: 'stable', change: '' },
        { key: 'coverage', value: `${coverage}%`, label: 'Global Vaccination Coverage', trend: 'stable', change: '' },
        { key: 'response', value: year > 2015 ? '< 96h' : 'N/A', label: 'Avg. Outbreak Response Time', trend: 'stable', change: '' }
      ]
    }
  }

  return baseData[year]
}

// Mock: GET /api/watchlist/digest?state={state}&year={year}
function fetchWatchlistDigest(stateName, year) {
  const digests = {
    'North Carolina': `Flu hospitalization rates in ${year} exceeded the 5-year rolling average by 12% in NC. Vaccination coverage in rural western counties remained 8 points below the state median. Wastewater surveillance detected elevated respiratory pathogen signals in the Charlotte metro area during Q1.`,
    'California': `California reported the highest absolute case count nationally for TB in ${year}, consistent with long-term trends tied to population density and demographic factors. COVID wastewater levels remained low statewide. Wildfire smoke events in August correlated with a 23% spike in ER visits for respiratory complaints.`,
    'Texas': `Texas experienced above-average West Nile virus activity in ${year}, with 340+ confirmed cases primarily in the Dallas-Fort Worth corridor. Childhood vaccination exemption rates continued to climb, reaching 3.3% statewide. Border health facilities reported increased demand for vector-borne disease screening.`,
    'New York': `New York's syndromic surveillance network flagged anomalous gastrointestinal illness clusters in ${year} across three NYC boroughs, later attributed to a norovirus strain. Seasonal flu vaccine uptake among adults 65+ reached 72%, above the national average. Lead exposure screening rates improved 5% year-over-year.`,
    'Florida': `Florida recorded elevated dengue case counts in ${year} following hurricane-season flooding that expanded mosquito breeding habitat. Heat-related illness presentations surged 18% compared to the prior year. The state expanded its genomic sequencing capacity for pathogen surveillance by 40%.`
  }

  return digests[stateName] || `Health surveillance data for ${stateName} in ${year} is pending integration. When connected to the WHO and CDC data pipelines, this section will display AI-generated analysis of disease trends, vaccination coverage, and emerging health risks specific to ${stateName}.`
}

// Mock: GET /api/insights?year={year}
function fetchInsights(year) {
  return [
    {
      type: 'trend',
      title: 'Respiratory Illness Surge',
      body: `Influenza-like illness (ILI) rates in ${year} ran 15% above the CDC baseline across 23 states during weeks 48â€“52. Highest excess seen in the Southeast and Midwest regions.`,
      severity: 'warning',
      confidence: 92
    },
    {
      type: 'comparison',
      title: `${year} vs. 5-Year Average`,
      body: `Overall reportable disease incidence in ${year} was 4% below the 2019â€“${year - 1} average, driven primarily by sustained declines in hepatitis A following widespread vaccination campaigns.`,
      severity: 'positive',
      confidence: 88
    },
    {
      type: 'pattern',
      title: 'Southern Regional Cluster',
      body: `Eight contiguous southern states showed statistically correlated increases in antimicrobial-resistant infections in ${year}. The pattern suggests shared supply chain or prescribing practice drivers.`,
      severity: 'alert',
      confidence: 76
    },
    {
      type: 'fact',
      title: 'Did You Know?',
      body: `The WHO's Global Health Observatory has tracked over 1,200 health indicators since 2005. In ${year}, the fastest-growing dataset was antimicrobial resistance surveillance, with 47 new member states contributing data.`,
      severity: 'info',
      confidence: null
    },
    {
      type: 'trend',
      title: 'Vaccination Momentum',
      body: `Childhood vaccination coverage for DTP3 in ${year} reached its highest level since pre-pandemic baselines, with 12 previously under-performing states exceeding 90% coverage for the first time.`,
      severity: 'positive',
      confidence: 95
    },
    {
      type: 'pattern',
      title: 'Urban Heat-Health Nexus',
      body: `Emergency department visits for heat-related illness in ${year} showed a 0.94 correlation with days exceeding 100Â°F across 15 major metros. Phoenix, Houston, and Miami led in absolute case counts.`,
      severity: 'warning',
      confidence: 84
    }
  ]
}

// Mock: GET /api/disease-spotlight?disease={disease}&year={year}
function fetchDiseaseSpotlight(disease, year) {
  const spotlights = {
    'Influenza': {
      overview: `Seasonal influenza in ${year} was classified as moderate severity by the CDC, with H3N2 as the dominant circulating strain. Approximately 29 million symptomatic illnesses were estimated nationally, resulting in 380,000 hospitalizations.`,
      globalCases: '1B+',
      usCases: '29M',
      mortality: '380K hosp.',
      vaccineEfficacy: '45%',
      trendDirection: 'stable',
      keyFinding: 'H3N2 dominance correlated with reduced vaccine effectiveness in adults 18-49'
    },
    'COVID-19': {
      overview: `COVID-19 surveillance in ${year} transitioned to endemic monitoring. Hospitalizations remained well below pandemic peaks, though winter waves continued to strain capacity in under-resourced facilities. Updated boosters targeting JN.1-lineage variants were deployed.`,
      globalCases: '2.1M',
      usCases: '620K',
      mortality: '45K hosp.',
      vaccineEfficacy: '54%',
      trendDirection: 'down',
      keyFinding: 'Hybrid immunity (infection + vaccination) provided the strongest protection across all age groups'
    },
    'Tuberculosis': {
      overview: `Tuberculosis remained the world's deadliest infectious disease in ${year}. The US reported approximately 9,600 new cases, a 4% increase attributed to improved diagnostic screening and migration patterns. Drug-resistant TB accounted for 1.2% of US cases.`,
      globalCases: '10.6M',
      usCases: '9.6K',
      mortality: '1.3M global',
      vaccineEfficacy: 'BCG limited',
      trendDirection: 'up',
      keyFinding: 'New mRNA-based TB vaccine candidates entered Phase III trials'
    },
    'Measles': {
      overview: `Global measles cases surged in ${year}, with the WHO reporting outbreaks in 37 countries. The US recorded 280+ cases, primarily in communities with low vaccination coverage. Two-dose MMR coverage among kindergartners dropped below 93% nationally.`,
      globalCases: '9.2M',
      usCases: '284',
      mortality: '136K global',
      vaccineEfficacy: '97%',
      trendDirection: 'up',
      keyFinding: 'Outbreaks concentrated in counties where MMR exemption rates exceeded 5%'
    },
    'Malaria': {
      overview: `Malaria caused an estimated 597,000 deaths globally in ${year}, predominantly among children under 5 in sub-Saharan Africa. The US recorded 2,100+ imported cases. The RTS,S vaccine rollout expanded to 9 additional countries.`,
      globalCases: '249M',
      usCases: '2.1K',
      mortality: '597K global',
      vaccineEfficacy: '36% (RTS,S)',
      trendDirection: 'stable',
      keyFinding: 'New R21/Matrix-M vaccine showed 75% efficacy in Phase III trials'
    },
    'Dengue': {
      overview: `${year} set records for dengue cases in the Americas, driven by El NiÃ±o-amplified mosquito range expansion. The US saw locally-acquired cases in Florida, Texas, and Hawaii. The Dengvaxia vaccine remained controversial due to serostatus requirements.`,
      globalCases: '5.2M',
      usCases: '4.8K',
      mortality: '4.1K global',
      vaccineEfficacy: '60-80%',
      trendDirection: 'up',
      keyFinding: 'Climate models project a 25% expansion of Aedes aegypti habitat by 2030'
    }
  }

  return spotlights[disease] || spotlights['Influenza']
}

const TRACKED_DISEASES = ['Influenza', 'COVID-19', 'Tuberculosis', 'Measles', 'Malaria', 'Dengue']

const INSIGHT_ICONS = {
  trend: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  comparison: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  pattern: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
    </svg>
  ),
  fact: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

const TREND_ARROWS = {
  up: 'â†‘',
  down: 'â†“',
  stable: 'â†’'
}

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
// SECTION WRAPPER â€” handles scroll-triggered animation
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
  const mockData = fetchGlobalPulse(year)

  // Use real WHO stats if available, otherwise fall back to mock
  const displayStats = whoStats || mockData.stats
  const isLive = !!whoStats

  return (
    <section className="cs-section cs-pulse">
      <AnimatedSection className="cs-section-header" isVisible={isVisible}>
        <span className="cs-section-tag">WHO Data · {year}</span>
        <h2 className="cs-section-title">Global Health Pulse</h2>
      </AnimatedSection>

      {/* Briefing Card — stays as demo text (no API source for narratives) */}
      <AnimatedSection className="cs-briefing" isVisible={isVisible} delay={100}>
        <div className="cs-briefing-header">
          <div className="cs-briefing-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
              <path d="M10 22h4" />
            </svg>
          </div>
          <span className="cs-briefing-label">Intelligence Briefing</span>
          <span className="cs-briefing-badge">Demo</span>
        </div>
        <p className="cs-briefing-text">{mockData.briefing}</p>
      </AnimatedSection>

      {/* Stats Grid — WHO data when available, mock when not */}
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
// WATCHLIST â€” Monitored states with AI digests
// ============================================
function Watchlist({ year, isVisible }) {
  const requestStateZoom = useStore((state) => state.requestStateZoom)
  const [watchedStates, setWatchedStates] = useState([
    'North Carolina', 'California', 'Texas'
  ])
  const [expandedState, setExpandedState] = useState(null)
  const [addingState, setAddingState] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef(null)

  const allStates = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
    'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
    'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
    'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
    'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
    'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
  ]

  const availableStates = allStates.filter(s =>
    !watchedStates.includes(s) &&
    s.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const removeState = useCallback((stateName) => {
    setWatchedStates(prev => prev.filter(s => s !== stateName))
    if (expandedState === stateName) setExpandedState(null)
  }, [expandedState])

  const addState = useCallback((stateName) => {
    setWatchedStates(prev => [...prev, stateName])
    setAddingState(false)
    setSearchQuery('')
  }, [])

  useEffect(() => {
    if (addingState && inputRef.current) {
      inputRef.current.focus()
    }
  }, [addingState])

  return (
    <section className="cs-section cs-watchlist">
      <AnimatedSection className="cs-section-header" isVisible={isVisible} delay={100}>
        <span className="cs-section-tag">Monitoring</span>
        <h2 className="cs-section-title">Your Watchlist</h2>
        <p className="cs-section-subtitle">Pin states for real-time health intelligence updates</p>
      </AnimatedSection>

      <AnimatedSection className="cs-watchlist-content" isVisible={isVisible} delay={200}>
        {/* State Chips */}
        <div className="cs-watch-chips">
          {watchedStates.map((stateName) => (
            <div
              key={stateName}
              className={`cs-watch-chip ${expandedState === stateName ? 'active' : ''}`}
            >
              <button
                className="cs-chip-main"
                onClick={() => setExpandedState(expandedState === stateName ? null : stateName)}
              >
                <span className="cs-chip-dot" />
                <span className="cs-chip-name">{stateName}</span>
                <ChevronIcon isOpen={expandedState === stateName} size={14} />
              </button>
              <button
                className="cs-chip-view"
                onClick={() => {
                  requestStateZoom(stateName)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                title={`View ${stateName} on globe`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </button>
              <button
                className="cs-chip-remove"
                onClick={() => removeState(stateName)}
                title="Remove from watchlist"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Add State */}
          {!addingState ? (
            <button className="cs-watch-add" onClick={() => setAddingState(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add State
            </button>
          ) : (
            <div className="cs-watch-add-input">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type state name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setAddingState(false)
                    setSearchQuery('')
                  }
                  if (e.key === 'Enter' && availableStates.length > 0) {
                    addState(availableStates[0])
                  }
                }}
              />
              {searchQuery && availableStates.length > 0 && (
                <div className="cs-watch-add-dropdown">
                  {availableStates.slice(0, 5).map(s => (
                    <button key={s} onClick={() => addState(s)}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expanded Digest */}
        {expandedState && (
          <div className="cs-watch-digest">
            <div className="cs-digest-header">
              <h3>{expandedState}</h3>
              <span className="cs-digest-year">{year} Analysis</span>
            </div>
            <div className="cs-digest-body">
              <div className="cs-digest-ai-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                </svg>
                Generated Summary · Demo
              </div>
              <p>{fetchWatchlistDigest(expandedState, year)}</p>
            </div>
            <button
              className="cs-digest-explore"
              onClick={() => {
                requestStateZoom(expandedState)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              Explore on Globe
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </AnimatedSection>
    </section>
  )
}

// ============================================
// AI INSIGHTS FEED â€” Year-reactive intelligence cards
// ============================================
function InsightsFeed({ year, isVisible }) {
  const insights = fetchInsights(year)
  const [visibleCount, setVisibleCount] = useState(4)

  return (
    <section className="cs-section cs-insights">
      <AnimatedSection className="cs-section-header" isVisible={isVisible} delay={100}>
        <span className="cs-section-tag">Analysis Â· {year}</span>
        <h2 className="cs-section-title">Intelligence Feed</h2>
        <p className="cs-section-subtitle">Patterns, trends, and anomalies identified from health surveillance data</p>
      </AnimatedSection>

      <div className="cs-insights-grid">
        {insights.slice(0, visibleCount).map((insight, i) => (
          <AnimatedSection
            key={`${insight.type}-${i}`}
            className={`cs-insight-card severity-${insight.severity}`}
            isVisible={isVisible}
            delay={200 + i * 100}
          >
            <div className="cs-insight-header">
              <div className={`cs-insight-type type-${insight.type}`}>
                {INSIGHT_ICONS[insight.type]}
                <span>{insight.type === 'fact' ? 'Did You Know?' : insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}</span>
              </div>
              {insight.confidence && (
                <div className="cs-insight-confidence">
                  <div className="cs-confidence-bar">
                    <div className="cs-confidence-fill" style={{ width: `${insight.confidence}%` }} />
                  </div>
                  <span>{insight.confidence}%</span>
                </div>
              )}
            </div>
            <h3 className="cs-insight-title">{insight.title}</h3>
            <p className="cs-insight-body">{insight.body}</p>
          </AnimatedSection>
        ))}
      </div>

      {visibleCount < insights.length && (
        <AnimatedSection className="cs-insights-more" isVisible={isVisible} delay={600}>
          <button onClick={() => setVisibleCount(insights.length)}>
            Show {insights.length - visibleCount} More Insights
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </AnimatedSection>
      )}
    </section>
  )
}

// ============================================
// DISEASE SPOTLIGHT â€” Deep-dive on a single disease
// ============================================
function DiseaseSpotlight({ year, isVisible }) {
  const [selectedDisease, setSelectedDisease] = useState('Influenza')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  const data = fetchDiseaseSpotlight(selectedDisease, year)

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
        <span className="cs-section-tag">Deep Dive Â· {year}</span>
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
            Summary · Demo
          </div>
          <p>{data.overview}</p>
        </div>

        <div className="cs-spotlight-metrics">
          <div className="cs-spotlight-metric">
            <span className="cs-metric-label">Global Cases</span>
            <span className="cs-metric-value">{data.globalCases}</span>
          </div>
          <div className="cs-spotlight-metric">
            <span className="cs-metric-label">US Cases</span>
            <span className="cs-metric-value">{data.usCases}</span>
          </div>
          <div className="cs-spotlight-metric">
            <span className="cs-metric-label">Mortality Impact</span>
            <span className="cs-metric-value">{data.mortality}</span>
          </div>
          <div className="cs-spotlight-metric">
            <span className="cs-metric-label">Vaccine Efficacy</span>
            <span className="cs-metric-value">{data.vaccineEfficacy}</span>
          </div>
        </div>

        <div className="cs-spotlight-finding">
          <span className="cs-finding-label">Key Finding</span>
          <p>{data.keyFinding}</p>
        </div>
      </AnimatedSection>
    </section>
  )
}

// ============================================
// DATA SOURCES â€” Enhanced with real WHO dataset names
// ============================================
function DataSources({ isVisible }) {
  const sources = [
    { name: 'WHO GHO', full: 'Global Health Observatory', type: 'National health indicators via direct API', status: 'ready' },
    { name: 'CDC Socrata', full: 'Disease Surveillance API', type: 'State-level disease reporting (via backend)', status: 'pending' },
    { name: 'Census Bureau', full: 'American Community Survey', type: 'County population & demographics (via backend)', status: 'pending' },
    { name: 'NOAA CDO', full: 'Climate Data Online', type: 'Climate observations by county (via backend)', status: 'pending' },
    { name: 'ML Model', full: 'FluPredictor Neural Network', type: 'County-level outbreak risk predictions', status: 'pending' },
    { name: 'NNDSS', full: 'National Notifiable Diseases', type: 'Reportable disease counts', status: 'pending' }
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
      <Watchlist year={year} isVisible={shouldAnimate} />
      <InsightsFeed year={year} isVisible={shouldAnimate} />
      <DiseaseSpotlight year={year} isVisible={shouldAnimate} />
      <DataSources isVisible={shouldAnimate} />

      {/* CTA */}
      <section className="cs-section cs-cta">
        <AnimatedSection className="cs-cta-content" isVisible={shouldAnimate} delay={200}>
          <h2>Ready to Explore?</h2>
          <p>Click on any state on the globe above to view detailed outbreak risk data and county-level analysis.</p>
          <button
            className="cs-cta-button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
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
        <p>Disease Detectives Â© {new Date().getFullYear()} â€” Senior Capstone Project</p>
        <p className="cs-footer-note">Mock data shown for demonstration â€” ready for backend integration</p>
      </footer>
    </div>
  )
}