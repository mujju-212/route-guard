import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Numeric, Enum as SQLEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.postgres import Base
from app.models.enum_utils import enum_values


class AlertType(str, enum.Enum):
	RISK_INCREASE = 'risk_increase'
	WEATHER_WARNING = 'weather_warning'
	PORT_CONGESTION = 'port_congestion'
	ROUTE_CHANGE = 'route_change'
	DELAY_DETECTED = 'delay_detected'
	DELIVERY_CONFIRMED = 'delivery_confirmed'
	INCIDENT_REPORTED = 'incident_reported'


class AlertSeverity(str, enum.Enum):
	INFO = 'info'
	WARNING = 'warning'
	HIGH = 'high'
	CRITICAL = 'critical'


class Alert(Base):
	__tablename__ = 'alerts'

	alert_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	shipment_id = Column(UUID(as_uuid=True), ForeignKey('shipments.shipment_id'), nullable=False, index=True)
	alert_type = Column(SQLEnum(AlertType, values_callable=enum_values, name='alert_type'), nullable=False)
	severity = Column(SQLEnum(AlertSeverity, values_callable=enum_values, name='alert_severity'), nullable=False, index=True)
	message = Column(Text, nullable=False)
	risk_score_at_alert = Column(Numeric(5, 2), nullable=True)
	triggered_by = Column(String(20), default='system')
	is_read = Column(Boolean, default=False)
	is_resolved = Column(Boolean, default=False, index=True)
	sent_to_roles = Column(String(100), nullable=True)
	created_at = Column(DateTime(timezone=True), server_default=func.now())
	resolved_at = Column(DateTime(timezone=True), nullable=True)
	resolved_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=True)

	shipment = relationship('Shipment', back_populates='alerts')
	resolver = relationship('User')
