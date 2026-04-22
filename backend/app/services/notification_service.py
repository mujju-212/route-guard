from typing import Iterable


async def notify_users(user_ids: Iterable[str], event: str, payload: dict) -> None:
	from app.routers.websocket import broadcast_to_users

	await broadcast_to_users(list(user_ids), {'event': event, **payload})


async def send_email_notification(to_email: str, subject: str, body: str) -> bool:
	# Hackathon-safe stub: wire SMTP here in production.
	_ = (to_email, subject, body)
	return True


async def send_sms_notification(phone_number: str, message: str) -> bool:
	# Hackathon-safe stub: wire SMS provider here in production.
	_ = (phone_number, message)
	return True
