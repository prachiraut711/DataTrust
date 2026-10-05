# DataTrust

**Data Engineering & Data Science Reliability Platform**

DataTrust is an incremental SaaS platform designed to determine whether CSV and Parquet datasets are trustworthy, well-formed, and statistically sound enough for mission-critical analytics and machine learning pipelines.

---

## Project Status

**Phase 1 — Foundation: Completed**

The architectural foundation, modular directory structures, frontend React+Vite shell, backend FastAPI health router, PostgreSQL SQLAlchemy session management, Docker Compose local setup, CI workflow, and technical architecture documentation are fully established and verified.

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

### Planned Features

- **Multi-Format Ingestion**: Drag-and-drop upload for CSV and Parquet datasets with structural validation.
- **Analytical Profiling**: Rapid column profiling, type discovery, null distributions, and quantiles powered by DuckDB.
- **Data Quality Engine**: Configurable declarative assertions (completeness, uniqueness, range boundaries, regex patterns).
- **DataTrust Reliability Score**: An objective 0–100 weighted index communicating operational readiness for machine learning.
- **Unsupervised Anomaly Detection**: Isolation Forest outlier scoring on multivariate distributions.
- **Run-over-Run Quality Analytics**: Historical tracking of dataset runs to identify quality regressions and data drift.
- **AI Explanation Engine**: Plain-language root cause diagnostics and remediation advice powered by the Gemini API.

> *Note: These functional modules are scheduled in subsequent phases. Phase 1 provides the foundational architecture, API router, database session, and UI shell.*

---

## Architecture

DataTrust is structured as a modular monolith with clear separation between application metadata and analytical execution:

```
┌────────────────────────────────────────────────────────┐
│               Frontend (React + Vite + TS)              │
│       Tailwind CSS + shadcn/ui + React Router          │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / REST
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
│  (Users, Runs, Metadata)  │ │   (Direct Parquet/CSV)    │
└───────────────────────────┘ └───────────────────────────┘
```

For an in-depth breakdown of database separation and system components, read [docs/ARCHITECTURE.md](file:///D:/prachi/Antigravity-Projects/DataTrust/docs/ARCHITECTURE.md) and [docs/DATA_FLOW.md](file:///D:/prachi/Antigravity-Projects/DataTrust/docs/DATA_FLOW.md).

---

## Technology Stack

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Tooling**: Vite
- **Styling**: Tailwind CSS with custom design tokens
- **Components**: shadcn/ui architectural pattern
- **Icons**: Lucide React
- **Routing**: React Router DOM v6
- **Charts (Planned)**: Recharts

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.12
- **Validation**: Pydantic v2 & Pydantic Settings
- **ORM / Persistence**: SQLAlchemy 2.0 with PostgreSQL driver (`psycopg2-binary`)
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
│       └── ci.yml               # Automated CI pipeline
├── backend/
│   ├── app/
│   │   ├── api/                 # API routers and endpoints
│   │   ├── core/                # Centralized Pydantic settings
│   │   ├── database/            # SQLAlchemy session and engine
│   │   ├── models/              # Database ORM models (Phase 2+)
│   │   ├── schemas/             # Pydantic validation schemas
│   │   ├── services/            # Modular domain services
│   │   │   ├── ai/              # AI explanation service
│   │   │   ├── analytics/       # Analytics calculation service
│   │   │   ├── anomaly/         # Isolation Forest anomaly service
│   │   │   ├── profiling/       # DuckDB profiling service
│   │   │   └── quality/         # Quality rule validation service
│   │   └── main.py              # FastAPI application entrypoint
│   ├── tests/                   # Pytest test suite
│   ├── .env.example             # Backend environment template
│   ├── Dockerfile               # Backend container image
│   └── requirements.txt         # Pinned Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/ui/       # UI primitive components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── layouts/             # Page layouts and navigation
│   │   ├── lib/                 # Utility functions (cn, etc.)
│   │   ├── pages/               # Route page components
│   │   ├── services/            # Backend API clients
│   │   ├── types/               # TypeScript interfaces
│   │   ├── App.tsx              # Application route definition
│   │   └── main.tsx             # React DOM entrypoint
│   ├── .env.example             # Frontend environment template
│   ├── Dockerfile               # Multi-stage production build
│   ├── nginx.conf               # Web server configuration
│   ├── package.json             # NPM package manifest
│   ├── tailwind.config.js       # Tailwind CSS configuration
│   └── vite.config.ts           # Vite configuration
├── data/
│   └── sample/                  # Safe sample datasets for testing
├── docs/
│   ├── ARCHITECTURE.md          # Technical architecture overview
│   └── DATA_FLOW.md             # End-to-end dataset lifecycle
├── .gitignore                   # Ignore rules for Python, Node, datasets
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

# Run unit and health tests
pytest -v

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

The API will be accessible at:
- Root: `http://localhost:8000/`
- Health: `http://localhost:8000/api/health`
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
- API Health Check: `http://localhost:8000/api/health`
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
