from __future__ import annotations

import json
import re
from datetime import timedelta

import httpx

from .schemas import EventSource, RawEvent, RoutingAction, Zone, ZoneType
from .settings import LabSettings
from .utils import clamp, new_zone_id, now_utc


_REGION_MAP: dict[str, tuple[float, float, float, str]] = {
    "red sea": (15.5, 41.2, 350.0, "Red Sea"),
    "bab el-mandeb": (12.5, 43.3, 250.0, "Bab el-Mandeb"),
    "gulf of guinea": (3.5, 2.8, 400.0, "Gulf of Guinea"),
    "somali": (11.5, 51.0, 500.0, "Somali Coast"),
    "gulf of aden": (12.0, 46.0, 400.0, "Gulf of Aden"),
    "strait of hormuz": (26.6, 56.3, 220.0, "Strait of Hormuz"),
    "black sea": (43.0, 34.0, 300.0, "Black Sea"),
    "south china sea": (13.0, 114.0, 700.0, "South China Sea"),
    "malacca": (3.0, 101.0, 220.0, "Strait of Malacca"),
    "singapore": (1.2, 103.8, 150.0, "Singapore Strait"),
    "bay of bengal": (14.0, 88.0, 500.0, "Bay of Bengal"),
}


def _keyword_zone_type(text: str) -> ZoneType:
    lowered = text.lower()
    if any(word in lowered for word in ["war", "missile", "drone", "naval attack", "military"]):
        return ZoneType.WAR_ZONE
    if any(word in lowered for word in ["piracy", "pirate", "hijack", "boarding", "robbery"]):
        return ZoneType.PIRACY_ZONE
    if any(word in lowered for word in ["sanction", "embargo", "restricted waters", "blockade"]):
        return ZoneType.SANCTION_ZONE
    if any(word in lowered for word in ["storm", "cyclone", "hurricane", "typhoon", "gale"]):
        return ZoneType.WEATHER_ZONE
    if any(word in lowered for word in ["port strike", "port closed", "terminal disruption"]):
        return ZoneType.PORT_DISRUPTION
    return ZoneType.PORT_DISRUPTION


def _default_action(zone_type: ZoneType) -> RoutingAction:
    if zone_type in {ZoneType.WAR_ZONE, ZoneType.SANCTION_ZONE}:
        return RoutingAction.HARD_BLOCK
    if zone_type == ZoneType.PIRACY_ZONE:
        return RoutingAction.STRONG_AVOID
    if zone_type == ZoneType.WEATHER_ZONE:
        return RoutingAction.CAUTION
    return RoutingAction.INFORMATIONAL


def _base_severity(zone_type: ZoneType) -> float:
    if zone_type == ZoneType.WAR_ZONE:
        return 9.0
    if zone_type == ZoneType.PIRACY_ZONE:
        return 7.0
    if zone_type == ZoneType.SANCTION_ZONE:
        return 8.0
    if zone_type == ZoneType.WEATHER_ZONE:
        return 6.0
    return 5.0


def _locate_region(text: str) -> tuple[float, float, float, str] | None:
    lowered = text.lower()
    for key, value in _REGION_MAP.items():
        if key in lowered:
            return value
    return None


def _extract_json_from_text(text: str) -> dict | None:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


class LLMZoneExtractor:
    def __init__(self, settings: LabSettings):
        self.settings = settings

    async def extract_zone(self, event: RawEvent) -> Zone:
        if self.settings.LLM_PROVIDER == "openai" and self.settings.OPENAI_API_KEY:
            zone = await self._extract_with_openai(event)
            if zone is not None:
                return zone

        return self._extract_with_rules(event)

    async def _extract_with_openai(self, event: RawEvent) -> Zone | None:
        prompt = (
            "You are a maritime risk analyst. Return strict JSON with keys: "
            "name, zone_type, severity(1-10), center_lat, center_lng, radius_km, "
            "routing_action, summary. "
            "zone_type must be one of: war_zone, piracy_zone, weather_zone, sanction_zone, port_disruption. "
            "routing_action must be one of: hard_block, strong_avoid, caution, informational."
        )

        payload = {
            "model": self.settings.OPENAI_MODEL,
            "temperature": 0.1,
            "messages": [
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": (
                        f"Title: {event.title}\n"
                        f"Description: {event.description}\n"
                        f"Known latitude: {event.latitude}\n"
                        f"Known longitude: {event.longitude}\n"
                        f"Event source: {event.source.value}"
                    ),
                },
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=self.settings.REQUEST_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.settings.OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                content = response.json()["choices"][0]["message"]["content"]
        except Exception:
            return None

        data = _extract_json_from_text(content)
        if not data:
            return None

        try:
            now = now_utc()
            ttl = timedelta(hours=self.settings.LIVE_ZONE_TTL_HOURS)

            zone_type = ZoneType(data["zone_type"])
            action = RoutingAction(data["routing_action"])

            return Zone(
                zone_id=new_zone_id(),
                name=str(data["name"]),
                zone_type=zone_type,
                severity=clamp(float(data["severity"]), 1.0, 10.0),
                center_lat=float(data["center_lat"]),
                center_lng=float(data["center_lng"]),
                radius_km=clamp(float(data["radius_km"]), 10.0, 5000.0),
                routing_action=action,
                source=event.source,
                summary=str(data["summary"]),
                created_at=now,
                expires_at=now + ttl,
                metadata={
                    "event_id": event.event_id,
                    "llm_provider": "openai",
                    "url": str(event.url) if event.url else "",
                },
            )
        except Exception:
            return None

    def _extract_with_rules(self, event: RawEvent) -> Zone:
        text = f"{event.title} {event.description}".strip()
        zone_type = _keyword_zone_type(text)
        severity = _base_severity(zone_type)

        if any(word in text.lower() for word in ["critical", "multiple attacks", "category 5", "hijacked"]):
            severity += 1.0
        if any(word in text.lower() for word in ["advisory", "watch", "minor"]):
            severity -= 0.8

        located = _locate_region(text)
        if event.latitude is not None and event.longitude is not None:
            lat, lng = event.latitude, event.longitude
            radius = self.settings.DEFAULT_ZONE_RADIUS_KM
            region_name = event.title[:48]
        elif located is not None:
            lat, lng, radius, region_name = located
        else:
            lat, lng = 0.0, 0.0
            radius = self.settings.DEFAULT_ZONE_RADIUS_KM
            region_name = "Unspecified Maritime Zone"

        action = _default_action(zone_type)

        now = now_utc()
        ttl = timedelta(hours=self.settings.LIVE_ZONE_TTL_HOURS)

        summary = (
            f"{zone_type.value.replace('_', ' ').title()} detected from {event.source.value}. "
            f"Use routing action: {action.value.replace('_', ' ')}."
        )

        return Zone(
            zone_id=new_zone_id(),
            name=region_name,
            zone_type=zone_type,
            severity=clamp(severity, 1.0, 10.0),
            center_lat=lat,
            center_lng=lng,
            radius_km=radius,
            routing_action=action,
            source=event.source if event.source != EventSource.MOCK else EventSource.MOCK,
            summary=summary,
            created_at=now,
            expires_at=now + ttl,
            metadata={
                "event_id": event.event_id,
                "llm_provider": "rules",
                "url": str(event.url) if event.url else "",
            },
        )
