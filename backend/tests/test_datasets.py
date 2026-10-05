import io
import shutil
import tempfile
from pathlib import Path
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.services.datasets.inspection_service import inspection_service
from app.services.storage.local_storage import storage_service


@pytest.fixture(autouse=True)
def isolated_storage_dir(monkeypatch):
    """Use a temporary directory for file uploads during test runs and clean it up afterwards."""
    temp_dir = tempfile.mkdtemp()
    temp_path = Path(temp_dir)
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(temp_path))
    monkeypatch.setattr(storage_service, "base_dir", temp_path)
    yield temp_path
    shutil.rmtree(temp_dir, ignore_errors=True)


def get_authenticated_client(client: TestClient, email: str = "analyst@datatrust.io") -> tuple[dict, str]:
    """Helper to register and obtain auth headers for a test user."""
    res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Test Analyst",
        },
    )
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return headers, token


def test_duckdb_reads_sample_csv():
    """Verify that DuckDB directly reads and computes accurate column metrics on the sample CSV dataset."""
    sample_csv = Path(__file__).resolve().parent.parent.parent / "data" / "sample" / "orders_sample.csv"
    assert sample_csv.exists(), "orders_sample.csv should exist in data/sample"

    result = inspection_service.inspect_file(sample_csv, "csv")
    assert result.row_count == 150
    assert result.column_count == 13

    col_map = {c.column_name: c for c in result.columns}
    assert "order_id" in col_map
    assert "customer_id" in col_map
    assert "order_amount" in col_map

    # Verification of intentional anomalies:
    # 1. order_id has 1 duplicate (149 distinct out of 150)
    assert col_map["order_id"].distinct_count == 149

    # 2. customer_id has exactly 3 NULL values (2.0% null rate)
    assert col_map["customer_id"].null_count == 3
    assert col_map["customer_id"].null_percentage == 2.0


def test_duckdb_reads_generated_parquet(tmp_path: Path):
    """Verify DuckDB can read and inspect binary Parquet datasets."""
    parquet_path = tmp_path / "test_data.parquet"
    table = pa.Table.from_arrays(
        [
            pa.array([1, 2, 3, 4, 5]),
            pa.array(["alpha", "beta", None, "delta", "epsilon"]),
            pa.array([10.5, 20.0, 30.5, None, 50.0]),
        ],
        names=["id", "label", "score"],
    )
    pq.write_table(table, parquet_path)

    result = inspection_service.inspect_file(parquet_path, "parquet")
    assert result.row_count == 5
    assert result.column_count == 3

    col_map = {c.column_name: c for c in result.columns}
    assert col_map["id"].null_count == 0
    assert col_map["label"].null_count == 1
    assert col_map["label"].null_percentage == 20.0
    assert col_map["score"].null_count == 1


def test_unauthenticated_dataset_upload(client: TestClient):
    """Verify that dataset upload requires authentication."""
    files = {"file": ("test.csv", io.BytesIO(b"id,name\n1,Alpha"), "text/csv")}
    response = client.post("/api/datasets", files=files, data={"name": "Test"})
    assert response.status_code == 401


def test_unsupported_file_extension(client: TestClient):
    """Verify that uploading an unsupported file format (.xlsx, .json) is rejected."""
    headers, _ = get_authenticated_client(client, "user_ext@datatrust.io")
    files = {"file": ("data.xlsx", io.BytesIO(b"fake excel content"), "application/vnd.ms-excel")}
    response = client.post("/api/datasets", headers=headers, files=files, data={"name": "Spreadsheet"})
    assert response.status_code == 400
    assert "unsupported file format" in response.json()["detail"].lower()


def test_empty_file_upload(client: TestClient):
    """Verify that uploading an empty file (0 bytes) is rejected."""
    headers, _ = get_authenticated_client(client, "user_empty@datatrust.io")
    files = {"file": ("empty.csv", io.BytesIO(b""), "text/csv")}
    response = client.post("/api/datasets", headers=headers, files=files, data={"name": "Empty"})
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_successful_csv_upload(client: TestClient):
    """Verify successful CSV upload, storage, DuckDB profiling, and metadata creation."""
    headers, _ = get_authenticated_client(client, "csv_user@datatrust.io")
    csv_content = b"user_id,username,age,status\n101,alice,28,active\n102,bob,,active\n103,charlie,35,inactive\n"
    files = {"file": ("users.csv", io.BytesIO(csv_content), "text/csv")}

    response = client.post(
        "/api/datasets",
        headers=headers,
        files=files,
        data={"name": "User Master", "description": "Customer demographics table"},
    )
    assert response.status_code == 201
    data = response.json()

    assert data["name"] == "User Master"
    assert data["description"] == "Customer demographics table"
    assert data["original_filename"] == "users.csv"
    assert data["file_format"] == "csv"
    assert data["row_count"] == 3
    assert data["column_count"] == 4
    assert len(data["columns"]) == 4

    col_map = {c["column_name"]: c for c in data["columns"]}
    assert "age" in col_map
    assert col_map["age"]["null_count"] == 1
    assert col_map["age"]["null_percentage"] == 33.33


def test_successful_parquet_upload(client: TestClient):
    """Verify successful Parquet file upload, storage, and column ingestion."""
    headers, _ = get_authenticated_client(client, "parquet_user@datatrust.io")

    # Generate small parquet in-memory buffer
    buf = io.BytesIO()
    table = pa.Table.from_arrays(
        [pa.array([1, 2, 3]), pa.array([100.0, 200.0, 300.0])],
        names=["id", "metric"],
    )
    pq.write_table(table, buf)
    buf.seek(0)

    files = {"file": ("metrics.parquet", buf, "application/octet-stream")}
    response = client.post(
        "/api/datasets",
        headers=headers,
        files=files,
        data={"name": "Parquet Metrics", "description": "Columnar test"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["file_format"] == "parquet"
    assert data["row_count"] == 3
    assert data["column_count"] == 2


def test_dataset_listing_and_details(client: TestClient):
    """Verify dataset listing returns user's datasets and GET /api/datasets/{id} returns columns."""
    headers, _ = get_authenticated_client(client, "list_user@datatrust.io")

    # Upload two datasets
    csv1 = b"col1,col2\n1,a\n2,b\n"
    csv2 = b"x,y,z\n10,20,30\n"

    client.post("/api/datasets", headers=headers, files={"file": ("ds1.csv", io.BytesIO(csv1), "text/csv")}, data={"name": "DS 1"})
    res2 = client.post("/api/datasets", headers=headers, files={"file": ("ds2.csv", io.BytesIO(csv2), "text/csv")}, data={"name": "DS 2"})
    ds2_id = res2.json()["id"]

    # List datasets
    list_res = client.get("/api/datasets", headers=headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert len(list_data) == 2
    assert {d["name"] for d in list_data} == {"DS 1", "DS 2"}

    # Fetch specific dataset details
    detail_res = client.get(f"/api/datasets/{ds2_id}", headers=headers)
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["name"] == "DS 2"
    assert detail_data["column_count"] == 3
    assert len(detail_data["columns"]) == 3


def test_unauthorized_dataset_access(client: TestClient):
    """Verify that User B cannot view or delete User A's dataset."""
    headers_a, _ = get_authenticated_client(client, "user_a@datatrust.io")
    headers_b, _ = get_authenticated_client(client, "user_b@datatrust.io")

    # User A uploads dataset
    csv_data = b"secret_id,val\n1,classified\n"
    res_a = client.post(
        "/api/datasets",
        headers=headers_a,
        files={"file": ("secret.csv", io.BytesIO(csv_data), "text/csv")},
        data={"name": "Classified Data"},
    )
    dataset_id = res_a.json()["id"]

    # User B tries to view User A's dataset
    get_res = client.get(f"/api/datasets/{dataset_id}", headers=headers_b)
    assert get_res.status_code in (403, 404)

    # User B tries to delete User A's dataset
    del_res = client.delete(f"/api/datasets/{dataset_id}", headers=headers_b)
    assert del_res.status_code in (403, 404)


def test_dataset_deletion(client: TestClient):
    """Verify dataset deletion removes both database metadata and file on disk."""
    headers, _ = get_authenticated_client(client, "del_user@datatrust.io")

    csv_data = b"col1,col2\n10,20\n"
    res = client.post(
        "/api/datasets",
        headers=headers,
        files={"file": ("to_delete.csv", io.BytesIO(csv_data), "text/csv")},
        data={"name": "To Delete"},
    )
    dataset_id = res.json()["id"]
    stored_filename = res.json()["stored_filename"]

    # Check file exists on disk
    stored_path = storage_service.get_file_path(stored_filename)
    assert stored_path.exists()

    # Delete dataset
    del_res = client.delete(f"/api/datasets/{dataset_id}", headers=headers)
    assert del_res.status_code == 200

    # Ensure file is removed from disk
    assert not stored_path.exists()

    # Ensure dataset is no longer accessible via API
    get_res = client.get(f"/api/datasets/{dataset_id}", headers=headers)
    assert get_res.status_code == 404
