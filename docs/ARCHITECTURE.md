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
                            │ HTTP / JSON API
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
│  (Relational Persistence) │ │    (In-Process OLAP)      │
└───────────────────────────┘ └───────────────────────────┘
```

---

## 2. Core Architectural Layers

### 2.1 Frontend Presentation Layer
- **Framework**: React 18 with TypeScript and Vite.
- **Styling & UI**: Tailwind CSS with custom HSL design tokens, standard shadcn/ui design patterns, and Lucide icons.
- **Routing**: React Router DOM (Single Page Application architecture).
- **Visualization (Planned)**: Recharts for quality metric timelines, distribution histograms, and anomaly scatter plots.

### 2.2 API & Application Service Layer
- **Framework**: FastAPI (Python 3.12).
- **Validation**: Pydantic v2 schemas and Pydantic Settings for centralized, type-safe configuration.
- **Modular Services**:
  - `profiling/`: Statistical schema inference, null counts, cardinalities, and quantiles.
  - `quality/`: Rule engine evaluating completeness, uniqueness, ranges, and schema drift.
  - `analytics/`: Aggregate metric generation and data health indexing.
  - `anomaly/`: Scikit-learn `IsolationForest` unsupervised outlier detection.
  - `ai/`: Gemini API integration explaining detected anomalies in plain language.

---

## 3. Dual Database Strategy: PostgreSQL vs. DuckDB

A foundational architectural decision in DataTrust is the **clear separation of operational metadata from analytical data processing**:

```
                       Application Needs
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   Operational / Relational              Analytical / OLAP
   • Users & Authentication              • Column-oriented aggregations
   • Dataset metadata manifests          • Parquet/CSV file scanning
   • Configured quality rules            • Summary statistics & quantiles
   • Historical run outcomes             • In-memory dataset profiling
            │                                     │
            ▼                                     ▼
       PostgreSQL                              DuckDB
  (Persistent Metadata)                  (Embedded Execution)
```

### Why PostgreSQL for Application Metadata?
1. **Relational Integrity**: Foreign key constraints between users, datasets, validation runs, and configured rules.
2. **ACID Transactions**: Reliable state management for dataset tracking, user sessions, and test run logs.
3. **Ecosystem & Cloud Ready**: Out-of-the-box support for managed database providers such as Neon, Supabase, or AWS RDS.

### Why DuckDB for Analytical Processing?
1. **Columnar Vectorized Engine**: Fast execution of aggregations (e.g., `APPROX_COUNT_DISTINCT`, quantiles, histograms) directly over raw tabular data.
2. **Native File Scanning**: Directly queries Parquet and CSV files on disk without loading entire datasets into RAM or requiring ingestion into PostgreSQL tables.
3. **In-Process & Zero Infrastructure Overhead**: Runs embedded inside the Python backend process. No distributed cluster (Spark/Trino), no separate server daemon, and zero networking latency.
4. **Clean Integration**: Seamless interoperability with Arrow, Pandas, and NumPy for downstream anomaly detection.

---

## 4. Infrastructure & Deployment Model

- **Local Development**: Managed via Docker Compose containing:
  - `datatrust-frontend`: Node builder + Nginx static server (port `3000` / `80`).
  - `datatrust-backend`: Uvicorn + FastAPI (port `8000`).
  - `datatrust-postgres`: PostgreSQL 16 Alpine (port `5432`).
- **Cloud Deployment (Planned)**:
  - Frontend: Vercel (static edge CDN hosting).
  - Backend: Render or Railway (containerized FastAPI instance).
  - Database: Neon Serverless PostgreSQL.
