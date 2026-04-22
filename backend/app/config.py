"""
config.py — RouteGuard Hackathon Configuration
------------------------------------------------
PostgreSQL-only mode: MongoDB and Redis settings are removed.
All values have safe defaults so the app starts without a .env file
(you should still set SECRET_KEY and JWT_SECRET_KEY in production).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Application ───────────────────────────────────────────────────────────
    APP_NAME: str = "RouteGuard"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "hackathon-secret-change-in-production-32chars"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"

    # ── PostgreSQL ────────────────────────────────────────────────────────────
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "routeguard"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "mk0492"

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "hackathon-jwt-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 43200  # 30 days

    # ── External APIs (all optional — fallback to simulation if empty) ────────
    OPENWEATHERMAP_API_KEY: str = ""
    TOMTOM_API_KEY: str = ""
    STORMGLASS_API_KEY: str = ""
    OPENROUTESERVICE_API_KEY: str = ""

    # ── Monitoring ────────────────────────────────────────────────────────────
    MONITORING_INTERVAL_MINUTES: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Computed properties ───────────────────────────────────────────────────
    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
