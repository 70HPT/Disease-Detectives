"""
Seed outbreak_history rows for statewide rollup locations (FIPS = XX000).

The CSV training data in seed_counties.py is state-level aggregate data but
was incorrectly assigned to the first county of each state. This script reads
the same CSVs and inserts the records into the correct XX000 FIPS locations
so the frontend's state-level chart shows real statewide totals.

Usage:
    python -m backend.scripts.seed_statewide_history
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.db.models import Location, OutbreakHistory
from backend.db.session import Base

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────

STATE_ABBR_TO_FIPS = {
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

DISEASE_CSV_CONFIGS = {
    "influenza": {
        "candidates": ["data/flu_national_weekly_train.csv", "data/flu_national_weekly_all.csv"],
        "date_col": "Week Ending Date",
    },
    "covid": {
        "candidates": ["data/covid_weekly_train.csv", "data/covid_weekly_all.csv"],
        "date_col": "Week Ending Date",
    },
    "salmonella": {
        "candidates": ["data/salmonella_monthly_train.csv", "data/salmonella_monthly_all.csv"],
        "date_col": "Date",
    },
}


# ── Helpers ──────────────────────────────────────────────────────────

def _load_csv_records() -> dict[str, dict[str, list[dict]]]:
    """Load all disease CSVs. Returns {disease: {state: [{date, cases}]}}."""
    root = Path(__file__).resolve().parents[3]
    result: dict[str, dict[str, list[dict]]] = {}

    for disease, cfg in DISEASE_CSV_CONFIGS.items():
        csv_path = None
        for candidate in cfg["candidates"]:
            p = root / candidate
            if p.exists():
                csv_path = p
                break

        if not csv_path:
            logger.warning(f"{disease}: CSV not found, skipping")
            continue

        logger.info(f"Loading {disease} from {csv_path.name}")
        try:
            df = pd.read_csv(csv_path)
            if "State" not in df.columns or "Cases" not in df.columns:
                logger.warning(f"{disease}: CSV missing State or Cases column, skipping")
                continue

            by_state: dict[str, list[dict]] = {}
            for _, row in df.iterrows():
                state = str(row.get("State", "")).strip()
                date_str = str(row.get(cfg["date_col"], "")).strip()
                cases = int(float(row.get("Cases", 0) or 0))
                if state and date_str:
                    by_state.setdefault(state, []).append({"date": date_str, "cases": cases})

            result[disease] = by_state
            logger.info(f"{disease}: {sum(len(v) for v in by_state.values())} records across {len(by_state)} states")

        except Exception as e:
            logger.warning(f"{disease}: failed to load CSV — {e}")

    return result


async def _get_or_create_statewide(session: AsyncSession, state_abbr: str) -> int | None:
    """Return the id of the XX000 statewide location, creating it if needed."""
    fips2 = STATE_ABBR_TO_FIPS.get(state_abbr)
    if not fips2:
        return None
    statewide_fips = f"{fips2}000"

    result = await session.execute(select(Location).where(Location.fips == statewide_fips))
    loc = result.scalar_one_or_none()
    if loc:
        return loc.id

    loc = Location(state=state_abbr, county="STATEWIDE", fips=statewide_fips)
    session.add(loc)
    await session.flush()
    logger.info(f"Created statewide location {statewide_fips} for {state_abbr}")
    return loc.id


# ── Main ─────────────────────────────────────────────────────────────

async def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("DATABASE_URL="):
                    database_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

    if not database_url:
        raise RuntimeError("DATABASE_URL is not set.")

    engine = create_async_engine(database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    disease_data = _load_csv_records()

    total_inserted = 0
    total_skipped = 0

    for disease, by_state in disease_data.items():
        inserted = 0
        skipped = 0

        async with async_session() as session:
            for state_abbr, records in by_state.items():
                loc_id = await _get_or_create_statewide(session, state_abbr)
                if not loc_id:
                    skipped += len(records)
                    continue

                for rec in records:
                    try:
                        date = datetime.strptime(rec["date"][:10], "%Y-%m-%d")
                    except (ValueError, TypeError):
                        skipped += 1
                        continue

                    # Skip if this exact row already exists
                    existing = await session.execute(
                        select(OutbreakHistory.id).where(
                            OutbreakHistory.location_id == loc_id,
                            OutbreakHistory.disease_type == disease,
                            OutbreakHistory.date == date,
                        )
                    )
                    if existing.scalar_one_or_none():
                        skipped += 1
                        continue

                    session.add(OutbreakHistory(
                        location_id=loc_id,
                        disease_type=disease,
                        date=date,
                        case_count=rec["cases"],
                        population=None,
                        climate_data={"source": "csv_statewide"},
                    ))
                    inserted += 1

                    if inserted % 2000 == 0:
                        await session.flush()

            await session.commit()

        logger.info(f"{disease}: inserted {inserted}, skipped {skipped} (already existed)")
        total_inserted += inserted
        total_skipped += skipped

    await engine.dispose()
    logger.info(f"Done. Total inserted: {total_inserted} | Already existed: {total_skipped}")


if __name__ == "__main__":
    asyncio.run(main())
