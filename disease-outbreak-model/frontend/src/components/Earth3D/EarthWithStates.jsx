import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TextureLoader } from 'three'
import { feature } from 'topojson-client'
import useStore from '../../store/useStore'
import TransmissionArcs from '../Earth3D/TransmissionArcs'
import { OCEAN_PRESETS } from '../../store/useStore'

import earthDayMap6 from '../../assets/textures/8k_earth_daymap6.png'
import earthDayMap1 from '../../assets/textures/8k_earth_daymap1.jpg'
import earthDayMap3 from '../../assets/textures/8k_earth_daymap3.jpg'

const EARTH_TEXTURE_MAP = {
  daymap6: earthDayMap6,
  daymap1: earthDayMap1,
  daymap3: earthDayMap3,
}

// Determine initial earth texture from localStorage (avoids flash on startup)
function getInitialEarthTexture() {
  try {
    const raw = localStorage.getItem('dd-settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.earthTexture && EARTH_TEXTURE_MAP[parsed.earthTexture]) {
        return parsed.earthTexture
      }
    }
  } catch (e) { /* ignore */ }
  return 'daymap6'
}
const INITIAL_EARTH_TEXTURE_KEY = getInitialEarthTexture()
const INITIAL_EARTH_TEXTURE_URL = EARTH_TEXTURE_MAP[INITIAL_EARTH_TEXTURE_KEY]

// Normal map for surface detail - it adds realistic terrain bumps
let earthNormalMap
try {
  earthNormalMap = new URL('../../assets/textures/8k_earth_normal_map.png', import.meta.url).href
} catch (e) {
  earthNormalMap = null
}

// Specular map for ocean reflections (white = shiny ocean, black = matte land)
let earthSpecularMap
try {
  earthSpecularMap = new URL('../../assets/textures/8k_earth_specular_map.png', import.meta.url).href
} catch (e) {
  earthSpecularMap = null
}

// Cloud texture
let earthCloudsMap
try {
  earthCloudsMap = new URL('../../assets/textures/8k_earth_clouds.png', import.meta.url).href
} catch (e) {
  earthCloudsMap = null
}

// MILKY WAY / SKYBOX TEXTURE URLS
function tryUrl(path) {
  try { return new URL(path, import.meta.url).href }
  catch (e) { return null }
}

const SKYBOX_TEXTURE_MAP = {
  default: tryUrl('../../assets/textures/8k_stars_milky_way.png'),
  mw1: tryUrl('../../assets/textures/8k_stars_milky_way1.jpg'),
  mw2: tryUrl('../../assets/textures/8k_stars_milky_way2.jpg'),
  mw3: tryUrl('../../assets/textures/8k_stars_milky_way3.jpg'),
  mw4: tryUrl('../../assets/textures/8k_stars_milky_way4.jpg'),
}

const milkyWayMap = SKYBOX_TEXTURE_MAP.default

// CONSTANTS
const EARTH_RADIUS = 2
const STATE_ELEVATION = 0.018

// US center coordinates - for the rotation
const US_CENTER = { lat: 39.8283, lon: -98.5795 }

// State centroids for camera targeting when zoomed in
const STATE_CENTROIDS = {
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
  'Puerto Rico': { lat: 18.220833, lon: -66.590149 },
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
  'Wyoming': { lat: 42.755966, lon: -107.302490 }
}

// Animation settings
const IDLE_ROTATION_SPEED = 0.015 // Radians per second when idle
const IDLE_TIMEOUT = 2000 // ms before auto-rotation resumes after interaction
const ROTATION_ANIMATION_DURATION = 1.2 // seconds to center on US
const ZOOM_ANIMATION_DURATION = 0.8 // seconds to zoom in/out

// Latitude tilt settings
const US_CENTER_LAT = 39.8283  // US center latitude
const MAX_TILT_ANGLE = 0.50    // Maximum X rotation in radians

// Momentum settings - Tuned for ~2.5 second spin
const MOMENTUM_FRICTION = 0.968
const MOMENTUM_THRESHOLD = 0.00012  // When to consider spin "stopped"
const SPRING_EASE_VELOCITY = 0.0004
const IDLE_DIRECTION = 1  // 1 = counter-clockwise (positive), -1 = clockwise

// Camera positions (these are distances from origin, accounting for Y=4)
const CAMERA_Y = 4
const DEFAULT_CAMERA_DISTANCE = Math.sqrt(CAMERA_Y * CAMERA_Y + 5.5 * 5.5)
const ZOOMED_CAMERA_DISTANCE = Math.sqrt(CAMERA_Y * CAMERA_Y + 2.5 * 2.5)

// ============================================
// DEEP SPACE INTRO ANIMATION SETTINGS
// ============================================
const INTRO_START_DISTANCE = 100 // Start very far away
const INTRO_DURATION = 3.5 // seconds for the zoom animation
const INTRO_EARTH_SCALE_START = 0.1 // Earth starts tiny
const INTRO_STAR_STREAK_INTENSITY = 0.8 // How much stars streak during zoom

// Offset to account for sidebar panel - applied to camera X position when zoomed
// Larger value shifts Earth more to the left (into the remaining screen space)
// Higher means more left
const SIDEBAR_CAMERA_OFFSET = -0.1 // Negative moves the Earth left, positive moves it right

const ZOOMED_CAMERA_Y_OFFSET = -0.95  // Negative = Earth appears higher

// Vertical offset for Earth centering - positive = Earth appears lower in viewport
// This accounts for the header taking up screen space
const EARTH_LOOK_OFFSET_Y = 0.35

// Calculate the Y rotation needed to center US in view
const US_CENTER_ROTATION_Y = -(US_CENTER.lon + 90) * (Math.PI / 180)

// Helper to get rotation for any longitude (negated for correct direction)
const getRotationForLongitude = (lon) => {
  return -(lon + 90) * (Math.PI / 180)
}

// Responsive camera scale — pushes globe back on smaller screens
// Returns a multiplier: 1.0 on desktop, up to ~1.35 on small phones
function getViewportCameraScale() {
  const width = window.innerWidth
  if (width >= 1024) return 1.0
  if (width <= 420) return 1.35
  // Linear interpolation between 420px and 1024px
  return 1.35 - ((width - 420) / (1024 - 420)) * 0.35
}

// STATE RISK DATA (for future coloring) - Hard coded for display
const STATE_RISK_LEVELS = {
  'California': 'Low',
  'Texas': 'Medium',
  'Florida': 'Medium',
  'New York': 'Low',
  'Pennsylvania': 'Low',
  'Illinois': 'Low',
  'Ohio': 'Medium',
  'Georgia': 'Medium',
  'North Carolina': 'Low',
  'Michigan': 'Low',
  'New Jersey': 'Low',
  'Virginia': 'Low',
  'Washington': 'Low',
  'Arizona': 'High',
  'Massachusetts': 'Low',
  'Tennessee': 'Medium',
  'Indiana': 'Medium',
  'Missouri': 'Medium',
  'Maryland': 'Low',
  'Wisconsin': 'Low',
  'Colorado': 'Low',
  'Minnesota': 'Low',
  'South Carolina': 'Medium',
  'Alabama': 'High',
  'Louisiana': 'High',
  'Kentucky': 'Medium',
  'Oregon': 'Low',
  'Oklahoma': 'Medium',
  'Connecticut': 'Low',
  'Utah': 'Low',
  'Iowa': 'Low',
  'Nevada': 'Medium',
  'Arkansas': 'High',
  'Mississippi': 'High',
  'Kansas': 'Medium',
  'New Mexico': 'Medium',
  'Nebraska': 'Low',
  'Idaho': 'Medium',
  'West Virginia': 'High',
  'Hawaii': 'Low',
  'New Hampshire': 'Low',
  'Maine': 'Low',
  'Rhode Island': 'Low',
  'Montana': 'Low',
  'Delaware': 'Low',
  'South Dakota': 'Medium',
  'North Dakota': 'Low',
  'Alaska': 'Low',
  'Vermont': 'Low',
  'Wyoming': 'Low',
  'District of Columbia': 'Low',
  'Puerto Rico': 'Medium'
}

// Risk colors
const RISK_COLORS = {
  'Low': {
    default: { color: '#10b981', opacity: 0.08 },   // Faint green
    hover: { color: '#34d399', opacity: 0.5 },  // Medium green
    selected: { color: '#6ee7b7', opacity: 0.75 }   // Bright green
  },
  'Medium': {
    default: { color: '#f59e0b', opacity: 0.12 },   // Faint amber
    hover: { color: '#fbbf24', opacity: 0.5 },  // Medium amber
    selected: { color: '#fcd34d', opacity: 0.75 }   // Bright amber
  },
  'High': {
    default: { color: '#ef4444', opacity: 0.15 },   // Faint red
    hover: { color: '#f87171', opacity: 0.5 },  // Medium red
    selected: { color: '#fca5a5', opacity: 0.75 }   // Bright red
  },
  'Unknown': {
    default: { color: '#6b7280', opacity: 0.05 },   // Very faint gray
    hover: { color: '#9ca3af', opacity: 0.4 },  // Medium gray
    selected: { color: '#d1d5db', opacity: 0.6 }    // Light gray
  }
}

// EASING FUNCTIONS
// ease-out-cubic: cubic-bezier(0.33, 1, 0.68, 1)
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

// ease-in-out-cubic: cubic-bezier(0.65, 0, 0.35, 1)
const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1)
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5)

// ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1) - great for dramatic zoom
const easeOutExpo = (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t)

// ease-in-out-quart: cubic-bezier(0.76, 0, 0.24, 1)
const easeInOutQuart = (t) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2

// Custom smooth deceleration for space zoom - starts fast, very smooth end
// Approximates cubic-bezier(0.05, 0.95, 0.15, 1)
const easeOutSpaceZoom = (t) => {
  // Combination of expo and quint for more smooth deceleration
  const expo = 1 - Math.pow(2, -12 * t)
  const quint = 1 - Math.pow(1 - t, 5)
  return expo * 0.7 + quint * 0.3
}

// Smooth fade in - cubic-bezier(0.4, 0, 0.2, 1)
const easeOutSmooth = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

// Gentle fade for Earth appearance - cubic-bezier(0.25, 0.1, 0.25, 1)
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2

// MILKY WAY SKYBOX COMPONENT
// Fade-in duration for smooth appearance
const MILKYWAY_FADE_DURATION = 1800

function MilkyWaySkybox({ rotationRef, introProgressRef, scrollProgressRef, sceneReady, onTextureLoaded, skyboxUrl }) {
  const meshRef = useRef()
  const materialRef = useRef()
  const [texture, setTexture] = useState(null)
  const fadeStartTimeRef = useRef(null)
  const fadeProgressRef = useRef(0)
  const onTextureLoadedRef = useRef(onTextureLoaded)
  const sceneReadyRef = useRef(sceneReady)

  const uniforms = useMemo(() => ({
    uTexture: { value: null },
    uBrightness: { value: 0 },
    uSaturation: { value: 1.0 }
  }), [])

  // Update texture uniform when texture loads
  useEffect(() => {
    if (texture && uniforms.uTexture) {
      uniforms.uTexture.value = texture
    }
  }, [texture, uniforms])

  // Keep refs updated
  useEffect(() => {
    onTextureLoadedRef.current = onTextureLoaded
  }, [onTextureLoaded])

  useEffect(() => {
    sceneReadyRef.current = sceneReady
    if (sceneReady) {
    }
  }, [sceneReady])

  useEffect(() => {
    const textureUrl = skyboxUrl || milkyWayMap
    if (!textureUrl) return
    const loader = new THREE.TextureLoader()

    loader.load(
      textureUrl,
      (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace
        loadedTexture.anisotropy = 4
        loadedTexture.minFilter = THREE.LinearMipmapLinearFilter
        loadedTexture.magFilter = THREE.LinearFilter
        setTexture(loadedTexture)
        if (onTextureLoadedRef.current) onTextureLoadedRef.current('milkyway')
      },
      undefined,
      (error) => {
        console.warn('Milky Way texture not found. Download from https://www.solarsystemscope.com/textures/')
        if (onTextureLoadedRef.current) onTextureLoadedRef.current('milkyway')
      }
    )
  }, [skyboxUrl])

  // Parallax rotation with Earth + intro zoom effect + fade-in animation
  useFrame(() => {
    if (meshRef.current && rotationRef?.current !== undefined) {
      // During intro, rotate faster for parallax depth effect
      const introProgress = introProgressRef?.current ?? 0
      const introMultiplier = introProgress < 1 ? 0.2 + (1 - introProgress) * 0.3 : 0.05
      meshRef.current.rotation.y = rotationRef.current * introMultiplier

      // Scroll-based subtle tilt - skybox moves even slower for deep space feel
      const scrollParallaxY = (scrollProgressRef?.current ?? 0) * SCROLL_STAR_PARALLAX_SPEED * 0.5
      meshRef.current.rotation.x = scrollParallaxY * 0.1
    }

    // Only start fade-in animation when scene is ready
    if (sceneReadyRef.current) {
      // Start fade timer on first frame after sceneReady
      if (fadeStartTimeRef.current === null) {
        // Debug logging removed for performance
        fadeStartTimeRef.current = performance.now()
      }

      const elapsed = performance.now() - fadeStartTimeRef.current
      const rawProgress = Math.min(1, elapsed / MILKYWAY_FADE_DURATION)

      const easedProgress = 1 - Math.pow(1 - rawProgress, 5)
      fadeProgressRef.current = easedProgress

      // Target brightness based on intro progress
      const currentIntroProgress = introProgressRef?.current ?? 0
      const targetBrightness = currentIntroProgress < 1 ? 0.4 + currentIntroProgress * 0.4 : 0.8

      const finalBrightness = targetBrightness * easedProgress
      uniforms.uBrightness.value = finalBrightness

      if (rawProgress < 0.1) {

      }
    }
  })

  if (!texture) return null

  return (
    <mesh ref={meshRef} scale={[-1, 1, 1]}>
      <sphereGeometry args={[100, 48, 48]} />
      <shaderMaterial
        ref={materialRef}
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform sampler2D uTexture;
          uniform float uBrightness;
          uniform float uSaturation;
          varying vec2 vUv;

          void main() {
            vec4 texColor = texture2D(uTexture, vUv);

            float gray = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
            vec3 desaturated = mix(vec3(gray), texColor.rgb, uSaturation);

            // Apply brightness (this handles fade-in from black)
            vec3 finalColor = desaturated * uBrightness;

            gl_FragColor = vec4(finalColor, 1.0);
          }
        `}
      />
    </mesh>
  )
}

// STARFIELD COMPONENT WITH STREAK EFFECT
// Fade-in duration for smooth appearance
const STARS_FADE_DURATION = 1800
const STARS_FADE_DELAY = 1800

function Starfield({ count = 2000, rotationRef, introProgressRef, zoomSpeedRef, scrollProgressRef, sceneReady }) {
  const pointsRef = useRef()
  const groupRef = useRef()
  const materialRef = useRef()
  const baseSizesRef = useRef()
  const basePositionsRef = useRef()
  const fadeStartTimeRef = useRef(null) // Start when sceneReady, not on mount
  const fadeProgressRef = useRef(0)
  const sceneReadyRef = useRef(sceneReady)

  // Memoize uniforms to prevent recreation on every render
  const uniforms = useMemo(() => ({
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    uFadeIn: { value: 0 }
  }), [])

  useEffect(() => {
    sceneReadyRef.current = sceneReady
    if (sceneReady) {
    }
  }, [sceneReady])

  // Generate star positions and sizes
  const { positions, sizes, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const radius = 50 + Math.random() * 50 // Distance from center
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = radius * Math.cos(phi)

      const sizeRandom = Math.random()
      if (sizeRandom > 0.99) {
        sizes[i] = 1 + Math.random() * 0.1 // Rare bright stars
      } else if (sizeRandom > 0.95) {
        sizes[i] = 1 + Math.random() * 0.1 // Medium-bright stars
      } else if (sizeRandom > 0.80) {
        sizes[i] = 1 + Math.random() * 0.1 // Medium stars
      } else {
        sizes[i] = 1 + Math.random() * 0.1 // Smaller stars
      }

      const colorVariation = Math.random()
      if (colorVariation > 0.9) {
        // Bluish stars
        colors[i * 3] = 0.8 + Math.random() * 0.2
        colors[i * 3 + 1] = 0.85 + Math.random() * 0.15
        colors[i * 3 + 2] = 1
      } else if (colorVariation > 0.8) {
        // Yellowish stars
        colors[i * 3] = 1
        colors[i * 3 + 1] = 0.95 + Math.random() * 0.05
        colors[i * 3 + 2] = 0.8 + Math.random() * 0.1
      } else {
        // White stars
        const brightness = 0.8 + Math.random() * 0.2
        colors[i * 3] = brightness
        colors[i * 3 + 1] = brightness
        colors[i * 3 + 2] = brightness
      }
    }

    // Store base sizes and positions for animations
    baseSizesRef.current = [...sizes]
    basePositionsRef.current = [...positions]

    return { positions, sizes, colors }
  }, [count])

  // Star animation, rotation, streak effect, and fade-in
  useFrame((state) => {
    if (groupRef.current && rotationRef?.current !== undefined) {
      // During intro, rotate faster for dramatic parallax
      const introProgress = introProgressRef?.current ?? 0
      const introMultiplier = introProgress < 1 ? 0.3 + (1 - introProgress) * 0.2 : 0.15
      groupRef.current.rotation.y = rotationRef.current * introMultiplier

      // Scroll-based vertical parallax - stars move slower than camera
      // This creates depth as Earth recedes
      const scrollParallaxY = (scrollProgressRef?.current ?? 0) * SCROLL_STAR_PARALLAX_SPEED * 2
      groupRef.current.position.y = -scrollParallaxY
    }

    // Animate fade-in - only start when sceneReady (use ref for current value)
    // Includes delay after Milky Way for parallax depth effect
    if (sceneReadyRef.current) {
      // Start fade timer on first frame after sceneReady
      if (fadeStartTimeRef.current === null) {
        // Add delay so stars appear AFTER Milky Way (creates depth)
        fadeStartTimeRef.current = performance.now() + STARS_FADE_DELAY

      }

      const now = performance.now()
      if (now >= fadeStartTimeRef.current) {
        const elapsed = now - fadeStartTimeRef.current
        const rawProgress = Math.min(1, elapsed / STARS_FADE_DURATION)

        const easedProgress = 1 - Math.pow(1 - rawProgress, 5)
        fadeProgressRef.current = easedProgress

        uniforms.uFadeIn.value = easedProgress

        if (rawProgress > 0 && rawProgress < 0.05) {

        }
      }
    }

    // Subtle twinkle + streak effect during initial intro zoom
    if (pointsRef.current && baseSizesRef.current && basePositionsRef.current) {
      const time = state.clock.elapsedTime
      const sizesAttr = pointsRef.current.geometry.attributes.size
      const posAttr = pointsRef.current.geometry.attributes.position

      // During intro, stretch stars towards camera for the "warp speed" feel
      const introProgress = introProgressRef?.current ?? 0
      const zoomSpeed = zoomSpeedRef?.current ?? 0
      const streakAmount = introProgress < 1 ? Math.pow(1 - introProgress, 1.5) * zoomSpeed * INTRO_STAR_STREAK_INTENSITY : 0

      const frameIndex = Math.floor(time * 60) % 2
      const startIdx = frameIndex === 0 ? 0 : Math.floor(count / 2)
      const endIdx = frameIndex === 0 ? Math.floor(count / 2) : count

      // Pre-compute intro values outside loop
      const introT = Math.max(0, 1 - introProgress)
      const introSizeBoost = introProgress < 1 ? 1 + introT * introT * 1.5 : 1

      for (let i = startIdx; i < endIdx; i++) {
        const twinklePhase = i * 0.137 + (i % 17) * 0.5
        const twinkleFrequency = 0.02 + (i % 13) * 0.005
        const twinkle = 0.85 + Math.sin(time * twinkleFrequency + twinklePhase) * 0.15

        sizesAttr.array[i] = baseSizesRef.current[i] * twinkle * introSizeBoost

        if (streakAmount > 0.005) {
          const baseZ = basePositionsRef.current[i * 3 + 2]
          const distanceFactor = Math.pow(Math.abs(baseZ) / 100, 0.7)
          posAttr.array[i * 3 + 2] = baseZ + streakAmount * distanceFactor * 3
        } else if (introProgress >= 1) {
          posAttr.array[i * 3 + 2] = basePositionsRef.current[i * 3 + 2]
        }
      }
      sizesAttr.needsUpdate = true
      if (streakAmount > 0.005 || introProgress < 1) posAttr.needsUpdate = true
    }
  })

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={count}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            count={count}
            array={sizes}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-color"
            count={count}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          transparent
          depthWrite={false}
          vertexColors
          uniforms={uniforms}
          vertexShader={`
            attribute float size;
            varying vec3 vColor;
            varying float vSize;
            uniform float uPixelRatio;

            void main() {
              vColor = color;
              vSize = size;
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = size * uPixelRatio * (500.0 / -mvPosition.z);
              gl_PointSize = clamp(gl_PointSize, 1.5, 4.0);  // Min 1.5, Max 4.0 pixels
              gl_Position = projectionMatrix * mvPosition;
            }
          `}
          fragmentShader={`
            uniform float uFadeIn;
            varying vec3 vColor;
            varying float vSize;

            void main() {
              vec2 center = gl_PointCoord - vec2(0.5);
              float dist = length(center);

              if (dist > 0.5) discard;

              float alpha = 1.0 - smoothstep(0.0, 0.5, dist);

              alpha = alpha * alpha;

              alpha = max(alpha, 0.1) * min(1.0, alpha * 2.0);

              alpha *= uFadeIn;

              gl_FragColor = vec4(vColor, alpha);
            }
          `}
        />
      </points>
    </group>
  )
}

// SUN FLARE COMPONENT
function SunFlare({ sunDirection, introProgressRef }) {
  const flareRef = useRef()
  const glowRef = useRef()
  const mainMatRef = useRef()
  const glowMatRef = useRef()
  const raysMatRef = useRef()

  // Position sun far away in the sun direction
  const sunPosition = useMemo(() => {
    return sunDirection.clone().multiplyScalar(50)
  }, [sunDirection])

  useFrame(({ camera }) => {
    // Make flare always face camera
    if (flareRef.current) {
      flareRef.current.lookAt(camera.position)
    }
    if (glowRef.current) {
      glowRef.current.lookAt(camera.position)
    }

    // Update opacity from ref
    const introProgress = introProgressRef?.current ?? 1
    const opacity = introProgress < 1 ? introProgress * 0.95 : 0.95
    if (mainMatRef.current) mainMatRef.current.opacity = opacity
    if (glowMatRef.current) glowMatRef.current.uniforms.uOpacity.value = opacity * 0.6
    if (raysMatRef.current) raysMatRef.current.uniforms.uOpacity.value = opacity * 0.3
  })

  return (
    <group position={sunPosition}>
      {/* Main sun disc */}
      <mesh ref={flareRef}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial
          ref={mainMatRef}
          color="#FFF8E7"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>

      {/* Outer glow */}
      <mesh ref={glowRef} scale={[3, 3, 1]}>
        <circleGeometry args={[1.5, 32]} />
        <shaderMaterial
          ref={glowMatRef}
          transparent
          depthWrite={false}
          uniforms={{
            uColor: { value: new THREE.Color('#FFF4D6') },
            uOpacity: { value: 0 }
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uOpacity;
            varying vec2 vUv;
            void main() {
              float dist = length(vUv - vec2(0.5)) * 2.0;
              float alpha = 1.0 - smoothstep(0.0, 1.0, dist);
              alpha = pow(alpha, 2.0) * uOpacity;
              gl_FragColor = vec4(uColor, alpha);
            }
          `}
        />
      </mesh>

      {/* Lens flare rays */}
      <mesh scale={[6, 6, 1]}>
        <circleGeometry args={[1, 6]} />
        <shaderMaterial
          ref={raysMatRef}
          transparent
          depthWrite={false}
          uniforms={{
            uColor: { value: new THREE.Color('#FFFAF0') },
            uOpacity: { value: 0 }
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform float uOpacity;
            varying vec2 vUv;
            void main() {
              vec2 center = vUv - vec2(0.5);
              float angle = atan(center.y, center.x);
              float dist = length(center) * 2.0;

              // Create 6-pointed star rays
              float rays = abs(sin(angle * 3.0));
              rays = pow(rays, 4.0);

              float alpha = (1.0 - dist) * rays * uOpacity;
              alpha = max(0.0, alpha);

              gl_FragColor = vec4(uColor, alpha);
            }
          `}
        />
      </mesh>
    </group>
  )
}

// CLOUD LAYER COMPONENT
const cloudVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    vUv = uv;
    vNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
    vPosition = modelPosition.xyz;
}
`

const cloudFragmentShader = `
uniform sampler2D uCloudTexture;
uniform vec3 uSunDirection;
uniform float uOpacity;
uniform float uZoomLevel;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec4 cloudColor = texture2D(uCloudTexture, vUv);

    // Fade clouds on night side
    float sunOrientation = dot(uSunDirection, normal);
    float dayMix = smoothstep(0.1, 0.5, sunOrientation);

    // ── Zoom-based fade: clear the center, keep the edges ──
    // Facing factor: 1.0 = directly facing camera, 0.0 = at the limb
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float facing = max(0.0, dot(normal, viewDir));

    float noisyFacing = facing;

    // Fade: clouds in center disappear, edges remain
    // Inner edge (0.85) = where clouds start to appear
    // Outer edge (0.92) = where clouds are fully visible
    float zoomMask = 1.0 - smoothstep(0.85, 0.92, noisyFacing) * uZoomLevel;

    // Also thin out clouds globally when zoomed (30% reduction at full zoom)
    float globalThin = 1.0 - uZoomLevel * 0.3;

    float alpha = pow(cloudColor.r, 0.7) * uOpacity * dayMix * zoomMask * globalThin;

    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
}
`

function CloudLayer({ sunDirection, earthOpacityRef, zoomLevelRef, cloudTextureRef, onRotationUpdate }) {
  const cloudRef = useRef()
  const currentOpacity = useRef(0)
  const hasTextureRef = useRef(false)

  // Cloud rotation offset - creates subtle drift relative to Earth
  const cloudRotationOffset = useRef(0)

  // Cloud drift speed (radians per second)
  // Positive = eastward drift (clouds move faster than Earth)
  const CLOUD_DRIFT_SPEED = 0.008

  // CLOUD ANIMATION: Opacity + Rotation + Texture Hot-Swap
  useFrame((state, delta) => {
    if (!cloudRef.current) return

    const tex = cloudTextureRef?.current?.value
    if (tex && !hasTextureRef.current) {
      cloudRef.current.material.uniforms.uCloudTexture.value = tex
      hasTextureRef.current = true
    }

    // Animate cloud drift
    cloudRotationOffset.current += CLOUD_DRIFT_SPEED * delta
    cloudRef.current.rotation.y = cloudRotationOffset.current

    if (onRotationUpdate) {
      onRotationUpdate(cloudRotationOffset.current)
    }

    if (cloudRef.current.material.uniforms) {
      const earthOp = earthOpacityRef?.current?.value ?? 1
      const targetOpacity = !hasTextureRef.current ? 0 : earthOp
      const diff = targetOpacity - currentOpacity.current
      const absDiff = Math.abs(diff)
      const lerpSpeed = 5.0
      const step = diff * Math.min(delta * lerpSpeed, 0.15)

      currentOpacity.current += step
      currentOpacity.current = Math.max(0, Math.min(1, currentOpacity.current))

      if (absDiff < 0.01) {
        currentOpacity.current = targetOpacity
      }

      cloudRef.current.material.uniforms.uOpacity.value = currentOpacity.current

      // Pass zoom level to shader for the fade effect
      const zoom = zoomLevelRef?.current?.value ?? 0
      cloudRef.current.material.uniforms.uZoomLevel.value = zoom
    }
  })

  // Cloud shader uniforms — starts with null texture, filled by useFrame when ready
  const cloudUniforms = useMemo(() => ({
    uCloudTexture: { value: null },
    uSunDirection: { value: sunDirection },
    uOpacity: { value: 0 },
    uZoomLevel: { value: 0 }
  }), [sunDirection])

  return (
    <mesh ref={cloudRef} scale={[1.001, 1.001, 1.001]}>
      <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
      <shaderMaterial
        vertexShader={cloudVertexShader}
        fragmentShader={cloudFragmentShader}
        uniforms={cloudUniforms}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

// COORDINATE CONVERSION
function latLonToVector3(lat, lon, radius = EARTH_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)

  const x = -radius * Math.sin(phi) * Math.cos(theta)
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.sin(theta)

  return new THREE.Vector3(x, y, z)
}

// EARTH SHADERS
const earthVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vViewDirection;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    vec3 modelNormal = (modelMatrix * vec4(normal, 0.0)).xyz;

    vUv = uv;
    vNormal = modelNormal;
    vPosition = modelPosition.xyz;
    vViewDirection = normalize(cameraPosition - modelPosition.xyz);
}
`

// EARTH SHADER
const earthFragmentShader = `
uniform sampler2D uDayTexture;
uniform sampler2D uNormalMap;
uniform sampler2D uSpecularMap;
uniform sampler2D uCloudTexture;
uniform float uCloudRotation;
uniform float uHasCloudShadows;
uniform vec3 uSunDirection;
uniform vec3 uAtmosphereDayColor;
uniform vec3 uAtmosphereTwilightColor;
uniform float uOpacity;
uniform float uZoomLevel;  // 0 = zoomed out, 1 = zoomed in
uniform vec3 uLightOceanColor;
uniform vec3 uDeepOceanColor;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vViewDirection;

// Helper to boost saturation
vec3 adjustSaturation(vec3 color, float saturation) {
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(vec3(gray), color, saturation);
}

// Helper to boost contrast
vec3 adjustContrast(vec3 color, float contrast) {
    return (color - 0.5) * contrast + 0.5;
}

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                        0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                        -0.577350269189626, // -1.0 + 2.0 * C.x
                        0.024390243902439); // 1.0 / 41.0

    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);

    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;

    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;

    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;

    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

// Fractal Brownian Motion using simplex noise
float fbmSimplex(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    // Rotation matrix to reduce axis-aligned artifacts
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);

    // Octave 1
    value += amplitude * snoise(p);
    p = rot * p;

    // Octave 2
    value += (amplitude * 0.5) * snoise(p * 2.0);

    return value;
}

// Generate procedural bump/detail normal
vec3 proceduralDetailNormal(vec2 uv, float intensity) {
    // Single detail scale instead of two
    float scale = 60.0;

    // Forward differences (3 samples instead of 5)
    float eps = 0.001;

    float hC = fbmSimplex(uv * scale);
    float hR = fbmSimplex((uv + vec2(eps, 0.0)) * scale);
    float hU = fbmSimplex((uv + vec2(0.0, eps)) * scale);

    // Normal from height differences
    vec3 detailNormal = normalize(vec3(
        (hC - hR) * intensity,
        (hC - hU) * intensity,
        1.0
    ));

    return detailNormal;
}

void main() {
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    vec3 normal = normalize(vNormal);

    // Sample day texture
    vec3 color = texture2D(uDayTexture, vUv).rgb;

    // SPECULAR MAP - Ocean vs Land detection
    float specularStrength = texture2D(uSpecularMap, vUv).r;
    float isOcean = specularStrength;
    float isLand = 1.0 - isOcean;

    // SUN ORIENTATION
    float sunOrientation = dot(uSunDirection, normal);
    float dayMix = smoothstep(-0.05, 0.4, sunOrientation);

    // Direct sunlight intensity (0 = shadow, 1 = direct sun)
    float sunIntensity = smoothstep(0.0, 0.6, sunOrientation);

    // Very direct sunlight (for peak effects)
    float directSun = smoothstep(0.3, 0.8, sunOrientation);

    // NORMAL MAP - SUN-DEPENDENT INTENSITY
    vec3 normalMapValue = texture2D(uNormalMap, vUv).rgb * 2.0 - 1.0;

    float normalStrength = 0.005 + sunIntensity * 0.035;

    // Land gets moderate normal influence
    // Ocean gets STRONGER normal influence in sunlight
    float landNormalMult = 1.0 + sunIntensity * 0.2;
    float oceanNormalMult = 1.0 + sunIntensity * 0.8;
    normalStrength *= mix(oceanNormalMult, landNormalMult, isLand);

    //When zoomed in, increase detail significantly
    float zoomBoost = 1.0 + uZoomLevel * 1.5;
    normalStrength *= zoomBoost;

    // Apply base normal map
    vec3 perturbedNormal = normal + normalMapValue * normalStrength;

    // PROCEDURAL DETAIL (adds texture to both land and ocean)
    float detailIntensity = sunIntensity * (0.01 + uZoomLevel * 0.05);

    // Ocean gets visible waves even when zoomed out
    float oceanBaseWaves = isOcean * sunIntensity * 0.20;
    float effectiveDetailIntensity = max(detailIntensity, oceanBaseWaves);

    // Higher threshold to skip more fragments + skip entirely on night side
    if (effectiveDetailIntensity > 0.02 && dayMix > 0.1) {
        vec3 detailNormal = proceduralDetailNormal(vUv, 0.8 + uZoomLevel * 1.0);

        // Apply more detail to ocean, less to land
        float detailStrength = mix(0.2, 0.03, isLand) * effectiveDetailIntensity;
        perturbedNormal.xy += detailNormal.xy * detailStrength;
    }

    normal = normalize(perturbedNormal);

    // CLOUD SHADOWS - Subtle terrain darkening
    float cloudShadow = 0.0;
    if (uHasCloudShadows > 0.5) {
        vec2 cloudUv = vUv;
        cloudUv.x = fract(cloudUv.x - uCloudRotation / (2.0 * 3.14159));

        vec2 shadowOffset = vec2(
            -uSunDirection.x * 0.008,
            -uSunDirection.y * 0.004
        );

        vec2 shadowUv = fract(cloudUv + shadowOffset);
        float cloudDensity = texture2D(uCloudTexture, shadowUv).r;

        cloudShadow = cloudDensity * 0.1;
        cloudShadow *= smoothstep(-0.1, 0.3, sunOrientation);
        cloudShadow *= (1.0 - isOcean * 0.5);
    }

    // DIFFUSE LIGHTING - Sun-dependent brightness
    // Subtle brightness variation - not too dramatic
    float diffuse = 0.85 + sunIntensity * 0.15;

    // OCEAN COLOR - Adjustable blue tones
    // These vec3 values change ocean color:
    // Higher values = lighter/brighter, Lower values = darker

    vec3 lightOceanColor = uLightOceanColor;
    vec3 deepOceanColor = uDeepOceanColor;

    float oceanDepth = 1.0 - smoothstep(0.0, 0.3, (color.r + color.g + color.b) / 3.0);
    vec3 oceanColor = mix(lightOceanColor, deepOceanColor, oceanDepth * 0.5);

    // Subtle sunlit ocean boost
    vec3 sunlitOceanBoost = vec3(1.05, 1.1, 1.15);
    oceanColor = oceanColor * mix(vec3(1.0), sunlitOceanBoost, sunIntensity * 0.5);

    color = mix(color, oceanColor, isOcean * 0.95);

    // DIFFUSE LIGHTING
    color = color * diffuse;

    // CLOUD SHADOWS
    color = color * (1.0 - cloudShadow);

    // DAY/NIGHT TRANSITION
    vec3 nightColor = vec3(0.0);
    color = mix(nightColor, color, dayMix);

    // SPECULAR - VARIABLE ROUGHNESS
    vec3 reflectDir = reflect(-uSunDirection, normal);
    float NdotV = max(dot(vViewDirection, reflectDir), 0.0);

    // Roughness values (lower = sharper specular)
    // Ocean: 0.25 roughness = sharp, focused glare
    // Land: 0.45 roughness = soft, diffuse highlight
    float oceanRoughness = 0.15;
    float landRoughness = 0.45;
    float roughness = mix(oceanRoughness, landRoughness, isLand);

    // Convert roughness to specular power
    // Lower roughness = higher power = sharper highlight
    float specPowerCore = mix(1000.0, 800.0, roughness);
    float specPowerInner = mix(250.0, 400.0, roughness);
    float specPowerMid = mix(60.0, 150.0, roughness);
    float specPowerSoft = mix(20.0, 40.0, roughness);

    // Calculate specular layers
    float specCore = pow(NdotV, specPowerCore);
    float specInner = pow(NdotV, specPowerInner);
    float specMid = pow(NdotV, specPowerMid);
    float specSoft = pow(NdotV, specPowerSoft);

    // Only show specular on day side
    float specMask = smoothstep(-0.1, 0.3, sunOrientation);

    // Ocean gets strong specular, land gets subtle specular
    // Land specular reveals micro-terrain detail!
    float oceanSpecStrength = isOcean * 1.0;
    float landSpecStrength = isLand * 0.25; // Subtle but visible
    float specStrength = oceanSpecStrength + landSpecStrength;

    // Combine specular layers
    vec3 specColor = vec3(0.0);
    specColor += vec3(1.0, 1.0, 1.0) * specCore * 1.5 * specStrength;
    specColor += vec3(1.0, 0.99, 0.97) * specInner * 0.8 * specStrength;
    specColor += vec3(1.0, 0.97, 0.93) * specMid * 0.3 * specStrength;
    specColor += vec3(1.0, 0.95, 0.88) * specSoft * 0.12 * specStrength;

    color += specColor * specMask;

    // ATMOSPHERIC SCATTERING ON EARTH SURFACE
    // Realistic haze - blue-tinted, concentrated toward limb, ocean stays visible
    float edgeView = 1.0 - max(0.0, dot(vViewDirection, normal));

    // Multiple layers - much lighter in center, building toward edge
    // Layer 1: Very subtle global tint (barely visible in center)
    float globalHaze = pow(edgeView, 1.2) * 0.03;

    // Layer 2: Medium haze approaching the limb
    float mediumHaze = pow(edgeView, 2.0) * 0.12;

    // Layer 3: Strong haze band near limb
    float strongHaze = pow(edgeView, 3.0) * 0.25;

    // Layer 4: Bright limb concentration
    float limbHaze = pow(edgeView, 4.5) * 0.35;

    // Layer 5: Intense limb glow at very edge
    float limbGlow = pow(edgeView, 6.0) * 0.25;

    // Lit side mask
    float atmosLitSide = smoothstep(-0.15, 0.5, sunOrientation);

    // Twilight zone gets warmer atmospheric color - wider band for visibility
    float twilightMask = smoothstep(-0.2, 0.05, sunOrientation) * (1.0 - smoothstep(0.05, 0.55, sunOrientation));

    // Color gradient: light blue (center) → sky blue (mid) → deep blue (edge)
    // Bluer overall - less white, more atmospheric
    vec3 hazeLightBlue = vec3(0.45, 0.65, 1.0);    // Light blue tint
    vec3 hazeSkyBlue = vec3(0.35, 0.55, 0.95);      // Sky blue
    vec3 hazeDeepBlue = uAtmosphereDayColor;         // Deep atmospheric blue at limb
    vec3 hazeTwilight = uAtmosphereTwilightColor * 0.65;

    // Blend colors - stays blue throughout, deepens at edge
    vec3 hazeColor = mix(hazeLightBlue, hazeSkyBlue, smoothstep(0.2, 0.55, edgeView));
    hazeColor = mix(hazeColor, hazeDeepBlue, smoothstep(0.5, 0.85, edgeView));

    // Add warm twilight tint where day meets night
    hazeColor = mix(hazeColor, hazeTwilight, twilightMask * 0.5);

    // Combine all layers
    float totalHaze = (globalHaze + mediumHaze + strongHaze + limbHaze + limbGlow) * atmosLitSide;

    // Reduce haze when zoomed in (surface detail should be clearer up close)
    totalHaze *= mix(1.0, 0.35, uZoomLevel);

    // Apply atmospheric haze
    color = mix(color, hazeColor, min(totalHaze, 0.85));

    gl_FragColor = vec4(color, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`

const atmosphereVertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    vNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
    vPosition = modelPosition.xyz;
}
`

const atmosphereFragmentShader = `
uniform vec3 uSunDirection;
uniform vec3 uAtmosphereDayColor;
uniform vec3 uAtmosphereTwilightColor;
uniform float uOpacity;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDirection = normalize(vPosition - cameraPosition);

    float edgeFactor = dot(viewDirection, normal);

    // Wide atmospheric glow - extends well beyond Earth's surface
    float innerRim = smoothstep(0.0, -0.35, edgeFactor) * 0.7;
    float midRim = smoothstep(-0.05, -0.50, edgeFactor) * 1.0;
    float outerRim = smoothstep(-0.15, -0.65, edgeFactor) * 0.6;

    float outerFalloff = 1.0 - smoothstep(-0.60, -1.0, edgeFactor);

    float alpha = (innerRim + midRim + outerRim) * 0.35 * outerFalloff;

    float sunOrientation = dot(uSunDirection, normal);
    float dayMix = smoothstep(-0.3, 0.35, sunOrientation);
    float twilightMix = smoothstep(-0.35, 0.0, sunOrientation) * (1.0 - smoothstep(0.0, 0.45, sunOrientation));

    vec3 innerColor = vec3(0.42, 0.62, 1.0);
    vec3 outerColor = uAtmosphereDayColor * 1.15;
    vec3 twilightColor = uAtmosphereTwilightColor * 0.7;

    float edgeDepth = smoothstep(-0.05, -0.5, edgeFactor);
    vec3 atmosColor = mix(innerColor, outerColor, edgeDepth);
    atmosColor = mix(atmosColor, twilightColor, twilightMix * 0.55);

    alpha *= dayMix;
    alpha *= uOpacity;

    gl_FragColor = vec4(atmosColor, alpha);
}
`

// OUTER HAZE RING - FrontSide rendered, visible extending beyond Earth's edge
const atmosphereHazeFragmentShader = `
uniform vec3 uSunDirection;
uniform vec3 uAtmosphereDayColor;
uniform vec3 uAtmosphereTwilightColor;
uniform float uOpacity;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDirection = normalize(cameraPosition - vPosition);

    // Facing factor: 1.0 = facing camera, 0.0 = edge/rim
    float facing = max(0.0, dot(viewDirection, normal));

    // Inner cutoff - hide center so Earth shows through cleanly
    float innerMask = 1.0 - smoothstep(0.08, 0.35, facing);

    // Outer fade - very gradual, no hard line
    // Multiple overlapping fades prevent any single visible edge
    float outerFade1 = smoothstep(0.0, 0.12, facing);   // Outermost fade
    float outerFade2 = smoothstep(0.0, 0.06, facing);   // Even softer outer
    float outerFade = outerFade1 * 0.6 + outerFade2 * 0.4;

    // Intensity peaks near the inner edge (close to Earth) and falls off outward
    float peakGlow = smoothstep(0.03, 0.18, facing) * (1.0 - smoothstep(0.18, 0.38, facing));
    float softHaze = smoothstep(0.01, 0.10, facing) * (1.0 - smoothstep(0.10, 0.32, facing));

    float alpha = (peakGlow * 0.5 + softHaze * 0.3) * innerMask * outerFade;

    // Sun orientation
    float sunOrientation = dot(uSunDirection, normal);
    float dayMix = smoothstep(-0.3, 0.3, sunOrientation);
    float twilightMix = smoothstep(-0.35, -0.05, sunOrientation) * (1.0 - smoothstep(-0.05, 0.4, sunOrientation));

    // Blue haze, warmer at twilight
    vec3 hazeColor = mix(vec3(0.45, 0.65, 1.0), uAtmosphereDayColor, 0.4);
    vec3 twilightColor = uAtmosphereTwilightColor * 0.6;
    hazeColor = mix(hazeColor, twilightColor, twilightMix * 0.5);

    alpha *= dayMix * 0.8;
    alpha *= uOpacity;

    gl_FragColor = vec4(hazeColor, alpha);
}
`

// STATE MESH ON SPHERE
function createSphericalStateMesh(coordinates, radius = EARTH_RADIUS) {
  const allGeometries = []

  const processRing = (ring) => {
    if (ring.length < 3) return null

    const points3D = ring.map(([lon, lat]) => {
      return latLonToVector3(lat, lon, radius + STATE_ELEVATION)
    })

    const shape = new THREE.Shape()

    const center = new THREE.Vector3()
    points3D.forEach(p => center.add(p))
    center.divideScalar(points3D.length)

    const normal = center.clone().normalize()
    const tangent = new THREE.Vector3(0, 1, 0).cross(normal).normalize()
    if (tangent.length() < 0.1) {
      tangent.set(1, 0, 0).cross(normal).normalize()
    }
    const bitangent = normal.clone().cross(tangent).normalize()

    const points2D = points3D.map(p => {
      const local = p.clone().sub(center)
      return new THREE.Vector2(
        local.dot(tangent),
        local.dot(bitangent)
      )
    })

    shape.moveTo(points2D[0].x, points2D[0].y)
    for (let i = 1; i < points2D.length; i++) {
      shape.lineTo(points2D[i].x, points2D[i].y)
    }
    shape.closePath()

    // OPTIMIZED TESSELLATION: 24 segments (balanced quality vs performance)
    const shapeGeometry = new THREE.ShapeGeometry(shape, 24)

    const positions = shapeGeometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x2d = positions.getX(i)
      const y2d = positions.getY(i)

      const point3D = center.clone()
        .add(tangent.clone().multiplyScalar(x2d))
        .add(bitangent.clone().multiplyScalar(y2d))

      point3D.normalize().multiplyScalar(radius + STATE_ELEVATION)

      positions.setXYZ(i, point3D.x, point3D.y, point3D.z)
    }

    positions.needsUpdate = true
    shapeGeometry.computeVertexNormals()

    return shapeGeometry
  }

  if (coordinates[0] && typeof coordinates[0][0] === 'number') {
    const geo = processRing(coordinates)
    if (geo) allGeometries.push(geo)
  } else if (coordinates[0] && coordinates[0][0] && typeof coordinates[0][0][0] === 'number') {
    coordinates.forEach(ring => {
      const geo = processRing(ring)
      if (geo) allGeometries.push(geo)
    })
  } else {
    coordinates.forEach(polygon => {
      if (polygon[0]) {
        const geo = processRing(polygon[0])
        if (geo) allGeometries.push(geo)
      }
    })
  }

  if (allGeometries.length === 0) return null
  if (allGeometries.length === 1) return allGeometries[0]

  return mergeGeometries(allGeometries)
}

function mergeGeometries(geometries) {
  const totalVertices = geometries.reduce((sum, g) => sum + g.attributes.position.count, 0)
  const mergedPositions = new Float32Array(totalVertices * 3)
  const mergedNormals = new Float32Array(totalVertices * 3)
  const mergedIndices = []
  let vertexOffset = 0
  let positionOffset = 0

  geometries.forEach(geo => {
    const pos = geo.attributes.position.array
    const norm = geo.attributes.normal?.array || new Float32Array(pos.length)
    mergedPositions.set(pos, positionOffset)
    mergedNormals.set(norm, positionOffset)
    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) {
        mergedIndices.push(geo.index.array[i] + vertexOffset)
      }
    }
    vertexOffset += geo.attributes.position.count
    positionOffset += pos.length
  })

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3))
  if (mergedIndices.length > 0) merged.setIndex(mergedIndices)
  return merged
}

function createSphericalOutline(coordinates, radius = EARTH_RADIUS) {
  const allLines = []

  // Helper: Spherical linear interpolation between two lat/lon points
  const interpolateGreatCircle = (lat1, lon1, lat2, lon2, numPoints) => {
    const points = []

    // Convert to radians
    const phi1 = lat1 * Math.PI / 180
    const lambda1 = lon1 * Math.PI / 180
    const phi2 = lat2 * Math.PI / 180
    const lambda2 = lon2 * Math.PI / 180

    // Calculate angular distance
    const d = Math.acos(
      Math.sin(phi1) * Math.sin(phi2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1)
    )

    // If points are very close, just use linear interpolation
    if (d < 0.001 || isNaN(d)) {
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints
        points.push([
          lon1 + (lon2 - lon1) * t,
          lat1 + (lat2 - lat1) * t
        ])
      }
      return points
    }

    // Great circle interpolation
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints
      const A = Math.sin((1 - t) * d) / Math.sin(d)
      const B = Math.sin(t * d) / Math.sin(d)

      const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2)
      const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2)
      const z = A * Math.sin(phi1) + B * Math.sin(phi2)

      const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI
      const lon = Math.atan2(y, x) * 180 / Math.PI

      points.push([lon, lat])
    }

    return points
  }

  const processRing = (ring) => {
    const interpolatedPoints = []

    // Interpolate additional points between each pair for smoother curves
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i]
      const [lon2, lat2] = ring[i + 1]

      // Calculate distance to determine interpolation count
      const dist = Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2))

      // More interpolation for longer segments (smoother curves)
      const numInterpolations = Math.max(1, Math.min(8, Math.floor(dist / 0.5)))

      const interpPoints = interpolateGreatCircle(lat1, lon1, lat2, lon2, numInterpolations)

      // Add all but the last point (to avoid duplicates)
      for (let j = 0; j < interpPoints.length - 1; j++) {
        interpolatedPoints.push(interpPoints[j])
      }
    }

    // Add the final point
    if (ring.length > 0) {
      interpolatedPoints.push(ring[ring.length - 1])
    }

    // Convert to 3D vectors
    const points = interpolatedPoints.map(([lon, lat]) => {
      return latLonToVector3(lat, lon, radius + STATE_ELEVATION + 0.002)
    })

    return points
  }

  if (coordinates[0] && typeof coordinates[0][0] === 'number') {
    allLines.push(processRing(coordinates))
  } else if (coordinates[0] && coordinates[0][0] && typeof coordinates[0][0][0] === 'number') {
    coordinates.forEach(ring => {
      allLines.push(processRing(ring))
    })
  } else {
    coordinates.forEach(polygon => {
      if (polygon[0]) {
        allLines.push(processRing(polygon[0]))
      }
    })
  }

  return allLines
}

// STATE COMPONENT WITH RISK COLORING
const SphericalState = React.memo(function SphericalState({ feature, isHovered, isSelected, onSelect, onHover, onHoverChange, isAnimating, canvasRef, introComplete, statesOpacityRef, heatmapColor }) {
  const meshRef = useRef()
  const materialRef = useRef()
  const outlineMaterialRefs = useRef([])
  const [geometry, setGeometry] = useState(null)
  const [outlines, setOutlines] = useState([])

  const lerpTarget = useMemo(() => new THREE.Vector3(), [])

  const stateName = feature.properties?.name || `State ${feature.id}`

  // Get risk level for this state
  const riskLevel = STATE_RISK_LEVELS[stateName] || 'Unknown'
  const riskConfig = heatmapColor || RISK_COLORS[riskLevel]

  useEffect(() => {
    if (!feature.geometry) return

    const coords = feature.geometry.coordinates
    const geo = createSphericalStateMesh(coords)
    const lines = createSphericalOutline(coords)

    if (geo) setGeometry(geo)
    if (lines.length) setOutlines(lines)
  }, [feature])

  const outlineGeometries = useMemo(() => {
    return outlines.map(points => new THREE.BufferGeometry().setFromPoints(points))
  }, [outlines])

  useFrame((state, delta) => {
    if (meshRef.current) {
      const targetScale = isSelected ? 1.02 : isHovered ? 1.01 : 1
      lerpTarget.set(targetScale, targetScale, targetScale)
      meshRef.current.scale.lerp(lerpTarget, delta * 5)
    }
    // Update material opacity from ref (avoids re-renders)
    const statesOpacity = statesOpacityRef?.current ?? 1
    if (materialRef.current) {
      const riskCfg = isSelected ? riskConfig.selected : isHovered ? riskConfig.hover : riskConfig.default
      const baseOpacity = isSelected ? riskCfg.opacity : isHovered ? riskCfg.opacity : riskCfg.opacity + 0.25
      materialRef.current.opacity = baseOpacity * statesOpacity
    }
    // Update outline materials from ref too (they don't re-render on ref changes)
    const targetOutlineOpacity = (isSelected ? 1 : isHovered ? 0.9 : 0.3) * statesOpacity
    for (const mat of outlineMaterialRefs.current) {
      if (mat) mat.opacity = targetOutlineOpacity
    }
  })

  if (!geometry) return null

  // RISK-BASED COLORING FOR ALL STATES
  let baseColor
  let baseOpacity
  let outlineColor
  let outlineOpacity

  if (isSelected) {
    baseColor = riskConfig.selected.color
    baseOpacity = riskConfig.selected.opacity
    outlineColor = riskConfig.selected.color
    outlineOpacity = 1
  } else if (isHovered) {
    baseColor = riskConfig.hover.color
    baseOpacity = riskConfig.hover.opacity
    outlineColor = riskConfig.hover.color
    outlineOpacity = 0.9
  } else {
    baseColor = riskConfig.default.color
    baseOpacity = riskConfig.default.opacity + 0.25
    outlineColor = '#ffffff'
    outlineOpacity = 0.3
  }

  // Apply statesOpacity fade-in multiplier from ref
  const statesOpacity = statesOpacityRef?.current ?? 1
  const finalOpacity = baseOpacity * statesOpacity
  const finalOutlineOpacity = outlineOpacity * statesOpacity

  return (
    <group ref={meshRef}>
      <mesh
        geometry={geometry}
        onClick={(e) => {
          e.stopPropagation()
          if (!isAnimating && introComplete) onSelect(stateName)
        }}
        onPointerEnter={(e) => {
          e.stopPropagation()
          if (!isAnimating && introComplete) {
            onHover(stateName)
            onHoverChange(true)
            if (canvasRef?.current) {
              canvasRef.current.style.cursor = 'pointer'
            }
          }
        }}
        onPointerLeave={() => {
          onHover(null)
          onHoverChange(false)
          if (canvasRef?.current) {
            canvasRef.current.style.cursor = 'grab'
          }
        }}
      >
        <meshStandardMaterial
          ref={materialRef}
          color={baseColor}
          transparent
          opacity={finalOpacity}
          roughness={0.7}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Memoized geometries instead of creating new ones each render */}
      {outlineGeometries.map((geo, i) => (
        <line key={i} geometry={geo}>
          <lineBasicMaterial
            ref={el => { outlineMaterialRefs.current[i] = el }}
            color={outlineColor}
            transparent
            opacity={finalOutlineOpacity}
            linewidth={2}
          />
        </line>
      ))}
    </group>
  )
})

// ============================================
// ============================================
// SCROLL-BASED PARALLAX SETTINGS
// ============================================
const SCROLL_MAX_CAMERA_DISTANCE = 18 // How far camera pulls back when scrolled
const SCROLL_STAR_PARALLAX_SPEED = 0.4 // Stars move slower than camera (depth effect)
const SCROLL_ROTATION_SPEED = 1.6 // How much Earth rotates per scroll unit (radians)

// Smooth scroll interpolation settings
const SCROLL_CAMERA_SPEED = 5.0  // Exponential smooth speed for camera (lower = more floaty)
const SCROLL_ROTATION_SMOOTH = 3.5 // How quickly scroll rotation catches up

// Frame-rate independent exponential smoothing
// Produces identical results at 30fps, 60fps, 144fps â€” no jitter
const expSmooth = (current, target, speed, dt) => {
  return current + (target - current) * (1 - Math.exp(-speed * dt))
}

// Shortest angular distance (handles wrapping around 2Ï€)
const shortAngleDist = (from, to) => {
  const diff = ((to - from) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI
  return diff
}

// Easing function for scroll-based camera distance (makes beginning/end smoother)
const easeScrollCamera = (t) => {
  // Custom ease-in-out curve for natural camera movement
  // Slow start, smooth middle, gentle end
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2
}

// MAIN COMPONENT
export default function EarthWithStates({ scrollTargetRef }) {
  const earthRef = useRef()
  const earthGroupRef = useRef()
  const controlsRef = useRef()
  const canvasRef = useRef()
  const starRotationRef = useRef(US_CENTER_ROTATION_Y) // Track rotation for starfield
  const prevScrollProgressRef = useRef(0) // Track previous scroll for rotation delta

  // Smooth scroll refs for buttery 3D animations
  // Single-pass exponential smoothing â€” no React re-renders in the scroll path
  const smoothScrollProgressRef = useRef(0) // Smoothed 0â†’1 scroll (shared with children)
  const smoothCameraDistanceRef = useRef(DEFAULT_CAMERA_DISTANCE)
  const smoothScrollRotationRef = useRef(0) // Accumulated rotation from scrolling
  const smoothStarParallaxRef = useRef(0) // Star parallax offset
  const smoothScrollYOffsetRef = useRef(0) // Camera Y offset from scroll

  const { camera, gl } = useThree()

  // Responsive viewport scaling — tracks window size for mobile camera adjustment
  const viewportScaleRef = useRef(getViewportCameraScale())

  useEffect(() => {
    const handleResize = () => {
      viewportScaleRef.current = getViewportCameraScale()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Store canvas element ref
  useEffect(() => {
    canvasRef.current = gl.domElement
  }, [gl])

  const [statesData, setStatesData] = useState([])
  const [loading, setLoading] = useState(true)

  // INTRO ANIMATION STATE
  // Only use React state for values that trigger conditional rendering
  const introProgressRef = useRef(0)
  const [introComplete, setIntroComplete] = useState(false)

  // Lock scrolling during intro animation to prevent scroll position
  // from building up and causing camera misalignment when animation ends
  useEffect(() => {
    if (introComplete) return

    const prevent = (e) => { e.preventDefault() }
    // Block all scroll-related events during intro
    window.addEventListener('wheel', prevent, { passive: false })
    window.addEventListener('touchmove', prevent, { passive: false })
    window.addEventListener('scroll', prevent, { passive: false })
    // Also pin position
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    document.body.style.top = '0'

    return () => {
      window.removeEventListener('wheel', prevent)
      window.removeEventListener('touchmove', prevent)
      window.removeEventListener('scroll', prevent)
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      window.scrollTo(0, 0)
    }
  }, [introComplete])
  const [statesVisible, setStatesVisible] = useState(false) // Triggers state mesh mounting
  const zoomSpeedRef = useRef(0)
  const [earthOpacity, setEarthOpacity] = useState(0) // Kept as state for conditional checks
  const statesOpacityRef = useRef(0)
  const introStartTime = useRef(null)

  // Store state
  const selectedState = useStore(state => state.selectedState)
  const hoveredState = useStore(state => state.hoveredState)
  const selectState = useStore(state => state.selectState)
  const pendingStateZoom = useStore(state => state.pendingStateZoom)
  const clearPendingZoom = useStore(state => state.clearPendingZoom)
  const setHoveredState = useStore(state => state.setHoveredState)
  const viewMode = useStore(state => state.viewMode)
  const isCountyView = viewMode === 'state-counties'
  const settings = useStore(state => state.settings) || {
    earthTexture: 'daymap6',
    skyboxTexture: 'default',
    oceanPreset: 'default',
    cloudsEnabled: true,
    autoRotate: true,
  }
  const activeEarthTextureRef = useRef(INITIAL_EARTH_TEXTURE_KEY)

  // Heatmap mode
  const heatmapEnabled = useStore(state => state.heatmapEnabled)
  const heatmapMetric = useStore(state => state.heatmapMetric)
  const storeStateData = useStore(state => state.stateData)

  // Compute heatmap colors for all states
  const heatmapColors = useMemo(() => {
    if (!heatmapEnabled) return null
    const colors = {}
    const airMap = { 'Good': 85, 'Moderate': 60, 'Poor': 35, 'Unhealthy': 15 }
    // Determine if higher = better or worse
    const invertMetrics = { riskScore: true } // higher risk = worse
    const isInverted = invertMetrics[heatmapMetric]

    Object.entries(storeStateData).forEach(([name, data]) => {
      let value
      if (heatmapMetric === 'airQuality') {
        value = airMap[data.airQuality] || 50
      } else {
        value = data[heatmapMetric] ?? 50
      }
      // Normalize to 0-1 where 1 = good (green)
      let normalized = Math.max(0, Math.min(1, value / 100))
      if (isInverted) normalized = 1 - normalized

      // Color gradient: red (0) -> amber (0.5) -> green (1)
      let r, g, b
      if (normalized < 0.5) {
        const t = normalized / 0.5
        r = 0.95 - t * 0.35
        g = 0.25 + t * 0.50
        b = 0.15
      } else {
        const t = (normalized - 0.5) / 0.5
        r = 0.60 - t * 0.53
        g = 0.75 + t * 0.18
        b = 0.15 + t * 0.35
      }
      const hex = '#' + [r,g,b].map(c => Math.round(c*255).toString(16).padStart(2,'0')).join('')
      colors[name] = {
        default: { color: hex, opacity: 0.35 },
        hover: { color: hex, opacity: 0.6 },
        selected: { color: hex, opacity: 0.8 },
      }
    })
    return colors
  }, [heatmapEnabled, heatmapMetric, storeStateData])

  // Animation state refs (using refs to avoid re-renders during animation)
  const animationRef = useRef({
    // Is user currently dragging?
    isDragging: false,
    // Is user hovering over a state?
    isHoveringState: false,
    // When did user last interact?
    lastInteractionTime: 0,
    homingActive: false,
    lastHomingScrollTime: 0,
    // Current earth Y rotation
    currentRotationY: US_CENTER_ROTATION_Y,
    // Current earth X rotation (for latitude tilting)
    currentRotationX: 0,
    // X Rotation animation
    rotationXStart: 0,
    rotationXEnd: 0,
    // Momentum/velocity for smooth spin
    velocity: 0,
    lastMouseX: 0,
    lastMoveTime: 0,
    // Current camera distance
    cameraDistance: INTRO_START_DISTANCE, // Start far away for intro
    // Animation state
    isAnimating: false,
    animationStartTime: 0,
    animationDuration: 0,
    // Rotation animation
    rotationStart: 0,
    rotationEnd: 0,
    // Zoom animation
    zoomStart: 0,
    zoomEnd: 0,
    // Animation type for completion handling
    animationType: null, // 'focus-state' | 'zoom-out' | 'intro'
    // Earth scale for intro
    earthScale: INTRO_EARTH_SCALE_START,
    // Warmup: skip first frames to let shaders compile before timing starts
    warmupFramesRemaining: 3,
    // Delta-accumulated intro progress (immune to frame drops)
    introProgress: 0,
    // States fade-in animation
    statesFading: false,
    statesFadeStartTime: 0,
  })

  // For React state that needs re-render
  const [isAnimating, setIsAnimating] = useState(false)

  // TEXTURE PRELOADING SYSTEM
  // sceneReady gates the intro animation start
  // Only waits for milky way (the backdrop). Clouds are deferred until after intro.
  const [milkywayLoaded, setMilkywayLoaded] = useState(false)

  // Scene is ready when milky way backdrop is loaded (or timeout)
  const [sceneReady, setSceneReady] = useState(false)
  const sceneReadyTimeRef = useRef(null) // When scene became ready

  // Trigger sceneReady when milky way loads
  useEffect(() => {
    if (milkywayLoaded && !sceneReady) {
      const timer = setTimeout(() => {
        sceneReadyTimeRef.current = performance.now()
        setSceneReady(true)
      }, 100) // 100ms buffer for GPU to process texture
      return () => clearTimeout(timer)
    }
  }, [milkywayLoaded, sceneReady])

  // Fallback: if milky way takes too long, show scene anyway
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (!sceneReady) {
        sceneReadyTimeRef.current = performance.now()
        setSceneReady(true)
      }
    }, 2000)
    return () => clearTimeout(fallbackTimer)
  }, [sceneReady])

  // Callback for MilkyWaySkybox to report texture loaded
  const handleTextureLoaded = useCallback((textureName) => {
    if (textureName === 'milkyway') {
      setMilkywayLoaded(true)
    }
  }, [])

  // Cloud texture and rotation for shadows (texture loaded async, applied via ref)
  const cloudRotationRef = useRef(0)

  // ============================================
  // PROGRESSIVE TEXTURE LOADING SYSTEM
  // ============================================
  // Phase 1 (blocking): Day map only â€” the essential visual
  // Phase 2 (async, during intro): Normal + Specular maps
  // Phase 3 (async, after intro): Cloud texture
  //
  // Fallback textures let the shader run correctly before real textures arrive:
  //   - Flat normal (128,128,255) = no bump perturbation
  //   - Black specular (0,0,0) = everything treated as land (no ocean glare)
  // ============================================

  // Create 1x1 fallback textures (created once, reused)
  const fallbackTextures = useMemo(() => {
    // Flat normal map: rgb(128, 128, 255) â†’ normal (0, 0, 1) = no perturbation
    const normalData = new Uint8Array([128, 128, 255, 255])
    const flatNormal = new THREE.DataTexture(normalData, 1, 1, THREE.RGBAFormat)
    flatNormal.needsUpdate = true

    // Black specular: rgb(0, 0, 0) â†’ specularStrength = 0 = all land
    const specData = new Uint8Array([0, 0, 0, 255])
    const blackSpec = new THREE.DataTexture(specData, 1, 1, THREE.RGBAFormat)
    blackSpec.needsUpdate = true

    return { flatNormal, blackSpec }
  }, [])

  // Phase 1: Day map â€” only blocking texture (Suspense waits for this alone)
  // Uses stored setting if available, so there's no flash on startup.
  const dayTexture = useLoader(TextureLoader, INITIAL_EARTH_TEXTURE_URL)

  // Phase 2 textures start as fallbacks, swap to real when loaded
  const [normalTexture, setNormalTexture] = useState(fallbackTextures.flatNormal)
  const [specularTexture, setSpecularTexture] = useState(fallbackTextures.blackSpec)

  // OPTIMIZED: Download textures during intro but defer GPU upload until after
  // This prevents React re-renders AND GPU stalls during the zoom animation
  const pendingTexturesRef = useRef({ normal: null, specular: null, cloud: null })

  // Phase 2: Download normal + specular + clouds async (stash, don't apply yet)
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    const maxAniso = gl.capabilities.getMaxAnisotropy?.() ?? 16

    if (earthNormalMap) {
      loader.load(earthNormalMap, (texture) => {
        texture.colorSpace = THREE.LinearSRGBColorSpace
        texture.anisotropy = Math.min(maxAniso, 8)
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = true
        // Write directly to shader uniform — visible next frame, zero React re-renders
        normalMapRef.current.value = texture
        pendingTexturesRef.current.normal = texture
      })
    }

    if (earthSpecularMap) {
      loader.load(earthSpecularMap, (texture) => {
        texture.anisotropy = Math.min(maxAniso, 4)
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = true
        // Write directly to shader uniform — visible next frame, zero React re-renders
        specularMapRef.current.value = texture
        pendingTexturesRef.current.specular = texture
      })
    }

    if (earthCloudsMap) {
      loader.load(
        earthCloudsMap,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace
          texture.anisotropy = 4
          texture.minFilter = THREE.LinearMipmapLinearFilter
          texture.magFilter = THREE.LinearFilter
          // Write directly to ref — CloudLayer picks it up in useFrame, zero re-renders
          cloudTextureRef.current.value = texture
          hasCloudShadowsRef.current.value = 1.0
        },
        undefined,
        (error) => {
          console.warn('Cloud texture not found - shadows disabled')
        }
      )
    }
  }, [gl])

  useEffect(() => {
    if (!introComplete) return
    const pending = pendingTexturesRef.current

    if (pending.normal) {
      setNormalTexture(pending.normal)
      pending.normal = null
    }
    if (pending.specular) {
      setSpecularTexture(pending.specular)
      pending.specular = null
    }
  }, [introComplete])


  useMemo(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy?.() ?? 16

    dayTexture.colorSpace = THREE.SRGBColorSpace
    dayTexture.anisotropy = maxAniso
    dayTexture.minFilter = THREE.LinearMipmapLinearFilter
    dayTexture.magFilter = THREE.LinearFilter
    dayTexture.generateMipmaps = true
    if (dayTexture.mipmapBias !== undefined) {
      dayTexture.mipmapBias = 0.2
    }
  }, [dayTexture, gl])

  const SUN_X = -0.6  // Left side (creates shadow on right)
  const SUN_Y = 0.5   // Height (midday angle)
  const SUN_Z = 0.5   // Slightly front

  const sunDirection = useMemo(() => new THREE.Vector3(SUN_X, SUN_Y, SUN_Z).normalize(), [])

  // Earth shader uniforms - use refs for animated values
  const earthOpacityRef = useRef({ value: 0 })
  const zoomLevelRef = useRef({ value: 0 }) // 0 = zoomed out, 1 = zoomed in
  const cloudRotationUniform = useRef({ value: 0 })

  // Callback for CloudLayer to report its rotation
  const handleCloudRotationUpdate = useCallback((rotation) => {
    cloudRotationRef.current = rotation
    cloudRotationUniform.current.value = rotation
  }, [])

  const normalMapRef = useRef({ value: fallbackTextures.flatNormal })
  const specularMapRef = useRef({ value: fallbackTextures.blackSpec })
  const cloudTextureRef = useRef({ value: null })
  const hasCloudShadowsRef = useRef({ value: 0.0 })

  // Ocean color uniforms, driven by settings panel
  // Initialize from stored preset to avoid flash
  const initOcean = OCEAN_PRESETS.find(p => p.id === settings.oceanPreset) || OCEAN_PRESETS[0]
  const lightOceanColorRef = useRef({ value: new THREE.Vector3(initOcean.light[0], initOcean.light[1], initOcean.light[2]) })
  const deepOceanColorRef = useRef({ value: new THREE.Vector3(initOcean.deep[0], initOcean.deep[1], initOcean.deep[2]) })

  const earthUniforms = useMemo(() => ({
    uDayTexture: { value: dayTexture },
    uNormalMap: normalMapRef.current,
    uSpecularMap: specularMapRef.current,
    uCloudTexture: cloudTextureRef.current,
    uCloudRotation: cloudRotationUniform.current,
    uHasCloudShadows: hasCloudShadowsRef.current,
    uSunDirection: { value: sunDirection },
    uAtmosphereDayColor: { value: new THREE.Color('#85BEFF') },
    uAtmosphereTwilightColor: { value: new THREE.Color('#FF6B4A') },
    uOpacity: earthOpacityRef.current,
    uZoomLevel: zoomLevelRef.current,
    uLightOceanColor: lightOceanColorRef.current,
    uDeepOceanColor: deepOceanColorRef.current,
  }), [dayTexture, sunDirection, fallbackTextures])

  // Hot-swap textures into stable uniform refs when they load
  useEffect(() => {
    normalMapRef.current.value = normalTexture
  }, [normalTexture])

  useEffect(() => {
    specularMapRef.current.value = specularTexture
  }, [specularTexture])

  // SETTINGS REACTIVITY
  // Ref for autoRotate setting (read in useFrame without causing re-renders)
  const autoRotateRef = useRef(settings.autoRotate)
  useEffect(() => { autoRotateRef.current = settings.autoRotate }, [settings.autoRotate])

  // Ref for cloudsEnabled setting
  const cloudsEnabledRef = useRef(settings.cloudsEnabled)
  useEffect(() => {
    cloudsEnabledRef.current = settings.cloudsEnabled
    // When clouds are disabled, also disable cloud shadows in the earth shader
    if (!settings.cloudsEnabled) {
      hasCloudShadowsRef.current.value = 0.0
    } else if (cloudTextureRef.current.value) {
      hasCloudShadowsRef.current.value = 1.0
    }
  }, [settings.cloudsEnabled])

  // Earth Texture Swap
  useEffect(() => {
    const key = settings.earthTexture
    if (key === activeEarthTextureRef.current) return // Already loaded
    const url = EARTH_TEXTURE_MAP[key]
    if (!url) return

    const loader = new THREE.TextureLoader()
    loader.load(url, (newTexture) => {
      const maxAniso = gl.capabilities.getMaxAnisotropy?.() ?? 16
      newTexture.colorSpace = THREE.SRGBColorSpace
      newTexture.anisotropy = maxAniso
      newTexture.minFilter = THREE.LinearMipmapLinearFilter
      newTexture.magFilter = THREE.LinearFilter
      newTexture.generateMipmaps = true

      earthUniforms.uDayTexture.value = newTexture
      activeEarthTextureRef.current = key
    })
  }, [settings.earthTexture, gl, earthUniforms])

  //Ocean Color Preset
  useEffect(() => {
    const preset = OCEAN_PRESETS.find(p => p.id === settings.oceanPreset)
    if (!preset) return
    lightOceanColorRef.current.value.set(preset.light[0], preset.light[1], preset.light[2])
    deepOceanColorRef.current.value.set(preset.deep[0], preset.deep[1], preset.deep[2])
  }, [settings.oceanPreset])

  // Atmosphere uniforms - share opacity ref with earth
  const atmosphereUniforms = useMemo(() => ({
    uSunDirection: { value: sunDirection },
    uAtmosphereDayColor: { value: new THREE.Color('#85BEFF') },      // Sky blue
    uAtmosphereTwilightColor: { value: new THREE.Color('#FF6B4A') }, // Deep orange for twilight
    uOpacity: earthOpacityRef.current
  }), [sunDirection])

  // Outer haze ring uniforms (separate instance so THREE doesn't share uniform objects)
  const atmosphereHazeUniforms = useMemo(() => ({
    uSunDirection: { value: sunDirection },
    uAtmosphereDayColor: { value: new THREE.Color('#85BEFF') },
    uAtmosphereTwilightColor: { value: new THREE.Color('#FF6B4A') },
    uOpacity: earthOpacityRef.current
  }), [sunDirection])

  // Cloud texture is now applied directly by the async loader (no React state needed)
  // CloudLayer reads from cloudTextureRef in its useFrame loop

  // HELPER: Start combined rotation + zoom animation
  const startFocusAnimation = useCallback((targetRotationY, targetRotationX, targetZoom, duration) => {
    const anim = animationRef.current
    anim.isAnimating = true
    anim.animationType = 'focus-state'
    anim.animationStartTime = performance.now()
    anim.animationDuration = duration * 1000

    // Y Rotation (longitude)
    anim.rotationStart = anim.currentRotationY
    anim.rotationEnd = targetRotationY

    // X Rotation (latitude tilt)
    anim.rotationXStart = anim.currentRotationX
    anim.rotationXEnd = targetRotationX

    // Zoom
    anim.zoomStart = anim.cameraDistance
    anim.zoomEnd = targetZoom

    setIsAnimating(true)
  }, [])

  // HELPER: Start zoom-only animation (for zoom out)
  const startZoomAnimation = useCallback((targetZoom, duration) => {
    const anim = animationRef.current
    anim.isAnimating = true
    anim.animationType = 'zoom-out'
    anim.animationStartTime = performance.now()
    anim.animationDuration = duration * 1000

    // No Y rotation change
    anim.rotationStart = anim.currentRotationY
    anim.rotationEnd = anim.currentRotationY

    // Reset X rotation to 0 when zooming out
    anim.rotationXStart = anim.currentRotationX
    anim.rotationXEnd = 0

    // Zoom
    anim.zoomStart = anim.cameraDistance
    anim.zoomEnd = targetZoom

    setIsAnimating(true)
  }, [])

  // START INTRO ANIMATION
  useEffect(() => {
    const anim = animationRef.current

    // Guard against StrictMode double-mount - only start if not already started
    // Check both ref and React state to be safe
    if (anim.animationType === 'intro') {
      return // Intro already in progress or was set up, don't restart
    }

    // Mark intro as starting in ref first (sync, prevents race conditions)
    anim.animationType = 'intro'
    anim.isAnimating = true
    anim.introProgress = 0 // Reset for HMR safety
    anim.warmupFramesRemaining = 3 // Reset warmup

    // Set animation parameters
    introStartTime.current = performance.now()
    anim.animationStartTime = performance.now()
    anim.animationDuration = INTRO_DURATION * 1000
    anim.zoomStart = INTRO_START_DISTANCE
    anim.zoomEnd = DEFAULT_CAMERA_DISTANCE
    anim.cameraDistance = INTRO_START_DISTANCE
    anim.earthScale = INTRO_EARTH_SCALE_START

    // Update React state last
    setIsAnimating(true)
  }, [])

  // HANDLE HOVER STATE CHANGE (for cursor management)
  const handleHoverChange = useCallback((isHovering) => {
    animationRef.current.isHoveringState = isHovering
  }, [])

  // HANDLE STATE CLICK
  const handleStateClick = useCallback((stateName) => {
    const anim = animationRef.current

    // Block if currently animating, but allow if intro is done OR earth is visible
    const earthIsReady = introComplete || earthOpacityRef.current.value > 0.5
    if (anim.isAnimating || !earthIsReady) return

    // Get the centroid for this state
    const centroid = STATE_CENTROIDS[stateName]
    const targetLon = centroid ? centroid.lon : US_CENTER.lon
    const targetLat = centroid ? centroid.lat : US_CENTER_LAT

    // Calculate Y rotation (longitude - horizontal)
    const targetRotationY = getRotationForLongitude(targetLon)

    // Calculate shortest Y rotation path
    const normalizeAngle = (angle) => {
      while (angle < 0) angle += Math.PI * 2
      while (angle >= Math.PI * 2) angle -= Math.PI * 2
      return angle
    }

    let currentNorm = normalizeAngle(anim.currentRotationY)
    let targetNorm = normalizeAngle(targetRotationY)

    let diff = targetNorm - currentNorm
    if (diff > Math.PI) diff -= Math.PI * 2
    if (diff < -Math.PI) diff += Math.PI * 2

    const finalTargetRotationY = anim.currentRotationY + diff

    // Calculate X rotation (latitude - vertical tilt)
    // States south of US center = positive tilt (globe tilts up, shows south)
    // States north of US center = negative tilt (globe tilts down, shows north)
    const latOffset = US_CENTER_LAT - targetLat  // Positive for southern states
    const targetRotationX = -(latOffset / 45) * MAX_TILT_ANGLE  // Normalize to max tilt

    // Select state and animate
    selectState(stateName)

    const duration = Math.abs(diff) > 0.3 ? ROTATION_ANIMATION_DURATION : ZOOM_ANIMATION_DURATION
    startFocusAnimation(finalTargetRotationY, targetRotationX, ZOOMED_CAMERA_DISTANCE, duration)

  }, [selectState, startFocusAnimation, introComplete])

  // EXTERNAL ZOOM REQUEST (from Navbar search, etc..)
  useEffect(() => {
    if (pendingStateZoom) {
      handleStateClick(pendingStateZoom)
      clearPendingZoom()
    }
  }, [pendingStateZoom, handleStateClick, clearPendingZoom])

  // HANDLE DESELECTION (zoom out)
  useEffect(() => {
    // When selectedState becomes null, zoom out (if earth is ready)
    const earthIsReady = introComplete || earthOpacityRef.current.value > 0.5
    if (!selectedState && earthIsReady && animationRef.current.cameraDistance < DEFAULT_CAMERA_DISTANCE) {
      startZoomAnimation(DEFAULT_CAMERA_DISTANCE, ZOOM_ANIMATION_DURATION)
    }
  }, [selectedState, startZoomAnimation, introComplete])

  // MOUSE DRAG HANDLING (horizontal rotation only)
  useEffect(() => {
    const canvas = gl.domElement
    let startX = 0
    let startRotation = 0

    const handleMouseDown = (e) => {
      if (e.button !== 0) return
      if (animationRef.current.isAnimating) return
      if (animationRef.current.isHoveringState) return

      animationRef.current.isDragging = true
      animationRef.current.homingActive = false
      animationRef.current.velocity = 0  // Stop any existing momentum
      startX = e.clientX
      startRotation = animationRef.current.currentRotationY

      // Initialize tracking for velocity calculation
      animationRef.current.lastMouseX = e.clientX
      animationRef.current.lastMoveTime = performance.now()

      canvas.style.cursor = 'grabbing'
    }

    const handleMouseMove = (e) => {
      if (!animationRef.current.isDragging) return

      const now = performance.now()
      const deltaTime = now - animationRef.current.lastMoveTime

      const deltaX = e.clientX - startX
      const rotationDelta = deltaX * 0.005

      animationRef.current.currentRotationY = startRotation + rotationDelta

      // Calculate velocity with smoothing for more natural momentum
      if (deltaTime > 0) {
        const mouseDelta = e.clientX - animationRef.current.lastMouseX
        const instantVelocity = (mouseDelta * 0.005) / Math.max(deltaTime, 8) * 16

        // Smooth velocity using exponential moving average
        // This prevents jerky momentum from quick mouse movements
        animationRef.current.velocity = animationRef.current.velocity * 0.7 + instantVelocity * 0.3

        // Clamp velocity to prevent extreme spins, but allow faster than before
        animationRef.current.velocity = Math.max(-0.08, Math.min(0.08, animationRef.current.velocity))
      }

      // Update tracking
      animationRef.current.lastMouseX = e.clientX
      animationRef.current.lastMoveTime = now
      animationRef.current.lastInteractionTime = now
    }

    const handleMouseUp = () => {
      if (animationRef.current.isDragging) {
        animationRef.current.isDragging = false

        // Only clear velocity if user paused before releasing (held still)
        // A longer pause threshold preserves more natural momentum
        const timeSinceMove = performance.now() - animationRef.current.lastMoveTime
        if (timeSinceMove > 80) {
          // User paused - they want it to stop here
          animationRef.current.velocity = 0
        }
        // Otherwise keep the velocity for momentum spin

        // Update interaction time ONLY if we cleared velocity
        // This allows momentum to flow directly into idle rotation
        if (animationRef.current.velocity === 0) {
          animationRef.current.lastInteractionTime = performance.now()
        }

        canvas.style.cursor = animationRef.current.isHoveringState ? 'pointer' : 'grab'
      }
    }

    const handleMouseLeave = () => {
      if (animationRef.current.isDragging) {
        animationRef.current.isDragging = false
        // Keep momentum on mouse leave
        canvas.style.cursor = 'default'
      }
    }

    // Set initial cursor - always grab since HMR might skip intro
    canvas.style.cursor = 'grab'

    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [gl])

  // KEYBOARD ARROW CONTROLS (horizontal rotation)
  const keyboardRef = useRef({
    left: false,
    right: false,
    velocity: 0,
    SPEED: 0.025,
    MAX_VELOCITY: 0.04
  })

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      // Ignore during animations or before intro completes
      const anim = animationRef.current
      if (anim.isAnimating || !introComplete) return

      if (e.key === 'ArrowLeft' || e.key === 'Left') {
        e.preventDefault()
        keyboardRef.current.left = true
        anim.lastInteractionTime = performance.now()
      } else if (e.key === 'ArrowRight' || e.key === 'Right') {
        e.preventDefault()
        keyboardRef.current.right = true
        anim.lastInteractionTime = performance.now()
      }
    }

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'Left') {
        keyboardRef.current.left = false
      } else if (e.key === 'ArrowRight' || e.key === 'Right') {
        keyboardRef.current.right = false
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [introComplete])

  // LOAD STATE DATA
  useEffect(() => {
    async function loadStates() {
      try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
        const topology = await response.json()
        const geojson = feature(topology, topology.objects.states)

        const fipsToName = {
          '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
          '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
          '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
          '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
          '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
          '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
          '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
          '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
          '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
          '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
          '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
          '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
          '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming', '72': 'Puerto Rico'
        }

        const states = geojson.features.map(f => ({
          ...f,
          properties: {
            ...f.properties,
            name: fipsToName[f.id.toString().padStart(2, '0')] || `State ${f.id}`
          }
        }))

        setStatesData(states)
        setLoading(false)
      } catch (error) {
        console.error('Failed to load states:', error)
        setLoading(false)
      }
    }
    loadStates()
  }, [])

  // ANIMATION FRAME
  useFrame((state, rawDelta) => {
    // Two delta values for different purposes:
    // - introDelta: tightly clamped (33ms) to prevent intro animation jumps
    // - delta: loosely clamped (100ms) for scroll/interactions — expSmooth handles large deltas
    //   gracefully, so we only cap extreme cases
    const introDelta = Math.min(rawDelta, 0.033)
    const delta = Math.min(rawDelta, 0.1)
    const anim = animationRef.current
    const now = performance.now()

    // INTRO ANIMATION
    if (anim.animationType === 'intro' && anim.isAnimating) {
      // WARMUP PHASE: First few frames are expensive due to all the textures and shader calulations on mount
      // Burn through warmup frames at the start position so shaders compile,
      // then begin the real animation from a clean, fast frame.
      if (anim.warmupFramesRemaining > 0) {
        anim.warmupFramesRemaining--
        anim.cameraDistance = anim.zoomStart
        anim.earthScale = INTRO_EARTH_SCALE_START
        anim.introProgress = 0
        introProgressRef.current = 0
        zoomSpeedRef.current = 0
        anim.animationStartTime = now // Reset so safety fallback timer starts after warmup
      } else {

      // DELTA-ACCUMULATED PROGRESS: Instead of wall-clock elapsed time, we accumulate
      // progress from clamped delta. If a frame takes 100ms (GC pause, layout, etc.),
      // delta is clamped to 33ms, so the animation slows briefly instead of jumping.
      // This eliminates ALL timing-based stutter regardless of cause.
      const prevRawProgress = anim.introProgress
      anim.introProgress += introDelta / (INTRO_DURATION)  // introDelta clamped to 0.033

      // Safety fallback: if wall-clock says we're way past duration, force completion
      // This catches edge cases where delta accumulation falls behind
      const wallElapsed = now - anim.animationStartTime
      if (wallElapsed > (INTRO_DURATION * 1000) + 2000) { // 2s grace beyond duration
        anim.introProgress = 1
      }

      const rawProgress = Math.min(anim.introProgress, 1)

      // Use custom smooth space zoom easing for ultra-smooth deceleration
      const eased = easeOutSpaceZoom(rawProgress)
      introProgressRef.current = eased

      // Calculate current zoom speed for star streaking effect
      const prevEased = easeOutSpaceZoom(prevRawProgress)
      const currentSpeed = Math.max(0, (eased - prevEased) * 60)
      zoomSpeedRef.current = currentSpeed

      // Animate camera distance with smooth interpolation
      anim.cameraDistance = anim.zoomStart + (anim.zoomEnd - anim.zoomStart) * eased

      // Animate earth scale (grows from tiny to full size)
      const scaleEased = easeOutQuint(rawProgress)
      anim.earthScale = INTRO_EARTH_SCALE_START + (1 - INTRO_EARTH_SCALE_START) * scaleEased

      // EARTH FADE-IN ANIMATION
      // Earth starts fading in after 5% progress, fully visible by 90%
      // Uses ultra-smooth ease-out-quint for gentle emergence from deep space
      const earthFadeStart = 0.05
      const earthFadeEnd = 0.90
      let earthFadeProgress = 0
      if (rawProgress > earthFadeStart) {
        earthFadeProgress = Math.min(1, (rawProgress - earthFadeStart) / (earthFadeEnd - earthFadeStart))
        earthFadeProgress = 1 - Math.pow(1 - earthFadeProgress, 5)
      }
      earthOpacityRef.current.value = earthFadeProgress

      // Mount state meshes at 95% progress (delayed to avoid CPU spike during zoom)
      if (rawProgress > 0.95 && !statesVisible) {
        setStatesVisible(true)
      }

      // Intro complete
      if (rawProgress >= 1) {
        anim.earthScale = 1
        zoomSpeedRef.current = 0
        setEarthOpacity(1)
        earthOpacityRef.current.value = 1
        setIntroComplete(true)

        // If user scrolled during intro, reset page to top so 3D scene starts clean
        if (window.scrollY > 0) {
          window.scrollTo({ top: 0, behavior: 'instant' })
          if (scrollTargetRef?.current) scrollTargetRef.current = 0
        }
        smoothScrollProgressRef.current = 0
        smoothCameraDistanceRef.current = DEFAULT_CAMERA_DISTANCE
        smoothScrollYOffsetRef.current = 0

        // Check if we should chain directly into state zoom (returning from county view)
        if (selectedState) {
          // Chain directly - no delay, same frame!
          const centroid = STATE_CENTROIDS[selectedState.name]
          const targetLon = centroid ? centroid.lon : US_CENTER.lon
          const targetLat = centroid ? centroid.lat : US_CENTER_LAT

          const targetRotationY = getRotationForLongitude(targetLon)

          // Calculate shortest rotation path
          const normalizeAngle = (angle) => {
            while (angle < 0) angle += Math.PI * 2
            while (angle >= Math.PI * 2) angle -= Math.PI * 2
            return angle
          }

          let currentNorm = normalizeAngle(anim.currentRotationY)
          let targetNorm = normalizeAngle(targetRotationY)

          let diff = targetNorm - currentNorm
          if (diff > Math.PI) diff -= Math.PI * 2
          if (diff < -Math.PI) diff += Math.PI * 2

          const finalTargetRotationY = anim.currentRotationY + diff
          const latOffset = US_CENTER_LAT - targetLat
          const targetRotationX = -(latOffset / 45) * MAX_TILT_ANGLE

          // Start focus animation immediately in same frame
          anim.animationType = 'focus-state'
          anim.animationStartTime = now
          anim.animationDuration = ROTATION_ANIMATION_DURATION * 1000

          anim.rotationStart = anim.currentRotationY
          anim.rotationEnd = finalTargetRotationY
          anim.rotationXStart = anim.currentRotationX
          anim.rotationXEnd = targetRotationX
          anim.zoomStart = anim.cameraDistance
          anim.zoomEnd = ZOOMED_CAMERA_DISTANCE

          // Keep animating, show states immediately
          anim.statesFading = false
          statesOpacityRef.current = 1
        } else {
          // Normal intro completion - no state selected
          anim.isAnimating = false
          anim.animationType = null
          setIsAnimating(false)

          // Start states fade-in animation
          anim.statesFadeStartTime = now
          anim.statesFading = true
        }

        // Set cursor to grab now that intro is done
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grab'
        }
      }
      } // end warmup else
    }

    // STATES FADE-IN ANIMATION (after intro)
    if (anim.statesFading) {
      const statesFadeDuration = 800 // 800ms for states to fade in
      const elapsed = now - anim.statesFadeStartTime
      const rawProgress = Math.min(elapsed / statesFadeDuration, 1)

      // Use smooth cubic easing - cubic-bezier(0.4, 0, 0.2, 1)
      const statesEased = easeOutCubic(rawProgress)
      statesOpacityRef.current = statesEased

      if (rawProgress >= 1) {
        anim.statesFading = false
        statesOpacityRef.current = 1
      }
    }
    // REGULAR ANIMATIONS
    else if (anim.isAnimating && anim.animationType !== 'intro') {
      const elapsed = now - anim.animationStartTime
      const progress = Math.min(elapsed / anim.animationDuration, 1)
      const eased = easeInOutCubic(progress)

      // Animate Y rotation (longitude)
      anim.currentRotationY = anim.rotationStart +
        (anim.rotationEnd - anim.rotationStart) * eased

      // Animate X rotation (latitude tilt)
      anim.currentRotationX = anim.rotationXStart +
        (anim.rotationXEnd - anim.rotationXStart) * eased

      // Animate zoom
      anim.cameraDistance = anim.zoomStart +
        (anim.zoomEnd - anim.zoomStart) * eased

      // Animation complete
      if (progress >= 1) {
        anim.isAnimating = false
        setIsAnimating(false)
        anim.animationType = null
      }
    }

    // MOMENTUM
    if (!anim.isDragging && Math.abs(anim.velocity) > MOMENTUM_THRESHOLD) {
      // Apply current velocity
      anim.currentRotationY += anim.velocity

      // Apply SAME friction regardless of direction
      anim.velocity *= MOMENTUM_FRICTION

      // Update interaction time during momentum
      anim.lastInteractionTime = now
    }

    // SPRING EASE-BACK - Only AFTER momentum fully stops
    // Check if momentum just stopped (was moving, now below threshold)
    const justStopped = !anim.isDragging &&
                        Math.abs(anim.velocity) <= MOMENTUM_THRESHOLD &&
                        Math.abs(anim.velocity) > 0

    if (justStopped && !anim.isAnimating && !selectedState && introComplete) {
      // Check if we were spinning opposite to idle direction
      const wasOppositeDirection = (anim.velocity < 0 && IDLE_DIRECTION > 0) ||
                                    (anim.velocity > 0 && IDLE_DIRECTION < 0)

      if (wasOppositeDirection) {
        // Give a gentle initial velocity in the correct direction
        // This creates the smooth "ease back" spring effect
        anim.velocity = SPRING_EASE_VELOCITY * IDLE_DIRECTION
      } else {
        // Was going correct direction, just stop
        anim.velocity = 0
      }
    }

    // Final stop check
    if (!anim.isDragging && Math.abs(anim.velocity) < MOMENTUM_THRESHOLD * 0.5) {
      anim.velocity = 0
    }

    // Read raw scroll target directly from shared ref - NO React re-renders
    // During intro, force to 0 so scroll doesn't accumulate and cause a jump when intro finishes
    const rawScrollTarget = (selectedState || isCountyView || !introComplete) ? 0 : (scrollTargetRef?.current ?? 0)

    // Exponential smooth the scroll progress (frame-rate independent)
    smoothScrollProgressRef.current = expSmooth(
      smoothScrollProgressRef.current, rawScrollTarget, SCROLL_CAMERA_SPEED, delta
    )
    const currentScrollProgress = smoothScrollProgressRef.current
    const scrollDelta = currentScrollProgress - prevScrollProgressRef.current

    // Only apply scroll rotation when intro is complete and not in a state view
    const canScrollRotate = !anim.isAnimating &&
                            !anim.isDragging &&
                            introComplete &&
                            !selectedState

    if (canScrollRotate && Math.abs(scrollDelta) > 0.000005) {
      if (scrollDelta < 0) {
        // SCROLLING UP, Flag homing active, refresh timer
        anim.homingActive = true
        anim.lastHomingScrollTime = now
      } else {
        // SCROLLING DOWN, Normal free rotation, cancel homing
        anim.homingActive = false
        smoothScrollRotationRef.current -= scrollDelta * SCROLL_ROTATION_SPEED
      }
      anim.lastInteractionTime = now
    } else if (anim.homingActive && (now - anim.lastHomingScrollTime > 1200)) {
      anim.homingActive = false
      anim.lastInteractionTime = now // Reset idle timer so auto-rotate waits full IDLE_TIMEOUT
    }

    // US HOMING, Continuous pull when scrolling up
    // Runs every frame while homing is active, using expSmooth for
    // frame-rate-independent spring force (not limited by scroll delta).
    if (canScrollRotate && anim.homingActive) {
      const angleDiff = shortAngleDist(anim.currentRotationY, US_CENTER_ROTATION_Y)
      const absDiff = Math.abs(angleDiff)
      if (absDiff > 0.005) {
        // Ease-out: as we approach the US, scale the spring force down smoothly.
        // At >0.3 rad (~17Â°) = full speed, tapering to near-zero at 0.005 rad (~0.3Â°)
        const easeFactor = Math.min(1, absDiff / 0.3)
        const homeStep = expSmooth(0, angleDiff, 1.2 * easeFactor, delta)
        anim.currentRotationY += homeStep
      } else {
        // Close enough â€” stop homing
        anim.homingActive = false
        anim.lastInteractionTime = now
      }
    }

    // Smoothly drain accumulated scroll rotation into actual rotation
    if (canScrollRotate) {
      const rotationDiff = smoothScrollRotationRef.current
      if (Math.abs(rotationDiff) > 0.00005) {
        const smoothRotation = expSmooth(0, rotationDiff, SCROLL_ROTATION_SMOOTH, delta)
        anim.currentRotationY += smoothRotation
        smoothScrollRotationRef.current -= smoothRotation
      }
    } else if (!introComplete) {
      // During intro, keep scroll rotation ref at 0 to prevent accumulated rotation
      smoothScrollRotationRef.current = 0
    }

    // Update previous scroll progress
    prevScrollProgressRef.current = currentScrollProgress

    // Idle auto-rotation - kicks in when momentum stops and not scrolling
    const isScrolling = Math.abs(scrollDelta) > 0.000005 || Math.abs(smoothScrollRotationRef.current) > 0.001
    const isStopped = Math.abs(anim.velocity) < MOMENTUM_THRESHOLD

    // KEYBOARD ROTATION
    const kb = keyboardRef.current
    if (!anim.isDragging && introComplete && !anim.isAnimating) {
      let targetVelocity = 0
      if (kb.left) targetVelocity += kb.SPEED
      if (kb.right) targetVelocity -= kb.SPEED

      if (targetVelocity !== 0) {
        const diff = targetVelocity - kb.velocity
        kb.velocity += diff * 0.15
        kb.velocity = Math.max(-kb.MAX_VELOCITY, Math.min(kb.MAX_VELOCITY, kb.velocity))
        anim.currentRotationY += kb.velocity
        anim.lastInteractionTime = performance.now()
      } else if (Math.abs(kb.velocity) > 0.0001) {
        anim.currentRotationY += kb.velocity
        kb.velocity *= 0.92
        if (Math.abs(kb.velocity) < 0.001) {
          anim.velocity = kb.velocity * 2
          kb.velocity = 0
        }
      }
    }

    const timeSinceInteraction = now - anim.lastInteractionTime
    if (!anim.isAnimating &&
        !anim.isDragging &&
        isStopped &&
        !selectedState &&
        !isScrolling &&
        introComplete &&
        autoRotateRef.current &&
        timeSinceInteraction > IDLE_TIMEOUT &&
        Math.abs(kb.velocity) < 0.0001) {
      // Ease in over 2 seconds after timeout ramps from 0% to 100% speed
      const easeInDuration = 2000
      const easeProgress = Math.min(1, (timeSinceInteraction - IDLE_TIMEOUT) / easeInDuration)
      const easedSpeed = IDLE_ROTATION_SPEED * easeProgress * easeProgress // Quadratic ease-in
      anim.currentRotationY += easedSpeed * delta * IDLE_DIRECTION
    }

    // Apply rotation to earth
    if (earthRef.current) {
      earthRef.current.rotation.y = anim.currentRotationY
      earthRef.current.rotation.x = anim.currentRotationX
    }

    // Apply scale to earth group (for intro animation)
    if (earthGroupRef.current) {
      const scale = anim.earthScale
      earthGroupRef.current.scale.set(scale, scale, scale)
    }

    // Update star rotation ref for parallax effect
    starRotationRef.current = anim.currentRotationY

    // SCROLL-BASED CAMERA DISTANCE
    // When user scrolls (and no state selected), camera pulls back
    // This creates the "Earth receding into space" effect
    let effectiveCameraDistance = anim.cameraDistance

    // This handles HMR/hot reload where introComplete might reset
    const earthIsReady = introComplete || earthOpacityRef.current.value > 0.5

    if (introComplete && !selectedState && !anim.isAnimating) {
      // Calculate target camera distance from scroll
      // Apply easing to scroll progress for smoother camera movement
      const easedScrollProgress = easeScrollCamera(currentScrollProgress)

      const targetCameraDistance = DEFAULT_CAMERA_DISTANCE +
        (SCROLL_MAX_CAMERA_DISTANCE - DEFAULT_CAMERA_DISTANCE) * easedScrollProgress

      // Target Y offset also uses eased progress
      const targetScrollYOffset = easedScrollProgress * 1.5

      // Exponential smooth â€” frame-rate independent, no jitter
      smoothCameraDistanceRef.current = expSmooth(
        smoothCameraDistanceRef.current, targetCameraDistance, SCROLL_CAMERA_SPEED, delta
      )

      // Smoothly interpolate Y offset
      smoothScrollYOffsetRef.current = expSmooth(
        smoothScrollYOffsetRef.current, targetScrollYOffset, SCROLL_CAMERA_SPEED, delta
      )

      // Use smooth values for camera position (only after intro and not animating)
      effectiveCameraDistance = smoothCameraDistanceRef.current
    } else if (!introComplete) {
      // During intro, keep smooth refs synced with actual camera distance
      // This ensures no jump when intro completes
      smoothCameraDistanceRef.current = anim.cameraDistance
      smoothScrollYOffsetRef.current = 0
    } else if (selectedState || (anim.isAnimating && anim.animationType !== 'zoom-out')) {
      // While a state is selected or zooming IN, keep smooth refs at default values
      // This prevents stale scroll-offset from causing camera jump on deselection
      smoothCameraDistanceRef.current = DEFAULT_CAMERA_DISTANCE
      smoothScrollYOffsetRef.current = 0
    } else if (anim.isAnimating && !selectedState) {
      // During zoom-out animation, sync smooth refs with animated values
      // This ensures smooth handoff when animation completes
      smoothCameraDistanceRef.current = anim.cameraDistance
      smoothScrollYOffsetRef.current = 0
    }

    // Update camera position
    // Calculate zoom progress (0 = fully zoomed out, 1 = fully zoomed in)
    const zoomProgress = Math.max(0, Math.min(1,
      (DEFAULT_CAMERA_DISTANCE - effectiveCameraDistance) /
      (DEFAULT_CAMERA_DISTANCE - ZOOMED_CAMERA_DISTANCE)
    ))

    // Update zoom level for shader (controls bump detail intensity)
    zoomLevelRef.current.value = zoomProgress

    // Apply X offset when zoomed in (shifts view left to account for sidebar)
    // But not during intro
    const xOffset = introComplete ? SIDEBAR_CAMERA_OFFSET * zoomProgress : 0

    // Maintain camera's viewing angle - keep Y constant, adjust X and Z for distance
    // During intro, adjust Y proportionally for more dramatic approach
    const introYMultiplier = introComplete ? 1 : 0.5 + introProgressRef.current * 0.5

    // Apply Y offset when zoomed (negative = Earth appears higher)
    const scrollYOffset = introComplete && !selectedState ? smoothScrollYOffsetRef.current : 0
    const yOffset = introComplete ? ZOOMED_CAMERA_Y_OFFSET * zoomProgress : 0
    const effectiveCameraY = (CAMERA_Y + yOffset + scrollYOffset) * introYMultiplier

    const horizontalDistance = Math.sqrt(
      Math.max(0, effectiveCameraDistance * effectiveCameraDistance - effectiveCameraY * effectiveCameraY)
    )

    // Apply viewport scale — pushes camera back on mobile so globe isn't too close
    const scaledDistance = horizontalDistance * viewportScaleRef.current
    camera.position.set(xOffset, effectiveCameraY, Math.max(0.1, scaledDistance))
    camera.lookAt(0, EARTH_LOOK_OFFSET_Y, 0)
  })

  return (
    <group>
      {/* Milky Way skybox - rendered first, behind everything */}
      <MilkyWaySkybox
        rotationRef={starRotationRef}
        introProgressRef={introProgressRef}
        scrollProgressRef={smoothScrollProgressRef}
        sceneReady={sceneReady}
        onTextureLoaded={handleTextureLoaded}
        skyboxUrl={SKYBOX_TEXTURE_MAP[settings.skyboxTexture]}
      />

      {/* Starfield*/}
      <Starfield
        count={2500}
        rotationRef={starRotationRef}
        introProgressRef={introProgressRef}
        zoomSpeedRef={zoomSpeedRef}
        scrollProgressRef={smoothScrollProgressRef}
        sceneReady={sceneReady}
      />

      {/* Sun flare effect */}
      <SunFlare sunDirection={sunDirection} introProgressRef={introProgressRef} />

      {/* Ambient light */}
      <ambientLight intensity={0.1} />
      <directionalLight position={[5, 3, 5]} intensity={1} />

      {/* Earth group with scale animation for intro */}
      <group ref={earthGroupRef}>
        {/* Earth sphere*/}
        <group ref={earthRef} rotation={[0, US_CENTER_ROTATION_Y, 0]}>
          <mesh>
            <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
            <shaderMaterial
              vertexShader={earthVertexShader}
              fragmentShader={earthFragmentShader}
              uniforms={earthUniforms}
              transparent={true}
            />
          </mesh>

          {/* Atmosphere outer glow shell - creates smooth blue haze around Earth circumference */}
          <mesh>
            <sphereGeometry args={[EARTH_RADIUS * 1.06, 64, 64]} />
            <shaderMaterial
              vertexShader={atmosphereVertexShader}
              fragmentShader={atmosphereFragmentShader}
              uniforms={atmosphereUniforms}
              transparent={true}
              depthWrite={false}
              side={THREE.BackSide}
            />
          </mesh>

          {/* Outer haze ring - FrontSide, visible blue glow extending beyond Earth edge */}
          <mesh>
            <sphereGeometry args={[EARTH_RADIUS * 1.02, 64, 64]} />
            <shaderMaterial
              vertexShader={atmosphereVertexShader}
              fragmentShader={atmosphereHazeFragmentShader}
              uniforms={atmosphereHazeUniforms}
              transparent={true}
              depthWrite={false}
              side={THREE.FrontSide}
            />
          </mesh>

          {/* Cloud layer*/}
          {settings.cloudsEnabled && (
            <CloudLayer
              sunDirection={sunDirection}
              earthOpacityRef={earthOpacityRef}
              zoomLevelRef={zoomLevelRef}
              cloudTextureRef={cloudTextureRef}
              onRotationUpdate={handleCloudRotationUpdate}
            />
          )}

          {/* US States on sphere - only render when intro is mostly complete */}
          {statesVisible && statesData.map((feature, i) => (
            <SphericalState
              key={feature.id || i}
              feature={feature}
              isHovered={hoveredState === feature.properties?.name}
              isSelected={selectedState?.name === feature.properties?.name}
              onSelect={handleStateClick}
              onHover={setHoveredState}
              onHoverChange={handleHoverChange}
              isAnimating={isAnimating}
              canvasRef={canvasRef}
              introComplete={introComplete}
              statesOpacityRef={statesOpacityRef}
              heatmapColor={heatmapColors?.[feature.properties?.name] || null}
            />
          ))}

          {/* Transmission corridor arcs appear after zoom to state completes */}
          <TransmissionArcs
            selectedStateName={selectedState?.name || null}
            zoomComplete={!!selectedState && !isAnimating}
          />
        </group>
      </group>
    </group>
  )
}