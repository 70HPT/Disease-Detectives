"""
Seed script — fetch CDC vaccination coverage data for all 50 states + DC.

Usage:
    DATABASE_URL=... python -m backend.scripts.seed_cdc_vax_coverage
"""

import os
import sys
import asyncio
import logging
from pathlib import Path

import requests
from sqlalchemy import select
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

# ── CDC dataset ──────────────────────────────────────────────────────

DATASET_ID = "aetd-68ew"
BASE_URL = f"https://data.cdc.gov/resource/{DATASET_ID}.json"

# All 50 states + DC: full name → (abbreviation, state FIPS)
STATE_MAP = {
    "Alabama": ("AL", "01"), "Alaska": ("AK", "02"), "Arizona": ("AZ", "04"),
    "Arkansas": ("AR", "05"), "California": ("CA", "06"), "Colorado": ("CO", "08"),
    "Connecticut": ("CT", "09"), "Delaware": ("DE", "10"),
    "District of Columbia": ("DC", "11"), "Florida": ("FL", "12"),
    "Georgia": ("GA", "13"), "Hawaii": ("HI", "15"), "Idaho": ("ID", "16"),
    "Illinois": ("IL", "17"), "Indiana": ("IN", "18"), "Iowa": ("IA", "19"),
    "Kansas": ("KS", "20"), "Kentucky": ("KY", "21"), "Louisiana": ("LA", "22"),
    "Maine": ("ME", "23"), "Maryland": ("MD", "24"), "Massachusetts": ("MA", "25"),
    "Michigan": ("MI", "26"), "Minnesota": ("MN", "27"), "Mississippi": ("MS", "28"),
    "Missouri": ("MO", "29"), "Montana": ("MT", "30"), "Nebraska": ("NE", "31"),
    "Nevada": ("NV", "32"), "New Hampshire": ("NH", "33"), "New Jersey": ("NJ", "34"),
    "New Mexico": ("NM", "35"), "New York": ("NY", "36"),
    "North Carolina": ("NC", "37"), "North Dakota": ("ND", "38"),
    "Ohio": ("OH", "39"), "Oklahoma": ("OK", "40"), "Oregon": ("OR", "41"),
    "Pennsylvania": ("PA", "42"), "Rhode Island": ("RI", "44"),
    "South Carolina": ("SC", "45"), "South Dakota": ("SD", "46"),
    "Tennessee": ("TN", "47"), "Texas": ("TX", "48"), "Utah": ("UT", "49"),
    "Vermont": ("VT", "50"), "Virginia": ("VA", "51"), "Washington": ("WA", "53"),
    "West Virginia": ("WV", "54"), "Wisconsin": ("WI", "55"), "Wyoming": ("WY", "56"),
}

# Build a FIPS prefix → (abbr, state_fips) lookup for matching CDC rows
_FIPS_PREFIX_MAP = {fips: (abbr, fips) for _, (abbr, fips) in STATE_MAP.items()}


async def get_or_create_statewide(session: AsyncSession, state_abbr: str, state_fips: str):
    """Get or create a STATEWIDE location entry (FIPS = XX000)."""
    statewide_fips = f"{state_fips}000"
    result = await session.execute(
        select(Location).where(Location.fips == statewide_fips)
    )
    location = result.scalar_one_or_none()
    if location:
        return location

    location = Location(
        state=state_abbr,
        county="STATEWIDE",
        fips=statewide_fips,
    )
    session.add(location)
    await session.flush()
    return location


def fetch_cdc_data() -> list[dict]:
    """Fetch vaccination coverage data from CDC Socrata API."""
    where_clause = (
        "geography_type = 'States/Local Areas' "
        "AND dimension = 'Overall' "
        "AND year_season >= '2018'"
    )
    params = {
        "$where": where_clause,
        "$limit": 50000,
    }

    logger.info("Fetching CDC vaccination coverage data...")
    r = requests.get(BASE_URL, params=params, timeout=60)
    r.raise_for_status()
    data = r.json()
    logger.info(f"Fetched {len(data)} CDC vaccination records")
    return data


def _match_state(row: dict) -> tuple[str, str] | None:
    """Match a CDC row to a state abbreviation and FIPS code."""
    fips_val = row.get("fips", "")
    for prefix, (abbr, state_fips) in _FIPS_PREFIX_MAP.items():
        if fips_val.startswith(prefix):
            return abbr, state_fips

    # Fallback: match by geography name
    geo = row.get("geography", "")
    for name, (abbr, state_fips) in STATE_MAP.items():
        if geo.lower().startswith(name.lower()):
            return abbr, state_fips

    return None


async def main():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    data = fetch_cdc_data()
    inserted = 0
    skipped = 0

    async with async_session() as session:
        for row in data:
            match = _match_state(row)
            if not match:
                skipped += 1
                continue

            state_abbr, state_fips = match
            location = await get_or_create_statewide(session, state_abbr, state_fips)

            year = row.get("year_season")
            if not year or not year.isdigit():
                skipped += 1
                continue

            outbreak = OutbreakHistory(
                location_id=location.id,
                disease_type=f"vaccination_coverage::{row.get('vaccine', 'unknown')}",
                date=f"{year}-01-01",
                case_count=0,
                population=None,
                climate_data={
                    "source": "CDC Socrata",
                    "dataset": DATASET_ID,
                    "estimate_pct": row.get("estimate"),
                    "confidence_interval": row.get("confidence_interval"),
                },
            )
            session.add(outbreak)
            inserted += 1

            if inserted % 1000 == 0:
                await session.flush()

        await session.commit()

    await engine.dispose()
    logger.info(f"Done. Inserted {inserted} records, skipped {skipped}.")


if __name__ == "__main__":
    asyncio.run(main())
