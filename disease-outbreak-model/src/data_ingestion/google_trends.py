import pandas as pd
import numpy as np

from src.utils.config import get_config

def _state_from_fips(fips_str):
    return str(fips_str).zfill(5)[:2]


def load_google_trends_data(fips_list, dates, keywords=None, use_real_time=False, geo=None):
    """
    Load Google Trends data for flu-related searches.
    
    In production, this would use pytrends library to fetch from Google Trends API.
    Keywords might include: "flu symptoms", "flu near me", "cold medicine", etc.
    
    Args:
        fips_list: List of 5-digit FIPS codes
        dates: List of dates
        keywords: List of search keywords (default: flu-related terms)
    
    Returns:
        DataFrame with fips, date, otc_search_index (0-100 scale)
    """
    config = get_config()
    use_real_time = use_real_time or config["use_real_time_data"]
    geo = geo or config["google_trends_geo"]

    if keywords is None:
        keywords = [k.strip() for k in config["google_trends_keywords"].split(",") if k.strip()]

    if use_real_time:
        try:
            from pytrends.request import TrendReq

            pytrends = TrendReq(hl="en-US", tz=360)
            dates = pd.to_datetime(pd.Series(dates))
            timeframe = f"{dates.min().date()} {dates.max().date()}"
            
            pytrends.build_payload(keywords, geo=geo, timeframe=timeframe)
            interest = pytrends.interest_over_time()

            if not interest.empty:
                interest = interest.reset_index().rename(columns={"date": "date"})
                interest["otc_search_index"] = interest[keywords].mean(axis=1)

                data = []
                for fips in fips_list:
                    fips_str = str(fips).zfill(5)
                    for _, row in interest.iterrows():
                        data.append({
                            "fips": fips_str,
                            "date": row["date"],
                            "otc_search_index": float(row["otc_search_index"]),
                        })

                return pd.DataFrame(data)
        except Exception as exc:
            print(f"Warning: Google Trends real-time load failed ({exc}). Falling back to synthetic data...")
    
    np.random.seed(42)
    
    data = []
    for fips in fips_list:
        # Ensure FIPS is a string with zero-padding
        fips_str = str(fips).zfill(5)
        
        # State-level search trends (simplified)
        state_fips = int(fips_str[:2])
        base_interest = np.random.uniform(20, 40)
        
        for date in dates:
            # Handle both datetime objects and year integers
            if isinstance(date, int):
                # For yearly data, use middle of year (day 182)
                day_of_year = 182
            else:
                day_of_year = date.timetuple().tm_yday
            
            # Seasonal pattern (higher searches in flu season)
            # Peak searches around week 6-10 (Feb-March)
            seasonal_interest = 30 * (np.cos(2 * np.pi * (day_of_year / 365 - 0.12)) + 1) / 2
            
            # Random daily variation
            noise = np.random.normal(0, 5)
            
            # Combine effects
            search_index = base_interest + seasonal_interest + noise
            search_index = np.clip(search_index, 0, 100)
            
            data.append({
                'fips': fips_str,
                'date': date,
                'otc_search_index': round(search_index, 2)
            })
    
    return pd.DataFrame(data)

def fetch_trends_for_region(geo_code, keywords, start_date, end_date):
    """
    Fetch Google Trends data for a specific region and time period.
    
    In production, would use:
    from pytrends.request import TrendReq
    pytrends = TrendReq(hl='en-US', tz=360)
    
    Args:
        geo_code: Geographic code (e.g., 'US-NY' for New York)
        keywords: List of keywords to track
        start_date: Start date for trends
        end_date: End date for trends
    
    Returns:
        DataFrame with date and interest scores
    """
    # Placeholder - in production would make actual API call
    date_range = pd.date_range(start_date, end_date, freq='W')
    
    np.random.seed(hash(geo_code) % 2**32)
    data = {
        'date': date_range,
        'interest': np.random.uniform(20, 80, len(date_range))
    }
    
    return pd.DataFrame(data)
