"""Bookmark CRUD, reorder, click, bulk operations."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.database import get_db
from app.models import Bookmark, Category, Tag
from app.schemas import (
    BookmarkCreate,
    BookmarkOut,
    BookmarkUpdate,
    BulkUpdate,
    ReorderRequest,
)
from app.services.favicon import auto_fetch, fetch_and_cache, resolve_favicon


router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"], dependencies=[RequireUser])


def _serialize(bm: Bookmark) -> dict:
    """Return a dict matching BookmarkOut, with the cached favicon URL filled."""
    return {
        "id": bm.id,
        "category_id": bm.category_id,
        "title": bm.title,
        "url": bm.url,
        "description": bm.description,
        "notes": bm.notes,
        "favicon_source": bm.favicon_source,
        "favicon_ref": bm.favicon_ref,
        "favicon_cached_url": resolve_favicon(bm),
        "sort_order": bm.sort_order,
        "click_count": bm.click_count,
        "last_clicked_at": bm.last_clicked_at,
        "last_check_status": bm.last_check_status,
        "tags": [{"id": t.id, "name": t.name, "color": t.color} for t in bm.tags],
        "created_at": bm.created_at,
        "updated_at": bm.updated_at,
    }


def _attach_tags(db: Session, bm: Bookmark, tag_names: list[str]) -> None:
    bm.tags.clear()
    for raw in tag_names:
        name = raw.strip().lower()[:80]
        if not name:
            continue
        tag = db.query(Tag).filter(Tag.name == name).first()
        if tag is None:
            tag = Tag(name=name)
            db.add(tag)
            db.flush()
        bm.tags.append(tag)


@router.get("", response_model=list[BookmarkOut])
def list_bookmarks(db: Session = Depends(get_db)):
    rows = db.query(Bookmark).order_by(Bookmark.category_id, Bookmark.sort_order).all()
    return [_serialize(b) for b in rows]


@router.post("", response_model=BookmarkOut, status_code=201)
def create_bookmark(payload: BookmarkCreate, db: Session = Depends(get_db)):
    cat = db.get(Category, payload.category_id)
    if cat is None:
        raise HTTPException(400, "Category not found")
    last = (
        db.query(Bookmark.sort_order)
        .filter(Bookmark.category_id == payload.category_id)
        .order_by(Bookmark.sort_order.desc())
        .first()
    )
    sort_order = ((last[0] if last else -100) + 100)

    cached_url = ""
    if payload.favicon_source == "auto":
        cached_url = auto_fetch(payload.url)
    elif payload.favicon_source == "url" and payload.favicon_ref:
        cached_url = fetch_and_cache(payload.favicon_ref)

    bm = Bookmark(
        category_id=payload.category_id,
        title=payload.title,
        url=payload.url,
        description=payload.description,
        notes=payload.notes,
        favicon_source=payload.favicon_source,
        favicon_ref=payload.favicon_ref,
        favicon_cached_url=cached_url,
        sort_order=sort_order,
    )
    db.add(bm)
    db.flush()
    _attach_tags(db, bm, payload.tag_names)
    db.commit()
    db.refresh(bm)
    return _serialize(bm)


@router.patch("/{bm_id}", response_model=BookmarkOut)
def update_bookmark(bm_id: int, payload: BookmarkUpdate, db: Session = Depends(get_db)):
    bm = db.get(Bookmark, bm_id)
    if bm is None:
        raise HTTPException(404, "Bookmark not found")

    data = payload.model_dump(exclude_unset=True)
    tag_names = data.pop("tag_names", None)
    refetch_auto = (
        ("url" in data and data["url"] != bm.url and bm.favicon_source == "auto")
        or (data.get("favicon_source") == "auto" and bm.favicon_source != "auto")
    )
    recache_url = (
        data.get("favicon_source") == "url"
        or ("favicon_ref" in data and bm.favicon_source == "url")
    )

    for k, v in data.items():
        setattr(bm, k, v)

    if refetch_auto:
        bm.favicon_cached_url = auto_fetch(bm.url)
    elif recache_url and bm.favicon_source == "url" and bm.favicon_ref:
        bm.favicon_cached_url = fetch_and_cache(bm.favicon_ref)

    if tag_names is not None:
        _attach_tags(db, bm, tag_names)

    db.commit()
    db.refresh(bm)
    return _serialize(bm)


@router.delete("/{bm_id}", status_code=204)
def delete_bookmark(bm_id: int, db: Session = Depends(get_db)):
    bm = db.get(Bookmark, bm_id)
    if bm is None:
        raise HTTPException(404, "Bookmark not found")
    db.delete(bm)
    db.commit()


@router.post("/{bm_id}/click", status_code=204)
def record_click(bm_id: int, db: Session = Depends(get_db)):
    bm = db.get(Bookmark, bm_id)
    if bm is None:
        raise HTTPException(404, "Bookmark not found")
    bm.click_count += 1
    bm.last_clicked_at = datetime.utcnow()
    db.commit()


@router.post("/{bm_id}/refresh-favicon", response_model=BookmarkOut)
def refresh_favicon(bm_id: int, db: Session = Depends(get_db)):
    bm = db.get(Bookmark, bm_id)
    if bm is None:
        raise HTTPException(404, "Bookmark not found")
    if bm.favicon_source == "url" and bm.favicon_ref:
        bm.favicon_cached_url = fetch_and_cache(bm.favicon_ref)
    else:
        bm.favicon_cached_url = auto_fetch(bm.url)
    db.commit()
    db.refresh(bm)
    return _serialize(bm)


@router.post("/reorder", status_code=204)
def reorder_bookmarks(payload: ReorderRequest, db: Session = Depends(get_db)):
    ids = [i.id for i in payload.items]
    by_id = {b.id: b for b in db.query(Bookmark).filter(Bookmark.id.in_(ids)).all()}
    for item in payload.items:
        b = by_id.get(item.id)
        if b is None:
            continue
        b.sort_order = item.sort_order
        if item.category_id is not None:
            b.category_id = item.category_id
    db.commit()


@router.post("/bulk", status_code=204)
def bulk_update(payload: BulkUpdate, db: Session = Depends(get_db)):
    bookmarks = db.query(Bookmark).filter(Bookmark.id.in_(payload.bookmark_ids)).all()
    if payload.delete:
        for b in bookmarks:
            db.delete(b)
        db.commit()
        return

    add_tags: list[Tag] = []
    for raw in payload.add_tag_names:
        name = raw.strip().lower()[:80]
        if not name:
            continue
        tag = db.query(Tag).filter(Tag.name == name).first()
        if tag is None:
            tag = Tag(name=name)
            db.add(tag)
            db.flush()
        add_tags.append(tag)
    remove_names = {n.strip().lower() for n in payload.remove_tag_names if n.strip()}

    for b in bookmarks:
        if payload.category_id is not None:
            b.category_id = payload.category_id
        for tag in add_tags:
            if tag not in b.tags:
                b.tags.append(tag)
        if remove_names:
            b.tags[:] = [t for t in b.tags if t.name not in remove_names]
    db.commit()
