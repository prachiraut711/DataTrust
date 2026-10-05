from datetime import datetime
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class QualityRunCreate(BaseModel):
    """Optional payload when manually requesting a historical quality run."""
    notes: Optional[str] = Field(None, max_length=500, description="Optional annotations for this analysis run")


class QualityRunResponse(BaseModel):
    """Historical quality and reliability run snapshot summary."""
    id: uuid.UUID = Field(..., description="Unique run identifier")
    dataset_id: uuid.UUID = Field(..., description="Target dataset identifier")
    workspace_id: uuid.UUID = Field(..., description="Associated workspace identifier")
    created_at: datetime = Field(..., description="Timestamp when the run was recorded")
    row_count: int = Field(..., description="Total rows in dataset at execution time")
    column_count: int = Field(..., description="Total columns in dataset at execution time")
    quality_score: float = Field(..., description="Quality rules compliance score (0-100)")
    completeness_score: float = Field(..., description="Data completeness score (0-100)")
    anomaly_score: float = Field(..., description="Statistical anomaly health score (0-100)")
    reliability_score: float = Field(..., description="Composite reliability score (0-100)")
    anomaly_percentage: float = Field(..., description="Percentage of anomalous values across numeric columns")
    notes: Optional[str] = Field(None, description="Optional run notes")

    model_config = ConfigDict(from_attributes=True)


class QualityRunListResponse(BaseModel):
    """List response of historical runs for a dataset."""
    runs: List[QualityRunResponse] = Field(default_factory=list, description="Historical quality runs (newest first)")
    total: int = Field(..., description="Total number of historical runs recorded")
