// ============================================
// SERVICES INDEX — Clean re-exports
// ============================================
// All files in this folder:
//   api.js, riskService.js, locationService.js, dataService.js,
//   whoService.js, useApiData.js, useWHOPulse.js, index.js
// ============================================

// React hooks — primary way components consume data
export {
  useBackendHealth,
  useMapData,
  useLocationRisk,
  usePrediction,
  useStateLocations,
  useLocation,
  useOutbreakHistory,
  useWHOSnapshot,
  useWHOTimeSeries,
  WHO_INDICATORS,
} from './useApiData'

// WHO pulse hook — year-specific WHO data for Global Health Pulse
export { useWHOPulse } from './useWHOPulse'

// Service functions — for use outside React or in store actions
export { getMapData, getLocationRisk, predictRisk, getRiskLevel, stateNameToAbbr } from './riskService'
export { getStateLocations, getLocation, listLocations, listStates } from './locationService'
export { getOutbreakHistory, getCDCData, getCensusData, getClimateData, getWHOData } from './dataService'
export { getUSAIndicator, getUSATimeSeries, getLatestUSAValue, getDashboardSnapshot } from './whoService'

// API client
export { checkBackendHealth, APIError } from './api'