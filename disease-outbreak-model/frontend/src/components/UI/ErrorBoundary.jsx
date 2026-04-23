import { Component } from 'react'
import './ErrorBoundary.css'

// Class-based because React's error boundary API still requires it.
// Isolates runtime errors inside a single panel so the rest of the dashboard
// keeps working during the live demo.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary:${this.props.label || 'unknown'}]`, error, info)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    const { label = 'This panel', compact = false } = this.props

    return (
      <div className={`error-boundary ${compact ? 'compact' : ''}`}>
        <div className="error-boundary-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <div className="error-boundary-title">{label} hit a snag</div>
        <div className="error-boundary-subtitle">
          Something didn't render correctly. Other parts of the dashboard are still working.
        </div>
        <button className="error-boundary-retry" onClick={this.reset}>
          Retry
        </button>
      </div>
    )
  }
}
