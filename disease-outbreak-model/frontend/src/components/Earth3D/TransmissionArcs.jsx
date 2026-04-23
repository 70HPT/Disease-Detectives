import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import TRANSMISSION_CORRIDORS, { getCorridorRiskColor } from '../../data/transmissionCorridors'
import STATE_CENTROIDS from '../../data/stateCentroids'

const EARTH_RADIUS = 2

// Convert lat/lon to 3D position on globe
function latLonTo3D(lat, lon, radius = EARTH_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}


// ============================================
// SINGLE ARC — animated glowing bezier curve
// ============================================
function TransmissionArc({ source, target, riskWeight, delay, visible }) {
  const lineRef = useRef()
  const pulseRef = useRef()
  const progressRef = useRef(0)
  const pulseProgressRef = useRef(0)
  const startTimeRef = useRef(null)

  // Build the arc curve
  const { curve, points, color } = useMemo(() => {
    const srcPos = latLonTo3D(source.lat, source.lon, EARTH_RADIUS + 0.003)
    const tgtPos = latLonTo3D(target.lat, target.lon, EARTH_RADIUS + 0.003)

    // Midpoint elevated above globe surface
    const mid = new THREE.Vector3().addVectors(srcPos, tgtPos).multiplyScalar(0.5)
    const dist = srcPos.distanceTo(tgtPos)
    const elevation = EARTH_RADIUS + 0.06 + dist * 0.28
    mid.normalize().multiplyScalar(elevation)

    const crv = new THREE.QuadraticBezierCurve3(srcPos, mid, tgtPos)
    const pts = crv.getPoints(64)

    // Shared color helper — keeps the arc + pulse dot visually identical to
    // the ta-corridor-bar in StatePanel's Transmission Analysis.
    const clr = new THREE.Color(getCorridorRiskColor(riskWeight))

    return { curve: crv, points: pts, color: clr }
  }, [source, target, riskWeight])

  // Geometry with all points — we'll reveal via drawRange
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points)
    geo.setDrawRange(0, 0) // start hidden
    return geo
  }, [points])

  // Pulse dot geometry
  const pulseGeo = useMemo(() => new THREE.SphereGeometry(0.012, 8, 8), [])

  useFrame((_, delta) => {
    if (!visible) {
      if (progressRef.current > 0) {
        // Fade out
        progressRef.current = Math.max(0, progressRef.current - delta * 3)
        const count = Math.floor(progressRef.current * 65)
        geometry.setDrawRange(0, count)
        if (lineRef.current) lineRef.current.material.opacity = progressRef.current * 0.7
        if (pulseRef.current) pulseRef.current.visible = false
      }
      startTimeRef.current = null
      return
    }

    // Delay before drawing
    if (startTimeRef.current === null) startTimeRef.current = performance.now()
    const elapsed = (performance.now() - startTimeRef.current) / 1000

    if (elapsed < delay) return

    // Draw-in animation
    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta * 1.2)
      const count = Math.floor(progressRef.current * 65)
      geometry.setDrawRange(0, count)
      if (lineRef.current) {
        lineRef.current.material.opacity = progressRef.current * (0.35 + riskWeight * 0.45)
      }
    }

    // Pulse traveling along the arc
    if (progressRef.current >= 1 && pulseRef.current) {
      pulseRef.current.visible = true
      pulseProgressRef.current = (pulseProgressRef.current + delta * (0.3 + riskWeight * 0.4)) % 1
      const pos = curve.getPoint(pulseProgressRef.current)
      pulseRef.current.position.copy(pos)
      // Pulse glow intensity
      const glow = 0.5 + Math.sin(pulseProgressRef.current * Math.PI) * 0.5
      pulseRef.current.material.opacity = glow * 0.9
    }
  })

  return (
    <group>
      <line ref={lineRef} geometry={geometry}>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={0}
          linewidth={2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </line>

      {/* Traveling pulse dot */}
      <mesh ref={pulseRef} geometry={pulseGeo} visible={false}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

// ============================================
// MAIN — renders all arcs for selected state
// ============================================
export default function TransmissionArcs({ selectedStateName, isAnimatingRef }) {
  const [arcsVisible, setArcsVisible] = useState(false)
  const prevStateRef = useRef(null)
  const delayTimerRef = useRef(null)
  const wasZoomCompleteRef = useRef(false)

  // Poll isAnimatingRef in useFrame to detect zoom completion
  useFrame(() => {
    const zoomComplete = !!selectedStateName && !isAnimatingRef.current
    if (zoomComplete && !wasZoomCompleteRef.current) {
      // Transition to zoom complete — start delay timer
      wasZoomCompleteRef.current = true
      delayTimerRef.current = setTimeout(() => setArcsVisible(true), 300)
    } else if (!zoomComplete && wasZoomCompleteRef.current) {
      // No longer zoom complete
      wasZoomCompleteRef.current = false
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current)
      setArcsVisible(false)
    }
  })

  // Reset when state changes
  useEffect(() => {
    if (selectedStateName !== prevStateRef.current) {
      setArcsVisible(false)
      wasZoomCompleteRef.current = false
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current)
      prevStateRef.current = selectedStateName
    }
  }, [selectedStateName])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (delayTimerRef.current) clearTimeout(delayTimerRef.current) }
  }, [])

  const corridors = useMemo(() => {
    if (!selectedStateName) return []
    const data = TRANSMISSION_CORRIDORS[selectedStateName] || []
    const srcCentroid = STATE_CENTROIDS[selectedStateName]
    if (!srcCentroid) return []

    return data
      .filter(c => STATE_CENTROIDS[c.target]) // only states we can place
      .sort((a, b) => b.riskWeight - a.riskWeight) // strongest first
      .map((corridor, i) => ({
        ...corridor,
        source: srcCentroid,
        targetCoords: STATE_CENTROIDS[corridor.target],
        index: i,
      }))
  }, [selectedStateName])

  if (!selectedStateName || corridors.length === 0) return null

  return (
    <group>
      {corridors.map((c, i) => (
        <TransmissionArc
          key={`${selectedStateName}-${c.target}`}
          source={c.source}
          target={c.targetCoords}
          riskWeight={c.riskWeight}
          delay={i * 0.35} // stagger: strongest first
          visible={arcsVisible}
        />
      ))}
    </group>
  )
}