"""
monitoring_job.py
-----------------
APScheduler background job that runs every N minutes (default: 30).
Iterates over all active, non-delivered shipments and calls the
monitoring service to compute risk scores and create alerts.
"""

import asyncio
import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _run_monitoring_cycle() -> None:
    """
    Synchronous wrapper executed by APScheduler.
    Creates a fresh DB session and event loop slice so that
    the async monitoring logic can run from a background thread.
    """
    from app.database.postgres import SessionLocal
    from app.models.shipment import Shipment, ShipmentStatus
    from app.services.monitoring_service import monitor_shipment

    db = SessionLocal()
    try:
        # Fetch all shipments that are still in-flight
        active_statuses = [
            ShipmentStatus.PICKED_UP,
            ShipmentStatus.IN_TRANSIT,
            ShipmentStatus.AT_PORT,
            ShipmentStatus.CUSTOMS,
            ShipmentStatus.DELAYED,
        ]
        shipments = (
            db.query(Shipment)
            .filter(Shipment.current_status.in_(active_statuses))
            .all()
        )

        if not shipments:
            logger.info("Monitoring cycle: no active shipments to check.")
            return

        logger.info(f"Monitoring cycle: checking {len(shipments)} active shipment(s).")

        # Run async monitor_shipment calls sequentially inside a new event loop
        loop = asyncio.new_event_loop()
        try:
            for shipment in shipments:
                sid = str(shipment.shipment_id)
                try:
                    result = loop.run_until_complete(monitor_shipment(sid, db))
                    if result:
                        risk = result.get("model_outputs", {}).get("risk_score", "n/a")
                        logger.info(f"  ✓ Shipment {sid[:8]}… → risk={risk}")
                    else:
                        logger.debug(f"  – Shipment {sid[:8]}… skipped (no route/cargo).")
                except Exception as exc:
                    logger.error(f"  ✗ Monitoring failed for {sid[:8]}…: {exc}", exc_info=True)
        finally:
            loop.close()

        logger.info("Monitoring cycle complete.")
    except Exception as exc:
        logger.exception(f"Monitoring job crashed: {exc}")
    finally:
        db.close()


def start_monitoring_scheduler() -> BackgroundScheduler:
    """
    Start the APScheduler with an interval trigger.
    Interval is driven by the MONITORING_INTERVAL_MINUTES setting (default 30).
    """
    global _scheduler
    interval_minutes = settings.MONITORING_INTERVAL_MINUTES

    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _run_monitoring_cycle,
        trigger="interval",
        minutes=interval_minutes,
        id="monitoring_job",
        replace_existing=True,
        max_instances=1,  # Prevent overlapping runs
    )
    _scheduler.start()
    logger.info(
        f"Monitoring scheduler started — runs every {interval_minutes} minute(s)."
    )
    return _scheduler


def stop_monitoring_scheduler() -> None:
    """Graceful shutdown — called during app teardown if needed."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Monitoring scheduler stopped.")
