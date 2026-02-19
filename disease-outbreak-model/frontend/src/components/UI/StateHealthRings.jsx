import { useState, useEffect, useRef } from 'react'
import useStore from '../../store/useStore'
import { STATE_FACTS, DEFAULT_FACT, getHealthGrade } from '../../data/stateHealthData'
import './StateHealthRings.css'

// ============================================
// HEALTH GRADE RING (SVG)
// ============================================
function HealthGradeRing({
  grade,
  percentage,
  color,
  glowColor,
  size = 150,
  strokeWidth = 8,
  animate = false,
  delay = 0,
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - (animate ? percentage : 0))

  return (
    <div className="grade-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="grade-ring-svg">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
        {[...Array(40)].map((_, i) => {
          const angle = (i / 40) * 360 - 90
          const rad = (angle * Math.PI) / 180
          const innerR = radius - strokeWidth / 2 - 2
          const outerR = radius - strokeWidth / 2 - (i % 5 === 0 ? 8 : 5)
          return (
            <line key={i}
              x1={size / 2 + Math.cos(rad) * outerR} y1={size / 2 + Math.sin(rad) * outerR}
              x2={size / 2 + Math.cos(rad) * innerR} y2={size / 2 + Math.sin(rad) * innerR}
              stroke={i % 5 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}
              strokeWidth={i % 5 === 0 ? 1 : 0.5}
            />
          )
        })}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: `stroke-dashoffset 1.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}ms`, filter: `drop-shadow(0 0 8px ${glowColor})` }}
        />
      </svg>
      <div className="grade-center">
        <span className="grade-letter" style={{ color }}>{grade}</span>
        <span className="grade-sublabel">Health Grade</span>
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function StateHealthRings() {
  const selectedState = useStore((state) => state.selectedState)
  const viewMode = useStore((state) => state.viewMode)
  const [animate, setAnimate] = useState(false)
  const [visible, setVisible] = useState(false)
  const prevStateRef = useRef(null)

  const isCountyView = viewMode === 'state-counties'

  useEffect(() => {
    if (selectedState && !isCountyView) {
      if (prevStateRef.current !== selectedState.name) {
        setAnimate(false)
        setVisible(false)
      }
      prevStateRef.current = selectedState.name
      const showTimer = setTimeout(() => setVisible(true), 300)
      const animTimer = setTimeout(() => setAnimate(true), 600)
      return () => { clearTimeout(showTimer); clearTimeout(animTimer) }
    } else {
      setVisible(false)
      setAnimate(false)
    }
  }, [selectedState, isCountyView])

  if (!selectedState || isCountyView) return null

  const { healthIndex = 65 } = selectedState
  const gradeInfo = getHealthGrade(healthIndex)
  const facts = STATE_FACTS[selectedState.name] || DEFAULT_FACT

  return (
    <div className={`health-rings ${visible ? 'visible' : ''}`}>
      <div className="hero-ring-section">
        <HealthGradeRing grade={gradeInfo.grade} percentage={gradeInfo.pct} color={gradeInfo.color} glowColor={gradeInfo.glow} animate={animate} delay={100} />
      </div>
      <div className="ring-divider" />
      <div className={`quick-facts ${animate ? 'visible' : ''}`}>
        <div className="fact-row">
          <span className="fact-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="10" r="3" /><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z" />
            </svg>
          </span>
          <span className="fact-label">Capital</span>
          <span className="fact-value">{facts.capital}</span>
        </div>
        <div className="fact-row">
          <span className="fact-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" />
            </svg>
          </span>
          <span className="fact-label">Region</span>
          <span className="fact-value">{facts.region}</span>
        </div>
        <div className="fact-row">
          <span className="fact-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </span>
          <span className="fact-label">Statehood</span>
          <span className="fact-value">{facts.statehood}</span>
        </div>
      </div>
      <div className="ring-divider" />
      <div className={`fun-fact ${animate ? 'visible' : ''}`}>
        <div className="fun-fact-header">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>Did you know?</span>
        </div>
        <p className="fun-fact-text">{facts.fact}</p>
      </div>
    </div>
  )
}