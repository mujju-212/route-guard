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


def generate_route_waypoints(origin: tuple[float, float], destination: tuple[float, float], steps: int = 20) -> list[dict[str, float]]:
	"""Generate waypoints along a great-circle (geodesic) path between two points.
	This creates curved routes that follow the Earth's curvature, similar to
	how shipping routes appear on Google Maps."""
	import math
	lat1, lng1 = math.radians(origin[0]), math.radians(origin[1])
	lat2, lng2 = math.radians(destination[0]), math.radians(destination[1])

	# Central angle between the two points
	d = math.acos(
		min(1.0, max(-1.0,
			math.sin(lat1) * math.sin(lat2) +
			math.cos(lat1) * math.cos(lat2) * math.cos(lng2 - lng1)
		))
	)

	points: list[dict[str, float]] = []
	for index in range(steps + 1):
		t = index / steps
		if d < 1e-6:
			# Points are too close — just interpolate linearly
			lat = origin[0] + (destination[0] - origin[0]) * t
			lng = origin[1] + (destination[1] - origin[1]) * t
		else:
			# Spherical linear interpolation (slerp)
			a = math.sin((1 - t) * d) / math.sin(d)
			b = math.sin(t * d) / math.sin(d)
			x = a * math.cos(lat1) * math.cos(lng1) + b * math.cos(lat2) * math.cos(lng2)
			y = a * math.cos(lat1) * math.sin(lng1) + b * math.cos(lat2) * math.sin(lng2)
			z = a * math.sin(lat1) + b * math.sin(lat2)
			lat = math.degrees(math.atan2(z, math.sqrt(x * x + y * y)))
			lng = math.degrees(math.atan2(y, x))
		points.append({'lat': round(lat, 6), 'lng': round(lng, 6)})
	return points


def _generate_route_waypoints_with_deviation(
	origin: tuple[float, float],
	destination: tuple[float, float],
	deviation_lat: float,
	deviation_lng: float,
) -> list[dict[str, float]]:
	"""Generate a curved route that passes through a deviated midpoint.
	Creates two great-circle arcs: origin→midpoint and midpoint→destination."""
	mid_lat = (origin[0] + destination[0]) / 2 + deviation_lat
	mid_lng = (origin[1] + destination[1]) / 2 + deviation_lng
	midpoint = (mid_lat, mid_lng)

	# First half: origin → midpoint (10 steps)
	first_half = generate_route_waypoints(origin, midpoint, steps=10)
	# Second half: midpoint → destination (10 steps, skip first to avoid duplicate)
	second_half = generate_route_waypoints(midpoint, destination, steps=10)
	return first_half + second_half[1:]


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

	# Count existing alternate routes for this shipment to pick the right type
	existing_alts = db.query(Route).filter(
		Route.shipment_id == UUID(shipment_id),
		Route.route_type != RouteType.ORIGINAL,
	).count()
	alt_types = [RouteType.ALTERNATE_1, RouteType.ALTERNATE_2, RouteType.ALTERNATE_3]
	route_type = alt_types[min(existing_alts, len(alt_types) - 1)]

	# Calculate total distance for this route
	total_dist = haversine_distance(
		route_waypoints[0]['lat'], route_waypoints[0]['lng'],
		route_waypoints[-1]['lat'], route_waypoints[-1]['lng'],
	) + extra_distance

	# Save the route to DB so approve_reroute can find it
	new_route = Route(
		shipment_id=UUID(shipment_id),
		route_type=route_type,
		is_active=False,
		origin_port_id=shipment.origin_port_id,
		destination_port_id=shipment.destination_port_id,
		total_distance_km=round(total_dist, 2),
		estimated_duration_hr=round(total_dist / 28.0, 2),
		estimated_fuel_cost=round(extra_cost, 2),
		waypoints=route_waypoints,
		risk_score_at_creation=Decimal(str(round(risk_result['risk_score'], 2))),
	)
	db.add(new_route)
	db.flush()  # Get the generated route_id

	return {
		'route_id': str(new_route.route_id),
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
		'waypoints': route_waypoints,
	}
