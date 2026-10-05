# DataTrust Data Flow

This document details the complete end-to-end data lifecycle in DataTrust, tracing a user session from authentication and workspace provisioning through dataset upload, analytical profiling, rule validation, statistical anomaly detection, persistence, and AI-assisted explanation.

> **Implementation Note**: **Phases 1–10** are fully implemented, verified, and operational in production. This encompasses Project Foundation (Phase 1), Authentication & Workspaces (Phase 2), Dataset Ingestion & DuckDB Inspection (Phase 3), In-Process Statistical Profiling (Phase 4), Declarative Quality Rules Engine (Phase 5), Reliability Score & Statistical Anomaly Detection (Phase 6), Historical Quality Tracking & Snapshots (Phase 7), Gemini AI Explanation Engine (Phase 8), SaaS Overview Dashboard & Analytics (Phase 9), and Production Hardening & Deployment Readiness (Phase 10).

---

## 1. High-Level Data Flow Diagram

```
[ User Browser ]
       │
       ▼ (0) Authenticate (Register / Login) [Completed - Phase 2]
[ FastAPI Auth Endpoints (/api/auth) ]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
 [ Provision Default Workspace ]   [ Issue JWT Access Token ]
       │                                 │
       ▼                                 ▼
 [ PostgreSQL Database ]            [ Client Session Storage ]
 (users, workspaces tables)        (Bearers sent with API requests)
       │
       ▼ (1) Upload CSV / Parquet [Completed - Phase 3]
[ FastAPI Ingestion Endpoint (/api/datasets) ]
       │
       ├─────────────────────────────────┐
       ▼ (2) Save File Artifact          ▼ (3) DuckDB Inspection [Completed - Phase 3]
 [ File Storage (data/uploads) ]    [ Embedded DuckDB Engine ]
       │                                 │ (Query row & column nulls, types, distincts)
       ▼                                 ▼
 [ Safe UUID Storage File ]         [ Extract Metrics & Schema ]
       │                                 │
       └────────────────► ┬ ◄────────────┘
                          │ (4) Persist Metadata & Columns [Completed - Phase 3]
                          ▼
               [ PostgreSQL Database ]
            (datasets, dataset_columns)
                          │
                          ├─► (5) Advanced Statistical Profiling [Completed - Phase 4]
                          │       (Quantiles, min/max/mean/stddev, categorical frequencies)
                          │
                          ├─► (6) Quality Rule Validation [Completed - Phase 5]
                          │       (Completeness, range, uniqueness, pattern checks)
                          │
                          ├─► (7) Statistical Anomaly Detection [Completed - Phase 6]
                          │       (Isolation Forest unsupervised outlier scoring)
                          │
                          ├─► (8) Reliability Scoring [Completed - Phase 6]
                          │       (50% Quality + 25% Completeness + 25% Anomaly Health)
                          │
                          ├─► (9) Persist Run Snapshots & Trends [Completed - Phase 7]
                          │       (quality_runs table, chronological history)
                          │
                          └─► (10) Gemini AI Explanation [Completed - Phase 8]
                                  (Synthesizes metrics into plain-language diagnosis)
                                        │
                                        ▼ (11) Interactive Visualizations [Completed - Phase 9 & 10]
                                  [ React + Vite + Tailwind + shadcn Dashboard ]
                                    • Executive Workspace KPIs (Datasets, Avg Reliability, Needs Attention)
                                    • Recharts Comparative Horizontal Bar & Tier Donut Charts
                                    • Column Profiling & Frequency Distribution Views
                                    • Interactive Quality Rules CRUD & Violations Inspector
                                    • Isolation Forest Outlier Rates & Sample Values
                                    • Historical Reliability Progression & Delta Analysis
                                    • On-Demand Gemini AI Diagnostic Insights (Zero Raw Rows Sent)
```

---

## 2. Stage-by-Stage Lifecycle

### Stage 0: User Authentication & Workspace Initialization
- **Status**: **Completed (Phase 2)**
- **Endpoints**: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
- **Engine**: FastAPI, PostgreSQL, SQLAlchemy 2.0, Alembic, bcrypt, PyJWT.
- **Actions**:
  1. Validates email format and password length ($\ge 8$ chars).
  2. Verifies uniqueness of email address (HTTP 409 on duplicate).
  3. Hashes password using salted `bcrypt`.
  4. Inserts `users` record and automatically provisions an initial `workspaces` record linked to the user.
  5. Returns a signed JWT access token (`HS256`, 24h expiration) and the user profile.
  6. Frontend `AuthProvider` stores token in `localStorage`, protecting `/dashboard` and `/datasets` with `ProtectedRoute`.

### Stage 1: Dataset Ingestion & Validation
- **Status**: **Completed (Phase 3)**
- **Endpoint**: `POST /api/datasets`.
- **Protocol**: Multi-part form upload with `file`, `name`, and optional `description`.
- **Validation**:
  - File extension check: Strictly `.csv` or `.parquet`.
  - File size check: Configurable limit (default: 50 MB, `MAX_UPLOAD_SIZE_MB`).
  - Empty file detection: Reject 0-byte uploads.
- **Storage**: Streamed to `data/uploads/` with unpredictable UUID-based filenames (`<uuid4>.csv` / `<uuid4>.parquet`), preventing directory traversal.

### Stage 2: In-Process DuckDB Inspection & Column Profiling
- **Status**: **Completed (Phase 3)**
- **Engine**: Embedded DuckDB.
- **Actions**:
  1. Opens in-process connection and directly queries the saved file on disk (`read_csv_auto` or `read_parquet`).
  2. Queries total row count: `SELECT COUNT(*) FROM read_csv_auto(...)`.
  3. Queries schema definitions: `DESCRIBE SELECT * FROM read_csv_auto(...)`.
  4. In a vectorized pass, computes `null_count`, `null_percentage`, and `distinct_count` for each column.
  5. Never loads raw dataset contents into PostgreSQL.

### Stage 3: Metadata Persistence
- **Status**: **Completed (Phase 3)**
- **Engine**: PostgreSQL via SQLAlchemy ORM.
- **Actions**:
  1. Creates a `Dataset` row capturing name, original filename, stored filename, file size, row count, and column count linked to the user's workspace.
  2. Creates a `DatasetColumn` row for every discovered column capturing name, inferred DuckDB type, null count, null percentage, and distinct count.
  3. Commits in an atomic transaction. If DuckDB parsing fails, the unlinked file is removed from disk immediately.

### Stage 4: Advanced Statistical Profiling
- **Status**: **Completed (Phase 4)**
- **Endpoint**: `GET /api/datasets/{dataset_id}/profile`
- **Engine**: Embedded DuckDB + Pandas.
- **Actions**:
  1. Computes overall dataset metrics: duplicate rows count, overall completeness percentage, and column type breakdown.
  2. For numeric columns: computes min, max, mean, standard deviation, median, 25th/75th quantiles, and equi-width histogram bins.
  3. For categorical columns: computes top 5 frequent values with counts and percentages, plus unique distinct counts.
  4. For datetime columns: computes earliest date, latest date, future timestamp counts, and null rates.

### Stage 5: Data Quality Validation
- **Status**: **Completed (Phase 5)**
- **Endpoints**: `POST /api/datasets/{dataset_id}/quality/evaluate`, plus CRUD at `/api/datasets/{dataset_id}/quality-rules`
- **Engine**: DataTrust Quality Engine (`QualityService`) via embedded DuckDB.
- **Rule Categories**:
  - `not_null`: Assert column contains no null values.
  - `unique`: Assert all non-null values are distinct.
  - `numeric_range`: Assert values fall within `[min, max]` boundaries.
  - `allowed_values`: Assert values belong to a designated whitelist.
  - `email_format`: Assert string conforms to standard RFC email regex.
  - `no_future_dates`: Assert timestamps are less than or equal to current timestamp.
- **Output**:
  - Passed, failed, and skipped statuses per rule with violating row counts.
  - Overall Quality Score computed as `(passed_checks / applicable_checks) * 100`.

### Stage 6: Statistical Anomaly Detection
- **Status**: **Completed (Phase 6)**
- **Endpoint**: `POST /api/datasets/{dataset_id}/anomalies/detect`
- **Engine**: `scikit-learn` `IsolationForest` (`AnomalyService`).
- **Actions**:
  1. Reads numeric columns directly via DuckDB into NumPy feature arrays.
  2. Imputes missing values safely using column medians.
  3. Executes `IsolationForest(contamination=0.05, random_state=42)` per column or across numeric features.
  4. Skips columns with fewer than 10 non-null observations with clear diagnostic feedback.
  5. Computes decision function scores to rank and extract up to 5 representative anomalous sample values per column.

### Stage 7: Explainable Reliability Scoring
- **Status**: **Completed (Phase 6)**
- **Endpoint**: `GET /api/datasets/{dataset_id}/reliability`
- **Engine**: DataTrust Reliability Engine (`ReliabilityService`).
- **Algorithm**:
  $$\text{Reliability Score} = 0.50 \times \text{Quality} + 0.25 \times \text{Completeness} + 0.25 \times \text{Anomaly Health}$$
  where:
  - $\text{Quality} = \text{Quality Score from rules (defaults to 100.0 if unconfigured)}$
  - $\text{Completeness} = \max(0, \min(100, 100 - \text{missing\_percentage}))$
  - $\text{Anomaly Health} = \max(0, 100 - \text{anomaly\_percentage} \times 10)$
- **Output**: 0–100 score classified into tiers: **Excellent** ($\ge 90$), **Good** ($75–89$), **Fair** ($60–74$), and **Poor** ($< 60$).

### Stage 8: Run Persistence & Historical Tracking
- **Status**: **Completed (Phase 7)**
- **Endpoints**: `POST /api/datasets/{dataset_id}/runs`, `GET /api/datasets/{dataset_id}/runs`
- **Engine**: PostgreSQL (`quality_runs` table via `HistoryService`).
- **Actions**:
  1. Runs composite reliability analysis and captures a compact snapshot: `row_count`, `column_count`, `quality_score`, `completeness_score`, `anomaly_score`, `reliability_score`, `anomaly_percentage`, and optional `notes`.
  2. Preserves historical run records ordered chronologically (newest first).
  3. Computes run-over-run deltas (improving, declining, stable) between the latest two runs.
  4. Never stores raw tabular rows or large payload blobs in the metadata database.

### Stage 9: AI Explanation Engine
- **Status**: **Completed (Phase 8)**
- **Endpoint**: `POST /api/datasets/{dataset_id}/ai/explanation`
- **Engine**: Google GenAI SDK (`gemini-2.5-flash` via `GeminiService`).
- **Actions**:
  1. Compiles aggregated structural profiling, failing quality rules, outlier statistics, and composite reliability score.
  2. **Data Privacy Guarantee**: Zero raw CSV/Parquet rows or user credentials are transmitted to Gemini.
  3. Produces a structured JSON explanation: executive summary, score explanation, ranked key issues with severity tags (`high`, `medium`, `low`), and prioritized remediation recommendations.
  4. Handles missing API keys and upstream failures gracefully with HTTP 503 responses and actionable instructions.

### Stage 10: SaaS Dashboard & Frontend Visualizations
- **Status**: **Completed (Phases 9 & 10)**
- **Endpoint**: `GET /api/dashboard/summary`
- **Engine**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Recharts.
- **Actions**:
  1. Executive SaaS overview at `/dashboard`: workspace KPIs (Total Datasets, Average Reliability, Needs Attention count, 7-day Runs Velocity).
  2. Recharts horizontal bar chart comparing datasets by score, plus donut chart showing tier breakdown.
  3. Actionable "Needs Attention" alert queue and chronological Recent Activity feed.
  4. Dataset deep-dive at `/datasets/{id}`: tabbed interface for Schema, Profiling distributions, Quality Rules CRUD, Reliability Score breakdown, Isolation Forest outlier chips, historical trend line, and on-demand Gemini AI diagnosis.
  5. Sub-15ms dashboard response guarantee powered by indexed PostgreSQL snapshots.
