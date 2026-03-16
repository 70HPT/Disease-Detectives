"""Tests for the ML prediction service (unit tests, no model file needed)."""

import pytest
from backend.services.ml_service import PredictionService


def test_mock_predict():
    """When no model is loaded, mock predictions should still work."""
    svc = PredictionService()
    assert not svc.is_loaded

    result = svc.predict({"state": "CA", "population_density": 500})
    assert "risk_score" in result
    assert 0 <= result["risk_score"] <= 100
    assert result["risk_level"] in ("low", "moderate", "high")
    assert result["model_version"] == "mock"
    assert "factors" in result


def test_mock_predict_batch():
    svc = PredictionService()
    features = [
        {"state": "CA", "population_density": 500},
        {"state": "TX", "population_density": 200},
    ]
    results = svc.predict_batch(features)
    assert len(results) == 2
    assert all("risk_score" in r for r in results)


def test_risk_level():
    svc = PredictionService()
    assert svc._risk_level(10) == "low"
    assert svc._risk_level(50) == "moderate"
    assert svc._risk_level(80) == "high"


def test_compute_factors():
    svc = PredictionService()
    factors = svc._compute_factors(
        {"population_density": 2500, "vaccination_rate": 0.7, "avg_temp": 60, "otc_search_index": 50},
        0.6,
    )
    assert "population_density" in factors
    assert "climate_risk" in factors
    assert "vaccination_coverage" in factors
    assert all(0 <= v <= 1 for v in factors.values())


def test_get_state_map_data_empty():
    svc = PredictionService()
    assert svc.get_state_map_data() == []
