import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STATE_EVENTS } from '../../data/stateHealthData'
import STATE_CENTROIDS from '../../data/stateCentroids'

const EARTH_RADIUS = 2

// Severity → color palette (matches the state timeline and national outbreak timeline)
const SEVERITY_COLOR = {
  critical: '#ff4060',
  high: '#f0a030',
  medium: '#0ea5e9',
  low: '#00ffcc',
}

// Convert lat/lon to 3D position on globe
function latLonTo3D(lat, lon, radius = EARTH_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

// ============================================
// SINGLE MARKER — tiny dot with a slow-pulsing halo
// ============================================
function EventMarker({ position, color, delay }) {
  const dotRef = useRef()
  const haloRef = useRef()

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + delay
    // Slow pulse — 4s period, 0.6 → 1.0 scale
    const scale = 1 + Math.sin(t * 1.5) * 0.2
    if (haloRef.current) {
      haloRef.current.scale.setScalar(scale)
      haloRef.current.material.opacity = 0.35 - (scale - 1) * 0.8
    }
    if (dotRef.current) {
      dotRef.current.material.opacity = 0.85 + Math.sin(t * 1.5) * 0.1
    }
  })

  return (
    <group position={position}>
      {/* Outer halo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Core dot */}
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.009, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

// ============================================
// MAIN — renders a marker for every state that has historical events
// Only visible in landing globe view (no state selected, no transition).
// ============================================
export default function StateEventMarkers({ selectedStateName, isAnimatingRef, visible }) {
  const markers = useMemo(() => {
    return Object.entries(STATE_EVENTS)
      .filter(([state]) => STATE_CENTROIDS[state])
      .map(([state, events]) => {
        // Pick the "worst" severity across the state's events
        const order = { critical: 3, high: 2, medium: 1, low: 0 }
        const worst = events.reduce((w, e) =>
          (order[e.severity] ?? 0) > (order[w] ?? 0) ? e.severity : w,
          'low')
        const centroid = STATE_CENTROIDS[state]
        // Lift slightly above surface so it doesn't z-fight with state fills
        return {
          state,
          position: latLonTo3D(centroid.lat, centroid.lon, EARTH_RADIUS + 0.018),
          color: SEVERITY_COLOR[worst] || SEVERITY_COLOR.medium,
        }
      })
  }, [])

  if (!visible || selectedStateName) return null

  return (
    <group>
      {markers.map((m, i) => (
        <EventMarker
          key={m.state}
          position={m.position}
          color={m.color}
          delay={i * 0.15}
        />
      ))}
    </group>
  )
}
