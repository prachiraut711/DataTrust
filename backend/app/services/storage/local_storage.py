import os
import uuid
from pathlib import Path
from typing import BinaryIO
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings


class LocalStorageService:
    """Service handling local filesystem storage for uploaded tabular datasets.

    Designed with a clean interface so it can be swapped with S3/GCS in future cloud deployments.
    """

    def __init__(self, base_dir: str = settings.UPLOAD_DIR):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.max_size_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    def generate_stored_filename(self, original_filename: str) -> str:
        """Generate an unpredictable, sanitized UUID-based filename preserving the file extension."""
        ext = Path(original_filename).suffix.lower()
        return f"{uuid.uuid4().hex}{ext}"

    def get_file_path(self, stored_filename: str) -> Path:
        """Resolve a stored filename to an absolute Path with strict path traversal prevention."""
        resolved = (self.base_dir / stored_filename).resolve()
        if not resolved.is_relative_to(self.base_dir):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path: path traversal detected.",
            )
        return resolved

    def save_upload_file(self, upload_file: UploadFile, stored_filename: str) -> tuple[Path, int]:
        """Stream an uploaded file to disk while enforcing max file size limits.

        Returns:
            Tuple of (saved_file_path, total_bytes_written)
        """
        dest_path = self.get_file_path(stored_filename)
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
                        # Clean up partial file
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

        return dest_path, total_size

    def save_bytes(self, content: bytes, stored_filename: str) -> tuple[Path, int]:
        """Save raw bytes to disk (useful for programmatic tests)."""
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

        dest_path = self.get_file_path(stored_filename)
        with open(dest_path, "wb") as f:
            f.write(content)

        return dest_path, len(content)

    def delete_file(self, stored_filename: str) -> bool:
        """Safely delete a stored file from disk if it exists."""
        try:
            path = self.get_file_path(stored_filename)
            if path.exists():
                path.unlink()
                return True
            return False
        except Exception:
            return False


storage_service = LocalStorageService()
