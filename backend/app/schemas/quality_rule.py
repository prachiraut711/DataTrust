from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SUPPORTED_RULE_TYPES = {
    "not_null",
    "unique",
    "numeric_range",
    "allowed_values",
    "email_format",
    "no_future_dates",
}


def validate_rule_config(rule_type: str, config: Dict[str, Any]) -> Dict[str, Any]:
    """Validate rule configuration based on rule_type and raise ValueError if invalid."""
    r_type = rule_type.lower()
    if r_type not in SUPPORTED_RULE_TYPES:
        allowed = ", ".join(sorted(SUPPORTED_RULE_TYPES))
        raise ValueError(f"Unsupported rule_type '{rule_type}'. Supported types: {allowed}")

    if r_type == "numeric_range":
        min_val = config.get("min")
        max_val = config.get("max")

        if min_val is None and max_val is None:
            raise ValueError("Numeric range rule requires at least one of 'min' or 'max'.")

        if min_val is not None and not isinstance(min_val, (int, float)):
            raise ValueError("'min' must be a numeric value.")
        if max_val is not None and not isinstance(max_val, (int, float)):
            raise ValueError("'max' must be a numeric value.")

        if min_val is not None and max_val is not None:
            if float(min_val) > float(max_val):
                raise ValueError(f"'min' ({min_val}) cannot be greater than 'max' ({max_val}).")

        return {"min": float(min_val) if min_val is not None else None, "max": float(max_val) if max_val is not None else None}

    elif r_type == "allowed_values":
        allowed = config.get("allowed_values")
        if not isinstance(allowed, list) or len(allowed) == 0:
            raise ValueError("Allowed values rule requires a non-empty 'allowed_values' list.")

        str_allowed = [str(v).strip() for v in allowed if str(v).strip()]
        if len(str_allowed) == 0:
            raise ValueError("Allowed values rule list cannot contain only whitespace/empty values.")

        return {"allowed_values": str_allowed}

    else:
        # not_null, unique, email_format, no_future_dates
        return {}


class QualityRuleCreate(BaseModel):
    """Schema for creating a new quality validation rule."""

    column_name: str = Field(..., min_length=1, max_length=255)
    rule_type: str = Field(..., min_length=1, max_length=50)
    rule_name: str = Field(..., min_length=1, max_length=255)
    configuration: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True

    @field_validator("rule_type")
    @classmethod
    def normalize_rule_type(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean == "required":
            clean = "not_null"
        if clean not in SUPPORTED_RULE_TYPES:
            allowed = ", ".join(sorted(SUPPORTED_RULE_TYPES))
            raise ValueError(f"Invalid rule_type '{v}'. Allowed types: {allowed}")
        return clean

    @model_validator(mode="after")
    def validate_configuration(self) -> "QualityRuleCreate":
        self.configuration = validate_rule_config(self.rule_type, self.configuration)
        return self


class QualityRuleUpdate(BaseModel):
    """Schema for updating an existing quality validation rule."""

    rule_name: Optional[str] = Field(None, min_length=1, max_length=255)
    configuration: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None


class QualityRuleResponse(BaseModel):
    """API response model for a quality rule."""

    id: uuid.UUID
    dataset_id: uuid.UUID
    column_name: str
    rule_type: str
    rule_name: str
    configuration: Dict[str, Any]
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QualityRuleResult(BaseModel):
    """Evaluation output for an individual quality rule."""

    rule_id: uuid.UUID
    rule_name: str
    rule_type: str
    column_name: str
    status: str  # "PASS" | "FAIL" | "SKIPPED"
    total_rows: int
    passed_rows: int
    failed_rows: int
    failure_percentage: float
    message: str
    duplicate_count: Optional[int] = None


class QualitySummary(BaseModel):
    """Summary roll-up of quality execution and composite quality score."""

    total_rules: int
    passed_rules: int
    failed_rules: int
    skipped_rules: int
    total_rows: int
    total_issues: int
    quality_score: float


class QualityEvaluationResponse(BaseModel):
    """Complete evaluation report combining summary and per-rule results."""

    summary: QualitySummary
    results: List[QualityRuleResult]
