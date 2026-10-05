import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.ai import AIQualityExplanation
from app.services.ai.gemini_service import gemini_service

router = APIRouter(tags=["AI Quality Explanation"])


@router.post(
    "/datasets/{dataset_id}/ai/explanation",
    response_model=AIQualityExplanation,
    status_code=status.HTTP_200_OK,
    summary="Generate plain-language AI explanation of dataset quality and reliability",
)
def generate_dataset_explanation(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIQualityExplanation:
    """Generate plain-language explanation of data quality, completeness, anomalies,

    and overall reliability using Google Gemini.

    Strict security boundaries:
    - User authentication and workspace isolation are enforced (returns 404 for inaccessible datasets).
    - NEVER sends raw dataset rows, file contents, or credentials to Gemini.
    - Returns 503 if GEMINI_API_KEY is not configured or if AI service is temporarily unavailable.
    """
    return gemini_service.explain_dataset(
        db=db,
        user=current_user,
        dataset_id=dataset_id,
    )
