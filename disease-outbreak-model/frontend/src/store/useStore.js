import { create } from 'zustand'
import { TRACKED_DISEASES } from '../data/trackedDiseases'

// ============================================
// SETTINGS — localStorage persistence
// ============================================
const SETTINGS_STORAGE_KEY = 'dd-settings'

const DEFAULT_SETTINGS = {
  earthTexture: 'daymap6',        // daymap1 | daymap3 | daymap6
  skyboxTexture: 'default',       // default | mw1 | mw2 | mw3 | mw4
  oceanPreset: 'default',         // default | deep-navy | tropical | arctic | midnight
  cloudsEnabled: true,
  autoRotate: true,
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch (e) { /* ignore corrupt data */ }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)) }
  catch (e) { /* quota exceeded — ignore */ }
}

// State FIPS codes for county data filtering
const stateFips = {
  'Alabama': '01', 'Alaska': '02', 'Arizona': '04', 'Arkansas': '05',
  'California': '06', 'Colorado': '08', 'Connecticut': '09', 'Delaware': '10',
  'District of Columbia': '11', 'Florida': '12', 'Georgia': '13', 'Hawaii': '15',
  'Idaho': '16', 'Illinois': '17', 'Indiana': '18', 'Iowa': '19',
  'Kansas': '20', 'Kentucky': '21', 'Louisiana': '22', 'Maine': '23',
  'Maryland': '24', 'Massachusetts': '25', 'Michigan': '26', 'Minnesota': '27',
  'Mississippi': '28', 'Missouri': '29', 'Montana': '30', 'Nebraska': '31',
  'Nevada': '32', 'New Hampshire': '33', 'New Jersey': '34', 'New Mexico': '35',
  'New York': '36', 'North Carolina': '37', 'North Dakota': '38', 'Ohio': '39',
  'Oklahoma': '40', 'Oregon': '41', 'Pennsylvania': '42', 'Rhode Island': '44',
  'South Carolina': '45', 'South Dakota': '46', 'Tennessee': '47', 'Texas': '48',
  'Utah': '49', 'Vermont': '50', 'Virginia': '51', 'Washington': '53',
  'West Virginia': '54', 'Wisconsin': '55', 'Wyoming': '56', 'Puerto Rico': '72'
}

// State capitals data
const stateCapitals = {
  'Alabama': { name: 'Montgomery', lat: 32.377716, lon: -86.300568 },
  'Alaska': { name: 'Juneau', lat: 58.301598, lon: -134.420212 },
  'Arizona': { name: 'Phoenix', lat: 33.448143, lon: -112.096962 },
  'Arkansas': { name: 'Little Rock', lat: 34.746613, lon: -92.288986 },
  'California': { name: 'Sacramento', lat: 38.576668, lon: -121.493629 },
  'Colorado': { name: 'Denver', lat: 39.739227, lon: -104.984856 },
  'Connecticut': { name: 'Hartford', lat: 41.764046, lon: -72.682198 },
  'Delaware': { name: 'Dover', lat: 39.157307, lon: -75.519722 },
  'Florida': { name: 'Tallahassee', lat: 30.438118, lon: -84.281296 },
  'Georgia': { name: 'Atlanta', lat: 33.749027, lon: -84.388229 },
  'Hawaii': { name: 'Honolulu', lat: 21.307442, lon: -157.857376 },
  'Idaho': { name: 'Boise', lat: 43.617775, lon: -116.199722 },
  'Illinois': { name: 'Springfield', lat: 39.798363, lon: -89.654961 },
  'Indiana': { name: 'Indianapolis', lat: 39.768623, lon: -86.162643 },
  'Iowa': { name: 'Des Moines', lat: 41.591087, lon: -93.603729 },
  'Kansas': { name: 'Topeka', lat: 39.048191, lon: -95.677956 },
  'Kentucky': { name: 'Frankfort', lat: 38.186722, lon: -84.875374 },
  'Louisiana': { name: 'Baton Rouge', lat: 30.457069, lon: -91.187393 },
  'Maine': { name: 'Augusta', lat: 44.307167, lon: -69.781693 },
  'Maryland': { name: 'Annapolis', lat: 38.978764, lon: -76.490936 },
  'Massachusetts': { name: 'Boston', lat: 42.358162, lon: -71.063698 },
  'Michigan': { name: 'Lansing', lat: 42.733635, lon: -84.555328 },
  'Minnesota': { name: 'Saint Paul', lat: 44.955097, lon: -93.102211 },
  'Mississippi': { name: 'Jackson', lat: 32.303848, lon: -90.182106 },
  'Missouri': { name: 'Jefferson City', lat: 38.579201, lon: -92.172935 },
  'Montana': { name: 'Helena', lat: 46.585709, lon: -112.018417 },
  'Nebraska': { name: 'Lincoln', lat: 40.808075, lon: -96.699654 },
  'Nevada': { name: 'Carson City', lat: 39.163914, lon: -119.766121 },
  'New Hampshire': { name: 'Concord', lat: 43.206898, lon: -71.537994 },
  'New Jersey': { name: 'Trenton', lat: 40.220596, lon: -74.769913 },
  'New Mexico': { name: 'Santa Fe', lat: 35.682240, lon: -105.939728 },
  'New York': { name: 'Albany', lat: 42.652843, lon: -73.757874 },
  'North Carolina': { name: 'Raleigh', lat: 35.787743, lon: -78.644257 },
  'North Dakota': { name: 'Bismarck', lat: 46.805372, lon: -100.778275 },
  'Ohio': { name: 'Columbus', lat: 39.961346, lon: -82.999069 },
  'Oklahoma': { name: 'Oklahoma City', lat: 35.492207, lon: -97.503342 },
  'Oregon': { name: 'Salem', lat: 44.938461, lon: -123.030403 },
  'Pennsylvania': { name: 'Harrisburg', lat: 40.264378, lon: -76.883598 },
  'Rhode Island': { name: 'Providence', lat: 41.830914, lon: -71.414963 },
  'South Carolina': { name: 'Columbia', lat: 34.000343, lon: -81.033211 },
  'South Dakota': { name: 'Pierre', lat: 44.367031, lon: -100.346405 },
  'Tennessee': { name: 'Nashville', lat: 36.165810, lon: -86.784241 },
  'Texas': { name: 'Austin', lat: 30.27467, lon: -97.740349 },
  'Utah': { name: 'Salt Lake City', lat: 40.777477, lon: -111.888237 },
  'Vermont': { name: 'Montpelier', lat: 44.262436, lon: -72.580536 },
  'Virginia': { name: 'Richmond', lat: 37.538857, lon: -77.43364 },
  'Washington': { name: 'Olympia', lat: 47.035805, lon: -122.905014 },
  'West Virginia': { name: 'Charleston', lat: 38.336246, lon: -81.612328 },
  'Wisconsin': { name: 'Madison', lat: 43.074684, lon: -89.384445 },
  'Wyoming': { name: 'Cheyenne', lat: 41.140259, lon: -104.820236 }
}

const generateCountyData = (countyName, stateName) => {
  return {
    name: countyName,
    state: stateName,
    population: null,
    populationNum: null,
    outbreakRisk: null,
    riskScore: null,
    vaccinationRate: null,
    airQuality: null,
    healthIndex: null,
    activeCases: null,
    hospitalCapacity: null,
    testingRate: null,
  }
}

const useStore = create((set, get) => ({
  // ============================================
  // VIEW MODE
  // ============================================
  // 'globe' - 3D Earth view
  // 'state-counties' - 2D flat county map view
  viewMode: 'globe',

  // ============================================
  // SCENE LOADING — gates the loading overlay
  // ============================================
  sceneReady: false,
  setSceneReady: (ready) => set({ sceneReady: ready }),

  // ============================================
  // STATE SELECTION
  // ============================================
  selectedState: null,
  hoveredState: null,
  zoomedState: null,

  // ============================================
  // COUNTY SELECTION
  // ============================================
  selectedCounty: null,
  hoveredCounty: null,

  // ============================================
  // TRANSITION STATE
  // ============================================
  isTransitioning: false,
  transitionType: null, // 'globe-to-counties' | 'counties-to-globe'

  // ============================================
  // YEAR SELECTION (for WHO data)
  // ============================================
  selectedYear: new Date().getFullYear(),
  setSelectedYear: (year) => set({ selectedYear: year }),

  // ============================================
  // DISEASE SELECTION (global — drives outbreak history + spotlight)
  // ============================================
  selectedDisease: TRACKED_DISEASES[0].id,
  setSelectedDisease: (id) => set({ selectedDisease: id }),

  // ============================================
  // TIMELINE TREND VIEW (drives breadcrumb + health-ring offset)
  // ============================================
  trendView: 'surveillance', // 'surveillance' | 'history'
  setTrendView: (v) => set({ trendView: v }),

  // ============================================
  // HEATMAP MODE
  // ============================================
  heatmapEnabled: false,
  heatmapMetric: 'riskScore',
  toggleHeatmap: () => set((state) => ({ heatmapEnabled: !state.heatmapEnabled })),
  setHeatmapMetric: (metric) => set({ heatmapMetric: metric }),

  // ============================================
  // COMPARISON MODE
  // ============================================
  comparisonOpen: false,
  comparisonStates: [],
  openComparison: () => set({ comparisonOpen: true }),
  closeComparison: () => set({ comparisonOpen: false, comparisonStates: [] }),
  toggleComparison: () => set((state) => ({ comparisonOpen: !state.comparisonOpen })),
  addComparisonState: (name) => set((state) => {
    if (state.comparisonStates.length >= 3 || state.comparisonStates.includes(name)) return state
    return { comparisonStates: [...state.comparisonStates, name] }
  }),
  removeComparisonState: (name) => set((state) => ({
    comparisonStates: state.comparisonStates.filter(s => s !== name)
  })),

  // ============================================
  // WATCHLIST
  // ============================================
  watchlist: ['California', 'New York', 'Texas', 'Florida'], // Default watched states
  watchlistOpen: false,

  toggleWatchlist: () => set((state) => ({ watchlistOpen: !state.watchlistOpen })),
  openWatchlist: () => set({ watchlistOpen: true }),
  closeWatchlist: () => set({ watchlistOpen: false }),

  addToWatchlist: (stateName) => set((state) => {
    if (state.watchlist.includes(stateName)) return state
    return { watchlist: [...state.watchlist, stateName] }
  }),

  removeFromWatchlist: (stateName) => set((state) => ({
    watchlist: state.watchlist.filter(s => s !== stateName)
  })),

  toggleWatchlistState: (stateName) => set((state) => {
    if (state.watchlist.includes(stateName)) {
      return { watchlist: state.watchlist.filter(s => s !== stateName) }
    }
    return { watchlist: [...state.watchlist, stateName] }
  }),

  // ============================================
  // EXTERNAL ZOOM REQUEST (e.g., from Navbar search)
  // ============================================
  // When set, EarthWithStates picks it up, runs the zoom animation, and clears it
  pendingStateZoom: null,

  requestStateZoom: (stateName) => set({ pendingStateZoom: stateName }),
  clearPendingZoom: () => set({ pendingStateZoom: null }),

  // ============================================
  // CAMERA
  // ============================================
  cameraTarget: { x: 0, y: 0, z: 5 },

  // ============================================
  // STATIC DATA
  // ============================================
  stateFips,
  stateCapitals,

  // ============================================
  // STATE HEALTH DATA — empty defaults, hydrated from API on mount
  // ============================================
  stateData: {
    'Alabama': { name: 'Alabama', abbr: 'AL', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Alaska': { name: 'Alaska', abbr: 'AK', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Arizona': { name: 'Arizona', abbr: 'AZ', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Arkansas': { name: 'Arkansas', abbr: 'AR', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'California': { name: 'California', abbr: 'CA', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Colorado': { name: 'Colorado', abbr: 'CO', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Connecticut': { name: 'Connecticut', abbr: 'CT', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Delaware': { name: 'Delaware', abbr: 'DE', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Florida': { name: 'Florida', abbr: 'FL', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Georgia': { name: 'Georgia', abbr: 'GA', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Hawaii': { name: 'Hawaii', abbr: 'HI', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Idaho': { name: 'Idaho', abbr: 'ID', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Illinois': { name: 'Illinois', abbr: 'IL', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Indiana': { name: 'Indiana', abbr: 'IN', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Iowa': { name: 'Iowa', abbr: 'IA', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Kansas': { name: 'Kansas', abbr: 'KS', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Kentucky': { name: 'Kentucky', abbr: 'KY', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Louisiana': { name: 'Louisiana', abbr: 'LA', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Maine': { name: 'Maine', abbr: 'ME', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Maryland': { name: 'Maryland', abbr: 'MD', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Massachusetts': { name: 'Massachusetts', abbr: 'MA', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Michigan': { name: 'Michigan', abbr: 'MI', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Minnesota': { name: 'Minnesota', abbr: 'MN', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Mississippi': { name: 'Mississippi', abbr: 'MS', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Missouri': { name: 'Missouri', abbr: 'MO', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Montana': { name: 'Montana', abbr: 'MT', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Nebraska': { name: 'Nebraska', abbr: 'NE', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Nevada': { name: 'Nevada', abbr: 'NV', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'New Hampshire': { name: 'New Hampshire', abbr: 'NH', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'New Jersey': { name: 'New Jersey', abbr: 'NJ', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'New Mexico': { name: 'New Mexico', abbr: 'NM', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'New York': { name: 'New York', abbr: 'NY', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'North Carolina': { name: 'North Carolina', abbr: 'NC', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'North Dakota': { name: 'North Dakota', abbr: 'ND', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Ohio': { name: 'Ohio', abbr: 'OH', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Oklahoma': { name: 'Oklahoma', abbr: 'OK', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Oregon': { name: 'Oregon', abbr: 'OR', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Pennsylvania': { name: 'Pennsylvania', abbr: 'PA', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Rhode Island': { name: 'Rhode Island', abbr: 'RI', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'South Carolina': { name: 'South Carolina', abbr: 'SC', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'South Dakota': { name: 'South Dakota', abbr: 'SD', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Tennessee': { name: 'Tennessee', abbr: 'TN', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Texas': { name: 'Texas', abbr: 'TX', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Utah': { name: 'Utah', abbr: 'UT', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Vermont': { name: 'Vermont', abbr: 'VT', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Virginia': { name: 'Virginia', abbr: 'VA', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Washington': { name: 'Washington', abbr: 'WA', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'West Virginia': { name: 'West Virginia', abbr: 'WV', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Wisconsin': { name: 'Wisconsin', abbr: 'WI', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null },
    'Wyoming': { name: 'Wyoming', abbr: 'WY', population: null, outbreakRisk: null, riskScore: null, vaccinationRate: null, airQuality: null, healthIndex: null }
  },

  stateDataLoaded: false,

  hydrateStateData: (mapData) => set((state) => {
    if (!mapData?.states) return {}
    const updated = { ...state.stateData }
    const riskLabel = { low: 'Low', moderate: 'Medium', high: 'High' }

    for (const [abbr, apiState] of Object.entries(mapData.states)) {
      const name = apiState.name
      if (updated[name]) {
        updated[name] = {
          ...updated[name],
          riskScore: Math.round(apiState.avgRiskScore),
          outbreakRisk: riskLabel[apiState.riskLevel] || null,
        }
      }
    }
    return { stateData: updated, stateDataLoaded: true }
  }),

  // Merge population totals keyed by 2-letter state code
  hydratePopulations: (pops) => set((state) => {
    const updated = { ...state.stateData }
    const fmt = (n) => {
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
      if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
      return n.toString()
    }
    for (const [name, entry] of Object.entries(updated)) {
      const abbr = entry.abbr
      if (pops[abbr]) {
        updated[name] = { ...entry, population: fmt(pops[abbr]) }
      }
    }
    return { stateData: updated }
  }),

  // ============================================
  // ACTIONS - STATE SELECTION
  // ============================================
  selectState: (stateName) => set((state) => {
    const stateInfo = state.stateData[stateName] || {
      name: stateName,
      abbr: '--',
      population: null,
      outbreakRisk: null,
      riskScore: null,
      vaccinationRate: null,
      airQuality: null,
      healthIndex: null
    }

    // If clicking same selected state, enter county view
    if (state.selectedState?.name === stateName) {
      return {
        viewMode: 'state-counties',
        isTransitioning: true,
        transitionType: 'globe-to-counties',
        selectedCounty: null
      }
    }

    // Otherwise just select the state
    return {
      selectedState: stateInfo,
      selectedCounty: null,
      hoveredCounty: null
    }
  }),

  setHoveredState: (stateName) => set({ hoveredState: stateName }),

  clearSelection: () => set({
    selectedState: null,
    selectedCounty: null,
    hoveredCounty: null,
    zoomedState: null,
    viewMode: 'globe',
    isTransitioning: false,
    transitionType: null
  }),

  // ============================================
  // ACTIONS - VIEW MODE TRANSITIONS
  // ============================================

  // Transition from globe to county view
  enterCountyView: () => set((state) => {
    if (!state.selectedState) return {}

    return {
      viewMode: 'state-counties',
      isTransitioning: true,
      transitionType: 'globe-to-counties',
      selectedCounty: null
    }
  }),

  // Transition from county view back to globe
  exitCountyView: () => set({
    viewMode: 'globe',
    isTransitioning: true,
    transitionType: 'counties-to-globe',
    selectedCounty: null,
    hoveredCounty: null
  }),

  // ============================================
  // ACTIONS - COUNTY SELECTION
  // ============================================
  selectCounty: (countyName, stateName, fips) => set((state) => {
    const countyData = generateCountyData(countyName, stateName)
    if (fips) countyData.fips = fips
    return {
      selectedCounty: countyData
    }
  }),

  setHoveredCounty: (countyName) => set({ hoveredCounty: countyName }),

  clearCountySelection: () => set({ selectedCounty: null }),

  // ============================================
  // ACTIONS - TRANSITIONS
  // ============================================
  transitionComplete: () => set({
    isTransitioning: false,
    transitionType: null
  }),

  setCameraTarget: (target) => set({ cameraTarget: target }),

  // ============================================
  // HELPER - GET STATE FIPS
  // ============================================
  getStateFips: (stateName) => stateFips[stateName] || null,

  // ============================================
  // HELPER - GET CAPITAL
  // ============================================
  getStateCapital: (stateName) => stateCapitals[stateName] || null,

  // ============================================
  // HELPER - GENERATE COUNTY DATA
  // ============================================
  generateCountyData,

  // ============================================
  // SETTINGS PANEL
  // ============================================
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSettings: () => set(s => ({ settingsOpen: !s.settingsOpen })),

  // ============================================
  // USER SETTINGS (persisted to localStorage)
  // ============================================
  settings: loadSettings(),

  updateSetting: (key, value) => {
    const newSettings = { ...get().settings, [key]: value }
    saveSettings(newSettings)
    set({ settings: newSettings })
  },

  resetSettings: () => {
    localStorage.removeItem(SETTINGS_STORAGE_KEY)
    set({ settings: { ...DEFAULT_SETTINGS } })
  },
}))

export default useStore

// ============================================
// SHARED SETTINGS DATA — imported by both SettingsPanel and EarthWithStates
// ============================================

export const OCEAN_PRESETS = [
  {
    id: 'default',
    name: 'Default Blue',
    swatch: 'linear-gradient(135deg, #003366 0%, #001a33 100%)',
    light: [0.02, 0.08, 0.20],
    deep: [0.007, 0.04, 0.10],
  },
  {
    id: 'deep-navy',
    name: 'Deep Navy',
    swatch: 'linear-gradient(135deg, #001a40 0%, #000d1a 100%)',
    light: [0.008, 0.03, 0.12],
    deep: [0.003, 0.015, 0.06],
  },
  {
    id: 'tropical',
    name: 'Tropical Teal',
    swatch: 'linear-gradient(135deg, #004d55 0%, #002233 100%)',
    light: [0.01, 0.15, 0.20],
    deep: [0.005, 0.08, 0.14],
  },
  {
    id: 'arctic',
    name: 'Arctic Ice',
    swatch: 'linear-gradient(135deg, #1a4466 0%, #0a2d4d 100%)',
    light: [0.06, 0.14, 0.24],
    deep: [0.02, 0.08, 0.18],
  },
  {
    id: 'midnight',
    name: 'Midnight Abyss',
    swatch: 'linear-gradient(135deg, #0a1a2a 0%, #050d15 100%)',
    light: [0.005, 0.02, 0.08],
    deep: [0.002, 0.01, 0.05],
  },
]

export const EARTH_TEXTURES = [
  { id: 'daymap6', name: 'Natural Satellite', desc: 'Realistic satellite imagery', accent: '#4a90d9' },
  { id: 'daymap1', name: 'Blue Marble', desc: 'Classic bright earth view', accent: '#5ba3e6' },
  { id: 'daymap3', name: 'Topographic', desc: 'High-contrast terrain detail', accent: '#8b7d5a' },
]

export const SKYBOX_TEXTURES = [
  { id: 'default', name: 'Classic Band', desc: 'Milky Way panorama', gradient: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 40%, #2a2040 70%, #0a0a1a 100%)' },
  { id: 'mw1', name: 'Panoramic', desc: 'Wide galactic band', gradient: 'linear-gradient(135deg, #0a0a12 0%, #15152a 30%, #c8b080 50%, #15152a 70%, #0a0a12 100%)' },
]