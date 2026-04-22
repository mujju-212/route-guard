import math
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.model_prediction import ModelPrediction
from app.models.port import Port
from app.models.route import Route
from app.services.port_service import get_port_conditions
from app.services.traffic_service import fetch_traffic_data
from app.services.weather_service import fetch_marine_weather, fetch_weather_data


async def build_feature_vector(
	shipment_id: str,
	current_coords: tuple[float, float],
	destination_port_id: str,
	route_id: str,
	cargo_sensitivity: float,
	db: Session,
) -> dict[str, Any]:
	lat, lng = current_coords

	weather_data = await fetch_weather_data(lat, lng)
	weather_score = calculate_weather_score(weather_data)

	if is_at_sea(current_coords):
		traffic_score = await calculate_sea_score(lat, lng, weather_data)
	else:
		traffic_data = await fetch_traffic_data(lat, lng)
		traffic_score = calculate_traffic_score(traffic_data)

	port_state = await get_port_conditions(destination_port_id)
	port_score = calculate_port_score(port_state)
	historical_score = await calculate_historical_score(route_id, db)

	destination_port = db.query(Port).filter(Port.port_id == UUID(destination_port_id)).first()
	if destination_port:
		distance_remaining = haversine_distance(
			lat,
			lng,
			float(destination_port.latitude),
			float(destination_port.longitude),
		)
	else:
		distance_remaining = 0.0

	now = datetime.utcnow()

	return {
		'shipment_id': shipment_id,
		'weather_score': round(weather_score, 2),
		'traffic_score': round(traffic_score, 2),
		'port_score': round(port_score, 2),
		'historical_score': round(historical_score, 2),
		'cargo_sensitivity': round(float(cargo_sensitivity), 2),
		'distance_remaining': round(distance_remaining, 2),
		'time_of_day': now.hour,
		'day_of_week': now.weekday(),
		'season': get_season(now.month),
	}


def calculate_weather_score(weather_data: dict) -> float:
	condition = weather_data.get('weather', [{}])[0].get('main', 'Clear')
	condition_scores = {
		'Clear': 0,
		'Clouds': 10,
		'Mist': 15,
		'Drizzle': 20,
		'Rain': 35,
		'Thunderstorm': 60,
		'Snow': 40,
		'Squall': 70,
		'Tornado': 100,
	}

	score = float(condition_scores.get(condition, 20))

	wind_speed_ms = float(weather_data.get('wind', {}).get('speed', 0))
	wind_kmph = wind_speed_ms * 3.6
	if wind_kmph > 90:
		score += 50
	elif wind_kmph > 70:
		score += 35
	elif wind_kmph > 50:
		score += 20

	visibility = float(weather_data.get('visibility', 10000))
	if visibility < 100:
		score += 30
	elif visibility < 500:
		score += 20
	elif visibility < 1000:
		score += 10

	rain_1h = float(weather_data.get('rain', {}).get('1h', 0))
	if rain_1h > 10:
		score += 20
	elif rain_1h > 5:
		score += 10

	return min(100.0, score)


def calculate_traffic_score(traffic_data: dict) -> float:
	if not traffic_data:
		return 25.0

	current_speed = float(traffic_data.get('currentSpeed', 80))
	free_flow_speed = float(traffic_data.get('freeFlowSpeed', 80))
	if free_flow_speed <= 0:
		return 50.0

	ratio = current_speed / free_flow_speed
	if ratio >= 0.9:
		score = 10
	elif ratio >= 0.7:
		score = 30
	elif ratio >= 0.5:
		score = 55
	elif ratio >= 0.3:
		score = 75
	else:
		score = 90

	if traffic_data.get('roadClosure', False):
		score = 100

	score += len(traffic_data.get('incidents', [])) * 5
	return min(100.0, float(score))


async def calculate_sea_score(lat: float, lng: float, weather_data: dict) -> float:
	marine_data = await fetch_marine_weather(lat, lng)
	if not marine_data:
		return min(100.0, calculate_weather_score(weather_data) * 0.85)

	hours = marine_data.get('hours', [])
	if not hours:
		return min(100.0, calculate_weather_score(weather_data) * 0.85)

	latest = hours[0]
	wave_height = float(latest.get('waveHeight', {}).get('sg', 0) or 0)
	wind_speed = float(latest.get('windSpeed', {}).get('sg', 0) or 0)
	swell_height = float(latest.get('swellHeight', {}).get('sg', 0) or 0)

	score = (wave_height * 18) + (wind_speed * 2.8) + (swell_height * 14)
	return min(100.0, score)


def calculate_port_score(port_conditions: dict) -> float:
	if not port_conditions:
		return 20.0

	status_scores = {
		'normal': 10,
		'busy': 30,
		'congested': 55,
		'severely_congested': 80,
		'closed': 100,
	}

	status = str(port_conditions.get('operational_status', 'normal'))
	score = float(status_scores.get(status, 35))

	vessels_waiting = int(port_conditions.get('vessels_in_queue', 0) or 0)
	if vessels_waiting > 30:
		score += 35
	elif vessels_waiting > 15:
		score += 25
	elif vessels_waiting > 5:
		score += 15

	wait_hours = float(port_conditions.get('average_wait_hours', 0) or 0)
	if wait_hours > 24:
		score += 30
	elif wait_hours > 12:
		score += 20
	elif wait_hours > 6:
		score += 10

	return min(100.0, score)


async def calculate_historical_score(route_id: str, db: Session) -> float:
	try:
		route_uuid = UUID(route_id)
	except ValueError:
		return 50.0

	route = db.query(Route).filter(Route.route_id == route_uuid).first()
	if not route:
		return 50.0

	predictions = (
		db.query(ModelPrediction)
		.join(Route, Route.shipment_id == ModelPrediction.shipment_id)
		.filter(
			Route.origin_port_id == route.origin_port_id,
			Route.destination_port_id == route.destination_port_id,
			ModelPrediction.actual_delay_hr.isnot(None),
		)
		.limit(50)
		.all()
	)

	if not predictions:
		return 50.0

	avg_delay = sum(float(p.actual_delay_hr or 0) for p in predictions) / len(predictions)
	return min(100.0, (avg_delay / 24.0) * 100.0)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
	radius_km = 6371.0
	lat1_rad = math.radians(lat1)
	lat2_rad = math.radians(lat2)
	delta_lat = math.radians(lat2 - lat1)
	delta_lon = math.radians(lon2 - lon1)

	a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
	c = 2 * math.asin(math.sqrt(a))
	return radius_km * c


def is_at_sea(coords: tuple[float, float]) -> bool:
	lat, lng = coords
	if abs(lat) > 80:
		return True
	pacific = (-180 < lng < -100 or 100 < lng < 180) and -60 < lat < 60
	atlantic = -80 < lng < 20 and -60 < lat < 70
	indian = 40 < lng < 120 and -60 < lat < 30
	return pacific or atlantic or indian


def get_season(month: int) -> int:
	if month in (12, 1, 2):
		return 1
	if month in (3, 4, 5):
		return 2
	if month in (6, 7, 8):
		return 3
	return 4
