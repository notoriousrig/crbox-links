"""One-shot admin operations on the bookmark DB."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.database import get_db
from app.models import Bookmark
from app.services.url_normalize import normalize_url


router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[RequireUser])


@router.post("/fix-urls")
def fix_urls(db: Session = Depends(get_db)):
    """Normalize malformed bookmark URLs (//foo, scheme-less, etc).

    Returns a dict with counts and a small sample of changes for visibility.
    """
    rows = db.query(Bookmark).all()
    fixed = 0
    samples: list[dict[str, str]] = []
    for bm in rows:
        new_url = normalize_url(bm.url, bm.title)
        if new_url != bm.url:
            if len(samples) < 10:
                samples.append({"id": bm.id, "before": bm.url, "after": new_url})
            bm.url = new_url
            fixed += 1
    db.commit()
    return {
        "examined": len(rows),
        "fixed": fixed,
        "samples": samples,
    }
