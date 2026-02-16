"""
ORM models — matches Jacob's PostgreSQL schema.
Tables: locations, outbreak_history, predictions, api_cache, model_metadata
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Text, Index, JSON,
    BigInteger,
)
from sqlalchemy.orm import relationship
from backend.db.session import Base


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    state = Column(String(2), nullable=False, index=True)       # e.g. "CA"
    county = Column(String(100), nullable=False)
    fips = Column(String(5), unique=True, nullable=False, index=True)
    population = Column(BigInteger)
    density = Column(Float)                                      # people per sq mi
    latitude = Column(Float)
    longitude = Column(Float)
    economic_data = Column(JSON)                                 # per-capita income, GDP, etc.

    # relationships
    outbreaks = relationship("OutbreakHistory", back_populates="location")
    predictions = relationship("Prediction", back_populates="location")

    def __repr__(self):
        return f"<Location {self.fips} {self.county}, {self.state}>"


class OutbreakHistory(Base):
    __tablename__ = "outbreak_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    disease_type = Column(String(100), nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    case_count = Column(Integer, default=0)
    population = Column(BigInteger)
    climate_data = Column(JSON)   # {avg_temp, avg_humidity, precipitation}

    location = relationship("Location", back_populates="outbreaks")

    __table_args__ = (
        Index("ix_outbreak_location_date", "location_id", "date"),
    )


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    risk_score = Column(Float, nullable=False)            # 0-100
    confidence = Column(Float)                            # 0-1
    factors = Column(JSON)                                # contributing factor breakdown
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    model_version = Column(String(50))

    location = relationship("Location", back_populates="predictions")

    __table_args__ = (
        Index("ix_prediction_location_ts", "location_id", "timestamp"),
    )


class APICache(Base):
    __tablename__ = "api_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(String(50), nullable=False, index=True)   # "cdc", "census", "noaa", "who"
    endpoint = Column(String(500), nullable=False)
    response_data = Column(JSON)
    fetched_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)


class ModelMetadata(Base):
    __tablename__ = "model_metadata"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(String(50), unique=True, nullable=False)
    disease = Column(String(100))
    trained_at = Column(DateTime)
    metrics = Column(JSON)           # {rmse, mae, r2, ...}
    feature_columns = Column(JSON)   # list of feature names
    file_path = Column(String(500))
    is_active = Column(String(10), default="true")   # which model is currently serving
