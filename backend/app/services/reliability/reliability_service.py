from datetime import datetime, timezone
import uuid
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.reliability import (
    AnomalyHealthComponentBreakdown,
    CompletenessComponentBreakdown,
    QualityComponentBreakdown,
    ReliabilityComponents,
    ReliabilityScoreResponse,
)
from app.services.anomaly.anomaly_service import anomaly_service
from app.services.datasets.dataset_service import dataset_service
from app.services.profiling.profiling_service import profiling_service
from app.services.quality.quality_service import quality_service


class ReliabilityService:
    """Service responsible for calculating the explainable DataTrust composite reliability score."""

    def calculate_reliability(
        self,
        db: Session,
        user: User,
        dataset_id: uuid.UUID,
    ) -> ReliabilityScoreResponse:
        """Calculate the comprehensive reliability score combining quality, completeness, and anomaly health.

        Formula:
            Reliability Score = 0.50 * Quality + 0.25 * Completeness + 0.25 * Anomaly Health

        Args:
            db: Database session.
            user: Authenticated user (enforces workspace isolation).
            dataset_id: Target dataset UUID.

        Returns:
            ReliabilityScoreResponse detailing individual components and final rating.
        """
        dataset = dataset_service.get_dataset(db, user, dataset_id)

        # 1. Profile Dataset (Completeness Dimension)
        profile = profiling_service.profile_dataset(dataset)
        missing_pct = profile.missing_value_percentage
        raw_completeness = round(max(0.0, min(100.0, 100.0 - missing_pct)), 2)
        weighted_completeness = round(0.25 * raw_completeness, 2)
        total_cells = profile.total_rows * profile.total_columns

        completeness_component = CompletenessComponentBreakdown(
            score=raw_completeness,
            weight=0.25,
            weighted_score=weighted_completeness,
            missing_percentage=missing_pct,
            total_cells=total_cells,
            missing_cells=profile.total_missing_values,
            description=(
                f"{raw_completeness}% completeness across {total_cells} data cells "
                f"({missing_pct}% missing values detected)."
            ),
        )

        # 2. Quality Rules Evaluation (Quality Dimension)
        quality_eval = quality_service.evaluate_dataset(db, user, dataset_id)
        raw_quality = quality_eval.summary.quality_score
        weighted_quality = round(0.50 * raw_quality, 2)

        if quality_eval.summary.total_rules > 0:
            quality_desc = (
                f"{quality_eval.summary.passed_rules} of {quality_eval.summary.total_rules} "
                f"active quality rule checks passed ({raw_quality}% rule compliance)."
            )
        else:
            quality_desc = (
                "No quality rules configured or enabled; default full compliance score assigned."
            )

        quality_component = QualityComponentBreakdown(
            score=raw_quality,
            weight=0.50,
            weighted_score=weighted_quality,
            total_rules=quality_eval.summary.total_rules,
            passed_rules=quality_eval.summary.passed_rules,
            failed_rules=quality_eval.summary.failed_rules,
            description=quality_desc,
        )

        # 3. Anomaly Detection (Anomaly Health Dimension)
        anomaly_res = anomaly_service.detect_anomalies(dataset)
        anomaly_pct = anomaly_res.overall_anomaly_percentage
        # Anomaly Health = max(0, 100 - anomaly_pct * 10)
        raw_anomaly_health = round(max(0.0, min(100.0, 100.0 - (anomaly_pct * 10.0))), 2)
        weighted_anomaly_health = round(0.25 * raw_anomaly_health, 2)

        total_numeric_obs = sum(
            c.total_values for c in anomaly_res.column_results if c.status == "success"
        )

        if anomaly_res.columns_analyzed > 0:
            anomaly_desc = (
                f"{anomaly_res.total_anomalies} anomalies ({anomaly_pct}%) detected "
                f"across {anomaly_res.columns_analyzed} numeric columns."
            )
        else:
            anomaly_desc = (
                "No numeric columns with sufficient observations for anomaly detection; full health score assigned."
            )

        anomaly_component = AnomalyHealthComponentBreakdown(
            score=raw_anomaly_health,
            weight=0.25,
            weighted_score=weighted_anomaly_health,
            anomaly_percentage=anomaly_pct,
            total_anomalies=anomaly_res.total_anomalies,
            total_numeric_values=total_numeric_obs,
            description=anomaly_desc,
        )

        # 4. Composite Reliability Score
        composite_score = round(
            max(0.0, min(100.0, (0.50 * raw_quality) + (0.25 * raw_completeness) + (0.25 * raw_anomaly_health))),
            2,
        )

        if composite_score >= 90.0:
            level = "Excellent"
        elif composite_score >= 75.0:
            level = "Good"
        elif composite_score >= 60.0:
            level = "Fair"
        else:
            level = "Poor"

        return ReliabilityScoreResponse(
            dataset_id=dataset.id,
            dataset_name=dataset.name,
            reliability_score=composite_score,
            reliability_level=level,
            formula="Reliability Score = 0.50 * Quality + 0.25 * Completeness + 0.25 * Anomaly Health",
            components=ReliabilityComponents(
                quality=quality_component,
                completeness=completeness_component,
                anomaly_health=anomaly_component,
            ),
            calculated_at=datetime.now(timezone.utc),
        )


reliability_service = ReliabilityService()
