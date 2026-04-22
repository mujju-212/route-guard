from collections import defaultdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

active_connections: dict[str, set[WebSocket]] = defaultdict(set)


@router.websocket('/ws/{user_id}')
async def websocket_endpoint(websocket: WebSocket, user_id: str):
	await websocket.accept()
	active_connections[user_id].add(websocket)

	try:
		while True:
			await websocket.receive_text()
	except WebSocketDisconnect:
		if websocket in active_connections.get(user_id, set()):
			active_connections[user_id].remove(websocket)
		if not active_connections.get(user_id):
			active_connections.pop(user_id, None)


async def _send_to_user(user_id: str, message: dict) -> None:
	for ws in list(active_connections.get(user_id, set())):
		try:
			await ws.send_json(message)
		except Exception:
			active_connections[user_id].discard(ws)


async def broadcast_to_users(user_ids: list[str], message: dict) -> None:
	for user_id in user_ids:
		await _send_to_user(user_id, message)


async def notify_risk_update(shipment_id: str, risk_data: dict, user_ids: list[str]) -> None:
	message = {
		'event': 'risk_update',
		'shipment_id': shipment_id,
		'payload': risk_data,
		'message': risk_data.get('message', ''),
	}
	await broadcast_to_users(user_ids, message)


async def notify_new_alert(alert_id: str, alert_data: dict, user_ids: list[str]) -> None:
	message = {
		'event': 'new_alert',
		'alert_id': alert_id,
		'payload': alert_data,
		'message': alert_data.get('message', ''),
	}
	await broadcast_to_users(user_ids, message)


async def notify_route_change(shipment_id: str, old_route_id: str, new_route_id: str, manager_name: str) -> None:
	message = {
		'event': 'route_changed',
		'shipment_id': shipment_id,
		'old_route_id': old_route_id,
		'new_route_id': new_route_id,
		'message': f'Route updated by {manager_name}. Please review the latest route.',
	}

	from app.database.postgres import SessionLocal
	from app.models.shipment import Shipment
	from uuid import UUID

	db = SessionLocal()
	try:
		shipment = db.query(Shipment).filter(Shipment.shipment_id == UUID(shipment_id)).first()
		if shipment and shipment.assigned_driver_id:
			await _send_to_user(str(shipment.assigned_driver_id), message)
	finally:
		db.close()
