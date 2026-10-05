import io
import shutil
import tempfile
from pathlib import Path
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


def get_auth_client(client: TestClient, email: str = "anomaly_tester@datatrust.io") -> tuple[dict, str]:
    """Helper to register and generate Authorization headers for a test user."""
    res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Anomaly QA Engineer",
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
            data={"name": "Orders Dataset", "description": "Anomaly Testing Sample"},
        )
    assert response.status_code == 201
    return response.json()["id"]


def test_unauthenticated_anomaly_access(client: TestClient):
    """Verify anomaly detection rejects unauthenticated requests with 401."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    res = client.post(f"/api/datasets/{fake_id}/anomalies/detect")
    assert res.status_code == 401


def test_workspace_isolation_anomaly(client: TestClient):
    """Ensure a user cannot run anomaly detection on another user's dataset."""
    headers_user1, _ = get_auth_client(client, "user1_anom@datatrust.io")
    headers_user2, _ = get_auth_client(client, "user2_anom@datatrust.io")

    dataset_id = upload_sample_orders(client, headers_user1)

    # User 2 tries to run anomaly detection
    res = client.post(f"/api/datasets/{dataset_id}/anomalies/detect", headers=headers_user2)
    assert res.status_code == 404
    assert res.json()["detail"] == "Dataset not found."


def test_anomaly_detection_on_sample_orders(client: TestClient):
    """Verify Isolation Forest anomaly detection executes properly on numeric columns."""
    headers, _ = get_auth_client(client, "sample_anom@datatrust.io")
    dataset_id = upload_sample_orders(client, headers)

    res = client.post(
        f"/api/datasets/{dataset_id}/anomalies/detect?contamination=0.05",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()

    assert data["dataset_id"] == dataset_id
    assert data["total_numeric_columns"] >= 5
    assert data["columns_analyzed"] >= 5
    assert data["total_anomalies"] > 0
    assert data["overall_anomaly_percentage"] > 0.0

    # Check order_amount column
    order_amount_res = next((c for c in data["column_results"] if c["column_name"] == "order_amount"), None)
    assert order_amount_res is not None
    assert order_amount_res["status"] == "success"
    assert order_amount_res["total_values"] == 150
    assert order_amount_res["anomaly_count"] > 0
    assert len(order_amount_res["sample_anomalies"]) > 0
    assert len(order_amount_res["sample_anomalies"]) <= 5
    # Extreme outlier 98500.0 or negative amounts should be detected
    samples = order_amount_res["sample_anomalies"]
    assert any(val > 10000 or val < 0 for val in samples)


def test_anomaly_detection_skips_insufficient_rows(client: TestClient):
    """Ensure columns with fewer than 10 non-null rows are safely skipped."""
    headers, _ = get_auth_client(client, "small_anom@datatrust.io")

    # CSV with only 5 rows
    csv_data = "id,score\n1,10.5\n2,12.0\n3,9.5\n4,11.2\n5,10.0\n"
    res_upload = client.post(
        "/api/datasets",
        headers=headers,
        files={"file": ("small.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")},
        data={"name": "Small Dataset", "description": "Insufficient rows"},
    )
    assert res_upload.status_code == 201
    dataset_id = res_upload.json()["id"]

    res = client.post(f"/api/datasets/{dataset_id}/anomalies/detect", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_numeric_columns"] == 2
    assert data["columns_analyzed"] == 0
    assert data["total_anomalies"] == 0

    for col in data["column_results"]:
        assert col["status"] == "skipped"
        assert "Insufficient observations" in col["message"]
        assert col["sample_anomalies"] == []


def test_anomaly_detection_non_numeric_dataset(client: TestClient):
    """Ensure datasets with zero numeric columns return cleanly without error."""
    headers, _ = get_auth_client(client, "text_anom@datatrust.io")

    # CSV with text only
    csv_data = "city,country\nNew York,USA\nLondon,UK\nTokyo,Japan\nParis,France\nBerlin,Germany\nRome,Italy\nMadrid,Spain\nSydney,Australia\nToronto,Canada\nOslo,Norway\n"
    res_upload = client.post(
        "/api/datasets",
        headers=headers,
        files={"file": ("text_only.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")},
        data={"name": "Text Only Dataset"},
    )
    assert res_upload.status_code == 201
    dataset_id = res_upload.json()["id"]

    res = client.post(f"/api/datasets/{dataset_id}/anomalies/detect", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_numeric_columns"] == 0
    assert data["columns_analyzed"] == 0
    assert data["total_anomalies"] == 0
    assert data["overall_anomaly_percentage"] == 0.0
    assert data["column_results"] == []
