"""Favicon endpoints: upload, auto-fetch, library catalog, title-from-URL."""
from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.config import settings
from app.database import get_db
from app.models import Bookmark
from app.services.favicon import auto_fetch, fetch_title
from app.services.favicon_warm import warm_all


router = APIRouter(prefix="/api/favicons", tags=["favicons"], dependencies=[RequireUser])

_ALLOWED = {".png", ".svg", ".ico", ".jpg", ".jpeg", ".webp", ".gif"}
_MAX_BYTES = 512 * 1024


@router.post("/upload/{bm_id}")
async def upload_favicon(
    bm_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    bm = db.get(Bookmark, bm_id)
    if bm is None:
        raise HTTPException(404, "Bookmark not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in _ALLOWED:
        raise HTTPException(400, f"Unsupported file extension {ext!r}")
    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(413, f"Favicon too large (>{_MAX_BYTES} bytes)")

    fname = f"{bm_id}_{uuid.uuid4().hex[:8]}{ext}"
    target = Path(settings.favicon_dir) / fname
    target.parent.mkdir(parents=True, exist_ok=True)

    # Best-effort: delete previous upload file if any
    if bm.favicon_source == "upload" and bm.favicon_ref:
        prev = Path(settings.favicon_dir) / bm.favicon_ref
        try:
            if prev.is_file():
                prev.unlink()
        except OSError:
            pass

    target.write_bytes(data)

    bm.favicon_source = "upload"
    bm.favicon_ref = fname
    db.commit()
    return {"favicon_ref": fname, "url": f"/api/favicons/files/{fname}"}


@router.get("/auto")
def auto(url: str):
    return {"url": auto_fetch(url)}


@router.get("/title")
def title(url: str):
    return {"title": fetch_title(url)}


@router.get("/library/simpleicons")
def list_simple_icons():
    """Tell the frontend where to fetch the icon list — we don't bundle it.
    The frontend can hit https://cdn.jsdelivr.net/npm/simple-icons/_data/simple-icons.json
    directly, or use the npm package locally. Backend just confirms the CDN.
    """
    return {
        "catalog_url": "https://cdn.jsdelivr.net/npm/simple-icons@latest/_data/simple-icons.json",
        "icon_url_template": "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/{slug}.svg",
    }


@router.get("/library/lucide")
def list_lucide():
    return {
        "catalog_url": "https://cdn.jsdelivr.net/npm/lucide-static@latest/tags.json",
        "icon_url_template": "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/{name}.svg",
    }


@router.post("/warm-cache")
def warm_cache():
    """Backfill the local favicon cache for every bookmark.

    Runs synchronously with a thread-pool of 16 workers, so ~2000 bookmarks
    take a few minutes. The frontend should show a spinner and not time out
    (nginx proxy_read_timeout is 600s for this endpoint).
    """
    return warm_all()
