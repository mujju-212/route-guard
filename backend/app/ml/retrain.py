"""
retrain.py
----------
Public API for triggering model retraining on demand (e.g., from an admin
endpoint or a test script).  The actual heavy-lifting lives inside
`app/background/retraining_job.py`; this module provides a thin async wrapper
so callers don't need to import from `background/`.

Usage (from a router or CLI):
    from app.ml.retrain import retrain_models
    result = await retrain_models()
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


async def retrain_models() -> dict:
    """
    Trigger the full retraining pipeline asynchronously.

    Runs the synchronous `_run_retraining_cycle` in a thread-pool executor
    so it doesn't block the event loop.  Returns a summary dict.
    """
    from app.background.retraining_job import _run_retraining_cycle

    start = datetime.utcnow()
    logger.info("Manual retraining triggered via retrain_models().")

    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _run_retraining_cycle)
        duration_s = (datetime.utcnow() - start).total_seconds()
        return {
            "status": "completed",
            "started_at": start.isoformat(),
            "duration_seconds": round(duration_s, 2),
            "message": "Retraining pipeline finished — check MongoDB retraining_history for details.",
        }
    except Exception as exc:
        logger.exception(f"retrain_models() failed: {exc}")
        return {
            "status": "failed",
            "started_at": start.isoformat(),
            "error": str(exc),
        }
