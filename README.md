<p align="center">
  <img src="assets/routeguard-banner.svg" alt="RouteGuard Banner" width="100%"/>
</p>

<h1 align="center">🛡️ RouteGuard</h1>

<p align="center">
  <strong>AI-Powered Logistics Risk Management & Dynamic Supply Chain Optimization Platform</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis"/>
  <img src="https://img.shields.io/badge/XGBoost-FF6600?style=for-the-badge&logo=xgboost&logoColor=white" alt="XGBoost"/>
  <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" alt="PyTorch"/>
  <img src="https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white" alt="Scikit-learn"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-00d4b4?style=flat-square" alt="License"/>
  <img src="https://img.shields.io/badge/Status-Active-22c55e?style=flat-square" alt="Status"/>
  <img src="https://img.shields.io/badge/Models-5%20Trained-ff6600?style=flat-square" alt="Models"/>
  <img src="https://img.shields.io/badge/Hackathon-Cephus%202.0-3b82f6?style=flat-square" alt="Hackathon"/>
</p>

---

## 🌐 Overview

**RouteGuard** is a full-stack logistics intelligence platform that uses **5 trained machine learning models** to predict shipment risks, optimize maritime routes, and coordinate multi-modal supply chain operations in real-time. Built in **24 hours** at the **Cephus 2.0 Hackathon** at Atria Institute of Technology (April 22–23, 2026).

### 🏆 Problem Statement

> **Smart Supply Chains: Resilient Logistics & Dynamic Supply Chain Optimization**
>
> Modern global supply chains manage millions of concurrent shipments across highly complex and inherently volatile transportation networks. Critical transit disruptions — ranging from sudden weather events to hidden operational bottlenecks — are chronically identified only **after** delivery timelines are already compromised.

### ⚡ Our Solution

RouteGuard predicts disruptions **hours before they happen** by combining real-time weather, traffic, port congestion, and AIS vessel telemetry data through a cascading ML pipeline — then automatically generates safer alternate routes with financial impact analysis.

### ✨ Key Highlights

- 🤖 **5-Model ML Pipeline** — XGBoost, Random Forest, Gradient Boosting, PyTorch LSTM, K-Means working in cascade
- 🗺️ **Maritime Routing Engine** — Graph-based shortest-path on 9,000+ node Marnet network with Dijkstra's algorithm
- 📡 **Real-Time Fleet Tracking** — Live Leaflet map with vessel positions, route polylines & geopolitical danger zones
- 💬 **Negotiation Hub** — Chat-based offer/counter-offer system with AI-powered financial analysis
- 📊 **Analytics Dashboard** — Model accuracy monitoring, risk distribution, financial impact summaries
- 🔀 **Smart Rerouting** — 3 ML-scored alternate routes from vessel's current position with cost/risk tradeoffs
- 🔐 **4 Role-Based Portals** — Manager, Shipper, Driver, Receiver with JWT authentication

---

## 🏗️ System Architecture

<p align="center">
  <img src="assets/architecture-diagram.png" alt="RouteGuard System Architecture" width="100%"/>
</p>

### Architecture Overview

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite | 4 role-based SPAs with Leaflet maps, Recharts visualizations |
| **Backend** | FastAPI + Python 3.10 | RESTful API with 13 router modules, WebSocket real-time updates |
| **ML Pipeline** | XGBoost, Random Forest, Gradient Boosting, PyTorch LSTM, K-Means | 5-model cascade for risk prediction, delay estimation, reroute decisions |
| **Routing Engine** | Marnet GeoPackage + NetworkX + Shapely | Maritime shortest-path with passage-aware routing (Suez, Panama, Malacca) |
| **Primary DB** | PostgreSQL | 24 relational tables — Users, Shipments, Routes, Vessels, Alerts, Quotes |
| **Prediction Logs** | MongoDB | ML prediction audit trail with full feature snapshots |
| **Real-time Cache** | Redis | Live risk score cache for instant dashboard updates |
| **External APIs** | OpenWeatherMap, Stormglass, TomTom, OSRM | Weather, marine conditions, traffic, road routing |

---

## 🔄 Application Workflow

<p align="center">
  <img src="assets/workflow-diagram.png" alt="RouteGuard Workflow" width="100%"/>
</p>

```
Shipper Creates Order → Manager Reviews & Plans → Chat Negotiation → Shipment Activated
    → Live ML Monitoring → [Low Risk] → Safe Delivery → Receiver Confirms
                         → [High Risk] → Smart Reroute (3 alternatives) → Manager Approves → Back to Monitoring
```

**Step-by-step flow:**

1. **Shipper** creates a consignment request — selects origin/destination ports, cargo type, weight, declared value
2. **Manager** reviews the request — AI generates multi-leg route plan (Land → Sea → Land) and financial analysis
3. **Negotiation** — Chat-based pricing with offer/counter-offer cards, cost breakdowns (fuel, port, crew, insurance)
4. **Shipment activated** — Driver assigned, vessel allocated, route persisted, tracking begins
5. **Live monitoring** — Background jobs run ML pipeline every cycle, WebSocket pushes risk updates to all stakeholders
6. **Risk branching** — If risk exceeds threshold, system generates 3 alternate routes with financial impact; manager approves reroute

---

## 🧠 ML Pipeline

<p align="center">
  <img src="assets/ml-pipeline-diagram.png" alt="RouteGuard ML Pipeline" width="100%"/>
</p>

RouteGuard uses **5 trained ML models** operating in a cascading pipeline. Each model's output feeds into the next, creating a comprehensive risk analysis system.

### Model Details

| # | Model | Algorithm | Task | Key Metric | Training Data |
|---|-------|-----------|------|------------|---------------|
| 1 | **Risk Scorer** | XGBoost Regressor | Predict risk score (0–100) | **R² = 96.5%**, RMSE = 2.50 | 209K records, 14 features |
| 2 | **Delay Predictor** | Random Forest Regressor | Estimate delay in hours | **R² = 74%**, MAE = 2.97h | 209K records, 15 features |
| 3 | **Reroute Classifier** | Gradient Boosting (XGBClassifier) | Binary: STAY or REROUTE | **Acc = 99.85%**, F1 = 97.94% | 209K records, 11 features |
| 4 | **Trajectory Forecaster** | PyTorch LSTM (2-layer) | Forecast next 3h of risk | RMSE = 8.96 risk points | 80K synthetic sequences |
| 5 | **Route Clusterer** | K-Means Clustering | Classify shipping corridors | Silhouette = 0.33 | 67 route profiles |

### Model Cascade Flow

```
                                    ┌──────────────────┐
                                    │  K-Means (Model 5)│
                                    │  Route Profiles   │
                                    └────────┬─────────┘
                                             │ historical_score_adjustment
                                             ▼
┌──────────┐    ┌──────────────┐    ┌──────────────────┐    ┌────────────────┐
│ Feature  │───▶│ XGBoost      │───▶│ Random Forest    │    │ Gradient Boost │
│ Engine   │    │ Risk Scorer  │    │ Delay Predictor  │    │ Reroute        │
│ (14 feat)│    │ (Model 1)    │    │ (Model 2)        │    │ (Model 3)      │
└──────────┘    └──────┬───────┘    └──────────────────┘    └────────────────┘
                       │ risk_score         ▲                       ▲
                       ├────────────────────┘                       │
                       └────────────────────────────────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ LSTM Trajectory  │
              │ Forecaster       │
              │ (Model 4)        │
              └──────────────────┘
```

### Feature Engineering Pipeline

The system constructs a **14-dimensional feature vector** in real-time for each shipment:

| Feature | Source | Scoring Method |
|---------|--------|---------------|
| `weather_score` | OpenWeatherMap API | Condition + wind + visibility + rain composite (0–100) |
| `traffic_score` | TomTom Traffic / Marine API | Speed ratio + incidents + road closures (0–100) |
| `port_score` | Port condition monitor | Queue depth + wait hours + operational status (0–100) |
| `historical_score` | PostgreSQL + K-Means | Historical delays on same corridor + cluster adjustment |
| `cargo_sensitivity` | Shipment cargo data | Cargo type sensitivity rating (0–100) |
| `distance_remaining` | Haversine calculation | Great-circle distance to destination (km) |
| `speed_ratio` | AIS telemetry | Actual speed / expected speed |
| `heading_cog_diff` | AIS telemetry | Heading vs course-over-ground deviation |
| `draft_ratio` | AIS telemetry | Current draft / max draft |
| `ETA_hours` | Route calculation | Estimated time of arrival |
| `SOG_kmh` | AIS telemetry | Speed over ground (km/h) |
| `time_of_day` | System clock | Hour of day (0–23) |
| `day_of_week` | System clock | Day (0–6) |
| `season` | System clock | Season index (1–4) |

### Dataset Sources

| Dataset | Records | Source | Usage |
|---------|---------|--------|-------|
| AIS Vessel Tracking | **1.1M+** records | Kaggle (satyamrajput7913) | Speed, heading, draft, position for risk/delay labels |
| Sea Weather Forecasts | Hourly data | Kaggle (saurabhshahane) | Weather distribution for feature scoring |
| World Port Index | Global ports | Kaggle (mexwell, rajkumarpandey02) | Port congestion simulation |
| Synthetic Trajectories | **80K** sequences | Ornstein-Uhlenbeck generation | LSTM training (6 scenarios: calm, storm, port crisis, recovery, worsening) |

---

## 🖥️ Platform Screenshots

### 🔐 Login Portal
> Role-based authentication with demo account quick-access

<p align="center">
  <img src="assets/login.jpeg" alt="RouteGuard Login Portal" width="90%"/>
</p>

---

### 🎛️ Manager — Mission Control
> Real-time fleet map with danger zones, risk-colored vessel markers, alert feed, and KPI stat strip

<p align="center">
  <img src="assets/mission control.jpeg" alt="Manager Mission Control" width="90%"/>
</p>

**Features:**
- Interactive Leaflet map with vessel positions, route polylines, and risk-colored markers
- Geopolitical danger zones (War Zones, Piracy Zones, Weather Hazards) — toggleable overlays
- KPI stat strip: Active Shipments, Critical Risk, On-Time Rate, Delayed, Revenue at Risk
- Live alerts feed with severity badges (CRITICAL / HIGH / MEDIUM)
- Quick actions: New Consignment, ML Analysis, Add Driver, Fleet Management

---

### 📋 Consignment Requests — Financial Analysis & AI Route Planning
> End-to-end order lifecycle with cost breakdown and multi-leg route planning

<p align="center">
  <img src="assets/consigment request.jpeg" alt="Consignment Requests" width="90%"/>
</p>

**Features:**
- Request list with status badges (NEW, NEGOTIATING, ACCEPTED)
- Financial Analysis: Sender Offer vs Our Cost with per-item breakdown (Fuel, Port Fees, Driver/Crew, Insurance)
- Estimated profit margin with recommended pricing
- AI Route Plan with multi-leg breakdown (Land → Sea → Land)

---

### 📊 Shipment Detail — ML Risk Analysis & Route Map
> Deep-dive shipment analytics with ML-driven risk scoring and reroute recommendations

<p align="center">
  <img src="assets/consigment anlysi1.jpeg" alt="Shipment Risk Analysis - Route Map" width="90%"/>
</p>

<p align="center">
  <img src="assets/consigment analysis2.jpeg" alt="Shipment Risk Analysis - ML Details" width="90%"/>
</p>

**Features:**
- **Risk Gauge** — Circular SVG gauge showing real-time risk score (0–100) with color coding
- **Risk Assessment** — Predicted delay, ML decision (STAY/REROUTE), confidence percentage
- **"Why Reroute?"** — Feature importance breakdown (Weather 51%, Port 21%, Traffic 14%, Historical 9%, Cargo 4%)
- **6-Hour LSTM Risk Trajectory** — Forecasted risk trend line
- **ML-Generated Alternate Routes (3)** — Each scored with risk, extra time, and net profit saved
- **Route Map** — Original, rerouted, and alternate routes visualized on map with origin/destination markers

---

### 📈 Analytics Intelligence Dashboard
> Operational risk distribution, model performance, and financial impact overview

<p align="center">
  <img src="assets/analyisi intelegent.jpeg" alt="Analytics Intelligence Dashboard" width="90%"/>
</p>

**Features:**
- KPI Cards: Active Shipments, On-Time Rate, Delayed Shipments, Losses Prevented
- **7-Day Risk Distribution** — Stacked bar chart (Critical / High / Medium / Low)
- **Current Risk Mix** — Donut chart showing active risk breakdown
- **Risk Pressure Trend** — Area chart tracking fleet-wide risk over time
- **Model Performance Snapshot** — XGBoost Risk Fit (96.5%), Gradient Boost Accuracy (99.8%), Overall Model Accuracy (96.5%)

---

### 📦 Shipper Portal — Order Tracking
> Full shipment lifecycle tracking with timeline, cargo details, and risk visibility

<p align="center">
  <img src="assets/shipper order tracker.jpeg" alt="Shipper Order Tracker" width="90%"/>
</p>

**Features:**
- Visual shipment timeline (Created → Picked Up → In Transit → At Port → Customs → Delivered)
- Origin/destination port visualization
- Shipment details: tracking number, departure, expected arrival, reroute count
- Live risk score display
- Cargo details: type, description, declared value

---

## 🗺️ Sea Routing Engine

RouteGuard includes a **custom maritime shortest-path engine** built on the [Marnet](https://github.com/eurostat/searoute) GeoPackage network.

### How It Works

| Component | Detail |
|-----------|--------|
| **Network** | Marnet GeoPackage — 9,000+ nodes, 12,000+ edges at 20km resolution |
| **Algorithm** | Dijkstra's shortest path with passage-aware edge weighting |
| **Graph Library** | NetworkX with NumPy-accelerated nearest-node lookup |
| **Geometry** | Shapely LineString/MultiLineString for route geometry |
| **Globe Wrapping** | Zero-weight edges linking lon=180° and lon=-180° nodes |

### Passage-Aware Routing

The engine supports toggling **12 maritime passages** to generate realistic alternate routes:

| Passage | Default | Effect When Disabled |
|---------|---------|---------------------|
| Suez Canal | ✅ Open | Forces Cape of Good Hope route |
| Panama Canal | ✅ Open | Forces Cape Horn / Magellan route |
| Strait of Malacca | ✅ Open | Forces Lombok or Sunda strait |
| Gibraltar | ✅ Open | Forces around Africa |
| Bab el-Mandeb | ✅ Open | Forces Cape of Good Hope |
| Bering Strait | ✅ Open | Forces Pacific routing |
| Kiel Canal | ❌ Closed | — |
| Northwest Passage | ❌ Closed | — |
| Northeast Passage | ❌ Closed | — |

### Alternate Route Generation

When ML detects elevated risk, the system generates **3 geography-aware alternate routes**:

```
Example: Mumbai → Rotterdam (Suez-relevant route)
├── Route A: "Optimal Remaining Route" — Standard path via Suez
├── Route B: "Cape of Good Hope Route" — Bypasses Suez, avoids geopolitical risk
└── Route C: "Accelerated Direct Route" — Optimized path avoiding high-traffic straits
```

Each route is ML-scored with: **risk score, predicted delay, extra distance, extra fuel cost, net profit saving**.

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+** with `pip`
- **Node.js 18+** with `npm`
- **PostgreSQL 14+**
- **MongoDB** (for prediction logs)
- **Redis** (for real-time cache)

### 1️⃣ Clone & Setup Backend

```bash
git clone https://github.com/mujju-212/route-guard.git
cd route-guard

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 2️⃣ Configure Environment

Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/routeguard
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
MONGODB_URL=mongodb://localhost:27017
REDIS_URL=redis://localhost:6379
OPENWEATHERMAP_API_KEY=your-key
```

### 3️⃣ Initialize Database

```bash
cd backend
python -c "from app.database.postgres import engine, Base; Base.metadata.create_all(bind=engine)"
python seed_users.py  # Seed demo accounts
```

### 4️⃣ Start Backend

```bash
uvicorn app.main:app --reload --port 8000
```

### 5️⃣ Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 6️⃣ Open in Browser

```
http://localhost:5173
```

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Manager | `manager@routeguard.io` | `RouteGuard2024!` |
| Driver | `driver@routeguard.io` | `RouteGuard2024!` |
| Shipper | `shipper@routeguard.io` | `RouteGuard2024!` |
| Receiver | `receiver@routeguard.io` | `RouteGuard2024!` |

---

## 📁 Project Structure

```
route-guard/
├── backend/
│   ├── app/
│   │   ├── models/              # 24 SQLAlchemy models (User, Shipment, Route, Vessel, Alert...)
│   │   ├── routers/             # 13 FastAPI routers
│   │   │   ├── auth.py          # JWT authentication & registration
│   │   │   ├── manager.py       # Manager operations, driver/fleet CRUD
│   │   │   ├── quotes.py        # Quote request & offer negotiation
│   │   │   ├── shipments.py     # Shipment lifecycle management
│   │   │   ├── monitoring.py    # Background ML monitoring cycles
│   │   │   ├── sea_routing.py   # Maritime routing endpoints
│   │   │   ├── analytics.py     # Dashboard analytics & model metrics
│   │   │   └── websocket.py     # Real-time risk push notifications
│   │   ├── services/            # Business logic layer
│   │   │   ├── ml_service.py    # 5-model inference pipeline
│   │   │   ├── feature_engine.py# Real-time feature vector construction
│   │   │   ├── route_service.py # Route generation & alternate scoring
│   │   │   ├── sea_routing_engine.py # Marnet graph-based maritime routing
│   │   │   ├── monitoring_service.py # Background risk monitoring
│   │   │   ├── weather_service.py    # OpenWeatherMap integration
│   │   │   └── traffic_service.py    # TomTom traffic integration
│   │   ├── schemas/             # Pydantic request/response models
│   │   ├── database/            # PostgreSQL, MongoDB, Redis connections
│   │   └── background/          # Scheduled jobs (monitoring, retraining)
│   ├── seed_users.py            # Database seeder
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI (Sidebar, Topbar, Map, Spinner...)
│   │   ├── pages/
│   │   │   ├── manager/         # MissionControl, ShipmentDetail, Consignments, Analytics, Fleet, Drivers
│   │   │   ├── driver/          # DriverDashboard
│   │   │   ├── shipper/         # ShipperDashboard, CreateShipment, ShipperChat
│   │   │   └── receiver/        # ReceiverDashboard
│   │   ├── config/              # API client & endpoints
│   │   ├── context/             # AuthContext (JWT + role-based access)
│   │   └── hooks/               # useAuth, custom hooks
│   └── package.json
├── ml/
│   ├── data/                    # Raw datasets (AIS, weather, ports)
│   ├── datasets/                # Train/val/test splits
│   ├── models/                  # 5 trained model files (.pkl, .pt) + metadata JSONs
│   └── scripts/                 # Training & evaluation scripts
├── marnet/                      # Maritime network GeoPackage files
├── assets/                      # Screenshots, diagrams, branding
├── docs/                        # Technical documentation
└── ppt/                         # Hackathon presentation files
```

---

## 🔧 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register new user |
| `POST` | `/auth/login` | JWT login |
| `GET` | `/auth/me` | Current user profile |

### Manager Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/manager/summary` | Dashboard KPI statistics |
| `GET` | `/manager/shipments` | All shipments with risk data |
| `POST` | `/manager/drivers` | Create driver account |
| `GET` | `/manager/fleet` | Fleet overview (vessels + trucks) |
| `POST` | `/manager/fleet/vessels` | Register new vessel |

### Shipments & ML
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/shipments/{id}` | Shipment details |
| `POST` | `/shipments/{id}/ml-analysis` | Run full ML pipeline |
| `GET` | `/shipments/{id}/routes` | Alternate route suggestions |
| `POST` | `/shipments/{id}/reroute` | Approve reroute |

### Quote Negotiation
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/quote-requests` | All quote requests |
| `POST` | `/quote-requests/{id}/offers` | Submit price offer |
| `POST` | `/quote-requests/{id}/messages` | Send negotiation message |

### Sea Routing
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/sea-routing/route` | Calculate maritime route |
| `POST` | `/sea-routing/waypoints` | Get route waypoints |

---

## 🎨 Design System

| Element | Value |
|---------|-------|
| **Display Font** | Syne |
| **Body Font** | Space Grotesk |
| **Data Font** | JetBrains Mono |
| **Dark Theme** | Navy base `#0a0e1a` + teal accents `#00d4b4` |
| **Light Theme** | Clean white surfaces + blue accents |
| **Risk Colors** | 🟢 Low → 🟡 Medium → 🟠 High → 🔴 Critical |

---

## 🛡️ Security

- **JWT Authentication** with role-based access control (Manager / Driver / Shipper / Receiver)
- **Password Hashing** via bcrypt
- **Route Guards** — Frontend and backend enforce role permissions
- **CORS** configured for frontend origin
- **WebSocket Authentication** — Token-validated real-time connections

---

## 👥 Team QUANTRIX

| Member | Role |
|--------|------|
| **Mujutaba M N** | Project Lead & Core Developer |
| **S Ashlesh Ganigera** | Developer |
| **Nandeesh BM** | Developer |
| **Syed Hamza** | Developer |

> Built in 24 hours at **Cephus 2.0 Hackathon** — Atria Institute of Technology, April 22–23, 2026

---

## 📄 License

This project is licensed under the **MIT License**.

---

<p align="center">
  Built with ❤️ by Team QUANTRIX for smarter, safer logistics
</p>
