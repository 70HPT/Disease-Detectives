import os
import pandas as pd
import numpy as np
import requests
from datetime import datetime

from src.utils.config import get_config


def _load_county_geo(path):
    if not os.path.exists(path):
        return None
    df = pd.read_csv(path)
    if not {"fips", "lat", "lon"}.issubset(df.columns):
        raise ValueError("county_geo.csv must include columns: fips, lat, lon")
    df["fips"] = df["fips"].astype(str).str.zfill(5)
    return df[["fips", "lat", "lon"]]


def _fetch_open_meteo(lat, lon, start_date, end_date):
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "daily": "temperature_2m_mean,relative_humidity_2m_mean",
        "timezone": "UTC",
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    return response.json()

def load_climate_data(fips_list, dates, use_real_time=False, county_geo_path=None):
    """
    Load climate data (temperature, humidity) for counties and dates.
    
    In production, this would fetch from NOAA API:
    https://www.ncdc.noaa.gov/cdo-web/webservices/v2
    
    Args:
        fips_list: List of 5-digit FIPS codes
        dates: List of dates
    
    Returns:
        DataFrame with fips, date, avg_temp, avg_humidity
    """
    config = get_config()
    use_real_time = use_real_time or config["use_real_time_data"]
    county_geo_path = county_geo_path or config["county_geo_path"]

    if use_real_time:
        county_geo = _load_county_geo(county_geo_path)
        if county_geo is not None:
            cache_path = "data/processed/climate_cache.parquet"
            if os.path.exists(cache_path):
                cache_df = pd.read_parquet(cache_path)
            else:
                cache_df = pd.DataFrame(columns=["fips", "date", "avg_temp", "avg_humidity"])

            results = []
            dates = pd.to_datetime(pd.Series(dates)).dt.date
            start_date = dates.min().isoformat()
            end_date = dates.max().isoformat()

            for _, row in county_geo[county_geo["fips"].isin([str(f).zfill(5) for f in fips_list])].iterrows():
                fips_str = row["fips"]
                cached = cache_df[cache_df["fips"] == fips_str]
                cached_dates = set(pd.to_datetime(cached["date"]).dt.date)

                missing_dates = [d for d in dates if d not in cached_dates]
                if missing_dates:
                    try:
                        data = _fetch_open_meteo(row["lat"], row["lon"], start_date, end_date)
                        daily = data.get("daily", {})
                        day_dates = pd.to_datetime(daily.get("time", [])).date
                        temps = daily.get("temperature_2m_mean", [])
                        hums = daily.get("relative_humidity_2m_mean", [])

                        for d, t, h in zip(day_dates, temps, hums):
                            results.append({
                                "fips": fips_str,
                                "date": pd.to_datetime(d),
                                "avg_temp": t,
                                "avg_humidity": h / 100 if h is not None else np.nan,
                            })
                    except Exception as exc:
                        print(f"Warning: Open-Meteo failed for {fips_str} ({exc}).")

                if not cached.empty:
                    results.append(cached)

            if results:
                real_df = pd.concat([r if isinstance(r, pd.DataFrame) else pd.DataFrame([r]) for r in results], ignore_index=True)
                real_df = real_df.drop_duplicates(subset=["fips", "date"]).reset_index(drop=True)
                os.makedirs("data/processed", exist_ok=True)
                real_df.to_parquet(cache_path, index=False)
                return real_df

        print("Warning: county_geo.csv missing or invalid. Falling back to synthetic climate data.")

    np.random.seed(42)
    
    data = []
    for fips in fips_list:
        # Ensure FIPS is a string with zero-padding
        fips_str = str(fips).zfill(5)
        
        # Geographic location proxy from FIPS (state determines climate zone)
        state_fips = int(fips_str[:2])
        
        # Southern states (warmer): FL=12, TX=48, CA=06
        # Northern states (colder): IL=17, NY=36, PA=42
        is_southern = state_fips in [6, 12, 48]
        base_temp = 65 if is_southern else 50
        
        for date in dates:
            # Handle both datetime objects and year integers
            if isinstance(date, int):
                # For yearly data, use middle of year (day 182)
                day_of_year = 182
            else:
                day_of_year = date.timetuple().tm_yday
            
            # Seasonal temperature variation
            seasonal_temp = 25 * np.sin(2 * np.pi * (day_of_year - 80) / 365)
            
            # Daily variation
            temp_noise = np.random.normal(0, 5)
            temp = base_temp + seasonal_temp + temp_noise
            
            # Humidity (inversely correlated with cold, higher in summer)
            base_humidity = 0.65 if is_southern else 0.55
            seasonal_humidity = 0.15 * np.sin(2 * np.pi * (day_of_year - 80) / 365)
            humidity = base_humidity + seasonal_humidity + np.random.normal(0, 0.05)
            humidity = np.clip(humidity, 0.2, 0.95)
            
            data.append({
                'fips': fips_str,
                'date': date,
                'avg_temp': round(temp, 2),
                'avg_humidity': round(humidity, 4)
            })
    
    return pd.DataFrame(data)

def get_temperature_for_county(fips, date):
    """
    Get temperature for a specific county and date.
    
    Args:
        fips: 5-digit FIPS code
        date: datetime object
    
    Returns:
        Temperature in Fahrenheit
    """
    df = load_climate_data([fips], [date])
    if len(df) > 0:
        return df.iloc[0]['avg_temp']
    return None
