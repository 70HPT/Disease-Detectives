import { useEffect, useState } from 'react'
import './LoadingStates.css'

// ============================================
// SKELETON LOADER — Shimmering placeholder blocks
// Matches the layout of real content so there's no layout shift
// ============================================

export function SkeletonBlock({ width = '100%', height = '16px', borderRadius = '6px', style = {} }) {
  return (
    <div
      className="skeleton-block"
      style={{ width, height, borderRadius, ...style }}
    />
  )
}

export function SkeletonText({ lines = 3, widths = [] }) {
  const defaultWidths = ['100%', '92%', '78%', '85%', '60%']
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock
          key={i}
          width={widths[i] || defaultWidths[i % defaultWidths.length]}
          height="12px"
          style={{ marginBottom: i < lines - 1 ? '8px' : 0 }}
        />
      ))}
    </div>
  )
}

export function SkeletonRing({ size = 80 }) {
  return (
    <div className="skeleton-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={(size - 8) / 2}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2} cy={size / 2} r={(size - 8) / 2}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
          strokeDasharray={`${size * 0.6} ${size * 2}`}
          className="skeleton-ring-spinner"
        />
      </svg>
    </div>
  )
}

// ── Panel Skeleton — matches StatePanel layout ─────────────────────
export function StatePanelSkeleton() {
  return (
    <div className="skeleton-panel">
      <div className="skeleton-panel-header">
        <SkeletonBlock width="140px" height="22px" />
        <SkeletonBlock width="60px" height="18px" borderRadius="10px" />
      </div>

      <div className="skeleton-panel-stats">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-stat">
            <SkeletonBlock width="50px" height="24px" />
            <SkeletonBlock width="80px" height="10px" />
          </div>
        ))}
      </div>

      <SkeletonRing size={80} />

      <div className="skeleton-panel-analysis">
        <SkeletonBlock width="160px" height="14px" style={{ marginBottom: '12px' }} />
        <SkeletonText lines={3} />
      </div>
    </div>
  )
}

// ── Timeline Skeleton — matches StateTimeline layout ───────────────
export function TimelineSkeleton() {
  return (
    <div className="skeleton-timeline">
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton-timeline-event">
          <SkeletonBlock width="50px" height="14px" />
          <SkeletonBlock width="100%" height="10px" />
          <SkeletonBlock width="75%" height="10px" />
        </div>
      ))}
    </div>
  )
}

// ── County Card Skeleton — matches hover card layout ───────────────
export function CountyCardSkeleton() {
  return (
    <div className="skeleton-county-card">
      <SkeletonBlock width="120px" height="16px" style={{ marginBottom: '10px' }} />
      <div className="skeleton-county-gauges">
        {[1, 2, 3].map(i => (
          <SkeletonRing key={i} size={32} />
        ))}
      </div>
      <SkeletonText lines={2} widths={['100%', '65%']} />
    </div>
  )
}


// ============================================
// EMPTY STATE — Friendly message when no data is available
// ============================================

export function EmptyState({ icon, title, message, action, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon || (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        )}
      </div>
      <span className="empty-state-title">{title || 'No data available'}</span>
      {message && <p className="empty-state-message">{message}</p>}
      {action && onAction && (
        <button className="empty-state-action" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}

// ── Pre-built empty states for specific components ─────────────────

export function EmptyTimeline() {
  return (
    <EmptyState
      icon={
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      }
      title="No outbreak history"
      message="Historical records will appear here once the database is populated."
    />
  )
}

export function EmptyPrediction() {
  return (
    <EmptyState
      icon={
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      }
      title="No prediction data"
      message="Risk analysis will be available once the ML model is connected."
    />
  )
}

export function EmptyCountyData() {
  return (
    <EmptyState
      icon={
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 3v18" />
        </svg>
      }
      title="County data unavailable"
      message="Detailed county metrics require backend integration."
    />
  )
}

export function EmptyWatchlist() {
  return (
    <EmptyState
      title="No states watched"
      message="Add states to your watchlist to monitor their health metrics."
    />
  )
}