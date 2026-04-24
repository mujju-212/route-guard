from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.database.mongodb import ml_prediction_logs
from app.database.redis_client import set_risk_score
from app.models.model_prediction import ModelPrediction
from app.models.shipment import RiskLevel, Shipment
from app.services.alert_service import create_alert
from app.services.feature_engine import build_feature_vector
from app.services.ml_service import classify_risk_level, predict_delay_hours, predict_reroute_decision, predict_risk_score


def _to_risk_enum(level: str) -> RiskLevel:
	if level == 'critical':
		return RiskLevel.CRITICAL
	if level == 'high':
		return RiskLevel.HIGH
	if level == 'medium':
		return RiskLevel.MEDIUM
	return RiskLevel.LOW


def _advance_ship_position(shipment, active_route) -> None:
	"""Move the ship's current position along the route based on time elapsed.
	Calculates journey progress (0.0 → 1.0) from departure_time to expected_arrival,
	then interpolates position along the route waypoints."""
	waypoints = active_route.waypoints
	if not waypoints or len(waypoints) < 2:
		return

	if not shipment.departure_time or not shipment.expected_arrival:
		return

	now = datetime.utcnow()
	# Strip timezone info from DB values (stored as UTC) to avoid naive/aware mismatch
	dep = shipment.departure_time.replace(tzinfo=None) if shipment.departure_time.tzinfo else shipment.departure_time
	arr = shipment.expected_arrival.replace(tzinfo=None) if shipment.expected_arrival.tzinfo else shipment.expected_arrival
	total_duration = (arr - dep).total_seconds()
	if total_duration <= 0:
		return

	elapsed = (now - dep).total_seconds()
	progress = max(0.0, min(1.0, elapsed / total_duration))

	# Map progress to a position along the waypoints array
	n = len(waypoints) - 1
	segment_float = progress * n
	segment_idx = min(int(segment_float), n - 1)
	segment_t = segment_float - segment_idx

	p1 = waypoints[segment_idx]
	p2 = waypoints[segment_idx + 1]

	lat = float(p1['lat']) + (float(p2['lat']) - float(p1['lat'])) * segment_t
	lng = float(p1['lng']) + (float(p2['lng']) - float(p1['lng'])) * segment_t

	shipment.current_latitude = round(lat, 7)
	shipment.current_longitude = round(lng, 7)


async def monitor_shipment(shipment_id: str, db: Session) -> dict | None:
	shipment = db.query(Shipment).filter(Shipment.shipment_id == UUID(shipment_id)).first()
	if not shipment:
		return None

	if shipment.current_status.value in {'delivered', 'cancelled'}:
		return None

	# ── Simulate position movement along the active route ─────────────
	active_route = next((route for route in shipment.routes if route.is_active), None)
	if active_route is None and shipment.routes:
		active_route = shipment.routes[0]
	if active_route is None or shipment.cargo is None:
		return None

	_advance_ship_position(shipment, active_route)

	if shipment.current_latitude is not None and shipment.current_longitude is not None:
		coords = (float(shipment.current_latitude), float(shipment.current_longitude))
	else:
		coords = (float(shipment.origin_port.latitude), float(shipment.origin_port.longitude))

	features = await build_feature_vector(
		shipment_id=shipment_id,
		current_coords=coords,
		destination_port_id=str(shipment.destination_port_id),
		route_id=str(active_route.route_id),
		cargo_sensitivity=float(shipment.cargo.cargo_sensitivity_score or 40),
		db=db,
	)

	risk_result = predict_risk_score(features)
	risk_score = float(risk_result['risk_score'])
	delay_hours = float(predict_delay_hours({**features, 'risk_score': risk_score}))
	reroute = predict_reroute_decision(features, risk_score, delay_hours, risk_trend=1)

	# Use the higher of stored vs calculated risk — don't downgrade critical shipments
	stored_risk = float(shipment.current_risk_score or 0)
	effective_risk = max(risk_score, stored_risk)
	risk_level = classify_risk_level(effective_risk)

	if effective_risk >= stored_risk:
		shipment.current_risk_score = round(effective_risk, 2)
		shipment.current_risk_level = _to_risk_enum(risk_level)

	prediction_row = ModelPrediction(
		shipment_id=shipment.shipment_id,
		prediction_timestamp=datetime.utcnow(),
		weather_score=features['weather_score'],
		traffic_score=features['traffic_score'],
		port_score=features['port_score'],
		historical_score=features['historical_score'],
		cargo_sensitivity=features['cargo_sensitivity'],
		distance_remaining=features['distance_remaining'],
		time_of_day=features['time_of_day'],
		day_of_week=features['day_of_week'],
		season=features['season'],
		risk_score=effective_risk,
		risk_level=_to_risk_enum(risk_level),
		predicted_delay_hr=delay_hours,
		reroute_recommended=reroute['decision'] == 'REROUTE' or effective_risk >= 60,
		confidence_percent=reroute['confidence'],
	)

	db.add(prediction_row)
	db.commit()

	await set_risk_score(shipment_id, effective_risk)

	log_payload = {
		'shipment_id': shipment_id,
		'timestamp': datetime.utcnow(),
		'input_features': features,
		'model_outputs': {
			'risk_score': effective_risk,
			'risk_level': risk_level,
			'predicted_delay_hr': delay_hours,
			'reroute_decision': reroute['decision'],
			'confidence_percent': reroute['confidence'],
		},
		'feature_importance': risk_result['feature_contributions'],
		'created_at': datetime.utcnow(),
	}
	await ml_prediction_logs.insert_one(log_payload)

	if effective_risk >= 70:
		severity = 'critical' if effective_risk >= 85 else 'high'
		await create_alert(
			db=db,
			shipment_id=shipment_id,
			alert_type='risk_increase',
			severity=severity,
			message=f'Risk increased to {effective_risk:.1f}. Recommended action: {reroute["decision"]}.',
			risk_score=effective_risk,
		)

	from app.routers.websocket import notify_risk_update

	user_ids = [str(uid) for uid in [shipment.shipper_id, shipment.assigned_manager_id, shipment.assigned_driver_id] if uid]
	await notify_risk_update(
		shipment_id=shipment_id,
		risk_data={
			'risk_score': round(risk_score, 2),
			'risk_level': risk_level,
			'predicted_delay_hr': round(delay_hours, 2),
			'reroute_decision': reroute['decision'],
			'message': 'Monitoring cycle complete',
		},
		user_ids=user_ids,
	)

	return log_payload
