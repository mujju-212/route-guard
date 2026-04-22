from uuid import UUID

from sqlalchemy.orm import Session

from app.database.redis_client import set_active_alert
from app.models.alert import Alert, AlertSeverity, AlertType
from app.models.shipment import Shipment


async def create_alert(
	db: Session,
	shipment_id: str,
	alert_type: str,
	severity: str,
	message: str,
	risk_score: float | None = None,
	triggered_by: str = 'system',
) -> Alert:
	alert = Alert(
		shipment_id=UUID(shipment_id),
		alert_type=AlertType(alert_type),
		severity=AlertSeverity(severity),
		message=message,
		risk_score_at_alert=risk_score,
		triggered_by=triggered_by,
		sent_to_roles='manager,shipper',
	)

	db.add(alert)
	db.commit()
	db.refresh(alert)

	alert_data = {
		'alert_id': str(alert.alert_id),
		'shipment_id': str(alert.shipment_id),
		'severity': alert.severity.value,
		'message': alert.message,
		'created_at': alert.created_at.isoformat() if alert.created_at else None,
	}

	await set_active_alert(str(alert.alert_id), alert_data)

	shipment = db.query(Shipment).filter(Shipment.shipment_id == UUID(shipment_id)).first()
	if shipment:
		from app.routers.websocket import notify_new_alert

		user_ids = [
			str(user_id)
			for user_id in [shipment.shipper_id, shipment.assigned_manager_id, shipment.assigned_driver_id]
			if user_id
		]
		await notify_new_alert(str(alert.alert_id), alert_data, user_ids)

	return alert
