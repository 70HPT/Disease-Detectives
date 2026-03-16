"""Tests for /api/v1/risk endpoints."""

import pytest


@pytest.mark.asyncio
async def test_predict_risk(client, sample_location):
    resp = await client.post("/api/v1/risk/predict", json={"fips": "06037"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["fips"] == "06037"
    assert data["county"] == "Los Angeles"
    assert data["state"] == "CA"
    assert 0 <= data["risk_score"] <= 100
    assert 0 <= data["confidence"] <= 1
    assert data["risk_level"] in ("low", "moderate", "high")
    assert "outbreak_probability" in data
    assert "factors" in data
    assert "model_version" in data
    assert "generated_at" in data


@pytest.mark.asyncio
async def test_predict_risk_not_found(client):
    resp = await client.post("/api/v1/risk/predict", json={"fips": "99999"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_predict_risk_invalid_fips(client):
    resp = await client.post("/api/v1/risk/predict", json={"fips": "123"})
    assert resp.status_code == 422  # validation error


@pytest.mark.asyncio
async def test_get_latest_risk(client, sample_prediction, sample_location):
    resp = await client.get(f"/api/v1/risk/location/{sample_location.fips}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["fips"] == "06037"
    assert data["risk_score"] == 55.0


@pytest.mark.asyncio
async def test_get_latest_risk_no_predictions(client, sample_location):
    resp = await client.get(f"/api/v1/risk/location/{sample_location.fips}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_map_data_empty(client):
    """When DB has no predictions, falls back to ml_service.get_state_map_data()."""
    resp = await client.get("/api/v1/risk/map")
    assert resp.status_code == 200
    data = resp.json()
    assert "states" in data
    assert "generated_at" in data
    assert "model_version" in data


@pytest.mark.asyncio
async def test_get_map_data_with_predictions(client, sample_prediction):
    resp = await client.get("/api/v1/risk/map")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["states"]) >= 1
    ca = next((s for s in data["states"] if s["state"] == "CA"), None)
    assert ca is not None
    assert ca["state_name"] == "California"


@pytest.mark.asyncio
async def test_batch_predict(client, sample_location):
    resp = await client.post(
        "/api/v1/risk/batch",
        json={"fips_codes": ["06037"]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["predictions"]) == 1
    assert data["predictions"][0]["fips"] == "06037"


@pytest.mark.asyncio
async def test_batch_predict_unknown_fips_skipped(client, sample_location):
    resp = await client.post(
        "/api/v1/risk/batch",
        json={"fips_codes": ["06037", "99999"]},
    )
    assert resp.status_code == 200
    data = resp.json()
    # Only the valid FIPS should be returned
    assert len(data["predictions"]) == 1
