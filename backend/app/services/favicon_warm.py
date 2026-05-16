"""Bulk-warm the favicon cache: for every bookmark whose favicon_cached_url
isn't already pointing at /api/favicons/files/auto/..., discover + download +
write the bytes to disk, in parallel.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Bookmark
from app.services.favicon import auto_fetch, fetch_and_cache


log = logging.getLogger(__name__)

_WORKERS = 16
_LOCAL_PREFIX = "/api/favicons/files/auto/"


def _process(bm_id: int, url: str, source: str, ref: str, current_cached: str) -> tuple[int, str]:
    """Return (bookmark_id, new_cached_url) — caller writes back to DB."""
    if source in ("upload", "library"):
        return (bm_id, current_cached)
    if current_cached.startswith(_LOCAL_PREFIX):
        return (bm_id, current_cached)

    if source == "url" and ref:
        new = fetch_and_cache(ref)
        return (bm_id, new or current_cached or ref)

    # auto
    new = auto_fetch(url)
    return (bm_id, new or current_cached)


def warm_all() -> dict:
    """Walk every bookmark in parallel, refresh favicon_cached_url to local
    paths where possible, return summary counts.
    """
    db: Session = SessionLocal()
    try:
        rows = db.query(
            Bookmark.id, Bookmark.url, Bookmark.favicon_source,
            Bookmark.favicon_ref, Bookmark.favicon_cached_url,
        ).all()
        cached = 0
        skipped = 0
        failed = 0
        updates: dict[int, str] = {}
        with ThreadPoolExecutor(max_workers=_WORKERS) as pool:
            futures = [
                pool.submit(_process, r.id, r.url, r.favicon_source, r.favicon_ref, r.favicon_cached_url)
                for r in rows
            ]
            for fut in as_completed(futures):
                bm_id, new = fut.result()
                if new.startswith(_LOCAL_PREFIX):
                    cached += 1
                elif new:
                    failed += 1  # got a remote URL but couldn't cache locally
                else:
                    skipped += 1
                updates[bm_id] = new

        # Single commit at the end — much faster than 2k individual commits
        if updates:
            bm_rows = db.query(Bookmark).filter(Bookmark.id.in_(updates.keys())).all()
            for bm in bm_rows:
                new = updates.get(bm.id)
                if new is not None and new != bm.favicon_cached_url:
                    bm.favicon_cached_url = new
            db.commit()

        return {
            "total": len(rows),
            "cached_locally": cached,
            "remote_only": failed,
            "skipped": skipped,
        }
    finally:
        db.close()
