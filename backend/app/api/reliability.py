import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.reliability import ReliabilityScoreResponse
from app.services.reliability.reliability_service import reliability_service

router = APIRouter(tags=["Reliability Score"])


@router.get(
    "/datasets/{dataset_id}/reliability",
    response_model=ReliabilityScoreResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute comprehensive DataTrust reliability score",
)
def get_dataset_reliability(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReliabilityScoreResponse:
    """Calculate the explainable composite reliability score (0-100) combining

    quality rules (50%), data completeness (25%), and statistical anomaly health (25%).
    Enforces user authentication and workspace isolation.
    """
    return reliability_service.calculate_reliability(
        db=db,
        user=current_user,
        dataset_id=dataset_id,
    )
