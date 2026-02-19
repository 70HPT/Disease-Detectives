// ============================================
// DATA SERVICE — Outbreak history and external data API calls
// Maps to: backend/api/routes/data.py
// ============================================
// Endpoints:
//   GET /data/history/{fips}         → getOutbreakHistory()  → historical outbreaks
//   GET /data/cdc/diseases           → getCDCData()          → CDC surveillance proxy
//   GET /data/census/population/{st} → getCensusData()       → Census population proxy
//   GET /data/noaa/climate/{fips}    → getClimateData()      → NOAA climate proxy
//   GET /data/who/indicators         → getWHOData()          → WHO indicators proxy
// ============================================

import api from './api'

// ── Response shape ─────────────────────────────────────────────────
// OutbreakHistoryOut = {
//   id: number,
//   location_id: number,
//   disease_type: string,    // "influenza", "covid", "total"
//   date: string,            // ISO datetime
//   case_count: number,
//   population: number,
//   climate_data: object,    // { avg_temp, avg_humidity, precipitation }
// }

// ── GET /data/history/{fips} — Outbreak history for a county ───────
// Used by: StateTimeline.jsx
export async function getOutbreakHistory(fips, { diseaseType = 'total', limit = 100 } = {}) {
  if (!fips) return null
  const params = `?disease_type=${diseaseType}&limit=${limit}`
  const data = await api.get(`/data/history/${fips}${params}`)
  if (!data) return null

  return data.map(record => ({
    id: record.id,
    locationId: record.location_id,
    diseaseType: record.disease_type,
    date: record.date,
    caseCount: record.case_count,
    population: record.population,
    climateData: record.climate_data,
  }))
}

// ── GET /data/cdc/diseases — CDC surveillance data ─────────────────
// Used by: Potential future integration for state-level disease data
export async function getCDCData(state = null, limit = 100) {
  const params = state ? `?state=${state}&limit=${limit}` : `?limit=${limit}`
  const data = await api.get(`/data/cdc/diseases${params}`)
  if (!data) return null

  return {
    source: data.source,
    count: data.count,
    records: data.records,
  }
}

// ── GET /data/census/population/{state_fips} — Census data ─────────
// Used by: Population displays when backend is available
export async function getCensusData(stateFips, countyFips = '*') {
  if (!stateFips) return null
  const data = await api.get(`/data/census/population/${stateFips}?county_fips=${countyFips}`)
  if (!data) return null

  return {
    source: data.source,
    count: data.count,
    records: data.records,
  }
}

// ── GET /data/noaa/climate/{fips} — Climate observations ───────────
export async function getClimateData(fips, startDate, endDate) {
  if (!fips || !startDate || !endDate) return null
  const params = `?start_date=${startDate}&end_date=${endDate}`
  const data = await api.get(`/data/noaa/climate/${fips}${params}`)
  if (!data) return null

  return {
    source: data.source,
    count: data.count,
    records: data.records,
  }
}

// ── GET /data/who/indicators — WHO health indicators ───────────────
// Note: This proxies through our backend. For direct WHO calls, use whoService.js
export async function getWHOData(indicator = 'WHS3_43', country = 'USA') {
  const data = await api.get(`/data/who/indicators?indicator=${indicator}&country=${country}`)
  if (!data) return null

  return {
    source: data.source,
    count: data.count,
    records: data.records,
  }
}