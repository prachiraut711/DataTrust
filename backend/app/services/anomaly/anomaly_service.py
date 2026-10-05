import math
from typing import List, Optional
import duckdb
from fastapi import HTTPException, status
import numpy as np
from sklearn.ensemble import IsolationForest

from app.models.dataset import Dataset
from app.schemas.anomaly import AnomalyColumnResult, AnomalyDetectionResponse
from app.services.storage.local_storage import storage_service


def is_numeric_duckdb_type(duckdb_type: str) -> bool:
    """Determine whether a DuckDB column type is numeric."""
    t = duckdb_type.upper()
    return any(k in t for k in ["INT", "DOUBLE", "FLOAT", "DECIMAL", "NUMERIC", "REAL"])


class AnomalyService:
    """Service for statistical anomaly detection on tabular dataset columns using Isolation Forest."""

    def detect_anomalies(
        self,
        dataset: Dataset,
        contamination: float = 0.05,
        random_state: int = 42,
    ) -> AnomalyDetectionResponse:
        """Run statistical anomaly detection across all numeric columns of a dataset.

        Args:
            dataset: The target Dataset SQLAlchemy model.
            contamination: Expected proportion of outliers in the data (default: 0.05).
            random_state: Deterministic random seed for reproducibility (default: 42).

        Returns:
            AnomalyDetectionResponse with overall metrics and per-column results.
        """
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
                detail=f"Unsupported file format for anomaly detection: {dataset.file_format}",
            )

        conn = duckdb.connect()
        try:
            describe_rows = conn.execute(f"DESCRIBE SELECT * FROM {read_expr}").fetchall()

            numeric_columns: List[tuple[str, str]] = []
            for row in describe_rows:
                col_name = str(row[0])
                col_type = str(row[1])
                if is_numeric_duckdb_type(col_type):
                    numeric_columns.append((col_name, col_type))

            column_results: List[AnomalyColumnResult] = []

            for col_name, col_type in numeric_columns:
                safe_name = col_name.replace('"', '""')
                # Extract non-null numeric values
                query = f'SELECT "{safe_name}"::DOUBLE FROM {read_expr} WHERE "{safe_name}" IS NOT NULL'
                rows = conn.execute(query).fetchall()

                valid_vals: List[float] = []
                for r in rows:
                    if r is not None and r[0] is not None:
                        try:
                            val = float(r[0])
                            if not (math.isnan(val) or math.isinf(val)):
                                valid_vals.append(val)
                        except (ValueError, TypeError):
                            continue

                total_observations = len(valid_vals)

                # Skip if insufficient observations (< 10 required)
                if total_observations < 10:
                    column_results.append(
                        AnomalyColumnResult(
                            column_name=col_name,
                            data_type=col_type,
                            total_values=total_observations,
                            anomaly_count=0,
                            anomaly_percentage=0.0,
                            status="skipped",
                            message=f"Insufficient observations ({total_observations} < 10 required for Isolation Forest)",
                            sample_anomalies=[],
                        )
                    )
                    continue

                # Run Isolation Forest on 1D feature
                try:
                    X = np.array(valid_vals, dtype=np.float64).reshape(-1, 1)
                    model = IsolationForest(
                        contamination=contamination,
                        random_state=random_state,
                    )
                    preds = model.fit_predict(X)
                    decision_scores = model.decision_function(X)

                    # Anomaly prediction is -1 in scikit-learn Isolation Forest
                    anomaly_indices = np.where(preds == -1)[0]
                    anomaly_count = int(len(anomaly_indices))
                    anomaly_percentage = round((anomaly_count / total_observations) * 100.0, 2)

                    # Sort anomalies by decision score ascending (most extreme outliers first)
                    sorted_indices = sorted(anomaly_indices, key=lambda idx: float(decision_scores[idx]))
                    sample_anomalies: List[float] = []
                    seen_samples = set()
                    for s_idx in sorted_indices:
                        raw_val = round(float(valid_vals[s_idx]), 4)
                        if raw_val not in seen_samples:
                            seen_samples.add(raw_val)
                            sample_anomalies.append(raw_val)
                        if len(sample_anomalies) >= 5:
                            break

                    column_results.append(
                        AnomalyColumnResult(
                            column_name=col_name,
                            data_type=col_type,
                            total_values=total_observations,
                            anomaly_count=anomaly_count,
                            anomaly_percentage=anomaly_percentage,
                            status="success",
                            message=None,
                            sample_anomalies=sample_anomalies,
                        )
                    )
                except Exception as exc:
                    column_results.append(
                        AnomalyColumnResult(
                            column_name=col_name,
                            data_type=col_type,
                            total_values=total_observations,
                            anomaly_count=0,
                            anomaly_percentage=0.0,
                            status="skipped",
                            message=f"Model evaluation skipped: {str(exc)}",
                            sample_anomalies=[],
                        )
                    )

            total_numeric_columns = len(numeric_columns)
            analyzed_columns = [c for c in column_results if c.status == "success"]
            columns_analyzed = len(analyzed_columns)
            total_anomalies = sum(c.anomaly_count for c in analyzed_columns)
            total_analyzed_values = sum(c.total_values for c in analyzed_columns)

            overall_anomaly_pct = (
                round((total_anomalies / total_analyzed_values) * 100.0, 2)
                if total_analyzed_values > 0
                else 0.0
            )

            return AnomalyDetectionResponse(
                dataset_id=dataset.id,
                dataset_name=dataset.name,
                total_numeric_columns=total_numeric_columns,
                columns_analyzed=columns_analyzed,
                total_anomalies=total_anomalies,
                overall_anomaly_percentage=overall_anomaly_pct,
                contamination=contamination,
                column_results=column_results,
            )
        finally:
            conn.close()


anomaly_service = AnomalyService()
