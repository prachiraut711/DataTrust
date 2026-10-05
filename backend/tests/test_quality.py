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


def get_auth_client(client: TestClient, email: str = "quality_tester@datatrust.io") -> tuple[dict, str]:
    """Helper to register and generate Authorization headers for a test user."""
    res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Quality Assurance Engineer",
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
            data={"name": "Orders Dataset", "description": "Quality Engine Test Sample"},
        )
    assert response.status_code == 201
    return response.json()["id"]


def test_unauthenticated_quality_access(client: TestClient):
    """Verify quality endpoints reject unauthenticated requests with 401."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    res1 = client.get(f"/api/datasets/{fake_id}/quality-rules")
    assert res1.status_code == 401

    res2 = client.post(f"/api/datasets/{fake_id}/quality-rules", json={"column_name": "id", "rule_type": "not_null", "rule_name": "ID Req"})
    assert res2.status_code == 401

    res3 = client.post(f"/api/datasets/{fake_id}/quality/evaluate")
    assert res3.status_code == 401


def test_rule_crud_operations(client: TestClient):
    """Verify creating, listing, updating, and deleting rules."""
    headers, _ = get_auth_client(client, "crud_user@datatrust.io")
    dataset_id = upload_sample_orders(client, headers)

    # 1. Create Rule
    create_payload = {
        "column_name": "customer_id",
        "rule_type": "not_null",
        "rule_name": "Customer ID Must Not Be Null",
        "configuration": {},
        "enabled": True,
    }
    create_res = client.post(f"/api/datasets/{dataset_id}/quality-rules", headers=headers, json=create_payload)
    assert create_res.status_code == 201
    rule_data = create_res.json()
    rule_id = rule_data["id"]
    assert rule_data["column_name"] == "customer_id"
    assert rule_data["rule_type"] == "not_null"
    assert rule_data["enabled"] is True

    # 2. List Rules
    list_res = client.get(f"/api/datasets/{dataset_id}/quality-rules", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1
    assert list_res.json()[0]["id"] == rule_id

    # 3. Update Rule (disable rule and rename)
    update_res = client.put(
        f"/api/datasets/{dataset_id}/quality-rules/{rule_id}",
        headers=headers,
        json={"rule_name": "Updated Customer Check", "enabled": False},
    )
    assert update_res.status_code == 200
    assert update_res.json()["rule_name"] == "Updated Customer Check"
    assert update_res.json()["enabled"] is False

    # 4. Delete Rule
    del_res = client.delete(f"/api/datasets/{dataset_id}/quality-rules/{rule_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Confirm deletion
    list_res2 = client.get(f"/api/datasets/{dataset_id}/quality-rules", headers=headers)
    assert len(list_res2.json()) == 0


def test_workspace_isolation_quality_rules(client: TestClient):
    """Verify User B cannot view, modify, or evaluate User A's dataset rules."""
    headers_a, _ = get_auth_client(client, "owner_alice@datatrust.io")
    headers_b, _ = get_auth_client(client, "intruder_bob@datatrust.io")

    dataset_id = upload_sample_orders(client, headers_a)
    rule_res = client.post(
        f"/api/datasets/{dataset_id}/quality-rules",
        headers=headers_a,
        json={"column_name": "order_id", "rule_type": "unique", "rule_name": "Order ID Unique"},
    )
    rule_id = rule_res.json()["id"]

    # Bob tries to list Alice's rules
    assert client.get(f"/api/datasets/{dataset_id}/quality-rules", headers=headers_b).status_code == 404

    # Bob tries to update Alice's rule
    assert client.put(f"/api/datasets/{dataset_id}/quality-rules/{rule_id}", headers=headers_b, json={"enabled": False}).status_code == 404

    # Bob tries to delete Alice's rule
    assert client.delete(f"/api/datasets/{dataset_id}/quality-rules/{rule_id}", headers=headers_b).status_code == 404

    # Bob tries to evaluate Alice's rules
    assert client.post(f"/api/datasets/{dataset_id}/quality/evaluate", headers=headers_b).status_code == 404


def test_rule_configuration_validation(client: TestClient):
    """Verify validation errors on malformed rule configurations."""
    headers, _ = get_auth_client(client, "validator_user@datatrust.io")
    dataset_id = upload_sample_orders(client, headers)

    # 1. Invalid rule type
    res1 = client.post(
        f"/api/datasets/{dataset_id}/quality-rules",
        headers=headers,
        json={"column_name": "order_amount", "rule_type": "invalid_type", "rule_name": "Bad Type"},
    )
    assert res1.status_code == 422

    # 2. Nonexistent column
    res2 = client.post(
        f"/api/datasets/{dataset_id}/quality-rules",
        headers=headers,
        json={"column_name": "ghost_column", "rule_type": "not_null", "rule_name": "Ghost Check"},
    )
    assert res2.status_code == 400
    assert "not exist" in res2.json()["detail"].lower()

    # 3. Numeric range with min > max
    res3 = client.post(
        f"/api/datasets/{dataset_id}/quality-rules",
        headers=headers,
        json={
            "column_name": "order_amount",
            "rule_type": "numeric_range",
            "rule_name": "Bad Range",
            "configuration": {"min": 500.0, "max": 100.0},
        },
    )
    assert res3.status_code == 422

    # 4. Numeric range with non-numeric values
    res4 = client.post(
        f"/api/datasets/{dataset_id}/quality-rules",
        headers=headers,
        json={
            "column_name": "order_amount",
            "rule_type": "numeric_range",
            "rule_name": "Bad Range Types",
            "configuration": {"min": "not-a-number"},
        },
    )
    assert res4.status_code == 422

    # 5. Allowed values with empty list
    res5 = client.post(
        f"/api/datasets/{dataset_id}/quality-rules",
        headers=headers,
        json={
            "column_name": "order_status",
            "rule_type": "allowed_values",
            "rule_name": "Empty Allowed",
            "configuration": {"allowed_values": []},
        },
    )
    assert res5.status_code == 422


def test_quality_evaluation_on_sample_dataset(client: TestClient):
    """Verify dynamic DuckDB quality evaluation detects all intentional data anomalies in orders_sample.csv."""
    headers, _ = get_auth_client(client, "qa_lead@datatrust.io")
    dataset_id = upload_sample_orders(client, headers)

    # Configure the 6 rule types
    rules_to_create = [
        # Rule 1: Not Null on customer_id (Should FAIL - 3 nulls)
        {"column_name": "customer_id", "rule_type": "not_null", "rule_name": "Customer ID Required"},
        # Rule 2: Unique on order_id (Should FAIL - 1 duplicate value)
        {"column_name": "order_id", "rule_type": "unique", "rule_name": "Order ID Unique"},
        # Rule 3: Numeric Range on order_amount 0 to 10000 (Should FAIL - negative amounts & 98500 outlier)
        {"column_name": "order_amount", "rule_type": "numeric_range", "rule_name": "Amount Range 0-10000", "configuration": {"min": 0.0, "max": 10000.0}},
        # Rule 4: Allowed Values on order_status (Should FAIL - 'IN_LIMBO' and 'pendng')
        {"column_name": "order_status", "rule_type": "allowed_values", "rule_name": "Valid Order Status", "configuration": {"allowed_values": ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Refunded"]}},
        # Rule 5: Email Format on customer_email (Should FAIL - 'invalid.user@' and 'missing_at_domain.com')
        {"column_name": "customer_email", "rule_type": "email_format", "rule_name": "Valid Customer Email"},
        # Rule 6: No Future Dates on order_date (Should FAIL - '2027-11-20')
        {"column_name": "order_date", "rule_type": "no_future_dates", "rule_name": "No Future Order Dates"},
        # Passing Rule: Numeric Range on customer_age 10 to 120 (Should PASS)
        {"column_name": "customer_age", "rule_type": "numeric_range", "rule_name": "Customer Age Range", "configuration": {"min": 10.0, "max": 120.0}},
        # Passing Rule: Not Null on order_id (Should PASS)
        {"column_name": "order_id", "rule_type": "not_null", "rule_name": "Order ID Required"},
        # Skipped Rule: Numeric Range on country (VARCHAR) -> Should be SKIPPED
        {"column_name": "country", "rule_type": "numeric_range", "rule_name": "Inapplicable Numeric on String", "configuration": {"min": 0, "max": 100}},
    ]

    for r in rules_to_create:
        res = client.post(f"/api/datasets/{dataset_id}/quality-rules", headers=headers, json=r)
        assert res.status_code == 201

    # Execute dynamic DuckDB evaluation
    eval_res = client.post(f"/api/datasets/{dataset_id}/quality/evaluate", headers=headers)
    assert eval_res.status_code == 200
    data = eval_res.json()

    summary = data["summary"]
    results = {r["rule_name"]: r for r in data["results"]}

    # Summary verification
    assert summary["total_rules"] == 9
    assert summary["passed_rules"] == 2
    assert summary["failed_rules"] == 6
    assert summary["skipped_rules"] == 1
    assert summary["total_rows"] == 150
    # 2 passed / 8 applicable = 25.0%
    assert summary["quality_score"] == 25.0
    assert summary["total_issues"] > 0

    # Rule 1 Check: Customer ID Required -> FAIL, 3 missing
    r1 = results["Customer ID Required"]
    assert r1["status"] == "FAIL"
    assert r1["failed_rows"] == 3
    assert r1["passed_rows"] == 147
    assert r1["failure_percentage"] == 2.0

    # Rule 2 Check: Order ID Unique -> FAIL, 1 duplicate
    r2 = results["Order ID Unique"]
    assert r2["status"] == "FAIL"
    assert r2["failed_rows"] == 1
    assert r2["duplicate_count"] == 1

    # Rule 3 Check: Amount Range 0-10000 -> FAIL, 3 outliers
    r3 = results["Amount Range 0-10000"]
    assert r3["status"] == "FAIL"
    assert r3["failed_rows"] == 3

    # Rule 4 Check: Valid Order Status -> FAIL, 2 illegal values ('IN_LIMBO', 'pendng')
    r4 = results["Valid Order Status"]
    assert r4["status"] == "FAIL"
    assert r4["failed_rows"] == 2

    # Rule 5 Check: Valid Customer Email -> FAIL, 2 malformed emails
    r5 = results["Valid Customer Email"]
    assert r5["status"] == "FAIL"
    assert r5["failed_rows"] == 2

    # Rule 6 Check: No Future Order Dates -> FAIL, 1 future date (2027-11-20)
    r6 = results["No Future Order Dates"]
    assert r6["status"] == "FAIL"
    assert r6["failed_rows"] == 1

    # Passing checks
    assert results["Customer Age Range"]["status"] == "PASS"
    assert results["Customer Age Range"]["failed_rows"] == 0

    assert results["Order ID Required"]["status"] == "PASS"
    assert results["Order ID Required"]["failed_rows"] == 0

    # Skipped check
    assert results["Inapplicable Numeric on String"]["status"] == "SKIPPED"
    assert "requires a numeric column" in results["Inapplicable Numeric on String"]["message"].lower()


def test_evaluate_empty_rules(client: TestClient):
    """Verify evaluating a dataset with 0 rules returns 100% quality score."""
    headers, _ = get_auth_client(client, "empty_rules_user@datatrust.io")
    dataset_id = upload_sample_orders(client, headers)

    eval_res = client.post(f"/api/datasets/{dataset_id}/quality/evaluate", headers=headers)
    assert eval_res.status_code == 200
    data = eval_res.json()
    assert data["summary"]["total_rules"] == 0
    assert data["summary"]["quality_score"] == 100.0
    assert len(data["results"]) == 0
