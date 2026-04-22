"""
clustering_job.py
-----------------
APScheduler background job that runs every Sunday at 03:00 UTC
(after retraining at 02:00 to use freshest models).

Purpose:
  Cluster all historical routes using K-Means to identify route archetypes
  (e.g., "High-Weather-Risk Northern Corridor", "Low-Risk Southern Lane").
  Cluster labels are written back to the routes table and stored in MongoDB
  `route_clusters` collection so the dashboard can display cluster insights.

Algorithm:
  Features per route:
    - avg_predicted_risk_score (from model_predictions)
    - avg_actual_delay_hr (from shipments)
    - avg_weather_score
    - avg_port_score
    - avg_distance_km
  K = 5 clusters (configurable via N_CLUSTERS).
  Uses scikit-learn KMeans + StandardScaler; scaler is persisted alongside model.
"""

import asyncio
import logging
from datetime import datetime
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

ML_MODELS_PATH = Path(__file__).resolve().parents[1] / "ml" / "models"

N_CLUSTERS = 5

_CLUSTER_NAMES = [
    "High-Weather-Risk Corridor",
    "Port-Congestion-Heavy Lane",
    "Low-Risk Stable Route",
    "Long-Distance High-Exposure Path",
    "Seasonal-Variance Route",
]

_scheduler: BackgroundScheduler | None = None


def _build_route_feature_matrix(db):
    """
    For each unique (origin_port_id, destination_port_id) route pair,
    compute aggregate features from historical prediction data.
    Returns (route_pairs, feature_matrix).
    """
    import numpy as np
    from sqlalchemy import func

    from app.models.model_prediction import ModelPrediction
    from app.models.route import Route
    from app.models.shipment import Shipment

    # Aggregate per route corridor
    route_stats = (
        db.query(
            Route.origin_port_id,
            Route.destination_port_id,
            func.avg(ModelPrediction.risk_score).label("avg_risk"),
            func.avg(ModelPrediction.weather_score).label("avg_weather"),
            func.avg(ModelPrediction.port_score).label("avg_port"),
            func.avg(ModelPrediction.traffic_score).label("avg_traffic"),
            func.avg(Route.total_distance_km).label("avg_distance"),
            func.avg(Shipment.actual_delay_hours).label("avg_delay"),
        )
        .join(ModelPrediction, ModelPrediction.shipment_id == Route.shipment_id)
        .join(Shipment, Shipment.shipment_id == Route.shipment_id)
        .filter(ModelPrediction.risk_score.isnot(None))
        .group_by(Route.origin_port_id, Route.destination_port_id)
        .all()
    )

    if not route_stats:
        return [], np.array([])

    route_pairs = []
    feature_rows = []
    for row in route_stats:
        route_pairs.append(
            {
                "origin_port_id": str(row.origin_port_id),
                "destination_port_id": str(row.destination_port_id),
            }
        )
        feature_rows.append(
            [
                float(row.avg_risk or 50),
                float(row.avg_weather or 30),
                float(row.avg_port or 20),
                float(row.avg_traffic or 25),
                float(row.avg_distance or 5000),
                float(row.avg_delay or 0),
            ]
        )

    return route_pairs, np.array(feature_rows)


def _run_clustering_cycle() -> None:
    """Synchronous entry-point executed by APScheduler."""
    import joblib
    import numpy as np
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    from app.database.mongodb import route_clusters
    from app.database.postgres import SessionLocal
    from app.models.route import Route

    db = SessionLocal()
    loop = asyncio.new_event_loop()

    try:
        route_pairs, X = _build_route_feature_matrix(db)

        if len(route_pairs) < N_CLUSTERS:
            logger.info(
                f"Clustering skipped — only {len(route_pairs)} route corridor(s) "
                f"(need ≥ {N_CLUSTERS})."
            )
            return

        logger.info(f"Clustering {len(route_pairs)} route corridor(s) into {N_CLUSTERS} clusters…")

        # Normalise features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Train KMeans
        kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_scaled)

        # Persist models
        ML_MODELS_PATH.mkdir(parents=True, exist_ok=True)
        joblib.dump(kmeans, ML_MODELS_PATH / "route_kmeans.pkl")
        joblib.dump(scaler, ML_MODELS_PATH / "route_cluster_scaler.pkl")
        logger.info("  ✓ KMeans and scaler persisted to disk.")

        # Write cluster labels back to the routes table and MongoDB
        cluster_docs: dict[int, dict] = {
            i: {
                "cluster_id": i,
                "cluster_name": _CLUSTER_NAMES[i % len(_CLUSTER_NAMES)],
                "num_routes": 0,
                "route_ids": [],
                "characteristics": {
                    "avg_risk_score": 0.0,
                    "avg_weather_correlation": 0.0,
                    "avg_port_contribution": 0.0,
                    "avg_traffic_contribution": 0.0,
                    "avg_distance_km": 0.0,
                    "avg_delay_hours": 0.0,
                },
                "updated_at": datetime.utcnow(),
            }
            for i in range(N_CLUSTERS)
        }

        now = datetime.utcnow()
        feature_labels = [
            "avg_risk", "avg_weather", "avg_port", "avg_traffic", "avg_distance", "avg_delay"
        ]

        for idx, (pair, cluster_id) in enumerate(zip(route_pairs, labels)):
            cluster_id = int(cluster_id)
            # Update route rows in postgres
            (
                db.query(Route)
                .filter(
                    Route.origin_port_id == pair["origin_port_id"],
                    Route.destination_port_id == pair["destination_port_id"],
                )
                .update(
                    {
                        "cluster_id": cluster_id,
                        "cluster_name": _CLUSTER_NAMES[cluster_id % len(_CLUSTER_NAMES)],
                        "clustering_updated_at": now,
                    },
                    synchronize_session=False,
                )
            )

            doc = cluster_docs[cluster_id]
            doc["num_routes"] += 1
            # Track feature averages per cluster (running sum, normalise later)
            chars = doc["characteristics"]
            chars["avg_risk_score"] += X[idx][0]
            chars["avg_weather_correlation"] += X[idx][1]
            chars["avg_port_contribution"] += X[idx][2]
            chars["avg_traffic_contribution"] += X[idx][3]
            chars["avg_distance_km"] += X[idx][4]
            chars["avg_delay_hours"] += X[idx][5]

        db.commit()

        # Normalise cluster characteristic averages and upsert to MongoDB
        for cid, doc in cluster_docs.items():
            n = doc["num_routes"]
            if n > 0:
                chars = doc["characteristics"]
                for key in chars:
                    chars[key] = round(chars[key] / n, 4)

            loop.run_until_complete(
                route_clusters.update_one(
                    {"cluster_id": cid},
                    {"$set": doc},
                    upsert=True,
                )
            )

        logger.info(
            f"Clustering complete — {N_CLUSTERS} clusters written to PostgreSQL + MongoDB."
        )

    except Exception as exc:
        logger.exception(f"Clustering job crashed: {exc}")
    finally:
        db.close()
        loop.close()


def start_clustering_scheduler() -> BackgroundScheduler:
    """
    Start the clustering scheduler.
    Runs every Sunday at 03:00 UTC (after retraining at 02:00).
    """
    global _scheduler
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _run_clustering_cycle,
        trigger="cron",
        day_of_week="sun",
        hour=3,
        minute=0,
        id="clustering_job",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.start()
    logger.info("Clustering scheduler started — runs every Sunday at 03:00 UTC.")
    return _scheduler


def stop_clustering_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Clustering scheduler stopped.")
