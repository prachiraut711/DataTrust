from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummaryResponse
from app.services.dashboard.dashboard_service import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/summary",
    response_model=DashboardSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve workspace dashboard overview and summary metrics",
)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummaryResponse:
    """Retrieve high-level workspace summary metrics for the DataTrust SaaS dashboard.

    Calculates:
    - Total datasets in workspace
    - Average reliability score across latest dataset snapshots
    - Count and list of datasets needing attention (score < 75)
    - Total runs completed in the last 7 days
    - Reliability tier distribution (Excellent, Good, Fair, Poor)
    - Workspace datasets overview sorted by reliability
    - Recent chronological activity feed
    """
    return dashboard_service.get_summary(db=db, user=current_user)
