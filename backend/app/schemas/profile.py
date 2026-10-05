import uuid
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TopCategoryValue(BaseModel):
    """Frequency count for a top categorical value."""

    value: str
    count: int
    percentage: float


class CategoricalStatistics(BaseModel):
    """Descriptive statistics for categorical and text columns."""

    distinct_count: int
    top_values: List[TopCategoryValue] = Field(default_factory=list)
    most_common_value: Optional[str] = None


class HistogramBucket(BaseModel):
    """Distribution bucket for numeric column histogram."""

    bucket_label: str
    min_value: float
    max_value: float
    count: int


class NumericStatistics(BaseModel):
    """Descriptive statistics for numeric columns."""

    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None
    median: Optional[float] = None
    std_dev: Optional[float] = None
    histogram: List[HistogramBucket] = Field(default_factory=list)


class DateStatistics(BaseModel):
    """Descriptive statistics for temporal/date columns."""

    earliest_date: Optional[str] = None
    latest_date: Optional[str] = None
    future_date_count: int = 0


class ColumnProfile(BaseModel):
    """Comprehensive statistical profile for a single column."""

    column_name: str
    column_index: int
    data_type: str
    inferred_category: str  # "numeric" | "categorical" | "date" | "other"
    null_count: int
    null_percentage: float
    distinct_count: int
    unique_percentage: float
    numeric_statistics: Optional[NumericStatistics] = None
    categorical_statistics: Optional[CategoricalStatistics] = None
    date_statistics: Optional[DateStatistics] = None


class DatasetProfileResponse(BaseModel):
    """Complete dataset profile combining high-level summary and column distributions."""

    dataset_id: uuid.UUID
    dataset_name: str
    file_format: str
    file_size: int
    total_rows: int
    total_columns: int
    duplicate_rows: int
    duplicate_row_percentage: float
    total_missing_values: int
    missing_value_percentage: float
    numeric_columns: int
    categorical_columns: int
    date_columns: int
    other_columns: int
    unique_value_columns: int
    columns: List[ColumnProfile]

    model_config = ConfigDict(from_attributes=True)
