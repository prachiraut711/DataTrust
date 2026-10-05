import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.dataset import Dataset
from app.models.dataset_column import DatasetColumn
from app.models.user import User
from app.models.workspace import Workspace
from app.services.datasets.inspection_service import inspection_service
from app.services.storage.local_storage import storage_service


class DatasetService:
    """Domain service managing dataset validation, ingestion, analytical inspection, and deletion."""

    def validate_file_format(self, filename: str) -> str:
        """Validate that the file extension is supported and return normalized format ('csv' or 'parquet')."""
        if not filename or not filename.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File name cannot be empty.",
            )

        ext = Path(filename).suffix.lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            allowed_str = ", ".join(settings.ALLOWED_EXTENSIONS)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}'. Only {allowed_str} are supported.",
            )

        return "csv" if ext == ".csv" else "parquet"

    def get_user_workspace(self, db: Session, user: User) -> Workspace:
        """Resolve the primary active workspace for the given user."""
        stmt = (
            select(Workspace)
            .where(Workspace.owner_id == user.id)
            .order_by(Workspace.created_at.asc())
        )
        workspace = db.execute(stmt).scalars().first()
        if not workspace:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User does not have an active workspace.",
            )
        return workspace

    def upload_dataset(
        self,
        db: Session,
        user: User,
        file: UploadFile,
        name: str,
        description: Optional[str] = None,
    ) -> Dataset:
        """Validate, store, inspect with DuckDB, and register a dataset with its column metadata."""
        # 1. Resolve workspace and validate format
        workspace = self.get_user_workspace(db, user)
        clean_name = name.strip()
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset name cannot be empty.",
            )

        file_format = self.validate_file_format(file.filename or "")

        # 2. Generate safe UUID-based stored filename and save stream
        stored_filename = storage_service.generate_stored_filename(file.filename or f"dataset.{file_format}")
        saved_path: Optional[Path] = None

        try:
            saved_path, file_size = storage_service.save_upload_file(file, stored_filename)

            # 3. In-process DuckDB inspection (zero external dependencies)
            inspection = inspection_service.inspect_file(saved_path, file_format)

            # 4. Persist metadata and columns in a database transaction
            dataset = Dataset(
                workspace_id=workspace.id,
                name=clean_name,
                description=description.strip() if description else None,
                original_filename=file.filename or stored_filename,
                stored_filename=stored_filename,
                file_format=file_format,
                file_size=file_size,
                row_count=inspection.row_count,
                column_count=inspection.column_count,
            )
            db.add(dataset)
            db.flush()

            for col in inspection.columns:
                db_col = DatasetColumn(
                    dataset_id=dataset.id,
                    column_name=col.column_name,
                    data_type=col.data_type,
                    null_count=col.null_count,
                    null_percentage=col.null_percentage,
                    distinct_count=col.distinct_count,
                )
                db.add(db_col)

            db.commit()

            # Reload with columns eagerly loaded
            stmt = (
                select(Dataset)
                .where(Dataset.id == dataset.id)
                .options(selectinload(Dataset.columns))
            )
            return db.execute(stmt).scalar_one()

        except Exception:
            # If inspection or database persistence fails, clean up the disk file
            db.rollback()
            if saved_path and saved_path.exists():
                storage_service.delete_file(stored_filename)
            raise

    def list_datasets(self, db: Session, user: User) -> List[Dataset]:
        """List all datasets belonging to workspaces owned by the user."""
        user_workspace_ids = [w.id for w in user.workspaces]
        if not user_workspace_ids:
            return []

        stmt = (
            select(Dataset)
            .where(Dataset.workspace_id.in_(user_workspace_ids))
            .order_by(Dataset.uploaded_at.desc())
        )
        return list(db.execute(stmt).scalars().all())

    def get_dataset(self, db: Session, user: User, dataset_id: uuid.UUID) -> Dataset:
        """Retrieve dataset details and columns, ensuring user workspace ownership."""
        stmt = (
            select(Dataset)
            .where(Dataset.id == dataset_id)
            .options(selectinload(Dataset.columns))
        )
        dataset = db.execute(stmt).scalar_one_or_none()

        if dataset is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found.",
            )

        user_workspace_ids = {w.id for w in user.workspaces}
        if dataset.workspace_id not in user_workspace_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found.",
            )

        return dataset

    def delete_dataset(self, db: Session, user: User, dataset_id: uuid.UUID) -> bool:
        """Delete dataset from database and disk storage after verifying ownership."""
        dataset = self.get_dataset(db, user, dataset_id)

        # Delete physical file from storage
        storage_service.delete_file(dataset.stored_filename)

        # Delete database record (cascades to dataset_columns)
        db.delete(dataset)
        db.commit()
        return True


dataset_service = DatasetService()
