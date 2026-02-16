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

    model_config = {"from_attributes": True}


# ── Predictions / Risk ───────────────────────────────────────────────

class RiskRequest(BaseModel):
    """Request body for on-demand risk prediction."""
    fips: str = Field(..., min_length=5, max_length=5, description="5-digit FIPS code")
    disease_type: str = Field(default="total", description="Disease to predict for")


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
    date: datetime
    case_count: int
    disease_type: str
    climate_data: Optional[dict] = None

    model_config = {"from_attributes": True}


class HistoryRequest(BaseModel):
    fips: str = Field(..., min_length=5, max_length=5)
    disease_type: str = "total"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


# ── Health check ─────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str
    model_loaded: bool
    database_connected: bool
