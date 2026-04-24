from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .schemas import RequiredApiKeysResponse, RouteEvaluateRequest, RouteEvaluateResponse
from .settings import get_lab_settings
from .zone_engine import GeopoliticalZoneEngine

settings = get_lab_settings()
engine = GeopoliticalZoneEngine(settings)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Keep seed zones loaded even when no provider keys are configured.
    engine.reset_to_seed()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description=(
        "Standalone geopolitics + maritime risk backend lab. "
        "Designed to run separately without affecting current RouteGuard API."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> dict:
    return {
        "service": settings.APP_NAME,
        "mode": "standalone-lab",
        "docs": "/docs",
    }


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "llm_provider": settings.LLM_PROVIDER,
        "active_zones": len(engine.get_zones(min_severity=0.0, active_only=True)),
    }


@app.get("/setup/required-keys", response_model=RequiredApiKeysResponse)
async def required_keys() -> RequiredApiKeysResponse:
    return RequiredApiKeysResponse(
        required_for_live=["NEWSAPI_KEY"],
        optional=["OPENAI_API_KEY"],
        not_required=["GDELT (public)", "NOAA weather.gov (public)"],
        notes=[
            "If OPENAI_API_KEY is missing, rules-based extraction is used.",
            "You can test everything with mock data without any API key.",
        ],
    )


@app.post("/zones/reset-seed")
async def reset_seed() -> dict:
    engine.reset_to_seed()
    return {
        "ok": True,
        "active_zones": len(engine.get_zones(min_severity=0.0, active_only=True)),
    }


@app.post("/zones/refresh")
async def refresh_zones(use_mock: bool = Query(default=True)):
    return await engine.refresh(use_mock=use_mock)


@app.get("/zones")
async def list_zones(
    min_severity: float = Query(default=0.0, ge=0.0, le=10.0),
    active_only: bool = Query(default=True),
):
    return engine.get_zones(min_severity=min_severity, active_only=active_only)


@app.get("/zones/active")
async def list_active_zones(min_severity: float = Query(default=5.0, ge=0.0, le=10.0)):
    return engine.get_zones(min_severity=min_severity, active_only=True)


@app.get("/events/raw")
async def list_raw_events():
    return engine.get_raw_events()


@app.post("/route/evaluate", response_model=RouteEvaluateResponse)
async def evaluate_route(request: RouteEvaluateRequest) -> RouteEvaluateResponse:
    return engine.evaluate_route(request)
