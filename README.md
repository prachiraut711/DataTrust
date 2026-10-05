# DataTrust

**Data Engineering & Data Science Reliability Platform**

DataTrust is an incremental SaaS platform designed to determine whether CSV and Parquet datasets are trustworthy, well-formed, and statistically sound enough for mission-critical analytics and machine learning pipelines.

---

## Project Status

**Phase 9 — SaaS Dashboard & Product Analytics Polish: Completed**

DataTrust provides a unified, production-ready SaaS overview dashboard (`/dashboard`) giving data teams immediate visibility into workspace health and pipeline velocity:

- **Executive Workspace KPIs**: Instant visibility into Total Datasets, Workspace Average Reliability (derived strictly from latest dataset runs, showing unanalyzed status honestly), Datasets Needing Attention (reliability $< 75$), and 7-day Activity Velocity.
- **Comparative Visualizations**: Horizontal Recharts bar chart ranking datasets by reliability score (0–100 scale) with click-through navigation, paired with a donut chart illustrating quality tier distribution (Excellent, Good, Fair, Poor).
- **Proactive Risk Triage**: Dedicated "Needs Attention" alert queue highlighting troubled datasets with low scores, accompanied by a clean green state when all datasets are healthy.
- **Recent Activity Feed**: Chronological workspace-wide audit log tracking up to 10 latest quality snapshots with relative time indicators and direct links.
- **Sub-15ms Aggregation Guarantee**: Powered by relational PostgreSQL indexing and stored `QualityRun` snapshots with zero heavy ML or raw file parsing on page load.

See [PROJECT_STATUS.md](file:///D:/prachi/Antigravity-Projects\DataTrust\PROJECT_STATUS.md) for current progress and upcoming phase milestones.

---

## SaaS Dashboard & Product Analytics

> The DataTrust SaaS dashboard delivers high-level operational intelligence across all workspace datasets in sub-15 milliseconds without re-running compute-heavy ML pipelines or reading raw disk files.

Key capabilities include:

1. **Workspace Health KPIs**:
   - **Total Datasets**: Total registered datasets in the active workspace with evaluated vs. pending counts.
   - **Average Reliability**: Mathematically sound average across evaluated datasets' latest snapshots. If no runs have been executed yet, displays an explicit "No runs yet" badge rather than misleading default scores.
   - **Needs Attention**: Real-time counter and alert queue of all datasets with a latest reliability score under 75.0.
   - **Recent Activity (7 Days)**: Volume of analytical runs completed over a rolling 7-day window.
2. **Interactive Visualizations**:
   - **Reliability Comparison Bar Chart**: Horizontal bar chart comparing latest scores across top datasets, color-coded by quality tier (emerald $\ge 90$, blue $\ge 75$, amber $\ge 60$, rose $< 60$). Clicking any bar navigates directly to the dataset's deep inspection view.
   - **Tier Distribution Donut Chart**: Donut chart breaking down workspace assets across the four reliability tiers.
3. **Actionable Risk Management**:
   - **Needs Attention Queue**: Displays warning cards with score badges, tier badges, and last run dates for low-performing datasets.
   - **Positive Health Confirmation**: Displays an encouraging "All Datasets Healthy" card when all evaluated datasets meet or exceed 75.0 reliability.
4. **Recent Activity Stream**:
   - Up to 10 latest quality run snapshots across the workspace showing dataset names, timestamps formatted in relative human time (e.g., "5m ago"), score chips, and row counts.

---

---

## AI-Powered Quality & Reliability Explanation

> DataTrust uses Gemini to convert existing profiling, quality, anomaly, reliability, and historical metrics into a concise human-readable explanation. Raw uploaded dataset contents are not sent to the AI model.

DataTrust pairs strict deterministic metrics with Google Gemini generative intelligence:

1. **Executive Plain-Language Summary**:
   - High-level assessment of dataset structural health, completeness, and suitability for ML/analytics.
2. **Reliability Score Decomposition**:
   - Plain-language walkthrough explaining how the 50% Quality, 25% Completeness, and 25% Anomaly Health components contributed to the final score.
3. **Prioritized Issue Detection**:
   - Badged severity indicators (`High Severity`, `Medium Severity`, `Low Severity`) explaining the root cause and downstream operational impact.
4. **Actionable Remediation Roadmap**:
   - Step-by-step guidance on how to fix failing assertions, handle outliers, and sanitize data pipelines.
5. **Architectural Guardrails**:
   - Zero raw row transmission guarantee.
   - Graceful 503 error handling when `GEMINI_API_KEY` is unconfigured or AI service is unreachable.

---

## Historical Quality & Reliability Tracking

DataTrust allows data teams to monitor dataset health evolution across consecutive pipeline runs:

1. **Summary Metric Snapshots**:
   - Each analysis captures: total rows, total columns, quality score, completeness score, anomaly health score, composite reliability score, and outlier percentage.
   - Preserves metadata without row-level overhead or database bloat.
2. **Interactive Trend Charting**:
   - Time-series line chart (0–100 Y-axis) mapping reliability trajectory across all historical audits.
   - Hover tooltips detailing metric breakdowns per run.
3. **Run-over-Run Delta Analysis**:
   - Automated comparison between the latest two runs identifying whether reliability is improving, declining, or stable.

---

## Reliability Score & Anomaly Detection

DataTrust delivers an objective, mathematically transparent measure of tabular data trustworthiness:

1. **Composite Reliability Formula**:
   - **Quality Component (50%)**: Measures compliance against user-defined data quality assertions (e.g. ranges, unique keys, regex formats). Defaults to 100% when no rules are configured.
   - **Completeness Component (25%)**: Evaluates dataset cell density ($\max(0, \min(100, 100 - \text{missing\_percentage}))$).
   - **Anomaly Health Component (25%)**: Penalizes extreme numerical outliers detected by Isolation Forest ($\max(0, 100 - \text{anomaly\_percentage} \times 10)$).
2. **Isolation Forest Outlier Detection**:
   - Evaluates numeric feature distributions using tree-based recursive partitioning.
   - Computes decision function scores to rank and extract up to 5 representative anomalous sample values per column.
   - Safe observation thresholding skips columns with fewer than 10 observations with clear explanations.


---

## Dataset Profiling

DataTrust performs deep, in-process statistical profiling on tabular data using DuckDB as its embedded analytical engine:

1. **Dataset Statistics**:
   - Total row and column counts.
   - Raw storage size and format identification.
   - Exact duplicate row detection (`COUNT(*) - COUNT(DISTINCT *)`) and duplicate percentage.
   - Number of numeric, categorical, temporal, and other columns.
   - Number of 100% unique columns (primary key candidates).
2. **Missing-Value Statistics**:
   - Total missing cells across the entire dataset.
   - Overall missing-value percentage.
   - Per-column null count and null rate with horizontal bar chart visualizations.
3. **Duplicate Statistics**:
   - Exact duplicate row counts across all columns without in-memory copying.
   - Per-column distinct counts and uniqueness ratios (`distinct_count / total_rows`).
4. **Numeric Statistics**:
   - Minimum, maximum, mean, median, and sample standard deviation.
   - Automatic 5-bucket distribution histogram for interactive chart rendering.
5. **Categorical Statistics**:
   - Cardinality (distinct count).
   - Most frequent value.
   - Top 5 values ranked by frequency and percentage share.
6. **Date / Temporal Statistics**:
   - Earliest and latest observed dates/timestamps.
   - Future date count (identifying anomalous dates occurring after the system timestamp).

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
- **Dataset Ingestion & DuckDB Inspection** *(Completed - Phase 3)*: Upload CSV/Parquet, sanitized storage, DuckDB vectorized profiling (rows, types, nulls, distincts), and schema browser.
- **Advanced Statistical Profiling** *(Completed - Phase 4)*: In-process calculation of quantiles, min, max, mean, standard deviation, categorical frequencies, missing value distributions, and interactive Recharts visualizations.
- **Data Quality Engine** *(Completed - Phase 5)*: Configurable declarative assertions (not null, unique, range boundaries, permitted sets, email regex, no future dates), dynamic DuckDB validation, Quality Score, and issues UI.
- **Reliability Score & Anomaly Detection** *(Completed - Phase 6)*: Objective 0–100 composite index (50% Quality, 25% Completeness, 25% Anomaly Health) and scikit-learn Isolation Forest unsupervised outlier detection on numeric columns.
- **Historical Quality & Reliability Tracking** *(Completed - Phase 7)*: Snapshot persistence (`quality_runs`), time-series Recharts reliability trend line, delta interpretation, and chronological run history.
- **AI-Powered Quality Explanation** *(Completed - Phase 8)*: Google Gemini 2.5 Flash plain-language root cause diagnostics and remediation roadmap with strict data privacy.
- **SaaS Dashboard & Product Analytics Polish** *(Completed - Phase 9)*: Workspace overview, executive KPIs, Recharts horizontal comparison bar chart, donut tier distribution, prioritized attention alerts, recent activity feed, and sub-15ms snapshot aggregation.
- **Production Readiness, Documentation & Deployment** *(Planned - Phase 10)*: Final end-to-end hardening, container verification, and production deployment guides.

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
│  (Users, Datasets, DDL)   │ │   (Direct Parquet/CSV)    │
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
- **Charts**: Recharts (missing value distribution, histograms, reliability trends, horizontal comparisons, donut distribution)

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.12
- **Validation**: Pydantic v2 & Pydantic Settings
- **Analytical Processing**: DuckDB (in-process columnar engine)
- **ORM / Persistence**: SQLAlchemy 2.0 with PostgreSQL drivers (`psycopg` & `psycopg2-binary`)
- **Database Migrations**: Alembic
- **Security & Authentication**: `bcrypt` (salted password hashing), `PyJWT` (stateless tokens)
- **Testing**: Pytest & HTTPX TestClient (62 automated tests)

### Data & Machine Learning
- **Data Manipulation**: Pandas, NumPy
- **Machine Learning**: Scikit-learn (`IsolationForest` for anomaly detection)
- **AI Explanation**: Google Gemini API (`gemini-2.5-flash` via official `google-genai` SDK)

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
│   │   ├── versions/            # 001_initial, 002_create_datasets, 003_columns, 004_rules, 005_runs
│   │   └── env.py               # Dynamic database URL configuration
│   ├── app/
│   │   ├── api/                 # API routers and endpoints
│   │   │   ├── auth.py          # Register, Login, Me endpoints
│   │   │   ├── datasets.py      # Upload, List, Details, Delete, Profile, Rules, Anomalies, AI
│   │   │   ├── dashboard.py     # Workspace SaaS overview analytics
│   │   │   ├── deps.py          # FastAPI auth and db dependencies
│   │   │   └── router.py        # Central API router
│   │   ├── core/                # Centralized settings and security
│   │   │   ├── config.py        # Pydantic BaseSettings & upload config
│   │   │   └── security.py      # Bcrypt hashing & JWT utilities
│   │   ├── database/            # SQLAlchemy session and engine
│   │   ├── models/              # Database ORM models
│   │   │   ├── user.py          # User model (UUID, email, password_hash)
│   │   │   ├── workspace.py     # Workspace model (UUID, name, owner_id)
│   │   │   ├── dataset.py       # Dataset model (UUID, filename, format, size, rows)
│   │   │   ├── dataset_column.py# DatasetColumn model (types, nulls, distincts)
│   │   │   ├── quality_rule.py  # QualityRule model (assertions & configuration)
│   │   │   └── quality_run.py   # QualityRun model (persisted metric snapshots)
│   │   ├── schemas/             # Pydantic validation schemas
│   │   │   ├── auth.py          # UserRegister, UserLogin, TokenResponse
│   │   │   ├── dataset.py       # DatasetResponse, DatasetDetailResponse
│   │   │   ├── dashboard.py     # DashboardSummaryResponse, DashboardDatasetItem
│   │   │   ├── health.py        # HealthCheckResponse
│   │   │   ├── history.py       # QualityRunResponse
│   │   │   ├── profiling.py     # DatasetProfileResponse
│   │   │   ├── quality.py       # QualityRuleCreate, QualityEvaluationResponse
│   │   │   ├── reliability.py   # ReliabilityScoreResponse
│   │   │   └── ai.py            # AIQualityExplanation
│   │   ├── services/            # Modular domain services
│   │   │   ├── datasets/        # Dataset orchestration & DuckDB inspection
│   │   │   ├── profiling/       # Statistical profiling engine
│   │   │   ├── quality/         # Rule evaluation engine
│   │   │   ├── anomaly/         # Isolation Forest anomaly detection
│   │   │   ├── reliability/     # Explainable composite score engine
│   │   │   ├── history/         # Snapshot & trend persistence
│   │   │   ├── ai/              # Gemini explanation service
│   │   │   ├── dashboard/       # SaaS workspace overview aggregator
│   │   │   └── storage/         # Local filesystem storage abstraction
│   │   └── main.py              # FastAPI application entrypoint
│   ├── tests/                   # Pytest test suite (62 unit/integration tests)
│   │   ├── conftest.py          # In-memory SQLite fixtures & client overrides
│   │   ├── test_auth.py         # Authentication test cases
│   │   ├── test_datasets.py     # Dataset upload, DuckDB inspection, & security tests
│   │   ├── test_profiling.py    # Analytical profiling tests
│   │   ├── test_quality.py      # Quality rules CRUD and evaluation tests
│   │   ├── test_anomaly.py      # Statistical anomaly detection tests
│   │   ├── test_reliability.py  # Reliability score formula tests
│   │   ├── test_history.py      # Historical snapshot & trend tests
│   │   ├── test_ai.py           # Gemini AI explanation tests
│   │   ├── test_dashboard.py    # Workspace dashboard summary tests
│   │   └── test_health.py       # Health and root endpoint tests
│   ├── .env.example             # Backend environment template
│   ├── Dockerfile               # Backend container image
│   └── requirements.txt         # Pinned Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/ui/       # UI primitive components (Button, Card, ProtectedRoute)
│   │   ├── components/dashboard/# ReliabilityOverviewChart, ReliabilityDistributionChart, RecentActivity, NeedsAttention
│   │   ├── components/          # UploadDatasetDialog, ProfilingOverview, etc.
│   │   ├── context/             # AuthContext provider and useAuth hook
│   │   ├── layouts/             # Navbar and RootLayout
│   │   ├── pages/               # HomePage, LoginPage, RegisterPage, DashboardPage,
│   │   │                        # DatasetsPage, DatasetDetailPage
│   │   ├── services/            # API client (auth, datasets, health, dashboard)
│   │   ├── types/               # TypeScript interfaces (User, Dataset, Dashboard, etc.)
│   │   ├── App.tsx              # Application route definitions
│   │   └── main.tsx             # React DOM entrypoint
│   ├── .env.example             # Frontend environment template
│   ├── Dockerfile               # Multi-stage production build
│   ├── package.json             # NPM package manifest
│   ├── tailwind.config.js       # Tailwind CSS configuration
│   └── vite.config.ts           # Vite configuration
├── data/
│   ├── sample/                  # Safe sample datasets (orders_sample.csv)
│   └── uploads/                 # Local directory for uploaded files (.gitignore protected)
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
- Auth Endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Dataset Endpoints: `POST /api/datasets`, `GET /api/datasets`, `GET /api/datasets/{id}`, `DELETE /api/datasets/{id}`
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
- Unauthenticated access to `/dashboard` or `/datasets` redirects to `/login`.

---

## Docker Setup

To run the entire stack (PostgreSQL, Backend API with DuckDB, and Frontend) locally via Docker Compose:

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
