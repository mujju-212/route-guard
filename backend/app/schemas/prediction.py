from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class FeatureImportance(BaseModel):
	weather_score: float
	traffic_score: float
	port_score: float
	historical_score: float
	cargo_sensitivity: float


class AlternateRoute(BaseModel):
	route_id: str
	name: str
	description: str
	risk_score: Decimal
	risk_level: str
	delay_hours: Decimal
	extra_distance_km: Decimal
	extra_time_hours: Decimal
	extra_cost_usd: Decimal
	optimization_score: Decimal
	recommended: bool
	waypoints: list[dict] = []


class FinancialImpact(BaseModel):
	current_route_damage_probability: Decimal
	current_route_expected_loss_usd: Decimal
	recommended_route_extra_cost_usd: Decimal
	recommended_route_expected_loss_usd: Decimal
	net_saving_usd: Decimal


class MLPredictionResponse(BaseModel):
	shipment_id: str
	prediction_timestamp: datetime
	input_features: dict
	model_outputs: dict
	feature_importance: FeatureImportance
	alternate_routes: list[AlternateRoute]
	financial_impact: FinancialImpact
