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
- **Visualization (Planned)**: Recharts for quality metric timelines, distribution histograms, and anomaly scatter plots.

### 2.2 API & Application Service Layer
- **Framework**: FastAPI (Python 3.12).
- **Validation**: Pydantic v2 schemas and Pydantic Settings for centralized, type-safe configuration.
- **Security & Session**: Direct `bcrypt` password hashing, stateless `PyJWT` tokens (`HS256`, 24h expiration), and `OAuth2PasswordBearer` dependency extraction.
- **Modular Services**:
  - `profiling/`: Statistical schema inference, null counts, cardinalities, and quantiles (Phase 4).
  - `quality/`: Rule engine evaluating completeness, uniqueness, ranges, and schema drift (Phase 5).
  - `analytics/`: Aggregate metric generation and data health indexing (Phase 8).
  - `anomaly/`: Scikit-learn `IsolationForest` unsupervised outlier detection (Phase 7).
  - `ai/`: Gemini API integration explaining detected anomalies in plain language (Phase 9).

---

## 3. Metadata Models & Multi-Tenant Workspaces (Phase 2)

### 3.1 Relational Schema Architecture

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
└──────────────────────────────────────┘
```

### 3.2 Design Decisions:
1. **UUID Primary Keys**: Universal Unique Identifiers prevent enumeration attacks, simplify data seeding across test environments, and allow safe client-side reference generation.
2. **Cascading Deletes**: `ondelete="CASCADE"` on `workspaces.owner_id` guarantees relational consistency without orphaned resources.
3. **Automatic Workspace Provisioning**: Upon successful registration, the backend automatically provisions a default workspace (e.g. `"<Full Name>'s Workspace"`) within the same database transaction.
4. **Reproducible Migrations (Alembic)**: Database schema evolution is version-controlled via Alembic (`001_initial`), avoiding manual table definitions or unmanaged `Base.metadata.create_all()` in production.

---

## 4. Dual Database Strategy: PostgreSQL vs. DuckDB

A foundational architectural decision in DataTrust is the **clear separation of operational metadata from analytical data processing**:

```
                       Application Needs
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   Operational / Relational              Analytical / OLAP
   • Users & Authentication              • Column-oriented aggregations
   • Workspaces & Permissions            • Parquet/CSV file scanning
   • Dataset metadata manifests          • Summary statistics & quantiles
   • Configured quality rules            • In-memory dataset profiling
   • Historical run outcomes             • Anomaly scoring vectors
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
1. **Columnar Vectorized Engine**: Fast execution of aggregations (e.g., `APPROX_COUNT_DISTINCT`, quantiles, histograms) directly over raw tabular data.
2. **Native File Scanning**: Directly queries Parquet and CSV files on disk without loading entire datasets into RAM or requiring ingestion into PostgreSQL tables.
3. **In-Process & Zero Infrastructure Overhead**: Runs embedded inside the Python backend process. No distributed cluster (Spark/Trino), no separate server daemon, and zero networking latency.
4. **Clean Integration**: Seamless interoperability with Arrow, Pandas, and NumPy for downstream anomaly detection.

---

## 5. Infrastructure & Deployment Model

- **Local Development**: Managed via Docker Compose containing:
  - `datatrust-frontend`: Node builder + Nginx static server (port `3000` / `80`).
  - `datatrust-backend`: Uvicorn + FastAPI (port `8000`).
  - `datatrust-postgres`: PostgreSQL 16 Alpine (port `5432`).
- **Cloud Deployment (Planned)**:
  - Frontend: Vercel (static edge CDN hosting).
  - Backend: Render or Railway (containerized FastAPI instance).
  - Database: Neon Serverless PostgreSQL.
