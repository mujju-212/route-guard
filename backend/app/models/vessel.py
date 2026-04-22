import enum
import uuid

from sqlalchemy import Column, DateTime, Numeric, Enum as SQLEnum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.postgres import Base


class VesselType(str, enum.Enum):
	CONTAINER = 'container'
	BULK = 'bulk'
	TANKER = 'tanker'
	REEFER = 'reefer'
	RORO = 'roro'
	GENERAL = 'general'


class VesselStatus(str, enum.Enum):
	ACTIVE = 'active'
	MAINTENANCE = 'maintenance'
	DOCKED = 'docked'
	DECOMMISSIONED = 'decommissioned'


class Vessel(Base):
	__tablename__ = 'vessels'

	vessel_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	vessel_name = Column(String(100), nullable=False)
	mmsi_number = Column(String(20), unique=True, nullable=True)
	imo_number = Column(String(20), unique=True, nullable=True)
	vessel_type = Column(SQLEnum(VesselType), nullable=False)
	flag_country = Column(String(50), nullable=True)
	gross_tonnage = Column(Numeric, nullable=True)
	deadweight = Column(Numeric, nullable=True)
	max_draft = Column(Numeric, nullable=True)
	max_speed = Column(Numeric, nullable=True)
	built_year = Column(Integer, nullable=True)
	owner_user_id = Column(UUID(as_uuid=True), ForeignKey('users.user_id'), nullable=True)
	current_status = Column(SQLEnum(VesselStatus), default=VesselStatus.ACTIVE)
	created_at = Column(DateTime(timezone=True), server_default=func.now())

	owner = relationship('User', backref='owned_vessels')
