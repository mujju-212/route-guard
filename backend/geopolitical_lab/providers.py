from __future__ import annotations

import asyncio
from datetime import datetime

import httpx

from .schemas import EventSource, RawEvent
from .settings import LabSettings


def _http_timeout(settings: LabSettings) -> httpx.Timeout:
    # Explicit phase timeouts reduce the chance of hanging provider calls.
    total = float(settings.REQUEST_TIMEOUT_SECONDS)
    connect = min(8.0, total)
    read = max(5.0, total - 3.0)
    return httpx.Timeout(total, connect=connect, read=read, write=10.0, pool=10.0)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None

    text = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _geometry_to_center_radius(geometry: dict | None) -> tuple[float, float, float] | None:
    if not geometry:
        return None

    geom_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if not coordinates:
        return None

    points: list[tuple[float, float]] = []

    # Polygon -> [ [ [lng,lat], ... ] ]
    if geom_type == "Polygon":
        for ring in coordinates:
            for lng, lat in ring:
                points.append((float(lat), float(lng)))

    # MultiPolygon -> [ [ [ [lng,lat], ... ] ] ]
    if geom_type == "MultiPolygon":
        for polygon in coordinates:
            for ring in polygon:
                for lng, lat in ring:
                    points.append((float(lat), float(lng)))

    if not points:
        return None

    lats = [item[0] for item in points]
    lngs = [item[1] for item in points]

    center_lat = sum(lats) / len(lats)
    center_lng = sum(lngs) / len(lngs)

    # Approx radius from bounding box half diagonal in km.
    lat_span = max(lats) - min(lats)
    lng_span = max(lngs) - min(lngs)
    radius_km = max(50.0, ((lat_span + lng_span) / 2.0) * 111.0)

    return center_lat, center_lng, radius_km


async def fetch_gdelt_events(settings: LabSettings) -> list[RawEvent]:
    query = (
        "(maritime OR shipping OR tanker OR cargo OR vessel) "
        "AND (piracy OR missile OR war OR sanctions OR storm OR conflict)"
    )

    url = "https://api.gdeltproject.org/api/v2/doc/doc"
    params = {
        "query": query,
        "mode": "ArtList",
        "maxrecords": settings.INGEST_LIMIT_PER_PROVIDER,
        "format": "json",
        "sort": "DateDesc",
    }

    async with httpx.AsyncClient(timeout=_http_timeout(settings), follow_redirects=True) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()

    events: list[RawEvent] = []
    for idx, item in enumerate(payload.get("articles", [])):
        title = item.get("title") or "Untitled GDELT maritime event"
        desc = item.get("seendate") or ""
        events.append(
            RawEvent(
                event_id=f"gdelt-{idx}-{abs(hash(title)) % 100000}",
                source=EventSource.GDELT,
                title=title,
                description=desc,
                url=item.get("url"),
                published_at=_parse_dt(item.get("seendate")),
                metadata={"provider": "gdelt"},
            )
        )

    return events


async def fetch_noaa_events(settings: LabSettings) -> list[RawEvent]:
    url = "https://api.weather.gov/alerts/active"
    params = {"status": "actual", "message_type": "alert"}

    async with httpx.AsyncClient(timeout=_http_timeout(settings), follow_redirects=True) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        payload = response.json()

    events: list[RawEvent] = []
    for idx, feature in enumerate(payload.get("features", [])):
        props = feature.get("properties", {})
        event_name = (props.get("event") or "").lower()
        headline = props.get("headline") or ""
        description = props.get("description") or ""
        area_desc = props.get("areaDesc") or ""

        marine_keywords = ["marine", "hurricane", "tropical", "storm", "gale", "coastal", "typhoon"]
        text_blob = f"{event_name} {headline} {description}".lower()
        if not any(keyword in text_blob for keyword in marine_keywords):
            continue

        geo = _geometry_to_center_radius(feature.get("geometry"))
        lat = geo[0] if geo else None
        lng = geo[1] if geo else None

        events.append(
            RawEvent(
                event_id=f"noaa-{idx}-{abs(hash(headline)) % 100000}",
                source=EventSource.NOAA,
                title=headline or props.get("event") or "NOAA marine alert",
                description=f"{area_desc}. {description[:600]}",
                published_at=_parse_dt(props.get("sent")),
                latitude=lat,
                longitude=lng,
                event_type_hint="weather",
                metadata={
                    "provider": "noaa",
                    "radius_km_hint": geo[2] if geo else 300.0,
                },
            )
        )

    return events


async def collect_live_events(settings: LabSettings) -> tuple[list[RawEvent], dict[str, int]]:
    async def _safe_collect(name: str, fn):
        try:
            # Hard upper bound per source so one endpoint cannot block full refresh.
            result = await asyncio.wait_for(fn(settings), timeout=settings.REQUEST_TIMEOUT_SECONDS + 5)
            return name, result
        except Exception:
            return name, []

    tasks = [
        _safe_collect("gdelt", fetch_gdelt_events),
        _safe_collect("noaa", fetch_noaa_events),
    ]

    done = await asyncio.gather(*tasks)

    events: list[RawEvent] = []
    counts: dict[str, int] = {}
    for name, items in done:
        counts[name] = len(items)
        events.extend(items)

    return events, counts
