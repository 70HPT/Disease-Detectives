import pandas as pd
import numpy as np
import os
from pathlib import Path


def load_kaggle_california_data(kaggle_path="data/raw/train.csv"):
    """
    Load California infectious disease dataset from Kaggle.
    
    Expected columns (from https://www.kaggle.com/datasets/haithemhermessi/infectious-disease-prediction):
    - Disease: Disease type (flu, measles, pertussis, etc.)
    - County: County name
    - Year: Year (2001-2014)
    - Sex: Male/Female/Unknown
    - Count: Number of confirmed cases
    - Population: Population for that strata
    - Rate: Cases per 100,000
    - CI.lower, CI.upper: 95% confidence intervals
    
    Returns:
        DataFrame with columns: fips, disease, year, cases
    """
    if not os.path.exists(kaggle_path):
        raise FileNotFoundError(
            f"Kaggle dataset not found at {kaggle_path}.\n\n"
            "Download from Kaggle:\n"
            "https://www.kaggle.com/datasets/haithemhermessi/infectious-disease-prediction\n\n"
            "Extract train.csv to: data/raw/train.csv"
        )
    
    df = pd.read_csv(kaggle_path)
    print(f"Loaded raw data: {len(df)} rows, columns: {list(df.columns)}")
    
    # Normalize column names
    df.columns = df.columns.str.lower().str.strip()
    
    # Map county names to FIPS
    if "county" in df.columns:
        df["fips"] = df["county"].apply(_county_name_to_fips_ca)
    
    # Standardize column names
    required_cols = {"fips", "disease", "year", "count"}
    if not required_cols.issubset(df.columns):
        missing = required_cols - set(df.columns)
        print(f"Warning: Dataset columns: {list(df.columns)}")
        raise ValueError(f"Dataset missing required columns: {missing}")
    
    # Rename count to cases
    df["cases"] = pd.to_numeric(df["count"], errors="coerce").fillna(0).astype(int)
    
    df["fips"] = df["fips"].astype(str).str.zfill(5)
    df["year"] = df["year"].astype(int)
    
    # Filter to California only (FIPS 06xxx)
    df = df[df["fips"].str.startswith("06")].copy()
    
    # Group by county, disease, and year to aggregate multiple sex categories
    df_agg = df.groupby(["fips", "disease", "year"]).agg({
        "cases": "sum",
        "population": "mean",
    }).reset_index()
    
    df_agg = df_agg.sort_values(["fips", "disease", "year"]).reset_index(drop=True)
    
    print(f"Processed data: {len(df_agg)} rows, {df_agg['fips'].nunique()} CA counties")
    print(f"Diseases: {sorted(df_agg['disease'].unique().tolist())}")
    print(f"Year range: {df_agg['year'].min()}-{df_agg['year'].max()}")
    
    return df_agg[["fips", "disease", "year", "cases"]]


def _county_name_to_fips_ca(county_name):
    """Map California county name to FIPS code."""
    ca_county_fips = {
        "alameda": "06001",
        "alpine": "06003",
        "amador": "06005",
        "butte": "06007",
        "calaveras": "06009",
        "colusa": "06011",
        "contra costa": "06013",
        "del norte": "06015",
        "el dorado": "06017",
        "fresno": "06019",
        "glenn": "06021",
        "humboldt": "06023",
        "imperial": "06025",
        "inyo": "06027",
        "kern": "06029",
        "kings": "06031",
        "lake": "06033",
        "lassen": "06035",
        "los angeles": "06037",
        "madera": "06039",
        "marin": "06041",
        "mariposa": "06043",
        "mendocino": "06045",
        "merced": "06047",
        "modoc": "06049",
        "mono": "06051",
        "monterey": "06053",
        "napa": "06055",
        "nevada": "06057",
        "orange": "06059",
        "placer": "06061",
        "plumas": "06063",
        "riverside": "06065",
        "sacramento": "06067",
        "san benito": "06069",
        "san bernardino": "06071",
        "san diego": "06073",
        "san francisco": "06075",
        "san joaquin": "06077",
        "san luis obispo": "06079",
        "san mateo": "06081",
        "santa barbara": "06083",
        "santa clara": "06085",
        "santa cruz": "06087",
        "shasta": "06089",
        "sierra": "06091",
        "siskiyou": "06093",
        "solano": "06095",
        "sonoma": "06097",
        "stanislaus": "06099",
        "sutter": "06101",
        "tehama": "06103",
        "trinity": "06105",
        "tulare": "06107",
        "tuolumne": "06109",
        "ventura": "06111",
        "yolo": "06113",
        "yuba": "06115",
    }
    
    clean_name = county_name.lower().strip()
    return ca_county_fips.get(clean_name, None)


def get_ca_counties_fips():
    """Return all California county FIPS codes."""
    df = pd.read_csv("data/raw/california_diseases.csv", nrows=0)
    if "fips" in df.columns:
        return df["fips"].unique().tolist()
    
    # Return all CA county FIPS codes (06001-06115)
    return [f"0600{i:02d}" if i < 10 else f"060{i:02d}" if i < 100 else f"06{i:03d}" for i in range(1, 116, 2)]


def aggregate_by_disease(df, disease_name):
    """
    Aggregate cases by disease for modeling.
    
    Args:
        df: DataFrame with fips, disease, year, cases
        disease_name: Disease to isolate ("total" for all diseases combined)
    
    Returns:
        DataFrame with fips, year, cases
    """
    if disease_name.lower() == "total":
        result = df.groupby(["fips", "year"])["cases"].sum().reset_index()
    else:
        result = df[df["disease"].str.lower() == disease_name.lower()].copy()
        result = result.groupby(["fips", "year"])["cases"].sum().reset_index()
    
    return result.sort_values(["fips", "year"]).reset_index(drop=True)


if __name__ == "__main__":
    try:
        df = load_kaggle_california_data()
        print("\nSample data:")
        print(df.head(10))
        print("\nDisease types:", df["disease"].unique())
    except FileNotFoundError as e:
        print(f"Error: {e}")
