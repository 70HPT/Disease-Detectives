// ============================================
// USE API DATA — React hooks for fetching backend data
// Provides loading/error states and automatic fallback
// ============================================
// Usage:
//   const { data, loading, error, refetch } = useMapData()
//   const { data, loading } = useLocationRisk(fips)
//   const { data } = useOutbreakHistory(fips)
//   const { data } = useWHOSnapshot()
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { getMapData, getLocationRisk, predictRisk } from './riskService'
import { getStateLocations, getLocation } from './locationService'
import { getOutbreakHistory } from './dataService'
import { getDashboardSnapshot, getUSATimeSeries, WHO_INDICATORS } from './whoService'
import { checkBackendHealth } from './api'

// ── Generic async data hook ────────────────────────────────────────
// Per-request cancellation via a local `cancelled` flag keeps stale
// responses (e.g. from the previous selected state / county) from
// overwriting fresh data during rapid switching.
function useAsyncData(fetchFn, deps = [], options = {}) {
  const { enabled = true, fallback = null } = options
  const [data, setData] = useState(fallback)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Track the most recent fetch generation — older fetches that resolve
  // after a newer one started will see a mismatch and bail out.
  const genRef = useRef(0)

  const refetch = useCallback(() => {
    if (!enabled) return
    const myGen = ++genRef.current
    setLoading(true)
    setError(null)

    Promise.resolve()
      .then(fetchFn)
      .then(result => {
        if (myGen !== genRef.current) return
        if (result !== null) setData(result)
        else if (fallback) setData(fallback)
        setLoading(false)
      })
      .catch(err => {
        if (myGen !== genRef.current) return
        setError(err.message)
        console.warn('[useAsyncData] Error:', err.message)
        if (fallback) setData(fallback)
        setLoading(false)
      })
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refetch()
    // Bump the generation on unmount/dep-change so any in-flight fetch's
    // `.then` callbacks see a mismatch and early-return.
    return () => { genRef.current++ }
  }, [refetch])

  return { data, loading, error, refetch }
}

// ── Backend health check ───────────────────────────────────────────
// Call once on app mount to determine if backend is available
export function useBackendHealth() {
  return useAsyncData(
    () => checkBackendHealth(),
    [],
    { fallback: { connected: false, status: 'checking' } }
  )
}

// ── Map data for globe coloring ────────────────────────────────────
// Returns aggregated risk data per state
// Falls back to null (components should check and use store's stateData)
export function useMapData() {
  return useAsyncData(
    () => getMapData(),
    [],
    { fallback: null }
  )
}

// ── Risk data for a single location ────────────────────────────────
// Pass a FIPS code + disease apiKey, get back normalized risk response
export function useLocationRisk(fips, diseaseType = 'influenza') {
  return useAsyncData(
    () => getLocationRisk(fips, diseaseType),
    [fips, diseaseType],
    { enabled: !!fips, fallback: null }
  )
}

// ── Fresh prediction for a county ──────────────────────────────────
// Triggers the ML model on the backend
export function usePrediction(fips, diseaseType = 'influenza') {
  return useAsyncData(
    () => predictRisk(fips, diseaseType),
    [fips, diseaseType],
    { enabled: !!fips, fallback: null }
  )
}

// ── All locations for a state ──────────────────────────────────────
// Returns county-level data for the state county map
export function useStateLocations(stateAbbr) {
  return useAsyncData(
    () => getStateLocations(stateAbbr),
    [stateAbbr],
    { enabled: !!stateAbbr, fallback: null }
  )
}

// ── Single location details ────────────────────────────────────────
export function useLocation(fips) {
  return useAsyncData(
    () => getLocation(fips),
    [fips],
    { enabled: !!fips, fallback: null }
  )
}

// ── Outbreak history for timeline ──────────────────────────────────
export function useOutbreakHistory(fips, diseaseType = 'total') {
  return useAsyncData(
    () => getOutbreakHistory(fips, { diseaseType }),
    [fips, diseaseType],
    { enabled: !!fips, fallback: null }
  )
}

// ── WHO dashboard snapshot (direct API, no backend needed) ─────────
// Pulls latest USA values for key health indicators
export function useWHOSnapshot() {
  return useAsyncData(
    () => getDashboardSnapshot(),
    [],
    { fallback: null }
  )
}

// ── WHO time series for a specific indicator ───────────────────────
// Returns chart-ready [{ year, value }] array
export function useWHOTimeSeries(indicatorCode, sex = 'BTSX') {
  return useAsyncData(
    () => getUSATimeSeries(indicatorCode, sex),
    [indicatorCode, sex],
    { enabled: !!indicatorCode, fallback: null }
  )
}

// Re-export indicator codes for convenience
export { WHO_INDICATORS }