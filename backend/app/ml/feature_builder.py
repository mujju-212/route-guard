"""
feature_builder.py
------------------
Standalone entry-point for ML feature engineering.  This module wraps
`services.feature_engine.build_feature_vector` so that training notebooks
and the `ml/predict.py` façade can import from a single, stable location.

For training (Jupyter notebooks):
    from app.ml.feature_builder import build_features_for_shipment

For real-time inference the routers and background jobs call
`app.services.feature_engine.build_feature_vector` directly.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session


async def build_features_for_shipment(
    shipment_id: str,
    db: Session,
) -> dict[str, Any]:
    """
    Convenience wrapper: resolves the shipment from the DB, then delegates
    to the canonical feature engine.

    Returns the same feature dict used by the ML models:
    {
        weather_score, traffic_score, port_score, historical_score,
        cargo_sensitivity, distance_remaining, time_of_day, day_of_week, season
    }
    """
    from uuid import UUID

    from app.models.shipment import Shipment
    from app.services.feature_engine import build_feature_vector

    shipment = db.query(Shipment).filter(
        Shipment.shipment_id == UUID(shipment_id)
    ).first()

    if not shipment:
        raise ValueError(f"Shipment {shipment_id} not found")

    if shipment.current_latitude is not None and shipment.current_longitude is not None:
        coords = (float(shipment.current_latitude), float(shipment.current_longitude))
    else:
        coords = (
            float(shipment.origin_port.latitude),
            float(shipment.origin_port.longitude),
        )

    active_route = next(
        (r for r in shipment.routes if r.is_active), None
    ) or (shipment.routes[0] if shipment.routes else None)

    if active_route is None:
        raise ValueError(f"Shipment {shipment_id} has no route")

    cargo_sensitivity = float(
        shipment.cargo.cargo_sensitivity_score if shipment.cargo else 40
    )

    return await build_feature_vector(
        shipment_id=shipment_id,
        current_coords=coords,
        destination_port_id=str(shipment.destination_port_id),
        route_id=str(active_route.route_id),
        cargo_sensitivity=cargo_sensitivity,
        db=db,
    )


def build_feature_row_from_dict(features: dict[str, Any]) -> list[float]:
    """
    Convert a feature dict to an ordered list suitable for model.predict().
    Order must match the training feature order used in the notebooks.
    """
    return [
        float(features.get("weather_score", 0)),
        float(features.get("traffic_score", 0)),
        float(features.get("port_score", 0)),
        float(features.get("historical_score", 0)),
        float(features.get("cargo_sensitivity", 0)),
        float(features.get("distance_remaining", 0)),
        float(features.get("time_of_day", 0)),
        float(features.get("day_of_week", 0)),
        float(features.get("season", 0)),
    ]
