"""
RouteGuard ML - Model 3: Gradient Boosting Reroute Classifier
=============================================================
Task:   Binary classification -- should this shipment be rerouted?
Input:  9 core features + risk_score + delay_hours (11 features)
Output: reroute_yes_no (0/1) + confidence_pct (0-100)
Split:  70% train / 15% val / 15% test
"""

import os, json, warnings, joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, roc_auc_score, confusion_matrix,
                             classification_report)
from xgboost import XGBClassifier
warnings.filterwarnings("ignore")

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH  = os.path.join(BASE_DIR, "data", "training_dataset.csv")
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "gradient_boosting_reroute.pkl")
META_PATH  = os.path.join(MODELS_DIR, "gradient_boosting_reroute_meta.json")
os.makedirs(MODELS_DIR, exist_ok=True)

print("=" * 65)
print("  RouteGuard - Model 3: Gradient Boosting Reroute Classifier")
print("=" * 65)

# ── Load data ──────────────────────────────────────────────────────────────
print("\n[1/6] Loading training dataset ...")
df = pd.read_csv(DATA_PATH)
print(f"    Rows: {len(df):,}")

# ── Re-engineer label for better balance ──────────────────────────────────
# Original label (risk>=65 AND delay>=3h) gives only 0.3% positive.
# Reroute should be triggered when: HIGH/CRITICAL risk AND meaningful delay
# Threshold: risk_score >= 55 AND delay_hours >= 1.5
# This captures real reroute-worthy situations across all injected scenarios.
df["reroute_label"] = (
    (df["risk_score"] >= 55) & (df["delay_hours"] >= 1.5)
).astype(int)

pos = df["reroute_label"].sum()
neg = len(df) - pos
print(f"    Reroute = 1 (needs reroute): {pos:,}  ({pos/len(df)*100:.1f}%)")
print(f"    Reroute = 0 (no reroute):    {neg:,}  ({neg/len(df)*100:.1f}%)")

FEATURES = [
    "weather_score", "traffic_score", "port_score", "historical_score",
    "cargo_sensitivity", "distance_remaining_km", "time_of_day",
    "day_of_week", "season",
    "risk_score",      # output from Model 1 -- chained input
    "delay_hours",     # output from Model 2 -- chained input
]
TARGET = "reroute_label"

df = df.dropna(subset=FEATURES + [TARGET])
X = df[FEATURES].copy()
y = df[TARGET].copy()

# ── 70/15/15 Split ─────────────────────────────────────────────────────────
print("\n[2/6] Splitting data (70% train / 15% val / 15% test) ...")
X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.30, random_state=42, stratify=y)
X_val,   X_test, y_val,   y_test = train_test_split(X_temp, y_temp, test_size=0.50, random_state=42, stratify=y_temp)

print(f"    Train : {len(X_train):,}  (pos={y_train.sum():,})")
print(f"    Val   : {len(X_val):,}  (pos={y_val.sum():,})")
print(f"    Test  : {len(X_test):,}  (pos={y_test.sum():,})")

# ── Class imbalance handling ───────────────────────────────────────────────
# scale_pos_weight = negative_count / positive_count (XGBoost built-in balancing)
scale_pos_weight = int(y_train.value_counts()[0] / max(y_train.value_counts()[1], 1))
print(f"\n    scale_pos_weight = {scale_pos_weight}  (auto class balancing)")

# ── Train ──────────────────────────────────────────────────────────────────
print("\n[3/6] Training XGBoost Classifier (Gradient Boosting) ...")

params = {
    "n_estimators":      400,
    "learning_rate":     0.05,
    "max_depth":         5,
    "subsample":         0.8,
    "colsample_bytree":  0.8,
    "min_child_weight":  3,
    "reg_alpha":         0.1,
    "reg_lambda":        1.0,
    "scale_pos_weight":  scale_pos_weight,  # handles class imbalance
    "objective":         "binary:logistic",
    "eval_metric":       "auc",
    "random_state":      42,
    "n_jobs":            -1,
    "tree_method":       "hist",
}

for k, v in params.items():
    print(f"      {k:25s} = {v}")

model = XGBClassifier(**params)
model.fit(
    X_train, y_train,
    eval_set=[(X_val, y_val)],
    verbose=50,
)

# ── Threshold tuning on validation set ────────────────────────────────────
print("\n[4/6] Tuning decision threshold on validation set ...")
val_proba = model.predict_proba(X_val)[:, 1]

best_thresh, best_f1 = 0.5, 0.0
for t in np.arange(0.20, 0.71, 0.05):
    preds = (val_proba >= t).astype(int)
    f = f1_score(y_val, preds, zero_division=0)
    if f > best_f1:
        best_f1, best_thresh = f, t

print(f"    Best threshold on val: {best_thresh:.2f}  (F1={best_f1:.4f})")

# ── Evaluate on test set ───────────────────────────────────────────────────
print("\n[5/6] Evaluating on held-out TEST set ...")
test_proba = model.predict_proba(X_test)[:, 1]
y_pred = (test_proba >= best_thresh).astype(int)

acc  = accuracy_score(y_test, y_pred)
prec = precision_score(y_test, y_pred, zero_division=0)
rec  = recall_score(y_test, y_pred, zero_division=0)
f1   = f1_score(y_test, y_pred, zero_division=0)
auc  = roc_auc_score(y_test, test_proba)
cm   = confusion_matrix(y_test, y_pred)

print(f"\n  +-----------------------------------------------+")
print(f"  |  Gradient Boosting Reroute - Test Metrics     |")
print(f"  +-----------------------------------------------+")
print(f"  |  Accuracy              : {acc*100:7.2f}%             |")
print(f"  |  Precision             : {prec*100:7.2f}%             |")
print(f"  |  Recall                : {rec*100:7.2f}%             |")
print(f"  |  F1 Score              : {f1*100:7.2f}%             |")
print(f"  |  AUC-ROC               : {auc:10.4f}          |")
print(f"  |  Decision Threshold    : {best_thresh:10.2f}          |")
print(f"  +-----------------------------------------------+")
print(f"\n  Confusion Matrix:")
print(f"    True Negative  (correct no-reroute)  : {cm[0,0]:,}")
print(f"    False Positive (wrong reroute alert) : {cm[0,1]:,}")
print(f"    False Negative (missed reroute!)     : {cm[1,0]:,}")
print(f"    True Positive  (correct reroute)     : {cm[1,1]:,}")

fi = pd.Series(model.feature_importances_, index=FEATURES).sort_values(ascending=False)
print("\n  Feature Importances:")
for fname, imp in fi.items():
    bar = "|" * int(imp * 40)
    print(f"    {fname:30s} {bar} {imp:.4f}")

# ── Save ───────────────────────────────────────────────────────────────────
print("\n[6/6] Saving model ...")
joblib.dump(model, MODEL_PATH)
print(f"    Saved -> {MODEL_PATH}")

meta = {
    "model_type": "XGBClassifier (Gradient Boosting)",
    "task": "reroute_decision_binary_classification",
    "version": "1.0.0",
    "trained_at": pd.Timestamp.now().isoformat(),
    "split": "70/15/15 train/val/test",
    "training_rows": int(len(X_train)),
    "val_rows": int(len(X_val)),
    "test_rows": int(len(X_test)),
    "features": FEATURES,
    "feature_count": len(FEATURES),
    "target": TARGET,
    "label_definition": "risk_score >= 55 AND delay_hours >= 1.5",
    "class_balance": {"class_0_pct": round(neg/len(df)*100, 2), "class_1_pct": round(pos/len(df)*100, 2)},
    "decision_threshold": round(best_thresh, 2),
    "output": {
        "reroute_recommended": "0 or 1",
        "confidence_pct": "model.predict_proba(X)[:,1] * 100"
    },
    "hyperparameters": {k: v for k, v in params.items()},
    "metrics": {
        "accuracy_pct": round(acc * 100, 2),
        "precision_pct": round(prec * 100, 2),
        "recall_pct": round(rec * 100, 2),
        "f1_pct": round(f1 * 100, 2),
        "auc_roc": round(auc, 4),
        "confusion_matrix": cm.tolist(),
    },
    "feature_importances": {k: round(float(v), 4) for k, v in fi.items()},
    "inference_note": "Apply model.predict_proba(X)[:,1] >= threshold for final decision",
    "data_sources": [
        "training_dataset.csv (298,780 rows from AIS + scenario injection)",
        "Label re-engineered: risk>=55 AND delay>=1.5h for better class balance",
        "Class imbalance handled via scale_pos_weight + threshold tuning",
    ],
}
with open(META_PATH, "w") as f:
    json.dump(meta, f, indent=2)
print(f"    Meta -> {META_PATH}")

print("\n" + "=" * 65)
print("  [DONE] Model 3 (Gradient Boosting Reroute) complete!")
print(f"  AUC={auc:.4f}  F1={f1*100:.1f}%  Recall={rec*100:.1f}%")
print("=" * 65)
print("\n  Run 05_train_lstm.py next.\n")
