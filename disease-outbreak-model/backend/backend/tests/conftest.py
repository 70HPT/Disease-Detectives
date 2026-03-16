"""
Shared fixtures for pytest.
Uses an in-memory SQLite database to avoid needing PostgreSQL for tests.
"""

import asyncio
import pytest
import pytest_asyncio
from unittest.mock import patch, MagicMock

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from backend.db.session import Base, get_db
from backend.db.models import Location, Prediction, OutbreakHistory


# ── Async event loop ─────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── Test database (SQLite async) ─────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///file::memory:?cache=shared&uri=true"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session():
    """Yield a fresh DB session with all tables created."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSession() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ── Override FastAPI DB dependency ───────────────────────────────────

async def _override_get_db():
    async with TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    """HTTP test client with DB dependency overridden."""
    # Mock the ML model so it doesn't try to load .pth files
    with patch("backend.services.ml_service.prediction_service") as mock_ps:
        mock_ps.is_loaded = False
        mock_ps.model_version = "test_mock"
        mock_ps.predict.return_value = {
            "raw_prediction": 50.0,
            "risk_score": 42.5,
            "confidence": 0.75,
            "risk_level": "moderate",
            "factors": {
                "population_density": 0.3,
                "climate_risk": 0.2,
                "vaccination_coverage": 0.4,
                "historical_trend": 0.5,
                "search_trend": 0.1,
            },
            "model_version": "test_mock",
            "generated_at": "2026-01-01T00:00:00",
        }
        mock_ps.get_state_map_data.return_value = []

        from backend.main import app
        app.dependency_overrides[get_db] = _override_get_db

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

        app.dependency_overrides.clear()


# ── Seed helpers ─────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def sample_location(db_session) -> Location:
    """Insert a single test location."""
    loc = Location(
        state="CA",
        county="Los Angeles",
        fips="06037",
        population=10000000,
        density=10000.0,
        latitude=34.05,
        longitude=-118.24,
    )
    db_session.add(loc)
    await db_session.commit()
    await db_session.refresh(loc)
    return loc


@pytest_asyncio.fixture
async def sample_prediction(db_session, sample_location) -> Prediction:
    """Insert a test prediction."""
    from datetime import datetime
    pred = Prediction(
        location_id=sample_location.id,
        risk_score=55.0,
        confidence=0.8,
        factors={
            "population_density": 0.5,
            "climate_risk": 0.3,
            "vaccination_coverage": 0.4,
            "historical_trend": 0.6,
            "search_trend": 0.2,
        },
        timestamp=datetime(2026, 1, 15),
        model_version="test_v1",
    )
    db_session.add(pred)
    await db_session.commit()
    await db_session.refresh(pred)
    return pred
