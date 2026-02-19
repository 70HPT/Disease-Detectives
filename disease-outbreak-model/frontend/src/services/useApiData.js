// ============================================
// USE API DATA — React hooks for fetching backend data
// Provides loading/error states and automatic fallback to mock data
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
function useAsyncData(fetchFn, deps = [], options = {}) {
  const { enabled = true, fallback = null } = options
  const [data, setData] = useState(fallback)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  const fetch = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)

    try {
      const result = await fetchFn()

      if (!mountedRef.current) return

      if (result !== null) {
        setData(result)
      } else {
        // Backend unavailable — keep fallback data
        if (fallback) setData(fallback)
      }
    } catch (err) {
      if (!mountedRef.current) return
      setError(err.message)
      console.warn('[useAsyncData] Error:', err.message)
      // On error, keep fallback data
      if (fallback) setData(fallback)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true
    fetch()
    return () => { mountedRef.current = false }
  }, [fetch])

  return { data, loading, error, refetch: fetch }
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
// Pass a FIPS code, get back normalized risk response
export function useLocationRisk(fips) {
  return useAsyncData(
    () => getLocationRisk(fips),
    [fips],
    { enabled: !!fips, fallback: null }
  )
}

// ── Fresh prediction for a county ──────────────────────────────────
// Triggers the ML model (or mock) on the backend
export function usePrediction(fips) {
  return useAsyncData(
    () => predictRisk(fips),
    [fips],
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