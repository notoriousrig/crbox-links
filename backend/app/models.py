"""SQLAlchemy models."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# Many-to-many join table for bookmarks <-> tags
bookmark_tag = Table(
    "bookmark_tag",
    Base.metadata,
    Column("bookmark_id", Integer, ForeignKey("bookmark.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True),
)


class Category(Base):
    __tablename__ = "category"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="gray", nullable=False)
    icon: Mapped[str] = mapped_column(String(40), default="", nullable=False)  # emoji or library key
    collapsed: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    bookmarks: Mapped[list["Bookmark"]] = relationship(
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="Bookmark.sort_order",
    )


class Bookmark(Base):
    __tablename__ = "bookmark"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("category.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # Favicon: source in {"auto", "url", "upload", "library"};
    # ref is the URL, file path under FAVICON_DIR, or library key
    # (e.g. "simpleicons:github", "lucide:folder", "emoji:🦀")
    favicon_source: Mapped[str] = mapped_column(String(20), default="auto", nullable=False)
    favicon_ref: Mapped[str] = mapped_column(Text, default="", nullable=False)
    favicon_cached_url: Mapped[str] = mapped_column(Text, default="", nullable=False)

    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    click_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_clicked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_check_status: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    category: Mapped[Category] = relationship(back_populates="bookmarks")
    tags: Mapped[list["Tag"]] = relationship(
        secondary=bookmark_tag, back_populates="bookmarks", order_by="Tag.name"
    )

    __table_args__ = (
        Index("ix_bookmark_cat_sort", "category_id", "sort_order"),
    )


class Tag(Base):
    __tablename__ = "tag"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    color: Mapped[str] = mapped_column(String(20), default="blue", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    bookmarks: Mapped[list[Bookmark]] = relationship(
        secondary=bookmark_tag, back_populates="tags"
    )

    __table_args__ = (
        UniqueConstraint("name", name="uq_tag_name"),
    )


class Setting(Base):
    __tablename__ = "setting"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="", nullable=False)
