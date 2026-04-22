import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Numeric, Enum as SQLEnum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database.postgres import Base


class PortType(str, enum.Enum):
	SEA = 'sea'
	RIVER = 'river'
	INLAND = 'inland'
	AIRPORT = 'airport'


class Port(Base):
	__tablename__ = 'ports'

	port_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	port_name = Column(String(100), nullable=False)
	port_code = Column(String(10), unique=True, nullable=False, index=True)
	country = Column(String(50), nullable=False)
	latitude = Column(Numeric(10, 7), nullable=False)
	longitude = Column(Numeric(10, 7), nullable=False)
	max_vessel_draft = Column(Numeric, nullable=True)
	port_type = Column(SQLEnum(PortType), default=PortType.SEA)
	operating_hours = Column(String(50), nullable=True)
	customs_present = Column(Boolean, default=True)
	created_at = Column(DateTime(timezone=True), server_default=func.now())
