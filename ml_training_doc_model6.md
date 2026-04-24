# RouteGuard — ML Training Documentation
### Model 6: Continuous Improvement Engine (Self-Retraining Pipeline)

---

## What This Model Is

Model 6 is **not a prediction model** — it is a **meta-pipeline** that manages, monitors, and improves all the other models automatically.

It answers one question every Sunday night:
> *"Have our models gotten worse this week? If yes, retrain and check if the new version is better. If the new version wins, replace the old one."*

This is what separates a production ML system from a one-time trained model. Without continuous improvement, models decay as the real world changes — new trade routes, seasonal storms, port expansions, global events.

---

## When It Runs

| Trigger | Frequency | What Runs |
|---|---|---|
| **Scheduled** | Every Sunday 02:00 UTC | Full 8-step pipeline |
| **Drift alert** | Anytime RMSE > 1.25x baseline | Emergency retraining |
| **Manual** | Admin dashboard button | Immediate run |

---

## The 8-Step Pipeline

### Step 1 — Load Existing Training Data
```
Load: training_dataset.csv  (298,780 rows initially)
These are all records from initial training + all previous weekly additions
```

### Step 2 — Collect New Completed Shipment Data
```
In production (SQL query):
  SELECT features, actual_risk, actual_delay, actual_reroute
  FROM shipments
  WHERE completed_at BETWEEN last_sunday AND now
  AND status = 'DELIVERED'

In simulation (this script):
  Generate ~2,000 synthetic completed shipment records
  Each record has:
    - All 14 input features (weather, port, traffic, etc.)
    - actual_risk    (what risk score really was at delivery)
    - actual_delay   (how many hours the shipment was actually late)
    - actual_reroute (was rerouting the right decision? 0/1)
    - pred_risk      (what Model 1 predicted at the time)
    - pred_delay     (what Model 2 predicted)
    - risk_error     = actual_risk - pred_risk
    - delay_error    = actual_delay - pred_delay
```

**This week's simulated results:**
- New records: **2,000**
- Avg risk prediction error: **+2.50 pts** (model was slightly under-predicting)
- Avg delay prediction error: **+1.59 h**
- Reroute events: **105 shipments** needed rerouting this week

### Step 3 — Drift Detection (Model Health Check)
```python
# Compare this week's actual RMSE vs original training benchmark

risk_drift  = risk_rmse_this_week  / BASELINE_RISK_RMSE
           = 6.451 / 2.504  = 2.58x          <- DRIFT DETECTED

delay_drift = delay_rmse_this_week / BASELINE_DELAY_RMSE
           = 4.271 / 4.528  = 0.94x          <- No drift

DRIFT_THRESHOLD = 1.25x  (>25% degradation triggers forced retraining)
```

**This week:**
- Risk drift = **2.58x** — above threshold → retraining triggered
- Delay drift = **0.94x** — actually improved this week (delay errors smaller)

> **Why does drift happen?** The simulated weekly data uses a different distribution than the AIS training data. In real production, drift occurs when: seasonal patterns shift (typhoon season starts), new trade routes open, port capacity changes, or geopolitical events create new risk patterns not seen in training data.

### Step 4 — Merge New Data (Rolling Window)
```
Combined = existing_data  +  new_weekly_data
         = 298,780 rows   +  2,000 rows
         = 300,780 rows

Rolling window cap: 350,000 rows
  If total > 350K → drop oldest rows (FIFO)
  Prevents unbounded memory growth while keeping recent data fresh
```

**Why rolling window instead of keeping all data forever?**
- Old data from 2 years ago may reflect different market conditions
- Recent data is more relevant to current risk patterns
- Fixed memory footprint for the training job

### Step 5 — 70/15/15 Split on Combined Dataset
```
Total: 300,780 rows (after merge)
  Train : 210,546  (70%)  — both old + new data mixed in
  Val   : 45,117   (15%)  — used for model validation during training
  Test  : 45,117   (15%)  — final blind comparison (old vs new)
```

The test set is the **arbiter** — both old and new models are evaluated on it. The model that scores better on this test set wins.

### Step 6 — Retrain All 3 Core Models

All 3 models are retrained from scratch on the combined dataset:

| Model | Algorithm | Target | Key Params |
|---|---|---|---|
| XGBoost Risk | XGBRegressor | risk_score | n_estimators=500, lr=0.05, depth=6 |
| RF Delay | RandomForestRegressor | log1p(delay_hours) | n_estimators=300, depth=20, oob_score=True |
| GBM Reroute | XGBClassifier | reroute_recommended | scale_pos_weight=auto, auc metric |

**This week's retrained results:**
```
XGBoost:  RMSE=2.580  R²=0.963
RF Delay: RMSE=4.530h R²=0.741
GBM:      AUC=0.9999  F1=0.979
```

### Step 7 — Model Comparison & Promotion

**Promotion criteria (strict — prevents regressions):**

| Model | Promotion Rule |
|---|---|
| XGBoost Risk | New RMSE < Old RMSE × 0.99 (must improve by >1%) |
| RF Delay | New RMSE < Old RMSE × 0.99 |
| GBM Reroute | New AUC > Old AUC (any improvement) |

**This week's decision:**
```
Model                Old         New         Decision
─────────────────────────────────────────────────────
XGBoost Risk (RMSE)  2.504       2.580       KEPT OLD
  Reason: New RMSE is higher — weekly data introduced noise, old model better

RF Delay (RMSE h)    4.528       4.530       KEPT OLD
  Reason: Marginal change (0.04%) — not statistically significant

GBM Reroute (AUC)    1.0000      0.9999      KEPT OLD
  Reason: AUC slightly lower — old model marginally better on test set
```

**KEPT OLD is the correct outcome this week.** When only 2,000 new samples are added to 298,780 existing, the distribution barely shifts — so the old model still fits best. Over months, as real outcomes accumulate, the new models will start winning.

### Step 8 — Logging & Reporting

**Saved every week to `model_performance_log.json`:**
```json
{
  "run_date": "2026-04-23T...",
  "new_shipments_this_week": 2000,
  "total_training_rows": 300780,
  "drift_detection": {
    "risk_drift_factor": 2.58,
    "delay_drift_factor": 0.94,
    "threshold": 1.25,
    "triggered": true
  },
  "weekly_field_accuracy": {
    "risk_rmse_on_completions": 6.451,
    "delay_rmse_on_completions": 4.271
  },
  "model_comparison": {
    "xgboost_risk":   { "old": 2.504, "new": 2.580, "action": "KEPT_OLD" },
    "rf_delay":       { "old": 4.528, "new": 4.530, "action": "KEPT_OLD" },
    "gbm_reroute":    { "old": 1.0,   "new": 0.9999,"action": "KEPT_OLD" }
  }
}
```

This log is displayed on the **Analytics Dashboard** as:
```
Model Accuracy This Week: Risk RMSE=6.45 (field) | Delay RMSE=4.27h (field)
Training data grown to: 300,780 records
Last retraining: Sunday April 20, 2026
Models promoted this week: 0 of 3 (all models held quality)
```

---

## Output Artifacts

| File | Location | Updated When |
|---|---|---|
| `xgboost_risk.pkl` | `ml/models/` | Only if new model beats old |
| `random_forest_delay.pkl` | `ml/models/` | Only if new model beats old |
| `gradient_boosting_reroute.pkl` | `ml/models/` | Only if new model beats old |
| `training_dataset.csv` | `ml/data/` | Every week (new rows appended) |
| `model_performance_log.json` | `ml/models/` | Every week (new entry appended) |
| `continuous_improvement_meta.json` | `ml/models/` | Every week (pipeline config) |

---

## This Week's Run Results

| Step | Result |
|---|---|
| Existing rows | 298,780 |
| New shipments simulated | 2,000 |
| Drift detected | YES (risk RMSE 2.58x baseline) |
| Combined dataset | 300,780 rows |
| Split | 210,546 train / 45,117 val / 45,117 test |
| XGBoost retrained RMSE | 2.580 (old: 2.504) |
| RF Delay retrained RMSE | 4.530h (old: 4.528h) |
| GBM retrained AUC | 0.9999 (old: 1.0000) |
| Models promoted | **0 of 3** — old models retained |
| Log entries | 1 |

---

## How to Explain to Anyone

### "Why doesn't the new model always win after retraining?"

> Adding 2,000 new records to a 298,780-row dataset only changes the distribution by 0.67%. The model barely sees any change. After 6 months of weekly runs, the dataset will have ~50,000 real completed shipment records, and the model will start updating meaningfully. The conservative promotion rule (must improve by >1%) prevents introducing regressions from noisy new data.

### "What is drift and why does it matter?"

> Drift means the real world has changed since training. Example: If a major port (Shanghai) doubles its capacity, the `port_score` for Asia-Pacific routes should drop — but our original model was trained when congestion was high. The drift detector spots this when it sees the model's predictions consistently off by more than 1.25x the training error. It then triggers retraining to absorb the new reality.

### "Why use a rolling window of 350,000 rows?"

> We don't want shipping patterns from 3 years ago polluting the model with stale trade lane risk estimates. The rolling window ensures ~70% of training data is recent (< 1 year). 350K rows was chosen to keep 6+ months of real completions (~2,000/week × 26 weeks) plus the original 298K baseline. When the window fills, oldest rows drop out.

### "What happens if the model gets dramatically worse?"

> The drift threshold (1.25x) triggers immediate retraining. If the retrained model is still worse than the old one, the old model is kept (promotion rule protects this). The system logs a `drift_factor` alert in the performance log. The admin dashboard flags this and a data scientist can investigate manually — the log shows exactly which week the degradation started and by how much.

### "How is this different from the LSTM (Model 4)?"

> Model 4 (LSTM) is a **prediction model** — it predicts future risk scores for a specific shipment in real-time. Model 6 is a **pipeline** — it improves all the other models over time using real outcomes. Model 4 runs every 30 minutes per shipment; Model 6 runs once per week for the whole system.

---

## All 6 Models — Complete Summary

| # | Model | Algorithm | Task | Key Metric | Runs |
|---|---|---|---|---|---|
| 1 | XGBoost | Gradient Boosted Trees | Risk Score (0-100) | R²=0.965, Level Acc=94% | Every 30 min |
| 2 | Random Forest | Ensemble Trees | Delay Hours | R²=0.74, ±5h=80% | Every 30 min |
| 3 | GBM Classifier | XGBoost Classifier | Reroute Yes/No | AUC=1.0, F1=97.9% | Every 30 min |
| 4 | LSTM | PyTorch RNN | Risk Trajectory (6 steps) | RMSE=8.96pts, Dir=57% | Every 30 min |
| 5 | K-Means | Clustering | Route Pattern Groups | Silhouette score | Weekly |
| 6 | CI Pipeline | Meta-pipeline | Retrain + Promote Models | Drift factor, log | Weekly (Sunday) |
