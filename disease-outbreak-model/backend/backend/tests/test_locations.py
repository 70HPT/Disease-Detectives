"""Tests for /api/v1/locations endpoints."""

import pytest


@pytest.mark.asyncio
async def test_list_locations_empty(client):
    resp = await client.get("/api/v1/locations/")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_locations_with_data(client, sample_location):
    resp = await client.get("/api/v1/locations/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["fips"] == "06037"
    assert data[0]["state"] == "CA"
    assert data[0]["county"] == "Los Angeles"


@pytest.mark.asyncio
async def test_list_locations_filter_by_state(client, sample_location):
    resp = await client.get("/api/v1/locations/?state=CA")
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    resp = await client.get("/api/v1/locations/?state=TX")
    assert resp.status_code == 200
    assert len(resp.json()) == 0


@pytest.mark.asyncio
async def test_get_location_by_fips(client, sample_location):
    resp = await client.get("/api/v1/locations/06037")
    assert resp.status_code == 200
    data = resp.json()
    assert data["fips"] == "06037"
    assert data["population"] == 10000000


@pytest.mark.asyncio
async def test_get_location_not_found(client):
    resp = await client.get("/api/v1/locations/99999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_states(client, sample_location):
    resp = await client.get("/api/v1/locations/states/list")
    assert resp.status_code == 200
    data = resp.json()
    assert "CA" in data
