"""
/api/v1/diseases — Disease model discovery endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import get_db
from backend.db.models import ModelMetadata

router = APIRouter(prefix="/diseases", tags=["Diseases"])


@router.get("/available")
async def get_available_diseases(db: AsyncSession = Depends(get_db)):
    """
    Return the list of diseases that have an active ML model.
    The frontend uses this to populate disease selectors dynamically
    instead of hardcoding disease names.
    """
    result = await db.execute(
        select(ModelMetadata.disease)
        .where(ModelMetadata.is_active == "true")
        .order_by(ModelMetadata.disease)
    )
    diseases = [row[0] for row in result.all() if row[0]]

    # Fall back to the statically configured diseases if model_metadata is empty
    if not diseases:
        from backend.services.ml_service import DISEASE_CONFIGS
        diseases = sorted(DISEASE_CONFIGS.keys())

    return {"diseases": diseases}
