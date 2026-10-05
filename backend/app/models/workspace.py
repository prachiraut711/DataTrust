import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, func, Uuid
from sqlalchemy.orm import relationship
from app.database.session import Base


class Workspace(Base):
    """Workspace database model representing an isolated analytical project workspace."""

    __tablename__ = "workspaces"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    owner_id = Column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
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
    owner = relationship("User", back_populates="workspaces")
