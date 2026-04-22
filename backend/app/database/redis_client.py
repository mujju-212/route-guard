"""
database/redis_client.py  — Hackathon PostgreSQL-only mode
----------------------------------------------------------
Redis is replaced with an in-memory dict so the app runs without a
Redis instance.  All helper functions (set_risk_score, get_risk_score,
set_active_alert, get_active_alerts, delete_alert) work identically —
they just store data in process memory instead of Redis.

Note: data is lost on restart (fine for hackathon demo).
"""

from __future__ import annotations

import json
import logging
import time

logger = logging.getLogger(__name__)

# ── In-memory store ─────────────────────────────────────────────────────────
_store: dict[str, tuple[str, float | None]] = {}  # key → (value, expires_at or None)


def _now() -> float:
    return time.monotonic()


class _FakeRedis:
    """Minimal async Redis-compatible object used at startup health-check."""

    async def ping(self) -> bool:
        return True

    async def close(self) -> None:
        pass


redis_client = _FakeRedis()


# ── Internal helpers ─────────────────────────────────────────────────────────
def _set(key: str, value: str, ttl_seconds: int | None = None) -> None:
    expires_at = (_now() + ttl_seconds) if ttl_seconds else None
    _store[key] = (value, expires_at)


def _get(key: str) -> str | None:
    entry = _store.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if expires_at is not None and _now() > expires_at:
        del _store[key]
        return None
    return value


def _delete(key: str) -> None:
    _store.pop(key, None)


def _keys_with_prefix(prefix: str) -> list[str]:
    now = _now()
    result = []
    for k, (v, exp) in list(_store.items()):
        if k.startswith(prefix):
            if exp is None or now <= exp:
                result.append(k)
            else:
                del _store[k]
    return result


# ── Public API (same signatures as the Redis version) ────────────────────────
async def ping_redis() -> bool:
    return True


async def set_risk_score(shipment_id: str, risk_score: float, ttl: int = 1800) -> None:
    _set(f"risk:{shipment_id}", str(risk_score), ttl)


async def get_risk_score(shipment_id: str) -> float | None:
    value = _get(f"risk:{shipment_id}")
    return float(value) if value else None


async def set_active_alert(alert_id: str, alert_data: dict, ttl: int = 86400) -> None:
    _set(f"alert:{alert_id}", json.dumps(alert_data), ttl)


async def get_active_alerts() -> list[dict]:
    results: list[dict] = []
    for key in _keys_with_prefix("alert:"):
        raw = _get(key)
        if raw:
            try:
                results.append(json.loads(raw))
            except json.JSONDecodeError:
                pass
    return results


async def delete_alert(alert_id: str) -> None:
    _delete(f"alert:{alert_id}")
