"""Import endpoints for the three supported sources."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.database import get_db
from app.schemas import ImportResult
from app.services.importers import (
    bulk_insert,
    parse_booky_json,
    parse_netscape,
    parse_url_zip,
)


router = APIRouter(prefix="/api/import", tags=["import"], dependencies=[RequireUser])


@router.post("/netscape", response_model=ImportResult)
async def import_netscape(file: UploadFile = File(...), db: Session = Depends(get_db)):
    data = await file.read()
    try:
        items = parse_netscape(data)
    except Exception as exc:
        raise HTTPException(400, f"Parse failed: {exc}") from exc
    return bulk_insert(db, "netscape", items)


@router.post("/booky", response_model=ImportResult)
async def import_booky(file: UploadFile = File(...), db: Session = Depends(get_db)):
    data = await file.read()
    try:
        items = parse_booky_json(data)
    except Exception as exc:
        raise HTTPException(400, f"Parse failed: {exc}") from exc
    return bulk_insert(db, "booky", items)


@router.post("/url-zip", response_model=ImportResult)
async def import_url_zip(file: UploadFile = File(...), db: Session = Depends(get_db)):
    data = await file.read()
    try:
        items = parse_url_zip(data)
    except Exception as exc:
        raise HTTPException(400, f"Parse failed: {exc}") from exc
    return bulk_insert(db, "url-zip", items)
