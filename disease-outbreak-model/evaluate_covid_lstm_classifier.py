import argparse
from pathlib import Path
import sys

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import torch
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    roc_curve,
)
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


def create_sequences(
    data: pd.DataFrame,
    seq_length: int,
    group_col: str = "State",
    sort_col: str = "Week Ending Date",
):
    sequences = []
    labels = []
    group_ids = []
    sort_vals = []

    for gid, group in data.groupby(group_col):
        group = group.sort_values(sort_col)
        if len(group) < seq_length:
            continue

        feature_cols = [
            col for col in group.columns
            if col not in EXCLUDE_COLS and pd.api.types.is_numeric_dtype(group[col])
        ]
        features = group[feature_cols].values
        outbreak_labels = group["Outbreak"].values
        sv = group[sort_col].values if sort_col in group.columns else np.zeros(len(group))

        for i in range(len(group) - seq_length + 1):
            sequences.append(features[i : i + seq_length])
            labels.append(outbreak_labels[i + seq_length - 1])
            group_ids.append(gid)
            sort_vals.append(sv[i + seq_length - 1])

    return np.array(sequences), np.array(labels), np.array(group_ids), np.array(sort_vals)


class OutbreakDataset(Dataset):
    def __init__(self, sequences, labels):
        self.sequences = torch.FloatTensor(sequences)
        self.labels = torch.FloatTensor(labels)

    def __len__(self):
        return len(self.sequences)

    def __getitem__(self, idx):
        return self.sequences[idx], self.labels[idx]


def evaluate_model(model, test_loader, device, threshold: float = 0.5):
    model.eval()
    all_preds = []
    all_probs = []
    all_labels = []

    with torch.no_grad():
        for sequences, labels in test_loader:
            sequences = sequences.to(device)
            outputs = model(sequences).squeeze()
            probs = torch.sigmoid(outputs).cpu().numpy()
            preds = (probs >= threshold).astype(int)

            all_preds.extend(preds)
            all_probs.extend(probs)
            all_labels.extend(labels.numpy())

    return np.array(all_preds), np.array(all_probs), np.array(all_labels)


def main():
    parser = argparse.ArgumentParser(description="Evaluate COVID-19 LSTM classifier")
    parser.add_argument("--train-file", default="data/covid_weekly_train.csv")
    parser.add_argument("--test-file", default="data/covid_weekly_test.csv")
    parser.add_argument("--model-path", default="models/best_covid_lstm_classifier.pth")
    parser.add_argument("--seq-length", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--hidden-dim", type=int, default=64)
    parser.add_argument("--num-layers", type=int, default=2)
    parser.add_argument("--dropout", type=float, default=0.3)
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.5,
        help="Decision threshold for classifying outbreak probability (default: 0.5)",
    )
    parser.add_argument(
        "--group-col",
        default="State",
        help="Column to group sequences by (default: State)",
    )
    parser.add_argument(
        "--sort-col",
        default="Week Ending Date",
        help="Column to sort within each group (default: Week Ending Date)",
    )
    args = parser.parse_args()

    print("\nEvaluating COVID-19 LSTM ")

    train_df = pd.read_csv(args.train_file)
    test_df = pd.read_csv(args.test_file)

    train_df["Week Ending Date"] = pd.to_datetime(train_df["Week Ending Date"])
    test_df["Week Ending Date"] = pd.to_datetime(test_df["Week Ending Date"])

    group_col = args.group_col
    sort_col = args.sort_col

    feature_cols = [
        col for col in train_df.columns
        if col not in EXCLUDE_COLS and pd.api.types.is_numeric_dtype(train_df[col])
    ]
    print(f"Feature columns: {len(feature_cols)}")
    print(f"Test records: {len(test_df):,}")
    print(f"Test outbreak rate: {test_df['Outbreak'].mean()*100:.1f}%")

    scaler = StandardScaler()
    scaler.fit(train_df[feature_cols])
    test_df[feature_cols] = scaler.transform(test_df[feature_cols])

    test_seq, test_labels, test_groups, test_sort_vals = create_sequences(
        test_df, args.seq_length, group_col=group_col, sort_col=sort_col
    )
    print(f"Test sequences: {len(test_seq):,} | {group_col}s: {len(np.unique(test_groups))}")

    test_dataset = OutbreakDataset(test_seq, test_labels)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False)

    input_dim = test_seq.shape[2]
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = OutbreakLSTMClassifier(
        input_dim=input_dim,
        hidden_dim=args.hidden_dim,
        num_layers=args.num_layers,
        dropout=args.dropout,
    ).to(device)
    model.load_state_dict(torch.load(args.model_path, map_location=device))
    print(f"Loaded model from {args.model_path}")

    test_preds, test_probs, test_labels_np = evaluate_model(
        model, test_loader, device, threshold=args.threshold
    )

    auc = roc_auc_score(test_labels_np, test_probs)
    cm = confusion_matrix(test_labels_np, test_preds)
    report = classification_report(
        test_labels_np, test_preds, target_names=["No Outbreak", "Outbreak"]
    )

    print(f"\nAUC-ROC: {auc:.4f}")
    print(f"Decision threshold: {args.threshold:.2f}")
    print("\nClassification Report:")
    print(report)
    print("\nConfusion Matrix:")
    print(cm)

    tn, fp, fn, tp = cm.ravel()
    print("\nAdditional Metrics:")
    print(f"  Sensitivity (recall): {tp / max(1, tp + fn):.4f}")
    print(f"  Specificity:          {tn / max(1, tn + fp):.4f}")
    print(f"  Accuracy:             {(tp + tn) / max(1, tp + tn + fp + fn):.4f}")

    Path("figures").mkdir(exist_ok=True)

    plt.figure(figsize=(8, 6))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=["No Outbreak", "Outbreak"],
        yticklabels=["No Outbreak", "Outbreak"],
    )
    plt.title(f"COVID-19 Confusion Matrix (AUC={auc:.4f}, Thr={args.threshold:.2f})")
    plt.ylabel("True Label")
    plt.xlabel("Predicted Label")
    plt.savefig("figures/covid_lstm_confusion_matrix.png", dpi=300, bbox_inches="tight")
    plt.close()

    fpr, tpr, _ = roc_curve(test_labels_np, test_probs)
    plt.figure(figsize=(8, 6))
    plt.plot(fpr, tpr, label=f"ROC Curve (AUC={auc:.4f})", linewidth=2)
    plt.plot([0, 1], [0, 1], "k--", linewidth=1)
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title("COVID-19 LSTM ROC Curve — Weekly State Data")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.savefig("figures/covid_lstm_roc_curve.png", dpi=300, bbox_inches="tight")
    plt.close()

    result_df = pd.DataFrame(
        {
            sort_col: test_sort_vals,
            group_col: test_groups,
            "True_Label": test_labels_np,
            "Predicted_Prob": test_probs,
            "Predicted_Label": test_preds,
        }
    )

    if pd.api.types.is_datetime64_any_dtype(pd.Series(test_sort_vals)):
        result_df["_year"] = pd.to_datetime(result_df[sort_col]).dt.year
    else:
        try:
            result_df["_year"] = pd.to_datetime(result_df[sort_col]).dt.year
        except Exception:
            result_df["_year"] = result_df[sort_col]

    print("\nPerformance by Year:")
    for year in sorted(result_df["_year"].unique()):
        year_data = result_df[result_df["_year"] == year]
        if year_data["True_Label"].nunique() < 2:
            print(f"  {year}: only one class present (skipped AUC), n={len(year_data)}")
            continue
        year_auc = roc_auc_score(year_data["True_Label"], year_data["Predicted_Prob"])
        year_acc = (year_data["True_Label"] == year_data["Predicted_Label"]).mean()
        print(f"  {year}: AUC={year_auc:.4f}, Accuracy={year_acc:.4f}, n={len(year_data)}")


if __name__ == "__main__":
    main()
