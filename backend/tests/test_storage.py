import tempfile
import shutil
import uuid
from pathlib import Path
import pytest
from fastapi import HTTPException
import httpx

from app.core.config import settings
from app.models.dataset import Dataset
from app.services.storage.local_storage import LocalStorageService, storage_service
from app.services.datasets.inspection_service import inspection_service
from app.services.profiling.profiling_service import profiling_service


@pytest.fixture
def storage_instance():
    """Provides an isolated LocalStorageService instance with a temporary directory."""
    temp_dir = tempfile.mkdtemp()
    temp_path = Path(temp_dir)
    svc = LocalStorageService(base_dir=str(temp_path))
    yield svc, temp_path
    shutil.rmtree(temp_dir, ignore_errors=True)


def test_local_storage_default_unconfigured(storage_instance):
    """Verify local storage operates properly in local fallback mode when remote storage is not configured."""
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
    """Ensure path traversal attacks in stored filenames are strictly rejected."""
    svc, _ = storage_instance
    with pytest.raises(HTTPException) as exc_info:
        svc.get_file_path("../evil.csv")
    assert exc_info.value.status_code == 400
    assert "path traversal" in exc_info.value.detail.lower()


def test_empty_file_rejected(storage_instance):
    """Ensure zero-byte files are rejected with HTTP 400."""
    svc, _ = storage_instance
    with pytest.raises(HTTPException) as exc_info:
        svc.save_bytes(b"", "empty.csv")
    assert exc_info.value.status_code == 400
    assert "empty" in exc_info.value.detail.lower()


def test_oversized_file_rejected(storage_instance, monkeypatch):
    """Ensure files exceeding max size limits are rejected with HTTP 413."""
    svc, _ = storage_instance
    monkeypatch.setattr(svc, "max_size_bytes", 100)
    oversized = b"a" * 101
    with pytest.raises(HTTPException) as exc_info:
        svc.save_bytes(oversized, "big.csv")
    assert exc_info.value.status_code == 413


def test_supabase_upload_persists_remote(storage_instance, monkeypatch):
    """Verify save_bytes streams file to local disk and triggers persistent upload to Supabase."""
    svc, temp_path = storage_instance

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key")
    monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", "datatrust-datasets")
    assert svc.is_remote_configured()

    posted_urls = []
    posted_contents = []

    def mock_post(self, url, headers=None, content=None, json=None, timeout=None):
        posted_urls.append(str(url))
        posted_contents.append(content or json)
        return httpx.Response(200, json={"Key": "mock/key"})

    def mock_get(self, url, headers=None, timeout=None):
        return httpx.Response(200, json={"id": "datatrust-datasets"})

    monkeypatch.setattr(httpx.Client, "get", mock_get)
    monkeypatch.setattr(httpx.Client, "post", mock_post)

    content = b"col1,col2\n10,20\n"
    filename = "upload_test.csv"
    dest_path, written = svc.save_bytes(content, filename)

    assert dest_path.exists()
    assert dest_path.read_bytes() == content
    expected_upload_url = "https://mockproject.supabase.co/storage/v1/object/datatrust-datasets/upload_test.csv"
    assert expected_upload_url in posted_urls


def test_supabase_download_primary_endpoint_contract_and_follow_redirects(storage_instance, monkeypatch):
    """Verify download uses standard primary endpoint, follows redirects, and restores DuckDB readability."""
    svc, temp_path = storage_instance

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key")
    monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", "datatrust-datasets")
    assert svc.is_remote_configured()

    csv_data = b"order_id,amount,status\n1,99.99,COMPLETED\n2,149.50,PENDING\n3,25.00,COMPLETED\n"
    filename = "restarted_dataset.csv"
    expected_primary_url = "https://mockproject.supabase.co/storage/v1/object/datatrust-datasets/restarted_dataset.csv"

    # Local file is completely missing initially (Render cold restart)
    local_target = temp_path / filename
    assert not local_target.exists()

    recorded_calls = []

    def mock_get(self, url, headers=None, timeout=None):
        recorded_calls.append({
            "url": str(url),
            "follow_redirects": self.follow_redirects,
            "headers": headers,
        })
        if str(url) == expected_primary_url:
            return httpx.Response(200, content=csv_data)
        return httpx.Response(404, json={"message": "Not found"})

    monkeypatch.setattr(httpx.Client, "get", mock_get)

    # Calling get_file_path must download via primary endpoint into local cache
    resolved_path = svc.get_file_path(filename)
    assert resolved_path.exists()
    assert resolved_path.read_bytes() == csv_data

    # Verify primary contract and client settings
    assert len(recorded_calls) == 1
    assert recorded_calls[0]["url"] == expected_primary_url
    assert recorded_calls[0]["follow_redirects"] is True
    assert recorded_calls[0]["headers"]["apikey"] == "mock-service-role-key"
    assert recorded_calls[0]["headers"]["Authorization"] == "Bearer mock-service-role-key"

    # DuckDB inspection must succeed on the restored file
    inspection = inspection_service.inspect_file(resolved_path, "csv")
    assert inspection.row_count == 3
    assert inspection.column_count == 3


def test_supabase_download_fallback_to_authenticated_on_404(storage_instance, monkeypatch):
    """Verify fallback to authenticated route if standard primary endpoint returns 404."""
    svc, temp_path = storage_instance

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key")
    monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", "datatrust-datasets")
    assert svc.is_remote_configured()

    csv_data = b"id,val\n1,A\n2,B\n"
    filename = "fallback_dataset.csv"
    primary_url = "https://mockproject.supabase.co/storage/v1/object/datatrust-datasets/fallback_dataset.csv"
    fallback_url = "https://mockproject.supabase.co/storage/v1/object/authenticated/datatrust-datasets/fallback_dataset.csv"

    local_target = temp_path / filename
    assert not local_target.exists()

    requested_urls = []

    def mock_get(self, url, headers=None, timeout=None):
        requested_urls.append(str(url))
        if str(url) == primary_url:
            return httpx.Response(404, json={"message": "Not found on primary"})
        elif str(url) == fallback_url:
            return httpx.Response(200, content=csv_data)
        return httpx.Response(404, json={"message": "Unknown"})

    monkeypatch.setattr(httpx.Client, "get", mock_get)

    resolved_path = svc.get_file_path(filename)
    assert resolved_path.exists()
    assert resolved_path.read_bytes() == csv_data
    # Confirms primary was attempted first, followed by authenticated fallback
    assert requested_urls == [primary_url, fallback_url]


def test_supabase_download_missing_remote_leaves_nonexistent(storage_instance, monkeypatch):
    """Verify that when a remote file is absent (404), the local file remains non-existent."""
    svc, temp_path = storage_instance

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key")
    monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", "datatrust-datasets")
    assert svc.is_remote_configured()

    def mock_get(self, url, headers=None, timeout=None):
        return httpx.Response(404, json={"message": "Object not found"})

    monkeypatch.setattr(httpx.Client, "get", mock_get)

    resolved_path = svc.get_file_path("nonexistent.csv")
    assert not resolved_path.exists()


def test_supabase_download_http_500_failure_leaves_nonexistent(storage_instance, monkeypatch):
    """Verify that remote HTTP 500 error is handled gracefully and leaves local file non-existent."""
    svc, temp_path = storage_instance

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key")
    monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", "datatrust-datasets")
    assert svc.is_remote_configured()

    def mock_get(self, url, headers=None, timeout=None):
        return httpx.Response(500, text="Internal Server Error")

    monkeypatch.setattr(httpx.Client, "get", mock_get)

    resolved_path = svc.get_file_path("server_error.csv")
    assert not resolved_path.exists()


def test_profiling_flow_restores_from_supabase_on_cache_miss(monkeypatch):
    """Simulate the production profile endpoint flow when Render restarts and local disk is empty.
    
    Verifies that profiling_service.profile_dataset() automatically downloads the file from
    Supabase through storage_service and computes the profile without raising a 404 error.
    """
    temp_dir = tempfile.mkdtemp()
    temp_path = Path(temp_dir)
    try:
        monkeypatch.setattr(settings, "UPLOAD_DIR", str(temp_path))
        monkeypatch.setattr(storage_service, "base_dir", temp_path)
        monkeypatch.setattr(settings, "SUPABASE_URL", "https://mockproject.supabase.co")
        monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key")
        monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", "datatrust-datasets")
        assert storage_service.is_remote_configured()

        csv_data = b"order_id,amount,status\n101,15.50,PAID\n102,42.00,PENDING\n103,99.90,PAID\n"
        stored_filename = "e1174765a8374c19907d5673b17ecf5d.csv"
        expected_url = f"https://mockproject.supabase.co/storage/v1/object/datatrust-datasets/{stored_filename}"

        # Local file is completely missing on disk
        local_file = temp_path / stored_filename
        assert not local_file.exists()

        def mock_get(self, url, headers=None, timeout=None):
            if str(url) == expected_url:
                return httpx.Response(200, content=csv_data)
            return httpx.Response(404, json={"message": "Not found"})

        monkeypatch.setattr(httpx.Client, "get", mock_get)

        dataset = Dataset(
            id=uuid.uuid4(),
            workspace_id=uuid.uuid4(),
            name="Production Restarted Dataset",
            original_filename="orders.csv",
            stored_filename=stored_filename,
            file_format="csv",
            file_size=len(csv_data),
        )

        # Profile dataset should restore file from Supabase and compute schema/profile
        profile = profiling_service.profile_dataset(dataset)

        assert local_file.exists()
        assert local_file.read_bytes() == csv_data
        assert profile.total_rows == 3
        assert profile.total_columns == 3
        assert len(profile.columns) == 3
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_supabase_delete_removes_both_local_and_remote(storage_instance, monkeypatch):
    """Verify delete_file removes both the local file on disk and the remote Supabase object."""
    svc, temp_path = storage_instance

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://mockproject.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "mock-service-role-key")
    assert svc.is_remote_configured()

    filename = "to_delete.csv"
    local_file = temp_path / filename
    local_file.write_bytes(b"dummy")
    assert local_file.exists()

    delete_calls = []

    def mock_request(self, method, url, **kwargs):
        delete_calls.append((method, str(url)))
        return httpx.Response(200, json={"message": "Deleted"})

    monkeypatch.setattr(httpx.Client, "request", mock_request)

    deleted = svc.delete_file(filename)
    assert deleted is True
    assert not local_file.exists()
    assert any("DELETE" == call[0] for call in delete_calls)
