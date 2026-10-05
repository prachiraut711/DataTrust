from dataclasses import dataclass
from pathlib import Path
from typing import List
import duckdb
from fastapi import HTTPException, status


@dataclass
class ColumnInspectionResult:
    column_name: str
    data_type: str
    null_count: int
    null_percentage: float
    distinct_count: int


@dataclass
class DatasetInspectionResult:
    row_count: int
    column_count: int
    columns: List[ColumnInspectionResult]


class DuckDBInspectionService:
    """Analytical inspection service utilizing embedded DuckDB to read and profile CSV and Parquet files."""

    def inspect_file(self, file_path: Path, file_format: str) -> DatasetInspectionResult:
        """Inspect a tabular dataset using in-process DuckDB queries without loading data into PostgreSQL.

        Args:
            file_path: Absolute path to the dataset file on disk.
            file_format: Either 'csv' or 'parquet'.

        Returns:
            DatasetInspectionResult containing row counts, column counts, and column-level metrics.
        """
        escaped_path = file_path.resolve().as_posix()
        fmt = file_format.lower()

        if fmt == "csv":
            read_expr = f"read_csv_auto('{escaped_path}')"
        elif fmt == "parquet":
            read_expr = f"read_parquet('{escaped_path}')"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format for analytical inspection: {file_format}",
            )

        conn = duckdb.connect()
        try:
            # 1. Total row count
            total_rows_res = conn.execute(f"SELECT COUNT(*) FROM {read_expr}").fetchone()
            total_rows = total_rows_res[0] if total_rows_res else 0

            # 2. Schema discovery (column names & inferred DuckDB data types)
            describe_rows = conn.execute(f"DESCRIBE SELECT * FROM {read_expr}").fetchall()
            column_count = len(describe_rows)

            columns: List[ColumnInspectionResult] = []
            for row in describe_rows:
                col_name = str(row[0])
                col_type = str(row[1])

                # Escape double quotes for DuckDB identifier
                safe_name = col_name.replace('"', '""')

                # Query null count and distinct count
                metrics_query = (
                    f'SELECT COUNT(*) - COUNT("{safe_name}"), '
                    f'COUNT(DISTINCT "{safe_name}") '
                    f'FROM {read_expr}'
                )
                metrics = conn.execute(metrics_query).fetchone()
                null_cnt = int(metrics[0]) if metrics and metrics[0] is not None else 0
                dist_cnt = int(metrics[1]) if metrics and metrics[1] is not None else 0

                null_pct = (
                    round((null_cnt / total_rows) * 100.0, 2)
                    if total_rows > 0
                    else 0.0
                )

                columns.append(
                    ColumnInspectionResult(
                        column_name=col_name,
                        data_type=col_type,
                        null_count=null_cnt,
                        null_percentage=null_pct,
                        distinct_count=dist_cnt,
                    )
                )

            return DatasetInspectionResult(
                row_count=total_rows,
                column_count=column_count,
                columns=columns,
            )

        except duckdb.Error as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"DuckDB failed to parse dataset file: {str(e)}",
            )
        finally:
            conn.close()


inspection_service = DuckDBInspectionService()
