from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.alert import AlertSeverity, AlertType


class AlertResponse(BaseModel):
	alert_id: str
	shipment_id: str
	tracking_number: str | None = None
	alert_type: AlertType
	severity: AlertSeverity
	message: str
	risk_score_at_alert: Decimal | None = None
	triggered_by: str
	is_read: bool
	is_resolved: bool
	sent_to_roles: str | None = None
	created_at: datetime

	model_config = ConfigDict(from_attributes=True)

	@field_validator('alert_id', 'shipment_id', mode='before')
	@classmethod
	def uuid_to_str(cls, v):
		return str(v) if v is not None else v


class AlertResolveRequest(BaseModel):
	resolution_notes: str | None = None
