import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Simple scroll progress hook
 * Provides scroll state to be passed into the Three.js scene
 */
export function useScrollProgress() {
  const [scrollState, setScrollState] = useState({
    scrollY: 0,
    scrollProgress: 0,      // 0-1 based on total page
    heroProgress: 0,        // 0-1 for first viewport height
    isPastHero: false,
    velocity: 0,
    direction: 'none'
  })

  const lastScrollY = useRef(0)
  const lastTime = useRef(Date.now())
  const rafId = useRef(null)

  const handleScroll = useCallback(() => {
    if (rafId.current) return

    rafId.current = requestAnimationFrame(() => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight - windowHeight

      const now = Date.now()
      const timeDelta = now - lastTime.current
      const scrollDelta = scrollY - lastScrollY.current
      const velocity = timeDelta > 0 ? scrollDelta / timeDelta : 0

      // Calculate progress values
      const scrollProgress = documentHeight > 0 ? scrollY / documentHeight : 0
      const heroProgress = Math.min(1, scrollY / windowHeight)

      setScrollState({
        scrollY,
        scrollProgress: Math.min(1, Math.max(0, scrollProgress)),
        heroProgress: Math.min(1, Math.max(0, heroProgress)),
        isPastHero: scrollY > windowHeight * 0.8,
        velocity,
        direction: scrollDelta > 0 ? 'down' : scrollDelta < 0 ? 'up' : 'none'
      })

      lastScrollY.current = scrollY
      lastTime.current = now
      rafId.current = null
    })
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial call

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [handleScroll])

  return scrollState
}

export default useScrollProgress