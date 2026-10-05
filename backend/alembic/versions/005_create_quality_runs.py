"""create quality_runs table

Revision ID: 005_create_quality_runs
Revises: 004_create_dataset_quality_rules
Create Date: 2026-10-05 12:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "005_create_quality_runs"
down_revision: Union[str, None] = "004_create_dataset_quality_rules"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "quality_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dataset_id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("column_count", sa.Integer(), nullable=False),
        sa.Column("quality_score", sa.Float(), nullable=False),
        sa.Column("completeness_score", sa.Float(), nullable=False),
        sa.Column("anomaly_score", sa.Float(), nullable=False),
        sa.Column("reliability_score", sa.Float(), nullable=False),
        sa.Column("anomaly_percentage", sa.Float(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["dataset_id"], ["datasets.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_quality_runs_dataset_id"),
        "quality_runs",
        ["dataset_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_quality_runs_workspace_id"),
        "quality_runs",
        ["workspace_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_quality_runs_created_at"),
        "quality_runs",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_quality_runs_created_at"),
        table_name="quality_runs",
    )
    op.drop_index(
        op.f("ix_quality_runs_workspace_id"),
        table_name="quality_runs",
    )
    op.drop_index(
        op.f("ix_quality_runs_dataset_id"),
        table_name="quality_runs",
    )
    op.drop_table("quality_runs")
