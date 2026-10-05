import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, func, Uuid
from sqlalchemy.orm import relationship
from app.database.session import Base


class DatasetColumn(Base):
    """Metadata for an individual column within an ingested dataset."""

    __tablename__ = "dataset_columns"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    dataset_id = Column(
        Uuid,
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    column_name = Column(String(255), nullable=False)
    data_type = Column(String(100), nullable=False)
    null_count = Column(Integer, nullable=False, default=0)
    null_percentage = Column(Float, nullable=False, default=0.0)
    distinct_count = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    dataset = relationship("Dataset", back_populates="columns")
