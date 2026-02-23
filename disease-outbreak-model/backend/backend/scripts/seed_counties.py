"""
Seed script — populate the database with US county data and initial predictions.

Addresses Joshua's blockers:
  1. All ~3,143 US counties with FIPS, population, density, lat/lon
  2. 2-letter state abbreviations (not full names)
  3. Seed predictions so GET /risk/map returns data
  4. Seed outbreak_history from the AtlasPlus training data

Usage:
    python -m backend.scripts.seed_counties

Requires DATABASE_URL env var or .env file.
"""

import asyncio
import csv
import io
import logging
import os
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

import httpx
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Add parent to path so we can import backend modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.db.models import Location, Prediction, OutbreakHistory, ModelMetadata
from backend.db.session import Base

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ── State FIPS → abbreviation mapping ────────────────────────────────

STATE_FIPS_TO_ABBR = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
    "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
    "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
    "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
    "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
    "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
    "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
    "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
    "56": "WY", "72": "PR",
}


# ── 1. Fetch county data from Census Bureau ─────────────────────────

async def fetch_county_data() -> list[dict]:
    """
    Fetch all US counties from the Census Bureau API (no auth required).
    Returns list of {fips, state, county, population}.
    """
    logger.info("Fetching county population data from Census Bureau...")
    url = "https://api.census.gov/data/2022/acs/acs5"
    params = {
        "get": "NAME,B01001_001E",  # name + total population
        "for": "county:*",
        "in": "state:*",
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            rows = resp.json()
    except Exception as e:
        logger.warning(f"Census API failed ({e}), falling back to bundled data")
        return _fallback_county_data()

    # First row is headers: ["NAME", "B01001_001E", "state", "county"]
    if len(rows) < 2:
        logger.warning("Census API returned no data, using fallback")
        return _fallback_county_data()

    counties = []
    for row in rows[1:]:
        name, population, state_fips, county_fips = row
        fips = f"{state_fips}{county_fips}"
        state_abbr = STATE_FIPS_TO_ABBR.get(state_fips)
        if not state_abbr:
            continue  # skip territories we don't map

        # Parse county name: "Los Angeles County, California" → "Los Angeles"
        county_name = name.split(",")[0].strip()
        for suffix in [" County", " Parish", " Borough", " Census Area",
                       " Municipality", " city", " City and Borough"]:
            if county_name.endswith(suffix):
                county_name = county_name[: -len(suffix)]
                break

        pop = int(population) if population and population != "null" else None

        counties.append({
            "fips": fips,
            "state": state_abbr,
            "county": county_name,
            "population": pop,
        })

    logger.info(f"Fetched {len(counties)} counties from Census Bureau")
    return counties


def _fallback_county_data() -> list[dict]:
    """
    Minimal fallback: generate synthetic entries for all 50 states.
    Only used if Census API is unreachable.
    """
    logger.info("Generating synthetic county data as fallback")
    random.seed(42)
    counties = []
    for state_fips, abbr in STATE_FIPS_TO_ABBR.items():
        if state_fips == "72":
            continue  # skip PR for simplicity
        # Create 20-60 synthetic counties per state
        n = random.randint(20, 60)
        for i in range(n):
            county_fips = f"{i+1:03d}"
            counties.append({
                "fips": f"{state_fips}{county_fips}",
                "state": abbr,
                "county": f"County {i+1}",
                "population": random.randint(5000, 2_000_000),
            })
    return counties


# ── 2. Fetch county coordinates ─────────────────────────────────────

async def fetch_county_coordinates() -> dict[str, tuple[float, float]]:
    """
    Fetch county centroids from Census Bureau gazetteer files.
    Returns dict of fips → (latitude, longitude).
    """
    logger.info("Fetching county coordinates from Census gazetteer...")
    url = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_counties_national.txt"

    coords = {}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            text_content = resp.text

        reader = csv.DictReader(io.StringIO(text_content), delimiter="\t")
        for row in reader:
            geoid = row.get("GEOID", "").strip()
            lat = row.get("INTPTLAT", "").strip()
            lon = row.get("INTPTLONG", "").strip()
            if geoid and lat and lon:
                try:
                    coords[geoid] = (float(lat), float(lon))
                except ValueError:
                    pass

        logger.info(f"Fetched coordinates for {len(coords)} counties")
    except Exception as e:
        logger.warning(f"Gazetteer fetch failed ({e}), coordinates will be null")

    return coords


# ── 3. Load outbreak data from AtlasPlus CSV ────────────────────────

def load_atlasplus_data() -> dict[str, list[dict]]:
    """
    Load the AtlasPlus training data (already in the repo) to seed
    outbreak_history.  Groups by FIPS code.

    Returns: {fips: [{year, cases, outbreak}, ...]}
    """
    # Try to find the CSV relative to the repo root
    candidates = [
        Path(__file__).resolve().parent.parent.parent.parent
        / "disease-outbreak-model" / "data" / "atlasplus_all_us_train.csv",
        Path.cwd() / "data" / "atlasplus_all_us_train.csv",
        Path.cwd() / "disease-outbreak-model" / "data" / "atlasplus_all_us_train.csv",
    ]

    csv_path = None
    for p in candidates:
        if p.exists():
            csv_path = p
            break

    if not csv_path:
        logger.warning("AtlasPlus CSV not found — skipping outbreak history seed")
        return {}

    logger.info(f"Loading AtlasPlus data from {csv_path}")
    data: dict[str, list[dict]] = {}
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            fips = str(row.get("FIPS", "")).strip()
            if not fips or len(fips) < 5:
                continue
            fips = fips[:5]

            try:
                year = int(float(row.get("Year", 0)))
                cases = int(float(row.get("Cases", 0)))
                outbreak = int(float(row.get("Outbreak", 0)))
            except (ValueError, TypeError):
                continue

            lag1 = float(row.get("Cases_lag_1", 0) or 0)
            lag2 = float(row.get("Cases_lag_2", 0) or 0)
            lag3 = float(row.get("Cases_lag_3", 0) or 0)

            data.setdefault(fips, []).append({
                "year": year,
                "cases": cases,
                "outbreak": outbreak,
                "cases_lag_1": lag1,
                "cases_lag_2": lag2,
                "cases_lag_3": lag3,
            })

    logger.info(f"Loaded outbreak data for {len(data)} counties")
    return data


# ── 4. Main seed function ────────────────────────────────────────────

async def seed_database(database_url: str | None = None):
    """Seed the database with counties, predictions, and outbreak history."""

    if not database_url:
        database_url = os.getenv("DATABASE_URL")
    if not database_url:
        # Try loading from .env
        env_path = Path(__file__).resolve().parent.parent.parent / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("DATABASE_URL="):
                    database_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

    if not database_url:
        logger.error("DATABASE_URL not set. Pass it as an argument or set the env var.")
        sys.exit(1)

    engine = create_async_engine(database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("=" * 70)
    logger.info("SEEDING DATABASE")
    logger.info("=" * 70)

    # Check current state
    async with async_session() as session:
        loc_count = (await session.execute(select(func.count(Location.id)))).scalar()
        logger.info(f"Current locations in DB: {loc_count}")

    # Fetch data
    county_data, coords = await asyncio.gather(
        fetch_county_data(),
        fetch_county_coordinates(),
    )
    atlas_data = load_atlasplus_data()

    # ── Insert locations ─────────────────────────────────────────────
    async with async_session() as session:
        # Clear existing data for a clean seed
        await session.execute(text("DELETE FROM predictions"))
        await session.execute(text("DELETE FROM outbreak_history"))
        await session.execute(text("DELETE FROM locations"))
        await session.commit()

        logger.info(f"Inserting {len(county_data)} counties...")
        location_map: dict[str, int] = {}  # fips → location_id

        batch = []
        for cd in county_data:
            lat, lon = coords.get(cd["fips"], (None, None))
            pop = cd["population"]
            # Compute density (people per sq mi, estimate)
            density = None
            if pop and lat:
                # Rough approximation: avg US county ~1,000 sq mi
                density = round(pop / 1000, 2)

            loc = Location(
                state=cd["state"],
                county=cd["county"],
                fips=cd["fips"],
                population=pop,
                density=density,
                latitude=lat,
                longitude=lon,
                economic_data=None,
            )
            batch.append(loc)

        session.add_all(batch)
        await session.flush()

        for loc in batch:
            location_map[loc.fips] = loc.id

        await session.commit()
        logger.info(f"Inserted {len(batch)} locations")

    # ── Insert outbreak history from AtlasPlus ───────────────────────
    async with async_session() as session:
        history_count = 0
        history_batch = []

        for fips, records in atlas_data.items():
            loc_id = location_map.get(fips)
            if not loc_id:
                continue

            for rec in records:
                oh = OutbreakHistory(
                    location_id=loc_id,
                    disease_type="chlamydia",
                    date=datetime(rec["year"], 7, 1),  # mid-year
                    case_count=rec["cases"],
                    population=None,
                    climate_data={
                        "cases_lag_1": rec["cases_lag_1"],
                        "cases_lag_2": rec["cases_lag_2"],
                        "cases_lag_3": rec["cases_lag_3"],
                        "outbreak": rec["outbreak"],
                    },
                )
                history_batch.append(oh)
                history_count += 1

                # Flush in batches of 5000
                if len(history_batch) >= 5000:
                    session.add_all(history_batch)
                    await session.flush()
                    history_batch = []

        if history_batch:
            session.add_all(history_batch)

        await session.commit()
        logger.info(f"Inserted {history_count} outbreak_history records")

    # ── Generate initial predictions ─────────────────────────────────
    async with async_session() as session:
        pred_count = 0
        pred_batch = []
        now = datetime.utcnow()

        for fips, loc_id in location_map.items():
            # Use the latest AtlasPlus data if available to make
            # predictions more realistic
            records = atlas_data.get(fips, [])
            if records:
                latest = sorted(records, key=lambda r: r["year"])[-1]
                cases = latest["cases"]
                is_outbreak = latest["outbreak"]
                # Score based on actual outbreak status + some noise
                base_score = 70 + random.uniform(-10, 20) if is_outbreak else 25 + random.uniform(-10, 15)
            else:
                # No AtlasPlus data — generate based on population
                county_data_item = next((c for c in county_data if c["fips"] == fips), None)
                pop = (county_data_item["population"] or 50000) if county_data_item else 50000
                base_score = 20 + (pop / 1_000_000) * 30 + random.uniform(-5, 15)
                cases = 0

            score = round(min(max(base_score, 0), 100), 2)

            pred = Prediction(
                location_id=loc_id,
                risk_score=score,
                confidence=round(random.uniform(0.4, 0.9), 4),
                factors={
                    "population_density": round(random.uniform(0.1, 0.8), 3),
                    "climate_risk": round(random.uniform(0.1, 0.6), 3),
                    "vaccination_coverage": round(random.uniform(0.1, 0.7), 3),
                    "historical_trend": round(random.uniform(0.1, 0.9), 3),
                    "search_trend": round(random.uniform(0.05, 0.5), 3),
                },
                timestamp=now - timedelta(hours=random.randint(0, 48)),
                model_version="us_lstm_v1",
            )
            pred_batch.append(pred)
            pred_count += 1

            if len(pred_batch) >= 5000:
                session.add_all(pred_batch)
                await session.flush()
                pred_batch = []

        if pred_batch:
            session.add_all(pred_batch)

        await session.commit()
        logger.info(f"Inserted {pred_count} predictions")

    # ── Insert model metadata ────────────────────────────────────────
    async with async_session() as session:
        existing = (await session.execute(
            select(ModelMetadata).where(ModelMetadata.version == "us_lstm_v1")
        )).scalar_one_or_none()

        if not existing:
            meta = ModelMetadata(
                version="us_lstm_v1",
                disease="chlamydia",
                trained_at=datetime(2026, 2, 20),
                metrics={
                    "auc": 0.85,
                    "accuracy": 0.80,
                    "description": "LSTM binary classifier trained on full US AtlasPlus data",
                },
                feature_columns=["Cases", "Cases_lag_1", "Cases_lag_2", "Cases_lag_3"],
                file_path="models/best_us_lstm_classifier.pth",
                is_active="true",
            )
            session.add(meta)
            await session.commit()
            logger.info("Inserted model metadata")

    await engine.dispose()

    logger.info("=" * 70)
    logger.info("SEED COMPLETE")
    logger.info(f"  Locations:        {len(location_map)}")
    logger.info(f"  Outbreak history: {history_count}")
    logger.info(f"  Predictions:      {pred_count}")
    logger.info("=" * 70)


if __name__ == "__main__":
    asyncio.run(seed_database())
