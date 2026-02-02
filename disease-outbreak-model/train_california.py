"""
Train on California infectious disease data.
This script:
1. Loads Kaggle California disease dataset
2. Trains a model on CA county-level patterns
3. Saves the trained model
"""

import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import numpy as np
import os
import json
from datetime import datetime
import argparse

from src.data_ingestion.kaggle_california import load_kaggle_california_data, aggregate_by_disease
from src.data_ingestion.census import load_census_data
from src.data_ingestion.climate import load_climate_data
from src.data_ingestion.google_trends import load_google_trends_data
from src.preprocessing.lag_features import add_lag_features
from src.models.flu_predictor import FluPredictor


def train_california_model(
    kaggle_path="data/raw/california_diseases.csv",
    disease_name="total",
    output_dir="outputs",
    num_epochs=50,
):
    """
    Train outbreak prediction model on California data.
    
    Args:
        kaggle_path: Path to Kaggle California dataset
        disease_name: Disease to model ("total", "flu", "measles", etc.)
        output_dir: Directory to save model
        num_epochs: Number of training epochs
    """
    
    print("=" * 70)
    print(f"TRAINING ON CALIFORNIA DATA: {disease_name.upper()}")
    print("=" * 70)
    
    # Load California disease data
    print("\n[1/5] Loading California disease data...")
    ca_df = load_kaggle_california_data(kaggle_path)
    
    # Aggregate by disease
    df = aggregate_by_disease(ca_df, disease_name)
    print(f"  Loaded: {len(df)} observations across {df['fips'].nunique()} CA counties")
    print(f"  Year range: {df['year'].min()} to {df['year'].max()}")
    print(f"  Cases range: {df['cases'].min()} to {df['cases'].max()}")
    
    # Rename to standard column names (year → date for compatibility)
    df.columns = ["fips", "date", "flu_cases"]  # Treat year as date for pipeline
    
    # Convert year integers to datetime objects
    df["date"] = pd.to_datetime(df["date"], format="%Y")
    
    # Get unique counties and dates
    unique_fips = df["fips"].unique().tolist()
    unique_dates = df["date"].unique().tolist()
    
    # Load features for California counties
    print("\n[2/5] Loading census features...")
    census_df = load_census_data(unique_fips, use_real_time=False)
    print(f"  Loaded census data for {len(census_df)} counties")
    
    print("\n[3/5] Loading climate features...")
    climate_df = load_climate_data(unique_fips, unique_dates, use_real_time=False)
    print(f"  Loaded {len(climate_df)} climate observations")
    
    print("\n[4/5] Loading Google Trends data...")
    trends_df = load_google_trends_data(unique_fips, unique_dates, use_real_time=False)
    print(f"  Loaded {len(trends_df)} trend observations")
    
    # Merge all features
    print("\n[5/5] Building feature table...")
    df = df.merge(census_df, on="fips", how="left")
    df = df.merge(climate_df, on=["fips", "date"], how="left")
    df = df.merge(trends_df, on=["fips", "date"], how="left")
    
    # Fill missing numeric values
    numeric_cols = df.select_dtypes(include=["number"]).columns
    for col in numeric_cols:
        median_value = df[col].median()
        df[col] = df[col].fillna(median_value)
    
    df = df.sort_values(["fips", "date"]).reset_index(drop=True)
    print(f"  Feature table: {len(df)} rows, {len(df.columns)} columns")
    
    # Add lag features
    print("\nAdding temporal lag features...")
    df = add_lag_features(df, target_col="flu_cases", lags=[1, 2, 3])
    print(f"  After lags: {len(df)} rows")
    
    FEATURE_COLS = [
        "population",
        "population_density",
        "unemployment_rate",
        "vaccination_rate",
        "avg_temp",
        "avg_humidity",
        "otc_search_index",
        "flu_cases_lag_1",
        "flu_cases_lag_2",
        "flu_cases_lag_3",
    ]
    
    TARGET_COL = "flu_cases"
    
    # Split data
    print("\nSplitting data: 80% train, 20% validation...")
    train_df, val_df = train_test_split(df, test_size=0.2, random_state=42, shuffle=True)
    print(f"  Train: {len(train_df)} rows, Val: {len(val_df)} rows")
    
    # Scale features
    print("\nScaling features...")
    scaler = StandardScaler()
    train_df_scaled = train_df.copy()
    val_df_scaled = val_df.copy()
    
    train_df_scaled[FEATURE_COLS] = scaler.fit_transform(train_df[FEATURE_COLS])
    val_df_scaled[FEATURE_COLS] = scaler.transform(val_df[FEATURE_COLS])
    
    # Create datasets
    X_train = torch.tensor(train_df_scaled[FEATURE_COLS].values, dtype=torch.float32)
    y_train = torch.tensor(train_df_scaled[TARGET_COL].values, dtype=torch.float32).unsqueeze(1)
    X_val = torch.tensor(val_df_scaled[FEATURE_COLS].values, dtype=torch.float32)
    y_val = torch.tensor(val_df_scaled[TARGET_COL].values, dtype=torch.float32).unsqueeze(1)

    train_dataset = TensorDataset(X_train, y_train)
    val_dataset = TensorDataset(X_val, y_val)
    
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)
    
    # Initialize model
    input_dim = len(FEATURE_COLS)
    model = FluPredictor(input_dim)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    loss_fn = nn.MSELoss()
    
    # Training
    print("\n" + "=" * 70)
    print("TRAINING")
    print("=" * 70)
    
    num_epochs = num_epochs
    best_val_loss = float('inf')
    patience = 10
    patience_counter = 0
    
    for epoch in range(num_epochs):
        # Train
        model.train()
        train_loss = 0.0
        train_mae = 0.0
        
        for X, y in train_loader:
            X, y = X.to(device), y.to(device)
            optimizer.zero_grad()
            preds = model(X)
            loss = loss_fn(preds, y)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * X.size(0)
            train_mae += torch.abs(preds - y).sum().item()
        
        train_loss /= len(train_dataset)
        train_mae /= len(train_dataset)
        train_rmse = np.sqrt(train_loss)
        
        # Validate
        model.eval()
        val_loss = 0.0
        val_mae = 0.0
        
        with torch.no_grad():
            for X, y in val_loader:
                X, y = X.to(device), y.to(device)
                preds = model(X)
                loss = loss_fn(preds, y)
                
                val_loss += loss.item() * X.size(0)
                val_mae += torch.abs(preds - y).sum().item()
        
        val_loss /= len(val_dataset)
        val_mae /= len(val_dataset)
        val_rmse = np.sqrt(val_loss)
        
        # Log
        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f"Epoch [{epoch+1}/{num_epochs}]")
            print(f"  Train - Loss: {train_loss:.4f}, RMSE: {train_rmse:.4f}, MAE: {train_mae:.4f}")
            print(f"  Val   - Loss: {val_loss:.4f}, RMSE: {val_rmse:.4f}, MAE: {val_mae:.4f}")
        
        # Early stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            
            # Save best model
            os.makedirs(output_dir, exist_ok=True)
            model_path = os.path.join(output_dir, f"ca_{disease_name}_model.pth")
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'train_loss': train_loss,
                'val_loss': val_loss,
                'scaler': scaler,
                'feature_cols': FEATURE_COLS,
                'target_col': TARGET_COL,
                'disease': disease_name,
            }, model_path)
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"\nEarly stopping at epoch {epoch+1}")
                break
    
    print("\n" + "=" * 70)
    print(f"Training complete!")
    print(f"Best validation RMSE: {np.sqrt(best_val_loss):.4f}")
    print(f"Model saved to: {model_path}")
    
    # Save metadata
    metadata = {
        'timestamp': datetime.now().isoformat(),
        'data_source': 'California Kaggle Dataset',
        'disease': disease_name,
        'num_epochs_trained': epoch + 1,
        'best_val_rmse': float(np.sqrt(best_val_loss)),
        'num_ca_counties': df['fips'].nunique(),
        'feature_cols': FEATURE_COLS,
        'target_col': TARGET_COL,
        'train_size': len(train_dataset),
        'val_size': len(val_dataset),
    }
    
    metadata_path = os.path.join(output_dir, f"ca_{disease_name}_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    
    print(f"Metadata saved to: {metadata_path}")
    print("=" * 70)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train model on California disease data")
    parser.add_argument("--kaggle-path", default="data/raw/california_diseases.csv", 
                        help="Path to Kaggle California dataset")
    parser.add_argument("--disease", default="total", 
                        help="Disease to model (e.g., 'flu', 'measles', 'total')")
    parser.add_argument("--epochs", type=int, default=50, help="Number of epochs")
    parser.add_argument("--output-dir", default="outputs", help="Output directory")
    
    args = parser.parse_args()
    
    train_california_model(
        kaggle_path=args.kaggle_path,
        disease_name=args.disease,
        num_epochs=args.epochs,
        output_dir=args.output_dir,
    )
