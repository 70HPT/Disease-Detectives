"""
/api/v1/risk — Prediction and risk assessment endpoints.
These are the primary endpoints Joshua's frontend will consume.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from typing import Optional

from backend.db.session import get_db
from backend.db.models import Location, Prediction
from backend.schemas.risk import (
    RiskRequest, RiskResponse, ContributingFactors,
    MapDataResponse, StateRiskSummary,
)
from backend.services.ml_service import prediction_service
from backend.services.data_service import build_features_for_location

router = APIRouter(prefix="/risk", tags=["Risk Assessment"])


# ── Single location risk ─────────────────────────────────────────────

@router.post("/predict", response_model=RiskResponse)
async def predict_risk(req: RiskRequest, db: AsyncSession = Depends(get_db)):
    """
    Get a risk prediction for a single county by FIPS code.
    This is what fires when a user clicks a county on the map.
    """
    # Look up location
    result = await db.execute(select(Location).where(Location.fips == req.fips))
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(status_code=404, detail=f"Location not found: {req.fips}")

    # Assemble features from external APIs
    features = await build_features_for_location(req.fips)

    # Run ML prediction
    prediction = prediction_service.predict(features)

    # Persist prediction
    db_pred = Prediction(
        location_id=location.id,
        risk_score=prediction["risk_score"],
        confidence=prediction["confidence"],
        factors=prediction["factors"],
        model_version=prediction["model_version"],
    )
    db.add(db_pred)
    await db.commit()

    return RiskResponse(
        fips=location.fips,
        county=location.county,
        state=location.state,
        risk_score=prediction["risk_score"],
        confidence=prediction["confidence"],
        risk_level=prediction["risk_level"],
        factors=ContributingFactors(**prediction["factors"]),
        model_version=prediction["model_version"],
        generated_at=datetime.utcnow(),
    )


@router.get("/location/{fips}", response_model=RiskResponse)
async def get_latest_risk(fips: str, db: AsyncSession = Depends(get_db)):
    """
    Get the most recent cached prediction for a FIPS code.
    Faster than /predict — serves pre-computed results.
    """
    result = await db.execute(
        select(Location).where(Location.fips == fips)
    )
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail=f"Location not found: {fips}")

    # Get most recent prediction
    pred_result = await db.execute(
        select(Prediction)
        .where(Prediction.location_id == location.id)
        .order_by(Prediction.timestamp.desc())
        .limit(1)
    )
    prediction = pred_result.scalar_one_or_none()

    if not prediction:
        raise HTTPException(
            status_code=404,
            detail=f"No predictions yet for {fips}. Use POST /risk/predict first.",
        )

    factors = prediction.factors or {}
    return RiskResponse(
        fips=location.fips,
        county=location.county,
        state=location.state,
        risk_score=prediction.risk_score,
        confidence=prediction.confidence or 0,
        risk_level=_risk_level(prediction.risk_score),
        factors=ContributingFactors(**factors),
        model_version=prediction.model_version or "unknown",
        generated_at=prediction.timestamp,
    )


# ── Map data (all states) ───────────────────────────────────────────

@router.get("/map", response_model=MapDataResponse)
async def get_map_data(db: AsyncSession = Depends(get_db)):
    """
    Get aggregated risk data for the U.S. map.
    Returns one entry per state with avg/max risk scores.
    This is what powers the color-coded map on page load.
    """
    # Subquery: latest prediction per location
    latest_pred = (
        select(
            Prediction.location_id,
            func.max(Prediction.timestamp).label("latest_ts"),
        )
        .group_by(Prediction.location_id)
        .subquery()
    )

    # Join to get actual prediction rows + location info
    query = (
        select(
            Location.state,
            func.avg(Prediction.risk_score).label("avg_risk"),
            func.max(Prediction.risk_score).label("max_risk"),
            func.count(Location.id).label("county_count"),
        )
        .join(Prediction, Prediction.location_id == Location.id)
        .join(
            latest_pred,
            (Prediction.location_id == latest_pred.c.location_id)
            & (Prediction.timestamp == latest_pred.c.latest_ts),
        )
        .group_by(Location.state)
    )

    result = await db.execute(query)
    rows = result.all()

    states = []
    for row in rows:
        avg_risk = float(row.avg_risk)
        states.append(
            StateRiskSummary(
                state=row.state,
                state_name=_state_name(row.state),
                avg_risk_score=round(avg_risk, 2),
                max_risk_score=round(float(row.max_risk), 2),
                county_count=row.county_count,
                risk_level=_risk_level(avg_risk),
            )
        )

    return MapDataResponse(
        states=states,
        generated_at=datetime.utcnow(),
        model_version=prediction_service.model_version,
    )


# ── Helpers ──────────────────────────────────────────────────────────

def _risk_level(score: float) -> str:
    if score < 33:
        return "low"
    elif score < 66:
        return "moderate"
    return "high"


# Abbreviated — full mapping in production
_STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia",
}


def _state_name(abbr: str) -> str:
    return _STATE_NAMES.get(abbr, abbr)
