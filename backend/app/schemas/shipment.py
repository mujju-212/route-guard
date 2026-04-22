from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.cargo import CargoType
from app.models.shipment import PriorityLevel, RiskLevel, ShipmentStatus


class CargoCreate(BaseModel):
	cargo_type: CargoType
	description: str
	weight_kg: Decimal
	volume_cbm: Decimal | None = None
	quantity: int | None = None
	unit_type: str | None = None
	declared_value: Decimal | None = None
	temperature_required: Decimal | None = None
	humidity_required: Decimal | None = None
	handling_instructions: str | None = None
	hazmat_class: str | None = None
	insurance_value: Decimal | None = None


class ShipmentCreate(BaseModel):
	origin_port_id: str
	destination_port_id: str
	departure_time: datetime
	expected_arrival: datetime
	receiver_id: str
	priority_level: PriorityLevel = PriorityLevel.MEDIUM
	special_instructions: str | None = None
	cargo: CargoCreate


class CoordinatesSchema(BaseModel):
	lat: Decimal
	lng: Decimal


class ShipmentResponse(BaseModel):
	shipment_id: str
	tracking_number: str
	shipper_id: str
	receiver_id: str
	assigned_manager_id: str | None = None
	assigned_driver_id: str | None = None
	assigned_vessel_id: str | None = None
	origin_port_id: str
	destination_port_id: str
	departure_time: datetime
	expected_arrival: datetime
	actual_arrival: datetime | None = None
	current_status: ShipmentStatus
	current_latitude: Decimal | None = None
	current_longitude: Decimal | None = None
	current_risk_level: RiskLevel | None = None
	current_risk_score: Decimal | None = None
	priority_level: PriorityLevel
	is_rerouted: bool
	reroute_count: int
	actual_delay_hours: Decimal | None = None
	created_at: datetime

	model_config = ConfigDict(from_attributes=True)


class ShipmentDetailResponse(ShipmentResponse):
	shipper_name: str
	receiver_name: str
	manager_name: str | None = None
	driver_name: str | None = None
	vessel_name: str | None = None
	origin_port_name: str
	destination_port_name: str
	cargo_type: CargoType
	cargo_description: str
	declared_value: Decimal | None = None
	cargo_sensitivity_score: Decimal | None = None


class StatusUpdateRequest(BaseModel):
	new_status: ShipmentStatus
	latitude: Decimal | None = None
	longitude: Decimal | None = None
	notes: str | None = None
	incident_type: str | None = None
