import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Numeric, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.postgres import Base
from app.models.enum_utils import enum_values


class ShipmentStatus(str, enum.Enum):
	CREATED = 'created'
	PICKED_UP = 'picked_up'
	IN_TRANSIT = 'in_transit'
	AT_PORT = 'at_port'
	CUSTOMS = 'customs'
	DELAYED = 'delayed'
	DELIVERED = 'delivered'
	CANCELLED = 'cancelled'


class RiskLevel(str, enum.Enum):
	LOW = 'low'
	MEDIUM = 'medium'
	HIGH = 'high'
	CRITICAL = 'critical'


class PriorityLevel(str, enum.Enum):
	LOW = 'low'
	MEDIUM = 'medium'
	HIGH = 'high'
	URGENT = 'urgent'


class Shipment(Base):
	__tablename__ = 'shipments'

	shipment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	tracking_number = Column(String(30), unique=True, nullable=False)

	shipper_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
	receiver_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
	assigned_manager_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=True)
	assigned_driver_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=True)
	assigned_vessel_id = Column(UUID(as_uuid=True), ForeignKey('vessels.vessel_id'), nullable=True)

	origin_port_id = Column(UUID(as_uuid=True), ForeignKey('ports.port_id'), nullable=False)
	destination_port_id = Column(UUID(as_uuid=True), ForeignKey('ports.port_id'), nullable=False)

	departure_time = Column(DateTime(timezone=True), nullable=False)
	expected_arrival = Column(DateTime(timezone=True), nullable=False)
	actual_arrival = Column(DateTime(timezone=True), nullable=True)

	current_status = Column(SQLEnum(ShipmentStatus, values_callable=enum_values, name='shipment_status'), default=ShipmentStatus.CREATED, index=True)
	current_latitude = Column(Numeric(10, 7), nullable=True)
	current_longitude = Column(Numeric(10, 7), nullable=True)
	current_risk_level = Column(SQLEnum(RiskLevel, values_callable=enum_values, name='risk_level'), nullable=True, index=True)
	current_risk_score = Column(Numeric(5, 2), nullable=True)

	priority_level = Column(SQLEnum(PriorityLevel, values_callable=enum_values, name='priority_level'), default=PriorityLevel.MEDIUM)
	special_instructions = Column(Text, nullable=True)
	is_rerouted = Column(Boolean, default=False)
	reroute_count = Column(Integer, default=0)
	actual_delay_hours = Column(Numeric(6, 2), nullable=True)

	created_at = Column(DateTime(timezone=True), server_default=func.now())
	updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

	shipper = relationship('User', foreign_keys=[shipper_id], backref='shipped_shipments')
	receiver = relationship('User', foreign_keys=[receiver_id], backref='received_shipments')
	manager = relationship('User', foreign_keys=[assigned_manager_id], backref='managed_shipments')
	driver = relationship('User', foreign_keys=[assigned_driver_id], backref='driven_shipments')
	vessel = relationship('Vessel', backref='shipments')
	origin_port = relationship('Port', foreign_keys=[origin_port_id])
	destination_port = relationship('Port', foreign_keys=[destination_port_id])
	cargo = relationship('Cargo', back_populates='shipment', uselist=False, cascade='all, delete-orphan')
	routes = relationship('Route', back_populates='shipment', cascade='all, delete-orphan')
	alerts = relationship('Alert', back_populates='shipment', cascade='all, delete-orphan')
	status_updates = relationship('StatusUpdate', back_populates='shipment', order_by='StatusUpdate.created_at', cascade='all, delete-orphan')
