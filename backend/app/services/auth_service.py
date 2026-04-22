from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
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
		company_name=user_data.company_name,
		phone_number=user_data.phone_number,
		country=user_data.country,
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

	user.last_login = datetime.utcnow()
	db.commit()

	access_token = create_access_token(
		data={'sub': str(user.user_id)},
		expires_delta=timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
	)

	return TokenResponse(access_token=access_token, user=UserResponse.model_validate(user))
