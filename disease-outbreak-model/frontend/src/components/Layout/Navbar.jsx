import { useState, useRef, useEffect, useCallback } from 'react'
import useStore from '../../store/useStore'
import { TRACKED_DISEASES, filterAvailableDiseases } from '../../data/trackedDiseases'
import { checkBackendHealth } from '../../services/api'
import './Navbar.css'

// ============================================
// ALL 50 US STATES for search autocomplete
// ============================================
const US_STATES = [
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

// Available WHO data years — WHO founded 1948, range to current year
const CURRENT_YEAR = new Date().getFullYear()
const WHO_START_YEAR = 1948
const DATA_YEARS = Array.from(
  { length: CURRENT_YEAR - WHO_START_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i // Descending: newest first
)

// ============================================
// CHEVRON ICON — rotates on open/close
// ============================================
function ChevronIcon({ isOpen, size = 14 }) {
  return (
    <svg
      className={`chevron-icon ${isOpen ? 'open' : ''}`}
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
// SEARCH ICON
// ============================================
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

// ============================================
// SETTINGS ICON
// ============================================
function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

// ============================================
// YEAR SELECTOR — custom dropdown with animated chevron
// ============================================
function YearSelector({ selectedYear, onYearChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const listRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Scroll selected year into view when dropdown opens
  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedEl = listRef.current.querySelector('.year-option.selected')
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'center' })
      }
    }
  }, [isOpen])

  return (
    <div className="year-selector" ref={dropdownRef}>
      <span className="year-selector-label">WHO DATA</span>
      <button
        className={`year-selector-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="year-value">{selectedYear}</span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      {isOpen && (
        <div className="year-dropdown" data-lenis-prevent ref={listRef}>
          {DATA_YEARS.map((year) => (
            <button
              key={year}
              className={`year-option ${year === selectedYear ? 'selected' : ''}`}
              onClick={() => {
                onYearChange(year)
                setIsOpen(false)
              }}
            >
              {year}
              {year === selectedYear && (
                <span className="year-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// DISEASE SELECTOR — mirrors YearSelector, driven by Zustand
// ============================================
function DiseaseSelector({ selected, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const availableKeys = useStore(s => s.availableDiseaseKeys)
  const diseases = filterAvailableDiseases(availableKeys)
  const current = diseases.find(d => d.id === selected) || diseases[0]

  return (
    <div className="year-selector disease-selector" ref={dropdownRef}>
      <span className="year-selector-label">DISEASE</span>
      <button
        className={`year-selector-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="year-value">{current.name}</span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      {isOpen && (
        <div className="year-dropdown" data-lenis-prevent>
          {diseases.map((d) => (
            <button
              key={d.id}
              className={`year-option ${d.id === selected ? 'selected' : ''}`}
              onClick={() => {
                onChange(d.id)
                setIsOpen(false)
              }}
            >
              {d.name}
              {d.id === selected && (
                <span className="year-check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// STATE SEARCH — autocomplete with keyboard nav
// ============================================
function StateSearch({ onStateSelect }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  const filtered = query.length > 0
    ? US_STATES.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : []

  const showDropdown = isOpen && filtered.length > 0

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback((stateName) => {
    onStateSelect(stateName)
    setQuery('')
    setIsOpen(false)
    setActiveIndex(-1)
    inputRef.current?.blur()
  }, [onStateSelect])

  const handleKeyDown = (e) => {
    if (!showDropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(filtered[activeIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  // Highlight matching text
  const highlightMatch = (text, query) => {
    if (!query) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <span className="search-highlight">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    )
  }

  return (
    <div className="state-search" ref={dropdownRef}>
      <div className={`search-input-wrapper ${isOpen && query ? 'focused' : ''}`}>
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search states..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => { if (query) setIsOpen(true) }}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            className="search-clear"
            onClick={() => {
              setQuery('')
              setIsOpen(false)
              inputRef.current?.focus()
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="search-dropdown" data-lenis-prevent>
          {filtered.slice(0, 8).map((state, i) => (
            <button
              key={state}
              className={`search-option ${i === activeIndex ? 'active' : ''}`}
              onClick={() => handleSelect(state)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="search-option-name">
                {highlightMatch(state, query)}
              </span>
              <span className="search-option-hint">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            </button>
          ))}
          {filtered.length > 8 && (
            <div className="search-more">
              +{filtered.length - 8} more results
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// BACKEND STATUS INDICATOR — polls /health so live-demo viewers know the API is up
// ============================================
function BackendStatus() {
  // status: 'checking' | 'online' | 'degraded' | 'offline'
  const [status, setStatus] = useState('checking')
  const [detail, setDetail] = useState('Pinging API…')

  useEffect(() => {
    let cancelled = false

    const ping = async () => {
      const h = await checkBackendHealth()
      if (cancelled) return
      if (!h.connected) {
        setStatus('offline')
        setDetail('Backend offline — UI running on last known data')
        return
      }
      if (h.dbConnected === false || h.modelLoaded === false) {
        setStatus('degraded')
        setDetail(`API up · ${h.dbConnected ? 'DB ok' : 'DB issue'} · ${h.modelLoaded ? 'model ok' : 'model issue'}`)
        return
      }
      setStatus('online')
      setDetail(`API ${h.version || 'online'} · DB ok · model ok`)
    }

    ping()
    const id = setInterval(ping, 20000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const labels = {
    checking: 'Checking',
    online: 'Online',
    degraded: 'Degraded',
    offline: 'Offline',
  }

  return (
    <div className={`backend-status status-${status}`} title={detail}>
      <span className="backend-status-dot" />
      <span className="backend-status-label">{labels[status]}</span>
    </div>
  )
}

// ============================================
// MAIN NAVBAR COMPONENT
// ============================================
export default function Navbar({ visible = false }) {
  const requestStateZoom = useStore((state) => state.requestStateZoom)
  const clearSelection = useStore((state) => state.clearSelection)
  const exitCountyView = useStore((state) => state.exitCountyView)
  const viewMode = useStore((state) => state.viewMode)
  const selectedState = useStore((state) => state.selectedState)
  const selectedYear = useStore((state) => state.selectedYear)
  const setSelectedYear = useStore((state) => state.setSelectedYear)
  const selectedDisease = useStore((state) => state.selectedDisease)
  const setSelectedDisease = useStore((state) => state.setSelectedDisease)
  const toggleSettings = useStore((state) => state.toggleSettings)
  const toggleWatchlist = useStore((state) => state.toggleWatchlist)
  const watchlistCount = useStore((state) => state.watchlist.length)
  const openComparison = useStore((state) => state.openComparison)
  const heatmapEnabled = useStore((state) => state.heatmapEnabled)
  const toggleHeatmap = useStore((state) => state.toggleHeatmap)

  const isCountyView = viewMode === 'state-counties'
  // Year only affects the intro sections (Global Health Pulse + Disease Spotlight).
  // Hide the selector once a state or county is open so it doesn't look inert.
  const showYearSelector = !selectedState && !isCountyView

  const handleStateSearch = useCallback((stateName) => {
    // If the presenter is mid-county-view and searches a different state,
    // bail out of county view first so viewMode + selectedCounty don't
    // carry forward while the globe re-focuses on the new state.
    if (isCountyView) exitCountyView()
    requestStateZoom(stateName)
  }, [isCountyView, exitCountyView, requestStateZoom])

  const handleLogoClick = useCallback(() => {
    if (isCountyView) exitCountyView()
    clearSelection()
    const lenis = window.__lenis
    if (lenis) {
      lenis.scrollTo(0)
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [isCountyView, exitCountyView, clearSelection])

  return (
    <nav className={`navbar ${visible ? 'visible' : ''} ${isCountyView ? 'county-view' : ''}`}>
      <div className="navbar-inner">

        {/* ====== LEFT: Branding ====== */}
        <div className="navbar-section navbar-brand">
          <button className="brand-mark" onClick={handleLogoClick} title="Back to globe">
            <span className="brand-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" stroke="url(#brandGrad)" />
                <path d="M2 12h20" stroke="url(#brandGrad)" opacity="0.4" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="url(#brandGrad)" />
                <defs>
                  <linearGradient id="brandGrad" x1="0" y1="0" x2="24" y2="24">
                    <stop offset="0%" stopColor="#00ffcc" />
                    <stop offset="100%" stopColor="#0ea5e9" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <span className="brand-text">DD</span>
          </button>
          <div className="brand-divider" />
        </div>

        {/* ====== CENTER: Year + Disease Toggles + Search ====== */}
        <div className="navbar-section navbar-center">
          {showYearSelector && (
            <>
              <YearSelector
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
              />
              <div className="center-divider" />
            </>
          )}

          <DiseaseSelector
            selected={selectedDisease}
            onChange={setSelectedDisease}
          />

          <div className="center-divider" />

          <StateSearch onStateSelect={handleStateSearch} />
        </div>

        {/* ====== RIGHT: Tools ====== */}
        <div className="navbar-section navbar-right">
          <BackendStatus />
          <button className="nav-icon-btn" title="Watchlist" onClick={toggleWatchlist}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {watchlistCount > 0 && <span className="watchlist-count">{watchlistCount}</span>}
          </button>
          <button className="nav-icon-btn" title="Compare States" onClick={openComparison}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 20V10M12 20V4M6 20v-6" />
            </svg>
          </button>
          <button className={`nav-icon-btn ${heatmapEnabled ? 'active' : ''}`} title="Heatmap Mode" onClick={toggleHeatmap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button className="nav-icon-btn" title="Settings" onClick={toggleSettings}>
            <SettingsIcon />
          </button>
        </div>
      </div>
    </nav>
  )
}