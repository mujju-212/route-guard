import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum as SQLEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.postgres import Base
from app.models.enum_utils import enum_values


class CargoCondition(str, enum.Enum):
	GOOD = 'good'
	MINOR_DAMAGE = 'minor_damage'
	SIGNIFICANT_DAMAGE = 'significant_damage'
	TOTAL_LOSS = 'total_loss'


class DeliveryConfirmation(Base):
	__tablename__ = 'delivery_confirmations'

	confirmation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	shipment_id = Column(UUID(as_uuid=True), ForeignKey('shipments.shipment_id'), nullable=False)
	confirmed_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
	confirmed_at = Column(DateTime(timezone=True), server_default=func.now())
	cargo_condition = Column(SQLEnum(CargoCondition, values_callable=enum_values, name='cargo_condition'), nullable=False)
	damage_description = Column(Text, nullable=True)
	photo_url = Column(String(255), nullable=True)
	digital_signature = Column(Text, nullable=True)
	dispute_raised = Column(Boolean, default=False)
	dispute_reason = Column(Text, nullable=True)

	shipment = relationship('Shipment')
	confirmer = relationship('User')
