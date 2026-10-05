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


def get_auth_client(client: TestClient, email: str = "history_tester@datatrust.io") -> tuple[dict, str]:
    """Helper to register and generate Authorization headers for a test user."""
    res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "History QA Engineer",
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
            data={"name": "Orders Dataset", "description": "History Testing Sample"},
        )
    assert response.status_code == 201
    return response.json()["id"]


def test_unauthenticated_history_access(client: TestClient):
    """Verify history endpoints reject unauthenticated requests with 401."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    res1 = client.post(f"/api/datasets/{fake_id}/runs")
    assert res1.status_code == 401

    res2 = client.get(f"/api/datasets/{fake_id}/runs")
    assert res2.status_code == 401

    res3 = client.get(f"/api/datasets/{fake_id}/runs/{fake_id}")
    assert res3.status_code == 401


def test_workspace_isolation_history(client: TestClient):
    """Ensure User B cannot create or view historical runs on User A's dataset."""
    headers_user1, _ = get_auth_client(client, "user1_hist@datatrust.io")
    headers_user2, _ = get_auth_client(client, "user2_hist@datatrust.io")

    dataset_id = upload_sample_orders(client, headers_user1)

    # User 1 creates a run
    res_create = client.post(f"/api/datasets/{dataset_id}/runs", headers=headers_user1)
    assert res_create.status_code == 201
    run_id = res_create.json()["id"]

    # User 2 tries to list runs
    res_list = client.get(f"/api/datasets/{dataset_id}/runs", headers=headers_user2)
    assert res_list.status_code == 404
    assert res_list.json()["detail"] == "Dataset not found."

    # User 2 tries to fetch the run
    res_get = client.get(f"/api/datasets/{dataset_id}/runs/{run_id}", headers=headers_user2)
    assert res_get.status_code == 404

    # User 2 tries to create a run on User 1's dataset
    res_post = client.post(f"/api/datasets/{dataset_id}/runs", headers=headers_user2)
    assert res_post.status_code == 404


def test_create_and_list_quality_runs(client: TestClient):
    """Verify creating historical runs and listing them in descending order."""
    headers, _ = get_auth_client(client, "runner@datatrust.io")
    dataset_id = upload_sample_orders(client, headers)

    # 1. Create first run with notes
    res1 = client.post(
        f"/api/datasets/{dataset_id}/runs",
        headers=headers,
        json={"notes": "Initial baseline run"},
    )
    assert res1.status_code == 201
    run1 = res1.json()

    assert run1["dataset_id"] == dataset_id
    assert run1["row_count"] == 150
    assert run1["column_count"] >= 10
    assert 0.0 <= run1["quality_score"] <= 100.0
    assert 0.0 <= run1["completeness_score"] <= 100.0
    assert 0.0 <= run1["anomaly_score"] <= 100.0
    assert 0.0 <= run1["reliability_score"] <= 100.0
    assert run1["anomaly_percentage"] >= 0.0
    assert run1["notes"] == "Initial baseline run"
    assert "created_at" in run1

    # 2. Create second run without notes
    res2 = client.post(
        f"/api/datasets/{dataset_id}/runs",
        headers=headers,
    )
    assert res2.status_code == 201
    run2 = res2.json()
    assert run2["id"] != run1["id"]
    assert run2["notes"] is None

    # 3. List historical runs
    res_list = client.get(f"/api/datasets/{dataset_id}/runs", headers=headers)
    assert res_list.status_code == 200
    runs = res_list.json()
    assert len(runs) == 2

    # Newest run appears first
    assert runs[0]["id"] == run2["id"]
    assert runs[1]["id"] == run1["id"]
    assert runs[0]["created_at"] >= runs[1]["created_at"]


def test_get_specific_quality_run(client: TestClient):
    """Verify retrieving a single historical run by its UUID."""
    headers, _ = get_auth_client(client, "fetcher@datatrust.io")
    dataset_id = upload_sample_orders(client, headers)

    res_create = client.post(
        f"/api/datasets/{dataset_id}/runs",
        headers=headers,
        json={"notes": "Detailed snapshot"},
    )
    run_id = res_create.json()["id"]

    res_get = client.get(f"/api/datasets/{dataset_id}/runs/{run_id}", headers=headers)
    assert res_get.status_code == 200
    run_data = res_get.json()

    assert run_data["id"] == run_id
    assert run_data["dataset_id"] == dataset_id
    assert run_data["notes"] == "Detailed snapshot"
    assert run_data["reliability_score"] > 0.0


def test_invalid_run_access(client: TestClient):
    """Ensure requesting a nonexistent run ID returns 404."""
    headers, _ = get_auth_client(client, "notfound@datatrust.io")
    dataset_id = upload_sample_orders(client, headers)

    fake_run_id = "00000000-0000-0000-0000-000000000000"
    res = client.get(f"/api/datasets/{dataset_id}/runs/{fake_run_id}", headers=headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "Quality run not found."


def test_no_raw_data_storage(client: TestClient):
    """Verify historical run records store only summary metrics without raw tabular rows or sample values."""
    headers, _ = get_auth_client(client, "summary_check@datatrust.io")
    dataset_id = upload_sample_orders(client, headers)

    res = client.post(f"/api/datasets/{dataset_id}/runs", headers=headers)
    assert res.status_code == 201
    run_data = res.json()

    forbidden_keys = {"rows", "raw_data", "violations", "sample_anomalies", "outliers"}
    for k in forbidden_keys:
        assert k not in run_data
