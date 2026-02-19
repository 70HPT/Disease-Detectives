import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import TRANSMISSION_CORRIDORS from '../../data/transmissionCorridors'

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

// State centroids — same as EarthWithStates
const CENTROIDS = {
  'Alabama': { lat: 32.806671, lon: -86.791130 },
  'Alaska': { lat: 61.370716, lon: -152.404419 },
  'Arizona': { lat: 33.729759, lon: -111.431221 },
  'Arkansas': { lat: 34.969704, lon: -92.373123 },
  'California': { lat: 36.116203, lon: -119.681564 },
  'Colorado': { lat: 39.059811, lon: -105.311104 },
  'Connecticut': { lat: 41.597782, lon: -72.755371 },
  'Delaware': { lat: 39.318523, lon: -75.507141 },
  'District of Columbia': { lat: 38.897438, lon: -77.026817 },
  'Florida': { lat: 27.766279, lon: -81.686783 },
  'Georgia': { lat: 33.040619, lon: -83.643074 },
  'Hawaii': { lat: 21.094318, lon: -157.498337 },
  'Idaho': { lat: 44.240459, lon: -114.478828 },
  'Illinois': { lat: 40.349457, lon: -88.986137 },
  'Indiana': { lat: 39.849426, lon: -86.258278 },
  'Iowa': { lat: 42.011539, lon: -93.210526 },
  'Kansas': { lat: 38.526600, lon: -96.726486 },
  'Kentucky': { lat: 37.668140, lon: -84.670067 },
  'Louisiana': { lat: 31.169546, lon: -91.867805 },
  'Maine': { lat: 44.693947, lon: -69.381927 },
  'Maryland': { lat: 39.063946, lon: -76.802101 },
  'Massachusetts': { lat: 42.230171, lon: -71.530106 },
  'Michigan': { lat: 43.326618, lon: -84.536095 },
  'Minnesota': { lat: 45.694454, lon: -93.900192 },
  'Mississippi': { lat: 32.741646, lon: -89.678696 },
  'Missouri': { lat: 38.456085, lon: -92.288368 },
  'Montana': { lat: 46.921925, lon: -110.454353 },
  'Nebraska': { lat: 41.125370, lon: -98.268082 },
  'Nevada': { lat: 38.313515, lon: -117.055374 },
  'New Hampshire': { lat: 43.452492, lon: -71.563896 },
  'New Jersey': { lat: 40.298904, lon: -74.521011 },
  'New Mexico': { lat: 34.840515, lon: -106.248482 },
  'New York': { lat: 42.165726, lon: -74.948051 },
  'North Carolina': { lat: 35.630066, lon: -79.806419 },
  'North Dakota': { lat: 47.528912, lon: -99.784012 },
  'Ohio': { lat: 40.388783, lon: -82.764915 },
  'Oklahoma': { lat: 35.565342, lon: -96.928917 },
  'Oregon': { lat: 44.572021, lon: -122.070938 },
  'Pennsylvania': { lat: 40.590752, lon: -77.209755 },
  'Rhode Island': { lat: 41.680893, lon: -71.511780 },
  'South Carolina': { lat: 33.856892, lon: -80.945007 },
  'South Dakota': { lat: 44.299782, lon: -99.438828 },
  'Tennessee': { lat: 35.747845, lon: -86.692345 },
  'Texas': { lat: 31.054487, lon: -97.563461 },
  'Utah': { lat: 40.150032, lon: -111.862434 },
  'Vermont': { lat: 44.045876, lon: -72.710686 },
  'Virginia': { lat: 37.769337, lon: -78.169968 },
  'Washington': { lat: 47.400902, lon: -121.490494 },
  'West Virginia': { lat: 38.491226, lon: -80.954453 },
  'Wisconsin': { lat: 44.268543, lon: -89.616508 },
  'Wyoming': { lat: 42.755966, lon: -107.302490 },
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

    // Color based on risk: high=red-orange, medium=amber, low=cyan-green
    let clr
    if (riskWeight > 0.75) clr = new THREE.Color('#ff6b4a')
    else if (riskWeight > 0.55) clr = new THREE.Color('#f0a030')
    else clr = new THREE.Color('#00e0a0')

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
export default function TransmissionArcs({ selectedStateName, zoomComplete }) {
  const [arcsVisible, setArcsVisible] = useState(false)
  const prevStateRef = useRef(null)

  // Show arcs after zoom completes, hide immediately on state change
  useEffect(() => {
    if (zoomComplete && selectedStateName) {
      // Small additional delay after zoom for dramatic effect
      const t = setTimeout(() => setArcsVisible(true), 300)
      return () => clearTimeout(t)
    } else {
      setArcsVisible(false)
    }
  }, [zoomComplete, selectedStateName])

  // Reset when state changes
  useEffect(() => {
    if (selectedStateName !== prevStateRef.current) {
      setArcsVisible(false)
      prevStateRef.current = selectedStateName
    }
  }, [selectedStateName])

  const corridors = useMemo(() => {
    if (!selectedStateName) return []
    const data = TRANSMISSION_CORRIDORS[selectedStateName] || []
    const srcCentroid = CENTROIDS[selectedStateName]
    if (!srcCentroid) return []

    return data
      .filter(c => CENTROIDS[c.target]) // only states we can place
      .sort((a, b) => b.riskWeight - a.riskWeight) // strongest first
      .map((corridor, i) => ({
        ...corridor,
        source: srcCentroid,
        targetCoords: CENTROIDS[corridor.target],
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