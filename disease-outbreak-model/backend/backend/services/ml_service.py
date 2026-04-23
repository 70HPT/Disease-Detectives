import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
from sklearn.preprocessing import StandardScaler

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from src.models.Disease_Predictor import OutbreakLSTMClassifier

logger = logging.getLogger(__name__)


EXCLUDE_COLS = {
    "Year",
    "State",
    "FIPS",
    "County",
    "Disease",
    "Sex",
    "Outbreak",
    "NAME",
    "state",
    "county",
    "Region",
    "Source",
    "Season",
    "Week Ending Date",
    "WeekOfYear",
    "WeekIndex",
    "Date",
    "Month",
    "MonthIndex",
}

DISEASE_CONFIGS = {
    "influenza": {
        "model_file": "models/best_influenza_lstm_classifier.pth",
        "train_file": "data/flu_national_weekly_train.csv",
        "all_file": "data/flu_national_weekly_all.csv",
        "sort_col": "Week Ending Date",
        "seq_length": 8,
        "version": "influenza_lstm_v1",
    },
    "covid": {
        "model_file": "models/best_covid_lstm_classifier.pth",
        "train_file": "data/covid_weekly_train.csv",
        "all_file": "data/covid_weekly_all.csv",
        "sort_col": "Week Ending Date",
        "seq_length": 8,
        "version": "covid_lstm_v1",
    },
    "salmonella": {
        "model_file": "models/best_salmonella_lstm_classifier.pth",
        "train_file": "data/salmonella_monthly_train.csv",
        "all_file": "data/salmonella_monthly_all.csv",
        "sort_col": "Date",
        "seq_length": 6,
        "version": "salmonella_lstm_v1",
    },
}


class PredictionService:
    def __init__(self):
        self.model: Optional[OutbreakLSTMClassifier] = None
        self.device = torch.device("cpu")
        self.model_version: str = "none"
        self._loaded = False

        self.seq_length = 8
        self.threshold = 0.67
        self.feature_cols: list[str] = []
        self.state_probs: dict[str, float] = {}
        self.state_last_cases: dict[str, float] = {}

        # Per-disease state probabilities populated by load_all_models()
        self.disease_state_probs: dict[str, dict[str, float]] = {}

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def _project_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    def _resolve_file(self, configured_path: str, fallbacks: list[str]) -> Optional[Path]:
        root = self._project_root()
        candidates = [configured_path, *fallbacks]

        for candidate in candidates:
            p = Path(candidate)
            if p.is_absolute() and p.exists():
                return p
            p2 = root / candidate
            if p2.exists():
                return p2
            p3 = root / "backend" / candidate
            if p3.exists():
                return p3

        return None

    def _create_sequences(self, data: pd.DataFrame, sort_col: str, seq_length: int):
        sequences = []
        states = []

        for state, group in data.groupby("State"):
            group = group.sort_values(sort_col)
            if len(group) < seq_length:
                continue

            features = group[self.feature_cols].values
            for i in range(len(group) - seq_length + 1):
                sequences.append(features[i : i + seq_length])
                states.append(state)

        return np.array(sequences), states

    def _load_disease_model(
        self,
        disease: str,
        model_file: str,
        train_file: str,
        all_file: str,
        sort_col: str,
        seq_length: int,
    ) -> Optional[dict[str, float]]:
        """Load one disease model and return {state: prob}. Returns None on failure."""
        model_path = self._resolve_file(model_file, [])
        if not model_path:
            logger.warning("%s model not found: %s", disease, model_file)
            return None

        train_path = self._resolve_file(train_file, [])
        all_path = self._resolve_file(all_file, [])
        if not train_path or not all_path:
            logger.warning("%s data files not found", disease)
            return None

        try:
            train_df = pd.read_csv(train_path)
            all_df = pd.read_csv(all_path)

            train_df[sort_col] = pd.to_datetime(train_df[sort_col])
            all_df[sort_col] = pd.to_datetime(all_df[sort_col])

            feature_cols = [
                col
                for col in train_df.columns
                if col not in EXCLUDE_COLS and pd.api.types.is_numeric_dtype(train_df[col])
            ]

            scaler = StandardScaler()
            scaler.fit(train_df[feature_cols])
            all_df[feature_cols] = scaler.transform(all_df[feature_cols])

            # Temporarily swap feature_cols for sequence creation
            saved_cols = self.feature_cols
            self.feature_cols = feature_cols

            sequences, sequence_states = self._create_sequences(all_df, sort_col, seq_length)
            self.feature_cols = saved_cols

            if len(sequences) == 0:
                logger.warning("No sequences from %s data", disease)
                return None

            input_dim = sequences.shape[2]
            model = OutbreakLSTMClassifier(
                input_dim=input_dim,
                hidden_dim=64,
                num_layers=2,
                dropout=0.3,
            ).to(self.device)
            model.load_state_dict(torch.load(model_path, map_location=self.device))
            model.eval()

            with torch.no_grad():
                probs = torch.sigmoid(
                    model(torch.tensor(sequences, dtype=torch.float32, device=self.device)).squeeze()
                ).cpu().numpy()

            seq_df = pd.DataFrame({"State": sequence_states, "Prob": probs})
            tail = seq_df.groupby("State").tail(1)
            state_probs = {row["State"]: float(row["Prob"]) for _, row in tail.iterrows()}

            logger.info(
                "%s LSTM ready | file=%s | states=%d | features=%d",
                disease,
                model_path,
                len(state_probs),
                len(feature_cols),
            )
            return state_probs

        except Exception as e:
            logger.warning("Failed to load %s model: %s", disease, e)
            return None

    def load_model(self, model_path: str, device: str = "cpu") -> None:
        """Load the influenza model (backward-compatible entry point)."""
        self._loaded = False
        self.device = torch.device(device)

        cfg = DISEASE_CONFIGS["influenza"]
        state_probs = self._load_disease_model(
            disease="influenza",
            model_file=model_path or cfg["model_file"],
            train_file=cfg["train_file"],
            all_file=cfg["all_file"],
            sort_col=cfg["sort_col"],
            seq_length=cfg["seq_length"],
        )
        if state_probs:
            self.state_probs = state_probs
            self.disease_state_probs["influenza"] = state_probs
            self.model_version = cfg["version"]
            self._loaded = True

    def load_all_models(self, device: str = "cpu") -> None:
        """Load influenza, COVID, and salmonella models."""
        self.device = torch.device(device)

        for disease, cfg in DISEASE_CONFIGS.items():
            probs = self._load_disease_model(
                disease=disease,
                model_file=cfg["model_file"],
                train_file=cfg["train_file"],
                all_file=cfg["all_file"],
                sort_col=cfg["sort_col"],
                seq_length=cfg["seq_length"],
            )
            if probs:
                self.disease_state_probs[disease] = probs

        if "influenza" in self.disease_state_probs:
            self.state_probs = self.disease_state_probs["influenza"]
            self.model_version = DISEASE_CONFIGS["influenza"]["version"]
            self._loaded = True

    def _risk_level(self, score: float) -> str:
        if score < 33:
            return "low"
        if score < 66:
            return "moderate"
        return "high"

    def _compute_factors(self, features: dict, prob: float) -> dict:
        density = features.get("population_density", 0)
        vacc = features.get("vaccination_rate", 0.5)
        temp = features.get("avg_temp", 60)

        return {
            "population_density": round(min(float(density) / 5000, 1.0), 3),
            "climate_risk": round(max(1 - float(temp) / 90, 0), 3),
            "vaccination_coverage": round(1 - float(vacc), 3),
            "historical_trend": round(float(prob), 3),
            "search_trend": round(float(features.get("otc_search_index", 30)) / 100, 3),
        }

    def predict(self, features: dict) -> dict:
        if not self._loaded:
            return self._mock_predict(features)

        state = str(features.get("state", "")).upper()
        if state not in self.state_probs:
            return self._mock_predict(features)

        prob = float(self.state_probs[state])
        risk_score = prob * 100.0
        confidence = max(prob, 1.0 - prob)
        raw_pred = self.state_last_cases.get(state, prob * 1000.0)

        return {
            "raw_prediction": round(raw_pred, 2),
            "risk_score": round(risk_score, 2),
            "confidence": round(confidence, 4),
            "risk_level": self._risk_level(risk_score),
            "factors": self._compute_factors(features, prob),
            "model_version": self.model_version,
            "generated_at": datetime.utcnow().isoformat(),
        }

    def predict_batch(self, feature_list: list[dict]) -> list[dict]:
        return [self.predict(f) for f in feature_list]

    def get_state_map_data(self) -> list[dict]:
        if not self._loaded:
            return []

        rows = []
        for state, prob in sorted(self.state_probs.items()):
            score = float(prob) * 100.0
            rows.append(
                {
                    "state": state,
                    "avg_risk_score": round(score, 2),
                    "max_risk_score": round(score, 2),
                    "county_count": 1,
                    "risk_level": self._risk_level(score),
                }
            )
        return rows

    def _mock_predict(self, features: dict) -> dict:
        import random

        score = random.uniform(15, 85)
        return {
            "raw_prediction": score * 50,
            "risk_score": round(score, 2),
            "confidence": 0.0,
            "risk_level": self._risk_level(score),
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


prediction_service = PredictionService()
