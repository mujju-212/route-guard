from decimal import Decimal

from pydantic import BaseModel


class AnalyticsOverview(BaseModel):
	total_active_shipments: int
	critical_count: int
	high_risk_count: int
	medium_risk_count: int
	low_risk_count: int
	on_time_percentage: Decimal
	delayed_count: int
	rerouted_this_week: int
	total_value_monitored_usd: Decimal
	financial_losses_prevented_usd: Decimal


class ModelAccuracy(BaseModel):
	overall_model_accuracy: Decimal
	xgboost_rmse: Decimal
	xgboost_r2: Decimal
	random_forest_delay_mae: Decimal
	gradient_boost_accuracy: Decimal
	total_predictions_made: int
	correct_reroute_decisions: int
	incorrect_reroute_decisions: int


class RiskDistributionDay(BaseModel):
	date: str
	critical: int
	high: int
	medium: int
	low: int
