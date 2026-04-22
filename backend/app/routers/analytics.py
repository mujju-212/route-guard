from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.mongodb import model_metrics
from app.database.postgres import SessionLocal, get_db
from app.dependencies import require_role
from app.models.cargo import Cargo
from app.models.manager_decision import ManagerDecision
from app.models.model_prediction import ModelPrediction
from app.models.shipment import RiskLevel, Shipment, ShipmentStatus
from app.models.user import User
from app.schemas.analytics import AnalyticsOverview, ModelAccuracy

router = APIRouter()


@router.get('/overview', response_model=AnalyticsOverview)
async def overview(current_user: User = Depends(require_role(['manager'])), db: Session = Depends(get_db)):
	_ = current_user
	active_filter = Shipment.current_status.notin_([ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED])

	active_shipments = db.query(func.count(Shipment.shipment_id)).filter(active_filter).scalar() or 0
	critical_count = db.query(func.count(Shipment.shipment_id)).filter(active_filter, Shipment.current_risk_level == RiskLevel.CRITICAL).scalar() or 0
	high_count = db.query(func.count(Shipment.shipment_id)).filter(active_filter, Shipment.current_risk_level == RiskLevel.HIGH).scalar() or 0
	medium_count = db.query(func.count(Shipment.shipment_id)).filter(active_filter, Shipment.current_risk_level == RiskLevel.MEDIUM).scalar() or 0
	low_count = db.query(func.count(Shipment.shipment_id)).filter(active_filter, Shipment.current_risk_level == RiskLevel.LOW).scalar() or 0

	thirty_days_ago = datetime.utcnow() - timedelta(days=30)
	delivered = (
		db.query(Shipment)
		.filter(Shipment.current_status == ShipmentStatus.DELIVERED, Shipment.actual_arrival >= thirty_days_ago)
		.all()
	)
	if delivered:
		on_time_count = sum(1 for item in delivered if not item.actual_delay_hours or float(item.actual_delay_hours) <= 2.0)
		on_time_pct = Decimal(str(round((on_time_count / len(delivered)) * 100, 2)))
	else:
		on_time_pct = Decimal('0')

	delayed_count = db.query(func.count(Shipment.shipment_id)).filter(Shipment.current_status == ShipmentStatus.DELAYED).scalar() or 0
	week_ago = datetime.utcnow() - timedelta(days=7)
	rerouted = (
		db.query(func.count(ManagerDecision.decision_id))
		.filter(ManagerDecision.decision_type == 'approve_reroute', ManagerDecision.decision_at >= week_ago)
		.scalar()
		or 0
	)
	total_value = (
		db.query(func.sum(Cargo.declared_value))
		.join(Shipment)
		.filter(active_filter)
		.scalar()
		or Decimal('0')
	)

	financial_saved = Decimal(str(rerouted * 61000))

	return AnalyticsOverview(
		total_active_shipments=int(active_shipments),
		critical_count=int(critical_count),
		high_risk_count=int(high_count),
		medium_risk_count=int(medium_count),
		low_risk_count=int(low_count),
		on_time_percentage=on_time_pct,
		delayed_count=int(delayed_count),
		rerouted_this_week=int(rerouted),
		total_value_monitored_usd=Decimal(str(total_value)),
		financial_losses_prevented_usd=financial_saved,
	)


@router.get('/accuracy', response_model=ModelAccuracy)
async def accuracy(current_user: User = Depends(require_role(['manager']))):
	_ = current_user
	xgb_metrics = await model_metrics.find_one({'model_name': 'xgboost', 'is_current': True})
	rf_metrics = await model_metrics.find_one({'model_name': 'random_forest', 'is_current': True})
	gb_metrics = await model_metrics.find_one({'model_name': 'gradient_boosting', 'is_current': True})

	db = SessionLocal()
	try:
		total_predictions = db.query(func.count(ModelPrediction.prediction_id)).scalar() or 0
		decisions = db.query(ManagerDecision).filter(ManagerDecision.outcome.in_(['successful', 'unsuccessful'])).all()
		correct = sum(1 for item in decisions if str(item.outcome) == 'successful' or getattr(item.outcome, 'value', '') == 'successful')
		incorrect = len(decisions) - correct
	finally:
		db.close()

	return ModelAccuracy(
		overall_model_accuracy=Decimal(str(round(float(xgb_metrics.get('r2', 0.85)) * 100 if xgb_metrics else 85.0, 2))),
		xgboost_rmse=Decimal(str(xgb_metrics.get('rmse', 0.0) if xgb_metrics else 0.0)),
		xgboost_r2=Decimal(str(xgb_metrics.get('r2', 0.85) if xgb_metrics else 0.85)),
		random_forest_delay_mae=Decimal(str(rf_metrics.get('mae', 0.0) if rf_metrics else 0.0)),
		gradient_boost_accuracy=Decimal(str(gb_metrics.get('accuracy', 0.0) if gb_metrics else 0.0)),
		total_predictions_made=int(total_predictions),
		correct_reroute_decisions=int(correct),
		incorrect_reroute_decisions=int(incorrect),
	)
