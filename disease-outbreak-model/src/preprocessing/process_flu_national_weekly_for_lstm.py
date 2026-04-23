import argparse
from pathlib import Path
import sys

import numpy as np
import pandas as pd

sys.path.append(str(Path(__file__).parent.parent.parent))

HOSPITAL_FEATURE_COLS = [
    "Total Patients Hospitalized with Influenza",
    "Total ICU Patients Hospitalized with Influenza",
    "Total Influenza Admissions",
    "Total Pediatric Influenza Admissions",
    "Number of Adult Influenza Admissions, 18-49 years",
    "Number of Adult Influenza Admissions, 50-64 years",
    "Number of Adult Influenza Admissions, 65-74 years",
    "Number of Adult Influenza Admissions, 75 plus years",
    "Number of Inpatient Beds",
    "Number of ICU Beds",
    "Number of Inpatient Beds Occupied",
    "Number of ICU Beds Occupied",
    "Percent Inpatient Beds Occupied",
    "Percent Inpatient Beds Occupied by Influenza Patients",
    "Percent ICU Beds Occupied",
    "Percent ICU Beds Occupied by Influenza Patients",
]

US_STATES = {
    "AK","AL","AR","AZ","CA","CO","CT","DC","DE","FL","GA",
    "HI","IA","ID","IL","IN","KS","KY","LA","MA","MD","ME",
    "MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM",
    "NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX",
    "UT","VA","VT","WA","WI","WV","WY",
}

def load_hospital_data(filepath: Path) -> pd.DataFrame:
    print(f"Loading hospital data from {filepath.name}...")
    df = pd.read_csv(filepath)

    df["Week Ending Date"] = pd.to_datetime(df["Week Ending Date"], errors="coerce")
    df = df.dropna(subset=["Week Ending Date"])
    df = df.rename(columns={"Geographic aggregation": "State"})

    df = df[df["State"].isin(US_STATES)].copy()

    df["Year"] = df["Week Ending Date"].dt.year
    df["WeekOfYear"] = df["Week Ending Date"].dt.isocalendar().week.astype(int)
    df["WeekIndex"] = (
        (df["Week Ending Date"] - df["Week Ending Date"].min()).dt.days // 7
    )

    available = [c for c in HOSPITAL_FEATURE_COLS if c in df.columns]
    missing = [c for c in HOSPITAL_FEATURE_COLS if c not in df.columns]
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

    if "Number of Inpatient Beds Occupied" in df.columns and "Number of Inpatient Beds" in df.columns:
        mask = df["Number of Inpatient Beds Occupied"] > df["Number of Inpatient Beds"]
        if mask.any():
            print(f"  Capping {mask.sum()} rows where inpatient beds occupied > available")
            df.loc[mask, "Number of Inpatient Beds Occupied"] = df.loc[mask, "Number of Inpatient Beds"]
    if "Number of ICU Beds Occupied" in df.columns and "Number of ICU Beds" in df.columns:
        mask = df["Number of ICU Beds Occupied"] > df["Number of ICU Beds"]
        if mask.any():
            print(f"  Capping {mask.sum()} rows where ICU beds occupied > available")
            df.loc[mask, "Number of ICU Beds Occupied"] = df.loc[mask, "Number of ICU Beds"]

    df = df.rename(columns={"Total Patients Hospitalized with Influenza": "Cases"})

    df = df.sort_values(["State", "Week Ending Date"]).reset_index(drop=True)

    print(f"  Rows: {len(df):,}")
    print(f"  States: {df['State'].nunique()}")
    print(f"  Date range: {df['Week Ending Date'].min().date()} – {df['Week Ending Date'].max().date()}")
    print(f"  Feature columns: {len(available)}")

    return df


def load_vaccination_coverage(filepath: Path) -> pd.DataFrame:
    print(f"Loading vaccination coverage from {filepath.name}...")
    df = pd.read_csv(filepath)

    state_df = df[df["Geography Type"] == "States/Local Areas"].copy()
    state_df["Estimate (%)"] = pd.to_numeric(state_df["Estimate (%)"], errors="coerce")
    state_df = state_df.dropna(subset=["Estimate (%)"])

    state_df["FluYear"] = state_df["Season/Survey Year"].str.extract(r"(\d{4})")[0].astype(int)

    agg = (
        state_df.groupby(["Geography", "FluYear"])["Estimate (%)"]
        .mean()
        .reset_index()
        .rename(columns={"Geography": "StateName", "Estimate (%)": "Vax_Coverage_Pct"})
    )

    name_to_abbr = {
        "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA",
        "Colorado":"CO","Connecticut":"CT","Delaware":"DE","District of Columbia":"DC",
        "Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL",
        "Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA",
        "Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN",
        "Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV",
        "New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY",
        "North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR",
        "Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",
        "Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA",
        "Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY",
    }
    agg["State"] = agg["StateName"].map(name_to_abbr)
    agg = agg.dropna(subset=["State"])
    agg["Year"] = agg["FluYear"]

    print(f"  State-year coverage rows: {len(agg):,}")
    return agg[["State", "Year", "Vax_Coverage_Pct"]]


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

    lag_targets = ["Cases", "Percent Inpatient Beds Occupied by Influenza Patients"]
    lag_targets = [t for t in lag_targets if t in df.columns]

    for target in lag_targets:
        for lag in lag_steps:
            df[f"{target}_lag_{lag}w"] = df.groupby("State")[target].shift(lag)

    required = [f"Cases_lag_{lag_steps[0]}w"]
    before = len(df)
    df = df.dropna(subset=required)
    print(f"  Rows after lag features: {len(df):,} (dropped {before - len(df)} for NaN lags)")

    lag_cols = [
        c for c in df.columns
        if any(f"_lag_{s}w" in c for s in lag_steps)
    ]
    before2 = len(df)
    df = df.dropna(subset=lag_cols)
    dropped2 = before2 - len(df)
    if dropped2:
        print(f"  Rows after dropping remaining NaN lags: {len(df):,} (dropped {dropped2} more)")

    return df


def main():
    parser = argparse.ArgumentParser(
        description="Process national weekly influenza hospital data into LSTM train/test CSVs"
    )
    parser.add_argument(
        "--hospital-file",
        required=True,
        help="Path to raw_weekly_hospital_respiratory_data CSV",
    )
    parser.add_argument(
        "--vax-file",
        default=None,
        help="Path to influenza vaccination coverage CSV (optional)",
    )
    parser.add_argument(
        "--train-cutoff",
        default="2023-01-01",
        help="Weeks before this date go to train, on/after to test (default: 2023-01-01)",
    )
    parser.add_argument("--outbreak-threshold", type=float, default=1.0)
    parser.add_argument("--lags", type=int, nargs="+", default=[1, 2, 4, 8])
    parser.add_argument("--output-dir", default="data")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    df = load_hospital_data(Path(args.hospital_file))

    if args.vax_file and Path(args.vax_file).exists():
        vax = load_vaccination_coverage(Path(args.vax_file))
        df = df.merge(vax, on=["State", "Year"], how="left")
        df["Vax_Coverage_Pct"] = df.groupby("State")["Vax_Coverage_Pct"].transform(
            lambda x: x.ffill().bfill()
        )
        df["Vax_Coverage_Pct"] = df["Vax_Coverage_Pct"].fillna(
            df["Vax_Coverage_Pct"].mean()
        )
        print(f"  Vaccination coverage merged. NaN remaining: {df['Vax_Coverage_Pct'].isna().sum()}")
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

    all_path = output_dir / "flu_national_weekly_all.csv"
    train_path = output_dir / "flu_national_weekly_train.csv"
    test_path = output_dir / "flu_national_weekly_test.csv"

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
