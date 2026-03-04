# Disease Detectives — Frontend

Interactive disease surveillance dashboard with a 3D Earth globe, state/county health metrics, and outbreak analysis tools. Senior Capstone Project.

## Setup

```bash
cd frontend
npm install
npm install lenis
npm run dev
```

Opens at `http://localhost:5173`. No backend required — the app runs on built-in demo data by default.

## What's in Here

- **3D Globe** — Clickable US states with heatmap overlays, transmission arcs, and customizable appearance
- **State Panel** — Population, risk score, vaccination rate, health grade, and transmission corridor analysis
- **County Map** — Full county-level SVG map with zoom/pan, hover cards, and WHO-style epidemiological briefs
- **Watchlist** — Monitor multiple states with alert feeds and comparison cards
- **Comparison Mode** — Side-by-side state comparison with radar charts
- **Timeline** — National and state-specific outbreak history (historically accurate events)
- **Content Sections** — Global Health Pulse, Disease Spotlight (6 diseases), Insights Feed, Data Sources
- **Settings** — Globe textures, skybox, ocean color, cloud toggle

## Smooth Scroll (Lenis)

The 3D globe is a full-viewport Three.js canvas with HTML content that scrolls over it. Native browser scroll causes stutter because the browser's compositor thread rasterizes DOM layers asynchronously, competing with WebGL for GPU time. This is a [documented Chromium-level issue](https://github.com/mrdoob/three.js/issues/21088) affecting all Three.js scroll-driven sites.

**[Lenis](https://github.com/darkroomengineering/lenis)** solves this by intercepting wheel/touch events, smoothing them with internal lerp, and updating `window.scrollY` programmatically — so DOM movement and WebGL rendering are driven from the same smooth source in the same frame.

```
Trackpad input → Lenis intercepts wheel event
                → Internal lerp smooths erratic bursts into a clean ramp
                → Updates window.scrollY programmatically
                → useFrame reads window.scrollY (already smooth)
                → expSmooth adds floaty camera lag on top
                → Earth camera + DOM content update in same frame
```

Key integration points:
- **`App.jsx`** — Initializes Lenis (stopped during intro, started when intro completes). All programmatic `scrollTo` calls go through `window.__lenis` for consistency.
- **`EarthWithStates.jsx`** — Reads `window.scrollY` directly in `useFrame` every frame. Since Lenis has already smoothed the value, only one layer of `expSmooth` is needed for the cinematic camera follow.
- **`ComparisonMode.jsx`** — Uses `lenis.stop()`/`lenis.start()` for modal scroll locking instead of `overflow: hidden`.
- **`SettingsPanel.jsx`** — Uses `data-lenis-prevent` so internal panel scrolling isn't intercepted.
- **`App.css`** — Native `scroll-behavior: smooth` removed to avoid conflicts.

## Data Sources

**Live now:**
- WHO Global Health Observatory API — national-level health indicators called directly from the frontend (`src/services/whoService.js`)

**Pending backend integration:**
- CDC Socrata API — state-level disease surveillance
- Census Bureau API — county population and demographics
- NOAA CDO API — climate data by county
- ML FluPredictor model — county-level risk predictions

**Static reference data (built into the app):**
- State facts, capitals, and health-related history
- National outbreak timeline (1918 Spanish Flu through 2022 Mpox)
- State-specific outbreak events (24 states)
- Transmission corridor data (all 50 states)
- County/state boundaries from US Census TIGER

## What's Real vs. Demo

All state and county health metrics (risk scores, vaccination rates, air quality, health index, active cases, hospital capacity, testing rates) are **placeholder data** generated client-side. The UI labels demo content with "Demo" badges and the footer notes this clearly.

Real data includes: state facts, outbreak history events, geographic boundaries, and WHO API indicators when the service is called.

See `backend_requirements.md` for what the frontend needs from the backend to go live.

## API Service Layer

The `src/services/` folder has a complete integration layer ready for the backend:

- `api.js` — Base fetch client (defaults to `localhost:8000`, fails gracefully)
- `riskService.js` — Risk map and prediction endpoints
- `locationService.js` — County/state lookups
- `dataService.js` — Outbreak history, CDC/Census/NOAA proxies
- `whoService.js` — Direct WHO API (works without backend)
- `useApiData.js` — React hooks with loading/error states and automatic fallback to demo data

When the backend is running, data flows in automatically. When it's not, everything falls back to the existing mock data — nothing breaks.

## Tech Stack

React 18 + Vite, React Three Fiber + Three.js, Zustand, Lenis (smooth scroll), D3-geo + TopoJSON, custom CSS (no framework).