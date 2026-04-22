import random
from datetime import datetime, timedelta

from app.database.mongodb import port_conditions


async def get_port_conditions(port_id: str) -> dict:
	two_hours_ago = datetime.utcnow() - timedelta(hours=2)
	latest = await port_conditions.find_one(
		{'port_id': port_id, 'timestamp': {'$gte': two_hours_ago}},
		sort=[('timestamp', -1)],
	)

	if latest:
		return {
			'operational_status': latest.get('operational_status', 'normal'),
			'vessels_in_queue': latest.get('vessels_in_queue', 0),
			'average_wait_hours': latest.get('average_wait_hours', 0),
			'calculated_port_score': latest.get('calculated_port_score', 20),
		}

	return simulate_port_conditions(port_id)


def simulate_port_conditions(port_id: str) -> dict:
	_ = port_id
	status = random.choice(['normal', 'busy', 'congested'])
	vessels = random.randint(3, 35)
	wait = round(random.uniform(1.0, 18.0), 1)

	status_to_score = {'normal': 10, 'busy': 35, 'congested': 65}
	score = min(100, status_to_score[status] + vessels * 0.8 + wait * 1.5)

	return {
		'operational_status': status,
		'vessels_in_queue': vessels,
		'average_wait_hours': wait,
		'calculated_port_score': round(float(score), 2),
	}
