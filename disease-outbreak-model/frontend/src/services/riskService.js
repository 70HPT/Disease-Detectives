// ============================================
// RISK SERVICE — Prediction and risk assessment API calls
// Maps to: backend/api/routes/risk.py
// ============================================
// Endpoints:
//   GET  /risk/map              → getMapData()       → powers globe coloring
//   GET  /risk/location/{fips}  → getLocationRisk()   → cached prediction for a county
//   POST /risk/predict          → predictRisk()       → fresh ML prediction for a county
// ============================================

import api from './api'

// ── Response shapes (matching backend schemas) ─────────────────────
// These mirror what the Pydantic schemas will define.
// When backend is unavailable, components fall back to store's hardcoded data.
//
// RiskResponse = {
//   fips: string,              // "06037"
//   county: string,            // "Los Angeles"
//   state: string,             // "CA"
//   risk_score: number,        // 0-100
//   confidence: number,        // 0-1
//   risk_level: string,        // "low" | "moderate" | "high"
//   factors: {
//     population_density: number,    // 0-1
//     climate_risk: number,          // 0-1
//     vaccination_coverage: number,  // 0-1
//     historical_trend: number,      // 0-1
//     search_trend: number,          // 0-1
//   },
//   model_version: string,
//   generated_at: string,      // ISO datetime
// }
//
// MapDataResponse = {
//   states: [{
//     state: string,           // "CA"
//     state_name: string,      // "California"
//     avg_risk_score: number,
//     max_risk_score: number,
//     county_count: number,
//     risk_level: string,
//   }],
//   generated_at: string,
//   model_version: string,
// }

// ── GET /risk/map — Aggregated state data for globe ────────────────
// Used by: EarthWithStates.jsx (globe coloring), Watchlist, Comparison
// diseaseType filters the per-state risk aggregation once the backend's
// `disease_type` column is populated. Without it the backend returns the
// default (influenza) regardless of which disease the UI has selected.
export async function getMapData(diseaseType = null) {
  const q = diseaseType ? `?disease_type=${encodeURIComponent(diseaseType)}` : ''
  const data = await api.get(`/risk/map${q}`)
  if (!data) return null

  // Normalize into a lookup object keyed by state abbreviation
  // so components can do: mapData['CA'].avg_risk_score. Guard against the
  // backend returning null/missing `states` (happens when the queried
  // disease has zero predictions).
  const stateMap = {}
  for (const state of (data.states ?? [])) {
    stateMap[state.state] = {
      abbr: state.state,
      name: state.state_name,
      avgRiskScore: state.avg_risk_score,
      maxRiskScore: state.max_risk_score,
      countyCount: state.county_count,
      riskLevel: state.risk_level,
    }
  }

  return {
    states: stateMap,
    stateList: data.states,
    generatedAt: data.generated_at,
    modelVersion: data.model_version,
  }
}

// ── GET /risk/location/{fips} — Cached prediction ──────────────────
// Used by: StatePanel (on state/county click), StateHealthRings
// diseaseType filters to the ML model's per-disease prediction when the
// backend migration is live.
export async function getLocationRisk(fips, diseaseType = 'influenza') {
  if (!fips) return null
  const q = diseaseType ? `?disease_type=${encodeURIComponent(diseaseType)}` : ''
  const data = await api.get(`/risk/location/${fips}${q}`)
  if (!data) return null

  return normalizeRiskResponse(data)
}

// ── POST /risk/predict — Fresh ML prediction ───────────────────────
// Used by: StateCountyMap (on county click for real-time prediction)
export async function predictRisk(fips, diseaseType = 'influenza') {
  if (!fips) return null
  const data = await api.post('/risk/predict', { fips, disease_type: diseaseType })
  if (!data) return null

  return normalizeRiskResponse(data)
}

// ── POST /risk/batch — Multiple county predictions at once ─────────
// Used by: StateCountyMap (to get real risk scores for all counties)
// Backend caps `fips_codes` at 100 per request (Pydantic max_length). Big
// states (TX 254, GA 159, KY 120, NC 100, MO 115, KS 105, IL 102) blow
// that limit — without chunking the server rejects with 422 and the map
// paints every county as "unavailable offline".
const BATCH_CHUNK_SIZE = 100

export async function batchPredictRisk(fipsCodes, diseaseType = 'influenza') {
  if (!fipsCodes || fipsCodes.length === 0) return null

  const chunks = []
  for (let i = 0; i < fipsCodes.length; i += BATCH_CHUNK_SIZE) {
    chunks.push(fipsCodes.slice(i, i + BATCH_CHUNK_SIZE))
  }

  // 15s per chunk — a cold chunk may run up to 100 fresh ML predictions
  // server-side on first access, which easily exceeds the default 3s.
  // Subsequent loads of the same state hit the cache and return fast.
  const responses = await Promise.all(
    chunks.map(chunk =>
      api.post(
        '/risk/batch',
        { fips_codes: chunk, disease_type: diseaseType },
        { timeoutMs: 15000 }
      ).catch(() => null)
    )
  )

  // If every chunk failed, treat as backend-offline. If some chunks
  // returned data, merge what we got — partial data beats no data.
  const anySucceeded = responses.some(r => r != null)
  if (!anySucceeded) return null

  const result = {}
  for (const data of responses) {
    const predictions = Array.isArray(data?.predictions)
      ? data.predictions
      : Array.isArray(data)
      ? data
      : []
    for (const pred of predictions) {
      if (pred?.fips == null) continue
      // Normalize FIPS to 5-digit zero-padded string so backend integers
      // (e.g. 37001) match the frontend's string keys ('37001').
      const fipsKey = String(pred.fips).padStart(5, '0')
      result[fipsKey] = normalizeRiskResponse(pred)
    }
  }
  return result
}

// ── Normalize backend response to frontend-friendly shape ──────────
function normalizeRiskResponse(data) {
  // Guard on factors in case the backend ships `null` (not just missing keys)
  const f = data.factors || {}
  return {
    fips: data.fips,
    county: data.county,
    state: data.state,
    riskScore: data.risk_score,
    confidence: data.confidence,
    riskLevel: data.risk_level,
    factors: {
      populationDensity: f.population_density ?? 0,
      climateRisk: f.climate_risk ?? 0,
      vaccinationCoverage: f.vaccination_coverage ?? 0,
      historicalTrend: f.historical_trend ?? 0,
      searchTrend: f.search_trend ?? 0,
    },
    modelVersion: data.model_version,
    generatedAt: data.generated_at,
  }
}

// ── GET /diseases/available — Active disease models ───────────────
// Returns the apiKey strings (e.g. ['covid', 'influenza', 'salmonella'])
// for diseases that have a registered ML model. Frontend uses this to
// filter the hardcoded TRACKED_DISEASES list so the disease picker only
// shows models that actually work.
export async function getAvailableDiseases() {
  const data = await api.get('/diseases/available')
  if (!data?.diseases || !Array.isArray(data.diseases)) return null
  return data.diseases
}

// ── Helper: Convert risk score to frontend risk level label ────────
// Matches the backend's _risk_level() helper
export function getRiskLevel(score) {
  if (score < 33) return 'Low'
  if (score < 66) return 'Medium'
  return 'High'
}

// ── Helper: Convert state name to abbreviation for API calls ───────
// The backend expects 2-letter codes, but our store uses full names
export function stateNameToAbbr(stateName) {
  return STATE_ABBR_MAP[stateName] || null
}

const STATE_ABBR_MAP = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY',
}