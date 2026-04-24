import uuid

from sqlalchemy import Column, DateTime, Numeric, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.postgres import Base


class StatusUpdate(Base):
	__tablename__ = 'status_updates'

	update_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	shipment_id = Column(UUID(as_uuid=True), ForeignKey('shipments.shipment_id'), nullable=False, index=True)
	updated_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
	previous_status = Column(String(50), nullable=True)
	new_status = Column(String(50), nullable=False)
	latitude = Column(Numeric(10, 7), nullable=True)
	longitude = Column(Numeric(10, 7), nullable=True)
	notes = Column(Text, nullable=True)
	incident_type = Column(String(50), nullable=True)
	photo_url = Column(String(255), nullable=True)
	created_at = Column(DateTime(timezone=True), server_default=func.now())

	shipment = relationship('Shipment', back_populates='status_updates')
	user = relationship('User')
