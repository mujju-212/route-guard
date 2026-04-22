import httpx

from app.config import settings


async def fetch_weather_data(lat: float, lng: float) -> dict:
	if not settings.OPENWEATHERMAP_API_KEY:
		return {
			'weather': [{'main': 'Clear'}],
			'wind': {'speed': 6.0},
			'visibility': 10000,
			'rain': {'1h': 0.0},
		}

	url = 'https://api.openweathermap.org/data/2.5/weather'
	params = {'lat': lat, 'lon': lng, 'appid': settings.OPENWEATHERMAP_API_KEY, 'units': 'metric'}

	async with httpx.AsyncClient(timeout=10.0) as client:
		try:
			response = await client.get(url, params=params)
			response.raise_for_status()
			return response.json()
		except Exception:
			return {
				'weather': [{'main': 'Clouds'}],
				'wind': {'speed': 10.0},
				'visibility': 8000,
				'rain': {'1h': 0.3},
			}


async def fetch_marine_weather(lat: float, lng: float) -> dict | None:
	if not settings.STORMGLASS_API_KEY:
		return None

	url = 'https://api.stormglass.io/v2/weather/point'
	params = {'lat': lat, 'lng': lng, 'params': 'waveHeight,windSpeed,swellHeight'}
	headers = {'Authorization': settings.STORMGLASS_API_KEY}

	async with httpx.AsyncClient(timeout=10.0) as client:
		try:
			response = await client.get(url, params=params, headers=headers)
			response.raise_for_status()
			return response.json()
		except Exception:
			return None
