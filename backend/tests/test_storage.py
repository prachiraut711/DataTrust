import tempfile
import shutil
from pathlib import Path
import pytest
from fastapi import HTTPException
import httpx

from app.core.config import settings
from app.services.storage.local_storage import LocalStorageService
from app.services.datasets.inspection_service import inspection_service


@pytest.fixture
def storage_instance():
    """Provides an isolated LocalStorageService instance with a temporary directory."""
    temp_dir = tempfile.mkdtemp()
    temp_path = Path(temp_dir)
    svc = LocalStorageService(base_dir=str(temp_path))
    yield svc, temp_path
    shutil.rmtree(temp_dir, ignore_errors=True)


def test_local_storage_default_unconfigured(storage_instance):
    svc, temp_path = storage_instance
    assert not svc.is_remote_configured()

    # Save bytes
    content = b"colA,colB\n1,2\n3,4\n"
    filename = "test_data.csv"
    saved_path, size = svc.save_bytes(content, filename)

    assert saved_path.exists()
    assert size == len(content)
    assert saved_path.read_bytes() == content

    # Get file path
    resolved_path = svc.get_file_path(filename)
    assert resolved_path == saved_path
    assert resolved_path.exists()

    # Delete file
    deleted = svc.delete_file(filename)
    assert deleted is True
    assert not saved_path.exists()


def test_path_traversal_prevention(storage_instance):
    svc, _ = storage_instance
    with pytest.raises(HTTPException) as exc_info:
        svc.get_file_path("../evil.csv")
    assert exc_info.value.status_code == 400
    assert "path traversal" in exc_info.value.detail.lower()


def test_empty_file_rejected(storage_instance):
    svc, _ = storage_instance
    with pytest.raises(HTTPException) as exc_info:
        svc.save_bytes(b"", "empty.csv")
    assert exc_info.value.status_code == 400
    assert "empty" in exc_info.value.detail.lower()


def test_oversized_file_rejected(storage_instance, monkeypatch):
    svc, _ = storage_instance
    # Temporarily set max size to 100 bytes
    monkeypatch.setattr(svc, "max_size_bytes", 100)
    oversized = b"a" * 101
    with pytest.raises(HTTPException) as exc_info:
        svc.save_bytes(oversized, "big.csv")
    assert exc_info.value.status_code == 413


def test_supabase_upload_persists_remote(storage_instance, monkeypatch):
    svc, temp_path = storage_instance

    # Configure mock Supabase credentials
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key")
    monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", "datatrust-datasets")
    assert svc.is_remote_configured()

    posted_urls = []
    posted_contents = []

    def mock_post(url, headers=None, content=None, json=None, timeout=None):
        posted_urls.append(url)
        posted_contents.append(content or json)
        # 200 OK for bucket check or upload
        return httpx.Response(200, json={"Key": "mock/key"})

    def mock_get(url, headers=None, timeout=None):
        # 200 OK for bucket check
        return httpx.Response(200, json={"id": "datatrust-datasets"})

    monkeypatch.setattr(httpx.Client, "get", lambda self, url, **kwargs: mock_get(url, **kwargs))
    monkeypatch.setattr(httpx.Client, "post", lambda self, url, **kwargs: mock_post(url, **kwargs))

    content = b"col1,col2\n10,20\n"
    filename = "upload_test.csv"
    dest_path, written = svc.save_bytes(content, filename)

    assert dest_path.exists()
    assert dest_path.read_bytes() == content
    assert any("upload_test.csv" in u for u in posted_urls)


def test_supabase_download_on_cache_miss_and_duckdb_scan(storage_instance, monkeypatch):
    svc, temp_path = storage_instance

    # Configure mock Supabase credentials
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key")
    monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", "datatrust-datasets")
    assert svc.is_remote_configured()

    csv_data = b"order_id,amount,status\n1,99.99,COMPLETED\n2,149.50,PENDING\n3,25.00,COMPLETED\n"
    filename = "restarted_dataset.csv"

    # Local file is completely absent (Render restarted!)
    local_target = temp_path / filename
    assert not local_target.exists()

    def mock_get(url, headers=None, timeout=None):
        if "restarted_dataset.csv" in url:
            return httpx.Response(200, content=csv_data)
        return httpx.Response(404, json={"message": "Not found"})

    monkeypatch.setattr(httpx.Client, "get", lambda self, url, **kwargs: mock_get(url, **kwargs))

    # Calling get_file_path should automatically restore file from Supabase into local cache
    resolved_path = svc.get_file_path(filename)
    assert resolved_path.exists()
    assert resolved_path.read_bytes() == csv_data

    # DuckDB inspection must succeed on the restored file
    inspection = inspection_service.inspect_file(resolved_path, "csv")
    assert inspection.row_count == 3
    assert inspection.column_count == 3


def test_supabase_download_missing_returns_nonexistent(storage_instance, monkeypatch):
    svc, temp_path = storage_instance

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key")
    assert svc.is_remote_configured()

    def mock_get(url, headers=None, timeout=None):
        return httpx.Response(404, json={"message": "Object not found"})

    monkeypatch.setattr(httpx.Client, "get", lambda self, url, **kwargs: mock_get(url, **kwargs))

    resolved_path = svc.get_file_path("nonexistent.csv")
    assert not resolved_path.exists()


def test_supabase_delete_removes_both_local_and_remote(storage_instance, monkeypatch):
    svc, temp_path = storage_instance

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key")
    assert svc.is_remote_configured()

    filename = "to_delete.csv"
    local_file = temp_path / filename
    local_file.write_bytes(b"dummy")
    assert local_file.exists()

    delete_calls = []

    def mock_request(method, url, **kwargs):
        delete_calls.append((method, url))
        return httpx.Response(200, json={"message": "Deleted"})

    monkeypatch.setattr(httpx.Client, "request", lambda self, method, url, **kwargs: mock_request(method, url, **kwargs))

    deleted = svc.delete_file(filename)
    assert deleted is True
    assert not local_file.exists()
    assert any("DELETE" == call[0] for call in delete_calls)
