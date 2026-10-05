from typing import List
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.quality_rule import (
    QualityEvaluationResponse,
    QualityRuleCreate,
    QualityRuleResponse,
    QualityRuleUpdate,
)
from app.services.quality.quality_service import quality_service

router = APIRouter(tags=["Quality Rules"])


@router.post(
    "/datasets/{dataset_id}/quality-rules",
    response_model=QualityRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a quality rule for a dataset",
)
def create_quality_rule(
    dataset_id: uuid.UUID,
    rule_in: QualityRuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QualityRuleResponse:
    """Create and configure a column validation assertion scoped to a user's dataset."""
    rule = quality_service.create_rule(
        db=db,
        user=current_user,
        dataset_id=dataset_id,
        rule_in=rule_in,
    )
    return QualityRuleResponse.model_validate(rule)


@router.get(
    "/datasets/{dataset_id}/quality-rules",
    response_model=List[QualityRuleResponse],
    summary="List quality rules for a dataset",
)
def list_quality_rules(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[QualityRuleResponse]:
    """Retrieve all validation rules configured for a specific dataset."""
    rules = quality_service.list_rules(
        db=db,
        user=current_user,
        dataset_id=dataset_id,
    )
    return [QualityRuleResponse.model_validate(r) for r in rules]


@router.put(
    "/datasets/{dataset_id}/quality-rules/{rule_id}",
    response_model=QualityRuleResponse,
    summary="Update a quality rule",
)
def update_quality_rule(
    dataset_id: uuid.UUID,
    rule_id: uuid.UUID,
    rule_in: QualityRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QualityRuleResponse:
    """Update configuration, name, or enabled state for a quality rule."""
    rule = quality_service.update_rule(
        db=db,
        user=current_user,
        dataset_id=dataset_id,
        rule_id=rule_id,
        rule_in=rule_in,
    )
    return QualityRuleResponse.model_validate(rule)


@router.delete(
    "/datasets/{dataset_id}/quality-rules/{rule_id}",
    summary="Delete a quality rule",
)
def delete_quality_rule(
    dataset_id: uuid.UUID,
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Permanently delete a quality rule."""
    quality_service.delete_rule(
        db=db,
        user=current_user,
        dataset_id=dataset_id,
        rule_id=rule_id,
    )
    return {
        "status": "success",
        "message": f"Quality rule {rule_id} successfully deleted.",
    }


@router.post(
    "/datasets/{dataset_id}/quality/evaluate",
    response_model=QualityEvaluationResponse,
    summary="Evaluate quality rules on dataset",
)
def evaluate_quality_rules(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QualityEvaluationResponse:
    """Execute all enabled quality rules against the dataset in DuckDB and return pass/fail reports and score."""
    return quality_service.evaluate_dataset(
        db=db,
        user=current_user,
        dataset_id=dataset_id,
    )


@router.post(
    "/datasets/{dataset_id}/quality-rules/evaluate",
    response_model=QualityEvaluationResponse,
    include_in_schema=False,
)
def evaluate_quality_rules_alias(
    dataset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QualityEvaluationResponse:
    """Alias for /datasets/{dataset_id}/quality/evaluate."""
    return quality_service.evaluate_dataset(
        db=db,
        user=current_user,
        dataset_id=dataset_id,
    )
