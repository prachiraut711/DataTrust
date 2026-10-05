import uuid
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, func, Uuid
from sqlalchemy.orm import relationship
from app.database.session import Base


class QualityRun(Base):
    """Historical snapshot of a dataset's quality, completeness, anomaly, and reliability metrics."""

    __tablename__ = "quality_runs"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    dataset_id = Column(
        Uuid,
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    workspace_id = Column(
        Uuid,
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_count = Column(Integer, nullable=False)
    column_count = Column(Integer, nullable=False)
    quality_score = Column(Float, nullable=False)
    completeness_score = Column(Float, nullable=False)
    anomaly_score = Column(Float, nullable=False)
    reliability_score = Column(Float, nullable=False)
    anomaly_percentage = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    dataset = relationship("Dataset", back_populates="quality_runs")
    workspace = relationship("Workspace")
