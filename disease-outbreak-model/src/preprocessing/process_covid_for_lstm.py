import argparse
from pathlib import Path
import sys

import numpy as np
import pandas as pd

sys.path.append(str(Path(__file__).parent.parent.parent))

COVID_FEATURE_COLS = [
    "COVID-19 Deaths",
    "Total Deaths",
    "Percent of Expected Deaths",
    "Pneumonia Deaths",
    "Pneumonia and COVID-19 Deaths",
    "Influenza Deaths",
    "Pneumonia, Influenza, or COVID-19 Deaths",
]

US_STATES = {
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
    "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
    "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
    "Washington", "West Virginia", "Wisconsin", "Wyoming",
}

STATE_NAME_TO_ABBR = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA",
    "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN",
    "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI",
    "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO", "Montana": "MT",
    "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
    "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA",
    "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
    "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
    "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY",
}


def load_covid_data(filepath: Path) -> pd.DataFrame:
    print(f"Loading COVID data from {filepath.name}...")
    df = pd.read_csv(filepath)

    df["Week Ending Date"] = pd.to_datetime(df["Week Ending Date"], errors="coerce")
    df = df.dropna(subset=["Week Ending Date"])

    df = df[df["State"].isin(US_STATES)].copy()
    
    df["State"] = df["State"].map(STATE_NAME_TO_ABBR)
    df = df.dropna(subset=["State"])

    df["Year"] = df["Week Ending Date"].dt.year
    df["WeekOfYear"] = df["Week Ending Date"].dt.isocalendar().week.astype(int)
    df["WeekIndex"] = (
        (df["Week Ending Date"] - df["Week Ending Date"].min()).dt.days // 7
    )

    available = [c for c in COVID_FEATURE_COLS if c in df.columns]
    missing = [c for c in COVID_FEATURE_COLS if c not in df.columns]
    if missing:
        print(f"  Warning: {len(missing)} feature columns not found, skipping them")

    keep_cols = ["State", "Week Ending Date", "Year", "WeekOfYear", "WeekIndex"] + available
    df = df[keep_cols].copy()

    for col in available:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    for col in available:
        df[col] = df.groupby("State")[col].transform(
            lambda x: x.fillna(x.median())
        )
    df[available] = df[available].fillna(0.0)

    df = df.rename(columns={"COVID-19 Deaths": "Cases"})

    df = df.sort_values(["State", "Week Ending Date"]).reset_index(drop=True)

    print(f"  Rows: {len(df):,}")
    print(f"  States: {df['State'].nunique()}")
    print(f"  Date range: {df['Week Ending Date'].min().date()} – {df['Week Ending Date'].max().date()}")
    print(f"  Feature columns: {len(available)}")

    return df


def define_outbreak_labels(df: pd.DataFrame, train_cutoff: str, threshold: float) -> pd.DataFrame:
    print(f"Defining outbreak labels (threshold={threshold}σ above state mean, fit on < {train_cutoff})...")
    cutoff = pd.to_datetime(train_cutoff)

    train_rows = df[df["Week Ending Date"] < cutoff]
    stats = train_rows.groupby("State")["Cases"].agg(["mean", "std"]).reset_index()
    stats["std"] = stats["std"].fillna(0.0)
    stats["threshold"] = stats["mean"] + threshold * stats["std"]

    labeled = df.merge(stats[["State", "threshold"]], on="State", how="left")
    labeled["threshold"] = labeled["threshold"].fillna(float("inf"))
    labeled["Outbreak"] = (labeled["Cases"] > labeled["threshold"]).astype(int)
    labeled = labeled.drop(columns=["threshold"])

    train_mask = labeled["Week Ending Date"] < cutoff
    print(f"  Train outbreak rate: {labeled[train_mask]['Outbreak'].mean()*100:.1f}%")
    print(f"  Test outbreak rate:  {labeled[~train_mask]['Outbreak'].mean()*100:.1f}%")

    return labeled


def add_lag_features(df: pd.DataFrame, lag_steps: list) -> pd.DataFrame:
    print(f"Adding lag features: {lag_steps} weeks...")
    df = df.sort_values(["State", "Week Ending Date"]).copy()

    lag_targets = ["Cases", "Total Deaths", "Percent of Expected Deaths"]
    lag_targets = [t for t in lag_targets if t in df.columns]

    for target in lag_targets:
        for lag in lag_steps:
            df[f"{target}_lag_{lag}w"] = df.groupby("State")[target].shift(lag)

    for target in ["Cases", "Total Deaths"]:
        if target in df.columns:
            df[f"{target}_rolling_mean_4w"] = df.groupby("State")[target].transform(
                lambda x: x.rolling(window=4, min_periods=1).mean()
            )
            df[f"{target}_rolling_std_4w"] = df.groupby("State")[target].transform(
                lambda x: x.rolling(window=4, min_periods=1).std().fillna(0)
            )

    required = [f"Cases_lag_{lag_steps[0]}w"]
    before = len(df)
    df = df.dropna(subset=required)
    print(f"  Rows after lag features: {len(df):,} (dropped {before - len(df)} for NaN lags)")

    lag_cols = [
        c for c in df.columns
        if any(f"_lag_{s}w" in c for s in lag_steps) or "_rolling_" in c
    ]
    before2 = len(df)
    df = df.dropna(subset=lag_cols)
    dropped2 = before2 - len(df)
    if dropped2:
        print(f"  Rows after dropping remaining NaN lags: {len(df):,} (dropped {dropped2} more)")

    return df


def main():
    parser = argparse.ArgumentParser(
        description="Process COVID-19 weekly death data into LSTM train/test CSVs"
    )
    parser.add_argument(
        "--covid-file",
        required=True,
        help="Path to COVID-19 death counts by week and state CSV",
    )
    parser.add_argument(
        "--train-cutoff",
        default="2022-01-01",
        help="Weeks before this date go to train, on/after to test (default: 2022-01-01)",
    )
    parser.add_argument("--outbreak-threshold", type=float, default=1.0)
    parser.add_argument("--lags", type=int, nargs="+", default=[1, 2, 4, 8])
    parser.add_argument("--output-dir", default="data")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    df = load_covid_data(Path(args.covid_file))
    df = define_outbreak_labels(df, args.train_cutoff, args.outbreak_threshold)
    df = add_lag_features(df, args.lags)

    cutoff = pd.to_datetime(args.train_cutoff)
    train_df = df[df["Week Ending Date"] < cutoff].copy()
    test_df = df[df["Week Ending Date"] >= cutoff].copy()

    for split, sdf in [("Train", train_df), ("Test", test_df)]:
        print(f"\n{split} split:")
        print(f"  Rows: {len(sdf):,}")
        print(f"  States: {sdf['State'].nunique()}")
        print(f"  Date range: {sdf['Week Ending Date'].min().date()} – {sdf['Week Ending Date'].max().date()}")
        print(f"  Outbreak rate: {sdf['Outbreak'].mean()*100:.1f}%")

    all_path = output_dir / "covid_weekly_all.csv"
    train_path = output_dir / "covid_weekly_train.csv"
    test_path = output_dir / "covid_weekly_test.csv"

    df.to_csv(all_path, index=False)
    train_df.to_csv(train_path, index=False)
    test_df.to_csv(test_path, index=False)

    exclude = {"State", "Week Ending Date", "Year", "WeekOfYear", "WeekIndex", "Outbreak"}
    feat_cols = [c for c in df.columns if c not in exclude and pd.api.types.is_numeric_dtype(df[c])]
    print(f"\nFeature columns ({len(feat_cols)}):")
    for c in feat_cols:
        print(f"  {c}")

    print(f"\nOutputs:")
    print(f"  All:   {all_path}")
    print(f"  Train: {train_path}")
    print(f"  Test:  {test_path}")


if __name__ == "__main__":
    main()
