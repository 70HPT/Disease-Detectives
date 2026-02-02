import pandas as pd
import numpy as np
import requests

from src.utils.config import get_config

def _split_fips(fips_str):
    fips_str = str(fips_str).zfill(5)
    return fips_str[:2], fips_str[2:]


def _fetch_acs_population(state_fips, county_fips, api_key):
    url = "https://api.census.gov/data/2022/acs/acs5"
    params = {
        "get": "B01001_001E",
        "for": f"county:{county_fips}",
        "in": f"state:{state_fips}",
        "key": api_key,
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    rows = response.json()
    if len(rows) < 2:
        return None
    return int(rows[1][0])


def _fetch_land_area(state_fips, county_fips, api_key):
    url = "https://api.census.gov/data/2020/dec/pl"
    params = {
        "get": "ALAND",
        "for": f"county:{county_fips}",
        "in": f"state:{state_fips}",
        "key": api_key,
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    rows = response.json()
    if len(rows) < 2:
        return None
    return float(rows[1][0])


def load_census_data(fips_list, use_real_time=False, api_key=None):
    """
    Load census data for specified counties.
    
    In production, this would fetch from Census API:
    https://api.census.gov/data/2020/acs/acs5
    
    Args:
        fips_list: List of 5-digit FIPS codes
    
    Returns:
        DataFrame with fips, population, population_density, 
        unemployment_rate, vaccination_rate
    """
    config = get_config()
    use_real_time = use_real_time or config["use_real_time_data"]
    api_key = api_key or config["census_api_key"]

    if use_real_time and api_key:
        records = []
        for fips in fips_list:
            fips_str = str(fips).zfill(5)
            state_fips, county_fips = _split_fips(fips_str)

            try:
                population = _fetch_acs_population(state_fips, county_fips, api_key)
                land_area = _fetch_land_area(state_fips, county_fips, api_key)
                if population is None:
                    continue
                density = None
                if land_area and land_area > 0:
                    # ALAND is in square meters
                    density = population / (land_area / 1_000_000)  # people per km^2

                records.append({
                    "fips": fips_str,
                    "population": int(population),
                    "population_density": round(density, 2) if density is not None else np.nan,
                    "unemployment_rate": np.nan,
                    "vaccination_rate": np.nan,
                })
            except Exception as exc:
                print(f"Warning: Census API failed for {fips_str} ({exc}).")

        if records:
            return pd.DataFrame(records)

        print("Warning: Census API returned no data. Falling back to synthetic.")

    np.random.seed(42)
    
    data = []
    for fips in fips_list:
        # Ensure FIPS is a string with zero-padding
        fips_str = str(fips).zfill(5)
        
        # Generate realistic county statistics based on FIPS patterns
        # Urban counties (last 3 digits < 050) tend to be larger/denser
        county_num = int(fips_str[-3:])
        is_urban = county_num < 50
        
        if is_urban:
            population = np.random.randint(100000, 2000000)
            density = np.random.uniform(500, 5000)
            unemployment = np.random.uniform(0.03, 0.08)
            vaccination = np.random.uniform(0.55, 0.75)
        else:
            population = np.random.randint(10000, 150000)
            density = np.random.uniform(20, 500)
            unemployment = np.random.uniform(0.04, 0.12)
            vaccination = np.random.uniform(0.35, 0.60)
        
        data.append({
            'fips': fips_str,
            'population': int(population),
            'population_density': round(density, 2),
            'unemployment_rate': round(unemployment, 4),
            'vaccination_rate': round(vaccination, 4)
        })
    
    return pd.DataFrame(data)

def fetch_county_populations(fips_list=None):
    """
    Fetch population data for counties.
    This is a simplified version - in production would use Census API.
    
    Args:
        fips_list: List of FIPS codes (optional)
    
    Returns:
        Dictionary mapping FIPS to population
    """
    if fips_list is None:
        return {}
    
    df = load_census_data(fips_list)
    return dict(zip(df['fips'], df['population']))
