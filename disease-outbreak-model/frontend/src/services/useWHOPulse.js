// ============================================
// USE WHO PULSE — Year-specific WHO data for Global Health Pulse
// Fetches real indicators and formats them for the stat cards
// Falls back to mock data if the API fails or data isn't available
// ============================================
// Usage in ContentSections.jsx:
//   import { useWHOPulse } from '../../services/useWHOPulse'
//   ...
//   function GlobalHealthPulse({ year, isVisible }) {
//     const { stats, source, loading } = useWHOPulse(year)
//     const mockData = fetchGlobalPulse(year)
//     ...
//   }
// ============================================

import { useState, useEffect, useRef } from 'react'
import { getUSAIndicator, WHO_INDICATORS } from './whoService'

// Cache results so switching years back and forth doesn't re-fetch
const cache = {}

export function useWHOPulse(year) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    // Check cache first
    if (cache[year]) {
      setStats(cache[year])
      return
    }

    let cancelled = false
    setLoading(true)

    async function fetchWHOData() {
      try {
        // Fetch 4 indicators in parallel
        const [lifeExp, measles, tb, healthExp] = await Promise.all([
          getUSAIndicator(WHO_INDICATORS.LIFE_EXPECTANCY),
          getUSAIndicator(WHO_INDICATORS.MEASLES_IMMUNIZATION),
          getUSAIndicator(WHO_INDICATORS.TUBERCULOSIS_INCIDENCE),
          getUSAIndicator(WHO_INDICATORS.HEALTH_EXPENDITURE),
        ])

        if (cancelled || !mountedRef.current) return

        // Extract values for the selected year
        const le = findYearValue(lifeExp, year)
        const mv = findYearValue(measles, year)
        const tbi = findYearValue(tb, year)
        const he = findYearValue(healthExp, year)

        // If we got at least 2 indicators, consider it a success
        const found = [le, mv, tbi, he].filter(v => v !== null)
        if (found.length < 2) {
          setStats(null)
          setLoading(false)
          return
        }

        // Find previous year values for trend calculation
        const lePrev = findYearValue(lifeExp, year - 1)
        const mvPrev = findYearValue(measles, year - 1)
        const tbiPrev = findYearValue(tb, year - 1)
        const hePrev = findYearValue(healthExp, year - 1)

        const result = [
          le !== null ? {
            key: 'lifeExp',
            value: `${le.toFixed(1)} yr`,
            label: 'US Life Expectancy',
            trend: getTrend(le, lePrev),
            change: getChange(le, lePrev, 1),
            source: 'WHO'
          } : null,

          mv !== null ? {
            key: 'measles',
            value: `${Math.round(mv)}%`,
            label: 'Measles Immunization (US)',
            trend: getTrend(mv, mvPrev),
            change: getChange(mv, mvPrev, 0),
            source: 'WHO'
          } : null,

          tbi !== null ? {
            key: 'tb',
            value: `${tbi.toFixed(1)}`,
            label: 'TB Incidence (per 100K)',
            trend: getTrend(tbi, tbiPrev, true), // inverted — lower is better
            change: getChange(tbi, tbiPrev, 1),
            source: 'WHO'
          } : null,

          he !== null ? {
            key: 'healthExp',
            value: `${he.toFixed(1)}%`,
            label: 'Health Spending (% GDP)',
            trend: getTrend(he, hePrev),
            change: getChange(he, hePrev, 1),
            source: 'WHO'
          } : null,
        ].filter(Boolean)

        cache[year] = result
        setStats(result)
      } catch (err) {
        console.warn('[useWHOPulse] Failed:', err.message)
        if (!cancelled) setStats(null)
      } finally {
        if (!cancelled && mountedRef.current) setLoading(false)
      }
    }

    fetchWHOData()
    return () => { cancelled = true }
  }, [year])

  return {
    stats,           // null = use mock data, array = real WHO stats
    loading,
    source: stats ? 'WHO GHO API' : 'demo',
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function findYearValue(data, year) {
  if (!data) return null
  // Filter for "both sexes" where applicable
  const match = data.find(r => r.year === year && r.sex === 'BTSX')
    || data.find(r => r.year === year)
  return match?.value ?? null
}

function getTrend(current, previous, inverted = false) {
  if (current == null || previous == null) return 'stable'
  const diff = current - previous
  if (Math.abs(diff) < 0.1) return 'stable'
  if (inverted) return diff > 0 ? 'down' : 'up' // for metrics where lower = better
  return diff > 0 ? 'up' : 'down'
}

function getChange(current, previous, decimals = 1) {
  if (current == null || previous == null) return ''
  const diff = current - previous
  if (Math.abs(diff) < 0.05) return ''
  const sign = diff > 0 ? '+' : ''
  return `${sign}${diff.toFixed(decimals)}`
}