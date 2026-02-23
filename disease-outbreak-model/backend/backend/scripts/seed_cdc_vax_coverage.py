import os
import asyncio
import requests
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from backend.db.models import Location
from backend.db.models import OutbreakHistory

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set.")

DATASET_ID = "aetd-68ew"
BASE_URL = f"https://data.cdc.gov/resource/{DATASET_ID}.json"

EAST_COAST = {
    "Maine": "23",
    "New Hampshire": "33",
    "Massachusetts": "25",
    "Rhode Island": "44",
    "Connecticut": "09",
    "New York": "36",
    "New Jersey": "34",
    "Pennsylvania": "42",
    "Delaware": "10",
    "Maryland": "24",
    "Virginia": "51",
    "North Carolina": "37",
    "South Carolina": "45",
    "Georgia": "13",
    "Florida": "12"
}

async def get_or_create_statewide(session, state_abbr, state_fips):
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
        fips=statewide_fips
    )

    session.add(location)
    await session.flush()
    return location


def fetch_cdc_data():
    where_clause = (
        "geography_type = 'States/Local Areas' "
        "AND dimension = 'Overall' "
        "AND year_season >= '2018'"
    )

    params = {
        "$where": where_clause,
        "$limit": 5000
    }

    r = requests.get(BASE_URL, params=params, timeout=60)
    r.raise_for_status()
    return r.json()


async def main():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    data = fetch_cdc_data()

    async with async_session() as session:
        for row in data:
            state_name = row.get("geography")
            if not state_name:
                continue

            # convert full state name to abbreviation
            state_abbr = None
            for abbr, fips in EAST_COAST.items():
                if row.get("fips", "").startswith(fips):
                    state_abbr = abbr
                    state_fips = fips
                    break

            if not state_abbr:
                continue

            location = await get_or_create_statewide(session, state_abbr, state_fips)

            year = row.get("year_season")
            if not year or not year.isdigit():
                continue

            outbreak = OutbreakHistory(
                location_id=location.id,
                disease_type=f"vaccination_coverage::{row.get('vaccine')}",
                date=f"{year}-01-01",
                case_count=0,
                population=None,
                climate_data={
                    "source": "CDC Socrata",
                    "dataset": DATASET_ID,
                    "estimate_pct": row.get("estimate"),
                    "confidence_interval": row.get("confidence_interval"),
                    "raw": row
                }
            )

            session.add(outbreak)

        await session.commit()

    await engine.dispose()
    print("CDC vaccination coverage data inserted.")


if __name__ == "__main__":
    asyncio.run(main())