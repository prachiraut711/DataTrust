import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.anomaly import AnomalyDetectionResponse
from app.services.anomaly.anomaly_service import anomaly_service
from app.services.datasets.dataset_service import dataset_service

router = APIRouter(tags=["Anomaly Detection"])


@router.post(
    "/datasets/{dataset_id}/anomalies/detect",
    response_model=AnomalyDetectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Detect statistical anomalies across numeric columns",
)
def detect_dataset_anomalies(
    dataset_id: uuid.UUID,
    contamination: float = Query(0.05, ge=0.01, le=0.5, description="Expected outlier contamination fraction"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnomalyDetectionResponse:
    """Run Isolation Forest algorithm on all numeric columns of the specified dataset.

    Ensures dataset ownership and workspace isolation. Returns per-column anomaly count,
    percentage, status, and sample anomaly values.
    """
    dataset = dataset_service.get_dataset(db, current_user, dataset_id)
    return anomaly_service.detect_anomalies(dataset=dataset, contamination=contamination)
