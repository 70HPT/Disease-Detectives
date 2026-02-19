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
export async function getMapData() {
  const data = await api.get('/risk/map')
  if (!data) return null

  // Normalize into a lookup object keyed by state abbreviation
  // so components can do: mapData['CA'].avg_risk_score
  const stateMap = {}
  for (const state of data.states) {
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
// Used by: StatePanel (on state click), StateHealthRings
export async function getLocationRisk(fips) {
  if (!fips) return null
  const data = await api.get(`/risk/location/${fips}`)
  if (!data) return null

  return normalizeRiskResponse(data)
}

// ── POST /risk/predict — Fresh ML prediction ───────────────────────
// Used by: StateCountyMap (on county click for real-time prediction)
export async function predictRisk(fips) {
  if (!fips) return null
  const data = await api.post('/risk/predict', { fips })
  if (!data) return null

  return normalizeRiskResponse(data)
}

// ── Normalize backend response to frontend-friendly shape ──────────
function normalizeRiskResponse(data) {
  return {
    fips: data.fips,
    county: data.county,
    state: data.state,
    riskScore: data.risk_score,
    confidence: data.confidence,
    riskLevel: data.risk_level,
    factors: {
      populationDensity: data.factors?.population_density ?? 0,
      climateRisk: data.factors?.climate_risk ?? 0,
      vaccinationCoverage: data.factors?.vaccination_coverage ?? 0,
      historicalTrend: data.factors?.historical_trend ?? 0,
      searchTrend: data.factors?.search_trend ?? 0,
    },
    modelVersion: data.model_version,
    generatedAt: data.generated_at,
  }
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