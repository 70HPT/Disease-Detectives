"""
Weekly CDC surveillance seed — fetches latest flu and COVID case data
and upserts into outbreak_history.

Salmonella is excluded: NORS data is investigation-based (not weekly
surveillance) and is seeded from the local CSV via seed_counties.

Usage:
    DATABASE_URL=... python -m backend.scripts.seed_cdc_surveillance

CDC Socrata datasets used:
  - COVID: r8kw-7aab  Provisional COVID-19 Death Counts by Week and State
  - Flu:   hzd4-9x4s  Influenza-Associated Pediatric Mortality (FluView)
           ua7e-t2fy  NHSN Weekly Hospital Respiratory Data (flu hospitalisations)
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import requests
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.db.models import Location, OutbreakHistory
from backend.db.session import Base

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ── Load DATABASE_URL ────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                DATABASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set.")

# ── State name → abbreviation ────────────────────────────────────────

STATE_NAME_TO_ABBR = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA",
    "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN",
    "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI",
    "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO", "Montana": "MT",
    "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
    "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
    "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY",
}

STATE_FIPS = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08",
    "CT": "09", "DE": "10", "DC": "11", "FL": "12", "GA": "13", "HI": "15",
    "ID": "16", "IL": "17", "IN": "18", "IA": "19", "KS": "20", "KY": "21",
    "LA": "22", "ME": "23", "MD": "24", "MA": "25", "MI": "26", "MN": "27",
    "MS": "28", "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33",
    "NJ": "34", "NM": "35", "NY": "36", "NC": "37", "ND": "38", "OH": "39",
    "OK": "40", "OR": "41", "PA": "42", "RI": "44", "SC": "45", "SD": "46",
    "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51", "WA": "53",
    "WV": "54", "WI": "55", "WY": "56",
}


# ── CDC fetch helpers ────────────────────────────────────────────────

def _fetch_socrata(dataset_id: str, where: str, limit: int = 100000) -> list[dict]:
    url = f"https://data.cdc.gov/resource/{dataset_id}.json"
    params = {"$where": where, "$limit": limit}
    r = requests.get(url, params=params, timeout=60)
    r.raise_for_status()
    return r.json()


def fetch_covid_records() -> list[dict]:
    """
    Provisional COVID-19 Death Counts by Week Ending Date and State.
    Dataset: r8kw-7aab
    Returns [{state_abbr, date, cases}]
    """
    logger.info("Fetching COVID weekly data from CDC...")
    rows = _fetch_socrata(
        "r8kw-7aab",
        where="group = 'By Week' AND state != 'United States'",
    )
    results = []
    for row in rows:
        state_name = row.get("state", "")
        abbr = STATE_NAME_TO_ABBR.get(state_name)
        if not abbr:
            continue
        date_str = row.get("end_date", row.get("week_ending_date", ""))
        if not date_str:
            continue
        cases = int(float(row.get("covid_19_deaths", 0) or 0))
        results.append({"state": abbr, "date": date_str[:10], "cases": cases})

    logger.info(f"Fetched {len(results)} COVID records")
    return results


def fetch_flu_records() -> list[dict]:
    """
    NHSN Weekly Hospital Respiratory Data — influenza hospitalisations by state.
    Dataset: ua7e-t2fy
    Returns [{state_abbr, date, cases}]
    """
    logger.info("Fetching flu weekly data from CDC NHSN...")
    rows = _fetch_socrata(
        "ua7e-t2fy",
        where="geographic_aggregation != 'Nationally'",
    )
    results = []
    for row in rows:
        state_name = row.get("geographic_aggregation", "")
        abbr = STATE_NAME_TO_ABBR.get(state_name)
        if not abbr:
            continue
        date_str = row.get("week_ending_date", "")
        if not date_str:
            continue
        cases = int(float(row.get("total_patients_hospitalized_with_influenza", 0) or 0))
        results.append({"state": abbr, "date": date_str[:10], "cases": cases})

    logger.info(f"Fetched {len(results)} flu records")
    return results


# ── DB helpers ───────────────────────────────────────────────────────

async def get_or_create_statewide(session: AsyncSession, state_abbr: str) -> int | None:
    """Get or create a STATEWIDE location (FIPS = XX000). Returns location id."""
    fips = STATE_FIPS.get(state_abbr)
    if not fips:
        return None
    statewide_fips = f"{fips}000"

    result = await session.execute(select(Location).where(Location.fips == statewide_fips))
    loc = result.scalar_one_or_none()
    if loc:
        return loc.id

    loc = Location(state=state_abbr, county="STATEWIDE", fips=statewide_fips)
    session.add(loc)
    await session.flush()
    return loc.id


async def upsert_records(
    session: AsyncSession,
    records: list[dict],
    disease_type: str,
    source: str,
) -> int:
    """Insert outbreak_history rows, skipping duplicates (same location+disease+date)."""
    inserted = 0
    for rec in records:
        loc_id = await get_or_create_statewide(session, rec["state"])
        if not loc_id:
            continue

        try:
            date = datetime.strptime(rec["date"], "%Y-%m-%d")
        except (ValueError, TypeError):
            continue

        existing = await session.execute(
            select(OutbreakHistory).where(
                OutbreakHistory.location_id == loc_id,
                OutbreakHistory.disease_type == disease_type,
                OutbreakHistory.date == date,
            )
        )
        if existing.scalar_one_or_none():
            continue

        oh = OutbreakHistory(
            location_id=loc_id,
            disease_type=disease_type,
            date=date,
            case_count=rec["cases"],
            population=None,
            climate_data={"source": source},
        )
        session.add(oh)
        inserted += 1

        if inserted % 1000 == 0:
            await session.flush()

    return inserted


# ── Main ─────────────────────────────────────────────────────────────

async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    covid_records = fetch_covid_records()
    flu_records = fetch_flu_records()

    total = 0
    async with async_session() as session:
        n = await upsert_records(session, covid_records, "covid", "CDC r8kw-7aab")
        await session.commit()
        logger.info(f"COVID: inserted {n} new records")
        total += n

    async with async_session() as session:
        n = await upsert_records(session, flu_records, "influenza", "CDC ua7e-t2fy")
        await session.commit()
        logger.info(f"Influenza: inserted {n} new records")
        total += n

    await engine.dispose()
    logger.info(f"Done. Total new records: {total}")


if __name__ == "__main__":
    asyncio.run(main())
