// ============================================
// LOCATION SERVICE — Location lookup and listing API calls
// Maps to: backend/api/routes/locations.py
// ============================================
// Endpoints:
//   GET /locations/              → listLocations()    → all tracked counties
//   GET /locations/{fips}        → getLocation()      → single county by FIPS
//   GET /locations/?state=XX     → getStateLocations() → all counties in a state
//   GET /locations/states/list   → listStates()       → distinct states in DB
// ============================================

import api from './api'

// ── Response shape ─────────────────────────────────────────────────
// LocationOut = {
//   id: number,
//   state: string,         // "CA"
//   county: string,        // "Los Angeles"
//   fips: string,          // "06037"
//   population: number,
//   density: number,       // people per sq mi
//   latitude: number,
//   longitude: number,
//   economic_data: object,  // { per_capita_income, gdp, ... }
// }

// ── GET /locations/?state=XX — All counties in a state ─────────────
// Used by: StateCountyMap (to get county-level data for selected state)
export async function getStateLocations(stateAbbr) {
  if (!stateAbbr) return null
  const data = await api.get(`/locations/?state=${stateAbbr}&limit=500`)
  if (!data) return null

  return data.map(normalizeLocation)
}

// ── GET /locations/{fips} — Single location ────────────────────────
// Used by: County detail panel
export async function getLocation(fips) {
  if (!fips) return null
  const data = await api.get(`/locations/${fips}`)
  if (!data) return null

  return normalizeLocation(data)
}

// ── GET /locations/ — All locations (paginated) ────────────────────
// Used by: Search, bulk operations
export async function listLocations({ limit = 100, offset = 0 } = {}) {
  const data = await api.get(`/locations/?limit=${limit}&offset=${offset}`)
  if (!data) return null

  return data.map(normalizeLocation)
}

// ── GET /locations/states/list — Distinct states ───────────────────
// Used by: Navbar search, validation
export async function listStates() {
  const data = await api.get('/locations/states/list')
  if (!data) return null

  return data // returns array of 2-letter state codes
}

// ── Normalize to frontend-friendly shape ───────────────────────────
function normalizeLocation(loc) {
  return {
    id: loc.id,
    state: loc.state,
    county: loc.county,
    fips: loc.fips,
    population: loc.population,
    populationFormatted: formatPopulation(loc.population),
    density: loc.density,
    lat: loc.latitude,
    lon: loc.longitude,
    economicData: loc.economic_data,
  }
}

// ── Helper: Format population for display ──────────────────────────
// Matches the format used in useStore's stateData (e.g., "39.9M", "747K")
function formatPopulation(pop) {
  if (!pop) return 'N/A'
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`
  if (pop >= 1_000) return `${(pop / 1_000).toFixed(0)}K`
  return pop.toString()
}