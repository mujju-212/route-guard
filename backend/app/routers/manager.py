from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.mongodb import port_conditions
from app.database.postgres import get_db
from app.dependencies import require_role
from app.models.shipment import Shipment, ShipmentStatus
from app.models.user import User
from app.schemas.shipment import ShipmentResponse

router = APIRouter()


@router.get('/shipments', response_model=list[ShipmentResponse])
async def get_shipments(
	status_filter: str | None = Query(None, alias='status'),
	risk_level: str | None = Query(None),
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	_ = current_user
	query = db.query(Shipment)

	if status_filter:
		query = query.filter(Shipment.current_status == status_filter)
	if risk_level:
		query = query.filter(Shipment.current_risk_level == risk_level)

	query = query.filter(Shipment.current_status.notin_([ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED]))
	shipments = query.order_by(Shipment.current_risk_score.desc().nullslast()).all()
	return [ShipmentResponse.model_validate(item) for item in shipments]


@router.get('/ports')
async def get_ports(current_user: User = Depends(require_role(['manager']))):
	_ = current_user
	one_hour_ago = datetime.utcnow() - timedelta(hours=1)
	recent = (
		await port_conditions.find({'timestamp': {'$gte': one_hour_ago}})
		.sort('timestamp', -1)
		.to_list(length=200)
	)

	seen: set[str] = set()
	unique: list[dict] = []
	for item in recent:
		port_id = str(item.get('port_id', ''))
		if not port_id or port_id in seen:
			continue
		seen.add(port_id)
		unique.append(item)

	return unique


@router.post('/shipments/{shipment_id}/assign')
async def assign_resources(
	shipment_id: str,
	manager_id: str | None = Query(None),
	driver_id: str | None = Query(None),
	vessel_id: str | None = Query(None),
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	_ = current_user
	shipment = db.query(Shipment).filter(Shipment.shipment_id == UUID(shipment_id)).first()
	if not shipment:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Shipment not found')

	if manager_id:
		shipment.assigned_manager_id = UUID(manager_id)
	if driver_id:
		shipment.assigned_driver_id = UUID(driver_id)
	if vessel_id:
		shipment.assigned_vessel_id = UUID(vessel_id)

	db.commit()
	return {'message': 'Resources assigned successfully'}
