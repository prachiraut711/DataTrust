import io
import shutil
import tempfile
from pathlib import Path
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.services.storage.local_storage import storage_service


@pytest.fixture(autouse=True)
def isolated_storage_dir(monkeypatch):
    """Isolate uploaded dataset files to a temporary folder during test execution."""
    temp_dir = tempfile.mkdtemp()
    temp_path = Path(temp_dir)
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(temp_path))
    monkeypatch.setattr(storage_service, "base_dir", temp_path)
    yield temp_path
    shutil.rmtree(temp_dir, ignore_errors=True)


def get_auth_client(client: TestClient, email: str = "profiler@datatrust.io") -> tuple[dict, str]:
    """Helper to register and generate Authorization headers for a test user."""
    res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Data Scientist",
        },
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, token


def upload_sample_orders(client: TestClient, headers: dict) -> str:
    """Helper to upload the standard orders_sample.csv dataset."""
    sample_csv = Path(__file__).resolve().parent.parent.parent / "data" / "sample" / "orders_sample.csv"
    with open(sample_csv, "rb") as f:
        response = client.post(
            "/api/datasets",
            headers=headers,
            files={"file": ("orders_sample.csv", f, "text/csv")},
            data={"name": "Orders Master Dataset", "description": "E-commerce transactional sample"},
        )
    assert response.status_code == 201
    return response.json()["id"]


def test_unauthenticated_profile_access(client: TestClient):
    """Verify that profiling endpoint requires a valid JWT."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = client.get(f"/api/datasets/{fake_id}/profile")
    assert response.status_code == 401


def test_nonexistent_dataset_profile(client: TestClient):
    """Verify 404 is returned when profiling a nonexistent dataset ID."""
    headers, _ = get_auth_client(client, "user_nonexistent@datatrust.io")
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = client.get(f"/api/datasets/{fake_id}/profile", headers=headers)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_dataset_profile_ownership_isolation(client: TestClient):
    """Verify User B cannot access the profile of User A's dataset."""
    headers_a, _ = get_auth_client(client, "user_alice@datatrust.io")
    headers_b, _ = get_auth_client(client, "user_bob@datatrust.io")

    dataset_id = upload_sample_orders(client, headers_a)

    # Bob attempts to profile Alice's dataset
    response = client.get(f"/api/datasets/{dataset_id}/profile", headers=headers_b)
    assert response.status_code == 404


def test_orders_sample_csv_comprehensive_profile(client: TestClient):
    """Verify comprehensive profiling on orders_sample.csv, detecting real intentional quality anomalies."""
    headers, _ = get_auth_client(client, "lead_analyst@datatrust.io")
    dataset_id = upload_sample_orders(client, headers)

    response = client.get(f"/api/datasets/{dataset_id}/profile", headers=headers)
    assert response.status_code == 200
    data = response.json()

    # 1. Dataset-level statistics
    assert data["dataset_name"] == "Orders Master Dataset"
    assert data["file_format"] == "csv"
    assert data["total_rows"] == 150
    assert data["total_columns"] == 13
    assert data["duplicate_rows"] == 0
    assert data["duplicate_row_percentage"] == 0.0
    assert data["total_missing_values"] == 3
    assert data["missing_value_percentage"] == 0.15  # 3 / (150 * 13) * 100 = 0.1538% -> 0.15%
    assert data["numeric_columns"] == 5  # quantity, unit_price, discount, order_amount, customer_age
    assert data["categorical_columns"] == 7  # order_id, customer_id, country, product_category, payment_method, order_status, customer_email
    assert data["date_columns"] == 1  # order_date
    assert data["unique_value_columns"] == 3  # unit_price, order_amount, customer_email (all 150 distinct, 0 nulls)

    # 2. Verify column profiles
    col_profiles = {c["column_name"]: c for c in data["columns"]}
    assert len(col_profiles) == 13

    # Anomaly Check 1: Duplicate order_id (149 distinct out of 150)
    order_id_col = col_profiles["order_id"]
    assert order_id_col["inferred_category"] == "categorical"
    assert order_id_col["distinct_count"] == 149
    assert order_id_col["null_count"] == 0
    assert order_id_col["unique_percentage"] == 99.33

    # Anomaly Check 2: Missing customer_ids (3 nulls)
    cust_id_col = col_profiles["customer_id"]
    assert cust_id_col["null_count"] == 3
    assert cust_id_col["null_percentage"] == 2.0
    assert cust_id_col["distinct_count"] == 80

    # Anomaly Check 3: Numeric anomalies in order_amount (negative & extreme values)
    amount_col = col_profiles["order_amount"]
    assert amount_col["inferred_category"] == "numeric"
    num_stats = amount_col["numeric_statistics"]
    assert num_stats is not None
    assert num_stats["min"] == -1251.4  # Negative amount detected!
    assert num_stats["max"] == 98500.0  # Extreme outlier detected!
    assert num_stats["mean"] > 1000.0
    assert num_stats["median"] is not None
    assert num_stats["std_dev"] is not None
    assert len(num_stats["histogram"]) == 5  # 5 bins

    # Anomaly Check 4: Date profiling and future date in order_date
    date_col = col_profiles["order_date"]
    assert date_col["inferred_category"] == "date"
    date_stats = date_col["date_statistics"]
    assert date_stats is not None
    assert date_stats["earliest_date"] == "2024-01-01"
    assert date_stats["latest_date"] == "2027-11-20"
    assert date_stats["future_date_count"] == 1  # 2027 date detected!

    # Categorical Stats Check: payment_method top frequencies
    pm_col = col_profiles["payment_method"]
    assert pm_col["inferred_category"] == "categorical"
    cat_stats = pm_col["categorical_statistics"]
    assert cat_stats is not None
    assert cat_stats["distinct_count"] == 5
    assert cat_stats["most_common_value"] == "Bank Transfer"
    assert len(cat_stats["top_values"]) == 5
    top_pm = cat_stats["top_values"][0]
    assert top_pm["value"] == "Bank Transfer"
    assert top_pm["count"] == 34


def test_duplicate_row_detection(client: TestClient):
    """Verify that exact duplicate rows are accurately calculated and reported."""
    headers, _ = get_auth_client(client, "dupes_analyst@datatrust.io")

    # CSV with 4 total rows: 2 rows are identical duplicates
    csv_content = (
        b"sku,product,price\n"
        b"A1,Gadget,10.0\n"
        b"A1,Gadget,10.0\n"
        b"A2,Widget,25.0\n"
        b"A3,Gizmo,50.0\n"
    )
    res = client.post(
        "/api/datasets",
        headers=headers,
        files={"file": ("inventory.csv", io.BytesIO(csv_content), "text/csv")},
        data={"name": "Inventory with Dupes"},
    )
    dataset_id = res.json()["id"]

    profile_res = client.get(f"/api/datasets/{dataset_id}/profile", headers=headers)
    assert profile_res.status_code == 200
    data = profile_res.json()

    assert data["total_rows"] == 4
    assert data["total_columns"] == 3
    assert data["duplicate_rows"] == 1
    assert data["duplicate_row_percentage"] == 25.0


def test_parquet_dataset_profiling(client: TestClient, tmp_path: Path):
    """Verify that Parquet columnar files are correctly parsed and profiled by DuckDB."""
    headers, _ = get_auth_client(client, "parquet_profiler@datatrust.io")

    parquet_file = tmp_path / "telemetry.parquet"
    table = pa.Table.from_arrays(
        [
            pa.array([1, 2, 3, 4]),
            pa.array(["sensor_a", "sensor_b", "sensor_a", "sensor_c"]),
            pa.array([45.2, None, 88.7, 12.1]),
        ],
        names=["reading_id", "sensor_id", "temp_celsius"],
    )
    pq.write_table(table, parquet_file)

    with open(parquet_file, "rb") as f:
        res = client.post(
            "/api/datasets",
            headers=headers,
            files={"file": ("telemetry.parquet", f, "application/octet-stream")},
            data={"name": "IoT Telemetry"},
        )
    dataset_id = res.json()["id"]

    profile_res = client.get(f"/api/datasets/{dataset_id}/profile", headers=headers)
    assert profile_res.status_code == 200
    data = profile_res.json()

    assert data["file_format"] == "parquet"
    assert data["total_rows"] == 4
    assert data["total_columns"] == 3
    assert data["total_missing_values"] == 1

    col_map = {c["column_name"]: c for c in data["columns"]}
    assert col_map["temp_celsius"]["inferred_category"] == "numeric"
    assert col_map["temp_celsius"]["null_count"] == 1
    assert col_map["temp_celsius"]["numeric_statistics"]["min"] == 12.1
    assert col_map["temp_celsius"]["numeric_statistics"]["max"] == 88.7
