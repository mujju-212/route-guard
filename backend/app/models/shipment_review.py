import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database.postgres import Base


class ShipmentReview(Base):
	__tablename__ = 'shipment_reviews'

	review_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	shipment_id = Column(UUID(as_uuid=True), ForeignKey('shipments.shipment_id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
	reviewer_user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False, index=True)
	manager_user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=True)
	overall_rating = Column(Integer, nullable=False)
	on_time_rating = Column(Integer, nullable=False)
	communication_rating = Column(Integer, nullable=False)
	cargo_condition_rating = Column(Integer, nullable=False)
	average_rating = Column(Numeric(3, 2), nullable=False)
	comment = Column(Text, nullable=True)
	created_at = Column(DateTime(timezone=True), server_default=func.now())
	updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
