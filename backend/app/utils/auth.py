from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings


def hash_password(password: str) -> str:
	"""Hash password using bcrypt directly (passlib broken on Python 3.13)."""
	return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
	"""Verify password against bcrypt hash."""
	try:
		return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
	except Exception:
		return False


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
	to_encode = data.copy()
	expires_in = expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
	expire_at = datetime.now(timezone.utc) + expires_in
	to_encode.update({'exp': expire_at})
	return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
	try:
		return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
	except JWTError:
		return None
