from sqlalchemy.orm import Session

from app.services.ml_service import run_complete_ml_pipeline


async def predict_for_shipment(shipment_id: str, db: Session) -> dict:
	return await run_complete_ml_pipeline(shipment_id=shipment_id, db=db)
