import json
from pathlib import Path
import shutil
import tempfile
from unittest.mock import MagicMock, patch
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


def get_auth_client(client: TestClient, email: str = "ai_tester@datatrust.io") -> tuple[dict, str]:
    """Helper to register and generate Authorization headers for a test user."""
    res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "AI Quality QA Engineer",
        },
    )
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, token


def upload_sample_dataset(client: TestClient, headers: dict) -> str:
    """Helper to upload the standard orders_sample.csv dataset."""
    sample_csv = Path(__file__).resolve().parent.parent.parent / "data" / "sample" / "orders_sample.csv"
    with open(sample_csv, "rb") as f:
        response = client.post(
            "/api/datasets",
            headers=headers,
            files={"file": ("orders_sample.csv", f, "text/csv")},
            data={"name": "Orders for AI Test", "description": "AI Explanation Sample"},
        )
    assert response.status_code == 201
    return response.json()["id"]


def test_ai_explanation_unauthenticated(client: TestClient):
    """Verify AI explanation endpoint requires JWT authentication (401)."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    res = client.post(f"/api/datasets/{fake_id}/ai/explanation")
    assert res.status_code == 401


def test_ai_explanation_nonexistent_dataset(client: TestClient, monkeypatch):
    """Verify AI explanation for missing dataset returns 404."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "mock-test-key")
    headers, _ = get_auth_client(client, "ai_nonexist@datatrust.io")
    fake_id = "00000000-0000-0000-0000-000000000000"
    res = client.post(f"/api/datasets/{fake_id}/ai/explanation", headers=headers)
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_ai_explanation_workspace_isolation(client: TestClient, monkeypatch):
    """Ensure a user cannot request an AI explanation for another workspace's dataset (404)."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "mock-test-key")
    headers1, _ = get_auth_client(client, "user1_ai@datatrust.io")
    headers2, _ = get_auth_client(client, "user2_ai@datatrust.io")

    dataset_id = upload_sample_dataset(client, headers1)

    # User 2 attempts to explain User 1's dataset
    res = client.post(f"/api/datasets/{dataset_id}/ai/explanation", headers=headers2)
    assert res.status_code == 404


def test_ai_explanation_unconfigured_api_key(client: TestClient, monkeypatch):
    """Verify endpoint returns 503 when GEMINI_API_KEY is not configured."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    headers, _ = get_auth_client(client, "ai_nokey@datatrust.io")
    dataset_id = upload_sample_dataset(client, headers)

    res = client.post(f"/api/datasets/{dataset_id}/ai/explanation", headers=headers)
    assert res.status_code == 503
    assert "AI explanation is not configured. Add GEMINI_API_KEY" in res.json()["detail"]


def test_ai_explanation_success_mocked(client: TestClient, monkeypatch):
    """Verify successful AI explanation response using mocked Gemini SDK and schema integrity."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "mock-test-key")
    headers, _ = get_auth_client(client, "ai_success@datatrust.io")
    dataset_id = upload_sample_dataset(client, headers)

    mock_gemini_payload = {
        "summary": "This dataset shows good overall structural health with 100% completeness.",
        "key_issues": [
            {
                "title": "Detected Outlier Observations",
                "explanation": "Isolation Forest identified potential statistical anomalies in order amounts.",
                "severity": "medium",
            },
            {
                "title": "Unconfigured Domain Validation Rules",
                "explanation": "No custom quality rules are active on customer email or dates.",
                "severity": "low",
            },
        ],
        "recommendations": [
            "Inspect flagged high-value outlier transactions before ML training.",
            "Configure email format and non-negative quantity validation rules.",
        ],
        "reliability_explanation": (
            "The composite reliability score is 87.5% (Good). Quality and completeness are strong (100%), "
            "with a slight deduction due to detected numeric anomalies."
        ),
    }

    mock_response = MagicMock()
    mock_response.text = json.dumps(mock_gemini_payload)

    mock_client_instance = MagicMock()
    mock_client_instance.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client_instance):
        res = client.post(f"/api/datasets/{dataset_id}/ai/explanation", headers=headers)

    assert res.status_code == 200
    data = res.json()

    # Verify Pydantic response contract
    assert data["summary"] == mock_gemini_payload["summary"]
    assert len(data["key_issues"]) == 2
    assert data["key_issues"][0]["title"] == "Detected Outlier Observations"
    assert data["key_issues"][0]["severity"] == "medium"
    assert data["key_issues"][1]["severity"] == "low"
    assert len(data["recommendations"]) == 2
    assert data["reliability_explanation"] == mock_gemini_payload["reliability_explanation"]
    assert "generated_at" in data

    # Verify Gemini prompt contents: must ONLY include metrics and NO raw rows or passwords
    call_args = mock_client_instance.models.generate_content.call_args
    prompt_sent = call_args.kwargs["contents"]
    assert "DATASET ANALYSIS METRICS:" in prompt_sent
    assert "reliability" in prompt_sent
    assert "missing_value_percentage" in prompt_sent
    assert "password" not in prompt_sent.lower()


def test_ai_explanation_gemini_api_failure(client: TestClient, monkeypatch):
    """Verify endpoint gracefully returns 503 when the Gemini API call raises an exception."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "mock-test-key")
    headers, _ = get_auth_client(client, "ai_fail@datatrust.io")
    dataset_id = upload_sample_dataset(client, headers)

    mock_client_instance = MagicMock()
    mock_client_instance.models.generate_content.side_effect = RuntimeError("Google GenAI connection timeout")

    with patch("google.genai.Client", return_value=mock_client_instance):
        res = client.post(f"/api/datasets/{dataset_id}/ai/explanation", headers=headers)

    assert res.status_code == 503
    assert "temporarily unavailable" in res.json()["detail"].lower()


def test_ai_explanation_gemini_malformed_json(client: TestClient, monkeypatch):
    """Verify endpoint returns 503 when Gemini outputs unparseable non-JSON text."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "mock-test-key")
    headers, _ = get_auth_client(client, "ai_badjson@datatrust.io")
    dataset_id = upload_sample_dataset(client, headers)

    mock_response = MagicMock()
    mock_response.text = "This is not valid JSON at all. Just random thoughts."

    mock_client_instance = MagicMock()
    mock_client_instance.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client_instance):
        res = client.post(f"/api/datasets/{dataset_id}/ai/explanation", headers=headers)

    assert res.status_code == 503
    assert "temporarily unavailable" in res.json()["detail"].lower()
