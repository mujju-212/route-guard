from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.port import Port
from app.models.route import Route, RouteType
from app.services.feature_engine import build_feature_vector, haversine_distance
from app.services.ml_service import classify_risk_level, predict_delay_hours, predict_risk_score


async def create_initial_route(db: Session, shipment_id: str, origin_port_id: str, destination_port_id: str) -> Route:
	origin = db.query(Port).filter(Port.port_id == UUID(origin_port_id)).first()
	destination = db.query(Port).filter(Port.port_id == UUID(destination_port_id)).first()
	if not origin or not destination:
		raise ValueError('Invalid origin or destination port')

	waypoints = generate_route_waypoints(
		(float(origin.latitude), float(origin.longitude)),
		(float(destination.latitude), float(destination.longitude)),
	)

	distance_km = haversine_distance(
		float(origin.latitude),
		float(origin.longitude),
		float(destination.latitude),
		float(destination.longitude),
	)

	return Route(
		shipment_id=UUID(shipment_id),
		route_type=RouteType.ORIGINAL,
		is_active=True,
		origin_port_id=origin.port_id,
		destination_port_id=destination.port_id,
		total_distance_km=round(distance_km, 2),
		estimated_duration_hr=round(distance_km / 28.0, 2),
		estimated_fuel_cost=round(distance_km * 2.4, 2),
		waypoints=waypoints,
	)


def generate_route_waypoints(origin: tuple[float, float], destination: tuple[float, float], steps: int = 10) -> list[dict[str, float]]:
	lat1, lng1 = origin
	lat2, lng2 = destination
	points: list[dict[str, float]] = []
	for index in range(steps + 1):
		t = index / steps
		lat = lat1 + (lat2 - lat1) * t
		lng = lng1 + (lng2 - lng1) * t
		points.append({'lat': lat, 'lng': lng})
	return points


def _generate_route_waypoints_with_deviation(
	origin: tuple[float, float],
	destination: tuple[float, float],
	deviation_lat: float,
	deviation_lng: float,
) -> list[dict[str, float]]:
	lat1, lng1 = origin
	lat2, lng2 = destination
	mid_lat = (lat1 + lat2) / 2 + deviation_lat
	mid_lng = (lng1 + lng2) / 2 + deviation_lng

	waypoints: list[dict[str, float]] = []
	for index in range(6):
		t = index / 5
		waypoints.append({'lat': lat1 + (mid_lat - lat1) * t, 'lng': lng1 + (mid_lng - lng1) * t})
	for index in range(1, 6):
		t = index / 5
		waypoints.append({'lat': mid_lat + (lat2 - mid_lat) * t, 'lng': mid_lng + (lng2 - mid_lng) * t})
	return waypoints


async def generate_alternate_routes(
	origin_coords: tuple[float, float],
	destination_coords: tuple[float, float],
	current_coords: tuple[float, float] | None = None,
) -> list[dict[str, Any]]:
	_ = current_coords

	return [
		{
			'name': 'Northern Route',
			'description': 'Avoids southern congestion corridor',
			'waypoints': _generate_route_waypoints_with_deviation(origin_coords, destination_coords, 4.0, 0.0),
			'extra_distance_km': 820,
		},
		{
			'name': 'Southern Route',
			'description': 'Lower weather volatility in current season',
			'waypoints': _generate_route_waypoints_with_deviation(origin_coords, destination_coords, -4.5, 0.0),
			'extra_distance_km': 740,
		},
		{
			'name': 'Accelerated Direct',
			'description': 'Fastest direct lane with elevated exposure',
			'waypoints': generate_route_waypoints(origin_coords, destination_coords),
			'extra_distance_km': 0,
		},
	]


async def score_alternate_route(shipment_id: str, route_waypoints: list[dict[str, float]], db: Session) -> dict[str, Any]:
	from app.models.shipment import Shipment

	shipment = db.query(Shipment).filter(Shipment.shipment_id == UUID(shipment_id)).first()
	if not shipment or not shipment.cargo:
		return {}

	midpoint = route_waypoints[len(route_waypoints) // 2]
	features = await build_feature_vector(
		shipment_id=shipment_id,
		current_coords=(midpoint['lat'], midpoint['lng']),
		destination_port_id=str(shipment.destination_port_id),
		route_id=str(shipment.routes[0].route_id) if shipment.routes else str(shipment.shipment_id),
		cargo_sensitivity=float(shipment.cargo.cargo_sensitivity_score or 40),
		db=db,
	)

	risk_result = predict_risk_score(features)
	delay_hours = predict_delay_hours({**features, 'risk_score': risk_result['risk_score']})

	extra_distance = float(max(len(route_waypoints) - 10, 0) * 70)
	extra_time = extra_distance / 30 if extra_distance else 0
	extra_cost = extra_distance * 2.2
	optimization_score = (risk_result['risk_score'] * 0.45) + (delay_hours * 0.35) + (extra_distance / 40 * 0.2)

	return {
		'route_id': str(UUID(int=abs(hash(str(route_waypoints))) % (1 << 128))),
		'name': 'Alternate Route',
		'description': 'ML-scored route option',
		'risk_score': Decimal(str(round(risk_result['risk_score'], 2))),
		'risk_level': classify_risk_level(risk_result['risk_score']),
		'delay_hours': Decimal(str(round(delay_hours, 2))),
		'extra_distance_km': Decimal(str(round(extra_distance, 2))),
		'extra_time_hours': Decimal(str(round(extra_time, 2))),
		'extra_cost_usd': Decimal(str(round(extra_cost, 2))),
		'optimization_score': Decimal(str(round(optimization_score, 2))),
		'recommended': risk_result['risk_score'] < 55,
	}
