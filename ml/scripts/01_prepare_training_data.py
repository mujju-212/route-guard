"""
RouteGuard ML - Step 1: Data Preparation & Feature Engineering
==============================================================
This script builds the complete training dataset for:
  - Model 1: XGBoost Risk Score Predictor
  - Model 2: Random Forest Delay Predictor

Data Sources Used:
  1. satyamrajput7913/processed_AIS_dataset.csv  -- 1.1M real AIS ship tracking records
     Fields: MMSI, LAT, LON, SOG_kmh, ETA_hours, dist_km, VesselType, Cargo,
             Status, dest_cluster, Heading, COG, Draft
  2. saurabhshahane/hour_forecast.csv            -- 19,680 sea weather observations
     Fields: windspeed, sigheight (wave height), swellheight, precipitation, humidity
  3. Synthetic scenario injection for realistic class distribution
     -- 20% storm events, 15% port crisis, 10% traffic incidents

Missing Data Strategies:
  - "actual delay"   : computed from AIS snapshot (dist_km / SOG_kmh - ETA_hours)
                       + exponential port-wait noise (mean 3h) per real port studies
  - "port congestion": simulated from dest_cluster regional patterns (WPI data informed)
  - "high risk labels": 25% of data replaced with injected storm/crisis scenarios
                       to ensure balanced training across all risk levels
  - "reroute label"  : rule-engineered from risk_score >= 65 AND delay >= 3h
"""

import pandas as pd
import numpy as np
import os
import json

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR    = os.path.join(BASE_DIR, "data")
MODELS_DIR  = os.path.join(BASE_DIR, "models")

AIS_PATH    = os.path.join(DATA_DIR, "satyamrajput7913__ais-ship-tracking-vessel-dynamics-and-eta-data", "processed_AIS_dataset.csv")
SEA_PATH    = os.path.join(DATA_DIR, "saurabhshahane__sea-forecast-and-waves-classification", "hour_forecast.csv")
OUT_PATH    = os.path.join(DATA_DIR, "training_dataset.csv")
STATS_PATH  = os.path.join(DATA_DIR, "weather_distribution_stats.json")

os.makedirs(MODELS_DIR, exist_ok=True)

print("=" * 65)
print("  RouteGuard -- Training Data Preparation")
print("=" * 65)

np.random.seed(42)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 -- Load & clean AIS data (real vessel tracking)
# ══════════════════════════════════════════════════════════════════════════════
print("\n[1/7] Loading AIS ship tracking data (241 MB) ...")

chunks = []
for chunk in pd.read_csv(AIS_PATH, chunksize=200_000, low_memory=False):
    chunk = chunk.dropna(subset=["SOG_kmh", "ETA_hours", "dist_km", "LAT", "LON"])
    chunk = chunk[chunk["ETA_hours"] < 72]
    chunk = chunk[(chunk["dist_km"] > 5)  & (chunk["dist_km"] < 15000)]
    chunk = chunk[(chunk["SOG_kmh"]  >= 0) & (chunk["SOG_kmh"]  < 100)]
    chunks.append(chunk)

ais = pd.concat(chunks, ignore_index=True)
print(f"    AIS rows after filtering: {len(ais):,}")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 -- Load sea/weather data & extract distribution stats
# ══════════════════════════════════════════════════════════════════════════════
print("\n[2/7] Loading sea forecast data ...")

sea = pd.read_csv(SEA_PATH, sep=";", low_memory=False)
sea = sea.dropna(subset=["windspeed", "sigheight", "swellheight", "preciptation", "humidity"])

weather_stats = {
    "windspeed_mean":   float(sea["windspeed"].mean()),
    "windspeed_std":    float(sea["windspeed"].std()),
    "sigheight_mean":   float(sea["sigheight"].mean()),
    "sigheight_std":    float(sea["sigheight"].std()),
    "swellheight_mean": float(sea["swellheight"].mean()),
    "swellheight_std":  float(sea["swellheight"].std()),
    "precip_mean":      float(sea["preciptation"].mean()),
    "precip_std":       float(sea["preciptation"].std()),
    "humidity_mean":    float(sea["humidity"].mean()),
    "humidity_std":     float(sea["humidity"].std()),
    "pressure_mean":    float(sea["pressure"].mean()),
    "pressure_std":     float(sea["pressure"].std()),
}
print(f"    Sea observations: {len(sea):,}")
print(f"    Avg wave height: {weather_stats['sigheight_mean']:.2f}m | Avg wind: {weather_stats['windspeed_mean']:.1f} km/h")
print("    NOTE: Real beach data is mostly calm -- storm scenarios injected in step 5.")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 -- Feature Engineering from AIS
# ══════════════════════════════════════════════════════════════════════════════
print("\n[3/7] Engineering features from AIS data ...")

N = len(ais)

# -- 3a. Vessel type -> cargo sensitivity (0-100) ----------------------------
def vessel_to_sensitivity(vtype):
    try:
        vtype = int(float(vtype))
    except (ValueError, TypeError):
        return 40.0
    if 80 <= vtype <= 89:   return np.random.uniform(75, 95)  # Tanker
    elif 70 <= vtype <= 79: return np.random.uniform(40, 70)  # Cargo
    elif 60 <= vtype <= 69: return np.random.uniform(20, 40)  # Passenger
    elif 30 <= vtype <= 39: return np.random.uniform(10, 30)  # Fishing
    else:                   return np.random.uniform(30, 60)  # General

ais["cargo_sensitivity"] = ais["VesselType"].apply(vessel_to_sensitivity)

# -- 3b. Speed metrics -------------------------------------------------------
ais["expected_speed_kmh"] = (ais["dist_km"] / ais["ETA_hours"].clip(lower=0.1))
ais["speed_ratio"]        = (ais["SOG_kmh"] / ais["expected_speed_kmh"].clip(lower=0.1)).clip(0, 2)

# Projected delay: if vessel is slower than planned, how many extra hours?
# AIS SOG is an instantaneous snapshot. If a vessel is going at half speed now,
# it will take double the planned time => delay = ETA_hours * (1/speed_ratio - 1)
speed_ratio_safe            = ais["speed_ratio"].clip(lower=0.05)
projected_total_hours       = (ais["ETA_hours"] / speed_ratio_safe).clip(upper=ais["ETA_hours"] * 6)
ais["actual_delay_hours"]   = (projected_total_hours - ais["ETA_hours"]).clip(lower=0)

# Add realistic port wait time noise (exponential: most waits short, some very long)
# Source: Port Economics studies show avg port wait = 12-24h for congested ports,
# 1-3h for uncongested. We use mean=3h as baseline, elevated by cluster.
port_wait_noise             = np.random.exponential(scale=3.0, size=N)
ais["actual_delay_hours"]   = (ais["actual_delay_hours"] + port_wait_noise).clip(0, 72)

print(f"    Delay range: {ais['actual_delay_hours'].min():.1f} - {ais['actual_delay_hours'].max():.1f} hrs")
print(f"    Vessels with delay > 2h:  {(ais['actual_delay_hours'] > 2).sum():,}")
print(f"    Vessels with delay > 10h: {(ais['actual_delay_hours'] > 10).sum():,}")

# -- 3c. Time features -------------------------------------------------------
ais["BaseDateTime"] = pd.to_datetime(ais["BaseDateTime"], errors="coerce")
ais["time_of_day"]  = ais["BaseDateTime"].dt.hour.fillna(12).astype(int)
ais["day_of_week"]  = ais["BaseDateTime"].dt.dayofweek.fillna(2).astype(int)

def month_to_season(m):
    if m in [12, 1, 2]:  return 1   # Winter
    elif m in [3, 4, 5]: return 2   # Spring
    elif m in [6, 7, 8]: return 3   # Summer
    else:                return 4   # Fall

ais["season"] = ais["BaseDateTime"].dt.month.apply(
    lambda m: month_to_season(m) if pd.notna(m) else 3)

# -- 3d. Heading vs COG difference (environmental resistance) ----------------
ais["heading_cog_diff"] = (ais["Heading"] - ais["COG"]).abs().fillna(0)
ais["heading_cog_diff"] = ais["heading_cog_diff"].apply(lambda x: min(x, 360 - x))

# -- 3e. Draft ratio (vessel load factor) ------------------------------------
max_draft = ais["Draft"].clip(lower=0.1).max()
ais["draft_ratio"] = (ais["Draft"] / max_draft).fillna(0.5).clip(0, 1)

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 -- Simulate weather, port & traffic scores (normal conditions)
# ══════════════════════════════════════════════════════════════════════════════
print("\n[4/7] Simulating normal-condition weather, port & traffic scores ...")

# -- 4a. Normal weather score ------------------------------------------------
# The real sea dataset captures calm coastal conditions (avg wave 0.74m).
# Normal-condition weather score is thus mostly LOW (0-25).
# Storm scenarios are injected separately in Step 5.
def weather_score_normal(n):
    """Calm-to-moderate weather: most voyages have low weather risk."""
    wind  = np.abs(np.random.normal(18, 12, n))          # km/h, calm baseline
    wave  = np.abs(np.random.normal(0.9, 0.7, n))         # meters, calm baseline
    swell = np.abs(np.random.normal(0.6, 0.4, n))         # meters
    prec  = np.abs(np.random.normal(1.0, 2.5, n))         # mm

    score = np.zeros(n)
    score += np.where(wind > 90, 50, np.where(wind > 70, 35,
             np.where(wind > 50, 20, np.where(wind > 30, 10, 0))))
    score += np.where(wave > 4, 40, np.where(wave > 3, 25,
             np.where(wave > 2, 10, np.where(wave > 1.5, 5, 0))))
    score += np.where(swell > 3, 15, np.where(swell > 2, 7, 0))
    score += np.where(prec > 10, 20, np.where(prec > 5, 10, 0))
    return score.clip(0, 100)

ais["weather_score"] = weather_score_normal(N)

# -- 4b. Port congestion score (cluster-informed) ----------------------------
# Regional congestion levels from World Port Index & shipping literature:
# Asia-Pacific (cluster 7): 60-85 (Shanghai, Singapore, Busan historically congested)
# US Gulf (cluster 2):      45-70 (Houston port delays)
# US West Coast (cluster 1): 40-65 (LA/LB 2021 crisis)
cluster_congestion = {
    0: (30, 15),   # Pacific NW -- moderate
    1: (50, 18),   # US West Coast -- high (LA/LB)
    2: (52, 17),   # US Gulf -- medium-high
    3: (28, 14),   # US East Coast North -- low-medium
    4: (48, 16),   # US East Coast South -- medium
    5: (58, 18),   # South America -- high
    6: (38, 14),   # Europe North Sea -- medium
    7: (68, 15),   # Asia Pacific -- very high
    8: (32, 13),   # Mediterranean -- moderate
    9: (44, 16),   # Indian Ocean/Middle East -- medium-high
}

def port_score_from_cluster(cluster_val):
    try:
        key = int(float(cluster_val))
    except (ValueError, TypeError):
        key = 5
    mean, std = cluster_congestion.get(key, (40, 15))
    return float(np.clip(np.random.normal(mean, std), 0, 100))

ais["port_score"] = ais["dest_cluster"].apply(port_score_from_cluster)

# -- 4c. Traffic score (correlated with port + time-of-day) ------------------
rush_factor         = ais["time_of_day"].apply(
    lambda h: 18 if 7 <= h <= 9 or 16 <= h <= 19 else 0)
ais["traffic_score"] = (
    ais["port_score"] * 0.55
    + rush_factor
    + np.random.normal(0, 10, N)
).clip(0, 100)

# -- 4d. Historical route risk ------------------------------------------------
# Routes with past delays score higher historically
hist_from_delay      = (ais["actual_delay_hours"] * 3.5).clip(0, 60)
ais["historical_score"] = (hist_from_delay + np.random.normal(0, 12, N)).clip(0, 100)

# -- 4e. Distance remaining ---------------------------------------------------
ais["distance_remaining_km"] = ais["dist_km"]

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 -- Scenario Injection for Balanced Risk Distribution
# ══════════════════════════════════════════════════════════════════════════════
print("\n[5/7] Injecting storm/crisis scenarios for balanced risk distribution ...")
print("    Target distribution: ~30% low | ~30% medium | ~25% high | ~15% critical")

# Without injection, all data is calm => all risk LOW.
# Real shipping faces: typhoons, port strikes, traffic pile-ups, dangerous cargo incidents.
# We inject these as percentage-based scenario overrides.

idx = np.arange(N)
np.random.shuffle(idx)

# Scenario 1: Storm events (15% of data) -- weather_score 65-100
storm_idx    = idx[:int(0.15 * N)]
ais.iloc[storm_idx, ais.columns.get_loc("weather_score")] = np.random.uniform(60, 100, len(storm_idx))

# Scenario 2: Port crisis events (12% of data) -- port_score 72-100, traffic 60-90
port_idx     = idx[int(0.15 * N):int(0.27 * N)]
ais.iloc[port_idx, ais.columns.get_loc("port_score")]   = np.random.uniform(70, 100, len(port_idx))
ais.iloc[port_idx, ais.columns.get_loc("traffic_score")] = np.random.uniform(60, 95, len(port_idx))

# Scenario 3: Heavy cargo incidents (8% of data) -- cargo_sensitivity 80-100
cargo_idx    = idx[int(0.27 * N):int(0.35 * N)]
ais.iloc[cargo_idx, ais.columns.get_loc("cargo_sensitivity")] = np.random.uniform(78, 100, len(cargo_idx))

# Scenario 4: Combined moderate stress (10% of data) -- all scores medium-high
combo_idx    = idx[int(0.35 * N):int(0.45 * N)]
ais.iloc[combo_idx, ais.columns.get_loc("weather_score")]    = np.random.uniform(35, 65, len(combo_idx))
ais.iloc[combo_idx, ais.columns.get_loc("port_score")]       = np.random.uniform(50, 75, len(combo_idx))
ais.iloc[combo_idx, ais.columns.get_loc("traffic_score")]    = np.random.uniform(45, 70, len(combo_idx))

# Update historical_score for injected high-risk rows to be consistent
# (a route that is in a storm now has historically been problematic)
all_injected = np.concatenate([storm_idx, port_idx, cargo_idx, combo_idx])
for i in all_injected:
    current_hist = ais.iloc[i]["historical_score"]
    ais.iloc[i, ais.columns.get_loc("historical_score")] = min(current_hist * 1.5 + 10, 100)

# Also increase delay for storm/port crisis rows -- storms cause 8-36h delays
ais.iloc[storm_idx, ais.columns.get_loc("actual_delay_hours")] = np.random.uniform(8, 36, len(storm_idx))
ais.iloc[port_idx,  ais.columns.get_loc("actual_delay_hours")] = np.random.uniform(6, 28, len(port_idx))

print(f"    Storm events injected:       {len(storm_idx):,} rows ({len(storm_idx)/N*100:.0f}%)")
print(f"    Port crisis injected:        {len(port_idx):,} rows ({len(port_idx)/N*100:.0f}%)")
print(f"    Cargo incident injected:     {len(cargo_idx):,} rows ({len(cargo_idx)/N*100:.0f}%)")
print(f"    Combined stress injected:    {len(combo_idx):,} rows ({len(combo_idx)/N*100:.0f}%)")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 -- Compute target labels
# ══════════════════════════════════════════════════════════════════════════════
print("\n[6/7] Computing target labels ...")

# -- Label 1: risk_score (0-100) -- weighted combination of all risk factors --
w_weather   = 0.30
w_port      = 0.25
w_traffic   = 0.15
w_history   = 0.15
w_cargo     = 0.10
w_speed_ano = 0.05

speed_anomaly_score = ((1 - ais["speed_ratio"].clip(0, 1)) * 100)

ais["risk_score"] = (
    w_weather   * ais["weather_score"]
    + w_port    * ais["port_score"]
    + w_traffic * ais["traffic_score"]
    + w_history * ais["historical_score"]
    + w_cargo   * ais["cargo_sensitivity"]
    + w_speed_ano * speed_anomaly_score
).clip(0, 100)

# Small calibration noise to prevent perfect linear separability
ais["risk_score"] = (ais["risk_score"] + np.random.normal(0, 2.5, N)).clip(0, 100)

# -- Label 2: delay_hours (regression target) ---------------------------------
ais["delay_hours"] = ais["actual_delay_hours"].clip(0, 72)

# -- Label 3: reroute_recommended (binary) ------------------------------------
ais["reroute_recommended"] = (
    (ais["risk_score"] >= 65) & (ais["delay_hours"] >= 3.0)
).astype(int)

# -- Risk level bucket --------------------------------------------------------
def risk_to_level(r):
    if r < 30: return "low"
    if r < 55: return "medium"
    if r < 75: return "high"
    return "critical"

ais["risk_level"] = ais["risk_score"].apply(risk_to_level)

print(f"    Risk distribution after injection:")
print(f"      Low      (<30):  {(ais['risk_score'] < 30).sum():,}")
print(f"      Medium (30-55):  {((ais['risk_score'] >= 30) & (ais['risk_score'] < 55)).sum():,}")
print(f"      High   (55-75):  {((ais['risk_score'] >= 55) & (ais['risk_score'] < 75)).sum():,}")
print(f"      Critical (>=75): {(ais['risk_score'] >= 75).sum():,}")
print(f"    Reroute = 1: {ais['reroute_recommended'].sum():,} ({ais['reroute_recommended'].mean()*100:.1f}%)")
print(f"    Avg delay:   {ais['delay_hours'].mean():.2f}h  |  Max: {ais['delay_hours'].max():.1f}h")

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 -- Select final columns & save
# ══════════════════════════════════════════════════════════════════════════════
print("\n[7/7] Saving training dataset ...")

FEATURE_COLS = [
    # 9 Core features (must match production feature_engine.py exactly)
    "weather_score",
    "traffic_score",
    "port_score",
    "historical_score",
    "cargo_sensitivity",
    "distance_remaining_km",
    "time_of_day",
    "day_of_week",
    "season",
    # Extended features (training only -- improve accuracy)
    "speed_ratio",
    "heading_cog_diff",
    "draft_ratio",
    "ETA_hours",
    "SOG_kmh",
    "expected_speed_kmh",
    # Target labels
    "risk_score",
    "delay_hours",
    "reroute_recommended",
    "risk_level",
]

final_df = ais[FEATURE_COLS].dropna()
print(f"    Final dataset rows: {len(final_df):,}")

final_df.to_csv(OUT_PATH, index=False)
print(f"    Saved -> {OUT_PATH}")

with open(STATS_PATH, "w") as f:
    json.dump(weather_stats, f, indent=2)
print(f"    Weather stats saved -> {STATS_PATH}")

print("\n" + "=" * 65)
print("  DATASET SUMMARY")
print("=" * 65)
print(f"  Total training samples   : {len(final_df):,}")
print(f"  Feature columns (core 9) : 9 + 6 extended = 15 total")
print(f"  Target labels            : risk_score, delay_hours, reroute_recommended")
rs = final_df["risk_score"]
dh = final_df["delay_hours"]
print(f"  Risk score  - mean: {rs.mean():.1f}  std: {rs.std():.1f}  min: {rs.min():.1f}  max: {rs.max():.1f}")
print(f"  Delay hours - mean: {dh.mean():.2f}h  std: {dh.std():.2f}h  max: {dh.max():.1f}h")
print(f"  Reroute +ve : {final_df['reroute_recommended'].mean()*100:.1f}%")
print("=" * 65)
print("\n  Done. Data preparation complete. Run 02_train_xgboost.py next.\n")
