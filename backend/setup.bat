@echo off
REM =============================================================================
REM RouteGuard — Windows Setup Script
REM Run this once to create the database and start the backend
REM =============================================================================

echo.
echo ======================================================
echo   RouteGuard Backend Setup
echo ======================================================
echo.

REM ── Step 1: Get PostgreSQL password ──────────────────────────────────────────
set /p PGPASSWORD=Enter your PostgreSQL password (for user 'postgres'): 

REM ── Step 2: Create the database ──────────────────────────────────────────────
echo.
echo [1/4] Creating database 'routeguard'...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "CREATE DATABASE routeguard;" 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo       Database created successfully.
) ELSE (
    echo       Database already exists or creation failed - continuing...
)

REM ── Step 3: Apply the schema SQL ─────────────────────────────────────────────
echo.
echo [2/4] Applying schema (tables + seed data)...
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d routeguard -f schema.sql
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Schema application failed. Check your PostgreSQL password.
    pause
    exit /b 1
)
echo       Schema applied successfully.

REM ── Step 4: Create .env file ──────────────────────────────────────────────────
echo.
echo [3/4] Creating .env file...
(
echo APP_NAME=RouteGuard
echo ENVIRONMENT=development
echo DEBUG=True
echo SECRET_KEY=hackathon-secret-change-in-production-32chars
echo JWT_SECRET_KEY=hackathon-jwt-secret-change-in-production
echo CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8080
echo.
echo POSTGRES_HOST=localhost
echo POSTGRES_PORT=5432
echo POSTGRES_DB=routeguard
echo POSTGRES_USER=postgres
echo POSTGRES_PASSWORD=%PGPASSWORD%
echo.
echo JWT_ALGORITHM=HS256
echo JWT_EXPIRE_MINUTES=43200
echo MONITORING_INTERVAL_MINUTES=30
echo.
echo OPENWEATHERMAP_API_KEY=
echo TOMTOM_API_KEY=
echo STORMGLASS_API_KEY=
echo OPENROUTESERVICE_API_KEY=
) > .env
echo       .env file created with your password.

REM ── Step 5: Install Python dependencies ─────────────────────────────────────
echo.
echo [4/4] Installing Python dependencies...
pip install -r requirements.txt
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] pip install failed. Make sure Python is installed.
    pause
    exit /b 1
)

echo.
echo ======================================================
echo   Setup Complete!
echo ======================================================
echo.
echo   Start the backend with:
echo     cd backend
echo     uvicorn app.main:app --reload --port 8000
echo.
echo   Then open: http://localhost:8000/docs
echo.
pause
