from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.database.redis_client import get_risk_score
from app.dependencies import get_current_user
from app.models.manager_decision import DecisionType, ManagerDecision
from app.models.route import Route
from app.models.shipment import Shipment
from app.models.user import User
from app.schemas.prediction import AlternateRoute, FeatureImportance, FinancialImpact, MLPredictionResponse
from app.services.ml_service import run_complete_ml_pipeline
from app.services.route_service import generate_alternate_routes, score_alternate_route

router = APIRouter()


def _role_value(user: User) -> str:
	return user.role.value if hasattr(user.role, 'value') else str(user.role)


@router.get('/{shipment_id}/risk')
async def get_current_risk(shipment_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	shipment = db.query(Shipment).filter(Shipment.shipment_id == UUID(shipment_id)).first()
	if not shipment:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Shipment not found')

	authorized = (
		shipment.shipper_id == current_user.user_id
		or shipment.receiver_id == current_user.user_id
		or shipment.assigned_driver_id == current_user.user_id
		or shipment.assigned_manager_id == current_user.user_id
		or _role_value(current_user) == 'manager'
	)
	if not authorized:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Not authorized')

	cached_score = await get_risk_score(shipment_id)
	if cached_score is not None:
		return {
			'shipment_id': shipment_id,
			'risk_score': round(float(cached_score), 2),
			'risk_level': shipment.current_risk_level.value if shipment.current_risk_level else None,
			'cached': True,
		}

	return {
		'shipment_id': shipment_id,
		'risk_score': float(shipment.current_risk_score) if shipment.current_risk_score is not None else None,
		'risk_level': shipment.current_risk_level.value if shipment.current_risk_level else None,
		'cached': False,
	}


@router.get('/{shipment_id}/prediction', response_model=MLPredictionResponse)
async def get_prediction(shipment_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	shipment = db.query(Shipment).filter(Shipment.shipment_id == UUID(shipment_id)).first()
	if not shipment:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Shipment not found')

	role = _role_value(current_user)
	if role != 'manager' and shipment.shipper_id != current_user.user_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Full prediction details are manager-only')

	prediction = await run_complete_ml_pipeline(shipment_id=shipment_id, db=db)

	feature_importance = prediction.get('feature_importance', {})
	financial_impact = prediction.get('financial_impact', {})
	alternates = prediction.get('alternate_routes', [])

	return MLPredictionResponse(
		shipment_id=shipment_id,
		prediction_timestamp=prediction.get('prediction_timestamp', datetime.utcnow()),
		input_features=prediction.get('input_features', {}),
		model_outputs=prediction.get('model_outputs', {}),
		feature_importance=FeatureImportance(
			weather_score=float(feature_importance.get('weather_score', 0.2)),
			traffic_score=float(feature_importance.get('traffic_score', 0.2)),
			port_score=float(feature_importance.get('port_score', 0.2)),
			historical_score=float(feature_importance.get('historical_score', 0.2)),
			cargo_sensitivity=float(feature_importance.get('cargo_sensitivity', 0.2)),
		),
		alternate_routes=[
			AlternateRoute(
				route_id=str(route.get('route_id')),
				name=str(route.get('name', 'Alternate Route')),
				description=str(route.get('description', 'Scored route option')),
				risk_score=Decimal(str(route.get('risk_score', 0))),
				risk_level=str(route.get('risk_level', 'medium')),
				delay_hours=Decimal(str(route.get('delay_hours', 0))),
				extra_distance_km=Decimal(str(route.get('extra_distance_km', 0))),
				extra_time_hours=Decimal(str(route.get('extra_time_hours', 0))),
				extra_cost_usd=Decimal(str(route.get('extra_cost_usd', 0))),
				optimization_score=Decimal(str(route.get('optimization_score', 0))),
				recommended=bool(route.get('recommended', False)),
				waypoints=route.get('waypoints', []),
			)
			for route in alternates
		],
		financial_impact=FinancialImpact(
			current_route_damage_probability=Decimal(str(financial_impact.get('current_route_damage_probability', 0))),
			current_route_expected_loss_usd=Decimal(str(financial_impact.get('current_route_expected_loss_usd', 0))),
			recommended_route_extra_cost_usd=Decimal(str(financial_impact.get('recommended_route_extra_cost_usd', 0))),
			recommended_route_expected_loss_usd=Decimal(str(financial_impact.get('recommended_route_expected_loss_usd', 0))),
			net_saving_usd=Decimal(str(financial_impact.get('net_saving_usd', 0))),
		),
	)


@router.get('/{shipment_id}/routes', response_model=list[AlternateRoute])
async def get_routes(shipment_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	if _role_value(current_user) != 'manager':
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Manager access required')

	shipment = db.query(Shipment).filter(Shipment.shipment_id == UUID(shipment_id)).first()
	if not shipment:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Shipment not found')

	# Clean up old non-active alternate routes before generating new ones
	from app.models.route import Route as RouteModel, RouteType
	db.query(RouteModel).filter(
		RouteModel.shipment_id == shipment.shipment_id,
		RouteModel.route_type != RouteType.ORIGINAL,
		RouteModel.is_active.is_(False),
	).delete(synchronize_session='fetch')
	db.flush()

	alternates = await generate_alternate_routes(
		origin_coords=(float(shipment.origin_port.latitude), float(shipment.origin_port.longitude)),
		destination_coords=(float(shipment.destination_port.latitude), float(shipment.destination_port.longitude)),
		current_coords=(float(shipment.current_latitude), float(shipment.current_longitude))
		if shipment.current_latitude is not None and shipment.current_longitude is not None
		else None,
	)

	results: list[AlternateRoute] = []
	for route in alternates:
		scored = await score_alternate_route(shipment_id=shipment_id, route_waypoints=route['waypoints'], db=db)
		if not scored:
			continue
		scored['name'] = route['name']
		scored['description'] = route['description']
		results.append(
			AlternateRoute(
				route_id=str(scored['route_id']),
				name=str(scored['name']),
				description=str(scored['description']),
				risk_score=Decimal(str(scored['risk_score'])),
				risk_level=str(scored['risk_level']),
				delay_hours=Decimal(str(scored['delay_hours'])),
				extra_distance_km=Decimal(str(scored['extra_distance_km'])),
				extra_time_hours=Decimal(str(scored['extra_time_hours'])),
				extra_cost_usd=Decimal(str(scored['extra_cost_usd'])),
				optimization_score=Decimal(str(scored['optimization_score'])),
				recommended=bool(scored['recommended']),
				waypoints=scored.get('waypoints', []),
			)
		)

	db.commit()  # Persist the saved alternate routes
	return results


@router.post('/{shipment_id}/reroute')
async def approve_reroute(
	shipment_id: str,
	route_id: str = Query(...),
	current_user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	if _role_value(current_user) != 'manager':
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Manager access required')

	shipment = db.query(Shipment).filter(Shipment.shipment_id == UUID(shipment_id)).first()
	if not shipment:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Shipment not found')

	new_route = db.query(Route).filter(Route.route_id == UUID(route_id)).first()
	if not new_route or new_route.shipment_id != shipment.shipment_id:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Route not found')

	old_route = db.query(Route).filter(Route.shipment_id == shipment.shipment_id, Route.is_active.is_(True)).first()
	if old_route:
		old_route.is_active = False

	new_route.is_active = True
	new_route.approved_by = current_user.user_id
	new_route.approved_at = datetime.utcnow()

	shipment.is_rerouted = True
	shipment.reroute_count += 1

	decision = ManagerDecision(
		shipment_id=shipment.shipment_id,
		manager_id=current_user.user_id,
		decision_type=DecisionType.APPROVE_REROUTE,
		original_route_id=old_route.route_id if old_route else None,
		new_route_id=new_route.route_id,
		risk_score_at_decision=shipment.current_risk_score,
		decision_reason='Manager approved alternate route via dashboard',
	)
	db.add(decision)
	db.commit()

	from app.routers.websocket import notify_route_change

	await notify_route_change(
		shipment_id=shipment_id,
		old_route_id=str(old_route.route_id) if old_route else '',
		new_route_id=str(new_route.route_id),
		manager_name=current_user.full_name,
	)

	return {'message': 'Reroute approved successfully', 'new_route_id': str(new_route.route_id)}
