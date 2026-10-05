from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.dataset import Dataset
from app.models.quality_run import QualityRun
from app.models.user import User
from app.schemas.dashboard import (
    DashboardDatasetItem,
    DashboardRecentActivityItem,
    DashboardSummaryResponse,
    ReliabilityDistribution,
)
from app.services.datasets.dataset_service import dataset_service


class DashboardService:
    """Domain service for aggregating workspace-level SaaS dashboard metrics and summaries."""

    def get_summary(self, db: Session, user: User) -> DashboardSummaryResponse:
        """Aggregate high-level overview metrics across the authenticated user's workspace.

        Performance & Privacy rules:
        - Only aggregates metadata and stored QualityRun snapshot summaries.
        - Does NOT parse raw files or execute heavy DuckDB/IsolationForest computations.
        - Strict workspace isolation enforced.
        """
        workspace = dataset_service.get_user_workspace(db, user)

        # 1. Fetch datasets for this workspace with their runs loaded
        stmt = (
            select(Dataset)
            .where(Dataset.workspace_id == workspace.id)
            .options(selectinload(Dataset.quality_runs))
            .order_by(Dataset.uploaded_at.desc())
        )
        datasets = list(db.execute(stmt).scalars().all())
        total_datasets = len(datasets)

        # 2. Extract latest run for each dataset
        dataset_items: List[DashboardDatasetItem] = []
        for ds in datasets:
            # Sort runs defensively by created_at desc, id desc
            sorted_runs = sorted(
                ds.quality_runs,
                key=lambda r: (r.created_at, str(r.id)),
                reverse=True,
            )
            latest_run: Optional[QualityRun] = sorted_runs[0] if sorted_runs else None

            if latest_run:
                rel_score = latest_run.reliability_score
                if rel_score >= 90.0:
                    level = "Excellent"
                elif rel_score >= 75.0:
                    level = "Good"
                elif rel_score >= 60.0:
                    level = "Fair"
                else:
                    level = "Poor"

                dataset_items.append(
                    DashboardDatasetItem(
                        dataset_id=ds.id,
                        name=ds.name,
                        file_format=ds.file_format,
                        row_count=latest_run.row_count or ds.row_count,
                        column_count=latest_run.column_count or ds.column_count,
                        reliability_score=rel_score,
                        reliability_level=level,
                        quality_score=latest_run.quality_score,
                        completeness_score=latest_run.completeness_score,
                        anomaly_score=latest_run.anomaly_score,
                        anomaly_percentage=latest_run.anomaly_percentage,
                        last_run_at=latest_run.created_at,
                        has_runs=True,
                    )
                )
            else:
                dataset_items.append(
                    DashboardDatasetItem(
                        dataset_id=ds.id,
                        name=ds.name,
                        file_format=ds.file_format,
                        row_count=ds.row_count,
                        column_count=ds.column_count,
                        reliability_score=None,
                        reliability_level=None,
                        quality_score=None,
                        completeness_score=None,
                        anomaly_score=None,
                        anomaly_percentage=None,
                        last_run_at=None,
                        has_runs=False,
                    )
                )

        # 3. Calculate Average Reliability across datasets that have at least one run
        analyzed_items = [d for d in dataset_items if d.has_runs and d.reliability_score is not None]
        if analyzed_items:
            avg_rel = round(sum(d.reliability_score for d in analyzed_items) / len(analyzed_items), 1)
        else:
            avg_rel = None

        # 4. Compute Reliability Distribution across latest dataset runs
        dist = {"excellent": 0, "good": 0, "fair": 0, "poor": 0}
        for d in analyzed_items:
            score = d.reliability_score
            if score is not None:
                if score >= 90.0:
                    dist["excellent"] += 1
                elif score >= 75.0:
                    dist["good"] += 1
                elif score >= 60.0:
                    dist["fair"] += 1
                else:
                    dist["poor"] += 1

        reliability_distribution = ReliabilityDistribution(**dist)

        # 5. Datasets Needing Attention (latest reliability score < 75)
        needs_attention = [
            d for d in analyzed_items if d.reliability_score is not None and d.reliability_score < 75.0
        ]
        # Sort lowest score first
        needs_attention.sort(key=lambda d: d.reliability_score or 0.0)
        datasets_needing_attention = len(needs_attention)

        # 6. Recent Runs Count (last 7 days)
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        recent_runs_count = db.execute(
            select(func.count(QualityRun.id))
            .where(
                QualityRun.workspace_id == workspace.id,
                QualityRun.created_at >= seven_days_ago,
            )
        ).scalar() or 0

        # 7. Recent Activity Feed (up to 10 latest runs across workspace)
        activity_stmt = (
            select(QualityRun, Dataset.name.label("dataset_name"))
            .join(Dataset, QualityRun.dataset_id == Dataset.id)
            .where(QualityRun.workspace_id == workspace.id)
            .order_by(QualityRun.created_at.desc(), QualityRun.id.desc())
            .limit(10)
        )
        activity_rows = db.execute(activity_stmt).all()
        recent_activity: List[DashboardRecentActivityItem] = [
            DashboardRecentActivityItem(
                run_id=run.id,
                dataset_id=run.dataset_id,
                dataset_name=ds_name,
                reliability_score=run.reliability_score,
                reliability_level=(
                    "Excellent" if run.reliability_score >= 90.0
                    else "Good" if run.reliability_score >= 75.0
                    else "Fair" if run.reliability_score >= 60.0
                    else "Poor"
                ),
                quality_score=run.quality_score,
                completeness_score=run.completeness_score,
                anomaly_score=run.anomaly_score,
                created_at=run.created_at,
                notes=run.notes,
            )
            for run, ds_name in activity_rows
        ]

        # 8. Sort datasets for the overview chart: highest reliability first, then unanalyzed
        sorted_datasets = sorted(
            dataset_items,
            key=lambda d: (d.has_runs, d.reliability_score or 0.0),
            reverse=True,
        )

        return DashboardSummaryResponse(
            total_datasets=total_datasets,
            average_reliability=avg_rel,
            datasets_needing_attention=datasets_needing_attention,
            recent_runs=recent_runs_count,
            reliability_distribution=reliability_distribution,
            datasets=sorted_datasets,
            recent_activity=recent_activity,
            needs_attention=needs_attention,
        )


dashboard_service = DashboardService()
