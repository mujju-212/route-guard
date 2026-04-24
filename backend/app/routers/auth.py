from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.dependencies import get_current_user
from app.models.port import Port
from app.models.user import User, UserRole
from app.schemas.auth import TokenResponse, UserLogin, UserRegister, UserResponse
from app.services.auth_service import authenticate_user, register_user

router = APIRouter()


@router.post('/register', response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
	return register_user(db, user_data)


@router.post('/login', response_model=TokenResponse)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
	return authenticate_user(db, credentials)


@router.get('/me', response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
	return UserResponse.model_validate(current_user)


@router.get('/receivers', response_model=list[UserResponse])
async def receivers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	_ = current_user
	users = db.query(User).filter(User.role == UserRole.RECEIVER).order_by(User.full_name.asc()).all()
	return [UserResponse.model_validate(user) for user in users]


@router.get('/managers', response_model=list[UserResponse])
async def managers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	_ = current_user
	users = db.query(User).filter(User.role == UserRole.MANAGER).order_by(User.full_name.asc()).all()
	return [UserResponse.model_validate(user) for user in users]


@router.get('/ports')
async def list_ports(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	"""Return all ports so any role can populate origin/destination selectors."""
	_ = current_user
	ports = db.query(Port).order_by(Port.port_name.asc()).all()
	return [
		{
			'port_id': str(p.port_id),
			'port_name': p.port_name,
			'port_code': p.port_code,
			'country': p.country,
			'latitude': float(p.latitude),
			'longitude': float(p.longitude),
			'port_type': p.port_type.value if hasattr(p.port_type, 'value') else str(p.port_type),
		}
		for p in ports
	]


@router.get('/vessels')
async def list_vessels(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	"""Return all active vessels so shippers can pick a shipping method."""
	_ = current_user
	from app.models.vessel import Vessel, VesselStatus
	vessels = db.query(Vessel).filter(Vessel.current_status == VesselStatus.ACTIVE).order_by(Vessel.vessel_name.asc()).all()
	return [
		{
			'vessel_id': str(v.vessel_id),
			'vessel_name': v.vessel_name,
			'vessel_type': v.vessel_type.value if hasattr(v.vessel_type, 'value') else str(v.vessel_type),
			'flag_country': v.flag_country,
			'imo_number': v.imo_number,
			'built_year': v.built_year,
		}
		for v in vessels
	]
