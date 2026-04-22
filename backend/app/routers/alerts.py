from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.database.redis_client import delete_alert
from app.dependencies import get_current_user
from app.models.alert import Alert
from app.models.shipment import Shipment
from app.models.user import User
from app.schemas.alert import AlertResolveRequest, AlertResponse

router = APIRouter()


def _role_value(user: User) -> str:
	return user.role.value if hasattr(user.role, 'value') else str(user.role)


@router.get('/active', response_model=list[AlertResponse])
async def get_active_alerts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	role = _role_value(current_user)

	if role == 'manager':
		alerts = db.query(Alert).filter(Alert.is_resolved.is_(False)).order_by(Alert.created_at.desc()).all()
	elif role == 'shipper':
		alerts = (
			db.query(Alert)
			.join(Shipment)
			.filter(Alert.is_resolved.is_(False), Shipment.shipper_id == current_user.user_id)
			.order_by(Alert.created_at.desc())
			.all()
		)
	elif role == 'driver':
		alerts = (
			db.query(Alert)
			.join(Shipment)
			.filter(Alert.is_resolved.is_(False), Shipment.assigned_driver_id == current_user.user_id)
			.order_by(Alert.created_at.desc())
			.all()
		)
	elif role == 'receiver':
		alerts = (
			db.query(Alert)
			.join(Shipment)
			.filter(
				Alert.is_resolved.is_(False),
				Shipment.receiver_id == current_user.user_id,
				Alert.severity.in_(['high', 'critical']),
			)
			.order_by(Alert.created_at.desc())
			.all()
		)
	else:
		alerts = []

	results: list[AlertResponse] = []
	for alert in alerts:
		payload = AlertResponse.model_validate(alert).model_dump()
		payload['tracking_number'] = alert.shipment.tracking_number if alert.shipment else None
		results.append(AlertResponse(**payload))

	return results


@router.put('/{alert_id}/resolve')
async def resolve_alert(
	alert_id: str,
	resolve_data: AlertResolveRequest,
	current_user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	_ = resolve_data
	if _role_value(current_user) != 'manager':
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Only managers can resolve alerts')

	alert = db.query(Alert).filter(Alert.alert_id == UUID(alert_id)).first()
	if not alert:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Alert not found')

	alert.is_resolved = True
	alert.resolved_at = datetime.utcnow()
	alert.resolved_by = current_user.user_id
	db.commit()

	await delete_alert(alert_id)
	return {'message': 'Alert resolved', 'alert_id': alert_id}


@router.put('/{alert_id}/read')
async def mark_alert_read(alert_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	alert = db.query(Alert).filter(Alert.alert_id == UUID(alert_id)).first()
	if not alert:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Alert not found')

	authorized = (
		_role_value(current_user) == 'manager'
		or alert.shipment.shipper_id == current_user.user_id
		or alert.shipment.receiver_id == current_user.user_id
		or alert.shipment.assigned_driver_id == current_user.user_id
	)
	if not authorized:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Not authorized')

	alert.is_read = True
	db.commit()
	return {'message': 'Alert marked as read'}
