from datetime import datetime
from typing import List, Literal
from pydantic import BaseModel, Field


class AIKeyIssue(BaseModel):
    """Specific data issue detected by DataTrust engines and explained by Gemini."""

    title: str = Field(
        ...,
        description="Concise descriptive title of the quality or reliability issue",
        examples=["Elevated missing values in critical identifier column"],
    )
    explanation: str = Field(
        ...,
        description="Detailed explanation of the issue, root causes, and business/analytical impact",
    )
    severity: Literal["high", "medium", "low"] = Field(
        ...,
        description="Severity classification: 'high', 'medium', or 'low'",
        examples=["high"],
    )


class AIQualityExplanation(BaseModel):
    """Comprehensive AI-generated plain-language synthesis of DataTrust quality & reliability analysis."""

    summary: str = Field(
        ...,
        description="High-level executive summary of dataset health, suitability, and readiness",
    )
    key_issues: List[AIKeyIssue] = Field(
        default_factory=list,
        description="Prioritized list of key data quality, completeness, and anomaly concerns",
    )
    recommendations: List[str] = Field(
        default_factory=list,
        description="Actionable, prioritized steps to remediate data defects or improve quality pipelines",
    )
    reliability_explanation: str = Field(
        ...,
        description="Clear plain-language explanation of why the reliability score was assessed at its current value",
    )
    generated_at: datetime = Field(
        ...,
        description="UTC timestamp indicating when this explanation was produced",
    )
