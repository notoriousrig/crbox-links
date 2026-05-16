"""Pydantic schemas for request/response validation."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


FaviconSource = Literal["auto", "url", "upload", "library"]


class TagBase(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = "blue"


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = None


class TagOut(TagBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str = "gray"
    icon: str = ""
    collapsed: bool = False


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = None
    icon: str | None = None
    collapsed: bool | None = None
    sort_order: int | None = None


class CategoryOut(CategoryBase):
    id: int
    sort_order: int
    model_config = ConfigDict(from_attributes=True)


class BookmarkBase(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    url: str = Field(min_length=1)
    description: str = ""
    notes: str = ""
    favicon_source: FaviconSource = "auto"
    favicon_ref: str = ""


class BookmarkCreate(BookmarkBase):
    category_id: int
    tag_names: list[str] = []


class BookmarkUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    url: str | None = Field(default=None, min_length=1)
    description: str | None = None
    notes: str | None = None
    favicon_source: FaviconSource | None = None
    favicon_ref: str | None = None
    category_id: int | None = None
    sort_order: int | None = None
    tag_names: list[str] | None = None


class BookmarkOut(BookmarkBase):
    id: int
    category_id: int
    sort_order: int
    click_count: int
    last_clicked_at: datetime | None
    last_check_status: int | None
    favicon_cached_url: str
    tags: list[TagOut]
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReorderItem(BaseModel):
    id: int
    sort_order: int
    category_id: int | None = None  # for cross-category moves on bookmarks


class ReorderRequest(BaseModel):
    items: list[ReorderItem]


class BulkUpdate(BaseModel):
    bookmark_ids: list[int]
    add_tag_names: list[str] = []
    remove_tag_names: list[str] = []
    category_id: int | None = None
    delete: bool = False


class ImportResult(BaseModel):
    source: str
    categories_created: int
    bookmarks_created: int
    bookmarks_skipped: int
    errors: list[str] = []


class SettingOut(BaseModel):
    key: str
    value: str
    model_config = ConfigDict(from_attributes=True)


class FaviconLibraryItem(BaseModel):
    key: str  # e.g. "simpleicons:github" or "lucide:folder"
    name: str
    library: Literal["simpleicons", "lucide"]
    url: str  # cdn URL for the SVG
