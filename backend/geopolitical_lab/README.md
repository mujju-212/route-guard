# Geopolitical Lab (Standalone Backend)

This is an isolated backend prototype for maritime geopolitical risk zoning.
It is intentionally separated from your current RouteGuard backend flow.

## What it does

- Pulls events from mock/live providers (NewsAPI, GDELT, NOAA).
- Extracts structured maritime risk zones using:
  - rules-based parser (default), or
  - OpenAI (`gpt-4o-mini`) when key is provided.
- Keeps active danger zones with TTL.
- Evaluates route waypoints against zones and returns:
  - `blocked` (hard block when severe war/sanction zones are intersected)
  - `geopolitical_risk_score` (0-100)
  - recommended action and matched zone hits.

## Folder

- `backend/geopolitical_lab/main.py` - FastAPI app entrypoint
- `backend/geopolitical_lab/providers.py` - ingest providers
- `backend/geopolitical_lab/llm_extractor.py` - rules/LLM extraction
- `backend/geopolitical_lab/zone_engine.py` - zone lifecycle + route scoring
- `backend/geopolitical_lab/seed_data.py` - baseline zones + deterministic mock events
- `backend/geopolitical_lab/.env.example` - environment template

## Setup

1. Copy env template:

```powershell
Copy-Item backend\geopolitical_lab\.env.example backend\.env
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

### For first test (no keys needed)

- None. Keep `LLM_PROVIDER=rules` and use `POST /zones/refresh?use_mock=true`.

### For live mode

- `NEWSAPI_KEY` (recommended) for high-quality maritime news feed.
- `OPENAI_API_KEY` (optional) for LLM JSON extraction. If not present, rules parser is used.

### Not required

- GDELT key: not required (public API).
- NOAA key: not required (public API).

## Quick test flow

1. Reset to baseline seed zones:

```http
POST /zones/reset-seed
```

2. Add deterministic mock events (war/piracy/weather):

```http
POST /zones/refresh?use_mock=true
```

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

## Notes

- This prototype is backend-only to validate expected output quality first.
- Integration into your main RouteGuard backend can be done later via service calls or direct module merge.
