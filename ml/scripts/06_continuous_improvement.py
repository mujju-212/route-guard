"""
RouteGuard ML - Model 6: Continuous Improvement Engine
=======================================================
Purpose: Self-retraining pipeline that runs every Sunday night.

What it does:
  1. Simulates a week of completed shipments (predicted vs actual outcomes)
  2. Computes per-shipment prediction error (risk, delay, reroute)
  3. Appends new data to the training dataset (online learning)
  4. Retrains XGBoost (risk) + Random Forest (delay) + GBM (reroute)
  5. Compares new model vs old model on a held-out test set
  6. If new model is better  -> promotes it (replaces .pkl file)
  7. If not -> keeps old model and logs the reason
  8. Saves a weekly performance report (model_performance_log.json)

Split: 70/15/15  (same as initial training)

This is not a new prediction model -- it is a meta-pipeline that
manages model versions, tracks drift, and improves accuracy over time.

Output artifacts:
  models/xgboost_risk.pkl                  <- updated if improved
  models/random_forest_delay.pkl           <- updated if improved
  models/gradient_boosting_reroute.pkl     <- updated if improved
  models/model_performance_log.json        <- weekly accuracy history
  models/continuous_improvement_meta.json  <- pipeline metadata
"""

import os, json, warnings, joblib, copy
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.metrics import (mean_squared_error, mean_absolute_error,
                             r2_score, f1_score, roc_auc_score)
from xgboost import XGBClassifier, XGBRegressor
from sklearn.ensemble import RandomForestRegressor
warnings.filterwarnings("ignore")

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR   = os.path.join(BASE_DIR, "data")
MODELS_DIR = os.path.join(BASE_DIR, "models")

DATA_PATH  = os.path.join(DATA_DIR, "training_dataset.csv")
LOG_PATH   = os.path.join(MODELS_DIR, "model_performance_log.json")
META_PATH  = os.path.join(MODELS_DIR, "continuous_improvement_meta.json")

np.random.seed(42)

print("=" * 65)
print("  RouteGuard - Model 6: Continuous Improvement Engine")
print("  Simulating weekly Sunday-night retraining cycle")
print("=" * 65)

# ═══════════════════════════════════════════════════════════════════════
# STEP 1 — Load existing training data
# ═══════════════════════════════════════════════════════════════════════
print("\n[1/8] Loading existing training dataset ...")
df_existing = pd.read_csv(DATA_PATH)
N_existing = len(df_existing)
print(f"    Existing rows: {N_existing:,}")

CORE_FEAT = [
    "weather_score", "traffic_score", "port_score", "historical_score",
    "cargo_sensitivity", "distance_remaining_km", "time_of_day",
    "day_of_week", "season", "speed_ratio", "heading_cog_diff",
    "draft_ratio", "ETA_hours", "SOG_kmh",
]

# ═══════════════════════════════════════════════════════════════════════
# STEP 2 — Simulate one week of completed shipments (new real-world data)
# ═══════════════════════════════════════════════════════════════════════
print("\n[2/8] Simulating one week of completed shipments ...")
print("    (In production: this comes from DB query of completed shipments)")

N_NEW = 2000   # ~285 shipments/day * 7 days ≈ 2,000 new records/week

def simulate_weekly_outcomes(n):
    """
    Simulate completed shipment records with BOTH predicted and actual values.
    In production these rows come from:
      SELECT predicted_risk, actual_risk, predicted_delay, actual_delay,
             predicted_reroute, actual_reroute, all features
      FROM shipments WHERE completed_at BETWEEN last_sunday AND now
    """
    rows = []
    for _ in range(n):
        # Feature values (same distribution as training)
        w  = np.random.beta(2, 5) * 100      # weather_score
        po = np.random.beta(2, 3) * 100      # port_score
        tr = po * 0.55 + np.random.normal(0, 10)
        hi = np.random.beta(1.5, 3) * 100
        ca = np.random.beta(2, 2) * 100
        dist = np.random.exponential(800)
        tod  = np.random.randint(0, 24)
        dow  = np.random.randint(0, 7)
        seas = np.random.randint(1, 5)
        sr   = np.random.beta(4, 2)
        hcd  = np.random.uniform(0, 90)
        dr   = np.random.beta(3, 2)
        eta  = np.random.exponential(24)
        sog  = np.random.normal(18, 5)

        # Model predicted risk (from Model 1)
        pred_risk = np.clip(
            0.30*w + 0.25*po + 0.15*tr + 0.15*hi + 0.10*ca
            + 0.05*(1-sr)*100 + np.random.normal(0, 3), 0, 100)

        # ACTUAL risk (ground truth — slightly different from prediction)
        # Error model: true = pred + bias + noise
        # Bias = real-world drift not captured at training time
        actual_risk = np.clip(
            pred_risk + np.random.normal(2.5, 6.0), 0, 100)

        # Model predicted delay (from Model 2)
        pred_delay = np.clip(pred_risk * 0.3 + np.random.exponential(2), 0, 72)

        # Actual delay (ground truth)
        actual_delay = np.clip(
            pred_delay + np.random.normal(1.5, 4.0), 0, 72)

        # Reroute label (ground truth based on actual risk/delay)
        actual_reroute = int(actual_risk >= 55 and actual_delay >= 1.5)

        rows.append({
            "weather_score": np.clip(w, 0, 100),
            "traffic_score": np.clip(tr, 0, 100),
            "port_score": np.clip(po, 0, 100),
            "historical_score": np.clip(hi, 0, 100),
            "cargo_sensitivity": np.clip(ca, 0, 100),
            "distance_remaining_km": np.clip(dist, 5, 15000),
            "time_of_day": tod,
            "day_of_week": dow,
            "season": seas,
            "speed_ratio": np.clip(sr, 0, 2),
            "heading_cog_diff": hcd,
            "draft_ratio": np.clip(dr, 0, 1),
            "ETA_hours": np.clip(eta, 0.1, 72),
            "SOG_kmh": np.clip(sog, 0, 50),
            "expected_speed_kmh": np.clip(dist / max(eta, 0.1), 0, 100),
            "risk_score": actual_risk,
            "delay_hours": actual_delay,
            "reroute_recommended": actual_reroute,
            "risk_level": (
                "low" if actual_risk < 30 else
                "medium" if actual_risk < 55 else
                "high" if actual_risk < 75 else "critical"
            ),
            "pred_risk": pred_risk,
            "pred_delay": pred_delay,
            "risk_error": actual_risk - pred_risk,
            "delay_error": actual_delay - pred_delay,
        })
    return pd.DataFrame(rows)

weekly_df = simulate_weekly_outcomes(N_NEW)
print(f"    New records this week: {N_NEW:,}")
print(f"    Avg risk error (pred vs actual): {weekly_df['risk_error'].mean():.2f} pts")
print(f"    Avg delay error (pred vs actual): {weekly_df['delay_error'].mean():.2f} h")
print(f"    Reroute events this week: {weekly_df['reroute_recommended'].sum()}")

# ═══════════════════════════════════════════════════════════════════════
# STEP 3 — Compute weekly prediction accuracy (model health check)
# ═══════════════════════════════════════════════════════════════════════
print("\n[3/8] Computing prediction accuracy on completed shipments ...")

risk_rmse_week  = float(np.sqrt((weekly_df["risk_error"] ** 2).mean()))
risk_mae_week   = float(weekly_df["risk_error"].abs().mean())
delay_rmse_week = float(np.sqrt((weekly_df["delay_error"] ** 2).mean()))
delay_mae_week  = float(weekly_df["delay_error"].abs().mean())

# Drift detection: is error increasing vs historical baseline?
BASELINE_RISK_RMSE  = 2.504   # from initial training test metrics
BASELINE_DELAY_RMSE = 4.528
DRIFT_THRESHOLD     = 1.25    # trigger retraining if RMSE > 1.25x baseline

risk_drift  = risk_rmse_week  / BASELINE_RISK_RMSE
delay_drift = delay_rmse_week / BASELINE_DELAY_RMSE
retrain_needed = (risk_drift > DRIFT_THRESHOLD) or (delay_drift > DRIFT_THRESHOLD)

print(f"    Risk  RMSE this week: {risk_rmse_week:.3f}  (baseline: {BASELINE_RISK_RMSE})  drift={risk_drift:.2f}x")
print(f"    Delay RMSE this week: {delay_rmse_week:.3f}  (baseline: {BASELINE_DELAY_RMSE})  drift={delay_drift:.2f}x")
print(f"    Drift threshold: {DRIFT_THRESHOLD}x  |  Retraining needed: {retrain_needed}")
print(f"    -> Proceeding with retraining regardless (Sunday = scheduled cycle)")

# ═══════════════════════════════════════════════════════════════════════
# STEP 4 — Merge new data with existing training set
# ═══════════════════════════════════════════════════════════════════════
print("\n[4/8] Merging new data into training set ...")

# Only keep ground-truth columns (drop pred_* columns from merged set)
new_rows = weekly_df.drop(columns=["pred_risk", "pred_delay", "risk_error", "delay_error"])

# Cap dataset size to prevent unbounded growth (rolling window = 350K rows)
MAX_ROWS    = 350_000
df_combined = pd.concat([df_existing, new_rows], ignore_index=True)
if len(df_combined) > MAX_ROWS:
    # Drop oldest rows (first in = first out)
    df_combined = df_combined.tail(MAX_ROWS).reset_index(drop=True)
    print(f"    Rolling window applied: capped at {MAX_ROWS:,} rows")

print(f"    Combined dataset: {len(df_combined):,} rows  (+{len(new_rows):,} new)")

# ═══════════════════════════════════════════════════════════════════════
# STEP 5 — 70/15/15 Split on combined dataset
# ═══════════════════════════════════════════════════════════════════════
print("\n[5/8] Splitting combined dataset (70% train / 15% val / 15% test) ...")

FEAT14 = CORE_FEAT   # 14 features for XGBoost & RF
FEAT11 = CORE_FEAT[:9] + ["risk_score", "delay_hours"]   # 11 for GBM

df_combined = df_combined.dropna(subset=FEAT14 + ["risk_score", "delay_hours", "reroute_recommended"])

X_all = df_combined[FEAT14]
y_risk    = df_combined["risk_score"]
y_delay   = np.log1p(df_combined["delay_hours"])
y_reroute = ((df_combined["risk_score"] >= 55) & (df_combined["delay_hours"] >= 1.5)).astype(int)
X_gbm     = df_combined[FEAT11]

def split_70_15_15(X, y):
    X_tr, X_tmp, y_tr, y_tmp = train_test_split(X, y, test_size=0.30, random_state=42)
    X_v,  X_te, y_v,  y_te  = train_test_split(X_tmp, y_tmp, test_size=0.50, random_state=42)
    return X_tr, X_v, X_te, y_tr, y_v, y_te

Xr_tr, Xr_v, Xr_te, yr_tr, yr_v, yr_te = split_70_15_15(X_all, y_risk)
Xd_tr, Xd_v, Xd_te, yd_tr, yd_v, yd_te = split_70_15_15(X_all, y_delay)
Xg_tr, Xg_v, Xg_te, yg_tr, yg_v, yg_te = split_70_15_15(X_gbm, y_reroute)

print(f"    Train: {len(Xr_tr):,}  Val: {len(Xr_v):,}  Test: {len(Xr_te):,}")

# ═══════════════════════════════════════════════════════════════════════
# STEP 6 — Retrain all 3 core models on combined dataset
# ═══════════════════════════════════════════════════════════════════════
print("\n[6/8] Retraining all 3 models on combined dataset ...")

# -- 6a: Retrain XGBoost (risk score) --
print("    [6a] XGBoost Risk Score ...")
new_xgb = XGBRegressor(
    n_estimators=500, learning_rate=0.05, max_depth=6,
    subsample=0.8, colsample_bytree=0.8, min_child_weight=5,
    reg_alpha=0.1, reg_lambda=1.0,
    objective="reg:squarederror", random_state=42,
    n_jobs=-1, tree_method="hist",
)
new_xgb.fit(Xr_tr, yr_tr, eval_set=[(Xr_v, yr_v)], verbose=False)
new_risk_pred = new_xgb.predict(Xr_te).clip(0, 100)
new_risk_rmse = float(np.sqrt(mean_squared_error(yr_te, new_risk_pred)))
new_risk_r2   = float(r2_score(yr_te, new_risk_pred))
print(f"       New RMSE={new_risk_rmse:.4f}  R2={new_risk_r2:.4f}")

# -- 6b: Retrain Random Forest (delay) --
print("    [6b] Random Forest Delay ...")
new_rf = RandomForestRegressor(
    n_estimators=300, max_depth=20, min_samples_split=20,
    min_samples_leaf=10, max_features="sqrt", bootstrap=True,
    oob_score=True, random_state=42, n_jobs=-1,
)
new_rf.fit(Xd_tr, yd_tr)
new_delay_pred_log = new_rf.predict(Xd_te)
new_delay_pred_raw = np.expm1(new_delay_pred_log).clip(0, 72)
new_delay_rmse = float(np.sqrt(mean_squared_error(np.expm1(yd_te), new_delay_pred_raw)))
new_delay_r2   = float(r2_score(np.expm1(yd_te), new_delay_pred_raw))
print(f"       New RMSE={new_delay_rmse:.4f}h  R2={new_delay_r2:.4f}")

# -- 6c: Retrain GBM (reroute) --
print("    [6c] GBM Reroute Classifier ...")
pos_w = int(yg_tr.value_counts().get(0, 1) / max(yg_tr.value_counts().get(1, 1), 1))
new_gbm = XGBClassifier(
    n_estimators=400, learning_rate=0.05, max_depth=5,
    subsample=0.8, colsample_bytree=0.8, min_child_weight=3,
    scale_pos_weight=pos_w, objective="binary:logistic",
    eval_metric="auc", random_state=42, n_jobs=-1, tree_method="hist",
)
new_gbm.fit(Xg_tr, yg_tr, eval_set=[(Xg_v, yg_v)], verbose=False)
new_gbm_prob  = new_gbm.predict_proba(Xg_te)[:, 1]
new_gbm_pred  = (new_gbm_prob >= 0.50).astype(int)
new_gbm_auc   = float(roc_auc_score(yg_te, new_gbm_prob)) if yg_te.sum() > 0 else 0.0
new_gbm_f1    = float(f1_score(yg_te, new_gbm_pred, zero_division=0))
print(f"       New AUC={new_gbm_auc:.4f}  F1={new_gbm_f1:.4f}")

# ═══════════════════════════════════════════════════════════════════════
# STEP 7 — Compare new vs old models, promote if better
# ═══════════════════════════════════════════════════════════════════════
print("\n[7/8] Comparing new models vs old models ...")

# Load old model metrics from metadata files
def load_old_metric(meta_file, metric_key, default):
    path = os.path.join(MODELS_DIR, meta_file)
    if os.path.exists(path):
        with open(path) as f:
            meta = json.load(f)
        m = meta.get("metrics", {})
        # Try multiple possible key names
        for k in [metric_key, metric_key.replace("_", " ")]:
            if k in m:
                return float(m[k])
    return default

old_risk_rmse  = load_old_metric("xgboost_risk_meta.json",          "rmse",           2.504)
old_delay_rmse = load_old_metric("random_forest_delay_meta.json",   "test_rmse_hours", 4.528)
old_gbm_auc    = load_old_metric("gradient_boosting_reroute_meta.json", "auc_roc",    0.9999)

results = {}

# XGBoost: promote if RMSE improves by > 1%
xgb_improved = new_risk_rmse < old_risk_rmse * 0.99
results["xgboost_risk"] = {
    "old_rmse": round(old_risk_rmse, 4),
    "new_rmse": round(new_risk_rmse, 4),
    "improved": xgb_improved,
    "action": "PROMOTED" if xgb_improved else "KEPT_OLD",
}
if xgb_improved:
    joblib.dump(new_xgb, os.path.join(MODELS_DIR, "xgboost_risk.pkl"))
    print(f"    XGBoost: {old_risk_rmse:.4f} -> {new_risk_rmse:.4f}  [PROMOTED - improved by {(old_risk_rmse-new_risk_rmse)/old_risk_rmse*100:.2f}%]")
else:
    print(f"    XGBoost: {old_risk_rmse:.4f} -> {new_risk_rmse:.4f}  [KEPT OLD - no improvement]")

# Random Forest: promote if RMSE improves by > 1%
rf_improved = new_delay_rmse < old_delay_rmse * 0.99
results["random_forest_delay"] = {
    "old_rmse": round(old_delay_rmse, 4),
    "new_rmse": round(new_delay_rmse, 4),
    "improved": rf_improved,
    "action": "PROMOTED" if rf_improved else "KEPT_OLD",
}
if rf_improved:
    joblib.dump(new_rf, os.path.join(MODELS_DIR, "random_forest_delay.pkl"))
    print(f"    RF Delay: {old_delay_rmse:.4f}h -> {new_delay_rmse:.4f}h  [PROMOTED]")
else:
    print(f"    RF Delay: {old_delay_rmse:.4f}h -> {new_delay_rmse:.4f}h  [KEPT OLD]")

# GBM: promote if AUC improves
gbm_improved = new_gbm_auc > old_gbm_auc
results["gradient_boosting_reroute"] = {
    "old_auc": round(old_gbm_auc, 4),
    "new_auc": round(new_gbm_auc, 4),
    "improved": gbm_improved,
    "action": "PROMOTED" if gbm_improved else "KEPT_OLD",
}
if gbm_improved:
    joblib.dump(new_gbm, os.path.join(MODELS_DIR, "gradient_boosting_reroute.pkl"))
    print(f"    GBM Reroute: AUC {old_gbm_auc:.4f} -> {new_gbm_auc:.4f}  [PROMOTED]")
else:
    print(f"    GBM Reroute: AUC {old_gbm_auc:.4f} -> {new_gbm_auc:.4f}  [KEPT OLD]")

# Save updated training dataset
df_combined.to_csv(DATA_PATH, index=False)
print(f"\n    Training dataset updated: {DATA_PATH}")

# ═══════════════════════════════════════════════════════════════════════
# STEP 8 — Append to performance log & save metadata
# ═══════════════════════════════════════════════════════════════════════
print("\n[8/8] Saving performance log ...")

# Load existing log
perf_log = []
if os.path.exists(LOG_PATH):
    with open(LOG_PATH) as f:
        try:
            perf_log = json.load(f)
        except json.JSONDecodeError:
            perf_log = []

week_record = {
    "run_date": datetime.now().isoformat(),
    "new_shipments_this_week": N_NEW,
    "total_training_rows": len(df_combined),
    "drift_detection": {
        "risk_drift_factor":  round(risk_drift, 3),
        "delay_drift_factor": round(delay_drift, 3),
        "threshold":          DRIFT_THRESHOLD,
        "triggered":          retrain_needed,
    },
    "weekly_field_accuracy": {
        "risk_rmse_on_completions":  round(risk_rmse_week, 3),
        "risk_mae_on_completions":   round(risk_mae_week, 3),
        "delay_rmse_on_completions": round(delay_rmse_week, 3),
        "delay_mae_on_completions":  round(delay_mae_week, 3),
    },
    "model_comparison": results,
}
perf_log.append(week_record)

with open(LOG_PATH, "w") as f:
    json.dump(perf_log, f, indent=2)
print(f"    Performance log -> {LOG_PATH}")

meta = {
    "pipeline_name": "RouteGuard Continuous Improvement Engine",
    "version": "1.0.0",
    "last_run": datetime.now().isoformat(),
    "schedule": "Every Sunday night (weekly)",
    "models_managed": [
        "xgboost_risk.pkl",
        "random_forest_delay.pkl",
        "gradient_boosting_reroute.pkl",
    ],
    "split": "70/15/15 train/val/test",
    "rolling_window_max_rows": MAX_ROWS,
    "drift_threshold_multiplier": DRIFT_THRESHOLD,
    "promotion_criteria": {
        "xgboost_risk": "New RMSE must be < 99% of old RMSE (>1% improvement)",
        "random_forest_delay": "New RMSE must be < 99% of old RMSE",
        "gradient_boosting_reroute": "New AUC must be > old AUC",
    },
    "data_sources_for_new_rows": [
        "shipments table: completed_at between last_sunday and now",
        "Fields: all 9 core features + actual_risk + actual_delay + actual_reroute",
        "In simulation: synthetic weekly outcomes with N(2.5, 6) prediction error",
    ],
    "pipeline_steps": [
        "1. Load existing training_dataset.csv",
        "2. Simulate/query new completed shipment outcomes",
        "3. Compute weekly prediction accuracy (drift detection)",
        "4. Merge new data (rolling window of 350K rows)",
        "5. 70/15/15 split on combined dataset",
        "6. Retrain XGBoost + RF + GBM from scratch on combined data",
        "7. Compare new vs old on test set; promote if better",
        "8. Append to model_performance_log.json",
    ],
    "current_week_summary": week_record,
}
with open(META_PATH, "w") as f:
    json.dump(meta, f, indent=2)
print(f"    Pipeline metadata -> {META_PATH}")

# Final summary table
print("\n" + "=" * 65)
print("  RETRAINING RESULTS SUMMARY")
print("=" * 65)
print(f"  {'Model':<32} {'Old':<12} {'New':<12} {'Action'}")
print(f"  {'-'*60}")
r = results["xgboost_risk"]
print(f"  {'XGBoost Risk (RMSE)':<32} {r['old_rmse']:<12} {r['new_rmse']:<12} {r['action']}")
r = results["random_forest_delay"]
print(f"  {'RF Delay (RMSE h)':<32} {r['old_rmse']:<12} {r['new_rmse']:<12} {r['action']}")
r = results["gradient_boosting_reroute"]
print(f"  {'GBM Reroute (AUC)':<32} {r['old_auc']:<12} {r['new_auc']:<12} {r['action']}")
print("=" * 65)
print(f"\n  New records ingested  : {N_NEW:,}")
print(f"  Total training rows   : {len(df_combined):,}")
print(f"  Log entries           : {len(perf_log)}")
print(f"\n  [DONE] Continuous Improvement cycle complete.\n")
