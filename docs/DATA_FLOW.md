# DataTrust Data Flow

This document details the complete end-to-end data lifecycle in DataTrust, tracing a user session from authentication and workspace provisioning through dataset upload, analytical profiling, rule validation, statistical anomaly detection, persistence, and AI-assisted explanation.

> **Implementation Note**: **Phase 1** (Project Foundation) and **Phase 2** (Database Models, Alembic Migrations, User Authentication, Workspace Provisioning, and Protected Shell) are fully operational. Downstream analytical stages (Phases 3–12) are designed and marked below.

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
       ▼ (1) Upload CSV / Parquet [Planned - Phase 3]
[ FastAPI Ingestion Endpoint ]
       │
       ├─────────────────────────────────┐
       ▼ (2) Save File Artifact          ▼ (3) Register Metadata
 [ File Storage (Local / Disk) ]    [ PostgreSQL Database ]
       │                                 │ (Record dataset manifest)
       ▼ (4) Query Stream                │
 [ DuckDB Embedded Engine ]              │
       │                                 │
       ├─► (5) Analytical Profiling [Phase 4]
       │       (Types, nulls, distincts, quantiles)
       │                                 │
       ├─► (6) Quality Rule Validation [Phase 5]
       │       (Completeness, range, uniqueness checks)
       │                                 │
       ├─► (7) Reliability Scoring [Phase 6]
       │       (Weighted index 0-100 computation)
       │                                 │
       └─► (8) Anomaly Detection [Phase 7]
               (Isolation Forest multivariate evaluation)
                                         │
                                         ▼ (9) Persist Run Results [Phase 5-7]
                                    [ PostgreSQL Database ]
                                         │
       ┌─────────────────────────────────┘
       ▼
 [ AI Explanation Service (Gemini API) ] [Planned - Phase 9]
       │ (Synthesizes rule failures & outlier patterns into narrative summary)
       ▼
[ React Frontend Dashboard ] [Planned - Phase 10]
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
  6. Frontend `AuthProvider` stores token in `localStorage`, protecting `/dashboard` with `ProtectedRoute`.

### Stage 1: Dataset Ingestion & Validation
- **Status**: *Planned (Phase 3)*
- **Protocol**: Multi-part form upload via HTTP `POST /api/v1/datasets/upload`.
- **Validation**: Strict file signature inspection (verifying valid CSV structure or valid Parquet magic bytes), size limit enforcement, and sanitized disk storage naming.

### Stage 2: Metadata Registration & File Persistence
- **Status**: *Planned (Phase 3)*
- **Engine**: PostgreSQL via SQLAlchemy ORM.
- **Actions**: Creates a `Dataset` row capturing filename, mime-type, byte size, file hash (SHA-256 for provenance), and owning workspace ID. Raw file stored in bounded storage volume.

### Stage 3: Analytical Profiling
- **Status**: *Planned (Phase 4)*
- **Engine**: Embedded DuckDB.
- **Actions**: Executes high-speed SQL queries directly over the file:
  - Column data type detection and casting feasibility.
  - Total row counts, null counts, null percentages.
  - Cardinality (approximate and exact distinct counts).
  - Numerical summary: min, max, mean, standard deviation, 25th/50th/75th percentiles.

### Stage 4: Data Quality Validation
- **Status**: *Planned (Phase 5)*
- **Engine**: DataTrust Quality Engine (Service Layer).
- **Rule Categories**:
  - Completeness (maximum allowable null threshold).
  - Uniqueness (primary key candidate constraints).
  - Value Ranges (min/max bound checks).
  - Pattern Conformance (regex matching for dates, emails, codes).
- **Output**: Detailed pass/fail evaluation for each rule alongside failed row sample counts.

### Stage 5: Reliability Scoring
- **Status**: *Planned (Phase 6)*
- **Algorithm**: Weighted composite score formula:
  $$\text{Reliability Score} = w_c \cdot C + w_u \cdot U + w_v \cdot V + w_s \cdot S$$
  where $C$ is Completeness score, $U$ is Uniqueness score, $V$ is Validity score, and $S$ is Schema stability score.
- **Output**: Normalized score from $0$ to $100$ categorizing dataset trust as `CRITICAL`, `WARNING`, or `RELIABLE`.

### Stage 6: Anomaly Detection
- **Status**: *Planned (Phase 7)*
- **Engine**: Scikit-learn `IsolationForest`.
- **Actions**:
  - Encodes numerical columns and imputes missing values.
  - Trains an unsupervised isolation forest on dataset feature distributions.
  - Flags multivariate outliers that pass single-column range checks but represent anomalous combinations.

### Stage 7: Run Persistence & Historical Tracking
- **Status**: *Planned (Phase 5-7)*
- **Engine**: PostgreSQL.
- **Actions**: Records `ValidationRun` entry linked to the dataset and workspace. Enables users to observe data drift and quality trends over time across repeated uploads.

### Stage 8: AI Explanation
- **Status**: *Planned (Phase 9)*
- **Engine**: Gemini API via `services/ai/`.
- **Actions**: Formulates a structured prompt containing the profiling summary, failed validation rules, and identified anomalies. Instructs the model to generate a concise, actionable diagnostic explaining root causes and remediation recommendations.

### Stage 9: Frontend Visualization & Interaction
- **Status**: *Planned (Phase 10)* (Shell active in Phase 1 & 2)
- **Engine**: React + Recharts + Tailwind CSS.
- **Actions**: Renders the complete audit report:
  - Header score dial and pass/fail summary.
  - Column-by-column profiling tables.
  - Anomaly distribution scatter graphs.
  - AI executive summary card.
