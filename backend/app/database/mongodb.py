"""
database/mongodb.py  — Hackathon PostgreSQL-only mode
------------------------------------------------------
MongoDB is replaced with an in-memory stub so the codebase compiles
and runs without a Mongo connection.  All collection methods silently
no-op or return sensible defaults so no other file needs changing.
"""

from __future__ import annotations

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class _FakeCollection:
    """Mimics a Motor AsyncIOMotorCollection with the subset of methods the code uses."""

    def __init__(self, name: str) -> None:
        self._name = name
        self._store: list[dict] = []

    async def insert_one(self, document: dict) -> None:
        doc = dict(document)
        doc.setdefault("_id", f"fake_{id(doc)}")
        self._store.append(doc)

    async def find_one(self, query: dict = None, sort: list = None) -> dict | None:  # type: ignore[assignment]
        # Return the most recent item if any (good enough for analytics stubs)
        if self._store:
            return dict(self._store[-1])
        return None

    def find(self, query: dict = None):  # type: ignore[assignment]
        return _FakeCursor(list(self._store))

    async def update_one(self, query: dict, update: dict, upsert: bool = False) -> None:
        pass  # no-op

    async def create_index(self, keys, **kwargs) -> None:
        pass  # no-op

    async def command(self, cmd: str) -> dict:
        return {"ok": 1}


class _FakeCursor:
    def __init__(self, data: list[dict]) -> None:
        self._data = data

    def sort(self, *args, **kwargs) -> "_FakeCursor":
        return self

    async def to_list(self, length: int = 100) -> list[dict]:
        return self._data[:length]


class _FakeDatabase:
    """Mimics a Motor database with attribute-based collection access."""

    def __getattr__(self, name: str) -> _FakeCollection:
        return _FakeCollection(name)

    async def command(self, cmd: str) -> dict:
        return {"ok": 1}


# ── Public API (same names used throughout the codebase) ─────────────────────
mongodb = _FakeDatabase()

vessel_positions: _FakeCollection = _FakeCollection("vessel_positions")
weather_snapshots: _FakeCollection = _FakeCollection("weather_snapshots")
port_conditions: _FakeCollection = _FakeCollection("port_conditions")
ml_prediction_logs: _FakeCollection = _FakeCollection("ml_prediction_logs")
training_snapshots: _FakeCollection = _FakeCollection("training_snapshots")
route_clusters: _FakeCollection = _FakeCollection("route_clusters")
retraining_history: _FakeCollection = _FakeCollection("retraining_history")
model_metrics: _FakeCollection = _FakeCollection("model_metrics")


async def ping_mongodb() -> bool:
    return True  # Always healthy in stub mode


async def create_indexes() -> None:
    logger.info("MongoDB stub — index creation skipped (PostgreSQL-only mode).")
