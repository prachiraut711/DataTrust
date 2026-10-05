from typing import List, Optional
import uuid
from pydantic import BaseModel, Field


class AnomalyColumnResult(BaseModel):
    """Anomaly detection results for a single numeric column."""
    column_name: str = Field(..., description="Target column name")
    data_type: str = Field(..., description="Column data type")
    total_values: int = Field(..., description="Count of non-null observations analyzed")
    anomaly_count: int = Field(..., description="Number of detected statistical anomalies")
    anomaly_percentage: float = Field(..., description="Percentage of values identified as anomalous")
    status: str = Field(..., description="Status of evaluation: 'success' or 'skipped'")
    message: Optional[str] = Field(None, description="Explanation message if evaluation was skipped")
    sample_anomalies: List[float] = Field(
        default_factory=list,
        description="Up to 5 representative anomalous sample values"
    )


class AnomalyDetectionResponse(BaseModel):
    """Aggregate anomaly detection summary across all numeric columns of a dataset."""
    dataset_id: uuid.UUID = Field(..., description="Unique dataset identifier")
    dataset_name: str = Field(..., description="Dataset name")
    total_numeric_columns: int = Field(..., description="Total numeric columns found in dataset")
    columns_analyzed: int = Field(..., description="Number of numeric columns successfully analyzed")
    total_anomalies: int = Field(..., description="Sum of all anomalies across all analyzed columns")
    overall_anomaly_percentage: float = Field(
        ...,
        description="Aggregate anomaly percentage over total evaluated observations"
    )
    contamination: float = Field(0.05, description="Contamination factor used for Isolation Forest")
    column_results: List[AnomalyColumnResult] = Field(
        default_factory=list,
        description="Per-column anomaly analysis breakdown"
    )
