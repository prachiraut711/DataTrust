from typing import List, Optional
import uuid
import duckdb
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.dataset import Dataset
from app.models.quality_rule import DatasetQualityRule
from app.models.user import User
from app.schemas.quality_rule import (
    QualityEvaluationResponse,
    QualityRuleCreate,
    QualityRuleResult,
    QualityRuleUpdate,
    QualitySummary,
    validate_rule_config,
)
from app.services.datasets.dataset_service import dataset_service
from app.services.profiling.profiling_service import profiling_service
from app.services.storage.local_storage import storage_service

EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"


class QualityService:
    """Domain service managing quality rules creation, updates, and DuckDB validation execution."""

    def create_rule(
        self,
        db: Session,
        user: User,
        dataset_id: uuid.UUID,
        rule_in: QualityRuleCreate,
    ) -> DatasetQualityRule:
        """Create a new data quality rule for a dataset after validating workspace ownership and columns."""
        dataset = dataset_service.get_dataset(db, user, dataset_id)

        # Verify that column exists on dataset
        col_names = {c.column_name for c in dataset.columns}
        if rule_in.column_name not in col_names:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Column '{rule_in.column_name}' does not exist in dataset '{dataset.name}'.",
            )

        rule = DatasetQualityRule(
            dataset_id=dataset.id,
            column_name=rule_in.column_name,
            rule_type=rule_in.rule_type,
            rule_name=rule_in.rule_name.strip(),
            configuration=rule_in.configuration,
            enabled=rule_in.enabled,
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return rule

    def list_rules(
        self,
        db: Session,
        user: User,
        dataset_id: uuid.UUID,
    ) -> List[DatasetQualityRule]:
        """List all quality rules configured for a dataset."""
        dataset = dataset_service.get_dataset(db, user, dataset_id)
        stmt = (
            select(DatasetQualityRule)
            .where(DatasetQualityRule.dataset_id == dataset.id)
            .order_by(DatasetQualityRule.created_at.asc())
        )
        return list(db.execute(stmt).scalars().all())

    def get_rule(
        self,
        db: Session,
        user: User,
        dataset_id: uuid.UUID,
        rule_id: uuid.UUID,
    ) -> DatasetQualityRule:
        """Retrieve a specific quality rule ensuring dataset and workspace ownership."""
        dataset = dataset_service.get_dataset(db, user, dataset_id)
        stmt = (
            select(DatasetQualityRule)
            .where(
                DatasetQualityRule.id == rule_id,
                DatasetQualityRule.dataset_id == dataset.id,
            )
        )
        rule = db.execute(stmt).scalar_one_or_none()
        if not rule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quality rule not found.",
            )
        return rule

    def update_rule(
        self,
        db: Session,
        user: User,
        dataset_id: uuid.UUID,
        rule_id: uuid.UUID,
        rule_in: QualityRuleUpdate,
    ) -> DatasetQualityRule:
        """Update an existing quality rule configuration."""
        rule = self.get_rule(db, user, dataset_id, rule_id)

        if rule_in.rule_name is not None:
            clean_name = rule_in.rule_name.strip()
            if not clean_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Rule name cannot be empty.",
                )
            rule.rule_name = clean_name

        if rule_in.configuration is not None:
            try:
                rule.configuration = validate_rule_config(rule.rule_type, rule_in.configuration)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e),
                )

        if rule_in.enabled is not None:
            rule.enabled = rule_in.enabled

        db.commit()
        db.refresh(rule)
        return rule

    def delete_rule(
        self,
        db: Session,
        user: User,
        dataset_id: uuid.UUID,
        rule_id: uuid.UUID,
    ) -> bool:
        """Delete a quality rule."""
        rule = self.get_rule(db, user, dataset_id, rule_id)
        db.delete(rule)
        db.commit()
        return True

    def evaluate_dataset(
        self,
        db: Session,
        user: User,
        dataset_id: uuid.UUID,
    ) -> QualityEvaluationResponse:
        """Execute all enabled quality rules against the source dataset using DuckDB.

        Args:
            db: Database session.
            user: Current authenticated user.
            dataset_id: Target dataset UUID.

        Returns:
            QualityEvaluationResponse containing roll-up summary and per-rule check results.
        """
        dataset = dataset_service.get_dataset(db, user, dataset_id)
        rules = self.list_rules(db, user, dataset_id)
        enabled_rules = [r for r in rules if r.enabled]

        if not enabled_rules:
            return QualityEvaluationResponse(
                summary=QualitySummary(
                    total_rules=len(rules),
                    passed_rules=0,
                    failed_rules=0,
                    skipped_rules=0,
                    total_rows=dataset.row_count or 0,
                    total_issues=0,
                    quality_score=100.0,
                ),
                results=[],
            )

        file_path = storage_service.get_file_path(dataset.stored_filename)
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset physical file not found on disk.",
            )

        fmt = dataset.file_format.lower()
        escaped_path = file_path.resolve().as_posix()

        if fmt == "csv":
            read_expr = f"read_csv_auto('{escaped_path}')"
        elif fmt == "parquet":
            read_expr = f"read_parquet('{escaped_path}')"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported format '{fmt}' for quality evaluation.",
            )

        conn = duckdb.connect()
        try:
            # 1. Total rows
            row_res = conn.execute(f"SELECT COUNT(*) FROM {read_expr}").fetchone()
            total_rows = int(row_res[0]) if row_res and row_res[0] is not None else 0

            # 2. Schema and type map
            describe_rows = conn.execute(f"DESCRIBE SELECT * FROM {read_expr}").fetchall()
            col_types = {str(r[0]): str(r[1]) for r in describe_rows}
            col_categories = {
                name: profiling_service.classify_data_type(dtype)
                for name, dtype in col_types.items()
            }

            results: List[QualityRuleResult] = []

            for rule in enabled_rules:
                col_name = rule.column_name
                safe_col = col_name.replace('"', '""')
                col_type = col_types.get(col_name)
                col_cat = col_categories.get(col_name, "other")

                # Column presence check
                if col_name not in col_types:
                    results.append(
                        QualityRuleResult(
                            rule_id=rule.id,
                            rule_name=rule.rule_name,
                            rule_type=rule.rule_type,
                            column_name=col_name,
                            status="SKIPPED",
                            total_rows=total_rows,
                            passed_rows=total_rows,
                            failed_rows=0,
                            failure_percentage=0.0,
                            message=f"Column '{col_name}' not found in source file.",
                        )
                    )
                    continue

                # Type applicability checks
                if rule.rule_type == "numeric_range" and col_cat != "numeric":
                    results.append(
                        QualityRuleResult(
                            rule_id=rule.id,
                            rule_name=rule.rule_name,
                            rule_type=rule.rule_type,
                            column_name=col_name,
                            status="SKIPPED",
                            total_rows=total_rows,
                            passed_rows=total_rows,
                            failed_rows=0,
                            failure_percentage=0.0,
                            message=f"Numeric range requires a numeric column, but '{col_name}' is {col_type}.",
                        )
                    )
                    continue

                if rule.rule_type == "no_future_dates" and col_cat != "date":
                    results.append(
                        QualityRuleResult(
                            rule_id=rule.id,
                            rule_name=rule.rule_name,
                            rule_type=rule.rule_type,
                            column_name=col_name,
                            status="SKIPPED",
                            total_rows=total_rows,
                            passed_rows=total_rows,
                            failed_rows=0,
                            failure_percentage=0.0,
                            message=f"No future dates requires a date/time column, but '{col_name}' is {col_type}.",
                        )
                    )
                    continue

                if rule.rule_type == "email_format" and col_cat not in ("categorical", "other"):
                    results.append(
                        QualityRuleResult(
                            rule_id=rule.id,
                            rule_name=rule.rule_name,
                            rule_type=rule.rule_type,
                            column_name=col_name,
                            status="SKIPPED",
                            total_rows=total_rows,
                            passed_rows=total_rows,
                            failed_rows=0,
                            failure_percentage=0.0,
                            message=f"Email format requires a text column, but '{col_name}' is {col_type}.",
                        )
                    )
                    continue

                # Execute dynamic DuckDB rule queries
                failed_count = 0
                dup_count: Optional[int] = None
                detail_msg = ""

                if rule.rule_type == "not_null":
                    q = f'SELECT COUNT(*) - COUNT("{safe_col}") FROM {read_expr}'
                    res = conn.execute(q).fetchone()
                    failed_count = int(res[0]) if res and res[0] is not None else 0
                    if failed_count == 0:
                        detail_msg = "All values are present (0 missing)."
                    else:
                        detail_msg = f"{failed_count} missing / null value(s) detected."

                elif rule.rule_type == "unique":
                    # Non-null values uniqueness check
                    q = f'SELECT COUNT("{safe_col}") - COUNT(DISTINCT "{safe_col}") FROM {read_expr}'
                    res = conn.execute(q).fetchone()
                    dup_count = int(res[0]) if res and res[0] is not None else 0
                    failed_count = dup_count
                    if failed_count == 0:
                        detail_msg = "All non-null values are unique (0 duplicates)."
                    else:
                        detail_msg = f"{dup_count} duplicate value(s) detected."

                elif rule.rule_type == "numeric_range":
                    cfg = rule.configuration or {}
                    min_val = cfg.get("min")
                    max_val = cfg.get("max")

                    if min_val is not None and max_val is not None:
                        cond = f'("{safe_col}" < {min_val} OR "{safe_col}" > {max_val})'
                        range_str = f"between {min_val} and {max_val}"
                    elif min_val is not None:
                        cond = f'("{safe_col}" < {min_val})'
                        range_str = f">= {min_val}"
                    else:
                        cond = f'("{safe_col}" > {max_val})'
                        range_str = f"<= {max_val}"

                    q = (
                        f'SELECT COUNT(CASE WHEN {cond} THEN 1 END) '
                        f'FROM {read_expr} '
                        f'WHERE "{safe_col}" IS NOT NULL'
                    )
                    res = conn.execute(q).fetchone()
                    failed_count = int(res[0]) if res and res[0] is not None else 0
                    if failed_count == 0:
                        detail_msg = f"All values conform to range ({range_str})."
                    else:
                        detail_msg = f"{failed_count} value(s) outside expected range ({range_str})."

                elif rule.rule_type == "allowed_values":
                    cfg = rule.configuration or {}
                    allowed_list = cfg.get("allowed_values", [])
                    if allowed_list:
                        safe_items = [str(v).replace("'", "''") for v in allowed_list]
                        escaped_vals = ", ".join(f"'{item}'" for item in safe_items)
                        q = (
                            f'SELECT COUNT(CASE WHEN "{safe_col}"::VARCHAR NOT IN ({escaped_vals}) THEN 1 END) '
                            f'FROM {read_expr} '
                            f'WHERE "{safe_col}" IS NOT NULL'
                        )
                        res = conn.execute(q).fetchone()
                        failed_count = int(res[0]) if res and res[0] is not None else 0
                    else:
                        failed_count = 0

                    if failed_count == 0:
                        detail_msg = f"All values match allowed set ({len(allowed_list)} categories)."
                    else:
                        detail_msg = f"{failed_count} value(s) outside allowed set."

                elif rule.rule_type == "email_format":
                    q = (
                        f'SELECT COUNT(CASE WHEN NOT regexp_matches("{safe_col}", \'{EMAIL_REGEX}\') THEN 1 END) '
                        f'FROM {read_expr} '
                        f'WHERE "{safe_col}" IS NOT NULL'
                    )
                    res = conn.execute(q).fetchone()
                    failed_count = int(res[0]) if res and res[0] is not None else 0
                    if failed_count == 0:
                        detail_msg = "All email addresses conform to standard email format."
                    else:
                        detail_msg = f"{failed_count} malformed email address(es) detected."

                elif rule.rule_type == "no_future_dates":
                    q = (
                        f'SELECT COUNT(CASE WHEN "{safe_col}" > CURRENT_TIMESTAMP THEN 1 END) '
                        f'FROM {read_expr} '
                        f'WHERE "{safe_col}" IS NOT NULL'
                    )
                    res = conn.execute(q).fetchone()
                    failed_count = int(res[0]) if res and res[0] is not None else 0
                    if failed_count == 0:
                        detail_msg = "All timestamps occur in past or present."
                    else:
                        detail_msg = f"{failed_count} timestamp(s) occur in the future."

                rule_status = "PASS" if failed_count == 0 else "FAIL"
                passed_rows = max(0, total_rows - failed_count)
                fail_pct = round((failed_count / total_rows) * 100.0, 2) if total_rows > 0 else 0.0

                results.append(
                    QualityRuleResult(
                        rule_id=rule.id,
                        rule_name=rule.rule_name,
                        rule_type=rule.rule_type,
                        column_name=col_name,
                        status=rule_status,
                        total_rows=total_rows,
                        passed_rows=passed_rows,
                        failed_rows=failed_count,
                        failure_percentage=fail_pct,
                        message=detail_msg,
                        duplicate_count=dup_count,
                    )
                )

            # Roll-up summary metrics
            total_rules_cnt = len(enabled_rules)
            passed_cnt = sum(1 for r in results if r.status == "PASS")
            failed_cnt = sum(1 for r in results if r.status == "FAIL")
            skipped_cnt = sum(1 for r in results if r.status == "SKIPPED")
            applicable_cnt = passed_cnt + failed_cnt
            quality_score = (
                round((passed_cnt / applicable_cnt) * 100.0, 1)
                if applicable_cnt > 0
                else 100.0
            )
            total_issues = sum(r.failed_rows for r in results if r.status == "FAIL")

            return QualityEvaluationResponse(
                summary=QualitySummary(
                    total_rules=total_rules_cnt,
                    passed_rules=passed_cnt,
                    failed_rules=failed_cnt,
                    skipped_rules=skipped_cnt,
                    total_rows=total_rows,
                    total_issues=total_issues,
                    quality_score=quality_score,
                ),
                results=results,
            )

        except duckdb.Error as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"DuckDB failed to evaluate quality rules: {str(e)}",
            )
        finally:
            conn.close()


quality_service = QualityService()
