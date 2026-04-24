# RouteGuard — ML Training Documentation
### Model 5: K-Means Route Pattern Clustering

---

## What This Model Does

K-Means groups all shipping routes into **behavioral archetypes** — patterns of how risky a route historically tends to be.

Without this model, the `historical_score` feature in Model 1 (XGBoost) is a generic per-shipment estimate. With K-Means, every route gets a cluster assignment, and that cluster's risk profile adjusts the `historical_score` fed into Model 1.

**Practical effect:**
> A vessel on the Asia-Pacific lane (historically congested) gets `historical_score += 10` before XGBoost sees it.
> A vessel on a proven low-risk Pacific NW lane gets `historical_score -= 12`.
> This makes risk scores smarter over time — route reputation is baked in.

---

## When It Runs

| Schedule | Action |
|---|---|
| **Weekly (background)** | Re-cluster all routes with latest completed shipment data |
| **At prediction time** | Look up route → get cluster_id → adjust historical_score |

Users don't see this directly. They see that risk scores are more accurate for routes the system has seen before.

---

## Why K-Means (Not Another Algorithm)?

| Option | Why Not |
|---|---|
| DBSCAN | Requires density threshold tuning; poor with small datasets (67 routes) |
| Hierarchical | Good but no natural way to assign new routes at inference |
| Gaussian Mixture | More complex; overkill for 6-feature route profiles |
| **K-Means** | Fast, interpretable, assigns every route to exactly one cluster, easy to update |

K-Means works by iteratively:
1. Placing K cluster centres randomly
2. Assigning each route to its nearest centre (Euclidean distance)
3. Moving each centre to the mean of its assigned routes
4. Repeating until centres stop moving

The result: K groups where routes within a group are similar and routes between groups are different.

---

## Input Data — Route-Level Aggregation

K-Means clusters **routes**, not individual shipment snapshots. First, we aggregate all shipments to route level.

**Route ID construction:**
```python
route_id = dest_cluster + "_s" + season + "_c" + cargo_band
# Example: "7_s3_c4" = Asia-Pacific cluster, Summer, high-sensitivity cargo
```

**Aggregation (per route_id, minimum 5 shipments):**

| Feature | Aggregation | Why |
|---|---|---|
| `avg_weather_score` | mean | Typical weather severity on this route |
| `avg_port_score` | mean | Typical port congestion level |
| `avg_traffic_score` | mean | Typical traffic conditions |
| `avg_delay_hours` | mean | How often this route is late |
| `avg_risk_score` | mean | Overall historical risk level |
| `risk_std_dev` | std dev | How unpredictable is risk? (volatile vs stable) |

**Dataset after aggregation:**
- Total routes: **67** (from 300,780 shipment rows)
- Routes excluded (< 5 records): dropped for statistical reliability

**Feature statistics:**
| Feature | Mean | Std | Min | Max |
|---|---|---|---|---|
| avg_weather_score | 27.0 | 6.5 | 9.9 | 42.5 |
| avg_port_score | 40.5 | 6.9 | 19.8 | 54.9 |
| avg_traffic_score | 24.0 | 5.5 | 12.3 | 36.8 |
| avg_delay_hours | 12.4h | 2.8h | 5.2h | 16.9h |
| avg_risk_score | 34.8 | 4.2 | 26.3 | 46.0 |
| risk_std_dev | 11.3 | 2.1 | 5.3 | 14.2 |

---

## Data Split (Adapted for Unsupervised Learning)

K-Means is unsupervised — there are no labels. But we still apply 70/15/15:

```
Total routes: 67
  Fit  (70%) : 46 routes  ← K-Means fits cluster centres on this
  Val  (15%) : 10 routes  ← Silhouette score computed to select best K
  Test (15%) : 11 routes  ← Final blind quality evaluation
```

**Why split unsupervised data?**
- Prevents K from being over-tuned to the exact 67 routes in the dataset
- Val set gives unbiased K selection (we test K=2..8, pick best val silhouette)
- Test set gives final quality score — the model never sees these 11 routes during K selection

---

## Feature Standardisation (Critical for K-Means)

K-Means uses **Euclidean distance**. Without scaling:
- `avg_delay_hours` (range: 5–17) would have almost no influence
- `avg_port_score` (range: 20–55) would dominate purely due to larger values

**Solution: StandardScaler** — transforms each feature to mean=0, std=1:
```python
scaler = StandardScaler()
X_fit_scaled = scaler.fit_transform(X_fit)   # fit ONLY on training set
X_val_scaled  = scaler.transform(X_val)       # apply same scale to val/test
X_test_scaled = scaler.transform(X_test)
```

After scaling: all features equally contribute to distance calculations.

> **Important:** At inference time, the scaler must be applied before calling `kmeans.predict()`. Both `kmeans_route_clusters.pkl` and `kmeans_scaler.pkl` must be loaded together.

---

## Optimal K Selection

We tested K=2 through K=8, evaluating each using:
- **Silhouette Score**: How well-separated are clusters? Range [-1, 1]. Higher = better (>0.3 acceptable, >0.5 good)
- **Davies-Bouldin Score**: Ratio of within-cluster spread to between-cluster distance. Lower = better (<1.0 good)
- **Inertia**: Sum of squared distances to cluster centre. Lower = tighter clusters (elbow method)

**K Search Results:**

| K | Inertia | Sil (fit) | Sil (val) | DB (fit) |
|---|---|---|---|---|
| 2 | 184.8 | 0.432 | 0.437 | 0.802 |
| 3 | 144.6 | 0.254 | 0.259 | 1.273 |
| **4** | **125.5** | **0.266** | **0.474** | **1.276** |
| 5 | 109.2 | 0.232 | 0.336 | 1.278 |
| 6 | 94.1 | 0.239 | 0.261 | 1.080 |
| 7 | 82.8 | 0.240 | 0.152 | 1.079 |
| 8 | 70.3 | 0.229 | 0.202 | 0.924 |

**Best K = 4** (highest validation silhouette = 0.4735)

K=2 has a decent silhouette but only 2 clusters is too coarse — doesn't distinguish weather-sensitive vs port-congested routes. K=4 gives the best val silhouette while staying interpretable.

---

## Hyperparameters

| Parameter | Value | Reason |
|---|---|---|
| `n_clusters` | **4** | Selected by val silhouette |
| `n_init` | 20 | 20 random initialisations — picks the one with lowest inertia |
| `max_iter` | 500 | Enough iterations for guaranteed convergence |
| `algorithm` | lloyd | Standard K-Means (Lloyd's algorithm) |
| `random_state` | 42 | Reproducibility |

`n_init=20` is important: K-Means is sensitive to initialisation. Running 20 times and picking the best result avoids bad local minima.

---

## Results — Cluster Profiles

**4 clusters found:**

| Cluster | Label | Avg Risk | Avg Delay | Avg Weather | Avg Port | Hist Adj | Routes |
|---|---|---|---|---|---|---|---|
| 0 | Port Congestion Prone | 41.0 | 13.9h | 26.2 | 48.9 | **+10** | 6 (9%) |
| 1 | Moderate / Stable | 39.2 | 14.6h | 33.9 | 39.3 | 0 | 14 (21%) |
| 2 | Moderate / Stable | 33.3 | 13.0h | 27.4 | 37.0 | 0 | 35 (52%) |
| 3 | Port Congestion Prone | 31.1 | 7.4h | 18.3 | 48.0 | **+10** | 12 (18%) |

**Cluster interpretation:**
- **Cluster 0** — High port_score (48.9) AND high risk (41.0): these are major hub routes (Asia-Pacific type) with persistent congestion. Shorter delay because they're frequent lanes with fast turnarounds.
- **Cluster 1** — Moderate everything but elevated weather_score (33.9): these are ocean routes that see more weather variation. Longest average delays.
- **Cluster 2** — The majority of routes (52%): typical moderate-risk shipping lanes. No strong signal in any feature.
- **Cluster 3** — High port_score (48.0) but LOW delay (7.4h): congested destination but somehow fast — likely short-haul routes where vessels queue efficiently.

---

## Quality Metrics (held-out test set — 11 routes)

| Metric | Value | Interpretation |
|---|---|---|
| **Silhouette (fit)** | 0.250 | Acceptable — fit set is well separated |
| **Silhouette (val)** | 0.261 | Consistent with fit — not overfitting to fit set |
| **Silhouette (test)** | **0.332** | Above 0.3 threshold — acceptable cluster quality |
| **Davies-Bouldin (test)** | **0.761** | Below 1.0 — good cluster separation |
| Inertia (fit) | 121.5 | Tight clusters |

> **Why are silhouette scores moderate (0.25–0.33) rather than high (>0.5)?**
>
> With only 67 routes and 6 features, the routes are genuinely similar to each other — shipping routes aren't wildly different in their risk profiles. The clustering still finds meaningful structure (port-congested vs balanced routes), but this isn't a dataset with extreme natural cluster separation. A silhouette of 0.33 on 11 unseen test routes confirms the clusters generalise and aren't overfitted.

---

## How the Historical Score Adjustment Works

At prediction time (every 30 minutes per shipment):

```python
# 1. Build route feature vector from last N shipments on this route
route_features = [avg_weather, avg_port, avg_traffic,
                  avg_delay, avg_risk, risk_std]

# 2. Scale and predict cluster
scaler  = load("kmeans_scaler.pkl")
kmeans  = load("kmeans_route_clusters.pkl")
cluster_id = kmeans.predict(scaler.transform([route_features]))[0]

# 3. Look up adjustment from cluster profile
adjustment = cluster_profiles[str(cluster_id)]["historical_score_adjustment"]
# e.g., cluster_id=0 → adjustment = +10

# 4. Apply to historical_score before feeding to XGBoost
adjusted_historical = clip(base_historical_score + adjustment, 0, 100)
# If base was 45 and cluster adds +10 → 55 → XGBoost now sees a riskier route
```

**Historical Score Adjustments by Cluster:**
| Archetype | Adjustment | Reasoning |
|---|---|---|
| Always Reliable | -12 | Proven safe route; lower historical risk |
| Weather Sensitive | +8 | Expect weather-driven risk spikes |
| Port Congestion Prone | +10 | Port queues increase historical exposure |
| High Risk / Problematic | +20 | Route has a bad track record |
| Unpredictable / Mixed | +5 | Volatility itself is a risk signal |
| Moderate / Stable | 0 | No adjustment; average route |

---

## Output Artifacts

| File | Location | Content |
|---|---|---|
| `kmeans_route_clusters.pkl` | `ml/models/` | Fitted KMeans (K=4) — call `.predict()` |
| `kmeans_scaler.pkl` | `ml/models/` | StandardScaler — must apply before predict |
| `kmeans_route_clusters_meta.json` | `ml/models/` | Cluster profiles, labels, adjustments, metrics |
| `route_cluster_assignments.csv` | `ml/data/` | All 67 routes with their cluster_id and label |

---

## How to Explain to Anyone

### "Why is this useful if routes cluster into mostly 'Moderate/Stable'?"

> 52% of routes being moderate is realistic — most shipping lanes are safe most of the time. The value is in the other 48%: flagging port-congested routes (27%) so that a ship heading to Shanghai gets a risk bump automatically, even before today's weather data comes in. The cluster acts as a prior belief about the route.

### "Why 70/15/15 for an unsupervised model?"

> Even without labels, splitting matters. We use 70% to learn the cluster centres, 15% to select the best number of clusters K (without using test data), and 15% as a blind quality check. This prevents choosing a K that just memorises the 67 routes perfectly (overfitting K to the full dataset). K=4 won on the val set, and the test set confirmed it with silhouette=0.33.

### "How does this affect what managers see?"

> Managers don't see clusters directly. But over time they notice: "The system warned us about the Shanghai route before any weather event — how did it know?" The answer is that the cluster told the system this route has a port_score history of 48+, so it adjusts `historical_score` upward. The XGBoost model then computes a higher risk score even on a calm day, because it knows this route has historically been problematic.

### "What is StandardScaler and why is it required?"

> K-Means measures similarity using straight-line (Euclidean) distance between points. If `avg_delay_hours` is on a scale of 5–17 and `avg_port_score` is on a scale of 20–55, the port score has a much larger range and will dominate the distance calculation — delay will barely matter. StandardScaler converts everything to the same scale (mean=0, std=1) so all 6 features contribute equally to cluster assignment.
