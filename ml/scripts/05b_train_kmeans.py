"""
RouteGuard ML - Model 5: K-Means Route Pattern Clustering
==========================================================
Task:   Unsupervised clustering of shipping routes into behavior archetypes.
        Groups routes by risk patterns so that 'historical_score' in the
        feature engine becomes route-aware, not just generic.

Cluster archetypes (learned from data, labeled post-hoc):
  - Always Reliable     : consistently low risk, low delay
  - Weather Sensitive   : high weather variance, moderate-high risk
  - Port Congestion     : high port_score, moderate delay
  - High Risk / Problem : elevated risk + delay across all factors

Input features (6 route-behavior features):
  avg_weather_score, avg_port_score, avg_traffic_score,
  avg_delay_hours, avg_risk_score, risk_std_dev
  (These summarise a route's historical behavior)

Output:
  - cluster_id (0..K-1) per route
  - cluster_profile dict  (mean of each feature per cluster)
  - cluster_label (human-readable archetype name)
  - historical_score adjustment (+/- points to feed back into Model 1)

Split strategy (adapted for unsupervised):
  70% fit  : K-Means fits cluster centres on this partition
  15% val  : silhouette score computed to validate cluster quality
  15% test : held-out evaluation -- cluster assignment consistency check

Saved artifacts:
  models/kmeans_route_clusters.pkl       <- fitted KMeans model
  models/kmeans_scaler.pkl               <- StandardScaler (must apply before predict)
  models/kmeans_route_clusters_meta.json <- cluster profiles, labels, metrics
"""

import os, json, warnings
import numpy as np
import pandas as pd
import joblib
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, davies_bouldin_score
from sklearn.model_selection import train_test_split
warnings.filterwarnings("ignore")

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR   = os.path.join(BASE_DIR, "data")
MODELS_DIR = os.path.join(BASE_DIR, "models")
DATA_PATH  = os.path.join(DATA_DIR, "training_dataset.csv")
MODEL_PATH = os.path.join(MODELS_DIR, "kmeans_route_clusters.pkl")
SCALER_PATH= os.path.join(MODELS_DIR, "kmeans_scaler.pkl")
META_PATH  = os.path.join(MODELS_DIR, "kmeans_route_clusters_meta.json")
os.makedirs(MODELS_DIR, exist_ok=True)

np.random.seed(42)

print("=" * 65)
print("  RouteGuard - Model 5: K-Means Route Pattern Clustering")
print("=" * 65)

# ═══════════════════════════════════════════════════════════════════════
# STEP 1 — Load training data & build route-level aggregations
# ═══════════════════════════════════════════════════════════════════════
print("\n[1/7] Loading training data & aggregating route-level features ...")

df = pd.read_csv(DATA_PATH)
print(f"    Raw rows loaded: {len(df):,}")

# K-Means clusters ROUTES, not individual shipment snapshots.
# We create route summaries using dest_cluster as a route proxy,
# combined with season (different seasons = different route behaviour).
# Each (dest_cluster, season, cargo_band) triplet = one "route archetype".

# Re-load AIS for dest_cluster if not in training set
if "dest_cluster" not in df.columns:
    # Build a synthetic route_id using binned distance and time-of-day as proxy
    df["route_id"] = (
        pd.cut(df["distance_remaining_km"], bins=10, labels=False).astype(str)
        + "_" + df["season"].astype(str)
        + "_" + pd.cut(df["cargo_sensitivity"], bins=5, labels=False).astype(str)
    )
else:
    df["route_id"] = (
        df["dest_cluster"].astype(str)
        + "_s" + df["season"].astype(str)
        + "_c" + pd.cut(df["cargo_sensitivity"], bins=5, labels=False).fillna(2).astype(int).astype(str)
    )

# Aggregate per route: mean and std of key risk/delay indicators
route_agg = df.groupby("route_id").agg(
    avg_weather_score  = ("weather_score",  "mean"),
    avg_port_score     = ("port_score",     "mean"),
    avg_traffic_score  = ("traffic_score",  "mean"),
    avg_delay_hours    = ("delay_hours",    "mean"),
    avg_risk_score     = ("risk_score",     "mean"),
    risk_std_dev       = ("risk_score",     "std"),
    shipment_count     = ("risk_score",     "count"),
    avg_cargo_sens     = ("cargo_sensitivity", "mean"),
).reset_index()

# Only keep routes with enough records for reliable aggregation
route_agg = route_agg[route_agg["shipment_count"] >= 5].dropna()
print(f"    Route archetypes (with >= 5 records): {len(route_agg):,}")
print(f"    Features per route: 6 core + route_id + shipment_count")

# ═══════════════════════════════════════════════════════════════════════
# STEP 2 — Feature selection for clustering
# ═══════════════════════════════════════════════════════════════════════
print("\n[2/7] Preparing clustering features ...")

CLUSTER_FEATURES = [
    "avg_weather_score",   # how severe is weather on this route?
    "avg_port_score",      # how congested are destination ports?
    "avg_traffic_score",   # how bad is traffic on this route?
    "avg_delay_hours",     # how often does this route get delayed?
    "avg_risk_score",      # overall average risk level
    "risk_std_dev",        # how variable / unpredictable is risk?
]

X = route_agg[CLUSTER_FEATURES].copy()
print(f"    Routes for clustering: {len(X):,}")
print(f"    Features: {CLUSTER_FEATURES}")
print(f"\n    Feature statistics:")
print(f"    {'Feature':<25} {'Mean':>8} {'Std':>8} {'Min':>8} {'Max':>8}")
print(f"    {'-'*57}")
for col in CLUSTER_FEATURES:
    print(f"    {col:<25} {X[col].mean():>8.2f} {X[col].std():>8.2f} {X[col].min():>8.2f} {X[col].max():>8.2f}")

# ═══════════════════════════════════════════════════════════════════════
# STEP 3 — 70 / 15 / 15 Split
# ═══════════════════════════════════════════════════════════════════════
print("\n[3/7] Splitting routes (70% fit / 15% val / 15% test) ...")

X_fit, X_temp = train_test_split(X, test_size=0.30, random_state=42)
X_val, X_test = train_test_split(X_temp, test_size=0.50, random_state=42)

print(f"    Fit  (K-Means trains on) : {len(X_fit):,}  (70%)")
print(f"    Val  (silhouette check)  : {len(X_val):,}  (15%)")
print(f"    Test (consistency check) : {len(X_test):,}  (15%)")

# ═══════════════════════════════════════════════════════════════════════
# STEP 4 — Standardise features (critical for K-Means)
# ═══════════════════════════════════════════════════════════════════════
print("\n[4/7] Standardising features ...")
print("    NOTE: K-Means uses Euclidean distance, so all features must be")
print("    on the same scale. StandardScaler: mean=0, std=1 per feature.")

scaler  = StandardScaler()
X_fit_s = scaler.fit_transform(X_fit)    # fit + transform on training set
X_val_s = scaler.transform(X_val)         # only transform (no re-fit) on val
X_test_s= scaler.transform(X_test)        # only transform on test

print(f"    Scaler fitted on {len(X_fit):,} routes")
print(f"    Means after scaling: {X_fit_s.mean(axis=0).round(3)}")
print(f"    Stds  after scaling: {X_fit_s.std(axis=0).round(3)}")

# ═══════════════════════════════════════════════════════════════════════
# STEP 5 — Optimal K selection (Elbow + Silhouette)
# ═══════════════════════════════════════════════════════════════════════
print("\n[5/7] Finding optimal K (Elbow method + Silhouette score) ...")
print("      Testing K = 2, 3, 4, 5, 6, 7, 8")

k_results = []
for k in range(2, 9):
    km = KMeans(n_clusters=k, random_state=42, n_init=10, max_iter=300)
    km.fit(X_fit_s)
    labels_val = km.predict(X_val_s)

    inertia   = float(km.inertia_)
    sil_fit   = float(silhouette_score(X_fit_s, km.labels_))
    sil_val   = float(silhouette_score(X_val_s, labels_val)) if len(set(labels_val)) > 1 else 0.0
    db_fit    = float(davies_bouldin_score(X_fit_s, km.labels_))

    k_results.append({
        "k": k,
        "inertia": inertia,
        "silhouette_fit": sil_fit,
        "silhouette_val": sil_val,
        "davies_bouldin": db_fit,
    })
    print(f"    K={k}  inertia={inertia:>10.1f}  sil_fit={sil_fit:.4f}  sil_val={sil_val:.4f}  DB={db_fit:.4f}")

# Best K = highest validation silhouette score
best_k_row = max(k_results, key=lambda r: r["silhouette_val"])
BEST_K     = best_k_row["k"]
print(f"\n    Best K = {BEST_K}  (highest val silhouette = {best_k_row['silhouette_val']:.4f})")

# ═══════════════════════════════════════════════════════════════════════
# STEP 6 — Fit final K-Means model
# ═══════════════════════════════════════════════════════════════════════
print(f"\n[6/7] Fitting final K-Means with K={BEST_K} ...")

kmeans = KMeans(
    n_clusters=BEST_K,
    random_state=42,
    n_init=20,         # 20 random initialisations — picks best (lowest inertia)
    max_iter=500,      # enough iterations to ensure convergence
    algorithm="lloyd", # standard Lloyd's algorithm
)
kmeans.fit(X_fit_s)

# Assign clusters to all routes
X_all_s = scaler.transform(X)
route_agg["cluster_id"] = kmeans.predict(X_all_s)

# -- Cluster profiles (mean of each feature per cluster) --
cluster_profiles = route_agg.groupby("cluster_id")[CLUSTER_FEATURES + ["shipment_count"]].mean()

# -- Auto-label clusters based on dominant characteristic --
def auto_label(row):
    """
    Assign human-readable archetype name based on which feature is highest.
    Labels must be explainable to logistics managers.
    """
    weather = row["avg_weather_score"]
    port    = row["avg_port_score"]
    delay   = row["avg_delay_hours"]
    risk    = row["avg_risk_score"]
    variab  = row["risk_std_dev"]

    if risk >= 55:
        return "High Risk / Problematic"
    elif weather >= 40 and weather == max(weather, port):
        return "Weather Sensitive"
    elif port >= 45 and port == max(weather, port):
        return "Port Congestion Prone"
    elif delay <= 4 and risk <= 30:
        return "Always Reliable"
    elif variab >= 12:
        return "Unpredictable / Mixed"
    else:
        return "Moderate / Stable"

cluster_labels = {int(cid): auto_label(row) for cid, row in cluster_profiles.iterrows()}
route_agg["cluster_label"] = route_agg["cluster_id"].map(cluster_labels)

# -- Historical score adjustment per cluster --
# Routes in "Always Reliable" get a -10 bonus (lower historical risk)
# Routes in "High Risk / Problematic" get a +20 penalty
HISTORICAL_ADJUSTMENTS = {
    "Always Reliable":          -12,
    "Weather Sensitive":        +8,
    "Port Congestion Prone":    +10,
    "High Risk / Problematic":  +20,
    "Unpredictable / Mixed":    +5,
    "Moderate / Stable":         0,
}
cluster_adj = {int(cid): HISTORICAL_ADJUSTMENTS.get(lbl, 0)
               for cid, lbl in cluster_labels.items()}
route_agg["historical_score_adjustment"] = route_agg["cluster_id"].map(cluster_adj)

print(f"\n    Cluster profiles (mean feature values per cluster):")
print(f"    {'Cluster':<5} {'Label':<30} {'AvgRisk':>8} {'AvgDelay':>9} {'AvgWeather':>11} {'AvgPort':>8} {'Adj':>5} {'Routes':>7}")
print(f"    {'-'*80}")
for cid, row in cluster_profiles.iterrows():
    lbl = cluster_labels[int(cid)]
    adj = cluster_adj[int(cid)]
    cnt = route_agg[route_agg["cluster_id"] == cid].shape[0]
    print(f"    {cid:<5} {lbl:<30} {row['avg_risk_score']:>8.1f} {row['avg_delay_hours']:>9.1f}h "
          f"{row['avg_weather_score']:>11.1f} {row['avg_port_score']:>8.1f} {adj:>+5} {cnt:>7}")

# -- Evaluation metrics on test set --
labels_test = kmeans.predict(X_test_s)
sil_test = float(silhouette_score(X_test_s, labels_test)) if len(set(labels_test)) > 1 else 0.0
db_test  = float(davies_bouldin_score(X_test_s, labels_test))

sil_fit_final = float(silhouette_score(X_fit_s, kmeans.labels_))
sil_val_final = float(silhouette_score(X_val_s, kmeans.predict(X_val_s)))

print(f"\n    Quality Metrics:")
print(f"    +---------------------------------------------+")
print(f"    |  K-Means Route Clusters - Quality           |")
print(f"    +---------------------------------------------+")
print(f"    |  Optimal K selected      : {BEST_K:>3}              |")
print(f"    |  Inertia (fit set)       : {kmeans.inertia_:>9.1f}      |")
print(f"    |  Silhouette (fit)        : {sil_fit_final:>9.4f}      |")
print(f"    |  Silhouette (val)        : {sil_val_final:>9.4f}      |")
print(f"    |  Silhouette (test)       : {sil_test:>9.4f}      |")
print(f"    |  Davies-Bouldin (test)   : {db_test:>9.4f}      |")
print(f"    +---------------------------------------------+")
print(f"    NOTE: Silhouette > 0.3 = acceptable, > 0.5 = good clustering")
print(f"          Davies-Bouldin < 1.0 = good cluster separation")

# -- Cluster distribution --
print(f"\n    Cluster distribution (all routes):")
for cid in sorted(route_agg["cluster_id"].unique()):
    cnt = (route_agg["cluster_id"] == cid).sum()
    pct = cnt / len(route_agg) * 100
    bar = "|" * int(pct / 2)
    lbl = cluster_labels[int(cid)]
    print(f"      Cluster {cid} ({lbl:<30}): {cnt:>5} routes ({pct:.1f}%) {bar}")

# ═══════════════════════════════════════════════════════════════════════
# STEP 7 — Save model & metadata
# ═══════════════════════════════════════════════════════════════════════
print("\n[7/7] Saving model ...")

joblib.dump(kmeans, MODEL_PATH)
joblib.dump(scaler, SCALER_PATH)
print(f"    K-Means model -> {MODEL_PATH}")
print(f"    Scaler        -> {SCALER_PATH}")

# Build cluster profile dict for metadata
profile_dict = {}
for cid, row in cluster_profiles.iterrows():
    profile_dict[str(int(cid))] = {
        "label": cluster_labels[int(cid)],
        "historical_score_adjustment": cluster_adj[int(cid)],
        "avg_weather_score": round(float(row["avg_weather_score"]), 2),
        "avg_port_score":    round(float(row["avg_port_score"]),    2),
        "avg_traffic_score": round(float(row["avg_traffic_score"]), 2),
        "avg_delay_hours":   round(float(row["avg_delay_hours"]),   2),
        "avg_risk_score":    round(float(row["avg_risk_score"]),    2),
        "risk_std_dev":      round(float(row["risk_std_dev"]),      2),
        "route_count":       int(route_agg[route_agg["cluster_id"] == cid].shape[0]),
    }

meta = {
    "model_type": "K-Means Clustering (scikit-learn)",
    "task": "route_pattern_clustering",
    "version": "1.0.0",
    "trained_at": pd.Timestamp.now().isoformat(),
    "split": "70% fit / 15% val / 15% test",
    "total_routes": int(len(route_agg)),
    "fit_routes":   int(len(X_fit)),
    "val_routes":   int(len(X_val)),
    "test_routes":  int(len(X_test)),
    "optimal_k": BEST_K,
    "k_selection_method": "Highest silhouette score on val set across K=2..8",
    "features": CLUSTER_FEATURES,
    "feature_scaling": "StandardScaler (mean=0, std=1) — required for Euclidean distance",
    "hyperparameters": {
        "n_clusters": BEST_K,
        "n_init": 20,
        "max_iter": 500,
        "algorithm": "lloyd",
        "random_state": 42,
    },
    "metrics": {
        "inertia":            round(float(kmeans.inertia_), 2),
        "silhouette_fit":     round(sil_fit_final, 4),
        "silhouette_val":     round(sil_val_final, 4),
        "silhouette_test":    round(sil_test, 4),
        "davies_bouldin_test":round(db_test, 4),
    },
    "k_selection_search": k_results,
    "cluster_profiles": profile_dict,
    "historical_adjustments": HISTORICAL_ADJUSTMENTS,
    "inference_note": (
        "1. Load: kmeans=joblib.load('kmeans_route_clusters.pkl'); "
        "scaler=joblib.load('kmeans_scaler.pkl'). "
        "2. Build route feature vector [avg_weather, avg_port, avg_traffic, avg_delay, avg_risk, risk_std]. "
        "3. cluster_id = kmeans.predict(scaler.transform([features]))[0]. "
        "4. Lookup adjustment in cluster_profiles[str(cluster_id)]['historical_score_adjustment']. "
        "5. final_historical_score = base_historical_score + adjustment (clipped 0-100)."
    ),
    "how_it_feeds_back": (
        "Each route gets assigned a cluster_id at analysis time. "
        "The cluster's historical_score_adjustment (+/- points) is added to the "
        "base historical_score before passing to XGBoost Model 1. "
        "This makes risk scoring route-aware: a vessel on a proven reliable route "
        "gets a lower historical_score than one on a consistently problematic lane."
    ),
    "data_sources": [
        "training_dataset.csv aggregated to route level (dest_cluster + season + cargo_band)",
        "Minimum 5 shipment records per route for reliable aggregation",
    ],
}

with open(META_PATH, "w") as f:
    json.dump(meta, f, indent=2)
print(f"    Metadata -> {META_PATH}")

# Save route-cluster assignments for use by feature engine
ASSIGNMENTS_PATH = os.path.join(DATA_DIR, "route_cluster_assignments.csv")
route_agg[["route_id", "cluster_id", "cluster_label",
           "historical_score_adjustment", "shipment_count"] + CLUSTER_FEATURES].to_csv(
    ASSIGNMENTS_PATH, index=False)
print(f"    Route assignments -> {ASSIGNMENTS_PATH}")

print("\n" + "=" * 65)
print("  [DONE] Model 5 (K-Means Route Clustering) complete!")
print(f"  K={BEST_K}  Silhouette(test)={sil_test:.4f}  DB={db_test:.4f}")
print("=" * 65)
print("\n  Run 06_continuous_improvement.py for the full pipeline.\n")
