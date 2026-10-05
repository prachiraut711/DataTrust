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


def get_auth_client(client: TestClient, email: str = "rel_tester@datatrust.io") -> tuple[dict, str]:
    """Helper to register and generate Authorization headers for a test user."""
    res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Reliability QA Engineer",
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
            data={"name": "Orders Dataset", "description": "Reliability Testing Sample"},
        )
    assert response.status_code == 201
    return response.json()["id"]


def test_unauthenticated_reliability_access(client: TestClient):
    """Verify reliability endpoint rejects unauthenticated requests with 401."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    res = client.get(f"/api/datasets/{fake_id}/reliability")
    assert res.status_code == 401


def test_workspace_isolation_reliability(client: TestClient):
    """Ensure a user cannot access reliability scores for another user's dataset."""
    headers_user1, _ = get_auth_client(client, "user1_rel@datatrust.io")
    headers_user2, _ = get_auth_client(client, "user2_rel@datatrust.io")

    dataset_id = upload_sample_orders(client, headers_user1)

    # User 2 tries to fetch reliability score
    res = client.get(f"/api/datasets/{dataset_id}/reliability", headers=headers_user2)
    assert res.status_code == 404
    assert res.json()["detail"] == "Dataset not found."


def test_reliability_score_calculation_default(client: TestClient):
    """Verify reliability calculation with no configured rules (default 100% quality)."""
    headers, _ = get_auth_client(client, "rel_default@datatrust.io")
    dataset_id = upload_sample_orders(client, headers)

    res = client.get(f"/api/datasets/{dataset_id}/reliability", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["dataset_id"] == dataset_id
    assert 0.0 <= data["reliability_score"] <= 100.0
    assert data["reliability_level"] in ["Excellent", "Good", "Fair", "Poor"]

    comps = data["components"]

    # Quality component (no rules -> 100)
    assert comps["quality"]["score"] == 100.0
    assert comps["quality"]["weight"] == 0.50
    assert comps["quality"]["weighted_score"] == 50.0

    # Completeness component
    assert 0.0 <= comps["completeness"]["score"] <= 100.0
    assert comps["completeness"]["weight"] == 0.25
    assert comps["completeness"]["missing_percentage"] >= 0.0

    # Anomaly component
    assert 0.0 <= comps["anomaly_health"]["score"] <= 100.0
    assert comps["anomaly_health"]["weight"] == 0.25
    assert comps["anomaly_health"]["total_anomalies"] > 0

    # Verify formula: weighted sum == reliability_score
    calculated_sum = round(
        comps["quality"]["weighted_score"]
        + comps["completeness"]["weighted_score"]
        + comps["anomaly_health"]["weighted_score"],
        2,
    )
    assert abs(data["reliability_score"] - calculated_sum) <= 0.05


def test_reliability_score_with_failing_quality_rules(client: TestClient):
    """Verify that failing quality rules directly penalize the reliability score."""
    headers, _ = get_auth_client(client, "rel_failing@datatrust.io")
    dataset_id = upload_sample_orders(client, headers)

    # 1. Fetch initial score without rules (quality = 100)
    res_initial = client.get(f"/api/datasets/{dataset_id}/reliability", headers=headers)
    assert res_initial.status_code == 200
    initial_score = res_initial.json()["reliability_score"]

    # 2. Add failing quality rule (order_amount range 0 to 10000, which has negative amounts and 98500 outlier)
    client.post(
        f"/api/datasets/{dataset_id}/quality-rules",
        headers=headers,
        json={
            "column_name": "order_amount",
            "rule_type": "numeric_range",
            "rule_name": "Positive Total Amount",
            "configuration": {"min": 0.0, "max": 10000.0},
        },
    )

    # 3. Add failing not_null rule on customer_id (has nulls)
    client.post(
        f"/api/datasets/{dataset_id}/quality-rules",
        headers=headers,
        json={
            "column_name": "customer_id",
            "rule_type": "not_null",
            "rule_name": "Customer Required",
        },
    )

    # 4. Fetch updated reliability score
    res_updated = client.get(f"/api/datasets/{dataset_id}/reliability", headers=headers)
    assert res_updated.status_code == 200
    updated_data = res_updated.json()
    updated_score = updated_data["reliability_score"]

    # Since 2 rules failed, quality score is lower, so composite score must decrease
    assert updated_data["components"]["quality"]["score"] < 100.0
    assert updated_score < initial_score
    assert updated_data["components"]["quality"]["failed_rules"] >= 1


def test_reliability_perfect_score_dataset(client: TestClient):
    """Verify a clean dataset without missing values or anomalies achieves 100% reliability."""
    headers, _ = get_auth_client(client, "clean_rel@datatrust.io")

    # Clean small CSV with 5 complete rows
    clean_csv = "id,name,value\n1,alpha,10.0\n2,beta,20.0\n3,gamma,30.0\n4,delta,40.0\n5,epsilon,50.0\n"
    res_upload = client.post(
        "/api/datasets",
        headers=headers,
        files={"file": ("clean.csv", io.BytesIO(clean_csv.encode("utf-8")), "text/csv")},
        data={"name": "Clean Dataset"},
    )
    assert res_upload.status_code == 201
    dataset_id = res_upload.json()["id"]

    res = client.get(f"/api/datasets/{dataset_id}/reliability", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["reliability_score"] == 100.0
    assert data["reliability_level"] == "Excellent"
    assert data["components"]["quality"]["score"] == 100.0
    assert data["components"]["completeness"]["score"] == 100.0
    assert data["components"]["anomaly_health"]["score"] == 100.0
