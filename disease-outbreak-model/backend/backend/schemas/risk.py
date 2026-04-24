"""
Pydantic schemas for request validation and response serialization.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ── Locations ────────────────────────────────────────────────────────

class LocationOut(BaseModel):
    id: int
    state: str
    county: str
    fips: str
    population: Optional[int] = None
    density: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    economic_data: Optional[dict] = None

    model_config = {"from_attributes": True}


# ── Predictions / Risk ───────────────────────────────────────────────

class RiskRequest(BaseModel):
    """Request body for on-demand risk prediction."""
    fips: str = Field(..., min_length=5, max_length=5, description="5-digit FIPS code")
    disease_type: str = Field(default="influenza", description="Disease to predict for: influenza | covid | salmonella")


class ContributingFactors(BaseModel):
    population_density: Optional[float] = None
    climate_risk: Optional[float] = None
    vaccination_coverage: Optional[float] = None
    historical_trend: Optional[float] = None
    search_trend: Optional[float] = None


class RiskResponse(BaseModel):
    fips: str
    county: str
    state: str
    risk_score: float = Field(..., ge=0, le=100)
    confidence: float = Field(..., ge=0, le=1)
    risk_level: str                        # "low", "moderate", "high"
    outbreak_probability: float = Field(default=0, ge=0, le=1)
    factors: ContributingFactors
    model_version: str
    generated_at: datetime

    model_config = {"from_attributes": True}


class StateRiskSummary(BaseModel):
    """Aggregated risk for a U.S. state (used by the map)."""
    state: str
    state_name: str
    avg_risk_score: float
    max_risk_score: float
    county_count: int
    risk_level: str


class MapDataResponse(BaseModel):
    """Full U.S. map payload — one entry per state."""
    states: list[StateRiskSummary]
    generated_at: datetime
    model_version: str


# ── Outbreak History ─────────────────────────────────────────────────

class OutbreakHistoryOut(BaseModel):
    id: Optional[int] = None
    location_id: Optional[int] = None
    date: datetime
    case_count: int
    disease_type: str
    population: Optional[int] = None
    climate_data: Optional[dict] = None

    model_config = {"from_attributes": True}


class HistoryRequest(BaseModel):
    fips: str = Field(..., min_length=5, max_length=5)
    disease_type: str = "total"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


# ── Batch operations ─────────────────────────────────────────────────

class BatchRiskRequest(BaseModel):
    """Request body for batch predictions (watchlist / comparison)."""
    fips_codes: list[str] = Field(..., min_length=1, max_length=100)
    disease_type: str = Field(default="influenza")


class BatchRiskResponse(BaseModel):
    """Response for batch predictions."""
    predictions: list[RiskResponse]
    generated_at: datetime
    model_version: str


# ── Health check ─────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str
    model_loaded: bool
    database_connected: bool
