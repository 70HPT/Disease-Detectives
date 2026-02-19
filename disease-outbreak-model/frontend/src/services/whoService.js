// ============================================
// WHO SERVICE — Direct calls to the WHO Global Health Observatory API
// No backend required — requests proxy through Vite dev server
// ============================================
// Vite proxies /who-api/* → https://ghoapi.azureedge.net/api/*
// This avoids CORS issues during local development.
// See vite.config.js for proxy configuration.
//
// API docs: https://www.who.int/data/gho/info/gho-odata-api
// ============================================

const WHO_BASE = '/who-api'

// ── Indicator codes relevant to Disease Detective ──────────────────
export const WHO_INDICATORS = {
  // Life expectancy & mortality
  LIFE_EXPECTANCY:        'WHOSIS_000001',  // Life expectancy at birth
  ADULT_MORTALITY:        'WHOSIS_000004',  // Adult mortality rate (per 1000)
  INFANT_MORTALITY:       'MDG_0000000001', // Infant mortality rate (per 1000 live births)
  NEONATAL_MORTALITY:     'WHOSIS_000003',  // Neonatal mortality rate
  NCD_MORTALITY:          'NCDMORT3070',    // Prob of dying from NCD between 30-70

  // Immunization
  MEASLES_IMMUNIZATION:   'WHS4_100',       // Measles immunization coverage (%)
  DTP3_IMMUNIZATION:      'WHS4_543',       // DTP3 immunization coverage (%)
  POLIO_IMMUNIZATION:     'WHS4_544',       // Polio immunization coverage (%)

  // Disease surveillance
  TUBERCULOSIS_INCIDENCE: 'MDG_0000000020', // TB incidence (per 100,000)
  HIV_PREVALENCE:         'WHS2_138',       // HIV prevalence (% of adults 15-49)
  MALARIA_INCIDENCE:      'MALARIA_EST_INCIDENCE', // Malaria incidence (per 1000)

  // Health systems
  HEALTH_EXPENDITURE:     'GHED_CHEGDP_SHA2011', // Health expenditure as % of GDP
  PHYSICIAN_DENSITY:      'HWF_0001',       // Physicians per 10,000 population
  NURSING_DENSITY:        'HWF_0006',       // Nursing personnel per 10,000

  // Air quality
  AIR_POLLUTION_DEATHS:   'AIR_41',         // Ambient air pollution attributable deaths
  PM25_CONCENTRATION:     'AIR_10',         // PM2.5 concentrations (annual mean, µg/m³)

  // Infectious disease
  INFLUENZA_FLU:          'WHS3_43',        // Influenza positive specimens (backend default)
}

// ── Fetch a single indicator for USA ───────────────────────────────
// Returns all available years of data
export async function getUSAIndicator(indicatorCode) {
  try {
    const url = `${WHO_BASE}/${indicatorCode}?$filter=SpatialDim eq 'USA'`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`WHO API error: ${response.status}`)

    const json = await response.json()
    const records = json.value || []

    return records
      .filter(r => r.NumericValue != null)
      .map(r => ({
        year: parseInt(r.TimeDim) || null,
        value: r.NumericValue,
        sex: r.Dim1 || 'BTSX',          // BTSX = both sexes, MLE = male, FMLE = female
        low: r.Low ?? null,
        high: r.High ?? null,
      }))
      .sort((a, b) => (b.year || 0) - (a.year || 0)) // newest first
  } catch (error) {
    console.warn(`[WHO] Failed to fetch ${indicatorCode}:`, error.message)
    return null
  }
}

// ── Fetch multiple indicators at once ──────────────────────────────
// Returns { [indicatorCode]: data[] }
export async function getUSAIndicators(indicatorCodes) {
  const results = {}
  const promises = indicatorCodes.map(async (code) => {
    results[code] = await getUSAIndicator(code)
  })
  await Promise.allSettled(promises)
  return results
}

// ── Get the most recent value for an indicator ─────────────────────
// Convenience wrapper that returns just the latest number
export async function getLatestUSAValue(indicatorCode, sex = 'BTSX') {
  const data = await getUSAIndicator(indicatorCode)
  if (!data || data.length === 0) return null

  const filtered = data.filter(r => r.sex === sex)
  return filtered.length > 0 ? filtered[0] : data[0]
}

// ── Build a time series for charting ───────────────────────────────
// Returns [{ year, value }] sorted ascending — ready for recharts
export async function getUSATimeSeries(indicatorCode, sex = 'BTSX') {
  const data = await getUSAIndicator(indicatorCode)
  if (!data) return null

  return data
    .filter(r => r.sex === sex && r.year)
    .sort((a, b) => a.year - b.year)
    .map(r => ({ year: r.year, value: r.value }))
}

// ── Fetch a "dashboard snapshot" of key indicators ─────────────────
// Pulls the latest values for indicators most relevant to our dashboard
export async function getDashboardSnapshot() {
  const codes = [
    WHO_INDICATORS.LIFE_EXPECTANCY,
    WHO_INDICATORS.ADULT_MORTALITY,
    WHO_INDICATORS.MEASLES_IMMUNIZATION,
    WHO_INDICATORS.TUBERCULOSIS_INCIDENCE,
    WHO_INDICATORS.HEALTH_EXPENDITURE,
    WHO_INDICATORS.PM25_CONCENTRATION,
  ]

  const results = await getUSAIndicators(codes)

  return {
    lifeExpectancy: extractLatest(results[WHO_INDICATORS.LIFE_EXPECTANCY]),
    adultMortality: extractLatest(results[WHO_INDICATORS.ADULT_MORTALITY]),
    measlesImmunization: extractLatest(results[WHO_INDICATORS.MEASLES_IMMUNIZATION]),
    tbIncidence: extractLatest(results[WHO_INDICATORS.TUBERCULOSIS_INCIDENCE]),
    healthExpenditure: extractLatest(results[WHO_INDICATORS.HEALTH_EXPENDITURE]),
    airPollution: extractLatest(results[WHO_INDICATORS.PM25_CONCENTRATION]),
  }
}

// ── Helper: Extract latest "both sexes" value from a dataset ───────
function extractLatest(data) {
  if (!data || data.length === 0) return null
  const bothSexes = data.filter(r => r.sex === 'BTSX')
  const record = bothSexes.length > 0 ? bothSexes[0] : data[0]
  return {
    value: record.value,
    year: record.year,
  }
}