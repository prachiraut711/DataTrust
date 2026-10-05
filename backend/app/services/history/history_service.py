from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.quality_run import QualityRun
from app.models.user import User
from app.services.datasets.dataset_service import dataset_service
from app.services.reliability.reliability_service import reliability_service


class HistoryService:
    """Domain service managing persistence and retrieval of historical quality & reliability snapshots."""

    def create_run(
        self,
        db: Session,
        user: User,
        dataset_id: uuid.UUID,
        notes: Optional[str] = None,
    ) -> QualityRun:
        """Execute a full reliability analysis and persist a historical metric snapshot.

        Reuses the existing ReliabilityService as the single source of truth for all
        quality, completeness, anomaly, and reliability calculations.

        Args:
            db: Database session.
            user: Authenticated user (enforces workspace isolation).
            dataset_id: Target dataset UUID.
            notes: Optional annotations for this historical run.

        Returns:
            Newly created QualityRun model.
        """
        dataset = dataset_service.get_dataset(db, user, dataset_id)

        # 1. Reuse existing ReliabilityService (calculates quality, completeness, anomaly health)
        rel_result = reliability_service.calculate_reliability(db, user, dataset_id)

        # 2. Extract metrics
        row_cnt = dataset.row_count or 0
        col_cnt = dataset.column_count or 0

        # In case row_count/column_count were not stored, fall back to completeness metrics
        if row_cnt == 0 and rel_result.components.completeness.total_cells > 0:
            col_cnt = len(dataset.columns) if dataset.columns else 1
            row_cnt = rel_result.components.completeness.total_cells // max(1, col_cnt)

        run = QualityRun(
            dataset_id=dataset.id,
            workspace_id=dataset.workspace_id,
            row_count=row_cnt,
            column_count=col_cnt,
            quality_score=rel_result.components.quality.score,
            completeness_score=rel_result.components.completeness.score,
            anomaly_score=rel_result.components.anomaly_health.score,
            reliability_score=rel_result.reliability_score,
            anomaly_percentage=rel_result.components.anomaly_health.anomaly_percentage,
            notes=notes.strip() if notes else None,
        )

        db.add(run)
        db.commit()
        db.refresh(run)
        return run

    def list_runs(
        self,
        db: Session,
        user: User,
        dataset_id: uuid.UUID,
        limit: int = 50,
    ) -> List[QualityRun]:
        """List historical quality runs for a dataset, ordered newest first."""
        dataset = dataset_service.get_dataset(db, user, dataset_id)
        stmt = (
            select(QualityRun)
            .where(QualityRun.dataset_id == dataset.id)
            .order_by(QualityRun.created_at.desc())
            .limit(limit)
        )
        return list(db.execute(stmt).scalars().all())

    def get_run(
        self,
        db: Session,
        user: User,
        dataset_id: uuid.UUID,
        run_id: uuid.UUID,
    ) -> QualityRun:
        """Retrieve a specific historical run, validating dataset and workspace ownership."""
        dataset = dataset_service.get_dataset(db, user, dataset_id)
        stmt = select(QualityRun).where(
            QualityRun.id == run_id,
            QualityRun.dataset_id == dataset.id,
        )
        run = db.execute(stmt).scalar_one_or_none()
        if not run:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quality run not found.",
            )
        return run


history_service = HistoryService()
