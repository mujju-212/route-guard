from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.user import UserRole


class UserLogin(BaseModel):
	email: EmailStr
	password: str


class UserRegister(BaseModel):
	full_name: str
	email: EmailStr
	password: str
	role: UserRole
	company_name: str | None = None
	phone_number: str | None = None
	country: str | None = None


class UserResponse(BaseModel):
	user_id: UUID
	full_name: str
	email: str
	role: UserRole
	company_name: str | None = None
	is_active: bool
	created_at: datetime

	model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
	access_token: str
	token_type: str = 'bearer'
	user: UserResponse
