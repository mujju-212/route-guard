"""
RouteGuard ML - Model 4: LSTM Risk Trajectory Forecaster (PyTorch)
==================================================================
Task:   Time-series forecasting -- given last 12 risk scores (6 hours
        history at 30-min intervals), predict the next 6 risk scores
        (next 3 hours ahead).
Input:  Sequence of 12 risk scores  shape: (batch, 12, 1)
Output: Sequence of 6 future scores shape: (batch, 6)
Split:  70% train / 15% val / 15% test

Framework: PyTorch (TensorFlow not available on this machine)

Data strategy:
  We generate 80,000 synthetic risk trajectories using the
  Ornstein-Uhlenbeck (OU) mean-reverting process across 6 scenario types:
  calm, moderate, storm, port_crisis, recovery, worsening.
  OU is physically motivated: risk reverts after events (storms pass,
  ports clear), which matches real maritime dynamics.
"""

import os, json, warnings
import numpy as np
import pandas as pd
import joblib
warnings.filterwarnings("ignore")

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from torch.optim import Adam
from torch.optim.lr_scheduler import ReduceLROnPlateau

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "lstm_trajectory.pt")
META_PATH  = os.path.join(MODELS_DIR, "lstm_trajectory_meta.json")
os.makedirs(MODELS_DIR, exist_ok=True)

SEED = 42
np.random.seed(SEED)
torch.manual_seed(SEED)

DEVICE  = torch.device("cuda" if torch.cuda.is_available() else "cpu")
SEQ_IN  = 12   # 12 past risk scores  (6 hours @ 30-min)
SEQ_OUT = 6    # 6 future risk scores (3 hours ahead)
N_SEQ   = 80_000

print("=" * 65)
print("  RouteGuard - Model 4: LSTM Risk Trajectory (PyTorch)")
print("=" * 65)
print(f"  Device: {DEVICE}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 -- Generate Synthetic Trajectories via Ornstein-Uhlenbeck Process
# ══════════════════════════════════════════════════════════════════════════════
print(f"\n[1/6] Generating {N_SEQ:,} synthetic risk sequences ...")

def ou_trajectory(n_steps, mu, theta, sigma, x0):
    """
    Ornstein-Uhlenbeck: dx = theta*(mu - x)*dt + sigma*sqrt(dt)*dW
    Mean-reverting stochastic process.
      mu    = long-run mean risk level (where risk settles)
      theta = reversion speed (how fast risk returns to mu)
      sigma = volatility (how jumpy risk is)
      x0    = starting risk score
    """
    x = np.zeros(n_steps)
    x[0] = np.clip(x0, 0, 100)
    dt = 0.5
    for t in range(1, n_steps):
        dx = theta * (mu - x[t-1]) * dt + sigma * np.sqrt(dt) * np.random.randn()
        x[t] = np.clip(x[t-1] + dx, 0, 100)
    return x

SCENARIOS = {
    # name:        (mu,  theta, sigma, weight)
    "calm":        (18,  0.30,  4.0,  0.30),   # normal voyage, low risk
    "moderate":    (38,  0.25,  7.0,  0.25),   # some weather/port stress
    "storm":       (72,  0.15, 12.0,  0.20),   # severe weather, high volatility
    "port_crisis": (65,  0.20,  8.0,  0.12),   # port congestion sustained high
    "recovery":    (30,  0.40,  6.0,  0.08),   # post-storm returning to normal
    "worsening":   (75,  0.10, 10.0,  0.05),   # escalating risk situation
}

sc_names   = list(SCENARIOS.keys())
sc_weights = np.array([SCENARIOS[s][3] for s in sc_names])
sc_weights /= sc_weights.sum()

total_steps = SEQ_IN + SEQ_OUT
seqs = []

for _ in range(N_SEQ):
    sc = np.random.choice(sc_names, p=sc_weights)
    mu, theta, sigma, _ = SCENARIOS[sc]
    if sc == "recovery":
        x0 = np.random.uniform(60, 90)
    elif sc == "worsening":
        x0 = np.random.uniform(20, 45)
    else:
        x0 = np.clip(np.random.normal(mu, sigma * 2), 0, 100)
    seqs.append(ou_trajectory(total_steps, mu, theta, sigma, x0))

seqs = np.array(seqs, dtype=np.float32)  # (80000, 18)

X_raw = seqs[:, :SEQ_IN]  / 100.0   # normalise [0,1]
y_raw = seqs[:, SEQ_IN:]  / 100.0

print(f"    Sequences shape: X={X_raw.shape}  y={y_raw.shape}")
print(f"    Risk range: {seqs.min():.1f} - {seqs.max():.1f}")
print(f"    Scenario weights:")
for sc, w in zip(sc_names, sc_weights):
    print(f"      {sc:15s} {w*100:.0f}%  (~{int(N_SEQ*w):,} seqs)")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 -- 70 / 15 / 15 Split
# ══════════════════════════════════════════════════════════════════════════════
print("\n[2/6] Splitting (70% train / 15% val / 15% test) ...")

idx = np.random.permutation(N_SEQ)
X_raw, y_raw = X_raw[idx], y_raw[idx]

n_train = int(0.70 * N_SEQ)
n_val   = int(0.15 * N_SEQ)

X_train, y_train = X_raw[:n_train],         y_raw[:n_train]
X_val,   y_val   = X_raw[n_train:n_train+n_val], y_raw[n_train:n_train+n_val]
X_test,  y_test  = X_raw[n_train+n_val:],   y_raw[n_train+n_val:]

print(f"    Train : {len(X_train):,}  (70%)")
print(f"    Val   : {len(X_val):,}  (15%)")
print(f"    Test  : {len(X_test):,}  (15%)")

# Convert to PyTorch tensors -- add feature dim: (N, 12) -> (N, 12, 1)
def to_tensor(arr):
    return torch.tensor(arr, dtype=torch.float32).unsqueeze(-1).to(DEVICE)

def to_tensor_y(arr):
    return torch.tensor(arr, dtype=torch.float32).to(DEVICE)

train_ds = TensorDataset(to_tensor(X_train), to_tensor_y(y_train))
val_ds   = TensorDataset(to_tensor(X_val),   to_tensor_y(y_val))
test_ds  = TensorDataset(to_tensor(X_test),  to_tensor_y(y_test))

BATCH = 512
train_loader = DataLoader(train_ds, batch_size=BATCH, shuffle=True)
val_loader   = DataLoader(val_ds,   batch_size=BATCH, shuffle=False)
test_loader  = DataLoader(test_ds,  batch_size=BATCH, shuffle=False)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 -- LSTM Architecture
# ══════════════════════════════════════════════════════════════════════════════
print("\n[3/6] Building LSTM model ...")

class RiskLSTM(nn.Module):
    """
    Two-layer stacked LSTM for risk trajectory forecasting.

    Architecture:
      Input  -> LSTM(64) -> Dropout(0.2) -> LSTM(32) -> Dropout(0.2) -> Dense(6)

    LSTM Layer 1 (64 units): captures short-term risk patterns (30-min fluctuations)
    LSTM Layer 2 (32 units): compresses sequence into a fixed-size context vector
    Dense output (6 units):  predicts 6 future risk scores simultaneously
    """
    def __init__(self, input_size=1, hidden1=64, hidden2=32, output_size=SEQ_OUT, dropout=0.20):
        super().__init__()
        self.lstm1   = nn.LSTM(input_size, hidden1, batch_first=True)
        self.drop1   = nn.Dropout(dropout)
        self.lstm2   = nn.LSTM(hidden1, hidden2, batch_first=True)
        self.drop2   = nn.Dropout(dropout)
        self.fc      = nn.Linear(hidden2, output_size)

    def forward(self, x):
        # x: (batch, seq_in, 1)
        out, _ = self.lstm1(x)           # (batch, seq_in, 64)
        out     = self.drop1(out)
        out, _  = self.lstm2(out)         # (batch, seq_in, 32)
        out     = self.drop2(out)
        out     = out[:, -1, :]           # take last timestep: (batch, 32)
        out     = self.fc(out)            # (batch, 6)
        return out

model = RiskLSTM().to(DEVICE)
total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"    Architecture: Input(12,1) -> LSTM(64) -> Dropout(0.2) -> LSTM(32) -> Dropout(0.2) -> Dense(6)")
print(f"    Total trainable parameters: {total_params:,}")

optimizer = Adam(model.parameters(), lr=0.001)
scheduler = ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=5, min_lr=1e-5)
criterion = nn.MSELoss()

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 -- Training Loop
# ══════════════════════════════════════════════════════════════════════════════
print("\n[4/6] Training LSTM (max 80 epochs, early stop patience=12) ...")

best_val_loss = float("inf")
patience_counter = 0
PATIENCE = 12
best_state = None
history = {"train_loss": [], "val_loss": []}

for epoch in range(1, 81):
    # -- Train --
    model.train()
    train_loss = 0.0
    for xb, yb in train_loader:
        optimizer.zero_grad()
        pred = model(xb)
        loss = criterion(pred, yb)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)  # gradient clipping
        optimizer.step()
        train_loss += loss.item() * len(xb)
    train_loss /= len(train_ds)

    # -- Validate --
    model.eval()
    val_loss = 0.0
    with torch.no_grad():
        for xb, yb in val_loader:
            pred = model(xb)
            val_loss += criterion(pred, yb).item() * len(xb)
    val_loss /= len(val_ds)

    history["train_loss"].append(train_loss)
    history["val_loss"].append(val_loss)
    scheduler.step(val_loss)

    if epoch % 10 == 0 or epoch == 1:
        lr_now = optimizer.param_groups[0]["lr"]
        print(f"    Epoch {epoch:3d}/80  train_loss={train_loss:.6f}  val_loss={val_loss:.6f}  lr={lr_now:.6f}")

    # -- Early stopping --
    if val_loss < best_val_loss - 1e-6:
        best_val_loss = val_loss
        patience_counter = 0
        best_state = {k: v.clone() for k, v in model.state_dict().items()}
    else:
        patience_counter += 1
        if patience_counter >= PATIENCE:
            print(f"\n    Early stopping at epoch {epoch} (no improvement for {PATIENCE} epochs)")
            break

best_epoch = np.argmin(history["val_loss"]) + 1
model.load_state_dict(best_state)
print(f"    Best epoch: {best_epoch}  (val_loss={best_val_loss:.6f})")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 -- Evaluate on Test Set
# ══════════════════════════════════════════════════════════════════════════════
print("\n[5/6] Evaluating on held-out TEST set ...")

model.eval()
all_preds, all_trues = [], []
with torch.no_grad():
    for xb, yb in test_loader:
        pred = model(xb)
        all_preds.append(pred.cpu().numpy())
        all_trues.append(yb.cpu().numpy())

y_pred_norm = np.concatenate(all_preds)
y_true_norm = np.concatenate(all_trues)

# Denormalise to 0-100 scale
y_pred = y_pred_norm * 100.0
y_true = y_true_norm * 100.0

rmse_overall    = float(np.sqrt(np.mean((y_pred - y_true) ** 2)))
mae_overall     = float(np.mean(np.abs(y_pred - y_true)))
rmse_per_step   = np.sqrt(np.mean((y_pred - y_true) ** 2, axis=0))
mae_per_step    = np.mean(np.abs(y_pred - y_true), axis=0)

# Directional accuracy: does prediction match the trend direction?
X_test_cpu      = X_test * 100.0
last_known      = X_test_cpu[:, -1]
actual_dir      = (y_true[:, 0] - last_known) > 0
pred_dir        = (y_pred[:, 0] - last_known) > 0
dir_acc         = float(np.mean(actual_dir == pred_dir))

print(f"\n  +-----------------------------------------------+")
print(f"  |  LSTM Trajectory - Test Set Metrics          |")
print(f"  +-----------------------------------------------+")
print(f"  |  Overall RMSE (risk pts)  : {rmse_overall:8.3f}         |")
print(f"  |  Overall MAE  (risk pts)  : {mae_overall:8.3f}         |")
print(f"  |  Directional Accuracy     : {dir_acc*100:7.2f}%         |")
print(f"  +-----------------------------------------------+")
print(f"\n  Per-step metrics (each step = 30 min):")
for i, (r, m) in enumerate(zip(rmse_per_step, mae_per_step)):
    print(f"    Step {i+1} (+{(i+1)*30:3d} min): RMSE={r:.3f}  MAE={m:.3f}")

print(f"\n  Sample predictions:")
for i in range(3):
    inp  = (X_test[i] * 100).round(1).tolist()
    pred = y_pred[i].round(1).tolist()
    true = y_true[i].round(1).tolist()
    print(f"    [{i+1}] Input (last 12): {inp}")
    print(f"         Predicted next 6: {pred}")
    print(f"         Actual next 6:    {true}")

# ── Save ───────────────────────────────────────────────────────────────────
print("\n[6/6] Saving model ...")
torch.save({
    "model_state_dict": model.state_dict(),
    "model_config": {"input_size": 1, "hidden1": 64, "hidden2": 32,
                     "output_size": SEQ_OUT, "dropout": 0.20},
    "seq_in": SEQ_IN,
    "seq_out": SEQ_OUT,
    "normalization": "divide_by_100",
}, MODEL_PATH)
print(f"    Model -> {MODEL_PATH}")

meta = {
    "model_type": "LSTM (Long Short-Term Memory) - PyTorch",
    "task": "risk_trajectory_forecasting",
    "version": "1.0.0",
    "framework": "PyTorch",
    "trained_at": pd.Timestamp.now().isoformat(),
    "split": "70/15/15 train/val/test",
    "training_sequences": int(len(X_train)),
    "val_sequences": int(len(X_val)),
    "test_sequences": int(len(X_test)),
    "input_shape": [SEQ_IN, 1],
    "output_shape": [SEQ_OUT],
    "input_description": f"Last {SEQ_IN} risk scores ({SEQ_IN*30} min = {SEQ_IN//2}h history)",
    "output_description": f"Next {SEQ_OUT} risk scores ({SEQ_OUT*30} min = {SEQ_OUT//2}h ahead)",
    "normalization": "Divide inputs by 100.0 before passing to model; multiply output by 100.0",
    "architecture": {
        "LSTM_1": "64 units, batch_first=True",
        "Dropout_1": "0.20",
        "LSTM_2": "32 units, batch_first=True",
        "Dropout_2": "0.20",
        "Dense_output": f"{SEQ_OUT} units, linear",
        "total_trainable_params": total_params,
    },
    "training": {
        "optimizer": "Adam(lr=0.001)",
        "loss": "MSELoss",
        "epochs_run": len(history["train_loss"]),
        "best_epoch": int(best_epoch),
        "batch_size": BATCH,
        "gradient_clipping": "max_norm=1.0",
        "early_stopping_patience": PATIENCE,
        "lr_scheduler": "ReduceLROnPlateau(factor=0.5, patience=5, min_lr=1e-5)",
    },
    "data_generation": {
        "method": "Ornstein-Uhlenbeck (OU) synthetic trajectory generation",
        "total_sequences": N_SEQ,
        "why_synthetic": (
            "AIS data does not have clean 30-minute temporal sequences per vessel. "
            "OU is physically motivated: risk mean-reverts after events -- "
            "storms pass, ports clear. This matches real maritime risk dynamics."
        ),
        "scenarios": {
            sc: {"mu": SCENARIOS[sc][0], "theta": SCENARIOS[sc][1],
                 "sigma": SCENARIOS[sc][2], "weight_pct": round(w * 100, 1)}
            for sc, w in zip(sc_names, sc_weights)
        },
    },
    "metrics": {
        "test_rmse_risk_pts": round(rmse_overall, 4),
        "test_mae_risk_pts": round(mae_overall, 4),
        "directional_accuracy_pct": round(dir_acc * 100, 2),
        "rmse_per_step": [round(float(r), 4) for r in rmse_per_step],
        "mae_per_step":  [round(float(m), 4) for m in mae_per_step],
    },
    "inference_note": (
        "1. Load: ckpt=torch.load(MODEL_PATH); model=RiskLSTM(**ckpt['model_config']); "
        "model.load_state_dict(ckpt['model_state_dict']); model.eval(). "
        "2. Input: x = torch.tensor(last_12_scores/100, dtype=float32).unsqueeze(0).unsqueeze(-1). "
        "3. Output: model(x)[0].detach().numpy() * 100 gives 6 future risk scores."
    ),
}
with open(META_PATH, "w") as f:
    json.dump(meta, f, indent=2)
print(f"    Meta -> {META_PATH}")

print("\n" + "=" * 65)
print("  [DONE] Model 4 (LSTM Risk Trajectory) complete!")
print(f"  RMSE={rmse_overall:.3f} pts  MAE={mae_overall:.3f} pts  DirAcc={dir_acc*100:.1f}%")
print("=" * 65)
print("\n  All 4 models trained!\n")
