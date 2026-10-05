import math
from typing import List, Optional
import duckdb
from fastapi import HTTPException, status

from app.models.dataset import Dataset
from app.schemas.profile import (
    CategoricalStatistics,
    ColumnProfile,
    DateStatistics,
    DatasetProfileResponse,
    HistogramBucket,
    NumericStatistics,
    TopCategoryValue,
)
from app.services.storage.local_storage import storage_service


def sanitize_float(val: Optional[float], round_digits: int = 4) -> Optional[float]:
    """Sanitize floating point numbers to ensure valid JSON compliance (no NaN/Inf)."""
    if val is None:
        return None
    try:
        f_val = float(val)
        if math.isnan(f_val) or math.isinf(f_val):
            return None
        return round(f_val, round_digits)
    except (ValueError, TypeError):
        return None


class ProfilingService:
    """Analytical profiling engine leveraging embedded DuckDB to calculate dataset and column distributions."""

    def classify_data_type(self, duckdb_type: str) -> str:
        """Classify a DuckDB data type into 'numeric', 'categorical', 'date', or 'other'."""
        t = duckdb_type.upper()
        if any(k in t for k in ["INT", "DOUBLE", "FLOAT", "DECIMAL", "NUMERIC", "REAL"]):
            return "numeric"
        elif any(k in t for k in ["DATE", "TIME"]):
            return "date"
        elif any(k in t for k in ["VARCHAR", "TEXT", "CHAR", "STRING", "UUID", "BOOL", "ENUM"]):
            return "categorical"
        return "other"

    def profile_dataset(self, dataset: Dataset) -> DatasetProfileResponse:
        """Compute comprehensive statistical profile for a given dataset using DuckDB.

        Args:
            dataset: The target Dataset SQLAlchemy model.

        Returns:
            DatasetProfileResponse containing high-level summary and detailed column distributions.
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
                detail=f"Unsupported file format for profiling: {dataset.file_format}",
            )

        conn = duckdb.connect()
        try:
            # 1. Total row count
            total_rows_res = conn.execute(f"SELECT COUNT(*) FROM {read_expr}").fetchone()
            total_rows = int(total_rows_res[0]) if total_rows_res and total_rows_res[0] is not None else 0

            # 2. Duplicate rows (exact row match across all columns)
            if total_rows > 0:
                distinct_rows_res = conn.execute(
                    f"SELECT COUNT(*) FROM (SELECT DISTINCT * FROM {read_expr})"
                ).fetchone()
                distinct_rows = int(distinct_rows_res[0]) if distinct_rows_res and distinct_rows_res[0] is not None else 0
                duplicate_rows = max(0, total_rows - distinct_rows)
                duplicate_row_percentage = round((duplicate_rows / total_rows) * 100.0, 2)
            else:
                duplicate_rows = 0
                duplicate_row_percentage = 0.0

            # 3. Schema discovery
            describe_rows = conn.execute(f"DESCRIBE SELECT * FROM {read_expr}").fetchall()
            total_columns = len(describe_rows)

            column_profiles: List[ColumnProfile] = []
            numeric_count = 0
            categorical_count = 0
            date_count = 0
            other_count = 0
            unique_value_columns = 0

            for idx, row in enumerate(describe_rows):
                col_name = str(row[0])
                col_type = str(row[1])
                category = self.classify_data_type(col_type)

                if category == "numeric":
                    numeric_count += 1
                elif category == "categorical":
                    categorical_count += 1
                elif category == "date":
                    date_count += 1
                else:
                    other_count += 1

                # Safe identifier for SQL
                safe_name = col_name.replace('"', '""')

                # Base column metrics: nulls and distinct count
                base_metrics_query = (
                    f'SELECT COUNT(*) - COUNT("{safe_name}"), '
                    f'COUNT(DISTINCT "{safe_name}") '
                    f'FROM {read_expr}'
                )
                base_metrics = conn.execute(base_metrics_query).fetchone()
                null_cnt = int(base_metrics[0]) if base_metrics and base_metrics[0] is not None else 0
                dist_cnt = int(base_metrics[1]) if base_metrics and base_metrics[1] is not None else 0

                null_pct = round((null_cnt / total_rows) * 100.0, 2) if total_rows > 0 else 0.0
                uniq_pct = round((dist_cnt / total_rows) * 100.0, 2) if total_rows > 0 else 0.0

                if total_rows > 0 and dist_cnt == total_rows and null_cnt == 0:
                    unique_value_columns += 1

                num_stats: Optional[NumericStatistics] = None
                cat_stats: Optional[CategoricalStatistics] = None
                dt_stats: Optional[DateStatistics] = None

                # Category-specific analytical calculations
                if category == "numeric":
                    num_query = (
                        f'SELECT '
                        f'MIN("{safe_name}")::DOUBLE, '
                        f'MAX("{safe_name}")::DOUBLE, '
                        f'AVG("{safe_name}")::DOUBLE, '
                        f'MEDIAN("{safe_name}")::DOUBLE, '
                        f'STDDEV_SAMP("{safe_name}")::DOUBLE '
                        f'FROM {read_expr}'
                    )
                    n_res = conn.execute(num_query).fetchone()
                    if n_res:
                        min_val = sanitize_float(n_res[0])
                        max_val = sanitize_float(n_res[1])
                        mean_val = sanitize_float(n_res[2])
                        median_val = sanitize_float(n_res[3])
                        std_dev_val = sanitize_float(n_res[4])

                        # Build 5-bin histogram if numeric values exist
                        histogram_buckets: List[HistogramBucket] = []
                        valid_values_cnt = total_rows - null_cnt

                        if min_val is not None and max_val is not None and valid_values_cnt > 0:
                            if max_val > min_val:
                                num_bins = 5
                                span = max_val - min_val
                                step = span / num_bins

                                hist_query = (
                                    f'SELECT '
                                    f'LEAST(FLOOR((("{safe_name}" - {min_val}) / {span}) * {num_bins}), {num_bins - 1})::INTEGER as b_idx, '
                                    f'COUNT(*) as cnt '
                                    f'FROM {read_expr} '
                                    f'WHERE "{safe_name}" IS NOT NULL '
                                    f'GROUP BY b_idx '
                                    f'ORDER BY b_idx'
                                )
                                hist_rows = conn.execute(hist_query).fetchall()
                                count_map = {int(r[0]): int(r[1]) for r in hist_rows if r[0] is not None}

                                for b_i in range(num_bins):
                                    b_min = round(min_val + b_i * step, 2)
                                    b_max = round(min_val + (b_i + 1) * step, 2)
                                    label = f"{b_min} - {b_max}"
                                    histogram_buckets.append(
                                        HistogramBucket(
                                            bucket_label=label,
                                            min_value=b_min,
                                            max_value=b_max,
                                            count=count_map.get(b_i, 0),
                                        )
                                    )
                            else:
                                histogram_buckets.append(
                                    HistogramBucket(
                                        bucket_label=str(min_val),
                                        min_value=min_val,
                                        max_value=max_val,
                                        count=valid_values_cnt,
                                    )
                                )

                        num_stats = NumericStatistics(
                            min=min_val,
                            max=max_val,
                            mean=mean_val,
                            median=median_val,
                            std_dev=std_dev_val,
                            histogram=histogram_buckets,
                        )

                elif category == "categorical":
                    cat_query = (
                        f'SELECT "{safe_name}"::VARCHAR as val, COUNT(*) as cnt '
                        f'FROM {read_expr} '
                        f'WHERE "{safe_name}" IS NOT NULL '
                        f'GROUP BY "{safe_name}" '
                        f'ORDER BY cnt DESC '
                        f'LIMIT 5'
                    )
                    top_rows = conn.execute(cat_query).fetchall()
                    top_values: List[TopCategoryValue] = []
                    for t_row in top_rows:
                        val_str = str(t_row[0]) if t_row[0] is not None else "(empty)"
                        cnt_val = int(t_row[1]) if t_row[1] is not None else 0
                        pct = round((cnt_val / total_rows) * 100.0, 2) if total_rows > 0 else 0.0
                        top_values.append(
                            TopCategoryValue(
                                value=val_str,
                                count=cnt_val,
                                percentage=pct,
                            )
                        )
                    most_common = top_values[0].value if top_values else None
                    cat_stats = CategoricalStatistics(
                        distinct_count=dist_cnt,
                        top_values=top_values,
                        most_common_value=most_common,
                    )

                elif category == "date":
                    dt_query = (
                        f'SELECT '
                        f'MIN("{safe_name}")::VARCHAR, '
                        f'MAX("{safe_name}")::VARCHAR, '
                        f'COUNT(CASE WHEN "{safe_name}" > CURRENT_TIMESTAMP THEN 1 END) '
                        f'FROM {read_expr}'
                    )
                    dt_res = conn.execute(dt_query).fetchone()
                    earliest_date = str(dt_res[0]) if dt_res and dt_res[0] is not None else None
                    latest_date = str(dt_res[1]) if dt_res and dt_res[1] is not None else None
                    future_count = int(dt_res[2]) if dt_res and dt_res[2] is not None else 0

                    dt_stats = DateStatistics(
                        earliest_date=earliest_date,
                        latest_date=latest_date,
                        future_date_count=future_count,
                    )

                column_profiles.append(
                    ColumnProfile(
                        column_name=col_name,
                        column_index=idx,
                        data_type=col_type,
                        inferred_category=category,
                        null_count=null_cnt,
                        null_percentage=null_pct,
                        distinct_count=dist_cnt,
                        unique_percentage=uniq_pct,
                        numeric_statistics=num_stats,
                        categorical_statistics=cat_stats,
                        date_statistics=dt_stats,
                    )
                )

            total_missing_values = sum(c.null_count for c in column_profiles)
            total_cells = total_rows * total_columns
            missing_percentage = (
                round((total_missing_values / total_cells) * 100.0, 2)
                if total_cells > 0
                else 0.0
            )

            return DatasetProfileResponse(
                dataset_id=dataset.id,
                dataset_name=dataset.name,
                file_format=dataset.file_format,
                file_size=dataset.file_size,
                total_rows=total_rows,
                total_columns=total_columns,
                duplicate_rows=duplicate_rows,
                duplicate_row_percentage=duplicate_row_percentage,
                total_missing_values=total_missing_values,
                missing_value_percentage=missing_percentage,
                numeric_columns=numeric_count,
                categorical_columns=categorical_count,
                date_columns=date_count,
                other_columns=other_count,
                unique_value_columns=unique_value_columns,
                columns=column_profiles,
            )

        except duckdb.Error as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"DuckDB failed to profile dataset: {str(e)}",
            )
        finally:
            conn.close()


profiling_service = ProfilingService()
