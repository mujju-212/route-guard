from collections.abc import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database.postgres import get_db
from app.models.user import User
from app.utils.auth import decode_access_token

security = HTTPBearer(auto_error=False)


async def get_current_user(
	credentials: HTTPAuthorizationCredentials | None = Depends(security),
	db: Session = Depends(get_db),
) -> User:
	if credentials is None:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Not authenticated')

	payload = decode_access_token(credentials.credentials)
	if payload is None:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token')

	user_id = payload.get('sub')
	if not user_id:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token payload')

	try:
		user_uuid = UUID(str(user_id))
	except ValueError as exc:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token subject') from exc

	user = db.query(User).filter(User.user_id == user_uuid).first()
	if user is None or not user.is_active:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found or inactive')

	return user


def require_role(allowed_roles: list[str]) -> Callable:
	async def _role_check(current_user: User = Depends(get_current_user)) -> User:
		user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
		if user_role not in allowed_roles:
			raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Forbidden')
		return current_user

	return _role_check


def get_manager():
	return Depends(require_role(['manager']))


def get_shipper():
	return Depends(require_role(['shipper']))


def get_driver():
	return Depends(require_role(['driver']))


def get_receiver():
	return Depends(require_role(['receiver']))
