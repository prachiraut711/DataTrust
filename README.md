# DataTrust

**Data Engineering & Data Science Reliability Platform**

DataTrust is an incremental SaaS platform designed to determine whether CSV and Parquet datasets are trustworthy, well-formed, and statistically sound enough for mission-critical analytics and machine learning pipelines.

---

## Project Status

**Phase 2 — Database Models & Authentication: Completed**

The architectural foundation, PostgreSQL metadata models (Users and Workspaces), Alembic migrations, bcrypt password security, JWT session authentication, protected frontend dashboard routing, and comprehensive test suite are fully operational and verified.

- **PostgreSQL Metadata Foundation**: Implemented via SQLAlchemy 2.0 with UUID keys and Alembic versioning.
- **User Authentication**: Implemented via `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/auth/me`.
- **Workspace Creation**: Implemented with automatic default workspace provisioning for every registered user.
- **Frontend Session Management**: Implemented with React `AuthContext`, session hydration, and `ProtectedRoute` guard.

See [PROJECT_STATUS.md](file:///D:/prachi/Antigravity-Projects/DataTrust/PROJECT_STATUS.md) for current progress and upcoming phase milestones.

---

## Problem Statement

Modern data organizations frequently ingest disparate CSV and Parquet files into analytical warehouses and machine learning pipelines without sufficient pre-flight validation. Silently corrupted values, schema drift, unexpected null spikes, invalid ranges, and multi-feature distribution shifts pollute downstream reports and degrade model performance before data engineers notice.

Existing solutions tend to fall into two extremes:
1. **Under-powered basic scripts**: Simple scripts that only check basic column nulls without statistical anomaly detection or composite reliability metrics.
2. **Heavyweight enterprise frameworks**: Over-engineered systems (e.g. Spark, Kafka, Celery, Airflow, complex distributed vector databases) that introduce immense operational complexity and maintenance overhead for medium-scale SaaS workloads.

---

## Planned Solution

DataTrust delivers a clean, high-performance, developer-friendly reliability engine that evaluates tabular datasets rapidly using an embedded in-process OLAP engine (**DuckDB**) alongside relational metadata persistence (**PostgreSQL**).

### Features & Implementation Roadmap

- **User Authentication & Workspaces** *(Completed - Phase 2)*: Email/password authentication, bcrypt hashing, stateless JWTs, and automatic workspace creation.
- **Multi-Format Ingestion** *(Planned - Phase 3)*: Drag-and-drop upload for CSV and Parquet datasets with structural validation.
- **Analytical Profiling** *(Planned - Phase 4)*: Rapid column profiling, type discovery, null distributions, and quantiles powered by DuckDB.
- **Data Quality Engine** *(Planned - Phase 5)*: Configurable declarative assertions (completeness, uniqueness, range boundaries, regex patterns).
- **DataTrust Reliability Score** *(Planned - Phase 6)*: An objective 0–100 weighted index communicating operational readiness for machine learning.
- **Unsupervised Anomaly Detection** *(Planned - Phase 7)*: Isolation Forest outlier scoring on multivariate distributions.
- **Run-over-Run Quality Analytics** *(Planned - Phase 8)*: Historical tracking of dataset runs to identify quality regressions and data drift.
- **AI Explanation Engine** *(Planned - Phase 9)*: Plain-language root cause diagnostics and remediation advice powered by the Gemini API.

---

## Architecture

DataTrust is structured as a modular monolith with clear separation between application metadata and analytical execution:

```
┌────────────────────────────────────────────────────────┐
│               Frontend (React + Vite + TS)              │
│       Tailwind CSS + shadcn/ui + React Router          │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / REST (Bearer JWT)
                            ▼
┌────────────────────────────────────────────────────────┐
│                Backend (FastAPI + Python)              │
│         Modular Router Structure & Core Settings       │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│     Metadata Database     │ │   Analytical Engine       │
│        PostgreSQL         │ │     Embedded DuckDB       │
│  (Users, Workspaces, DDL) │ │   (Direct Parquet/CSV)    │
└───────────────────────────┘ └───────────────────────────┘
```

For an in-depth breakdown of database separation, schema models, and data lifecycles, read [docs/ARCHITECTURE.md](file:///D:/prachi/Antigravity-Projects/DataTrust/docs/ARCHITECTURE.md) and [docs/DATA_FLOW.md](file:///D:/prachi/Antigravity-Projects/DataTrust/docs/DATA_FLOW.md).

---

## Technology Stack

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Tooling**: Vite
- **Styling**: Tailwind CSS with custom design tokens
- **Components**: shadcn/ui architectural pattern
- **Icons**: Lucide React
- **Routing**: React Router DOM v6 with `ProtectedRoute`
- **State**: React Context API (`AuthContext`)
- **Charts (Planned)**: Recharts

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.12
- **Validation**: Pydantic v2 & Pydantic Settings
- **ORM / Persistence**: SQLAlchemy 2.0 with PostgreSQL drivers (`psycopg` & `psycopg2-binary`)
- **Database Migrations**: Alembic
- **Security & Authentication**: `bcrypt` (salted password hashing), `PyJWT` (stateless tokens)
- **Testing**: Pytest & HTTPX TestClient

### Data & Machine Learning (Planned Phases)
- **Analytical Engine**: DuckDB (in-process columnar execution)
- **Data Manipulation**: Pandas, NumPy
- **Machine Learning**: Scikit-learn (`IsolationForest` for anomaly detection)
- **AI Explanation**: Google Gemini API

### Infrastructure & DevOps
- **Containerization**: Docker & Docker Compose
- **Continuous Integration**: GitHub Actions
- **Planned Production Deployment**: Vercel (Frontend) + Render/Railway (Backend) + Neon (Serverless PostgreSQL)

---

## Project Structure

```
DataTrust/
├── .github/
│   └── workflows/
│       └── ci.yml               # Automated CI pipeline (Backend tests + Frontend build)
├── backend/
│   ├── alembic/                 # Alembic migration management
│   │   ├── versions/            # Migration revisions (001_create_users_and_workspaces)
│   │   └── env.py               # Dynamic database URL configuration
│   ├── app/
│   │   ├── api/                 # API routers and endpoints
│   │   │   ├── auth.py          # Register, Login, Me endpoints
│   │   │   ├── deps.py          # FastAPI auth and db dependencies
│   │   │   └── router.py        # Central API router
│   │   ├── core/                # Centralized settings and security
│   │   │   ├── config.py        # Pydantic BaseSettings
│   │   │   └── security.py      # Bcrypt hashing & JWT utilities
│   │   ├── database/            # SQLAlchemy session and engine
│   │   ├── models/              # Database ORM models
│   │   │   ├── user.py          # User model (UUID, email, password_hash)
│   │   │   └── workspace.py     # Workspace model (UUID, name, owner_id)
│   │   ├── schemas/             # Pydantic validation schemas
│   │   │   ├── auth.py          # UserRegister, UserLogin, TokenResponse
│   │   │   ├── health.py        # HealthCheckResponse
│   │   │   ├── user.py          # UserResponse
│   │   │   └── workspace.py     # WorkspaceResponse
│   │   ├── services/            # Modular domain services (profiling, quality, etc.)
│   │   └── main.py              # FastAPI application entrypoint
│   ├── tests/                   # Pytest test suite (10 unit/integration tests)
│   │   ├── conftest.py          # In-memory SQLite fixtures & client overrides
│   │   ├── test_auth.py         # Authentication test cases
│   │   └── test_health.py       # Health and root endpoint tests
│   ├── .env.example             # Backend environment template
│   ├── Dockerfile               # Backend container image
│   └── requirements.txt         # Pinned Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/ui/       # UI primitive components (Button, Card, ProtectedRoute)
│   │   ├── context/             # AuthContext provider and useAuth hook
│   │   ├── layouts/             # Navbar and RootLayout
│   │   ├── pages/               # HomePage, LoginPage, RegisterPage, DashboardPage
│   │   ├── services/            # API client (register, login, me, health)
│   │   ├── types/               # TypeScript interfaces (User, Workspace, AuthResponse)
│   │   ├── App.tsx              # Application route definitions
│   │   └── main.tsx             # React DOM entrypoint
│   ├── .env.example             # Frontend environment template
│   ├── Dockerfile               # Multi-stage production build
│   ├── package.json             # NPM package manifest
│   ├── tailwind.config.js       # Tailwind CSS configuration
│   └── vite.config.ts           # Vite configuration
├── data/
│   └── sample/                  # Safe sample datasets for testing
├── docs/
│   ├── ARCHITECTURE.md          # Technical architecture overview & schema models
│   └── DATA_FLOW.md             # End-to-end dataset lifecycle documentation
├── .gitignore                   # Ignore rules for Python, Node, datasets, and secrets
├── docker-compose.yml           # Local multi-container development environment
├── PROJECT_STATUS.md            # Roadmap and phase milestone tracker
└── README.md                    # Project documentation
```

---

## Local Development Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.11+)
- PostgreSQL (or run via Docker)

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate a virtual environment
python -m venv .venv
# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env

# Run database migrations
alembic upgrade head

# Run tests
pytest -v

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

The API will be accessible at:
- Root: `http://localhost:8000/`
- Health: `http://localhost:8000/api/health`
- Auth Endpoints: `http://localhost:8000/api/auth/register`, `http://localhost:8000/api/auth/login`, `http://localhost:8000/api/auth/me`
- Swagger Docs: `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Start development server
npm run dev
```

The web application will be accessible at:
- Web UI: `http://localhost:5173`
- Unauthenticated access to `/dashboard` redirects to `/login`.

---

## Docker Setup

To run the entire stack (PostgreSQL, Backend API, and Frontend) locally via Docker Compose:

```bash
# From the project root
docker compose up --build
```

Services will be exposed at:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

---

## Planned Deployment

- **Frontend**: Automated deployments on [Vercel](https://vercel.com) connecting to the GitHub repository.
- **Backend**: Containerized deployment on [Render](https://render.com) or [Railway](https://railway.app).
- **Database**: Serverless PostgreSQL instance hosted on [Neon](https://neon.tech).

---

## Future Improvements

- Automated schema drift alerting with webhook integrations (Slack, email).
- Support for streaming data pipelines or delta table directories.
- Custom SQL assertion editor with query execution sandboxing.
- Batch export of dataset audit certificates in PDF or JSON format.
