"""
ML Prediction Service.
Wraps Braulio's FluPredictor model for serving predictions via the API.
Loads the trained .pth checkpoint and runs inference on demand.
"""

import torch
import numpy as np
import logging
from typing import Optional
from datetime import datetime

# Import Braulio's model class (same repo)
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.models.flu_predictor import FluPredictor

logger = logging.getLogger(__name__)


class PredictionService:
    """Singleton-style service that holds the loaded model in memory."""

    def __init__(self):
        self.model: Optional[FluPredictor] = None
        self.scaler = None
        self.feature_cols: list[str] = []
        self.target_col: str = ""
        self.disease: str = "unknown"
        self.model_version: str = "none"
        self.device = torch.device("cpu")
        self._loaded = False

    # ── Load ─────────────────────────────────────────────────────────

    def load_model(self, model_path: str, device: str = "cpu") -> None:
        """Load a trained checkpoint from disk."""
        if not os.path.exists(model_path):
            logger.warning(f"Model file not found: {model_path}")
            return

        self.device = torch.device(device)

        checkpoint = torch.load(model_path, map_location=self.device, weights_only=False)

        self.feature_cols = checkpoint["feature_cols"]
        self.target_col = checkpoint["target_col"]
        self.scaler = checkpoint["scaler"]
        self.disease = checkpoint.get("disease", "unknown")
        self.model_version = f"{self.disease}_v{checkpoint.get('epoch', 0)}"

        input_dim = len(self.feature_cols)
        self.model = FluPredictor(input_dim)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.to(self.device)
        self.model.eval()
        self._loaded = True

        logger.info(
            f"Model loaded: {self.disease} | features={input_dim} | device={self.device}"
        )

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    # ── Predict ──────────────────────────────────────────────────────

    def predict(self, features: dict) -> dict:
        """
        Run a single prediction.

        Args:
            features: dict with keys matching self.feature_cols.
                      Example:
                      {
                          "population": 1500000,
                          "population_density": 2100.5,
                          "unemployment_rate": 0.045,
                          "vaccination_rate": 0.62,
                          "avg_temp": 58.3,
                          "avg_humidity": 0.55,
                          "otc_search_index": 42.1,
                          "flu_cases_lag_1": 320,
                          "flu_cases_lag_2": 280,
                          "flu_cases_lag_3": 250,
                      }

        Returns:
            {
                "raw_prediction": float,   # predicted case count
                "risk_score": float,       # normalized 0-100
                "confidence": float,       # 0-1
                "risk_level": str,         # "low" / "moderate" / "high"
                "factors": {...},
                "model_version": str,
            }
        """
        if not self._loaded:
            return self._mock_predict(features)

        # Build feature vector in the correct column order
        feature_vector = []
        for col in self.feature_cols:
            feature_vector.append(features.get(col, 0.0))

        X = np.array([feature_vector], dtype=np.float32)
        X_scaled = self.scaler.transform(X)
        X_tensor = torch.tensor(X_scaled, dtype=torch.float32).to(self.device)

        with torch.no_grad():
            raw_pred = self.model(X_tensor).cpu().item()

        # Normalize raw case-count prediction into 0-100 risk score
        risk_score = self._normalize_risk(raw_pred)
        confidence = self._estimate_confidence(features)
        risk_level = self._risk_level(risk_score)

        return {
            "raw_prediction": round(raw_pred, 2),
            "risk_score": round(risk_score, 2),
            "confidence": round(confidence, 4),
            "risk_level": risk_level,
            "factors": self._compute_factors(features),
            "model_version": self.model_version,
            "generated_at": datetime.utcnow().isoformat(),
        }

    def predict_batch(self, feature_list: list[dict]) -> list[dict]:
        """Run predictions for multiple locations at once."""
        return [self.predict(f) for f in feature_list]

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _normalize_risk(raw_prediction: float) -> float:
        """
        Convert raw case count prediction to 0-100 risk score.
        Uses a sigmoid-like mapping so the score saturates toward 100
        for very high predicted counts.
        """
        # Clamp negatives (model might predict < 0)
        pred = max(raw_prediction, 0)
        # Sigmoid scaling: 100 * (1 - e^(-pred/5000))
        # Tune the 5000 denominator based on your data distribution
        score = 100 * (1 - np.exp(-pred / 5000))
        return float(np.clip(score, 0, 100))

    @staticmethod
    def _risk_level(score: float) -> str:
        if score < 33:
            return "low"
        elif score < 66:
            return "moderate"
        else:
            return "high"

    @staticmethod
    def _estimate_confidence(features: dict) -> float:
        """
        Heuristic confidence based on data completeness.
        More complete input → higher confidence.
        """
        expected_keys = [
            "population", "population_density", "avg_temp",
            "avg_humidity", "vaccination_rate", "flu_cases_lag_1",
        ]
        present = sum(1 for k in expected_keys if features.get(k) is not None)
        return round(present / len(expected_keys), 2)

    @staticmethod
    def _compute_factors(features: dict) -> dict:
        """Break down contributing factors for the frontend panel."""
        density = features.get("population_density", 0)
        temp = features.get("avg_temp", 60)
        vacc = features.get("vaccination_rate", 0.5)
        lag1 = features.get("flu_cases_lag_1", 0)
        search = features.get("otc_search_index", 30)

        # Simple relative contribution heuristics (will refine with SHAP later)
        return {
            "population_density": round(min(density / 5000, 1.0), 3),
            "climate_risk": round(max(1 - temp / 90, 0), 3),   # colder → higher
            "vaccination_coverage": round(1 - vacc, 3),          # lower vacc → higher risk
            "historical_trend": round(min(lag1 / 10000, 1.0), 3),
            "search_trend": round(search / 100, 3),
        }

    # ── Fallback ─────────────────────────────────────────────────────

    @staticmethod
    def _mock_predict(features: dict) -> dict:
        """Fallback when no model is loaded — returns plausible mock data."""
        import random
        score = random.uniform(15, 85)
        return {
            "raw_prediction": score * 50,
            "risk_score": round(score, 2),
            "confidence": 0.0,
            "risk_level": PredictionService._risk_level(score),
            "factors": {
                "population_density": round(random.random(), 3),
                "climate_risk": round(random.random(), 3),
                "vaccination_coverage": round(random.random(), 3),
                "historical_trend": round(random.random(), 3),
                "search_trend": round(random.random(), 3),
            },
            "model_version": "mock",
            "generated_at": datetime.utcnow().isoformat(),
        }


# Module-level singleton
prediction_service = PredictionService()
