def add_lag_features(df, target_col="flu_cases", lags=[1, 2, 3]):
    """
    Adds lagged versions of the target variable.
    Example: flu_cases_lag_1, flu_cases_lag_2, etc.
    """

    df = df.dropna()

    for lag in lags:
        df[f"{target_col}_lag_{lag}"] = (
            df.groupby("fips")[target_col]
              .shift(lag)
        )

    # Drop rows with missing lags
    df = df.dropna().reset_index(drop=True)

    return df
