from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, Field


class QualityComponentBreakdown(BaseModel):
    """Component contribution from Data Quality Rules Engine."""
    score: float = Field(..., description="Raw quality score (0-100)")
    weight: float = Field(0.50, description="Weight factor in reliability formula")
    weighted_score: float = Field(..., description="Weight * score contribution")
    total_rules: int = Field(..., description="Total enabled quality rules evaluated")
    passed_rules: int = Field(..., description="Number of passed rules")
    failed_rules: int = Field(..., description="Number of failed rules")
    description: str = Field(..., description="Human-readable explanation of quality component")


class CompletenessComponentBreakdown(BaseModel):
    """Component contribution based on dataset missingness."""
    score: float = Field(..., description="Raw completeness score (0-100, where 100 is fully complete)")
    weight: float = Field(0.25, description="Weight factor in reliability formula")
    weighted_score: float = Field(..., description="Weight * score contribution")
    missing_percentage: float = Field(..., description="Overall missing percentage across all cells")
    total_cells: int = Field(..., description="Total cells (rows * columns)")
    missing_cells: int = Field(..., description="Total missing cells")
    description: str = Field(..., description="Human-readable explanation of completeness component")


class AnomalyHealthComponentBreakdown(BaseModel):
    """Component contribution from Statistical Anomaly Detection."""
    score: float = Field(..., description="Raw anomaly health score (0-100, where 100 is no anomalies)")
    weight: float = Field(0.25, description="Weight factor in reliability formula")
    weighted_score: float = Field(..., description="Weight * score contribution")
    anomaly_percentage: float = Field(..., description="Percentage of detected anomalous observations")
    total_anomalies: int = Field(..., description="Total detected anomalies in numeric columns")
    total_numeric_values: int = Field(..., description="Total numeric observations evaluated")
    description: str = Field(..., description="Human-readable explanation of anomaly health component")


class ReliabilityComponents(BaseModel):
    """Structured breakdown of the three core reliability dimensions."""
    quality: QualityComponentBreakdown
    completeness: CompletenessComponentBreakdown
    anomaly_health: AnomalyHealthComponentBreakdown


class ReliabilityScoreResponse(BaseModel):
    """Overall DataTrust dataset reliability score and explainable component breakdown."""
    dataset_id: uuid.UUID = Field(..., description="Dataset unique identifier")
    dataset_name: str = Field(..., description="Dataset name")
    reliability_score: float = Field(..., description="Composite reliability score between 0.0 and 100.0")
    reliability_level: str = Field(..., description="Classification: 'Excellent', 'Good', 'Fair', or 'Poor'")
    formula: str = Field(
        "Reliability Score = 0.50 * Quality + 0.25 * Completeness + 0.25 * Anomaly Health",
        description="Mathematical definition of the score"
    )
    components: ReliabilityComponents = Field(..., description="Detailed component breakdown")
    calculated_at: datetime = Field(..., description="UTC timestamp of score calculation")
