"""
/api/v1/health — Health check and system status.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from backend.db.session import get_db
from backend.schemas.risk import HealthResponse
from backend.services.ml_service import prediction_service
from backend.core.config import get_settings

router = APIRouter(tags=["System"])
settings = get_settings()


@router.get("/health", response_model=HealthResponse)
async def health_check(db: AsyncSession = Depends(get_db)):
    """System health check — verifies DB connection and model status."""
    db_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    return HealthResponse(
        status="healthy" if db_ok else "degraded",
        version=settings.app_version,
        model_loaded=prediction_service.is_loaded,
        database_connected=db_ok,
    )
