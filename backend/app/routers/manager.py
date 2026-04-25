from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.mongodb import port_conditions
from app.database.postgres import get_db
from app.dependencies import require_role
from app.models.cargo import Cargo
from app.models.manager_decision import ManagerDecision
from app.models.shipment import RiskLevel, Shipment, ShipmentStatus
from app.models.user import User, UserRole
from app.schemas.shipment import ShipmentResponse

router = APIRouter()


# ── /manager/summary ─────────────────────────────────────────────────────────

@router.get('/summary')
async def get_summary(
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	"""Aggregated KPI data for the manager control tower dashboard."""
	_ = current_user
	active_filter = Shipment.current_status.notin_([ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED])

	active_shipments = db.query(func.count(Shipment.shipment_id)).filter(active_filter).scalar() or 0
	high_risk = (
		db.query(func.count(Shipment.shipment_id))
		.filter(active_filter, Shipment.current_risk_level.in_([RiskLevel.HIGH, RiskLevel.CRITICAL]))
		.scalar() or 0
	)
	delayed_count = (
		db.query(func.count(Shipment.shipment_id))
		.filter(Shipment.current_status == ShipmentStatus.DELAYED)
		.scalar() or 0
	)

	# On-time percentage (last 30 days of delivered shipments)
	thirty_days_ago = datetime.utcnow() - timedelta(days=30)
	delivered = (
		db.query(Shipment)
		.filter(Shipment.current_status == ShipmentStatus.DELIVERED, Shipment.actual_arrival >= thirty_days_ago)
		.all()
	)
	if delivered:
		on_time = sum(1 for s in delivered if not s.actual_delay_hours or float(s.actual_delay_hours) <= 2.0)
		on_time_pct = round((on_time / len(delivered)) * 100, 1)
	else:
		on_time_pct = 0.0

	# Driver counts
	total_drivers = db.query(func.count(User.user_id)).filter(User.role == UserRole.DRIVER, User.is_active.is_(True)).scalar() or 0
	active_drivers = (
		db.query(func.count(Shipment.assigned_driver_id.distinct()))
		.filter(active_filter, Shipment.assigned_driver_id.isnot(None))
		.scalar() or 0
	)

	# Reroutes this week
	week_ago = datetime.utcnow() - timedelta(days=7)
	rerouted = (
		db.query(func.count(ManagerDecision.decision_id))
		.filter(ManagerDecision.decision_type == 'approve_reroute', ManagerDecision.decision_at >= week_ago)
		.scalar() or 0
	)

	# Total value in transit
	total_value = (
		db.query(func.sum(Cargo.declared_value))
		.join(Shipment)
		.filter(active_filter)
		.scalar() or Decimal('0')
	)

	return {
		'active_shipments': int(active_shipments),
		'high_risk_count': int(high_risk),
		'delayed_count': int(delayed_count),
		'on_time_percentage': on_time_pct,
		'total_drivers': int(total_drivers),
		'active_drivers': int(active_drivers),
		'rerouted_this_week': int(rerouted),
		'total_value_usd': float(total_value),
		'financial_saved_usd': float(rerouted * 61000),
	}


# ── /manager/drivers ─────────────────────────────────────────────────────────

@router.get('/drivers')
async def get_drivers(
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	"""All active drivers with their current assignment status."""
	_ = current_user
	active_filter = Shipment.current_status.notin_([ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED])

	drivers = db.query(User).filter(User.role == UserRole.DRIVER, User.is_active.is_(True)).all()

	# Map driver_id → active shipment count
	assignment_counts: dict = {}
	rows = (
		db.query(Shipment.assigned_driver_id, func.count(Shipment.shipment_id))
		.filter(active_filter, Shipment.assigned_driver_id.isnot(None))
		.group_by(Shipment.assigned_driver_id)
		.all()
	)
	for driver_id, cnt in rows:
		assignment_counts[str(driver_id)] = cnt

	result = []
	for d in drivers:
		uid = str(d.user_id)
		active_shipments = assignment_counts.get(uid, 0)
		result.append({
			'user_id': uid,
			'full_name': d.full_name,
			'email': d.email,
			'phone_number': d.phone_number,
			'company_name': d.company_name,
			'country': d.country,
			'is_active': d.is_active,
			'active_shipments': active_shipments,
			'status': 'en-route' if active_shipments > 0 else 'available',
		})

	return result


# ── /manager/shipments ────────────────────────────────────────────────────────

def _route_waypoints_for(shipment: Shipment) -> list[dict[str, float]]:
	"""Extract waypoints from the active route (or first route) for map display."""
	active_route = next((r for r in shipment.routes if r.is_active and r.waypoints), None)
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


def _enrich_shipment(shipment: Shipment) -> dict:
	"""Build an enriched dict with port names, cargo, waypoints, and user names."""
	base = ShipmentResponse.model_validate(shipment).model_dump()

	# Active route info
	active_route = next((r for r in shipment.routes if r.is_active), None)
	if active_route is None and shipment.routes:
		active_route = shipment.routes[0]

	# Original route (for showing old route when rerouted)
	from app.models.route import RouteType
	original_route = next((r for r in shipment.routes if r.route_type == RouteType.ORIGINAL and r.waypoints), None)
	original_waypoints = []
	if original_route and original_route.waypoints and shipment.is_rerouted:
		original_waypoints = [
			{'lat': float(p['lat']), 'lng': float(p['lng'])}
			for p in original_route.waypoints
			if isinstance(p, dict) and 'lat' in p and 'lng' in p
		]

	base.update({
		# Port names
		'origin_port_name': shipment.origin_port.port_name if shipment.origin_port else None,
		'destination_port_name': shipment.destination_port.port_name if shipment.destination_port else None,
		# Route waypoints for map display (active route)
		'route_waypoints': _route_waypoints_for(shipment),
		# Original route waypoints (shown as dashed when rerouted)
		'original_route_waypoints': original_waypoints,
		# Route cost / distance
		'route_distance_km': float(active_route.total_distance_km) if active_route and active_route.total_distance_km else None,
		'route_duration_hr': float(active_route.estimated_duration_hr) if active_route and active_route.estimated_duration_hr else None,
		'route_fuel_cost': float(active_route.estimated_fuel_cost) if active_route and active_route.estimated_fuel_cost else None,
		# Cargo details
		'cargo_type': shipment.cargo.cargo_type if shipment.cargo else None,
		'cargo_description': shipment.cargo.description if shipment.cargo else None,
		'declared_value': float(shipment.cargo.declared_value) if shipment.cargo and shipment.cargo.declared_value else None,
		'weight_kg': float(shipment.cargo.weight_kg) if shipment.cargo and shipment.cargo.weight_kg else None,
		'quantity': shipment.cargo.quantity if shipment.cargo else None,
		'cargo_sensitivity_score': float(shipment.cargo.cargo_sensitivity_score) if shipment.cargo and shipment.cargo.cargo_sensitivity_score else None,
		# User names
		'shipper_name': shipment.shipper.full_name if shipment.shipper else None,
		'receiver_name': shipment.receiver.full_name if shipment.receiver else None,
		'manager_name': shipment.manager.full_name if shipment.manager else None,
		'driver_name': shipment.driver.full_name if shipment.driver else None,
		'vessel_name': shipment.vessel.vessel_name if shipment.vessel else None,
	})
	return base


@router.get('/shipments')
async def get_shipments(
	status_filter: str | None = Query(None, alias='status'),
	risk_level: str | None = Query(None),
	include_all: bool = Query(False),
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	_ = current_user
	query = db.query(Shipment)

	if status_filter:
		query = query.filter(Shipment.current_status == status_filter)
	if risk_level:
		query = query.filter(Shipment.current_risk_level == risk_level)

	if not include_all:
		query = query.filter(Shipment.current_status.notin_([ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED]))
	shipments = query.order_by(Shipment.current_risk_score.desc().nullslast()).all()
	return [_enrich_shipment(s) for s in shipments]


# ── /manager/ports ────────────────────────────────────────────────────────────

@router.get('/ports')
async def get_ports(current_user: User = Depends(require_role(['manager']))):
	"""Port conditions — MongoDB stub returns empty in hackathon mode."""
	_ = current_user
	try:
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
	except Exception:
		# MongoDB is a stub in hackathon mode — return empty
		return []



# ── /manager/shipments/{id}/assign ────────────────────────────────────────────

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


# ── /manager/drivers (POST — create) ─────────────────────────────────────────

@router.post('/drivers')
async def create_driver(
	payload: dict = Body(...),
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	"""Manager creates a new driver account directly."""
	from app.utils.auth import hash_password
	email = str(payload.get('email', '')).strip().lower()
	if not email:
		raise HTTPException(status_code=400, detail='Email required')
	if db.query(User).filter(User.email == email).first():
		raise HTTPException(status_code=409, detail='Email already registered')

	driver = User(
		full_name=str(payload.get('full_name', 'Driver')).strip(),
		email=email,
		password_hash=hash_password(str(payload.get('password', 'RouteGuard2024!'))),
		role=UserRole.DRIVER,
		phone_number=payload.get('phone_number'),
		country=payload.get('country'),
		company_name=payload.get('company_name'),
		email_verified=True,
		is_active=True,
	)
	db.add(driver)
	db.commit()
	db.refresh(driver)
	return {
		'user_id': str(driver.user_id),
		'full_name': driver.full_name,
		'email': driver.email,
		'status': 'available',
		'message': 'Driver account created successfully',
	}


@router.patch('/drivers/{driver_id}/toggle-active')
async def toggle_driver_active(
	driver_id: str,
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	"""Activate or deactivate a driver account."""
	driver = db.query(User).filter(User.user_id == UUID(driver_id), User.role == UserRole.DRIVER).first()
	if not driver:
		raise HTTPException(status_code=404, detail='Driver not found')
	driver.is_active = not driver.is_active
	db.commit()
	return {'user_id': driver_id, 'is_active': driver.is_active}


@router.get('/drivers/all')
async def get_all_drivers(
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	"""All drivers including inactive, with assignment status."""
	_ = current_user
	active_filter = Shipment.current_status.notin_([ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED])
	drivers = db.query(User).filter(User.role == UserRole.DRIVER).all()

	assignment_counts: dict = {}
	rows = (
		db.query(Shipment.assigned_driver_id, func.count(Shipment.shipment_id))
		.filter(active_filter, Shipment.assigned_driver_id.isnot(None))
		.group_by(Shipment.assigned_driver_id)
		.all()
	)
	for did, cnt in rows:
		assignment_counts[str(did)] = cnt

	result = []
	for d in drivers:
		uid = str(d.user_id)
		active_shipments = assignment_counts.get(uid, 0)
		result.append({
			'user_id': uid,
			'full_name': d.full_name,
			'email': d.email,
			'phone_number': d.phone_number,
			'company_name': d.company_name,
			'country': d.country,
			'is_active': d.is_active,
			'active_shipments': active_shipments,
			'status': 'en-route' if active_shipments > 0 else ('available' if d.is_active else 'inactive'),
			'created_at': d.created_at.isoformat() if d.created_at else None,
		})
	return result


# ── /manager/fleet ────────────────────────────────────────────────────────────

@router.get('/fleet')
async def get_fleet(
	fleet_type: str | None = Query(None),
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	"""List all fleet assets (vessels + trucks represented as users with company_name='truck')."""
	from app.models.vessel import Vessel, VesselStatus
	_ = current_user

	# Build vessels list
	vessel_q = db.query(Vessel)
	vessels_data = []
	for v in vessel_q.all():
		# Find active shipment for this vessel
		active_shp = (
			db.query(Shipment)
			.filter(
				Shipment.assigned_vessel_id == v.vessel_id,
				Shipment.current_status.notin_([ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED]),
			)
			.first()
		)
		driver = db.query(User).filter(User.user_id == v.owner_user_id).first() if v.owner_user_id else None
		vessels_data.append({
			'fleet_id': str(v.vessel_id),
			'fleet_type': 'vessel',
			'name': v.vessel_name,
			'subtype': v.vessel_type.value if hasattr(v.vessel_type, 'value') else str(v.vessel_type),
			'capacity': f'{v.gross_tonnage or "—"} GT / {v.deadweight or "—"} DWT',
			'flag_country': v.flag_country,
			'imo_number': v.imo_number,
			'mmsi_number': v.mmsi_number,
			'built_year': v.built_year,
			'status': v.current_status.value if hasattr(v.current_status, 'value') else str(v.current_status),
			'is_in_transit': bool(active_shp),
			'current_shipment_id': str(active_shp.shipment_id) if active_shp else None,
			'current_shipment_tracking': active_shp.tracking_number if active_shp else None,
			'assigned_driver_id': str(v.owner_user_id) if v.owner_user_id else None,
			'assigned_driver_name': driver.full_name if driver else None,
		})

	if fleet_type == 'vessel':
		return {'vessels': vessels_data, 'trucks': []}

	# Trucks: not in DB schema — return empty placeholder list (manager can add mock ones)
	trucks_data: list[dict] = []

	return {'vessels': vessels_data, 'trucks': trucks_data}


@router.post('/fleet/vessels')
async def add_vessel(
	payload: dict = Body(...),
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	"""Add a new vessel to the fleet."""
	from app.models.vessel import Vessel, VesselStatus, VesselType
	_ = current_user

	vtype_str = str(payload.get('vessel_type', 'general')).lower()
	try:
		vtype = VesselType(vtype_str)
	except ValueError:
		vtype = VesselType.GENERAL

	vessel = Vessel(
		vessel_name=str(payload.get('vessel_name', 'Unnamed Vessel')).strip(),
		vessel_type=vtype,
		flag_country=payload.get('flag_country'),
		imo_number=payload.get('imo_number'),
		mmsi_number=payload.get('mmsi_number'),
		gross_tonnage=payload.get('gross_tonnage'),
		deadweight=payload.get('deadweight'),
		max_speed=payload.get('max_speed'),
		built_year=payload.get('built_year'),
		current_status=VesselStatus.DOCKED,
	)
	db.add(vessel)
	db.commit()
	db.refresh(vessel)
	return {
		'fleet_id': str(vessel.vessel_id),
		'fleet_type': 'vessel',
		'name': vessel.vessel_name,
		'message': 'Vessel added successfully',
	}


@router.patch('/fleet/vessels/{vessel_id}/assign-driver')
async def assign_driver_to_vessel(
	vessel_id: str,
	driver_id: str = Body(..., embed=True),
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	"""Assign an available driver/captain to a vessel."""
	from app.models.vessel import Vessel
	vessel = db.query(Vessel).filter(Vessel.vessel_id == UUID(vessel_id)).first()
	if not vessel:
		raise HTTPException(status_code=404, detail='Vessel not found')

	driver = db.query(User).filter(User.user_id == UUID(driver_id), User.role == UserRole.DRIVER).first()
	if not driver:
		raise HTTPException(status_code=404, detail='Driver not found')

	vessel.owner_user_id = driver.user_id
	db.commit()
	return {'message': f'Driver {driver.full_name} assigned to {vessel.vessel_name}'}


@router.patch('/fleet/vessels/{vessel_id}/status')
async def update_vessel_status(
	vessel_id: str,
	new_status: str = Body(..., embed=True),
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	"""Update vessel status (active, maintenance, docked, decommissioned)."""
	from app.models.vessel import Vessel, VesselStatus
	vessel = db.query(Vessel).filter(Vessel.vessel_id == UUID(vessel_id)).first()
	if not vessel:
		raise HTTPException(status_code=404, detail='Vessel not found')
	try:
		vessel.current_status = VesselStatus(new_status)
	except ValueError:
		raise HTTPException(status_code=400, detail=f'Invalid status: {new_status}')
	db.commit()
	return {'message': 'Status updated', 'new_status': new_status}


@router.get('/fleet/available-drivers')
async def get_available_drivers_for_fleet(
	current_user: User = Depends(require_role(['manager'])),
	db: Session = Depends(get_db),
):
	"""Return only unassigned (available) drivers for fleet assignment dropdown."""
	from app.models.vessel import Vessel
	_ = current_user

	# Get driver IDs already assigned to a vessel
	assigned_to_vessel = {
		str(v.owner_user_id)
		for v in db.query(Vessel).filter(Vessel.owner_user_id.isnot(None)).all()
	}
	# Get driver IDs on active shipments
	active_filter = Shipment.current_status.notin_([ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED])
	on_shipment = {
		str(row[0])
		for row in db.query(Shipment.assigned_driver_id)
		.filter(active_filter, Shipment.assigned_driver_id.isnot(None))
		.all()
	}
	busy = assigned_to_vessel | on_shipment

	drivers = db.query(User).filter(User.role == UserRole.DRIVER, User.is_active.is_(True)).all()
	return [
		{
			'user_id': str(d.user_id),
			'full_name': d.full_name,
			'country': d.country,
			'company_name': d.company_name,
		}
		for d in drivers
		if str(d.user_id) not in busy
	]
