from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.dependencies import get_current_user
from app.models.cargo import Cargo
from app.models.shipment import Shipment
from app.models.status_update import StatusUpdate
from app.models.user import User
from app.schemas.shipment import ShipmentCreate, ShipmentDetailResponse, ShipmentResponse, StatusUpdateRequest
from app.services.route_service import create_initial_route
from app.services.shipment_service import calculate_cargo_sensitivity_score, generate_tracking_number

router = APIRouter()


def _role_value(user: User) -> str:
	return user.role.value if hasattr(user.role, 'value') else str(user.role)


def _route_waypoints_for(shipment: Shipment) -> list[dict[str, float]]:
	active_route = next((route for route in shipment.routes if route.is_active and route.waypoints), None)
	if active_route is None and shipment.routes:
		active_route = shipment.routes[0]

	waypoints = getattr(active_route, 'waypoints', None)
	if not waypoints:
		return []

	return [
		{'lat': float(point['lat']), 'lng': float(point['lng'])}
		for point in waypoints
		if isinstance(point, dict) and 'lat' in point and 'lng' in point
	]


@router.post('/create', response_model=ShipmentResponse, status_code=status.HTTP_201_CREATED)
async def create_shipment(
	shipment_data: ShipmentCreate,
	current_user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	if _role_value(current_user) != 'shipper':
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Only shippers can create shipments')

	tracking_number = generate_tracking_number(db)
	cargo_sensitivity = calculate_cargo_sensitivity_score(
		shipment_data.cargo.cargo_type,
		float(shipment_data.cargo.temperature_required) if shipment_data.cargo.temperature_required is not None else None,
		float(shipment_data.cargo.declared_value) if shipment_data.cargo.declared_value is not None else None,
	)

	shipment = Shipment(
		tracking_number=tracking_number,
		shipper_id=current_user.user_id,
		receiver_id=UUID(shipment_data.receiver_id),
		assigned_manager_id=UUID(shipment_data.assigned_manager_id) if shipment_data.assigned_manager_id else None,
		origin_port_id=UUID(shipment_data.origin_port_id),
		destination_port_id=UUID(shipment_data.destination_port_id),
		departure_time=shipment_data.departure_time,
		expected_arrival=shipment_data.expected_arrival,
		priority_level=shipment_data.priority_level,
		special_instructions=shipment_data.special_instructions,
	)

	db.add(shipment)
	db.flush()

	cargo = Cargo(
		shipment_id=shipment.shipment_id,
		cargo_type=shipment_data.cargo.cargo_type,
		description=shipment_data.cargo.description,
		weight_kg=shipment_data.cargo.weight_kg,
		volume_cbm=shipment_data.cargo.volume_cbm,
		quantity=shipment_data.cargo.quantity,
		unit_type=shipment_data.cargo.unit_type,
		declared_value=shipment_data.cargo.declared_value,
		temperature_required=shipment_data.cargo.temperature_required,
		humidity_required=shipment_data.cargo.humidity_required,
		handling_instructions=shipment_data.cargo.handling_instructions,
		hazmat_class=shipment_data.cargo.hazmat_class,
		insurance_value=shipment_data.cargo.insurance_value,
		cargo_sensitivity_score=cargo_sensitivity,
	)
	db.add(cargo)

	initial_route = await create_initial_route(
		db=db,
		shipment_id=str(shipment.shipment_id),
		origin_port_id=shipment_data.origin_port_id,
		destination_port_id=shipment_data.destination_port_id,
	)
	db.add(initial_route)

	db.commit()
	db.refresh(shipment)

	return ShipmentResponse.model_validate(shipment)


@router.get('/my', response_model=list[ShipmentResponse])
async def get_my_shipments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	role = _role_value(current_user)
	if role == 'shipper':
		items = db.query(Shipment).filter(Shipment.shipper_id == current_user.user_id).all()
	elif role == 'receiver':
		items = db.query(Shipment).filter(Shipment.receiver_id == current_user.user_id).all()
	elif role == 'driver':
		items = db.query(Shipment).filter(Shipment.assigned_driver_id == current_user.user_id).all()
	elif role == 'manager':
		items = db.query(Shipment).filter(Shipment.assigned_manager_id == current_user.user_id).all()
	else:
		items = []

	return [ShipmentResponse.model_validate(item) for item in items]


@router.get('/{shipment_id}', response_model=ShipmentDetailResponse)
async def get_shipment(shipment_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	shipment = db.query(Shipment).filter(Shipment.shipment_id == UUID(shipment_id)).first()
	if not shipment:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Shipment not found')

	authorized = (
		shipment.shipper_id == current_user.user_id
		or shipment.receiver_id == current_user.user_id
		or shipment.assigned_driver_id == current_user.user_id
		or shipment.assigned_manager_id == current_user.user_id
		or _role_value(current_user) == 'manager'
	)
	if not authorized:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Not authorized to view this shipment')

	if shipment.cargo is None:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Shipment cargo data missing')

	response_data = ShipmentResponse.model_validate(shipment).model_dump()

	# Build status history timeline
	status_history = []
	# Always start with a "created" event from the shipment creation timestamp
	status_history.append({
		'status': 'created',
		'timestamp': shipment.created_at.isoformat() if shipment.created_at else None,
		'notes': 'Order created',
		'updated_by': shipment.shipper.full_name if shipment.shipper else None,
		'latitude': None,
		'longitude': None,
	})
	# Add all status updates from the status_updates table
	for update in (shipment.status_updates or []):
		status_history.append({
			'status': update.new_status,
			'timestamp': update.created_at.isoformat() if update.created_at else None,
			'notes': update.notes,
			'updated_by': update.user.full_name if update.user else None,
			'latitude': float(update.latitude) if update.latitude is not None else None,
			'longitude': float(update.longitude) if update.longitude is not None else None,
			'incident_type': update.incident_type,
		})

	# Original route waypoints (for showing old route when rerouted)
	from app.models.route import RouteType
	original_route = next((r for r in shipment.routes if r.route_type == RouteType.ORIGINAL and r.waypoints), None)
	original_waypoints = []
	if original_route and original_route.waypoints and shipment.is_rerouted:
		original_waypoints = [
			{'lat': float(p['lat']), 'lng': float(p['lng'])}
			for p in original_route.waypoints
			if isinstance(p, dict) and 'lat' in p and 'lng' in p
		]

	response_data.update(
		{
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
			'route_waypoints': _route_waypoints_for(shipment),
			'original_route_waypoints': original_waypoints,
			'status_history': status_history,
		}
	)
	return ShipmentDetailResponse(**response_data)


@router.put('/{shipment_id}/status')
async def update_status(
	shipment_id: str,
	status_data: StatusUpdateRequest,
	current_user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	if _role_value(current_user) not in {'driver', 'manager'}:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Only driver and manager can update status')

	shipment = db.query(Shipment).filter(Shipment.shipment_id == UUID(shipment_id)).first()
	if not shipment:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Shipment not found')

	status_update = StatusUpdate(
		shipment_id=shipment.shipment_id,
		updated_by=current_user.user_id,
		previous_status=shipment.current_status.value,
		new_status=status_data.new_status.value,
		latitude=status_data.latitude,
		longitude=status_data.longitude,
		notes=status_data.notes,
		incident_type=status_data.incident_type,
	)
	db.add(status_update)

	shipment.current_status = status_data.new_status
	if status_data.latitude is not None and status_data.longitude is not None:
		shipment.current_latitude = status_data.latitude
		shipment.current_longitude = status_data.longitude

	db.commit()

	from app.routers.websocket import broadcast_to_users

	user_ids = [str(uid) for uid in [shipment.shipper_id, shipment.receiver_id, shipment.assigned_manager_id] if uid]
	await broadcast_to_users(
		user_ids,
		{
			'event': 'status_updated',
			'shipment_id': shipment_id,
			'new_status': status_data.new_status.value,
			'notes': status_data.notes,
		},
	)

	return {'message': 'Status updated successfully', 'new_status': status_data.new_status}
