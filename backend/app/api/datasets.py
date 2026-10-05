import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.dataset import DatasetDetailResponse, DatasetResponse
from app.schemas.profile import DatasetProfileResponse
from app.services.datasets.dataset_service import dataset_service
from app.services.profiling.profiling_service import profiling_service

router = APIRouter(prefix="/datasets", tags=["Datasets"])


@router.post(
    "",
    response_model=DatasetDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest a dataset",
)
def upload_dataset(
    file: UploadFile = File(..., description="CSV or Parquet dataset file"),
    name: str = Form(..., min_length=1, max_length=255, description="Dataset title"),
    description: Optional[str] = Form(None, description="Optional description"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DatasetDetailResponse:
    """Ingest a CSV or Parquet file, compute schema and null distributions with DuckDB, and store metadata."""
    dataset = dataset_service.upload_dataset(
        db=db,
        user=current_user,
        file=file,
        name=name,
        description=description,
    )
    return DatasetDetailResponse.model_validate(dataset)


@router.get(
    "",
    response_model=List[DatasetResponse],
    summary="List authenticated user's datasets",
)
def list_datasets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[DatasetResponse]:
    """Retrieve all datasets belonging to the workspaces of the authenticated user."""
    datasets = dataset_service.list_datasets(db=db, user=current_user)
    return [DatasetResponse.model_validate(d) for d in datasets]


@router.get(
    "/{dataset_id}",
    response_model=DatasetDetailResponse,
    summary="Get dataset details and column profiling",
)
def get_dataset(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DatasetDetailResponse:
    """Retrieve detailed metadata and column-level metrics for a specific dataset."""
    dataset = dataset_service.get_dataset(db=db, user=current_user, dataset_id=dataset_id)
    return DatasetDetailResponse.model_validate(dataset)


@router.get(
    "/{dataset_id}/profile",
    response_model=DatasetProfileResponse,
    summary="Get statistical profile of dataset",
)
def get_dataset_profile(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DatasetProfileResponse:
    """Compute and retrieve comprehensive statistical profile including distributions, quantiles, and frequencies."""
    dataset = dataset_service.get_dataset(db=db, user=current_user, dataset_id=dataset_id)
    return profiling_service.profile_dataset(dataset)


@router.delete(
    "/{dataset_id}",
    summary="Delete a dataset",
)
def delete_dataset(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Permanently delete a dataset, its column metadata, and the underlying file."""
    dataset_service.delete_dataset(db=db, user=current_user, dataset_id=dataset_id)
    return {
        "status": "success",
        "message": f"Dataset {dataset_id} successfully deleted.",
    }
