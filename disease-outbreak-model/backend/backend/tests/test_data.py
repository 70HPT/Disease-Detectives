"""Tests for /api/v1/data endpoints."""

import pytest
from datetime import datetime

from backend.db.models import OutbreakHistory


@pytest.mark.asyncio
async def test_get_history_not_found(client):
    resp = await client.get("/api/v1/data/history/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_history(client, db_session, sample_location):
    oh = OutbreakHistory(
        location_id=sample_location.id,
        disease_type="influenza",
        date=datetime(2025, 1, 1),
        case_count=150,
        population=10000000,
    )
    db_session.add(oh)
    await db_session.commit()

    resp = await client.get(f"/api/v1/data/history/{sample_location.fips}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["disease_type"] == "influenza"
    assert data[0]["case_count"] == 150


@pytest.mark.asyncio
async def test_get_history_filter_by_disease(client, db_session, sample_location):
    for dtype in ["influenza", "covid"]:
        oh = OutbreakHistory(
            location_id=sample_location.id,
            disease_type=dtype,
            date=datetime(2025, 1, 1),
            case_count=100,
        )
        db_session.add(oh)
    await db_session.commit()

    resp = await client.get(f"/api/v1/data/history/{sample_location.fips}?disease_type=influenza")
    assert resp.status_code == 200
    data = resp.json()
    assert all(r["disease_type"] == "influenza" for r in data)
