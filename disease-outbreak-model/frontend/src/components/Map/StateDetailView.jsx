import { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { geoMercator, geoPath, geoCentroid, geoAlbers } from 'd3-geo'
import { feature } from 'topojson-client'

// ============================================
// STATE TERRAIN COLORS (same as USMap)
// ============================================

const stateTerrainColors = {
  'Nevada': '#9E8B7D',
  'Utah': '#A89078',
  'Arizona': '#C4A882',
  'New Mexico': '#B8A080',
  'California': '#8B9070',
  'Colorado': '#8A8268',
  'Wyoming': '#7D7A60',
  'Montana': '#6B7058',
  'Idaho': '#687052',
  'Washington': '#4A6048',
  'Oregon': '#506650',
  'North Dakota': '#5A6A4A',
  'South Dakota': '#6A7252',
  'Nebraska': '#687050',
  'Kansas': '#5E6E48',
  'Oklahoma': '#5A6845',
  'Texas': '#6A7A52',
  'Minnesota': '#3D5A3D',
  'Iowa': '#4A6545',
  'Missouri': '#4A6548',
  'Wisconsin': '#3A5838',
  'Illinois': '#456045',
  'Michigan': '#3A5A3A',
  'Indiana': '#426042',
  'Ohio': '#3E5A3E',
  'Arkansas': '#4A6A48',
  'Louisiana': '#4A6B4A',
  'Mississippi': '#486848',
  'Alabama': '#486A48',
  'Georgia': '#4A6C4A',
  'Florida': '#5A7855',
  'South Carolina': '#4A6A4A',
  'North Carolina': '#456545',
  'Tennessee': '#456548',
  'Kentucky': '#426242',
  'Virginia': '#3E5E40',
  'West Virginia': '#3A5A3C',
  'Maine': '#3A5840',
  'New Hampshire': '#385538',
  'Vermont': '#3A5A3A',
  'Massachusetts': '#3C5A40',
  'Rhode Island': '#3E5C42',
  'Connecticut': '#3E5C40',
  'New York': '#3C5A3E',
  'New Jersey': '#405E42',
  'Pennsylvania': '#3A5A3C',
  'Delaware': '#426244',
  'Maryland': '#3E5E40',
  'District of Columbia': '#3E5E40',
  'Alaska': '#4A6250',
  'Hawaii': '#5A7858',
  'Puerto Rico': '#5A7855'
}

// ============================================
// SVG PATH PARSING (same as USMap)
// ============================================

function parseSvgPath(pathString) {
  const commands = pathString.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || []
  const allPaths = []
  let currentPath = []
  let currentX = 0, currentY = 0, startX = 0, startY = 0

  commands.forEach(cmd => {
    const type = cmd[0]
    const args = cmd.slice(1).trim().split(/[\s,]+/).filter(s => s).map(Number)

    switch (type) {
      case 'M':
        if (currentPath.length > 2) allPaths.push(currentPath)
        currentPath = []
        for (let i = 0; i < args.length; i += 2) {
          currentX = args[i]; currentY = args[i + 1]
          if (i === 0) { startX = currentX; startY = currentY }
          currentPath.push([currentX, currentY])
        }
        break
      case 'm':
        if (currentPath.length > 2) allPaths.push(currentPath)
        currentPath = []
        for (let i = 0; i < args.length; i += 2) {
          currentX += args[i]; currentY += args[i + 1]
          if (i === 0) { startX = currentX; startY = currentY }
          currentPath.push([currentX, currentY])
        }
        break
      case 'L':
        for (let i = 0; i < args.length; i += 2) {
          currentX = args[i]; currentY = args[i + 1]
          currentPath.push([currentX, currentY])
        }
        break
      case 'l':
        for (let i = 0; i < args.length; i += 2) {
          currentX += args[i]; currentY += args[i + 1]
          currentPath.push([currentX, currentY])
        }
        break
      case 'H': currentX = args[0]; currentPath.push([currentX, currentY]); break
      case 'h': currentX += args[0]; currentPath.push([currentX, currentY]); break
      case 'V': currentY = args[0]; currentPath.push([currentX, currentY]); break
      case 'v': currentY += args[0]; currentPath.push([currentX, currentY]); break
      case 'Z': case 'z': currentPath.push([startX, startY]); break
    }
  })
  if (currentPath.length > 2) allPaths.push(currentPath)
  return allPaths
}

// ============================================
// CREATE STATE GEOMETRY (auto-scaled to fit)
// ============================================

function createStateGeometry(paths, targetSize = 3.5) {
  if (!paths || paths.length === 0) return null

  // First pass: calculate bounds
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  paths.forEach(points => {
    points.forEach(([x, y]) => {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    })
  })

  const width = maxX - minX
  const height = maxY - minY
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  // Calculate scale to fit within targetSize
  const scale = targetSize / Math.max(width, height)

  const allGeometries = []

  paths.forEach(points => {
    if (points.length < 3) return
    try {
      const shape = new THREE.Shape()
      const transformedPoints = points.map(([x, y]) => [
        (x - centerX) * scale,
        -(y - centerY) * scale
      ])

      shape.moveTo(transformedPoints[0][0], transformedPoints[0][1])
      for (let i = 1; i < transformedPoints.length; i++) {
        shape.lineTo(transformedPoints[i][0], transformedPoints[i][1])
      }
      shape.closePath()

      const geometry = new THREE.ShapeGeometry(shape, 12)
      geometry.computeVertexNormals()
      allGeometries.push(geometry)
    } catch (e) {}
  })

  if (allGeometries.length === 0) return null
  if (allGeometries.length === 1) return { geometry: allGeometries[0], scale }

  // Merge geometries
  const totalVertices = allGeometries.reduce((sum, g) => sum + g.attributes.position.count, 0)
  const mergedPositions = new Float32Array(totalVertices * 3)
  const mergedNormals = new Float32Array(totalVertices * 3)
  const mergedIndices = []
  let vertexOffset = 0, positionOffset = 0

  allGeometries.forEach(geo => {
    const pos = geo.attributes.position.array
    const norm = geo.attributes.normal.array
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
  return { geometry: merged, scale }
}

// Create outline geometry
function createOutlineGeometry(paths, targetSize = 3.5) {
  // Calculate bounds
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  paths.forEach(points => {
    points.forEach(([x, y]) => {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    })
  })

  const width = maxX - minX
  const height = maxY - minY
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const scale = targetSize / Math.max(width, height)

  const allPoints = []
  paths.forEach(points => {
    const linePoints = points.map(([x, y]) => {
      const tx = (x - centerX) * scale
      const ty = -(y - centerY) * scale
      return new THREE.Vector3(tx, ty, 0.002)
    })
    allPoints.push(linePoints)
  })
  return allPoints
}

// ============================================
// STATE FIPS LOOKUP
// ============================================

const nameToFips = {
  'Alabama': '01', 'Alaska': '02', 'Arizona': '04', 'Arkansas': '05',
  'California': '06', 'Colorado': '08', 'Connecticut': '09', 'Delaware': '10',
  'District of Columbia': '11', 'Florida': '12', 'Georgia': '13', 'Hawaii': '15',
  'Idaho': '16', 'Illinois': '17', 'Indiana': '18', 'Iowa': '19',
  'Kansas': '20', 'Kentucky': '21', 'Louisiana': '22', 'Maine': '23',
  'Maryland': '24', 'Massachusetts': '25', 'Michigan': '26', 'Minnesota': '27',
  'Mississippi': '28', 'Missouri': '29', 'Montana': '30', 'Nebraska': '31',
  'Nevada': '32', 'New Hampshire': '33', 'New Jersey': '34', 'New Mexico': '35',
  'New York': '36', 'North Carolina': '37', 'North Dakota': '38', 'Ohio': '39',
  'Oklahoma': '40', 'Oregon': '41', 'Pennsylvania': '42', 'Rhode Island': '44',
  'South Carolina': '45', 'South Dakota': '46', 'Tennessee': '47', 'Texas': '48',
  'Utah': '49', 'Vermont': '50', 'Virginia': '51', 'Washington': '53',
  'West Virginia': '54', 'Wisconsin': '55', 'Wyoming': '56', 'Puerto Rico': '72'
}

// ============================================
// STATE DETAIL VIEW COMPONENT
// ============================================

export default function StateDetailView({ stateName, opacity = 1, onZoomOut }) {
  const groupRef = useRef()
  const dragRef = useRef()
  const [stateGeometry, setStateGeometry] = useState(null)
  const [outlines, setOutlines] = useState([])

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState({ x: -0.5, y: 0 }) // Offset left for side panel

  // Zoom state
  const [zoom, setZoom] = useState(1)

  const { camera, gl } = useThree()

  // Load and process state geometry
  useEffect(() => {
    async function loadStateData() {
      try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
        const topology = await response.json()
        const geojson = feature(topology, topology.objects.states)

        const stateFips = nameToFips[stateName]
        const stateFeature = geojson.features.find(f =>
          f.id.toString().padStart(2, '0') === stateFips
        )

        if (!stateFeature) {
          console.error('State not found:', stateName)
          return
        }

        // Get state centroid for projection
        const centroid = geoCentroid(stateFeature)

        // Use Albers for Alaska specifically, Mercator for others
        let projection
        if (stateName === 'Alaska') {
          projection = geoAlbers()
            .center([0, 64])
            .rotate([154, 0])
            .parallels([55, 65])
            .scale(800)
            .translate([400, 300])
        } else if (stateName === 'Hawaii') {
          projection = geoMercator()
            .center(centroid)
            .scale(3000)
            .translate([400, 300])
        } else {
          projection = geoMercator()
            .center(centroid)
            .scale(2500)
            .translate([400, 300])
        }

        const pathGenerator = geoPath().projection(projection)
        const pathString = pathGenerator(stateFeature)

        if (pathString) {
          const paths = parseSvgPath(pathString)
          const result = createStateGeometry(paths, 3.0) // Target size of 3 units
          const outlineGeo = createOutlineGeometry(paths, 3.0)

          if (result && result.geometry) {
            setStateGeometry(result.geometry)
            setOutlines(outlineGeo)
          }
        }
      } catch (error) {
        console.error('Failed to load state data:', error)
      }
    }

    if (stateName) {
      // Reset position and zoom when state changes
      setPosition({ x: -0.5, y: 0 })
      setZoom(1)
      loadStateData()
    }
  }, [stateName])

  // Handle mouse wheel for zoom
  useEffect(() => {
    const handleWheel = (e) => {
      if (opacity < 0.5) return // Only when state view is visible

      e.preventDefault()
      const zoomSpeed = 0.001
      const newZoom = Math.max(0.5, Math.min(3, zoom - e.deltaY * zoomSpeed))
      setZoom(newZoom)
    }

    gl.domElement.addEventListener('wheel', handleWheel, { passive: false })
    return () => gl.domElement.removeEventListener('wheel', handleWheel)
  }, [gl, zoom, opacity])

  // Gentle floating animation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.x = position.x
      groupRef.current.position.y = position.y + Math.sin(state.clock.elapsedTime * 0.4) * 0.02
      groupRef.current.scale.setScalar(zoom)
    }
  })

  // Drag handlers
  const handlePointerDown = (e) => {
    e.stopPropagation()
    setIsDragging(true)
    setDragStart({ x: e.point.x - position.x, y: e.point.y - position.y })
    gl.domElement.style.cursor = 'grabbing'
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    e.stopPropagation()
    setPosition({
      x: e.point.x - dragStart.x,
      y: e.point.y - dragStart.y
    })
  }

  const handlePointerUp = (e) => {
    if (isDragging) {
      e.stopPropagation()
      setIsDragging(false)
      gl.domElement.style.cursor = 'grab'
    }
  }

  if (!stateGeometry || !stateName) return null

  const terrainColor = stateTerrainColors[stateName] || '#4A6A4A'

  return (
    <group ref={groupRef}>
      {/* Draggable state fill */}
      <mesh
        ref={dragRef}
        geometry={stateGeometry}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerEnter={() => { if (!isDragging) gl.domElement.style.cursor = 'grab' }}
      >
        <meshStandardMaterial
          color={terrainColor}
          transparent
          opacity={opacity}
          roughness={0.7}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* State outline */}
      {outlines.map((points, i) => (
        <line key={i} geometry={new THREE.BufferGeometry().setFromPoints(points)}>
          <lineBasicMaterial
            color="#ffffff"
            transparent
            opacity={opacity * 0.8}
          />
        </line>
      ))}
    </group>
  )
}