import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, JSON, String, func, Uuid
from sqlalchemy.orm import relationship
from app.database.session import Base


class DatasetQualityRule(Base):
    """Configuration record for a data quality rule asserted against a dataset column."""

    __tablename__ = "dataset_quality_rules"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    dataset_id = Column(
        Uuid,
        ForeignKey("datasets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    column_name = Column(String(255), nullable=False)
    rule_type = Column(String(50), nullable=False)  # "not_null", "unique", "numeric_range", "allowed_values", "email_format", "no_future_dates"
    rule_name = Column(String(255), nullable=False)
    configuration = Column(JSON, nullable=False, default=dict)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(
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
    dataset = relationship("Dataset", back_populates="quality_rules")
