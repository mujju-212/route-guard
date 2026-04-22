import random
import string

from sqlalchemy.orm import Session

from app.models.cargo import CargoType
from app.models.shipment import Shipment


def generate_tracking_number(db: Session) -> str:
	while True:
		suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
		tracking = f'RG-{suffix}'
		exists = db.query(Shipment).filter(Shipment.tracking_number == tracking).first()
		if not exists:
			return tracking


def calculate_cargo_sensitivity_score(
	cargo_type: CargoType,
	temperature_required: float | None = None,
	declared_value: float | None = None,
) -> float:
	base_scores = {
		CargoType.STANDARD: 20,
		CargoType.ELECTRONICS: 65,
		CargoType.REFRIGERATED: 75,
		CargoType.HAZARDOUS: 85,
		CargoType.LIQUID_BULK: 50,
		CargoType.OVERSIZED: 45,
		CargoType.LIVESTOCK: 80,
		CargoType.PERISHABLE: 70,
		CargoType.PHARMACEUTICAL: 90,
	}

	score = float(base_scores.get(cargo_type, 40))

	if temperature_required is not None:
		score += 8

	if declared_value is not None and float(declared_value) > 100000:
		score += 10

	return min(100.0, score)
