from datetime import datetime, timezone


def utc_now() -> datetime:
	return datetime.now(timezone.utc)


def datetime_to_iso(value: datetime | None) -> str | None:
	if value is None:
		return None
	if value.tzinfo is None:
		value = value.replace(tzinfo=timezone.utc)
	return value.isoformat()
