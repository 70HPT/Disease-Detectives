import argparse
from pathlib import Path
import sys

import numpy as np
import pandas as pd

sys.path.append(str(Path(__file__).parent.parent.parent))

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


def load_salmonella_outbreaks(filepath: Path) -> pd.DataFrame:
    print(f"Loading salmonella outbreak data from {filepath.name}...")
    df = pd.read_csv(filepath)

    # Filter to state-level data only (exclude Multistate and territories)
    df = df[df["State"].isin(US_STATES)].copy()
    
    # Convert state names to abbreviations for consistency
    df["State"] = df["State"].map(STATE_NAME_TO_ABBR)
    df = df.dropna(subset=["State"])

    # Convert Year and Month to numeric
    df["Year"] = pd.to_numeric(df["Year"], errors="coerce")
    df["Month"] = pd.to_numeric(df["Month"], errors="coerce")
    df = df.dropna(subset=["Year", "Month"])

    # Convert numeric columns
    for col in ["Illnesses", "Hospitalizations", "Deaths"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    print(f"  Rows: {len(df):,}")
    print(f"  States: {df['State'].nunique()}")
    print(f"  Date range: {int(df['Year'].min())}-{int(df['Year'].max())}")

    return df


def aggregate_to_monthly(df: pd.DataFrame) -> pd.DataFrame:
    print("Aggregating outbreak events to monthly state-level data...")
    
    # Group by state, year, month and aggregate
    agg_dict = {
        "Illnesses": "sum",
        "Hospitalizations": "sum",
        "Deaths": "sum",
    }
    
    monthly = (
        df.groupby(["State", "Year", "Month"])
        .agg(agg_dict)
        .reset_index()
    )
    
    # Count number of outbreaks per state-month
    outbreak_counts = (
        df.groupby(["State", "Year", "Month"])
        .size()
        .reset_index(name="Outbreak_Count")
    )
    monthly = monthly.merge(outbreak_counts, on=["State", "Year", "Month"], how="left")
    
    # Create date column
    monthly["Date"] = pd.to_datetime(
        monthly[["Year", "Month"]].assign(day=1)
    )
    
    # Create full time series for each state (fill missing months with zeros)
    all_states = monthly["State"].unique()
    date_range = pd.date_range(
        start=monthly["Date"].min(),
        end=monthly["Date"].max(),
        freq="MS"  # Month start
    )
    
    full_index = pd.MultiIndex.from_product(
        [all_states, date_range],
        names=["State", "Date"]
    )
    full_df = pd.DataFrame(index=full_index).reset_index()
    
    # Merge with actual data
    monthly = full_df.merge(
        monthly.drop(columns=["Year", "Month"]),
        on=["State", "Date"],
        how="left"
    )
    
    # Fill missing values with 0 (no outbreaks)
    monthly["Illnesses"] = monthly["Illnesses"].fillna(0)
    monthly["Hospitalizations"] = monthly["Hospitalizations"].fillna(0)
    monthly["Deaths"] = monthly["Deaths"].fillna(0)
    monthly["Outbreak_Count"] = monthly["Outbreak_Count"].fillna(0)
    
    # Re-extract year and month
    monthly["Year"] = monthly["Date"].dt.year
    monthly["Month"] = monthly["Date"].dt.month
    monthly["MonthIndex"] = (
        (monthly["Date"] - monthly["Date"].min()).dt.days // 30
    )
    
    # Rename Illnesses to Cases for consistency
    monthly = monthly.rename(columns={"Illnesses": "Cases"})
    
    print(f"  Monthly records: {len(monthly):,}")
    print(f"  States: {monthly['State'].nunique()}")
    print(f"  Date range: {monthly['Date'].min().date()} – {monthly['Date'].max().date()}")
    print(f"  Avg outbreaks per state-month: {monthly['Outbreak_Count'].mean():.2f}")
    
    return monthly


def add_outbreak_features(df: pd.DataFrame) -> pd.DataFrame:
    print("Adding outbreak-derived features...")
    
    # Hospitalization rate (hospitalizations per illness)
    df["Hosp_Rate"] = np.where(
        df["Cases"] > 0,
        df["Hospitalizations"] / df["Cases"],
        0
    )
    
    # Fatality rate (deaths per illness)
    df["Fatality_Rate"] = np.where(
        df["Cases"] > 0,
        df["Deaths"] / df["Cases"],
        0
    )
    
    # Severity score (weighted combination)
    df["Severity_Score"] = (
        df["Cases"] + 
        df["Hospitalizations"] * 5 + 
        df["Deaths"] * 20
    )
    
    return df


def define_outbreak_labels(df: pd.DataFrame, train_cutoff: str, threshold: float) -> pd.DataFrame:
    print(f"Defining outbreak labels (threshold={threshold}σ above state mean, fit on < {train_cutoff})...")
    cutoff = pd.to_datetime(train_cutoff)

    train_rows = df[df["Date"] < cutoff]
    stats = train_rows.groupby("State")["Cases"].agg(["mean", "std"]).reset_index()
    stats["std"] = stats["std"].fillna(0.0)
    stats["threshold"] = stats["mean"] + threshold * stats["std"]

    labeled = df.merge(stats[["State", "threshold"]], on="State", how="left")
    labeled["threshold"] = labeled["threshold"].fillna(float("inf"))
    labeled["Outbreak"] = (labeled["Cases"] > labeled["threshold"]).astype(int)
    labeled = labeled.drop(columns=["threshold"])

    train_mask = labeled["Date"] < cutoff
    print(f"  Train outbreak rate: {labeled[train_mask]['Outbreak'].mean()*100:.1f}%")
    print(f"  Test outbreak rate:  {labeled[~train_mask]['Outbreak'].mean()*100:.1f}%")

    return labeled


def add_lag_features(df: pd.DataFrame, lag_steps: list) -> pd.DataFrame:
    print(f"Adding lag features: {lag_steps} months...")
    df = df.sort_values(["State", "Date"]).copy()

    lag_targets = ["Cases", "Outbreak_Count", "Hospitalizations", "Deaths", "Severity_Score"]
    lag_targets = [t for t in lag_targets if t in df.columns]

    for target in lag_targets:
        for lag in lag_steps:
            df[f"{target}_lag_{lag}m"] = df.groupby("State")[target].shift(lag)

    # Calculate rolling statistics
    for target in ["Cases", "Severity_Score"]:
        if target in df.columns:
            df[f"{target}_rolling_mean_3m"] = df.groupby("State")[target].transform(
                lambda x: x.rolling(window=3, min_periods=1).mean()
            )
            df[f"{target}_rolling_std_3m"] = df.groupby("State")[target].transform(
                lambda x: x.rolling(window=3, min_periods=1).std().fillna(0)
            )

    required = [f"Cases_lag_{lag_steps[0]}m"]
    before = len(df)
    df = df.dropna(subset=required)
    print(f"  Rows after lag features: {len(df):,} (dropped {before - len(df)} for NaN lags)")

    lag_cols = [
        c for c in df.columns
        if any(f"_lag_{s}m" in c for s in lag_steps) or "_rolling_" in c
    ]
    before2 = len(df)
    df = df.dropna(subset=lag_cols)
    dropped2 = before2 - len(df)
    if dropped2:
        print(f"  Rows after dropping remaining NaN lags: {len(df):,} (dropped {dropped2} more)")

    return df


def main():
    parser = argparse.ArgumentParser(
        description="Process salmonella outbreak data into LSTM train/test CSVs"
    )
    parser.add_argument(
        "--salmonella-file",
        required=True,
        help="Path to NORS salmonella outbreak CSV",
    )
    parser.add_argument(
        "--train-cutoff",
        default="2015-01-01",
        help="Months before this date go to train, on/after to test (default: 2015-01-01)",
    )
    parser.add_argument("--outbreak-threshold", type=float, default=1.5)
    parser.add_argument("--lags", type=int, nargs="+", default=[1, 2, 3, 6])
    parser.add_argument("--output-dir", default="data")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print("Processing Salmonella Outbreak Data for LSTM")
    print("=" * 80)

    df = load_salmonella_outbreaks(Path(args.salmonella_file))
    df = aggregate_to_monthly(df)
    df = add_outbreak_features(df)
    df = define_outbreak_labels(df, args.train_cutoff, args.outbreak_threshold)
    df = add_lag_features(df, args.lags)

    cutoff = pd.to_datetime(args.train_cutoff)
    train_df = df[df["Date"] < cutoff].copy()
    test_df = df[df["Date"] >= cutoff].copy()

    for split, sdf in [("Train", train_df), ("Test", test_df)]:
        print(f"\n{split} split:")
        print(f"  Rows: {len(sdf):,}")
        print(f"  States: {sdf['State'].nunique()}")
        print(f"  Date range: {sdf['Date'].min().date()} – {sdf['Date'].max().date()}")
        print(f"  Outbreak rate: {sdf['Outbreak'].mean()*100:.1f}%")

    all_path = output_dir / "salmonella_monthly_all.csv"
    train_path = output_dir / "salmonella_monthly_train.csv"
    test_path = output_dir / "salmonella_monthly_test.csv"

    df.to_csv(all_path, index=False)
    train_df.to_csv(train_path, index=False)
    test_df.to_csv(test_path, index=False)

    exclude = {"State", "Date", "Year", "Month", "MonthIndex", "Outbreak"}
    feat_cols = [c for c in df.columns if c not in exclude and pd.api.types.is_numeric_dtype(df[c])]
    print(f"\nFeature columns ({len(feat_cols)}):")
    for c in feat_cols:
        print(f"  {c}")

    print(f"\nOutputs:")
    print(f"  All:   {all_path}")
    print(f"  Train: {train_path}")
    print(f"  Test:  {test_path}")
    print("=" * 80)


if __name__ == "__main__":
    main()
