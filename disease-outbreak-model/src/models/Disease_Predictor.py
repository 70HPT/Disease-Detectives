import torch
import torch.nn as nn

class DiseasePredictor(nn.Module):
    def __init__(self, input_dim, hidden_dim=64, num_layers=2, dropout=0.2):
        super().__init__()
        
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        
        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0
        )
        
        # Fully connected output layer
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1)
        )
    
    def forward(self, x):
        # x shape: (batch_size, seq_length, input_dim)
        lstm_out, (hidden, cell) = self.lstm(x)
        
        # Use the output from the last time step
        last_output = lstm_out[:, -1, :]  # (batch_size, hidden_dim)
        
        # Pass through fully connected layers
        output = self.fc(last_output)
        return output


class OutbreakLSTMClassifier(nn.Module):
    
    def __init__(self, input_dim, hidden_dim=64, num_layers=2, dropout=0.3):
        super().__init__()
        
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        
        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0
        )
        
        # Fully connected output layer for binary classification
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1)  # Sigmoid will be applied in BCEWithLogitsLoss
        )
    
    def forward(self, x):
        # x shape: (batch_size, seq_length, input_dim)
        lstm_out, (hidden, cell) = self.lstm(x)
        
        # Use the output from the last time step
        last_output = lstm_out[:, -1, :]  # (batch_size, hidden_dim)
        
        # Pass through fully connected layers
        output = self.fc(last_output)
        return output