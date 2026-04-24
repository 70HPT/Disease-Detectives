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
        "group_col": "State",
        "sort_col": "Week Ending Date",
        "seq_length": 8,
        "version": "influenza_lstm_v1",
    },
    "covid": {
        "model_file": "models/best_covid_lstm_classifier.pth",
        "train_file": "data/covid_weekly_train.csv",
        "all_file": "data/covid_weekly_all.csv",
        "group_col": "State",
        "sort_col": "Week Ending Date",
        "seq_length": 8,
        "version": "covid_lstm_v1",
    },
    "salmonella": {
        "model_file": "models/best_salmonella_lstm_classifier.pth",
        "train_file": "data/salmonella_monthly_train.csv",
        "all_file": "data/salmonella_monthly_all.csv",
        "group_col": "State",
        "sort_col": "Date",
        "seq_length": 6,
        "version": "salmonella_lstm_v1",
    },
    "chlamydia": {
        "model_file": "models/best_us_lstm_classifier.pth",
        "train_file": "data/atlasplus_all_us_train.csv",
        "all_file": "data/atlasplus_all_us_test.csv",
        "group_col": "FIPS",
        "sort_col": "Year",
        "seq_length": 3,
        "version": "chlamydia_lstm_v1",
    },
}


STATE_FIPS_PREFIX_TO_ABBR = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
    "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
    "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY",
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

        # Per-disease probabilities populated by load_all_models().
        # Inner keys are State abbreviations for state-level models
        # (influenza/covid/salmonella) OR 5-digit FIPS strings for
        # county-level models (chlamydia). Use disease_group_cols to tell
        # which variant a disease uses.
        self.disease_state_probs: dict[str, dict[str, float]] = {}
        self.disease_group_cols: dict[str, str] = {}

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

    def _create_sequences(
        self,
        data: pd.DataFrame,
        sort_col: str,
        seq_length: int,
        group_col: str = "State",
    ):
        sequences = []
        keys = []

        for key, group in data.groupby(group_col):
            group = group.sort_values(sort_col)
            if len(group) < seq_length:
                continue

            features = group[self.feature_cols].values
            for i in range(len(group) - seq_length + 1):
                sequences.append(features[i : i + seq_length])
                # FIPS in the CSVs is an integer column; normalise to 5-char
                # zero-padded strings so it matches Location.fips in the DB.
                if group_col == "FIPS":
                    keys.append(f"{int(key):05d}")
                else:
                    keys.append(str(key))

        return np.array(sequences), keys

    def _load_disease_model(
        self,
        disease: str,
        model_file: str,
        train_file: str,
        all_file: str,
        sort_col: str,
        seq_length: int,
        group_col: str = "State",
    ) -> Optional[dict[str, float]]:
        """Load one disease model and return {group_key: prob}.

        group_key is a state abbreviation for state-level models and a
        5-digit FIPS string for county-level models (chlamydia).
        Returns None on failure.
        """
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

            sequences, sequence_keys = self._create_sequences(
                all_df, sort_col, seq_length, group_col=group_col,
            )
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

            seq_df = pd.DataFrame({"Key": sequence_keys, "Prob": probs})
            tail = seq_df.groupby("Key").tail(1)
            key_probs = {row["Key"]: float(row["Prob"]) for _, row in tail.iterrows()}

            logger.info(
                "%s LSTM ready | file=%s | %s_count=%d | features=%d",
                disease,
                model_path,
                group_col.lower(),
                len(key_probs),
                len(feature_cols),
            )
            return key_probs

        except Exception as e:
            logger.warning("Failed to load %s model: %s", disease, e)
            return None

    def load_model(self, model_path: str, device: str = "cpu") -> None:
        """Load the influenza model (backward-compatible entry point)."""
        self._loaded = False
        self.device = torch.device(device)

        cfg = DISEASE_CONFIGS["influenza"]
        probs = self._load_disease_model(
            disease="influenza",
            model_file=model_path or cfg["model_file"],
            train_file=cfg["train_file"],
            all_file=cfg["all_file"],
            sort_col=cfg["sort_col"],
            seq_length=cfg["seq_length"],
            group_col=cfg.get("group_col", "State"),
        )
        if probs:
            self.state_probs = probs
            self.disease_state_probs["influenza"] = probs
            self.disease_group_cols["influenza"] = cfg.get("group_col", "State")
            self.model_version = cfg["version"]
            self._loaded = True

    def load_all_models(self, device: str = "cpu") -> None:
        """Load every disease model defined in DISEASE_CONFIGS."""
        self.device = torch.device(device)

        for disease, cfg in DISEASE_CONFIGS.items():
            group_col = cfg.get("group_col", "State")
            probs = self._load_disease_model(
                disease=disease,
                model_file=cfg["model_file"],
                train_file=cfg["train_file"],
                all_file=cfg["all_file"],
                sort_col=cfg["sort_col"],
                seq_length=cfg["seq_length"],
                group_col=group_col,
            )
            if probs:
                self.disease_state_probs[disease] = probs
                self.disease_group_cols[disease] = group_col

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

    def _resolve_disease(self, disease_type: str) -> str:
        """Normalise disease_type to a known key; fall back to influenza."""
        if disease_type in self.disease_state_probs:
            return disease_type
        return "influenza"

    def _lookup_key(self, disease: str, features: dict) -> str:
        """Return the right lookup key (state abbr or 5-digit FIPS) for a disease."""
        if self.disease_group_cols.get(disease) == "FIPS":
            fips_raw = features.get("fips", "")
            return f"{str(fips_raw).zfill(5)}" if fips_raw else ""
        return str(features.get("state", "")).upper()

    def predict(self, features: dict, disease_type: str = "influenza") -> dict:
        if not self._loaded:
            return self._mock_predict(features)

        disease = self._resolve_disease(disease_type)
        probs = self.disease_state_probs.get(disease, self.state_probs)
        lookup_key = self._lookup_key(disease, features)
        if lookup_key not in probs:
            return self._mock_predict(features)

        prob = float(probs[lookup_key])
        risk_score = prob * 100.0
        confidence = max(prob, 1.0 - prob)
        raw_pred = self.state_last_cases.get(lookup_key, prob * 1000.0)
        version = DISEASE_CONFIGS.get(disease, DISEASE_CONFIGS["influenza"])["version"]

        return {
            "raw_prediction": round(raw_pred, 2),
            "risk_score": round(risk_score, 2),
            "confidence": round(confidence, 4),
            "risk_level": self._risk_level(risk_score),
            "factors": self._compute_factors(features, prob),
            "model_version": version,
            "generated_at": datetime.utcnow().isoformat(),
        }

    def predict_batch(self, feature_list: list[dict], disease_type: str = "influenza") -> list[dict]:
        return [self.predict(f, disease_type=disease_type) for f in feature_list]

    def get_state_map_data(self, disease_type: str = "influenza") -> list[dict]:
        if not self._loaded:
            return []

        disease = self._resolve_disease(disease_type)
        probs = self.disease_state_probs.get(disease, self.state_probs)

        # For county-level (FIPS-keyed) models like chlamydia, aggregate the
        # per-county probabilities into per-state averages so the globe still
        # has one entry per state.
        if self.disease_group_cols.get(disease) == "FIPS":
            by_state: dict[str, list[float]] = {}
            for fips, prob in probs.items():
                state_abbr = STATE_FIPS_PREFIX_TO_ABBR.get(str(fips)[:2])
                if not state_abbr:
                    continue
                by_state.setdefault(state_abbr, []).append(float(prob))

            rows = []
            for state, plist in sorted(by_state.items()):
                avg = sum(plist) / len(plist)
                maxp = max(plist)
                rows.append(
                    {
                        "state": state,
                        "avg_risk_score": round(avg * 100, 2),
                        "max_risk_score": round(maxp * 100, 2),
                        "county_count": len(plist),
                        "risk_level": self._risk_level(avg * 100),
                    }
                )
            return rows

        rows = []
        for state, prob in sorted(probs.items()):
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
