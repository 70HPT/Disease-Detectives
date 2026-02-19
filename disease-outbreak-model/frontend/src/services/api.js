// ============================================
// API CLIENT — Base configuration and fetch wrapper
// Disease Detective Frontend
// ============================================
// Central API client with:
// - Configurable base URL
// - Fast timeout (no hanging when backend is offline)
// - Offline detection (stops retrying after first failure)
// - Fallback support (returns null on failure so components use mock data)
// ============================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

// ── Offline detection ────────────────────────────────────────────
// Once we know the backend is down, skip fetches for a cooldown period
// so clicking states doesn't hang waiting for a timeout every time
let backendOffline = false
let offlineTimestamp = 0
const OFFLINE_COOLDOWN = 30000 // Retry backend after 30 seconds

function isBackendOffline() {
  if (!backendOffline) return false
  // Check if cooldown has passed — try again
  if (Date.now() - offlineTimestamp > OFFLINE_COOLDOWN) {
    backendOffline = false
    return false
  }
  return true
}

function markOffline() {
  backendOffline = true
  offlineTimestamp = Date.now()
}

// ── Core fetch wrapper ─────────────────────────────────────────────
const FETCH_TIMEOUT = 3000 // 3 second timeout — fail fast

async function apiFetch(endpoint, options = {}) {
  // Skip immediately if backend is known to be offline
  if (isBackendOffline()) return null

  const url = `${API_BASE}${endpoint}`

  // AbortController for fast timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    signal: controller.signal,
    ...options,
  }

  try {
    const response = await fetch(url, config)
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new APIError(
        errorBody.detail || `Request failed: ${response.status}`,
        response.status,
        errorBody
      )
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof APIError) throw error

    // Network error or timeout — backend not running
    markOffline()
    console.warn(`[API] ${endpoint} — backend unavailable, using fallback data`)
    return null
  }
}

// ── Convenience methods ────────────────────────────────────────────
export const api = {
  get: (endpoint) => apiFetch(endpoint, { method: 'GET' }),

  post: (endpoint, body) => apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
}

// ── Custom error class ─────────────────────────────────────────────
export class APIError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.body = body
  }
}

// ── Health check — verify backend is alive ─────────────────────────
export async function checkBackendHealth() {
  try {
    const data = await api.get('/health')
    if (!data) return { connected: false, status: 'offline' }
    return {
      connected: true,
      status: data.status,
      modelLoaded: data.model_loaded,
      dbConnected: data.database_connected,
      version: data.version,
    }
  } catch {
    return { connected: false, status: 'offline' }
  }
}

export default api