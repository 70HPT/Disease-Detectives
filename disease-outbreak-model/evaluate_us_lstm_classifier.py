
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix, roc_curve
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent / 'src'))
from models.Disease_Predictor import OutbreakLSTMClassifier

def create_lag_features(df, lag_steps=[1, 2, 3]):
    
    df = df.sort_values(['FIPS', 'Year'])
    
    for lag in lag_steps:
        df[f'Cases_lag_{lag}'] = df.groupby('FIPS')['Cases'].shift(lag)
    
    # Drop rows with NaN lag features
    df = df.dropna(subset=[f'Cases_lag_{lag}' for lag in lag_steps])
    
    return df

def create_sequences(data, seq_length):
    
    sequences = []
    labels = []
    county_ids = []
    years = []
    
    # Group by county (FIPS)
    for fips, group in data.groupby('FIPS'):
        group = group.sort_values('Year')
        
        if len(group) < seq_length:
            continue
        
        feature_cols = [col for col in group.columns if col not in 
                       ['Year', 'State', 'FIPS', 'County', 'Disease', 'Sex', 
                        'Outbreak', 'NAME', 'state', 'county']]
        
        features = group[feature_cols].values
        outbreak_labels = group['Outbreak'].values
        year_values = group['Year'].values
        
        for i in range(len(group) - seq_length + 1):
            seq = features[i:i + seq_length]
            label = outbreak_labels[i + seq_length - 1]
            year = year_values[i + seq_length - 1]
            
            sequences.append(seq)
            labels.append(label)
            county_ids.append(fips)
            years.append(year)
    
    return np.array(sequences), np.array(labels), np.array(county_ids), np.array(years)

class OutbreakDataset(Dataset):
    def __init__(self, sequences, labels):
        self.sequences = torch.FloatTensor(sequences)
        self.labels = torch.FloatTensor(labels)
    
    def __len__(self):
        return len(self.sequences)
    
    def __getitem__(self, idx):
        return self.sequences[idx], self.labels[idx]

def evaluate_model(model, test_loader, device):
    
    model.eval()
    all_preds = []
    all_probs = []
    all_labels = []
    
    with torch.no_grad():
        for sequences, labels in test_loader:
            sequences = sequences.to(device)
            
            outputs = model(sequences).squeeze()
            probs = torch.sigmoid(outputs).cpu().numpy()
            preds = (probs > 0.5).astype(int)
            
            all_preds.extend(preds)
            all_probs.extend(probs)
            all_labels.extend(labels.numpy())
    
    return np.array(all_preds), np.array(all_probs), np.array(all_labels)

def main():
    print("=" * 80)
    print("Evaluating LSTM Classifier on US Chlamydia Test Dataset (2020-2023)")
    print("=" * 80)
    
    print("\nLoading training data for normalization...")
    train_df = pd.read_csv('data/atlasplus_all_us_train.csv')
    
    feature_cols = [col for col in train_df.columns if col not in 
                   ['Year', 'State', 'FIPS', 'County', 'Disease', 'Sex', 'Outbreak']]
    
    # Fit scaler on training data
    scaler = StandardScaler()
    scaler.fit(train_df[feature_cols])
    
    print("\nLoading test data...")
    test_df = pd.read_csv('data/atlasplus_all_us_test.csv')
    print(f"Test records: {len(test_df):,}")
    print(f"Counties: {test_df['FIPS'].nunique()}")
    print(f"Year range: {test_df['Year'].min()}-{test_df['Year'].max()}")
    print(f"Outbreak rate: {test_df['Outbreak'].mean()*100:.1f}%")
    
    # Lag features already included
    print("\nLag features already included in dataset")
    
    # Normalize features using training scaler
    print("\nNormalizing features...")
    test_df[feature_cols] = scaler.transform(test_df[feature_cols])
    
    seq_length = 3
    print(f"\nCreating sequences (sequence length = {seq_length})...")
    
    test_seq, test_labels, test_counties, test_years = create_sequences(test_df, seq_length)
    
    print(f"Test sequences: {len(test_seq):,}")
    print(f"  Unique counties: {len(np.unique(test_counties))}")
    print(f"  Outbreak sequences: {test_labels.sum():.0f} ({test_labels.mean()*100:.1f}%)")
    
    test_dataset = OutbreakDataset(test_seq, test_labels)
    batch_size = 64
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
    
    print("\nLoading trained model...")
    input_dim = test_seq.shape[2]
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    model = OutbreakLSTMClassifier(
        input_dim=input_dim,
        hidden_dim=64,
        num_layers=2,
        dropout=0.3
    ).to(device)
    
    model.load_state_dict(torch.load('models/best_us_lstm_classifier.pth', map_location=device))
    print("Model loaded successfully!")
    
    print("\nEvaluating model on test set...")
    test_preds, test_probs, test_labels_np = evaluate_model(model, test_loader, device)
    
    auc = roc_auc_score(test_labels_np, test_probs)
    cm = confusion_matrix(test_labels_np, test_preds)
    report = classification_report(test_labels_np, test_preds, target_names=['No Outbreak', 'Outbreak'])
    
    print("\n" + "=" * 80)
    print("TEST SET RESULTS")
    print("=" * 80)
    print(f"\nTest AUC-ROC: {auc:.4f}")
    print("\nClassification Report:")
    print(report)
    print("\nConfusion Matrix:")
    print(cm)
    
    tn, fp, fn, tp = cm.ravel()
    specificity = tn / (tn + fp)
    sensitivity = tp / (tp + fn)
    ppv = tp / (tp + fp) if (tp + fp) > 0 else 0
    npv = tn / (tn + fn) if (tn + fn) > 0 else 0
    
    print(f"\nAdditional Metrics:")
    print(f"  Sensitivity (Recall): {sensitivity:.4f}")
    print(f"  Specificity: {specificity:.4f}")
    print(f"  PPV (Precision): {ppv:.4f}")
    print(f"  NPV: {npv:.4f}")
    print(f"  Accuracy: {(tp + tn) / (tp + tn + fp + fn):.4f}")
    
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=['No Outbreak', 'Outbreak'],
                yticklabels=['No Outbreak', 'Outbreak'])
    plt.title(f'Confusion Matrix - Test Set (AUC={auc:.4f})')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.savefig('figures/us_lstm_confusion_matrix.png', dpi=300, bbox_inches='tight')
    plt.close()
    
    fpr, tpr, thresholds = roc_curve(test_labels_np, test_probs)
    plt.figure(figsize=(8, 6))
    plt.plot(fpr, tpr, label=f'ROC Curve (AUC={auc:.4f})', linewidth=2)
    plt.plot([0, 1], [0, 1], 'k--', label='Random Classifier', linewidth=1)
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.title('ROC Curve - Test Set')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.savefig('figures/us_lstm_roc_curve.png', dpi=300, bbox_inches='tight')
    plt.close()
    
    plt.figure(figsize=(10, 6))
    plt.hist(test_probs[test_labels_np == 0], bins=50, alpha=0.5, label='No Outbreak', color='blue')
    plt.hist(test_probs[test_labels_np == 1], bins=50, alpha=0.5, label='Outbreak', color='red')
    plt.xlabel('Predicted Probability')
    plt.ylabel('Frequency')
    plt.title('Distribution of Predicted Probabilities')
    plt.legend()
    plt.savefig('figures/us_lstm_probability_dist.png', dpi=300, bbox_inches='tight')
    plt.close()
    
    # Analyze predictions by year
    results_df = pd.DataFrame({
        'Year': test_years,
        'True_Label': test_labels_np,
        'Predicted_Prob': test_probs,
        'Predicted_Label': test_preds,
        'County': test_counties
    })
    
    print("\n" + "=" * 80)
    print("Performance by Year:")
    print("=" * 80)
    for year in sorted(results_df['Year'].unique()):
        year_data = results_df[results_df['Year'] == year]
        year_auc = roc_auc_score(year_data['True_Label'], year_data['Predicted_Prob'])
        year_acc = (year_data['True_Label'] == year_data['Predicted_Label']).mean()
        outbreak_rate = year_data['True_Label'].mean()
        
        print(f"Year {year}: AUC={year_auc:.4f}, Accuracy={year_acc:.4f}, Outbreak Rate={outbreak_rate*100:.1f}%")
    
    print("\n" + "=" * 80)
    print("Evaluation complete!")
    print(f"Confusion matrix saved to: figures/us_lstm_confusion_matrix.png")
    print(f"ROC curve saved to: figures/us_lstm_roc_curve.png")
    print(f"Probability distribution saved to: figures/us_lstm_probability_dist.png")
    print("=" * 80)

if __name__ == '__main__':
    main()
