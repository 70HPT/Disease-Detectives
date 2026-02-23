"""
/api/v1/risk — Prediction and risk assessment endpoints.
These are the primary endpoints Joshua's frontend will consume.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime

from backend.db.session import get_db
from backend.db.models import Location, Prediction
from backend.schemas.risk import (
    RiskRequest, RiskResponse, ContributingFactors,
    MapDataResponse, StateRiskSummary,
    BatchRiskRequest, BatchRiskResponse,
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
    result = await db.execute(select(Location).where(Location.fips == req.fips))
    location = result.scalar_one_or_none()

    if not location:
        raise HTTPException(status_code=404, detail=f"Location not found: {req.fips}")

    # Assemble features from DB + external APIs
    features = await build_features_for_location(req.fips, db=db)

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
        outbreak_probability=prediction.get("outbreak_probability", 0),
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
    risk_score = prediction.risk_score or 0
    return RiskResponse(
        fips=location.fips,
        county=location.county,
        state=location.state,
        risk_score=risk_score,
        confidence=prediction.confidence or 0,
        risk_level=_risk_level(risk_score),
        outbreak_probability=round(risk_score / 100, 4),
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


# ── Batch predictions (watchlist / comparison) ───────────────────────

@router.post("/batch", response_model=BatchRiskResponse)
async def batch_predict(req: BatchRiskRequest, db: AsyncSession = Depends(get_db)):
    """
    Get risk data for multiple FIPS codes at once.
    Used by the watchlist and comparison mode.
    Returns cached predictions where available, runs fresh predictions otherwise.
    """
    predictions = []

    for fips in req.fips_codes:
        # Try cached prediction first
        loc_result = await db.execute(
            select(Location).where(Location.fips == fips)
        )
        location = loc_result.scalar_one_or_none()
        if not location:
            continue

        pred_result = await db.execute(
            select(Prediction)
            .where(Prediction.location_id == location.id)
            .order_by(Prediction.timestamp.desc())
            .limit(1)
        )
        prediction = pred_result.scalar_one_or_none()

        if prediction:
            factors = prediction.factors or {}
            risk_score = prediction.risk_score or 0
            predictions.append(RiskResponse(
                fips=location.fips,
                county=location.county,
                state=location.state,
                risk_score=risk_score,
                confidence=prediction.confidence or 0,
                risk_level=_risk_level(risk_score),
                outbreak_probability=round(risk_score / 100, 4),
                factors=ContributingFactors(**factors),
                model_version=prediction.model_version or "unknown",
                generated_at=prediction.timestamp,
            ))
        else:
            # Run a fresh prediction
            features = await build_features_for_location(fips, db=db)
            pred_data = prediction_service.predict(features)

            db_pred = Prediction(
                location_id=location.id,
                risk_score=pred_data["risk_score"],
                confidence=pred_data["confidence"],
                factors=pred_data["factors"],
                model_version=pred_data["model_version"],
            )
            db.add(db_pred)

            predictions.append(RiskResponse(
                fips=location.fips,
                county=location.county,
                state=location.state,
                risk_score=pred_data["risk_score"],
                confidence=pred_data["confidence"],
                risk_level=pred_data["risk_level"],
                outbreak_probability=pred_data.get("outbreak_probability", 0),
                factors=ContributingFactors(**pred_data["factors"]),
                model_version=pred_data["model_version"],
                generated_at=datetime.utcnow(),
            ))

    await db.commit()

    return BatchRiskResponse(
        predictions=predictions,
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
