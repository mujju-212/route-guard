from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.dependencies import get_current_user
from app.models.port import Port
from app.models.user import User, UserRole
from app.schemas.auth import (
	AcceptLegalRequest,
	OnboardingStatusResponse,
	SendOTPRequest,
	TokenResponse,
	UploadDocumentRequest,
	UserLogin,
	UserRegister,
	UserResponse,
	UserUpdateRequest,
	VerifyOTPRequest,
)
from app.services.auth_service import (
	authenticate_user,
	create_and_store_otp,
	legal_flags_complete,
	otp_preview,
	register_user,
	save_document_reference,
	verify_stored_otp,
)

router = APIRouter()


def _serialize_ports(ports: list[Port]) -> list[dict]:
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


@router.post('/register', response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
	return register_user(db, user_data)


@router.post('/login', response_model=TokenResponse)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
	return authenticate_user(db, credentials)


@router.get('/me', response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
	return UserResponse.model_validate(current_user)


@router.put('/me', response_model=UserResponse)
async def update_me(
	payload: UserUpdateRequest,
	current_user: User = Depends(get_current_user),
	db: Session = Depends(get_db),
):
	email_normalized = str(payload.email).strip().lower()
	existing = (
		db.query(User)
		.filter(User.email == email_normalized, User.user_id != current_user.user_id)
		.first()
	)
	if existing:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Email already registered')

	current_user.full_name = payload.full_name.strip()
	current_user.email = email_normalized
	current_user.account_type = payload.account_type
	current_user.company_name = payload.company_name
	current_user.phone_number = payload.phone_number
	current_user.country = payload.country

	db.commit()
	db.refresh(current_user)
	return UserResponse.model_validate(current_user)


@router.post('/send-otp')
async def send_otp(payload: SendOTPRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	channel = payload.channel.strip().lower()
	if channel not in {'email', 'phone'}:
		return {'ok': False, 'detail': 'Invalid channel. Use email or phone.'}
	otp = create_and_store_otp(db, current_user, channel, payload.destination)
	return {'ok': True, 'channel': channel, 'otp_hint': otp_preview(otp)}


@router.post('/verify-otp')
async def verify_otp(payload: VerifyOTPRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	channel = payload.channel.strip().lower()
	ok = verify_stored_otp(db, current_user, channel, payload.code)
	return {'ok': ok, 'channel': channel}


@router.post('/accept-legal', response_model=OnboardingStatusResponse)
async def accept_legal(payload: AcceptLegalRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	current_user.tos_accepted = payload.tos_accepted
	current_user.privacy_accepted = payload.privacy_accepted
	current_user.shipping_terms_accepted = payload.shipping_terms_accepted
	db.commit()
	db.refresh(current_user)
	return OnboardingStatusResponse(
		email_verified=current_user.email_verified,
		phone_verified=current_user.phone_verified,
		tos_accepted=current_user.tos_accepted,
		privacy_accepted=current_user.privacy_accepted,
		shipping_terms_accepted=current_user.shipping_terms_accepted,
		onboarding_completed=bool(current_user.onboarding_completed_at),
	)


@router.post('/upload-document')
async def upload_document(payload: UploadDocumentRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	doc = save_document_reference(db, current_user, payload.doc_type, payload.file_url)
	return {'ok': True, 'document_id': str(doc.document_id), 'doc_type': doc.doc_type, 'review_status': doc.review_status}


@router.get('/onboarding-status', response_model=OnboardingStatusResponse)
async def onboarding_status(current_user: User = Depends(get_current_user)):
	return OnboardingStatusResponse(
		email_verified=current_user.email_verified,
		phone_verified=current_user.phone_verified,
		tos_accepted=current_user.tos_accepted,
		privacy_accepted=current_user.privacy_accepted,
		shipping_terms_accepted=current_user.shipping_terms_accepted,
		onboarding_completed=bool(
			current_user.onboarding_completed_at
			or (current_user.email_verified and current_user.phone_verified and legal_flags_complete(current_user))
		),
	)


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
	return _serialize_ports(ports)


@router.get('/public-ports')
async def list_public_ports(db: Session = Depends(get_db)):
	"""Public ports lookup for signup forms before authentication."""
	ports = db.query(Port).order_by(Port.port_name.asc()).all()
	return _serialize_ports(ports)


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
