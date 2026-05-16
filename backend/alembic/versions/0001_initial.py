"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-16

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "category",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("color", sa.String(20), nullable=False, server_default="gray"),
        sa.Column("icon", sa.String(40), nullable=False, server_default=""),
        sa.Column("collapsed", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "tag",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("color", sa.String(20), nullable=False, server_default="blue"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("name", name="uq_tag_name"),
    )

    op.create_table(
        "bookmark",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(),
                  sa.ForeignKey("category.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("favicon_source", sa.String(20), nullable=False, server_default="auto"),
        sa.Column("favicon_ref", sa.Text(), nullable=False, server_default=""),
        sa.Column("favicon_cached_url", sa.Text(), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("click_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_clicked_at", sa.DateTime(), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(), nullable=True),
        sa.Column("last_check_status", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_bookmark_category_id", "bookmark", ["category_id"])
    op.create_index("ix_bookmark_cat_sort", "bookmark", ["category_id", "sort_order"])

    op.create_table(
        "bookmark_tag",
        sa.Column("bookmark_id", sa.Integer(),
                  sa.ForeignKey("bookmark.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(),
                  sa.ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True),
    )

    op.create_table(
        "setting",
        sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_table("setting")
    op.drop_table("bookmark_tag")
    op.drop_index("ix_bookmark_cat_sort", table_name="bookmark")
    op.drop_index("ix_bookmark_category_id", table_name="bookmark")
    op.drop_table("bookmark")
    op.drop_table("tag")
    op.drop_table("category")
