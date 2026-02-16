"""
/api/v1/data — Outbreak history and external data endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime

from backend.db.session import get_db
from backend.db.models import OutbreakHistory, Location
from backend.schemas.risk import OutbreakHistoryOut, HistoryRequest
from backend.services.data_service import (
    fetch_cdc_disease_data,
    fetch_census_population,
    fetch_noaa_climate,
    fetch_who_indicator,
)

router = APIRouter(prefix="/data", tags=["Data"])


# ── Outbreak History (from our database) ─────────────────────────────

@router.get("/history/{fips}", response_model=list[OutbreakHistoryOut])
async def get_outbreak_history(
    fips: str,
    disease_type: str = Query("total"),
    limit: int = Query(100, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Get historical outbreak data for a county."""
    loc_result = await db.execute(select(Location).where(Location.fips == fips))
    location = loc_result.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail=f"Location not found: {fips}")

    query = (
        select(OutbreakHistory)
        .where(OutbreakHistory.location_id == location.id)
        .order_by(OutbreakHistory.date.desc())
        .limit(limit)
    )
    if disease_type != "total":
        query = query.where(OutbreakHistory.disease_type == disease_type)

    result = await db.execute(query)
    return result.scalars().all()


# ── External API Proxies ─────────────────────────────────────────────
# These let the frontend fetch external data through our backend
# (avoids CORS issues + we can cache + apply rate limits).

@router.get("/cdc/diseases")
async def get_cdc_data(
    state: Optional[str] = None,
    limit: int = Query(100, le=1000),
):
    """Proxy to CDC disease surveillance data."""
    data = await fetch_cdc_disease_data(state=state, limit=limit)
    return {"source": "cdc", "count": len(data), "records": data}


@router.get("/census/population/{state_fips}")
async def get_census_data(
    state_fips: str,
    county_fips: str = Query("*", description="3-digit county FIPS or * for all"),
):
    """Proxy to Census Bureau ACS population data."""
    data = await fetch_census_population(state_fips, county_fips)
    return {"source": "census", "count": len(data), "records": data}


@router.get("/noaa/climate/{fips}")
async def get_noaa_data(
    fips: str,
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
):
    """Proxy to NOAA climate observations."""
    data = await fetch_noaa_climate(fips, start_date, end_date)
    return {"source": "noaa", "count": len(data), "records": data}


@router.get("/who/indicators")
async def get_who_data(
    indicator: str = Query("WHS3_43", description="WHO GHO indicator code"),
    country: str = Query("USA"),
):
    """Proxy to WHO Global Health Observatory data."""
    data = await fetch_who_indicator(indicator, country)
    return {"source": "who", "count": len(data), "records": data}
