# DataTrust — Data Reliability & Quality Verification Platform

[![CI Pipeline](https://github.com/your-username/datatrust/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/datatrust/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-username/datatrust)
[![Python](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![DuckDB](https://img.shields.io/badge/DuckDB-1.1.3-FFF000.svg)](https://duckdb.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

DataTrust is an end-to-end, production-ready data reliability and quality verification SaaS platform. It evaluates CSV and Parquet datasets before they enter analytical pipelines or train machine learning models, calculating an explainable **0–100 DataTrust Reliability Score**, executing **unsupervised statistical anomaly detection**, and synthesizing actionable remediation steps with **Google Gemini AI**—with strict guarantees that zero raw dataset rows ever leave your environment.

---

## Table of Contents

- [The Problem](#the-problem)
- [Key Features](#key-features)
- [The DataTrust Reliability Score Formula](#the-datatrust-reliability-score-formula)
- [System Architecture](#system-architecture)
  - [High-Level Topology](#high-level-topology)
  - [Dual Database Strategy: PostgreSQL vs. DuckDB](#dual-database-strategy-postgresql-vs-duckdb)
  - [Data Privacy Guarantees](#data-privacy-guarantees)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Local Development Setup](#local-development-setup)
  - [Prerequisites](#prerequisites)
  - [Option A: Quickstart with Docker Compose (Recommended)](#option-a-quickstart-with-docker-compose-recommended)
  - [Option B: Manual Local Setup](#option-b-manual-local-setup)
- [Environment Configuration](#environment-configuration)
- [REST API Overview](#rest-api-overview)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Deployment Readiness & Target Topology](#deployment-readiness--target-topology)
- [License](#license)

---

## The Problem

Modern data and ML pipelines suffer from silent failures:

1. **Garbage In, Garbage Out**: Unnoticed null spikes, out-of-range values, schema drift, and duplicate entries propagate into predictive models and executive dashboards, causing silent degradation.
2. **Infrastructure Overkill**: Existing data testing frameworks (e.g., Great Expectations, Monte Carlo) often require complex distributed infrastructure (Spark, Airflow, Celery, Trino) that is expensive to run and painful to maintain for small-to-medium datasets.
3. **Black-Box Metrics**: Most tools produce pass/fail logs without an aggregate, objective measure of tabular reliability or historical drift tracking.
4. **Data Privacy Hazards**: Using cloud LLMs to diagnose data quality often leaks sensitive tabular records or PII to external third-party models.

**DataTrust solves this** by combining in-process columnar analytics (DuckDB), declarative quality rules, unsupervised machine learning (scikit-learn Isolation Forest), and privacy-preserving generative AI (Google Gemini AI) into a unified, lightweight, sub-15ms responsive SaaS platform.

---

## Key Features

- **High-Performance Ingestion & In-Process OLAP**:
  - Direct chunked streaming upload of `.csv` and `.parquet` files with UUID-based path traversal protection.
  - Zero PostgreSQL database bloat: DuckDB reads tabular files directly from disk without loading raw contents into SQL tables.
- **Deep Statistical Profiling**:
  - Automatic computation of quantiles (25th, median, 75th), min, max, mean, standard deviation, and histogram bins for numeric columns.
  - Frequency distribution, top categories, and cardinality tracking for categorical columns.
  - Chronological boundary inspection and future timestamp checks for date/time columns.
- **Declarative Quality Rules Engine**:
  - Configure, enable, edit, and evaluate declarative quality checks per column (`not_null`, `unique`, `numeric_range`, `allowed_values`, `email_format`, `no_future_dates`).
  - Vectorized validation via DuckDB reporting passed/failed statuses and violating row counts.
- **Unsupervised Statistical Anomaly Detection**:
  - `scikit-learn` `IsolationForest` detecting subtle multi-dimensional outliers across numerical columns.
  - User-adjustable contamination factor (1% to 10%).
  - Identifies top anomalous sample values without manual threshold configuration.
- **Explainable 0–100 DataTrust Reliability Score**:
  - Deterministic 3-pillar formula weighting quality compliance, cell completeness, and anomaly health.
  - Categorization into 4 quality tiers: **Excellent** ($\ge 90$), **Good** ($75–89$), **Fair** ($60–74$), and **Poor** ($< 60$).
- **Historical Quality Tracking & Trends**:
  - Save lightweight summary snapshots (`QualityRun`) capturing run-over-run quality metrics.
  - Interactive Recharts time-series line chart tracking score trajectory over time.
  - Automated delta calculation (improving, declining, stable) between audits.
- **Google Gemini AI Explanation Engine**:
  - Translates complex structural metrics, rule violations, and outlier patterns into an executive diagnosis.
  - Generates ranked key issues by severity (`high`, `medium`, `low`) and concrete remediation roadmaps.
  - **Strict Privacy**: Zero raw tabular data is sent to the LLM—only aggregated schema statistics and failure percentages.
- **Executive SaaS Overview Dashboard**:
  - Sub-15ms workspace analytics aggregating total datasets, average reliability, low-health triage queue, and 7-day velocity.
  - Recharts horizontal comparative bar chart and tier distribution donut chart.
  - Actionable "Needs Attention" triage feed prioritizing datasets with scores $< 75$.

---

## The DataTrust Reliability Score Formula

The **DataTrust Reliability Score** is an explainable, deterministic composite metric bounded between $0.0$ and $100.0$:

$$\text{Reliability Score} = 0.50 \times \text{Quality} + 0.25 \times \text{Completeness} + 0.25 \times \text{Anomaly Health}$$

### Component Breakdown

| Pillar | Weight | Definition & Computation |
| :--- | :---: | :--- |
| **Quality** | **50%** | Percentage of passing user-defined quality rules: $\frac{\text{passed checks}}{\text{applicable checks}} \times 100$. Defaults to $100.0\%$ when no rules are configured. |
| **Completeness** | **25%** | Overall dataset cell density: $\max(0, \min(100, 100 - \text{missing percentage}))$. |
| **Anomaly Health** | **25%** | Penalty for statistical outliers detected by Isolation Forest: $\max(0, 100 - \text{anomaly percentage} \times 10)$. |

### Quality Tiers

- **Excellent** ($90.0 - 100.0$): Fully trusted for production analytics and machine learning pipelines.
- **Good** ($75.0 - 89.9$): Minor non-critical anomalies or completeness gaps; usable with caution.
- **Fair** ($60.0 - 74.9$): Noticeable rule violations or elevated outlier rates; requires manual inspection.
- **Poor** ($0.0 - 59.9$): Critical data degradation, failing primary assertions; pipeline blocking recommended.

---

## System Architecture

### High-Level Topology

```
┌────────────────────────────────────────────────────────┐
│               Frontend (React 18 + Vite)               │
│        Tailwind CSS + shadcn/ui + Recharts Charts      │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / REST API (Bearer JWT)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Backend (FastAPI + Python 3.12)          │
│            Modular Routers & Pydantic v2 Schemas       │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
               ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│     Metadata Database     │ │   Analytical Data Engine  │
│        PostgreSQL         │ │      Embedded DuckDB      │
│  (Users, Workspaces, DDL, │ │  (In-Process Columnar     │
│   Rules, Run Snapshots)   │ │   Aggregation over Disk)  │
└───────────────────────────┘ └─────────────┬─────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
│   Statistical Profiler    │ │  Isolation Forest Anomaly │ │     Gemini AI Engine      │
│     (NumPy / Pandas)      │ │   (scikit-learn Unsupervised)│ │   (google-genai SDK)      │
│   Quantiles, Histograms   │ │   Feature Vector Outliers │ │   Aggregated Metrics Only │
└───────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘
```

### Dual Database Strategy: PostgreSQL vs. DuckDB

DataTrust utilizes a purpose-built dual storage architecture that balances transactional integrity with analytical performance:

1. **PostgreSQL (Operational Metadata)**:
   - Manages user accounts, salted password hashes, and JWT auth sessions.
   - Enforces multi-tenant workspace isolation and dataset ownership via foreign key cascades.
   - Stores declarative data quality rule definitions and historical `QualityRun` snapshot summaries.
   - Guaranteed sub-15ms dashboard aggregation queries via targeted indices on `workspace_id`, `dataset_id`, and `created_at`.
2. **DuckDB (In-Process Analytical OLAP)**:
   - Executes zero-copy scans directly over raw `.csv` and `.parquet` files stored on disk.
   - Computes column-level aggregations (null rates, distinct cardinalities, histograms) without copying row data into PostgreSQL.
   - Operates embedded in the FastAPI process with zero networking latency, zero external daemons, and zero cluster overhead.

### Data Privacy Guarantees

DataTrust enforces strict architectural boundaries to guarantee that sensitive tabular data remains secure:

- **Zero Raw Data Sent to External LLMs**: When generating AI Quality Explanations via Google Gemini, the platform never transmits raw CSV or Parquet rows, column cell contents, or user credentials.
- **Metric-Only Synthesis**: The AI prompt receives strictly sanitized structural telemetry: row/column counts, overall completeness percentage, names of failed validation rules, outlier percentages, and calculated reliability scores.
- **Air-Gapped Local Processing**: DuckDB profiling and Isolation Forest anomaly detection execute entirely in-process on the local host or container filesystem.
- **Path Traversal Protection**: Uploaded files receive unpredictable UUID-based filenames (`<uuid4>.csv` / `<uuid4>.parquet`) and are validated against root directory escapes using strict path resolution.

---

## Tech Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite | Modern, typed single-page application |
| **UI Styling** | Tailwind CSS, shadcn/ui, Lucide Icons | Clean, accessible design system and components |
| **Visualizations** | Recharts | Horizontal comparison bars, tier donuts, trend lines |
| **Backend API** | FastAPI (Python 3.12), Pydantic v2 | High-performance asynchronous REST API |
| **Security & Auth** | bcrypt, PyJWT | Salted password hashing, stateless JWT Bearer tokens |
| **Relational DB** | PostgreSQL 16, SQLAlchemy 2.0, Alembic | Persistent metadata storage & versioned migrations |
| **Analytical OLAP** | DuckDB (Embedded) | In-process vectorized file scanning and aggregation |
| **Data Science / ML**| scikit-learn, NumPy, Pandas | Unsupervised Isolation Forest statistical anomaly detection |
| **Generative AI** | Google GenAI SDK (Gemini AI) | Explainable plain-language quality diagnostic synthesis |
| **DevOps / Containers**| Docker, Docker Compose, Nginx | Multi-container reproducible development and deployment |
| **CI / CD** | GitHub Actions | Automated linting, test suites, and build verification |

---

## Repository Structure

```text
DataTrust/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI workflow (pytest + build)
├── backend/
│   ├── alembic/                 # Database migrations (001 through 005)
│   ├── app/
│   │   ├── api/routes/          # Modular FastAPI routers
│   │   │   ├── auth.py          # /api/auth (register, login, me)
│   │   │   ├── datasets.py      # /api/datasets (CRUD, profile, rules, runs, AI)
│   │   │   ├── dashboard.py     # /api/dashboard (summary KPIs & distributions)
│   │   │   └── health.py        # /api/health
│   │   ├── core/
│   │   │   ├── config.py        # Centralized Pydantic Settings & CORS parsing
│   │   │   ├── database.py      # SQLAlchemy engine & session factory
│   │   │   └── security.py      # bcrypt hashing & JWT token issuing
│   │   ├── models/              # SQLAlchemy ORM models (User, Workspace, Dataset, etc.)
│   │   ├── schemas/             # Pydantic validation schemas
│   │   ├── services/            # Domain service layer
│   │   │   ├── datasets/        # Ingestion & DuckDB schema inspection
│   │   │   ├── profiling/       # Statistical metrics & quantile profiler
│   │   │   ├── quality/         # Dynamic DuckDB rule evaluation engine
│   │   │   ├── anomaly/         # scikit-learn Isolation Forest service
│   │   │   ├── reliability/     # 3-pillar explainable reliability engine
│   │   │   ├── history/         # Snapshot persistence & trend tracking
│   │   │   ├── ai/              # Google Gemini plain-language explanation
│   │   │   ├── dashboard/       # Sub-15ms SaaS dashboard aggregator
│   │   │   └── storage/         # Local filesystem storage abstraction
│   │   └── main.py              # Application entrypoint & global error handlers
│   ├── tests/                   # 62 unit and integration tests (Pytest)
│   ├── .env.example             # Backend environment variables template
│   ├── Dockerfile               # Backend container image
│   └── requirements.txt         # Pinned Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/          # UI components & dialogs
│   │   │   ├── dashboard/       # SaaS KPI cards, bar charts, donut charts, feeds
│   │   │   └── ui/              # Button, Card, Badge, Dialog, Table primitives
│   │   ├── context/             # AuthContext provider and session state
│   │   ├── layouts/             # Navbar and RootLayout
│   │   ├── pages/               # HomePage, DashboardPage, DatasetsPage, DetailPage
│   │   ├── services/            # API client (Axios/Fetch wrappers)
│   │   └── types/               # TypeScript interfaces
│   ├── .env.example             # Frontend environment variables template
│   ├── Dockerfile               # Multi-stage production Nginx container image
│   ├── package.json             # Frontend dependencies & scripts (v1.0.0)
│   └── vite.config.ts           # Vite build configuration
├── data/
│   ├── sample/                  # orders_sample.csv (included test dataset)
│   └── uploads/                 # Local directory for uploaded files (.gitignore protected)
├── docs/
│   ├── ARCHITECTURE.md          # Comprehensive architecture & design principles
│   └── DATA_FLOW.md             # End-to-end data lifecycle documentation
├── .env.example                 # Root environment variables template
├── .gitignore                   # Strict security ignore rules (.env, uploads, caches)
├── docker-compose.yml           # Multi-container orchestration definition
├── PROJECT_STATUS.md            # Detailed milestone roadmap and phase tracker
└── README.md                    # Project documentation
```

---

## Local Development Setup

### Prerequisites

- **Docker & Docker Compose** (Recommended), OR:
- **Python** 3.11+
- **Node.js** 18+ & **npm** 9+
- **PostgreSQL** 15+

---

### Option A: Quickstart with Docker Compose (Recommended)

Running the entire stack with Docker Compose automatically starts PostgreSQL, runs database migrations via Alembic, starts the FastAPI backend, and serves the optimized React frontend:

```bash
# 1. Clone the repository
git clone https://github.com/your-username/datatrust.git
cd datatrust

# 2. (Optional) Provide your Gemini API key in a root .env file:
# echo "GEMINI_API_KEY=your_key_here" > .env

# 3. Launch the container stack
docker compose up --build
```

Once launched, the services are available at:

| Service | URL | Notes |
| :--- | :--- | :--- |
| **Frontend Web App** | [http://localhost:3000](http://localhost:3000) | Nginx production container |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI + Uvicorn server |
| **Swagger API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive OpenAPI specification |
| **PostgreSQL** | `localhost:5432` | Credentials: `datatrust_user` / `datatrust_pass` |

---

### Option B: Manual Local Setup

#### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env to set DATABASE_URL (e.g., postgresql://datatrust_user:datatrust_pass@localhost:5432/datatrust)

# Run database migrations
alembic upgrade head

# Run backend tests
pytest -v

# Start development server
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Default points to VITE_API_URL=http://localhost:8000

# Start Vite dev server
npm run dev
```

Access the frontend at `http://localhost:5173`.

---

## Environment Configuration

DataTrust provides `.env.example` templates at the root, `backend/`, and `frontend/` directories:

### Root & Backend Variables (`.env`)

```ini
# Application Environment (development, staging, production, testing)
ENVIRONMENT=development

# Database Configuration
DATABASE_URL=postgresql://datatrust_user:datatrust_pass@localhost:5432/datatrust
POSTGRES_USER=datatrust_user
POSTGRES_PASSWORD=datatrust_pass
POSTGRES_DB=datatrust

# JWT Authentication
JWT_SECRET_KEY=change-this-to-a-very-secure-random-secret-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS Configuration (comma-separated origins or JSON array)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Storage Configuration
UPLOAD_DIR=../data/uploads
MAX_UPLOAD_SIZE_MB=50

# Google Gemini AI Integration (Optional)
# If omitted, AI explanation endpoints return a graceful 503 with instructions
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

### Frontend Variables (`frontend/.env`)

```ini
# Backend API Base URL
VITE_API_URL=http://localhost:8000
```

---

## REST API Overview

All authenticated endpoints require a Bearer token: `Authorization: Bearer <jwt_token>`.

### Authentication & Workspaces
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user and provision default workspace |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT access token |
| `GET` | `/api/auth/me` | Fetch active user profile and workspace details |

### Dataset Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/datasets` | Upload a `.csv` or `.parquet` dataset |
| `GET` | `/api/datasets` | List all datasets in active workspace |
| `GET` | `/api/datasets/{id}` | Get dataset metadata, dimensions, and column schemas |
| `DELETE`| `/api/datasets/{id}` | Cascade delete dataset metadata, rules, runs, and disk file |

### Profiling & Quality Rules
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/datasets/{id}/profile` | Compute DuckDB statistical profiling metrics & distributions |
| `GET` | `/api/datasets/{id}/quality-rules` | List configured quality rules |
| `POST` | `/api/datasets/{id}/quality-rules` | Create a declarative quality rule |
| `PUT` | `/api/datasets/{id}/quality-rules/{rule_id}` | Update rule configuration or enabled state |
| `DELETE`| `/api/datasets/{id}/quality-rules/{rule_id}` | Delete a quality rule |
| `POST` | `/api/datasets/{id}/quality/evaluate` | Execute vectorized DuckDB quality rule evaluation |

### Anomaly Detection & Reliability Scoring
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/datasets/{id}/anomalies/detect` | Run Isolation Forest anomaly detection |
| `GET` | `/api/datasets/{id}/reliability` | Calculate 3-pillar composite Reliability Score |

### Historical Snapshots & AI Explanation
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/datasets/{id}/runs` | Execute analysis and persist a historical `QualityRun` snapshot |
| `GET` | `/api/datasets/{id}/runs` | List chronological historical runs (newest first) |
| `GET` | `/api/datasets/{id}/runs/{run_id}` | Fetch a specific historical run snapshot |
| `POST` | `/api/datasets/{id}/ai/explanation` | Generate privacy-preserving Gemini AI quality diagnosis |

### SaaS Dashboard & System Health
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard/summary` | Sub-15ms workspace KPIs, comparison chart, tier donut, triage feed |
| `GET` | `/api/health` | Service health status check |

---

## Testing & Quality Assurance

DataTrust maintains a comprehensive automated testing suite covering unit logic, database transactions, analytical engines, and end-to-end API workflows:

```bash
# Run the complete backend test suite (62 tests)
cd backend
pytest -v
```

### Test Coverage Highlights

- **Authentication & Security (`test_auth.py`)**: Registration, duplicate prevention, password hashing, JWT expiration, workspace auto-provisioning.
- **Dataset Ingestion & Storage (`test_datasets.py`)**: File format enforcement, size validation, UUID path isolation, DuckDB inspection, workspace-scoped access.
- **Statistical Profiling (`test_profiling.py`)**: Quantile accuracy, histogram binning, missing value distributions, categorical cardinalities.
- **Quality Rules Engine (`test_quality.py`)**: Rule CRUD, boundary conditions, dynamic DuckDB SQL generation, violating row counts.
- **Anomaly Detection (`test_anomaly.py`)**: Isolation Forest execution, contamination parameters, observation threshold skips, sample extraction.
- **Reliability Scoring (`test_reliability.py`)**: 3-pillar formula validation, default weight behaviors, tier classifications.
- **Historical Snapshots (`test_history.py`)**: Snapshot persistence, chronological sorting, run-over-run deltas, zero raw row storage.
- **Gemini AI Explanation (`test_ai.py`)**: Prompt sanitization assertions (zero raw rows passed), graceful 503 handling when key is missing, mock response schema parsing.
- **SaaS Dashboard Aggregator (`test_dashboard.py`)**: Workspace-level KPI calculations, attention queue categorization, 7-day rolling window filtering.

```bash
# Verify the frontend production build
cd frontend
npm run build
```

---

## Deployment Readiness & Target Topology

DataTrust is architected for seamless cloud deployment:

```
[ Web Browser ]
      │
      ├──────────────────────────────┐
      ▼ (Static Assets & SPA)         ▼ (API Requests /api/*)
┌───────────────────────────┐ ┌───────────────────────────────────────────┐
│     Vercel Edge CDN       │ │        Render / Railway Container         │
│  React + Vite Production  │ │         FastAPI + Uvicorn Worker          │
│  Rewrite rules to index   │ │     Mounted Volume for data/uploads       │
└───────────────────────────┘ └─────────────────────┬─────────────────────┘
                                                    │
                                                    ▼ (Managed PostgreSQL)
                                      ┌───────────────────────────┐
                                      │  Neon / Supabase Serverless│
                                      │   PostgreSQL 16 Instance  │
                                      └───────────────────────────┘
```

1. **Frontend Hosting (Vercel)**:
   - Automated continuous deployment triggered by Git branch pushes.
   - Global Edge CDN caching with client-side SPA routing (`rewrites: [{ "source": "/(.*)", "destination": "/index.html" }]`).
2. **Backend API (Render or Railway)**:
   - Containerized FastAPI deployment utilizing `backend/Dockerfile`.
   - Automatic execution of database migrations on deploy: `sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"`.
   - Attached persistent disk volume mounted at `/app/data/uploads` to store dataset files.
3. **Database (Neon Serverless PostgreSQL or Supabase)**:
   - Managed PostgreSQL 16 with automated connection pooling and point-in-time recovery.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
