"""One-shot admin operations on the bookmark DB."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.database import get_db
from app.models import Bookmark, Category
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


@router.post("/split-nested-categories")
def split_nested_categories(db: Session = Depends(get_db)):
    """Convert flat category names like "AI / General" into a real parent/
    child hierarchy: a top-level "AI" plus a child "General" with
    parent_id=AI.id. Idempotent.
    """
    all_cats = db.query(Category).all()
    # find-or-create cache keyed by (parent_id, name)
    by_key: dict[tuple[int | None, str], Category] = {
        (c.parent_id, c.name): c for c in all_cats
    }

    parents_created = 0
    children_renamed = 0
    samples: list[dict] = []

    next_top_sort = (
        max((c.sort_order for c in all_cats if c.parent_id is None), default=-100) + 100
    )

    for cat in list(all_cats):
        if " / " not in cat.name:
            continue
        segments = [s.strip() for s in cat.name.split(" / ") if s.strip()]
        if len(segments) < 2:
            continue

        # Walk parent chain creating cats as needed
        current_parent_id: int | None = None
        for seg in segments[:-1]:
            key = (current_parent_id, seg)
            parent_cat = by_key.get(key)
            if parent_cat is None:
                if current_parent_id is None:
                    sort_order = next_top_sort
                    next_top_sort += 100
                else:
                    sort_order = 100
                parent_cat = Category(name=seg, parent_id=current_parent_id, sort_order=sort_order)
                db.add(parent_cat)
                db.flush()
                by_key[key] = parent_cat
                parents_created += 1
            current_parent_id = parent_cat.id

        # Rename the current cat to the last segment, attach to parent
        last_name = segments[-1]
        # Collision: another category already lives at (current_parent_id, last_name)
        if (current_parent_id, last_name) in by_key and by_key[(current_parent_id, last_name)].id != cat.id:
            i = 2
            while (current_parent_id, f"{last_name} ({i})") in by_key:
                i += 1
            last_name = f"{last_name} ({i})"

        old_name = cat.name
        # Remove old key, set new state, insert new key
        by_key.pop((cat.parent_id, cat.name), None)
        cat.parent_id = current_parent_id
        cat.name = last_name
        by_key[(current_parent_id, last_name)] = cat
        children_renamed += 1
        if len(samples) < 10:
            samples.append({"id": cat.id, "before": old_name, "after": last_name, "parent_id": current_parent_id})

    db.commit()
    return {
        "examined": len(all_cats),
        "parents_created": parents_created,
        "children_renamed": children_renamed,
        "samples": samples,
    }
