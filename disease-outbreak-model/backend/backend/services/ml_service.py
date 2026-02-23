"""
ML Prediction Service.
Wraps Braulio's OutbreakLSTMClassifier for serving predictions via the API.
Loads the trained .pth checkpoint and runs inference on demand.

The model is an LSTM binary classifier that predicts outbreak probability
given a sequence of (Cases, Cases_lag_1, Cases_lag_2, Cases_lag_3) features.
"""

import torch
import numpy as np
import logging
import os
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)


# ── Inline model definition ──────────────────────────────────────────
# Mirrors src/models/Disease_Predictor.py so the backend stays self-contained.

class OutbreakLSTMClassifier(torch.nn.Module):
    """Binary LSTM classifier — mirrors Braulio's Disease_Predictor.py."""

    def __init__(self, input_dim, hidden_dim=64, num_layers=2, dropout=0.3):
        super().__init__()
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.lstm = torch.nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
        )
        self.fc = torch.nn.Sequential(
            torch.nn.Linear(hidden_dim, 32),
            torch.nn.ReLU(),
            torch.nn.Dropout(dropout),
            torch.nn.Linear(32, 1),
        )

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        last_output = lstm_out[:, -1, :]
        return self.fc(last_output)


class PredictionService:
    """Singleton-style service that holds the loaded model in memory."""

    # The LSTM was trained with these feature columns.
    FEATURE_COLS = ["Cases", "Cases_lag_1", "Cases_lag_2", "Cases_lag_3"]
    SEQ_LENGTH = 3  # matches create_sequences() in train_us_lstm_classifier.py

    def __init__(self):
        self.model: Optional[OutbreakLSTMClassifier] = None
        self.scaler = None
        self.disease: str = "chlamydia"
        self.model_version: str = "none"
        self.device = torch.device("cpu")
        self._loaded = False
        self._input_dim: int = len(self.FEATURE_COLS)

    # ── Load ─────────────────────────────────────────────────────────

    def load_model(self, model_path: str, device: str = "cpu") -> None:
        """
        Load a trained checkpoint from disk.

        The LSTM classifier checkpoint is a state_dict saved by
        train_us_lstm_classifier.py.
        """
        if not os.path.exists(model_path):
            logger.warning(f"Model file not found: {model_path}")
            return

        try:
            self.device = torch.device(device)

            self.model = OutbreakLSTMClassifier(
                input_dim=self._input_dim,
                hidden_dim=64,
                num_layers=2,
                dropout=0.3,
            )

            state_dict = torch.load(
                model_path, map_location=self.device, weights_only=True
            )
            self.model.load_state_dict(state_dict)
            self.model.to(self.device)
            self.model.eval()

            self._loaded = True
            self.model_version = "us_lstm_v1"

            logger.info(
                f"LSTM model loaded: input_dim={self._input_dim}, "
                f"device={self.device}"
            )
        except Exception as exc:
            logger.error(f"Failed to load model: {exc}")
            self._loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    # ── Predict ──────────────────────────────────────────────────────

    def predict(self, features: dict) -> dict:
        """
        Run a single outbreak prediction.

        Args:
            features: dict with at minimum:
                - cases: current case count
                - cases_lag_1/2/3: historical case counts
                Optionally includes population_density, vaccination_rate, etc.

        Returns:
            {
                "risk_score": float 0-100,
                "confidence": float 0-1,
                "risk_level": "low" | "moderate" | "high",
                "outbreak_probability": float 0-1,
                "factors": {...},
                "model_version": str,
            }
        """
        if not self._loaded:
            return self._mock_predict(features)

        cases = float(features.get("cases", 0) or 0)
        lag1 = float(features.get("cases_lag_1", 0) or 0)
        lag2 = float(features.get("cases_lag_2", 0) or 0)
        lag3 = float(features.get("cases_lag_3", 0) or 0)

        # Build a 3-step sequence matching training shape (1, 3, 4)
        sequence = np.array([
            [lag2, lag3, 0.0, 0.0],
            [lag1, lag2, lag3, 0.0],
            [cases, lag1, lag2, lag3],
        ], dtype=np.float32)

        X = torch.tensor(sequence, dtype=torch.float32).unsqueeze(0).to(self.device)

        with torch.no_grad():
            logit = self.model(X).cpu().item()

        probability = float(torch.sigmoid(torch.tensor(logit)).item())
        risk_score = round(probability * 100, 2)
        confidence = self._estimate_confidence(features, probability)
        risk_level = self._risk_level(risk_score)

        return {
            "risk_score": risk_score,
            "confidence": round(confidence, 4),
            "risk_level": risk_level,
            "outbreak_probability": round(probability, 4),
            "factors": self._compute_factors(features, probability),
            "model_version": self.model_version,
        }

    def predict_batch(self, feature_list: list[dict]) -> list[dict]:
        """Run predictions for multiple locations at once."""
        return [self.predict(f) for f in feature_list]

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _risk_level(score: float) -> str:
        if score < 33:
            return "low"
        elif score < 66:
            return "moderate"
        return "high"

    @staticmethod
    def _estimate_confidence(features: dict, probability: float) -> float:
        """
        Heuristic confidence: higher when we have more data and when
        the model is decisive (probability far from 0.5).
        """
        expected = ["cases", "cases_lag_1", "cases_lag_2", "cases_lag_3",
                     "population", "population_density", "vaccination_rate"]
        present = sum(1 for k in expected if features.get(k) is not None)
        completeness = present / len(expected)
        decisiveness = abs(probability - 0.5) * 2
        return 0.5 * completeness + 0.5 * decisiveness

    @staticmethod
    def _compute_factors(features: dict, probability: float) -> dict:
        """Break down contributing factors for the frontend panel."""
        density = float(features.get("population_density", 0) or 0)
        vacc = float(features.get("vaccination_rate", 0.5) or 0.5)
        lag1 = float(features.get("cases_lag_1", 0) or 0)
        cases = float(features.get("cases", 0) or 0)

        return {
            "population_density": round(min(density / 5000, 1.0), 3),
            "climate_risk": round(probability * 0.3, 3),
            "vaccination_coverage": round(1 - vacc, 3),
            "historical_trend": round(min(lag1 / 10000, 1.0), 3),
            "search_trend": round(min(cases / 10000, 1.0), 3),
        }

    # ── Fallback ─────────────────────────────────────────────────────

    @staticmethod
    def _mock_predict(features: dict) -> dict:
        """Fallback when no model is loaded — returns plausible mock data."""
        import random

        cases = float(features.get("cases", 0) or 0)
        lag1 = float(features.get("cases_lag_1", 0) or 0)

        base = random.uniform(20, 60)
        if cases > 1000:
            base += 20
        if lag1 > 500:
            base += 10
        score = min(max(base, 0), 100)

        return {
            "risk_score": round(score, 2),
            "confidence": 0.0,
            "risk_level": PredictionService._risk_level(score),
            "outbreak_probability": round(score / 100, 4),
            "factors": {
                "population_density": round(random.random(), 3),
                "climate_risk": round(random.random(), 3),
                "vaccination_coverage": round(random.random(), 3),
                "historical_trend": round(random.random(), 3),
                "search_trend": round(random.random(), 3),
            },
            "model_version": "mock",
        }


# Module-level singleton
prediction_service = PredictionService()
