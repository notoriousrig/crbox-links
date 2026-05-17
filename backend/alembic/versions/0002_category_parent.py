"""category.parent_id for nested categories

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-17

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("category") as batch:
        batch.add_column(sa.Column("parent_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_category_parent", "category", ["parent_id"], ["id"], ondelete="CASCADE"
        )
    op.create_index("ix_category_parent_id", "category", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_category_parent_id", table_name="category")
    with op.batch_alter_table("category") as batch:
        batch.drop_constraint("fk_category_parent", type_="foreignkey")
        batch.drop_column("parent_id")
