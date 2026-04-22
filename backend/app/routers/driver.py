from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.dependencies import require_role
from app.models.shipment import Shipment
from app.models.status_update import StatusUpdate
from app.models.user import User
from app.schemas.shipment import ShipmentDetailResponse
from app.services.alert_service import create_alert

router = APIRouter()


@router.get('/assignment', response_model=ShipmentDetailResponse)
async def get_assignment(current_user: User = Depends(require_role(['driver'])), db: Session = Depends(get_db)):
	shipment = (
		db.query(Shipment)
		.filter(
			Shipment.assigned_driver_id == current_user.user_id,
			Shipment.current_status.in_(['picked_up', 'in_transit', 'at_port', 'customs']),
		)
		.order_by(Shipment.departure_time.desc())
		.first()
	)

	if not shipment or not shipment.cargo:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='No active assignment')

	payload = {
		**shipment.__dict__,
		'shipper_name': shipment.shipper.full_name,
		'receiver_name': shipment.receiver.full_name,
		'manager_name': shipment.manager.full_name if shipment.manager else None,
		'driver_name': shipment.driver.full_name if shipment.driver else None,
		'vessel_name': shipment.vessel.vessel_name if shipment.vessel else None,
		'origin_port_name': shipment.origin_port.port_name,
		'destination_port_name': shipment.destination_port.port_name,
		'cargo_type': shipment.cargo.cargo_type,
		'cargo_description': shipment.cargo.description,
		'declared_value': shipment.cargo.declared_value,
		'cargo_sensitivity_score': shipment.cargo.cargo_sensitivity_score,
	}

	return ShipmentDetailResponse.model_validate(payload)


@router.post('/shipments/{shipment_id}/incident')
async def report_incident(
	shipment_id: str,
	incident_type: str = Query(...),
	description: str = Query(...),
	current_user: User = Depends(require_role(['driver'])),
	db: Session = Depends(get_db),
):
	shipment = db.query(Shipment).filter(Shipment.shipment_id == UUID(shipment_id)).first()
	if not shipment or shipment.assigned_driver_id != current_user.user_id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Not authorized or shipment not found')

	incident = StatusUpdate(
		shipment_id=shipment.shipment_id,
		updated_by=current_user.user_id,
		previous_status=shipment.current_status.value,
		new_status=shipment.current_status.value,
		notes=description,
		incident_type=incident_type,
	)
	db.add(incident)
	db.commit()

	await create_alert(
		db=db,
		shipment_id=shipment_id,
		alert_type='incident_reported',
		severity='warning',
		message=f'Driver incident reported: {incident_type} - {description}',
		triggered_by='driver',
	)

	return {'message': 'Incident reported successfully'}
