"""create dataset_columns table

Revision ID: 003_create_dataset_columns
Revises: 002_create_datasets
Create Date: 2026-10-05 11:36:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "003_create_dataset_columns"
down_revision: Union[str, None] = "002_create_datasets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dataset_columns",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dataset_id", sa.Uuid(), nullable=False),
        sa.Column("column_name", sa.String(length=255), nullable=False),
        sa.Column("data_type", sa.String(length=100), nullable=False),
        sa.Column("null_count", sa.Integer(), nullable=False),
        sa.Column("null_percentage", sa.Float(), nullable=False),
        sa.Column("distinct_count", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["dataset_id"], ["datasets.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_dataset_columns_dataset_id"),
        "dataset_columns",
        ["dataset_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_dataset_columns_dataset_id"), table_name="dataset_columns"
    )
    op.drop_table("dataset_columns")
