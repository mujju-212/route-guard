"""
ais.py — Real-time AIS Ship Tracking Router
Uses MyShipTracking.com public API (terrestrial AIS).
Provides global vessel monitoring for the Mission Control map.
"""

import os
import random
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, Query

router = APIRouter()

MST_BASE = "https://api.myshiptracking.com/api/v2"

# Round-robin through multiple API keys to avoid rate limits
_api_keys: list[str] = []


def _get_api_key() -> str:
    global _api_keys
    if not _api_keys:
        # Ensure .env is loaded
        try:
            from dotenv import load_dotenv
            env_path = Path(__file__).resolve().parents[2] / ".env"
            load_dotenv(env_path)
        except Exception:
            pass
        raw = os.getenv("AIS_API_KEYS", "")
        _api_keys = [k.strip() for k in raw.split(",") if k.strip()]
    if not _api_keys:
        raise ValueError("No AIS_API_KEYS configured in .env")
    return random.choice(_api_keys)


# ── Vessel type mapping ──────────────────────────────────────────────────────
VESSEL_TYPES = {
    0: "Unknown", 1: "Reserved", 2: "Wing in Ground", 3: "Special Category",
    4: "High Speed Craft", 5: "Special Category", 6: "Passenger",
    7: "Cargo", 8: "Tanker", 9: "Other",
}

NAV_STATUS = {
    0: "Under Way", 1: "At Anchor", 2: "Not Under Command",
    3: "Restricted Maneuverability", 4: "Constrained by Draught",
    5: "Moored", 6: "Aground", 7: "Engaged in Fishing",
    8: "Under Way Sailing", 15: "Not Defined",
}


def _enrich_vessel(v: dict) -> dict:
    """Add human-readable type/status labels and color coding."""
    vtype = v.get("vtype", 0)
    nav = v.get("nav_status", 15)
    speed = v.get("speed", 0) or 0

    # Color by vessel type for visual differentiation
    type_colors = {
        6: "#8B5CF6",  # Passenger → purple
        7: "#00D4B4",  # Cargo → teal
        8: "#F59E0B",  # Tanker → amber
        4: "#3B82F6",  # High Speed → blue
    }

    return {
        **v,
        "vessel_type_name": VESSEL_TYPES.get(vtype, "Other"),
        "nav_status_name": NAV_STATUS.get(nav, "Unknown"),
        "speed_knots": round(speed / 10, 1) if speed else 0,
        "marker_color": type_colors.get(vtype, "#6B7280"),
        "is_moving": speed > 5,
    }


@router.get("/zone")
async def vessels_in_zone(
    minlat: float = Query(default=-60),
    maxlat: float = Query(default=70),
    minlon: float = Query(default=-180),
    maxlon: float = Query(default=180),
):
    """Fetch real AIS vessel positions in a geographic bounding box."""
    # Clamp to valid ranges (Leaflet can send values beyond ±180)
    minlat = max(minlat, -90)
    maxlat = min(maxlat, 90)
    minlon = max(minlon, -180)
    maxlon = min(maxlon, 180)
    try:
        api_key = _get_api_key()
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{MST_BASE}/vessel/zone",
                params={"minlat": minlat, "maxlat": maxlat, "minlon": minlon, "maxlon": maxlon},
                headers={"x-api-key": api_key, "Accept": "application/json"},
            )
            r.raise_for_status()
            data = r.json()

        vessels = data.get("data", []) if isinstance(data, dict) else data
        enriched = [_enrich_vessel(v) for v in vessels if v.get("lat") and v.get("lng")]
        return {"status": "ok", "count": len(enriched), "vessels": enriched}

    except httpx.HTTPStatusError as e:
        return {"status": "error", "message": f"AIS API returned {e.response.status_code}", "vessels": []}
    except Exception as e:
        return {"status": "error", "message": str(e), "vessels": []}


@router.get("/vessel/{mmsi}")
async def vessel_status(mmsi: int):
    """Fetch real-time status of a specific vessel by MMSI."""
    try:
        api_key = _get_api_key()
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{MST_BASE}/vessel",
                params={"mmsi": mmsi},
                headers={"x-api-key": api_key, "Accept": "application/json"},
            )
            r.raise_for_status()
            data = r.json()

        vessel = data.get("data", data) if isinstance(data, dict) else data
        return {"status": "ok", "vessel": _enrich_vessel(vessel)}

    except Exception as e:
        return {"status": "error", "message": str(e), "vessel": None}


@router.get("/search")
async def vessel_search(name: str = Query(min_length=2)):
    """Search vessels by name."""
    try:
        api_key = _get_api_key()
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{MST_BASE}/vessel/search",
                params={"name": name},
                headers={"x-api-key": api_key, "Accept": "application/json"},
            )
            r.raise_for_status()
            data = r.json()

        vessels = data.get("data", []) if isinstance(data, dict) else data
        return {"status": "ok", "count": len(vessels), "vessels": vessels}

    except Exception as e:
        return {"status": "error", "message": str(e), "vessels": []}
