"""
Disease Detective — FastAPI Backend Application.

Entry point: uvicorn backend.main:app --reload
Docs:        http://localhost:8000/docs
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import get_settings
from backend.db.session import init_db
from backend.services.ml_service import prediction_service
from backend.middleware.rate_limit import RateLimitMiddleware
from backend.api.routes import risk, locations, data, health

settings = get_settings()

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(name)-25s | %(levelname)-7s | %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run on startup: initialize DB tables and load ML model."""
    logger.info("Starting Disease Detective API...")

    # Initialize database tables (dev convenience)
    await init_db()
    logger.info("Database initialized")

    # Load ML model into memory
    prediction_service.load_model(settings.model_path, settings.model_device)
    if prediction_service.is_loaded:
        logger.info(f"ML model loaded: {prediction_service.model_version}")
    else:
        logger.warning("ML model not found — running with mock predictions")

    yield

    logger.info("Shutting down Disease Detective API")


# ── App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "AI-powered disease outbreak prediction system. "
        "Provides risk scores (0-100) for U.S. counties using CDC, Census, "
        "NOAA, and WHO data fed through a trained neural network."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ── Middleware ────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)


# ── Routes ───────────────────────────────────────────────────────────

API_V1 = "/api/v1"

app.include_router(health.router, prefix=API_V1)
app.include_router(risk.router, prefix=API_V1)
app.include_router(locations.router, prefix=API_V1)
app.include_router(data.router, prefix=API_V1)


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": f"{API_V1}/health",
    }
