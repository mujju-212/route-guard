"""Seed manager consignment request data (quote requests + offers + messages)."""

import os
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database.postgres import SessionLocal
from app.models.cargo import CargoType
from app.models.negotiation_message import NegotiationMessage
from app.models.port import Port
from app.models.quote_offer import QuoteOffer, QuoteOfferStatus
from app.models.quote_request import QuoteRequest, QuoteRequestStatus
from app.models.user import User, UserRole


def _first_two(items, label):
	if len(items) < 2:
		raise RuntimeError(f"Need at least 2 {label} records. Found {len(items)}.")
	return items[0], items[1]


def main() -> int:
	db = SessionLocal()
	try:
		existing = db.query(QuoteRequest).count()
		if existing > 0:
			print(f"Quote requests already exist ({existing}). Skipping to avoid duplicates.")
			print("If you need a fresh dataset, clear quote_requests/quote_offers/negotiation_messages and rerun.")
			return 0

		managers = db.query(User).filter(User.role == UserRole.MANAGER).order_by(User.created_at.asc()).all()
		shippers = db.query(User).filter(User.role == UserRole.SHIPPER).order_by(User.created_at.asc()).all()
		receivers = db.query(User).filter(User.role == UserRole.RECEIVER).order_by(User.created_at.asc()).all()
		ports = db.query(Port).order_by(Port.created_at.asc()).all()

		if not managers:
			raise RuntimeError("No manager user found. Seed users first.")
		if len(ports) < 4:
			raise RuntimeError(f"Need at least 4 ports. Found {len(ports)}.")

		shipper_a, shipper_b = _first_two(shippers, "shippers")
		receiver_a, receiver_b = _first_two(receivers, "receivers")
		manager = managers[0]

		p1, p2, p3, p4 = ports[0], ports[1], ports[2], ports[3]
		now = datetime.now(UTC)

		req_draft = QuoteRequest(
			shipper_id=shipper_a.user_id,
			receiver_id=receiver_a.user_id,
			origin_port_id=p1.port_id,
			destination_port_id=p2.port_id,
			pickup_address=f"Warehouse A, {p1.port_name}",
			dropoff_address=f"Dock 7, {p2.port_name}",
			cargo_type=CargoType.ELECTRONICS,
			quantity=120,
			weight_kg=Decimal("9200"),
			volume_cbm=Decimal("58"),
			special_instructions="Fragile components. Keep dry.",
			status=QuoteRequestStatus.DRAFT,
		)
		req_sent = QuoteRequest(
			shipper_id=shipper_b.user_id,
			receiver_id=receiver_b.user_id,
			origin_port_id=p2.port_id,
			destination_port_id=p3.port_id,
			pickup_address=f"Export Yard, {p2.port_name}",
			dropoff_address=f"Terminal 3, {p3.port_name}",
			cargo_type=CargoType.PERISHABLE,
			quantity=340,
			weight_kg=Decimal("15400"),
			volume_cbm=Decimal("85"),
			special_instructions="Cold chain required under 5C.",
			status=QuoteRequestStatus.SENT,
		)
		req_negotiating = QuoteRequest(
			shipper_id=shipper_a.user_id,
			receiver_id=receiver_b.user_id,
			origin_port_id=p3.port_id,
			destination_port_id=p4.port_id,
			pickup_address=f"North Cargo Gate, {p3.port_name}",
			dropoff_address=f"Main Harbor, {p4.port_name}",
			cargo_type=CargoType.PHARMACEUTICAL,
			quantity=60,
			weight_kg=Decimal("3600"),
			volume_cbm=Decimal("24"),
			special_instructions="Priority medicine shipment.",
			status=QuoteRequestStatus.NEGOTIATING,
		)
		req_accepted = QuoteRequest(
			shipper_id=shipper_b.user_id,
			receiver_id=receiver_a.user_id,
			origin_port_id=p4.port_id,
			destination_port_id=p1.port_id,
			pickup_address=f"Storage Block C, {p4.port_name}",
			dropoff_address=f"Inbound Zone, {p1.port_name}",
			cargo_type=CargoType.STANDARD,
			quantity=210,
			weight_kg=Decimal("11000"),
			volume_cbm=Decimal("70"),
			special_instructions="Stack-safe loading only.",
			status=QuoteRequestStatus.ACCEPTED,
		)
		req_sent_2 = QuoteRequest(
			shipper_id=shipper_a.user_id,
			receiver_id=receiver_a.user_id,
			origin_port_id=p1.port_id,
			destination_port_id=p3.port_id,
			pickup_address=f"Dockside Loading, {p1.port_name}",
			dropoff_address=f"Customs Yard, {p3.port_name}",
			cargo_type=CargoType.LIQUID_BULK,
			quantity=45,
			weight_kg=Decimal("28000"),
			volume_cbm=Decimal("96"),
			special_instructions="Hazmat inspection required before loading.",
			status=QuoteRequestStatus.SENT,
		)

		db.add_all([req_draft, req_sent, req_negotiating, req_accepted, req_sent_2])
		db.flush()

		offer_sent = QuoteOffer(
			request_id=req_sent.request_id,
			provider_user_id=manager.user_id,
			offered_amount_usd=Decimal("23800.00"),
			currency="USD",
			estimated_pickup_at=now + timedelta(days=1),
			estimated_delivery_at=now + timedelta(days=9),
			notes="Standard lane with refrigerated handoff.",
			status=QuoteOfferStatus.ACTIVE,
			valid_until=now + timedelta(days=2),
		)
		offer_negotiating = QuoteOffer(
			request_id=req_negotiating.request_id,
			provider_user_id=manager.user_id,
			offered_amount_usd=Decimal("31600.00"),
			currency="USD",
			estimated_pickup_at=now + timedelta(hours=18),
			estimated_delivery_at=now + timedelta(days=7),
			notes="Priority chain and escort handling.",
			status=QuoteOfferStatus.COUNTERED,
			valid_until=now + timedelta(days=1),
		)
		offer_accepted = QuoteOffer(
			request_id=req_accepted.request_id,
			provider_user_id=manager.user_id,
			offered_amount_usd=Decimal("19250.00"),
			currency="USD",
			estimated_pickup_at=now - timedelta(days=2),
			estimated_delivery_at=now + timedelta(days=5),
			notes="Accepted by shipper.",
			status=QuoteOfferStatus.ACCEPTED,
			valid_until=now + timedelta(days=3),
		)

		db.add_all([offer_sent, offer_negotiating, offer_accepted])
		db.flush()

		req_accepted.selected_offer_id = offer_accepted.offer_id

		msg1 = NegotiationMessage(
			request_id=req_negotiating.request_id,
			offer_id=offer_negotiating.offer_id,
			sender_user_id=manager.user_id,
			message_type="counter",
			body="We can lock fast-track customs if we close at 31,600 USD.",
			counter_amount_usd=Decimal("31600.00"),
		)
		msg2 = NegotiationMessage(
			request_id=req_negotiating.request_id,
			offer_id=offer_negotiating.offer_id,
			sender_user_id=shipper_a.user_id,
			message_type="counter",
			body="Can we close at 30,900 USD with same SLA?",
			counter_amount_usd=Decimal("30900.00"),
		)
		msg3 = NegotiationMessage(
			request_id=req_negotiating.request_id,
			offer_id=offer_negotiating.offer_id,
			sender_user_id=manager.user_id,
			message_type="text",
			body="Reviewing with operations team, will confirm shortly.",
		)

		db.add_all([msg1, msg2, msg3])
		db.commit()

		total = db.query(QuoteRequest).count()
		draft = db.query(QuoteRequest).filter(QuoteRequest.status == QuoteRequestStatus.DRAFT).count()
		sent = db.query(QuoteRequest).filter(QuoteRequest.status == QuoteRequestStatus.SENT).count()
		nego = db.query(QuoteRequest).filter(QuoteRequest.status == QuoteRequestStatus.NEGOTIATING).count()
		accepted = db.query(QuoteRequest).filter(QuoteRequest.status == QuoteRequestStatus.ACCEPTED).count()
		offers = db.query(QuoteOffer).count()
		messages = db.query(NegotiationMessage).count()

		print("Seeded consignment request dataset.")
		print(f"Quote requests: {total} (draft={draft}, sent={sent}, negotiating={nego}, accepted={accepted})")
		print(f"Quote offers: {offers}")
		print(f"Negotiation messages: {messages}")
		return 0
	except Exception as exc:
		db.rollback()
		print(f"Seeding failed: {exc}")
		return 1
	finally:
		db.close()


if __name__ == "__main__":
	raise SystemExit(main())
