# RouteGuard ML Models - Single Source Explainer

Last updated: 2026-04-25

This document is the single reference for:
- what data trained each model
- train/validation/testing splits
- features and targets
- accuracy metrics
- how each model output is shown to users
- what is fully implemented vs partially integrated

## 1) Canonical Model Numbering

Use this numbering everywhere in RouteGuard:

1. Model 1: XGBoost risk score prediction
2. Model 2: Random Forest delay prediction
3. Model 3: Gradient Boosting reroute decision
4. Model 4: LSTM risk trajectory forecast
5. Model 5: K-Means route clustering
6. Model 6: Continuous improvement engine

Note: some older notes swapped Model 4 and Model 5. The list above is the canonical order.

## 2) Live Inference Flow (What Runs in Production Path Today)

For active shipment monitoring and manager ML analysis:

1. Feature engineering builds weather, traffic, port, historical, cargo, and temporal features.
2. Model 1 predicts risk score.
3. Model 2 predicts delay hours, using Model 1 risk score as an input feature.
4. Model 3 predicts reroute decision/confidence using risk + delay.
5. Results are written to prediction logs and returned by shipment prediction endpoints.

Monitoring cadence is every 30 minutes by default (`MONITORING_INTERVAL_MINUTES = 30`).

## 3) Model-by-Model Detail

## Model 1 - XGBoost Risk Score

Purpose:
- Predict shipment risk score on a 0-100 scale.

Training data:
- `processed_AIS_dataset.csv` (large AIS corpus)
- sea weather distribution data
- simulated port congestion features
- engineered risk labels

Split:
- 70/15/15 train/validation/test
- train rows: 209,146
- validation rows: 44,817
- test rows: 44,817

Features:
- Core (9): `weather_score`, `traffic_score`, `port_score`, `historical_score`, `cargo_sensitivity`, `distance_remaining_km`, `time_of_day`, `day_of_week`, `season`
- Extended (5): `speed_ratio`, `heading_cog_diff`, `draft_ratio`, `ETA_hours`, `SOG_kmh`
- Total: 14 features

Target:
- `risk_score` (0-100)

Accuracy:
- RMSE: 2.5042
- MAE: 1.9965
- R2: 0.9648
- Risk-level classification accuracy: 94.04%

How users see it:
- Backend response fields:
  - `model_outputs.risk_score`
  - `model_outputs.risk_level`
  - `feature_importance.*`
- API surfaces:
  - `GET /shipments/{id}/risk`
  - `GET /shipments/{id}/prediction`
  - manager and analytics summaries derived from stored shipment risk levels
- Frontend surfaces:
  - Mission Control map and KPI cards
  - Shipment Detail risk card
  - Analytics risk distribution widgets

Implementation status:
- Fully integrated in live monitoring and manager prediction path.

## Model 2 - Random Forest Delay Prediction

Purpose:
- Predict expected shipment delay in hours.

Training data:
- same base training table as Model 1, with delay target engineering
- delay derived from AIS movement/ETA patterns and enriched risk context

Split:
- 70/15/15 train/validation/test
- train rows: 209,146
- validation rows: 44,817
- test rows: 44,817

Features:
- 15 features total
- same 14 as Model 1 plus `risk_score` from Model 1

Target:
- `delay_hours` (log1p transformed in training, expm1 at inference)

Accuracy:
- Test RMSE: 4.5282 hours
- Test MAE: 2.9707 hours
- Test R2: 0.7403
- Within 2h: 57.8%
- Within 5h: 80.48%
- Delay bucket accuracy: 67.74%

How users see it:
- Backend response field:
  - `model_outputs.predicted_delay_hr`
- API surface:
  - `GET /shipments/{id}/prediction`
- Frontend surfaces:
  - Shipment Detail "Predicted Delay" metric
  - impacts manager reroute context and alerts

Implementation status:
- Fully integrated in live monitoring and manager prediction path.

## Model 3 - Gradient Boosting Reroute Decision

Purpose:
- Decide whether manager should reroute a shipment (`REROUTE` vs `STAY`) and return confidence.

Training data:
- same training base with engineered binary target
- label rule: `risk_score >= 55 AND delay_hours >= 1.5`

Split:
- 70/15/15 train/validation/test
- train rows: 209,146
- validation rows: 44,817
- test rows: 44,817

Features:
- 11 features
- 9 core features + `risk_score` + `delay_hours`

Target:
- `reroute_label` (binary)

Accuracy:
- Accuracy: 99.85%
- Precision: 96.31%
- Recall: 99.63%
- F1: 97.94%
- AUC-ROC: 1.0000

How users see it:
- Backend response fields:
  - `model_outputs.reroute_decision`
  - `model_outputs.confidence_percent`
- API surfaces:
  - `GET /shipments/{id}/prediction`
  - `GET /shipments/{id}/routes`
  - `POST /shipments/{id}/reroute` (manager action)
- Frontend surfaces:
  - Shipment Detail "ML Decision"
  - reroute banner after approval
  - alternate route approval workflow

Implementation status:
- Fully integrated in live monitoring and manager decision path.

## Model 4 - LSTM Risk Trajectory Forecast

Purpose:
- Forecast short-term risk trajectory from recent risk history.

Training data:
- synthetic Ornstein-Uhlenbeck (OU) risk trajectories
- used because raw AIS data does not provide clean fixed-window risk sequences per vessel

Split:
- 70/15/15 train/validation/test
- training sequences: 56,000
- validation sequences: 12,000
- test sequences: 12,000

Input/output windows:
- input: last 12 risk points (6h history)
- output: next 6 risk points (3h forecast)

Accuracy:
- Test RMSE: 8.958 risk points
- Test MAE: 6.5273 risk points
- Directional accuracy: 57.14%

How users see it:
- Current backend status:
  - prediction function exists (`predict_risk_trajectory`)
  - not currently invoked by `run_complete_ml_pipeline`
  - not currently exposed in prediction API response
- Current frontend status:
  - a trajectory graph component exists
  - it is not currently wired into manager pages

Implementation status:
- Trained artifact exists, but currently not active in live API/UI workflow.

## Model 5 - K-Means Route Clustering

Purpose:
- Group route corridors into behavior clusters and apply historical risk adjustments.

Training data:
- route-level aggregates (67 route groups)
- derived from shipment/prediction history

Split:
- 70/15/15 fit/validation/test (route-level)
- fit routes: 46
- validation routes: 10
- test routes: 11

Features:
- `avg_weather_score`
- `avg_port_score`
- `avg_traffic_score`
- `avg_delay_hours`
- `avg_risk_score`
- `risk_std_dev`

Model quality:
- Optimal clusters: K=4
- Silhouette (fit): 0.2502
- Silhouette (validation): 0.2607
- Silhouette (test): 0.3325
- Davies-Bouldin (test): 0.7613

How users see it:
- Intended: cluster label and route historical adjustment should influence risk inputs.
- Current implementation reality:
  - live feature engineering currently computes `historical_score` from recent actual delays
  - K-Means adjustment is not currently injected into live risk pipeline
  - clustering scheduler code exists but is not started in application startup

Implementation status:
- Trained assets and clustering logic exist, but integration into live risk scoring is partial/incomplete.

## Model 6 - Continuous Improvement Engine

Purpose:
- Weekly retraining/drift monitoring for core supervised models (Models 1-3).

Data behavior:
- appends new completed shipment outcomes
- uses rolling training window (up to 350k rows)
- evaluates drift and retrains candidate models

Policy and thresholds:
- schedule target: weekly (Sunday night)
- drift threshold multiplier: 1.25
- promotion logic in metadata:
  - XGBoost: new RMSE must improve by >1%
  - Random Forest: new RMSE must improve by >1%
  - Gradient Boosting: new AUC must improve

Current recorded weekly run:
- new rows added: 2,000
- drift triggered: yes (risk drift factor 2.576)
- actions: all old models kept (new candidates did not beat incumbents)

How users see it:
- No direct manager UI card for CI pipeline state yet.
- Analytics accuracy endpoint reads Model 1-3 meta metrics, not full weekly CI history.

Implementation status:
- CI metadata and retraining modules exist.
- Main app startup currently starts only the monitoring scheduler, so retraining/clustering are not active by default in the running app lifecycle.

## 4) Train/Validation/Test Dataset Exports (Per Model)

Dataset export status:
- Per-model split files are present under `ml/datasets`.
- Structure:
  - `ml/datasets/train/modelX_*/data.csv`
  - `ml/datasets/validation/modelX_*/data.csv`
  - `ml/datasets/testing/modelX_*/data.csv`

What each model split contains:
- Model 1: supervised risk regression dataset
- Model 2: supervised delay regression dataset (with risk feature)
- Model 3: supervised reroute classification dataset
- Model 4: sequence dataset for LSTM input/output windows
- Model 5: route-level aggregate clustering dataset
- Model 6: weekly-update style dataset for continuous improvement simulation

## 5) One-Glance Matrix: Data, Features, Accuracy, User Visibility

| Model | Data source type | Feature count | Primary metric | User-visible today? | Where shown |
|---|---|---:|---|---|---|
| 1. XGBoost Risk | AIS + weather + port + engineered labels | 14 | RMSE 2.5042, R2 0.9648 | Yes | Mission Control, Shipment Detail, Analytics |
| 2. RF Delay | Same base + risk feature | 15 | MAE 2.9707h, RMSE 4.5282h | Yes | Shipment Detail predicted delay |
| 3. GB Reroute | Same base + risk + delay | 11 | AUC 1.0, F1 97.94% | Yes | Shipment Detail decision, reroute flow |
| 4. LSTM Trajectory | Synthetic OU sequences | sequence model | RMSE 8.958 | Not yet | Not currently surfaced in live UI |
| 5. K-Means Clusters | Route aggregates | 6 | Silhouette test 0.3325 | Not yet | Not currently surfaced in live UI |
| 6. Continuous Improvement | Weekly merged training window | pipeline-level | Drift/promotion policy | Partial | Indirect via static analytics metrics |

## 6) Final Answer to "Does This Doc Explain Everything?"

Yes, this version now includes all required items in one place:
- each model explanation
- exact training/validation/testing setup
- key features and targets
- accuracy/performance metrics
- explicit mapping from model output to API fields and manager UI visibility
- clear separation of fully deployed vs partially integrated components

If you want, this can be further extended with:
- direct file/line traceability for each claim
- a model governance section (owner, retrain date, rollback procedure)
- a release checklist for enabling Model 4 and Model 5 in live workflow
