# RouteGuard Dataset, Feature, and Model Usage Guide

## 1. Purpose

This document defines:

- Which datasets are currently available in this project.
- Which fields are useful for RouteGuard ML features.
- Which features are required by each model.
- What cleaning and preprocessing is required before training/inference.
- What data gaps still exist.


## 2. Current Dataset Inventory

### 2.1 Datasets under ml/data

| Dataset Folder | Main File(s) | Rows | Status | Primary Use |
|---|---|---:|---|---|
| eminserkanerdonmez__ais-dataset | ais_data.csv | 358351 | Usable | Vessel movement signals (speed, heading, draught, vessel profile basics) |
| satyamrajput7913__ais-ship-tracking-vessel-dynamics-and-eta-data | processed_AIS_dataset.csv | 1098966 | Usable | Primary AIS + ETA features for movement and delay proxies |
| ibrahimonmars__global-cargo-ships-dataset | Cleaned_ships_data.csv, Ship_Uncleaned.csv, Port_locations.csv | 200, 4000, 5856 | Usable with cleaning | Vessel metadata enrichment and port lookup |
| mexwell__world-port-index | UpdatedPub150.csv | 3824 | Usable | Detailed port characteristics and constraints |
| rajkumarpandey02__world-wide-port-index-data | World_Port_Index.csv | 3630 | Usable | Alternate port index with coordinates and operations fields |
| tayljordan__ports | ports.json | 3898 | Usable | Port coordinate master list |
| saurabhshahane__sea-forecast-and-waves-classification | hour_forecast.csv, tide.csv, day_forecast.csv, spot/beach/fact_* | 19680, 3420, 820, etc. | Usable | Weather and marine-condition feature generation |
| nelgiriyewithana__indian-weather-repository-daily-snapshot | (empty) | 0 | Not usable | No files present |

Important format note:

- Multiple files in saurabhshahane__sea-forecast-and-waves-classification are semicolon-delimited.


### 2.2 Files under backend/data

| File | Status | Notes |
|---|---|---|
| ports_seed_data.json | Not usable | Placeholder content, not valid JSON |
| simulated_ais_stream.json | Not usable | Placeholder content, not valid JSON |
| synthetic_training_data.csv | Not usable | Placeholder line only, zero real rows |
| vessels_seed_data.json | Not usable | Placeholder content, not valid JSON |

Conclusion:

- Training data should be built from ml/data, not backend/data placeholders.


## 3. Actual Model Feature Requirements in Code

The runtime feature engineering and model inputs come from these files:

- backend/app/services/feature_engine.py
- backend/app/services/ml_service.py
- backend/app/background/retraining_job.py
- backend/app/ml/feature_builder.py


### 3.1 Core feature vector (9 features)

1. weather_score
2. traffic_score
3. port_score
4. historical_score
5. cargo_sensitivity
6. distance_remaining
7. time_of_day
8. day_of_week
9. season


### 3.2 Model-specific required inputs and targets

| Model | Type | Inputs | Target |
|---|---|---|---|
| XGBoost risk model | Regression | Core 9 features | risk_score |
| Random Forest delay model | Regression | Core 9 + risk_score + traffic_score + buffer_time_hours | actual_delay_hr |
| Gradient Boosting reroute model | Classification | Core 9 + risk_score + delay_hours + risk_trend | reroute_decision (0/1) |
| LSTM trajectory model | Sequence forecasting | Last 12 risk scores | next risk sequence |

Note:

- In fallback mode (when model artifacts are missing), backend uses rule/heuristic predictions.


## 4. Dataset to Feature Mapping

### 4.1 AIS and vessel dynamics datasets

Primary sources:

- satyamrajput7913__ais-ship-tracking-vessel-dynamics-and-eta-data/processed_AIS_dataset.csv
- eminserkanerdonmez__ais-dataset/ais_data.csv

Important columns seen:

- LAT, LON, BaseDateTime, SOG, COG, Heading, Draft, VesselType, Status, ETA_hours, dist_km
- mmsi, sog, cog, heading, draught, shiptype, width, length

Used for:

- distance_remaining (from route destination coordinates and current LAT/LON)
- time_of_day, day_of_week, season (from BaseDateTime)
- historical_score candidate aggregation (route-level delay patterns)
- optional movement quality features for future upgrades (speed anomalies, heading shifts)


### 4.2 Weather and marine datasets

Primary source:

- saurabhshahane__sea-forecast-and-waves-classification/hour_forecast.csv

Important columns seen:

- temperature, windspeed, winddirdegree, preciptation, humidity, pressure, cloundover, sigheight, swellheight, swelldir, period, watertemp

Supporting tables:

- tide.csv, day_forecast.csv, sea_condition_fact.csv

Used for:

- weather_score (storm/wind/rain visibility proxies)
- marine risk proxy for weather-sensitive segments
- potential future richer weather feature engineering for LSTM/explainability


### 4.3 Port datasets

Primary sources:

- mexwell__world-port-index/UpdatedPub150.csv
- rajkumarpandey02__world-wide-port-index-data/World_Port_Index.csv
- tayljordan__ports/ports.json
- ibrahimonmars__global-cargo-ships-dataset/Port_locations.csv

Important columns seen:

- UN/LOCODE or locode, Main Port Name/PORT_NAME, Country, LATITUDE/LONGITUDE, channel depth, max vessel draft, harbor type, restrictions, facilities

Used for:

- port_score feature generation (congestion/risk proxies)
- route-port enrichment and destination metadata joins
- plausibility checks (draft vs port constraints)


### 4.4 Cargo and vessel profile datasets

Primary source:

- ibrahimonmars__global-cargo-ships-dataset/Cleaned_ships_data.csv (and Ship_Uncleaned.csv)

Important columns seen:

- Company_Name, ship_name, built_year, gt, dwt, length, width

Used for:

- vessel/cargo profile enrichment for cargo_sensitivity and delay behavior context
- plausibility checks in data quality layer


## 5. Cleaning and Preprocessing Requirements

This section is mandatory before model training.


### 5.1 Global standardization

- Convert all column names to lowercase snake_case.
- Normalize all timestamps to UTC.
- Use consistent coordinate names: lat, lon.
- Normalize identifiers (mmsi as string, imo as string, locode uppercase).


### 5.2 Delimiter and encoding handling

- Detect delimiter per file (comma vs semicolon).
- Decode using utf-8 first, then utf-8-sig/latin-1 fallback when needed.


### 5.3 Missing value strategy

- Critical fields drop rule:
  - AIS: lat, lon, basedatetime missing -> drop row
  - Weather: time and core weather metrics missing -> drop row
  - Ports: locode and coordinates missing -> drop row
- Non-critical numeric fields:
  - Impute median by vessel_type or port region where appropriate.


### 5.4 Outlier and validity rules

- Coordinates:
  - lat in [-90, 90], lon in [-180, 180]
- Speed:
  - clamp obvious AIS noise (for ocean cargo, practical sog range usually 0-35 knots)
- Heading/cog:
  - normalize to [0, 360)
- Wave/meteorological values:
  - remove impossible negatives for physical quantities that cannot be negative


### 5.5 Unit harmonization

- Convert knots to km/h only when a downstream feature explicitly expects km/h.
- Keep one canonical unit table for every derived feature.


### 5.6 De-duplication

- AIS dedup key recommendation:
  - (mmsi, basedatetime, lat, lon)
- Weather dedup key recommendation:
  - (iddayforecast, time) or (location_id, timestamp)
- Port dataset dedup key recommendation:
  - locode as primary key, choose freshest/best-quality record when duplicates exist


### 5.7 Dataset joins to build training set

Recommended join flow:

1. AIS stream as base timeline.
2. Join nearest weather snapshot by time and location window.
3. Join destination port metadata by locode or mapped port name.
4. Join vessel profile by vessel identifier (mmsi/imo/name fallback mapping).
5. Build derived features -> final training matrix.


### 5.8 Label engineering requirements

Current code expects labels for retraining from model_predictions table:

- risk_score
- actual_delay_hr
- reroute_decision (0/1)

If training directly from raw datasets, create these labels explicitly:

- risk_score: from known events or engineered supervision rules.
- actual_delay_hr: from ETA vs actual arrival deltas.
- reroute_decision: from decision logs or deterministic policy labels.


## 6. Recommended Prepared Data Outputs

Create curated output files/tables:

- silver_ais_clean
- silver_weather_clean
- silver_ports_clean
- gold_training_features

gold_training_features minimum schema:

- weather_score
- traffic_score
- port_score
- historical_score
- cargo_sensitivity
- distance_remaining
- time_of_day
- day_of_week
- season
- risk_score (label)
- actual_delay_hr (label)
- buffer_time_hours
- risk_trend
- reroute_decision (label)


## 7. Current Gaps to Resolve

1. Indian weather dataset folder is empty and cannot be used.
2. backend/data files are placeholders and cannot be used as training data.
3. Some training scripts under ml/scripts are scaffolds and do not implement full pipelines yet.


## 8. Practical Usage by Model (Quick Reference)

### XGBoost risk

- Needs clean Core 9 features.
- Strong dependency on weather_score and port_score quality.


### Random Forest delay

- Needs Core 9 + risk_score + buffer_time_hours.
- Delay label quality (actual_delay_hr) is critical.


### Gradient Boosting reroute

- Needs Core 9 + risk_score + delay_hours + risk_trend.
- Class balance for reroute_decision should be checked before training.


### LSTM trajectory

- Needs consistently sampled recent risk score sequence (length 12 in current code path).
- Time index continuity and gap handling are mandatory.


## 9. Implementation Checklist

- Build one cleaning pipeline per source family (AIS, weather, ports, vessel).
- Build one feature assembly pipeline to produce gold_training_features.
- Validate schema against model requirements before training.
- Add row-level and distribution-level quality checks.
- Persist cleaned datasets and keep reproducible data version tags.
