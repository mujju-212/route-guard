# RouteGuard — Database Documentation

> **Hackathon Mode**: PostgreSQL only. MongoDB and Redis have been replaced with in-memory stubs — no extra services needed.

---

## Connection Details

| Property | Value |
|----------|-------|
| **Database Engine** | PostgreSQL 14+ |
| **Host** | `localhost` |
| **Port** | `5432` |
| **Database Name** | `routeguard` |
| **Username** | `postgres` |
| **Password** | `postgres` |
| **Connection String** | `postgresql://postgres:postgres@localhost:5432/routeguard` |

> [!IMPORTANT]
> These are **default hackathon credentials**. Change `SECRET_KEY`, `JWT_SECRET_KEY`, and `POSTGRES_PASSWORD` before any real deployment.

---

## Quick Setup

### Step 1 — Create the database

Open **pgAdmin** or **psql** and run:

```sql
CREATE DATABASE routeguard;
```

Or from terminal:
```bash
psql -U postgres -c "CREATE DATABASE routeguard;"
```

### Step 2 — Tables are auto-created on first run

When you start the FastAPI server, `Base.metadata.create_all()` automatically creates all tables:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

First-time output will show:
```
✅ PostgreSQL tables created / verified
✅ RouteGuard API ready → Swagger UI: http://localhost:8000/docs
```

### Step 3 — Optional: Apply schema manually

If you prefer to apply the schema via SQL:

```bash
psql -U postgres -d routeguard -f backend/schema.sql
```

---

## Schema Overview

```
users
 └── shipments (shipper_id, receiver_id, manager_id, driver_id)
      ├── cargo          (1:1  per shipment)
      ├── routes         (1:N  per shipment)
      ├── alerts         (1:N  per shipment)
      ├── status_updates (1:N  per shipment)
      ├── model_predictions (1:N  per shipment)
      └── manager_decisions (1:N  per shipment)
                
vessels
 └── shipments (assigned_vessel_id)

ports
 └── shipments (origin_port_id, destination_port_id)
 └── routes    (origin_port_id, destination_port_id)

delivery_confirmations → shipments
```

---

## Table Reference

### `users`

Stores all platform actors: shippers, managers, drivers, receivers.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID PK | Auto-generated |
| `full_name` | VARCHAR(100) | Required |
| `email` | VARCHAR(100) UNIQUE | Login username |
| `password_hash` | VARCHAR(255) | bcrypt hash |
| `role` | ENUM | `shipper` \| `manager` \| `driver` \| `receiver` |
| `company_name` | VARCHAR(100) | Optional |
| `phone_number` | VARCHAR(20) | Optional |
| `country` | VARCHAR(50) | Optional |
| `is_active` | BOOLEAN | Default `TRUE` |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |
| `last_login` | TIMESTAMPTZ | Updated on each login |

**Indexes**: `email` (unique lookup), `role` (filter by role)

---

### `vessels`

Ships assigned to shipments.

| Column | Type | Notes |
|--------|------|-------|
| `vessel_id` | UUID PK | |
| `vessel_name` | VARCHAR(100) | |
| `mmsi_number` | VARCHAR(20) UNIQUE | AIS identifier |
| `imo_number` | VARCHAR(20) UNIQUE | IMO identifier |
| `vessel_type` | ENUM | `container` \| `bulk` \| `tanker` \| `reefer` \| `roro` \| `general` |
| `flag_country` | VARCHAR(50) | |
| `gross_tonnage` | NUMERIC | Tons |
| `deadweight` | NUMERIC | DWT |
| `max_draft` | NUMERIC | Meters |
| `max_speed` | NUMERIC | Knots |
| `built_year` | INTEGER | |
| `owner_user_id` | UUID FK → users | |
| `current_status` | ENUM | `active` \| `maintenance` \| `docked` \| `decommissioned` |

---

### `ports`

Major sea ports. **10 demo ports are seeded automatically** via `schema.sql`.

| Column | Type | Notes |
|--------|------|-------|
| `port_id` | UUID PK | |
| `port_name` | VARCHAR(100) | |
| `port_code` | VARCHAR(10) UNIQUE | UN/LOCODE e.g. `SGSIN` |
| `country` | VARCHAR(50) | |
| `latitude` | NUMERIC(10,7) | |
| `longitude` | NUMERIC(10,7) | |
| `max_vessel_draft` | NUMERIC | Meters |
| `port_type` | ENUM | `sea` \| `river` \| `inland` \| `airport` |
| `customs_present` | BOOLEAN | Default `TRUE` |

**Pre-seeded ports**:
| Code | Port | Country |
|------|------|---------|
| CNSHA | Port of Shanghai | China |
| SGSIN | Port of Singapore | Singapore |
| NLRTM | Port of Rotterdam | Netherlands |
| USLAX | Port of Los Angeles | USA |
| DEHAM | Port of Hamburg | Germany |
| KRPUS | Port of Busan | South Korea |
| AEJEA | Jebel Ali (Dubai) | UAE |
| HKHKG | Port of Hong Kong | Hong Kong |
| BEANR | Port of Antwerp | Belgium |
| INBOM | Port of Mumbai | India |

---

### `shipments`

Core entity. Each shipment tracks a cargo movement from origin to destination.

| Column | Type | Notes |
|--------|------|-------|
| `shipment_id` | UUID PK | |
| `tracking_number` | VARCHAR(30) UNIQUE | Format: `RG-XXXXXXXXXX` |
| `shipper_id` | UUID FK → users | Creator |
| `receiver_id` | UUID FK → users | |
| `assigned_manager_id` | UUID FK → users | Nullable |
| `assigned_driver_id` | UUID FK → users | Nullable |
| `assigned_vessel_id` | UUID FK → vessels | Nullable |
| `origin_port_id` | UUID FK → ports | |
| `destination_port_id` | UUID FK → ports | |
| `departure_time` | TIMESTAMPTZ | |
| `expected_arrival` | TIMESTAMPTZ | |
| `actual_arrival` | TIMESTAMPTZ | Set on delivery |
| `current_status` | ENUM | See status flow below |
| `current_latitude` | NUMERIC(10,7) | Updated by driver |
| `current_longitude` | NUMERIC(10,7) | Updated by driver |
| `current_risk_level` | ENUM | `low` \| `medium` \| `high` \| `critical` |
| `current_risk_score` | NUMERIC(5,2) | 0-100, set by ML |
| `priority_level` | ENUM | `low` \| `medium` \| `high` \| `urgent` |
| `is_rerouted` | BOOLEAN | Default `FALSE` |
| `reroute_count` | INTEGER | Default `0` |
| `actual_delay_hours` | NUMERIC(6,2) | Set on delivery |

**Shipment Status Flow**:
```
created → picked_up → in_transit → at_port → customs → delivered
                    ↘ delayed ──────────────────────────↗
```

---

### `cargo`

One cargo record per shipment (1:1).

| Column | Type | Notes |
|--------|------|-------|
| `cargo_id` | UUID PK | |
| `shipment_id` | UUID FK → shipments | CASCADE DELETE |
| `cargo_type` | ENUM | `standard` \| `electronics` \| `refrigerated` \| `hazardous` \| `liquid_bulk` \| `oversized` \| `livestock` \| `perishable` \| `pharmaceutical` |
| `description` | TEXT | |
| `weight_kg` | NUMERIC | Required |
| `declared_value` | NUMERIC | USD |
| `cargo_sensitivity_score` | NUMERIC(5,2) | 0-100, computed by ML |
| `temperature_required` | NUMERIC | °C, for reefer cargo |
| `hazmat_class` | VARCHAR(20) | e.g. `Class 3` |

---

### `routes`

Up to 4 routes per shipment (original + 3 alternates scored by ML).

| Column | Type | Notes |
|--------|------|-------|
| `route_id` | UUID PK | |
| `shipment_id` | UUID FK → shipments | |
| `route_type` | ENUM | `original` \| `alternate_1` \| `alternate_2` \| `alternate_3` \| `active` |
| `is_active` | BOOLEAN | Only 1 active per shipment |
| `waypoints` | JSONB | Array of `{lat, lng}` objects |
| `total_distance_km` | NUMERIC | |
| `estimated_duration_hr` | NUMERIC | |
| `estimated_fuel_cost` | NUMERIC | USD |
| `risk_score_at_creation` | NUMERIC(5,2) | ML score at time of creation |
| `cluster_id` | INTEGER | K-Means cluster (0-4) |
| `cluster_name` | VARCHAR(50) | Human-readable cluster label |
| `approved_by` | UUID FK → users | Manager who approved |
| `approved_at` | TIMESTAMPTZ | |

---

### `alerts`

System-generated or manual alerts for risk events.

| Column | Type | Notes |
|--------|------|-------|
| `alert_id` | UUID PK | |
| `shipment_id` | UUID FK → shipments | |
| `alert_type` | ENUM | `risk_increase` \| `weather_warning` \| `port_congestion` \| `route_change` \| `delay_detected` \| `delivery_confirmed` \| `incident_reported` |
| `severity` | ENUM | `info` \| `warning` \| `high` \| `critical` |
| `message` | TEXT | Human-readable alert |
| `risk_score_at_alert` | NUMERIC(5,2) | Score that triggered alert |
| `triggered_by` | VARCHAR(20) | `system` or `driver` |
| `is_read` | BOOLEAN | |
| `is_resolved` | BOOLEAN | |
| `resolved_by` | UUID FK → users | Manager who resolved |

---

### `model_predictions`

Every ML inference result is stored here (one per monitoring cycle per shipment).

| Column | Type | Notes |
|--------|------|-------|
| `prediction_id` | UUID PK | |
| `shipment_id` | UUID FK → shipments | |
| `prediction_timestamp` | TIMESTAMPTZ | When prediction was made |
| `weather_score` | NUMERIC(5,2) | 0-100 feature |
| `traffic_score` | NUMERIC(5,2) | 0-100 feature |
| `port_score` | NUMERIC(5,2) | 0-100 feature |
| `historical_score` | NUMERIC(5,2) | 0-100 feature |
| `cargo_sensitivity` | NUMERIC(5,2) | 0-100 feature |
| `risk_score` | NUMERIC(5,2) | XGBoost output |
| `predicted_delay_hr` | NUMERIC | Random Forest output |
| `reroute_recommended` | BOOLEAN | GradBoost output |
| `actual_delay_hr` | NUMERIC | Filled after delivery |
| `used_for_retraining` | BOOLEAN | Marks data consumed |

---

### `manager_decisions`

Audit trail of every manager action on a shipment.

| Column | Type | Notes |
|--------|------|-------|
| `decision_id` | UUID PK | |
| `shipment_id` | UUID FK → shipments | |
| `manager_id` | UUID FK → users | |
| `decision_type` | ENUM | `approve_reroute` \| `reject_reroute` \| `manual_override` \| `escalate` \| `mark_resolved` |
| `original_route_id` | UUID FK → routes | Route before decision |
| `new_route_id` | UUID FK → routes | Route after decision |
| `risk_score_at_decision` | NUMERIC(5,2) | |
| `outcome` | ENUM | `successful` \| `unsuccessful` \| `pending` |
| `actual_delay_saved_hr` | NUMERIC | Filled after delivery |

---

### `status_updates`

Timeline log of shipment status changes and driver location updates.

| Column | Type | Notes |
|--------|------|-------|
| `update_id` | UUID PK | |
| `shipment_id` | UUID FK → shipments | |
| `updated_by` | UUID FK → users | Driver or manager |
| `previous_status` | VARCHAR(50) | |
| `new_status` | VARCHAR(50) | |
| `latitude` / `longitude` | NUMERIC | Driver GPS at time of update |
| `incident_type` | VARCHAR(50) | e.g. `breakdown`, `accident` |
| `notes` | TEXT | |

---

### `delivery_confirmations`

Proof of delivery signed off by the receiver.

| Column | Type | Notes |
|--------|------|-------|
| `confirmation_id` | UUID PK | |
| `shipment_id` | UUID FK → shipments | |
| `confirmed_by` | UUID FK → users | Receiver |
| `cargo_condition` | ENUM | `good` \| `minor_damage` \| `significant_damage` \| `total_loss` |
| `digital_signature` | TEXT | Base64 signature |
| `dispute_raised` | BOOLEAN | |

---

## Common psql Commands

```bash
# Connect to the database
psql -U postgres -d routeguard

# List all tables
\dt

# Describe a table
\d shipments

# See all users
SELECT user_id, full_name, email, role FROM users;

# See all active shipments
SELECT tracking_number, current_status, current_risk_level, current_risk_score
FROM shipments WHERE current_status NOT IN ('delivered','cancelled');

# See all unresolved alerts
SELECT a.alert_id, a.severity, a.message, s.tracking_number
FROM alerts a JOIN shipments s ON s.shipment_id = a.shipment_id
WHERE a.is_resolved = FALSE ORDER BY a.created_at DESC;

# Count predictions per shipment
SELECT shipment_id, COUNT(*) AS predictions
FROM model_predictions GROUP BY shipment_id ORDER BY predictions DESC;

# Reset everything (⚠️ destructive!)
-- Run backend/schema.sql again
```

---

## Requirements

```
Python packages for PostgreSQL:
  sqlalchemy==2.0.23
  psycopg2-binary==2.9.9
  alembic==1.12.1
  
No MongoDB driver needed (motor removed).
No Redis driver needed (redis removed from actual use).
```

---

## Simplified `requirements.txt` (hackathon mode)

Remove heavy/optional packages if you want a lighter install:

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
websockets==12.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0
pydantic==2.5.0
pydantic-settings==2.1.0
httpx==0.25.2
apscheduler==3.10.4
scikit-learn==1.3.2
xgboost==2.0.2
numpy==1.26.2
joblib==1.3.2
pandas==2.1.3
```
