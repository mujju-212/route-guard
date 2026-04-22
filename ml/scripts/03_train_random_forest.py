"""
RouteGuard ML - Step 3: Train Random Forest Delay Prediction Model (Model 2)
=============================================================================
Model: Random Forest Regressor
Task:  Predict expected delay in HOURS for a shipment given its current
       environmental and operational features.

Input features (same core 9 + extended):
  weather_score, traffic_score, port_score, historical_score,
  cargo_sensitivity, distance_remaining_km, time_of_day,
  day_of_week, season, speed_ratio, heading_cog_diff, draft_ratio,
  ETA_hours, SOG_kmh, risk_score (from Model 1 output, available at runtime)

Output:
  delay_hours (float >= 0)

Saved artifacts:
  models/random_forest_delay.pkl        ← trained model
  models/random_forest_delay_meta.json  ← feature names, metrics
"""

import os
import json
import warnings
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble       import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics         import mean_squared_error, mean_absolute_error, r2_score
warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH   = os.path.join(BASE_DIR, "data", "training_dataset.csv")
MODELS_DIR  = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

MODEL_PATH  = os.path.join(MODELS_DIR, "random_forest_delay.pkl")
META_PATH   = os.path.join(MODELS_DIR, "random_forest_delay_meta.json")

print("=" * 65)
print("  RouteGuard - Model 2: Random Forest Delay Prediction")
print("=" * 65)

# ══════════════════════════════════════════════════════════════════════════════
# Load data
# ══════════════════════════════════════════════════════════════════════════════
print("\n[1/5] Loading training dataset ...")
df = pd.read_csv(DATA_PATH)
print(f"    Rows loaded: {len(df):,}")

# ── Feature set ───────────────────────────────────────────────────────────────
# Core features (same as XGBoost — available in production)
CORE_FEATURES = [
    "weather_score",
    "traffic_score",
    "port_score",
    "historical_score",
    "cargo_sensitivity",
    "distance_remaining_km",
    "time_of_day",
    "day_of_week",
    "season",
]

# Extended features for richer training
EXTENDED_FEATURES = [
    "speed_ratio",          # key: is vessel already slower than expected?
    "heading_cog_diff",     # environmental resistance
    "draft_ratio",          # heavy load → slower
    "ETA_hours",            # longer voyages → more delay exposure
    "SOG_kmh",              # current speed (direct delay predictor)
    "risk_score",           # Model 1 output — at runtime we chain M1→M2
]

ALL_FEATURES = CORE_FEATURES + EXTENDED_FEATURES
TARGET       = "delay_hours"

df = df.dropna(subset=ALL_FEATURES + [TARGET])

# ── Target engineering ────────────────────────────────────────────────────────
# delay_hours is right-skewed (many 0s, few big delays).
# Log-transform target for better regression:
#   y_log = log1p(delay_hours)  →  after predict: expm1(y_log)
# This helps RF handle the long tail without needing many trees.
y_raw = df[TARGET].clip(0, 72)   # cap at 72h (3 days) — extreme outliers
y_log = np.log1p(y_raw)          # log-transform

X = df[ALL_FEATURES].copy()

print(f"    Features used: {len(ALL_FEATURES)}")
print(f"    Target: {TARGET} (raw range: {y_raw.min():.1f} – {y_raw.max():.1f} hrs)")
print(f"    Target log-transformed: log1p(delay_hours)")
print(f"    Rows with delay > 0:  {(y_raw > 0).sum():,}")
print(f"    Rows with delay > 5h: {(y_raw > 5).sum():,}")

# ══════════════════════════════════════════════════════════════════════════════
# Train / Validation / Test Split  (70 / 15 / 15)
# ══════════════════════════════════════════════════════════════════════════════
print("\n[2/5] Splitting data (70% train / 15% val / 15% test) ...")

# Step 1: hold out 30% for val+test combined
X_train, X_temp, y_train_log, y_temp_log = train_test_split(
    X, y_log, test_size=0.30, random_state=42
)
# Step 2: split the 30% equally => 15% val + 15% test
X_val, X_test, y_val_log, y_test_log = train_test_split(
    X_temp, y_temp_log, test_size=0.50, random_state=42
)
y_val_raw  = np.expm1(y_val_log)
y_test_raw = np.expm1(y_test_log)

print(f"    Train : {len(X_train):,}  ({len(X_train)/len(X)*100:.0f}%)")
print(f"    Val   : {len(X_val):,}  ({len(X_val)/len(X)*100:.0f}%)")
print(f"    Test  : {len(X_test):,}  ({len(X_test)/len(X)*100:.0f}%)")

# ══════════════════════════════════════════════════════════════════════════════
# Random Forest Model
# ══════════════════════════════════════════════════════════════════════════════
print("\n[3/5] Training Random Forest Regressor ...")
print("    Hyperparameters:")

rf_params = {
    "n_estimators":    300,       # 300 trees — good balance speed/accuracy at 1M rows
    "max_depth":       20,        # deep enough to capture nonlinear delay patterns
    "min_samples_split": 20,      # avoids overfitting on noisy delay data
    "min_samples_leaf":  10,      # smooth predictions on sparse large delays
    "max_features":    "sqrt",    # sqrt(n_features) per split — standard for RF
    "bootstrap":       True,
    "oob_score":       True,      # out-of-bag score for free cross-validation estimate
    "n_jobs":          -1,        # all cores
    "random_state":    42,
}

for k, v in rf_params.items():
    print(f"      {k:25s} = {v}")

model = RandomForestRegressor(**rf_params)
model.fit(X_train, y_train_log)

print(f"\n    OOB Score R2 (on unseen training folds): {model.oob_score_:.4f}")

# Validation set evaluation (early overfitting check)
y_val_pred_log = model.predict(X_val)
y_val_pred_raw = np.expm1(y_val_pred_log).clip(0, 72)
val_rmse = np.sqrt(mean_squared_error(y_val_raw, y_val_pred_raw))
val_mae  = mean_absolute_error(y_val_raw, y_val_pred_raw)
val_r2   = r2_score(y_val_raw, y_val_pred_raw)
print(f"    Validation RMSE: {val_rmse:.3f}h  MAE: {val_mae:.3f}h  R2: {val_r2:.4f}")

# ══════════════════════════════════════════════════════════════════════════════
# Evaluation — convert back from log space
# ══════════════════════════════════════════════════════════════════════════════
print("\n[4/5] Evaluating model on held-out TEST set ...")
y_pred_log = model.predict(X_test)
y_pred_raw = np.expm1(y_pred_log).clip(0, 72)

# Regression metrics (in original hours)
rmse = np.sqrt(mean_squared_error(y_test_raw, y_pred_raw))
mae  = mean_absolute_error(y_test_raw, y_pred_raw)
r2   = r2_score(y_test_raw, y_pred_raw)

# Business metric: are we within ±2 hours? (acceptable for logistics planning)
within_2h = np.mean(np.abs(y_pred_raw - y_test_raw) <= 2.0)
within_5h = np.mean(np.abs(y_pred_raw - y_test_raw) <= 5.0)

# Delay bucket accuracy (No delay / Small / Large)
def to_delay_bucket(hrs):
    return pd.cut(np.array(hrs), bins=[-0.1, 0.5, 4, 12, 73],
                  labels=["none", "small", "moderate", "severe"])

test_bucket = to_delay_bucket(y_test_raw.values)
pred_bucket = to_delay_bucket(y_pred_raw)
bucket_acc  = (test_bucket == pred_bucket).mean()

print(f"\n  ┌──────────────────────────────────────────────┐")
print(f"  │  Random Forest Delay — Test Set Metrics      │")
print(f"  ├──────────────────────────────────────────────┤")
print(f"  │  RMSE (hours, lower=better)    : {rmse:8.3f}   │")
print(f"  │  MAE  (hours, lower=better)    : {mae:8.3f}   │")
print(f"  │  R²   (higher=better)          : {r2:8.4f}   │")
print(f"  │  OOB  R² (free cross-val)      : {model.oob_score_:8.4f}   │")
print(f"  │  Within ±2h (logistics SLA)    : {within_2h*100:7.2f}%   │")
print(f"  │  Within ±5h                    : {within_5h*100:7.2f}%   │")
print(f"  │  Delay bucket accuracy (4-cls) : {bucket_acc*100:7.2f}%   │")
print(f"  └──────────────────────────────────────────────┘")

# Feature importance
fi = pd.Series(model.feature_importances_, index=ALL_FEATURES).sort_values(ascending=False)
print("\n  Feature Importances (sorted):")
for fname, imp in fi.items():
    bar = "█" * int(imp * 50)
    print(f"    {fname:30s} {bar} {imp:.4f}")

# Sample predictions
print("\n  Sample predictions (first 10 test rows):")
sample = pd.DataFrame({
    "actual_delay_h":    y_test_raw.values[:10].round(2),
    "predicted_delay_h": y_pred_raw[:10].round(2),
    "error_h":           (y_pred_raw[:10] - y_test_raw.values[:10]).round(2),
})
print(sample.to_string(index=False))

# ══════════════════════════════════════════════════════════════════════════════
# Save model & metadata
# ══════════════════════════════════════════════════════════════════════════════
print("\n[5/5] Saving model ...")
joblib.dump(model, MODEL_PATH)
print(f"    Model saved -> {MODEL_PATH}")

meta = {
    "model_type":         "RandomForestRegressor",
    "task":               "delay_prediction_hours",
    "version":            "1.0.0",
    "trained_at":         pd.Timestamp.now().isoformat(),
    "split":              "70/15/15 train/val/test",
    "training_rows":      int(len(X_train)),
    "val_rows":           int(len(X_val)),
    "test_rows":          int(len(X_test)),
    "core_features":      CORE_FEATURES,
    "extended_features":  EXTENDED_FEATURES,
    "all_features":       ALL_FEATURES,
    "target":             TARGET,
    "target_transform":   "log1p applied during training; expm1 at inference",
    "output_unit":        "hours",
    "output_range":       [0, 72],
    "delay_buckets": {
        "none":     [0, 0.5],
        "small":    [0.5, 4],
        "moderate": [4, 12],
        "severe":   [12, 72],
    },
    "metrics": {
        "val_rmse_hours":         round(val_rmse, 4),
        "val_mae_hours":          round(val_mae, 4),
        "val_r2":                 round(val_r2, 4),
        "test_rmse_hours":        round(rmse, 4),
        "test_mae_hours":         round(mae, 4),
        "test_r2":                round(r2, 4),
        "oob_r2":                 round(model.oob_score_, 4),
        "within_2h_pct":          round(within_2h * 100, 2),
        "within_5h_pct":          round(within_5h * 100, 2),
        "bucket_accuracy_pct":    round(bucket_acc * 100, 2),
    },
    "hyperparameters": rf_params,
    "feature_importances": {k: round(float(v), 4) for k, v in fi.items()},
    "inference_note": (
        "At runtime: pass risk_score from XGBoost (Model 1) as an extra feature. "
        "Apply np.expm1() to the raw model output to get delay in hours."
    ),
    "data_sources": [
        "satyamrajput7913/processed_AIS_dataset.csv — actual speed vs ETA for delay ground truth",
        "Delay computed as: max(0, dist_km/SOG_kmh - ETA_hours)",
        "Extended with weather, port, traffic simulated features",
        "Target log1p-transformed to handle right-skewed delay distribution",
    ],
}

with open(META_PATH, "w") as f:
    json.dump(meta, f, indent=2)
print(f"    Metadata saved -> {META_PATH}")

print("\n" + "=" * 65)
print("  ✅ Model 2 (Random Forest Delay) training complete!")
print(f"     RMSE={rmse:.3f}h  MAE={mae:.3f}h  R²={r2:.4f}  Within±2h={within_2h*100:.1f}%")
print("=" * 65)
print("\n  Both models trained! Run ml_service.py to verify inference.\n")
