-- =============================================================================
-- RouteGuard — Complete PostgreSQL Schema
-- Database: routeguard
-- =============================================================================
-- Run this file to create all tables from scratch.
-- SQLAlchemy's Base.metadata.create_all() does the same automatically
-- when the FastAPI server starts — this file is for reference / manual use.
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- DROP TABLES (for clean re-creation — comment out in production!)
-- =============================================================================
DROP TABLE IF EXISTS delivery_confirmations  CASCADE;
DROP TABLE IF EXISTS manager_decisions       CASCADE;
DROP TABLE IF EXISTS model_predictions       CASCADE;
DROP TABLE IF EXISTS status_updates          CASCADE;
DROP TABLE IF EXISTS alerts                  CASCADE;
DROP TABLE IF EXISTS routes                  CASCADE;
DROP TABLE IF EXISTS cargo                   CASCADE;
DROP TABLE IF EXISTS shipments               CASCADE;
DROP TABLE IF EXISTS vessels                 CASCADE;
DROP TABLE IF EXISTS ports                   CASCADE;
DROP TABLE IF EXISTS users                   CASCADE;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE user_role       AS ENUM ('shipper','manager','driver','receiver');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE vessel_type     AS ENUM ('container','bulk','tanker','reefer','roro','general');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE vessel_status   AS ENUM ('active','maintenance','docked','decommissioned');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE port_type       AS ENUM ('sea','river','inland','airport');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE shipment_status AS ENUM ('created','picked_up','in_transit','at_port','customs','delayed','delivered','cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_level      AS ENUM ('low','medium','high','critical');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE priority_level  AS ENUM ('low','medium','high','urgent');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE cargo_type      AS ENUM ('standard','electronics','refrigerated','hazardous','liquid_bulk','oversized','livestock','perishable','pharmaceutical');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE route_type      AS ENUM ('original','alternate_1','alternate_2','alternate_3','active');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE decision_type   AS ENUM ('approve_reroute','reject_reroute','manual_override','escalate','mark_resolved');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE decision_outcome AS ENUM ('successful','unsuccessful','pending');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_type      AS ENUM ('risk_increase','weather_warning','port_congestion','route_change','delay_detected','delivery_confirmed','incident_reported');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_severity  AS ENUM ('info','warning','high','critical');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE cargo_condition AS ENUM ('good','minor_damage','significant_damage','total_loss');
    EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- TABLE: users
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(100) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    role           user_role    NOT NULL,
    company_name   VARCHAR(100),
    phone_number   VARCHAR(20),
    country        VARCHAR(50),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_login     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);


-- =============================================================================
-- TABLE: vessels
-- =============================================================================
CREATE TABLE IF NOT EXISTS vessels (
    vessel_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    vessel_name    VARCHAR(100) NOT NULL,
    mmsi_number    VARCHAR(20)  UNIQUE,
    imo_number     VARCHAR(20)  UNIQUE,
    vessel_type    vessel_type  NOT NULL,
    flag_country   VARCHAR(50),
    gross_tonnage  NUMERIC,
    deadweight     NUMERIC,
    max_draft      NUMERIC,
    max_speed      NUMERIC,
    built_year     INTEGER,
    owner_user_id  UUID         REFERENCES users(user_id),
    current_status vessel_status NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- TABLE: ports
-- =============================================================================
CREATE TABLE IF NOT EXISTS ports (
    port_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    port_name        VARCHAR(100) NOT NULL,
    port_code        VARCHAR(10)  UNIQUE NOT NULL,
    country          VARCHAR(50)  NOT NULL,
    latitude         NUMERIC(10,7) NOT NULL,
    longitude        NUMERIC(10,7) NOT NULL,
    max_vessel_draft NUMERIC,
    port_type        port_type    NOT NULL DEFAULT 'sea',
    operating_hours  VARCHAR(50),
    customs_present  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ports_code     ON ports(port_code);
CREATE INDEX IF NOT EXISTS idx_ports_location ON ports(latitude, longitude);


-- =============================================================================
-- TABLE: shipments
-- =============================================================================
CREATE TABLE IF NOT EXISTS shipments (
    shipment_id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number      VARCHAR(30)    UNIQUE NOT NULL,

    -- Parties
    shipper_id           UUID           NOT NULL REFERENCES users(user_id),
    receiver_id          UUID           NOT NULL REFERENCES users(user_id),
    assigned_manager_id  UUID           REFERENCES users(user_id),
    assigned_driver_id   UUID           REFERENCES users(user_id),
    assigned_vessel_id   UUID           REFERENCES vessels(vessel_id),

    -- Route
    origin_port_id       UUID           NOT NULL REFERENCES ports(port_id),
    destination_port_id  UUID           NOT NULL REFERENCES ports(port_id),

    -- Timeline
    departure_time       TIMESTAMPTZ    NOT NULL,
    expected_arrival     TIMESTAMPTZ    NOT NULL,
    actual_arrival       TIMESTAMPTZ,

    -- Current state
    current_status       shipment_status NOT NULL DEFAULT 'created',
    current_latitude     NUMERIC(10,7),
    current_longitude    NUMERIC(10,7),
    current_risk_level   risk_level,
    current_risk_score   NUMERIC(5,2),

    -- Metadata
    priority_level       priority_level NOT NULL DEFAULT 'medium',
    special_instructions TEXT,
    is_rerouted          BOOLEAN        NOT NULL DEFAULT FALSE,
    reroute_count        INTEGER        NOT NULL DEFAULT 0,
    actual_delay_hours   NUMERIC(6,2),

    created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_status   ON shipments(current_status);
CREATE INDEX IF NOT EXISTS idx_shipments_shipper  ON shipments(shipper_id);
CREATE INDEX IF NOT EXISTS idx_shipments_manager  ON shipments(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_shipments_risk     ON shipments(current_risk_level);


-- =============================================================================
-- TABLE: cargo
-- =============================================================================
CREATE TABLE IF NOT EXISTS cargo (
    cargo_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id            UUID        NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    cargo_type             cargo_type  NOT NULL,
    description            TEXT        NOT NULL,
    weight_kg              NUMERIC     NOT NULL,
    volume_cbm             NUMERIC,
    quantity               INTEGER,
    unit_type              VARCHAR(50),
    declared_value         NUMERIC,
    currency               VARCHAR(10) NOT NULL DEFAULT 'USD',
    temperature_required   NUMERIC,
    humidity_required      NUMERIC,
    handling_instructions  TEXT,
    hazmat_class           VARCHAR(20),
    insurance_value        NUMERIC,
    cargo_sensitivity_score NUMERIC(5,2),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- TABLE: routes
-- =============================================================================
CREATE TABLE IF NOT EXISTS routes (
    route_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id             UUID        NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
    route_type              route_type  NOT NULL,
    is_active               BOOLEAN     NOT NULL DEFAULT FALSE,
    origin_port_id          UUID        NOT NULL REFERENCES ports(port_id),
    destination_port_id     UUID        NOT NULL REFERENCES ports(port_id),
    total_distance_km       NUMERIC,
    estimated_duration_hr   NUMERIC,
    estimated_fuel_cost     NUMERIC,
    waypoints               JSONB,
    risk_score_at_creation  NUMERIC(5,2),
    cluster_id              INTEGER,
    cluster_name            VARCHAR(50),
    clustering_updated_at   TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by             UUID        REFERENCES users(user_id),
    approved_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_routes_shipment ON routes(shipment_id);
CREATE INDEX IF NOT EXISTS idx_routes_active   ON routes(is_active);


-- =============================================================================
-- TABLE: alerts
-- =============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    alert_id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id         UUID           NOT NULL REFERENCES shipments(shipment_id),
    alert_type          alert_type     NOT NULL,
    severity            alert_severity NOT NULL,
    message             TEXT           NOT NULL,
    risk_score_at_alert NUMERIC(5,2),
    triggered_by        VARCHAR(20)    NOT NULL DEFAULT 'system',
    is_read             BOOLEAN        NOT NULL DEFAULT FALSE,
    is_resolved         BOOLEAN        NOT NULL DEFAULT FALSE,
    sent_to_roles       VARCHAR(100),
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ,
    resolved_by         UUID           REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_shipment  ON alerts(shipment_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved  ON alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_severity  ON alerts(severity);


-- =============================================================================
-- TABLE: status_updates
-- =============================================================================
CREATE TABLE IF NOT EXISTS status_updates (
    update_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id      UUID        NOT NULL REFERENCES shipments(shipment_id),
    updated_by       UUID        NOT NULL REFERENCES users(user_id),
    previous_status  VARCHAR(50),
    new_status       VARCHAR(50) NOT NULL,
    latitude         NUMERIC(10,7),
    longitude        NUMERIC(10,7),
    notes            TEXT,
    incident_type    VARCHAR(50),
    photo_url        VARCHAR(255),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_shipment ON status_updates(shipment_id);


-- =============================================================================
-- TABLE: manager_decisions
-- =============================================================================
CREATE TABLE IF NOT EXISTS manager_decisions (
    decision_id                UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id                UUID             NOT NULL REFERENCES shipments(shipment_id),
    manager_id                 UUID             NOT NULL REFERENCES users(user_id),
    decision_type              decision_type    NOT NULL,
    original_route_id          UUID             REFERENCES routes(route_id),
    new_route_id               UUID             REFERENCES routes(route_id),
    risk_score_at_decision     NUMERIC(5,2),
    predicted_delay_hr         NUMERIC,
    predicted_delay_on_original NUMERIC,
    decision_reason            TEXT,
    decision_at                TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    outcome                    decision_outcome NOT NULL DEFAULT 'pending',
    actual_delay_saved_hr      NUMERIC
);


-- =============================================================================
-- TABLE: model_predictions
-- =============================================================================
CREATE TABLE IF NOT EXISTS model_predictions (
    prediction_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id          UUID        NOT NULL REFERENCES shipments(shipment_id),
    prediction_timestamp TIMESTAMPTZ NOT NULL,

    -- Input features
    weather_score        NUMERIC(5,2),
    traffic_score        NUMERIC(5,2),
    port_score           NUMERIC(5,2),
    historical_score     NUMERIC(5,2),
    cargo_sensitivity    NUMERIC(5,2),
    distance_remaining   NUMERIC,
    time_of_day          INTEGER,
    day_of_week          INTEGER,
    season               INTEGER,

    -- Model outputs
    risk_score           NUMERIC(5,2),
    risk_level           risk_level,
    predicted_delay_hr   NUMERIC,
    reroute_recommended  BOOLEAN,
    confidence_percent   NUMERIC(5,2),

    -- Actuals (filled after delivery)
    actual_delay_hr      NUMERIC,
    prediction_error     NUMERIC,
    used_for_retraining  BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_predictions_shipment  ON model_predictions(shipment_id);
CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON model_predictions(prediction_timestamp);


-- =============================================================================
-- TABLE: delivery_confirmations
-- =============================================================================
CREATE TABLE IF NOT EXISTS delivery_confirmations (
    confirmation_id   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id       UUID           NOT NULL REFERENCES shipments(shipment_id),
    confirmed_by      UUID           NOT NULL REFERENCES users(user_id),
    confirmed_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    cargo_condition   cargo_condition NOT NULL,
    damage_description TEXT,
    photo_url         VARCHAR(255),
    digital_signature TEXT,
    dispute_raised    BOOLEAN        NOT NULL DEFAULT FALSE,
    dispute_reason    TEXT
);


-- =============================================================================
-- SEED DATA — Demo ports (10 major ports for hackathon demo)
-- =============================================================================
INSERT INTO ports (port_name, port_code, country, latitude, longitude, port_type, max_vessel_draft, customs_present)
VALUES
    ('Port of Shanghai',        'CNSHA', 'China',        31.3713,  121.5088, 'sea', 17.0, TRUE),
    ('Port of Singapore',       'SGSIN', 'Singapore',    1.2644,   103.8222, 'sea', 16.0, TRUE),
    ('Port of Rotterdam',       'NLRTM', 'Netherlands',  51.9225,    4.4792, 'sea', 23.0, TRUE),
    ('Port of Los Angeles',     'USLAX', 'USA',          33.7297, -118.2621, 'sea', 15.5, TRUE),
    ('Port of Hamburg',         'DEHAM', 'Germany',      53.5330,    9.9956, 'sea', 15.1, TRUE),
    ('Port of Busan',           'KRPUS', 'South Korea',  35.0960,  129.0403, 'sea', 16.0, TRUE),
    ('Port of Dubai (Jebel Ali)','AEJEA','UAE',          25.0112,   55.0553, 'sea', 17.0, TRUE),
    ('Port of Hong Kong',       'HKHKG', 'Hong Kong',   22.3069,  114.1831, 'sea', 15.5, TRUE),
    ('Port of Antwerp',         'BEANR', 'Belgium',      51.2993,    4.3722, 'sea', 16.0, TRUE),
    ('Port of Mumbai',          'INBOM', 'India',        18.9388,   72.8353, 'sea', 14.0, TRUE)
ON CONFLICT (port_code) DO NOTHING;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
