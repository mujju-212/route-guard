# Geopolitical Lab (Standalone Backend)

This is an isolated backend prototype for maritime geopolitical risk zoning.
It is intentionally separated from your current RouteGuard backend flow.

## What it does

- Pulls events from mock/live providers (GDELT, NOAA).
- Accepts direct structured event input over API.
- Extracts maritime risk zones using deterministic structured rules only.
- Keeps active danger zones with TTL.
- Evaluates route waypoints against zones and returns:
  - `blocked` (hard block when severe war/sanction zones are intersected)
  - `geopolitical_risk_score` (0-100)
  - recommended action and matched zone hits.

## Folder

- `backend/geopolitical_lab/main.py` - FastAPI app entrypoint
- `backend/geopolitical_lab/providers.py` - ingest providers
- `backend/geopolitical_lab/llm_extractor.py` - structured rules extraction
- `backend/geopolitical_lab/zone_engine.py` - zone lifecycle + route scoring
- `backend/geopolitical_lab/seed_data.py` - baseline zones + deterministic mock events
- `backend/geopolitical_lab/.env.example` - environment template

## Setup

1. Copy env template:

```powershell
Copy-Item backend\geopolitical_lab\.env.example .env
```

2. Install dependencies (uses your existing backend requirements plus `httpx`):

```powershell
pip install -r backend\requirements.txt
```

3. Run standalone service (from repo root):

```powershell
python -m uvicorn backend.geopolitical_lab.main:app --host 0.0.0.0 --port 8010 --reload
```

4. Open docs:

- `http://localhost:8010/docs`

## API keys needed

- None required.
- GDELT is public.
- NOAA weather.gov is public.

## Quick test flow

1. Reset to baseline seed zones:

```http
POST /zones/reset-seed
```

2. Add deterministic mock events (war/piracy/weather):

```http
POST /zones/refresh?use_mock=true
```

Live real-data refresh (public feeds):

```http
POST /zones/refresh?use_mock=false
```

Response includes real analysis metadata:

- `timestamp` -> analysis datetime (UTC)
- `provider_counts` -> events pulled per provider
- `total_events` -> total events analyzed
- `zones_created` -> new zones produced from current run
- `zones_total_active` -> active zones after refresh

3. List active zones:

```http
GET /zones/active?min_severity=5
```

4. Evaluate sample route:

```http
POST /route/evaluate
Content-Type: application/json

{
  "route_id": "busan-rotterdam-candidate",
  "waypoints": [
    {"lat": 35.1, "lng": 129.1},
    {"lat": 20.0, "lng": 80.0},
    {"lat": 13.0, "lng": 43.0},
    {"lat": 30.0, "lng": 20.0},
    {"lat": 51.9, "lng": 4.4}
  ]
}
```

Expected: route intersects Red Sea war zone -> `blocked=true` and high risk score.

## Structured input example

Use this to submit clean, explicit events without any external news parsing:

```http
POST /zones/ingest-structured?reset_to_seed=false
Content-Type: application/json

{
  "events": [
    {
      "title": "Manual conflict alert near Bab el-Mandeb",
      "description": "Operator-reported military threat near shipping lane",
      "source": "manual",
      "latitude": 12.5,
      "longitude": 43.2,
      "event_type_hint": "war",
      "severity_hint": 9.4,
      "radius_km_hint": 280
    }
  ]
}
```

## Notes

- This prototype is backend-only to validate expected output quality first.
- Integration into your main RouteGuard backend can be done later via service calls or direct module merge.
