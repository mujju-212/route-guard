"""
main.py — RouteGuard FastAPI Application
-----------------------------------------
Hackathon mode: PostgreSQL only.
MongoDB and Redis are replaced with in-memory stubs (no external services needed).
"""

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database.postgres import Base, engine
from app.routers import alerts, analytics, auth, driver, manager, monitoring, shipments, websocket


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ────────────────────────────────────────────────────────────────
    print("🚀 RouteGuard API Starting (PostgreSQL-only mode)...")

    # Create all PostgreSQL tables from ORM models
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ PostgreSQL tables created / verified")
    except Exception as exc:
        print(f"❌ PostgreSQL connection failed: {exc}")
        print("   → Make sure PostgreSQL is running and credentials are correct.")
        print(f"   → Connection: postgresql://{settings.POSTGRES_USER}:***@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
        raise

    # Start background monitoring scheduler
    try:
        from app.background.monitoring_job import start_monitoring_scheduler
        start_monitoring_scheduler()
        print(f"✅ Monitoring scheduler started (every {settings.MONITORING_INTERVAL_MINUTES} min)")
    except Exception as exc:
        print(f"⚠️  Monitoring scheduler failed to start: {exc}")

    print("✅ RouteGuard API ready → Swagger UI: http://localhost:8000/docs")

    yield

    # ── Shutdown ───────────────────────────────────────────────────────────────
    print("🛑 RouteGuard API shutting down...")


# ── Application factory ────────────────────────────────────────────────────────
app = FastAPI(
    title="RouteGuard API",
    version="1.0.0",
    description=(
        "🚢 AI-Powered Predictive Supply Chain Risk Management.\n\n"
        "Monitors active shipments every 30 minutes using XGBoost, Random Forest, "
        "Gradient Boosting, and LSTM models to predict risk scores, delays, "
        "and rerouting recommendations.\n\n"
        "**Hackathon mode**: Running with PostgreSQL only (no MongoDB/Redis required)."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ────────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth.router,       prefix="/auth",      tags=["🔐 Authentication"])
app.include_router(shipments.router,  prefix="/shipments", tags=["📦 Shipments"])
app.include_router(monitoring.router, prefix="/shipments", tags=["🎯 Monitoring & ML"])
app.include_router(alerts.router,     prefix="/alerts",    tags=["🚨 Alerts"])
app.include_router(manager.router,    prefix="/manager",   tags=["👔 Manager"])
app.include_router(driver.router,     prefix="/driver",    tags=["🚛 Driver"])
app.include_router(analytics.router,  prefix="/analytics", tags=["📊 Analytics"])
app.include_router(websocket.router,                       tags=["🔌 WebSocket"])


# ── Root endpoints ──────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root() -> dict:
    return {
        "service": "RouteGuard API",
        "version": "1.0.0",
        "status": "operational",
        "mode": "postgresql-only",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check() -> dict:
    """Database health check endpoint."""
    from sqlalchemy import text
    from app.database.postgres import SessionLocal
    pg_ok = False
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        pg_ok = True
    except Exception:
        pass

    return {
        "status": "healthy" if pg_ok else "degraded",
        "postgresql": "connected" if pg_ok else "disconnected",
        "cache": "in-memory (no Redis)",
        "timeseries": "in-memory (no MongoDB)",
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info",
    )
