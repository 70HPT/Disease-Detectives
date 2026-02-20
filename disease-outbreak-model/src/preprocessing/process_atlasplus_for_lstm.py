import pandas as pd
import numpy as np
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent.parent))

def clean_year(year_str):
    
    return int(str(year_str).split()[0])

def extract_numeric_cases(val):
    
    if pd.isna(val):
        return np.nan
    
    val_str = str(val).strip()
    
    # Skip specific non-numeric markers
    if val_str in ['Data not available', 'Suppressed', '']:
        return np.nan
    
    # Remove commas
    val_str = val_str.replace(',', '')
    
    try:
        return float(val_str)
    except:
        return np.nan

def extract_fips_code(fips_str):
    
    if pd.isna(fips_str):
        return None
    
    fips_str = str(fips_str).strip()
    if len(fips_str) >= 5:
        return fips_str[:5]
    return fips_str

def define_outbreak_labels(df, method='statistical', threshold=1.0):
    
    if method == 'statistical':
        county_stats = df.groupby('FIPS')['Cases'].agg(['mean', 'std']).reset_index()
        county_stats['threshold'] = county_stats['mean'] + threshold * county_stats['std']
        
        df = df.merge(county_stats[['FIPS', 'threshold']], on='FIPS', how='left')
        
        df['Outbreak'] = (df['Cases'] > df['threshold']).astype(int)
        df = df.drop('threshold', axis=1)
    
    return df

def main():
    print("=" * 80)
    print("Processing AtlasPlusTableData.csv for LSTM Training (ALL US COUNTIES)")
    print("=" * 80)
    
    print("\nLoading full AtlasPlus data for all US counties...")
    
    # Read the CSV with proper header
    with open('/Users/brauliopantoja-esquina/Downloads/AtlasPlusTableData.csv', 'r') as f:
        lines = f.readlines()
        header_row = 0
        for i, line in enumerate(lines):
            if 'Indicator,Year,State' in line:
                header_row = i
                break
    
    df_full = pd.read_csv('/Users/brauliopantoja-esquina/Downloads/AtlasPlusTableData.csv', skiprows=header_row)
    print(f"Loaded {len(df_full):,} total records (all US states)")
    
    # Filter for aggregated data (all age groups, both sexes, all races)
    df = df_full[
        (df_full['Age Group'] == 'All age groups') &
        (df_full['Sex'] == 'Both sexes') &
        (df_full['Race/Ethnicity'] == 'All races/ethnicities')
    ].copy()
    
    print(f"After filtering for aggregated demographics: {len(df):,} records")
    print(f"States: {df['State'].nunique()}")
    print(f"Counties: {df['County'].nunique()}")
    
    # Clean the data
    print("\nCleaning data...")
    df['Year'] = df['Year'].apply(clean_year)
    df['Cases'] = df['Cases'].apply(extract_numeric_cases)
    df['FIPS'] = df['FIPS'].apply(extract_fips_code)
    
    # Remove records with missing FIPS or Cases
    df = df.dropna(subset=['FIPS', 'Cases'])
    print(f"After removing missing FIPS/Cases: {len(df):,} records")
    
    # Add Disease column for consistency
    df['Disease'] = 'Chlamydia'
    df['Sex'] = 'Total'
    
    # Keep only necessary columns
    df = df[['Year', 'State', 'FIPS', 'County', 'Disease', 'Sex', 'Cases']].copy()
    
    print(f"\nYear range: {df['Year'].min()} to {df['Year'].max()}")
    print(f"States: {df['State'].nunique()}")
    print(f"Counties: {df['FIPS'].nunique()}")
    print(f"Total records: {len(df):,}")
    
    print("\nNote: Census data only available for California counties.")
    print("Using disease case counts as primary feature for all US counties.")
    
    # For now, just use the disease data without census features
    # This gives us much more data for the LSTM model
    final_df = df.copy()
    
    # Define outbreak labels
    print("\nDefining outbreak labels...")
    final_df = define_outbreak_labels(final_df, method='statistical', threshold=1.0)
    
    outbreak_rate = final_df['Outbreak'].mean()
    print(f"Outbreak rate: {outbreak_rate*100:.1f}%")
    print(f"Outbreaks: {final_df['Outbreak'].sum():,}")
    print(f"Non-outbreaks: {(final_df['Outbreak'] == 0).sum():,}")
    
    print("\nCreating lag features (1, 2, 3 years...)")
    final_df = final_df.sort_values(['FIPS', 'Year'])
    
    for lag in [1, 2, 3]:
        final_df[f'Cases_lag_{lag}'] = final_df.groupby('FIPS')['Cases'].shift(lag)
    
    # Drop rows with NaN lag features
    final_df = final_df.dropna(subset=['Cases_lag_1', 'Cases_lag_2', 'Cases_lag_3'])
    print(f"After adding lag features: {len(final_df):,} records")
    print(f"Year range: {final_df['Year'].min()}-{final_df['Year'].max()}")
    
    # NOW split into train/test by year
    # We need at least 3 consecutive years per county for sequences
    # Use 2003-2019 for training (17 years), 2020-2023 for testing (4 years)
    train_df = final_df[final_df['Year'] <= 2019].copy()
    test_df = final_df[final_df['Year'] >= 2020].copy()
    
    print(f"\nTrain set: {len(train_df):,} records ({train_df['Year'].min()}-{train_df['Year'].max()})")
    print(f"  Counties: {train_df['FIPS'].nunique()}")
    print(f"  Outbreak rate: {train_df['Outbreak'].mean()*100:.1f}%")
    print(f"Test set: {len(test_df):,} records ({test_df['Year'].min()}-{test_df['Year'].max()})")
    print(f"  Counties: {test_df['FIPS'].nunique()}")
    print(f"  Outbreak rate: {test_df['Outbreak'].mean()*100:.1f}%")
    
    train_file = 'data/atlasplus_all_us_train.csv'
    test_file = 'data/atlasplus_all_us_test.csv'
    
    train_df.to_csv(train_file, index=False)
    test_df.to_csv(test_file, index=False)
    
    print(f"\nSaved training data to: {train_file}")
    print(f"Saved test data to: {test_file}")
    
    # Show feature columns
    feature_cols = [col for col in final_df.columns if col not in 
                   ['Year', 'State', 'FIPS', 'County', 'Disease', 'Sex', 'Outbreak']]
    print(f"\nFeature columns ({len(feature_cols)}):")
    if len(feature_cols) > 0:
        for col in sorted(feature_cols)[:20]:  # Show first 20
            print(f"  - {col}")
        if len(feature_cols) > 20:
            print(f"  ... and {len(feature_cols) - 20} more")
    else:
        print("  (Using only Cases and lag features)")
    
    print("\n" + "=" * 80)
    print("Data processing complete!")
    print(f"Total usable records (with lag features): {len(final_df):,}")
    print(f"This is {len(final_df)/1392:.1f}x more data than California-only dataset!")
    print("=" * 80)

if __name__ == '__main__':
    main()
