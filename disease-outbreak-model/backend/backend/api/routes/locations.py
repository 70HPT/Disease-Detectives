"""
/api/v1/locations — Location lookup and listing endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from backend.db.session import get_db
from backend.db.models import Location
from backend.schemas.risk import LocationOut

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("/", response_model=list[LocationOut])
async def list_locations(
    state: Optional[str] = Query(None, max_length=2, description="Filter by state abbreviation"),
    limit: int = Query(100, le=5000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List all tracked locations, optionally filtered by state."""
    query = select(Location).offset(offset).limit(limit).order_by(Location.state, Location.county)
    if state:
        query = query.where(Location.state == state.upper())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{fips}", response_model=LocationOut)
async def get_location(fips: str, db: AsyncSession = Depends(get_db)):
    """Get a single location by FIPS code."""
    result = await db.execute(select(Location).where(Location.fips == fips))
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail=f"Location not found: {fips}")
    return location


@router.get("/states/list")
async def list_states(db: AsyncSession = Depends(get_db)):
    """Get distinct states that have locations in the database."""
    result = await db.execute(
        select(Location.state).distinct().order_by(Location.state)
    )
    return [row[0] for row in result.all()]
