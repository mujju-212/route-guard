"""
RouteGuard ML - Step 2: Train XGBoost Risk Score Model (Model 1)
================================================================
Model: XGBoost Regressor
Task:  Predict risk score (0-100) for a shipment given its current
       environmental and operational features.

Input features (9 core + extras):
  weather_score, traffic_score, port_score, historical_score,
  cargo_sensitivity, distance_remaining_km, time_of_day,
  day_of_week, season, speed_ratio, heading_cog_diff, draft_ratio

Output:
  risk_score (float 0-100)

Saved artifacts:
  models/xgboost_risk.pkl         ← trained model
  models/xgboost_risk_meta.json   ← feature names, threshold, metrics
"""

import os
import json
import warnings
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics        import mean_squared_error, mean_absolute_error, r2_score
from sklearn.preprocessing  import StandardScaler
import xgboost as xgb
warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH   = os.path.join(BASE_DIR, "data", "training_dataset.csv")
MODELS_DIR  = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

MODEL_PATH  = os.path.join(MODELS_DIR, "xgboost_risk.pkl")
META_PATH   = os.path.join(MODELS_DIR, "xgboost_risk_meta.json")

print("=" * 65)
print("  RouteGuard - Model 1: XGBoost Risk Score Training")
print("=" * 65)

# ══════════════════════════════════════════════════════════════════════════════
# Load data
# ══════════════════════════════════════════════════════════════════════════════
print("\n[1/5] Loading training dataset ...")
df = pd.read_csv(DATA_PATH)
print(f"    Rows loaded: {len(df):,}")

# ── Feature set ───────────────────────────────────────────────────────────────
# 9 core features used in production (must match feature_engine.py exactly)
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

# Extended features available from AIS data — improve training accuracy
EXTENDED_FEATURES = [
    "speed_ratio",          # how slow vs planned
    "heading_cog_diff",     # fighting currents/wind
    "draft_ratio",          # vessel load
    "ETA_hours",            # journey length context
    "SOG_kmh",              # current speed
]

ALL_FEATURES = CORE_FEATURES + EXTENDED_FEATURES
TARGET       = "risk_score"

df = df.dropna(subset=ALL_FEATURES + [TARGET])
X = df[ALL_FEATURES].copy()
y = df[TARGET].copy()

print(f"    Features used: {len(ALL_FEATURES)}")
print(f"    Core (production): {CORE_FEATURES}")
print(f"    Extended (training only): {EXTENDED_FEATURES}")
print(f"    Target: {TARGET}  (range {y.min():.1f} - {y.max():.1f})")

# ══════════════════════════════════════════════════════════════════════════════
# Train / Validation / Test Split  (70 / 15 / 15)
# ══════════════════════════════════════════════════════════════════════════════
print("\n[2/5] Splitting data (70% train / 15% val / 15% test) ...")
from sklearn.model_selection import train_test_split

# Step 1: hold out 30% for val+test
X_train, X_temp, y_train, y_temp = train_test_split(
    X, y, test_size=0.30, random_state=42
)
# Step 2: split the 30% equally => 15% val + 15% test
X_val, X_test, y_val, y_test = train_test_split(
    X_temp, y_temp, test_size=0.50, random_state=42
)
print(f"    Train : {len(X_train):,}  ({len(X_train)/len(X)*100:.0f}%)")
print(f"    Val   : {len(X_val):,}  ({len(X_val)/len(X)*100:.0f}%)")
print(f"    Test  : {len(X_test):,}  ({len(X_test)/len(X)*100:.0f}%)")

# ══════════════════════════════════════════════════════════════════════════════
# XGBoost Model
# ══════════════════════════════════════════════════════════════════════════════
print("\n[3/5] Training XGBoost Regressor ...")
print("    Hyperparameters chosen via domain knowledge + grid-search equivalent:")

xgb_params = {
    # Boosting
    "n_estimators":      500,        # trees — enough for 1M rows
    "learning_rate":     0.05,       # conservative — reduces overfitting
    "max_depth":         6,          # typical for tabular data
    "subsample":         0.8,        # row sampling — reduces overfitting
    "colsample_bytree":  0.8,        # column sampling per tree
    "min_child_weight":  5,          # minimum samples per leaf node
    # Regularization
    "reg_alpha":         0.1,        # L1 regularization
    "reg_lambda":        1.0,        # L2 regularization
    # Task
    "objective":         "reg:squarederror",
    "eval_metric":       "rmse",
    "random_state":      42,
    "n_jobs":            -1,         # use all CPU cores
    "tree_method":       "hist",     # fast histogram method for large data
}

for k, v in xgb_params.items():
    print(f"      {k:25s} = {v}")

model = xgb.XGBRegressor(**xgb_params)

model.fit(
    X_train, y_train,
    eval_set=[(X_val, y_val)],   # validation set monitors overfitting
    verbose=50,
)

# ══════════════════════════════════════════════════════════════════════════════
# Evaluation
# ══════════════════════════════════════════════════════════════════════════════
print("\n[4/5] Evaluating model ...")
y_pred = model.predict(X_test).clip(0, 100)

rmse = np.sqrt(mean_squared_error(y_test, y_pred))
mae  = mean_absolute_error(y_test, y_pred)
r2   = r2_score(y_test, y_pred)

# Risk-level classification accuracy (Low/Medium/High/Critical buckets)
def to_level(scores):
    return pd.cut(scores,
                  bins=[-1, 30, 55, 75, 101],
                  labels=["low", "medium", "high", "critical"])

y_test_level = to_level(y_test.values)
y_pred_level = to_level(y_pred)
level_acc = (y_test_level == y_pred_level).mean()

print(f"\n  ┌──────────────────────────────────────────┐")
print(f"  │  XGBoost Risk Score — Test Set Metrics   │")
print(f"  ├──────────────────────────────────────────┤")
print(f"  │  RMSE (lower=better)     : {rmse:8.3f}       │")
print(f"  │  MAE  (lower=better)     : {mae:8.3f}       │")
print(f"  │  R²   (higher=better)    : {r2:8.4f}       │")
print(f"  │  Level Accuracy (4-class): {level_acc*100:7.2f}%       │")
print(f"  └──────────────────────────────────────────┘")

# Feature importance
fi = pd.Series(model.feature_importances_, index=ALL_FEATURES).sort_values(ascending=False)
print("\n  Feature Importances (sorted):")
for fname, imp in fi.items():
    bar = "█" * int(imp * 40)
    print(f"    {fname:30s} {bar} {imp:.4f}")

# ══════════════════════════════════════════════════════════════════════════════
# Save model & metadata
# ══════════════════════════════════════════════════════════════════════════════
print("\n[5/5] Saving model ...")
joblib.dump(model, MODEL_PATH)
print(f"    Model saved -> {MODEL_PATH}")

# Save metadata — used by ml_service.py at runtime
meta = {
    "model_type":         "XGBoostRegressor",
    "task":               "risk_score_prediction",
    "version":            "1.0.0",
    "trained_at":         pd.Timestamp.now().isoformat(),
    "training_rows":      int(len(X_train)),
    "val_rows":           int(len(X_val)),
    "test_rows":          int(len(X_test)),
    "split":              "70/15/15 train/val/test",
    "core_features":      CORE_FEATURES,
    "extended_features":  EXTENDED_FEATURES,
    "all_features":       ALL_FEATURES,
    "target":             TARGET,
    "output_range":       [0, 100],
    "risk_thresholds": {
        "low":      [0,  30],
        "medium":   [30, 55],
        "high":     [55, 75],
        "critical": [75, 100],
    },
    "metrics": {
        "rmse":                   round(rmse, 4),
        "mae":                    round(mae, 4),
        "r2":                     round(r2, 4),
        "risk_level_accuracy_pct":round(level_acc * 100, 2),
    },
    "hyperparameters": xgb_params,
    "feature_importances": {k: round(float(v), 4) for k, v in fi.items()},
    "data_sources": [
        "satyamrajput7913/processed_AIS_dataset.csv (1.1M AIS records)",
        "saurabhshahane/hour_forecast.csv (sea weather distribution)",
        "Synthetic port congestion simulation (cluster-based)",
        "Rule-engineered risk labels (weighted feature combination)",
    ],
}

with open(META_PATH, "w") as f:
    json.dump(meta, f, indent=2)
print(f"    Metadata saved -> {META_PATH}")

print("\n" + "=" * 65)
print("  ✅ Model 1 (XGBoost Risk Score) training complete!")
print(f"     RMSE={rmse:.3f}  MAE={mae:.3f}  R²={r2:.4f}  Level Acc={level_acc*100:.1f}%")
print("=" * 65)
print("\n  Run 03_train_random_forest.py next.\n")
