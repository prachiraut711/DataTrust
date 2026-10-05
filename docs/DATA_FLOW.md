# DataTrust Data Flow

This document details the complete end-to-end data lifecycle in DataTrust, tracing a user session from authentication and workspace provisioning through dataset upload, analytical profiling, rule validation, statistical anomaly detection, persistence, and AI-assisted explanation.

> **Implementation Note**: **Phase 1** (Project Foundation), **Phase 2** (Database Models & Authentication), and **Phase 3** (Dataset Ingestion, Storage, DuckDB Inspection, and Metadata) are fully operational. Downstream analytical stages (Phases 4–12) are designed and marked below.

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
       ▼ (2) Save File Artifact          ▼ (3) DuckDB Inspection
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
                          ├─► (5) Advanced Statistical Profiling [Phase 4]
                          │       (Mean, median, quantiles, distributions)
                          │
                          ├─► (6) Quality Rule Validation [Phase 5]
                          │       (Completeness, range, uniqueness checks)
                          │
                          ├─► (7) Reliability Scoring [Phase 6]
                          │       (Weighted index 0-100 computation)
                          │
                          └─► (8) Anomaly Detection [Phase 7]
                                  (Isolation Forest multivariate evaluation)
                                            │
                                            ▼ (9) Persist Run Results [Phase 5-7]
                                       [ PostgreSQL Database ]
                                            │
                          ┌─────────────────┘
                          ▼
            [ AI Explanation Service (Gemini API) ] [Planned - Phase 9]
                          │ (Synthesizes rule failures into narrative summary)
                          ▼
           [ React Frontend Dashboard & Reports ] [Planned - Phase 10]
             • Reliability score badge
             • Profiling summary & distribution charts
             • Quality check breakdown & failure inspection
             • Identified outlier distributions
             • Plain-text AI diagnostic insights
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
- **Status**: *Planned (Phase 4)*
- **Engine**: Embedded DuckDB + Pandas.
- **Actions**: Extends profiling with numerical metrics: min, max, mean, standard deviation, median, 25th/75th percentiles, and categorical top values.

### Stage 5: Data Quality Validation
- **Status**: *Planned (Phase 5)*
- **Engine**: DataTrust Quality Engine (Service Layer).
- **Rule Categories**:
  - Completeness (maximum allowable null threshold).
  - Uniqueness (primary key candidate constraints).
  - Value Ranges (min/max bound checks).
  - Pattern Conformance (regex matching for dates, emails, codes).
- **Output**: Detailed pass/fail evaluation for each rule alongside failed row sample counts.

### Stage 6: Reliability Scoring
- **Status**: *Planned (Phase 6)*
- **Algorithm**: Weighted composite score formula:
  $$\text{Reliability Score} = w_c \cdot C + w_u \cdot U + w_v \cdot V + w_s \cdot S$$
  where $C$ is Completeness score, $U$ is Uniqueness score, $V$ is Validity score, and $S$ is Schema stability score.
- **Output**: Normalized score from $0$ to $100$ categorizing dataset trust as `CRITICAL`, `WARNING`, or `RELIABLE`.

### Stage 7: Anomaly Detection
- **Status**: *Planned (Phase 7)*
- **Engine**: Scikit-learn `IsolationForest`.
- **Actions**:
  - Encodes numerical columns and imputes missing values.
  - Trains an unsupervised isolation forest on dataset feature distributions.
  - Flags multivariate outliers that pass single-column range checks but represent anomalous combinations.

### Stage 8: Run Persistence & Historical Tracking
- **Status**: *Planned (Phase 8)*
- **Engine**: PostgreSQL.
- **Actions**: Records `ValidationRun` entry linked to the dataset and workspace. Enables users to observe data drift and quality trends over time across repeated uploads.

### Stage 9: AI Explanation
- **Status**: *Planned (Phase 9)*
- **Engine**: Gemini API via `services/ai/`.
- **Actions**: Formulates a structured prompt containing the profiling summary, failed validation rules, and identified anomalies. Instructs the model to generate a concise, actionable diagnostic explaining root causes and remediation recommendations.

### Stage 10: Frontend Visualization & Interaction
- **Status**: *Planned (Phase 10)* (Dataset ingestion & schema browser active in Phase 3)
- **Engine**: React + Recharts + Tailwind CSS.
- **Actions**: Renders the complete audit report:
  - Header score dial and pass/fail summary.
  - Column-by-column profiling tables.
  - Anomaly distribution scatter graphs.
  - AI executive summary card.
