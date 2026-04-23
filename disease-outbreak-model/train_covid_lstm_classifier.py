import argparse
from pathlib import Path
import sys

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, Dataset

sys.path.append(str(Path(__file__).parent / "src"))
from models.Disease_Predictor import OutbreakLSTMClassifier


EXCLUDE_COLS = {
    "Year",
    "State",
    "FIPS",
    "County",
    "Disease",
    "Sex",
    "Outbreak",
    "NAME",
    "state",
    "county",
    "Region",
    "Source",
    "Season",
    "Week Ending Date",
    "WeekOfYear",
    "WeekIndex",
}


def create_sequences(data: pd.DataFrame, seq_length: int, group_col: str = "State", sort_col: str = "Week Ending Date"):
    sequences = []
    labels = []
    region_ids = []

    for region, group in data.groupby(group_col):
        group = group.sort_values(sort_col)
        if len(group) < seq_length:
            continue

        feature_cols = [
            col for col in group.columns
            if col not in EXCLUDE_COLS and pd.api.types.is_numeric_dtype(group[col])
        ]
        features = group[feature_cols].values
        outbreak_labels = group["Outbreak"].values

        for i in range(len(group) - seq_length + 1):
            sequences.append(features[i : i + seq_length])
            labels.append(outbreak_labels[i + seq_length - 1])
            region_ids.append(region)

    return np.array(sequences), np.array(labels), np.array(region_ids)


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
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=5
    )

    train_losses = []
    val_losses = []
    best_val_loss = float("inf")

    for epoch in range(num_epochs):
        model.train()
        train_loss = 0.0
        for sequences, labels in train_loader:
            sequences, labels = sequences.to(device), labels.to(device)

            optimizer.zero_grad()
            outputs = model(sequences).squeeze()
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            train_loss += loss.item()

        train_loss /= max(1, len(train_loader))
        train_losses.append(train_loss)

        model.eval()
        val_loss = 0.0
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

        val_loss /= max(1, len(val_loader))
        val_losses.append(val_loss)

        try:
            val_auc = roc_auc_score(all_labels, all_preds)
        except ValueError:
            val_auc = 0.0

        scheduler.step(val_loss)

        if (epoch + 1) % 5 == 0:
            print(
                f"Epoch [{epoch + 1}/{num_epochs}], Train Loss: {train_loss:.4f}, "
                f"Val Loss: {val_loss:.4f}, Val AUC: {val_auc:.4f}"
            )

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), "models/best_covid_lstm_classifier.pth")

    return train_losses, val_losses


def evaluate_model(model, data_loader, device):
    model.eval()
    all_preds = []
    all_probs = []
    all_labels = []

    with torch.no_grad():
        for sequences, labels in data_loader:
            sequences = sequences.to(device)
            outputs = model(sequences).squeeze()
            probs = torch.sigmoid(outputs).cpu().numpy()
            preds = (probs > 0.5).astype(int)

            all_preds.extend(preds)
            all_probs.extend(probs)
            all_labels.extend(labels.numpy())

    auc = roc_auc_score(all_labels, all_probs)
    cm = confusion_matrix(all_labels, all_preds)
    report = classification_report(all_labels, all_preds, target_names=["No Outbreak", "Outbreak"])
    return auc, cm, report


def main():
    parser = argparse.ArgumentParser(description="Train LSTM classifier for COVID-19 outbreak detection")
    parser.add_argument("--train-file", default="data/covid_weekly_train.csv")
    parser.add_argument("--seq-length", type=int, default=8,
                        help="Sequence length in weeks")
    parser.add_argument("--val-cutoff-date", default="2021-07-01",
                        help="ISO date string to split train/val (default: 2021-07-01)")
    parser.add_argument("--group-col", default="State",
                        help="Column to group sequences by")
    parser.add_argument("--sort-col", default="Week Ending Date",
                        help="Column to sort within each group")
    parser.add_argument("--num-epochs", type=int, default=50)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--hidden-dim", type=int, default=64)
    parser.add_argument("--num-layers", type=int, default=2)
    parser.add_argument("--dropout", type=float, default=0.3)
    args = parser.parse_args()

    print("Training LSTM on COVID-19 Dataset")

    train_df = pd.read_csv(args.train_file)
    train_df["Week Ending Date"] = pd.to_datetime(train_df["Week Ending Date"])

    group_col = args.group_col
    sort_col = args.sort_col

    print(f"Training records: {len(train_df):,}")
    print(f"{group_col} groups: {train_df[group_col].nunique():,}")
    print(f"Date range: {train_df['Week Ending Date'].min().date()} – {train_df['Week Ending Date'].max().date()}")
    print(f"Outbreak rate: {train_df['Outbreak'].mean() * 100:.1f}%")

    feature_cols = [
        col for col in train_df.columns
        if col not in EXCLUDE_COLS and pd.api.types.is_numeric_dtype(train_df[col])
    ]
    print(f"Using {len(feature_cols)} numeric features")

    scaler = StandardScaler()
    train_df[feature_cols] = scaler.fit_transform(train_df[feature_cols])

    cutoff = pd.to_datetime(args.val_cutoff_date)
    train_part = train_df[train_df["Week Ending Date"] < cutoff].copy()
    val_part = train_df[train_df["Week Ending Date"] >= cutoff].copy()

    train_seq, train_labels, train_regions = create_sequences(
        train_part, args.seq_length, group_col=group_col, sort_col=sort_col
    )
    val_seq, val_labels, val_regions = create_sequences(
        val_part, args.seq_length, group_col=group_col, sort_col=sort_col
    )

    print(f"Train sequences: {len(train_seq):,} | {group_col}s: {len(np.unique(train_regions))}")
    print(f"Val sequences: {len(val_seq):,} | {group_col}s: {len(np.unique(val_regions))}")

    train_dataset = OutbreakDataset(train_seq, train_labels)
    val_dataset = OutbreakDataset(val_seq, val_labels)
    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False)

    input_dim = train_seq.shape[2]
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = OutbreakLSTMClassifier(
        input_dim=input_dim,
        hidden_dim=args.hidden_dim,
        num_layers=args.num_layers,
        dropout=args.dropout,
    ).to(device)

    pos_count = (train_labels == 1).sum()
    neg_count = (train_labels == 0).sum()
    pos_weight = neg_count / max(1, pos_count)

    print(f"\nModel Configuration:")
    print(f"  Input dim: {input_dim}")
    print(f"  Hidden dim: {args.hidden_dim}")
    print(f"  Num layers: {args.num_layers}")
    print(f"  Dropout: {args.dropout}")
    print(f"  Device: {device}")
    print(f"  Class weight (pos): {pos_weight:.2f}")

    train_losses, val_losses = train_model(
        model,
        train_loader,
        val_loader,
        num_epochs=args.num_epochs,
        learning_rate=args.learning_rate,
        device=device,
        pos_weight=pos_weight,
    )

    Path("figures").mkdir(exist_ok=True)
    plt.figure(figsize=(10, 5))
    plt.plot(train_losses, label="Train Loss")
    plt.plot(val_losses, label="Validation Loss")
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.title("COVID-19 LSTM Training and Validation Loss")
    plt.legend()
    plt.savefig("figures/covid_lstm_training_curves.png", dpi=300, bbox_inches="tight")
    plt.close()

    model.load_state_dict(torch.load("models/best_covid_lstm_classifier.pth", map_location=device))
    val_auc, val_cm, val_report = evaluate_model(model, val_loader, device)

    print("\nValidation AUC:", f"{val_auc:.4f}")
    print("\nClassification Report:")
    print(val_report)
    print("\nConfusion Matrix:")
    print(val_cm)


if __name__ == "__main__":
    Path("models").mkdir(exist_ok=True)
    main()
