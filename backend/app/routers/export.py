"""Export endpoints: Netscape HTML and JSON."""
from __future__ import annotations

import html
import json
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.database import get_db
from app.models import Bookmark, Category


router = APIRouter(prefix="/api/export", tags=["export"], dependencies=[RequireUser])


@router.get("/netscape")
def export_netscape(db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.sort_order, Category.id).all()
    lines = [
        "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
        "<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">",
        "<TITLE>crbox-links export</TITLE>",
        "<H1>Bookmarks</H1>",
        "<DL><p>",
    ]
    for cat in cats:
        lines.append(f"    <DT><H3>{html.escape(cat.name)}</H3>")
        lines.append("    <DL><p>")
        for bm in sorted(cat.bookmarks, key=lambda b: b.sort_order):
            tags = ",".join(t.name for t in bm.tags)
            extra = f' TAGS="{html.escape(tags)}"' if tags else ""
            lines.append(
                f'        <DT><A HREF="{html.escape(bm.url, quote=True)}"{extra}>'
                f"{html.escape(bm.title)}</A>"
            )
            if bm.notes:
                lines.append(f"        <DD>{html.escape(bm.notes)}")
        lines.append("    </DL><p>")
    lines.append("</DL><p>")
    body = "\n".join(lines)
    return Response(
        content=body,
        media_type="text/html",
        headers={
            "Content-Disposition": f'attachment; filename="crbox-links-{datetime.utcnow().date()}.html"'
        },
    )


@router.get("/json")
def export_json(db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.sort_order, Category.id).all()
    out = []
    for cat in cats:
        out.append({
            "name": cat.name,
            "color": cat.color,
            "icon": cat.icon,
            "bookmarks": [
                {
                    "title": bm.title,
                    "url": bm.url,
                    "description": bm.description,
                    "notes": bm.notes,
                    "tags": [t.name for t in bm.tags],
                    "favicon_source": bm.favicon_source,
                    "favicon_ref": bm.favicon_ref,
                }
                for bm in sorted(cat.bookmarks, key=lambda b: b.sort_order)
            ],
        })
    return Response(
        content=json.dumps(out, indent=2, ensure_ascii=False),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="crbox-links-{datetime.utcnow().date()}.json"'
        },
    )
