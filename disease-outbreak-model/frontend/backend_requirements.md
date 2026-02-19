# Backend Requirements — What the Frontend Needs

**From:** Joshua (Frontend)
**Date:** February 18, 2026

I've gone through all the backend code and connected to the Neon database to check what's there. Below is what needs to happen for frontend integration, with explanations for why each item matters.

---

## Database Status

I ran `SELECT COUNT(*)` on every table:

- **locations** — 15 rows
- **predictions** — 0 rows
- **outbreak_history** — 0 rows
- **model_metadata** — 0 rows
- **api_cache** — 0 rows

The 15 location rows are state-level only (no counties), and every data column is NULL — no FIPS codes, no population, no lat/lon. Just state names and IDs, then again this is probably just temporary, just pointing out what i saw.
Overall though the setup is great, its how I imagined it would be

---

## Blockers

### 1. Fix and populate the database

**What:** The locations table needs all ~3,143 US counties with FIPS codes, population, density, and coordinates. Predictions and outbreak_history need seed data.

**Why it matters:**

- Every route in `risk.py`, `data.py`, and `locations.py` queries by FIPS code (`Location.fips == req.fips`). With no FIPS codes in the table, every request returns a 404.
- `GET /risk/map` (the endpoint that colors the globe on page load) joins `Location` to `Prediction` and groups by state. With 0 prediction rows, it returns an empty list and the globe has no data.
- `GET /data/history/{fips}` powers the outbreak timeline. With 0 rows in outbreak_history, the timeline is blank.
- The table only has 15 of 50 states and no counties. The county map view (`StateCountyMap.jsx`) needs county-level risk data for whichever state the user clicks.

**State abbreviations vs. full names:** The 15 existing rows store full names like "Florida" and "New York". I'd recommend switching to 2-letter codes ("FL", "NY") for three reasons:

1. `models.py` defines `state = Column(String(2))` — the ORM was designed for 2-character codes. Full names technically violate the column's intended constraint.
2. `risk.py` line 156 calls `_state_name(row.state)`, which looks up the state in `_STATE_NAMES` (line 182) — a dictionary keyed by abbreviations like "CA" and "FL". If the database has "Florida", that lookup fails and the response comes back with "Florida" as both the abbreviation field and the display name.
3. All the external data sources (Census API, CDC Socrata, FIPS standards) return 2-letter codes. When real data gets pulled in, it'll arrive as abbreviations anyway. Storing full names means adding a conversion step on every insert.

**Schema drift:** The database has a `capital` column (varchar 50) that doesn't exist in `models.py`. Either add it to the ORM or drop it from the table so they stay in sync.

**Recommended approach:** Write a `seed.py` script that pulls county data from the Census API (free, no auth for basic queries) and inserts it with correct FIPS codes, abbreviations, population, and coordinates. Then generate initial prediction rows (even random 0-100 scores) and some outbreak_history records.

### 2. Provide the Pydantic schemas file

**What:** Every route file imports from `backend.schemas.risk`, but this file wasn't included in what was shared with me.

**Why it matters:** Python will throw an `ImportError` on startup. None of the endpoints will load, so I can't test anything against the API even if the database is fixed.

The schemas referenced across the codebase:

- `RiskRequest`, `RiskResponse`, `ContributingFactors` — `risk.py`
- `MapDataResponse`, `StateRiskSummary` — `risk.py` GET /map
- `LocationOut` — `locations.py`
- `OutbreakHistoryOut`, `HistoryRequest` — `data.py`
- `HealthResponse` — `health.py`

### 3. Provide the ML model files

**What:** `src/models/flu_predictor.py` (the FluPredictor class) and `outputs/ca_total_model.pth` (trained weights).

**Why it matters:** `ml_service.py` imports `FluPredictor` and tries to load the model file. It has a mock fallback that works without them, so this isn't blocking — but we'll need the real model before the demo.

---

## WHO API Limitation

**What:** The WHO GHO API (`ghoapi.azureedge.net`) provides country-level data only.

**Why it matters:** It can tell us USA life expectancy or national immunization rates, but it cannot give us per-state risk scores, county-level vaccination rates, or state outbreak histories. So it can't be the source for populating the state/county views that make up most of the dashboard.

The backend has 4 external APIs configured. Here's what each can realistically provide:

- **CDC** (`data.cdc.gov`) — State-level disease surveillance (ILINet flu data). This is the best option for state-level health metrics.
- **Census** (`api.census.gov`) — County population, income, demographics. Works for the location data we need.
- **NOAA** (`ncdc.noaa.gov`) — Climate observations by FIPS. Useful for the climate_risk factor in predictions. Needs a free token.
- **WHO** (`ghoapi.azureedge.net`) — National indicators only. I'm already calling this directly from the frontend for national-level context, so the backend proxy is optional.

**We need to decide as a team** where state and county health metrics are coming from — CDC Socrata, a static dataset like County Health Rankings, or the ML model predictions themselves.

---

## Hardcoded Values in data_service.py

**What:** `build_features_for_location()` has several hardcoded placeholder values.

**Why it matters:** These values feed directly into the ML model's predictions. Every county will get nearly identical risk scores because the distinguishing features are all static:

- `unemployment_rate` — hardcoded `0.05` for every county
- `vaccination_rate` — hardcoded `0.55` (so every county shows ~55% vaccination in the UI)
- `otc_search_index` — hardcoded `35.0`
- `flu_cases_lag_1/2/3` — all hardcoded `0`

At minimum, `vaccination_rate` should vary by location (CDC has this data) and `flu_cases_lag` should pull from the outbreak_history table once it has data.

---

## Frontend Fields With No Backend Source

These metrics show up in my components but no endpoint provides them. This isn't a bug — I'm just flagging it so we can decide together what to do:

- **airQuality** — WHO has PM2.5 data at the national level only, not per state or county. No other configured API provides this.
- **healthIndex** — A composite score I display in several components. The backend doesn't define how to calculate it. Could be derived from the ML model's contributing factors.
- **activeCases** — Could potentially be derived from the most recent outbreak_history records, but no endpoint returns this directly.
- **hospitalCapacity** — No data source exists in any of the backend integrations.
- **testingRate** — Same, no data source.

Options: add real data sources for these, compute them from what we have, or I keep them as clearly-labeled demo placeholders.

---

## What Each Frontend Component Needs

**Globe** (`EarthWithStates.jsx`) — `GET /risk/map` returning one entry per state with avg_risk_score. This is the first API call on page load.

**State Panel** (`StatePanel.jsx`) — Population, risk score, vaccination rate, health index for the selected state. Either I filter `/risk/map` client-side or we add a `GET /risk/state/{abbr}` endpoint.

**County Map** (`StateCountyMap.jsx`) — `POST /risk/predict` or `GET /risk/location/{fips}` for county-level detail when a user clicks a county.

**Timeline** (`StateTimeline.jsx`) — `GET /data/history/{fips}` for outbreak records.

**Watchlist / Comparison** — Batch state data. A `POST /risk/batch` endpoint accepting multiple FIPS or state codes would be ideal but not required.

**Health Rings** (`StateHealthRings.jsx`) — The `ContributingFactors` object from prediction responses (population_density, climate_risk, vaccination_coverage, historical_trend, search_trend).

---

## What I've Done on My End

I've built a complete API service layer (`src/services/`) with fetch functions for every endpoint, React hooks with loading/error states, and automatic fallback to mock data when the backend isn't available, might change that to blanks instead. The WHO service already works — it calls the public WHO API directly from the frontend without needing the backend (Change the year in the nav bar and scroll to the global pulse section).

Once the backend is running with real data, integration on my side is fast — I just swap fallbacks for live responses.

---

##  Checklist

1. **BLOCKER** — Fix locations table (FIPS codes, 2-letter state abbrs, all ~3,143 counties with population/density/coordinates)
2. **BLOCKER** — Seed predictions table so GET /risk/map returns data
3. **BLOCKER** — Provide schemas/risk.py with all Pydantic models
4. **HIGH** — Seed outbreak_history with sample records
5. **HIGH** — Decide as a team where state/county health data comes from
6. **HIGH** — Replace hardcoded vaccination_rate and flu_cases_lag in data_service.py
7. **MEDIUM** — Decide on airQuality, healthIndex, hospitalCapacity, testingRate, activeCases
8. **MEDIUM** — Provide FluPredictor class + trained model file
9. **LOW** — Batch prediction endpoint for watchlist/comparison