import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.postgres import Base


class UserAddress(Base):
	__tablename__ = 'user_addresses'

	address_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False, index=True)
	name = Column(String(120), nullable=False)
	address_line = Column(String(255), nullable=False)
	contact = Column(String(80), nullable=True)
	address_type = Column(String(20), nullable=False, default='pickup')
	is_default = Column(Boolean, nullable=False, default=False)
	created_at = Column(DateTime(timezone=True), server_default=func.now())
	updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

	user = relationship('User', foreign_keys=[user_id], backref='saved_addresses')
