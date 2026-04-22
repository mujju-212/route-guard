import enum
import uuid

from sqlalchemy import Column, DateTime, Numeric, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.postgres import Base


class CargoType(str, enum.Enum):
	STANDARD = 'standard'
	ELECTRONICS = 'electronics'
	REFRIGERATED = 'refrigerated'
	HAZARDOUS = 'hazardous'
	LIQUID_BULK = 'liquid_bulk'
	OVERSIZED = 'oversized'
	LIVESTOCK = 'livestock'
	PERISHABLE = 'perishable'
	PHARMACEUTICAL = 'pharmaceutical'


class Cargo(Base):
	__tablename__ = 'cargo'

	cargo_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	shipment_id = Column(UUID(as_uuid=True), ForeignKey('shipments.shipment_id', ondelete='CASCADE'), nullable=False)
	cargo_type = Column(SQLEnum(CargoType), nullable=False)
	description = Column(Text, nullable=False)
	weight_kg = Column(Numeric, nullable=False)
	volume_cbm = Column(Numeric, nullable=True)
	quantity = Column(Integer, nullable=True)
	unit_type = Column(String(50), nullable=True)
	declared_value = Column(Numeric, nullable=True)
	currency = Column(String(10), default='USD')
	temperature_required = Column(Numeric, nullable=True)
	humidity_required = Column(Numeric, nullable=True)
	handling_instructions = Column(Text, nullable=True)
	hazmat_class = Column(String(20), nullable=True)
	insurance_value = Column(Numeric, nullable=True)
	cargo_sensitivity_score = Column(Numeric(5, 2), nullable=True)
	created_at = Column(DateTime(timezone=True), server_default=func.now())

	shipment = relationship('Shipment', back_populates='cargo')
