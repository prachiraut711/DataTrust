from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.quality_run import QualityRunCreate, QualityRunResponse
from app.services.history.history_service import history_service

router = APIRouter(tags=["Historical Quality Runs"])


@router.post(
    "/datasets/{dataset_id}/runs",
    response_model=QualityRunResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a new historical quality & reliability analysis run",
)
def create_quality_run(
    dataset_id: uuid.UUID,
    payload: Optional[QualityRunCreate] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QualityRunResponse:
    """Execute analysis and persist a summary snapshot of quality, completeness,

    anomaly health, and composite reliability metrics for the target dataset.
    """
    notes = payload.notes if payload else None
    run = history_service.create_run(
        db=db,
        user=current_user,
        dataset_id=dataset_id,
        notes=notes,
    )
    return QualityRunResponse.model_validate(run)


@router.get(
    "/datasets/{dataset_id}/runs",
    response_model=List[QualityRunResponse],
    status_code=status.HTTP_200_OK,
    summary="List historical quality runs for a dataset",
)
def list_quality_runs(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[QualityRunResponse]:
    """Retrieve historical analysis snapshots for a dataset, ordered newest first."""
    runs = history_service.list_runs(
        db=db,
        user=current_user,
        dataset_id=dataset_id,
    )
    return [QualityRunResponse.model_validate(r) for r in runs]


@router.get(
    "/datasets/{dataset_id}/runs/{run_id}",
    response_model=QualityRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve a specific historical quality run",
)
def get_quality_run(
    dataset_id: uuid.UUID,
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QualityRunResponse:
    """Retrieve a single historical analysis snapshot ensuring workspace and dataset ownership."""
    run = history_service.get_run(
        db=db,
        user=current_user,
        dataset_id=dataset_id,
        run_id=run_id,
    )
    return QualityRunResponse.model_validate(run)
