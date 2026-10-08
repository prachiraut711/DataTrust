import logging
import os
import uuid
from pathlib import Path
from typing import BinaryIO, Optional

import httpx
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

logger = logging.getLogger(__name__)


class LocalStorageService:
    """Service handling dataset file persistence and caching.

    Provides dual-tier storage:
    1. Ephemeral/Local disk cache: Guarantees fast, in-process DuckDB analytical scans and path traversal safety.
    2. Cloud object storage (Supabase Storage): Persists raw dataset files across Render container restarts.
       When Render restarts and local disk is cleared, files are restored on demand from Supabase Storage.

    Gracefully operates in local-only mode when Supabase is not configured (ideal for local development and CI).
    """

    def __init__(self, base_dir: str = settings.UPLOAD_DIR):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.max_size_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        self._bucket_verified = False

    def is_remote_configured(self) -> bool:
        """Check if Supabase object storage credentials are configured."""
        return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)

    def _get_supabase_headers(self) -> dict[str, str]:
        key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
        return {
            "Authorization": f"Bearer {key}",
            "apikey": key,
        }

    def _ensure_bucket(self, client: httpx.Client) -> None:
        """Ensure the target storage bucket exists in Supabase."""
        if self._bucket_verified or not self.is_remote_configured():
            return
        bucket = settings.SUPABASE_STORAGE_BUCKET
        base_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1"
        headers = self._get_supabase_headers()
        try:
            res = client.get(f"{base_url}/bucket/{bucket}", headers=headers, timeout=10.0)
            if res.status_code == 200:
                self._bucket_verified = True
                return
            if res.status_code == 404:
                create_res = client.post(
                    f"{base_url}/bucket",
                    headers={**headers, "Content-Type": "application/json"},
                    json={"id": bucket, "name": bucket, "public": False},
                    timeout=10.0,
                )
                if create_res.status_code in (200, 201, 400, 409):
                    self._bucket_verified = True
                    return
                logger.warning(
                    f"Could not auto-create Supabase bucket '{bucket}': status {create_res.status_code} {create_res.text}"
                )
        except Exception as e:
            logger.warning(f"Error checking/creating Supabase bucket '{bucket}': {e}")

    def upload_to_remote(self, file_path: Path, stored_filename: str) -> bool:
        """Upload a local dataset file to Supabase Object Storage."""
        if not self.is_remote_configured():
            return False

        bucket = settings.SUPABASE_STORAGE_BUCKET
        base_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1"
        content_type = "text/csv" if stored_filename.endswith(".csv") else "application/octet-stream"
        headers = {
            **self._get_supabase_headers(),
            "Content-Type": content_type,
            "x-upsert": "true",
        }

        with httpx.Client(timeout=60.0) as client:
            self._ensure_bucket(client)
            with open(file_path, "rb") as f:
                content = f.read()

            res = client.post(
                f"{base_url}/object/{bucket}/{stored_filename}",
                headers=headers,
                content=content,
            )
            if res.status_code in (200, 201):
                logger.info(f"Persisted dataset {stored_filename} to Supabase bucket '{bucket}'.")
                return True
            else:
                logger.error(
                    f"Failed to upload {stored_filename} to Supabase: status {res.status_code} - {res.text}"
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to persist dataset to cloud storage: {res.text}",
                )

    def download_from_remote(self, stored_filename: str, target_path: Path) -> bool:
        """Download a dataset file from Supabase Object Storage to local cache on disk."""
        if not self.is_remote_configured():
            return False

        bucket = settings.SUPABASE_STORAGE_BUCKET
        base_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1"
        headers = self._get_supabase_headers()

        try:
            with httpx.Client(timeout=60.0, follow_redirects=True) as client:
                # 1. Primary standard Supabase Storage download endpoint
                res = client.get(
                    f"{base_url}/object/{bucket}/{stored_filename}",
                    headers=headers,
                )
                # 2. Secondary fallback for authenticated route if standard returns 404
                if res.status_code == 404:
                    res = client.get(
                        f"{base_url}/object/authenticated/{bucket}/{stored_filename}",
                        headers=headers,
                    )

                if res.status_code == 200:
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    temp_path = target_path.with_suffix(target_path.suffix + f".{uuid.uuid4().hex[:8]}.tmp")
                    with open(temp_path, "wb") as f:
                        f.write(res.content)
                    temp_path.replace(target_path)
                    logger.info(
                        f"Restored dataset {stored_filename} from Supabase bucket '{bucket}' to local disk."
                    )
                    return True
                elif res.status_code == 404:
                    logger.warning(
                        f"Dataset {stored_filename} not found in Supabase bucket '{bucket}' (404)."
                    )
                    return False
                else:
                    logger.error(
                        f"Supabase download for {stored_filename} failed with status {res.status_code}: {res.text}"
                    )
                    return False
        except Exception as e:
            logger.error(f"Error downloading {stored_filename} from Supabase: {e}")
            return False

    def delete_remote(self, stored_filename: str) -> bool:
        """Delete an object from Supabase Object Storage."""
        if not self.is_remote_configured():
            return False

        bucket = settings.SUPABASE_STORAGE_BUCKET
        base_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1"
        headers = {
            **self._get_supabase_headers(),
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.request(
                    "DELETE",
                    f"{base_url}/object/{bucket}",
                    headers=headers,
                    json={"prefixes": [stored_filename]},
                )
                if res.status_code in (200, 204):
                    logger.info(f"Deleted {stored_filename} from Supabase bucket '{bucket}'.")
                    return True

                alt_res = client.delete(
                    f"{base_url}/object/{bucket}/{stored_filename}",
                    headers=headers,
                )
                return alt_res.status_code in (200, 204)
        except Exception as e:
            logger.warning(f"Error deleting {stored_filename} from Supabase: {e}")
            return False

    def generate_stored_filename(self, original_filename: str) -> str:
        """Generate an unpredictable, sanitized UUID-based filename preserving the file extension."""
        ext = Path(original_filename).suffix.lower()
        return f"{uuid.uuid4().hex}{ext}"

    def get_file_path(self, stored_filename: str) -> Path:
        """Resolve a stored filename to an absolute Path with strict path traversal prevention.

        If the file is not found on local disk and remote storage is configured,
        it is automatically downloaded from remote storage into the local cache.
        """
        resolved = (self.base_dir / stored_filename).resolve()
        if not resolved.is_relative_to(self.base_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path: path traversal detected.",
            )

        # Cache check: if missing locally, attempt to restore from remote storage
        if not resolved.exists() and self.is_remote_configured():
            downloaded = self.download_from_remote(stored_filename, resolved)
            if not downloaded or not resolved.exists():
                logger.warning(
                    f"Remote download failed or file missing for {stored_filename}; local file not available."
                )

        return resolved

    def save_upload_file(self, upload_file: UploadFile, stored_filename: str) -> tuple[Path, int]:
        """Stream an uploaded file to disk while enforcing max file size limits and persisting to cloud.

        Returns:
            Tuple of (saved_file_path, total_bytes_written)
        """
        resolved = (self.base_dir / stored_filename).resolve()
        if not resolved.is_relative_to(self.base_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path: path traversal detected.",
            )
        dest_path = resolved

        total_size = 0
        chunk_size = 1024 * 1024  # 1 MB chunk

        try:
            with open(dest_path, "wb") as f:
                while True:
                    chunk = upload_file.file.read(chunk_size)
                    if not chunk:
                        break
                    total_size += len(chunk)
                    if total_size > self.max_size_bytes:
                        f.close()
                        if dest_path.exists():
                            dest_path.unlink()
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
                        )
                    f.write(chunk)
        except HTTPException:
            raise
        except Exception as e:
            if dest_path.exists():
                dest_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save uploaded file: {str(e)}",
            )

        if total_size == 0:
            if dest_path.exists():
                dest_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes).",
            )

        # Persist to remote object storage if configured
        if self.is_remote_configured():
            try:
                self.upload_to_remote(dest_path, stored_filename)
            except Exception:
                if dest_path.exists():
                    dest_path.unlink()
                raise

        return dest_path, total_size

    def save_bytes(self, content: bytes, stored_filename: str) -> tuple[Path, int]:
        """Save raw bytes to disk and persist to cloud (useful for programmatic tests and utilities)."""
        if len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes).",
            )
        if len(content) > self.max_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
            )

        resolved = (self.base_dir / stored_filename).resolve()
        if not resolved.is_relative_to(self.base_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path: path traversal detected.",
            )
        dest_path = resolved

        with open(dest_path, "wb") as f:
            f.write(content)

        if self.is_remote_configured():
            try:
                self.upload_to_remote(dest_path, stored_filename)
            except Exception:
                if dest_path.exists():
                    dest_path.unlink()
                raise

        return dest_path, len(content)

    def delete_file(self, stored_filename: str) -> bool:
        """Safely delete a stored file from disk and remote storage if configured."""
        local_deleted = False
        try:
            path = (self.base_dir / stored_filename).resolve()
            if path.is_relative_to(self.base_dir) and path.exists():
                path.unlink()
                local_deleted = True
        except Exception:
            pass

        remote_deleted = False
        if self.is_remote_configured():
            remote_deleted = self.delete_remote(stored_filename)

        return local_deleted or remote_deleted


storage_service = LocalStorageService()
