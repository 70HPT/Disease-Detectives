"""
External Data Service.
Async wrappers around CDC, Census Bureau, NOAA, and WHO APIs.
Includes in-memory caching to respect rate limits.
"""

import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional
from functools import lru_cache

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Simple in-memory TTL cache (swap for Redis in production)
_cache: dict[str, tuple[datetime, dict]] = {}
CACHE_TTL = timedelta(seconds=settings.cache_ttl_seconds)


def _get_cached(key: str) -> Optional[dict]:
    if key in _cache:
        ts, data = _cache[key]
        if datetime.utcnow() - ts < CACHE_TTL:
            return data
        del _cache[key]
    return None


def _set_cached(key: str, data: dict) -> None:
    _cache[key] = (datetime.utcnow(), data)


# ── CDC ──────────────────────────────────────────────────────────────

async def fetch_cdc_disease_data(
    dataset_id: str = "x9gk-5huc",   # ILINet influenza data
    state: Optional[str] = None,
    limit: int = 1000,
) -> list[dict]:
    """
    Fetch disease surveillance data from CDC's Socrata API.
    https://data.cdc.gov
    """
    cache_key = f"cdc:{dataset_id}:{state}:{limit}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    url = f"{settings.cdc_api_base}/{dataset_id}.json"
    params: dict = {"$limit": limit, "$order": "date DESC"}
    if state:
        params["state"] = state

    headers = {}
    if settings.cdc_app_token:
        headers["X-App-Token"] = settings.cdc_app_token

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            _set_cached(cache_key, data)
            logger.info(f"CDC: fetched {len(data)} records for dataset {dataset_id}")
            return data
    except httpx.HTTPError as e:
        logger.error(f"CDC API error: {e}")
        return []


# ── Census Bureau ────────────────────────────────────────────────────

async def fetch_census_population(
    state_fips: str,
    county_fips: str = "*",
    year: int = 2022,
) -> list[dict]:
    """
    Fetch ACS 5-year population + income estimates.
    B01001_001E = total population
    B19013_001E = median household income
    """
    cache_key = f"census:{state_fips}:{county_fips}:{year}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    url = f"{settings.census_api_base}/{year}/acs/acs5"
    params = {
        "get": "B01001_001E,B19013_001E,NAME",
        "for": f"county:{county_fips}",
        "in": f"state:{state_fips}",
    }
    if settings.census_api_key:
        params["key"] = settings.census_api_key

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            rows = resp.json()
            # First row is headers, rest is data
            if len(rows) < 2:
                return []
            headers = rows[0]
            records = [dict(zip(headers, row)) for row in rows[1:]]
            _set_cached(cache_key, records)
            logger.info(f"Census: fetched {len(records)} records for state {state_fips}")
            return records
    except httpx.HTTPError as e:
        logger.error(f"Census API error: {e}")
        return []


# ── NOAA ─────────────────────────────────────────────────────────────

async def fetch_noaa_climate(
    fips: str,
    start_date: str,      # "YYYY-MM-DD"
    end_date: str,
    dataset_id: str = "GHCND",
) -> list[dict]:
    """
    Fetch climate observations from NOAA CDO API.
    Requires a NOAA token (free registration).
    """
    cache_key = f"noaa:{fips}:{start_date}:{end_date}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    if not settings.noaa_token:
        logger.warning("NOAA token not configured — skipping climate fetch")
        return []

    url = f"{settings.noaa_api_base}/data"
    params = {
        "datasetid": dataset_id,
        "locationid": f"FIPS:{fips}",
        "startdate": start_date,
        "enddate": end_date,
        "units": "standard",
        "limit": 1000,
    }
    headers = {"token": settings.noaa_token}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json().get("results", [])
            _set_cached(cache_key, data)
            logger.info(f"NOAA: fetched {len(data)} observations for FIPS {fips}")
            return data
    except httpx.HTTPError as e:
        logger.error(f"NOAA API error: {e}")
        return []


# ── WHO ──────────────────────────────────────────────────────────────

async def fetch_who_indicator(
    indicator_code: str = "WHS3_43",   # Influenza cases
    country: str = "USA",
) -> list[dict]:
    """
    Fetch health indicator data from WHO GHO API.
    https://ghoapi.azureedge.net/api/
    """
    cache_key = f"who:{indicator_code}:{country}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    url = f"{settings.who_api_base}/{indicator_code}"
    params = {"$filter": f"SpatialDim eq '{country}'"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json().get("value", [])
            _set_cached(cache_key, data)
            logger.info(f"WHO: fetched {len(data)} records for {indicator_code}")
            return data
    except httpx.HTTPError as e:
        logger.error(f"WHO API error: {e}")
        return []


# ── Feature Assembly ─────────────────────────────────────────────────

async def build_features_for_location(
    fips: str,
    db: Optional[AsyncSession] = None,
) -> dict:
    """
    Assemble the feature dict needed by the LSTM model for a given FIPS code.

    Primary data source: outbreak_history table (cases + lag values stored
    in climate_data JSON during seed).  Falls back to Census/NOAA APIs when
    available, and to sensible defaults otherwise.

    The LSTM expects: cases, cases_lag_1, cases_lag_2, cases_lag_3
    We also include enrichment fields used by _compute_factors().
    """
    from backend.db.models import Location, OutbreakHistory

    cases = 0.0
    lag1 = 0.0
    lag2 = 0.0
    lag3 = 0.0
    population = None
    density = None
    vaccination_rate = 0.55  # default; overridden if DB data available

    # ── Pull from outbreak_history if DB session provided ────────────
    if db is not None:
        # Look up location
        loc_result = await db.execute(
            select(Location).where(Location.fips == fips)
        )
        location = loc_result.scalar_one_or_none()

        if location:
            population = location.population
            density = location.density

            # Get most recent outbreak_history rows (newest first)
            oh_result = await db.execute(
                select(OutbreakHistory)
                .where(OutbreakHistory.location_id == location.id)
                .order_by(desc(OutbreakHistory.date))
                .limit(4)
            )
            history_rows = oh_result.scalars().all()

            if history_rows:
                latest = history_rows[0]
                cases = float(latest.case_count or 0)

                # Try to use stored lag values from climate_data JSON
                cd = latest.climate_data or {}
                lag1 = float(cd.get("cases_lag_1", 0) or 0)
                lag2 = float(cd.get("cases_lag_2", 0) or 0)
                lag3 = float(cd.get("cases_lag_3", 0) or 0)

                # If lags weren't stored, compute from prior rows
                if lag1 == 0 and len(history_rows) >= 2:
                    lag1 = float(history_rows[1].case_count or 0)
                if lag2 == 0 and len(history_rows) >= 3:
                    lag2 = float(history_rows[2].case_count or 0)
                if lag3 == 0 and len(history_rows) >= 4:
                    lag3 = float(history_rows[3].case_count or 0)

                # Check for vaccination coverage in climate_data
                vacc = cd.get("estimate_pct")
                if vacc is not None:
                    try:
                        vaccination_rate = float(vacc) / 100.0
                    except (ValueError, TypeError):
                        pass

    # ── Enrich with Census data if no population from DB ─────────────
    if population is None:
        state_fips = fips[:2]
        county_fips = fips[2:]
        census_records = await fetch_census_population(state_fips, county_fips)
        if census_records:
            population = int(census_records[0].get("B01001_001E", 0) or 0)

    if population is None:
        population = 50000  # fallback

    if density is None:
        density = population / 1000  # rough estimate

    # ── Enrich with NOAA climate (best-effort) ───────────────────────
    avg_temp = 55.0
    avg_humidity = 0.5
    today = datetime.utcnow()
    start = (today - timedelta(days=30)).strftime("%Y-%m-%d")
    end = today.strftime("%Y-%m-%d")
    climate = await fetch_noaa_climate(fips, start, end)
    if climate:
        temps = [r["value"] for r in climate if r.get("datatype") == "TAVG"]
        if temps:
            avg_temp = sum(temps) / len(temps)

    return {
        "cases": cases,
        "cases_lag_1": lag1,
        "cases_lag_2": lag2,
        "cases_lag_3": lag3,
        "population": population,
        "population_density": density,
        "vaccination_rate": vaccination_rate,
        "avg_temp": avg_temp,
        "avg_humidity": avg_humidity,
    }
