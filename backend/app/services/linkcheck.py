"""Nightly link checker. HEAD each URL, falling back to GET, record status."""
from __future__ import annotations

import logging
from datetime import datetime

import httpx
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Bookmark


log = logging.getLogger(__name__)

_TIMEOUT = 10.0
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; crbox-links-linkcheck/0.1)"}


def _probe(url: str) -> int:
    try:
        with httpx.Client(follow_redirects=True, timeout=_TIMEOUT, headers=_HEADERS) as cli:
            r = cli.head(url)
            if r.status_code == 405 or r.status_code >= 400:
                r = cli.get(url)
            return r.status_code
    except Exception:
        return 0  # network error


def check_one(db: Session, bookmark_id: int) -> int:
    bm = db.get(Bookmark, bookmark_id)
    if bm is None:
        return 0
    status = _probe(bm.url)
    bm.last_checked_at = datetime.utcnow()
    bm.last_check_status = status
    db.commit()
    return status


def check_all_links() -> int:
    db: Session = SessionLocal()
    try:
        rows = db.query(Bookmark).all()
        for bm in rows:
            status = _probe(bm.url)
            bm.last_checked_at = datetime.utcnow()
            bm.last_check_status = status
        db.commit()
        return len(rows)
    finally:
        db.close()
