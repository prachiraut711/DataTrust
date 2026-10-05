import uuid
from sqlalchemy import Column, String, Text, Integer, BigInteger, DateTime, ForeignKey, func, Uuid
from sqlalchemy.orm import relationship
from app.database.session import Base


class Dataset(Base):
    """Dataset metadata record representing an uploaded CSV or Parquet file."""

    __tablename__ = "datasets"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    workspace_id = Column(
        Uuid,
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_format = Column(String(32), nullable=False)  # "csv" or "parquet"
    file_size = Column(BigInteger, nullable=False)  # Size in bytes
    row_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    uploaded_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="datasets")
    columns = relationship(
        "DatasetColumn",
        back_populates="dataset",
        cascade="all, delete-orphan",
        order_by="DatasetColumn.created_at",
    )
    quality_rules = relationship(
        "DatasetQualityRule",
        back_populates="dataset",
        cascade="all, delete-orphan",
        order_by="DatasetQualityRule.created_at",
    )
