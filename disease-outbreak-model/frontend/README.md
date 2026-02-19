# Disease Detectives — Frontend

Interactive disease surveillance dashboard with a 3D Earth globe, state/county health metrics, and outbreak analysis tools. Senior Capstone Project.

## Setup

```bash
cd frontend
npm install
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

React 18 + Vite, React Three Fiber + Three.js, Zustand, D3-geo + TopoJSON, custom CSS (no framework).