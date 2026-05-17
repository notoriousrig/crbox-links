"""Bookmark importers.

Three sources:
  - Netscape HTML (Chrome/Edge/Firefox/Safari export, booky export uses this too)
  - booky.io JSON (its native export)
  - ZIP of Windows .url files (INI format, [InternetShortcut])

All three normalize to the same shape:
    [{ "category": str, "title": str, "url": str, "tags": list[str] }, ...]
and call _bulk_insert() which dedupes by (category, url).
"""
from __future__ import annotations

import configparser
import io
import json
import logging
import zipfile
from typing import Iterable

from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.models import Bookmark, Category, Tag
from app.schemas import ImportResult
from app.services.url_normalize import normalize_url


log = logging.getLogger(__name__)

DEFAULT_CATEGORY = "Imported"


# ---------- Netscape HTML ----------

def parse_netscape(data: bytes) -> list[dict]:
    """Parse the Netscape Bookmark File Format.

    The format is notoriously malformed (DT tags are never closed) and HTML
    parsers nest them differently. To stay robust across Chrome, Firefox,
    Safari, Edge, and booky.io variants, we ignore DT structure entirely and
    walk H3 + A elements in document order, tracking the folder hierarchy via
    each element's DL-ancestor depth. DL nesting is preserved consistently by
    lxml even when DTs aren't.

    Hierarchy is flattened with " / " (e.g. "AI / General"), so the
    bookmark manager's flat-category model surfaces the booky.io structure.
    """
    soup = BeautifulSoup(data, "lxml")
    out: list[dict] = []
    folder_stack: list[tuple[int, str]] = []  # (content_dl_depth, folder_name)

    for el in soup.find_all(["h3", "a"]):
        name = el.name.lower()
        if name == "h3":
            folder = (el.get_text(strip=True) or "").strip()
            if not folder:
                continue
            content_depth = _dl_depth(el) + 1
            folder_stack = [(d, n) for (d, n) in folder_stack if d < content_depth]
            folder_stack.append((content_depth, folder))
        else:
            url = (el.get("href") or "").strip()
            if not url:
                continue
            title = el.get_text(strip=True) or url
            a_depth = _dl_depth(el)
            relevant = [n for (d, n) in folder_stack if d <= a_depth]
            category = " / ".join(relevant) if relevant else DEFAULT_CATEGORY
            tags: list[str] = []
            tags_attr = el.get("tags")
            if tags_attr:
                tags = [t.strip() for t in str(tags_attr).split(",") if t.strip()]
            out.append({"category": category, "title": title, "url": url, "tags": tags})
    return out


def _dl_depth(el) -> int:
    return sum(1 for a in el.parents if getattr(a, "name", None) == "dl")


# ---------- booky.io JSON ----------

def parse_booky_json(data: bytes) -> list[dict]:
    """booky.io export schema is typically:
       { "dashboards": [
           { "categories": [
               { "name": str,
                 "bookmarks": [ { "name": str, "url": str }, ... ] }
           ] }
       ] }
    The dashboard name is ignored — we flatten to a single category list.
    """
    try:
        doc = json.loads(data.decode("utf-8"))
    except UnicodeDecodeError:
        doc = json.loads(data.decode("utf-8", errors="replace"))

    out: list[dict] = []

    def walk(obj):
        if isinstance(obj, dict):
            # Recognize a category-like node
            if "bookmarks" in obj and isinstance(obj["bookmarks"], list):
                category = obj.get("name") or obj.get("title") or DEFAULT_CATEGORY
                for bm in obj["bookmarks"]:
                    if not isinstance(bm, dict):
                        continue
                    url = bm.get("url") or bm.get("href") or ""
                    title = bm.get("name") or bm.get("title") or url
                    if url:
                        out.append({"category": category, "title": title, "url": url, "tags": []})
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(doc)
    return out


# ---------- ZIP of .url files ----------

def parse_url_zip(data: bytes) -> list[dict]:
    """Each .url file is INI format:
        [InternetShortcut]
        URL=https://example.com/
        IconFile=...
    Title is taken from the filename (sans .url extension). The folder name
    inside the zip (if any) becomes the category.
    """
    out: list[dict] = []
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = info.filename
            if not name.lower().endswith(".url"):
                continue
            try:
                raw = zf.read(info).decode("utf-8", errors="ignore")
            except Exception:
                continue
            cp = configparser.ConfigParser(interpolation=None, strict=False)
            try:
                cp.read_string(raw)
            except configparser.Error:
                continue
            url = ""
            for section in cp.sections():
                if "URL" in cp[section]:
                    url = cp[section]["URL"].strip()
                    break
            if not url:
                continue
            # filename → title; folder → category
            parts = name.replace("\\", "/").split("/")
            stem = parts[-1][:-4]  # drop ".url"
            category = parts[-2] if len(parts) > 1 else DEFAULT_CATEGORY
            out.append({"category": category, "title": stem, "url": url, "tags": []})
    return out


# ---------- shared insert ----------

def bulk_insert(db: Session, source: str, items: Iterable[dict]) -> ImportResult:
    """Dedupe by (category, url). Build nested categories from " / "-separated
    names so 'AI / General' becomes parent 'AI' with child 'General'.
    """
    items = list(items)
    # Key categories by (parent_id, name) so identical leaf names under
    # different parents stay distinct.
    cat_by_key: dict[tuple[int | None, str], Category] = {
        (c.parent_id, c.name): c for c in db.query(Category).all()
    }
    tag_by_name: dict[str, Tag] = {t.name: t for t in db.query(Tag).all()}

    next_top_sort = (
        max((c.sort_order for c in cat_by_key.values() if c.parent_id is None), default=-100) + 100
    )
    cat_next_bookmark_sort: dict[int, int] = {}

    created_cats = 0
    created = 0
    skipped = 0
    errors: list[str] = []

    existing = {
        (row.category_id, row.url)
        for row in db.query(Bookmark.category_id, Bookmark.url).all()
    }

    def find_or_create_path(path: list[str]) -> Category:
        nonlocal created_cats, next_top_sort
        parent_id: int | None = None
        leaf: Category | None = None
        for seg in path:
            seg = seg[:120]
            key = (parent_id, seg)
            cat = cat_by_key.get(key)
            if cat is None:
                if parent_id is None:
                    sort_order = next_top_sort
                    next_top_sort += 100
                else:
                    sort_order = 100  # rough; reorder via UI
                cat = Category(name=seg, parent_id=parent_id, sort_order=sort_order)
                db.add(cat)
                db.flush()
                cat_by_key[key] = cat
                created_cats += 1
            parent_id = cat.id
            leaf = cat
        assert leaf is not None
        return leaf

    for it in items:
        try:
            cat_raw = (it.get("category") or DEFAULT_CATEGORY).strip() or DEFAULT_CATEGORY
            path = [s.strip() for s in cat_raw.split(" / ") if s.strip()]
            if not path:
                path = [DEFAULT_CATEGORY]
            raw_url = (it.get("url") or "").strip()
            if not raw_url:
                continue
            raw_title = (it.get("title") or raw_url).strip()[:500] or raw_url
            url = normalize_url(raw_url, raw_title)
            title = raw_title

            cat = find_or_create_path(path)

            if (cat.id, url) in existing:
                skipped += 1
                continue

            cat_next_sort = cat_next_bookmark_sort.get(cat.id)
            sort_order = cat_next_sort
            if sort_order is None:
                last = (
                    db.query(Bookmark.sort_order)
                    .filter(Bookmark.category_id == cat.id)
                    .order_by(Bookmark.sort_order.desc())
                    .first()
                )
                sort_order = ((last[0] if last else -100) + 100)
            cat_next_bookmark_sort[cat.id] = sort_order + 100

            bm = Bookmark(
                category_id=cat.id,
                title=title,
                url=url,
                sort_order=sort_order,
            )

            for tag_name in (it.get("tags") or [])[:20]:
                tag_name = tag_name.strip().lower()[:80]
                if not tag_name:
                    continue
                tag = tag_by_name.get(tag_name)
                if tag is None:
                    tag = Tag(name=tag_name)
                    db.add(tag)
                    db.flush()
                    tag_by_name[tag_name] = tag
                bm.tags.append(tag)

            db.add(bm)
            existing.add((cat.id, url))
            created += 1
        except Exception as exc:
            errors.append(str(exc))
            log.exception("import row failed")

    db.commit()
    return ImportResult(
        source=source,
        categories_created=created_cats,
        bookmarks_created=created,
        bookmarks_skipped=skipped,
        errors=errors[:20],
    )
