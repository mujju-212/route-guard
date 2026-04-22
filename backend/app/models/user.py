import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum as SQLEnum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database.postgres import Base


class UserRole(str, enum.Enum):
	SHIPPER = 'shipper'
	MANAGER = 'manager'
	DRIVER = 'driver'
	RECEIVER = 'receiver'


class User(Base):
	__tablename__ = 'users'

	user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	full_name = Column(String(100), nullable=False)
	email = Column(String(100), unique=True, nullable=False, index=True)
	password_hash = Column(String(255), nullable=False)
	role = Column(SQLEnum(UserRole), nullable=False, index=True)
	company_name = Column(String(100), nullable=True)
	phone_number = Column(String(20), nullable=True)
	country = Column(String(50), nullable=True)
	is_active = Column(Boolean, default=True)
	created_at = Column(DateTime(timezone=True), server_default=func.now())
	updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
	last_login = Column(DateTime(timezone=True), nullable=True)

	def __repr__(self) -> str:
		return f'<User {self.email} ({self.role})>'
