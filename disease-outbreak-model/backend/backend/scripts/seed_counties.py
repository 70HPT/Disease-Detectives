"""
Seed script — populate the database with US county data and initial predictions.

  1. All ~3,143 US counties with FIPS, population, density, lat/lon
  2. Seed predictions so GET /risk/map returns data immediately
  3. Seed outbreak_history from flu weekly training data (if available)

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
from datetime import datetime, timedelta, timezone
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
    "56": "WY",
}

ABBR_TO_STATE_FIPS = {v: k for k, v in STATE_FIPS_TO_ABBR.items()}


# ── 1. Fetch county data from Census Bureau ─────────────────────────

async def fetch_county_data() -> list[dict]:
    """
    Fetch all US counties from the Census Bureau API (no auth required).
    Returns list of {fips, state, county, population}.
    """
    logger.info("Fetching county population data from Census Bureau...")
    url = "https://api.census.gov/data/2022/acs/acs5"
    params = {
        "get": "NAME,B01001_001E",
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

    if len(rows) < 2:
        logger.warning("Census API returned no data, using fallback")
        return _fallback_county_data()

    counties = []
    for row in rows[1:]:
        name, population, state_fips, county_fips = row
        fips = f"{state_fips}{county_fips}"
        state_abbr = STATE_FIPS_TO_ABBR.get(state_fips)
        if not state_abbr:
            continue

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
    """Minimal fallback: synthetic entries for all 50 states + DC."""
    logger.info("Generating synthetic county data as fallback")
    random.seed(42)
    counties = []
    for state_fips, abbr in STATE_FIPS_TO_ABBR.items():
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
    """Fetch county centroids from Census Bureau gazetteer files."""
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


# ── 3. Load disease history for outbreak_history seeding ─────────────

_DISEASE_CSV_CONFIGS = {
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


def load_disease_history() -> dict[str, dict[str, list[dict]]]:
    """
    Load case history for all three diseases from local CSVs.
    Returns: {disease: {state_abbr: [{date, cases}, ...]}}
    """
    import pandas as pd

    root = Path(__file__).resolve().parents[3]
    all_data: dict[str, dict[str, list[dict]]] = {}

    for disease, cfg in _DISEASE_CSV_CONFIGS.items():
        csv_path = None
        for candidate in cfg["candidates"]:
            p = root / candidate
            if p.exists():
                csv_path = p
                break

        if not csv_path:
            logger.warning(f"{disease} CSV not found — skipping")
            continue

        logger.info(f"Loading {disease} data from {csv_path}")
        data: dict[str, list[dict]] = {}

        try:
            df = pd.read_csv(csv_path)
            date_col = cfg["date_col"]
            if "State" not in df.columns or "Cases" not in df.columns:
                logger.warning(f"{disease} CSV missing State or Cases column")
                continue

            for _, row in df.iterrows():
                state = str(row.get("State", "")).strip()
                if not state:
                    continue
                cases = int(float(row.get("Cases", 0) or 0))
                date_str = str(row.get(date_col, ""))
                data.setdefault(state, []).append({"date": date_str, "cases": cases})

        except Exception as e:
            logger.warning(f"Failed to load {disease} data: {e}")
            continue

        logger.info(f"Loaded {disease} data for {len(data)} states")
        all_data[disease] = data

    return all_data


# ── 4. Main seed function ────────────────────────────────────────────

async def seed_database(database_url: str | None = None):
    """Seed the database with counties, predictions, and outbreak history."""

    if not database_url:
        database_url = os.getenv("DATABASE_URL")
    if not database_url:
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
    disease_history = load_disease_history()

    # ── Insert locations ─────────────────────────────────────────────
    async with async_session() as session:
        # Preserve vaccination_coverage rows (and their statewide XX000 locations)
        # from seed_cdc_vax_coverage; only clear county-level data
        await session.execute(text("DELETE FROM predictions"))
        await session.execute(text("DELETE FROM outbreak_history WHERE disease_type NOT LIKE 'vaccination_coverage::%'"))
        await session.execute(text("DELETE FROM locations WHERE fips NOT SIMILAR TO '[0-9]{2}000'"))
        await session.commit()

        logger.info(f"Inserting {len(county_data)} counties...")
        location_map: dict[str, int] = {}
        state_location_map: dict[str, list[str]] = {}  # state → [fips]

        batch = []
        for cd in county_data:
            lat, lon = coords.get(cd["fips"], (None, None))
            pop = cd["population"]
            density = round(pop / 1000, 2) if pop and lat else None

            loc = Location(
                state=cd["state"],
                county=cd["county"],
                fips=cd["fips"],
                population=pop,
                density=density,
                latitude=lat,
                longitude=lon,
            )
            batch.append(loc)
            state_location_map.setdefault(cd["state"], []).append(cd["fips"])

        session.add_all(batch)
        await session.flush()

        for loc in batch:
            location_map[loc.fips] = loc.id

        await session.commit()
        logger.info(f"Inserted {len(batch)} locations")

    # ── Insert outbreak history into statewide (XX000) locations ────────
    # CSV data is state-level aggregates; must go to XX000 rollup rows,
    # not the first county of each state.
    history_count = 0
    async with async_session() as session:
        history_batch = []

        for disease, state_records in disease_history.items():
            source = _DISEASE_CSV_CONFIGS[disease]["candidates"][0].split("/")[-1].replace(".csv", "")

            for state_abbr, records in state_records.items():
                state_fips = ABBR_TO_STATE_FIPS.get(state_abbr)
                if not state_fips:
                    continue
                statewide_fips = f"{state_fips}000"

                # Find or create the statewide rollup location
                sw_result = await session.execute(
                    select(Location).where(Location.fips == statewide_fips)
                )
                sw_loc = sw_result.scalar_one_or_none()
                if not sw_loc:
                    sw_loc = Location(state=state_abbr, county="STATEWIDE", fips=statewide_fips)
                    session.add(sw_loc)
                    await session.flush()

                loc_id = sw_loc.id

                for rec in records:
                    try:
                        date = datetime.strptime(rec["date"], "%Y-%m-%d") if rec["date"] else datetime(2023, 1, 1)
                    except (ValueError, TypeError):
                        date = datetime(2023, 1, 1)

                    oh = OutbreakHistory(
                        location_id=loc_id,
                        disease_type=disease,
                        date=date,
                        case_count=rec["cases"],
                        population=None,
                        climate_data={"source": source},
                    )
                    history_batch.append(oh)
                    history_count += 1

                    if len(history_batch) >= 5000:
                        session.add_all(history_batch)
                        await session.flush()
                        history_batch = []

        if history_batch:
            session.add_all(history_batch)

        await session.commit()
        logger.info(f"Inserted {history_count} outbreak_history records")

    # ── Generate initial predictions (all three diseases) ────────────
    pred_count = 0
    async with async_session() as session:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        random.seed(42)

        # Load all disease models
        disease_state_probs: dict[str, dict[str, float]] = {}
        try:
            from backend.services.ml_service import prediction_service, DISEASE_CONFIGS
            prediction_service.load_all_models()
            disease_state_probs = prediction_service.disease_state_probs
            logger.info(f"Loaded models for diseases: {list(disease_state_probs.keys())}")
        except Exception as e:
            logger.warning(f"Could not load ML models for seeding: {e}")

        # Build fips→state lookup once
        fips_to_state = {cd["fips"]: cd["state"] for cd in county_data}

        diseases = list(DISEASE_CONFIGS.keys()) if disease_state_probs else ["influenza"]
        pred_batch = []

        for disease in diseases:
            state_probs = disease_state_probs.get(disease, {})
            model_version = DISEASE_CONFIGS[disease]["version"] if disease_state_probs else f"{disease}_lstm_v1"

            for fips, loc_id in location_map.items():
                state_abbr = fips_to_state.get(fips)

                if state_abbr and state_abbr in state_probs:
                    prob = state_probs[state_abbr]
                    base_score = prob * 100 + random.uniform(-5, 5)
                else:
                    base_score = random.uniform(15, 70)

                score = round(min(max(base_score, 0), 100), 2)

                pred = Prediction(
                    location_id=loc_id,
                    disease_type=disease,
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
                    model_version=model_version,
                )
                pred_batch.append(pred)
                pred_count += 1

                if len(pred_batch) >= 5000:
                    session.add_all(pred_batch)
                    await session.flush()
                    pred_batch = []

            logger.info(f"Queued {len(location_map)} predictions for {disease}")

        if pred_batch:
            session.add_all(pred_batch)

        await session.commit()
        logger.info(f"Inserted {pred_count} predictions total ({len(diseases)} diseases)")

    # ── Insert model metadata ────────────────────────────────────────
    MODEL_META = [
        {
            "version": "influenza_lstm_v1",
            "disease": "influenza",
            "description": "LSTM binary classifier trained on national flu weekly data",
            "file_path": "models/best_influenza_lstm_classifier.pth",
        },
        {
            "version": "covid_lstm_v1",
            "disease": "covid",
            "description": "LSTM binary classifier trained on national COVID weekly data",
            "file_path": "models/best_covid_lstm_classifier.pth",
        },
        {
            "version": "salmonella_lstm_v1",
            "disease": "salmonella",
            "description": "LSTM binary classifier trained on national salmonella monthly data",
            "file_path": "models/best_salmonella_lstm_classifier.pth",
        },
    ]

    async with async_session() as session:
        for meta_def in MODEL_META:
            existing = (await session.execute(
                select(ModelMetadata).where(ModelMetadata.version == meta_def["version"])
            )).scalar_one_or_none()

            if not existing:
                meta = ModelMetadata(
                    version=meta_def["version"],
                    disease=meta_def["disease"],
                    trained_at=datetime(2026, 3, 1),
                    metrics={"description": meta_def["description"]},
                    feature_columns=[],
                    file_path=meta_def["file_path"],
                    is_active="true",
                )
                session.add(meta)

        await session.commit()
        logger.info("Inserted model metadata for all diseases")

    await engine.dispose()

    logger.info("=" * 70)
    logger.info("SEED COMPLETE")
    logger.info(f"  Locations:        {len(location_map)}")
    logger.info(f"  Outbreak history: {history_count}")
    logger.info(f"  Predictions:      {pred_count}")
    logger.info("=" * 70)


if __name__ == "__main__":
    asyncio.run(seed_database())
