import os


def _get_bool_env(name, default=False):
	value = os.getenv(name)
	if value is None:
		return default
	return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def get_config():
	"""
	Centralized configuration for real-time data sources.
	Values can be overridden via environment variables.
	"""
	return {
		"use_real_time_data": _get_bool_env("REAL_TIME_DATA", default=False),
		"cdc_flu_data_url": os.getenv("CDC_FLU_DATA_URL", ""),
		"cdc_app_token": os.getenv("CDC_APP_TOKEN", ""),
		"cdc_fips_col": os.getenv("CDC_FIPS_COL", "fips"),
		"cdc_date_col": os.getenv("CDC_DATE_COL", "date"),
		"cdc_cases_col": os.getenv("CDC_CASES_COL", "flu_cases"),
		"census_api_key": os.getenv("CENSUS_API_KEY", ""),
		"noaa_token": os.getenv("NOAA_TOKEN", ""),
		"county_geo_path": os.getenv("COUNTY_GEO_PATH", "data/external/county_geo.csv"),
		"google_trends_geo": os.getenv("GOOGLE_TRENDS_GEO", "US"),
		"google_trends_keywords": os.getenv("GOOGLE_TRENDS_KEYWORDS", "flu symptoms,cold medicine,fever"),
	}
