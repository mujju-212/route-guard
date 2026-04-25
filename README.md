<p align="center">
  <img src="assets/routeguard-banner.svg" alt="RouteGuard Banner" width="100%"/>
</p>

<h1 align="center">🛡️ RouteGuard</h1>

<p align="center">
  <strong>AI-Powered Logistics Risk Management & Supply Chain Intelligence Platform</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white" alt="Scikit-learn"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-00d4b4?style=flat-square" alt="License"/>
  <img src="https://img.shields.io/badge/Status-Active-22c55e?style=flat-square" alt="Status"/>
  <img src="https://img.shields.io/badge/Version-1.0.0-3b82f6?style=flat-square" alt="Version"/>
</p>

---

## 🌐 Overview

**RouteGuard** is a full-stack logistics intelligence platform that uses **machine learning** to predict shipment risks, optimize routes, and coordinate multi-modal supply chain operations in real-time. Built for logistics managers, drivers, shippers, and receivers — it provides end-to-end visibility from consignment request to final delivery.

### ✨ Key Highlights

- 🤖 **ML-Powered Risk Scoring** — 6 trained models analyze weather, traffic, port congestion & historical data
- 🗺️ **Real-Time Fleet Tracking** — Live map with vessel/truck positions, route overlays & risk heat zones
- 💬 **Negotiation Hub** — Chat-based offer/counter-offer system between managers and shippers
- 📊 **Analytics Dashboard** — Model accuracy, route performance, financial impact analysis
- 🚨 **Smart Alert System** — Severity-based alerts with AI-suggested resolution actions
- 🚢 **Fleet & Driver Management** — Vessel registry, captain assignment, and driver lifecycle

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌─────────────────┐   │
│  │ Manager  │ │  Driver   │ │ Shipper  │ │    Receiver     │   │
│  │Dashboard │ │ Dashboard │ │   Chat   │ │   Dashboard     │   │
│  └────┬─────┘ └─────┬─────┘ └────┬─────┘ └───────┬─────────┘   │
│       └──────────────┴───────────┴───────────────┘              │
│                    Axios · Leaflet · Lucide                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API
┌────────────────────────────┴────────────────────────────────────┐
│                     BACKEND (FastAPI + Python)                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  Auth &    │ │  Manager   │ │  Shipment  │ │   Quote    │   │
│  │  Roles     │ │  Routes    │ │  Tracking  │ │ Requests   │   │
│  └──────┬─────┘ └──────┬─────┘ └──────┬─────┘ └──────┬─────┘   │
│         └──────────────┴──────────────┴──────────────┘          │
│                    SQLAlchemy · JWT · Pydantic                   │
└────────────┬───────────────────────────────┬────────────────────┘
             │                               │
┌────────────┴────────────┐   ┌──────────────┴──────────────────┐
│     PostgreSQL          │   │       ML Pipeline               │
│  ┌──────────────────┐   │   │  ┌──────────────────────────┐   │
│  │ Users · Shipments│   │   │  │ Risk Prediction (6 models)│  │
│  │ Vessels · Alerts │   │   │  │ Route Optimization        │  │
│  │ Quotes · Offers  │   │   │  │ Alternate Route Scoring   │  │
│  └──────────────────┘   │   │  └──────────────────────────┘   │
└─────────────────────────┘   └─────────────────────────────────┘
```

---

## 🖥️ Platform Views

### 🎛️ Manager — Mission Control
> Real-time fleet map, risk alerts, shipment stats, and quick actions

| Feature | Description |
|---------|-------------|
| **Live Fleet Map** | Interactive Leaflet map with vessel positions, route polylines, and risk-colored markers |
| **Stat Strip** | Active shipments, critical risks, on-time %, revenue at risk |
| **Alert Feed** | Severity-tagged alerts with timestamps |
| **Quick Actions** | One-click access to consignments, ML analysis, drivers, fleet |

### 📦 Manager — Consignment Requests
> End-to-end order lifecycle: receive → plan → negotiate → confirm

- AI Route Planning with multi-leg breakdown (Land → Sea → Land)
- Financial analysis with cost breakdown, margin calculation, and recommendations
- Chat-based negotiation with offer/counter-offer bubbles
- Driver coordination and emergency alert channels

### 👤 Manager — Driver Management
> Full driver lifecycle with status tracking

- Create driver accounts with role assignment
- Toggle active/inactive status
- Filter by Available / En Route / Inactive
- View active shipment assignments per driver

### 🚢 Manager — Fleet Management
> Vessel registry and captain assignment

- Add vessels with full specs (IMO, MMSI, tonnage, speed)
- Assign available captains/drivers to vessels
- Cycle vessel status (Docked → Active → Maintenance)
- Track in-transit status and current shipment linkage

### 🚛 Driver Dashboard
> Assignment tracking, incident reporting, and route visualization

### 📬 Shipper Portal
> Create shipments, track orders, and negotiate with managers

### 📥 Receiver Dashboard
> Track incoming deliveries and confirm receipt

---

## 🧠 ML Pipeline

RouteGuard uses **6 trained ML models** for comprehensive risk analysis:

| Model | Purpose | Algorithm |
|-------|---------|-----------|
| Model 1 | Overall Risk Score Prediction | Gradient Boosted Trees |
| Model 2 | Delay Probability Estimation | Random Forest |
| Model 3 | Route Safety Classification | XGBoost Classifier |
| Model 4 | Port Congestion Forecasting | Linear Regression + Features |
| Model 5 | Weather Impact Scoring | Decision Tree Ensemble |
| Model 6 | Financial Risk Assessment | Ridge Regression |

### Feature Inputs
- 🌧️ Weather severity index
- 🚦 Traffic congestion level
- ⚓ Port congestion score
- 📊 Historical route risk data
- 📦 Cargo sensitivity rating

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+** with `pip`
- **Node.js 18+** with `npm`
- **PostgreSQL 14+**

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
```

### 3️⃣ Initialize Database

```bash
cd backend
python -c "from app.database import engine, Base; Base.metadata.create_all(bind=engine)"
python seed.py  # Seed demo accounts
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
│   │   ├── models/          # SQLAlchemy models (User, Vessel, Shipment, Alert...)
│   │   ├── routers/         # FastAPI route handlers
│   │   │   ├── auth.py      # Authentication & registration
│   │   │   ├── manager.py   # Manager operations, driver/fleet CRUD
│   │   │   ├── quotes.py    # Quote request & offer negotiation
│   │   │   ├── shipments.py # Shipment lifecycle
│   │   │   └── alerts.py    # Risk alert management
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── services/        # Business logic layer
│   │   └── utils/           # JWT, hashing, helpers
│   ├── seed.py              # Database seeder
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI (Sidebar, Topbar, Map, Spinner...)
│   │   ├── pages/
│   │   │   ├── manager/     # MissionControl, Alerts, Consignments, Drivers, Fleet
│   │   │   ├── driver/      # DriverDashboard
│   │   │   ├── shipper/     # ShipperChat, ShipperDashboard
│   │   │   └── receiver/    # ReceiverDashboard
│   │   ├── config/          # API client & endpoints
│   │   ├── context/         # AuthContext (JWT + role-based access)
│   │   └── hooks/           # useAuth, custom hooks
│   └── package.json
├── ml/
│   ├── data/                # Training datasets
│   ├── models/              # Trained .pkl model files
│   └── notebooks/           # Jupyter training notebooks
└── assets/                  # README images & branding
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
| `GET` | `/manager/summary` | Dashboard statistics |
| `GET` | `/manager/shipments` | All shipments with risk data |
| `GET` | `/manager/drivers/all` | All drivers with status |
| `POST` | `/manager/drivers` | Create driver account |
| `PATCH` | `/manager/drivers/{id}/toggle-active` | Activate/deactivate driver |
| `GET` | `/manager/fleet` | Fleet overview (vessels + trucks) |
| `POST` | `/manager/fleet/vessels` | Register new vessel |
| `PATCH` | `/manager/fleet/vessels/{id}/assign-driver` | Assign captain |
| `PATCH` | `/manager/fleet/vessels/{id}/status` | Update vessel status |

### Quote Negotiation
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/quote-requests` | All quote requests |
| `POST` | `/quote-requests/{id}/offers` | Submit offer |
| `POST` | `/quote-requests/{id}/messages` | Send negotiation message |

### Risk & ML
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/shipments/{id}/risk` | ML risk score |
| `GET` | `/shipments/{id}/prediction` | Full ML prediction |
| `GET` | `/shipments/{id}/routes` | Alternate route suggestions |

---

## 🎨 Design System

RouteGuard uses a custom design system built for logistics operations:

- **Typography** — Syne (display), Space Grotesk (body), JetBrains Mono (data)
- **Dark Theme** — Navy base (`#0a0e1a`) with teal accents (`#00d4b4`)
- **Light Theme** — Clean white surfaces with blue accents
- **Risk Colors** — Green → Yellow → Orange → Red severity scale
- **Components** — Cards, badges, stat strips, filter pills, modals

---

## 🛡️ Security

- **JWT Authentication** with role-based access control
- **Password Hashing** via bcrypt
- **Route Guards** — Manager, Driver, Shipper, Receiver roles
- **CORS** configured for frontend origin

---

## 📄 License

This project is licensed under the **MIT License**.

---

<p align="center">
  Built with ❤️ for smarter logistics
</p>
