import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DatasetColumnResponse(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    column_name: str = Field(..., description="Column header name")
    data_type: str = Field(..., description="Inferred data type by DuckDB")
    null_count: int = Field(..., description="Total count of null/missing values")
    null_percentage: float = Field(..., description="Percentage of null values in column")
    distinct_count: int = Field(..., description="Unique/distinct value count")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatasetResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str = Field(..., description="Human-readable dataset title")
    description: Optional[str] = Field(None, description="Optional dataset description")
    original_filename: str = Field(..., description="Original uploaded filename")
    stored_filename: str = Field(..., description="Sanitized stored filename")
    file_format: str = Field(..., description="File format ('csv' or 'parquet')")
    file_size: int = Field(..., description="File size in bytes")
    row_count: Optional[int] = Field(None, description="Total number of rows")
    column_count: Optional[int] = Field(None, description="Total number of columns")
    uploaded_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatasetDetailResponse(DatasetResponse):
    columns: List[DatasetColumnResponse] = Field(
        default_factory=list,
        description="List of column-level profiling metrics",
    )
