"""DataTrust SQLAlchemy ORM models package.

Database models for users, datasets, profiling runs, quality checks,
and anomaly runs will be registered here in upcoming phases.
"""
from app.database.session import Base

__all__ = ["Base"]
