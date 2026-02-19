import { useEffect, useRef, useCallback } from 'react'
import useStore from '../../store/useStore'
import { OCEAN_PRESETS, EARTH_TEXTURES, SKYBOX_TEXTURES } from '../../store/useStore'
import './SettingsPanel.css'

// ============================================
// ICONS
// ============================================

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 4v6h6" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  )
}

// ============================================
// TOGGLE SWITCH
// ============================================
function Toggle({ checked, onChange }) {
  return (
    <button
      className={`sp-toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
    >
      <span className="sp-toggle-thumb" />
    </button>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function SettingsPanel() {
  const isOpen = useStore(s => s.settingsOpen)
  const close = useStore(s => s.closeSettings)
  const settings = useStore(s => s.settings)
  const updateSetting = useStore(s => s.updateSetting)
  const resetSettings = useStore(s => s.resetSettings)
  const panelRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, close])

  // Close on click outside
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) close()
  }, [close])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`sp-backdrop ${isOpen ? 'open' : ''}`}
        onClick={handleBackdropClick}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 199,
          background: isOpen ? 'rgba(0,0,0,0.4)' : 'transparent',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      />

      {/* Panel */}
      <div
        className={`sp-panel ${isOpen ? 'open' : ''}`}
        ref={panelRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 340,
          height: '100vh',
          zIndex: 200,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          background: 'rgba(10,14,20,0.92)',
          overflowY: 'auto',
          transition: 'transform 0.35s cubic-bezier(0.22,0.61,0.36,1)',
        }}
      >
        {/* Header */}
        <div className="sp-header">
          <h2 className="sp-title">Settings</h2>
          <div className="sp-header-actions">
            <button className="sp-reset-btn" onClick={resetSettings} title="Reset to defaults">
              <ResetIcon />
              <span>Reset</span>
            </button>
            <button className="sp-close-btn" onClick={close}>
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="sp-body">
          {/* ============================================ */}
          {/* GLOBE SURFACE */}
          {/* ============================================ */}
          <section className="sp-section">
            <h3 className="sp-section-title">Globe Surface</h3>
            <div className="sp-cards">
              {EARTH_TEXTURES.map(tex => (
                <button
                  key={tex.id}
                  className={`sp-card ${settings.earthTexture === tex.id ? 'active' : ''}`}
                  onClick={() => updateSetting('earthTexture', tex.id)}
                >
                  <div className="sp-card-indicator" style={{ background: tex.accent }} />
                  <div className="sp-card-info">
                    <span className="sp-card-name">{tex.name}</span>
                    <span className="sp-card-desc">{tex.desc}</span>
                  </div>
                  {settings.earthTexture === tex.id && (
                    <span className="sp-card-check"><CheckIcon /></span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* ============================================ */}
          {/* SKYBOX */}
          {/* ============================================ */}
          <section className="sp-section">
            <h3 className="sp-section-title">Skybox</h3>
            <div className="sp-skybox-grid">
              {SKYBOX_TEXTURES.map(sky => (
                <button
                  key={sky.id}
                  className={`sp-skybox-card ${settings.skyboxTexture === sky.id ? 'active' : ''}`}
                  onClick={() => updateSetting('skyboxTexture', sky.id)}
                >
                  <div className="sp-skybox-preview" style={{ background: sky.gradient }}>
                    {/* Fake stars */}
                    <div className="sp-skybox-stars" />
                    {settings.skyboxTexture === sky.id && (
                      <span className="sp-skybox-check"><CheckIcon /></span>
                    )}
                  </div>
                  <span className="sp-skybox-name">{sky.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ============================================ */}
          {/* OCEAN COLOR */}
          {/* ============================================ */}
          <section className="sp-section">
            <h3 className="sp-section-title">Ocean Color</h3>
            <div className="sp-ocean-grid">
              {OCEAN_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  className={`sp-ocean-swatch ${settings.oceanPreset === preset.id ? 'active' : ''}`}
                  onClick={() => updateSetting('oceanPreset', preset.id)}
                  title={preset.name}
                >
                  <div className="sp-swatch-color" style={{ background: preset.swatch }}>
                    {settings.oceanPreset === preset.id && (
                      <span className="sp-swatch-check"><CheckIcon /></span>
                    )}
                  </div>
                  <span className="sp-swatch-name">{preset.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ============================================ */}
          {/* EFFECTS */}
          {/* ============================================ */}
          <section className="sp-section">
            <h3 className="sp-section-title">Effects</h3>
            <div className="sp-toggles">
              <div className="sp-toggle-row">
                <div className="sp-toggle-info">
                  <span className="sp-toggle-label">Cloud Layer</span>
                  <span className="sp-toggle-desc">Atmospheric cloud coverage</span>
                </div>
                <Toggle
                  checked={settings.cloudsEnabled}
                  onChange={(v) => updateSetting('cloudsEnabled', v)}
                />
              </div>
              <div className="sp-toggle-row">
                <div className="sp-toggle-info">
                  <span className="sp-toggle-label">Auto-Rotate</span>
                  <span className="sp-toggle-desc">Idle globe rotation</span>
                </div>
                <Toggle
                  checked={settings.autoRotate}
                  onChange={(v) => updateSetting('autoRotate', v)}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}