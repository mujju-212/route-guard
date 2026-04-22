import httpx

from app.config import settings


async def fetch_traffic_data(lat: float, lng: float) -> dict:
	if not settings.TOMTOM_API_KEY:
		return {
			'currentSpeed': 60,
			'freeFlowSpeed': 80,
			'roadClosure': False,
			'incidents': [],
		}

	url = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/10/json'
	params = {'point': f'{lat},{lng}', 'key': settings.TOMTOM_API_KEY}

	async with httpx.AsyncClient(timeout=10.0) as client:
		try:
			response = await client.get(url, params=params)
			response.raise_for_status()
			flow = response.json().get('flowSegmentData', {})
			return {
				'currentSpeed': flow.get('currentSpeed', 70),
				'freeFlowSpeed': flow.get('freeFlowSpeed', 90),
				'roadClosure': flow.get('roadClosure', False),
				'incidents': flow.get('frc', []),
			}
		except Exception:
			return {
				'currentSpeed': 45,
				'freeFlowSpeed': 80,
				'roadClosure': False,
				'incidents': [1],
			}
