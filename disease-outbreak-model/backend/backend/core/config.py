"""
Application configuration.
Loads settings from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────
    app_name: str = "Disease Detective API"
    app_version: str = "0.1.0"
    debug: bool = False

    # ── Database ─────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/disease_detective"
    database_echo: bool = False  # SQLAlchemy SQL logging

    # ── Redis (caching layer) ────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 3600  # 1 hour default

    # ── External APIs ────────────────────────────────────────────────
    cdc_api_base: str = "https://data.cdc.gov/resource"
    cdc_app_token: Optional[str] = None

    census_api_key: Optional[str] = None
    census_api_base: str = "https://api.census.gov/data"

    noaa_token: Optional[str] = None
    noaa_api_base: str = "https://www.ncdc.noaa.gov/cdo-web/api/v2"

    who_api_base: str = "https://ghoapi.azureedge.net/api"

    # ── ML Model ─────────────────────────────────────────────────────
    model_path: str = "outputs/ca_total_model.pth"
    model_device: str = "cpu"  # "cpu" or "cuda"

    # ── Security ─────────────────────────────────────────────────────
    secret_key: str = "CHANGE-ME-IN-PRODUCTION"
    access_token_expire_minutes: int = 60
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # ── Rate Limiting ────────────────────────────────────────────────
    rate_limit_per_minute: int = 60

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
