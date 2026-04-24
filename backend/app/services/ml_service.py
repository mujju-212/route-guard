from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import joblib
import numpy as np
import pandas as pd

# Try PyTorch first (our LSTM is a .pt file trained with PyTorch)
try:
	import torch
	_torch_available = True
except ImportError:
	_torch_available = False

# TensorFlow/Keras fallback (not used, kept for compatibility)
try:
	from tensorflow.keras.models import load_model as _keras_load
except Exception:
	_keras_load = None

from app.database.mongodb import ml_prediction_logs
from app.database.redis_client import set_risk_score
from app.models.route import Route, RouteType
from app.models.shipment import RiskLevel, Shipment
from app.services.feature_engine import build_feature_vector

ML_MODELS_PATH = Path(__file__).resolve().parents[3] / 'ml' / 'models'


def _safe_load_pickle(path: Path):
	try:
		return joblib.load(path)
	except Exception:
		return None


def _safe_load_lstm(path: Path):
	"""Load PyTorch LSTM from .pt file (trained with torch, not Keras)."""
	if not _torch_available:
		return None
	try:
		model = torch.load(path, map_location='cpu', weights_only=False)
		if callable(getattr(model, 'eval', None)):
			model.eval()
		return model
	except Exception:
		return None


xgboost_model = _safe_load_pickle(ML_MODELS_PATH / 'xgboost_risk.pkl')
rf_model = _safe_load_pickle(ML_MODELS_PATH / 'random_forest_delay.pkl')
gb_model = _safe_load_pickle(ML_MODELS_PATH / 'gradient_boosting_reroute.pkl')
# LSTM is a PyTorch .pt file (not Keras .h5) — load accordingly
lstm_model = _safe_load_lstm(ML_MODELS_PATH / 'lstm_trajectory.pt')


def predict_risk_score(features_dict: dict) -> dict[str, Any]:
	if xgboost_model is None:
		risk = (
			features_dict.get('weather_score', 0) * 0.22
			+ features_dict.get('traffic_score', 0) * 0.19
			+ features_dict.get('port_score', 0) * 0.17
			+ features_dict.get('historical_score', 0) * 0.16
			+ features_dict.get('cargo_sensitivity', 0) * 0.18
		)
		risk_score = max(0.0, min(100.0, float(risk)))
		return {
			'risk_score': risk_score,
			'feature_contributions': {
				'weather_score': 0.22,
				'traffic_score': 0.19,
				'port_score': 0.17,
				'historical_score': 0.16,
				'cargo_sensitivity': 0.18,
			},
		}

	# XGBoost was trained on 14 features: 9 core + 5 extended AIS features
	_xgb_cols = ['weather_score','traffic_score','port_score','historical_score','cargo_sensitivity',
		'distance_remaining_km','time_of_day','day_of_week','season',
		'speed_ratio','heading_cog_diff','draft_ratio','ETA_hours','SOG_kmh']
	feature_array = pd.DataFrame([[
		features_dict.get('weather_score', 0),
		features_dict.get('traffic_score', 0),
		features_dict.get('port_score', 0),
		features_dict.get('historical_score', 0),
		features_dict.get('cargo_sensitivity', 0),
		features_dict.get('distance_remaining', 0),
		features_dict.get('time_of_day', 0),
		features_dict.get('day_of_week', 0),
		features_dict.get('season', 0),
		features_dict.get('speed_ratio', 0.85),
		features_dict.get('heading_cog_diff', 5.0),
		features_dict.get('draft_ratio', 0.7),
		features_dict.get('ETA_hours', 72.0),
		features_dict.get('SOG_kmh', 26.0),
	]], columns=_xgb_cols)

	risk_score = max(0.0, min(100.0, float(xgboost_model.predict(feature_array)[0])))
	importances = getattr(xgboost_model, 'feature_importances_', [0.2, 0.2, 0.2, 0.2, 0.2])

	feature_contributions = {
		'weather_score': float(importances[0]) if len(importances) > 0 else 0.2,
		'traffic_score': float(importances[1]) if len(importances) > 1 else 0.2,
		'port_score': float(importances[2]) if len(importances) > 2 else 0.2,
		'historical_score': float(importances[3]) if len(importances) > 3 else 0.2,
		'cargo_sensitivity': float(importances[4]) if len(importances) > 4 else 0.2,
	}

	return {'risk_score': risk_score, 'feature_contributions': feature_contributions}


def predict_delay_hours(features_dict: dict) -> float:
	if rf_model is None:
		risk_score = float(features_dict.get('risk_score', 45))
		return max(0.0, (risk_score - 35) * 0.45)

	# RF was trained on 15 features: 14 + risk_score (log1p target transform)
	_rf_cols = ['weather_score','traffic_score','port_score','historical_score','cargo_sensitivity',
		'distance_remaining_km','time_of_day','day_of_week','season',
		'speed_ratio','heading_cog_diff','draft_ratio','ETA_hours','SOG_kmh','risk_score']
	feature_array = pd.DataFrame([[
		features_dict.get('weather_score', 0),
		features_dict.get('traffic_score', 0),
		features_dict.get('port_score', 0),
		features_dict.get('historical_score', 0),
		features_dict.get('cargo_sensitivity', 0),
		features_dict.get('distance_remaining', 0),
		features_dict.get('time_of_day', 0),
		features_dict.get('day_of_week', 0),
		features_dict.get('season', 0),
		features_dict.get('speed_ratio', 0.85),
		features_dict.get('heading_cog_diff', 5.0),
		features_dict.get('draft_ratio', 0.7),
		features_dict.get('ETA_hours', 72.0),
		features_dict.get('SOG_kmh', 26.0),
		features_dict.get('risk_score', 0),
	]], columns=_rf_cols)
	# Apply expm1 to reverse the log1p target transform used during training
	raw = float(rf_model.predict(feature_array)[0])
	return max(0.0, float(np.expm1(raw)))


def predict_reroute_decision(features_dict: dict, risk_score: float, delay_hours: float, risk_trend: int) -> dict[str, Any]:
	if gb_model is None:
		decision = 'REROUTE' if risk_score > 62 or delay_hours > 10 or risk_trend > 0 else 'STAY'
		confidence = min(98.0, max(55.0, (risk_score * 0.6) + (delay_hours * 2.2)))
		prob = confidence if decision == 'REROUTE' else 100 - confidence
		return {'decision': decision, 'confidence': confidence, 'probability_reroute': float(prob)}

	# GB was trained on 11 features: 9 core + risk_score + delay_hours
	_gb_cols = ['weather_score','traffic_score','port_score','historical_score','cargo_sensitivity',
		'distance_remaining_km','time_of_day','day_of_week','season','risk_score','delay_hours']
	feature_array = pd.DataFrame([[
		features_dict.get('weather_score', 0),
		features_dict.get('traffic_score', 0),
		features_dict.get('port_score', 0),
		features_dict.get('historical_score', 0),
		features_dict.get('cargo_sensitivity', 0),
		features_dict.get('distance_remaining', 0),
		features_dict.get('time_of_day', 0),
		features_dict.get('day_of_week', 0),
		features_dict.get('season', 0),
		risk_score,
		delay_hours,
	]], columns=_gb_cols)

	prediction = int(gb_model.predict(feature_array)[0])
	probabilities = gb_model.predict_proba(feature_array)[0]
	if prediction == 1:
		decision = 'REROUTE'
		confidence = float(probabilities[1] * 100)
	else:
		decision = 'STAY'
		confidence = float(probabilities[0] * 100)

	return {
		'decision': decision,
		'confidence': confidence,
		'probability_reroute': float(probabilities[1] * 100),
	}


def predict_risk_trajectory(recent_scores: list[float]) -> list[float]:
	if lstm_model is None or len(recent_scores) < 12:
		if not recent_scores:
			return [40.0] * 12
		base = recent_scores[-1]
		return [max(0.0, min(100.0, base + (idx * 0.8))) for idx in range(12)]

	try:
		# PyTorch LSTM inference
		if _torch_available and hasattr(lstm_model, 'parameters'):
			with torch.no_grad():
				sequence = torch.tensor(
					np.array(recent_scores[-12:]).reshape(1, 12, 1),
					dtype=torch.float32,
				)
				output = lstm_model(sequence)
				predictions = output.squeeze().cpu().numpy().flatten()
				return [max(0.0, min(100.0, float(v))) for v in predictions[:12]]
		# Fallback: if it's a callable (Keras-style)
		sequence = np.array(recent_scores[-12:]).reshape(1, 12, 1)
		predictions = lstm_model(sequence)[0]
		return [max(0.0, min(100.0, float(value))) for value in predictions]
	except Exception:
		base = recent_scores[-1]
		return [max(0.0, min(100.0, base + (idx * 0.8))) for idx in range(12)]


def classify_risk_level(risk_score: float) -> str:
	if risk_score >= 80:
		return 'critical'
	if risk_score >= 60:
		return 'high'
	if risk_score >= 40:
		return 'medium'
	return 'low'


def _risk_level_enum(score: float) -> RiskLevel:
	level = classify_risk_level(score)
	if level == 'critical':
		return RiskLevel.CRITICAL
	if level == 'high':
		return RiskLevel.HIGH
	if level == 'medium':
		return RiskLevel.MEDIUM
	return RiskLevel.LOW


async def run_complete_ml_pipeline(shipment_id: str, db, current_coords: tuple[float, float] | None = None) -> dict[str, Any]:
	from app.services.route_service import generate_alternate_routes, score_alternate_route

	shipment_uuid = UUID(shipment_id)
	shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_uuid).first()
	if not shipment:
		raise ValueError('Shipment not found')

	if current_coords is None:
		if shipment.current_latitude is not None and shipment.current_longitude is not None:
			coords = (float(shipment.current_latitude), float(shipment.current_longitude))
		else:
			coords = (float(shipment.origin_port.latitude), float(shipment.origin_port.longitude))
	else:
		coords = current_coords

	active_route = next((route for route in shipment.routes if route.is_active), None)
	if active_route is None and shipment.routes:
		active_route = shipment.routes[0]

	if active_route is None:
		raise ValueError('No route available for shipment')

	features = await build_feature_vector(
		shipment_id=str(shipment.shipment_id),
		current_coords=coords,
		destination_port_id=str(shipment.destination_port_id),
		route_id=str(active_route.route_id),
		cargo_sensitivity=float(shipment.cargo.cargo_sensitivity_score or 40),
		db=db,
	)

	risk_result = predict_risk_score(features)
	delay_hours = predict_delay_hours({**features, 'risk_score': risk_result['risk_score']})
	risk_trend = 1 if risk_result['risk_score'] > 55 else (-1 if risk_result['risk_score'] < 30 else 0)
	reroute_result = predict_reroute_decision(features, risk_result['risk_score'], delay_hours, risk_trend=risk_trend)

	alternate_candidates = await generate_alternate_routes(
		origin_coords=(float(shipment.origin_port.latitude), float(shipment.origin_port.longitude)),
		destination_coords=(float(shipment.destination_port.latitude), float(shipment.destination_port.longitude)),
		current_coords=coords,
	)

	# Compute base route distance once so all alternates compare against the same baseline
	base_dist_km: float | None = None
	if active_route and active_route.total_distance_km:
		base_dist_km = float(active_route.total_distance_km)

	scored_routes: list[dict[str, Any]] = []
	for idx, route in enumerate(alternate_candidates):
		scored = await score_alternate_route(
			str(shipment.shipment_id),
			route['waypoints'],
			db,
			base_distance_km=base_dist_km,
		)
		if not scored:
			continue
		scored['name'] = route.get('name', scored['name'])
		scored['description'] = route.get('description', scored['description'])
		# score_alternate_route already persisted the Route; just capture it
		scored_routes.append(scored)

	db.commit()

	prediction_timestamp = datetime.utcnow()

	# Use the higher of stored risk vs freshly calculated risk for display
	effective_risk = max(risk_result['risk_score'], float(shipment.current_risk_score or 0))

	model_outputs = {
		'risk_score': round(effective_risk, 2),
		'risk_level': classify_risk_level(effective_risk),
		'predicted_delay_hr': round(delay_hours, 2),
		'reroute_decision': reroute_result['decision'] if effective_risk <= risk_result['risk_score'] else 'REROUTE',
		'confidence_percent': round(float(reroute_result['confidence']), 2),
	}

	financial_impact = {
		'current_route_damage_probability': round(effective_risk / 100, 4),
		'current_route_expected_loss_usd': round(effective_risk * 620, 2),
		'recommended_route_extra_cost_usd': round(float(scored_routes[0]['extra_cost_usd']) if scored_routes else 0.0, 2),
		'recommended_route_expected_loss_usd': round((effective_risk * 0.72) * 620, 2),
		'net_saving_usd': round((effective_risk * 620) - ((effective_risk * 0.72) * 620), 2),
	}

	log_payload = {
		'shipment_id': str(shipment.shipment_id),
		'timestamp': prediction_timestamp,
		'input_features': features,
		'model_outputs': model_outputs,
		'feature_importance': risk_result['feature_contributions'],
		'alternate_routes_scored': scored_routes,
		'financial_impact': financial_impact,
		'created_at': prediction_timestamp,
	}

	await ml_prediction_logs.insert_one(log_payload)

	# Only escalate risk — don't overwrite a higher stored score with a lower ML recalculation.
	# The monitoring job handles gradual risk reduction over time.
	new_risk = round(risk_result['risk_score'], 2)
	stored_risk = float(shipment.current_risk_score or 0)
	if new_risk >= stored_risk:
		shipment.current_risk_score = new_risk
		shipment.current_risk_level = _risk_level_enum(new_risk)
		db.commit()

	await set_risk_score(str(shipment.shipment_id), max(new_risk, stored_risk))

	return {
		'shipment_id': str(shipment.shipment_id),
		'prediction_timestamp': prediction_timestamp,
		'input_features': features,
		'model_outputs': model_outputs,
		'feature_importance': risk_result['feature_contributions'],
		'alternate_routes': scored_routes,
		'financial_impact': financial_impact,
	}
