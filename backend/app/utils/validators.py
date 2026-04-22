from uuid import UUID


def parse_uuid(value: str) -> UUID:
	return UUID(value)


def is_valid_lat_lng(latitude: float, longitude: float) -> bool:
	return -90 <= latitude <= 90 and -180 <= longitude <= 180
