"""
retraining_job.py
-----------------
APScheduler background job that retrains ML models every Sunday at 02:00 UTC.

Pipeline:
1. Pull delivered shipments whose predictions have NOT been used for retraining.
2. Compute actual errors (predicted_delay vs actual_delay).
3. Build a training DataFrame from the stored model_predictions table.
4. Retrain XGBoost (risk), Random Forest (delay), and Gradient Boosting (reroute).
5. Evaluate new models; deploy only if accuracy improved by > 1 %.
6. Store results in MongoDB `retraining_history` and `model_metrics`.
7. Mark predictions as used_for_retraining = True.
"""

import asyncio
import logging
from datetime import datetime
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger(__name__)

ML_MODELS_PATH = Path(__file__).resolve().parents[1] / "ml" / "models"

_scheduler: BackgroundScheduler | None = None


def _build_training_dataframe(db):
    """
    Pull model_predictions that have actual_delay_hr filled and have not
    been used for retraining yet.  Returns (X, y_risk, y_delay, y_reroute).
    """
    import numpy as np
    import pandas as pd

    from app.models.model_prediction import ModelPrediction

    rows = (
        db.query(ModelPrediction)
        .filter(
            ModelPrediction.actual_delay_hr.isnot(None),
            ModelPrediction.used_for_retraining.is_(False),
        )
        .all()
    )

    if not rows:
        return None, None, None, None, []

    records = []
    for row in rows:
        records.append(
            {
                "weather_score": float(row.weather_score or 0),
                "traffic_score": float(row.traffic_score or 0),
                "port_score": float(row.port_score or 0),
                "historical_score": float(row.historical_score or 0),
                "cargo_sensitivity": float(row.cargo_sensitivity or 0),
                "distance_remaining": float(row.distance_remaining or 0),
                "time_of_day": int(row.time_of_day or 0),
                "day_of_week": int(row.day_of_week or 0),
                "season": int(row.season or 0),
                "risk_score": float(row.risk_score or 0),
                "actual_delay_hr": float(row.actual_delay_hr or 0),
                "reroute": 1 if (row.reroute_recommended or False) else 0,
                "prediction_id": str(row.prediction_id),
            }
        )

    df = pd.DataFrame(records)
    feature_cols = [
        "weather_score",
        "traffic_score",
        "port_score",
        "historical_score",
        "cargo_sensitivity",
        "distance_remaining",
        "time_of_day",
        "day_of_week",
        "season",
    ]

    X = df[feature_cols].values
    y_risk = df["risk_score"].values
    y_delay = df["actual_delay_hr"].values
    y_reroute = df["reroute"].values
    prediction_ids = df["prediction_id"].tolist()

    return X, y_risk, y_delay, y_reroute, prediction_ids


def _evaluate_model(model, X, y, task="regression"):
    """Return metric dict for a model."""
    from sklearn.metrics import (
        accuracy_score,
        f1_score,
        mean_absolute_error,
        mean_squared_error,
        r2_score,
    )
    import math

    y_pred = model.predict(X)
    if task == "regression":
        return {
            "rmse": float(math.sqrt(mean_squared_error(y, y_pred))),
            "mae": float(mean_absolute_error(y, y_pred)),
            "r2": float(r2_score(y, y_pred)),
        }
    else:
        y_pred_cls = (y_pred >= 0.5).astype(int) if hasattr(model, "predict_proba") else y_pred
        return {
            "accuracy": float(accuracy_score(y, y_pred_cls)),
            "f1": float(f1_score(y, y_pred_cls, zero_division=0)),
        }


def _run_retraining_cycle() -> None:
    """Synchronous entry-point executed by APScheduler."""
    import joblib

    from app.database.mongodb import retraining_history, model_metrics
    from app.database.postgres import SessionLocal
    from app.models.model_prediction import ModelPrediction

    db = SessionLocal()
    loop = asyncio.new_event_loop()

    try:
        X, y_risk, y_delay, y_reroute, prediction_ids = _build_training_dataframe(db)

        if X is None or len(X) < 20:
            logger.info(
                f"Retraining skipped — only {len(prediction_ids) if prediction_ids else 0} "
                "usable samples (need ≥ 20)."
            )
            return

        logger.info(f"Retraining on {len(X)} samples…")

        from sklearn.model_selection import train_test_split

        X_train, X_test, yr_train, yr_test = train_test_split(
            X, y_risk, test_size=0.2, random_state=42
        )
        _, _, yd_train, yd_test = train_test_split(
            X, y_delay, test_size=0.2, random_state=42
        )
        _, _, yrr_train, yrr_test = train_test_split(
            X, y_reroute, test_size=0.2, random_state=42
        )

        results: dict = {}
        deployed = 0
        kept_old = 0

        # ── XGBoost (risk score) ───────────────────────────────────────────────
        try:
            import xgboost as xgb

            new_xgb = xgb.XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1)
            new_xgb.fit(X_train, yr_train)
            new_metrics = _evaluate_model(new_xgb, X_test, yr_test, "regression")

            # Compare with existing model
            xgb_path = ML_MODELS_PATH / "xgboost_risk.pkl"
            deploy = True
            if xgb_path.exists():
                old_model = joblib.load(xgb_path)
                old_metrics = _evaluate_model(old_model, X_test, yr_test, "regression")
                # Deploy only if R² improved
                if new_metrics["r2"] <= old_metrics["r2"] + 0.01:
                    deploy = False
                    kept_old += 1

            if deploy:
                ML_MODELS_PATH.mkdir(parents=True, exist_ok=True)
                joblib.dump(new_xgb, xgb_path)
                deployed += 1
                loop.run_until_complete(
                    model_metrics.update_one(
                        {"model_name": "xgboost"},
                        {
                            "$set": {
                                "model_name": "xgboost",
                                "is_current": True,
                                **new_metrics,
                                "deployed_at": datetime.utcnow(),
                            }
                        },
                        upsert=True,
                    )
                )
                logger.info(f"  ✓ XGBoost deployed — R²={new_metrics['r2']:.4f}")

            results["xgboost"] = new_metrics
        except Exception as exc:
            logger.error(f"  ✗ XGBoost retraining failed: {exc}", exc_info=True)

        # ── Random Forest (delay hours) ────────────────────────────────────────
        try:
            from sklearn.ensemble import RandomForestRegressor

            new_rf = RandomForestRegressor(n_estimators=150, max_depth=8, random_state=42)
            rf_X_train = [[*row, yr_train[i], 0, 0] for i, row in enumerate(X_train)]
            rf_X_test = [[*row, yr_test[i], 0, 0] for i, row in enumerate(X_test)]
            new_rf.fit(rf_X_train, yd_train)
            new_metrics = _evaluate_model(new_rf, rf_X_test, yd_test, "regression")

            rf_path = ML_MODELS_PATH / "random_forest_delay.pkl"
            deploy = True
            if rf_path.exists():
                old_model = joblib.load(rf_path)
                old_metrics = _evaluate_model(old_model, rf_X_test, yd_test, "regression")
                if new_metrics["mae"] >= old_metrics["mae"] - 0.05:
                    deploy = False
                    kept_old += 1

            if deploy:
                ML_MODELS_PATH.mkdir(parents=True, exist_ok=True)
                joblib.dump(new_rf, rf_path)
                deployed += 1
                loop.run_until_complete(
                    model_metrics.update_one(
                        {"model_name": "random_forest"},
                        {
                            "$set": {
                                "model_name": "random_forest",
                                "is_current": True,
                                **new_metrics,
                                "deployed_at": datetime.utcnow(),
                            }
                        },
                        upsert=True,
                    )
                )
                logger.info(f"  ✓ Random Forest deployed — MAE={new_metrics['mae']:.4f}")

            results["random_forest"] = new_metrics
        except Exception as exc:
            logger.error(f"  ✗ Random Forest retraining failed: {exc}", exc_info=True)

        # ── Gradient Boosting (reroute decision) ──────────────────────────────
        try:
            from sklearn.ensemble import GradientBoostingClassifier

            gb_X_train = [[*row, yr_train[i], yd_train[i], 1] for i, row in enumerate(X_train)]
            gb_X_test = [[*row, yr_test[i], yd_test[i], 1] for i, row in enumerate(X_test)]

            new_gb = GradientBoostingClassifier(n_estimators=150, max_depth=5, learning_rate=0.1)
            new_gb.fit(gb_X_train, yrr_train)
            new_metrics = _evaluate_model(new_gb, gb_X_test, yrr_test, "classification")

            gb_path = ML_MODELS_PATH / "gradient_boosting_reroute.pkl"
            deploy = True
            if gb_path.exists():
                old_model = joblib.load(gb_path)
                old_metrics = _evaluate_model(old_model, gb_X_test, yrr_test, "classification")
                if new_metrics["accuracy"] <= old_metrics["accuracy"] + 0.01:
                    deploy = False
                    kept_old += 1

            if deploy:
                ML_MODELS_PATH.mkdir(parents=True, exist_ok=True)
                joblib.dump(new_gb, gb_path)
                deployed += 1
                loop.run_until_complete(
                    model_metrics.update_one(
                        {"model_name": "gradient_boosting"},
                        {
                            "$set": {
                                "model_name": "gradient_boosting",
                                "is_current": True,
                                **new_metrics,
                                "deployed_at": datetime.utcnow(),
                            }
                        },
                        upsert=True,
                    )
                )
                logger.info(
                    f"  ✓ Gradient Boosting deployed — Accuracy={new_metrics['accuracy']:.4f}"
                )

            results["gradient_boosting"] = new_metrics
        except Exception as exc:
            logger.error(f"  ✗ Gradient Boosting retraining failed: {exc}", exc_info=True)

        # ── Mark predictions as used ───────────────────────────────────────────
        if prediction_ids:
            db.query(ModelPrediction).filter(
                ModelPrediction.prediction_id.in_(prediction_ids)
            ).update({"used_for_retraining": True}, synchronize_session=False)
            db.commit()

        # ── Log retraining history to MongoDB ─────────────────────────────────
        history = {
            "completed_at": datetime.utcnow(),
            "samples_used": len(X),
            "results": results,
            "models_deployed": deployed,
            "models_kept_old": kept_old,
        }
        loop.run_until_complete(retraining_history.insert_one(history))
        logger.info(
            f"Retraining complete — {deployed} model(s) deployed, "
            f"{kept_old} model(s) kept (no improvement)."
        )

    except Exception as exc:
        logger.exception(f"Retraining job crashed: {exc}")
    finally:
        db.close()
        loop.close()


def start_retraining_scheduler() -> BackgroundScheduler:
    """
    Start the retraining scheduler.
    Runs every Sunday at 02:00 UTC.
    """
    global _scheduler
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _run_retraining_cycle,
        trigger="cron",
        day_of_week="sun",
        hour=2,
        minute=0,
        id="retraining_job",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.start()
    logger.info("Retraining scheduler started — runs every Sunday at 02:00 UTC.")
    return _scheduler


def stop_retraining_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Retraining scheduler stopped.")
