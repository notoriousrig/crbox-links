"""Per-instance settings (theme, default sort, etc) stored as k/v rows."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import RequireUser
from app.database import get_db
from app.models import Setting


router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[RequireUser])


@router.get("")
def list_settings(db: Session = Depends(get_db)):
    return {row.key: row.value for row in db.query(Setting).all()}


@router.put("/{key}")
def upsert_setting(key: str, payload: dict, db: Session = Depends(get_db)):
    value = str(payload.get("value", ""))
    row = db.get(Setting, key)
    if row is None:
        row = Setting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()
    return {"key": key, "value": value}
