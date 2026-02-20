import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent / 'src'))
from models.Disease_Predictor import OutbreakLSTMClassifier

def create_sequences(data, seq_length):
    sequences = []
    labels = []
    county_ids = []
    
    for fips, group in data.groupby('FIPS'):
        group = group.sort_values('Year')
        
        if len(group) < seq_length:
            continue
        
        feature_cols = [col for col in group.columns if col not in 
                       ['Year', 'State', 'FIPS', 'County', 'Disease', 'Sex', 
                        'Outbreak', 'NAME', 'state', 'county']]
        
        features = group[feature_cols].values
        outbreak_labels = group['Outbreak'].values
        
        for i in range(len(group) - seq_length + 1):
            seq = features[i:i + seq_length]
            label = outbreak_labels[i + seq_length - 1]
            
            sequences.append(seq)
            labels.append(label)
            county_ids.append(fips)
    
    return np.array(sequences), np.array(labels), np.array(county_ids)

class OutbreakDataset(Dataset):
    def __init__(self, sequences, labels):
        self.sequences = torch.FloatTensor(sequences)
        self.labels = torch.FloatTensor(labels)
    
    def __len__(self):
        return len(self.sequences)
    
    def __getitem__(self, idx):
        return self.sequences[idx], self.labels[idx]

def train_model(model, train_loader, val_loader, num_epochs, learning_rate, device, pos_weight):
    criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([pos_weight]).to(device))
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=5)
    
    train_losses = []
    val_losses = []
    best_val_loss = float('inf')
    
    for epoch in range(num_epochs):
        model.train()
        train_loss = 0
        for sequences, labels in train_loader:
            sequences, labels = sequences.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(sequences).squeeze()
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
        
        train_loss /= len(train_loader)
        train_losses.append(train_loss)
        
        model.eval()
        val_loss = 0
        all_preds = []
        all_labels = []
        
        with torch.no_grad():
            for sequences, labels in val_loader:
                sequences, labels = sequences.to(device), labels.to(device)
                
                outputs = model(sequences).squeeze()
                loss = criterion(outputs, labels)
                val_loss += loss.item()
                
                probs = torch.sigmoid(outputs).cpu().numpy()
                all_preds.extend(probs)
                all_labels.extend(labels.cpu().numpy())
        
        val_loss /= len(val_loader)
        val_losses.append(val_loss)
        
        try:
            val_auc = roc_auc_score(all_labels, all_preds)
        except:
            val_auc = 0.0
        
        scheduler.step(val_loss)
        
        if (epoch + 1) % 5 == 0:
            print(f'Epoch [{epoch+1}/{num_epochs}], Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}, Val AUC: {val_auc:.4f}')
        
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), 'models/best_us_lstm_classifier.pth')
    
    return train_losses, val_losses

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
    
    auc = roc_auc_score(all_labels, all_probs)
    cm = confusion_matrix(all_labels, all_preds)
    report = classification_report(all_labels, all_preds, target_names=['No Outbreak', 'Outbreak'])
    
    return auc, cm, report, all_probs, all_labels

def main():
    print("=" * 80)
    print("Training LSTM Classifier on Full US Chlamydia Dataset")
    print("=" * 80)
    
    print("\nLoading training data...")
    train_df = pd.read_csv('data/atlasplus_all_us_train.csv')
    print(f"Training records: {len(train_df):,}")
    print(f"Counties: {train_df['FIPS'].nunique()}")
    print(f"Year range: {train_df['Year'].min()}-{train_df['Year'].max()}")
    print(f"Outbreak rate: {train_df['Outbreak'].mean()*100:.1f}%")
    
    print("\nNormalizing features...")
    feature_cols = [col for col in train_df.columns if col not in 
                   ['Year', 'State', 'FIPS', 'County', 'Disease', 'Sex', 'Outbreak']]
    
    scaler = StandardScaler()
    train_df[feature_cols] = scaler.fit_transform(train_df[feature_cols])
    
    train_years = train_df[train_df['Year'] <= 2016].copy()
    val_years = train_df[train_df['Year'] > 2016].copy()
    
    print(f"\nTrain split: {len(train_years):,} records ({train_years['Year'].min()}-{train_years['Year'].max()})")
    print(f"  Outbreak rate: {train_years['Outbreak'].mean()*100:.1f}%")
    print(f"Val split: {len(val_years):,} records ({val_years['Year'].min()}-{val_years['Year'].max()})")
    print(f"  Outbreak rate: {val_years['Outbreak'].mean()*100:.1f}%")
    
    seq_length = 3
    print(f"\nCreating sequences (sequence length = {seq_length})...")
    
    train_seq, train_labels, train_counties = create_sequences(train_years, seq_length)
    val_seq, val_labels, val_counties = create_sequences(val_years, seq_length)
    
    print(f"Training sequences: {len(train_seq):,}")
    print(f"  Unique counties: {len(np.unique(train_counties))}")
    print(f"  Outbreak sequences: {train_labels.sum():.0f} ({train_labels.mean()*100:.1f}%)")
    print(f"Validation sequences: {len(val_seq):,}")
    print(f"  Unique counties: {len(np.unique(val_counties))}")
    print(f"  Outbreak sequences: {val_labels.sum():.0f} ({val_labels.mean()*100:.1f}%)")
    
    train_dataset = OutbreakDataset(train_seq, train_labels)
    val_dataset = OutbreakDataset(val_seq, val_labels)
    
    batch_size = 64
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    input_dim = train_seq.shape[2]
    hidden_dim = 64
    num_layers = 2
    dropout = 0.3
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"\nUsing device: {device}")
    
    model = OutbreakLSTMClassifier(
        input_dim=input_dim,
        hidden_dim=hidden_dim,
        num_layers=num_layers,
        dropout=dropout
    ).to(device)
    
    print(f"\nModel architecture:")
    print(f"  Input dim: {input_dim}")
    print(f"  Hidden dim: {hidden_dim}")
    print(f"  Num layers: {num_layers}")
    print(f"  Dropout: {dropout}")
    print(f"  Total parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    pos_weight = (train_labels == 0).sum() / (train_labels == 1).sum()
    print(f"\nClass weight (pos_weight): {pos_weight:.2f}")
    
    print("\nTraining model...")
    num_epochs = 50
    learning_rate = 0.001
    
    train_losses, val_losses = train_model(
        model, train_loader, val_loader, 
        num_epochs, learning_rate, device, pos_weight
    )
    
    plt.figure(figsize=(10, 5))
    plt.plot(train_losses, label='Train Loss')
    plt.plot(val_losses, label='Validation Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.title('Training and Validation Loss')
    plt.legend()
    plt.savefig('figures/us_lstm_training_curves.png', dpi=300, bbox_inches='tight')
    plt.close()
    
    print("\n" + "=" * 80)
    print("Training complete!")
    print("=" * 80)
    
    print("\nFinal validation set evaluation:")
    model.load_state_dict(torch.load('models/best_us_lstm_classifier.pth'))
    val_auc, val_cm, val_report, _, _ = evaluate_model(model, val_loader, device)
    
    print(f"\nValidation AUC: {val_auc:.4f}")
    print("\nClassification Report:")
    print(val_report)
    print("\nConfusion Matrix:")
    print(val_cm)

if __name__ == '__main__':
    Path('models').mkdir(exist_ok=True)
    Path('figures').mkdir(exist_ok=True)
    
    main()
