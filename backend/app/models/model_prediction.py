import uuid

from sqlalchemy import Boolean, Column, DateTime, Numeric, Enum as SQLEnum, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database.postgres import Base
from app.models.enum_utils import enum_values
from app.models.shipment import RiskLevel


class ModelPrediction(Base):
	__tablename__ = 'model_predictions'

	prediction_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	shipment_id = Column(UUID(as_uuid=True), ForeignKey('shipments.shipment_id'), nullable=False, index=True)
	prediction_timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

	weather_score = Column(Numeric(5, 2), nullable=True)
	traffic_score = Column(Numeric(5, 2), nullable=True)
	port_score = Column(Numeric(5, 2), nullable=True)
	historical_score = Column(Numeric(5, 2), nullable=True)
	cargo_sensitivity = Column(Numeric(5, 2), nullable=True)
	distance_remaining = Column(Numeric, nullable=True)
	time_of_day = Column(Integer, nullable=True)
	day_of_week = Column(Integer, nullable=True)
	season = Column(Integer, nullable=True)

	risk_score = Column(Numeric(5, 2), nullable=True)
	risk_level = Column(SQLEnum(RiskLevel, values_callable=enum_values, name='risk_level'), nullable=True)
	predicted_delay_hr = Column(Numeric, nullable=True)
	reroute_recommended = Column(Boolean, nullable=True)
	confidence_percent = Column(Numeric(5, 2), nullable=True)

	actual_delay_hr = Column(Numeric, nullable=True)
	prediction_error = Column(Numeric, nullable=True)
	used_for_retraining = Column(Boolean, default=False)

	shipment = relationship('Shipment')
