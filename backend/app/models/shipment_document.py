import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database.postgres import Base


class ShipmentDocument(Base):
	__tablename__ = 'shipment_documents'

	document_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	shipment_id = Column(UUID(as_uuid=True), ForeignKey('shipments.shipment_id', ondelete='CASCADE'), nullable=False, index=True)
	uploaded_by = Column(UUID(as_uuid=True), ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False, index=True)
	doc_type = Column(String(40), nullable=False)
	file_url = Column(Text, nullable=False)
	review_status = Column(String(20), nullable=False, default='pending')
	created_at = Column(DateTime(timezone=True), server_default=func.now())
