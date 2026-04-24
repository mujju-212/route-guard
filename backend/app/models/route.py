import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Numeric, Enum as SQLEnum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.postgres import Base
from app.models.enum_utils import enum_values


class RouteType(str, enum.Enum):
	ORIGINAL = 'original'
	ALTERNATE_1 = 'alternate_1'
	ALTERNATE_2 = 'alternate_2'
	ALTERNATE_3 = 'alternate_3'
	ACTIVE = 'active'


class Route(Base):
	__tablename__ = 'routes'

	route_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	shipment_id = Column(UUID(as_uuid=True), ForeignKey('shipments.shipment_id', ondelete='CASCADE'), nullable=False, index=True)
	route_type = Column(SQLEnum(RouteType, values_callable=enum_values, name='route_type'), nullable=False)
	is_active = Column(Boolean, default=False, index=True)
	origin_port_id = Column(UUID(as_uuid=True), ForeignKey('ports.port_id'), nullable=False)
	destination_port_id = Column(UUID(as_uuid=True), ForeignKey('ports.port_id'), nullable=False)
	total_distance_km = Column(Numeric, nullable=True)
	estimated_duration_hr = Column(Numeric, nullable=True)
	estimated_fuel_cost = Column(Numeric, nullable=True)
	waypoints = Column(JSONB, nullable=True)
	risk_score_at_creation = Column(Numeric(5, 2), nullable=True)
	cluster_id = Column(Integer, nullable=True)
	cluster_name = Column(String(50), nullable=True)
	clustering_updated_at = Column(DateTime(timezone=True), nullable=True)
	created_at = Column(DateTime(timezone=True), server_default=func.now())
	approved_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=True)
	approved_at = Column(DateTime(timezone=True), nullable=True)

	shipment = relationship('Shipment', back_populates='routes')
	origin_port = relationship('Port', foreign_keys=[origin_port_id])
	destination_port = relationship('Port', foreign_keys=[destination_port_id])
	approver = relationship('User')
