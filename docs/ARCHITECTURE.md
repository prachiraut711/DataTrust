# DataTrust Architecture

DataTrust is an incremental, production-grade data engineering and data science SaaS platform designed to determine whether CSV and Parquet datasets are reliable enough for mission-critical analytics and machine learning pipelines.

---

## 1. High-Level Architecture

The system follows a clean modular monolithic architecture designed for clear separation of concerns, rapid development, and straightforward containerized deployment:

```
┌────────────────────────────────────────────────────────┐
│               Frontend (React + Vite + TS)              │
│       Tailwind CSS + shadcn/ui + React Router          │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / JSON API (Bearer JWT)
                            ▼
┌────────────────────────────────────────────────────────┐
│                Backend (FastAPI + Python)              │
│            Modular Routers & Pydantic Schemas          │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│     Metadata Database     │ │   Analytical Data Engine  │
│        PostgreSQL         │ │     Embedded DuckDB       │
│  (Users, Workspaces, DDL) │ │    (In-Process OLAP)      │
└───────────────────────────┘ └───────────────────────────┘
```

---

## 2. Core Architectural Layers

### 2.1 Frontend Presentation Layer
- **Framework**: React 18 with TypeScript and Vite.
- **Styling & UI**: Tailwind CSS with custom HSL design tokens, standard shadcn/ui design patterns, and Lucide icons.
- **Routing & Protection**: React Router DOM with an `AuthProvider` context and `ProtectedRoute` guard ensuring unauthenticated users are redirected to `/login`.
- **Dataset Management**: Dedicated `/datasets` management screen with drag-and-drop ingestion dialog, and `/datasets/:id` detailed column schema viewer.
- **Visualization (Planned)**: Recharts for quality metric timelines, distribution histograms, and anomaly scatter plots (Phases 8–10).

### 2.2 API & Application Service Layer
- **Framework**: FastAPI (Python 3.12).
- **Validation**: Pydantic v2 schemas and Pydantic Settings for centralized, type-safe configuration.
- **Security & Session**: Direct `bcrypt` password hashing, stateless `PyJWT` tokens (`HS256`, 24h expiration), and `OAuth2PasswordBearer` dependency extraction.
- **Storage Abstraction**: `LocalStorageService` handling chunked file streaming, max file size enforcement (50 MB configurable), sanitized UUID filename generation, and strict path traversal protection.
- **Analytical Ingestion**: `DuckDBInspectionService` reading CSV and Parquet files in-process directly from disk to infer schemas, calculate nulls, null percentages, and distinct counts without inserting raw data into PostgreSQL.
- **Profiling Engine**: `ProfilingService` leveraging embedded DuckDB to compute dataset-level summary metrics (duplicate rows, cell completeness, column types) and column-level distributions (numeric min/max/mean/median/stddev/histograms, categorical top 5 frequencies, and date boundaries/future timestamps).
- **Profiling Architecture Flow**:
  ```
  Frontend (Dataset Detail Screen)
     │ GET /api/datasets/{id}/profile (Bearer JWT)
     ▼
  FastAPI (Datasets API Router)
     │ Scopes workspace ownership & passes Dataset model
     ▼
  Profiling Service (Domain Engine)
     │ Resolves sanitized file path on disk
     ▼
  Embedded DuckDB (In-Process OLAP)
     │ Direct SQL execution: read_csv_auto() / read_parquet()
     ▼
  Physical Storage (CSV / Parquet in data/uploads/)
  ```
- **Quality Rules Architecture Flow**:
  ```
  Dataset (Workspace scoped)
     │
     ▼
  Quality Rule Configuration (PostgreSQL dataset_quality_rules)
     │
     ▼
  Quality Service (Dynamic Validation Engine)
     │
     ▼
  Embedded DuckDB (Vectorized Aggregation on raw CSV/Parquet)
     │
     ▼
  Validation Results (PASS / FAIL / SKIPPED with violating row counts)
     │
     ▼
  Quality Score ((passed_checks / applicable_checks) * 100)
  ```
- **Reliability & Anomaly Architecture Flow (Phase 6)**:
  ```
                      Dataset
                         │
               ┌─────────┴─────────┐
               ▼                   ▼
         Data Profiling       Quality Rules
               │                   │
               ▼                   ▼
         Anomaly Detection     Quality Score
               │                   │
               └─────────┬─────────┘
                         ▼
                  Reliability Score
                         │
                         ▼
                   DataTrust UI
  ```
- **Historical Quality Tracking Architecture Flow (Phase 7)**:
  ```
  Dataset
     │
     ├── Profiling
     ├── Quality Rules
     ├── Anomaly Detection
     │
     └── Reliability Score
              │
              ▼
        QualityRun Snapshot
              │
              ▼
        Historical Trends
  ```
- **AI-Powered Quality Explanation Architecture Flow (Phase 8)**:
  ```
  Existing DataTrust Analysis
            │
            ▼
     Structured Metrics
            │
            ▼
        GeminiService
            │
            ▼
     AI Explanation
  ```
  Gemini acts strictly as an **explanation layer**, not the primary data-analysis engine. All underlying metrics, quality scores, and anomaly distributions are computed authoritatively by DataTrust's internal Python, DuckDB, and Scikit-learn services. Raw dataset rows, cell contents, or user credentials are never transmitted to Gemini.
- **SaaS Dashboard & Analytics Architecture Flow (Phase 9)**:
  ```
  Workspace
      │
      ├── Datasets
      │
      └── QualityRun Snapshots
               │
               ▼
        Dashboard Service (Aggregation Engine)
               │
               ▼
         Dashboard Summary (KPIs, Distributions, Activity)
               │
               ▼
         React Dashboard (Overview Charts & Attention Feed)
  ```
  **Zero Re-computation Guarantee**: The SaaS dashboard strictly aggregates relational metadata from `datasets` and snapshot summaries from `quality_runs`. It never triggers raw file parsing, DuckDB profiling, Isolation Forest execution, or external Gemini API calls on dashboard requests, delivering sub-15ms page loads.
- **Explainable Reliability Score Formula**:
  $$\text{Reliability Score} = 0.50 \times \text{Quality} + 0.25 \times \text{Completeness} + 0.25 \times \text{Anomaly Health}$$
  where:
  - $\text{Completeness} = \max(0, \min(100, 100 - \text{missing\_percentage}))$
  - $\text{Anomaly Health} = \max(0, 100 - \text{anomaly\_percentage} \times 10)$
  - $\text{Quality} = \text{quality\_score}$ from quality rules evaluation (defaults to 100.0 if unconfigured).
  - Levels: **Excellent** (90–100), **Good** (75–89), **Fair** (60–74), **Poor** (0–59).
- **Modular Services**:
  - `datasets/`: Ingestion, storage orchestration, DuckDB analytical inspection, and CRUD.
  - `profiling/`: Statistical schema inference, quantiles, distributions, and frequencies (Phase 4).
  - `quality/`: Configurable validation rules, dynamic DuckDB execution, Quality Score, and issue identification (Phase 5).
  - `anomaly/`: Scikit-learn `IsolationForest` statistical outlier detection on numeric columns (Phase 6).
  - `reliability/`: Composite 3-pillar data reliability calculation engine (Phase 6).
  - `history/`: Persistent summary metric snapshots and trend time-series (`history_service.py`) (Phase 7).
  - `ai/`: Gemini API integration explaining data quality, anomalies, and reliability in plain language (`gemini_service.py`) (Phase 8).
  - `dashboard/`: Workspace-scoped metadata & snapshot aggregation for SaaS overview analytics (`dashboard_service.py`) (Phase 9).

---

## 3. Relational Schema Architecture (PostgreSQL)

```
┌──────────────────────────────────────┐
│                users                 │
├──────────────────────────────────────┤
│ id: UUID (PK)                        │
│ email: VARCHAR(255) (UNIQUE, INDEX)  │
│ password_hash: VARCHAR(255)          │
│ full_name: VARCHAR(255)              │
│ created_at: TIMESTAMPTZ              │
│ updated_at: TIMESTAMPTZ              │
└──────────────────┬───────────────────┘
                   │ 1
                   │ owns
                   │ N
                   ▼
┌──────────────────────────────────────┐
│              workspaces              │
├──────────────────────────────────────┤
│ id: UUID (PK)                        │
│ name: VARCHAR(255)                   │
│ owner_id: UUID (FK -> users.id, IDX) │
│ created_at: TIMESTAMPTZ              │
│ updated_at: TIMESTAMPTZ              │
└──────────────────┬───────────────────┘
                   │ 1
                   │ contains
                   │ N
                   ▼
┌──────────────────────────────────────┐
│               datasets               │
├──────────────────────────────────────┤
│ id: UUID (PK)                        │
│ workspace_id: UUID (FK -> ws.id, IDX)│
│ name: VARCHAR(255)                   │
│ description: TEXT (NULLABLE)         │
│ original_filename: VARCHAR(255)      │
│ stored_filename: VARCHAR(255)        │
│ file_format: VARCHAR(32)             │
│ file_size: BIGINT                    │
│ row_count: INTEGER                   │
│ column_count: INTEGER                │
│ uploaded_at: TIMESTAMPTZ             │
│ updated_at: TIMESTAMPTZ              │
└──────────┬───────────────────┬───────┘
           │ 1                 │ 1
           │ has               │ tracks
           │ N                 │ N
           ▼                   ▼
┌─────────────────────┐ ┌──────────────────────────────────────┐
│   dataset_columns   │ │             quality_runs             │
├─────────────────────┤ ├──────────────────────────────────────┤
│ id: UUID (PK)       │ │ id: UUID (PK)                        │
│ dataset_id: UUID(FK)│ │ dataset_id: UUID (FK -> ds.id, IDX)  │
│ column_name: VARCHAR│ │ workspace_id: UUID (FK -> ws.id, IDX)│
│ data_type: VARCHAR  │ │ row_count: INTEGER                   │
│ null_count: INTEGER │ │ column_count: INTEGER                │
│ null_pct: FLOAT     │ │ quality_score: FLOAT                 │
│ distinct_cnt: INT   │ │ completeness_score: FLOAT            │
│ created_at: TIMESTZ │ │ anomaly_score: FLOAT                 │
└─────────────────────┘ │ reliability_score: FLOAT             │
                        │ anomaly_percentage: FLOAT            │
                        │ notes: TEXT (NULLABLE)               │
                        │ created_at: TIMESTAMPTZ (INDEX)      │
                        └──────────────────────────────────────┘
```

### 3.1 Design Principles
1. **Separation of Raw Data & Metadata**: PostgreSQL stores only structural metadata (`file_size`, `row_count`, `column_count`, column names, types, nulls, distinct counts). The actual raw tabular content stays in bounded file storage.
2. **UUID Identifiers**: Prevent sequential enumeration attacks across multi-tenant workspaces.
3. **Cascading Relational Deletes**: Deleting a dataset cascades to delete its `dataset_columns` records in PostgreSQL and triggers file cleanup on disk.
4. **Reproducible Migrations**: Versioned with Alembic (`001_initial` $\rightarrow$ `002_create_datasets` $\rightarrow$ `003_create_dataset_columns`).

---

## 4. Dual Database Strategy: PostgreSQL vs. DuckDB

```
                       Application Needs
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   Operational / Relational              Analytical / OLAP
   • Users & Authentication              • Column-oriented aggregations
   • Workspaces & Permissions            • Direct Parquet/CSV scanning
   • Dataset metadata manifests          • Schema discovery (types, nulls)
   • Column dictionary metadata          • In-memory profiling & quantiles
   • Historical run outcomes             • Anomaly scoring feature vectors
            │                                     │
            ▼                                     ▼
       PostgreSQL                              DuckDB
  (Persistent Metadata)                  (Embedded Execution)
```

### Why PostgreSQL for Application Metadata?
1. **Relational Integrity**: Foreign key constraints between users, workspaces, datasets, and validation runs.
2. **ACID Transactions**: Reliable state management for dataset tracking, user sessions, and test run logs.
3. **Ecosystem & Cloud Ready**: Out-of-the-box support for managed database providers such as Neon, Supabase, or AWS RDS.

### Why DuckDB for Analytical Processing?
1. **Columnar Vectorized Engine**: Fast execution of aggregations (e.g., `COUNT(*) - COUNT(col)`, `COUNT(DISTINCT col)`) directly over raw tabular data.
2. **Native File Scanning**: Directly queries Parquet and CSV files on disk using `read_csv_auto` and `read_parquet` without loading entire datasets into RAM or requiring ingestion into PostgreSQL tables.
3. **In-Process & Zero Infrastructure Overhead**: Runs embedded inside the Python backend process. No distributed cluster (Spark/Trino), no separate server daemon, and zero networking latency.
4. **Clean Integration**: Seamless interoperability with Arrow, Pandas, and NumPy for downstream anomaly detection.

---

## 5. Storage & File Security

- **Path Traversal Protection**: All stored file paths are verified against `base_dir` using `Path.is_relative_to` before access.
- **Unpredictable Filenames**: Files are saved on disk as `<uuid4>.csv` or `<uuid4>.parquet`, decoupling original client filenames from filesystem paths.
- **Size Limits**: Enforced dynamically during streaming (default: 50 MB, configurable via `MAX_UPLOAD_SIZE_MB`). Partial files are immediately unlinked upon limit breach.
- **Allowed Formats**: Explicit validation rejecting unsupported files (`.xlsx`, `.json`, `.exe`, etc.).

---

## 6. Infrastructure & Deployment Model

- **Local Development**: Managed via Docker Compose:
  - `datatrust-frontend`: Node builder + Nginx static server (port `3000` / `80`).
  - `datatrust-backend`: Uvicorn + FastAPI with DuckDB and upload volume mount (port `8000`).
  - `datatrust-postgres`: PostgreSQL 16 Alpine with persistent volume (port `5432`).
- **Cloud Deployment (Planned)**:
  - Frontend: Vercel (static edge CDN hosting).
  - Backend: Render or Railway (containerized FastAPI instance).
  - Database: Neon Serverless PostgreSQL.
