"""
Evaluate trained model on test.csv
"""

import torch
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import os

from src.models.flu_predictor import FluPredictor
from src.data_ingestion.kaggle_california import load_kaggle_california_data, aggregate_by_disease
from src.data_ingestion.census import load_census_data
from src.data_ingestion.climate import load_climate_data
from src.data_ingestion.google_trends import load_google_trends_data
from src.preprocessing.lag_features import add_lag_features


def evaluate_model(model_path, test_csv_path):
    """Evaluate trained model on test data."""
    
    print("\n" + "="*80)
    print("EVALUATING MODEL ON TEST SET")
    print("="*80)
    
    # Load test data
    print("\n[1/5] Loading test data...")
    test_df = load_kaggle_california_data(test_csv_path)
    test_df = aggregate_by_disease(test_df, "total")
    test_df.columns = ["fips", "date", "flu_cases"]
    test_df["date"] = pd.to_datetime(test_df["date"], format="%Y")
    print(f"   Loaded: {len(test_df)} observations")
    
    # Load model
    print("\n[2/5] Loading trained model...")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")
    
    checkpoint = torch.load(model_path, weights_only=False)
    feature_cols = checkpoint['feature_cols']
    target_col = checkpoint['target_col']
    scaler = checkpoint['scaler']
    disease = checkpoint.get('disease', 'unknown')
    
    input_dim = len(feature_cols)
    model = FluPredictor(input_dim)
    model.load_state_dict(checkpoint['model_state_dict'])
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    model.eval()
    
    print(f"   Model loaded: {disease}")
    print(f"   Features: {len(feature_cols)}")
    print(f"   Device: {device}")
    
    # Load features
    print("\n[3/5] Loading features...")
    unique_fips = test_df["fips"].unique().tolist()
    unique_dates = test_df["date"].unique().tolist()
    
    census_df = load_census_data(unique_fips, use_real_time=False)
    climate_df = load_climate_data(unique_fips, unique_dates, use_real_time=False)
    trends_df = load_google_trends_data(unique_fips, unique_dates, use_real_time=False)
    print(f" Features loaded")
    
    # Merge features
    print("\n[4/5] Building feature table...")
    test_df = test_df.merge(census_df, on="fips", how="left")
    test_df = test_df.merge(climate_df, on=["fips", "date"], how="left")
    test_df = test_df.merge(trends_df, on=["fips", "date"], how="left")
    
    # Add lag features
    test_df = add_lag_features(test_df, target_col="flu_cases", lags=[1, 2, 3])
    test_df = test_df.dropna()
    print(f" Feature table: {len(test_df)} rows")
    
    # Ensure all feature columns exist
    missing_cols = [col for col in feature_cols if col not in test_df.columns]
    if missing_cols:
        print(f"  ⚠ Missing columns: {missing_cols}, filling with 0")
        for col in missing_cols:
            test_df[col] = 0
    
    # Predict
    print("\n[5/5] Generating predictions...")
    X_test = test_df[feature_cols].values
    X_test_scaled = scaler.transform(X_test)
    X_test_tensor = torch.tensor(X_test_scaled, dtype=torch.float32).to(device)
    
    with torch.no_grad():
        predictions = model(X_test_tensor).cpu().numpy()
    
    y_test = test_df["flu_cases"].values
    
    # Calculate metrics
    rmse = np.sqrt(np.mean((predictions.flatten() - y_test) ** 2))
    mae = np.mean(np.abs(predictions.flatten() - y_test))
    mape = np.mean(np.abs((predictions.flatten() - y_test) / (np.abs(y_test) + 1))) * 100
    r2 = 1 - (np.sum((y_test - predictions.flatten()) ** 2) / np.sum((y_test - y_test.mean()) ** 2))
    
    print("\n" + "="*80)
    print("TEST RESULTS")
    print("="*80)
    print(f"  Test Set Size:   {len(test_df)}")
    print(f"  RMSE:            {rmse:,.2f}")
    print(f"  MAE:             {mae:,.2f}")
    print(f"  MAPE:            {mape:.2f}%")
    print(f"  R² Score:        {r2:.4f}")
    
    print(f"\n{'Actual':<12} {'Predicted':<12} {'Error':<12} {'% Error':<12}")
    print("-" * 48)
    for i in range(min(15, len(predictions))):
        actual = y_test[i]
        pred = predictions[i, 0]
        error = pred - actual
        pct_error = (error / (abs(actual) + 1)) * 100 if actual != 0 else 0
        print(f"{actual:<12.1f} {pred:<12.1f} {error:<12.1f} {pct_error:<12.1f}%")
    
    print("\n" + "="*80 + "\n")
    
    return {
        'rmse': rmse,
        'mae': mae,
        'mape': mape,
        'r2': r2,
        'n_samples': len(test_df)
    }


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Evaluate model on test data")
    parser.add_argument("--model", default="outputs/ca_total_model.pth",
                        help="Path to trained model")
    parser.add_argument("--test-csv", default="data/raw/test.csv",
                        help="Path to test CSV")
    
    args = parser.parse_args()
    
    metrics = evaluate_model(args.model, args.test_csv)
