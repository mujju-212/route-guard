import enum
import uuid

from sqlalchemy import Column, DateTime, Numeric, Enum as SQLEnum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.postgres import Base


class DecisionType(str, enum.Enum):
	APPROVE_REROUTE = 'approve_reroute'
	REJECT_REROUTE = 'reject_reroute'
	MANUAL_OVERRIDE = 'manual_override'
	ESCALATE = 'escalate'
	MARK_RESOLVED = 'mark_resolved'


class DecisionOutcome(str, enum.Enum):
	SUCCESSFUL = 'successful'
	UNSUCCESSFUL = 'unsuccessful'
	PENDING = 'pending'


class ManagerDecision(Base):
	__tablename__ = 'manager_decisions'

	decision_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	shipment_id = Column(UUID(as_uuid=True), ForeignKey('shipments.shipment_id'), nullable=False)
	manager_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=False)
	decision_type = Column(SQLEnum(DecisionType), nullable=False)
	original_route_id = Column(UUID(as_uuid=True), ForeignKey('routes.route_id'), nullable=True)
	new_route_id = Column(UUID(as_uuid=True), ForeignKey('routes.route_id'), nullable=True)
	risk_score_at_decision = Column(Numeric(5, 2), nullable=True)
	predicted_delay_hr = Column(Numeric, nullable=True)
	predicted_delay_on_original = Column(Numeric, nullable=True)
	decision_reason = Column(Text, nullable=True)
	decision_at = Column(DateTime(timezone=True), server_default=func.now())
	outcome = Column(SQLEnum(DecisionOutcome), default=DecisionOutcome.PENDING)
	actual_delay_saved_hr = Column(Numeric, nullable=True)

	shipment = relationship('Shipment')
	manager = relationship('User')
	original_route = relationship('Route', foreign_keys=[original_route_id])
	new_route = relationship('Route', foreign_keys=[new_route_id])
