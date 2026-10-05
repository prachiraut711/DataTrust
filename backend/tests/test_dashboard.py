from datetime import datetime, timedelta, timezone
from pathlib import Path
import shutil
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.quality_run import QualityRun
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


def get_auth_client(client: TestClient, email: str = "dash_tester@datatrust.io") -> tuple[dict, str]:
    """Helper to register and generate Authorization headers for a test user."""
    res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Dashboard QA Engineer",
        },
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, token


def upload_sample_orders(client: TestClient, headers: dict, name: str = "Orders Dataset") -> str:
    """Helper to upload the standard orders_sample.csv dataset."""
    sample_csv = Path(__file__).resolve().parent.parent.parent / "data" / "sample" / "orders_sample.csv"
    with open(sample_csv, "rb") as f:
        response = client.post(
            "/api/datasets",
            headers=headers,
            files={"file": ("orders_sample.csv", f, "text/csv")},
            data={"name": name, "description": "Dashboard Testing Sample"},
        )
    assert response.status_code == 201
    return response.json()["id"]


def test_unauthenticated_dashboard_access(client: TestClient):
    """Verify dashboard summary rejects unauthenticated requests with 401."""
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 401


def test_empty_workspace_dashboard(client: TestClient):
    """Verify dashboard summary for a brand-new user with zero datasets."""
    headers, _ = get_auth_client(client, "empty_workspace@datatrust.io")
    res = client.get("/api/dashboard/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_datasets"] == 0
    assert data["average_reliability"] is None  # Never fake 100
    assert data["datasets_needing_attention"] == 0
    assert data["recent_runs"] == 0
    assert data["reliability_distribution"] == {
        "excellent": 0,
        "good": 0,
        "fair": 0,
        "poor": 0,
    }
    assert data["datasets"] == []
    assert data["recent_activity"] == []
    assert data["needs_attention"] == []


def test_workspace_isolation_dashboard(client: TestClient):
    """Verify Workspace A never sees Workspace B's datasets or runs."""
    headers1, _ = get_auth_client(client, "user_a@datatrust.io")
    headers2, _ = get_auth_client(client, "user_b@datatrust.io")

    # User A creates a dataset and run
    ds_id_a = upload_sample_orders(client, headers1, name="Workspace A Orders")
    client.post(f"/api/datasets/{ds_id_a}/runs", headers=headers1)

    # User B checks dashboard
    res_b = client.get("/api/dashboard/summary", headers=headers2)
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["total_datasets"] == 0
    assert data_b["recent_runs"] == 0
    assert data_b["average_reliability"] is None


def test_latest_run_logic_dashboard(client: TestClient):
    """Verify only the latest run per dataset contributes to average reliability and overview."""
    headers, _ = get_auth_client(client, "latest_run_user@datatrust.io")
    ds_id = upload_sample_orders(client, headers, name="Multi-Run Dataset")

    # Run 1
    res1 = client.post(f"/api/datasets/{ds_id}/runs", headers=headers)
    assert res1.status_code == 201
    run1 = res1.json()

    # Run 2 (latest)
    res2 = client.post(f"/api/datasets/{ds_id}/runs", headers=headers)
    assert res2.status_code == 201
    run2 = res2.json()

    res = client.get("/api/dashboard/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_datasets"] == 1
    # Average reliability is exactly the latest run score (run2), not the average of run1 + run2
    assert data["average_reliability"] == round(run2["reliability_score"], 1)
    assert data["recent_runs"] == 2
    assert len(data["recent_activity"]) == 2
    # First activity is newest
    assert data["recent_activity"][0]["run_id"] == run2["id"]
    assert data["recent_activity"][1]["run_id"] == run1["id"]

    # Dataset in overview should have latest run metrics
    ds_item = data["datasets"][0]
    assert ds_item["dataset_id"] == ds_id
    assert ds_item["has_runs"] is True
    assert ds_item["reliability_score"] == run2["reliability_score"]


def test_dataset_without_runs_dashboard(client: TestClient):
    """Verify unanalyzed dataset appears in datasets list with has_runs=False and no artificial score."""
    headers, _ = get_auth_client(client, "unanalyzed_user@datatrust.io")
    ds_id = upload_sample_orders(client, headers, name="Unanalyzed Dataset")

    res = client.get("/api/dashboard/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_datasets"] == 1
    assert data["average_reliability"] is None
    assert data["datasets_needing_attention"] == 0
    assert len(data["datasets"]) == 1

    item = data["datasets"][0]
    assert item["dataset_id"] == ds_id
    assert item["has_runs"] is False
    assert item["reliability_score"] is None
    assert item["reliability_level"] is None


def test_reliability_tiers_and_needs_attention(client: TestClient):
    """Verify tier distribution and needs_attention collection when score < 75."""
    headers, _ = get_auth_client(client, "tiers_user@datatrust.io")
    ds_id = upload_sample_orders(client, headers, name="Orders For Tier Test")

    # Add a quality rule that will fail and lower the reliability score below 75
    client.post(
        f"/api/datasets/{ds_id}/quality-rules",
        headers=headers,
        json={
            "column_name": "total_amount",
            "rule_type": "numeric_range",
            "rule_name": "Impossible Range",
            "configuration": {"min": 999999.0, "max": 1000000.0},
        },
    )
    # Add second failing rule
    client.post(
        f"/api/datasets/{ds_id}/quality-rules",
        headers=headers,
        json={
            "column_name": "order_id",
            "rule_type": "allowed_values",
            "rule_name": "Nonexistent Allowed Values",
            "configuration": {"allowed_values": ["IMPOSSIBLE_ID"]},
        },
    )

    # Run analysis with failing rules -> score will drop < 75
    res_run = client.post(f"/api/datasets/{ds_id}/runs", headers=headers)
    assert res_run.status_code == 201
    run_data = res_run.json()
    assert run_data["reliability_score"] < 75.0

    res = client.get("/api/dashboard/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["datasets_needing_attention"] == 1
    assert len(data["needs_attention"]) == 1
    assert data["needs_attention"][0]["dataset_id"] == ds_id

    # Verify distribution classified this dataset as Fair or Poor
    dist = data["reliability_distribution"]
    if run_data["reliability_score"] >= 60.0:
        assert dist["fair"] == 1
    else:
        assert dist["poor"] == 1


def test_recent_runs_seven_day_window(client: TestClient):
    """Verify that recent_runs accurately counts runs within the recent window."""
    headers, _ = get_auth_client(client, "window_user@datatrust.io")
    ds_id = upload_sample_orders(client, headers, name="Window Orders")

    # Create 2 runs today
    client.post(f"/api/datasets/{ds_id}/runs", headers=headers)
    client.post(f"/api/datasets/{ds_id}/runs", headers=headers)

    res = client.get("/api/dashboard/summary", headers=headers)
    assert res.status_code == 200
    assert res.json()["recent_runs"] == 2
