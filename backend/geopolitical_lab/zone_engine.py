from __future__ import annotations

from datetime import timedelta

from .llm_extractor import LLMZoneExtractor
from .providers import collect_live_events
from .schemas import (
    EventSource,
    RawEvent,
    RefreshResponse,
    RouteEvaluateRequest,
    RouteEvaluateResponse,
    RoutingAction,
    Zone,
    ZoneHit,
)
from .seed_data import default_seed_zones, mock_events
from .settings import LabSettings
from .utils import clamp, densify_waypoints, haversine_km, now_utc


_ACTION_WEIGHT = {
    RoutingAction.HARD_BLOCK: 1.5,
    RoutingAction.STRONG_AVOID: 1.2,
    RoutingAction.CAUTION: 0.7,
    RoutingAction.INFORMATIONAL: 0.4,
}


class GeopoliticalZoneEngine:
    def __init__(self, settings: LabSettings):
        self.settings = settings
        self.extractor = LLMZoneExtractor(settings)
        self._zones: dict[str, Zone] = {}
        self._raw_events: list[RawEvent] = []
        self.reset_to_seed()

    def reset_to_seed(self) -> None:
        self._zones = {zone.zone_id: zone for zone in default_seed_zones()}
        self._raw_events = []

    def _active_zones(self) -> list[Zone]:
        now = now_utc()
        return [zone for zone in self._zones.values() if zone.expires_at >= now]

    def get_zones(self, min_severity: float = 0.0, active_only: bool = True) -> list[Zone]:
        zones = self._active_zones() if active_only else list(self._zones.values())
        return sorted(
            [zone for zone in zones if zone.severity >= min_severity],
            key=lambda item: item.severity,
            reverse=True,
        )

    def get_raw_events(self) -> list[RawEvent]:
        return self._raw_events

    async def refresh(self, use_mock: bool = True) -> RefreshResponse:
        self.reset_to_seed()

        provider_counts: dict[str, int]
        if use_mock:
            raw_items = mock_events()
            events = [
                RawEvent(
                    event_id=f"mock-{idx}",
                    source=EventSource.MOCK,
                    title=item["title"],
                    description=item["description"],
                    latitude=item["latitude"],
                    longitude=item["longitude"],
                    event_type_hint=item["hint"],
                    metadata={"provider": "mock"},
                )
                for idx, item in enumerate(raw_items)
            ]
            provider_counts = {"mock": len(events)}
        else:
            events, provider_counts = await collect_live_events(self.settings)

        self._raw_events = events

        created = 0
        dedupe_keys: set[str] = {
            f"{zone.zone_type.value}:{round(zone.center_lat, 1)}:{round(zone.center_lng, 1)}"
            for zone in self._zones.values()
        }

        for event in events:
            zone = await self.extractor.extract_zone(event)

            # Skip if extractor could not locate a meaningful region.
            if abs(zone.center_lat) < 0.001 and abs(zone.center_lng) < 0.001:
                continue

            # Harmonize TTL for non-seed zones.
            zone.expires_at = now_utc() + timedelta(hours=self.settings.LIVE_ZONE_TTL_HOURS)

            key = f"{zone.zone_type.value}:{round(zone.center_lat, 1)}:{round(zone.center_lng, 1)}"
            if key in dedupe_keys:
                continue

            dedupe_keys.add(key)
            self._zones[zone.zone_id] = zone
            created += 1

        now = now_utc()
        return RefreshResponse(
            timestamp=now,
            mode="mock" if use_mock else "live",
            provider_counts=provider_counts,
            total_events=len(events),
            zones_created=created,
            zones_total_active=len(self._active_zones()),
        )

    def evaluate_route(self, request: RouteEvaluateRequest) -> RouteEvaluateResponse:
        active = self._active_zones()
        waypoints = [(item.lat, item.lng) for item in request.waypoints]
        dense_points = densify_waypoints(waypoints)

        hits: list[ZoneHit] = []
        max_score = 0.0

        for zone in active:
            min_distance = min(
                haversine_km(lat, lng, zone.center_lat, zone.center_lng)
                for lat, lng in dense_points
            )
            if min_distance > zone.radius_km:
                continue

            hits.append(
                ZoneHit(
                    zone_id=zone.zone_id,
                    zone_name=zone.name,
                    zone_type=zone.zone_type,
                    severity=zone.severity,
                    routing_action=zone.routing_action,
                    min_distance_km=round(min_distance, 2),
                    summary=zone.summary,
                )
            )

            weighted = zone.severity * 10.0 * _ACTION_WEIGHT[zone.routing_action]
            max_score = max(max_score, weighted)

        blocked = any(
            hit.routing_action == RoutingAction.HARD_BLOCK and hit.severity >= 7.0
            for hit in hits
        )

        risk_score = clamp(max_score if hits else 0.0, 0.0, 100.0)

        if blocked:
            action = "AVOID_ROUTE"
        elif risk_score >= 70:
            action = "STRONGLY_AVOID"
        elif risk_score >= 35:
            action = "USE_CAUTION"
        else:
            action = "ROUTE_ACCEPTABLE"

        hits_sorted = sorted(hits, key=lambda item: item.severity, reverse=True)

        return RouteEvaluateResponse(
            route_id=request.route_id,
            blocked=blocked,
            geopolitical_risk_score=round(risk_score, 2),
            recommended_action=action,
            hits=hits_sorted,
        )
