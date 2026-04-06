// ============================================
// USE WHO PULSE — Year-specific WHO data for Global Health Pulse
// Fetches real indicators and formats them for the stat cards
// Falls back to null stats if the API fails or data isn't available
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
          {
            key: 'lifeExp',
            value: le !== null ? `${le.toFixed(1)} yr` : '\u2014',
            label: 'US Life Expectancy',
            trend: le !== null ? getTrend(le, lePrev) : 'stable',
            change: le !== null ? getChange(le, lePrev, 1) : '',
            source: le !== null ? 'WHO' : null
          },
          {
            key: 'measles',
            value: mv !== null ? `${Math.round(mv)}%` : '\u2014',
            label: 'Measles Immunization (US)',
            trend: mv !== null ? getTrend(mv, mvPrev) : 'stable',
            change: mv !== null ? getChange(mv, mvPrev, 0) : '',
            source: mv !== null ? 'WHO' : null
          },
          {
            key: 'tb',
            value: tbi !== null ? `${tbi.toFixed(1)}` : '\u2014',
            label: 'TB Incidence (per 100K)',
            trend: tbi !== null ? getTrend(tbi, tbiPrev, true) : 'stable',
            change: tbi !== null ? getChange(tbi, tbiPrev, 1) : '',
            source: tbi !== null ? 'WHO' : null
          },
          {
            key: 'healthExp',
            value: he !== null ? `${he.toFixed(1)}%` : '\u2014',
            label: 'Health Spending (% GDP)',
            trend: he !== null ? getTrend(he, hePrev) : 'stable',
            change: he !== null ? getChange(he, hePrev, 1) : '',
            source: he !== null ? 'WHO' : null
          },
        ]

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
    stats,           // null = no data available, array = real WHO stats
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