from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, Field


class ReliabilityDistribution(BaseModel):
    """Distribution of datasets across DataTrust reliability tiers."""

    excellent: int = Field(0, description="Count of datasets with latest score >= 90")
    good: int = Field(0, description="Count of datasets with latest score >= 75 and < 90")
    fair: int = Field(0, description="Count of datasets with latest score >= 60 and < 75")
    poor: int = Field(0, description="Count of datasets with latest score < 60")


class DashboardDatasetItem(BaseModel):
    """Dataset summary item for dashboard tables and overview charts."""

    dataset_id: uuid.UUID
    name: str
    file_format: str
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    reliability_score: Optional[float] = None
    reliability_level: Optional[str] = None  # "Excellent" | "Good" | "Fair" | "Poor" | None
    quality_score: Optional[float] = None
    completeness_score: Optional[float] = None
    anomaly_score: Optional[float] = None
    anomaly_percentage: Optional[float] = None
    last_run_at: Optional[datetime] = None
    has_runs: bool = False


class DashboardRecentActivityItem(BaseModel):
    """Chronological quality run activity item."""

    run_id: uuid.UUID
    dataset_id: uuid.UUID
    dataset_name: str
    reliability_score: float
    reliability_level: str
    quality_score: float
    completeness_score: float
    anomaly_score: float
    created_at: datetime
    notes: Optional[str] = None


class DashboardSummaryResponse(BaseModel):
    """High-level SaaS dashboard summary metrics and datasets overview."""

    total_datasets: int
    average_reliability: Optional[float] = None  # null if no datasets have runs
    datasets_needing_attention: int  # count of datasets with latest score < 75
    recent_runs: int  # count of runs in the last 7 days
    reliability_distribution: ReliabilityDistribution
    datasets: List[DashboardDatasetItem] = Field(default_factory=list)
    recent_activity: List[DashboardRecentActivityItem] = Field(default_factory=list)
    needs_attention: List[DashboardDatasetItem] = Field(default_factory=list)
