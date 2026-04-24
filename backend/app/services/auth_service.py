from datetime import UTC, datetime, timedelta
import hashlib
import random

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.models.user_document import UserDocument
from app.models.verification_otp import VerificationOTP
from app.schemas.auth import TokenResponse, UserLogin, UserRegister, UserResponse
from app.utils.auth import create_access_token, hash_password, verify_password


def register_user(db: Session, user_data: UserRegister) -> TokenResponse:
	existing = db.query(User).filter(User.email == user_data.email).first()
	if existing:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Email already registered')

	new_user = User(
		full_name=user_data.full_name,
		email=user_data.email,
		password_hash=hash_password(user_data.password),
		role=user_data.role,
		account_type=user_data.account_type,
		company_name=user_data.company_name,
		phone_number=user_data.phone_number,
		country=user_data.country,
		tos_accepted=user_data.tos_accepted,
		privacy_accepted=user_data.privacy_accepted,
		shipping_terms_accepted=user_data.shipping_terms_accepted,
	)

	db.add(new_user)
	db.commit()
	db.refresh(new_user)

	access_token = create_access_token(
		data={'sub': str(new_user.user_id)},
		expires_delta=timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
	)

	return TokenResponse(access_token=access_token, user=UserResponse.model_validate(new_user))


def authenticate_user(db: Session, credentials: UserLogin) -> TokenResponse:
	user = db.query(User).filter(User.email == credentials.email).first()
	if not user or not verify_password(credentials.password, user.password_hash):
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid email or password')

	if not user.is_active:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='User account is inactive')

	user.last_login = datetime.now(UTC)
	db.commit()

	access_token = create_access_token(
		data={'sub': str(user.user_id)},
		expires_delta=timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
	)

	return TokenResponse(access_token=access_token, user=UserResponse.model_validate(user))


def create_and_store_otp(db: Session, user: User, channel: str, destination: str) -> str:
	otp = f'{random.randint(0, 999999):06d}'
	otp_hash = hash_password(otp)
	record = VerificationOTP(
		user_id=user.user_id,
		channel=channel,
		destination=destination,
		otp_hash=otp_hash,
		expires_at=datetime.now(UTC) + timedelta(minutes=10),
	)
	db.add(record)
	db.commit()
	return otp


def verify_stored_otp(db: Session, user: User, channel: str, code: str) -> bool:
	record = (
		db.query(VerificationOTP)
		.filter(
			VerificationOTP.user_id == user.user_id,
			VerificationOTP.channel == channel,
			VerificationOTP.consumed_at.is_(None),
		)
		.order_by(VerificationOTP.created_at.desc())
		.first()
	)
	if not record:
		return False

	if datetime.now(UTC) > record.expires_at:
		return False

	record.attempt_count += 1
	if not verify_password(code, record.otp_hash):
		db.commit()
		return False

	record.consumed_at = datetime.now(UTC)
	if channel == 'email':
		user.email_verified = True
	if channel == 'phone':
		user.phone_verified = True
	if user.email_verified and user.phone_verified and user.tos_accepted and user.privacy_accepted and user.shipping_terms_accepted:
		user.onboarding_completed_at = datetime.now(UTC)
	db.commit()
	return True


def save_document_reference(db: Session, user: User, doc_type: str, file_url: str) -> UserDocument:
	doc = UserDocument(user_id=user.user_id, doc_type=doc_type, file_url=file_url)
	db.add(doc)
	db.commit()
	db.refresh(doc)
	return doc


def legal_flags_complete(user: User) -> bool:
	return bool(user.tos_accepted and user.privacy_accepted and user.shipping_terms_accepted)


def otp_preview(otp: str) -> str:
	# Hackathon/dev mode: return masked hint that can be logged by UI for demo verification.
	return hashlib.sha256(otp.encode()).hexdigest()[:8]
