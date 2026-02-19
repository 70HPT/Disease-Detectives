import { create } from 'zustand'

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

// Generate placeholder county health data
const generateCountyData = (countyName, stateName) => {
  // Use hash of name to generate consistent "random" values
  const hash = (countyName + stateName).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)

  const pseudoRandom = (seed) => {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }

  const riskScore = Math.floor(pseudoRandom(hash) * 100)
  const vaccinationRate = Math.floor(50 + pseudoRandom(hash + 1) * 45)
  const healthIndex = Math.floor(40 + pseudoRandom(hash + 2) * 55)

  const riskLevels = ['Low', 'Medium', 'High']
  const outbreakRisk = riskLevels[Math.floor(pseudoRandom(hash + 3) * 3)]

  const airQualities = ['Good', 'Moderate', 'Unhealthy for Sensitive Groups']
  const airQuality = airQualities[Math.floor(pseudoRandom(hash + 4) * 3)]

  // Generate placeholder population (between 10k and 500k for most counties)
  const population = Math.floor(10000 + pseudoRandom(hash + 5) * 490000)
  const populationStr = population >= 1000000
    ? `${(population / 1000000).toFixed(1)}M`
    : `${(population / 1000).toFixed(0)}K`

  return {
    name: countyName,
    state: stateName,
    population: populationStr,
    populationNum: population,
    outbreakRisk,
    riskScore,
    vaccinationRate,
    airQuality,
    healthIndex,
    // Placeholder for backend integration
    activeCases: Math.floor(pseudoRandom(hash + 6) * 500),
    hospitalCapacity: Math.floor(60 + pseudoRandom(hash + 7) * 35),
    testingRate: Math.floor(pseudoRandom(hash + 8) * 100),
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
  // PROFILE PAGE
  // ============================================
  profileOpen: false,
  toggleProfile: () => set((state) => ({ profileOpen: !state.profileOpen })),
  openProfile: () => set({ profileOpen: true }),
  closeProfile: () => set({ profileOpen: false }),

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
  // STATE HEALTH DATA (2024/2025 Census Population Data)
  // ============================================
  stateData: {
    'Alabama': { name: 'Alabama', abbr: 'AL', population: '5.2M', outbreakRisk: 'Medium', riskScore: 42, vaccinationRate: 52, airQuality: 'Good', healthIndex: 58 },
    'Alaska': { name: 'Alaska', abbr: 'AK', population: '747K', outbreakRisk: 'Low', riskScore: 28, vaccinationRate: 58, airQuality: 'Good', healthIndex: 68 },
    'Arizona': { name: 'Arizona', abbr: 'AZ', population: '7.8M', outbreakRisk: 'Medium', riskScore: 45, vaccinationRate: 60, airQuality: 'Moderate', healthIndex: 62 },
    'Arkansas': { name: 'Arkansas', abbr: 'AR', population: '3.1M', outbreakRisk: 'Medium', riskScore: 48, vaccinationRate: 54, airQuality: 'Good', healthIndex: 55 },
    'California': { name: 'California', abbr: 'CA', population: '39.9M', outbreakRisk: 'Low', riskScore: 23, vaccinationRate: 78, airQuality: 'Moderate', healthIndex: 72 },
    'Colorado': { name: 'Colorado', abbr: 'CO', population: '6.1M', outbreakRisk: 'Low', riskScore: 25, vaccinationRate: 72, airQuality: 'Good', healthIndex: 75 },
    'Connecticut': { name: 'Connecticut', abbr: 'CT', population: '3.7M', outbreakRisk: 'Low', riskScore: 22, vaccinationRate: 82, airQuality: 'Good', healthIndex: 78 },
    'Delaware': { name: 'Delaware', abbr: 'DE', population: '1.1M', outbreakRisk: 'Low', riskScore: 30, vaccinationRate: 70, airQuality: 'Good', healthIndex: 70 },
    'Florida': { name: 'Florida', abbr: 'FL', population: '24.3M', outbreakRisk: 'Medium', riskScore: 52, vaccinationRate: 65, airQuality: 'Good', healthIndex: 61 },
    'Georgia': { name: 'Georgia', abbr: 'GA', population: '11.4M', outbreakRisk: 'Medium', riskScore: 48, vaccinationRate: 56, airQuality: 'Good', healthIndex: 59 },
    'Hawaii': { name: 'Hawaii', abbr: 'HI', population: '1.5M', outbreakRisk: 'Low', riskScore: 20, vaccinationRate: 80, airQuality: 'Good', healthIndex: 82 },
    'Idaho': { name: 'Idaho', abbr: 'ID', population: '2.1M', outbreakRisk: 'Medium', riskScore: 40, vaccinationRate: 48, airQuality: 'Good', healthIndex: 65 },
    'Illinois': { name: 'Illinois', abbr: 'IL', population: '12.8M', outbreakRisk: 'Low', riskScore: 33, vaccinationRate: 72, airQuality: 'Moderate', healthIndex: 68 },
    'Indiana': { name: 'Indiana', abbr: 'IN', population: '7.0M', outbreakRisk: 'Medium', riskScore: 42, vaccinationRate: 55, airQuality: 'Moderate', healthIndex: 60 },
    'Iowa': { name: 'Iowa', abbr: 'IA', population: '3.3M', outbreakRisk: 'Low', riskScore: 32, vaccinationRate: 62, airQuality: 'Good', healthIndex: 68 },
    'Kansas': { name: 'Kansas', abbr: 'KS', population: '3.0M', outbreakRisk: 'Low', riskScore: 35, vaccinationRate: 58, airQuality: 'Good', healthIndex: 65 },
    'Kentucky': { name: 'Kentucky', abbr: 'KY', population: '4.7M', outbreakRisk: 'Medium', riskScore: 45, vaccinationRate: 55, airQuality: 'Moderate', healthIndex: 55 },
    'Louisiana': { name: 'Louisiana', abbr: 'LA', population: '4.6M', outbreakRisk: 'Medium', riskScore: 50, vaccinationRate: 52, airQuality: 'Moderate', healthIndex: 52 },
    'Maine': { name: 'Maine', abbr: 'ME', population: '1.4M', outbreakRisk: 'Low', riskScore: 22, vaccinationRate: 78, airQuality: 'Good', healthIndex: 75 },
    'Maryland': { name: 'Maryland', abbr: 'MD', population: '6.4M', outbreakRisk: 'Low', riskScore: 28, vaccinationRate: 76, airQuality: 'Moderate', healthIndex: 72 },
    'Massachusetts': { name: 'Massachusetts', abbr: 'MA', population: '7.3M', outbreakRisk: 'Low', riskScore: 20, vaccinationRate: 85, airQuality: 'Good', healthIndex: 80 },
    'Michigan': { name: 'Michigan', abbr: 'MI', population: '10.3M', outbreakRisk: 'Low', riskScore: 29, vaccinationRate: 70, airQuality: 'Good', healthIndex: 69 },
    'Minnesota': { name: 'Minnesota', abbr: 'MN', population: '5.9M', outbreakRisk: 'Low', riskScore: 24, vaccinationRate: 72, airQuality: 'Good', healthIndex: 76 },
    'Mississippi': { name: 'Mississippi', abbr: 'MS', population: '2.9M', outbreakRisk: 'High', riskScore: 58, vaccinationRate: 48, airQuality: 'Good', healthIndex: 48 },
    'Missouri': { name: 'Missouri', abbr: 'MO', population: '6.3M', outbreakRisk: 'Medium', riskScore: 42, vaccinationRate: 55, airQuality: 'Moderate', healthIndex: 60 },
    'Montana': { name: 'Montana', abbr: 'MT', population: '1.1M', outbreakRisk: 'Low', riskScore: 32, vaccinationRate: 55, airQuality: 'Good', healthIndex: 68 },
    'Nebraska': { name: 'Nebraska', abbr: 'NE', population: '2.0M', outbreakRisk: 'Low', riskScore: 30, vaccinationRate: 60, airQuality: 'Good', healthIndex: 70 },
    'Nevada': { name: 'Nevada', abbr: 'NV', population: '3.4M', outbreakRisk: 'Medium', riskScore: 40, vaccinationRate: 58, airQuality: 'Moderate', healthIndex: 62 },
    'New Hampshire': { name: 'New Hampshire', abbr: 'NH', population: '1.4M', outbreakRisk: 'Low', riskScore: 22, vaccinationRate: 75, airQuality: 'Good', healthIndex: 78 },
    'New Jersey': { name: 'New Jersey', abbr: 'NJ', population: '9.7M', outbreakRisk: 'Low', riskScore: 28, vaccinationRate: 78, airQuality: 'Moderate', healthIndex: 72 },
    'New Mexico': { name: 'New Mexico', abbr: 'NM', population: '2.1M', outbreakRisk: 'Medium', riskScore: 38, vaccinationRate: 65, airQuality: 'Good', healthIndex: 60 },
    'New York': { name: 'New York', abbr: 'NY', population: '20.1M', outbreakRisk: 'Low', riskScore: 31, vaccinationRate: 81, airQuality: 'Moderate', healthIndex: 74 },
    'North Carolina': { name: 'North Carolina', abbr: 'NC', population: '11.4M', outbreakRisk: 'Low', riskScore: 35, vaccinationRate: 67, airQuality: 'Good', healthIndex: 66 },
    'North Dakota': { name: 'North Dakota', abbr: 'ND', population: '812K', outbreakRisk: 'Low', riskScore: 35, vaccinationRate: 52, airQuality: 'Good', healthIndex: 68 },
    'Ohio': { name: 'Ohio', abbr: 'OH', population: '12.0M', outbreakRisk: 'Medium', riskScore: 41, vaccinationRate: 58, airQuality: 'Moderate', healthIndex: 62 },
    'Oklahoma': { name: 'Oklahoma', abbr: 'OK', population: '4.2M', outbreakRisk: 'Medium', riskScore: 48, vaccinationRate: 52, airQuality: 'Good', healthIndex: 55 },
    'Oregon': { name: 'Oregon', abbr: 'OR', population: '4.3M', outbreakRisk: 'Low', riskScore: 28, vaccinationRate: 70, airQuality: 'Moderate', healthIndex: 72 },
    'Pennsylvania': { name: 'Pennsylvania', abbr: 'PA', population: '13.2M', outbreakRisk: 'Low', riskScore: 28, vaccinationRate: 75, airQuality: 'Moderate', healthIndex: 70 },
    'Rhode Island': { name: 'Rhode Island', abbr: 'RI', population: '1.1M', outbreakRisk: 'Low', riskScore: 25, vaccinationRate: 82, airQuality: 'Good', healthIndex: 76 },
    'South Carolina': { name: 'South Carolina', abbr: 'SC', population: '5.7M', outbreakRisk: 'Medium', riskScore: 45, vaccinationRate: 55, airQuality: 'Good', healthIndex: 58 },
    'South Dakota': { name: 'South Dakota', abbr: 'SD', population: '937K', outbreakRisk: 'Low', riskScore: 35, vaccinationRate: 55, airQuality: 'Good', healthIndex: 68 },
    'Tennessee': { name: 'Tennessee', abbr: 'TN', population: '7.4M', outbreakRisk: 'Medium', riskScore: 48, vaccinationRate: 52, airQuality: 'Moderate', healthIndex: 55 },
    'Texas': { name: 'Texas', abbr: 'TX', population: '32.4M', outbreakRisk: 'Medium', riskScore: 45, vaccinationRate: 62, airQuality: 'Good', healthIndex: 65 },
    'Utah': { name: 'Utah', abbr: 'UT', population: '3.6M', outbreakRisk: 'Low', riskScore: 28, vaccinationRate: 60, airQuality: 'Moderate', healthIndex: 75 },
    'Vermont': { name: 'Vermont', abbr: 'VT', population: '648K', outbreakRisk: 'Low', riskScore: 18, vaccinationRate: 82, airQuality: 'Good', healthIndex: 82 },
    'Virginia': { name: 'Virginia', abbr: 'VA', population: '9.0M', outbreakRisk: 'Low', riskScore: 30, vaccinationRate: 72, airQuality: 'Moderate', healthIndex: 70 },
    'Washington': { name: 'Washington', abbr: 'WA', population: '8.2M', outbreakRisk: 'Low', riskScore: 25, vaccinationRate: 75, airQuality: 'Moderate', healthIndex: 74 },
    'West Virginia': { name: 'West Virginia', abbr: 'WV', population: '1.8M', outbreakRisk: 'High', riskScore: 55, vaccinationRate: 48, airQuality: 'Moderate', healthIndex: 48 },
    'Wisconsin': { name: 'Wisconsin', abbr: 'WI', population: '6.0M', outbreakRisk: 'Low', riskScore: 30, vaccinationRate: 65, airQuality: 'Good', healthIndex: 70 },
    'Wyoming': { name: 'Wyoming', abbr: 'WY', population: '593K', outbreakRisk: 'Low', riskScore: 32, vaccinationRate: 48, airQuality: 'Good', healthIndex: 68 }
  },

  // ============================================
  // ACTIONS - STATE SELECTION
  // ============================================
  selectState: (stateName) => set((state) => {
    const stateInfo = state.stateData[stateName] || {
      name: stateName,
      abbr: '--',
      population: 'N/A',
      outbreakRisk: 'Unknown',
      riskScore: 50,
      vaccinationRate: 50,
      airQuality: 'Unknown',
      healthIndex: 50
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
  selectCounty: (countyName, stateName) => set((state) => {
    const countyData = generateCountyData(countyName, stateName)
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